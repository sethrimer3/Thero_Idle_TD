/**
 * Regression Tower definition — fits mathematical functions to graph points
 * and weaponises the resulting equation as a beam attack.
 */
export const REGRESSION_TOWER = Object.freeze({
  id: 'regression',
  symbol: 'R̂',
  name: 'Regression Tower',
  tier: 0,
  baseCost: 1,
  damage: 8,
  rate: 0,
  range: 0.4,
  diameterMeters: 1,
  icon: 'assets/images/tower-regression.svg',
  description: 'Fits y = mx + b to plotted points, firing a beam along the curve.',
});

export default REGRESSION_TOWER;
