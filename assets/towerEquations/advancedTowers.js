/**
 * Advanced Tower Blueprints
 * 
 * Late-game towers: kappa, lambda, mu, nu, xi, omicron, pi, rho, sigma, tau, upsilon, phi, chi, psi, omega.
 * These towers feature advanced mechanics and scaling for end-game progression.
 */

import {
  formatWholeNumber,
  formatDecimal,
  formatGameNumber,
  formatPercentage,
} from '../../scripts/core/formatting.js';
import { blueprintContext } from './blueprintContext.js';

// Helper function accessor for cleaner code
const ctx = () => blueprintContext;

const PHI_MAX_SEEDS = 32; // 1 + 2 + 3 + 5 + 8 + 13 golden seeds across Fibonacci rings.
const PHI_SEED_DAMAGE = 10; // Damage per seed hit.
const PHI_SEED_PIERCE = 2; // Enemies a seed can pierce before reseeding.
const PHI_GOLDEN_RATIO = 1.61803398875;
const PHI_GOLDEN_ANGLE_DEGREES = 137.5;

const CHI_BASE_HEALTH = 0.28;
const CHI_HEALTH_SCALE = 0.05;
const CHI_BASE_SPEED = 0.12;
const CHI_SPEED_SCALE = 0.035;

function clampChiValue(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function resolvePhiPower() {
  const helpers = ctx();
  const phiRaw = typeof helpers?.calculateTowerEquationResult === 'function'
    ? helpers.calculateTowerEquationResult('phi')
    : 1;
  return Number.isFinite(phiRaw) && phiRaw > 0 ? phiRaw : 1;
}

function resolveChiCorePower() {
  const phiPower = resolvePhiPower();
  const safePhi = Math.max(1, phiPower);
  return Math.max(1, safePhi * safePhi);
}

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
      symbol: 'spd',
      equationSymbol: String.raw`\text{spd}`,
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
      symbol: 'spd',
      equationSymbol: String.raw`\text{spd}`,
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
      symbol: 'rng',
      equationSymbol: String.raw`\text{rng}`,
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
      symbol: 'chnRng',
      equationSymbol: String.raw`\text{chnRng}`,
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
      symbol: 'maxChn',
      equationSymbol: String.raw`\text{maxChn}`,
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
      symbol: 'numChnExp',
      equationSymbol: String.raw`\text{numChnExp}`,
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
  baseEquation: String.raw`\( ο = \delta \times \xi \)`,
  variables: [
    {
      key: 'delta',
      symbol: 'δ',
      masterEquationSymbol: 'Del',
      name: 'Delta Training Core',
      description: 'Inherited soldier strength and cadence from δ drills.',
      reference: 'delta',
      upgradable: false,
      lockedNote: 'Upgrade δ to raise ο triangle power and training rate.',
      format: (value) => formatGameNumber(Math.max(0, value || 0)),
      getSubEquations({ blueprint, towerId, value }) {
        const helpers = ctx();
        const deltaValue = Math.max(0, Number.isFinite(value) ? value : 0);
        const xiValue = Math.max(
          0,
          Number.isFinite(helpers.calculateTowerEquationResult?.('xi'))
            ? helpers.calculateTowerEquationResult('xi')
            : 0,
        );
        const attackRaw = deltaValue * xiValue;
        const attack = Number.isFinite(attackRaw) ? attackRaw : 0;

        const deltaBlueprint = helpers.getTowerEquationBlueprint?.('delta');
        const deltaAleph1 = Math.max(
          1,
          Number.isFinite(helpers.computeTowerVariableValue?.('delta', 'aleph1', deltaBlueprint))
            ? helpers.computeTowerVariableValue('delta', 'aleph1', deltaBlueprint)
            : 1,
        );
        const rawDeltaTrainingSeconds = Math.pow(5, deltaAleph1);
        const deltaTrainingSeconds = Number.isFinite(rawDeltaTrainingSeconds)
          ? Math.max(1, rawDeltaTrainingSeconds)
          : Number.MAX_SAFE_INTEGER;
        const deltaSpawnRate = deltaTrainingSeconds > 0 && Number.isFinite(deltaTrainingSeconds)
          ? 1 / deltaTrainingSeconds
          : 0;
        const omicronSpawnRate = deltaSpawnRate / 5;

        return [
          { expression: String.raw`\( atk = \delta \times \xi \)` },
          {
            values: String.raw`\( ${formatGameNumber(attack)} = ${formatGameNumber(deltaValue)} \times ${formatGameNumber(xiValue)} \)`,
            variant: 'values',
          },
          { expression: String.raw`\( \text{spd} = \text{spd}_{\delta} / 5 \)` },
          {
            values: String.raw`\( ${formatDecimal(omicronSpawnRate || 0, 3)} = ${formatDecimal(deltaSpawnRate || 0, 3)} / 5 \)`,
            variant: 'values',
          },
        ];
      },
    },
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
      getSubEquations({ blueprint, towerId, value }) {
        const helpers = ctx();
        const xiValue = Math.max(0, Number.isFinite(value) ? value : 0);
        const deltaValue = Math.max(
          0,
          Number.isFinite(helpers.calculateTowerEquationResult?.('delta'))
            ? helpers.calculateTowerEquationResult('delta')
            : 0,
        );
        const attackRaw = deltaValue * xiValue;
        const attack = Number.isFinite(attackRaw) ? attackRaw : 0;
        return [
          { expression: String.raw`\( atk = \delta \times \xi \)` },
          {
            values: String.raw`\( ${formatGameNumber(attack)} = ${formatGameNumber(deltaValue)} \times ${formatGameNumber(xiValue)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph1',
      symbol: 'shdAtk',
      equationSymbol: String.raw`\text{shdAtk}`,
      masterEquationSymbol: 'Shd',
      name: 'Aleph₁ Shield Impact',
      description: 'Determines shield collision damage as a percentage of enemy max HP.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `${formatDecimal(1 + Math.max(0, value), 2)}%`,
      cost: (level) => Math.max(1, 6 + level * 4),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : rank;
        const shieldPercent = (1 + Math.max(0, resolved)) / 100;
        return [
          { expression: String.raw`\( \text{shdAtk} = (1 + \aleph_{1})\% \)` },
          {
            values: String.raw`\( ${formatDecimal(shieldPercent * 100, 2)}\% = (1 + ${formatWholeNumber(resolved)})\% \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph2',
      symbol: 'untSpd',
      equationSymbol: String.raw`\text{untSpd}`,
      masterEquationSymbol: 'Spd',
      name: 'Aleph₂ Unit Speed',
      description: 'Boosts the top speed of each triangle soldier.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `${formatDecimal(1 + 0.1 * Math.max(0, value), 2)} m/s`,
      cost: (level) => Math.max(1, 7 + level * 4),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : rank;
        const unitSpeed = 1 + 0.1 * resolved;
        return [
          { expression: String.raw`\( \text{untSpd} = 1 + 0.1 \times \aleph_{2} \)` },
          {
            values: String.raw`\( ${formatDecimal(unitSpeed, 2)} = 1 + 0.1 \times ${formatWholeNumber(resolved)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph3',
      symbol: 'Tot',
      equationSymbol: String.raw`\text{Tot}`,
      masterEquationSymbol: 'Tot',
      name: 'Aleph₃ Unit Cohort',
      description: 'Expands the total number of omicron units that can be active.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `${formatWholeNumber(1 + Math.max(0, value))} units`,
      cost: (level) => Math.max(1, 8 + level * 5),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : rank;
        const maxUnits = 1 + resolved;
        return [
          { expression: String.raw`\( \text{Tot} = 1 + \aleph_{3} \)` },
          {
            values: String.raw`\( ${formatWholeNumber(maxUnits)} = 1 + ${formatWholeNumber(resolved)} \)`,
            variant: 'values',
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const helpers = ctx();
    const deltaValue = Math.max(
      0,
      Number.isFinite(values.delta)
        ? values.delta
        : Number.isFinite(helpers.calculateTowerEquationResult?.('delta'))
          ? helpers.calculateTowerEquationResult('delta')
          : 0,
    );
    const xiValue = Math.max(
      0,
      Number.isFinite(values.xi)
        ? values.xi
        : Number.isFinite(helpers.calculateTowerEquationResult?.('xi'))
          ? helpers.calculateTowerEquationResult('xi')
          : 0,
    );
    return deltaValue * xiValue;
  },
  formatGoldenEquation({ formatVariable, formatResult }) {
    return `\\( ${formatResult()} = ${formatVariable('delta')} \times ${formatVariable('xi')} \\)`;
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const helpers = ctx();
    const deltaValue = Math.max(
      0,
      Number.isFinite(values.delta)
        ? values.delta
        : Number.isFinite(helpers.calculateTowerEquationResult?.('delta'))
          ? helpers.calculateTowerEquationResult('delta')
          : 0,
    );
    const xiValue = Math.max(
      0,
      Number.isFinite(values.xi)
        ? values.xi
        : Number.isFinite(helpers.calculateTowerEquationResult?.('xi'))
          ? helpers.calculateTowerEquationResult('xi')
          : 0,
    );
    return `${formatComponent(result)} = ${formatComponent(deltaValue)} × ${formatComponent(xiValue)}`;
  },
};

/**
 * π tower blueprint - Rotational Beam Lock-On System
 *
 * Mechanics:
 * - Locks onto enemies within range with individual beam lasers
 * - Each beam tracks its own rotation angle from initial lock-on point
 * - Damage increases based on how much each beam has rotated around the tower
 * - Visual intensity and color scale with rotation degrees
 *
 * Formulas:
 * - atk = omicron^(|degrees|/(100-Bet₁)) per laser, where degrees is the rotation from initial angle
 * - numLaser = 2 + Lamed₁ (max beams that can lock onto enemies)
 * - rng = 4m (fixed base range, uses omicron reference for damage base)
 */
export const pi = {
  mathSymbol: String.raw`\pi`,
  baseEquation: String.raw`\( \pi = \omicron^{|\theta| / (100 - \text{Bet}_{1})} \)`,
  variables: [
    {
      key: 'omicron',
      symbol: 'ο',
      masterEquationSymbol: 'Omi',
      name: 'Omicron Power',
      description: 'Base power sourced from ο tower upgrades. Powers the exponential beam damage.',
      reference: 'omicron',
      upgradable: false,
      lockedNote: 'Upgrade ο to increase π beam power.',
      format: (value) => formatDecimal(value, 2),
      getSubEquations({ blueprint, towerId, value }) {
        const helpers = ctx();
        const effectiveBlueprint = blueprint || helpers.getTowerEquationBlueprint?.(towerId) || null;
        const omicronValue = Math.max(1, Number.isFinite(value) ? value : 1);
        const bet1Raw = helpers.computeTowerVariableValue?.(towerId, 'bet1', effectiveBlueprint);
        const bet1 = Math.max(0, Math.min(99, Number.isFinite(bet1Raw) ? bet1Raw : 0));
        const divisor = Math.max(1, 100 - bet1);
        // Example calculation at 180 degrees rotation
        const exampleDegrees = 180;
        const exponent = exampleDegrees / divisor;
        const attackRaw = Math.pow(omicronValue, exponent);
        const attack = Number.isFinite(attackRaw) ? attackRaw : Number.MAX_SAFE_INTEGER;
        return [
          { expression: String.raw`\( \text{atk} = \omicron^{|\theta| / (100 - \text{Bet}_{1})} \)` },
          {
            values: String.raw`\( ${formatGameNumber(attack)} = ${formatDecimal(omicronValue, 2)}^{${exampleDegrees} / ${formatWholeNumber(divisor)}} \text{ (at } ${exampleDegrees}°) \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'bet1',
      symbol: 'ב₁',
      equationSymbol: String.raw`\text{Bet}_{1}`,
      glyphLabel: 'ב₁',
      masterEquationSymbol: 'Bet',
      name: 'Bet₁ Divisor',
      description: 'Reduces the divisor in damage calculation, making beams grow stronger faster with rotation.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      glyphCurrency: 'bet',
      maxLevel: 50,
      format: (value) => {
        const bet1 = Math.max(0, Math.min(99, Number.isFinite(value) ? value : 0));
        return `${formatWholeNumber(100 - bet1)} divisor`;
      },
      cost(level) {
        const normalized = Math.max(0, Math.floor(Number.isFinite(level) ? level : 0));
        return Math.max(1, 2 + normalized * 3);
      },
      getSubEquations({ blueprint, towerId, level, value }) {
        const helpers = ctx();
        const effectiveBlueprint = blueprint || helpers.getTowerEquationBlueprint?.(towerId) || null;
        const resolvedLevel = Math.max(0, Math.floor(Number.isFinite(level) ? level : 0));
        const bet1 = Math.max(0, Math.min(99, Number.isFinite(value) ? value : resolvedLevel));
        const divisor = Math.max(1, 100 - bet1);
        const omicronRaw = helpers.calculateTowerEquationResult?.('omicron');
        const omicronValue = Math.max(1, Number.isFinite(omicronRaw) ? omicronRaw : 1);
        // Show damage at 360 degrees for reference
        const exampleDegrees = 360;
        const exponent = exampleDegrees / divisor;
        const attackRaw = Math.pow(omicronValue, exponent);
        const attack = Number.isFinite(attackRaw) ? attackRaw : Number.MAX_SAFE_INTEGER;
        return [
          {
            expression: String.raw`\( \text{divisor} = 100 - \text{Bet}_{1} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(divisor)} = 100 - ${formatWholeNumber(bet1)} \)`,
            variant: 'values',
          },
          {
            expression: String.raw`\( \text{dmg at } ${exampleDegrees}° = ${formatGameNumber(attack)} \)`,
            variant: 'values',
            glyphEquation: true,
          },
        ];
      },
    },
    {
      key: 'lamed1',
      symbol: 'ל₁',
      equationSymbol: String.raw`\text{Lamed}_{1}`,
      glyphLabel: 'ל₁',
      masterEquationSymbol: 'Las',
      name: 'Lamed₁ Max Lasers',
      description: 'Increases the maximum number of beams that can lock onto enemies simultaneously.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      glyphCurrency: 'lamed',
      maxLevel: 10,
      format: (value) => {
        const lamed1 = Math.max(0, Number.isFinite(value) ? value : 0);
        return `${formatWholeNumber(2 + lamed1)} lasers`;
      },
      cost(level) {
        const normalized = Math.max(0, Math.floor(Number.isFinite(level) ? level : 0));
        return Math.max(1, 5 + normalized * 5);
      },
      getSubEquations({ level, value }) {
        const resolvedLevel = Math.max(0, Math.floor(Number.isFinite(level) ? level : 0));
        const lamed1 = Math.max(0, Number.isFinite(value) ? value : resolvedLevel);
        const numLasers = 2 + lamed1;
        return [
          {
            expression: String.raw`\( \text{numLaser} = 2 + \text{Lamed}_{1} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(numLasers)} = 2 + ${formatWholeNumber(lamed1)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'rng',
      symbol: 'rng',
      equationSymbol: String.raw`\text{rng}`,
      masterEquationSymbol: 'Rng',
      name: 'Range',
      description: 'Fixed base range for beam lock-on in meters.',
      baseValue: 4,
      upgradable: false,
      includeInMasterEquation: false,
      format: (value) => `${formatDecimal(4, 2)}m`,
      getSubEquations() {
        return [
          {
            expression: String.raw`\( \text{rng} = 4\text{m} \)`,
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const helpers = ctx();
    const omicronRaw = Number.isFinite(values.omicron)
      ? values.omicron
      : helpers.calculateTowerEquationResult?.('omicron') || 1;
    const omicronValue = Math.max(1, Number.isFinite(omicronRaw) ? omicronRaw : 1);
    const bet1 = Math.max(0, Math.min(99, Number.isFinite(values.bet1) ? values.bet1 : 0));
    const divisor = Math.max(1, 100 - bet1);
    // Base result shows damage at 360 degrees as representative value
    const exampleDegrees = 360;
    const exponent = Math.min(50, exampleDegrees / divisor);
    return Math.pow(omicronValue, exponent);
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const helpers = ctx();
    const omicronRaw = Number.isFinite(values.omicron)
      ? values.omicron
      : helpers.calculateTowerEquationResult?.('omicron') || 1;
    const omicronValue = Math.max(1, Number.isFinite(omicronRaw) ? omicronRaw : 1);
    const bet1 = Math.max(0, Math.min(99, Number.isFinite(values.bet1) ? values.bet1 : 0));
    const divisor = Math.max(1, 100 - bet1);
    return `${formatComponent(result)} = ${formatComponent(omicronValue)}^{360°/${formatComponent(divisor)}}`;
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
      symbol: 'Rmax',
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
      symbol: 'Spd',
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
      symbol: 'p',
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

export const phi = {
  mathSymbol: String.raw`\phi`,
  baseEquation: String.raw`\( \phi = \text{seeds} \times \text{dmg}_{\text{seed}} \times \text{pierce} \)`,
  variables: [
    {
      key: 'seeds',
      symbol: 'seeds',
      equationSymbol: String.raw`\text{seeds}`,
      masterEquationSymbol: 'Seeds',
      name: 'Golden Seeds',
      description: 'Total seeds spun across Fibonacci rings before a burst.',
      baseValue: PHI_MAX_SEEDS,
      upgradable: false,
      includeInMasterEquation: true,
      format: (value) => `${formatWholeNumber(Math.max(0, value || 0))} seeds`,
      getSubEquations() {
        return [
          { expression: String.raw`\( \text{seeds} = 1 + 2 + 3 + 5 + 8 + 13 \)` },
          {
            values: String.raw`\( ${formatWholeNumber(PHI_MAX_SEEDS)} = \sum_{k=1}^{6} F_k \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'seedDamage',
      symbol: 'dmg',
      equationSymbol: String.raw`\text{dmg}_{\text{seed}}`,
      masterEquationSymbol: 'Dmg',
      name: 'Seed Damage',
      description: 'Damage delivered by each seed impact.',
      baseValue: PHI_SEED_DAMAGE,
      upgradable: false,
      includeInMasterEquation: true,
      format: (value) => formatGameNumber(Math.max(0, value || 0)),
      getSubEquations({ value }) {
        const resolved = Math.max(0, Number.isFinite(value) ? value : PHI_SEED_DAMAGE);
        return [
          { expression: String.raw`\( \text{dmg}_{\text{seed}} = ${PHI_SEED_DAMAGE} \)` },
          { values: String.raw`\( ${formatGameNumber(resolved)} = ${formatGameNumber(PHI_SEED_DAMAGE)} \)` },
        ];
      },
    },
    {
      key: 'pierce',
      symbol: 'πrc',
      equationSymbol: String.raw`\text{pierce}`,
      masterEquationSymbol: 'Prc',
      name: 'Pierce Capacity',
      description: 'How many enemies a seed can tunnel through before reseeding.',
      baseValue: PHI_SEED_PIERCE,
      upgradable: false,
      includeInMasterEquation: true,
      format: (value) => `×${formatWholeNumber(Math.max(1, value || 1))}`,
      getSubEquations({ value }) {
        const pierce = Math.max(1, Number.isFinite(value) ? value : PHI_SEED_PIERCE);
        return [
          { expression: String.raw`\( \text{pierce} = ${PHI_SEED_PIERCE} \)` },
          { values: String.raw`\( ${formatWholeNumber(pierce)} = ${formatWholeNumber(PHI_SEED_PIERCE)} \)` },
        ];
      },
    },
    {
      key: 'goldenAngle',
      symbol: 'θ',
      equationSymbol: String.raw`\theta_{\text{golden}}`,
      masterEquationSymbol: 'Ang',
      name: 'Golden Angle',
      description: 'Spacing between seeds while they spiral outward.',
      baseValue: PHI_GOLDEN_ANGLE_DEGREES,
      upgradable: false,
      includeInMasterEquation: false,
      format: (value) => `${formatDecimal(Math.max(0, value || PHI_GOLDEN_ANGLE_DEGREES), 2)}°`,
      getSubEquations({ value }) {
        const ratio = PHI_GOLDEN_RATIO;
        const goldenAngle = Number.isFinite(value) ? value : PHI_GOLDEN_ANGLE_DEGREES;
        return [
          { expression: String.raw`\( \theta_{\text{golden}} = 360^{\circ} \times \left(1 - \frac{1}{\phi}\right) \)` },
          {
            values: String.raw`\( ${formatDecimal(goldenAngle, 2)}^{\circ} = 360^{\circ} \times \left(1 - \frac{1}{${formatDecimal(ratio, 3)}}\right) \)`,
            variant: 'values',
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const seeds = Math.max(0, Number(values.seeds) || 0);
    const damage = Math.max(0, Number(values.seedDamage) || 0);
    const pierce = Math.max(1, Number(values.pierce) || 1);
    return seeds * damage * pierce;
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const seeds = Math.max(0, Number(values.seeds) || 0);
    const damage = Math.max(0, Number(values.seedDamage) || 0);
    const pierce = Math.max(1, Number(values.pierce) || 1);
    return `${formatComponent(result)} = ${formatComponent(seeds)} × ${formatComponent(damage)} × ${formatComponent(pierce)}`;
  },
};

export const chi = {
  mathSymbol: String.raw`\chi`,
  baseEquation: String.raw`\( \chi = \text{core} \times \text{hpFrac} \times (1 + \text{spd}) \times \text{thralls} \)`,
  variables: [
    {
      key: 'phiAnchor',
      symbol: 'φ',
      masterEquationSymbol: 'Phi',
      name: 'Phi Anchor',
      description: 'Baseline power inherited from φ spirals.',
      reference: 'phi',
      upgradable: false,
      includeInMasterEquation: false,
      format: (value) => formatGameNumber(Math.max(0, value || 0)),
      getSubEquations({ value }) {
        const resolved = Math.max(0, Number.isFinite(value) ? value : resolvePhiPower());
        return [
          { expression: String.raw`\( \phi_{\text{anchor}} = \phi \)` },
          { values: String.raw`\( ${formatGameNumber(resolved)} = \phi \)` },
        ];
      },
    },
    {
      key: 'core',
      symbol: 'core',
      equationSymbol: String.raw`\chi_{\text{core}}`,
      masterEquationSymbol: 'Core',
      name: 'Gate Resonance',
      description: 'Thrall vitality sourced from φ².',
      upgradable: false,
      includeInMasterEquation: true,
      format: (value) => formatGameNumber(Math.max(1, value || 1)),
      computeValue() {
        return resolveChiCorePower();
      },
      getSubEquations({ value }) {
        const phiPower = resolvePhiPower();
        const core = Math.max(1, Number.isFinite(value) ? value : resolveChiCorePower());
        return [
          { expression: String.raw`\( \chi_{\text{core}} = \max(1, \phi^{2}) \)` },
          {
            values: String.raw`\( ${formatGameNumber(core)} = \max(1, ${formatGameNumber(phiPower)}^{2}) \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'healthFraction',
      symbol: 'hp%',
      equationSymbol: String.raw`\text{hpFrac}`,
      masterEquationSymbol: 'Hp',
      name: 'Thrall Vitality',
      description: 'Health fraction carried into each thrall.',
      upgradable: false,
      includeInMasterEquation: true,
      format: (value) => formatPercentage(Math.max(0, value || 0), 1),
      computeValue() {
        const core = resolveChiCorePower();
        const normalized = Math.log10(core + 1);
        return clampChiValue(CHI_BASE_HEALTH + normalized * CHI_HEALTH_SCALE, 0.25, 0.85);
      },
      getSubEquations({ value }) {
        const core = resolveChiCorePower();
        const normalized = Math.log10(core + 1);
        const health = Number.isFinite(value)
          ? value
          : clampChiValue(CHI_BASE_HEALTH + normalized * CHI_HEALTH_SCALE, 0.25, 0.85);
        return [
          {
            expression: String.raw`\( \text{hpFrac} = \operatorname{clamp}(0.28 + \log_{10}(\chi_{\text{core}} + 1) \times 0.05,\,0.25,\,0.85) \)`,
          },
          {
            values: String.raw`\( ${formatPercentage(health, 1)} = \operatorname{clamp}(0.28 + ${formatDecimal(normalized, 2)} \times 0.05,\,0.25,\,0.85) \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'speedBonus',
      symbol: 'spd',
      equationSymbol: String.raw`\text{spd}`,
      masterEquationSymbol: 'Spd',
      name: 'Gate Speed',
      description: 'Movement bonus applied to roaming thralls.',
      upgradable: false,
      includeInMasterEquation: true,
      format: (value) => `${formatDecimal(Math.max(0, value || 0), 2)}×`,
      computeValue() {
        const core = resolveChiCorePower();
        const normalized = Math.log10(core + 1);
        return clampChiValue(CHI_BASE_SPEED + normalized * CHI_SPEED_SCALE, 0.12, 1.8);
      },
      getSubEquations({ value }) {
        const core = resolveChiCorePower();
        const normalized = Math.log10(core + 1);
        const speed = Number.isFinite(value)
          ? value
          : clampChiValue(CHI_BASE_SPEED + normalized * CHI_SPEED_SCALE, 0.12, 1.8);
        return [
          {
            expression: String.raw`\( \text{spd} = \operatorname{clamp}(0.12 + \log_{10}(\chi_{\text{core}} + 1) \times 0.035,\,0.12,\,1.8) \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(speed, 2)} = \operatorname{clamp}(0.12 + ${formatDecimal(normalized, 2)} \times 0.035,\,0.12,\,1.8) \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'maxThralls',
      symbol: 'thr',
      equationSymbol: String.raw`\text{thralls}`,
      masterEquationSymbol: 'Thr',
      name: 'Active Thralls',
      description: 'Total thralls patrolling between gates.',
      upgradable: false,
      includeInMasterEquation: true,
      format: (value) => formatWholeNumber(Math.max(1, value || 1)),
      computeValue() {
        const core = resolveChiCorePower();
        const normalized = Math.log10(core + 1);
        return Math.max(1, Math.round(2 + normalized));
      },
      getSubEquations({ value }) {
        const core = resolveChiCorePower();
        const normalized = Math.log10(core + 1);
        const thralls = Number.isFinite(value) ? value : Math.max(1, Math.round(2 + normalized));
        return [
          { expression: String.raw`\( \text{thralls} = 2 + \left\lfloor \log_{10}(\chi_{\text{core}} + 1) \right\rceil \)` },
          {
            values: String.raw`\( ${formatWholeNumber(thralls)} = 2 + \left\lfloor ${formatDecimal(normalized, 2)} \right\rceil \)`,
            variant: 'values',
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const core = Math.max(1, Number(values.core) || 1);
    const health = clampChiValue(Number(values.healthFraction) || 0, 0.25, 0.85);
    const speedBonus = Math.max(0, Number(values.speedBonus) || 0);
    const thralls = Math.max(1, Number(values.maxThralls) || 1);
    return core * health * thralls * (1 + speedBonus);
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const core = Math.max(1, Number(values.core) || 1);
    const health = clampChiValue(Number(values.healthFraction) || 0, 0.25, 0.85);
    const speedBonus = Math.max(0, Number(values.speedBonus) || 0);
    const thralls = Math.max(1, Number(values.maxThralls) || 1);
    return `${formatComponent(result)} = ${formatComponent(core)} × ${formatPercentage(health, 1)} × ${formatComponent(1 + speedBonus)} × ${formatComponent(thralls)}`;
  },
};

/**
 * ψ (psi) tower blueprint capturing enemy merge mechanics.
 *
 * Merges enemies within range into PsiClusters with combined HP and sublinear speed.
 * Clusters explode on death dealing AoE damage.
 */
export const psi = {
  mathSymbol: String.raw`\psi`,
  baseEquation: String.raw`\( \psi = \text{merge}_{\text{CD}} \times \text{count}_{\text{max}} \)`,
  variables: [
    {
      key: 'mergeCooldown',
      symbol: String.raw`\text{CD}`,
      equationSymbol: String.raw`\text{merge}_{\text{CD}}`,
      masterEquationSymbol: 'CD',
      glyphLabel: 'ℵ₁',
      name: 'Merge Cooldown',
      description: 'Seconds between merge attempts. Lower values merge more frequently.',
      baseValue: 6.0,
      step: -0.5,
      upgradable: true,
      includeInMasterEquation: true,
      format: (value) => `${formatDecimal(Math.max(0.5, value || 0.5), 2)}s`,
      cost: (level) => {
        const rank = Math.max(0, Math.floor(Number(level) || 0));
        return Math.max(80, Math.round(140 * 1.25 ** rank));
      },
      getSubEquations({ value }) {
        const resolved = Math.max(0.5, Number.isFinite(value) ? value : 6.0);
        const rank = Math.max(0, Math.floor((6.0 - resolved) / 0.5));
        const cooldown = Math.max(0.5, 6.0 - 0.5 * rank);
        return [
          { expression: String.raw`\( \text{CD} = 6.0 - 0.5 \times \aleph_{1} \)` },
          { expression: String.raw`\( \text{CD} \ge 0.5\,\text{s} \)` },
          { values: String.raw`\( ${formatDecimal(cooldown, 2)}\,\text{s} = 6.0 - 0.5 \times ${formatWholeNumber(rank)} \)`, variant: 'values' },
        ];
      },
    },
    {
      key: 'maxMergeCount',
      symbol: String.raw`\text{count}_{\text{max}}`,
      equationSymbol: String.raw`\text{count}_{\text{max}}`,
      masterEquationSymbol: 'Count',
      glyphLabel: 'ℵ₂',
      name: 'Max Merge Count',
      description: 'Maximum number of enemies merged at once. More enemies create stronger clusters.',
      baseValue: 3,
      step: 1,
      upgradable: true,
      includeInMasterEquation: true,
      format: (value) => `${formatWholeNumber(Math.max(2, Math.floor(value || 2)))} enemies`,
      cost: (level) => {
        const rank = Math.max(0, Math.floor(Number(level) || 0));
        return Math.max(100, Math.round(180 * 1.32 ** rank));
      },
      getSubEquations({ value }) {
        const count = Math.max(2, Number.isFinite(value) ? Math.floor(value) : 3);
        const rank = Math.max(0, count - 3);
        return [
          { expression: String.raw`\( \text{count}_{\text{max}} = 3 + \aleph_{2} \)` },
          { expression: String.raw`\( \text{count}_{\text{max}} \ge 2 \)` },
          { values: String.raw`\( ${formatWholeNumber(count)} = 3 + ${formatWholeNumber(rank)} \)`, variant: 'values' },
        ];
      },
    },
    {
      key: 'mergeSpeedExponent',
      symbol: String.raw`\text{exp}_{\text{spd}}`,
      equationSymbol: String.raw`\text{exp}_{\text{spd}}`,
      masterEquationSymbol: 'SpdExp',
      glyphLabel: 'ℵ₃',
      name: 'Speed Exponent',
      description: 'Controls cluster speed: speed_cluster = mean_speed^exponent. Lower = slower, higher = faster.',
      baseValue: 0.5,
      step: 0.05,
      upgradable: true,
      includeInMasterEquation: false,
      format: (value) => `${formatDecimal(Math.max(0.1, value || 0.1), 3)}`,
      cost: (level) => {
        const rank = Math.max(0, Math.floor(Number(level) || 0));
        return Math.max(90, Math.round(150 * 1.28 ** rank));
      },
      getSubEquations({ value }) {
        const exponent = Math.max(0.1, Number.isFinite(value) ? value : 0.5);
        const rank = Math.max(0, Math.floor((exponent - 0.5) / 0.05));
        return [
          { expression: String.raw`\( \text{exp}_{\text{spd}} = 0.5 + 0.05 \times \aleph_{3} \)` },
          { expression: String.raw`\( \text{speed}_{\psi} = \overline{\text{speed}}^{\text{exp}_{\text{spd}}} \)` },
          { values: String.raw`\( ${formatDecimal(exponent, 3)} = 0.5 + 0.05 \times ${formatWholeNumber(rank)} \)`, variant: 'values' },
        ];
      },
    },
    {
      key: 'aoeRadiusMultiplier',
      symbol: String.raw`\text{R}_{\text{AoE}}`,
      equationSymbol: String.raw`\text{R}_{\text{AoE}}`,
      masterEquationSymbol: 'AoE_R',
      glyphLabel: 'ℵ₄',
      name: 'AoE Radius',
      description: 'Explosion radius multiplier when clusters die. Base radius is 2.0 meters.',
      baseValue: 1.0,
      step: 0.15,
      upgradable: true,
      includeInMasterEquation: false,
      format: (value) => `${formatDecimal(Math.max(0, value || 0), 2)}× (${formatDecimal(Math.max(0, (value || 0) * 2.0), 2)}m)`,
      cost: (level) => {
        const rank = Math.max(0, Math.floor(Number(level) || 0));
        return Math.max(110, Math.round(190 * 1.3 ** rank));
      },
      getSubEquations({ value }) {
        const multiplier = Math.max(0, Number.isFinite(value) ? value : 1.0);
        const rank = Math.max(0, Math.floor((multiplier - 1.0) / 0.15));
        const radiusMeters = multiplier * 2.0;
        return [
          { expression: String.raw`\( \text{R}_{\text{AoE}} = 1.0 + 0.15 \times \aleph_{4} \)` },
          { expression: String.raw`\( \text{radius} = 2.0 \times \text{R}_{\text{AoE}} \)` },
          { values: String.raw`\( ${formatDecimal(radiusMeters, 2)}\,\text{m} = 2.0 \times ${formatDecimal(multiplier, 2)} \)`, variant: 'values' },
        ];
      },
    },
    {
      key: 'aoeDamageMultiplier',
      symbol: String.raw`\text{D}_{\text{AoE}}`,
      equationSymbol: String.raw`\text{D}_{\text{AoE}}`,
      masterEquationSymbol: 'AoE_D',
      glyphLabel: 'ℵ₅',
      name: 'AoE Damage',
      description: 'Fraction of cluster HP converted to AoE damage on death. Higher values = bigger explosions.',
      baseValue: 1.0,
      step: 0.2,
      upgradable: true,
      includeInMasterEquation: false,
      format: (value) => `${formatDecimal(Math.max(0, value || 0), 2)}× HP`,
      cost: (level) => {
        const rank = Math.max(0, Math.floor(Number(level) || 0));
        return Math.max(120, Math.round(200 * 1.35 ** rank));
      },
      getSubEquations({ value }) {
        const multiplier = Math.max(0, Number.isFinite(value) ? value : 1.0);
        const rank = Math.max(0, Math.floor((multiplier - 1.0) / 0.2));
        return [
          { expression: String.raw`\( \text{D}_{\text{AoE}} = 1.0 + 0.2 \times \aleph_{5} \)` },
          { expression: String.raw`\( \text{dmg}_{\text{AoE}} = \text{HP}_{\psi} \times \text{D}_{\text{AoE}} \)` },
          { values: String.raw`\( ${formatDecimal(multiplier, 2)} = 1.0 + 0.2 \times ${formatWholeNumber(rank)} \)`, variant: 'values' },
        ];
      },
    },
    {
      key: 'rangeMeters',
      symbol: 'm',
      equationSymbol: 'm',
      masterEquationSymbol: 'Rng',
      glyphLabel: 'ℵ₆',
      name: 'Merge Range',
      description: 'Detection radius for finding enemies to merge (meters).',
      baseValue: 7.0,
      step: 0.5,
      upgradable: true,
      includeInMasterEquation: false,
      format: (value) => `${formatDecimal(Math.max(0.5, value || 0.5), 2)}m`,
      cost: (level) => {
        const rank = Math.max(0, Math.floor(Number(level) || 0));
        return Math.max(95, Math.round(160 * 1.27 ** rank));
      },
      getSubEquations({ value }) {
        const range = Math.max(0.5, Number.isFinite(value) ? value : 7.0);
        const rank = Math.max(0, Math.floor((range - 7.0) / 0.5));
        return [
          { expression: String.raw`\( m = 7.0 + 0.5 \times \aleph_{6} \)` },
          { values: String.raw`\( ${formatDecimal(range, 2)}\,\text{m} = 7.0 + 0.5 \times ${formatWholeNumber(rank)} \)`, variant: 'values' },
        ];
      },
    },
    {
      key: 'allowBossMerges',
      symbol: String.raw`\text{boss}`,
      equationSymbol: String.raw`\text{boss}`,
      masterEquationSymbol: 'Boss',
      glyphLabel: 'ℵ₇',
      name: 'Boss Merging',
      description: 'Allow merging boss enemies. 0 = disabled, 1 = enabled.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      includeInMasterEquation: false,
      format: (value) => (Math.floor(value || 0) >= 1 ? 'Enabled' : 'Disabled'),
      cost: (level) => {
        const rank = Math.max(0, Math.floor(Number(level) || 0));
        return rank === 0 ? 500 : Number.MAX_SAFE_INTEGER; // One-time expensive unlock
      },
      getSubEquations({ value }) {
        const enabled = Math.floor(value || 0) >= 1;
        return [
          { expression: String.raw`\( \text{boss} = \aleph_{7} \ge 1 \)` },
          { values: String.raw`\( \text{status} = ${enabled ? '\\text{enabled}' : '\\text{disabled}'} \)`, variant: 'values' },
        ];
      },
    },
  ],
  computeResult(values) {
    const cooldown = Math.max(0.5, Number(values.mergeCooldown) || 6.0);
    const maxCount = Math.max(2, Math.floor(Number(values.maxMergeCount) || 3));
    // Return a utility score combining cooldown efficiency and merge count
    return (maxCount / cooldown) * 10;
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const cooldown = Math.max(0.5, Number(values.mergeCooldown) || 6.0);
    const maxCount = Math.max(2, Math.floor(Number(values.maxMergeCount) || 3));
    return `${formatComponent(result)} = ${formatComponent(maxCount)} ÷ ${formatDecimal(cooldown, 2)}`;
  },
};

export const omega = {
  mathSymbol: String.raw`\Omega`,
  baseEquation: String.raw`\( \Omega = \text{slice} \times \text{HP}_{\text{max}} \)`,
  variables: [
    {
      key: 'omega_range',
      symbol: String.raw`\text{R}_{\Omega}`,
      equationSymbol: String.raw`\text{R}_{\Omega}`,
      masterEquationSymbol: 'Rng',
      glyphLabel: 'ℵ₁',
      name: 'Range Multiplier',
      description: 'Multiplier for the tower\'s base detection range (7.0m).',
      baseValue: 1.0,
      step: 0.15,
      upgradable: true,
      includeInMasterEquation: false,
      format: (value) => {
        const multiplier = 1 + Math.max(0, value || 0);
        const rangeMeters = 7.0 * multiplier;
        return `${formatDecimal(multiplier, 2)}× (${formatDecimal(rangeMeters, 2)}m)`;
      },
      cost: (level) => {
        const rank = Math.max(0, Math.floor(Number(level) || 0));
        return Math.max(200, Math.round(400 * 1.4 ** rank));
      },
      getSubEquations({ value }) {
        const boost = Math.max(0, Number.isFinite(value) ? value : 1.0);
        const multiplier = 1 + boost;
        const rank = Math.max(0, Math.floor(boost / 0.15));
        const rangeMeters = 7.0 * multiplier;
        return [
          { expression: String.raw`\( \text{R}_{\Omega} = 1 + 0.15 \times \aleph_{1} \)` },
          { expression: String.raw`\( \text{range} = 7.0 \times \text{R}_{\Omega} \)` },
          { values: String.raw`\( ${formatDecimal(rangeMeters, 2)}\,\text{m} = 7.0 \times ${formatDecimal(multiplier, 2)} \)`, variant: 'values' },
        ];
      },
    },
    {
      key: 'omega_particleCount',
      symbol: String.raw`\text{N}_{\text{orb}}`,
      equationSymbol: String.raw`\text{N}_{\text{orb}}`,
      masterEquationSymbol: 'Orb',
      glyphLabel: 'ℵ₂',
      name: 'Particle Count',
      description: 'Number of golden particles orbiting targets. Base is 8 particles.',
      baseValue: 0,
      step: 2,
      upgradable: true,
      includeInMasterEquation: false,
      format: (value) => {
        const count = 8 + Math.max(0, Math.floor(value || 0));
        return `${formatWholeNumber(count)} particles`;
      },
      cost: (level) => {
        const rank = Math.max(0, Math.floor(Number(level) || 0));
        return Math.max(250, Math.round(500 * 1.45 ** rank));
      },
      getSubEquations({ value }) {
        const bonus = Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0);
        const count = 8 + bonus;
        const rank = Math.max(0, Math.floor(bonus / 2));
        return [
          { expression: String.raw`\( \text{N}_{\text{orb}} = 8 + 2 \times \aleph_{2} \)` },
          { values: String.raw`\( ${formatWholeNumber(count)} = 8 + 2 \times ${formatWholeNumber(rank)} \)`, variant: 'values' },
        ];
      },
    },
    {
      key: 'omega_cooldown',
      symbol: String.raw`\text{C}^{-1}`,
      equationSymbol: String.raw`\text{C}^{-1}`,
      masterEquationSymbol: 'Spd',
      glyphLabel: 'ℵ₃',
      name: 'Cooldown Reduction',
      description: 'Reduces slice cooldown. Base cooldown is 4.0s, reduced by this multiplier.',
      baseValue: 1.0,
      step: 0.2,
      upgradable: true,
      includeInMasterEquation: false,
      format: (value) => {
        const multiplier = 1 + Math.max(0, value || 0);
        const cooldown = 4.0 / multiplier;
        return `${formatDecimal(multiplier, 2)}× (${formatDecimal(cooldown, 2)}s)`;
      },
      cost: (level) => {
        const rank = Math.max(0, Math.floor(Number(level) || 0));
        return Math.max(300, Math.round(600 * 1.5 ** rank));
      },
      getSubEquations({ value }) {
        const boost = Math.max(0, Number.isFinite(value) ? value : 1.0);
        const multiplier = 1 + boost;
        const rank = Math.max(0, Math.floor(boost / 0.2));
        const cooldown = 4.0 / multiplier;
        return [
          { expression: String.raw`\( \text{C}^{-1} = 1 + 0.2 \times \aleph_{3} \)` },
          { expression: String.raw`\( \text{cooldown} = 4.0 / \text{C}^{-1} \)` },
          { values: String.raw`\( ${formatDecimal(cooldown, 2)}\,\text{s} = 4.0 / ${formatDecimal(multiplier, 2)} \)`, variant: 'values' },
        ];
      },
    },
    {
      key: 'omega_sliceFrac',
      symbol: String.raw`\text{slice}`,
      equationSymbol: String.raw`\text{slice}`,
      masterEquationSymbol: 'Slice',
      glyphLabel: 'ℵ₄',
      name: 'Slice Fraction',
      description: 'Percentage of target max HP removed per slice. Base 10%, capped at 40%.',
      baseValue: 0,
      step: 0.015,
      upgradable: true,
      includeInMasterEquation: true,
      format: (value) => {
        const base = 0.10;
        const bonus = Math.max(0, value || 0);
        const fraction = Math.min(0.40, base + bonus);
        return `${formatDecimal(fraction * 100, 1)}%`;
      },
      cost: (level) => {
        const rank = Math.max(0, Math.floor(Number(level) || 0));
        return Math.max(400, Math.round(800 * 1.6 ** rank));
      },
      getSubEquations({ value }) {
        const bonus = Math.max(0, Number.isFinite(value) ? value : 0);
        const base = 0.10;
        const uncapped = base + bonus;
        const fraction = Math.min(0.40, uncapped);
        const rank = Math.max(0, Math.floor(bonus / 0.015));
        return [
          { expression: String.raw`\( \text{slice} = \min(0.40, 0.10 + 0.015 \times \aleph_{4}) \)` },
          { values: String.raw`\( ${formatDecimal(fraction * 100, 1)}\% = \min(40\%, 10\% + 1.5\% \times ${formatWholeNumber(rank)}) \)`, variant: 'values' },
        ];
      },
    },
    {
      key: 'omega_priorityMode',
      symbol: String.raw`\text{mode}_{\text{pri}}`,
      equationSymbol: String.raw`\text{mode}_{\text{pri}}`,
      masterEquationSymbol: 'Pri',
      glyphLabel: 'ℵ₅',
      name: 'Priority Mode',
      description: 'Target priority: 0 = "first" (closest to exit), 1 = "strongest" (highest max HP).',
      baseValue: 0,
      step: 1,
      upgradable: true,
      includeInMasterEquation: false,
      format: (value) => {
        const mode = Math.floor(value || 0) >= 1 ? 'strongest' : 'first';
        return mode === 'strongest' ? 'Strongest (HP)' : 'First (Exit)';
      },
      cost: (level) => {
        const rank = Math.max(0, Math.floor(Number(level) || 0));
        return rank === 0 ? 150 : Number.MAX_SAFE_INTEGER; // One-time toggle
      },
      getSubEquations({ value }) {
        const mode = Math.floor(value || 0) >= 1 ? 'strongest' : 'first';
        return [
          { expression: String.raw`\( \text{mode}_{\text{pri}} = \aleph_{5} \ge 1 \)` },
          { values: String.raw`\( \text{mode} = \text{${mode}} \)`, variant: 'values' },
        ];
      },
    },
    {
      key: 'omega_multiMode',
      symbol: String.raw`\text{mode}_{\text{dist}}`,
      equationSymbol: String.raw`\text{mode}_{\text{dist}}`,
      masterEquationSymbol: 'Dist',
      glyphLabel: 'ℵ₆',
      name: 'Distribution Mode',
      description: 'Particle distribution: 0 = "single" (all on one target), 1 = "multi" (spread across targets).',
      baseValue: 0,
      step: 1,
      upgradable: true,
      includeInMasterEquation: false,
      format: (value) => {
        const mode = Math.floor(value || 0) >= 1 ? 'multi' : 'single';
        return mode === 'multi' ? 'Multi-target' : 'Single-target';
      },
      cost: (level) => {
        const rank = Math.max(0, Math.floor(Number(level) || 0));
        return rank === 0 ? 200 : Number.MAX_SAFE_INTEGER; // One-time toggle
      },
      getSubEquations({ value }) {
        const mode = Math.floor(value || 0) >= 1 ? 'multi' : 'single';
        return [
          { expression: String.raw`\( \text{mode}_{\text{dist}} = \aleph_{6} \ge 1 \)` },
          { values: String.raw`\( \text{mode} = \text{${mode}} \)`, variant: 'values' },
        ];
      },
    },
  ],
  computeResult(values) {
    // Return the effective slice fraction as the main result
    const base = 0.10;
    const bonus = Math.max(0, Number(values.omega_sliceFrac) || 0);
    const fraction = Math.min(0.40, base + bonus);
    return fraction * 100; // Return as percentage
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const base = 0.10;
    const bonus = Math.max(0, Number(values.omega_sliceFrac) || 0);
    const fraction = Math.min(0.40, base + bonus);
    return `${formatComponent(result)}% = ${formatDecimal(fraction * 100, 1)}% of max HP`;
  },
};
