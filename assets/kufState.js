/**
 * Kuf Spire State Management
 *
 * Coordinates shard allocations, marine stat calculations, and Kuf glyph
 * tracking for the Kuf Spire's real-time tactics simulation.
 */

const DEFAULT_TOTAL_SHARDS = 24; // Total shards available for allocation.
const DEFAULT_ALLOCATIONS = Object.freeze({ health: 0, attack: 0, attackSpeed: 0 });
const DEFAULT_UNITS = Object.freeze({ marines: 0, snipers: 0, splayers: 0 });
const DEFAULT_UPGRADES = Object.freeze({
  marines: { health: 0, attack: 0, attackSpeed: 0 },
  snipers: { health: 0, attack: 0, attackSpeed: 0 },
  splayers: { health: 0, attack: 0, attackSpeed: 0 },
  // Track core ship upgrades for hull integrity and attached cannon mounts.
  coreShip: { health: 0, cannons: 0 },
});
const DEFAULT_MAP_HIGH_SCORES = Object.freeze({});
const DEFAULT_MAP_ID = 'forward-bastion';

// Minimum gold required to earn Kuf glyphs (base for magnitude calculation)
const KUF_GLYPH_GOLD_BASE = 5;

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

// Base core ship hull integrity before shard upgrades are applied.
const CORE_SHIP_BASE_HEALTH = 120;
// Additional hull integrity gained per shard invested in the core ship hull.
const CORE_SHIP_HEALTH_PER_SHARD = 20;

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
  upgrades: {
    marines: { ...DEFAULT_UPGRADES.marines },
    snipers: { ...DEFAULT_UPGRADES.snipers },
    splayers: { ...DEFAULT_UPGRADES.splayers },
    // Persist core ship upgrade counts alongside unit upgrades.
    coreShip: { ...DEFAULT_UPGRADES.coreShip },
  },
  glyphs: 0,
  highScore: 0,
  lastResult: null,
  mapHighScores: { ...DEFAULT_MAP_HIGH_SCORES },
};

const listeners = new Set();

function sanitizeInteger(value, fallback = 0) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
}

/**
 * Calculate Kuf glyphs based on total gold earned across all maps.
 * Player gets 1 glyph for every 5x increase in magnitude (5, 25, 125, 625, etc.).
 * @param {number} totalGold - Sum of all map high scores.
 * @returns {number} Number of Kuf glyphs.
 */
function calculateKufGlyphsFromGold(totalGold) {
  const normalized = Math.max(0, Number.isFinite(totalGold) ? totalGold : 0);
  if (normalized < KUF_GLYPH_GOLD_BASE) {
    return 0;
  }
  // glyphs = floor(log_base(totalGold)) where base = KUF_GLYPH_GOLD_BASE
  return Math.floor(Math.log(normalized) / Math.log(KUF_GLYPH_GOLD_BASE));
}

/**
 * Get the sum of all map high scores for glyph calculation.
 * @returns {number} Total gold earned across all stages.
 */
function getTotalMapGold() {
  return Object.values(kufState.mapHighScores).reduce((sum, score) => sum + sanitizeInteger(score, 0), 0);
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
  // Ignore saved unit allocations because units are trained during the simulation now.
  if (rawUnits && typeof rawUnits === 'object') {
    normalized.marines = 0;
    normalized.snipers = 0;
    normalized.splayers = 0;
  }
  return normalized;
}

function normalizeUpgrades(rawUpgrades) {
  const normalized = {
    marines: { ...DEFAULT_UPGRADES.marines },
    snipers: { ...DEFAULT_UPGRADES.snipers },
    splayers: { ...DEFAULT_UPGRADES.splayers },
    // Always normalize core ship upgrades for hull integrity and cannon mounts.
    coreShip: { ...DEFAULT_UPGRADES.coreShip },
  };
  if (rawUpgrades && typeof rawUpgrades === 'object') {
    ['marines', 'snipers', 'splayers'].forEach((unitType) => {
      if (rawUpgrades[unitType] && typeof rawUpgrades[unitType] === 'object') {
        normalized[unitType].health = sanitizeInteger(rawUpgrades[unitType].health, 0);
        normalized[unitType].attack = sanitizeInteger(rawUpgrades[unitType].attack, 0);
        normalized[unitType].attackSpeed = sanitizeInteger(rawUpgrades[unitType].attackSpeed, 0);
      }
    });
    // Normalize core ship upgrade values with the same shard-sanitizing rules.
    if (rawUpgrades.coreShip && typeof rawUpgrades.coreShip === 'object') {
      normalized.coreShip.health = sanitizeInteger(rawUpgrades.coreShip.health, 0);
      normalized.coreShip.cannons = sanitizeInteger(rawUpgrades.coreShip.cannons, 0);
    }
  }
  return normalized;
}

// Normalize per-map score ledger so each battlefield tracks its personal best.
function normalizeMapHighScores(rawMapScores) {
  const normalized = {};
  if (rawMapScores && typeof rawMapScores === 'object') {
    Object.entries(rawMapScores).forEach(([mapId, score]) => {
      if (typeof mapId === 'string' && mapId.trim()) {
        normalized[mapId] = sanitizeInteger(score, 0);
      }
    });
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
  kufState.upgrades = normalizeUpgrades(savedState.upgrades);
  kufState.highScore = sanitizeInteger(savedState.highScore, 0);
  kufState.mapHighScores = normalizeMapHighScores(savedState.mapHighScores);
  // Seed legacy saves with the global high score so map buttons surface a real value immediately.
  if (!Object.keys(kufState.mapHighScores).length && kufState.highScore > 0) {
    kufState.mapHighScores[DEFAULT_MAP_ID] = kufState.highScore;
  }
  kufState.lastResult = savedState.lastResult && typeof savedState.lastResult === 'object'
    ? {
        goldEarned: sanitizeInteger(savedState.lastResult.goldEarned, 0),
        victory: Boolean(savedState.lastResult.victory),
        destroyedTurrets: sanitizeInteger(savedState.lastResult.destroyedTurrets, 0),
        mapId: typeof savedState.lastResult.mapId === 'string' ? savedState.lastResult.mapId : null,
        timestamp: sanitizeInteger(savedState.lastResult.timestamp, Date.now()),
      }
    : null;

  // Calculate glyphs based on total gold across all maps (1 glyph per 5x magnitude)
  const totalMapGold = getTotalMapGold();
  kufState.glyphs = calculateKufGlyphsFromGold(totalMapGold);

  emitChange('init', { snapshot: getKufStateSnapshot() });
}

/**
 * Fully reset the Kuf Spire progress so player data wipes clear glyphs and scores.
 */
export function resetKufState() {
  initializeKufState({});
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
    upgrades: {
      marines: { ...kufState.upgrades.marines },
      snipers: { ...kufState.upgrades.snipers },
      splayers: { ...kufState.upgrades.splayers },
      // Expose core ship upgrades for persistence and UI hydration.
      coreShip: { ...kufState.upgrades.coreShip },
    },
    glyphs: kufState.glyphs,
    highScore: kufState.highScore,
    lastResult: kufState.lastResult ? { ...kufState.lastResult } : null,
    mapHighScores: { ...kufState.mapHighScores },
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
 * Override the total shard budget, re-normalizing existing allocations to fit the new ceiling.
 * @param {number} totalShards - Updated shard capacity for the Kuf Spire.
 * @returns {number} The sanitized shard total applied to state.
 */
export function setKufTotalShards(totalShards) {
  const sanitized = sanitizeInteger(totalShards, kufState.totalShards);
  if (sanitized === kufState.totalShards) {
    return kufState.totalShards;
  }
  kufState.totalShards = sanitized;
  kufState.allocations = normalizeAllocations(kufState.allocations);
  emitChange('totalShards', { totalShards: kufState.totalShards, allocations: getKufAllocations() });
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
 * @param {string} [result.mapId] - Battlefield identifier used to track per-map records.
 * @returns {{ newHigh: boolean, glyphsAwarded: number, highScore: number, goldEarned: number, mapId: string | null }}
 */
export function recordKufBattleOutcome({ goldEarned = 0, victory = false, destroyedTurrets = 0, mapId = null } = {}) {
  const sanitizedGold = sanitizeInteger(goldEarned, 0);
  const sanitizedTurrets = sanitizeInteger(destroyedTurrets, 0);
  const normalizedMapId = typeof mapId === 'string' && mapId.trim() ? mapId : null;
  const previousHigh = kufState.highScore;
  const previousGlyphs = kufState.glyphs;

  kufState.lastResult = {
    goldEarned: sanitizedGold,
    victory: Boolean(victory),
    destroyedTurrets: sanitizedTurrets,
    mapId: normalizedMapId,
    timestamp: Date.now(),
  };

  let newHigh = false;
  if (sanitizedGold > kufState.highScore) {
    kufState.highScore = sanitizedGold;
    newHigh = true;
  }

  if (normalizedMapId) {
    const previousMapHigh = kufState.mapHighScores[normalizedMapId] || 0;
    if (sanitizedGold > previousMapHigh) {
      kufState.mapHighScores[normalizedMapId] = sanitizedGold;
    }
  }

  // Calculate glyphs based on total gold across all maps (1 glyph per 5x magnitude)
  const totalMapGold = getTotalMapGold();
  kufState.glyphs = calculateKufGlyphsFromGold(totalMapGold);

  const glyphsAwarded = Math.max(0, kufState.glyphs - previousGlyphs);
  emitChange('result', {
    newHigh,
    glyphsAwarded,
    goldEarned: sanitizedGold,
    highScore: kufState.highScore,
    mapId: normalizedMapId,
  });

  return {
    newHigh,
    glyphsAwarded,
    highScore: kufState.highScore,
    goldEarned: sanitizedGold,
    mapId: normalizedMapId,
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
 * Override the player's Kuf glyph total while keeping the high score in sync.
 * @param {number} value - New glyph total to apply.
 * @returns {number} Updated glyph total.
 */
export function setKufGlyphs(value) {
  const normalized = sanitizeInteger(value, kufState.glyphs);
  kufState.glyphs = normalized;
  if (normalized > kufState.highScore) {
    kufState.highScore = normalized;
  }
  emitChange('glyphs', { glyphs: kufState.glyphs, highScore: kufState.highScore });
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
 * Retrieve the best recorded gold totals per battlefield.
 * @returns {Record<string, number>}
 */
export function getKufMapHighScores() {
  return { ...kufState.mapHighScores };
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
 * Get shards available for purchasing units and upgrades after stat allocations.
 * @returns {number}
 */
export function getKufShardsAvailableForUnits() {
  const allocatedShards = kufState.allocations.health + kufState.allocations.attack + kufState.allocations.attackSpeed;
  const unitShards = getKufShardsSpentOnUnits();
  const upgradeShards = getKufShardsSpentOnUpgrades();
  return Math.max(0, kufState.totalShards - allocatedShards - unitShards - upgradeShards);
}

/**
 * Purchase a unit with shards.
 * @param {'marines'|'snipers'|'splayers'} unitType - The type of unit to purchase.
 * @returns {{ success: boolean, count: number, shardsRemaining: number }}
 */
export function purchaseKufUnit(unitType) {
  // Unit purchases are disabled because Kuf units are trained exclusively from the core ship.
  if (!Object.prototype.hasOwnProperty.call(UNIT_COSTS, unitType)) {
    return { success: false, count: kufState.units[unitType] || 0, shardsRemaining: getKufShardsAvailableForUnits() };
  }

  return { success: false, count: kufState.units[unitType] || 0, shardsRemaining: getKufShardsAvailableForUnits() };
}

/**
 * Sell a unit to refund shards.
 * @param {'marines'|'snipers'|'splayers'} unitType - The type of unit to sell.
 * @returns {{ success: boolean, count: number, shardsRemaining: number }}
 */
export function sellKufUnit(unitType) {
  // Unit refunds are disabled because unit counts are no longer purchased up-front.
  if (!Object.prototype.hasOwnProperty.call(UNIT_COSTS, unitType)) {
    return { success: false, count: kufState.units[unitType] || 0, shardsRemaining: getKufShardsAvailableForUnits() };
  }

  return { success: false, count: 0, shardsRemaining: getKufShardsAvailableForUnits() };
}

/**
 * Get current upgrades for all units.
 * @returns {object}
 */
export function getKufUpgrades() {
  return {
    marines: { ...kufState.upgrades.marines },
    snipers: { ...kufState.upgrades.snipers },
    splayers: { ...kufState.upgrades.splayers },
    // Surface core ship upgrades for the Kuf upgrade menu.
    coreShip: { ...kufState.upgrades.coreShip },
  };
}

/**
 * Get total shards spent on upgrades.
 * @returns {number}
 */
export function getKufShardsSpentOnUpgrades() {
  let total = 0;
  Object.keys(kufState.upgrades).forEach((unitType) => {
    const upgrades = kufState.upgrades[unitType];
    // Count shard totals for both unit stat upgrades and core ship improvements.
    total += (upgrades.health || 0) + (upgrades.attack || 0) + (upgrades.attackSpeed || 0) + (upgrades.cannons || 0);
  });
  return total;
}

/**
 * Allocate a shard to a unit upgrade.
 * @param {'marines'|'snipers'|'splayers'|'coreShip'} unitType - The type of unit or core ship.
 * @param {'health'|'attack'|'attackSpeed'|'cannons'} stat - The stat to upgrade.
 * @returns {{ success: boolean, value: number, shardsRemaining: number }}
 */
export function allocateKufUpgrade(unitType, stat) {
  if (!kufState.upgrades[unitType] || !Object.prototype.hasOwnProperty.call(kufState.upgrades[unitType], stat)) {
    return { success: false, value: 0, shardsRemaining: getKufShardsAvailableForUnits() };
  }
  
  const available = getKufShardsAvailableForUnits();
  if (available < 1) {
    return { success: false, value: kufState.upgrades[unitType][stat], shardsRemaining: available };
  }
  
  kufState.upgrades[unitType][stat] += 1;
  emitChange('upgrades', { upgrades: getKufUpgrades() });
  
  return {
    success: true,
    value: kufState.upgrades[unitType][stat],
    shardsRemaining: getKufShardsAvailableForUnits(),
  };
}

/**
 * Deallocate a shard from a unit upgrade.
 * @param {'marines'|'snipers'|'splayers'|'coreShip'} unitType - The type of unit or core ship.
 * @param {'health'|'attack'|'attackSpeed'|'cannons'} stat - The stat to downgrade.
 * @returns {{ success: boolean, value: number, shardsRemaining: number }}
 */
export function deallocateKufUpgrade(unitType, stat) {
  if (!kufState.upgrades[unitType] || !Object.prototype.hasOwnProperty.call(kufState.upgrades[unitType], stat)) {
    return { success: false, value: 0, shardsRemaining: getKufShardsAvailableForUnits() };
  }
  
  if (kufState.upgrades[unitType][stat] <= 0) {
    return { success: false, value: 0, shardsRemaining: getKufShardsAvailableForUnits() };
  }
  
  kufState.upgrades[unitType][stat] -= 1;
  emitChange('upgrades', { upgrades: getKufUpgrades() });
  
  return {
    success: true,
    value: kufState.upgrades[unitType][stat],
    shardsRemaining: getKufShardsAvailableForUnits(),
  };
}

/**
 * Calculate unit stats including base stats and upgrades.
 * @param {'marines'|'snipers'|'splayers'} unitType - The type of unit.
 * @returns {{ health: number, attack: number, attackSpeed: number }}
 */
export function calculateKufUnitStats(unitType) {
  let baseStats;
  switch (unitType) {
    case 'marines':
      baseStats = MARINE_BASE_STATS;
      break;
    case 'snipers':
      baseStats = SNIPER_BASE_STATS;
      break;
    case 'splayers':
      baseStats = SPLAYER_BASE_STATS;
      break;
    default:
      return { health: 0, attack: 0, attackSpeed: 0 };
  }
  
  const upgrades = kufState.upgrades[unitType] || { health: 0, attack: 0, attackSpeed: 0 };
  
  return {
    health: baseStats.health + upgrades.health * 2,
    attack: baseStats.attack + upgrades.attack * 0.5,
    attackSpeed: baseStats.attackSpeed + upgrades.attackSpeed * 0.1,
  };
}

/**
 * Calculate core ship stats including base hull integrity and shard upgrades.
 * @returns {{ health: number, cannons: number }}
 */
export function calculateKufCoreShipStats() {
  const upgrades = kufState.upgrades.coreShip || { health: 0, cannons: 0 };
  // Core ship hull integrity scales linearly: base health + (health shards × per-shard bonus).
  const health = CORE_SHIP_BASE_HEALTH + upgrades.health * CORE_SHIP_HEALTH_PER_SHARD;
  // Cannon upgrades attach one cannon per shard invested.
  const cannons = upgrades.cannons;
  return { health, cannons };
}

export const KUF_MARINE_BASE_STATS = MARINE_BASE_STATS;
export const KUF_SNIPER_BASE_STATS = SNIPER_BASE_STATS;
export const KUF_SPLAYER_BASE_STATS = SPLAYER_BASE_STATS;
export const KUF_MARINE_STAT_INCREMENTS = MARINE_STAT_INCREMENTS;
export const KUF_DEFAULT_TOTAL_SHARDS = DEFAULT_TOTAL_SHARDS;
export const KUF_UNIT_COSTS = UNIT_COSTS;
export const KUF_CORE_SHIP_BASE_HEALTH = CORE_SHIP_BASE_HEALTH;
