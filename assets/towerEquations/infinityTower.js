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
        // Base exponent is ln(unspentThero); upgrades influence other sub-equations
        const baseExponent = Math.log(unspentThero);
        return Math.max(0, baseExponent);
      },
      getSubEquations({ level, value, dynamicContext }) {
        const unspentThero = Number.isFinite(dynamicContext?.unspentThero)
          ? Math.max(1, dynamicContext.unspentThero)
          : 1;
        const baseExponent = Math.log(unspentThero);
        const exponentValue = Number.isFinite(value) ? value : baseExponent;

        return [
          {
            expression: String.raw`\( \text{Exp} = \ln(\text{þ}) \)`,
            values: String.raw`\( ${formatDecimal(exponentValue, 2)} = \ln(${formatGameNumber(unspentThero)}) \)`,
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
      upgradable: false,
      baseValue: EULER,
      step: 0.1,
      format: (value) => `×${formatDecimal(value, 2)}`,
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        // Read individual glyph allocations from the 6 glyph variables
        const alephVal = ctx().computeTowerVariableValue(towerId, 'mulAleph', effectiveBlueprint);
        const betVal = ctx().computeTowerVariableValue(towerId, 'mulBet', effectiveBlueprint);
        const lamedVal = ctx().computeTowerVariableValue(towerId, 'mulLamed', effectiveBlueprint);
        const tsadiVal = ctx().computeTowerVariableValue(towerId, 'mulTsadi', effectiveBlueprint);
        const shinVal = ctx().computeTowerVariableValue(towerId, 'mulShin', effectiveBlueprint);
        const kufVal = ctx().computeTowerVariableValue(towerId, 'mulKuf', effectiveBlueprint);

        const glyphAllocations = {
          aleph: Math.max(1, Number.isFinite(alephVal) ? alephVal : 1),
          bet: Math.max(1, Number.isFinite(betVal) ? betVal : 1),
          lamed: Math.max(1, Number.isFinite(lamedVal) ? lamedVal : 1),
          tsadi: Math.max(1, Number.isFinite(tsadiVal) ? tsadiVal : 1),
          shin: Math.max(1, Number.isFinite(shinVal) ? shinVal : 1),
          kuf: Math.max(1, Number.isFinite(kufVal) ? kufVal : 1),
        };

        const product = Object.values(glyphAllocations).reduce(
          (total, count) => total * count,
          1
        );

        const fusedMultiplier = Math.log(product);
        return Math.max(1, fusedMultiplier);
      },
      getSubEquations({ blueprint, towerId, value }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        // Read individual glyph allocations from the 6 glyph variables
        const alephVal = ctx().computeTowerVariableValue(towerId, 'mulAleph', effectiveBlueprint);
        const betVal = ctx().computeTowerVariableValue(towerId, 'mulBet', effectiveBlueprint);
        const lamedVal = ctx().computeTowerVariableValue(towerId, 'mulLamed', effectiveBlueprint);
        const tsadiVal = ctx().computeTowerVariableValue(towerId, 'mulTsadi', effectiveBlueprint);
        const shinVal = ctx().computeTowerVariableValue(towerId, 'mulShin', effectiveBlueprint);
        const kufVal = ctx().computeTowerVariableValue(towerId, 'mulKuf', effectiveBlueprint);

        const glyphAllocations = {
          aleph: Math.max(1, Number.isFinite(alephVal) ? alephVal : 1),
          bet: Math.max(1, Number.isFinite(betVal) ? betVal : 1),
          lamed: Math.max(1, Number.isFinite(lamedVal) ? lamedVal : 1),
          tsadi: Math.max(1, Number.isFinite(tsadiVal) ? tsadiVal : 1),
          shin: Math.max(1, Number.isFinite(shinVal) ? shinVal : 1),
          kuf: Math.max(1, Number.isFinite(kufVal) ? kufVal : 1),
        };
        const product = Object.values(glyphAllocations).reduce(
          (total, count) => total * count,
          1
        );
        const multiplierValue = Number.isFinite(value) ? value : Math.max(1, Math.log(product));

        return [
          {
            expression: String.raw`\( \text{Mul} = \ln(\aleph \times \text{ב} \times \text{ל} \times \text{צ} \times \text{ש} \times \text{ק}) \)`,
            values: String.raw`\( ${formatDecimal(multiplierValue, 2)} = \ln(${formatWholeNumber(glyphAllocations.aleph)} \times ${formatWholeNumber(glyphAllocations.bet)} \times ${formatWholeNumber(glyphAllocations.lamed)} \times ${formatWholeNumber(glyphAllocations.tsadi)} \times ${formatWholeNumber(glyphAllocations.shin)} \times ${formatWholeNumber(glyphAllocations.kuf)}) \)`,
            glyphEquation: true,
          },
          {
            expression: String.raw`\( \text{Allocate glyphs below to boost the fused product} \)`,
            variant: 'note',
          },
        ];
      },
    },
    // Individual glyph allocation variables for the Mul sub-equation
    {
      key: 'mulAleph',
      symbol: 'ℵ',
      equationSymbol: 'ℵ',
      glyphLabel: 'ℵ',
      name: 'ℵ Glyph',
      description: 'Allocate Aleph glyphs to boost the Mul fusion product.',
      upgradable: true,
      baseValue: 1,
      step: 1,
      includeInMasterEquation: false,
      format: (value) => `${formatWholeNumber(Math.max(1, value))} ℵ`,
      cost: (level) => Math.max(1, Math.floor(5 * Math.pow(1.5, level))),
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const state = ctx().ensureTowerUpgradeState(towerId, effectiveBlueprint);
        const level = state.variables?.mulAleph?.level || 0;
        return Math.max(1, ctx().deriveGlyphRankFromLevel(level, 1));
      },
      getSubEquations({ value }) {
        const rank = Math.max(1, Number.isFinite(value) ? value : 1);
        return [
          {
            expression: String.raw`\( \aleph = ${formatWholeNumber(rank)} \)`,
            variant: 'values',
            glyphEquation: true,
          },
        ];
      },
    },
    {
      key: 'mulBet',
      symbol: 'ב',
      equationSymbol: 'ב',
      glyphLabel: 'ב',
      name: 'ב Glyph',
      description: 'Allocate Bet glyphs to boost the Mul fusion product.',
      upgradable: true,
      baseValue: 1,
      step: 1,
      includeInMasterEquation: false,
      format: (value) => `${formatWholeNumber(Math.max(1, value))} ב`,
      cost: (level) => Math.max(1, Math.floor(5 * Math.pow(1.5, level))),
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const state = ctx().ensureTowerUpgradeState(towerId, effectiveBlueprint);
        const level = state.variables?.mulBet?.level || 0;
        return Math.max(1, ctx().deriveGlyphRankFromLevel(level, 1));
      },
      getSubEquations({ value }) {
        const rank = Math.max(1, Number.isFinite(value) ? value : 1);
        return [
          {
            expression: String.raw`\( \text{ב} = ${formatWholeNumber(rank)} \)`,
            variant: 'values',
            glyphEquation: true,
          },
        ];
      },
    },
    {
      key: 'mulLamed',
      symbol: 'ל',
      equationSymbol: 'ל',
      glyphLabel: 'ל',
      name: 'ל Glyph',
      description: 'Allocate Lamed glyphs to boost the Mul fusion product.',
      upgradable: true,
      baseValue: 1,
      step: 1,
      includeInMasterEquation: false,
      format: (value) => `${formatWholeNumber(Math.max(1, value))} ל`,
      cost: (level) => Math.max(1, Math.floor(5 * Math.pow(1.5, level))),
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const state = ctx().ensureTowerUpgradeState(towerId, effectiveBlueprint);
        const level = state.variables?.mulLamed?.level || 0;
        return Math.max(1, ctx().deriveGlyphRankFromLevel(level, 1));
      },
      getSubEquations({ value }) {
        const rank = Math.max(1, Number.isFinite(value) ? value : 1);
        return [
          {
            expression: String.raw`\( \text{ל} = ${formatWholeNumber(rank)} \)`,
            variant: 'values',
            glyphEquation: true,
          },
        ];
      },
    },
    {
      key: 'mulTsadi',
      symbol: 'צ',
      equationSymbol: 'צ',
      glyphLabel: 'צ',
      name: 'צ Glyph',
      description: 'Allocate Tsadi glyphs to boost the Mul fusion product.',
      upgradable: true,
      baseValue: 1,
      step: 1,
      includeInMasterEquation: false,
      format: (value) => `${formatWholeNumber(Math.max(1, value))} צ`,
      cost: (level) => Math.max(1, Math.floor(5 * Math.pow(1.5, level))),
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const state = ctx().ensureTowerUpgradeState(towerId, effectiveBlueprint);
        const level = state.variables?.mulTsadi?.level || 0;
        return Math.max(1, ctx().deriveGlyphRankFromLevel(level, 1));
      },
      getSubEquations({ value }) {
        const rank = Math.max(1, Number.isFinite(value) ? value : 1);
        return [
          {
            expression: String.raw`\( \text{צ} = ${formatWholeNumber(rank)} \)`,
            variant: 'values',
            glyphEquation: true,
          },
        ];
      },
    },
    {
      key: 'mulShin',
      symbol: 'ש',
      equationSymbol: 'ש',
      glyphLabel: 'ש',
      name: 'ש Glyph',
      description: 'Allocate Shin glyphs to boost the Mul fusion product.',
      upgradable: true,
      baseValue: 1,
      step: 1,
      includeInMasterEquation: false,
      format: (value) => `${formatWholeNumber(Math.max(1, value))} ש`,
      cost: (level) => Math.max(1, Math.floor(5 * Math.pow(1.5, level))),
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const state = ctx().ensureTowerUpgradeState(towerId, effectiveBlueprint);
        const level = state.variables?.mulShin?.level || 0;
        return Math.max(1, ctx().deriveGlyphRankFromLevel(level, 1));
      },
      getSubEquations({ value }) {
        const rank = Math.max(1, Number.isFinite(value) ? value : 1);
        return [
          {
            expression: String.raw`\( \text{ש} = ${formatWholeNumber(rank)} \)`,
            variant: 'values',
            glyphEquation: true,
          },
        ];
      },
    },
    {
      key: 'mulKuf',
      symbol: 'ק',
      equationSymbol: 'ק',
      glyphLabel: 'ק',
      name: 'ק Glyph',
      description: 'Allocate Kuf glyphs to boost the Mul fusion product.',
      upgradable: true,
      baseValue: 1,
      step: 1,
      includeInMasterEquation: false,
      format: (value) => `${formatWholeNumber(Math.max(1, value))} ק`,
      cost: (level) => Math.max(1, Math.floor(5 * Math.pow(1.5, level))),
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const state = ctx().ensureTowerUpgradeState(towerId, effectiveBlueprint);
        const level = state.variables?.mulKuf?.level || 0;
        return Math.max(1, ctx().deriveGlyphRankFromLevel(level, 1));
      },
      getSubEquations({ value }) {
        const rank = Math.max(1, Number.isFinite(value) ? value : 1);
        return [
          {
            expression: String.raw`\( \text{ק} = ${formatWholeNumber(rank)} \)`,
            variant: 'values',
            glyphEquation: true,
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
