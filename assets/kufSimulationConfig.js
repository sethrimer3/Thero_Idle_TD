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
