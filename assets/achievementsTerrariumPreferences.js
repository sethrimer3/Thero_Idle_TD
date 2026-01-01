/**
 * Manage Achievement Terrarium visual preferences.
 * Provides render size controls for the achievement terrarium.
 */
import {
  readStorageJson,
  writeStorage,
} from './autoSave.js';

const ACHIEVEMENTS_TERRARIUM_SETTINGS_KEY = 'achievementsTerrariumVisualSettings';

const DEFAULT_SETTINGS = Object.freeze({
  renderOverlapLevel: 0, // Default to Small (overlap 0 margin)
});

// Clamp render size controls to 0-2 range (Small, Medium, Large).
const MAX_RENDER_OVERLAP_LEVEL = 2;

let settings = { ...DEFAULT_SETTINGS };
let renderOverlapSelect = null;
let renderOverlapRow = null;

/**
 * Persist the current Achievement Terrarium visual settings into storage.
 */
function persistSettings() {
  writeStorage(ACHIEVEMENTS_TERRARIUM_SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Load saved settings and apply defaults for any missing flags.
 */
function loadSettings() {
  const stored = readStorageJson(ACHIEVEMENTS_TERRARIUM_SETTINGS_KEY);
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

// Apply the Achievement Terrarium render size settings by offsetting the container.
function applyRenderOverlapLayout() {
  const terrariumHost = document.getElementById('achievements-terrarium-host');
  if (!terrariumHost) {
    return;
  }

  const overlapLevel = normalizeRenderOverlapLevel(settings.renderOverlapLevel);
  const panel = terrariumHost.closest('.panel');
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

  terrariumHost.dataset.overlapLevel = String(overlapLevel);
  terrariumHost.style.setProperty('--terrarium-overlap-inline-left', `${inlineLeft}px`);
  terrariumHost.style.setProperty('--terrarium-overlap-inline-right', `${inlineRight}px`);
  terrariumHost.style.setProperty('--terrarium-overlap-top', `${topOffset}px`);
}

/**
 * Bind Achievement Terrarium option controls and wire event listeners.
 */
export function bindAchievementsTerrariumOptions() {
  renderOverlapSelect = document.getElementById('achievements-terrarium-render-size-select');
  renderOverlapRow = document.getElementById('achievements-terrarium-render-size-row');

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
export function initializeAchievementsTerrariumPreferences() {
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
