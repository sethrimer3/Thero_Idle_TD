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
 * Enumeration of supported number presentation modes for UI formatting.
 */
export const GAME_NUMBER_NOTATIONS = {
  LETTERS: 'letters',
  SCIENTIFIC: 'scientific',
};

/**
 * Tracks the active notation preference for large number formatting.
 */
let currentGameNumberNotation = GAME_NUMBER_NOTATIONS.LETTERS;

/**
 * Holds listener callbacks that react when the notation preference changes.
 */
const notationListeners = new Set();

/**
 * Updates the notation preference and notifies registered listeners.
 * @param {string} notation Requested notation identifier.
 * @returns {string} Resolved notation value after applying the change.
 */
export function setGameNumberNotation(notation) {
  const normalized = notation === GAME_NUMBER_NOTATIONS.SCIENTIFIC
    ? GAME_NUMBER_NOTATIONS.SCIENTIFIC
    : GAME_NUMBER_NOTATIONS.LETTERS;
  if (normalized === currentGameNumberNotation) {
    return currentGameNumberNotation;
  }
  currentGameNumberNotation = normalized;
  notationListeners.forEach((listener) => {
    if (typeof listener === 'function') {
      try {
        listener(currentGameNumberNotation);
      } catch (error) {
        console.warn('Notation listener failed', error);
      }
    }
  });
  return currentGameNumberNotation;
}

/**
 * Retrieves the currently active number notation preference.
 * @returns {string} Active notation identifier.
 */
export function getGameNumberNotation() {
  return currentGameNumberNotation;
}

/**
 * Registers a callback that fires whenever the notation preference changes.
 * @param {Function} listener Observer invoked with the new notation string.
 */
export function addGameNumberNotationChangeListener(listener) {
  if (typeof listener === 'function') {
    notationListeners.add(listener);
  }
}

/**
 * Removes a previously registered notation change listener.
 * @param {Function} listener Observer function to remove from the set.
 */
export function removeGameNumberNotationChangeListener(listener) {
  notationListeners.delete(listener);
}

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

  if (currentGameNumberNotation === GAME_NUMBER_NOTATIONS.SCIENTIFIC && absolute >= 1000) {
    const exponent = Math.floor(Math.log10(absolute));
    const mantissa = value / 10 ** exponent;
    const magnitude = Math.abs(mantissa);
    const precision = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : 2;
    const formattedMantissa = mantissa.toFixed(precision);
    return `${formattedMantissa} × 10^${exponent}`;
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
