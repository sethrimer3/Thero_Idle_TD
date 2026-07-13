// Enemy metadata system — extracted from SimplePlayfield (Build 715).
// Handles enemy-derived helper calculations used by wave setup and glyph threat rendering.
// These functions use `this` (the SimplePlayfield instance) via `.call()`.

const DEFAULT_POLYGON_SIDES = 6;
const POLYGON_SPLITTER_CODEX_ID = 'polygon-splitter';

/**
 * Resolve the mote reward factor for an enemy config.
 */
export function calculateMoteFactor(config) {
  if (!config) {
    return 1;
  }
  if (Number.isFinite(config.moteFactor)) {
    return Math.max(1, Math.round(config.moteFactor));
  }
  const hp = Number.isFinite(config.hp) ? Math.max(1, config.hp) : 60;
  return Math.max(1, Math.round(hp / 60));
}

/**
 * Estimate how much gate integrity an enemy removes on breach after defense.
 */
export function estimateEnemyBreachDamage(enemy) {
  if (!enemy) {
    return 0;
  }
  const remainingHp = Number.isFinite(enemy.hp) ? Math.max(0, enemy.hp) : 0;
  const fallbackHp = Number.isFinite(enemy.maxHp) ? Math.max(0, enemy.maxHp) : 0;
  const damageSource = remainingHp > 0 ? remainingHp : fallbackHp;
  const baseDamage = Math.max(0, Math.ceil(damageSource || 0));
  const defenseSources = [
    Number.isFinite(enemy.coreDefense) ? enemy.coreDefense : null,
    Number.isFinite(enemy.defense) ? enemy.defense : null,
    Number.isFinite(this.gateDefense) ? this.gateDefense : null,
  ];
  let defenseValue = 0;
  // Resolve the first configured defense value so breach math can respect shields or future upgrades.
  for (const candidate of defenseSources) {
    if (candidate === null) {
      continue;
    }
    defenseValue = Math.max(0, candidate);
    break;
  }
  const mitigatedDamage = Math.max(0, baseDamage - defenseValue);
  if (mitigatedDamage <= 0) {
    return 0;
  }
  return Math.max(1, mitigatedDamage);
}

/**
 * Resolve enemy exponent glyph color based on projected breach threat.
 */
export function resolveEnemyExponentColor(enemy) {
  const damage = estimateEnemyBreachDamage.call(this, enemy);
  if (damage <= 0) {
    return 'rgba(120, 235, 255, 0.95)';
  }
  const currentLives = Number.isFinite(this.lives) ? Math.max(0, this.lives) : 0;
  if (currentLives > 0 && damage >= currentLives) {
    return 'rgba(255, 70, 95, 0.95)';
  }
  const maxLives = Number.isFinite(this.levelConfig?.lives)
    ? Math.max(1, this.levelConfig.lives)
    : currentLives;
  if (maxLives > 0 && damage / maxLives < 0.05) {
    return 'rgba(110, 255, 176, 0.95)';
  }
  return 'rgba(255, 168, 92, 0.95)';
}

/**
 * Resolve polygon side count from enemy config.
 */
export function resolvePolygonSides(config = {}) {
  if (Number.isFinite(config.polygonSides)) {
    return Math.max(1, Math.floor(config.polygonSides));
  }
  if (config && typeof config.codexId === 'string' && config.codexId === POLYGON_SPLITTER_CODEX_ID) {
    return DEFAULT_POLYGON_SIDES;
  }
  return null;
}

/**
 * Resolve the next polygon side count when a splitter divides.
 */
export function resolveNextPolygonSides(currentSides) {
  const normalized = Number.isFinite(currentSides) ? Math.max(1, Math.floor(currentSides)) : 0;
  if (normalized <= 1) {
    return 0;
  }
  return normalized - 1;
}
