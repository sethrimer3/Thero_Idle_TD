// Δ tower helper module centralizes cohort AI, visuals, and math away from the playfield.
import {
  getTowerDefinition,
  getTowerEquationBlueprint,
  computeTowerVariableValue,
  calculateTowerEquationResult,
} from '../../../assets/towersTab.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';
import { formatGameNumber } from '../../core/formatting.js';
import { metersToPixels } from '../../../assets/gameUnits.js';

// Fallback gradient anchors Delta colors when palette metadata is unavailable.
const DELTA_FALLBACK_GRADIENT = [
  { r: 139, g: 247, b: 255 },
  { r: 255, g: 138, b: 216 },
];

// Particle trail tuning keeps luminous footprints lingering just long enough to feel ethereal.
const DELTA_TRAIL_CONFIG = {
  lifespan: 0.9,
  spawnInterval: 0.04,
  minDistance: 3,
  maxPoints: 45,
};

// Default angular velocity (radians per second) for Δ sentries orbiting a track anchor.
const DELTA_ORBIT_DEFAULT_SPEED = Math.PI * 0.35;

// Short dash that kicks in near targets to create a ramming flourish.
const DELTA_RAM_DISTANCE_METERS = 1;
const DELTA_RAM_SPEED_MULTIPLIER = 1.75;
const DELTA_RAM_TURN_ANGLE = Math.PI * 0.55;
const DELTA_RAM_COOLDOWN = 0.65;

// Clamp helper ensures math stays within bounds even when towers feed edge cases.
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Linear interpolation keeps color channel blending smooth while sampling palette endpoints.
const lerp = (start, end, t) => start + (end - start) * t;

// Resolve a gradient color for the provided progress value using the active palette metadata.
function sampleDeltaGradientColor(progress) {
  const t = clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
  const start = samplePaletteGradient(0) || DELTA_FALLBACK_GRADIENT[0];
  const end = samplePaletteGradient(1) || DELTA_FALLBACK_GRADIENT[DELTA_FALLBACK_GRADIENT.length - 1];
  return {
    r: Math.round(lerp(start.r, end.r, t)),
    g: Math.round(lerp(start.g, end.g, t)),
    b: Math.round(lerp(start.b, end.b, t)),
  };
}

// Convert a color object into an rgba string with caller supplied alpha control.
function toRgba({ r, g, b }, alpha = 1) {
  const red = clamp(Math.round(r), 0, 255);
  const green = clamp(Math.round(g), 0, 255);
  const blue = clamp(Math.round(b), 0, 255);
  const safeAlpha = clamp(alpha, 0, 1);
  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
}

// Attach the cohort state to the tower so delta math can run independently of the playfield.
export function ensureDeltaState(playfield, tower) {
  if (!tower || tower.type !== 'delta') {
    return null;
  }
  const gammaDefinition = getTowerDefinition('gamma') || {};
  const alphaDefinition = getTowerDefinition('alpha') || {};
  const blueprint = getTowerEquationBlueprint('delta');
  const alephValue = computeTowerVariableValue('delta', 'aleph1', blueprint);
  const alephRank = Number.isFinite(alephValue) ? Math.max(1, Math.round(alephValue)) : 1;

  const gammaEquation = calculateTowerEquationResult('gamma');
  const fallbackGamma = Number.isFinite(gammaDefinition.damage)
    ? Math.max(1, gammaDefinition.damage)
    : Math.max(1, tower.baseDamage || 1);
  const gammaPower = Number.isFinite(gammaEquation) && gammaEquation > 0 ? gammaEquation : fallbackGamma;

  const rawHealth = gammaPower ** alephRank;
  const maxHealth = Number.isFinite(rawHealth) ? Math.max(1, rawHealth) : Number.MAX_SAFE_INTEGER;

  const rawTrainingSeconds = 5 ** alephRank;
  const trainingSeconds = Number.isFinite(rawTrainingSeconds)
    ? Math.max(1, rawTrainingSeconds)
    : Number.MAX_SAFE_INTEGER;
  const spawnRate = trainingSeconds > 0 && Number.isFinite(trainingSeconds) ? 1 / trainingSeconds : 0;
  const regenPerSecond = Number.isFinite(maxHealth) ? maxHealth / 20 : Number.MAX_SAFE_INTEGER;

  const totalSoldiers = 3 + alephRank;
  const maxSoldiers = Number.isFinite(totalSoldiers)
    ? Math.max(1, Math.round(totalSoldiers))
    : 1;

  const rawDefense = Number.isFinite(tower.definition?.def)
    ? tower.definition.def
    : Number.isFinite(alphaDefinition.damage)
    ? alphaDefinition.damage
    : 0;
  const defense = Math.max(0, rawDefense);

  const deltaProduct =
    maxHealth * Math.max(regenPerSecond, 0.0001) * maxSoldiers * Math.max(defense, 1);

  if (!tower.deltaState) {
    tower.deltaState = {
      alephRank,
      maxHealth,
      regenPerSecond,
      maxSoldiers,
      defense,
      trainingSeconds,
      spawnRate,
      product: deltaProduct,
      soldiers: [],
      manualTargetId: null,
      soldierCounter: 0,
      trackHoldPoint: null,
      trackHoldManual: false,
      trackHoldProgress: 0,
      orbitPhase: 0,
      orbitAngularSpeed: DELTA_ORBIT_DEFAULT_SPEED,
      mode: tower.behaviorMode || 'pursuit',
    };
  } else {
    const previousMaxHealth = tower.deltaState.maxHealth;
    tower.deltaState.alephRank = alephRank;
    tower.deltaState.maxHealth = maxHealth;
    tower.deltaState.regenPerSecond = regenPerSecond;
    tower.deltaState.maxSoldiers = maxSoldiers;
    tower.deltaState.defense = defense;
    tower.deltaState.product = deltaProduct;
    tower.deltaState.trainingSeconds = trainingSeconds;
    tower.deltaState.spawnRate = spawnRate;
    if (!Number.isFinite(tower.deltaState.orbitAngularSpeed) || tower.deltaState.orbitAngularSpeed <= 0) {
      tower.deltaState.orbitAngularSpeed = DELTA_ORBIT_DEFAULT_SPEED;
    }
    const previousBaseline = Number.isFinite(previousMaxHealth) ? previousMaxHealth : maxHealth;
    tower.deltaState.soldiers.forEach((soldier) => {
      if (!soldier) {
        return;
      }
      soldier.maxHealth = maxHealth;
      if (previousBaseline > 0 && Number.isFinite(previousBaseline) && Number.isFinite(maxHealth)) {
        const ratio = Math.max(0, soldier.health) / previousBaseline;
        soldier.health = Math.min(maxHealth, Math.max(0, ratio * maxHealth));
      } else {
        soldier.health = Math.min(maxHealth, Math.max(0, soldier.health));
      }
      soldier.regenPerSecond = regenPerSecond;
      soldier.defense = defense;
    });
  }

  if (Number.isFinite(spawnRate) && spawnRate >= 0) {
    tower.rate = spawnRate;
    tower.baseRate = spawnRate;
  }
  if (Number.isFinite(trainingSeconds) && trainingSeconds >= 0 && Number.isFinite(tower.cooldown)) {
    tower.cooldown = Math.min(tower.cooldown, trainingSeconds);
  }
  return tower.deltaState;
}

// Update tower stance bookkeeping so manual targets and anchors stay aligned with player intent.
export function configureDeltaBehavior(playfield, tower, mode) {
  if (!tower || tower.type !== 'delta') {
    if (tower) {
      tower.behaviorMode = mode;
    }
    return;
  }
  const state = ensureDeltaState(playfield, tower);
  const nextMode = mode || 'pursuit';
  tower.behaviorMode = nextMode;
  state.mode = nextMode;
  if (nextMode !== 'sentinel') {
    clearTowerManualTarget(playfield, tower);
  }
  updateDeltaAnchors(playfield, tower);
}

// Remove cached Δ state so dismantled towers stop simulating orphaned soldiers.
export function teardownDeltaTower(playfield, tower) {
  if (!tower?.deltaState) {
    return;
  }
  tower.deltaState.soldiers = [];
  tower.deltaState.manualTargetId = null;
  tower.deltaState = null;
}

// Align the cached track-hold anchor with the latest path data so soldiers orbit accurately.
export function updateDeltaAnchors(playfield, tower) {
  if (!tower || tower.type !== 'delta') {
    return;
  }
  const state = ensureDeltaState(playfield, tower);
  if (tower.behaviorMode === 'trackHold') {
    if (state.trackHoldManual && Number.isFinite(state.trackHoldProgress)) {
      const clampedProgress = Math.max(0, Math.min(1, state.trackHoldProgress));
      const manualAnchor = playfield.getPositionAlongPath(clampedProgress);
      if (manualAnchor) {
        state.trackHoldPoint = { x: manualAnchor.x, y: manualAnchor.y };
        state.trackHoldTangent = Number.isFinite(manualAnchor.tangent) ? manualAnchor.tangent : null;
      }
    } else {
      const anchor = playfield.getClosestPointOnPath({ x: tower.x, y: tower.y });
      const position = Number.isFinite(anchor?.progress)
        ? playfield.getPositionAlongPath(anchor.progress)
        : null;
      const anchorPoint = position || anchor?.point;
      if (anchorPoint) {
        state.trackHoldPoint = { x: anchorPoint.x, y: anchorPoint.y };
        state.trackHoldTangent = Number.isFinite(position?.tangent) ? position.tangent : null;
      } else {
        state.trackHoldPoint = { x: tower.x, y: tower.y };
        state.trackHoldTangent = null;
      }
      state.trackHoldProgress = Number.isFinite(anchor?.progress) ? anchor.progress : 0;
      state.trackHoldManual = false;
    }
  }
}

// Anchor Δ cohorts to a specific point along the glyph lane selected by the player.
export function assignDeltaTrackHoldAnchor(playfield, tower, anchor) {
  if (!playfield || !tower || tower.type !== 'delta' || !anchor) {
    return false;
  }
  configureDeltaBehavior(playfield, tower, 'trackHold');
  const state = ensureDeltaState(playfield, tower);
  if (!state) {
    return false;
  }

  const resolved = {
    x: Number.isFinite(anchor.x) ? anchor.x : tower.x,
    y: Number.isFinite(anchor.y) ? anchor.y : tower.y,
  };
  let progress = Number.isFinite(anchor.progress) ? anchor.progress : null;
  if (!Number.isFinite(progress)) {
    const projection = playfield.getClosestPointOnPath(resolved);
    if (projection?.point) {
      resolved.x = projection.point.x;
      resolved.y = projection.point.y;
    }
    progress = Number.isFinite(projection?.progress) ? projection.progress : 0;
  }

  const clampedProgress = Math.max(0, Math.min(1, progress));
  state.trackHoldManual = true;
  state.trackHoldProgress = clampedProgress;
  state.trackHoldPoint = { x: resolved.x, y: resolved.y };
  const anchorPosition = playfield.getPositionAlongPath(clampedProgress);
  state.trackHoldTangent = Number.isFinite(anchorPosition?.tangent) ? anchorPosition.tangent : null;
  state.orbitPhase = 0;
  if (!Number.isFinite(state.orbitAngularSpeed) || state.orbitAngularSpeed <= 0) {
    state.orbitAngularSpeed = DELTA_ORBIT_DEFAULT_SPEED;
  }
  updateDeltaAnchors(playfield, tower);
  return true;
}

// Reset the manual sentry target when players retune the tower into other stances.
export function clearTowerManualTarget(playfield, tower) {
  if (!tower?.deltaState?.manualTargetId) {
    return false;
  }
  tower.deltaState.manualTargetId = null;
  return true;
}

// Surface the current manual target and prune dead references during menu interactions.
export function getTowerManualTarget(playfield, tower) {
  if (!tower?.deltaState?.manualTargetId) {
    return null;
  }
  const enemy = playfield.enemies.find((candidate) => candidate?.id === tower.deltaState.manualTargetId);
  if (!enemy || enemy.hp <= 0) {
    clearTowerManualTarget(playfield, tower);
    return null;
  }
  return enemy;
}

// Cache an idle waypoint so each soldier knows where to orbit when no threats are active.
function resolveDeltaHoldPosition(playfield, tower, soldier, state) {
  const minDimension = Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) || 1;
  const index = Number.isFinite(soldier.slotIndex) ? soldier.slotIndex : 0;
  const count = Math.max(1, state.maxSoldiers || 1);
  const defaultAngle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
  if (!Number.isFinite(soldier.idleAngleOffset)) {
    soldier.idleAngleOffset = defaultAngle;
  }
  const baseAngle = Number.isFinite(soldier.idleAngleOffset) ? soldier.idleAngleOffset : defaultAngle;
  if (tower.behaviorMode === 'trackHold' && state.trackHoldPoint) {
    const tau = Math.PI * 2;
    const orbitPhase = Number.isFinite(soldier.swarmPhase) ? soldier.swarmPhase : Math.random() * tau;
    const tangent = Number.isFinite(state.trackHoldTangent) ? state.trackHoldTangent : baseAngle;
    const forwardX = Math.cos(tangent);
    const forwardY = Math.sin(tangent);
    const normalX = -forwardY;
    const normalY = forwardX;
    const loopRadius = Math.max(24, minDimension * 0.06) * (soldier.swarmRadiusMultiplier ?? 1);
    const phase = orbitPhase;
    const along = Math.cos(phase) * loopRadius * 1.3;
    const lateral = Math.sin(phase * 1.25) * loopRadius * 0.8;
    return {
      x: state.trackHoldPoint.x + forwardX * along + normalX * lateral,
      y: state.trackHoldPoint.y + forwardY * along + normalY * lateral,
    };
  }
  const sentinelRadius = tower.behaviorMode === 'sentinel'
    ? Math.max(28, minDimension * 0.07)
    : Math.max(18, minDimension * 0.045);
  return {
    x: tower.x + Math.cos(baseAngle) * sentinelRadius,
    y: tower.y + Math.sin(baseAngle) * sentinelRadius,
  };
}

// Record a fresh trail point when the soldier moves far enough to warrant another streak segment.
function appendTrailPoint(soldier, x, y) {
  if (!soldier.trailPoints) {
    soldier.trailPoints = [];
  }
  soldier.trailPoints.push({ x, y, age: 0 });
  if (soldier.trailPoints.length > DELTA_TRAIL_CONFIG.maxPoints) {
    soldier.trailPoints.splice(0, soldier.trailPoints.length - DELTA_TRAIL_CONFIG.maxPoints);
  }
  soldier.lastTrailSample = { x, y };
  soldier.trailAccumulator = 0;
}

// Gently age and prune stored trail points so the ribbon always feels fresh.
function updateTrailAges(soldier, delta) {
  if (!Array.isArray(soldier.trailPoints) || !soldier.trailPoints.length) {
    return;
  }
  for (let index = soldier.trailPoints.length - 1; index >= 0; index -= 1) {
    const point = soldier.trailPoints[index];
    point.age += delta;
    if (point.age >= DELTA_TRAIL_CONFIG.lifespan) {
      soldier.trailPoints.splice(index, 1);
    }
  }
}

// Emit a new Δ soldier, assign its gradient color, and seed its particle trail buffers.
export function deployDeltaSoldier(playfield, tower, targetInfo = null) {
  const state = ensureDeltaState(playfield, tower);
  if (!state) {
    return;
  }
  const limit = Math.max(1, state.maxSoldiers || 1);
  if (state.soldiers.length >= limit) {
    return;
  }
  const minDimension = Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) || 1;
  const spawnRadius = Math.max(12, minDimension * 0.035);
  const collisionRadius = Math.max(12, minDimension * 0.03);
  const spawnIndex = state.soldierCounter % limit;
  state.soldierCounter += 1;
  const angle = -Math.PI / 2 + (Math.PI * 2 * spawnIndex) / limit;
  const spawnX = tower.x + Math.cos(angle) * spawnRadius;
  const spawnY = tower.y + Math.sin(angle) * spawnRadius;
  const gradientProgress = limit > 1 ? spawnIndex / (limit - 1) : 0;
  const color = sampleDeltaGradientColor(gradientProgress);

  const soldier = {
    id: `delta-soldier-${(playfield.deltaSoldierIdCounter += 1)}`,
    towerId: tower.id,
    slotIndex: spawnIndex,
    x: spawnX,
    y: spawnY,
    prevX: spawnX,
    prevY: spawnY,
    vx: 0,
    vy: 0,
    heading: angle,
    idleAngleOffset: angle,
    maxHealth: state.maxHealth,
    health: state.maxHealth,
    regenPerSecond: state.regenPerSecond,
    defense: state.defense,
    targetId: targetInfo?.enemy?.id || null,
    collisionRadius,
    mode: tower.behaviorMode || 'pursuit',
    trailPoints: [],
    trailAccumulator: 0,
    lastTrailSample: { x: spawnX, y: spawnY },
    color,
    gradientProgress,
    ramCooldown: 0,
    ramDistanceRemaining: 0,
    ramHeading: angle,
    ramTurn: 1,
    // Per-soldier swarm tuning so each sentry orbits independently during track-hold.
    swarmPhase: Math.random() * Math.PI * 2,
    swarmSpeedMultiplier: 0.85 + Math.random() * 0.35,
    swarmRadiusMultiplier: 0.8 + Math.random() * 0.6,
  };

  state.soldiers.push(soldier);
}

// March each soldier forward, regenerate health, and process collisions with active enemies.
function updateDeltaSoldier(playfield, tower, soldier, delta, state) {
  if (!soldier || soldier.health <= 0) {
    return false;
  }

  // Track-hold uses personal swarm timers so sentries drift independently instead of marching in a single orbit.
  const tau = Math.PI * 2;
  if (tower.behaviorMode === 'trackHold') {
    const orbitSpeed = Number.isFinite(state.orbitAngularSpeed) && state.orbitAngularSpeed > 0
      ? state.orbitAngularSpeed
      : DELTA_ORBIT_DEFAULT_SPEED;
    const soldierOrbitSpeed = orbitSpeed * (soldier.swarmSpeedMultiplier ?? 1);
    if (!Number.isFinite(soldier.swarmPhase)) {
      soldier.swarmPhase = Math.random() * tau;
    }
    soldier.swarmPhase += delta * soldierOrbitSpeed;
    if (soldier.swarmPhase > tau || soldier.swarmPhase < -tau) {
      soldier.swarmPhase %= tau;
    }
  }

  const regenRate = Number.isFinite(state.regenPerSecond)
    ? state.regenPerSecond
    : Number.isFinite(soldier.regenPerSecond)
    ? soldier.regenPerSecond
    : 0;
  if (regenRate > 0 && soldier.health < soldier.maxHealth) {
    const gain = regenRate * delta;
    soldier.health = Math.min(soldier.maxHealth, soldier.health + gain);
  }

  let target = null;
  if (soldier.targetId) {
    target = playfield.enemies.find((candidate) => candidate?.id === soldier.targetId) || null;
    if (!target || target.hp <= 0) {
      soldier.targetId = null;
      target = null;
    }
  }

  if (!target && playfield.combatActive && playfield.enemies.length) {
    if (tower.behaviorMode === 'sentinel') {
      const manual = getTowerManualTarget(playfield, tower);
      if (manual) {
        soldier.targetId = manual.id;
        target = manual;
      }
    } else {
      const candidate = playfield.findTarget(tower);
      if (candidate?.enemy) {
        if (tower.behaviorMode !== 'trackHold') {
          soldier.targetId = candidate.enemy.id;
          target = candidate.enemy;
        } else {
          const anchor = state.trackHoldPoint || { x: tower.x, y: tower.y };
          const targetPosition = candidate.position || playfield.getEnemyPosition(candidate.enemy);
          const interceptRadius = Math.max(tower.range * 0.55, soldier.collisionRadius * 6);
          const distance = targetPosition
            ? Math.hypot(targetPosition.x - anchor.x, targetPosition.y - anchor.y)
            : Infinity;
          if (distance <= interceptRadius) {
            soldier.targetId = candidate.enemy.id;
            target = candidate.enemy;
          }
        }
      }
    }
  }

  soldier.ramCooldown = Math.max(0, (soldier.ramCooldown || 0) - delta);

  const minDimension = Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) || 1;
  const speed = Math.max(90, minDimension * 0.22);
  const ramDistance = metersToPixels(DELTA_RAM_DISTANCE_METERS, minDimension);

  let destination = null;
  let cachedTargetPosition = null;
  let cachedEnemyMetrics = null;
  let cachedEnemyRadius = null;
  if (target) {
    cachedTargetPosition = playfield.getEnemyPosition(target);
    destination = cachedTargetPosition;
    cachedEnemyMetrics = playfield.getEnemyVisualMetrics(target);
    cachedEnemyRadius = playfield.getEnemyHitRadius(target, cachedEnemyMetrics);
  }
  if (!destination) {
    destination = resolveDeltaHoldPosition(playfield, tower, soldier, state);
  }
  if (!destination) {
    destination = { x: tower.x, y: tower.y };
  }

  const dx = destination.x - soldier.x;
  const dy = destination.y - soldier.y;
  const distance = Math.hypot(dx, dy);
  const acceleration = Math.max(200, minDimension * 0.5);
  let nx = 0;
  let ny = 0;
  if (distance > 0.0001) {
    nx = dx / distance;
    ny = dy / distance;
  }

  const ramActive = Number.isFinite(soldier.ramDistanceRemaining) && soldier.ramDistanceRemaining > 0;
  const contactRadius = cachedEnemyRadius + (soldier.collisionRadius || 12);
  if (
    target &&
    !ramActive &&
    soldier.ramCooldown <= 0 &&
    Number.isFinite(contactRadius) &&
    distance <= contactRadius * 1.15
  ) {
    soldier.ramDistanceRemaining = ramDistance;
    soldier.ramHeading = Math.atan2(dy, dx);
    soldier.ramTurn = Math.random() < 0.5 ? -1 : 1;
  }

  let desiredSpeed = distance > 1 ? speed : 0;
  if (ramActive) {
    const heading = Number.isFinite(soldier.ramHeading) ? soldier.ramHeading : Math.atan2(dy, dx);
    nx = Math.cos(heading);
    ny = Math.sin(heading);
    desiredSpeed = speed * DELTA_RAM_SPEED_MULTIPLIER;
  }
  const desiredVx = nx * desiredSpeed;
  const desiredVy = ny * desiredSpeed;
  const deltaVx = desiredVx - soldier.vx;
  const deltaVy = desiredVy - soldier.vy;
  const deltaMagnitude = Math.hypot(deltaVx, deltaVy);
  const maxVelocityChange = acceleration * delta;
  if (deltaMagnitude > maxVelocityChange && deltaMagnitude > 0) {
    const blend = maxVelocityChange / deltaMagnitude;
    soldier.vx += deltaVx * blend;
    soldier.vy += deltaVy * blend;
  } else {
    soldier.vx = desiredVx;
    soldier.vy = desiredVy;
  }

  soldier.prevX = soldier.x;
  soldier.prevY = soldier.y;

  if (distance <= 0.0001) {
    soldier.x = destination.x;
    soldier.y = destination.y;
    if (Math.abs(soldier.vx) < 0.01) {
      soldier.vx = 0;
    }
    if (Math.abs(soldier.vy) < 0.01) {
      soldier.vy = 0;
    }
  } else {
    const stepX = soldier.vx * delta;
    const stepY = soldier.vy * delta;
    const forwardTravel = stepX * nx + stepY * ny;
    if (forwardTravel > distance) {
      soldier.x = destination.x;
      soldier.y = destination.y;
      soldier.vx = 0;
      soldier.vy = 0;
    } else {
      soldier.x += stepX;
      soldier.y += stepY;
    }
  }

  const traveled = Math.hypot(soldier.x - soldier.prevX, soldier.y - soldier.prevY);
  if (ramActive) {
    soldier.ramDistanceRemaining = Math.max(0, soldier.ramDistanceRemaining - traveled);
    soldier.heading = Math.atan2(soldier.vy, soldier.vx);
    if (soldier.ramDistanceRemaining <= 0) {
      soldier.ramCooldown = DELTA_RAM_COOLDOWN;
      soldier.heading += soldier.ramTurn * DELTA_RAM_TURN_ANGLE;
      const speedMagnitude = Math.hypot(soldier.vx, soldier.vy);
      soldier.vx = Math.cos(soldier.heading) * speedMagnitude;
      soldier.vy = Math.sin(soldier.heading) * speedMagnitude;
    }
  }

  if (Number.isFinite(soldier.vx) && Number.isFinite(soldier.vy)) {
    const velocityMagnitude = Math.hypot(soldier.vx, soldier.vy);
    if (velocityMagnitude > 0.01) {
      soldier.heading = Math.atan2(soldier.vy, soldier.vx);
    }
  }

  const lastSample = soldier.lastTrailSample || { x: soldier.prevX, y: soldier.prevY };
  const moved = Math.hypot(soldier.x - lastSample.x, soldier.y - lastSample.y);
  soldier.trailAccumulator = (soldier.trailAccumulator || 0) + delta;
  let appended = false;
  if (
    moved >= DELTA_TRAIL_CONFIG.minDistance &&
    soldier.trailAccumulator >= DELTA_TRAIL_CONFIG.spawnInterval
  ) {
    appendTrailPoint(soldier, soldier.x, soldier.y);
    appended = true;
  }
  if (!Array.isArray(soldier.trailPoints) || !soldier.trailPoints.length) {
    appendTrailPoint(soldier, soldier.x, soldier.y);
    appended = true;
  }
  if (!appended) {
    const cap = DELTA_TRAIL_CONFIG.spawnInterval;
    soldier.trailAccumulator = Math.min(soldier.trailAccumulator, cap);
  }
  updateTrailAges(soldier, delta);

  if (target) {
    const targetPosition = cachedTargetPosition || playfield.getEnemyPosition(target);
    if (targetPosition) {
      const metrics = cachedEnemyMetrics || playfield.getEnemyVisualMetrics(target);
      const enemyRadius = Number.isFinite(cachedEnemyRadius)
        ? cachedEnemyRadius
        : playfield.getEnemyHitRadius(target, metrics);
      const contactRadius = enemyRadius + (soldier.collisionRadius || 12);
      const separation = Math.hypot(soldier.x - targetPosition.x, soldier.y - targetPosition.y);
      if (separation <= contactRadius) {
        const enemyHp = Number.isFinite(target.hp) ? Math.max(0, target.hp) : 0;
        const inflicted = Math.min(soldier.health, enemyHp);
        target.hp = Math.max(0, enemyHp - inflicted);
        const loss = Math.max(0, inflicted - (state.defense || 0));
        soldier.health = Math.max(0, soldier.health - loss);
        if (target.hp <= 0) {
          playfield.processEnemyDefeat(target);
          soldier.targetId = null;
        }
        if (soldier.health <= 0) {
          // Apply delta shift knockback when soldier dies ramming into enemy
          const blueprint = getTowerEquationBlueprint('delta');
          const aleph2Value = computeTowerVariableValue('delta', 'aleph2', blueprint);
          const aleph2Rank = Number.isFinite(aleph2Value) ? Math.max(0, Math.round(aleph2Value)) : 0;
          if (aleph2Rank > 0 && target.hp > 0) {
            const shiftMeters = aleph2Rank * 0.5;
            const minDim = Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) || 1;
            const shiftPixels = metersToPixels(shiftMeters, minDim);
            const pathLength = Number.isFinite(playfield.pathLength) && playfield.pathLength > 0
              ? playfield.pathLength
              : 1;
            const progressShift = shiftPixels / pathLength;
            const oldProgress = Number.isFinite(target.progress) ? target.progress : 0;
            const newProgress = Math.max(0, oldProgress - progressShift);
            target.progress = newProgress;
          }
          return false;
        }
      }
    }
  }

  return soldier.health > 0;
}

// Advance Δ timers, respawn replacements, and keep the cohort synchronized with combat state.
export function updateDeltaTower(playfield, tower, delta) {
  const state = ensureDeltaState(playfield, tower);
  if (!state) {
    return;
  }

  state.mode = tower.behaviorMode || state.mode || 'pursuit';

  const orbitSpeed = Number.isFinite(state.orbitAngularSpeed) && state.orbitAngularSpeed > 0
    ? state.orbitAngularSpeed
    : DELTA_ORBIT_DEFAULT_SPEED;
  const tau = Math.PI * 2;
  if (tower.behaviorMode === 'trackHold') {
    state.orbitPhase = Number.isFinite(state.orbitPhase) ? state.orbitPhase : 0;
    state.orbitPhase += delta * orbitSpeed;
    if (state.orbitPhase > tau || state.orbitPhase < -tau) {
      state.orbitPhase %= tau;
    }
  } else if (Number.isFinite(state.orbitPhase)) {
    state.orbitPhase %= tau;
  } else {
    state.orbitPhase = 0;
  }

  const survivors = [];
  for (let index = 0; index < state.soldiers.length; index += 1) {
    const soldier = state.soldiers[index];
    if (updateDeltaSoldier(playfield, tower, soldier, delta, state)) {
      survivors.push(soldier);
    }
  }
  state.soldiers = survivors;

  const spawnCap = Math.max(1, state.maxSoldiers || 1);
  if (state.soldiers.length > spawnCap) {
    state.soldiers.length = spawnCap;
  }
  if (state.soldiers.length >= spawnCap) {
    return;
  }

  if (tower.cooldown <= 0) {
    const targetInfo = playfield.combatActive ? playfield.findTarget(tower) : null;
    deployDeltaSoldier(playfield, tower, targetInfo);
    const rate = Number.isFinite(state.spawnRate)
      ? Math.max(0, state.spawnRate)
      : Number.isFinite(tower.rate)
      ? Math.max(0, tower.rate)
      : 0;
    if (rate > 0) {
      tower.cooldown = 1 / rate;
    } else if (Number.isFinite(state.trainingSeconds) && state.trainingSeconds > 0) {
      tower.cooldown = state.trainingSeconds;
    } else {
      tower.cooldown = 1;
    }
  }
}

// Render trailing motes followed by the inverted triangle soldier to keep the battlefield lively.
export function drawDeltaSoldiers(playfield) {
  if (!playfield?.ctx) {
    return;
  }
  const ctx = playfield.ctx;
  const minDimension = Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) || 1;
  const baseSize = Math.max(12, minDimension * 0.03);

  ctx.save();
  playfield.towers.forEach((tower) => {
    if (tower.type !== 'delta' || !tower.deltaState?.soldiers?.length) {
      return;
    }
    tower.deltaState.soldiers.forEach((soldier) => {
      if (!Number.isFinite(soldier.x) || !Number.isFinite(soldier.y)) {
        return;
      }
      const size = Number.isFinite(soldier.collisionRadius) ? Math.max(8, soldier.collisionRadius) : baseSize;
      const angle = Number.isFinite(soldier.heading) ? soldier.heading : -Math.PI / 2;
      const healthRatio = soldier.maxHealth > 0 ? clamp(soldier.health / soldier.maxHealth, 0, 1) : 0;
      const color = sampleDeltaGradientColor(soldier.gradientProgress ?? 0);
      soldier.color = color;

      const barWidth = Math.max(36, size * 1.6);
      const barHeight = Math.max(6, size * 0.22);
      const barPadding = Math.max(4, size * 0.35);
      const barX = soldier.x - barWidth / 2;
      const barY = soldier.y - size - barPadding - barHeight;
      const safeHealth = Number.isFinite(soldier.health)
        ? Math.max(0, soldier.health)
        : Number.MAX_SAFE_INTEGER;
      const healthLabel = formatGameNumber(safeHealth);

      ctx.save();
      ctx.fillStyle = toRgba({ r: 6, g: 8, b: 14 }, 0.9);
      ctx.strokeStyle = toRgba({ r: 240, g: 244, b: 255 }, 0.18);
      ctx.lineWidth = Math.max(1, barHeight * 0.18);
      ctx.beginPath();
      ctx.rect(barX, barY, barWidth, barHeight);
      ctx.fill();
      ctx.stroke();

      const innerX = barX + Math.max(1, ctx.lineWidth * 0.6);
      const innerY = barY + Math.max(1, ctx.lineWidth * 0.6);
      const innerWidth = barWidth - Math.max(2, ctx.lineWidth * 1.2);
      const innerHeight = barHeight - Math.max(2, ctx.lineWidth * 1.2);
      const fillWidth = Math.max(0, innerWidth * healthRatio);
      if (fillWidth > 0) {
        ctx.fillStyle = toRgba(color, 0.75);
        ctx.fillRect(innerX, innerY, fillWidth, innerHeight);
      }

      ctx.fillStyle = toRgba({ r: 240, g: 244, b: 255 }, 0.88);
      ctx.font = `${Math.max(10, barHeight * 1.6)}px 'Cormorant Garamond', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(healthLabel, soldier.x, barY + barHeight / 2);
      ctx.restore();

      if (Array.isArray(soldier.trailPoints) && soldier.trailPoints.length) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = toRgba(color, 0.25);
        ctx.lineWidth = Math.max(1.2, size * 0.18);
        ctx.beginPath();
        soldier.trailPoints.forEach((point, index) => {
          const alpha = clamp(1 - point.age / DELTA_TRAIL_CONFIG.lifespan, 0, 1);
          const radius = Math.max(2, size * 0.25 * alpha);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = toRgba(color, alpha * 0.45);
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(soldier.x, soldier.y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(-size * 0.6, size * 0.9);
      ctx.lineTo(size * 0.6, size * 0.9);
      ctx.closePath();
      ctx.fillStyle = toRgba(color, 0.35 + healthRatio * 0.45);
      ctx.strokeStyle = toRgba({ r: 12, g: 16, b: 26 }, 0.9);
      ctx.lineWidth = Math.max(1.2, size * 0.12);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = toRgba({ r: 6, g: 8, b: 14 }, 0.65 + (1 - healthRatio) * 0.25);
      ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  });
  ctx.restore();
}
