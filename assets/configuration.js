import towers from './data/towers/index.js';
import {
  setTowerDefinitions,
  setTowerLoadoutLimit,
  getTowerLoadoutState,
  getTowerUnlockState,
  getTowerDefinition,
  setMergingLogicUnlocked,
  initializeDiscoveredVariablesFromUnlocks,
} from './towersTab.js';
import { setEnemyCodexEntries } from './codex.js';
import {
  setLevelBlueprints,
  setLevelConfigs,
  initializeInteractiveLevelProgression,
  populateIdleLevelConfigs,
  pruneLevelState,
  getStartingTheroMultiplier,
} from './levels.js';
import { generateLevelAchievements } from './achievementsTab.js';
import {
  fetchJsonWithFallback,
  getEmbeddedGameplayConfig,
  importJsonModule,
  loadGameplayConfigViaFetch,
  loadGameplayConfigViaModule,
} from './gameplayConfigLoaders.js';
import { mergeMotePalette } from '../scripts/features/towers/powderTower.js';

const GAMEPLAY_CONFIG_RELATIVE_PATH = './data/gameplayConfig.json';
const GAMEPLAY_CONFIG_URL = new URL(GAMEPLAY_CONFIG_RELATIVE_PATH, import.meta.url);
const FLUID_SIM_CONFIG_RELATIVE_PATH = './data/towerFluidSimulation.json';
const FLUID_SIM_CONFIG_URL = new URL(FLUID_SIM_CONFIG_RELATIVE_PATH, import.meta.url);

export const FALLBACK_TOWER_LOADOUT_LIMIT = 2;
export const FALLBACK_BASE_START_THERO = 50;
export const FALLBACK_BASE_CORE_INTEGRITY = 100;
export const FALLBACK_BASE_SCORE_RATE = 1;
export const FALLBACK_BASE_ENERGY_RATE = 0;
export const FALLBACK_BASE_FLUX_RATE = 0;

let gameplayConfigData = null;

let TOWER_LOADOUT_LIMIT = FALLBACK_TOWER_LOADOUT_LIMIT;
let BASE_START_THERO = FALLBACK_BASE_START_THERO;
let BASE_CORE_INTEGRITY = FALLBACK_BASE_CORE_INTEGRITY;

let baseResourcesRef = null;
let resourceStateRef = null;

function assertResourceContainers() {
  if (!baseResourcesRef || !resourceStateRef) {
    throw new Error('Resource containers have not been registered. Call registerResourceContainers first.');
  }
}

export function registerResourceContainers({ baseResources, resourceState }) {
  baseResourcesRef = baseResources;
  resourceStateRef = resourceState;
}

export async function loadFluidSimulationProfile() {
  // Fluid simulation removed
  return null;
}

async function applyGameplayConfigInternal(config = {}) {
  assertResourceContainers();

  gameplayConfigData = config || {};

  const defaults = gameplayConfigData.defaults || {};

  TOWER_LOADOUT_LIMIT =
    Number.isFinite(defaults.towerLoadoutLimit) && defaults.towerLoadoutLimit > 0
      ? Math.max(1, Math.floor(defaults.towerLoadoutLimit))
      : FALLBACK_TOWER_LOADOUT_LIMIT;
  setTowerLoadoutLimit(TOWER_LOADOUT_LIMIT);

  BASE_START_THERO =
    Number.isFinite(defaults.baseStartThero) && defaults.baseStartThero > 0
      ? defaults.baseStartThero
      : FALLBACK_BASE_START_THERO;

  BASE_CORE_INTEGRITY =
    Number.isFinite(defaults.baseCoreIntegrity) && defaults.baseCoreIntegrity > 0
      ? defaults.baseCoreIntegrity
      : FALLBACK_BASE_CORE_INTEGRITY;

  const startingThero = calculateStartingThero();
  baseResourcesRef.score = startingThero;
  resourceStateRef.score = startingThero;
  baseResourcesRef.scoreRate = FALLBACK_BASE_SCORE_RATE;
  baseResourcesRef.energyRate = FALLBACK_BASE_ENERGY_RATE;
  baseResourcesRef.fluxRate = FALLBACK_BASE_FLUX_RATE;
  resourceStateRef.scoreRate = baseResourcesRef.scoreRate;
  resourceStateRef.energyRate = baseResourcesRef.energyRate;
  resourceStateRef.fluxRate = baseResourcesRef.fluxRate;

  const towerDefinitions = towers.map((tower) => ({ ...tower }));
  gameplayConfigData.towers = towerDefinitions;
  setTowerDefinitions(towerDefinitions);

  const loadoutState = getTowerLoadoutState();
  const unlockState = getTowerUnlockState();

  const loadoutCandidates = Array.isArray(defaults.initialTowerLoadout)
    ? defaults.initialTowerLoadout
    : loadoutState.selected;

  const normalizedLoadout = [];
  loadoutCandidates.forEach((towerId) => {
    if (
      typeof towerId === 'string' &&
      getTowerDefinition(towerId) &&
      !normalizedLoadout.includes(towerId) &&
      normalizedLoadout.length < TOWER_LOADOUT_LIMIT
    ) {
      normalizedLoadout.push(towerId);
    }
  });
  if (!normalizedLoadout.length && towerDefinitions.length) {
    normalizedLoadout.push(towerDefinitions[0].id);
  }
  loadoutState.selected = normalizedLoadout;
  setTowerLoadoutLimit(TOWER_LOADOUT_LIMIT);

  const unlocked = new Set(
    Array.isArray(defaults.initialUnlockedTowers)
      ? defaults.initialUnlockedTowers.filter((towerId) => getTowerDefinition(towerId))
      : [],
  );
  loadoutState.selected.forEach((towerId) => {
    if (towerId) {
      unlocked.add(towerId);
    }
  });
  unlockState.unlocked = unlocked;
  setMergingLogicUnlocked(unlocked.has('beta'));
  initializeDiscoveredVariablesFromUnlocks(unlocked);

  setEnemyCodexEntries(gameplayConfigData.enemies);

  setLevelBlueprints(gameplayConfigData.maps);
  setLevelConfigs(gameplayConfigData.levels);
  initializeInteractiveLevelProgression();
  populateIdleLevelConfigs(baseResourcesRef);
  pruneLevelState();

  await generateLevelAchievements();

  return gameplayConfigData;
}

export async function ensureGameplayConfigLoaded() {
  if (gameplayConfigData) {
    return gameplayConfigData;
  }

  let lastError = null;

  try {
    const configFromFetch = await loadGameplayConfigViaFetch(
      GAMEPLAY_CONFIG_URL.href,
      GAMEPLAY_CONFIG_RELATIVE_PATH,
    );
    if (configFromFetch) {
      return applyGameplayConfigInternal(configFromFetch);
    }
  } catch (error) {
    lastError = error;
    console.warn('Primary gameplay-config fetch failed; falling back to alternate loaders.', error);
  }

  const embeddedConfig = getEmbeddedGameplayConfig();
  if (embeddedConfig) {
    return applyGameplayConfigInternal(embeddedConfig);
  }

  try {
    const configFromModule = await loadGameplayConfigViaModule(GAMEPLAY_CONFIG_URL.href);
    if (configFromModule) {
      return applyGameplayConfigInternal(configFromModule);
    }
  } catch (error) {
    lastError = error;
  }

  console.error('Unable to load gameplay configuration', lastError);
  throw lastError || new Error('Unable to load gameplay configuration');
}

export function calculateStartingThero() {
  return BASE_START_THERO * getStartingTheroMultiplier();
}

export function getTowerLoadoutLimit() {
  return TOWER_LOADOUT_LIMIT;
}

/**
 * Allow players to override the tower loadout slot count via preferences.
 */
export function overrideTowerLoadoutLimit(limit) {
  if (!Number.isFinite(limit) || limit <= 0) {
    return;
  }
  const normalizedLimit = Math.max(1, Math.floor(limit));
  TOWER_LOADOUT_LIMIT = normalizedLimit;
  setTowerLoadoutLimit(normalizedLimit);
}

export function getBaseStartThero() {
  return BASE_START_THERO;
}

export function setBaseStartThero(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return;
  }
  BASE_START_THERO = value;
}

export function getBaseCoreIntegrity() {
  return BASE_CORE_INTEGRITY;
}

export function setBaseCoreIntegrity(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return;
  }
  BASE_CORE_INTEGRITY = value;
}

export function getGameplayConfigData() {
  return gameplayConfigData;
}

export function resetGameplayConfigCache() {
  gameplayConfigData = null;
}

