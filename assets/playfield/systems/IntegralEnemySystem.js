// Integral Enemy scaffold.
// An enemy whose damage resistance decreases as it progresses along the path.
// Near the start: very resistant. Near the end: fully vulnerable.
//
// Conceptually, the enemy "accumulates exposure" like an integral over the path,
// becoming easier to damage the further it travels.
//
// damageTakenMultiplier = clamp(progress^INTEGRAL_CURVE_POWER, INTEGRAL_MIN_MULTIPLIER, 1)

// ─── Tuning constants ─────────────────────────────────────────────────────────
// Minimum damage multiplier at the very start of the path.
export const INTEGRAL_MIN_MULTIPLIER = 0.05;
// Exponent shaping the resistance curve (1 = linear, <1 = faster ramp, >1 = slower ramp).
export const INTEGRAL_CURVE_POWER = 0.8;

/**
 * Compute the damage multiplier for an integral enemy based on its path progress.
 * @param {number} progress - normalised path progress (0 at start, 1 at end)
 * @returns {number} damage multiplier (INTEGRAL_MIN_MULTIPLIER to 1)
 */
export function computeIntegralDamageMultiplier(progress) {
  const clampedProgress = Math.max(0, Math.min(1, progress || 0));
  const raw = Math.pow(clampedProgress, INTEGRAL_CURVE_POWER);
  return Math.max(INTEGRAL_MIN_MULTIPLIER, Math.min(1, raw));
}
