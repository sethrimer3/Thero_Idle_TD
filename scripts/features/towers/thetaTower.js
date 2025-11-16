// ? tower helper module encapsulates slow-field math, state tracking, and visuals.
import { getTowerDefinition, computeTowerVariableValue } from '../../../assets/towersTab.js';
import { metersToPixels } from '../../../assets/gameUnits.js';

const MIN_RANGE_PIXELS = 24;

function ensureEnemyBaseSpeed(enemy) {
  if (!enemy) {
    return 0;
  }
  if (!Number.isFinite(enemy.baseSpeed)) {
    const fallback = Number.isFinite(enemy.speed) ? enemy.speed : 0;
    enemy.baseSpeed = Math.max(0, fallback);
  }
  return Math.max(0, enemy.baseSpeed);
}

export function calculateThetaSlowPercent(aleph1 = 0) {
  const normalizedAleph = Math.max(0, Number.isFinite(aleph1) ? aleph1 : 0);
  const exponent = Math.exp(-0.1 * normalizedAleph);
  const sinusoid = 1 + 0.1 * Math.sin(normalizedAleph);
  const slowPercent = 95 * (1 - exponent * sinusoid) + 5;
  return Math.max(0, Math.min(100, slowPercent));
}

export function calculateThetaEfficacy(aleph2 = 1, aleph3 = 0, seconds = 0) {
  const safeAleph2 = Math.max(1, Number.isFinite(aleph2) ? aleph2 : 1);
  const safeAleph3 = Math.max(0, Number.isFinite(aleph3) ? aleph3 : 0);
  const elapsed = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const envelope = Math.exp((1 / safeAleph2) - elapsed);
  const oscillation = 1 + (1 / (1.1 + safeAleph3)) * Math.sin(4 * elapsed);
  const raw = envelope * oscillation;
  if (!Number.isFinite(raw) || raw <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, raw));
}

function clearThetaSlow(enemy, towerId) {
  if (!enemy) {
    return;
  }
  if (enemy.slowEffects instanceof Map) {
    enemy.slowEffects.delete(towerId);
    if (enemy.slowEffects.size === 0) {
      delete enemy.slowEffects;
    }
  } else if (enemy.slowEffects && typeof enemy.slowEffects === 'object') {
    delete enemy.slowEffects[towerId];
    if (!Object.keys(enemy.slowEffects).length) {
      delete enemy.slowEffects;
    }
  }
}

function applyThetaSlow(playfield, enemy, tower, state, timeInField) {
  if (!enemy || !tower || !state) {
    return;
  }
  const baseSpeed = ensureEnemyBaseSpeed(enemy);
  const efficacy = calculateThetaEfficacy(state.aleph2, state.aleph3, timeInField);
  const appliedSlow = state.baseSlowPercent * efficacy;
  const multiplier = Math.max(0, Math.min(1, 1 - appliedSlow / 100));

  if (!(enemy.slowEffects instanceof Map)) {
    enemy.slowEffects = new Map();
  }

  enemy.slowEffects.set(tower.id, {
    type: 'theta',
    multiplier,
    slowPercent: appliedSlow,
    efficacy,
    timeInField,
    baseSlow: state.baseSlowPercent,
  });

  enemy.speed = baseSpeed * multiplier;
  if (playfield?.registerEnemyDebuff) {
    playfield.registerEnemyDebuff(enemy, 'theta');
  }
}

export function ensureThetaState(playfield, tower) {
  if (!playfield || !tower || tower.type !== 'theta') {
    return null;
  }

  const definition = tower.definition || getTowerDefinition('theta') || getTowerDefinition(tower.type);
  const minDimension = Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) || 1;
  const rangeFraction = Number.isFinite(definition?.range) ? definition.range : 0.5;
  const rangeMeters = Number.isFinite(definition?.rangeMeters)
    ? definition.rangeMeters
    : null;
  const rangePixelsFromMeters = Number.isFinite(rangeMeters)
    ? metersToPixels(rangeMeters, minDimension)
    : null;
  const rangePixels = Math.max(
    MIN_RANGE_PIXELS,
    Number.isFinite(rangePixelsFromMeters) ? rangePixelsFromMeters : minDimension * rangeFraction,
  );

  const aleph1 = Math.max(0, computeTowerVariableValue('theta', 'aleph1'));
  const aleph2 = Math.max(1, computeTowerVariableValue('theta', 'aleph2'));
  const aleph3 = Math.max(0, computeTowerVariableValue('theta', 'aleph3'));
  const baseSlowPercent = calculateThetaSlowPercent(aleph1);

  let state = tower.thetaState;
  if (!state) {
    state = {
      enemyTimers: new Map(),
      baseSlowPercent,
      aleph1,
      aleph2,
      aleph3,
      rangePixels,
    };
    tower.thetaState = state;
  } else {
    state.baseSlowPercent = baseSlowPercent;
    state.aleph1 = aleph1;
    state.aleph2 = aleph2;
    state.aleph3 = aleph3;
    state.rangePixels = rangePixels;
  }

  tower.range = rangePixels;
  return state;
}

export function updateThetaTower(playfield, tower, delta = 0) {
  const state = ensureThetaState(playfield, tower);
  if (!state) {
    return;
  }

  const timers = state.enemyTimers instanceof Map ? state.enemyTimers : new Map();
  state.enemyTimers = timers;
  const elapsed = Math.max(0, Number.isFinite(delta) ? delta : 0);
  state.elapsed = (state.elapsed || 0) + elapsed;

  timers.forEach((entry) => {
    if (entry) {
      entry.active = false;
    }
  });

  if (!playfield.combatActive) {
    timers.forEach((entry, enemyId) => {
      timers.delete(enemyId);
      const enemy = playfield.enemies.find((candidate) => candidate?.id === enemyId);
      if (enemy) {
        clearThetaSlow(enemy, tower.id);
      }
    });
    return;
  }

  const radius = Math.max(0, state.rangePixels);

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
    const distance = Math.hypot(dx, dy);
    if (distance > radius) {
      return;
    }

    const entry = timers.get(enemy.id) || { time: 0 };
    entry.time = Math.max(0, (entry.time || 0) + elapsed);
    entry.active = true;
    timers.set(enemy.id, entry);
    applyThetaSlow(playfield, enemy, tower, state, entry.time);
  });

  timers.forEach((entry, enemyId) => {
    if (entry && entry.active) {
      return;
    }
    timers.delete(enemyId);
    const enemy = playfield.enemies.find((candidate) => candidate?.id === enemyId);
    if (enemy) {
      clearThetaSlow(enemy, tower.id);
    }
  });
}

export function teardownThetaTower(playfield, tower) {
  if (!tower || tower.type !== 'theta' || !tower.thetaState) {
    return;
  }
  const timers = tower.thetaState.enemyTimers;
  if (timers instanceof Map) {
    timers.forEach((_, enemyId) => {
      const enemy = playfield?.enemies.find((candidate) => candidate?.id === enemyId);
      if (enemy) {
        clearThetaSlow(enemy, tower.id);
      }
    });
    timers.clear();
  }
  tower.thetaState = null;
}

export function drawThetaContours(renderer, tower) {
  if (!renderer?.ctx || !tower?.thetaState) {
    return;
  }
  const ctx = renderer.ctx;
  const state = tower.thetaState;
  const radius = Math.max(24, Number.isFinite(state.rangePixels) ? state.rangePixels : tower.range || 0);
  if (!(radius > 0)) {
    return;
  }

  const elapsed = state.elapsed || 0;
  const contourCount = renderer.isLowGraphicsMode?.() ? 4 : 6;
  const wobbleBase = renderer.isLowGraphicsMode?.() ? 0.04 : 0.07;
  const gradient = ctx.createRadialGradient(0, 0, radius * 0.12, 0, 0, radius);
  gradient.addColorStop(0, 'rgba(139, 247, 255, 0.18)');
  gradient.addColorStop(0.55, 'rgba(139, 247, 255, 0.08)');
  gradient.addColorStop(1, 'rgba(12, 16, 26, 0)');

  ctx.save();
  ctx.translate(tower.x, tower.y);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  if (typeof renderer.applyCanvasShadow === 'function') {
    renderer.applyCanvasShadow(ctx, 'rgba(139, 247, 255, 0.12)', radius * 0.45);
  }

  const segments = renderer.isLowGraphicsMode?.() ? 48 : 72;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const previousComposite = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';

  for (let index = 0; index < contourCount; index += 1) {
    const ratio = 1 - index / (contourCount + 1);
    const contourRadius = radius * ratio;
    const wobbleStrength = wobbleBase + index * 0.008;
    const frequency = 3 + index;
    ctx.beginPath();
    for (let step = 0; step <= segments; step += 1) {
      const angle = (step / segments) * Math.PI * 2;
      const wobble = wobbleStrength * Math.sin(frequency * angle + elapsed * 0.9 + index * 0.6);
      const verticalWarp = 1 + 0.05 * Math.sin(angle * 2 + elapsed * 0.4 + index * 0.2);
      const radial = contourRadius * (1 + wobble);
      const x = radial * Math.cos(angle);
      const y = radial * Math.sin(angle) * verticalWarp;
      if (step === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    const opacity = Math.max(0.04, 0.26 - index * 0.035);
    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.lineWidth = Math.max(1, radius * 0.008 * ratio);
    ctx.stroke();
  }

  if (typeof renderer.clearCanvasShadow === 'function') {
    renderer.clearCanvasShadow(ctx);
  }

  ctx.globalCompositeOperation = previousComposite;

  ctx.restore();
}

