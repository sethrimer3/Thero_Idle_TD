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
  smoothRendering: true, // Enable/disable image-smoothing for pixelated vs smooth rendering
  // Developer-only debug flags
  particleSpawning: true,
  particleMerging: true,
  particlePromotion: true,
  mergeShockwaves: true, // Developer toggle for merge burst shockwaves.
});

let settings = { ...DEFAULT_SETTINGS };

let particleTrailsToggle = null;
let particleTrailsStateLabel = null;
let forgeGlowToggle = null;
let forgeGlowStateLabel = null;
let smoothRenderingToggle = null;
let smoothRenderingStateLabel = null;
// Developer-only debug toggles
let particleSpawningToggle = null;
let particleSpawningStateLabel = null;
let particleMergingToggle = null;
let particleMergingStateLabel = null;
let particlePromotionToggle = null;
let particlePromotionStateLabel = null;
// Developer-only merge shockwave toggle elements.
let mergeShockwavesToggle = null;
let mergeShockwavesStateLabel = null;

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
  syncToggleState(smoothRenderingToggle, smoothRenderingStateLabel, settings.smoothRendering);
  // Developer-only toggles
  syncToggleState(particleSpawningToggle, particleSpawningStateLabel, settings.particleSpawning);
  syncToggleState(particleMergingToggle, particleMergingStateLabel, settings.particleMerging);
  syncToggleState(particlePromotionToggle, particlePromotionStateLabel, settings.particlePromotion);
  syncToggleState(mergeShockwavesToggle, mergeShockwavesStateLabel, settings.mergeShockwaves);
}

function applySettings() {
  const renderInstance = getBetSpireRenderInstance();
  if (renderInstance) {
    // The BetSpireRender instance will read these settings during its draw cycle
    renderInstance.particleTrailsEnabled = settings.particleTrails;
    renderInstance.forgeGlowEnabled = settings.forgeGlow;
    renderInstance.smoothRenderingEnabled = settings.smoothRendering;
    // Developer-only debug flags
    renderInstance.particleSpawningEnabled = settings.particleSpawning;
    renderInstance.particleMergingEnabled = settings.particleMerging;
    renderInstance.particlePromotionEnabled = settings.particlePromotion;
    renderInstance.mergeShockwavesEnabled = settings.mergeShockwaves;
    // Clear any lingering shockwaves when the merge burst toggle is disabled.
    if (!settings.mergeShockwaves) {
      renderInstance.shockwaves = [];
    }
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
  smoothRenderingToggle = document.getElementById('bet-smooth-rendering-toggle');
  smoothRenderingStateLabel = document.getElementById('bet-smooth-rendering-state');
  // Developer-only debug toggles
  particleSpawningToggle = document.getElementById('bet-particle-spawning-toggle');
  particleSpawningStateLabel = document.getElementById('bet-particle-spawning-state');
  particleMergingToggle = document.getElementById('bet-particle-merging-toggle');
  particleMergingStateLabel = document.getElementById('bet-particle-merging-state');
  particlePromotionToggle = document.getElementById('bet-particle-promotion-toggle');
  particlePromotionStateLabel = document.getElementById('bet-particle-promotion-state');
  mergeShockwavesToggle = document.getElementById('bet-merge-shockwaves-toggle');
  mergeShockwavesStateLabel = document.getElementById('bet-merge-shockwaves-state');

  bindToggle(particleTrailsToggle, particleTrailsStateLabel, 'particleTrails');
  bindToggle(forgeGlowToggle, forgeGlowStateLabel, 'forgeGlow');
  bindToggle(smoothRenderingToggle, smoothRenderingStateLabel, 'smoothRendering');
  // Developer-only debug toggles
  bindToggle(particleSpawningToggle, particleSpawningStateLabel, 'particleSpawning');
  bindToggle(particleMergingToggle, particleMergingStateLabel, 'particleMerging');
  bindToggle(particlePromotionToggle, particlePromotionStateLabel, 'particlePromotion');
  bindToggle(mergeShockwavesToggle, mergeShockwavesStateLabel, 'mergeShockwaves');

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

/**
 * Update visibility of developer-only debug controls based on developer mode state.
 */
export function updateBetSpireDebugControlsVisibility(isDeveloperModeActive) {
  const debugControls = [
    document.getElementById('bet-particle-spawning-toggle-row'),
    document.getElementById('bet-particle-merging-toggle-row'),
    document.getElementById('bet-particle-promotion-toggle-row'),
    document.getElementById('bet-merge-shockwaves-toggle-row'),
  ];
  
  debugControls.forEach(control => {
    if (control) {
      control.hidden = !isDeveloperModeActive;
      control.setAttribute('aria-hidden', isDeveloperModeActive ? 'false' : 'true');
    }
  });
}
