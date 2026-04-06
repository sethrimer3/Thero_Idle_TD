/**
 * Polynomial Engine Tower definition — constructs and weaponises polynomial
 * curves of upgradeable degree.
 */
export const POLYNOMIAL_ENGINE_TOWER = Object.freeze({
  id: 'polynomial_engine',
  symbol: 'P̂',
  name: 'Polynomial Engine Tower',
  tier: 0,
  baseCost: 1,
  damage: 5,
  rate: 0,
  range: 0.4,
  diameterMeters: 1,
  icon: 'assets/images/tower-polynomial-engine.svg',
  description: 'Fits a polynomial to plotted points and applies damage along the curve.',
});

export default POLYNOMIAL_ENGINE_TOWER;
