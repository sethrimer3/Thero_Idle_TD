/**
 * Manage Bet Spire particle rendering visual preferences.
 * Controls particle trails and forge/generator glow effects.
 */
import {
  readStorageJson,
  writeStorage,
  BET_SPIRE_VISUAL_SETTINGS_STORAGE_KEY,
} from './autoSave.js';

const DEFAULT_SETTINGS = Object.freeze({
  particleTrails: true,
  forgeGlow: true,
});

let settings = { ...DEFAULT_SETTINGS };

let particleTrailsToggle = null;
let particleTrailsStateLabel = null;
let forgeGlowToggle = null;
let forgeGlowStateLabel = null;

// Getter for the active BetSpireRender instance
let getBetSpireRenderInstance = () => null;

function persistSettings() {
  writeStorage(BET_SPIRE_VISUAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function loadSettings() {
  const stored = readStorageJson(BET_SPIRE_VISUAL_SETTINGS_STORAGE_KEY);
  if (stored && typeof stored === 'object') {
    settings = { ...DEFAULT_SETTINGS, ...stored };
  }
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
  syncToggleState(particleTrailsToggle, particleTrailsStateLabel, settings.particleTrails);
  syncToggleState(forgeGlowToggle, forgeGlowStateLabel, settings.forgeGlow);
}

function applySettings() {
  const renderInstance = getBetSpireRenderInstance();
  if (renderInstance) {
    // The BetSpireRender instance will read these settings during its draw cycle
    renderInstance.particleTrailsEnabled = settings.particleTrails;
    renderInstance.forgeGlowEnabled = settings.forgeGlow;
  }
}

function handleToggleChange(key, input, stateLabel) {
  settings[key] = !!input.checked;
  persistSettings();
  syncToggleState(input, stateLabel, settings[key]);
  applySettings();
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
 * Wire Bet spire particle option controls.
 */
export function bindBetSpireParticleOptions() {
  particleTrailsToggle = document.getElementById('bet-particle-trails-toggle');
  particleTrailsStateLabel = document.getElementById('bet-particle-trails-state');
  forgeGlowToggle = document.getElementById('bet-forge-glow-toggle');
  forgeGlowStateLabel = document.getElementById('bet-forge-glow-state');

  bindToggle(particleTrailsToggle, particleTrailsStateLabel, 'particleTrails');
  bindToggle(forgeGlowToggle, forgeGlowStateLabel, 'forgeGlow');

  syncAllToggles();
}

/**
 * Initialize Bet spire particle visual settings.
 */
export function initializeBetSpireParticlePreferences() {
  loadSettings();
  syncAllToggles();
  applySettings();
}

/**
 * Register getter for the BetSpireRender instance.
 */
export function setBetSpireRenderGetter(getter) {
  getBetSpireRenderInstance = typeof getter === 'function' ? getter : () => null;
  applySettings();
}

/**
 * Get the current visual settings.
 */
export function getBetSpireParticleSettings() {
  return { ...settings };
}

/**
 * Check if particle trails are enabled.
 */
export function areParticleTrailsEnabled() {
  return settings.particleTrails;
}

/**
 * Check if forge glow is enabled.
 */
export function isForgeGlowEnabled() {
  return settings.forgeGlow;
}
