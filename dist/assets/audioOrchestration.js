/**
 * Coordinate audio state handling and UI bindings for the shared AudioManager instance.
 * The factory encapsulates suppression bookkeeping, slider synchronization, and tab music routing
 * so `assets/main.js` can focus on high-level orchestration.
 *
 * @param {Object} options - Dependencies supplied by the caller.
 * @param {import('./audioSystem.js').AudioManager} options.audioManager - Shared audio manager instance.
 * @param {Function} options.bindAudioControlElements - Helper that wires DOM sliders to the manager.
 * @param {Function} options.writeStorageJson - Persistence helper for saving user settings.
 * @param {string} options.audioSettingsStorageKey - Local storage key for audio preferences.
 * @param {Function} options.getActiveTabId - Returns the identifier for the currently selected UI tab.
 * @param {Function} options.isPlayfieldInteractiveLevelActive - Returns true if an interactive level is running.
 * @param {Document} [options.documentRef] - Optional document reference for visibility checks (mainly for testing).
 */
const LAMED_MUSIC_FADE_SECONDS = 1.5; // Short crossfade keeps the Lamed loop seamless.

export function createAudioOrchestration({
  audioManager,
  bindAudioControlElements,
  writeStorageJson,
  audioSettingsStorageKey,
  getActiveTabId,
  isPlayfieldInteractiveLevelActive,
  documentRef = typeof document !== 'undefined' ? document : null,
}) {
  const audioSuppressionReasons = new Set();
  let audioControlsBinding = null;
  let lastMusicKey = null; // Track previous selection so Lamed transitions can crossfade lightly.

  /**
   * Halt music playback while a blocking reason is active (e.g., hidden tab, modal overlay).
   * Subsequent suppression calls with different reasons are tracked so audio only resumes
   * after all reasons have been released.
   *
   * @param {string} [reason='unspecified'] - Human-readable reason for pausing audio.
   */
  function suppressAudioPlayback(reason = 'unspecified') {
    if (!audioManager) {
      return;
    }
    const initialSize = audioSuppressionReasons.size;
    audioSuppressionReasons.add(reason);
    if (initialSize === 0) {
      if (typeof audioManager.suspendLoopingSfx === 'function') {
        audioManager.suspendLoopingSfx();
      }
      if (typeof audioManager.suspendMusic === 'function') {
        audioManager.suspendMusic();
      } else if (typeof audioManager.stopMusic === 'function') {
        audioManager.stopMusic();
      }
    }
  }

  /**
   * Remove a suppression reason (or all reasons) and resume music when appropriate.
   *
   * @param {string} [reason] - Specific reason to clear. When omitted, all reasons are removed.
   */
  function releaseAudioSuppression(reason) {
    if (!audioManager) {
      return;
    }
    if (reason) {
      audioSuppressionReasons.delete(reason);
    } else {
      audioSuppressionReasons.clear();
    }
    if (audioSuppressionReasons.size === 0) {
      if (typeof audioManager.resumeSuspendedLoopingSfx === 'function') {
        audioManager.resumeSuspendedLoopingSfx();
      }
      if (typeof audioManager.resumeSuspendedMusic === 'function') {
        audioManager.resumeSuspendedMusic();
      }
    }
  }

  /**
   * Determine whether audio should remain paused due to suppression bookkeeping or tab visibility.
   *
   * @returns {boolean} True when audio playback is currently blocked.
   */
  function isAudioSuppressed() {
    if (audioSuppressionReasons.size > 0) {
      return true;
    }
    if (documentRef && documentRef.visibilityState === 'hidden') {
      return true;
    }
    return false;
  }

  /**
   * Propagate the latest audio manager values back into any bound slider controls.
   */
  function syncAudioControlsFromManager() {
    if (audioControlsBinding && typeof audioControlsBinding.syncFromManager === 'function') {
      audioControlsBinding.syncFromManager();
    }
  }

  /**
   * Persist current music and SFX volumes so user selections survive reloads.
   */
  function saveAudioSettings() {
    if (!audioManager || !audioSettingsStorageKey) {
      return;
    }
    writeStorageJson(audioSettingsStorageKey, {
      musicVolume: audioManager.musicVolume,
      sfxVolume: audioManager.sfxVolume,
    });
  }

  /**
   * Attach the audio manager to DOM slider controls and ensure commits trigger persistence.
   */
  function bindAudioControls() {
    if (!bindAudioControlElements || !audioManager) {
      return;
    }
    audioControlsBinding = bindAudioControlElements(audioManager, {
      onVolumeCommit: () => {
        saveAudioSettings();
      },
    });
  }

  /**
   * Decide which background music key should be active based on the currently selected tab.
   *
   * @returns {string} Key understood by the AudioManager's manifest.
   */
  function determineMusicKey() {
    const activeTab = (typeof getActiveTabId === 'function' && getActiveTabId()) || 'tower';
    if (activeTab === 'tower') {
      const interactive = Boolean(
        typeof isPlayfieldInteractiveLevelActive === 'function' &&
          isPlayfieldInteractiveLevelActive(),
      );
      return interactive ? 'levelActive' : 'levelSelect';
    }
    if (activeTab === 'towers') {
      return 'towers';
    }
    if (activeTab === 'powder') {
      return 'powder';
    }
    if (activeTab === 'achievements') {
      return 'achievements';
    }
    if (activeTab === 'lamed') {
      return 'lamedSpire'; // Route the Lamed tab to its ambient score.
    }
    if (activeTab === 'options') {
      return 'codex';
    }
    return 'levelSelect';
  }

  /**
   * Play background music for the active tab when audio is not suppressed.
   *
   * @param {Object} [options={}] - Playback options forwarded to the AudioManager.
   */
  function refreshTabMusic(options = {}) {
    if (!audioManager || isAudioSuppressed()) {
      return;
    }
    const key = determineMusicKey();
    if (!key) {
      return;
    }
    const playbackOptions =
      key === 'lamedSpire' || lastMusicKey === 'lamedSpire'
        ? { ...options, fadeSeconds: LAMED_MUSIC_FADE_SECONDS }
        : options;
    audioManager.playMusic(key, playbackOptions);
    lastMusicKey = key;
  }

  return {
    suppressAudioPlayback,
    releaseAudioSuppression,
    isAudioSuppressed,
    syncAudioControlsFromManager,
    saveAudioSettings,
    bindAudioControls,
    determineMusicKey,
    refreshTabMusic,
  };
}
