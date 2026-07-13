'use strict';

/**
 * Factory that manages the level combat lifecycle: entering, starting,
 * victory, defeat, and leaving levels.  Extracted from main.js to reduce
 * its line count and isolate level lifecycle orchestration from the main
 * game coordinator.
 *
 * @param {object} deps - Dependency injection bag.
 */
export function createLevelCombatController(deps) {
  const {
    // ── Mutable state accessors ──────────────────────────────────────
    getActiveLevelId,
    setActiveLevelId,
    getActiveLevelIsInteractive,
    setActiveLevelIsInteractive,
    resourceState,
    baseResources,
    levelState,
    levelLookup,
    levelConfigs,

    // ── Late-bound controllers ───────────────────────────────────────
    getPlayfield,
    getLevelOverlayController,
    getLevelStoryScreen,
    getPlayfieldMenuController,
    getAudioManager,
    getLeaveLevelBtn,

    // ── Playfield outcome helpers ────────────────────────────────────
    hidePlayfieldOutcome,
    showPlayfieldOutcome,
    exitToLevelSelectionFromOutcome,
    handleOutcomeRetryRequest,

    // ── Level progression ────────────────────────────────────────────
    isLevelUnlocked,
    isStoryOnlyLevel,
    isInteractiveLevel,
    isLevelCompleted,
    getPreviousInteractiveLevelId,
    unlockNextInteractiveLevel,
    unlockLevel,
    formatWholeNumber,

    // ── Tutorial / tab gating ────────────────────────────────────────
    checkTutorialCompletion,
    isTutorialCompleted,
    updateTabLockStates,
    isTowersTabUnlocked,
    unlockTowersTabState,
    unlockTowersTab,
    unlockAchievements,
    unlockAchievementsTab,

    // ── Resource / display helpers ───────────────────────────────────
    ensureResourceTicker,
    updateActiveLevelBanner,
    updateLevelCards,
    updateResourceRates,
    updatePowderLedger,
    updateStatusDisplays,
    updateTowerSelectionButtons,
    updateLayoutVisibility,
    notifyLevelVictory,
    commitAutoSave,

    // ── Cognitive realm ──────────────────────────────────────────────
    isCognitiveRealmUnlocked,
    isCognitiveRealmLocked,
    unlockCognitiveRealmRendering,
    updateCognitiveRealmLockState,
    updateTerritoriesForLevel,
    showCognitiveRealmMap,
    hideCognitiveRealmMap,
    getActiveTabId,

    // ── Idle level runs ──────────────────────────────────────────────
    stopAllIdleRuns,
    beginIdleLevelRun,
    updateIdleLevelDisplay,
    stopIdleLevelRun,

    // ── Misc ─────────────────────────────────────────────────────────
    closeLoadoutWheel,
    refreshTabMusic,
    deactivateDeveloperMapTools,
  } = deps;

  // ── Internal mutable state ─────────────────────────────────────────
  let pendingLevel = null;
  let lastLevelTrigger = null;

  // ── Level combat lifecycle ─────────────────────────────────────────

  function handlePlayfieldCombatStart(levelId) {
    if (!levelId) {
      return;
    }
    hidePlayfieldOutcome();
    const existing = levelState.get(levelId) || {
      entered: false,
      running: false,
      completed: false,
    };
    const updated = { ...existing, entered: true, running: true };
    levelState.set(levelId, updated);
    setActiveLevelId(levelId);
    resourceState.running = true;
    ensureResourceTicker();
    updateActiveLevelBanner();
    updateLevelCards();
  }

  function handlePlayfieldVictory(levelId, stats = {}) {
    if (!levelId) {
      return;
    }
    const existing = levelState.get(levelId) || {
      entered: true,
      running: false,
      completed: false,
    };
    const alreadyCompleted = Boolean(existing.completed);
    const bestWave = Math.max(existing.bestWave || 0, stats.maxWave || 0);
    const updated = {
      ...existing,
      entered: true,
      running: false,
      completed: true,
      bestWave,
      lastResult: { outcome: 'victory', stats, timestamp: Date.now() },
    };
    levelState.set(levelId, updated);
    resourceState.running = false;

    notifyLevelVictory(levelId);

    if (!alreadyCompleted) {
      if (typeof stats.rewardScore === 'number') {
        resourceState.score += stats.rewardScore;
      }
      if (typeof stats.rewardFlux === 'number') {
        baseResources.fluxRate += stats.rewardFlux;
      }
      if (typeof stats.rewardEnergy === 'number') {
        baseResources.energyRate += stats.rewardEnergy;
      }
      unlockNextInteractiveLevel(levelId);
      // Check if tutorial completion should be triggered
      checkTutorialCompletion(isLevelCompleted);
      // Update tab lock states in case tutorial was just completed
      updateTabLockStates(isTutorialCompleted());
      updateResourceRates();
      updatePowderLedger();
      
      // Unlock cognitive realm rendering when Chapter 3, level 5 is completed
      if (levelId === '3 - 5' && isCognitiveRealmLocked()) {
        unlockCognitiveRealmRendering();
        updateCognitiveRealmLockState();
      }
    } else {
      updateStatusDisplays();
      updatePowderLedger();
    }

    updateActiveLevelBanner();
    updateLevelCards();
    
    // Update cognitive realm territories on level victory
    if (isCognitiveRealmUnlocked()) {
      updateTerritoriesForLevel(levelId, true);
    }
    
    commitAutoSave();

    const playfield = getPlayfield();
    const activeLevelId = getActiveLevelId();
    const activeLevelIsInteractive = getActiveLevelIsInteractive();
    if (activeLevelId === levelId && activeLevelIsInteractive && playfield) {
      // Surface the victory overlay so the player can exit the battlefield gracefully.
      const level = levelLookup.get(levelId);
      const subtitle = level && level.title ? `${level.title} sealed.` : 'All waves contained.';
      showPlayfieldOutcome({
        outcome: 'victory',
        title: 'Victory!',
        subtitle,
        primaryLabel: 'Back to Level Selection',
        onPrimary: exitToLevelSelectionFromOutcome,
      });
    }
  }

  function handlePlayfieldDefeat(levelId, stats = {}) {
    if (!levelId) {
      return;
    }
    const existing = levelState.get(levelId) || {
      entered: true,
      running: false,
      completed: false,
    };
    const bestWave = Math.max(existing.bestWave || 0, stats.maxWave || 0);
    const updated = {
      ...existing,
      entered: true,
      running: false,
      completed: existing.completed,
      bestWave,
      lastResult: { outcome: 'defeat', stats, timestamp: Date.now() },
    };
    levelState.set(levelId, updated);
    resourceState.running = false;
    updateActiveLevelBanner();
    updateLevelCards();
    
    // Update cognitive realm territories on level defeat
    if (isCognitiveRealmUnlocked()) {
      updateTerritoriesForLevel(levelId, false);
    }
    
    commitAutoSave();

    const playfield = getPlayfield();
    const activeLevelId = getActiveLevelId();
    const activeLevelIsInteractive = getActiveLevelIsInteractive();
    if (activeLevelId === levelId && activeLevelIsInteractive && playfield) {
      // Display defeat messaging and optional endless retry controls directly on the playfield.
      const isEndless = Boolean(playfield.isEndlessMode);
      const fallbackWave = Number.isFinite(playfield.maxWaveReached)
        ? playfield.maxWaveReached
        : null;
      const achievedWave = Number.isFinite(stats.maxWave) ? stats.maxWave : fallbackWave;
      const waveLabel = achievedWave ? formatWholeNumber(achievedWave) : null;
      const subtitle = isEndless && waveLabel
        ? `Wave ${waveLabel} achieved.`
        : 'The defense collapsed—recalibrate and retry.';
      let secondaryLabel = null;
      let secondaryAction = null;
      if (isEndless && typeof playfield.getEndlessCheckpointInfo === 'function') {
        const checkpoint = playfield.getEndlessCheckpointInfo();
        if (checkpoint?.available && Number.isFinite(checkpoint.waveNumber)) {
          const retryWave = formatWholeNumber(checkpoint.waveNumber);
          secondaryLabel = `Retry from wave ${retryWave}`;
          secondaryAction = handleOutcomeRetryRequest;
        }
      }
      showPlayfieldOutcome({
        outcome: 'defeat',
        title: 'Defeat…',
        subtitle,
        primaryLabel: 'Back to Level Selection',
        onPrimary: exitToLevelSelectionFromOutcome,
        secondaryLabel,
        onSecondary: secondaryAction,
      });
    }
  }

  // Update cognitive realm map visibility based on unlock status, tab, and level state
  function updateCognitiveRealmVisibility() {
    const cognitiveRealmSection = document.getElementById('cognitive-realm-section');
    if (!cognitiveRealmSection) {
      return;
    }

    if (isCognitiveRealmUnlocked()) {
      cognitiveRealmSection.hidden = false;
      cognitiveRealmSection.setAttribute('aria-hidden', 'false');
      
      // Only show map if on Defense tab AND not inside a level
      const activeTabId = getActiveTabId();
      const isDefenseTab = activeTabId === 'tower';
      const isInsideLevel = Boolean(getActiveLevelId());
      const shouldShowMap = isDefenseTab && !isInsideLevel;
      
      if (shouldShowMap) {
        showCognitiveRealmMap();
      } else {
        hideCognitiveRealmMap();
      }
    } else {
      cognitiveRealmSection.hidden = true;
      cognitiveRealmSection.setAttribute('aria-hidden', 'true');
      hideCognitiveRealmMap();
    }
  }

  function handleLevelSelection(level) {
    const state = levelState.get(level.id) || { entered: false, running: false };
    const activeElement = document.activeElement;
    if (activeElement && typeof activeElement.focus === 'function') {
      lastLevelTrigger = activeElement;
    } else {
      lastLevelTrigger = null;
    }

    if (!isLevelUnlocked(level.id)) {
      const requirementId = getPreviousInteractiveLevelId(level.id);
      const requirement = requirementId ? levelLookup.get(requirementId) : null;
      const requirementLabel = requirement
        ? `${requirement.id} · ${requirement.title}`
        : 'the preceding defense';
      const playfield = getPlayfield();
      if (playfield?.messageEl) {
        playfield.messageEl.textContent = `Seal ${requirementLabel} to unlock ${level.id}.`;
      }
      const audioManager = getAudioManager();
      if (audioManager) {
        audioManager.playSfx('error');
      }
      lastLevelTrigger = null;
      return;
    }

    // Handle story levels specially - always show story and mark as completed when finished
    const levelStoryScreen = getLevelStoryScreen();
    if (isStoryOnlyLevel(level.id)) {
      if (levelStoryScreen) {
        levelStoryScreen.maybeShowStory(level, {
          shouldShow: () => true, // Force story display for story-only levels
          onComplete: () => {
            // Mark the story level as completed
            if (!isLevelCompleted(level.id)) {
              const currentState = levelState.get(level.id) || {};
              levelState.set(level.id, {
                ...currentState,
                completed: true,
                entered: true,
                storySeen: true,
              });
              unlockNextInteractiveLevel(level.id);
              updateLevelCards();
              
              // Special unlock for Prologue - Story: unlock Achievements and first Trial.
              if (level.id === 'Prologue - Story') {
                unlockAchievements();
                unlockAchievementsTab();
                // Unlock first trial after completing prologue
                if (isInteractiveLevel('Trial - 1')) {
                  unlockLevel('Trial - 1');
                }
              }
              
              // Special unlock for chapter story levels: unlock corresponding Ladder chapter and next Trial
              const chapterStoryMatch = level.id.match(/^([1-6]) - Story$/);
              if (chapterStoryMatch) {
                const chapterNum = Number(chapterStoryMatch[1]);
                // Unlock all Ladder levels for this chapter
                for (let i = 1; i <= 5; i++) {
                  const ladderLevelId = `Ladder - ${chapterNum} - ${i}`;
                  if (isInteractiveLevel(ladderLevelId)) {
                    unlockLevel(ladderLevelId);
                  }
                }
                
                // Unlock next trial after each chapter story (Trial 2-7 unlock after Chapters 1-6)
                const nextTrialNum = chapterNum + 1;
                if (nextTrialNum >= 2 && nextTrialNum <= 7) {
                  const nextTrialId = `Trial - ${nextTrialNum}`;
                  if (isInteractiveLevel(nextTrialId)) {
                    unlockLevel(nextTrialId);
                  }
                }

                // Unlock the first Glyph Trial when the Chapter 6 story is completed.
                if (chapterNum === 6) {
                  const firstGlyphTrialId = 'Glyph Trial - 1';
                  if (isInteractiveLevel(firstGlyphTrialId)) {
                    unlockLevel(firstGlyphTrialId);
                  }
                }
              }
              
              // Check if this completes tutorial
              checkTutorialCompletion(isLevelCompleted);
              updateTabLockStates(isTutorialCompleted());
              commitAutoSave();
            }
          },
        });
      }
      lastLevelTrigger = null;
      return;
    }

    const activeLevelId = getActiveLevelId();
    const otherActiveId = activeLevelId && activeLevelId !== level.id ? activeLevelId : null;
    const otherActiveState = otherActiveId ? levelState.get(otherActiveId) : null;
    const requiresExitConfirm = Boolean(
      otherActiveId && (otherActiveState?.running || otherActiveState?.entered),
    );

    if (!state.entered || requiresExitConfirm) {
      pendingLevel = level;
      const levelOverlayController = getLevelOverlayController();
      if (levelOverlayController) {
        levelOverlayController.showLevelOverlay(level, {
          requireExitConfirm: requiresExitConfirm,
          exitLevelId: otherActiveId,
        });
      }
      return;
    }

    startLevel(level);
    focusLeaveLevelButton();
    lastLevelTrigger = null;
  }

  function cancelPendingLevel() {
    pendingLevel = null;
    const levelOverlayController = getLevelOverlayController();
    if (levelOverlayController) {
      levelOverlayController.hideLevelOverlay();
    }
    if (lastLevelTrigger && typeof lastLevelTrigger.focus === 'function') {
      lastLevelTrigger.focus();
    }
    lastLevelTrigger = null;
  }

  function confirmPendingLevel() {
    if (!pendingLevel) {
      const levelOverlayController = getLevelOverlayController();
      if (levelOverlayController) {
        levelOverlayController.hideLevelOverlay();
      }
      return;
    }

    const levelToStart = pendingLevel;
    pendingLevel = null;
    const levelOverlayController = getLevelOverlayController();
    if (levelOverlayController) {
      levelOverlayController.hideLevelOverlay();
    }
    startLevel(levelToStart);
    focusLeaveLevelButton();
    lastLevelTrigger = null;
  }

  function startLevel(level) {
    deactivateDeveloperMapTools({ force: true, silent: true });
    const currentState = levelState.get(level.id) || {
      entered: false,
      running: false,
      completed: false,
    };
    const isInteractive = isInteractiveLevel(level.id);
    const levelConfig = levelConfigs.get(level.id);
    const forceEndlessMode = Boolean(level?.forceEndlessMode || levelConfig?.forceEndlessMode);
    const endlessCampaign = level?.campaign === 'Ladder';
    if (isInteractive && !isLevelUnlocked(level.id)) {
      const playfield = getPlayfield();
      if (playfield?.messageEl) {
        const requiredId = getPreviousInteractiveLevelId(level.id);
        const requiredLevel = requiredId ? levelLookup.get(requiredId) : null;
        const requirementLabel = requiredLevel
          ? `${requiredLevel.id} · ${requiredLevel.title}`
          : 'the previous defense';
        playfield.messageEl.textContent = `Seal ${requirementLabel} to unlock this path.`;
      }
      return;
    }
    const updatedState = {
      ...currentState,
      entered: true,
      running: !isInteractive,
    };
    levelState.set(level.id, updatedState);
    
    // Unlock Towers tab when entering any interactive level for the first time
    if (isInteractive && !currentState.entered && !isTowersTabUnlocked()) {
      unlockTowersTabState();
      unlockTowersTab();
    }

    stopAllIdleRuns(level.id);

    levelState.forEach((state, id) => {
      if (id !== level.id) {
        levelState.set(id, { ...state, running: false });
      }
    });

    setActiveLevelId(level.id);
    // Remember whether the active map uses the live battlefield.
    setActiveLevelIsInteractive(isInteractive);
    resourceState.running = !isInteractive;
    ensureResourceTicker();
    updateActiveLevelBanner();
    updateLevelCards();

    // Hide cognitive realm map whenever a level begins so rendering pauses inside encounters
    if (isCognitiveRealmUnlocked()) {
      hideCognitiveRealmMap();
    }

    const playfield = getPlayfield();
    if (playfield) {
      // Show a brief loading overlay while the level initialises its canvas and state.
      const loadingEl = typeof document !== 'undefined'
        ? document.getElementById('level-loading-overlay')
        : null;
      if (isInteractive && loadingEl) {
        loadingEl.removeAttribute('hidden');
      }
      playfield.enterLevel(level, {
        endlessMode: forceEndlessMode || endlessCampaign,
      });
      // Hide the loading overlay once the canvas has had two frames to paint its initial state.
      // The first rAF schedules after enterLevel's synchronous setup; the second waits for the
      // resulting paint so the overlay dissolves after the playfield is visually ready.
      if (isInteractive && loadingEl) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            loadingEl.setAttribute('hidden', '');
          });
        });
      }
    }

    const levelStoryScreen = getLevelStoryScreen();
    if (isInteractive && levelStoryScreen) {
      levelStoryScreen.maybeShowStory(level);
    }

    const audioManager = getAudioManager();
    if (isInteractive) {
      if (audioManager) {
        audioManager.playSfx('enterLevel');
      }
      refreshTabMusic({ restart: true });
    } else {
      refreshTabMusic();
    }

    if (!isInteractive) {
      beginIdleLevelRun(level);
    } else {
      updateIdleLevelDisplay();
    }

    updateTowerSelectionButtons();

    // Swap the visible UI surfaces to match the new level state.
    updateLayoutVisibility();
  }

  function leaveActiveLevel() {
    const activeLevelId = getActiveLevelId();
    if (!activeLevelId) return;
    deactivateDeveloperMapTools({ force: true, silent: true });
    hidePlayfieldOutcome();
    const state = levelState.get(activeLevelId);
    if (state) {
      levelState.set(activeLevelId, { ...state, running: false });
    }
    stopIdleLevelRun(activeLevelId);
    const playfield = getPlayfield();
    if (playfield) {
      // Close any open tower selection wheels when leaving the level
      if (typeof playfield.closeTowerSelectionWheel === 'function') {
        playfield.closeTowerSelectionWheel();
      }
      playfield.leaveLevel();
    }
    // Close the loadout wheel when leaving the level
    if (typeof closeLoadoutWheel === 'function') {
      closeLoadoutWheel();
    }
    refreshTabMusic({ restart: true });
    setActiveLevelId(null);

    // Reset the interaction flag so the level grid is visible again.
    setActiveLevelIsInteractive(false);
    resourceState.running = false;
    updateActiveLevelBanner();
    updateLevelCards();
    // Ensure the battlefield stays hidden until another level begins.
    updateLayoutVisibility();
    updateTowerSelectionButtons();
    
    // Show cognitive realm map when leaving a level if on Defense tab
    if (isCognitiveRealmUnlocked()) {
      const activeTabId = getActiveTabId();
      if (activeTabId === 'tower') {
        showCognitiveRealmMap();
      }
    }
    const playfieldMenuController = getPlayfieldMenuController();
    if (playfieldMenuController) {
      playfieldMenuController.updateMenuState();
    }
  }

  function focusLeaveLevelButton() {
    const leaveLevelBtn = getLeaveLevelBtn();
    if (leaveLevelBtn && !leaveLevelBtn.disabled && typeof leaveLevelBtn.focus === 'function') {
      leaveLevelBtn.focus();
    }
  }

  // Lightweight reset that only clears pendingLevel without overlay or focus changes.
  function clearPendingLevel() {
    pendingLevel = null;
  }

  return {
    handlePlayfieldCombatStart,
    handlePlayfieldVictory,
    handlePlayfieldDefeat,
    updateCognitiveRealmVisibility,
    handleLevelSelection,
    cancelPendingLevel,
    confirmPendingLevel,
    clearPendingLevel,
    startLevel,
    leaveActiveLevel,
    focusLeaveLevelButton,
  };
}
