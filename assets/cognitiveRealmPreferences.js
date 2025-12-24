/**
 * Cognitive Realm visual preferences.
 * Players can adjust visual settings for the collective unconscious map to improve performance
 * or customize the experience to their taste.
 */
import { readStorageJson, writeStorage, COGNITIVE_REALM_VISUAL_SETTINGS_KEY } from './autoSave.js';

// Default settings when no preferences are stored.
const DEFAULT_SETTINGS = Object.freeze({
  neuronConnections: true,
  neuronPulses: true,
  ambientParticles: true,
  glow: false,
  nodeDrift: false,
  randomizedLayout: true, // Scatter nodes to new starting positions on load
});

let settings = { ...DEFAULT_SETTINGS };

// DOM element references cached after binding
let neuronConnectionsToggle = null;
let neuronConnectionsState = null;
let neuronPulsesToggle = null;
let neuronPulsesState = null;
let ambientParticlesToggle = null;
let ambientParticlesState = null;
let nodeDriftToggle = null;
let nodeDriftState = null;
let randomizedLayoutToggle = null;
let randomizedLayoutState = null;

/**
 * Persist the current settings to localStorage.
 */
function persistSettings() {
  writeStorage(COGNITIVE_REALM_VISUAL_SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Load persisted settings from localStorage.
 */
function loadSettings() {
  settings = { ...DEFAULT_SETTINGS };
  const stored = readStorageJson(COGNITIVE_REALM_VISUAL_SETTINGS_KEY);
  if (stored && typeof stored === 'object') {
    settings = { ...DEFAULT_SETTINGS, ...stored };
  }
  // Remove deprecated parallax settings now that the effect is disabled.
  delete settings.parallaxLayers;
}

/**
 * Synchronize a toggle input's checked state with the underlying setting.
 */
function syncToggleState(input, stateLabel, enabled) {
  if (input) {
    input.checked = enabled;
    input.setAttribute('aria-checked', enabled ? 'true' : 'false');
    const controlShell = input.closest('.settings-toggle-control');
    if (controlShell) {
      controlShell.classList.toggle('is-active', enabled);
    }
  }
  if (stateLabel) {
    stateLabel.textContent = enabled ? 'On' : 'Off';
  }
}

/**
 * Refresh all toggle UI elements from the current settings state.
 */
function syncAllToggles() {
  syncToggleState(neuronConnectionsToggle, neuronConnectionsState, settings.neuronConnections);
  syncToggleState(neuronPulsesToggle, neuronPulsesState, settings.neuronPulses);
  syncToggleState(ambientParticlesToggle, ambientParticlesState, settings.ambientParticles);
  syncToggleState(nodeDriftToggle, nodeDriftState, settings.nodeDrift);
  syncToggleState(randomizedLayoutToggle, randomizedLayoutState, settings.randomizedLayout);
}

/**
 * Apply a setting change and persist.
 */
function applySetting(key, value) {
  settings[key] = value;
  persistSettings();
}

/**
 * Bind all DOM elements and event listeners for the cognitive realm options panel.
 */
export function bindCognitiveRealmOptions() {
  neuronConnectionsToggle = document.getElementById('cognitive-realm-neuron-connections-toggle');
  neuronConnectionsState = document.getElementById('cognitive-realm-neuron-connections-state');
  neuronPulsesToggle = document.getElementById('cognitive-realm-neuron-pulses-toggle');
  neuronPulsesState = document.getElementById('cognitive-realm-neuron-pulses-state');
  ambientParticlesToggle = document.getElementById('cognitive-realm-ambient-particles-toggle');
  ambientParticlesState = document.getElementById('cognitive-realm-ambient-particles-state');
  nodeDriftToggle = document.getElementById('cognitive-realm-node-drift-toggle');
  nodeDriftState = document.getElementById('cognitive-realm-node-drift-state');
  randomizedLayoutToggle = document.getElementById('cognitive-realm-randomized-layout-toggle');
  randomizedLayoutState = document.getElementById('cognitive-realm-randomized-layout-state');

  if (neuronConnectionsToggle) {
    neuronConnectionsToggle.addEventListener('change', (event) => {
      applySetting('neuronConnections', event.target.checked);
      syncToggleState(neuronConnectionsToggle, neuronConnectionsState, settings.neuronConnections);
    });
  }

  if (neuronPulsesToggle) {
    neuronPulsesToggle.addEventListener('change', (event) => {
      applySetting('neuronPulses', event.target.checked);
      syncToggleState(neuronPulsesToggle, neuronPulsesState, settings.neuronPulses);
    });
  }

  if (ambientParticlesToggle) {
    ambientParticlesToggle.addEventListener('change', (event) => {
      applySetting('ambientParticles', event.target.checked);
      syncToggleState(ambientParticlesToggle, ambientParticlesState, settings.ambientParticles);
    });
  }

  if (nodeDriftToggle) {
    nodeDriftToggle.addEventListener('change', (event) => {
      applySetting('nodeDrift', event.target.checked);
      syncToggleState(nodeDriftToggle, nodeDriftState, settings.nodeDrift);
    });
  }

  if (randomizedLayoutToggle) {
    randomizedLayoutToggle.addEventListener('change', (event) => {
      applySetting('randomizedLayout', event.target.checked);
      syncToggleState(randomizedLayoutToggle, randomizedLayoutState, settings.randomizedLayout);
    });
  }

  // Sync UI with persisted settings
  syncAllToggles();
}

/**
 * Initialize the cognitive realm visual settings, loading persisted values.
 */
export function initializeCognitiveRealmPreferences() {
  loadSettings();
}

/**
 * Report the current settings object (useful for rendering decisions).
 */
export function getCognitiveRealmVisualSettings() {
  return { ...settings };
}

/**
 * Programmatically apply a full settings object (e.g., from a save file).
 */
export function applyCognitiveRealmVisualSettings(newSettings, { persist = true } = {}) {
  settings = { ...DEFAULT_SETTINGS, ...newSettings };
  // Drop deprecated parallax settings if an older save still includes them.
  delete settings.parallaxLayers;
  if (persist) {
    persistSettings();
  }
  syncAllToggles();
}
