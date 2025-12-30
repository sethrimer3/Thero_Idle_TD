// Autosave orchestration utilities extracted from the main bootstrap module.
// The helpers defined here coordinate scheduled persistence of powder currency,
// player statistics, and interface preferences so that progress survives browser
// interruptions without manual saves.

export const GRAPHICS_MODE_STORAGE_KEY = 'glyph-defense-idle:graphics-mode';
export const NOTATION_STORAGE_KEY = 'glyph-defense-idle:notation';
// Storage key used to persist the glyph equation visibility toggle.
export const GLYPH_EQUATIONS_STORAGE_KEY = 'glyph-defense-idle:glyph-equations';
// Storage key used to persist combat damage number visibility.
export const DAMAGE_NUMBER_TOGGLE_STORAGE_KEY = 'glyph-defense-idle:damage-numbers';
// Storage key used to persist the wave kill tally overlay preference.
export const WAVE_KILL_TALLY_STORAGE_KEY = 'glyph-defense-idle:wave-kill-tallies';
// Storage key used to persist the wave damage tally overlay preference.
export const WAVE_DAMAGE_TALLY_STORAGE_KEY = 'glyph-defense-idle:wave-damage-tallies';
// Storage key used to persist the preferred track rendering style.
export const TRACK_RENDER_MODE_STORAGE_KEY = 'glyph-defense-idle:track-render-mode';
// Storage key used to persist the luminous track tracer preference.
export const TRACK_TRACER_TOGGLE_STORAGE_KEY = 'glyph-defense-idle:track-tracer-enabled';
// Storage key used to persist the preferred tower loadout slot count.
export const TOWER_LOADOUT_SLOTS_STORAGE_KEY = 'glyph-defense-idle:loadout-slots';
export const POWDER_STORAGE_KEY = 'glyph-defense-idle:powder';
export const GAME_STATS_STORAGE_KEY = 'glyph-defense-idle:stats';
// Storage key used to persist the active Spire snapshot.
export const POWDER_BASIN_STORAGE_KEY = 'glyph-defense-idle:powder-basin';
// Storage key used to persist tower upgrade progress (glyph allocations).
export const TOWER_UPGRADE_STORAGE_KEY = 'glyph-defense-idle:tower-upgrades';
// Storage key used to persist Shin Spire state (iterons, fractals, glyphs).
export const SHIN_STATE_STORAGE_KEY = 'glyph-defense-idle:shin-state';
// Storage key used to persist Kuf Spire shard allocations and scores.
export const KUF_STATE_STORAGE_KEY = 'glyph-defense-idle:kuf-state';
// Storage key used to persist advanced spire resource banks (Tsadi binding agents, Lamed sparks, etc.).
export const SPIRE_RESOURCE_STORAGE_KEY = 'glyph-defense-idle:spires';
// Storage key used to persist interactive level completion and unlock progress.
export const LEVEL_PROGRESS_STORAGE_KEY = 'glyph-defense-idle:level-progress';
// Storage key used to persist Bet Spire terrarium visual preferences.
export const FLUID_VISUAL_SETTINGS_STORAGE_KEY = 'glyph-defense-idle:fluid-visual-settings';
// Storage key used to persist Lamed spire visual effect settings.
export const LAMED_VISUAL_SETTINGS_STORAGE_KEY = 'glyph-defense-idle:lamed-visual-settings';
// Storage key used to persist Kuf spire performance toggles.
export const KUF_VISUAL_SETTINGS_STORAGE_KEY = 'glyph-defense-idle:kuf-visual-settings';
// Storage key used to persist Tsadi spire fusion rendering preferences.
export const TSADI_VISUAL_SETTINGS_STORAGE_KEY = 'glyph-defense-idle:tsadi-visual-settings';
// Storage key used to persist Shin spire fractal rendering preferences.
export const SHIN_VISUAL_SETTINGS_STORAGE_KEY = 'glyph-defense-idle:shin-visual-settings';
// Storage key used to persist Aleph spire mote glow settings.
export const POWDER_VISUAL_SETTINGS_STORAGE_KEY = 'glyph-defense-idle:powder-visual-settings';
// Storage key used to persist the frame rate limit preference.
export const FRAME_RATE_LIMIT_STORAGE_KEY = 'glyph-defense-idle:frame-rate-limit';
// Storage key used to persist the FPS counter visibility toggle.
export const FPS_COUNTER_TOGGLE_STORAGE_KEY = 'glyph-defense-idle:fps-counter-enabled';
// Storage key used to persist cognitive realm territories state.
export const COGNITIVE_REALM_STORAGE_KEY = 'glyph-defense-idle:cognitive-realm';
// Storage key used to persist cognitive realm visual preferences.
export const COGNITIVE_REALM_VISUAL_SETTINGS_KEY = 'glyph-defense-idle:cognitive-realm-visual-settings';
// Storage key used to persist Bet Spire particle visual preferences.
export const BET_SPIRE_VISUAL_SETTINGS_STORAGE_KEY = 'glyph-defense-idle:bet-spire-visual-settings';
// Storage key used to persist playfield enemy particle visibility.
export const PLAYFIELD_ENEMY_PARTICLES_STORAGE_KEY = 'glyph-defense-idle:playfield-enemy-particles';
// Storage key used to persist playfield edge crystals visibility.
export const PLAYFIELD_EDGE_CRYSTALS_STORAGE_KEY = 'glyph-defense-idle:playfield-edge-crystals';
// Storage key used to persist playfield background particles visibility.
export const PLAYFIELD_BACKGROUND_PARTICLES_STORAGE_KEY = 'glyph-defense-idle:playfield-background-particles';

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
  applyDamageNumberPreference: null,
  applyWaveKillTallyPreference: null,
  applyWaveDamageTallyPreference: null,
  applyTrackTracerPreference: null,
  applyFrameRateLimitPreference: null,
  applyFpsCounterPreference: null,
  getGameStatsSnapshot: null,
  mergeLoadedGameStats: null,
  getPreferenceSnapshot: null,
  audioStorageKey: null,
  getPowderBasinSnapshot: null,
  applyPowderBasinSnapshot: null,
  getTowerUpgradeStateSnapshot: null,
  applyTowerUpgradeStateSnapshot: null,
  getShinStateSnapshot: null,
  getKufStateSnapshot: null,
  getSpireResourceStateSnapshot: null,
  applySpireResourceStateSnapshot: null,
  getLevelProgressSnapshot: null,
  applyLevelProgressSnapshot: null,
  getCognitiveRealmStateSnapshot: null,
  applyCognitiveRealmStateSnapshot: null,
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

  if (typeof dependencies.applySpireResourceStateSnapshot === 'function') {
    const storedSpireResources = readStorageJson(SPIRE_RESOURCE_STORAGE_KEY);
    if (storedSpireResources && typeof storedSpireResources === 'object') {
      dependencies.applySpireResourceStateSnapshot(storedSpireResources);
    }
  }

  if (typeof dependencies.applyLevelProgressSnapshot === 'function') {
    const storedProgress = readStorageJson(LEVEL_PROGRESS_STORAGE_KEY);
    if (storedProgress && typeof storedProgress === 'object') {
      dependencies.applyLevelProgressSnapshot(storedProgress);
    }
  }

  if (typeof dependencies.applyCognitiveRealmStateSnapshot === 'function') {
    const storedCognitiveRealm = readStorageJson(COGNITIVE_REALM_STORAGE_KEY);
    if (storedCognitiveRealm && typeof storedCognitiveRealm === 'object') {
      dependencies.applyCognitiveRealmStateSnapshot(storedCognitiveRealm);
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

  if (typeof dependencies.applyDamageNumberPreference === 'function') {
    const storedDamageNumbers = readStorage(DAMAGE_NUMBER_TOGGLE_STORAGE_KEY);
    if (storedDamageNumbers !== null) {
      dependencies.applyDamageNumberPreference(storedDamageNumbers, { persist: false });
    }
  }

  if (typeof dependencies.applyWaveKillTallyPreference === 'function') {
    const storedKillTallies = readStorage(WAVE_KILL_TALLY_STORAGE_KEY);
    if (storedKillTallies !== null) {
      dependencies.applyWaveKillTallyPreference(storedKillTallies, { persist: false });
    }
  }

  if (typeof dependencies.applyWaveDamageTallyPreference === 'function') {
    const storedDamageTallies = readStorage(WAVE_DAMAGE_TALLY_STORAGE_KEY);
    if (storedDamageTallies !== null) {
      dependencies.applyWaveDamageTallyPreference(storedDamageTallies, { persist: false });
    }
  }

  if (typeof dependencies.applyTrackTracerPreference === 'function') {
    const storedTrackTracer = readStorage(TRACK_TRACER_TOGGLE_STORAGE_KEY);
    if (storedTrackTracer !== null) {
      dependencies.applyTrackTracerPreference(storedTrackTracer, { persist: false });
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
  if (snapshot.damageNumbers !== undefined && snapshot.damageNumbers !== null) {
    writeStorage(DAMAGE_NUMBER_TOGGLE_STORAGE_KEY, snapshot.damageNumbers);
  }
  if (snapshot.waveKillTallies !== undefined && snapshot.waveKillTallies !== null) {
    writeStorage(WAVE_KILL_TALLY_STORAGE_KEY, snapshot.waveKillTallies);
  }
  if (snapshot.waveDamageTallies !== undefined && snapshot.waveDamageTallies !== null) {
    writeStorage(WAVE_DAMAGE_TALLY_STORAGE_KEY, snapshot.waveDamageTallies);
  }
  if (snapshot.trackTracer !== undefined && snapshot.trackTracer !== null) {
    writeStorage(TRACK_TRACER_TOGGLE_STORAGE_KEY, snapshot.trackTracer);
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

function persistShinState() {
  if (typeof dependencies.getShinStateSnapshot !== 'function') {
    return;
  }
  const snapshot = dependencies.getShinStateSnapshot();
  if (!snapshot || typeof snapshot !== 'object') {
    return;
  }
  writeStorageJson(SHIN_STATE_STORAGE_KEY, snapshot);
}

function persistKufState() {
  if (typeof dependencies.getKufStateSnapshot !== 'function') {
    return;
  }
  const snapshot = dependencies.getKufStateSnapshot();
  if (!snapshot || typeof snapshot !== 'object') {
    return;
  }
  writeStorageJson(KUF_STATE_STORAGE_KEY, snapshot);
}

function persistSpireResourceState() {
  if (typeof dependencies.getSpireResourceStateSnapshot !== 'function') {
    return;
  }
  const snapshot = dependencies.getSpireResourceStateSnapshot();
  if (!snapshot || typeof snapshot !== 'object') {
    return;
  }
  writeStorageJson(SPIRE_RESOURCE_STORAGE_KEY, snapshot);
}

function persistLevelProgress() {
  if (typeof dependencies.getLevelProgressSnapshot !== 'function') {
    return;
  }
  const snapshot = dependencies.getLevelProgressSnapshot();
  if (!snapshot || typeof snapshot !== 'object') {
    return;
  }
  writeStorageJson(LEVEL_PROGRESS_STORAGE_KEY, snapshot);
}

function persistCognitiveRealmState() {
  if (typeof dependencies.getCognitiveRealmStateSnapshot !== 'function') {
    return;
  }
  const snapshot = dependencies.getCognitiveRealmStateSnapshot();
  if (!snapshot || typeof snapshot !== 'object') {
    return;
  }
  writeStorageJson(COGNITIVE_REALM_STORAGE_KEY, snapshot);
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
  persistShinState();
  persistKufState();
  persistSpireResourceState();
  persistLevelProgress();
  persistCognitiveRealmState();
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

// Persist the current Spire layout alongside player stats.
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
