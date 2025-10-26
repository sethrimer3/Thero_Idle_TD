/**
 * Formatting helpers shared across UI components so numbers stay consistent.
 */

/**
 * Lookup for scientific suffixes when presenting large numbers to players.
 */
const numberSuffixes = [
  '',
  'K',
  'M',
  'B',
  'T',
  'Qa',
  'Qi',
  'Sx',
  'Sp',
  'Oc',
  'No',
  'Dc',
];

/**
 * Formats arbitrary values using the suffix table for readability.
 * @param {number} value Raw value sourced from gameplay stats.
 * @returns {string} Nicely formatted number string.
 */
export function formatGameNumber(value) {
  if (!Number.isFinite(value)) {
    return '0';
  }

  const absolute = Math.abs(value);
  if (absolute < 1) {
    return value.toFixed(2);
  }

  const tier = Math.min(
    Math.floor(Math.log10(absolute) / 3),
    numberSuffixes.length - 1,
  );
  const scaled = value / 10 ** (tier * 3);
  const precision = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  const formatted = scaled.toFixed(precision);
  const suffix = numberSuffixes[tier];
  return suffix ? `${formatted} ${suffix}` : formatted;
}

/**
 * Formats a value as a non-negative whole number with locale separators.
 * @param {number} value Raw value provided by the engine.
 * @returns {string} Whole number string safe for UI display.
 */
export function formatWholeNumber(value) {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return Math.round(Math.max(0, value)).toLocaleString('en-US');
}

/**
 * Formats floating point values with a predictable number of digits.
 * @param {number} value Number to display.
 * @param {number} digits Decimal precision to retain.
 * @returns {string} Decimal formatted string.
 */
export function formatDecimal(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return '0.00';
  }
  return value.toFixed(digits);
}

/**
 * Formats values as percentages while picking sensible precision automatically.
 * @param {number} value Ratio expressed as a unit interval.
 * @returns {string} Percentage text without sign enforcement.
 */
export function formatPercentage(value) {
  const percent = value * 100;
  const digits = Math.abs(percent) >= 10 ? 1 : 2;
  return `${percent.toFixed(digits)}%`;
}

/**
 * Formats values as signed percentages to communicate buffs/debuffs.
 * @param {number} value Ratio expressed as a unit interval.
 * @returns {string} Percentage text with a + or − sign.
 */
export function formatSignedPercentage(value) {
  const percent = value * 100;
  const digits = Math.abs(percent) >= 10 ? 1 : 2;
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(digits)}%`;
}
