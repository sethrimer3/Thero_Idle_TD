// Δ tower helper module centralizes cohort AI, visuals, and math away from the playfield.
import { getTowerDefinition } from '../../../assets/towersTab.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

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
  const gamma = getTowerDefinition('gamma') || {};
  const alpha = getTowerDefinition('alpha') || {};
  const rawAtk = Number.isFinite(tower.definition?.atk)
    ? tower.definition.atk
    : Number.isFinite(gamma.damage)
    ? gamma.damage
    : Math.max(1, tower.baseDamage || 0);
  const atk = Math.max(1, rawAtk);
  const rawReg = Number.isFinite(tower.definition?.reg) ? tower.definition.reg : 0.01;
  const regenPercent = rawReg > 1 ? rawReg / 100 : Math.max(0, rawReg);
  const rawTot = Number.isFinite(tower.definition?.tot) ? tower.definition.tot : 5;
  const maxSoldiers = Math.max(1, Math.round(rawTot));
  const rawDefense = Number.isFinite(tower.definition?.def)
    ? tower.definition.def
    : Number.isFinite(alpha.damage)
    ? alpha.damage
    : 0;
  const defense = Math.max(0, rawDefense);
  const deltaProduct = atk * Math.max(regenPercent, 0.0001) * maxSoldiers * Math.max(defense, 1);

  if (!tower.deltaState) {
    tower.deltaState = {
      atk,
      regenPercent,
      maxSoldiers,
      defense,
      product: deltaProduct,
      soldiers: [],
      manualTargetId: null,
      soldierCounter: 0,
      trackHoldPoint: null,
      mode: tower.behaviorMode || 'pursuit',
    };
  } else {
    tower.deltaState.atk = atk;
    tower.deltaState.regenPercent = regenPercent;
    tower.deltaState.maxSoldiers = maxSoldiers;
    tower.deltaState.defense = defense;
    tower.deltaState.product = deltaProduct;
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
    const anchor = playfield.getClosestPointOnPath({ x: tower.x, y: tower.y });
    state.trackHoldPoint = anchor?.point || { x: tower.x, y: tower.y };
  }
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
  const baseAngle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
  if (tower.behaviorMode === 'trackHold' && state.trackHoldPoint) {
    const radius = Math.max(18, minDimension * 0.05);
    return {
      x: state.trackHoldPoint.x + Math.cos(baseAngle) * radius,
      y: state.trackHoldPoint.y + Math.sin(baseAngle) * radius,
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
    maxHealth: state.atk,
    health: state.atk,
    regenPercent: state.regenPercent,
    defense: state.defense,
    targetId: targetInfo?.enemy?.id || null,
    collisionRadius,
    mode: tower.behaviorMode || 'pursuit',
    trailPoints: [],
    trailAccumulator: 0,
    lastTrailSample: { x: spawnX, y: spawnY },
    color,
    gradientProgress,
  };

  state.soldiers.push(soldier);
}

// March each soldier forward, regenerate health, and process collisions with active enemies.
function updateDeltaSoldier(playfield, tower, soldier, delta, state) {
  if (!soldier || soldier.health <= 0) {
    return false;
  }

  const regen = Math.max(0, state.regenPercent || soldier.regenPercent || 0);
  if (regen > 0 && soldier.health < soldier.maxHealth) {
    const gain = soldier.maxHealth * regen * delta;
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

  const minDimension = Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) || 1;
  const speed = Math.max(90, minDimension * 0.22);

  let destination = null;
  if (target) {
    destination = playfield.getEnemyPosition(target);
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
  const desiredSpeed = distance > 1 ? speed : 0;
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
    const targetPosition = playfield.getEnemyPosition(target);
    if (targetPosition) {
      const metrics = playfield.getEnemyVisualMetrics(target);
      const enemyRadius = playfield.getEnemyHitRadius(target, metrics);
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
    const rate = Math.max(Number.isFinite(tower.rate) ? tower.rate : 1, 0.05);
    tower.cooldown = 1 / rate;
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
