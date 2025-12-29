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

const LEVEL_PROGRESS_VERSION = 1;
const PROLOGUE_STORY_ID = 'Prologue - Story';

let developerTheroMultiplierOverride = null;
// Flag to bypass level locks when developer mode is active so the UI always treats maps as available.
let developerModeUnlockOverride = false;

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
  levelBlueprints = Array.isArray(maps)
    ? maps.map((map) => ({
      ...map,
      isStoryLevel: Boolean(map?.isStoryLevel),
    }))
    : [];
  levelLookup = new Map(levelBlueprints.map((level) => [level.id, level]));
  return levelBlueprints;
}

// Normalize and store the interactive level configurations.
export function setLevelConfigs(levels = []) {
  levelConfigs.clear();
  // Scale enemy movement so the prologue starts slower and ramps by ~5% per level.
  const baseMapSpeedMultiplier = 0.25;
  const perLevelSpeedGrowth = 1.05;
  (Array.isArray(levels) ? levels : []).forEach((level, index) => {
    if (!level || !level.id) {
      return;
    }
    
    // Support compact wave format - if waves is a string, parse it
    let waves = level.waves;
    if (typeof waves === 'string') {
      waves = parseCompactWaveString(waves);
    }
    const mapSpeedMultiplier = baseMapSpeedMultiplier * (perLevelSpeedGrowth ** index);

    levelConfigs.set(level.id, {
      ...level,
      isStoryLevel: Boolean(level?.isStoryLevel),
      mapSpeedMultiplier,
      waves: cloneWaveArray(waves),
      path: cloneVectorArray(level.path),
      autoAnchors: cloneVectorArray(level.autoAnchors),
    });
  });
  return levelConfigs;
}

// Identify levels that are purely narrative so the UI can route to the story overlay instead of a playfield.
export function isStoryOnlyLevel(levelId) {
  if (!levelId) {
    return false;
  }
  const blueprint = levelLookup.get(levelId);
  if (blueprint?.isStoryLevel) {
    return true;
  }
  const config = levelConfigs.get(levelId);
  return Boolean(config && config.isStoryLevel);
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
  if (developerModeUnlockOverride) {
    return true;
  }
  if (!isInteractiveLevel(levelId)) {
    return true;
  }
  return unlockedLevels.has(levelId);
}

// Allow developer mode to override level locks without mutating persisted unlock data.
export function setDeveloperModeUnlockOverride(active) {
  developerModeUnlockOverride = Boolean(active);
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

// Serialize the mutable level state and unlock list so autosave can persist progress snapshots.
export function getLevelProgressSnapshot() {
  const stateEntries = [];
  levelState.forEach((state, levelId) => {
    if (!levelId || !state) {
      return;
    }
    const entry = {
      id: levelId,
      entered: Boolean(state.entered),
      completed: Boolean(state.completed),
    };
    if (state.storySeen) {
      entry.storySeen = true;
    }
    if (Number.isFinite(state.bestWave)) {
      entry.bestWave = Math.max(0, state.bestWave);
    }
    if (state.lastResult && typeof state.lastResult === 'object') {
      const sanitizedResult = {};
      if (typeof state.lastResult.outcome === 'string') {
        sanitizedResult.outcome = state.lastResult.outcome;
      }
      if (Number.isFinite(state.lastResult.timestamp)) {
        sanitizedResult.timestamp = state.lastResult.timestamp;
      }
      if (state.lastResult.stats && typeof state.lastResult.stats === 'object') {
        const stats = {};
        Object.entries(state.lastResult.stats).forEach(([key, value]) => {
          if (Number.isFinite(value)) {
            stats[key] = value;
          }
        });
        if (Object.keys(stats).length) {
          sanitizedResult.stats = stats;
        }
      }
      if (Object.keys(sanitizedResult).length) {
        entry.lastResult = sanitizedResult;
      }
    }
    stateEntries.push(entry);
  });

  return {
    version: LEVEL_PROGRESS_VERSION,
    unlocked: Array.from(unlockedLevels),
    state: stateEntries,
  };
}

function sanitizeStoredLevelResult(result) {
  if (!result || typeof result !== 'object') {
    return null;
  }
  const sanitized = {};
  if (typeof result.outcome === 'string') {
    sanitized.outcome = result.outcome;
  }
  if (Number.isFinite(result.timestamp)) {
    sanitized.timestamp = result.timestamp;
  }
  if (result.stats && typeof result.stats === 'object') {
    const stats = {};
    Object.entries(result.stats).forEach(([key, value]) => {
      if (Number.isFinite(value)) {
        stats[key] = value;
      }
    });
    if (Object.keys(stats).length) {
      sanitized.stats = stats;
    }
  }
  return Object.keys(sanitized).length ? sanitized : null;
}

function rebuildUnlockedLevelsFromState() {
  unlockedLevels.clear();
  if (!interactiveLevelOrder.length) {
    return;
  }
  const firstLevel = interactiveLevelOrder[0];
  if (firstLevel) {
    unlockedLevels.add(firstLevel);
  }
  for (let index = 0; index < interactiveLevelOrder.length - 1; index += 1) {
    const levelId = interactiveLevelOrder[index];
    const nextId = interactiveLevelOrder[index + 1];
    if (!levelId || !nextId) {
      continue;
    }
    const state = levelState.get(levelId);
    if (state?.completed) {
      unlockedLevels.add(nextId);
    } else if (!unlockedLevels.has(levelId)) {
      break;
    }
  }
}

// Hydrate the level state and unlock list using the persisted snapshot.
export function applyLevelProgressSnapshot(snapshot = {}) {
  if (!snapshot || typeof snapshot !== 'object') {
    return false;
  }

  let restored = false;
  if (Array.isArray(snapshot.state)) {
    levelState.clear();
    snapshot.state.forEach((entry) => {
      if (!entry || typeof entry !== 'object' || !entry.id) {
        return;
      }
      const hydratedState = {
        entered: Boolean(entry.entered),
        running: false,
        completed: Boolean(entry.completed),
      };
      if (entry.storySeen) {
        hydratedState.storySeen = true;
      }
      if (Number.isFinite(entry.bestWave)) {
        hydratedState.bestWave = Math.max(0, entry.bestWave);
      }
      const hydratedResult = sanitizeStoredLevelResult(entry.lastResult);
      if (hydratedResult) {
        hydratedState.lastResult = hydratedResult;
      }
      levelState.set(entry.id, hydratedState);
    });
    restored = true;
  }

  const unlockedSource = Array.isArray(snapshot.unlocked) ? snapshot.unlocked : null;
  unlockedLevels.clear();
  if (unlockedSource && unlockedSource.length) {
    unlockedSource.forEach((levelId) => {
      if (isInteractiveLevel(levelId)) {
        unlockedLevels.add(levelId);
      }
    });
  }

  if (!unlockedLevels.size) {
    rebuildUnlockedLevelsFromState();
  }

  if (!unlockedLevels.size && interactiveLevelOrder.length) {
    const firstLevel = interactiveLevelOrder[0];
    if (firstLevel) {
      unlockedLevels.add(firstLevel);
    }
  }

  // Migration for existing saves when the Prologue story level was added after the initial release.
  // Players who completed Prologue 1–3 before this level existed would otherwise see later campaigns locked.
  if (levelLookup.has(PROLOGUE_STORY_ID)) {
    const prologuePrereqs = ['Prologue - 1', 'Prologue - 2', 'Prologue - 3'];
    const prologueCompleted = prologuePrereqs.every((levelId) => levelState.get(levelId)?.completed);
    const storyState = levelState.get(PROLOGUE_STORY_ID);

    if (prologueCompleted && !unlockedLevels.has(PROLOGUE_STORY_ID)) {
      unlockedLevels.add(PROLOGUE_STORY_ID);
    }

    if (prologueCompleted && (!storyState || !storyState.completed)) {
      levelState.set(PROLOGUE_STORY_ID, {
        entered: true,
        running: false,
        completed: true,
        storySeen: true,
        ...(storyState?.bestWave ? { bestWave: storyState.bestWave } : {}),
        ...(storyState?.lastResult ? { lastResult: storyState.lastResult } : {}),
      });
    }
  }

  return restored || Boolean(unlockedSource?.length);
}
