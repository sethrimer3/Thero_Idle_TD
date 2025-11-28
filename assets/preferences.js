import {
  getGameNumberNotation,
  setGameNumberNotation,
  addGameNumberNotationChangeListener,
  GAME_NUMBER_NOTATIONS,
  formatGameNumber,
} from '../scripts/core/formatting.js';
import {
  writeStorage,
  readStorage,
  NOTATION_STORAGE_KEY,
  GLYPH_EQUATIONS_STORAGE_KEY,
  DAMAGE_NUMBER_TOGGLE_STORAGE_KEY,
  WAVE_KILL_TALLY_STORAGE_KEY,
  WAVE_DAMAGE_TALLY_STORAGE_KEY,
  GRAPHICS_MODE_STORAGE_KEY,
  TRACK_RENDER_MODE_STORAGE_KEY,
  TRACK_TRACER_TOGGLE_STORAGE_KEY,
  TOWER_LOADOUT_SLOTS_STORAGE_KEY,
  FRAME_RATE_LIMIT_STORAGE_KEY,
  FPS_COUNTER_TOGGLE_STORAGE_KEY,
} from './autoSave.js';

const GRAPHICS_MODES = Object.freeze({
  LOW: 'low',
  HIGH: 'high',
});

export const TRACK_RENDER_MODES = Object.freeze({
  GRADIENT: 'gradient',
  BLUR: 'blur',
  RIVER: 'river',
});

let notationToggleButton = null;
let notationRefreshHandler = () => {};
let notationPreviewValue = null;

let glyphEquationsVisible = false;
let glyphEquationToggleInput = null;
let glyphEquationToggleStateLabel = null;

let damageNumbersEnabled = true;
let damageNumberToggleInput = null;
let damageNumberToggleStateLabel = null;

// Toggle state for the wave kill tally overlay.
let waveKillTalliesEnabled = true;
let waveKillTallyToggleInput = null;
let waveKillTallyToggleStateLabel = null;

// Toggle state for the wave damage tally overlay.
let waveDamageTalliesEnabled = true;
let waveDamageTallyToggleInput = null;
let waveDamageTallyToggleStateLabel = null;

// Toggle state for the luminous track tracer overlay.
let trackTracerEnabled = true;
let trackTracerToggleInput = null;
let trackTracerToggleStateLabel = null;

// Preferred tower loadout slot count; players can cycle between 1–4 slots in Options.
let preferredLoadoutSlots = 2;
let loadoutSlotButton = null;
let loadoutSlotChangeHandler = () => {};

// Frame rate limit preference; defaults to 60 fps, range 30–120.
let frameRateLimit = 60;
let frameRateLimitSlider = null;
let frameRateLimitValueLabel = null;
let frameRateLimitChangeHandler = () => {};

// Toggle state for the FPS counter overlay.
let fpsCounterEnabled = false;
let fpsCounterToggleInput = null;
let fpsCounterToggleStateLabel = null;
// FPS counter element displayed in the top-left corner.
let fpsCounterElement = null;
let fpsCounterLastUpdate = 0;
let fpsCounterFrameCount = 0;

let graphicsModeButton = null;
let trackRenderModeButton = null;
// Cache the preview line and tracer so track mode changes can mirror the canvas style.
let trackRenderPreviewLine = null;
let trackRenderPreviewTracer = null;
let desktopCursorMediaQuery = null;
let desktopCursorActive = false;
let activeGraphicsMode = GRAPHICS_MODES.HIGH;
let activeTrackRenderMode = TRACK_RENDER_MODES.GRADIENT;

let powderSimulationGetter = () => null;
let playfieldGetter = () => null;

// Cycle through every available notation in the menu so players can preview formats quickly.
const NOTATION_SEQUENCE = [
  GAME_NUMBER_NOTATIONS.LETTERS,
  GAME_NUMBER_NOTATIONS.SCIENTIFIC,
  GAME_NUMBER_NOTATIONS.ABC,
];

// Present a fixed quadrillion-scale value to mirror how damage numbers fly out of enemies.
const NOTATION_PREVIEW_DAMAGE = 5.1e15;

export function setNotationRefreshHandler(handler) {
  notationRefreshHandler = typeof handler === 'function' ? handler : () => {};
}

function resolveNotationLabel(notation) {
  switch (notation) {
    case GAME_NUMBER_NOTATIONS.SCIENTIFIC:
      return 'Scientific';
    case GAME_NUMBER_NOTATIONS.ABC:
      return 'ABC';
    default:
      return 'Letters';
  }
}

/**
 * Rotate through the supported notation sequence when the toggle is pressed.
 */
function getNextNotation(current) {
  const index = NOTATION_SEQUENCE.indexOf(current);
  const nextIndex = index >= 0 ? (index + 1) % NOTATION_SEQUENCE.length : 0;
  return NOTATION_SEQUENCE[nextIndex];
}

function updateNotationToggleLabel() {
  if (!notationToggleButton) {
    return;
  }
  const notation = getGameNumberNotation();
  const label = resolveNotationLabel(notation);
  // Use a centered dot to separate the label from the current notation, matching the UI spec.
  notationToggleButton.textContent = `Notation · ${label}`;
  notationToggleButton.setAttribute('aria-label', `Switch number notation (current: ${label})`);
}

/**
 * Refresh the quadrillion-scale damage preview to mirror the active notation choice.
 */
function updateNotationPreviewDamage() {
  if (!notationPreviewValue) {
    notationPreviewValue = document.getElementById('notation-preview-value');
  }
  if (!notationPreviewValue) {
    return;
  }
  const formattedDamage = formatGameNumber(NOTATION_PREVIEW_DAMAGE);
  notationPreviewValue.textContent = `${formattedDamage} dmg`;
}

function handleNotationChange() {
  updateNotationToggleLabel();
  updateNotationPreviewDamage();
  notationRefreshHandler();
}

addGameNumberNotationChangeListener(handleNotationChange);

export function applyNotationPreference(notation, { persist = true } = {}) {
  const resolved = setGameNumberNotation(notation);
  if (persist) {
    writeStorage(NOTATION_STORAGE_KEY, resolved);
  }
  return resolved;
}

export function toggleNotationPreference() {
  const current = getGameNumberNotation();
  const next = getNextNotation(current);
  applyNotationPreference(next);
}

export function bindNotationToggle() {
  notationToggleButton = document.getElementById('notation-toggle-button');
  notationPreviewValue = document.getElementById('notation-preview-value');
  if (!notationToggleButton) {
    return;
  }
  notationToggleButton.addEventListener('click', () => {
    toggleNotationPreference();
  });
  updateNotationToggleLabel();
  updateNotationPreviewDamage();
}

function normalizeGlyphEquationPreference(value) {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
      return true;
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
      return false;
    }
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0;
  }
  return Boolean(value);
}

function normalizeDamageNumberPreference(value) {
  return normalizeGlyphEquationPreference(value);
}

/**
 * Clamp the preferred loadout slot count between the supported 1–4 range.
 */
function normalizeLoadoutSlotPreference(value) {
  if (!Number.isFinite(value)) {
    return 2;
  }
  return Math.min(4, Math.max(1, Math.floor(value)));
}

function updateGlyphEquationToggleUi() {
  if (glyphEquationToggleInput) {
    glyphEquationToggleInput.checked = glyphEquationsVisible;
    glyphEquationToggleInput.setAttribute('aria-checked', glyphEquationsVisible ? 'true' : 'false');
    const controlShell = glyphEquationToggleInput.closest('.settings-toggle-control');
    if (controlShell) {
      controlShell.classList.toggle('is-active', glyphEquationsVisible);
    }
  }
  if (glyphEquationToggleStateLabel) {
    glyphEquationToggleStateLabel.textContent = glyphEquationsVisible ? 'On' : 'Off';
  }
}

function updateDamageNumberToggleUi() {
  if (damageNumberToggleInput) {
    damageNumberToggleInput.checked = damageNumbersEnabled;
    damageNumberToggleInput.setAttribute('aria-checked', damageNumbersEnabled ? 'true' : 'false');
    const controlShell = damageNumberToggleInput.closest('.settings-toggle-control');
    if (controlShell) {
      controlShell.classList.toggle('is-active', damageNumbersEnabled);
    }
  }
  if (damageNumberToggleStateLabel) {
    damageNumberToggleStateLabel.textContent = damageNumbersEnabled ? 'On' : 'Off';
  }
}

// Synchronize the wave kill tally toggle control with the in-memory state.
function updateWaveKillTallyToggleUi() {
  if (waveKillTallyToggleInput) {
    waveKillTallyToggleInput.checked = waveKillTalliesEnabled;
    waveKillTallyToggleInput.setAttribute('aria-checked', waveKillTalliesEnabled ? 'true' : 'false');
    const controlShell = waveKillTallyToggleInput.closest('.settings-toggle-control');
    if (controlShell) {
      controlShell.classList.toggle('is-active', waveKillTalliesEnabled);
    }
  }
  if (waveKillTallyToggleStateLabel) {
    waveKillTallyToggleStateLabel.textContent = waveKillTalliesEnabled ? 'On' : 'Off';
  }
}

// Synchronize the wave damage tally toggle control with the in-memory state.
function updateWaveDamageTallyToggleUi() {
  if (waveDamageTallyToggleInput) {
    waveDamageTallyToggleInput.checked = waveDamageTalliesEnabled;
    waveDamageTallyToggleInput.setAttribute('aria-checked', waveDamageTalliesEnabled ? 'true' : 'false');
    const controlShell = waveDamageTallyToggleInput.closest('.settings-toggle-control');
    if (controlShell) {
      controlShell.classList.toggle('is-active', waveDamageTalliesEnabled);
    }
  }
  if (waveDamageTallyToggleStateLabel) {
    waveDamageTallyToggleStateLabel.textContent = waveDamageTalliesEnabled ? 'On' : 'Off';
  }
}

// Synchronize the track tracer toggle so the label reflects the active preference.
function updateTrackTracerToggleUi() {
  if (trackTracerToggleInput) {
    trackTracerToggleInput.checked = trackTracerEnabled;
    trackTracerToggleInput.setAttribute('aria-checked', trackTracerEnabled ? 'true' : 'false');
    const controlShell = trackTracerToggleInput.closest('.settings-toggle-control');
    if (controlShell) {
      controlShell.classList.toggle('is-active', trackTracerEnabled);
    }
  }
  if (trackTracerToggleStateLabel) {
    trackTracerToggleStateLabel.textContent = trackTracerEnabled ? 'On' : 'Off';
  }
}

// Mirror the active track mode and tracer toggle in the preview line beneath the control.
function updateTrackRenderPreview() {
  if (!trackRenderPreviewLine) {
    trackRenderPreviewLine = document.getElementById('track-render-preview-line');
  }
  if (!trackRenderPreviewTracer) {
    trackRenderPreviewTracer = document.getElementById('track-render-preview-tracer');
  }
  if (!trackRenderPreviewLine) {
    return;
  }
  trackRenderPreviewLine.dataset.mode = activeTrackRenderMode;
  trackRenderPreviewLine.classList.toggle('is-tracer-enabled', trackTracerEnabled);
  if (trackRenderPreviewTracer) {
    trackRenderPreviewTracer.setAttribute('aria-hidden', trackTracerEnabled ? 'false' : 'true');
  }
}

export function applyGlyphEquationPreference(preference, { persist = true } = {}) {
  const enabled = normalizeGlyphEquationPreference(preference);
  glyphEquationsVisible = enabled;
  const body = typeof document !== 'undefined' ? document.body : null;
  if (body) {
    body.classList.toggle('show-glyph-equations', glyphEquationsVisible);
  }
  updateGlyphEquationToggleUi();
  if (persist) {
    writeStorage(GLYPH_EQUATIONS_STORAGE_KEY, glyphEquationsVisible ? '1' : '0');
  }
  return glyphEquationsVisible;
}

export function bindGlyphEquationToggle() {
  glyphEquationToggleInput = document.getElementById('glyph-equation-toggle');
  glyphEquationToggleStateLabel = document.getElementById('glyph-equation-toggle-state');
  if (!glyphEquationToggleInput) {
    return;
  }
  glyphEquationToggleInput.addEventListener('change', (event) => {
    applyGlyphEquationPreference(event?.target?.checked);
  });
  updateGlyphEquationToggleUi();
}

export function bindDamageNumberToggle() {
  damageNumberToggleInput = document.getElementById('damage-number-toggle');
  damageNumberToggleStateLabel = document.getElementById('damage-number-toggle-state');
  if (!damageNumberToggleInput) {
    return;
  }
  damageNumberToggleInput.addEventListener('change', (event) => {
    applyDamageNumberPreference(event?.target?.checked);
  });
  updateDamageNumberToggleUi();
}

export function applyDamageNumberPreference(preference, { persist = true } = {}) {
  const enabled = normalizeDamageNumberPreference(preference);
  damageNumbersEnabled = enabled;
  updateDamageNumberToggleUi();
  if (!enabled) {
    const playfield = playfieldGetter();
    if (playfield && typeof playfield.clearDamageNumbers === 'function') {
      playfield.clearDamageNumbers();
    }
  }
  if (persist) {
    writeStorage(DAMAGE_NUMBER_TOGGLE_STORAGE_KEY, damageNumbersEnabled ? '1' : '0');
  }
  return damageNumbersEnabled;
}

/**
 * Bind the visual settings toggle that controls wave kill tally scribbles.
 */
export function bindWaveKillTallyToggle() {
  waveKillTallyToggleInput = document.getElementById('wave-kill-tally-toggle');
  waveKillTallyToggleStateLabel = document.getElementById('wave-kill-tally-toggle-state');
  if (!waveKillTallyToggleInput) {
    return;
  }
  waveKillTallyToggleInput.addEventListener('change', (event) => {
    applyWaveKillTallyPreference(event?.target?.checked);
  });
  updateWaveKillTallyToggleUi();
}

/**
 * Persist and apply the wave kill tally overlay preference.
 */
export function applyWaveKillTallyPreference(preference, { persist = true } = {}) {
  const enabled = normalizeDamageNumberPreference(preference);
  waveKillTalliesEnabled = enabled;
  updateWaveKillTallyToggleUi();
  if (!enabled) {
    const playfield = playfieldGetter();
    if (playfield && typeof playfield.clearWaveTallies === 'function') {
      playfield.clearWaveTallies({ type: 'kills' });
    }
  }
  if (persist) {
    writeStorage(WAVE_KILL_TALLY_STORAGE_KEY, waveKillTalliesEnabled ? '1' : '0');
  }
  return waveKillTalliesEnabled;
}

/**
 * Bind the visual settings toggle that controls wave damage tally scribbles.
 */
export function bindWaveDamageTallyToggle() {
  waveDamageTallyToggleInput = document.getElementById('wave-damage-tally-toggle');
  waveDamageTallyToggleStateLabel = document.getElementById('wave-damage-tally-toggle-state');
  if (!waveDamageTallyToggleInput) {
    return;
  }
  waveDamageTallyToggleInput.addEventListener('change', (event) => {
    applyWaveDamageTallyPreference(event?.target?.checked);
  });
  updateWaveDamageTallyToggleUi();
}

/**
 * Persist and apply the wave damage tally overlay preference.
 */
export function applyWaveDamageTallyPreference(preference, { persist = true } = {}) {
  const enabled = normalizeDamageNumberPreference(preference);
  waveDamageTalliesEnabled = enabled;
  updateWaveDamageTallyToggleUi();
  if (!enabled) {
    const playfield = playfieldGetter();
    if (playfield && typeof playfield.clearWaveTallies === 'function') {
      playfield.clearWaveTallies({ type: 'damage' });
    }
  }
  if (persist) {
    writeStorage(WAVE_DAMAGE_TALLY_STORAGE_KEY, waveDamageTalliesEnabled ? '1' : '0');
  }
  return waveDamageTalliesEnabled;
}

/**
 * Persist and apply the glowing track tracer preference.
 */
export function applyTrackTracerPreference(preference, { persist = true } = {}) {
  const enabled = normalizeDamageNumberPreference(preference);
  trackTracerEnabled = enabled;
  updateTrackTracerToggleUi();
  updateTrackRenderPreview();
  if (persist) {
    writeStorage(TRACK_TRACER_TOGGLE_STORAGE_KEY, trackTracerEnabled ? '1' : '0');
  }
  const playfield = playfieldGetter();
  if (playfield && typeof playfield.draw === 'function') {
    playfield.draw();
  }
  return trackTracerEnabled;
}

/**
 * Bind the visual settings toggle that controls the luminous track tracer.
 */
export function bindTrackTracerToggle() {
  trackTracerToggleInput = document.getElementById('track-tracer-toggle');
  trackTracerToggleStateLabel = document.getElementById('track-tracer-toggle-state');
  if (!trackTracerToggleInput) {
    return;
  }
  trackTracerToggleInput.addEventListener('change', (event) => {
    applyTrackTracerPreference(event?.target?.checked);
  });
  updateTrackTracerToggleUi();
}

/**
 * Refresh the loadout slot button copy so the Options card always mirrors the active preference.
 */
function updateLoadoutSlotButton() {
  if (!loadoutSlotButton) {
    return;
  }
  loadoutSlotButton.textContent = `Slots · ${preferredLoadoutSlots}`;
  loadoutSlotButton.setAttribute('aria-label', `Cycle loadout slots (current: ${preferredLoadoutSlots})`);
}

/**
 * Allow the bootstrapper to register a callback whenever the loadout slot preference changes.
 */
export function setLoadoutSlotChangeHandler(handler) {
  loadoutSlotChangeHandler = typeof handler === 'function' ? handler : () => {};
}

/**
 * Persist and apply the preferred loadout slot count.
 */
export function applyLoadoutSlotPreference(preference, { persist = true } = {}) {
  const normalized = normalizeLoadoutSlotPreference(preference);
  preferredLoadoutSlots = normalized;
  updateLoadoutSlotButton();
  loadoutSlotChangeHandler(preferredLoadoutSlots);
  if (persist) {
    writeStorage(TOWER_LOADOUT_SLOTS_STORAGE_KEY, String(preferredLoadoutSlots));
  }
  return preferredLoadoutSlots;
}

/**
 * Bind the Options card button that cycles through 1–4 loadout slots.
 */
export function bindLoadoutSlotButton() {
  loadoutSlotButton = document.getElementById('loadout-slot-button');
  if (!loadoutSlotButton) {
    return;
  }
  loadoutSlotButton.addEventListener('click', () => {
    const next = preferredLoadoutSlots >= 4 ? 1 : preferredLoadoutSlots + 1;
    applyLoadoutSlotPreference(next);
  });
  updateLoadoutSlotButton();
}

/**
 * Initialize the loadout slot preference from storage so the slot limit persists across sessions.
 */
export function initializeLoadoutSlotPreference({ defaultSlots = 2 } = {}) {
  const stored = Number.parseInt(readStorage(TOWER_LOADOUT_SLOTS_STORAGE_KEY), 10);
  const normalizedStored = Number.isFinite(stored) ? normalizeLoadoutSlotPreference(stored) : null;
  const fallback = normalizeLoadoutSlotPreference(defaultSlots);
  return applyLoadoutSlotPreference(normalizedStored ?? fallback, { persist: false });
}

/**
 * Report the current preferred loadout slot count.
 */
export function getPreferredLoadoutSlots() {
  return preferredLoadoutSlots;
}

/**
 * Clamp the frame rate limit between the supported 30–120 range.
 */
function normalizeFrameRateLimitPreference(value) {
  if (!Number.isFinite(value)) {
    return 60;
  }
  return Math.min(120, Math.max(30, Math.floor(value)));
}

/**
 * Update the frame rate limit slider UI to reflect the current value.
 */
function updateFrameRateLimitUi() {
  if (frameRateLimitSlider) {
    frameRateLimitSlider.value = frameRateLimit;
  }
  if (frameRateLimitValueLabel) {
    frameRateLimitValueLabel.textContent = `${frameRateLimit} fps`;
  }
}

/**
 * Allow the bootstrapper to register a callback whenever the frame rate limit changes.
 */
export function setFrameRateLimitChangeHandler(handler) {
  frameRateLimitChangeHandler = typeof handler === 'function' ? handler : () => {};
}

/**
 * Persist and apply the frame rate limit preference.
 */
export function applyFrameRateLimitPreference(preference, { persist = true } = {}) {
  const normalized = normalizeFrameRateLimitPreference(preference);
  frameRateLimit = normalized;
  updateFrameRateLimitUi();
  frameRateLimitChangeHandler(frameRateLimit);
  if (persist) {
    writeStorage(FRAME_RATE_LIMIT_STORAGE_KEY, String(frameRateLimit));
  }
  return frameRateLimit;
}

/**
 * Bind the visual settings slider for frame rate limit.
 */
export function bindFrameRateLimitSlider() {
  frameRateLimitSlider = document.getElementById('frame-rate-limit');
  frameRateLimitValueLabel = document.getElementById('frame-rate-limit-value');
  if (!frameRateLimitSlider) {
    return;
  }
  frameRateLimitSlider.addEventListener('input', (event) => {
    applyFrameRateLimitPreference(Number(event.target.value));
  });
  updateFrameRateLimitUi();
}

/**
 * Initialize the frame rate limit preference from storage.
 */
export function initializeFrameRateLimitPreference() {
  const stored = Number.parseInt(readStorage(FRAME_RATE_LIMIT_STORAGE_KEY), 10);
  const normalized = Number.isFinite(stored) ? normalizeFrameRateLimitPreference(stored) : 60;
  return applyFrameRateLimitPreference(normalized, { persist: false });
}

/**
 * Report the current frame rate limit.
 */
export function getFrameRateLimit() {
  return frameRateLimit;
}

/**
 * Synchronize the FPS counter toggle control with the in-memory state.
 */
function updateFpsCounterToggleUi() {
  if (fpsCounterToggleInput) {
    fpsCounterToggleInput.checked = fpsCounterEnabled;
    fpsCounterToggleInput.setAttribute('aria-checked', fpsCounterEnabled ? 'true' : 'false');
    const controlShell = fpsCounterToggleInput.closest('.settings-toggle-control');
    if (controlShell) {
      controlShell.classList.toggle('is-active', fpsCounterEnabled);
    }
  }
  if (fpsCounterToggleStateLabel) {
    fpsCounterToggleStateLabel.textContent = fpsCounterEnabled ? 'On' : 'Off';
  }
}

/**
 * Update the FPS counter element visibility based on the toggle state.
 */
function updateFpsCounterVisibility() {
  if (!fpsCounterElement) {
    fpsCounterElement = document.getElementById('fps-counter');
  }
  if (fpsCounterElement) {
    fpsCounterElement.hidden = !fpsCounterEnabled;
    fpsCounterElement.setAttribute('aria-hidden', fpsCounterEnabled ? 'false' : 'true');
  }
}

/**
 * Persist and apply the FPS counter visibility preference.
 */
export function applyFpsCounterPreference(preference, { persist = true } = {}) {
  const enabled = normalizeDamageNumberPreference(preference);
  fpsCounterEnabled = enabled;
  updateFpsCounterToggleUi();
  updateFpsCounterVisibility();
  if (persist) {
    writeStorage(FPS_COUNTER_TOGGLE_STORAGE_KEY, fpsCounterEnabled ? '1' : '0');
  }
  return fpsCounterEnabled;
}

/**
 * Bind the visual settings toggle for FPS counter visibility.
 */
export function bindFpsCounterToggle() {
  fpsCounterToggleInput = document.getElementById('fps-counter-toggle');
  fpsCounterToggleStateLabel = document.getElementById('fps-counter-toggle-state');
  if (!fpsCounterToggleInput) {
    return;
  }
  fpsCounterToggleInput.addEventListener('change', (event) => {
    applyFpsCounterPreference(event?.target?.checked);
  });
  updateFpsCounterToggleUi();
}

/**
 * Initialize the FPS counter preference from storage.
 */
export function initializeFpsCounterPreference() {
  const stored = readStorage(FPS_COUNTER_TOGGLE_STORAGE_KEY);
  const normalized = stored === '1' || stored === 'true';
  return applyFpsCounterPreference(normalized, { persist: false });
}

/**
 * Reports whether the FPS counter overlay is active.
 */
export function isFpsCounterEnabled() {
  return fpsCounterEnabled;
}

/**
 * Update the FPS counter display with the current frame rate.
 * Call this from the game loop to update the displayed FPS.
 */
export function updateFpsCounter(timestamp) {
  if (!fpsCounterEnabled) {
    return;
  }
  if (!fpsCounterElement) {
    fpsCounterElement = document.getElementById('fps-counter');
  }
  if (!fpsCounterElement) {
    return;
  }

  fpsCounterFrameCount++;
  const elapsed = timestamp - fpsCounterLastUpdate;
  // Update the display approximately every 500ms for stability.
  if (elapsed >= 500) {
    const fps = Math.round((fpsCounterFrameCount * 1000) / elapsed);
    fpsCounterElement.textContent = fps;
    fpsCounterFrameCount = 0;
    fpsCounterLastUpdate = timestamp;
  }
}

function resolveGraphicsModeLabel(mode = activeGraphicsMode) {
  return mode === GRAPHICS_MODES.LOW ? 'Low' : 'High';
}

function updateGraphicsModeButton() {
  if (!graphicsModeButton) {
    return;
  }
  const label = resolveGraphicsModeLabel();
  // Mirror the centered dot separator for the graphics button label as well.
  graphicsModeButton.textContent = `Graphics · ${label}`;
  graphicsModeButton.setAttribute('aria-label', `Switch graphics quality (current: ${label})`);
}

function updateDesktopCursorClass(enabled) {
  const body = typeof document !== 'undefined' ? document.body : null;
  if (!body) {
    return;
  }
  const nextState = Boolean(enabled);
  if (nextState === desktopCursorActive) {
    return;
  }
  desktopCursorActive = nextState;
  body.classList.toggle('mouse-cursor-gem', desktopCursorActive);
}

function evaluateDesktopCursorPreferenceFallback() {
  if (typeof navigator === 'undefined') {
    updateDesktopCursorClass(false);
    return;
  }
  const userAgent = navigator.userAgent || '';
  const mobilePattern = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;
  updateDesktopCursorClass(!mobilePattern.test(userAgent));
}

export function initializeDesktopCursorPreference() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    evaluateDesktopCursorPreferenceFallback();
    return;
  }
  try {
    desktopCursorMediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    updateDesktopCursorClass(desktopCursorMediaQuery.matches);
    const listener = (event) => {
      updateDesktopCursorClass(event.matches);
    };
    if (typeof desktopCursorMediaQuery.addEventListener === 'function') {
      desktopCursorMediaQuery.addEventListener('change', listener);
    } else if (typeof desktopCursorMediaQuery.addListener === 'function') {
      desktopCursorMediaQuery.addListener(listener);
    }
  } catch (error) {
    console.warn('Desktop cursor media query failed; falling back to user agent detection.', error);
    evaluateDesktopCursorPreferenceFallback();
  }
}

export function setGraphicsModeContext({ getPowderSimulation, getPlayfield } = {}) {
  if (typeof getPowderSimulation === 'function') {
    powderSimulationGetter = getPowderSimulation;
  }
  if (typeof getPlayfield === 'function') {
    playfieldGetter = getPlayfield;
  }
}

function prefersLowGraphicsByDefault() {
  if (typeof window !== 'undefined') {
    try {
      const matcher = typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : null;
      const coarsePointer = matcher ? matcher('(pointer: coarse)').matches : false;
      const hoverNone = matcher ? matcher('(hover: none)').matches : false;
      const width = Number.isFinite(window.innerWidth) ? window.innerWidth : null;
      const smallViewport = width !== null && width <= 900;
      if ((coarsePointer && hoverNone) || (coarsePointer && smallViewport)) {
        return true;
      }
      if (width !== null && width <= 768) {
        return true;
      }
    } catch (error) {
      console.warn('Graphics mode heuristic failed; falling back to user agent detection.', error);
    }
  }

  if (typeof navigator !== 'undefined') {
    const userAgent = navigator.userAgent || '';
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
      return true;
    }
  }

  return false;
}

export function applyGraphicsMode(mode, { persist = true } = {}) {
  const normalized = mode === GRAPHICS_MODES.LOW ? GRAPHICS_MODES.LOW : GRAPHICS_MODES.HIGH;
  activeGraphicsMode = normalized;

  const body = typeof document !== 'undefined' ? document.body : null;
  if (body) {
    body.classList.toggle('graphics-mode-low', normalized === GRAPHICS_MODES.LOW);
    body.classList.toggle('graphics-mode-high', normalized === GRAPHICS_MODES.HIGH);
  }

  updateGraphicsModeButton();

  if (persist) {
    writeStorage(GRAPHICS_MODE_STORAGE_KEY, normalized);
  }

  const powderSimulation = powderSimulationGetter();
  if (powderSimulation && typeof powderSimulation.render === 'function') {
    powderSimulation.render();
  }

  const playfield = playfieldGetter();
  if (playfield && typeof playfield.draw === 'function') {
    playfield.draw();
  }

  return normalized;
}

export function isLowGraphicsModeActive() {
  return activeGraphicsMode === GRAPHICS_MODES.LOW;
}

export function getActiveGraphicsMode() {
  return activeGraphicsMode;
}

export function toggleGraphicsMode() {
  const next = activeGraphicsMode === GRAPHICS_MODES.LOW ? GRAPHICS_MODES.HIGH : GRAPHICS_MODES.LOW;
  applyGraphicsMode(next);
}

export function areGlyphEquationsVisible() {
  return glyphEquationsVisible;
}

export function areDamageNumbersEnabled() {
  return damageNumbersEnabled;
}

/**
 * Reports whether the kill tally scribble overlay is active.
 */
export function areWaveKillTalliesEnabled() {
  return waveKillTalliesEnabled;
}

/**
 * Reports whether the damage tally scribble overlay is active.
 */
export function areWaveDamageTalliesEnabled() {
  return waveDamageTalliesEnabled;
}

/**
 * Reports whether the luminous track tracer overlay is active.
 */
export function areTrackTracersEnabled() {
  return trackTracerEnabled;
}

export function bindGraphicsModeToggle() {
  graphicsModeButton = document.getElementById('graphics-mode-button');
  if (!graphicsModeButton) {
    return;
  }
  graphicsModeButton.addEventListener('click', () => {
    toggleGraphicsMode();
  });
  updateGraphicsModeButton();
}

export function initializeGraphicsMode() {
  const stored = readStorage(GRAPHICS_MODE_STORAGE_KEY);
  const normalized = stored === GRAPHICS_MODES.LOW || stored === GRAPHICS_MODES.HIGH ? stored : null;
  const fallback = prefersLowGraphicsByDefault() ? GRAPHICS_MODES.LOW : GRAPHICS_MODES.HIGH;
  applyGraphicsMode(normalized || fallback, { persist: !normalized });
}

function resolveTrackRenderModeLabel(mode = activeTrackRenderMode) {
  switch (mode) {
    case TRACK_RENDER_MODES.BLUR:
      return 'Blurred';
    case TRACK_RENDER_MODES.RIVER:
      return 'River';
    case TRACK_RENDER_MODES.GRADIENT:
    default:
      return 'Gradient';
  }
}

function updateTrackRenderModeButton() {
  if (!trackRenderModeButton) {
    return;
  }
  const label = resolveTrackRenderModeLabel();
  trackRenderModeButton.textContent = `Track · ${label}`;
  trackRenderModeButton.setAttribute('aria-label', `Switch track visuals (current: ${label})`);
}

function cycleTrackRenderMode() {
  const modes = Object.values(TRACK_RENDER_MODES);
  if (!modes.length) {
    return;
  }
  const currentIndex = modes.indexOf(activeTrackRenderMode);
  const next = modes[(currentIndex + 1) % modes.length];
  applyTrackRenderMode(next);
}

export function getTrackRenderMode() {
  return activeTrackRenderMode;
}

export function applyTrackRenderMode(mode, { persist = true } = {}) {
  const validModes = Object.values(TRACK_RENDER_MODES);
  const normalized = validModes.includes(mode) ? mode : TRACK_RENDER_MODES.GRADIENT;
  activeTrackRenderMode = normalized;
  updateTrackRenderModeButton();
  updateTrackRenderPreview();

  if (persist) {
    writeStorage(TRACK_RENDER_MODE_STORAGE_KEY, normalized);
  }

  const playfield = playfieldGetter();
  if (playfield && typeof playfield.draw === 'function') {
    playfield.draw();
  }

  return normalized;
}

export function bindTrackRenderModeButton() {
  trackRenderModeButton = document.getElementById('track-graphics-button');
  if (!trackRenderModeButton) {
    return;
  }
  trackRenderModeButton.addEventListener('click', () => {
    cycleTrackRenderMode();
  });
  updateTrackRenderModeButton();
  updateTrackRenderPreview();
}

export function initializeTrackRenderMode() {
  const stored = readStorage(TRACK_RENDER_MODE_STORAGE_KEY);
  const validModes = Object.values(TRACK_RENDER_MODES);
  const normalized = stored && validModes.includes(stored) ? stored : TRACK_RENDER_MODES.GRADIENT;
  applyTrackRenderMode(normalized, { persist: false });
}
