/**
 * Orbital Collapse Tower definition — radial distance from origin generates
 * potential energy that implodes in a two-stage collapse.
 */
export const ORBITAL_COLLAPSE_TOWER = Object.freeze({
  id: 'orbital_collapse',
  symbol: 'Ψ̂',
  name: 'Orbital Collapse Tower',
  tier: 0,
  baseCost: 1,
  damage: 4,
  rate: 0,
  range: 0.4,
  diameterMeters: 1,
  icon: 'assets/images/tower-orbital-collapse.svg',
  description: 'Distance from origin builds radial energy that implodes in two stages.',
});

export default ORBITAL_COLLAPSE_TOWER;
