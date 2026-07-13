/**
 * GlyphEquation — shared framework for glyph-driven mathematical equations.
 *
 * Every tower upgrade is expressed as a mathematical equation whose terms depend
 * on glyph counts. The system provides three views:
 *   1. Symbolic   — e.g. "4 + 0.5·ℵ + 1.0·בּ"
 *   2. Substituted — e.g. "4 + 0.5·3 + 1.0·2"
 *   3. Numeric    — e.g. "6.5"
 *
 * Glyph tiers (ascending rarity):
 *   Aleph (ℵ)  → Bet (בּ) → Lamed (ל) → Tsadi (צ) → Shin (ש) → Kuf (ק)
 */

// ─── Glyph Definitions ──────────────────────────────────────────────────────

/** Glyph tier order used for UI display and precedence. */
export const GLYPH_TIERS = Object.freeze([
  'Aleph', 'Bet', 'Lamed', 'Tsadi', 'Shin', 'Kuf',
]);

/** Unicode symbols for each glyph type. */
export const GLYPH_SYMBOLS = Object.freeze({
  Aleph: 'ℵ',
  Bet:   'בּ',
  Lamed: 'ל',
  Tsadi: 'צ',
  Shin:  'ש',
  Kuf:   'ק',
});

/** Creates a zeroed glyph allocation. */
export function createGlyphCounts() {
  return { Aleph: 0, Bet: 0, Lamed: 0, Tsadi: 0, Shin: 0, Kuf: 0 };
}

// ─── Equation Term ───────────────────────────────────────────────────────────

/**
 * Describes one additive term in a glyph equation.
 * @typedef {Object} EquationTerm
 * @property {number}       coefficient - Scalar multiplier for the glyph count.
 * @property {string|null}  glyph       - Glyph type key, or null for constant terms.
 * @property {string}       [op]        - Operation: 'add' (default), 'floor'.
 */

// ─── GlyphEquation Class ────────────────────────────────────────────────────

/**
 * Encapsulates a single glyph-driven equation with symbolic / numeric display.
 *
 * Usage:
 *   const eq = new GlyphEquation('PointLifetime', [
 *     { coefficient: 4,   glyph: null },
 *     { coefficient: 0.5, glyph: 'Aleph' },
 *     { coefficient: 1.0, glyph: 'Bet' },
 *   ]);
 *   eq.evaluate(glyphs);   // => 6.5  when Aleph=3, Bet=2
 *   eq.symbolic();          // => "PointLifetime = 4 + 0.5·ℵ + 1.0·בּ"
 *   eq.substituted(glyphs); // => "PointLifetime = 4 + 0.5·3 + 1.0·2"
 *   eq.display(glyphs);     // => "PointLifetime = 6.5"
 */
export class GlyphEquation {
  /**
   * @param {string}          name  - Human-readable equation name.
   * @param {EquationTerm[]}  terms - Ordered list of additive terms.
   * @param {Object}          [opts]
   * @param {number}          [opts.min]    - Clamp result lower bound.
   * @param {number}          [opts.max]    - Clamp result upper bound.
   * @param {boolean}         [opts.floor]  - Floor the final result to integer.
   */
  constructor(name, terms, opts = {}) {
    this.name = name;
    this.terms = terms;
    this.min = opts.min ?? -Infinity;
    this.max = opts.max ?? Infinity;
    this.floor = opts.floor ?? false;

    // Cache the symbolic representation since it never changes.
    this._symbolicCache = null;
  }

  /**
   * Compute the numeric result from the current glyph counts.
   * @param {Object} glyphs - Map of glyph type → count.
   * @returns {number}
   */
  evaluate(glyphs) {
    let result = 0;
    for (let i = 0; i < this.terms.length; i++) {
      const term = this.terms[i];
      const glyphValue = term.glyph ? (glyphs[term.glyph] || 0) : 1;
      let contribution = term.coefficient * glyphValue;
      if (term.op === 'floor') {
        contribution = Math.floor(contribution);
      }
      result += contribution;
    }
    if (this.floor) {
      result = Math.floor(result);
    }
    return Math.min(this.max, Math.max(this.min, result));
  }

  /**
   * Returns the symbolic equation string using glyph symbols.
   * @returns {string}
   */
  symbolic() {
    if (this._symbolicCache) return this._symbolicCache;
    const parts = [];
    for (let i = 0; i < this.terms.length; i++) {
      const term = this.terms[i];
      if (!term.glyph) {
        parts.push(_formatCoefficient(term.coefficient));
      } else {
        const sym = GLYPH_SYMBOLS[term.glyph] || term.glyph;
        if (term.op === 'floor') {
          parts.push(`⌊${_formatCoefficient(term.coefficient)}·${sym}⌋`);
        } else {
          parts.push(`${_formatCoefficient(term.coefficient)}·${sym}`);
        }
      }
    }
    this._symbolicCache = `${this.name} = ${parts.join(' + ')}`;
    return this._symbolicCache;
  }

  /**
   * Returns the equation with glyph counts substituted in place of symbols.
   * @param {Object} glyphs - Map of glyph type → count.
   * @returns {string}
   */
  substituted(glyphs) {
    const parts = [];
    for (let i = 0; i < this.terms.length; i++) {
      const term = this.terms[i];
      if (!term.glyph) {
        parts.push(_formatCoefficient(term.coefficient));
      } else {
        const val = glyphs[term.glyph] || 0;
        if (term.op === 'floor') {
          parts.push(`⌊${_formatCoefficient(term.coefficient)}·${val}⌋`);
        } else {
          parts.push(`${_formatCoefficient(term.coefficient)}·${val}`);
        }
      }
    }
    return `${this.name} = ${parts.join(' + ')}`;
  }

  /**
   * Returns the evaluated numeric result as a display string.
   * @param {Object} glyphs - Map of glyph type → count.
   * @returns {string}
   */
  display(glyphs) {
    const val = this.evaluate(glyphs);
    return `${this.name} = ${_formatNumber(val)}`;
  }

  /**
   * Returns all three display lines for UI panels.
   * @param {Object} glyphs - Map of glyph type → count.
   * @returns {{ symbolic: string, substituted: string, numeric: string }}
   */
  allDisplayLines(glyphs) {
    return {
      symbolic:    this.symbolic(),
      substituted: this.substituted(glyphs),
      numeric:     this.display(glyphs),
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a coefficient for display, trimming unnecessary decimals. */
function _formatCoefficient(value) {
  if (Number.isInteger(value)) return String(value);
  // Show up to 2 decimal places without trailing zeros.
  return parseFloat(value.toFixed(2)).toString();
}

/** Format a numeric result for display with sensible precision. */
function _formatNumber(value) {
  if (Number.isInteger(value)) return String(value);
  if (Math.abs(value) >= 100) return value.toFixed(1);
  return parseFloat(value.toFixed(2)).toString();
}
