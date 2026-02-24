import {
  formatWholeNumber,
  formatDecimal,
} from '../../../scripts/core/formatting.js';
import { blueprintContext } from '../blueprintContext.js';

const ctx = () => blueprintContext;

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
