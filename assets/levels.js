// Shared level configuration helpers for Thero Idle.
// This module stores the interactive and idle level blueprints alongside utility functions for progression logic.

import { parseCompactWaveString } from './waveEncoder.js';

export let levelBlueprints = [];
export let levelLookup = new Map();
export const levelConfigs = new Map();
export const idleLevelConfigs = new Map();
export const levelState = new Map();
export let interactiveLevelOrder = [];
export const unlockedLevels = new Set();
export const levelSetEntries = [];

let developerTheroMultiplierOverride = null;

// Clone a vector array so callers never mutate the original level blueprints.
export function cloneVectorArray(array) {
  if (!Array.isArray(array)) {
    return [];
  }
  return array
    .map((point) => {
      if (!point || typeof point !== 'object') {
        return null;
      }
      const x = Number(point.x);
      const y = Number(point.y);
      return {
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
      };
    })
    .filter(Boolean);
}

// Clone a wave array to avoid mutating gameplay configuration structures.
export function cloneWaveArray(array) {
  if (!Array.isArray(array)) {
    return [];
  }
  return array.map((wave) => {
    if (!wave || typeof wave !== 'object') {
      return {
        count: 0,
        interval: 1,
        hp: 0,
        speed: 0,
        reward: 0,
      };
    }
    return {
      ...wave,
      count: Number.isFinite(wave.count) ? wave.count : 0,
      interval: Number.isFinite(wave.interval) ? wave.interval : 1,
      hp: Number.isFinite(wave.hp) ? wave.hp : 0,
      speed: Number.isFinite(wave.speed) ? wave.speed : 0,
      reward: Number.isFinite(wave.reward) ? wave.reward : 0,
      minionCount: Number.isFinite(wave.minionCount) ? wave.minionCount : undefined,
      enemyGroups: Array.isArray(wave.enemyGroups)
        ? wave.enemyGroups.map((group) => ({ ...group }))
        : undefined,
    };
  });
}

// Normalize and store the map blueprints that drive the level select UI.
export function setLevelBlueprints(maps = []) {
  levelBlueprints = Array.isArray(maps) ? maps.map((map) => ({ ...map })) : [];
  levelLookup = new Map(levelBlueprints.map((level) => [level.id, level]));
  return levelBlueprints;
}

// Normalize and store the interactive level configurations.
export function setLevelConfigs(levels = []) {
  levelConfigs.clear();
  (Array.isArray(levels) ? levels : []).forEach((level) => {
    if (!level || !level.id) {
      return;
    }
    
    // Support compact wave format - if waves is a string, parse it
    let waves = level.waves;
    if (typeof waves === 'string') {
      waves = parseCompactWaveString(waves);
    }
    
    levelConfigs.set(level.id, {
      ...level,
      waves: cloneWaveArray(waves),
      path: cloneVectorArray(level.path),
      autoAnchors: cloneVectorArray(level.autoAnchors),
    });
  });
  return levelConfigs;
}

// Rebuild the ordered interactive level list and default unlocks.
export function initializeInteractiveLevelProgression() {
  interactiveLevelOrder = Array.from(levelConfigs.keys());
  unlockedLevels.clear();
  if (interactiveLevelOrder.length) {
    unlockedLevels.add(interactiveLevelOrder[0]);
  }
  return interactiveLevelOrder;
}

// Build idle level payout data using the provided baseline resource rates.
export function populateIdleLevelConfigs(baseResources = {}) {
  idleLevelConfigs.clear();
  levelBlueprints.forEach((level, index) => {
    if (!level || !level.id || levelConfigs.has(level.id)) {
      return;
    }
    const levelNumber = index + 1;
    const runDuration = 90 + levelNumber * 12;
    const rewardMultiplier = 1 + levelNumber * 0.08;
    const rewardScore = (baseResources.scoreRate || 0) * (runDuration / 12) * rewardMultiplier;
    const rewardFlux = 45 + levelNumber * 10;
    const rewardThero = 35 + levelNumber * 8;
    idleLevelConfigs.set(level.id, {
      runDuration,
      rewardScore,
      rewardFlux,
      rewardThero,
    });
  });
  return idleLevelConfigs;
}

// Remove persisted level state entries for maps that no longer exist.
export function pruneLevelState() {
  Array.from(levelState.keys()).forEach((levelId) => {
    if (!levelLookup.has(levelId)) {
      levelState.delete(levelId);
    }
  });
}

// Count completed interactive levels for achievement and reward calculations.
export function getCompletedInteractiveLevelCount() {
  let count = 0;
  interactiveLevelOrder.forEach((levelId) => {
    const state = levelState.get(levelId);
    if (state?.completed) {
      count += 1;
    }
  });
  return count;
}

// Capture the baseline multiplier progression without any overrides.
export function getBaseStartingTheroMultiplier(levelsBeaten = getCompletedInteractiveLevelCount()) {
  const normalized = Number.isFinite(levelsBeaten) ? Math.max(0, levelsBeaten) : 0;
  return 2 ** normalized;
}

// Determine the multiplier applied to starting Thero based on completed levels and overrides.
export function getStartingTheroMultiplier(levelsBeaten = getCompletedInteractiveLevelCount()) {
  if (Number.isFinite(developerTheroMultiplierOverride) && developerTheroMultiplierOverride >= 0) {
    return developerTheroMultiplierOverride;
  }
  return getBaseStartingTheroMultiplier(levelsBeaten);
}

// Allow developer tooling to override the starting Thero multiplier directly.
export function setDeveloperTheroMultiplierOverride(multiplier) {
  if (!Number.isFinite(multiplier) || multiplier < 0) {
    developerTheroMultiplierOverride = null;
    return developerTheroMultiplierOverride;
  }
  developerTheroMultiplierOverride = multiplier;
  return developerTheroMultiplierOverride;
}

// Surface the active developer override for UI sync.
export function getDeveloperTheroMultiplierOverride() {
  return developerTheroMultiplierOverride;
}

// Clear any developer override so progression-based multipliers take effect again.
export function clearDeveloperTheroMultiplierOverride() {
  developerTheroMultiplierOverride = null;
  return developerTheroMultiplierOverride;
}

// Check whether a level id corresponds to an interactive configuration.
export function isInteractiveLevel(levelId) {
  return levelConfigs.has(levelId);
}

// Determine if a level id is marked as secret content.
export function isSecretLevelId(levelId) {
  return typeof levelId === 'string' && /secret/i.test(levelId);
}

// Check whether the supplied level is currently unlocked for play.
export function isLevelUnlocked(levelId) {
  if (!levelId) {
    return false;
  }
  if (!isInteractiveLevel(levelId)) {
    return true;
  }
  return unlockedLevels.has(levelId);
}

// Determine whether the player has already completed the specified level.
export function isLevelCompleted(levelId) {
  if (!levelId) {
    return false;
  }
  const state = levelState.get(levelId);
  return Boolean(state && state.completed);
}

// Mark the supplied level id as unlocked.
export function unlockLevel(levelId) {
  if (!levelId || !isInteractiveLevel(levelId)) {
    return;
  }
  unlockedLevels.add(levelId);
}

// Unlock the next interactive level in sequence once the provided id is cleared.
export function unlockNextInteractiveLevel(levelId) {
  if (!levelId) {
    return;
  }
  const index = interactiveLevelOrder.indexOf(levelId);
  if (index === -1) {
    return;
  }
  for (let offset = index + 1; offset < interactiveLevelOrder.length; offset += 1) {
    const nextId = interactiveLevelOrder[offset];
    if (!nextId) {
      continue;
    }
    if (!unlockedLevels.has(nextId)) {
      unlockLevel(nextId);
      break;
    }
    if (!isLevelCompleted(nextId)) {
      break;
    }
  }
}

// Retrieve the previous interactive level id to support navigation helpers.
export function getPreviousInteractiveLevelId(levelId) {
  if (!levelId) {
    return null;
  }
  const index = interactiveLevelOrder.indexOf(levelId);
  if (index <= 0) {
    return null;
  }
  return interactiveLevelOrder[index - 1] || null;
}
