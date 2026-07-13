// Directional Saturation enemy system.
// Enemies with codexId 'gradient-sapper' use sector-based damage resistance:
// the circle around the enemy is divided into sectors; repeated hits from the
// same sector build resistance until that sector blocks 100% of damage.
//
// Design: Encourages attacking from multiple directions rather than stacking
// towers in a single lane.

// ─── Tuning constants ─────────────────────────────────────────────────────────
// Number of angular sectors around the enemy (e.g. 6 = hexagonal coverage).
export const DIR_SAT_SECTOR_COUNT = 6;
// Resistance added per hit in a sector (0-1 scale).
export const DIR_SAT_BUILDUP_PER_HIT = 0.12;
// Maximum resistance per sector (1 = full block).
export const DIR_SAT_MAX_RESISTANCE = 1.0;
// Resistance decay per second (set to 0 for permanent until death).
export const DIR_SAT_DECAY_RATE = 0.02;
// Boss modifier: slower buildup for boss variants.
export const DIR_SAT_BOSS_BUILDUP_SCALE = 0.6;

/**
 * Determine which sector an attack originates from relative to the enemy.
 * @param {object} enemyPos - {x, y} position of the enemy
 * @param {object} sourcePos - {x, y} position of the attacker/tower
 * @param {number} sectorCount - number of sectors
 * @returns {number} sector index (0 to sectorCount-1)
 */
export function resolveSector(enemyPos, sourcePos, sectorCount) {
  if (!enemyPos || !sourcePos || !sectorCount || sectorCount < 1) {
    return 0;
  }
  const dx = sourcePos.x - enemyPos.x;
  const dy = sourcePos.y - enemyPos.y;
  let angle = Math.atan2(dy, dx); // -PI to PI
  if (angle < 0) {
    angle += Math.PI * 2;
  }
  const sectorSize = (Math.PI * 2) / sectorCount;
  return Math.min(sectorCount - 1, Math.floor(angle / sectorSize));
}

/**
 * Initialise directional saturation state on an enemy.
 * Called once when the enemy is first identified as a directional-saturation type.
 */
export function initDirectionalSaturation(enemy) {
  if (!enemy || enemy._dirSat) {
    return;
  }
  enemy._dirSat = {
    sectors: new Float32Array(DIR_SAT_SECTOR_COUNT), // resistance per sector [0..1]
    totalHits: 0,
  };
}

/**
 * Record a hit from a given direction and return the damage multiplier for this sector.
 * @param {object} enemy - the enemy being hit
 * @param {object} enemyPos - {x, y} position of the enemy
 * @param {object} sourcePos - {x, y} position of the attacking tower (null for AoE without clear origin)
 * @returns {number} damage multiplier (1 = full damage, 0 = fully blocked)
 */
export function applyDirectionalHit(enemy, enemyPos, sourcePos) {
  if (!enemy || !enemy._dirSat) {
    return 1;
  }
  const sectors = enemy._dirSat.sectors;
  const sectorCount = sectors.length;
  // If no source position (e.g. environmental), pick the least-resisted sector.
  const sectorIdx = sourcePos && enemyPos
    ? resolveSector(enemyPos, sourcePos, sectorCount)
    : 0;
  const currentResistance = sectors[sectorIdx];
  const damageMultiplier = Math.max(0, 1 - currentResistance);

  // Build up resistance in this sector
  const buildup = enemy.isBoss
    ? DIR_SAT_BUILDUP_PER_HIT * DIR_SAT_BOSS_BUILDUP_SCALE
    : DIR_SAT_BUILDUP_PER_HIT;
  sectors[sectorIdx] = Math.min(DIR_SAT_MAX_RESISTANCE, currentResistance + buildup);
  enemy._dirSat.totalHits++;

  return damageMultiplier;
}

/**
 * Decay directional resistances over time. Called each frame from updateEnemies.
 * @param {object} enemy - the enemy
 * @param {number} delta - frame time in seconds
 */
export function decayDirectionalSaturation(enemy, delta) {
  if (!enemy || !enemy._dirSat || DIR_SAT_DECAY_RATE <= 0) {
    return;
  }
  const sectors = enemy._dirSat.sectors;
  const decay = DIR_SAT_DECAY_RATE * delta;
  for (let i = 0; i < sectors.length; i++) {
    if (sectors[i] > 0) {
      sectors[i] = Math.max(0, sectors[i] - decay);
    }
  }
}
