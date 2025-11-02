import {
  calculateTowerEquationResult,
  computeTowerVariableValue,
  getTowerEquationBlueprint,
} from '../../../assets/towersTab.js';
import { metersToPixels } from '../../../assets/gameUnits.js';

const PARAMETER_RECALC_INTERVAL = 0.35;
const BASE_BEAM_DURATION = 0.12;
const BASE_DISSIPATE_DURATION = 0.9;
const MIN_WAVELENGTH_METERS = 0.1;
const MAX_WAVELENGTH_METERS = 2;
const RAINBOW_THRESHOLD = 100;
const WHITEN_THRESHOLD = 500;
const MIN_BEAM_THICKNESS = 3.5;
const MAX_BEAM_THICKNESS = 9.5;
const MIN_WAVE_SAMPLES = 32;
const MAX_WAVE_SAMPLES = 160;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

function hslToRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 1);
  const lightness = clamp(l, 0, 1);
  if (saturation === 0) {
    const value = Math.round(lightness * 255);
    return { r: value, g: value, b: value };
  }
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (hue < 60) {
    rPrime = c;
    gPrime = x;
    bPrime = 0;
  } else if (hue < 120) {
    rPrime = x;
    gPrime = c;
    bPrime = 0;
  } else if (hue < 180) {
    rPrime = 0;
    gPrime = c;
    bPrime = x;
  } else if (hue < 240) {
    rPrime = 0;
    gPrime = x;
    bPrime = c;
  } else if (hue < 300) {
    rPrime = x;
    gPrime = 0;
    bPrime = c;
  } else {
    rPrime = c;
    gPrime = 0;
    bPrime = x;
  }

  const r = Math.round((rPrime + m) * 255);
  const g = Math.round((gPrime + m) * 255);
  const b = Math.round((bPrime + m) * 255);
  return { r, g, b };
}

function colorToRgba(color, alpha) {
  const r = clamp(Math.round(color?.r ?? 255), 0, 255);
  const g = clamp(Math.round(color?.g ?? 255), 0, 255);
  const b = clamp(Math.round(color?.b ?? 255), 0, 255);
  const a = clamp(alpha ?? 1, 0, 1);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function countAliveEnemies(playfield) {
  if (!playfield || !Array.isArray(playfield.enemies)) {
    return 0;
  }
  let count = 0;
  playfield.enemies.forEach((enemy) => {
    if (!enemy) {
      return;
    }
    const hp = Number.isFinite(enemy.hp) ? enemy.hp : enemy.maxHp;
    if (Number.isFinite(hp) ? hp > 0 : true) {
      count += 1;
    }
  });
  return count;
}

function resolvePlayfieldMinDimension(playfield) {
  const dimensionCandidates = [];
  if (Number.isFinite(playfield?.renderWidth) && playfield.renderWidth > 0) {
    dimensionCandidates.push(playfield.renderWidth);
  }
  if (Number.isFinite(playfield?.renderHeight) && playfield.renderHeight > 0) {
    dimensionCandidates.push(playfield.renderHeight);
  }
  if (!dimensionCandidates.length) {
    return 1;
  }
  return Math.min(...dimensionCandidates);
}

function computeEffectiveEnemyFactor(enemyCount, enemyWeight) {
  const weight = Number.isFinite(enemyWeight) ? Math.max(1, enemyWeight) : 1;
  return Math.max(1, enemyCount * weight);
}

function computeWavelengthMeters(effectiveCount) {
  const clamped = Math.max(1, effectiveCount);
  if (clamped >= RAINBOW_THRESHOLD) {
    return MIN_WAVELENGTH_METERS;
  }
  const span = MAX_WAVELENGTH_METERS - MIN_WAVELENGTH_METERS;
  const t = (clamped - 1) / (RAINBOW_THRESHOLD - 1);
  return MAX_WAVELENGTH_METERS - span * clamp(t, 0, 1);
}

function computeSpectrumColor(effectiveCount) {
  const clamped = Math.max(1, effectiveCount);
  if (clamped <= RAINBOW_THRESHOLD) {
    const t = (clamped - 1) / (RAINBOW_THRESHOLD - 1 || 1);
    const hue = 0 + 270 * clamp(t, 0, 1);
    return hslToRgb(hue, 0.92, 0.48);
  }
  const normalized = clamp((clamped - RAINBOW_THRESHOLD) / (WHITEN_THRESHOLD - RAINBOW_THRESHOLD || 1), 0, 1);
  const base = hslToRgb(270, 0.92, 0.42);
  return {
    r: Math.round(lerp(base.r, 255, normalized)),
    g: Math.round(lerp(base.g, 255, normalized)),
    b: Math.round(lerp(base.b, 255, normalized)),
  };
}

function distancePointToSegmentSquared(point, start, end) {
  if (!point || !start || !end) {
    return Infinity;
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (!dx && !dy) {
    const pdx = point.x - start.x;
    const pdy = point.y - start.y;
    return pdx * pdx + pdy * pdy;
  }
  const lengthSquared = dx * dx + dy * dy;
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  const clampedT = clamp(t, 0, 1);
  const projX = start.x + clampedT * dx;
  const projY = start.y + clampedT * dy;
  const offsetX = point.x - projX;
  const offsetY = point.y - projY;
  return offsetX * offsetX + offsetY * offsetY;
}

function ensureLambdaStateInternal(playfield, tower) {
  if (!tower.lambdaState) {
    tower.lambdaState = {
      lasers: [],
      recalcTimer: PARAMETER_RECALC_INTERVAL,
      cooldown: 0,
      baseCooldown: 5,
      rangeMeters: 8,
      rangePixels: 0,
      enemyWeight: 1,
      beamThickness: MIN_BEAM_THICKNESS,
      kappaPower: 0,
      color: { r: 255, g: 0, b: 0 },
      wavelengthMeters: MAX_WAVELENGTH_METERS,
      wavelengthPixels: 0,
      laserIdCounter: 0,
    };
  }
  return tower.lambdaState;
}

function refreshLambdaParameters(playfield, tower, state) {
  const blueprint = getTowerEquationBlueprint('lambda');
  const kappaPower = Math.max(0, calculateTowerEquationResult('kappa') || 0);
  const rangeMetersValue = computeTowerVariableValue('lambda', 'rangeMeters', blueprint);
  const enemyWeightValue = computeTowerVariableValue('lambda', 'enemyWeight', blueprint);
  const rateValue = computeTowerVariableValue('lambda', 'rate', blueprint);

  const minDimension = resolvePlayfieldMinDimension(playfield);
  const rangeMeters = Number.isFinite(rangeMetersValue) && rangeMetersValue > 0 ? rangeMetersValue : 8;
  const rangePixels = Math.max(24, metersToPixels(rangeMeters, minDimension));

  const enemyWeight = Number.isFinite(enemyWeightValue) ? Math.max(1, enemyWeightValue) : 1;
  const rate = Number.isFinite(rateValue) && rateValue > 0 ? clamp(rateValue, 0.0001, 0.5) : 0.2;
  const baseCooldown = rate > 0 ? 1 / rate : Infinity;

  const beamThickness = clamp(rangePixels * 0.01, MIN_BEAM_THICKNESS, MAX_BEAM_THICKNESS);

  state.kappaPower = kappaPower;
  state.rangeMeters = rangeMeters;
  state.rangePixels = rangePixels;
  state.enemyWeight = enemyWeight;
  state.rate = rate;
  state.baseCooldown = baseCooldown;
  state.beamThickness = beamThickness;

  tower.baseDamage = kappaPower;
  tower.damage = kappaPower;
  tower.baseRate = rate;
  tower.rate = rate;
  tower.baseRange = rangePixels;
  tower.range = rangePixels;
}

function updateLasers(state, delta) {
  if (!state.lasers) {
    state.lasers = [];
    return;
  }
  const survivors = [];
  state.lasers.forEach((laser) => {
    if (!laser) {
      return;
    }
    laser.age = (laser.age || 0) + delta;
    if (laser.age < laser.totalDuration) {
      survivors.push(laser);
    }
  });
  state.lasers = survivors;
}

function applyLaserDamage(playfield, tower, start, end, beamThickness, damage) {
  const hits = [];
  const thickness = Math.max(beamThickness, 1);
  playfield.enemies.forEach((enemy) => {
    if (!enemy) {
      return;
    }
    const position = playfield.getEnemyPosition(enemy);
    if (!position) {
      return;
    }
    const metrics = playfield.getEnemyVisualMetrics(enemy);
    const enemyRadius = Math.max(10, metrics?.ringRadius || 12);
    const limit = enemyRadius + thickness;
    const distanceSquared = distancePointToSegmentSquared(position, start, end);
    if (distanceSquared > limit * limit) {
      return;
    }
    if (damage > 0) {
      playfield.applyDamageToEnemy(enemy, damage, { sourceTower: tower });
    }
    hits.push({ enemy, position });
  });
  return hits;
}

function spawnLaser(state, tower, options = {}) {
  const {
    direction,
    rangePixels,
    color,
    wavelengthPixels,
    normalizedEffect,
    beamThickness,
  } = options;
  if (!direction || !Number.isFinite(rangePixels)) {
    return null;
  }
  const start = { x: tower.x, y: tower.y };
  const end = {
    x: tower.x + direction.x * rangePixels,
    y: tower.y + direction.y * rangePixels,
  };
  const normal = { x: -direction.y, y: direction.x };
  const laser = {
    id: `lambda-laser-${(state.laserIdCounter += 1)}`,
    start,
    end,
    direction,
    normal,
    rangePixels,
    color,
    wavelengthPixels,
    normalizedEffect,
    beamThickness,
    age: 0,
    beamDuration: BASE_BEAM_DURATION,
    dissipateDuration: BASE_DISSIPATE_DURATION,
  };
  laser.totalDuration = laser.beamDuration + laser.dissipateDuration;
  state.lasers.push(laser);
  return laser;
}

function ensureLambdaState(playfield, tower) {
  if (!playfield || !tower || tower.type !== 'lambda') {
    return null;
  }
  const state = ensureLambdaStateInternal(playfield, tower);
  refreshLambdaParameters(playfield, tower, state);
  state.recalcTimer = PARAMETER_RECALC_INTERVAL;
  return state;
}

function updateLambdaTower(playfield, tower, delta) {
  if (!playfield || !tower || tower.type !== 'lambda') {
    return;
  }
  const state = ensureLambdaStateInternal(playfield, tower);

  state.recalcTimer = (state.recalcTimer || 0) - delta;
  if (state.recalcTimer <= 0) {
    refreshLambdaParameters(playfield, tower, state);
    state.recalcTimer = PARAMETER_RECALC_INTERVAL;
  }

  state.cooldown = Math.max(0, (state.cooldown || 0) - delta);
  updateLasers(state, delta);

  tower.cooldown = state.cooldown;

  if (!playfield.combatActive || !Array.isArray(playfield.enemies) || !playfield.enemies.length) {
    return;
  }
  if (!Number.isFinite(state.rate) || state.rate <= 0 || !Number.isFinite(state.baseCooldown)) {
    return;
  }
  if (state.cooldown > 0) {
    return;
  }

  const foundTarget = playfield.findTarget(tower);
  let resolvedTarget = null;
  if (foundTarget?.position) {
    resolvedTarget = {
      enemy: foundTarget.enemy || null,
      position: foundTarget.position,
    };
  } else if (foundTarget?.enemy) {
    const position = playfield.getEnemyPosition(foundTarget.enemy);
    if (position) {
      resolvedTarget = {
        enemy: foundTarget.enemy,
        position,
      };
    }
  }

  if (!resolvedTarget) {
    // Attempt to locate the front-most enemy as a fallback.
    let fallbackEnemy = null;
    let fallbackPosition = null;
    let bestProgress = -Infinity;
    playfield.enemies.forEach((enemy) => {
      if (!enemy) {
        return;
      }
      const progress = Number.isFinite(enemy.progress) ? enemy.progress : 0;
      if (progress <= bestProgress) {
        return;
      }
      const position = playfield.getEnemyPosition(enemy);
      if (!position) {
        return;
      }
      fallbackEnemy = enemy;
      fallbackPosition = position;
      bestProgress = progress;
    });
    if (fallbackEnemy && fallbackPosition) {
      resolvedTarget = {
        enemy: fallbackEnemy,
        position: fallbackPosition,
      };
    }
  }

  const resolvedPosition = resolvedTarget?.position;
  if (!resolvedPosition) {
    return;
  }

  const dx = resolvedPosition.x - tower.x;
  const dy = resolvedPosition.y - tower.y;
  const distance = Math.hypot(dx, dy) || 1;
  const direction = { x: dx / distance, y: dy / distance };

  const enemyCount = countAliveEnemies(playfield);
  if (enemyCount <= 0) {
    state.cooldown = state.baseCooldown;
    tower.cooldown = state.cooldown;
    return;
  }

  const effectiveFactor = computeEffectiveEnemyFactor(enemyCount, state.enemyWeight);
  const normalizedEffect = clamp((Math.min(effectiveFactor, RAINBOW_THRESHOLD) - 1) / (RAINBOW_THRESHOLD - 1 || 1), 0, 1);
  const damage = state.kappaPower * effectiveFactor;

  const start = { x: tower.x, y: tower.y };
  const end = {
    x: tower.x + direction.x * state.rangePixels,
    y: tower.y + direction.y * state.rangePixels,
  };

  const hits = applyLaserDamage(playfield, tower, start, end, state.beamThickness, damage);

  state.cooldown = state.baseCooldown;
  tower.cooldown = state.cooldown;

  const wavelengthMeters = computeWavelengthMeters(effectiveFactor);
  const minDimension = resolvePlayfieldMinDimension(playfield);
  const wavelengthPixels = Math.max(6, metersToPixels(wavelengthMeters, minDimension));
  const color = computeSpectrumColor(effectiveFactor);

  const maxAmplitude = Math.min(state.rangePixels * (0.12 + 0.18 * normalizedEffect), 68);
  const beamThickness = state.beamThickness;

  const laser = spawnLaser(state, tower, {
    direction,
    rangePixels: state.rangePixels,
    color,
    wavelengthPixels,
    normalizedEffect,
    beamThickness,
  });

  if (laser) {
    laser.maxAmplitude = maxAmplitude;
    laser.hitCount = hits.length;
  }
}

function drawLambdaLasers(playfield, tower) {
  if (!playfield?.ctx || !tower?.lambdaState) {
    return;
  }
  const ctx = playfield.ctx;
  const state = tower.lambdaState;
  const lasers = Array.isArray(state.lasers) ? state.lasers : [];
  if (!lasers.length) {
    return;
  }

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  lasers.forEach((laser) => {
    if (!laser) {
      return;
    }
    const age = laser.age || 0;
    const beamDuration = laser.beamDuration || BASE_BEAM_DURATION;
    const dissipateDuration = laser.dissipateDuration || BASE_DISSIPATE_DURATION;
    const totalDuration = laser.totalDuration || (beamDuration + dissipateDuration);
    const baseColor = laser.color || { r: 255, g: 0, b: 0 };
    const baseAlpha = 0.88;

    if (age < beamDuration) {
      const progress = clamp(age / beamDuration, 0, 1);
      const alpha = baseAlpha * (1 - 0.35 * progress);
      const width = clamp(laser.beamThickness * (1 - 0.25 * progress), 1.5, MAX_BEAM_THICKNESS);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = colorToRgba(baseColor, alpha);
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(laser.start.x, laser.start.y);
      ctx.lineTo(laser.end.x, laser.end.y);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const dissipateAge = age - beamDuration;
    if (dissipateAge >= dissipateDuration) {
      return;
    }
    const progress = clamp(dissipateAge / dissipateDuration, 0, 1);
    const amplitude = (laser.maxAmplitude || 32) * (0.35 + 0.65 * progress);
    const alpha = baseAlpha * (1 - progress);
    const width = clamp(laser.beamThickness * (0.6 - 0.4 * progress), 1, MAX_BEAM_THICKNESS * 0.7);
    const wavelength = Math.max(6, laser.wavelengthPixels || 24);
    const samples = clamp(Math.round(laser.rangePixels / Math.max(6, wavelength * 0.45)), MIN_WAVE_SAMPLES, MAX_WAVE_SAMPLES);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = colorToRgba(baseColor, alpha);
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let index = 0; index <= samples; index += 1) {
      const t = index / samples;
      const distance = laser.rangePixels * t;
      const phase = (distance / wavelength) * Math.PI * 2;
      const envelope = 0.4 + 0.6 * t;
      const offset = Math.sin(phase + progress * Math.PI * 2) * amplitude * envelope;
      const x = laser.start.x + laser.direction.x * distance + laser.normal.x * offset;
      const y = laser.start.y + laser.direction.y * distance + laser.normal.y * offset;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();

    // Soft glow overlay to emphasize dissipating energy.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = colorToRgba({ r: 255, g: 255, b: 255 }, alpha * 0.3);
    ctx.lineWidth = width * 1.4;
    ctx.beginPath();
    ctx.moveTo(laser.start.x, laser.start.y);
    ctx.lineTo(laser.end.x, laser.end.y);
    ctx.stroke();
    ctx.restore();
  });

  ctx.restore();
}

function teardownLambdaTower(playfield, tower) {
  if (!tower?.lambdaState) {
    return;
  }
  tower.lambdaState.lasers?.splice?.(0, tower.lambdaState.lasers.length);
  tower.lambdaState = null;
}

export {
  ensureLambdaState,
  updateLambdaTower,
  drawLambdaLasers,
  teardownLambdaTower,
};
