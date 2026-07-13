/**
 * ρ tower blueprint capturing its income-focused math.
 *
 * enemyThero = (1 + ℵ₁)                     // standard form
 * enemyThero = (1 + ℵ₁) × log10(unspentThero) // prestige (Ρ) form
 * rng = 3 + 0.2 × ℵ₂                        // standard range in meters
 * rng = 3 + 0.5 × ℵ₂                        // prestige range boost
 */

import {
  formatWholeNumber,
  formatDecimal,
  formatGameNumber,
} from '../../../scripts/core/formatting.js';
import { blueprintContext } from '../blueprintContext.js';

const ctx = () => blueprintContext;

function isPrestigeRho(context) {
  return context?.prestige === true;
}

function resolveRhoLevel(state, key) {
  if (!state || !state.variables || !state.variables[key]) {
    return 0;
  }
  const level = Number(state.variables[key].level);
  return Number.isFinite(level) && level > 0 ? level : 0;
}

function resolveUnspentThero(context) {
  const value = Number.isFinite(context?.unspentThero) ? context.unspentThero : null;
  return Math.max(1, value ?? 1);
}

export const rho = {
  mathSymbol: String.raw`\rho`,
  baseEquation: String.raw`\( \rho = \text{enemy}_{\text{þ}} \times \text{rng} \)`,
  variables: [
    {
      key: 'enemyThero',
      symbol: String.raw`\text{þ}_{\text{enemy}}`,
      equationSymbol: String.raw`\text{enemy}_{\text{þ}}`,
      masterEquationSymbol: 'Thero',
      name: 'Enemy Thero Yield',
      description: 'Additional thero gained when enemies collapse inside ρ\'s aura.',
      glyphLabel: 'ℵ₁',
      upgradable: true,
      format: (value) => `${formatDecimal(Math.max(0, value || 0), 3)}×`,
      cost: (level) => Math.max(2, 4 + level * 2),
      computeValue({ blueprint, towerId, dynamicContext }) {
        const helpers = ctx();
        const state = helpers.ensureTowerUpgradeState?.(towerId, blueprint);
        const rank = resolveRhoLevel(state, 'enemyThero');
        const baseComponent = 1 + rank;
        const prestigeActive = isPrestigeRho(dynamicContext);
        const unspentThero = resolveUnspentThero(dynamicContext);
        const prestigeMultiplier = prestigeActive ? Math.log10(unspentThero) : 1;
        const resolved = baseComponent * (Number.isFinite(prestigeMultiplier) ? Math.max(0, prestigeMultiplier) : 1);
        return Number.isFinite(resolved) ? resolved : baseComponent;
      },
      getSubEquations({ level, value, dynamicContext }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const baseComponent = 1 + rank;
        const prestigeActive = isPrestigeRho(dynamicContext);
        const unspentThero = resolveUnspentThero(dynamicContext);
        const prestigeTerm = prestigeActive ? Math.log10(unspentThero) : 1;
        const resolved = Number.isFinite(value) ? value : baseComponent * prestigeTerm;
        if (prestigeActive) {
          return [
            { expression: String.raw`\( \text{enemy}_{\text{þ}} = (1 + \aleph_{1}) \times \log_{10}(\text{unspent}_{\text{þ}}) \)` },
            {
              values: String.raw`\( ${formatDecimal(resolved, 3)} = ${formatDecimal(baseComponent, 3)} \times \log_{10}(${formatGameNumber(unspentThero)}) \)`,
              variant: 'values',
            },
          ];
        }
        return [
          { expression: String.raw`\( \text{enemy}_{\text{þ}} = 1 + \aleph_{1} \)` },
          {
            values: String.raw`\( ${formatDecimal(resolved, 3)} = 1 + ${formatWholeNumber(rank)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'rangeMeters',
      symbol: 'rng',
      equationSymbol: 'rng',
      masterEquationSymbol: 'Rng',
      name: 'Thero Radius',
      description: 'Meters of influence where ρ amplifies thero drops.',
      glyphLabel: 'ℵ₂',
      upgradable: true,
      format: (value) => `${formatDecimal(Math.max(0, value || 0), 2)} m`,
      cost: (level) => Math.max(2, 3 + level * 2),
      computeValue({ blueprint, towerId, dynamicContext }) {
        const helpers = ctx();
        const state = helpers.ensureTowerUpgradeState?.(towerId, blueprint);
        const rank = resolveRhoLevel(state, 'rangeMeters');
        const coefficient = isPrestigeRho(dynamicContext) ? 0.5 : 0.2;
        const resolved = 3 + coefficient * rank;
        return Number.isFinite(resolved) ? resolved : 3;
      },
      getSubEquations({ level, value, dynamicContext }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const coefficient = isPrestigeRho(dynamicContext) ? 0.5 : 0.2;
        const resolved = Number.isFinite(value) ? value : 3 + coefficient * rank;
        const coefficientLabel = formatDecimal(coefficient, 1);
        return [
          { expression: String.raw`\( \text{rng} = 3 + ${coefficientLabel} \times \aleph_{2} \)` },
          {
            values: String.raw`\( ${formatDecimal(resolved, 2)} = 3 + ${coefficientLabel} \times ${formatWholeNumber(rank)} \)`,
            variant: 'values',
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const enemyThero = Math.max(0, Number.isFinite(values.enemyThero) ? values.enemyThero : 0);
    const range = Math.max(0, Number.isFinite(values.rangeMeters) ? values.rangeMeters : 0);
    return enemyThero * range;
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const enemyThero = Math.max(0, Number.isFinite(values.enemyThero) ? values.enemyThero : 0);
    const range = Math.max(0, Number.isFinite(values.rangeMeters) ? values.rangeMeters : 0);
    return `${formatComponent(result)} = ${formatComponent(enemyThero)} × ${formatComponent(range)}`;
  },
};
