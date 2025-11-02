// Iota tower helper module coordinates splash math, debuff handling, and visuals.
import {
  getTowerEquationBlueprint,
  computeTowerVariableValue,
  calculateTowerEquationResult,
} from '../../../assets/towersTab.js';
import { metersToPixels } from '../../../assets/gameUnits.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

const DEFAULT_PULSE_COLOR = { r: 180, g: 240, b: 255 };
const MIN_PULSE_RADIUS_PX = 32;

function countLinkedSourcesByType(playfield, tower, type) {
  if (!tower?.linkSources || !(tower.linkSources instanceof Set)) {
    return 0;
  }
  let count = 0;
  tower.linkSources.forEach((sourceId) => {
    const source = playfield.getTowerById(sourceId);
    if (source?.type === type) {
      count += 1;
    }
  });
  return count;
}

function resolvePulseColor() {
  const paletteColor = samplePaletteGradient(0.62);
  if (paletteColor) {
    return paletteColor;
  }
  return DEFAULT_PULSE_COLOR;
}

export function ensureIotaState(playfield, tower) {
  if (!playfield || !tower || tower.type !== 'iota') {
    return null;
  }

  const blueprint = getTowerEquationBlueprint('iota');

  const alphaLinks = countLinkedSourcesByType(playfield, tower, 'alpha');
  const betaLinks = countLinkedSourcesByType(playfield, tower, 'beta');
  const gammaLinks = countLinkedSourcesByType(playfield, tower, 'gamma');

  const aleph0 = Math.max(0, computeTowerVariableValue('iota', 'aleph0', blueprint));
  const aleph1 = Math.max(0, computeTowerVariableValue('iota', 'aleph1', blueprint));
  const aleph2 = Math.max(0, computeTowerVariableValue('iota', 'aleph2', blueprint));
  const aleph3 = Math.max(0, computeTowerVariableValue('iota', 'aleph3', blueprint));

  const connectionMultiplier = 1 + 0.18 * alphaLinks + 0.24 * betaLinks;
  const gammaMultiplier = 1 + 0.45 * Math.sqrt(gammaLinks);
  const alephMultiplier = 1 + 0.35 * aleph0 + 0.25 * aleph1 + 0.2 * aleph2 + 0.15 * aleph3;
  const attack = 240 * connectionMultiplier * gammaMultiplier * alephMultiplier;

  const speed = Math.max(
    0,
    0.22 +
      0.05 * (1 - Math.exp(-0.6 * aleph1)) +
      0.03 * (1 - Math.exp(-0.4 * aleph2)) +
      0.01 * (betaLinks + 0.5 * gammaLinks),
  );

  const rangeMeters = Math.max(
    0,
    4.2 +
      1.1 * Math.log(1 + aleph0 + 0.5 * aleph1 + 0.25 * aleph2) +
      0.35 * Math.log(1 + alphaLinks + betaLinks + 0.5 * gammaLinks),
  );

  const debuffStrength = Math.max(
    0,
    0.30 + 0.05 * alphaLinks + 0.06 * betaLinks + 0.08 * gammaLinks + 0.12 * aleph1 + 0.08 * aleph2 + 0.06 * aleph3,
  );
  const debuffDuration = Math.max(
    0,
    3.5 +
      0.5 * alphaLinks +
      0.25 * betaLinks +
      0.35 * Math.sqrt(gammaLinks) +
      0.8 * Math.sqrt(aleph0) +
      0.6 * aleph1 +
      0.4 * aleph2,
  );

  const minDimension = Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) || 1;
  const rangePixels = Math.max(MIN_PULSE_RADIUS_PX, metersToPixels(rangeMeters, minDimension));

  tower.damage = attack;
  tower.baseDamage = attack;
  tower.rate = speed;
  tower.baseRate = speed;
  tower.range = rangePixels;
  tower.baseRange = rangePixels;

  if (!tower.iotaState) {
    tower.iotaState = {};
  }

  tower.iotaState.attack = attack;
  tower.iotaState.speed = speed;
  tower.iotaState.rangeMeters = rangeMeters;
  tower.iotaState.rangePixels = rangePixels;
  tower.iotaState.debuffStrength = debuffStrength;
  tower.iotaState.debuffDuration = debuffDuration;
  tower.iotaState.alphaLinks = alphaLinks;
  tower.iotaState.betaLinks = betaLinks;
  tower.iotaState.gammaLinks = gammaLinks;
  tower.iotaState.color = resolvePulseColor();

  return tower.iotaState;
}

export function teardownIotaTower(playfield, tower) {
  if (!tower?.iotaState) {
    return;
  }
  tower.iotaState = null;
}

function ensureDamageAmplifierMap(enemy) {
  if (enemy.damageAmplifiers instanceof Map) {
    return enemy.damageAmplifiers;
  }
  const map = new Map();
  enemy.damageAmplifiers = map;
  return map;
}

function applyIotaDebuff(tower, enemy, state) {
  if (!enemy || !state || state.debuffStrength <= 0 || state.debuffDuration <= 0) {
    return;
  }
  const map = ensureDamageAmplifierMap(enemy);
  const effect = map.get(tower.id) || { strength: 0, remaining: 0 };
  effect.strength = Math.max(effect.strength || 0, state.debuffStrength);
  effect.remaining = Math.max(effect.remaining || 0, state.debuffDuration);
  map.set(tower.id, effect);
  const existingTimer = Number.isFinite(enemy.iotaInversionTimer) ? enemy.iotaInversionTimer : 0;
  enemy.iotaInversionTimer = Math.max(existingTimer, state.debuffDuration);
}

function spawnIotaPulseVisual(playfield, tower, radius) {
  if (!playfield || !tower) {
    return;
  }
  const color = tower.iotaState?.color || resolvePulseColor();
  playfield.projectiles.push({
    patternType: 'iotaPulse',
    origin: { x: tower.x, y: tower.y },
    radius,
    color,
    lifetime: 0,
    maxLifetime: 0.36,
  });
}

export function fireIotaPulse(playfield, tower, targetInfo = {}) {
  const state = ensureIotaState(playfield, tower);
  if (!state) {
    return;
  }

  const totalDamage = playfield.resolveTowerShotDamage(tower);
  if (!(totalDamage > 0)) {
    return;
  }

  const radius = Number.isFinite(state.rangePixels) ? state.rangePixels : tower.range;
  const affected = [];

  playfield.enemies.forEach((enemy) => {
    if (!enemy) {
      return;
    }
    const position = playfield.getEnemyPosition(enemy);
    if (!position) {
      return;
    }
    const dx = position.x - tower.x;
    const dy = position.y - tower.y;
    if (dx * dx + dy * dy <= radius * radius) {
      affected.push({ enemy, position });
    }
  });

  if (!affected.length && targetInfo.enemy) {
    const position = targetInfo.position || playfield.getEnemyPosition(targetInfo.enemy);
    if (position) {
      affected.push({ enemy: targetInfo.enemy, position });
    }
  }

  if (!affected.length) {
    return;
  }

  const damagePerTarget = totalDamage / affected.length;
  spawnIotaPulseVisual(playfield, tower, radius);

  affected.forEach(({ enemy, position }) => {
    if (!enemy) {
      return;
    }
    playfield.applyDamageToEnemy(enemy, damagePerTarget, { sourceTower: tower });
    applyIotaDebuff(tower, enemy, state);
    if (position) {
      playfield.emitTowerAttackVisuals(tower, { enemy, position });
    }
  });
}

export function collectIotaChargeBonus(tower) {
  if (!tower) {
    return 0;
  }
  const gammaShots = Math.max(0, tower.storedGammaShots || 0);
  if (gammaShots <= 0) {
    return 0;
  }
  tower.storedGammaShots = 0;
  const gammaValue = Math.max(0, calculateTowerEquationResult('gamma'));
  return gammaValue * gammaShots;
}
