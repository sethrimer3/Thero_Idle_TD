/**
 * Greek Tower Blueprints
 * 
 * Mid-tier towers: delta, epsilon, zeta, eta, theta, iota.
 * These towers build upon the basic mechanics with more complex interactions.
 */

import {
  formatWholeNumber,
  formatDecimal,
  formatGameNumber,
  formatPercentage,
} from '../../scripts/core/formatting.js';
import { blueprintContext } from './blueprintContext.js';

// Helper function accessor for cleaner code
const ctx = () => blueprintContext;

export const delta = {
  mathSymbol: String.raw`\delta`,
  baseEquation: String.raw`\( \delta = \gamma \cdot \ln(\gamma + 1) \)`,
  variables: [
    {
      key: 'gamma',
      symbol: 'γ',
      masterEquationSymbol: 'Coh',
      name: 'Gamma Cohort',
      description: 'Command strength inherited entirely from γ conductors.',
      reference: 'gamma',
      upgradable: false,
      lockedNote: 'Bolster γ to empower this cohort.',
      format: (value) => formatDecimal(value, 2),
      getSubEquations({ value }) {
        const gammaValue = Math.max(0, Number.isFinite(value) ? value : 0);
        const logTerm = Math.log(gammaValue + 1);
        const attack = gammaValue * logTerm;
        const formattedAttack = Number.isFinite(attack) ? formatGameNumber(attack) : formatGameNumber(0);
        const formattedGamma = formatGameNumber(gammaValue);
        const formattedLog = Number.isFinite(logTerm) ? formatDecimal(logTerm, 3) : '0';
        return [
          { expression: String.raw`\( atk = \gamma \cdot \ln(\gamma + 1) \)` },
          {
            values: String.raw`\( ${formattedAttack} = ${formattedGamma} \cdot ${formattedLog} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph1',
      symbol: 'ℵ₁',
      equationSymbol: 'ℵ₁',
      name: 'Aleph₁ Phalanx',
      description:
        'Allocates ℵ₁ glyphs to Δ soldiers, amplifying vitality, muster, and training cadence.',
      baseValue: 1,
      step: 1,
      upgradable: true,
      includeInMasterEquation: false,
      maxLevel: 4,
      cost: (level) => {
        const normalizedLevel = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
        return 5 * 2 ** normalizedLevel;
      },
      format: (value) => {
        const rank = Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1;
        return `${formatWholeNumber(rank)} ℵ₁`;
      },
      getSubEquations({ value }) {
        const alephRank = Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1;
        const gammaDefinition = ctx().getTowerDefinition('gamma');
        const gammaEquation = ctx().calculateTowerEquationResult('gamma');
        const fallbackGamma = Number.isFinite(gammaDefinition?.damage)
          ? Math.max(1, gammaDefinition.damage)
          : 1;
        const gammaValue = Number.isFinite(gammaEquation) && gammaEquation > 0
          ? gammaEquation
          : fallbackGamma;
        const rawHealth = gammaValue ** alephRank;
        const health = Number.isFinite(rawHealth) ? Math.max(1, rawHealth) : Number.MAX_SAFE_INTEGER;
        const rawTrainingSeconds = 5 ** alephRank;
        const trainingSeconds = Number.isFinite(rawTrainingSeconds)
          ? Math.max(1, rawTrainingSeconds)
          : Number.MAX_SAFE_INTEGER;
        const totalSoldiers = 3 + alephRank;
        const formattedHealth = Number.isFinite(health)
          ? formatGameNumber(health)
          : formatGameNumber(Number.MAX_SAFE_INTEGER);
        const formattedGamma = Number.isFinite(gammaValue)
          ? formatGameNumber(gammaValue)
          : formatGameNumber(fallbackGamma);
        const formattedSpeed = Number.isFinite(trainingSeconds)
          ? formatGameNumber(trainingSeconds)
          : formatGameNumber(Number.MAX_SAFE_INTEGER);
        const formattedAleph = formatWholeNumber(alephRank);
        const formattedTotal = formatWholeNumber(totalSoldiers);
        return [
          { expression: String.raw`\( \text{Hlth} = \gamma^{\aleph_{1}} \)` },
          {
            values: String.raw`\( ${formattedHealth} = ${formattedGamma}^{${formattedAleph}} \)`,
            variant: 'values',
          },
          { expression: String.raw`\( \text{Spd} = 5^{\aleph_{1}} \)` },
          {
            values: String.raw`\( ${formattedSpeed}\,\text{s} = 5^{${formattedAleph}} \)`,
            variant: 'values',
          },
          { expression: String.raw`\( \text{Tot} = 3 + \aleph_{1} \)` },
          {
            values: String.raw`\( ${formattedTotal} = 3 + ${formattedAleph} \)`,
            variant: 'values',
          },
          {
            expression: String.raw`\( \aleph_{1} = ${formattedAleph} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'regen',
      symbol: 'Reg',
      equationSymbol: 'Reg',
      masterEquationSymbol: 'Reg',
      name: 'Regeneration',
      description: 'Health restored by each Δ soldier every second.',
      upgradable: false,
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const alephValue = ctx().computeTowerVariableValue(towerId, 'aleph1', effectiveBlueprint);
        const alephRank = Number.isFinite(alephValue) ? Math.max(1, Math.round(alephValue)) : 1;
        const gammaDefinition = ctx().getTowerDefinition('gamma');
        const gammaEquation = ctx().calculateTowerEquationResult('gamma');
        const fallbackGamma = Number.isFinite(gammaDefinition?.damage)
          ? Math.max(1, gammaDefinition.damage)
          : 1;
        const gammaValue = Number.isFinite(gammaEquation) && gammaEquation > 0
          ? gammaEquation
          : fallbackGamma;
        const rawHealth = gammaValue ** alephRank;
        const health = Number.isFinite(rawHealth) ? Math.max(1, rawHealth) : Number.MAX_SAFE_INTEGER;
        const regen = health / 20;
        return Number.isFinite(regen) ? regen : Number.MAX_SAFE_INTEGER;
      },
      format: (value) => `${formatGameNumber(Math.max(0, value))} hp/s`,
      getSubEquations({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const alephValue = ctx().computeTowerVariableValue(towerId, 'aleph1', effectiveBlueprint);
        const alephRank = Number.isFinite(alephValue) ? Math.max(1, Math.round(alephValue)) : 1;
        const gammaDefinition = ctx().getTowerDefinition('gamma');
        const gammaEquation = ctx().calculateTowerEquationResult('gamma');
        const fallbackGamma = Number.isFinite(gammaDefinition?.damage)
          ? Math.max(1, gammaDefinition.damage)
          : 1;
        const gammaValue = Number.isFinite(gammaEquation) && gammaEquation > 0
          ? gammaEquation
          : fallbackGamma;
        const rawHealth = gammaValue ** alephRank;
        const health = Number.isFinite(rawHealth) ? Math.max(1, rawHealth) : Number.MAX_SAFE_INTEGER;
        const regen = health / 20;
        const formattedRegen = Number.isFinite(regen)
          ? formatGameNumber(regen)
          : formatGameNumber(Number.MAX_SAFE_INTEGER);
        const formattedHealth = Number.isFinite(health)
          ? formatGameNumber(health)
          : formatGameNumber(Number.MAX_SAFE_INTEGER);
        return [
          { expression: String.raw`\( \text{Reg} = \text{Hlth} / 20 \)` },
          {
            values: String.raw`\( ${formattedRegen} = ${formattedHealth} / 20 \)`,
            variant: 'values',
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const gammaValue = Math.max(0, Number.isFinite(values.gamma) ? values.gamma : 0);
    const lnComponent = Math.log(gammaValue + 1);
    return gammaValue * lnComponent;
  },
  formatGoldenEquation({ formatVariable, formatResult }) {
    return `\\( ${formatResult()} = ${formatVariable('gamma')} \\times \\ln(${formatVariable('gamma')} + 1) \\)`;
  },
};

export const epsilon = {
  mathSymbol: String.raw`\varepsilon`,
  baseEquation: String.raw`\( \text{Atk} = (\text{NumHits})^{2} \)`,
  variables: [
    {
      key: 'aleph1',
      symbol: 'ℵ₁',
      name: 'Speed Aleph',
      masterEquationSymbol: 'Spd',
      description: 'Controls volley cadence for ε needles.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `${formatWholeNumber(value)} ℵ₁`,
      cost: (level) => Math.max(1, 1 + level),
      getSubEquations({ blueprint, towerId, level, value }) {
        const effective = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const rank = Math.max(0, Number.isFinite(value) ? value : 0);
        const spd = 10 * Math.log(rank + 1);
        return [
          { expression: String.raw`\( \text{Spd} = 10 \cdot \log(\aleph_{1} + 1) \)` },
          { values: String.raw`\( ${formatDecimal(spd, 2)} = 10 \cdot \log( ${formatWholeNumber(rank)} + 1 ) \)`, variant: 'values', glyphEquation: true },
        ];
      },
    },
    {
      key: 'aleph2',
      symbol: 'ℵ₂',
      name: 'Range Aleph',
      masterEquationSymbol: 'Rng',
      description: 'Expands ε homing range in meters.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `${formatWholeNumber(value)} ℵ₂`,
      cost: (level) => Math.max(1, 1 + level),
      getSubEquations({ blueprint, towerId, level, value }) {
        const rank = Math.max(0, Number.isFinite(value) ? value : 0);
        const rng = 5 * Math.log(rank + 2);
        return [
          { expression: String.raw`\( \text{Rng} = 5 \cdot \log(\aleph_{2} + 2) \)` },
          { values: String.raw`\( ${formatDecimal(rng, 2)} = 5 \cdot \log( ${formatWholeNumber(rank)} + 2 ) \)`, variant: 'values', glyphEquation: true },
        ];
      },
    },
    {
      key: 'aleph3',
      symbol: 'ℵ₃',
      name: 'Spread Aleph',
      masterEquationSymbol: 'Spr',
      description: 'Adjusts ε aim spread in degrees.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      format: (value) => `${formatWholeNumber(value)} ℵ₃`,
      cost: (level) => Math.max(1, 1 + level),
      getSubEquations({ blueprint, towerId, level, value }) {
        const rank = Math.max(0, Number.isFinite(value) ? value : 0);
        const component = rank <= 0 ? 0 : rank * Math.log(rank);
        const spr = 2 * (10 - component);
        return [
          { expression: String.raw`\( \text{Spr} = 2 ( 10 - \aleph_{3} \cdot \log(\aleph_{3}) ) \)` },
          { values: String.raw`\( ${formatDecimal(spr, 2)} = 2 ( 10 - ${formatWholeNumber(rank)} \cdot ${formatDecimal(rank > 0 ? Math.log(rank) : 0, 2)} ) \)`, variant: 'values', glyphEquation: true },
        ];
      },
    },
  ],
  computeResult(values) {
    // Not a simple multiplicative base; leave as 0 to avoid misleading total.
    return 0;
  },
  formatGoldenEquation() {
    return String.raw`\( \text{Atk} = (\text{NumHits})^{2} \)`;
  },
};
// η tower channels synchronized orbital upgrades that determine laser cadence,
// alignment thresholds, and range when planets line up.

export const zeta = {
  mathSymbol: String.raw`\zeta`,
  baseEquation: String.raw`\( \zeta = \text{Atk} \times \text{Crt} \times \text{Spd} \times \text{Rng} \times \text{Tot} \)`,
  variables: [
    {
      key: 'aleph1',
      symbol: 'ℵ₁',
      equationSymbol: 'ℵ₁',
      name: 'Aleph₁ Focus',
      description: 'Amplifies ζ’s base damage by threading additional glyph focus.',
      baseValue: 1,
      step: 1,
      upgradable: true,
      attachedToVariable: 'atk',
      format: (value) => `${formatWholeNumber(value)} focus`,
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : 1 + rank;
        return [
          {
            expression: String.raw`\( \aleph_{1} = 1 + \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = 1 + ${formatWholeNumber(rank)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph2',
      symbol: 'ℵ₂',
      equationSymbol: 'ℵ₂',
      name: 'Aleph₂ Velocity',
      description: 'Determines revolutions per second for each pendulum tier.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      attachedToVariable: 'spd',
      format: (value) => `${formatWholeNumber(Math.max(0, value))} tempo`,
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : rank;
        return [
          {
            expression: String.raw`\( \aleph_{2} = \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = ${formatWholeNumber(rank)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph3',
      symbol: 'ℵ₃',
      equationSymbol: 'ℵ₃',
      name: 'Aleph₃ Radius',
      description: 'Extends the arm length for the cascading pendulum links.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      maxLevel: 3,
      attachedToVariable: 'rng',
      format: (value) => `${formatWholeNumber(Math.max(0, value))} reach`,
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : rank;
        return [
          {
            expression: String.raw`\( \aleph_{3} = \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = ${formatWholeNumber(rank)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph4',
      symbol: 'ℵ₄',
      equationSymbol: 'ℵ₄',
      name: 'Aleph₄ Cascade',
      description: 'Unlocks additional pendulums trailing from ζ’s core.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      maxLevel: 2,
      attachedToVariable: 'tot',
      cost: (level) => {
        if (level === 0) {
          return 10;
        }
        if (level === 1) {
          return 10;
        }
        return Infinity;
      },
      format: (value) => `${formatWholeNumber(Math.max(0, value))} links`,
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : rank;
        return [
          {
            expression: String.raw`\( \aleph_{4} = \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = ${formatWholeNumber(rank)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph5',
      symbol: 'ℵ₅',
      equationSymbol: 'ℵ₅',
      name: 'Aleph₅ Spark',
      description: 'Feeds critical light into the pendulum strike zone.',
      baseValue: 1,
      step: 0.5,
      upgradable: true,
      attachedToVariable: 'crt',
      format: (value) => `×${formatDecimal(Math.max(0, value), 2)}`,
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : 1 + rank * 0.5;
        return [
          {
            expression: String.raw`\( \aleph_{5} = 1 + 0.5 \times \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(resolved, 2)} = 1 + 0.5 \times ${formatDecimal(rank, 2)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph6',
      symbol: 'ℵ₆',
      equationSymbol: 'ℵ₆',
      name: 'Aleph₆ Lens',
      description: 'Focuses the pendulum heads for sharper critical impacts.',
      baseValue: 1,
      step: 0.5,
      upgradable: true,
      attachedToVariable: 'crt',
      format: (value) => `×${formatDecimal(Math.max(0, value), 2)}`,
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : 1 + rank * 0.5;
        return [
          {
            expression: String.raw`\( \aleph_{6} = 1 + 0.5 \times \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(resolved, 2)} = 1 + 0.5 \times ${formatDecimal(rank, 2)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'crt',
      symbol: 'Crt',
      equationSymbol: 'Crt',
      name: 'Critical Multiplier',
      description: 'Applies when a pendulum head collides directly with an enemy.',
      upgradable: false,
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const aleph5 = ctx().computeTowerVariableValue(towerId, 'aleph5', effectiveBlueprint);
        const aleph6 = ctx().computeTowerVariableValue(towerId, 'aleph6', effectiveBlueprint);
        const product = Math.max(1, aleph5 * aleph6);
        return Number.isFinite(product) ? product : 1;
      },
      format: (value) => `×${formatDecimal(Math.max(1, value), 2)}`,
      getSubEquations({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const aleph5 = ctx().computeTowerVariableValue(towerId, 'aleph5', effectiveBlueprint);
        const aleph6 = ctx().computeTowerVariableValue(towerId, 'aleph6', effectiveBlueprint);
        const product = Math.max(1, aleph5 * aleph6);
        return [
          {
            expression: String.raw`\( \text{Crt} = \aleph_{5} \times \aleph_{6} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(product, 2)} = ${formatDecimal(aleph5, 2)} \times ${formatDecimal(aleph6, 2)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'atk',
      symbol: 'Atk',
      equationSymbol: 'Atk',
      name: 'Attack',
      description: 'Critical strike output woven from γ, ℵ₁, and the Crt multiplier.',
      upgradable: false,
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const gammaValue = Math.max(0, ctx().calculateTowerEquationResult('gamma'));
        const aleph1 = Math.max(1, ctx().computeTowerVariableValue(towerId, 'aleph1', effectiveBlueprint));
        const critical = Math.max(1, ctx().computeTowerVariableValue(towerId, 'crt', effectiveBlueprint));
        const attack = gammaValue * critical * aleph1;
        return Number.isFinite(attack) ? attack : 0;
      },
      format: (value) => `${formatGameNumber(Math.max(0, value))} attack`,
      getSubEquations({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const gammaValue = Math.max(0, ctx().calculateTowerEquationResult('gamma'));
        const aleph1 = Math.max(1, ctx().computeTowerVariableValue(towerId, 'aleph1', effectiveBlueprint));
        const critical = Math.max(1, ctx().computeTowerVariableValue(towerId, 'crt', effectiveBlueprint));
        const base = gammaValue * critical;
        const attack = base * aleph1;
        return [
          {
            expression: String.raw`\( \text{Atk} = \Gamma \times \text{Crt} \times \aleph_{1} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(attack, 2)} = ${formatDecimal(gammaValue, 2)} \times ${formatDecimal(critical, 2)} \times ${formatDecimal(aleph1, 2)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'spd',
      symbol: 'Spd',
      equationSymbol: 'Spd',
      name: 'Speed',
      description: 'Revolutions per second of the lead pendulum.',
      upgradable: false,
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const aleph2 = Math.max(0, ctx().computeTowerVariableValue(towerId, 'aleph2', effectiveBlueprint));
        const raw = 0.25 + 0.25 * aleph2;
        const clamped = Math.min(7, Math.max(0.25, raw));
        return Number.isFinite(clamped) ? clamped : 0.25;
      },
      format: (value) => `${formatDecimal(Math.max(0, value), 2)} rps`,
      getSubEquations({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const aleph2 = Math.max(0, ctx().computeTowerVariableValue(towerId, 'aleph2', effectiveBlueprint));
        const raw = 0.25 + 0.25 * aleph2;
        const clamped = Math.min(7, Math.max(0.25, raw));
        return [
          {
            expression: String.raw`\( \text{Spd} = \min(7,\; 0.25 + 0.25 \times \aleph_{2}) \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(clamped, 2)} = \min(7,\; 0.25 + 0.25 \times ${formatDecimal(aleph2, 2)}) \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'rng',
      symbol: 'Rng',
      equationSymbol: 'Rng',
      name: 'Range',
      description: 'Normalized arm length shared by each pendulum tier.',
      upgradable: false,
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const aleph3 = Math.max(0, ctx().computeTowerVariableValue(towerId, 'aleph3', effectiveBlueprint));
        const result = 1.5 + 0.5 * aleph3;
        return Number.isFinite(result) ? result : 1.5;
      },
      format: (value) => `${formatDecimal(Math.max(0, value), 2)} units`,
      getSubEquations({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const aleph3 = Math.max(0, ctx().computeTowerVariableValue(towerId, 'aleph3', effectiveBlueprint));
        const result = 1.5 + 0.5 * aleph3;
        return [
          {
            expression: String.raw`\( \text{Rng} = 1.5 + 0.5 \times \aleph_{3} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(result, 2)} = 1.5 + 0.5 \times ${formatDecimal(aleph3, 2)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'tot',
      symbol: 'Tot',
      equationSymbol: 'Tot',
      name: 'Total Pendulums',
      description: 'Number of cascading pendulums orbiting ζ.',
      upgradable: false,
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const aleph4 = Math.max(0, ctx().computeTowerVariableValue(towerId, 'aleph4', effectiveBlueprint));
        const clampedAleph4 = Math.min(2, aleph4);
        const total = 2 + clampedAleph4;
        return Number.isFinite(total) ? total : 2;
      },
      format: (value) => `${formatWholeNumber(Math.max(2, Math.round(value)))} pendulums`,
      getSubEquations({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const aleph4 = Math.max(0, ctx().computeTowerVariableValue(towerId, 'aleph4', effectiveBlueprint));
        const clampedAleph4 = Math.min(2, aleph4);
        const total = 2 + clampedAleph4;
        return [
          {
            expression: String.raw`\( \text{Tot} = 2 + \aleph_{4} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(total)} = 2 + ${formatWholeNumber(clampedAleph4)} \)`,
            variant: 'values',
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const attack = Number.isFinite(values.atk) ? values.atk : 0;
    const critical = Number.isFinite(values.crt) ? values.crt : 1;
    const speed = Number.isFinite(values.spd) ? values.spd : 0;
    const range = Number.isFinite(values.rng) ? values.rng : 0;
    const total = Number.isFinite(values.tot) ? values.tot : 0;
    return attack * critical * speed * range * total;
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const attack = Number.isFinite(values.atk) ? values.atk : 0;
    const critical = Number.isFinite(values.crt) ? values.crt : 1;
    const speed = Number.isFinite(values.spd) ? values.spd : 0;
    const range = Number.isFinite(values.rng) ? values.rng : 0;
    const total = Number.isFinite(values.tot) ? values.tot : 0;
    return `${formatComponent(result)} = ${formatComponent(attack)} × ${formatComponent(critical)} × ${formatComponent(speed)} × ${formatComponent(range)} × ${formatComponent(total)}`;
  },
};

export const eta = {
  mathSymbol: String.raw`\eta`,
  baseEquation: String.raw`\( \text{Eta} = \dots \)`,
  variables: [
    {
      key: 'atk',
      symbol: 'Atk',
      equationSymbol: 'Atk',
      name: 'Atk',
      description: null,
      upgradable: false,
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const gammaValue = Math.max(0, ctx().calculateTowerEquationResult('gamma'));
        const aleph1 = Math.max(
          1,
          ctx().computeTowerVariableValue(towerId, 'aleph1', effectiveBlueprint),
        );
        const critical = Math.max(
          0,
          ctx().computeTowerVariableValue(towerId, 'crt', effectiveBlueprint),
        );
        const base = Math.max(0, gammaValue * aleph1);
        const attack = critical === 0 ? 1 : base ** critical;
        return Number.isFinite(attack) ? attack : 0;
      },
      format: (value) => formatGameNumber(Math.max(0, value)),
      getSubEquations({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const gammaValue = Math.max(0, ctx().calculateTowerEquationResult('gamma'));
        const aleph1 = Math.max(
          1,
          ctx().computeTowerVariableValue(towerId, 'aleph1', effectiveBlueprint),
        );
        const critical = Math.max(
          0,
          ctx().computeTowerVariableValue(towerId, 'crt', effectiveBlueprint),
        );
        const base = Math.max(0, gammaValue * aleph1);
        const attack = critical === 0 ? 1 : base ** critical;
        return [
          {
            expression: String.raw`\( \text{Atk} = (\Gamma \cdot \aleph_{1})^{\text{Crt}} \)`,
          },
          {
            values: String.raw`\( ${formatGameNumber(attack)} = (${formatDecimal(
              gammaValue,
              2,
            )} \cdot ${formatWholeNumber(aleph1)})^{${formatDecimal(critical, 2)}} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph1',
      symbol: 'ℵ₁',
      equationSymbol: 'ℵ₁',
      name: 'Aleph₁',
      description: null,
      baseValue: 1,
      step: 1,
      upgradable: true,
      attachedToVariable: 'atk',
      format: (value) => formatWholeNumber(Math.max(1, value)),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : 1 + rank;
        return [
          {
            expression: String.raw`\( \aleph_{1} = 1 + \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = 1 + ${formatWholeNumber(rank)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'crt',
      symbol: 'Crt',
      equationSymbol: 'Crt',
      name: 'Crt',
      description: null,
      baseValue: 1,
      upgradable: false,
      format: (value) => formatDecimal(Math.max(0, value), 2),
      getSubEquations() {
        return [
          {
            expression: String.raw`\( \text{Crt} = \text{OrbitAlign} - 1 \)`,
          },
        ];
      },
    },
    {
      key: 'totRing',
      symbol: 'TotRing',
      equationSymbol: 'TotRing',
      name: 'TotRing',
      description: null,
      baseValue: 2,
      upgradable: false,
      includeInMasterEquation: false,
      format: (value) => formatWholeNumber(Math.max(0, value)),
      getSubEquations() {
        return [
          {
            expression: String.raw`\( \text{TotRing} = 2 + \eta' \)`,
          },
        ];
      },
    },
    {
      key: 'totOrb',
      symbol: 'TotOrb',
      equationSymbol: 'TotOrb',
      name: 'TotOrb',
      description: null,
      baseValue: 1,
      upgradable: false,
      includeInMasterEquation: false,
      format: (value) => formatWholeNumber(Math.max(0, value)),
      getSubEquations() {
        return [
          {
            expression: String.raw`\( \text{TotOrb} = \frac{n_{\text{Ring}} (n_{\text{Ring}} - 1)}{2} + 1 \)`,
          },
        ];
      },
    },
    {
      key: 'spdRing',
      symbol: 'SpdRing',
      equationSymbol: 'SpdRing',
      name: 'SpdRing',
      description: null,
      baseValue: 0,
      upgradable: false,
      includeInMasterEquation: false,
      format: () => '',
      getSubEquations({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const aleph2 = Math.max(
          1,
          ctx().computeTowerVariableValue(towerId, 'aleph2', effectiveBlueprint),
        );
        const aleph3 = Math.max(
          1,
          ctx().computeTowerVariableValue(towerId, 'aleph3', effectiveBlueprint),
        );
        const aleph4 = Math.max(
          1,
          ctx().computeTowerVariableValue(towerId, 'aleph4', effectiveBlueprint),
        );
        const aleph5 = Math.max(
          1,
          ctx().computeTowerVariableValue(towerId, 'aleph5', effectiveBlueprint),
        );
        const denominator = aleph2 + aleph3 + aleph4 + aleph5;
        const values = [
          {
            expression: String.raw`\( \text{SpdRing1} = \frac{1}{\aleph_{2} + \aleph_{3} + \aleph_{4} + \aleph_{5} + 10} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(1 / denominator, 3)} = \frac{1}{${formatWholeNumber(
              aleph2,
            )} + ${formatWholeNumber(aleph3)} + ${formatWholeNumber(aleph4)} + ${formatWholeNumber(
              aleph5,
            )}} \)`,
            variant: 'values',
          },
          {
            expression: String.raw`\( \text{SpdRing2} = \frac{1 + \aleph_{2}}{\aleph_{2} + \aleph_{3} + \aleph_{4} + \aleph_{5} + 10} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal((1 + aleph2) / denominator, 3)} = \frac{1 + ${formatWholeNumber(
              aleph2,
            )}}{${formatWholeNumber(aleph2)} + ${formatWholeNumber(aleph3)} + ${formatWholeNumber(
              aleph4,
            )} + ${formatWholeNumber(aleph5)}} \)`,
            variant: 'values',
          },
          {
            expression: String.raw`\( \text{SpdRing3} = \frac{1 + 2 \cdot \aleph_{3}}{\aleph_{2} + \aleph_{3} + \aleph_{4} + \aleph_{5} + 10} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal((1 + 2 * aleph3) / denominator, 3)} = \frac{1 + 2 \cdot ${formatWholeNumber(
              aleph3,
            )}}{${formatWholeNumber(aleph2)} + ${formatWholeNumber(aleph3)} + ${formatWholeNumber(
              aleph4,
            )} + ${formatWholeNumber(aleph5)}} \)`,
            variant: 'values',
          },
          {
            expression: String.raw`\( \text{SpdRing4} = \frac{2 + 3 \cdot \aleph_{4}}{\aleph_{2} + \aleph_{3} + \aleph_{4} + \aleph_{5} + 10} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal((2 + 3 * aleph4) / denominator, 3)} = \frac{2 + 3 \cdot ${formatWholeNumber(
              aleph4,
            )}}{${formatWholeNumber(aleph2)} + ${formatWholeNumber(aleph3)} + ${formatWholeNumber(
              aleph4,
            )} + ${formatWholeNumber(aleph5)}} \)`,
            variant: 'values',
          },
          {
            expression: String.raw`\( \text{SpdRing5} = \frac{1 + 2^{\aleph_{5}}}{\aleph_{2} + \aleph_{3} + \aleph_{4} + \aleph_{5} + 10} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal((1 + 2 ** aleph5) / denominator, 3)} = \frac{1 + 2^{${formatWholeNumber(
              aleph5,
            )}}}{${formatWholeNumber(aleph2)} + ${formatWholeNumber(aleph3)} + ${formatWholeNumber(
              aleph4,
            )} + ${formatWholeNumber(aleph5)}} \)`,
            variant: 'values',
          },
        ];
        return values;
      },
    },
    {
      key: 'aleph2',
      symbol: 'Aleph2',
      equationSymbol: 'Aleph2',
      name: 'Aleph2',
      description: null,
      baseValue: 1,
      step: 1,
      upgradable: true,
      attachedToVariable: 'spdRing',
      format: (value) => formatWholeNumber(Math.max(1, value)),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : 1 + rank;
        return [
          {
            expression: String.raw`\( \aleph_{2} = 1 + \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = 1 + ${formatWholeNumber(rank)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph3',
      symbol: 'Aleph3',
      equationSymbol: 'Aleph3',
      name: 'Aleph3',
      description: null,
      baseValue: 1,
      step: 1,
      upgradable: true,
      attachedToVariable: 'spdRing',
      format: (value) => formatWholeNumber(Math.max(1, value)),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : 1 + rank;
        return [
          {
            expression: String.raw`\( \aleph_{3} = 1 + \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = 1 + ${formatWholeNumber(rank)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph4',
      symbol: 'Aleph4',
      equationSymbol: 'Aleph4',
      name: 'Aleph4',
      description: null,
      baseValue: 1,
      step: 1,
      upgradable: true,
      attachedToVariable: 'spdRing',
      format: (value) => formatWholeNumber(Math.max(1, value)),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : 1 + rank;
        return [
          {
            expression: String.raw`\( \aleph_{4} = 1 + \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = 1 + ${formatWholeNumber(rank)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph5',
      symbol: 'Aleph5',
      equationSymbol: 'Aleph5',
      name: 'Aleph5',
      description: null,
      baseValue: 1,
      step: 1,
      upgradable: true,
      attachedToVariable: 'spdRing',
      format: (value) => formatWholeNumber(Math.max(1, value)),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : 1 + rank;
        return [
          {
            expression: String.raw`\( \aleph_{5} = 1 + \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = 1 + ${formatWholeNumber(rank)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'rng',
      symbol: 'Rng',
      equationSymbol: 'Rng',
      name: 'Rng',
      description: null,
      upgradable: false,
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const aleph6 = Math.max(
          1,
          ctx().computeTowerVariableValue(towerId, 'aleph6', effectiveBlueprint),
        );
        const clamped = Math.min(5, aleph6);
        return 5 + clamped;
      },
      format: (value) => formatDecimal(Math.max(0, value), 2),
      getSubEquations({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const aleph6 = Math.max(
          1,
          ctx().computeTowerVariableValue(towerId, 'aleph6', effectiveBlueprint),
        );
        const clamped = Math.min(5, aleph6);
        const total = 5 + clamped;
        return [
          {
            expression: String.raw`\( \text{Rng} = 5 + \aleph_{6} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(total, 2)} = 5 + ${formatDecimal(clamped, 2)} \)`,
            variant: 'values',
          },
          {
            expression: String.raw`\( \aleph_{6} \leq 5 \)`,
          },
        ];
      },
    },
    {
      key: 'aleph6',
      symbol: 'Aleph6',
      equationSymbol: 'Aleph6',
      name: 'Aleph6',
      description: null,
      baseValue: 1,
      step: 1,
      upgradable: true,
      maxLevel: 4,
      attachedToVariable: 'rng',
      format: (value) => formatWholeNumber(Math.max(1, value)),
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? level : 0);
        const resolved = Number.isFinite(value) ? value : 1 + rank;
        return [
          {
            expression: String.raw`\( \aleph_{6} = 1 + \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = 1 + ${formatWholeNumber(rank)} \)`,
            variant: 'values',
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const attack = Number.isFinite(values.atk) ? values.atk : 0;
    return attack;
  },
  formatGoldenEquation() {
    return String.raw`\( \text{Eta} = \dots \)`;
  },
};

export const theta = {
  mathSymbol: String.raw`\theta`,
  baseEquation: String.raw`\( \Theta = \text{Rng} \times \text{Slw} \)`,
  variables: [
    {
      key: 'rng',
      symbol: 'Rng',
      equationSymbol: 'Range',
      masterEquationSymbol: 'Rng',
      name: 'Range',
      description: 'Range of the slowing field.',
      upgradable: false,
      baseValue: 0.5,
      format: (value) => `${formatDecimal(Math.max(0, value), 2)} range`,
      getSubEquations() {
        return [
          {
            expression: String.raw`\( \text{Rng} = 0.5 \)`,
          },
          {
            values: String.raw`\( 0.5 = 0.5 \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'slw',
      symbol: 'Slw',
      equationSymbol: 'Slow',
      masterEquationSymbol: 'Slw',
      name: 'Slow',
      description: 'Percentage of enemy speed removed while within θ’s field.',
      upgradable: false,
      format: (value) => `${formatDecimal(Math.max(0, value), 2)}% slow`,
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const aleph1 = Math.max(0, ctx().computeTowerVariableValue(towerId, 'aleph1', effectiveBlueprint));
        const exponent = Math.exp(-0.1 * aleph1);
        const sinusoid = 1 + 0.1 * Math.sin(aleph1);
        const slowPercent = 95 * (1 - exponent * sinusoid) + 5;
        return Math.max(0, Math.min(100, slowPercent));
      },
      getSubEquations({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const aleph1 = Math.max(0, ctx().computeTowerVariableValue(towerId, 'aleph1', effectiveBlueprint));
        const exponent = Math.exp(-0.1 * aleph1);
        const sinusoid = 1 + 0.1 * Math.sin(aleph1);
        const slowPercent = 95 * (1 - exponent * sinusoid) + 5;
        const clamped = Math.max(0, Math.min(100, slowPercent));
        return [
          {
            expression: String.raw`\( \text{Slw} = 95 \left( 1 - e^{-0.1 \aleph_{1}} \left( 1 + 0.1 \sin(\aleph_{1}) \right) \right) + 5 \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(clamped, 2)}\% = 95 \left( 1 - e^{-0.1 \cdot ${formatDecimal(
              aleph1,
              2,
            )}} \left( 1 + 0.1 \sin(${formatDecimal(aleph1, 2)}) \right) \right) + 5 \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph1',
      symbol: 'ℵ₁',
      equationSymbol: 'ℵ₁',
      glyphLabel: 'ℵ₁',
      name: 'Aleph₁ Drift',
      description: 'Invest Aleph₁ glyphs to deepen θ’s initial slow potency.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      attachedToVariable: 'slw',
      cost: (level) => Math.max(1, 1 + Math.max(0, Math.floor(Number.isFinite(level) ? level : 0))),
      format: (value) => `${formatWholeNumber(Math.max(0, value))} ℵ₁`,
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? Math.floor(level) : 0);
        const resolved = Number.isFinite(value) ? Math.max(0, value) : rank;
        return [
          {
            expression: String.raw`\( \aleph_{1} = \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = ${formatWholeNumber(rank)} \)`,
            variant: 'values',
            glyphEquation: true,
          },
        ];
      },
    },
    {
      key: 'eff',
      symbol: 'Eff',
      equationSymbol: 'Eff',
      masterEquationSymbol: 'Eff',
      name: 'Efficacy',
      description: 'Remaining slow efficacy as enemies linger within the θ field.',
      upgradable: false,
      format: (value) => `${formatPercentage(Math.max(0, Math.min(1, value)))} @ entry`,
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const aleph2 = Math.max(1, ctx().computeTowerVariableValue(towerId, 'aleph2', effectiveBlueprint));
        const aleph3 = Math.max(0, ctx().computeTowerVariableValue(towerId, 'aleph3', effectiveBlueprint));
        const raw = 100 * Math.exp(1 / aleph2) * (1 + (1 / (1.1 + aleph3)) * Math.sin(0));
        return Math.max(0, raw) / 100;
      },
      getSubEquations({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const aleph2 = Math.max(1, ctx().computeTowerVariableValue(towerId, 'aleph2', effectiveBlueprint));
        const aleph3 = Math.max(0, ctx().computeTowerVariableValue(towerId, 'aleph3', effectiveBlueprint));
        const entryPercent = Math.max(0, 100 * Math.exp(1 / aleph2));
        return [
          {
            expression: String.raw`\( \text{Eff}(s) = 100\, e^{\left( \frac{1}{\aleph_{2}} \right) - s} \left( 1 + \frac{1}{1.1 + \aleph_{3}} \sin(4 s) \right) \)`,
          },
          {
            values: String.raw`\( \text{Eff}(0) = ${formatDecimal(entryPercent, 1)}\% \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'aleph2',
      symbol: 'ℵ₂',
      equationSymbol: 'ℵ₂',
      glyphLabel: 'ℵ₂',
      name: 'Aleph₂ Persistence',
      description: 'Extends how long θ retains full slow potency.',
      baseValue: 1,
      step: 1,
      upgradable: true,
      attachedToVariable: 'eff',
      cost: (level) => Math.max(1, 1 + Math.max(0, Math.floor(Number.isFinite(level) ? level : 0))),
      format: (value) => `${formatWholeNumber(Math.max(1, value))} ℵ₂`,
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? Math.floor(level) : 0);
        const resolved = Number.isFinite(value) ? Math.max(1, value) : 1 + rank;
        return [
          {
            expression: String.raw`\( \aleph_{2} = 1 + \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = 1 + ${formatWholeNumber(rank)} \)`,
            variant: 'values',
            glyphEquation: true,
          },
        ];
      },
    },
    {
      key: 'aleph3',
      symbol: 'ℵ₃',
      equationSymbol: 'ℵ₃',
      glyphLabel: 'ℵ₃',
      name: 'Aleph₃ Resonance',
      description: 'Stabilizes θ’s gravity well to reduce efficacy oscillation.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      attachedToVariable: 'eff',
      cost: (level) => Math.max(1, 1 + Math.max(0, Math.floor(Number.isFinite(level) ? level : 0))),
      format: (value) => `${formatWholeNumber(Math.max(0, value))} ℵ₃`,
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? Math.floor(level) : 0);
        const resolved = Number.isFinite(value) ? Math.max(0, value) : rank;
        return [
          {
            expression: String.raw`\( \aleph_{3} = \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = ${formatWholeNumber(rank)} \)`,
            variant: 'values',
            glyphEquation: true,
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const range = Number.isFinite(values.rng) ? values.rng : 0;
    const slow = Number.isFinite(values.slw) ? values.slw : 0;
    return range * slow;
  },
  formatBaseEquationValues({ values }) {
    const range = Number.isFinite(values.rng) ? values.rng : 0;
    const slow = Number.isFinite(values.slw) ? values.slw : 0;
    const result = range * slow;
    const rangeText = formatDecimal(range, 2);
    const slowText = `${formatDecimal(slow, 2)}%`;
    const resultText = formatDecimal(result, 2);
    return `${resultText} = ${rangeText} × ${slowText}`;
  },
};

export const iota = {
  mathSymbol: String.raw`\iota`,
  baseEquation: String.raw`\( \iota = \text{Atk} \times \text{Spd} \times m \)`,
  variables: [
    {
      key: 'aleph0',
      symbol: 'ℵ₀',
      equationSymbol: 'ℵ₀',
      glyphLabel: 'ℵ₀',
      name: 'Aleph₀ Reservoir',
      description: 'Baseline imaginary charge thickening the pulse radius.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      attachedToVariable: 'rangeMeters',
      cost: (level) => Math.max(1, 2 + Math.max(0, Math.floor(Number.isFinite(level) ? level : 0))),
      format: (value) => `${formatWholeNumber(Math.max(0, value))} ℵ₀`,
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? Math.floor(level) : 0);
        const resolved = Number.isFinite(value) ? Math.max(0, value) : rank;
        return [
          {
            expression: String.raw`\( \aleph_{0} = \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = ${formatWholeNumber(rank)} \)`,
            variant: 'values',
            glyphEquation: true,
          },
        ];
      },
    },
    {
      key: 'aleph1',
      symbol: 'ℵ₁',
      equationSymbol: 'ℵ₁',
      glyphLabel: 'ℵ₁',
      name: 'Aleph₁ Harmonics',
      description: 'Infuses the pulse with additional attack tempo and residue strength.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      attachedToVariable: 'spd',
      cost: (level) => Math.max(1, 3 + Math.max(0, Math.floor(Number.isFinite(level) ? level : 0))),
      format: (value) => `${formatWholeNumber(Math.max(0, value))} ℵ₁`,
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? Math.floor(level) : 0);
        const resolved = Number.isFinite(value) ? Math.max(0, value) : rank;
        return [
          {
            expression: String.raw`\( \aleph_{1} = \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = ${formatWholeNumber(rank)} \)`,
            variant: 'values',
            glyphEquation: true,
          },
        ];
      },
    },
    {
      key: 'aleph2',
      symbol: 'ℵ₂',
      equationSymbol: 'ℵ₂',
      glyphLabel: 'ℵ₂',
      name: 'Aleph₂ Diffusion',
      description: 'Stretches the pulse cadence while amplifying residue potency.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      attachedToVariable: 'spd',
      cost: (level) => Math.max(1, 4 + Math.max(0, Math.floor(Number.isFinite(level) ? level : 0))),
      format: (value) => `${formatWholeNumber(Math.max(0, value))} ℵ₂`,
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? Math.floor(level) : 0);
        const resolved = Number.isFinite(value) ? Math.max(0, value) : rank;
        return [
          {
            expression: String.raw`\( \aleph_{2} = \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = ${formatWholeNumber(rank)} \)`,
            variant: 'values',
            glyphEquation: true,
          },
        ];
      },
    },
    {
      key: 'aleph3',
      symbol: 'ℵ₃',
      equationSymbol: 'ℵ₃',
      glyphLabel: 'ℵ₃',
      name: 'Aleph₃ Echoes',
      description: 'Encodes deeper residue strength into the pulse falloff.',
      baseValue: 0,
      step: 1,
      upgradable: true,
      attachedToVariable: 'debuff',
      cost: (level) => Math.max(1, 5 + Math.max(0, Math.floor(Number.isFinite(level) ? level : 0))),
      format: (value) => `${formatWholeNumber(Math.max(0, value))} ℵ₃`,
      getSubEquations({ level, value }) {
        const rank = Math.max(0, Number.isFinite(level) ? Math.floor(level) : 0);
        const resolved = Number.isFinite(value) ? Math.max(0, value) : rank;
        return [
          {
            expression: String.raw`\( \aleph_{3} = \text{Level} \)`,
          },
          {
            values: String.raw`\( ${formatWholeNumber(resolved)} = ${formatWholeNumber(rank)} \)`,
            variant: 'values',
            glyphEquation: true,
          },
        ];
      },
    },
    {
      key: 'attack',
      symbol: 'Atk',
      equationSymbol: 'Atk',
      name: 'Pulse Attack',
      description: 'Total damage inverted across the splash radius before division among targets.',
      upgradable: false,
      format: (value) => `${formatGameNumber(Math.max(0, value))} damage`,
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const alphaLinks = Math.max(0, ctx().getDynamicConnectionCount('alpha'));
        const betaLinks = Math.max(0, ctx().getDynamicConnectionCount('beta'));
        const gammaLinks = Math.max(0, ctx().getDynamicConnectionCount('gamma'));
        const aleph0 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph0', effectiveBlueprint));
        const aleph1 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph1', effectiveBlueprint));
        const aleph2 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph2', effectiveBlueprint));
        const aleph3 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph3', effectiveBlueprint));
        const connectionMultiplier = 1 + 0.18 * alphaLinks + 0.24 * betaLinks;
        const gammaMultiplier = 1 + 0.45 * Math.sqrt(gammaLinks);
        const alephMultiplier = 1 + 0.35 * aleph0 + 0.25 * aleph1 + 0.2 * aleph2 + 0.15 * aleph3;
        const attack = 240 * connectionMultiplier * gammaMultiplier * alephMultiplier;
        return Math.max(0, attack);
      },
      getSubEquations({ blueprint, towerId, value }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const alphaLinks = Math.max(0, ctx().getDynamicConnectionCount('alpha'));
        const betaLinks = Math.max(0, ctx().getDynamicConnectionCount('beta'));
        const gammaLinks = Math.max(0, ctx().getDynamicConnectionCount('gamma'));
        const aleph0 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph0', effectiveBlueprint));
        const aleph1 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph1', effectiveBlueprint));
        const aleph2 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph2', effectiveBlueprint));
        const aleph3 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph3', effectiveBlueprint));
        const connectionMultiplier = 1 + 0.18 * alphaLinks + 0.24 * betaLinks;
        const gammaMultiplier = 1 + 0.45 * Math.sqrt(gammaLinks);
        const alephMultiplier = 1 + 0.35 * aleph0 + 0.25 * aleph1 + 0.2 * aleph2 + 0.15 * aleph3;
        const attack = Number.isFinite(value)
          ? Math.max(0, value)
          : 240 * connectionMultiplier * gammaMultiplier * alephMultiplier;
        const estimatedTargets = Math.max(1, alphaLinks + betaLinks + gammaLinks || 1);
        return [
          {
            expression: String.raw`\( \text{Atk} = 240 \cdot (1 + 0.18\,\alpha_{\iota} + 0.24\,\beta_{\iota}) \cdot (1 + 0.45 \sqrt{\gamma_{\iota}}) \cdot (1 + 0.35\,\aleph_{0} + 0.25\,\aleph_{1} + 0.20\,\aleph_{2} + 0.15\,\aleph_{3}) \)`,
          },
          {
            values: String.raw`\( ${formatGameNumber(attack)} = 240 \times ${formatDecimal(connectionMultiplier, 2)} \times ${formatDecimal(gammaMultiplier, 2)} \times ${formatDecimal(alephMultiplier, 2)} \)`,
            variant: 'values',
          },
          {
            expression: String.raw`\( \text{Atk}_{\text{per target}} = \frac{\text{Atk}}{\max(1, N_{\text{hit}})} \)`,
          },
          {
            values: String.raw`\( ${formatGameNumber(attack / estimatedTargets)} = \frac{${formatGameNumber(attack)}}{${formatWholeNumber(estimatedTargets)}} \)` ,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'spd',
      symbol: 'Spd',
      equationSymbol: 'Spd',
      name: 'Pulse Speed',
      description: 'Attacks per second; starts slow but accelerates with Aleph harmonics and lattice links.',
      upgradable: false,
      format: (value) => `${formatDecimal(Math.max(0, value), 2)} pulses/s`,
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const betaLinks = Math.max(0, ctx().getDynamicConnectionCount('beta'));
        const gammaLinks = Math.max(0, ctx().getDynamicConnectionCount('gamma'));
        const aleph1 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph1', effectiveBlueprint));
        const aleph2 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph2', effectiveBlueprint));
        const base = 0.22;
        const alephComponent = 0.05 * (1 - Math.exp(-0.6 * aleph1)) + 0.03 * (1 - Math.exp(-0.4 * aleph2));
        const linkComponent = 0.01 * (betaLinks + 0.5 * gammaLinks);
        const speed = base + alephComponent + linkComponent;
        return Math.max(0, speed);
      },
      getSubEquations({ blueprint, towerId, value }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const betaLinks = Math.max(0, ctx().getDynamicConnectionCount('beta'));
        const gammaLinks = Math.max(0, ctx().getDynamicConnectionCount('gamma'));
        const aleph1 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph1', effectiveBlueprint));
        const aleph2 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph2', effectiveBlueprint));
        const speed = Number.isFinite(value)
          ? Math.max(0, value)
          : 0.22 + 0.05 * (1 - Math.exp(-0.6 * aleph1)) + 0.03 * (1 - Math.exp(-0.4 * aleph2)) + 0.01 * (betaLinks + 0.5 * gammaLinks);
        return [
          {
            expression: String.raw`\( \text{Spd} = 0.22 + 0.05 \left( 1 - e^{-0.6 \aleph_{1}} \right) + 0.03 \left( 1 - e^{-0.4 \aleph_{2}} \right) + 0.01 \left( \beta_{\iota} + 0.5\,\gamma_{\iota} \right) \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(speed, 3)} = 0.22 + 0.05 \left( 1 - e^{-0.6 \cdot ${formatDecimal(aleph1, 2)}} \right) + 0.03 \left( 1 - e^{-0.4 \cdot ${formatDecimal(aleph2, 2)}} \right) + 0.01 \left( ${formatWholeNumber(betaLinks)} + 0.5 \cdot ${formatWholeNumber(gammaLinks)} \right) \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'rangeMeters',
      symbol: 'm',
      equationSymbol: 'Range',
      masterEquationSymbol: 'Rng',
      name: 'Splash Radius',
      description: 'Imaginary inversion radius measured in meters.',
      upgradable: false,
      format: (value) => `${formatDecimal(Math.max(0, value), 2)} m`,
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const alphaLinks = Math.max(0, ctx().getDynamicConnectionCount('alpha'));
        const betaLinks = Math.max(0, ctx().getDynamicConnectionCount('beta'));
        const gammaLinks = Math.max(0, ctx().getDynamicConnectionCount('gamma'));
        const aleph0 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph0', effectiveBlueprint));
        const aleph1 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph1', effectiveBlueprint));
        const aleph2 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph2', effectiveBlueprint));
        const alephTerm = 1.1 * Math.log(1 + aleph0 + 0.5 * aleph1 + 0.25 * aleph2);
        const linkTerm = 0.35 * Math.log(1 + alphaLinks + betaLinks + 0.5 * gammaLinks);
        const rangeMeters = 4.2 + alephTerm + linkTerm;
        return Math.max(0, rangeMeters);
      },
      getSubEquations({ blueprint, towerId, value }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const alphaLinks = Math.max(0, ctx().getDynamicConnectionCount('alpha'));
        const betaLinks = Math.max(0, ctx().getDynamicConnectionCount('beta'));
        const gammaLinks = Math.max(0, ctx().getDynamicConnectionCount('gamma'));
        const aleph0 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph0', effectiveBlueprint));
        const aleph1 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph1', effectiveBlueprint));
        const aleph2 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph2', effectiveBlueprint));
        const rangeMeters = Number.isFinite(value)
          ? Math.max(0, value)
          : 4.2 + 1.1 * Math.log(1 + aleph0 + 0.5 * aleph1 + 0.25 * aleph2) + 0.35 * Math.log(1 + alphaLinks + betaLinks + 0.5 * gammaLinks);
        return [
          {
            expression: String.raw`\( m = 4.2 + 1.1 \ln\bigl(1 + \aleph_{0} + 0.5 \aleph_{1} + 0.25 \aleph_{2}\bigr) + 0.35 \ln\bigl(1 + \alpha_{\iota} + \beta_{\iota} + 0.5 \gamma_{\iota}\bigr) \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(rangeMeters, 2)}\,\text{m} = 4.2 + 1.1 \ln\bigl(1 + ${formatDecimal(aleph0, 2)} + 0.5 \cdot ${formatDecimal(aleph1, 2)} + 0.25 \cdot ${formatDecimal(aleph2, 2)}\bigr) + 0.35 \ln\bigl(1 + ${formatWholeNumber(alphaLinks)} + ${formatWholeNumber(betaLinks)} + 0.5 \cdot ${formatWholeNumber(gammaLinks)}\bigr) \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'debuff',
      symbol: 'ΔD%',
      equationSymbol: 'Debuff',
      masterEquationSymbol: 'Deb',
      name: 'Imaginary Residue',
      description: 'Additional damage enemies suffer after the pulse inverts their colors.',
      upgradable: false,
      format: (value) => formatPercentage(Math.max(0, value)),
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const alphaLinks = Math.max(0, ctx().getDynamicConnectionCount('alpha'));
        const betaLinks = Math.max(0, ctx().getDynamicConnectionCount('beta'));
        const gammaLinks = Math.max(0, ctx().getDynamicConnectionCount('gamma'));
        const aleph1 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph1', effectiveBlueprint));
        const aleph2 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph2', effectiveBlueprint));
        const aleph3 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph3', effectiveBlueprint));
        const residue = 0.30 + 0.05 * alphaLinks + 0.06 * betaLinks + 0.08 * gammaLinks + 0.12 * aleph1 + 0.08 * aleph2 + 0.06 * aleph3;
        return Math.max(0, residue);
      },
      getSubEquations({ blueprint, towerId, value }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const alphaLinks = Math.max(0, ctx().getDynamicConnectionCount('alpha'));
        const betaLinks = Math.max(0, ctx().getDynamicConnectionCount('beta'));
        const gammaLinks = Math.max(0, ctx().getDynamicConnectionCount('gamma'));
        const aleph1 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph1', effectiveBlueprint));
        const aleph2 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph2', effectiveBlueprint));
        const aleph3 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph3', effectiveBlueprint));
        const residue = Number.isFinite(value)
          ? Math.max(0, value)
          : 0.30 + 0.05 * alphaLinks + 0.06 * betaLinks + 0.08 * gammaLinks + 0.12 * aleph1 + 0.08 * aleph2 + 0.06 * aleph3;
        return [
          {
            expression: String.raw`\( \Delta D\% = 0.30 + 0.05\,\alpha_{\iota} + 0.06\,\beta_{\iota} + 0.08\,\gamma_{\iota} + 0.12\,\aleph_{1} + 0.08\,\aleph_{2} + 0.06\,\aleph_{3} \)`,
          },
          {
            values: String.raw`\( ${formatPercentage(residue)} = 0.30 + 0.05 \cdot ${formatWholeNumber(alphaLinks)} + 0.06 \cdot ${formatWholeNumber(betaLinks)} + 0.08 \cdot ${formatWholeNumber(gammaLinks)} + 0.12 \cdot ${formatWholeNumber(aleph1)} + 0.08 \cdot ${formatWholeNumber(aleph2)} + 0.06 \cdot ${formatWholeNumber(aleph3)} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'debuffDuration',
      symbol: 'τ',
      equationSymbol: 'Duration',
      masterEquationSymbol: 'Dur',
      name: 'Residue Duration',
      description: 'Seconds that enemies remain weakened after being struck.',
      upgradable: false,
      format: (value) => `${formatDecimal(Math.max(0, value), 2)} s`,
      computeValue({ blueprint, towerId }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const alphaLinks = Math.max(0, ctx().getDynamicConnectionCount('alpha'));
        const betaLinks = Math.max(0, ctx().getDynamicConnectionCount('beta'));
        const gammaLinks = Math.max(0, ctx().getDynamicConnectionCount('gamma'));
        const aleph0 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph0', effectiveBlueprint));
        const aleph1 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph1', effectiveBlueprint));
        const aleph2 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph2', effectiveBlueprint));
        const duration = 3.5 + 0.5 * alphaLinks + 0.25 * betaLinks + 0.35 * Math.sqrt(gammaLinks) + 0.8 * Math.sqrt(aleph0) + 0.6 * aleph1 + 0.4 * aleph2;
        return Math.max(0, duration);
      },
      getSubEquations({ blueprint, towerId, value }) {
        const effectiveBlueprint = blueprint || ctx().getTowerEquationBlueprint(towerId);
        const alphaLinks = Math.max(0, ctx().getDynamicConnectionCount('alpha'));
        const betaLinks = Math.max(0, ctx().getDynamicConnectionCount('beta'));
        const gammaLinks = Math.max(0, ctx().getDynamicConnectionCount('gamma'));
        const aleph0 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph0', effectiveBlueprint));
        const aleph1 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph1', effectiveBlueprint));
        const aleph2 = Math.max(0, ctx().computeTowerVariableValue('iota', 'aleph2', effectiveBlueprint));
        const duration = Number.isFinite(value)
          ? Math.max(0, value)
          : 3.5 + 0.5 * alphaLinks + 0.25 * betaLinks + 0.35 * Math.sqrt(gammaLinks) + 0.8 * Math.sqrt(aleph0) + 0.6 * aleph1 + 0.4 * aleph2;
        return [
          {
            expression: String.raw`\( \tau = 3.5 + 0.5\,\alpha_{\iota} + 0.25\,\beta_{\iota} + 0.35\sqrt{\gamma_{\iota}} + 0.8\sqrt{\aleph_{0}} + 0.6\,\aleph_{1} + 0.4\,\aleph_{2} \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(duration, 2)}\,\text{s} = 3.5 + 0.5 \cdot ${formatWholeNumber(alphaLinks)} + 0.25 \cdot ${formatWholeNumber(betaLinks)} + 0.35 \sqrt{${formatWholeNumber(gammaLinks)}} + 0.8 \sqrt{${formatWholeNumber(aleph0)}} + 0.6 \cdot ${formatWholeNumber(aleph1)} + 0.4 \cdot ${formatWholeNumber(aleph2)} \)`,
            variant: 'values',
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const attack = Number.isFinite(values.attack) ? values.attack : 0;
    const speed = Number.isFinite(values.spd) ? values.spd : 0;
    const rangeMeters = Number.isFinite(values.rangeMeters) ? values.rangeMeters : 0;
    return attack * speed * rangeMeters;
  },
  formatBaseEquationValues({ values, formatComponent }) {
    const attack = Number.isFinite(values.attack) ? values.attack : 0;
    const speed = Number.isFinite(values.spd) ? values.spd : 0;
    const rangeMeters = Number.isFinite(values.rangeMeters) ? values.rangeMeters : 0;
    const result = attack * speed * rangeMeters;
    return `${formatComponent(result)} = ${formatComponent(attack)} × ${formatComponent(speed)} × ${formatComponent(rangeMeters)}`;
  },
};
