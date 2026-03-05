/**
 * Sunlight Renderer
 *
 * Implements a warm, ray-tracing-inspired sunlight effect emanating from the
 * Mind Gate. Inspired by the SunRenderer class in sethrimer3/SoL.
 *
 * Features:
 * - Warm radial glow centered on the Mind Gate
 * - Trapezoidal shadow quads cast by towers and enemies
 * - Simple offset circle shadows for mote gems
 * - Lit-edge shine arc on the gate-facing side of each tower
 *
 * All exported functions are designed to be called with `.call(renderer)` where
 * `renderer` is the CanvasRenderer / SimplePlayfield instance, matching the
 * established calling convention in CanvasRenderer.js.
 */

import { moteGemState } from '../../../enemies.js';
import { ALPHA_BASE_RADIUS_FACTOR } from '../../../gameUnits.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const TWO_PI = Math.PI * 2;
const HALF = 0.5;

// Viewport culling margin matches other renderer modules.
const VIEWPORT_CULL_MARGIN = 100;

// Sunlight radius is a fraction of the larger playfield dimension so the effect
// scales sensibly on both portrait (mobile) and landscape (desktop) orientations.
const SUNLIGHT_RADIUS_FACTOR = 0.25;

// Bloom overlay covers a smaller central region for a brighter warm core.
const BLOOM_RADIUS_FACTOR = 0.55;

// Shadow length scaling: a tower at the edge of the sunlight radius casts a
// shadow this many times longer than the tower body radius.
const SHADOW_LENGTH_FACTOR = 6;

// Warm dark tone used for shadow quads – avoids pure black so shadows blend
// naturally with the golden-hour colour palette.
const SHADOW_COLOR_R = 20;
const SHADOW_COLOR_G = 12;
const SHADOW_COLOR_B = 5;

// Tower shadow near-edge alpha (full opacity at the base of the shadow).
const TOWER_SHADOW_NEAR_ALPHA = 0.25;
// Enemy shadow is slightly softer.
const ENEMY_SHADOW_NEAR_ALPHA = 0.18;
// Enemy shadow circle is intentionally small so the cast shape reads as a compact dot.
const ENEMY_SHADOW_RADIUS_FACTOR = 0.5;
const ENEMY_SHADOW_RADIUS_MIN = 3.5;
const ENEMY_SHADOW_RADIUS_MAX = 7;
// Mote gem circle shadow is very subtle.
const GEM_SHADOW_ALPHA = 0.12;

// Gem unit scale: fraction of the min viewport dimension used to size gem visuals,
// mirroring the GEM_MOTE_BASE_RATIO calculation in CanvasRenderer's drawMoteGems.
const GEM_UNIT_SCALE_FACTOR = 0.02;
// Minimum gem radius in pixels so shadow circles remain visible at any zoom level.
const MIN_GEM_RADIUS = 3;
// Scale factor applied to gem unit * moteSize to produce the gem's rendered radius.
const GEM_RADIUS_SCALE = 0.45;
// How far (as a multiple of gemRadius) the shadow circle is displaced away from
// the gate relative to the gem centre so it peeks out from behind the gem.
const GEM_SHADOW_OFFSET_FACTOR = 1.2;
// Shadow circle is slightly smaller than the gem itself for a natural look.
const GEM_SHADOW_RADIUS_FACTOR = 0.85;

// Shine arc angular half-width in radians (~37° either side = ~75° total arc).
const SHINE_ARC_HALF_ANGLE = Math.PI / 5;

// Arc sits just inside the tower body outline so it reads as a lit inner edge.
const SHINE_RADIUS_FACTOR = 0.92;
// Maximum alpha contribution for the shine highlight at zero distance.
const SHINE_ALPHA_FACTOR = 0.72;
// Line width of the shine arc as a fraction of the tower body radius.
const SHINE_LINE_WIDTH_FACTOR = 0.22;

// ─── Utility helpers ──────────────────────────────────────────────────────────

/**
 * Calculate the visible viewport bounds in world coordinates.
 * Duplicated from CanvasRenderer.js to avoid a circular import.
 */
function getViewportBounds() {
  if (this._frameCache?.viewportBounds) {
    return this._frameCache.viewportBounds;
  }
  if (!this.canvas || !this.ctx) {
    return null;
  }
  const width = this.renderWidth || this.canvas.clientWidth || 0;
  const height = this.renderHeight || this.canvas.clientHeight || 0;
  const viewCenter = this.getViewCenter();
  const scale = this.viewScale || 1;
  const halfWidth = (width / scale) * HALF + VIEWPORT_CULL_MARGIN;
  const halfHeight = (height / scale) * HALF + VIEWPORT_CULL_MARGIN;
  return {
    minX: viewCenter.x - halfWidth,
    maxX: viewCenter.x + halfWidth,
    minY: viewCenter.y - halfHeight,
    maxY: viewCenter.y + halfHeight,
  };
}

/**
 * Check if a position is within the visible viewport.
 * Duplicated from CanvasRenderer.js to avoid a circular import.
 */
function isInViewport(position, bounds, radius = 0) {
  if (!position) {
    return false;
  }
  if (!bounds) {
    return true;
  }
  const x = position.x || 0;
  const y = position.y || 0;
  return (
    x + radius >= bounds.minX &&
    x - radius <= bounds.maxX &&
    y + radius >= bounds.minY &&
    y - radius <= bounds.maxY
  );
}

/**
 * Resolve the standard tower body radius in pixels for the current render dimensions.
 * Mirrors the calculation used in TowerSpriteRenderer.js.
 */
function resolveTowerBodyRadius() {
  return Math.max(12, Math.min(this.renderWidth, this.renderHeight) * ALPHA_BASE_RADIUS_FACTOR);
}

/**
 * Compute the sunlight radius from the current render dimensions.
 * Cached on `this._sunlightCache` until dimensions change.
 */
function resolveSunlightRadius() {
  const w = this.renderWidth || 0;
  const h = this.renderHeight || 0;
  const larger = Math.max(w, h) || 1;
  return larger * SUNLIGHT_RADIUS_FACTOR;
}

/**
 * Return the Mind Gate world-space position (last path point), or null.
 */
function resolveMindGatePosition() {
  const points = this.pathPoints;
  if (!Array.isArray(points) || points.length === 0) {
    return null;
  }
  return points[points.length - 1];
}

/**
 * Fill a soft shadow trapezoid using a linear gradient that fades from near to far.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} v1 - Near vertex 1 {x, y}
 * @param {Object} v2 - Near vertex 2 {x, y}
 * @param {Object} s2 - Far vertex 2 (shadow of v2) {x, y}
 * @param {Object} s1 - Far vertex 1 (shadow of v1) {x, y}
 * @param {number} nearAlpha
 */
function fillSoftShadowQuad(ctx, v1, v2, s2, s1, nearAlpha) {
  // Gradient runs from midpoint of near edge to midpoint of far edge.
  const nearMidX = (v1.x + v2.x) * HALF;
  const nearMidY = (v1.y + v2.y) * HALF;
  const farMidX = (s1.x + s2.x) * HALF;
  const farMidY = (s1.y + s2.y) * HALF;

  const gradient = ctx.createLinearGradient(nearMidX, nearMidY, farMidX, farMidY);
  gradient.addColorStop(0, `rgba(${SHADOW_COLOR_R},${SHADOW_COLOR_G},${SHADOW_COLOR_B},${nearAlpha})`);
  gradient.addColorStop(0.6, `rgba(${SHADOW_COLOR_R},${SHADOW_COLOR_G},${SHADOW_COLOR_B},${nearAlpha * 0.35})`);
  gradient.addColorStop(1, `rgba(${SHADOW_COLOR_R},${SHADOW_COLOR_G},${SHADOW_COLOR_B},0)`);

  ctx.beginPath();
  ctx.moveTo(v1.x, v1.y);
  ctx.lineTo(v2.x, v2.y);
  ctx.lineTo(s2.x, s2.y);
  ctx.lineTo(s1.x, s1.y);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
}

// ─── Exported render functions ────────────────────────────────────────────────

/**
 * Draw a warm radial sunlight glow emanating from the Mind Gate.
 *
 * Placed after `drawNodes()` and before `drawPlacementPreview()` so it
 * overlays the track but sits beneath interactive UI elements.
 */
export function drawMindGateSunlight() {
  if (!this.ctx) {
    return;
  }
  // Skip while zooming to keep frame rate smooth.
  if (this._zoomingActive) {
    return;
  }

  const gate = resolveMindGatePosition.call(this);
  if (!gate) {
    return;
  }

  const sunlightRadius = resolveSunlightRadius.call(this);
  const ctx = this.ctx;

  ctx.save();

  // Base warm glow layer
  const baseGradient = ctx.createRadialGradient(gate.x, gate.y, 0, gate.x, gate.y, sunlightRadius);
  baseGradient.addColorStop(0, 'rgba(255, 248, 220, 0.35)');
  baseGradient.addColorStop(0.18, 'rgba(255, 192, 96, 0.28)');
  baseGradient.addColorStop(0.42, 'rgba(255, 166, 70, 0.16)');
  baseGradient.addColorStop(1, 'rgba(255, 140, 56, 0)');

  ctx.globalCompositeOperation = 'screen';
  ctx.beginPath();
  ctx.arc(gate.x, gate.y, sunlightRadius, 0, TWO_PI);
  ctx.fillStyle = baseGradient;
  ctx.fill();

  // Bright bloom layer centered on the gate for a warm core glow
  const bloomRadius = sunlightRadius * BLOOM_RADIUS_FACTOR;
  const bloomGradient = ctx.createRadialGradient(gate.x, gate.y, 0, gate.x, gate.y, bloomRadius);
  bloomGradient.addColorStop(0, 'rgba(255, 232, 178, 0.68)');
  bloomGradient.addColorStop(0.16, 'rgba(255, 190, 104, 0.44)');
  bloomGradient.addColorStop(0.38, 'rgba(255, 146, 74, 0.24)');
  bloomGradient.addColorStop(1, 'rgba(255, 120, 45, 0)');

  ctx.beginPath();
  ctx.arc(gate.x, gate.y, bloomRadius, 0, TWO_PI);
  ctx.fillStyle = bloomGradient;
  ctx.fill();

  ctx.restore();
}

/**
 * Draw soft shadow quads cast by towers, enemies, and mote gems.
 *
 * Called immediately after `drawMindGateSunlight()` so shadows sit above
 * the glow but beneath the tower/enemy sprites.
 */
export function drawSunlightShadows() {
  if (!this.ctx) {
    return;
  }
  if (this.isLowGraphicsMode?.() || this._zoomingActive) {
    return;
  }

  const gate = resolveMindGatePosition.call(this);
  if (!gate) {
    return;
  }

  const sunlightRadius = resolveSunlightRadius.call(this);
  const ctx = this.ctx;
  const viewportBounds = this._frameCache?.viewportBounds || getViewportBounds.call(this);
  const towerBodyRadius = resolveTowerBodyRadius.call(this);

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';

  // ── Tower shadows ──────────────────────────────────────────────────────────
  if (Array.isArray(this.towers)) {
    this.towers.forEach((tower) => {
      if (!tower || !Number.isFinite(tower.x) || !Number.isFinite(tower.y)) {
        return;
      }

      const dx = tower.x - gate.x;
      const dy = tower.y - gate.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > sunlightRadius) {
        return;
      }
      if (!isInViewport({ x: tower.x, y: tower.y }, viewportBounds, towerBodyRadius * 8)) {
        return;
      }

      // Unit vector from gate to tower (shadow direction)
      const invDist = dist > 0 ? 1 / dist : 0;
      const ux = dx * invDist;
      const uy = dy * invDist;

      // Perpendicular direction to the gate-tower axis
      const px = -uy;
      const py = ux;

      // Near edge: two points on opposite sides of the tower body
      const v1 = { x: tower.x + px * towerBodyRadius, y: tower.y + py * towerBodyRadius };
      const v2 = { x: tower.x - px * towerBodyRadius, y: tower.y - py * towerBodyRadius };

      // Shadow length scales with distance: closer towers cast shorter shadows
      const shadowLength = towerBodyRadius * SHADOW_LENGTH_FACTOR * (dist / sunlightRadius);
      const s1 = { x: v1.x + ux * shadowLength, y: v1.y + uy * shadowLength };
      const s2 = { x: v2.x + ux * shadowLength, y: v2.y + uy * shadowLength };

      fillSoftShadowQuad(ctx, v1, v2, s2, s1, TOWER_SHADOW_NEAR_ALPHA);
    });
  }

  // ── Enemy shadows ──────────────────────────────────────────────────────────
  const enemies = this.enemies;
  if (Array.isArray(enemies)) {
    enemies.forEach((enemy) => {
      if (!enemy || enemy.hp <= 0) {
        return;
      }
      const enemyPos = this.getEnemyPosition ? this.getEnemyPosition(enemy) : null;
      if (!enemyPos || !Number.isFinite(enemyPos.x) || !Number.isFinite(enemyPos.y)) {
        return;
      }

      const dx = enemyPos.x - gate.x;
      const dy = enemyPos.y - gate.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > sunlightRadius) {
        return;
      }
      if (!isInViewport(enemyPos, viewportBounds, 60)) {
        return;
      }

      const metrics = this.getEnemyVisualMetrics ? this.getEnemyVisualMetrics(enemy) : null;
      // Enemy shadows should cast from a small circle regardless of shell size.
      const visualCoreRadius = metrics?.coreRadius ?? 9;
      const coreRadius = Math.max(
        ENEMY_SHADOW_RADIUS_MIN,
        Math.min(ENEMY_SHADOW_RADIUS_MAX, visualCoreRadius * ENEMY_SHADOW_RADIUS_FACTOR),
      );

      const invDist = dist > 0 ? 1 / dist : 0;
      const ux = dx * invDist;
      const uy = dy * invDist;
      const px = -uy;
      const py = ux;

      const v1 = { x: enemyPos.x + px * coreRadius, y: enemyPos.y + py * coreRadius };
      const v2 = { x: enemyPos.x - px * coreRadius, y: enemyPos.y - py * coreRadius };

      const shadowLength = coreRadius * SHADOW_LENGTH_FACTOR * (dist / sunlightRadius);
      const s1 = { x: v1.x + ux * shadowLength, y: v1.y + uy * shadowLength };
      const s2 = { x: v2.x + ux * shadowLength, y: v2.y + uy * shadowLength };

      fillSoftShadowQuad(ctx, v1, v2, s2, s1, ENEMY_SHADOW_NEAR_ALPHA);
    });
  }

  // ── Mote gem circle shadows ────────────────────────────────────────────────
  const gemUnit = Math.max(6, (this._frameCache?.minDimension || 1) * GEM_UNIT_SCALE_FACTOR);
  if (Array.isArray(moteGemState.active)) {
    moteGemState.active.forEach((gem) => {
      if (!gem || !Number.isFinite(gem.x) || !Number.isFinite(gem.y)) {
        return;
      }

      const dx = gem.x - gate.x;
      const dy = gem.y - gate.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > sunlightRadius) {
        return;
      }
      if (!isInViewport({ x: gem.x, y: gem.y }, viewportBounds, 30)) {
        return;
      }

      // Resolve gem radius from its moteSize property, mirroring drawMoteGems
      const moteSize = Math.max(1, Number.isFinite(gem.moteSize) ? gem.moteSize : gem.value);
      const gemRadius = Math.max(MIN_GEM_RADIUS, moteSize * gemUnit * GEM_RADIUS_SCALE);

      // Offset the shadow circle away from the gate
      const invDist = dist > 0 ? 1 / dist : 0;
      const offsetX = dx * invDist * gemRadius * GEM_SHADOW_OFFSET_FACTOR;
      const offsetY = dy * invDist * gemRadius * GEM_SHADOW_OFFSET_FACTOR;

      ctx.beginPath();
      ctx.fillStyle = `rgba(${SHADOW_COLOR_R},${SHADOW_COLOR_G},${SHADOW_COLOR_B},${GEM_SHADOW_ALPHA})`;
      ctx.arc(gem.x + offsetX, gem.y + offsetY, gemRadius * GEM_SHADOW_RADIUS_FACTOR, 0, TWO_PI);
      ctx.fill();
    });
  }

  ctx.restore();
}

/**
 * Draw a warm golden shine arc on the gate-facing edge of each tower.
 *
 * Called after `drawTowers()` so the shine arc overlays the tower body sprite.
 */
export function drawTowerSunShine() {
  if (!this.ctx) {
    return;
  }
  if (this.isLowGraphicsMode?.() || this._zoomingActive) {
    return;
  }

  const gate = resolveMindGatePosition.call(this);
  if (!gate) {
    return;
  }

  const sunlightRadius = resolveSunlightRadius.call(this);
  const ctx = this.ctx;
  const viewportBounds = this._frameCache?.viewportBounds || getViewportBounds.call(this);
  const towerBodyRadius = resolveTowerBodyRadius.call(this);

  if (!Array.isArray(this.towers) || !this.towers.length) {
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  this.towers.forEach((tower) => {
    if (!tower || !Number.isFinite(tower.x) || !Number.isFinite(tower.y)) {
      return;
    }

    const dx = tower.x - gate.x;
    const dy = tower.y - gate.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > sunlightRadius) {
      return;
    }
    if (!isInViewport({ x: tower.x, y: tower.y }, viewportBounds, towerBodyRadius * 2)) {
      return;
    }

    // Intensity inversely proportional to distance
    const intensity = 1 - dist / sunlightRadius;
    if (intensity <= 0) {
      return;
    }

    // Angle FROM the tower TO the gate (gate-facing direction)
    const toGateAngle = Math.atan2(-dy, -dx);

    // Arc center radius sits just inside the tower body for a crescent feel
    const shineRadius = towerBodyRadius * SHINE_RADIUS_FACTOR;

    ctx.beginPath();
    ctx.strokeStyle = `rgba(255, 228, 150, ${intensity * SHINE_ALPHA_FACTOR})`;
    ctx.lineWidth = Math.max(1.5, towerBodyRadius * SHINE_LINE_WIDTH_FACTOR * intensity);
    ctx.arc(
      tower.x,
      tower.y,
      shineRadius,
      toGateAngle - SHINE_ARC_HALF_ANGLE,
      toGateAngle + SHINE_ARC_HALF_ANGLE,
    );
    ctx.stroke();
  });

  ctx.restore();
}


