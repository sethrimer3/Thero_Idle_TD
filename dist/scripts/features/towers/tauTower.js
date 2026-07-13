/**
 * Tau (τ) Tower - Spiral Return Projectiles
 *
 * Mechanics:
 * - Fires slow-moving spiral bullets that start at the tower, expand outward, then return.
 * - Each bullet follows a polar spiral path defined by r(u) = R_max * sin(πu) and θ(u) = 2π * turns * u.
 * - Bullets disappear when they reach the tower again or exhaust their internal particle charges.
 * - Internal circle particles show how many hits remain; each particle represents one hit on an enemy.
 *
 * Formulas:
 * - Normalize time: u = t / T (t is elapsed time, T is total lifetime).
 * - Radius: r(u) = R_max * sin(π * u) with R_max = 1 + ℵ₁ (meters converted to pixels).
 * - Angle: θ(u) = 2π * turns * u.
 * - Cartesian path: x(u) = cx + r(u) * cos(θ(u)), y(u) = cy + r(u) * sin(θ(u)).
 * - spd = 1 + 0.1 × ℵ₂ (attacks per second and spiral playback speed).
 * - Particles: p = 1 + ℵ₃ (hit charges stored inside each bullet).
 */

import {
  calculateTowerEquationResult,
  computeTowerVariableValue,
  getTowerEquationBlueprint,
} from '../../../assets/towersTab.js';
import { metersToPixels } from '../../../assets/gameUnits.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

// Base timing so spirals feel deliberate even at low upgrade counts.
const BASE_LIFETIME_SECONDS = 3.5;
// Spiral completes multiple revolutions before returning home.
const BASE_TURNS = 2;
// Visual radius of the bullet body in pixels.
const TAU_BULLET_RADIUS = 10;
// Internal particle size so hit charges remain legible.
const TAU_PARTICLE_RADIUS = 2.4;
// Cooldown between consecutive hits against the same enemy to avoid rapid stacking.
const TAU_HIT_COOLDOWN = 0.18;
// Minimum radius for spiral conversion when playfield metrics are missing.
const MIN_RADIUS_PIXELS = 24;

/**
 * Normalize palette-derived colors into reliable RGB structures.
 */
function normalizeColor(color) {
  if (!color || typeof color !== 'object') {
    return null;
  }
  const { r, g, b } = color;
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return null;
  }
  return {
    r: Math.max(0, Math.min(255, Math.round(r))),
    g: Math.max(0, Math.min(255, Math.round(g))),
    b: Math.max(0, Math.min(255, Math.round(b))),
  };
}

/**
 * Resolve a soft cyan-magenta hue from the active palette with a fallback.
 */
function resolveTauColor(progress = 0) {
  const color = normalizeColor(samplePaletteGradient(progress % 1));
  if (color) {
    return color;
  }
  return { r: 180, g: 225, b: 255 };
}

/**
 * Generate floating particle offsets to visualize remaining hit charges.
 */
function createInternalParticles(count) {
  const particles = [];
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * (TAU_BULLET_RADIUS * 0.5);
    particles.push({
      baseAngle: angle,
      radius,
      wobble: Math.random() * 0.8 + 0.4,
    });
  }
  return particles;
}

/**
 * Resolve minimum playfield dimension so meter-to-pixel conversion stays consistent.
 * Caches the last valid dimension to prevent sudden range changes.
 */
let cachedPlayfieldDimension = null;

function resolvePlayfieldMinDimension(playfield) {
  const candidates = [];
  if (Number.isFinite(playfield?.renderWidth) && playfield.renderWidth > 0) {
    candidates.push(playfield.renderWidth);
  }
  if (Number.isFinite(playfield?.renderHeight) && playfield.renderHeight > 0) {
    candidates.push(playfield.renderHeight);
  }
  
  if (candidates.length) {
    const minDimension = Math.min(...candidates);
    cachedPlayfieldDimension = minDimension;
    return minDimension;
  }
  
  // Use cached value if available
  if (cachedPlayfieldDimension !== null && cachedPlayfieldDimension > 0) {
    return cachedPlayfieldDimension;
  }
  
  // Fallback to reasonable default (800px is a common canvas size)
  console.warn('τ tower: playfield dimensions not available, using fallback value of 800px');
  return 800;
}

/**
 * Refresh τ parameters from tower equations and update tower stats for UI display.
 */
function refreshTauParameters(playfield, tower, state) {
  const blueprint = getTowerEquationBlueprint('tau');
  const aleph1 = Math.max(0, computeTowerVariableValue('tau', 'aleph1', blueprint) || 0);
  const aleph2 = Math.max(0, computeTowerVariableValue('tau', 'aleph2', blueprint) || 0);
  const aleph3 = Math.max(0, computeTowerVariableValue('tau', 'aleph3', blueprint) || 0);

  // spd = 1 + 0.1 × ℵ₂
  const attackSpeed = 1 + 0.1 * aleph2;
  // R_max = 1 + ℵ₁ meters
  const maxRadiusMeters = 1 + aleph1;
  // p = 1 + ℵ₃ internal hit particles
  const particleCount = Math.max(1, Math.floor(1 + aleph3));
  const turns = BASE_TURNS;

  const minDimension = resolvePlayfieldMinDimension(playfield);
  const rMaxPixels = Math.max(MIN_RADIUS_PIXELS, metersToPixels(maxRadiusMeters, minDimension));
  const lifetime = BASE_LIFETIME_SECONDS / Math.max(0.1, attackSpeed);

  const damage = Math.max(0, calculateTowerEquationResult('tau') || tower.baseDamage || tower.damage || 0);

  state.parameters = {
    attackSpeed,
    rMaxPixels,
    lifetime,
    particleCount,
    turns,
  };

  tower.baseRange = rMaxPixels;
  tower.range = rMaxPixels;
  tower.baseRate = attackSpeed;
  tower.rate = attackSpeed;
  tower.baseDamage = damage;
  tower.damage = damage;
}

/**
 * Ensure τ state container exists.
 */
function ensureTauStateInternal(playfield, tower) {
  if (!tower.tauState) {
    tower.tauState = {
      projectiles: [],
      recalcTimer: 0,
      colorOffset: 0,
      parameters: null,
    };
  }
  return tower.tauState;
}

/**
 * Create a new spiral projectile anchored to the tower position.
 */
function createTauProjectile(playfield, tower, state, targetInfo) {
  const params = state.parameters;
  const originAngle = targetInfo?.position
    ? Math.atan2(targetInfo.position.y - tower.y, targetInfo.position.x - tower.x)
    : 0;
  state.colorOffset = (state.colorOffset + 0.17) % 1;

  return {
    age: 0,
    maxAge: params.lifetime,
    originAngle,
    turns: params.turns,
    rMax: params.rMaxPixels,
    color: resolveTauColor(state.colorOffset),
    hitsRemaining: params.particleCount,
    particles: createInternalParticles(params.particleCount),
    hitCooldowns: new Map(),
    position: { x: tower.x, y: tower.y },
  };
}

/**
 * Update spiral kinematics and apply collision checks for a projectile.
 */
function updateTauProjectile(playfield, tower, projectile, delta, parameters) {
  projectile.age += delta;
  const u = Math.min(1, Math.max(0, projectile.age / projectile.maxAge));
  const radius = parameters.rMaxPixels * Math.sin(Math.PI * u);
  const theta = projectile.originAngle + Math.PI * 2 * parameters.turns * u;
  const x = tower.x + radius * Math.cos(theta);
  const y = tower.y + radius * Math.sin(theta);

  projectile.position = { x, y };

  const enemies = Array.isArray(playfield?.enemies) ? playfield.enemies : [];
  enemies.forEach((enemy) => {
    if (!enemy || enemy.hp <= 0 || projectile.hitsRemaining <= 0) {
      return;
    }

    const enemyPos = playfield.getEnemyPosition(enemy);
    const metrics = typeof playfield.getEnemyVisualMetrics === 'function'
      ? playfield.getEnemyVisualMetrics(enemy)
      : null;
    const enemyRadius = typeof playfield.getEnemyHitRadius === 'function'
      ? playfield.getEnemyHitRadius(enemy, metrics)
      : 16;

    const distance = Math.hypot(enemyPos.x - x, enemyPos.y - y);
    if (distance > enemyRadius + TAU_BULLET_RADIUS) {
      return;
    }

    const lastHit = projectile.hitCooldowns.get(enemy.id) || -Infinity;
    if (projectile.age - lastHit < TAU_HIT_COOLDOWN) {
      return;
    }

    playfield.applyDamageToEnemy(enemy, tower.damage, { sourceTower: tower });
    projectile.hitsRemaining -= 1;
    projectile.hitCooldowns.set(enemy.id, projectile.age);
  });

  return projectile.age < projectile.maxAge && projectile.hitsRemaining > 0;
}

/**
 * Animate τ internal particles so charges drift within the spiral shell.
 */
function drawTauParticles(ctx, projectile) {
  const { position, particles, color } = projectile;
  particles.forEach((particle, index) => {
    const wobble = Math.sin(projectile.age * 3 + particle.baseAngle * 2 + index) * particle.wobble;
    const angle = particle.baseAngle + projectile.age * 2;
    const px = position.x + Math.cos(angle) * particle.radius + wobble;
    const py = position.y + Math.sin(angle) * particle.radius + wobble;
    ctx.beginPath();
    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.9)`;
    ctx.arc(px, py, TAU_PARTICLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * Draw τ spiral projectiles and their inner hit particles.
 */
export function drawTauProjectiles(playfield, tower) {
  if (!playfield?.ctx || !tower?.tauState) {
    return;
  }

  const ctx = playfield.ctx;
  const projectiles = Array.isArray(tower.tauState.projectiles) ? tower.tauState.projectiles : [];
  if (!projectiles.length) {
    return;
  }

  projectiles.forEach((projectile) => {
    const { position, color, hitsRemaining } = projectile;
    const alpha = Math.max(0.35, hitsRemaining / Math.max(1, projectile.particles?.length || hitsRemaining));
    const gradient = ctx.createRadialGradient(position.x, position.y, 0, position.x, position.y, TAU_BULLET_RADIUS);
    gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`);
    gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0.1)`);

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(position.x, position.y, TAU_BULLET_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 1.2;
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.65)`;
    ctx.beginPath();
    ctx.arc(position.x, position.y, TAU_BULLET_RADIUS + 1.5, 0, Math.PI * 2);
    ctx.stroke();

    drawTauParticles(ctx, projectile);
    ctx.restore();
  });
}

/**
 * Ensure τ state exists and refresh parameters on a fixed cadence.
 */
export function ensureTauState(playfield, tower) {
  if (!playfield || !tower || tower.type !== 'tau') {
    return null;
  }
  const state = ensureTauStateInternal(playfield, tower);
  if (!state.parameters) {
    refreshTauParameters(playfield, tower, state);
  }
  return state;
}

/**
 * Spawn a τ spiral projectile using the current tower parameters.
 */
export function spawnTauProjectile(playfield, tower, targetInfo) {
  if (!playfield || !tower || tower.type !== 'tau') {
    return;
  }
  const state = ensureTauStateInternal(playfield, tower);
  if (!state.parameters) {
    refreshTauParameters(playfield, tower, state);
  }
  const projectile = createTauProjectile(playfield, tower, state, targetInfo);
  state.projectiles.push(projectile);
}

/**
 * Update τ projectile motion and refresh cached parameters.
 */
export function updateTauTower(playfield, tower, delta) {
  if (!playfield || !tower || tower.type !== 'tau') {
    return;
  }
  const state = ensureTauStateInternal(playfield, tower);
  state.recalcTimer = (state.recalcTimer || 0) - delta;
  if (state.recalcTimer <= 0 || !state.parameters) {
    refreshTauParameters(playfield, tower, state);
    state.recalcTimer = 0.35;
  }

  const parameters = state.parameters;
  state.projectiles = state.projectiles.filter((projectile) =>
    updateTauProjectile(playfield, tower, projectile, delta, parameters),
  );
}

/**
 * Clear τ state when the tower is removed or retuned.
 */
export function teardownTauTower(playfield, tower) {
  if (!tower?.tauState) {
    return;
  }
  tower.tauState.projectiles = [];
  tower.tauState = null;
}
