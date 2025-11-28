/**
 * Infinity Tower Blueprint
 * 
 * The Infinity Tower provides exponential bonuses to all towers within its range.
 * It replaces the Aleph0-Aleph5 series with a unified support tower.
 */

import {
  formatWholeNumber,
  formatDecimal,
  formatGameNumber,
} from '../../scripts/core/formatting.js';
import { blueprintContext } from './blueprintContext.js';

// Helper function accessor
const ctx = () => blueprintContext;

// Euler's number for calculations
const EULER = Math.E; // ≈ 2.71828

export const infinity = {
  mathSymbol: String.raw`\infty`,
  baseEquation: String.raw`\( \infty = \text{Exp} \times \text{Rng} \)`,
  variables: [
    {
      key: 'exponent',
      symbol: 'Exp',
      equationSymbol: 'Exp',
      glyphLabel: 'ℵ₁',
      name: 'Exp',
      description: 'Exponent bonus applied to all towers within range. Equals the natural logarithm of player\'s unspent thero (money).',
      upgradable: true,
      baseValue: 1,
      step: 0.1,
      format: (value) => `${formatDecimal(value, 2)} Exp`,
      cost: (level) => Math.max(1, Math.floor(10 * Math.pow(1.5, level))),
      computeValue({ blueprint, towerId, dynamicContext }) {
        // Get player's unspent thero (money) from dynamic context
        const unspentThero = Number.isFinite(dynamicContext?.unspentThero)
          ? Math.max(1, dynamicContext.unspentThero)
          : 1;

        // Get upgrade level for this variable
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const state = ctx().ensureTowerUpgradeState(towerId, effectiveBlueprint);
        const level = state.variables?.exponent?.level || 0;
        const glyphRank = ctx().deriveGlyphRankFromLevel(level, 1);

        // Base exponent is ln(unspentThero), multiplied by glyph rank to reward upgrades
        const baseExponent = Math.log(unspentThero);
        return Math.max(0, baseExponent * glyphRank);
      },
      getSubEquations({ level, value, dynamicContext }) {
        const unspentThero = Number.isFinite(dynamicContext?.unspentThero)
          ? Math.max(1, dynamicContext.unspentThero)
          : 1;
        const glyphRank = ctx().deriveGlyphRankFromLevel(level, 1);
        const baseExponent = Math.log(unspentThero);
        const exponentValue = Number.isFinite(value) ? value : baseExponent * glyphRank;

        return [
          {
            expression: String.raw`\( \text{Exp} = \ln(\text{þ}) \times \aleph_{1} \)`,
            values: String.raw`\( ${formatDecimal(exponentValue, 2)} = \ln(${formatGameNumber(unspentThero)}) \times ${formatWholeNumber(glyphRank)} \)`,
          },
          {
            expression: String.raw`\( \text{þ} = \text{unspent thero (player money)} \)`,
            variant: 'note',
          },
        ];
      },
    },
    {
      key: 'range',
      symbol: 'Rng',
      equationSymbol: 'Rng',
      glyphLabel: 'ℵ₂',
      name: 'Rng',
      description: 'Radius of effect in meters. Base range is 2×e (Euler\'s number).',
      upgradable: true,
      baseValue: 2 * EULER,
      step: 0.5,
      format: (value) => `${formatDecimal(value, 2)}m`,
      cost: (level) => Math.max(1, Math.floor(15 * Math.pow(1.4, level))),
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const state = ctx().ensureTowerUpgradeState(towerId, effectiveBlueprint);
        const level = state.variables?.range?.level || 0;
        const glyphRank = ctx().deriveGlyphRankFromLevel(level, 1);
        
        // Base range is 2×e, extended by glyph upgrades
        const baseRange = 2 * EULER;
        return baseRange + (glyphRank - 1) * 0.5;
      },
      getSubEquations({ level, value }) {
        const glyphRank = ctx().deriveGlyphRankFromLevel(level, 1);
        const rangeValue = Number.isFinite(value) ? value : (2 * EULER);
        
        return [
          {
            expression: String.raw`\( \text{Rng} = 2e + 0.5(\aleph_{2} - 1) \)`,
            values: String.raw`\( ${formatDecimal(rangeValue, 2)} = ${formatDecimal(2 * EULER, 2)} + 0.5(${formatWholeNumber(glyphRank)} - 1) \)`,
          },
          {
            expression: String.raw`\( e \approx 2.718 \text{ (Euler's number)} \)`,
            variant: 'note',
          },
        ];
      },
    },
    {
      key: 'bonusMultiplier',
      symbol: 'Mul',
      equationSymbol: 'Mul',
      glyphLabel: 'ℵ₃',
      name: 'Mul',
      description: 'Bonus multiplier base derived from a glyph fusion product inside a natural log.',
      upgradable: true,
      baseValue: EULER,
      step: 0.1,
      format: (value) => `×${formatDecimal(value, 2)}`,
      cost: (level) => Math.max(1, Math.floor(20 * Math.pow(1.6, level))),
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const state = ctx().ensureTowerUpgradeState(towerId, effectiveBlueprint);
        const level = state.variables?.bonusMultiplier?.level || 0;
        const glyphRank = ctx().deriveGlyphRankFromLevel(level, 1);
        const glyphAllocations = {
          aleph: Math.max(1, glyphRank),
          bet: Math.max(1, glyphRank),
          lamed: Math.max(1, glyphRank),
          tsadi: Math.max(1, glyphRank),
          shin: Math.max(1, glyphRank),
          kuf: Math.max(1, glyphRank),
        };

        const product = Object.values(glyphAllocations).reduce(
          (total, count) => total * count,
          1
        );

        const fusedMultiplier = Math.log(product);
        return Math.max(1, fusedMultiplier);
      },
      getSubEquations({ level, value }) {
        const glyphRank = ctx().deriveGlyphRankFromLevel(level, 1);
        const glyphAllocations = {
          aleph: Math.max(1, glyphRank),
          bet: Math.max(1, glyphRank),
          lamed: Math.max(1, glyphRank),
          tsadi: Math.max(1, glyphRank),
          shin: Math.max(1, glyphRank),
          kuf: Math.max(1, glyphRank),
        };
        const product = Object.values(glyphAllocations).reduce(
          (total, count) => total * count,
          1
        );
        const multiplierValue = Number.isFinite(value) ? value : Math.max(1, Math.log(product));

        return [
          {
            expression: String.raw`\( \text{Mul} = \ln(\aleph_{1} \times \text{ב}_{1} \times \text{ל}_{1} \times \text{צ}_{1} \times \text{ש}_{1} \times \text{ק}_{1}) \)`,
            values: String.raw`\( ${formatDecimal(multiplierValue, 2)} = \ln(${formatWholeNumber(glyphAllocations.aleph)} \times ${formatWholeNumber(glyphAllocations.bet)} \times ${formatWholeNumber(glyphAllocations.lamed)} \times ${formatWholeNumber(glyphAllocations.tsadi)} \times ${formatWholeNumber(glyphAllocations.shin)} \times ${formatWholeNumber(glyphAllocations.kuf)}) \)`,
            glyphEquation: true,
          },
          {
            expression: String.raw`\( \text{Each glyph rank allocated boosts the fused product before taking } \ln \)`,
            variant: 'note',
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const exp = Number.isFinite(values.exponent) ? values.exponent : 0;
    const range = Number.isFinite(values.range) ? values.range : (2 * EULER);
    
    // The "power" of infinity tower is the product of its stats
    // This doesn't directly translate to damage but represents its support capability
    return Math.max(0, exp * range);
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const exp = Number.isFinite(values.exponent) ? values.exponent : 0;
    const range = Number.isFinite(values.range) ? values.range : (2 * EULER);
    
    return `${formatComponent(result)} = ${formatComponent(exp)} × ${formatComponent(range)}`;
  },
};
