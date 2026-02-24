/**
 * Kuf Battlefield Simulation configuration constants.
 * Extracted from kufSimulation.js to improve maintainability.
 * 
 * This module contains all the tuning constants and configuration values
 * for the lightweight RTS-style encounter mechanics.
 */

/**
 * Default map identifier used when the external dataset is unavailable.
 */
export const KUF_FALLBACK_MAP_ID = 'forward-bastion';

/**
 * Marine unit configuration.
 */
export const MARINE_CONFIG = {
  MOVE_SPEED: 70,        // Pixels per second
  ACCELERATION: 120,     // Pixels per second squared
  RANGE: 160,            // Attack range in pixels
  RADIUS: 3.6,           // 20% of original 18
  BULLET_SPEED: 360,     // Bullet travel speed (pixels per second)
};

/**
 * Sniper unit configuration.
 */
export const SNIPER_CONFIG = {
  RADIUS: 3.2,           // 20% of original 16
  RANGE: 280,            // Attack range in pixels
  BULLET_SPEED: 500,     // Bullet travel speed (pixels per second)
};

/**
 * Splayer unit configuration.
 */
export const SPLAYER_CONFIG = {
  RADIUS: 4,             // 20% of original 20
  RANGE: 200,            // Attack range in pixels
  ROCKET_SPEED: 200,     // Rocket travel speed (pixels per second)
};

/**
 * Piercing laser unit configuration.
 */
export const LASER_CONFIG = {
  RADIUS: 3.4,           // Compact radius to differentiate the laser chassis
  RANGE: 230,            // Longer range to emphasize precision fire
  BULLET_SPEED: 520,     // Faster beam pulses to feel laser-like
};

/**
 * Turret configuration.
 */
export const TURRET_CONFIG = {
  RADIUS: 2.4,           // 20% of original 12
  RANGE: 200,            // Attack range in pixels
  BULLET_SPEED: 280,     // Bullet travel speed (pixels per second)
};

/**
 * Big turret configuration.
 */
export const BIG_TURRET_CONFIG = {
  RADIUS: 4.8,           // 2x turret size
  RANGE: 250,            // Attack range in pixels
};

/**
 * Melee unit configuration.
 */
export const MELEE_UNIT_CONFIG = {
  RADIUS: 3.2,
  RANGE: 20,
  SIGHT_RANGE: 150,
  SPEED: 60,
};

/**
 * Ranged unit configuration.
 */
export const RANGED_UNIT_CONFIG = {
  RADIUS: 3.0,
  RANGE: 120,
  SIGHT_RANGE: 180,
  SPEED: 50,
};

/**
 * Structure configuration.
 */
export const STRUCTURE_CONFIG = {
  BARRACKS_RADIUS: 6,
  MINE_RADIUS: 2,
  MINE_EXPLOSION_RADIUS: 60,
  WALL_RADIUS: 8,
};

/**
 * Projectile speeds.
 */
export const PROJECTILE_SPEEDS = {
  PLASMA_BULLET_SPEED: 260,
};

/**
 * Visual rendering configuration.
 */
export const RENDERING_CONFIG = {
  TRAIL_ALPHA: 0.22,
  LOW_TRAIL_ALPHA: 0.14,                  // Softer fade for lightweight rendering while preserving trails
  HIGH_QUALITY_FRAME_BUDGET_MS: 18,       // Target frame cost before we start trimming glow work
  FRAME_COST_SMOOTHING: 0.08,             // Exponential smoothing factor for frame time measurements
};

/**
 * Camera control configuration.
 */
export const CAMERA_CONFIG = {
  PAN_SPEED: 1.2,
  MIN_ZOOM: 0.5,
  MAX_ZOOM: 2.0,
};

/**
 * Spawning and gameplay configuration.
 */
export const GAMEPLAY_CONFIG = {
  SPAWN_AREA_MARGIN: 24,                   // Margin in pixels from canvas edge for spawn area
  BULLET_CULLING_MARGIN: 400,              // World-space margin for keeping bullets alive during camera movement
};

/**
 * Grid system: 1 grid unit = 5 * marine diameter = 5 * (2 * MARINE_RADIUS) = 36 pixels
 * Note: This is computed from MARINE_CONFIG.RADIUS
 */
export function getGridUnit() {
  return 5 * (2 * MARINE_CONFIG.RADIUS); // 36 pixels
}

// For backward compatibility, export as constant
export const GRID_UNIT = getGridUnit();

/**
 * Default unit statistics used as fallbacks when starting a simulation.
 */
export const DEFAULT_UNIT_STATS = {
  MARINE: { health: 10, attack: 1, attackSpeed: 1 },
  SNIPER: { health: 8, attack: 2, attackSpeed: 0.5 },
  SPLAYER: { health: 12, attack: 0.8, attackSpeed: 0.7 },
  // Baseline piercing laser stats emphasize steady, precise fire.
  LASER: { health: 9, attack: 1.4, attackSpeed: 0.9 },
};

/**
 * Default unit counts used when starting a simulation.
 */
export const DEFAULT_UNIT_COUNTS = {
  marines: 0,
  snipers: 0,
  splayers: 0,
  // Default laser unit count starts at zero like other Kuf units.
  lasers: 0,
};

/**
 * Pre-calculated math constant: two times Pi.
 * Used in physics update loops and rendering arcs.
 */
export const TWO_PI = Math.PI * 2;

/**
 * HUD layout constants for the Kuf base core and training toolbar.
 */
export const KUF_HUD_LAYOUT = {
  BASE_RADIUS: 22,
  BASE_GLOW_RADIUS: 34,
  BASE_TO_TOOLBAR_GAP: 20,
  TOOLBAR_SLOT_SIZE: 46,
  TOOLBAR_SLOT_GAP: 12,
  TOOLBAR_BOTTOM_PADDING: 10,
};

/**
 * Combat tuning for the core ship cannons anchored to the HUD base.
 */
export const KUF_CORE_SHIP_COMBAT = {
  CANNON_RANGE: 210,
  CANNON_DAMAGE: 1.4,
  CANNON_ATTACK_SPEED: 0.7,
  CANNON_PROJECTILE_SPEED: 340,
  CANNON_SPREAD_RADIANS: 0.35,
  CORE_COLLISION_SCALE: 0.65,
};

/**
 * Splayer unit spin animation constants.
 */
export const SPLAYER_BASE_SPIN_SPEED = 0.6;
export const SPLAYER_SPIN_BOOST_MULTIPLIER = 3;
export const SPLAYER_SPIN_BOOST_DURATION = 2;

/**
 * Training catalog: cost and duration for each trainable Kuf unit.
 */
export const KUF_TRAINING_CATALOG = {
  worker: { id: 'worker', label: 'Worker', icon: '⟁', cost: 6, duration: 2.2 },
  marine: { id: 'marine', label: 'Marine', icon: 'Μ', cost: 10, duration: 2.8 },
  sniper: { id: 'sniper', label: 'Sniper', icon: 'Σ', cost: 14, duration: 3.3 },
  splayer: { id: 'splayer', label: 'Splayer', icon: 'Ψ', cost: 18, duration: 3.8 },
  laser: { id: 'laser', label: 'Piercing Laser', icon: 'Λ', cost: 16, duration: 3.1 },
};

/**
 * Worker cost escalation: first worker costs WORKER_BASE_COST; each subsequent
 * worker costs WORKER_COST_INCREMENT more.
 */
export const WORKER_BASE_COST = 2;
export const WORKER_COST_INCREMENT = 2;

/**
 * Ordered list of unit IDs available for the customizable toolbar slots.
 */
export const KUF_EQUIPPABLE_UNIT_IDS = ['marine', 'sniper', 'splayer', 'laser'];

/**
 * Default training slot configuration shown along the base toolbar.
 */
export const KUF_TRAINING_SLOTS = [
  { slotId: 'worker', unitId: 'worker', equipable: false },
  { slotId: 'slot-1', unitId: 'marine', equipable: true },
  { slotId: 'slot-2', unitId: 'sniper', equipable: true },
  { slotId: 'slot-3', unitId: 'splayer', equipable: true },
  { slotId: 'slot-4', unitId: 'laser', equipable: true },
];
