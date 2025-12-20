/**
 * Manage Tsadi spire fusion rendering preferences.
 * Exposes graphics presets and overlay toggles so the particle fusion viewport can scale down on lower-end devices.
 */
import { readStorageJson, writeStorage, TSADI_VISUAL_SETTINGS_STORAGE_KEY } from './autoSave.js';

export const TSADI_GRAPHICS_LEVELS = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});
const PIXELATION_LEVELS = [0, 1, 2];
const PIXELATION_LABELS = ['None', 'Mild', 'Strong'];

const DEFAULT_SETTINGS = Object.freeze({
  graphicsLevel: TSADI_GRAPHICS_LEVELS.HIGH,
  pixelationLevel: 0,
  renderForceLinks: true,
  renderFusionEffects: true,
  renderSpawnEffects: true,
});

let settings = { ...DEFAULT_SETTINGS };
let simulationGetter = () => null;

let graphicsLevelButton = null;
let pixelationLevelButton = null;
let forceLinkToggle = null;
let fusionEffectsToggle = null;
let spawnEffectsToggle = null;
let forceLinkStateLabel = null;
let fusionEffectsStateLabel = null;
let spawnEffectsStateLabel = null;

/**
 * Persist the latest Tsadi visual settings to localStorage.
 */
function persistSettings() {
  writeStorage(TSADI_VISUAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

/**
 * Load stored Tsadi visual settings and merge with defaults for forward compatibility.
 */
function loadSettings() {
  const stored = readStorageJson(TSADI_VISUAL_SETTINGS_STORAGE_KEY);
  if (stored && typeof stored === 'object') {
    settings = { ...DEFAULT_SETTINGS, ...stored };
  }
}

/**
 * Forward the current settings to the active particle fusion simulation.
 */
function applySettingsToSimulation() {
  const simulation = typeof simulationGetter === 'function' ? simulationGetter() : null;
  if (!simulation || typeof simulation.setVisualSettings !== 'function') {
    return;
  }
  simulation.setVisualSettings({
    graphicsLevel: settings.graphicsLevel,
    pixelationLevel: settings.pixelationLevel,
    renderForceLinks: settings.renderForceLinks,
    renderFusionEffects: settings.renderFusionEffects,
    renderSpawnEffects: settings.renderSpawnEffects,
  });
}

function resolveGraphicsLabel(level = settings.graphicsLevel) {
  switch (level) {
    case TSADI_GRAPHICS_LEVELS.LOW:
      return 'Low';
    case TSADI_GRAPHICS_LEVELS.MEDIUM:
      return 'Medium';
    default:
      return 'High';
  }
}

function resolvePixelationLabel(level = settings.pixelationLevel) {
  const index = Math.max(0, Math.min(PIXELATION_LEVELS.length - 1, Math.round(level)));
  return PIXELATION_LABELS[index] || PIXELATION_LABELS[0];
}

function cycleGraphicsLevel() {
  const sequence = [TSADI_GRAPHICS_LEVELS.LOW, TSADI_GRAPHICS_LEVELS.MEDIUM, TSADI_GRAPHICS_LEVELS.HIGH];
  const index = sequence.indexOf(settings.graphicsLevel);
  const nextIndex = index >= 0 ? (index + 1) % sequence.length : 0;
  settings.graphicsLevel = sequence[nextIndex];
  persistSettings();
  applySettingsToSimulation();
  syncGraphicsButton();
}

function cyclePixelationLevel() {
  const index = PIXELATION_LEVELS.indexOf(Math.round(settings.pixelationLevel));
  const nextIndex = index >= 0 ? (index + 1) % PIXELATION_LEVELS.length : 0;
  settings.pixelationLevel = PIXELATION_LEVELS[nextIndex];
  persistSettings();
  applySettingsToSimulation();
  syncPixelationButton();
}

function syncGraphicsButton() {
  if (!graphicsLevelButton) {
    return;
  }
  const label = resolveGraphicsLabel();
  graphicsLevelButton.textContent = `Graphics · ${label}`;
  graphicsLevelButton.setAttribute('aria-label', `Cycle Tsadi fusion graphics quality (current: ${label})`);
}

function syncPixelationButton() {
  if (!pixelationLevelButton) {
    return;
  }
  const label = resolvePixelationLabel();
  pixelationLevelButton.textContent = `Pixelation · ${label}`;
  pixelationLevelButton.setAttribute('aria-label', `Cycle Tsadi fusion pixelation (current: ${label})`);
}

function syncToggleState(input, stateLabel, enabled) {
  if (input) {
    input.checked = !!enabled;
    input.setAttribute('aria-checked', enabled ? 'true' : 'false');
    const controlShell = input.closest('.settings-toggle-control');
    if (controlShell) {
      controlShell.classList.toggle('is-active', !!enabled);
    }
  }
  if (stateLabel) {
    stateLabel.textContent = enabled ? 'On' : 'Off';
  }
}

function handleToggleChange(key, input, stateLabel) {
  settings[key] = !!input.checked;
  persistSettings();
  applySettingsToSimulation();
  syncToggleState(input, stateLabel, settings[key]);
}

function syncAllToggles() {
  syncToggleState(forceLinkToggle, forceLinkStateLabel, settings.renderForceLinks);
  syncToggleState(fusionEffectsToggle, fusionEffectsStateLabel, settings.renderFusionEffects);
  syncToggleState(spawnEffectsToggle, spawnEffectsStateLabel, settings.renderSpawnEffects);
}

/**
 * Wire DOM controls for the Tsadi spire options menu.
 */
export function bindTsadiSpireOptions() {
  graphicsLevelButton = document.getElementById('tsadi-graphics-level-button');
  pixelationLevelButton = document.getElementById('tsadi-pixelation-level-button');
  forceLinkToggle = document.getElementById('tsadi-force-links-toggle');
  fusionEffectsToggle = document.getElementById('tsadi-fusion-effects-toggle');
  spawnEffectsToggle = document.getElementById('tsadi-spawn-effects-toggle');
  forceLinkStateLabel = document.getElementById('tsadi-force-links-state');
  fusionEffectsStateLabel = document.getElementById('tsadi-fusion-effects-state');
  spawnEffectsStateLabel = document.getElementById('tsadi-spawn-effects-state');

  if (graphicsLevelButton) {
    graphicsLevelButton.addEventListener('click', cycleGraphicsLevel);
  }

  if (pixelationLevelButton) {
    pixelationLevelButton.addEventListener('click', cyclePixelationLevel);
  }

  if (forceLinkToggle) {
    forceLinkToggle.addEventListener('change', (event) => {
      handleToggleChange('renderForceLinks', event.target, forceLinkStateLabel);
    });
  }

  if (fusionEffectsToggle) {
    fusionEffectsToggle.addEventListener('change', (event) => {
      handleToggleChange('renderFusionEffects', event.target, fusionEffectsStateLabel);
    });
  }

  if (spawnEffectsToggle) {
    spawnEffectsToggle.addEventListener('change', (event) => {
      handleToggleChange('renderSpawnEffects', event.target, spawnEffectsStateLabel);
    });
  }

  syncGraphicsButton();
  syncPixelationButton();
  syncAllToggles();
}

/**
 * Initialize Tsadi visual settings and apply them to the simulation if available.
 */
export function initializeTsadiSpirePreferences() {
  loadSettings();
  applySettingsToSimulation();
  syncGraphicsButton();
  syncPixelationButton();
  syncAllToggles();
}

/**
 * Provide access to the active Tsadi particle fusion simulation instance.
 */
export function setTsadiSimulationGetter(getter) {
  simulationGetter = typeof getter === 'function' ? getter : () => null;
  applySettingsToSimulation();
}

/**
 * Expose the current settings for debugging or UI sync.
 */
export function getTsadiVisualSettings() {
  return { ...settings };
}
