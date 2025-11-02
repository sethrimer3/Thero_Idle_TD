// ? tower helper module manages automatic tripwire bindings, charge math, and visuals.
import {
  calculateTowerEquationResult,
  computeTowerVariableValue,
  getTowerEquationBlueprint,
} from '../../../assets/towersTab.js';
import { metersToPixels } from '../../../assets/gameUnits.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

const DEFAULT_CHARGE_RATE = 0.16;
const DEFAULT_RANGE_METERS = 2;
const DEFAULT_AMPLITUDE_MULTIPLIER = 5;
const MIN_TRIPWIRE_SAMPLES = 8;
const MAX_TRIPWIRE_SAMPLES = 40;
const MIN_TRIPWIRE_THICKNESS = 6;
const SYNC_INTERVAL = 0.25;
const RECALC_INTERVAL = 0.5;
const FLASH_DURATION = 0.35;
const BASE_WAVE_FREQUENCY = 2.4;

function resolveKappaColor() {
  const paletteColor = samplePaletteGradient(0.7);
  if (paletteColor) {
    return paletteColor;
  }
  return { r: 139, g: 247, b: 255 };
}

function refreshKappaParameters(playfield, tower, state) {
  const blueprint = getTowerEquationBlueprint('kappa');
  const gamma = Math.max(0, calculateTowerEquationResult('gamma') || 0);
  const beta = Math.max(0, calculateTowerEquationResult('beta') || 0);
  const alpha = Math.max(0, calculateTowerEquationResult('alpha') || 0);
  const attack = gamma * beta * alpha;
  const chargeRateValue = computeTowerVariableValue('kappa', 'chargeRate', blueprint);
  const rangeMetersValue = computeTowerVariableValue('kappa', 'rangeMeters', blueprint);
  const amplitudeValue = computeTowerVariableValue('kappa', 'amplitudeMultiplier', blueprint);

  const chargeRate = Number.isFinite(chargeRateValue) && chargeRateValue > 0
    ? chargeRateValue
    : DEFAULT_CHARGE_RATE;
  const rangeMeters = Number.isFinite(rangeMetersValue) && rangeMetersValue > 0
    ? rangeMetersValue
    : DEFAULT_RANGE_METERS;
  const amplitudeMultiplier = Number.isFinite(amplitudeValue) && amplitudeValue > 0
    ? amplitudeValue
    : DEFAULT_AMPLITUDE_MULTIPLIER;

  const dimensionCandidates = [];
  if (Number.isFinite(playfield.renderWidth) && playfield.renderWidth > 0) {
    dimensionCandidates.push(playfield.renderWidth);
  }
  if (Number.isFinite(playfield.renderHeight) && playfield.renderHeight > 0) {
    dimensionCandidates.push(playfield.renderHeight);
  }
  const minDimension = dimensionCandidates.length
    ? Math.min(...dimensionCandidates)
    : 1;
  const rangePixels = Math.max(24, metersToPixels(rangeMeters, minDimension));

  state.attack = attack;
  state.chargeRate = chargeRate;
  state.rangeMeters = rangeMeters;
  state.rangePixels = rangePixels;
  state.maxDamageMultiplier = Math.max(1, amplitudeMultiplier);
  state.waveAmplitudeFactor = 0.08 + 0.02 * Math.log1p(state.maxDamageMultiplier);
  state.waveFrequency = BASE_WAVE_FREQUENCY;
  state.flashDuration = FLASH_DURATION;

  tower.damage = attack;
  tower.baseDamage = attack;
  tower.range = rangePixels;
  tower.baseRange = rangePixels;
  tower.rate = 0;
  tower.baseRate = 0;
}

function syncTripwireTargets(playfield, tower, state) {
  const active = new Map();
  const existing = state.tripwires instanceof Map ? state.tripwires : new Map();
  const maxDistance = state.rangePixels || 0;
  playfield.towers.forEach((candidate) => {
    if (!candidate || candidate.id === tower.id) {
      return;
    }
    const dx = candidate.x - tower.x;
    const dy = candidate.y - tower.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance <= 0 || (maxDistance > 0 && distance > maxDistance)) {
      return;
    }
    const cached = existing.get(candidate.id);
    active.set(candidate.id, {
      targetId: candidate.id,
      charge: Math.max(0, Math.min(1, cached?.charge || 0)),
      phase: Number.isFinite(cached?.phase) ? cached.phase : 0,
      flashTimer: Math.max(0, cached?.flashTimer || 0),
    });
  });
  state.tripwires = active;
}

function ensureKappaStateInternal(playfield, tower) {
  if (!tower.kappaState) {
    tower.kappaState = {
      attack: 0,
      chargeRate: DEFAULT_CHARGE_RATE,
      rangeMeters: DEFAULT_RANGE_METERS,
      rangePixels: 0,
      maxDamageMultiplier: DEFAULT_AMPLITUDE_MULTIPLIER,
      waveAmplitudeFactor: 0.1,
      waveFrequency: BASE_WAVE_FREQUENCY,
      flashDuration: FLASH_DURATION,
      tripwires: new Map(),
      color: resolveKappaColor(),
      syncTimer: 0,
      recalcTimer: 0,
    };
  }
  const state = tower.kappaState;
  if (!state.color) {
    state.color = resolveKappaColor();
  }
  return state;
}

export function ensureKappaState(playfield, tower) {
  if (!playfield || !tower || tower.type !== 'kappa') {
    return null;
  }
  const state = ensureKappaStateInternal(playfield, tower);
  refreshKappaParameters(playfield, tower, state);
  syncTripwireTargets(playfield, tower, state);
  state.syncTimer = SYNC_INTERVAL;
  state.recalcTimer = RECALC_INTERVAL;
  return state;
}

export function teardownKappaTower(playfield, tower) {
  if (!tower?.kappaState) {
    return;
  }
  tower.kappaState.tripwires?.clear?.();
  tower.kappaState = null;
}

function computeWavePoint(tower, target, length, direction, normal, amplitude, phase, t) {
  const offset = Math.sin(t * Math.PI + phase) * amplitude;
  const along = length * t;
  return {
    x: tower.x + direction.x * along + normal.x * offset,
    y: tower.y + direction.y * along + normal.y * offset,
  };
}

export function updateKappaTower(playfield, tower, delta) {
  if (!playfield || !tower || tower.type !== 'kappa') {
    return;
  }
  const state = ensureKappaStateInternal(playfield, tower);

  state.recalcTimer = Math.max(0, (state.recalcTimer ?? 0) - delta);
  if (state.recalcTimer <= 0) {
    refreshKappaParameters(playfield, tower, state);
    state.recalcTimer = RECALC_INTERVAL;
  }

  state.syncTimer = Math.max(0, (state.syncTimer ?? 0) - delta);
  if (state.syncTimer <= 0) {
    syncTripwireTargets(playfield, tower, state);
    state.syncTimer = SYNC_INTERVAL;
  }

  const tripwires = state.tripwires instanceof Map ? state.tripwires : new Map();
  if (!tripwires.size) {
    return;
  }

  const chargeRate = Math.max(0, state.chargeRate || 0);
  const damageMultiplierSpan = Math.max(0, state.maxDamageMultiplier - 1);
  const flashDuration = state.flashDuration || FLASH_DURATION;

  tripwires.forEach((entry, targetId) => {
    const target = playfield.getTowerById(targetId);
    if (!target) {
      tripwires.delete(targetId);
      return;
    }

    const dx = target.x - tower.x;
    const dy = target.y - tower.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance <= 0 || (state.rangePixels && distance > state.rangePixels)) {
      tripwires.delete(targetId);
      return;
    }

    entry.charge = Math.min(1, Math.max(0, (entry.charge || 0) + chargeRate * delta));
    entry.phase = (entry.phase || 0) + state.waveFrequency * delta;
    entry.flashTimer = Math.max(0, (entry.flashTimer || 0) - delta);

    if (!playfield.combatActive || !Array.isArray(playfield.enemies) || !playfield.enemies.length) {
      return;
    }

    const direction = { x: dx / distance, y: dy / distance };
    const normal = { x: -direction.y, y: direction.x };
    const amplitude = state.waveAmplitudeFactor * distance * Math.max(0, Math.min(1, entry.charge || 0));
    const thickness = Math.max(MIN_TRIPWIRE_THICKNESS, distance * 0.03);
    const samples = Math.max(
      MIN_TRIPWIRE_SAMPLES,
      Math.min(MAX_TRIPWIRE_SAMPLES, Math.round(distance / 18)),
    );

    let hitEnemy = null;
    let hitPosition = null;

    for (const enemy of playfield.enemies) {
      if (!enemy) {
        continue;
      }
      const position = playfield.getEnemyPosition(enemy);
      if (!position) {
        continue;
      }
      const metrics = playfield.getEnemyVisualMetrics(enemy);
      const enemyRadius = Math.max(10, metrics?.ringRadius || 12);
      let collided = false;
      let candidatePosition = null;
      for (let index = 0; index <= samples; index += 1) {
        const t = index / samples;
        const point = computeWavePoint(tower, target, distance, direction, normal, amplitude, entry.phase || 0, t);
        const pdx = position.x - point.x;
        const pdy = position.y - point.y;
        if (pdx * pdx + pdy * pdy <= (enemyRadius + thickness) ** 2) {
          collided = true;
          candidatePosition = point;
          break;
        }
      }
      if (collided) {
        hitEnemy = enemy;
        hitPosition = candidatePosition;
        break;
      }
    }

    if (!hitEnemy) {
      return;
    }

    const multiplier = 1 + damageMultiplierSpan * Math.max(0, Math.min(1, entry.charge || 0));
    const damage = (state.attack || 0) * multiplier;
    if (damage > 0) {
      playfield.applyDamageToEnemy(hitEnemy, damage, { sourceTower: tower });
    }
    if (hitPosition) {
      playfield.emitTowerAttackVisuals(tower, { enemy: hitEnemy, position: hitPosition });
    }

    entry.charge = 0;
    entry.phase = 0;
    entry.flashTimer = flashDuration;
  });
}

function colorToRgbaString(color, alpha) {
  const r = Math.max(0, Math.min(255, Math.round(color?.r ?? 255)));
  const g = Math.max(0, Math.min(255, Math.round(color?.g ?? 255)));
  const b = Math.max(0, Math.min(255, Math.round(color?.b ?? 255)));
  const a = Math.max(0, Math.min(1, alpha ?? 1));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function drawKappaTripwires(playfield, tower) {
  if (!playfield?.ctx || !tower?.kappaState) {
    return;
  }
  const ctx = playfield.ctx;
  const state = tower.kappaState;
  const tripwires = state.tripwires instanceof Map ? state.tripwires : new Map();
  if (!tripwires.size) {
    return;
  }
  const baseColor = state.color || resolveKappaColor();
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  tripwires.forEach((entry, targetId) => {
    const target = playfield.getTowerById(targetId);
    if (!target) {
      return;
    }
    const dx = target.x - tower.x;
    const dy = target.y - tower.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance <= 0) {
      return;
    }
    const direction = { x: dx / distance, y: dy / distance };
    const normal = { x: -direction.y, y: direction.x };
    const amplitude = state.waveAmplitudeFactor * distance * Math.max(0, Math.min(1, entry.charge || 0));
    const samples = Math.max(
      MIN_TRIPWIRE_SAMPLES,
      Math.min(MAX_TRIPWIRE_SAMPLES, Math.round(distance / 14)),
    );
    const lineWidth = Math.max(2, distance * 0.02);
    const flashAlpha = entry.flashTimer > 0 && state.flashDuration > 0
      ? Math.max(0, Math.min(1, entry.flashTimer / state.flashDuration))
      : 0;

    ctx.beginPath();
    for (let index = 0; index <= samples; index += 1) {
      const t = index / samples;
      const point = computeWavePoint(tower, target, distance, direction, normal, amplitude, entry.phase || 0, t);
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }

    const baseAlpha = 0.28 + 0.35 * Math.max(0, Math.min(1, entry.charge || 0));
    ctx.strokeStyle = colorToRgbaString(baseColor, baseAlpha);
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    if (flashAlpha > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const flashColor = colorToRgbaString({ r: 255, g: 228, b: 120 }, 0.35 + 0.45 * flashAlpha);
      ctx.strokeStyle = flashColor;
      ctx.lineWidth = lineWidth * (1 + flashAlpha * 0.6);
      ctx.stroke();
      ctx.restore();
    }
  });

  ctx.restore();
}

