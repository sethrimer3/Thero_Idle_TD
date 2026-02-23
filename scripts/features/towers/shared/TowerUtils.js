/**
 * Shared utility functions for tower simulations (Phase 3.1.2 / 3.1.3).
 *
 * This module consolidates small helpers that were previously copy-pasted across
 * multiple individual tower files.  Extracting them here prevents drift between
 * implementations and keeps tower modules focused on their unique mechanics.
 *
 * Constants:
 *   - TWO_PI  – Math.PI * 2, avoids repeated multiplication in render loops
 *   - HALF_PI – Math.PI * 0.5, common angle offset constant
 *
 * Math / geometry helpers (Phase 3.1.2):
 *   - lerp     – linear interpolation
 *   - clamp    – numeric clamping used in physics and animation
 *   - easeInCubic  – cubic ease-in (t³) for smooth acceleration
 *   - easeOutCubic – cubic ease-out (1-(1-t)³) for smooth deceleration
 *   - distancePointToSegmentSquared – beam / laser hit detection
 *
 * Rendering helpers (Phase 3.1.3):
 *   - normalizeParticleColor – validate and clamp an RGB color object
 */

// Pre-calculated PI constants to avoid repeated Math.PI multiplications in render loops.
export const TWO_PI = Math.PI * 2;
export const HALF_PI = Math.PI * 0.5;

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
 * Cubic ease-in: acceleration from zero velocity.
 * Equivalent to t³. Produces a smooth ramp-up effect.
 * @param {number} t - Progress value in [0, 1].
 * @returns {number} Eased value.
 */
export function easeInCubic(t) {
  return t * t * t;
}

/**
 * Cubic ease-out: deceleration to zero velocity.
 * Equivalent to 1-(1-t)³. Produces a smooth ramp-down effect.
 * @param {number} t - Progress value in [0, 1].
 * @returns {number} Eased value.
 */
export function easeOutCubic(t) {
  const inverted = 1 - t;
  return 1 - inverted * inverted * inverted;
}

/**
 * Clamp a numeric value to the [min, max] range.
 * Returns `Math.min(Math.max(value, min), max)` with no additional overhead.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Compute the squared distance from point to the nearest location on the segment [start, end].
 * Returns Infinity when any argument is missing or the segment has zero length and the
 * point coordinates cannot be compared.
 *
 * @param {{x:number,y:number}} point  - The test point.
 * @param {{x:number,y:number}} start  - Segment start.
 * @param {{x:number,y:number}} end    - Segment end.
 * @returns {number} Squared distance from point to the closest segment position.
 */
export function distancePointToSegmentSquared(point, start, end) {
  if (!point || !start || !end) {
    return Infinity;
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (!dx && !dy) {
    const pdx = point.x - start.x;
    const pdy = point.y - start.y;
    return pdx * pdx + pdy * pdy;
  }
  const lengthSquared = dx * dx + dy * dy;
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  const clampedT = clamp(t, 0, 1);
  const projX = start.x + clampedT * dx;
  const projY = start.y + clampedT * dy;
  const offsetX = point.x - projX;
  const offsetY = point.y - projY;
  return offsetX * offsetX + offsetY * offsetY;
}

/**
 * Validate and clamp an RGB color object to integer values in [0, 255].
 * Returns null when the input is not a valid color object so callers can fall back
 * to a default palette safely.
 *
 * @param {{r:number,g:number,b:number}|null|undefined} color - Raw color descriptor.
 * @returns {{r:number,g:number,b:number}|null} Normalised color or null.
 */
export function normalizeParticleColor(color) {
  if (!color || typeof color !== 'object') {
    return null;
  }
  const { r, g, b } = color;
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return null;
  }
  return {
    r: Math.max(0, Math.min(255, Math.round(r))),
    g: Math.max(0, Math.min(255, Math.round(g))),
    b: Math.max(0, Math.min(255, Math.round(b))),
  };
}
