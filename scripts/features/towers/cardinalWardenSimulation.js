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
 * Graphemes are named A-Z (English letters), indices 0-25, with dagesh variants beyond.
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

import {
  GRAPHEME_INDEX,
  WAVE_CONFIG,
  SPREAD_CONFIG,
  MASSIVE_BULLET_CONFIG,
  BEAM_CONFIG,
  MINE_CONFIG,
  SWARM_CONFIG,
  RICOCHET_CONFIG,
  HOMING_CONFIG,
  SPLIT_CONFIG,
  CHAIN_CONFIG,
  SIZE_CONFIG,
  DAGESH_CONFIG,
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
  ENEMY_SHIP_SPRITES,
  VISUAL_CONFIG,
  RING_SQUARE_CONFIGS,
  INNER_RING_CONFIGS,
  ORBITAL_SQUARE_CONFIG,
} from './cardinalWardenConfig.js';
import {
  ExpandingWave,
  createWaveFromBulletImpact,
  updateExpandingWaves as updateWaveSystem,
} from './cardinalWarden/WaveSystem.js';
import {
  Beam,
  checkBeamCollisions as checkBeamCollisionsSystem,
} from './cardinalWarden/BeamSystem.js';
import {
  Mine,
  updateMines as updateMinesSystem,
} from './cardinalWarden/MineSystem.js';
import {
  SwarmShip,
  SwarmLaser,
  checkSwarmLaserCollisions as checkSwarmLaserCollisionsSystem,
} from './cardinalWarden/SwarmSystem.js';
import {
  EnemyShip,
  RicochetSkimmer,
  CircleCarrierBoss,
  PyramidBoss,
  HexagonFortressBoss,
  MegaBoss,
  UltraBoss,
} from './cardinalWarden/EnemySystem.js';
import {
  renderScriptChar as renderCwScriptChar,
  renderWardenName as renderCwWardenName,
  renderScorePopups as renderCwScorePopups,
  renderDamageNumbers as renderCwDamageNumbers,
  render as renderCwRender,
  renderDeathAnimation as renderCwDeathAnimation,
  renderRespawnAnimation as renderCwRespawnAnimation,
  renderWarden as renderCwWarden,
  renderAimTarget as renderCwAimTarget,
  renderWeaponTargets as renderCwWeaponTargets,
  renderFriendlyShips as renderCwFriendlyShips,
  renderEnemies as renderCwEnemies,
  renderBosses as renderCwBosses,
  renderCircleCarrierBoss as renderCwCircleCarrierBoss,
  renderPyramidBoss as renderCwPyramidBoss,
  renderHexagonFortressBoss as renderCwHexagonFortressBoss,
  renderMegaBoss as renderCwMegaBoss,
  renderUltraBoss as renderCwUltraBoss,
  renderBullets as renderCwBullets,
  renderBeams as renderCwBeams,
  renderExpandingWaves as renderCwExpandingWaves,
  renderMines as renderCwMines,
  renderSwarmShips as renderCwSwarmShips,
  renderSwarmLasers as renderCwSwarmLasers,
  initializeLifeLines as renderCwInitializeLifeLines,
  updateLifeLine as renderCwUpdateLifeLine,
  renderUI as renderCwUI,
} from './cardinalWarden/CardinalWardenRenderer.js';

// Configuration constants now imported from cardinalWardenConfig.js

// Sprite assets for Shin spire bullet projectiles (levels 1-16).
const SHIN_BULLET_SPRITE_URLS = Array.from({ length: 16 }, (_, index) => (
  new URL(`../../../assets/sprites/spires/shinSpire/bullets/bulletLevel${index + 1}.png`, import.meta.url).href
));

// Boss sprite art for Shin Spire milestone waves (10-130) in 10-wave steps.
const SHIN_BOSS_SPRITE_URLS = Array.from({ length: 13 }, (_, index) => (
  new URL(`../../../assets/sprites/spires/shinSpire/bossEnemies/boss_${index + 1}.png`, import.meta.url).href
));

// Boss minion sprites are spawned by carrier-style bosses for visual variety.
const SHIN_BOSS_MINION_SPRITE_URLS = [
  new URL('../../../assets/sprites/spires/shinSpire/bossEnemies/bossMinion_1.png', import.meta.url).href,
  new URL('../../../assets/sprites/spires/shinSpire/bossEnemies/bossMinion_2.png', import.meta.url).href,
];

/**
 * Resolve which Shin boss sprite to render for a wave milestone.
 * Waves 10-130 map to sprite indices 0-12, waves 140-260 reuse those sprites with color inversion,
 * and later waves repeat the base (non-inverted) 13-sprite cycle.
 */
function resolveBossSpriteForWave(waveNumber) {
  const safeWave = Number.isFinite(waveNumber) ? Math.max(1, Math.floor(waveNumber)) : 1;
  const milestoneIndex = Math.max(0, Math.floor((safeWave - 10) / 10));

  if (safeWave >= 10 && safeWave <= 130) {
    return { index: milestoneIndex % SHIN_BOSS_SPRITE_URLS.length, invert: false };
  }

  if (safeWave >= 140 && safeWave <= 260) {
    return { index: milestoneIndex % SHIN_BOSS_SPRITE_URLS.length, invert: true };
  }

  // Repeat base sprites after wave 260 (and for any waves below the first milestone).
  return { index: (milestoneIndex % SHIN_BOSS_SPRITE_URLS.length + SHIN_BOSS_SPRITE_URLS.length) % SHIN_BOSS_SPRITE_URLS.length, invert: false };
}

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
 * Extracted to cardinalWarden/WaveSystem.js (Build 472).
 */

/**
 * Beam class extracted to cardinalWarden/BeamSystem.js (Build 474).
 * Mine class extracted to cardinalWarden/MineSystem.js (Build 474).
 * SwarmShip and SwarmLaser classes extracted to cardinalWarden/SwarmSystem.js (Build 475).
 */

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
 * EnemyShip, RicochetSkimmer, CircleCarrierBoss, PyramidBoss,
 * HexagonFortressBoss, MegaBoss, and UltraBoss classes extracted to
 * cardinalWarden/EnemySystem.js (Build 477).
 */

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

    // Individual grapheme SVG sprites for Cardinal Warden name display
    // Each grapheme (A-Z) has its own white SVG file that gets colored
    this.graphemeSprites = new Map(); // Map from grapheme index to Image
    this.graphemeSpriteLoaded = new Map(); // Map from grapheme index to boolean
    this.tintedGraphemeCache = new Map(); // Map from grapheme index to colored canvas
    this.loadGraphemeSprites();

    // Bullet sprite artwork for Shin spire projectiles.
    this.bulletSprites = [];
    // Track which bullet sprite images have finished loading.
    this.bulletSpriteLoaded = [];
    // Begin preloading bullet sprites so they can be drawn during render.
    this.loadBulletSprites();
    
    // Warden sprite artwork for new visual style
    this.wardenCoreSprite = null;
    this.wardenCoreLoaded = false;
    this.wardenShardSprites = []; // Array of 37 shard sprites
    this.wardenShardsLoaded = []; // Track loading state of each shard
    this.legacyWardenGraphics = false; // Toggle between sprite and canvas rendering
    this.loadWardenSprites();

    // Enemy ship sprite artwork for 6 difficulty levels plus boss minion variants.
    this.enemyShipSprites = [];
    this.enemyShipSpritesLoaded = [];
    this.loadEnemyShipSprites();

    // Boss sprite artwork and inverted variants for milestone boss waves.
    this.bossSprites = [];
    this.bossSpritesLoaded = [];
    this.invertedBossSpriteCache = [];
    this.loadBossSprites();

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

    // Simplified weapon system - slot1 starts purchased, slots 2 and 3 must be purchased
    this.weapons = {
      // Only slot1 is purchased by default, others must be unlocked
      purchased: { slot1: true, slot2: false, slot3: false },
      levels: { slot1: 1, slot2: 1, slot3: 1 }, // Level tracking for future lexeme upgrades
      equipped: ['slot1', 'slot2', 'slot3'], // All 3 weapons always equipped when purchased
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

    // Rebuild the tinted grapheme cache so glyphs match the active palette immediately.
    this.rebuildTintedGraphemeCache();
    
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
   * Create tinted copies of all loaded grapheme sprites so glyphs follow the active palette.
   */
  rebuildTintedGraphemeCache() {
    // Clear existing cache
    this.tintedGraphemeCache.clear();
    
    // Rebuild colored versions for each loaded grapheme
    for (const [index, img] of this.graphemeSprites.entries()) {
      if (!this.graphemeSpriteLoaded.get(index)) continue;
      
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = this.activeScriptColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      this.tintedGraphemeCache.set(index, canvas);
    }
  }

  /**
   * Load individual SVG grapheme sprites for the Cardinal Warden name display.
   * Each grapheme (A-Z plus dagesh variants) has its own white SVG file that gets colored.
   */
  loadGraphemeSprites() {
    // Skip sprite loading on non-browser contexts
    if (typeof Image === 'undefined') {
      return;
    }
    
    // Letter mapping: index 0 = A, index 1 = B, ..., index 25 = Z.
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    // Dagesh sprite mapping for enhanced graphemes.
    const dageshSprites = [
      { index: GRAPHEME_INDEX.A_DAGESH, filename: 'grapheme-A-dagesh.svg' },
      { index: GRAPHEME_INDEX.I_DAGESH, filename: 'grapheme-I-dagesh.svg' },
      { index: GRAPHEME_INDEX.M_DAGESH, filename: 'grapheme-M-dagesh.svg' },
      { index: GRAPHEME_INDEX.P_DAGESH, filename: 'grapheme-P-dagesh.svg' },
      { index: GRAPHEME_INDEX.R_DAGESH, filename: 'grapheme-R-dagesh.svg' },
      { index: GRAPHEME_INDEX.S_DAGESH, filename: 'grapheme-S-dagesh.svg' },
      { index: GRAPHEME_INDEX.U_DAGESH, filename: 'grapheme-U-dagesh.svg' },
    ];

    const spriteSources = [
      ...letters.map((letter, index) => ({ index, filename: `grapheme-${letter}.svg` })),
      ...dageshSprites,
    ];

    spriteSources.forEach(({ index, filename }) => {
      const img = new Image();

      img.onload = () => {
        this.graphemeSpriteLoaded.set(index, true);
        // Rebuild the tinted cache entry for this grapheme.
        this.rebuildSingleTintedGrapheme(index, img);
      };

      img.onerror = () => {
        console.warn(`Failed to load grapheme sprite: ${filename}`);
      };

      // Load the SVG file for this grapheme.
      img.src = `./assets/sprites/spires/shinSpire/graphemes/${filename}`;
      this.graphemeSprites.set(index, img);
    });
  }

  /**
   * Create a tinted copy of a single grapheme sprite.
   * @param {number} index - The grapheme index (A-Z plus dagesh variants)
   * @param {Image} img - The loaded image
   */
  rebuildSingleTintedGrapheme(index, img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = this.activeScriptColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    this.tintedGraphemeCache.set(index, canvas);
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
   * Load warden sprite artwork (core and rotating shards).
   */
  loadWardenSprites() {
    // Skip sprite loading on non-browser contexts.
    if (typeof Image === 'undefined') {
      return;
    }
    
    // Load the warden core sprite (golden version)
    this.wardenCoreSprite = new Image();
    this.wardenCoreSprite.onload = () => {
      this.wardenCoreLoaded = true;
    };
    this.wardenCoreSprite.onerror = () => {
      console.warn('Failed to load warden core sprite');
    };
    this.wardenCoreSprite.src = './assets/sprites/spires/shinSpire/warden/wardenCoreGold.png';
    
    // Load all 37 warden shard sprites
    for (let i = 1; i <= 37; i++) {
      const sprite = new Image();
      sprite.onload = () => {
        this.wardenShardsLoaded[i - 1] = true;
      };
      sprite.onerror = () => {
        console.warn(`Failed to load warden shard sprite ${i}`);
      };
      sprite.src = `./assets/sprites/spires/shinSpire/warden/wardenShard (${i}).png`;
      this.wardenShardSprites[i - 1] = sprite;
    }
  }

  /**
   * Load enemy ship sprites for the 6 difficulty levels.
   */
  loadEnemyShipSprites() {
    // Skip sprite loading on non-browser contexts.
    if (typeof Image === 'undefined') {
      return;
    }
    
    this.enemyShipSprites = [];
    this.enemyShipSpritesLoaded = [];
    
    ENEMY_SHIP_SPRITES.forEach((url, index) => {
      const sprite = new Image();
      sprite.onload = () => {
        this.enemyShipSpritesLoaded[index + 1] = true;
      };
      sprite.onerror = () => {
        console.warn(`Failed to load enemy ship sprite: ${url}`);
      };
      sprite.src = url;
      this.enemyShipSprites[index + 1] = sprite;
    });

    // Append two dedicated boss-minion sprites after the six standard enemy ships.
    SHIN_BOSS_MINION_SPRITE_URLS.forEach((url, index) => {
      const spriteLevel = ENEMY_SHIP_SPRITES.length + index + 1;
      const sprite = new Image();
      sprite.onload = () => {
        this.enemyShipSpritesLoaded[spriteLevel] = true;
      };
      sprite.onerror = () => {
        console.warn(`Failed to load boss minion sprite: ${url}`);
      };
      sprite.src = url;
      this.enemyShipSprites[spriteLevel] = sprite;
    });
  }

  /**
   * Load milestone boss sprites and prebuild inverted-color variants.
   */
  loadBossSprites() {
    // Skip sprite loading on non-browser contexts.
    if (typeof Image === 'undefined') {
      return;
    }

    this.bossSprites = [];
    this.bossSpritesLoaded = [];
    this.invertedBossSpriteCache = [];

    SHIN_BOSS_SPRITE_URLS.forEach((url, index) => {
      const sprite = new Image();
      sprite.onload = () => {
        this.bossSpritesLoaded[index] = true;
        // Precompute an inverted-color canvas for waves 140-260.
        if (typeof document !== 'undefined') {
          const canvas = document.createElement('canvas');
          canvas.width = sprite.naturalWidth || sprite.width;
          canvas.height = sprite.naturalHeight || sprite.height;
          const ctx = canvas.getContext('2d');
          if (ctx && canvas.width > 0 && canvas.height > 0) {
            ctx.drawImage(sprite, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              data[i] = 255 - data[i];
              data[i + 1] = 255 - data[i + 1];
              data[i + 2] = 255 - data[i + 2];
            }
            ctx.putImageData(imageData, 0, 0);
            this.invertedBossSpriteCache[index] = canvas;
          }
        }
      };
      sprite.onerror = () => {
        console.warn(`Failed to load boss sprite: ${url}`);
      };
      sprite.src = url;
      this.bossSprites[index] = sprite;
    });
  }

  /**
   * Render a character from the individual grapheme sprites.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} charIndex - Index of the grapheme (A-Z plus dagesh variants)
   * @param {number} x - X position to render at
   * @param {number} y - Y position to render at
   * @param {number} size - Size to render the character
   */
  renderScriptChar(ctx, charIndex, x, y, size) { renderCwScriptChar.call(this, ctx, charIndex, x, y, size); }

  /**
   * Render the Cardinal Warden's script below the warden.
   * Displays 8 lines of script, one per weapon slot, based on assigned graphemes.
   */
  renderWardenName() { renderCwWardenName.call(this); }

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
   * Set legacy warden graphics mode.
   * @param {boolean} enabled - True to use old canvas rendering, false for new sprites
   */
  setLegacyWardenGraphics(enabled) {
    this.legacyWardenGraphics = Boolean(enabled);
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
      this.difficultyLevel = Math.floor(this.wave / 6);
      
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

    // Boss spawning is wave-driven (every 10 waves) so no timer-based spawns run here.

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
      
      // For weapons that aren't purchased, set fire rate to 60 minutes
      // This effectively prevents them from firing while locked
      const isPurchased = this.weapons.purchased[weaponId];
      const baseFireInterval = isPurchased ? weaponDef.baseFireRate : GAME_CONFIG.LOCKED_WEAPON_FIRE_INTERVAL;
      
      // Apply fire rate multiplier by dividing the interval (higher multiplier = faster shooting)
      const fireInterval = baseFireInterval / (fireRateMultiplier * weaponSpeedMult);
      
      this.weaponTimers[weaponId] += deltaTime;
      
      if (this.weaponTimers[weaponId] >= fireInterval) {
        this.weaponTimers[weaponId] = 0;
        this.fireWeapon(weaponId);
      }
      
      // Check for grapheme M (index 12) - Mine spawning
      let hasMineGrapheme = false;
      // Track dagesh mine modifiers to boost spawn frequency and damage.
      let useDageshMine = false;
      let mineSpawnDivisor = MINE_CONFIG.SPAWN_RATE_DIVISOR;
      for (const assignment of effectiveAssignments) {
        if (assignment && assignment.index === GRAPHEME_INDEX.M) {
          hasMineGrapheme = true;
          break;
        }
        if (assignment && assignment.index === GRAPHEME_INDEX.M_DAGESH) {
          hasMineGrapheme = true;
          useDageshMine = true;
          mineSpawnDivisor = DAGESH_CONFIG.M.SPAWN_RATE_DIVISOR;
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
        const mineSpawnRate = shotsPerSecond / mineSpawnDivisor;
        const mineSpawnInterval = 1000 / mineSpawnRate; // Interval in milliseconds
        
        this.mineSpawnAccumulators[weaponId] += deltaTime;
        
        if (this.mineSpawnAccumulators[weaponId] >= mineSpawnInterval) {
          this.mineSpawnAccumulators[weaponId] = 0;
          this.spawnMine(weaponId, { useDagesh: useDageshMine });
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
    
    // Safety check: Don't fire if weapon is not purchased
    if (!this.weapons.purchased[weaponId]) {
      return;
    }
    
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
    let spreadAngle = SPREAD_CONFIG.SPREAD_ANGLE;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.I_DAGESH) {
        // Dagesh I found! Extra bullets and wider cone based on slot position.
        if (slotIndex >= 0 && slotIndex < DAGESH_CONFIG.I.SLOT_TO_EXTRA_BULLETS.length) {
          spreadBulletCount = DAGESH_CONFIG.I.SLOT_TO_EXTRA_BULLETS[slotIndex];
        }
        spreadAngle = DAGESH_CONFIG.I.SPREAD_ANGLE;
        break; // Only apply the first occurrence
      }
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
    let homingDetectionRadius = 0;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.P_DAGESH) {
        // Dagesh homing found! Stronger turn rate and longer detection radius.
        const turnMultiplier = HOMING_CONFIG.SLOT_TO_TURN_MULTIPLIER[slotIndex] || 1;
        homingTurnRate = HOMING_CONFIG.BASE_TURN_RATE * turnMultiplier * DAGESH_CONFIG.P.TURN_RATE_MULTIPLIER;
        homingDetectionRadius = DAGESH_CONFIG.P.DETECTION_RADIUS;
        break; // Only apply the first occurrence
      }
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
    let chainDamageMultiplier = 0;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.R_DAGESH) {
        // Dagesh chain found! Adds extra jumps and stronger retention.
        const baseChainCount = CHAIN_CONFIG.SLOT_TO_CHAINS[slotIndex] || (slotIndex + 1);
        const baseRange = CHAIN_CONFIG.SLOT_TO_RANGE[slotIndex] || 20;
        chainCount = baseChainCount + DAGESH_CONFIG.R.CHAIN_BONUS;
        chainRange = baseRange * DAGESH_CONFIG.R.RANGE_MULTIPLIER;
        chainDamageMultiplier = DAGESH_CONFIG.R.DAMAGE_MULTIPLIER;
        break; // Only apply the first occurrence
      }
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
      if (assignment && assignment.index === GRAPHEME_INDEX.S_DAGESH) {
        // Dagesh size modifier found! Applies stronger size and speed shifts.
        sizeMultiplier = DAGESH_CONFIG.S.SLOT_TO_SIZE_MULT[slotIndex] || 1;
        sizeSpeedMult = DAGESH_CONFIG.S.SLOT_TO_SPEED_MULT[slotIndex] || 1;
        break; // Only apply the first occurrence
      }
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
    let pulseDamageMultiplier = 0;
    for (let slotIndex = 0; slotIndex < effectiveAssignments.length; slotIndex++) {
      const assignment = effectiveAssignments[slotIndex];
      if (assignment && assignment.index === GRAPHEME_INDEX.U_DAGESH) {
        // Dagesh pulse found! Faster, larger, and harder-hitting pulses.
        pulseRate = (PULSE_CONFIG.SLOT_TO_PULSE_RATE[slotIndex] || (slotIndex + 1)) * DAGESH_CONFIG.U.PULSE_RATE_MULTIPLIER;
        pulseRadius = (PULSE_CONFIG.SLOT_TO_PULSE_RADIUS[slotIndex] || 15) * DAGESH_CONFIG.U.PULSE_RADIUS_MULTIPLIER;
        pulseDamageMultiplier = DAGESH_CONFIG.U.PULSE_DAMAGE_MULTIPLIER;
        break; // Only apply the first occurrence
      }
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
      if (assignment && (assignment.index === GRAPHEME_INDEX.A || assignment.index === GRAPHEME_INDEX.A_DAGESH)) {
        // ThoughtSpeak grapheme found! Apply slot-based mechanics (dagesh adds extra sides + damage).
        // Slot 0 = triangle (3 sides), 3x damage
        // Slot 1 = pentagon (5 sides), 5x damage  
        // Slot 2 = hexagon (6 sides), 6x damage
        // Slot 3+ = continues pattern (7, 8, 9, 10, 11 sides, etc.)
        const sidesMap = [3, 5, 6, 7, 8, 9, 10, 11];
        let sides = sidesMap[slotIndex] !== undefined ? sidesMap[slotIndex] : Math.max(3, slotIndex + 3);
        if (assignment.index === GRAPHEME_INDEX.A_DAGESH) {
          // Dagesh A gains additional sides and a damage multiplier.
          sides += DAGESH_CONFIG.A.SHAPE_BONUS;
          damageMultiplier *= sides * DAGESH_CONFIG.A.DAMAGE_MULTIPLIER;
        } else {
          damageMultiplier *= sides; // 3x, 5x, 6x, 7x, 8x, 9x, 10x, 11x, etc.
        }
        bulletShape = sides;
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
      homingDetectionRadius: homingDetectionRadius, // Grapheme P - homing detection radius
      splitCount: splitCount, // Grapheme Q - number of splits
      chainCount: chainCount, // Grapheme R - chain lightning count
      chainRange: chainRange, // Grapheme R - chain range
      chainDamageMultiplier: chainDamageMultiplier, // Grapheme R - chain damage retention
      orbitalCount: orbitalCount, // Grapheme T - number of orbits
      pulseRate: pulseRate, // Grapheme U - pulses per second
      pulseRadius: pulseRadius, // Grapheme U - pulse radius
      pulseDamageMultiplier: pulseDamageMultiplier, // Grapheme U - pulse damage retention
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
      const totalSpreadAngle = spreadAngle;
      const angleStep = totalSpreadAngle / (totalBullets - 1);
      const startAngle = baseAngle - (totalSpreadAngle / 2);
      
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
  spawnMine(weaponId, { useDagesh = false } = {}) {
    if (!this.warden || !this.canvas) return;
    
    const weaponDef = WEAPON_SLOT_DEFINITIONS[weaponId];
    if (!weaponDef) return;
    
    const cx = this.warden.x;
    const cy = this.warden.y;
    
    // Calculate explosion damage (dagesh mines multiply the base explosion).
    const baseDamage = weaponDef.baseDamage * this.upgrades.bulletDamage;
    const mineDamageMultiplier = useDagesh
      ? MINE_CONFIG.EXPLOSION_DAMAGE_MULTIPLIER * DAGESH_CONFIG.M.DAMAGE_MULTIPLIER
      : MINE_CONFIG.EXPLOSION_DAMAGE_MULTIPLIER;
    const explosionDamage = baseDamage * mineDamageMultiplier;
    
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
      // Only process grapheme effects for purchased weapons
      if (!this.weapons.purchased[weaponId]) continue;
      
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
      // Only process grapheme effects for purchased weapons
      if (!this.weapons.purchased[weaponId]) continue;
      
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
   * Delegates to extracted SwarmSystem (Build 475).
   */
  checkSwarmLaserCollisions() {
    const { killedEnemyIndices, killedBossIndices, hitLaserIndices } = checkSwarmLaserCollisionsSystem(
      this.swarmLasers,
      this.enemies,
      this.bosses,
      (target, damage, x, y) => {
        // onDamage callback
        this.spawnDamageNumber(x, y, damage);
      },
      (target, x, y, scoreValue, isBoss) => {
        // onKill callback
        this.addScore(scoreValue);
        this.spawnScorePopup(x, y, scoreValue);
        if (this.onEnemyKill) {
          this.onEnemyKill(x, y, isBoss);
        }
      }
    );

    // Remove killed enemies
    for (const i of killedEnemyIndices) {
      this.enemies.splice(i, 1);
    }

    // Remove killed bosses
    for (const i of killedBossIndices) {
      this.bosses.splice(i, 1);
    }

    // Remove hit lasers
    for (const i of hitLaserIndices) {
      this.swarmLasers.splice(i, 1);
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
    if (this.difficultyLevel >= 5) pool.push('advanced');
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
  spawnBoss(waveNumber = this.wave + 1) {
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
    // Attach wave-based sprite selection so boss visuals match the uploaded Shin sequence.
    const spriteSelection = resolveBossSpriteForWave(waveNumber);
    boss.spriteIndex = spriteSelection.index;
    boss.invertSpriteColors = spriteSelection.invert;
    boss.pickNewTarget(this.canvas.width, this.canvas.height, this.rng);
    this.bosses.push(boss);
  }

  /**
   * Handle wave-based boss spawning rules.
   * Called when a new wave starts.
   */
  handleWaveBossSpawns() {
    const waveNumber = this.wave + 1; // Convert from 0-indexed to 1-indexed

    // Spawn exactly one milestone boss every 10 waves to match Shin boss cadence.
    if (waveNumber % 10 === 0) {
      this.spawnBoss(waveNumber);
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
    // Randomize between the two boss minion sprites for variety in spawned ships.
    const minionSpriteOffset = this.rng.int(0, SHIN_BOSS_MINION_SPRITE_URLS.length - 1);
    ship.spriteLevel = ENEMY_SHIP_SPRITES.length + minionSpriteOffset + 1;
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
          // Allow dagesh pulse graphemes to override pulse damage scaling.
          const pulseDamageMultiplier = bullet.pulseDamageMultiplier || PULSE_CONFIG.PULSE_DAMAGE_MULTIPLIER;
          const pulseDamage = bullet.damage * pulseDamageMultiplier;
          
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
            const wave = createWaveFromBulletImpact(enemy.x, enemy.y, bullet);
            if (wave) {
              this.expandingWaves.push(wave);
            }
          }
          
          // Apply elemental effect from tenth grapheme (J)
          if (bullet.elementalEffect === 'burning') {
            enemy.applyBurning();
          } else if (bullet.elementalEffect === 'freezing') {
            enemy.applyFreeze();
          }
          
          // Handle new grapheme effects on hit (O-Z)
          
          // Grapheme Q (index 16) - Split bullets
          // Only split if we have 2 or more bullets to create
          if (bullet.splitCount >= 2 && !bulletsToRemove.has(bi)) {
            const splitAngle = SPLIT_CONFIG.SPLIT_SPREAD_ANGLE;
            const angleStep = splitAngle / (bullet.splitCount - 1);
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
            // Allow dagesh chain graphemes to override damage retention.
            const chainDamageMultiplier = bullet.chainDamageMultiplier || CHAIN_CONFIG.CHAIN_DAMAGE_MULTIPLIER;
            let currentChainDamage = bullet.damage * chainDamageMultiplier; // First chain gets reduced damage
            let currentTarget = enemy;
            const chainedTargets = new Set([ei]); // Track to avoid chaining to same target (includes initial hit)
            
            for (let c = 0; c < bullet.chainCount; c++) {
              // Apply additional damage decay for subsequent chains (after first chain target)
              if (c > 0) {
                currentChainDamage *= chainDamageMultiplier;
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
            const wave = createWaveFromBulletImpact(boss.x, boss.y, bullet);
            if (wave) {
              this.expandingWaves.push(wave);
            }
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
   * Delegates to extracted BeamSystem (Build 474).
   */
  checkBeamCollisions() {
    const { killedEnemyIndices, killedBossIndices } = checkBeamCollisionsSystem(
      this.beams,
      this.enemies,
      this.bosses,
      (target, damage, x, y) => {
        // onDamage callback
        this.spawnDamageNumber(x, y, damage);
      },
      (target, x, y, scoreValue, isBoss) => {
        // onKill callback
        this.addScore(scoreValue);
        this.spawnScorePopup(x, y, scoreValue);
        if (this.onEnemyKill) {
          this.onEnemyKill(x, y, isBoss);
        }
      }
    );

    // Remove killed enemies
    for (const i of killedEnemyIndices) {
      this.enemies.splice(i, 1);
    }

    // Remove killed bosses
    for (const i of killedBossIndices) {
      this.bosses.splice(i, 1);
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
    // Delegate to extracted Wave System
    const { killedEnemyIndices, killedBossIndices } = updateWaveSystem(
      this.expandingWaves,
      deltaTime,
      this.enemies,
      this.bosses,
      (target, damage, x, y, isKilled) => {
        // onDamage callback
        this.spawnDamageNumber(x, y, damage);
      },
      (target, x, y, scoreValue) => {
        // onKill callback
        this.addScore(scoreValue);
        this.spawnScorePopup(x, y, scoreValue);
      }
    );
    
    // Remove killed enemies
    for (const i of killedEnemyIndices) {
      this.enemies.splice(i, 1);
    }
    
    // Remove killed bosses
    for (const i of killedBossIndices) {
      this.bosses.splice(i, 1);
    }
  }

  /**
   * Update all mines and check for collisions with enemies.
   * Mines explode on contact with enemies, creating expanding damage waves.
   * Delegates to extracted MineSystem (Build 474).
   */
  updateMines(deltaTime) {
    if (!this.canvas) return;

    // Delegate to extracted Mine System - returns new explosion waves
    const newWaves = updateMinesSystem(
      this.mines,
      this.enemies,
      this.bosses,
      this.canvas.width,
      this.canvas.height,
      deltaTime
    );

    // Add explosion waves to expanding waves array
    for (const wave of newWaves) {
      this.expandingWaves.push(wave);
    }
  }

  /**
   * Render all floating score popups.
   */
  renderScorePopups() { renderCwScorePopups.call(this); }

  /**
   * Render all floating damage numbers.
   */
  renderDamageNumbers() { renderCwDamageNumbers.call(this); }

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
  render() { renderCwRender.call(this); }

  /**
   * Render the death animation.
   */
  renderDeathAnimation() { renderCwDeathAnimation.call(this); }

  /**
   * Render the respawn animation.
   */
  renderRespawnAnimation() { renderCwRespawnAnimation.call(this); }

  /**
   * Render the Cardinal Warden.
   */
  renderWarden() { renderCwWarden.call(this); }

  /**
   * Render the aim target symbol where the player has clicked/tapped.
   */
  renderAimTarget() { renderCwAimTarget.call(this); }

  /**
   * Render target indicators for enemies targeted by the eighth grapheme (Theta).
   */
  renderWeaponTargets() { renderCwWeaponTargets.call(this); }

  /**
   * Render all friendly ships.
   */
  renderFriendlyShips() { renderCwFriendlyShips.call(this); }

  /**
   * Render all enemies.
   */
  renderEnemies() { renderCwEnemies.call(this); }

  /**
   * Render all boss ships with distinctive visuals.
   */
  renderBosses() { renderCwBosses.call(this); }

  /**
   * Render Circle Carrier boss - large rotating circle with inner rings.
   */
  renderCircleCarrierBoss(ctx, boss) { renderCwCircleCarrierBoss.call(this, ctx, boss); }

  /**
   * Render Pyramid boss - rotating triangle with burst indicator.
   */
  renderPyramidBoss(ctx, boss) { renderCwPyramidBoss.call(this, ctx, boss); }

  /**
   * Render Hexagon Fortress boss - large rotating hexagon with shield indicator.
   */
  renderHexagonFortressBoss(ctx, boss) { renderCwHexagonFortressBoss.call(this, ctx, boss); }

  /**
   * Render Mega Boss - enhanced hexagon with larger size.
   */
  renderMegaBoss(ctx, boss) { renderCwMegaBoss.call(this, ctx, boss); }

  /**
   * Render Ultra Boss - largest and most powerful boss with distinctive visual.
   */
  renderUltraBoss(ctx, boss) { renderCwUltraBoss.call(this, ctx, boss); }

  /**
   * Render all bullets.
   */
  renderBullets() { renderCwBullets.call(this); }

  /**
   * Render all beams from grapheme L (index 11).
   */
  renderBeams() { renderCwBeams.call(this); }

  /**
   * Render all expanding waves from the seventh grapheme (index 6).
   */
  renderExpandingWaves() { renderCwExpandingWaves.call(this); }

  /**
   * Render all drifting mines from grapheme M (index 12).
   */
  renderMines() { renderCwMines.call(this); }

  /**
   * Render all swarm ships from grapheme N (index 13).
   */
  renderSwarmShips() { renderCwSwarmShips.call(this); }

  /**
   * Render all swarm lasers from grapheme N (index 13).
   */
  renderSwarmLasers() { renderCwSwarmLasers.call(this); }

  /**
   * Initialize or reset life lines to their default state.
   * @private
   */
  initializeLifeLines() { renderCwInitializeLifeLines.call(this); }

  /**
   * Update life line states when ships pass through.
   * @param {number} count - Number of lives to consume (default: 1)
   */
  updateLifeLine(count = 1) { renderCwUpdateLifeLine.call(this, count); }

  /**
   * Render UI elements.
   */
  renderUI() { renderCwUI.call(this); }

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
      const isPurchased = this.weapons.purchased[weaponId] || false;
      const level = this.weapons.levels[weaponId] || 1;
      const isEquipped = true; // All slots are always equipped
      const glowIntensity = this.weaponGlowState?.[weaponId] || 0;
      const cooldownProgress = this.weaponTimers?.[weaponId] || 0;
      
      // Calculate actual fire interval considering graphemes and speed upgrades
      const assignments = this.weaponGraphemeAssignments[weaponId] || [];
      const effectiveAssignments = this.getEffectiveGraphemeAssignments(assignments);
      const fireRateMultiplier = this.calculateFireRateMultiplier(effectiveAssignments);
      const weaponSpeedMult = this.getWeaponSpeedMultiplier(weaponId);
      const cooldownTotal = def.baseFireRate / (fireRateMultiplier * weaponSpeedMult);
      
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
    
    if (state?.levels) {
      this.weapons.levels = { ...this.weapons.levels, ...state.levels };
    }
    if (state?.activeWeaponId) {
      this.weapons.activeWeaponId = state.activeWeaponId;
    }
    
    // All 3 weapons are in the equipped list, but only fire if purchased
    this.weapons.equipped = [...WEAPON_SLOT_IDS];
    
    // Initialize timers for all equipped weapons
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
