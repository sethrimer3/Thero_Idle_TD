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
  WIDTH: 8,                        // Beam width in pixels
  DAMAGE_TICKS_PER_SECOND: 4,      // How many times per second beam applies damage
  MIN_ALPHA: 0.3,                  // Minimum beam opacity
  MAX_ALPHA: 0.8,                  // Maximum beam opacity
  PULSE_FREQUENCY: 4,              // Pulses per second for visual effect
};

/**
 * Mine mechanics constants for grapheme M (index 12).
 * Spawns drifting mines that explode on contact.
 */
export const MINE_CONFIG = {
  SPAWN_RATE_DIVISOR: 20,          // Mines spawned at (shots per second) / 20
  DRIFT_SPEED_MIN: 10,             // Minimum drift speed (pixels/sec)
  DRIFT_SPEED_MAX: 30,             // Maximum drift speed (pixels/sec)
  RADIUS: 6,                       // Visual and collision radius (pixels)
  EXPLOSION_DIAMETER_DIVISOR: 10,  // Explosion diameter = canvas.width / 10
  EXPLOSION_DAMAGE_MULTIPLIER: 100, // Explosion damage = 100x base weapon damage
  EXPLOSION_DURATION: 0.3,         // Explosion animation duration (seconds)
  COLOR: '#ff8800',                // Orange color for mines
  EXPLOSION_COLOR: '#ff4400',      // Red-orange for explosions
};

/**
 * Swarm ship mechanics constants for grapheme N (index 13).
 * Spawns tiny friendly triangles that fire green lasers.
 */
export const SWARM_CONFIG = {
  // Number of ships = (total graphemes / divisor), capped at max
  GRAPHEME_COUNT_DIVISOR: 10,      // Ships = graphemes / 10
  MAX_SHIPS: 100,                  // Maximum number of swarm ships
  SHIP_SIZE: 4,                    // Triangle size (pixels)
  SHIP_COLOR: '#00ff88',           // Cyan-green color
  SWARM_RADIUS: 50,                // Radius around target to swarm (pixels)
  MOVE_SPEED: 100,                 // Movement speed toward target (pixels/sec)
  LASER_FIRE_RATE_DIVISOR: 10,     // Fire rate = weapon attack speed / 10
  LASER_DAMAGE_DIVISOR: 10,        // Laser damage = weapon damage / 10
  LASER_SPEED: 300,                // Laser travel speed (pixels/sec)
  LASER_LENGTH: 20,                // Laser beam length (pixels)
  LASER_COLOR: '#00ff00',          // Green color for lasers
};

/**
 * General game configuration constants.
 */
export const GAME_CONFIG = {
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


