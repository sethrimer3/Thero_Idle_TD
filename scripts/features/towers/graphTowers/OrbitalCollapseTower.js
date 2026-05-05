/**
 * OrbitalCollapseTower — radial distance from origin generates potential energy.
 * When energy exceeds a threshold, energy streams inward along radial lines
 * (Stage 1 strand damage) and then implodes at the origin (Stage 2 implosion).
 *
 * r = sqrt(x² + y²) for each point; Energy += r^p where p is upgradeable.
 *
 * All formulas are glyph-driven via GlyphEquation instances.
 */

import { GraphTowerBase } from './GraphTowerBase.js';
import { GlyphEquation } from './GlyphEquation.js';
import { clamp } from '../shared/TowerUtils.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Collapse animation phases. */
const STRAND_PHASE_DURATION = 0.5;   // Stage 1: energy streams inward.
const IMPLOSION_PHASE_DURATION = 0.4; // Stage 2: implosion at origin.

/** Rendering constants. */
const RING_COUNT = 4;
const RING_COLOR = 'rgba(120,180,255,';
const STRAND_COLOR = 'rgba(180,220,255,0.7)';
const IMPLOSION_COLOR = 'rgba(255,240,200,';
const ENERGY_BAR_WIDTH = 4;
const ENERGY_BAR_COLOR_BG = 'rgba(255,255,255,0.15)';
const ENERGY_BAR_COLOR_FG = 'rgba(120,200,255,0.7)';

// ─── OrbitalCollapseTower ───────────────────────────────────────────────────

export class OrbitalCollapseTower extends GraphTowerBase {
  constructor() {
    super({ id: 'orbital_collapse', name: 'Orbital Collapse Tower' });

    // Accumulated energy for threshold tracking.
    this._storedEnergy = 0;

    // Collapse animation state.
    this._collapsePhase = 'idle'; // 'idle' | 'strands' | 'implosion'
    this._collapseTimer = 0;
    this._collapsePoints = []; // Snapshot of points at collapse start.
  }

  // ── Equation Definitions ─────────────────────────────────────────────────

  _buildEquations() {
    // Energy exponent: p = 1 + 0.05·Bet + 0.1·Lamed + 0.18·Tsadi
    this._exponentEq = new GlyphEquation('EnergyExponent', [
      { coefficient: 1,    glyph: null },
      { coefficient: 0.05, glyph: 'Bet' },
      { coefficient: 0.1,  glyph: 'Lamed' },
      { coefficient: 0.18, glyph: 'Tsadi' },
    ]);
    this.equations.set('EnergyExponent', this._exponentEq);

    // Energy threshold: 30 + 4·Bet + 8·Lamed + 14·Tsadi
    this._thresholdEq = new GlyphEquation('EnergyThreshold', [
      { coefficient: 30, glyph: null },
      { coefficient: 4,  glyph: 'Bet' },
      { coefficient: 8,  glyph: 'Lamed' },
      { coefficient: 14, glyph: 'Tsadi' },
    ]);
    this.equations.set('EnergyThreshold', this._thresholdEq);

    // Stage 1 strand damage: 4 + 1.5·Bet + 3·Lamed + 5·Tsadi
    this._strandDmgEq = new GlyphEquation('CollapseStrandDamage', [
      { coefficient: 4,   glyph: null },
      { coefficient: 1.5, glyph: 'Bet' },
      { coefficient: 3,   glyph: 'Lamed' },
      { coefficient: 5,   glyph: 'Tsadi' },
    ]);
    this.equations.set('CollapseStrandDamage', this._strandDmgEq);

    // Stage 2 implosion damage: 20 + 0.4·StoredEnergy + 6·Lamed + 12·Tsadi + 22·Shin
    // StoredEnergy is dynamic; we compute the full value in getImplosionDamage().
    this._implosionBaseEq = new GlyphEquation('ImplosionDamage', [
      { coefficient: 20, glyph: null },
      { coefficient: 6,  glyph: 'Lamed' },
      { coefficient: 12, glyph: 'Tsadi' },
      { coefficient: 22, glyph: 'Shin' },
    ]);
    this.equations.set('ImplosionDamage', this._implosionBaseEq);
  }

  // ── Per-Frame Logic ──────────────────────────────────────────────────────

  _onTick(dt, _now) {
    // Handle collapse animation phases.
    if (this._collapsePhase !== 'idle') {
      this._collapseTimer -= dt;
      if (this._collapseTimer <= 0) {
        if (this._collapsePhase === 'strands') {
          // Transition to implosion.
          this._collapsePhase = 'implosion';
          this._collapseTimer = IMPLOSION_PHASE_DURATION;
        } else {
          // Implosion complete.
          this._collapsePhase = 'idle';
          this._collapsePoints = [];
        }
      }
      return; // No energy accumulation during collapse.
    }

    // Calculate energy from all active points.
    const points = this.pointPool.active;
    const p = this._exponentEq.evaluate(this.glyphs);
    const threshold = this._thresholdEq.evaluate(this.glyphs);

    let totalEnergy = 0;
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const r = Math.sqrt(pt.x * pt.x + pt.y * pt.y);
      totalEnergy += Math.pow(r, p);
    }
    this._storedEnergy = totalEnergy;

    // Check threshold.
    if (totalEnergy >= threshold && points.length > 0) {
      this._triggerCollapse(points);
    }
  }

  // ── Collapse Logic ────────────────────────────────────────────────────────

  /**
   * Trigger the two-stage collapse sequence.
   * @param {Array} points - Active point array.
   */
  _triggerCollapse(points) {
    // Snapshot point positions for animation.
    this._collapsePoints = points.map(pt => ({
      x: pt.x,
      y: pt.y,
      r: Math.sqrt(pt.x * pt.x + pt.y * pt.y),
    }));

    this._collapsePhase = 'strands';
    this._collapseTimer = STRAND_PHASE_DURATION;

    // Clear all points (consumed by collapse).
    this.pointPool.releaseAll();
  }

  // ── Damage Queries ────────────────────────────────────────────────────────

  /**
   * Returns the Stage 1 strand damage.
   * @returns {number}
   */
  getStrandDamage() {
    return this._strandDmgEq.evaluate(this.glyphs);
  }

  /**
   * Returns the Stage 2 implosion damage (including stored energy bonus).
   * @returns {number}
   */
  getImplosionDamage() {
    const base = this._implosionBaseEq.evaluate(this.glyphs);
    return base + 0.4 * this._storedEnergy;
  }

  /**
   * Returns current stored energy.
   * @returns {number}
   */
  get storedEnergy() {
    return this._storedEnergy;
  }

  /**
   * Returns the current collapse phase.
   * @returns {string}
   */
  get collapsePhase() {
    return this._collapsePhase;
  }

  // ── Rendering Overlay ────────────────────────────────────────────────────

  _drawOverlay(ctx, toPixel, radius, scale, cx, cy, _now) {
    const threshold = this._thresholdEq.evaluate(this.glyphs);

    // Draw distance rings to communicate radial importance.
    this._drawDistanceRings(ctx, radius, scale, cx, cy);

    // Draw energy progress bar.
    this._drawEnergyBar(ctx, cx, cy, radius, scale, threshold);

    // Draw collapse animation.
    if (this._collapsePhase === 'strands') {
      this._drawStrands(ctx, toPixel, scale, cx, cy);
    } else if (this._collapsePhase === 'implosion') {
      this._drawImplosion(ctx, cx, cy, scale);
    }
  }

  /** Draw concentric distance rings to show radial zones. */
  _drawDistanceRings(ctx, radius, scale, cx, cy) {
    const step = radius / RING_COUNT;
    ctx.save();
    ctx.lineWidth = 0.5;
    for (let i = 1; i <= RING_COUNT; i++) {
      const r = i * step * scale;
      const alpha = 0.08 + 0.04 * i;
      ctx.strokeStyle = `${RING_COLOR}${alpha})`;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Draw the energy threshold progress bar at the bottom of the graph. */
  _drawEnergyBar(ctx, cx, cy, radius, scale, threshold) {
    const barWidth = radius * scale * 1.6;
    const barX = cx - barWidth * 0.5;
    const barY = cy + radius * scale + 6;
    const fillRatio = clamp(this._storedEnergy / Math.max(1, threshold), 0, 1);

    ctx.save();
    ctx.fillStyle = ENERGY_BAR_COLOR_BG;
    ctx.fillRect(barX, barY, barWidth, ENERGY_BAR_WIDTH);
    ctx.fillStyle = ENERGY_BAR_COLOR_FG;
    ctx.fillRect(barX, barY, barWidth * fillRatio, ENERGY_BAR_WIDTH);
    ctx.restore();
  }

  /** Draw radial strands streaming inward during Stage 1. */
  _drawStrands(ctx, toPixel, scale, cx, cy) {
    const progress = 1 - this._collapseTimer / STRAND_PHASE_DURATION;

    ctx.save();
    ctx.strokeStyle = STRAND_COLOR;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';

    for (let i = 0; i < this._collapsePoints.length; i++) {
      const cp = this._collapsePoints[i];
      const outerP = toPixel(cp.x, cp.y);

      // Animate from outer point toward origin.
      const innerX = cx + (outerP.x - cx) * (1 - progress);
      const innerY = cy + (outerP.y - cy) * (1 - progress);

      ctx.globalAlpha = clamp(1 - progress * 0.5, 0.3, 1);
      ctx.beginPath();
      ctx.moveTo(outerP.x, outerP.y);
      ctx.lineTo(innerX, innerY);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Draw the implosion flash at the origin during Stage 2. */
  _drawImplosion(ctx, cx, cy, scale) {
    const progress = 1 - this._collapseTimer / IMPLOSION_PHASE_DURATION;

    ctx.save();
    // Expanding bright ring.
    const maxRad = 2 * scale;
    const ringRad = maxRad * progress;
    const ringAlpha = clamp(1 - progress, 0, 1) * 0.8;

    ctx.strokeStyle = `${IMPLOSION_COLOR}${ringAlpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, ringRad, 0, Math.PI * 2);
    ctx.stroke();

    // Bright center flash.
    const flashAlpha = clamp(1 - progress * 1.5, 0, 1) * 0.9;
    ctx.fillStyle = `${IMPLOSION_COLOR}${flashAlpha})`;
    ctx.beginPath();
    ctx.arc(cx, cy, maxRad * 0.3 * (1 - progress), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _onReset() {
    this._storedEnergy = 0;
    this._collapsePhase = 'idle';
    this._collapseTimer = 0;
    this._collapsePoints = [];
  }
}
