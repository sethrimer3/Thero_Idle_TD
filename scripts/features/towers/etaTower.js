// η tower helper module extracts orbital math so playfield orchestration stays focused.
import {
  computeTowerVariableValue,
  calculateTowerEquationResult,
  refreshTowerLoadoutDisplay,
} from '../../../assets/towersTab.js';
import { metersToPixels } from '../../../assets/gameUnits.js';

// RGB palettes for η orbital trails so each ring keeps a distinct hue.
const ETA_RING_RGB = [
  [255, 138, 216],
  [138, 230, 255],
  [255, 226, 138],
  [157, 255, 181],
  [208, 162, 255],
];
// Alignment tolerance of five degrees expressed in radians for η ring checks.
const ETA_ALIGNMENT_THRESHOLD_RADIANS = (5 * Math.PI) / 180;
// Number of merges required before η ascends into its prestige form Η.
export const ETA_MAX_PRESTIGE_MERGES = 5;
// Fixed prestige rotation rates (rotations per second) for each η ring.
const ETA_PRESTIGE_RING_SPEEDS = [0.1, 0.2, 0.4, 0.8, 1.6];

/**
 * Clear cached η orbital data when the tower is removed or retuned.
 */
export function teardownEtaTower(playfield, tower) {
  if (!playfield || !tower || !tower.etaState) {
    return;
  }
  if (Array.isArray(tower.etaState.rings)) {
    tower.etaState.rings.forEach((ring) => {
      if (!ring) {
        return;
      }
      if (Array.isArray(ring.orbs)) {
        ring.orbs.forEach((orb) => {
          if (orb?.trail) {
            orb.trail.length = 0;
          }
        });
      }
    });
  }
  tower.etaState = null;
}

/**
 * Ensure η towers maintain their orbital ring state and derived stats.
 */
export function ensureEtaState(playfield, tower, options = {}) {
  if (!playfield || !tower || tower.type !== 'eta') {
    return null;
  }

  const { forceResync = false } = options;
  const minDimension = Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) || 1;

  const aleph1 = Math.max(1, computeTowerVariableValue('eta', 'aleph1'));
  const aleph2 = Math.max(1, computeTowerVariableValue('eta', 'aleph2'));
  const aleph3 = Math.max(1, computeTowerVariableValue('eta', 'aleph3'));
  const aleph4 = Math.max(1, computeTowerVariableValue('eta', 'aleph4'));
  const aleph5 = Math.max(1, computeTowerVariableValue('eta', 'aleph5'));
  const aleph6Raw = Math.max(1, computeTowerVariableValue('eta', 'aleph6'));
  const aleph6 = Math.min(5, aleph6Raw);

  const gammaValue = Math.max(0, calculateTowerEquationResult('gamma'));
  const baseAttackFactor = Math.max(0, gammaValue * aleph1);
  const denominator = Math.max(0.0001, aleph2 * aleph3 * aleph4 * aleph5);

  const isPrestige = Boolean(tower.isPrestigeEta);
  const prime = Number.isFinite(tower.etaPrime) ? Math.max(0, tower.etaPrime) : 0;
  const totalRings = isPrestige ? 5 : Math.min(5, 2 + prime);
  const rangeMeters = 5 + aleph6;
  const rangePixels = metersToPixels(rangeMeters, minDimension);

  tower.range = rangePixels;
  tower.baseRange = rangePixels;
  tower.damage = 0;
  tower.baseDamage = 0;
  tower.rate = 1;
  tower.baseRate = 1;
  tower.symbol = isPrestige ? 'Η' : tower.definition?.symbol || 'η';

  let state = tower.etaState;
  if (!state) {
    state = {
      rings: [],
      alignmentStatus: new Map(),
      elapsed: 0,
    };
    tower.etaState = state;
  }

  const configurationSignature = [
    isPrestige ? 'prestige' : 'standard',
    `prime:${prime}`,
    `rings:${totalRings}`,
    `a1:${aleph1.toFixed(4)}`,
    `a2:${aleph2.toFixed(4)}`,
    `a3:${aleph3.toFixed(4)}`,
    `a4:${aleph4.toFixed(4)}`,
    `a5:${aleph5.toFixed(4)}`,
    `a6:${aleph6.toFixed(4)}`,
  ].join('|');

  const baseSpeeds = [
    1 / denominator,
    (1 + aleph2) / denominator,
    (1 + 2 * aleph3) / denominator,
    (2 + 3 * aleph4) / denominator,
    (1 + 2 ** aleph5) / denominator,
  ];

  if (forceResync || state.configurationSignature !== configurationSignature) {
    const rings = [];
    for (let index = 0; index < totalRings; index += 1) {
      const ringNumber = index + 1;
      const stepsFromInner = totalRings - ringNumber;
      const radiusMeters = 1 + 0.5 * stepsFromInner;
      const radiusPixels = metersToPixels(radiusMeters, minDimension);
      const baseSpeed = isPrestige
        ? ETA_PRESTIGE_RING_SPEEDS[index] ?? ETA_PRESTIGE_RING_SPEEDS[ETA_PRESTIGE_RING_SPEEDS.length - 1]
        : baseSpeeds[index] ?? baseSpeeds[baseSpeeds.length - 1];
      const safeSpeed = Number.isFinite(baseSpeed) ? Math.max(0, baseSpeed) : 0;
      const angularVelocity = safeSpeed * Math.PI * 2;
      const rgb = ETA_RING_RGB[index % ETA_RING_RGB.length];
      const orbCount = isPrestige
        ? 2
        : Math.max(1, Math.round((ringNumber * (ringNumber - 1)) / 2 + 1));
      const orbs = [];
      for (let orbIndex = 0; orbIndex < orbCount; orbIndex += 1) {
        const angle = (Math.PI * 2 * orbIndex) / orbCount;
        const position = {
          x: tower.x + Math.cos(angle) * radiusPixels,
          y: tower.y + Math.sin(angle) * radiusPixels,
        };
        orbs.push({
          id: `${ringNumber}-${orbIndex}`,
          index: orbIndex,
          angle,
          position,
          trail: [{ ...position, age: 0 }],
        });
      }
      const orbRadius = Math.max(6, Math.min(18, radiusPixels * 0.08));
      rings.push({
        ringNumber,
        radiusMeters,
        radiusPixels,
        speedRps: safeSpeed,
        angularVelocity,
        rgb,
        orbs,
        orbRadius,
        maxTrailPoints: 72,
      });
    }
    state.rings = rings;
    state.alignmentStatus = new Map();
    state.elapsed = 0;
  }

  state.rings.forEach((ring, index) => {
    if (!ring) {
      return;
    }
    const stepsFromInner = totalRings - ring.ringNumber;
    const radiusMeters = 1 + 0.5 * stepsFromInner;
    const radiusPixels = metersToPixels(radiusMeters, minDimension);
    const baseSpeed = isPrestige
      ? ETA_PRESTIGE_RING_SPEEDS[index] ?? ETA_PRESTIGE_RING_SPEEDS[ETA_PRESTIGE_RING_SPEEDS.length - 1]
      : baseSpeeds[index] ?? baseSpeeds[baseSpeeds.length - 1];
    const safeSpeed = Number.isFinite(baseSpeed) ? Math.max(0, baseSpeed) : 0;
    ring.radiusMeters = radiusMeters;
    ring.radiusPixels = radiusPixels;
    ring.speedRps = safeSpeed;
    ring.angularVelocity = safeSpeed * Math.PI * 2;
    ring.rgb = ETA_RING_RGB[index % ETA_RING_RGB.length];
    ring.orbRadius = Math.max(6, Math.min(18, radiusPixels * 0.08));
    ring.maxTrailPoints = Number.isFinite(ring.maxTrailPoints) ? ring.maxTrailPoints : 72;
  });

  state.configurationSignature = configurationSignature;
  state.baseAttackFactor = baseAttackFactor;
  state.rangePixels = rangePixels;
  state.rangeMeters = rangeMeters;
  state.denominator = denominator;
  state.totalRings = totalRings;
  state.isPrestige = isPrestige;
  state.trailDuration = isPrestige ? 1.1 : 0.9;
  state.angleThreshold = ETA_ALIGNMENT_THRESHOLD_RADIANS;
  state.laserWidthBase = Math.max(6, rangePixels * 0.02);
  state.alephValues = { aleph1, aleph2, aleph3, aleph4, aleph5, aleph6 };
  state.maxTrailPoints = Number.isFinite(state.maxTrailPoints) ? state.maxTrailPoints : 72;

  return state;
}

/**
 * Merge η towers to unfold rings and handle prestige transitions.
 */
export function mergeEtaTower(playfield, tower, { silent = false } = {}) {
  if (!playfield || !tower || tower.type !== 'eta') {
    return false;
  }

  const nextPrime = (Number.isFinite(tower.etaPrime) ? tower.etaPrime : 0) + 1;
  const prestigeActivated = nextPrime >= ETA_MAX_PRESTIGE_MERGES;
  tower.etaPrime = Math.min(nextPrime, ETA_MAX_PRESTIGE_MERGES);
  if (prestigeActivated) {
    tower.isPrestigeEta = true;
  }

  teardownEtaTower(playfield, tower);
  ensureEtaState(playfield, tower, { forceResync: true });
  tower.cooldown = 0;

  const totalRings = tower.etaState?.totalRings || Math.min(5, 2 + tower.etaPrime);
  if (playfield.messageEl && !silent) {
    if (tower.isPrestigeEta) {
      playfield.messageEl.textContent = 'η lattice ascended into Η—five rings ignite in harmony.';
    } else {
      playfield.messageEl.textContent = `η resonance deepens—${totalRings} orbital rings align.`;
    }
  }

  playfield.spawnTowerEquationScribble(tower, { towerType: 'eta', silent });
  playfield.updateHud();
  playfield.draw();
  refreshTowerLoadoutDisplay();
  playfield.dependencies.updateStatusDisplays();
  if (playfield.audio && !silent) {
    playfield.audio.playSfx('towerMerge');
  }
  return true;
}

/**
 * Advance η orbital physics, orbit trails, and alignment-triggered lasers.
 */
export function updateEtaTower(playfield, tower, delta) {
  if (!playfield) {
    return;
  }
  const state = ensureEtaState(playfield, tower);
  if (!state) {
    return;
  }

  const step = Math.max(0, Number.isFinite(delta) ? delta : 0);
  state.elapsed = Number.isFinite(state.elapsed) ? state.elapsed + step : step;

  const rings = Array.isArray(state.rings) ? state.rings : [];
  const maxTrailPoints = Number.isFinite(state.maxTrailPoints) ? state.maxTrailPoints : 72;
  const currentlyAligning = new Map();
  const orbEntries = [];

  rings.forEach((ring) => {
    if (!ring) {
      return;
    }
    const orbs = Array.isArray(ring.orbs) ? ring.orbs : [];
    const angularVelocity = Number.isFinite(ring.angularVelocity) ? ring.angularVelocity : 0;
    orbs.forEach((orb) => {
      if (!orb) {
        return;
      }
      const angle = Number.isFinite(orb.angle) ? orb.angle : 0;
      orb.angle = angle + angularVelocity * step;
      const position = {
        x: tower.x + Math.cos(orb.angle) * ring.radiusPixels,
        y: tower.y + Math.sin(orb.angle) * ring.radiusPixels,
      };
      orb.position = position;

      const trail = Array.isArray(orb.trail) ? orb.trail : [];
      const trailLimit = Number.isFinite(ring.maxTrailPoints) ? ring.maxTrailPoints : maxTrailPoints;
      trail.push({ ...position, age: 0 });
      for (let index = trail.length - 1; index >= 0; index -= 1) {
        const point = trail[index];
        if (!point) {
          trail.splice(index, 1);
          continue;
        }
        point.age = (Number.isFinite(point.age) ? point.age : 0) + step;
        const expired = point.age > (state.trailDuration || 0.9);
        const overflow = index < trail.length - trailLimit;
        if (expired || overflow) {
          trail.splice(index, 1);
        }
      }
      orb.trail = trail;

      orbEntries.push({
        id: `${ring.ringNumber}-${orb.index}`,
        ringNumber: ring.ringNumber,
        angle: ((orb.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
        rgb: ring.rgb,
        orbitAlign: orbs.length,
        damageFactor: state.baseAttackFactor,
      });
    });
  });

  if (orbEntries.length < 2) {
    return;
  }

  if (!(state.alignmentStatus instanceof Map)) {
    state.alignmentStatus = new Map();
  }

  const threshold = Number.isFinite(state.angleThreshold)
    ? state.angleThreshold
    : ETA_ALIGNMENT_THRESHOLD_RADIANS;
  const clusterMap = new Map();

  for (let i = 0; i < orbEntries.length; i += 1) {
    const base = orbEntries[i];
    if (!base) {
      continue;
    }
    const members = [base];
    const uniqueIds = new Set([base.id]);
    for (let j = 0; j < orbEntries.length; j += 1) {
      if (i === j) {
        continue;
      }
      const candidate = orbEntries[j];
      if (!candidate) {
        continue;
      }
      if (candidate.ringNumber === base.ringNumber) {
        continue;
      }
      const diff = playfield.angularDifference(base.angle, candidate.angle);
      if (diff > threshold) {
        continue;
      }
      let aligns = true;
      for (let k = 0; k < members.length; k += 1) {
        const other = members[k];
        if (playfield.angularDifference(other.angle, candidate.angle) > threshold) {
          aligns = false;
          break;
        }
      }
      if (!aligns) {
        continue;
      }
      if (!uniqueIds.has(candidate.id)) {
        uniqueIds.add(candidate.id);
        members.push(candidate);
      }
    }
    if (members.length >= 2) {
      const idList = [...uniqueIds].sort();
      clusterMap.set(idList.join('|'), members);
    }
  }

  const stateNow = state.alignmentStatus;
  clusterMap.forEach((members, key) => {
    const status = stateNow.get(key) || { active: false, nextFire: 0 };
    const damage = members.reduce((sum, member) => sum + member.damageFactor, 0);
    const orbitAlign = members.reduce((sum, member) => sum + member.orbitAlign, 0) / members.length;
    if (!status.active || state.elapsed >= status.nextFire) {
      const baseAngle = members.reduce((sum, member) => sum + member.angle, 0) / members.length;
      fireEtaLaser(playfield, tower, state, {
        angle: baseAngle,
        orbitAlign,
        damage,
      });
      status.active = true;
      status.nextFire = state.elapsed + Math.max(0.25, 1 / Math.max(0.0001, state.denominator));
    }
    stateNow.set(key, status);
    currentlyAligning.set(key, true);
  });

  stateNow.forEach((status, key) => {
    if (!currentlyAligning.has(key) && status) {
      status.active = false;
      stateNow.set(key, status);
    }
  });
}

/**
 * Emit an η laser and apply damage to enemies along its beam.
 */
export function fireEtaLaser(playfield, tower, state, { angle = 0, orbitAlign = 2, damage = 0 } = {}) {
  if (!playfield || !tower || !state) {
    return;
  }
  const range = Math.max(0, Number.isFinite(state.rangePixels) ? state.rangePixels : 0);
  if (range <= 0 || !Number.isFinite(damage) || damage <= 0) {
    return;
  }

  const origin = { x: tower.x, y: tower.y };
  const end = {
    x: origin.x + Math.cos(angle) * range,
    y: origin.y + Math.sin(angle) * range,
  };
  const baseWidth = Number.isFinite(state.laserWidthBase) ? state.laserWidthBase : Math.max(6, range * 0.02);
  const beamHalfWidth = baseWidth * (1 + Math.max(0, orbitAlign - 2) * 0.25);

  const dx = end.x - origin.x;
  const dy = end.y - origin.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.0001) {
    return;
  }
  const nx = dx / length;
  const ny = dy / length;

  playfield.enemies.forEach((enemy) => {
    if (!enemy || enemy.hp <= 0) {
      return;
    }
    const position = playfield.getEnemyPosition(enemy);
    if (!position) {
      return;
    }
    const metrics = playfield.getEnemyVisualMetrics(enemy);
    const radius = playfield.getEnemyHitRadius(enemy, metrics);
    const px = position.x - origin.x;
    const py = position.y - origin.y;
    const projection = px * nx + py * ny;
    const tolerance = radius + beamHalfWidth;
    if (projection < -tolerance || projection > length + tolerance) {
      return;
    }
    const perpendicular = Math.abs(px * ny - py * nx);
    if (perpendicular > tolerance) {
      return;
    }
    applyEtaDamage(playfield, enemy, damage);
  });

  const projectile = {
    patternType: 'etaLaser',
    origin,
    angle,
    length,
    width: beamHalfWidth * 2,
    orbitAlign,
    lifetime: 0,
    maxLifetime: 0.18,
    alpha: 1,
  };
  playfield.projectiles.push(projectile);
}

/**
 * Apply η laser damage and remove defeated enemies from play.
 */
export function applyEtaDamage(playfield, enemy, damage) {
  if (!playfield || !enemy || !Number.isFinite(damage) || damage <= 0) {
    return;
  }
  enemy.hp -= damage;
  if (enemy.hp <= 0) {
    playfield.processEnemyDefeat(enemy);
  }
}

/**
 * Render η orbital rings and trailing motes for the planetary lattice.
 */
export function drawEtaOrbits(playfield, tower) {
  if (!playfield?.ctx || !tower?.etaState) {
    return;
  }
  const state = tower.etaState;
  const rings = Array.isArray(state.rings) ? state.rings : [];
  if (!rings.length) {
    return;
  }

  const ctx = playfield.ctx;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const trailDuration = Number.isFinite(state.trailDuration) ? state.trailDuration : 0.9;
  const maxTrailPoints = Number.isFinite(state.maxTrailPoints) ? state.maxTrailPoints : 72;

  rings.forEach((ring) => {
    if (!ring) {
      return;
    }
    const [r, g, b] = Array.isArray(ring.rgb) ? ring.rgb : [139, 247, 255];
    const radius = Number.isFinite(ring.radiusPixels) ? ring.radiusPixels : 0;
    if (radius > 0) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.35)`;
      ctx.lineWidth = Math.max(1, radius * 0.015);
      ctx.arc(tower.x, tower.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    const orbs = Array.isArray(ring.orbs) ? ring.orbs : [];
    const trailLimit = Number.isFinite(ring.maxTrailPoints) ? ring.maxTrailPoints : maxTrailPoints;
    orbs.forEach((orb) => {
      if (!orb?.position) {
        return;
      }
      const [or, og, ob] = Array.isArray(ring.rgb) ? ring.rgb : [139, 247, 255];
      const alpha = Math.min(1, Math.max(0.2, orb.trail?.length ? 0.6 : 0.4));
      playfield.applyCanvasShadow(ctx, `rgba(${or}, ${og}, ${ob}, 0.45)`, (ring.orbRadius || 8) * 1.4);
      ctx.fillStyle = `rgba(${or}, ${og}, ${ob}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(orb.position.x, orb.position.y, ring.orbRadius || 8, 0, Math.PI * 2);
      ctx.fill();
      playfield.clearCanvasShadow(ctx);

      const trail = Array.isArray(orb.trail) ? orb.trail : [];
      for (let index = Math.max(1, trail.length - trailLimit); index < trail.length; index += 1) {
        const point = trail[index];
        const previous = trail[index - 1];
        if (!point || !previous) {
          continue;
        }
        const age = Number.isFinite(point.age) ? point.age : 0;
        const fade = trailDuration > 0 ? Math.max(0, 1 - age / trailDuration) : 0.5;
        if (fade <= 0) {
          continue;
        }
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${or}, ${og}, ${ob}, ${fade * 0.45})`;
        ctx.lineWidth = Math.max(1, (ring.orbRadius || 8) * 0.35);
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
    });
  });

  ctx.restore();
}
