/**
 * Parallax starfield renderer for the Lamed Spire gravity simulation canvas.
 *
 * Ported from the "Reworked Parallax Stars" system in sethrimer3/SoL
 * (src/render/starfield-renderer.ts, commit 520dbcc694fd1c0d11ad2b2b594c6918182d7889).
 *
 * Adaptations:
 * - Converted from TypeScript to vanilla JavaScript with JSDoc comments.
 * - Star counts scaled to ~40% of SoL values for mobile performance.
 * - Ambient drift camera (no user-controlled panning) using sinusoidal orbit.
 * - Exported as an ES6 class compatible with the project's module system.
 */

// Coordinate wrap space matching the SoL original.
const STAR_WRAP_SIZE = 4000;

// Cinematic orange palette: warm gold → cool blue-white (7 entries).
const CINEMATIC_PALETTE_RGB = [
  [255, 178, 26],
  [255, 191, 104],
  [249, 216, 162],
  [255, 235, 198],
  [255, 246, 228],
  [241, 245, 251],
  [232, 239, 255],
];

// Layer configurations scaled to ~40% of SoL counts for mobile canvas performance.
const LAYER_CONFIGS = [
  { count: 960,  parallaxFactor: 0.22, sizeMinPx: 0.8, sizeMaxPx: 2.1 },
  { count: 680,  parallaxFactor: 0.30, sizeMinPx: 1.0, sizeMaxPx: 2.5 },
  { count: 440,  parallaxFactor: 0.38, sizeMinPx: 1.2, sizeMaxPx: 2.9 },
];

/**
 * Sample a palette index from the reworked parallax palette using weighted distribution.
 * @param {number} r - A random value in [0, 1).
 * @returns {number} Palette index 0–6.
 */
function samplePaletteIndex(r) {
  if (r < 0.20) return 0;
  if (r < 0.36) return 1;
  if (r < 0.52) return 2;
  if (r < 0.68) return 3;
  if (r < 0.82) return 4;
  if (r < 0.92) return 5;
  return 6;
}

/**
 * Create an offscreen canvas for a star core: 64×64, radial gradient
 * white center → palette color → transparent edge.
 * @param {number[]} colorRgb - [r, g, b] palette color.
 * @returns {HTMLCanvasElement}
 */
function createCoreCacheCanvas(colorRgb) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  gradient.addColorStop(0.0, `rgba(255, 255, 255, 1)`);
  gradient.addColorStop(0.25, `rgba(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]}, 0.9)`);
  gradient.addColorStop(0.6, `rgba(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]}, 0.4)`);
  gradient.addColorStop(1.0, `rgba(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/**
 * Create an offscreen canvas for a star halo: 96×96, radial gradient
 * palette color center → transparent edge.
 * @param {number[]} colorRgb - [r, g, b] palette color.
 * @returns {HTMLCanvasElement}
 */
function createHaloCacheCanvas(colorRgb) {
  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const gradient = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  gradient.addColorStop(0.0, `rgba(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]}, 0.6)`);
  gradient.addColorStop(0.4, `rgba(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]}, 0.2)`);
  gradient.addColorStop(1.0, `rgba(${colorRgb[0]}, ${colorRgb[1]}, ${colorRgb[2]}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/**
 * Render a two-pixel chromatic aberration split on a bright star.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Star screen X.
 * @param {number} y - Star screen Y.
 * @param {number} sizePx - Rendered star radius in pixels.
 * @param {number} alpha - Base alpha for aberration.
 * @param {number[]} colorRgb - [r, g, b] palette color.
 */
function renderChromaticAberration(ctx, x, y, sizePx, alpha, colorRgb) {
  const offsetPx = Math.min(0.45, sizePx * 0.1);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = `rgba(${Math.min(255, colorRgb[0] + 20)}, 92, 92, 0.65)`;
  ctx.beginPath();
  ctx.arc(x - offsetPx, y, sizePx * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(118, ${Math.min(255, colorRgb[1] + 16)}, 255, 0.62)`;
  ctx.beginPath();
  ctx.arc(x + offsetPx, y, sizePx * 0.34, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Parallax starfield renderer for the Lamed Spire canvas.
 *
 * Uses a seeded deterministic RNG to place stars in three depth layers.
 * An ambient sinusoidal camera orbit makes the parallax motion visible
 * even though the Lamed simulation has no user-controlled panning.
 */
export class LamedStarfieldRenderer {
  constructor() {
    // Pre-build per-palette offscreen canvases so draw calls only blit pixels.
    this._coreCaches = CINEMATIC_PALETTE_RGB.map(createCoreCacheCanvas);
    this._haloCaches = CINEMATIC_PALETTE_RGB.map(createHaloCacheCanvas);
    this._layers = this._initLayers();
  }

  /**
   * Initialise star layers using a seeded LCG for deterministic layout.
   * @returns {Array<{stars: Array, parallaxFactor: number}>}
   */
  _initLayers() {
    let seed = 7331;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    return LAYER_CONFIGS.map((cfg) => {
      const stars = [];
      for (let i = 0; i < cfg.count; i++) {
        const sizePx = cfg.sizeMinPx + rand() * (cfg.sizeMaxPx - cfg.sizeMinPx);
        const brightness = 0.48 + rand() * 0.5;
        const colorIndex = samplePaletteIndex(rand());
        stars.push({
          x: rand() * STAR_WRAP_SIZE - STAR_WRAP_SIZE / 2,
          y: rand() * STAR_WRAP_SIZE - STAR_WRAP_SIZE / 2,
          sizePx,
          haloScale: 3.6 + rand() * 2.4,
          brightness,
          colorRgb: CINEMATIC_PALETTE_RGB[colorIndex],
          colorIndex,
          flickerHz: 0.08 + rand() * 0.1,
          phase: rand() * Math.PI * 2,
          hasChromaticAberration: sizePx > 2.05 && brightness > 0.8 && rand() > 0.45,
        });
      }
      return { stars, parallaxFactor: cfg.parallaxFactor };
    });
  }

  /**
   * Draw the parallax starfield onto the provided canvas context.
   *
   * Call this immediately after clearing the black background and before
   * any other simulation elements are rendered.
   *
   * @param {CanvasRenderingContext2D} ctx - 2D rendering context.
   * @param {number} screenWidth  - Canvas CSS pixel width.
   * @param {number} screenHeight - Canvas CSS pixel height.
   * @param {string} graphicsQuality - 'low' | 'medium' | 'high'.
   * @param {number} [starSizeScale=1] - Global size multiplier for all stars.
   *   Pass a value > 1 to make stars appear large (early-game, proto-star),
   *   and < 1 to shrink them to specks (late-game, black hole).
   */
  draw(ctx, screenWidth, screenHeight, graphicsQuality, starSizeScale = 1) {
    const nowSeconds = performance.now() * 0.001;

    // Ambient sinusoidal orbit camera — provides visible parallax without user input.
    const cameraX = Math.cos(nowSeconds * 0.03) * 120;
    const cameraY = Math.sin(nowSeconds * 0.04) * 80;

    const centerX = screenWidth * 0.5;
    const centerY = screenHeight * 0.5;
    const wrapSpanX = centerX * 2 + STAR_WRAP_SIZE;
    const wrapSpanY = centerY * 2 + STAR_WRAP_SIZE;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const layer of this._layers) {
      const parallaxX = cameraX * layer.parallaxFactor;
      const parallaxY = cameraY * layer.parallaxFactor;
      const depthScale = Math.min(1, 0.48 + layer.parallaxFactor * 1.08);
      const depthAlpha = 0.5 + depthScale * 0.5;
      const depthSizeMultiplier = 0.84 + depthScale * 0.62;
      const haloAlphaMultiplier = 0.56 + depthScale * 0.44;

      for (const star of layer.stars) {
        const screenX = centerX + (star.x - parallaxX);
        const screenY = centerY + (star.y - parallaxY);

        // Wrap coordinates into the visible range to tile the star field seamlessly.
        const wrappedX = ((screenX + centerX) % wrapSpanX) - centerX;
        const wrappedY = ((screenY + centerY) % wrapSpanY) - centerY;

        // Skip stars entirely outside the canvas + halo margin.
        if (
          wrappedX < -140 || wrappedX > screenWidth + 140 ||
          wrappedY < -140 || wrappedY > screenHeight + 140
        ) {
          continue;
        }

        const flicker = 1 + 0.03 * Math.sin(star.phase + nowSeconds * Math.PI * 2 * star.flickerHz);
        const alpha = star.brightness * flicker * depthAlpha;
        const renderedSizePx = star.sizePx * depthSizeMultiplier * starSizeScale;

        // Draw halo (soft glow).
        const haloRadiusPx = renderedSizePx * star.haloScale;
        ctx.globalAlpha = alpha * haloAlphaMultiplier;
        ctx.drawImage(
          this._haloCaches[star.colorIndex],
          wrappedX - haloRadiusPx, wrappedY - haloRadiusPx,
          haloRadiusPx * 2, haloRadiusPx * 2,
        );

        // Draw core (sharp bright centre).
        const coreRadiusPx = renderedSizePx * 0.95;
        ctx.globalAlpha = alpha;
        ctx.drawImage(
          this._coreCaches[star.colorIndex],
          wrappedX - coreRadiusPx, wrappedY - coreRadiusPx,
          coreRadiusPx * 2, coreRadiusPx * 2,
        );

        // Chromatic aberration on bright, large stars — skip on low graphics.
        if (star.hasChromaticAberration && graphicsQuality !== 'low') {
          renderChromaticAberration(ctx, wrappedX, wrappedY, renderedSizePx, alpha * 0.17, star.colorRgb);
        }
      }
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
