/**
 * Kappa Tower definition extracted from the gameplay configuration.
 */
export const KAPPA_TOWER = Object.freeze({
  id: 'kappa',
  symbol: 'κ',
  name: 'Kappa Tower',
  tier: 10,
  baseCost: 200000000,
  damage: 320,
  rate: 0.8,
  range: 0.4,
  icon: 'assets/images/tower-kappa.svg',
  nextTierId: 'lambda',
});

export default KAPPA_TOWER;

