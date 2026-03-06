import {
  formatWholeNumber,
  formatDecimal,
  formatGameNumber,
} from '../../../scripts/core/formatting.js';
import { blueprintContext } from '../blueprintContext.js';

const ctx = () => blueprintContext;

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
