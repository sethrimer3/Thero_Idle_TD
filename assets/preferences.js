import {
  getGameNumberNotation,
  setGameNumberNotation,
  addGameNumberNotationChangeListener,
  GAME_NUMBER_NOTATIONS,
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

let graphicsModeButton = null;
let trackRenderModeButton = null;
let desktopCursorMediaQuery = null;
let desktopCursorActive = false;
let activeGraphicsMode = GRAPHICS_MODES.HIGH;
let activeTrackRenderMode = TRACK_RENDER_MODES.GRADIENT;

let powderSimulationGetter = () => null;
let playfieldGetter = () => null;

export function setNotationRefreshHandler(handler) {
  notationRefreshHandler = typeof handler === 'function' ? handler : () => {};
}

function resolveNotationLabel(notation) {
  return notation === GAME_NUMBER_NOTATIONS.SCIENTIFIC ? 'Scientific' : 'Letters';
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

function handleNotationChange() {
  updateNotationToggleLabel();
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
  const next = current === GAME_NUMBER_NOTATIONS.SCIENTIFIC
    ? GAME_NUMBER_NOTATIONS.LETTERS
    : GAME_NUMBER_NOTATIONS.SCIENTIFIC;
  applyNotationPreference(next);
}

export function bindNotationToggle() {
  notationToggleButton = document.getElementById('notation-toggle-button');
  if (!notationToggleButton) {
    return;
  }
  notationToggleButton.addEventListener('click', () => {
    toggleNotationPreference();
  });
  updateNotationToggleLabel();
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
}

export function initializeTrackRenderMode() {
  const stored = readStorage(TRACK_RENDER_MODE_STORAGE_KEY);
  const validModes = Object.values(TRACK_RENDER_MODES);
  const normalized = stored && validModes.includes(stored) ? stored : TRACK_RENDER_MODES.GRADIENT;
  applyTrackRenderMode(normalized, { persist: false });
}
