import { ALPHA_BASE_RADIUS_FACTOR } from '../../gameUnits.js';
import { getTowerVisualConfig, samplePaletteGradient } from '../../colorSchemeUtils.js';
import { getTowerDefinition } from '../../towersTab.js';
import { moteGemState, getGemSpriteImage } from '../../enemies.js';
import { colorToRgbaString, resolvePaletteColorStops } from '../../../scripts/features/towers/powderTower.js';
import { getTrackRenderMode, TRACK_RENDER_MODES, areTrackTracersEnabled } from '../../preferences.js';
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

/**
 * Calculate the visible viewport bounds in world coordinates.
 * Returns an object with min/max x/y coordinates for culling.
 */
function getViewportBounds() {
  if (!this.canvas || !this.ctx) {
    return null;
  }
  const width = this.renderWidth || this.canvas.clientWidth || 0;
  const height = this.renderHeight || this.canvas.clientHeight || 0;
  const viewCenter = this.getViewCenter();
  const scale = this.viewScale || 1;
  
  // Calculate world-space bounds with margin
  const halfWidth = (width / scale / 2) + VIEWPORT_CULL_MARGIN;
  const halfHeight = (height / scale / 2) + VIEWPORT_CULL_MARGIN;
  
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
 * @returns {boolean} True if visible
 */
function isInViewport(position, bounds, radius = 0) {
  if (!position || !bounds) {
    return true; // Render if we can't determine visibility
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
  const tau = Math.PI * 2;
  let delta = (end - start) % tau;
  if (delta > Math.PI) {
    delta -= tau;
  } else if (delta < -Math.PI) {
    delta += tau;
  }
  return start + delta * t;
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
      (index / sparkleCount) * Math.PI * 2 + timeSeconds * 0.9 + (enemy.id || 0) * 0.07;
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
    ctx.arc(x, y, sparkleSize, 0, Math.PI * 2);
    ctx.fill();
  }
  clearCanvasShadow.call(this, ctx);
  ctx.restore();
}

function drawDebuffBarBackground(ctx, width, height) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
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
    const x = -width / 2 + paddingX + iconSize / 2 + index * (iconSize + spacing);
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
  ctx.translate(width / 2, height / 2);
  ctx.scale(this.viewScale, this.viewScale);
  ctx.translate(-viewCenter.x, -viewCenter.y);

  this.drawFloaters();
  this.drawPath();
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
  this.drawWaveTallies();
  this.drawChiLightTrails();
  this.drawChiThralls();
  this.drawProjectiles();
  this.drawTowerMenu();
  this.updateEnemyTooltipPosition();
}

function drawFloaters() {
  if (!this.ctx || !this.floaters.length || !this.levelConfig) {
    return;
  }
  const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  if (!width || !height) {
    return;
  }
  const minDimension = Math.min(width, height) || 1;
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
      ctx.arc(swimmer.x, swimmer.y, size, 0, Math.PI * 2);
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
    ctx.arc(floater.x, floater.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.restore();
}

function drawMoteGems() {
  if (!this.ctx || !moteGemState.active.length) {
    return;
  }
  const ctx = this.ctx;
  ctx.save();
  const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  const dimensionCandidates = [];
  if (Number.isFinite(width) && width > 0) {
    dimensionCandidates.push(width);
  }
  if (Number.isFinite(height) && height > 0) {
    dimensionCandidates.push(height);
  }
  const minDimension = Math.max(
    1,
    dimensionCandidates.length ? Math.min(...dimensionCandidates) : 320,
  );
  const moteUnit = Math.max(6, minDimension * GEM_MOTE_BASE_RATIO);
  const pulseMagnitude = moteUnit * 0.35;

  // Calculate viewport bounds once for all mote gems
  const viewportBounds = getViewportBounds.call(this);

  moteGemState.active.forEach((gem) => {
    // Skip rendering mote gems outside viewport
    if (viewportBounds && !isInViewport({ x: gem.x, y: gem.y }, viewportBounds, 50)) {
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
      ctx.drawImage(sprite, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight);
    } else {
      const squareSize = Math.max(moteUnit * 0.6, size + pulse);
      const half = squareSize / 2;
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
  const start = points[0];
  const end = points[points.length - 1];

  const trackMode = getTrackRenderMode();
  if (trackMode === TRACK_RENDER_MODES.RIVER) {
    drawTrackParticleRiver.call(this);
    return;
  }

  const paletteStops = [
    { stop: 0, color: samplePaletteGradient(0) },
    { stop: 0.5, color: samplePaletteGradient(0.5) },
    { stop: 1, color: samplePaletteGradient(1) },
  ];
  
  // If there are tunnels, we need to draw segments with varying opacity
  const hasTunnels = Array.isArray(this.tunnelSegments) && this.tunnelSegments.length > 0;
  
  if (hasTunnels) {
    drawPathWithTunnels.call(this, ctx, points, paletteStops, trackMode);
  } else {
    // Original path drawing for non-tunnel paths
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
}

function drawPathWithTunnels(ctx, points, paletteStops, trackMode) {
  if (!points || points.length < 2 || !this.tunnelSegments) {
    return;
  }

  const baseAlpha = trackMode === TRACK_RENDER_MODES.BLUR ? 0.78 : 0.55;
  const highlightAlpha = trackMode === TRACK_RENDER_MODES.BLUR ? 0.32 : 0.18;
  const baseLineWidth = trackMode === TRACK_RENDER_MODES.BLUR ? 9 : 7;
  const highlightLineWidth = trackMode === TRACK_RENDER_MODES.BLUR ? 3.8 : 2;
  const FADE_ZONE_RATIO = 0.2;

  // Helper to get opacity for a point index based on tunnel zones
  const getOpacityForPointIndex = (index) => {
    for (const tunnel of this.tunnelSegments) {
      if (index >= tunnel.startIndex && index <= tunnel.endIndex) {
        const tunnelLength = tunnel.endIndex - tunnel.startIndex;
        
        // Guard against zero-length tunnels
        if (tunnelLength <= 0) {
          return 0; // Treat as fully transparent
        }
        
        const progressInTunnel = (index - tunnel.startIndex) / tunnelLength;
        
        if (progressInTunnel < FADE_ZONE_RATIO) {
          // Entry fade zone - fade from 1 to 0
          return 1 - (progressInTunnel / FADE_ZONE_RATIO);
        } else if (progressInTunnel > (1 - FADE_ZONE_RATIO)) {
          // Exit fade zone - fade from 0 to 1
          return (progressInTunnel - (1 - FADE_ZONE_RATIO)) / FADE_ZONE_RATIO;
        } else {
          // Middle of tunnel - fully transparent
          return 0;
        }
      }
    }
    return 1; // Not in tunnel, fully opaque
  };

  // Draw path segments with varying opacity
  for (let layer = 0; layer < 2; layer += 1) {
    const isBase = layer === 0;
    const lineWidth = isBase ? baseLineWidth : highlightLineWidth;
    const alphaMultiplier = isBase ? baseAlpha : highlightAlpha;
    
    for (let i = 0; i < points.length - 1; i += 1) {
      const point = points[i];
      const nextPoint = points[i + 1];
      
      // Calculate opacity for this segment
      const startOpacity = getOpacityForPointIndex(i);
      const endOpacity = getOpacityForPointIndex(i + 1);
      const segmentOpacity = (startOpacity + endOpacity) / 2;
      
      // Skip fully transparent segments
      if (segmentOpacity <= 0.01) {
        continue;
      }
      
      // Sample color based on position along path
      const pathProgress = i / (points.length - 1);
      const color = samplePaletteGradient(pathProgress);
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
    const offsetX = Math.cos(tangent + Math.PI / 2) * lateral;
    const offsetY = Math.sin(tangent + Math.PI / 2) * lateral;
    ctx.fillStyle = colorToRgbaString(progressColor, alpha);
    this.applyCanvasShadow(ctx, colorToRgbaString(progressColor, alpha * 0.65), radius * 3.2);
    ctx.beginPath();
    ctx.arc(position.x + offsetX, position.y + offsetY, radius, 0, Math.PI * 2);
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
      const offsetX = Math.cos(tangent + Math.PI / 2) * lateral;
      const offsetY = Math.sin(tangent + Math.PI / 2) * lateral;
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
      ctx.arc(x, y, radius, 0, Math.PI * 2);
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
    ctx.arc(anchor.x, anchor.y, anchorRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (target) {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(139, 247, 255, 0.42)';
    ctx.lineWidth = Math.max(1.2, anchorRadius * 0.08);
    ctx.setLineDash([4, 4]);
    ctx.arc(target.x, target.y, anchorRadius * 0.55, 0, Math.PI * 2);
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
  ctx.arc(0, 0, radius * 1.1, 0, Math.PI * 2);
  ctx.fill();

  const spriteReady = enemyGateSprite?.complete && enemyGateSprite.naturalWidth > 0;
  if (spriteReady) {
    const spriteSize = Math.max(baseSize * 2, 40) * 2 * TRACK_GATE_SIZE_SCALE * ENEMY_GATE_SYMBOL_SCALE;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(enemyGateSprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
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
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  this.applyCanvasShadow(ctx, 'rgba(255, 228, 120, 0.55)', radius);
  ctx.strokeStyle = 'rgba(255, 228, 120, 0.85)';
  ctx.lineWidth = Math.max(2, radius * 0.12);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.88, 0, Math.PI * 2);
  ctx.stroke();

  const spriteReady = mindGateSprite?.complete && mindGateSprite.naturalWidth > 0;
  if (spriteReady) {
    const spriteSize = Math.max(baseSize * 2.1, 46) * 2 * TRACK_GATE_SIZE_SCALE;
    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.drawImage(mindGateSprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
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

  const gateIntegrity = Math.max(0, Math.floor(this.lives || 0));
  const maxIntegrity = Math.max(
    gateIntegrity,
    Math.floor(this.levelConfig?.lives || gateIntegrity || 1),
  );
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
  ctx.fillText(speedText, renderWidth / 2, 12);
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
    ctx.arc(marker.x, marker.y, radius, 0, Math.PI * 2);
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
        const angle = ratio * Math.PI * 2;
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
        ctx.arc(0, 0, radius * 1.12, 0, Math.PI * 2);
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
  ctx.arc(tower.x, tower.y, ringRadius, 0, Math.PI * 2);
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
  ctx.arc(position.x, position.y, Math.max(12, radius), 0, Math.PI * 2);
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
    ctx.arc(mergeTarget.x, mergeTarget.y, Math.max(16, (radius || 24) * 0.6), 0, Math.PI * 2);
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
  ctx.arc(position.x, position.y, bodyRadius, 0, Math.PI * 2);
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
    ctx.arc(position.x, position.y, anchorRadius, 0, Math.PI * 2);
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
    ctx.arc(x, y, size, 0, Math.PI * 2);
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
  ctx.arc(tower.x, tower.y, radius, 0, Math.PI * 2);
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
      ctx.arc(tower.x, tower.y, bodyRadius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (Number.isFinite(rangeRadius) && rangeRadius > 0) {
      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = visuals.rangeStroke || 'rgba(139, 247, 255, 0.2)';
      ctx.setLineDash([8, 6]);
      ctx.arc(tower.x, tower.y, rangeRadius, 0, Math.PI * 2);
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
    ctx.arc(tower.x, tower.y, bodyRadius, 0, Math.PI * 2);
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
      ctx.arc(tower.x, tower.y, bodyRadius + 6, 0, Math.PI * 2);
      ctx.stroke();
      this.clearCanvasShadow(ctx);
    }

    if (this.activeTowerMenu?.towerId === tower.id) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(139, 247, 255, 0.9)';
      ctx.lineWidth = 2.6;
      ctx.arc(tower.x, tower.y, bodyRadius + 10, 0, Math.PI * 2);
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
      impacted.set(pickedParticle, randomBetween(-Math.PI / 3, Math.PI / 3));
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
  const angle = Math.random() * Math.PI * 2;
  const scale = Math.max(0.65, Math.min(1.45, metrics.scale || 1));
  const size = randomBetween(0.9, 2.3) * scale;
  const jitter = Math.random();
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
      particle.targetAngle = Math.random() * Math.PI * 2;
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
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
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
  const alphaBase = inversionActive ? 0.55 : 0.85;
  entry.particles.forEach((particle) => {
    advanceEnemySwirlParticle(particle, metrics, now);
    const radius = clamp(particle.currentRadius ?? metrics.ringRadius, 0, metrics.ringRadius);
    const angle = Number.isFinite(particle.currentAngle) ? particle.currentAngle : 0;
    const basePosition = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    const jitterSeed = Number.isFinite(particle.startAngle) ? particle.startAngle : angle;
    const position = applyEnemySwirlImpactOffset(entry, particle, basePosition, now, jitterSeed) || basePosition;
    const alpha = clamp(alphaBase * (particle.state === 'hold' ? 0.9 : 0.7 + Math.random() * 0.2), 0.25, 0.95);
    ctx.beginPath();
    ctx.fillStyle = colorToRgbaString(particle.color || sampleEnemyParticleColor(), alpha);
    const size = Math.max(0.6, particle.size || 1.2);
    ctx.arc(position.x, position.y, size, 0, Math.PI * 2);
    ctx.fill();
    // Outline each mote with a bright gate-gold halo so the swirl reads clearly against dark bodies.
    ctx.lineWidth = Math.max(0.2, size * 0.25);
    ctx.strokeStyle = colorToRgbaString(ENEMY_GATE_SYMBOL_GOLD, Math.min(1, alpha + 0.1));
    ctx.stroke();
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
  ctx.arc(0, 0, metrics.ringRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = inversionActive ? 'rgba(12, 18, 28, 0.42)' : ENEMY_GATE_DARK_BLUE_CORE;
  ctx.arc(0, 0, metrics.coreRadius, 0, Math.PI * 2);
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
  const timestamp = fallbackRendering ? 0 : getNowTimestamp();
  const activeEnemies = fallbackRendering ? null : new Set();
  if (fallbackRendering && this.enemySwirlParticles) {
    this.enemySwirlParticles.clear();
  }
  if (fallbackRendering && Array.isArray(this.enemySwirlImpacts)) {
    this.enemySwirlImpacts.length = 0;
  }

  // Calculate viewport bounds once for all enemies
  const viewportBounds = getViewportBounds.call(this);

  this.enemies.forEach((enemy) => {
    if (!enemy) {
      return;
    }

    const position = this.getEnemyPosition(enemy);
    if (!position) {
      return;
    }

    // Skip rendering enemies outside viewport
    if (viewportBounds && !isInViewport(position, viewportBounds, 100)) {
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

    ctx.save();
    ctx.translate(position.x, position.y);
    
    // Apply tunnel opacity
    if (tunnelState.inTunnel || tunnelState.isFadeZone) {
      ctx.globalAlpha = tunnelState.opacity;
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

    if (this.focusedEnemyId === enemy.id) {
      const markerRadius = metrics.focusRadius || metrics.ringRadius + 8;
      const angle = this.focusMarkerAngle || 0;
      const span = Math.PI / 3;
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

  // Calculate viewport bounds once for all death particles
  const viewportBounds = getViewportBounds.call(this);

  this.enemyDeathParticles.forEach((particle) => {
    if (!particle || !particle.position) {
      return;
    }
    const alpha = clamp(Number.isFinite(particle.alpha) ? particle.alpha : 1, 0, 1);
    if (alpha <= 0) {
      return;
    }
    
    // Skip rendering death particles outside viewport
    if (viewportBounds && !isInViewport(particle.position, viewportBounds, 30)) {
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
    ctx.arc(x, y, size, 0, Math.PI * 2);
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
    ctx.arc(x, y, effectiveRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw inner core
    const coreRadius = effectiveRadius * 0.3;
    const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, coreRadius);
    coreGradient.addColorStop(0, colorToRgbaString(color2, alpha * 0.6));
    coreGradient.addColorStop(1, colorToRgbaString(color1, 0));
    
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
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

  // Calculate viewport bounds once for all damage numbers
  const viewportBounds = getViewportBounds.call(this);

  this.damageNumbers.forEach((entry) => {
    if (!entry || !entry.position || !entry.text || entry.alpha <= 0) {
      return;
    }
    
    // Skip rendering damage numbers outside viewport
    if (viewportBounds && !isInViewport(entry.position, viewportBounds, 50)) {
      return;
    }
    
    const fontSize = Number.isFinite(entry.fontSize) ? entry.fontSize : 16;
    // Fade the highlight outline based on how much of the target's health the hit removed.
    const highlightAlpha = Number.isFinite(entry.outlineAlpha)
      ? Math.max(0, Math.min(1, entry.outlineAlpha))
      : 0;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, entry.alpha));
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
    ctx.restore();
  });

  ctx.restore();
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
    let clipX = entry.position.x - fullWidth / 2;
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
  // Calculate viewport bounds once for all projectiles
  const viewportBounds = getViewportBounds.call(this);
  let renderedCount = 0;
  let culledCount = 0;

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
      const cullRadius = projectile.patternType === 'etaLaser' ? 300 :
                        projectile.patternType === 'omegaWave' ? 200 :
                        projectile.patternType === 'iotaPulse' ? 150 : 50;
      
      if (!isInViewport(projectilePosition, viewportBounds, cullRadius)) {
        culledCount++;
        return;
      }
    }
    
    renderedCount++;

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
          ctx.arc(seed.position.x, seed.position.y, size, 0, Math.PI * 2);
          ctx.fill();
        });
      } else {
        const color = normalizeProjectileColor(projectile.color, 1);
        ctx.fillStyle = colorToRgbaString(color, 0.85);
        ctx.beginPath();
        ctx.arc(position.x, position.y, 4, 0, Math.PI * 2);
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
      ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
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
      ctx.arc(origin.x, origin.y, currentRadius, 0, Math.PI * 2);
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
      ctx.save();
      ctx.translate(position.x, position.y);
      ctx.rotate(heading);
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
      ctx.restore();
      return;
    }

    const source = projectile.source;
    const targetPosition = projectile.target
      ? projectile.target
      : projectile.targetId
      ? (() => {
          const enemy = this.enemies.find((candidate) => candidate.id === projectile.targetId);
          return enemy ? this.getEnemyPosition(enemy) : null;
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
    ctx.arc(targetPosition.x, targetPosition.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  if (this.projectiles.length) {
    ctx.restore();
  }

  this.drawBetaBursts();
  this.drawAlphaBursts();
  this.drawGammaBursts();
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
  ctx.arc(position.x, position.y, scaledRingRadius, 0, Math.PI * 2);
  ctx.stroke();

  options.forEach((option) => {
    if (!option) {
      return;
    }
    const angle = ((Number.isFinite(option.angle) ? option.angle : 0) + rotationOffset) % (Math.PI * 2);
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
    ctx.arc(optionX, optionY, scaledOptionRadius, 0, Math.PI * 2);
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
  drawWaveTallies,
  drawProjectiles,
  drawAlphaBursts,
  drawBetaBursts,
  drawGammaBursts,
  drawNuBursts,
  drawOmegaParticles,
  drawTowerMenu,
};

