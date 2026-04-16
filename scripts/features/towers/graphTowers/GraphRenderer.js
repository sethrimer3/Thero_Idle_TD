/**
 * GraphRenderer — cached, GPU-efficient grid + point rendering for graph towers.
 *
 * Renders:
 *   • Integer-aligned grid lines (thin)
 *   • Thicker axes at x=0, y=0
 *   • Active graph points with age-based fade
 *   • Optional overlays (beams, curves, heatmaps) via callbacks
 *
 * Grid geometry is cached to an offscreen canvas and only rebuilt when the
 * graph radius changes.  Point drawing is batched into a single pass.
 */

import { clamp } from '../shared/TowerUtils.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum pixels per grid cell for readability. */
const MIN_CELL_PX = 12;

/** Grid line colors. */
const GRID_LINE_COLOR = 'rgba(255,255,255,0.12)';
const AXIS_LINE_COLOR = 'rgba(255,255,255,0.45)';

/** Grid line widths. */
const GRID_LINE_WIDTH = 0.5;
const AXIS_LINE_WIDTH = 1.5;

/** Point rendering. */
const POINT_BASE_RADIUS = 3;
const POINT_GLOW_RADIUS = 6;
const POINT_COLOR = 'rgba(160,220,255,0.9)';
const POINT_GLOW_COLOR = 'rgba(160,220,255,0.25)';

// ─── GraphRenderer ──────────────────────────────────────────────────────────

export class GraphRenderer {
  /**
   * @param {number} canvasSize - Pixel dimension of the square render target.
   */
  constructor(canvasSize = 256) {
    this._canvasSize = canvasSize;
    this._cachedRadius = -1;

    // Offscreen canvas for the static grid.
    this._gridCanvas = null;
    this._gridCtx = null;

    this._initGridCanvas();
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Draw the full graph (grid + points + optional overlay) onto `ctx`.
   *
   * @param {CanvasRenderingContext2D} ctx        - Target context.
   * @param {number}                   cx         - Center x in canvas pixels.
   * @param {number}                   cy         - Center y in canvas pixels.
   * @param {number}                   drawSize   - Diameter in pixels to draw.
   * @param {number}                   radius     - Graph radius in grid units.
   * @param {Array}                    points     - Active point objects from pool.
   * @param {number}                   now        - Current game time (seconds).
   * @param {Function|null}            [overlay]  - Optional (ctx, toPixel, radius) callback.
   */
  draw(ctx, cx, cy, drawSize, radius, points, now, overlay = null) {
    // Rebuild cached grid if radius changed.
    if (radius !== this._cachedRadius) {
      this._buildGrid(radius);
    }

    const half = drawSize * 0.5;
    const left = cx - half;
    const top  = cy - half;

    // 1. Blit the cached grid.
    ctx.drawImage(this._gridCanvas, left, top, drawSize, drawSize);

    // Pixel conversion helper: grid coords → canvas pixels.
    const scale = drawSize / (radius * 2);
    const toPixelX = (gx) => cx + gx * scale;
    const toPixelY = (gy) => cy - gy * scale; // Y flipped for math convention.
    const toPixel = (gx, gy) => ({ x: toPixelX(gx), y: toPixelY(gy) });

    // 2. Draw points with glow and age fade.
    this._drawPoints(ctx, points, now, toPixelX, toPixelY, scale);

    // 3. Optional overlay (beams, curves, heatmaps).
    if (overlay) {
      overlay(ctx, toPixel, radius, scale, cx, cy);
    }
  }

  /**
   * Convert a world position relative to the tower into snapped grid coords.
   * @param {number} localX     - World offset from tower center.
   * @param {number} localY     - World offset from tower center.
   * @param {number} radius     - Current graph radius.
   * @param {number} worldSize  - World-space diameter the graph covers.
   * @returns {{ x: number, y: number }}
   */
  worldToGrid(localX, localY, radius, worldSize) {
    const unitsPerCell = worldSize / (radius * 2);
    const gx = clamp(Math.round(localX / unitsPerCell), -radius, radius);
    const gy = clamp(Math.round(localY / unitsPerCell), -radius, radius);
    return { x: gx, y: gy };
  }

  // ── Grid Caching ────────────────────────────────────────────────────────

  /** Initialise the offscreen grid canvas. */
  _initGridCanvas() {
    if (typeof OffscreenCanvas !== 'undefined') {
      this._gridCanvas = new OffscreenCanvas(this._canvasSize, this._canvasSize);
    } else {
      this._gridCanvas = document.createElement('canvas');
      this._gridCanvas.width = this._canvasSize;
      this._gridCanvas.height = this._canvasSize;
    }
    this._gridCtx = this._gridCanvas.getContext('2d');
  }

  /**
   * Rebuild the cached grid image for a given radius.
   * Called once when the radius changes, not every frame.
   * @param {number} radius - Graph radius in grid units.
   */
  _buildGrid(radius) {
    this._cachedRadius = radius;
    const size = this._canvasSize;
    const ctx = this._gridCtx;

    ctx.clearRect(0, 0, size, size);

    const cellPx = Math.max(MIN_CELL_PX, size / (radius * 2));
    const center = size * 0.5;

    // Draw integer grid lines.
    ctx.strokeStyle = GRID_LINE_COLOR;
    ctx.lineWidth = GRID_LINE_WIDTH;
    ctx.beginPath();
    for (let i = -radius; i <= radius; i++) {
      if (i === 0) continue; // Axes drawn separately.
      const offset = center + i * cellPx;
      // Vertical line.
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset, size);
      // Horizontal line.
      ctx.moveTo(0, offset);
      ctx.lineTo(size, offset);
    }
    ctx.stroke();

    // Draw axes (x=0 and y=0).
    ctx.strokeStyle = AXIS_LINE_COLOR;
    ctx.lineWidth = AXIS_LINE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(center, 0);
    ctx.lineTo(center, size);
    ctx.moveTo(0, center);
    ctx.lineTo(size, center);
    ctx.stroke();
  }

  // ── Point Rendering ─────────────────────────────────────────────────────

  /**
   * Batch-draw all active points with glow and age fade.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array}  points
   * @param {number} now
   * @param {Function} toPixelX
   * @param {Function} toPixelY
   * @param {number}   scale
   */
  _drawPoints(ctx, points, now, toPixelX, toPixelY, _scale) {
    if (!points || points.length === 0) return;

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const age = now - pt.spawnTime;
      const life = pt.lifetime;
      const fade = clamp(1 - age / life, 0, 1);

      const px = toPixelX(pt.x);
      const py = toPixelY(pt.y);

      // Glow circle.
      ctx.globalAlpha = fade * 0.3;
      ctx.fillStyle = POINT_GLOW_COLOR;
      ctx.beginPath();
      ctx.arc(px, py, POINT_GLOW_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Core dot.
      ctx.globalAlpha = fade * 0.9;
      ctx.fillStyle = POINT_COLOR;
      ctx.beginPath();
      ctx.arc(px, py, POINT_BASE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
