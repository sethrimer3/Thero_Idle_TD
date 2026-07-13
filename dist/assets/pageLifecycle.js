// Coordinates page lifecycle listeners for autosaving, idle tracking, and audio suppression.

/**
 * Bind page visibility and lifecycle events to shared autosave/audio hooks.
 * @param {object} options - Wiring hooks from the main orchestrator.
 * @param {Function} options.commitAutoSave - Persists the latest save state.
 * @param {Function} options.markLastActive - Records the last interaction timestamp.
 * @param {Function} options.suppressAudioPlayback - Mutes music/SFX for a given reason.
 * @param {Function} options.releaseAudioSuppression - Re-enables audio for a given reason.
 * @param {Function} options.refreshTabMusic - Resumes tab-specific music routing.
 * @param {Function} options.checkOfflineRewards - Reconciles idle progression when returning.
 * @param {object} [options.audioManager] - Optional audio manager for hard stops on unload.
 * @param {Function} [options.stopBetSpireRender] - Optional function to stop Bet spire render.
 * @param {Function} [options.resumeBetSpireRender] - Optional function to resume Bet spire render.
 * @returns {Function} Cleanup function that removes all registered listeners.
 */
export function bindPageLifecycleEvents({
  commitAutoSave,
  markLastActive,
  suppressAudioPlayback,
  releaseAudioSuppression,
  refreshTabMusic,
  checkOfflineRewards,
  audioManager,
  stopBetSpireRender,
  resumeBetSpireRender,
}) {
  // Prepare helper that halts any active soundtrack before the session exits.
  const stopMusicIfAvailable = () => {
    if (audioManager && typeof audioManager.stopMusic === 'function') {
      audioManager.stopMusic();
    }
  };

  // Flush progress and quiet audio when the document hides to preserve state in background tabs.
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      commitAutoSave?.();
      markLastActive?.();
      suppressAudioPlayback?.('document-hidden');
      stopBetSpireRender?.(); // Stop Bet spire render to prevent particle accumulation
      return;
    }
    if (document.visibilityState === 'visible') {
      releaseAudioSuppression?.('document-hidden');
      refreshTabMusic?.();
      checkOfflineRewards?.();
      markLastActive?.();
      resumeBetSpireRender?.(); // Resume Bet spire render when tab becomes visible
    }
  };

  // Pause ambient audio when the window loses focus to avoid overlapping sessions.
  const handleBlur = () => {
    suppressAudioPlayback?.('window-blur');
  };

  // Resume ambient audio when focus returns and ensure music routing refreshes.
  const handleFocus = () => {
    releaseAudioSuppression?.('window-blur');
    refreshTabMusic?.();
  };

  // Persist state when the page is hidden during navigation transitions.
  const handlePageHide = () => {
    commitAutoSave?.();
    markLastActive?.();
    suppressAudioPlayback?.('pagehide');
    stopMusicIfAvailable();
    stopBetSpireRender?.(); // Stop Bet spire render on page hide
  };

  // Re-enable audio when the page is restored after a navigation transition.
  const handlePageShow = () => {
    releaseAudioSuppression?.('pagehide');
    refreshTabMusic?.();
    resumeBetSpireRender?.(); // Resume Bet spire render on page show
  };

  // Persist state before unloading the page to cover hard exits.
  const handleBeforeUnload = () => {
    commitAutoSave?.();
    markLastActive?.();
    stopMusicIfAvailable();
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('blur', handleBlur);
  window.addEventListener('focus', handleFocus);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('pageshow', handlePageShow);
  window.addEventListener('beforeunload', handleBeforeUnload);

  // Provide cleanup hook for tests or rehydration cycles.
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('blur', handleBlur);
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('pageshow', handlePageShow);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}
