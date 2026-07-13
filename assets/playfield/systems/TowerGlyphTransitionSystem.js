// Tower glyph transition system extracted from SimplePlayfield.
// Manages the data and lifecycle for glyph promotion/demotion animations.

import { ALPHA_BASE_RADIUS_FACTOR } from '../../gameUnits.js';

// Timing constants for each phase of the glyph transition animation.
const TOWER_GLYPH_NEW_SYMBOL_DELAY_MS = 120;
const TOWER_GLYPH_NEW_SYMBOL_FADE_MS = 420;
const TOWER_GLYPH_FLASH_DURATION_MS = 520;
const TOWER_GLYPH_FLASH_HOLD_MS = 160;
const TOWER_GLYPH_FROM_SYMBOL_FADE_MS = 260;
const TOWER_GLYPH_MIN_PARTICLES = 14;
const TOWER_GLYPH_MAX_PARTICLES = 28;
// Default swipe vectors when no gesture vector is available.
const DEFAULT_PROMOTION_VECTOR = { x: 0, y: -1 };
const DEFAULT_DEMOTION_VECTOR = { x: 0, y: 1 };

/**
 * Schedule a glyph transition animation so promotions/demotions feel tactile.
 */
function queueTowerGlyphTransition(
  tower,
  { fromSymbol = '', toSymbol = '', mode = 'promote', swipeVector = null } = {},
) {
  if (!tower?.id || !Number.isFinite(tower.x) || !Number.isFinite(tower.y)) {
    return;
  }
  if (!this.towerGlyphTransitions) {
    this.towerGlyphTransitions = new Map();
  }
  const fallbackDirection = mode === 'demote' ? DEFAULT_DEMOTION_VECTOR : DEFAULT_PROMOTION_VECTOR;
  const { direction, magnitude } = this.normalizeSwipeVector(swipeVector, fallbackDirection);
  const now = this.getCurrentTimestamp();
  const strengthRatio = Math.min(1.35, Math.max(0.65, 0.45 + magnitude / 90));
  const entry = {
    towerId: tower.id,
    startedAt: now,
    mode,
    fromSymbol: typeof fromSymbol === 'string' ? fromSymbol : '',
    toSymbol: typeof toSymbol === 'string' ? toSymbol : '',
    direction,
    swipeStrength: magnitude,
    strengthRatio,
    newSymbolDelay: TOWER_GLYPH_NEW_SYMBOL_DELAY_MS,
    newSymbolFade: TOWER_GLYPH_NEW_SYMBOL_FADE_MS,
    flashDuration: TOWER_GLYPH_FLASH_DURATION_MS,
    flashHold: TOWER_GLYPH_FLASH_HOLD_MS,
    fromSymbolFade: TOWER_GLYPH_FROM_SYMBOL_FADE_MS,
  };
  entry.particles = this.buildTowerGlyphParticles(entry);
  const longestParticle = entry.particles.reduce(
    (max, particle) => Math.max(max, (particle.delay || 0) + (particle.duration || 0)),
    0,
  );
  entry.totalDuration =
    Math.max(
      entry.flashDuration + entry.flashHold + 120,
      entry.newSymbolDelay + entry.newSymbolFade,
      entry.fromSymbolFade + 90,
      longestParticle,
    ) + 60;
  this.towerGlyphTransitions.set(tower.id, entry);
}

/**
 * Generate particle descriptors that trail the departing glyph.
 */
function buildTowerGlyphParticles(entry = {}) {
  const baseRadius = Math.max(12, Math.min(this.renderWidth, this.renderHeight) * ALPHA_BASE_RADIUS_FACTOR);
  const ratio = Number.isFinite(entry.strengthRatio) ? Math.max(0.65, entry.strengthRatio) : 1;
  const normalized = Math.min(1, ratio / 1.35);
  const particleCount = Math.max(
    TOWER_GLYPH_MIN_PARTICLES,
    Math.round(TOWER_GLYPH_MIN_PARTICLES + (TOWER_GLYPH_MAX_PARTICLES - TOWER_GLYPH_MIN_PARTICLES) * normalized),
  );
  const particles = [];
  for (let index = 0; index < particleCount; index += 1) {
    const duration = 360 + Math.random() * 360;
    particles.push({
      delay: Math.random() * 90,
      duration,
      maxDistance: baseRadius * (0.85 + Math.random() * 1.25) * ratio,
      lateral: baseRadius * 0.35 * (Math.random() - 0.5) * ratio,
      offsetX: (Math.random() - 0.5) * baseRadius * 0.3,
      offsetY: (Math.random() - 0.5) * baseRadius * 0.3,
      size: Math.max(1.5, baseRadius * 0.08) * (0.6 + Math.random() * 0.9),
      alpha: 0.65 + Math.random() * 0.3,
      hueShift: Math.random(),
    });
  }
  return particles;
}

/**
 * Normalize swipe vectors so the renderer knows which way particles should depart.
 */
function normalizeSwipeVector(vector, fallbackDirection = DEFAULT_PROMOTION_VECTOR) {
  const fallback = fallbackDirection || DEFAULT_PROMOTION_VECTOR;
  const fallbackLength = Math.hypot(fallback.x || 0, fallback.y || 0) || 1;
  const fallbackNormalized = { x: (fallback.x || 0) / fallbackLength, y: (fallback.y || 0) / fallbackLength };
  if (!vector || (!Number.isFinite(vector.x) && !Number.isFinite(vector.y))) {
    return { direction: fallbackNormalized, magnitude: 0 };
  }
  const dx = Number.isFinite(vector.x) ? vector.x : 0;
  const dy = Number.isFinite(vector.y) ? vector.y : 0;
  const length = Math.hypot(dx, dy);
  if (!length) {
    return { direction: fallbackNormalized, magnitude: 0 };
  }
  return { direction: { x: dx / length, y: dy / length }, magnitude: length };
}

/**
 * Advance glyph transitions and retire finished entries.
 */
function updateTowerGlyphTransitions() {
  if (!this.towerGlyphTransitions || this.towerGlyphTransitions.size === 0) {
    return;
  }
  const now = this.getCurrentTimestamp();
  const expired = [];
  this.towerGlyphTransitions.forEach((entry, towerId) => {
    if (!entry) {
      expired.push(towerId);
      return;
    }
    const elapsed = now - (entry.startedAt || 0);
    entry.elapsed = elapsed;
    const cap = Number.isFinite(entry.totalDuration) ? entry.totalDuration : 600;
    if (elapsed >= cap) {
      expired.push(towerId);
    }
  });
  expired.forEach((towerId) => this.towerGlyphTransitions.delete(towerId));
}

export {
  queueTowerGlyphTransition,
  buildTowerGlyphParticles,
  normalizeSwipeVector,
  updateTowerGlyphTransitions,
};
