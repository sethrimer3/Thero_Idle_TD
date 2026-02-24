// μ tower (Mu) lays fractal mines on the track that charge up through tiers.
// Normal mode: Sierpinski triangle mines
// Prestige mode (Μ): Apollonian gasket circle mines

import {
  formatWholeNumber,
  formatDecimal,
  formatGameNumber,
} from '../../../scripts/core/formatting.js';
import { blueprintContext } from '../blueprintContext.js';

const ctx = () => blueprintContext;

export const mu = {
  mathSymbol: String.raw`\mu`,
  baseEquation: String.raw`\( \mu = \lambda \times (\text{tier} \times 10) \)`,
  variables: [
    {
      key: 'aleph1',
      symbol: 'atk',
      equationSymbol: 'ℵ₁',
      masterEquationSymbol: 'Lvl',
      name: 'Aleph₁ Tier',
      description: 'Maximum tier level that mines can charge to before arming.',
      baseValue: 1,
      step: 1,
      upgradable: true,
      format: (value) => {
        const normalized = Number.isFinite(value) ? value : 1;
        return `Tier ${formatWholeNumber(Math.max(1, normalized))}`;
      },
      cost: (level) => Math.max(1, Math.pow(2, level)),
      getSubEquations({ level, value }) {
        const fallback = 1 + (Number.isFinite(level) ? level : 0);
        const rawValue = Number.isFinite(value) ? value : fallback;
        const rounded = Math.round(rawValue);
        const resolved = Math.max(1, rounded);
        const lambdaRaw = ctx().calculateTowerEquationResult?.('lambda');
        const lambdaValue = Number.isFinite(lambdaRaw) ? Math.max(0, lambdaRaw) : 0;
        const tierDamage = resolved * 10;
        const attackRaw = lambdaValue * tierDamage;
        const attack = Number.isFinite(attackRaw) ? attackRaw : Number.MAX_SAFE_INTEGER;
        return [
          { expression: String.raw`\( atk = \lambda \times (\text{tier} \times 10) \)` },
          {
            values: String.raw`\( ${formatGameNumber(attack)} = ${formatGameNumber(lambdaValue)} \times (${formatWholeNumber(resolved)} \times 10) \)`,
            variant: 'values',
          },
          {
            expression: String.raw`\( \text{tier} = \max(1, \aleph_{1}) \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = \max(1, ${formatWholeNumber(rounded)}) \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'range',
      symbol: 'rng',
      equationSymbol: 'rng',
      masterEquationSymbol: 'Rng',
      name: 'Mine Radius',
      description: 'Fixed placement radius measured in meters.',
      baseValue: 3,
      upgradable: false,
      format: (value) => `${formatDecimal(Math.max(0, value || 0), 2)} m`,
      includeInMasterEquation: false,
      getSubEquations({ value }) {
        const resolved = Number.isFinite(value) ? Math.max(0, value) : 3;
        return [
          { expression: String.raw`\( \text{rng} = 3 \)` },
          {
            values: String.raw`\( ${formatDecimal(resolved, 2)} = 3 \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph2',
      symbol: 'max',
      equationSymbol: 'ℵ₂',
      masterEquationSymbol: 'Cap',
      name: 'Aleph₂ Capacity',
      description: 'Increases maximum number of mines that can exist simultaneously.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `+${formatWholeNumber(Math.max(0, value))} mines`,
      cost: (level) => Math.max(1, 5 + level * 3),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? Math.round(level) : 0);
        const rawValue = Number.isFinite(value) ? Math.round(value) : rank;
        const resolved = Math.max(0, rawValue);
        const totalMines = 5 + resolved;
        return [
          {
            expression: String.raw`\( \text{max} = 5 + \aleph_{2} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(totalMines)} = 5 + ${formatWholeNumber(resolved)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph3',
      symbol: 'spd',
      equationSymbol: 'ℵ₃',
      masterEquationSymbol: 'Gen',
      name: 'Aleph₃ Speed',
      description: 'Increases the rate at which new mines are placed on the track.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `${formatDecimal(0.5 + 0.1 * Math.max(0, value), 2)} mines/s`,
      cost: (level) => Math.max(1, 3 + level * 2),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? Math.round(level) : 0);
        const rawValue = Number.isFinite(value) ? value : rank;
        const resolved = Math.max(0, rawValue);
        const speed = 0.5 + 0.1 * resolved;
        return [
          {
            expression: String.raw`\( \text{spd} = 0.5 + 0.1 \times \aleph_{3} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(speed, 2)} = 0.5 + 0.1 \times ${formatWholeNumber(resolved)} \)`,
            variant: 'values',
          },
        ];
      },
    },
  ],
  computeResult(values) {
    // Damage calculation: atk = lambda * (tier * 10)
    const lambdaValue = ctx().calculateTowerEquationResult('lambda');
    const lambda = Number.isFinite(lambdaValue) ? Math.max(0, lambdaValue) : 0;
    const tier = Math.max(1, Number.isFinite(values.aleph1) ? Math.round(values.aleph1) : 1);
    return lambda * (tier * 10);
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const lambdaValue = ctx().calculateTowerEquationResult('lambda');
    const lambda = Number.isFinite(lambdaValue) ? Math.max(0, lambdaValue) : 0;
    const tier = Math.max(1, Number.isFinite(values.aleph1) ? Math.round(values.aleph1) : 1);
    const tierDamage = tier * 10;
    return `${formatComponent(result)} = ${formatComponent(lambda)} × ${formatComponent(tierDamage)}`;
  },
};
