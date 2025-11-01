// Formatting utility functions for playfield display
import { formatGameNumber } from '../../../scripts/core/formatting.js';

// Present combat-facing numbers with trimmed trailing zeros while respecting notation preferences.
export function formatCombatNumber(value) {
  const label = formatGameNumber(value);
  if (typeof label !== 'string') {
    return label;
  }
  const trimmedDecimals = label.replace(/(\.\d*?)(0+)(?=(?:\s| ?|$))/g, (match, decimals) => {
    const stripped = decimals.replace(/0+$/, '');
    return stripped;
  });
  return trimmedDecimals.replace(/\.($|(?=\s)|(?= ?))/g, '');
}

// Format speed multiplier for display
export function formatSpeedMultiplier(value) {
  if (Number.isInteger(value)) {
    return String(value);
  }
  const formatted = value.toFixed(1);
  return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
}
