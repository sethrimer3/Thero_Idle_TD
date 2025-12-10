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
});

let settings = { ...DEFAULT_SETTINGS };
let simulationGetter = () => null;
let glowToggle = null;
let glowStateLabel = null;

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
  }
}

/**
 * Apply the live settings to the active powder simulation instance.
 */
function applySettingsToSimulation() {
  const simulation = simulationGetter();
  if (!simulation || typeof simulation.applyMoteGlowSettings !== 'function') {
    return;
  }
  simulation.applyMoteGlowSettings({ glowTrailsEnabled: settings.moteGlow });
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

  if (glowToggle) {
    glowToggle.addEventListener('change', (event) => {
      settings.moteGlow = event.target.checked;
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
