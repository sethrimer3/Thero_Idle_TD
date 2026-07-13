/**
 * T2 Tower definition — draws a parametric curve around itself.
 * The player enables sin, cos, and/or tan independently for the x and y axes,
 * composing the curve as (Σ x-funcs(t), Σ y-funcs(t)).  Default: (cos t, sin t) — a circle.
 */
export const T2_TOWER = Object.freeze({
  id: 't2',
  symbol: 'T₂',
  name: 'T₂ Tower',
  tier: 0,
  baseCost: 1,
  damage: 10,
  rate: 0,
  range: 0.4,
  diameterMeters: 1,
  icon: 'assets/images/tower-t2.svg',
});

export default T2_TOWER;
