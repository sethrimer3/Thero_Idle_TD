/**
 * Shared palette, color conversion, and numeric normalization helpers for powder towers.
 *
 * Extracted from the massive powderTower module to keep visual math utilities
 * accessible without loading the full simulation implementation.
 */

/**
 * Default gradient, opacity, and background values for mote rendering.
 */
export const DEFAULT_MOTE_PALETTE = {
  stops: [
    { r: 255, g: 222, b: 137 },
    { r: 139, g: 247, b: 255 },
    { r: 164, g: 182, b: 255 },
  ],
  restAlpha: 0.9,
  freefallAlpha: 0.6,
  backgroundTop: '#0f1018',
  backgroundBottom: '#171a27',
};

/**
 * Clamp helper for values expected to live in the inclusive [0, 1] range.
 * @param {number} value Raw floating-point input.
 * @returns {number} Clamped value between 0 and 1 (or 0 for invalid inputs).
 */
export function clampUnitInterval(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

/**
 * Normalizes floating-point inputs for persistence so NaN/Infinity never leak into saves.
 * @param {number} value Number to sanitize.
 * @param {number} fallback Default to return when value is not finite.
 * @returns {number} Safe floating-point value.
 */
export function normalizeFiniteNumber(value, fallback = 0) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

/**
 * Normalizes integer inputs for persistence while enforcing deterministic rounding.
 * @param {number} value Number to sanitize.
 * @param {number} fallback Default to return when the input is not finite.
 * @returns {number} Rounded integer.
 */
export function normalizeFiniteInteger(value, fallback = 0) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.round(value);
}

/**
 * Creates a sanitized clone of an RGB payload so callers never mutate shared palette data.
 * @param {{r:number,g:number,b:number}|null|undefined} color RGB payload to clone.
 * @returns {{r:number,g:number,b:number}|null} Safe copy or null when invalid.
 */
export function cloneMoteColor(color) {
  if (!color || typeof color !== 'object') {
    return null;
  }
  if (!Number.isFinite(color.r) || !Number.isFinite(color.g) || !Number.isFinite(color.b)) {
    return null;
  }
  return {
    r: Math.max(0, Math.min(255, Math.round(color.r))),
    g: Math.max(0, Math.min(255, Math.round(color.g))),
    b: Math.max(0, Math.min(255, Math.round(color.b))),
  };
}

/**
 * Converts HSL coordinates into RGB space for gradient synthesis.
 * @param {number} h Hue in degrees.
 * @param {number} s Saturation 0-1.
 * @param {number} l Lightness 0-1.
 * @returns {{r:number,g:number,b:number}} Converted RGB payload.
 */
function hslToRgbColor(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const sat = clampUnitInterval(s);
  const light = clampUnitInterval(l);
  if (sat === 0) {
    const value = Math.round(light * 255);
    return { r: value, g: value, b: value };
  }
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const convert = (t) => {
    let temp = t;
    if (temp < 0) {
      temp += 1;
    }
    if (temp > 1) {
      temp -= 1;
    }
    if (temp < 1 / 6) {
      return p + (q - p) * 6 * temp;
    }
    if (temp < 1 / 2) {
      return q;
    }
    if (temp < 2 / 3) {
      return p + (q - p) * (2 / 3 - temp) * 6;
    }
    return p;
  };
  const r = convert(hue / 360 + 1 / 3);
  const g = convert(hue / 360);
  const b = convert(hue / 360 - 1 / 3);
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Parses a hexadecimal color string (#rgb, #rgba, #rrggbb, or #rrggbbaa) into RGB components.
 * @param {string} value CSS hex string.
 * @returns {{r:number,g:number,b:number}|null} RGB payload or null on failure.
 */
function parseHexColor(value) {
  if (typeof value !== 'string') {
    return null;
  }
  let hex = value.trim();
  if (!hex) {
    return null;
  }
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }
  if (hex.length !== 6 && hex.length !== 8) {
    return null;
  }
  const int = Number.parseInt(hex.slice(0, 6), 16);
  if (Number.isNaN(int)) {
    return null;
  }
  return {
    r: (int >> 16) & 0xff,
    g: (int >> 8) & 0xff,
    b: int & 0xff,
  };
}

/**
 * Parses rgb()/rgba() strings into RGB payloads.
 * @param {string} value CSS rgb(a) string.
 * @returns {{r:number,g:number,b:number}|null} RGB payload or null when invalid.
 */
function parseRgbColor(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const match = value
    .trim()
    .match(/^rgba?\((\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)(?:[,\s]+([0-9.]+))?\)$/i);
  if (!match) {
    return null;
  }
  const r = Number.parseFloat(match[1]);
  const g = Number.parseFloat(match[2]);
  const b = Number.parseFloat(match[3]);
  if ([r, g, b].some((component) => Number.isNaN(component))) {
    return null;
  }
  return { r, g, b };
}

/**
 * Parses hsl()/hsla() strings into RGB payloads.
 * @param {string} value CSS hsl(a) string.
 * @returns {{r:number,g:number,b:number}|null} RGB payload or null when invalid.
 */
function parseHslColor(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const match = value
    .trim()
    .match(/^hsla?\(([-\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%(?:[,\s]+([0-9.]+))?\)$/i);
  if (!match) {
    return null;
  }
  const h = Number.parseFloat(match[1]);
  const s = Number.parseFloat(match[2]) / 100;
  const l = Number.parseFloat(match[3]) / 100;
  if ([h, s, l].some((component) => Number.isNaN(component))) {
    return null;
  }
  return hslToRgbColor(h, s, l);
}

/**
 * Parses mixed CSS color formats (hex, rgb, hsl, or object forms) into RGB payloads.
 * @param {string|object} value CSS color candidate.
 * @returns {{r:number,g:number,b:number}|null} RGB payload or null on failure.
 */
export function parseCssColor(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return parseHexColor(value) || parseRgbColor(value) || parseHslColor(value);
  }
  if (typeof value === 'object') {
    if ('r' in value && 'g' in value && 'b' in value) {
      return {
        r: Number.isFinite(value.r) ? value.r : 0,
        g: Number.isFinite(value.g) ? value.g : 0,
        b: Number.isFinite(value.b) ? value.b : 0,
      };
    }
    if ('h' in value && 's' in value && 'l' in value) {
      return hslToRgbColor(value.h, value.s, value.l);
    }
  }
  return null;
}

/**
 * Blends two RGB colors together using the provided ratio.
 * @param {{r:number,g:number,b:number}} colorA First color.
 * @param {{r:number,g:number,b:number}} colorB Second color.
 * @param {number} ratio Blend ratio in [0, 1].
 * @returns {{r:number,g:number,b:number}} Mixed RGB payload.
 */
export function mixRgbColors(colorA, colorB, ratio) {
  const t = clampUnitInterval(ratio);
  const a = colorA || { r: 0, g: 0, b: 0 };
  const b = colorB || { r: 0, g: 0, b: 0 };
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

/**
 * Formats an RGB color into an rgba() CSS string with normalized alpha.
 * @param {{r:number,g:number,b:number}} color RGB payload to stringify.
 * @param {number} alpha Opacity value between 0 and 1.
 * @returns {string} CSS rgba() string.
 */
export function colorToRgbaString(color, alpha = 1) {
  const safeColor = color || { r: 0, g: 0, b: 0 };
  const r = Math.round(Math.max(0, Math.min(255, safeColor.r || 0)));
  const g = Math.round(Math.max(0, Math.min(255, safeColor.g || 0)));
  const b = Math.round(Math.max(0, Math.min(255, safeColor.b || 0)));
  const normalizedAlpha = clampUnitInterval(alpha);
  return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha.toFixed(3)})`;
}

/**
 * Resolves the configured mote palette into a full structure with fallbacks.
 * @param {object} palette User-supplied palette overrides.
 * @returns {object} Fully populated palette definition.
 */
export function mergeMotePalette(palette) {
  if (!palette || typeof palette !== 'object') {
    return {
      ...DEFAULT_MOTE_PALETTE,
      stops: DEFAULT_MOTE_PALETTE.stops.map((stop) => ({ ...stop })),
    };
  }

  const stops = Array.isArray(palette.stops) && palette.stops.length
    ? palette.stops
        .map((stop) => {
          if (stop && typeof stop === 'object') {
            const color = parseCssColor(stop) || stop;
            if (color && typeof color === 'object' && 'r' in color && 'g' in color && 'b' in color) {
              return {
                r: Number.isFinite(color.r) ? color.r : 0,
                g: Number.isFinite(color.g) ? color.g : 0,
                b: Number.isFinite(color.b) ? color.b : 0,
              };
            }
          }
          return null;
        })
        .filter(Boolean)
    : DEFAULT_MOTE_PALETTE.stops.map((stop) => ({ ...stop }));

  if (!stops.length) {
    stops.push(...DEFAULT_MOTE_PALETTE.stops.map((stop) => ({ ...stop })));
  }

  return {
    stops,
    restAlpha: Number.isFinite(palette.restAlpha) ? palette.restAlpha : DEFAULT_MOTE_PALETTE.restAlpha,
    freefallAlpha: Number.isFinite(palette.freefallAlpha)
      ? palette.freefallAlpha
      : DEFAULT_MOTE_PALETTE.freefallAlpha,
    backgroundTop: palette.backgroundTop || DEFAULT_MOTE_PALETTE.backgroundTop,
    backgroundBottom: palette.backgroundBottom || DEFAULT_MOTE_PALETTE.backgroundBottom,
  };
}

/**
 * Ensures palette color stops always include at least two unique colors plus boundaries.
 * @param {object} palette Palette definition.
 * @returns {Array<{r:number,g:number,b:number}>} Normalized color stops.
 */
export function resolvePaletteColorStops(palette) {
  const reference = palette && typeof palette === 'object' ? palette : DEFAULT_MOTE_PALETTE;
  const stops = [];
  const pushStop = (candidate) => {
    const color = normalizePaletteColorStop(candidate);
    if (!color) {
      return;
    }
    const last = stops[stops.length - 1];
    if (last && last.r === color.r && last.g === color.g && last.b === color.b) {
      return;
    }
    stops.push(color);
  };

  pushStop(reference.backgroundTop);

  const baseStops = Array.isArray(reference.stops) && reference.stops.length
    ? reference.stops
    : DEFAULT_MOTE_PALETTE.stops;
  baseStops.forEach((stop) => pushStop(stop));

  pushStop(reference.backgroundBottom);

  if (!stops.length) {
    DEFAULT_MOTE_PALETTE.stops.forEach((stop) => pushStop(stop));
  }

  if (stops.length === 1) {
    stops.push({ ...stops[0] });
  }

  return stops;
}

/**
 * Builds a palette from the current document theme variables.
 * @returns {object} Palette with colors sampled from CSS custom properties.
 */
export function computeMotePaletteFromTheme() {
  if (typeof window === 'undefined') {
    return mergeMotePalette(DEFAULT_MOTE_PALETTE);
  }
  const root = document.body || document.documentElement;
  if (!root) {
    return mergeMotePalette(DEFAULT_MOTE_PALETTE);
  }
  const styles = window.getComputedStyle(root);
  const accent = parseCssColor(styles.getPropertyValue('--accent')) || DEFAULT_MOTE_PALETTE.stops[1];
  const accentSecondary =
    parseCssColor(styles.getPropertyValue('--accent-2')) || DEFAULT_MOTE_PALETTE.stops[2];
  const accentWarm = parseCssColor(styles.getPropertyValue('--accent-3')) || DEFAULT_MOTE_PALETTE.stops[0];
  const deepBase = { r: 15, g: 16, b: 24 };
  const lowBase = { r: 23, g: 26, b: 39 };
  const stops = [
    mixRgbColors(accentWarm, { r: 255, g: 255, b: 255 }, 0.12),
    mixRgbColors(accent, accentSecondary, 0.25),
    mixRgbColors(accentSecondary, { r: 255, g: 255, b: 255 }, 0.18),
  ];

  return mergeMotePalette({
    stops,
    restAlpha: 0.9,
    freefallAlpha: 0.62,
    backgroundTop: colorToRgbaString(mixRgbColors(deepBase, accent, 0.22), 1),
    backgroundBottom: colorToRgbaString(mixRgbColors(lowBase, accentSecondary, 0.18), 1),
  });
}

/**
 * Normalizes a palette stop candidate into a sanitized RGB payload.
 * @param {unknown} stop Color candidate provided by callers.
 * @returns {{r:number,g:number,b:number}|null} Sanitized RGB payload or null when invalid.
 */
function normalizePaletteColorStop(stop) {
  if (!stop) {
    return null;
  }

  let color = null;
  if (typeof stop === 'string') {
    color = parseCssColor(stop);
  } else if (typeof stop === 'object') {
    if ('r' in stop && 'g' in stop && 'b' in stop) {
      color = stop;
    } else {
      color = parseCssColor(stop);
    }
  }

  if (!color || !Number.isFinite(color.r) || !Number.isFinite(color.g) || !Number.isFinite(color.b)) {
    return null;
  }

  return {
    r: Math.max(0, Math.min(255, Math.round(color.r))),
    g: Math.max(0, Math.min(255, Math.round(color.g))),
    b: Math.max(0, Math.min(255, Math.round(color.b))),
  };
}
