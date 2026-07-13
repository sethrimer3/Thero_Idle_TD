import {
  formatWholeNumber,
  formatDecimal,
  formatGameNumber,
} from '../../../scripts/core/formatting.js';
import { blueprintContext } from '../blueprintContext.js';

const ctx = () => blueprintContext;

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
