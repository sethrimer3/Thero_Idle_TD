// TrackRenderer.js - Path track, arc tracer, and gate/node rendering layer
// Extracted from CanvasRenderer.js as part of Phase 2.2.6 (Build 490)

import { samplePaletteGradient } from '../../../colorSchemeUtils.js';
import { colorToRgbaString, resolvePaletteColorStops } from '../../../../scripts/features/towers/powderTower.js';
import { getTrackRenderMode, TRACK_RENDER_MODES, areTrackTracersEnabled } from '../../../preferences.js';

// Pre-calculated constants for performance optimization in tight render loops
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const HALF = 0.5;

// Gate sprite assets loaded eagerly so they are ready before first render.
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

export {
  drawPathLayerCache,
  drawPath,
  drawArcLight,
  drawEnemyGateSymbol,
  drawMindGateSymbol,
  drawNodes,
};
