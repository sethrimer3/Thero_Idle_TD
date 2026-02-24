/**
 * Tsadi tower particle fusion simulation module.
 * Provides an idle physics simulation with particle collisions and tier-based fusion.
 * 
 * Particles bounce around in 2D space. When two particles of the same tier collide,
 * they fuse into a single particle of tier+1, conserving momentum and mass.
 * The highest tier reached determines the number of Tsadi glyphs earned.
 */

import {
  NULL_TIER,
  GREEK_SEQUENCE_LENGTH,
  COLLAPSED_DIMENSION_THRESHOLD,
  WAVE_INITIAL_RADIUS_MULTIPLIER,
  WAVE_MAX_RADIUS_MULTIPLIER,
  WAVE_INITIAL_FORCE,
  WAVE_FADE_RATE,
  WAVE_EXPANSION_RATE,
  WAVE_FORCE_DECAY_RATE,
  WAVE_FORCE_DECAY_LOG,
  WAVE_MIN_FORCE_THRESHOLD,
  WAVE_MIN_DISTANCE,
  LEGACY_MOLECULE_RECIPES,
  ADVANCED_MOLECULE_UNLOCK_TIER,
  normalizeTierList,
  sortTierListWithDuplicates,
  hasValidMoleculeVariety,
  hasDuplicateTier,
  toDisplayTier,
  createCombinationIdFromTiers,
  stripCombinationPrefix,
  generateTierCombinations,
  getTierClassification,
  toRomanNumeral,
  tierToColor,
  colorToCssString,
  applyAlphaToColor,
  getGreekTierInfo,
  Quadtree,
} from './tsadiTowerData.js';
import { TWO_PI, HALF_PI, getEffectiveDevicePixelRatio } from './shared/TowerUtils.js';
import { renderTsadiSimulation, renderTsadiBindingAgents, brightenColor as tsadiBrightenColor } from './tsadiTowerRenderer.js';
import {
  updateTsadiParticles as tsadiPhysicsUpdateParticles,
  applyTsadiRepellingForces as tsadiPhysicsApplyRepellingForces,
  handleTsadiCollisions as tsadiPhysicsHandleCollisions,
  handleTsadiFusion as tsadiPhysicsHandleFusion,
  createTsadiTierExplosion as tsadiPhysicsCreateTierExplosion,
  handleTsadiAlephAbsorption as tsadiPhysicsHandleAlephAbsorption,
  triggerTsadiAlephExplosion as tsadiPhysicsTriggerAlephExplosion,
  resetTsadiSimulation as tsadiPhysicsResetSimulation,
  resolveTsadiElasticCollision as tsadiPhysicsResolveElasticCollision,
} from './tsadiTowerPhysics.js';

// Sprite assets for the Tsadi spire particles and Waals binding agents.
const TSADI_PARTICLE_SPRITE_URL = new URL('../../../assets/sprites/spires/tsadiSpire/particle.png', import.meta.url).href;
// Sprite asset for Waals binding agents to match the new Tsadi spire art drop.
const TSADI_WAALS_SPRITE_URL = new URL('../../../assets/sprites/spires/tsadiSpire/waalsParticle.png', import.meta.url).href;

/**
 * ParticleFusionSimulation for the Tsadi Spire.
 * 
 * Simulates particles bouncing in 2D space with elastic collisions.
 * Equal-tier particles fuse into higher tiers, conserving momentum and mass.
 */
export class ParticleFusionSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    // Callbacks
    this.onTierChange = typeof options.onTierChange === 'function' ? options.onTierChange : null;
    this.onParticleCountChange = typeof options.onParticleCountChange === 'function' ? options.onParticleCountChange : null;
    this.onGlyphChange = typeof options.onGlyphChange === 'function' ? options.onGlyphChange : null;
    this.onReset = typeof options.onReset === 'function' ? options.onReset : null;
    this.samplePaletteGradient = typeof options.samplePaletteGradient === 'function'
      ? options.samplePaletteGradient
      : null;
    
    // Dimensions
    this.width = 0;
    this.height = 0;
    
    // Physics parameters
    this.gravity = 0; // No gravity for this simulation
    this.damping = 1.0; // No damping (elastic collisions)
    this.baseSpeed = 100; // Base speed in pixels per second
    this.baseRepellingForce = 1.0; // Base repelling force strength
    
    // Particle management
    this.particles = [];
    this.maxParticles = 100;
    this.spawnRate = 0; // Particles per second (starts at 0)
    this.spawnAccumulator = 0;
    this.nullParticleRadius = 5; // Reference size for null particle (recalculated on resize)
    
    // Glyph tracking
    this.highestTierReached = NULL_TIER; // Tracks the highest tier ever reached
    this.glyphCount = 0; // Number of Tsadi glyphs earned
    this.permanentGlyphs = []; // Permanent glowing glyphs in background

    // Upgrades
    this.upgrades = {
      repellingForceReduction: 0, // Number of times purchased
      startingTier: 0, // Number of times purchased (0 = spawn null particles)
      waveForce: 0, // Number of times the wave push upgrade has been purchased
    };

    // Fusion effects
    this.fusionEffects = []; // {x, y, radius, alpha, type: 'flash' | 'ring'}

    // Spawn effects (flash and wave)
    this.spawnEffects = []; // {x, y, radius, alpha, maxRadius, type: 'flash' | 'wave'}

    // Interactive wave effects (triggered by user clicks/taps)
    this.interactiveWaves = []; // {x, y, radius, alpha, maxRadius, force, type: 'wave'}

    // Store active force links so the renderer can visualize attractive/repulsive pairs.
    this.forceLinks = [];

    // Binding agent placement and molecule tracking.
    this.bindingAgents = []; // { id, x, y, vx, vy, connections: [{ particleId, tier, bondLength }], activeMolecules: string[] }
    this.bindingAgentPreview = null; // Pending placement ghost position
    this.availableBindingAgents = Number.isFinite(options.initialBindingAgents)
      ? Math.max(0, options.initialBindingAgents)
      : 0;
    this.bindingAgentRadius = 0;
    // Injected name resolver keeps molecule names randomized and unique.
    this.assignMoleculeName = typeof options.assignMoleculeName === 'function'
      ? options.assignMoleculeName
      : null;
    this.discoveredMolecules = new Set();
    this.discoveredMoleculeEntries = new Map();
    this.pendingMoleculeIds = new Set();
    this.advancedMoleculesUnlocked = false;
    this.seedDiscoveredMolecules(
      Array.isArray(options.initialDiscoveredMolecules) ? options.initialDiscoveredMolecules : [],
    );
    this.moleculeBonuses = { spawnRateBonus: 0, repellingShift: 0 };
    this.onBindingAgentStockChange = typeof options.onBindingAgentStockChange === 'function'
      ? options.onBindingAgentStockChange
      : null;
    this.onMoleculeDiscovered = typeof options.onMoleculeDiscovered === 'function'
      ? options.onMoleculeDiscovered
      : null;

    // Preserve particle counts when the Tsadi viewport is hidden so returning players see a gradual rebuild.
    this.storedTierCounts = null;
    // Queue staggered particle placement so rehydration happens one particle per frame.
    this.pendingPlacementQueue = [];
    // Gate new spawns while the reentry queue is being processed.
    this.placingStoredParticles = false;

    // Aleph particle state
    this.alephParticleId = null; // ID of the current aleph particle if it exists
    this.alephAbsorptionCount = 0; // Number of particles absorbed by aleph

    // Visual settings
    this.backgroundColor = '#0f1116'; // Dark background
    this.glowIntensity = 1.0;
    this.visualSettings = {
      graphicsLevel: 'high',
      renderForceLinks: true,
      renderFusionEffects: true,
      renderSpawnEffects: true,
      smoothRendering: true, // Enable subpixel rendering by default for smooth particle motion
    };
    // Cap the render resolution on high-DPI devices so the fusion viewport does not overdraw.
    this.maxDevicePixelRatio = Math.max(1, typeof options.maxDevicePixelRatio === 'number' ? options.maxDevicePixelRatio : 1.5);

    // Optional sprite overlays for Tsadi particles and binding agents.
    this.particleSprite = null;
    // Track readiness for the Tsadi particle sprite overlay.
    this.particleSpriteReady = false;
    // Optional Waals binding agent sprite overlay.
    this.bindingAgentSprite = null;
    // Track readiness for the Waals binding agent sprite overlay.
    this.bindingAgentSpriteReady = false;
    // Load sprite assets when the browser Image API is available.
    if (typeof Image !== 'undefined') {
      // Prepare the Tsadi particle sprite overlay.
      this.particleSprite = new Image();
      this.particleSprite.addEventListener('load', () => {
        // Flag the particle sprite as ready for render.
        this.particleSpriteReady = true;
      });
      this.particleSprite.src = TSADI_PARTICLE_SPRITE_URL;
      // Prepare the Waals binding agent sprite overlay.
      this.bindingAgentSprite = new Image();
      this.bindingAgentSprite.addEventListener('load', () => {
        // Flag the binding agent sprite as ready for render.
        this.bindingAgentSpriteReady = true;
      });
      this.bindingAgentSprite.src = TSADI_WAALS_SPRITE_URL;
    }

    // Track when the simulation needs to scatter particles after a collapsed resize.
    this.pendingScatterFromCollapse = false;
    
    // Animation state
    this.running = false;
    this.lastFrame = 0;
    this.loopHandle = null;
    
    // Quadtree for collision detection
    this.quadtree = null;
    
    // Initialize if canvas is provided
    if (this.canvas) {
      this.resize();
    }

    this.spawnInitialParticles();
  }
  
  /**
   * Resize the simulation to match canvas dimensions
   */
  resize() {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const dpr = this.getEffectiveDevicePixelRatio();

    const previousWidth = this.width;
    const previousHeight = this.height;
    const previouslyCollapsed =
      this.pendingScatterFromCollapse ||
      previousWidth <= COLLAPSED_DIMENSION_THRESHOLD ||
      previousHeight <= COLLAPSED_DIMENSION_THRESHOLD;

    // Cache CSS pixel size for consistent physics calculations.
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);

    if (this.ctx) {
      // Reset transform before applying DPR scaling to avoid cumulative scaling.
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
      
      // Apply smooth rendering settings after context reset
      this.applySmoothRenderingSettings();
    }

    if (this.width <= COLLAPSED_DIMENSION_THRESHOLD || this.height <= COLLAPSED_DIMENSION_THRESHOLD) {
      // Defer scattering until the canvas becomes visible again to avoid clustering at (0, 0).
      this.pendingScatterFromCollapse = true;
      return;
    }

    // Null particle radius is 80% of what alpha would be (which is 1/100 of width)
    const alphaRadius = this.width / 100;
    this.nullParticleRadius = alphaRadius * 0.8;
    this.bindingAgentRadius = this.nullParticleRadius * 0.7;

    // Recalculate radii for existing particles so they stay proportional after resize.
    for (const particle of this.particles) {
      particle.radius = this.getRadiusForTier(particle.tier);
    }

    if (previouslyCollapsed && this.particles.length > 0) {
      // Randomly reposition particles after the layout expands so they do not spawn in a stack.
      this.scatterParticlesRandomly();
      this.pendingScatterFromCollapse = false;
    }
  }

  /**
   * Determine a sane device pixel ratio for the fusion canvas to avoid runaway resolution.
   * @returns {number} Clamped DPR respecting the configured graphics preset
   */
  getEffectiveDevicePixelRatio() {
    return getEffectiveDevicePixelRatio(this.maxDevicePixelRatio);
  }

  /**
   * Scatter all active particles across the canvas using spawn-safe bounds.
   * Ensures the simulation looks natural after returning from a collapsed state.
   */
  scatterParticlesRandomly() {
    const marginWidth = this.width;
    const marginHeight = this.height;
    if (marginWidth <= COLLAPSED_DIMENSION_THRESHOLD || marginHeight <= COLLAPSED_DIMENSION_THRESHOLD) {
      // Skip scattering if the canvas is still effectively collapsed.
      this.pendingScatterFromCollapse = true;
      return;
    }

    for (const particle of this.particles) {
      const radius = this.getRadiusForTier(particle.tier);
      const margin = radius * 2;
      const spawnableWidth = Math.max(0, marginWidth - margin * 2);
      const spawnableHeight = Math.max(0, marginHeight - margin * 2);

      if (spawnableWidth <= 0 || spawnableHeight <= 0) {
        continue;
      }

      // Assign a new random position while preserving the particle's existing velocity.
      particle.x = margin + Math.random() * spawnableWidth;
      particle.y = margin + Math.random() * spawnableHeight;
    }
  }
  
  /**
   * Calculate radius for a given tier using 10% additive growth.
   * Null particle (tier -1) is the reference size.
   * Each tier above null is 10% larger than null.
   * Capital letters reset to alpha size + 10%.
   * Roman numerals start at a modest size and grow gradually.
   * @param {number} tier - The particle tier
   * @returns {number} Radius in pixels
   */
  getRadiusForTier(tier) {
    if (tier === NULL_TIER) {
      return this.nullParticleRadius;
    }
    
    const classification = getTierClassification(tier);
    
    // Aleph particle is 150% of null size
    if (classification.isAleph) {
      return this.nullParticleRadius * 1.5;
    }
    
    // Calculate base size depending on cycle
    let baseSize;
    if (classification.cycle === 0) {
      // Lowercase: null + 10% per tier
      baseSize = this.nullParticleRadius * (1 + 0.1 * (tier - NULL_TIER));
    } else if (classification.cycle === 1) {
      // Capital: alpha + 10% per capital tier
      const capitalTierIndex = classification.greekIndex;
      const alphaRadius = this.nullParticleRadius * 1.1; // Alpha is 10% larger than null
      baseSize = alphaRadius * (1 + 0.1 * capitalTierIndex);
    } else if (classification.isRoman) {
      // Roman numerals: start at alpha size + 5% per Roman tier
      const alphaRadius = this.nullParticleRadius * 1.1;
      baseSize = alphaRadius * (1 + 0.05 * (classification.romanIndex - 1));
    } else {
      // Fallback for any undefined tier types
      const alphaRadius = this.nullParticleRadius * 1.1;
      baseSize = alphaRadius * (1 + 0.1 * (tier - NULL_TIER));
    }
    
    return baseSize;
  }
  
  /**
   * Spawn initial particles to populate the simulation
   */
  spawnInitialParticles() {
    const initialCount = 10;
    for (let i = 0; i < initialCount; i++) {
      if (!this.spawnParticle()) {
        break;
      }
    }
  }

  /**
   * Calculate the current interactive wave stats based on upgrade level.
   *
   * Formula: baseValue × waveLevel where baseValue comes from the tuned constants
   * so level 0 yields zero radius/force and level 1 matches the legacy behavior.
   * @param {number} [waveLevel=this.upgrades.waveForce] - Purchased upgrade tier.
   * @returns {{force:number, radius:number, maxRadius:number}} Wave stat bundle.
   */
  getWaveStats(waveLevel = this.upgrades.waveForce) {
    const normalizedLevel = Math.max(0, waveLevel);
    if (normalizedLevel <= 0) {
      return { force: 0, radius: 0, maxRadius: 0 };
    }

    const radius = this.nullParticleRadius * WAVE_INITIAL_RADIUS_MULTIPLIER * normalizedLevel;
    const maxRadius = this.nullParticleRadius * WAVE_MAX_RADIUS_MULTIPLIER * normalizedLevel;
    const force = WAVE_INITIAL_FORCE * normalizedLevel;

    return { force, radius, maxRadius };
  }

  /**
   * Spawn a new particle with random position and velocity
   */
  spawnParticle(config = NULL_TIER) {
    if (this.particles.length >= this.maxParticles) return false;

    // Ensure valid dimensions before spawning to prevent particles spawning at origin
    if (!Number.isFinite(this.width) || this.width <= 0 || !Number.isFinite(this.height) || this.height <= 0) {
      return false;
    }

    let tier = NULL_TIER;
    let tierOffset = 0;
    let colorOverride = null;
    let shimmer = false;

    if (typeof config === 'number') {
      tier = config;
    } else if (config && typeof config === 'object') {
      if (Number.isFinite(config.tier)) {
        tier = config.tier;
      }
      if (Number.isFinite(config.tierOffset)) {
        tierOffset = config.tierOffset;
      }
      if (config.color) {
        colorOverride = colorToCssString(config.color);
      }
      shimmer = Boolean(config.shimmer);
    }

    // Apply starting tier upgrade and any gem-driven offsets.
    const effectiveTier = tier + tierOffset + this.upgrades.startingTier;
    
    const radius = this.getRadiusForTier(effectiveTier);
    const tierInfo = getGreekTierInfo(effectiveTier);

    // Random position with margin from edges
    const margin = radius * 2;
    const spawnableWidth = this.width - margin * 2;
    const spawnableHeight = this.height - margin * 2;
    
    // Ensure spawnable area is valid
    if (spawnableWidth <= 0 || spawnableHeight <= 0) {
      return false;
    }
    
    const x = margin + Math.random() * spawnableWidth;
    const y = margin + Math.random() * spawnableHeight;
    
    // Calculate speed with 10% reduction per tier above null
    const tierAboveNull = effectiveTier - NULL_TIER;
    const speedMultiplier = Math.max(0.1, 1 - (0.1 * tierAboveNull)); // Cap at 10% min speed
    const speed = (this.baseSpeed * speedMultiplier) * (0.5 + Math.random() * 0.5);
    const angle = Math.random() * Math.PI * 2;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    
    // Calculate repelling force (100% increase per tier)
    const baseRepelling = this.baseRepellingForce;
    const repellingReduction = this.upgrades.repellingForceReduction * 0.5; // 50% per upgrade
    const repellingMultiplier = tierAboveNull - repellingReduction;
    const repellingForce = baseRepelling * repellingMultiplier;
    
    this.particles.push({
      x,
      y,
      vx,
      vy,
      radius,
      tier: effectiveTier,
      color: colorOverride || tierToColor(effectiveTier, this.samplePaletteGradient),
      label: tierInfo.letter,
      id: Math.random(), // Unique ID for tracking
      repellingForce,
      speedMultiplier,
      shimmer,
      shimmerPhase: Math.random() * Math.PI * 2, // Offset shimmer so stacked particles do not pulse in sync.
      shimmerColor: colorOverride || null,
    });
    
    // Add spawn flash and wave effects when the options menu allows it.
    if (this.visualSettings.renderSpawnEffects) {
      this.spawnEffects.push(
        { x, y, radius: radius * 2, alpha: 1, maxRadius: radius * 2, type: 'flash' },
        { x, y, radius: radius, alpha: 1, maxRadius: radius * 4, type: 'wave' },
      );
    }

    if (this.onParticleCountChange) {
      this.onParticleCountChange(this.particles.length);
    }
    return true;
  }
  
  /**
   * Spawn multiple particles at once
   * @param {number} count - Number of particles to spawn
   * @returns {number} Number of particles successfully spawned
   */
  spawnMultipleParticles(particleCount) {
    let spawned = 0;
    for (let i = 0; i < particleCount; i++) {
      if (this.spawnParticle()) {
        spawned++;
      } else {
        break;
      }
    }
    return spawned;
  }
  
  /**
   * Create an interactive wave force at the specified position.
   * Pushes particles away from the click/tap point with a visual wave effect.
   * NOTE: This method is deprecated - waves now require hold + swipe gestures.
   * Use createDirectionalWave instead.
   * @param {number} x - X coordinate in canvas space
   * @param {number} y - Y coordinate in canvas space
   */
  createInteractiveWave(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }

    const waveStats = this.getWaveStats();
    if (waveStats.force <= 0 || waveStats.radius <= 0) {
      return;
    }

    // Create visual wave effect (circular - deprecated)
    this.interactiveWaves.push({
      x,
      y,
      radius: waveStats.radius,
      alpha: 1,
      maxRadius: waveStats.maxRadius,
      force: waveStats.force,
      type: 'wave',
      direction: null, // Null means omnidirectional (circular)
      coneAngle: Math.PI * 2, // Full circle
    });
  }
  
  /**
   * Create a directional wave force (cone) from a hold + swipe gesture.
   * Pushes particles in a 90-degree cone in the specified direction.
   * @param {number} x - X coordinate in canvas space (wave origin)
   * @param {number} y - Y coordinate in canvas space (wave origin)
   * @param {number} direction - Direction in radians (0 = right, Math.PI/2 = down)
   */
  createDirectionalWave(x, y, direction) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(direction)) {
      return;
    }

    const waveStats = this.getWaveStats();
    if (waveStats.force <= 0 || waveStats.radius <= 0) {
      return;
    }

    // Create directional wave effect (90-degree cone)
    this.interactiveWaves.push({
      x,
      y,
      radius: waveStats.radius,
      alpha: 1,
      maxRadius: waveStats.maxRadius,
      force: waveStats.force,
      type: 'wave',
      direction, // Direction in radians
      coneAngle: Math.PI / 2, // 90 degrees
    });
  }

  /**
   * Apply rendering preferences from the Tsadi spire options menu.
   * @param {Object} options - Visual settings (graphicsLevel, renderForceLinks, renderFusionEffects, renderSpawnEffects).
   */
  setVisualSettings(options = {}) {
    this.visualSettings = { ...this.visualSettings, ...options };

    switch (this.visualSettings.graphicsLevel) {
      case 'low':
        this.maxParticles = 70;
        this.glowIntensity = 0.75;
        this.maxDevicePixelRatio = 1.1;
        break;
      case 'medium':
        this.maxParticles = 90;
        this.glowIntensity = 0.9;
        this.maxDevicePixelRatio = 1.35;
        break;
      default:
        this.maxParticles = 100;
        this.glowIntensity = 1.0;
        this.maxDevicePixelRatio = 1.5;
        break;
    }

    // Apply resolution cap changes immediately so the canvas resizes to the new target.
    this.resize();

    if (!this.visualSettings.renderFusionEffects) {
      this.fusionEffects.length = 0;
    }
    if (!this.visualSettings.renderSpawnEffects) {
      this.spawnEffects.length = 0;
    }
    if (!this.visualSettings.renderForceLinks) {
      this.forceLinks.length = 0;
    }
    
    // Apply smooth rendering settings to canvas context if available
    this.applySmoothRenderingSettings();
  }
  
  /**
   * Apply smooth rendering settings to the canvas context.
   * Enables subpixel rendering when smooth mode is active.
   */
  applySmoothRenderingSettings() {
    if (!this.ctx) {
      return;
    }
    
    // Enable image smoothing for antialiased subpixel rendering in smooth mode
    // Default to true if smoothRendering is undefined
    const smoothingEnabled = this.visualSettings.smoothRendering !== false;
    this.ctx.imageSmoothingEnabled = smoothingEnabled;
    
    // Set the quality of image smoothing to high for best subpixel results
    // Note: imageSmoothingQuality is not supported in older browsers (IE, older Safari versions)
    if (smoothingEnabled && this.ctx.imageSmoothingQuality) {
      this.ctx.imageSmoothingQuality = 'high';
    }
  }
  
  /**
   * Update physics for all particles
   */
  updateParticles(deltaTime) { return tsadiPhysicsUpdateParticles.call(this, deltaTime); }
  
  /**
   * Apply repelling or attracting forces between particles based on their tier
   */
  applyRepellingForces(dt, bodies = this.particles) { return tsadiPhysicsApplyRepellingForces.call(this, dt, bodies); }

  /**
   * Retrieve the visual radius used for binding agent placement hit-testing.
   * @returns {number} Binding agent display radius in CSS pixels.
   */
  getBindingAgentRadius() {
    return this.bindingAgentRadius || this.nullParticleRadius * 0.7;
  }

  /**
   * Estimate a binding agent's mass using its display radius as an inertia proxy.
   * @returns {number} Positive mass-like scalar.
   */
  getBindingAgentMass() {
    const radius = this.getBindingAgentRadius();
    return Math.max(1, radius * radius);
  }

  /**
   * Determine the maximum tether reach and minimum rod length for binding agents.
   *
   * Range and rod length scale with the render width so bonds stay visually legible on any viewport size.
   * @returns {number} Rod range in CSS pixels.
   */
  getBindingRodRange() {
    return Math.max(0, this.width) / 50;
  }

  /**
   * Get the available binding agent stock.
   * @returns {number} Non-negative binding agent reserve.
   */
  getAvailableBindingAgents() {
    return this.availableBindingAgents;
  }

  /**
   * Set the available binding agent stock and notify listeners.
   * @param {number} amount - Desired stock value.
   */
  setAvailableBindingAgents(amount) {
    const normalized = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    if (normalized === this.availableBindingAgents) {
      return;
    }
    this.availableBindingAgents = normalized;
    if (this.onBindingAgentStockChange) {
      this.onBindingAgentStockChange(normalized);
    }
  }

  /**
   * Increment the binding agent reserve by a positive or negative delta.
   * @param {number} amount - Amount to add to the stockpile.
   */
  addBindingAgents(amount) {
    if (!Number.isFinite(amount) || amount === 0) {
      return;
    }
    this.setAvailableBindingAgents(this.availableBindingAgents + amount);
  }

  /**
   * Update the pending placement preview to mirror pointer movement.
   * @param {{x:number, y:number}|null} position - Canvas-space coordinates.
   */
  setBindingAgentPreview(position) {
    if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
      this.bindingAgentPreview = { x: position.x, y: position.y };
    } else {
      this.bindingAgentPreview = null;
    }
  }

  /**
   * Clear any pending preview once placement succeeds or is cancelled.
   */
  clearBindingAgentPreview() {
    this.bindingAgentPreview = null;
  }

  /**
   * Attempt to place a binding agent at the provided coordinates.
   * Placement fails if stock is empty or overlaps an existing molecule anchor.
   * @param {{x:number, y:number}} position - Canvas-space coordinates.
   * @returns {boolean} Whether the binding agent was placed.
   */
  placeBindingAgent(position) {
    if (!position || this.availableBindingAgents < 1) {
      return false;
    }

    const radius = this.getBindingAgentRadius();
    const overlapsExisting = this.bindingAgents.some((agent) => {
      const dx = agent.x - position.x;
      const dy = agent.y - position.y;
      const minDistance = radius * 2;
      return (dx * dx + dy * dy) < (minDistance * minDistance);
    });

    if (overlapsExisting) {
      return false;
    }

    this.bindingAgents.push({
      id: Math.random(),
      x: position.x,
      y: position.y,
      vx: 0,
      vy: 0,
      connections: [],
      activeMolecules: [],
      pendingDiscoveries: [],
      awaitingCodexTap: false,
      popTimer: 0,
    });

    this.addBindingAgents(-1);
    this.clearBindingAgentPreview();
    return true;
  }

  /**
   * Find the nearest binding agent anchor to a point within the interaction radius.
   * @param {{x:number, y:number}} position - Canvas coordinates.
   * @param {number} tolerance - Extra padding to widen the selection ring.
   * @returns {Object|null} Matching binding agent or null when none is close enough.
   */
  findBindingAgentNear(position, tolerance = 0) {
    const radius = this.getBindingAgentRadius() + tolerance;
    for (const agent of this.bindingAgents) {
      const dx = agent.x - position.x;
      const dy = agent.y - position.y;
      if ((dx * dx + dy * dy) <= radius * radius) {
        return agent;
      }
    }
    return null;
  }

  /**
   * Disband and remove a placed binding agent, refunding its stock.
   * @param {{x:number, y:number}} position - Canvas coordinates used for hit-testing.
   * @returns {boolean} Whether an agent was removed.
   */
  disbandBindingAgentAt(position) {
    if (!position) {
      return false;
    }
    const target = this.findBindingAgentNear(position, 2);
    if (!target) {
      return false;
    }
    if (target.awaitingCodexTap) {
      return false; // Prevent dismantling while a discovery is pending collection.
    }

    this.bindingAgents = this.bindingAgents.filter((agent) => agent.id !== target.id);
    this.addBindingAgents(1);
    this.recalculateMoleculeBonuses();
    return true;
  }

  /**
   * Normalize a persisted or newly discovered molecule descriptor and apply naming.
   * @param {Object|string} recipe - Molecule recipe payload or identifier.
   * @returns {Object|null} Descriptor containing id, name, tiers, description, and bonus.
   */
  normalizeMoleculeDescriptor(recipe) {
    if (!recipe) {
      return null;
    }
    const resolvedId = typeof recipe === 'string' ? recipe : recipe.id || recipe.name;
    const legacyRecipe = LEGACY_MOLECULE_RECIPES.find((entry) => entry.id === resolvedId) || null;
    const merged = typeof recipe === 'object' ? { ...(legacyRecipe || {}), ...recipe } : (legacyRecipe || { id: resolvedId });

    // For loading persisted molecules, preserve tiers as provided (may include duplicates)
    // But for legacy recipes, use normalizeTierList for backward compatibility
    const rawTiers = Array.isArray(merged.tiers) ? merged.tiers : legacyRecipe?.tiers || [];
    // Legacy recipes: from LEGACY_MOLECULE_RECIPES when recipe is a string or has no tiers property
    const isLegacy = Boolean(legacyRecipe && (typeof recipe === 'string' || !recipe.tiers));
    const tiers = isLegacy ? normalizeTierList(rawTiers) : sortTierListWithDuplicates(rawTiers);
    const particleCount = tiers.length;
    // Legacy recipes use old behavior (no duplicates), new recipes allow duplicates
    const generatedId = createCombinationIdFromTiers(tiers, !isLegacy);
    let id = merged.id || merged.name || generatedId || resolvedId || 'molecule';
    if (/^combo-/i.test(id) && generatedId) {
      id = generatedId;
    }
    const tierSequenceLabel = tiers.length ? tiers.map((tier) => toDisplayTier(tier)).join('-') : id;
    const baseName = typeof merged.name === 'string' && merged.name ? merged.name : (legacyRecipe?.name || id);
    const cleanedName = stripCombinationPrefix(baseName) || tierSequenceLabel;
    const description = typeof merged.description === 'string'
      ? merged.description
      : legacyRecipe?.description || 'Recorded in the Alchemy Codex.';
    const descriptor = {
      ...merged,
      id,
      name: cleanedName,
      tiers,
      description,
      particleCount,
      bonus: merged.bonus || legacyRecipe?.bonus || {},
    };

    if (this.assignMoleculeName) {
      const namedDescriptor = this.assignMoleculeName(descriptor);
      if (namedDescriptor) {
        return { ...descriptor, ...namedDescriptor };
      }
    }

    return descriptor;
  }

  /**
   * Seed discovered molecule registries from persisted payloads.
   * @param {Array} entries - Stored molecule entries.
   */
  seedDiscoveredMolecules(entries) {
    if (!Array.isArray(entries)) {
      return;
    }
    entries.forEach((entry) => {
      const descriptor = this.normalizeMoleculeDescriptor(entry);
      if (descriptor) {
        this.discoveredMolecules.add(descriptor.id);
        this.discoveredMoleculeEntries.set(descriptor.id, descriptor);
      }
    });
  }

  /**
   * Record a newly completed molecule and return the enriched descriptor.
   * @param {Object} recipe - Molecule recipe that just completed.
   * @returns {Object|null} Descriptor saved to the discovery ledger.
   */
  recordDiscoveredMolecule(recipe) {
    const descriptor = this.normalizeMoleculeDescriptor(recipe);
    if (!descriptor || (descriptor.particleCount || 0) < 2) {
      return null;
    }
    this.discoveredMolecules.add(descriptor.id);
    this.discoveredMoleculeEntries.set(descriptor.id, descriptor);
    return descriptor;
  }

  finalizeMoleculeDiscovery(descriptor) {
    if (!descriptor) {
      return false;
    }
    const recorded = this.recordDiscoveredMolecule(descriptor);
    if (recorded && this.onMoleculeDiscovered) {
      this.onMoleculeDiscovered(recorded);
    }
    return Boolean(recorded);
  }

  queuePendingMolecule(agent, descriptor) {
    if (!agent || !descriptor) {
      return;
    }
    agent.pendingDiscoveries = Array.isArray(agent.pendingDiscoveries) ? agent.pendingDiscoveries : [];
    agent.pendingDiscoveries.push(descriptor);
    agent.awaitingCodexTap = true;
    agent.popTimer = Math.max(agent.popTimer || 0, 0.6);
    this.pendingMoleculeIds.add(descriptor.id);
  }

  processPendingMolecules(agent) {
    if (!agent || !Array.isArray(agent.pendingDiscoveries) || !agent.pendingDiscoveries.length) {
      return false;
    }
    let discoveredNew = false;
    while (agent.pendingDiscoveries.length) {
      const descriptor = agent.pendingDiscoveries.shift();
      if (!descriptor) {
        continue;
      }
      this.pendingMoleculeIds.delete(descriptor.id);
      if (this.finalizeMoleculeDiscovery(descriptor)) {
        discoveredNew = true;
      }
    }
    agent.pendingDiscoveries = [];
    agent.awaitingCodexTap = false;
    // Trigger explosion effect when manually collecting new discoveries
    this.popBindingAgent(agent, discoveredNew);
    return discoveredNew;
  }

  collectPendingMoleculesAt(position) {
    if (!position) {
      return false;
    }
    const agent = this.findBindingAgentNear(position, 2);
    if (!agent || !agent.awaitingCodexTap) {
      return false;
    }
    return this.processPendingMolecules(agent);
  }

  flushPendingMolecules() {
    for (const agent of this.bindingAgents) {
      if (agent?.pendingDiscoveries?.length) {
        this.processPendingMolecules(agent);
      }
    }
  }

  /**
   * Check whether advanced molecule rules are unlocked via particle progression.
   * Advanced molecules allow duplicate particle tiers bound through layered Waals anchors.
   * @returns {boolean} True once the advanced molecule unlock tier is reached.
   */
  areAdvancedMoleculesUnlocked() {
    if (!this.advancedMoleculesUnlocked && this.highestTierReached >= ADVANCED_MOLECULE_UNLOCK_TIER) {
      this.advancedMoleculesUnlocked = true;
    }
    return this.advancedMoleculesUnlocked;
  }

  /**
   * Create a normalized descriptor for a freeform molecule combination.
   * Now supports duplicate tiers to allow molecules like [alpha, beta, alpha].
   * @param {Array<number>} tiers - Tier list (may contain duplicates).
   * @returns {Object|null} Molecule descriptor with id and particle count.
   */
  createCombinationDescriptor(tiers = []) {
    const sorted = sortTierListWithDuplicates(tiers);
    if (sorted.length < 2) {
      return null;
    }
    const id = createCombinationIdFromTiers(sorted, true);
    if (!id) {
      // Invalid molecule (e.g., insufficient particles or lacks variety)
      return null;
    }
    return this.normalizeMoleculeDescriptor({
      id,
      tiers: sorted,
      particleCount: sorted.length,
    });
  }

  /**
   * Recompute global molecule bonuses from all active bindings.
   */
  recalculateMoleculeBonuses() {
    const nextBonuses = { spawnRateBonus: 0, repellingShift: 0 };
    for (const agent of this.bindingAgents) {
      for (const moleculeId of agent.activeMolecules || []) {
        const recipe = this.discoveredMoleculeEntries.get(moleculeId);
        if (!recipe || !recipe.bonus) {
          continue;
        }
        if (Number.isFinite(recipe.bonus.spawnRateBonus)) {
          nextBonuses.spawnRateBonus += recipe.bonus.spawnRateBonus;
        }
        if (Number.isFinite(recipe.bonus.repellingShift)) {
          nextBonuses.repellingShift += recipe.bonus.repellingShift;
        }
      }
    }
    this.moleculeBonuses = nextBonuses;
  }

  /**
   * Release all bonds on a binding agent after a successful discovery.
   * @param {Object} agent - Binding agent whose connections should be cleared.
   * @param {boolean} withExplosion - Whether to create an explosion effect and remove the agent.
   */
  popBindingAgent(agent, withExplosion = false) {
    if (!agent) {
      return;
    }
    const particleMap = new Map(this.particles.map((particle) => [particle.id, particle]));
    
    if (withExplosion) {
      // Create explosion effect at the binding agent's location
      const explosionRadius = this.getBindingAgentRadius() * 4;
      if (this.visualSettings.renderFusionEffects) {
        this.fusionEffects.push(
          { x: agent.x, y: agent.y, radius: explosionRadius, alpha: 1, type: 'flash' },
          { x: agent.x, y: agent.y, radius: explosionRadius * 0.7, alpha: 0.8, type: 'ring' },
        );
      }
      
      // Free particles with stronger outward momentum
      agent.connections.forEach((connection) => {
        const particle = particleMap.get(connection.particleId);
        if (particle) {
          const dx = particle.x - agent.x;
          const dy = particle.y - agent.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = dx / dist;
          const ny = dy / dist;
          // Push particles outward from the explosion center
          particle.vx += nx * 0.8;
          particle.vy += ny * 0.8;
        }
      });
      
      // Remove the binding agent from the simulation
      if (agent.id !== null && agent.id !== undefined) {
        const agentIndex = this.bindingAgents.findIndex((a) => a.id === agent.id);
        if (agentIndex !== -1) {
          this.bindingAgents.splice(agentIndex, 1);
        }
      }
      // Don't refund the agent when it explodes with a discovery
    } else {
      // Standard pop without explosion - just release particles gently
      agent.connections.forEach((connection) => {
        const particle = particleMap.get(connection.particleId);
        if (particle) {
          // Nudge attached particles apart so the release is visible.
          particle.vx += (Math.random() - 0.5) * 0.4;
          particle.vy += (Math.random() - 0.5) * 0.4;
        }
      });
      agent.connections = [];
      agent.activeMolecules = [];
      agent.pendingDiscoveries = [];
      agent.awaitingCodexTap = false;
      agent.popTimer = Math.max(agent.popTimer || 0, 0.6);
    }
  }

  /**
   * Randomly connect binding agents to nearby particles with non-positive repelling force
   * and resolve molecule formation state.
   * @param {number} dt - Delta time in seconds.
   */
  updateBindingAgents(dt) {
    if (!this.bindingAgents.length) {
      this.moleculeBonuses = { spawnRateBonus: 0, repellingShift: 0 };
      return;
    }

    const bindingRadius = this.getBindingAgentRadius();
    const bindingMass = this.getBindingAgentMass();
    const bindingRepellingForce = this.baseRepellingForce * 0.5;
    const connectionRange = this.getBindingRodRange(); // Bond reach tied to viewport width.
    const minimumBondLength = connectionRange; // Rods stretch to at least this length when tethered.

    const particleMap = new Map();
    for (const particle of this.particles) {
      particleMap.set(particle.id, particle);
    }

    for (const agent of this.bindingAgents) {
      agent.radius = bindingRadius;
      agent.repellingForce = bindingRepellingForce;

      if (agent.awaitingCodexTap) {
        continue;
      }

      // Remove stale or now-repulsive connections.
      agent.connections = agent.connections.filter((connection) => {
        const target = particleMap.get(connection.particleId);
        if (!target || target.tier <= NULL_TIER) {
          return false;
        }

        // Preserve the latest distance so the render step can draw a taut bond to moving particles.
        connection.bondLength = Math.max(
          minimumBondLength,
          Math.hypot(target.x - agent.x, target.y - agent.y),
        );
        return true;
      });

      const connectedIds = new Set(agent.connections.map((connection) => connection.particleId));

      const nearbyBodies = this.quadtree ? this.quadtree.retrieve(agent) : this.particles;

      // If a Waals particle bumps into an eligible target, immediately stabilize it with a bond
      // and resolve the overlap so the contact is visible instead of passing through.
      for (const target of nearbyBodies) {
        if (target.id === agent.id) continue;
        if (target.isBindingAgent) continue;
        const isNullParticle = target.tier <= NULL_TIER;

        const dx = target.x - agent.x;
        const dy = target.y - agent.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDistance = bindingRadius + target.radius;

        if (distance <= Math.max(connectionRange, minDistance)) {
          // Null particles cannot form bonds, but still collide to keep the chamber physical.
          // Allow duplicate tiers - only check that we haven't already connected this specific particle
          if (!isNullParticle && !connectedIds.has(target.id)) {
            const bondLength = Math.max(
              minimumBondLength,
              minDistance,
              Math.hypot(target.x - agent.x, target.y - agent.y),
            );
            agent.connections.push({
              particleId: target.id,
              tier: target.tier,
              bondLength,
            });
            connectedIds.add(target.id);
          }
        }
      }

      // Stochastically attempt one new connection per frame to keep molecule creation organic.
      const shouldAttemptBond = Math.random() < Math.min(0.6, dt * 3);
      if (shouldAttemptBond) {
        const eligibleCandidates = nearbyBodies.filter((particle) => {
          if (particle.id === agent.id) return false;
          if (particle.isBindingAgent) return false;
          if (particle.tier <= NULL_TIER) return false;
          // Allow duplicate tiers - only check that we haven't already connected this specific particle
          if (connectedIds.has(particle.id)) return false;

          const dx = particle.x - agent.x;
          const dy = particle.y - agent.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDistance = Math.max(connectionRange, particle.radius + this.getBindingAgentRadius());
          return distance <= maxDistance;
        });

        if (eligibleCandidates.length) {
          const target = eligibleCandidates[Math.floor(Math.random() * eligibleCandidates.length)];
          const bondLength = Math.max(
            minimumBondLength,
            Math.hypot(target.x - agent.x, target.y - agent.y),
          );
          agent.connections.push({
            particleId: target.id,
            tier: target.tier,
            bondLength,
          });
        }
      }

      // Resolve molecule completion and discovery based on tier combinations.
      // Preserve duplicate tiers only when advanced molecules have been unlocked.
      const advancedMoleculesUnlocked = this.areAdvancedMoleculesUnlocked();
      const tiersPresent = advancedMoleculesUnlocked
        ? sortTierListWithDuplicates(agent.connections.map((connection) => connection.tier))
        : normalizeTierList(agent.connections.map((connection) => connection.tier));
      const combinations = tiersPresent.length >= 2 ? generateTierCombinations(tiersPresent) : [];
      agent.activeMolecules = [];
      let discoveredNewMolecule = false;
      let queuedManualDiscovery = false;
      for (const combo of combinations) {
        const descriptor = this.createCombinationDescriptor(combo);
        if (!descriptor) {
          continue;
        }
        const isAdvancedCombo = hasDuplicateTier(descriptor.tiers);
        if (isAdvancedCombo && !advancedMoleculesUnlocked) {
          continue;
        }
        agent.activeMolecules.push(descriptor.id);
        const alreadyRecorded = this.discoveredMolecules.has(descriptor.id);
        const pendingRecording = this.pendingMoleculeIds.has(descriptor.id);
        if (alreadyRecorded || pendingRecording) {
          continue;
        }
        this.queuePendingMolecule(agent, descriptor);
        discoveredNewMolecule = true;
        queuedManualDiscovery = true;
      }

      // Immediately process queued discoveries so the explosion, knockback, and codex entry
      // happen without requiring a manual tap even before advanced molecules unlock.
      if (queuedManualDiscovery) {
        const processed = this.processPendingMolecules(agent);
        if (processed) {
          // Agent is removed during processing, so skip further constraint handling.
          continue;
        }
      }
      // Constrain connected particles to move as if joined by rigid, weightless rods.
      for (const connection of agent.connections) {
        const target = particleMap.get(connection.particleId);
        if (!target) continue;

        const dx = target.x - agent.x;
        const dy = target.y - agent.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const desiredLength = Math.max(minimumBondLength, connection.bondLength || distance);
        connection.bondLength = desiredLength;

        const nx = dx / distance;
        const ny = dy / distance;

        const targetMass = target.radius * target.radius;
        const totalMass = bindingMass + targetMass;

        // Position correction splits the error proportionally to each body's inertia proxy.
        const separation = distance - desiredLength;
        const agentShift = (separation * targetMass) / totalMass;
        const targetShift = (separation * bindingMass) / totalMass;
        agent.x += nx * agentShift;
        agent.y += ny * agentShift;
        target.x -= nx * targetShift;
        target.y -= ny * targetShift;

        // Velocity correction removes relative motion along the rod so both bodies travel together.
        const relativeSpeed = (agent.vx - target.vx) * nx + (agent.vy - target.vy) * ny;
        const impulse = relativeSpeed;
        agent.vx -= (impulse * nx * targetMass) / totalMass;
        agent.vy -= (impulse * ny * targetMass) / totalMass;
        target.vx += (impulse * nx * bindingMass) / totalMass;
        target.vy += (impulse * ny * bindingMass) / totalMass;
      }
    }

    this.recalculateMoleculeBonuses();
  }

  /**
   * Retrieve metadata for discovered molecules for UI surfaces.
   * @returns {Array} Array of molecule recipe objects that have been discovered.
   */
  getDiscoveredMolecules() {
    const entries = [];
    for (const id of this.discoveredMolecules) {
      const descriptor = this.discoveredMoleculeEntries.get(id)
        || this.normalizeMoleculeDescriptor(id);
      if (descriptor) {
        entries.push(descriptor);
      }
    }
    return entries;
  }



  /**
   * Handle particle-particle collisions and fusion with tier progression
   */
  handleCollisions(bodies = this.particles) { return tsadiPhysicsHandleCollisions.call(this, bodies); }
  
  /**
   * Handle fusion between two particles of the same tier
   */
  handleFusion(p1, p2, particlesToRemove, particlesToAdd) { return tsadiPhysicsHandleFusion.call(this, p1, p2, particlesToRemove, particlesToAdd); }
  
  /**
   * Create an explosion when omega tiers merge, spawning next tier particles
   */
  createTierExplosion(p1, p2, particlesToRemove, particlesToAdd) { return tsadiPhysicsCreateTierExplosion.call(this, p1, p2, particlesToRemove, particlesToAdd); }
  
  /**
   * Handle aleph particle absorbing other particles
   */
  handleAlephAbsorption(alephParticle, particlesToRemove) { return tsadiPhysicsHandleAlephAbsorption.call(this, alephParticle, particlesToRemove); }
  
  /**
   * Trigger the final aleph explosion, awarding glyphs and resetting
   */
  triggerAlephExplosion(alephParticle, particlesToRemove) { return tsadiPhysicsTriggerAlephExplosion.call(this, alephParticle, particlesToRemove); }
  
  /**
   * Reset the simulation while maintaining glyph count
   */
  resetSimulation() { return tsadiPhysicsResetSimulation.call(this); }
  
  /**
   * Resolve elastic collision between two particles
   */
  resolveElasticCollision(p1, p2) { return tsadiPhysicsResolveElasticCollision.call(this, p1, p2); }
  
  /**
   * Render the simulation
   */
  render() { return renderTsadiSimulation.call(this); }

  /**
   * Check if a binding agent has a valid combination (at least 2 different tier particles).
   * @param {Object} agent - The binding agent to check.
   * @returns {boolean} True if the agent has a valid combination.
   */
  hasValidCombination(agent) {
    if (!agent || !Array.isArray(agent.connections)) {
      return false;
    }
    const uniqueTiers = new Set(
      agent.connections
        .filter((connection) => connection && Number.isFinite(connection.tier))
        .map((connection) => connection.tier)
    );
    return uniqueTiers.size >= 2;
  }

  /**
   * Render binding agent anchors, their connections, and any placement preview.
   * @param {CanvasRenderingContext2D} ctx - Active 2D context.
   */
  renderBindingAgents(ctx) { return renderTsadiBindingAgents.call(this, ctx); }

  /**
   * Brighten a color for enhanced glow effects
   */
  brightenColor(colorStr, intensity) { return tsadiBrightenColor.call(this, colorStr, intensity); }
  
  /**
   * Animation loop
   */
  loop(timestamp) {
    if (!this.running) return;
    
    const deltaTime = this.lastFrame ? timestamp - this.lastFrame : 16;
    this.lastFrame = timestamp;
    
    this.updateParticles(Math.min(deltaTime, 100)); // Cap delta at 100ms
    this.render();
    
    this.loopHandle = requestAnimationFrame((t) => this.loop(t));
  }
  
  /**
   * Start the simulation
   */
  start() {
    if (this.running) return;
    
    this.running = true;
    this.lastFrame = 0;
    this.loopHandle = requestAnimationFrame((t) => this.loop(t));
  }
  
  /**
   * Stop the simulation
   */
  stop() {
    this.running = false;
    if (this.loopHandle !== null) {
      cancelAnimationFrame(this.loopHandle);
      this.loopHandle = null;
    }
  }
  
  /**
   * Get particle count by tier
   */
  getParticleCountByTier() {
    const counts = {};
    for (const particle of this.particles) {
      counts[particle.tier] = (counts[particle.tier] || 0) + 1;
    }
    return counts;
  }
  
  /**
   * Purchase repelling force reduction upgrade
   * @returns {boolean} True if purchase was successful
   */
  purchaseRepellingForceReduction() {
    this.upgrades.repellingForceReduction++;
    
    // Update repelling force for all existing particles
    for (const particle of this.particles) {
      const tierAboveNull = particle.tier - NULL_TIER;
      const repellingReduction = this.upgrades.repellingForceReduction * 0.5;
      const repellingMultiplier = tierAboveNull - repellingReduction;
      particle.repellingForce = this.baseRepellingForce * repellingMultiplier;
    }
    
    return true;
  }
  
  /**
   * Get cost of next repelling force reduction upgrade
   */
  getRepellingForceReductionCost() {
    return 3 * Math.pow(2, this.upgrades.repellingForceReduction);
  }

  /**
   * Purchase interactive wave strength upgrade so clicks/taps apply meaningful force.
   * @returns {boolean} True if purchase was successful
   */
  purchaseWaveForceUpgrade() {
    this.upgrades.waveForce += 1;
    return true;
  }

  /**
   * Get cost of next wave force upgrade (1, 10, 100, ...)
   * @returns {number} Particle cost for the next tier
   */
  getWaveForceUpgradeCost() {
    return Math.pow(10, this.upgrades.waveForce);
  }

  /**
   * Purchase starting tier upgrade
   * @returns {boolean} True if purchase was successful
   */
  purchaseStartingTierUpgrade() {
    this.upgrades.startingTier++;
    
    return true;
  }
  
  /**
   * Get cost of next starting tier upgrade
   */
  getStartingTierUpgradeCost() {
    return 5 * Math.pow(2, this.upgrades.startingTier);
  }

  /**
   * Get upgrade information
   */
  getUpgradeInfo() {
    const currentWaveStats = this.getWaveStats();

    return {
      repellingForceReduction: {
        level: this.upgrades.repellingForceReduction,
        cost: this.getRepellingForceReductionCost(),
        effect: `${this.upgrades.repellingForceReduction * 50}% force reduction`,
        canAfford: true,
      },
      waveForce: {
        level: this.upgrades.waveForce,
        cost: this.getWaveForceUpgradeCost(),
        effect: currentWaveStats.force > 0
          ? `Push radius ~${Math.round(currentWaveStats.maxRadius)}px, peak force ${Math.round(currentWaveStats.force)}`
          : 'Wave of force is inactive until upgraded.',
        canAfford: true,
      },
      startingTier: {
        level: this.upgrades.startingTier,
        cost: this.getStartingTierUpgradeCost(),
        effect: this.upgrades.startingTier > 0
          ? `Spawn ${getGreekTierInfo(NULL_TIER + this.upgrades.startingTier).name} particles`
          : 'Spawn Null particles',
        canAfford: true,
      },
    };
  }
  
  /**
   * Export simulation state for save/load
   */
  exportState() {
    return {
      particles: this.particles.map((p) => ({
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        tier: p.tier,
        id: p.id,
      })),
      highestTierReached: this.highestTierReached,
      glyphCount: this.glyphCount,
      bindingAgentBank: this.availableBindingAgents,
      bindingAgents: this.bindingAgents.map((agent) => ({
        id: agent.id,
        x: agent.x,
        y: agent.y,
        vx: agent.vx,
        vy: agent.vy,
        connections: Array.isArray(agent.connections) ? agent.connections : [],
        activeMolecules: Array.isArray(agent.activeMolecules) ? agent.activeMolecules : [],
        pendingDiscoveries: Array.isArray(agent.pendingDiscoveries) ? agent.pendingDiscoveries : [],
        awaitingCodexTap: Boolean(agent.awaitingCodexTap),
        popTimer: Number.isFinite(agent.popTimer) ? agent.popTimer : 0,
      })),
      discoveredMolecules: Array.from(this.discoveredMoleculeEntries.values()),
      upgrades: {
        repellingForceReduction: this.upgrades.repellingForceReduction,
        startingTier: this.upgrades.startingTier,
        waveForce: this.upgrades.waveForce,
      },
      permanentGlyphs: this.permanentGlyphs,
      alephAbsorptionCount: this.alephAbsorptionCount,
      spawnAccumulator: this.spawnAccumulator,
      spawnRate: this.spawnRate,
      placingStoredParticles: this.placingStoredParticles,
      pendingPlacementQueue: [...this.pendingPlacementQueue],
      storedTierCounts: this.storedTierCounts,
      interactiveWaves: this.interactiveWaves,
      spawnEffects: this.spawnEffects,
      fusionEffects: this.fusionEffects,
      forceLinks: this.forceLinks,
    };
  }

  /**
   * Export a snapshot intended for tab pause/resume, preserving layout and transient effects.
   * @returns {Object} Serialized snapshot ready for autosave.
   */
  exportSnapshot() {
    return this.exportState();
  }

  /**
   * Restore the simulation from a captured snapshot while preserving spatial layout.
   * @param {Object} snapshot - Serialized state captured during a pause.
   */
  importSnapshot(snapshot) {
    this.importState(snapshot, { preserveLayout: true });
  }

  /**
   * Import simulation state from save
   */
  importState(state, { preserveLayout = false } = {}) {
    if (!state) return;

    this.particles = [];
    this.pendingMoleculeIds.clear();
    if (Array.isArray(state.particles)) {
      for (const p of state.particles) {
        const radius = this.getRadiusForTier(p.tier);
        const tierInfo = getGreekTierInfo(p.tier);

        // Calculate tier-based properties
        const tierAboveNull = p.tier - NULL_TIER;
        const speedMultiplier = Math.max(0.1, 1 - (0.1 * tierAboveNull));
        const baseRepelling = this.baseRepellingForce;
        const repellingReduction = this.upgrades.repellingForceReduction * 0.5;
        const repellingMultiplier = tierAboveNull - repellingReduction;
        const repellingForce = baseRepelling * repellingMultiplier;

        // Always randomize layout on cold loads so particles scatter safely away from edges.
        // Preserve exact positions and velocities when restoring an in-session snapshot.
        const margin = radius * 2;
        const hasSizedCanvas =
          Number.isFinite(this.width) && this.width > margin * 2 &&
          Number.isFinite(this.height) && this.height > margin * 2;

        let x = Number.isFinite(p.x) ? p.x : margin;
        let y = Number.isFinite(p.y) ? p.y : margin;
        let vx = 0;
        let vy = 0;

        if (preserveLayout && hasSizedCanvas) {
          x = p.x;
          y = p.y;
          vx = Number.isFinite(p.vx) ? p.vx : 0;
          vy = Number.isFinite(p.vy) ? p.vy : 0;
        } else if (hasSizedCanvas) {
          const spawnableWidth = this.width - margin * 2;
          const spawnableHeight = this.height - margin * 2;
          x = margin + Math.random() * spawnableWidth;
          y = margin + Math.random() * spawnableHeight;
        }

        this.particles.push({
          x,
          y,
          vx,
          vy,
          radius,
          tier: p.tier,
          color: tierToColor(p.tier, this.samplePaletteGradient),
          label: tierInfo.letter,
          id: Number.isFinite(p.id) ? p.id : Math.random(),
          repellingForce,
          speedMultiplier,
        });
      }
    }
    
    if (typeof state.highestTierReached === 'number') {
      this.highestTierReached = state.highestTierReached;
      this.advancedMoleculesUnlocked = this.highestTierReached >= ADVANCED_MOLECULE_UNLOCK_TIER;
      // Tsadi glyphs equal the highest tier reached (display tier)
      this.glyphCount = toDisplayTier(this.highestTierReached);
    }
    
    // Legacy save migration: if highestTierReached is missing but glyphCount exists,
    // preserve the old glyphCount until the simulation naturally updates the tier
    if (typeof state.highestTierReached !== 'number' && typeof state.glyphCount === 'number') {
      this.glyphCount = state.glyphCount;
    }

    if (Number.isFinite(state.bindingAgentBank)) {
      this.setAvailableBindingAgents(state.bindingAgentBank);
    }

    if (Array.isArray(state.bindingAgents)) {
      this.bindingAgents = state.bindingAgents
        .filter((agent) => Number.isFinite(agent?.x) && Number.isFinite(agent?.y))
        .map((agent) => ({
          id: Number.isFinite(agent.id) ? agent.id : Math.random(),
          x: agent.x,
          y: agent.y,
          vx: preserveLayout && Number.isFinite(agent.vx) ? agent.vx : 0,
          vy: preserveLayout && Number.isFinite(agent.vy) ? agent.vy : 0,
          connections: Array.isArray(agent.connections) ? agent.connections : [],
          activeMolecules: Array.isArray(agent.activeMolecules) ? [...agent.activeMolecules] : [],
          pendingDiscoveries: Array.isArray(agent.pendingDiscoveries) ? [...agent.pendingDiscoveries] : [],
          awaitingCodexTap: Boolean(agent.awaitingCodexTap),
          popTimer: Number.isFinite(agent.popTimer) ? agent.popTimer : 0,
        }));
    }

    if (Array.isArray(state.discoveredMolecules)) {
      this.discoveredMolecules.clear();
      this.discoveredMoleculeEntries.clear();
      this.seedDiscoveredMolecules(state.discoveredMolecules);
    }

    this.recalculateMoleculeBonuses();

    if (state.upgrades) {
      if (typeof state.upgrades.repellingForceReduction === 'number') {
        this.upgrades.repellingForceReduction = state.upgrades.repellingForceReduction;
      }
      if (typeof state.upgrades.startingTier === 'number') {
        this.upgrades.startingTier = state.upgrades.startingTier;
      }
      if (typeof state.upgrades.waveForce === 'number') {
        this.upgrades.waveForce = state.upgrades.waveForce;
      }
    }
    
    if (Array.isArray(state.permanentGlyphs)) {
      this.permanentGlyphs = state.permanentGlyphs;
    }

    if (typeof state.alephAbsorptionCount === 'number') {
      this.alephAbsorptionCount = state.alephAbsorptionCount;
    }

    if (typeof state.bindingAgentBank === 'number') {
      this.setAvailableBindingAgents(state.bindingAgentBank);
    }

    if (typeof state.spawnAccumulator === 'number') {
      this.spawnAccumulator = Math.max(0, state.spawnAccumulator);
    }
    if (typeof state.spawnRate === 'number') {
      this.spawnRate = Math.max(0, state.spawnRate);
    }
    if (Array.isArray(state.pendingPlacementQueue)) {
      this.pendingPlacementQueue = [...state.pendingPlacementQueue];
      this.placingStoredParticles = Boolean(state.placingStoredParticles) && this.pendingPlacementQueue.length > 0;
    }
    if (state.storedTierCounts && typeof state.storedTierCounts === 'object') {
      this.storedTierCounts = { ...state.storedTierCounts };
    }
    if (Array.isArray(state.interactiveWaves)) {
      this.interactiveWaves = state.interactiveWaves
        .filter((wave) => Number.isFinite(wave?.x) && Number.isFinite(wave?.y))
        .map((wave) => ({
          ...wave,
          radius: Number.isFinite(wave.radius) ? wave.radius : 0,
          alpha: Number.isFinite(wave.alpha) ? wave.alpha : 0,
          maxRadius: Number.isFinite(wave.maxRadius) ? wave.maxRadius : 0,
          force: Number.isFinite(wave.force) ? wave.force : 0,
        }));
    }
    if (Array.isArray(state.spawnEffects)) {
      this.spawnEffects = state.spawnEffects
        .filter((effect) => Number.isFinite(effect?.x) && Number.isFinite(effect?.y))
        .map((effect) => ({
          ...effect,
          radius: Number.isFinite(effect.radius) ? effect.radius : 0,
          alpha: Number.isFinite(effect.alpha) ? effect.alpha : 0,
          maxRadius: Number.isFinite(effect.maxRadius) ? effect.maxRadius : 0,
        }));
    }
    if (Array.isArray(state.fusionEffects)) {
      this.fusionEffects = state.fusionEffects
        .filter((effect) => Number.isFinite(effect?.x) && Number.isFinite(effect?.y))
        .map((effect) => ({
          ...effect,
          radius: Number.isFinite(effect.radius) ? effect.radius : 0,
          alpha: Number.isFinite(effect.alpha) ? effect.alpha : 0,
        }));
    }
    if (Array.isArray(state.forceLinks)) {
      this.forceLinks = state.forceLinks;
    }

    if (this.onParticleCountChange) {
      this.onParticleCountChange(this.particles.length);
    }
    if (this.onTierChange) {
      const tierInfo = getGreekTierInfo(this.highestTierReached);
      this.onTierChange({
        tier: this.highestTierReached,
        name: tierInfo.name,
        letter: tierInfo.letter,
      });
    }
    if (this.onGlyphChange) {
      this.onGlyphChange(this.glyphCount);
    }
  }

  /**
   * Capture per-tier particle counts when the spire view hides so reentry can rebuild the swarm cleanly.
   */
  stageParticlesForReentry() {
    this.storedTierCounts = this.getParticleCountByTier();
    this.pendingPlacementQueue = [];
    this.placingStoredParticles = false;
    this.particles = [];
    this.spawnAccumulator = 0;
    if (this.onParticleCountChange) {
      this.onParticleCountChange(0);
    }
    this.stop();
  }

  /**
   * Initialize the queued placement sequence using the stored tier counts when returning to the Tsadi tab.
   */
  beginPlacementFromStoredCounts() {
    if (!this.storedTierCounts) {
      return;
    }

    this.pendingPlacementQueue = [];
    Object.entries(this.storedTierCounts).forEach(([tierKey, count]) => {
      const tier = Number(tierKey);
      const safeCount = Math.max(0, Math.floor(count));
      for (let i = 0; i < safeCount; i++) {
        this.pendingPlacementQueue.push(tier);
      }
    });

    // Shuffle the queue so restored particles do not cluster by tier.
    for (let i = this.pendingPlacementQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.pendingPlacementQueue[i], this.pendingPlacementQueue[j]] = [
        this.pendingPlacementQueue[j],
        this.pendingPlacementQueue[i],
      ];
    }

    this.spawnAccumulator = 0;
    this.placingStoredParticles = this.pendingPlacementQueue.length > 0;
  }

  /**
   * Place a single queued particle with zero initial velocity and guaranteed spacing from neighbors.
   */
  placeQueuedParticle() {
    if (!this.pendingPlacementQueue.length) {
      this.placingStoredParticles = false;
      this.storedTierCounts = null;
      return;
    }

    const tier = this.pendingPlacementQueue.shift();
    const radius = this.getRadiusForTier(tier);
    const tierInfo = getGreekTierInfo(tier);
    const tierAboveNull = tier - NULL_TIER;
    const speedMultiplier = Math.max(0.1, 1 - (0.1 * tierAboveNull));
    const repellingReduction = this.upgrades.repellingForceReduction * 0.5;
    const repellingForce = this.baseRepellingForce * (tierAboveNull - repellingReduction);

    const spacingBuffer = this.nullParticleRadius * 0.5;
    const margin = radius + spacingBuffer;
    const spawnableWidth = this.width - margin * 2;
    const spawnableHeight = this.height - margin * 2;
    if (spawnableWidth <= 0 || spawnableHeight <= 0) {
      this.pendingPlacementQueue.unshift(tier);
      return;
    }

    let placed = false;
    const maxAttempts = 50;
    for (let attempt = 0; attempt < maxAttempts && !placed; attempt++) {
      const x = margin + Math.random() * spawnableWidth;
      const y = margin + Math.random() * spawnableHeight;
      const isClear = this.particles.every((p) => {
        const dx = x - p.x;
        const dy = y - p.y;
        const minDistance = p.radius + radius + spacingBuffer;
        return (dx * dx + dy * dy) >= (minDistance * minDistance);
      });

      if (isClear) {
        this.particles.push({
          x,
          y,
          vx: 0,
          vy: 0,
          radius,
          tier,
          color: tierToColor(tier, this.samplePaletteGradient),
          label: tierInfo.letter,
          id: Math.random(),
          repellingForce,
          speedMultiplier,
        });
        placed = true;
      }
    }

    // If placement failed due to congestion, requeue the particle for the next frame.
    if (!placed) {
      this.pendingPlacementQueue.unshift(tier);
    }

    if (this.onParticleCountChange) {
      this.onParticleCountChange(this.particles.length);
    }

    if (!this.pendingPlacementQueue.length) {
      this.placingStoredParticles = false;
      this.storedTierCounts = null;
    }
  }
}

// Re-export tier utilities that are part of the tsadi tower public API.
export { tierToColor, getGreekTierInfo, ADVANCED_MOLECULE_UNLOCK_TIER };
