/**
 * Cardinal Warden configuration constants and grapheme definitions.
 * Extracted from cardinalWardenSimulation.js to improve maintainability.
 * 
 * This module contains all the tuning constants and configuration values
 * for the reverse danmaku game mechanics.
 */

/**
 * Grapheme index constants for clear identification.
 * Graphemes are now named using English letters (A-Z).
 */
export const GRAPHEME_INDEX = {
  A: 0,            // ThoughtSpeak shapes (formerly Alpha)
  B: 1,            // Fire rate multiplier (formerly Beta)
  C: 2,            // Friendly ships, deactivates RIGHT (formerly Gamma)
  D: 3,            // Shield regeneration (formerly Delta)
  E: 4,            // Lightning movement (formerly Epsilon)
  F: 5,            // Piercing and trail passthrough (formerly Zeta)
  G: 6,            // Expanding waves, deactivates LEFT (formerly Eta)
  H: 7,            // Weapon targeting (formerly Theta)
  I: 8,            // Spread bullets (formerly Iota)
  J: 9,            // Elemental effects (burning/freezing)
  K: 10,           // Massive bullet (slots 0-6) or attack speed boost (slot 7)
  L: 11,           // Continuous beam, deactivates LEFT and RIGHT neighbors
  M: 12,           // Drifting mines that explode on contact
  N: 13,           // Swarm ships that fire green lasers at enemies
};

/**
 * Wave mechanics constants for grapheme G (index 6).
 */
export const WAVE_CONFIG = {
  // Time for wave to expand to full radius (seconds)
  EXPANSION_DURATION_SECONDS: 3,
  // Base ring thickness for collision detection (pixels)
  RING_BASE_THICKNESS: 10,
  // Default enemy size for collision calculations (pixels)
  DEFAULT_ENEMY_SIZE: 8,
  // Default boss size for collision calculations (pixels)
  DEFAULT_BOSS_SIZE: 12,
  // Damage multiplier (wave damage = shot damage × multiplier)
  DAMAGE_MULTIPLIER: 0.1,
};

/**
 * Spread bullet mechanics constants for grapheme I (index 8).
 */
export const SPREAD_CONFIG = {
  // Total spread angle in radians (30 degrees)
  SPREAD_ANGLE: Math.PI / 6,
  // Slot position to extra bullet count mapping (0-indexed)
  // Pattern mirrors around center: slots 3 and 4 have max bullets
  SLOT_TO_EXTRA_BULLETS: [2, 4, 6, 8, 8, 6, 4, 2],
};

/**
 * Elemental effects constants for grapheme J (index 9).
 */
export const ELEMENTAL_CONFIG = {
  // Burning effect (slots 0-3)
  BURN_DAMAGE_PERCENT: 0.05,        // 5% of max health per second
  BURN_PARTICLE_SPAWN_RATE: 0.1,   // Spawn particle every 0.1 seconds
  BURN_PARTICLE_LIFETIME: 1.0,     // Particles last 1 second
  BURN_PARTICLE_SPEED: 20,         // Pixels per second upward
  BURN_PARTICLE_COLOR: '#ff4444',  // Red color for burning particles
  BURN_PARTICLE_MIN_COUNT: 2,      // Minimum particles per spawn
  BURN_PARTICLE_MAX_COUNT: 3,      // Maximum particles per spawn (exclusive)
  BURN_PARTICLE_HORIZONTAL_SPREAD: 10, // Horizontal velocity spread (pixels/sec)
  
  // Freeze effect (slots 4-7)
  FREEZE_DURATION: 0.5,             // Freeze lasts 0.5 seconds
  FREEZE_COLOR: '#88ccff',          // Ice blue color
};

/**
 * Massive bullet mechanics constants for grapheme K (index 10).
 */
export const MASSIVE_BULLET_CONFIG = {
  // Slots 0-6: Massive bullet mode
  ATTACK_SPEED_DIVISOR: 20,        // Attack speed reduced by factor of 20
  DAMAGE_MULTIPLIER: 20,           // Damage increased by 20x
  SIZE_MULTIPLIER: 20,             // Bullet diameter increased by 20x
  SPEED_DIVISOR: 10,               // Bullet speed reduced by factor of 10
  // Note: Unlimited pierce and inflicts all effects automatically
  
  // Slot 7 (index 7): Speed boost mode
  SPEED_BOOST_MULTIPLIER: 10,      // Attack speed increased by 10x
};

/**
 * Beam mechanics constants for grapheme L (index 11).
 * Converts bullets into continuous beams.
 */
export const BEAM_CONFIG = {
  BEAM_WIDTH: 3,                   // Visual beam width (pixels)
  DAMAGE_TICKS_PER_SECOND: 4,      // How many times per second beam applies damage
  BEAM_ALPHA: 0.8,                 // Beam color alpha (transparency)
  MAX_BEAM_LENGTH: 10000,          // Maximum beam length (pixels) - extends to edge of canvas
  // Legacy properties for future enhancements
  WIDTH: 8,                        // Beam width in pixels (alternative)
  MIN_ALPHA: 0.3,                  // Minimum beam opacity
  MAX_ALPHA: 0.8,                  // Maximum beam opacity
  PULSE_FREQUENCY: 4,              // Pulses per second for visual effect
};

/**
 * Mine mechanics constants for grapheme M (index 12).
 * Spawns drifting mines that explode on contact.
 */
export const MINE_CONFIG = {
  SPAWN_RATE_DIVISOR: 20,          // Mine spawn rate divisor: (shots per second) / this value
  DRIFT_SPEED: 30,                 // Mine drift speed (pixels per second)
  MINE_SIZE: 5,                    // Mine size (radius in pixels)
  EXPLOSION_DAMAGE_MULTIPLIER: 100, // Explosion damage multiplier (damage = base weapon damage × this)
  EXPLOSION_DIAMETER_DIVISOR: 10,  // Explosion wave diameter divisor (diameter = canvas.width / this)
  EXPLOSION_DURATION: 1.5,         // Explosion wave expansion duration (seconds)
  MINE_LIFETIME: 10,               // Mine lifetime before auto-despawn (seconds)
  // Future enhancements
  DRIFT_SPEED_MIN: 10,             // Minimum drift speed (pixels/sec)
  DRIFT_SPEED_MAX: 30,             // Maximum drift speed (pixels/sec)
  RADIUS: 6,                       // Visual and collision radius (pixels)
  COLOR: '#ff8800',                // Orange color for mines
  EXPLOSION_COLOR: '#ff4400',      // Red-orange for explosions
};

/**
 * Swarm ship mechanics constants for grapheme N (index 13).
 * Spawns tiny friendly triangles that fire green lasers.
 */
export const SWARM_CONFIG = {
  GRAPHEME_COUNT_DIVISOR: 10,      // Number of ships = (total graphemes) / this divisor, max 100
  MAX_SWARM_SHIPS: 100,            // Maximum number of swarm ships
  SHIP_SIZE: 8,                    // Ship size (triangle base width in pixels)
  MOVEMENT_SPEED: 100,             // Ship movement speed (pixels per second)
  SWARM_RADIUS: 80,                // Random movement range around target (pixels)
  TRAIL_LENGTH: 15,                // Trail length for visual effect
  FIRE_RATE_DIVISOR: 10,           // Laser fire rate divisor: weapon attack speed / this value
  DAMAGE_DIVISOR: 10,              // Laser damage divisor: weapon damage / this value
  LASER_SPEED: 300,                // Laser speed (pixels per second)
  LASER_LENGTH: 10,                // Laser size (length in pixels)
  LASER_WIDTH: 2,                  // Laser size (width in pixels)
  LASER_COLOR: '#00ff00',          // Laser color (green)
  // Future enhancements
  MAX_SHIPS: 100,                  // Maximum number of swarm ships (alternative)
  SHIP_COLOR: '#00ff88',           // Cyan-green color
  MOVE_SPEED: 100,                 // Movement speed toward target (pixels/sec)
  LASER_FIRE_RATE_DIVISOR: 10,     // Fire rate = weapon attack speed / 10
  LASER_DAMAGE_DIVISOR: 10,        // Laser damage = weapon damage / 10
};

/**
 * General game configuration constants.
 */
export const GAME_CONFIG = {
  MAX_ENEMIES_PASSED: 10,          // Maximum enemies that can pass through before game over
  WARDEN_MAX_HEALTH: 100,          // Cardinal Warden maximum health
  WAVE_DURATION_MS: 15000,         // Time per wave in milliseconds
  BASE_ENEMY_SPAWN_INTERVAL_MS: 2000, // Base time between enemy spawns in milliseconds
  BASE_BULLET_INTERVAL_MS: 500,    // Base time between bullet volleys in milliseconds
  MAX_DELTA_TIME_MS: 33,           // Maximum delta time cap to prevent physics issues (ms)
  BOSS_MIN_DIFFICULTY: 3,          // Minimum difficulty level required for boss spawning
  BOSS_DIFFICULTY_SCALE: 0.2,      // Difficulty scaling factor for boss stats
  BOSS_SPAWN_INTERVAL_MAX_REDUCTION: 20000, // Maximum reduction in boss spawn interval (ms)
  BOSS_SPAWN_INTERVAL_REDUCTION_PER_LEVEL: 2000, // Reduction per difficulty level for boss spawn interval (ms)
  BOSS_SPAWN_INTERVAL_MIN: 10000,  // Minimum boss spawn interval (ms)
  // Canvas aspect ratio (width:height)
  ASPECT_RATIO_WIDTH: 3,
  ASPECT_RATIO_HEIGHT: 4,
  // Player movement
  PLAYER_MOVE_SPEED: 200,          // Pixels per second
  PLAYER_COLLISION_RADIUS: 12,     // Collision detection radius
  // Enemy spawning
  ENEMY_SPAWN_INTERVAL_MIN: 0.5,   // Minimum seconds between spawns
  ENEMY_SPAWN_INTERVAL_MAX: 2.0,   // Maximum seconds between spawns
  // Difficulty scaling
  DIFFICULTY_SCALE_FACTOR: 1.05,   // Multiplicative scaling per wave
  // Visual effects
  BACKGROUND_COLOR: '#ffffff',     // Pure white background
  WARDEN_ORB_COLOR: '#ffcc00',     // Golden color for center orb
};

/**
 * Boss type configurations for different boss classes.
 */
export const BOSS_TYPES = {
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
  megaBoss: {
    speed: 12,
    health: 100,
    damage: 50,
    size: 55,
    scoreValue: 500,
    color: '#000000',
    rotationSpeed: 0.4,
    shieldRegenRate: 1.0,
  },
  ultraBoss: {
    speed: 15,
    health: 200,
    damage: 75,
    size: 65,
    scoreValue: 1000,
    color: '#000000',
    rotationSpeed: 0.5,
    shieldRegenRate: 2.0,
  },
};

/**
 * Weapon slot IDs for the Cardinal Warden.
 */
export const WEAPON_SLOT_IDS = ['slot1', 'slot2', 'slot3'];

/**
 * Simplified weapon definitions for the Cardinal Warden.
 * Three weapons that fire simple bullets toward the click target.
 * Each weapon has 8 grapheme slots where lexemes can be placed to modify behavior.
 */
export const WEAPON_SLOT_DEFINITIONS = {
  slot1: {
    id: 'slot1',
    name: 'Weapon 1',
    symbol: 'Ⅰ',
    symbolGraphemeIndex: 26, // ThoughtSpeak number 1
    description: '',
    baseDamage: 1,
    baseSpeed: 200,
    baseFireRate: 2000, // 2 seconds
    pattern: 'straight', // Simple straight bullet
    color: '#d4af37', // Will be overridden by gradient
    slotIndex: 0,
  },
  slot2: {
    id: 'slot2',
    name: 'Weapon 2',
    symbol: 'Ⅱ',
    symbolGraphemeIndex: 27, // ThoughtSpeak number 2
    description: '',
    baseDamage: 1,
    baseSpeed: 200,
    baseFireRate: 3000, // 3 seconds
    pattern: 'straight',
    color: '#ff9c66', // Will be overridden by gradient
    slotIndex: 1,
  },
  slot3: {
    id: 'slot3',
    name: 'Weapon 3',
    symbol: 'Ⅲ',
    symbolGraphemeIndex: 28, // ThoughtSpeak number 3
    description: '',
    baseDamage: 1,
    baseSpeed: 200,
    baseFireRate: 5000, // 5 seconds
    pattern: 'straight',
    color: '#9a6bff', // Will be overridden by gradient
    slotIndex: 2,
  },
};

/**
 * Legacy weapon definitions kept for reference but deactivated.
 */
export const LEGACY_WEAPON_DEFINITIONS = {
  // All 9 previous weapons are now deactivated
  // These definitions are kept for potential future lexeme system
};

/**
 * Enemy type configurations for different difficulty tiers.
 */
export const ENEMY_TYPES = {
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
  ricochet: {
    speed: 70,
    health: 2,
    damage: 8,
    size: 9,
    scoreValue: 35,
    color: '#000000',
    trailLimit: 30,
    trailRadiusScale: 0.2,
    trailAlphaScale: 0.65,
    maxSmokePuffs: 45,
    initialStraightTime: 0.55,
    turnIntervalRange: { min: 0.65, max: 1.2 },
  },
};


