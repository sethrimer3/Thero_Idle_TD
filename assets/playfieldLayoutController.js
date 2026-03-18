'use strict';

import { setElementVisibility } from './uiHelpers.js';

/**
 * Factory that manages playfield fullscreen toggling, layout visibility
 * switching between the level grid and battlefield, and the visual-settings
 * panel sync.  Extracted from main.js to reduce its line count and isolate
 * layout concerns from core game orchestration.
 *
 * @param {object} deps
 * @param {Function} deps.getPlayfield                - Getter; returns playfield instance.
 * @param {Function} deps.getActiveLevelId            - Getter; returns active level id.
 * @param {Function} deps.getActiveLevelIsInteractive - Getter; returns boolean.
 * @param {Function} deps.getPlayfieldMenuController  - Getter; returns menu controller.
 */
export function createPlayfieldLayoutController(deps) {
  const {
    getPlayfield,
    getActiveLevelId,
    getActiveLevelIsInteractive,
    getPlayfieldMenuController,
  } = deps;

  // ── Mutable state (set via bindElements) ──────────────────────────────
  let playfieldWrapper = null;
  let stageControls = null;
  let levelSelectionSection = null;
  let playfieldFullscreenActive = false;
  let playfieldFullscreenButton = null;

  // ── Fullscreen helpers ────────────────────────────────────────────────

  /**
   * Resolve the active fullscreen element across browser implementations.
   * @returns {Element|null} The fullscreen element, if any.
   */
  function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  /**
   * Update the fullscreen toggle button text and accessibility labels.
   * @param {boolean} isFullscreen - Whether fullscreen mode is active.
   */
  function updatePlayfieldFullscreenButton(isFullscreen) {
    if (!playfieldFullscreenButton) {
      return;
    }
    const label = isFullscreen ? 'Exit full screen' : 'Enter full screen';
    playfieldFullscreenButton.textContent = isFullscreen ? '⤡' : '⤢';
    playfieldFullscreenButton.setAttribute('aria-label', label);
    playfieldFullscreenButton.setAttribute('title', label);
  }

  /**
   * Apply or clear the fullscreen layout styles for the playfield.
   * @param {boolean} isFullscreen - Whether fullscreen mode should be active.
   */
  function applyPlayfieldFullscreenStyles(isFullscreen) {
    document.body.classList.toggle('playfield-fullscreen', isFullscreen);
    updatePlayfieldFullscreenButton(isFullscreen);
    const playfield = getPlayfield();
    if (playfield && typeof playfield.determinePreferredOrientation === 'function') {
      // Recalculate orientation after viewport changes to keep path geometry aligned.
      playfield.layoutOrientation = playfield.determinePreferredOrientation();
      playfield.applyLevelOrientation();
      playfield.applyContainerOrientationClass();
      playfield.syncCanvasSize();
    }
  }

  /**
   * Request browser fullscreen for the playfield wrapper when supported.
   * @returns {boolean} True if a fullscreen request was initiated.
   */
  function requestPlayfieldFullscreen() {
    if (!playfieldWrapper) {
      return false;
    }
    const request = playfieldWrapper.requestFullscreen || playfieldWrapper.webkitRequestFullscreen;
    if (typeof request === 'function') {
      request.call(playfieldWrapper);
      return true;
    }
    return false;
  }

  /**
   * Exit browser fullscreen when supported.
   * @returns {boolean} True if an exit request was initiated.
   */
  function exitPlayfieldFullscreen() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (typeof exit === 'function') {
      exit.call(document);
      return true;
    }
    return false;
  }

  /**
   * Sync internal fullscreen state with the browser fullscreen API.
   */
  function syncPlayfieldFullscreenState() {
    const isBrowserFullscreen = Boolean(getFullscreenElement());
    if (playfieldFullscreenActive !== isBrowserFullscreen) {
      playfieldFullscreenActive = isBrowserFullscreen;
      applyPlayfieldFullscreenStyles(playfieldFullscreenActive);
    }
  }

  /**
   * Toggle playfield fullscreen and fall back to CSS-only if the API is unavailable.
   */
  function togglePlayfieldFullscreen() {
    const shouldEnter = !playfieldFullscreenActive;
    playfieldFullscreenActive = shouldEnter;
    applyPlayfieldFullscreenStyles(shouldEnter);
    if (shouldEnter) {
      requestPlayfieldFullscreen();
    } else {
      exitPlayfieldFullscreen();
    }
  }

  // ── Settings panel sync ───────────────────────────────────────────────

  /** Keep the playfield visual settings toggle in sync with whether an interactive defense is running. */
  function syncPlayfieldSettingsVisibility() {
    const playfieldSettingsWrapper = document.getElementById('playfield-settings-wrapper');
    if (!playfieldSettingsWrapper) {
      return;
    }

    const shouldShowSettings = Boolean(getActiveLevelId() && getActiveLevelIsInteractive());
    playfieldSettingsWrapper.hidden = !shouldShowSettings;
    playfieldSettingsWrapper.setAttribute('aria-hidden', shouldShowSettings ? 'false' : 'true');
  }

  // ── Layout visibility ─────────────────────────────────────────────────

  function updateLayoutVisibility() {
    // Hide the battlefield until an interactive level is in progress.
    const shouldShowPlayfield = Boolean(getActiveLevelId() && getActiveLevelIsInteractive());
    setElementVisibility(playfieldWrapper, shouldShowPlayfield);
    setElementVisibility(stageControls, shouldShowPlayfield);
    setElementVisibility(levelSelectionSection, !shouldShowPlayfield);

    // Keep the playfield settings panel aligned with the current layout state.
    syncPlayfieldSettingsVisibility();

    const playfieldMenuController = getPlayfieldMenuController();

    if (!shouldShowPlayfield) {
      // Exit fullscreen when leaving the battlefield layout to avoid trapping the UI.
      if (playfieldFullscreenActive) {
        playfieldFullscreenActive = false;
        applyPlayfieldFullscreenStyles(false);
        exitPlayfieldFullscreen();
      }
      if (playfieldMenuController) {
        playfieldMenuController.closeMenu();
        playfieldMenuController.resetStatsPanelState();
      }
      return;
    }

    const playfield = getPlayfield();
    if (playfield && typeof playfield.syncCanvasSize === 'function') {
      // Refresh the canvas geometry once the battlefield becomes visible again.
      playfield.syncCanvasSize();
    }

    if (playfieldMenuController) {
      playfieldMenuController.syncStatsPanelVisibility();
    }
  }

  // ── DOM binding ───────────────────────────────────────────────────────

  /**
   * Cache DOM references and wire event listeners for layout controls.
   * Call once the DOM is available (e.g. inside DOMContentLoaded or init).
   */
  function bindElements() {
    playfieldWrapper = document.getElementById('playfield-wrapper');
    stageControls = document.getElementById('stage-controls');
    levelSelectionSection = document.getElementById('level-selection');
    playfieldFullscreenButton = document.getElementById('playfield-fullscreen-button');
    if (playfieldFullscreenButton) {
      playfieldFullscreenButton.addEventListener('click', () => {
        togglePlayfieldFullscreen();
      });
      updatePlayfieldFullscreenButton(playfieldFullscreenActive);
    }
    // Keep the fullscreen state synced with browser-level changes (ESC, gesture exit).
    document.addEventListener('fullscreenchange', syncPlayfieldFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncPlayfieldFullscreenState);
  }

  return {
    togglePlayfieldFullscreen,
    syncPlayfieldFullscreenState,
    updatePlayfieldFullscreenButton,
    updateLayoutVisibility,
    syncPlayfieldSettingsVisibility,
    bindElements,
  };
}
