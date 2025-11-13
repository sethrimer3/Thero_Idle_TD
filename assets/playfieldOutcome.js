/**
 * Module responsible for managing the playfield victory/defeat overlay state.
 * Handles element wiring, focus management, and action callbacks.
 */
const playfieldOutcomeElements = {
  overlay: null,
  title: null,
  subtitle: null,
  primary: null,
  secondary: null,
};

const playfieldOutcomeState = {
  onPrimary: null,
  onSecondary: null,
  bound: false,
};

const defaultRequestAnimationFrame = (callback) => {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }
  return setTimeout(callback, 0);
};

const dependencies = {
  getPlayfield: () => null,
  leaveActiveLevel: () => {},
  updateLayoutVisibility: () => {},
  getStartButton: () => null,
  requestAnimationFrame: defaultRequestAnimationFrame,
};

/**
 * Configure external dependencies required to drive the outcome overlay.
 * @param {Object} options - Dependency overrides used by the overlay logic.
 * @param {Function} [options.getPlayfield] - Returns the current playfield instance.
 * @param {Function} [options.leaveActiveLevel] - Callback used to exit the current level.
 * @param {Function} [options.updateLayoutVisibility] - Refreshes layout visibility after exiting.
 * @param {Function} [options.getStartButton] - Supplies the primary start button for focus restoration.
 * @param {Function} [options.requestAnimationFrame] - Animation frame scheduling helper.
 */
export function configurePlayfieldOutcome(options = {}) {
  if (typeof options.getPlayfield === 'function') {
    dependencies.getPlayfield = options.getPlayfield;
  }
  if (typeof options.leaveActiveLevel === 'function') {
    dependencies.leaveActiveLevel = options.leaveActiveLevel;
  }
  if (typeof options.updateLayoutVisibility === 'function') {
    dependencies.updateLayoutVisibility = options.updateLayoutVisibility;
  }
  if (typeof options.getStartButton === 'function') {
    dependencies.getStartButton = options.getStartButton;
  }
  if (typeof options.requestAnimationFrame === 'function') {
    dependencies.requestAnimationFrame = options.requestAnimationFrame;
  }
}

/**
 * Register DOM elements that compose the playfield outcome overlay.
 * @param {Object} elements - Collection of overlay nodes retrieved from the document.
 */
export function setPlayfieldOutcomeElements(elements = {}) {
  playfieldOutcomeElements.overlay = elements.overlay || null;
  playfieldOutcomeElements.title = elements.title || null;
  playfieldOutcomeElements.subtitle = elements.subtitle || null;
  playfieldOutcomeElements.primary = elements.primary || null;
  playfieldOutcomeElements.secondary = elements.secondary || null;
}

function triggerPlayfieldOutcomePrimary() {
  if (typeof playfieldOutcomeState.onPrimary === 'function') {
    playfieldOutcomeState.onPrimary();
  }
}

function triggerPlayfieldOutcomeSecondary() {
  if (typeof playfieldOutcomeState.onSecondary === 'function') {
    playfieldOutcomeState.onSecondary();
  }
}

/**
 * Hide the overlay and optionally restore focus to the start button.
 * @param {Object} [options] - Optional configuration.
 * @param {boolean} [options.restoreFocus=false] - Whether to return focus to the start button.
 */
export function hidePlayfieldOutcome({ restoreFocus = false } = {}) {
  const { overlay } = playfieldOutcomeElements;
  if (!overlay) {
    return;
  }

  overlay.classList.remove('active', 'playfield-outcome--victory', 'playfield-outcome--defeat');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('hidden', '');
  playfieldOutcomeState.onPrimary = null;
  playfieldOutcomeState.onSecondary = null;

  const { primary, secondary } = playfieldOutcomeElements;
  if (primary) {
    primary.disabled = false;
  }
  if (secondary) {
    secondary.disabled = false;
    secondary.setAttribute('hidden', '');
  }

  if (!restoreFocus) {
    return;
  }

  const startButton = dependencies.getStartButton();
  if (startButton && typeof startButton.focus === 'function') {
    try {
      startButton.focus({ preventScroll: true });
    } catch (error) {
      startButton.focus();
    }
  }
}

/**
 * Display the overlay with the supplied labels and callbacks.
 * @param {Object} options - Outcome configuration values.
 */
export function showPlayfieldOutcome({
  outcome = 'defeat',
  title = '',
  subtitle = '',
  primaryLabel = 'Back to Level Selection',
  onPrimary = null,
  secondaryLabel = null,
  onSecondary = null,
} = {}) {
  const { overlay, title: titleEl, subtitle: subtitleEl, primary, secondary } = playfieldOutcomeElements;
  if (!overlay || !titleEl || !primary) {
    return;
  }

  hidePlayfieldOutcome();

  overlay.classList.remove('playfield-outcome--victory', 'playfield-outcome--defeat');
  if (outcome === 'victory') {
    overlay.classList.add('playfield-outcome--victory');
  } else {
    overlay.classList.add('playfield-outcome--defeat');
  }

  titleEl.textContent = title;
  if (subtitleEl) {
    subtitleEl.textContent = subtitle || '';
    subtitleEl.toggleAttribute('hidden', !subtitle);
  }

  primary.textContent = primaryLabel;
  playfieldOutcomeState.onPrimary = typeof onPrimary === 'function' ? onPrimary : null;

  if (secondary) {
    if (secondaryLabel) {
      secondary.textContent = secondaryLabel;
      secondary.removeAttribute('hidden');
      playfieldOutcomeState.onSecondary = typeof onSecondary === 'function' ? onSecondary : null;
    } else {
      secondary.setAttribute('hidden', '');
      playfieldOutcomeState.onSecondary = null;
    }
  }

  overlay.removeAttribute('hidden');
  overlay.setAttribute('aria-hidden', 'false');

  dependencies.requestAnimationFrame(() => {
    overlay.classList.add('active');
  });

  if (typeof overlay.focus === 'function') {
    try {
      overlay.focus({ preventScroll: true });
    } catch (error) {
      overlay.focus();
    }
  }
}

/**
 * Attach overlay event listeners exactly once during initialization.
 */
export function bindPlayfieldOutcomeEvents() {
  if (playfieldOutcomeState.bound) {
    return;
  }
  const { overlay, primary, secondary } = playfieldOutcomeElements;
  if (!overlay || !primary) {
    return;
  }

  primary.addEventListener('click', () => triggerPlayfieldOutcomePrimary());
  if (secondary) {
    secondary.addEventListener('click', () => triggerPlayfieldOutcomeSecondary());
  }
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      triggerPlayfieldOutcomePrimary();
    }
  });
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      triggerPlayfieldOutcomePrimary();
    }
  });

  playfieldOutcomeState.bound = true;
}

/**
 * Exit the current level after dismissing the overlay and refresh layout visibility.
 */
export function exitToLevelSelectionFromOutcome() {
  hidePlayfieldOutcome();
  dependencies.leaveActiveLevel();
  dependencies.updateLayoutVisibility();
}

/**
 * Retry the endless checkpoint when available, disabling the button if retry fails.
 */
export function handleOutcomeRetryRequest() {
  const playfield = dependencies.getPlayfield();
  if (!playfield || typeof playfield.retryFromEndlessCheckpoint !== 'function') {
    return;
  }

  const success = playfield.retryFromEndlessCheckpoint();
  if (success) {
    hidePlayfieldOutcome();
    return;
  }

  const { secondary } = playfieldOutcomeElements;
  if (secondary) {
    secondary.disabled = true;
  }
}
