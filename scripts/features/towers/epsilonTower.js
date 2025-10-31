// ε tower: fires a continuous volley of homing needles that ramp damage per target.
import { getTowerDefinition } from '../../../assets/towersTab.js';

function metersToPixels(meters, minDimension) {
  const base = Math.max(1, Number.isFinite(minDimension) ? minDimension : 1);
  // Playfield meters map proportionally to minDimension; reuse same convention as other towers.
  return meters * (base / 10);
}

export function ensureEpsilonState(playfield, tower) {
  if (!tower || tower.type !== 'epsilon') {
    return null;
  }
  const def = tower.definition || getTowerDefinition('epsilon') || {};
  const baseDamage = Math.max(1, Number.isFinite(tower.baseDamage) ? tower.baseDamage : def.damage || 1);
  const rate = Math.max(0.2, Number.isFinite(tower.rate) ? tower.rate : def.rate || 1);
  const minDim = Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) || 1;
  const rangeMeters = Number.isFinite(tower.rangeMeters)
    ? tower.rangeMeters
    : Number.isFinite(def.range)
    ? def.range * 10
    : 3;
  const rangePixels = metersToPixels(rangeMeters, minDim);

  if (!tower.epsilonState) {
    tower.epsilonState = {
      baseDamage,
      rate,
      rangePixels,
      fireCooldown: 0,
      stacks: new Map(), // enemyId -> hit count
    };
  } else {
    tower.epsilonState.baseDamage = baseDamage;
    tower.epsilonState.rate = rate;
    tower.epsilonState.rangePixels = rangePixels;
  }
  return tower.epsilonState;
}

export function updateEpsilonTower(playfield, tower, delta) {
  const state = ensureEpsilonState(playfield, tower);
  if (!state || !playfield?.combatActive) {
    return;
  }

  state.fireCooldown = Math.max(0, (state.fireCooldown || 0) - Math.max(0, delta || 0));
  if (state.fireCooldown > 0) {
    return;
  }

  // Acquire target within range
  const targetInfo = playfield.findTarget(tower);
  const enemy = targetInfo?.enemy || null;
  if (!enemy) {
    // backoff slightly when no targets
    state.fireCooldown = 0.15;
    return;
  }

  // Spawn a homing needle projectile
  const origin = { x: tower.x, y: tower.y };
  const projectileSpeed = Math.max(180, Math.min(520, state.rangePixels * 2));
  playfield.projectiles.push({
    patternType: 'epsilonNeedle',
    origin,
    position: { ...origin },
    velocity: { x: 0, y: -projectileSpeed },
    speed: projectileSpeed,
    maxLifetime: 3.5,
    lifetime: 0,
    towerId: tower.id,
    enemyId: enemy.id,
    damage: state.baseDamage,
    turnRate: Math.PI * 2.2, // radians per second steering
    hitRadius: 6,
  });

  const shotsPerSecond = Math.max(0.2, state.rate);
  state.fireCooldown = 1 / shotsPerSecond;
}

export function applyEpsilonHit(playfield, tower, enemyId) {
  const state = ensureEpsilonState(playfield, tower);
  if (!state) {
    return;
  }
  const current = state.stacks.get(enemyId) || 0;
  const next = current + 1;
  state.stacks.set(enemyId, next);
  return next;
}


