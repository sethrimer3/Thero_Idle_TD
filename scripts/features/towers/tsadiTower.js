/**
 * Tsadi tower particle fusion simulation module.
 * Provides an idle physics simulation with particle collisions and tier-based fusion.
 * 
 * Particles bounce around in 2D space. When two particles of the same tier collide,
 * they fuse into a single particle of tier+1, conserving momentum and mass.
 * The highest tier reached determines the number of Tsadi glyphs earned.
 */

import {
  GREEK_TIER_SEQUENCE,
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
} from './tsadiTowerData.js';

// Sprite assets for the Tsadi spire particles and Waals binding agents.
const TSADI_PARTICLE_SPRITE_URL = new URL('../../../assets/sprites/spires/tsadiSpire/particle.png', import.meta.url).href;
// Sprite asset for Waals binding agents to match the new Tsadi spire art drop.
const TSADI_WAALS_SPRITE_URL = new URL('../../../assets/sprites/spires/tsadiSpire/waalsParticle.png', import.meta.url).href;

// Pre-calculated constants for performance optimization
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI * 0.5;

/**
 * Normalize and sort a tier list so combinations ignore permutation order.
 * @param {Array<number>} tiers - Raw tier list.
 * @returns {Array<number>} Sorted unique tiers.
 */
function normalizeTierList(tiers = []) {
  const unique = Array.isArray(tiers)
    ? Array.from(new Set(tiers.filter((tier) => Number.isFinite(tier))))
    : [];
  return unique.sort((a, b) => a - b);
}

/**
 * Sort a tier list while preserving duplicates.
 * This allows molecules to include multiple particles of the same tier.
 * @param {Array<number>} tiers - Raw tier list with possible duplicates.
 * @returns {Array<number>} Sorted tier list with duplicates preserved.
 */
function sortTierListWithDuplicates(tiers = []) {
  const filtered = Array.isArray(tiers)
    ? tiers.filter((tier) => Number.isFinite(tier))
    : [];
  return filtered.sort((a, b) => a - b);
}

/**
 * Check if a tier list has sufficient variety to be a valid molecule.
 * A valid molecule must have at least 2 particles and at least 2 different tier types.
 * This prevents molecules like [alpha, alpha] while allowing [alpha, beta, alpha].
 * @param {Array<number>} tiers - Tier list to validate.
 * @returns {boolean} True if the molecule has sufficient variety.
 */
function hasValidMoleculeVariety(tiers = []) {
  if (!Array.isArray(tiers) || tiers.length < 2) {
    return false;
  }
  const uniqueTiers = new Set(tiers);
  return uniqueTiers.size >= 2;
}

/**
 * Determine if a tier list contains duplicate particle types, indicating an advanced molecule.
 * @param {Array<number>} tiers - Tier list to inspect.
 * @returns {boolean} True when any tier appears more than once.
 */
function hasDuplicateTier(tiers = []) {
  if (!Array.isArray(tiers)) {
    return false;
  }
  const unique = new Set(tiers);
  return unique.size !== tiers.length;
}

/**
 * Convert an internal tier index into the player-facing tier number.
 * Null sits at tier 0, Alpha at tier 1, and so on up the Greek ladder.
 * @param {number} tier - Internal tier index (NULL_TIER = -1, alpha = 0)
 * @returns {number} Display tier number.
 */
function toDisplayTier(tier) {
  if (tier === NULL_TIER) {
    return 0;
  }
  return tier + 1;
}

/**
 * Build a deterministic identifier for a molecule combination.
 * Now supports duplicate tiers to allow molecules like [alpha, beta, alpha].
 * @param {Array<number>} tiers - Tier list (may contain duplicates).
 * @param {boolean} [allowDuplicates=false] - If true, preserve duplicates in the ID. Defaults to false for backwards compatibility.
 * @returns {string|null} Stable id or null when insufficient data or invalid variety.
 */
function createCombinationIdFromTiers(tiers = [], allowDuplicates = false) {
  const sorted = allowDuplicates ? sortTierListWithDuplicates(tiers) : normalizeTierList(tiers);
  
  // Validate that we have enough particles and sufficient variety
  if (sorted.length < 2) {
    return null;
  }
  
  // Check for valid variety when duplicates are allowed
  if (allowDuplicates && !hasValidMoleculeVariety(sorted)) {
    return null;
  }
  
  return sorted.map((tier) => toDisplayTier(tier)).join('-');
}

/**
 * Remove the legacy "combo-" prefix from molecule identifiers for cleaner labels.
 * @param {string} label - Raw molecule id or name.
 * @returns {string} Label without the combo prefix.
 */
function stripCombinationPrefix(label = '') {
  if (typeof label !== 'string') {
    return '';
  }
  return label.replace(/^combo-/i, '');
}

/**
 * Enumerate every unique combination of at least two tiers from a set.
 * @param {Array<number>} tiers - Sorted unique tiers present on a binding agent.
 * @returns {Array<Array<number>>} All combinations with size >= 2.
 */
function generateTierCombinations(tiers = []) {
  const results = [];
  const total = tiers.length;
  const maxMask = 1 << total;
  for (let mask = 0; mask < maxMask; mask += 1) {
    const combo = [];
    for (let i = 0; i < total; i += 1) {
      if (mask & (1 << i)) {
        combo.push(tiers[i]);
      }
    }
    if (combo.length >= 2) {
      results.push(combo);
    }
  }
  return results;
}

/**
 * Convert tier to a color using the active color palette gradient.
 * Integrates with the game's color scheme system for consistent theming.
 * @param {number} tier - The particle tier (NULL_TIER to aleph)
 * @param {Function} sampleGradientFn - Function to sample from color palette gradient
 * @returns {string} CSS color string
 */
function tierToColor(tier, sampleGradientFn = null) {
  // Determine which cycle we're in and position within that cycle
  const tierInfo = getTierClassification(tier);
  
  // For null tier, use the start of the gradient
  if (tier === NULL_TIER) {
    if (sampleGradientFn) {
      const rgb = sampleGradientFn(0);
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }
    return 'hsl(240, 70%, 55%)'; // Default blue
  }
  
  // For aleph particle, use a golden color
  if (tierInfo.isAleph) {
    return 'hsl(45, 100%, 75%)'; // Golden aleph
  }
  
  // For Roman numerals, use a cycling color scheme based on the Roman index
  if (tierInfo.isRoman) {
    const romanCycle = (tierInfo.romanIndex - 1) % GREEK_SEQUENCE_LENGTH;
    const position = romanCycle / (GREEK_SEQUENCE_LENGTH - 1);
    
    if (sampleGradientFn) {
      const rgb = sampleGradientFn(position);
      // Roman numerals use 40% brightness for a distinct appearance
      const darkenFactor = 0.4;
      const r = Math.round(rgb.r * darkenFactor);
      const g = Math.round(rgb.g * darkenFactor);
      const b = Math.round(rgb.b * darkenFactor);
      return `rgb(${r}, ${g}, ${b})`;
    }
    
    // Fallback HSL for Roman numerals
    const hue = 240 - (position * 240);
    const lightness = (55 + position * 10) * 0.4;
    return `hsl(${hue}, ${70 + position * 20}%, ${lightness}%)`;
  }
  
  // Calculate position in gradient (0 to 1) based on position in Greek sequence
  const greekIndex = tier % GREEK_SEQUENCE_LENGTH;
  const position = greekIndex / (GREEK_SEQUENCE_LENGTH - 1);
  
  if (sampleGradientFn) {
    const rgb = sampleGradientFn(position);
    
    // Apply darkness multiplier based on cycle
    // Cycle 0 (lowercase): full brightness
    // Cycle 1 (capital): 70% brightness
    let darkenFactor = 1.0;
    if (tierInfo.cycle === 1) {
      darkenFactor = 0.7;
    }
    
    const r = Math.round(rgb.r * darkenFactor);
    const g = Math.round(rgb.g * darkenFactor);
    const b = Math.round(rgb.b * darkenFactor);
    
    return `rgb(${r}, ${g}, ${b})`;
  }
  
  // Fallback to HSL gradient
  const hue = 240 - (position * 240);
  let lightness = 55 + (position * 10);
  
  // Apply darkness for capital cycle
  if (tierInfo.cycle === 1) {
    lightness *= 0.7;
  }
  
  return `hsl(${hue}, ${70 + position * 20}%, ${lightness}%)`;
}

/**
 * Normalize a gem or palette color into a CSS color string.
 * @param {string|Object} color - Raw color input ({r,g,b} or {hue,saturation,lightness}).
 * @returns {string|null} CSS color string when resolvable.
 */
function colorToCssString(color) {
  if (!color) {
    return null;
  }
  if (typeof color === 'string') {
    return color;
  }
  if (typeof color === 'object') {
    if (Number.isFinite(color.r) && Number.isFinite(color.g) && Number.isFinite(color.b)) {
      return `rgb(${color.r}, ${color.g}, ${color.b})`;
    }
    if (
      Number.isFinite(color.hue) &&
      Number.isFinite(color.saturation) &&
      Number.isFinite(color.lightness)
    ) {
      return `hsl(${color.hue}, ${color.saturation}%, ${color.lightness}%)`;
    }
  }
  return null;
}

/**
 * Apply an alpha multiplier to an rgb() color string, falling back to the base color when parsing fails.
 * @param {string} colorStr - CSS color string.
 * @param {number} alpha - Alpha channel between 0 and 1.
 * @returns {string} rgba() string with the provided alpha.
 */
function applyAlphaToColor(colorStr, alpha) {
  if (!colorStr) {
    return `rgba(255, 255, 255, ${alpha})`;
  }
  const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
  }
  return colorStr;
}

/**
 * Classify a tier into its cycle and position.
 * @param {number} tier - The particle tier
 * @returns {Object} Classification info
 */
function getTierClassification(tier) {
  if (tier === NULL_TIER) {
    return { cycle: -1, isNull: true, isAleph: false, isRoman: false, greekIndex: -1, romanIndex: -1 };
  }
  
  // Check if aleph (tier 48: after capital omega = tier 47)
  const alephTier = GREEK_SEQUENCE_LENGTH * 2; // 48 for 24 Greek letters
  if (tier === alephTier) {
    return { cycle: 3, isNull: false, isAleph: true, isRoman: false, greekIndex: -1, romanIndex: -1 };
  }
  
  // Check if Roman numeral tier (tier 49+)
  if (tier > alephTier) {
    const romanIndex = tier - alephTier; // Roman numerals start at 1 for tier 49
    return { cycle: 2, isNull: false, isAleph: false, isRoman: true, greekIndex: -1, romanIndex };
  }
  
  // Greek tiers: 0 = lowercase, 1 = capital
  const cycle = Math.floor(tier / GREEK_SEQUENCE_LENGTH);
  const greekIndex = tier % GREEK_SEQUENCE_LENGTH;
  
  return { cycle, isNull: false, isAleph: false, isRoman: false, greekIndex, romanIndex: -1 };
}

/**
 * Convert a number to Roman numerals.
 * Supports numbers from 1 to 3999 with standard Roman numeral rules.
 * @param {number} num - The number to convert (1-3999)
 * @returns {string} Roman numeral representation
 */
function toRomanNumeral(num) {
  if (num <= 0 || num > 3999) {
    // For numbers outside the standard range, use a fallback format
    return `[${num}]`;
  }
  
  const romanNumerals = [
    { value: 1000, numeral: 'M' },
    { value: 900, numeral: 'CM' },
    { value: 500, numeral: 'D' },
    { value: 400, numeral: 'CD' },
    { value: 100, numeral: 'C' },
    { value: 90, numeral: 'XC' },
    { value: 50, numeral: 'L' },
    { value: 40, numeral: 'XL' },
    { value: 10, numeral: 'X' },
    { value: 9, numeral: 'IX' },
    { value: 5, numeral: 'V' },
    { value: 4, numeral: 'IV' },
    { value: 1, numeral: 'I' },
  ];
  
  let result = '';
  let remaining = num;
  
  for (const { value, numeral } of romanNumerals) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  
  return result;
}

/**
 * Simple Quadtree for efficient collision detection (broadphase).
 */
class Quadtree {
  constructor(bounds, maxObjects = 10, maxLevels = 5, level = 0) {
    this.bounds = bounds; // {x, y, width, height}
    this.maxObjects = maxObjects;
    this.maxLevels = maxLevels;
    this.level = level;
    this.objects = [];
    this.nodes = [];
  }
  
  clear() {
    this.objects = [];
    this.nodes = [];
  }
  
  split() {
    const subWidth = this.bounds.width / 2;
    const subHeight = this.bounds.height / 2;
    const x = this.bounds.x;
    const y = this.bounds.y;
    
    this.nodes[0] = new Quadtree(
      { x: x + subWidth, y: y, width: subWidth, height: subHeight },
      this.maxObjects, this.maxLevels, this.level + 1
    );
    this.nodes[1] = new Quadtree(
      { x: x, y: y, width: subWidth, height: subHeight },
      this.maxObjects, this.maxLevels, this.level + 1
    );
    this.nodes[2] = new Quadtree(
      { x: x, y: y + subHeight, width: subWidth, height: subHeight },
      this.maxObjects, this.maxLevels, this.level + 1
    );
    this.nodes[3] = new Quadtree(
      { x: x + subWidth, y: y + subHeight, width: subWidth, height: subHeight },
      this.maxObjects, this.maxLevels, this.level + 1
    );
  }
  
  getIndex(particle) {
    const verticalMidpoint = this.bounds.x + (this.bounds.width / 2);
    const horizontalMidpoint = this.bounds.y + (this.bounds.height / 2);
    
    const topQuadrant = (particle.y - particle.radius < horizontalMidpoint) && 
                        (particle.y + particle.radius < horizontalMidpoint);
    const bottomQuadrant = (particle.y - particle.radius > horizontalMidpoint);
    
    if (particle.x - particle.radius < verticalMidpoint && 
        particle.x + particle.radius < verticalMidpoint) {
      if (topQuadrant) return 1;
      else if (bottomQuadrant) return 2;
    } else if (particle.x - particle.radius > verticalMidpoint) {
      if (topQuadrant) return 0;
      else if (bottomQuadrant) return 3;
    }
    
    return -1; // Doesn't fit in a quadrant
  }
  
  insert(particle) {
    if (this.nodes.length > 0) {
      const index = this.getIndex(particle);
      if (index !== -1) {
        this.nodes[index].insert(particle);
        return;
      }
    }
    
    this.objects.push(particle);
    
    if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
      if (this.nodes.length === 0) {
        this.split();
      }
      
      let i = 0;
      while (i < this.objects.length) {
        const index = this.getIndex(this.objects[i]);
        if (index !== -1) {
          this.nodes[index].insert(this.objects.splice(i, 1)[0]);
        } else {
          i++;
        }
      }
    }
  }
  
  retrieve(particle) {
    const returnObjects = [];
    
    if (this.nodes.length > 0) {
      const index = this.getIndex(particle);
      if (index !== -1) {
        returnObjects.push(...this.nodes[index].retrieve(particle));
      } else {
        // Check all quadrants if particle overlaps multiple
        for (const node of this.nodes) {
          returnObjects.push(...node.retrieve(particle));
        }
      }
    }
    
    returnObjects.push(...this.objects);
    return returnObjects;
  }
}

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
    this.onParticleBankChange = typeof options.onParticleBankChange === 'function'
      ? options.onParticleBankChange
      : null;
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
    this.spawnRate = 0; // Particles per second (consumes particle bank, starts at 0)
    this.spawnAccumulator = 0;
    this.nullParticleRadius = 5; // Reference size for null particle (recalculated on resize)
    this.particleBank = 0; // Reserve that feeds the simulation with new particles
    
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

    // Hydrate the simulation with any preloaded particle reserve before seeding the initial swarm.
    const initialParticleBank = Number.isFinite(options.initialParticleBank)
      ? options.initialParticleBank
      : 0;
    this.setParticleBank(initialParticleBank);
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
    const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const cap = Number.isFinite(this.maxDevicePixelRatio) ? this.maxDevicePixelRatio : rawDpr;
    return Math.max(1, Math.min(rawDpr, cap));
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
    if (this.particleBank <= 0) return false;

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

    // Deduct a particle from the idle bank when it materializes inside the simulation.
    this.setParticleBank(this.particleBank - 1);

    if (this.onParticleCountChange) {
      this.onParticleCountChange(this.particles.length);
    }
    return true;
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
  updateParticles(deltaTime) {
    const dt = deltaTime / 1000; // Convert to seconds
    const canvasWidth = this.width;
    const canvasHeight = this.height;
    const bindingRadius = this.getBindingAgentRadius();
    const bindingRepellingForce = this.baseRepellingForce * 0.5; // Keep anchors gentle but interactive.

    // Treat binding agents as first-class physics bodies so they collide and share forces with particles.
    const physicsBodies = [...this.particles];
    for (const agent of this.bindingAgents) {
      // Fade pop highlight timers so recent discoveries still glow briefly.
      agent.popTimer = Math.max(0, (agent.popTimer || 0) - dt);
      agent.radius = bindingRadius;
      agent.repellingForce = bindingRepellingForce;
      agent.isBindingAgent = true;
      physicsBodies.push(agent);
    }

    // Stagger the reentry placement queue before resuming normal spawning or physics.
    if (this.placingStoredParticles) {
      this.spawnAccumulator = 0;
      this.placeQueuedParticle();
      // Skip movement for the placement frame so particles appear stationary when restored.
      return;
    }

    // Spawn new particles (always spawn at null tier, upgrade will adjust)
    const effectiveSpawnRate = this.spawnRate * (1 + this.moleculeBonuses.spawnRateBonus);
    this.spawnAccumulator += dt * effectiveSpawnRate;
    while (this.spawnAccumulator >= 1 && this.particles.length < this.maxParticles && this.particleBank > 0) {
      const spawned = this.spawnParticle(NULL_TIER);
      if (!spawned) {
        break;
      }
      this.spawnAccumulator -= 1;
    }
    
    // Build quadtree for efficient neighbor finding
    this.quadtree = new Quadtree({
      x: 0,
      y: 0,
      width: canvasWidth,
      height: canvasHeight,
    });

    for (const body of physicsBodies) {
      this.quadtree.insert(body);
    }

    // Apply repelling forces between nearby particles
    this.applyRepellingForces(dt, physicsBodies);

    // Update positions
    for (const body of physicsBodies) {
      body.x += body.vx * dt;
      body.y += body.vy * dt;

      // Wall collisions (elastic)
      if (body.x - body.radius < 0) {
        body.x = body.radius;
        body.vx = Math.abs(body.vx);
      } else if (body.x + body.radius > canvasWidth) {
        body.x = canvasWidth - body.radius;
        body.vx = -Math.abs(body.vx);
      }

      if (body.y - body.radius < 0) {
        body.y = body.radius;
        body.vy = Math.abs(body.vy);
      } else if (body.y + body.radius > canvasHeight) {
        body.y = canvasHeight - body.radius;
        body.vy = -Math.abs(body.vy);
      }

      if (body.isBindingAgent) {
        // Light damping avoids runaway velocity without stealing the feeling of momentum.
        body.vx *= 0.995;
        body.vy *= 0.995;
      }
    }

    // Apply forces from interactive waves
    for (const wave of this.interactiveWaves) {
      // Skip waves with negligible force for performance
      if (wave.force < WAVE_MIN_FORCE_THRESHOLD) {
        continue;
      }
      
      for (const body of physicsBodies) {
        const dx = body.x - wave.x;
        const dy = body.y - wave.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Only affect particles within the wave's current radius
        if (dist < wave.radius && dist > WAVE_MIN_DISTANCE) {
          // Check if particle is within the directional cone (if wave has direction)
          let inCone = true;
          if (wave.direction !== null && wave.direction !== undefined) {
            // Calculate angle to particle
            const angleToParticle = Math.atan2(dy, dx);
            // Calculate difference from wave direction
            let angleDiff = angleToParticle - wave.direction;
            // Normalize to [-PI, PI]
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            // Check if within cone angle (e.g., 90 degrees = PI/2 means +/- PI/4 from center)
            const halfConeAngle = (wave.coneAngle || Math.PI * 2) / 2;
            inCone = Math.abs(angleDiff) <= halfConeAngle;
          }
          
          if (inCone) {
            const nx = dx / dist;
            const ny = dy / dist;
            
            // Force falls off with distance from wave center
            const forceFalloff = 1 - (dist / wave.radius);
            const forceMagnitude = wave.force * forceFalloff * dt;
            
            // Push particles away from wave center
            body.vx += nx * forceMagnitude;
            body.vy += ny * forceMagnitude;
          }
        }
      }
    }

    // Particle-particle collisions and fusion
    this.handleCollisions(physicsBodies);
    
    // Update fusion effects
    if (this.visualSettings.renderFusionEffects) {
      for (let i = this.fusionEffects.length - 1; i >= 0; i--) {
        const effect = this.fusionEffects[i];
        effect.alpha -= dt * 3; // Fade out over ~0.33 seconds

        if (effect.type === 'ring') {
          effect.radius += dt * 100; // Expand ring
        }

        if (effect.alpha <= 0) {
          this.fusionEffects.splice(i, 1);
        }
      }
    } else {
      this.fusionEffects.length = 0;
    }

    // Update spawn effects
    if (this.visualSettings.renderSpawnEffects) {
      for (let i = this.spawnEffects.length - 1; i >= 0; i--) {
        const effect = this.spawnEffects[i];
        effect.alpha -= dt * 4; // Fade out over ~0.25 seconds

        if (effect.type === 'wave') {
          effect.radius += dt * 150; // Expand wave
        }

        if (effect.alpha <= 0) {
          this.spawnEffects.splice(i, 1);
        }
      }
    } else {
      this.spawnEffects.length = 0;
    }
    
    // Update interactive wave effects
    for (let i = this.interactiveWaves.length - 1; i >= 0; i--) {
      const wave = this.interactiveWaves[i];
      wave.alpha -= dt * WAVE_FADE_RATE;
      wave.radius += dt * WAVE_EXPANSION_RATE;
      
      // Efficient exponential decay with numerical stability check
      const decayFactor = Math.exp(WAVE_FORCE_DECAY_LOG * dt);
      // Clamp to prevent numerical instability (force should only decay, never grow)
      wave.force *= Math.min(decayFactor, 1.0);
      
      // Remove when faded or reached max radius
      if (wave.alpha <= 0 || wave.radius >= wave.maxRadius) {
        this.interactiveWaves.splice(i, 1);
      }
    }

    this.updateBindingAgents(dt);
  }
  
  /**
   * Apply repelling or attracting forces between particles based on their tier
   */
  applyRepellingForces(dt, bodies = this.particles) {
    const processedPairs = new Set();
    // Clear any previously recorded force links before evaluating the current frame.
    const collectForceLinks = this.visualSettings.renderForceLinks;
    this.forceLinks.length = 0;

    for (const p1 of bodies) {
      const candidates = this.quadtree.retrieve(p1);
      
      for (const p2 of candidates) {
        if (p1.id === p2.id) continue;
        
        const pairKey = p1.id < p2.id ? `${p1.id}-${p2.id}` : `${p2.id}-${p1.id}`;
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Force acts within 5× each particle's radius. Use the larger influence zone so
        // big particles exert a wider field while still covering small ones.
        const p1InfluenceRadius = p1.radius * 5;
        const p2InfluenceRadius = p2.radius * 5;
        const interactionRadius = Math.max(p1InfluenceRadius, p2InfluenceRadius);
        
        // Double the visual connection distance (10×) while keeping force interaction at 5×
        const visualRadius = interactionRadius * 2;

        if (dist < interactionRadius && dist > 0.001) {
          // Average repelling force between the two particles
          const avgRepelling = (p1.repellingForce + p2.repellingForce) / 2;
          const proximityStrength = 1 - dist / interactionRadius;

          // If force is negative, particles attract; if positive, they repel
          const forceMagnitude =
            (avgRepelling + this.moleculeBonuses.repellingShift) * proximityStrength * dt * 50;
          
          const nx = dx / dist;
          const ny = dy / dist;
          
          // Apply force (negative force attracts, positive repels)
          p1.vx -= nx * forceMagnitude;
          p1.vy -= ny * forceMagnitude;
          p2.vx += nx * forceMagnitude;
          p2.vy += ny * forceMagnitude;

          // Record the interaction so the renderer can draw a connective filament.
          if (collectForceLinks) {
            this.forceLinks.push({
              x1: p1.x,
              y1: p1.y,
              x2: p2.x,
              y2: p2.y,
              intensity: proximityStrength,
              isRepelling: forceMagnitude >= 0,
              distance: dist,
              maxDistance: visualRadius,
            });
          }
        } else if (dist < visualRadius && dist > 0.001) {
          // Show visual connection without applying force
          if (collectForceLinks) {
            // Calculate intensity based on visual radius for smooth opacity gradient
            const visualStrength = 1 - dist / visualRadius;
            this.forceLinks.push({
              x1: p1.x,
              y1: p1.y,
              x2: p2.x,
              y2: p2.y,
              intensity: visualStrength,
              isRepelling: true, // Default to repelling color
              distance: dist,
              maxDistance: visualRadius,
            });
          }
        }
      }
    }
  }

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
   * Add particles to the idle bank that feeds the simulation.
   * @param {number} amount - Number of particles to add
   */
  addToParticleBank(amount) {
    if (!Number.isFinite(amount)) {
      return;
    }
    this.setParticleBank(this.particleBank + amount);
  }

  /**
   * Overwrite the particle bank and notify observers when it changes.
   * @param {number} amount - New particle reserve value
   */
  setParticleBank(amount) {
    const normalized = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    if (normalized === this.particleBank) {
      return;
    }
    this.particleBank = normalized;
    if (this.onParticleBankChange) {
      this.onParticleBankChange(this.particleBank);
    }
  }

  /**
   * Handle particle-particle collisions and fusion with tier progression
   */
  handleCollisions(bodies = this.particles) {
    const processedPairs = new Set();
    const particlesToRemove = new Set();
    const particlesToAdd = [];

    for (let i = 0; i < bodies.length; i++) {
      const p1 = bodies[i];
      if (particlesToRemove.has(p1.id)) continue;
      
      // Check for aleph particle absorbing other particles
      const p1Classification = getTierClassification(p1.tier);
      if (p1Classification.isAleph && this.alephParticleId === p1.id) {
        this.handleAlephAbsorption(p1, particlesToRemove);
        continue;
      }
      
      const candidates = this.quadtree.retrieve(p1);

      for (const p2 of candidates) {
        if (p1.id === p2.id) continue;
        if (particlesToRemove.has(p2.id)) continue;

        const pairKey = p1.id < p2.id ? `${p1.id}-${p2.id}` : `${p2.id}-${p1.id}`;
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        // Check for collision
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distSq = dx * dx + dy * dy;
        const minDist = p1.radius + p2.radius;

        if (distSq < minDist * minDist) {
          // Collision detected
          if (p1.isBindingAgent || p2.isBindingAgent) {
            this.resolveElasticCollision(p1, p2);
          } else if (p1.tier === p2.tier) {
            // Fusion: same tier particles merge
            this.handleFusion(p1, p2, particlesToRemove, particlesToAdd);
          } else {
            // Elastic collision: different tiers
            this.resolveElasticCollision(p1, p2);
          }
        }
      }
    }
    
    // Remove fused particles
    this.particles = this.particles.filter(p => !particlesToRemove.has(p.id));
    
    // Add new particles
    this.particles.push(...particlesToAdd);
    
    if (this.onParticleCountChange) {
      this.onParticleCountChange(this.particles.length);
    }
  }
  
  /**
   * Handle fusion between two particles of the same tier
   */
  handleFusion(p1, p2, particlesToRemove, particlesToAdd) {
    const newTier = p1.tier + 1;
    const classification = getTierClassification(newTier);
    
    // Check if this is an omega tier that should explode
    const isOmegaTier = (newTier > NULL_TIER && (newTier % GREEK_SEQUENCE_LENGTH === 0));
    const omegaClassification = getTierClassification(p1.tier);
    
    if (isOmegaTier && omegaClassification.greekIndex === GREEK_SEQUENCE_LENGTH - 1) {
      // This is an omega merging into the next cycle - create explosion
      this.createTierExplosion(p1, p2, particlesToRemove, particlesToAdd);
      return;
    }
    
    // Position at midpoint of contact
    const newX = (p1.x + p2.x) / 2;
    const newY = (p1.y + p2.y) / 2;
    
    // Conserve momentum: average velocities
    const newVx = (p1.vx + p2.vx) / 2;
    const newVy = (p1.vy + p2.vy) / 2;
    
    // Create new fused particle
    const newRadius = this.getRadiusForTier(newTier);
    const newTierInfo = getGreekTierInfo(newTier);
    
    // Calculate speed with tier reduction
    const tierAboveNull = newTier - NULL_TIER;
    const speedMultiplier = Math.max(0.1, 1 - (0.1 * tierAboveNull));
    
    // Calculate repelling force
    const baseRepelling = this.baseRepellingForce;
    const repellingReduction = this.upgrades.repellingForceReduction * 0.5;
    const repellingMultiplier = tierAboveNull - repellingReduction;
    const repellingForce = baseRepelling * repellingMultiplier;
    
    const newParticle = {
      x: newX,
      y: newY,
      vx: newVx,
      vy: newVy,
      radius: newRadius,
      tier: newTier,
      color: tierToColor(newTier, this.samplePaletteGradient),
      label: newTierInfo.letter,
      id: Math.random(),
      repellingForce,
      speedMultiplier,
    };
    
    // Check if this is the first aleph particle
    if (classification.isAleph && !this.alephParticleId) {
      this.alephParticleId = newParticle.id;
      this.alephAbsorptionCount = 0;
    }
    
    particlesToAdd.push(newParticle);
    
    // Mark old particles for removal
    particlesToRemove.add(p1.id);
    particlesToRemove.add(p2.id);
    
    // Add fusion effects
    if (this.visualSettings.renderFusionEffects) {
      this.fusionEffects.push(
        { x: newX, y: newY, radius: newRadius * 1.2, alpha: 1, type: 'flash' },
        { x: newX, y: newY, radius: newRadius, alpha: 0.8, type: 'ring' },
      );
    }
    
    // Update highest tier
    if (newTier > this.highestTierReached) {
      this.highestTierReached = newTier;
      // Tsadi glyphs equal the highest tier reached (display tier)
      this.glyphCount = toDisplayTier(this.highestTierReached);
      if (this.onGlyphChange) {
        this.onGlyphChange(this.glyphCount);
      }
      if (this.onTierChange) {
        this.onTierChange({
          tier: newTier,
          name: newTierInfo.name,
          letter: newTierInfo.letter,
        });
      }
      this.areAdvancedMoleculesUnlocked();
    }
  }
  
  /**
   * Create an explosion when omega tiers merge, spawning next tier particles
   */
  createTierExplosion(p1, p2, particlesToRemove, particlesToAdd) {
    const explosionX = (p1.x + p2.x) / 2;
    const explosionY = (p1.y + p2.y) / 2;
    
    // Determine which tier to spawn
    const nextCycleTier = p1.tier + 1;
    const newRadius = this.getRadiusForTier(nextCycleTier);
    
    // Mark old particles for removal
    particlesToRemove.add(p1.id);
    particlesToRemove.add(p2.id);
    
    // Add large explosion effect
    if (this.visualSettings.renderFusionEffects) {
      this.fusionEffects.push(
        { x: explosionX, y: explosionY, radius: newRadius * 3, alpha: 1, type: 'flash' },
        { x: explosionX, y: explosionY, radius: newRadius * 2, alpha: 1, type: 'ring' },
      );
    }
    
    // Spawn 10 particles of the next tier in a circle
    const numSpawned = 10;
    const spawnRadius = newRadius * 3;
    
    for (let i = 0; i < numSpawned; i++) {
      const angle = (i / numSpawned) * Math.PI * 2;
      const x = explosionX + Math.cos(angle) * spawnRadius;
      const y = explosionY + Math.sin(angle) * spawnRadius;
      
      // Ensure particles stay within bounds
      const clampedX = Math.max(newRadius, Math.min(this.width - newRadius, x));
      const clampedY = Math.max(newRadius, Math.min(this.height - newRadius, y));
      
      // Velocity pointing outward from explosion
      const speed = this.baseSpeed * 0.5;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      const tierInfo = getGreekTierInfo(nextCycleTier);
      
      // Calculate tier-based properties
      const tierAboveNull = nextCycleTier - NULL_TIER;
      const speedMultiplier = Math.max(0.1, 1 - (0.1 * tierAboveNull));
      const baseRepelling = this.baseRepellingForce;
      const repellingReduction = this.upgrades.repellingForceReduction * 0.5;
      const repellingMultiplier = tierAboveNull - repellingReduction;
      const repellingForce = baseRepelling * repellingMultiplier;
      
      particlesToAdd.push({
        x: clampedX,
        y: clampedY,
        vx,
        vy,
        radius: newRadius,
        tier: nextCycleTier,
        color: tierToColor(nextCycleTier, this.samplePaletteGradient),
        label: tierInfo.letter,
        id: Math.random(),
        repellingForce,
        speedMultiplier,
      });
    }
    
    // Update highest tier
    if (nextCycleTier > this.highestTierReached) {
      this.highestTierReached = nextCycleTier;
      // Tsadi glyphs equal the highest tier reached (display tier)
      this.glyphCount = toDisplayTier(this.highestTierReached);
      if (this.onGlyphChange) {
        this.onGlyphChange(this.glyphCount);
      }
      const tierInfo = getGreekTierInfo(nextCycleTier);
      if (this.onTierChange) {
        this.onTierChange({
          tier: nextCycleTier,
          name: tierInfo.name,
          letter: tierInfo.letter,
        });
      }
      this.areAdvancedMoleculesUnlocked();
    }
  }
  
  /**
   * Handle aleph particle absorbing other particles
   */
  handleAlephAbsorption(alephParticle, particlesToRemove) {
    const candidates = this.quadtree.retrieve(alephParticle);
    
    for (const other of candidates) {
      if (other.id === alephParticle.id) continue;
      if (particlesToRemove.has(other.id)) continue;
      
      const dx = other.x - alephParticle.x;
      const dy = other.y - alephParticle.y;
      const distSq = dx * dx + dy * dy;
      const minDist = alephParticle.radius + other.radius;
      
      if (distSq < minDist * minDist) {
        // Absorb this particle
        particlesToRemove.add(other.id);
        this.alephAbsorptionCount++;
        
        // Add small absorption effect
        if (this.visualSettings.renderFusionEffects) {
          this.fusionEffects.push({
            x: other.x,
            y: other.y,
            radius: other.radius * 1.5,
            alpha: 0.8,
            type: 'flash',
          });
        }
        
        // Check if aleph has absorbed 1000 particles
        if (this.alephAbsorptionCount >= 1000) {
          this.triggerAlephExplosion(alephParticle, particlesToRemove);
        }
      }
    }
  }
  
  /**
   * Trigger the final aleph explosion, awarding glyphs and resetting
   */
  triggerAlephExplosion(alephParticle, particlesToRemove) {
    // Remove the aleph particle
    particlesToRemove.add(alephParticle.id);
    this.alephParticleId = null;
    this.alephAbsorptionCount = 0;
    
    // Add massive explosion effect
    if (this.visualSettings.renderFusionEffects) {
      this.fusionEffects.push(
        { x: alephParticle.x, y: alephParticle.y, radius: this.width / 2, alpha: 1, type: 'flash' },
        { x: alephParticle.x, y: alephParticle.y, radius: this.width / 3, alpha: 1, type: 'ring' },
      );
    }
    
    // Tsadi glyphs are based on highest tier reached (no bonus for Aleph explosion)
    // The glyphCount was already updated when reaching this tier
    
    // Add permanent glyph to background
    this.permanentGlyphs.push({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      alpha: 0.2 + Math.random() * 0.3,
      size: 20 + Math.random() * 30,
    });
    
    // Reset simulation after a brief delay
    setTimeout(() => {
      this.resetSimulation();
    }, 1000);
  }
  
  /**
   * Reset the simulation while maintaining glyph count
   */
  resetSimulation() {
    this.particles = [];
    this.highestTierReached = NULL_TIER;
    this.advancedMoleculesUnlocked = false;
    this.fusionEffects = [];
    this.alephParticleId = null;
    this.alephAbsorptionCount = 0;

    for (const agent of this.bindingAgents) {
      agent.connections = [];
      agent.activeMolecules = [];
      agent.pendingDiscoveries = [];
      agent.awaitingCodexTap = false;
    }
    this.pendingMoleculeIds.clear();
    this.recalculateMoleculeBonuses();

    // Respawn initial particles
    this.spawnInitialParticles();
    
    if (this.onReset) {
      this.onReset();
    }
    
    if (this.onParticleCountChange) {
      this.onParticleCountChange(this.particles.length);
    }
  }
  
  /**
   * Resolve elastic collision between two particles
   */
  resolveElasticCollision(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 0.001) return; // Avoid division by zero
    
    // Normalize collision vector
    const nx = dx / dist;
    const ny = dy / dist;
    
    // Relative velocity
    const dvx = p1.vx - p2.vx;
    const dvy = p1.vy - p2.vy;
    
    // Relative velocity in collision normal direction
    const dvn = dvx * nx + dvy * ny;
    
    // Don't resolve if velocities are separating
    if (dvn > 0) return;
    
    // Use radius as proxy for mass (larger particles have more inertia)
    const m1 = p1.radius * p1.radius;
    const m2 = p2.radius * p2.radius;
    
    // Collision impulse scalar
    const impulse = 2 * dvn / (m1 + m2);
    
    // Apply impulse
    p1.vx -= impulse * m2 * nx;
    p1.vy -= impulse * m2 * ny;
    p2.vx += impulse * m1 * nx;
    p2.vy += impulse * m1 * ny;
    
    // Separate particles to prevent overlap
    const overlap = (p1.radius + p2.radius) - dist;
    if (overlap > 0) {
      const separationX = (overlap / 2) * nx;
      const separationY = (overlap / 2) * ny;
      p1.x -= separationX;
      p1.y -= separationY;
      p2.x += separationX;
      p2.y += separationY;
    }
  }
  
  /**
   * Render the simulation
   */
  render() {
    if (!this.ctx) return;

    const ctx = this.ctx;

    // Clear with dark background
    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw permanent glowing Tsadi glyphs in background
    for (const glyph of this.permanentGlyphs) {
      ctx.fillStyle = `rgba(255, 220, 100, ${glyph.alpha})`;
      ctx.font = `${glyph.size}px 'Times New Roman', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('צ', glyph.x, glyph.y);
    }
    
    // Draw spawn effects
    if (this.visualSettings.renderSpawnEffects) {
      for (const effect of this.spawnEffects) {
        if (effect.type === 'flash') {
          // Radial flash
          const gradient = ctx.createRadialGradient(
            effect.x, effect.y, 0,
            effect.x, effect.y, effect.radius,
          );
          gradient.addColorStop(0, `rgba(255, 255, 255, ${effect.alpha})`);
          gradient.addColorStop(0.6, `rgba(255, 255, 255, ${effect.alpha * 0.5})`);
          gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.radius, 0, TWO_PI);
          ctx.fill();
        } else if (effect.type === 'wave') {
          // Expanding wave ring
          ctx.strokeStyle = `rgba(255, 255, 255, ${effect.alpha * 0.5})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.radius, 0, TWO_PI);
          ctx.stroke();
        }
      }
    }
    
    // Draw interactive wave effects from user clicks/taps
    for (const wave of this.interactiveWaves) {
      // Check if this is a directional wave (cone) or omnidirectional (circle)
      const isDirectional = wave.direction !== null && wave.direction !== undefined;
      
      if (isDirectional) {
        // Draw directional cone wave
        const halfConeAngle = (wave.coneAngle || Math.PI / 2) / 2;
        const startAngle = wave.direction - halfConeAngle;
        const endAngle = wave.direction + halfConeAngle;
        
        // Draw cone outline
        ctx.strokeStyle = `rgba(100, 200, 255, ${wave.alpha * 0.7})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, startAngle, endAngle);
        ctx.lineTo(wave.x, wave.y);
        ctx.closePath();
        ctx.stroke();
        
        // Fill cone with gradient
        ctx.save();
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, startAngle, endAngle);
        ctx.lineTo(wave.x, wave.y);
        ctx.closePath();
        ctx.clip();
        
        const gradient = ctx.createRadialGradient(
          wave.x, wave.y, wave.radius * 0.3,
          wave.x, wave.y, wave.radius
        );
        gradient.addColorStop(0, `rgba(100, 200, 255, ${wave.alpha * 0.4})`);
        gradient.addColorStop(0.7, `rgba(100, 200, 255, ${wave.alpha * 0.2})`);
        gradient.addColorStop(1, `rgba(100, 200, 255, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Draw omnidirectional (circular) wave
        ctx.strokeStyle = `rgba(100, 200, 255, ${wave.alpha * 0.7})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, TWO_PI);
        ctx.stroke();
        
        // Add inner glow effect
        const gradient = ctx.createRadialGradient(
          wave.x, wave.y, wave.radius * 0.7,
          wave.x, wave.y, wave.radius
        );
        gradient.addColorStop(0, `rgba(100, 200, 255, 0)`);
        gradient.addColorStop(0.5, `rgba(100, 200, 255, ${wave.alpha * 0.3})`);
        gradient.addColorStop(1, `rgba(100, 200, 255, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, TWO_PI);
        ctx.fill();
      }
    }
    
    // Draw fusion effects
    if (this.visualSettings.renderFusionEffects) {
      for (const effect of this.fusionEffects) {
        if (effect.type === 'flash') {
          // Radial flash
          const gradient = ctx.createRadialGradient(
            effect.x, effect.y, 0,
            effect.x, effect.y, effect.radius,
          );
          gradient.addColorStop(0, `rgba(255, 255, 255, ${effect.alpha * 0.8})`);
          gradient.addColorStop(0.5, `rgba(255, 255, 200, ${effect.alpha * 0.4})`);
          gradient.addColorStop(1, `rgba(255, 255, 200, 0)`);

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.radius, 0, TWO_PI);
          ctx.fill();
        } else if (effect.type === 'ring') {
          // Expanding ring
          ctx.strokeStyle = `rgba(255, 255, 255, ${effect.alpha * 0.6})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.radius, 0, TWO_PI);
          ctx.stroke();
        }
      }
    }
    
    // Draw blurred filaments between particles experiencing interaction forces.
    // Batch by link type to reduce context state changes
    if (this.visualSettings.renderForceLinks) {
      // Group links by type (repelling vs attracting) to batch rendering
      const repellingLinks = [];
      const attractingLinks = [];
      
      for (const link of this.forceLinks) {
        if (link.isRepelling) {
          repellingLinks.push(link);
        } else {
          attractingLinks.push(link);
        }
      }
      
      // Render all repelling links with shared shadow settings
      if (repellingLinks.length > 0) {
        ctx.save();
        ctx.lineWidth = 3.0;
        ctx.shadowBlur = 8;
        
        for (const link of repellingLinks) {
          const alpha = link.intensity;
          const baseRgb = '255, 140, 190';
          ctx.strokeStyle = `rgba(${baseRgb}, ${alpha})`;
          ctx.shadowColor = `rgba(${baseRgb}, ${Math.min(0.8, alpha * 2.0)})`;
          ctx.beginPath();
          ctx.moveTo(link.x1, link.y1);
          ctx.lineTo(link.x2, link.y2);
          ctx.stroke();
        }
        ctx.restore();
      }
      
      // Render all attracting links with shared shadow settings
      if (attractingLinks.length > 0) {
        ctx.save();
        ctx.lineWidth = 3.0;
        ctx.shadowBlur = 8;
        
        for (const link of attractingLinks) {
          const alpha = link.intensity;
          const baseRgb = '130, 190, 255';
          ctx.strokeStyle = `rgba(${baseRgb}, ${alpha})`;
          ctx.shadowColor = `rgba(${baseRgb}, ${Math.min(0.8, alpha * 2.0)})`;
          ctx.beginPath();
          ctx.moveTo(link.x1, link.y1);
          ctx.lineTo(link.x2, link.y2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    this.renderBindingAgents(ctx);

    // Draw particles with sub-pixel precision and glow
    // Batch operations to reduce context state changes
    const particleSpriteEnabled = this.particleSpriteReady && this.particleSprite;
    
    for (const particle of this.particles) {
      const classification = getTierClassification(particle.tier);
      
      // Enhanced glow for capital letters and Roman numerals
      let glowRadius = particle.radius * 1.5;
      let glowIntensity = 1.0;
      
      if (classification.cycle === 1) {
        // Capital letters: slightly brighter glow
        glowRadius = particle.radius * 2.0;
        glowIntensity = 1.3;
      } else if (classification.isRoman) {
        // Roman numerals: distinct darker glow
        glowRadius = particle.radius * 2.2;
        glowIntensity = 1.4;
      }
      
      // Outer bright glow for higher tiers
      if (classification.cycle >= 1 || classification.isRoman) {
        const brightGlowGradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, glowRadius
        );
        
        const color = particle.color;
        // Extract RGB from the color and brighten it
        const brightColor = this.brightenColor(color, glowIntensity * this.glowIntensity);
        
        brightGlowGradient.addColorStop(0, brightColor);
        brightGlowGradient.addColorStop(0.4, color);
        brightGlowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = brightGlowGradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, glowRadius, 0, TWO_PI);
        ctx.fill();
      }
      
      // Standard outer glow
      const glowGradient = ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, particle.radius * 1.5
      );
      
      const color = particle.color;
      glowGradient.addColorStop(0, color);
      glowGradient.addColorStop(0.7, color);
      glowGradient.addColorStop(1, this.backgroundColor);

      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius * 1.5, 0, TWO_PI);
      ctx.fill();

      if (particle.shimmer) {
        const shimmerAlpha = 0.35 + 0.25 * Math.sin((Date.now() / 240) + (particle.shimmerPhase || 0));
        const shimmerColor = particle.shimmerColor || particle.color;
        ctx.save();
        ctx.strokeStyle = applyAlphaToColor(shimmerColor, shimmerAlpha);
        ctx.lineWidth = Math.max(1.5, particle.radius * 0.35);
        ctx.setLineDash([
          Math.max(2, particle.radius * 0.8),
          Math.max(2, particle.radius * 0.6),
        ]);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * 1.25, 0, TWO_PI);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Main particle body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, TWO_PI);
      ctx.fill();

      // Inner highlight for 3D effect
      const highlightGradient = ctx.createRadialGradient(
        particle.x - particle.radius * 0.3,
        particle.y - particle.radius * 0.3,
        0,
        particle.x,
        particle.y,
        particle.radius
      );
      highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
      highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = highlightGradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, TWO_PI);
      ctx.fill();

      // Overlay the Tsadi particle sprite to introduce the new sprite artwork.
      if (particleSpriteEnabled) {
        // Blend the sprite softly so tier colors remain dominant.
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.globalCompositeOperation = 'screen';
        const spriteSize = particle.radius * 2.8;
        ctx.drawImage(
          this.particleSprite,
          particle.x - spriteSize * 0.5,
          particle.y - spriteSize * 0.5,
          spriteSize,
          spriteSize
        );
        ctx.restore();
      }

      // Render the tier glyph in the particle center to reinforce tier identity.
      if (particle.label) {
        const fontSize = Math.max(particle.radius * 1.1, 10);
        ctx.font = `${fontSize}px 'Times New Roman', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw black outline for visibility
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = Math.max(2, fontSize * 0.125);
        ctx.strokeText(particle.label, particle.x, particle.y);
        
        // Draw white text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(particle.label, particle.x, particle.y);
      }
    }
  }

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
  renderBindingAgents(ctx) {
    const particleMap = new Map(this.particles.map((particle) => [particle.id, particle]));
    const radius = this.getBindingAgentRadius();

    const drawAgent = (agent, { isPreview = false, hasActiveMolecule = false, hasValidCombo = false } = {}) => {
      const baseColor = isPreview ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.9)';
      // Yellow color for valid combinations, otherwise the existing color scheme
      const bondColor = hasValidCombo
        ? 'rgba(255, 220, 80, 0.9)'
        : hasActiveMolecule
          ? 'rgba(255, 215, 130, 0.9)'
          : 'rgba(180, 200, 255, 0.7)';
      const triangleRadius = radius * 1.5;
      const cornerRadius = radius * 0.55;
      const angleOffset = -HALF_PI;
      const corners = [0, 1, 2].map((index) => {
        const theta = angleOffset + (index * TWO_PI) / 3;
        return {
          x: agent.x + Math.cos(theta) * triangleRadius,
          y: agent.y + Math.sin(theta) * triangleRadius,
        };
      });

      // Outline the triangular bond to hint at three connected spheres rather than a flask glyph.
      ctx.save();
      ctx.strokeStyle = bondColor;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      corners.slice(1).forEach((corner) => {
        ctx.lineTo(corner.x, corner.y);
      });
      ctx.closePath();
      ctx.stroke();

      // Batch corner rendering - create gradients and draw all corners
      corners.forEach((corner) => {
        const glow = ctx.createRadialGradient(corner.x, corner.y, cornerRadius * 0.2, corner.x, corner.y, cornerRadius);
        glow.addColorStop(0, bondColor);
        glow.addColorStop(1, baseColor);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, cornerRadius, 0, TWO_PI);
        ctx.fill();
        ctx.strokeStyle = bondColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });
      ctx.restore();

      // Overlay the Waals sprite to incorporate the new binding agent artwork.
      if (this.bindingAgentSpriteReady && this.bindingAgentSprite) {
        // Fade the sprite slightly for preview placement states.
        ctx.save();
        ctx.globalAlpha = isPreview ? 0.35 : 0.75;
        const spriteSize = radius * 2.6;
        ctx.drawImage(
          this.bindingAgentSprite,
          agent.x - spriteSize / 2,
          agent.y - spriteSize / 2,
          spriteSize,
          spriteSize
        );
        ctx.restore();
      }
    };

    // Preview indicator when the player drags a fresh binding agent.
    if (this.bindingAgentPreview) {
      drawAgent({ ...this.bindingAgentPreview, activeMolecules: [] }, { isPreview: true });
    }

    for (const agent of this.bindingAgents) {
      const hasActiveMolecule =
        agent.awaitingCodexTap || (agent.activeMolecules?.length || 0) > 0 || (agent.popTimer || 0) > 0;
      const hasValidCombo = this.hasValidCombination(agent);
      
      for (const connection of agent.connections) {
        const target = particleMap.get(connection.particleId);
        if (!target) continue;

        const dx = target.x - agent.x;
        const dy = target.y - agent.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / distance;
        const ny = dy / distance;
        const reach = Math.max(target.radius, Math.min(distance, connection.bondLength || distance));
        const endX = agent.x + nx * reach;
        const endY = agent.y + ny * reach;

        // Yellow color for valid combinations, otherwise the existing color scheme
        const connectionColor = hasValidCombo
          ? 'rgba(255, 220, 80, 0.8)'
          : hasActiveMolecule
            ? 'rgba(255, 215, 130, 0.8)'
            : 'rgba(180, 220, 255, 0.7)';

        ctx.save();
        ctx.strokeStyle = connectionColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(agent.x, agent.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.restore();
      }

      drawAgent(agent, { hasActiveMolecule, hasValidCombo });
    }
  }

  /**
   * Brighten a color for enhanced glow effects
   */
  brightenColor(colorStr, intensity) {
    // Parse RGB from color string
    const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      let r = parseInt(match[1]);
      let g = parseInt(match[2]);
      let b = parseInt(match[3]);
      
      // Brighten by intensity factor
      r = Math.min(255, Math.round(r * intensity));
      g = Math.min(255, Math.round(g * intensity));
      b = Math.min(255, Math.round(b * intensity));
      
      return `rgba(${r}, ${g}, ${b}, 0.6)`;
    }
    
    return colorStr;
  }
  
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
    const cost = this.getRepellingForceReductionCost();
    if (this.particleBank < cost) {
      return false;
    }
    
    this.setParticleBank(this.particleBank - cost);
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
    const cost = this.getWaveForceUpgradeCost();
    if (this.particleBank < cost) {
      return false;
    }

    this.setParticleBank(this.particleBank - cost);
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
    const cost = this.getStartingTierUpgradeCost();
    if (this.particleBank < cost) {
      return false;
    }
    
    this.setParticleBank(this.particleBank - cost);
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
        canAfford: this.particleBank >= this.getRepellingForceReductionCost(),
      },
      waveForce: {
        level: this.upgrades.waveForce,
        cost: this.getWaveForceUpgradeCost(),
        effect: currentWaveStats.force > 0
          ? `Push radius ~${Math.round(currentWaveStats.maxRadius)}px, peak force ${Math.round(currentWaveStats.force)}`
          : 'Wave of force is inactive until upgraded.',
        canAfford: this.particleBank >= this.getWaveForceUpgradeCost(),
      },
      startingTier: {
        level: this.upgrades.startingTier,
        cost: this.getStartingTierUpgradeCost(),
        effect: this.upgrades.startingTier > 0
          ? `Spawn ${getGreekTierInfo(NULL_TIER + this.upgrades.startingTier).name} particles`
          : 'Spawn Null particles',
        canAfford: this.particleBank >= this.getStartingTierUpgradeCost(),
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
      particleBank: this.particleBank,
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

    if (Number.isFinite(state.particleBank)) {
      this.setParticleBank(state.particleBank);
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

/**
 * Retrieve metadata for the provided tier with support for null, lowercase, capital, Roman numerals, and aleph.
 * @param {number} tier - Tier index (NULL_TIER = -1 for null particle, 0+ for Greek tiers)
 * @returns {{name: string, letter: string, displayName: string}}
 */
function getGreekTierInfo(tier) {
  const safeTier = Math.floor(tier);
  
  // Handle null particle (tier -1)
  if (safeTier === NULL_TIER) {
    return {
      name: 'Null',
      letter: '', // No letter for null particle
      displayName: 'Null – Tier 0',
      displayTier: 0,
    };
  }

  // Handle aleph particle (tier 48: after capital omega)
  const alephTier = GREEK_SEQUENCE_LENGTH * 2; // 48 for 24 Greek letters
  if (safeTier === alephTier) {
    return {
      name: 'Aleph',
      letter: 'ℵ', // Aleph symbol
      displayName: 'Aleph – Tier 49',
      displayTier: safeTier + 1,
    };
  }

  const classification = getTierClassification(safeTier);
  const displayTier = toDisplayTier(safeTier);
  
  let name, letter, displayName;
  
  if (classification.isRoman) {
    // Roman numerals (tiers 49+)
    const romanNum = toRomanNumeral(classification.romanIndex);
    name = `Roman ${romanNum}`;
    letter = romanNum;
    displayName = `${letter} – Tier ${displayTier}`;
  } else if (classification.cycle === 0) {
    // Lowercase Greek letters (tiers 0-23)
    const baseInfo = GREEK_TIER_SEQUENCE[classification.greekIndex];
    name = baseInfo.name;
    letter = baseInfo.letter;
    displayName = `${name} (${letter}) – Tier ${displayTier}`;
  } else if (classification.cycle === 1) {
    // Capital Greek letters (tiers 24-47)
    const baseInfo = GREEK_TIER_SEQUENCE[classification.greekIndex];
    name = `Capital ${baseInfo.name}`;
    letter = baseInfo.capital;
    displayName = `${name} (${letter}) – Tier ${displayTier}`;
  } else {
    // Fallback for any other case
    name = `Tier ${displayTier}`;
    letter = `T${displayTier}`;
    displayName = `${name}`;
  }

  return { name, letter, displayName, displayTier };
}

// Export helper utilities for external use
export { tierToColor, getGreekTierInfo, ADVANCED_MOLECULE_UNLOCK_TIER };
