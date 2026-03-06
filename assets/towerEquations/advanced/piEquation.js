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

import {
  formatWholeNumber,
  formatDecimal,
  formatGameNumber,
} from '../../../scripts/core/formatting.js';
import { blueprintContext } from '../blueprintContext.js';

const ctx = () => blueprintContext;

// Standardize the Bet₁ glyph with a dagesh and left-to-right isolation so the subscript renders on the right.
const BET1_GLYPH = '\u2066\u05D1\u05BC\u2081\u2069';

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
      symbol: BET1_GLYPH,
      equationSymbol: String.raw`\text{Bet}_{1}`,
      glyphLabel: BET1_GLYPH,
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
