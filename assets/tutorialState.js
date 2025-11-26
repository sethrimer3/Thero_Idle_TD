// Tutorial state management for the beginning gameplay loop.
// Tracks prologue completion and controls tab locking.

import { readStorage, writeStorage } from './autoSave.js';

const TUTORIAL_STATE_STORAGE_KEY = 'glyph-defense-idle:tutorial-state';

// The IDs of the prologue levels that must be completed to unlock all tabs
const PROLOGUE_LEVEL_IDS = ['Prologue - 1', 'Prologue - 2', 'Prologue - 3'];

let tutorialCompleted = false;

/**
 * Check if the prologue tutorial has been completed by the player.
 * @returns {boolean} True if all prologue levels are completed or tutorial was marked as done.
 */
export function isTutorialCompleted() {
  return tutorialCompleted;
}

/**
 * Mark the tutorial as completed and save the state.
 */
export function completeTutorial() {
  tutorialCompleted = true;
  saveTutorialState();
}

/**
 * Load tutorial state from localStorage.
 */
export function loadTutorialState() {
  const saved = readStorage(TUTORIAL_STATE_STORAGE_KEY);
  if (saved === 'completed') {
    tutorialCompleted = true;
  }
}

/**
 * Save tutorial state to localStorage.
 */
function saveTutorialState() {
  if (tutorialCompleted) {
    writeStorage(TUTORIAL_STATE_STORAGE_KEY, 'completed');
  }
}

/**
 * Reset tutorial state (for testing or game resets).
 */
export function resetTutorialState() {
  tutorialCompleted = false;
  writeStorage(TUTORIAL_STATE_STORAGE_KEY, '');
}

/**
 * Check if a specific level is a prologue level.
 * @param {string} levelId - The level ID to check.
 * @returns {boolean} True if the level is part of the prologue.
 */
export function isPrologueLevel(levelId) {
  return PROLOGUE_LEVEL_IDS.includes(levelId);
}

/**
 * Get the list of prologue level IDs.
 * @returns {string[]} Array of prologue level IDs.
 */
export function getPrologueLevelIds() {
  return [...PROLOGUE_LEVEL_IDS];
}

/**
 * Check tutorial completion based on level completion state.
 * Should be called after level state is loaded.
 * @param {Function} isLevelCompletedFn - Function to check if a level is completed.
 */
export function checkTutorialCompletion(isLevelCompletedFn) {
  // If already marked as completed, keep it that way
  if (tutorialCompleted) {
    return;
  }

  // Check if all prologue levels are completed
  const allPrologueComplete = PROLOGUE_LEVEL_IDS.every((levelId) =>
    isLevelCompletedFn(levelId)
  );

  if (allPrologueComplete) {
    completeTutorial();
  }
}
