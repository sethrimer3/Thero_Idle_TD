import { samplePaletteGradient } from '../../colorSchemeUtils.js';
import { moteGemState, getGemSpriteImage } from '../../enemies.js';
import { colorToRgbaString } from '../../../scripts/features/towers/powderTower.js';
import {
  drawChiThralls as drawChiThrallsHelper,
  drawChiLightTrails as drawChiLightTrailsHelper,
} from '../../../scripts/features/towers/chiTower.js';

import {
  drawCrystallineMosaic,
  drawSketches,
  drawSketchLayerCache,
  drawFloaters,
} from './layers/BackgroundRenderer.js';
import {
  drawTowerConnectionParticles,
  drawConnectionEffects,
  drawTowers,
  drawPlacementPreview,
  drawZetaPendulums,
  drawEtaOrbits,
  drawDeltaSoldiers,
  drawOmicronUnits,
} from './layers/TowerSpriteRenderer.js';
import {
  drawProjectiles,
  drawAlphaBursts,
  drawBetaBursts,
  drawGammaBursts,
  drawGammaStarBursts,
  drawNuBursts,
  drawOmegaParticles,
} from './layers/ProjectileRenderer.js';
import {
  drawEnemies,
  drawEnemyDeathParticles,
  drawSwarmClouds,
} from './layers/EnemyRenderer.js';
import {
  drawDamageNumbers,
  drawFloatingFeedback,
  drawWaveTallies,
  drawTowerMenu,
} from './layers/UIOverlayRenderer.js';
import {
  drawPathLayerCache,
  drawPath,
  drawArcLight,
  drawEnemyGateSymbol,
  drawMindGateSymbol,
  drawNodes,
} from './layers/TrackRenderer.js';

// Pre-calculated constants for performance optimization in tight render loops
const TWO_PI = Math.PI * 2;
const HALF = 0.5;

const GEM_MOTE_BASE_RATIO = 0.02;

// Viewport culling margin: buffer zone beyond visible area to prevent pop-in
const VIEWPORT_CULL_MARGIN = 100;
// Entity culling radii
const MOTE_GEM_CULL_RADIUS = 50;

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
 * @returns {boolean} True if visible (or if bounds unavailable), false if position invalid or not visible
 */
function isInViewport(position, bounds, radius = 0) {
  if (!position) {
    return false; // No position means nothing to render
  }
  if (!bounds) {
    return true; // Can't determine visibility, so render everything to be safe
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

function getNowTimestamp() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function applyCanvasShadow(ctx, color, blur) {
  if (!ctx) {
    return;
  }
  if (this.isLowGraphicsMode()) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0)';
    ctx.shadowBlur = 0;
    return;
  }
  ctx.shadowColor = color || 'rgba(0, 0, 0, 0)';
  ctx.shadowBlur = Number.isFinite(blur) ? blur : 0;
}

function clearCanvasShadow(ctx) {
  if (!ctx) {
    return;
  }
  ctx.shadowColor = 'rgba(0, 0, 0, 0)';
  ctx.shadowBlur = 0;
}

function draw() {
  if (!this.ctx) {
    return;
  }
  const ctx = this.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);

  const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  const viewCenter = this.getViewCenter();
  ctx.translate(width * HALF, height * HALF);
  ctx.scale(this.viewScale, this.viewScale);
  ctx.translate(-viewCenter.x, -viewCenter.y);

  // Cache commonly used values for this frame to reduce redundant calculations
  this._frameCache = {
    width,
    height,
    minDimension: Math.min(width, height) || 1,
    viewportBounds: getViewportBounds.call(this),
    timestamp: getNowTimestamp(),
  };

  this.drawCrystallineMosaic();
  // Draw cached sketch layer when available to minimize per-frame raster work.
  const sketchLayerDrawn = drawSketchLayerCache.call(this);
  if (!sketchLayerDrawn) {
    this.drawSketches();
  }
  this.drawFloaters();
  // Draw cached path layer when available so zooming only scales a bitmap.
  const pathLayerDrawn = drawPathLayerCache.call(this);
  if (!pathLayerDrawn) {
    this.drawPath();
  }
  this.drawDeltaCommandPreview();
  this.drawMoteGems();
  this.drawArcLight();
  this.drawDeveloperCrystals();
  this.drawNodes();
  this.drawDeveloperPathMarkers();
  this.drawPlacementPreview();
  this.drawTowers();
  this.drawInfinityAuras();
  this.drawDeltaSoldiers();
  this.drawOmicronUnits();
  this.drawEnemies();
  this.drawEnemyDeathParticles();
  this.drawSwarmClouds();
  this.drawDamageNumbers();
  this.drawFloatingFeedback();
  this.drawWaveTallies();
  this.drawChiLightTrails();
  this.drawChiThralls();
  this.drawProjectiles();
  this.drawTowerMenu();
  this.updateEnemyTooltipPosition();
  
  // Clear frame cache after rendering
  this._frameCache = null;
}

function drawMoteGems() {
  if (!this.ctx || !moteGemState.active.length) {
    return;
  }
  const ctx = this.ctx;
  ctx.save();
  
  // Use cached frame values to reduce redundant calculations
  const width = this._frameCache?.width || (this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0);
  const height = this._frameCache?.height || (this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0);
  const minDimension = this._frameCache?.minDimension || (() => {
    const dimensionCandidates = [];
    if (Number.isFinite(width) && width > 0) {
      dimensionCandidates.push(width);
    }
    if (Number.isFinite(height) && height > 0) {
      dimensionCandidates.push(height);
    }
    return Math.max(1, dimensionCandidates.length ? Math.min(...dimensionCandidates) : 320);
  })();
  
  const moteUnit = Math.max(6, minDimension * GEM_MOTE_BASE_RATIO);
  const pulseMagnitude = moteUnit * 0.35;

  // Calculate viewport bounds once for all mote gems
  const viewportBounds = this._frameCache?.viewportBounds || getViewportBounds.call(this);

  moteGemState.active.forEach((gem) => {
    // Skip rendering mote gems outside viewport
    if (viewportBounds && !isInViewport({ x: gem.x, y: gem.y }, viewportBounds, MOTE_GEM_CULL_RADIUS)) {
      return;
    }
    
    const hue = gem.color?.hue ?? 48;
    const saturation = gem.color?.saturation ?? 68;
    const lightness = gem.color?.lightness ?? 56;
    const moteSize = Number.isFinite(gem.moteSize) ? Math.max(1, gem.moteSize) : Math.max(1, gem.value);
    const size = moteSize * moteUnit;
    const pulse = Math.sin((gem.pulse || 0) * 0.6) * pulseMagnitude;
    const rotation = Math.sin((gem.pulse || 0) * 0.35) * 0.45;
    const opacity = Number.isFinite(gem.opacity) ? Math.max(0, Math.min(1, gem.opacity)) : 1;
    const alphaFill = Math.max(0, Math.min(0.9, 0.6 + opacity * 0.3));
    const alphaStroke = Math.max(0, Math.min(0.9, 0.5 + opacity * 0.35));
    const fill = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alphaFill})`;
    const stroke = `hsla(${hue}, ${Math.max(24, saturation - 18)}%, ${Math.max(18, lightness - 28)}%, ${alphaStroke})`;
    const sparkle = `hsla(${hue}, ${Math.max(34, saturation - 22)}%, 92%, ${Math.max(0, opacity * 0.65)})`;
    const sprite = getGemSpriteImage(gem.typeKey);

    ctx.save();
    ctx.translate(gem.x, gem.y);
    ctx.rotate(rotation);
    if (sprite) {
      const baseSize = Math.max(moteUnit * 0.6, size + pulse);
      const reference = Math.max(1, Math.max(sprite.width || 1, sprite.height || 1));
      const renderSize = baseSize;
      const scale = renderSize / reference;
      const spriteWidth = (sprite.width || reference) * scale;
      const spriteHeight = (sprite.height || reference) * scale;
      ctx.globalAlpha = opacity;
      ctx.drawImage(sprite, -spriteWidth * HALF, -spriteHeight * HALF, spriteWidth, spriteHeight);
    } else {
      const squareSize = Math.max(moteUnit * 0.6, size + pulse);
      const half = squareSize * HALF;
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(moteUnit * 0.12, 1.2);
      ctx.beginPath();
      ctx.rect(-half, -half, squareSize, squareSize);
      ctx.fill();
      ctx.stroke();

      const sparkleSize = Math.max(moteUnit * 0.3, squareSize * 0.38);
      ctx.fillStyle = sparkle;
      ctx.fillRect(-sparkleSize * 0.5, -sparkleSize * 0.8, sparkleSize, sparkleSize);
    }
    ctx.restore();
  });
  ctx.restore();
}

function drawDeltaCommandPreview() {
  if (!this.ctx) {
    return;
  }
  const dragState = this.deltaCommandDragState;
  if (!dragState || !dragState.pointerId || !dragState.active) {
    return;
  }
  const tower = this.getTowerById(dragState.towerId);
  if (!tower) {
    return;
  }

  const ctx = this.ctx;
  const minDimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 1;
  const anchorRadius = Math.max(22, minDimension * 0.06);
  const target = dragState.trackAnchor?.point || dragState.currentPosition;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (target) {
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = dragState.trackAnchor
      ? 'rgba(139, 247, 255, 0.68)'
      : 'rgba(139, 247, 255, 0.38)';
    ctx.lineWidth = Math.max(1.6, anchorRadius * 0.1);
    ctx.beginPath();
    ctx.moveTo(tower.x, tower.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (dragState.trackAnchor?.point) {
    const anchor = dragState.trackAnchor.point;
    ctx.beginPath();
    ctx.fillStyle = 'rgba(139, 247, 255, 0.16)';
    ctx.strokeStyle = 'rgba(139, 247, 255, 0.85)';
    ctx.lineWidth = Math.max(2.4, anchorRadius * 0.14);
    ctx.arc(anchor.x, anchor.y, anchorRadius, 0, TWO_PI);
    ctx.fill();
    ctx.stroke();
  } else if (target) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(139, 247, 255, 0.42)';
    ctx.lineWidth = Math.max(1.2, anchorRadius * 0.08);
    ctx.setLineDash([4, 4]);
    ctx.arc(target.x, target.y, anchorRadius * 0.55, 0, TWO_PI);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawChiThralls() {
  drawChiThrallsHelper(this);
}

function drawChiLightTrails() {
  drawChiLightTrailsHelper(this);
}

function drawDeveloperMapSpeedLabel(ctx, mapSpeedMultiplier, renderWidth) {
  if (!ctx || !Number.isFinite(mapSpeedMultiplier)) {
    return;
  }
  ctx.save();
  ctx.font = 'bold 14px "Cormorant Garamond", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(139, 247, 255, 0.85)';
  const speedText = `Map Speed: ×${mapSpeedMultiplier.toFixed(2)}`;
  ctx.fillText(speedText, renderWidth * HALF, 12);
  ctx.restore();
}

function drawDeveloperPathMarkers() {
  if (!this.ctx || !Array.isArray(this.developerPathMarkers) || !this.developerPathMarkers.length) {
    // Still draw the map speed if developer tools are active even without markers
    drawDeveloperMapSpeedLabel(this.ctx, this.developerMapSpeedMultiplier, this.renderWidth);
    return;
  }

  const ctx = this.ctx;
  ctx.save();

  // Draw map speed multiplier at the top of the playfield
  drawDeveloperMapSpeedLabel(ctx, this.developerMapSpeedMultiplier, this.renderWidth);

  ctx.font = '12px "Cormorant Garamond", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  this.developerPathMarkers.forEach((marker, index) => {
    const radius = marker.active ? 12 : 10;
    ctx.beginPath();
    ctx.fillStyle = marker.active ? 'rgba(18, 26, 44, 0.9)' : 'rgba(12, 16, 28, 0.82)';
    ctx.strokeStyle = marker.active
      ? 'rgba(139, 247, 255, 0.9)'
      : 'rgba(139, 247, 255, 0.55)';
    ctx.lineWidth = marker.active ? 2 : 1.5;
    if (marker.active) {
      this.applyCanvasShadow(ctx, 'rgba(139, 247, 255, 0.3)', 16);
    } else {
      this.clearCanvasShadow(ctx);
    }
    ctx.arc(marker.x, marker.y, radius, 0, TWO_PI);
    ctx.fill();
    ctx.stroke();

    const label = marker.label !== undefined && marker.label !== null ? marker.label : index + 1;
    if (label !== undefined && label !== null) {
      ctx.fillStyle = 'rgba(139, 247, 255, 0.9)';
      ctx.fillText(String(label), marker.x, marker.y);
    }

    // Draw speed multiplier under the marker for all points
    const speedMultiplier = Number.isFinite(marker.speedMultiplier) ? marker.speedMultiplier : 1;
    this.clearCanvasShadow(ctx);
    ctx.font = '9px "Cormorant Garamond", serif';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255, 200, 100, 0.85)';
    const speedLabel = `×${speedMultiplier.toFixed(2)}`;
    ctx.fillText(speedLabel, marker.x, marker.y + radius + 3);
    // Restore font for next marker
    ctx.font = '12px "Cormorant Garamond", serif';
    ctx.textBaseline = 'middle';
  });

  ctx.restore();
}

function drawDeveloperCrystals() {
  if (!this.ctx) {
    return;
  }
  const ctx = this.ctx;
  if (this.developerCrystals.length) {
    ctx.save();
    this.developerCrystals.forEach((crystal) => {
      if (!crystal) {
        return;
      }
      const position = this.getCrystalPosition(crystal);
      const radius = this.getCrystalRadius(crystal);
      if (!position || radius <= 0) {
        return;
      }
      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.rotate(crystal.orientation || 0);
      const outline = Array.isArray(crystal.outline) && crystal.outline.length
        ? crystal.outline
        : [1, 1, 1, 1, 1, 1];
      ctx.beginPath();
      outline.forEach((scale, index) => {
        const ratio = index / outline.length;
        const angle = ratio * TWO_PI;
        const radial = radius * (0.72 + scale * 0.28);
        const x = Math.cos(angle) * radial;
        const y = Math.sin(angle) * radial;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.closePath();
      const baseColor = samplePaletteGradient(crystal.paletteRatio ?? 0.5) || { r: 160, g: 220, b: 255 };
      const highlightColor = samplePaletteGradient(Math.min(1, (crystal.paletteRatio ?? 0.5) + 0.18)) || baseColor;
      const gradient = ctx.createLinearGradient(-radius, -radius, radius, radius);
      gradient.addColorStop(0, colorToRgbaString(baseColor, 0.88));
      gradient.addColorStop(1, colorToRgbaString(highlightColor, 0.82));
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.lineWidth = Math.max(2, radius * 0.08);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.stroke();
      if (Array.isArray(crystal.fractures)) {
        crystal.fractures.forEach((fracture) => {
          if (!fracture) {
            return;
          }
          const width = Number.isFinite(fracture.width) ? fracture.width : 0.6;
          const depth = Number.isFinite(fracture.depth) ? fracture.depth : 0.4;
          const progress = Number.isFinite(fracture.progress) ? fracture.progress : 0;
          const jagged = Array.isArray(fracture.jagged) && fracture.jagged.length
            ? fracture.jagged
            : [1, 0.7, 0.85, 0.7, 1];
          const segments = Math.max(3, jagged.length - 1);
          const outerRadius = radius * 0.98;
          ctx.save();
          const anchor = Number.isFinite(fracture.angle) ? fracture.angle : 0;
          ctx.rotate(anchor);
          ctx.beginPath();
          for (let index = 0; index <= segments; index += 1) {
            const t = index / segments;
            const angle = (t - 0.5) * width;
            const x = Math.cos(angle) * outerRadius;
            const y = Math.sin(angle) * outerRadius;
            if (index === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          for (let index = segments; index >= 0; index -= 1) {
            const t = index / segments;
            const angle = (t - 0.5) * width;
            const jaggedScale = jagged[index] ?? 1;
            const inset = Math.min(0.9, depth * progress * jaggedScale);
            const radial = outerRadius * (1 - inset);
            const x = Math.cos(angle) * radial;
            const y = Math.sin(angle) * radial;
            ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fillStyle = 'rgba(8, 12, 24, 0.9)';
          ctx.fill();
          ctx.restore();
        });
      }
      if (this.focusedCrystalId === crystal.id) {
        ctx.strokeStyle = 'rgba(255, 228, 120, 0.85)';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.12, 0, TWO_PI);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    });
    ctx.restore();
  }
  if (this.crystalShards.length) {
    ctx.save();
    this.crystalShards.forEach((shard) => {
      if (!shard) {
        return;
      }
      const lifeRatio = shard.maxLife ? Math.max(0, 1 - shard.life / shard.maxLife) : 1;
      const shardColor = colorToRgbaString(shard.color || { r: 188, g: 236, b: 255 }, lifeRatio);
      ctx.save();
      ctx.translate(shard.x || 0, shard.y || 0);
      ctx.rotate(shard.rotation || 0);
      ctx.fillStyle = shardColor;
      const size = Math.max(2, shard.size || 5);
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.4);
      ctx.lineTo(size * 0.6, 0);
      ctx.lineTo(0, size * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  }
}


export {
  applyCanvasShadow,
  clearCanvasShadow,
  drawTowerConnectionParticles,
  drawConnectionEffects,
  draw,
  drawCrystallineMosaic,
  drawSketches,
  drawFloaters,
  drawMoteGems,
  drawPath,
  drawDeltaCommandPreview,
  drawArcLight,
  drawEnemyGateSymbol,
  drawMindGateSymbol,
  drawNodes,
  drawChiThralls,
  drawChiLightTrails,
  drawDeveloperPathMarkers,
  drawDeveloperCrystals,
  drawPlacementPreview,
  drawTowers,
  drawZetaPendulums,
  drawEtaOrbits,
  drawDeltaSoldiers,
  drawOmicronUnits,
  drawEnemies,
  drawEnemyDeathParticles,
  drawSwarmClouds,
  drawDamageNumbers,
  drawFloatingFeedback,
  drawWaveTallies,
  drawProjectiles,
  drawAlphaBursts,
  drawBetaBursts,
  drawGammaBursts,
  drawGammaStarBursts,
  drawNuBursts,
  drawOmegaParticles,
  drawTowerMenu,
};
