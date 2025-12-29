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

// Training system constants
const TRAINING_COSTS = Object.freeze({
  worker: 10,
  marines: 15,
  snipers: 25,
  splayers: 40,
});

const TRAINING_TIMES = Object.freeze({
  worker: 3, // seconds
  marines: 5,
  snipers: 8,
  splayers: 12,
});

const DEFAULT_TRAINING_SLOTS = Object.freeze([
  'worker', // Slot 0 is always workers
  null,     // Slot 1-3 are equippable
  null,
  null,
]);

const DEFAULT_TRAINING_QUEUE = Object.freeze([]);

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
  upgrades: {
    marines: { ...DEFAULT_UPGRADES.marines },
    snipers: { ...DEFAULT_UPGRADES.snipers },
    splayers: { ...DEFAULT_UPGRADES.splayers },
  },
  glyphs: 0,
  highScore: 0,
  lastResult: null,
  mapHighScores: { ...DEFAULT_MAP_HIGH_SCORES },
  // Training system state
  goldEarned: 0, // Total gold earned from simulations
  goldSpent: 0, // Gold spent on training units
  trainingSlots: [...DEFAULT_TRAINING_SLOTS], // Equipped unit types for slots
  trainingQueue: [], // Active training jobs { slotIndex, unitType, progress, duration }
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
  if (rawUnits && typeof rawUnits === 'object') {
    normalized.marines = sanitizeInteger(rawUnits.marines, 0);
    normalized.snipers = sanitizeInteger(rawUnits.snipers, 0);
    normalized.splayers = sanitizeInteger(rawUnits.splayers, 0);
  }
  return normalized;
}

function normalizeUpgrades(rawUpgrades) {
  const normalized = {
    marines: { ...DEFAULT_UPGRADES.marines },
    snipers: { ...DEFAULT_UPGRADES.snipers },
    splayers: { ...DEFAULT_UPGRADES.splayers },
  };
  if (rawUpgrades && typeof rawUpgrades === 'object') {
    ['marines', 'snipers', 'splayers'].forEach((unitType) => {
      if (rawUpgrades[unitType] && typeof rawUpgrades[unitType] === 'object') {
        normalized[unitType].health = sanitizeInteger(rawUpgrades[unitType].health, 0);
        normalized[unitType].attack = sanitizeInteger(rawUpgrades[unitType].attack, 0);
        normalized[unitType].attackSpeed = sanitizeInteger(rawUpgrades[unitType].attackSpeed, 0);
      }
    });
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

  // Initialize training system state
  kufState.goldEarned = sanitizeInteger(savedState.goldEarned, 0);
  kufState.goldSpent = sanitizeInteger(savedState.goldSpent, 0);
  kufState.trainingSlots = Array.isArray(savedState.trainingSlots) && savedState.trainingSlots.length === 4
    ? [...savedState.trainingSlots]
    : [...DEFAULT_TRAINING_SLOTS];
  kufState.trainingQueue = Array.isArray(savedState.trainingQueue)
    ? savedState.trainingQueue.filter(job => 
        job && typeof job === 'object' && 
        typeof job.slotIndex === 'number' &&
        typeof job.unitType === 'string'
      )
    : [];

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
    },
    glyphs: kufState.glyphs,
    highScore: kufState.highScore,
    lastResult: kufState.lastResult ? { ...kufState.lastResult } : null,
    mapHighScores: { ...kufState.mapHighScores },
    goldEarned: kufState.goldEarned,
    goldSpent: kufState.goldSpent,
    trainingSlots: [...kufState.trainingSlots],
    trainingQueue: kufState.trainingQueue.map(job => ({ ...job })),
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

  // Add gold to earned total for training system
  addKufGoldEarned(sanitizedGold);

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

/**
 * Get current upgrades for all units.
 * @returns {object}
 */
export function getKufUpgrades() {
  return {
    marines: { ...kufState.upgrades.marines },
    snipers: { ...kufState.upgrades.snipers },
    splayers: { ...kufState.upgrades.splayers },
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
    total += upgrades.health + upgrades.attack + upgrades.attackSpeed;
  });
  return total;
}

/**
 * Allocate a shard to a unit upgrade.
 * @param {'marines'|'snipers'|'splayers'} unitType - The type of unit.
 * @param {'health'|'attack'|'attackSpeed'} stat - The stat to upgrade.
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
 * @param {'marines'|'snipers'|'splayers'} unitType - The type of unit.
 * @param {'health'|'attack'|'attackSpeed'} stat - The stat to downgrade.
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

export const KUF_MARINE_BASE_STATS = MARINE_BASE_STATS;
export const KUF_SNIPER_BASE_STATS = SNIPER_BASE_STATS;
export const KUF_SPLAYER_BASE_STATS = SPLAYER_BASE_STATS;
export const KUF_MARINE_STAT_INCREMENTS = MARINE_STAT_INCREMENTS;
export const KUF_DEFAULT_TOTAL_SHARDS = DEFAULT_TOTAL_SHARDS;
export const KUF_UNIT_COSTS = UNIT_COSTS;
export const KUF_TRAINING_COSTS = TRAINING_COSTS;
export const KUF_TRAINING_TIMES = TRAINING_TIMES;

/**
 * Get available gold (earned minus spent).
 * @returns {number}
 */
export function getKufAvailableGold() {
  return Math.max(0, kufState.goldEarned - kufState.goldSpent);
}

/**
 * Get total gold earned from simulations.
 * @returns {number}
 */
export function getKufGoldEarned() {
  return kufState.goldEarned;
}

/**
 * Get total gold spent on training.
 * @returns {number}
 */
export function getKufGoldSpent() {
  return kufState.goldSpent;
}

/**
 * Get current training slots configuration.
 * @returns {Array<string|null>}
 */
export function getKufTrainingSlots() {
  return [...kufState.trainingSlots];
}

/**
 * Equip a unit type to a training slot (slots 1-3 are equippable).
 * @param {number} slotIndex - Slot index (1-3).
 * @param {string|null} unitType - Unit type to equip, or null to clear.
 * @returns {{ success: boolean, slots: Array<string|null> }}
 */
export function equipKufTrainingSlot(slotIndex, unitType) {
  if (slotIndex < 1 || slotIndex > 3) {
    return { success: false, slots: getKufTrainingSlots() };
  }
  
  const validTypes = ['marines', 'snipers', 'splayers', null];
  if (!validTypes.includes(unitType)) {
    return { success: false, slots: getKufTrainingSlots() };
  }
  
  kufState.trainingSlots[slotIndex] = unitType;
  emitChange('trainingSlots', { slots: getKufTrainingSlots() });
  
  return { success: true, slots: getKufTrainingSlots() };
}

/**
 * Get current training queue.
 * @returns {Array<{slotIndex: number, unitType: string, progress: number, duration: number}>}
 */
export function getKufTrainingQueue() {
  return kufState.trainingQueue.map(job => ({ ...job }));
}

/**
 * Start training a unit from a slot.
 * @param {number} slotIndex - Slot index (0-3).
 * @returns {{ success: boolean, message: string }}
 */
export function startKufTraining(slotIndex) {
  if (slotIndex < 0 || slotIndex > 3) {
    return { success: false, message: 'Invalid slot index' };
  }
  
  const unitType = kufState.trainingSlots[slotIndex];
  if (!unitType) {
    return { success: false, message: 'No unit equipped in this slot' };
  }
  
  const cost = TRAINING_COSTS[unitType];
  const availableGold = getKufAvailableGold();
  
  if (availableGold < cost) {
    return { success: false, message: 'Not enough gold' };
  }
  
  // Check if this slot is already training
  const existingJob = kufState.trainingQueue.find(job => job.slotIndex === slotIndex);
  if (existingJob) {
    return { success: false, message: 'Slot is already training' };
  }
  
  // Deduct gold
  kufState.goldSpent += cost;
  
  // Add to training queue
  const duration = TRAINING_TIMES[unitType];
  kufState.trainingQueue.push({
    slotIndex,
    unitType,
    progress: 0,
    duration,
  });
  
  emitChange('trainingStarted', {
    slotIndex,
    unitType,
    goldSpent: kufState.goldSpent,
    availableGold: getKufAvailableGold(),
  });
  
  return { success: true, message: 'Training started' };
}

/**
 * Update training progress (called each frame).
 * @param {number} deltaSeconds - Time elapsed since last update.
 */
export function updateKufTraining(deltaSeconds) {
  if (kufState.trainingQueue.length === 0) {
    return;
  }
  
  const completedJobs = [];
  
  kufState.trainingQueue.forEach((job, index) => {
    job.progress += deltaSeconds;
    
    if (job.progress >= job.duration) {
      completedJobs.push(index);
    }
  });
  
  // Process completed jobs
  completedJobs.reverse().forEach(index => {
    const job = kufState.trainingQueue[index];
    
    // Add unit to inventory based on type
    if (job.unitType === 'worker') {
      // Workers are a special case - they might affect resource generation
      // For now, we'll just emit an event
    } else if (kufState.units[job.unitType] !== undefined) {
      kufState.units[job.unitType] += 1;
    }
    
    kufState.trainingQueue.splice(index, 1);
    
    emitChange('trainingComplete', {
      slotIndex: job.slotIndex,
      unitType: job.unitType,
      units: getKufUnits(),
    });
  });
  
  if (completedJobs.length > 0 || kufState.trainingQueue.length > 0) {
    emitChange('trainingProgress', {
      queue: getKufTrainingQueue(),
    });
  }
}

/**
 * Add gold earned from simulation completion.
 * @param {number} amount - Gold amount to add.
 */
export function addKufGoldEarned(amount) {
  const sanitized = sanitizeInteger(amount, 0);
  kufState.goldEarned += sanitized;
  
  emitChange('goldEarned', {
    goldEarned: kufState.goldEarned,
    availableGold: getKufAvailableGold(),
  });
}
