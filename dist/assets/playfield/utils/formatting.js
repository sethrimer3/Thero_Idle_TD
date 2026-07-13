import { formatGameNumber } from '../../../scripts/core/formatting.js';

// Present combat-facing numbers with trimmed trailing zeros while respecting notation preferences.
export function formatCombatNumber(value) {
  const label = formatGameNumber(value);
  if (typeof label !== 'string') {
    return label;
  }
  const trimmedDecimals = label.replace(/(\.\d*?)(0+)(?=(?:\s| \u00d7|$))/g, (match, decimals) => {
    const stripped = decimals.replace(/0+$/, '');
    return stripped;
  });
  return trimmedDecimals.replace(/\.($|(?=\s)|(?= \u00d7))/g, '');
}
