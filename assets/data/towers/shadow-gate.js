/**
 * Shadow Gate tower definition — the enemy spawn nexus that applies
 * debilitating curses to all enemies emerging from the void rift.
 */
export const SHADOW_GATE_TOWER = Object.freeze({
  id: 'shadow-gate',
  symbol: '𝔖',
  name: 'Shadow Gate',
  tier: 0,
  tierLabel: 'Origin',
  placeable: false,
  baseCost: 0,
  damage: 0,
  rate: 0,
  range: 0,
  diameterMeters: 2.4,
  icon: 'assets/sprites/gates%26track/enemyGate/enemyGateSymbol.png',
  description:
    'The enemy spawn rift—dark curses woven here weaken every foe that passes through its void.',
});

export default SHADOW_GATE_TOWER;
