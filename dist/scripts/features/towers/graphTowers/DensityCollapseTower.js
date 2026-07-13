/**
 * DensityCollapseTower — creates a heatmap field from graph points that
 * collapses into area-of-effect explosions when density exceeds a threshold.
 *
 * Continuous damage phase:
 *   Each point contributes radial density. Heat damage is applied to enemies
 *   inside the density radius of any active point.
 *
 * Collapse phase:
 *   When total accumulated density reaches the collapse threshold, compute the
 *   centroid of all points, collapse density inward, and trigger an explosion.
 *
 * All formulas are glyph-driven via GlyphEquation instances.
 */

import { GraphTowerBase } from './GraphTowerBase.js';
import { GlyphEquation } from './GlyphEquation.js';
import { clamp } from '../shared/TowerUtils.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Heatmap rendering resolution (cells across the grid). */
const HEATMAP_RESOLUTION = 32;

/** Collapse animation duration in seconds. */
const COLLAPSE_ANIM_DURATION = 0.6;

/** Visual constants. */
const HEAT_COLOR_LOW = { r: 20, g: 40, b: 120 };
const HEAT_COLOR_HIGH = { r: 255, g: 80, b: 20 };
const CENTROID_COLOR = 'rgba(255,255,200,0.9)';
const EXPLOSION_COLOR = 'rgba(255,200,100,';

// ─── DensityCollapseTower ───────────────────────────────────────────────────

export class DensityCollapseTower extends GraphTowerBase {
  constructor() {
    super({ id: 'density_collapse', name: 'Density Collapse Tower' });

    // Accumulated density for collapse threshold tracking.
    this._accumulatedDensity = 0;

    // Collapse animation state.
    this._collapseActive = false;
    this._collapseTimer = 0;
    this._collapseCentroid = { x: 0, y: 0 };
    this._collapsePointCount = 0;

    // Cached heatmap data for rendering (avoids per-frame allocation).
    this._heatmap = new Float32Array(HEATMAP_RESOLUTION * HEATMAP_RESOLUTION);
  }

  // ── Equation Definitions ─────────────────────────────────────────────────

  _buildEquations() {
    // Density radius per point: 0.8 + 0.08·Aleph + 0.15·Bet
    this._densityRadiusEq = new GlyphEquation('DensityRadius', [
      { coefficient: 0.8,  glyph: null },
      { coefficient: 0.08, glyph: 'Aleph' },
      { coefficient: 0.15, glyph: 'Bet' },
    ]);
    this.equations.set('DensityRadius', this._densityRadiusEq);

    // Heat DPS: 3 + 1.5·Aleph + 2.5·Bet + 4·Lamed
    this._heatDpsEq = new GlyphEquation('HeatDPS', [
      { coefficient: 3,   glyph: null },
      { coefficient: 1.5, glyph: 'Aleph' },
      { coefficient: 2.5, glyph: 'Bet' },
      { coefficient: 4,   glyph: 'Lamed' },
    ]);
    this.equations.set('HeatDPS', this._heatDpsEq);

    // Collapse threshold: 18 + 2·Bet + 4·Lamed + 8·Tsadi
    this._thresholdEq = new GlyphEquation('CollapseThreshold', [
      { coefficient: 18, glyph: null },
      { coefficient: 2,  glyph: 'Bet' },
      { coefficient: 4,  glyph: 'Lamed' },
      { coefficient: 8,  glyph: 'Tsadi' },
    ]);
    this.equations.set('CollapseThreshold', this._thresholdEq);

    // Collapse damage: 25 + 3·PointCount + 4·Lamed + 10·Tsadi + 20·Shin
    // Note: PointCount is dynamic; we inject it at evaluation time.
    this._collapseDmgEq = new GlyphEquation('CollapseDamage', [
      { coefficient: 25, glyph: null },
      { coefficient: 4,  glyph: 'Lamed' },
      { coefficient: 10, glyph: 'Tsadi' },
      { coefficient: 20, glyph: 'Shin' },
    ]);
    this.equations.set('CollapseDamage', this._collapseDmgEq);

    // Collapse radius: 1.2 + 0.08·Bet + 0.18·Lamed + 0.28·Tsadi
    this._collapseRadiusEq = new GlyphEquation('CollapseRadius', [
      { coefficient: 1.2,  glyph: null },
      { coefficient: 0.08, glyph: 'Bet' },
      { coefficient: 0.18, glyph: 'Lamed' },
      { coefficient: 0.28, glyph: 'Tsadi' },
    ]);
    this.equations.set('CollapseRadius', this._collapseRadiusEq);
  }

  // ── Per-Frame Logic ──────────────────────────────────────────────────────

  _onTick(dt, now) {
    const points = this.pointPool.active;
    const densityRadius = this._densityRadiusEq.evaluate(this.glyphs);
    const threshold = this._thresholdEq.evaluate(this.glyphs);

    // Update collapse animation.
    if (this._collapseActive) {
      this._collapseTimer -= dt;
      if (this._collapseTimer <= 0) {
        this._collapseActive = false;
      }
      return; // No density accumulation during collapse animation.
    }

    // Accumulate density from active points.
    // Each point contributes 1 unit per second × density radius factor.
    this._accumulatedDensity += points.length * densityRadius * dt;

    // Check collapse threshold.
    if (this._accumulatedDensity >= threshold && points.length > 0) {
      this._triggerCollapse(points, now);
    }

    // Build heatmap for rendering.
    this._buildHeatmap(points, densityRadius);
  }

  // ── Collapse Logic ────────────────────────────────────────────────────────

  /**
   * Trigger a collapse explosion at the centroid of current points.
   * @param {Array} points - Active point array.
   * @param {number} now   - Current game time.
   */
  _triggerCollapse(points, _now) {
    // Compute centroid: x̄ = Σx/n, ȳ = Σy/n
    let cx = 0, cy = 0;
    for (let i = 0; i < points.length; i++) {
      cx += points[i].x;
      cy += points[i].y;
    }
    cx /= points.length;
    cy /= points.length;

    this._collapseCentroid = { x: cx, y: cy };
    this._collapsePointCount = points.length;
    this._collapseActive = true;
    this._collapseTimer = COLLAPSE_ANIM_DURATION;

    // Reset accumulator for next cycle.
    this._accumulatedDensity = 0;

    // Clear all points (consumed by explosion).
    this.pointPool.releaseAll();
  }

  /**
   * Returns the collapse damage (including point count bonus).
   * @returns {number}
   */
  getCollapseDamage() {
    const base = this._collapseDmgEq.evaluate(this.glyphs);
    return base + 3 * this._collapsePointCount;
  }

  /**
   * Returns the collapse explosion radius in grid units.
   * @returns {number}
   */
  getCollapseRadius() {
    return this._collapseRadiusEq.evaluate(this.glyphs);
  }

  /**
   * Returns the continuous heat DPS.
   * @returns {number}
   */
  getHeatDPS() {
    return this._heatDpsEq.evaluate(this.glyphs);
  }

  /**
   * Returns true if a collapse animation is in progress.
   * @returns {boolean}
   */
  get isCollapsing() {
    return this._collapseActive;
  }

  // ── Heatmap Computation ──────────────────────────────────────────────────

  /**
   * Build the heatmap grid from active points for rendering.
   * Uses Gaussian-like falloff from each point within its density radius.
   * @param {Array}  points
   * @param {number} densityRadius
   */
  _buildHeatmap(points, densityRadius) {
    const res = HEATMAP_RESOLUTION;
    const radius = this._radius;
    const cellSize = (radius * 2) / res;
    const radiusSq = densityRadius * densityRadius;

    // Clear heatmap.
    this._heatmap.fill(0);

    for (let pi = 0; pi < points.length; pi++) {
      const pt = points[pi];
      // Convert point coords to heatmap cell indices.
      const cxf = (pt.x + radius) / cellSize;
      const cyf = (pt.y + radius) / cellSize;
      const cellRange = Math.ceil(densityRadius / cellSize);

      const minI = Math.max(0, Math.floor(cxf) - cellRange);
      const maxI = Math.min(res - 1, Math.floor(cxf) + cellRange);
      const minJ = Math.max(0, Math.floor(cyf) - cellRange);
      const maxJ = Math.min(res - 1, Math.floor(cyf) + cellRange);

      for (let j = minJ; j <= maxJ; j++) {
        for (let i = minI; i <= maxI; i++) {
          const wx = (i + 0.5) * cellSize - radius;
          const wy = (j + 0.5) * cellSize - radius;
          const dx = wx - pt.x;
          const dy = wy - pt.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < radiusSq) {
            const falloff = 1 - distSq / radiusSq;
            this._heatmap[j * res + i] += falloff;
          }
        }
      }
    }
  }

  // ── Rendering Overlay ────────────────────────────────────────────────────

  _drawOverlay(ctx, toPixel, radius, scale, cx, cy, _now) {
    // Draw heatmap.
    this._drawHeatmap(ctx, radius, scale, cx, cy);

    // Draw collapse animation.
    if (this._collapseActive) {
      this._drawCollapse(ctx, toPixel, scale, cx, cy);
    }
  }

  /** Render the heatmap as semi-transparent colored cells. */
  _drawHeatmap(ctx, radius, scale, cx, cy) {
    const res = HEATMAP_RESOLUTION;
    const cellPx = (radius * 2 * scale) / res;
    const originX = cx - radius * scale;
    const originY = cy - radius * scale;

    ctx.save();
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const density = this._heatmap[j * res + i];
        if (density < 0.01) continue;

        const t = clamp(density / 3, 0, 1);
        const r = Math.round(HEAT_COLOR_LOW.r + (HEAT_COLOR_HIGH.r - HEAT_COLOR_LOW.r) * t);
        const g = Math.round(HEAT_COLOR_LOW.g + (HEAT_COLOR_HIGH.g - HEAT_COLOR_LOW.g) * t);
        const b = Math.round(HEAT_COLOR_LOW.b + (HEAT_COLOR_HIGH.b - HEAT_COLOR_LOW.b) * t);
        const alpha = clamp(t * 0.5, 0, 0.5);

        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fillRect(
          originX + i * cellPx,
          originY + (res - 1 - j) * cellPx, // Flip Y for math convention.
          cellPx + 0.5,
          cellPx + 0.5
        );
      }
    }
    ctx.restore();
  }

  /** Draw the collapse explosion animation. */
  _drawCollapse(ctx, toPixel, scale, _cx, _cy) {
    const progress = 1 - this._collapseTimer / COLLAPSE_ANIM_DURATION;
    const center = toPixel(this._collapseCentroid.x, this._collapseCentroid.y);
    const collapseRadius = this.getCollapseRadius() * scale;

    // Expanding explosion ring.
    const ringRadius = collapseRadius * progress;
    const ringAlpha = clamp(1 - progress, 0, 1) * 0.7;

    ctx.save();
    ctx.strokeStyle = `${EXPLOSION_COLOR}${ringAlpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(center.x, center.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Bright center flash.
    const flashAlpha = clamp(1 - progress * 2, 0, 1) * 0.6;
    ctx.fillStyle = `${EXPLOSION_COLOR}${flashAlpha})`;
    ctx.beginPath();
    ctx.arc(center.x, center.y, ringRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Centroid marker.
    if (progress < 0.3) {
      ctx.fillStyle = CENTROID_COLOR;
      ctx.beginPath();
      ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _onReset() {
    this._accumulatedDensity = 0;
    this._collapseActive = false;
    this._collapseTimer = 0;
    this._heatmap.fill(0);
  }
}
