/**
 * Manage Bet (fluid) spire terrarium visual preferences.
 * Exposes graphics presets and toggles for ambient overlays so the terrarium can scale down on lower-end devices.
 */
import {
  readStorageJson,
  writeStorage,
  FLUID_VISUAL_SETTINGS_STORAGE_KEY,
} from './autoSave.js';

export const FLUID_GRAPHICS_LEVELS = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

const DEFAULT_SETTINGS = Object.freeze({
  graphicsLevel: FLUID_GRAPHICS_LEVELS.HIGH,
  ambientCreatures: true,
  grassSway: true,
  skyCycle: true,
  crystalBloom: true,
  shroomSpores: true,
});

let settings = { ...DEFAULT_SETTINGS };

const terrariumGetters = {
  getCreatures: () => null,
  getGrass: () => null,
  getSkyCycle: () => null,
  getCrystal: () => null,
  getShrooms: () => null,
};

let graphicsButton = null;
let creaturesToggle = null;
let creaturesStateLabel = null;
let grassToggle = null;
let grassStateLabel = null;
let skyToggle = null;
let skyStateLabel = null;
let crystalToggle = null;
let crystalStateLabel = null;
let shroomToggle = null;
let shroomStateLabel = null;

function persistSettings() {
  writeStorage(FLUID_VISUAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function loadSettings() {
  const stored = readStorageJson(FLUID_VISUAL_SETTINGS_STORAGE_KEY);
  if (stored && typeof stored === 'object') {
    settings = { ...DEFAULT_SETTINGS, ...stored };
  }
}

function setElementVisibility(element, enabled) {
  if (!element) {
    return;
  }
  element.hidden = !enabled;
  element.style.display = enabled ? '' : 'none';
}

function applySkyState(enabled, skyCycle) {
  if (!skyCycle) {
    return;
  }
  if (enabled) {
    skyCycle.start?.();
  } else {
    skyCycle.stop?.();
    skyCycle.applySkyState?.(0.82);
  }
}

function applyShroomVisibility(enabled, shrooms) {
  if (!shrooms) {
    return;
  }
  setElementVisibility(shrooms.layer, enabled);
  setElementVisibility(shrooms.sporeLayer, enabled);
  if (enabled) {
    shrooms.start?.();
  } else {
    shrooms.stop?.();
  }
}

/**
 * Apply the current visual settings to every Bet terrarium overlay.
 */
export function applyFluidVisualSettings() {
  const creatures = terrariumGetters.getCreatures();
  if (creatures) {
    setElementVisibility(creatures.layer, settings.ambientCreatures);
    if (settings.ambientCreatures) {
      creatures.start?.();
    } else {
      creatures.stop?.();
    }
  }

  const grass = terrariumGetters.getGrass();
  if (grass) {
    setElementVisibility(grass.canvas, settings.grassSway);
    if (settings.grassSway) {
      grass.start?.();
    } else {
      grass.stop?.();
    }
  }

  const skyCycle = terrariumGetters.getSkyCycle();
  setElementVisibility(skyCycle?.skyElement, settings.skyCycle);
  applySkyState(settings.skyCycle, skyCycle);

  const crystal = terrariumGetters.getCrystal();
  if (crystal) {
    setElementVisibility(crystal.canvas, settings.crystalBloom);
    if (settings.crystalBloom) {
      crystal.start?.();
    } else {
      crystal.stop?.();
    }
  }

  const shrooms = terrariumGetters.getShrooms();
  applyShroomVisibility(settings.shroomSpores, shrooms);
}

function resolveGraphicsLabel(level = settings.graphicsLevel) {
  switch (level) {
    case FLUID_GRAPHICS_LEVELS.LOW:
      return 'Low';
    case FLUID_GRAPHICS_LEVELS.MEDIUM:
      return 'Medium';
    default:
      return 'High';
  }
}

function syncGraphicsButton() {
  if (!graphicsButton) {
    return;
  }
  const label = resolveGraphicsLabel();
  graphicsButton.textContent = `Graphics · ${label}`;
  graphicsButton.setAttribute('aria-label', `Cycle Bet terrarium graphics quality (current: ${label})`);
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

function syncAllToggles() {
  syncToggleState(creaturesToggle, creaturesStateLabel, settings.ambientCreatures);
  syncToggleState(grassToggle, grassStateLabel, settings.grassSway);
  syncToggleState(skyToggle, skyStateLabel, settings.skyCycle);
  syncToggleState(crystalToggle, crystalStateLabel, settings.crystalBloom);
  syncToggleState(shroomToggle, shroomStateLabel, settings.shroomSpores);
}

function applyGraphicsPreset(level) {
  settings.graphicsLevel = level;
  if (level === FLUID_GRAPHICS_LEVELS.LOW) {
    settings.ambientCreatures = false;
    settings.grassSway = false;
    settings.skyCycle = false;
    settings.crystalBloom = false;
    settings.shroomSpores = false;
  } else if (level === FLUID_GRAPHICS_LEVELS.MEDIUM) {
    settings.ambientCreatures = true;
    settings.grassSway = true;
    settings.skyCycle = true;
    settings.crystalBloom = false;
    settings.shroomSpores = false;
  } else {
    settings.ambientCreatures = true;
    settings.grassSway = true;
    settings.skyCycle = true;
    settings.crystalBloom = true;
    settings.shroomSpores = true;
  }
  persistSettings();
  syncGraphicsButton();
  syncAllToggles();
  applyFluidVisualSettings();
}

function cycleGraphicsPreset() {
  const sequence = [FLUID_GRAPHICS_LEVELS.LOW, FLUID_GRAPHICS_LEVELS.MEDIUM, FLUID_GRAPHICS_LEVELS.HIGH];
  const index = sequence.indexOf(settings.graphicsLevel);
  const nextIndex = index >= 0 ? (index + 1) % sequence.length : 0;
  applyGraphicsPreset(sequence[nextIndex]);
}

function handleToggleChange(key, input, stateLabel) {
  settings[key] = !!input.checked;
  persistSettings();
  syncToggleState(input, stateLabel, settings[key]);
  applyFluidVisualSettings();
}

function bindToggle(input, stateLabel, key) {
  if (!input) {
    return;
  }
  input.addEventListener('change', (event) => {
    handleToggleChange(key, event.target, stateLabel);
  });
}

/**
 * Wire Bet spire option controls for terrarium visual toggles.
 */
export function bindFluidSpireOptions() {
  graphicsButton = document.getElementById('fluid-graphics-level-button');
  creaturesToggle = document.getElementById('fluid-creatures-toggle');
  creaturesStateLabel = document.getElementById('fluid-creatures-state');
  grassToggle = document.getElementById('fluid-grass-toggle');
  grassStateLabel = document.getElementById('fluid-grass-state');
  skyToggle = document.getElementById('fluid-sky-toggle');
  skyStateLabel = document.getElementById('fluid-sky-state');
  crystalToggle = document.getElementById('fluid-crystal-toggle');
  crystalStateLabel = document.getElementById('fluid-crystal-state');
  shroomToggle = document.getElementById('fluid-shrooms-toggle');
  shroomStateLabel = document.getElementById('fluid-shrooms-state');

  if (graphicsButton) {
    graphicsButton.addEventListener('click', cycleGraphicsPreset);
  }

  bindToggle(creaturesToggle, creaturesStateLabel, 'ambientCreatures');
  bindToggle(grassToggle, grassStateLabel, 'grassSway');
  bindToggle(skyToggle, skyStateLabel, 'skyCycle');
  bindToggle(crystalToggle, crystalStateLabel, 'crystalBloom');
  bindToggle(shroomToggle, shroomStateLabel, 'shroomSpores');

  syncGraphicsButton();
  syncAllToggles();
}

/**
 * Initialize Bet spire visual settings.
 */
export function initializeFluidSpirePreferences() {
  loadSettings();
  syncGraphicsButton();
  syncAllToggles();
  applyFluidVisualSettings();
}

/**
 * Register getters that expose live terrarium overlay instances.
 */
export function setFluidTerrariumGetters(getters = {}) {
  terrariumGetters.getCreatures = typeof getters.getCreatures === 'function' ? getters.getCreatures : () => null;
  terrariumGetters.getGrass = typeof getters.getGrass === 'function' ? getters.getGrass : () => null;
  terrariumGetters.getSkyCycle = typeof getters.getSkyCycle === 'function' ? getters.getSkyCycle : () => null;
  terrariumGetters.getCrystal = typeof getters.getCrystal === 'function' ? getters.getCrystal : () => null;
  terrariumGetters.getShrooms = typeof getters.getShrooms === 'function' ? getters.getShrooms : () => null;
  applyFluidVisualSettings();
}

export function getFluidVisualSettings() {
  return { ...settings };
}
