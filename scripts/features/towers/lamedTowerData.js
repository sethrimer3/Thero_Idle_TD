/**
 * Lamed tower gravity simulation static data and configuration.
 * This module contains tier definitions, simulation constants, and utilities
 * extracted from lamedTower.js to improve maintainability.
 */

/**
 * Mass tier definitions for celestial body evolution.
 * Each tier has distinct visual properties.
 */
export const MASS_TIERS = [
  { name: 'Proto-star', threshold: 10, color: '#FF6B6B', glow: 0.3 },
  { name: 'Main Sequence', threshold: 100, color: '#FFD93D', glow: 0.5 },
  { name: 'Blue Giant', threshold: 5000, color: '#3EC8FF', glow: 0.7 },
  { name: 'Red Giant', threshold: 10000, color: '#FF8B94', glow: 0.85 },
  { name: 'Supergiant', threshold: 50000, color: '#FFA07A', glow: 1.0 },
  { name: 'Neutron Star', threshold: 1000000, color: '#B19CD9', glow: 1.2 },
  { name: 'Black Hole', threshold: 10000000, color: '#2D2D2D', glow: 1.5 },
];

/**
 * Diameter percentages for each mass tier so the sun scales with the viewport width.
 * These map directly to MASS_TIERS indices and represent the on-screen diameter fraction.
 */
export const TIER_DIAMETER_PERCENTAGES = [0.01, 0.05, 0.1, 0.15, 0.25, 0.1, 0.01];

/** Maximum relative diameter for the black hole tier so late-game cores can expand dramatically. */
export const BLACK_HOLE_MAX_DIAMETER_PERCENT = 0.5;

/** Duration of the collapse animation (in seconds) when transitioning to smaller tiers. */
export const COLLAPSE_ANIMATION_SECONDS = 10;

/** Minimum number of orbiting stars the render-cap slider can target. */
export const MIN_RENDERED_STARS = 1000;

/** Maximum number of orbiting stars that can be rendered simultaneously. */
export const MAX_RENDERED_STARS = 10000;

/** Cap how many stars are allowed to draw trails at any given time to protect performance. */
export const MAX_TRAIL_STARS = 50;

/** Maximum decorative dust particle population when no stars are present. */
export const MAX_DUST_PARTICLES = 200;

/**
 * Multiplier to scale star size relative to sun mass for better visibility.
 *
 * This multiplier makes orbiting stars visible by scaling them up relative to the sun.
 * For example, if the sun has mass 5000 and a star has mass 50:
 * - Without multiplier: star would be 1% the size of the sun (barely visible)
 * - With multiplier of 100: star is 100% the size of the sun (clearly visible)
 *
 * This multiplier applies to all orbiting stars rendered in the simulation.
 * It does not affect the sun's size or any UI elements.
 */
export const STAR_SIZE_MULTIPLIER = 100;

/**
 * Calculate a reduced star cap while honoring the minimum render floor.
 * @param {number} maxStars - Current maximum star count.
 * @returns {number} Reduced star cap, never below MIN_RENDERED_STARS.
 */
export function resolveReducedStarCap(maxStars) {
  return Math.max(MIN_RENDERED_STARS, Math.round(maxStars * 0.6));
}

/**
 * Deterministic pseudo-random number generator using seed.
 * Produces a repeatable sequence so simulation snapshots can be replayed.
 */
export class SeededRandom {
  constructor(seed = 12345) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }
}
