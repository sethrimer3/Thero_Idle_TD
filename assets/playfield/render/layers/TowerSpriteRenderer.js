/**
 * Tower Sprite Renderer
 *
 * Handles all tower body and glyph rendering for the playfield:
 * - Tower body circles (fill + stroke + shadow)
 * - Tower glyph symbols (text rendering)
 * - Glyph promotion/demotion transition animations
 * - Tower placement preview (hover ghost + range ring)
 * - Tower connection particle effects (beta/gamma orbit motes)
 * - Per-tower type extensions (Zeta pendulums, Eta orbits, Delta soldiers, Omicron units)
 *
 * All exported functions are designed to be called with `.call(renderer)` where
 * `renderer` is the CanvasRenderer / SimplePlayfield instance, matching the
 * established calling convention in CanvasRenderer.js.
 *
 * Extracted from CanvasRenderer.js as part of Phase 2.2.2 of the Monolithic
 * Refactoring Plan (Build 487).
 */

import { ALPHA_BASE_RADIUS_FACTOR } from '../../../gameUnits.js';
import { getTowerVisualConfig } from '../../../colorSchemeUtils.js';
import { getTowerDefinition } from '../../../towersTab.js';
import { colorToRgbaString } from '../../../../scripts/features/towers/powderTower.js';
import { normalizeProjectileColor, drawConnectionMoteGlow } from '../../utils/rendering.js';
import { drawZetaPendulums as drawZetaPendulumsHelper } from '../../../../scripts/features/towers/zetaTower.js';
import { drawEtaOrbits as drawEtaOrbitsHelper } from '../../../../scripts/features/towers/etaTower.js';
import { drawDeltaSoldiers as drawDeltaSoldiersHelper } from '../../../../scripts/features/towers/deltaTower.js';
import { drawOmicronUnits as drawOmicronUnitsHelper } from '../../../../scripts/features/towers/omicronTower.js';
import { drawKappaTripwires as drawKappaTripwiresHelper } from '../../../../scripts/features/towers/kappaTower.js';
import { drawLambdaLasers as drawLambdaLasersHelper } from '../../../../scripts/features/towers/lambdaTower.js';
import { drawMuMines as drawMuMinesHelper } from '../../../../scripts/features/towers/muTower.js';
import {
  drawNuKillParticles as drawNuKillParticlesHelper,
} from '../../../../scripts/features/towers/nuTower.js';
import { drawXiBalls as drawXiBallsHelper } from '../../../../scripts/features/towers/xiTower.js';
import { drawThetaContours as drawThetaContoursHelper } from '../../../../scripts/features/towers/thetaTower.js';
import {
  drawPiLockOnLines as drawPiLockOnLinesHelper,
  drawPiFrozenLines as drawPiFrozenLinesHelper,
  drawPiRadialLaser as drawPiRadialLaserHelper,
} from '../../../../scripts/features/towers/piTower.js';
import { drawTauProjectiles as drawTauProjectilesHelper } from '../../../../scripts/features/towers/tauTower.js';
import { drawUpsilonFleet as drawUpsilonFleetHelper } from '../../../../scripts/features/towers/upsilonTower.js';
import { drawPhiTower as drawPhiTowerHelper } from '../../../../scripts/features/towers/phiTower.js';

// Pre-calculated constants used across tower rendering functions
const TWO_PI = Math.PI * 2;
const PI = Math.PI;

// Direction vectors for glyph promotion/demotion particle animations.
const GLYPH_DEFAULT_PROMOTION_VECTOR = { x: 0, y: -1 };
const GLYPH_DEFAULT_DEMOTION_VECTOR = { x: 0, y: 1 };
// Base RGB colours for the glyph promotion (cyan) and demotion (amber) flashes.
const PROMOTION_GLYPH_COLOR = { r: 139, g: 247, b: 255 };
const DEMOTION_GLYPH_COLOR = { r: 255, g: 196, b: 150 };
// Duration of the initial ramp-up phase for glyph flash effects (milliseconds).
const GLYPH_FLASH_RAMP_MS = 120;

// ─── Utility helpers ──────────────────────────────────────────────────────────

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

function smoothstep(value) {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function getNowTimestamp() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

// ─── Tower Connection Particles ───────────────────────────────────────────────

export function drawTowerConnectionParticles(ctx, tower, bodyRadius) {
  if (!ctx || !tower) {
    return;
  }
  const particles = Array.isArray(tower.connectionParticles) ? tower.connectionParticles : [];
  if (!particles.length) {
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  particles.forEach((particle) => {
    if (!particle || particle.state === 'done') {
      return;
    }
    const baseColor = particle.type === 'beta'
      ? { r: 255, g: 214, b: 112 }
      : { r: 255, g: 138, b: 216 };
    const color = normalizeProjectileColor(baseColor, 1);
    const size = particle.size || 2.6;
    let position = null;
    if (particle.state === 'launch' || particle.state === 'arrive') {
      position = particle.position || this.resolveConnectionOrbitAnchor(tower, particle);
    } else {
      position = this.resolveConnectionOrbitPosition(tower, particle, bodyRadius);
    }
    if (!position) {
      return;
    }
    drawConnectionMoteGlow(
      ctx,
      position.x,
      position.y,
      size,
      color,
      particle.state === 'launch' ? 0.9 : 0.85,
    );
  });
  ctx.restore();
}

// ─── Tower Connection Effects ─────────────────────────────────────────────────

export function drawConnectionEffects(ctx) {
  if (!ctx || !Array.isArray(this.connectionEffects) || !this.connectionEffects.length) {
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  this.connectionEffects.forEach((effect) => {
    const source = effect.source || this.getTowerById(effect.sourceId);
    const target = effect.target || this.getTowerById(effect.targetId);
    if (!source || !target) {
      return;
    }
    const baseColor = source.type === 'beta'
      ? { r: 255, g: 214, b: 112 }
      : { r: 255, g: 138, b: 216 };
    const color = normalizeProjectileColor(baseColor, 1);
    effect.particles.forEach((particle) => {
      const progress = Math.max(0, Math.min(1, particle.progress || 0));
      const x = source.x + (target.x - source.x) * progress;
      const y = source.y + (target.y - source.y) * progress;
      drawConnectionMoteGlow(ctx, x, y, 3.2, color, 0.7);
    });
  });
  ctx.restore();
}

// ─── Tower Press Glow ─────────────────────────────────────────────────────────

export function drawTowerPressGlow(playfield, tower, bodyRadius, intensity, visuals, glyph) {
  const ctx = playfield?.ctx;
  if (!ctx || !tower || !Number.isFinite(bodyRadius) || !intensity) {
    return;
  }
  const clamped = Math.max(0, Math.min(1, intensity));
  if (clamped <= 0) {
    return;
  }
  const ringColor = visuals.outerStroke || 'rgba(139, 247, 255, 0.85)';
  const ringRadius = bodyRadius + 6 + clamped * 6;
  ctx.save();
  ctx.globalAlpha = 0.35 + clamped * 0.45;
  playfield.applyCanvasShadow(ctx, ringColor, 16 + clamped * 18);
  ctx.lineWidth = 2.6 + clamped * 2.8;
  ctx.strokeStyle = ringColor;
  ctx.beginPath();
  ctx.arc(tower.x, tower.y, ringRadius, 0, TWO_PI);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  const symbolColor = visuals.symbolFill || ringColor;
  ctx.globalAlpha = 0.4 + clamped * 0.5;
  playfield.applyCanvasShadow(ctx, symbolColor, 18 + clamped * 16);
  ctx.font = `${Math.round(bodyRadius * 1.4)}px "Cormorant Garamond", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = symbolColor;
  ctx.fillText(glyph || '?', tower.x, tower.y);
  ctx.restore();
}

// ─── Placement Preview ────────────────────────────────────────────────────────

export function drawPlacementPreview() {
  if (!this.ctx || !this.hoverPlacement || !this.hoverPlacement.position) {
    return;
  }

  const ctx = this.ctx;
  const {
    position,
    range,
    valid,
    merge,
    mergeTarget,
    symbol,
    reason,
    dragging,
    towerType,
    definition,
    tier,
    connections,
  } = this.hoverPlacement;

  ctx.save();

  const radius = Number.isFinite(range) && range > 0
    ? range
    : Math.min(this.renderWidth, this.renderHeight) * 0.18;
  const fillColor = valid ? 'rgba(139, 247, 255, 0.12)' : 'rgba(255, 112, 112, 0.16)';
  const strokeColor = valid ? 'rgba(139, 247, 255, 0.85)' : 'rgba(255, 96, 96, 0.9)';

  ctx.beginPath();
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = valid ? 2 : 3;
  ctx.arc(position.x, position.y, Math.max(12, radius), 0, TWO_PI);
  ctx.fill();
  ctx.stroke();

  // Visualize valid κ tripwire links so players can see pending connections.
  const connectionPreviews = Array.isArray(connections) ? connections : [];
  if (connectionPreviews.length) {
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2.2;
    connectionPreviews.forEach((connection) => {
      const baseStroke = connection.kappaPair
        ? 'rgba(255, 228, 120, 0.85)'
        : 'rgba(139, 247, 255, 0.85)';
      ctx.strokeStyle = valid ? baseStroke : 'rgba(255, 112, 112, 0.75)';
      ctx.beginPath();
      ctx.moveTo(connection.from.x, connection.from.y);
      ctx.lineTo(connection.to.x, connection.to.y);
      ctx.stroke();
    });
    ctx.restore();
  }

  if (merge && mergeTarget) {
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 236, 128, 0.85)';
    ctx.beginPath();
    ctx.arc(mergeTarget.x, mergeTarget.y, Math.max(16, (radius || 24) * 0.6), 0, TWO_PI);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const previewDefinition = definition || getTowerDefinition(towerType);
  const previewTower = {
    type: towerType,
    definition: previewDefinition || undefined,
    tier: Number.isFinite(tier) ? tier : previewDefinition?.tier,
    symbol,
  };
  const visuals = getTowerVisualConfig(previewTower) || {};
  const bodyRadius = Math.max(
    12,
    Math.min(this.renderWidth, this.renderHeight) * ALPHA_BASE_RADIUS_FACTOR,
  );
  const bodyStroke = valid
    ? visuals.outerStroke || 'rgba(139, 247, 255, 0.85)'
    : 'rgba(255, 96, 96, 0.85)';
  const bodyFill = valid
    ? visuals.innerFill || 'rgba(12, 16, 28, 0.9)'
    : 'rgba(60, 16, 16, 0.88)';
  const symbolFill = valid
    ? visuals.symbolFill || 'rgba(255, 228, 120, 0.85)'
    : 'rgba(255, 200, 200, 0.92)';

  ctx.save();
  if (valid && visuals.outerShadow?.color) {
    this.applyCanvasShadow(
      ctx,
      visuals.outerShadow.color,
      Number.isFinite(visuals.outerShadow.blur) ? visuals.outerShadow.blur : 18,
    );
  } else {
    this.clearCanvasShadow(ctx);
  }
  ctx.beginPath();
  ctx.fillStyle = bodyFill;
  ctx.strokeStyle = bodyStroke;
  ctx.lineWidth = valid ? 2.4 : 2.6;
  ctx.arc(position.x, position.y, bodyRadius, 0, TWO_PI);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  if (valid && visuals.symbolShadow?.color) {
    this.applyCanvasShadow(
      ctx,
      visuals.symbolShadow.color,
      Number.isFinite(visuals.symbolShadow.blur) ? visuals.symbolShadow.blur : 18,
    );
  } else {
    this.clearCanvasShadow(ctx);
  }
  const glyph = symbol || '?';
  ctx.font = `${Math.round(bodyRadius * 1.4)}px "Cormorant Garamond", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = symbolFill;
  ctx.fillText(glyph, position.x, position.y);
  ctx.restore();

  if (dragging) {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(139, 247, 255, 0.4)';
    ctx.beginPath();
    const anchorRadius = Math.max(bodyRadius * 1.15, bodyRadius + 4, 16);
    ctx.arc(position.x, position.y, anchorRadius, 0, TWO_PI);
    ctx.stroke();
  }

  ctx.restore();

  if (this.messageEl && reason) {
    this.messageEl.textContent = reason;
  }
}

// ─── Glyph Transition Animation ───────────────────────────────────────────────

function drawTowerGlyphTransition(ctx, tower, bodyRadius, transition, visuals, glyph) {
  if (!ctx || !tower || !transition) {
    return;
  }
  const now = getNowTimestamp();
  const baseVector = transition.direction ||
    (transition.mode === 'demote' ? GLYPH_DEFAULT_DEMOTION_VECTOR : GLYPH_DEFAULT_PROMOTION_VECTOR);
  const length = Math.hypot(baseVector?.x || 0, baseVector?.y || 0) || 1;
  const direction = { x: (baseVector?.x || 0) / length, y: (baseVector?.y || 0) / length };
  const perpendicular = { x: -direction.y, y: direction.x };

  drawTowerGlyphResidue.call(this, ctx, tower, bodyRadius, transition, now, visuals);
  drawTowerGlyphParticles(ctx, tower, bodyRadius, transition, now, direction, perpendicular);
  drawTowerGlyphFlash(ctx, tower, bodyRadius, transition, now);
  drawTowerGlyphText.call(this, ctx, tower, bodyRadius, transition, now, visuals, glyph);
}

function drawTowerGlyphResidue(ctx, tower, bodyRadius, transition, now, visuals) {
  if (!transition?.fromSymbol || !Number.isFinite(transition.fromSymbolFade)) {
    return;
  }
  const fadeDuration = Math.max(1, transition.fromSymbolFade);
  const elapsed = now - (transition.startedAt || 0);
  if (elapsed >= fadeDuration) {
    return;
  }
  const alpha = Math.max(0, 1 - elapsed / fadeDuration);
  if (alpha <= 0) {
    return;
  }
  ctx.save();
  ctx.globalAlpha = alpha * 0.85;
  this.clearCanvasShadow(ctx);
  ctx.fillStyle = visuals.symbolFill || 'rgba(255, 228, 120, 0.92)';
  ctx.font = `${Math.round(bodyRadius * 1.4)}px "Cormorant Garamond", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(transition.fromSymbol, tower.x, tower.y);
  ctx.restore();
}

function drawTowerGlyphParticles(ctx, tower, bodyRadius, transition, now, direction, perpendicular) {
  const particles = Array.isArray(transition?.particles) ? transition.particles : [];
  if (!particles.length) {
    return;
  }
  particles.forEach((particle) => {
    if (!particle) {
      return;
    }
    const elapsed = now - (transition.startedAt || 0) - (particle.delay || 0);
    if (elapsed <= 0) {
      return;
    }
    const duration = Math.max(1, particle.duration || 0);
    const progress = clamp(elapsed / duration, 0, 1);
    if (progress <= 0 || progress > 1) {
      return;
    }
    const baseAlpha = Number.isFinite(particle.alpha) ? particle.alpha : 1;
    const alpha = Math.max(0, baseAlpha * (1 - progress));
    if (alpha <= 0.01) {
      return;
    }
    const distance = (particle.maxDistance || bodyRadius) * progress;
    const wobble = (particle.lateral || 0) * Math.sin(progress * PI);
    const x = tower.x + (particle.offsetX || 0) + direction.x * distance + perpendicular.x * wobble;
    const y = tower.y + (particle.offsetY || 0) + direction.y * distance + perpendicular.y * wobble;
    ctx.save();
    ctx.globalAlpha = alpha;
    const color = getGlyphParticleColor(transition.mode, particle.hueShift || 0);
    ctx.fillStyle = colorToRgbaString(color, 1);
    const size = Math.max(1.2, particle.size || bodyRadius * 0.08);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  });
}

function getGlyphParticleColor(mode, tint = 0) {
  const base = mode === 'demote' ? DEMOTION_GLYPH_COLOR : PROMOTION_GLYPH_COLOR;
  const mix = clamp(tint, 0, 1);
  const lift = 0.65 + mix * 0.35;
  return {
    r: Math.min(255, Math.round(base.r * lift + 30 * mix)),
    g: Math.min(255, Math.round(base.g * lift + (mode === 'demote' ? 20 : 35) * mix)),
    b: Math.min(255, Math.round(base.b * lift + (mode === 'demote' ? 5 : 45) * mix)),
  };
}

function drawTowerGlyphFlash(ctx, tower, bodyRadius, transition, now) {
  const fadeDuration = Math.max(0, transition?.flashDuration || 0);
  const hold = Math.max(0, transition?.flashHold || 0);
  if (!fadeDuration && !hold) {
    return;
  }
  const elapsed = now - (transition.startedAt || 0);
  const total = GLYPH_FLASH_RAMP_MS + hold + fadeDuration;
  if (elapsed >= total) {
    return;
  }
  let intensity = 0;
  if (elapsed <= GLYPH_FLASH_RAMP_MS) {
    intensity = smoothstep(elapsed / GLYPH_FLASH_RAMP_MS);
  } else if (elapsed <= GLYPH_FLASH_RAMP_MS + hold) {
    intensity = 1;
  } else {
    const fadeProgress = (elapsed - GLYPH_FLASH_RAMP_MS - hold) / Math.max(1, fadeDuration);
    intensity = Math.max(0, 1 - fadeProgress);
  }
  if (intensity <= 0) {
    return;
  }
  const baseColor = transition?.mode === 'demote' ? DEMOTION_GLYPH_COLOR : PROMOTION_GLYPH_COLOR;
  const strength = Math.min(1.1, (transition?.strengthRatio || 1) * 0.35 + 0.65);
  ctx.save();
  ctx.globalAlpha = Math.min(1, intensity * strength * 0.75);
  const radius = bodyRadius * (1.05 + intensity * 0.8);
  const gradient = ctx.createRadialGradient(
    tower.x,
    tower.y,
    radius * 0.25,
    tower.x,
    tower.y,
    radius,
  );
  gradient.addColorStop(0, colorToRgbaString(baseColor, 0.85));
  gradient.addColorStop(1, colorToRgbaString(baseColor, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(tower.x, tower.y, radius, 0, TWO_PI);
  ctx.fill();
  ctx.restore();
}

function drawTowerGlyphText(ctx, tower, bodyRadius, transition, now, visuals, glyph) {
  const delay = Math.max(0, transition?.newSymbolDelay || 0);
  const duration = Math.max(1, transition?.newSymbolFade || 1);
  const elapsed = now - (transition.startedAt || 0) - delay;
  if (elapsed <= 0) {
    return;
  }
  const progress = clamp(elapsed / duration, 0, 1);
  const eased = smoothstep(progress);
  if (eased <= 0) {
    return;
  }
  const symbolShadow = visuals.symbolShadow;
  if (symbolShadow?.color) {
    this.applyCanvasShadow(
      ctx,
      symbolShadow.color,
      Number.isFinite(symbolShadow.blur) ? symbolShadow.blur : 18,
    );
  } else {
    this.clearCanvasShadow(ctx);
  }
  ctx.save();
  ctx.globalAlpha = eased;
  ctx.fillStyle = visuals.symbolFill || 'rgba(255, 228, 120, 0.92)';
  ctx.font = `${Math.round(bodyRadius * 1.4)}px "Cormorant Garamond", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const symbol = transition?.toSymbol || glyph || tower.symbol || tower.definition?.symbol || '?';
  ctx.fillText(symbol, tower.x, tower.y);
  ctx.restore();
}

// ─── Main Tower Rendering ─────────────────────────────────────────────────────

export function drawTowers() {
  if (!this.ctx || !this.towers.length) {
    return;
  }

  const ctx = this.ctx;
  ctx.save();

  drawConnectionEffects.call(this, ctx);

  const activeDrag = this.connectionDragState.active ? this.connectionDragState : null;
  const highlightEntries = activeDrag && Array.isArray(activeDrag.highlightEntries)
    ? activeDrag.highlightEntries
    : [];
  const highlightMap = new Map();
  highlightEntries.forEach((entry) => {
    if (!highlightMap.has(entry.towerId)) {
      highlightMap.set(entry.towerId, entry);
    }
  });
  const hoveredHighlight = activeDrag ? activeDrag.hoverEntry : null;

  this.towers.forEach((tower) => {
    if (!tower || !Number.isFinite(tower.x) || !Number.isFinite(tower.y)) {
      return;
    }

    const visuals = getTowerVisualConfig(tower) || {};
    const rangeRadius = Number.isFinite(tower.range)
      ? tower.range
      : Math.min(this.renderWidth, this.renderHeight) * 0.22;
    const bodyRadius = Math.max(
      12,
      Math.min(this.renderWidth, this.renderHeight) * ALPHA_BASE_RADIUS_FACTOR,
    );

    const highlightEntry = highlightMap.get(tower.id) || null;
    if (highlightEntry) {
      ctx.save();
      const isHovered = hoveredHighlight && hoveredHighlight.towerId === tower.id;
      const strokeColor = highlightEntry.action === 'connect'
        ? isHovered
          ? 'rgba(139, 247, 255, 0.85)'
          : 'rgba(139, 247, 255, 0.45)'
        : isHovered
        ? 'rgba(255, 214, 112, 0.85)'
        : 'rgba(255, 214, 112, 0.45)';
      ctx.lineWidth = isHovered ? 3.2 : 2;
      ctx.strokeStyle = strokeColor;
      ctx.setLineDash([isHovered ? 6 : 4, isHovered ? 6 : 8]);
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, bodyRadius + 10, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (Number.isFinite(rangeRadius) && rangeRadius > 0) {
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = visuals.rangeStroke || 'rgba(139, 247, 255, 0.2)';
      ctx.setLineDash([8, 6]);
      ctx.arc(tower.x, tower.y, rangeRadius, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (tower.type === 'theta') {
      drawThetaContoursHelper(this, tower);
    }

    if (tower.type === 'zeta') {
      drawZetaPendulumsHelper(this, tower);
    }
    if (tower.type === 'eta') {
      drawEtaOrbitsHelper(this, tower);
    }
    if (tower.type === 'kappa') {
      drawKappaTripwiresHelper(this, tower);
    }
    if (tower.type === 'lambda') {
      drawLambdaLasersHelper(this, tower);
    }
    if (tower.type === 'mu') {
      drawMuMinesHelper(this, tower);
    }
    if (tower.type === 'nu') {
      drawNuKillParticlesHelper(this, tower);
    }
    if (tower.type === 'xi') {
      drawXiBallsHelper(this, tower);
    }
    if (tower.type === 'pi') {
      drawPiLockOnLinesHelper(this, tower);
      drawPiFrozenLinesHelper(this, tower);
      drawPiRadialLaserHelper(this, tower);
    }
    if (tower.type === 'tau') {
      drawTauProjectilesHelper(this, tower);
    }
    if (tower.type === 'upsilon') {
      drawUpsilonFleetHelper(this, tower);
    }
    if (tower.type === 'phi') {
      drawPhiTowerHelper(this, tower);
    }

    ctx.save();
    const outerShadow = visuals.outerShadow;
    if (outerShadow?.color) {
      this.applyCanvasShadow(
        ctx,
        outerShadow.color,
        Number.isFinite(outerShadow.blur) ? outerShadow.blur : 18,
      );
    } else {
      this.clearCanvasShadow(ctx);
    }

    ctx.beginPath();
    ctx.fillStyle = visuals.innerFill || 'rgba(12, 16, 28, 0.9)';
    ctx.strokeStyle = visuals.outerStroke || 'rgba(139, 247, 255, 0.75)';
    ctx.lineWidth = 2.4;
    ctx.arc(tower.x, tower.y, bodyRadius, 0, TWO_PI);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    drawTowerConnectionParticles.call(this, ctx, tower, bodyRadius);

    const symbolColor = visuals.symbolFill || 'rgba(255, 228, 120, 0.92)';
    const symbolShadow = visuals.symbolShadow;

    const glyph = tower.symbol || tower.definition?.symbol || '?';
    const glyphTransition = this.towerGlyphTransitions?.get(tower.id) || null;
    if (glyphTransition) {
      drawTowerGlyphTransition.call(this, ctx, tower, bodyRadius, glyphTransition, visuals, glyph);
    } else {
      if (symbolShadow?.color) {
        this.applyCanvasShadow(
          ctx,
          symbolShadow.color,
          Number.isFinite(symbolShadow.blur) ? symbolShadow.blur : 18,
        );
      } else {
        this.clearCanvasShadow(ctx);
      }
      ctx.fillStyle = symbolColor;
      ctx.font = `${Math.round(bodyRadius * 1.4)}px "Cormorant Garamond", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, tower.x, tower.y);
    }

    const pressGlowIntensity =
      typeof this.getTowerPressGlowIntensity === 'function'
        ? this.getTowerPressGlowIntensity(tower.id)
        : 0;
    if (pressGlowIntensity > 0.001) {
      drawTowerPressGlow(this, tower, bodyRadius, pressGlowIntensity, visuals, glyph);
    }

    if (tower.type === 'beta') {
      const alphaShots = Math.max(0, Math.floor(tower.storedAlphaShots || 0));
      if (alphaShots >= 3) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = `${Math.round(bodyRadius * 0.75)}px "Cormorant Garamond", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`${alphaShots}α`, tower.x, tower.y + bodyRadius + 6);
        ctx.restore();
      }
    } else if (tower.type === 'gamma') {
      const betaShots = Math.max(0, Math.floor(tower.storedBetaShots || 0));
      const alphaShots = Math.max(0, Math.floor(tower.storedAlphaShots || 0));
      if (betaShots >= 3 || alphaShots >= 3) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = `${Math.round(bodyRadius * 0.7)}px "Cormorant Garamond", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        let labelY = tower.y + bodyRadius + 6;
        if (betaShots >= 3) {
          ctx.fillText(`${betaShots}β`, tower.x, labelY);
          labelY += Math.round(bodyRadius * 0.7) + 4;
        }
        if (alphaShots >= 3) {
          ctx.fillText(`${alphaShots}α`, tower.x, labelY);
        }
        ctx.restore();
      }
    }

    if (tower.chain) {
      this.applyCanvasShadow(ctx, 'rgba(255, 228, 120, 0.55)', 20);
      ctx.strokeStyle = 'rgba(255, 228, 120, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, bodyRadius + 6, 0, TWO_PI);
      ctx.stroke();
      this.clearCanvasShadow(ctx);
    }

    if (this.activeTowerMenu?.towerId === tower.id) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(139, 247, 255, 0.9)';
      ctx.lineWidth = 2.6;
      ctx.arc(tower.x, tower.y, bodyRadius + 10, 0, TWO_PI);
      ctx.stroke();
    }
  });

  ctx.restore();
}

// ─── Per-Tower-Type Extension Delegates ──────────────────────────────────────

export function drawZetaPendulums(tower) {
  drawZetaPendulumsHelper(this, tower);
}

export function drawEtaOrbits(tower) {
  drawEtaOrbitsHelper(this, tower);
}

export function drawDeltaSoldiers() {
  drawDeltaSoldiersHelper(this);
}

export function drawOmicronUnits() {
  drawOmicronUnitsHelper(this);
}
