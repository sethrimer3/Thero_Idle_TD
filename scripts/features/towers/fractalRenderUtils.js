/**
 * Fractal Render Utilities
 *
 * Provides shared palette sampling and tone-mapping helpers so every Shin
 * fractal can reuse the same glowing ink aesthetic. The palette definitions are
 * intentionally small and deterministic to keep allocations low while still
 * allowing striking gradients.
 */

/**
 * Predefined gradient stops keyed by palette identifier. Each stop contains a
 * relative position in [0, 1] and the corresponding RGB triplet.
 */
const FRACTAL_PALETTES = {
  'blue-aurora': [
    { t: 0, color: [8, 24, 64] },
    { t: 0.35, color: [16, 82, 168] },
    { t: 0.7, color: [86, 180, 255] },
    { t: 1, color: [198, 235, 255] }
  ],
  'emerald-ink': [
    { t: 0, color: [6, 30, 14] },
    { t: 0.4, color: [28, 108, 58] },
    { t: 0.75, color: [120, 220, 126] },
    { t: 1, color: [214, 255, 214] }
  ],
  'flame-nebula': [
    { t: 0, color: [16, 2, 32] },
    { t: 0.3, color: [120, 32, 120] },
    { t: 0.65, color: [255, 120, 48] },
    { t: 1, color: [255, 236, 200] }
  ]
};

/**
 * Linearly interpolate between two numbers.
 *
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Blend factor in [0, 1]
 * @returns {number} Interpolated value
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Sample a palette by interpolating across its stops.
 *
 * @param {string} paletteName - Identifier of the palette to sample
 * @param {number} t - Position in [0, 1]
 * @returns {{r:number, g:number, b:number}} The RGB color
 */
export function samplePalette(paletteName, t) {
  const stops = FRACTAL_PALETTES[paletteName] || FRACTAL_PALETTES['blue-aurora'];
  const clampedT = Math.max(0, Math.min(1, t));

  for (let i = 0; i < stops.length - 1; i++) {
    const left = stops[i];
    const right = stops[i + 1];
    if (clampedT >= left.t && clampedT <= right.t) {
      const span = right.t - left.t || 1;
      const localT = (clampedT - left.t) / span;
      return {
        r: Math.round(lerp(left.color[0], right.color[0], localT)),
        g: Math.round(lerp(left.color[1], right.color[1], localT)),
        b: Math.round(lerp(left.color[2], right.color[2], localT))
      };
    }
  }

  const last = stops[stops.length - 1];
  return { r: last.color[0], g: last.color[1], b: last.color[2] };
}

/**
 * Convert an RGB triplet into a CSS rgba() string with the provided alpha.
 *
 * @param {{r:number,g:number,b:number}} color - RGB color to stringify
 * @param {number} alpha - Alpha channel in [0, 1]
 * @returns {string} rgba color string
 */
export function rgbToString(color, alpha = 1) {
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${clampedAlpha})`;
}

/**
 * Tone-maps a HDR buffer into an ImageData instance using logarithmic scaling.
 *
 * @param {Float32Array} buffer - Accumulated luminance buffer
 * @param {number} width - Width of the image in pixels
 * @param {number} height - Height of the image in pixels
 * @param {CanvasRenderingContext2D} ctx - Rendering context to reuse image data
 * @param {string} paletteName - Palette to sample while shading
 */
export function toneMapBuffer(buffer, width, height, ctx, paletteName = 'blue-aurora') {
  if (!ctx) {
    return;
  }

  const image = ctx.getImageData(0, 0, width, height);
  const pixels = image.data;

  let maxValue = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] > maxValue) {
      maxValue = buffer[i];
    }
  }
  const invLog = 1 / Math.log(1 + (maxValue || 1));

  for (let i = 0; i < buffer.length; i++) {
    const luminance = Math.log(1 + buffer[i]) * invLog;
    const color = samplePalette(paletteName, Math.pow(luminance, 0.85));
    const bloom = Math.pow(luminance, 0.6);
    const idx = i * 4;
    pixels[idx] = Math.min(255, color.r * bloom);
    pixels[idx + 1] = Math.min(255, color.g * bloom);
    pixels[idx + 2] = Math.min(255, color.b * bloom);
    pixels[idx + 3] = Math.min(255, 230 + luminance * 25);
  }

  ctx.putImageData(image, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.filter = 'blur(1px)';
  ctx.drawImage(ctx.canvas, 0, 0);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';
}
