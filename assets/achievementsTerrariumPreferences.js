/**
 * Achievements terrarium visual preferences.
 * Adds pixelation control for the achievements terrarium canvas rendering.
 */
import { readStorageJson, writeStorage, ACHIEVEMENTS_TERRARIUM_VISUAL_SETTINGS_STORAGE_KEY } from './autoSave.js';
import { getBetSpireRenderInstance } from './betSpireRender.js';

const PIXELATION_LEVELS = [0, 1, 2];
const PIXELATION_LABELS = ['None', 'Mild', 'Strong'];

const DEFAULT_SETTINGS = Object.freeze({
  pixelationLevel: 0,
});

let settings = { ...DEFAULT_SETTINGS };
let pixelationButton = null;
let renderInstanceGetter = () => getBetSpireRenderInstance(); // Default to bet spire render

function resolvePixelationLabel(level = settings.pixelationLevel) {
  const index = Math.max(0, Math.min(PIXELATION_LEVELS.length - 1, Math.round(level)));
  return PIXELATION_LABELS[index] || PIXELATION_LABELS[0];
}

function persistSettings() {
  writeStorage(ACHIEVEMENTS_TERRARIUM_VISUAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function loadSettings() {
  const stored = readStorageJson(ACHIEVEMENTS_TERRARIUM_VISUAL_SETTINGS_STORAGE_KEY);
  if (stored && typeof stored === 'object') {
    settings = { ...DEFAULT_SETTINGS, ...stored };
  }
}

function applySettingsToRender() {
  const renderer = renderInstanceGetter();
  if (renderer && typeof renderer.setPixelationLevel === 'function') {
    renderer.setPixelationLevel(settings.pixelationLevel);
  }
}

function cyclePixelationLevel() {
  const currentIndex = PIXELATION_LEVELS.indexOf(Math.round(settings.pixelationLevel));
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % PIXELATION_LEVELS.length : 0;
  settings.pixelationLevel = PIXELATION_LEVELS[nextIndex];
  persistSettings();
  applySettingsToRender();
  syncPixelationButton();
}

function syncPixelationButton() {
  if (!pixelationButton) {
    return;
  }
  const label = resolvePixelationLabel();
  pixelationButton.textContent = `Pixelation · ${label}`;
  pixelationButton.setAttribute('aria-label', `Cycle achievements terrarium pixelation (current: ${label})`);
}

export function initializeAchievementsTerrariumPreferences() {
  loadSettings();
  applySettingsToRender();
  syncPixelationButton();
}

export function bindAchievementsTerrariumOptions() {
  pixelationButton = document.getElementById('achievements-terrarium-pixelation-button');
  if (pixelationButton) {
    pixelationButton.addEventListener('click', cyclePixelationLevel);
  }
  syncPixelationButton();
}

/**
 * Set a custom getter for the render instance if not using betSpireRender.
 * @param {() => object} getter - Function that returns the render instance.
 */
export function setAchievementsTerrariumRenderGetter(getter) {
  if (typeof getter === 'function') {
    renderInstanceGetter = getter;
    applySettingsToRender();
  }
}

export function getAchievementsTerrariumVisualSettings() {
  return { ...settings };
}
