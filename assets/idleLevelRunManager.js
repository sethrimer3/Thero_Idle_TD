/**
 * Coordinate background idle level simulations so `main.js` can stay focused on
 * orchestration. The factory encapsulates the bookkeeping required to start,
 * stop, and display the status of automated level runs while exposing a shared
 * `Map` so developer tooling can inspect the current runners.
 *
 * @param {Object} options - Dependencies supplied by the caller.
 * @param {Map<string, Object>} options.idleLevelConfigs - Per-level idle config definitions.
 * @param {Map<string, Object>} options.levelState - Mutable level state lookup table.
 * @param {Map<string, Object>} options.levelLookup - Metadata lookup so UI labels stay consistent.
 * @param {Function} options.isInteractiveLevel - Returns true when a level id represents an interactive map.
 * @param {Function} options.updateLevelCards - Refreshes level cards when runner state changes.
 * @param {Function} options.handlePlayfieldVictory - Callback fired when an idle run completes successfully.
 * @param {Function} options.getActiveLevelId - Returns the currently active level id (if any).
 * @param {Function} options.getPlayfieldElements - Returns the DOM references used for idle status messaging.
 * @returns {Object} Idle run helpers and the shared runner map.
 */
export function createIdleLevelRunManager({
  idleLevelConfigs,
  levelState,
  levelLookup,
  isInteractiveLevel,
  updateLevelCards,
  handlePlayfieldVictory,
  getActiveLevelId,
  getPlayfieldElements,
}) {
  const idleLevelRuns = new Map();
  let idleRunAnimationHandle = null;

  const isInteractive = (levelId) =>
    Boolean(typeof isInteractiveLevel === 'function' && isInteractiveLevel(levelId));

  const getActiveId = () => (typeof getActiveLevelId === 'function' ? getActiveLevelId() : null);

  const getPlayfieldDom = () => (typeof getPlayfieldElements === 'function' ? getPlayfieldElements() : null);

  const getLevelConfig = (levelId) =>
    idleLevelConfigs && typeof idleLevelConfigs.get === 'function' ? idleLevelConfigs.get(levelId) || null : null;

  const getLevelMeta = (levelId) =>
    levelLookup && typeof levelLookup.get === 'function' ? levelLookup.get(levelId) || null : null;

  const getLevelState = (levelId) =>
    levelState && typeof levelState.get === 'function' ? levelState.get(levelId) || null : null;

  const setLevelState = (levelId, value) => {
    if (!levelState || typeof levelState.set !== 'function') {
      return;
    }
    levelState.set(levelId, value);
  };

  function stopIdleRunLoop() {
    if (idleRunAnimationHandle === null) {
      return;
    }
    if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(idleRunAnimationHandle);
    }
    idleRunAnimationHandle = null;
  }

  function updateIdleRuns(timestamp) {
    if (!idleLevelRuns.size) {
      const activeId = getActiveId();
      if (activeId && !isInteractive(activeId)) {
        updateIdleLevelDisplay();
      }
      return;
    }

    const now = typeof timestamp === 'number' ? timestamp : 0;

    idleLevelRuns.forEach((runner, levelId) => {
      if (runner.startTime === null) {
        runner.startTime = now;
      }

      const elapsed = Math.max(0, now - runner.startTime);
      const total = Math.max(1, runner.durationMs);
      const clampedElapsed = Math.min(elapsed, total);

      runner.progress = clampedElapsed / total;
      runner.remainingMs = Math.max(0, total - clampedElapsed);

      if (elapsed >= total) {
        idleLevelRuns.delete(levelId);
        runner.progress = 1;
        runner.remainingMs = 0;
        completeIdleLevelRun(levelId, runner);
      }
    });

    if (typeof updateLevelCards === 'function') {
      updateLevelCards();
    }

    const activeId = getActiveId();
    if (activeId && !isInteractive(activeId)) {
      updateIdleLevelDisplay(idleLevelRuns.get(activeId) || null);
    }
  }

  function ensureIdleRunLoop() {
    if (idleRunAnimationHandle !== null) {
      return;
    }
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      return;
    }

    const step = (timestamp) => {
      idleRunAnimationHandle = null;
      updateIdleRuns(timestamp);
      if (idleLevelRuns.size) {
        ensureIdleRunLoop();
      }
    };

    idleRunAnimationHandle = window.requestAnimationFrame(step);
  }

  function beginIdleLevelRun(level) {
    if (!level || !level.id || isInteractive(level.id)) {
      return;
    }

    const config = getLevelConfig(level.id);
    const durationSeconds = Number.isFinite(config?.runDuration) ? Math.max(1, config.runDuration) : 90;
    const rewardScore = Number.isFinite(config?.rewardScore) ? Math.max(0, config.rewardScore) : 0;
    const rewardFlux = Number.isFinite(config?.rewardFlux) ? Math.max(0, config.rewardFlux) : 0;
    const rewardEnergy = Number.isFinite(config?.rewardEnergy)
      ? Math.max(0, config.rewardEnergy)
      : Number.isFinite(config?.rewardThero)
        ? Math.max(0, config.rewardThero)
        : 0;
    const durationMs = durationSeconds * 1000;

    const runner = {
      levelId: level.id,
      startTime: null,
      duration: durationSeconds,
      durationMs,
      progress: 0,
      remainingMs: durationMs,
      rewardScore,
      rewardFlux,
      rewardEnergy,
    };

    idleLevelRuns.set(level.id, runner);

    const existingState = getLevelState(level.id);
    if (existingState && !existingState.running) {
      setLevelState(level.id, { ...existingState, running: true });
    }

    if (typeof updateLevelCards === 'function') {
      updateLevelCards();
    }

    if (getActiveId() === level.id) {
      updateIdleLevelDisplay(runner);
    }

    ensureIdleRunLoop();
  }

  function stopIdleLevelRun(levelId) {
    if (!levelId || isInteractive(levelId)) {
      return;
    }

    const runnerActive = idleLevelRuns.has(levelId);
    if (runnerActive) {
      idleLevelRuns.delete(levelId);
    }

    const state = getLevelState(levelId);
    if (state && state.running) {
      setLevelState(levelId, { ...state, running: false });
    }

    if (runnerActive && typeof updateLevelCards === 'function') {
      updateLevelCards();
    }

    if (getActiveId() === levelId) {
      updateIdleLevelDisplay();
    }

    if (!idleLevelRuns.size) {
      stopIdleRunLoop();
    }
  }

  function stopAllIdleRuns(exceptId) {
    const levelIds = Array.from(idleLevelRuns.keys());
    levelIds.forEach((levelId) => {
      if (levelId === exceptId) {
        return;
      }
      stopIdleLevelRun(levelId);
    });
  }

  function completeIdleLevelRun(levelId, runner) {
    if (!levelId || isInteractive(levelId)) {
      return;
    }

    const stats = {
      rewardScore: runner.rewardScore,
      rewardFlux: runner.rewardFlux,
      rewardEnergy: runner.rewardEnergy,
      runDuration: runner.duration,
    };

    if (typeof handlePlayfieldVictory === 'function') {
      handlePlayfieldVictory(levelId, stats);
    }

    if (getActiveId() === levelId) {
      updateIdleLevelDisplay();
    }
  }

  function updateIdleLevelDisplay(activeRunner = null) {
    const activeLevelId = getActiveId();
    if (!activeLevelId || isInteractive(activeLevelId)) {
      return;
    }

    const elements = getPlayfieldDom();
    if (!elements || !elements.message || !elements.progress) {
      return;
    }

    const level = getLevelMeta(activeLevelId);
    const state = getLevelState(activeLevelId) || {};
    const runner = activeRunner || idleLevelRuns.get(activeLevelId) || null;

    if (!level) {
      return;
    }

    if (runner) {
      const remainingSeconds = Math.ceil(runner.remainingMs / 1000);
      const percent = Math.min(100, Math.max(0, Math.round(runner.progress * 100)));
      elements.message.textContent = `${level.title} auto-sim running—sigils recalibrating.`;
      elements.progress.textContent = `Simulation progress: ${percent}% · ${remainingSeconds}s remaining.`;
    } else if (state.running) {
      elements.message.textContent = `${level.title} is initializing—automated glyphs mobilizing.`;
      elements.progress.textContent = 'Auto-run preparing to deploy.';
    } else if (state.completed) {
      elements.message.textContent = `${level.title} sealed—auto-run rewards claimed.`;
      elements.progress.textContent = 'Simulation complete. Re-enter to rerun the proof.';
    } else {
      elements.message.textContent = 'Tap the highlighted overlay to begin this automated defense.';
      elements.progress.textContent = 'Awaiting confirmation.';
    }

    if (elements.wave) {
      elements.wave.textContent = '—';
    }
    if (elements.health) {
      elements.health.textContent = '—';
    }
    if (elements.energy) {
      elements.energy.textContent = '—';
    }

    if (elements.startButton) {
      if (runner || state.running) {
        elements.startButton.textContent = runner ? 'Auto-run Active' : 'Auto-run Initializing';
      } else {
        elements.startButton.textContent = 'Preview Only';
      }
      elements.startButton.disabled = true;
    }
  }

  return {
    idleLevelRuns,
    beginIdleLevelRun,
    stopIdleLevelRun,
    stopAllIdleRuns,
    updateIdleLevelDisplay,
  };
}
