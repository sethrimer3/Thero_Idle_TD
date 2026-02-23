/**
 * Powder tower simulation static data and configuration constants.
 * This module contains cell-size settings, mote lane limits, and background
 * star configuration extracted from powderTower.js to improve maintainability.
 */

// Guarantee each mote lane cell remains legible on compact viewports.
export const MIN_MOTE_LANE_CELL_PX = 4;

export const POWDER_CELL_SIZE_PX = 1;
// Render and collide motes at their base cell footprint so each grain appears one-third the previous size.
export const MOTE_RENDER_SCALE = 1;
export const MOTE_COLLISION_SCALE = 1;

// Background star configuration constants for the powder basin starfield overlay.
export const MIN_STAR_SIZE = 0.5;
export const MAX_STAR_SIZE = 2.5;
export const STAR_MAX_SPEED = 0.0002;
export const GOLD_STAR_PROBABILITY = 0.3;
export const STAR_MIN_LIFETIME_SECONDS = 6;
export const STAR_MAX_LIFETIME_SECONDS = 12;
export const STAR_FADE_MIN_SECONDS = 1.25;
export const STAR_FADE_MAX_SECONDS = 2.4;

// Pre-calculate PI constants to avoid repeated Math.PI calculations in render loops.
export const TWO_PI = Math.PI * 2;

/**
 * Generate a uniformly-distributed random number in [min, max).
 * Clamps inputs so invalid ranges return the min value rather than NaN.
 * @param {number} min - Lower bound (inclusive).
 * @param {number} max - Upper bound (exclusive).
 * @returns {number} Random value in [min, max).
 */
export function randomInRange(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return min;
  }
  const clampedMin = Math.min(min, max);
  const clampedMax = Math.max(min, max);
  return clampedMin + Math.random() * (clampedMax - clampedMin);
}
