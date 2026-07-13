// Bet Spire Merge System
// Particle merge, tier conversion, inventory tracking, and active merge processing.
// All functions use .call(this) delegation from BetSpireRender.

import {
  SMALL_SIZE_INDEX,
  MEDIUM_SIZE_INDEX,
  LARGE_SIZE_INDEX,
  EXTRA_LARGE_SIZE_INDEX,
  MERGE_THRESHOLD,
  MERGE_GATHER_THRESHOLD,
  MERGE_TIMEOUT_MS,
  PERFORMANCE_THRESHOLD,
  GENERATOR_CONVERSION_RADIUS,
  CONVERSION_SPREAD_VELOCITY,
  PARTICLE_TIERS,
  SIZE_TIERS,
  SPAWNER_POSITIONS,
  TWO_PI,
  MAX_PARTICLES,
} from './betSpireConfig.js';
import { Particle } from './betSpireParticle.js';

export function updateInventory() {
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
export function canStartNewMerge() {
    return this.activeMerges.length === 0 && this.mergeCooldownFrames === 0;
  }

// Select a random subset of particles without mutating the source collection.
export function selectRandomParticles(group, count) {
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
export function getGeneratorCenterForTier(tierId) {
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
export function enforceParticleLimit() {
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
export function attemptMerge() {
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
export function attemptTierConversion() {
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

// Attempt to merge large particles to next tier (performance optimization)
// When 100 large particles of the same tier exist, convert them to 10 large particles of the next tier
// This can happen anywhere on the screen to reduce particle count for better performance
export function attemptLargeTierMerge() {
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
export function processActiveMerges() {
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
