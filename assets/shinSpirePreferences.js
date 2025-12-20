/**
 * Shin Spire visual preferences.
 * Players can adjust graphics quality for fractal rendering to improve performance on modest hardware.
 */
import { readStorageJson, writeStorage, SHIN_VISUAL_SETTINGS_STORAGE_KEY } from './autoSave.js';

// Graphics quality levels for the Shin spire fractal simulations.
const SHIN_GRAPHICS_LEVELS = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});
const PIXELATION_LEVELS = [0, 1, 2];
const PIXELATION_LABELS = ['None', 'Mild', 'Strong'];
const PIXELATION_SCALES = [1, 0.75, 0.5];

// Trail quality options for enemy trails in the Cardinal Warden simulation.
// Quality affects visual rendering complexity, not length (length is fixed for gameplay).
const TRAIL_QUALITY_OPTIONS = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

// Trail length options for bullet trails in the Cardinal Warden simulation.
const TRAIL_LENGTH_OPTIONS = Object.freeze({
  NONE: 'none',
  SHORT: 'short',
  MEDIUM: 'medium',
  LONG: 'long',
});

// Default settings when no preferences are stored.
const DEFAULT_SETTINGS = Object.freeze({
  graphicsLevel: SHIN_GRAPHICS_LEVELS.HIGH,
  pixelationLevel: 0,
  panZoomEnabled: false,
  nightMode: true,
  enemyTrailQuality: TRAIL_QUALITY_OPTIONS.HIGH,
  bulletTrailLength: TRAIL_LENGTH_OPTIONS.LONG,
});

let settings = { ...DEFAULT_SETTINGS };
let simulationGetter = () => null;

// DOM element references cached after binding.
let graphicsLevelButton = null;
let pixelationLevelButton = null;
let nightModeToggle = null;
let nightModeToggleState = null;
let enemyTrailQualityButton = null;
let bulletTrailLengthButton = null;

/**
 * Prefer a saner default graphics tier on mobile/high-DPI devices to reduce render cost out of the box.
 */
function detectPreferredGraphicsLevel() {
  try {
    const isMobileUserAgent =
      typeof navigator !== 'undefined'
      && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent || '');
    const highDevicePixelRatio = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) >= 2.5 : false;

    if (isMobileUserAgent || highDevicePixelRatio) {
      return SHIN_GRAPHICS_LEVELS.MEDIUM;
    }
  } catch (error) {
    console.warn('Shin visual settings fell back to default graphics level detection.', error);
  }
  return null;
}

/**
 * Build a default settings object that respects device hints while staying user overridable.
 */
function createDefaultShinSettings() {
  const defaults = { ...DEFAULT_SETTINGS };
  const preferredLevel = detectPreferredGraphicsLevel();
  if (preferredLevel) {
    defaults.graphicsLevel = preferredLevel;
  }
  return defaults;
}

/**
 * Persist the current settings to localStorage.
 */
function persistSettings() {
  writeStorage(SHIN_VISUAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

/**
 * Load persisted settings from localStorage.
 */
function loadSettings() {
  settings = createDefaultShinSettings();
  const stored = readStorageJson(SHIN_VISUAL_SETTINGS_STORAGE_KEY);
  if (stored && typeof stored === 'object') {
    settings = { ...createDefaultShinSettings(), ...stored };
    
    // Migrate old enemyTrailLength setting to enemyTrailQuality
    // If old setting exists and new one doesn't, convert length to quality
    if (stored.enemyTrailLength && !stored.enemyTrailQuality) {
      // Map old length values to quality values (always use high quality by default)
      settings.enemyTrailQuality = TRAIL_QUALITY_OPTIONS.HIGH;
    }
  }
}

/**
 * Apply all current settings to the active fractal simulation instance.
 */
function applySettingsToSimulation() {
  const simulation = simulationGetter();
  if (!simulation) {
    return;
  }

  const isLow = settings.graphicsLevel === SHIN_GRAPHICS_LEVELS.LOW;
  const isMedium = settings.graphicsLevel === SHIN_GRAPHICS_LEVELS.MEDIUM;

  // Adjust fractal rendering complexity based on graphics level.
  if (typeof simulation.updateConfig === 'function') {
    let growthRate = 3;
    let growthAnimationSpeed = 0.08;

    if (isLow) {
      growthRate = 8;
      growthAnimationSpeed = 0.2;
    } else if (isMedium) {
      growthRate = 5;
      growthAnimationSpeed = 0.12;
    }

    simulation.updateConfig({
      growthRate,
      growthAnimationSpeed,
    });
  }

  if (typeof simulation.setPixelationLevel === 'function') {
    simulation.setPixelationLevel(settings.pixelationLevel);
  }

  // Control pan/zoom if the simulation supports it.
  if (typeof simulation.setPanZoomEnabled === 'function') {
    simulation.setPanZoomEnabled(settings.panZoomEnabled);
  }

  // Control night mode palette for the danmaku renderer.
  if (typeof simulation.setNightMode === 'function') {
    simulation.setNightMode(settings.nightMode);
  }

  // Control enemy trail quality for the danmaku renderer.
  if (typeof simulation.setEnemyTrailQuality === 'function') {
    simulation.setEnemyTrailQuality(settings.enemyTrailQuality);
  }

  // Control bullet trail length for the danmaku renderer.
  if (typeof simulation.setBulletTrailLength === 'function') {
    simulation.setBulletTrailLength(settings.bulletTrailLength);
  }
}

/**
 * Cycle through available graphics quality levels.
 */
function cycleGraphicsLevel() {
  const sequence = [SHIN_GRAPHICS_LEVELS.LOW, SHIN_GRAPHICS_LEVELS.MEDIUM, SHIN_GRAPHICS_LEVELS.HIGH];
  const currentIndex = sequence.indexOf(settings.graphicsLevel);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % sequence.length : 0;
  settings.graphicsLevel = sequence[nextIndex];
  persistSettings();
  applySettingsToSimulation();
  syncGraphicsLevelButton();
}

function cyclePixelationLevel() {
  const currentIndex = PIXELATION_LEVELS.indexOf(Math.round(settings.pixelationLevel));
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % PIXELATION_LEVELS.length : 0;
  settings.pixelationLevel = PIXELATION_LEVELS[nextIndex];
  persistSettings();
  applySettingsToSimulation();
  syncPixelationButton();
}

/**
 * Retrieve the current graphics level label for the UI.
 */
function resolveGraphicsLevelLabel(level = settings.graphicsLevel) {
  switch (level) {
    case SHIN_GRAPHICS_LEVELS.LOW:
      return 'Low';
    case SHIN_GRAPHICS_LEVELS.MEDIUM:
      return 'Medium';
    default:
      return 'High';
  }
}

function resolvePixelationLabel(level = settings.pixelationLevel) {
  const index = Math.max(0, Math.min(PIXELATION_LEVELS.length - 1, Math.round(level)));
  return PIXELATION_LABELS[index] || PIXELATION_LABELS[0];
}

/**
 * Update the graphics level button label to reflect the current setting.
 */
function syncGraphicsLevelButton() {
  if (!graphicsLevelButton) {
    return;
  }
  const label = resolveGraphicsLevelLabel();
  graphicsLevelButton.textContent = `Graphics · ${label}`;
  graphicsLevelButton.setAttribute('aria-label', `Cycle graphics quality (current: ${label})`);
}

function syncPixelationButton() {
  if (!pixelationLevelButton) {
    return;
  }
  const label = resolvePixelationLabel();
  pixelationLevelButton.textContent = `Pixelation · ${label}`;
  pixelationLevelButton.setAttribute('aria-label', `Cycle pixelation level (current: ${label})`);
}

/**
 * Retrieve a human-readable label for a trail quality option.
 */
function resolveTrailQualityLabel(quality) {
  switch (quality) {
    case TRAIL_QUALITY_OPTIONS.LOW:
      return 'Low';
    case TRAIL_QUALITY_OPTIONS.MEDIUM:
      return 'Medium';
    case TRAIL_QUALITY_OPTIONS.HIGH:
      return 'High';
    default:
      return 'High';
  }
}

/**
 * Retrieve a human-readable label for a trail length option.
 */
function resolveTrailLengthLabel(length) {
  switch (length) {
    case TRAIL_LENGTH_OPTIONS.NONE:
      return 'None';
    case TRAIL_LENGTH_OPTIONS.SHORT:
      return 'Short';
    case TRAIL_LENGTH_OPTIONS.MEDIUM:
      return 'Medium';
    case TRAIL_LENGTH_OPTIONS.LONG:
      return 'Long';
    default:
      return 'Long';
  }
}

/**
 * Cycle through enemy trail quality options.
 */
function cycleEnemyTrailQuality() {
  const sequence = [TRAIL_QUALITY_OPTIONS.LOW, TRAIL_QUALITY_OPTIONS.MEDIUM, TRAIL_QUALITY_OPTIONS.HIGH];
  const currentIndex = sequence.indexOf(settings.enemyTrailQuality);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % sequence.length : 2;
  settings.enemyTrailQuality = sequence[nextIndex];
  persistSettings();
  applySettingsToSimulation();
  syncEnemyTrailQualityButton();
}

/**
 * Update the enemy trail quality button label to reflect the current setting.
 */
function syncEnemyTrailQualityButton() {
  if (!enemyTrailQualityButton) {
    return;
  }
  const label = resolveTrailQualityLabel(settings.enemyTrailQuality);
  enemyTrailQualityButton.textContent = `Enemy Trail Quality · ${label}`;
  enemyTrailQualityButton.setAttribute('aria-label', `Cycle enemy trail quality (current: ${label})`);
}

/**
 * Cycle through bullet trail length options.
 */
function cycleBulletTrailLength() {
  const sequence = [TRAIL_LENGTH_OPTIONS.NONE, TRAIL_LENGTH_OPTIONS.SHORT, TRAIL_LENGTH_OPTIONS.MEDIUM, TRAIL_LENGTH_OPTIONS.LONG];
  const currentIndex = sequence.indexOf(settings.bulletTrailLength);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % sequence.length : 3;
  settings.bulletTrailLength = sequence[nextIndex];
  persistSettings();
  applySettingsToSimulation();
  syncBulletTrailLengthButton();
}

/**
 * Update the bullet trail length button label to reflect the current setting.
 */
function syncBulletTrailLengthButton() {
  if (!bulletTrailLengthButton) {
    return;
  }
  const label = resolveTrailLengthLabel(settings.bulletTrailLength);
  bulletTrailLengthButton.textContent = `Bullet Trails · ${label}`;
  bulletTrailLengthButton.setAttribute('aria-label', `Cycle bullet trail length (current: ${label})`);
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
  syncToggleState(nightModeToggle, nightModeToggleState, settings.nightMode);
}

/**
 * Apply a setting change, persist, and update the simulation.
 */
function applySetting(key, value) {
  settings[key] = value;
  persistSettings();
  applySettingsToSimulation();
}

/**
 * Bind all DOM elements and event listeners for the Shin spire options panel.
 */
export function bindShinSpireOptions() {
  graphicsLevelButton = document.getElementById('shin-graphics-level-button');
  pixelationLevelButton = document.getElementById('shin-pixelation-level-button');
  nightModeToggle = document.getElementById('shin-night-mode-toggle');
  nightModeToggleState = document.getElementById('shin-night-mode-toggle-state');

  if (graphicsLevelButton) {
    graphicsLevelButton.addEventListener('click', cycleGraphicsLevel);
    syncGraphicsLevelButton();
  }

  if (pixelationLevelButton) {
    pixelationLevelButton.addEventListener('click', cyclePixelationLevel);
    syncPixelationButton();
  }

  if (nightModeToggle) {
    nightModeToggle.addEventListener('change', (event) => {
      applySetting('nightMode', event.target.checked);
      syncToggleState(nightModeToggle, nightModeToggleState, settings.nightMode);
    });
  }

  enemyTrailQualityButton = document.getElementById('shin-enemy-trail-quality-button');
  bulletTrailLengthButton = document.getElementById('shin-bullet-trail-length-button');

  if (enemyTrailQualityButton) {
    enemyTrailQualityButton.addEventListener('click', cycleEnemyTrailQuality);
    syncEnemyTrailQualityButton();
  }

  if (bulletTrailLengthButton) {
    bulletTrailLengthButton.addEventListener('click', cycleBulletTrailLength);
    syncBulletTrailLengthButton();
  }

  // Sync UI with persisted settings.
  syncGraphicsLevelButton();
  syncPixelationButton();
  syncEnemyTrailQualityButton();
  syncBulletTrailLengthButton();
  syncAllToggles();
}

/**
 * Provide a getter so the module can access the active fractal simulation instance.
 */
export function setShinSimulationGetter(getter) {
  simulationGetter = typeof getter === 'function' ? getter : () => null;
  applySettingsToSimulation();
}

/**
 * Initialize the Shin visual settings, loading persisted values and applying them.
 */
export function initializeShinSpirePreferences() {
  loadSettings();
  applySettingsToSimulation();
}

/**
 * Report the current settings object (useful for debugging or UI sync).
 */
export function getShinVisualSettings() {
  return { ...settings };
}

/**
 * Programmatically apply a full settings object (e.g., from a save file).
 */
export function applyShinVisualSettings(newSettings, { persist = true } = {}) {
  settings = { ...createDefaultShinSettings(), ...newSettings };
  if (persist) {
    persistSettings();
  }
  applySettingsToSimulation();
  syncGraphicsLevelButton();
  syncPixelationButton();
  syncEnemyTrailQualityButton();
  syncBulletTrailLengthButton();
  syncAllToggles();
}

export function getShinPixelationScale() {
  const index = Math.max(0, Math.min(PIXELATION_SCALES.length - 1, Math.round(settings.pixelationLevel)));
  return PIXELATION_SCALES[index];
}

export { SHIN_GRAPHICS_LEVELS, TRAIL_LENGTH_OPTIONS, TRAIL_QUALITY_OPTIONS };
