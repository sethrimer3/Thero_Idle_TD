/**
 * Projectile Renderer
 *
 * Handles all projectile and burst-effect rendering for the playfield:
 * - Standard beam projectiles (source-to-target gradient lines)
 * - Supply seed clusters (alpha/beta coloured motes)
 * - Omega wave expanding radial blasts
 * - Eta continuous laser beams
 * - Iota expanding pulse rings
 * - Epsilon needle projectiles (sprite with palette tint)
 * - Gamma star piercing beams
 * - Post-projectile burst effects delegated to individual tower renderers:
 *   Alpha bursts, Beta bursts, Gamma bursts, Gamma-star bursts,
 *   Nu bursts, Omega particles
 *
 * All exported functions are designed to be called with `.call(renderer)` where
 * `renderer` is the CanvasRenderer / SimplePlayfield instance, matching the
 * established calling convention in CanvasRenderer.js.
 *
 * Extracted from CanvasRenderer.js as part of Phase 2.2.3 of the Monolithic
 * Refactoring Plan (Build 488).
 */

import { samplePaletteGradient } from '../../../colorSchemeUtils.js';
import { colorToRgbaString } from '../../../../scripts/features/towers/powderTower.js';
import { normalizeProjectileColor } from '../../utils/rendering.js';
import {
  drawAlphaBursts as drawAlphaBurstsHelper,
} from '../../../../scripts/features/towers/alphaTower.js';
import { drawBetaBursts as drawBetaBurstsHelper } from '../../../../scripts/features/towers/betaTower.js';
import { drawGammaBursts as drawGammaBurstsHelper } from '../../../../scripts/features/towers/gammaTower.js';
import { drawNuBursts as drawNuBurstsHelper } from '../../../../scripts/features/towers/nuTower.js';
import { drawOmegaParticles as drawOmegaParticlesHelper } from '../../../../scripts/features/towers/omegaTower.js';

// Pre-calculated constants for performance in tight render loops
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const HALF = 0.5;

// Viewport culling margin: buffer zone beyond visible area to prevent pop-in
const VIEWPORT_CULL_MARGIN = 100;

// Projectile culling radii: larger patterns need a bigger margin to avoid premature clipping
const PROJECTILE_CULL_RADIUS_DEFAULT = 50;
const PROJECTILE_CULL_RADIUS_IOTA_PULSE = 150;
const PROJECTILE_CULL_RADIUS_OMEGA_WAVE = 200;
const PROJECTILE_CULL_RADIUS_ETA_LASER = 300;

// Epsilon needle sprite provides the projectile silhouette that we tint with the active palette.
// Note: Epsilon needle sprite is oriented with the needle pointing upward (base orientation).
// During flight, the sprite rotates to point in the direction of travel.
const EPSILON_NEEDLE_SPRITE_URL = 'assets/sprites/towers/epsilon/projectiles/epsilonProjectile.png';
const epsilonNeedleSprite = new Image();
epsilonNeedleSprite.src = EPSILON_NEEDLE_SPRITE_URL;
epsilonNeedleSprite.decoding = 'async';
epsilonNeedleSprite.loading = 'eager';
// Cached, palette-tinted variants along the gradient to keep rendering lightweight.
const epsilonNeedleSpriteCache = new Map();
// Gradient stops ensure epsilon needles cycle through the player's palette.
const EPSILON_NEEDLE_GRADIENT_STOPS = [0.12, 0.38, 0.62, 0.88];

// ─── Local utility helpers ────────────────────────────────────────────────────

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

/**
 * Calculate the visible viewport bounds in world coordinates.
 * Returns an object with min/max x/y coordinates for culling.
 * Uses cached values when available to reduce redundant calculations.
 */
function getViewportBounds() {
  // Use cached value if available from current frame
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

  // Calculate world-space bounds with margin
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
 * @param {Object} position - Object with x, y coordinates
 * @param {Object} bounds - Viewport bounds from getViewportBounds
 * @param {number} radius - Optional radius for circular objects
 * @returns {boolean} True if visible (or if bounds unavailable)
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
 * Produce a palette-tinted OffscreenCanvas/HTMLCanvasElement for the epsilon
 * needle sprite at the closest gradient stop to `paletteRatio`.
 * Returns null when the base sprite is not yet decoded.
 */
function resolveEpsilonNeedleSprite(paletteRatio = 0.5) {
  // Bail out when the base sprite is not ready or when we lack a canvas context.
  if (!epsilonNeedleSprite?.complete || epsilonNeedleSprite.naturalWidth <= 0) {
    return null;
  }
  const ratio = clamp(paletteRatio, 0, 1);
  let closestStop = EPSILON_NEEDLE_GRADIENT_STOPS[0];
  let closestIndex = 0;
  let closestDistance = Infinity;
  EPSILON_NEEDLE_GRADIENT_STOPS.forEach((stop, index) => {
    const distance = Math.abs(stop - ratio);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestStop = stop;
      closestIndex = index;
    }
  });
  const paletteColor = samplePaletteGradient(closestStop) || { r: 139, g: 247, b: 255 };
  const colorKey = `${paletteColor.r},${paletteColor.g},${paletteColor.b}`;
  const cacheKey = `${closestIndex}:${colorKey}`;
  if (epsilonNeedleSpriteCache.has(cacheKey)) {
    return epsilonNeedleSpriteCache.get(cacheKey);
  }
  // Create a tinted canvas sprite that preserves the epsilon needle silhouette.
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(epsilonNeedleSprite.width, epsilonNeedleSprite.height)
      : typeof document !== 'undefined'
      ? document.createElement('canvas')
      : null;
  if (!canvas) {
    return null;
  }
  canvas.width = epsilonNeedleSprite.width;
  canvas.height = epsilonNeedleSprite.height;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(epsilonNeedleSprite, 0, 0);
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = `rgb(${paletteColor.r}, ${paletteColor.g}, ${paletteColor.b})`;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'source-over';
  epsilonNeedleSpriteCache.set(cacheKey, canvas);
  return canvas;
}

// Lazily construct a per-frame enemy lookup map so projectile targeting avoids repeated scans.
function getEnemyLookupMap() {
  if (!this._frameCache) {
    this._frameCache = {};
  }
  if (this._frameCache.enemyById) {
    return this._frameCache.enemyById;
  }
  if (!Array.isArray(this.enemies) || !this.enemies.length) {
    return null;
  }
  const enemyById = new Map();
  this.enemies.forEach((enemy) => {
    if (enemy?.id !== undefined) {
      enemyById.set(enemy.id, enemy);
    }
  });
  this._frameCache.enemyById = enemyById;
  return enemyById;
}

// ─── Exported render functions ────────────────────────────────────────────────

/**
 * Render all active projectiles for the current frame.
 * Handles supply seeds, omega waves, eta lasers, iota pulses, epsilon needles,
 * gamma star beams, and standard beam projectiles.
 * After drawing projectiles, delegates burst/particle effects to tower modules.
 */
export function drawProjectiles() {
  if (!this.ctx) {
    return;
  }

  const ctx = this.ctx;
  // Use cached viewport bounds to reduce redundant calculations
  const viewportBounds = this._frameCache?.viewportBounds || getViewportBounds.call(this);

  if (this.projectiles.length) {
    ctx.save();
  }

  this.projectiles.forEach((projectile) => {
    if (!projectile) {
      return;
    }

    // Get projectile position for culling check
    const projectilePosition = projectile.currentPosition || projectile.position || projectile.origin || projectile.source;

    // Skip rendering projectiles outside viewport (with generous margin for special effects)
    if (viewportBounds && projectilePosition) {
      // Use larger radius for special projectile types that may extend beyond their origin
      const cullRadius = projectile.patternType === 'etaLaser' ? PROJECTILE_CULL_RADIUS_ETA_LASER :
                        projectile.patternType === 'omegaWave' ? PROJECTILE_CULL_RADIUS_OMEGA_WAVE :
                        projectile.patternType === 'iotaPulse' ? PROJECTILE_CULL_RADIUS_IOTA_PULSE :
                        PROJECTILE_CULL_RADIUS_DEFAULT;

      if (!isInViewport(projectilePosition, viewportBounds, cullRadius)) {
        return;
      }
    }

    if (projectile.patternType === 'supply') {
      const position = projectile.currentPosition || projectile.target || projectile.source;
      if (!position) {
        return;
      }
      const seeds = Array.isArray(projectile.seeds) ? projectile.seeds : [];
      if (seeds.length) {
        seeds.forEach((seed) => {
          if (!seed || !seed.position) {
            return;
          }
          const baseColor = seed.type === 'beta'
            ? { r: 255, g: 214, b: 112 }
            : { r: 255, g: 138, b: 216 };
          const glowColor = normalizeProjectileColor(baseColor, 1);
          const size = Number.isFinite(seed.size) ? seed.size : 2.2;
          ctx.fillStyle = colorToRgbaString(glowColor, 0.85);
          ctx.beginPath();
          ctx.arc(seed.position.x, seed.position.y, size, 0, TWO_PI);
          ctx.fill();
        });
      } else {
        const color = normalizeProjectileColor(projectile.color, 1);
        ctx.fillStyle = colorToRgbaString(color, 0.85);
        ctx.beginPath();
        ctx.arc(position.x, position.y, 4, 0, TWO_PI);
        ctx.fill();
      }
      return;
    }

    if (projectile.patternType === 'omegaWave') {
      const position = projectile.position || projectile.origin;
      if (!position) {
        return;
      }

      const radius = Number.isFinite(projectile.parameters?.radius)
        ? projectile.parameters.radius
        : 40;
      const gradient = ctx.createRadialGradient(position.x, position.y, 0, position.x, position.y, radius);
      gradient.addColorStop(0, 'rgba(255, 228, 120, 0.8)');
      gradient.addColorStop(1, 'rgba(255, 228, 120, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(position.x, position.y, radius, 0, TWO_PI);
      ctx.fill();
      return;
    }

    if (projectile.patternType === 'etaLaser') {
      const origin = projectile.origin;
      if (!origin) {
        return;
      }
      const angle = Number.isFinite(projectile.angle) ? projectile.angle : 0;
      const length = Number.isFinite(projectile.length) ? projectile.length : 0;
      if (length <= 0) {
        return;
      }
      const width = Math.max(2, Number.isFinite(projectile.width) ? projectile.width : 8);
      const alpha = Number.isFinite(projectile.alpha) ? Math.max(0, Math.min(1, projectile.alpha)) : 1;
      ctx.save();
      ctx.translate(origin.x, origin.y);
      ctx.rotate(angle);
      const beamColor = normalizeProjectileColor(projectile.color, 1);
      const gradient = ctx.createLinearGradient(0, 0, length, 0);
      gradient.addColorStop(0, colorToRgbaString(beamColor, alpha));
      gradient.addColorStop(0.6, colorToRgbaString(beamColor, alpha * 0.6));
      gradient.addColorStop(1, colorToRgbaString(beamColor, 0));
      ctx.strokeStyle = gradient;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(length, 0);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (projectile.patternType === 'iotaPulse') {
      const origin = projectile.origin;
      if (!origin) {
        return;
      }
      const maxLifetime = Number.isFinite(projectile.maxLifetime) ? projectile.maxLifetime : 0.32;
      const progress = Math.max(0, Math.min(1, projectile.lifetime / maxLifetime));
      const baseRadius = Number.isFinite(projectile.radius) ? projectile.radius : 60;
      const currentRadius = baseRadius * (0.4 + 0.6 * progress);
      const color = normalizeProjectileColor(projectile.color || { r: 180, g: 240, b: 255 }, 1);
      const alpha = Math.max(0, 0.55 * (1 - progress));
      ctx.save();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = colorToRgbaString(color, alpha);
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, currentRadius, 0, TWO_PI);
      ctx.stroke();
      ctx.restore();
      return;
    }

    if (projectile.patternType === 'epsilonNeedle') {
      const position = projectile.position || projectile.origin;
      if (!position) {
        return;
      }
      const prev = projectile.previousPosition || position;
      const heading = Math.atan2((position.y - prev.y) || 0.0001, (position.x - prev.x) || 0.0001);
      const length = 10;
      const width = 1.2;
      // Fade embedded thorns by honoring the projectile alpha computed in the simulation.
      const alpha = Number.isFinite(projectile.alpha) ? Math.max(0, Math.min(1, projectile.alpha)) : 1;
      // Prefer palette-tinted sprite needles when available, otherwise draw the vector fallback.
      const paletteRatio = Number.isFinite(projectile.paletteRatio) ? projectile.paletteRatio : 0.5;
      const tintedSprite = resolveEpsilonNeedleSprite(paletteRatio);
      ctx.save();
      ctx.translate(position.x, position.y);
      // Rotate the sprite to point in the direction of travel
      // Since sprite is oriented upward, add π/2 to align with heading
      ctx.rotate(heading + HALF_PI);
      ctx.globalAlpha = alpha;
      if (tintedSprite) {
        // Scale the needle sprite to roughly match the legacy vector length.
        const reference = Math.max(1, Math.max(tintedSprite.width || 1, tintedSprite.height || 1));
        const targetLength = length * 2.1;
        const scale = targetLength / reference;
        const spriteWidth = (tintedSprite.width || reference) * scale;
        const spriteHeight = (tintedSprite.height || reference) * scale;
        // Draw sprite rotated to match trajectory
        ctx.drawImage(tintedSprite, -spriteWidth * 0.5, -spriteHeight * 0.5, spriteWidth, spriteHeight);
      } else {
        // Fallback vector needle (already rotated by the ctx.rotate above)
        // Adjust rotation to point along x-axis before ctx.rotate applied the heading
        ctx.rotate(-HALF_PI);
        ctx.fillStyle = `rgba(139, 247, 255, ${0.85 * alpha})`;
        ctx.strokeStyle = `rgba(12, 16, 26, ${0.9 * alpha})`;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(length, 0);
        ctx.lineTo(-length * 0.6, width);
        ctx.lineTo(-length * 0.6, -width);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    // Render gamma star piercing beam projectile
    if (projectile.patternType === 'gammaStar') {
      const position = projectile.position || projectile.origin;
      const previousPosition = projectile.previousPosition || projectile.origin;
      if (!position || !previousPosition) {
        return;
      }

      // Draw the piercing beam from previous to current position
      const beamColor = samplePaletteGradient(0.66) || { r: 120, g: 219, b: 255 };
      const gradient = ctx.createLinearGradient(previousPosition.x, previousPosition.y, position.x, position.y);
      gradient.addColorStop(0, colorToRgbaString(beamColor, 0.5));
      gradient.addColorStop(1, colorToRgbaString(beamColor, 0.95));

      ctx.save();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 8;
      ctx.shadowColor = colorToRgbaString(beamColor, 0.6);
      ctx.beginPath();
      ctx.moveTo(previousPosition.x, previousPosition.y);
      ctx.lineTo(position.x, position.y);
      ctx.stroke();

      // Draw a glow at the current position
      ctx.fillStyle = colorToRgbaString(beamColor, 0.8);
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(position.x, position.y, 5, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
      return;
    }

    const source = projectile.source;
    const targetPosition = projectile.target
      ? projectile.target
      : projectile.targetId
      ? (() => {
          // Cache enemy lookups to avoid repeated find operations
          if (!this._frameCache?.enemyPositionCache) {
            if (!this._frameCache) {
              this._frameCache = {};
            }
            this._frameCache.enemyPositionCache = new Map();
          }
          let pos = this._frameCache.enemyPositionCache.get(projectile.targetId);
          if (!pos) {
            // Prefer the per-frame lookup map so target resolution stays O(1) per projectile.
            // Lazily build the lookup map so frames without target-based projectiles avoid extra work.
            const enemyLookup = getEnemyLookupMap.call(this);
            const enemy = enemyLookup
              ? enemyLookup.get(projectile.targetId)
              : this.enemies.find((candidate) => candidate.id === projectile.targetId);
            pos = enemy ? this.getEnemyPosition(enemy) : null;
            if (pos) {
              this._frameCache.enemyPositionCache.set(projectile.targetId, pos);
            }
          }
          return pos;
        })()
      : projectile.targetCrystalId
      ? (() => {
          const crystal = this.developerCrystals.find((entry) => entry?.id === projectile.targetCrystalId);
          return crystal ? this.getCrystalPosition(crystal) : null;
        })()
      : null;

    if (!source || !targetPosition) {
      return;
    }

    const beamStart = normalizeProjectileColor(projectile.color, 0);
    const beamEnd = normalizeProjectileColor(projectile.color, 1);
    const beamGradient = ctx.createLinearGradient(source.x, source.y, targetPosition.x, targetPosition.y);
    beamGradient.addColorStop(0, colorToRgbaString(beamStart, 0.72));
    beamGradient.addColorStop(1, colorToRgbaString(beamEnd, 0.78));
    ctx.strokeStyle = beamGradient;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(targetPosition.x, targetPosition.y);
    ctx.stroke();

    ctx.fillStyle = colorToRgbaString(beamEnd, 0.9);
    ctx.beginPath();
    ctx.arc(targetPosition.x, targetPosition.y, 4, 0, TWO_PI);
    ctx.fill();
  });

  if (this.projectiles.length) {
    ctx.restore();
  }

  this.drawBetaBursts();
  this.drawAlphaBursts();
  this.drawGammaBursts();
  this.drawGammaStarBursts();
  this.drawNuBursts();
  this.drawOmegaParticles();
}

export function drawAlphaBursts() {
  drawAlphaBurstsHelper(this);
}

export function drawBetaBursts() {
  drawBetaBurstsHelper(this);
}

export function drawGammaBursts() {
  drawGammaBurstsHelper(this);
}

/**
 * Render star burst effects on enemies hit by gamma projectiles.
 */
export function drawGammaStarBursts() {
  const ctx = this.ctx;
  if (!ctx || !Array.isArray(this.gammaStarBursts) || this.gammaStarBursts.length === 0) {
    return;
  }

  // Use gamma particle color
  const color = samplePaletteGradient(0.66) || { r: 120, g: 219, b: 255 };
  const rgbaStr = `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, 0.9)`;

  ctx.save();
  ctx.strokeStyle = rgbaStr;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const GAMMA_STAR_SEQUENCE = [0, 2, 4, 1, 3, 0];

  this.gammaStarBursts.forEach((burst) => {
    if (!burst || !burst.center) {
      return;
    }

    const radius = burst.starRadius || 22;
    const center = burst.center;

    // Calculate pentagram star points
    const angles = [];
    for (let step = 0; step < 5; step += 1) {
      angles.push(-HALF_PI + (step * TWO_PI) / 5);
    }
    const starPoints = angles.map((angle) => ({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    }));

    // Draw the current edge being traced
    const edgeIndex = Number.isFinite(burst.starEdgeIndex) ? burst.starEdgeIndex : 0;
    if (edgeIndex < GAMMA_STAR_SEQUENCE.length - 1) {
      const fromIndex = GAMMA_STAR_SEQUENCE[edgeIndex];
      const toIndex = GAMMA_STAR_SEQUENCE[edgeIndex + 1];
      const fromPoint = starPoints[fromIndex];
      const toPoint = starPoints[toIndex];

      if (fromPoint && toPoint && burst.currentPosition) {
        // Draw completed edges with fading opacity
        const fadePerEdge = 0.15;
        for (let i = 0; i < edgeIndex; i++) {
          const fi = GAMMA_STAR_SEQUENCE[i];
          const ti = GAMMA_STAR_SEQUENCE[i + 1];
          const fp = starPoints[fi];
          const tp = starPoints[ti];
          if (fp && tp) {
            const opacity = Math.max(0.2, 0.9 - (edgeIndex - i) * fadePerEdge);
            ctx.strokeStyle = `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${opacity})`;
            ctx.beginPath();
            ctx.moveTo(fp.x, fp.y);
            ctx.lineTo(tp.x, tp.y);
            ctx.stroke();
          }
        }

        // Draw current edge from start to current position
        ctx.strokeStyle = rgbaStr;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(fromPoint.x, fromPoint.y);
        ctx.lineTo(burst.currentPosition.x, burst.currentPosition.y);
        ctx.stroke();

        // Draw a glow at current position
        ctx.fillStyle = `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, 0.7)`;
        ctx.beginPath();
        ctx.arc(burst.currentPosition.x, burst.currentPosition.y, 4, 0, TWO_PI);
        ctx.fill();
      }
    }
  });

  ctx.restore();
}

export function drawNuBursts() {
  drawNuBurstsHelper(this);
}

export function drawOmegaParticles() {
  drawOmegaParticlesHelper(this);
}
