/**
 * Manage Playfield visual preferences.
 * Provides render size controls for the playfield.
 */
import {
  readStorageJson,
  writeStorage,
} from '../autoSave.js';

const PLAYFIELD_SETTINGS_KEY = 'playfieldVisualSettings';

const DEFAULT_SETTINGS = Object.freeze({
  renderOverlapLevel: 1, // Default to Medium (overlap 1 margin)
});

// Clamp render size controls to 0-2 range (Small, Medium, Large).
const MAX_RENDER_OVERLAP_LEVEL = 2;

let settings = { ...DEFAULT_SETTINGS };
let renderOverlapSelect = null;
let renderOverlapRow = null;

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

// Normalize the render size level to a safe 0-2 range.
function normalizeRenderOverlapLevel(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 1; // Default to Medium if invalid
  }
  return Math.min(MAX_RENDER_OVERLAP_LEVEL, Math.max(0, parsed));
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

  if (renderOverlapSelect) {
    renderOverlapSelect.addEventListener('change', (event) => {
      settings.renderOverlapLevel = normalizeRenderOverlapLevel(event.target.value);
      persistSettings();
      syncSelectUi();
      applyRenderOverlapLayout();
    });
  }

  syncSelectUi();
}

/**
 * Initialize settings from storage and apply them.
 */
export function initializePlayfieldPreferences() {
  loadSettings();
  syncSelectUi();
  applyRenderOverlapLayout();
}

// Recalculate overlap offsets on viewport changes to keep the render aligned.
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    applyRenderOverlapLayout();
  });
}
