// ζ tower helper module centralizes the pendulum math so the playfield stays lean.
import {
  buildTowerDynamicContext,
  withTowerDynamicContext,
  computeTowerVariableValue,
} from '../../../assets/towersTab.js';

/**
 * Evaluate ζ’s upgrade-driven math by temporarily mirroring the Towers tab
 * dynamic-context logic. This keeps battlefield stats in sync with the
 * upgrade overlay without duplicating the underlying formulas.
 */
export function evaluateZetaMetrics(playfield, tower) {
  if (!playfield || !tower || tower.type !== 'zeta') {
    return null;
  }

  const contextEntries = [];
  playfield.towers.forEach((entry) => {
    if (!entry) {
      return;
    }
    contextEntries.push({
      id: entry.id,
      type: entry.type,
      x: entry.x,
      y: entry.y,
      range: Number.isFinite(entry.range) ? entry.range : 0,
    });
  });

  if (!contextEntries.some((entry) => entry.id === tower.id)) {
    contextEntries.push({
      id: tower.id,
      type: tower.type,
      x: tower.x,
      y: tower.y,
      range: Number.isFinite(tower.range) ? tower.range : 0,
    });
  }

  const context = buildTowerDynamicContext({
    contextTowerId: tower.id,
    contextTower: contextEntries.find((entry) => entry.id === tower.id) || null,
    contextTowers: contextEntries,
  });

  return withTowerDynamicContext(context, () => ({
    attack: computeTowerVariableValue('zeta', 'atk'),
    critical: computeTowerVariableValue('zeta', 'crt'),
    speed: computeTowerVariableValue('zeta', 'spd'),
    range: computeTowerVariableValue('zeta', 'rng'),
    total: computeTowerVariableValue('zeta', 'tot'),
  }));
}

/**
 * Clear cached ζ pendulum data when the tower is removed or retuned.
 */
export function teardownZetaTower(playfield, tower) {
  if (!playfield || !tower || !tower.zetaState) {
    return;
  }
  if (Array.isArray(tower.zetaState.pendulums)) {
    tower.zetaState.pendulums.forEach((pendulum) => {
      if (pendulum?.trail) {
        pendulum.trail.length = 0;
      }
    });
  }
  tower.zetaState = null;
}

/**
 * Ensure ζ towers maintain their double-pendulum state and derived stats.
 */
export function ensureZetaState(playfield, tower) {
  if (!playfield || !tower || tower.type !== 'zeta') {
    return null;
  }

  const metrics = evaluateZetaMetrics(playfield, tower);
  if (!metrics) {
    return null;
  }

  const minDimension = Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) || 1;
  const attackValue = Number.isFinite(metrics.attack) ? Math.max(0, metrics.attack) : 0;
  const criticalMultiplier = Math.max(1, Number.isFinite(metrics.critical) ? metrics.critical : 1);
  const baseDamage = criticalMultiplier > 0 ? attackValue / criticalMultiplier : attackValue;
  const speedValue = Math.max(0.05, Number.isFinite(metrics.speed) ? metrics.speed : 0.25);
  const rangeScalar = Math.max(1.5, Number.isFinite(metrics.range) ? metrics.range : 1.5);
  const totalPendulums = Math.max(1, Math.round(Number.isFinite(metrics.total) ? metrics.total : 1));
  const baseRangeFraction = Number.isFinite(tower.definition?.range) ? tower.definition.range : 0.3;
  const normalizedRangeFraction = baseRangeFraction * (rangeScalar / 1.5);
  const effectiveRangeFraction = Math.max(0.05, normalizedRangeFraction);
  const detectionRadius = effectiveRangeFraction * minDimension;

  tower.damage = baseDamage;
  tower.baseDamage = baseDamage;
  tower.rate = speedValue;
  tower.baseRate = speedValue;
  tower.range = detectionRadius;
  tower.baseRange = detectionRadius;

  let state = tower.zetaState;
  if (!state) {
    state = { pendulums: [], elapsed: 0 };
    tower.zetaState = state;
  }

  state.attack = attackValue;
  state.baseDamage = baseDamage;
  state.criticalMultiplier = criticalMultiplier;
  state.criticalDamage = baseDamage * criticalMultiplier;
  state.speed = speedValue;
  state.rangeFraction = effectiveRangeFraction;
  state.total = totalPendulums;
  state.directCooldown = 0.28;
  state.trailCooldown = 0.34;
  state.trailDuration = 0.75;

  const baseLength = Math.max(18, detectionRadius);
  const pendulums = state.pendulums;
  if (pendulums.length > totalPendulums) {
    pendulums.length = totalPendulums;
  }
  for (let index = 0; index < totalPendulums; index += 1) {
    let pendulum = pendulums[index];
    if (!pendulum) {
      pendulum = {
        angle: -Math.PI / 2,
        angularVelocity: 0,
        length: baseLength,
        head: { x: tower.x, y: tower.y - baseLength },
        trail: [],
        trailWidth: Math.max(4, detectionRadius * 0.15),
        headRadius: Math.max(12, detectionRadius * 0.07),
        hitMap: new Map(),
      };
      pendulums[index] = pendulum;
    }

    const normalizedIndex = index / Math.max(1, totalPendulums - 1);
    const angularVelocity = speedValue * (0.6 + 0.4 * normalizedIndex);
    pendulum.angularVelocity = angularVelocity * Math.PI * 2;
    pendulum.length = baseLength * (1 + normalizedIndex * 0.15);
    pendulum.headRadius = Math.max(12, detectionRadius * (0.06 + normalizedIndex * 0.02));
    pendulum.trailWidth = Math.max(4, detectionRadius * (0.12 + normalizedIndex * 0.05));
    if (!Array.isArray(pendulum.trail)) {
      pendulum.trail = [];
    }
    if (!(pendulum.hitMap instanceof Map)) {
      pendulum.hitMap = new Map();
    }
  }

  pendulums.forEach((pendulum, index) => {
    if (!pendulum) {
      return;
    }
    const normalizedIndex = index / Math.max(1, totalPendulums - 1);
    pendulum.angularVelocity = speedValue * (0.6 + 0.4 * normalizedIndex) * Math.PI * 2;
    pendulum.length = baseLength * (1 + normalizedIndex * 0.15);
    pendulum.headRadius = Math.max(12, detectionRadius * (0.06 + normalizedIndex * 0.02));
    pendulum.trailWidth = Math.max(4, detectionRadius * (0.12 + normalizedIndex * 0.05));
  });

  state.maxTrailPoints = 48;
  return state;
}

/**
 * Apply ζ damage and cleanly remove defeated enemies from the playfield.
 */
export function applyZetaDamage(playfield, enemy, damage) {
  if (!playfield || !enemy || !Number.isFinite(damage) || damage <= 0) {
    return;
  }
  enemy.hp -= damage;
  if (enemy.hp <= 0) {
    playfield.processEnemyDefeat(enemy);
  }
}

/**
 * Advance ζ pendulum physics, maintain trail history, and apply collision damage.
 */
export function updateZetaTower(playfield, tower, delta) {
  if (!playfield) {
    return;
  }
  const state = ensureZetaState(playfield, tower);
  if (!state) {
    return;
  }

  const step = Math.max(0, Number.isFinite(delta) ? delta : 0);
  state.elapsed = Number.isFinite(state.elapsed) ? state.elapsed + step : step;

  const pendulums = Array.isArray(state.pendulums) ? state.pendulums : [];
  let pivot = { x: tower.x, y: tower.y };
  const maxTrailPoints = Number.isFinite(state.maxTrailPoints) ? state.maxTrailPoints : 48;

  pendulums.forEach((pendulum) => {
    if (!pendulum) {
      return;
    }
    const angularVelocity = Number.isFinite(pendulum.angularVelocity) ? pendulum.angularVelocity : 0;
    const angle = Number.isFinite(pendulum.angle) ? pendulum.angle : -Math.PI / 2;
    pendulum.angle = angle + angularVelocity * step;
    const length = Math.max(14, Number.isFinite(pendulum.length) ? pendulum.length : 14);
    const headX = pivot.x + Math.cos(pendulum.angle) * length;
    const headY = pivot.y + Math.sin(pendulum.angle) * length;
    pendulum.length = length;
    pendulum.head = { x: headX, y: headY };

    const trail = Array.isArray(pendulum.trail) ? pendulum.trail : [];
    pendulum.trail = trail;
    trail.push({ x: headX, y: headY, age: 0 });
    for (let index = trail.length - 1; index >= 0; index -= 1) {
      const point = trail[index];
      if (!point) {
        trail.splice(index, 1);
        continue;
      }
      point.age = (Number.isFinite(point.age) ? point.age : 0) + step;
      const expired = point.age > (state.trailDuration || 0.75);
      const overflow = index < trail.length - maxTrailPoints;
      if (expired || overflow) {
        trail.splice(index, 1);
      }
    }

    pivot = pendulum.head;
  });

  if (!playfield.combatActive || !playfield.enemies.length || state.baseDamage <= 0) {
    return;
  }

  const enemyInfo = playfield.enemies.map((enemy) => ({ enemy, position: playfield.getEnemyPosition(enemy) }));
  const activeEnemyIds = new Set(enemyInfo.map(({ enemy }) => enemy.id));
  const directCooldown = Number.isFinite(state.directCooldown) ? state.directCooldown : 0.28;
  const trailCooldown = Number.isFinite(state.trailCooldown) ? state.trailCooldown : 0.34;

  pendulums.forEach((pendulum) => {
    if (!pendulum || !pendulum.head) {
      return;
    }
    const hitMap = pendulum.hitMap instanceof Map ? pendulum.hitMap : new Map();
    if (pendulum.hitMap !== hitMap) {
      pendulum.hitMap = hitMap;
    }

    hitMap.forEach((_, enemyId) => {
      if (!activeEnemyIds.has(enemyId)) {
        hitMap.delete(enemyId);
      }
    });

    const headRadius = Math.max(6, Number.isFinite(pendulum.headRadius) ? pendulum.headRadius : 10);
    const trail = Array.isArray(pendulum.trail) ? pendulum.trail : [];
    const trailWidth = Math.max(4, Number.isFinite(pendulum.trailWidth) ? pendulum.trailWidth : headRadius * 0.6);

    enemyInfo.forEach(({ enemy, position }) => {
      if (!enemy || enemy.hp <= 0 || !position) {
        return;
      }
      const entry = hitMap.get(enemy.id) || { nextDirect: 0, nextTrail: 0 };
      let directApplied = false;

      const distanceToHead = Math.hypot(position.x - pendulum.head.x, position.y - pendulum.head.y);
      if (distanceToHead <= headRadius && state.elapsed >= entry.nextDirect) {
        applyZetaDamage(playfield, enemy, state.criticalDamage);
        entry.nextDirect = state.elapsed + directCooldown;
        entry.nextTrail = Math.max(entry.nextTrail, state.elapsed + trailCooldown * 0.5);
        hitMap.set(enemy.id, entry);
        directApplied = true;
      }

      if (directApplied || state.elapsed < entry.nextTrail) {
        hitMap.set(enemy.id, entry);
        return;
      }

      let nearTrail = false;
      for (let index = trail.length - 1, segments = 0; index > 0 && segments < 32; index -= 1, segments += 1) {
        const point = trail[index];
        const previous = trail[index - 1];
        if (!point || !previous) {
          continue;
        }
        const distance = playfield.distancePointToSegment(position, previous, point);
        if (distance <= trailWidth) {
          nearTrail = true;
          break;
        }
      }

      if (nearTrail) {
        applyZetaDamage(playfield, enemy, state.baseDamage);
        entry.nextTrail = state.elapsed + trailCooldown;
      }
      hitMap.set(enemy.id, entry);
    });
  });
}

/**
 * Render ζ pendulum arms and trails so the battlefield reflects their orbit.
 */
export function drawZetaPendulums(playfield, tower) {
  if (!playfield?.ctx || !tower?.zetaState) {
    return;
  }
  const state = tower.zetaState;
  const pendulums = Array.isArray(state.pendulums) ? state.pendulums : [];
  if (!pendulums.length) {
    return;
  }

  const ctx = playfield.ctx;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  pendulums.forEach((pendulum, index) => {
    if (!pendulum?.head) {
      return;
    }

    const trail = Array.isArray(pendulum.trail) ? pendulum.trail : [];
    const trailWidth = Math.max(1.5, Number.isFinite(pendulum.trailWidth) ? pendulum.trailWidth : 6);
    for (let i = Math.max(1, trail.length - 32); i < trail.length; i += 1) {
      const point = trail[i];
      const previous = trail[i - 1];
      if (!point || !previous) {
        continue;
      }
      const age = Number.isFinite(point.age) ? point.age : 0;
      const fadeDuration = Number.isFinite(state.trailDuration) ? state.trailDuration : 0.75;
      const alpha = fadeDuration > 0 ? Math.max(0, 1 - age / fadeDuration) : 0.5;
      if (alpha <= 0) {
        continue;
      }
      ctx.beginPath();
      ctx.strokeStyle = `rgba(139, 247, 255, ${alpha * 0.5})`;
      ctx.lineWidth = trailWidth;
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }

    const pivot = index === 0 ? { x: tower.x, y: tower.y } : pendulums[index - 1]?.head;
    if (pivot) {
      playfield.applyCanvasShadow(ctx, 'rgba(139, 247, 255, 0.35)', (pendulum.headRadius || 12) * 1.6);
      ctx.strokeStyle = 'rgba(139, 247, 255, 0.75)';
      ctx.lineWidth = Math.max(1.2, (pendulum.headRadius || 12) * 0.45);
      ctx.beginPath();
      ctx.moveTo(pivot.x, pivot.y);
      ctx.lineTo(pendulum.head.x, pendulum.head.y);
      ctx.stroke();
    }

    playfield.applyCanvasShadow(ctx, 'rgba(255, 228, 120, 0.85)', (pendulum.headRadius || 12) * 2.1);
    ctx.fillStyle = 'rgba(255, 228, 120, 0.92)';
    ctx.beginPath();
    ctx.arc(pendulum.head.x, pendulum.head.y, pendulum.headRadius || 12, 0, Math.PI * 2);
    ctx.fill();
    playfield.clearCanvasShadow(ctx);
  });

  ctx.restore();
}
