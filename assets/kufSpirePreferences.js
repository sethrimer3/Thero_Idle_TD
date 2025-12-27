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
  renderSizeLevel: 1, // Default to Medium (0=Small, 1=Medium, 2=Large)
});

let settings = { ...DEFAULT_SETTINGS };
let simulationGetter = () => null;
let effectButton = null;
let glowToggle = null;
let glowToggleState = null;
// Render size controls for the Kuf spire layout.
let renderSizeSelect = null;
let renderSizeRow = null;

function persistSettings() {
  writeStorage(KUF_VISUAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function loadSettings() {
  const stored = readStorageJson(KUF_VISUAL_SETTINGS_STORAGE_KEY);
  if (stored && typeof stored === 'object') {
    settings = { ...DEFAULT_SETTINGS, ...stored };
    settings.renderSizeLevel = normalizeRenderSizeLevel(stored.renderSizeLevel);
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
  
  if (renderSizeSelect) {
    renderSizeSelect.value = String(normalizeRenderSizeLevel(settings.renderSizeLevel));
  }
}

// Normalize the render size level to a safe 0-2 range.
function normalizeRenderSizeLevel(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 1; // Default to Medium if invalid
  }
  return Math.min(2, Math.max(0, parsed));
}

// Apply the Kuf render size settings by offsetting the spire container.
function applyRenderSizeLayout() {
  const kufStage = document.getElementById('kuf-canvas');
  if (!kufStage) {
    return;
  }

  const sizeLevel = normalizeRenderSizeLevel(settings.renderSizeLevel);
  const panel = kufStage.closest('.panel');
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

  kufStage.dataset.sizeLevel = String(sizeLevel);
  kufStage.style.setProperty('--kuf-size-inline-left', `${inlineLeft}px`);
  kufStage.style.setProperty('--kuf-size-inline-right', `${inlineRight}px`);
  kufStage.style.setProperty('--kuf-size-top', `${topOffset}px`);
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
  renderSizeSelect = document.getElementById('kuf-render-size-select');
  renderSizeRow = document.getElementById('kuf-render-size-row');

  if (effectButton) {
    effectButton.addEventListener('click', cycleEffectMode);
    syncEffectButton();
  }

  if (glowToggle) {
    glowToggle.addEventListener('change', handleGlowToggleChange);
    syncGlowToggle();
  }

  if (renderSizeSelect) {
    renderSizeSelect.addEventListener('change', (event) => {
      settings.renderSizeLevel = normalizeRenderSizeLevel(event.target.value);
      persistSettings();
      syncGlowToggle();
      applyRenderSizeLayout();
    });
  }
}

export function initializeKufSpirePreferences() {
  loadSettings();
  applySettingsToSimulation();
  applyRenderSizeLayout();
}

export function setKufSimulationGetter(getter) {
  simulationGetter = typeof getter === 'function' ? getter : () => null;
  applySettingsToSimulation();
}

export function getKufVisualSettings() {
  return { ...settings };
}

// Recalculate size offsets on viewport changes to keep the render aligned.
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    applyRenderSizeLayout();
  });
}
