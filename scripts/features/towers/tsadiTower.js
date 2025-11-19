/**
 * Tsadi tower particle fusion simulation module.
 * Provides an idle physics simulation with particle collisions and tier-based fusion.
 * 
 * Particles bounce around in 2D space. When two particles of the same tier collide,
 * they fuse into a single particle of tier+1, conserving momentum and mass.
 * The highest tier reached determines the number of Tsadi glyphs earned.
 */

/**
 * Ordered list of Greek letter metadata for tier naming.
 * Each entry contains the capitalized English name, lowercase glyph, and uppercase glyph.
 */
const GREEK_TIER_SEQUENCE = [
  { name: 'Alpha', letter: 'α', capital: 'Α' },
  { name: 'Beta', letter: 'β', capital: 'Β' },
  { name: 'Gamma', letter: 'γ', capital: 'Γ' },
  { name: 'Delta', letter: 'δ', capital: 'Δ' },
  { name: 'Epsilon', letter: 'ε', capital: 'Ε' },
  { name: 'Zeta', letter: 'ζ', capital: 'Ζ' },
  { name: 'Eta', letter: 'η', capital: 'Η' },
  { name: 'Theta', letter: 'θ', capital: 'Θ' },
  { name: 'Iota', letter: 'ι', capital: 'Ι' },
  { name: 'Kappa', letter: 'κ', capital: 'Κ' },
  { name: 'Lambda', letter: 'λ', capital: 'Λ' },
  { name: 'Mu', letter: 'μ', capital: 'Μ' },
  { name: 'Nu', letter: 'ν', capital: 'Ν' },
  { name: 'Xi', letter: 'ξ', capital: 'Ξ' },
  { name: 'Omicron', letter: 'ο', capital: 'Ο' },
  { name: 'Pi', letter: 'π', capital: 'Π' },
  { name: 'Rho', letter: 'ρ', capital: 'Ρ' },
  { name: 'Sigma', letter: 'σ', capital: 'Σ' },
  { name: 'Tau', letter: 'τ', capital: 'Τ' },
  { name: 'Upsilon', letter: 'υ', capital: 'Υ' },
  { name: 'Phi', letter: 'φ', capital: 'Φ' },
  { name: 'Chi', letter: 'χ', capital: 'Χ' },
  { name: 'Psi', letter: 'ψ', capital: 'Ψ' },
  { name: 'Omega', letter: 'ω', capital: 'Ω' },
];

// Null particle is tier -1, the base reference particle
const NULL_TIER = -1;
// Total Greek letters in sequence (used for tier calculations)
const GREEK_SEQUENCE_LENGTH = GREEK_TIER_SEQUENCE.length;
// Canvas dimensions below this value indicate the spire view is collapsed or hidden.
const COLLAPSED_DIMENSION_THRESHOLD = 2;
// Molecule recipes that reward the player for stabilizing specific tier sets.
const MOLECULE_RECIPES = [
  {
    id: 'null-alpha-beta',
    name: 'Catalyst Triangle',
    tiers: [NULL_TIER, 0, 1],
    bonus: { spawnRateBonus: 0.15, repellingShift: -0.05 },
    description: 'Stabilizes null, α, and β bonds to gently hasten particle spawning.',
  },
  {
    id: 'alpha-beta-gamma',
    name: 'Prismatic Triplet',
    tiers: [0, 1, 2],
    bonus: { spawnRateBonus: 0.1, repellingShift: -0.2 },
    description: 'Aligns α/β/γ into an attractive prism that weakens repelling forces.',
  },
  {
    id: 'delta-epsilon-zeta',
    name: 'Stability Weave',
    tiers: [3, 4, 5],
    bonus: { spawnRateBonus: 0.05, repellingShift: -0.15 },
    description: 'Weaves δ/ε/ζ together to keep higher-tier clusters from scattering.',
  },
];

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
  
  // Calculate position in gradient (0 to 1) based on position in Greek sequence
  const greekIndex = tier % GREEK_SEQUENCE_LENGTH;
  const position = greekIndex / (GREEK_SEQUENCE_LENGTH - 1);
  
  if (sampleGradientFn) {
    const rgb = sampleGradientFn(position);
    
    // Apply darkness multiplier based on cycle
    // Cycle 0 (lowercase): full brightness
    // Cycle 1 (capital): 70% brightness
    // Cycle 2+ (double letters): 50% brightness
    let darkenFactor = 1.0;
    if (tierInfo.cycle === 1) {
      darkenFactor = 0.7;
    } else if (tierInfo.cycle >= 2) {
      darkenFactor = 0.5;
    }
    
    const r = Math.round(rgb.r * darkenFactor);
    const g = Math.round(rgb.g * darkenFactor);
    const b = Math.round(rgb.b * darkenFactor);
    
    return `rgb(${r}, ${g}, ${b})`;
  }
  
  // Fallback to HSL gradient
  const hue = 240 - (position * 240);
  let lightness = 55 + (position * 10);
  
  // Apply darkness for higher cycles
  if (tierInfo.cycle === 1) {
    lightness *= 0.7;
  } else if (tierInfo.cycle >= 2) {
    lightness *= 0.5;
  }
  
  return `hsl(${hue}, ${70 + position * 20}%, ${lightness}%)`;
}

/**
 * Classify a tier into its cycle and position.
 * @param {number} tier - The particle tier
 * @returns {Object} Classification info
 */
function getTierClassification(tier) {
  if (tier === NULL_TIER) {
    return { cycle: -1, isNull: true, isAleph: false, greekIndex: -1 };
  }
  
  // Check if aleph (after omega omega = tier 47)
  const alephTier = GREEK_SEQUENCE_LENGTH * 2; // 48 for 24 Greek letters
  if (tier >= alephTier) {
    return { cycle: 3, isNull: false, isAleph: true, greekIndex: -1 };
  }
  
  // Determine cycle: 0 = lowercase, 1 = capital, 2 = double lowercase
  const cycle = Math.floor(tier / GREEK_SEQUENCE_LENGTH);
  const greekIndex = tier % GREEK_SEQUENCE_LENGTH;
  
  return { cycle, isNull: false, isAleph: false, greekIndex };
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
    };

    // Fusion effects
    this.fusionEffects = []; // {x, y, radius, alpha, type: 'flash' | 'ring'}

    // Spawn effects (flash and wave)
    this.spawnEffects = []; // {x, y, radius, alpha, maxRadius, type: 'flash' | 'wave'}

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
    this.glowIntensity = 0.6;

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
    const dpr = window.devicePixelRatio || 1;

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
   * Double letters reset to alpha size + 20%.
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
    } else {
      // Double letters: alpha + 20% per double tier
      const doubleTierIndex = tier - (GREEK_SEQUENCE_LENGTH * 2);
      const alphaRadius = this.nullParticleRadius * 1.1;
      baseSize = alphaRadius * (1 + 0.2 * doubleTierIndex);
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
   * Spawn a new particle with random position and velocity
   */
  spawnParticle(tier = NULL_TIER) {
    if (this.particles.length >= this.maxParticles) return false;
    if (this.particleBank <= 0) return false;

    // Ensure valid dimensions before spawning to prevent particles spawning at origin
    if (!Number.isFinite(this.width) || this.width <= 0 || !Number.isFinite(this.height) || this.height <= 0) {
      return false;
    }

    // Apply starting tier upgrade
    const effectiveTier = tier + this.upgrades.startingTier;
    
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
      color: tierToColor(effectiveTier, this.samplePaletteGradient),
      label: tierInfo.letter,
      id: Math.random(), // Unique ID for tracking
      repellingForce,
      speedMultiplier,
    });
    
    // Add spawn flash and wave effects
    this.spawnEffects.push(
      { x, y, radius: radius * 2, alpha: 1, maxRadius: radius * 2, type: 'flash' },
      { x, y, radius: radius, alpha: 1, maxRadius: radius * 4, type: 'wave' }
    );

    // Deduct a particle from the idle bank when it materializes inside the simulation.
    this.setParticleBank(this.particleBank - 1);

    if (this.onParticleCountChange) {
      this.onParticleCountChange(this.particles.length);
    }
    return true;
  }
  
  /**
   * Update physics for all particles
   */
  updateParticles(deltaTime) {
    const dt = deltaTime / 1000; // Convert to seconds
    const canvasWidth = this.width;
    const canvasHeight = this.height;

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
    
    for (const particle of this.particles) {
      this.quadtree.insert(particle);
    }
    
    // Apply repelling forces between nearby particles
    this.applyRepellingForces(dt);
    
    // Update positions
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      
      // Wall collisions (elastic)
      if (particle.x - particle.radius < 0) {
        particle.x = particle.radius;
        particle.vx = Math.abs(particle.vx);
      } else if (particle.x + particle.radius > canvasWidth) {
        particle.x = canvasWidth - particle.radius;
        particle.vx = -Math.abs(particle.vx);
      }
      
      if (particle.y - particle.radius < 0) {
        particle.y = particle.radius;
        particle.vy = Math.abs(particle.vy);
      } else if (particle.y + particle.radius > canvasHeight) {
        particle.y = canvasHeight - particle.radius;
        particle.vy = -Math.abs(particle.vy);
      }
    }
    
    // Particle-particle collisions and fusion
    this.handleCollisions();
    
    // Update fusion effects
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
    
    // Update spawn effects
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

    this.updateBindingAgents(dt);
  }
  
  /**
   * Apply repelling or attracting forces between particles based on their tier
   */
  applyRepellingForces(dt) {
    const processedPairs = new Set();
    // Clear any previously recorded force links before evaluating the current frame.
    this.forceLinks.length = 0;
    
    for (const p1 of this.particles) {
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
          this.forceLinks.push({
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            intensity: proximityStrength,
            isRepelling: forceMagnitude >= 0,
          });
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
    const baseRecipe = MOLECULE_RECIPES.find((entry) => entry.id === resolvedId) || null;
    const merged = typeof recipe === 'object' ? { ...(baseRecipe || {}), ...recipe } : (baseRecipe || { id: resolvedId });

    const id = merged.id || merged.name || resolvedId || 'molecule';
    const tiers = Array.isArray(merged.tiers) ? merged.tiers : baseRecipe?.tiers || [];
    const description = typeof merged.description === 'string'
      ? merged.description
      : baseRecipe?.description || 'Recorded in the Alchemy Codex.';
    const descriptor = {
      ...merged,
      id,
      name: typeof merged.name === 'string' && merged.name ? merged.name : (baseRecipe?.name || id),
      tiers,
      description,
      bonus: merged.bonus || baseRecipe?.bonus || {},
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
    if (!descriptor) {
      return null;
    }
    this.discoveredMolecules.add(descriptor.id);
    this.discoveredMoleculeEntries.set(descriptor.id, descriptor);
    return descriptor;
  }

  /**
   * Recompute global molecule bonuses from all active bindings.
   */
  recalculateMoleculeBonuses() {
    const nextBonuses = { spawnRateBonus: 0, repellingShift: 0 };
    for (const agent of this.bindingAgents) {
      for (const moleculeId of agent.activeMolecules || []) {
        const recipe = MOLECULE_RECIPES.find((entry) => entry.id === moleculeId);
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
   * Randomly connect binding agents to nearby particles with non-positive repelling force
   * and resolve molecule formation state.
   * @param {number} dt - Delta time in seconds.
   */
  updateBindingAgents(dt) {
    if (!this.bindingAgents.length) {
      this.moleculeBonuses = { spawnRateBonus: 0, repellingShift: 0 };
      return;
    }

    // Drift binding agents with inertia so they participate in the simulation like particles.
    const bindingRadius = this.getBindingAgentRadius();
    const bindingMass = this.getBindingAgentMass();
    for (const agent of this.bindingAgents) {
      if (!Number.isFinite(agent.vx)) agent.vx = 0;
      if (!Number.isFinite(agent.vy)) agent.vy = 0;

      agent.x += agent.vx * dt;
      agent.y += agent.vy * dt;

      // Bounce off the walls so anchored agents stay inside the chamber.
      if (agent.x - bindingRadius < 0) {
        agent.x = bindingRadius;
        agent.vx = Math.abs(agent.vx);
      } else if (agent.x + bindingRadius > this.width) {
        agent.x = this.width - bindingRadius;
        agent.vx = -Math.abs(agent.vx);
      }

      if (agent.y - bindingRadius < 0) {
        agent.y = bindingRadius;
        agent.vy = Math.abs(agent.vy);
      } else if (agent.y + bindingRadius > this.height) {
        agent.y = this.height - bindingRadius;
        agent.vy = -Math.abs(agent.vy);
      }

      // Light damping avoids runaway velocity without stealing the feeling of momentum.
      agent.vx *= 0.995;
      agent.vy *= 0.995;
    }

    const particleMap = new Map();
    for (const particle of this.particles) {
      particleMap.set(particle.id, particle);
    }

    for (const agent of this.bindingAgents) {
      // Remove stale or now-repulsive connections.
      agent.connections = agent.connections.filter((connection) => {
        const target = particleMap.get(connection.particleId);
        if (!target || target.tier <= NULL_TIER) {
          return false;
        }

        // Preserve the latest distance so the render step can draw a taut bond to moving particles.
        connection.bondLength = Math.hypot(target.x - agent.x, target.y - agent.y);
        return true;
      });

      const connectedTiers = new Set(agent.connections.map((connection) => connection.tier));
      const connectedIds = new Set(agent.connections.map((connection) => connection.particleId));

      // If a Waals particle bumps into an eligible target, immediately stabilize it with a bond
      // and resolve the overlap so the contact is visible instead of passing through.
      for (const target of this.particles) {
        const isNullParticle = target.tier <= NULL_TIER;

        const dx = target.x - agent.x;
        const dy = target.y - agent.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDistance = bindingRadius + target.radius;

        if (distance < minDistance) {
          const overlap = minDistance - distance;
          const nx = dx / distance;
          const ny = dy / distance;
          const targetMass = target.radius * target.radius;
          const totalMass = bindingMass + targetMass || 1;

          // Separate the bodies proportionally to their mass so both visibly react to the bump.
          agent.x -= nx * (overlap * targetMass) / totalMass;
          agent.y -= ny * (overlap * targetMass) / totalMass;
          target.x += nx * (overlap * bindingMass) / totalMass;
          target.y += ny * (overlap * bindingMass) / totalMass;

          // Damp relative motion along the collision normal to keep the bond calm after impact.
          const relativeSpeed = (agent.vx - target.vx) * nx + (agent.vy - target.vy) * ny;
          agent.vx -= (relativeSpeed * nx * targetMass) / totalMass;
          agent.vy -= (relativeSpeed * ny * targetMass) / totalMass;
          target.vx += (relativeSpeed * nx * bindingMass) / totalMass;
          target.vy += (relativeSpeed * ny * bindingMass) / totalMass;

          // Null particles cannot form bonds, but still collide to keep the chamber physical.
          if (!isNullParticle && !connectedIds.has(target.id) && !connectedTiers.has(target.tier)) {
            const bondLength = Math.max(minDistance, Math.hypot(target.x - agent.x, target.y - agent.y));
            agent.connections.push({
              particleId: target.id,
              tier: target.tier,
              bondLength,
            });
            connectedIds.add(target.id);
            connectedTiers.add(target.tier);
          }
        }
      }

      // Stochastically attempt one new connection per frame to keep molecule creation organic.
      const shouldAttemptBond = Math.random() < Math.min(0.6, dt * 3);
      if (shouldAttemptBond) {
        const eligibleCandidates = this.particles.filter((particle) => {
          if (particle.tier <= NULL_TIER) return false;
          if (connectedTiers.has(particle.tier)) return false;
          
          const dx = particle.x - agent.x;
          const dy = particle.y - agent.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDistance = particle.radius + this.getBindingAgentRadius();
          return distance <= maxDistance;
        });

        if (eligibleCandidates.length) {
          const target = eligibleCandidates[Math.floor(Math.random() * eligibleCandidates.length)];
          const bondLength = Math.hypot(target.x - agent.x, target.y - agent.y);
          agent.connections.push({
            particleId: target.id,
            tier: target.tier,
            bondLength,
          });
          connectedTiers.add(target.tier);
        }
      }

      // Resolve molecule completion and discovery.
      const tiersPresent = new Set(agent.connections.map((connection) => connection.tier));
      agent.activeMolecules = [];
      for (const recipe of MOLECULE_RECIPES) {
        const isComplete = recipe.tiers.every((tier) => tiersPresent.has(tier));
        if (isComplete) {
          agent.activeMolecules.push(recipe.id);
          if (!this.discoveredMolecules.has(recipe.id)) {
            const descriptor = this.recordDiscoveredMolecule(recipe);
            if (descriptor && this.onMoleculeDiscovered) {
              this.onMoleculeDiscovered(descriptor);
            }
          }
        }
      }

      // Constrain connected particles to move as if joined by rigid, weightless rods.
      for (const connection of agent.connections) {
        const target = particleMap.get(connection.particleId);
        if (!target) continue;

        const dx = target.x - agent.x;
        const dy = target.y - agent.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const desiredLength = connection.bondLength || distance;
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
  handleCollisions() {
    const processedPairs = new Set();
    const particlesToRemove = new Set();
    const particlesToAdd = [];
    
    for (let i = 0; i < this.particles.length; i++) {
      const p1 = this.particles[i];
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
          if (p1.tier === p2.tier) {
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
    this.fusionEffects.push(
      { x: newX, y: newY, radius: newRadius * 1.2, alpha: 1, type: 'flash' },
      { x: newX, y: newY, radius: newRadius, alpha: 0.8, type: 'ring' }
    );
    
    // Update highest tier
    if (newTier > this.highestTierReached) {
      this.highestTierReached = newTier;
      // Glyph count is now tracked separately
      if (this.onTierChange) {
        this.onTierChange({
          tier: newTier,
          name: newTierInfo.name,
          letter: newTierInfo.letter,
        });
      }
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
    this.fusionEffects.push(
      { x: explosionX, y: explosionY, radius: newRadius * 3, alpha: 1, type: 'flash' },
      { x: explosionX, y: explosionY, radius: newRadius * 2, alpha: 1, type: 'ring' }
    );
    
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
      const tierInfo = getGreekTierInfo(nextCycleTier);
      if (this.onTierChange) {
        this.onTierChange({
          tier: nextCycleTier,
          name: tierInfo.name,
          letter: tierInfo.letter,
        });
      }
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
        this.fusionEffects.push({
          x: other.x,
          y: other.y,
          radius: other.radius * 1.5,
          alpha: 0.8,
          type: 'flash',
        });
        
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
    this.fusionEffects.push(
      { x: alephParticle.x, y: alephParticle.y, radius: this.width / 2, alpha: 1, type: 'flash' },
      { x: alephParticle.x, y: alephParticle.y, radius: this.width / 3, alpha: 1, type: 'ring' }
    );
    
    // Award 100 Tsadi glyphs
    this.glyphCount += 100;
    if (this.onGlyphChange) {
      this.onGlyphChange(this.glyphCount);
    }
    
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
    this.fusionEffects = [];
    this.alephParticleId = null;
    this.alephAbsorptionCount = 0;

    for (const agent of this.bindingAgents) {
      agent.connections = [];
      agent.activeMolecules = [];
    }
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
    for (const effect of this.spawnEffects) {
      if (effect.type === 'flash') {
        // Radial flash
        const gradient = ctx.createRadialGradient(
          effect.x, effect.y, 0,
          effect.x, effect.y, effect.radius
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${effect.alpha})`);
        gradient.addColorStop(0.6, `rgba(255, 255, 255, ${effect.alpha * 0.5})`);
        gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (effect.type === 'wave') {
        // Expanding wave ring
        ctx.strokeStyle = `rgba(255, 255, 255, ${effect.alpha * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    
    // Draw fusion effects
    for (const effect of this.fusionEffects) {
      if (effect.type === 'flash') {
        // Radial flash
        const gradient = ctx.createRadialGradient(
          effect.x, effect.y, 0,
          effect.x, effect.y, effect.radius
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${effect.alpha * 0.8})`);
        gradient.addColorStop(0.5, `rgba(255, 255, 200, ${effect.alpha * 0.4})`);
        gradient.addColorStop(1, `rgba(255, 255, 200, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (effect.type === 'ring') {
        // Expanding ring
        ctx.strokeStyle = `rgba(255, 255, 255, ${effect.alpha * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    
    // Draw blurred filaments between particles experiencing interaction forces.
    for (const link of this.forceLinks) {
      const baseRgb = link.isRepelling ? '255, 140, 190' : '130, 190, 255';
      const alpha = 0.12 + link.intensity * 0.28;

      ctx.save();
      ctx.strokeStyle = `rgba(${baseRgb}, ${alpha})`;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = `rgba(${baseRgb}, ${Math.min(0.5, alpha * 1.8)})`;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(link.x1, link.y1);
      ctx.lineTo(link.x2, link.y2);
      ctx.stroke();
      ctx.restore();
    }

    this.renderBindingAgents(ctx);

    // Draw particles with sub-pixel precision and glow
    for (const particle of this.particles) {
      const classification = getTierClassification(particle.tier);
      
      // Enhanced glow for capital and double letter particles
      let glowRadius = particle.radius * 1.5;
      let glowIntensity = 1.0;
      
      if (classification.cycle === 1) {
        // Capital letters: slightly brighter glow
        glowRadius = particle.radius * 2.0;
        glowIntensity = 1.3;
      } else if (classification.cycle >= 2) {
        // Double letters: even brighter glow
        glowRadius = particle.radius * 2.5;
        glowIntensity = 1.6;
      }
      
      // Outer bright glow for higher tiers
      if (classification.cycle >= 1) {
        const brightGlowGradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, glowRadius
        );
        
        const color = particle.color;
        // Extract RGB from the color and brighten it
        const brightColor = this.brightenColor(color, glowIntensity);
        
        brightGlowGradient.addColorStop(0, brightColor);
        brightGlowGradient.addColorStop(0.4, color);
        brightGlowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = brightGlowGradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, glowRadius, 0, Math.PI * 2);
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
      ctx.arc(particle.x, particle.y, particle.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
      
      // Main particle body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
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
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();

      // Render the tier glyph in the particle center to reinforce tier identity.
      if (particle.label) {
        const fontSize = Math.max(particle.radius * 1.1, 10);
        ctx.font = `${fontSize}px 'Times New Roman', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw black outline for visibility
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = Math.max(2, fontSize / 8);
        ctx.strokeText(particle.label, particle.x, particle.y);
        
        // Draw white text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(particle.label, particle.x, particle.y);
      }
    }
  }

  /**
   * Render binding agent anchors, their connections, and any placement preview.
   * @param {CanvasRenderingContext2D} ctx - Active 2D context.
   */
  renderBindingAgents(ctx) {
    const particleMap = new Map(this.particles.map((particle) => [particle.id, particle]));
    const radius = this.getBindingAgentRadius();

    const drawAgent = (agent, { isPreview = false } = {}) => {
      const baseColor = isPreview ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.9)';
      const bondColor = agent.activeMolecules?.length ? 'rgba(255, 215, 130, 0.9)' : 'rgba(180, 200, 255, 0.7)';
      const triangleRadius = radius * 1.5;
      const cornerRadius = radius * 0.55;
      const angleOffset = -Math.PI / 2;
      const corners = [0, 1, 2].map((index) => {
        const theta = angleOffset + (index * (Math.PI * 2)) / 3;
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

      corners.forEach((corner) => {
        const glow = ctx.createRadialGradient(corner.x, corner.y, cornerRadius * 0.2, corner.x, corner.y, cornerRadius);
        glow.addColorStop(0, bondColor);
        glow.addColorStop(1, baseColor);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, cornerRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = bondColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });
      ctx.restore();
    };

    // Preview indicator when the player drags a fresh binding agent.
    if (this.bindingAgentPreview) {
      drawAgent({ ...this.bindingAgentPreview, activeMolecules: [] }, { isPreview: true });
    }

    for (const agent of this.bindingAgents) {
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

        const connectionColor = agent.activeMolecules?.length
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

      drawAgent(agent);
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
    return {
      repellingForceReduction: {
        level: this.upgrades.repellingForceReduction,
        cost: this.getRepellingForceReductionCost(),
        effect: `${this.upgrades.repellingForceReduction * 50}% force reduction`,
        canAfford: this.particleBank >= this.getRepellingForceReductionCost(),
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
      particles: this.particles.map(p => ({
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        tier: p.tier,
      })),
      highestTierReached: this.highestTierReached,
      glyphCount: this.glyphCount,
      particleBank: this.particleBank,
      bindingAgentBank: this.availableBindingAgents,
      bindingAgents: this.bindingAgents.map((agent) => ({
        x: agent.x,
        y: agent.y,
      })),
      discoveredMolecules: Array.from(this.discoveredMoleculeEntries.values()),
      upgrades: {
        repellingForceReduction: this.upgrades.repellingForceReduction,
        startingTier: this.upgrades.startingTier,
      },
      permanentGlyphs: this.permanentGlyphs,
      alephAbsorptionCount: this.alephAbsorptionCount,
    };
  }
  
  /**
   * Import simulation state from save
   */
  importState(state) {
    if (!state) return;
    
    this.particles = [];
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
        
        // Always randomize layout on load so returning players see particles scattered
        // safely away from the edges. Fall back to the saved coordinates only if the
        // canvas has not been sized yet.
        const margin = radius * 2;
        const hasSizedCanvas =
          Number.isFinite(this.width) && this.width > margin * 2 &&
          Number.isFinite(this.height) && this.height > margin * 2;

        let x = Number.isFinite(p.x) ? p.x : margin;
        let y = Number.isFinite(p.y) ? p.y : margin;

        if (hasSizedCanvas) {
          const spawnableWidth = this.width - margin * 2;
          const spawnableHeight = this.height - margin * 2;
          x = margin + Math.random() * spawnableWidth;
          y = margin + Math.random() * spawnableHeight;
        }
        
        this.particles.push({
          x,
          y,
          vx: 0, // Reset velocity so returning particles start from rest
          vy: 0,
          radius,
          tier: p.tier,
          color: tierToColor(p.tier, this.samplePaletteGradient),
          label: tierInfo.letter,
          id: Math.random(),
          repellingForce,
          speedMultiplier,
        });
      }
    }
    
    if (typeof state.highestTierReached === 'number') {
      this.highestTierReached = state.highestTierReached;
    }

    if (typeof state.glyphCount === 'number') {
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
          id: Math.random(),
          x: agent.x,
          y: agent.y,
          connections: [],
          activeMolecules: [],
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
    }
    
    if (Array.isArray(state.permanentGlyphs)) {
      this.permanentGlyphs = state.permanentGlyphs;
    }
    
    if (typeof state.alephAbsorptionCount === 'number') {
      this.alephAbsorptionCount = state.alephAbsorptionCount;
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
 * Retrieve metadata for the provided tier with support for null, lowercase, capital, double, and aleph.
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
      displayName: 'Null – Tier -1',
    };
  }
  
  // Handle aleph particle (after omega omega)
  const alephTier = GREEK_SEQUENCE_LENGTH * 2; // 48 for 24 Greek letters
  if (safeTier >= alephTier) {
    return {
      name: 'Aleph',
      letter: 'ℵ', // Aleph symbol
      displayName: 'Aleph – Final Tier',
    };
  }
  
  const classification = getTierClassification(safeTier);
  const greekIndex = classification.greekIndex;
  const cycle = classification.cycle;
  const baseInfo = GREEK_TIER_SEQUENCE[greekIndex];
  
  let name, letter, displayName;
  
  if (cycle === 0) {
    // Lowercase Greek letters (tiers 0-23)
    name = baseInfo.name;
    letter = baseInfo.letter;
    displayName = `${name} (${letter}) – Tier ${safeTier}`;
  } else if (cycle === 1) {
    // Capital Greek letters (tiers 24-47)
    name = `Capital ${baseInfo.name}`;
    letter = baseInfo.capital;
    displayName = `${name} (${letter}) – Tier ${safeTier}`;
  } else {
    // Double letters: Alpha Alpha, Alpha Beta, etc. (tiers 48+)
    const firstLetterIndex = Math.floor((safeTier - alephTier) / GREEK_SEQUENCE_LENGTH);
    const secondLetterIndex = (safeTier - alephTier) % GREEK_SEQUENCE_LENGTH;
    const firstName = GREEK_TIER_SEQUENCE[firstLetterIndex]?.name || 'Alpha';
    const secondName = GREEK_TIER_SEQUENCE[secondLetterIndex]?.name || 'Alpha';
    const firstLetter = GREEK_TIER_SEQUENCE[firstLetterIndex]?.letter || 'α';
    const secondLetter = GREEK_TIER_SEQUENCE[secondLetterIndex]?.letter || 'α';
    
    name = `${firstName} ${secondName}`;
    letter = `${firstLetter}${secondLetter}`;
    displayName = `${name} (${letter}) – Tier ${safeTier}`;
  }
  
  return { name, letter, displayName };
}

// Export helper utilities for external use
export { tierToColor, getGreekTierInfo };
