import {
  formatWholeNumber,
  formatDecimal,
  formatGameNumber,
} from '../../../scripts/core/formatting.js';
import { blueprintContext } from '../blueprintContext.js';

const ctx = () => blueprintContext;

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
