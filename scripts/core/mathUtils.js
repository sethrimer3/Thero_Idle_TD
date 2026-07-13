// Shared math utility functions for the Thero Idle game.
// Consolidates helpers that were previously duplicated across tower, terrarium,
// and renderer modules.  See docs/JAVASCRIPT_MODULE_SYSTEM.md §Shared Utility Patterns.

/**
 * Clamp a numeric value to the [min, max] range.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Clamp with a NaN / Infinity guard – returns min for non-finite inputs.
 * Preferred in rendering paths where upstream computation may produce NaN.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clampSafe(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

/**
 * Linearly interpolate between two values without clamping t.
 * @param {number} a - Start value.
 * @param {number} b - End value.
 * @param {number} t - Blend factor.
 * @returns {number} Interpolated value.
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Generate a random float within the provided range [min, max).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
