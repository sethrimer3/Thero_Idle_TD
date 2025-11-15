/**
 * Centralized audio system module responsible for the AudioManager wiring,
 * slider bindings, persistence helpers, activation logic, and contextual music selection.
 */

/**
 * Default manifest describing background music and sound effects used by the game.
 * Individual tracks map to files stored under the audio asset folders.
 */
export const DEFAULT_AUDIO_MANIFEST = {
  musicVolume: 0.5,
  sfxVolume: 0.5,
  musicCrossfadeSeconds: 3,
  music: {
    levelSelect: { file: 'level_selection_music.mp3', loop: true, volume: 0.65 },
    levelActive: { file: 'inside_level_music.mp3', loop: true, volume: 0.7 },
    towers: { file: 'towers_music.mp3', loop: true, volume: 0.65 },
    powder: { file: 'mote_screen_music.mp3', loop: true, volume: 0.65 },
    achievements: { file: 'achievements_music.mp3', loop: true, volume: 0.6 },
    codex: { file: 'codex_music.mp3', loop: true, volume: 0.6 },
    // Ambient loop for the Lamed Spire tab.
    lamedSpire: { file: 'lamed_spire_loop.ogg', loop: true, volume: 0.6 },
  },
  sfx: {
    uiConfirm: { file: 'menu_selection_alt.mp3', volume: 0.55, maxConcurrent: 2 },
    uiToggle: { file: 'menu_selection_OLD.mp3', volume: 0.5, maxConcurrent: 2 },
    menuSelect: { file: 'menu_selection.mp3', volume: 0.55, maxConcurrent: 4 },
    towerPlace: { file: 'tower_placement.mp3', volume: 0.7, maxConcurrent: 4 },
    towerMerge: { file: 'tower_merge.mp3', volume: 0.75, maxConcurrent: 2 },
    towerSell: { file: 'tower_merge.mp3', volume: 0.7, maxConcurrent: 2 },
    enterLevel: { file: 'enter_level.mp3', volume: 0.75, maxConcurrent: 2 },
    pageTurn: { file: 'page_turn.mp3', volume: 0.6, maxConcurrent: 2 },
    error: { file: 'error.mp3', volume: 0.8, maxConcurrent: 2 },
    alphaTowerFire: { file: 'alpha_tower_firing.mp3', volume: 0.55, maxConcurrent: 5 },
    noteA: { file: 'note_A.mp3', volume: 0.8, maxConcurrent: 3 },
    noteB: { file: 'note_B.mp3', volume: 0.8, maxConcurrent: 3 },
    noteDSharp: { file: 'note_D#.mp3', volume: 0.8, maxConcurrent: 3 },
    noteFSharp: { file: 'note_F#.mp3', volume: 0.8, maxConcurrent: 3 },
    noteG: { file: 'note_G.mp3', volume: 0.8, maxConcurrent: 3 },
  },
};

/**
 * Enumerates the tower placement note keys so helper functions can play scales.
 */
export const TOWER_NOTE_SFX_KEYS = ['noteA', 'noteB', 'noteDSharp', 'noteFSharp', 'noteG'];

/**
 * Storage key used to persist player-selected audio levels across sessions.
 */
export const AUDIO_SETTINGS_STORAGE_KEY = 'glyph-defense-idle:audio';

/**
 * Runtime manager that loads and plays background music and sound effects.
 */
export class AudioManager {
  constructor(manifest = {}) {
    this.musicFolder = 'assets/audio/music';
    this.sfxFolder = 'assets/audio/sfx';
    this.musicDefinitions = manifest.music || {};
    this.sfxDefinitions = manifest.sfx || {};
    this.musicVolume = this._clampVolume(manifest.musicVolume, 0.5);
    this.sfxVolume = this._clampVolume(manifest.sfxVolume, 0.5);
    this.musicElements = new Map();
    this.sfxPools = new Map();
    this.currentMusicKey = null;
    this.activeMusicEntry = null;
    this.activeMusicFade = null;
    this.pendingUnlockResolvers = [];
    this.pendingMusicKey = null;
    this.unlocked = false;
    this.musicCrossfadeDuration = Math.max(
      0,
      Number.isFinite(manifest.musicCrossfadeSeconds)
        ? manifest.musicCrossfadeSeconds
        : 3,
    );
    this.musicFadeHandle = null;
    this.musicFadeCanceler = null;
    this.activationElements = typeof WeakSet === 'function' ? new WeakSet() : { add() {}, has() { return false; } };
    this.suspendedMusic = null;

    if (typeof document !== 'undefined') {
      const unlockHandler = () => this.unlock();
      document.addEventListener('pointerdown', unlockHandler, { once: true });
      document.addEventListener('keydown', unlockHandler, { once: true });
    }
  }

  /**
   * Registers multiple interactive elements that should unlock audio playback.
   */
  registerActivationElements(elements) {
    if (!Array.isArray(elements)) {
      return;
    }
    elements.forEach((element) => this.registerActivationElement(element));
  }

  /**
   * Registers a single interactive element that triggers audio unlocking.
   */
  registerActivationElement(element) {
    if (!element || (this.activationElements && this.activationElements.has(element))) {
      return;
    }

    const handler = () => {
      this.unlock();
      ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach((eventName) => {
        element.removeEventListener(eventName, handler);
      });
    };

    ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach((eventName) => {
      element.addEventListener(eventName, handler);
    });

    if (this.activationElements && typeof this.activationElements.add === 'function') {
      this.activationElements.add(element);
    }
  }

  /**
   * Marks the audio system as unlocked and resolves pending play requests.
   */
  unlock() {
    if (this.unlocked) {
      return;
    }
    this.unlocked = true;
    while (this.pendingUnlockResolvers.length) {
      const resolve = this.pendingUnlockResolvers.shift();
      if (typeof resolve === 'function') {
        resolve();
      }
    }
  }

  /**
   * Returns a promise that resolves once the audio context is interactively unlocked.
   */
  whenUnlocked() {
    if (this.unlocked) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.pendingUnlockResolvers.push(resolve);
    });
  }

  /**
   * Plays a looping music track while fading from any currently active track.
   */
  playMusic(key, options = {}) {
    if (!key) {
      return;
    }

    this.suspendedMusic = null;

    const startPlayback = () => {
      const entry = this._ensureMusicEntry(key);
      if (!entry) {
        return;
      }

      const { audio, definition } = entry;
      const loop = typeof options.loop === 'boolean' ? options.loop : definition.loop !== false;
      audio.loop = loop;
      const targetVolume = this._resolveMusicVolume(definition, options.volume);
      const currentKey = this.currentMusicKey;
      const sameTrack = currentKey === key;
      const shouldRestart = Boolean(options.restart) || !sameTrack || audio.paused;

      this._cancelMusicFade({ finalize: true });

      if (!sameTrack || !this.activeMusicEntry || this.activeMusicEntry.audio !== audio) {
        // Only fade from an existing track when the requested key actually changes.
        const fromEntry = sameTrack ? null : this.activeMusicEntry;
        const fadeDuration = Number.isFinite(options.fadeSeconds)
          ? options.fadeSeconds
          : this.musicCrossfadeDuration;
        this._startMusicFade({
          fromEntry,
          toEntry: entry,
          targetVolume,
          durationSeconds: fadeDuration,
        });
      } else {
        audio.volume = targetVolume;
      }

      if (shouldRestart) {
        try {
          audio.currentTime = 0;
        } catch (error) {
          audio.src = audio.src;
        }
      }

      const playPromise = audio.play();
      if (typeof playPromise?.catch === 'function') {
        playPromise.catch(() => {});
      }

      this.currentMusicKey = key;
      this.activeMusicEntry = entry;
    };

    if (!this.unlocked) {
      this.whenUnlocked().then(() => startPlayback());
      return;
    }

    startPlayback();
  }

  /**
   * Stops any active music track while remembering it for potential resume.
   */
  suspendMusic() {
    if (!this.activeMusicEntry?.audio) {
      return;
    }
    this.suspendedMusic = this.activeMusicEntry;
    this.stopMusic();
  }

  /**
   * Resumes the previously suspended music track if available.
   */
  resumeSuspendedMusic() {
    if (!this.suspendedMusic) {
      return;
    }
    const entry = this.suspendedMusic;
    this.suspendedMusic = null;
    this.playMusic(entry.key || this.currentMusicKey, { restart: false });
  }

  /**
   * Stops the currently active music track without fade-out.
   */
  stopMusic() {
    if (!this.activeMusicEntry?.audio) {
      return;
    }
    const { audio } = this.activeMusicEntry;
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch (error) {
      audio.src = audio.src;
    }
    this.currentMusicKey = null;
    this.activeMusicEntry = null;
    this._cancelMusicFade({ finalize: true });
  }

  /**
   * Plays a discrete sound effect using the configured audio pool.
   */
  playSfx(key, options = {}) {
    if (!key) {
      return;
    }

    const startPlayback = () => {
      const entry = this._ensureSfxEntry(key);
      if (!entry) {
        return;
      }

      const { definition, pool } = entry;
      if (!pool || !pool.length) {
        return;
      }

      const index = entry.nextIndex ?? 0;
      const audio = pool[index];
      entry.nextIndex = (index + 1) % pool.length;

      audio.loop = false;
      audio.volume = this._resolveSfxVolume(definition, options.volume);

      try {
        audio.currentTime = 0;
      } catch (error) {
        audio.src = audio.src;
      }

      const playPromise = audio.play();
      if (typeof playPromise?.catch === 'function') {
        playPromise.catch(() => {});
      }
    };

    if (!this.unlocked) {
      this.whenUnlocked().then(() => startPlayback());
      return;
    }

    startPlayback();
  }

  /**
   * Begins a crossfade between two music tracks when transitions occur.
   */
  _startMusicFade({ fromEntry = null, toEntry, targetVolume, durationSeconds }) {
    if (!toEntry || !toEntry.audio) {
      return;
    }

    const toAudio = toEntry.audio;
    const resolvedTarget = Number.isFinite(targetVolume)
      ? targetVolume
      : this._resolveMusicVolume(toEntry.definition);
    const durationMs = Math.max(
      0,
      Number.isFinite(durationSeconds) ? durationSeconds : this.musicCrossfadeDuration,
    ) * 1000;

    let fromAudio = fromEntry && fromEntry.audio !== toAudio ? fromEntry.audio : null;
    if (!fromAudio || fromAudio === toAudio) {
      fromAudio = null;
    }

    const fadeState = {
      fromEntry,
      toEntry,
      targetVolume: resolvedTarget,
    };
    this.activeMusicFade = fadeState;

    if (durationMs <= 0) {
      if (fromAudio) {
        fromAudio.volume = 0;
        fromAudio.pause();
        try {
          fromAudio.currentTime = 0;
        } catch (error) {
          fromAudio.src = fromAudio.src;
        }
      }
      toAudio.volume = resolvedTarget;
      this.musicFadeHandle = null;
      this.musicFadeCanceler = null;
      this.activeMusicFade = null;
      return;
    }

    const startTime = this._now();
    const startToVolume = toAudio.volume;
    const startFromVolume = fromAudio ? fromAudio.volume : 0;

    const schedule = typeof requestAnimationFrame === 'function'
      ? (fn) => requestAnimationFrame(fn)
      : (fn) => setTimeout(() => fn(this._now()), 16);
    const cancel = typeof cancelAnimationFrame === 'function'
      ? (id) => cancelAnimationFrame(id)
      : (id) => clearTimeout(id);

    const step = (timestamp) => {
      const now = typeof timestamp === 'number' ? timestamp : this._now();
      const elapsed = now - startTime;
      const progress = durationMs > 0 ? Math.min(1, elapsed / durationMs) : 1;
      if (fromAudio) {
        fromAudio.volume = startFromVolume * (1 - progress);
      }
      toAudio.volume = startToVolume + (resolvedTarget - startToVolume) * progress;
      if (progress < 1) {
        this.musicFadeHandle = schedule(step);
        this.musicFadeCanceler = cancel;
      } else {
        if (fromAudio) {
          fromAudio.volume = 0;
          fromAudio.pause();
          try {
            fromAudio.currentTime = 0;
          } catch (error) {
            fromAudio.src = fromAudio.src;
          }
        }
        toAudio.volume = resolvedTarget;
        this.musicFadeHandle = null;
        this.musicFadeCanceler = null;
        this.activeMusicFade = null;
      }
    };

    this.musicFadeHandle = schedule(step);
    this.musicFadeCanceler = cancel;
  }

  /**
   * Cancels any active music fade, optionally forcing final state application.
   */
  _cancelMusicFade(options = {}) {
    const finalize = Boolean(options.finalize);

    if (this.musicFadeHandle !== null && this.musicFadeCanceler) {
      this.musicFadeCanceler(this.musicFadeHandle);
    }
    this.musicFadeHandle = null;
    this.musicFadeCanceler = null;

    if (!this.activeMusicFade) {
      return;
    }

    const { fromEntry, toEntry, targetVolume } = this.activeMusicFade;

    if (fromEntry?.audio && (!toEntry || fromEntry.audio !== toEntry.audio)) {
      // Guarantee the previous track is fully silenced whenever a fade is interrupted.
      fromEntry.audio.volume = 0;
      fromEntry.audio.pause();
      try {
        fromEntry.audio.currentTime = 0;
      } catch (error) {
        fromEntry.audio.src = fromEntry.audio.src;
      }
    }

    if (finalize && toEntry?.audio) {
      // Snap the destination track to its intended volume when finishing immediately.
      toEntry.audio.volume = Number.isFinite(targetVolume)
        ? targetVolume
        : this._resolveMusicVolume(toEntry.definition);
    }

    this.activeMusicFade = null;
  }

  /**
   * Ensures a music entry exists for the supplied key.
   */
  _ensureMusicEntry(key) {
    if (!this.musicDefinitions || !this.musicDefinitions[key]) {
      return null;
    }

    if (!this.musicElements.has(key)) {
      const definition = this.musicDefinitions[key];
      const source = this._buildSource(definition, this.musicFolder);
      if (!source) {
        return null;
      }
      const audio = new Audio(source);
      audio.preload = definition.preload || 'auto';
      audio.loop = Boolean(definition.loop !== false);
      audio.volume = this._resolveMusicVolume(definition);
      // Track the entry key so suspended playback can resume the correct song.
      this.musicElements.set(key, { key, definition, audio });
    }

    const entry = this.musicElements.get(key);
    if (entry) {
      entry.key = key;
      entry.definition = this.musicDefinitions[key];
    }
    return entry;
  }

  /**
   * Ensures a sound effect entry exists for the supplied key.
   */
  _ensureSfxEntry(key) {
    if (!this.sfxDefinitions || !this.sfxDefinitions[key]) {
      return null;
    }

    if (!this.sfxPools.has(key)) {
      const definition = this.sfxDefinitions[key];
      const source = this._buildSource(definition, this.sfxFolder);
      if (!source) {
        return null;
      }

      const poolSize = Math.max(1, definition.maxConcurrent || 1);
      const pool = [];
      for (let index = 0; index < poolSize; index += 1) {
        const audio = new Audio(source);
        audio.preload = definition.preload || 'auto';
        audio.volume = this._resolveSfxVolume(definition);
        pool.push(audio);
      }

      const entry = { definition, pool, nextIndex: 0 };
      this.sfxPools.set(key, entry);
      return entry;
    }

    const entry = this.sfxPools.get(key);
    if (entry) {
      entry.definition = this.sfxDefinitions[key];
    }
    return entry;
  }

  /**
   * Builds a playable audio source URL using the manifest definition.
   */
  _buildSource(definition, folder) {
    if (!definition) {
      return null;
    }
    if (definition.src) {
      return definition.src;
    }
    if (definition.file) {
      const sanitizedFolder = folder.endsWith('/') ? folder.slice(0, -1) : folder;
      return `${sanitizedFolder}/${definition.file}`;
    }
    return null;
  }

  /**
   * Resolves the music volume while respecting the global volume multiplier.
   */
  _resolveMusicVolume(definition, overrideVolume) {
    const base = typeof overrideVolume === 'number'
      ? overrideVolume
      : typeof definition?.volume === 'number'
        ? definition.volume
        : 1;
    return this._clampVolume(base * this.musicVolume, 0);
  }

  /**
   * Resolves the sound effect volume while respecting the global volume multiplier.
   */
  _resolveSfxVolume(definition, overrideVolume) {
    const base = typeof overrideVolume === 'number'
      ? overrideVolume
      : typeof definition?.volume === 'number'
        ? definition.volume
        : 1;
    return this._clampVolume(base * this.sfxVolume, 0);
  }

  /**
   * Sets the master music volume and updates existing tracks.
   */
  setMusicVolume(volume) {
    this.musicVolume = this._clampVolume(volume, this.musicVolume);
    this.musicElements.forEach((entry) => {
      if (!entry || !entry.audio) {
        return;
      }
      entry.audio.volume = this._resolveMusicVolume(entry.definition);
    });
    if (this.activeMusicEntry?.audio) {
      this.activeMusicEntry.audio.volume = this._resolveMusicVolume(
        this.activeMusicEntry.definition,
      );
    }
    return this.musicVolume;
  }

  /**
   * Sets the master sound effect volume and updates pooled clips.
   */
  setSfxVolume(volume) {
    this.sfxVolume = this._clampVolume(volume, this.sfxVolume);
    this.sfxPools.forEach((entry) => {
      if (!entry || !entry.pool) {
        return;
      }
      entry.pool.forEach((audio) => {
        if (audio) {
          audio.volume = this._resolveSfxVolume(entry.definition);
        }
      });
    });
    return this.sfxVolume;
  }

  /**
   * Clamps a normalized volume value between 0 and 1.
   */
  _clampVolume(value, fallback = 1) {
    const resolved = typeof value === 'number' ? value : fallback;
    if (!Number.isFinite(resolved)) {
      return fallback;
    }
    return Math.min(1, Math.max(0, resolved));
  }

  /**
   * Utility wrapper to provide high-resolution timestamps when available.
   */
  _now() {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }
}

/**
 * Applies stored volume settings onto an audio manager instance.
 */
export function applyStoredAudioSettings(audioManager, settings) {
  if (!audioManager || !settings || typeof settings !== 'object') {
    return;
  }
  if (Number.isFinite(settings.musicVolume)) {
    audioManager.setMusicVolume(settings.musicVolume);
  }
  if (Number.isFinite(settings.sfxVolume)) {
    audioManager.setSfxVolume(settings.sfxVolume);
  }
}

/**
 * Binds the audio sliders to the supplied manager and wires display updates.
 */
export function bindAudioControls(audioManager, {
  musicSlider = typeof document !== 'undefined' ? document.getElementById('music-volume') : null,
  musicValue = typeof document !== 'undefined' ? document.getElementById('music-volume-value') : null,
  sfxSlider = typeof document !== 'undefined' ? document.getElementById('sfx-volume') : null,
  sfxValue = typeof document !== 'undefined' ? document.getElementById('sfx-volume-value') : null,
  onVolumeCommit = null,
  onVolumeInput = null,
} = {}) {
  const controlElements = {
    musicSlider,
    musicValue,
    sfxSlider,
    sfxValue,
  };

  /**
   * Formats the display label for a normalized volume level.
   */
  const formatVolumeDisplay = (volume) => {
    const normalized = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0;
    return `${Math.round(normalized * 100)}%`;
  };

  /**
   * Extracts a normalized volume value from the slider element.
   */
  const getSliderVolume = (slider) => {
    if (!slider) {
      return 0;
    }
    const raw = Number(slider.value);
    if (!Number.isFinite(raw)) {
      return 0;
    }
    return Math.min(1, Math.max(0, raw / 100));
  };

  /**
   * Updates the value label that mirrors the slider position.
   */
  const updateVolumeDisplay = (kind, volume) => {
    const text = formatVolumeDisplay(volume);
    if (kind === 'music' && controlElements.musicValue) {
      controlElements.musicValue.textContent = text;
    }
    if (kind === 'sfx' && controlElements.sfxValue) {
      controlElements.sfxValue.textContent = text;
    }
  };

  /**
   * Synchronizes slider positions to reflect the manager's stored volumes.
   */
  const syncFromManager = () => {
    if (!audioManager) {
      return;
    }
    if (controlElements.musicSlider) {
      controlElements.musicSlider.value = String(
        Math.round(Math.min(1, Math.max(0, audioManager.musicVolume)) * 100),
      );
    }
    if (controlElements.sfxSlider) {
      controlElements.sfxSlider.value = String(
        Math.round(Math.min(1, Math.max(0, audioManager.sfxVolume)) * 100),
      );
    }
    updateVolumeDisplay('music', audioManager.musicVolume);
    updateVolumeDisplay('sfx', audioManager.sfxVolume);
  };

  /**
   * Attaches slider event handlers to keep the manager in sync.
   */
  const attachSlider = (slider, kind, setter) => {
    if (!slider) {
      return;
    }
    const handleInput = () => {
      const volume = getSliderVolume(slider);
      setter(volume);
      updateVolumeDisplay(kind, volume);
      if (typeof onVolumeInput === 'function') {
        onVolumeInput(kind, volume);
      }
    };
    const handleChange = () => {
      const volume = getSliderVolume(slider);
      setter(volume);
      updateVolumeDisplay(kind, volume);
      if (typeof onVolumeCommit === 'function') {
        onVolumeCommit(kind, volume);
      }
    };
    slider.addEventListener('input', handleInput);
    slider.addEventListener('change', handleChange);
  };

  attachSlider(controlElements.musicSlider, 'music', (volume) => {
    if (audioManager) {
      audioManager.setMusicVolume(volume);
    }
  });

  attachSlider(controlElements.sfxSlider, 'sfx', (volume) => {
    if (audioManager) {
      audioManager.setSfxVolume(volume);
    }
  });

  syncFromManager();

  if (audioManager) {
    const activationElements = [controlElements.musicSlider, controlElements.sfxSlider].filter(Boolean);
    audioManager.registerActivationElements(activationElements);
  }

  return {
    elements: controlElements,
    syncFromManager,
    updateVolumeDisplay,
  };
}

/**
 * Plays a cascading series of tower placement notes for placement feedback.
 */
export function playTowerPlacementNotes(audio, count = 1, noteKeys = TOWER_NOTE_SFX_KEYS) {
  if (!audio || !Number.isFinite(count) || count <= 0) {
    return;
  }
  const keys = Array.isArray(noteKeys) ? noteKeys : [];
  if (!keys.length) {
    return;
  }
  const hasScheduler = typeof setTimeout === 'function';
  for (let index = 0; index < count; index += 1) {
    const noteKey = keys[Math.floor(Math.random() * keys.length)];
    if (!noteKey) {
      continue;
    }
    const play = () => audio.playSfx(noteKey);
    if (index > 0 && hasScheduler) {
      setTimeout(play, index * 120);
    } else {
      play();
    }
  }
}
