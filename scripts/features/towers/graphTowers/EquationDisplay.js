/**
 * EquationDisplay — UI helper that renders glyph equations in a readable,
 * math-like format for tower info panels.
 *
 * For each equation, displays three lines:
 *   1. Symbolic:    PointLifetime = 4 + 0.5·ℵ + 1.0·בּ
 *   2. Substituted: PointLifetime = 4 + 0.5·3 + 1.0·2
 *   3. Numeric:     PointLifetime = 6.5 seconds
 *
 * This module creates and manages DOM elements for equation display,
 * updating live when glyph counts change.
 */

import { GLYPH_SYMBOLS, GLYPH_TIERS } from './GlyphEquation.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** CSS class prefix for equation elements. */
const CSS_PREFIX = 'glyph-eq';

/** Monospace-style font for equations. */
const EQUATION_FONT = '"Courier New", Courier, monospace';

// ─── EquationDisplay ────────────────────────────────────────────────────────

export class EquationDisplay {
  /**
   * @param {HTMLElement} container - Parent DOM element to render equations into.
   */
  constructor(container) {
    this._container = container;
    /** @type {Map<string, HTMLElement>} Cached DOM elements by equation name. */
    this._elements = new Map();
  }

  /**
   * Render all equations from a GraphTowerBase instance.
   * Creates or updates DOM elements as needed.
   *
   * @param {import('./GraphTowerBase.js').GraphTowerBase} tower - Tower to display.
   */
  renderTower(tower) {
    const equationLines = tower.getEquationDisplayLines();
    const names = [...tower.equations.keys()];

    // Remove stale elements.
    for (const [name, el] of this._elements) {
      if (!tower.equations.has(name)) {
        el.remove();
        this._elements.delete(name);
      }
    }

    // Create or update each equation.
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const lines = equationLines[i];
      let el = this._elements.get(name);

      if (!el) {
        el = this._createEquationElement(name);
        this._container.appendChild(el);
        this._elements.set(name, el);
      }

      this._updateEquationElement(el, lines);
    }
  }

  /**
   * Render a concise summary for canvas-based UI (returns array of strings).
   * @param {import('./GraphTowerBase.js').GraphTowerBase} tower
   * @returns {string[]}
   */
  getCanvasLines(tower) {
    const lines = [];
    for (const eq of tower.equations.values()) {
      const display = eq.allDisplayLines(tower.glyphs);
      lines.push(display.symbolic);
      lines.push(display.numeric);
    }
    return lines;
  }

  /**
   * Render a glyph allocation summary.
   * @param {Object} glyphs - Map of glyph type → count.
   * @returns {string}
   */
  static formatGlyphAllocation(glyphs) {
    const parts = [];
    for (const tier of GLYPH_TIERS) {
      const count = glyphs[tier] || 0;
      if (count > 0) {
        parts.push(`${GLYPH_SYMBOLS[tier]}×${count}`);
      }
    }
    return parts.length > 0 ? parts.join('  ') : 'No glyphs allocated';
  }

  /**
   * Draw equations directly onto a canvas context (for in-game overlays).
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('./GraphTowerBase.js').GraphTowerBase} tower
   * @param {number} x - Left edge.
   * @param {number} y - Top edge.
   * @param {number} maxWidth - Maximum text width.
   */
  static drawOnCanvas(ctx, tower, x, y, maxWidth) {
    ctx.save();
    ctx.font = '10px serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'left';

    let currentY = y;
    const lineHeight = 13;

    // Tower name.
    ctx.font = 'bold 11px serif';
    ctx.fillText(tower.name, x, currentY);
    currentY += lineHeight + 2;

    // Glyph allocation.
    ctx.font = '10px serif';
    ctx.fillStyle = 'rgba(200,200,160,0.8)';
    ctx.fillText(EquationDisplay.formatGlyphAllocation(tower.glyphs), x, currentY);
    currentY += lineHeight + 4;

    // Each equation: symbolic + numeric.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const eq of tower.equations.values()) {
      const display = eq.allDisplayLines(tower.glyphs);
      ctx.font = '10px serif';
      ctx.fillText(display.symbolic, x, currentY, maxWidth);
      currentY += lineHeight;
      ctx.fillStyle = 'rgba(180,220,255,0.9)';
      ctx.fillText(display.numeric, x, currentY, maxWidth);
      currentY += lineHeight + 2;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
    }

    ctx.restore();
  }

  // ── Internal DOM Helpers ──────────────────────────────────────────────────

  /** Create a new equation display element. */
  _createEquationElement(_name) {
    const wrapper = document.createElement('div');
    wrapper.className = `${CSS_PREFIX}-wrapper`;
    wrapper.style.marginBottom = '6px';
    wrapper.style.fontFamily = EQUATION_FONT;
    wrapper.style.fontSize = '12px';
    wrapper.style.lineHeight = '1.5';

    const symLine = document.createElement('div');
    symLine.className = `${CSS_PREFIX}-symbolic`;
    symLine.style.color = 'rgba(255,255,255,0.7)';
    wrapper.appendChild(symLine);

    const subLine = document.createElement('div');
    subLine.className = `${CSS_PREFIX}-substituted`;
    subLine.style.color = 'rgba(200,200,200,0.6)';
    subLine.style.fontSize = '11px';
    wrapper.appendChild(subLine);

    const numLine = document.createElement('div');
    numLine.className = `${CSS_PREFIX}-numeric`;
    numLine.style.color = 'rgba(160,220,255,0.9)';
    numLine.style.fontWeight = 'bold';
    wrapper.appendChild(numLine);

    return wrapper;
  }

  /** Update an existing equation element with new display lines. */
  _updateEquationElement(el, lines) {
    const children = el.children;
    if (children[0]) children[0].textContent = lines.symbolic;
    if (children[1]) children[1].textContent = lines.substituted;
    if (children[2]) children[2].textContent = lines.numeric;
  }

  /** Remove all elements and clear the cache. */
  clear() {
    for (const el of this._elements.values()) {
      el.remove();
    }
    this._elements.clear();
  }
}
