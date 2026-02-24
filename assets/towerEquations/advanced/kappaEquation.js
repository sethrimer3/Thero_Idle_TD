import {
  formatWholeNumber,
  formatDecimal,
  formatGameNumber,
} from '../../../scripts/core/formatting.js';
import { blueprintContext } from '../blueprintContext.js';

const ctx = () => blueprintContext;

export const kappa = {
  mathSymbol: String.raw`\kappa`,
  baseEquation: String.raw`\( \kappa = \gamma \times \beta \times \alpha \)`,
  variables: [
    {
      key: 'gamma',
      symbol: 'γ',
      masterEquationSymbol: 'Gam',
      name: 'Gamma Harmonic',
      description: 'Inherited piercing lattice strength from γ.',
      reference: 'gamma',
      upgradable: false,
      format: (value) => formatGameNumber(Math.max(0, value || 0)),
      lockedNote: "Empower γ to raise κ's base output.",
      getSubEquations() {
        const helpers = ctx();
        const gammaRaw =
          typeof helpers?.calculateTowerEquationResult === 'function'
            ? helpers.calculateTowerEquationResult('gamma')
            : 0;
        const betaRaw =
          typeof helpers?.calculateTowerEquationResult === 'function'
            ? helpers.calculateTowerEquationResult('beta')
            : 0;
        const alphaRaw =
          typeof helpers?.calculateTowerEquationResult === 'function'
            ? helpers.calculateTowerEquationResult('alpha')
            : 0;
        const gammaValue = Number.isFinite(gammaRaw) ? Math.max(0, gammaRaw) : 0;
        const betaValue = Number.isFinite(betaRaw) ? Math.max(0, betaRaw) : 0;
        const alphaValue = Number.isFinite(alphaRaw) ? Math.max(0, alphaRaw) : 0;
        const attackRaw = gammaValue * betaValue * alphaValue;
        const attack = Number.isFinite(attackRaw) ? attackRaw : Number.MAX_SAFE_INTEGER;
        return [
          { expression: String.raw`\( atk = \gamma \times \beta \times \alpha \)` },
          {
            values: String.raw`\( ${formatGameNumber(attack)} = ${formatGameNumber(gammaValue)} \times ${formatGameNumber(betaValue)} \times ${formatGameNumber(alphaValue)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'beta',
      symbol: 'β',
      masterEquationSymbol: 'Bet',
      name: 'Beta Resonance',
      description: 'Resonant damage carried forward from β beams.',
      reference: 'beta',
      upgradable: false,
      format: (value) => formatGameNumber(Math.max(0, value || 0)),
      lockedNote: 'Channel β energy to multiply κ tripwires.',
    },
    {
      key: 'alpha',
      symbol: 'α',
      masterEquationSymbol: 'Alp',
      name: 'Alpha Pulse',
      description: 'Foundational projectile power inherited from α.',
      reference: 'alpha',
      upgradable: false,
      format: (value) => formatGameNumber(Math.max(0, value || 0)),
      lockedNote: "Bolster α to raise κ's baseline.",
    },
    {
      key: 'chargeRate',
      symbol: 'τ⁻¹',
      equationSymbol: 'Charge Rate',
      name: 'Charge Rate',
      description: 'Tripwire amplitude growth per second.',
      baseValue: 0.16,
      step: 0.025,
      upgradable: true,
      includeInMasterEquation: false,
      format: (value) => `${formatDecimal(Math.max(0, value || 0), 2)} /s`,
      cost: (level) => {
        const normalized = Math.max(0, Math.floor(Number.isFinite(level) ? level : 0));
        return Math.max(15, Math.round(60 * 1.55 ** normalized));
      },
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? Math.floor(level) : 0);
        const rate = Number.isFinite(value) ? Math.max(0, value) : 0.16 + 0.025 * rank;
        const period = rate > 0 ? 1 / rate : Infinity;
        return [
          {
            expression: String.raw`\( \tau^{-1} = 0.16 + 0.025 \times L \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(rate, 3)} = 0.16 + 0.025 \times ${formatWholeNumber(rank)} \)`,
            variant: 'values',
          },
          {
            expression: String.raw`\( T_{\text{full}} = 1 / \tau^{-1} \)`,
          },
          {
            values: Number.isFinite(period)
              ? String.raw`\( ${formatDecimal(period, 2)}\,\text{s} = 1 / ${formatDecimal(rate, 3)} \)`
              : String.raw`\( T_{\text{full}} = \infty \)` ,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'rangeMeters',
      symbol: 'm',
      equationSymbol: 'Range',
      name: 'Tripwire Reach',
      description: 'Effective radius where κ auto-binds allied towers.',
      baseValue: 2,
      step: 0.4,
      upgradable: true,
      includeInMasterEquation: false,
      format: (value) => `${formatDecimal(Math.max(0, value || 0), 2)} m`,
      cost: (level) => {
        const normalized = Math.max(0, Math.floor(Number.isFinite(level) ? level : 0));
        return Math.max(20, Math.round(45 * (normalized + 1) ** 2));
      },
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? Math.floor(level) : 0);
        const reach = Number.isFinite(value) ? Math.max(0, value) : 2 + 0.4 * rank;
        return [
          {
            expression: String.raw`\( m = 2 + 0.4 \times L \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(reach, 2)} = 2 + 0.4 \times ${formatWholeNumber(rank)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'amplitudeMultiplier',
      symbol: 'Amp',
      equationSymbol: 'Amp',
      name: 'Amplitude Multiplier',
      description: 'Damage multiplier applied at maximum wave amplitude.',
      baseValue: 5,
      step: 0.75,
      upgradable: true,
      includeInMasterEquation: false,
      format: (value) => `${formatDecimal(Math.max(0, value || 0), 2)}×`,
      cost: (level) => {
        const normalized = Math.max(0, Math.floor(Number.isFinite(level) ? level : 0));
        return Math.max(30, Math.round(80 * 1.7 ** normalized));
      },
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? Math.floor(level) : 0);
        const multiplier = Number.isFinite(value) ? Math.max(0, value) : 5 + 0.75 * rank;
        return [
          {
            expression: String.raw`\( \text{Amp} = 5 + 0.75 \times L \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(multiplier, 2)} = 5 + 0.75 \times ${formatWholeNumber(rank)} \)`,
            variant: 'values',
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const gamma = Number.isFinite(values.gamma) ? values.gamma : 0;
    const beta = Number.isFinite(values.beta) ? values.beta : 0;
    const alpha = Number.isFinite(values.alpha) ? values.alpha : 0;
    return gamma * beta * alpha;
  },
  formatBaseEquationValues({ values, formatComponent }) {
    const gamma = Number.isFinite(values.gamma) ? values.gamma : 0;
    const beta = Number.isFinite(values.beta) ? values.beta : 0;
    const alpha = Number.isFinite(values.alpha) ? values.alpha : 0;
    const result = gamma * beta * alpha;
    return `${formatComponent(result)} = ${formatComponent(gamma)} × ${formatComponent(beta)} × ${formatComponent(alpha)}`;
  },
};
