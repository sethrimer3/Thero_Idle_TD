/**
 * Bet Spire particle physics static configuration.
 * All constants, data tables, and shared utility functions extracted from betSpireRender.js.
 * Follows the same companion-file pattern as kufSimulationConfig.js / powderTowerData.js.
 */

// Pre-calculated Math constants for performance optimization in render loops
export const PI = Math.PI;
export const TWO_PI = Math.PI * 2;
export const HALF_PI = Math.PI * 0.5;
export const QUARTER_PI = Math.PI * 0.25;
export const PI_OVER_SIX = Math.PI / 6;
export const DEG_TO_RAD = Math.PI / 180;
export const HALF = 0.5; // Pre-calculated reciprocal for multiplication instead of division by 2

// Canvas dimensions matching Aleph Spire render
export const CANVAS_WIDTH = 240;
export const CANVAS_HEIGHT = 320;

// Particle system configuration
export const TRAIL_FADE = 0.15; // Lower = longer trails
export const BASE_PARTICLE_SIZE = 0.75; // Base size for small particles (reduced from 1.5 to half size)
export const SIZE_MULTIPLIER = 2.5; // Each size tier is 2.5x bigger
export const EXTRA_LARGE_SIZE_BONUS = 1.5; // Extra-large particles are 50% larger than large.
export const MIN_VELOCITY = 0.312; // Minimum speed to keep particles swirling (30% faster: 0.24 * 1.3 = 0.312)
export const MAX_VELOCITY = 2;
export const ATTRACTION_STRENGTH = 1.5; // Increased to keep particles within field (was 0.5)
export const FORGE_RADIUS = 21; // Radius for forge attraction (30% smaller to tighten the forge well)
export const MAX_FORGE_ATTRACTION_DISTANCE = FORGE_RADIUS * 2 * 0.9; // Particles only feel forge gravity when within twice the forge radius (decreased by 10%)
export const DISTANCE_SCALE = 0.01; // Scale factor for distance calculations
export const FORCE_SCALE = 0.01; // Scale factor for force application
export const ORBITAL_FORCE = 0.15; // Increased tangential orbital force strength (was 0.1)
export const ORBITAL_RADIUS_MULTIPLIER = 2; // Multiplier for orbital effect radius
export const FORGE_REPULSION_DAMPING = 0.6; // Dampen outward push when particles slingshot past the forge
export const FORGE_ROTATION_SPEED = 0.01; // Rotation speed for forge triangles (50% slower base spin).
export const SPAWNER_GRAVITY_STRENGTH = 1.5; // Gentle attraction strength used by individual spawners.
export const SPAWNER_GRAVITY_RANGE_MULTIPLIER = 4; // Spawner gravity now reaches four times its radius for a wider pull
export const GENERATOR_CONVERSION_RADIUS = 16.5; // 10% larger radius for generator-centered conversions
export const SMALL_TIER_GENERATOR_GRAVITY_STRENGTH = 0.24; // Extremely gentle pull that nudges small particles toward their generator.
export const MEDIUM_TIER_FORGE_GRAVITY_STRENGTH = 0.15; // Extremely weak pull that guides medium particles toward the central forge.
export const PARTICLE_FACTOR_EXPONENT_INCREMENT = 1e-7; // Each nullstone small-equivalent crunch increases the particle factor exponent.

// Performance optimization configuration
export const MAX_PARTICLES = 2000; // Hard limit on total particle count to prevent freezing
export const PERFORMANCE_THRESHOLD = 1500; // Start aggressive merging above this count
export const MAX_FRAME_TIME_MS = 16; // Target 60fps, skip updates if frame takes longer
export const TARGET_FRAME_TIME_MS = 1000 / 60; // Normalize physics updates so taps don't change simulation speed
export const PERF_WARN_MIN_PARTICLES = 250; // Skip heavy-frame warnings for tiny swarms to avoid noisy false positives during tab resume.
export const PERF_WARN_COOLDOWN_MS = 5000; // Limit heavy-frame warnings to once per cooldown window for cleaner diagnostics.

// User interaction configuration
export const INTERACTION_RADIUS = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) / 10; // Doubled from /20 to /10
export const MOUSE_ATTRACTION_STRENGTH = 3.0;
export const INTERACTION_FADE_DURATION = 300; // milliseconds for circle fade
export const DRAG_RELEASE_STILLNESS_MS = 120; // Time threshold to consider the pointer held still before release.
export const DRAG_RELEASE_SPEED_THRESHOLD = 0.02; // Velocity threshold (px/ms) to treat the release as stationary.

// Merge animation configuration
export const MERGE_GATHER_SPEED = 10.0; // Faster gather speed so size merges keep up with higher spawn rates
export const MERGE_GATHER_THRESHOLD = 2; // Distance threshold to consider particles gathered (pixels)
export const MERGE_TIMEOUT_MS = 2000; // Maximum time for merge animation (milliseconds)
export const SHOCKWAVE_SPEED = 3.0; // Speed at which shockwave expands
export const SHOCKWAVE_MAX_RADIUS = 40; // Maximum shockwave radius
export const SHOCKWAVE_DURATION = 500; // milliseconds for shockwave animation
export const SHOCKWAVE_PUSH_FORCE = 2.5; // Force applied to nearby particles by shockwave
export const SHOCKWAVE_EDGE_THICKNESS = 10; // Thickness of shockwave edge for force application (pixels)

// Forge position at center of canvas (using HALF constant for optimization)
export const FORGE_POSITION = { x: CANVAS_WIDTH * HALF, y: CANVAS_HEIGHT * HALF };

// Particle spawner configuration (mini forges for each unlocked particle type)
export const SPAWNER_SIZE = 8.8; // Size of spawner forge triangles (10% larger than before)
export const SPAWNER_ROTATION_SPEED = 0.01; // Rotation speed for spawner triangles
export const SPAWNER_COLOR_BRIGHTNESS_OFFSET = 30; // RGB offset for spawner triangle color variation
export const SPAWNER_GRAVITY_RADIUS = SPAWNER_SIZE * SPAWNER_GRAVITY_RANGE_MULTIPLIER * 1.15; // Influence radius for each spawner (increased by 15%)
export const GENERATOR_SPRITE_SCALE = 1.75; // Increase generator sprites by 75% for better legibility.
export const SPAWNER_SPRITE_SIZE = SPAWNER_SIZE * 2.6 * GENERATOR_SPRITE_SCALE; // Scale generator sprites to match the previous triangle footprint.

// Particle veer behavior configuration (developer-toggleable).
export const VEER_ANGLE_MIN_DEG = 0.1; // Minimum veer angle in degrees.
export const VEER_ANGLE_MAX_DEG = 1; // Maximum veer angle in degrees.
export const VEER_INTERVAL_MIN_MS = 100; // Minimum interval between veer nudges in milliseconds.
export const VEER_INTERVAL_MAX_MS = 1000; // Maximum interval between veer nudges in milliseconds.

// Utility to generate a random number within an inclusive range.
export const getRandomInRange = (min, max) => min + Math.random() * (max - min);

// Utility to create a tinted sprite canvas from a monochrome base image.
export const createTintedSpriteCanvas = (sourceImage, color, size) => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const drawSize = size;

  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(sourceImage, 0, 0, drawSize, drawSize);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
  ctx.fillRect(0, 0, drawSize, drawSize);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(sourceImage, 0, 0, drawSize, drawSize);
  ctx.globalCompositeOperation = 'source-over';

  return canvas;
};

// Generator positions: sand at top center (12 o'clock), then 10 more in clockwise circle
// All 11 generators are equidistant from each other on a circle around the forge
export const GENERATOR_CIRCLE_RADIUS = Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.35; // Circle radius for generators
export const SPAWNER_POSITIONS = Array.from({ length: 11 }, (_, i) => {
  // Start at top (12 o'clock = -90 degrees), then proceed clockwise (using pre-calculated constants)
  const angle = -HALF_PI + (i * TWO_PI / 11);
  return {
    x: FORGE_POSITION.x + Math.cos(angle) * GENERATOR_CIRCLE_RADIUS,
    y: FORGE_POSITION.y + Math.sin(angle) * GENERATOR_CIRCLE_RADIUS
  };
});

// Particle tier definitions matching gem hierarchy
// Sand is the base tier (pale yellow like motes from tower of inspiration)
export const PARTICLE_TIERS = [
  {
    id: 'sand',
    name: 'Sand',
    color: { r: 255, g: 215, b: 100 }, // Pale yellow like motes
    glowColor: null, // No special glow
  },
  {
    id: 'quartz',
    name: 'Quartz',
    color: { r: 245, g: 240, b: 235 }, // Light beige/off-white
    glowColor: null,
  },
  {
    id: 'ruby',
    name: 'Ruby',
    color: { r: 220, g: 50, b: 50 }, // Red
    glowColor: null,
  },
  {
    id: 'sunstone',
    name: 'Sunstone',
    color: { r: 255, g: 140, b: 60 }, // Orange
    glowColor: null,
  },
  {
    id: 'citrine',
    name: 'Citrine',
    color: { r: 230, g: 200, b: 80 }, // Yellow
    glowColor: null,
  },
  {
    id: 'emerald',
    name: 'Emerald',
    color: { r: 80, g: 180, b: 100 }, // Green
    glowColor: null,
  },
  {
    id: 'sapphire',
    name: 'Sapphire',
    color: { r: 60, g: 120, b: 200 }, // Blue
    glowColor: null,
  },
  {
    id: 'iolite',
    name: 'Iolite',
    color: { r: 100, g: 100, b: 180 }, // Indigo
    glowColor: null,
  },
  {
    id: 'amethyst',
    name: 'Amethyst',
    color: { r: 180, g: 100, b: 200 }, // Purple
    glowColor: null,
  },
  {
    id: 'diamond',
    name: 'Diamond',
    color: { r: 240, g: 245, b: 250 }, // Bright white/cyan
    glowColor: null,
  },
  {
    id: 'nullstone',
    name: 'Nullstone',
    color: { r: 30, g: 30, b: 40 }, // Nearly black
    glowColor: { r: 150, g: 100, b: 200 }, // Purple glow
  },
];

// Size tiers: small, medium, large, extra-large.
export const SIZE_TIERS = ['small', 'medium', 'large', 'extra-large'];
export const SMALL_SIZE_INDEX = 0;
export const MEDIUM_SIZE_INDEX = 1;
export const LARGE_SIZE_INDEX = 2;
export const EXTRA_LARGE_SIZE_INDEX = 3;
export const MERGE_THRESHOLD = 100; // 100 particles merge into 1 of next size
export const SIZE_SMALL_EQUIVALENTS = [
  1,
  MERGE_THRESHOLD,
  Math.pow(MERGE_THRESHOLD, 2),
  Math.pow(MERGE_THRESHOLD, 3)
]; // Map size index to its small-particle equivalent for nullstone crunch gains.
export const SIZE_SCALE_MULTIPLIERS = [
  1.0,
  SIZE_MULTIPLIER,
  SIZE_MULTIPLIER * SIZE_MULTIPLIER,
  SIZE_MULTIPLIER * SIZE_MULTIPLIER * EXTRA_LARGE_SIZE_BONUS
]; // Match size tiers while keeping extra-large at +50% over large.
export const SIZE_MIN_VELOCITY_MODIFIERS = [1.0, 0.8, 0.64, 0.15]; // Extra-large keeps a low minimum drift speed.
export const SIZE_MAX_VELOCITY_MODIFIERS = [1.0, 0.85, 0.7, 1.6]; // Extra-large can reach high top speeds.
// Force modifiers scale how strongly particles respond to pulls; extra-large is intentionally sluggish.
export const SIZE_FORCE_MODIFIERS = [1.0, 0.85, 0.7, 0.12]; // Extra-large resists drag to feel heavy.
export const CONVERSION_SPREAD_VELOCITY = 3; // Velocity multiplier for spreading converted particles
