/**
 * Advanced Tower Blueprints
 * 
 * Late-game towers: kappa, lambda, mu, nu, xi, omicron, pi, rho, sigma, tau, upsilon.
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
      symbol: 'ℵ₂',
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
      symbol: 'ℵ₃',
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
// ζ tower channels a double-pendulum equation that references multiple Aleph
// upgrade threads to determine attack, speed, range, and pendulum count.

export const nu = {
  mathSymbol: String.raw`\nu`,
  baseEquation: String.raw`\( \nu = \gamma + \text{OKdmg}_{\text{tot}} \)`,
  variables: [
    {
      key: 'gamma',
      symbol: 'γ',
      masterEquationSymbol: 'Gam',
      name: 'Gamma Power',
      description: 'Base power sourced from γ tower upgrades.',
      reference: 'gamma',
      upgradable: false,
      lockedNote: 'Upgrade γ to increase ν base power.',
      format: (value) => formatDecimal(value, 2),
      getSubEquations({ blueprint, towerId, value }) {
        const helpers = ctx();
        const effectiveBlueprint = blueprint || helpers.getTowerEquationBlueprint?.(towerId) || null;
        const gammaValue = Math.max(0, Number.isFinite(value) ? value : 0);
        const overkillRaw = helpers.computeTowerVariableValue?.(towerId, 'overkillTotal', effectiveBlueprint);
        const overkill = Number.isFinite(overkillRaw) ? Math.max(0, overkillRaw) : 0;
        const attack = gammaValue + overkill;
        return [
          { expression: String.raw`\( atk = \gamma + \text{OKdmg}_{\text{tot}} \)` },
          {
            values: String.raw`\( ${formatGameNumber(attack)} = ${formatGameNumber(gammaValue)} + ${formatGameNumber(overkill)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'overkillTotal',
      symbol: 'OKdmg',
      equationSymbol: String.raw`\text{OKdmg}_{\text{tot}}`,
      masterEquationSymbol: 'Ovr',
      name: 'Overkill Total',
      description: 'Accumulated overkill damage from all kills.',
      baseValue: 0,
      upgradable: false,
      format: (value) => formatDecimal(value, 2),
      computeValue({ dynamicContext }) {
        const overkill = dynamicContext?.stats?.nuOverkillTotal;
        return Number.isFinite(overkill) ? Math.max(0, overkill) : 0;
      },
      getSubEquations({ dynamicContext, value }) {
        const tracked = Number.isFinite(value) ? Math.max(0, value) : 0;
        const kills = Number.isFinite(dynamicContext?.stats?.nuKills)
          ? Math.max(0, dynamicContext.stats.nuKills)
          : 0;
        return [
          { expression: String.raw`\( \text{OKdmg}_{\text{tot}} = \sum (\text{dmg}_{\text{final}} - \text{hp}_{\text{remaining}}) \)` },
          {
            values: String.raw`\( ${formatDecimal(tracked, 2)} = \text{Overkill across } ${formatWholeNumber(kills)} \text{ kills} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'kills',
      symbol: 'kills',
      equationSymbol: String.raw`\text{kills}`,
      masterEquationSymbol: 'Kil',
      name: 'Kill Count',
      description: 'Total enemies finished by ν beams.',
      baseValue: 0,
      upgradable: false,
      format: (value) => formatWholeNumber(Math.max(0, value || 0)),
      computeValue({ dynamicContext }) {
        const kills = dynamicContext?.stats?.nuKills;
        return Number.isFinite(kills) ? Math.max(0, kills) : 0;
      },
      getSubEquations({ value }) {
        const resolvedKills = Number.isFinite(value) ? Math.max(0, value) : 0;
        return [
          { expression: String.raw`\( \text{kills} = \sum \text{final blows} \)` },
          {
            values: String.raw`\( ${formatWholeNumber(resolvedKills)} = \text{Enemies defeated by } \nu \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'attackSpeed',
      symbol: 'spd',
      equationSymbol: String.raw`\text{spd}`,
      masterEquationSymbol: 'Spd',
      name: 'Attack Speed',
      description: 'Beam firings per second driven by kill count.',
      baseValue: 1,
      upgradable: false,
      format: (value) => `${formatDecimal(Math.max(0, value || 0), 2)} \text{ atk/s}`,
      computeValue({ dynamicContext }) {
        const kills = Number.isFinite(dynamicContext?.stats?.nuKills)
          ? Math.max(0, dynamicContext.stats.nuKills)
          : 0;
        return 1 + 0.1 * kills;
      },
      getSubEquations({ dynamicContext, value }) {
        const kills = Number.isFinite(dynamicContext?.stats?.nuKills)
          ? Math.max(0, dynamicContext.stats.nuKills)
          : 0;
        const speed = Number.isFinite(value) ? Math.max(0, value) : 1 + 0.1 * kills;
        return [
          { expression: String.raw`\( \text{spd} = 1 + 0.1 \times \text{kills} \)` },
          {
            values: String.raw`\( ${formatDecimal(speed, 2)} = 1 + 0.1 \times ${formatWholeNumber(kills)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'rangeMeters',
      symbol: 'rng',
      equationSymbol: String.raw`\text{rng}`,
      masterEquationSymbol: 'Rng',
      name: 'Range (m)',
      description: 'Beam reach in meters scaling with kills.',
      baseValue: 3,
      upgradable: false,
      format: (value) => `${formatDecimal(Math.max(0, value || 0), 2)} \text{ m}`,
      computeValue({ dynamicContext }) {
        const kills = Number.isFinite(dynamicContext?.stats?.nuKills)
          ? Math.max(0, dynamicContext.stats.nuKills)
          : 0;
        return 3 + 0.05 * kills;
      },
      getSubEquations({ dynamicContext, value }) {
        const kills = Number.isFinite(dynamicContext?.stats?.nuKills)
          ? Math.max(0, dynamicContext.stats.nuKills)
          : 0;
        const rangeMeters = Number.isFinite(value) ? Math.max(0, value) : 3 + 0.05 * kills;
        return [
          { expression: String.raw`\( \text{rng} = 3 + 0.05 \times \text{kills} \)` },
          {
            values: String.raw`\( ${formatDecimal(rangeMeters, 2)} = 3 + 0.05 \times ${formatWholeNumber(kills)} \)`,
            variant: 'values',
          },
        ];
      },
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
      masterEquationSymbol: 'Nu',
      name: 'Nu Power',
      description: 'Base damage per chain sourced from ν tower.',
      reference: 'nu',
      upgradable: false,
      lockedNote: 'Upgrade ν to increase ξ base damage.',
      format: (value) => formatDecimal(value, 2),
      getSubEquations({ blueprint, towerId, value }) {
        const helpers = ctx();
        const effectiveBlueprint = blueprint || helpers.getTowerEquationBlueprint?.(towerId) || null;
        const nuBase = Math.max(0, Number.isFinite(value) ? value : 0);
        const chainsRaw = helpers.computeTowerVariableValue?.(towerId, 'aleph4', effectiveBlueprint);
        const chains = 3 + Math.max(0, Number.isFinite(chainsRaw) ? Math.round(chainsRaw) : 0);
        const exponentRaw = helpers.computeTowerVariableValue?.(towerId, 'aleph5', effectiveBlueprint);
        const exponent = 1 + 0.1 * Math.max(0, Number.isFinite(exponentRaw) ? exponentRaw : 0);
        const attackRaw = nuBase * Math.pow(chains, exponent);
        const attack = Number.isFinite(attackRaw) ? attackRaw : Number.MAX_SAFE_INTEGER;
        return [
          {
            expression: String.raw`\( atk = \nu \times (\text{numChain}^{\text{numChnExp}}) \)`,
          },
          {
            values: String.raw`\( ${formatGameNumber(attack)} = ${formatGameNumber(nuBase)} \times ${formatWholeNumber(chains)}^{${formatDecimal(exponent, 2)}} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph1',
      symbol: 'ℵ₁',
      equationSymbol: 'ℵ₁',
      masterEquationSymbol: 'Spd',
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
      masterEquationSymbol: 'Rng',
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
      masterEquationSymbol: 'Chn',
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
      masterEquationSymbol: 'Max',
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
      masterEquationSymbol: 'Exp',
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
      masterEquationSymbol: 'Xi',
      name: 'Xi Scarcity Flux',
      description: 'Stabilized phasor current inherited from ξ lattices.',
      reference: 'xi',
      upgradable: false,
      lockedNote: 'Tune ξ to channel energy into ο.',
      format: (value) => formatDecimal(value, 2),
      getSubEquations({ value }) {
        const xiValue = Math.max(0, Number.isFinite(value) ? value : 0);
        const attackRaw = Math.log(xiValue + 1);
        const attack = Number.isFinite(attackRaw) ? attackRaw : 0;
        return [
          { expression: String.raw`\( atk = \ln(\xi + 1) \)` },
          {
            values: String.raw`\( ${formatDecimal(attack, 3)} = \ln(${formatGameNumber(xiValue)} + 1) \)`,
            variant: 'values',
          },
        ];
      },
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
      masterEquationSymbol: 'Gam',
      name: 'Gamma Power',
      description: 'Base power sourced from γ tower upgrades.',
      reference: 'gamma',
      upgradable: false,
      lockedNote: 'Upgrade γ to increase π base power.',
      format: (value) => formatDecimal(value, 2),
      getSubEquations({ blueprint, towerId, value }) {
        const helpers = ctx();
        const effectiveBlueprint = blueprint || helpers.getTowerEquationBlueprint?.(towerId) || null;
        const gammaValue = Math.max(1, Number.isFinite(value) ? value : 1);
        const mergesRaw = helpers.computeTowerVariableValue?.(towerId, 'mergeCount', effectiveBlueprint);
        const merges = Math.min(50, Math.max(0, Number.isFinite(mergesRaw) ? mergesRaw : 0));
        const attackRaw = Math.pow(gammaValue, merges);
        const attack = Number.isFinite(attackRaw) ? attackRaw : Number.MAX_SAFE_INTEGER;
        return [
          { expression: String.raw`\( atk = \gamma^{\text{mrg}} \)` },
          {
            values: String.raw`\( ${formatGameNumber(attack)} = ${formatGameNumber(gammaValue)}^{${formatWholeNumber(merges)}} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'mergeCount',
      symbol: 'Mrg',
      equationSymbol: String.raw`\text{mrg}`,
      masterEquationSymbol: 'Mrg',
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
      masterEquationSymbol: 'Rng',
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
      masterEquationSymbol: 'Inc',
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
      masterEquationSymbol: 'Atk',
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
      masterEquationSymbol: 'Rot',
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

/**
 * ρ tower blueprint capturing its income-focused math.
 *
 * enemyThero = (1 + ℵ₁)                     // standard form
 * enemyThero = (1 + ℵ₁) × log10(unspentThero) // prestige (Ρ) form
 * rng = 3 + 0.2 × ℵ₂                        // standard range in meters
 * rng = 3 + 0.5 × ℵ₂                        // prestige range boost
 */
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

/**
 * σ tower blueprint capturing its damage storage and discharge math.
 *
 * stored    = Σ allyDamage (clamped at 1e120)
 * shot      = stored
 * stored'   = prestige ? stored : 0
 * absorbed  = Σ allyDamage lifetime
 */
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

export const tau = {
  mathSymbol: String.raw`\tau`,
  baseEquation: String.raw`\( \tau = \text{atk} \times p \)`,
  variables: [
    {
      key: 'attack',
      symbol: String.raw`\text{atk}`,
      equationSymbol: String.raw`\text{atk}`,
      masterEquationSymbol: 'Atk',
      name: 'Spiral Damage',
      description: 'Base damage carried by each spiral hit.',
      upgradable: false,
      includeInMasterEquation: true,
      format: (value) => `${formatGameNumber(Math.max(0, value || 0))} dmg`,
      getSubEquations() {
        const helpers = ctx();
        const gammaValue = Math.max(
          0,
          Number.isFinite(helpers?.calculateTowerEquationResult?.('gamma'))
            ? helpers.calculateTowerEquationResult('gamma')
            : 0,
        );
        return [
          { expression: String.raw`\( \text{atk} = \gamma \)` },
          { values: String.raw`\( ${formatGameNumber(gammaValue)} = \gamma \)` },
        ];
      },
      computeValue() {
        const helpers = ctx();
        const gammaValue = helpers?.calculateTowerEquationResult?.('gamma');
        return Math.max(0, Number.isFinite(gammaValue) ? gammaValue : 0);
      },
    },
    {
      key: 'aleph1',
      symbol: String.raw`\aleph_{1}`,
      equationSymbol: String.raw`R_{\max}`,
      glyphLabel: 'ℵ₁',
      name: 'Spiral Radius',
      description: 'Maximum spiral reach in meters (R_max = 1 + ℵ₁).',
      baseValue: 0,
      step: 0.5,
      upgradable: true,
      includeInMasterEquation: false,
      format: (value) => `${formatDecimal(1 + value, 1)} m`,
      getSubEquations({ value }) {
        const bonus = Math.max(0, value || 0);
        return [
          { expression: String.raw`\( R_{\max} = 1 + \aleph_{1} \)` },
          { values: String.raw`\( ${formatDecimal(1 + bonus, 2)} = 1 + ${formatDecimal(bonus, 2)} \)` },
        ];
      },
    },
    {
      key: 'aleph2',
      symbol: String.raw`\aleph_{2}`,
      equationSymbol: String.raw`\text{spd}`,
      glyphLabel: 'ℵ₂',
      name: 'Spiral Speed',
      description: 'Attack cadence and path playback speed (spd = 1 + 0.1ℵ₂).',
      baseValue: 0,
      step: 1,
      upgradable: true,
      includeInMasterEquation: false,
      format: (value) => `${formatDecimal(1 + 0.1 * value, 2)} spd`,
      getSubEquations({ value }) {
        const bonus = Math.max(0, value || 0);
        return [
          { expression: String.raw`\( \text{spd} = 1 + 0.1\,\aleph_{2} \)` },
          {
            values: String.raw`\( ${formatDecimal(1 + 0.1 * bonus, 2)} = 1 + 0.1 \times ${formatWholeNumber(bonus)} \)` },
        ];
      },
    },
    {
      key: 'aleph3',
      symbol: String.raw`\aleph_{3}`,
      equationSymbol: String.raw`p`,
      glyphLabel: 'ℵ₃',
      name: 'Internal Particles',
      description: 'Hit charges stored within each spiral (p = 1 + ℵ₃).',
      baseValue: 0,
      step: 1,
      upgradable: true,
      includeInMasterEquation: true,
      format: (value) => `${formatWholeNumber(1 + value)} particles`,
      getSubEquations({ value }) {
        const particles = Math.max(1, 1 + Math.floor(value || 0));
        return [
          { expression: String.raw`\( p = 1 + \aleph_{3} \)` },
          { values: String.raw`\( ${formatWholeNumber(particles)} = 1 + ${formatWholeNumber(value || 0)} \)` },
        ];
      },
    },
    {
      key: 'turns',
      symbol: String.raw`\text{turns}`,
      equationSymbol: String.raw`\text{turns}`,
      name: 'Spiral Turns',
      description: 'Full revolutions completed before returning.',
      upgradable: false,
      includeInMasterEquation: false,
      format: (value) => `${formatDecimal(value || 2, 1)} turns`,
      computeValue() {
        return 2;
      },
      getSubEquations() {
        return [{ expression: String.raw`\( \theta(u) = 2\pi \times \text{turns} \times u \)` }];
      },
    },
  ],
  computeResult(values) {
    const attack = Math.max(0, Number(values.attack) || 0);
    const particles = Math.max(1, 1 + Math.floor(values.aleph3 || 0));
    return attack * particles;
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const attack = Math.max(0, Number(values.attack) || 0);
    const particles = Math.max(1, 1 + Math.floor(values.aleph3 || 0));
    return `${formatComponent(result)} = ${formatComponent(attack)} × ${formatWholeNumber(particles)}`;
  },
};

export const upsilon = {
  mathSymbol: String.raw`\upsilon`,
  baseEquation: String.raw`\( \upsilon = atk \times tot \times spd \)`,
  variables: [
    {
      key: 'attack',
      symbol: 'atk',
      equationSymbol: 'Atk',
      glyphLabel: 'ℵ₁',
      name: 'Ship Attack',
      description: 'Laser damage per micro-triangle.',
      baseValue: 1200,
      step: 260,
      upgradable: true,
      includeInMasterEquation: true,
      format: (value) => formatGameNumber(Math.max(0, value || 0)),
      cost: (level) => {
        const rank = Math.max(0, Math.floor(Number(level) || 0));
        return Math.max(140, Math.round(240 * 1.38 ** rank));
      },
      getSubEquations({ value }) {
        const resolved = Math.max(0, Number(value) || 0);
        const rank = Math.max(0, Math.floor((resolved - 1200) / 260));
        const attack = 1200 + 260 * rank;
        return [
          { expression: String.raw`\( atk = 1200 + 260 \times \aleph_{1} \)` },
          { values: String.raw`\( ${formatGameNumber(attack)} = 1200 + 260 \times ${formatWholeNumber(rank)} \)` },
        ];
      },
    },
    {
      key: 'production',
      symbol: 'spd',
      equationSymbol: 'Spd',
      glyphLabel: 'ℵ₂',
      name: 'Launch Cadence',
      description: 'Ships fabricated per second.',
      baseValue: 0.4,
      step: 0.08,
      upgradable: true,
      includeInMasterEquation: true,
      format: (value) => `${formatDecimal(Math.max(0, value || 0), 2)} ships/s`,
      cost: (level) => {
        const rank = Math.max(0, Math.floor(Number(level) || 0));
        return Math.max(110, Math.round(180 * 1.32 ** rank));
      },
      getSubEquations({ value }) {
        const cadence = Number.isFinite(value) ? Math.max(0, value) : 0.4;
        const rank = Math.max(0, Math.floor((cadence - 0.4) / 0.08));
        return [
          { expression: String.raw`\( \text{spd} = 0.4 + 0.08 \times \aleph_{2} \)` },
          { values: String.raw`\( ${formatDecimal(cadence, 2)} = 0.4 + 0.08 \times ${formatWholeNumber(rank)} \)` },
        ];
      },
    },
    {
      key: 'fleet',
      symbol: 'tot',
      equationSymbol: 'Tot',
      glyphLabel: 'ℵ₃',
      name: 'Fleet Size',
      description: 'Maximum ships launched at once.',
      baseValue: 4,
      step: 1,
      upgradable: true,
      includeInMasterEquation: true,
      format: (value) => `${formatWholeNumber(Math.max(1, Math.floor(value || 0)))} ships`,
      cost: (level) => {
        const rank = Math.max(0, Math.floor(Number(level) || 0));
        return Math.max(125, Math.round(210 * 1.28 ** rank));
      },
      getSubEquations({ value }) {
        const fleet = Math.max(1, Number.isFinite(value) ? Math.floor(value) : 4);
        const rank = Math.max(0, fleet - 4);
        return [
          { expression: String.raw`\( \text{tot} = 4 + \aleph_{3} \)` },
          { values: String.raw`\( ${formatWholeNumber(fleet)} = 4 + ${formatWholeNumber(rank)} \)` },
        ];
      },
    },
    {
      key: 'velocity',
      symbol: 'v',
      equationSymbol: 'v',
      glyphLabel: 'ℵ₄',
      name: 'Ship Speed',
      description: 'Travel speed for the micro-triangles.',
      baseValue: 1.6,
      step: 0.18,
      upgradable: true,
      includeInMasterEquation: false,
      format: (value) => `${formatDecimal(Math.max(0, value || 0), 2)} m/s`,
      cost: (level) => {
        const rank = Math.max(0, Math.floor(Number(level) || 0));
        return Math.max(105, Math.round(170 * 1.27 ** rank));
      },
      getSubEquations({ value }) {
        const speed = Number.isFinite(value) ? Math.max(0, value) : 1.6;
        const rank = Math.max(0, Math.floor((speed - 1.6) / 0.18));
        return [
          { expression: String.raw`\( v = 1.6 + 0.18 \times \aleph_{4} \)` },
          { values: String.raw`\( ${formatDecimal(speed, 2)} = 1.6 + 0.18 \times ${formatWholeNumber(rank)} \)` },
        ];
      },
    },
  ],
  computeResult(values) {
    const attack = Math.max(0, Number(values.attack) || 0);
    const cadence = Math.max(0, Number(values.production) || 0);
    const fleet = Math.max(1, Number(values.fleet) || 1);
    return attack * cadence * fleet;
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const attack = Math.max(0, Number(values.attack) || 0);
    const cadence = Math.max(0, Number(values.production) || 0);
    const fleet = Math.max(1, Number(values.fleet) || 1);
    return `${formatComponent(result)} = ${formatComponent(attack)} × ${formatDecimal(cadence, 2)} × ${formatWholeNumber(fleet)}`;
  },
};
