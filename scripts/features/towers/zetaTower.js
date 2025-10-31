// ζ tower helper module centralizes the pendulum math so the playfield stays lean.
import {
  buildTowerDynamicContext,
  withTowerDynamicContext,
  computeTowerVariableValue,
} from '../../../assets/towersTab.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

// Generate a color list for ζ pendulums by sampling the active palette gradient across their index range.
function computePendulumPalette(count) {
  const total = Math.max(1, count);
  const palette = [];
  for (let index = 0; index < total; index += 1) {
    const position = total > 1 ? index / (total - 1) : 0;
    palette.push(samplePaletteGradient(position));
  }
  if (palette.length) {
    return palette;
  }
  return [
    { r: 139, g: 247, b: 255 },
    { r: 255, g: 138, b: 216 },
  ];
}

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
      // Preserve manual link targets so dynamic math only counts explicit resource chains.
      connections: entry.linkTargetId ? [entry.linkTargetId] : [],
      // Surface upstream suppliers to keep linked-source counts accurate for overlays.
      sources: entry.linkSources instanceof Set ? Array.from(entry.linkSources) : [],
    });
  });

  if (!contextEntries.some((entry) => entry.id === tower.id)) {
    contextEntries.push({
      id: tower.id,
      type: tower.type,
      x: tower.x,
      y: tower.y,
      range: Number.isFinite(tower.range) ? tower.range : 0,
      // Mirror the tower's outgoing link so downstream counts remain consistent when evaluating ζ.
      connections: tower.linkTargetId ? [tower.linkTargetId] : [],
      // Include inbound suppliers when ζ recalculates its battlefield context snapshot.
      sources: tower.linkSources instanceof Set ? Array.from(tower.linkSources) : [],
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
  // Range upgrades extend the trail lifetime/length multiplier without stretching the arms.
  const rangeMultiplier = Math.max(1, rangeScalar / 1.5);
  state.trailDuration = 0.55 + 0.45 * rangeMultiplier;

  // Keep arm length anchored to arena size so pendulums feel consistent while range grows.
  const baseArmLength = Math.max(48, Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) * 0.16);
  // Precompute the default spawn position for each pendulum head.
  const baseHeadOffset = { x: tower.x, y: tower.y - baseArmLength };
  // Seed each pendulum with a distinct glow palette to emphasize individual trails.
  const pendulumPalette = computePendulumPalette(totalPendulums);
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
        length: baseArmLength,
        head: { ...baseHeadOffset },
        trail: [],
        trailWidth: Math.max(4, detectionRadius * 0.15),
        headRadius: Math.max(12, detectionRadius * 0.07),
        hitMap: new Map(),
        color: { ...pendulumPalette[index % pendulumPalette.length] }, // Store the trail/head color for rendering and effects.
      };
      pendulums[index] = pendulum;
    }

    const normalizedIndex = index / Math.max(1, totalPendulums - 1);
    const angularVelocity = speedValue * (0.6 + 0.4 * normalizedIndex);
    pendulum.angularVelocity = angularVelocity * Math.PI * 2;
    pendulum.length = baseArmLength * (1 + normalizedIndex * 0.08); // Small offsets keep the double pendulum silhouette dynamic.
    pendulum.headRadius = Math.max(12, detectionRadius * (0.06 + normalizedIndex * 0.02));
    pendulum.trailWidth = Math.max(4, detectionRadius * (0.12 + normalizedIndex * 0.05));
    if (!Array.isArray(pendulum.trail)) {
      pendulum.trail = [];
    }
    if (!(pendulum.hitMap instanceof Map)) {
      pendulum.hitMap = new Map();
    }
    if (!pendulum.color) {
      pendulum.color = pendulumPalette[index % pendulumPalette.length]; // Recover the palette if the state was cached without color.
    }
  }

  pendulums.forEach((pendulum, index) => {
    if (!pendulum) {
      return;
    }
    const normalizedIndex = index / Math.max(1, totalPendulums - 1);
    pendulum.angularVelocity = speedValue * (0.6 + 0.4 * normalizedIndex) * Math.PI * 2;
    pendulum.length = baseArmLength * (1 + normalizedIndex * 0.08); // Maintain variation without scaling with range upgrades.
    pendulum.headRadius = Math.max(12, detectionRadius * (0.06 + normalizedIndex * 0.02));
    pendulum.trailWidth = Math.max(4, detectionRadius * (0.12 + normalizedIndex * 0.05));
    pendulum.color = { ...pendulumPalette[index % pendulumPalette.length] }; // Refresh color when pendulum count changes.
  });
  state.maxTrailPoints = Math.round(36 * rangeMultiplier); // Longer trails mirror higher range investments.
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
      const entry = hitMap.get(enemy.id) || { headContact: false, trailContact: false }; // Track continuous contact per enemy.

      const distanceToHead = Math.hypot(position.x - pendulum.head.x, position.y - pendulum.head.y);
      const headContact = distanceToHead <= headRadius;
      if (headContact && !entry.headContact) { // Deal critical damage when the head first touches an enemy.
        applyZetaDamage(playfield, enemy, state.criticalDamage);
        entry.headContact = true;
      } else if (!headContact) {
        entry.headContact = false;
      }

      let nearTrail = false;
      for (let index = trail.length - 1, segments = 0; index > 0 && segments < maxTrailPoints; index -= 1, segments += 1) { // Sweep back through recent trail segments for contact checks.
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

      if (nearTrail && !entry.trailContact) { // Apply base damage when the trail is freshly re-entered.
        applyZetaDamage(playfield, enemy, state.baseDamage);
        entry.trailContact = true;
      } else if (!nearTrail) {
        entry.trailContact = false;
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
    const rgbColor = resolvePendulumRgb(pendulum.color); // Use the stored palette to sync head and trail glow.
    const visibleTrailStart = Math.max(1, trail.length - Math.max(12, Math.round((state.maxTrailPoints || 32) * 0.9))); // Render most of the stored trail while keeping batching tight.
    for (let i = visibleTrailStart; i < trail.length; i += 1) {
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
      ctx.strokeStyle = `rgba(${rgbColor}, ${alpha * 0.55})`;
      ctx.lineWidth = trailWidth;
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }

    const pivot = index === 0 ? { x: tower.x, y: tower.y } : pendulums[index - 1]?.head;
    if (pivot) {
      playfield.applyCanvasShadow(ctx, `rgba(${rgbColor}, 0.25)`, (pendulum.headRadius || 12) * 1.4); // Slim, glowing arms echo the head hue.
      ctx.strokeStyle = `rgba(${rgbColor}, 0.6)`;
      ctx.lineWidth = Math.max(0.8, (pendulum.headRadius || 12) * 0.2);
      ctx.beginPath();
      ctx.moveTo(pivot.x, pivot.y);
      ctx.lineTo(pendulum.head.x, pendulum.head.y);
      ctx.stroke();
    }

    const radius = pendulum.headRadius || 12;
    // Radial gradient softens the head edges to mimic a glowing particle.
    const gradient = ctx.createRadialGradient(pendulum.head.x, pendulum.head.y, radius * 0.1, pendulum.head.x, pendulum.head.y, radius);
    gradient.addColorStop(0, `rgba(${rgbColor}, 0.95)`);
    gradient.addColorStop(0.6, `rgba(${rgbColor}, 0.4)`);
    gradient.addColorStop(1, `rgba(${rgbColor}, 0)`);
    playfield.applyCanvasShadow(ctx, `rgba(${rgbColor}, 0.7)`, radius * 2.1); // Bloom matches gradient color to amplify the glow.
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(pendulum.head.x, pendulum.head.y, radius, 0, Math.PI * 2);
    ctx.fill();
    playfield.clearCanvasShadow(ctx);
  });

  ctx.restore();
}

/**
 * Translate a hex color string into an RGB triplet so we can build rgba strings.
 */
function hexToRgb(hexColor) {
  const hex = String(hexColor).replace('#', '').trim();
  const normalized = hex.length === 3
    ? hex.split('').map((char) => char + char).join('')
    : hex.padEnd(6, '0');
  const intVal = parseInt(normalized.slice(0, 6), 16);
  const r = (intVal >> 16) & 255;
  const g = (intVal >> 8) & 255;
  const b = intVal & 255;
  return `${r}, ${g}, ${b}`;
}

// Resolve stored pendulum color data into a formatted RGB string, supporting both objects and hex fallbacks.
function resolvePendulumRgb(color) {
  if (color && typeof color === 'object' && Number.isFinite(color.r) && Number.isFinite(color.g) && Number.isFinite(color.b)) {
    const r = Math.max(0, Math.min(255, Math.round(color.r)));
    const g = Math.max(0, Math.min(255, Math.round(color.g)));
    const b = Math.max(0, Math.min(255, Math.round(color.b)));
    return `${r}, ${g}, ${b}`;
  }
  if (typeof color === 'string') {
    return hexToRgb(color);
  }
  const fallback = samplePaletteGradient(0);
  return `${fallback.r}, ${fallback.g}, ${fallback.b}`;
}
