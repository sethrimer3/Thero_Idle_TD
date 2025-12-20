/**
 * Kuf spire visual preferences.
 * Players can force a low-cost rendering profile and disable glow overlays to avoid frame drops on modest hardware.
 */
import { readStorageJson, writeStorage } from './autoSave.js';
import { KUF_VISUAL_SETTINGS_STORAGE_KEY } from './autoSave.js';

const KUF_EFFECT_MODES = Object.freeze({
  AUTO: 'auto',
  MINIMAL: 'minimal',
  CINEMATIC: 'cinematic',
});

const PIXELATION_LEVELS = [0, 1, 2];
const PIXELATION_LABELS = ['None', 'Mild', 'Strong'];

const DEFAULT_SETTINGS = Object.freeze({
  effectMode: KUF_EFFECT_MODES.AUTO,
  glowOverlays: true,
  pixelationLevel: 0,
});

let settings = { ...DEFAULT_SETTINGS };
let simulationGetter = () => null;
let effectButton = null;
let glowToggle = null;
let glowToggleState = null;
let pixelationButton = null;

function persistSettings() {
  writeStorage(KUF_VISUAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function loadSettings() {
  const stored = readStorageJson(KUF_VISUAL_SETTINGS_STORAGE_KEY);
  if (stored && typeof stored === 'object') {
    settings = { ...DEFAULT_SETTINGS, ...stored };
  }
}

function applySettingsToSimulation() {
  const simulation = simulationGetter();
  if (!simulation || typeof simulation.setVisualSettings !== 'function') {
    return;
  }
  simulation.setVisualSettings({
    renderMode: settings.effectMode,
    glowOverlays: settings.glowOverlays,
    pixelationLevel: settings.pixelationLevel,
  });
}

function cycleEffectMode() {
  const sequence = [KUF_EFFECT_MODES.AUTO, KUF_EFFECT_MODES.MINIMAL, KUF_EFFECT_MODES.CINEMATIC];
  const currentIndex = sequence.indexOf(settings.effectMode);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % sequence.length : 0;
  settings.effectMode = sequence[nextIndex];
  persistSettings();
  applySettingsToSimulation();
  syncEffectButton();
}

function resolveEffectLabel(mode = settings.effectMode) {
  switch (mode) {
    case KUF_EFFECT_MODES.MINIMAL:
      return 'Minimal';
    case KUF_EFFECT_MODES.CINEMATIC:
      return 'Cinematic';
    default:
      return 'Auto';
  }
}

function resolvePixelationLabel(level = settings.pixelationLevel) {
  const index = Math.max(0, Math.min(PIXELATION_LEVELS.length - 1, Math.round(level)));
  return PIXELATION_LABELS[index] || PIXELATION_LABELS[0];
}

function cyclePixelationLevel() {
  const currentIndex = PIXELATION_LEVELS.indexOf(Math.round(settings.pixelationLevel));
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % PIXELATION_LEVELS.length : 0;
  settings.pixelationLevel = PIXELATION_LEVELS[nextIndex];
  persistSettings();
  applySettingsToSimulation();
  syncPixelationButton();
}

function syncPixelationButton() {
  if (!pixelationButton) {
    return;
  }
  const label = resolvePixelationLabel();
  pixelationButton.textContent = `Pixelation · ${label}`;
  pixelationButton.setAttribute('aria-label', `Cycle Kuf spire pixelation (current: ${label})`);
}

function syncEffectButton() {
  if (!effectButton) {
    return;
  }
  const label = resolveEffectLabel();
  effectButton.textContent = `Effects · ${label}`;
  effectButton.setAttribute('aria-label', `Cycle Kuf spire effects preset (current: ${label})`);
}

function syncGlowToggle() {
  if (!glowToggle || !glowToggleState) {
    return;
  }
  glowToggle.checked = !!settings.glowOverlays;
  glowToggle.setAttribute('aria-checked', settings.glowOverlays ? 'true' : 'false');
  glowToggleState.textContent = settings.glowOverlays ? 'On' : 'Off';
}

function handleGlowToggleChange(event) {
  settings.glowOverlays = !!event.target.checked;
  persistSettings();
  applySettingsToSimulation();
  syncGlowToggle();
}

export function bindKufSpireOptions() {
  effectButton = document.getElementById('kuf-effects-level-button');
  glowToggle = document.getElementById('kuf-glow-toggle');
  glowToggleState = document.getElementById('kuf-glow-toggle-state');
  pixelationButton = document.getElementById('kuf-pixelation-level-button');

  if (effectButton) {
    effectButton.addEventListener('click', cycleEffectMode);
    syncEffectButton();
  }

  if (glowToggle) {
    glowToggle.addEventListener('change', handleGlowToggleChange);
    syncGlowToggle();
  }

  if (pixelationButton) {
    pixelationButton.addEventListener('click', cyclePixelationLevel);
    syncPixelationButton();
  }
}

export function initializeKufSpirePreferences() {
  loadSettings();
  applySettingsToSimulation();
  syncPixelationButton();
}

export function setKufSimulationGetter(getter) {
  simulationGetter = typeof getter === 'function' ? getter : () => null;
  applySettingsToSimulation();
}

export function getKufVisualSettings() {
  return { ...settings };
}
