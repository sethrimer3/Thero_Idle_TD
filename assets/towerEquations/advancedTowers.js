/**
 * Advanced Tower Blueprints
 * 
 * Late-game towers: kappa, lambda, mu, nu, xi, omicron, pi.
 * These towers feature advanced mechanics and scaling for end-game progression.
 */

import {
  formatWholeNumber,
  formatDecimal,
  formatGameNumber,
} from '../../scripts/core/formatting.js';
import { blueprintContext } from './blueprintContext.js';

// Helper function accessor for cleaner code
const ctx = () => blueprintContext;

export const kappa = {
  mathSymbol: String.raw`\kappa`,
  baseEquation: String.raw`\( \kappa = \gamma \times \beta \times \alpha \)`,
  variables: [
    {
      key: 'gamma',
      symbol: 'γ',
      name: 'Gamma Harmonic',
      description: 'Inherited piercing lattice strength from γ.',
      reference: 'gamma',
      upgradable: false,
      format: (value) => formatGameNumber(Math.max(0, value || 0)),
      lockedNote: "Empower γ to raise κ's base output.",
    },
    {
      key: 'beta',
      symbol: 'β',
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

export const lambda = {
  mathSymbol: String.raw`\lambda`,
  baseEquation: String.raw`\( \lambda = \kappa \times N_{\text{eff}} \)`,
  variables: [
    {
      key: 'kappa',
      symbol: 'κ',
      name: 'Kappa Harmonic',
      description: 'Damage inherited from κ tripwires, acting as the beam baseline.',
      reference: 'kappa',
      upgradable: false,
      format: (value) => formatGameNumber(Math.max(0, value || 0)),
      lockedNote: 'Channel more κ energy to raise λ beam strength.',
    },
    {
      key: 'enemyWeight',
      symbol: String.raw`N_{\text{eff}}`,
      equationSymbol: String.raw`N_{\text{eff}}`,
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
// μ tower (Mu) lays fractal mines on the track that charge up through tiers.
// Normal mode: Sierpinski triangle mines
// Prestige mode (Μ): Apollonian gasket circle mines

export const mu = {
  mathSymbol: String.raw`\mu`,
  baseEquation: String.raw`\( \mu = \lambda \times (\text{tier} \times 10) \)`,
  variables: [
    {
      key: 'aleph1',
      symbol: 'ℵ₁',
      equationSymbol: 'ℵ₁',
      name: 'Aleph₁ Tier',
      description: 'Maximum tier level that mines can charge to before arming.',
      baseValue: 1,
      step: 1,
      upgradable: true,
      format: (value) => `Tier ${formatWholeNumber(Math.max(1, value))}`,
      cost: (level) => Math.max(1, Math.pow(2, level)),
      getSubEquations({ level, value }) {
        const rank = Math.max(1, Number.isFinite(level) ? 1 + level : 1);
        const resolved = Number.isFinite(value) ? Math.max(1, value) : rank;
        return [
          {
            expression: String.raw`\( \text{tier} = 1 + \aleph_{1} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = 1 + ${formatWholeNumber(level || 0)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph2',
      symbol: 'ℵ₂',
      equationSymbol: 'ℵ₂',
      name: 'Aleph₂ Capacity',
      description: 'Increases maximum number of mines that can exist simultaneously.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `+${formatWholeNumber(Math.max(0, value))} mines`,
      cost: (level) => Math.max(1, 5 + level * 3),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : rank;
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
      symbol: 'ℵ₃',
      equationSymbol: 'ℵ₃',
      name: 'Aleph₃ Speed',
      description: 'Increases the rate at which new mines are placed on the track.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `${formatDecimal(0.5 + 0.1 * Math.max(0, value), 2)} mines/s`,
      cost: (level) => Math.max(1, 3 + level * 2),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : rank;
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
    const lambda = Number.isFinite(lambdaValue) ? lambdaValue : 0;
    const tier = Math.max(1, Number.isFinite(values.aleph1) ? values.aleph1 : 1);
    return lambda * (tier * 10);
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const lambdaValue = ctx().calculateTowerEquationResult('lambda');
    const lambda = Number.isFinite(lambdaValue) ? lambdaValue : 0;
    const tier = Math.max(1, Number.isFinite(values.aleph1) ? values.aleph1 : 1);
    const tierDamage = tier * 10;
    return `${formatComponent(result)} = ${formatComponent(lambda)} × ${formatComponent(tierDamage)}`;
  },
};
// ζ tower channels a double-pendulum equation that references multiple Aleph
// upgrade threads to determine attack, speed, range, and pendulum count.

export const nu = {
  mathSymbol: String.raw`\nu`,
  baseEquation: String.raw`\( \nu = \gamma + \text{OKdmg}_{\text{tot}} \)`,
  variables: [
    {
      key: 'gamma',
      symbol: 'γ',
      name: 'Gamma Power',
      description: 'Base power sourced from γ tower upgrades.',
      reference: 'gamma',
      upgradable: false,
      lockedNote: 'Upgrade γ to increase ν base power.',
      format: (value) => formatDecimal(value, 2),
    },
    {
      key: 'overkillTotal',
      symbol: 'OKdmg',
      equationSymbol: String.raw`\text{OKdmg}_{\text{tot}}`,
      name: 'Overkill Total',
      description: 'Accumulated overkill damage from all kills.',
      baseValue: 0,
      upgradable: false,
      format: (value) => formatDecimal(value, 2),
    },
  ],
  computeResult(values) {
    const gammaValue = Math.max(0, Number.isFinite(values.gamma) ? values.gamma : 0);
    const overkill = Math.max(0, Number.isFinite(values.overkillTotal) ? values.overkillTotal : 0);
    return gammaValue + overkill;
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const gammaValue = Math.max(0, Number.isFinite(values.gamma) ? values.gamma : 0);
    const overkill = Math.max(0, Number.isFinite(values.overkillTotal) ? values.overkillTotal : 0);
    return `${formatComponent(result)} = ${formatComponent(gammaValue)} + ${formatComponent(overkill)}`;
  },
};

export const xi = {
  mathSymbol: String.raw`\xi`,
  baseEquation: String.raw`\( \xi = \nu \times (\text{numChain}^{\text{numChnExp}}) \)`,
  variables: [
    {
      key: 'nu',
      symbol: 'ν',
      name: 'Nu Power',
      description: 'Base damage per chain sourced from ν tower.',
      reference: 'nu',
      upgradable: false,
      lockedNote: 'Upgrade ν to increase ξ base damage.',
      format: (value) => formatDecimal(value, 2),
    },
    {
      key: 'aleph1',
      symbol: 'ℵ₁',
      equationSymbol: 'ℵ₁',
      name: 'Aleph₁ Speed',
      description: 'Increases attack speed for faster chain initiation.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `${formatDecimal(1 + 0.5 * Math.max(0, value), 2)} atk/s`,
      cost: (level) => Math.max(1, 2 + level * 2),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : rank;
        const speed = 1 + 0.5 * resolved;
        return [
          {
            expression: String.raw`\( \text{spd} = 1 + 0.5 \times \aleph_{1} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(speed, 2)} = 1 + 0.5 \times ${formatWholeNumber(resolved)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph2',
      symbol: 'ℵ₂',
      equationSymbol: 'ℵ₂',
      name: 'Aleph₂ Range',
      description: 'Extends initial targeting range in meters.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `${formatDecimal(5 + 0.5 * Math.max(0, value), 2)}m`,
      cost: (level) => Math.max(1, 3 + level * 2),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : rank;
        const range = 5 + 0.5 * resolved;
        return [
          {
            expression: String.raw`\( \text{rng} = 5 + 0.5 \times \aleph_{2} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(range, 2)} = 5 + 0.5 \times ${formatWholeNumber(resolved)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph3',
      symbol: 'ℵ₃',
      equationSymbol: 'ℵ₃',
      name: 'Aleph₃ Chain Range',
      description: 'Chain range for jumping between enemies in meters.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `${formatDecimal(1 + 0.1 * Math.max(0, value), 2)}m`,
      cost: (level) => Math.max(1, 2 + level),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : rank;
        const chainRange = 1 + 0.1 * resolved;
        return [
          {
            expression: String.raw`\( \text{chnRng} = 1 + 0.1 \times \aleph_{3} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(chainRange, 2)} = 1 + 0.1 \times ${formatWholeNumber(resolved)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph4',
      symbol: 'ℵ₄',
      equationSymbol: 'ℵ₄',
      name: 'Aleph₄ Max Chains',
      description: 'Maximum number of chain jumps per attack.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `${formatWholeNumber(3 + Math.max(0, value))} chains`,
      cost: (level) => Math.max(1, 5 + level * 4),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : rank;
        const maxChains = 3 + resolved;
        return [
          {
            expression: String.raw`\( \text{maxChn} = 3 + \aleph_{4} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(maxChains)} = 3 + ${formatWholeNumber(resolved)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph5',
      symbol: 'ℵ₅',
      equationSymbol: 'ℵ₅',
      name: 'Aleph₅ Chain Exponent',
      description: 'Exponential scaling factor for damage per chain.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `${formatDecimal(1 + 0.1 * Math.max(0, value), 2)}x exp`,
      cost: (level) => Math.max(1, 8 + level * 6),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : rank;
        const exponent = 1 + 0.1 * resolved;
        return [
          {
            expression: String.raw`\( \text{numChnExp} = 1 + 0.1 \times \aleph_{5} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(exponent, 2)} = 1 + 0.1 \times ${formatWholeNumber(resolved)} \)`,
            variant: 'values',
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const nuValue = Math.max(0, Number.isFinite(values.nu) ? values.nu : 0);
    const aleph5 = Math.max(0, Number.isFinite(values.aleph5) ? values.aleph5 : 0);
    const chainExponent = 1 + 0.1 * aleph5;
    // Result is base damage (nu) for 1 chain
    // Actual damage per chain is nu × (chainNumber^chainExponent)
    return nuValue;
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const nuValue = Math.max(0, Number.isFinite(values.nu) ? values.nu : 0);
    return `${formatComponent(result)} = ${formatComponent(nuValue)} × (\\text{chain}^{\\text{exp}})`;
  },
};

export const omicron = {
  mathSymbol: 'ο',
  baseEquation: String.raw`\( ο = \ln(ξ + 1) \)`,
  variables: [
    {
      key: 'xi',
      symbol: 'ξ',
      name: 'Xi Scarcity Flux',
      description: 'Stabilized phasor current inherited from ξ lattices.',
      reference: 'xi',
      upgradable: false,
      lockedNote: 'Tune ξ to channel energy into ο.',
      format: (value) => formatDecimal(value, 2),
    },
  ],
  computeResult(values) {
    const xiValue = Math.max(0, Number.isFinite(values.xi) ? values.xi : 0);
    return Math.log(xiValue + 1);
  },
  formatGoldenEquation({ formatVariable, formatResult }) {
    return `\\( ${formatResult()} = \\ln(${formatVariable('xi')} + 1) \\)`;
  },
};

export const pi = {
  mathSymbol: String.raw`\pi`,
  baseEquation: String.raw`\( \pi = \gamma^{\text{mrg}} \)`,
  variables: [
    {
      key: 'gamma',
      symbol: 'γ',
      name: 'Gamma Power',
      description: 'Base power sourced from γ tower upgrades.',
      reference: 'gamma',
      upgradable: false,
      lockedNote: 'Upgrade γ to increase π base power.',
      format: (value) => formatDecimal(value, 2),
    },
    {
      key: 'mergeCount',
      symbol: 'Mrg',
      equationSymbol: String.raw`\text{mrg}`,
      name: 'Merge Count',
      description: 'Number of times the rotating laser has merged with lock-on lasers.',
      baseValue: 0,
      upgradable: false,
      format: (value) => formatWholeNumber(value),
    },
    {
      key: 'aleph1',
      symbol: 'ℵ₁',
      equationSymbol: 'ℵ₁',
      name: 'Aleph₁ Range',
      description: 'Increases base range in meters.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `${formatDecimal(4 + 0.1 * Math.max(0, value), 2)}m`,
      cost: (level) => Math.max(1, 2 + level * 2),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : rank;
        const range = 4 + 0.1 * resolved;
        return [
          {
            expression: String.raw`\( \text{rng} = 4 + 0.1 \times \aleph_{1} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(range, 2)} = 4 + 0.1 \times ${formatWholeNumber(resolved)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph2',
      symbol: 'ℵ₂',
      equationSymbol: 'ℵ₂',
      name: 'Aleph₂ Range Inc',
      description: 'Amount of range the laser increases per merge in meters.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `${formatDecimal(0.1 * Math.max(0, value), 2)}m`,
      cost: (level) => Math.max(1, 3 + level * 2),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : rank;
        const rangeInc = 0.1 * resolved;
        return [
          {
            expression: String.raw`\( \text{rngInc} = 0.1 \times \aleph_{2} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(rangeInc, 2)} = 0.1 \times ${formatWholeNumber(resolved)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph3',
      symbol: 'ℵ₃',
      equationSymbol: 'ℵ₃',
      name: 'Aleph₃ Attack Speed',
      description: 'How fast the tower completes its full attack sequence in seconds.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `${formatDecimal(0.1 + 0.01 * Math.max(0, value), 2)}s`,
      cost: (level) => Math.max(1, 2 + level),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : rank;
        const atkSpd = 0.1 + 0.01 * resolved;
        return [
          {
            expression: String.raw`\( \text{atkSpd} = 0.1 + 0.01 \times \aleph_{3} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(atkSpd, 2)} = 0.1 + 0.01 \times ${formatWholeNumber(resolved)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph4',
      symbol: 'ℵ₄',
      equationSymbol: 'ℵ₄',
      name: 'Aleph₄ Laser Speed',
      description: 'How fast the laser completes its full rotation in seconds.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `${formatDecimal(Math.max(0.5, 5 - 0.1 * Math.max(0, value)), 2)}s`,
      cost: (level) => Math.max(1, 3 + level),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : rank;
        const lasSpd = Math.max(0.5, 5 - 0.1 * resolved);
        return [
          {
            expression: String.raw`\( \text{lasSpd} = 5 - 0.1 \times \aleph_{4} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(lasSpd, 2)} = 5 - 0.1 \times ${formatWholeNumber(resolved)} \)`,
            variant: 'values',
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const gammaValue = Math.max(1, Number.isFinite(values.gamma) ? values.gamma : 1);
    const mergeCount = Math.max(0, Number.isFinite(values.mergeCount) ? values.mergeCount : 0);
    // Clamp merge count to prevent overflow
    const clampedMerges = Math.min(50, mergeCount);
    return Math.pow(gammaValue, clampedMerges);
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const gammaValue = Math.max(1, Number.isFinite(values.gamma) ? values.gamma : 1);
    const mergeCount = Math.max(0, Number.isFinite(values.mergeCount) ? values.mergeCount : 0);
    return `${formatComponent(result)} = ${formatComponent(gammaValue)}^${formatComponent(mergeCount)}`;
  },
};
