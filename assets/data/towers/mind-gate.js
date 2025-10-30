/**
 * Mind Gate tower definition modeling the base lattice at the lane terminus.
 */
export const MIND_GATE_TOWER = Object.freeze({
  id: 'mind-gate',
  symbol: 'ℵ₀',
  name: 'Mind Gate',
  tier: 0,
  tierLabel: 'Origin',
  placeable: false,
  baseCost: 0,
  damage: 0,
  rate: 0,
  range: 0,
  diameterMeters: 2.4,
  icon: 'assets/images/tower-aleph-null.svg',
  description:
    'Anchors the defense core—when the Mind Gate folds, inspiration and glyph conduits collapse.',
});

export default MIND_GATE_TOWER;
