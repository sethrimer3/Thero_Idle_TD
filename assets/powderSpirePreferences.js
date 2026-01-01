/**
 * Manage Aleph spire powder visual preferences.
 * Surfaces a toggle for glowing motes and their falling trails, persisting the
 * choice and applying it to the active powder simulation in real time.
 */
import {
  readStorageJson,
  writeStorage,
  POWDER_VISUAL_SETTINGS_STORAGE_KEY,
} from './autoSave.js';

const DEFAULT_SETTINGS = Object.freeze({
  moteGlow: true,
  backgroundStars: true,
  moteTrails: true,
  renderOverlapLevel: 0, // Default to Small (overlap 0 margin)
});

// Clamp render size controls to 0-2 range (Small, Medium, Large).
const MAX_RENDER_OVERLAP_LEVEL = 2;

let settings = { ...DEFAULT_SETTINGS };
let simulationGetter = () => null;
let glowToggle = null;
let glowStateLabel = null;
let starsToggle = null;
let starsStateLabel = null;
let trailsToggle = null;
let trailsStateLabel = null;
// Render size controls for the Aleph spire layout.
let renderOverlapSelect = null;
let renderOverlapRow = null;

/**
 * Persist the current Aleph spire visual settings into storage.
 */
function persistSettings() {
  writeStorage(POWDER_VISUAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

/**
 * Load saved settings and apply defaults for any missing flags.
 */
function loadSettings() {
  const stored = readStorageJson(POWDER_VISUAL_SETTINGS_STORAGE_KEY);
  if (stored && typeof stored === 'object') {
    settings = { ...DEFAULT_SETTINGS, ...stored };
    settings.moteGlow = stored.moteGlow !== false;
    settings.backgroundStars = stored.backgroundStars !== false;
    settings.moteTrails = stored.moteTrails !== false;
    settings.renderOverlapLevel = normalizeRenderOverlapLevel(stored.renderOverlapLevel);
  }
}

/**
 * Apply the live settings to the active powder simulation instance.
 */
function applySettingsToSimulation() {
  const simulation = simulationGetter();
  if (!simulation) {
    return;
  }
  if (typeof simulation.applyMoteGlowSettings === 'function') {
    simulation.applyMoteGlowSettings({ glowTrailsEnabled: settings.moteGlow });
  }
  if (typeof simulation.setBackgroundStarsEnabled === 'function') {
    simulation.setBackgroundStarsEnabled(settings.backgroundStars);
  }
  if (typeof simulation.setMoteTrailsEnabled === 'function') {
    simulation.setMoteTrailsEnabled(settings.moteTrails);
  }
}

/**
 * Reflect the current toggle state in the UI.
 */
function syncToggleUi() {
  if (glowToggle) {
    glowToggle.checked = !!settings.moteGlow;
    glowToggle.setAttribute('aria-checked', settings.moteGlow ? 'true' : 'false');
    const controlShell = glowToggle.closest('.settings-toggle-control');
    if (controlShell) {
      controlShell.classList.toggle('is-active', !!settings.moteGlow);
    }
  }
  if (glowStateLabel) {
    glowStateLabel.textContent = settings.moteGlow ? 'On' : 'Off';
  }
  
  if (starsToggle) {
    starsToggle.checked = !!settings.backgroundStars;
    starsToggle.setAttribute('aria-checked', settings.backgroundStars ? 'true' : 'false');
    const controlShell = starsToggle.closest('.settings-toggle-control');
    if (controlShell) {
      controlShell.classList.toggle('is-active', !!settings.backgroundStars);
    }
  }
  if (starsStateLabel) {
    starsStateLabel.textContent = settings.backgroundStars ? 'On' : 'Off';
  }
  
  if (trailsToggle) {
    trailsToggle.checked = !!settings.moteTrails;
    trailsToggle.setAttribute('aria-checked', settings.moteTrails ? 'true' : 'false');
    const controlShell = trailsToggle.closest('.settings-toggle-control');
    if (controlShell) {
      controlShell.classList.toggle('is-active', !!settings.moteTrails);
    }
  }
  if (trailsStateLabel) {
    trailsStateLabel.textContent = settings.moteTrails ? 'On' : 'Off';
  }

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

// Apply the Aleph render size settings by offsetting the spire container.
function applyRenderOverlapLayout() {
  const powderStage = document.getElementById('powder-stage');
  if (!powderStage) {
    return;
  }

  const overlapLevel = normalizeRenderOverlapLevel(settings.renderOverlapLevel);
  const panel = powderStage.closest('.panel');
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

  powderStage.dataset.overlapLevel = String(overlapLevel);
  powderStage.style.setProperty('--powder-overlap-inline-left', `${inlineLeft}px`);
  powderStage.style.setProperty('--powder-overlap-inline-right', `${inlineRight}px`);
  powderStage.style.setProperty('--powder-overlap-top', `${topOffset}px`);
}

/**
 * Expose the powder simulation so preferences can update it on change.
 * @param {() => import('../scripts/features/towers/powderTower.js').PowderSimulation | null} getter
 */
export function setPowderSimulationGetter(getter) {
  if (typeof getter === 'function') {
    simulationGetter = getter;
    applySettingsToSimulation();
  }
}

/**
 * Bind Aleph spire option controls and wire event listeners.
 */
export function bindPowderSpireOptions() {
  glowToggle = document.getElementById('powder-mote-glow-toggle');
  glowStateLabel = document.getElementById('powder-mote-glow-state');
  starsToggle = document.getElementById('powder-background-stars-toggle');
  starsStateLabel = document.getElementById('powder-background-stars-state');
  trailsToggle = document.getElementById('powder-mote-trails-toggle');
  trailsStateLabel = document.getElementById('powder-mote-trails-state');
  renderOverlapSelect = document.getElementById('powder-render-overlap-select');
  renderOverlapRow = document.getElementById('powder-render-overlap-row');

  if (glowToggle) {
    glowToggle.addEventListener('change', (event) => {
      settings.moteGlow = event.target.checked;
      persistSettings();
      syncToggleUi();
      applySettingsToSimulation();
    });
  }

  if (starsToggle) {
    starsToggle.addEventListener('change', (event) => {
      settings.backgroundStars = event.target.checked;
      persistSettings();
      syncToggleUi();
      applySettingsToSimulation();
    });
  }

  if (trailsToggle) {
    trailsToggle.addEventListener('change', (event) => {
      settings.moteTrails = event.target.checked;
      persistSettings();
      syncToggleUi();
      applySettingsToSimulation();
    });
  }

  if (renderOverlapSelect) {
    renderOverlapSelect.addEventListener('change', (event) => {
      settings.renderOverlapLevel = normalizeRenderOverlapLevel(event.target.value);
      persistSettings();
      syncToggleUi();
      applyRenderOverlapLayout();
    });
  }

  syncToggleUi();
}

/**
 * Initialize settings from storage and apply them to the simulation.
 */
export function initializePowderSpirePreferences() {
  loadSettings();
  syncToggleUi();
  applySettingsToSimulation();
  applyRenderOverlapLayout();
}

/**
 * Reapply the current settings when the simulation instance changes.
 */
export function applyPowderVisualSettings() {
  applySettingsToSimulation();
}

// Recalculate overlap offsets on viewport changes to keep the render aligned.
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    applyRenderOverlapLayout();
  });
}
