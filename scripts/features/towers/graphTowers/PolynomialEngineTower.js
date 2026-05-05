/**
 * PolynomialEngineTower — constructs and weaponises polynomial curves.
 *
 * The tower fits a polynomial of upgradeable degree to the active graph points
 * and applies continuous damage along the resulting curve. At higher Shin tiers,
 * pulse projectiles are emitted along the curve.
 *
 * Degree is glyph-driven:
 *   BaseDegree = 1 + floor(Lamed / 2)
 *   MaxDegree  = 2 + floor(Tsadi / 2) + floor(Shin / 2) + floor(Kuf / 2)
 *
 * All formulas are glyph-driven via GlyphEquation instances.
 */

import { GraphTowerBase } from './GraphTowerBase.js';
import { GlyphEquation } from './GlyphEquation.js';
import { clamp } from '../shared/TowerUtils.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Curve rendering steps — more steps = smoother curves. */
const CURVE_STEPS = 80;

/** Pulse animation constants. */
const PULSE_SPEED = 8;  // Grid units per second along the curve.
const PULSE_RADIUS = 3; // Pixel radius of pulse dots.

/** Visual constants. */
const CURVE_COLOR = 'rgba(200,160,255,0.8)';
const CURVE_GLOW_COLOR = 'rgba(200,160,255,0.15)';
const PULSE_COLOR = 'rgba(255,220,160,0.9)';
const COEFF_DISPLAY_COLOR = 'rgba(255,255,255,0.8)';

// ─── PolynomialEngineTower ──────────────────────────────────────────────────

export class PolynomialEngineTower extends GraphTowerBase {
  constructor() {
    super({ id: 'polynomial_engine', name: 'Polynomial Engine Tower' });

    // Current polynomial coefficients [a0, a1, a2, ...] where y = a0 + a1*x + a2*x² + ...
    this._coefficients = [];
    this._degree = 1;

    // Pulse state.
    this._pulses = [];        // Array of { t: progress along curve [0..1], active: bool }
    this._pulseTimer = 0;
    this._pulseInterval = 0.8; // Time between pulses (seconds).

    // Cached curve points for pulse following.
    this._curvePoints = [];
  }

  // ── Equation Definitions ─────────────────────────────────────────────────

  _buildEquations() {
    // Base degree: 1 + floor(Lamed / 2)
    this._baseDegreeEq = new GlyphEquation('BaseDegree', [
      { coefficient: 1,   glyph: null },
      { coefficient: 0.5, glyph: 'Lamed', op: 'floor' },
    ], { min: 1, floor: true });
    this.equations.set('BaseDegree', this._baseDegreeEq);

    // Max degree: 2 + floor(Tsadi/2) + floor(Shin/2) + floor(Kuf/2)
    this._maxDegreeEq = new GlyphEquation('MaxDegree', [
      { coefficient: 2,   glyph: null },
      { coefficient: 0.5, glyph: 'Tsadi', op: 'floor' },
      { coefficient: 0.5, glyph: 'Shin',  op: 'floor' },
      { coefficient: 0.5, glyph: 'Kuf',   op: 'floor' },
    ], { min: 2, floor: true });
    this.equations.set('MaxDegree', this._maxDegreeEq);

    // Curve DPS: 5 + 1.2·Aleph + 2.5·Bet + 5·Lamed + 8·Tsadi
    this._curveDpsEq = new GlyphEquation('CurveDPS', [
      { coefficient: 5,   glyph: null },
      { coefficient: 1.2, glyph: 'Aleph' },
      { coefficient: 2.5, glyph: 'Bet' },
      { coefficient: 5,   glyph: 'Lamed' },
      { coefficient: 8,   glyph: 'Tsadi' },
    ]);
    this.equations.set('CurveDPS', this._curveDpsEq);

    // Curve width: 0.18 + 0.02·Aleph + 0.05·Lamed + 0.08·Tsadi
    this._curveWidthEq = new GlyphEquation('CurveWidth', [
      { coefficient: 0.18, glyph: null },
      { coefficient: 0.02, glyph: 'Aleph' },
      { coefficient: 0.05, glyph: 'Lamed' },
      { coefficient: 0.08, glyph: 'Tsadi' },
    ]);
    this.equations.set('CurveWidth', this._curveWidthEq);

    // Pulse count: 1 + floor(Shin/2) + floor(Kuf/2)
    this._pulseCountEq = new GlyphEquation('PulseCount', [
      { coefficient: 1,   glyph: null },
      { coefficient: 0.5, glyph: 'Shin', op: 'floor' },
      { coefficient: 0.5, glyph: 'Kuf',  op: 'floor' },
    ], { min: 1, floor: true });
    this.equations.set('PulseCount', this._pulseCountEq);
  }

  // ── Per-Frame Logic ──────────────────────────────────────────────────────

  _onTick(dt, _now) {
    const points = this.pointPool.active;

    // Determine effective degree.
    const baseDeg = this._baseDegreeEq.evaluate(this.glyphs);
    const maxDeg = this._maxDegreeEq.evaluate(this.glyphs);
    this._degree = Math.min(baseDeg, maxDeg);

    // Need at least (degree + 1) points for a polynomial fit.
    if (points.length > this._degree) {
      this._coefficients = _fitPolynomial(points, this._degree);
      this._buildCurvePoints();
    } else {
      this._coefficients = [];
      this._curvePoints = [];
    }

    // Update pulses if Shin ≥ 1 and we have a curve.
    if (this.glyphs.Shin >= 1 && this._curvePoints.length > 0) {
      this._updatePulses(dt);
    } else {
      this._pulses = [];
    }
  }

  // ── Polynomial Fitting ────────────────────────────────────────────────────

  /** Build the sampled curve points for rendering and pulse-following. */
  _buildCurvePoints() {
    this._curvePoints = [];
    if (this._coefficients.length === 0) return;

    const radius = this._radius;
    const dx = (radius * 2) / CURVE_STEPS;

    for (let i = 0; i <= CURVE_STEPS; i++) {
      const x = -radius + i * dx;
      const y = _evaluatePolynomial(this._coefficients, x);
      this._curvePoints.push({ x, y });
    }
  }

  // ── Pulse System ──────────────────────────────────────────────────────────

  /** Update pulse positions along the curve. */
  _updatePulses(dt) {
    const maxPulses = this._pulseCountEq.evaluate(this.glyphs);

    // Advance existing pulses.
    for (let i = this._pulses.length - 1; i >= 0; i--) {
      this._pulses[i].t += (PULSE_SPEED / (this._radius * 2)) * dt;
      if (this._pulses[i].t >= 1) {
        this._pulses.splice(i, 1);
      }
    }

    // Spawn new pulses at interval.
    this._pulseTimer += dt;
    if (this._pulseTimer >= this._pulseInterval) {
      this._pulseTimer -= this._pulseInterval;
      const toSpawn = Math.min(maxPulses - this._pulses.length, maxPulses);
      for (let i = 0; i < toSpawn; i++) {
        this._pulses.push({ t: i * 0.15 }); // Stagger slightly.
      }
    }
  }

  // ── Damage Queries ────────────────────────────────────────────────────────

  /**
   * Returns the curve damage per second.
   * @returns {number}
   */
  getCurveDPS() {
    if (this._coefficients.length === 0) return 0;
    return this._curveDpsEq.evaluate(this.glyphs);
  }

  /**
   * Returns the current curve width in grid units.
   * @returns {number}
   */
  getCurveWidth() {
    return this._curveWidthEq.evaluate(this.glyphs);
  }

  /**
   * Returns the current polynomial degree.
   * @returns {number}
   */
  get degree() {
    return this._degree;
  }

  /**
   * Returns the current polynomial coefficients.
   * @returns {number[]}
   */
  get coefficients() {
    return this._coefficients;
  }

  // ── Rendering Overlay ────────────────────────────────────────────────────

  _drawOverlay(ctx, toPixel, radius, scale, cx, cy, _now) {
    if (this._curvePoints.length === 0) return;

    const curveWidth = this._curveWidthEq.evaluate(this.glyphs) * scale;

    // Draw curve glow.
    ctx.save();
    ctx.strokeStyle = CURVE_GLOW_COLOR;
    ctx.lineWidth = Math.max(4, curveWidth * 3);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this._strokeCurve(ctx, toPixel);
    ctx.restore();

    // Draw main curve.
    ctx.save();
    ctx.strokeStyle = CURVE_COLOR;
    ctx.lineWidth = Math.max(1.5, curveWidth);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this._strokeCurve(ctx, toPixel);
    ctx.restore();

    // Draw pulses.
    if (this._pulses.length > 0) {
      this._drawPulses(ctx, toPixel);
    }

    // Display polynomial equation text.
    this._drawEquationText(ctx, cx, cy, radius, scale);
  }

  /** Stroke the polynomial curve path. */
  _strokeCurve(ctx, toPixel) {
    ctx.beginPath();
    for (let i = 0; i < this._curvePoints.length; i++) {
      const cp = this._curvePoints[i];
      const p = toPixel(cp.x, cp.y);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  /** Draw pulse dots along the curve. */
  _drawPulses(ctx, toPixel) {
    ctx.save();
    ctx.fillStyle = PULSE_COLOR;
    for (let i = 0; i < this._pulses.length; i++) {
      const pulse = this._pulses[i];
      const idx = Math.floor(pulse.t * (this._curvePoints.length - 1));
      const clampedIdx = clamp(idx, 0, this._curvePoints.length - 1);
      const cp = this._curvePoints[clampedIdx];
      const p = toPixel(cp.x, cp.y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, PULSE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Display the polynomial equation above the graph. */
  _drawEquationText(ctx, cx, cy, radius, scale) {
    if (this._coefficients.length === 0) return;

    ctx.save();
    ctx.fillStyle = COEFF_DISPLAY_COLOR;
    ctx.font = '11px serif';
    ctx.textAlign = 'center';

    const terms = [];
    for (let i = this._coefficients.length - 1; i >= 0; i--) {
      const c = this._coefficients[i];
      if (Math.abs(c) < 0.001) continue;
      const cStr = Math.abs(c) < 10 ? c.toFixed(2) : c.toFixed(1);
      if (i === 0) {
        terms.push(cStr);
      } else if (i === 1) {
        terms.push(`${cStr}x`);
      } else {
        terms.push(`${cStr}x${_superscript(i)}`);
      }
    }

    const eqText = `y = ${terms.join(' + ').replace(/\+ -/g, '- ')}`;
    ctx.fillText(eqText, cx, cy - radius * scale - 8);
    ctx.restore();
  }

  _onReset() {
    this._coefficients = [];
    this._curvePoints = [];
    this._pulses = [];
    this._pulseTimer = 0;
  }
}

// ─── Polynomial Math ────────────────────────────────────────────────────────

/**
 * Evaluate a polynomial at x given coefficients [a0, a1, a2, ...].
 * y = a0 + a1*x + a2*x² + ...
 * Uses Horner's method for numerical stability.
 */
function _evaluatePolynomial(coeffs, x) {
  let result = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = result * x + coeffs[i];
  }
  return result;
}

/**
 * Fit a polynomial of given degree to the points using least-squares.
 * Solves the normal equations via Gaussian elimination.
 * @param {Array} points - Array of { x, y }.
 * @param {number} degree - Polynomial degree.
 * @returns {number[]} Coefficients [a0, a1, ..., a_degree].
 */
function _fitPolynomial(points, degree) {
  const n = points.length;
  const m = degree + 1;

  // Build the Vandermonde-like normal equations: (X^T X) a = X^T y
  // We compute the sums directly to avoid allocating the full Vandermonde.

  // Sum of x^k for k = 0 to 2*degree.
  const sxk = new Array(2 * degree + 1).fill(0);
  for (let i = 0; i < n; i++) {
    let xpow = 1;
    for (let k = 0; k < sxk.length; k++) {
      sxk[k] += xpow;
      xpow *= points[i].x;
    }
  }

  // Sum of x^k * y for k = 0 to degree.
  const sxky = new Array(m).fill(0);
  for (let i = 0; i < n; i++) {
    let xpow = 1;
    for (let k = 0; k < m; k++) {
      sxky[k] += xpow * points[i].y;
      xpow *= points[i].x;
    }
  }

  // Build augmented matrix [A | b] where A[i][j] = sxk[i+j], b[i] = sxky[i].
  const aug = [];
  for (let i = 0; i < m; i++) {
    const row = new Array(m + 1);
    for (let j = 0; j < m; j++) {
      row[j] = sxk[i + j];
    }
    row[m] = sxky[i];
    aug.push(row);
  }

  // Gaussian elimination with partial pivoting.
  for (let col = 0; col < m; col++) {
    // Find pivot.
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < m; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) {
      const tmp = aug[col];
      aug[col] = aug[maxRow];
      aug[maxRow] = tmp;
    }

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) {
      // Singular — return zero coefficients.
      return new Array(m).fill(0);
    }

    // Eliminate below.
    for (let row = col + 1; row < m; row++) {
      const factor = aug[row][col] / pivot;
      for (let j = col; j <= m; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Back-substitution.
  const coeffs = new Array(m).fill(0);
  for (let i = m - 1; i >= 0; i--) {
    let sum = aug[i][m];
    for (let j = i + 1; j < m; j++) {
      sum -= aug[i][j] * coeffs[j];
    }
    coeffs[i] = sum / aug[i][i];
  }

  return coeffs;
}

/** Convert a number to Unicode superscript digits. */
function _superscript(n) {
  const sups = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  return String(n).split('').map(d => sups[d] || d).join('');
}
