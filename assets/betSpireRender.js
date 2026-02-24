// Bet Spire Particle Physics Render
// Tiered particle system with size merging at generator centers and tier conversion at the forge.

// All constants, data tables, and utility functions live in the companion config module.
import {
  TWO_PI,
  QUARTER_PI,
  PI_OVER_SIX,
  HALF,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TRAIL_FADE,
  SIZE_MULTIPLIER,
  EXTRA_LARGE_SIZE_BONUS,
  ORBITAL_FORCE,
  ORBITAL_RADIUS_MULTIPLIER,
  FORGE_REPULSION_DAMPING,
  FORGE_ROTATION_SPEED,
  SPAWNER_GRAVITY_RANGE_MULTIPLIER,
  GENERATOR_CONVERSION_RADIUS,
  MAX_PARTICLES,
  PERFORMANCE_THRESHOLD,
  MAX_FRAME_TIME_MS,
  TARGET_FRAME_TIME_MS,
  PERF_WARN_MIN_PARTICLES,
  PERF_WARN_COOLDOWN_MS,
  INTERACTION_RADIUS,
  INTERACTION_FADE_DURATION,
  DRAG_RELEASE_STILLNESS_MS,
  DRAG_RELEASE_SPEED_THRESHOLD,
  MERGE_GATHER_THRESHOLD,
  MERGE_TIMEOUT_MS,
  SHOCKWAVE_SPEED,
  SHOCKWAVE_MAX_RADIUS,
  SHOCKWAVE_DURATION,
  SHOCKWAVE_PUSH_FORCE,
  SHOCKWAVE_EDGE_THICKNESS,
  FORGE_POSITION,
  SPAWNER_SIZE,
  SPAWNER_ROTATION_SPEED,
  SPAWNER_COLOR_BRIGHTNESS_OFFSET,
  SPAWNER_GRAVITY_RADIUS,
  GENERATOR_SPRITE_SCALE,
  SPAWNER_SPRITE_SIZE,
  createTintedSpriteCanvas,
  GENERATOR_CIRCLE_RADIUS,
  SPAWNER_POSITIONS,
  PARTICLE_TIERS,
  SIZE_TIERS,
  SMALL_SIZE_INDEX,
  MEDIUM_SIZE_INDEX,
  LARGE_SIZE_INDEX,
  EXTRA_LARGE_SIZE_INDEX,
  MERGE_THRESHOLD,
  CONVERSION_SPREAD_VELOCITY,
} from './betSpireConfig.js';
// Particle physics class lives in its own module so betSpireRender.js stays focused on the render system.
import { Particle } from './betSpireParticle.js';
// Forge crunch state management and rendering live in their own module.
import {
  checkForgeCreunch as betCheckForgeCreunch,
  startForgeCrunch as betStartForgeCrunch,
  updateForgeCrunch as betUpdateForgeCrunch,
  getForgeRotationSpeedMultiplier as betGetForgeRotationSpeedMultiplier,
  getSmallEquivalentForSize as betGetSmallEquivalentForSize,
  completeForgeCrunch as betCompleteForgeCrunch,
  drawForgeCrunch as betDrawForgeCrunch,
  drawCrunchGemAwards as betDrawCrunchGemAwards,
  drawForge as betDrawForge,
  drawForgeInfluenceRing as betDrawForgeInfluenceRing,
} from './betSpireForgeSystem.js';
// Input and event handling live in their own module to keep BetSpireRender focused on the render system.
import {
  setupEventListeners as betInputSetupEventListeners,
  removeEventListeners as betInputRemoveEventListeners,
  getCanvasCoordinates as betInputGetCanvasCoordinates,
  spawnSandParticleAtEdge as betInputSpawnSandParticleAtEdge,
  handlePointerDown as betInputHandlePointerDown,
  handlePointerMove as betInputHandlePointerMove,
  handlePointerUp as betInputHandlePointerUp,
} from './betSpireInputSystem.js';
// Main animation loop and draw helpers live in their own module for readability.
import {
  animate as betDrawAnimate,
  drawBatchedParticles as betDrawBatchedParticles,
  cacheGeneratorSpritesForTier as betDrawCacheGeneratorSpritesForTier,
  drawSpawners as betDrawDrawSpawners,
} from './betSpireDrawSystem.js';

// Main render system
export class BetSpireRender {
  constructor(canvas, state = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
    this.particles = [];
    this.forge = FORGE_POSITION;
    this.forgeRotation = 0; // Rotation angle for forge triangles
    this.animationId = null;
    this.isRunning = false;
    this.lastFrameTime = performance.now(); // Anchor delta time so physics stays frame-rate independent
    
    // Particle inventory: tracks count by tier (sum of all sizes)
    this.inventory = new Map();
    PARTICLE_TIERS.forEach(tier => {
      this.inventory.set(tier.id, 0);
    });
    
    // Track which particle tiers have been unlocked (spawners appear when unlocked)
    this.unlockedTiers = new Set(['sand']); // Sand is always unlocked
    
    // Spawner rotation tracking
    this.spawnerRotations = new Map();

    // Initialize rotation entries for any tiers that start unlocked so their forge triangles counter-rotate immediately.
    this.unlockedTiers.forEach((tierId) => {
      this.spawnerRotations.set(tierId, Math.random() * TWO_PI); // Use pre-calculated constant
    });
    
    // Track generator fade-in animations (tierId -> {startTime, duration})
    this.generatorFadeIns = new Map();
    const GENERATOR_FADE_IN_DURATION = 2000; // 2 seconds fade-in
    this.GENERATOR_FADE_IN_DURATION = GENERATOR_FADE_IN_DURATION;
    
    // Particle Factor tracking for BET glyph awards - load from state or use defaults
    this.particleFactorMilestone = Number.isFinite(state.particleFactorMilestone) 
      ? state.particleFactorMilestone 
      : 100; // Start at 100, then 10,000, 1,000,000, etc.
    this.betGlyphsAwarded = Number.isFinite(state.betGlyphsAwarded)
      ? state.betGlyphsAwarded
      : 0;
    // Track the exponent bonus granted by nullstone crunches so particle factor scales upward over time.
    this.particleFactorExponentBonus = Number.isFinite(state.particleFactorExponentBonus)
      ? state.particleFactorExponentBonus
      : 0;

    // Keep manual interactions enabled for particle gathering visuals while blocking manual spawning.
    this.interactionsEnabled = true;
    
    // Visual settings that control rendering effects
    this.particleTrailsEnabled = true; // Controls whether particles leave trails
    this.forgeGlowEnabled = true; // Controls whether forge and generators have glow effects
    this.smoothRenderingEnabled = true; // Controls whether rendering is smooth (anti-aliased) or pixelated
    this.particleVeerEnabled = true; // Developer toggle for subtle randomized particle veer behavior
    this.smallTierGeneratorGravityEnabled = true; // Developer toggle for extra small particle pull toward generators.
    this.mediumTierForgeGravityEnabled = true; // Developer toggle for extra medium particle pull toward the forge.

    // Load the center forge sprites so the counter-rotating triangles use the authored artwork.
    this.forgeSpriteClockwise = new Image();
    this.forgeSpriteClockwise.src = './assets/sprites/spires/betSpire/forge.png';
    this.forgeSpriteCounterClockwise = new Image();
    this.forgeSpriteCounterClockwise.src = './assets/sprites/spires/betSpire/forge2.png';

    // Cache tinted generator sprites so we only colorize them once per tier.
    this.generatorSpriteCache = new Map();
    this.generatorSpriteSources = new Map();
    // Load generator sprite sources for each tier so they can be tinted and cached on load.
    PARTICLE_TIERS.forEach((tier, index) => {
      const sprite = new Image();
      sprite.src = `./assets/sprites/spires/betSpire/generators/tier${index + 1}.svg`;
      sprite.onload = () => {
        this.cacheGeneratorSpritesForTier(tier.id, sprite);
      };
      this.generatorSpriteSources.set(tier.id, sprite);
    });
    
    // Developer debug flags (only visible when developer mode is active)
    this.particleSpawningEnabled = true; // Controls whether particles can spawn
    this.particleMergingEnabled = true; // Controls whether particles can merge (size increases)
    this.particlePromotionEnabled = true; // Controls whether particles can promote to higher tier
    this.mergeShockwavesEnabled = false; // Controls whether merge shockwaves push nearby particles.
    
    // Store state reference for persistence
    this.state = state;
    
    // Mouse/touch interaction state
    this.isInteracting = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.interactionCircles = []; // Array of {x, y, radius, alpha, timestamp}
    this.lastPointerMoveTime = 0; // Timestamp of the last pointer movement for drag-release velocity checks.
    this.lastPointerPosition = null; // Tracks the last pointer coordinates for drag-release velocity checks.
    this.lastPointerSpeed = 0; // Cached pointer speed for drag-release velocity checks.
    
    // Merge animation state
    this.activeMerges = []; // Array of {particles, targetX, targetY, tierId, sizeIndex, startTime}
    this.shockwaves = []; // Array of {x, y, radius, alpha, timestamp, color}
    
    // Spawn queue for gradual particle restoration on load
    this.spawnQueue = [];
    this.spawnQueueIndex = 0;

    // Track frame progression so merge attempts can throttle themselves between frames.
    this.frameCounter = 0;
    this.mergeCooldownFrames = 0; // Prevents back-to-back merge launches in the same frame
    this.lastPerformanceWarningAt = 0; // Timestamp used to throttle expensive-frame console warnings.
    
    // Forge crunch effect state
    this.forgeValidParticlesTimer = null; // Timestamp when valid particles first entered forge
    this.forgeCrunchActive = false; // Whether crunch animation is active
    this.forgeCrunchProgress = 0; // Progress of crunch animation (0 to 1)
    this.forgeCrunchStartTime = null; // When crunch animation started
    this.forgeCrunchEndTime = null; // When crunch animation ended
    const FORGE_CRUNCH_DURATION = 1000; // Duration of crunch animation in ms
    const FORGE_VALID_WAIT_TIME = 5000; // Wait 5 seconds before crunching
    const FORGE_SPIN_UP_DURATION = 4000; // 4 seconds to spin up before crunch
    const FORGE_SPIN_DOWN_DURATION = 3000; // 3 seconds to slow down after crunch
    this.FORGE_CRUNCH_DURATION = FORGE_CRUNCH_DURATION;
    this.FORGE_VALID_WAIT_TIME = FORGE_VALID_WAIT_TIME;
    this.FORGE_SPIN_UP_DURATION = FORGE_SPIN_UP_DURATION;
    this.FORGE_SPIN_DOWN_DURATION = FORGE_SPIN_DOWN_DURATION;
    
    // Track gems awarded from forge crunches for floating feedback display
    this.crunchGemAwards = []; // Array of {tierId, count, startTime}
    
    // Bind methods for requestAnimationFrame and event listeners
    this.animate = this.animate.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    
    // Set canvas dimensions
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;

    // Initialize with black background
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Restore particles from saved state if available
    if (state.particlesByTierAndSize) {
      this.restoreParticleState(state.particlesByTierAndSize);
    } else {
      // Seed the simulation with a level 1 sand generator so it begins active without user input.
      this.addParticle('sand', SMALL_SIZE_INDEX);
    }

    // Set up event listeners
    this.setupEventListeners();
  }

  addParticle(tierId, sizeIndex) {
    // Skip spawning if disabled via developer controls
    if (!this.particleSpawningEnabled) {
      return;
    }
    
    // Enforce maximum particle limit to prevent freezing
    if (this.particles.length >= MAX_PARTICLES) {
      // Try to consolidate particles instead of adding new ones
      this.enforceParticleLimit();
      // If still at limit after consolidation, don't add
      if (this.particles.length >= MAX_PARTICLES) {
        return;
      }
    }
    
    // Get the generator position for this tier
    const tierIndex = PARTICLE_TIERS.findIndex(t => t.id === tierId);
    const spawnPosition = tierIndex >= 0 && tierIndex < SPAWNER_POSITIONS.length 
      ? SPAWNER_POSITIONS[tierIndex] 
      : null;
    
    const particle = new Particle(tierId, sizeIndex, spawnPosition);
    this.particles.push(particle);
    
    // Unlock the tier if it hasn't been unlocked yet
    if (!this.unlockedTiers.has(tierId)) {
      this.unlockedTiers.add(tierId);
      
      // Initialize rotation for the spawner
      if (!this.spawnerRotations.has(tierId)) {
        this.spawnerRotations.set(tierId, Math.random() * TWO_PI); // Use pre-calculated constant
      }
      
      // Start fade-in animation for the newly unlocked generator
      this.generatorFadeIns.set(tierId, {
        startTime: Date.now(),
        duration: this.GENERATOR_FADE_IN_DURATION
      });
    }
    
    this.updateInventory();
  }

  // Optional skipInventoryUpdate flag lets batch operations defer expensive recounts until they finish.
  removeParticle(particle, skipInventoryUpdate = false) {
    const index = this.particles.indexOf(particle);
    if (index !== -1) {
      this.particles.splice(index, 1);
      if (!skipInventoryUpdate) {
        this.updateInventory();
      }
    }
  }

  /**
   * Remove a specific number of particles of a given tier.
   * Removes small particles first, then converts medium/large/extra-large if needed.
   * Returns the number of particles actually removed (in small equivalent units).
   */
  removeParticlesByType(tierId, count) {
    let remaining = count;
    const particlesToRemove = new Set();
    
    // First, remove small particles.
    const smallParticles = this.particles.filter(p => p.tierId === tierId && p.sizeIndex === SMALL_SIZE_INDEX);
    const smallToRemove = Math.min(smallParticles.length, remaining);
    for (let i = 0; i < smallToRemove; i++) {
      particlesToRemove.add(smallParticles[i]);
    }
    remaining -= smallToRemove;
    
    // If we need more, convert medium particles (1 medium = 100 small).
    if (remaining > 0) {
      const mediumParticles = this.particles.filter(p => p.tierId === tierId && p.sizeIndex === MEDIUM_SIZE_INDEX);
      while (remaining > 0 && mediumParticles.length > 0) {
        const mediumParticle = mediumParticles.pop();
        particlesToRemove.add(mediumParticle);
        
        // Add back small particles if we removed more than needed
        const mediumValue = MERGE_THRESHOLD; // 100 small
        if (remaining < mediumValue) {
          const changeBack = mediumValue - remaining;
          for (let i = 0; i < changeBack; i++) {
            this.addParticle(tierId, SMALL_SIZE_INDEX);
          }
          remaining = 0;
        } else {
          remaining -= mediumValue;
        }
      }
    }
    
    // If we still need more, convert large particles (1 large = 10000 small).
    if (remaining > 0) {
      const largeParticles = this.particles.filter(p => p.tierId === tierId && p.sizeIndex === LARGE_SIZE_INDEX);
      while (remaining > 0 && largeParticles.length > 0) {
        const largeParticle = largeParticles.pop();
        particlesToRemove.add(largeParticle);
        
        // Add back particles if we removed more than needed
        const largeValue = Math.pow(MERGE_THRESHOLD, 2); // 10000 small
        if (remaining < largeValue) {
          const changeBack = largeValue - remaining;
          // Add back as medium and small particles
          const mediumsToAdd = Math.floor(changeBack / MERGE_THRESHOLD);
          const smallsToAdd = changeBack % MERGE_THRESHOLD;
          for (let i = 0; i < mediumsToAdd; i++) {
            this.addParticle(tierId, MEDIUM_SIZE_INDEX);
          }
          for (let i = 0; i < smallsToAdd; i++) {
            this.addParticle(tierId, SMALL_SIZE_INDEX);
          }
          remaining = 0;
        } else {
          remaining -= largeValue;
        }
      }
    }

    // If we still need more, convert extra-large particles (1 extra-large = 1,000,000 small).
    if (remaining > 0) {
      const extraLargeParticles = this.particles.filter(p => p.tierId === tierId && p.sizeIndex === EXTRA_LARGE_SIZE_INDEX);
      while (remaining > 0 && extraLargeParticles.length > 0) {
        const extraLargeParticle = extraLargeParticles.pop();
        particlesToRemove.add(extraLargeParticle);

        // Add back particles if we removed more than needed.
        const extraLargeValue = Math.pow(MERGE_THRESHOLD, 3); // 1,000,000 small
        if (remaining < extraLargeValue) {
          const changeBack = extraLargeValue - remaining;
          // Add back as large, medium, and small particles.
          const largesToAdd = Math.floor(changeBack / Math.pow(MERGE_THRESHOLD, 2));
          const remainingAfterLarge = changeBack - (largesToAdd * Math.pow(MERGE_THRESHOLD, 2));
          const mediumsToAdd = Math.floor(remainingAfterLarge / MERGE_THRESHOLD);
          const smallsToAdd = remainingAfterLarge - (mediumsToAdd * MERGE_THRESHOLD);
          for (let i = 0; i < largesToAdd; i++) {
            this.addParticle(tierId, LARGE_SIZE_INDEX);
          }
          for (let i = 0; i < mediumsToAdd; i++) {
            this.addParticle(tierId, MEDIUM_SIZE_INDEX);
          }
          for (let i = 0; i < smallsToAdd; i++) {
            this.addParticle(tierId, SMALL_SIZE_INDEX);
          }
          remaining = 0;
        } else {
          remaining -= extraLargeValue;
        }
      }
    }
    
    // Batch remove all marked particles (O(n) instead of O(n²))
    if (particlesToRemove.size > 0) {
      this.particles = this.particles.filter(p => !particlesToRemove.has(p));
    }
    
    this.updateInventory();
    return count - remaining; // Return how many we actually removed
  }

  updateInventory() {
    // Clear inventory
    this.inventory.forEach((_, key) => {
      this.inventory.set(key, 0);
    });
    
    // Count particles by tier (combining all sizes using conversion rules).
    this.particles.forEach(particle => {
      const tierId = particle.tierId;
      const sizeIndex = particle.sizeIndex;
      
      // Convert to small particle equivalent.
      // 1 medium = 100 small, 1 large = 10,000 small, 1 extra-large = 1,000,000 small.
      const smallEquivalent = Math.pow(MERGE_THRESHOLD, sizeIndex);
      const currentCount = this.inventory.get(tierId) || 0;
      this.inventory.set(tierId, currentCount + smallEquivalent);
    });
  }

  // Determine whether a new merge can begin without violating the one-at-a-time rule.
  canStartNewMerge() {
    return this.activeMerges.length === 0 && this.mergeCooldownFrames === 0;
  }

  // Select a random subset of particles without mutating the source collection.
  selectRandomParticles(group, count) {
    const pool = group.slice();
    const selected = [];
    const targetCount = Math.min(count, pool.length);

    for (let i = 0; i < targetCount; i++) {
      const index = Math.floor(Math.random() * pool.length);
      selected.push(pool[index]);
      pool.splice(index, 1);
    }

    return selected;
  }

  // Resolve the generator center position for a given particle tier.
  getGeneratorCenterForTier(tierId) {
    const tierIndex = PARTICLE_TIERS.findIndex(tier => tier.id === tierId);
    if (tierIndex < 0 || tierIndex >= SPAWNER_POSITIONS.length) {
      return null;
    }
    return SPAWNER_POSITIONS[tierIndex];
  }

  /**
   * Enforce particle limit by aggressively merging small particles when count is too high.
   * This prevents freezing when there are too many particles.
   */
  enforceParticleLimit() {
    // If under threshold, no action needed
    if (this.particles.length < PERFORMANCE_THRESHOLD) {
      return;
    }

    // Group small particles by tier, only if they are in the generator center.
    const smallParticlesByTier = new Map();
    
    this.particles.forEach(particle => {
      if (particle.sizeIndex === SMALL_SIZE_INDEX && !particle.merging) {
        const generatorCenter = this.getGeneratorCenterForTier(particle.tierId);
        if (!generatorCenter) {
          return;
        }
        const dx = particle.x - generatorCenter.x;
        const dy = particle.y - generatorCenter.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > GENERATOR_CONVERSION_RADIUS * GENERATOR_CONVERSION_RADIUS) {
          return;
        }
        const tierId = particle.tierId;
        if (!smallParticlesByTier.has(tierId)) {
          smallParticlesByTier.set(tierId, []);
        }
        smallParticlesByTier.get(tierId).push(particle);
      }
    });

    // Collect all particles to remove for efficient batch removal
    const particlesToRemove = new Set();

    // Aggressively merge small particles in groups of MERGE_THRESHOLD
    smallParticlesByTier.forEach((group, tierId) => {
      while (group.length >= MERGE_THRESHOLD && this.particles.length > PERFORMANCE_THRESHOLD) {
        // Take MERGE_THRESHOLD particles and convert them instantly to one medium particle
        const particlesToMerge = group.splice(0, MERGE_THRESHOLD);
        
        // Use generator center so size merges only happen at the generator core.
        const generatorCenter = this.getGeneratorCenterForTier(tierId);
        if (!generatorCenter) {
          return;
        }
        
        // Mark particles for batch removal
        particlesToMerge.forEach(p => {
          particlesToRemove.add(p);
        });
        
        // Create one medium particle instantly (no animation)
        const tierIndex = PARTICLE_TIERS.findIndex(t => t.id === tierId);
        const spawnPos = tierIndex >= 0 && tierIndex < SPAWNER_POSITIONS.length 
          ? SPAWNER_POSITIONS[tierIndex] 
          : null;
        
        const mediumParticle = new Particle(tierId, MEDIUM_SIZE_INDEX, spawnPos);
        mediumParticle.x = generatorCenter.x;
        mediumParticle.y = generatorCenter.y;
        this.particles.push(mediumParticle);
      }
    });

    // Batch remove all marked particles (O(n) instead of O(n²))
    if (particlesToRemove.size > 0) {
      this.particles = this.particles.filter(p => !particlesToRemove.has(p));
    }

    this.updateInventory();
  }

  // Attempt to merge particles of the same tier and size (100 small → 1 medium, 100 medium → 1 large, 100 large → 1 extra-large)
  // This can happen anywhere on the screen
  attemptMerge() {
    // Skip merging if disabled via developer controls
    if (!this.particleMergingEnabled || !this.canStartNewMerge()) {
      return;
    }

    const particlesByTierAndSize = new Map();

    // Group particles by tier and size, but only when they are within generator centers.
    this.particles.forEach(particle => {
      // Skip particles that are already merging
      if (particle.merging) return;

      // Require the particle to be close to its generator center before merging.
      const generatorCenter = this.getGeneratorCenterForTier(particle.tierId);
      if (!generatorCenter) {
        return;
      }
      const dx = particle.x - generatorCenter.x;
      const dy = particle.y - generatorCenter.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > GENERATOR_CONVERSION_RADIUS * GENERATOR_CONVERSION_RADIUS) {
        return;
      }
      
      const key = `${particle.tierId}-${particle.sizeIndex}`;
      if (!particlesByTierAndSize.has(key)) {
        particlesByTierAndSize.set(key, []);
      }
      particlesByTierAndSize.get(key).push(particle);
    });

    // Identify all eligible merge candidates so one can be chosen at random.
    const mergeCandidates = [];

    // Check each group for merging
    particlesByTierAndSize.forEach((group, key) => {
      if (group.length >= MERGE_THRESHOLD) {
        const [tierId, sizeIndexStr] = key.split('-');
        const sizeIndex = parseInt(sizeIndexStr, 10);

        // Can only merge if not already at max size
        if (sizeIndex < SIZE_TIERS.length - 1) {
          mergeCandidates.push({ tierId, sizeIndex, group });
        }
      }
    });

    if (mergeCandidates.length === 0) {
      return;
    }

    // Pick one candidate group and one random batch within that group to merge this frame.
    const selectedCandidate = mergeCandidates[Math.floor(Math.random() * mergeCandidates.length)];
    const particlesToMerge = this.selectRandomParticles(selectedCandidate.group, MERGE_THRESHOLD);

    // Use the generator center so size merges happen at the generator core.
    const generatorCenter = this.getGeneratorCenterForTier(selectedCandidate.tierId);
    if (!generatorCenter) {
      return;
    }

    // Mark particles as merging and set their target
    particlesToMerge.forEach(p => {
      p.merging = true;
      p.mergeTarget = { x: generatorCenter.x, y: generatorCenter.y };
    });

    // Create a merge animation entry
    this.activeMerges.push({
      particles: particlesToMerge,
      targetX: generatorCenter.x,
      targetY: generatorCenter.y,
      tierId: selectedCandidate.tierId,
      sizeIndex: selectedCandidate.sizeIndex + 1, // Next size tier
      startTime: Date.now()
      // No isTierConversion flag means this is a size merge
    });
  }

  // Attempt to convert extra-large particles to two tiers up at the forge (center).
  // Forge promotions now yield 1 large particle two tiers higher.
  attemptTierConversion() {
    // Skip tier conversion if disabled via developer controls
    if (!this.particlePromotionEnabled || !this.canStartNewMerge()) {
      return;
    }

    // Only allow forge promotions during an active crunch effect so tiers advance on crunches only.
    if (!this.forgeCrunchActive) {
      return;
    }

    const conversionCandidates = [];

    // Group particles by their tier, checking if they're at the forge (center) position.
    PARTICLE_TIERS.forEach((tier, tierIndex) => {
      // Can't convert the last two tiers when we need a two-tier jump.
      if (tierIndex >= PARTICLE_TIERS.length - 2) return;

      // Select the tier two steps above the current tier for forge promotions.
      const nextTier = PARTICLE_TIERS[tierIndex + 2];

      this.particles.forEach(particle => {
        if (particle.tierId !== tier.id || particle.merging) return;

        // Check if particle is within conversion radius of the forge (center)
        const dx = particle.x - this.forge.x;
        const dy = particle.y - this.forge.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= GENERATOR_CONVERSION_RADIUS) {
          if (particle.sizeIndex === EXTRA_LARGE_SIZE_INDEX) {
            // Always convert into a single large particle for the two-tier forge jump.
            const conversionCount = 1;
            conversionCandidates.push({
              particle,
              nextTierId: nextTier.id,
              conversionCount,
            });
          }
        }
      });
    });

    if (conversionCandidates.length === 0) {
      return;
    }

    // Convert a single candidate so forge promotions also respect the one-at-a-time merge pacing.
    const selectedConversion = conversionCandidates[Math.floor(Math.random() * conversionCandidates.length)];
    const particle = selectedConversion.particle;

    // Mark as merging and attract to forge center
    particle.merging = true;
    particle.mergeTarget = { x: this.forge.x, y: this.forge.y };

    // Create conversion animation
    this.activeMerges.push({
      particles: [particle],
      targetX: this.forge.x,
      targetY: this.forge.y,
      tierId: selectedConversion.nextTierId,
      sizeIndex: LARGE_SIZE_INDEX, // Large particle output for forge jumps.
      startTime: Date.now(),
      isTierConversion: true,
      conversionCount: selectedConversion.conversionCount
    });
  }

  // Check for valid particles in the forge and handle crunch effect
  checkForgeCreunch(now) { return betCheckForgeCreunch.call(this, now); }

  // Start the forge crunch animation and mark particles for upgrade
  startForgeCrunch(validParticles, now) { return betStartForgeCrunch.call(this, validParticles, now); }

  // Update the forge crunch animation
  updateForgeCrunch(now) { return betUpdateForgeCrunch.call(this, now); }

  // Scale the forge spin speed multiplier across spin-up, crunch, and spin-down phases
  getForgeRotationSpeedMultiplier(now) { return betGetForgeRotationSpeedMultiplier.call(this, now); }

  // Translate a particle size into its small-equivalent count for nullstone crunch rewards
  getSmallEquivalentForSize(sizeIndex) { return betGetSmallEquivalentForSize.call(this, sizeIndex); }

  // Complete the forge crunch and upgrade particles
  completeForgeCrunch() { return betCompleteForgeCrunch.call(this); }

  // Draw the forge crunch effect (shrinking circle)
  drawForgeCrunch() { return betDrawForgeCrunch.call(this); }

  // Draw floating gem award notifications in top-left corner
  drawCrunchGemAwards(now) { return betDrawCrunchGemAwards.call(this, now); }

  // Attempt to merge large particles to next tier (performance optimization)
  // When 100 large particles of the same tier exist, convert them to 10 large particles of the next tier
  // This can happen anywhere on the screen to reduce particle count for better performance
  attemptLargeTierMerge() {
    // Skip tier merging if promotion is disabled via developer controls
    if (!this.particlePromotionEnabled || !this.canStartNewMerge()) {
      return;
    }

    const largeParticlesByTier = new Map();

    // Group large particles by tier anywhere on screen
    this.particles.forEach(particle => {
      // Skip particles that are already merging
      if (particle.merging) return;
      
      // Only consider large particles
      if (particle.sizeIndex !== LARGE_SIZE_INDEX) return;
      
      const tierId = particle.tierId;
      if (!largeParticlesByTier.has(tierId)) {
        largeParticlesByTier.set(tierId, []);
      }
      largeParticlesByTier.get(tierId).push(particle);
    });

    const mergeCandidates = [];

    // Check each tier group for bulk conversion and queue up potential merges.
    largeParticlesByTier.forEach((group, tierId) => {
      if (group.length >= MERGE_THRESHOLD) {
        const tierIndex = PARTICLE_TIERS.findIndex(t => t.id === tierId);

        // Can only convert if not already at max tier
        if (tierIndex >= 0 && tierIndex < PARTICLE_TIERS.length - 1) {
          const nextTier = PARTICLE_TIERS[tierIndex + 1];
          mergeCandidates.push({ group, nextTier });
        }
      }
    });

    if (mergeCandidates.length === 0) {
      return;
    }

    // Select one candidate to process this frame so large-tier merges remain serialized.
    const selectedCandidate = mergeCandidates[Math.floor(Math.random() * mergeCandidates.length)];
    const particlesToMerge = this.selectRandomParticles(selectedCandidate.group, MERGE_THRESHOLD);

    // Calculate center point of the particles to merge
    let centerX = 0;
    let centerY = 0;

    particlesToMerge.forEach(p => {
      centerX += p.x;
      centerY += p.y;
    });
    centerX /= particlesToMerge.length;
    centerY /= particlesToMerge.length;

    // Mark particles as merging and set their target
    particlesToMerge.forEach(p => {
      p.merging = true;
      p.mergeTarget = { x: centerX, y: centerY };
    });

    // Create a merge animation entry that converts 100 large to 10 large of next tier
    this.activeMerges.push({
      particles: particlesToMerge,
      targetX: centerX,
      targetY: centerY,
      tierId: selectedCandidate.nextTier.id,
      sizeIndex: LARGE_SIZE_INDEX, // Large particles
      startTime: Date.now(),
      isTierConversion: true,
      conversionCount: 10 // 10 large particles of next tier
    });
  }

  // Process active merges and check if particles have gathered
  processActiveMerges() {
    const now = Date.now();
    let anyMergeCompleted = false; // Track if any merge completed to defer inventory update
    const particlesToRemove = new Set(); // Collect all particles to remove for efficient batch removal
    
    this.activeMerges = this.activeMerges.filter(merge => {
      // Check if all particles in the merge have reached the target
      const allGathered = merge.particles.every(p => {
        const dx = p.x - merge.targetX;
        const dy = p.y - merge.targetY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < MERGE_GATHER_THRESHOLD;
      });
      
      if (allGathered || (now - merge.startTime > MERGE_TIMEOUT_MS)) { // Complete after timeout
        // Mark particles for batch removal (much more efficient than removing one by one)
        merge.particles.forEach(p => {
          particlesToRemove.add(p);
        });
        
        // Calculate spawn position once (used by both size merges and tier conversions)
        const tierIndex = PARTICLE_TIERS.findIndex(t => t.id === merge.tierId);
        const spawnPos = tierIndex >= 0 && tierIndex < SPAWNER_POSITIONS.length 
          ? SPAWNER_POSITIONS[tierIndex] 
          : null;
        
        // Handle tier conversion differently from size merges
        if (merge.isTierConversion) {
          // Tier conversion: create particles of next tier
          const conversionCount = merge.conversionCount || 1;
          
          // Performance optimization: If we're at high particle count, directly create
          // medium particles instead of 100 small ones
          if (this.particles.length > PERFORMANCE_THRESHOLD && conversionCount === 100) {
            // Create 1 medium particle instead of 100 small particles
            const newParticle = new Particle(merge.tierId, MEDIUM_SIZE_INDEX, spawnPos);
            newParticle.x = merge.targetX;
            newParticle.y = merge.targetY;
            // Add slight random velocity
            newParticle.vx = (Math.random() - 0.5) * CONVERSION_SPREAD_VELOCITY;
            newParticle.vy = (Math.random() - 0.5) * CONVERSION_SPREAD_VELOCITY;
            this.particles.push(newParticle);
          } else {
            // Normal behavior: create multiple particles with spread
            // Limit creation if approaching MAX_PARTICLES
            const maxToCreate = Math.min(conversionCount, MAX_PARTICLES - this.particles.length);
            
            for (let i = 0; i < maxToCreate; i++) {
              const newParticle = new Particle(merge.tierId, merge.sizeIndex, spawnPos);
              newParticle.x = merge.targetX;
              newParticle.y = merge.targetY;
              // Add slight random velocity to spread out converted particles
              newParticle.vx = (Math.random() - 0.5) * CONVERSION_SPREAD_VELOCITY;
              newParticle.vy = (Math.random() - 0.5) * CONVERSION_SPREAD_VELOCITY;
              this.particles.push(newParticle);
            }
          }
        } else {
          // Size merge: create one particle of next size
          const newParticle = new Particle(merge.tierId, merge.sizeIndex, spawnPos);
          newParticle.x = merge.targetX;
          newParticle.y = merge.targetY;
          this.particles.push(newParticle);
        }
        
        // Unlock the tier if needed
        if (!this.unlockedTiers.has(merge.tierId)) {
          this.unlockedTiers.add(merge.tierId);
          if (!this.spawnerRotations.has(merge.tierId)) {
            this.spawnerRotations.set(merge.tierId, Math.random() * TWO_PI); // Use pre-calculated constant
          }
          
          // Start fade-in animation for the newly unlocked generator
          this.generatorFadeIns.set(merge.tierId, {
            startTime: Date.now(),
            duration: this.GENERATOR_FADE_IN_DURATION
          });
        }
        
        // Mark that a merge completed (defer inventory update until after all merges processed)
        anyMergeCompleted = true;
        
        // Create shockwave for size merges (not for tier conversions)
        // Tier conversions use the "crunch" effect instead
        const tier = PARTICLE_TIERS.find(t => t.id === merge.tierId) || PARTICLE_TIERS[0];
        const isSizeMerge = !merge.isTierConversion;
        if (this.mergeShockwavesEnabled && isSizeMerge) {
          // Emit a shockwave ring for all size merges (small->medium and medium->large)
          this.shockwaves.push({
            x: merge.targetX,
            y: merge.targetY,
            radius: 0,
            alpha: 0.8,
            timestamp: now,
            color: tier.color
          });
        }
        
        // This merge is complete
        return false;
      }
      
      // Keep this merge active
      return true;
    });

    // Batch remove all particles marked for removal (O(n) instead of O(n²))
    if (particlesToRemove.size > 0) {
      this.particles = this.particles.filter(p => !particlesToRemove.has(p));
    }

    // Update inventory once after processing all merges (performance optimization)
    if (anyMergeCompleted) {
      // Enforce a one-frame delay before the next merge begins to keep animations serialized.
      this.mergeCooldownFrames = Math.max(this.mergeCooldownFrames, 1);
      this.updateInventory();
    }
  }

  setupEventListeners() { return betInputSetupEventListeners.call(this); }

  removeEventListeners() { return betInputRemoveEventListeners.call(this); }

  getCanvasCoordinates(event) { return betInputGetCanvasCoordinates.call(this, event); }

  spawnSandParticleAtEdge(tapCoords) { return betInputSpawnSandParticleAtEdge.call(this, tapCoords); }

  handlePointerDown(event) { return betInputHandlePointerDown.call(this, event); }

  handlePointerMove(event) { return betInputHandlePointerMove.call(this, event); }

  handlePointerUp(event) { return betInputHandlePointerUp.call(this, event); }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = performance.now(); // Reset delta baseline whenever the loop restarts
    this.setupEventListeners(); // Re-attach event listeners when resuming
    this.animate();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.removeEventListeners();
  }

  animate() { return betDrawAnimate.call(this); }

  // Batch particle draw calls by style so canvas state (fill, shadow) changes happen at most once per tier-size combo.
  drawBatchedParticles(drawBuckets) { return betDrawBatchedParticles.call(this, drawBuckets); }

  // Cache a pair of tinted generator sprites (clockwise/counter) for a tier so coloring happens once.
  cacheGeneratorSpritesForTier(tierId, sourceImage) { return betDrawCacheGeneratorSpritesForTier.call(this, tierId, sourceImage); }

  // Draw the forge (Star of David with counter-rotating triangles)
  drawForge() { return betDrawForge.call(this); }

  // Draw a faint dashed ring at the edge of the forge's influence radius
  drawForgeInfluenceRing() { return betDrawForgeInfluenceRing.call(this); }

  drawSpawners() { return betDrawDrawSpawners.call(this); }

  getActiveSpawnerGravityFields() {
    // Collect unlocked spawner positions paired with their gravity reach so particles can orbit their origin tiers.
    const activeSpawners = [];

    this.unlockedTiers.forEach((tierId) => {
      const tierIndex = PARTICLE_TIERS.findIndex(tier => tier.id === tierId);
      if (tierIndex < 0 || tierIndex >= SPAWNER_POSITIONS.length) {
        return;
      }

      const position = SPAWNER_POSITIONS[tierIndex];
      // Tag spawner with tier so only matching particles feel the pull.
      activeSpawners.push({ x: position.x, y: position.y, range: SPAWNER_GRAVITY_RADIUS, tierId });
    });

    return activeSpawners;
  }

  resize() {
    // Canvas maintains fixed dimensions to match Aleph spire
    // The CSS will handle scaling to fit container
  }

  /**
   * Calculate the base particle factor by multiplying the number of particles from each tier.
   * If a tier has 0 particles, it contributes 1 to avoid zeroing out the entire factor.
   */
  calculateBaseParticleFactor() {
    let factor = 1;
    PARTICLE_TIERS.forEach(tier => {
      const count = this.inventory.get(tier.id) || 0;
      // Multiply by the count, but use 1 if count is 0 to avoid zero multiplication.
      factor *= (count > 0 ? count : 1);
    });
    return factor;
  }

  /**
   * Calculate the Particle Factor with the nullstone exponent applied.
   * This is the player's total score in the BET spire.
   */
  calculateParticleFactor() {
    const baseFactor = this.calculateBaseParticleFactor();
    // Apply the exponent bonus to the particle factor for nullstone crunch rewards.
    const exponent = 1 + this.particleFactorExponentBonus;
    return Math.pow(baseFactor, exponent);
  }

  /**
   * Check if the particle factor has reached a new milestone and award BET glyphs.
   * Returns the number of glyphs awarded this check (0 if no new milestone reached).
   */
  checkParticleFactorMilestone() {
    const currentFactor = this.calculateParticleFactor();
    let glyphsAwarded = 0;
    
    // Award glyphs for each 100x milestone reached
    while (currentFactor >= this.particleFactorMilestone) {
      glyphsAwarded++;
      this.betGlyphsAwarded++;
      this.particleFactorMilestone *= 100; // Next milestone is 100x higher
    }
    
    // Persist state changes
    if (glyphsAwarded > 0 && this.state) {
      this.state.betGlyphsAwarded = this.betGlyphsAwarded;
      this.state.particleFactorMilestone = this.particleFactorMilestone;
    }
    
    return glyphsAwarded;
  }

  /**
   * Get the current particle factor and milestone progress.
   */
  getParticleFactorStatus() {
    const baseFactor = this.calculateBaseParticleFactor();
    const currentFactor = Math.pow(baseFactor, 1 + this.particleFactorExponentBonus);
    return {
      particleFactor: currentFactor,
      baseFactor,
      currentMilestone: this.particleFactorMilestone,
      betGlyphsAwarded: this.betGlyphsAwarded,
      progressToNext: currentFactor / this.particleFactorMilestone,
      particleFactorExponent: 1 + this.particleFactorExponentBonus,
    };
  }

  getInventory() {
    // Return a copy of the inventory map
    return new Map(this.inventory);
  }

  getInventoryDisplay() {
    // Return an array of tier information for display
    return PARTICLE_TIERS.map(tier => ({
      id: tier.id,
      name: tier.name,
      count: this.inventory.get(tier.id) || 0,
    }));
  }

  getInventoryBySize() {
    // Return particle counts broken down by tier and size
    const counts = new Map();
    
    PARTICLE_TIERS.forEach(tier => {
      counts.set(tier.id, {
        small: 0,
        medium: 0,
        large: 0,
        // Track extra-large counts for the new maximum size tier.
        'extra-large': 0
      });
    });
    
    // Count particles by tier and size
    this.particles.forEach(particle => {
      const sizeKey = SIZE_TIERS[particle.sizeIndex];
      const tierCounts = counts.get(particle.tierId);
      if (tierCounts && sizeKey) {
        tierCounts[sizeKey]++;
      }
    });
    
    return counts;
  }

  /**
   * Get a snapshot of the current particle state for saving
   */
  getParticleStateSnapshot() {
    const particlesByTierAndSize = {};
    
    PARTICLE_TIERS.forEach(tier => {
      particlesByTierAndSize[tier.id] = {
        small: 0,
        medium: 0,
        large: 0,
        // Persist extra-large particle counts for Bet spire state saves.
        'extra-large': 0
      };
    });
    
    // Count particles by tier and size
    this.particles.forEach(particle => {
      const sizeKey = SIZE_TIERS[particle.sizeIndex];
      if (particlesByTierAndSize[particle.tierId] && sizeKey) {
        particlesByTierAndSize[particle.tierId][sizeKey]++;
      }
    });
    
    return particlesByTierAndSize;
  }

  /**
   * Restore particles from a saved state snapshot
   * Spawns particles gradually at generators (dehydration)
   */
  restoreParticleState(snapshot) {
    if (!snapshot) return;

    // Clear existing particles
    this.particles = [];

    // Create a queue of particles to spawn
    const spawnQueue = [];

    PARTICLE_TIERS.forEach((tier, tierIndex) => {
      const counts = snapshot[tier.id];
      if (counts) {
        const smallCount = Math.max(0, counts.small || 0);
        const mediumCount = Math.max(0, counts.medium || 0);
        const largeCount = Math.max(0, counts.large || 0);
        // Include extra-large particles so the largest size tier persists across saves.
        const extraLargeCount = Math.max(0, counts['extra-large'] || 0);

        // Normalize stored counts into the largest possible pieces so resumptions start with the chunkiest particles.
        const totalSmallUnits =
          smallCount
          + (mediumCount * MERGE_THRESHOLD)
          + (largeCount * MERGE_THRESHOLD * MERGE_THRESHOLD)
          + (extraLargeCount * Math.pow(MERGE_THRESHOLD, 3));

        const normalizedExtraLarge = Math.floor(totalSmallUnits / Math.pow(MERGE_THRESHOLD, 3));
        const remainingAfterExtraLarge = totalSmallUnits - (normalizedExtraLarge * Math.pow(MERGE_THRESHOLD, 3));
        const normalizedLarge = Math.floor(remainingAfterExtraLarge / (MERGE_THRESHOLD * MERGE_THRESHOLD));
        const remainingAfterLarge = remainingAfterExtraLarge - (normalizedLarge * MERGE_THRESHOLD * MERGE_THRESHOLD);
        const normalizedMedium = Math.floor(remainingAfterLarge / MERGE_THRESHOLD);
        const normalizedSmall = remainingAfterLarge - (normalizedMedium * MERGE_THRESHOLD);

        // Spawn extra-large particles first so the restored swarm stays chunky.
        for (let i = 0; i < normalizedExtraLarge; i++) {
          spawnQueue.push({ tierId: tier.id, sizeIndex: EXTRA_LARGE_SIZE_INDEX, tierIndex });
        }

        for (let i = 0; i < normalizedLarge; i++) {
          spawnQueue.push({ tierId: tier.id, sizeIndex: LARGE_SIZE_INDEX, tierIndex });
        }

        for (let i = 0; i < normalizedMedium; i++) {
          spawnQueue.push({ tierId: tier.id, sizeIndex: MEDIUM_SIZE_INDEX, tierIndex });
        }

        for (let i = 0; i < normalizedSmall; i++) {
          spawnQueue.push({ tierId: tier.id, sizeIndex: SMALL_SIZE_INDEX, tierIndex });
        }
      }
    });

    // Store the spawn queue for gradual spawning
    this.spawnQueue = spawnQueue;
    this.spawnQueueIndex = 0;
  }

  /**
   * Process the spawn queue, spawning one particle per frame
   */
  processSpawnQueue() {
    if (!this.spawnQueue || this.spawnQueueIndex >= this.spawnQueue.length) {
      return;
    }

    const particleData = this.spawnQueue[this.spawnQueueIndex];
    if (particleData) {
      // Spawn exactly one particle per frame to avoid bursts after long idle sessions.
      this.addParticle(particleData.tierId, particleData.sizeIndex);
    }

    this.spawnQueueIndex += 1;

    if (this.spawnQueueIndex >= this.spawnQueue.length) {
      this.spawnQueue = [];
      this.spawnQueueIndex = 0;
    }
  }
}

// Initialize the Bet Spire render
let betSpireRenderInstance = null;

export function initBetSpireRender(state = {}) {
  const canvas = document.getElementById('bet-spire-canvas');
  if (!canvas) {
    console.warn('Bet Spire canvas element not found');
    return;
  }
  
  if (betSpireRenderInstance) {
    betSpireRenderInstance.stop();
  }
  
  betSpireRenderInstance = new BetSpireRender(canvas, state);
  betSpireRenderInstance.start();
  
  return betSpireRenderInstance;
}

export function stopBetSpireRender() {
  if (betSpireRenderInstance) {
    betSpireRenderInstance.stop();
  }
}

export function resumeBetSpireRender() {
  if (betSpireRenderInstance) {
    betSpireRenderInstance.start();
  }
}

export function getBetSpireRenderInstance() {
  return betSpireRenderInstance;
}

// Export tier definitions for use in other modules
export { PARTICLE_TIERS };
