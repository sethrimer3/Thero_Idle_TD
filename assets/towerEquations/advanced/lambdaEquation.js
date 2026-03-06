import {
  formatWholeNumber,
  formatDecimal,
  formatGameNumber,
} from '../../../scripts/core/formatting.js';
import { blueprintContext } from '../blueprintContext.js';

const ctx = () => blueprintContext;

export const lambda = {
  mathSymbol: String.raw`\lambda`,
  baseEquation: String.raw`\( \lambda = \kappa \times N_{\text{eff}} \)`,
  variables: [
    {
      key: 'kappa',
      symbol: 'κ',
      masterEquationSymbol: 'Kap',
      name: 'Kappa Harmonic',
      description: 'Damage inherited from κ tripwires, acting as the beam baseline.',
      reference: 'kappa',
      upgradable: false,
      format: (value) => formatGameNumber(Math.max(0, value || 0)),
      lockedNote: 'Channel more κ energy to raise λ beam strength.',
      getSubEquations({ blueprint, towerId, value }) {
        const helpers = ctx();
        const effectiveBlueprint = blueprint || helpers.getTowerEquationBlueprint?.(towerId) || null;
        const kappaBase = Math.max(0, Number.isFinite(value) ? value : 0);
        const enemyWeightRaw = helpers.computeTowerVariableValue?.(towerId, 'enemyWeight', effectiveBlueprint);
        const enemyWeight = Number.isFinite(enemyWeightRaw) ? Math.max(1, enemyWeightRaw) : 1;
        const attackRaw = kappaBase * enemyWeight;
        const attack = Number.isFinite(attackRaw) ? attackRaw : Number.MAX_SAFE_INTEGER;
        return [
          { expression: String.raw`\( atk = \kappa \times N_{\text{eff}} \)` },
          {
            values: String.raw`\( ${formatGameNumber(attack)} = ${formatGameNumber(kappaBase)} \times ${formatDecimal(enemyWeight, 2)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'enemyWeight',
      symbol: String.raw`N_{\text{eff}}`,
      equationSymbol: String.raw`N_{\text{eff}}`,
      masterEquationSymbol: 'Eff',
      glyphLabel: 'ℵ₃',
      name: 'Effective Enemy Count',
      description: 'Aleph₃ tuning that counts each live enemy multiple times toward λ output.',
      baseValue: 1,
      upgradable: true,
      format: (value) => `×${formatDecimal(Math.max(1, value || 1), 2)}`,
      cost: (level) => {
        const normalized = Math.max(0, Math.floor(Number.isFinite(level) ? level : 0));
        return Math.max(2, 2 * 2 ** normalized);
      },
      computeValue({ blueprint, towerId }) {
        const state = ctx().ensureTowerUpgradeState(towerId, blueprint);
        const level = Math.max(0, state.variables?.enemyWeight?.level || 0);
        return 1 + level;
      },
      getSubEquations({ level }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const value = 1 + rank;
        return [
          {
            expression: String.raw`\( N_{\text{eff}} = 1 + L \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(value, 2)} = 1 + ${formatWholeNumber(rank)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'rangeMeters',
      symbol: 'm',
      equationSymbol: 'm',
      masterEquationSymbol: 'Rng',
      glyphLabel: 'ℵ₁',
      name: 'Beam Range',
      description: 'Maximum reach of the λ laser measured in meters.',
      baseValue: 8,
      step: 0.5,
      upgradable: true,
      format: (value) => `${formatDecimal(Math.max(0, value || 0), 2)} m`,
      cost: (level) => {
        const normalized = Math.max(0, Math.floor(Number.isFinite(level) ? level : 0));
        return Math.max(80, Math.round(120 * 1.45 ** normalized));
      },
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const meters = Number.isFinite(value) ? Math.max(0, value) : 8 + 0.5 * rank;
        return [
          {
            expression: String.raw`\( m = 8 + 0.5 \times L \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(meters, 2)} = 8 + 0.5 \times ${formatWholeNumber(rank)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'rate',
      symbol: 'Spd',
      equationSymbol: 'Spd',
      masterEquationSymbol: 'Spd',
      glyphLabel: 'ℵ₂',
      name: 'Pulse Rate',
      description: 'Laser firings per second that approach 0.5 via logarithmic Aleph₂ investment.',
      upgradable: true,
      format: (value) => `${formatDecimal(Math.max(0, value || 0), 3)} shots/s`,
      cost: (level) => {
        const normalized = Math.max(0, Math.floor(Number.isFinite(level) ? level : 0));
        return Math.max(120, Math.round(150 * 1.6 ** normalized));
      },
      computeValue({ blueprint, towerId }) {
        const state = ctx().ensureTowerUpgradeState(towerId, blueprint);
        const level = Math.max(0, state.variables?.rate?.level || 0);
        const logFactor = Math.log1p(level);
        const rate = 0.2 + 0.3 * (1 - 1 / (1 + logFactor));
        return Math.min(0.5, rate);
      },
      getSubEquations({ level }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const logFactor = Math.log1p(rank);
        const rate = 0.2 + 0.3 * (1 - 1 / (1 + logFactor));
        return [
          {
            expression: String.raw`\( \text{Spd} = 0.2 + 0.3\left(1 - \frac{1}{1 + \ln(1 + L)}\right) \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(Math.min(0.5, rate), 3)} = 0.2 + 0.3\left(1 - \frac{1}{1 + \ln(1 + ${formatWholeNumber(rank)})}\right) \)`,
            variant: 'values',
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const kappa = Number.isFinite(values.kappa) ? values.kappa : 0;
    const enemyWeight = Number.isFinite(values.enemyWeight) ? values.enemyWeight : 1;
    return kappa * enemyWeight;
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const kappa = Number.isFinite(values.kappa) ? values.kappa : 0;
    const enemyWeight = Number.isFinite(values.enemyWeight) ? values.enemyWeight : 1;
    const total = kappa * enemyWeight;
    return `${formatComponent(total)} = ${formatComponent(kappa)} × ${formatComponent(enemyWeight)}`;
  },
};
