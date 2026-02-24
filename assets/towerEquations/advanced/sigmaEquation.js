/**
 * σ tower blueprint capturing its damage storage and discharge math.
 *
 * stored    = Σ allyDamage (clamped at 1e120)
 * shot      = stored
 * stored'   = prestige ? stored : 0
 * absorbed  = Σ allyDamage lifetime
 */

import {
  formatGameNumber,
} from '../../../scripts/core/formatting.js';
import { blueprintContext } from '../blueprintContext.js';

const ctx = () => blueprintContext;

function resolveSigmaStat(dynamicContext, key) {
  const stats = dynamicContext?.stats || {};
  const rawValue = stats[key] ?? stats[`sigma${key.charAt(0).toUpperCase()}${key.slice(1)}`];
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return numeric;
}

function isPrestigeSigmaBlueprint(dynamicContext) {
  return dynamicContext?.prestige === true;
}

export const sigma = {
  mathSymbol: String.raw`\sigma`,
  baseEquation: String.raw`\( \sigma = \text{stored} \)`,
  variables: [
    {
      key: 'storedDamage',
      symbol: String.raw`\text{stored}`,
      equationSymbol: String.raw`\text{stored}`,
      masterEquationSymbol: 'Atk',
      name: 'Stored Damage',
      description: 'Damage currently banked from allied shots.',
      upgradable: false,
      includeInMasterEquation: true,
      format: (value) => `${formatGameNumber(Math.max(0, value || 0))} dmg`,
      computeValue({ dynamicContext }) {
        return resolveSigmaStat(dynamicContext, 'storedDamage');
      },
      getSubEquations({ value, dynamicContext, formatGameNumber: formatGame }) {
        const stored = Math.max(0, Number.isFinite(value) ? value : 0);
        const prestige = isPrestigeSigmaBlueprint(dynamicContext);
        const lastRelease = resolveSigmaStat(dynamicContext, 'lastRelease');
        const lines = [
          { expression: String.raw`\( \text{stored} = \sum \text{ally dmg} \)` },
          { expression: String.raw`\( \text{stored} \le 10^{120} \)` },
          {
            values: String.raw`\( ${formatGame(stored)}\,\text{dmg} \)`,
            variant: 'values',
          },
          { expression: String.raw`\( \text{shot}_{\sigma} = \text{stored} \)` },
          prestige
            ? { expression: String.raw`\( \text{stored}_{\text{next}} = \text{stored} \)` }
            : { expression: String.raw`\( \text{stored}_{\text{next}} = 0 \)` },
        ];
        if (lastRelease > 0) {
          lines.push({
            values: String.raw`\( \text{last shot} = ${formatGame(lastRelease)}\,\text{dmg} \)`,
            variant: 'values',
          });
        }
        return lines;
      },
    },
    {
      key: 'totalAbsorbed',
      symbol: String.raw`\text{absorbed}`,
      equationSymbol: String.raw`\text{absorbed}`,
      masterEquationSymbol: 'Abs',
      name: 'Lifetime Absorption',
      description: 'Cumulative damage σ has converted into stored energy.',
      upgradable: false,
      includeInMasterEquation: false,
      format: (value) => `${formatGameNumber(Math.max(0, value || 0))} dmg`,
      computeValue({ dynamicContext }) {
        return resolveSigmaStat(dynamicContext, 'totalAbsorbed');
      },
      getSubEquations({ value, formatGameNumber: formatGame }) {
        const absorbed = Math.max(0, Number.isFinite(value) ? value : 0);
        return [
          { expression: String.raw`\( \text{absorbed} = \sum \text{ally dmg} \)` },
          {
            values: String.raw`\( ${formatGame(absorbed)}\,\text{dmg} \)`,
            variant: 'values',
          },
          { expression: String.raw`\( \text{absorbed} \ge \text{stored} \)` },
        ];
      },
    },
  ],
  computeResult(values) {
    const stored = Math.max(0, Number.isFinite(values.storedDamage) ? values.storedDamage : 0);
    return stored;
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const stored = Math.max(0, Number.isFinite(values.storedDamage) ? values.storedDamage : 0);
    return `${formatComponent(result)} = ${formatComponent(stored)}`;
  },
};
