// Bet Spire Particle class
// Physics-driven particle with tier/size properties and per-frame update/draw logic.
// Extracted from betSpireRender.js so the render file can focus on the BetSpireRender system.

import {
  TWO_PI,
  HALF_PI,
  DEG_TO_RAD,
  HALF,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BASE_PARTICLE_SIZE,
  MIN_VELOCITY,
  MAX_VELOCITY,
  ATTRACTION_STRENGTH,
  MAX_FORGE_ATTRACTION_DISTANCE,
  DISTANCE_SCALE,
  FORCE_SCALE,
  SPAWNER_GRAVITY_STRENGTH,
  SMALL_TIER_GENERATOR_GRAVITY_STRENGTH,
  MEDIUM_TIER_FORGE_GRAVITY_STRENGTH,
  MOUSE_ATTRACTION_STRENGTH,
  MERGE_GATHER_SPEED,
  VEER_ANGLE_MIN_DEG,
  VEER_ANGLE_MAX_DEG,
  VEER_INTERVAL_MIN_MS,
  VEER_INTERVAL_MAX_MS,
  getRandomInRange,
  PARTICLE_TIERS,
  SIZE_TIERS,
  SMALL_SIZE_INDEX,
  MEDIUM_SIZE_INDEX,
  EXTRA_LARGE_SIZE_INDEX,
  SIZE_SCALE_MULTIPLIERS,
  SIZE_MIN_VELOCITY_MODIFIERS,
  SIZE_MAX_VELOCITY_MODIFIERS,
  SIZE_FORCE_MODIFIERS,
} from './betSpireConfig.js';

// Particle class with tier and size
export class Particle {
  constructor(tierId = 'sand', sizeIndex = 0, spawnPosition = null) {
    // Spawn at generator position if provided, otherwise at random location
    if (spawnPosition) {
      const spawnAngle = Math.random() * TWO_PI; // Jitter the spawn angle so particles cluster near the generator center (using pre-calculated constant)
      const spawnRadius = Math.random() * 3; // Keep new particles close to the generator so they stay within its influence.
      this.x = spawnPosition.x + Math.cos(spawnAngle) * spawnRadius;
      this.y = spawnPosition.y + Math.sin(spawnAngle) * spawnRadius;
      this.vx = 0; // Spawn particles at rest so they start centered before gravity nudges them outward.
      this.vy = 0; // Keep initial velocity zero to avoid launching particles outside the generator field.
    } else {
      this.x = Math.random() * CANVAS_WIDTH;
      this.y = Math.random() * CANVAS_HEIGHT;
      this.vx = (Math.random() - 0.5);
      this.vy = (Math.random() - 0.5);
    }
    
    // Tier and size properties
    this.tierId = tierId;
    this.sizeIndex = sizeIndex; // 0 = small, 1 = medium, 2 = large, 3 = extra-large
    
    // Cache tier reference and color strings for performance
    this._tier = PARTICLE_TIERS.find(t => t.id === tierId) || PARTICLE_TIERS[0];
    // Cache the tier index so generator-only speed scaling can reference the tier number.
    this._tierIndex = PARTICLE_TIERS.findIndex(tier => tier.id === this._tier.id);
    this._colorString = `rgba(${this._tier.color.r}, ${this._tier.color.g}, ${this._tier.color.b}, 0.9)`;
    this._glowColorString = this._tier.glowColor 
      ? `rgba(${this._tier.glowColor.r}, ${this._tier.glowColor.g}, ${this._tier.glowColor.b}, 0.8)`
      : null;
    this._size = BASE_PARTICLE_SIZE * (SIZE_SCALE_MULTIPLIERS[sizeIndex] || 1.0);
    this._minVelocityModifier = SIZE_MIN_VELOCITY_MODIFIERS[sizeIndex] || 1.0;
    this._maxVelocityModifier = SIZE_MAX_VELOCITY_MODIFIERS[sizeIndex] || 1.0;
    // Cache force scaling so extra-large particles resist pulls with massive inertia.
    this._forceModifier = SIZE_FORCE_MODIFIERS[sizeIndex] || 1.0;
    this._maxVelocity = MAX_VELOCITY * this._maxVelocityModifier;
    this._minVelocity = MIN_VELOCITY * this._minVelocityModifier;

    // Track when this particle should apply its next random veer adjustment.
    this.nextVeerTime = performance.now() + getRandomInRange(VEER_INTERVAL_MIN_MS, VEER_INTERVAL_MAX_MS);
    
    this.lockedToMouse = false; // Whether particle is locked to mouse/touch
    this.mouseTarget = null; // Target position when locked to mouse
    this.merging = false; // Whether particle is being merged
    this.mergeTarget = null; // Target position during merge animation
  }

  getTier() {
    return this._tier;
  }

  getSizeName() {
    return SIZE_TIERS[this.sizeIndex] || 'small';
  }

  getSize() {
    return this._size;
  }

  update(
    forge,
    spawners = [],
    deltaFrameRatio = 1,
    now = Date.now(),
    veerEnabled = false,
    smallTierGravityEnabled = false,
    mediumTierGravityEnabled = false
  ) {
    // Track whether the particle is inside its generator's gravity field for velocity clamping.
    let isInsideGeneratorField = false;
    // Guard against invalid delta ratios so taps can't destabilize the integrator.
    const clampedDelta = Math.max(deltaFrameRatio, 0.01);

    // If particle is merging, fly to merge target at high speed with a swirl effect
    if (this.merging && this.mergeTarget) {
      const dx = this.mergeTarget.x - this.x;
      const dy = this.mergeTarget.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        const angle = Math.atan2(dy, dx);
        const gatherSpeed = MERGE_GATHER_SPEED * clampedDelta;
        
        // Add tangential (perpendicular) velocity for swirl effect
        // The swirl gets stronger as particles get closer to the target
        const swirl_strength = 0.3 * (1 - Math.min(dist / 50, 1)); // Stronger when closer
        const tangentAngle = angle + HALF_PI; // Perpendicular to radial direction (using pre-calculated constant)
        
        // Combine radial (toward target) and tangential (swirl) velocities
        this.vx = Math.cos(angle) * gatherSpeed + Math.cos(tangentAngle) * swirl_strength * gatherSpeed;
        this.vy = Math.sin(angle) * gatherSpeed + Math.sin(tangentAngle) * swirl_strength * gatherSpeed;
      } else {
        // Reached target, zero velocity
        this.vx = 0;
        this.vy = 0;
      }
    }
    // If locked to mouse, strongly attract to mouse position
    else if (this.lockedToMouse && this.mouseTarget) {
      const dx = this.mouseTarget.x - this.x;
      const dy = this.mouseTarget.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        // Scale drag attraction so extra-large particles are far harder to pull.
        const force = MOUSE_ATTRACTION_STRENGTH * this._forceModifier;
        const angle = Math.atan2(dy, dx);
        this.vx += Math.cos(angle) * force * clampedDelta;
        this.vy += Math.sin(angle) * force * clampedDelta;
      } else {
        // Very close to target, dampen velocity
        const damping = Math.pow(0.8, clampedDelta);
        this.vx *= damping;
        this.vy *= damping;
      }
    } else {
      // Extra-large particles ignore generator pull so they only drift toward the forge.
      if (this.sizeIndex !== EXTRA_LARGE_SIZE_INDEX) {
        // Apply gravity from each unlocked spawner within its local field so particles stay near their forge of origin.
        for (const spawner of spawners) {
          // Only attract particles to their matching generator tier.
          if (spawner.tierId !== this.tierId) {
            continue;
          }
          const dx = spawner.x - this.x;
          const dy = spawner.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= spawner.range && dist > 0.5) {
            // Record that the particle is inside its generator field so we can cap its top speed there.
            isInsideGeneratorField = true;
            // Scale generator gravity by size so heavier particles accelerate more slowly.
            const force = (SPAWNER_GRAVITY_STRENGTH / (dist * DISTANCE_SCALE)) * this._forceModifier;
            const angle = Math.atan2(dy, dx);
            this.vx += Math.cos(angle) * force * FORCE_SCALE * clampedDelta;
            this.vy += Math.sin(angle) * force * FORCE_SCALE * clampedDelta;
          }

          // Apply an additional, extremely gentle pull for small particles toward their matching generator.
          if (smallTierGravityEnabled && this.sizeIndex === SMALL_SIZE_INDEX && dist > 0.5) {
            // Scale the small-tier gravity nudge by size inertia as well.
            const force = (SMALL_TIER_GENERATOR_GRAVITY_STRENGTH / (dist * DISTANCE_SCALE)) * this._forceModifier;
            const angle = Math.atan2(dy, dx);
            this.vx += Math.cos(angle) * force * FORCE_SCALE * clampedDelta;
            this.vy += Math.sin(angle) * force * FORCE_SCALE * clampedDelta;
          }
        }
      }

      // Normal forge attractor behavior
      const dx = forge.x - this.x;
      const dy = forge.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Apply attraction force (inverse square law simplified) only while within the localized forge gravity well.
      // Let nullstone drift into the forge at any size so single particles can still be crunched.
      const isForgeAttractable = this.sizeIndex >= MEDIUM_SIZE_INDEX || this.tierId === 'nullstone';
      // Extra-large and nullstone particles should feel the forge pull across the entire basin so crunches can trigger reliably.
      const forgeAttractionRange = (this.sizeIndex === EXTRA_LARGE_SIZE_INDEX || this.tierId === 'nullstone')
        ? Number.POSITIVE_INFINITY
        : MAX_FORGE_ATTRACTION_DISTANCE;
      if (isForgeAttractable && dist <= forgeAttractionRange) {
        const angle = Math.atan2(dy, dx);
        if (dist > 1) {
          // Scale forge attraction by size so extra-large particles resist the forge pull.
          const force = (ATTRACTION_STRENGTH / (dist * DISTANCE_SCALE)) * this._forceModifier;
          this.vx += Math.cos(angle) * force * FORCE_SCALE * clampedDelta;
          this.vy += Math.sin(angle) * force * FORCE_SCALE * clampedDelta;
        }
        // Forge now attracts particles toward center like generators do (removed orbital spin behavior)
      }

      // Apply an additional, extremely weak pull for medium particles toward the central forge.
      if (mediumTierGravityEnabled && this.sizeIndex === MEDIUM_SIZE_INDEX && dist > 0.5) {
        const angle = Math.atan2(dy, dx);
        // Scale medium-tier gravity to keep inertia consistent across sizes.
        const force = (MEDIUM_TIER_FORGE_GRAVITY_STRENGTH / (dist * DISTANCE_SCALE)) * this._forceModifier;
        this.vx += Math.cos(angle) * force * FORCE_SCALE * clampedDelta;
        this.vy += Math.sin(angle) * force * FORCE_SCALE * clampedDelta;
      }
    }
    
    // Apply a subtle randomized veer to the velocity vector when enabled.
    if (veerEnabled && !this.merging && !this.lockedToMouse && now >= this.nextVeerTime) {
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (speed > 0) {
        const veerDegrees = getRandomInRange(VEER_ANGLE_MIN_DEG, VEER_ANGLE_MAX_DEG);
        const veerAngle = veerDegrees * DEG_TO_RAD;
        const direction = Math.random() < 0.5 ? -1 : 1;
        const rotation = veerAngle * direction;
        const cosTheta = Math.cos(rotation);
        const sinTheta = Math.sin(rotation);
        const rotatedVx = this.vx * cosTheta - this.vy * sinTheta;
        const rotatedVy = this.vx * sinTheta + this.vy * cosTheta;
        this.vx = rotatedVx;
        this.vy = rotatedVy;
      }
      this.nextVeerTime = now + getRandomInRange(VEER_INTERVAL_MIN_MS, VEER_INTERVAL_MAX_MS);
    }

    // Limit velocity with size-based modifier
    const maxVelocity = this._maxVelocity;
    // Match generator-field minimum speed to the particle tier number so each type has constant motion near its own spawner.
    const generatorMinVelocity = this._minVelocity * Math.max(1, this._tierIndex + 1);
    const minVelocity = isInsideGeneratorField ? generatorMinVelocity : this._minVelocity;
    
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    // Clamp speed based on whether the particle is caught in its generator gravity field.
    const generatorMaxVelocity = generatorMinVelocity * 5;
    // Reduce the generator field speed cap by 10% so particles drift more gently near their spawner.
    const generatorVelocityCap = generatorMaxVelocity * 0.9;
    const allowedMaxVelocity = isInsideGeneratorField ? Math.min(maxVelocity, generatorVelocityCap) : maxVelocity;
    if (speed > allowedMaxVelocity) {
      this.vx = (this.vx / speed) * allowedMaxVelocity;
      this.vy = (this.vy / speed) * allowedMaxVelocity;
    }
    
    // Enforce minimum velocity to keep particles always moving
    if (speed < minVelocity && speed > 0) {
      this.vx = (this.vx / speed) * minVelocity;
      this.vy = (this.vy / speed) * minVelocity;
    } else if (speed === 0) {
      // Give particles a random initial velocity if they're stopped
      const randomAngle = Math.random() * TWO_PI; // Use pre-calculated constant
      this.vx = Math.cos(randomAngle) * minVelocity;
      this.vy = Math.sin(randomAngle) * minVelocity;
    }
    
    // Update position
    this.x += this.vx * clampedDelta;
    this.y += this.vy * clampedDelta;
    
    // Keep particles within gravitational field (bounce off canvas bounds instead of wrapping)
    if (!this.lockedToMouse) {
      const bounce = 0.8; // Bounce dampening factor
      
      if (this.x < 0) {
        this.x = 0;
        this.vx = Math.abs(this.vx) * bounce;
      }
      if (this.x > CANVAS_WIDTH) {
        this.x = CANVAS_WIDTH;
        this.vx = -Math.abs(this.vx) * bounce;
      }
      if (this.y < 0) {
        this.y = 0;
        this.vy = Math.abs(this.vy) * bounce;
      }
      if (this.y > CANVAS_HEIGHT) {
        this.y = CANVAS_HEIGHT;
        this.vy = -Math.abs(this.vy) * bounce;
      }
    } else {
      // Clamp to canvas bounds when locked
      if (this.x < 0) this.x = 0;
      if (this.x > CANVAS_WIDTH) this.x = CANVAS_WIDTH;
      if (this.y < 0) this.y = 0;
      if (this.y > CANVAS_HEIGHT) this.y = CANVAS_HEIGHT;
    }
  }

  getColor() {
    return this._colorString;
  }

  // Return a stable key that groups particles by draw style so the renderer can batch fill calls efficiently.
  getDrawStyleKey() {
    return `${this._colorString}|${this._glowColorString || 'no-glow'}|${this._size}`;
  }

  // Provide the cached draw style so the renderer can set canvas state once per bucket instead of per particle.
  getDrawStyle() {
    return {
      colorString: this._colorString,
      glowColorString: this._glowColorString,
      size: this._size,
    };
  }

  // Reset particle velocity to the minimum swirl speed when a drag is released without movement.
  applyMinimumReleaseVelocity() {
    const minVelocity = this._minVelocity;
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);

    if (speed > 0) {
      this.vx = (this.vx / speed) * minVelocity;
      this.vy = (this.vy / speed) * minVelocity;
    } else {
      const randomAngle = Math.random() * TWO_PI; // Use pre-calculated constant
      this.vx = Math.cos(randomAngle) * minVelocity;
      this.vy = Math.sin(randomAngle) * minVelocity;
    }
  }

  draw(ctx) {
    const size = this._size;
    const halfSize = size * HALF; // Use pre-calculated HALF constant for optimization
    
    // Draw particle
    ctx.fillStyle = this._colorString;
    
    // If tier has a glow, add shadow effect
    if (this._glowColorString) {
      ctx.shadowBlur = size * 3;
      ctx.shadowColor = this._glowColorString;
    } else {
      ctx.shadowBlur = 0;
    }
    
    ctx.fillRect(
      Math.floor(this.x - halfSize),
      Math.floor(this.y - halfSize),
      Math.ceil(size),
      Math.ceil(size)
    );
    
    // Reset shadow
    ctx.shadowBlur = 0;
  }
}
