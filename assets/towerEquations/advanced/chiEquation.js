import {
  formatWholeNumber,
  formatDecimal,
  formatGameNumber,
  formatPercentage,
} from '../../../scripts/core/formatting.js';
import { blueprintContext } from '../blueprintContext.js';

const ctx = () => blueprintContext;

const CHI_BASE_HEALTH = 0.28;
const CHI_HEALTH_SCALE = 0.05;
const CHI_BASE_SPEED = 0.12;
const CHI_SPEED_SCALE = 0.035;

function clampChiValue(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function resolvePhiPower() {
  const helpers = ctx();
  const phiRaw = typeof helpers?.calculateTowerEquationResult === 'function'
    ? helpers.calculateTowerEquationResult('phi')
    : 1;
  return Number.isFinite(phiRaw) && phiRaw > 0 ? phiRaw : 1;
}

function resolveChiCorePower() {
  const phiPower = resolvePhiPower();
  const safePhi = Math.max(1, phiPower);
  return Math.max(1, safePhi * safePhi);
}

export const chi = {
  mathSymbol: String.raw`\chi`,
  baseEquation: String.raw`\( \chi = \text{core} \times \text{hpFrac} \times (1 + \text{spd}) \times \text{thralls} \)`,
  variables: [
    {
      key: 'phiAnchor',
      symbol: 'φ',
      masterEquationSymbol: 'Phi',
      name: 'Phi Anchor',
      description: 'Baseline power inherited from φ spirals.',
      reference: 'phi',
      upgradable: false,
      includeInMasterEquation: false,
      format: (value) => formatGameNumber(Math.max(0, value || 0)),
      getSubEquations({ value }) {
        const resolved = Math.max(0, Number.isFinite(value) ? value : resolvePhiPower());
        return [
          { expression: String.raw`\( \phi_{\text{anchor}} = \phi \)` },
          { values: String.raw`\( ${formatGameNumber(resolved)} = \phi \)` },
        ];
      },
    },
    {
      key: 'core',
      symbol: 'core',
      equationSymbol: String.raw`\chi_{\text{core}}`,
      masterEquationSymbol: 'Core',
      name: 'Gate Resonance',
      description: 'Thrall vitality sourced from φ².',
      upgradable: false,
      includeInMasterEquation: true,
      format: (value) => formatGameNumber(Math.max(1, value || 1)),
      computeValue() {
        return resolveChiCorePower();
      },
      getSubEquations({ value }) {
        const phiPower = resolvePhiPower();
        const core = Math.max(1, Number.isFinite(value) ? value : resolveChiCorePower());
        return [
          { expression: String.raw`\( \chi_{\text{core}} = \max(1, \phi^{2}) \)` },
          {
            values: String.raw`\( ${formatGameNumber(core)} = \max(1, ${formatGameNumber(phiPower)}^{2}) \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'healthFraction',
      symbol: 'hp%',
      equationSymbol: String.raw`\text{hpFrac}`,
      masterEquationSymbol: 'Hp',
      name: 'Thrall Vitality',
      description: 'Health fraction carried into each thrall.',
      upgradable: false,
      includeInMasterEquation: true,
      format: (value) => formatPercentage(Math.max(0, value || 0), 1),
      computeValue() {
        const core = resolveChiCorePower();
        const normalized = Math.log10(core + 1);
        return clampChiValue(CHI_BASE_HEALTH + normalized * CHI_HEALTH_SCALE, 0.25, 0.85);
      },
      getSubEquations({ value }) {
        const core = resolveChiCorePower();
        const normalized = Math.log10(core + 1);
        const health = Number.isFinite(value)
          ? value
          : clampChiValue(CHI_BASE_HEALTH + normalized * CHI_HEALTH_SCALE, 0.25, 0.85);
        return [
          {
            expression: String.raw`\( \text{hpFrac} = \operatorname{clamp}(0.28 + \log_{10}(\chi_{\text{core}} + 1) \times 0.05,\,0.25,\,0.85) \)`,
          },
          {
            values: String.raw`\( ${formatPercentage(health, 1)} = \operatorname{clamp}(0.28 + ${formatDecimal(normalized, 2)} \times 0.05,\,0.25,\,0.85) \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'speedBonus',
      symbol: 'spd',
      equationSymbol: String.raw`\text{spd}`,
      masterEquationSymbol: 'Spd',
      name: 'Gate Speed',
      description: 'Movement bonus applied to roaming thralls.',
      upgradable: false,
      includeInMasterEquation: true,
      format: (value) => `${formatDecimal(Math.max(0, value || 0), 2)}×`,
      computeValue() {
        const core = resolveChiCorePower();
        const normalized = Math.log10(core + 1);
        return clampChiValue(CHI_BASE_SPEED + normalized * CHI_SPEED_SCALE, 0.12, 1.8);
      },
      getSubEquations({ value }) {
        const core = resolveChiCorePower();
        const normalized = Math.log10(core + 1);
        const speed = Number.isFinite(value)
          ? value
          : clampChiValue(CHI_BASE_SPEED + normalized * CHI_SPEED_SCALE, 0.12, 1.8);
        return [
          {
            expression: String.raw`\( \text{spd} = \operatorname{clamp}(0.12 + \log_{10}(\chi_{\text{core}} + 1) \times 0.035,\,0.12,\,1.8) \)`,
          },
          {
            values: String.raw`\( ${formatDecimal(speed, 2)} = \operatorname{clamp}(0.12 + ${formatDecimal(normalized, 2)} \times 0.035,\,0.12,\,1.8) \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'maxThralls',
      symbol: 'thr',
      equationSymbol: String.raw`\text{thralls}`,
      masterEquationSymbol: 'Thr',
      name: 'Active Thralls',
      description: 'Total thralls patrolling between gates.',
      upgradable: false,
      includeInMasterEquation: true,
      format: (value) => formatWholeNumber(Math.max(1, value || 1)),
      computeValue() {
        const core = resolveChiCorePower();
        const normalized = Math.log10(core + 1);
        return Math.max(1, Math.round(2 + normalized));
      },
      getSubEquations({ value }) {
        const core = resolveChiCorePower();
        const normalized = Math.log10(core + 1);
        const thralls = Number.isFinite(value) ? value : Math.max(1, Math.round(2 + normalized));
        return [
          { expression: String.raw`\( \text{thralls} = 2 + \left\lfloor \log_{10}(\chi_{\text{core}} + 1) \right\rceil \)` },
          {
            values: String.raw`\( ${formatWholeNumber(thralls)} = 2 + \left\lfloor ${formatDecimal(normalized, 2)} \right\rceil \)`,
            variant: 'values',
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const core = Math.max(1, Number(values.core) || 1);
    const health = clampChiValue(Number(values.healthFraction) || 0, 0.25, 0.85);
    const speedBonus = Math.max(0, Number(values.speedBonus) || 0);
    const thralls = Math.max(1, Number(values.maxThralls) || 1);
    return core * health * thralls * (1 + speedBonus);
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const core = Math.max(1, Number(values.core) || 1);
    const health = clampChiValue(Number(values.healthFraction) || 0, 0.25, 0.85);
    const speedBonus = Math.max(0, Number(values.speedBonus) || 0);
    const thralls = Math.max(1, Number(values.maxThralls) || 1);
    return `${formatComponent(result)} = ${formatComponent(core)} × ${formatPercentage(health, 1)} × ${formatComponent(1 + speedBonus)} × ${formatComponent(thralls)}`;
  },
};
