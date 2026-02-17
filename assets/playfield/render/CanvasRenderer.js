import { ALPHA_BASE_RADIUS_FACTOR } from '../../gameUnits.js';
import { getTowerVisualConfig, samplePaletteGradient } from '../../colorSchemeUtils.js';
import { getTowerDefinition } from '../../towersTab.js';
import { moteGemState, getGemSpriteImage, getEnemyShellSprites } from '../../enemies.js';
import { colorToRgbaString, resolvePaletteColorStops } from '../../../scripts/features/towers/powderTower.js';
import { getTrackRenderMode, TRACK_RENDER_MODES, areTrackTracersEnabled, areEnemyParticlesEnabled, areEdgeCrystalsEnabled, areBackgroundParticlesEnabled } from '../../preferences.js';
import {
  drawAlphaBursts as drawAlphaBurstsHelper,
} from '../../../scripts/features/towers/alphaTower.js';
import { drawBetaBursts as drawBetaBurstsHelper } from '../../../scripts/features/towers/betaTower.js';
import { drawGammaBursts as drawGammaBurstsHelper } from '../../../scripts/features/towers/gammaTower.js';
import { drawKappaTripwires as drawKappaTripwiresHelper } from '../../../scripts/features/towers/kappaTower.js';
import { drawLambdaLasers as drawLambdaLasersHelper } from '../../../scripts/features/towers/lambdaTower.js';
import { drawMuMines as drawMuMinesHelper } from '../../../scripts/features/towers/muTower.js';
import {
  drawNuBursts as drawNuBurstsHelper,
  drawNuKillParticles as drawNuKillParticlesHelper,
} from '../../../scripts/features/towers/nuTower.js';
import { drawXiBalls as drawXiBallsHelper } from '../../../scripts/features/towers/xiTower.js';
import { drawZetaPendulums as drawZetaPendulumsHelper } from '../../../scripts/features/towers/zetaTower.js';
import { drawEtaOrbits as drawEtaOrbitsHelper } from '../../../scripts/features/towers/etaTower.js';
import { drawDeltaSoldiers as drawDeltaSoldiersHelper } from '../../../scripts/features/towers/deltaTower.js';
import { drawThetaContours as drawThetaContoursHelper } from '../../../scripts/features/towers/thetaTower.js';
import { drawOmicronUnits as drawOmicronUnitsHelper } from '../../../scripts/features/towers/omicronTower.js';
import {
  drawPiLockOnLines as drawPiLockOnLinesHelper,
  drawPiFrozenLines as drawPiFrozenLinesHelper,
  drawPiRadialLaser as drawPiRadialLaserHelper,
} from '../../../scripts/features/towers/piTower.js';
import {
  drawChiThralls as drawChiThrallsHelper,
  drawChiLightTrails as drawChiLightTrailsHelper,
} from '../../../scripts/features/towers/chiTower.js';
import { drawTauProjectiles as drawTauProjectilesHelper } from '../../../scripts/features/towers/tauTower.js';
import { drawUpsilonFleet as drawUpsilonFleetHelper } from '../../../scripts/features/towers/upsilonTower.js';
import { drawPhiTower as drawPhiTowerHelper } from '../../../scripts/features/towers/phiTower.js';
import { drawOmegaParticles as drawOmegaParticlesHelper } from '../../../scripts/features/towers/omegaTower.js';

import { normalizeProjectileColor, drawConnectionMoteGlow } from '../utils/rendering.js';
import { easeInCubic, easeOutCubic } from '../utils/math.js';
import { getCrystallineMosaicManager } from './CrystallineMosaic.js';

// Pre-calculated constants for performance optimization in tight render loops
const PI = Math.PI;
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const QUARTER_PI = Math.PI / 4;
const PI_OVER_3 = Math.PI / 3;
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

const ENEMY_PARTICLE_SPRITE_URL = 'assets/sprites/enemies/particles/star_particle.png';
const enemyParticleSprite = new Image();
enemyParticleSprite.src = ENEMY_PARTICLE_SPRITE_URL;
enemyParticleSprite.decoding = 'async';
enemyParticleSprite.loading = 'eager';

// Epsilon needle sprite provides the projectile silhouette that we tint with the active palette.
// Note: Epsilon needle sprite is oriented with the needle pointing upward (base orientation).
// During flight, the sprite rotates to point in the direction of travel.
// See docs/TOWER_SPRITE_ORIENTATION.md for sprite orientation conventions.
const EPSILON_NEEDLE_SPRITE_URL = 'assets/sprites/towers/epsilon/projectiles/epsilonProjectile.png';
const epsilonNeedleSprite = new Image();
epsilonNeedleSprite.src = EPSILON_NEEDLE_SPRITE_URL;
epsilonNeedleSprite.decoding = 'async';
epsilonNeedleSprite.loading = 'eager';
// Cached, palette-tinted variants along the gradient to keep rendering lightweight.
const epsilonNeedleSpriteCache = new Map();
// Gradient stops ensure epsilon needles cycle through the player's palette.
const EPSILON_NEEDLE_GRADIENT_STOPS = [0.12, 0.38, 0.62, 0.88];

// Load small sketch sprites for random background decoration
const sketchSprites = [
  'assets/sprites/sketches/sketch_small_1.png',
  'assets/sprites/sketches/sketch_small_2.png',
  'assets/sprites/sketches/sketch_small_3.png',
  'assets/sprites/sketches/sketch_small_4.png',
].map((url) => {
  const img = new Image();
  img.src = url;
  img.decoding = 'async';
  img.loading = 'eager';
  return img;
});

const GEM_MOTE_BASE_RATIO = 0.02;
const TRACK_GATE_SIZE_SCALE = 0.5;
// Scale the enemy gate glyph up so the spawn marker remains legible at a glance.
const ENEMY_GATE_SYMBOL_SCALE = 2;
const ENEMY_SWIRL_MIN_DURATION_MS = 500;
const ENEMY_SWIRL_MAX_DURATION_MS = 2000;
const ENEMY_SWIRL_MIN_HOLD_MS = 140;
const ENEMY_SWIRL_MAX_HOLD_MS = 360;
const ENEMY_SWIRL_PARTICLE_BASE = 14; // Trimmed to lighten per-enemy swirl load on dense waves.
const ENEMY_SWIRL_PARTICLE_LOW = 8; // Low-fidelity fallback uses a smaller ring budget to reduce GPU cost.
// Anchor for the high-fidelity spawn budget so designers can tune the swirl curve quickly.
const ENEMY_SWIRL_HIGH_PARTICLE_ANCHOR = 30;
// Knockback tuning keeps hit reactions energetic without throwing particles off-screen.
const ENEMY_SWIRL_KNOCKBACK_DISTANCE = 14;
const ENEMY_SWIRL_KNOCKBACK_DURATION_MS = 360;
const ENEMY_SWIRL_FALLBACK_THRESHOLD = 48; // Trigger the simplified enemy body sooner to keep frame pacing stable.
const ENEMY_GATE_DARK_BLUE = 'rgba(15, 27, 63, 0.95)';
const ENEMY_GATE_DARK_BLUE_CORE = 'rgba(5, 8, 18, 0.92)';
// Match the bright glyph on the enemy gate symbol so outlines stay consistent with the UI motif.
const ENEMY_GATE_SYMBOL_GOLD = { r: 251, g: 255, b: 176 };
// Brighter swirl palette spanning dark blues into regal purples before fading to black.
const ENEMY_PARTICLE_PALETTE = [
  { r: 12, g: 22, b: 42 },
  { r: 22, g: 34, b: 82 },
  { r: 38, g: 32, b: 96 },
  { r: 56, g: 26, b: 110 },
  { r: 70, g: 24, b: 104 },
  { r: 16, g: 12, b: 32 },
  { r: 0, g: 0, b: 0 },
];
// Reuse the same warm palette that powers the luminous arc tracer.
const TRACK_TRACER_PRIMARY_COLOR = { r: 255, g: 180, b: 105 };
const TRACK_TRACER_HALO_COLOR = { r: 255, g: 228, b: 180 };
// Golden sparkle accents and debuff bar palette keep status markers consistent with the math aesthetic.
const RHO_SPARKLE_LINGER_SECONDS = 0.9;
const RHO_SPARKLE_COLOR = { r: 255, g: 218, b: 140 };
const RHO_SPARKLE_GLOW = 'rgba(255, 234, 170, 0.55)';
const DEBUFF_ICON_COLORS = {
  iota: { fill: 'rgba(139, 247, 255, 0.92)', stroke: 'rgba(6, 8, 14, 0.82)' },
  rho: { fill: 'rgba(255, 219, 156, 0.96)', stroke: 'rgba(52, 28, 4, 0.85)' },
  theta: { fill: 'rgba(208, 242, 255, 0.9)', stroke: 'rgba(8, 12, 18, 0.82)' },
  'derivative-shield': { fill: 'rgba(192, 210, 224, 0.9)', stroke: 'rgba(24, 32, 42, 0.82)' },
  default: { fill: 'rgba(255, 255, 255, 0.86)', stroke: 'rgba(6, 8, 14, 0.8)' },
};
const DEBUFF_BAR_BACKGROUND = 'rgba(6, 8, 14, 0.82)';
const DEBUFF_BAR_STROKE = 'rgba(255, 255, 255, 0.16)';
const GLYPH_DEFAULT_PROMOTION_VECTOR = { x: 0, y: -1 };
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
const GLYPH_DEFAULT_DEMOTION_VECTOR = { x: 0, y: 1 };
const PROMOTION_GLYPH_COLOR = { r: 139, g: 247, b: 255 };
const DEMOTION_GLYPH_COLOR = { r: 255, g: 196, b: 150 };
const GLYPH_FLASH_RAMP_MS = 120;
// Radial tower menu animation tuning keeps the command lattice feeling responsive yet readable.
const TOWER_MENU_OPEN_DURATION_MS = 360;
const TOWER_MENU_DISMISS_DURATION_MS = 220;
const TOWER_MENU_OPEN_SPIN_RADIANS = Math.PI * 0.75;
const TOWER_MENU_DISMISS_SPIN_RADIANS = Math.PI * 0.65;
const TOWER_MENU_DISMISS_SCALE = 1.25;

// Viewport culling margin: buffer zone beyond visible area to prevent pop-in
const VIEWPORT_CULL_MARGIN = 100;
// Projectile culling radii for different pattern types
const PROJECTILE_CULL_RADIUS_DEFAULT = 50;
const PROJECTILE_CULL_RADIUS_IOTA_PULSE = 150;
const PROJECTILE_CULL_RADIUS_OMEGA_WAVE = 200;
const PROJECTILE_CULL_RADIUS_ETA_LASER = 300;
// Other entity culling radii
const ENEMY_CULL_RADIUS = 100;
const DAMAGE_NUMBER_CULL_RADIUS = 50;
const DEATH_PARTICLE_CULL_RADIUS = 30;
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

function randomBetween(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return min;
  }
  if (max <= min) {
    return min;
  }
  return min + Math.random() * (max - min);
}

function sampleEnemyParticleColor() {
  if (!ENEMY_PARTICLE_PALETTE.length) {
    return { r: 12, g: 18, b: 44 };
  }
  const first = ENEMY_PARTICLE_PALETTE[Math.floor(Math.random() * ENEMY_PARTICLE_PALETTE.length)];
  const second = ENEMY_PARTICLE_PALETTE[Math.floor(Math.random() * ENEMY_PARTICLE_PALETTE.length)];
  const mix = 0.35 + Math.random() * 0.45;
  return {
    r: Math.round(first.r + (second.r - first.r) * mix),
    g: Math.round(first.g + (second.g - first.g) * mix),
    b: Math.round(first.b + (second.b - first.b) * mix),
  };
}

// Resolve how many swirl particles a newly spawned enemy should receive in high-fidelity mode.
function resolveHighGraphicsSpawnParticleBudget() {
  if (!this || typeof this.isLowGraphicsMode !== 'function' || this.isLowGraphicsMode()) {
    return null;
  }
  if (!Number.isFinite(ENEMY_SWIRL_HIGH_PARTICLE_ANCHOR)) {
    return null;
  }
  const trackedEnemies = this.enemySwirlParticles instanceof Map ? this.enemySwirlParticles.size : 0;
  const available = ENEMY_SWIRL_HIGH_PARTICLE_ANCHOR - trackedEnemies;
  return Math.max(0, Math.round(available));
}

function lerpAngle(start, end, t) {
  let delta = (end - start) % TWO_PI;
  if (delta > PI) {
    delta -= TWO_PI;
  } else if (delta < -PI) {
    delta += TWO_PI;
  }
  return start + delta * t;
}

function getNowTimestamp() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
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

// Render rho's golden sparkle ring around affected enemies using a lightweight particle halo.
function drawRhoSparkleRing(ctx, enemy, metrics, timestamp) {
  if (!ctx || !metrics || !enemy) {
    return;
  }
  const duration = Number.isFinite(enemy.rhoSparkleTimer) ? enemy.rhoSparkleTimer : 0;
  if (!(duration > 0)) {
    return;
  }
  const sparkleCount = this.isLowGraphicsMode?.() ? 12 : 18;
  const baseRadius = metrics.ringRadius + Math.max(4, metrics.scale * 4);
  const timeSeconds = Math.max(0, (timestamp || 0) / 1000);
  const visibility = Math.min(1, duration / (RHO_SPARKLE_LINGER_SECONDS + 0.25));

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  applyCanvasShadow.call(this, ctx, RHO_SPARKLE_GLOW, Math.max(2, metrics.scale * 2));
  for (let index = 0; index < sparkleCount; index += 1) {
    const angle =
      (index / sparkleCount) * TWO_PI + timeSeconds * 0.9 + (enemy.id || 0) * 0.07;
    const wobble = Math.sin(timeSeconds * 2.4 + index * 1.3) * 1.6 * metrics.scale;
    const radius = baseRadius + wobble;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    const twinkle = 0.65 + 0.35 * Math.sin(timeSeconds * 3 + index * 0.9);
    const sparkleSize = Math.max(1.25, metrics.scale * 1.6) * twinkle;
    const alpha = Math.max(
      0.2,
      Math.min(0.8, visibility * (0.65 + 0.35 * Math.sin(timeSeconds * 1.7 + index))),
    );

    ctx.fillStyle = colorToRgbaString(RHO_SPARKLE_COLOR, alpha);
    ctx.beginPath();
    ctx.arc(x, y, sparkleSize, 0, TWO_PI);
    ctx.fill();
  }
  clearCanvasShadow.call(this, ctx);
  ctx.restore();
}

function drawDebuffBarBackground(ctx, width, height) {
  const halfWidth = width * HALF;
  const halfHeight = height * HALF;
  const radius = Math.min(halfHeight, 8);
  ctx.beginPath();
  ctx.moveTo(-halfWidth + radius, -halfHeight);
  ctx.lineTo(halfWidth - radius, -halfHeight);
  ctx.quadraticCurveTo(halfWidth, -halfHeight, halfWidth, -halfHeight + radius);
  ctx.lineTo(halfWidth, halfHeight - radius);
  ctx.quadraticCurveTo(halfWidth, halfHeight, halfWidth - radius, halfHeight);
  ctx.lineTo(-halfWidth + radius, halfHeight);
  ctx.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth, halfHeight - radius);
  ctx.lineTo(-halfWidth, -halfHeight + radius);
  ctx.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth + radius, -halfHeight);
}

// Draw a compact debuff bar beneath enemies so glyph icons reflect active status order.
function drawEnemyDebuffBar(ctx, metrics, debuffs) {
  if (!ctx || !metrics || !Array.isArray(debuffs) || !debuffs.length) {
    return;
  }
  const iconSize = Math.max(10, metrics.symbolSize * 0.38);
  const spacing = Math.max(6, iconSize * 0.35);
  const paddingX = Math.max(6, iconSize * 0.32);
  const paddingY = Math.max(3, iconSize * 0.22);
  const width = debuffs.length * iconSize + Math.max(0, debuffs.length - 1) * spacing + paddingX * 2;
  const height = iconSize + paddingY * 2;
  const offsetY = metrics.ringRadius + height * 0.75;

  ctx.save();
  ctx.translate(0, offsetY);
  drawDebuffBarBackground(ctx, width, height);
  ctx.fillStyle = DEBUFF_BAR_BACKGROUND;
  ctx.strokeStyle = DEBUFF_BAR_STROKE;
  ctx.lineWidth = 1.25;
  ctx.fill();
  ctx.stroke();

  ctx.font = `600 ${iconSize}px "Cormorant Garamond", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  debuffs.forEach((entry, index) => {
    const color = DEBUFF_ICON_COLORS[entry?.type] || DEBUFF_ICON_COLORS.default;
    const x = -width * HALF + paddingX + iconSize * HALF + index * (iconSize + spacing);
    ctx.lineWidth = Math.max(1, iconSize * 0.08);
    ctx.strokeStyle = color.stroke;
    ctx.fillStyle = color.fill;
    const symbol = entry?.symbol || '·';
    ctx.strokeText(symbol, x, 0);
    ctx.fillText(symbol, x, 0);
  });

  ctx.restore();
}

function drawTowerConnectionParticles(ctx, tower, bodyRadius) {
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

function drawConnectionEffects(ctx) {
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

function drawFloaters() {
  if (!this.ctx || !this.floaters.length || !this.levelConfig) {
    return;
  }
  // Skip rendering if background particles are disabled in preferences
  if (!areBackgroundParticlesEnabled()) {
    return;
  }
  // Use cached frame values to reduce redundant calculations
  const width = this._frameCache?.width || (this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0);
  const height = this._frameCache?.height || (this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0);
  if (!width || !height) {
    return;
  }
  const minDimension = this._frameCache?.minDimension || (Math.min(width, height) || 1);
  const connectionWidth = Math.max(0.6, minDimension * 0.0014);

  const ctx = this.ctx;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const swimmers = Array.isArray(this.backgroundSwimmers) ? this.backgroundSwimmers : [];
  if (swimmers.length) {
    // Render faint white swimmers beneath the lattice lines so the background feels fluid.
    const baseSize = Math.max(0.6, minDimension * 0.0038);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    swimmers.forEach((swimmer) => {
      const flicker = Math.sin(Number.isFinite(swimmer.flicker) ? swimmer.flicker : 0) * 0.15 + 0.85;
      const size = baseSize * (Number.isFinite(swimmer.sizeScale) ? swimmer.sizeScale : 1) * flicker;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.08, 0.18 * flicker)})`;
      ctx.arc(swimmer.x, swimmer.y, size, 0, TWO_PI);
      ctx.fill();
    });
    ctx.restore();
  }

  this.floaterConnections.forEach((connection) => {
    const from = this.floaters[connection.from];
    const to = this.floaters[connection.to];
    if (!from || !to) {
      return;
    }
    const alpha = Math.max(0, Math.min(1, connection.strength || 0)) * 0.25;
    if (alpha <= 0) {
      return;
    }
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = connectionWidth;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  });

  this.floaters.forEach((floater) => {
    const opacity = Math.max(0, Math.min(1, floater.opacity || 0));
    if (opacity <= 0) {
      return;
    }
    let radiusFactor = Number.isFinite(floater.radiusFactor)
      ? floater.radiusFactor
      : null;
    if (!radiusFactor) {
      radiusFactor = this.randomFloaterRadiusFactor();
      floater.radiusFactor = radiusFactor;
    }
    const radius = Math.max(2, radiusFactor * minDimension);
    const strokeWidth = Math.max(0.8, radius * 0.22);
    ctx.beginPath();
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.25})`;
    ctx.arc(floater.x, floater.y, radius, 0, TWO_PI);
    ctx.stroke();
  });

  ctx.restore();
}

/**
 * Generate random sketch placements for a level.
 * Each sketch has a 10% chance of appearing, with random position and rotation.
 * Uses level ID as seed for consistent placement across sessions.
 */
function generateLevelSketches(levelId, width, height) {
  if (!levelId || !width || !height) {
    return [];
  }
  
  // Simple seeded random number generator for consistent sketch placement per level
  const seed = Array.from(String(levelId)).reduce((acc, char) => acc + char.charCodeAt(0), 1) || 1;
  let randomState = seed;
  const seededRandom = () => {
    randomState = (randomState * 1103515245 + 12345) & 0x7fffffff;
    return randomState / 0x7fffffff;
  };
  
  const sketches = [];
  
  // Each sketch has a 10% chance of appearing
  sketchSprites.forEach((sprite, index) => {
    if (seededRandom() < 0.1) {
      // Random position within level bounds (with some margin)
      const margin = Math.min(width, height) * 0.1;
      const x = margin + seededRandom() * (width - 2 * margin);
      const y = margin + seededRandom() * (height - 2 * margin);
      
      // Random rotation (0 to 360 degrees)
      const rotation = seededRandom() * TWO_PI;
      
      // Random scale variation (80% to 120% of original size)
      const scale = 0.8 + seededRandom() * 0.4;
      
      sketches.push({
        sprite,
        x,
        y,
        rotation,
        scale,
      });
    }
  });
  
  return sketches;
}

// Draw the cached sketch placements onto the provided context so we can reuse them in offscreen layers.
function drawSketchesOnContext(ctx, width, height) {
  if (!ctx || !this.levelConfig) {
    return;
  }

  // Generate sketches for this level if not already cached or if dimensions changed.
  if (!this._levelSketches ||
      this._levelSketchesId !== this.levelConfig.id ||
      this._levelSketchesWidth !== width ||
      this._levelSketchesHeight !== height) {
    this._levelSketches = generateLevelSketches(this.levelConfig.id, width, height);
    this._levelSketchesId = this.levelConfig.id;
    this._levelSketchesWidth = width;
    this._levelSketchesHeight = height;
  }

  if (!this._levelSketches || !this._levelSketches.length) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = 0.2; // 20% opacity

  this._levelSketches.forEach((sketch) => {
    if (!sketch.sprite || !sketch.sprite.complete) {
      return;
    }

    ctx.save();
    ctx.translate(sketch.x, sketch.y);
    ctx.rotate(sketch.rotation);

    const sketchWidth = sketch.sprite.width * sketch.scale;
    const sketchHeight = sketch.sprite.height * sketch.scale;

    ctx.drawImage(
      sketch.sprite,
      -sketchWidth * HALF,
      -sketchHeight * HALF,
      sketchWidth,
      sketchHeight
    );

    ctx.restore();
  });

  ctx.restore();
}

// Build a stable cache key for the sketch layer so zoom changes don't trigger re-rasterization.
function getSketchLayerCacheKey(width, height) {
  const levelId = this.levelConfig?.id || 'unknown-level';
  const pixelRatio = Math.max(1, this.pixelRatio || 1);
  return `${levelId}:${width}x${height}:pr${pixelRatio}`;
}

// Rasterize the sketches into an offscreen canvas so the main render loop can reuse the layer.
function buildSketchLayerCache(width, height) {
  if (!width || !height || !this.levelConfig) {
    return null;
  }
  const key = getSketchLayerCacheKey.call(this, width, height);
  if (this._sketchLayerCache?.key === key) {
    return this._sketchLayerCache;
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
  drawSketchesOnContext.call(this, ctx, width, height);
  this._sketchLayerCache = {
    key,
    canvas,
    width,
    height,
    pixelRatio,
  };
  return this._sketchLayerCache;
}

// Paint the cached sketch layer onto the main canvas when available.
function drawSketchLayerCache() {
  if (!this.ctx) {
    return false;
  }
  const width = this._frameCache?.width || (this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0);
  const height = this._frameCache?.height || (this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0);
  const cache = buildSketchLayerCache.call(this, width, height);
  if (!cache?.canvas) {
    return false;
  }
  this.ctx.drawImage(cache.canvas, 0, 0, width, height);
  return true;
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

/**
 * Draw small sketches in the background with 20% opacity.
 * Sketches are randomly placed per level with a 10% chance each.
 */
function drawSketches() {
  if (!this.ctx || !this.levelConfig) {
    return;
  }
  
  const ctx = this.ctx;
  
  // Generate sketches for this level if not already cached or if dimensions changed.
  const width = this._frameCache?.width || (this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0);
  const height = this._frameCache?.height || (this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0);

  drawSketchesOnContext.call(this, ctx, width, height);
}

function drawCrystallineMosaic() {
  if (!this.ctx) {
    return;
  }
  
  // Skip rendering if edge crystals are disabled in preferences
  if (!areEdgeCrystalsEnabled()) {
    return;
  }
  
  const mosaicManager = getCrystallineMosaicManager();
  if (!mosaicManager) {
    return;
  }
  
  // Get viewport bounds for culling
  const viewportBounds = this._frameCache?.viewportBounds || getViewportBounds.call(this);
  if (!viewportBounds) {
    return;
  }
  
  // Get path points for distance checking
  const pathPoints = this.pathPoints || [];
  
  // Use level config as version tracker (regenerate if level changes)
  const pathVersion = this.levelConfig?.id || null;
  
  // Get focused cell ID if any
  const focusedCellId = this.focusedCellId || null;
  
  // Render the crystalline mosaic
  const ctx = this.ctx;
  mosaicManager.render(ctx, viewportBounds, pathPoints, pathVersion, focusedCellId);
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

// Draw an accent ring + glyph echo when a tower is actively pressed by the player.
function drawTowerPressGlow(playfield, tower, bodyRadius, intensity, visuals, glyph) {
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

function drawPlacementPreview() {
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
    const wobble = (particle.lateral || 0) * Math.sin(progress * Math.PI);
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

function drawTowers() {
  if (!this.ctx || !this.towers.length) {
    return;
  }

  const ctx = this.ctx;
  ctx.save();

  this.drawConnectionEffects(ctx);

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
      this.drawZetaPendulums(tower);
    }
    if (tower.type === 'eta') {
      this.drawEtaOrbits(tower);
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

    this.drawTowerConnectionParticles(ctx, tower, bodyRadius);

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

function drawZetaPendulums(tower) {
  drawZetaPendulumsHelper(this, tower);
}

function drawEtaOrbits(tower) {
  drawEtaOrbitsHelper(this, tower);
}

function drawDeltaSoldiers() {
  drawDeltaSoldiersHelper(this);
}

function drawOmicronUnits() {
  drawOmicronUnitsHelper(this);
}

function shouldUseEnemyFallbackRendering() {
  // If enemy particles are disabled by user preference, always use fallback rendering
  if (typeof areEnemyParticlesEnabled === 'function' && !areEnemyParticlesEnabled()) {
    return true;
  }
  
  const enemyCount = Array.isArray(this.enemies) ? this.enemies.length : 0;
  if (!enemyCount) {
    return false;
  }
  const threshold = this.isLowGraphicsMode()
    ? Math.max(12, Math.round(ENEMY_SWIRL_FALLBACK_THRESHOLD * 0.65))
    : ENEMY_SWIRL_FALLBACK_THRESHOLD;
  return enemyCount > threshold;
}

// Consume the most recent queued impact for an enemy so the renderer can animate knockback.
function consumeEnemySwirlImpact(enemy) {
  if (!enemy || !Array.isArray(this?.enemySwirlImpacts) || !this.enemySwirlImpacts.length) {
    return null;
  }
  let latest = null;
  for (let index = this.enemySwirlImpacts.length - 1; index >= 0; index -= 1) {
    const entry = this.enemySwirlImpacts[index];
    if (!entry || entry.enemy !== enemy) {
      continue;
    }
    latest = entry;
    this.enemySwirlImpacts.splice(index, 1);
    break;
  }
  return latest;
}

// Determine the current swirl target based on fidelity mode and per-enemy spawn budgets.
function resolveEnemySwirlDesiredCount(entry, metrics, lowGraphicsEnabled) {
  if (lowGraphicsEnabled) {
    const baseCount = ENEMY_SWIRL_PARTICLE_LOW;
    const scale = Number.isFinite(metrics?.scale) ? metrics.scale : 1;
    const scaled = clamp(baseCount * scale, baseCount * 0.6, baseCount * 1.4);
    return Math.max(4, Math.round(scaled));
  }
  const spawnBudget = Number.isFinite(entry?.spawnParticleBudget)
    ? entry.spawnParticleBudget
    : ENEMY_SWIRL_PARTICLE_BASE;
  return Math.max(0, Math.round(spawnBudget));
}

// Choose which swirl particles get pushed back so only a damage-matching slice reacts to the impact.
function selectImpactedSwirlParticles(entry, damageFraction) {
  if (!entry || !Array.isArray(entry.particles)) {
    return new Map();
  }
  const fraction = clamp(Number.isFinite(damageFraction) ? damageFraction : 1, 0, 1);
  const totalParticles = entry.particles.length;
  if (!totalParticles || fraction <= 0) {
    return new Map();
  }
  const impacted = new Map();
  const targetCount = Math.ceil(totalParticles * fraction);
  const candidates = entry.particles.slice();
  for (let index = 0; index < targetCount && candidates.length; index += 1) {
    const pickIndex = Math.floor(Math.random() * candidates.length);
    const [pickedParticle] = candidates.splice(pickIndex, 1);
    if (pickedParticle) {
      // Lock in an independent angular deviation so nearby motes scatter instead of moving as one mass.
      impacted.set(pickedParticle, randomBetween(-PI_OVER_3, PI_OVER_3));
    }
  }
  return impacted;
}

// Generate a deterministic 0..1 noise value so particle knockback varies without frame-to-frame jitter.
function sampleImpactNoise(seedValue = 0) {
  const scaledSeed = (seedValue || 0) * 127.1;
  const raw = Math.sin(scaledSeed) * 43758.5453;
  return raw - Math.floor(raw);
}

// Apply a knockback offset so swirl particles briefly drift away from the impact point.
function applyEnemySwirlImpactOffset(entry, particle, position, now, jitterSeed = 0) {
  if (!entry || !entry.activeImpact || !position) {
    return position;
  }
  const impact = entry.activeImpact;
  const duration = Number.isFinite(impact.duration) ? impact.duration : ENEMY_SWIRL_KNOCKBACK_DURATION_MS;
  if (duration <= 0) {
    entry.activeImpact = null;
    return position;
  }
  const startTime = Number.isFinite(impact.startedAt) ? impact.startedAt : now;
  const elapsed = now - startTime;
  if (elapsed <= 0) {
    return position;
  }
  if (elapsed >= duration) {
    entry.activeImpact = null;
    return position;
  }
  const progress = clamp(elapsed / duration, 0, 1);
  const impulse = Math.sin(progress * Math.PI);
  const direction = impact.direction || { x: 0, y: 0 };
  const magnitude = Math.hypot(direction.x, direction.y) || 1;
  const normalized = { x: direction.x / magnitude, y: direction.y / magnitude };
  const impactedParticles = impact.impactedParticles;
  if (impactedParticles instanceof Map) {
    if (!impactedParticles.size) {
      entry.activeImpact = null;
      return position;
    }
    if (!impactedParticles.has(particle)) {
      return position;
    }
  }
  const strength = Number.isFinite(impact.strength) ? Math.max(0, impact.strength) : 1;
  const speedNoise = sampleImpactNoise(jitterSeed + 0.37);
  const particleAngleOffset =
    impactedParticles instanceof Map && impactedParticles.size
      ? impactedParticles.get(particle)
      : null;
  const angleOffset = Number.isFinite(particleAngleOffset) ? particleAngleOffset : 0;
  const rotatedAngle = Math.atan2(normalized.y, normalized.x) + angleOffset;
  const speedVariance = 0.82 + speedNoise * 0.55;
  const rotatedDirection = {
    x: Math.cos(rotatedAngle),
    y: Math.sin(rotatedAngle),
  };
  const distance = ENEMY_SWIRL_KNOCKBACK_DISTANCE * strength * impulse * speedVariance;
  return {
    x: position.x + rotatedDirection.x * distance,
    y: position.y + rotatedDirection.y * distance,
  };
}

function ensureEnemySwirlState(enemy, metrics) {
  if (!enemy || !metrics) {
    return null;
  }
  if (!this.enemySwirlParticles) {
    this.enemySwirlParticles = new Map();
  }
  let entry = this.enemySwirlParticles.get(enemy);
  if (!entry) {
    // Record the spawn-time swirl allocation so future frames keep the same budget.
    const spawnBudget = resolveHighGraphicsSpawnParticleBudget.call(this);
    entry = { particles: [], ringRadius: metrics.ringRadius, coreRadius: metrics.coreRadius };
    if (Number.isFinite(spawnBudget)) {
      entry.spawnParticleBudget = spawnBudget;
    }
    this.enemySwirlParticles.set(enemy, entry);
  }
  const previousRadius = Number.isFinite(entry.ringRadius) ? entry.ringRadius : metrics.ringRadius;
  if (Number.isFinite(previousRadius) && previousRadius > 0 && Math.abs(previousRadius - metrics.ringRadius) > 0.1) {
    const ratio = metrics.ringRadius / previousRadius;
    entry.particles.forEach((particle) => {
      if (Number.isFinite(particle?.currentRadius)) {
        particle.currentRadius *= ratio;
      }
    });
  }
  entry.ringRadius = metrics.ringRadius;
  entry.coreRadius = metrics.coreRadius;
  return entry;
}

function spawnEnemySwirlParticle(metrics, now) {
  const duration = randomBetween(ENEMY_SWIRL_MIN_DURATION_MS, ENEMY_SWIRL_MAX_DURATION_MS);
  const holdDuration = randomBetween(ENEMY_SWIRL_MIN_HOLD_MS, ENEMY_SWIRL_MAX_HOLD_MS);
  const angle = Math.random() * TWO_PI;
  const scale = Math.max(0.65, Math.min(1.45, metrics.scale || 1));
  const size = randomBetween(0.9, 2.3) * scale;
  const jitter = Math.random();
  // Random rotation speed (in radians per second) - range from 0.5 to 2.5 rad/s
  const rotationSpeed = randomBetween(0.5, 2.5);
  // Random rotation direction: 1 for clockwise, -1 for counter-clockwise
  const rotationDirection = Math.random() < 0.5 ? 1 : -1;
  return {
    color: sampleEnemyParticleColor(),
    startAngle: angle,
    targetAngle: angle,
    currentAngle: angle,
    currentRadius: metrics.ringRadius,
    state: 'in',
    duration,
    holdDuration,
    startedAt: now - jitter * duration,
    holdUntil: 0,
    size,
    rotation: Math.random() * TWO_PI, // Initial random rotation angle
    rotationSpeed,
    rotationDirection,
  };
}

function advanceEnemySwirlParticle(particle, metrics, now) {
  if (!particle || !metrics) {
    return;
  }
  const maxRadius = metrics.ringRadius;
  if (!Number.isFinite(maxRadius) || maxRadius <= 0) {
    particle.currentRadius = 0;
    return;
  }
  if (!particle.duration || particle.duration <= 0) {
    particle.duration = ENEMY_SWIRL_MIN_DURATION_MS;
  }
  
  // Update rotation based on rotation speed and direction
  if (Number.isFinite(particle.rotation) && Number.isFinite(particle.rotationSpeed) && Number.isFinite(particle.rotationDirection)) {
    const deltaTime = 16; // Assume ~60fps (16ms per frame)
    particle.rotation += (particle.rotationSpeed * particle.rotationDirection * deltaTime) / 1000;
    // Keep rotation normalized between 0 and 2π
    particle.rotation = particle.rotation % (TWO_PI);
    if (particle.rotation < 0) {
      particle.rotation += TWO_PI;
    }
  }
  
  if (particle.state === 'in') {
    const elapsed = now - particle.startedAt;
    const progress = clamp(elapsed / particle.duration, 0, 1);
    particle.currentRadius = maxRadius * (1 - progress);
    if (progress >= 1) {
      particle.state = 'hold';
      particle.holdUntil = now + particle.holdDuration;
    }
  } else if (particle.state === 'hold') {
    particle.currentRadius = 0;
    if (!particle.holdUntil || now >= particle.holdUntil) {
      particle.state = 'out';
      particle.startAngle = particle.currentAngle;
      particle.targetAngle = Math.random() * TWO_PI;
      particle.startedAt = now;
      particle.duration = randomBetween(ENEMY_SWIRL_MIN_DURATION_MS, ENEMY_SWIRL_MAX_DURATION_MS);
    }
  } else {
    const elapsed = now - particle.startedAt;
    const progress = clamp(elapsed / particle.duration, 0, 1);
    particle.currentRadius = maxRadius * progress;
    const startAngle = Number.isFinite(particle.startAngle) ? particle.startAngle : 0;
    const endAngle = Number.isFinite(particle.targetAngle) ? particle.targetAngle : startAngle;
    particle.currentAngle = lerpAngle(startAngle, endAngle, progress);
    if (progress >= 1) {
      particle.state = 'in';
      particle.startAngle = particle.currentAngle;
      particle.targetAngle = particle.currentAngle;
      particle.startedAt = now;
      particle.duration = randomBetween(ENEMY_SWIRL_MIN_DURATION_MS, ENEMY_SWIRL_MAX_DURATION_MS);
      particle.holdDuration = randomBetween(ENEMY_SWIRL_MIN_HOLD_MS, ENEMY_SWIRL_MAX_HOLD_MS);
    }
  }
}

function drawEnemySwirlBackdrop(ctx, metrics, inversionActive) {
  if (!ctx || !metrics) {
    return;
  }
  ctx.save();
  const radius = metrics.ringRadius * 1.08;
  const gradient = ctx.createRadialGradient(0, 0, Math.max(2, metrics.coreRadius * 0.25), 0, 0, radius);
  if (inversionActive) {
    gradient.addColorStop(0, 'rgba(236, 244, 255, 0.55)');
    gradient.addColorStop(0.5, 'rgba(210, 228, 255, 0.18)');
    gradient.addColorStop(1, 'rgba(236, 244, 255, 0.08)');
  } else {
    gradient.addColorStop(0, 'rgba(6, 10, 22, 0.85)');
    gradient.addColorStop(0.45, 'rgba(10, 16, 34, 0.6)');
    gradient.addColorStop(1, 'rgba(2, 4, 10, 0.05)');
  }
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TWO_PI);
  ctx.fill();
  ctx.restore();
}

function drawEnemySwirlParticles(ctx, enemy, metrics, now, inversionActive) {
  if (!ctx || !enemy || !metrics) {
    return;
  }
  const entry = ensureEnemySwirlState.call(this, enemy, metrics);
  if (!entry) {
    return;
  }
  const lowGraphicsEnabled = this.isLowGraphicsMode();
  // Apply the latest queued knockback so the swirl ring reacts to recent hits.
  const latestImpact = consumeEnemySwirlImpact.call(this, enemy);
  if (latestImpact) {
    entry.activeImpact = {
      direction: latestImpact.direction,
      strength: Number.isFinite(latestImpact.strength) ? latestImpact.strength : 1,
      startedAt: Number.isFinite(latestImpact.timestamp) ? latestImpact.timestamp : now,
      duration: ENEMY_SWIRL_KNOCKBACK_DURATION_MS,
      // Tag the specific particles that should stagger so the reaction matches the damage share.
      impactedParticles: selectImpactedSwirlParticles(entry, latestImpact.damageFraction),
    };
  }
  const desiredCount = resolveEnemySwirlDesiredCount(entry, metrics, lowGraphicsEnabled);
  while (entry.particles.length < desiredCount) {
    entry.particles.push(spawnEnemySwirlParticle(metrics, now));
  }
  if (entry.particles.length > desiredCount) {
    entry.particles.splice(desiredCount);
  }
  
  // Check if sprite is loaded
  const spriteReady = enemyParticleSprite?.complete && enemyParticleSprite.naturalWidth > 0;
  const alphaBase = inversionActive ? 0.55 : 0.85;
  
  entry.particles.forEach((particle) => {
    advanceEnemySwirlParticle(particle, metrics, now);
    const radius = clamp(particle.currentRadius ?? metrics.ringRadius, 0, metrics.ringRadius);
    const angle = Number.isFinite(particle.currentAngle) ? particle.currentAngle : 0;
    const basePosition = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    const jitterSeed = Number.isFinite(particle.startAngle) ? particle.startAngle : angle;
    const position = applyEnemySwirlImpactOffset(entry, particle, basePosition, now, jitterSeed) || basePosition;
    const alpha = clamp(alphaBase * (particle.state === 'hold' ? 0.9 : 0.7 + Math.random() * 0.2), 0.25, 0.95);
    
    // Render sprite if loaded, otherwise fall back to circles
    if (spriteReady) {
      ctx.save();
      ctx.translate(position.x, position.y);
      
      // Apply rotation
      const rotation = Number.isFinite(particle.rotation) ? particle.rotation : 0;
      ctx.rotate(rotation);
      
      // Make particles small and transparent
      const size = Math.max(0.6, particle.size || 1.2);
      const spriteSize = size * 4; // Scale sprite to reasonable size
      const halfSize = spriteSize * HALF;
      
      // Apply transparency
      ctx.globalAlpha = alpha * 0.6; // Make it more transparent
      
      // Draw the sprite
      ctx.drawImage(
        enemyParticleSprite,
        -halfSize,
        -halfSize,
        spriteSize,
        spriteSize
      );
      
      ctx.restore();
    } else {
      // Fallback to original circle rendering if sprite not loaded
      ctx.beginPath();
      ctx.fillStyle = colorToRgbaString(particle.color || sampleEnemyParticleColor(), alpha);
      const size = Math.max(0.6, particle.size || 1.2);
      ctx.arc(position.x, position.y, size, 0, TWO_PI);
      ctx.fill();
      // Outline each mote with a bright gate-gold halo so the swirl reads clearly against dark bodies.
      ctx.lineWidth = Math.max(0.2, size * 0.25);
      ctx.strokeStyle = colorToRgbaString(ENEMY_GATE_SYMBOL_GOLD, Math.min(1, alpha + 0.1));
      ctx.stroke();
    }
  });
}

function drawEnemyFallbackBody(ctx, metrics, inversionActive) {
  if (!ctx || !metrics) {
    return;
  }
  ctx.beginPath();
  ctx.fillStyle = inversionActive ? 'rgba(240, 244, 255, 0.88)' : ENEMY_GATE_DARK_BLUE;
  ctx.strokeStyle = inversionActive ? 'rgba(12, 16, 24, 0.55)' : 'rgba(80, 130, 190, 0.55)';
  ctx.lineWidth = 2;
  ctx.arc(0, 0, metrics.ringRadius, 0, TWO_PI);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = inversionActive ? 'rgba(12, 18, 28, 0.42)' : ENEMY_GATE_DARK_BLUE_CORE;
  ctx.arc(0, 0, metrics.coreRadius, 0, TWO_PI);
  ctx.fill();
}

function drawEnemySymbolAndExponent(ctx, options = {}) {
  const { symbol, exponent, metrics, inversionActive, enemy } = options;
  if (!ctx || !metrics) {
    return;
  }
  const glyph = symbol || '?';
  const symbolFillStyle = 'rgba(255, 255, 255, 0.96)';
  const glowColor = inversionActive ? 'rgba(24, 32, 48, 0.75)' : 'rgba(255, 255, 255, 0.65)';
  this.applyCanvasShadow(ctx, glowColor, inversionActive ? 10 : 18);
  ctx.fillStyle = symbolFillStyle;
  ctx.font = `${metrics.symbolSize}px "Cormorant Garamond", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, 0, 0);
  this.clearCanvasShadow(ctx);

  const exponentFillStyle = inversionActive ? 'rgba(24, 34, 46, 0.9)' : this.resolveEnemyExponentColor(enemy);
  const exponentStrokeStyle = inversionActive ? 'rgba(236, 240, 248, 0.85)' : 'rgba(6, 8, 14, 0.85)';
  ctx.font = `700 ${metrics.exponentSize}px "Cormorant Garamond", serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  const exponentLabel = Number.isFinite(exponent) ? exponent.toFixed(1) : '0.0';
  const pixelRatio = Number.isFinite(this.pixelRatio) && this.pixelRatio > 0 ? this.pixelRatio : 1;
  const outlineWidth = Math.max(1, Math.round(pixelRatio));
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = exponentStrokeStyle;
  ctx.lineWidth = outlineWidth;
  const exponentOffsetX = metrics.ringRadius * 0.94;
  const exponentOffsetY = -metrics.ringRadius * 0.98;
  ctx.strokeText(exponentLabel, exponentOffsetX, exponentOffsetY);
  ctx.fillStyle = exponentFillStyle;
  ctx.fillText(exponentLabel, exponentOffsetX, exponentOffsetY);
}

// Draw enemy shell sprite (either back or front layer)
function drawEnemyShellSprite(ctx, image, metrics) {
  if (!ctx || !image || !metrics) {
    return;
  }
  
  // Scale shell to match enemy size (slightly larger than the ring radius)
  const shellSize = metrics.ringRadius * 2.2;
  const halfSize = shellSize * HALF;
  
  ctx.drawImage(
    image,
    -halfSize,
    -halfSize,
    shellSize,
    shellSize
  );
}

// Remove stale knockback entries so the queue never references defeated enemies.
function cleanupEnemySwirlImpactQueue(activeEnemies) {
  if (!Array.isArray(this.enemySwirlImpacts) || !this.enemySwirlImpacts.length) {
    return;
  }
  if (!activeEnemies || !activeEnemies.size) {
    this.enemySwirlImpacts.length = 0;
    return;
  }
  for (let index = this.enemySwirlImpacts.length - 1; index >= 0; index -= 1) {
    const entry = this.enemySwirlImpacts[index];
    if (!entry || !activeEnemies.has(entry.enemy)) {
      this.enemySwirlImpacts.splice(index, 1);
    }
  }
}

function cleanupEnemySwirlParticles(activeEnemies) {
  if (!this.enemySwirlParticles) {
    return;
  }
  const activeSet = activeEnemies || new Set();
  Array.from(this.enemySwirlParticles.keys()).forEach((enemyRef) => {
    if (!activeSet.has(enemyRef)) {
      this.enemySwirlParticles.delete(enemyRef);
    }
  });
  cleanupEnemySwirlImpactQueue.call(this, activeSet);
}

function drawEnemies() {
  if (!this.ctx || !this.enemies.length) {
    return;
  }

  const ctx = this.ctx;
  ctx.save();

  const fallbackRendering = shouldUseEnemyFallbackRendering.call(this);
  const timestamp = fallbackRendering ? 0 : (this._frameCache?.timestamp || getNowTimestamp());
  // Only track active enemies when swirl caches exist to avoid per-frame set work.
  const shouldTrackActiveEnemies = !fallbackRendering
    && ((this.enemySwirlParticles && this.enemySwirlParticles.size) || (this.enemySwirlImpacts && this.enemySwirlImpacts.length));
  const activeEnemies = shouldTrackActiveEnemies ? new Set() : null;
  if (fallbackRendering && this.enemySwirlParticles) {
    this.enemySwirlParticles.clear();
  }
  if (fallbackRendering && Array.isArray(this.enemySwirlImpacts)) {
    this.enemySwirlImpacts.length = 0;
  }

  // Use cached viewport bounds to reduce redundant calculations
  const viewportBounds = this._frameCache?.viewportBounds || getViewportBounds.call(this);

  this.enemies.forEach((enemy) => {
    if (!enemy) {
      return;
    }

    const position = this.getEnemyPosition(enemy);
    if (!position) {
      return;
    }

    // Skip rendering enemies outside viewport
    if (viewportBounds && !isInViewport(position, viewportBounds, ENEMY_CULL_RADIUS)) {
      return;
    }

    // Check if enemy is in a tunnel and get opacity
    const tunnelState = typeof this.getEnemyTunnelState === 'function'
      ? this.getEnemyTunnelState(enemy)
      : { inTunnel: false, opacity: 1, isFadeZone: false };

    const metrics = this.getEnemyVisualMetrics(enemy);
    const symbol = typeof enemy.symbol === 'string' ? enemy.symbol : this.resolveEnemySymbol(enemy);
    const exponent = this.calculateHealthExponent(Math.max(1, enemy.hp ?? enemy.maxHp ?? 1));
    const inversionActive = Number.isFinite(enemy.iotaInversionTimer) && enemy.iotaInversionTimer > 0;
    const debuffIndicators =
      typeof this.getEnemyDebuffIndicators === 'function'
        ? this.getEnemyDebuffIndicators(enemy)
        : [];
    const rhoSparklesActive = Number.isFinite(enemy.rhoSparkleTimer) && enemy.rhoSparkleTimer > 0;
    
    // Get shell sprites if enemy has them
    const shellSprites = getEnemyShellSprites(enemy);

    ctx.save();
    ctx.translate(position.x, position.y);
    
    // Apply tunnel opacity
    if (tunnelState.inTunnel || tunnelState.isFadeZone) {
      ctx.globalAlpha = tunnelState.opacity;
    }

    // Draw back shell sprite behind enemy
    if (shellSprites?.back) {
      drawEnemyShellSprite(ctx, shellSprites.back, metrics);
    }

    if (fallbackRendering) {
      drawEnemyFallbackBody(ctx, metrics, inversionActive);
    } else {
      drawEnemySwirlBackdrop(ctx, metrics, inversionActive);
      drawEnemySwirlParticles.call(this, ctx, enemy, metrics, timestamp, inversionActive);
    }

    if (rhoSparklesActive) {
      drawRhoSparkleRing.call(this, ctx, enemy, metrics, timestamp);
    }

    drawEnemySymbolAndExponent.call(this, ctx, {
      symbol,
      exponent,
      metrics,
      inversionActive,
      enemy,
    });

    drawEnemyDebuffBar(ctx, metrics, debuffIndicators);
    
    // Draw front shell sprite in front of enemy
    if (shellSprites?.front) {
      drawEnemyShellSprite(ctx, shellSprites.front, metrics);
    }

    if (this.focusedEnemyId === enemy.id) {
      const markerRadius = metrics.focusRadius || metrics.ringRadius + 8;
      const angle = this.focusMarkerAngle || 0;
      const span = PI_OVER_3;
      ctx.strokeStyle = 'rgba(255, 228, 120, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, markerRadius, angle, angle + span);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, markerRadius, angle + Math.PI, angle + Math.PI + span);
      ctx.stroke();
    }

    ctx.restore();

    if (activeEnemies) {
      activeEnemies.add(enemy);
    }
  });

  if (activeEnemies) {
    cleanupEnemySwirlParticles.call(this, activeEnemies);
  }

  ctx.restore();
}

// Render sine-wobbling fragments that drift away from defeated enemies until they fade out.
function drawEnemyDeathParticles() {
  if (!this.ctx || !Array.isArray(this.enemyDeathParticles) || !this.enemyDeathParticles.length) {
    return;
  }

  const ctx = this.ctx;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Use cached viewport bounds to reduce redundant calculations
  const viewportBounds = this._frameCache?.viewportBounds || getViewportBounds.call(this);

  this.enemyDeathParticles.forEach((particle) => {
    if (!particle || !particle.position) {
      return;
    }
    const alpha = clamp(Number.isFinite(particle.alpha) ? particle.alpha : 1, 0, 1);
    if (alpha <= 0) {
      return;
    }
    
    // Skip rendering death particles outside viewport
    if (viewportBounds && !isInViewport(particle.position, viewportBounds, DEATH_PARTICLE_CULL_RADIUS)) {
      return;
    }
    
    const wobbleFrequency = Number.isFinite(particle.wobbleFrequency) ? particle.wobbleFrequency : 0;
    const wobbleAmplitude = Number.isFinite(particle.wobbleAmplitude) ? particle.wobbleAmplitude : 0;
    const wobblePhase = (Number.isFinite(particle.phase) ? particle.phase : 0)
      + (Number.isFinite(particle.elapsed) ? particle.elapsed : 0) * wobbleFrequency;
    const wobbleOffset = Math.sin(wobblePhase) * wobbleAmplitude;
    const perpendicular = particle.perpendicular || { x: 0, y: 0 };
    const x = particle.position.x + (perpendicular.x || 0) * wobbleOffset;
    const y = particle.position.y + (perpendicular.y || 0) * wobbleOffset;
    const size = Math.max(1, Number.isFinite(particle.size) ? particle.size : 2);
    const color = particle.color || samplePaletteGradient(Math.random());

    ctx.beginPath();
    ctx.fillStyle = colorToRgbaString(color, alpha * 0.9);
    ctx.arc(x, y, size, 0, TWO_PI);
    ctx.fill();
    ctx.lineWidth = Math.max(0.4, size * 0.35);
    ctx.strokeStyle = colorToRgbaString(color, alpha * 0.65);
    ctx.stroke();
  });

  ctx.restore();
}

function drawSwarmClouds() {
  if (!this.ctx || !Array.isArray(this.swarmClouds) || !this.swarmClouds.length) {
    return;
  }

  const ctx = this.ctx;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  this.swarmClouds.forEach((cloud) => {
    if (!cloud || !cloud.position) {
      return;
    }
    
    const progress = cloud.duration > 0 ? Math.min(1, cloud.lifetime / cloud.duration) : 1;
    const alpha = clamp(0.25 * (1 - progress * 0.5), 0, 0.3);
    
    if (alpha <= 0) {
      return;
    }
    
    const radius = cloud.radius || 20;
    const x = cloud.position.x;
    const y = cloud.position.y;
    
    // Draw pulsing cloud effect
    const pulsePhase = (cloud.lifetime || 0) * 3;
    const pulseScale = 1 + Math.sin(pulsePhase) * 0.15;
    const effectiveRadius = radius * pulseScale;
    
    // Determine color based on shot types
    const hasAlpha = (cloud.alphaCount || 0) > 0;
    const hasBeta = (cloud.betaCount || 0) > 0;
    
    let color1, color2;
    if (hasAlpha && hasBeta) {
      // Mix of both - use a blend
      color1 = samplePaletteGradient(0.18); // Alpha offset
      color2 = samplePaletteGradient(0.45); // Beta offset
    } else if (hasAlpha) {
      color1 = samplePaletteGradient(0.18);
      color2 = samplePaletteGradient(0.22);
    } else {
      color1 = samplePaletteGradient(0.42);
      color2 = samplePaletteGradient(0.48);
    }
    
    // Draw outer glow
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, effectiveRadius);
    gradient.addColorStop(0, colorToRgbaString(color1, alpha * 0.4));
    gradient.addColorStop(0.5, colorToRgbaString(color2, alpha * 0.25));
    gradient.addColorStop(1, colorToRgbaString(color1, 0));
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, effectiveRadius, 0, TWO_PI);
    ctx.fill();
    
    // Draw inner core
    const coreRadius = effectiveRadius * 0.3;
    const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, coreRadius);
    coreGradient.addColorStop(0, colorToRgbaString(color2, alpha * 0.6));
    coreGradient.addColorStop(1, colorToRgbaString(color1, 0));
    
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(x, y, coreRadius, 0, TWO_PI);
    ctx.fill();
  });

  ctx.restore();
}

function drawDamageNumbers() {
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

function drawFloatingFeedback() {
  if (!this.floatingFeedback || typeof this.floatingFeedback.update !== 'function') {
    return;
  }
  const now = this._frameCache?.timestamp || getNowTimestamp();
  this.floatingFeedback.update(now);
}

function drawWaveTallies() {
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

function drawProjectiles() {
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

function drawAlphaBursts() {
  drawAlphaBurstsHelper(this);
}

function drawBetaBursts() {
  drawBetaBurstsHelper(this);
}

function drawGammaBursts() {
  drawGammaBurstsHelper(this);
}

/**
 * Render star burst effects on enemies hit by gamma projectiles.
 */
function drawGammaStarBursts() {
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

function drawNuBursts() {
  drawNuBurstsHelper(this);
}

function drawOmegaParticles() {
  drawOmegaParticlesHelper(this);
}

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

function drawTowerMenu() {
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
