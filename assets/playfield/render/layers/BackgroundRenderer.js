/**
 * Background Renderer
 *
 * Handles all static and floating background visual elements for the playfield:
 * - Crystalline mosaic edge decorations
 * - Level sketch overlays (random decorative sketches)
 * - Floater lattice (floating circles with connection lines)
 * - Background swimmer entities
 * - Chapter 5 Tetris-block walking ambient effect
 *
 * All exported functions are designed to be called with `.call(renderer)` where
 * `renderer` is the CanvasRenderer / SimplePlayfield instance, matching the
 * established calling convention in CanvasRenderer.js.
 *
 * Extracted from CanvasRenderer.js as part of Phase 2.2.1 of the Monolithic
 * Refactoring Plan (Build 486).
 */

import { areEdgeCrystalsEnabled, areBackgroundParticlesEnabled } from '../../../preferences.js';
import { getCrystallineMosaicManager } from '../CrystallineMosaic.js';
import {
  drawCrystalBackground as _drawCrystalBackground,
  drawForegroundCrystalBackground as _drawForegroundCrystalBackground,
} from '../CrystalBackgroundRenderer.js';
import { createTetrisBlockEffect } from '../TetrisBlockEffect.js';
import { createVermiculateEffect } from '../VermiculateEffect.js';
import { createSubstrateEffect } from '../SubstrateEffect.js';
import { createGravityGridEffect } from '../GravityGridEffect.js';
import { createEulerFluidEffect } from '../EulerFluidEffect.js';

// Pre-calculated constants shared across background rendering functions
const TWO_PI = Math.PI * 2;
const HALF = 0.5;
const SWIMMER_VIEWPORT_MARGIN = 12;

// Small sketch sprites loaded once at module initialisation for background decoration.
// Each sprite has a 10% chance of appearing per level at a random position and rotation.
const sketchSprites = [
  'assets/sprites/sketches/sketch_small_1.webp',
  'assets/sprites/sketches/sketch_small_2.webp',
  'assets/sprites/sketches/sketch_small_3.webp',
  'assets/sprites/sketches/sketch_small_4.webp',
].map((url) => {
  const img = new Image();
  img.src = url;
  img.decoding = 'async';
  img.loading = 'eager';
  return img;
});

// ─── Crystalline Mosaic ───────────────────────────────────────────────────────

/**
 * Render the background-layer crystalline mosaic edge decorations.
 * Called as the first layer in the render stack so background crystals appear beneath all
 * game elements. Foreground shards are rendered separately after projectiles.
 */
export function drawCrystallineMosaic() {
  if (!this.ctx) {
    return;
  }

  // Skip rendering if edge crystals are disabled in preferences
  if (!areEdgeCrystalsEnabled()) {
    return;
  }

  const mosaicManager = getCrystallineMosaicManager();
  if (!mosaicManager) {
    return;
  }

  // Viewport bounds are pre-computed at frame start and stored in _frameCache.
  // These change with zoom and are used only for visibility culling.
  const viewportBounds = this._frameCache?.viewportBounds;
  if (!viewportBounds) {
    return;
  }

  // Level world bounds are stable across zoom/pan – crystals are generated here
  // so they never reposition when the player zooms in or out.
  const renderWidth = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const renderHeight = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  // Match mosaic generation bounds to the same zoom-out envelope used by other ambient effects.
  const ambientBounds = typeof this.getAmbientEffectBounds === 'function'
    ? this.getAmbientEffectBounds()
    : null;
  const levelBounds = ambientBounds && ambientBounds.width && ambientBounds.height
    ? ambientBounds
    : ((renderWidth && renderHeight)
      ? { minX: 0, minY: 0, maxX: renderWidth, maxY: renderHeight }
      : null);

  // Get path points for distance checking
  const pathPoints = this.pathPoints || [];

  // Use level config as version tracker (regenerate if level changes)
  const pathVersion = this.levelConfig?.id || null;

  // Current camera centre for parallax calculation
  const viewCenter = this.getViewCenter ? this.getViewCenter() : null;
  // Pass frame timing and pixel density so the mosaic can reuse raster caches safely.
  const renderState = {
    pixelRatio: Math.max(1, this.pixelRatio || 1),
    timestamp: this._frameCache?.timestamp || 0,
  };

  // Render only the background layer; foreground layer is drawn after projectiles.
  const ctx = this.ctx;
  mosaicManager.renderBackground(ctx, viewportBounds, levelBounds, pathPoints, pathVersion, viewCenter, renderState);
}

/**
 * Render the foreground-layer crystalline mosaic shards.
 * These are blurred and drawn in front of towers, projectiles and particles so they
 * appear as close-up crystal fragments overlaying the play area.
 */
export function drawForegroundCrystallineMosaic() {
  if (!this.ctx) {
    return;
  }

  // Respect the same preference as the background layer.
  if (!areEdgeCrystalsEnabled()) {
    return;
  }

  const mosaicManager = getCrystallineMosaicManager();
  if (!mosaicManager) {
    return;
  }

  const viewportBounds = this._frameCache?.viewportBounds;
  if (!viewportBounds) {
    return;
  }

  const renderWidth = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const renderHeight = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  // Match mosaic generation bounds to the same zoom-out envelope used by other ambient effects.
  const ambientBounds = typeof this.getAmbientEffectBounds === 'function'
    ? this.getAmbientEffectBounds()
    : null;
  const levelBounds = ambientBounds && ambientBounds.width && ambientBounds.height
    ? ambientBounds
    : ((renderWidth && renderHeight)
      ? { minX: 0, minY: 0, maxX: renderWidth, maxY: renderHeight }
      : null);

  const pathPoints = this.pathPoints || [];
  const pathVersion = this.levelConfig?.id || null;
  const viewCenter = this.getViewCenter ? this.getViewCenter() : null;
  // Reuse the same render-state metadata for the foreground cache path.
  const renderState = {
    pixelRatio: Math.max(1, this.pixelRatio || 1),
    timestamp: this._frameCache?.timestamp || 0,
  };

  const ctx = this.ctx;
  mosaicManager.renderForeground(ctx, viewportBounds, levelBounds, pathPoints, pathVersion, viewCenter, renderState);
}

// ─── Level Sketch Layer ───────────────────────────────────────────────────────

/**
 * Generate random sketch placements for a level.
 * Each sketch has a 10% chance of appearing, with random position and rotation.
 * Uses level ID as seed for consistent placement across sessions.
 *
 * @param {string|number} levelId - Unique level identifier used as RNG seed
 * @param {number} width - Playfield width in pixels
 * @param {number} height - Playfield height in pixels
 * @returns {Array<{sprite, x, y, rotation, scale}>} Array of sketch placement descriptors
 */
function generateLevelSketches(levelId, width, height) {
  if (!levelId || !width || !height) {
    return [];
  }

  // Simple seeded random number generator for consistent sketch placement per level
  const seed = Array.from(String(levelId)).reduce((acc, char) => acc + char.charCodeAt(0), 1) || 1;
  let randomState = seed;
  const seededRandom = () => {
    randomState = (randomState * 1103515245 + 12345) & 0x7fffffff;
    return randomState / 0x7fffffff;
  };

  const sketches = [];

  // Each sketch has a 10% chance of appearing
  sketchSprites.forEach((spriteImage) => {
    if (seededRandom() < 0.1) {
      // Random position within level bounds (with some margin)
      const margin = Math.min(width, height) * 0.1;
      const x = margin + seededRandom() * (width - 2 * margin);
      const y = margin + seededRandom() * (height - 2 * margin);

      // Random rotation (0 to 360 degrees)
      const rotation = seededRandom() * TWO_PI;

      // Random scale variation (80% to 120% of original size)
      const scale = 0.8 + seededRandom() * 0.4;

      sketches.push({
        sprite: spriteImage,
        x,
        y,
        rotation,
        scale,
      });
    }
  });

  return sketches;
}

/**
 * Draw the cached sketch placements onto the provided context so we can reuse
 * them in offscreen layers.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 */
function drawSketchesOnContext(ctx, width, height) {
  if (!ctx || !this.levelConfig) {
    return;
  }

  // Generate sketches for this level if not already cached or if dimensions changed.
  if (
    !this._levelSketches ||
    this._levelSketchesId !== this.levelConfig.id ||
    this._levelSketchesWidth !== width ||
    this._levelSketchesHeight !== height
  ) {
    this._levelSketches = generateLevelSketches(this.levelConfig.id, width, height);
    this._levelSketchesId = this.levelConfig.id;
    this._levelSketchesWidth = width;
    this._levelSketchesHeight = height;
  }

  if (!this._levelSketches || !this._levelSketches.length) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = 0.2; // 20% opacity

  this._levelSketches.forEach((sketch) => {
    if (!sketch.sprite || !sketch.sprite.complete) {
      return;
    }

    ctx.save();
    ctx.translate(sketch.x, sketch.y);
    ctx.rotate(sketch.rotation);

    const sketchWidth = sketch.sprite.width * sketch.scale;
    const sketchHeight = sketch.sprite.height * sketch.scale;

    ctx.drawImage(
      sketch.sprite,
      -sketchWidth * HALF,
      -sketchHeight * HALF,
      sketchWidth,
      sketchHeight
    );

    ctx.restore();
  });

  ctx.restore();
}

/**
 * Build a stable cache key for the sketch layer so zoom changes don't trigger
 * re-rasterization.
 *
 * @param {number} width
 * @param {number} height
 * @returns {string}
 */
function getSketchLayerCacheKey(width, height) {
  const levelId = this.levelConfig?.id || 'unknown-level';
  const pixelRatio = Math.max(1, this.pixelRatio || 1);
  return `${levelId}:${width}x${height}:pr${pixelRatio}`;
}

/**
 * Rasterize the sketches into an offscreen canvas so the main render loop can
 * reuse the layer across frames.
 *
 * @param {number} width
 * @param {number} height
 * @returns {{key, canvas, width, height, pixelRatio}|null}
 */
function buildSketchLayerCache(width, height) {
  if (!width || !height || !this.levelConfig) {
    return null;
  }
  const key = getSketchLayerCacheKey.call(this, width, height);
  if (this._sketchLayerCache?.key === key) {
    return this._sketchLayerCache;
  }
  const pixelRatio = Math.max(1, this.pixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width * pixelRatio));
  canvas.height = Math.max(1, Math.floor(height * pixelRatio));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  drawSketchesOnContext.call(this, ctx, width, height);
  this._sketchLayerCache = {
    key,
    canvas,
    width,
    height,
    pixelRatio,
  };
  return this._sketchLayerCache;
}

/**
 * Paint the cached sketch layer onto the main canvas when available.
 * Returns `true` if the cached layer was drawn (skip the live draw call).
 *
 * @returns {boolean}
 */
export function drawSketchLayerCache() {
  if (!this.ctx) {
    return false;
  }
  const width =
    this._frameCache?.width ||
    (this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0);
  const height =
    this._frameCache?.height ||
    (this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0);
  const cache = buildSketchLayerCache.call(this, width, height);
  if (!cache?.canvas) {
    return false;
  }
  this.ctx.drawImage(cache.canvas, 0, 0, width, height);
  return true;
}

/**
 * Draw small sketches in the background with 20% opacity.
 * Sketches are randomly placed per level with a 10% chance each.
 * Skips if a valid sketch layer cache already exists (caller should check first).
 */
export function drawSketches() {
  if (!this.ctx || !this.levelConfig) {
    return;
  }

  const ctx = this.ctx;

  // Generate sketches for this level if not already cached or if dimensions changed.
  const width =
    this._frameCache?.width ||
    (this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0);
  const height =
    this._frameCache?.height ||
    (this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0);

  drawSketchesOnContext.call(this, ctx, width, height);
}

// ─── Floater Lattice ─────────────────────────────────────────────────────────

/**
 * Render the background floater lattice: faint circles connected by thin lines,
 * plus optional background swimmers that orbit beneath the lattice.
 */
export function drawFloaters() {
  if (!this.ctx || !this.floaters.length || !this.levelConfig) {
    return;
  }
  // Skip rendering if background particles are disabled in preferences
  if (!areBackgroundParticlesEnabled()) {
    return;
  }
  // Use cached frame values to reduce redundant calculations
  const width =
    this._frameCache?.width ||
    (this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0);
  const height =
    this._frameCache?.height ||
    (this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0);
  if (!width || !height) {
    return;
  }
  const minDimension = this._frameCache?.minDimension || (Math.min(width, height) || 1);
  const connectionWidth = Math.max(0.6, minDimension * 0.0014);
  const viewportBounds = this._frameCache?.viewportBounds || null;

  const ctx = this.ctx;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const swimmers = Array.isArray(this.backgroundSwimmers) ? this.backgroundSwimmers : [];
  if (swimmers.length) {
    // Render blurred swimmer particles whose opacity is dictated by speed.
    // A cached offscreen canvas stores the blurred dot so the per-frame blur filter is avoided.
    const baseSize = Math.max(1.2, minDimension * 0.005);
    const spriteKey = Math.round(baseSize * 10);
    if (!this._swimmerSpriteCache || this._swimmerSpriteCache.key !== spriteKey) {
      const spriteRadius = Math.ceil(baseSize * 3);
      const spriteDiameter = spriteRadius * 2;
      const offscreen = document.createElement('canvas');
      offscreen.width = spriteDiameter;
      offscreen.height = spriteDiameter;
      const offCtx = offscreen.getContext('2d');
      offCtx.filter = `blur(${Math.max(1, baseSize * 0.8)}px)`;
      offCtx.fillStyle = 'rgba(255, 255, 255, 1)';
      offCtx.beginPath();
      offCtx.arc(spriteRadius, spriteRadius, baseSize, 0, TWO_PI);
      offCtx.fill();
      offCtx.filter = 'none';
      this._swimmerSpriteCache = { canvas: offscreen, key: spriteKey, radius: spriteRadius };
    }
    const sprite = this._swimmerSpriteCache.canvas;
    const spriteRadius = this._swimmerSpriteCache.radius;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < swimmers.length; i += 1) {
      const swimmer = swimmers[i];
      if (swimmer?.isViewportActive === false) {
        continue;
      }
      const sizeScale = Number.isFinite(swimmer.sizeScale) ? swimmer.sizeScale : 1;
      const scaledRadius = spriteRadius * sizeScale;
      if (
        viewportBounds &&
        (
          swimmer.x + scaledRadius + SWIMMER_VIEWPORT_MARGIN < viewportBounds.minX ||
          swimmer.x - scaledRadius - SWIMMER_VIEWPORT_MARGIN > viewportBounds.maxX ||
          swimmer.y + scaledRadius + SWIMMER_VIEWPORT_MARGIN < viewportBounds.minY ||
          swimmer.y - scaledRadius - SWIMMER_VIEWPORT_MARGIN > viewportBounds.maxY
        )
      ) {
        continue;
      }
      // Opacity driven by speed above the hidden baseline drift: moderate motion tops out around 40% alpha.
      const visibility = typeof this.computeSwimmerVisibility === 'function'
        ? this.computeSwimmerVisibility(swimmer)
        : 0;
      const speedAlpha = Math.min(0.4, visibility * 0.4);
      if (speedAlpha < 0.005) {
        continue;
      }
      ctx.globalAlpha = speedAlpha;
      const drawSize = spriteRadius * 2 * sizeScale;
      ctx.drawImage(sprite, swimmer.x - scaledRadius, swimmer.y - scaledRadius, drawSize, drawSize);
    }
    ctx.restore();
  }

  // Batch floater connection lines: all connections share the same lineWidth,
  // so group by alpha bucket to reduce stroke calls.
  if (this.floaterConnections.length) {
    ctx.lineWidth = connectionWidth;
    for (let i = 0; i < this.floaterConnections.length; i += 1) {
      const connection = this.floaterConnections[i];
      const from = this.floaters[connection.from];
      const to = this.floaters[connection.to];
      if (!from || !to) {
        continue;
      }
      const alpha = Math.max(0, Math.min(1, connection.strength || 0)) * 0.25;
      if (alpha <= 0) {
        continue;
      }
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
  }

  // Render floater circles using globalAlpha instead of per-floater rgba strings.
  ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
  for (let i = 0; i < this.floaters.length; i += 1) {
    const floater = this.floaters[i];
    const opacity = Math.max(0, Math.min(1, floater.opacity || 0));
    if (opacity <= 0) {
      continue;
    }
    let radiusFactor = Number.isFinite(floater.radiusFactor) ? floater.radiusFactor : null;
    if (!radiusFactor) {
      radiusFactor = this.randomFloaterRadiusFactor();
      floater.radiusFactor = radiusFactor;
    }
    const radius = Math.max(2, radiusFactor * minDimension);
    const strokeWidth = Math.max(0.8, radius * 0.22);
    ctx.lineWidth = strokeWidth;
    ctx.globalAlpha = opacity * 0.25;
    ctx.beginPath();
    ctx.arc(floater.x, floater.y, radius, 0, TWO_PI);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Crystal Background Sprites ──────────────────────────────────────────────

/**
 * Render the background layer of CrystalBackground sprites (Main + Edge).
 * Delegates to CrystalBackgroundRenderer using the `.call(renderer)` convention.
 */
export function drawCrystalBackground() {
  _drawCrystalBackground.call(this);
}

/**
 * Render the foreground layer of CrystalBackground sprites (Corner sprites).
 * Delegates to CrystalBackgroundRenderer using the `.call(renderer)` convention.
 */
export function drawForegroundCrystalBackground() {
  _drawForegroundCrystalBackground.call(this);
}

// ─── Chapter 5 – Tetris Block Walking Effect ──────────────────────────────────

// Module-level singleton so state persists across frames.
let _tetrisBlockEffect = null;

// Track the last chapter theme so the effect resets when the player re-enters chapter 5.
let _tetrisLastChapterTheme = null;

/**
 * Render the animated Tetris-block walking cluster exclusive to Chapter 5
 * (the dark-red background chapter).  Grid-aligned blocks fade in and out,
 * with the connected cluster drifting slowly in a smoothly changing random
 * direction.  Nothing physically moves – the visible set of cells shifts,
 * producing the "walking" illusion.
 *
 * Called with `.call(renderer)` so `this` is the CanvasRenderer instance.
 */
export function drawChapter5TetrisBlocks() {
  if (!this.ctx) {
    return;
  }

  // Only active while inside Chapter 5 (the red chapter).
  const chapterTheme = this.container?.dataset?.chapterTheme;
  if (chapterTheme !== 'chapter-5') {
    // Reset the effect when leaving chapter 5 so it feels fresh on re-entry.
    if (_tetrisLastChapterTheme === 'chapter-5' && _tetrisBlockEffect) {
      _tetrisBlockEffect.reset();
    }
    _tetrisLastChapterTheme = chapterTheme || null;
    return;
  }
  _tetrisLastChapterTheme = 'chapter-5';

  // Skip when background particles preference is off.
  if (!areBackgroundParticlesEnabled()) {
    return;
  }

  // Logical viewport dimensions in CSS pixels.
  const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  if (!width || !height) {
    return;
  }

  // Lazy-create the effect singleton.
  if (!_tetrisBlockEffect) {
    _tetrisBlockEffect = createTetrisBlockEffect();
  }

  // Current high-resolution timestamp from the frame cache.
  const nowMs = this._frameCache?.timestamp ?? performance.now();

  // Advance simulation.
  _tetrisBlockEffect.update(nowMs, width, height);

  // Draw in world space: the ctx already carries the camera transform so the
  // block cluster moves and scales correctly with the player's zoom / pan.
  const ctx = this.ctx;
  ctx.save();
  _tetrisBlockEffect.draw(ctx);
  ctx.restore();
}

// ─── Chapter 1 – Vermiculate Worm-Line Effect ─────────────────────────────────

// Module-level singleton so state persists across frames.
let _vermiculateEffect = null;

// Track the last chapter theme so the effect resets when the player leaves chapter 1.
let _vermiculateLastChapterTheme = null;

/**
 * Render the Chapter 1 "Vermiculate" ambient background decoration.
 * Glowing worm-like paths (straight and curved) crawl across the viewport,
 * leaving fading trails and bouncing off each other.  A glowing ball at each
 * worm's head gives the impression that something is actively drawing the line.
 *
 * Called with `.call(renderer)` so `this` is the CanvasRenderer instance.
 */
export function drawChapter1Vermiculate() {
  if (!this.ctx) {
    return;
  }

  // Only active inside Chapter 1.
  const chapterTheme = this.container?.dataset?.chapterTheme;
  if (chapterTheme !== 'chapter-1') {
    // Reset the effect when leaving so it feels fresh on re-entry.
    if (_vermiculateLastChapterTheme === 'chapter-1' && _vermiculateEffect) {
      _vermiculateEffect.reset();
    }
    _vermiculateLastChapterTheme = chapterTheme || null;
    return;
  }
  _vermiculateLastChapterTheme = 'chapter-1';

  // Skip when background particles preference is off.
  if (!areBackgroundParticlesEnabled()) {
    return;
  }

  // Logical viewport dimensions in CSS pixels.
  const width  = this.renderWidth  || (this.canvas ? this.canvas.clientWidth  : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  if (!width || !height) {
    return;
  }

  // Lazy-create the effect singleton.
  if (!_vermiculateEffect) {
    _vermiculateEffect = createVermiculateEffect();
  }

  // Current high-resolution timestamp from the frame cache.
  const nowMs = this._frameCache?.timestamp ?? performance.now();

  // Advance simulation.
  _vermiculateEffect.update(nowMs, width, height);

  // Draw in world space: the ctx already carries the camera transform so the
  // worm paths move and scale correctly with the player's zoom / pan.
  const ctx = this.ctx;
  ctx.save();
  _vermiculateEffect.draw(ctx);
  ctx.restore();
}

// ─── Chapter 6 – Substrate Crystalline Crack Effect ──────────────────────────

// Module-level singleton so state persists across frames.
let _substrateEffect = null;

// Track the last chapter theme so the effect resets when the player leaves chapter 6.
let _substrateLastChapterTheme = null;

/**
 * Render the Chapter 6 "Substrate" ambient background decoration.
 * Crystalline crack lines grow across the viewport following a perpendicular
 * growth rule, creating intricate city-like structures.  Soft pastel sand fills
 * the regions between cracks.  Inspired by the XScreenSaver "Substrate" by
 * J. Tarbell (2004).
 *
 * Called with `.call(renderer)` so `this` is the CanvasRenderer instance.
 */
export function drawChapter6Substrate() {
  if (!this.ctx) {
    return;
  }

  // Only active inside Chapter 6.
  const chapterTheme = this.container?.dataset?.chapterTheme;
  if (chapterTheme !== 'chapter-6') {
    // Reset the effect when leaving so it feels fresh on re-entry.
    if (_substrateLastChapterTheme === 'chapter-6' && _substrateEffect) {
      _substrateEffect.reset();
    }
    _substrateLastChapterTheme = chapterTheme || null;
    return;
  }
  _substrateLastChapterTheme = 'chapter-6';

  // Skip when background particles preference is off.
  if (!areBackgroundParticlesEnabled()) {
    return;
  }

  // Logical viewport dimensions in CSS pixels.
  const width  = this.renderWidth  || (this.canvas ? this.canvas.clientWidth  : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  if (!width || !height) {
    return;
  }

  // Lazy-create the effect singleton.
  if (!_substrateEffect) {
    _substrateEffect = createSubstrateEffect();
  }

  // Current high-resolution timestamp from the frame cache.
  const nowMs = this._frameCache?.timestamp ?? performance.now();

  // Advance simulation.
  _substrateEffect.update(nowMs, width, height);

  // Draw in world space: the ctx already carries the camera transform set by
  // CanvasRenderer.draw(), so the substrate lines zoom and pan correctly with
  // the player's view – matching the behaviour of the other ambient effects
  // (Vermiculate, TetrisBlocks, GravityGrid, EulerFluid).
  const ctx = this.ctx;
  ctx.save();
  _substrateEffect.draw(ctx);
  ctx.restore();
}

// ─── Prologue / Chapter 2 – Gravity Grid Effect ─────────────────────────────

// Module-level singleton so state persists across frames.
let _gravityGridEffect = null;

// Track the last chapter theme so the effect resets when leaving active chapters.
let _gravityGridLastTheme = null;

/**
 * Render the Gravity Grid ambient background decoration.
 * A faint white grid is warped inward by gravity-well sources (small balls,
 * towers, enemies, gates) and pushed outward by a large white-hole ball.
 * Active during the Prologue and Chapter 2.
 *
 * Called with `.call(renderer)` so `this` is the CanvasRenderer instance.
 */
export function drawGravityGrid() {
  if (!this.ctx) {
    return;
  }

  // Only active inside the Prologue or Chapter 2.
  const chapterTheme = this.container?.dataset?.chapterTheme;
  const isActive = chapterTheme === 'prologue' || chapterTheme === 'chapter-2';

  if (!isActive) {
    // Reset the effect when leaving so it feels fresh on re-entry.
    if (
      (_gravityGridLastTheme === 'prologue' || _gravityGridLastTheme === 'chapter-2') &&
      _gravityGridEffect
    ) {
      _gravityGridEffect.reset();
    }
    _gravityGridLastTheme = chapterTheme || null;
    return;
  }
  _gravityGridLastTheme = chapterTheme;

  // Skip when background particles preference is off.
  if (!areBackgroundParticlesEnabled()) {
    return;
  }

  // Logical viewport dimensions in CSS pixels.
  const width  = this.renderWidth  || (this.canvas ? this.canvas.clientWidth  : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  if (!width || !height) {
    return;
  }

  // Lazy-create the effect singleton.
  if (!_gravityGridEffect) {
    _gravityGridEffect = createGravityGridEffect();
  }

  // ── Collect game entities as gravity-well sources (world-space) ───────
  // Sources are passed in world coordinates – no screen-space conversion
  // needed now that the effect is drawn in the camera's world transform.
  const sources = [];

  // Towers → gravity wells.
  if (this.towers) {
    for (let i = 0; i < this.towers.length; i++) {
      const t = this.towers[i];
      if (!t || !Number.isFinite(t.x) || !Number.isFinite(t.y)) continue;
      sources.push({ x: t.x, y: t.y, mass: 2, radius: 20 });
    }
  }

  // Enemies → gravity wells.
  if (this.enemies) {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e) continue;
      const pos = this.getEnemyPosition ? this.getEnemyPosition(e) : null;
      if (!pos) continue;
      sources.push({ x: pos.x, y: pos.y, mass: 1, radius: 12 });
    }
  }

  // Gates (first and last path waypoints) → gravity wells.
  if (this.pathPoints && this.pathPoints.length >= 2) {
    const first = this.pathPoints[0];
    const last  = this.pathPoints[this.pathPoints.length - 1];
    if (first) sources.push({ x: first.x, y: first.y, mass: 3, radius: 25 });
    if (last)  sources.push({ x: last.x,  y: last.y,  mass: 3, radius: 25 });
  }

  // Current high-resolution timestamp from the frame cache.
  const nowMs = this._frameCache?.timestamp ?? performance.now();

  // Advance simulation with game-entity gravity sources.
  _gravityGridEffect.update(nowMs, width, height, sources);

  // Draw in world space: the ctx already carries the camera transform set by
  // CanvasRenderer.draw(), so the grid, balls, and particles all move and scale
  // correctly with the player's zoom / pan.
  const ctx = this.ctx;
  ctx.save();
  _gravityGridEffect.draw(ctx);
  ctx.restore();
}

// ─── Chapter 3 – Euler Fluid Effect ─────────────────────────────────────────

// Module-level singleton so state persists across frames.
let _eulerFluidEffect = null;

// Track the last chapter theme so the effect resets when the player leaves chapter 3.
let _eulerFluidLastChapterTheme = null;

/**
 * Render the Chapter 3 "Euler Fluid" ambient background decoration.
 * Tracer particles advect through an analytically-defined velocity field with:
 *   - A gentle current following the level path (river-like channel flow).
 *   - A clockwise vortex sink at the Mind Gate (path end).
 *   - A counter-clockwise vortex source at the Shadow Gate (path start).
 *   - Soft repulsion around each tower so the flow parts around obstacles.
 * Rendered at approximately 20 % peak opacity in a blue-to-violet palette.
 * Inspired by the "Euler 2D" XScreenSaver (Stephen Montgomery-Smith, 2002).
 *
 * Called with `.call(renderer)` so `this` is the CanvasRenderer instance.
 */
export function drawChapter3Fluid() {
  if (!this.ctx) {
    return;
  }

  // Only active inside Chapter 3.
  const chapterTheme = this.container?.dataset?.chapterTheme;
  if (chapterTheme !== 'chapter-3') {
    // Reset the effect when leaving chapter 3 so it feels fresh on re-entry.
    if (_eulerFluidLastChapterTheme === 'chapter-3' && _eulerFluidEffect) {
      _eulerFluidEffect.reset();
    }
    _eulerFluidLastChapterTheme = chapterTheme || null;
    return;
  }
  _eulerFluidLastChapterTheme = 'chapter-3';

  // Skip when background particles preference is off.
  if (!areBackgroundParticlesEnabled()) {
    return;
  }

  // Logical viewport dimensions in CSS pixels.
  const width  = this.renderWidth  || (this.canvas ? this.canvas.clientWidth  : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  if (!width || !height) {
    return;
  }

  // Lazy-create the effect singleton.
  if (!_eulerFluidEffect) {
    _eulerFluidEffect = createEulerFluidEffect();
  }

  // ── Collect tower positions for the velocity-field obstacle model ──────────
  // Tower positions act as flow obstacles (world-space coordinates).
  const towers = [];
  if (this.towers) {
    for (let i = 0; i < this.towers.length; i++) {
      const t = this.towers[i];
      if (!t || !Number.isFinite(t.x) || !Number.isFinite(t.y)) continue;
      towers.push({ x: t.x, y: t.y });
    }
  }

  // Current high-resolution timestamp from the frame cache.
  const nowMs = this._frameCache?.timestamp ?? performance.now();

  // Advance simulation with the current path and tower positions.
  _eulerFluidEffect.update(nowMs, width, height, this.pathPoints || null, towers);

  // Draw in world space: the ctx already carries the camera transform set by
  // CanvasRenderer.draw(), so the fluid trails move and scale correctly with
  // the player's zoom / pan.
  const ctx = this.ctx;
  ctx.save();
  _eulerFluidEffect.draw(ctx);
  ctx.restore();
}
