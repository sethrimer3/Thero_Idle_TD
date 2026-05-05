// SupplyChainSystem.js — extracted from playfield.js (Build 714)
// Handles inter-tower supply projectile routing, impact resolution, σ targeting,
// particle damage helpers, and β slow application.
// All exported functions operate with `this` bound to a SimplePlayfield instance
// via the Object.assign prototype-delegation pattern.

import { computeTowerVariableValue } from '../../towersTab.js';

// Duration of the β triangle slow debuff. Overridden by the slwTime upgrade variable when set.
const BETA_SLOW_DURATION_SECONDS = 0.5;

/**
 * Route a connected lattice's cadence into its downstream partner instead of enemies.
 * Called each update tick for towers that have a linkTargetId (α→β, β→γ, α/β/γ→ι).
 */
export function updateConnectionSupplier(tower, _delta) {
  if (!tower || !tower.linkTargetId) {
    return;
  }
  const target = this.getTowerById(tower.linkTargetId);
  if (!target) {
    this.removeTowerConnection(tower.id, tower.linkTargetId);
    return;
  }
  if (!this.combatActive) {
    return;
  }
  if (tower.cooldown > 0) {
    return;
  }
  const rate = Number.isFinite(tower.rate) ? Math.max(0, tower.rate) : 0;
  if (rate <= 0) {
    tower.cooldown = 0;
    return;
  }
  const baseCooldown = 1 / Math.max(0.0001, rate);
  if (tower.type === 'alpha' && target.type === 'beta') {
    this.spawnSupplyProjectile(tower, target, { payload: { type: 'alpha' } });
    tower.cooldown = baseCooldown;
    return;
  }
  if (tower.type === 'beta' && target.type === 'gamma') {
    const payload = {
      type: 'beta',
      alphaShots: Math.max(0, tower.storedAlphaShots || 0),
    };
    tower.storedAlphaShots = 0;
    tower.storedAlphaSwirl = 0;
    this.spawnSupplyProjectile(tower, target, { payload });
    tower.cooldown = baseCooldown;
    return;
  }
  if (tower.type === 'alpha' && target.type === 'iota') {
    this.spawnSupplyProjectile(tower, target, { payload: { type: 'alpha' } });
    tower.cooldown = baseCooldown;
    return;
  }
  if (tower.type === 'beta' && target.type === 'iota') {
    const payload = {
      type: 'beta',
      alphaShots: Math.max(0, tower.storedAlphaShots || 0),
    };
    tower.storedAlphaShots = 0;
    tower.storedAlphaSwirl = 0;
    this.spawnSupplyProjectile(tower, target, { payload });
    tower.cooldown = baseCooldown;
    return;
  }
  if (tower.type === 'gamma' && target.type === 'iota') {
    const payload = {
      type: 'gamma',
      alphaShots: Math.max(0, tower.storedAlphaShots || 0),
      betaShots: Math.max(0, tower.storedBetaShots || 0),
    };
    tower.storedAlphaShots = 0;
    tower.storedBetaShots = 0;
    tower.storedAlphaSwirl = 0;
    tower.storedBetaSwirl = 0;
    this.spawnSupplyProjectile(tower, target, { payload });
    tower.cooldown = baseCooldown;
    return;
  }
  this.removeTowerConnection(tower.id, target.id);
}

/**
 * Locate the nearest σ lattice within range so idle towers can feed it.
 */
export function findSigmaFriendlyTarget(tower) {
  if (!tower || tower.type === 'sigma') {
    return null;
  }
  const range = Number.isFinite(tower.range) ? tower.range : 0;
  if (range <= 0) {
    return null;
  }
  let selected = null;
  let nearest = Infinity;
  this.towers.forEach((candidate) => {
    if (!candidate || candidate.type !== 'sigma' || candidate.id === tower.id) {
      return;
    }
    const distance = Math.hypot(candidate.x - tower.x, candidate.y - tower.y);
    if (distance > range) {
      return;
    }
    if (distance < nearest) {
      selected = { sigma: candidate, position: { x: candidate.x, y: candidate.y } };
      nearest = distance;
    }
  });
  return selected;
}

/**
 * Apply a delivered supply shot to its destination lattice.
 * Called from ProjectileUpdateSystem when a supply projectile reaches its tower target.
 */
export function handleSupplyImpact(projectile) {
  if (!projectile || !projectile.targetTowerId) {
    return;
  }
  const target = this.getTowerById(projectile.targetTowerId);
  if (!target) {
    return;
  }
  const payload = projectile.payload || {};
  if (payload.type === 'alpha') {
    target.storedAlphaShots = Math.min(999, (target.storedAlphaShots || 0) + 1);
    target.storedAlphaSwirl = Math.min(30, (target.storedAlphaSwirl || 0) + 3);
    this.transferSupplySeedsToOrbit(target, projectile);
    return;
  }
  if (payload.type === 'beta') {
    target.storedBetaShots = Math.min(999, (target.storedBetaShots || 0) + 1);
    target.storedBetaSwirl = Math.min(30, (target.storedBetaSwirl || 0) + 3);
    const alphaShots = Math.max(0, payload.alphaShots || 0);
    if (alphaShots > 0) {
      target.storedAlphaShots = Math.min(999, (target.storedAlphaShots || 0) + alphaShots);
      target.storedAlphaSwirl = Math.min(30, (target.storedAlphaSwirl || 0) + alphaShots * 3);
    }
    this.transferSupplySeedsToOrbit(target, projectile);
    return;
  }
  if (payload.type === 'gamma') {
    target.storedGammaShots = Math.min(999, (target.storedGammaShots || 0) + 1);
    const betaShots = Math.max(0, payload.betaShots || 0);
    if (betaShots > 0) {
      target.storedBetaShots = Math.min(999, (target.storedBetaShots || 0) + betaShots);
      target.storedBetaSwirl = Math.min(30, (target.storedBetaSwirl || 0) + betaShots * 3);
    }
    const alphaShots = Math.max(0, payload.alphaShots || 0);
    if (alphaShots > 0) {
      target.storedAlphaShots = Math.min(999, (target.storedAlphaShots || 0) + alphaShots);
      target.storedAlphaSwirl = Math.min(30, (target.storedAlphaSwirl || 0) + alphaShots * 3);
    }
    this.transferSupplySeedsToOrbit(target, projectile);
  }
}

/**
 * Create a damage projectile with travel time for towers that use particle burst effects.
 * The projectile damages the enemy when it arrives at effectPosition after travelTime seconds.
 */
export function createParticleDamageProjectile(tower, enemy, effectPosition, resolvedDamage, baseTravelSpeed) {
  if (!tower || !enemy || !resolvedDamage || resolvedDamage <= 0) {
    return;
  }
  if (!Number.isFinite(baseTravelSpeed) || baseTravelSpeed <= 0) {
    baseTravelSpeed = 300; // Default fallback speed
  }
  const sourcePosition = { x: tower.x, y: tower.y };
  const targetPosition = effectPosition || sourcePosition;
  const travelDistance = Math.hypot(targetPosition.x - sourcePosition.x, targetPosition.y - sourcePosition.y);
  const travelTime = Math.max(0.08, travelDistance / baseTravelSpeed);
  const maxLifetime = Math.max(0.24, travelTime);
  this.projectiles.push({
    source: sourcePosition,
    targetId: enemy.id,
    target: targetPosition,
    lifetime: 0,
    maxLifetime,
    travelTime,
    damage: resolvedDamage,
    towerId: tower.id,
    hitRadius: this.getStandardShotHitRadius(),
  });
}

/**
 * Alternate β triangle shots so successive returns mirror across the firing line.
 * Returns +1 or −1 and toggles the tower's nextBetaTriangleOrientation state.
 */
export function resolveNextBetaTriangleOrientation(tower) {
  if (!tower) {
    return 1;
  }
  const lastOrientation = Number.isFinite(tower.nextBetaTriangleOrientation)
    ? tower.nextBetaTriangleOrientation
    : 1;
  const orientation = lastOrientation === -1 ? -1 : 1;
  tower.nextBetaTriangleOrientation = orientation * -1;
  return orientation;
}

/**
 * Apply the β slow formula while a triangle bolt is attached to an enemy.
 * Slow percent scales from 20% base up to 60% at high glyph rank.
 */
export function applyBetaStickSlow(enemy, tower, glyphRank = 0) {
  if (!enemy || !tower) {
    return;
  }
  const bet1 = Math.max(0, Number.isFinite(glyphRank) ? glyphRank : 0);
  const slowPercent = Math.min(60, 20 + 2 * bet1);
  const multiplier = Math.max(0, 1 - slowPercent / 100);
  const slwTime = computeTowerVariableValue('beta', 'slwTime');
  const slowDurationSeconds = Number.isFinite(slwTime)
    ? Math.max(0, slwTime)
    : BETA_SLOW_DURATION_SECONDS;
  const expiresAt =
    (typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now()) /
    1000 +
    slowDurationSeconds;
  if (!(enemy.slowEffects instanceof Map)) {
    enemy.slowEffects = new Map();
  }
  enemy.slowEffects.set(tower.id, {
    type: 'beta',
    multiplier,
    slowPercent,
    expiresAt,
  });
}
