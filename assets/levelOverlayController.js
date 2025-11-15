'use strict';

/**
 * Factory that centralizes the DOM bindings and UI updates for the level-entry overlay.
 * The controller exposes helpers to show/hide the overlay, wire confirmation callbacks,
 * and keep the preview metrics synchronized with the currently highlighted level card.
 */
export function createLevelOverlayController({
  document: documentRef = typeof document !== 'undefined' ? document : null,
  overlayInstructionDefault = 'Tap or click to enter',
  describeLevelLastResult,
  getLevelSummary,
  getLevelState = () => null,
  getIdleLevelRunner = () => null,
  getLevelById = () => null,
  getActiveLevelId = () => null,
  revealOverlay,
  scheduleOverlayHide,
} = {}) {
  let overlayEl = null;
  let overlayLabelEl = null;
  let overlayTitleEl = null;
  let overlayExampleEl = null;
  let overlayPreviewEl = null;
  let overlayModeEl = null;
  let overlayDurationEl = null;
  let overlayRewardsEl = null;
  let overlayStartTheroEl = null;
  let overlayLastResultEl = null;
  let overlayInstructionEl = null;
  let overlayConfirmButton = null;
  let overlayRequiresLevelExit = false;
  let previewRenderer = null;
  let confirmHandler = null;

  /**
   * Executes the currently configured confirmation handler when the overlay is activated.
   */
  function handleConfirmRequest() {
    if (typeof confirmHandler === 'function') {
      confirmHandler();
    }
  }

  /**
   * Queries the DOM for overlay elements and wires up the shared click interactions.
   */
  function bindOverlayElements() {
    if (!documentRef) {
      return;
    }

    overlayEl = documentRef.getElementById('level-overlay');
    if (overlayEl && !overlayEl.hasAttribute('tabindex')) {
      overlayEl.setAttribute('tabindex', '-1');
    }
    overlayLabelEl = documentRef.getElementById('overlay-level');
    overlayTitleEl = documentRef.getElementById('overlay-title');
    overlayExampleEl = documentRef.getElementById('overlay-example');
    overlayPreviewEl = documentRef.getElementById('overlay-preview');
    overlayModeEl = documentRef.getElementById('overlay-mode');
    overlayDurationEl = documentRef.getElementById('overlay-duration');
    overlayRewardsEl = documentRef.getElementById('overlay-rewards');
    overlayStartTheroEl = documentRef.getElementById('overlay-start-thero');
    overlayLastResultEl = documentRef.getElementById('overlay-last');
    overlayInstructionEl = overlayEl ? overlayEl.querySelector('.overlay-instruction') : null;
    if (overlayInstructionEl) {
      overlayInstructionEl.textContent = overlayInstructionDefault;
    }
    overlayConfirmButton = overlayEl ? overlayEl.querySelector('.overlay-confirm') : null;
    if (overlayConfirmButton) {
      overlayConfirmButton.addEventListener('click', (event) => {
        event.stopPropagation();
        handleConfirmRequest();
      });
    }
    if (overlayEl) {
      overlayEl.addEventListener('click', () => {
        handleConfirmRequest();
      });
    }
  }

  /**
   * Persists the callback executed when the overlay is confirmed via click or keyboard.
   * @param {Function} handler
   */
  function setConfirmHandler(handler) {
    confirmHandler = typeof handler === 'function' ? handler : null;
  }

  /**
   * Injects the preview renderer so the overlay can paint or clear the SVG preview as it opens/closes.
   * @param {{ render: Function, clear: Function }} renderer
   */
  function setPreviewRenderer(renderer) {
    previewRenderer = renderer || null;
  }

  /**
   * Returns the overlay wrapper element so other systems can align panels relative to it.
   */
  function getOverlayElement() {
    return overlayEl;
  }

  /**
   * Returns the overlay preview container for callers that need to mount custom DOM into it.
   */
  function getOverlayPreviewElement() {
    return overlayPreviewEl;
  }

  /**
   * Reports whether the overlay is currently visible to assist tab/overlay managers.
   */
  function isOverlayActive() {
    return Boolean(overlayEl && overlayEl.classList.contains('active'));
  }

  /**
   * Populates and reveals the overlay for the provided level descriptor.
   * @param {Object} level
   * @param {{ requireExitConfirm?: boolean, exitLevelId?: string }} options
   */
  function showLevelOverlay(level, options = {}) {
    if (!overlayEl || !overlayLabelEl || !overlayTitleEl || !overlayExampleEl || !level) {
      return;
    }

    const { requireExitConfirm = false, exitLevelId = null } = options;
    overlayRequiresLevelExit = Boolean(requireExitConfirm);
    overlayLabelEl.textContent = level.id || '';
    overlayTitleEl.textContent = level.title || '';
    overlayExampleEl.textContent = level.example || '';

    if (previewRenderer && typeof previewRenderer.render === 'function') {
      previewRenderer.render(level);
    }

    const summary = typeof getLevelSummary === 'function' ? getLevelSummary(level) : {};
    if (overlayModeEl) {
      overlayModeEl.textContent = summary.mode || '—';
    }
    if (overlayDurationEl) {
      overlayDurationEl.textContent = summary.duration || '—';
    }
    if (overlayRewardsEl) {
      overlayRewardsEl.textContent = summary.rewards || '—';
    }
    if (overlayStartTheroEl) {
      const startLabel = summary.start || '—';
      overlayStartTheroEl.textContent = startLabel;
      overlayStartTheroEl.setAttribute(
        'aria-label',
        summary.startAria
          || (startLabel === '—' ? 'Starting Thero not applicable.' : `Starting Thero ${startLabel}`),
      );
    }
    if (overlayLastResultEl && typeof describeLevelLastResult === 'function') {
      const state = getLevelState ? getLevelState(level.id) : null;
      const runner = getIdleLevelRunner ? getIdleLevelRunner(level.id) : null;
      overlayLastResultEl.textContent = describeLevelLastResult(level, state, runner);
    }
    if (overlayInstructionEl) {
      if (overlayRequiresLevelExit) {
        const fallbackActiveId = typeof getActiveLevelId === 'function' ? getActiveLevelId() : null;
        const exitLevel =
          (exitLevelId && typeof getLevelById === 'function' && getLevelById(exitLevelId))
          || (fallbackActiveId && typeof getLevelById === 'function' && getLevelById(fallbackActiveId))
          || null;
        const exitLabel = exitLevel ? `${exitLevel.id} · ${exitLevel.title}` : 'the active level';
        overlayInstructionEl.textContent = `Entering will abandon ${exitLabel}. Tap or click to confirm.`;
      } else {
        overlayInstructionEl.textContent = overlayInstructionDefault;
      }
    }
    if (overlayConfirmButton) {
      const baseLabel = `${level.id} · ${level.title}`.trim();
      if (overlayRequiresLevelExit) {
        overlayConfirmButton.textContent = 'Confirm & Enter';
        overlayConfirmButton.setAttribute('aria-label', `Abandon active defense and enter ${baseLabel}`);
      } else {
        overlayConfirmButton.textContent = 'Enter Level';
        overlayConfirmButton.setAttribute('aria-label', `Enter ${baseLabel}`);
      }
    }
    if (overlayEl) {
      if (overlayRequiresLevelExit) {
        overlayEl.setAttribute('data-overlay-mode', 'warning');
      } else {
        overlayEl.removeAttribute('data-overlay-mode');
      }
      overlayEl.setAttribute('aria-hidden', 'false');
      overlayEl.focus();
      if (typeof revealOverlay === 'function') {
        revealOverlay(overlayEl);
      }
      requestAnimationFrame(() => {
        overlayEl.classList.add('active');
      });
    }
  }

  /**
   * Hides the overlay and clears transient state, including the preview canvas contents.
   */
  function hideLevelOverlay() {
    if (!overlayEl) {
      return;
    }
    if (previewRenderer && typeof previewRenderer.clear === 'function') {
      previewRenderer.clear();
    }
    overlayEl.classList.remove('active');
    overlayEl.setAttribute('aria-hidden', 'true');
    if (typeof scheduleOverlayHide === 'function') {
      scheduleOverlayHide(overlayEl);
    }
    overlayRequiresLevelExit = false;
    if (overlayInstructionEl) {
      overlayInstructionEl.textContent = overlayInstructionDefault;
    }
    overlayEl.removeAttribute('data-overlay-mode');
  }

  return {
    bindOverlayElements,
    setConfirmHandler,
    setPreviewRenderer,
    getOverlayElement,
    getOverlayPreviewElement,
    isOverlayActive,
    showLevelOverlay,
    hideLevelOverlay,
  };
}
