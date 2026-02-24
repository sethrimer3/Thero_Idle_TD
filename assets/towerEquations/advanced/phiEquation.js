import {
  formatWholeNumber,
  formatDecimal,
  formatGameNumber,
} from '../../../scripts/core/formatting.js';
import { blueprintContext } from '../blueprintContext.js';

const ctx = () => blueprintContext;

const PHI_MAX_SEEDS = 32; // 1 + 2 + 3 + 5 + 8 + 13 golden seeds across Fibonacci rings.
const PHI_SEED_DAMAGE = 10; // Damage per seed hit.
const PHI_SEED_PIERCE = 2; // Enemies a seed can pierce before reseeding.
const PHI_GOLDEN_RATIO = 1.61803398875;
const PHI_GOLDEN_ANGLE_DEGREES = 137.5;

function resolvePhiPower() {
  const helpers = ctx();
  const phiRaw = typeof helpers?.calculateTowerEquationResult === 'function'
    ? helpers.calculateTowerEquationResult('phi')
    : 1;
  return Number.isFinite(phiRaw) && phiRaw > 0 ? phiRaw : 1;
}

export const phi = {
  mathSymbol: String.raw`\phi`,
  baseEquation: String.raw`\( \phi = \text{seeds} \times \text{dmg}_{\text{seed}} \times \text{pierce} \)`,
  variables: [
    {
      key: 'seeds',
      symbol: 'seeds',
      equationSymbol: String.raw`\text{seeds}`,
      masterEquationSymbol: 'Seeds',
      name: 'Golden Seeds',
      description: 'Total seeds spun across Fibonacci rings before a burst.',
      baseValue: PHI_MAX_SEEDS,
      upgradable: false,
      includeInMasterEquation: true,
      format: (value) => `${formatWholeNumber(Math.max(0, value || 0))} seeds`,
      getSubEquations() {
        return [
          { expression: String.raw`\( \text{seeds} = 1 + 2 + 3 + 5 + 8 + 13 \)` },
          {
            values: String.raw`\( ${formatWholeNumber(PHI_MAX_SEEDS)} = \sum_{k=1}^{6} F_k \)`,
            variant: 'values',
          },
        ];
      },
    },
    {
      key: 'seedDamage',
      symbol: 'dmg',
      equationSymbol: String.raw`\text{dmg}_{\text{seed}}`,
      masterEquationSymbol: 'Dmg',
      name: 'Seed Damage',
      description: 'Damage delivered by each seed impact.',
      baseValue: PHI_SEED_DAMAGE,
      upgradable: false,
      includeInMasterEquation: true,
      format: (value) => formatGameNumber(Math.max(0, value || 0)),
      getSubEquations({ value }) {
        const resolved = Math.max(0, Number.isFinite(value) ? value : PHI_SEED_DAMAGE);
        return [
          { expression: String.raw`\( \text{dmg}_{\text{seed}} = ${PHI_SEED_DAMAGE} \)` },
          { values: String.raw`\( ${formatGameNumber(resolved)} = ${formatGameNumber(PHI_SEED_DAMAGE)} \)` },
        ];
      },
    },
    {
      key: 'pierce',
      symbol: 'πrc',
      equationSymbol: String.raw`\text{pierce}`,
      masterEquationSymbol: 'Prc',
      name: 'Pierce Capacity',
      description: 'How many enemies a seed can tunnel through before reseeding.',
      baseValue: PHI_SEED_PIERCE,
      upgradable: false,
      includeInMasterEquation: true,
      format: (value) => `×${formatWholeNumber(Math.max(1, value || 1))}`,
      getSubEquations({ value }) {
        const pierce = Math.max(1, Number.isFinite(value) ? value : PHI_SEED_PIERCE);
        return [
          { expression: String.raw`\( \text{pierce} = ${PHI_SEED_PIERCE} \)` },
          { values: String.raw`\( ${formatWholeNumber(pierce)} = ${formatWholeNumber(PHI_SEED_PIERCE)} \)` },
        ];
      },
    },
    {
      key: 'goldenAngle',
      symbol: 'θ',
      equationSymbol: String.raw`\theta_{\text{golden}}`,
      masterEquationSymbol: 'Ang',
      name: 'Golden Angle',
      description: 'Spacing between seeds while they spiral outward.',
      baseValue: PHI_GOLDEN_ANGLE_DEGREES,
      upgradable: false,
      includeInMasterEquation: false,
      format: (value) => `${formatDecimal(Math.max(0, value || PHI_GOLDEN_ANGLE_DEGREES), 2)}°`,
      getSubEquations({ value }) {
        const ratio = PHI_GOLDEN_RATIO;
        const goldenAngle = Number.isFinite(value) ? value : PHI_GOLDEN_ANGLE_DEGREES;
        return [
          { expression: String.raw`\( \theta_{\text{golden}} = 360^{\circ} \times \left(1 - \frac{1}{\phi}\right) \)` },
          {
            values: String.raw`\( ${formatDecimal(goldenAngle, 2)}^{\circ} = 360^{\circ} \times \left(1 - \frac{1}{${formatDecimal(ratio, 3)}}\right) \)`,
            variant: 'values',
          },
        ];
      },
    },
  ],
  computeResult(values) {
    const seeds = Math.max(0, Number(values.seeds) || 0);
    const damage = Math.max(0, Number(values.seedDamage) || 0);
    const pierce = Math.max(1, Number(values.pierce) || 1);
    return seeds * damage * pierce;
  },
  formatBaseEquationValues({ values, result, formatComponent }) {
    const seeds = Math.max(0, Number(values.seeds) || 0);
    const damage = Math.max(0, Number(values.seedDamage) || 0);
    const pierce = Math.max(1, Number(values.pierce) || 1);
    return `${formatComponent(result)} = ${formatComponent(seeds)} × ${formatComponent(damage)} × ${formatComponent(pierce)}`;
  },
};
