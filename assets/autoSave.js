// Autosave orchestration utilities extracted from the main bootstrap module.
// The helpers defined here coordinate scheduled persistence of powder currency,
// player statistics, and interface preferences so that progress survives browser
// interruptions without manual saves.

export const GRAPHICS_MODE_STORAGE_KEY = 'glyph-defense-idle:graphics-mode';
export const NOTATION_STORAGE_KEY = 'glyph-defense-idle:notation';
// Storage key used to persist the glyph equation visibility toggle.
export const GLYPH_EQUATIONS_STORAGE_KEY = 'glyph-defense-idle:glyph-equations';
export const POWDER_STORAGE_KEY = 'glyph-defense-idle:powder';
export const GAME_STATS_STORAGE_KEY = 'glyph-defense-idle:stats';
// Storage key used to persist the active Motefall basin snapshot.
export const POWDER_BASIN_STORAGE_KEY = 'glyph-defense-idle:powder-basin';
// Storage key used to persist tower upgrade progress (glyph allocations).
export const TOWER_UPGRADE_STORAGE_KEY = 'glyph-defense-idle:tower-upgrades';

const DEFAULT_AUTOSAVE_INTERVAL_MS = 30000;
const MIN_AUTOSAVE_INTERVAL_MS = 5000;

const dependencies = {
  getPowderCurrency: () => 0,
  onPowderCurrencyLoaded: () => {},
  applyStoredAudioSettings: null,
  syncAudioControlsFromManager: null,
  applyNotationPreference: null,
  handleNotationFallback: null,
  applyGlyphEquationPreference: null,
  getGameStatsSnapshot: null,
  mergeLoadedGameStats: null,
  getPreferenceSnapshot: null,
  audioStorageKey: null,
  getPowderBasinSnapshot: null,
  applyPowderBasinSnapshot: null,
  getTowerUpgradeStateSnapshot: null,
  applyTowerUpgradeStateSnapshot: null,
};

let statKeys = [];
let powderSaveHandle = null;
let powderBasinSaveHandle = null;
let autoSaveHandle = null;

/**
 * Injects runtime hooks so the autosave helpers can interact with the broader
 * game state without introducing circular imports.
 */
export function configureAutoSave(config = {}) {
  if (Array.isArray(config.statKeys)) {
    statKeys = [...new Set(config.statKeys)];
  } else if (config.gameStatsTemplate && typeof config.gameStatsTemplate === 'object') {
    statKeys = Object.keys(config.gameStatsTemplate);
  }

  Object.assign(dependencies, config);

  if (typeof config.audioStorageKey === 'string') {
    dependencies.audioStorageKey = config.audioStorageKey;
  }
}

/**
 * Safely reads a primitive value from localStorage, swallowing cross-origin or
 * quota errors that occasionally occur on mobile browsers.
 */
export function readStorage(key) {
  try {
    return window?.localStorage?.getItem(key) ?? null;
  } catch (error) {
    console.warn('Storage read failed', error);
    return null;
  }
}

/**
 * Writes a primitive value to localStorage while guarding against quota
 * failures so game play continues uninterrupted.
 */
export function writeStorage(key, value) {
  try {
    window?.localStorage?.setItem(key, value);
    return true;
  } catch (error) {
    console.warn('Storage write failed', error);
    return false;
  }
}

/**
 * Reads JSON content from localStorage and returns the parsed payload when the
 * entry is valid.
 */
export function readStorageJson(key) {
  const raw = readStorage(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Storage parse failed', error);
    return null;
  }
}

/**
 * Serializes a payload to JSON and stores it using the shared write helper.
 */
export function writeStorageJson(key, value) {
  try {
    const payload = JSON.stringify(value);
    return writeStorage(key, payload);
  } catch (error) {
    console.warn('Storage serialization failed', error);
    return false;
  }
}

/**
 * Persists the current powder currency immediately, cancelling any pending
 * throttled saves so the autosave loop can flush progress on demand.
 */
export function savePowderCurrency() {
  if (powderSaveHandle) {
    clearTimeout(powderSaveHandle);
    powderSaveHandle = null;
  }
  if (typeof dependencies.getPowderCurrency !== 'function') {
    return;
  }
  const currentPowder = Number(dependencies.getPowderCurrency());
  if (!Number.isFinite(currentPowder)) {
    return;
  }
  writeStorageJson(POWDER_STORAGE_KEY, Math.max(0, currentPowder));
}

/**
 * Schedules a debounced powder save so frequent powder adjustments do not
 * flood storage writes while still committing the latest value.
 */
export function schedulePowderSave() {
  if (powderSaveHandle) {
    return;
  }
  powderSaveHandle = setTimeout(() => {
    powderSaveHandle = null;
    savePowderCurrency();
  }, 1500);
}

/**
 * Restores persisted resources, preferences, and statistics from the most
 * recent autosave snapshot.
 */
export function loadPersistentState() {
  const storedPowder = readStorageJson(POWDER_STORAGE_KEY);
  if (Number.isFinite(storedPowder) && typeof dependencies.onPowderCurrencyLoaded === 'function') {
    dependencies.onPowderCurrencyLoaded(Math.max(0, storedPowder));
  }

  if (typeof dependencies.applyPowderBasinSnapshot === 'function') {
    const storedBasin = readStorageJson(POWDER_BASIN_STORAGE_KEY);
    if (storedBasin && typeof storedBasin === 'object') {
      dependencies.applyPowderBasinSnapshot(storedBasin);
    }
  }

  if (typeof dependencies.applyTowerUpgradeStateSnapshot === 'function') {
    const storedUpgrades = readStorageJson(TOWER_UPGRADE_STORAGE_KEY);
    if (storedUpgrades && typeof storedUpgrades === 'object') {
      dependencies.applyTowerUpgradeStateSnapshot(storedUpgrades);
    }
  }

  if (dependencies.audioStorageKey && typeof dependencies.applyStoredAudioSettings === 'function') {
    const storedAudio = readStorageJson(dependencies.audioStorageKey);
    if (storedAudio) {
      dependencies.applyStoredAudioSettings(storedAudio);
      if (typeof dependencies.syncAudioControlsFromManager === 'function') {
        dependencies.syncAudioControlsFromManager();
      }
    }
  }

  if (typeof dependencies.applyNotationPreference === 'function') {
    const storedNotation = readStorage(NOTATION_STORAGE_KEY);
    if (storedNotation) {
      dependencies.applyNotationPreference(storedNotation, { persist: false });
    } else if (typeof dependencies.handleNotationFallback === 'function') {
      dependencies.handleNotationFallback();
    }
  }

  if (typeof dependencies.applyGlyphEquationPreference === 'function') {
    const storedGlyphEquations = readStorage(GLYPH_EQUATIONS_STORAGE_KEY);
    if (storedGlyphEquations !== null) {
      dependencies.applyGlyphEquationPreference(storedGlyphEquations, { persist: false });
    }
  }

  if (statKeys.length && typeof dependencies.mergeLoadedGameStats === 'function') {
    const storedStats = readStorageJson(GAME_STATS_STORAGE_KEY);
    if (storedStats && typeof storedStats === 'object') {
      const sanitized = {};
      statKeys.forEach((key) => {
        const value = Number(storedStats[key]);
        if (Number.isFinite(value)) {
          sanitized[key] = value;
        }
      });
      dependencies.mergeLoadedGameStats(sanitized);
    }
  }
}

function persistGameStats() {
  if (!statKeys.length || typeof dependencies.getGameStatsSnapshot !== 'function') {
    return;
  }
  const stats = dependencies.getGameStatsSnapshot();
  if (!stats || typeof stats !== 'object') {
    return;
  }
  const payload = {};
  statKeys.forEach((key) => {
    const value = Number(stats[key]);
    if (Number.isFinite(value)) {
      payload[key] = value;
    }
  });
  if (Object.keys(payload).length) {
    writeStorageJson(GAME_STATS_STORAGE_KEY, payload);
  }
}

function persistPreferences() {
  if (typeof dependencies.getPreferenceSnapshot !== 'function') {
    return;
  }
  const snapshot = dependencies.getPreferenceSnapshot();
  if (!snapshot || typeof snapshot !== 'object') {
    return;
  }
  if (snapshot.notation !== undefined && snapshot.notation !== null) {
    writeStorage(NOTATION_STORAGE_KEY, snapshot.notation);
  }
  if (snapshot.graphics !== undefined && snapshot.graphics !== null) {
    writeStorage(GRAPHICS_MODE_STORAGE_KEY, snapshot.graphics);
  }
  if (snapshot.glyphEquations !== undefined && snapshot.glyphEquations !== null) {
    writeStorage(GLYPH_EQUATIONS_STORAGE_KEY, snapshot.glyphEquations);
  }
}

function persistTowerUpgrades() {
  if (typeof dependencies.getTowerUpgradeStateSnapshot !== 'function') {
    return;
  }
  const snapshot = dependencies.getTowerUpgradeStateSnapshot();
  if (!snapshot || typeof snapshot !== 'object') {
    return;
  }
  writeStorageJson(TOWER_UPGRADE_STORAGE_KEY, snapshot);
}

function performAutoSave() {
  savePowderCurrency();
  if (powderBasinSaveHandle) {
    clearTimeout(powderBasinSaveHandle);
    powderBasinSaveHandle = null;
  }
  persistPowderBasin();
  persistGameStats();
  persistPreferences();
  persistTowerUpgrades();
}

/**
 * Starts the recurring autosave timer so progress snapshots are refreshed on a
 * predictable cadence.
 */
export function startAutoSaveLoop({ intervalMs = DEFAULT_AUTOSAVE_INTERVAL_MS } = {}) {
  const normalized = Number.isFinite(intervalMs) ? Math.max(MIN_AUTOSAVE_INTERVAL_MS, intervalMs) : DEFAULT_AUTOSAVE_INTERVAL_MS;
  if (autoSaveHandle) {
    return;
  }
  autoSaveHandle = setInterval(() => {
    performAutoSave();
  }, normalized);
}

/**
 * Stops the autosave loop, intended primarily for tests or teardown flows.
 */
export function stopAutoSaveLoop() {
  if (autoSaveHandle) {
    clearInterval(autoSaveHandle);
    autoSaveHandle = null;
  }
}

/**
 * Forces an immediate autosave cycle, useful when the page is about to hide or
 * unload so the latest state is committed.
 */
export function commitAutoSave() {
  performAutoSave();
}

// Persist the current Motefall basin layout alongside player stats.
function persistPowderBasin() {
  if (typeof dependencies.getPowderBasinSnapshot !== 'function') {
    return;
  }
  const snapshot = dependencies.getPowderBasinSnapshot();
  if (!snapshot || typeof snapshot !== 'object') {
    return;
  }
  writeStorageJson(POWDER_BASIN_STORAGE_KEY, snapshot);
}

/**
 * Debounces basin writes so rapid simulation updates still persist without
 * overwhelming localStorage with large payloads.
 */
export function schedulePowderBasinSave() {
  if (powderBasinSaveHandle) {
    return;
  }
  powderBasinSaveHandle = setTimeout(() => {
    powderBasinSaveHandle = null;
    persistPowderBasin();
  }, 1000);
}
