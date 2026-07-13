/**
 * Infinity Tower mechanics and utilities.
 * 
 * The Infinity Tower provides exponential bonuses to all towers within its range.
 * The bonus is calculated as an exponent equal to the natural logarithm of the
 * player's unspent thero (money amount).
 * 
 * Mathematical formula:
 * - Range: 2×e meters (where e is Euler's number ≈ 2.71828)
 * - Exponent bonus: ln(unspentThero)
 * - Applied as: tower_damage × (base^exponent) where exponent = ln(unspentThero)
 */

// Constants
const EULER = Math.E; // ≈ 2.71828
const INFINITY_RANGE_METERS = 2 * EULER; // ≈ 5.4366 meters

/**
 * Calculate the exponent bonus provided by the Infinity Tower.
 * Formula: ln(þ) where þ is the player's unspent thero (money)
 * 
 * @param {number} unspentThero - Player's current unspent thero (money amount)
 * @returns {number} The exponent bonus (natural logarithm of unspent thero)
 */
export function calculateInfinityExponent(unspentThero) {
  // Ensure we have at least 1 to avoid ln(0) = -∞
  const safeThero = Math.max(1, Number.isFinite(unspentThero) ? unspentThero : 1);
  return Math.log(safeThero);
}

/**
 * Calculate the range of the Infinity Tower in meters.
 * Formula: 2×e (approximately 5.4366 meters)
 * 
 * @returns {number} Range in meters
 */
export function getInfinityRange() {
  return INFINITY_RANGE_METERS;
}

/**
 * Determine if a tower is within range of an Infinity Tower.
 * 
 * @param {Object} infinityTower - The infinity tower object with x, y coordinates
 * @param {Object} targetTower - The target tower object with x, y coordinates
 * @param {Function} distanceFunc - Function to calculate distance between two points
 * @returns {boolean} True if target is within range
 */
export function isTowerInInfinityRange(infinityTower, targetTower, distanceFunc) {
  if (!infinityTower || !targetTower || infinityTower.id === targetTower.id) {
    return false;
  }
  
  const distance = distanceFunc(
    infinityTower.x,
    infinityTower.y,
    targetTower.x,
    targetTower.y
  );
  
  return distance <= INFINITY_RANGE_METERS;
}

/**
 * Get all towers within range of an Infinity Tower.
 * 
 * @param {Object} infinityTower - The infinity tower object
 * @param {Array} allTowers - Array of all towers on the playfield
 * @param {Function} distanceFunc - Function to calculate distance
 * @returns {Array} Array of towers within range
 */
export function getTowersInInfinityRange(infinityTower, allTowers, distanceFunc) {
  if (!infinityTower || !Array.isArray(allTowers)) {
    return [];
  }
  
  return allTowers.filter(tower => 
    isTowerInInfinityRange(infinityTower, tower, distanceFunc)
  );
}

/**
 * Calculate the damage multiplier for a tower affected by Infinity Tower.
 * The multiplier uses the exponent as a power: base^exponent
 * where exponent = ln(unspentThero)
 * 
 * @param {number} baseDamage - The tower's base damage
 * @param {number} exponent - The exponent from calculateInfinityExponent
 * @param {number} base - The base for the exponential (default: e)
 * @returns {number} The multiplied damage value
 */
export function applyInfinityBonus(baseDamage, exponent, base = EULER) {
  if (!Number.isFinite(baseDamage) || baseDamage <= 0) {
    return baseDamage;
  }
  
  if (!Number.isFinite(exponent) || exponent <= 0) {
    return baseDamage;
  }
  
  // Apply exponential bonus: damage × base^exponent
  const multiplier = Math.pow(base, exponent);
  
  // Prevent infinite or NaN values
  if (!Number.isFinite(multiplier)) {
    return Number.MAX_VALUE;
  }
  
  const result = baseDamage * multiplier;
  return Number.isFinite(result) ? result : Number.MAX_VALUE;
}

/**
 * Configuration for infinity tower particle effects.
 */
export const INFINITY_PARTICLE_CONFIG = {
  towerType: 'infinity',
  // Golden color for the infinity tower's visual effects
  colors: [
    { r: 255, g: 215, b: 0 },   // Gold
    { r: 255, g: 235, b: 150 }, // Light gold
  ],
  lineColor: { r: 255, g: 215, b: 0, a: 0.6 }, // Semi-transparent gold for lines
  lineWidth: 2,
  pulseSpeed: 2.0, // Speed of pulsing effect on the lines
};

/**
 * Sub-equations for the Infinity Tower.
 * 
 * Master Equation: ∞ = Exp × Rng
 * Where:
 * - Exp (Exponent) = ln(þ) where þ is player's unspent thero (money)
 * - Rng (Range) = 2×e meters
 */
export const INFINITY_SUB_EQUATIONS = {
  /**
   * Exponent sub-equation.
   * Formula: Exp = ln(þ)
   * where þ = player's unspent thero (money amount)
   */
  exponent: {
    name: 'Exp',
    symbol: 'Exp',
    description: 'Exponent bonus applied to towers within range',
    formula: 'ln(þ)',
    explanation: 'Natural logarithm of player\'s unspent thero (money)',
    calculate: (unspentThero) => calculateInfinityExponent(unspentThero),
  },
  
  /**
   * Range sub-equation.
   * Formula: Rng = 2×e
   * where e is Euler's number
   */
  range: {
    name: 'Rng',
    symbol: 'Rng',
    description: 'Radius of effect in meters',
    formula: '2×e',
    explanation: 'Two times Euler\'s number (≈5.44 meters)',
    calculate: () => getInfinityRange(),
  },
};

// Export constants
export { INFINITY_RANGE_METERS, EULER };
