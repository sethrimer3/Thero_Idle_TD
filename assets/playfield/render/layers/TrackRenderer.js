// TrackRenderer.js - Path track, arc tracer, and gate/node rendering layer
// Extracted from CanvasRenderer.js as part of Phase 2.2.6 (Build 490)

import { samplePaletteGradient } from '../../../colorSchemeUtils.js';
import { colorToRgbaString, resolvePaletteColorStops } from '../../../../scripts/features/towers/powderTower.js';
import { getTrackRenderMode, TRACK_RENDER_MODES, areTrackTracersEnabled } from '../../../preferences.js';

// Pre-calculated constants for performance optimization in tight render loops
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const HALF = 0.5;
// Treat high-DPI playfields as an effects budget signal because every glow/blit costs more fill-rate.
const HIGH_DPI_EFFECT_PIXEL_RATIO = 1.5;
// Apply a stronger reduction on very dense displays where layered particles become especially expensive.
const ULTRA_DPI_EFFECT_PIXEL_RATIO = 2.5;

// Gate sprite assets loaded eagerly so they are ready before first render.
// Using PNG symbol sprites uploaded to the gates&track sprite folder.
const MIND_GATE_SPRITE_URL = 'assets/sprites/gates%26track/mindGate/mindGateSymbol.png';
const mindGateSprite = new Image();
mindGateSprite.src = MIND_GATE_SPRITE_URL;
mindGateSprite.decoding = 'async';
mindGateSprite.loading = 'eager';

const ENEMY_GATE_SPRITE_URL = 'assets/sprites/gates%26track/enemyGate/enemyGateSymbol.png';
const enemyGateSprite = new Image();
enemyGateSprite.src = ENEMY_GATE_SPRITE_URL;
enemyGateSprite.decoding = 'async';
enemyGateSprite.loading = 'eager';

// Shadow Gate background layers animate as alternating clockwise/counter-clockwise rings.
const SHADOW_GATE_BACKGROUND_LAYERS = [
  { url: 'assets/sprites/gates%26track/enemyGate/gateBackground/ShadowGateBackgroundLayer%20(1).png', speed: 0, direction: 1 },
  { url: 'assets/sprites/gates%26track/enemyGate/gateBackground/ShadowGateBackgroundLayer%20(2).png', speed: 0.1, direction: 1 },
  { url: 'assets/sprites/gates%26track/enemyGate/gateBackground/ShadowGateBackgroundLayer%20(3).png', speed: 0.1, direction: -1 },
  { url: 'assets/sprites/gates%26track/enemyGate/gateBackground/ShadowGateBackgroundLayer%20(4).png', speed: 0.2, direction: 1 },
  { url: 'assets/sprites/gates%26track/enemyGate/gateBackground/ShadowGateBackgroundLayer%20(5).png', speed: 0.2, direction: -1 },
  { url: 'assets/sprites/gates%26track/enemyGate/gateBackground/ShadowGateBackgroundLayer%20(6).png', speed: 0.3, direction: 1 },
  { url: 'assets/sprites/gates%26track/enemyGate/gateBackground/ShadowGateBackgroundLayer%20(7).png', speed: 0.3, direction: -1 },
].map((entry) => {
  // Preload each ring sprite once so per-frame rendering only performs blits.
  const image = new Image();
  image.src = entry.url;
  image.decoding = 'async';
  image.loading = 'eager';
  return {
    ...entry,
    image,
  };
});

// Mind Gate background layers spin in alternating directions with progressively faster outer rings.
const MIND_GATE_BACKGROUND_LAYERS = [
  { url: 'assets/sprites/gates%26track/mindGate/gateBackground/MindGateBackgroundLayer%20(1).png', speed: 0.1, direction: 1 },
  { url: 'assets/sprites/gates%26track/mindGate/gateBackground/MindGateBackgroundLayer%20(2).png', speed: 0.1, direction: -1 },
  { url: 'assets/sprites/gates%26track/mindGate/gateBackground/MindGateBackgroundLayer%20(3).png', speed: 0.2, direction: 1 },
  { url: 'assets/sprites/gates%26track/mindGate/gateBackground/MindGateBackgroundLayer%20(4).png', speed: 0.2, direction: -1 },
  { url: 'assets/sprites/gates%26track/mindGate/gateBackground/MindGateBackgroundLayer%20(5).png', speed: 0.3, direction: 1 },
  { url: 'assets/sprites/gates%26track/mindGate/gateBackground/MindGateBackgroundLayer%20(6).png', speed: 0.3, direction: -1 },
  { url: 'assets/sprites/gates%26track/mindGate/gateBackground/MindGateBackgroundLayer%20(7).png', speed: 0.4, direction: 1 },
  { url: 'assets/sprites/gates%26track/mindGate/gateBackground/MindGateBackgroundLayer%20(8).png', speed: 0.4, direction: -1 },
].map((entry) => {
  // Preload each ring sprite once so per-frame rendering only performs blits.
  const image = new Image();
  image.src = entry.url;
  image.decoding = 'async';
  image.loading = 'eager';
  return {
    ...entry,
    image,
  };
});

const TRACK_GATE_SIZE_SCALE = 0.5;
// Scale the enemy gate glyph up so the spawn marker remains legible at a glance.
const ENEMY_GATE_SYMBOL_SCALE = 2;
// Keep the mind gate aura compact so the core marker reads crisply without flooding nearby terrain.
const MIND_GATE_GLOW_RADIUS_SCALE = 0.72;
// Add a subtle inversion halo to the enemy gate so it feels like a dark void in the field.
const ENEMY_GATE_ANTIGLOW_RADIUS_SCALE = 0.68;
// Reduce the visible Shadow Gate symbol footprint by 50% while keeping its aura readable.
const SHADOW_GATE_SYMBOL_SIZE_MULTIPLIER = 0.5;
// Reuse the same warm palette that powers the luminous arc tracer.
const TRACK_TRACER_PRIMARY_COLOR = { r: 255, g: 180, b: 105 };
const TRACK_TRACER_HALO_COLOR = { r: 255, g: 228, b: 180 };
// Consciousness wave configuration for the Mind Gate visualization.
const CONSCIOUSNESS_WAVE_SPEED = 2; // Speed of wave movement
const CONSCIOUSNESS_WAVE_WIDTH_SCALE = 2.4; // Wave extends beyond gate
const CONSCIOUSNESS_WAVE_HEIGHT_SCALE = 0.5; // Base amplitude relative to radius
const CONSCIOUSNESS_WAVE_PEAKS = 3; // Number of complete sine waves
const CONSCIOUSNESS_WAVE_POINTS = 80; // Number of points for smooth curve
// Preserve a readable wave silhouette in low graphics mode with half the original point count.
const CONSCIOUSNESS_WAVE_LOW_GRAPHICS_SCALE = 0.5;
// Retain more of the original curve on high-DPI displays because the gate is still shown at full size.
const CONSCIOUSNESS_WAVE_HIGH_DPI_SCALE = 0.6;
// Trim the wave more aggressively on ultra-dense displays where overdraw costs climb fastest.
const CONSCIOUSNESS_WAVE_ULTRA_DPI_SCALE = 0.5;
// Never reduce the wave below this floor in low graphics mode so it still reads as a sine band.
const CONSCIOUSNESS_WAVE_LOW_GRAPHICS_MIN_POINTS = 32;
// Keep a slightly higher floor for high-DPI displays to avoid a visibly polygonal gate wave.
const CONSCIOUSNESS_WAVE_HIGH_DPI_MIN_POINTS = 40;
// Allow the strongest high-DPI reduction while preserving the gate's overall light signature.
const CONSCIOUSNESS_WAVE_ULTRA_DPI_MIN_POINTS = 32;
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

// Reduced from 30 → 18 particles per gate for a ~40% cut in per-frame work while keeping the visual halo.
const GATE_PARTICLE_COUNT = 18;
// Bound particle movement to a compact halo around each gate so the effect remains readable.
const GATE_PARTICLE_MAX_RADIUS_SCALE = 1.16;
// Ensure every particle keeps drifting even when center pull would otherwise stall it.
const GATE_PARTICLE_MIN_SPEED = 7.5;
// Constrain particle speed to avoid jitter and preserve smooth movement.
const GATE_PARTICLE_MAX_SPEED = 34;
// Tune gravity-like center pull strength for natural orbital wobble.
const GATE_PARTICLE_CENTER_PULL = 52;
// Add low-amplitude noise force to make trajectories unpredictable but stable.
const GATE_PARTICLE_NOISE_FORCE = 18;
// Keep long frame hitches from exploding velocities when tabs regain focus.
const GATE_PARTICLE_MAX_DT = 0.05;
// Render each cached blurred particle with a shared base sprite size for consistent softness.
const GATE_PARTICLE_SPRITE_SIZE = 32;
// Pre-render a small cache of particle radii so runtime draws only blit images.
const GATE_PARTICLE_SIZE_VARIANTS = [3, 4.5, 6];
// Number of pre-tinted color buckets baked into the sprite cache; eliminates per-particle source-atop tinting.
const GATE_PARTICLE_COLOR_BUCKETS = 8;
// Pre-calculated max index for color bucket mapping used in both cache build and per-frame draw.
const GATE_PARTICLE_MAX_COLOR_INDEX = GATE_PARTICLE_COLOR_BUCKETS - 1;
// Reduce the gate particle budget on dense displays while preserving a readable halo.
const GATE_PARTICLE_HIGH_DPI_COUNT = 9;
// Trim even more particles on very dense displays to curb per-frame sprite blits.
const GATE_PARTICLE_ULTRA_DPI_COUNT = 7;
// Define the warm distance gradient for Mind Gate particles (center -> outer ring).
const MIND_GATE_GRADIENT_STOPS = [
  { stop: 0, color: [140, 72, 16] },
  { stop: 0.55, color: [232, 166, 52] },
  { stop: 1, color: [255, 247, 196] },
];
// Define the shadow gradient for Enemy Gate particles (center -> outer ring).
const ENEMY_GATE_GRADIENT_STOPS = [
  { stop: 0, color: [6, 6, 12] },
  { stop: 0.55, color: [56, 20, 98] },
  { stop: 1, color: [214, 184, 255] },
];

/**
 * Cache the per-frame effect quality profile so gate and path effects can share the same reduction rules.
 * @this {{
 *   _frameCache?: { trackEffectDetailProfile?: object },
 *   pixelRatio?: number,
 *   isLowGraphicsMode?: () => boolean
 * }}
 * @returns {{
 *   highDpiEffectsEnabled: boolean,
 *   ultraDpiEffectsEnabled: boolean,
 *   backgroundLayerStride: number,
 *   pathParticleStride: number,
 *   tracerParticleStride: number,
 *   gateParticleCount: number,
 *   wavePointCount: number
 * }}
 */
function getTrackEffectDetailProfile() {
  const cachedProfile = this?._frameCache?.trackEffectDetailProfile;
  if (cachedProfile && typeof cachedProfile === 'object') {
    return cachedProfile;
  }
  const pixelRatio = Math.max(1, this?.pixelRatio || 1);
  const lowGraphicsEnabled = Boolean(this?.isLowGraphicsMode?.());
  const highDpiEffectsEnabled = pixelRatio >= HIGH_DPI_EFFECT_PIXEL_RATIO;
  const ultraDpiEffectsEnabled = pixelRatio >= ULTRA_DPI_EFFECT_PIXEL_RATIO;
  let wavePointCount = CONSCIOUSNESS_WAVE_POINTS;
  if (lowGraphicsEnabled) {
    wavePointCount = Math.max(
      CONSCIOUSNESS_WAVE_LOW_GRAPHICS_MIN_POINTS,
      Math.round(CONSCIOUSNESS_WAVE_POINTS * CONSCIOUSNESS_WAVE_LOW_GRAPHICS_SCALE),
    );
  } else if (ultraDpiEffectsEnabled) {
    wavePointCount = Math.max(
      CONSCIOUSNESS_WAVE_ULTRA_DPI_MIN_POINTS,
      Math.round(CONSCIOUSNESS_WAVE_POINTS * CONSCIOUSNESS_WAVE_ULTRA_DPI_SCALE),
    );
  } else if (highDpiEffectsEnabled) {
    wavePointCount = Math.max(
      CONSCIOUSNESS_WAVE_HIGH_DPI_MIN_POINTS,
      Math.round(CONSCIOUSNESS_WAVE_POINTS * CONSCIOUSNESS_WAVE_HIGH_DPI_SCALE),
    );
  }
  const profile = {
    highDpiEffectsEnabled,
    ultraDpiEffectsEnabled,
    // Dense displays and low-graphics mode both benefit from drawing fewer rotating backdrop layers.
    backgroundLayerStride: lowGraphicsEnabled || ultraDpiEffectsEnabled ? 3 : highDpiEffectsEnabled ? 2 : 1,
    // River particles are pure eye candy, so halve their draw density when fill-rate is under pressure.
    pathParticleStride: lowGraphicsEnabled || ultraDpiEffectsEnabled ? 3 : highDpiEffectsEnabled ? 2 : 1,
    // Keep tracer sparks a bit denser than the base river, but still skip half on dense displays.
    tracerParticleStride: ultraDpiEffectsEnabled ? 3 : highDpiEffectsEnabled ? 2 : 1,
    // Reduce gate particle simulation count only when the screen density itself makes blits costlier.
    gateParticleCount: ultraDpiEffectsEnabled
      ? GATE_PARTICLE_ULTRA_DPI_COUNT
      : highDpiEffectsEnabled
        ? GATE_PARTICLE_HIGH_DPI_COUNT
        : GATE_PARTICLE_COUNT,
    // Use fewer line segments for the Mind Gate wave on dense displays where sub-pixel detail is hard to perceive.
    wavePointCount,
  };
  if (this?._frameCache) {
    this._frameCache.trackEffectDetailProfile = profile;
  }
  return profile;
}

// Draw layered gate background sprites with independent angular velocities.
function drawGateBackgroundLayers(ctx, layers, baseDrawSize, currentTime, globalAlpha = 0.9, layerStride = 1) {
  if (!ctx || !Array.isArray(layers) || !layers.length || !Number.isFinite(baseDrawSize) || baseDrawSize <= 0) {
    return;
  }
  const stride = Math.max(1, layerStride);
  for (let layerIndex = 0; layerIndex < layers.length; layerIndex += stride) {
    const layer = layers[layerIndex];
    const sprite = layer?.image;
    if (!sprite?.complete || !Number.isFinite(sprite.naturalWidth) || sprite.naturalWidth <= 0) {
      continue;
    }
    const rotation = currentTime * (layer.speed || 0) * (layer.direction || 1);
    ctx.save();
    ctx.rotate(rotation);
    ctx.globalAlpha = globalAlpha;
    ctx.drawImage(sprite, -baseDrawSize * HALF, -baseDrawSize * HALF, baseDrawSize, baseDrawSize);
    ctx.restore();
  }
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
  const effectDetailProfile = getTrackEffectDetailProfile.call(this);
  const minDimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 1;
  const laneRadius = Math.max(4, minDimension * 0.014);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let particleIndex = 0; particleIndex < particles.length; particleIndex += effectDetailProfile.pathParticleStride) {
    const particle = particles[particleIndex];
    if (!particle || !Number.isFinite(particle.progress)) {
      continue;
    }
    const position = this.getPositionAlongPath(particle.progress);
    if (!position) {
      continue;
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
  }

  // Overlay the luminous tracer sparks whenever the preference is enabled.
  if (
    // Skip tracer halos in low graphics mode to cut overlapping glow draws on weaker devices.
    !lowGraphicsEnabled &&
    areTrackTracersEnabled() &&
    Array.isArray(this.trackRiverTracerParticles) &&
    this.trackRiverTracerParticles.length
  ) {
    const tracerRadius = Math.max(1.2, laneRadius * 0.45);
    for (let tracerIndex = 0; tracerIndex < this.trackRiverTracerParticles.length; tracerIndex += effectDetailProfile.tracerParticleStride) {
      const particle = this.trackRiverTracerParticles[tracerIndex];
      if (!particle || !Number.isFinite(particle.progress)) {
        continue;
      }
      const position = this.getPositionAlongPath(particle.progress);
      if (!position) {
        continue;
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
    }
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

// Interpolate between two RGB colors and return a fresh tuple for gradient sampling.
function lerpColor(colorA, colorB, t) {
  return [
    Math.round(colorA[0] + (colorB[0] - colorA[0]) * t),
    Math.round(colorA[1] + (colorB[1] - colorA[1]) * t),
    Math.round(colorA[2] + (colorB[2] - colorA[2]) * t),
  ];
}

// Resolve a smooth gradient color by normalized radius distance from gate center.
function sampleGateParticleGradient(stops, normalizedDistance) {
  const clampedDistance = Math.max(0, Math.min(1, normalizedDistance));
  for (let index = 1; index < stops.length; index += 1) {
    const previousStop = stops[index - 1];
    const nextStop = stops[index];
    if (clampedDistance <= nextStop.stop) {
      const denominator = Math.max(1e-6, nextStop.stop - previousStop.stop);
      const blend = Math.max(0, Math.min(1, (clampedDistance - previousStop.stop) / denominator));
      return lerpColor(previousStop.color, nextStop.color, blend);
    }
  }
  return stops[stops.length - 1].color;
}

// Build cached pre-tinted blurred particle sprites for a specific gradient so per-frame draws only blit images.
// Returns a nested array [sizeVariantIndex][colorBucketIndex] → { radius, canvas, drawSize }.
function buildGateParticleSpriteCache(gradientStops) {
  const spriteCache = [];
  GATE_PARTICLE_SIZE_VARIANTS.forEach((radius) => {
    const colorVariants = [];
    for (let bucket = 0; bucket < GATE_PARTICLE_COLOR_BUCKETS; bucket += 1) {
      const normalizedDistance = bucket / Math.max(1, GATE_PARTICLE_MAX_COLOR_INDEX);
      const [r, g, b] = sampleGateParticleGradient(gradientStops, normalizedDistance);
      const canvas = document.createElement('canvas');
      canvas.width = GATE_PARTICLE_SPRITE_SIZE;
      canvas.height = GATE_PARTICLE_SPRITE_SIZE;
      const cacheCtx = canvas.getContext('2d');
      if (!cacheCtx) {
        colorVariants.push(null);
        continue;
      }
      const center = GATE_PARTICLE_SPRITE_SIZE * HALF;
      cacheCtx.clearRect(0, 0, GATE_PARTICLE_SPRITE_SIZE, GATE_PARTICLE_SPRITE_SIZE);
      // Render the blurred soft circle.
      cacheCtx.filter = `blur(${Math.max(1.4, radius * 0.5)}px)`;
      cacheCtx.beginPath();
      cacheCtx.arc(center, center, radius, 0, TWO_PI);
      cacheCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      cacheCtx.fill();
      cacheCtx.filter = 'none';
      // Tint with the gradient color once here (source-atop), so runtime draws skip this step entirely.
      cacheCtx.globalCompositeOperation = 'source-atop';
      cacheCtx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.95)`;
      cacheCtx.fillRect(0, 0, GATE_PARTICLE_SPRITE_SIZE, GATE_PARTICLE_SPRITE_SIZE);
      colorVariants.push({ radius, canvas, drawSize: radius * 4.2 });
    }
    spriteCache.push(colorVariants);
  });
  return spriteCache;
}

// Lazily initialize particle state and per-gate tinted sprite cache to minimize startup work.
function ensureGateParticleSystem(systemKey, gateRadius, swirlDirection, gradientStops) {
  const spriteCacheKey = `${systemKey}_spriteCache`;
  if (!this[spriteCacheKey]) {
    this[spriteCacheKey] = buildGateParticleSpriteCache(gradientStops);
  }
  const spriteCache = this[spriteCacheKey];
  const targetParticleCount = getTrackEffectDetailProfile.call(this).gateParticleCount;
  if (!this[systemKey]?.particles || this[systemKey].targetParticleCount !== targetParticleCount) {
    const maxRadius = Math.max(2, gateRadius * GATE_PARTICLE_MAX_RADIUS_SCALE);
    const particles = [];
    for (let particleIndex = 0; particleIndex < targetParticleCount; particleIndex += 1) {
      const distance = maxRadius * Math.sqrt((particleIndex + 0.5) / targetParticleCount);
      const angle = Math.random() * TWO_PI;
      const tangentX = -Math.sin(angle) * swirlDirection;
      const tangentY = Math.cos(angle) * swirlDirection;
      const baseSpeed = GATE_PARTICLE_MIN_SPEED + Math.random() * 8;
      particles.push({
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        vx: tangentX * baseSpeed,
        vy: tangentY * baseSpeed,
        noisePhase: Math.random() * TWO_PI,
        noiseSpeed: 0.55 + Math.random() * 1.35,
        sizeIndex: particleIndex % spriteCache.length,
      });
    }
    this[systemKey] = {
      particles,
      lastTime: null,
      radius: maxRadius,
      swirlDirection,
      spriteCache,
      targetParticleCount,
    };
  } else {
    this[systemKey].radius = Math.max(2, gateRadius * GATE_PARTICLE_MAX_RADIUS_SCALE);
    this[systemKey].swirlDirection = swirlDirection;
    this[systemKey].targetParticleCount = targetParticleCount;
  }
  return this[systemKey];
}

// Integrate one particle frame with center attraction + tangential flow + minimum speed floor.
function updateGateParticleParticle(particle, dt, systemRadius, swirlDirection, currentTime) {
  const distance = Math.max(1e-4, Math.hypot(particle.x, particle.y));
  const dirX = particle.x / distance;
  const dirY = particle.y / distance;
  const tangentX = -dirY * swirlDirection;
  const tangentY = dirX * swirlDirection;
  const inwardForce = -GATE_PARTICLE_CENTER_PULL * Math.min(1.35, distance / systemRadius);
  const noiseAngle = particle.noisePhase + currentTime * particle.noiseSpeed;
  const noiseX = Math.cos(noiseAngle);
  const noiseY = Math.sin(noiseAngle);
  const accelerationX = dirX * inwardForce + tangentX * (GATE_PARTICLE_CENTER_PULL * 0.34) + noiseX * GATE_PARTICLE_NOISE_FORCE;
  const accelerationY = dirY * inwardForce + tangentY * (GATE_PARTICLE_CENTER_PULL * 0.34) + noiseY * GATE_PARTICLE_NOISE_FORCE;
  particle.vx += accelerationX * dt;
  particle.vy += accelerationY * dt;
  const speed = Math.hypot(particle.vx, particle.vy);
  if (speed < GATE_PARTICLE_MIN_SPEED) {
    const floorScale = GATE_PARTICLE_MIN_SPEED / Math.max(speed, 1e-6);
    particle.vx *= floorScale;
    particle.vy *= floorScale;
  } else if (speed > GATE_PARTICLE_MAX_SPEED) {
    const clampScale = GATE_PARTICLE_MAX_SPEED / speed;
    particle.vx *= clampScale;
    particle.vy *= clampScale;
  }
  particle.x += particle.vx * dt;
  particle.y += particle.vy * dt;
  const updatedDistance = Math.hypot(particle.x, particle.y);
  if (updatedDistance > systemRadius) {
    const wrapScale = systemRadius / Math.max(updatedDistance, 1e-6);
    particle.x *= wrapScale;
    particle.y *= wrapScale;
    particle.vx *= 0.84;
    particle.vy *= 0.84;
  }
}

// Draw one gate particle field using pre-tinted sprites; composite operations are set once per gate draw.
function drawGateParticleField(ctx, radius, currentTime, systemKey, gradientStops, swirlDirection) {
  const system = ensureGateParticleSystem.call(this, systemKey, radius, swirlDirection, gradientStops);
  const previousTime = Number.isFinite(system.lastTime) ? system.lastTime : currentTime;
  const dt = Math.max(0, Math.min(GATE_PARTICLE_MAX_DT, currentTime - previousTime));
  system.lastTime = currentTime;
  const spriteCache = system.spriteCache;
  if (!Array.isArray(spriteCache) || !spriteCache.length) {
    return;
  }
  // Set composite once for all particles; each particle only needs globalAlpha + drawImage.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let index = 0; index < system.particles.length; index += 1) {
    const particle = system.particles[index];
    updateGateParticleParticle(particle, dt, system.radius, system.swirlDirection, currentTime);
    const particleDistance = Math.hypot(particle.x, particle.y);
    const normalizedDistance = Math.max(0, Math.min(1, particleDistance / Math.max(1e-6, system.radius)));
    const colorBucket = Math.round(normalizedDistance * GATE_PARTICLE_MAX_COLOR_INDEX);
    const sizeVariants = spriteCache[particle.sizeIndex % spriteCache.length];
    const sprite = sizeVariants?.[colorBucket];
    if (!sprite) {
      continue;
    }
    ctx.globalAlpha = 0.38 + normalizedDistance * 0.5;
    ctx.drawImage(
      sprite.canvas,
      particle.x - sprite.drawSize * HALF,
      particle.y - sprite.drawSize * HALF,
      sprite.drawSize,
      sprite.drawSize,
    );
  }
  ctx.restore();
}

// Draw warm, center-attracted particles around the Mind Gate using cached blurred sprite blits.
function drawMindGateParticles(ctx, radius, currentTime) {
  drawGateParticleField.call(this, ctx, radius, currentTime, '_mindGateParticleSystem', MIND_GATE_GRADIENT_STOPS, 1);
}

// Draw shadowy, center-attracted particles around the Enemy Gate using cached blurred sprite blits.
function drawEnemyGateParticles(ctx, radius, currentTime) {
  drawGateParticleField.call(this, ctx, radius, currentTime, '_enemyGateParticleSystem', ENEMY_GATE_GRADIENT_STOPS, -1);
}

function drawEnemyGateSymbol(ctx, position) {
  if (!ctx || !position) {
    return;
  }

  const dimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 0;
  const baseRadius = dimension ? dimension * 0.028 : 0;
  const baseSize = Math.max(12, Math.min(20, baseRadius || 16));
  const radius = baseSize * 2 * TRACK_GATE_SIZE_SCALE * ENEMY_GATE_SYMBOL_SCALE;
  const currentTime = (this.lastRenderTime !== undefined ? this.lastRenderTime : Date.now()) / 1000;
  const effectDetailProfile = getTrackEffectDetailProfile.call(this);

  ctx.save();
  const anchorX = Math.round(position.x);
  const anchorY = Math.round(position.y);
  // Snap to whole pixels so the enlarged gate stays centered on the path anchor.
  ctx.translate(anchorX, anchorY);

  const glow = ctx.createRadialGradient(0, 0, radius * 0.18, 0, 0, radius * ENEMY_GATE_ANTIGLOW_RADIUS_SCALE);
  glow.addColorStop(0, 'rgba(0, 0, 0, 0.44)');
  glow.addColorStop(0.58, 'rgba(20, 8, 36, 0.22)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, radius * ENEMY_GATE_ANTIGLOW_RADIUS_SCALE, 0, TWO_PI);
  ctx.fill();

  const antiGlow = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius * 1.2);
  antiGlow.addColorStop(0, 'rgba(74, 240, 255, 0.16)');
  antiGlow.addColorStop(1, 'rgba(15, 27, 63, 0)');
  ctx.fillStyle = antiGlow;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.1, 0, TWO_PI);
  ctx.fill();

  // Render uploaded shadow background rings behind particles and the main symbol.
  drawGateBackgroundLayers(
    ctx,
    SHADOW_GATE_BACKGROUND_LAYERS,
    radius * 2.2,
    currentTime,
    0.78,
    effectDetailProfile.backgroundLayerStride,
  );

  // Draw dark violet particles swirling counter-clockwise behind the gate symbol.
  if (!this.isLowGraphicsMode?.()) {
    drawEnemyGateParticles.call(this, ctx, radius, currentTime);
  }

  const spriteReady = enemyGateSprite?.complete && enemyGateSprite.naturalWidth > 0;
  if (spriteReady) {
    const spriteSize = Math.max(baseSize * 2, 40) * 2 * TRACK_GATE_SIZE_SCALE * ENEMY_GATE_SYMBOL_SCALE * SHADOW_GATE_SYMBOL_SIZE_MULTIPLIER;
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
  const currentTime = (this.lastRenderTime !== undefined ? this.lastRenderTime : Date.now()) / 1000;
  const effectDetailProfile = getTrackEffectDetailProfile.call(this);

  ctx.save();
  ctx.translate(position.x, position.y);

  const glow = ctx.createRadialGradient(0, 0, radius * 0.18, 0, 0, radius * MIND_GATE_GLOW_RADIUS_SCALE);
  glow.addColorStop(0, 'rgba(255, 248, 220, 0.9)');
  glow.addColorStop(0.55, 'rgba(255, 196, 150, 0.35)');
  glow.addColorStop(1, 'rgba(139, 247, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, radius * MIND_GATE_GLOW_RADIUS_SCALE, 0, TWO_PI);
  ctx.fill();

  // Render uploaded mind background rings behind the wave and core symbol.
  drawGateBackgroundLayers(
    ctx,
    MIND_GATE_BACKGROUND_LAYERS,
    radius * 2.55,
    currentTime,
    0.82,
    effectDetailProfile.backgroundLayerStride,
  );

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
  const waveOffset = currentTime * CONSCIOUSNESS_WAVE_SPEED;

  // Draw consciousness wave through the gate.
  const waveWidth = radius * CONSCIOUSNESS_WAVE_WIDTH_SCALE;
  const waveHeight = radius * CONSCIOUSNESS_WAVE_HEIGHT_SCALE * healthPercentage;

  ctx.save();
  ctx.beginPath();

  // Generate sine wave with varying amplitudes for each peak.
  const wavePointCount = Math.max(2, effectDetailProfile.wavePointCount);
  for (let i = 0; i <= wavePointCount; i++) {
    const x = -waveWidth * HALF + (i / wavePointCount) * waveWidth;
    const normalizedX = (i / wavePointCount) * CONSCIOUSNESS_WAVE_PEAKS * TWO_PI;

    // Base sine wave.
    let y = Math.sin(normalizedX + waveOffset) * waveHeight;

    // Add amplitude variation per peak to create dynamic effect.
    const peakIndex = Math.floor((i / wavePointCount) * CONSCIOUSNESS_WAVE_PEAKS);
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

  // Draw warm particles swirling clockwise behind the gate symbol.
  if (!this.isLowGraphicsMode?.()) {
    drawMindGateParticles.call(this, ctx, radius, currentTime);
  }

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
