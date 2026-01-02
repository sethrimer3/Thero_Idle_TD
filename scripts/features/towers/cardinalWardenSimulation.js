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
 *
 * Grapheme System:
 * Each weapon has up to 8 grapheme slots (0-7) where lexemes can be placed to modify behavior.
 * Graphemes are named A-Z (English letters), indices 0-25.
 * 
 * - Grapheme 0 (A): ThoughtSpeak - Shape and damage multiplier based on slot
 * - Grapheme 1 (B): Fire rate multiplier based on slot position
 * - Grapheme 2 (C): Spawns friendly ships, deactivates graphemes to the RIGHT
 * - Grapheme 3 (D): Shield regeneration based on slot position and attack speed
 * - Grapheme 4 (E): Lightning movement - straight/zigzag/spiral based on slot
 * - Grapheme 5 (F): Piercing and trail passthrough based on slot position
 * - Grapheme 6 (G): Slow splash damage - expanding wave on hit, deactivates graphemes to the LEFT
 *   - Wave radius: (canvas.width / 10) × (slot + 1)
 *   - Wave damage: 10% of shot damage
 *   - Wave expansion: 3 seconds to reach max radius
 * - Grapheme 7 (H): Weapon targeting - draws target indicator on specific enemies
 *   - Slots 0-3: Target lowest enemy (closest to bottom of render)
 *   - Slots 4-7: Target lowest boss-class enemy
 * - Grapheme 8 (I): Spread bullets - fires multiple bullets in a cone pattern
 *   - Slots 1 and 8 (indices 0,7): +2 extra bullets (3 total)
 *   - Slots 2 and 7 (indices 1,6): +4 extra bullets (5 total)
 *   - Slots 3 and 6 (indices 2,5): +6 extra bullets (7 total)
 *   - Slots 4 and 5 (indices 3,4): +8 extra bullets (9 total)
 * - Grapheme 9 (J): Elemental effects - burning or freezing based on slot position
 *   - Slots 0-3: Burning effect - 5% max health damage per second with red particles
 *   - Slots 4-7: Freeze effect - 0.5 second freeze (ice blue color), refreshes on hit
 * - Grapheme 10 (K): Massive bullet mechanics - slot position determines behavior
 *   - Slots 1-7 (indices 0-6): Fires one massive bullet (20x damage, 20x diameter, 1/10 speed, unlimited pierce, inflicts all effects, 1/20 attack speed)
 *   - Slot 8 (index 7): Simple attack speed increase (10x faster)
 * - Grapheme 11 (L): Continuous beam - deactivates LEFT and RIGHT neighbor graphemes
 *   - Converts bullets into a continuous beam
 *   - Beam damage = tower damage × shots per second
 *   - Applies damage 4 times per second to enemies in contact with beam
 *   - Deactivates graphemes in slots immediately adjacent (left and right)
 * - Grapheme 12 (M): Drifting mines - spawns mines that drift and explode on contact
 *   - Mines released at rate: (shots per second) / 20
 *   - Mines drift slowly in random directions
 *   - On enemy contact: explodes with circular wave
 *   - Explosion diameter: canvas.width / 10
 *   - Explosion damage: 100x base weapon damage
 * - Grapheme 13 (N): Swarm ships - spawns tiny friendly triangles that fire green lasers
 *   - Number of ships: (total graphemes player has) / 10, max 100
 *   - Ships swarm randomly around player's aim target
 *   - Fire green lasers at closest enemy to aim target
 *   - Laser fire rate: weapon attack speed / 10
 *   - Laser damage: weapon damage / 10
 */

import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';
import {
  GRAPHEME_INDEX,
  WAVE_CONFIG,
  SPREAD_CONFIG,
  ELEMENTAL_CONFIG,
  MASSIVE_BULLET_CONFIG,
  BEAM_CONFIG,
  MINE_CONFIG,
  SWARM_CONFIG,
  RICOCHET_CONFIG,
  HOMING_CONFIG,
  SPLIT_CONFIG,
  CHAIN_CONFIG,
  SIZE_CONFIG,
  ORBITAL_CONFIG,
  PULSE_CONFIG,
  SPEED_CONFIG,
  EXPLOSIVE_CONFIG,
  LIFETIME_CONFIG,
  VORTEX_CONFIG,
  CHAOS_CONFIG,
  GAME_CONFIG,
  BOSS_TYPES,
  WEAPON_SLOT_IDS,
  WEAPON_SLOT_DEFINITIONS,
  LEGACY_WEAPON_DEFINITIONS,
  ENEMY_TYPES,
  VISUAL_CONFIG,
  RING_SQUARE_CONFIGS,
  INNER_RING_CONFIGS,
  ORBITAL_SQUARE_CONFIG,
  LIFE_LINES_CONFIG,
  UI_CONFIG,
} from './cardinalWardenConfig.js';

// Configuration constants now imported from cardinalWardenConfig.js

// Sprite assets for Shin spire bullet projectiles (levels 1-16).
const SHIN_BULLET_SPRITE_URLS = Array.from({ length: 16 }, (_, index) => (
  new URL(`../../../assets/sprites/spires/shinSpire/bullets/bulletLevel${index + 1}.png`, import.meta.url).href
));

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
 * Normalize an angle to the [0, 2π) range.
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
 * Reflect a vector across a provided surface normal.
 */
function reflectVector(vx, vy, normalX, normalY) {
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
 * Represents an expanding damage wave spawned by grapheme G (index 6).
 * When a bullet hits an enemy, a wave slowly expands out doing 10% shot damage
 * to all enemies that come in contact with the wave.
 */
class ExpandingWave {
  constructor(x, y, damage, maxRadius, color) {
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.maxRadius = maxRadius;
    this.currentRadius = 0;
    this.expansionSpeed = maxRadius / WAVE_CONFIG.EXPANSION_DURATION_SECONDS;
    this.color = color || VISUAL_CONFIG.DEFAULT_GOLDEN;
    this.hitEnemies = new Set(); // Track which enemies have been hit
    this.hitBosses = new Set(); // Track which bosses have been hit
    this.alpha = 1.0; // Start fully opaque
    this.finished = false;
  }

  update(deltaTime) {
    const dt = deltaTime / 1000; // Convert to seconds
    this.currentRadius += this.expansionSpeed * dt;
    
    // Fade out as the wave approaches max radius
    const progress = this.currentRadius / this.maxRadius;
    this.alpha = Math.max(0, 1 - progress);
    
    // Mark as finished when fully expanded
    if (this.currentRadius >= this.maxRadius) {
      this.finished = true;
    }
  }

  render(ctx) {
    if (this.alpha <= 0) return;
    
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.currentRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Represents a continuous beam weapon created by grapheme L.
 * The beam deals damage multiple times per second to all enemies it touches.
 */
class Beam {
  constructor(x, y, angle, config = {}) {
    this.x = x; // Origin x
    this.y = y; // Origin y
    this.angle = angle;
    this.damage = config.damage || 1; // Damage per tick
    this.damagePerSecond = config.damagePerSecond || 1; // Total damage per second
    this.color = config.color || VISUAL_CONFIG.DEFAULT_GOLDEN;
    this.width = config.width || BEAM_CONFIG.BEAM_WIDTH;
    this.maxLength = config.maxLength || BEAM_CONFIG.MAX_BEAM_LENGTH;
    this.weaponId = config.weaponId || 0; // Track which weapon this beam belongs to
    
    // Track when each enemy was last damaged (to apply damage at correct rate)
    this.enemyLastDamageTime = new Map(); // Maps enemy index to timestamp
    this.bossLastDamageTime = new Map(); // Maps boss index to timestamp
    
    // Time between damage ticks (in milliseconds)
    this.damageInterval = 1000 / BEAM_CONFIG.DAMAGE_TICKS_PER_SECOND;
  }
  
  /**
   * Check if enough time has passed to damage an enemy again.
   */
  canDamageEnemy(enemyIndex, currentTime) {
    const lastTime = this.enemyLastDamageTime.get(enemyIndex);
    if (lastTime === undefined) return true;
    return (currentTime - lastTime) >= this.damageInterval;
  }
  
  /**
   * Check if enough time has passed to damage a boss again.
   */
  canDamageBoss(bossIndex, currentTime) {
    const lastTime = this.bossLastDamageTime.get(bossIndex);
    if (lastTime === undefined) return true;
    return (currentTime - lastTime) >= this.damageInterval;
  }
  
  /**
   * Record that an enemy was damaged at the current time.
   */
  recordEnemyDamage(enemyIndex, currentTime) {
    this.enemyLastDamageTime.set(enemyIndex, currentTime);
  }
  
  /**
   * Record that a boss was damaged at the current time.
   */
  recordBossDamage(bossIndex, currentTime) {
    this.bossLastDamageTime.set(bossIndex, currentTime);
  }
  
  /**
   * Calculate the end point of the beam.
   */
  getEndPoint() {
    return {
      x: this.x + Math.cos(this.angle) * this.maxLength,
      y: this.y + Math.sin(this.angle) * this.maxLength
    };
  }
  
  /**
   * Render the beam on the canvas.
   */
  render(ctx) {
    const end = this.getEndPoint();
    
    ctx.save();
    ctx.globalAlpha = BEAM_CONFIG.BEAM_ALPHA;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width;
    ctx.lineCap = 'round';
    
    // Draw the beam as a line
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    // Add a glow effect
    ctx.globalAlpha = BEAM_CONFIG.BEAM_ALPHA * 0.3;
    ctx.lineWidth = this.width * 3;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    ctx.restore();
  }
}

/**
 * Represents a drifting mine created by grapheme M.
 * Mines drift slowly and explode on contact with enemies.
 */
class Mine {
  constructor(x, y, config = {}) {
    this.x = x;
    this.y = y;
    this.size = config.size || MINE_CONFIG.MINE_SIZE;
    this.color = config.color || VISUAL_CONFIG.DEFAULT_GOLDEN;
    this.baseDamage = config.baseDamage || 1; // Base weapon damage for explosion calculation
    this.explosionRadius = config.explosionRadius || 50; // Radius of explosion wave
    this.weaponId = config.weaponId || 0;
    
    // Random drift direction
    this.driftAngle = Math.random() * Math.PI * 2;
    this.driftSpeed = MINE_CONFIG.DRIFT_SPEED;
    
    // Lifetime tracking
    this.age = 0;
    this.maxAge = MINE_CONFIG.MINE_LIFETIME * 1000; // Convert to milliseconds
    
    // Pulsing visual effect
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.pulseSpeed = 3; // Radians per second
    
    // Explosion state
    this.exploded = false;
  }
  
  update(deltaTime) {
    const dt = deltaTime / 1000; // Convert to seconds
    
    // Drift slowly
    this.x += Math.cos(this.driftAngle) * this.driftSpeed * dt;
    this.y += Math.sin(this.driftAngle) * this.driftSpeed * dt;
    
    // Update age
    this.age += deltaTime;
    
    // Update pulse phase for visual effect
    this.pulsePhase += this.pulseSpeed * dt;
  }
  
  /**
   * Check if mine has expired.
   */
  isExpired() {
    return this.age >= this.maxAge;
  }
  
  /**
   * Check if mine is off screen.
   */
  isOffscreen(width, height) {
    const margin = this.size * 2;
    return this.x < -margin || this.x > width + margin ||
           this.y < -margin || this.y > height + margin;
  }
  
  /**
   * Get the current visual size based on pulse effect.
   */
  getVisualSize() {
    const pulseFactor = 0.2; // 20% size variation
    return this.size * (1 + pulseFactor * Math.sin(this.pulsePhase));
  }
  
  /**
   * Render the mine on the canvas.
   */
  render(ctx) {
    const visualSize = this.getVisualSize();
    
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.8;
    
    // Draw mine as a circle
    ctx.beginPath();
    ctx.arc(this.x, this.y, visualSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw inner glow
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, visualSize * 0.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}

/**
 * Represents a swarm ship spawned by grapheme N (index 13).
 * These tiny triangle ships swarm around the player's aim target and fire green lasers.
 */
class SwarmShip {
  constructor(x, y, targetX, targetY, damage, fireRate, rng) {
    this.x = x;
    this.y = y;
    this.targetX = targetX;
    this.targetY = targetY;
    this.damage = damage;
    this.fireRate = fireRate; // Time between shots in milliseconds
    this.rng = rng;
    
    // Visual properties
    this.size = SWARM_CONFIG.SHIP_SIZE;
    this.color = VISUAL_CONFIG.DEFAULT_SWARM_SHIP_COLOR;
    this.headingAngle = 0;
    
    // Movement behavior - swarm randomly around target
    this.swarmOffsetAngle = rng.range(0, Math.PI * 2);
    this.swarmOffsetDistance = rng.range(0, SWARM_CONFIG.SWARM_RADIUS);
    this.swarmRotationSpeed = rng.range(0.5, 1.5); // Radians per second
    this.swarmRotationDirection = rng.next() > 0.5 ? 1 : -1;
    
    // Trail for visual effect
    this.trail = [];
    this.maxTrailLength = SWARM_CONFIG.TRAIL_LENGTH;
    
    // Firing timer
    this.fireTimer = 0;
  }
  
  update(deltaTime, targetX, targetY) {
    const dt = deltaTime / 1000; // Convert to seconds
    
    // Update target position
    this.targetX = targetX;
    this.targetY = targetY;
    
    // Update swarm rotation
    this.swarmOffsetAngle += this.swarmRotationSpeed * this.swarmRotationDirection * dt;
    
    // Calculate desired position around target
    const desiredX = this.targetX + Math.cos(this.swarmOffsetAngle) * this.swarmOffsetDistance;
    const desiredY = this.targetY + Math.sin(this.swarmOffsetAngle) * this.swarmOffsetDistance;
    
    // Move toward desired position
    const dx = desiredX - this.x;
    const dy = desiredY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 1) {
      const dirX = dx / dist;
      const dirY = dy / dist;
      this.x += dirX * SWARM_CONFIG.MOVEMENT_SPEED * dt;
      this.y += dirY * SWARM_CONFIG.MOVEMENT_SPEED * dt;
      
      // Update heading based on movement
      this.headingAngle = Math.atan2(dy, dx);
    }
    
    // Update trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.shift();
    }
    
    // Update fire timer
    this.fireTimer += deltaTime;
  }
  
  /**
   * Check if the ship is ready to fire.
   */
  canFire() {
    return this.fireTimer >= this.fireRate;
  }
  
  /**
   * Reset the fire timer after firing.
   */
  resetFireTimer() {
    this.fireTimer = 0;
  }
  
  /**
   * Render the swarm ship as a triangle with a thin trail.
   */
  render(ctx) {
    // Draw trail
    if (this.trail.length > 1) {
      ctx.save();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }
    
    // Draw triangle ship
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.headingAngle);
    
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(this.size / 2, 0); // Tip of triangle (pointing right when angle is 0)
    ctx.lineTo(-this.size / 2, -this.size / 3);
    ctx.lineTo(-this.size / 2, this.size / 3);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }
}

/**
 * Represents a laser projectile fired by swarm ships.
 */
class SwarmLaser {
  constructor(x, y, targetX, targetY, damage, color) {
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.color = color || SWARM_CONFIG.LASER_COLOR;
    
    // Calculate direction toward target
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 0) {
      this.vx = (dx / dist) * SWARM_CONFIG.LASER_SPEED;
      this.vy = (dy / dist) * SWARM_CONFIG.LASER_SPEED;
    } else {
      this.vx = 0;
      this.vy = -SWARM_CONFIG.LASER_SPEED; // Default upward
    }
    
    this.angle = Math.atan2(this.vy, this.vx);
    this.length = SWARM_CONFIG.LASER_LENGTH;
    this.width = SWARM_CONFIG.LASER_WIDTH;
  }
  
  update(deltaTime) {
    const dt = deltaTime / 1000; // Convert to seconds
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  
  isOffscreen(width, height) {
    return this.x < -this.length || this.x > width + this.length ||
           this.y < -this.length || this.y > height + this.length;
  }
  
  render(ctx) {
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.9;
    
    // Draw laser as a line
    const endX = this.x + Math.cos(this.angle) * this.length;
    const endY = this.y + Math.sin(this.angle) * this.length;
    
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
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
    this.baseColor = config.color || VISUAL_CONFIG.DEFAULT_ENEMY_COLOR;
    this.color = this.baseColor;

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
class RicochetSkimmer extends EnemyShip {
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
 * Boss ship types available in the game.
 * These are larger, more dangerous enemies that appear periodically.
 */
// BOSS_TYPES now imported from cardinalWardenConfig.js

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
   * Returns an array of newly spawned ships (empty if none spawned this frame).
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
class MegaBoss extends HexagonFortressBoss {
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
class UltraBoss extends HexagonFortressBoss {
  constructor(x, y, config = {}) {
    super(x, y, config);
    this.type = 'ultraBoss';
    this.size = config.size || 65;
  }
}

/**
 * Represents a bullet fired by the Cardinal Warden.
 */
class Bullet {
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
class FriendlyShip {
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
class MathBullet {
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
    this.splitCount = config.splitCount || 0; // Grapheme Q - splits on hit
    this.chainCount = config.chainCount || 0; // Grapheme R - chain targets
    this.chainRange = config.chainRange || 0; // Grapheme R - chain range
    this.orbitalCount = config.orbitalCount || 0; // Grapheme T - orbit count
    this.orbitalProgress = 0; // Track orbit completion
    this.pulseRate = config.pulseRate || 0; // Grapheme U - pulses per second
    this.pulseRadius = config.pulseRadius || 0; // Grapheme U - pulse radius
    this.pulseTimer = 0; // Track time for next pulse
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
      // Find nearest enemy within detection radius
      let nearestEnemy = null;
      let nearestDist = Infinity;
      for (const enemy of enemies) {
        const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
        if (dist < HOMING_CONFIG.DETECTION_RADIUS && dist < nearestDist) {
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

// WEAPON_SLOT_IDS, WEAPON_SLOT_DEFINITIONS, LEGACY_WEAPON_DEFINITIONS, and ENEMY_TYPES
// now imported from cardinalWardenConfig.js

/**
 * Get all available weapon slot IDs.
 */
export function getWeaponIds() {
  return Object.keys(WEAPON_SLOT_DEFINITIONS);
}

/**
 * Get weapon slot definition by ID.
 */
export function getWeaponDefinition(weaponId) {
  return WEAPON_SLOT_DEFINITIONS[weaponId] || null;
}

/**
 * Main Cardinal Warden reverse danmaku simulation.
 */
export class CardinalWardenSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    // Visual style - accept nightMode from options or default to false (light mode)
    this.nightMode = !!options.nightMode;
    this.enemyTrailQuality = options.enemyTrailQuality || 'high';
    this.bulletTrailLength = options.bulletTrailLength || 'long';
    
    // Load colors from config based on mode
    const colorMode = this.nightMode ? VISUAL_CONFIG.NIGHT : VISUAL_CONFIG.DAY;
    this.bgColor = colorMode.BG_COLOR;
    this.wardenCoreColor = colorMode.WARDEN_CORE_COLOR;
    this.wardenSquareColor = colorMode.WARDEN_SQUARE_COLOR;
    this.bulletColor = colorMode.BULLET_COLOR;
    this.ringStrokeColor = colorMode.RING_STROKE_COLOR;
    this.uiTextColor = colorMode.UI_TEXT_COLOR;
    this.enemyTrailColor = colorMode.ENEMY_TRAIL_COLOR;
    this.enemySmokeColor = colorMode.ENEMY_SMOKE_COLOR;
    this.scriptColorDay = options.scriptColorDay || VISUAL_CONFIG.DAY.SCRIPT_COLOR;
    this.scriptColorNight = options.scriptColorNight || VISUAL_CONFIG.NIGHT.SCRIPT_COLOR;
    this.activeScriptColor = this.nightMode ? this.scriptColorNight : this.scriptColorDay;

    // Script font sprite sheet for Cardinal Warden name display
    // The sprite sheet is a 7x5 grid of characters stored as a PNG paired with JSON metadata
    this.scriptSpriteSheet = null;
    this.scriptSpriteLoaded = false;
    this.scriptCols = VISUAL_CONFIG.SCRIPT_SPRITE_COLS;
    this.scriptRows = VISUAL_CONFIG.SCRIPT_SPRITE_ROWS;
    this.tintedScriptSheet = null; // Offscreen canvas containing the colorized script sheet
    this.loadScriptSpriteSheet();

    // Bullet sprite artwork for Shin spire projectiles.
    this.bulletSprites = [];
    // Track which bullet sprite images have finished loading.
    this.bulletSpriteLoaded = [];
    // Begin preloading bullet sprites so they can be drawn during render.
    this.loadBulletSprites();

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
    
    // Life lines visualization (5 lines, each representing 2 lives)
    // States: 'solid' (2 lives), 'dashed' (1 life), 'gone' (0 lives)
    this.initializeLifeLines();

    // Game objects
    this.warden = null;
    this.enemies = [];
    this.bullets = [];
    this.bosses = []; // Boss ships array
    this.friendlyShips = []; // Friendly ships spawned by third grapheme (gamma)
    this.scorePopups = []; // Floating score text when enemies are destroyed
    this.damageNumbers = []; // Floating damage numbers when enemies are hit
    this.expandingWaves = []; // Expanding damage waves spawned by grapheme G (index 6)
    this.beams = []; // Continuous beams from grapheme L (index 11)
    this.mines = []; // Drifting mines from grapheme M (index 12)
    this.swarmShips = []; // Swarm ships from grapheme N (index 13)
    this.swarmLasers = []; // Lasers fired by swarm ships

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

    // Game speed control (1x, 2x, 3x)
    this.gameSpeed = 1;
    this.speedButtonHover = false;

    // Callbacks
    this.onScoreChange = options.onScoreChange || null;
    this.onHighScoreChange = options.onHighScoreChange || null;
    this.onWaveChange = options.onWaveChange || null;
    this.onGameOver = options.onGameOver || null;
    this.onHealthChange = options.onHealthChange || null;
    this.onHighestWaveChange = options.onHighestWaveChange || null;
    this.onEnemyKill = options.onEnemyKill || null;
    this.onPostRender = options.onPostRender || null;
    this.onGuaranteedGraphemeDrop = options.onGuaranteedGraphemeDrop || null;

    // Upgrade state (for future expansion)
    this.upgrades = {
      bulletDamage: 1,
      bulletSpeed: 1,
      bulletCount: 1,
      fireRate: 1,
      patterns: ['radial'], // Unlocked patterns
    };

    // Simplified weapon system - all 3 weapons are always active
    this.weapons = {
      // All 3 weapons are always equipped (no purchase needed)
      purchased: { slot1: true, slot2: true, slot3: true },
      levels: { slot1: 1, slot2: 1, slot3: 1 }, // Level tracking for future lexeme upgrades
      equipped: ['slot1', 'slot2', 'slot3'], // All 3 weapons always active
    };
    
    // Weapon-specific upgrades (attack and speed levels per weapon)
    this.weaponUpgrades = {
      slot1: { attackLevel: 0, speedLevel: 0 },
      slot2: { attackLevel: 0, speedLevel: 0 },
      slot3: { attackLevel: 0, speedLevel: 0 },
    };
    
    // Maximum number of weapons that can be equipped simultaneously (always 3)
    this.maxEquippedWeapons = 3;
    
    // Weapon-specific timers (each weapon has its own fire rate)
    this.weaponTimers = {
      slot1: 0,
      slot2: 0,
      slot3: 0,
    };

    // Weapon glow state for visual feedback (0 = no glow, 1 = full glow)
    this.weaponGlowState = {
      slot1: 0,
      slot2: 0,
      slot3: 0,
    };

    // Weapon phase state for potential future grapheme phase accumulation
    this.weaponPhases = {
      slot1: 0,
      slot2: 0,
      slot3: 0,
    };

    // Weapon grapheme assignments for dynamic script rendering
    // Each weapon has up to 8 grapheme slots for lexeme placement
    this.weaponGraphemeAssignments = {
      slot1: [],
      slot2: [],
      slot3: [],
    };
    
    // Grapheme inventory counts for excess bonus calculation
    // Maps grapheme index to count in player's inventory
    this.graphemeInventoryCounts = {};
    
    // Weapon target tracking for eighth grapheme (index 7 - theta)
    // Stores the currently targeted enemy for each weapon
    this.weaponTargets = {
      slot1: null,
      slot2: null,
      slot3: null,
    };

    // Shield regeneration tracking for fourth grapheme (index 3 - delta)
    // Tracks accumulated time toward next shield recovery
    this.shieldRegenAccumulators = {};

    // Mine spawn timing for grapheme M (index 12)
    // Tracks accumulated time toward next mine spawn for each weapon
    this.mineSpawnAccumulators = {
      slot1: 0,
      slot2: 0,
      slot3: 0,
    };

    // Aim target for player-controlled weapons (Sine Wave and Convergent Rails)
    // When null, weapons fire straight up; when set, they aim toward this point
    this.aimTarget = null;
    
    // Track active pointer for drag-based aiming
    this.aimPointerId = null;
    
    // Bind input handlers for aiming
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    
    // Bind visibility change handler
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

    // Animation frame handle
    this.animationFrameId = null;
    
    // Auto-start flag (game starts immediately without menu)
    this.autoStart = options.autoStart !== false;

    // Callback for weapon state changes
    this.onWeaponChange = options.onWeaponChange || null;

    // Apply the initial palette before creating objects.
    this.applyColorMode();

    this.initialize();
    
    // Auto-start the game if autoStart option is true
    if (this.autoStart) {
      this.start();
    }
  }

  /**
   * Update palette values based on day/night render mode.
   */
  applyColorMode() {
    const colorMode = this.nightMode ? VISUAL_CONFIG.NIGHT : VISUAL_CONFIG.DAY;
    this.bgColor = colorMode.BG_COLOR;
    this.wardenCoreColor = colorMode.WARDEN_CORE_COLOR;
    this.wardenSquareColor = colorMode.WARDEN_SQUARE_COLOR;
    this.bulletColor = colorMode.BULLET_COLOR;
    this.ringStrokeColor = colorMode.RING_STROKE_COLOR;
    this.uiTextColor = colorMode.UI_TEXT_COLOR;
    this.enemyTrailColor = colorMode.ENEMY_TRAIL_COLOR;
    this.enemySmokeColor = colorMode.ENEMY_SMOKE_COLOR;
    this.activeScriptColor = this.nightMode ? this.scriptColorNight : this.scriptColorDay;

    // Rebuild the tinted script sheet so glyphs match the active palette immediately.
    this.rebuildTintedScriptSheet();
    
    // Update weapon colors based on gradient
    this.updateWeaponColors();
  }
  
  /**
   * Calculate weapon colors based on a gradient from the universal color palette.
   * For now, we use a simple gradient from the warden core color.
   * Weapon 1: top of gradient (wardenCoreColor)
   * Weapon 2: middle of gradient (interpolated)
   * Weapon 3: bottom of gradient (complementary color)
   */
  updateWeaponColors() {
    // Start with the warden core color
    const baseColor = this.wardenCoreColor;
    
    // Parse base color to RGB
    const r = parseInt(baseColor.slice(1, 3), 16);
    const g = parseInt(baseColor.slice(3, 5), 16);
    const b = parseInt(baseColor.slice(5, 7), 16);
    
    // Create a gradient with three colors
    // Weapon 1: Base color (top of gradient)
    const weapon1Color = baseColor;
    
    // Weapon 2: Shift hue by 120 degrees for middle color
    const weapon2Color = this.shiftHue(r, g, b, 120);
    
    // Weapon 3: Shift hue by 240 degrees for bottom color
    const weapon3Color = this.shiftHue(r, g, b, 240);
    
    // Update weapon definitions with new colors
    if (WEAPON_SLOT_DEFINITIONS.slot1) {
      WEAPON_SLOT_DEFINITIONS.slot1.color = weapon1Color;
    }
    if (WEAPON_SLOT_DEFINITIONS.slot2) {
      WEAPON_SLOT_DEFINITIONS.slot2.color = weapon2Color;
    }
    if (WEAPON_SLOT_DEFINITIONS.slot3) {
      WEAPON_SLOT_DEFINITIONS.slot3.color = weapon3Color;
    }
  }
  
  /**
   * Shift the hue of an RGB color by a specified amount in degrees.
   * @param {number} r - Red component (0-255)
   * @param {number} g - Green component (0-255)
   * @param {number} b - Blue component (0-255)
   * @param {number} degrees - Degrees to shift hue (0-360)
   * @returns {string} Hex color string
   */
  shiftHue(r, g, b, degrees) {
    // Convert RGB to HSL
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;
    
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const delta = max - min;
    
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    
    if (delta !== 0) {
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
      
      if (max === rNorm) {
        h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) / 6;
      } else if (max === gNorm) {
        h = ((bNorm - rNorm) / delta + 2) / 6;
      } else {
        h = ((rNorm - gNorm) / delta + 4) / 6;
      }
    }
    
    // Shift hue
    h = (h + degrees / 360) % 1;
    
    // Convert HSL back to RGB
    let rOut, gOut, bOut;
    
    if (s === 0) {
      rOut = gOut = bOut = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      
      rOut = hue2rgb(p, q, h + 1/3);
      gOut = hue2rgb(p, q, h);
      bOut = hue2rgb(p, q, h - 1/3);
    }
    
    // Convert to hex
    const rHex = Math.round(rOut * 255).toString(16).padStart(2, '0');
    const gHex = Math.round(gOut * 255).toString(16).padStart(2, '0');
    const bHex = Math.round(bOut * 255).toString(16).padStart(2, '0');
    
    return `#${rHex}${gHex}${bHex}`;
  }

  /**
   * Create a tinted copy of the script sprite sheet so glyphs follow the active palette.
   */
  rebuildTintedScriptSheet() {
    if (!this.scriptSpriteLoaded || !this.scriptSpriteSheet) return;

    const canvas = document.createElement('canvas');
    canvas.width = this.scriptSpriteSheet.width;
    canvas.height = this.scriptSpriteSheet.height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.scriptSpriteSheet, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = this.activeScriptColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.tintedScriptSheet = canvas;
  }

  /**
   * Load the script sprite sheet for the Cardinal Warden name display.
   * The sprite sheet contains unique characters in a 7x5 grid.
   */
  loadScriptSpriteSheet() {
    this.scriptSpriteSheet = new Image();
    this.scriptSpriteSheet.onload = () => {
      this.scriptSpriteLoaded = true;
      // Immediately build a tinted sheet so the glyphs pick up the current color mode.
      this.rebuildTintedScriptSheet();
    };
    this.scriptSpriteSheet.onerror = () => {
      console.warn('Failed to load script sprite sheet for Cardinal Warden');
      this.tintedScriptSheet = null;
    };
    // Path is relative to the HTML page (index.html)
    this.scriptSpriteSheet.src = './assets/sprites/spires/shinSpire/Script.png';
  }

  /**
   * Load bullet sprites so Shin spire projectiles can render with the uploaded artwork.
   */
  loadBulletSprites() {
    // Skip sprite loading on non-browser contexts.
    if (typeof Image === 'undefined') {
      return;
    }
    SHIN_BULLET_SPRITE_URLS.forEach((url, index) => {
      // Initialize each sprite entry for fast lookup during render.
      const sprite = new Image();
      sprite.onload = () => {
        // Record sprite readiness by 1-based bullet level index.
        this.bulletSpriteLoaded[index + 1] = true;
      };
      sprite.onerror = () => {
        console.warn(`Failed to load Shin bullet sprite: ${url}`);
      };
      sprite.src = url;
      this.bulletSprites[index + 1] = sprite;
    });
  }

  /**
   * Render a character from the script sprite sheet.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} charIndex - Index of the character (0-34 for a 7x5 grid)
   * @param {number} x - X position to render at
   * @param {number} y - Y position to render at
   * @param {number} size - Size to render the character
   */
  renderScriptChar(ctx, charIndex, x, y, size) {
    if (!this.scriptSpriteLoaded || !this.scriptSpriteSheet) return;

    // Validate bounds: sprite sheet has scriptCols * scriptRows total indices
    const maxIndex = this.scriptCols * this.scriptRows - 1;
    if (charIndex < 0 || charIndex > maxIndex) {
      console.warn(`Script character index ${charIndex} out of bounds (0-${maxIndex}). Sprite sheet is ${this.scriptCols}x${this.scriptRows}.`);
      return;
    }

    const sheet = this.tintedScriptSheet || this.scriptSpriteSheet;
    const col = charIndex % this.scriptCols;
    const row = Math.floor(charIndex / this.scriptCols);
    const charWidth = sheet.width / this.scriptCols;
    const charHeight = sheet.height / this.scriptRows;

    ctx.drawImage(
      sheet,
      col * charWidth,
      row * charHeight,
      charWidth,
      charHeight,
      x - size / 2,
      y - size / 2,
      size,
      size
    );
  }

  /**
   * Render the Cardinal Warden's script below the warden.
   * Displays 8 lines of script, one per weapon slot, based on assigned graphemes.
   */
  renderWardenName() {
    if (!this.ctx || !this.warden || !this.scriptSpriteLoaded) return;

    const ctx = this.ctx;
    const warden = this.warden;

    // Character size and spacing configuration
    const charSize = 16;
    const charSpacing = charSize * 0.9;
    const lineSpacing = charSize * 1.1;

    // Position just below the warden's outermost ring
    const canvasHeight = this.canvas ? this.canvas.height : 600;
    const spaceBelow = canvasHeight - warden.y;
    const nameStartY = warden.y + Math.min(70, spaceBelow * 0.4);

    // Get weapon slot assignments
    const assignments = this.weaponGraphemeAssignments || {};

    // Render each weapon slot as a line of script
    for (let slotIdx = 0; slotIdx < WEAPON_SLOT_IDS.length; slotIdx++) {
      const slotId = WEAPON_SLOT_IDS[slotIdx];
      const graphemes = (assignments[slotId] || []).filter(g => g != null);
      
      if (graphemes.length === 0) {
        // Skip empty slots (no graphemes assigned)
        continue;
      }

      const lineY = nameStartY + slotIdx * lineSpacing;
      const lineStartX = warden.x - ((graphemes.length - 1) * charSpacing) / 2;

      // Render each grapheme in this weapon slot's line
      for (let i = 0; i < graphemes.length; i++) {
        const grapheme = graphemes[i];
        if (!grapheme || typeof grapheme.index !== 'number') continue;
        
        this.renderScriptChar(ctx, grapheme.index, lineStartX + i * charSpacing, lineY, charSize);
      }
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
    this.attachInputHandlers();
    this.attachVisibilityHandler();
  }

  /**
   * Attach input event handlers for aiming.
   */
  attachInputHandlers() {
    if (!this.canvas) return;
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);
    this.canvas.addEventListener('pointerleave', this.handlePointerUp);
  }

  /**
   * Detach input event handlers.
   */
  detachInputHandlers() {
    if (!this.canvas) return;
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas.removeEventListener('pointerleave', this.handlePointerUp);
  }

  /**
   * Attach visibility change handler to re-enable input when tab becomes visible.
   */
  attachVisibilityHandler() {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Detach visibility change handler.
   */
  detachVisibilityHandler() {
    if (typeof document === 'undefined') return;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Handle visibility change events - re-attach input handlers when tab becomes visible.
   */
  handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      // Re-attach input handlers when tab becomes visible
      this.detachInputHandlers();
      this.attachInputHandlers();
    }
  }

  /**
   * Handle pointer down events for setting aim target.
   * @param {PointerEvent} event - The pointer event
   */
  handlePointerDown(event) {
    if (!this.canvas || this.gamePhase !== 'playing') return;
    
    // Track this pointer for drag-based aiming
    this.aimPointerId = event.pointerId;
    
    // Get canvas-relative coordinates
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    // Set the aim target
    this.aimTarget = { x, y };
  }

  /**
   * Handle pointer move events for dynamic aim target updating during drag.
   * @param {PointerEvent} event - The pointer event
   */
  handlePointerMove(event) {
    // Only update if we're tracking this pointer (started with pointerdown on canvas)
    if (!this.canvas || this.aimPointerId !== event.pointerId || this.gamePhase !== 'playing') return;
    
    // Get canvas-relative coordinates
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    // Update the aim target dynamically
    this.aimTarget = { x, y };
  }

  /**
   * Handle pointer up/cancel/leave events to stop tracking aim pointer.
   * @param {PointerEvent} event - The pointer event
   */
  handlePointerUp(event) {
    if (this.aimPointerId === event.pointerId) {
      this.aimPointerId = null;
    }
  }

  /**
   * Clear the aim target (weapons will fire straight up).
   */
  clearAimTarget() {
    this.aimTarget = null;
  }

  /**
   * Get the current aim target.
   * @returns {Object|null} The aim target {x, y} or null
   */
  getAimTarget() {
    return this.aimTarget;
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
   * Set enemy trail quality setting.
   * @param {string} quality - 'low', 'medium', or 'high'
   */
  setEnemyTrailQuality(quality) {
    const validQualities = ['low', 'medium', 'high'];
    this.enemyTrailQuality = validQualities.includes(quality) ? quality : 'high';
  }

  /**
   * Set bullet trail length setting.
   * @param {string} length - 'none', 'short', 'medium', or 'long'
   */
  setBulletTrailLength(length) {
    const validLengths = ['none', 'short', 'medium', 'long'];
    this.bulletTrailLength = validLengths.includes(length) ? length : 'long';
  }

  /**
   * Get the max trail length for enemies (always full length for gameplay).
   * @returns {number} Max trail entries
   */
  getEnemyTrailMaxLength() {
    // Trail length is always max for gameplay (collision detection)
    return 28;
  }

  /**
   * Get the max smoke puffs for enemies (always full for gameplay).
   * @returns {number} Max smoke puffs
   */
  getEnemySmokeMaxCount() {
    // Smoke puffs always at max for gameplay
    return 60;
  }
  
  /**
   * Get the enemy trail quality for rendering.
   * @returns {string} Quality level: 'low', 'medium', or 'high'
   */
  getEnemyTrailQuality() {
    return this.enemyTrailQuality || 'high';
  }

  /**
   * Get the max trail length for bullets based on current setting.
   * Bullets now have 4x longer trails by default (40 vs original 10).
   * @returns {number} Max trail entries
   */
  getBulletTrailMaxLength() {
    switch (this.bulletTrailLength) {
      case 'none': return 0;
      case 'short': return 10;
      case 'medium': return 20;
      case 'long': return 40;
      default: return 40;
    }
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
      // Heal by the amount of new health gained from the upgrade
      const healthGained = this.warden.maxHealth - oldMaxHealth;
      this.warden.health = Math.min(this.warden.maxHealth, this.warden.health + healthGained);
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
    this.detachInputHandlers();
    this.detachVisibilityHandler();
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
    this.initializeLifeLines();
    this.enemies = [];
    this.bullets = [];
    this.bosses = [];
    this.friendlyShips = [];
    this.expandingWaves = [];
    this.beams = [];
    this.swarmShips = [];
    this.swarmLasers = [];
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
    
    // Reset aim pointer tracking
    this.aimPointerId = null;

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
      // Apply game speed multiplier
      this.update(deltaTime * this.gameSpeed);
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
      
      // Handle guaranteed grapheme drops every 10 waves (waves 10, 20, 30, etc. up to 260)
      const waveNumber = this.wave + 1; // Convert from 0-indexed to 1-indexed
      if (waveNumber % 10 === 0 && waveNumber <= 260) {
        // Guaranteed grapheme drop for wave milestone
        if (this.onGuaranteedGraphemeDrop) {
          this.onGuaranteedGraphemeDrop(waveNumber);
        }
      }
      
      // Handle wave-based boss spawning rules
      this.handleWaveBossSpawns();
      
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

    // Update friendly ships
    this.updateFriendlyShips(deltaTime);
    
    // Update swarm ships
    this.updateSwarmShips(deltaTime);

    // Update enemies
    this.updateEnemies(deltaTime);

    // Update bosses
    this.updateBosses(deltaTime);

    // Update bullets
    this.updateBullets(deltaTime);

    // Check collisions
    this.checkCollisions();
    
    // Check beam collisions
    this.checkBeamCollisions();
    
    // Check friendly ship collisions
    this.checkFriendlyShipCollisions();

    // Update floating score popups
    this.updateScorePopups(deltaTime);

    // Update floating damage numbers
    this.updateDamageNumbers(deltaTime);
    
    // Update expanding waves
    this.updateExpandingWaves(deltaTime);
    
    // Update mines
    this.updateMines(deltaTime);

    // Check game over conditions
    this.checkGameOver();
    
    // Update shield regeneration from fourth grapheme
    this.updateShieldRegeneration(deltaTime);
  }
  
  /**
   * Get the effective grapheme assignments for a weapon slot,
   * applying deactivation mechanics from various graphemes.
   * 
   * Deactivation rules:
   * - Grapheme C (index 2): Deactivates all graphemes to the RIGHT
   * - Grapheme G (index 6): Deactivates all graphemes to the LEFT
   * - Grapheme L (index 11): Deactivates immediate LEFT and RIGHT neighbors
   * 
   * Priority order: G > C > L (if both G and C are present, G takes precedence)
   * 
   * @param {Array} assignments - The raw grapheme assignments for a weapon slot
   * @returns {Array} The effective grapheme assignments after applying deactivation
   */
  getEffectiveGraphemeAssignments(assignments) {
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return [];
    }
    
    // Find the first occurrence of grapheme G (index 6)
    let seventhGraphemeSlot = -1;
    for (let slotIndex = 0; slotIndex < assignments.length; slotIndex++) {
      const assignment = assignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.G) {
        seventhGraphemeSlot = slotIndex;
        break;
      }
    }
    
    // If grapheme G found, deactivate everything to the LEFT
    if (seventhGraphemeSlot !== -1) {
      // Return assignments from grapheme G's slot to the end
      return assignments.slice(seventhGraphemeSlot);
    }
    
    // Find the first occurrence of grapheme C (index 2)
    let thirdGraphemeSlot = -1;
    for (let slotIndex = 0; slotIndex < assignments.length; slotIndex++) {
      const assignment = assignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.C) {
        thirdGraphemeSlot = slotIndex;
        break;
      }
    }
    
    // If third grapheme found, deactivate everything to the RIGHT
    if (thirdGraphemeSlot !== -1) {
      return assignments.slice(0, thirdGraphemeSlot + 1);
    }
    
    // Find all occurrences of grapheme L (index 11) and deactivate adjacent slots
    const graphemeLSlots = [];
    for (let slotIndex = 0; slotIndex < assignments.length; slotIndex++) {
      const assignment = assignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.L) {
        graphemeLSlots.push(slotIndex);
      }
    }
    
    // If grapheme L found, create a copy with adjacent slots nullified
    // Note: If multiple L graphemes are adjacent, the L graphemes themselves remain active
    // while their respective neighbors are nullified (e.g., L in slots 3 and 4 deactivates 2 and 5)
    if (graphemeLSlots.length > 0) {
      const effectiveAssignments = [...assignments];
      for (const lSlot of graphemeLSlots) {
        // Deactivate left neighbor (slot - 1)
        if (lSlot > 0) {
          effectiveAssignments[lSlot - 1] = null;
        }
        // Deactivate right neighbor (slot + 1)
        if (lSlot < effectiveAssignments.length - 1) {
          effectiveAssignments[lSlot + 1] = null;
        }
      }
      return effectiveAssignments;
    }
    
    // If no deactivation graphemes found, all assignments are active
    return assignments;
  }
  
  /**
   * Calculate fire rate multiplier from second grapheme (index 1) and grapheme K (index 10) in effective assignments.
   * @param {Array} effectiveAssignments - The effective grapheme assignments for a weapon
   * @returns {number} Fire rate multiplier (1 = no change, 2 = 2x faster, etc.)
   */
  calculateFireRateMultiplier(effectiveAssignments) {
    let baseMultiplier = 1;
    
    // Check for grapheme B (index 1) - fire rate based on slot
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === 1) {
        // Second grapheme found! Fire rate multiplier based on slot position
        // Slot 0 = 1x (no change), Slot 1 = 2x faster, Slot 2 = 3x faster, etc.
        baseMultiplier = slotIndex + 1;
        break;
      }
    }
    
    // Check for grapheme K (index 10) - massive bullet or speed boost
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.K) {
        if (slotIndex === 7) {
          // Slot 8 (index 7): Speed boost mode - 10x attack speed
          baseMultiplier *= MASSIVE_BULLET_CONFIG.SPEED_BOOST_MULTIPLIER;
        } else {
          // Slots 1-7 (indices 0-6): Massive bullet mode - 1/20 attack speed
          baseMultiplier /= MASSIVE_BULLET_CONFIG.ATTACK_SPEED_DIVISOR;
        }
        break;
      }
    }
    
    return baseMultiplier;
  }
  
  /**
   * Calculate weapon attack speed (bullets per second) for a weapon.
   * @param {Object} weaponDef - The weapon definition
   * @param {number} fireRateMultiplier - Fire rate multiplier from graphemes
   * @returns {number} Attack speed in bullets per second
   */
  calculateWeaponAttackSpeed(weaponDef, fireRateMultiplier) {
    const fireInterval = weaponDef.baseFireRate / fireRateMultiplier;
    return 1000 / fireInterval; // bullets per second
  }
  
  /**
   * Update shield regeneration based on fourth grapheme (index 3 - delta).
   * Formula: 1 shield recovered over (slot_number × weapon_attack_speed) seconds
   * where attack_speed is bullets per second for that weapon.
   */
  updateShieldRegeneration(deltaTime) {
    if (!this.warden || !this.canvas) return;
    
    const equippedWeapons = this.weapons.equipped || [];
    const dt = deltaTime / 1000; // Convert to seconds
    
    for (const weaponId of equippedWeapons) {
      const assignments = this.weaponGraphemeAssignments[weaponId] || [];
      const effectiveAssignments = this.getEffectiveGraphemeAssignments(assignments);
      const weaponDef = WEAPON_SLOT_DEFINITIONS[weaponId];
      if (!weaponDef) continue;
      
      // Check if fourth grapheme (index 3) is present in effective assignments
      let fourthGraphemeSlot = -1;
      for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
        const assignment = effectiveAssignments[slotIndex];
        if (assignment && assignment.index === 3) {
          fourthGraphemeSlot = slotIndex;
          break;
        }
      }
      
      // Skip if no fourth grapheme found
      if (fourthGraphemeSlot === -1) continue;
      
      // Calculate weapon's attack speed (bullets per second)
      const fireRateMultiplier = this.calculateFireRateMultiplier(effectiveAssignments);
      const attackSpeed = this.calculateWeaponAttackSpeed(weaponDef, fireRateMultiplier);
      
      // Calculate time needed to recover 1 shield
      // Formula: 1 / (slot_number × attack_speed) seconds per shield
      // Slot numbering starts at 1 for formula (slot 0 = 1, slot 1 = 2, etc.)
      const slotNumber = fourthGraphemeSlot + 1;
      
      // Guard against division by zero
      if (slotNumber <= 0 || attackSpeed <= 0) continue;
      
      const timePerShield = 1 / (slotNumber * attackSpeed);
      
      // Initialize accumulator if needed
      const key = `${weaponId}_slot${fourthGraphemeSlot}`;
      if (this.shieldRegenAccumulators[key] === undefined) {
        this.shieldRegenAccumulators[key] = 0;
      }
      
      // Accumulate time
      this.shieldRegenAccumulators[key] += dt;
      
      // Check if we've accumulated enough time to recover a shield
      while (this.shieldRegenAccumulators[key] >= timePerShield) {
        this.shieldRegenAccumulators[key] -= timePerShield;
        this.regenerateShield();
      }
    }
  }
  
  /**
   * Regenerate one shield/life for the player.
   * Reverses the life line state progression: gone → dashed → solid
   * Priority: Restore dashed to solid before gone to dashed (complete partial healing first)
   */
  regenerateShield() {
    // First pass: Look for dashed lines to restore to solid (prioritize completing partial healing)
    for (let i = 0; i < this.lifeLines.length; i++) {
      if (this.lifeLines[i].state === 'dashed') {
        this.lifeLines[i].state = 'solid';
        return;
      }
    }
    
    // Second pass: If no dashed lines, restore a gone line to dashed (start new healing)
    for (let i = 0; i < this.lifeLines.length; i++) {
      if (this.lifeLines[i].state === 'gone') {
        this.lifeLines[i].state = 'dashed';
        return;
      }
    }
  }
  
  /**
   * Update weapon timers and fire bullets when ready.
   * All 8 weapon slots are always active.
   */
  updateWeaponTimers(deltaTime) {
    if (!this.warden || !this.canvas) return;
    
    // All weapon slots are always active
    const equippedWeapons = this.weapons.equipped || [];
    
    // Decay glow state smoothly and quickly
    const glowDecayRate = 3.0; // Higher = faster decay
    for (const weaponId of equippedWeapons) {
      if (this.weaponGlowState && this.weaponGlowState[weaponId] > 0) {
        this.weaponGlowState[weaponId] = Math.max(0, this.weaponGlowState[weaponId] - (glowDecayRate * deltaTime / 1000));
      }
    }
    
    for (const weaponId of equippedWeapons) {
      if (!this.weapons.purchased[weaponId]) continue;
      
      const weaponDef = WEAPON_SLOT_DEFINITIONS[weaponId];
      if (!weaponDef) continue;
      
      // Initialize timer if needed
      if (this.weaponTimers[weaponId] === undefined) {
        this.weaponTimers[weaponId] = 0;
      }
      
      // Calculate fire rate multiplier from second grapheme (index 1)
      // Use effective assignments to respect third grapheme deactivation
      const assignments = this.weaponGraphemeAssignments[weaponId] || [];
      const effectiveAssignments = this.getEffectiveGraphemeAssignments(assignments);
      const fireRateMultiplier = this.calculateFireRateMultiplier(effectiveAssignments);
      
      // Apply weapon-specific speed upgrade multiplier
      const weaponSpeedMult = this.getWeaponSpeedMultiplier(weaponId);
      
      // Apply fire rate multiplier by dividing the interval (higher multiplier = faster shooting)
      const fireInterval = weaponDef.baseFireRate / (fireRateMultiplier * weaponSpeedMult);
      
      this.weaponTimers[weaponId] += deltaTime;
      
      if (this.weaponTimers[weaponId] >= fireInterval) {
        this.weaponTimers[weaponId] = 0;
        this.fireWeapon(weaponId);
      }
      
      // Check for grapheme M (index 12) - Mine spawning
      let hasMineGrapheme = false;
      for (const assignment of effectiveAssignments) {
        if (assignment && assignment.index === GRAPHEME_INDEX.M) {
          hasMineGrapheme = true;
          break;
        }
      }
      
      if (hasMineGrapheme) {
        // Initialize mine spawn accumulator if needed
        if (this.mineSpawnAccumulators[weaponId] === undefined) {
          this.mineSpawnAccumulators[weaponId] = 0;
        }
        
        // Calculate mine spawn rate: (shots per second) / 20
        const shotsPerSecond = this.calculateWeaponAttackSpeed(weaponDef, fireRateMultiplier);
        const mineSpawnRate = shotsPerSecond / MINE_CONFIG.SPAWN_RATE_DIVISOR;
        const mineSpawnInterval = 1000 / mineSpawnRate; // Interval in milliseconds
        
        this.mineSpawnAccumulators[weaponId] += deltaTime;
        
        if (this.mineSpawnAccumulators[weaponId] >= mineSpawnInterval) {
          this.mineSpawnAccumulators[weaponId] = 0;
          this.spawnMine(weaponId);
        }
      }
    }
  }
  
  /**
   * Fire a simple bullet from a specific weapon slot toward the aim target.
   * Applies ThoughtSpeak grapheme mechanics if the first grapheme (index 0) is present.
   */
  fireWeapon(weaponId) {
    if (!this.warden || !this.canvas) return;
    
    const weaponDef = WEAPON_SLOT_DEFINITIONS[weaponId];
    if (!weaponDef) return;
    
    const cx = this.warden.x;
    const cy = this.warden.y;
    const level = this.weapons.levels[weaponId] || 1;
    
    // Set glow state to full when firing (will decay in update loop)
    if (this.weaponGlowState) {
      this.weaponGlowState[weaponId] = 1.0;
    }
    
    // Calculate stats based on level (for future lexeme upgrades)
    let damageMultiplier = 1 + (level - 1) * 0.25;
    const speedMultiplier = 1 + (level - 1) * 0.1;
    
    // Calculate excess grapheme bonus
    // For each equipped grapheme, add bonus damage equal to inventory count
    // Example: If player has 15 of grapheme "A" and A is equipped, add +15 to base damage
    const assignments = this.weaponGraphemeAssignments[weaponId] || [];
    let excessGraphemeBonus = 0;
    for (const assignment of assignments) {
      if (assignment && assignment.index !== undefined) {
        const inventoryCount = this.graphemeInventoryCounts[assignment.index] || 0;
        // Each excess grapheme adds +1 to damage bonus
        excessGraphemeBonus += inventoryCount;
      }
    }
    
    // ThoughtSpeak mechanics: Check for first grapheme (index 0) in any slot
    // Shape and damage multiplier based on slot position
    // Use effective assignments to respect third grapheme deactivation
    let bulletShape = null; // null = circle (default), otherwise number of sides
    const effectiveAssignments = this.getEffectiveGraphemeAssignments(assignments);
    
    // Check for fifth grapheme (index 4 - Epsilon) - Lightning movement behavior
    let epsilonBehavior = null;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === 4) {
        // Fifth grapheme found! Behavior based on slot position
        // Slots 0-2: straight bullets
        // Slots 3-4: zigzag with holds
        // Slots 5-7: spiral outward
        if (slotIndex <= 2) {
          epsilonBehavior = 'straight';
        } else if (slotIndex <= 4) {
          epsilonBehavior = 'zigzag';
        } else {
          epsilonBehavior = 'spiral';
        }
        break; // Only apply the first occurrence
      }
    }
    
    // Check for sixth grapheme (index 5 - Zeta) - Pierce and trail passthrough
    let piercingCount = 0;
    let bounceOnTrails = true; // Default: bullets bounce off trails
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === 5) {
        // Sixth grapheme found! Pierce based on slot position
        // Slot 0 = +1 pierce, slot 1 = +2 pierce, slot 2 = +3 pierce, etc.
        piercingCount = slotIndex + 1;
        // When this grapheme is equipped, bullets pass through enemy trails without bouncing
        bounceOnTrails = false;
        break; // Only apply the first occurrence
      }
    }
    
    // Check for grapheme G (index 6) - Slow splash damage wave
    let waveRadius = 0;
    let hasWaveEffect = false;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.G) {
        // Grapheme G found! Wave radius based on slot position
        // Base radius = 1/10th canvas width, multiplied by slot position (1-indexed)
        // Slot 0 = 1x, slot 1 = 2x, slot 2 = 3x, etc.
        const slotMultiplier = slotIndex + 1;
        const baseRadius = this.canvas ? this.canvas.width / 10 : 50;
        waveRadius = baseRadius * slotMultiplier;
        hasWaveEffect = true;
        break; // Only apply the first occurrence
      }
    }
    
    // Check for grapheme H (index 7) - Weapon targeting
    let targetedEnemy = null;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.H) {
        // Grapheme H found! Targeting based on slot position
        // Slots 0-3: Target lowest enemy (closest to bottom of render)
        // Slots 4-7: Target lowest boss-class enemy
        if (slotIndex <= 3) {
          // Target lowest enemy (highest y coordinate)
          let lowestEnemy = null;
          let lowestY = -Infinity;
          for (const enemy of this.enemies) {
            if (enemy.y > lowestY) {
              lowestY = enemy.y;
              lowestEnemy = enemy;
            }
          }
          targetedEnemy = lowestEnemy;
        } else {
          // Target lowest boss (highest y coordinate)
          let lowestBoss = null;
          let lowestY = -Infinity;
          for (const boss of this.bosses) {
            if (boss.y > lowestY) {
              lowestY = boss.y;
              lowestBoss = boss;
            }
          }
          targetedEnemy = lowestBoss;
        }
        // Store the targeted enemy for this weapon
        this.weaponTargets[weaponId] = targetedEnemy;
        break; // Only apply the first occurrence
      }
    }
    
    // Clear target if no eighth grapheme is present
    if (targetedEnemy === null) {
      this.weaponTargets[weaponId] = null;
    }
    
    // Check for ninth grapheme (index 8 - I) - Spread bullets
    let spreadBulletCount = 0;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.I) {
        // Ninth grapheme found! Extra bullets based on slot position
        // Use lookup table for slot-to-bullet mapping
        if (slotIndex >= 0 && slotIndex < SPREAD_CONFIG.SLOT_TO_EXTRA_BULLETS.length) {
          spreadBulletCount = SPREAD_CONFIG.SLOT_TO_EXTRA_BULLETS[slotIndex];
        }
        break; // Only apply the first occurrence
      }
    }
    
    // Check for tenth grapheme (index 9 - J) - Elemental effects (burning/freezing)
    let elementalEffect = null; // 'burning' or 'freezing'
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.J) {
        // Tenth grapheme found! Effect based on slot position
        // Slots 0-3: Burning effect (5% max health damage per second)
        // Slots 4-7: Freeze effect (0.5 second freeze, ice blue color)
        if (slotIndex <= 3) {
          elementalEffect = 'burning';
        } else {
          elementalEffect = 'freezing';
        }
        break; // Only apply the first occurrence
      }
    }
    
    // Check for eleventh grapheme (index 10 - K) - Massive bullet or speed boost
    let massiveBulletMode = false;
    let massiveBulletSlot = -1;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.K) {
        // Eleventh grapheme found! Mode based on slot position
        // Slots 0-6 (indices 0-6): Massive bullet mode
        // Slot 8 (index 7): Speed boost only (already handled in fire rate calculation)
        if (slotIndex !== 7) {
          massiveBulletMode = true;
          massiveBulletSlot = slotIndex;
        }
        break; // Only apply the first occurrence
      }
    }
    
    // Check for grapheme L (index 11) - Continuous beam
    let beamMode = false;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.L) {
        // Grapheme L found! Beam mode activated
        beamMode = true;
        break; // Only apply the first occurrence
      }
    }
    
    // Note: Grapheme M (mines) spawning is handled separately in updateWeaponTimers()
    // Mines are spawned alongside bullets, not instead of them
    
    // Check for grapheme O (index 14) - Ricochet bullets
    let ricochetBounces = 0;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.O) {
        // Ricochet found! Bounces based on slot position (1-8 bounces)
        ricochetBounces = RICOCHET_CONFIG.SLOT_TO_BOUNCES[slotIndex] || (slotIndex + 1);
        break; // Only apply the first occurrence
      }
    }
    
    // Check for grapheme P (index 15) - Homing missiles
    let homingTurnRate = 0;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.P) {
        // Homing found! Turn rate based on slot position
        const turnMultiplier = HOMING_CONFIG.SLOT_TO_TURN_MULTIPLIER[slotIndex] || 1;
        homingTurnRate = HOMING_CONFIG.BASE_TURN_RATE * turnMultiplier;
        break; // Only apply the first occurrence
      }
    }
    
    // Check for grapheme Q (index 16) - Split bullets
    let splitCount = 0;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.Q) {
        // Split found! Split count based on slot position (2-9 splits)
        splitCount = SPLIT_CONFIG.SLOT_TO_SPLIT_COUNT[slotIndex] || (slotIndex + 2);
        break; // Only apply the first occurrence
      }
    }
    
    // Check for grapheme R (index 17) - Chain lightning
    let chainCount = 0;
    let chainRange = 0;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.R) {
        // Chain found! Chains based on slot position
        chainCount = CHAIN_CONFIG.SLOT_TO_CHAINS[slotIndex] || (slotIndex + 1);
        chainRange = CHAIN_CONFIG.SLOT_TO_RANGE[slotIndex] || 20;
        break; // Only apply the first occurrence
      }
    }
    
    // Check for grapheme S (index 18) - Bullet size
    let sizeMultiplier = 1;
    let sizeSpeedMult = 1;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.S) {
        // Size modifier found!
        sizeMultiplier = SIZE_CONFIG.SLOT_TO_SIZE_MULT[slotIndex] || 1;
        sizeSpeedMult = SIZE_CONFIG.SLOT_TO_SPEED_MULT[slotIndex] || 1;
        break; // Only apply the first occurrence
      }
    }
    
    // Check for grapheme T (index 19) - Orbital bullets
    let orbitalCount = 0;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.T) {
        // Orbital found! Orbit count based on slot position
        orbitalCount = ORBITAL_CONFIG.SLOT_TO_ORBITS[slotIndex] || (slotIndex + 1);
        break; // Only apply the first occurrence
      }
    }
    
    // Check for grapheme U (index 20) - Pulse waves
    let pulseRate = 0;
    let pulseRadius = 0;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.U) {
        // Pulse found! Rate and radius based on slot position
        pulseRate = PULSE_CONFIG.SLOT_TO_PULSE_RATE[slotIndex] || (slotIndex + 1);
        pulseRadius = PULSE_CONFIG.SLOT_TO_PULSE_RADIUS[slotIndex] || 15;
        break; // Only apply the first occurrence
      }
    }
    
    // Check for grapheme V (index 21) - Bullet speed
    let bulletSpeedMult = 1;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.V) {
        // Speed modifier found!
        bulletSpeedMult = SPEED_CONFIG.SLOT_TO_SPEED_MULT[slotIndex] || 1;
        break; // Only apply the first occurrence
      }
    }
    
    // Check for grapheme W (index 22) - Explosive bullets
    let explosionRadius = 0;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.W) {
        // Explosive found! Radius based on slot position
        explosionRadius = EXPLOSIVE_CONFIG.SLOT_TO_RADIUS[slotIndex] || 20;
        break; // Only apply the first occurrence
      }
    }
    
    // Check for grapheme X (index 23) - Bullet lifetime
    let lifetimeMultiplier = 1;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.X) {
        // Lifetime modifier found!
        lifetimeMultiplier = LIFETIME_CONFIG.SLOT_TO_LIFETIME_MULT[slotIndex] || 1;
        break; // Only apply the first occurrence
      }
    }
    
    // Check for grapheme Y (index 24) - Vortex bullets
    let vortexRadius = 0;
    let vortexStrength = 0;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.Y) {
        // Vortex found! Radius and strength based on slot position
        vortexRadius = VORTEX_CONFIG.SLOT_TO_PULL_RADIUS[slotIndex] || 10;
        vortexStrength = VORTEX_CONFIG.SLOT_TO_PULL_STRENGTH[slotIndex] || 20;
        break; // Only apply the first occurrence
      }
    }
    
    // Check for grapheme Z (index 25) - Chaos (random effects)
    let chaosEffectCount = 0;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.Z) {
        // Chaos found! Number of random effects based on slot position
        chaosEffectCount = CHAOS_CONFIG.SLOT_TO_EFFECT_COUNT[slotIndex] || 2;
        break; // Only apply the first occurrence
      }
    }
    
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === 0) {
        // First grapheme found! Apply slot-based mechanics
        // Slot 0 = triangle (3 sides), 3x damage
        // Slot 1 = pentagon (5 sides), 5x damage  
        // Slot 2 = hexagon (6 sides), 6x damage
        // Slot 3+ = continues pattern (7, 8, 9, 10, 11 sides, etc.)
        const sidesMap = [3, 5, 6, 7, 8, 9, 10, 11];
        bulletShape = sidesMap[slotIndex] !== undefined ? sidesMap[slotIndex] : Math.max(3, slotIndex + 3);
        damageMultiplier *= bulletShape; // 3x, 5x, 6x, 7x, 8x, 9x, 10x, 11x, etc.
        break; // Only apply the first occurrence
      }
    }

    const resolvedColor = this.resolveBulletColor(weaponDef.color);
    
    // Apply weapon-specific upgrades
    const weaponAttackMult = this.getWeaponAttackMultiplier(weaponId);
    const weaponSpeedMult = this.getWeaponSpeedMultiplier(weaponId);

    const bulletConfig = {
      speed: weaponDef.baseSpeed * speedMultiplier * weaponSpeedMult * bulletSpeedMult * sizeSpeedMult * this.upgrades.bulletSpeed,
      damage: (weaponDef.baseDamage + excessGraphemeBonus) * damageMultiplier * weaponAttackMult * this.upgrades.bulletDamage,
      size: 4 * sizeMultiplier,
      baseColor: weaponDef.color,
      color: resolvedColor,
      pattern: 'straight', // Simple straight pattern
      amplitude: 0, // No wave motion
      frequency: 0,
      level: bulletShape !== null ? bulletShape : level, // Use shape as level for rendering
      maxTrailLength: this.getBulletTrailMaxLength(),
      thoughtSpeakShape: bulletShape, // Custom property for ThoughtSpeak shapes
      epsilonBehavior: epsilonBehavior, // Fifth grapheme behavior
      piercing: piercingCount > 0, // Sixth grapheme - enable piercing
      piercingLimit: piercingCount, // Sixth grapheme - max pierce count based on slot (0 = unlimited)
      bounceOnTrails: bounceOnTrails, // Sixth grapheme - disable trail bouncing when present
      hasWaveEffect: hasWaveEffect, // Seventh grapheme - spawn expanding wave on hit
      waveRadius: waveRadius, // Seventh grapheme - max radius of expanding wave
      elementalEffect: elementalEffect, // Tenth grapheme - burning or freezing effect
      // New grapheme O-Z effects
      ricochetBounces: ricochetBounces, // Grapheme O - number of bounces
      homingTurnRate: homingTurnRate, // Grapheme P - homing turn rate
      splitCount: splitCount, // Grapheme Q - number of splits
      chainCount: chainCount, // Grapheme R - chain lightning count
      chainRange: chainRange, // Grapheme R - chain range
      orbitalCount: orbitalCount, // Grapheme T - number of orbits
      pulseRate: pulseRate, // Grapheme U - pulses per second
      pulseRadius: pulseRadius, // Grapheme U - pulse radius
      explosionRadius: explosionRadius, // Grapheme W - explosion radius
      lifetimeMultiplier: lifetimeMultiplier, // Grapheme X - lifetime multiplier
      vortexRadius: vortexRadius, // Grapheme Y - vortex pull radius
      vortexStrength: vortexStrength, // Grapheme Y - vortex pull strength
      chaosEffectCount: chaosEffectCount, // Grapheme Z - number of random effects
    };
    
    // Apply massive bullet modifications if grapheme K is in slots 0-6
    if (massiveBulletMode) {
      bulletConfig.damage *= MASSIVE_BULLET_CONFIG.DAMAGE_MULTIPLIER;
      bulletConfig.size *= MASSIVE_BULLET_CONFIG.SIZE_MULTIPLIER;
      bulletConfig.speed /= MASSIVE_BULLET_CONFIG.SPEED_DIVISOR;
      bulletConfig.piercing = true;
      bulletConfig.piercingLimit = 0; // Unlimited pierce
      // The bullet will apply all effects it touches (elemental effects already configured)
      // hasWaveEffect and elementalEffect are preserved from other graphemes
    }

    // Calculate angle toward target
    // Priority: grapheme H target > aim target > straight up
    let baseAngle = -Math.PI / 2; // Default: straight up
    
    // If grapheme H is active and has a valid target, aim at that target
    if (targetedEnemy && targetedEnemy.x !== undefined && targetedEnemy.y !== undefined) {
      const dx = targetedEnemy.x - cx;
      const dy = targetedEnemy.y - (cy - 20); // Account for bullet spawn offset
      baseAngle = Math.atan2(dy, dx);
    } else if (this.aimTarget) {
      // Otherwise use player's aim target
      const dx = this.aimTarget.x - cx;
      const dy = this.aimTarget.y - (cy - 20); // Account for bullet spawn offset
      baseAngle = Math.atan2(dy, dx);
    }
    
    // If beam mode is active, create/update beam instead of spawning bullets
    if (beamMode) {
      // Calculate weapon attack speed for beam damage
      const fireRateMultiplier = this.calculateFireRateMultiplier(effectiveAssignments);
      const attackSpeed = this.calculateWeaponAttackSpeed(weaponDef, fireRateMultiplier);
      
      // Beam damage = tower damage × shots per second
      const beamDamagePerSecond = bulletConfig.damage * attackSpeed;
      
      // Remove existing beam for this weapon (if any)
      this.beams = this.beams.filter(b => b.weaponId !== weaponId);
      
      // Create new beam
      const beam = new Beam(cx, cy - 20, baseAngle, {
        damage: beamDamagePerSecond / BEAM_CONFIG.DAMAGE_TICKS_PER_SECOND,
        damagePerSecond: beamDamagePerSecond,
        color: resolvedColor,
        weaponId: weaponId,
      });
      
      this.beams.push(beam);
      return; // Exit early - no bullets spawned
    }
    
    // Spawn bullets based on spread count (disabled in massive bullet mode)
    if (spreadBulletCount > 0 && !massiveBulletMode) {
      // Spawn multiple bullets in a spread pattern
      // Total bullets = 1 (center) + spreadBulletCount (extras)
      const totalBullets = 1 + spreadBulletCount;
      
      // Calculate spread angle (in radians)
      // Spread out evenly across a cone
      const spreadAngle = SPREAD_CONFIG.SPREAD_ANGLE;
      const angleStep = spreadAngle / (totalBullets - 1);
      const startAngle = baseAngle - (spreadAngle / 2);
      
      for (let i = 0; i < totalBullets; i++) {
        const bulletAngle = startAngle + (i * angleStep);
        this.bullets.push(new MathBullet(cx, cy - 20, bulletAngle, {
          ...bulletConfig,
          phase: 0,
        }));
      }
    } else {
      // Spawn a single bullet toward the target (or massive bullet in grapheme K mode)
      this.bullets.push(new MathBullet(cx, cy - 20, baseAngle, {
        ...bulletConfig,
        phase: 0,
      }));
    }
  }
  
  /**
   * Spawn a mine from a specific weapon slot.
   * Mines drift slowly and explode on contact with enemies.
   */
  spawnMine(weaponId) {
    if (!this.warden || !this.canvas) return;
    
    const weaponDef = WEAPON_SLOT_DEFINITIONS[weaponId];
    if (!weaponDef) return;
    
    const cx = this.warden.x;
    const cy = this.warden.y;
    
    // Calculate explosion damage (100x base weapon damage)
    const baseDamage = weaponDef.baseDamage * this.upgrades.bulletDamage;
    const explosionDamage = baseDamage * MINE_CONFIG.EXPLOSION_DAMAGE_MULTIPLIER;
    
    // Calculate explosion radius (1/10th canvas width)
    const explosionRadius = this.canvas.width / MINE_CONFIG.EXPLOSION_DIAMETER_DIVISOR;
    
    // Get weapon color
    const color = this.resolveBulletColor(weaponDef.color);
    
    // Create mine at warden position
    const mine = new Mine(cx, cy, {
      size: MINE_CONFIG.MINE_SIZE,
      color: color,
      baseDamage: explosionDamage,
      explosionRadius: explosionRadius,
      weaponId: weaponId,
    });
    
    this.mines.push(mine);
  }
  
  /**
   * Update friendly ships based on third grapheme (index 2 - gamma) assignments.
   * Spawns ships up to the max count determined by fire rate.
   */
  updateFriendlyShips(deltaTime) {
    if (!this.warden || !this.canvas) return;
    
    // Count how many weapons have third grapheme (index 2) and calculate total fire rate
    let totalFireRate = 0; // bullets per second
    let hasThirdGrapheme = false;
    let weaponDamage = 1; // Track weapon damage for friendly ships
    
    for (const weaponId of this.weapons.equipped) {
      const assignments = this.weaponGraphemeAssignments[weaponId] || [];
      const effectiveAssignments = this.getEffectiveGraphemeAssignments(assignments);
      const weaponDef = WEAPON_SLOT_DEFINITIONS[weaponId];
      
      for (const assignment of effectiveAssignments) {
        if (assignment && assignment.index === 2) {
          hasThirdGrapheme = true;
          
          // Calculate fire rate multiplier and bullets per second for this weapon
          const fireRateMultiplier = this.calculateFireRateMultiplier(effectiveAssignments);
          const bulletsPerSecond = this.calculateWeaponAttackSpeed(weaponDef, fireRateMultiplier);
          totalFireRate += bulletsPerSecond;
          
          // Get weapon damage (using same calculation as fireWeapon)
          const level = this.weapons.levels[weaponId] || 1;
          let damageMultiplier = 1 + (level - 1) * 0.25;
          
          // Check for first grapheme damage multiplier
          for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
            const a = effectiveAssignments[slotIndex];
            if (a && a.index === 0) {
              const sidesMap = [3, 5, 6, 7, 8, 9, 10, 11];
              const bulletShape = sidesMap[slotIndex] !== undefined ? sidesMap[slotIndex] : Math.max(3, slotIndex + 3);
              damageMultiplier *= bulletShape;
              break;
            }
          }
          
          weaponDamage = Math.max(weaponDamage, weaponDef.baseDamage * damageMultiplier * this.upgrades.bulletDamage);
          break; // Only count once per weapon
        }
      }
    }
    
    if (!hasThirdGrapheme || totalFireRate <= 0) {
      // No third grapheme or no fire rate - clear all friendly ships
      this.friendlyShips = [];
      return;
    }
    
    // Calculate max ships: 5 / bullets per second, rounded to nearest whole number
    const maxShips = Math.max(1, Math.round(5 / totalFireRate));
    
    // Spawn ships if we have less than max
    while (this.friendlyShips.length < maxShips) {
      const angle = this.rng.range(0, Math.PI * 2);
      const radius = 60;
      const x = this.warden.x + Math.cos(angle) * radius;
      const y = this.warden.y + Math.sin(angle) * radius;
      
      // Assign weapon color based on current ship count to distribute colors across weapons
      const weaponIds = WEAPON_SLOT_IDS;
      const weaponId = weaponIds[this.friendlyShips.length % weaponIds.length];
      const color = WEAPON_SLOT_DEFINITIONS[weaponId].color;
      
      this.friendlyShips.push(new FriendlyShip(x, y, this.warden.x, this.warden.y, weaponDamage, color, this.rng));
    }
    
    // Remove excess ships if max decreased
    while (this.friendlyShips.length > maxShips) {
      this.friendlyShips.pop();
    }
    
    // Update all friendly ships
    for (let i = this.friendlyShips.length - 1; i >= 0; i--) {
      const ship = this.friendlyShips[i];
      ship.update(deltaTime, this.warden, this.enemies, this.canvas.height);
    }
  }
  
  /**
   * Check collisions between friendly ships and enemies.
   */
  checkFriendlyShipCollisions() {
    const enemiesToRemove = new Set();
    const bossesToRemove = new Set();
    const shipsToRemove = new Set();
    const killedEnemyPositions = [];
    
    for (let si = 0; si < this.friendlyShips.length; si++) {
      const ship = this.friendlyShips[si];
      if (shipsToRemove.has(si)) continue;
      
      for (let ei = 0; ei < this.enemies.length; ei++) {
        const enemy = this.enemies[ei];
        if (enemiesToRemove.has(ei)) continue;
        
        if (ship.checkCollision(enemy)) {
          // Spawn damage number
          this.spawnDamageNumber(enemy.x, enemy.y, ship.damage);
          
          const killed = enemy.takeDamage(ship.damage);
          
          if (killed) {
            enemiesToRemove.add(ei);
            this.addScore(enemy.scoreValue);
            this.spawnScorePopup(enemy.x, enemy.y, enemy.scoreValue);
            killedEnemyPositions.push({ x: enemy.x, y: enemy.y, isBoss: false });
          }
          
          // Friendly ships are destroyed on impact
          shipsToRemove.add(si);
          break;
        }
      }
    }
    
    // Also check collisions with bosses
    for (let si = 0; si < this.friendlyShips.length; si++) {
      const ship = this.friendlyShips[si];
      if (shipsToRemove.has(si)) continue;
      
      for (let bi = 0; bi < this.bosses.length; bi++) {
        const boss = this.bosses[bi];
        if (bossesToRemove.has(bi)) continue;
        
        if (ship.checkCollision(boss)) {
          // Spawn damage number
          this.spawnDamageNumber(boss.x, boss.y, ship.damage);
          
          const killed = boss.takeDamage(ship.damage);
          
          if (killed) {
            bossesToRemove.add(bi);
            this.addScore(boss.scoreValue);
            this.spawnScorePopup(boss.x, boss.y, boss.scoreValue);
            killedEnemyPositions.push({ x: boss.x, y: boss.y, isBoss: true });
          }
          
          // Friendly ships are destroyed on impact
          shipsToRemove.add(si);
          break;
        }
      }
    }
    
    // Remove destroyed enemies
    const enemyIndices = Array.from(enemiesToRemove).sort((a, b) => b - a);
    for (const i of enemyIndices) {
      this.enemies.splice(i, 1);
    }
    
    // Remove destroyed bosses
    const bossIndices = Array.from(bossesToRemove).sort((a, b) => b - a);
    for (const i of bossIndices) {
      this.bosses.splice(i, 1);
    }
    
    // Remove destroyed friendly ships
    const shipIndices = Array.from(shipsToRemove).sort((a, b) => b - a);
    for (const i of shipIndices) {
      this.friendlyShips.splice(i, 1);
    }
    
    // Notify about enemy kills for grapheme drops
    if (this.onEnemyKill && killedEnemyPositions.length > 0) {
      for (const killPos of killedEnemyPositions) {
        this.onEnemyKill(killPos.x, killPos.y, killPos.isBoss);
      }
    }
  }
  
  /**
   * Update swarm ships from grapheme N (index 13).
   * Number of ships = (total graphemes) / 10, max 100.
   */
  updateSwarmShips(deltaTime) {
    if (!this.warden || !this.canvas) return;
    
    // Check if any weapon has grapheme N (index 13)
    let hasSwarmGrapheme = false;
    let weaponDamage = 1;
    let weaponFireRate = 500; // Default fire rate in milliseconds
    
    for (const weaponId of this.weapons.equipped) {
      const assignments = this.weaponGraphemeAssignments[weaponId] || [];
      const effectiveAssignments = this.getEffectiveGraphemeAssignments(assignments);
      const weaponDef = WEAPON_SLOT_DEFINITIONS[weaponId];
      
      for (const assignment of effectiveAssignments) {
        if (assignment && assignment.index === GRAPHEME_INDEX.N) {
          hasSwarmGrapheme = true;
          
          // Calculate weapon stats
          const level = this.weapons.levels[weaponId] || 1;
          let damageMultiplier = 1 + (level - 1) * 0.25;
          
          // Check for first grapheme damage multiplier
          for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
            const a = effectiveAssignments[slotIndex];
            if (a && a.index === 0) {
              const sidesMap = [3, 5, 6, 7, 8, 9, 10, 11];
              const bulletShape = sidesMap[slotIndex] !== undefined ? sidesMap[slotIndex] : Math.max(3, slotIndex + 3);
              damageMultiplier *= bulletShape;
              break;
            }
          }
          
          weaponDamage = Math.max(weaponDamage, weaponDef.baseDamage * damageMultiplier * this.upgrades.bulletDamage);
          
          // Calculate fire rate
          const fireRateMultiplier = this.calculateFireRateMultiplier(effectiveAssignments);
          const attackSpeed = this.calculateWeaponAttackSpeed(weaponDef, fireRateMultiplier);
          weaponFireRate = Math.min(weaponFireRate, 1000 / attackSpeed); // Convert to milliseconds
          
          break; // Only use the first weapon with grapheme N
        }
      }
      
      if (hasSwarmGrapheme) break;
    }
    
    if (!hasSwarmGrapheme) {
      // No swarm grapheme - clear all swarm ships and lasers
      this.swarmShips = [];
      this.swarmLasers = [];
      return;
    }
    
    // Calculate number of swarm ships based on total grapheme count
    let totalGraphemes = 0;
    for (const count of Object.values(this.graphemeInventoryCounts)) {
      totalGraphemes += count;
    }
    
    const maxShips = Math.min(
      Math.floor(totalGraphemes / SWARM_CONFIG.GRAPHEME_COUNT_DIVISOR),
      SWARM_CONFIG.MAX_SWARM_SHIPS
    );
    
    // Default target position (aim target or screen center)
    const targetX = this.aimTarget ? this.aimTarget.x : this.canvas.width / 2;
    const targetY = this.aimTarget ? this.aimTarget.y : this.canvas.height / 4;
    
    // Spawn ships if we have less than max
    while (this.swarmShips.length < maxShips) {
      const angle = this.rng.range(0, Math.PI * 2);
      const radius = this.rng.range(0, SWARM_CONFIG.SWARM_RADIUS);
      const x = targetX + Math.cos(angle) * radius;
      const y = targetY + Math.sin(angle) * radius;
      
      // Swarm ships fire at 1/10th weapon attack speed with 1/10th damage
      const swarmDamage = weaponDamage / SWARM_CONFIG.DAMAGE_DIVISOR;
      const swarmFireRate = weaponFireRate * SWARM_CONFIG.FIRE_RATE_DIVISOR;
      
      this.swarmShips.push(new SwarmShip(x, y, targetX, targetY, swarmDamage, swarmFireRate, this.rng));
    }
    
    // Remove excess ships if max decreased
    while (this.swarmShips.length > maxShips) {
      this.swarmShips.pop();
    }
    
    // Update all swarm ships
    for (const ship of this.swarmShips) {
      ship.update(deltaTime, targetX, targetY);
      
      // Check if ship can fire
      if (ship.canFire() && (this.enemies.length > 0 || this.bosses.length > 0)) {
        // Find closest enemy to the aim target
        let closestEnemy = null;
        let closestDist = Infinity;
        
        for (const enemy of this.enemies) {
          const dx = enemy.x - targetX;
          const dy = enemy.y - targetY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < closestDist) {
            closestDist = dist;
            closestEnemy = enemy;
          }
        }
        
        for (const boss of this.bosses) {
          const dx = boss.x - targetX;
          const dy = boss.y - targetY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < closestDist) {
            closestDist = dist;
            closestEnemy = boss;
          }
        }
        
        // Fire laser at closest enemy
        if (closestEnemy) {
          const laser = new SwarmLaser(ship.x, ship.y, closestEnemy.x, closestEnemy.y, ship.damage, SWARM_CONFIG.LASER_COLOR);
          this.swarmLasers.push(laser);
          ship.resetFireTimer();
        }
      }
    }
    
    // Update swarm lasers
    for (let i = this.swarmLasers.length - 1; i >= 0; i--) {
      const laser = this.swarmLasers[i];
      laser.update(deltaTime);
      
      // Remove if offscreen
      if (laser.isOffscreen(this.canvas.width, this.canvas.height)) {
        this.swarmLasers.splice(i, 1);
      }
    }
    
    // Check laser collisions with enemies
    this.checkSwarmLaserCollisions();
  }
  
  /**
   * Check collisions between swarm lasers and enemies.
   */
  checkSwarmLaserCollisions() {
    const lasersToRemove = new Set();
    const enemiesToRemove = new Set();
    const bossesToRemove = new Set();
    const killedEnemyPositions = [];
    
    for (let li = 0; li < this.swarmLasers.length; li++) {
      const laser = this.swarmLasers[li];
      if (lasersToRemove.has(li)) continue;
      
      // Check collision with regular enemies
      for (let ei = 0; ei < this.enemies.length; ei++) {
        const enemy = this.enemies[ei];
        if (enemiesToRemove.has(ei)) continue;
        
        const dx = laser.x - enemy.x;
        const dy = laser.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < enemy.size + laser.width) {
          // Hit!
          this.spawnDamageNumber(enemy.x, enemy.y, laser.damage);
          const killed = enemy.takeDamage(laser.damage);
          
          if (killed) {
            enemiesToRemove.add(ei);
            this.addScore(enemy.scoreValue);
            this.spawnScorePopup(enemy.x, enemy.y, enemy.scoreValue);
            killedEnemyPositions.push({ x: enemy.x, y: enemy.y, isBoss: false });
          }
          
          lasersToRemove.add(li);
          break;
        }
      }
      
      // Check collision with bosses
      if (!lasersToRemove.has(li)) {
        for (let bi = 0; bi < this.bosses.length; bi++) {
          const boss = this.bosses[bi];
          if (bossesToRemove.has(bi)) continue;
          
          const dx = laser.x - boss.x;
          const dy = laser.y - boss.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < boss.size + laser.width) {
            // Hit!
            this.spawnDamageNumber(boss.x, boss.y, laser.damage);
            const killed = boss.takeDamage(laser.damage);
            
            if (killed) {
              bossesToRemove.add(bi);
              this.addScore(boss.scoreValue);
              this.spawnScorePopup(boss.x, boss.y, boss.scoreValue);
              killedEnemyPositions.push({ x: boss.x, y: boss.y, isBoss: true });
            }
            
            lasersToRemove.add(li);
            break;
          }
        }
      }
    }
    
    // Remove dead enemies
    const enemyIndices = Array.from(enemiesToRemove).sort((a, b) => b - a);
    for (const i of enemyIndices) {
      this.enemies.splice(i, 1);
    }
    
    // Remove dead bosses
    const bossIndices = Array.from(bossesToRemove).sort((a, b) => b - a);
    for (const i of bossIndices) {
      this.bosses.splice(i, 1);
    }
    
    // Remove hit lasers
    const laserIndices = Array.from(lasersToRemove).sort((a, b) => b - a);
    for (const i of laserIndices) {
      this.swarmLasers.splice(i, 1);
    }
    
    // Notify about enemy kills for grapheme drops
    if (this.onEnemyKill && killedEnemyPositions.length > 0) {
      for (const killPos of killedEnemyPositions) {
        this.onEnemyKill(killPos.x, killPos.y, killPos.isBoss);
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
    this.initializeLifeLines();
    this.enemies = [];
    this.bullets = [];
    this.bosses = [];
    this.friendlyShips = [];
    this.enemySpawnTimer = 0;
    this.bulletSpawnTimer = 0;
    this.waveTimer = 0;
    this.bossSpawnTimer = 0;
    
    // Reset aim pointer tracking
    this.aimPointerId = null;

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
    
    // Additive HP scaling: each wave adds 10% more HP (1.1x, 1.2x, 1.3x... 2x at wave 10, etc.)
    const waveMultiplier = 1 + (this.wave * 0.1);
    
    // Determine if this ship should weave (30% chance for fast/elite types)
    const canWeave = typeKey === 'fast' || typeKey === 'elite';
    const shouldWeave = canWeave && this.rng.next() < 0.3;
    
    const config = {
      ...baseConfig,
      speed: baseConfig.speed * (1 + this.difficultyLevel * 0.1),
      health: Math.ceil(baseConfig.health * waveMultiplier),
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

    if (typeKey === 'ricochet') {
      config.initialHeading = this.rng.next() < 0.5 ? Math.PI / 4 : (3 * Math.PI) / 4;
    }

    const ship = typeKey === 'ricochet' ? new RicochetSkimmer(x, y, config) : new EnemyShip(x, y, config);
    ship.color = this.nightMode ? '#ffffff' : ship.baseColor;
    // Set initial target lower on screen for standard ships
    if (ship instanceof EnemyShip && !(ship instanceof RicochetSkimmer)) {
      ship.pickNewTarget(this.canvas.width, this.canvas.height, this.rng);
    }
    this.enemies.push(ship);
  }

  /**
   * Get pool of enemy types available at current difficulty.
   */
  getEnemyTypePool() {
    const pool = ['basic'];
    if (this.difficultyLevel >= 1) pool.push('fast');
    if (this.difficultyLevel >= 2) pool.push('tank');
    if (this.difficultyLevel >= 3) pool.push('ricochet');
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

    // Multiply base health by wave number (wave is 0-indexed, so wave+1)
    const waveMultiplier = this.wave + 1;

    const config = {
      ...baseConfig,
      speed: baseConfig.speed * (1 + (this.difficultyLevel - GAME_CONFIG.BOSS_MIN_DIFFICULTY) * 0.05),
      health: Math.ceil(baseConfig.health * waveMultiplier),
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
      case 'megaBoss':
        boss = new MegaBoss(x, y, config);
        break;
      case 'ultraBoss':
        boss = new UltraBoss(x, y, config);
        break;
      default:
        boss = new CircleCarrierBoss(x, y, config);
    }

    boss.color = this.nightMode ? '#ffffff' : boss.baseColor;
    boss.pickNewTarget(this.canvas.width, this.canvas.height, this.rng);
    this.bosses.push(boss);
  }

  /**
   * Handle wave-based boss spawning rules.
   * Called when a new wave starts.
   */
  handleWaveBossSpawns() {
    const waveNumber = this.wave + 1; // Convert from 0-indexed to 1-indexed
    
    // Wave 50+: One boss every 5 waves
    // Wave 100+: One boss every wave
    // Wave 150+: One mega boss every 5 waves
    // Wave 200+: One mega boss every wave + 5 regular bosses
    // Wave 250+: One ultra boss every 5 waves + 2 mega bosses + 10 normal bosses
    // Wave 300+: One ultra boss every wave + two bosses per wave
    
    if (waveNumber >= 300) {
      // Wave 300+: One ultra boss every wave + two normal bosses
      this.spawnSpecificBoss('ultraBoss');
      this.spawnSpecificBoss('hexagonFortress');
      this.spawnSpecificBoss('pyramidBoss');
    } else if (waveNumber >= 250) {
      // Wave 250+: One ultra boss every 5 waves + 2 mega bosses + 10 normal bosses every wave
      if (waveNumber % 5 === 0) {
        this.spawnSpecificBoss('ultraBoss');
      }
      for (let i = 0; i < 2; i++) {
        this.spawnSpecificBoss('megaBoss');
      }
      for (let i = 0; i < 10; i++) {
        this.spawnBoss();
      }
    } else if (waveNumber >= 200) {
      // Wave 200+: One mega boss every wave + 5 regular bosses
      this.spawnSpecificBoss('megaBoss');
      for (let i = 0; i < 5; i++) {
        this.spawnBoss();
      }
    } else if (waveNumber >= 150) {
      // Wave 150+: One mega boss every 5 waves
      if (waveNumber % 5 === 0) {
        this.spawnSpecificBoss('megaBoss');
      }
    } else if (waveNumber >= 100) {
      // Wave 100+: One boss every wave
      this.spawnBoss();
    } else if (waveNumber >= 50) {
      // Wave 50+: One boss every 5 waves
      if (waveNumber % 5 === 0) {
        this.spawnBoss();
      }
    }
  }

  /**
   * Spawn a specific boss type.
   */
  spawnSpecificBoss(bossType) {
    if (!this.canvas) return;

    const baseConfig = BOSS_TYPES[bossType];
    if (!baseConfig) {
      console.warn(`Unknown boss type: ${bossType}`);
      return;
    }

    // Scale boss stats by difficulty
    const difficultyMultiplier = 1 + (this.difficultyLevel - GAME_CONFIG.BOSS_MIN_DIFFICULTY) * GAME_CONFIG.BOSS_DIFFICULTY_SCALE;

    // Multiply base health by wave number
    const waveMultiplier = this.wave + 1;

    const config = {
      ...baseConfig,
      speed: baseConfig.speed * (1 + (this.difficultyLevel - GAME_CONFIG.BOSS_MIN_DIFFICULTY) * 0.05),
      health: Math.ceil(baseConfig.health * waveMultiplier),
      damage: Math.ceil(baseConfig.damage * difficultyMultiplier),
      scoreValue: Math.ceil(baseConfig.scoreValue * difficultyMultiplier),
    };

    // Random x position at top of screen
    const x = this.rng.range(config.size * 2, this.canvas.width - config.size * 2);
    const y = -config.size;

    let boss;
    switch (bossType) {
      case 'circleCarrier':
        boss = new CircleCarrierBoss(x, y, config);
        break;
      case 'pyramidBoss':
        boss = new PyramidBoss(x, y, config);
        break;
      case 'hexagonFortress':
        boss = new HexagonFortressBoss(x, y, config);
        break;
      case 'megaBoss':
        boss = new MegaBoss(x, y, config);
        break;
      case 'ultraBoss':
        boss = new UltraBoss(x, y, config);
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
        this.updateLifeLine(2); // Consume 2 lives for bosses
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
        this.updateLifeLine();
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
   * Bounce a bullet off nearby ship trails when it grazes their wake.
   */
  tryBounceBulletOffTrails(bullet) {
    if (!this.canvas) return false;
    if (bullet.bounceOnTrails === false) return false;
    if (typeof bullet.applyTrailBounce !== 'function') return false;
    if (bullet.age - bullet.lastTrailBounceTime < 45) return false;

    const proximityRadius = bullet.size + 2;
    const proximityRadiusSq = proximityRadius * proximityRadius;
    const segmentsToInspect = 8;

    const checkTrail = (trail) => {
      if (!trail || trail.length < 2) return false;
      const startIdx = Math.max(1, trail.length - segmentsToInspect);
      for (let i = trail.length - 1; i >= startIdx; i--) {
        const p1 = trail[i - 1];
        const p2 = trail[i];
        const segDx = p2.x - p1.x;
        const segDy = p2.y - p1.y;
        const segLenSq = segDx * segDx + segDy * segDy;
        if (segLenSq === 0) continue;

        const t = Math.max(0, Math.min(1, ((bullet.x - p1.x) * segDx + (bullet.y - p1.y) * segDy) / segLenSq));
        const closestX = p1.x + segDx * t;
        const closestY = p1.y + segDy * t;
        const distX = bullet.x - closestX;
        const distY = bullet.y - closestY;

        if (distX * distX + distY * distY <= proximityRadiusSq) {
          // Trail tangent -> normal; approximate reflection cheaply.
          const normalX = -segDy;
          const normalY = segDx;
          bullet.applyTrailBounce(normalX, normalY);
          bullet.lastTrailBounceTime = bullet.age;
          return true;
        }
      }
      return false;
    };

    for (const enemy of this.enemies) {
      if (checkTrail(enemy.trail)) {
        return true;
      }
    }

    for (const boss of this.bosses) {
      if (checkTrail(boss.trail)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Update all bullets.
   */
  updateBullets(deltaTime) {
    if (!this.canvas) return;

    const toRemove = [];

    for (let i = 0; i < this.bullets.length; i++) {
      const bullet = this.bullets[i];
      bullet.update(deltaTime, this.canvas.width, this.canvas.height, this.enemies);

      // Grapheme U (index 20) - Pulse waves
      if (bullet.pulseRate > 0 && bullet.pulseRadius > 0) {
        bullet.pulseTimer += deltaTime / 1000;
        const pulseInterval = 1 / bullet.pulseRate;
        
        if (bullet.pulseTimer >= pulseInterval) {
          bullet.pulseTimer = 0;
          const pulseDamage = bullet.damage * PULSE_CONFIG.PULSE_DAMAGE_MULTIPLIER;
          
          // Damage all enemies in pulse radius
          for (const enemy of this.enemies) {
            const dist = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
            if (dist <= bullet.pulseRadius) {
              this.spawnDamageNumber(enemy.x, enemy.y, pulseDamage);
              enemy.takeDamage(pulseDamage);
            }
          }
          
          // Also damage bosses
          for (const boss of this.bosses) {
            const dist = Math.hypot(boss.x - bullet.x, boss.y - bullet.y);
            if (dist <= bullet.pulseRadius) {
              this.spawnDamageNumber(boss.x, boss.y, pulseDamage);
              boss.takeDamage(pulseDamage);
            }
          }
        }
      }
      
      // Grapheme Y (index 24) - Vortex pull
      if (bullet.vortexRadius > 0 && bullet.vortexStrength > 0) {
        const dt = deltaTime / 1000;
        
        // Pull enemies toward bullet
        for (const enemy of this.enemies) {
          const dx = bullet.x - enemy.x;
          const dy = bullet.y - enemy.y;
          const dist = Math.hypot(dx, dy);
          
          if (dist <= bullet.vortexRadius && dist > 0) {
            const pullForce = bullet.vortexStrength * dt;
            enemy.x += (dx / dist) * pullForce;
            enemy.y += (dy / dist) * pullForce;
          }
        }
        
        // Also pull bosses
        for (const boss of this.bosses) {
          const dx = bullet.x - boss.x;
          const dy = bullet.y - boss.y;
          const dist = Math.hypot(dx, dy);
          
          if (dist <= bullet.vortexRadius && dist > 0) {
            const pullForce = bullet.vortexStrength * dt;
            boss.x += (dx / dist) * pullForce;
            boss.y += (dy / dist) * pullForce;
          }
        }
      }

      this.tryBounceBulletOffTrails(bullet);

      // Grapheme X (index 23) - Lifetime modifier affects when bullets are removed
      const lifetimeCheck = bullet.lifetimeMultiplier || 1;
      const baseLifetime = 5000; // Base lifetime in milliseconds
      const adjustedLifetime = baseLifetime * lifetimeCheck;
      const isOffscreen = bullet.isOffscreen(this.canvas.width, this.canvas.height);
      
      // Check age-based removal first, then offscreen
      if (bullet.age > adjustedLifetime) {
        toRemove.push(i);
      } else if (isOffscreen) {
        // Only for normal/extended lifetime, allow some offscreen time
        if (lifetimeCheck <= 1 || bullet.age > adjustedLifetime * 0.8) {
          toRemove.push(i);
        }
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
    const killedEnemyPositions = []; // Track positions of killed enemies for phoneme drops

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
          // Spawn damage number to show how much damage was dealt
          this.spawnDamageNumber(enemy.x, enemy.y, bullet.damage);
          
          const killed = enemy.takeDamage(bullet.damage);
          
          // Spawn expanding wave if seventh grapheme is present
          if (bullet.hasWaveEffect && bullet.waveRadius > 0) {
            const waveDamage = bullet.damage * WAVE_CONFIG.DAMAGE_MULTIPLIER;
            const waveColor = bullet.color || '#d4af37';
            this.expandingWaves.push(new ExpandingWave(enemy.x, enemy.y, waveDamage, bullet.waveRadius, waveColor));
          }
          
          // Apply elemental effect from tenth grapheme (J)
          if (bullet.elementalEffect === 'burning') {
            enemy.applyBurning();
          } else if (bullet.elementalEffect === 'freezing') {
            enemy.applyFreeze();
          }
          
          // Handle new grapheme effects on hit (O-Z)
          
          // Grapheme Q (index 16) - Split bullets
          if (bullet.splitCount > 1 && !bulletsToRemove.has(bi)) {
            const splitAngle = SPLIT_CONFIG.SPLIT_SPREAD_ANGLE;
            const angleStep = bullet.splitCount > 1 ? splitAngle / (bullet.splitCount - 1) : 0;
            const startAngle = bullet.baseAngle - (splitAngle / 2);
            
            for (let s = 0; s < bullet.splitCount; s++) {
              const angle = startAngle + (s * angleStep);
              const splitBullet = new MathBullet(enemy.x, enemy.y, angle, {
                speed: bullet.speed,
                damage: bullet.damage * SPLIT_CONFIG.SPLIT_DAMAGE_MULTIPLIER,
                size: bullet.size * 0.7,
                color: bullet.color,
                level: bullet.level,
                maxTrailLength: bullet.maxTrailLength,
              });
              this.bullets.push(splitBullet);
            }
          }
          
          // Grapheme R (index 17) - Chain lightning
          // Note: Initial enemy already received full damage above in normal collision
          // This chains ADDITIONAL damage to nearby enemies
          if (bullet.chainCount > 0) {
            let currentChainDamage = bullet.damage * CHAIN_CONFIG.CHAIN_DAMAGE_MULTIPLIER; // First chain gets reduced damage
            let currentTarget = enemy;
            const chainedTargets = new Set([ei]); // Track to avoid chaining to same target (includes initial hit)
            
            for (let c = 0; c < bullet.chainCount; c++) {
              // Apply additional damage decay for subsequent chains (after first chain target)
              if (c > 0) {
                currentChainDamage *= CHAIN_CONFIG.CHAIN_DAMAGE_MULTIPLIER;
              }
              
              // Find nearest unchained enemy (excludes initial hit and previously chained)
              let nearestEnemy = null;
              let nearestDist = Infinity;
              
              for (let cei = 0; cei < this.enemies.length; cei++) {
                if (chainedTargets.has(cei) || enemiesToRemove.has(cei)) continue;
                const ce = this.enemies[cei];
                const dist = Math.hypot(ce.x - currentTarget.x, ce.y - currentTarget.y);
                if (dist < bullet.chainRange && dist < nearestDist) {
                  nearestDist = dist;
                  nearestEnemy = { enemy: ce, index: cei };
                }
              }
              
              if (nearestEnemy) {
                // Chain to this enemy
                this.spawnDamageNumber(nearestEnemy.enemy.x, nearestEnemy.enemy.y, currentChainDamage);
                const chainKilled = nearestEnemy.enemy.takeDamage(currentChainDamage);
                
                if (chainKilled) {
                  enemiesToRemove.add(nearestEnemy.index);
                  this.addScore(nearestEnemy.enemy.scoreValue);
                  this.spawnScorePopup(nearestEnemy.enemy.x, nearestEnemy.enemy.y, nearestEnemy.enemy.scoreValue);
                  killedEnemyPositions.push({ x: nearestEnemy.enemy.x, y: nearestEnemy.enemy.y, isBoss: false });
                }
                
                chainedTargets.add(nearestEnemy.index);
                currentTarget = nearestEnemy.enemy;
              } else {
                break; // No more targets in range
              }
            }
          }
          
          // Grapheme W (index 22) - Explosive bullets
          if (bullet.explosionRadius > 0) {
            const explosionDamage = bullet.damage * EXPLOSIVE_CONFIG.EXPLOSION_DAMAGE_MULTIPLIER;
            
            // Damage all enemies in explosion radius
            for (let exi = 0; exi < this.enemies.length; exi++) {
              if (enemiesToRemove.has(exi)) continue;
              const exEnemy = this.enemies[exi];
              const dist = Math.hypot(exEnemy.x - enemy.x, exEnemy.y - enemy.y);
              
              if (dist <= bullet.explosionRadius) {
                this.spawnDamageNumber(exEnemy.x, exEnemy.y, explosionDamage);
                const exKilled = exEnemy.takeDamage(explosionDamage);
                
                if (exKilled) {
                  enemiesToRemove.add(exi);
                  this.addScore(exEnemy.scoreValue);
                  this.spawnScorePopup(exEnemy.x, exEnemy.y, exEnemy.scoreValue);
                  killedEnemyPositions.push({ x: exEnemy.x, y: exEnemy.y, isBoss: false });
                }
              }
            }
          }
          
          // Grapheme O (index 14) - Ricochet
          if (bullet.ricochetBounces > 0 && bullet.ricochetCount < bullet.ricochetBounces) {
            // Find nearest unchained enemy for ricochet
            let nearestEnemy = null;
            let nearestDist = Infinity;
            
            for (let rei = 0; rei < this.enemies.length; rei++) {
              if (rei === ei || enemiesToRemove.has(rei) || hitEnemies.has(rei)) continue;
              const re = this.enemies[rei];
              const dist = Math.hypot(re.x - enemy.x, re.y - enemy.y);
              if (dist < nearestDist) {
                nearestDist = dist;
                nearestEnemy = re;
              }
            }
            
            if (nearestEnemy) {
              // Redirect bullet to nearest enemy
              bullet.ricochetCount++;
              bullet.damage *= RICOCHET_CONFIG.BOUNCE_DAMAGE_MULTIPLIER;
              const dx = nearestEnemy.x - bullet.x;
              const dy = nearestEnemy.y - bullet.y;
              bullet.baseAngle = Math.atan2(dy, dx);
              // Mark current enemy as hit to prevent bouncing back
              hitEnemies.add(ei);
              // Don't mark for removal yet - let it ricochet
            } else {
              // No more targets to ricochet to, remove the bullet
              if (!bulletsToRemove.has(bi)) {
                bulletsToRemove.add(bi);
              }
            }
          } else if (bullet.ricochetBounces === 0 || bullet.ricochetCount >= bullet.ricochetBounces) {
            // Normal behavior: no ricochet or max bounces reached
            // Piercing logic will handle bullet removal if needed
          }

          if (killed) {
            enemiesToRemove.add(ei);
            this.addScore(enemy.scoreValue);
            // Spawn floating score popup at enemy position
            this.spawnScorePopup(enemy.x, enemy.y, enemy.scoreValue);
            // Track position for phoneme drop
            killedEnemyPositions.push({ x: enemy.x, y: enemy.y, isBoss: false });
          }

          if (bullet.piercing) {
            hitEnemies.add(ei);
            // Check if piercing limit has been reached (0 = unlimited)
            // Count total hits including both enemies and bosses
            const totalHits = bullet.hitEnemies.size + bullet.hitBosses.size;
            if (bullet.piercingLimit > 0 && totalHits >= bullet.piercingLimit) {
              bulletsToRemove.add(bi);
              break;
            }
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
          // Spawn damage number to show how much damage was dealt
          this.spawnDamageNumber(boss.x, boss.y, bullet.damage);
          
          const killed = boss.takeDamage(bullet.damage);
          
          // Spawn expanding wave if seventh grapheme is present
          if (bullet.hasWaveEffect && bullet.waveRadius > 0) {
            const waveDamage = bullet.damage * WAVE_CONFIG.DAMAGE_MULTIPLIER;
            const waveColor = bullet.color || '#d4af37';
            this.expandingWaves.push(new ExpandingWave(boss.x, boss.y, waveDamage, bullet.waveRadius, waveColor));
          }
          
          // Apply elemental effect from tenth grapheme (J)
          if (bullet.elementalEffect === 'burning') {
            boss.applyBurning();
          } else if (bullet.elementalEffect === 'freezing') {
            boss.applyFreeze();
          }

          if (killed) {
            bossesToRemove.add(boi);
            this.addScore(boss.scoreValue);
            // Spawn floating score popup at boss position
            this.spawnScorePopup(boss.x, boss.y, boss.scoreValue);
            // Track position for phoneme drop (bosses drop multiple)
            killedEnemyPositions.push({ x: boss.x, y: boss.y, isBoss: true });
          }

          if (bullet.piercing) {
            hitBosses.add(boi);
            // Check if piercing limit has been reached (0 = unlimited)
            // Count total hits across both enemies and bosses
            const totalHits = bullet.hitEnemies.size + bullet.hitBosses.size;
            if (bullet.piercingLimit > 0 && totalHits >= bullet.piercingLimit) {
              bulletsToRemove.add(bi);
              break;
            }
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
    
    // Notify about enemy kills for phoneme drops
    if (this.onEnemyKill && killedEnemyPositions.length > 0) {
      for (const killPos of killedEnemyPositions) {
        this.onEnemyKill(killPos.x, killPos.y, killPos.isBoss);
      }
    }
  }

  /**
   * Check collisions between beams and enemies.
   * Beams deal damage multiple times per second to all enemies they touch.
   */
  checkBeamCollisions() {
    if (!this.beams || this.beams.length === 0) return;
    
    const currentTime = Date.now();
    const enemiesToRemove = new Set();
    const bossesToRemove = new Set();
    const killedEnemyPositions = [];
    
    // For each beam, check collision with all enemies and bosses
    for (const beam of this.beams) {
      const beamEnd = beam.getEndPoint();
      
      // Check enemies
      for (let ei = 0; ei < this.enemies.length; ei++) {
        const enemy = this.enemies[ei];
        if (enemiesToRemove.has(ei)) continue;
        
        // Check if enemy intersects with beam line
        const dist = this.pointToLineDistance(
          enemy.x, enemy.y,
          beam.x, beam.y,
          beamEnd.x, beamEnd.y
        );
        
        if (dist < enemy.size + beam.width / 2) {
          // Enemy is touching the beam - apply damage if enough time has passed
          if (beam.canDamageEnemy(ei, currentTime)) {
            this.spawnDamageNumber(enemy.x, enemy.y, beam.damage);
            const killed = enemy.takeDamage(beam.damage);
            beam.recordEnemyDamage(ei, currentTime);
            
            if (killed) {
              enemiesToRemove.add(ei);
              this.addScore(enemy.scoreValue);
              this.spawnScorePopup(enemy.x, enemy.y, enemy.scoreValue);
              killedEnemyPositions.push({ x: enemy.x, y: enemy.y, isBoss: false });
            }
          }
        }
      }
      
      // Check bosses
      for (let bi = 0; bi < this.bosses.length; bi++) {
        const boss = this.bosses[bi];
        if (bossesToRemove.has(bi)) continue;
        
        // Check if boss intersects with beam line
        const dist = this.pointToLineDistance(
          boss.x, boss.y,
          beam.x, beam.y,
          beamEnd.x, beamEnd.y
        );
        
        if (dist < boss.size + beam.width / 2) {
          // Boss is touching the beam - apply damage if enough time has passed
          if (beam.canDamageBoss(bi, currentTime)) {
            this.spawnDamageNumber(boss.x, boss.y, beam.damage);
            const killed = boss.takeDamage(beam.damage);
            beam.recordBossDamage(bi, currentTime);
            
            if (killed) {
              bossesToRemove.add(bi);
              this.addScore(boss.scoreValue);
              this.spawnScorePopup(boss.x, boss.y, boss.scoreValue);
              killedEnemyPositions.push({ x: boss.x, y: boss.y, isBoss: true });
            }
          }
        }
      }
    }
    
    // Remove destroyed enemies
    const enemyIndices = Array.from(enemiesToRemove).sort((a, b) => b - a);
    for (const i of enemyIndices) {
      this.enemies.splice(i, 1);
    }
    
    // Remove destroyed bosses
    const bossIndices = Array.from(bossesToRemove).sort((a, b) => b - a);
    for (const i of bossIndices) {
      this.bosses.splice(i, 1);
    }
    
    // Notify about enemy kills for phoneme drops
    if (this.onEnemyKill && killedEnemyPositions.length > 0) {
      for (const killPos of killedEnemyPositions) {
        this.onEnemyKill(killPos.x, killPos.y, killPos.isBoss);
      }
    }
  }
  
  /**
   * Calculate the distance from a point to a line segment.
   * Used for beam collision detection.
   */
  pointToLineDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    
    // Use epsilon for floating-point comparison
    if (lengthSquared < 1e-10) {
      // Line segment is effectively a point
      const dpx = px - x1;
      const dpy = py - y1;
      return Math.hypot(dpx, dpy);
    }
    
    // Calculate projection of point onto line
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t)); // Clamp to line segment
    
    // Find closest point on line segment
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    
    // Return distance to closest point
    const distX = px - closestX;
    const distY = py - closestY;
    return Math.hypot(distX, distY);
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
   * Spawn a floating damage number at the given position.
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} damage - Damage value to display
   */
  spawnDamageNumber(x, y, damage) {
    const DAMAGE_NUMBER_X_SPREAD = 10; // Horizontal spread to prevent overlapping numbers
    this.damageNumbers.push({
      x,
      y,
      damage,
      age: 0,
      alpha: 1,
      offsetY: 0,
      // Add slight randomness to x position so overlapping numbers are visible
      xOffset: (Math.random() - 0.5) * DAMAGE_NUMBER_X_SPREAD,
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
   * Update all floating damage numbers.
   * @param {number} deltaTime - Time elapsed since last frame in ms
   */
  updateDamageNumbers(deltaTime) {
    const dt = deltaTime / 1000;
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dmg = this.damageNumbers[i];
      dmg.age += dt;
      dmg.offsetY -= 50 * dt; // Float upward slightly faster than score popups
      dmg.alpha = Math.max(0, 1 - dmg.age / 0.8); // Fade out over 0.8 seconds
      
      // Remove damage numbers that have fully faded
      if (dmg.alpha <= 0 || dmg.age > 0.8) {
        this.damageNumbers.splice(i, 1);
      }
    }
  }

  /**
   * Update expanding waves from seventh grapheme (index 6).
   * Waves expand outward and damage enemies they touch.
   */
  updateExpandingWaves(deltaTime) {
    const enemiesToRemove = new Set();
    const bossesToRemove = new Set();
    
    // Update each wave
    for (let i = this.expandingWaves.length - 1; i >= 0; i--) {
      const wave = this.expandingWaves[i];
      wave.update(deltaTime);
      
      // Check collisions with enemies
      for (let ei = 0; ei < this.enemies.length; ei++) {
        if (wave.hitEnemies.has(ei)) continue; // Already hit this enemy
        if (enemiesToRemove.has(ei)) continue; // Already killed
        
        const enemy = this.enemies[ei];
        const dx = wave.x - enemy.x;
        const dy = wave.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Check if enemy is touching the wave ring
        // Ring thickness includes enemy size for better collision detection
        const enemySize = enemy.size || WAVE_CONFIG.DEFAULT_ENEMY_SIZE;
        const ringThickness = WAVE_CONFIG.RING_BASE_THICKNESS + enemySize;
        const distFromRing = Math.abs(dist - wave.currentRadius);
        
        if (distFromRing < ringThickness && dist < wave.maxRadius) {
          // Enemy is touching the wave - apply damage
          wave.hitEnemies.add(ei);
          this.spawnDamageNumber(enemy.x, enemy.y, wave.damage);
          const killed = enemy.takeDamage(wave.damage);
          
          if (killed) {
            enemiesToRemove.add(ei);
            this.addScore(enemy.scoreValue);
            this.spawnScorePopup(enemy.x, enemy.y, enemy.scoreValue);
          }
        }
      }
      
      // Check collisions with bosses
      for (let bi = 0; bi < this.bosses.length; bi++) {
        if (wave.hitBosses.has(bi)) continue; // Already hit this boss
        if (bossesToRemove.has(bi)) continue; // Already killed
        
        const boss = this.bosses[bi];
        const dx = wave.x - boss.x;
        const dy = wave.y - boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Check if boss is touching the wave ring
        // Ring thickness includes boss size for better collision detection
        const bossSize = boss.size || WAVE_CONFIG.DEFAULT_BOSS_SIZE;
        const ringThickness = WAVE_CONFIG.RING_BASE_THICKNESS + bossSize;
        const distFromRing = Math.abs(dist - wave.currentRadius);
        
        if (distFromRing < ringThickness && dist < wave.maxRadius) {
          // Boss is touching the wave - apply damage
          wave.hitBosses.add(bi);
          this.spawnDamageNumber(boss.x, boss.y, wave.damage);
          const killed = boss.takeDamage(wave.damage);
          
          if (killed) {
            bossesToRemove.add(bi);
            this.addScore(boss.scoreValue);
            this.spawnScorePopup(boss.x, boss.y, boss.scoreValue);
          }
        }
      }
      
      // Remove finished waves
      if (wave.finished) {
        this.expandingWaves.splice(i, 1);
      }
    }
    
    // Remove killed enemies (highest index first to avoid shifting issues)
    const enemyIndices = Array.from(enemiesToRemove).sort((a, b) => b - a);
    for (const i of enemyIndices) {
      this.enemies.splice(i, 1);
    }
    
    // Remove killed bosses (highest index first to avoid shifting issues)
    const bossIndices = Array.from(bossesToRemove).sort((a, b) => b - a);
    for (const i of bossIndices) {
      this.bosses.splice(i, 1);
    }
  }

  /**
   * Update all mines and check for collisions with enemies.
   * Mines explode on contact with enemies, creating expanding damage waves.
   */
  updateMines(deltaTime) {
    if (!this.canvas) return;
    
    const minesToRemove = [];
    const enemiesToRemove = new Set();
    const bossesToRemove = new Set();
    
    // Update each mine
    for (let i = 0; i < this.mines.length; i++) {
      const mine = this.mines[i];
      mine.update(deltaTime);
      
      // Remove expired or offscreen mines
      if (mine.isExpired() || mine.isOffscreen(this.canvas.width, this.canvas.height)) {
        minesToRemove.push(i);
        continue;
      }
      
      // Check collision with enemies
      for (let ei = 0; ei < this.enemies.length; ei++) {
        if (enemiesToRemove.has(ei)) continue;
        
        const enemy = this.enemies[ei];
        const dx = mine.x - enemy.x;
        const dy = mine.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const collisionDist = mine.size + enemy.size;
        
        if (dist < collisionDist) {
          // Mine hit enemy - explode!
          mine.exploded = true;
          
          // Create expanding wave at explosion point
          const explosionWave = new ExpandingWave(
            mine.x,
            mine.y,
            mine.baseDamage,
            mine.explosionRadius,
            mine.color
          );
          this.expandingWaves.push(explosionWave);
          
          // Remove the mine
          minesToRemove.push(i);
          break;
        }
      }
      
      // If mine already marked for removal, skip boss check
      if (minesToRemove.includes(i)) continue;
      
      // Check collision with bosses
      for (let bi = 0; bi < this.bosses.length; bi++) {
        if (bossesToRemove.has(bi)) continue;
        
        const boss = this.bosses[bi];
        const dx = mine.x - boss.x;
        const dy = mine.y - boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const collisionDist = mine.size + boss.size;
        
        if (dist < collisionDist) {
          // Mine hit boss - explode!
          mine.exploded = true;
          
          // Create expanding wave at explosion point
          const explosionWave = new ExpandingWave(
            mine.x,
            mine.y,
            mine.baseDamage,
            mine.explosionRadius,
            mine.color
          );
          this.expandingWaves.push(explosionWave);
          
          // Remove the mine
          minesToRemove.push(i);
          break;
        }
      }
    }
    
    // Remove mines that exploded, expired, or went offscreen (highest index first)
    const sortedMineIndices = minesToRemove.sort((a, b) => b - a);
    for (const i of sortedMineIndices) {
      this.mines.splice(i, 1);
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
   * Render all floating damage numbers.
   */
  renderDamageNumbers() {
    if (!this.ctx) return;
    
    const ctx = this.ctx;
    ctx.save();
    ctx.font = 'bold 12px "Cormorant Garamond", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (const dmg of this.damageNumbers) {
      ctx.globalAlpha = dmg.alpha;
      // Use red color for damage
      ctx.fillStyle = this.nightMode ? '#ff6666' : '#ff3333';
      // Format damage: show integers without decimals, floats with one decimal place
      const damageText = dmg.damage % 1 === 0 ? dmg.damage.toString() : dmg.damage.toFixed(1);
      ctx.fillText(damageText, dmg.x + dmg.xOffset, dmg.y + dmg.offsetY);
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
        // Draw aim target symbol if set
        this.renderAimTarget();
        // Draw weapon targets for eighth grapheme (Theta)
        this.renderWeaponTargets();
        // Draw friendly ships
        this.renderFriendlyShips();
        // Draw swarm ships and lasers
        this.renderSwarmShips();
        this.renderSwarmLasers();
        // Draw enemies
        this.renderEnemies();
        // Draw bosses
        this.renderBosses();
        // Draw bullets
        this.renderBullets();
        // Draw beams
        this.renderBeams();
        // Draw expanding waves
        this.renderExpandingWaves();
        // Draw mines
        this.renderMines();
        // Draw floating damage numbers
        this.renderDamageNumbers();
        // Draw floating score popups
        this.renderScorePopups();
        break;
    }

    // Draw UI overlays
    this.renderUI();
    
    // Allow external code to render on top (e.g., phoneme drops)
    if (this.onPostRender) {
      this.onPostRender(this.ctx, this.canvas, this.gamePhase);
    }
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
      this.renderBeams();
      this.renderMines();
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

    // Render the warden's name in script font below
    this.renderWardenName();
  }

  /**
   * Render the aim target symbol where the player has clicked/tapped.
   * This shows a crosshair-like symbol indicating where aimable weapons will fire.
   */
  renderAimTarget() {
    if (!this.aimTarget || !this.ctx) return;

    const ctx = this.ctx;
    const { x, y } = this.aimTarget;
    
    // Use golden color to match the warden aesthetic
    const targetColor = this.nightMode ? '#ffe9a3' : '#d4af37';
    const outerRadius = 16;
    const innerRadius = 6;
    const crossSize = 24;
    
    ctx.save();
    
    // Set line style
    ctx.strokeStyle = targetColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.85;
    
    // Draw outer circle
    ctx.beginPath();
    ctx.arc(x, y, outerRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw inner circle
    ctx.beginPath();
    ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw crosshair lines (extending beyond outer circle)
    ctx.beginPath();
    // Horizontal line
    ctx.moveTo(x - crossSize, y);
    ctx.lineTo(x - outerRadius - 4, y);
    ctx.moveTo(x + outerRadius + 4, y);
    ctx.lineTo(x + crossSize, y);
    // Vertical line
    ctx.moveTo(x, y - crossSize);
    ctx.lineTo(x, y - outerRadius - 4);
    ctx.moveTo(x, y + outerRadius + 4);
    ctx.lineTo(x, y + crossSize);
    ctx.stroke();
    
    // Draw center dot
    ctx.fillStyle = targetColor;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  /**
   * Render target indicators for enemies targeted by the eighth grapheme (Theta).
   * Draws a smaller target reticle colored with the weapon's color over targeted enemies.
   */
  renderWeaponTargets() {
    if (!this.ctx) return;
    
    const ctx = this.ctx;
    
    // Iterate through each weapon and render its target if present
    for (const weaponId of Object.keys(this.weaponTargets)) {
      const target = this.weaponTargets[weaponId];
      if (!target) continue;
      
      // Get weapon color
      const weaponDef = WEAPON_SLOT_DEFINITIONS[weaponId];
      if (!weaponDef) continue;
      
      const targetColor = this.resolveBulletColor(weaponDef.color);
      const { x, y } = target;
      
      // Smaller circles than player aim target
      const outerRadius = 10;
      const innerRadius = 4;
      const crossSize = 14;
      
      ctx.save();
      
      // Set line style with weapon color
      ctx.strokeStyle = targetColor;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.75;
      
      // Draw outer circle
      ctx.beginPath();
      ctx.arc(x, y, outerRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw inner circle
      ctx.beginPath();
      ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw crosshair lines (extending beyond outer circle)
      ctx.beginPath();
      // Horizontal line
      ctx.moveTo(x - crossSize, y);
      ctx.lineTo(x - outerRadius - 2, y);
      ctx.moveTo(x + outerRadius + 2, y);
      ctx.lineTo(x + crossSize, y);
      // Vertical line
      ctx.moveTo(x, y - crossSize);
      ctx.lineTo(x, y - outerRadius - 2);
      ctx.moveTo(x, y + outerRadius + 2);
      ctx.lineTo(x, y + crossSize);
      ctx.stroke();
      
      // Draw center dot
      ctx.fillStyle = targetColor;
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }
  }

  /**
   * Render all friendly ships.
   */
  renderFriendlyShips() {
    if (!this.ctx) return;
    
    const ctx = this.ctx;
    
    for (const ship of this.friendlyShips) {
      // Render thin, colorful trail matching the weapon color
      if (ship.trail.length > 1) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Parse ship color to RGB for alpha blending
        const hexColor = ship.color;
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);
        
        // Draw trail as connected line segments with fading alpha
        for (let i = 0; i < ship.trail.length - 1; i++) {
          const start = ship.trail[i];
          const end = ship.trail[i + 1];
          const alpha = ((i + 1) / ship.trail.length) * 0.7;
          const lineWidth = 2.0 * alpha; // Thin trails
          
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        }
        ctx.restore();
      }
      
      // Render ship body
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.headingAngle - Math.PI / 2);
      
      // Draw ship as a triangle (friendly version)
      ctx.beginPath();
      ctx.moveTo(0, ship.size);
      ctx.lineTo(-ship.size * 0.6, -ship.size * 0.4);
      ctx.lineTo(ship.size * 0.6, -ship.size * 0.4);
      ctx.closePath();
      
      // Use weapon color with golden tint
      ctx.fillStyle = this.nightMode ? lightenHexColor(ship.color, 0.3) : ship.color;
      ctx.fill();
      
      // Add a subtle outline to distinguish from enemies
      ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(212, 175, 55, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Draw a small golden core/gem in the center
      ctx.fillStyle = this.nightMode ? '#ffe9a3' : '#d4af37';
      ctx.beginPath();
      ctx.arc(0, 0, ship.size * 0.25, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }
  }

  /**
   * Render all enemies.
   */
  renderEnemies() {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const maxTrailPoints = this.getEnemyTrailMaxLength();
    const maxSmokePuffs = this.getEnemySmokeMaxCount();
    const quality = this.getEnemyTrailQuality();

    for (const enemy of this.enemies) {
      // Render a small inky trail behind the ship's path (quality-based rendering).
      if (maxTrailPoints > 0 && enemy.trail && enemy.trail.length > 0) {
        ctx.save();
        const radiusScale = enemy.trailRadiusScale || 0.35;
        const alphaScale = enemy.trailAlphaScale || 0.8;
        const startIdx = Math.max(0, enemy.trail.length - maxTrailPoints);
        const visibleTrail = enemy.trail.slice(startIdx);
        
        if (quality === 'low') {
          // Low quality: Simple solid circles
          ctx.fillStyle = this.enemyTrailColor;
          for (let i = 0; i < visibleTrail.length - 1; i++) {
            const point = visibleTrail[i];
            const alpha = (i + 1) / visibleTrail.length;
            ctx.globalAlpha = alpha * alphaScale;
            ctx.beginPath();
            ctx.arc(point.x, point.y, Math.max(1.25, enemy.size * radiusScale * alpha), 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (quality === 'medium') {
          // Medium quality: Circles with slight taper
          ctx.fillStyle = this.enemyTrailColor;
          for (let i = 0; i < visibleTrail.length - 1; i++) {
            const point = visibleTrail[i];
            const progress = (i + 1) / visibleTrail.length;
            const alpha = progress * alphaScale;
            // Taper the radius slightly toward the tail
            const taperFactor = 0.4 + 0.6 * progress;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(point.x, point.y, Math.max(0.5, enemy.size * radiusScale * taperFactor), 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // High quality: Diminish to a point with gradient matching color palette
          for (let i = 0; i < visibleTrail.length - 1; i++) {
            const point = visibleTrail[i];
            const progress = (i + 1) / visibleTrail.length;
            
            // Sample gradient from palette based on progress along the trail
            const gradientSample = samplePaletteGradient(progress);
            const gradientColor = `rgb(${gradientSample.r}, ${gradientSample.g}, ${gradientSample.b})`;
            
            // Diminish radius to near-zero at the tail
            const taperFactor = progress * progress; // Quadratic taper for smooth diminish
            const radius = Math.max(0.25, enemy.size * radiusScale * taperFactor);
            const alpha = progress * alphaScale;
            
            ctx.globalAlpha = alpha;
            ctx.fillStyle = gradientColor;
            ctx.beginPath();
            ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // Render smoke puffs from the stored world-space positions (respects trail length setting).
      if (maxSmokePuffs > 0) {
        ctx.save();
        ctx.fillStyle = this.enemySmokeColor;
        // Only render up to maxSmokePuffs from the end of the smokePuffs array
        const startIdx = Math.max(0, enemy.smokePuffs.length - maxSmokePuffs);
        const visiblePuffs = enemy.smokePuffs.slice(startIdx);
        for (const puff of visiblePuffs) {
          ctx.globalAlpha = puff.alpha * (this.nightMode ? 1.15 : 1);
          ctx.beginPath();
          ctx.arc(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

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
      
      // Render burn particles if burning
      if (enemy.burning && enemy.burnParticles.length > 0) {
        ctx.save();
        for (const particle of enemy.burnParticles) {
          const alpha = particle.life / particle.maxLife;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = ELEMENTAL_CONFIG.BURN_PARTICLE_COLOR;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  /**
   * Render all boss ships with distinctive visuals.
   */
  renderBosses() {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const maxTrailPoints = this.getEnemyTrailMaxLength();
    const quality = this.getEnemyTrailQuality();

    for (const boss of this.bosses) {
      // Render trail (quality-based rendering)
      if (maxTrailPoints > 0 && boss.trail && boss.trail.length > 0) {
        ctx.save();
        const startIdx = Math.max(0, boss.trail.length - maxTrailPoints);
        const visibleTrail = boss.trail.slice(startIdx);
        
        if (quality === 'low') {
          // Low quality: Simple solid circles
          ctx.fillStyle = this.enemyTrailColor;
          for (let i = 0; i < visibleTrail.length - 1; i++) {
            const point = visibleTrail[i];
            const alpha = (i + 1) / visibleTrail.length;
            ctx.globalAlpha = alpha * 0.6;
            ctx.beginPath();
            ctx.arc(point.x, point.y, Math.max(2, boss.size * 0.15 * alpha), 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (quality === 'medium') {
          // Medium quality: Circles with slight taper
          ctx.fillStyle = this.enemyTrailColor;
          for (let i = 0; i < visibleTrail.length - 1; i++) {
            const point = visibleTrail[i];
            const progress = (i + 1) / visibleTrail.length;
            const alpha = progress * 0.6;
            const taperFactor = 0.4 + 0.6 * progress;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(point.x, point.y, Math.max(1, boss.size * 0.15 * taperFactor), 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // High quality: Diminish to a point with gradient matching color palette
          for (let i = 0; i < visibleTrail.length - 1; i++) {
            const point = visibleTrail[i];
            const progress = (i + 1) / visibleTrail.length;
            
            // Sample gradient from palette based on progress along the trail
            const gradientSample = samplePaletteGradient(progress);
            const gradientColor = `rgb(${gradientSample.r}, ${gradientSample.g}, ${gradientSample.b})`;
            
            // Diminish radius to near-zero at the tail
            const taperFactor = progress * progress; // Quadratic taper for smooth diminish
            const radius = Math.max(0.5, boss.size * 0.15 * taperFactor);
            const alpha = progress * 0.6;
            
            ctx.globalAlpha = alpha;
            ctx.fillStyle = gradientColor;
            ctx.beginPath();
            ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

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
        case 'megaBoss':
          this.renderMegaBoss(ctx, boss);
          break;
        case 'ultraBoss':
          this.renderUltraBoss(ctx, boss);
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
      
      // Render burn particles if burning
      if (boss.burning && boss.burnParticles.length > 0) {
        ctx.save();
        for (const particle of boss.burnParticles) {
          const alpha = particle.life / particle.maxLife;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = ELEMENTAL_CONFIG.BURN_PARTICLE_COLOR;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
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
   * Render Mega Boss - enhanced hexagon with larger size.
   */
  renderMegaBoss(ctx, boss) {
    // Render similar to hexagon fortress but with distinctive visual
    const fillColor = this.nightMode ? '#ffffff' : boss.color;
    const strokeColor = this.nightMode ? 'rgba(255, 215, 0, 0.9)' : 'rgba(212, 175, 55, 0.8)'; // Golden outline

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
    ctx.lineWidth = 4; // Thicker outline
    ctx.stroke();

    // Additional layer for mega boss
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * boss.size * 0.7;
      const y = Math.sin(angle) * boss.size * 0.7;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render Ultra Boss - largest and most powerful boss with distinctive visual.
   */
  renderUltraBoss(ctx, boss) {
    // Render similar to hexagon fortress but with distinctive visual
    const fillColor = this.nightMode ? '#ffffff' : boss.color;
    const strokeColor = this.nightMode ? 'rgba(255, 100, 100, 0.9)' : 'rgba(220, 20, 60, 0.8)'; // Crimson outline

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
    ctx.lineWidth = 5; // Very thick outline
    ctx.stroke();

    // Additional layers for ultra boss
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * boss.size * 0.8;
      const y = Math.sin(angle) * boss.size * 0.8;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Inner layer
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * boss.size * 0.5;
      const y = Math.sin(angle) * boss.size * 0.5;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render all bullets.
   */
  renderBullets() {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const maxTrailPoints = this.getBulletTrailMaxLength();

    for (const bullet of this.bullets) {
      const trail = bullet.trail || [];
      // Render bullet trail (respects trail length setting)
      if (maxTrailPoints > 0 && trail.length > 1) {
        ctx.save();
        ctx.lineCap = 'round';
        // Only render up to maxTrailPoints from the end of the trail
        const startIdx = Math.max(0, trail.length - maxTrailPoints);
        const visibleTrail = trail.slice(startIdx);
        for (let i = visibleTrail.length - 1; i > 0; i--) {
          const start = visibleTrail[i];
          const end = visibleTrail[i - 1];
          const alpha = i / visibleTrail.length;
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

      // Get bullet level (default to 1 for backwards compatibility)
      const bulletLevel = bullet.level || 1;
      
      // ThoughtSpeak shape override - use if present
      const effectiveShape = bullet.thoughtSpeakShape !== null ? bullet.thoughtSpeakShape : bulletLevel;
      const hasShape = effectiveShape >= 3;
      // Resolve the bullet heading once for sprite alignment and flare direction.
      const heading = bullet.baseAngle !== undefined ? bullet.baseAngle : bullet.angle || -Math.PI / 2;

      // Render the Shin bullet sprite artwork when available.
      if (this.bulletSprites[effectiveShape] && this.bulletSpriteLoaded[effectiveShape]) {
        // Scale the sprite to match the bullet's size and rotate into travel direction.
        ctx.save();
        ctx.translate(bullet.x, bullet.y);
        ctx.rotate(heading + Math.PI / 2);
        ctx.globalAlpha = 0.9;
        const spriteSize = bullet.size * 3.1;
        ctx.drawImage(
          this.bulletSprites[effectiveShape],
          -spriteSize / 2,
          -spriteSize / 2,
          spriteSize,
          spriteSize
        );
        ctx.restore();
      }

      // Directional flare to emphasize travel direction (only shown on level 2+ or when shape is present)
      if (bulletLevel >= 2 || hasShape) {
        const flareLength = bullet.size * 3.5;
        ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.55)';
        ctx.lineWidth = Math.max(1.2, bullet.size * 0.45);
        ctx.beginPath();
        ctx.moveTo(bullet.x - Math.cos(heading) * bullet.size * 0.6, bullet.y - Math.sin(heading) * bullet.size * 0.6);
        ctx.lineTo(bullet.x + Math.cos(heading) * flareLength, bullet.y + Math.sin(heading) * flareLength);
        ctx.stroke();
      }

      // Thin rim for a crisp silhouette (only if no shape)
      if (!hasShape) {
        ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.65)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, Math.max(1, bullet.size * 0.9), 0, Math.PI * 2);
        ctx.stroke();
      }

      // Rotating geometric shapes for level 3+ or ThoughtSpeak shapes (capped at level 12)
      // Level/Shape 3 = triangle (3 sides), 4 = square (4 sides), 5 = pentagon, etc.
      if (hasShape) {
        const sides = Math.min(effectiveShape, 12); // Cap at 12 sides
        const shapeRadius = bullet.size * 2.2;
        const rotation = bullet.shapeRotation || 0;
        
        ctx.save();
        ctx.translate(bullet.x, bullet.y);
        ctx.rotate(rotation);
        
        // Draw thin polygon outline (no fill)
        ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        for (let i = 0; i < sides; i++) {
          const angle = (i / sides) * Math.PI * 2 - Math.PI / 2; // Start at top
          const px = Math.cos(angle) * shapeRadius;
          const py = Math.sin(angle) * shapeRadius;
          if (i === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.closePath();
        ctx.stroke();
        
        ctx.restore();
      }

      ctx.restore();
    }
  }

  /**
   * Render all beams from grapheme L (index 11).
   */
  renderBeams() {
    if (!this.ctx || !this.beams || this.beams.length === 0) return;
    
    for (const beam of this.beams) {
      beam.render(this.ctx);
    }
  }

  /**
   * Render all expanding waves from the seventh grapheme (index 6).
   */
  renderExpandingWaves() {
    if (!this.ctx) return;
    
    for (const wave of this.expandingWaves) {
      wave.render(this.ctx);
    }
  }

  /**
   * Render all drifting mines from grapheme M (index 12).
   */
  renderMines() {
    if (!this.ctx || !this.mines || this.mines.length === 0) return;
    
    for (const mine of this.mines) {
      mine.render(this.ctx);
    }
  }
  
  /**
   * Render all swarm ships from grapheme N (index 13).
   */
  renderSwarmShips() {
    if (!this.ctx || !this.swarmShips || this.swarmShips.length === 0) return;
    
    for (const ship of this.swarmShips) {
      ship.render(this.ctx);
    }
  }
  
  /**
   * Render all swarm lasers from grapheme N (index 13).
   */
  renderSwarmLasers() {
    if (!this.ctx || !this.swarmLasers || this.swarmLasers.length === 0) return;
    
    for (const laser of this.swarmLasers) {
      laser.render(this.ctx);
    }
  }

  /**
   * Initialize or reset life lines to their default state.
   * @private
   */
  initializeLifeLines() {
    this.lifeLines = [];
    for (let i = 0; i < LIFE_LINES_CONFIG.COUNT; i++) {
      this.lifeLines.push({ state: LIFE_LINES_CONFIG.INITIAL_STATE });
    }
  }

  /**
   * Update life line states when ships pass through.
   * Each line represents 2 lives: solid → dashed → gone.
   * @param {number} count - Number of lives to consume (default: 1)
   */
  updateLifeLine(count = 1) {
    for (let life = 0; life < count; life++) {
      // Find the first line that isn't gone and update its state
      for (let i = 0; i < this.lifeLines.length; i++) {
        if (this.lifeLines[i].state === 'solid') {
          this.lifeLines[i].state = 'dashed';
          break;
        } else if (this.lifeLines[i].state === 'dashed') {
          this.lifeLines[i].state = 'gone';
          break;
        }
      }
    }
  }

  /**
   * Render UI elements.
   */
  renderUI() {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const padding = UI_CONFIG.PADDING;

    // Set font for UI - using Cormorant Garamond (universal game font)
    ctx.font = `${UI_CONFIG.FONT_SIZE}px ${UI_CONFIG.FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Golden color for text
    const goldColor = VISUAL_CONFIG.DEFAULT_GOLDEN;

    // Wave number display (top left)
    ctx.fillStyle = goldColor;
    ctx.fillText(`Wave: ${this.wave + 1}`, padding, padding);
    
    // Player score display under wave number (top left)
    ctx.fillText(`Score: ${this.score}`, padding, padding + 20);

    // Speed button (top right)
    const speedButtonSize = UI_CONFIG.SPEED_BUTTON_SIZE;
    const speedButtonX = this.canvas.width - padding - speedButtonSize;
    const speedButtonY = padding;
    
    // Draw button background
    ctx.fillStyle = this.speedButtonHover ? 'rgba(212, 175, 55, 0.3)' : 'rgba(212, 175, 55, 0.2)';
    ctx.fillRect(speedButtonX, speedButtonY, speedButtonSize, speedButtonSize);
    
    // Draw button border
    ctx.strokeStyle = goldColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(speedButtonX, speedButtonY, speedButtonSize, speedButtonSize);
    
    // Draw speed text
    ctx.fillStyle = goldColor;
    ctx.font = `${UI_CONFIG.LARGE_FONT_SIZE}px ${UI_CONFIG.FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.gameSpeed}x`, speedButtonX + speedButtonSize / 2, speedButtonY + speedButtonSize / 2);

    // Health bar (bottom center)
    if (this.warden) {
      const barWidth = UI_CONFIG.HEALTH_BAR_WIDTH;
      const barHeight = UI_CONFIG.HEALTH_BAR_HEIGHT;
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

    // Life lines indicator (bottom left)
    // Lines stacked on top of each other, each representing 2 lives
    const horizontalPadding = padding;
    const lineWidth = this.canvas.width - (horizontalPadding * 2);
    const lineHeight = UI_CONFIG.LIFE_LINE_HEIGHT;
    const lineGap = UI_CONFIG.LIFE_LINE_GAP;
    const startX = horizontalPadding;
    const startY = this.canvas.height - padding - (lineHeight + lineGap) * this.lifeLines.length;
    
    for (let i = 0; i < this.lifeLines.length; i++) {
      const line = this.lifeLines[i];
      const y = startY + i * (lineHeight + lineGap);
      
      if (line.state === 'gone') {
        continue; // Don't draw gone lines
      }
      
      ctx.strokeStyle = this.uiTextColor;
      ctx.lineWidth = lineHeight;
      ctx.lineCap = 'butt';
      
      if (line.state === 'solid') {
        // Draw solid line
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(startX + lineWidth, y);
        ctx.stroke();
      } else if (line.state === 'dashed') {
        // Draw dashed line
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(startX + lineWidth, y);
        ctx.stroke();
        ctx.setLineDash([]); // Reset to solid
      }
    }
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
   * Get all available weapon slots with their state.
   * All 3 slots are always active and cannot be purchased/upgraded individually.
   * Later, lexemes can be placed into these slots to modify behavior.
   */
  getAvailableWeapons() {
    const weapons = [];
    for (const weaponId of Object.keys(WEAPON_SLOT_DEFINITIONS)) {
      const def = WEAPON_SLOT_DEFINITIONS[weaponId];
      const isPurchased = true; // All slots are always active
      const level = this.weapons.levels[weaponId] || 1;
      const isEquipped = true; // All slots are always equipped
      const glowIntensity = this.weaponGlowState?.[weaponId] || 0;
      const cooldownProgress = this.weaponTimers?.[weaponId] || 0;
      const cooldownTotal = def.baseFireRate;
      
      weapons.push({
        id: weaponId,
        name: def.name,
        symbol: def.symbol,
        description: def.description,
        color: def.color,
        cost: 0, // No cost - always available
        isPurchased,
        level,
        maxLevel: 1, // No upgrades yet (lexemes will handle this later)
        canUpgrade: false,
        upgradeCost: null,
        isEquipped,
        canEquip: false,
        canUnequip: false,
        glowIntensity, // 0-1 value for UI glow effect
        cooldownProgress, // Current cooldown timer value (ms)
        cooldownTotal, // Total cooldown duration (ms)
        slotIndex: def.slotIndex,
      });
    }
    return weapons.sort((a, b) => a.slotIndex - b.slotIndex);
  }

  /**
   * Purchase a weapon using score points.
   * @deprecated All 3 weapon slots are always active - no purchase needed
   * @returns {boolean} Always returns false
   */
  purchaseWeapon(weaponId) {
    // All weapon slots are always active - no purchase needed
    return false;
  }

  /**
   * Purchase a weapon without deducting score.
   * @deprecated All 3 weapon slots are always active - no purchase needed
   * @returns {boolean} Always returns false
   */
  purchaseWeaponWithoutCost(weaponId) {
    // All weapon slots are always active - no purchase needed
    return false;
  }

  /**
   * Upgrade a purchased weapon.
   * @deprecated Weapon upgrades will be handled by lexemes in the future
   * @returns {boolean} Always returns false
   */
  upgradeWeapon(weaponId) {
    // Weapon upgrades will be handled by lexemes in the future
    return false;
  }

  /**
   * Upgrade a purchased weapon without deducting score.
   * @deprecated Weapon upgrades will be handled by lexemes in the future
   * @returns {boolean} Always returns false
   */
  upgradeWeaponWithoutCost(weaponId) {
    // Weapon upgrades will be handled by lexemes in the future
    return false;
  }

  /**
   * Apply weapon-specific upgrades (attack and speed levels).
   * @param {string} weaponId - The weapon ID (slot1, slot2, slot3)
   * @param {number} attackLevel - Attack upgrade level
   * @param {number} speedLevel - Speed upgrade level
   */
  applyWeaponUpgrades(weaponId, attackLevel, speedLevel) {
    if (!this.weaponUpgrades[weaponId]) {
      this.weaponUpgrades[weaponId] = { attackLevel: 0, speedLevel: 0 };
    }
    this.weaponUpgrades[weaponId].attackLevel = attackLevel;
    this.weaponUpgrades[weaponId].speedLevel = speedLevel;
  }

  /**
   * Get weapon-specific attack multiplier based on upgrade level.
   * @param {string} weaponId - The weapon ID
   * @returns {number} Attack multiplier (1.0 = no upgrades, increases with level)
   */
  getWeaponAttackMultiplier(weaponId) {
    const attackLevel = this.weaponUpgrades[weaponId]?.attackLevel || 0;
    // Each level adds 10% damage
    return 1 + (attackLevel * 0.1);
  }

  /**
   * Get weapon-specific speed multiplier based on upgrade level.
   * @param {string} weaponId - The weapon ID
   * @returns {number} Speed multiplier (1.0 = no upgrades, increases with level)
   */
  getWeaponSpeedMultiplier(weaponId) {
    const speedLevel = this.weaponUpgrades[weaponId]?.speedLevel || 0;
    // Each level adds 10% fire rate
    return 1 + (speedLevel * 0.1);
  }

  /**
   * Equip a weapon slot.
   * @deprecated All 3 weapon slots are always equipped
   * @returns {boolean} Always returns false
   */
  equipWeapon(weaponId) {
    // All 3 weapon slots are always equipped
    return false;
  }

  /**
   * Unequip a weapon slot.
   * @deprecated All 3 weapon slots are always equipped
   * @returns {boolean} Always returns false
   */
  unequipWeapon(weaponId) {
    // All 3 weapon slots are always equipped
    return false;
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
    
    // Ensure all 3 weapon slots are always marked as purchased (they are always active)
    for (const weaponId of WEAPON_SLOT_IDS) {
      this.weapons.purchased[weaponId] = true;
    }
    
    if (state?.levels) {
      this.weapons.levels = { ...this.weapons.levels, ...state.levels };
    }
    if (state?.activeWeaponId) {
      this.weapons.activeWeaponId = state.activeWeaponId;
    }
    
    // All 3 weapons must always be equipped (no conditional logic needed)
    this.weapons.equipped = [...WEAPON_SLOT_IDS];
    
    // Initialize timers for all weapons (all weapons are always purchased)
    for (const weaponId of WEAPON_SLOT_IDS) {
      if (!this.weaponTimers[weaponId]) {
        this.weaponTimers[weaponId] = 0;
      }
      if (this.weaponPhases[weaponId] === undefined) {
        this.weaponPhases[weaponId] = 0; // Ensure phase accumulator exists after loading state.
      }
    }
  }

  /**
   * Set weapon grapheme assignments for dynamic script rendering.
   * @param {Object} assignments - Object mapping weapon IDs to arrays of grapheme assignments
   */
  setWeaponGraphemeAssignments(assignments) {
    if (!assignments || typeof assignments !== 'object') return;
    
    // Update assignments for each weapon slot
    for (const weaponId of WEAPON_SLOT_IDS) {
      if (assignments[weaponId]) {
        this.weaponGraphemeAssignments[weaponId] = assignments[weaponId];
      }
    }
  }

  /**
   * Get current weapon grapheme assignments.
   * @returns {Object} Object mapping weapon IDs to arrays of grapheme assignments
   */
  getWeaponGraphemeAssignments() {
    return {
      slot1: [...(this.weaponGraphemeAssignments.slot1 || [])],
      slot2: [...(this.weaponGraphemeAssignments.slot2 || [])],
      slot3: [...(this.weaponGraphemeAssignments.slot3 || [])],
    };
  }

  /**
   * Set grapheme inventory counts for calculating excess grapheme bonus.
   * @param {Object} counts - Map of grapheme index to count
   */
  setGraphemeInventoryCounts(counts) {
    if (!counts || typeof counts !== 'object') {
      this.graphemeInventoryCounts = {};
      return;
    }
    this.graphemeInventoryCounts = { ...counts };
  }
}
