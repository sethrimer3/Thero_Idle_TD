/**
 * Bet Spire visual preferences.
 * Adds a pixelation control so the particle simulation can trade sharpness for performance.
 */
import { readStorageJson, writeStorage, BET_VISUAL_SETTINGS_STORAGE_KEY } from './autoSave.js';
import { getBetSpireRenderInstance } from './betSpireRender.js';

const PIXELATION_LEVELS = [0, 1, 2];
const PIXELATION_SCALE_LABELS = ['None', 'Mild', 'Strong'];
const PIXELATION_SCALES = [1, 0.75, 0.5];

const DEFAULT_SETTINGS = Object.freeze({
  pixelationLevel: 0,
});

let settings = { ...DEFAULT_SETTINGS };
let pixelationButton = null;

function resolvePixelationLabel(level = settings.pixelationLevel) {
  const index = Math.max(0, Math.min(PIXELATION_LEVELS.length - 1, Math.round(level)));
  return PIXELATION_SCALE_LABELS[index] || PIXELATION_SCALE_LABELS[0];
}

function persistSettings() {
  writeStorage(BET_VISUAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function loadSettings() {
  const stored = readStorageJson(BET_VISUAL_SETTINGS_STORAGE_KEY);
  if (stored && typeof stored === 'object') {
    settings = { ...DEFAULT_SETTINGS, ...stored };
  }
}

function applySettingsToRender() {
  const renderer = getBetSpireRenderInstance();
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
  pixelationButton.setAttribute('aria-label', `Cycle Bet Spire pixelation (current: ${label})`);
}

export function initializeBetSpirePreferences() {
  loadSettings();
  applySettingsToRender();
  syncPixelationButton();
}

export function bindBetSpireOptions() {
  pixelationButton = document.getElementById('bet-pixelation-level-button');
  if (pixelationButton) {
    pixelationButton.addEventListener('click', cyclePixelationLevel);
  }
  syncPixelationButton();
}

export function getBetPixelationScale() {
  const index = Math.max(0, Math.min(PIXELATION_SCALES.length - 1, Math.round(settings.pixelationLevel)));
  return PIXELATION_SCALES[index];
}
