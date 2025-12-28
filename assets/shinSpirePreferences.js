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
  panZoomEnabled: false,
  nightMode: true,
  enemyTrailQuality: TRAIL_QUALITY_OPTIONS.HIGH,
  bulletTrailLength: TRAIL_LENGTH_OPTIONS.LONG,
  renderSizeLevel: 2, // Default to Large (0=Small, 1=Medium, 2=Large)
});

let settings = { ...DEFAULT_SETTINGS };
let simulationGetter = () => null;

// DOM element references cached after binding.
let graphicsLevelButton = null;
let nightModeToggle = null;
let nightModeToggleState = null;
let enemyTrailQualityButton = null;
let bulletTrailLengthButton = null;
let renderSizeSelect = null;
let renderSizeRow = null;

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
    
    settings.renderSizeLevel = normalizeRenderSizeLevel(stored.renderSizeLevel);
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
  
  if (renderSizeSelect) {
    renderSizeSelect.value = String(normalizeRenderSizeLevel(settings.renderSizeLevel));
  }
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
 * Apply the Shin render size settings by offsetting the spire container.
 */
function applyRenderSizeLayout() {
  const shinStage = document.getElementById('shin-cardinal-canvas');
  if (!shinStage) {
    return;
  }

  const sizeLevel = normalizeRenderSizeLevel(settings.renderSizeLevel);
  const panel = shinStage.closest('.panel');
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

  shinStage.dataset.sizeLevel = String(sizeLevel);
  shinStage.style.setProperty('--shin-size-inline-left', `${inlineLeft}px`);
  shinStage.style.setProperty('--shin-size-inline-right', `${inlineRight}px`);
  shinStage.style.setProperty('--shin-size-top', `${topOffset}px`);
}

/**
 * Bind all DOM elements and event listeners for the Shin spire options panel.
 */
export function bindShinSpireOptions() {
  graphicsLevelButton = document.getElementById('shin-graphics-level-button');
  nightModeToggle = document.getElementById('shin-night-mode-toggle');
  nightModeToggleState = document.getElementById('shin-night-mode-toggle-state');
  renderSizeSelect = document.getElementById('shin-render-size-select');
  renderSizeRow = document.getElementById('shin-render-size-row');

  if (graphicsLevelButton) {
    graphicsLevelButton.addEventListener('click', cycleGraphicsLevel);
    syncGraphicsLevelButton();
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

  if (renderSizeSelect) {
    renderSizeSelect.addEventListener('change', (event) => {
      settings.renderSizeLevel = normalizeRenderSizeLevel(event.target.value);
      persistSettings();
      syncAllToggles();
      applyRenderSizeLayout();
    });
  }

  // Sync UI with persisted settings.
  syncGraphicsLevelButton();
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
  applyRenderSizeLayout();
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
  syncEnemyTrailQualityButton();
  syncBulletTrailLengthButton();
  syncAllToggles();
}

export { SHIN_GRAPHICS_LEVELS, TRAIL_LENGTH_OPTIONS, TRAIL_QUALITY_OPTIONS };

// Recalculate size offsets on viewport changes to keep the render aligned.
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    applyRenderSizeLayout();
  });
}
