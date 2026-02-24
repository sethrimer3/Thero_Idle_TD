import {
  formatWholeNumber,
  formatDecimal,
  formatGameNumber,
} from '../../../scripts/core/formatting.js';
import { blueprintContext } from '../blueprintContext.js';

const ctx = () => blueprintContext;

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
