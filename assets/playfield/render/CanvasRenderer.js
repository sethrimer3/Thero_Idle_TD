import { samplePaletteGradient } from '../../colorSchemeUtils.js';
import { moteGemState, getGemSpriteImage } from '../../enemies.js';
import { colorToRgbaString, resolvePaletteColorStops } from '../../../scripts/features/towers/powderTower.js';
import { getTrackRenderMode, TRACK_RENDER_MODES, areTrackTracersEnabled } from '../../preferences.js';
import {
  drawChiThralls as drawChiThrallsHelper,
  drawChiLightTrails as drawChiLightTrailsHelper,
} from '../../../scripts/features/towers/chiTower.js';

import { normalizeProjectileColor } from '../utils/rendering.js';

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

// Pre-calculated constants for performance optimization in tight render loops
const PI = Math.PI;
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const HALF = 0.5;

const MIND_GATE_SPRITE_URL = 'assets/images/tower-mind-gate.svg';
const mindGateSprite = new Image();
mindGateSprite.src = MIND_GATE_SPRITE_URL;
mindGateSprite.decoding = 'async';
mindGateSprite.loading = 'eager';

const ENEMY_GATE_SPRITE_URL = 'assets/images/enemy-gate.svg';
const enemyGateSprite = new Image();
enemyGateSprite.src = ENEMY_GATE_SPRITE_URL;
enemyGateSprite.decoding = 'async';
enemyGateSprite.loading = 'eager';

const GEM_MOTE_BASE_RATIO = 0.02;
const TRACK_GATE_SIZE_SCALE = 0.5;
// Scale the enemy gate glyph up so the spawn marker remains legible at a glance.
const ENEMY_GATE_SYMBOL_SCALE = 2;
// Reuse the same warm palette that powers the luminous arc tracer.
const TRACK_TRACER_PRIMARY_COLOR = { r: 255, g: 180, b: 105 };
const TRACK_TRACER_HALO_COLOR = { r: 255, g: 228, b: 180 };
// Consciousness wave configuration for the Mind Gate visualization.
const CONSCIOUSNESS_WAVE_SPEED = 2; // Speed of wave movement
const CONSCIOUSNESS_WAVE_WIDTH_SCALE = 2.4; // Wave extends beyond gate
const CONSCIOUSNESS_WAVE_HEIGHT_SCALE = 0.5; // Base amplitude relative to radius
const CONSCIOUSNESS_WAVE_PEAKS = 3; // Number of complete sine waves
const CONSCIOUSNESS_WAVE_POINTS = 80; // Number of points for smooth curve
const CONSCIOUSNESS_WAVE_PEAK_PHASE_SCALE = 0.7; // Phase offset between peaks
const CONSCIOUSNESS_WAVE_PEAK_TIME_SCALE = 0.5; // Time-based peak variation speed
const CONSCIOUSNESS_WAVE_AMPLITUDE_MIN = 0.7; // Minimum peak amplitude multiplier
const CONSCIOUSNESS_WAVE_AMPLITUDE_RANGE = 0.3; // Range of peak amplitude variation
const CONSCIOUSNESS_WAVE_HARMONIC_SCALE = 0.15; // Secondary harmonic amplitude
const CONSCIOUSNESS_WAVE_FLUCTUATION_SPEED = 3; // Speed of subtle fluctuations
const CONSCIOUSNESS_WAVE_FLUCTUATION_SCALE = 0.08; // Amplitude of subtle fluctuations
const CONSCIOUSNESS_WAVE_LINE_WIDTH_MIN = 1.5; // Minimum line width for first layer
const CONSCIOUSNESS_WAVE_LINE_WIDTH_SCALE = 0.08; // Line width scaling relative to radius
const CONSCIOUSNESS_WAVE_SHADOW_BLUR_SCALE = 0.3; // Shadow blur scaling for first layer
const CONSCIOUSNESS_WAVE_LAYER2_ALPHA = 0.5; // Opacity of second layer
const CONSCIOUSNESS_WAVE_LAYER2_LINE_WIDTH_MIN = 2.5; // Minimum line width for second layer
const CONSCIOUSNESS_WAVE_LAYER2_LINE_WIDTH_SCALE = 0.12; // Line width scaling for second layer
const CONSCIOUSNESS_WAVE_LAYER2_SHADOW_BLUR_SCALE = 0.5; // Shadow blur scaling for second layer

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

function smoothstep(value) {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
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

// Build a cache key for the static path layer to avoid re-rasterizing on zoom.
function getPathLayerCacheKey(width, height, paletteStops, trackMode) {
  const levelId = this.levelConfig?.id || 'unknown-level';
  const pixelRatio = Math.max(1, this.pixelRatio || 1);
  const points = Array.isArray(this.pathPoints) ? this.pathPoints : [];
  const firstPoint = points[0] || { x: 0, y: 0 };
  const lastPoint = points[points.length - 1] || { x: 0, y: 0 };
  const tunnelCount = Array.isArray(this.tunnelSegments) ? this.tunnelSegments.length : 0;
  const paletteKey = paletteStops
    .map((entry) => `${entry.stop}:${entry.color.r},${entry.color.g},${entry.color.b}`)
    .join('|');
  return [
    levelId,
    `${width}x${height}`,
    `pr${pixelRatio}`,
    trackMode,
    `points:${points.length}:${Math.round(firstPoint.x)}:${Math.round(firstPoint.y)}:${Math.round(lastPoint.x)}:${Math.round(lastPoint.y)}`,
    `tunnels:${tunnelCount}`,
    `palette:${paletteKey}`,
  ].join(':');
}

// Rasterize the static path into an offscreen canvas so zooming only scales the cached bitmap.
function buildPathLayerCache(width, height) {
  if (!width || !height || !this.levelConfig || !this.pathSegments.length || this.pathPoints.length < 2) {
    return null;
  }
  const trackMode = getTrackRenderMode();
  if (trackMode === TRACK_RENDER_MODES.RIVER) {
    return null;
  }
  const paletteStops = getCachedTrackPaletteStops.call(this);
  const key = getPathLayerCacheKey.call(this, width, height, paletteStops, trackMode);
  if (this._pathLayerCache?.key === key) {
    return this._pathLayerCache;
  }
  const pixelRatio = Math.max(1, this.pixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width * pixelRatio));
  canvas.height = Math.max(1, Math.floor(height * pixelRatio));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  if (Array.isArray(this.tunnelSegments) && this.tunnelSegments.length > 0) {
    drawPathWithTunnels.call(this, ctx, this.pathPoints, paletteStops, trackMode);
  } else {
    drawPathBase.call(this, ctx, this.pathPoints, paletteStops, trackMode);
  }
  this._pathLayerCache = {
    key,
    canvas,
    width,
    height,
    pixelRatio,
  };
  return this._pathLayerCache;
}

// Paint the cached path layer above floaters when the static path cache is available.
function drawPathLayerCache() {
  if (!this.ctx) {
    return false;
  }
  const width = this._frameCache?.width || (this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0);
  const height = this._frameCache?.height || (this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0);
  const cache = buildPathLayerCache.call(this, width, height);
  if (!cache?.canvas) {
    return false;
  }
  this.ctx.drawImage(cache.canvas, 0, 0, width, height);
  return true;
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

function drawPath() {
  if (!this.ctx || !this.pathSegments.length || this.pathPoints.length < 2) {
    return;
  }
  const ctx = this.ctx;
  const points = this.pathPoints;

  const trackMode = getTrackRenderMode();
  if (trackMode === TRACK_RENDER_MODES.RIVER) {
    drawTrackParticleRiver.call(this);
    return;
  }

  const paletteStops = getCachedTrackPaletteStops.call(this);
  
  // If there are tunnels, we need to draw segments with varying opacity
  const hasTunnels = Array.isArray(this.tunnelSegments) && this.tunnelSegments.length > 0;
  
  if (hasTunnels) {
    drawPathWithTunnels.call(this, ctx, points, paletteStops, trackMode);
  } else {
    drawPathBase.call(this, ctx, points, paletteStops, trackMode);
  }
}

// Resolve palette stops once so cached path layers reuse the same gradient sampling.
function getTrackPaletteStops() {
  return [
    { stop: 0, color: samplePaletteGradient(0) },
    { stop: 0.5, color: samplePaletteGradient(0.5) },
    { stop: 1, color: samplePaletteGradient(1) },
  ];
}

// Cache palette stops per frame so path rendering reuses gradient sampling work.
function getCachedTrackPaletteStops() {
  const cachedStops = this?._frameCache?.trackPaletteStops;
  if (cachedStops) {
    return cachedStops;
  }
  const paletteStops = getTrackPaletteStops();
  if (this?._frameCache) {
    // Store the palette stops for the current frame to reduce repeated gradient sampling.
    this._frameCache.trackPaletteStops = paletteStops;
  }
  return paletteStops;
}

// Draw the standard (non-tunnel) track path onto the provided context.
function drawPathBase(ctx, points, paletteStops, trackMode) {
  if (!ctx || !points || points.length < 2) {
    return;
  }
  const start = points[0];
  const end = points[points.length - 1];
  const baseGradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
  const highlightGradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
  const baseAlpha = trackMode === TRACK_RENDER_MODES.BLUR ? 0.78 : 0.55;
  const highlightAlpha = trackMode === TRACK_RENDER_MODES.BLUR ? 0.32 : 0.18;
  paletteStops.forEach((entry) => {
    baseGradient.addColorStop(entry.stop, colorToRgbaString(entry.color, baseAlpha));
    highlightGradient.addColorStop(entry.stop, colorToRgbaString(entry.color, highlightAlpha));
  });

  const tracePath = () => {
    ctx.moveTo(start.x, start.y);
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index];
      ctx.lineTo(point.x, point.y);
    }
  };

  ctx.save();
  ctx.beginPath();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = trackMode === TRACK_RENDER_MODES.BLUR ? 9 : 7;
  const shadowColor = colorToRgbaString(
    paletteStops[0]?.color || { r: 88, g: 160, b: 255 },
    trackMode === TRACK_RENDER_MODES.BLUR ? 0.35 : 0.2,
  );
  this.applyCanvasShadow(ctx, shadowColor, trackMode === TRACK_RENDER_MODES.BLUR ? 26 : 12);
  tracePath();
  ctx.strokeStyle = baseGradient;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = trackMode === TRACK_RENDER_MODES.BLUR ? 0.95 : 1;
  ctx.lineWidth = trackMode === TRACK_RENDER_MODES.BLUR ? 3.8 : 2;
  tracePath();
  ctx.strokeStyle = highlightGradient;
  ctx.stroke();
  ctx.restore();
}

// Build a cache key for the tunnel path precomputations so we reuse opacity and color arrays.
function getTunnelPathCacheKey(points, paletteStops, trackMode) {
  const levelId = this.levelConfig?.id || 'unknown-level';
  const pixelRatio = Math.max(1, this.pixelRatio || 1);
  const tunnels = Array.isArray(this.tunnelSegments) ? this.tunnelSegments : [];
  const tunnelKey = tunnels.length
    ? tunnels.map((tunnel) => `${tunnel.startIndex ?? 0}-${tunnel.endIndex ?? 0}`).join('|')
    : 'none';
  const paletteKey = paletteStops
    .map((entry) => `${entry.stop}:${entry.color.r},${entry.color.g},${entry.color.b}`)
    .join('|');
  const firstPoint = points[0] || { x: 0, y: 0 };
  const lastPoint = points[points.length - 1] || { x: 0, y: 0 };
  return [
    levelId,
    `points:${points.length}:${Math.round(firstPoint.x)}:${Math.round(firstPoint.y)}:${Math.round(lastPoint.x)}:${Math.round(lastPoint.y)}`,
    `tunnels:${tunnelKey}`,
    `palette:${paletteKey}`,
    `mode:${trackMode}`,
    `pr:${pixelRatio}`,
  ].join(':');
}

// Precompute per-point tunnel opacity and palette colors to avoid per-segment work each frame.
function buildTunnelPathCache(points, paletteStops, trackMode) {
  if (!points || points.length < 2) {
    return null;
  }
  const key = getTunnelPathCacheKey.call(this, points, paletteStops, trackMode);
  if (this._tunnelPathCache?.key === key) {
    return this._tunnelPathCache;
  }
  // Initialize opacity to fully visible for every point before tunnels cut it out.
  const opacityByPoint = new Float32Array(points.length);
  opacityByPoint.fill(1);
  const tunnelSegments = Array.isArray(this.tunnelSegments) ? this.tunnelSegments : [];
  const FADE_ZONE_RATIO = 0.2;
  tunnelSegments.forEach((tunnel) => {
    const startIndex = Number.isFinite(tunnel.startIndex) ? tunnel.startIndex : 0;
    const endIndex = Number.isFinite(tunnel.endIndex) ? tunnel.endIndex : 0;
    const clampedStart = Math.max(0, Math.min(points.length - 1, startIndex));
    const clampedEnd = Math.max(0, Math.min(points.length - 1, endIndex));
    const tunnelLength = clampedEnd - clampedStart;
    // Guard against zero-length tunnels by zeroing a single point.
    if (tunnelLength <= 0) {
      opacityByPoint[clampedStart] = 0;
      return;
    }
    for (let index = clampedStart; index <= clampedEnd; index += 1) {
      const progressInTunnel = (index - clampedStart) / tunnelLength;
      let opacity = 0;
      if (progressInTunnel < FADE_ZONE_RATIO) {
        opacity = 1 - (progressInTunnel / FADE_ZONE_RATIO);
      } else if (progressInTunnel > (1 - FADE_ZONE_RATIO)) {
        opacity = (progressInTunnel - (1 - FADE_ZONE_RATIO)) / FADE_ZONE_RATIO;
      }
      opacityByPoint[index] = Math.min(opacityByPoint[index], opacity);
    }
  });
  // Cache palette samples along the path so each segment can reuse the same color.
  const colorByPoint = points.map((_, index) => {
    const pathProgress = index / (points.length - 1);
    return samplePaletteGradient(pathProgress);
  });
  this._tunnelPathCache = {
    key,
    opacityByPoint,
    colorByPoint,
  };
  return this._tunnelPathCache;
}

function drawPathWithTunnels(ctx, points, paletteStops, trackMode) {
  if (!points || points.length < 2 || !this.tunnelSegments) {
    return;
  }

  const baseAlpha = trackMode === TRACK_RENDER_MODES.BLUR ? 0.78 : 0.55;
  const highlightAlpha = trackMode === TRACK_RENDER_MODES.BLUR ? 0.32 : 0.18;
  const baseLineWidth = trackMode === TRACK_RENDER_MODES.BLUR ? 9 : 7;
  const highlightLineWidth = trackMode === TRACK_RENDER_MODES.BLUR ? 3.8 : 2;
  // Reuse precomputed opacity/color arrays so each segment renders with minimal per-frame work.
  const tunnelCache = buildTunnelPathCache.call(this, points, paletteStops, trackMode);
  const opacityByPoint = tunnelCache?.opacityByPoint;
  const colorByPoint = tunnelCache?.colorByPoint;

  // Draw path segments with varying opacity
  for (let layer = 0; layer < 2; layer += 1) {
    const isBase = layer === 0;
    const lineWidth = isBase ? baseLineWidth : highlightLineWidth;
    const alphaMultiplier = isBase ? baseAlpha : highlightAlpha;
    
    for (let i = 0; i < points.length - 1; i += 1) {
      const point = points[i];
      const nextPoint = points[i + 1];
      
      // Calculate opacity for this segment
      const startOpacity = opacityByPoint ? opacityByPoint[i] : 1;
      const endOpacity = opacityByPoint ? opacityByPoint[i + 1] : 1;
      const segmentOpacity = (startOpacity + endOpacity) * HALF;
      
      // Skip fully transparent segments
      if (segmentOpacity <= 0.01) {
        continue;
      }
      
      // Sample color based on position along path using cached values when available.
      const color = colorByPoint ? colorByPoint[i] : samplePaletteGradient(i / (points.length - 1));
      const alpha = alphaMultiplier * segmentOpacity;
      
      ctx.save();
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = lineWidth;
      
      if (isBase) {
        const shadowColor = colorToRgbaString(color, (trackMode === TRACK_RENDER_MODES.BLUR ? 0.35 : 0.2) * segmentOpacity);
        this.applyCanvasShadow(ctx, shadowColor, trackMode === TRACK_RENDER_MODES.BLUR ? 26 : 12);
      } else {
        ctx.globalAlpha = trackMode === TRACK_RENDER_MODES.BLUR ? 0.95 * segmentOpacity : segmentOpacity;
      }
      
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(nextPoint.x, nextPoint.y);
      ctx.strokeStyle = colorToRgbaString(color, alpha);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawTrackParticleRiver() {
  if (!this.ctx || !Array.isArray(this.trackRiverParticles) || !this.trackRiverParticles.length) {
    return;
  }
  const ctx = this.ctx;
  const particles = this.trackRiverParticles;
  const lowGraphicsEnabled = this.isLowGraphicsMode?.();
  const minDimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 1;
  const laneRadius = Math.max(4, minDimension * 0.014);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  particles.forEach((particle) => {
    if (!particle || !Number.isFinite(particle.progress)) {
      return;
    }
    const position = this.getPositionAlongPath(particle.progress);
    if (!position) {
      return;
    }
    const tangent = Number.isFinite(position.tangent) ? position.tangent : 0;
    const lateral = (Number.isFinite(particle.offset) ? particle.offset : 0) * laneRadius;
    const radius = Math.max(0.8, laneRadius * 0.2 * (Number.isFinite(particle.radius) ? particle.radius : 1));
    const progressColor = samplePaletteGradient(particle.progress);
    const phase = Number.isFinite(particle.phase) ? particle.phase : 0;
    const pulse = Math.sin(phase + (this.trackRiverPulse || 0)) * 0.5 + 0.5;
    const alpha = 0.18 + pulse * 0.32;
    const offsetX = Math.cos(tangent + HALF_PI) * lateral;
    const offsetY = Math.sin(tangent + HALF_PI) * lateral;
    ctx.fillStyle = colorToRgbaString(progressColor, alpha);
    this.applyCanvasShadow(ctx, colorToRgbaString(progressColor, alpha * 0.65), radius * 3.2);
    ctx.beginPath();
    ctx.arc(position.x + offsetX, position.y + offsetY, radius, 0, TWO_PI);
    ctx.fill();
  });

  // Overlay the luminous tracer sparks whenever the preference is enabled.
  if (
    // Skip tracer halos in low graphics mode to cut overlapping glow draws on weaker devices.
    !lowGraphicsEnabled &&
    areTrackTracersEnabled() &&
    Array.isArray(this.trackRiverTracerParticles) &&
    this.trackRiverTracerParticles.length
  ) {
    const tracerRadius = Math.max(1.2, laneRadius * 0.45);
    this.trackRiverTracerParticles.forEach((particle) => {
      if (!particle || !Number.isFinite(particle.progress)) {
        return;
      }
      const position = this.getPositionAlongPath(particle.progress);
      if (!position) {
        return;
      }
      const tangent = Number.isFinite(position.tangent) ? position.tangent : 0;
      const lateral = (Number.isFinite(particle.offset) ? particle.offset : 0) * laneRadius;
      const offsetX = Math.cos(tangent + HALF_PI) * lateral;
      const offsetY = Math.sin(tangent + HALF_PI) * lateral;
      const phase = Number.isFinite(particle.phase) ? particle.phase : 0;
      const pulse = Math.sin(phase + (this.trackRiverPulse || 0) * 1.4) * 0.5 + 0.5;
      const glowAlpha = 0.45 + pulse * 0.45;
      const haloAlpha = 0.25 + pulse * 0.35;
      const radius = tracerRadius * (0.9 + pulse * 0.45);
      const x = position.x + offsetX;
      const y = position.y + offsetY;

      this.applyCanvasShadow(
        ctx,
        colorToRgbaString(TRACK_TRACER_HALO_COLOR, haloAlpha),
        radius * 3.6,
      );
      ctx.beginPath();
      ctx.fillStyle = colorToRgbaString(TRACK_TRACER_PRIMARY_COLOR, glowAlpha);
      ctx.arc(x, y, radius, 0, TWO_PI);
      ctx.fill();
      ctx.lineWidth = Math.max(radius * 0.55, 1.2);
      ctx.strokeStyle = colorToRgbaString(
        TRACK_TRACER_HALO_COLOR,
        Math.min(1, glowAlpha + 0.25),
      );
      ctx.stroke();
    });
  }
  ctx.restore();
}

function drawArcLight() {
  if (!this.ctx || !this.pathSegments.length || this.pathPoints.length < 2) {
    return;
  }
  const trackMode = getTrackRenderMode();
  if (trackMode === TRACK_RENDER_MODES.RIVER) {
    // The river track effect replaces the solid path lines, so skip the arc tracer.
    return;
  }
  if (this.isLowGraphicsMode?.()) {
    // Dropping the tracer overlay in low fidelity reduces per-frame fill and shadow work.
    return;
  }
  if (!areTrackTracersEnabled()) {
    return;
  }
  const ctx = this.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = colorToRgbaString(TRACK_TRACER_PRIMARY_COLOR, 0.7);
  ctx.setLineDash([this.pathLength * 0.12, this.pathLength * 0.18]);
  ctx.lineDashOffset = this.arcOffset;
  ctx.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
  for (let index = 1; index < this.pathPoints.length; index += 1) {
    const point = this.pathPoints[index];
    ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
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

function drawEnemyGateSymbol(ctx, position) {
  if (!ctx || !position) {
    return;
  }

  const dimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 0;
  const baseRadius = dimension ? dimension * 0.028 : 0;
  const baseSize = Math.max(12, Math.min(20, baseRadius || 16));
  const radius = baseSize * 2 * TRACK_GATE_SIZE_SCALE * ENEMY_GATE_SYMBOL_SCALE;

  ctx.save();
  const anchorX = Math.round(position.x);
  const anchorY = Math.round(position.y);
  // Snap to whole pixels so the enlarged gate stays centered on the path anchor.
  ctx.translate(anchorX, anchorY);

  const glow = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 1.2);
  glow.addColorStop(0, 'rgba(74, 240, 255, 0.42)');
  glow.addColorStop(1, 'rgba(15, 27, 63, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.1, 0, TWO_PI);
  ctx.fill();

  const spriteReady = enemyGateSprite?.complete && enemyGateSprite.naturalWidth > 0;
  if (spriteReady) {
    const spriteSize = Math.max(baseSize * 2, 40) * 2 * TRACK_GATE_SIZE_SCALE * ENEMY_GATE_SYMBOL_SCALE;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(enemyGateSprite, -spriteSize * HALF, -spriteSize * HALF, spriteSize, spriteSize);
    ctx.restore();
  } else {
    this.applyCanvasShadow(ctx, 'rgba(74, 240, 255, 0.6)', radius * 0.6);
    ctx.strokeStyle = 'rgba(202, 245, 255, 0.8)';
    ctx.lineWidth = Math.max(1.6, radius * 0.14);
    ctx.beginPath();
    ctx.moveTo(-radius * 0.72, -radius * 0.1);
    ctx.quadraticCurveTo(0, -radius * 0.8, radius * 0.72, -radius * 0.1);
    ctx.quadraticCurveTo(0, radius * 0.6, -radius * 0.72, -radius * 0.1);
    ctx.stroke();
  }

  ctx.restore();
}

function drawMindGateSymbol(ctx, position) {
  if (!ctx || !position) {
    return;
  }

  const dimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 0;
  const baseRadius = dimension ? dimension * 0.035 : 0;
  const baseSize = Math.max(14, Math.min(24, baseRadius || 18));
  const radius = baseSize * 2 * TRACK_GATE_SIZE_SCALE;

  ctx.save();
  ctx.translate(position.x, position.y);

  const glow = ctx.createRadialGradient(0, 0, radius * 0.22, 0, 0, radius);
  glow.addColorStop(0, 'rgba(255, 248, 220, 0.9)');
  glow.addColorStop(0.55, 'rgba(255, 196, 150, 0.35)');
  glow.addColorStop(1, 'rgba(139, 247, 255, 0.18)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TWO_PI);
  ctx.fill();

  this.applyCanvasShadow(ctx, 'rgba(255, 228, 120, 0.55)', radius);
  ctx.strokeStyle = 'rgba(255, 228, 120, 0.85)';
  ctx.lineWidth = Math.max(2, radius * 0.12);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.88, 0, TWO_PI);
  ctx.stroke();

  // Draw the consciousness wavelength - a sine wave that fluctuates through the gate.
  const gateIntegrity = Math.max(0, Math.floor(this.lives || 0));
  const maxIntegrity = Math.max(
    gateIntegrity,
    Math.floor(this.levelConfig?.lives || gateIntegrity || 1),
  );
  // Calculate health percentage to scale wave amplitude.
  const healthPercentage = maxIntegrity > 0 ? gateIntegrity / maxIntegrity : 1;

  // Use performance timestamp if available to ensure consistent animation timing.
  const currentTime = (this.lastRenderTime !== undefined ? this.lastRenderTime : Date.now()) / 1000;
  const waveOffset = currentTime * CONSCIOUSNESS_WAVE_SPEED;

  // Draw consciousness wave through the gate.
  const waveWidth = radius * CONSCIOUSNESS_WAVE_WIDTH_SCALE;
  const waveHeight = radius * CONSCIOUSNESS_WAVE_HEIGHT_SCALE * healthPercentage;

  ctx.save();
  ctx.beginPath();

  // Generate sine wave with varying amplitudes for each peak.
  for (let i = 0; i <= CONSCIOUSNESS_WAVE_POINTS; i++) {
    const x = -waveWidth * HALF + (i / CONSCIOUSNESS_WAVE_POINTS) * waveWidth;
    const normalizedX = (i / CONSCIOUSNESS_WAVE_POINTS) * CONSCIOUSNESS_WAVE_PEAKS * TWO_PI;

    // Base sine wave.
    let y = Math.sin(normalizedX + waveOffset) * waveHeight;

    // Add amplitude variation per peak to create dynamic effect.
    const peakIndex = Math.floor((i / CONSCIOUSNESS_WAVE_POINTS) * CONSCIOUSNESS_WAVE_PEAKS);
    const peakPhase = (peakIndex * CONSCIOUSNESS_WAVE_PEAK_PHASE_SCALE + currentTime * CONSCIOUSNESS_WAVE_PEAK_TIME_SCALE) % (TWO_PI);
    const peakAmplitudeMod = CONSCIOUSNESS_WAVE_AMPLITUDE_MIN + CONSCIOUSNESS_WAVE_AMPLITUDE_RANGE * Math.sin(peakPhase);
    y *= peakAmplitudeMod;

    // Add secondary harmonic for more organic feel.
    y += Math.sin(normalizedX * 2 + waveOffset * 1.5) * waveHeight * CONSCIOUSNESS_WAVE_HARMONIC_SCALE;

    // Add subtle fluctuation to make it feel alive.
    const fluctuation = Math.sin(currentTime * CONSCIOUSNESS_WAVE_FLUCTUATION_SPEED + i * 0.1) * waveHeight * CONSCIOUSNESS_WAVE_FLUCTUATION_SCALE;
    y += fluctuation;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  // Keep the consciousness wave in a deep orange with 50% transparency.
  const waveAlpha = 0.5 * healthPercentage;
  const waveColor = { r: 255, g: 120, b: 0 };

  // Create gradient for the wave.
  const waveGradient = ctx.createLinearGradient(-waveWidth * HALF, 0, waveWidth * HALF, 0);
  waveGradient.addColorStop(0, `rgba(${waveColor.r}, ${waveColor.g}, ${waveColor.b}, 0)`);
  waveGradient.addColorStop(0.2, `rgba(${waveColor.r}, ${waveColor.g}, ${waveColor.b}, ${waveAlpha * 0.7})`);
  waveGradient.addColorStop(0.5, `rgba(${waveColor.r}, ${waveColor.g}, ${waveColor.b}, ${waveAlpha})`);
  waveGradient.addColorStop(0.8, `rgba(${waveColor.r}, ${waveColor.g}, ${waveColor.b}, ${waveAlpha * 0.7})`);
  waveGradient.addColorStop(1, `rgba(${waveColor.r}, ${waveColor.g}, ${waveColor.b}, 0)`);

  ctx.strokeStyle = waveGradient;
  ctx.lineWidth = Math.max(CONSCIOUSNESS_WAVE_LINE_WIDTH_MIN, radius * CONSCIOUSNESS_WAVE_LINE_WIDTH_SCALE);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Add glow effect to the wave.
  ctx.shadowColor = `rgba(${waveColor.r}, ${waveColor.g}, ${waveColor.b}, ${waveAlpha})`;
  ctx.shadowBlur = radius * CONSCIOUSNESS_WAVE_SHADOW_BLUR_SCALE;
  ctx.stroke();

  // Draw second layer for enhanced visibility with explicit alpha management.
  ctx.save();
  ctx.globalAlpha = CONSCIOUSNESS_WAVE_LAYER2_ALPHA;
  ctx.lineWidth = Math.max(CONSCIOUSNESS_WAVE_LAYER2_LINE_WIDTH_MIN, radius * CONSCIOUSNESS_WAVE_LAYER2_LINE_WIDTH_SCALE);
  ctx.shadowBlur = radius * CONSCIOUSNESS_WAVE_LAYER2_SHADOW_BLUR_SCALE;
  ctx.stroke();
  ctx.restore();

  ctx.restore();

  const spriteReady = mindGateSprite?.complete && mindGateSprite.naturalWidth > 0;
  if (spriteReady) {
    const spriteSize = Math.max(baseSize * 2.1, 46) * 2 * TRACK_GATE_SIZE_SCALE;
    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.drawImage(mindGateSprite, -spriteSize * HALF, -spriteSize * HALF, spriteSize, spriteSize);
    ctx.restore();
  } else {
    this.applyCanvasShadow(ctx, 'rgba(139, 247, 255, 0.55)', radius * 0.7);
    ctx.strokeStyle = 'rgba(139, 247, 255, 0.85)';
    ctx.lineWidth = Math.max(1.4, radius * 0.12);
    ctx.beginPath();
    ctx.moveTo(0, radius * 0.64);
    ctx.lineTo(0, -radius * 0.6);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 228, 120, 0.92)';
    this.applyCanvasShadow(ctx, 'rgba(255, 228, 120, 0.55)', radius * 0.8);
    ctx.lineWidth = Math.max(1.6, radius * 0.14);
    ctx.beginPath();
    const gateWidth = radius * 0.58;
    const gateBase = radius * 0.62;
    ctx.moveTo(-gateWidth, gateBase);
    ctx.lineTo(-gateWidth, -radius * 0.18);
    ctx.quadraticCurveTo(0, -radius * 0.95, gateWidth, -radius * 0.18);
    ctx.lineTo(gateWidth, gateBase);
    ctx.stroke();
  }

  const gateExponentSource = gateIntegrity > 0 ? gateIntegrity : maxIntegrity || 1;
  const gateExponent = this.calculateHealthExponent(gateExponentSource);
  const palette =
    typeof this.getEffectiveMotePalette === 'function'
      ? this.getEffectiveMotePalette()
      : null;
  const paletteStops = resolvePaletteColorStops(palette);
  const gradient = ctx.createLinearGradient(-radius, -radius, radius, radius);
  if (Array.isArray(paletteStops) && paletteStops.length) {
    const denominator = Math.max(1, paletteStops.length - 1);
    paletteStops.forEach((stop, index) => {
      const offset = Math.max(0, Math.min(1, index / denominator));
      gradient.addColorStop(offset, colorToRgbaString(stop, 1));
    });
  }
  ctx.font = `${Math.round(Math.max(14, radius * 0.82))}px "Cormorant Garamond", serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = gradient;
  const highlightColor = paletteStops[paletteStops.length - 1] || paletteStops[0];
  this.applyCanvasShadow(ctx, colorToRgbaString(highlightColor, 0.85), Math.max(14, radius * 0.95));
  const exponentOffset = radius * 0.78;
  const exponentX = exponentOffset;
  const exponentY = -exponentOffset * 0.88;
  ctx.fillText(gateExponent.toFixed(1), exponentX, exponentY);

  ctx.restore();
}

function drawNodes() {
  if (!this.ctx || !this.pathSegments.length) {
    return;
  }
  const ctx = this.ctx;
  const startPoint = this.pathPoints.length ? this.pathPoints[0] : this.pathSegments[0].start;
  const endPoint = this.pathPoints.length
    ? this.pathPoints[this.pathPoints.length - 1]
    : this.pathSegments[this.pathSegments.length - 1].end;
  this.drawEnemyGateSymbol(ctx, startPoint);
  this.drawMindGateSymbol(ctx, endPoint);
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
