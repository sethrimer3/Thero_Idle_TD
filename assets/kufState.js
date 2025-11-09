/**
 * Kuf Spire State Management
 *
 * Coordinates shard allocations, marine stat calculations, and Kuf glyph
 * tracking for the Kuf Spire's real-time tactics simulation.
 */

const DEFAULT_TOTAL_SHARDS = 24; // Total shards available for allocation.
const DEFAULT_ALLOCATIONS = Object.freeze({ health: 0, attack: 0, attackSpeed: 0 });
const DEFAULT_UNITS = Object.freeze({ marines: 0, snipers: 0, splayers: 0 });

// Unit costs in shards
const UNIT_COSTS = Object.freeze({
  marines: 5,
  snipers: 15,
  splayers: 30,
});

// Base Marine statistics before shard modifiers are applied.
const MARINE_BASE_STATS = Object.freeze({
  health: 10,
  attack: 1,
  attackSpeed: 1,
});

// Base Sniper statistics
const SNIPER_BASE_STATS = Object.freeze({
  health: 8,
  attack: 2,
  attackSpeed: 0.5,
});

// Base Splayer statistics
const SPLAYER_BASE_STATS = Object.freeze({
  health: 12,
  attack: 0.8,
  attackSpeed: 0.7,
});

// Incremental bonuses applied per allocated shard.
const MARINE_STAT_INCREMENTS = Object.freeze({
  health: 2, // +2 HP per shard
  attack: 0.5, // +0.5 damage per shard
  attackSpeed: 0.1, // +0.1 attacks per second per shard
});

/**
 * @typedef {Object} KufAllocations
 * @property {number} health - Shards assigned to health.
 * @property {number} attack - Shards assigned to attack damage.
 * @property {number} attackSpeed - Shards assigned to attack speed.
 */

/**
 * Internal state container persisted through autosave.
 */
const kufState = {
  totalShards: DEFAULT_TOTAL_SHARDS,
  allocations: { ...DEFAULT_ALLOCATIONS },
  units: { ...DEFAULT_UNITS },
  glyphs: 0,
  highScore: 0,
  lastResult: null,
};

const listeners = new Set();

function sanitizeInteger(value, fallback = 0) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
}

function emitChange(type, payload = {}) {
  listeners.forEach((listener) => {
    try {
      listener({ type, ...payload });
    } catch (error) {
      console.error('Kuf state listener failed', error);
    }
  });
}

function normalizeAllocations(rawAllocations) {
  const normalized = { ...DEFAULT_ALLOCATIONS };
  if (rawAllocations && typeof rawAllocations === 'object') {
    normalized.health = sanitizeInteger(rawAllocations.health, 0);
    normalized.attack = sanitizeInteger(rawAllocations.attack, 0);
    normalized.attackSpeed = sanitizeInteger(rawAllocations.attackSpeed, 0);
  }
  const totalAllocated = normalized.health + normalized.attack + normalized.attackSpeed;
  if (totalAllocated <= kufState.totalShards) {
    return normalized;
  }
  const scale = kufState.totalShards / Math.max(1, totalAllocated);
  return {
    health: Math.floor(normalized.health * scale),
    attack: Math.floor(normalized.attack * scale),
    attackSpeed: Math.floor(normalized.attackSpeed * scale),
  };
}

function normalizeUnits(rawUnits) {
  const normalized = { ...DEFAULT_UNITS };
  if (rawUnits && typeof rawUnits === 'object') {
    normalized.marines = sanitizeInteger(rawUnits.marines, 0);
    normalized.snipers = sanitizeInteger(rawUnits.snipers, 0);
    normalized.splayers = sanitizeInteger(rawUnits.splayers, 0);
  }
  return normalized;
}

/**
 * Initialize the Kuf state with saved data.
 * @param {object} [savedState] - Persisted Kuf spire snapshot.
 */
export function initializeKufState(savedState = {}) {
  kufState.totalShards = sanitizeInteger(savedState.totalShards, DEFAULT_TOTAL_SHARDS);
  kufState.allocations = normalizeAllocations(savedState.allocations);
  kufState.units = normalizeUnits(savedState.units);
  kufState.glyphs = sanitizeInteger(savedState.glyphs, 0);
  kufState.highScore = sanitizeInteger(savedState.highScore, 0);
  kufState.lastResult = savedState.lastResult && typeof savedState.lastResult === 'object'
    ? {
        goldEarned: sanitizeInteger(savedState.lastResult.goldEarned, 0),
        victory: Boolean(savedState.lastResult.victory),
        destroyedTurrets: sanitizeInteger(savedState.lastResult.destroyedTurrets, 0),
        timestamp: sanitizeInteger(savedState.lastResult.timestamp, Date.now()),
      }
    : null;

  // Ensure glyphs never exceed the recorded high score.
  if (kufState.glyphs > kufState.highScore) {
    kufState.glyphs = kufState.highScore;
  }

  emitChange('init', { snapshot: getKufStateSnapshot() });
}

/**
 * Returns a serializable snapshot of the Kuf state.
 * @returns {object}
 */
export function getKufStateSnapshot() {
  return {
    totalShards: kufState.totalShards,
    allocations: { ...kufState.allocations },
    units: { ...kufState.units },
    glyphs: kufState.glyphs,
    highScore: kufState.highScore,
    lastResult: kufState.lastResult ? { ...kufState.lastResult } : null,
  };
}

/**
 * Subscribe to Kuf state changes.
 * @param {(event: {type: string}) => void} listener - Callback invoked on state change.
 * @returns {() => void} Cleanup function to remove the listener.
 */
export function onKufStateChange(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Total shards available for allocation.
 * @returns {number}
 */
export function getKufTotalShards() {
  return kufState.totalShards;
}

/**
 * Remaining shards after current allocations.
 * @returns {number}
 */
export function getKufRemainingShards() {
  const allocations = kufState.allocations;
  return Math.max(0, kufState.totalShards - allocations.health - allocations.attack - allocations.attackSpeed);
}

/**
 * Current shard allocation object.
 * @returns {KufAllocations}
 */
export function getKufAllocations() {
  return { ...kufState.allocations };
}

/**
 * Update allocation for a specific stat.
 * @param {'health'|'attack'|'attackSpeed'} stat - Target stat identifier.
 * @param {number} value - Requested shard allocation.
 * @returns {{ value: number, changed: boolean }} Resulting allocation info.
 */
export function updateKufAllocation(stat, value) {
  if (!Object.prototype.hasOwnProperty.call(kufState.allocations, stat)) {
    return { value: 0, changed: false };
  }
  const sanitized = sanitizeInteger(value, 0);
  const currentAllocations = { ...kufState.allocations };
  const otherTotal = Object.entries(currentAllocations)
    .filter(([key]) => key !== stat)
    .reduce((sum, [, amount]) => sum + amount, 0);
  const maxForStat = Math.max(0, kufState.totalShards - otherTotal);
  const finalValue = Math.min(maxForStat, sanitized);
  if (finalValue === currentAllocations[stat]) {
    return { value: finalValue, changed: false };
  }
  currentAllocations[stat] = finalValue;
  kufState.allocations = currentAllocations;
  emitChange('allocation', { allocations: getKufAllocations() });
  return { value: finalValue, changed: true };
}

/**
 * Reset all shard allocations to zero.
 */
export function resetKufAllocations() {
  kufState.allocations = { ...DEFAULT_ALLOCATIONS };
  emitChange('allocation', { allocations: getKufAllocations() });
}

/**
 * Compute the marine statline after shard modifiers.
 * @param {KufAllocations} [allocations] - Optional override of the current allocations.
 * @returns {{ health: number, attack: number, attackSpeed: number }}
 */
export function calculateKufMarineStats(allocations = kufState.allocations) {
  return {
    health: MARINE_BASE_STATS.health + MARINE_STAT_INCREMENTS.health * allocations.health,
    attack: MARINE_BASE_STATS.attack + MARINE_STAT_INCREMENTS.attack * allocations.attack,
    attackSpeed: MARINE_BASE_STATS.attackSpeed + MARINE_STAT_INCREMENTS.attackSpeed * allocations.attackSpeed,
  };
}

/**
 * Record the results of a simulation run and update glyph totals.
 * @param {object} result - Simulation outcome payload.
 * @param {number} result.goldEarned - Total gold earned during the run.
 * @param {boolean} result.victory - Whether the marine survived the encounter.
 * @param {number} result.destroyedTurrets - Number of turrets eliminated.
 * @returns {{ newHigh: boolean, glyphsAwarded: number, highScore: number, goldEarned: number }}
 */
export function recordKufBattleOutcome({ goldEarned = 0, victory = false, destroyedTurrets = 0 } = {}) {
  const sanitizedGold = sanitizeInteger(goldEarned, 0);
  const sanitizedTurrets = sanitizeInteger(destroyedTurrets, 0);
  const previousHigh = kufState.highScore;
  const previousGlyphs = kufState.glyphs;

  kufState.lastResult = {
    goldEarned: sanitizedGold,
    victory: Boolean(victory),
    destroyedTurrets: sanitizedTurrets,
    timestamp: Date.now(),
  };

  let newHigh = false;
  if (sanitizedGold > kufState.highScore) {
    kufState.highScore = sanitizedGold;
    kufState.glyphs = sanitizedGold;
    newHigh = true;
  }

  const glyphsAwarded = Math.max(0, kufState.glyphs - previousGlyphs);
  emitChange('result', {
    newHigh,
    glyphsAwarded,
    goldEarned: sanitizedGold,
    highScore: kufState.highScore,
  });

  return {
    newHigh,
    glyphsAwarded,
    highScore: kufState.highScore,
    goldEarned: sanitizedGold,
  };
}

/**
 * Retrieve the player's current Kuf glyph total.
 * @returns {number}
 */
export function getKufGlyphs() {
  return kufState.glyphs;
}

/**
 * Highest recorded gold score.
 * @returns {number}
 */
export function getKufHighScore() {
  return kufState.highScore;
}

/**
 * Last recorded battle result, if any.
 * @returns {{ goldEarned: number, victory: boolean, destroyedTurrets: number, timestamp: number } | null}
 */
export function getKufLastResult() {
  return kufState.lastResult ? { ...kufState.lastResult } : null;
}

/**
 * Get current unit counts.
 * @returns {{ marines: number, snipers: number, splayers: number }}
 */
export function getKufUnits() {
  return { ...kufState.units };
}

/**
 * Get total shards spent on units.
 * @returns {number}
 */
export function getKufShardsSpentOnUnits() {
  return (
    kufState.units.marines * UNIT_COSTS.marines +
    kufState.units.snipers * UNIT_COSTS.snipers +
    kufState.units.splayers * UNIT_COSTS.splayers
  );
}

/**
 * Get shards available for purchasing units after stat allocations.
 * @returns {number}
 */
export function getKufShardsAvailableForUnits() {
  const allocatedShards = kufState.allocations.health + kufState.allocations.attack + kufState.allocations.attackSpeed;
  const unitShards = getKufShardsSpentOnUnits();
  return Math.max(0, kufState.totalShards - allocatedShards - unitShards);
}

/**
 * Purchase a unit with shards.
 * @param {'marines'|'snipers'|'splayers'} unitType - The type of unit to purchase.
 * @returns {{ success: boolean, count: number, shardsRemaining: number }}
 */
export function purchaseKufUnit(unitType) {
  if (!Object.prototype.hasOwnProperty.call(UNIT_COSTS, unitType)) {
    return { success: false, count: kufState.units[unitType] || 0, shardsRemaining: getKufShardsAvailableForUnits() };
  }
  
  const cost = UNIT_COSTS[unitType];
  const available = getKufShardsAvailableForUnits();
  
  if (available < cost) {
    return { success: false, count: kufState.units[unitType], shardsRemaining: available };
  }
  
  kufState.units[unitType] += 1;
  emitChange('units', { units: getKufUnits() });
  
  return {
    success: true,
    count: kufState.units[unitType],
    shardsRemaining: getKufShardsAvailableForUnits(),
  };
}

/**
 * Sell a unit to refund shards.
 * @param {'marines'|'snipers'|'splayers'} unitType - The type of unit to sell.
 * @returns {{ success: boolean, count: number, shardsRemaining: number }}
 */
export function sellKufUnit(unitType) {
  if (!Object.prototype.hasOwnProperty.call(UNIT_COSTS, unitType)) {
    return { success: false, count: kufState.units[unitType] || 0, shardsRemaining: getKufShardsAvailableForUnits() };
  }
  
  if (kufState.units[unitType] <= 0) {
    return { success: false, count: 0, shardsRemaining: getKufShardsAvailableForUnits() };
  }
  
  kufState.units[unitType] -= 1;
  emitChange('units', { units: getKufUnits() });
  
  return {
    success: true,
    count: kufState.units[unitType],
    shardsRemaining: getKufShardsAvailableForUnits(),
  };
}

export const KUF_MARINE_BASE_STATS = MARINE_BASE_STATS;
export const KUF_SNIPER_BASE_STATS = SNIPER_BASE_STATS;
export const KUF_SPLAYER_BASE_STATS = SPLAYER_BASE_STATS;
export const KUF_MARINE_STAT_INCREMENTS = MARINE_STAT_INCREMENTS;
export const KUF_DEFAULT_TOTAL_SHARDS = DEFAULT_TOTAL_SHARDS;
export const KUF_UNIT_COSTS = UNIT_COSTS;
