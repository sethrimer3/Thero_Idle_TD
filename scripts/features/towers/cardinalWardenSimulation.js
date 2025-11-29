/**
 * Cardinal Warden Simulation
 *
 * A "reverse danmaku" game for the Shin Spire. Instead of controlling a ship
 * avoiding bullets, the player is a boss (the Cardinal Warden) fighting off
 * incoming enemy ships.
 *
 * Features:
 * - 3:4 aspect ratio canvas that scales to fit the viewport
 * - Pure white background with minimalist aesthetics
 * - Golden rotating squares around a center orb (the Cardinal Warden)
 * - Enemy ships spawning from top, moving toward bottom
 * - Progressive difficulty scaling (speed, health, damage, variety)
 * - Score tracking with high score persistence
 * - Reset on death with difficulty restart
 */

/**
 * Game configuration constants.
 */
const GAME_CONFIG = {
  // Maximum enemies that can pass through before game over
  MAX_ENEMIES_PASSED: 10,
  // Cardinal Warden maximum health
  WARDEN_MAX_HEALTH: 100,
  // Time per wave in milliseconds
  WAVE_DURATION_MS: 15000,
  // Base time between enemy spawns in milliseconds
  BASE_ENEMY_SPAWN_INTERVAL_MS: 2000,
  // Base time between bullet volleys in milliseconds
  BASE_BULLET_INTERVAL_MS: 500,
  // Maximum delta time cap to prevent physics issues (ms)
  MAX_DELTA_TIME_MS: 33,
  // Minimum difficulty level required for boss spawning
  BOSS_MIN_DIFFICULTY: 3,
  // Difficulty scaling factor for boss stats
  BOSS_DIFFICULTY_SCALE: 0.2,
  // Maximum reduction in boss spawn interval (ms)
  BOSS_SPAWN_INTERVAL_MAX_REDUCTION: 20000,
  // Reduction per difficulty level for boss spawn interval (ms)
  BOSS_SPAWN_INTERVAL_REDUCTION_PER_LEVEL: 2000,
  // Minimum boss spawn interval (ms)
  BOSS_SPAWN_INTERVAL_MIN: 10000,
};

/**
 * Lighten a hex color by blending it toward white.
 */
function lightenHexColor(hex, amount = 0.2) {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  if (normalized.length !== 6) {
    return hex;
  }

  const num = parseInt(normalized, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;

  const mix = (channel) => Math.round(channel + (255 - channel) * amount);

  const nr = mix(r);
  const ng = mix(g);
  const nb = mix(b);

  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb
    .toString(16)
    .padStart(2, '0')}`;
}

/**
 * Simple seeded random number generator for consistent enemy patterns.
 */
class SeededRandom {
  constructor(seed = Date.now()) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
}

/**
 * Represents a single rotating square in the Cardinal Warden formation.
 */
class OrbitalSquare {
  constructor(index, totalSquares, orbitRadius, rng) {
    this.index = index;
    this.totalSquares = totalSquares;
    this.orbitRadius = orbitRadius;
    this.baseAngle = (index / totalSquares) * Math.PI * 2;
    // Use seeded random for deterministic patterns
    this.rotationSpeed = 0.5 + rng.next() * 1.5;
    this.rotationDirection = rng.next() > 0.5 ? 1 : -1;
    this.selfRotation = 0;
    this.selfRotationSpeed = 1 + rng.next() * 2;
    this.size = 8 + rng.next() * 6;
    this.orbitSpeed = 0.3 + rng.next() * 0.4;
    this.orbitOffset = 0;
  }

  update(deltaTime) {
    const dt = deltaTime / 1000;
    this.selfRotation += this.selfRotationSpeed * this.rotationDirection * dt;
    this.orbitOffset += this.orbitSpeed * dt;
  }

  getPosition(centerX, centerY) {
    const angle = this.baseAngle + this.orbitOffset;
    return {
      x: centerX + Math.cos(angle) * this.orbitRadius,
      y: centerY + Math.sin(angle) * this.orbitRadius,
    };
  }
}

/**
 * Represents a large ring square that encompasses the warden.
 * These squares rotate around the warden with transparent fill, creating a ring-like effect.
 */
class RingSquare {
  constructor(config) {
    // Size of the ring square (larger than the warden)
    this.size = config.size || 80;
    // Initial rotation angle
    this.rotation = config.initialRotation || 0;
    // Rotation speed in radians per second
    this.rotationSpeed = config.rotationSpeed || 0.5;
    // Rotation direction: 1 for clockwise, -1 for counter-clockwise
    this.rotationDirection = config.rotationDirection || 1;
    // Stroke color (golden to match theme)
    this.strokeColor = config.strokeColor || '#d4af37';
    // Stroke width
    this.strokeWidth = config.strokeWidth || 2;
    // Alpha transparency for the ring
    this.alpha = config.alpha || 0.6;
  }

  update(deltaTime) {
    const dt = deltaTime / 1000;
    this.rotation += this.rotationSpeed * this.rotationDirection * dt;
  }

  /**
   * Render the ring square centered on the given position.
   */
  render(ctx, centerX, centerY) {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(this.rotation);
    
    ctx.globalAlpha = this.alpha;
    ctx.strokeStyle = this.strokeColor;
    ctx.lineWidth = this.strokeWidth;
    
    const halfSize = this.size / 2;
    ctx.strokeRect(-halfSize, -halfSize, this.size, this.size);
    
    ctx.restore();
  }
}

/**
 * Represents the Cardinal Warden - the player's boss entity.
 */
class CardinalWarden {
  constructor(x, y, rng) {
    this.x = x;
    this.y = y;
    this.health = 100;
    this.maxHealth = 100;
    this.coreRadius = 16;
    this.orbitalSquares = [];
    this.ringSquares = [];
    this.rng = rng;
    this.initOrbitalSquares();
    this.initRingSquares();
  }

  initOrbitalSquares() {
    this.orbitalSquares = [];
    const squareCount = 8;
    const orbitRadius = 35;
    for (let i = 0; i < squareCount; i++) {
      this.orbitalSquares.push(new OrbitalSquare(i, squareCount, orbitRadius, this.rng));
    }
  }

  /**
   * Initialize the large rotating ring squares that encompass the warden.
   * Multiple rings with different sizes, speeds, and directions create visual depth.
   */
  initRingSquares() {
    this.ringSquares = [];
    
    // Ring configurations: size, speed, direction, strokeWidth, alpha
    const ringConfigs = [
      { size: 70, rotationSpeed: 0.4, rotationDirection: 1, strokeWidth: 1.5, alpha: 0.5 },
      { size: 95, rotationSpeed: 0.25, rotationDirection: -1, strokeWidth: 2, alpha: 0.4 },
      { size: 120, rotationSpeed: 0.6, rotationDirection: 1, strokeWidth: 1, alpha: 0.35 },
      { size: 150, rotationSpeed: 0.15, rotationDirection: -1, strokeWidth: 2.5, alpha: 0.3 },
      { size: 180, rotationSpeed: 0.35, rotationDirection: 1, strokeWidth: 1.5, alpha: 0.25 },
    ];
    
    for (let i = 0; i < ringConfigs.length; i++) {
      const config = ringConfigs[i];
      // Stagger initial rotations so they don't all start aligned
      config.initialRotation = (i / ringConfigs.length) * Math.PI * 0.5;
      config.strokeColor = '#d4af37';
      this.ringSquares.push(new RingSquare(config));
    }
  }

  update(deltaTime) {
    for (const square of this.orbitalSquares) {
      square.update(deltaTime);
    }
    for (const ring of this.ringSquares) {
      ring.update(deltaTime);
    }
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  reset() {
    this.health = this.maxHealth;
    this.initOrbitalSquares();
    this.initRingSquares();
  }
}

/**
 * Represents an enemy ship attacking the Cardinal Warden.
 * Ships smoothly accelerate toward random target points, reaching top speed
 * then decelerating as they approach. Some ships weave in sine wave patterns.
 * Ships occasionally enter a "go straight" mode for more unpredictable movement.
 */
class EnemyShip {
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
    this.baseColor = config.color || '#333';
    this.color = this.baseColor;
    
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
    let desiredVx = dirX * desiredSpeed;
    let desiredVy = dirY * desiredSpeed;
    
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
    if (this.trail.length > 12) {
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
    
    // Update existing smoke puffs - they fade and shrink over time
    for (let i = this.smokePuffs.length - 1; i >= 0; i--) {
      const puff = this.smokePuffs[i];
      puff.age += dt;
      puff.alpha = Math.max(0, 0.42 - puff.age * 0.7);
      puff.radius = baseSmokeRadius * Math.max(0.5, 1 - puff.age * 0.3);
      
      // Remove puffs that have fully faded
      if (puff.alpha <= 0 || puff.age > 0.6) {
        this.smokePuffs.splice(i, 1);
      }
    }
    
    // Limit smoke puffs to prevent memory growth
    while (this.smokePuffs.length > 15) {
      this.smokePuffs.shift();
    }

    return this.y > targetY;
  }

  takeDamage(amount) {
    this.health -= amount;
    return this.health <= 0;
  }
}

/**
 * Boss ship types available in the game.
 * These are larger, more dangerous enemies that appear periodically.
 */
const BOSS_TYPES = {
  circleCarrier: {
    speed: 15,
    health: 30,
    damage: 25,
    size: 35,
    scoreValue: 200,
    color: '#000000',
    rotationSpeed: 0.5, // Radians per second
    spawnInterval: 3000, // ms between spawning ships
    spawnCount: 3, // Ships spawned per interval
  },
  pyramidBoss: {
    speed: 20,
    health: 20,
    damage: 20,
    size: 28,
    scoreValue: 150,
    color: '#000000',
    rotationSpeed: 0.8,
    burstInterval: 2500, // Time between movement bursts
    burstSpeed: 80, // Speed during burst
  },
  hexagonFortress: {
    speed: 10,
    health: 50,
    damage: 30,
    size: 45,
    scoreValue: 300,
    color: '#000000',
    rotationSpeed: 0.3,
    shieldRegenRate: 0.5, // Health regen per second
  },
};

/**
 * Circle Carrier Boss - A large circular ship that slowly rotates and periodically
 * spawns smaller ships in a radial pattern.
 */
class CircleCarrierBoss {
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
    this.baseColor = config.color || '#1a1a1a';
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
    this.innerRings = [
      { radius: 0.6, rotationOffset: 0 },
      { radius: 0.4, rotationOffset: Math.PI / 3 },
    ];
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
   * Returns an array of newly spawned ships (empty if none spawned this frame).
   */
  update(deltaTime, targetY, canvasWidth, canvasHeight, rng) {
    const dt = deltaTime / 1000;
    this.time += dt;

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
}

/**
 * Pyramid Boss - A triangular boss that moves in sudden bursts and rotates menacingly.
 */
class PyramidBoss {
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
    this.baseColor = config.color || '#2d2d2d';
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
}

/**
 * Hexagon Fortress Boss - A large hexagonal ship with regenerating health.
 */
class HexagonFortressBoss {
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
    this.baseColor = config.color || '#0a0a0a';
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
}

/**
 * Represents a bullet fired by the Cardinal Warden.
 */
class Bullet {
  constructor(x, y, angle, config = {}) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = config.speed || 200;
    this.damage = config.damage || 1;
    this.size = config.size || 4;
    this.baseColor = config.baseColor || config.color || '#d4af37';
    this.color = config.color || this.baseColor;
    this.piercing = config.piercing || false;
    this.hitEnemies = new Set();
    this.trail = [];
    this.age = 0;
  }

  update(deltaTime) {
    const dt = deltaTime / 1000;
    this.age += deltaTime;
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;

    // Leave behind a short luminous trail for rendering.
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 10) {
      this.trail.shift();
    }
  }

  isOffscreen(width, height) {
    return this.x < -this.size || this.x > width + this.size ||
           this.y < -this.size || this.y > height + this.size;
  }
}

/**
 * Represents a mathematical function bullet that follows wave patterns.
 * These bullets travel primarily in one direction but oscillate following a mathematical function.
 */
class MathBullet {
  constructor(x, y, angle, config = {}) {
    this.startX = x;
    this.startY = y;
    this.x = x;
    this.y = y;
    this.baseAngle = angle;
    this.speed = config.speed || 200;
    this.damage = config.damage || 1;
    this.size = config.size || 4;
    this.baseColor = config.baseColor || config.color || '#d4af37';
    this.color = config.color || '#d4af37';
    
    // Mathematical pattern configuration
    this.pattern = config.pattern || 'sine';
    this.amplitude = config.amplitude || 20;
    this.frequency = config.frequency || 3;
    this.phase = config.phase || 0;

    // Distance traveled along the path
    this.distance = 0;
    this.time = 0;

    this.trail = [];
    this.age = 0;

    // Track pierced targets so mathematical bullets respect single-hit collisions.
    this.hitEnemies = new Set();
  }

  update(deltaTime) {
    const dt = deltaTime / 1000;
    this.time += dt;
    this.age += deltaTime;

    // Move forward along the base angle
    this.distance += this.speed * dt;
    
    // Calculate position along the primary direction
    const primaryX = this.startX + Math.cos(this.baseAngle) * this.distance;
    const primaryY = this.startY + Math.sin(this.baseAngle) * this.distance;
    
    // Calculate perpendicular offset based on mathematical pattern
    let offset = 0;
    const t = this.distance * this.frequency * 0.02 + this.phase;
    
    switch (this.pattern) {
      case 'sine':
        offset = Math.sin(t) * this.amplitude;
        break;
      case 'cosine':
        offset = Math.cos(t) * this.amplitude;
        break;
      case 'fourier':
        // Layered harmonics: primary wave plus a smaller, faster overtone.
        offset = (Math.sin(t) + 0.35 * Math.sin(3 * t)) * this.amplitude;
        break;
      case 'logarithmic':
        // Logarithmic spiral growth: amplitude increases slowly with distance.
        offset = Math.sin(t) * this.amplitude * Math.log1p(1 + this.distance * 0.01);
        break;
      case 'lissajous':
        // Lissajous figure carving braided offsets for intricate weaving arcs.
        offset = Math.sin(t * 0.75 + this.phase) * Math.cos(t * 1.35) * this.amplitude * 1.2;
        break;
      case 'petal':
        // Petal pattern that blooms and closes to mirror danmaku flower rings.
        offset = Math.sin(t) * Math.sin(t * 2 + this.phase) * this.amplitude * 1.4;
        break;
      case 'parabola':
        // Parabolic drift: offset follows (sin(t))^2 for mirrored arcs.
        offset = (Math.pow(Math.sin(t), 2) * 2 - 1) * this.amplitude;
        break;
      case 'tangent':
        // Clamped tangent to prevent extreme values
        offset = Math.max(-this.amplitude, Math.min(this.amplitude, Math.tan(t * 0.5) * this.amplitude * 0.3));
        break;
      case 'spiral':
        // Expanding spiral pattern
        offset = Math.sin(t) * this.amplitude * (1 + this.distance * 0.005);
        break;
      case 'damped':
        // Damped oscillation (amplitude decreases over distance)
        offset = Math.sin(t) * this.amplitude * Math.exp(-this.distance * 0.003);
        break;
      case 'square':
        // Square wave approximation
        offset = Math.sign(Math.sin(t)) * this.amplitude;
        break;
      default:
        offset = Math.sin(t) * this.amplitude;
    }
    
    // Apply perpendicular offset (90 degrees from base angle)
    const perpAngle = this.baseAngle + Math.PI / 2;
    this.x = primaryX + Math.cos(perpAngle) * offset;
    this.y = primaryY + Math.sin(perpAngle) * offset;

    // Record a short trail so renders can draw motion streaks.
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 12) {
      this.trail.shift();
    }
  }

  isOffscreen(width, height) {
    return this.x < -this.size || this.x > width + this.size ||
           this.y < -this.size || this.y > height + this.size;
  }
}

/**
 * Weapon definitions for the Cardinal Warden.
 * Each weapon has a unique mathematical pattern and upgrade path.
 */
const WEAPON_DEFINITIONS = {
  sine: {
    id: 'sine',
    name: 'Sine Wave',
    symbol: 'sin',
    description: 'Fires bullets that follow a smooth sine wave pattern.',
    baseDamage: 1,
    baseSpeed: 180,
    baseFireRate: 500, // ms between shots
    pattern: 'sine',
    amplitude: 20,
    frequency: 3,
    cost: 0, // Free - starter weapon
    upgradeCosts: [10, 25, 50, 100, 200],
    color: '#d4af37',
  },
  cosine: {
    id: 'cosine',
    name: 'Cosine Lattice',
    symbol: 'cos',
    description: 'Alternating twin rails that swap sides every volley.',
    baseDamage: 1.2,
    baseSpeed: 190,
    baseFireRate: 440,
    pattern: 'cosine',
    amplitude: 26,
    frequency: 2.8,
    cost: 50,
    upgradeCosts: [15, 40, 80, 150, 300],
    color: '#ff9c66',
    firePattern: 'alternatingPair',
    arcWidth: Math.PI / 5,
  },
  spiral: {
    id: 'spiral',
    name: 'Spiral Bloom',
    symbol: 'φ',
    description: 'Rotating fan of petals that slowly precess like a danmaku wheel.',
    baseDamage: 0.9,
    baseSpeed: 165,
    baseFireRate: 390,
    pattern: 'spiral',
    amplitude: 18,
    frequency: 4.5,
    cost: 100,
    upgradeCosts: [25, 60, 120, 250, 500],
    color: '#9a6bff',
    firePattern: 'rotatingFan',
    fanCount: 5,
    arcWidth: Math.PI * 0.9,
    rotationStep: Math.PI / 16,
  },
  damped: {
    id: 'damped',
    name: 'Convergent Rails',
    symbol: 'e⁻ˣ',
    description: 'Staggered burst that squeezes into a narrow corridor.',
    baseDamage: 1.6,
    baseSpeed: 205,
    baseFireRate: 590,
    pattern: 'damped',
    amplitude: 30,
    frequency: 3.5,
    cost: 150,
    upgradeCosts: [30, 75, 150, 300, 600],
    color: '#50a0ff',
    firePattern: 'convergingBurst',
    burstCount: 4,
    arcWidth: Math.PI / 7,
  },
  square: {
    id: 'square',
    name: 'Binary Barrage',
    symbol: '⌐⌐',
    description: 'Choppy stutter fire that sprays short-range packets.',
    baseDamage: 2,
    baseSpeed: 175,
    baseFireRate: 660,
    pattern: 'square',
    amplitude: 36,
    frequency: 2.2,
    cost: 200,
    upgradeCosts: [50, 100, 200, 400, 800],
    color: '#ff7deb',
    firePattern: 'rapidBurst',
    pelletCount: 7,
    arcWidth: Math.PI / 4,
  },
  tangent: {
    id: 'tangent',
    name: 'Asymptote Scatter',
    symbol: 'tan',
    description: 'Chaotic angles with clipped spikes for evasive enemies.',
    baseDamage: 1.9,
    baseSpeed: 225,
    baseFireRate: 540,
    pattern: 'tangent',
    amplitude: 42,
    frequency: 2.1,
    cost: 250,
    upgradeCosts: [40, 90, 180, 350, 700],
    color: '#8bf7ff',
    firePattern: 'chaoticSpray',
    arcWidth: Math.PI / 3,
  },
  fourier: {
    id: 'fourier',
    name: 'Fourier Bloom',
    symbol: '∑sin',
    description: 'Full danmaku ring that rotates and layers harmonic petals.',
    baseDamage: 1.6,
    baseSpeed: 190,
    baseFireRate: 510,
    pattern: 'petal',
    amplitude: 30,
    frequency: 3.4,
    cost: 320,
    upgradeCosts: [70, 140, 280, 560, 1120],
    color: '#f2c44d',
    firePattern: 'petalRing',
    petalCount: 12,
    rotationStep: Math.PI / 20,
  },
  logarithmic: {
    id: 'logarithmic',
    name: 'Log Spiral',
    symbol: 'ln(r)',
    description: 'Twin spirals that peel apart with accelerating spin.',
    baseDamage: 1.4,
    baseSpeed: 215,
    baseFireRate: 470,
    pattern: 'logarithmic',
    amplitude: 20,
    frequency: 3,
    cost: 420,
    upgradeCosts: [80, 170, 340, 680, 1360],
    color: '#7cd1b8',
    firePattern: 'spiralPair',
    rotationStep: Math.PI / 24,
    arcWidth: Math.PI / 6,
  },
  parabola: {
    id: 'parabola',
    name: 'Parabolic Weave',
    symbol: 'x²',
    description: 'Layered Lissajous lanes that braid into crossfire ribbons.',
    baseDamage: 2.4,
    baseSpeed: 178,
    baseFireRate: 630,
    pattern: 'lissajous',
    amplitude: 24,
    frequency: 2.2,
    cost: 500,
    upgradeCosts: [90, 190, 380, 760, 1520],
    color: '#c6a1ff',
    firePattern: 'laneWeave',
    laneCount: 4,
    arcWidth: Math.PI * 0.55,
  },
};

/**
 * Get all available weapon IDs.
 */
export function getWeaponIds() {
  return Object.keys(WEAPON_DEFINITIONS);
}

/**
 * Get weapon definition by ID.
 */
export function getWeaponDefinition(weaponId) {
  return WEAPON_DEFINITIONS[weaponId] || null;
}

/**
 * Enemy type configurations for different difficulty tiers.
 */
const ENEMY_TYPES = {
  basic: {
    speed: 80,
    health: 1,
    damage: 5,
    size: 8,
    scoreValue: 10,
    color: '#000000',
  },
  fast: {
    speed: 80,
    health: 1,
    damage: 3,
    size: 6,
    scoreValue: 15,
    color: '#000000',
  },
  tank: {
    speed: 25,
    health: 3,
    damage: 10,
    size: 12,
    scoreValue: 25,
    color: '#000000',
  },
  elite: {
    speed: 50,
    health: 5,
    damage: 15,
    size: 10,
    scoreValue: 50,
    color: '#000000',
  },
};

/**
 * Main Cardinal Warden reverse danmaku simulation.
 */
export class CardinalWardenSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    // Visual style - pure white background, minimalist
    this.nightMode = options.nightMode || false;
    this.bgColor = '#ffffff';
    this.wardenCoreColor = '#d4af37'; // Golden
    this.wardenSquareColor = '#c9a227'; // Slightly darker gold
    this.bulletColor = '#d4af37';
    this.ringStrokeColor = '#d4af37';
    this.uiTextColor = '#333';
    this.enemyTrailColor = '#000000';
    this.enemySmokeColor = '#000000';

    // Game state
    this.running = false;
    this.paused = false;
    this.score = 0;
    this.highScore = options.highScore || 0;
    this.highestWave = options.highestWave || 0; // Track highest wave reached
    this.wave = 0;
    this.difficultyLevel = 0;
    this.enemiesPassedThrough = 0;
    this.maxEnemiesPassedThrough = GAME_CONFIG.MAX_ENEMIES_PASSED;
    this.damageThreshold = GAME_CONFIG.WARDEN_MAX_HEALTH;

    // Game objects
    this.warden = null;
    this.enemies = [];
    this.bullets = [];
    this.bosses = []; // Boss ships array
    this.scorePopups = []; // Floating score text when enemies are destroyed

    // Base health upgrade system (can be upgraded with iterons)
    this.baseHealthLevel = options.baseHealthLevel || 0;
    this.baseHealthUpgradeCost = 50; // Base cost in iterons for first upgrade
    this.baseHealthPerLevel = 10; // Additional health per upgrade level

    // Death and respawn animation state
    this.gamePhase = 'playing'; // 'playing', 'death', 'respawn'
    this.deathAnimTimer = 0;
    this.respawnAnimTimer = 0;
    this.deathShakeIntensity = 0;
    this.deathExplosionParticles = [];
    this.respawnOpacity = 0;

    // Timing
    this.lastFrameTime = 0;
    this.enemySpawnTimer = 0;
    this.bulletSpawnTimer = 0;
    this.waveTimer = 0;
    this.waveDuration = GAME_CONFIG.WAVE_DURATION_MS;
    this.bossSpawnTimer = 0;
    this.baseBossSpawnInterval = 30000; // Base time between boss spawns (30 seconds)

    // Spawn rates (adjusted by difficulty)
    this.baseEnemySpawnInterval = GAME_CONFIG.BASE_ENEMY_SPAWN_INTERVAL_MS;
    this.baseBulletInterval = GAME_CONFIG.BASE_BULLET_INTERVAL_MS;

    // RNG
    this.rng = new SeededRandom(options.seed || Date.now());

    // Callbacks
    this.onScoreChange = options.onScoreChange || null;
    this.onHighScoreChange = options.onHighScoreChange || null;
    this.onWaveChange = options.onWaveChange || null;
    this.onGameOver = options.onGameOver || null;
    this.onHealthChange = options.onHealthChange || null;
    this.onHighestWaveChange = options.onHighestWaveChange || null;

    // Upgrade state (for future expansion)
    this.upgrades = {
      bulletDamage: 1,
      bulletSpeed: 1,
      bulletCount: 1,
      fireRate: 1,
      patterns: ['radial'], // Unlocked patterns
    };

    // Weapon system state
    this.weapons = {
      // Map of weapon ID to weapon state
      purchased: { sine: true }, // Sine wave is the starter weapon
      levels: { sine: 1 }, // Upgrade level (1-6)
      activeWeaponId: 'sine', // Currently firing weapon
      equipped: ['sine'], // Up to 3 weapons can be equipped at a time
    };
    
    // Maximum number of weapons that can be equipped simultaneously
    this.maxEquippedWeapons = 3;
    
    // Weapon-specific timers (each weapon has its own fire rate)
    this.weaponTimers = {
      sine: 0,
    };

    // Weapon phase registry for rotating or alternating shot patterns.
    this.weaponPhases = {
      sine: 0,
    };

    // Animation frame handle
    this.animationFrameId = null;
    
    // Auto-start flag (game starts immediately without menu)
    this.autoStart = options.autoStart !== false;

    // Callback for weapon state changes
    this.onWeaponChange = options.onWeaponChange || null;

    // Apply the initial palette before creating objects.
    this.applyColorMode();

    this.initialize();
  }

  /**
   * Update palette values based on day/night render mode.
   */
  applyColorMode() {
    if (this.nightMode) {
      this.bgColor = '#000000';
      this.wardenCoreColor = '#ffe9a3';
      this.wardenSquareColor = '#ffd76f';
      this.bulletColor = '#ffe585';
      this.ringStrokeColor = '#ffe9a3';
      this.uiTextColor = '#f5f5f5';
      this.enemyTrailColor = '#ffffff';
      this.enemySmokeColor = '#ffffff';
    } else {
      this.bgColor = '#ffffff';
      this.wardenCoreColor = '#d4af37';
      this.wardenSquareColor = '#c9a227';
      this.bulletColor = '#d4af37';
      this.ringStrokeColor = '#d4af37';
      this.uiTextColor = '#333';
      this.enemyTrailColor = '#000000';
      this.enemySmokeColor = '#000000';
    }
  }

  /**
   * Propagate ring colors to existing warden rings so mode toggles are immediate.
   */
  applyRingColors() {
    if (!this.warden) return;
    for (const ring of this.warden.ringSquares) {
      ring.strokeColor = this.ringStrokeColor;
    }
  }

  initialize() {
    if (!this.canvas) return;
    this.initWarden();
    this.applyRingColors();
  }

  /**
   * Toggle the render palette between day and night variants.
   */
  setNightMode(enabled) {
    this.nightMode = Boolean(enabled);
    this.applyColorMode();
    this.applyRingColors();
    this.refreshEnemyColorsForMode();
    this.refreshBulletColorsForMode();
    this.refreshBossColorsForMode();
  }

  /**
   * Keep current enemies aligned with the active color mode.
   */
  refreshEnemyColorsForMode() {
    for (const enemy of this.enemies) {
      enemy.color = this.nightMode ? '#ffffff' : enemy.baseColor;
    }
  }

  /**
   * Keep current bosses aligned with the active color mode.
   */
  refreshBossColorsForMode() {
    for (const boss of this.bosses) {
      boss.color = this.nightMode ? '#ffffff' : boss.baseColor;
    }
  }

  /**
   * Lighten existing bullets when night mode is enabled for consistency.
   */
  refreshBulletColorsForMode() {
    for (const bullet of this.bullets) {
      const sourceColor = bullet.baseColor || bullet.color;
      bullet.color = this.resolveBulletColor(sourceColor);
    }
  }

  /**
   * Resolve an appropriate bullet tint for the active palette.
   */
  resolveBulletColor(baseColor) {
    if (this.nightMode) {
      return lightenHexColor(baseColor || this.bulletColor, 0.35);
    }
    return baseColor || this.bulletColor;
  }

  initWarden() {
    if (!this.canvas) return;
    // Position warden in lower third of canvas (boss position in danmaku)
    const x = this.canvas.width / 2;
    const y = this.canvas.height * 0.75;
    this.warden = new CardinalWarden(x, y, this.rng);
    
    // Apply base health upgrade
    const bonusHealth = this.baseHealthLevel * this.baseHealthPerLevel;
    this.warden.maxHealth = GAME_CONFIG.WARDEN_MAX_HEALTH + bonusHealth;
    this.warden.health = this.warden.maxHealth;
  }

  /**
   * Get the current base health upgrade level.
   */
  getBaseHealthLevel() {
    return this.baseHealthLevel;
  }

  /**
   * Get the cost to upgrade base health to the next level.
   * Cost increases by 50% each level: 50, 75, 112, 168, 252...
   */
  getBaseHealthUpgradeCost() {
    return Math.floor(this.baseHealthUpgradeCost * Math.pow(1.5, this.baseHealthLevel));
  }

  /**
   * Get the current max health (base + upgrades).
   */
  getMaxHealth() {
    return GAME_CONFIG.WARDEN_MAX_HEALTH + this.baseHealthLevel * this.baseHealthPerLevel;
  }

  /**
   * Upgrade base health (call after spending iterons externally).
   * @returns {boolean} True if upgrade was applied
   */
  upgradeBaseHealth() {
    this.baseHealthLevel += 1;
    
    // Apply to current warden if it exists
    if (this.warden) {
      const bonusHealth = this.baseHealthLevel * this.baseHealthPerLevel;
      const oldMaxHealth = this.warden.maxHealth;
      this.warden.maxHealth = GAME_CONFIG.WARDEN_MAX_HEALTH + bonusHealth;
      // Heal by the amount of new health gained
      this.warden.health = Math.min(this.warden.maxHealth, this.warden.health + (this.warden.maxHealth - oldMaxHealth));
      if (this.onHealthChange) {
        this.onHealthChange(this.warden.health, this.warden.maxHealth);
      }
    }
    
    return true;
  }

  /**
   * Set the base health level (for loading saved state).
   * @param {number} level - The level to set
   */
  setBaseHealthLevel(level) {
    this.baseHealthLevel = Math.max(0, Math.floor(level));
    // Apply to current warden if it exists
    if (this.warden) {
      const bonusHealth = this.baseHealthLevel * this.baseHealthPerLevel;
      this.warden.maxHealth = GAME_CONFIG.WARDEN_MAX_HEALTH + bonusHealth;
      this.warden.health = Math.min(this.warden.health, this.warden.maxHealth);
    }
  }

  /**
   * Start the simulation.
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastFrameTime = performance.now();
    this.gameLoop();
  }

  /**
   * Stop the simulation.
   */
  stop() {
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Pause/unpause the simulation.
   */
  togglePause() {
    this.paused = !this.paused;
    if (!this.paused) {
      this.lastFrameTime = performance.now();
    }
  }

  /**
   * Reset the game to initial state. Preserves highest wave for Shin Glyph tracking.
   */
  reset() {
    // Check for high score before resetting
    if (this.score > this.highScore) {
      this.highScore = this.score;
      if (this.onHighScoreChange) {
        this.onHighScoreChange(this.highScore);
      }
    }

    this.score = 0;
    this.wave = 0;
    this.difficultyLevel = 0;
    this.enemiesPassedThrough = 0;
    this.enemies = [];
    this.bullets = [];
    this.bosses = [];
    this.enemySpawnTimer = 0;
    this.bulletSpawnTimer = 0;
    this.waveTimer = 0;
    this.bossSpawnTimer = 0;
    
    // Reset animation state
    this.gamePhase = 'playing';
    this.deathAnimTimer = 0;
    this.respawnAnimTimer = 0;
    this.deathShakeIntensity = 0;
    this.deathExplosionParticles = [];
    this.respawnOpacity = 1;

    if (this.warden) {
      this.warden.reset();
    } else {
      this.initWarden();
    }

    if (this.onScoreChange) {
      this.onScoreChange(this.score);
    }
    if (this.onWaveChange) {
      this.onWaveChange(this.wave);
    }
    if (this.onHealthChange && this.warden) {
      this.onHealthChange(this.warden.health, this.warden.maxHealth);
    }
  }

  /**
   * Main game loop.
   */
  gameLoop() {
    if (!this.running) return;

    const now = performance.now();
    // Cap delta to ~2 frames at 60fps to prevent objects teleporting through each other
    const deltaTime = Math.min(now - this.lastFrameTime, GAME_CONFIG.MAX_DELTA_TIME_MS);
    this.lastFrameTime = now;

    if (!this.paused) {
      this.update(deltaTime);
    }

    this.render();

    this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * Update game state.
   */
  update(deltaTime) {
    // Handle different game phases
    switch (this.gamePhase) {
      case 'death':
        this.updateDeathAnimation(deltaTime);
        return;
      case 'respawn':
        this.updateRespawnAnimation(deltaTime);
        return;
      case 'playing':
      default:
        break;
    }

    // Update wave timer
    this.waveTimer += deltaTime;
    if (this.waveTimer >= this.waveDuration) {
      this.waveTimer = 0;
      this.wave++;
      this.difficultyLevel = Math.floor(this.wave / 3);
      
      // Track highest wave reached
      if (this.wave > this.highestWave) {
        this.highestWave = this.wave;
        if (this.onHighestWaveChange) {
          this.onHighestWaveChange(this.highestWave);
        }
      }
      
      if (this.onWaveChange) {
        this.onWaveChange(this.wave);
      }
    }

    // Update Cardinal Warden
    if (this.warden) {
      this.warden.update(deltaTime);
    }

    // Spawn enemies
    this.enemySpawnTimer += deltaTime;
    const spawnInterval = this.getEnemySpawnInterval();
    if (this.enemySpawnTimer >= spawnInterval) {
      this.enemySpawnTimer = 0;
      this.spawnEnemy();
    }

    // Spawn bosses (start spawning at minimum boss difficulty)
    if (this.difficultyLevel >= GAME_CONFIG.BOSS_MIN_DIFFICULTY) {
      this.bossSpawnTimer += deltaTime;
      const bossSpawnInterval = this.getBossSpawnInterval();
      if (this.bossSpawnTimer >= bossSpawnInterval) {
        this.bossSpawnTimer = 0;
        this.spawnBoss();
      }
    }

    // Fire bullets for each purchased weapon based on their individual fire rates
    this.updateWeaponTimers(deltaTime);

    // Update enemies
    this.updateEnemies(deltaTime);

    // Update bosses
    this.updateBosses(deltaTime);

    // Update bullets
    this.updateBullets(deltaTime);

    // Check collisions
    this.checkCollisions();

    // Update floating score popups
    this.updateScorePopups(deltaTime);

    // Check game over conditions
    this.checkGameOver();
  }
  
  /**
   * Update weapon timers and fire bullets when ready.
   * Only fires equipped weapons (limited to maxEquippedWeapons).
   */
  updateWeaponTimers(deltaTime) {
    if (!this.warden || !this.canvas) return;
    
    // Only fire weapons that are both purchased AND equipped
    const equippedWeapons = this.weapons.equipped || [];
    
    for (const weaponId of equippedWeapons) {
      if (!this.weapons.purchased[weaponId]) continue;
      
      const weaponDef = WEAPON_DEFINITIONS[weaponId];
      if (!weaponDef) continue;
      
      // Initialize timer if needed
      if (this.weaponTimers[weaponId] === undefined) {
        this.weaponTimers[weaponId] = 0;
      }
      
      // Calculate fire rate based on level (higher level = faster fire rate)
      const level = this.weapons.levels[weaponId] || 1;
      const fireRateMultiplier = 1 - (level - 1) * 0.08; // 8% faster per level
      const fireInterval = weaponDef.baseFireRate * fireRateMultiplier * (1 / this.upgrades.fireRate);
      
      this.weaponTimers[weaponId] += deltaTime;
      
      if (this.weaponTimers[weaponId] >= fireInterval) {
        this.weaponTimers[weaponId] = 0;
        this.fireWeapon(weaponId);
      }
    }
  }
  
  /**
   * Fire bullets from a specific weapon.
   */
  fireWeapon(weaponId) {
    if (!this.warden || !this.canvas) return;
    
    const weaponDef = WEAPON_DEFINITIONS[weaponId];
    if (!weaponDef) return;
    
    const cx = this.warden.x;
    const cy = this.warden.y;
    const level = this.weapons.levels[weaponId] || 1;
    
    // Calculate stats based on level
    const damageMultiplier = 1 + (level - 1) * 0.25;
    const speedMultiplier = 1 + (level - 1) * 0.1;

    const resolvedColor = this.resolveBulletColor(weaponDef.color);

    const bulletConfig = {
      speed: weaponDef.baseSpeed * speedMultiplier * this.upgrades.bulletSpeed,
      damage: weaponDef.baseDamage * damageMultiplier * this.upgrades.bulletDamage,
      size: 4 + Math.floor(level / 2),
      baseColor: weaponDef.color,
      color: resolvedColor,
      pattern: weaponDef.pattern,
      amplitude: weaponDef.amplitude * (1 + (level - 1) * 0.15),
      frequency: weaponDef.frequency,
    };

    // Track phase rotation per weapon for persistent fan and ring choreography.
    if (this.weaponPhases[weaponId] === undefined) {
      this.weaponPhases[weaponId] = 0;
    }

    // Helper to instantiate a math bullet with optional overrides for pattern variety.
    const spawnBullet = (angle, overrides = {}, phaseOffset = 0) => {
      this.bullets.push(new MathBullet(cx, cy - 20, angle, {
        ...bulletConfig,
        ...overrides,
        phase: overrides.phase !== undefined ? overrides.phase : phaseOffset,
      }));
    };

    // Default launch angle aims upward before pattern-specific offsets are applied.
    const baseAngle = -Math.PI / 2;
    const firePattern = weaponDef.firePattern || 'standard';
    const basePhase = this.weaponPhases[weaponId];

    switch (firePattern) {
      case 'alternatingPair': {
        // Swap sides each volley to create interlocking cosine rails.
        const swing = weaponDef.arcWidth || Math.PI / 6;
        const polarity = this.weaponPhases[weaponId] === 0 ? 1 : this.weaponPhases[weaponId];
        this.weaponPhases[weaponId] = -polarity;
        spawnBullet(baseAngle - swing * polarity, {}, basePhase);
        spawnBullet(baseAngle + swing * polarity, {}, basePhase + Math.PI / 2);
        return;
      }
      case 'rotatingFan': {
        // Petal fan that rotates a few degrees each volley for danmaku coverage.
        const fanCount = weaponDef.fanCount || 5;
        const arcWidth = weaponDef.arcWidth || Math.PI * 0.75;
        const rotationStep = weaponDef.rotationStep || Math.PI / 18;
        const startAngle = baseAngle + this.weaponPhases[weaponId];
        for (let i = 0; i < fanCount; i++) {
          const offset = fanCount > 1 ? (i / (fanCount - 1) - 0.5) * arcWidth : 0;
          spawnBullet(startAngle + offset, {}, basePhase + i * 0.35);
        }
        this.weaponPhases[weaponId] += rotationStep;
        return;
      }
      case 'convergingBurst': {
        // Tight staggered burst that squeezes inward for boss shredding.
        const burstCount = weaponDef.burstCount || 3;
        const arcWidth = weaponDef.arcWidth || Math.PI / 8;
        for (let i = 0; i < burstCount; i++) {
          const lerp = burstCount > 1 ? (i / (burstCount - 1) - 0.5) : 0;
          const angle = baseAngle + lerp * arcWidth;
          const amplitudeScale = 1 - Math.abs(lerp) * 0.25;
          spawnBullet(angle, { amplitude: bulletConfig.amplitude * amplitudeScale }, basePhase + i * 0.2);
        }
        return;
      }
      case 'rapidBurst': {
        // Short-range packet spray to clear dense enemy clusters.
        const pelletCount = weaponDef.pelletCount || 6;
        const arcWidth = weaponDef.arcWidth || Math.PI / 5;
        for (let i = 0; i < pelletCount; i++) {
          const jitter = this.rng.range(-arcWidth / 2, arcWidth / 2);
          const speedScale = 0.9 + 0.05 * (i % 2);
          spawnBullet(baseAngle + jitter, { speed: bulletConfig.speed * speedScale }, basePhase + i * 0.15);
        }
        return;
      }
      case 'chaoticSpray': {
        // Chaotic spray that jitters angle and amplitude to mimic asymptotes.
        const sprayWidth = weaponDef.arcWidth || Math.PI / 3;
        const shardCount = 4 + Math.floor(level / 2);
        for (let i = 0; i < shardCount; i++) {
          const jitter = this.rng.range(-sprayWidth / 2, sprayWidth / 2);
          const wobble = 0.6 + this.rng.next() * 0.8;
          spawnBullet(baseAngle + jitter, { amplitude: bulletConfig.amplitude * wobble }, basePhase + i * 0.25);
        }
        return;
      }
      case 'petalRing': {
        // Full radial danmaku ring with gentle rotation between volleys.
        const petalCount = weaponDef.petalCount || 10;
        const rotationStep = weaponDef.rotationStep || Math.PI / 24;
        const ringStart = this.weaponPhases[weaponId];
        for (let i = 0; i < petalCount; i++) {
          const ringAngle = ringStart + (i * (Math.PI * 2 / petalCount));
          const speedScale = i % 2 === 0 ? 1 : 0.9;
          spawnBullet(ringAngle, { speed: bulletConfig.speed * speedScale, size: bulletConfig.size + 1 }, basePhase + i * 0.18);
        }
        this.weaponPhases[weaponId] += rotationStep;
        return;
      }
      case 'spiralPair': {
        // Counter-spinning spiral pair that peels apart with each volley.
        const rotationStep = weaponDef.rotationStep || Math.PI / 28;
        const spread = weaponDef.arcWidth || Math.PI / 6;
        const phase = this.weaponPhases[weaponId];
        const angles = [baseAngle + phase + spread, baseAngle - phase - spread];
        angles.forEach((angle, index) => {
          const amplitudeScale = 1 + 0.15 * index;
          spawnBullet(angle, { amplitude: bulletConfig.amplitude * amplitudeScale }, basePhase + index * 0.4);
        });
        this.weaponPhases[weaponId] += rotationStep;
        return;
      }
      case 'laneWeave': {
        // Braided Lissajous lanes for wide-area suppression.
        const lanes = weaponDef.laneCount || 3;
        const arcWidth = weaponDef.arcWidth || Math.PI / 2;
        for (let i = 0; i < lanes; i++) {
          const offset = lanes > 1 ? (i / (lanes - 1) - 0.5) * arcWidth : 0;
          spawnBullet(baseAngle + offset, {}, basePhase + i * 0.22);
        }
        this.weaponPhases[weaponId] += Math.PI / 30;
        return;
      }
      default: {
        // Standard volley: level-based multishot with gentle spread.
        const bulletCount = 1 + Math.floor(level / 2);
        const spreadAngle = weaponDef.arcWidth || Math.PI * 0.6;
        for (let i = 0; i < bulletCount; i++) {
          const angleOffset = bulletCount > 1 ? (i / (bulletCount - 1) - 0.5) * spreadAngle : 0;
          const phaseOffset = i * (Math.PI * 2 / bulletCount);
          spawnBullet(baseAngle + angleOffset, {}, phaseOffset);
        }
      }
    }
  }
  
  /**
   * Update death animation (Cardinal Warden shaking and exploding).
   */
  updateDeathAnimation(deltaTime) {
    const dt = deltaTime / 1000;
    this.deathAnimTimer += deltaTime;
    
    // Phase 1: Shake intensifies (0 - 1000ms)
    if (this.deathAnimTimer < 1000) {
      this.deathShakeIntensity = (this.deathAnimTimer / 1000) * 15;
    }
    // Phase 2: Explosion (1000 - 1500ms)
    else if (this.deathAnimTimer < 1500) {
      if (this.deathExplosionParticles.length === 0) {
        this.createExplosionParticles();
      }
      // Update explosion particles
      for (const particle of this.deathExplosionParticles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.life -= dt;
        particle.alpha = Math.max(0, particle.life / particle.maxLife);
      }
      // Clear all enemies during explosion
      this.enemies = [];
    }
    // Phase 3: Fade out particles and transition to respawn (1500 - 2500ms)
    else if (this.deathAnimTimer < 2500) {
      for (const particle of this.deathExplosionParticles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.life -= dt;
        particle.alpha = Math.max(0, particle.life / particle.maxLife);
      }
    }
    // Phase 4: Start respawn animation
    else {
      this.startRespawnAnimation();
    }
  }
  
  /**
   * Create explosion particles for death animation.
   */
  createExplosionParticles() {
    if (!this.warden) return;
    
    const particleCount = 40;
    for (let i = 0; i < particleCount; i++) {
      const angle = this.rng.range(0, Math.PI * 2);
      const speed = this.rng.range(50, 200);
      this.deathExplosionParticles.push({
        x: this.warden.x,
        y: this.warden.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: this.rng.range(3, 10),
        color: this.rng.next() > 0.5 ? this.wardenCoreColor : this.wardenSquareColor,
        life: this.rng.range(0.5, 1.5),
        maxLife: 1.5,
        alpha: 1,
      });
    }
  }
  
  /**
   * Start the respawn animation.
   */
  startRespawnAnimation() {
    this.gamePhase = 'respawn';
    this.respawnAnimTimer = 0;
    this.respawnOpacity = 0;
    this.deathExplosionParticles = [];
    
    // Reset game state but preserve highest wave and score tracking
    this.score = 0;
    this.wave = 0;
    this.difficultyLevel = 0;
    this.enemiesPassedThrough = 0;
    this.enemies = [];
    this.bullets = [];
    this.bosses = [];
    this.enemySpawnTimer = 0;
    this.bulletSpawnTimer = 0;
    this.waveTimer = 0;
    this.bossSpawnTimer = 0;

    // Reinitialize warden
    this.initWarden();
    this.applyRingColors();
    if (this.warden) {
      this.warden.health = this.warden.maxHealth;
    }
    
    // Notify callbacks
    if (this.onScoreChange) {
      this.onScoreChange(this.score);
    }
    if (this.onWaveChange) {
      this.onWaveChange(this.wave);
    }
    if (this.onHealthChange && this.warden) {
      this.onHealthChange(this.warden.health, this.warden.maxHealth);
    }
  }
  
  /**
   * Update respawn animation (Cardinal Warden fading in).
   */
  updateRespawnAnimation(deltaTime) {
    this.respawnAnimTimer += deltaTime;
    
    // Fade in over 1.5 seconds
    const fadeDuration = 1500;
    this.respawnOpacity = Math.min(1, this.respawnAnimTimer / fadeDuration);
    
    // Update warden animation even during respawn
    if (this.warden) {
      this.warden.update(deltaTime);
    }
    
    // After fade in complete, resume playing
    if (this.respawnAnimTimer >= fadeDuration + 500) {
      this.gamePhase = 'playing';
      this.respawnOpacity = 1;
    }
  }

  /**
   * Get current enemy spawn interval based on difficulty.
   */
  getEnemySpawnInterval() {
    const reduction = this.difficultyLevel * 100;
    return Math.max(500, this.baseEnemySpawnInterval - reduction);
  }

  /**
   * Spawn an enemy based on current difficulty.
   */
  spawnEnemy() {
    if (!this.canvas) return;

    // Determine enemy type based on difficulty
    const typePool = this.getEnemyTypePool();
    const typeKey = typePool[this.rng.int(0, typePool.length - 1)];
    const baseConfig = ENEMY_TYPES[typeKey];

    // Scale stats by difficulty
    const difficultyMultiplier = 1 + this.difficultyLevel * 0.15;
    
    // Determine if this ship should weave (30% chance for fast/elite types)
    const canWeave = typeKey === 'fast' || typeKey === 'elite';
    const shouldWeave = canWeave && this.rng.next() < 0.3;
    
    const config = {
      ...baseConfig,
      speed: baseConfig.speed * (1 + this.difficultyLevel * 0.1),
      health: Math.ceil(baseConfig.health * difficultyMultiplier),
      damage: Math.ceil(baseConfig.damage * (1 + this.difficultyLevel * 0.05)),
      scoreValue: Math.ceil(baseConfig.scoreValue * difficultyMultiplier),
      type: typeKey,
      acceleration: baseConfig.speed * 1.5, // Acceleration scales with speed
      weaving: shouldWeave,
      waveAmplitude: shouldWeave ? this.rng.range(20, 50) : 0,
      waveFrequency: shouldWeave ? this.rng.range(0.5, 2) : 0,
      wavePhase: shouldWeave ? this.rng.range(0, Math.PI * 2) : 0,
    };

    // Random x position at top of screen
    const x = this.rng.range(config.size, this.canvas.width - config.size);
    const y = -config.size;

    const ship = new EnemyShip(x, y, config);
    ship.color = this.nightMode ? '#ffffff' : ship.baseColor;
    // Set initial target lower on screen
    ship.pickNewTarget(this.canvas.width, this.canvas.height, this.rng);
    this.enemies.push(ship);
  }

  /**
   * Get pool of enemy types available at current difficulty.
   */
  getEnemyTypePool() {
    const pool = ['basic'];
    if (this.difficultyLevel >= 1) pool.push('fast');
    if (this.difficultyLevel >= 2) pool.push('tank');
    if (this.difficultyLevel >= 4) pool.push('elite');
    return pool;
  }

  /**
   * Get boss spawn interval based on difficulty.
   * Higher difficulty = more frequent boss spawns.
   */
  getBossSpawnInterval() {
    const reduction = Math.min(
      this.difficultyLevel * GAME_CONFIG.BOSS_SPAWN_INTERVAL_REDUCTION_PER_LEVEL,
      GAME_CONFIG.BOSS_SPAWN_INTERVAL_MAX_REDUCTION
    );
    return Math.max(GAME_CONFIG.BOSS_SPAWN_INTERVAL_MIN, this.baseBossSpawnInterval - reduction);
  }

  /**
   * Get pool of boss types available at current difficulty.
   */
  getBossTypePool() {
    const pool = [];
    // Circle Carrier available at minimum boss difficulty
    if (this.difficultyLevel >= GAME_CONFIG.BOSS_MIN_DIFFICULTY) pool.push('circleCarrier');
    // Pyramid Boss available at difficulty 5+
    if (this.difficultyLevel >= GAME_CONFIG.BOSS_MIN_DIFFICULTY + 2) pool.push('pyramidBoss');
    // Hexagon Fortress available at difficulty 7+
    if (this.difficultyLevel >= GAME_CONFIG.BOSS_MIN_DIFFICULTY + 4) pool.push('hexagonFortress');
    return pool.length > 0 ? pool : ['circleCarrier'];
  }

  /**
   * Spawn a boss ship based on current difficulty.
   */
  spawnBoss() {
    if (!this.canvas) return;

    const typePool = this.getBossTypePool();
    const typeKey = typePool[this.rng.int(0, typePool.length - 1)];
    const baseConfig = BOSS_TYPES[typeKey];

    // Scale boss stats by difficulty
    const difficultyMultiplier = 1 + (this.difficultyLevel - GAME_CONFIG.BOSS_MIN_DIFFICULTY) * GAME_CONFIG.BOSS_DIFFICULTY_SCALE;

    const config = {
      ...baseConfig,
      speed: baseConfig.speed * (1 + (this.difficultyLevel - GAME_CONFIG.BOSS_MIN_DIFFICULTY) * 0.05),
      health: Math.ceil(baseConfig.health * difficultyMultiplier),
      damage: Math.ceil(baseConfig.damage * difficultyMultiplier),
      scoreValue: Math.ceil(baseConfig.scoreValue * difficultyMultiplier),
    };

    // Random x position at top of screen
    const x = this.rng.range(config.size * 2, this.canvas.width - config.size * 2);
    const y = -config.size;

    let boss;
    switch (typeKey) {
      case 'circleCarrier':
        boss = new CircleCarrierBoss(x, y, config);
        break;
      case 'pyramidBoss':
        boss = new PyramidBoss(x, y, config);
        break;
      case 'hexagonFortress':
        boss = new HexagonFortressBoss(x, y, config);
        break;
      default:
        boss = new CircleCarrierBoss(x, y, config);
    }

    boss.color = this.nightMode ? '#ffffff' : boss.baseColor;
    boss.pickNewTarget(this.canvas.width, this.canvas.height, this.rng);
    this.bosses.push(boss);
  }

  /**
   * Update all boss ships.
   */
  updateBosses(deltaTime) {
    if (!this.canvas) return;

    const bottomY = this.canvas.height + 20;
    const toRemove = [];

    for (let i = 0; i < this.bosses.length; i++) {
      const boss = this.bosses[i];
      const result = boss.update(deltaTime, bottomY, this.canvas.width, this.canvas.height, this.rng);

      // Handle different return types
      let passedThrough = false;
      let newShips = [];

      if (typeof result === 'object' && result !== null) {
        passedThrough = result.passedThrough;
        newShips = result.newShips || [];
      } else {
        passedThrough = result;
      }

      // Spawn ships from Circle Carrier bosses
      for (const spawnData of newShips) {
        this.spawnShipFromBoss(spawnData, boss);
      }

      if (passedThrough) {
        this.enemiesPassedThrough += 2; // Bosses count as 2 ships passing through
        toRemove.push(i);
        // Bosses deal more damage when passing through
        if (this.warden) {
          this.warden.takeDamage(boss.damage);
          if (this.onHealthChange) {
            this.onHealthChange(this.warden.health, this.warden.maxHealth);
          }
        }
      }
    }

    // Remove passed bosses
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.bosses.splice(toRemove[i], 1);
    }
  }

  /**
   * Spawn a small ship from a boss (used by Circle Carrier).
   */
  spawnShipFromBoss(spawnData, boss) {
    if (!this.canvas) return;

    // Create a small, fast ship that launches from the boss position
    const config = {
      speed: 60 + this.difficultyLevel * 5,
      health: 1,
      damage: 3,
      size: 6,
      scoreValue: 5,
      color: '#555',
      type: 'spawned',
      acceleration: 100,
      weaving: false,
    };

    const ship = new EnemyShip(spawnData.x, spawnData.y, config);
    ship.color = this.nightMode ? '#ffffff' : ship.baseColor;

    // Give the spawned ship initial velocity in the spawn direction
    const launchSpeed = 40;
    ship.vx = Math.cos(spawnData.angle) * launchSpeed;
    ship.vy = Math.sin(spawnData.angle) * launchSpeed;

    // Set target further down
    ship.targetX = spawnData.x + Math.cos(spawnData.angle) * 100;
    ship.targetY = spawnData.y + Math.sin(spawnData.angle) * 100 + 150;

    this.enemies.push(ship);
  }

  /**
   * Update all enemies.
   */
  updateEnemies(deltaTime) {
    if (!this.canvas) return;

    const bottomY = this.canvas.height + 20;
    const toRemove = [];

    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      const passedThrough = enemy.update(deltaTime, bottomY, this.canvas.width, this.canvas.height, this.rng);

      if (passedThrough) {
        this.enemiesPassedThrough++;
        toRemove.push(i);
        // Enemies passing through also deal damage to warden
        if (this.warden) {
          this.warden.takeDamage(enemy.damage);
          if (this.onHealthChange) {
            this.onHealthChange(this.warden.health, this.warden.maxHealth);
          }
        }
      }
    }

    // Remove passed enemies (reverse order to maintain indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.enemies.splice(toRemove[i], 1);
    }
  }

  /**
   * Update all bullets.
   */
  updateBullets(deltaTime) {
    if (!this.canvas) return;

    const toRemove = [];

    for (let i = 0; i < this.bullets.length; i++) {
      const bullet = this.bullets[i];
      bullet.update(deltaTime);

      if (bullet.isOffscreen(this.canvas.width, this.canvas.height)) {
        toRemove.push(i);
      }
    }

    // Remove offscreen bullets
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.bullets.splice(toRemove[i], 1);
    }
  }

  /**
   * Check collisions between bullets and enemies.
   */
  checkCollisions() {
    const bulletsToRemove = new Set();
    const enemiesToRemove = new Set();

    for (let bi = 0; bi < this.bullets.length; bi++) {
      const bullet = this.bullets[bi];
      if (bulletsToRemove.has(bi)) continue;

      // Initialize collision memory for bullet variants that don't define it.
      const hitEnemies = bullet.hitEnemies || (bullet.hitEnemies = new Set());

      for (let ei = 0; ei < this.enemies.length; ei++) {
        const enemy = this.enemies[ei];
        if (enemiesToRemove.has(ei)) continue;
        if (hitEnemies.has(ei)) continue;

        const dx = bullet.x - enemy.x;
        const dy = bullet.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const collisionDist = bullet.size + enemy.size;

        if (dist < collisionDist) {
          const killed = enemy.takeDamage(bullet.damage);

          if (killed) {
            enemiesToRemove.add(ei);
            this.addScore(enemy.scoreValue);
            // Spawn floating score popup at enemy position
            this.spawnScorePopup(enemy.x, enemy.y, enemy.scoreValue);
          }

          if (bullet.piercing) {
            hitEnemies.add(ei);
          } else {
            bulletsToRemove.add(bi);
            break;
          }
        }
      }
    }

    // Remove destroyed enemies first (before boss collision check)
    const enemyIndices = Array.from(enemiesToRemove).sort((a, b) => b - a);
    for (const i of enemyIndices) {
      this.enemies.splice(i, 1);
    }

    // Check collisions with bosses (using remaining bullets)
    const bossesToRemove = new Set();
    for (let bi = 0; bi < this.bullets.length; bi++) {
      const bullet = this.bullets[bi];
      if (bulletsToRemove.has(bi)) continue;

      const hitBosses = bullet.hitBosses || (bullet.hitBosses = new Set());

      for (let boi = 0; boi < this.bosses.length; boi++) {
        const boss = this.bosses[boi];
        if (bossesToRemove.has(boi)) continue;
        if (hitBosses.has(boi)) continue;

        const dx = bullet.x - boss.x;
        const dy = bullet.y - boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const collisionDist = bullet.size + boss.size;

        if (dist < collisionDist) {
          const killed = boss.takeDamage(bullet.damage);

          if (killed) {
            bossesToRemove.add(boi);
            this.addScore(boss.scoreValue);
            // Spawn floating score popup at boss position
            this.spawnScorePopup(boss.x, boss.y, boss.scoreValue);
          }

          if (bullet.piercing) {
            hitBosses.add(boi);
          } else {
            bulletsToRemove.add(bi);
            break;
          }
        }
      }
    }

    // Remove destroyed bosses
    const bossIndices = Array.from(bossesToRemove).sort((a, b) => b - a);
    for (const i of bossIndices) {
      this.bosses.splice(i, 1);
    }

    // Remove all bullets that hit enemies or bosses (single pass)
    const bulletIndices = Array.from(bulletsToRemove).sort((a, b) => b - a);
    for (const i of bulletIndices) {
      this.bullets.splice(i, 1);
    }
  }

  /**
   * Add score and notify listeners.
   */
  addScore(amount) {
    this.score += amount;
    if (this.onScoreChange) {
      this.onScoreChange(this.score);
    }
  }

  /**
   * Spawn a floating score popup at the given position.
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} value - Score value to display
   */
  spawnScorePopup(x, y, value) {
    this.scorePopups.push({
      x,
      y,
      value,
      age: 0,
      alpha: 1,
      offsetY: 0,
    });
  }

  /**
   * Update all floating score popups.
   * @param {number} deltaTime - Time elapsed since last frame in ms
   */
  updateScorePopups(deltaTime) {
    const dt = deltaTime / 1000;
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const popup = this.scorePopups[i];
      popup.age += dt;
      popup.offsetY -= 40 * dt; // Float upward
      popup.alpha = Math.max(0, 1 - popup.age / 1.0); // Fade out over 1 second
      
      // Remove popups that have fully faded
      if (popup.alpha <= 0 || popup.age > 1.0) {
        this.scorePopups.splice(i, 1);
      }
    }
  }

  /**
   * Render all floating score popups.
   */
  renderScorePopups() {
    if (!this.ctx) return;
    
    const ctx = this.ctx;
    ctx.save();
    ctx.font = 'bold 14px "Cormorant Garamond", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (const popup of this.scorePopups) {
      ctx.globalAlpha = popup.alpha;
      // Use a contrasting color based on night mode
      ctx.fillStyle = this.nightMode ? '#ffcc00' : '#d4af37';
      ctx.fillText(`+${popup.value}`, popup.x, popup.y + popup.offsetY);
    }
    
    ctx.restore();
  }

  /**
   * Check if game over conditions are met.
   */
  checkGameOver() {
    const gameOver = this.enemiesPassedThrough >= this.maxEnemiesPassedThrough ||
                     (this.warden && this.warden.health <= 0);

    if (gameOver && this.gamePhase === 'playing') {
      // Check for new high score before updating
      const isNewHighScore = this.score > this.highScore;
      
      // Update high score before death animation
      if (isNewHighScore) {
        this.highScore = this.score;
        if (this.onHighScoreChange) {
          this.onHighScoreChange(this.highScore);
        }
      }

      if (this.onGameOver) {
        this.onGameOver({
          score: this.score,
          highScore: this.highScore,
          wave: this.wave,
          highestWave: this.highestWave,
          isNewHighScore: isNewHighScore,
        });
      }

      // Start death animation instead of immediate reset
      this.startDeathAnimation();
    }
  }
  
  /**
   * Start the death animation sequence.
   */
  startDeathAnimation() {
    this.gamePhase = 'death';
    this.deathAnimTimer = 0;
    this.deathShakeIntensity = 0;
    this.deathExplosionParticles = [];
  }

  /**
   * Render the game.
   */
  render() {
    if (!this.ctx || !this.canvas) return;

    // Clear with current background color
    this.ctx.fillStyle = this.bgColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Render based on game phase
    switch (this.gamePhase) {
      case 'death':
        this.renderDeathAnimation();
        break;
      case 'respawn':
        this.renderRespawnAnimation();
        break;
      case 'playing':
      default:
        // Draw Cardinal Warden
        this.renderWarden();
        // Draw enemies
        this.renderEnemies();
        // Draw bosses
        this.renderBosses();
        // Draw bullets
        this.renderBullets();
        // Draw floating score popups
        this.renderScorePopups();
        break;
    }

    // Draw UI overlays
    this.renderUI();
  }
  
  /**
   * Render the death animation.
   */
  renderDeathAnimation() {
    const ctx = this.ctx;
    
    // During shake phase, render shaking warden
    if (this.deathAnimTimer < 1000 && this.warden) {
      ctx.save();
      // Apply shake offset
      const shakeX = (Math.random() - 0.5) * 2 * this.deathShakeIntensity;
      const shakeY = (Math.random() - 0.5) * 2 * this.deathShakeIntensity;
      ctx.translate(shakeX, shakeY);
      this.renderWarden();
      ctx.restore();
      
      // Still show enemies during shake
      this.renderEnemies();
      this.renderBosses();
      this.renderBullets();
    }
    
    // Render explosion particles
    for (const particle of this.deathExplosionParticles) {
      if (particle.alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = particle.alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  
  /**
   * Render the respawn animation.
   */
  renderRespawnAnimation() {
    const ctx = this.ctx;
    
    if (!this.warden) return;
    
    ctx.save();
    ctx.globalAlpha = this.respawnOpacity;
    this.renderWarden();
    ctx.restore();
  }

  /**
   * Render the Cardinal Warden.
   */
  renderWarden() {
    if (!this.warden || !this.ctx) return;

    const ctx = this.ctx;
    const warden = this.warden;

    // Draw ring squares first (behind everything else)
    for (const ring of warden.ringSquares) {
      ring.render(ctx, warden.x, warden.y);
    }

    // Draw orbital squares
    ctx.save();
    if (this.nightMode) {
      ctx.shadowColor = this.wardenCoreColor;
      ctx.shadowBlur = 18;
    }

    ctx.fillStyle = this.wardenSquareColor;
    for (const square of warden.orbitalSquares) {
      const pos = square.getPosition(warden.x, warden.y);

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(square.selfRotation);

      const halfSize = square.size / 2;
      ctx.fillRect(-halfSize, -halfSize, square.size, square.size);

      ctx.restore();
    }

    // Draw core orb
    ctx.beginPath();
    ctx.arc(warden.x, warden.y, warden.coreRadius, 0, Math.PI * 2);
    ctx.fillStyle = this.wardenCoreColor;
    ctx.fill();

    // Draw inner highlight
    ctx.beginPath();
    ctx.arc(warden.x - 4, warden.y - 4, warden.coreRadius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();

    ctx.restore();
  }

  /**
   * Render all enemies.
   */
  renderEnemies() {
    if (!this.ctx) return;

    const ctx = this.ctx;

    for (const enemy of this.enemies) {
      // Render a small inky trail behind the ship's path.
      ctx.save();
      ctx.fillStyle = this.enemyTrailColor;
      for (let i = 0; i < enemy.trail.length - 1; i++) {
        const point = enemy.trail[i];
        const alpha = (i + 1) / enemy.trail.length;
        ctx.globalAlpha = alpha * 0.8;
        ctx.beginPath();
        // Larger trail circles that scale with enemy size for better visibility
        ctx.arc(point.x, point.y, Math.max(2, enemy.size * 0.35 * alpha), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Render smoke puffs from the stored world-space positions (they don't rotate with the ship).
      ctx.save();
      ctx.fillStyle = this.enemySmokeColor;
      for (const puff of enemy.smokePuffs) {
        ctx.globalAlpha = puff.alpha * (this.nightMode ? 1.15 : 1);
        ctx.beginPath();
        ctx.arc(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(enemy.headingAngle - Math.PI / 2);

      // Draw enemy ship as a simple triangle pointing toward movement.
      ctx.beginPath();
      ctx.moveTo(0, enemy.size);
      ctx.lineTo(-enemy.size * 0.7, -enemy.size * 0.5);
      ctx.lineTo(enemy.size * 0.7, -enemy.size * 0.5);
      ctx.closePath();

      ctx.fillStyle = this.nightMode ? '#ffffff' : enemy.color;
      ctx.fill();

      // Health bar for multi-hit enemies
      if (enemy.maxHealth > 1) {
        const healthPercent = enemy.health / enemy.maxHealth;
        const barWidth = enemy.size * 1.5;
        const barHeight = 2;
        const barY = -enemy.size - 4;

        ctx.fillStyle = this.nightMode ? 'rgba(255, 255, 255, 0.3)' : '#ddd';
        ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);

        ctx.fillStyle = this.nightMode ? 'rgba(255, 255, 255, 0.8)' : '#666';
        ctx.fillRect(-barWidth / 2, barY, barWidth * healthPercent, barHeight);
      }

      ctx.restore();
    }
  }

  /**
   * Render all boss ships with distinctive visuals.
   */
  renderBosses() {
    if (!this.ctx) return;

    const ctx = this.ctx;

    for (const boss of this.bosses) {
      // Render trail
      ctx.save();
      ctx.fillStyle = this.enemyTrailColor;
      for (let i = 0; i < boss.trail.length - 1; i++) {
        const point = boss.trail[i];
        const alpha = (i + 1) / boss.trail.length;
        ctx.globalAlpha = alpha * 0.6;
        ctx.beginPath();
        ctx.arc(point.x, point.y, Math.max(2, boss.size * 0.15 * alpha), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(boss.x, boss.y);

      // Draw boss based on type
      switch (boss.type) {
        case 'circleCarrier':
          this.renderCircleCarrierBoss(ctx, boss);
          break;
        case 'pyramidBoss':
          this.renderPyramidBoss(ctx, boss);
          break;
        case 'hexagonFortress':
          this.renderHexagonFortressBoss(ctx, boss);
          break;
        default:
          this.renderCircleCarrierBoss(ctx, boss);
      }

      // Health bar for all bosses
      const healthPercent = boss.health / boss.maxHealth;
      const barWidth = boss.size * 2;
      const barHeight = 4;
      const barY = -boss.size - 10;

      ctx.fillStyle = this.nightMode ? 'rgba(255, 255, 255, 0.3)' : '#ddd';
      ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);

      // Health bar color changes based on health
      let healthColor;
      if (healthPercent > 0.6) {
        healthColor = this.nightMode ? '#90EE90' : '#4a4';
      } else if (healthPercent > 0.3) {
        healthColor = this.nightMode ? '#FFD700' : '#aa4';
      } else {
        healthColor = this.nightMode ? '#FF6B6B' : '#a44';
      }
      ctx.fillStyle = healthColor;
      ctx.fillRect(-barWidth / 2, barY, barWidth * healthPercent, barHeight);

      // Border
      ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.6)' : '#666';
      ctx.lineWidth = 1;
      ctx.strokeRect(-barWidth / 2, barY, barWidth, barHeight);

      ctx.restore();
    }
  }

  /**
   * Render Circle Carrier boss - large rotating circle with inner rings.
   */
  renderCircleCarrierBoss(ctx, boss) {
    const fillColor = this.nightMode ? '#ffffff' : boss.color;
    const strokeColor = this.nightMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)';

    // Outer ring
    ctx.beginPath();
    ctx.arc(0, 0, boss.size, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner rotating rings
    ctx.save();
    ctx.rotate(boss.rotation);
    for (const ring of boss.innerRings) {
      ctx.beginPath();
      ctx.arc(0, 0, boss.size * ring.radius, 0, Math.PI * 2);
      ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(100, 100, 100, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();

    // Spawn indicator dots around the circle
    ctx.save();
    ctx.rotate(boss.rotation);
    const dotCount = boss.spawnCount;
    for (let i = 0; i < dotCount; i++) {
      const angle = (i / dotCount) * Math.PI * 2;
      const dotX = Math.cos(angle) * boss.size * 0.7;
      const dotY = Math.sin(angle) * boss.size * 0.7;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
      ctx.fillStyle = this.nightMode ? '#ffcc00' : '#d4af37';
      ctx.fill();
    }
    ctx.restore();

    // Center indicator
    ctx.beginPath();
    ctx.arc(0, 0, boss.size * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = this.nightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(50, 50, 50, 0.8)';
    ctx.fill();
  }

  /**
   * Render Pyramid boss - rotating triangle with burst indicator.
   */
  renderPyramidBoss(ctx, boss) {
    const fillColor = this.nightMode ? '#ffffff' : boss.color;
    const strokeColor = this.nightMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)';

    // Rotating triangle
    ctx.save();
    ctx.rotate(boss.rotation);

    ctx.beginPath();
    ctx.moveTo(0, -boss.size);
    ctx.lineTo(-boss.size * 0.866, boss.size * 0.5);
    ctx.lineTo(boss.size * 0.866, boss.size * 0.5);
    ctx.closePath();

    // Flash during burst
    if (boss.isBursting) {
      ctx.fillStyle = this.nightMode ? '#ff6666' : '#cc4444';
    } else {
      ctx.fillStyle = fillColor;
    }
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner triangle
    const innerScale = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, -boss.size * innerScale);
    ctx.lineTo(-boss.size * 0.866 * innerScale, boss.size * 0.5 * innerScale);
    ctx.lineTo(boss.size * 0.866 * innerScale, boss.size * 0.5 * innerScale);
    ctx.closePath();
    ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(100, 100, 100, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render Hexagon Fortress boss - large rotating hexagon with shield indicator.
   */
  renderHexagonFortressBoss(ctx, boss) {
    const fillColor = this.nightMode ? '#ffffff' : boss.color;
    const strokeColor = this.nightMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)';

    // Rotating hexagon
    ctx.save();
    ctx.rotate(boss.rotation);

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * boss.size;
      const y = Math.sin(angle) * boss.size;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();

    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner hexagon
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * boss.size * 0.6;
      const y = Math.sin(angle) * boss.size * 0.6;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(100, 100, 100, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    // Shield regeneration indicator (glowing when regenerating)
    if (boss.regenCooldown <= 0 && boss.health < boss.maxHealth) {
      ctx.beginPath();
      ctx.arc(0, 0, boss.size + 5, 0, Math.PI * 2);
      ctx.strokeStyle = this.nightMode ? 'rgba(100, 255, 100, 0.4)' : 'rgba(0, 200, 0, 0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  /**
   * Render all bullets.
   */
  renderBullets() {
    if (!this.ctx) return;

    const ctx = this.ctx;

    for (const bullet of this.bullets) {
      const trail = bullet.trail || [];
      if (trail.length > 1) {
        ctx.save();
        ctx.lineCap = 'round';
        for (let i = trail.length - 1; i > 0; i--) {
          const start = trail[i];
          const end = trail[i - 1];
          const alpha = i / trail.length;
          ctx.strokeStyle = this.nightMode
            ? `rgba(255, 255, 255, ${0.12 + alpha * 0.28})`
            : `rgba(0, 0, 0, ${0.12 + alpha * 0.32})`;
          ctx.lineWidth = Math.max(1, bullet.size * 0.55 * alpha);
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.save();
      const glowRadius = bullet.size * 2.4;
      const gradient = ctx.createRadialGradient(bullet.x, bullet.y, 0, bullet.x, bullet.y, glowRadius);
      gradient.addColorStop(0, this.nightMode ? '#ffffff' : '#fff8df');
      gradient.addColorStop(0.45, bullet.color);
      gradient.addColorStop(1, this.nightMode ? 'rgba(255, 255, 255, 0)' : 'rgba(0, 0, 0, 0)');

      if (this.nightMode) {
        ctx.shadowColor = bullet.color;
        ctx.shadowBlur = 14;
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, glowRadius * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // Directional flare to emphasize travel direction.
      const heading = bullet.baseAngle !== undefined ? bullet.baseAngle : bullet.angle || -Math.PI / 2;
      const flareLength = bullet.size * 3.5;
      ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.55)';
      ctx.lineWidth = Math.max(1.2, bullet.size * 0.45);
      ctx.beginPath();
      ctx.moveTo(bullet.x - Math.cos(heading) * bullet.size * 0.6, bullet.y - Math.sin(heading) * bullet.size * 0.6);
      ctx.lineTo(bullet.x + Math.cos(heading) * flareLength, bullet.y + Math.sin(heading) * flareLength);
      ctx.stroke();

      // Thin rim for a crisp silhouette.
      ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.65)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, Math.max(1, bullet.size * 0.9), 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  /**
   * Render UI elements.
   */
  renderUI() {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const padding = 10;

    // Set font for UI
    ctx.font = '14px "Cormorant Garamond", serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Score display (top left)
    ctx.fillStyle = this.uiTextColor;
    ctx.fillText(`Score: ${this.score}`, padding, padding);
    ctx.fillText(`High Score: ${this.highScore}`, padding, padding + 18);

    // Wave display (top right)
    ctx.textAlign = 'right';
    ctx.fillText(`Wave: ${this.wave + 1}`, this.canvas.width - padding, padding);

    // Health bar (bottom center)
    if (this.warden) {
      const barWidth = 120;
      const barHeight = 8;
      const barX = (this.canvas.width - barWidth) / 2;
      const barY = this.canvas.height - padding - barHeight;
      const healthPercent = this.warden.health / this.warden.maxHealth;

      // Background
      ctx.fillStyle = this.nightMode ? 'rgba(255, 255, 255, 0.2)' : '#eee';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Health
      ctx.fillStyle = this.wardenCoreColor;
      ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

      // Border
      ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.6)' : '#999';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    // Enemies passed through indicator (bottom left)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = this.uiTextColor;
    ctx.fillText(
      `Ships Passed: ${this.enemiesPassedThrough}/${this.maxEnemiesPassedThrough}`,
      padding,
      this.canvas.height - padding
    );
  }

  /**
   * Handle canvas resize.
   */
  resize(width, height) {
    if (!this.canvas) return;

    this.canvas.width = width;
    this.canvas.height = height;

    // Reposition warden
    if (this.warden) {
      this.warden.x = width / 2;
      this.warden.y = height * 0.75;
    }
  }

  /**
   * Get the current game state for persistence.
   */
  getState() {
    return {
      score: this.score,
      highScore: this.highScore,
      highestWave: this.highestWave,
      wave: this.wave,
      difficultyLevel: this.difficultyLevel,
      upgrades: { ...this.upgrades },
      weapons: {
        purchased: { ...this.weapons.purchased },
        levels: { ...this.weapons.levels },
        activeWeaponId: this.weapons.activeWeaponId,
      },
      baseHealthLevel: this.baseHealthLevel,
    };
  }

  /**
   * Restore game state.
   */
  setState(state) {
    if (state.highScore !== undefined) {
      this.highScore = state.highScore;
    }
    if (state.highestWave !== undefined) {
      this.highestWave = state.highestWave;
    }
    if (state.upgrades) {
      this.upgrades = { ...this.upgrades, ...state.upgrades };
    }
    if (state.weapons) {
      this.setWeaponState(state.weapons);
    }
    if (state.baseHealthLevel !== undefined) {
      this.setBaseHealthLevel(state.baseHealthLevel);
    }
  }

  /**
   * Set the high score externally.
   */
  setHighScore(value) {
    if (Number.isFinite(value) && value >= 0) {
      this.highScore = value;
    }
  }
  
  /**
   * Set the highest wave externally.
   */
  setHighestWave(value) {
    if (Number.isFinite(value) && value >= 0) {
      this.highestWave = Math.floor(value);
    }
  }
  
  /**
   * Get the highest wave reached.
   */
  getHighestWave() {
    return this.highestWave;
  }

  /**
   * Apply an upgrade to the Cardinal Warden.
   */
  applyUpgrade(upgradeType, level = 1) {
    switch (upgradeType) {
      case 'bulletDamage':
        this.upgrades.bulletDamage = Math.max(1, level);
        break;
      case 'bulletSpeed':
        this.upgrades.bulletSpeed = Math.max(1, level);
        break;
      case 'bulletCount':
        this.upgrades.bulletCount = Math.max(1, level);
        break;
      case 'fireRate':
        this.upgrades.fireRate = Math.max(1, level);
        break;
      case 'pattern':
        if (level && !this.upgrades.patterns.includes(level)) {
          this.upgrades.patterns.push(level);
        }
        break;
      default:
        break;
    }
  }

  /**
   * Get all available weapons with their purchase/upgrade status.
   */
  getAvailableWeapons() {
    const weapons = [];
    for (const weaponId of Object.keys(WEAPON_DEFINITIONS)) {
      const def = WEAPON_DEFINITIONS[weaponId];
      const isPurchased = this.weapons.purchased[weaponId] || false;
      const level = this.weapons.levels[weaponId] || 0;
      const maxLevel = 6;
      const canUpgrade = isPurchased && level < maxLevel;
      const upgradeCost = canUpgrade && def.upgradeCosts[level - 1] !== undefined 
        ? def.upgradeCosts[level - 1] 
        : null;
      const isEquipped = this.weapons.equipped?.includes(weaponId) || false;
      const canEquip = isPurchased && !isEquipped && (this.weapons.equipped?.length || 0) < this.maxEquippedWeapons;
      const canUnequip = isEquipped && (this.weapons.equipped?.length || 0) > 1;
      
      weapons.push({
        id: weaponId,
        name: def.name,
        symbol: def.symbol,
        description: def.description,
        color: def.color,
        cost: def.cost,
        isPurchased,
        level,
        maxLevel,
        canUpgrade,
        upgradeCost,
        isEquipped,
        canEquip,
        canUnequip,
      });
    }
    return weapons;
  }

  /**
   * Purchase a weapon using score points.
   * @param {string} weaponId - The ID of the weapon to purchase
   * @returns {boolean} True if purchase successful
   * @deprecated Use purchaseWeaponWithoutCost and handle currency externally
   */
  purchaseWeapon(weaponId) {
    const def = WEAPON_DEFINITIONS[weaponId];
    if (!def) return false;
    
    // Already purchased
    if (this.weapons.purchased[weaponId]) return false;
    
    // Check if player has enough score
    if (this.score < def.cost) return false;
    
    // Deduct cost and purchase
    this.score -= def.cost;
    this.weapons.purchased[weaponId] = true;
    this.weapons.levels[weaponId] = 1;
    this.weaponTimers[weaponId] = 0;
    this.weaponPhases[weaponId] = this.weaponPhases[weaponId] || 0; // Initialize phase tracking for new weapon.
    
    // Notify callbacks
    if (this.onScoreChange) {
      this.onScoreChange(this.score);
    }
    if (this.onWeaponChange) {
      this.onWeaponChange(this.weapons);
    }
    
    return true;
  }

  /**
   * Purchase a weapon without deducting score (currency handled externally).
   * Automatically equips the weapon if fewer than 3 are equipped.
   * @param {string} weaponId - The ID of the weapon to purchase
   * @returns {boolean} True if purchase successful
   */
  purchaseWeaponWithoutCost(weaponId) {
    const def = WEAPON_DEFINITIONS[weaponId];
    if (!def) return false;
    
    // Already purchased
    if (this.weapons.purchased[weaponId]) return false;
    
    // Mark as purchased
    this.weapons.purchased[weaponId] = true;
    this.weapons.levels[weaponId] = 1;
    this.weaponTimers[weaponId] = 0;
    this.weaponPhases[weaponId] = this.weaponPhases[weaponId] || 0; // Initialize phase tracking for auto-equipped weapon.
    
    // Auto-equip if there's room (less than maxEquippedWeapons equipped)
    if (!this.weapons.equipped) {
      this.weapons.equipped = [];
    }
    if (this.weapons.equipped.length < this.maxEquippedWeapons) {
      this.weapons.equipped.push(weaponId);
    }
    
    // Notify callbacks
    if (this.onWeaponChange) {
      this.onWeaponChange(this.weapons);
    }
    
    return true;
  }

  /**
   * Upgrade a purchased weapon.
   * @param {string} weaponId - The ID of the weapon to upgrade
   * @returns {boolean} True if upgrade successful
   * @deprecated Use upgradeWeaponWithoutCost and handle currency externally
   */
  upgradeWeapon(weaponId) {
    const def = WEAPON_DEFINITIONS[weaponId];
    if (!def) return false;
    
    // Must be purchased first
    if (!this.weapons.purchased[weaponId]) return false;
    
    const currentLevel = this.weapons.levels[weaponId] || 1;
    const maxLevel = 6;
    
    // Already at max level
    if (currentLevel >= maxLevel) return false;
    
    // Get upgrade cost
    const upgradeCost = def.upgradeCosts[currentLevel - 1];
    if (upgradeCost === undefined) return false;
    
    // Check if player has enough score
    if (this.score < upgradeCost) return false;
    
    // Deduct cost and upgrade
    this.score -= upgradeCost;
    this.weapons.levels[weaponId] = currentLevel + 1;
    
    // Notify callbacks
    if (this.onScoreChange) {
      this.onScoreChange(this.score);
    }
    if (this.onWeaponChange) {
      this.onWeaponChange(this.weapons);
    }
    
    return true;
  }

  /**
   * Upgrade a purchased weapon without deducting score (currency handled externally).
   * @param {string} weaponId - The ID of the weapon to upgrade
   * @returns {boolean} True if upgrade successful
   */
  upgradeWeaponWithoutCost(weaponId) {
    const def = WEAPON_DEFINITIONS[weaponId];
    if (!def) return false;
    
    // Must be purchased first
    if (!this.weapons.purchased[weaponId]) return false;
    
    const currentLevel = this.weapons.levels[weaponId] || 1;
    const maxLevel = 6;
    
    // Already at max level
    if (currentLevel >= maxLevel) return false;
    
    // Upgrade
    this.weapons.levels[weaponId] = currentLevel + 1;
    
    // Notify callbacks
    if (this.onWeaponChange) {
      this.onWeaponChange(this.weapons);
    }
    
    return true;
  }

  /**
   * Equip a purchased weapon. Only up to maxEquippedWeapons can be equipped.
   * @param {string} weaponId - The ID of the weapon to equip
   * @returns {boolean} True if equip successful
   */
  equipWeapon(weaponId) {
    // Must be purchased first
    if (!this.weapons.purchased[weaponId]) return false;
    
    // Initialize equipped array if needed
    if (!this.weapons.equipped) {
      this.weapons.equipped = [];
    }
    
    // Already equipped
    if (this.weapons.equipped.includes(weaponId)) return false;
    
    // Check if at max capacity
    if (this.weapons.equipped.length >= this.maxEquippedWeapons) return false;
    
    // Equip the weapon
    this.weapons.equipped.push(weaponId);
    
    // Notify callbacks
    if (this.onWeaponChange) {
      this.onWeaponChange(this.weapons);
    }
    
    return true;
  }

  /**
   * Unequip a weapon. At least one weapon must remain equipped.
   * @param {string} weaponId - The ID of the weapon to unequip
   * @returns {boolean} True if unequip successful
   */
  unequipWeapon(weaponId) {
    // Initialize equipped array if needed
    if (!this.weapons.equipped) {
      this.weapons.equipped = [];
      return false;
    }
    
    // Check if weapon is equipped
    const index = this.weapons.equipped.indexOf(weaponId);
    if (index === -1) return false;
    
    // Must keep at least one weapon equipped
    if (this.weapons.equipped.length <= 1) return false;
    
    // Unequip the weapon
    this.weapons.equipped.splice(index, 1);
    
    // Notify callbacks
    if (this.onWeaponChange) {
      this.onWeaponChange(this.weapons);
    }
    
    return true;
  }

  /**
   * Check if a weapon is currently equipped.
   * @param {string} weaponId - The ID of the weapon to check
   * @returns {boolean} True if equipped
   */
  isWeaponEquipped(weaponId) {
    return this.weapons.equipped?.includes(weaponId) || false;
  }

  /**
   * Get the list of currently equipped weapon IDs.
   * @returns {string[]} Array of equipped weapon IDs
   */
  getEquippedWeapons() {
    return [...(this.weapons.equipped || [])];
  }

  /**
   * Get current weapon state for UI.
   */
  getWeaponState() {
    return {
      purchased: { ...this.weapons.purchased },
      levels: { ...this.weapons.levels },
      activeWeaponId: this.weapons.activeWeaponId,
      equipped: [...(this.weapons.equipped || [])],
    };
  }

  /**
   * Set weapon state from persistence.
   */
  setWeaponState(state) {
    if (state?.purchased) {
      this.weapons.purchased = { ...this.weapons.purchased, ...state.purchased };
    }
    if (state?.levels) {
      this.weapons.levels = { ...this.weapons.levels, ...state.levels };
    }
    if (state?.activeWeaponId) {
      this.weapons.activeWeaponId = state.activeWeaponId;
    }
    if (state?.equipped) {
      // Filter to only include purchased weapons and limit to maxEquippedWeapons
      this.weapons.equipped = state.equipped
        .filter(id => this.weapons.purchased[id])
        .slice(0, this.maxEquippedWeapons);
    }
    
    // Ensure at least one weapon is equipped if any are purchased
    if (!this.weapons.equipped || this.weapons.equipped.length === 0) {
      const purchasedIds = Object.keys(this.weapons.purchased).filter(id => this.weapons.purchased[id]);
      if (purchasedIds.length > 0) {
        this.weapons.equipped = [purchasedIds[0]];
      }
    }
    
    // Initialize timers for all purchased weapons
    for (const weaponId of Object.keys(this.weapons.purchased)) {
      if (this.weapons.purchased[weaponId] && !this.weaponTimers[weaponId]) {
        this.weaponTimers[weaponId] = 0;
      }
      if (this.weapons.purchased[weaponId] && this.weaponPhases[weaponId] === undefined) {
        this.weaponPhases[weaponId] = 0; // Ensure phase accumulator exists after loading state.
      }
    }
  }
}
