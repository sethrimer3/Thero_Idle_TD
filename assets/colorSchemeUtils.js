import {
  computeMotePaletteFromTheme,
} from '../scripts/features/towers/powderTower.js';

// Storage key preserved for compatibility with existing saves.
export const COLOR_SCHEME_STORAGE_KEY = 'thero-idle-color-scheme';

// Default visuals ensure towers maintain a readable silhouette when no palette overrides exist.
const defaultTowerVisuals = Object.freeze({
  outerStroke: 'rgba(255, 228, 120, 0.85)',
  outerShadow: null,
  innerFill: 'rgba(8, 9, 14, 0.9)',
  symbolFill: 'rgba(255, 228, 120, 0.85)',
  symbolShadow: null,
  rangeStroke: 'rgba(139, 247, 255, 0.18)',
});

// Omega wave defaults echo the tower palette while remaining legible on a dark backdrop.
const defaultOmegaWaveVisuals = Object.freeze({
  color: 'rgba(255, 228, 120, 0.6)',
  trailColor: 'rgba(139, 247, 255, 0.35)',
  size: 4,
  glowColor: 'rgba(255, 228, 120, 0.75)',
  glowBlur: 24,
});

// Centralized palette state tracks active scheme metadata and associated DOM bindings.
const colorSchemeState = {
  index: 0,
  button: null,
  buttonId: 'color-scheme-button',
  listenerAttached: false,
};

// No-op helper avoids repeated anonymous function allocations.
const noop = () => {};

// Dependency hooks are initialized with sensible defaults and overridden via configureColorSchemeSystem.
let resolvePalette = computeMotePaletteFromTheme;
let handlePaletteChange = noop;
let handleSchemeApplied = noop;
let resolveBody = () => (typeof document !== 'undefined' ? document.body : null);
let resolveStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

// Scheme definitions list palette options, allowing themed overrides for towers and omega waves.
const colorSchemeDefinitions = [
  {
    id: 'aurora',
    label: 'Aurora',
    className: 'color-scheme-aurora',
    getTowerVisuals() {
      return null;
    },
    getOmegaWaveVisuals() {
      return null;
    },
  },
  {
    id: 'chromatic',
    label: 'Chromatic',
    className: 'color-scheme-chromatic',
    getTowerVisuals: computeChromaticTowerVisuals,
    getOmegaWaveVisuals: computeChromaticOmegaWaveVisuals,
  },
];

// Allows the host application to supply DOM handles, palette hooks, and button targets.
export function configureColorSchemeSystem(options = {}) {
  resolvePalette = typeof options.computePaletteFromTheme === 'function'
    ? options.computePaletteFromTheme
    : computeMotePaletteFromTheme;

  handlePaletteChange = typeof options.onPaletteChange === 'function'
    ? options.onPaletteChange
    : noop;

  handleSchemeApplied = typeof options.onSchemeApplied === 'function'
    ? options.onSchemeApplied
    : noop;

  resolveBody = typeof options.getBody === 'function'
    ? options.getBody
    : () => (typeof document !== 'undefined' ? document.body : null);

  resolveStorage = typeof options.getStorage === 'function'
    ? options.getStorage
    : () => {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage;
        }
        return null;
      };

  if (typeof options.buttonId === 'string' && options.buttonId.trim()) {
    colorSchemeState.buttonId = options.buttonId.trim();
  }
}

// Extracts the tier value from tower metadata to drive chromatic gradients.
function getTowerTierValue(tower) {
  if (!tower) {
    return 1;
  }
  if (Number.isFinite(tower.tier)) {
    return tower.tier;
  }
  if (Number.isFinite(tower.definition?.tier)) {
    return tower.definition.tier;
  }
  return 1;
}

// Computes normalized hue metrics for chromatic palette transitions.
function computeChromaticMetrics(tower) {
  const tier = Math.max(1, getTowerTierValue(tower));
  const clamped = Math.min(tier, 24);
  const ratio = clamped > 1 ? (clamped - 1) / 23 : 0;
  const hue = Math.round(300 * ratio);
  const baseLightness = Math.max(0, Math.min(100, 100 - ratio * 100));
  return { tier, clamped, ratio, hue, baseLightness };
}

// Derives tower stroke and fill colors for chromatic palettes.
function computeChromaticTowerVisuals(tower) {
  const { ratio, hue, baseLightness } = computeChromaticMetrics(tower);

  const outerStroke = `hsl(${hue}, 90%, ${Math.max(0, baseLightness)}%)`;
  const innerLightness = Math.max(4, baseLightness * 0.55);
  const innerFill = `hsl(${hue}, 65%, ${innerLightness}%)`;
  const rangeLightness = Math.min(85, baseLightness + 40);
  const rangeOpacity = 0.18 + (1 - ratio) * 0.12;
  const rangeStroke = `hsla(${hue}, 90%, ${rangeLightness}%, ${rangeOpacity.toFixed(2)})`;

  let symbolFill;
  let symbolShadow = null;

  if (baseLightness > 65) {
    symbolFill = 'rgba(18, 18, 26, 0.92)';
    const glowLightness = Math.min(95, baseLightness + 18);
    symbolShadow = {
      color: `hsla(${hue}, 85%, ${glowLightness}%, 0.55)`,
      blur: 10,
    };
  } else {
    const symbolLightness = Math.max(6, baseLightness * 0.5);
    symbolFill = `hsl(${hue}, 90%, ${symbolLightness}%)`;
    if (baseLightness < 35) {
      const glowLightness = Math.min(92, baseLightness + 60);
      symbolShadow = {
        color: `hsla(${hue}, 90%, ${glowLightness}%, 0.95)`,
        blur: 26,
      };
    }
  }

  let outerShadow = null;
  if (baseLightness < 30) {
    const haloLightness = Math.min(90, baseLightness + 55);
    outerShadow = {
      color: `hsla(${hue}, 90%, ${haloLightness}%, 0.65)`,
      blur: 24,
    };
  }

  return {
    outerStroke,
    outerShadow,
    innerFill,
    symbolFill,
    symbolShadow,
    rangeStroke,
  };
}

// Derives omega wave visuals so chromatic trails synchronize with tower highlights.
function computeChromaticOmegaWaveVisuals(tower) {
  const { ratio, hue, baseLightness } = computeChromaticMetrics(tower);
  const colorLightness = Math.min(78, baseLightness + 55);
  const colorAlpha = 0.55 + (1 - ratio) * 0.25;
  const color = `hsla(${hue}, 95%, ${colorLightness}%, ${colorAlpha.toFixed(2)})`;
  const trailLightness = Math.min(88, colorLightness + 10);
  const trail = `hsla(${hue}, 90%, ${trailLightness}%, 0.45)`;
  const glowLightness = Math.min(95, colorLightness + 15);
  const glow = `hsla(${hue}, 95%, ${glowLightness}%, 0.9)`;
  const size = 4 + ratio * 3;
  return {
    color,
    trailColor: trail,
    glowColor: glow,
    glowBlur: 30,
    size,
  };
}

// Returns the active palette descriptor for downstream rendering logic.
function getActiveColorScheme() {
  return colorSchemeDefinitions[colorSchemeState.index] || colorSchemeDefinitions[0];
}

// Applies scheme overrides to tower visuals while preserving baseline styling.
export function getTowerVisualConfig(tower) {
  const base = { ...defaultTowerVisuals };
  const scheme = getActiveColorScheme();
  if (scheme && typeof scheme.getTowerVisuals === 'function') {
    try {
      const override = scheme.getTowerVisuals(tower, { ...base });
      if (override && typeof override === 'object') {
        return { ...base, ...override };
      }
    } catch (error) {
      console.warn('Failed to compute tower visuals', error);
    }
  }
  return base;
}

// Applies scheme overrides to omega wave visuals with safe fallbacks.
export function getOmegaWaveVisualConfig(tower) {
  const base = { ...defaultOmegaWaveVisuals };
  const scheme = getActiveColorScheme();
  if (scheme && typeof scheme.getOmegaWaveVisuals === 'function') {
    try {
      const override = scheme.getOmegaWaveVisuals(tower, { ...base });
      if (override && typeof override === 'object') {
        return { ...base, ...override };
      }
    } catch (error) {
      console.warn('Failed to compute omega wave visuals', error);
    }
  }
  return base;
}

// Updates the toggle button label so assistive tech reflects the current palette.
function updateColorSchemeButton() {
  const button = colorSchemeState.button;
  if (!button) {
    return;
  }
  const scheme = getActiveColorScheme();
  if (scheme) {
    button.textContent = `Palette · ${scheme.label}`;
    button.setAttribute('aria-label', `Switch color scheme (current: ${scheme.label})`);
  }
}

// Synchronizes powder palette consumers with the selected scheme.
function updateMotePaletteFromTheme() {
  const palette = resolvePalette();
  handlePaletteChange(palette);
}

// Applies CSS class toggles, persists selection, and triggers powder refreshes.
function applyColorScheme() {
  const scheme = getActiveColorScheme();
  const body = resolveBody();
  if (body) {
    colorSchemeDefinitions.forEach((definition) => {
      if (definition.className) {
        body.classList.toggle(definition.className, definition === scheme);
      }
    });
  }

  updateColorSchemeButton();

  const storage = resolveStorage();
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(COLOR_SCHEME_STORAGE_KEY, scheme?.id || 'aurora');
    } catch (error) {
      console.warn('Unable to persist color scheme', error);
    }
  }

  updateMotePaletteFromTheme();
  handleSchemeApplied();
}

// Switches the active palette by identifier and reapplies styling.
function setColorSchemeById(id) {
  const index = colorSchemeDefinitions.findIndex((scheme) => scheme.id === id);
  if (index < 0) {
    return false;
  }
  colorSchemeState.index = index;
  applyColorScheme();
  return true;
}

// Steps through available palettes in order.
function cycleColorScheme() {
  if (!colorSchemeDefinitions.length) {
    return;
  }
  colorSchemeState.index = (colorSchemeState.index + 1) % colorSchemeDefinitions.length;
  applyColorScheme();
}

// Wires a DOM button to palette cycling and ensures label sync.
export function bindColorSchemeButton(button) {
  const resolvedButton = button
    || (typeof document !== 'undefined'
      ? document.getElementById(colorSchemeState.buttonId)
      : null);

  if (colorSchemeState.button && colorSchemeState.button !== resolvedButton) {
    colorSchemeState.button.removeEventListener('click', cycleColorScheme);
    colorSchemeState.listenerAttached = false;
  }

  colorSchemeState.button = resolvedButton || null;

  if (!resolvedButton) {
    return;
  }

  if (!colorSchemeState.listenerAttached) {
    resolvedButton.addEventListener('click', cycleColorScheme);
    colorSchemeState.listenerAttached = true;
  }

  updateColorSchemeButton();
}

// Restores persisted palette preferences and defaults to aurora when none exist.
export function initializeColorScheme() {
  let applied = false;
  const storage = resolveStorage();
  if (storage && typeof storage.getItem === 'function') {
    try {
      const stored = storage.getItem(COLOR_SCHEME_STORAGE_KEY);
      if (stored) {
        applied = setColorSchemeById(stored);
      }
    } catch (error) {
      console.warn('Unable to read saved color scheme', error);
    }
  }
  if (!applied) {
    applyColorScheme();
  }
}

