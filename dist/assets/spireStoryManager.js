/**
 * Spire story manager extracted from main.js.
 * Tracks which spire introductory narratives the player has read and surfaces
 * them the first time each spire tab is visited or when the field notes overlay is opened.
 *
 * @module spireStoryManager
 */

// Narrative targets for each spire tab so the shared story overlay can surface their briefings.
export const SPIRE_STORY_TARGETS = {
  powder: { id: 'spire-powder', title: 'Aleph Spire' },
  fluid: { id: 'spire-fluid', title: 'Bet Spire' },
  lamed: { id: 'spire-lamed', title: 'Lamed Spire' },
  tsadi: { id: 'spire-tsadi', title: 'Tsadi Spire' },
  shin: { id: 'spire-shin', title: 'Shin Spire' },
  kuf: { id: 'spire-kuf', title: 'Kuf Spire' },
  achievements: { id: 'achievements', title: 'Achievements' },
};

/**
 * Create a manager that tracks spire story state and surfaces briefings.
 *
 * @param {Object} options - Dependency injection options.
 * @param {Object} options.spireResourceState - Shared mutable spire resource state object (mutated in place).
 * @param {Function} options.getLevelStoryScreen - Returns the current level story screen instance.
 * @param {Iterable} options.levelBlueprints - Iterable of all level blueprint objects.
 * @param {Function} options.getLevelState - Returns the persisted state for a given levelId.
 * @param {Function} [options.isStoryOnlyLevel] - Unused; retained for backward compatibility.
 * @param {Function} options.commitAutoSave - Flush the current save state to persistent storage.
 * @returns {{ buildSeenStoryEntries: Function, maybeShowSpireStory: Function }}
 */
export function createSpireStoryManager({
  spireResourceState,
  getLevelStoryScreen,
  levelBlueprints,
  getLevelState,
  isStoryOnlyLevel: _isStoryOnlyLevel,
  commitAutoSave,
}) {
  /**
   * Retrieve or initialize the persistent story branch for a spire so unlock flow and autosave share state.
   * @param {string} spireId - Identifier for the spire tab (powder, fluid, lamed, tsadi, shin, kuf).
   * @returns {Object|null} Reference to the spire story state branch.
   */
  function getSpireStoryBranch(spireId) {
    if (!spireId) {
      return null;
    }
    if (!Object.prototype.hasOwnProperty.call(spireResourceState, spireId)) {
      spireResourceState[spireId] = { storySeen: false };
    }
    const branch = spireResourceState[spireId] || {};
    if (typeof branch.storySeen !== 'boolean') {
      branch.storySeen = false;
    }
    return branch;
  }

  /**
   * Mark a spire briefing as viewed and persist the change to storage.
   * @param {string} spireId - Identifier for the spire tab.
   */
  function markSpireStorySeen(spireId) {
    const branch = getSpireStoryBranch(spireId);
    if (!branch || branch.storySeen) {
      return;
    }
    branch.storySeen = true;
    commitAutoSave();
  }

  /**
   * Build the ordered list of story screens the player has unlocked for the codex field notes view.
   * Story-only levels are listed in campaign order, followed by any spire briefings that have been read.
   * @returns {Promise<Array<{id:string,title:string,sections:string[]}>>} Authored story entries the player has seen.
   */
  async function buildSeenStoryEntries() {
    const levelStoryScreen = typeof getLevelStoryScreen === 'function' ? getLevelStoryScreen() : null;
    if (!levelStoryScreen || typeof levelStoryScreen.getStoryEntry !== 'function') {
      return [];
    }

    const storyIds = [];

    // Include all levels (story-only or not) where the player has seen the story screen.
    levelBlueprints.forEach((level) => {
      const state = typeof getLevelState === 'function' ? getLevelState(level.id) : null;
      if (state?.storySeen) {
        storyIds.push(level.id);
      }
    });

    Object.entries(SPIRE_STORY_TARGETS).forEach(([spireId, storyTarget]) => {
      const branch = getSpireStoryBranch(spireId);
      if (storyTarget?.id && branch?.storySeen) {
        storyIds.push(storyTarget.id);
      }
    });

    const uniqueStoryIds = [...new Set(storyIds)];
    const seenEntries = [];
    for (const storyId of uniqueStoryIds) {
      try {
        const entry = await levelStoryScreen.getStoryEntry(storyId);
        if (entry) {
          seenEntries.push(entry);
        }
      } catch (error) {
        console.warn('Unable to load story entry for field notes', storyId, error);
      }
    }

    return seenEntries;
  }

  /**
   * Trigger the shared story overlay when a spire tab opens for the first time.
   * @param {string} spireId - Identifier for the spire tab being opened.
   */
  function maybeShowSpireStory(spireId) {
    const levelStoryScreen = typeof getLevelStoryScreen === 'function' ? getLevelStoryScreen() : null;
    if (!levelStoryScreen) {
      return;
    }
    const storyTarget = SPIRE_STORY_TARGETS[spireId];
    const branch = getSpireStoryBranch(spireId);
    if (!storyTarget || !branch || branch.storySeen) {
      return;
    }
    levelStoryScreen.maybeShowStory(storyTarget, {
      shouldShow: () => !branch.storySeen,
      onComplete: () => markSpireStorySeen(spireId),
    });
  }

  return {
    buildSeenStoryEntries,
    maybeShowSpireStory,
  };
}
