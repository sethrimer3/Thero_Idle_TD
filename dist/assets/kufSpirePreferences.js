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

const DEFAULT_SETTINGS = Object.freeze({
  effectMode: KUF_EFFECT_MODES.AUTO,
  glowOverlays: true,
});

let settings = { ...DEFAULT_SETTINGS };
let simulationGetter = () => null;
let effectButton = null;
let glowToggle = null;
let glowToggleState = null;

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

  if (effectButton) {
    effectButton.addEventListener('click', cycleEffectMode);
    syncEffectButton();
  }

  if (glowToggle) {
    glowToggle.addEventListener('change', handleGlowToggleChange);
    syncGlowToggle();
  }
}

export function initializeKufSpirePreferences() {
  loadSettings();
  applySettingsToSimulation();
}

export function setKufSimulationGetter(getter) {
  simulationGetter = typeof getter === 'function' ? getter : () => null;
  applySettingsToSimulation();
}

export function getKufVisualSettings() {
  return { ...settings };
}
