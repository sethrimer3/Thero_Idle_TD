/**
 * Manage Playfield visual preferences.
 * Provides render size controls for the playfield.
 */
import {
  readStorageJson,
  writeStorage,
} from '../autoSave.js';

const PLAYFIELD_SETTINGS_KEY = 'playfieldVisualSettings';
// Broadcast preference changes so the playfield can rebuild its canvas resolution.
export const PLAYFIELD_RESOLUTION_EVENT = 'playfield-resolution-change';

// Cap the playfield canvas backing resolution based on the user's preference.
const PLAYFIELD_RESOLUTION_CAPS = Object.freeze({
  standard: 1,
  high: 2,
});

const DEFAULT_SETTINGS = Object.freeze({
  renderOverlapLevel: 1, // Default to Medium (overlap 1 margin)
  highResolution: false, // Default to standard resolution for stable performance.
});

// Clamp render size controls to 0-2 range (Small, Medium, Large).
const MAX_RENDER_OVERLAP_LEVEL = 2;

let settings = { ...DEFAULT_SETTINGS };
let renderOverlapSelect = null;
let renderOverlapRow = null;
// Cache the playfield resolution toggle elements for quick UI updates.
let highResolutionToggle = null;
let highResolutionState = null;

/**
 * Persist the current Playfield visual settings into storage.
 */
function persistSettings() {
  writeStorage(PLAYFIELD_SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Load saved settings and apply defaults for any missing flags.
 */
function loadSettings() {
  const stored = readStorageJson(PLAYFIELD_SETTINGS_KEY);
  if (stored && typeof stored === 'object') {
    settings = { ...DEFAULT_SETTINGS, ...stored };
    settings.renderOverlapLevel = normalizeRenderOverlapLevel(stored.renderOverlapLevel);
    settings.highResolution = normalizeHighResolution(stored.highResolution);
  }
}

/**
 * Reflect the current select state in the UI.
 */
function syncSelectUi() {
  if (renderOverlapSelect) {
    renderOverlapSelect.value = String(normalizeRenderOverlapLevel(settings.renderOverlapLevel));
  }
}

// Reflect the high-resolution toggle state in the UI.
function syncResolutionUi() {
  if (!highResolutionToggle || !highResolutionState) {
    return;
  }
  const enabled = Boolean(settings.highResolution);
  highResolutionToggle.checked = enabled;
  highResolutionToggle.setAttribute('aria-checked', String(enabled));
  highResolutionState.textContent = enabled ? 'High' : 'Standard';
}

// Normalize the render size level to a safe 0-2 range.
function normalizeRenderOverlapLevel(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 1; // Default to Medium if invalid
  }
  return Math.min(MAX_RENDER_OVERLAP_LEVEL, Math.max(0, parsed));
}

// Normalize the high-resolution preference to a boolean flag.
function normalizeHighResolution(value) {
  return value === true;
}

// Notify the playfield renderer that a resolution change was requested.
function notifyPlayfieldResolutionChange() {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(PLAYFIELD_RESOLUTION_EVENT, {
    detail: { highResolution: settings.highResolution },
  }));
}

/**
 * Expose the maximum pixel ratio allowed for playfield rendering.
 */
export function getPlayfieldResolutionCap() {
  return settings.highResolution
    ? PLAYFIELD_RESOLUTION_CAPS.high
    : PLAYFIELD_RESOLUTION_CAPS.standard;
}

// Apply the Playfield render size settings by offsetting the container.
function applyRenderOverlapLayout() {
  const playfield = document.getElementById('playfield');
  if (!playfield) {
    return;
  }

  const overlapLevel = normalizeRenderOverlapLevel(settings.renderOverlapLevel);
  const panel = playfield.closest('.panel');
  const appShell = document.querySelector('.app-shell');

  const readPadding = (element) => {
    if (!element || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
      return { top: 0, left: 0, right: 0 };
    }
    const styles = window.getComputedStyle(element);
    return {
      top: Number.parseFloat(styles.paddingTop) || 0,
      left: Number.parseFloat(styles.paddingLeft) || 0,
      right: Number.parseFloat(styles.paddingRight) || 0,
    };
  };

  const panelPadding = readPadding(panel);
  const shellPadding = readPadding(appShell);
  const inlineLeft = (overlapLevel >= 2 ? panelPadding.left : 0) + (overlapLevel >= 3 ? shellPadding.left : 0);
  const inlineRight = (overlapLevel >= 2 ? panelPadding.right : 0) + (overlapLevel >= 3 ? shellPadding.right : 0);
  const topOffset = (overlapLevel >= 2 ? panelPadding.top : 0) + (overlapLevel >= 3 ? shellPadding.top : 0);

  playfield.dataset.overlapLevel = String(overlapLevel);
  playfield.style.setProperty('--playfield-overlap-inline-left', `${inlineLeft}px`);
  playfield.style.setProperty('--playfield-overlap-inline-right', `${inlineRight}px`);
  playfield.style.setProperty('--playfield-overlap-top', `${topOffset}px`);
}

/**
 * Bind Playfield option controls and wire event listeners.
 */
export function bindPlayfieldOptions() {
  renderOverlapSelect = document.getElementById('playfield-render-size-select');
  renderOverlapRow = document.getElementById('playfield-render-size-row');
  highResolutionToggle = document.getElementById('playfield-high-res-toggle');
  highResolutionState = document.getElementById('playfield-high-res-state');

  if (renderOverlapSelect) {
    renderOverlapSelect.addEventListener('change', (event) => {
      settings.renderOverlapLevel = normalizeRenderOverlapLevel(event.target.value);
      persistSettings();
      syncSelectUi();
      applyRenderOverlapLayout();
    });
  }

  if (highResolutionToggle) {
    highResolutionToggle.addEventListener('change', (event) => {
      settings.highResolution = Boolean(event.target.checked);
      persistSettings();
      syncResolutionUi();
      notifyPlayfieldResolutionChange();
    });
  }

  syncSelectUi();
  syncResolutionUi();
}

/**
 * Initialize settings from storage and apply them.
 */
export function initializePlayfieldPreferences() {
  loadSettings();
  syncSelectUi();
  syncResolutionUi();
  applyRenderOverlapLayout();
}

// Recalculate overlap offsets on viewport changes to keep the render aligned.
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    applyRenderOverlapLayout();
  });
}
