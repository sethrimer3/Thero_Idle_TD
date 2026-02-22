/**
 * Enemy Renderer
 *
 * Handles all enemy visual rendering for the playfield:
 * - Enemy body (swirl particle ring, fallback circle)
 * - Enemy symbol and exponent overlay
 * - Enemy shell sprites (front/back layers)
 * - Debuff status bar (iota, rho, theta, derivative-shield)
 * - Rho sparkle ring effect
 * - Enemy death particle fragments
 * - Swarm cloud visual effects
 *
 * All exported functions are designed to be called with `.call(renderer)` where
 * `renderer` is the CanvasRenderer / SimplePlayfield instance, matching the
 * established calling convention in CanvasRenderer.js.
 *
 * Extracted from CanvasRenderer.js as part of Phase 2.2.4 of the Monolithic
 * Refactoring Plan (Build 489).
 */

import { samplePaletteGradient } from '../../../colorSchemeUtils.js';
import { colorToRgbaString } from '../../../../scripts/features/towers/powderTower.js';
import { getEnemyShellSprites } from '../../../enemies.js';
import { areEnemyParticlesEnabled } from '../../../preferences.js';

// Enemy particle sprite for swirl ring (star particle sprites are more
// visually distinct than plain circles at low resolution).
const ENEMY_PARTICLE_SPRITE_URL = 'assets/sprites/enemies/particles/star_particle.png';
const enemyParticleSprite = new Image();
enemyParticleSprite.src = ENEMY_PARTICLE_SPRITE_URL;
enemyParticleSprite.decoding = 'async';
enemyParticleSprite.loading = 'eager';

// ─── Constants ────────────────────────────────────────────────────────────────

// Swirl particle timing (milliseconds) keeps the ring orbiting fluidly without
// every particle cycling in sync.
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

// ─── Utility constants (duplicated from CanvasRenderer for a self-contained module) ───
const TWO_PI = Math.PI * 2;
const PI = Math.PI;
const PI_OVER_3 = Math.PI / 3;
const HALF = 0.5;
// Viewport culling margin: buffer zone beyond visible area to prevent pop-in
const VIEWPORT_CULL_MARGIN = 100;
// Entity culling radii
const ENEMY_CULL_RADIUS = 100;
const DEATH_PARTICLE_CULL_RADIUS = 30;

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

function randomBetween(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return min;
  }
  if (max <= min) {
    return min;
  }
  return min + Math.random() * (max - min);
}

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
  this.applyCanvasShadow(ctx, RHO_SPARKLE_GLOW, Math.max(2, metrics.scale * 2));
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
  this.clearCanvasShadow(ctx);
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
  const impulse = Math.sin(progress * PI);
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

// ─── Exported render functions ────────────────────────────────────────────────

export function drawEnemies() {
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
      ctx.arc(0, 0, markerRadius, angle + PI, angle + PI + span);
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
export function drawEnemyDeathParticles() {
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

export function drawSwarmClouds() {
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
