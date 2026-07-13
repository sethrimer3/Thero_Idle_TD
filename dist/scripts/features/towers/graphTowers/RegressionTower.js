/**
 * RegressionTower — fits mathematical functions to graph points and weaponises
 * the resulting equation as a beam attack.
 *
 * Core behaviour:
 *   At fixed intervals, perform least-squares linear regression (y = mx + b).
 *   If fit error ≤ tolerance, fire a beam along the fitted line.
 *   If Tsadi ≥ 1, also attempt quadratic regression (y = ax² + bx + c) and
 *   choose the best fit.
 *
 * All formulas are glyph-driven via GlyphEquation instances.
 */

import { GraphTowerBase } from './GraphTowerBase.js';
import { GlyphEquation } from './GlyphEquation.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum points required to attempt a regression. */
const MIN_POINTS_LINEAR = 2;
const MIN_POINTS_QUADRATIC = 3;

/** Beam visual constants. */
const BEAM_LINEAR_COLOR = 'rgba(100,200,255,0.7)';
const BEAM_QUADRATIC_COLOR = 'rgba(255,180,100,0.7)';
const BEAM_GLOW_ALPHA = 0.2;
const FIT_POINT_COLOR = 'rgba(255,255,100,0.8)';
const FIT_POINT_RADIUS = 4;

// ─── RegressionTower ────────────────────────────────────────────────────────

export class RegressionTower extends GraphTowerBase {
  constructor() {
    super({ id: 'regression', name: 'Regression Tower' });

    // Timing accumulator for regression interval.
    this._timer = 0;

    // Current beam state (null when no beam active).
    this._beam = null;
    this._beamTimer = 0;

    // Cached fit result for rendering.
    this._lastFit = null;
    this._fitPoints = [];
  }

  // ── Equation Definitions ─────────────────────────────────────────────────

  _buildEquations() {
    // Regression interval: max(0.25, 2.0 - 0.1·Aleph - 0.15·Bet)
    this._intervalEq = new GlyphEquation('RegressionInterval', [
      { coefficient: 2.0,   glyph: null },
      { coefficient: -0.1,  glyph: 'Aleph' },
      { coefficient: -0.15, glyph: 'Bet' },
    ], { min: 0.25 });
    this.equations.set('RegressionInterval', this._intervalEq);

    // Fit tolerance: 1.8 + 0.25·Lamed + 0.15·Tsadi
    this._toleranceEq = new GlyphEquation('FitTolerance', [
      { coefficient: 1.8,  glyph: null },
      { coefficient: 0.25, glyph: 'Lamed' },
      { coefficient: 0.15, glyph: 'Tsadi' },
    ]);
    this.equations.set('FitTolerance', this._toleranceEq);

    // Beam DPS: 8 + 2·Bet + 4·Lamed + 8·Tsadi
    this._dpsEq = new GlyphEquation('BeamDPS', [
      { coefficient: 8, glyph: null },
      { coefficient: 2, glyph: 'Bet' },
      { coefficient: 4, glyph: 'Lamed' },
      { coefficient: 8, glyph: 'Tsadi' },
    ]);
    this.equations.set('BeamDPS', this._dpsEq);

    // Beam width: 0.2 + 0.03·Aleph + 0.06·Lamed
    this._widthEq = new GlyphEquation('BeamWidth', [
      { coefficient: 0.2,  glyph: null },
      { coefficient: 0.03, glyph: 'Aleph' },
      { coefficient: 0.06, glyph: 'Lamed' },
    ]);
    this.equations.set('BeamWidth', this._widthEq);

    // Beam duration: 0.75 + 0.1·Bet + 0.2·Lamed
    this._durationEq = new GlyphEquation('BeamDuration', [
      { coefficient: 0.75, glyph: null },
      { coefficient: 0.1,  glyph: 'Bet' },
      { coefficient: 0.2,  glyph: 'Lamed' },
    ]);
    this.equations.set('BeamDuration', this._durationEq);
  }

  // ── Per-Frame Logic ──────────────────────────────────────────────────────

  _onTick(dt, _now) {
    const interval = this._intervalEq.evaluate(this.glyphs);

    // Decay active beam.
    if (this._beam) {
      this._beamTimer -= dt;
      if (this._beamTimer <= 0) {
        this._beam = null;
        this._lastFit = null;
        this._fitPoints = [];
      }
    }

    // Accumulate regression timer.
    this._timer += dt;
    if (this._timer < interval) return;
    this._timer -= interval;

    // Attempt regression on current active points.
    const points = this.pointPool.active;
    if (points.length < MIN_POINTS_LINEAR) return;

    const tolerance = this._toleranceEq.evaluate(this.glyphs);
    const canQuadratic = this.glyphs.Tsadi >= 1 && points.length >= MIN_POINTS_QUADRATIC;

    // Compute linear fit.
    const linearFit = _leastSquaresLinear(points);

    // Compute quadratic fit if unlocked.
    let quadFit = null;
    if (canQuadratic) {
      quadFit = _leastSquaresQuadratic(points);
    }

    // Choose best fit.
    let bestFit = linearFit;
    if (quadFit && quadFit.error < linearFit.error) {
      bestFit = quadFit;
    }

    // Check tolerance.
    if (bestFit.error > tolerance) return;

    // Fire beam!
    const duration = this._durationEq.evaluate(this.glyphs);
    this._beam = bestFit;
    this._beamTimer = duration;
    this._lastFit = bestFit;

    // Track which points were used.
    this._fitPoints = points.map(p => ({ x: p.x, y: p.y }));
  }

  // ── Damage Query ──────────────────────────────────────────────────────────

  /**
   * Returns the current beam damage per second (0 if no beam active).
   * @returns {number}
   */
  getBeamDPS() {
    if (!this._beam) return 0;
    return this._dpsEq.evaluate(this.glyphs);
  }

  /**
   * Returns the beam width in grid units (0 if no beam).
   * @returns {number}
   */
  getBeamWidth() {
    if (!this._beam) return 0;
    return this._widthEq.evaluate(this.glyphs);
  }

  /**
   * Returns true if a beam is currently active.
   * @returns {boolean}
   */
  get isBeamActive() {
    return this._beam !== null;
  }

  // ── Rendering Overlay ────────────────────────────────────────────────────

  _drawOverlay(ctx, toPixel, radius, scale, cx, cy, _now) {
    if (!this._lastFit) return;

    const fit = this._lastFit;
    const width = this._widthEq.evaluate(this.glyphs) * scale;
    const isQuad = fit.type === 'quadratic';
    const color = isQuad ? BEAM_QUADRATIC_COLOR : BEAM_LINEAR_COLOR;

    // Draw fitted curve / line across the graph.
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, width);
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.8;

    if (isQuad) {
      _drawQuadraticCurve(ctx, fit, radius, toPixel);
    } else {
      _drawLinearLine(ctx, fit, radius, toPixel);
    }
    ctx.restore();

    // Draw glow version.
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3, width * 2.5);
    ctx.lineCap = 'round';
    ctx.globalAlpha = BEAM_GLOW_ALPHA;

    if (isQuad) {
      _drawQuadraticCurve(ctx, fit, radius, toPixel);
    } else {
      _drawLinearLine(ctx, fit, radius, toPixel);
    }
    ctx.restore();

    // Highlight fit points.
    ctx.fillStyle = FIT_POINT_COLOR;
    for (let i = 0; i < this._fitPoints.length; i++) {
      const fp = this._fitPoints[i];
      const p = toPixel(fp.x, fp.y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, FIT_POINT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    // Display equation text.
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '11px serif';
    ctx.textAlign = 'center';
    const eqText = isQuad
      ? `y = ${fit.a.toFixed(2)}x² + ${fit.b.toFixed(2)}x + ${fit.c.toFixed(2)}`
      : `y = ${fit.m.toFixed(2)}x + ${fit.b.toFixed(2)}`;
    ctx.fillText(eqText, cx, cy - radius * scale - 8);
    ctx.restore();
  }

  _onReset() {
    this._timer = 0;
    this._beam = null;
    this._beamTimer = 0;
    this._lastFit = null;
    this._fitPoints = [];
  }
}

// ─── Regression Math ────────────────────────────────────────────────────────

/**
 * Least-squares linear regression: y = mx + b.
 * Returns { type, m, b, error }.
 */
function _leastSquaresLinear(points) {
  const n = points.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const { x, y } = points[i];
    sx += x;
    sy += y;
    sxx += x * x;
    sxy += x * y;
  }
  const denom = n * sxx - sx * sx;
  let m = 0, b = 0;
  if (Math.abs(denom) > 1e-10) {
    m = (n * sxy - sx * sy) / denom;
    b = (sy - m * sx) / n;
  } else {
    b = sy / n;
  }

  // Compute mean squared error.
  let errSum = 0;
  for (let i = 0; i < n; i++) {
    const predicted = m * points[i].x + b;
    const diff = points[i].y - predicted;
    errSum += diff * diff;
  }

  return { type: 'linear', m, b, error: errSum / n };
}

/**
 * Least-squares quadratic regression: y = ax² + bx + c.
 * Solves the 3×3 normal equations via Cramer's rule.
 * Returns { type, a, b, c, error }.
 */
function _leastSquaresQuadratic(points) {
  const n = points.length;
  let sx = 0, sx2 = 0, sx3 = 0, sx4 = 0;
  let sy = 0, sxy = 0, sx2y = 0;

  for (let i = 0; i < n; i++) {
    const { x, y } = points[i];
    const x2 = x * x;
    sx += x;
    sx2 += x2;
    sx3 += x2 * x;
    sx4 += x2 * x2;
    sy += y;
    sxy += x * y;
    sx2y += x2 * y;
  }

  // Normal equations:  M · [a, b, c]ᵀ = V
  // M = [[sx4, sx3, sx2], [sx3, sx2, sx], [sx2, sx, n]]
  // V = [sx2y, sxy, sy]
  const det = _det3x3(
    sx4, sx3, sx2,
    sx3, sx2, sx,
    sx2, sx, n
  );

  let a = 0, b = 0, c = 0;
  if (Math.abs(det) > 1e-10) {
    a = _det3x3(sx2y, sx3, sx2, sxy, sx2, sx, sy, sx, n) / det;
    b = _det3x3(sx4, sx2y, sx2, sx3, sxy, sx, sx2, sy, n) / det;
    c = _det3x3(sx4, sx3, sx2y, sx3, sx2, sxy, sx2, sx, sy) / det;
  } else {
    // Fall back to linear.
    const lin = _leastSquaresLinear(points);
    return { type: 'quadratic', a: 0, b: lin.m, c: lin.b, error: lin.error };
  }

  // Compute mean squared error.
  let errSum = 0;
  for (let i = 0; i < n; i++) {
    const px = points[i].x;
    const predicted = a * px * px + b * px + c;
    const diff = points[i].y - predicted;
    errSum += diff * diff;
  }

  return { type: 'quadratic', a, b, c, error: errSum / n };
}

/** 3×3 determinant via Sarrus' rule. */
function _det3x3(a1, a2, a3, b1, b2, b3, c1, c2, c3) {
  return (
    a1 * (b2 * c3 - b3 * c2) -
    a2 * (b1 * c3 - b3 * c1) +
    a3 * (b1 * c2 - b2 * c1)
  );
}

// ─── Drawing Helpers ────────────────────────────────────────────────────────

/** Draw a linear line across the graph range. */
function _drawLinearLine(ctx, fit, radius, toPixel) {
  const x0 = -radius;
  const x1 = radius;
  const y0 = fit.m * x0 + fit.b;
  const y1 = fit.m * x1 + fit.b;
  const p0 = toPixel(x0, y0);
  const p1 = toPixel(x1, y1);
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.stroke();
}

/** Draw a quadratic curve across the graph range using line segments. */
function _drawQuadraticCurve(ctx, fit, radius, toPixel) {
  const steps = 64;
  const dx = (radius * 2) / steps;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const x = -radius + i * dx;
    const y = fit.a * x * x + fit.b * x + fit.c;
    const p = toPixel(x, y);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}
