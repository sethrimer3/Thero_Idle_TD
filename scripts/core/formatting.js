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
  ABC: 'abc',
};

/**
 * Track available number notations so preference toggles can validate input safely.
 */
const SUPPORTED_GAME_NUMBER_NOTATIONS = new Set(Object.values(GAME_NUMBER_NOTATIONS));

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
  const normalized = SUPPORTED_GAME_NUMBER_NOTATIONS.has(notation)
    ? notation
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

  const tier = Math.floor(Math.log10(absolute) / 3);

  if (currentGameNumberNotation === GAME_NUMBER_NOTATIONS.SCIENTIFIC && absolute >= 1000) {
    const exponent = Math.floor(Math.log10(absolute));
    const mantissa = value / 10 ** exponent;
    const magnitude = Math.abs(mantissa);
    const precision = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : 2;
    const formattedMantissa = mantissa.toFixed(precision);
    return `${formattedMantissa} × 10^${exponent}`;
  }

  const clampedLetterTier = Math.min(tier, numberSuffixes.length - 1);
  // Allow ABC notation to keep expanding while letter suffixes clamp to the lookup table.
  const scaledTier = currentGameNumberNotation === GAME_NUMBER_NOTATIONS.ABC
    ? tier
    : clampedLetterTier;
  const scaled = value / 10 ** (scaledTier * 3);
  const precision = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  const formatted = scaled.toFixed(precision);

  if (currentGameNumberNotation === GAME_NUMBER_NOTATIONS.ABC) {
    const abcSuffix = tier > 0 ? resolveAbcSuffix(tier) : '';
    return abcSuffix ? `${formatted} ${abcSuffix}` : formatted;
  }

  const suffix = numberSuffixes[clampedLetterTier];
  return suffix ? `${formatted} ${suffix}` : formatted;
}

/**
 * Generates the ABC notation suffix where every thousandth place advances the letter.
 * Thousands are tagged with "A", millions with "B", billions with "C", and so on.
 * @param {number} tier Magnitude group derived from log10(value) / 3 (1 => thousands).
 * @returns {string} Alphabetic suffix such as "A", "B", ... "AA" for large magnitudes.
 */
function resolveAbcSuffix(tier) {
  let suffix = '';
  let group = Math.max(0, tier);
  while (group > 0) {
    const remainder = (group - 1) % 26;
    suffix = String.fromCharCode('A'.charCodeAt(0) + remainder) + suffix;
    group = Math.floor((group - 1) / 26);
  }
  return suffix;
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
