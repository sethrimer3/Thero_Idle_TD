/**
 * Enemy System for Cardinal Warden
 *
 * Extracted from cardinalWardenSimulation.js (Build 477).
 * Contains all enemy and boss classes used in the reverse-danmaku simulation.
 *
 * Classes:
 * - EnemyShip: Standard downward-moving enemy with weaving and smoke trails
 * - RicochetSkimmer: Diagonal bouncing enemy that reflects off arena walls
 * - CircleCarrierBoss: Rotating circle boss that periodically spawns smaller ships
 * - PyramidBoss: Triangular boss with burst movement
 * - HexagonFortressBoss: Hexagonal boss with health regeneration
 * - MegaBoss: Enhanced fortress boss (larger size)
 * - UltraBoss: Maximum-tier fortress boss (largest size)
 *
 * All classes support grapheme J (elemental effects): applyBurning() and applyFreeze().
 */

import {
  ELEMENTAL_CONFIG,
  VISUAL_CONFIG,
  INNER_RING_CONFIGS,
} from '../cardinalWardenConfig.js';

/**
 * Normalize an angle to the [0, 2π) range.
 * Duplicated locally to avoid circular dependency with the main simulation file.
 */
function normalizeAngle(angle) {
  const twoPi = Math.PI * 2;
  let normalized = angle % twoPi;
  if (normalized < 0) {
    normalized += twoPi;
  }
  return normalized;
}

/**
 * Standard enemy ship that moves downward with weaving behavior and smoke trails.
 */
export class EnemyShip {
  constructor(x, y, config = {}) {
    this.x = x;
    this.y = y;
    this.vx = 0; // Velocity X
    this.vy = 0; // Velocity Y
    this.headingAngle = Math.PI / 2; // Orientation of the ship
    this.maxSpeed = config.speed || 50;
    this.health = config.health || 1;
    this.maxHealth = this.health;
    this.damage = config.damage || 1;
    this.size = config.size || 8;
    this.type = config.type || 'basic';
    this.scoreValue = config.scoreValue || 10;
    this.baseColor = config.color || VISUAL_CONFIG.DEFAULT_ENEMY_COLOR;
    this.color = this.baseColor;
    this.spriteLevel = config.spriteLevel || 1; // Sprite level for rendering (1-6)

    // Trail and exhaust controls for enemy-specific silhouettes.
    this.trailLimit = config.trailLimit || 12;
    this.trailRadiusScale = config.trailRadiusScale || 0.35;
    this.trailAlphaScale = config.trailAlphaScale || 0.8;
    this.maxSmokePuffs = config.maxSmokePuffs || 60;
    
    // Smooth movement properties
    this.acceleration = config.acceleration || 80; // Pixels per second squared
    this.targetX = x;
    this.targetY = y + 100;
    this.arrivalThreshold = 20; // How close to target before picking new one
    
    // Sine wave weaving properties
    this.weaving = config.weaving || false;
    this.waveAmplitude = config.waveAmplitude || 30;
    this.waveFrequency = config.waveFrequency || 2;
    this.wavePhase = config.wavePhase || 0;
    this.time = 0;
    this.lastWaveOffset = 0; // Track previous wave offset for delta-based application
    this.trail = []; // Recent positions to render an inky trail
    this.smokePuffs = []; // Smoke puffs emitted from exhaust, stored with world-space positions
    
    // "Go straight" behavior for unpredictability
    this.goingStraight = false;
    this.straightTimer = 0;
    this.straightDuration = 0; // How long to go straight (in seconds)
    this.straightChance = config.straightChance || 0.15; // 15% chance to go straight when picking new target
    
    // Status effects for grapheme J
    this.burning = false;
    this.burnParticleTimer = 0;
    this.burnParticles = []; // Array of burning particles
    this.frozen = false;
    this.frozenTimer = 0;
    this.frozenDuration = 0;
    this.originalSpeed = this.maxSpeed; // Store original speed for freeze restoration
  }

  /**
   * Pick a new random target point that is lower on the screen.
   * Occasionally decides to go straight instead of to a random target.
   */
  pickNewTarget(canvasWidth, canvasHeight, rng) {
    // Chance to enter "go straight" mode
    if (rng.next() < this.straightChance) {
      this.goingStraight = true;
      this.straightTimer = 0;
      this.straightDuration = rng.range(0.8, 2.0); // Go straight for 0.8-2 seconds
      // Target is directly below current position
      this.targetX = this.x;
      this.targetY = canvasHeight + 100;
      return;
    }
    
    this.goingStraight = false;
    
    // Pick a random point that is lower than current position
    const minY = this.y + 50;
    const maxY = Math.min(this.y + 200, canvasHeight + 50);
    this.targetY = rng.range(minY, maxY);
    
    // Random X within screen bounds with some margin
    const margin = this.size * 2;
    this.targetX = rng.range(margin, canvasWidth - margin);
    
    // Update base X for weaving ships
    if (this.weaving) {
      this.baseX = this.targetX;
    }
  }

  update(deltaTime, targetY, canvasWidth, canvasHeight, rng) {
    const dt = deltaTime / 1000;
    this.time += dt;

    // Handle status effects
    // Burning effect: Apply damage over time
    if (this.burning) {
      const burnDamage = this.maxHealth * ELEMENTAL_CONFIG.BURN_DAMAGE_PERCENT * dt;
      this.health -= burnDamage;
      
      // Spawn burn particles periodically
      this.burnParticleTimer += dt;
      if (this.burnParticleTimer >= ELEMENTAL_CONFIG.BURN_PARTICLE_SPAWN_RATE) {
        this.burnParticleTimer = 0;
        const particleCount = Math.floor(Math.random() * (ELEMENTAL_CONFIG.BURN_PARTICLE_MAX_COUNT - ELEMENTAL_CONFIG.BURN_PARTICLE_MIN_COUNT)) + ELEMENTAL_CONFIG.BURN_PARTICLE_MIN_COUNT;
        for (let i = 0; i < particleCount; i++) {
          this.burnParticles.push({
            x: this.x + (Math.random() - 0.5) * this.size,
            y: this.y + (Math.random() - 0.5) * this.size,
            vx: (Math.random() - 0.5) * ELEMENTAL_CONFIG.BURN_PARTICLE_HORIZONTAL_SPREAD,
            vy: -ELEMENTAL_CONFIG.BURN_PARTICLE_SPEED,
            life: ELEMENTAL_CONFIG.BURN_PARTICLE_LIFETIME,
            maxLife: ELEMENTAL_CONFIG.BURN_PARTICLE_LIFETIME,
            size: 2 + Math.random() * 2,
          });
        }
      }
      
      // Update burn particles
      for (let i = this.burnParticles.length - 1; i >= 0; i--) {
        const particle = this.burnParticles[i];
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.life -= dt;
        if (particle.life <= 0) {
          this.burnParticles.splice(i, 1);
        }
      }
    }
    
    // Freeze effect: Temporarily disable movement
    if (this.frozen) {
      this.frozenTimer += dt;
      if (this.frozenTimer >= this.frozenDuration) {
        // Unfreeze
        this.frozen = false;
        this.frozenTimer = 0;
        this.maxSpeed = this.originalSpeed;
        this.color = this.baseColor;
      } else {
        // Skip movement updates while frozen
        return this.y > targetY;
      }
    }

    // Track previous position to derive orientation and trails.
    const previousX = this.x;
    const previousY = this.y;
    
    // Update "go straight" timer if in that mode
    if (this.goingStraight) {
      this.straightTimer += dt;
      if (this.straightTimer >= this.straightDuration) {
        // Exit straight mode and pick a new target
        this.goingStraight = false;
        this.pickNewTarget(canvasWidth, canvasHeight, rng);
      }
    }
    
    // Calculate direction and distance to target
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distToTarget = Math.sqrt(dx * dx + dy * dy);
    
    // Check if we need a new target (not when going straight)
    if (!this.goingStraight && distToTarget < this.arrivalThreshold) {
      this.pickNewTarget(canvasWidth, canvasHeight, rng);
    }
    
    // Calculate desired velocity direction
    const dirX = distToTarget > 0 ? dx / distToTarget : 0;
    const dirY = distToTarget > 0 ? dy / distToTarget : 1;
    
    // Calculate braking distance (how far we need to decelerate)
    const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const brakingDistance = (currentSpeed * currentSpeed) / (2 * this.acceleration);
    
    // Determine if we should accelerate or decelerate
    let desiredSpeed;
    if (this.goingStraight) {
      // When going straight, maintain max speed
      desiredSpeed = this.maxSpeed;
    } else if (distToTarget > brakingDistance * 1.5) {
      // Far from target - accelerate to max speed
      desiredSpeed = this.maxSpeed;
    } else {
      // Close to target - decelerate
      desiredSpeed = Math.max(10, (distToTarget / brakingDistance) * this.maxSpeed * 0.5);
    }
    
    // Calculate desired velocity
    const desiredVx = dirX * desiredSpeed;
    const desiredVy = dirY * desiredSpeed;
    
    // Apply acceleration toward desired velocity
    const dvx = desiredVx - this.vx;
    const dvy = desiredVy - this.vy;
    const dv = Math.sqrt(dvx * dvx + dvy * dvy);
    
    if (dv > 0) {
      const accelAmount = Math.min(this.acceleration * dt, dv);
      this.vx += (dvx / dv) * accelAmount;
      this.vy += (dvy / dv) * accelAmount;
    }
    
    // Apply velocity
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    
    // Apply sine wave weaving as an additive offset if enabled (disabled when going straight)
    if (this.weaving && !this.goingStraight) {
      const waveOffset = Math.sin(this.time * this.waveFrequency * Math.PI * 2 + this.wavePhase) * this.waveAmplitude;
      this.x += waveOffset - this.lastWaveOffset;
      this.lastWaveOffset = waveOffset;
    }
    
    // Keep within horizontal bounds
    this.x = Math.max(this.size, Math.min(canvasWidth - this.size, this.x));

    // Update orientation based on actual displacement including weaving.
    const deltaX = this.x - previousX;
    const deltaY = this.y - previousY;
    if (deltaX !== 0 || deltaY !== 0) {
      this.headingAngle = Math.atan2(deltaY, deltaX);
    }

    // Record trail positions while keeping memory small.
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.trailLimit) {
      this.trail.shift();
    }

    // Emit smoke puffs from the exhaust at the ship's current position/angle.
    // These are stored in world space so they don't rotate with the ship.
    const tailDirectionX = Math.cos(this.headingAngle);
    const tailDirectionY = Math.sin(this.headingAngle);
    const tailOriginX = this.x - tailDirectionX * (this.size * 0.6);
    const tailOriginY = this.y - tailDirectionY * (this.size * 0.6);
    const baseSmokeRadius = Math.max(2, this.size * 0.3);
    
    // Add a new smoke puff every few frames (controlled by time accumulation)
    this.smokePuffs.push({
      x: tailOriginX,
      y: tailOriginY,
      radius: baseSmokeRadius,
      alpha: 0.42,
      age: 0,
    });
    
    // Update existing smoke puffs - they fade and shrink over time (4x longer trails)
    for (let i = this.smokePuffs.length - 1; i >= 0; i--) {
      const puff = this.smokePuffs[i];
      puff.age += dt;
      // Slower fade rate for longer trails: 0.175 vs original 0.7 (4x slower)
      puff.alpha = Math.max(0, 0.42 - puff.age * 0.175);
      // Slower shrink rate for longer trails
      puff.radius = baseSmokeRadius * Math.max(0.5, 1 - puff.age * 0.075);
      
      // Remove puffs that have fully faded (4x longer: 2.4 vs original 0.6)
      if (puff.alpha <= 0 || puff.age > 2.4) {
        this.smokePuffs.splice(i, 1);
      }
    }
    
    // Limit smoke puffs to prevent memory growth (4x more: 60 vs original 15)
    while (this.smokePuffs.length > this.maxSmokePuffs) {
      this.smokePuffs.shift();
    }

    return this.y > targetY;
  }

  takeDamage(amount) {
    this.health -= amount;
    return this.health <= 0;
  }
  
  /**
   * Apply burning effect from grapheme J (slots 0-3).
   * Deals 5% max health damage per second until enemy dies.
   */
  applyBurning() {
    if (!this.burning) {
      this.burning = true;
      this.burnParticleTimer = 0;
    }
  }
  
  /**
   * Apply freeze effect from grapheme J (slots 4-7).
   * Freezes enemy for 0.5 seconds, can be refreshed.
   */
  applyFreeze() {
    // Store original speed only if not already frozen
    if (!this.frozen) {
      this.originalSpeed = this.maxSpeed;
    }
    this.frozen = true;
    this.frozenTimer = 0;
    this.frozenDuration = ELEMENTAL_CONFIG.FREEZE_DURATION;
    this.maxSpeed = 0;
    this.color = ELEMENTAL_CONFIG.FREEZE_COLOR;
  }
}

/**
 * Ricochet Skimmer - Downward diagonal ship with thin, long trails that
 * occasionally pivots ninety degrees toward the opposite diagonal lane and
 * reflects off arena walls.
 */
export class RicochetSkimmer extends EnemyShip {
  constructor(x, y, config = {}) {
    super(x, y, {
      ...config,
      weaving: false,
    });
    this.type = 'ricochet';
    this.diagonalAngles = config.diagonalAngles || [Math.PI / 4, (3 * Math.PI) / 4];
    this.turnTimer = 0;
    this.nextTurnTime = config.initialStraightTime || 0.65;
    this.turnIntervalRange = config.turnIntervalRange || { min: 0.75, max: 1.35 };
    this.headingAngle = config.initialHeading || this.diagonalAngles[0];

    // Extended trail tuning for the thin streak aesthetic.
    this.trailLimit = config.trailLimit || 30;
    this.trailRadiusScale = config.trailRadiusScale || 0.2;
    this.trailAlphaScale = config.trailAlphaScale || 0.65;
    this.maxSmokePuffs = config.maxSmokePuffs || 40;
  }

  pickDiagonalHeading(rng) {
    // Alternate diagonals when possible to enforce 90° swings between lanes.
    if (this.headingAngle === this.diagonalAngles[0]) {
      return this.diagonalAngles[1];
    }
    if (this.headingAngle === this.diagonalAngles[1]) {
      return this.diagonalAngles[0];
    }
    return rng.next() < 0.5 ? this.diagonalAngles[0] : this.diagonalAngles[1];
  }

  update(deltaTime, targetY, canvasWidth, canvasHeight, rng) {
    const dt = deltaTime / 1000;
    const previousX = this.x;
    const previousY = this.y;

    this.turnTimer += dt;
    if (this.turnTimer >= this.nextTurnTime) {
      this.turnTimer = 0;
      this.nextTurnTime = rng.range(this.turnIntervalRange.min, this.turnIntervalRange.max);
      this.headingAngle = this.pickDiagonalHeading(rng);
    }

    // Constant velocity along the chosen diagonal lane.
    const speed = this.maxSpeed;
    this.vx = Math.cos(this.headingAngle) * speed;
    this.vy = Math.sin(this.headingAngle) * speed;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    let bounced = false;
    if (this.x < this.size) {
      this.x = this.size;
      this.headingAngle = Math.PI - this.headingAngle;
      bounced = true;
    } else if (this.x > canvasWidth - this.size) {
      this.x = canvasWidth - this.size;
      this.headingAngle = Math.PI - this.headingAngle;
      bounced = true;
    }

    if (this.y < this.size) {
      this.y = this.size;
      this.headingAngle = -this.headingAngle;
      bounced = true;
    }

    // Keep heading downward even after reflections.
    this.headingAngle = normalizeAngle(this.headingAngle);
    if (Math.sin(this.headingAngle) <= 0) {
      this.headingAngle = this.headingAngle < Math.PI ? this.diagonalAngles[0] : this.diagonalAngles[1];
      bounced = true;
    }

    if (bounced) {
      this.vx = Math.cos(this.headingAngle) * speed;
      this.vy = Math.sin(this.headingAngle) * speed;
    }

    // Update orientation based on actual displacement for accurate rendering.
    const deltaX = this.x - previousX;
    const deltaY = this.y - previousY;
    if (deltaX !== 0 || deltaY !== 0) {
      this.headingAngle = Math.atan2(deltaY, deltaX);
    }

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.trailLimit) {
      this.trail.shift();
    }

    const tailDirectionX = Math.cos(this.headingAngle);
    const tailDirectionY = Math.sin(this.headingAngle);
    const tailOriginX = this.x - tailDirectionX * (this.size * 0.6);
    const tailOriginY = this.y - tailDirectionY * (this.size * 0.6);
    const baseSmokeRadius = Math.max(1.5, this.size * 0.24);

    this.smokePuffs.push({
      x: tailOriginX,
      y: tailOriginY,
      radius: baseSmokeRadius,
      alpha: 0.3,
      age: 0,
    });

    for (let i = this.smokePuffs.length - 1; i >= 0; i--) {
      const puff = this.smokePuffs[i];
      puff.age += dt;
      puff.alpha = Math.max(0, 0.3 - puff.age * 0.12);
      puff.radius = baseSmokeRadius * Math.max(0.45, 1 - puff.age * 0.08);

      if (puff.alpha <= 0 || puff.age > 2.2) {
        this.smokePuffs.splice(i, 1);
      }
    }

    while (this.smokePuffs.length > this.maxSmokePuffs) {
      this.smokePuffs.shift();
    }

    return this.y > targetY;
  }
}

/**
 * Circle Carrier Boss - A large circular ship that slowly rotates and periodically
 * spawns smaller ships in a radial pattern.
 */
export class CircleCarrierBoss {
  constructor(x, y, config = {}) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.headingAngle = Math.PI / 2;
    this.maxSpeed = config.speed || 15;
    this.health = config.health || 30;
    this.maxHealth = this.health;
    this.damage = config.damage || 25;
    this.size = config.size || 35;
    this.type = 'circleCarrier';
    this.isBoss = true;
    this.scoreValue = config.scoreValue || 200;
    this.baseColor = config.color || VISUAL_CONFIG.DEFAULT_ENEMY_DARK;
    this.color = this.baseColor;

    // Rotation properties
    this.rotation = 0;
    this.rotationSpeed = config.rotationSpeed || 0.5;

    // Carrier properties - spawns smaller ships
    this.spawnTimer = 0;
    this.spawnInterval = config.spawnInterval || 3000;
    this.spawnCount = config.spawnCount || 3;
    this.spawnedShips = []; // Reference to spawned ships for visual connection

    // Movement properties
    this.acceleration = config.acceleration || 30;
    this.targetX = x;
    this.targetY = y + 100;
    this.arrivalThreshold = 30;

    // Visual trail
    this.trail = [];
    this.time = 0;

    // Inner ring decorations
    this.innerRings = INNER_RING_CONFIGS;
    
    // Status effects for grapheme J
    this.burning = false;
    this.burnParticleTimer = 0;
    this.burnParticles = [];
    this.frozen = false;
    this.frozenTimer = 0;
    this.frozenDuration = 0;
    this.originalSpeed = this.maxSpeed;
  }

  /**
   * Pick a new target position that is generally lower on the screen.
   */
  pickNewTarget(canvasWidth, canvasHeight, rng) {
    const minY = this.y + 30;
    const maxY = Math.min(this.y + 150, canvasHeight * 0.6);
    this.targetY = rng.range(minY, maxY);
    const margin = this.size * 2;
    this.targetX = rng.range(margin, canvasWidth - margin);
  }

  /**
   * Update the boss state.
   * Returns an object with passedThrough flag and any newly spawned ships.
   */
  update(deltaTime, targetY, canvasWidth, canvasHeight, rng) {
    const dt = deltaTime / 1000;
    this.time += dt;

    // Handle status effects (same as EnemyShip)
    if (this.burning) {
      const burnDamage = this.maxHealth * ELEMENTAL_CONFIG.BURN_DAMAGE_PERCENT * dt;
      this.health -= burnDamage;
      
      this.burnParticleTimer += dt;
      if (this.burnParticleTimer >= ELEMENTAL_CONFIG.BURN_PARTICLE_SPAWN_RATE) {
        this.burnParticleTimer = 0;
        const particleCount = Math.floor(Math.random() * (ELEMENTAL_CONFIG.BURN_PARTICLE_MAX_COUNT - ELEMENTAL_CONFIG.BURN_PARTICLE_MIN_COUNT)) + ELEMENTAL_CONFIG.BURN_PARTICLE_MIN_COUNT;
        for (let i = 0; i < particleCount; i++) {
          this.burnParticles.push({
            x: this.x + (Math.random() - 0.5) * this.size,
            y: this.y + (Math.random() - 0.5) * this.size,
            vx: (Math.random() - 0.5) * ELEMENTAL_CONFIG.BURN_PARTICLE_HORIZONTAL_SPREAD,
            vy: -ELEMENTAL_CONFIG.BURN_PARTICLE_SPEED,
            life: ELEMENTAL_CONFIG.BURN_PARTICLE_LIFETIME,
            maxLife: ELEMENTAL_CONFIG.BURN_PARTICLE_LIFETIME,
            size: 2 + Math.random() * 2,
          });
        }
      }
      
      for (let i = this.burnParticles.length - 1; i >= 0; i--) {
        const particle = this.burnParticles[i];
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.life -= dt;
        if (particle.life <= 0) {
          this.burnParticles.splice(i, 1);
        }
      }
    }
    
    if (this.frozen) {
      this.frozenTimer += dt;
      if (this.frozenTimer >= this.frozenDuration) {
        this.frozen = false;
        this.frozenTimer = 0;
        this.maxSpeed = this.originalSpeed;
        this.color = this.baseColor;
      } else {
        // Skip movement updates while frozen but still update rotation
        this.rotation += this.rotationSpeed * dt;
        return { passedThrough: this.y > targetY, spawnedShips: [] };
      }
    }

    // Update rotation
    this.rotation += this.rotationSpeed * dt;

    // Track previous position
    const previousX = this.x;
    const previousY = this.y;

    // Movement toward target
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distToTarget = Math.sqrt(dx * dx + dy * dy);

    if (distToTarget < this.arrivalThreshold) {
      this.pickNewTarget(canvasWidth, canvasHeight, rng);
    }

    const dirX = distToTarget > 0 ? dx / distToTarget : 0;
    const dirY = distToTarget > 0 ? dy / distToTarget : 1;

    // Smooth acceleration toward target
    const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const brakingDistance = (currentSpeed * currentSpeed) / (2 * this.acceleration);

    let desiredSpeed;
    if (distToTarget > brakingDistance * 1.5) {
      desiredSpeed = this.maxSpeed;
    } else {
      desiredSpeed = Math.max(5, (distToTarget / brakingDistance) * this.maxSpeed * 0.5);
    }

    const desiredVx = dirX * desiredSpeed;
    const desiredVy = dirY * desiredSpeed;

    const dvx = desiredVx - this.vx;
    const dvy = desiredVy - this.vy;
    const dv = Math.sqrt(dvx * dvx + dvy * dvy);

    if (dv > 0) {
      const accelAmount = Math.min(this.acceleration * dt, dv);
      this.vx += (dvx / dv) * accelAmount;
      this.vy += (dvy / dv) * accelAmount;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Keep within bounds
    this.x = Math.max(this.size, Math.min(canvasWidth - this.size, this.x));

    // Update heading
    const deltaX = this.x - previousX;
    const deltaY = this.y - previousY;
    if (deltaX !== 0 || deltaY !== 0) {
      this.headingAngle = Math.atan2(deltaY, deltaX);
    }

    // Trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 20) {
      this.trail.shift();
    }

    // Ship spawning logic
    this.spawnTimer += deltaTime;
    const newShips = [];
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      // Spawn ships in a radial pattern
      for (let i = 0; i < this.spawnCount; i++) {
        const spawnAngle = this.rotation + (i / this.spawnCount) * Math.PI * 2;
        const spawnX = this.x + Math.cos(spawnAngle) * this.size * 0.8;
        const spawnY = this.y + Math.sin(spawnAngle) * this.size * 0.8;
        newShips.push({
          x: spawnX,
          y: spawnY,
          angle: spawnAngle,
        });
      }
    }

    // Check if passed through bottom
    const passedThrough = this.y > targetY;
    return { passedThrough, newShips };
  }

  takeDamage(amount) {
    this.health -= amount;
    return this.health <= 0;
  }
  
  applyBurning() {
    if (!this.burning) {
      this.burning = true;
      this.burnParticleTimer = 0;
    }
  }
  
  applyFreeze() {
    if (!this.frozen) {
      this.originalSpeed = this.maxSpeed;
    }
    this.frozen = true;
    this.frozenTimer = 0;
    this.frozenDuration = ELEMENTAL_CONFIG.FREEZE_DURATION;
    this.maxSpeed = 0;
    this.color = ELEMENTAL_CONFIG.FREEZE_COLOR;
  }
}

/**
 * Pyramid Boss - A triangular boss that moves in sudden bursts and rotates menacingly.
 */
export class PyramidBoss {
  constructor(x, y, config = {}) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.headingAngle = Math.PI / 2;
    this.maxSpeed = config.speed || 20;
    this.health = config.health || 20;
    this.maxHealth = this.health;
    this.damage = config.damage || 20;
    this.size = config.size || 28;
    this.type = 'pyramidBoss';
    this.isBoss = true;
    this.scoreValue = config.scoreValue || 150;
    this.baseColor = config.color || VISUAL_CONFIG.DEFAULT_ENEMY_DARKER;
    this.color = this.baseColor;

    // Rotation
    this.rotation = 0;
    this.rotationSpeed = config.rotationSpeed || 0.8;

    // Burst movement properties
    this.burstTimer = 0;
    this.burstInterval = config.burstInterval || 2500;
    this.burstSpeed = config.burstSpeed || 80;
    this.isBursting = false;
    this.burstDuration = 300; // ms
    this.burstTimeRemaining = 0;

    // Movement
    this.acceleration = config.acceleration || 40;
    this.targetX = x;
    this.targetY = y + 100;
    this.arrivalThreshold = 25;

    this.trail = [];
    this.time = 0;
    
    // Status effects for grapheme J
    this.burning = false;
    this.burnParticleTimer = 0;
    this.burnParticles = [];
    this.frozen = false;
    this.frozenTimer = 0;
    this.frozenDuration = 0;
    this.originalSpeed = this.maxSpeed;
  }

  pickNewTarget(canvasWidth, canvasHeight, rng) {
    const minY = this.y + 40;
    const maxY = Math.min(this.y + 180, canvasHeight * 0.65);
    this.targetY = rng.range(minY, maxY);
    const margin = this.size * 2;
    this.targetX = rng.range(margin, canvasWidth - margin);
  }

  update(deltaTime, targetY, canvasWidth, canvasHeight, rng) {
    const dt = deltaTime / 1000;
    this.time += dt;
    
    // Handle status effects
    if (this.burning) {
      const burnDamage = this.maxHealth * ELEMENTAL_CONFIG.BURN_DAMAGE_PERCENT * dt;
      this.health -= burnDamage;
      
      this.burnParticleTimer += dt;
      if (this.burnParticleTimer >= ELEMENTAL_CONFIG.BURN_PARTICLE_SPAWN_RATE) {
        this.burnParticleTimer = 0;
        const particleCount = Math.floor(Math.random() * (ELEMENTAL_CONFIG.BURN_PARTICLE_MAX_COUNT - ELEMENTAL_CONFIG.BURN_PARTICLE_MIN_COUNT)) + ELEMENTAL_CONFIG.BURN_PARTICLE_MIN_COUNT;
        for (let i = 0; i < particleCount; i++) {
          this.burnParticles.push({
            x: this.x + (Math.random() - 0.5) * this.size,
            y: this.y + (Math.random() - 0.5) * this.size,
            vx: (Math.random() - 0.5) * ELEMENTAL_CONFIG.BURN_PARTICLE_HORIZONTAL_SPREAD,
            vy: -ELEMENTAL_CONFIG.BURN_PARTICLE_SPEED,
            life: ELEMENTAL_CONFIG.BURN_PARTICLE_LIFETIME,
            maxLife: ELEMENTAL_CONFIG.BURN_PARTICLE_LIFETIME,
            size: 2 + Math.random() * 2,
          });
        }
      }
      
      for (let i = this.burnParticles.length - 1; i >= 0; i--) {
        const particle = this.burnParticles[i];
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.life -= dt;
        if (particle.life <= 0) {
          this.burnParticles.splice(i, 1);
        }
      }
    }
    
    if (this.frozen) {
      this.frozenTimer += dt;
      if (this.frozenTimer >= this.frozenDuration) {
        this.frozen = false;
        this.frozenTimer = 0;
        this.maxSpeed = this.originalSpeed;
        this.color = this.baseColor;
      } else {
        this.rotation += this.rotationSpeed * dt;
        return this.y > targetY;
      }
    }
    
    this.rotation += this.rotationSpeed * dt;

    const previousX = this.x;
    const previousY = this.y;

    // Handle burst movement
    this.burstTimer += deltaTime;
    if (this.burstTimer >= this.burstInterval && !this.isBursting) {
      this.isBursting = true;
      this.burstTimeRemaining = this.burstDuration;
      this.burstTimer = 0;
      this.pickNewTarget(canvasWidth, canvasHeight, rng);
    }

    if (this.isBursting) {
      this.burstTimeRemaining -= deltaTime;
      if (this.burstTimeRemaining <= 0) {
        this.isBursting = false;
      }
    }

    // Movement
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distToTarget = Math.sqrt(dx * dx + dy * dy);

    if (distToTarget < this.arrivalThreshold && !this.isBursting) {
      this.pickNewTarget(canvasWidth, canvasHeight, rng);
    }

    const currentMaxSpeed = this.isBursting ? this.burstSpeed : this.maxSpeed;
    const dirX = distToTarget > 0 ? dx / distToTarget : 0;
    const dirY = distToTarget > 0 ? dy / distToTarget : 1;

    const desiredVx = dirX * currentMaxSpeed;
    const desiredVy = dirY * currentMaxSpeed;

    const accelRate = this.isBursting ? this.acceleration * 3 : this.acceleration;
    const dvx = desiredVx - this.vx;
    const dvy = desiredVy - this.vy;
    const dv = Math.sqrt(dvx * dvx + dvy * dvy);

    if (dv > 0) {
      const accelAmount = Math.min(accelRate * dt, dv);
      this.vx += (dvx / dv) * accelAmount;
      this.vy += (dvy / dv) * accelAmount;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.x = Math.max(this.size, Math.min(canvasWidth - this.size, this.x));

    const deltaX = this.x - previousX;
    const deltaY = this.y - previousY;
    if (deltaX !== 0 || deltaY !== 0) {
      this.headingAngle = Math.atan2(deltaY, deltaX);
    }

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 15) {
      this.trail.shift();
    }

    return this.y > targetY;
  }

  takeDamage(amount) {
    this.health -= amount;
    return this.health <= 0;
  }
  
  applyBurning() {
    if (!this.burning) {
      this.burning = true;
      this.burnParticleTimer = 0;
    }
  }
  
  applyFreeze() {
    if (!this.frozen) {
      this.originalSpeed = this.maxSpeed;
    }
    this.frozen = true;
    this.frozenTimer = 0;
    this.frozenDuration = ELEMENTAL_CONFIG.FREEZE_DURATION;
    this.maxSpeed = 0;
    this.color = ELEMENTAL_CONFIG.FREEZE_COLOR;
  }
}

/**
 * Hexagon Fortress Boss - A large hexagonal ship with regenerating health.
 */
export class HexagonFortressBoss {
  constructor(x, y, config = {}) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.headingAngle = Math.PI / 2;
    this.maxSpeed = config.speed || 10;
    this.health = config.health || 50;
    this.maxHealth = this.health;
    this.damage = config.damage || 30;
    this.size = config.size || 45;
    this.type = 'hexagonFortress';
    this.isBoss = true;
    this.scoreValue = config.scoreValue || 300;
    this.baseColor = config.color || VISUAL_CONFIG.DEFAULT_ENEMY_DARKEST;
    this.color = this.baseColor;

    // Rotation
    this.rotation = 0;
    this.rotationSpeed = config.rotationSpeed || 0.3;

    // Shield/regen properties
    this.shieldRegenRate = config.shieldRegenRate || 0.5;
    this.regenCooldown = 0;
    this.regenCooldownMax = 2000; // ms after damage before regen starts

    // Movement
    this.acceleration = config.acceleration || 20;
    this.targetX = x;
    this.targetY = y + 80;
    this.arrivalThreshold = 35;

    this.trail = [];
    this.time = 0;
    
    // Status effects for grapheme J
    this.burning = false;
    this.burnParticleTimer = 0;
    this.burnParticles = [];
    this.frozen = false;
    this.frozenTimer = 0;
    this.frozenDuration = 0;
    this.originalSpeed = this.maxSpeed;
  }

  pickNewTarget(canvasWidth, canvasHeight, rng) {
    const minY = this.y + 20;
    const maxY = Math.min(this.y + 120, canvasHeight * 0.55);
    this.targetY = rng.range(minY, maxY);
    const margin = this.size * 2;
    this.targetX = rng.range(margin, canvasWidth - margin);
  }

  update(deltaTime, targetY, canvasWidth, canvasHeight, rng) {
    const dt = deltaTime / 1000;
    this.time += dt;
    
    // Handle status effects
    if (this.burning) {
      const burnDamage = this.maxHealth * ELEMENTAL_CONFIG.BURN_DAMAGE_PERCENT * dt;
      this.health -= burnDamage;
      
      this.burnParticleTimer += dt;
      if (this.burnParticleTimer >= ELEMENTAL_CONFIG.BURN_PARTICLE_SPAWN_RATE) {
        this.burnParticleTimer = 0;
        const particleCount = Math.floor(Math.random() * (ELEMENTAL_CONFIG.BURN_PARTICLE_MAX_COUNT - ELEMENTAL_CONFIG.BURN_PARTICLE_MIN_COUNT)) + ELEMENTAL_CONFIG.BURN_PARTICLE_MIN_COUNT;
        for (let i = 0; i < particleCount; i++) {
          this.burnParticles.push({
            x: this.x + (Math.random() - 0.5) * this.size,
            y: this.y + (Math.random() - 0.5) * this.size,
            vx: (Math.random() - 0.5) * ELEMENTAL_CONFIG.BURN_PARTICLE_HORIZONTAL_SPREAD,
            vy: -ELEMENTAL_CONFIG.BURN_PARTICLE_SPEED,
            life: ELEMENTAL_CONFIG.BURN_PARTICLE_LIFETIME,
            maxLife: ELEMENTAL_CONFIG.BURN_PARTICLE_LIFETIME,
            size: 2 + Math.random() * 2,
          });
        }
      }
      
      for (let i = this.burnParticles.length - 1; i >= 0; i--) {
        const particle = this.burnParticles[i];
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.life -= dt;
        if (particle.life <= 0) {
          this.burnParticles.splice(i, 1);
        }
      }
    }
    
    if (this.frozen) {
      this.frozenTimer += dt;
      if (this.frozenTimer >= this.frozenDuration) {
        this.frozen = false;
        this.frozenTimer = 0;
        this.maxSpeed = this.originalSpeed;
        this.color = this.baseColor;
      } else {
        this.rotation += this.rotationSpeed * dt;
        return this.y > targetY;
      }
    }
    
    this.rotation += this.rotationSpeed * dt;

    const previousX = this.x;
    const previousY = this.y;

    // Health regeneration
    if (this.regenCooldown > 0) {
      this.regenCooldown -= deltaTime;
    } else if (this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + this.shieldRegenRate * dt);
    }

    // Movement
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distToTarget = Math.sqrt(dx * dx + dy * dy);

    if (distToTarget < this.arrivalThreshold) {
      this.pickNewTarget(canvasWidth, canvasHeight, rng);
    }

    const dirX = distToTarget > 0 ? dx / distToTarget : 0;
    const dirY = distToTarget > 0 ? dy / distToTarget : 1;

    const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const brakingDistance = (currentSpeed * currentSpeed) / (2 * this.acceleration);

    let desiredSpeed;
    if (distToTarget > brakingDistance * 1.5) {
      desiredSpeed = this.maxSpeed;
    } else {
      desiredSpeed = Math.max(3, (distToTarget / brakingDistance) * this.maxSpeed * 0.5);
    }

    const desiredVx = dirX * desiredSpeed;
    const desiredVy = dirY * desiredSpeed;

    const dvx = desiredVx - this.vx;
    const dvy = desiredVy - this.vy;
    const dv = Math.sqrt(dvx * dvx + dvy * dvy);

    if (dv > 0) {
      const accelAmount = Math.min(this.acceleration * dt, dv);
      this.vx += (dvx / dv) * accelAmount;
      this.vy += (dvy / dv) * accelAmount;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.x = Math.max(this.size, Math.min(canvasWidth - this.size, this.x));

    const deltaX = this.x - previousX;
    const deltaY = this.y - previousY;
    if (deltaX !== 0 || deltaY !== 0) {
      this.headingAngle = Math.atan2(deltaY, deltaX);
    }

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 25) {
      this.trail.shift();
    }

    return this.y > targetY;
  }

  takeDamage(amount) {
    this.health -= amount;
    this.regenCooldown = this.regenCooldownMax;
    return this.health <= 0;
  }
  
  applyBurning() {
    if (!this.burning) {
      this.burning = true;
      this.burnParticleTimer = 0;
    }
  }
  
  applyFreeze() {
    if (!this.frozen) {
      this.originalSpeed = this.maxSpeed;
    }
    this.frozen = true;
    this.frozenTimer = 0;
    this.frozenDuration = ELEMENTAL_CONFIG.FREEZE_DURATION;
    this.maxSpeed = 0;
    this.color = ELEMENTAL_CONFIG.FREEZE_COLOR;
  }
}

/**
 * Mega Boss - An enhanced fortress with more health and power.
 * Placeholder implementation using HexagonFortress mechanics.
 */
export class MegaBoss extends HexagonFortressBoss {
  constructor(x, y, config = {}) {
    super(x, y, config);
    this.type = 'megaBoss';
    this.size = config.size || 55;
  }
}

/**
 * Ultra Boss - The most powerful boss type with massive health and damage.
 * Placeholder implementation using HexagonFortress mechanics.
 */
export class UltraBoss extends HexagonFortressBoss {
  constructor(x, y, config = {}) {
    super(x, y, config);
    this.type = 'ultraBoss';
    this.size = config.size || 65;
  }
}
