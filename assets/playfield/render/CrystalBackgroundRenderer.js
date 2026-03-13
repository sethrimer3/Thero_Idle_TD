/**
 * Crystal Background Sprite Renderer
 *
 * Renders 9 large CrystalBackground PNG sprites around the edge of the playing field.
 * Each sprite is drawn at 110% the size of the playing field, centered so that 5% of
 * the sprite extends beyond each edge of the playing field.
 *
 * Layer groups:
 *   - Main (1):   Deepest background, no blur, no parallax.
 *   - Edge (4):   All on the same parallax plane with the same blur amount.
 *   - Corner (4): Different parallax and blur from the Main and Edge sprites;
 *                 rendered in the foreground layer for a depth-of-field effect.
 *
 * Controlled by the Crystal Background Sprites preference toggle.
 */

import { areCrystalBackgroundSpritesEnabled } from '../../preferences.js';

// Each sprite is rendered at 110% the size of the playing field so it extends
// 5% outside each edge.
const ZOOM_FACTOR = 1.1;

// Parallax factors: a value < 1 makes the layer lag behind the camera (far away);
// a value > 1 makes it lead (closer).  Main has no parallax so it always anchors
// the scene; Edge sprites sit slightly behind the camera; Corner sprites move in
// front for a foreground depth-of-field feel.
const MAIN_PARALLAX_FACTOR = 1.0;
const EDGE_PARALLAX_FACTOR = 0.94;
const CORNER_PARALLAX_FACTOR = 1.08;

// Blur radii applied when pre-rendering sprites into offscreen canvases.
// BLUR_PADDING keeps the blur from being clipped at the canvas boundary.
const MAIN_BLUR = 0;
const EDGE_BLUR = 3;
const CORNER_BLUR = 8;
const BLUR_PADDING = 20;

// Maximum cached blurred canvases (one entry per unique size + blur combination).
const BLUR_CACHE_MAX_SIZE = 24;

// ─── Sprite loading ───────────────────────────────────────────────────────────

/**
 * Load a single Image from the given URL.
 * @param {string} url
 * @returns {HTMLImageElement}
 */
function loadSprite(url) {
  const img = new Image();
  img.src = url;
  img.decoding = 'async';
  img.loading = 'eager';
  return img;
}

// Main sprite (rendered first, behind everything).
const mainSprite = loadSprite('assets/sprites/environment/CrystalBackground_Main.png');

// Edge sprites (4) – same parallax plane and blur.
const edgeSprites = [1, 2, 3, 4].map((i) =>
  loadSprite(`assets/sprites/environment/CrystalBackground_Edge (${i}).png`)
);

// Corner sprites (4) – different parallax and blur, rendered in the foreground layer.
const cornerSprites = [1, 2, 3, 4].map((i) =>
  loadSprite(`assets/sprites/environment/CrystalBackground_Corner (${i}).png`)
);

// ─── Blur caching ─────────────────────────────────────────────────────────────

// Cache key → offscreen canvas with pre-blurred sprite at a specific rendered size.
const blurredSpriteCache = new Map();

/**
 * Return (or create and cache) a pre-blurred offscreen canvas for the given sprite
 * at the specified rendered dimensions.  The canvas includes extra BLUR_PADDING so
 * the Gaussian blur is not clipped at the edges.
 *
 * @param {HTMLImageElement} img    Source sprite image.
 * @param {number}           width  Rendered sprite width in CSS pixels.
 * @param {number}           height Rendered sprite height in CSS pixels.
 * @param {number}           blur   CSS blur radius in pixels.
 * @returns {HTMLCanvasElement|null}
 */
function getBlurredSprite(img, width, height, blur) {
  if (!img || !img.complete || !img.naturalWidth) {
    return null;
  }
  const w = Math.ceil(width);
  const h = Math.ceil(height);
  const key = `${img.src}:${w}x${h}:b${blur}`;
  if (blurredSpriteCache.has(key)) {
    return blurredSpriteCache.get(key);
  }

  const pad = BLUR_PADDING;
  const canvas = document.createElement('canvas');
  canvas.width = w + pad * 2;
  canvas.height = h + pad * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(img, pad, pad, w, h);
  ctx.filter = 'none';

  // Evict oldest entry when the cache grows too large.
  if (blurredSpriteCache.size >= BLUR_CACHE_MAX_SIZE) {
    const firstKey = blurredSpriteCache.keys().next().value;
    blurredSpriteCache.delete(firstKey);
  }
  blurredSpriteCache.set(key, canvas);
  return canvas;
}

// ─── Core drawing helper ──────────────────────────────────────────────────────

/**
 * Draw a single CrystalBackground sprite onto `ctx` at 110% of the playing-field
 * dimensions, applying parallax offset and optional blur.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement}        img             The sprite to draw.
 * @param {number}                  fieldWidth      Playing-field width in CSS pixels.
 * @param {number}                  fieldHeight     Playing-field height in CSS pixels.
 * @param {{x:number,y:number}|null} viewCenter     Current camera centre for parallax.
 * @param {number}                  parallaxFactor  1.0 = no parallax; < 1 = behind; > 1 = in front.
 * @param {number}                  blurRadius      Blur to apply (0 = skip blur path).
 */
function drawBackgroundSprite(ctx, img, fieldWidth, fieldHeight, viewCenter, parallaxFactor, blurRadius) {
  if (!img || !img.complete || !img.naturalWidth) {
    return;
  }

  // Rendered size is 110% of the playing field.
  const spriteW = fieldWidth * ZOOM_FACTOR;
  const spriteH = fieldHeight * ZOOM_FACTOR;

  // Offset to center the oversized sprite on the playing field.
  const baseX = (fieldWidth - spriteW) * 0.5;
  const baseY = (fieldHeight - spriteH) * 0.5;

  // Parallax offset: background layers (factor < 1) lag; foreground layers (factor > 1) lead.
  const parallaxOffsetX = viewCenter ? viewCenter.x * (1 - parallaxFactor) : 0;
  const parallaxOffsetY = viewCenter ? viewCenter.y * (1 - parallaxFactor) : 0;

  const x = baseX + parallaxOffsetX;
  const y = baseY + parallaxOffsetY;

  if (blurRadius > 0) {
    // Draw the pre-blurred cached canvas.  It has BLUR_PADDING on each side so we
    // shift the draw position to compensate and still land the sprite in the right place.
    const blurred = getBlurredSprite(img, spriteW, spriteH, blurRadius);
    if (blurred) {
      ctx.drawImage(blurred, x - BLUR_PADDING, y - BLUR_PADDING, blurred.width, blurred.height);
      return;
    }
    // Fallback: draw unblurred if the cache canvas could not be created.
  }

  ctx.drawImage(img, x, y, spriteW, spriteH);
}

// ─── Exported render functions ────────────────────────────────────────────────

/**
 * Render the background layer of crystal sprites (Main + 4 Edge sprites).
 * Called before game elements so these sprites sit at the deepest visual plane.
 * Uses `.call(renderer)` convention matching the rest of the render layer system.
 */
export function drawCrystalBackground() {
  if (!this.ctx) {
    return;
  }
  if (!areCrystalBackgroundSpritesEnabled()) {
    return;
  }

  const fieldWidth = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const fieldHeight = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  if (!fieldWidth || !fieldHeight) {
    return;
  }

  const viewCenter = this.getViewCenter ? this.getViewCenter() : null;
  const ctx = this.ctx;

  // Draw Main sprite – no parallax, no blur.
  drawBackgroundSprite(ctx, mainSprite, fieldWidth, fieldHeight, viewCenter, MAIN_PARALLAX_FACTOR, MAIN_BLUR);

  // Draw Edge sprites – all on the same parallax plane with the same blur.
  for (let i = 0; i < edgeSprites.length; i++) {
    drawBackgroundSprite(ctx, edgeSprites[i], fieldWidth, fieldHeight, viewCenter, EDGE_PARALLAX_FACTOR, EDGE_BLUR);
  }
}

/**
 * Render the foreground layer of crystal sprites (4 Corner sprites).
 * Called after game elements so these blurred sprites overlay the play area,
 * creating a depth-of-field effect at the corners.
 * Uses `.call(renderer)` convention matching the rest of the render layer system.
 */
export function drawForegroundCrystalBackground() {
  if (!this.ctx) {
    return;
  }
  if (!areCrystalBackgroundSpritesEnabled()) {
    return;
  }

  const fieldWidth = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const fieldHeight = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  if (!fieldWidth || !fieldHeight) {
    return;
  }

  const viewCenter = this.getViewCenter ? this.getViewCenter() : null;
  const ctx = this.ctx;

  // Draw Corner sprites – different parallax and blur from the background layers.
  for (let i = 0; i < cornerSprites.length; i++) {
    drawBackgroundSprite(ctx, cornerSprites[i], fieldWidth, fieldHeight, viewCenter, CORNER_PARALLAX_FACTOR, CORNER_BLUR);
  }
}
