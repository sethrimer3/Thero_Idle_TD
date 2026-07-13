/**
 * GraphTowerBase — shared foundation for all graph-based test towers.
 *
 * Provides:
 *   • Glyph allocation management
 *   • Graph point pool (object-pooled, efficient sweeping)
 *   • Graph radius equation (upgradeable)
 *   • Point lifetime equation (upgradeable)
 *   • Point creation on enemy death
 *   • Shared graph renderer integration
 *   • Equation registry for UI display
 *
 * Subclasses override:
 *   • _buildEquations()   — define tower-specific glyph equations
 *   • _onTick(dt, now)    — per-frame tower logic
 *   • _drawOverlay(ctx, toPixel, radius, scale, cx, cy) — custom rendering
 *   • _onPointAdded(point) — hook when a new point is created
 *   • _onReset()          — hook when the tower is reset
 */

import { GlyphEquation, createGlyphCounts } from './GlyphEquation.js';
import { GraphPointPool } from './GraphPointPool.js';
import { GraphRenderer } from './GraphRenderer.js';

// ─── Shared Equations ────────────────────────────────────────────────────────

/** Graph radius equation: x,y ∈ [-R, +R] where R = 10 + 1·Aleph + 1·Bet */
function _createRadiusEquation() {
  return new GlyphEquation('GraphRadius', [
    { coefficient: 10, glyph: null },
    { coefficient: 1,  glyph: 'Aleph' },
    { coefficient: 1,  glyph: 'Bet' },
  ], { min: 10 });
}

/** Point lifetime equation: seconds = 4 + 0.5·Aleph + 1.0·Bet */
function _createLifetimeEquation() {
  return new GlyphEquation('PointLifetime', [
    { coefficient: 4,   glyph: null },
    { coefficient: 0.5, glyph: 'Aleph' },
    { coefficient: 1.0, glyph: 'Bet' },
  ], { min: 4 });
}

// ─── GraphTowerBase ─────────────────────────────────────────────────────────

export class GraphTowerBase {
  /**
   * @param {Object} opts
   * @param {string} opts.id         - Tower type identifier.
   * @param {string} opts.name       - Display name.
   * @param {number} [opts.worldSize=8] - World-space diameter the graph covers.
   */
  constructor(opts) {
    this.id = opts.id;
    this.name = opts.name;
    this.worldSize = opts.worldSize ?? 8;

    // Glyph counts (mutable, updated by upgrade UI).
    this.glyphs = createGlyphCounts();

    // Equation registries.
    /** @type {Map<string, GlyphEquation>} */
    this.equations = new Map();

    // Shared equations.
    this._radiusEq = _createRadiusEquation();
    this._lifetimeEq = _createLifetimeEquation();
    this.equations.set('GraphRadius', this._radiusEq);
    this.equations.set('PointLifetime', this._lifetimeEq);

    // Point pool.
    this.pointPool = new GraphPointPool();

    // Graph renderer (shared canvas cache).
    this.renderer = new GraphRenderer(256);

    // Derived stats cache — updated each frame.
    this._radius = 10;
    this._lifetime = 4;

    // Let subclass add its equations.
    this._buildEquations();
  }

  // ── Glyph Management ─────────────────────────────────────────────────────

  /**
   * Set glyph count for a specific type.
   * @param {string} type  - Glyph type key (e.g. 'Aleph').
   * @param {number} count - New count value.
   */
  setGlyph(type, count) {
    if (type in this.glyphs) {
      this.glyphs[type] = Math.max(0, Math.floor(count));
    }
  }

  /**
   * Bulk-set glyph counts from an object.
   * @param {Object} glyphs - Map of type → count.
   */
  setGlyphs(glyphs) {
    for (const key in glyphs) {
      if (key in this.glyphs) {
        this.glyphs[key] = Math.max(0, Math.floor(glyphs[key]));
      }
    }
  }

  // ── Core Update Loop ──────────────────────────────────────────────────────

  /**
   * Per-frame update. Call from the playfield update loop.
   * @param {number} dt  - Delta time in seconds.
   * @param {number} now - Current game time in seconds.
   */
  update(dt, now) {
    // Recalculate shared stats from glyph counts.
    this._radius = this._radiusEq.evaluate(this.glyphs);
    this._lifetime = this._lifetimeEq.evaluate(this.glyphs);

    // Sweep expired points.
    this.pointPool.sweep(now);

    // Tower-specific logic.
    this._onTick(dt, now);
  }

  // ── Point Creation ────────────────────────────────────────────────────────

  /**
   * Called when an enemy dies in range. Converts world position to grid point.
   * @param {number} worldX - Enemy x in world space, relative to tower center.
   * @param {number} worldY - Enemy y in world space, relative to tower center.
   * @param {number} now    - Current game time in seconds.
   */
  addPointFromKill(worldX, worldY, now) {
    const grid = this.renderer.worldToGrid(worldX, worldY, this._radius, this.worldSize);
    const pt = this.pointPool.acquire(grid.x, grid.y, now, this._lifetime);
    this._onPointAdded(pt);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  /**
   * Draw the tower's graph onto the provided canvas context.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx       - Center x in canvas pixels.
   * @param {number} cy       - Center y in canvas pixels.
   * @param {number} drawSize - Pixel diameter of the graph area.
   * @param {number} now      - Current game time in seconds.
   */
  draw(ctx, cx, cy, drawSize, now) {
    this.renderer.draw(
      ctx, cx, cy, drawSize, this._radius,
      this.pointPool.active, now,
      (c, toPixel, r, s, ccx, ccy) => this._drawOverlay(c, toPixel, r, s, ccx, ccy, now)
    );
  }

  // ── Equation UI ───────────────────────────────────────────────────────────

  /**
   * Returns all equations with their three display lines for the tower UI.
   * @returns {Array<{ symbolic: string, substituted: string, numeric: string }>}
   */
  getEquationDisplayLines() {
    const lines = [];
    for (const eq of this.equations.values()) {
      lines.push(eq.allDisplayLines(this.glyphs));
    }
    return lines;
  }

  /**
   * Retrieve the current graph radius.
   * @returns {number}
   */
  get radius() {
    return this._radius;
  }

  /**
   * Retrieve the current point lifetime.
   * @returns {number}
   */
  get lifetime() {
    return this._lifetime;
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  /** Clear all points and reset internal state. */
  reset() {
    this.pointPool.releaseAll();
    this._onReset();
  }

  // ── Subclass Hooks (override in derived towers) ───────────────────────────

  /** Define tower-specific equations. Override to add to this.equations. */
  _buildEquations() { /* base has no extra equations */ }

  /**
   * Per-frame tower logic. Override for damage calculations, ability triggers.
   * @param {number} dt  - Delta time in seconds.
   * @param {number} now - Current game time in seconds.
   */
  _onTick(_dt, _now) { /* default no-op */ }

  /**
   * Custom rendering overlay drawn after grid + points.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Function} toPixel  - (gx, gy) => { x, y } pixel coordinates.
   * @param {number}   radius   - Current graph radius.
   * @param {number}   scale    - Pixels per grid unit.
   * @param {number}   cx       - Canvas center x.
   * @param {number}   cy       - Canvas center y.
   * @param {number}   now      - Current time.
   */
  _drawOverlay(_ctx, _toPixel, _radius, _scale, _cx, _cy, _now) { /* default no-op */ }

  /** Hook called after a point is acquired from the pool. */
  _onPointAdded(_point) { /* default no-op */ }

  /** Hook called after all points are released. */
  _onReset() { /* default no-op */ }
}
