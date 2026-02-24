/**
 * ψ (psi) tower blueprint capturing enemy merge mechanics.
 *
 * Merges enemies within range into PsiClusters with combined HP and sublinear speed.
 * Clusters explode on death dealing AoE damage.
 */

import {
  formatWholeNumber,
  formatDecimal,
} from '../../../scripts/core/formatting.js';
import { blueprintContext } from '../blueprintContext.js';

const ctx = () => blueprintContext;

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
