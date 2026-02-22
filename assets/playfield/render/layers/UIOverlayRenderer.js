/**
 * UI Overlay Renderer
 *
 * Handles all HUD and overlay rendering drawn on top of the playfield canvas:
 * - Damage number floaters (standard and divisor-equation variants)
 * - Wave tally labels (animated reveal/erase)
 * - Floating feedback messages (delegated to FloatingFeedback system)
 * - Radial tower command lattice (animated open/dismiss transitions)
 *
 * All exported functions are designed to be called with `.call(renderer)` where
 * `renderer` is the CanvasRenderer / SimplePlayfield instance, matching the
 * established calling convention in CanvasRenderer.js.
 *
 * Extracted from CanvasRenderer.js as part of Phase 2.2.5 of the Monolithic
 * Refactoring Plan (Build 489).
 */

import { colorToRgbaString } from '../../../../scripts/features/towers/powderTower.js';
import { easeInCubic, easeOutCubic } from '../../utils/math.js';

// ─── Constants ────────────────────────────────────────────────────────────────

// Radial tower menu animation tuning keeps the command lattice feeling responsive yet readable.
const TOWER_MENU_OPEN_DURATION_MS = 360;
const TOWER_MENU_DISMISS_DURATION_MS = 220;
const TOWER_MENU_OPEN_SPIN_RADIANS = Math.PI * 0.75;
const TOWER_MENU_DISMISS_SPIN_RADIANS = Math.PI * 0.65;
const TOWER_MENU_DISMISS_SCALE = 1.25;

// Viewport culling radius for damage numbers (smaller objects need a tighter margin).
const DAMAGE_NUMBER_CULL_RADIUS = 50;

// ─── Utility constants (duplicated from CanvasRenderer for a self-contained module) ───
const TWO_PI = Math.PI * 2;
const HALF = 0.5;
// Viewport culling margin: buffer zone beyond visible area to prevent pop-in
const VIEWPORT_CULL_MARGIN = 100;

// ─── Utility helpers ──────────────────────────────────────────────────────────

function getNowTimestamp() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

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

// ─── Private helper functions ─────────────────────────────────────────────────

/**
 * Render the radial tower menu with animated scaling, rotation, and opacity.
 */
function drawAnimatedTowerMenu(ctx, config = {}) {
  const {
    position,
    options,
    ringRadius,
    optionRadius,
    rotationOffset = 0,
    radiusScale = 1,
    optionScale = 1,
    opacity = 1,
  } = config;
  if (
    !ctx ||
    !position ||
    !Number.isFinite(ringRadius) ||
    !Number.isFinite(optionRadius) ||
    !Array.isArray(options) ||
    !options.length
  ) {
    return false;
  }
  const scaledRingRadius = Math.max(0, ringRadius * Math.max(0, radiusScale));
  const scaledOptionRadius = Math.max(2, optionRadius * Math.max(0.35, optionScale));
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(139, 247, 255, 0.35)';
  ctx.lineWidth = Math.max(1.2, scaledOptionRadius * 0.14);
  ctx.arc(position.x, position.y, scaledRingRadius, 0, TWO_PI);
  ctx.stroke();

  options.forEach((option) => {
    if (!option) {
      return;
    }
    const angle = ((Number.isFinite(option.angle) ? option.angle : 0) + rotationOffset) % (TWO_PI);
    const optionX = position.x + Math.cos(angle) * scaledRingRadius;
    const optionY = position.y + Math.sin(angle) * scaledRingRadius;
    const selected = Boolean(option.selected);
    const disabled = Boolean(option.disabled);
    ctx.beginPath();
    const baseFill = selected ? 'rgba(255, 228, 120, 0.32)' : 'rgba(12, 16, 26, 0.88)';
    const disabledFill = 'rgba(12, 16, 26, 0.5)';
    const baseStroke = selected ? 'rgba(255, 228, 120, 0.9)' : 'rgba(139, 247, 255, 0.75)';
    const disabledStroke = 'rgba(139, 247, 255, 0.35)';
    ctx.fillStyle = disabled ? disabledFill : baseFill;
    ctx.strokeStyle = disabled ? disabledStroke : baseStroke;
    ctx.lineWidth = Math.max(1.4, scaledOptionRadius * 0.16);
    ctx.arc(optionX, optionY, scaledOptionRadius, 0, TWO_PI);
    ctx.fill();
    ctx.stroke();

    const hasCostLabel = typeof option.costLabel === 'string' && option.costLabel.length > 0;
    const iconFontSize = Math.max(10, Math.round(scaledOptionRadius * (hasCostLabel ? 0.82 : 0.95)));
    const iconY = hasCostLabel ? optionY - scaledOptionRadius * 0.25 : optionY;
    ctx.fillStyle = disabled ? 'rgba(230, 234, 241, 0.42)' : 'rgba(255, 255, 255, 0.92)';
    ctx.font = `${iconFontSize}px "Cormorant Garamond", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(option.icon || '?', optionX, iconY);

    if (hasCostLabel) {
      const costFontSize = Math.max(8, Math.round(scaledOptionRadius * 0.45));
      ctx.fillStyle = disabled ? 'rgba(210, 216, 226, 0.38)' : 'rgba(210, 216, 226, 0.82)';
      ctx.font = `${costFontSize}px "Cormorant Garamond", serif`;
      ctx.textBaseline = 'top';
      const costY = iconY + scaledOptionRadius * 0.4;
      ctx.fillText(option.costLabel, optionX, costY);
    }
  });

  ctx.restore();
  return true;
}

// ─── Exported render functions ────────────────────────────────────────────────

export function drawDamageNumbers() {
  if (!this.ctx || !Array.isArray(this.damageNumbers) || !this.damageNumbers.length) {
    return;
  }

  const ctx = this.ctx;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  // Use cached viewport bounds to reduce redundant calculations
  const viewportBounds = this._frameCache?.viewportBounds || getViewportBounds.call(this);

  this.damageNumbers.forEach((entry) => {
    if (!entry || !entry.position || !entry.text || entry.alpha <= 0) {
      return;
    }

    // Skip rendering damage numbers outside viewport
    if (viewportBounds && !isInViewport(entry.position, viewportBounds, DAMAGE_NUMBER_CULL_RADIUS)) {
      return;
    }

    const fontSize = Number.isFinite(entry.fontSize) ? entry.fontSize : 16;
    // Fade the highlight outline based on how much of the target's health the hit removed.
    const highlightAlpha = Number.isFinite(entry.outlineAlpha)
      ? Math.max(0, Math.min(1, entry.outlineAlpha))
      : 0;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, entry.alpha));

    // Special rendering for divisor equations
    if (entry.isDivisorEquation && entry.reciprocalText && entry.equalsText && entry.resultText) {
      // Render the equation: "1/[damage] = [actual damage]"
      // The "1/[damage]" part should be in smaller font
      const smallFontSize = fontSize * 0.5;
      const smallFont = `600 ${smallFontSize}px "Cormorant Garamond", serif`;
      const regularFont = `600 ${fontSize}px "Cormorant Garamond", serif`;

      // Measure text widths to position elements
      ctx.font = smallFont;
      const reciprocalWidth = ctx.measureText(entry.reciprocalText).width;
      ctx.font = regularFont;
      const equalsWidth = ctx.measureText(entry.equalsText).width;
      const resultWidth = ctx.measureText(entry.resultText).width;

      // Calculate total width and starting position
      const totalWidth = reciprocalWidth + equalsWidth + resultWidth;
      const startX = entry.position.x - totalWidth * 0.5;

      // Render reciprocal part (small font)
      ctx.font = smallFont;
      const smallOutlineWidth = Math.max(1, smallFontSize * 0.12);
      ctx.lineWidth = smallOutlineWidth;
      ctx.strokeStyle = 'rgba(6, 8, 14, 0.7)';
      ctx.fillStyle = colorToRgbaString(entry.color || { r: 255, g: 228, b: 120 }, 0.92);
      const reciprocalX = startX + reciprocalWidth * 0.5;
      ctx.strokeText(entry.reciprocalText, reciprocalX, entry.position.y);
      if (highlightAlpha > 0.01) {
        const brightOutlineWidth = Math.max(1, smallOutlineWidth * 0.8);
        ctx.lineWidth = brightOutlineWidth;
        ctx.strokeStyle = `rgba(255, 255, 236, ${highlightAlpha})`;
        ctx.strokeText(entry.reciprocalText, reciprocalX, entry.position.y);
        ctx.lineWidth = smallOutlineWidth;
      }
      ctx.fillText(entry.reciprocalText, reciprocalX, entry.position.y);

      // Render equals sign (regular font)
      ctx.font = regularFont;
      const outlineWidth = Math.max(1, fontSize * 0.12);
      ctx.lineWidth = outlineWidth;
      const equalsX = startX + reciprocalWidth + equalsWidth * 0.5;
      ctx.strokeText(entry.equalsText, equalsX, entry.position.y);
      if (highlightAlpha > 0.01) {
        const brightOutlineWidth = Math.max(1, outlineWidth * 0.8);
        ctx.lineWidth = brightOutlineWidth;
        ctx.strokeStyle = `rgba(255, 255, 236, ${highlightAlpha})`;
        ctx.strokeText(entry.equalsText, equalsX, entry.position.y);
        ctx.lineWidth = outlineWidth;
        ctx.strokeStyle = 'rgba(6, 8, 14, 0.7)';
      }
      ctx.fillText(entry.equalsText, equalsX, entry.position.y);

      // Render result (regular font)
      const resultX = startX + reciprocalWidth + equalsWidth + resultWidth * 0.5;
      ctx.strokeText(entry.resultText, resultX, entry.position.y);
      if (highlightAlpha > 0.01) {
        const brightOutlineWidth = Math.max(1, outlineWidth * 0.8);
        ctx.lineWidth = brightOutlineWidth;
        ctx.strokeStyle = `rgba(255, 255, 236, ${highlightAlpha})`;
        ctx.strokeText(entry.resultText, resultX, entry.position.y);
        ctx.lineWidth = outlineWidth;
      }
      ctx.fillText(entry.resultText, resultX, entry.position.y);
    } else {
      // Standard rendering for non-divisor damage
      ctx.font = `600 ${fontSize}px "Cormorant Garamond", serif`;
      const outlineWidth = Math.max(1, fontSize * 0.12);
      ctx.lineWidth = outlineWidth;
      ctx.strokeStyle = 'rgba(6, 8, 14, 0.7)';
      ctx.fillStyle = colorToRgbaString(entry.color || { r: 255, g: 228, b: 120 }, 0.92);
      ctx.strokeText(entry.text, entry.position.x, entry.position.y);
      if (highlightAlpha > 0.01) {
        const brightOutlineWidth = Math.max(1, outlineWidth * 0.8);
        ctx.lineWidth = brightOutlineWidth;
        ctx.strokeStyle = `rgba(255, 255, 236, ${highlightAlpha})`;
        ctx.strokeText(entry.text, entry.position.x, entry.position.y);
        ctx.lineWidth = outlineWidth;
      }
      ctx.fillText(entry.text, entry.position.x, entry.position.y);
    }
    ctx.restore();
  });

  ctx.restore();
}

export function drawFloatingFeedback() {
  if (!this.floatingFeedback || typeof this.floatingFeedback.update !== 'function') {
    return;
  }
  const now = this._frameCache?.timestamp || getNowTimestamp();
  this.floatingFeedback.update(now);
}

export function drawWaveTallies() {
  if (!this.ctx || !Array.isArray(this.waveTallyLabels) || !this.waveTallyLabels.length) {
    return;
  }

  const ctx = this.ctx;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  this.waveTallyLabels.forEach((entry) => {
    if (!entry || !entry.position) {
      return;
    }
    const alpha = Math.max(0, Math.min(1, entry.alpha || 0));
    if (alpha <= 0) {
      return;
    }
    const label = entry.label;
    if (!label) {
      return;
    }
    const fontSize = Number.isFinite(entry.fontSize) ? entry.fontSize : 16;
    const font = entry.font || `600 ${fontSize}px "Cormorant Garamond", serif`;
    ctx.save();
    const entryOpacity = Number.isFinite(entry.opacity)
      ? Math.max(0, Math.min(1, entry.opacity))
      : 1;
    ctx.globalAlpha = alpha * entryOpacity;
    ctx.font = font;
    const fullWidth = Number.isFinite(entry.textWidth)
      ? entry.textWidth
      : ctx.measureText(label).width;
    const drawProgress = Number.isFinite(entry.revealProgress)
      ? Math.max(0, Math.min(1, entry.revealProgress))
      : 1;
    const eraseProgress = entry.isErasing && Number.isFinite(entry.eraseProgress)
      ? Math.max(0, Math.min(1, entry.eraseProgress))
      : 0;
    let clipWidth = Math.max(0, fullWidth * drawProgress);
    let clipX = entry.position.x - fullWidth * HALF;
    if (entry.isErasing && eraseProgress > 0) {
      clipX += fullWidth * eraseProgress;
      clipWidth = Math.max(0, fullWidth * (1 - eraseProgress));
    }
    if (clipWidth <= 0) {
      ctx.restore();
      return;
    }
    const clipHeight = fontSize * 1.6;
    const clipY = entry.position.y - fontSize * 0.8;
    ctx.save();
    ctx.beginPath();
    ctx.rect(clipX, clipY, clipWidth, clipHeight);
    ctx.clip();
    const fillColor = colorToRgbaString(entry.color || { r: 255, g: 228, b: 120 }, 1);
    ctx.fillStyle = fillColor;
    ctx.lineWidth = Math.max(1, fontSize * 0.08);
    if (entry.strokeColor) {
      ctx.strokeStyle = colorToRgbaString(entry.strokeColor, 0.85);
      ctx.strokeText(label, entry.position.x, entry.position.y);
    }
    if (entry.shadowColor) {
      ctx.shadowColor = colorToRgbaString(entry.shadowColor, 0.6);
      ctx.shadowBlur = Number.isFinite(entry.shadowBlur) ? entry.shadowBlur : 8;
    } else {
      ctx.shadowColor = 'rgba(0, 0, 0, 0)';
      ctx.shadowBlur = 0;
    }
    ctx.fillText(label, entry.position.x, entry.position.y);
    ctx.restore();
    ctx.restore();
  });

  ctx.restore();
}

export function drawTowerMenu() {
  if (!this.ctx || (!this.activeTowerMenu && !this.towerMenuExitAnimation)) {
    return;
  }
  const ctx = this.ctx;
  const now =
    typeof this.getCurrentTimestamp === 'function' ? this.getCurrentTimestamp() : Date.now();
  ctx.save();

  if (this.activeTowerMenu) {
    // Animate the live command lattice so options spin out from the tower core.
    const tower = this.getActiveMenuTower();
    const geometry = tower ? this.getTowerMenuGeometry(tower) : null;
    if (tower && geometry && Array.isArray(geometry.options) && geometry.options.length) {
      const openedAt = Number.isFinite(this.activeTowerMenu.openedAt)
        ? this.activeTowerMenu.openedAt
        : now;
      const progress =
        TOWER_MENU_OPEN_DURATION_MS > 0
          ? Math.max(0, Math.min(1, (now - openedAt) / TOWER_MENU_OPEN_DURATION_MS))
          : 1;
      const easedScale = easeOutCubic(progress);
      drawAnimatedTowerMenu(ctx, {
        position: { x: tower.x, y: tower.y },
        options: geometry.options,
        ringRadius: geometry.ringRadius,
        optionRadius: geometry.optionRadius,
        rotationOffset: -TOWER_MENU_OPEN_SPIN_RADIANS * (1 - easedScale),
        radiusScale: easedScale,
        optionScale: Math.max(0.35, easedScale),
        opacity: easedScale,
      });
      this.activeTowerMenu.anchor = { x: tower.x, y: tower.y };
      // Cache geometry so the closing animation can finish even if the underlying tower disappears mid-frame.
      this.activeTowerMenu.geometrySnapshot = {
        ringRadius: geometry.ringRadius,
        optionRadius: geometry.optionRadius,
        options: geometry.options.map((option) => ({
          angle: option.angle,
          icon: option.icon,
          costLabel: option.costLabel,
          selected: option.selected,
          disabled: option.disabled,
        })),
      };
    }
  }

  if (this.towerMenuExitAnimation) {
    // Continue rendering a short dismissal burst so the lattice fades away smoothly.
    const state = this.towerMenuExitAnimation;
    const progress =
      TOWER_MENU_DISMISS_DURATION_MS > 0
        ? Math.max(0, Math.min(1, (now - (state.startedAt || 0)) / TOWER_MENU_DISMISS_DURATION_MS))
        : 1;
    if (progress >= 1) {
      this.towerMenuExitAnimation = null;
    } else if (
      state.anchor &&
      Array.isArray(state.options) &&
      state.options.length &&
      Number.isFinite(state.ringRadius) &&
      Number.isFinite(state.optionRadius)
    ) {
      const eased = easeInCubic(progress);
      drawAnimatedTowerMenu(ctx, {
        position: state.anchor,
        options: state.options,
        ringRadius: state.ringRadius,
        optionRadius: state.optionRadius,
        rotationOffset: -TOWER_MENU_DISMISS_SPIN_RADIANS * eased,
        radiusScale: 1 + (TOWER_MENU_DISMISS_SCALE - 1) * eased,
        optionScale: 1 + 0.25 * eased,
        opacity: 1 - eased,
      });
    }
  }

  ctx.restore();
}
