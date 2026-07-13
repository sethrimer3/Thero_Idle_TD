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
// Ordered note keys for kappa hum loops, lowest to highest pitch.
const KAPPA_HUM_SFX_KEYS = [
  'kappaHumA1',
  'kappaHumD2',
  'kappaHumF2',
  'kappaHumA2',
  'kappaHumD3',
];
// Ordered note keys for kappa pluck impacts, lowest to highest pitch.
const KAPPA_PLUCK_SFX_KEYS = [
  'kappaPluckA1',
  'kappaPluckD2',
  'kappaPluckF2',
  'kappaPluckA2',
  'kappaPluckD3',
];
// The maximum number of humming notes that may play at once.
const KAPPA_MAX_HUM_NOTES = KAPPA_HUM_SFX_KEYS.length;
// Fade speed (per second) used to crossfade humming notes.
const KAPPA_HUM_FADE_RATE = 3.2;
// Minimum audible volume before stopping a humming loop.
const KAPPA_HUM_MIN_VOLUME = 0.01;

function resolveKappaColor() {
  const paletteColor = samplePaletteGradient(0.7);
  if (paletteColor) {
    return paletteColor;
  }
  return { r: 139, g: 247, b: 255 };
}

function resolveKappaParameters(playfield) {
  /**
   * Kappa attack leans on multiplicative synergy across α, β, and γ.
   * Formula: attack = α × β × γ
   */
  const gamma = Math.max(0, calculateTowerEquationResult('gamma') || 0);
  const beta = Math.max(0, calculateTowerEquationResult('beta') || 0);
  const alpha = Math.max(0, calculateTowerEquationResult('alpha') || 0);
  const attack = gamma * beta * alpha;
  const blueprint = getTowerEquationBlueprint('kappa');
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

  return {
    attack,
    chargeRate,
    rangeMeters,
    rangePixels,
    maxDamageMultiplier: Math.max(1, amplitudeMultiplier),
    waveAmplitudeFactor: 0.08 + 0.02 * Math.log1p(Math.max(1, amplitudeMultiplier)),
    waveFrequency: BASE_WAVE_FREQUENCY,
    flashDuration: FLASH_DURATION,
  };
}

// Resolve kappa hum targets by ordering connections and assigning notes from low to high.
function resolveKappaHumTargets(tripwires) {
  const entries = Array.from(tripwires.entries());
  entries.sort(([aId], [bId]) => String(aId).localeCompare(String(bId)));
  return entries.slice(0, KAPPA_MAX_HUM_NOTES).map(([targetId, entry], index) => ({
    targetId,
    noteKey: KAPPA_HUM_SFX_KEYS[index],
    charge: Math.max(0, Math.min(1, entry?.charge ?? 0)),
  }));
}

// Resolve the manifest volume for a kappa hum note so charge scaling respects base mix.
function resolveKappaHumBaseVolume(audio, noteKey) {
  const base = audio?.sfxDefinitions?.[noteKey]?.volume;
  return Number.isFinite(base) ? base : 1;
}

// Smoothly update humming loop volumes and stop inactive notes to create crossfades.
function updateKappaHumAudio(playfield, state, delta) {
  const audio = playfield?.audio;
  if (!audio || typeof audio.playSfx !== 'function' || typeof audio.stopSfx !== 'function') {
    return;
  }
  const humVolumes = state.humVolumes instanceof Map ? state.humVolumes : new Map();
  state.humVolumes = humVolumes;
  const tripwires = state.tripwires instanceof Map ? state.tripwires : new Map();
  const targets = resolveKappaHumTargets(tripwires);
  const targetsByKey = new Map(targets.map(target => [target.noteKey, target]));
  const fadeStep = Math.max(0, KAPPA_HUM_FADE_RATE * delta);

  KAPPA_HUM_SFX_KEYS.forEach((noteKey) => {
    const target = targetsByKey.get(noteKey);
    const baseVolume = resolveKappaHumBaseVolume(audio, noteKey);
    const targetVolume = target ? baseVolume * target.charge : 0;
    const currentVolume = humVolumes.get(noteKey) ?? 0;
    const nextVolume = targetVolume > currentVolume
      ? Math.min(targetVolume, currentVolume + fadeStep)
      : Math.max(targetVolume, currentVolume - fadeStep);

    if (nextVolume > KAPPA_HUM_MIN_VOLUME) {
      audio.playSfx(noteKey, { loop: true, restart: false, volume: nextVolume });
    } else {
      audio.stopSfx(noteKey, { reset: false });
    }
    humVolumes.set(noteKey, nextVolume);
  });
}

// Play a kappa pluck note based on the number of active tripwire connections.
function playKappaPluckSound(playfield, connectionCount) {
  const audio = playfield?.audio;
  if (!audio || typeof audio.playSfx !== 'function') {
    return;
  }
  const available = KAPPA_PLUCK_SFX_KEYS.slice(0, Math.max(1, Math.min(KAPPA_MAX_HUM_NOTES, connectionCount)));
  const noteKey = available[Math.floor(Math.random() * available.length)];
  if (noteKey) {
    audio.playSfx(noteKey);
  }
}

function refreshKappaParameters(playfield, tower, state) {
  const parameters = resolveKappaParameters(playfield);

  state.attack = parameters.attack;
  state.chargeRate = parameters.chargeRate;
  state.rangeMeters = parameters.rangeMeters;
  state.rangePixels = parameters.rangePixels;
  state.maxDamageMultiplier = parameters.maxDamageMultiplier;
  state.waveAmplitudeFactor = parameters.waveAmplitudeFactor;
  state.waveFrequency = parameters.waveFrequency;
  state.flashDuration = parameters.flashDuration;

  tower.damage = parameters.attack;
  tower.baseDamage = parameters.attack;
  tower.range = parameters.rangePixels;
  tower.baseRange = parameters.rangePixels;
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
      // Track current humming volumes so crossfades feel smooth.
      humVolumes: new Map(),
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

/**
 * Surface kappa preview parameters so placement UI can mirror real connection reach.
 */
export function getKappaPreviewParameters(playfield) {
  return resolveKappaParameters(playfield);
}

export function teardownKappaTower(playfield, tower) {
  if (!tower?.kappaState) {
    return;
  }
  tower.kappaState.tripwires?.clear?.();
  // Stop any humming loops tied to this kappa tower.
  KAPPA_HUM_SFX_KEYS.forEach((noteKey) => {
    if (playfield?.audio && typeof playfield.audio.stopSfx === 'function') {
      playfield.audio.stopSfx(noteKey, { reset: false });
    }
  });
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
    // Fade out any humming notes when no connections are active.
    updateKappaHumAudio(playfield, state, delta);
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

    // Dual κ links supercharge the conduit (double charge rate, squared damage).
    const kappaSynergy = target.type === 'kappa' ? 2 : 1;
    entry.charge = Math.min(
      1,
      Math.max(0, (entry.charge || 0) + chargeRate * kappaSynergy * delta),
    );
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
    const baseDamage = (state.attack || 0) * multiplier;
    const damage = target.type === 'kappa' ? baseDamage * baseDamage : baseDamage;
    if (damage > 0) {
      playfield.applyDamageToEnemy(hitEnemy, damage, { sourceTower: tower });
    }
    if (hitPosition) {
      playfield.emitTowerAttackVisuals(tower, { enemy: hitEnemy, position: hitPosition });
    }
    // Play a pluck note on tripwire impact, biased by active connection count.
    playKappaPluckSound(playfield, tripwires.size);

    entry.charge = 0;
    entry.phase = 0;
    entry.flashTimer = flashDuration;
  });

  // Keep the humming notes in sync with tripwire charge and count.
  updateKappaHumAudio(playfield, state, delta);
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
