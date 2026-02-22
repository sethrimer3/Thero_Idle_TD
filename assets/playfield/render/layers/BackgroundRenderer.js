/**
 * Background Renderer
 *
 * Handles all static and floating background visual elements for the playfield:
 * - Crystalline mosaic edge decorations
 * - Level sketch overlays (random decorative sketches)
 * - Floater lattice (floating circles with connection lines)
 * - Background swimmer entities
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

// Pre-calculated constants shared across background rendering functions
const TWO_PI = Math.PI * 2;
const HALF = 0.5;

// Small sketch sprites loaded once at module initialisation for background decoration.
// Each sprite has a 10% chance of appearing per level at a random position and rotation.
const sketchSprites = [
  'assets/sprites/sketches/sketch_small_1.png',
  'assets/sprites/sketches/sketch_small_2.png',
  'assets/sprites/sketches/sketch_small_3.png',
  'assets/sprites/sketches/sketch_small_4.png',
].map((url) => {
  const img = new Image();
  img.src = url;
  img.decoding = 'async';
  img.loading = 'eager';
  return img;
});

// ─── Crystalline Mosaic ───────────────────────────────────────────────────────

/**
 * Render the crystalline mosaic edge decorations.
 * Called as the first layer in the render stack so crystals appear beneath all
 * game elements.
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

  // Viewport bounds are pre-computed at frame start and stored in _frameCache
  const viewportBounds = this._frameCache?.viewportBounds;
  if (!viewportBounds) {
    return;
  }

  // Get path points for distance checking
  const pathPoints = this.pathPoints || [];

  // Use level config as version tracker (regenerate if level changes)
  const pathVersion = this.levelConfig?.id || null;

  // Get focused cell ID if any
  const focusedCellId = this.focusedCellId || null;

  // Render the crystalline mosaic
  const ctx = this.ctx;
  mosaicManager.render(ctx, viewportBounds, pathPoints, pathVersion, focusedCellId);
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

  const ctx = this.ctx;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const swimmers = Array.isArray(this.backgroundSwimmers) ? this.backgroundSwimmers : [];
  if (swimmers.length) {
    // Render faint white swimmers beneath the lattice lines so the background feels fluid.
    const baseSize = Math.max(0.6, minDimension * 0.0038);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    swimmers.forEach((swimmer) => {
      const flicker =
        Math.sin(Number.isFinite(swimmer.flicker) ? swimmer.flicker : 0) * 0.15 + 0.85;
      const size =
        baseSize * (Number.isFinite(swimmer.sizeScale) ? swimmer.sizeScale : 1) * flicker;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.08, 0.18 * flicker)})`;
      ctx.arc(swimmer.x, swimmer.y, size, 0, TWO_PI);
      ctx.fill();
    });
    ctx.restore();
  }

  this.floaterConnections.forEach((connection) => {
    const from = this.floaters[connection.from];
    const to = this.floaters[connection.to];
    if (!from || !to) {
      return;
    }
    const alpha = Math.max(0, Math.min(1, connection.strength || 0)) * 0.25;
    if (alpha <= 0) {
      return;
    }
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = connectionWidth;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  });

  this.floaters.forEach((floater) => {
    const opacity = Math.max(0, Math.min(1, floater.opacity || 0));
    if (opacity <= 0) {
      return;
    }
    let radiusFactor = Number.isFinite(floater.radiusFactor) ? floater.radiusFactor : null;
    if (!radiusFactor) {
      radiusFactor = this.randomFloaterRadiusFactor();
      floater.radiusFactor = radiusFactor;
    }
    const radius = Math.max(2, radiusFactor * minDimension);
    const strokeWidth = Math.max(0.8, radius * 0.22);
    ctx.beginPath();
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.25})`;
    ctx.arc(floater.x, floater.y, radius, 0, TWO_PI);
    ctx.stroke();
  });

  ctx.restore();
}
