/**
 * Houses the exponent based Beta lattice math so other modules can import the same
 * calculations without duplicating formulas.
 */

/**
 * Baseline constants chosen to keep the Beta progression stable.
 */
export const BETA_BASE_ATTACK = 10;
export const BETA_BASE_ATTACK_SPEED = 2;
export const BETA_BASE_RANGE = 0.36;

/**
 * Ensures the exponent can never drop below one or become `NaN`.
 * @param {number} value Exponent supplied by upgrade state.
 * @returns {number} Normalised exponent value.
 */
export function clampBetaExponent(value) {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, value);
}

/**
 * Computes the Beta attack power using the exponential growth rule.
 * @param {number} exponent Exponent pulled from the upgrade tree.
 * @returns {number} Attack power suitable for display and simulation.
 */
export function calculateBetaAttack(exponent) {
  const normalized = clampBetaExponent(exponent);
  const attack = BETA_BASE_ATTACK ** normalized;
  return Number.isFinite(attack) ? attack : Number.MAX_VALUE;
}

/**
 * Computes the Beta attack speed which slows as the exponent grows.
 * @param {number} exponent Exponent pulled from the upgrade tree.
 * @returns {number} Attacks per second for the beta beam.
 */
export function calculateBetaAttackSpeed(exponent) {
  const normalized = clampBetaExponent(exponent);
  const speed = BETA_BASE_ATTACK_SPEED / normalized;
  return Number.isFinite(speed) ? speed : 0;
}

/**
 * Computes the effective range for Beta beams which contracts with higher exponents.
 * @param {number} exponent Exponent pulled from the upgrade tree.
 * @returns {number} Range value used for placement logic.
 */
export function calculateBetaRange(exponent) {
  const normalized = clampBetaExponent(exponent);
  const range = BETA_BASE_RANGE / normalized;
  return Number.isFinite(range) ? range : 0;
}
