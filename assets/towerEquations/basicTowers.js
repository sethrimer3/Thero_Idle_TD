/**
 * Basic Tower Blueprints
 * 
 * Foundational towers that form the core progression: alpha, beta, gamma.
 * These towers introduce players to the basic mechanics and upgrade systems.
 */

import {
  formatWholeNumber,
  formatDecimal,
  formatGameNumber,
} from '../../scripts/core/formatting.js';
import { blueprintContext } from './blueprintContext.js';

// Helper function accessors for cleaner code
const ctx = () => blueprintContext;

// Render Bet₁ with a dagesh and an enforced left-to-right order so the subscript stays on the right.
const BET1_GLYPH = '\u2066\u05D1\u05BC\u2081\u2069';

export const alpha = {
  mathSymbol: String.raw`\alpha`,
  baseEquation: 'α = Atk × Spd',
  variables: [
    {
      key: 'atk',
      symbol: 'Atk',
      equationSymbol: 'Atk',
      glyphLabel: 'ℵ₁',
      name: 'Atk',
      description: 'Projectile damage carried by each glyph bullet.',
      baseValue: 5,
      step: 5,
      upgradable: true,
      format: (value) => `${formatWholeNumber(value)} Atk`,
      cost: (level) => Math.max(1, 1 + level),
      getSubEquations({ level, value }) {
        const glyphRank = ctx().deriveGlyphRankFromLevel(level, 1);
        const attackValue = Number.isFinite(value) ? value : 0;
        return [
          {
            expression: String.raw`\( \text{Atk} = 5 \times \aleph_{1} \)`,
            values: String.raw`\( ${formatWholeNumber(attackValue)} = 5 \times ${formatWholeNumber(glyphRank)} \)`,
          },
        ];
      },
    },
    {
      key: 'speed',
      symbol: 'Spd',
      equationSymbol: 'Spd',
      glyphLabel: 'ℵ₂',
      name: 'Spd',
      description: 'Oscillation cadence braided from the second glyph conduit.',
      baseValue: 0.5,
      step: 0.5,
      upgradable: true,
      format: (value) => `${formatDecimal(value, 2)} Spd`,
      getSubEquations({ level, value }) {
        const glyphRank = ctx().deriveGlyphRankFromLevel(level, 1);
        const speedValue = Number.isFinite(value) ? value : glyphRank * 0.5;
        return [
          {
            expression: String.raw`\( \text{Spd} = 0.5 \times \aleph_{2} \)`,
            values: String.raw`\( ${formatDecimal(speedValue, 2)} = 0.5 \times ${formatDecimal(glyphRank, 2)} \)`,
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const attack = Number.isFinite(values.atk) ? values.atk : 0;
    const speed = Number.isFinite(values.speed) ? values.speed : 0;
    return attack * speed;
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const attack = Number.isFinite(values.atk) ? values.atk : 0;
    const speed = Number.isFinite(values.speed) ? values.speed : 0;
    return `${formatComponent(result)} = ${formatComponent(attack)} × ${formatComponent(speed)}`;
  },
};

export const beta = {
  mathSymbol: String.raw`\beta`,
  baseEquation: 'β = Atk × Spd × Rng × Slw',
  variables: [
    {
      key: 'attack',
      symbol: 'Atk',
      equationSymbol: 'Atk',
      glyphLabel: 'ℵ₁',
      name: 'Atk',
      description: 'Direct strike power mirrored from α.',
      upgradable: true,
      format: (value) => `${formatGameNumber(value)} Atk`,
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const state = ctx().ensureTowerUpgradeState(towerId, effectiveBlueprint);
        const level = state.variables?.attack?.level || 0;
        const glyphRank = ctx().deriveGlyphRankFromLevel(level, 1);
        const alphaValue = ctx().calculateTowerEquationResult('alpha');
        return alphaValue * glyphRank;
      },
      getSubEquations({ level }) {
        const glyphRank = ctx().deriveGlyphRankFromLevel(level, 1);
        const alphaValue = ctx().calculateTowerEquationResult('alpha');
        const attackValue = alphaValue * glyphRank;
        return [
          {
            expression: String.raw`\( \text{Atk} = \alpha \times \aleph_{1} \)`,
            values: String.raw`\( ${formatDecimal(attackValue, 2)} = ${formatDecimal(alphaValue, 2)} \times ${formatWholeNumber(glyphRank)} \)`,
          },
        ];
      },
    },
    {
      key: 'speed',
      symbol: 'Spd',
      equationSymbol: 'Spd',
      name: 'Spd',
      description: 'Cadence accelerated by neighbouring α lattices.',
      upgradable: false,
      lockedNote: 'Connect α lattices to accelerate β cadence.',
      computeValue() {
        const alphaConnections = ctx().getDynamicConnectionCount('alpha');
        return 0.5 + 1.5 * alphaConnections;
      },
      format: (value) => `${formatDecimal(value, 2)} Spd`,
      getSubEquations() {
        const alphaConnections = ctx().getDynamicConnectionCount('alpha');
        const speedValue = 0.5 + 1.5 * alphaConnections;
        return [
          {
            expression: String.raw`\( \text{Spd} = 0.5 + 1.5 \left( \alpha_{\beta} \right) \)`,
            values: String.raw`\( ${formatDecimal(speedValue, 2)} = 0.5 + 1.5 \left( ${formatWholeNumber(alphaConnections)} \right) \)`,
          },
        ];
      },
    },
    {
      key: 'range',
      symbol: 'Rng',
      equationSymbol: 'Rng',
      name: 'Rng',
      description: 'Coverage extended by α lattice entanglement.',
      upgradable: false,
      lockedNote: 'Entangle α lattices to extend β reach.',
      computeValue() {
        return 1 + ctx().getDynamicConnectionCount('alpha');
      },
      format: (value) => `${formatDecimal(value, 2)} Rng`,
      getSubEquations() {
        const alphaConnections = ctx().getDynamicConnectionCount('alpha');
        const rangeValue = 1 + alphaConnections;
        return [
          {
            expression: String.raw`\( \text{Rng} = 1 + \left( \alpha_{\beta} \right) \)`,
            values: String.raw`\( ${formatDecimal(rangeValue, 2)} = 1 + \left( ${formatWholeNumber(alphaConnections)} \right) \)`,
          },
        ];
      },
    },
    // Bet glyph sink that fuels β's slowing field potency for the Bet Spire.
    {
      key: 'betSlow',
      symbol: BET1_GLYPH,
      equationSymbol: 'Bet₁',
      glyphLabel: BET1_GLYPH,
      name: 'Bet₁ Slow Weave',
      description: 'Invest Bet glyphs to deepen β’s slowing field.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      glyphCurrency: 'bet',
      attachedToVariable: 'slw',
      format: (value) => formatWholeNumber(Math.max(0, value)),
      cost: (level) => Math.max(1, 1 + Math.max(0, Math.floor(Number.isFinite(level) ? level : 0))),
      renderControlsInline: true,
    },
    // Derived slow percentage surfaced as its own sub-equation box for clarity.
    {
      key: 'slw',
      symbol: 'Slw%',
      equationSymbol: 'Slw%',
      masterEquationSymbol: 'Slw',
      name: 'Slow Field',
      description: 'Percentage of enemy speed β shears away within its conduit.',
      upgradable: false,
      format: (value) => `${formatDecimal(Math.max(0, value), 2)}% slow`,
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const bet1 = Math.max(0, ctx().computeTowerVariableValue(towerId, 'betSlow', effectiveBlueprint));
        const slowPercent = 20 + 2 * bet1;
        return Math.min(60, Math.max(0, slowPercent));
      },
      getSubEquations({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const bet1 = Math.max(0, ctx().computeTowerVariableValue(towerId, 'betSlow', effectiveBlueprint));
        const slowPercent = Math.min(60, Math.max(0, 20 + 2 * bet1));
        return [
          {
            expression: String.raw`\( \text{Slw\%} = 20 + 2\,\text{Bet}_{1} \)`,
            values: String.raw`\( ${formatDecimal(slowPercent, 2)}\% = 20 + 2 \times ${formatWholeNumber(bet1)} \)`,
          },
          {
            expression: String.raw`\( \text{Slw\%} \leq 60 \)`,
            glyphEquation: true,
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const attack = Number.isFinite(values.attack) ? values.attack : 0;
    const speed = Number.isFinite(values.speed) ? values.speed : 0;
    const range = Number.isFinite(values.range) ? values.range : 0;
    const slowPercent = Number.isFinite(values.slw) ? Math.max(0, values.slw) : 0;
    const slowFactor = slowPercent / 100;
    return attack * speed * range * slowFactor;
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const attack = Number.isFinite(values.attack) ? values.attack : 0;
    const speed = Number.isFinite(values.speed) ? values.speed : 0;
    const range = Number.isFinite(values.range) ? values.range : 0;
    const slowPercent = Number.isFinite(values.slw) ? Math.max(0, values.slw) : 0;
    const slowText = `${formatComponent(slowPercent)}%`;
    return `${formatComponent(result)} = ${formatComponent(attack)} × ${formatComponent(speed)} × ${formatComponent(range)} × ${slowText}`;
  },
};

export const gamma = {
  mathSymbol: String.raw`\gamma`,
  baseEquation: 'γ = Atk × Spd × Rng × Prc',
  variables: [
    {
      key: 'attack',
      symbol: 'Atk',
      equationSymbol: 'Atk',
      glyphLabel: 'ℵ₁',
      name: 'Atk',
      description: 'Strike intensity carried forward from β.',
      upgradable: true,
      format: (value) => `${formatGameNumber(value)} Atk`,
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const state = ctx().ensureTowerUpgradeState(towerId, effectiveBlueprint);
        const level = state.variables?.attack?.level || 0;
        const glyphRank = ctx().deriveGlyphRankFromLevel(level, 1);
        const betaValue = ctx().calculateTowerEquationResult('beta');
        return betaValue * glyphRank;
      },
      getSubEquations({ level }) {
        const glyphRank = ctx().deriveGlyphRankFromLevel(level, 1);
        const betaValue = ctx().calculateTowerEquationResult('beta');
        const attackValue = betaValue * glyphRank;
        return [
          {
            expression: String.raw`\( \text{Atk} = \beta \times \aleph_{1} \)`,
            values: String.raw`\( ${formatDecimal(attackValue, 2)} = ${formatDecimal(betaValue, 2)} \times ${formatWholeNumber(glyphRank)} \)`,
          },
        ];
      },
    },
    {
      key: 'speed',
      symbol: 'Spd',
      equationSymbol: 'Spd',
      name: 'Spd',
      description: 'Cadence tuned by neighbouring α lattices.',
      upgradable: false,
      lockedNote: 'Link α lattices to accelerate γ cadence.',
      computeValue() {
        const alphaConnections = ctx().getDynamicConnectionCount('alpha');
        return 0.5 + 0.25 * alphaConnections;
      },
      format: (value) => `${formatDecimal(value, 2)} Spd`,
      getSubEquations() {
        const alphaConnections = ctx().getDynamicConnectionCount('alpha');
        const speedValue = 0.5 + 0.25 * alphaConnections;
        return [
          {
            expression: String.raw`\( \text{Spd} = 0.5 + 0.25 \left( \alpha_{\gamma} \right) \)`,
            values: String.raw`\( ${formatDecimal(speedValue, 2)} = 0.5 + 0.25 \left( ${formatWholeNumber(alphaConnections)} \right) \)`,
          },
        ];
      },
    },
    {
      key: 'range',
      symbol: 'Rng',
      equationSymbol: 'Rng',
      name: 'Rng',
      description: 'Arc reach extended by neighbouring β conductors.',
      upgradable: false,
      lockedNote: 'Bind β lattices to extend γ reach.',
      computeValue() {
        const betaConnections = ctx().getDynamicConnectionCount('beta');
        return 1 + 2 * betaConnections;
      },
      format: (value) => `${formatDecimal(value, 2)} Rng`,
      getSubEquations() {
        const betaConnections = ctx().getDynamicConnectionCount('beta');
        const rangeValue = 1 + 2 * betaConnections;
        return [
          {
            expression: String.raw`\( \text{Rng} = 1 + 2 \left( \beta_{\gamma} \right) \)`,
            values: String.raw`\( ${formatDecimal(rangeValue, 2)} = 1 + 2 \left( ${formatWholeNumber(betaConnections)} \right) \)`,
          },
        ];
      },
    },
    {
      key: 'pierce',
      symbol: 'Prc',
      equationSymbol: 'Prc',
      glyphLabel: 'ℵ₂',
      name: 'Prc',
      description: 'Piercing depth braided from the second glyph conduit.',
      baseValue: 1,
      step: 1,
      upgradable: true,
      format: (value) => `${formatWholeNumber(value)} Prc`,
      getSubEquations({ level, value }) {
        const glyphRank = ctx().deriveGlyphRankFromLevel(level, 1);
        const pierceValue = Number.isFinite(value) ? value : glyphRank;
        return [
          {
            expression: String.raw`\( \text{Prc} = \aleph_{2} \)`,
            values: String.raw`\( ${formatWholeNumber(pierceValue)} = ${formatWholeNumber(glyphRank)} \)`,
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const attack = Number.isFinite(values.attack) ? values.attack : 0;
    const speed = Number.isFinite(values.speed) ? values.speed : 0;
    const range = Number.isFinite(values.range) ? values.range : 0;
    const pierce = Number.isFinite(values.pierce) ? values.pierce : 0;
    return attack * speed * range * pierce;
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const attack = Number.isFinite(values.attack) ? values.attack : 0;
    const speed = Number.isFinite(values.speed) ? values.speed : 0;
    const range = Number.isFinite(values.range) ? values.range : 0;
    const pierce = Number.isFinite(values.pierce) ? values.pierce : 0;
    return `${formatComponent(result)} = ${formatComponent(attack)} × ${formatComponent(speed)} × ${formatComponent(range)} × ${formatComponent(pierce)}`;
  },
};
