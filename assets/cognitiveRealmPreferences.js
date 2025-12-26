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
  renderOverlapLevel: 1, // Default to Medium (overlap 1 margin)
});

// Clamp render size controls to 0-2 range (Small, Medium, Large).
const MAX_RENDER_OVERLAP_LEVEL = 2;

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
let renderOverlapSelect = null;
let renderOverlapRow = null;

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
    settings.renderOverlapLevel = normalizeRenderOverlapLevel(stored.renderOverlapLevel);
  }
  // Remove deprecated parallax settings now that the effect is disabled.
  delete settings.parallaxLayers;
}

// Normalize the render size level to a safe 0-2 range.
function normalizeRenderOverlapLevel(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 1; // Default to Medium if invalid
  }
  return Math.min(MAX_RENDER_OVERLAP_LEVEL, Math.max(0, parsed));
}

// Apply the Cognitive Realm render size settings by offsetting the container.
function applyRenderOverlapLayout() {
  const cognitiveRealmSection = document.getElementById('cognitive-realm-section');
  if (!cognitiveRealmSection) {
    return;
  }

  const overlapLevel = normalizeRenderOverlapLevel(settings.renderOverlapLevel);
  const panel = cognitiveRealmSection.closest('.panel');
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

  cognitiveRealmSection.dataset.overlapLevel = String(overlapLevel);
  cognitiveRealmSection.style.setProperty('--cognitive-realm-overlap-inline-left', `${inlineLeft}px`);
  cognitiveRealmSection.style.setProperty('--cognitive-realm-overlap-inline-right', `${inlineRight}px`);
  cognitiveRealmSection.style.setProperty('--cognitive-realm-overlap-top', `${topOffset}px`);
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
  
  if (renderOverlapSelect) {
    renderOverlapSelect.value = String(normalizeRenderOverlapLevel(settings.renderOverlapLevel));
  }
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

  renderOverlapSelect = document.getElementById('cognitive-realm-render-size-select');
  renderOverlapRow = document.getElementById('cognitive-realm-render-size-row');

  if (renderOverlapSelect) {
    renderOverlapSelect.addEventListener('change', (event) => {
      settings.renderOverlapLevel = normalizeRenderOverlapLevel(event.target.value);
      persistSettings();
      syncAllToggles();
      applyRenderOverlapLayout();
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
  applyRenderOverlapLayout();
}

// Recalculate overlap offsets on viewport changes to keep the render aligned.
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    applyRenderOverlapLayout();
  });
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
