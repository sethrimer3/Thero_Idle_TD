// ε tower: fires a continuous volley of homing needles that ramp damage per target.
import { getTowerDefinition, computeTowerVariableValue } from '../../../assets/towersTab.js';
import { playTowerFireSound } from '../../../assets/audioSystem.js';
import { metersToPixels } from '../../../assets/gameUnits.js';

export function ensureEpsilonState(playfield, tower) {
  if (!tower || tower.type !== 'epsilon') {
    return null;
  }
  const def = tower.definition || getTowerDefinition('epsilon') || {};
  // Aleph variables controlled by glyph upgrades
  const aleph1 = Math.max(0, computeTowerVariableValue('epsilon', 'aleph1'));
  const aleph2 = Math.max(0, computeTowerVariableValue('epsilon', 'aleph2'));
  const aleph3 = Math.max(1e-6, computeTowerVariableValue('epsilon', 'aleph3'));

  // Spd = 10 · log(aleph1 + 1) shots per second
  const rate = Math.max(0.2, 10 * Math.log(aleph1 + 1));
  const minDim = Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) || 1;
  // Rng = 5 · log(aleph2 + 2) meters
  const rangeMeters = 5 * Math.log(aleph2 + 2);
  const rangePixels = metersToPixels(rangeMeters, minDim);
  // Spr = 2(10 - aleph3 * log(aleph3)) in degrees
  const spreadDegrees = 2 * (10 - aleph3 * Math.log(aleph3));

  if (!tower.epsilonState) {
    tower.epsilonState = {
      rate,
      rangePixels,
      spreadDegrees,
      fireCooldown: 0,
      // Sound limiter ensures epsilon notes never exceed 4 plays per second.
      soundCooldown: 0,
      stacks: new Map(), // enemyId -> consecutive hit count
    };
  } else {
    tower.epsilonState.rate = rate;
    tower.epsilonState.rangePixels = rangePixels;
    tower.epsilonState.spreadDegrees = spreadDegrees;
  }
  return tower.epsilonState;
}

export function updateEpsilonTower(playfield, tower, delta) {
  const state = ensureEpsilonState(playfield, tower);
  if (!state || !playfield?.combatActive) {
    return;
  }

  state.fireCooldown = Math.max(0, (state.fireCooldown || 0) - Math.max(0, delta || 0));
  // Count down the epsilon firing note limiter alongside the firing cooldown.
  state.soundCooldown = Math.max(0, (state.soundCooldown || 0) - Math.max(0, delta || 0));
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

  // Spawn a homing needle projectile with spread
  const origin = { x: tower.x, y: tower.y };
  const projectileSpeed = Math.max(220, Math.min(560, state.rangePixels * 2));
  // aim direction to enemy
  const targetPos = playfield.getEnemyPosition(enemy);
  const dx = (targetPos?.x || origin.x) - origin.x;
  const dy = (targetPos?.y || origin.y) - origin.y;
  const baseAngle = Math.atan2(dy, dx);
  const spreadRad = (Math.max(0, state.spreadDegrees || 0) * Math.PI) / 180;
  const offset = (Math.random() - 0.5) * spreadRad; // symmetric spread
  const angle = baseAngle + offset;
  const vx = Math.cos(angle) * projectileSpeed;
  const vy = Math.sin(angle) * projectileSpeed;
  const hitRadius = playfield.getStandardShotHitRadius ? playfield.getStandardShotHitRadius() : 4.2;
  playfield.projectiles.push({
    patternType: 'epsilonNeedle',
    origin,
    position: { ...origin },
    velocity: { x: vx, y: vy },
    speed: projectileSpeed,
    maxLifetime: 3.5,
    lifetime: 0,
    towerId: tower.id,
    enemyId: enemy.id,
    damage: 1,
    turnRate: Math.PI * 2.2, // radians per second steering
    hitRadius,
    stickDuration: 5 + Math.random() * 5, // linger between 5-10s when embedded
    // Pick a gradient position so the needle can be tinted with the active palette.
    paletteRatio: Math.random(),
    alpha: 1,
  });

  if (playfield?.audio && state.soundCooldown <= 0) {
    // Play a randomized epsilon note while keeping playback under 4 Hz.
    playTowerFireSound(playfield.audio, 'epsilon');
    state.soundCooldown = 0.25;
  }

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

