import {
  formatWholeNumber,
  formatDecimal,
  formatGameNumber,
} from '../../../scripts/core/formatting.js';
import { blueprintContext } from '../blueprintContext.js';

const ctx = () => blueprintContext;

export const nu = {
  mathSymbol: String.raw`\nu`,
  baseEquation: String.raw`\( \nu = \mu \times (\text{kills} + 1)^{\ln\left(\frac{\text{dmgtot}}{1000 / \text{Lamed}_{1}}\right)} \)`,
  variables: [
    {
      key: 'mu',
      symbol: 'μ',
      masterEquationSymbol: 'Mu',
      name: 'Attack',
      description: 'Base attack sourced from μ tower upgrades.',
      reference: 'mu',
      upgradable: false,
      lockedNote: 'Upgrade μ to increase ν base attack.',
      format: (value) => formatDecimal(value, 2),
      getSubEquations({ blueprint, towerId, value }) {
        const helpers = ctx();
        const effectiveBlueprint = blueprint || helpers.getTowerEquationBlueprint?.(towerId) || null;
        const muValue = Math.max(0, Number.isFinite(value) ? value : 0);
        const totalDamageRaw = helpers.computeTowerVariableValue?.(towerId, 'damageTotal', effectiveBlueprint);
        const damageTotal = Number.isFinite(totalDamageRaw) ? Math.max(0, totalDamageRaw) : 0;
        const killsRaw = helpers.computeTowerVariableValue?.(towerId, 'kills', effectiveBlueprint);
        const kills = Number.isFinite(killsRaw) ? Math.max(0, killsRaw) : 0;
        const lamed1Raw = helpers.computeTowerVariableValue?.('pi', 'lamed1', helpers.getTowerEquationBlueprint?.('pi'));
        const lamed1 = Math.max(1, Number.isFinite(lamed1Raw) ? lamed1Raw : 1);
        const killsPlusOne = 1 + kills;
        const exponentBase = damageTotal / (1000 / lamed1);
        const exponent = Math.log(Math.max(exponentBase, 1e-6));
        const attackRaw = muValue * Math.pow(killsPlusOne, exponent);
        const attack = Number.isFinite(attackRaw) ? attackRaw : 0;
        return [
          { expression: String.raw`\( atk = \mu \times (\text{kills} + 1)^{\ln\left(\frac{\text{dmgtot}}{1000 / \text{Lamed}_{1}}\right)} \)` },
          {
            values: String.raw`\( ${formatGameNumber(attack)} = ${formatGameNumber(muValue)} \times (${formatWholeNumber(killsPlusOne)}^{\ln(${formatDecimal(exponentBase, 2)})}) \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'damageTotal',
      symbol: 'dmgtot',
      equationSymbol: String.raw`\text{dmgtot}`,
      masterEquationSymbol: 'Dmg',
      name: 'Total Damage',
      description: 'Accumulated damage dealt (including overkill).',
      baseValue: 0,
      upgradable: false,
      format: (value) => formatDecimal(value, 2),
      computeValue({ dynamicContext }) {
        const overkill = dynamicContext?.stats?.nuOverkillTotal;
        return Number.isFinite(overkill) ? Math.max(0, overkill) : 0;
      },
      getSubEquations({ dynamicContext, value }) {
        const tracked = Number.isFinite(value) ? Math.max(0, value) : 0;
        const kills = Number.isFinite(dynamicContext?.stats?.nuKills)
          ? Math.max(0, dynamicContext.stats.nuKills)
          : 0;
        return [
          { expression: String.raw`\( \text{dmgtot} = \sum (\text{dmg}_{\text{final}} - \text{hp}_{\text{remaining}}) \)` },
          {
            values: String.raw`\( ${formatDecimal(tracked, 2)} = \text{Damage across } ${formatWholeNumber(kills)} \text{ kills} \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'kills',
      symbol: 'kills',
      equationSymbol: String.raw`\text{kills}`,
      masterEquationSymbol: 'Kil',
      name: 'Kill Count',
      description: 'Total enemies finished by ν beams.',
      baseValue: 0,
      upgradable: false,
      format: (value) => formatWholeNumber(Math.max(0, value || 0)),
      computeValue({ dynamicContext }) {
        const kills = dynamicContext?.stats?.nuKills;
        return Number.isFinite(kills) ? Math.max(0, kills) : 0;
      },
      getSubEquations({ value }) {
        const resolvedKills = Number.isFinite(value) ? Math.max(0, value) : 0;
        return [
          { expression: String.raw`\( \text{kills} = \sum \text{final blows} \)` },
          {
            values: String.raw`\( ${formatWholeNumber(resolvedKills)} = \text{Enemies defeated by } \nu \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'lamed1',
      symbol: 'ל₁',
      equationSymbol: String.raw`\text{Lamed}_{1}`,
      masterEquationSymbol: 'Las',
      name: 'Lamed₁ Beam Limit',
      description: 'Pulls beam cap strength from π to amplify ν exponent growth.',
      reference: 'pi',
      upgradable: false,
      lockedNote: 'Upgrade π (Lamed₁) to boost ν logarithmic scaling.',
      format: (value) => formatWholeNumber(Math.max(1, value || 1)),
      computeValue() {
        const helpers = ctx();
        const piBlueprint = helpers.getTowerEquationBlueprint?.('pi');
        const lamed1Raw = helpers.computeTowerVariableValue?.('pi', 'lamed1', piBlueprint);
        return Math.max(1, Number.isFinite(lamed1Raw) ? lamed1Raw : 1);
      },
      getSubEquations({ value }) {
        const lamed1 = Math.max(1, Number.isFinite(value) ? value : 1);
        return [
          { expression: String.raw`\( \text{Lamed}_{1} = \max(1, \pi_{\text{Lamed}_{1}}) \)` },
          {
            values: String.raw`\( ${formatWholeNumber(lamed1)} = \max(1, \pi_{\text{Lamed}_{1}}) \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'attackSpeed',
      symbol: 'spd',
      equationSymbol: String.raw`\text{spd}`,
      masterEquationSymbol: 'Spd',
      name: 'Attack Speed',
      description: 'Beam firings per second driven by kill count.',
      baseValue: 1,
      upgradable: false,
      format: (value) => `${formatDecimal(Math.max(0, value || 0), 2)} \text{ atk/s}`,
      computeValue({ dynamicContext }) {
        const kills = Number.isFinite(dynamicContext?.stats?.nuKills)
          ? Math.max(0, dynamicContext.stats.nuKills)
          : 0;
        return 1 + 0.1 * kills;
      },
      getSubEquations({ dynamicContext, value }) {
        const kills = Number.isFinite(dynamicContext?.stats?.nuKills)
          ? Math.max(0, dynamicContext.stats.nuKills)
          : 0;
        const speed = Number.isFinite(value) ? Math.max(0, value) : 1 + 0.1 * kills;
        return [
          { expression: String.raw`\( \text{spd} = 1 + 0.1 \times \text{kills} \)` },
          {
            values: String.raw`\( ${formatDecimal(speed, 2)} = 1 + 0.1 \times ${formatWholeNumber(kills)} \)` ,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'rangeMeters',
      symbol: 'rng',
      equationSymbol: String.raw`\text{rng}`,
      masterEquationSymbol: 'Rng',
      name: 'Range (m)',
      description: 'Beam reach in meters scaling with kills.',
      baseValue: 3,
      upgradable: false,
      format: (value) => `${formatDecimal(Math.max(0, value || 0), 2)} \text{ m}`,
      computeValue({ dynamicContext }) {
        const kills = Number.isFinite(dynamicContext?.stats?.nuKills)
          ? Math.max(0, dynamicContext.stats.nuKills)
          : 0;
        return 3 + 0.05 * kills;
      },
      getSubEquations({ dynamicContext, value }) {
        const kills = Number.isFinite(dynamicContext?.stats?.nuKills)
          ? Math.max(0, dynamicContext.stats.nuKills)
          : 0;
        const rangeMeters = Number.isFinite(value) ? Math.max(0, value) : 3 + 0.05 * kills;
        return [
          { expression: String.raw`\( \text{rng} = 3 + 0.05 \times \text{kills} \)` },
          {
            values: String.raw`\( ${formatDecimal(rangeMeters, 2)} = 3 + 0.05 \times ${formatWholeNumber(kills)} \)` ,
            variant: 'values',
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const muAttack = Math.max(0, Number.isFinite(values.mu) ? values.mu : 0);
    const damageTotal = Math.max(0, Number.isFinite(values.damageTotal) ? values.damageTotal : 0);
    const kills = Math.max(0, Number.isFinite(values.kills) ? values.kills : 0);
    const lamed1 = Math.max(1, Number.isFinite(values.lamed1) ? values.lamed1 : 1);
    const killsPlusOne = 1 + kills;
    const exponentInput = damageTotal / (1000 / lamed1);
    // Prevent log(0) and keep exponent finite for stable damage growth.
    const exponent = Math.log(Math.max(exponentInput, 1e-6));
    const attackRaw = muAttack * Math.pow(killsPlusOne, exponent);
    const attack = Number.isFinite(attackRaw) ? attackRaw : 0;
    return attack;
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const muAttack = Math.max(0, Number.isFinite(values.mu) ? values.mu : 0);
    const damageTotal = Math.max(0, Number.isFinite(values.damageTotal) ? values.damageTotal : 0);
    const kills = Math.max(0, Number.isFinite(values.kills) ? values.kills : 0);
    const lamed1 = Math.max(1, Number.isFinite(values.lamed1) ? values.lamed1 : 1);
    const exponentInput = damageTotal / (1000 / lamed1);
    const exponent = Math.log(Math.max(exponentInput, 1e-6));
    const killsPlusOne = 1 + kills;
    return `${formatComponent(result)} = ${formatComponent(muAttack)} × (${formatComponent(killsPlusOne)}^{${formatDecimal(exponent, 3)}})`;
  },
};
