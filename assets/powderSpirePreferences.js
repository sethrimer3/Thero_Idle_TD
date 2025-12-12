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
});

let settings = { ...DEFAULT_SETTINGS };
let simulationGetter = () => null;
let glowToggle = null;
let glowStateLabel = null;
let starsToggle = null;
let starsStateLabel = null;
let trailsToggle = null;
let trailsStateLabel = null;

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

  syncToggleUi();
}

/**
 * Initialize settings from storage and apply them to the simulation.
 */
export function initializePowderSpirePreferences() {
  loadSettings();
  syncToggleUi();
  applySettingsToSimulation();
}

/**
 * Reapply the current settings when the simulation instance changes.
 */
export function applyPowderVisualSettings() {
  applySettingsToSimulation();
}
