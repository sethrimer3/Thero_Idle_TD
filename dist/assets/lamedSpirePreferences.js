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
// Format large star counts for the Lamed star density slider label.
import { formatWholeNumber } from '../scripts/core/formatting.js';

// Graphics quality levels for the Lamed spire simulation.
const LAMED_GRAPHICS_LEVELS = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

// Clamp the Lamed star render slider to a performance-friendly range.
const LAMED_STAR_RENDER_MIN = 1000;
const LAMED_STAR_RENDER_MAX = 10000;

// Default settings when no preferences are stored.
const DEFAULT_LAMED_SETTINGS = Object.freeze({
  graphicsLevel: LAMED_GRAPHICS_LEVELS.HIGH,
  dustParticles: true,
  starTrails: true,
  sunDetail: true,
  sunSplashes: true,
  shootingStarTrails: true,
  spawnFlashes: true,
  backgroundStars: true,
  // Default star render cap aligns with the new minimum slider value.
  starRenderCap: LAMED_STAR_RENDER_MIN,
  renderSizeLevel: 0, // Fixed to Small
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
let bgStarsToggle = null;
// Slider controls for choosing how many stars render in the Lamed spire.
let starRenderSlider = null;
let starRenderValueLabel = null;

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

  // Enable or disable the parallax background starfield.
  simulation.showBackgroundStars = lamedSettings.backgroundStars;

  // Update the star render cap so density reflects the player's slider choice.
  if (typeof simulation.setStarRenderCap === 'function') {
    simulation.setStarRenderCap(lamedSettings.starRenderCap);
  } else {
    simulation.maxStars = clampStarRenderCap(lamedSettings.starRenderCap);
  }

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
      lamedSettings.renderSizeLevel = 0; // Always small
    }
  } catch (error) {
    console.warn('Failed to load Lamed visual settings; using defaults:', error);
  }
  // Always clamp the star cap so stored data cannot exceed the slider bounds.
  lamedSettings.starRenderCap = clampStarRenderCap(lamedSettings.starRenderCap);
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
  syncToggleState(
    bgStarsToggle,
    document.getElementById('lamed-bg-stars-toggle-state'),
    lamedSettings.backgroundStars,
  );
  // Keep the star density slider synced with the saved setting.
  syncStarRenderSlider();
}

/**
 * Clamp the star render slider value to the supported bounds.
 */
function clampStarRenderCap(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) {
    return LAMED_STAR_RENDER_MIN;
  }
  return Math.max(LAMED_STAR_RENDER_MIN, Math.min(LAMED_STAR_RENDER_MAX, Math.floor(raw)));
}

/**
 * Update the numeric label shown beside the star render slider.
 */
function updateStarRenderLabel(value) {
  if (!starRenderValueLabel) {
    return;
  }
  starRenderValueLabel.textContent = formatWholeNumber(value);
}

/**
 * Sync the Lamed star render slider to the persisted settings.
 */
function syncStarRenderSlider() {
  if (!starRenderSlider) {
    return;
  }
  const clamped = clampStarRenderCap(lamedSettings.starRenderCap);
  starRenderSlider.value = String(clamped);
  updateStarRenderLabel(clamped);
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
 * Returns the container element after repositioning.
 */
function repositionLamedMenuForContext(clickedButton) {
  if (!optionsMenu || !clickedButton) {
    return null;
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
    return footerCard;
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
    return popoverContainer;
  }
  
  // Fallback: return current container
  return optionsMenu.closest('.spire-options-popover, .lamed-spire-options-card');
}

/**
 * Toggle the dropdown open/closed state with a smooth animation.
 */
function toggleOptionsMenu(event) {
  // Reposition menu based on which button was clicked and get the container
  let container = null;
  if (event && event.currentTarget) {
    container = repositionLamedMenuForContext(event.currentTarget);
  }
  // Fallback to finding container if repositioning didn't return one
  if (!container && optionsMenu) {
    container = optionsMenu.closest('.spire-options-popover, .lamed-spire-options-card');
  }
  
  optionsMenuOpen = !optionsMenuOpen;
  
  // Toggle options-open class on container for animation
  if (container) {
    container.classList.toggle('options-open', optionsMenuOpen);
  }
  
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

// Apply the Lamed render size settings (fixed to small).
function applyRenderSizeLayout() {
  const lamedStage = document.getElementById('lamed-canvas');
  if (!lamedStage) {
    return;
  }

  // Size level is always 0 (Small): no offset
  const sizeLevel = 0;

  lamedStage.dataset.sizeLevel = String(sizeLevel);
  lamedStage.style.setProperty('--lamed-size-inline-left', '0px');
  lamedStage.style.setProperty('--lamed-size-inline-right', '0px');
  lamedStage.style.setProperty('--lamed-size-top', '0px');
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
  bgStarsToggle = document.getElementById('lamed-bg-stars-toggle');
  // Capture slider elements for star density control.
  starRenderSlider = document.getElementById('lamed-star-render-slider');
  starRenderValueLabel = document.getElementById('lamed-star-render-value');

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

  if (bgStarsToggle) {
    bgStarsToggle.addEventListener('change', (event) => {
      applySetting('backgroundStars', event.target.checked);
      syncToggleState(bgStarsToggle, document.getElementById('lamed-bg-stars-toggle-state'), lamedSettings.backgroundStars);
    });
  }
  if (starRenderSlider) {
    starRenderSlider.addEventListener('input', (event) => {
      // Clamp the slider value before persisting to avoid invalid ranges.
      const clamped = clampStarRenderCap(event.target.value);
      event.target.value = String(clamped);
      applySetting('starRenderCap', clamped);
      updateStarRenderLabel(clamped);
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
  // Clamp star render settings so programmatic updates respect slider bounds.
  lamedSettings.starRenderCap = clampStarRenderCap(lamedSettings.starRenderCap);
  if (persist) {
    persistSettings();
  }
  applySettingsToSimulation();
  updateGraphicsLevelButton();
  syncAllToggles();
}

export { LAMED_GRAPHICS_LEVELS };
