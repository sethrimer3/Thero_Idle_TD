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

const DEFAULT_SETTINGS = Object.freeze({
  graphicsLevel: TSADI_GRAPHICS_LEVELS.HIGH,
  renderForceLinks: true,
  renderFusionEffects: true,
  renderSpawnEffects: true,
  smoothRendering: true,
  renderSizeLevel: 1, // Default to Medium (0=Small, 1=Medium, 2=Large)
});

let settings = { ...DEFAULT_SETTINGS };
let simulationGetter = () => null;

let graphicsLevelButton = null;
let forceLinkToggle = null;
let fusionEffectsToggle = null;
let spawnEffectsToggle = null;
let smoothRenderingToggle = null;
let forceLinkStateLabel = null;
let fusionEffectsStateLabel = null;
let spawnEffectsStateLabel = null;
let smoothRenderingStateLabel = null;
let renderSizeSelect = null;
let renderSizeRow = null;

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
    settings.renderSizeLevel = normalizeRenderSizeLevel(stored.renderSizeLevel);
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
    renderForceLinks: settings.renderForceLinks,
    renderFusionEffects: settings.renderFusionEffects,
    renderSpawnEffects: settings.renderSpawnEffects,
    smoothRendering: settings.smoothRendering,
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

function cycleGraphicsLevel() {
  const sequence = [TSADI_GRAPHICS_LEVELS.LOW, TSADI_GRAPHICS_LEVELS.MEDIUM, TSADI_GRAPHICS_LEVELS.HIGH];
  const index = sequence.indexOf(settings.graphicsLevel);
  const nextIndex = index >= 0 ? (index + 1) % sequence.length : 0;
  settings.graphicsLevel = sequence[nextIndex];
  persistSettings();
  applySettingsToSimulation();
  syncGraphicsButton();
}

function syncGraphicsButton() {
  if (!graphicsLevelButton) {
    return;
  }
  const label = resolveGraphicsLabel();
  graphicsLevelButton.textContent = `Graphics · ${label}`;
  graphicsLevelButton.setAttribute('aria-label', `Cycle Tsadi fusion graphics quality (current: ${label})`);
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
  syncToggleState(smoothRenderingToggle, smoothRenderingStateLabel, settings.smoothRendering);
  
  if (renderSizeSelect) {
    renderSizeSelect.value = String(normalizeRenderSizeLevel(settings.renderSizeLevel));
  }
}

/**
 * Normalize the render size level to a safe 0-2 range.
 */
function normalizeRenderSizeLevel(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 1; // Default to Medium if invalid
  }
  return Math.min(2, Math.max(0, parsed));
}

/**
 * Apply the Tsadi render size settings by offsetting the spire container.
 */
function applyRenderSizeLayout() {
  const tsadiStage = document.getElementById('tsadi-canvas');
  if (!tsadiStage) {
    return;
  }

  const sizeLevel = normalizeRenderSizeLevel(settings.renderSizeLevel);
  const panel = tsadiStage.closest('.panel');
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
  const inlineLeft = (sizeLevel >= 2 ? panelPadding.left : 0) + (sizeLevel >= 3 ? shellPadding.left : 0);
  const inlineRight = (sizeLevel >= 2 ? panelPadding.right : 0) + (sizeLevel >= 3 ? shellPadding.right : 0);
  const topOffset = (sizeLevel >= 2 ? panelPadding.top : 0) + (sizeLevel >= 3 ? shellPadding.top : 0);

  tsadiStage.dataset.sizeLevel = String(sizeLevel);
  tsadiStage.style.setProperty('--tsadi-size-inline-left', `${inlineLeft}px`);
  tsadiStage.style.setProperty('--tsadi-size-inline-right', `${inlineRight}px`);
  tsadiStage.style.setProperty('--tsadi-size-top', `${topOffset}px`);
}

/**
 * Wire DOM controls for the Tsadi spire options menu.
 */
export function bindTsadiSpireOptions() {
  graphicsLevelButton = document.getElementById('tsadi-graphics-level-button');
  forceLinkToggle = document.getElementById('tsadi-force-links-toggle');
  fusionEffectsToggle = document.getElementById('tsadi-fusion-effects-toggle');
  spawnEffectsToggle = document.getElementById('tsadi-spawn-effects-toggle');
  smoothRenderingToggle = document.getElementById('tsadi-smooth-rendering-toggle');
  forceLinkStateLabel = document.getElementById('tsadi-force-links-state');
  fusionEffectsStateLabel = document.getElementById('tsadi-fusion-effects-state');
  spawnEffectsStateLabel = document.getElementById('tsadi-spawn-effects-state');
  smoothRenderingStateLabel = document.getElementById('tsadi-smooth-rendering-state');
  renderSizeSelect = document.getElementById('tsadi-render-size-select');
  renderSizeRow = document.getElementById('tsadi-render-size-row');

  if (graphicsLevelButton) {
    graphicsLevelButton.addEventListener('click', cycleGraphicsLevel);
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

  if (smoothRenderingToggle) {
    smoothRenderingToggle.addEventListener('change', (event) => {
      handleToggleChange('smoothRendering', event.target, smoothRenderingStateLabel);
    });
  }

  if (renderSizeSelect) {
    renderSizeSelect.addEventListener('change', (event) => {
      settings.renderSizeLevel = normalizeRenderSizeLevel(event.target.value);
      persistSettings();
      syncAllToggles();
      applyRenderSizeLayout();
    });
  }

  syncGraphicsButton();
  syncAllToggles();
}

/**
 * Initialize Tsadi visual settings and apply them to the simulation if available.
 */
export function initializeTsadiSpirePreferences() {
  loadSettings();
  applySettingsToSimulation();
  applyRenderSizeLayout();
  syncGraphicsButton();
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

// Recalculate size offsets on viewport changes to keep the render aligned.
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    applyRenderSizeLayout();
  });
}
