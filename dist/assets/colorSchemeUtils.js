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

// Default projectile gradient preserves the historical cyan-to-magenta beam when no palette metadata is available.
const defaultProjectileGradient = Object.freeze({
  start: { r: 139, g: 247, b: 255 },
  end: { r: 255, g: 138, b: 216 },
});

// Clamp helper keeps gradient interpolation within the unit interval for consistent blending.
const clampUnitInterval = (value) => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
};

// Convert CSS-like color inputs into normalized RGB objects so palette definitions can stay ergonomic.
function parseGradientColor(input, fallback = defaultProjectileGradient.start) {
  if (input && typeof input === 'object' && Number.isFinite(input.r) && Number.isFinite(input.g) && Number.isFinite(input.b)) {
    return {
      r: Math.max(0, Math.min(255, Math.round(input.r))),
      g: Math.max(0, Math.min(255, Math.round(input.g))),
      b: Math.max(0, Math.min(255, Math.round(input.b))),
    };
  }

  if (typeof input === 'string') {
    const hex = input.trim().replace('#', '');
    if (hex.length === 3 || hex.length === 6) {
      const normalized = hex.length === 3
        ? hex
            .split('')
            .map((char) => char + char)
            .join('')
        : hex.slice(0, 6);
      const value = Number.parseInt(normalized, 16);
      if (Number.isFinite(value)) {
        return {
          r: (value >> 16) & 255,
          g: (value >> 8) & 255,
          b: value & 255,
        };
      }
    }
  }

  return { ...fallback };
}

// Normalize palette gradient descriptors so downstream consumers always receive a predictable shape.
function normalizeGradient(gradient) {
  if (!gradient || typeof gradient !== 'object') {
    return { ...defaultProjectileGradient };
  }
  const start = parseGradientColor(gradient.start, defaultProjectileGradient.start);
  const end = parseGradientColor(gradient.end, defaultProjectileGradient.end);
  return { start, end };
}

// Helper builds gradients from convenient hex inputs without duplicating normalization logic inside each palette.
function gradientFromHex(startHex, endHex) {
  return normalizeGradient({
    start: parseGradientColor(startHex, defaultProjectileGradient.start),
    end: parseGradientColor(endHex, defaultProjectileGradient.end),
  });
}

// Centralized palette state tracks active scheme metadata and associated DOM bindings.
const colorSchemeState = {
  index: 0,
  button: null,
  // Inline preview line that mirrors the current projectile gradient.
  gradientPreview: null,
  buttonId: 'color-scheme-button',
  gradientPreviewId: 'color-scheme-gradient-preview',
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
    getProjectileGradient() {
      return gradientFromHex('#8bf7ff', '#ff8ad8');
    },
  },
  {
    id: 'chromatic',
    label: 'Chromatic',
    className: 'color-scheme-chromatic',
    getTowerVisuals: computeChromaticTowerVisuals,
    getOmegaWaveVisuals: computeChromaticOmegaWaveVisuals,
    getProjectileGradient() {
      return gradientFromHex('#ff6b6b', '#8e54e9');
    },
  },
  // CoolingEmbers palette leans into ember reds tempered with cool violets for a steady temperature drop.
  {
    id: 'cooling-embers',
    label: 'CoolingEmbers',
    className: 'color-scheme-cooling-embers',
    getTowerVisuals: computeCoolingEmbersTowerVisuals,
    getOmegaWaveVisuals: computeCoolingEmbersOmegaWaveVisuals,
    getProjectileGradient() {
      return gradientFromHex('#ff6b6b', '#8e54e9');
    },
  },
  // FractalBloom palette shifts hues from teal to magenta as towers climb tiers.
  {
    id: 'fractal-bloom',
    label: 'FractalBloom',
    className: 'color-scheme-fractal-bloom',
    getTowerVisuals: computeFractalBloomTowerVisuals,
    getOmegaWaveVisuals: computeFractalBloomOmegaWaveVisuals,
    getProjectileGradient() {
      return gradientFromHex('#4ed1c5', '#a86bff');
    },
  },
  // ObsidianPulse palette accentuates deep violet towers with electric highlights for high tiers.
  {
    id: 'obsidian-pulse',
    label: 'ObsidianPulse',
    className: 'color-scheme-obsidian-pulse',
    getTowerVisuals: computeObsidianPulseTowerVisuals,
    getOmegaWaveVisuals: computeObsidianPulseOmegaWaveVisuals,
    getProjectileGradient() {
      return gradientFromHex('#5de0ff', '#ff9dff');
    },
  },
  // SolarScribe palette blends ember oranges with academic parchment tones for radiant builds.
  {
    id: 'solar-scribe',
    label: 'SolarScribe',
    className: 'color-scheme-solar-scribe',
    getTowerVisuals: computeSolarScribeTowerVisuals,
    getOmegaWaveVisuals: computeSolarScribeOmegaWaveVisuals,
    getProjectileGradient() {
      return gradientFromHex('#ffb347', '#fff1c1');
    },
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

  // Accept overrides for the gradient preview element so host UI can provide custom layout.
  if (typeof options.gradientPreviewId === 'string' && options.gradientPreviewId.trim()) {
    colorSchemeState.gradientPreviewId = options.gradientPreviewId.trim();
  }
}

// Extracts the tier value from tower metadata to drive chromatic gradients.
export function getTowerTierValue(tower) {
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

// Maps tower tiers onto the ember-to-violet gradient that inspired the palette name.
function computeCoolingEmbersMetrics(tower) {
  const tier = Math.max(1, getTowerTierValue(tower));
  const clamped = Math.min(tier, 20);
  const ratio = clamped > 1 ? (clamped - 1) / 19 : 0;
  const hue = 18 + ratio * 240;
  const saturation = 80 - ratio * 10;
  const baseLightness = 40 + ratio * 14;
  return { tier, clamped, ratio, hue, saturation, baseLightness };
}

// Applies ember reds and cooling violets to tower visuals for the CoolingEmbers palette.
function computeCoolingEmbersTowerVisuals(tower) {
  const { ratio, hue, saturation, baseLightness } = computeCoolingEmbersMetrics(tower);
  const outerStroke = `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(baseLightness + 6)}%)`;
  const innerFill = `hsl(${Math.round(hue - 8)}, ${Math.round(saturation * 0.9)}%, ${Math.round(baseLightness - 8)}%)`;
  const symbolFill = `hsl(${Math.round(hue + 6)}, 88%, ${Math.round(70 + ratio * 8)}%)`;
  const rangeLightness = Math.min(88, baseLightness + 24);
  const rangeOpacity = 0.26 + ratio * 0.22;
  const rangeStroke = `hsla(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(rangeLightness)}%, ${rangeOpacity.toFixed(2)})`;
  const symbolShadow = {
    color: `hsla(${Math.round(hue + 12)}, 92%, ${Math.round(78 + ratio * 10)}%, ${0.72 + ratio * 0.12})`,
    blur: 18,
  };
  const outerShadow = {
    color: `hsla(${Math.round(hue - 16)}, ${Math.round(saturation)}%, ${Math.round(baseLightness + 18)}%, 0.58)`,
    blur: 26,
  };

  return {
    outerStroke,
    outerShadow,
    innerFill,
    symbolFill,
    symbolShadow,
    rangeStroke,
  };
}

// Keeps omega waves aligned with the ember gradient so projectiles glow as they cool.
function computeCoolingEmbersOmegaWaveVisuals(tower) {
  const { ratio, hue, saturation, baseLightness } = computeCoolingEmbersMetrics(tower);
  const colorLightness = baseLightness + 16 + ratio * 6;
  const color = `hsla(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(colorLightness)}%, ${0.6 + ratio * 0.24})`;
  const trailLightness = Math.min(92, colorLightness + 8);
  const trailColor = `hsla(${Math.round(hue + 10)}, ${Math.round(saturation)}%, ${Math.round(trailLightness)}%, 0.52)`;
  const glowLightness = Math.min(96, colorLightness + 14);
  const glowColor = `hsla(${Math.round(hue - 6)}, 88%, ${Math.round(glowLightness)}%, 0.88)`;
  const size = 4.2 + ratio * 3.4;

  return {
    color,
    trailColor,
    glowColor,
    glowBlur: 32,
    size,
  };
}

// Maps tower tiers to a teal-magenta gradient for the FractalBloom palette.
function computeFractalBloomMetrics(tower) {
  const tier = Math.max(1, getTowerTierValue(tower));
  const clamped = Math.min(tier, 18);
  const ratio = clamped > 1 ? (clamped - 1) / 17 : 0;
  const hue = 170 + ratio * 110;
  const saturation = 70 + ratio * 20;
  return { tier, clamped, ratio, hue, saturation };
}

// Crafts tower visuals for FractalBloom by blending teal cores with magenta glows.
function computeFractalBloomTowerVisuals(tower) {
  const { ratio, hue, saturation } = computeFractalBloomMetrics(tower);
  const outerStroke = `hsl(${hue}, ${Math.round(saturation)}%, ${Math.round(30 + ratio * 40)}%)`;
  const innerFill = `hsl(${hue}, ${Math.round(saturation * 0.9)}%, ${Math.round(12 + ratio * 35)}%)`;
  const symbolFill = `hsl(${hue + 25}, ${Math.round(saturation)}%, ${Math.round(70 - ratio * 20)}%)`;
  const rangeStroke = `hsla(${hue - 12}, ${Math.round(saturation)}%, ${Math.round(60 + ratio * 25)}%, ${0.28 + ratio * 0.14})`;
  const symbolShadow = {
    color: `hsla(${hue + 16}, ${Math.round(saturation)}%, ${Math.round(78 + ratio * 10)}%, 0.75)`,
    blur: 18,
  };
  const outerShadow = {
    color: `hsla(${hue - 18}, ${Math.round(saturation)}%, ${Math.round(55 + ratio * 25)}%, 0.6)`,
    blur: 28,
  };
  return {
    outerStroke,
    outerShadow,
    innerFill,
    symbolFill,
    symbolShadow,
    rangeStroke,
  };
}

// Keeps omega waves cohesive with FractalBloom tower highlights.
function computeFractalBloomOmegaWaveVisuals(tower) {
  const { ratio, hue, saturation } = computeFractalBloomMetrics(tower);
  const color = `hsla(${hue}, ${Math.round(saturation)}%, ${Math.round(64 + ratio * 20)}%, ${0.6 + ratio * 0.25})`;
  const trailColor = `hsla(${hue + 18}, ${Math.round(saturation)}%, ${Math.round(70 + ratio * 18)}%, 0.5)`;
  const glowColor = `hsla(${hue - 14}, ${Math.round(saturation)}%, ${Math.round(85 + ratio * 10)}%, 0.85)`;
  const size = 4.5 + ratio * 3.5;
  return {
    color,
    trailColor,
    glowColor,
    glowBlur: 34,
    size,
  };
}

// Measures tier growth for ObsidianPulse to emphasize deep violet saturation.
function computeObsidianPulseMetrics(tower) {
  const tier = Math.max(1, getTowerTierValue(tower));
  const clamped = Math.min(tier, 30);
  const ratio = clamped > 1 ? (clamped - 1) / 29 : 0;
  const hue = 260 - ratio * 40;
  return { tier, clamped, ratio, hue };
}

// Shapes ObsidianPulse tower renders using shadowy violets and electric outlines.
function computeObsidianPulseTowerVisuals(tower) {
  const { ratio, hue } = computeObsidianPulseMetrics(tower);
  const outerStroke = `hsl(${hue}, 80%, ${Math.round(22 + ratio * 18)}%)`;
  const innerFill = `hsl(${hue - 14}, 65%, ${Math.round(8 + ratio * 20)}%)`;
  const symbolFill = `hsl(${hue + 18}, 95%, ${Math.round(68 + ratio * 18)}%)`;
  const rangeStroke = `hsla(${hue + 6}, 85%, ${Math.round(46 + ratio * 30)}%, ${0.32 + ratio * 0.18})`;
  const symbolShadow = {
    color: `hsla(${hue + 22}, 95%, ${Math.round(78 + ratio * 12)}%, 0.88)`,
    blur: 30,
  };
  const outerShadow = {
    color: `hsla(${hue - 18}, 75%, ${Math.round(38 + ratio * 20)}%, 0.55)`,
    blur: 24,
  };
  return {
    outerStroke,
    outerShadow,
    innerFill,
    symbolFill,
    symbolShadow,
    rangeStroke,
  };
}

// Aligns ObsidianPulse omega waves with the tower's neon edges.
function computeObsidianPulseOmegaWaveVisuals(tower) {
  const { ratio, hue } = computeObsidianPulseMetrics(tower);
  const color = `hsla(${hue + 12}, 88%, ${Math.round(58 + ratio * 16)}%, ${0.55 + ratio * 0.3})`;
  const trailColor = `hsla(${hue - 6}, 70%, ${Math.round(48 + ratio * 16)}%, 0.48)`;
  const glowColor = `hsla(${hue + 24}, 95%, ${Math.round(72 + ratio * 18)}%, 0.92)`;
  const size = 4 + ratio * 4;
  return {
    color,
    trailColor,
    glowColor,
    glowBlur: 36,
    size,
  };
}

// Computes brightness ramps for SolarScribe to mimic parchment catching ember light.
function computeSolarScribeMetrics(tower) {
  const tier = Math.max(1, getTowerTierValue(tower));
  const clamped = Math.min(tier, 20);
  const ratio = clamped > 1 ? (clamped - 1) / 19 : 0;
  return { tier, clamped, ratio };
}

// Applies parchment-inspired oranges to SolarScribe tower visuals.
function computeSolarScribeTowerVisuals(tower) {
  const { ratio } = computeSolarScribeMetrics(tower);
  const emberHue = 34 + ratio * 16;
  const emberSaturation = 78 + ratio * 12;
  const outerStroke = `hsl(${emberHue}, ${Math.round(emberSaturation)}%, ${Math.round(40 + ratio * 20)}%)`;
  const innerFill = `hsl(${emberHue - 8}, ${Math.round(emberSaturation * 0.85)}%, ${Math.round(18 + ratio * 24)}%)`;
  const symbolFill = `hsl(${emberHue + 12}, 90%, ${Math.round(78 - ratio * 8)}%)`;
  const rangeStroke = `hsla(${emberHue + 4}, ${Math.round(emberSaturation)}%, ${Math.round(60 + ratio * 18)}%, ${0.3 + ratio * 0.16})`;
  const symbolShadow = {
    color: `hsla(${emberHue + 20}, 95%, ${Math.round(82 + ratio * 10)}%, 0.8)`,
    blur: 20,
  };
  const outerShadow = {
    color: `hsla(${emberHue - 18}, 80%, ${Math.round(55 + ratio * 18)}%, 0.5)`,
    blur: 26,
  };
  return {
    outerStroke,
    outerShadow,
    innerFill,
    symbolFill,
    symbolShadow,
    rangeStroke,
  };
}

// Generates SolarScribe omega waves so trails glow like cooling embers.
function computeSolarScribeOmegaWaveVisuals(tower) {
  const { ratio } = computeSolarScribeMetrics(tower);
  const emberHue = 30 + ratio * 18;
  const color = `hsla(${emberHue}, 90%, ${Math.round(66 + ratio * 18)}%, ${0.58 + ratio * 0.26})`;
  const trailColor = `hsla(${emberHue + 10}, 85%, ${Math.round(72 + ratio * 16)}%, 0.48)`;
  const glowColor = `hsla(${emberHue + 4}, 95%, ${Math.round(80 + ratio * 14)}%, 0.9)`;
  const size = 4.2 + ratio * 3.2;
  return {
    color,
    trailColor,
    glowColor,
    glowBlur: 32,
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

// Resolve the active projectile gradient so tower beams and motes stay synchronized with palette swaps.
export function getActiveProjectileGradient() {
  const scheme = getActiveColorScheme();
  if (scheme && typeof scheme.getProjectileGradient === 'function') {
    try {
      const override = scheme.getProjectileGradient();
      if (override && typeof override === 'object') {
        const normalized = normalizeGradient(override);
        return {
          start: { ...normalized.start },
          end: { ...normalized.end },
        };
      }
    } catch (error) {
      console.warn('Failed to compute projectile gradient', error);
    }
  }
  return {
    start: { ...defaultProjectileGradient.start },
    end: { ...defaultProjectileGradient.end },
  };
}

// Sample the active gradient at the provided ratio to drive per-entity hues across the battlefield.
export function samplePaletteGradient(position = 0) {
  const gradient = getActiveProjectileGradient();
  const t = clampUnitInterval(position);
  const start = gradient.start || defaultProjectileGradient.start;
  const end = gradient.end || defaultProjectileGradient.end;
  const lerp = (a, b) => Math.round(a + (b - a) * t);
  return {
    r: lerp(start.r, end.r),
    g: lerp(start.g, end.g),
    b: lerp(start.b, end.b),
  };
}

// Resolve the gradient preview line so palette swaps repaint the inline sample.
function getGradientPreviewElement() {
  if (colorSchemeState.gradientPreview && colorSchemeState.gradientPreview.isConnected) {
    return colorSchemeState.gradientPreview;
  }
  if (typeof document === 'undefined') {
    return null;
  }
  const preview = document.getElementById(colorSchemeState.gradientPreviewId);
  colorSchemeState.gradientPreview = preview || null;
  return colorSchemeState.gradientPreview;
}

// Apply the active projectile gradient to the preview stripe beneath the palette button.
function updateColorSchemePreview() {
  const preview = getGradientPreviewElement();
  if (!preview) {
    return;
  }

  const gradient = getActiveProjectileGradient();
  const start = gradient.start || defaultProjectileGradient.start;
  const end = gradient.end || defaultProjectileGradient.end;
  preview.style.background = `linear-gradient(90deg, rgb(${start.r}, ${start.g}, ${start.b}), rgb(${end.r}, ${end.g}, ${end.b}))`;
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
  updateColorSchemePreview();

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

