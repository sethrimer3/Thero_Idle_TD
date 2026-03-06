/**
 * Cardinal Warden Entity Classes
 *
 * Standalone entity classes extracted from cardinalWardenSimulation.js.
 * These are pure data/logic classes with no dependency on the simulation instance.
 */

import {
  VISUAL_CONFIG,
  ORBITAL_SQUARE_CONFIG,
  RING_SQUARE_CONFIGS,
  INNER_RING_CONFIGS,
  HOMING_CONFIG,
} from '../cardinalWardenConfig.js';

/**
 * Simple seeded random number generator for consistent enemy patterns.
 */
export class SeededRandom {
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
 * Normalize an angle to the [0, 2π) range.
 */
export function normalizeAngle(angle) {
  const twoPi = Math.PI * 2;
  let normalized = angle % twoPi;
  if (normalized < 0) {
    normalized += twoPi;
  }
  return normalized;
}

/**
 * Reflect a vector across a provided surface normal.
 */
export function reflectVector(vx, vy, normalX, normalY) {
  const normalLength = Math.hypot(normalX, normalY) || 1;
  const nx = normalX / normalLength;
  const ny = normalY / normalLength;
  const dot = vx * nx + vy * ny;
  return {
    vx: vx - 2 * dot * nx,
    vy: vy - 2 * dot * ny,
  };
}

/**
 * Represents a single rotating square in the Cardinal Warden formation.
 */
export class OrbitalSquare {
  constructor(index, totalSquares, orbitRadius, rng) {
    this.index = index;
    this.totalSquares = totalSquares;
    this.orbitRadius = orbitRadius;
    this.baseAngle = (index / totalSquares) * Math.PI * 2;
    // Use seeded random for deterministic patterns
    this.rotationSpeed = 0.5 + rng.next() * 1.5;
    this.rotationDirection = rng.next() > 0.5 ? 1 : -1;
    this.selfRotation = 0;
    // Reduced rotation speed to 20% of original (multiplied by 0.2)
    this.selfRotationSpeed = (1 + rng.next() * 2) * 0.2;
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
export class RingSquare {
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
    this.strokeColor = config.strokeColor || VISUAL_CONFIG.DEFAULT_GOLDEN;
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
export class CardinalWarden {
  constructor(x, y, rng) {
    this.x = x;
    this.y = y;
    this.health = 100;
    this.maxHealth = 100;
    this.coreRadius = ORBITAL_SQUARE_CONFIG.CORE_RADIUS;
    this.orbitalSquares = [];
    this.ringSquares = [];
    this.rng = rng;
    this.initOrbitalSquares();
    this.initRingSquares();
  }

  initOrbitalSquares() {
    this.orbitalSquares = [];
    const squareCount = ORBITAL_SQUARE_CONFIG.COUNT;
    const orbitRadius = ORBITAL_SQUARE_CONFIG.ORBIT_RADIUS;
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
    
    // Ring configurations from cardinalWardenConfig.js
    const ringConfigs = RING_SQUARE_CONFIGS;
    
    for (let i = 0; i < ringConfigs.length; i++) {
      const config = { ...ringConfigs[i] };
      // Stagger initial rotations so they don't all start aligned
      config.initialRotation = (i / ringConfigs.length) * Math.PI * 0.5;
      config.strokeColor = VISUAL_CONFIG.DEFAULT_GOLDEN;
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
 * Represents a bullet fired by the Cardinal Warden.
 */
export class Bullet {
  constructor(x, y, angle, config = {}) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.angle = angle;
    this.speed = config.speed || 200;
    this.damage = config.damage || 1;
    this.size = config.size || 4;
    this.baseColor = config.baseColor || config.color || VISUAL_CONFIG.DEFAULT_GOLDEN;
    this.color = config.color || this.baseColor;
    this.piercing = config.piercing || false;
    this.piercingLimit = config.piercingLimit || 0; // Max number of targets (enemies + bosses) to hit (0 = unlimited)
    this.hitEnemies = new Set();
    this.hitBosses = new Set();
    this.trail = [];
    this.age = 0;
    this.lastTrailBounceTime = -Infinity;

    // Bullets bounce off enemy trails by default to reward smart angles.
    this.bounceOnTrails = config.bounceOnTrails !== false;
    
    // Weapon level for visual effects (default 1 for backwards compatibility)
    this.level = config.level || 1;
    
    // Max trail length (default 40 - 4x original for longer bullet trails)
    this.maxTrailLength = config.maxTrailLength !== undefined ? config.maxTrailLength : 40;
    
    // Geometric shape rotation for level 3+ bullets (random direction and speed)
    this.shapeRotation = 0;
    this.shapeRotationSpeed = (Math.random() - 0.5) * 8; // Random speed between -4 and 4 rad/s
  }

  update(deltaTime) {
    const dt = deltaTime / 1000;
    this.prevX = this.x;
    this.prevY = this.y;
    this.age += deltaTime;
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;

    // Leave behind a luminous trail for rendering (length based on settings).
    if (this.maxTrailLength > 0) {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrailLength) {
        this.trail.shift();
      }
    }
    
    // Update geometric shape rotation for level 3+ bullets
    if (this.level >= 3) {
      this.shapeRotation += this.shapeRotationSpeed * dt;
    }
  }

  /**
   * Flip bullet 180 degrees when hitting a ship trail (simple reflection for cheap computation).
   */
  applyTrailBounce(normalX, normalY) {
    // Simple 180-degree flip: reverse the direction
    this.angle += Math.PI;
    
    // Normalize angle to [0, 2π) range
    this.angle = normalizeAngle(this.angle);

    // Small positional nudge prevents the bullet from re-hitting the same segment instantly.
    this.x += Math.cos(this.angle) * this.size * 0.35;
    this.y += Math.sin(this.angle) * this.size * 0.35;
  }

  isOffscreen(width, height) {
    return this.x < -this.size || this.x > width + this.size ||
           this.y < -this.size || this.y > height + this.size;
  }
}

/**
 * Represents a friendly ship that orbits the Cardinal Warden and attacks enemies.
 * Spawned by the third grapheme (index 2 - gamma).
 */
export class FriendlyShip {
  constructor(x, y, wardenX, wardenY, damage, color, rng) {
    this.x = x;
    this.y = y;
    this.wardenX = wardenX;
    this.wardenY = wardenY;
    this.damage = damage;
    this.color = color;
    this.size = 6;
    this.headingAngle = 0;
    this.rng = rng;
    
    // Orbital behavior
    this.orbitRadius = 60 + rng.range(-10, 10);
    this.orbitAngle = rng.range(0, Math.PI * 2);
    this.orbitSpeed = rng.range(0.8, 2.0); // Random speed
    this.orbitDirection = rng.next() > 0.5 ? 1 : -1; // Random direction
    
    // Attack behavior
    this.mode = 'orbit'; // 'orbit', 'attack', or 'returning'
    this.targetEnemy = null;
    this.attackSpeed = 150;
    this.returnSpeed = 120; // Speed when flying back to orbit
    
    // Trail for visual effect (thin, colorful trails)
    this.trail = [];
    this.maxTrailLength = 20; // Longer trails for better visibility
  }
  
  update(deltaTime, warden, enemies, canvasHeight) {
    const dt = deltaTime / 1000;
    
    // Update warden position reference
    this.wardenX = warden.x;
    this.wardenY = warden.y;
    
    // Check for enemies in bottom 25% of screen
    const bottomThreshold = canvasHeight * 0.75;
    const enemiesInBottom = enemies.filter(e => e.y >= bottomThreshold);
    
    if (enemiesInBottom.length > 0 && this.mode === 'orbit') {
      // Switch to attack mode - target the lowest enemy
      this.mode = 'attack';
      this.targetEnemy = enemiesInBottom.reduce((lowest, enemy) => 
        enemy.y > lowest.y ? enemy : lowest
      );
    } else if (enemiesInBottom.length === 0 && this.mode === 'attack') {
      // Switch to returning mode for smooth fly-back
      this.mode = 'returning';
      this.targetEnemy = null;
    }
    
    const prevX = this.x;
    const prevY = this.y;
    
    if (this.mode === 'orbit') {
      // Circle around the warden
      this.orbitAngle += this.orbitSpeed * this.orbitDirection * dt;
      this.x = this.wardenX + Math.cos(this.orbitAngle) * this.orbitRadius;
      this.y = this.wardenY + Math.sin(this.orbitAngle) * this.orbitRadius;
    } else if (this.mode === 'returning') {
      // Smoothly fly back to orbit position
      const targetX = this.wardenX + Math.cos(this.orbitAngle) * this.orbitRadius;
      const targetY = this.wardenY + Math.sin(this.orbitAngle) * this.orbitRadius;
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 5) {
        // Still returning
        const dirX = dx / dist;
        const dirY = dy / dist;
        this.x += dirX * this.returnSpeed * dt;
        this.y += dirY * this.returnSpeed * dt;
        // Continue orbiting while returning
        this.orbitAngle += this.orbitSpeed * this.orbitDirection * dt * 0.5;
      } else {
        // Arrived at orbit, switch back to orbit mode
        this.mode = 'orbit';
        this.x = targetX;
        this.y = targetY;
      }
    } else if (this.mode === 'attack' && this.targetEnemy) {
      // Move toward target enemy
      const dx = this.targetEnemy.x - this.x;
      const dy = this.targetEnemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 0) {
        const dirX = dx / dist;
        const dirY = dy / dist;
        this.x += dirX * this.attackSpeed * dt;
        this.y += dirY * this.attackSpeed * dt;
      }
      
      // If target is dead or not in bottom anymore, switch to returning
      if (!enemies.includes(this.targetEnemy) || this.targetEnemy.y < bottomThreshold) {
        this.mode = 'returning';
        this.targetEnemy = null;
      }
    }
    
    // Update heading based on movement
    const deltaX = this.x - prevX;
    const deltaY = this.y - prevY;
    if (deltaX !== 0 || deltaY !== 0) {
      this.headingAngle = Math.atan2(deltaY, deltaX);
    }
    
    // Update trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.shift();
    }
  }
  
  /**
   * Check if this ship collides with an enemy.
   */
  checkCollision(enemy) {
    const dx = this.x - enemy.x;
    const dy = this.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < (this.size + enemy.size);
  }
}

/**
 * Represents a mathematical function bullet that follows wave patterns.
 * These bullets travel primarily in one direction but oscillate following a mathematical function.
 */
export class MathBullet {
  // Epsilon (fifth grapheme) behavior constants
  static EPSILON_ZIGZAG_MAX_WAYPOINTS = 10;
  static EPSILON_ZIGZAG_HOLD_DURATION = 0.5; // seconds
  static EPSILON_ZIGZAG_TARGET_PROXIMITY_MULTIPLIER = 2;
  static EPSILON_SPIRAL_ROTATION_SPEED = 2; // radians per second
  static EPSILON_SPIRAL_EXPANSION_RATE = 0.3;
  
  constructor(x, y, angle, config = {}) {
    this.startX = x;
    this.startY = y;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.baseAngle = angle;
    this.speed = config.speed || 200;
    this.damage = config.damage || 1;
    this.size = config.size || 4;
    this.baseColor = config.baseColor || config.color || VISUAL_CONFIG.DEFAULT_GOLDEN;
    this.color = config.color || VISUAL_CONFIG.DEFAULT_GOLDEN;
    
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

    // Bounce bookkeeping to mirror trail ricochets without stutter.
    this.lastTrailBounceTime = -Infinity;

    // Bullets bounce off enemy trails by default to reward smart angles.
    this.bounceOnTrails = config.bounceOnTrails !== false;

    // Track pierced targets so mathematical bullets respect single-hit collisions.
    this.hitEnemies = new Set();
    this.hitBosses = new Set();
    this.piercing = config.piercing || false;
    this.piercingLimit = config.piercingLimit || 0; // Max number of targets (enemies + bosses) to hit (0 = unlimited)
    
    // Weapon level for visual effects (default 1 for backwards compatibility)
    this.level = config.level || 1;
    
    // Max trail length (default 40 - 4x original for longer bullet trails)
    this.maxTrailLength = config.maxTrailLength !== undefined ? config.maxTrailLength : 40;
    
    // Geometric shape rotation for level 3+ bullets (random direction and speed)
    this.shapeRotation = 0;
    this.shapeRotationSpeed = (Math.random() - 0.5) * 8; // Random speed between -4 and 4 rad/s
    
    // ThoughtSpeak shape override (null = use level-based rendering)
    this.thoughtSpeakShape = config.thoughtSpeakShape || null;
    
    // Fifth grapheme (Epsilon - index 4) behavior configuration
    this.epsilonBehavior = config.epsilonBehavior || null; // 'straight', 'zigzag', or 'spiral'
    this.epsilonZigzagState = {
      waypointCount: 0,
      maxWaypoints: MathBullet.EPSILON_ZIGZAG_MAX_WAYPOINTS,
      holdTimer: 0,
      holdDuration: MathBullet.EPSILON_ZIGZAG_HOLD_DURATION,
      isHolding: false,
      targetX: null,
      targetY: null,
      trackingEnemy: false,
    };
    this.epsilonSpiralAngle = 0; // Angle around the spiral center
    
    // Tenth grapheme (J - index 9) elemental effect
    this.elementalEffect = config.elementalEffect || null; // 'burning' or 'freezing'
    
    // New grapheme properties (O-Z)
    this.ricochetBounces = config.ricochetBounces || 0; // Grapheme O - max bounces
    this.ricochetCount = 0; // Track current bounce count
    this.homingTurnRate = config.homingTurnRate || 0; // Grapheme P - turn rate (rad/s)
    this.homingDetectionRadius = config.homingDetectionRadius || 0; // Grapheme P - detection radius override
    this.splitCount = config.splitCount || 0; // Grapheme Q - splits on hit
    this.chainCount = config.chainCount || 0; // Grapheme R - chain targets
    this.chainRange = config.chainRange || 0; // Grapheme R - chain range
    this.chainDamageMultiplier = config.chainDamageMultiplier || 0; // Grapheme R - chain damage override
    this.orbitalCount = config.orbitalCount || 0; // Grapheme T - orbit count
    this.orbitalProgress = 0; // Track orbit completion
    this.pulseRate = config.pulseRate || 0; // Grapheme U - pulses per second
    this.pulseRadius = config.pulseRadius || 0; // Grapheme U - pulse radius
    this.pulseTimer = 0; // Track time for next pulse
    this.pulseDamageMultiplier = config.pulseDamageMultiplier || 0; // Grapheme U - pulse damage override
    this.explosionRadius = config.explosionRadius || 0; // Grapheme W - explosion radius
    this.lifetimeMultiplier = config.lifetimeMultiplier || 1; // Grapheme X - lifetime mult
    this.vortexRadius = config.vortexRadius || 0; // Grapheme Y - pull radius
    this.vortexStrength = config.vortexStrength || 0; // Grapheme Y - pull strength
    this.chaosEffectCount = config.chaosEffectCount || 0; // Grapheme Z - random effects
  }
  
  /**
   * Update bullet trail and rotation (common logic for all epsilon behaviors).
   */
  updateTrailAndRotation(dt) {
    if (this.maxTrailLength > 0) {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrailLength) {
        this.trail.shift();
      }
    }
    if (this.level >= 3) {
      this.shapeRotation += this.shapeRotationSpeed * dt;
    }
  }

  update(deltaTime, canvasWidth, canvasHeight, enemies) {
    const dt = deltaTime / 1000;
    this.prevX = this.x;
    this.prevY = this.y;
    this.time += dt;
    this.age += deltaTime;
    
    // Grapheme P (index 15) - Homing missiles
    if (this.homingTurnRate > 0 && Array.isArray(enemies) && enemies.length > 0) {
      // Find nearest enemy within detection radius (dagesh variants can override).
      const detectionRadius = this.homingDetectionRadius || HOMING_CONFIG.DETECTION_RADIUS;
      let nearestEnemy = null;
      let nearestDist = Infinity;
      for (const enemy of enemies) {
        const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
        if (dist < detectionRadius && dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = enemy;
        }
      }
      
      if (nearestEnemy) {
        // Calculate desired angle to enemy
        const desiredAngle = Math.atan2(nearestEnemy.y - this.y, nearestEnemy.x - this.x);
        // Calculate angle difference
        let angleDiff = desiredAngle - this.baseAngle;
        // Normalize to [-π, π]
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        // Turn toward enemy at turn rate
        const maxTurn = this.homingTurnRate * dt;
        if (Math.abs(angleDiff) <= maxTurn) {
          this.baseAngle = desiredAngle;
        } else {
          this.baseAngle += Math.sign(angleDiff) * maxTurn;
        }
      }
    }

    // Handle fifth grapheme (Epsilon) behaviors first
    if (this.epsilonBehavior === 'straight') {
      // Slots 0-2: Simple straight movement (no oscillation)
      this.distance += this.speed * dt;
      this.x = this.startX + Math.cos(this.baseAngle) * this.distance;
      this.y = this.startY + Math.sin(this.baseAngle) * this.distance;
      
      this.updateTrailAndRotation(dt);
      return;
    } else if (this.epsilonBehavior === 'zigzag') {
      // Slots 3-4: Zigzag to random positions with holds
      const state = this.epsilonZigzagState;
      
      if (state.isHolding) {
        // Hold at current position
        state.holdTimer += dt;
        if (state.holdTimer >= state.holdDuration) {
          // Done holding, pick new target
          state.isHolding = false;
          state.holdTimer = 0;
          state.waypointCount++;
          
          // After 10 waypoints, track nearest enemy if available
          if (state.waypointCount >= state.maxWaypoints && Array.isArray(enemies) && enemies.length > 0) {
            state.trackingEnemy = true;
          }
        }
      } else {
        // Move toward target or pick new target
        if (state.trackingEnemy && Array.isArray(enemies) && enemies.length > 0) {
          // Track nearest enemy
          let nearestEnemy = null;
          let nearestDist = Infinity;
          for (const enemy of enemies) {
            const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestEnemy = enemy;
            }
          }
          if (nearestEnemy) {
            state.targetX = nearestEnemy.x;
            state.targetY = nearestEnemy.y;
          }
        } else if (state.targetX === null || state.targetY === null) {
          // Pick random target within canvas bounds (ensure positive dimensions)
          if (canvasWidth > 0 && canvasHeight > 0) {
            state.targetX = Math.random() * canvasWidth;
            state.targetY = Math.random() * canvasHeight;
          }
        }
        
        // Move toward target
        if (state.targetX !== null && state.targetY !== null) {
          const dx = state.targetX - this.x;
          const dy = state.targetY - this.y;
          const dist = Math.hypot(dx, dy);
          
          // Check if we've reached the target (within proximity threshold)
          if (dist < this.speed * dt * MathBullet.EPSILON_ZIGZAG_TARGET_PROXIMITY_MULTIPLIER) {
            // Reached target, start holding
            state.isHolding = true;
            state.holdTimer = 0;
            state.targetX = null;
            state.targetY = null;
          } else {
            // Move toward target
            const angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;
          }
        }
      }
      
      this.updateTrailAndRotation(dt);
      return;
    } else if (this.epsilonBehavior === 'spiral') {
      // Slots 5-7: Spiral outward from weapon
      this.epsilonSpiralAngle += dt * MathBullet.EPSILON_SPIRAL_ROTATION_SPEED;
      const radius = this.time * this.speed * MathBullet.EPSILON_SPIRAL_EXPANSION_RATE;
      this.x = this.startX + Math.cos(this.epsilonSpiralAngle) * radius;
      this.y = this.startY + Math.sin(this.epsilonSpiralAngle) * radius;
      
      this.updateTrailAndRotation(dt);
      return;
    }

    // Standard movement (no epsilon behavior)
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

    // Record trail for motion streaks (length based on settings).
    if (this.maxTrailLength > 0) {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrailLength) {
        this.trail.shift();
      }
    }
    
    // Update geometric shape rotation for level 3+ bullets
    if (this.level >= 3) {
      this.shapeRotation += this.shapeRotationSpeed * dt;
    }
  }

  /**
   * Flip mathematical bullets 180 degrees while preserving their oscillation pattern.
   */
  applyTrailBounce(normalX, normalY) {
    // Simple 180-degree flip: reverse the base angle
    this.baseAngle += Math.PI;
    this.baseAngle = normalizeAngle(this.baseAngle);

    // Reset origin so the waveform continues cleanly along the new heading.
    this.startX = this.x;
    this.startY = this.y;
    this.distance = 0;
    this.phase += Math.PI * 0.5; // phase hop keeps the oscillation from snapping
  }

  isOffscreen(width, height) {
    // Spiral bullets (epsilon slots 5-7) only disappear when reaching the top edge of the render area
    if (this.epsilonBehavior === 'spiral') {
      return this.y < -this.size;
    }
    
    return this.x < -this.size || this.x > width + this.size ||
           this.y < -this.size || this.y > height + this.size;
  }
}
