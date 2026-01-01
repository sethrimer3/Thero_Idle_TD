/**
 * Manage Lamed spire visual effect preferences.
 * Provides controls for dust particles, trails, sun detail, splashes, shooting star trails, and spawn flashes.
 * Settings persist via localStorage and update the GravitySimulation in real time.
 */
import {
  writeStorage,
  readStorage,
  LAMED_VISUAL_SETTINGS_STORAGE_KEY,
} from './autoSave.js';

// Graphics quality levels for the Lamed spire simulation.
const LAMED_GRAPHICS_LEVELS = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

// Default settings when no preferences are stored.
const DEFAULT_LAMED_SETTINGS = Object.freeze({
  graphicsLevel: LAMED_GRAPHICS_LEVELS.HIGH,
  dustParticles: true,
  starTrails: true,
  sunDetail: true,
  sunSplashes: true,
  shootingStarTrails: true,
  spawnFlashes: true,
  renderSizeLevel: 2, // Default to Large (0=Small, 1=Medium, 2=Large)
});

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
      return LAMED_GRAPHICS_LEVELS.MEDIUM;
    }
  } catch (error) {
    console.warn('Lamed visual settings fell back to default graphics level detection.', error);
  }
  return null;
}

/**
 * Build a default settings object that respects device hints while staying user overridable.
 */
function createDefaultLamedSettings() {
  const defaults = { ...DEFAULT_LAMED_SETTINGS };
  const preferredLevel = detectPreferredGraphicsLevel();
  if (preferredLevel) {
    defaults.graphicsLevel = preferredLevel;
  }
  return defaults;
}

let lamedSettings = createDefaultLamedSettings();
let simulationGetter = () => null;
let optionsMenuOpen = false;

// DOM element references cached after binding.
let optionsToggleButton = null;
// Secondary toggle for the corner cog button on the Lamed spire render.
let optionsToggleButtonCorner = null;
let optionsMenu = null;
let graphicsLevelButton = null;
let dustParticlesToggle = null;
let starTrailsToggle = null;
let sunDetailToggle = null;
let sunSplashesToggle = null;
let shootingStarTrailsToggle = null;
let spawnFlashesToggle = null;
let renderSizeSelect = null;
let renderSizeRow = null;

/**
 * Retrieve the current graphics level label for the UI.
 */
function resolveGraphicsLevelLabel(level = lamedSettings.graphicsLevel) {
  switch (level) {
    case LAMED_GRAPHICS_LEVELS.LOW:
      return 'Low';
    case LAMED_GRAPHICS_LEVELS.MEDIUM:
      return 'Medium';
    default:
      return 'High';
  }
}

/**
 * Cycle through available graphics quality levels.
 */
function getNextGraphicsLevel(current) {
  const sequence = [LAMED_GRAPHICS_LEVELS.LOW, LAMED_GRAPHICS_LEVELS.MEDIUM, LAMED_GRAPHICS_LEVELS.HIGH];
  const index = sequence.indexOf(current);
  const nextIndex = index >= 0 ? (index + 1) % sequence.length : 0;
  return sequence[nextIndex];
}

/**
 * Apply all current settings to the active GravitySimulation instance.
 */
function applySettingsToSimulation() {
  const simulation = simulationGetter();
  if (!simulation) {
    return;
  }

  const isLow = lamedSettings.graphicsLevel === LAMED_GRAPHICS_LEVELS.LOW;
  const isMedium = lamedSettings.graphicsLevel === LAMED_GRAPHICS_LEVELS.MEDIUM;

  // Adjust dust particle population based on graphics level and toggle.
  if (!lamedSettings.dustParticles) {
    simulation.maxDustParticles = 0;
    simulation.desiredDustParticles = 0;
    simulation.dustParticles.length = 0;
  } else if (isLow) {
    simulation.maxDustParticles = 50;
    simulation.desiredDustParticles = 50;
  } else if (isMedium) {
    simulation.maxDustParticles = 100;
    simulation.desiredDustParticles = 100;
  } else {
    simulation.maxDustParticles = 200;
    simulation.desiredDustParticles = 200;
  }

  // Configure trail complexity.
  if (!lamedSettings.starTrails) {
    simulation.maxStarsWithTrails = 0;
  } else if (isLow) {
    simulation.maxStarsWithTrails = 10;
  } else if (isMedium) {
    simulation.maxStarsWithTrails = 25;
  } else {
    simulation.maxStarsWithTrails = 50;
  }

  // Configure sun surface detail (texture quality).
  if (simulation.sunSurfaceSettings) {
    if (!lamedSettings.sunDetail || isLow) {
      simulation.sunSurfaceSettings.sunspotDetailMix = 0.2;
      simulation.sunSurfaceSettings.coronaIntensity = 0.3;
      simulation.sunSurfaceSettings.limbDarkeningStrength = 0.15;
    } else if (isMedium) {
      simulation.sunSurfaceSettings.sunspotDetailMix = 0.4;
      simulation.sunSurfaceSettings.coronaIntensity = 0.5;
      simulation.sunSurfaceSettings.limbDarkeningStrength = 0.25;
    } else {
      simulation.sunSurfaceSettings.sunspotDetailMix = 0.55;
      simulation.sunSurfaceSettings.coronaIntensity = 0.65;
      simulation.sunSurfaceSettings.limbDarkeningStrength = 0.35;
    }
    simulation.surfaceTextureDirty = true;
  }

  // Configure geyser splash effects.
  if (simulation.visualEffectSettings) {
    const geyserSettings = simulation.visualEffectSettings.geyser;

    if (!lamedSettings.sunSplashes) {
      geyserSettings.particleCountMin = 0;
      geyserSettings.particleCountMax = 0;
    } else if (isLow) {
      geyserSettings.particleCountMin = 2;
      geyserSettings.particleCountMax = 4;
    } else if (isMedium) {
      geyserSettings.particleCountMin = 4;
      geyserSettings.particleCountMax = 8;
    } else {
      geyserSettings.particleCountMin = 6;
      geyserSettings.particleCountMax = 14;
    }
  }

  // Configure shooting star trail length.
  if (!lamedSettings.shootingStarTrails) {
    simulation.shootingStarTrailLength = 0;
  } else if (isLow) {
    simulation.shootingStarTrailLength = 20;
  } else if (isMedium) {
    simulation.shootingStarTrailLength = 40;
  } else {
    simulation.shootingStarTrailLength = 60;
  }

  // Track whether spawn flashes should render; the simulation checks this per-spawn.
  simulation.showSpawnFlashes = lamedSettings.spawnFlashes;

  // Downscale extremely dense canvases on high-DPI devices to protect mobile GPUs from overdraw.
  const targetMaxDpr = isLow ? 1.1 : isMedium ? 1.35 : 1.5;
  if (simulation.maxDevicePixelRatio !== targetMaxDpr) {
    simulation.maxDevicePixelRatio = targetMaxDpr;
    if (typeof simulation.resize === 'function') {
      simulation.resize();
    }
  }
}

/**
 * Persist the current settings to localStorage.
 */
function persistSettings() {
  try {
    writeStorage(LAMED_VISUAL_SETTINGS_STORAGE_KEY, JSON.stringify(lamedSettings));
  } catch (error) {
    console.warn('Failed to persist Lamed visual settings:', error);
  }
}

/**
 * Load persisted settings from localStorage.
 */
function loadPersistedSettings() {
  lamedSettings = createDefaultLamedSettings();
  try {
    const stored = readStorage(LAMED_VISUAL_SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      lamedSettings = { ...createDefaultLamedSettings(), ...parsed };
      lamedSettings.renderSizeLevel = normalizeRenderSizeLevel(parsed.renderSizeLevel);
    }
  } catch (error) {
    console.warn('Failed to load Lamed visual settings; using defaults:', error);
  }
}

/**
 * Update the graphics level button label to reflect the current setting.
 */
function updateGraphicsLevelButton() {
  if (!graphicsLevelButton) {
    return;
  }
  const label = resolveGraphicsLevelLabel();
  graphicsLevelButton.textContent = `Graphics · ${label}`;
  graphicsLevelButton.setAttribute('aria-label', `Cycle graphics quality (current: ${label})`);
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
  syncToggleState(
    dustParticlesToggle,
    document.getElementById('lamed-dust-toggle-state'),
    lamedSettings.dustParticles,
  );
  syncToggleState(
    starTrailsToggle,
    document.getElementById('lamed-trails-toggle-state'),
    lamedSettings.starTrails,
  );
  syncToggleState(
    sunDetailToggle,
    document.getElementById('lamed-sun-detail-toggle-state'),
    lamedSettings.sunDetail,
  );
  syncToggleState(
    sunSplashesToggle,
    document.getElementById('lamed-splashes-toggle-state'),
    lamedSettings.sunSplashes,
  );
  syncToggleState(
    shootingStarTrailsToggle,
    document.getElementById('lamed-shooting-trails-toggle-state'),
    lamedSettings.shootingStarTrails,
  );
  syncToggleState(
    spawnFlashesToggle,
    document.getElementById('lamed-flashes-toggle-state'),
    lamedSettings.spawnFlashes,
  );
  
  if (renderSizeSelect) {
    renderSizeSelect.value = String(normalizeRenderSizeLevel(lamedSettings.renderSizeLevel));
  }
}

/**
 * Determine if the Lamed menu should display inline vs as a popover.
 */
function shouldLamedMenuUseInlineDisplay() {
  const placementPreference = document.body?.dataset?.spireOptionsPlacement;
  return placementPreference === 'footer';
}

/**
 * Reposition the Lamed options menu based on which button is being used.
 */
function repositionLamedMenuForContext(clickedButton) {
  if (!optionsMenu || !clickedButton) {
    return;
  }
  
  const useInline = shouldLamedMenuUseInlineDisplay();
  const isCornerButton = clickedButton.classList.contains('spire-options-trigger--corner');
  const isFooterButton = clickedButton.classList.contains('spire-options-trigger--footer') || clickedButton.classList.contains('lamed-spire-options-trigger');
  
  console.log('repositionLamedMenuForContext:', { useInline, isCornerButton, isFooterButton, buttonId: clickedButton.id });
  
  if (useInline && isFooterButton) {
    // Move menu to footer card for inline display
    const footerCard = clickedButton.closest('.card, .lamed-spire-options-card');
    console.log('Footer card found:', footerCard?.className, 'contains menu:', footerCard?.contains(optionsMenu));
    if (footerCard && !footerCard.contains(optionsMenu)) {
      console.log('Moving Lamed menu to footer card');
      footerCard.appendChild(optionsMenu);
      optionsMenu.classList.remove('spire-options-menu--popover');
    }
  } else if (isCornerButton || !useInline) {
    // Move menu back to popover container for absolute positioning
    const popoverContainer = document.querySelector('.spire-options-popover--lamed');
    if (popoverContainer && !popoverContainer.contains(optionsMenu)) {
      console.log('Moving Lamed menu to popover container');
      popoverContainer.appendChild(optionsMenu);
      if (!optionsMenu.classList.contains('spire-options-menu--popover')) {
        optionsMenu.classList.add('spire-options-menu--popover');
      }
    }
  }
}

/**
 * Toggle the dropdown open/closed state with a smooth animation.
 */
function toggleOptionsMenu(event) {
  // Reposition menu based on which button was clicked
  if (event && event.currentTarget) {
    repositionLamedMenuForContext(event.currentTarget);
  }
  
  optionsMenuOpen = !optionsMenuOpen;
  if (optionsMenu) {
    optionsMenu.setAttribute('data-open', optionsMenuOpen ? 'true' : 'false');
    optionsMenu.setAttribute('aria-hidden', optionsMenuOpen ? 'false' : 'true');
    optionsMenu.hidden = !optionsMenuOpen;
    // Dynamically set max-height so CSS transitions work smoothly.
    if (optionsMenuOpen) {
      const useInline = shouldLamedMenuUseInlineDisplay();
      if (useInline) {
        optionsMenu.style.maxWidth = '100%';
      } else {
        optionsMenu.style.maxWidth = 'min(320px, calc(100vw - 48px))';
      }
      optionsMenu.style.maxHeight = `${optionsMenu.scrollHeight + 40}px`;
    } else {
      optionsMenu.style.maxHeight = '0';
    }
  }
  if (optionsToggleButton) {
    optionsToggleButton.setAttribute('aria-expanded', optionsMenuOpen ? 'true' : 'false');
  }
  if (optionsToggleButtonCorner) {
    optionsToggleButtonCorner.setAttribute('aria-expanded', optionsMenuOpen ? 'true' : 'false');
  }
}

/**
 * Apply a setting change, persist, and update the simulation.
 */
function applySetting(key, value) {
  lamedSettings[key] = value;
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
 * Apply the Lamed render size settings by offsetting the spire container.
 */
function applyRenderSizeLayout() {
  const lamedStage = document.getElementById('lamed-canvas');
  if (!lamedStage) {
    return;
  }

  const sizeLevel = normalizeRenderSizeLevel(lamedSettings.renderSizeLevel);
  const panel = lamedStage.closest('.panel');

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
  // Medium and Large should expand past panel padding to keep the spire centered.
  const inlineLeft = sizeLevel >= 1 ? panelPadding.left : 0;
  const inlineRight = sizeLevel >= 1 ? panelPadding.right : 0;
  const topOffset = sizeLevel >= 1 ? panelPadding.top : 0;

  lamedStage.dataset.sizeLevel = String(sizeLevel);
  lamedStage.style.setProperty('--lamed-size-inline-left', `${inlineLeft}px`);
  lamedStage.style.setProperty('--lamed-size-inline-right', `${inlineRight}px`);
  lamedStage.style.setProperty('--lamed-size-top', `${topOffset}px`);
}

/**
 * Bind all DOM elements and event listeners for the Lamed spire options panel.
 */
export function bindLamedSpireOptions() {
  optionsToggleButton = document.getElementById('lamed-options-toggle-button');
  optionsToggleButtonCorner = document.getElementById('lamed-spire-options-toggle-button');
  optionsMenu = document.getElementById('lamed-options-menu');
  graphicsLevelButton = document.getElementById('lamed-graphics-level-button');
  dustParticlesToggle = document.getElementById('lamed-dust-toggle');
  starTrailsToggle = document.getElementById('lamed-trails-toggle');
  sunDetailToggle = document.getElementById('lamed-sun-detail-toggle');
  sunSplashesToggle = document.getElementById('lamed-splashes-toggle');
  shootingStarTrailsToggle = document.getElementById('lamed-shooting-trails-toggle');
  spawnFlashesToggle = document.getElementById('lamed-flashes-toggle');
  renderSizeSelect = document.getElementById('lamed-render-size-select');
  renderSizeRow = document.getElementById('lamed-render-size-row');

  if (optionsToggleButton) {
    optionsToggleButton.addEventListener('click', toggleOptionsMenu);
  }
  // Allow the corner cog button to open the same Lamed options menu.
  if (optionsToggleButtonCorner) {
    optionsToggleButtonCorner.addEventListener('click', toggleOptionsMenu);
  }

  if (graphicsLevelButton) {
    graphicsLevelButton.addEventListener('click', () => {
      const next = getNextGraphicsLevel(lamedSettings.graphicsLevel);
      applySetting('graphicsLevel', next);
      updateGraphicsLevelButton();
    });
  }

  if (dustParticlesToggle) {
    dustParticlesToggle.addEventListener('change', (event) => {
      applySetting('dustParticles', event.target.checked);
      syncToggleState(dustParticlesToggle, document.getElementById('lamed-dust-toggle-state'), lamedSettings.dustParticles);
    });
  }

  if (starTrailsToggle) {
    starTrailsToggle.addEventListener('change', (event) => {
      applySetting('starTrails', event.target.checked);
      syncToggleState(starTrailsToggle, document.getElementById('lamed-trails-toggle-state'), lamedSettings.starTrails);
    });
  }

  if (sunDetailToggle) {
    sunDetailToggle.addEventListener('change', (event) => {
      applySetting('sunDetail', event.target.checked);
      syncToggleState(sunDetailToggle, document.getElementById('lamed-sun-detail-toggle-state'), lamedSettings.sunDetail);
    });
  }

  if (sunSplashesToggle) {
    sunSplashesToggle.addEventListener('change', (event) => {
      applySetting('sunSplashes', event.target.checked);
      syncToggleState(sunSplashesToggle, document.getElementById('lamed-splashes-toggle-state'), lamedSettings.sunSplashes);
    });
  }

  if (shootingStarTrailsToggle) {
    shootingStarTrailsToggle.addEventListener('change', (event) => {
      applySetting('shootingStarTrails', event.target.checked);
      syncToggleState(shootingStarTrailsToggle, document.getElementById('lamed-shooting-trails-toggle-state'), lamedSettings.shootingStarTrails);
    });
  }

  if (spawnFlashesToggle) {
    spawnFlashesToggle.addEventListener('change', (event) => {
      applySetting('spawnFlashes', event.target.checked);
      syncToggleState(spawnFlashesToggle, document.getElementById('lamed-flashes-toggle-state'), lamedSettings.spawnFlashes);
    });
  }

  if (renderSizeSelect) {
    renderSizeSelect.addEventListener('change', (event) => {
      lamedSettings.renderSizeLevel = normalizeRenderSizeLevel(event.target.value);
      persistSettings();
      syncAllToggles();
      applyRenderSizeLayout();
    });
  }

  // Sync UI with persisted settings.
  updateGraphicsLevelButton();
  syncAllToggles();
}

/**
 * Provide a getter so the module can access the active GravitySimulation instance.
 */
export function setLamedSimulationGetter(getter) {
  simulationGetter = typeof getter === 'function' ? getter : () => null;
}

/**
 * Initialize the Lamed visual settings, loading persisted values and applying them.
 */
export function initializeLamedSpirePreferences() {
  loadPersistedSettings();
  applySettingsToSimulation();
  applyRenderSizeLayout();
}

/**
 * Report the current settings object (useful for debugging or UI sync).
 */
export function getLamedVisualSettings() {
  return { ...lamedSettings };
}

/**
 * Programmatically apply a full settings object (e.g., from a save file).
 */
export function applyLamedVisualSettings(settings, { persist = true } = {}) {
  lamedSettings = { ...createDefaultLamedSettings(), ...settings };
  if (persist) {
    persistSettings();
  }
  applySettingsToSimulation();
  updateGraphicsLevelButton();
  syncAllToggles();
}

export { LAMED_GRAPHICS_LEVELS };

// Recalculate size offsets on viewport changes to keep the render aligned.
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    applyRenderSizeLayout();
  });
}
