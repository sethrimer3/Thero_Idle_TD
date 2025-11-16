/**
 * Chi (χ / Χ) Tower – Mind Gate Thrall Conductor
 *
 * Mechanics overview:
 * - When an enemy dies within χ's radius, it is converted into light motes that
 *   race toward the tower before being flung to the mind gate.
 * - The enemy is reborn as a Chi thrall at the end of the path and marches
 *   backwards toward the enemy gate, colliding with hostile glyphs along the way.
 * - Thralls trade their remaining vitality directly against enemies; the weaker
 *   side is annihilated while the stronger continues with leftover health.
 * - When a thrall reaches the enemy gate it dephases into light again and
 *   respawns at the mind gate to continue the patrol.
 */

import { calculateTowerEquationResult } from '../../../assets/towersTab.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

const CHI_FALLBACK_COLOR = { r: 255, g: 228, b: 184 };
const CHI_CONVERSION_TRAIL_DURATION = 0.65;
const CHI_GATE_TRAIL_DURATION = 0.8;
const MAX_CHI_TRAILS = 24;

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function ensureChiSystem(playfield) {
  if (!playfield.chiThralls) {
    playfield.chiThralls = [];
  }
  if (!playfield.chiLightTrails) {
    playfield.chiLightTrails = [];
  }
  if (!Number.isFinite(playfield.chiThrallIdCounter)) {
    playfield.chiThrallIdCounter = 0;
  }
}

function resolvePhiPower() {
  const phiValue = calculateTowerEquationResult('phi');
  if (Number.isFinite(phiValue) && phiValue > 0) {
    return phiValue;
  }
  return 1;
}

function resolveChiPower() {
  const chiValue = calculateTowerEquationResult('chi');
  if (Number.isFinite(chiValue) && chiValue > 0) {
    return chiValue;
  }
  const phiValue = resolvePhiPower();
  return Math.max(1, phiValue * phiValue);
}

function refreshChiParameters(playfield, tower, state) {
  const chiPower = resolveChiPower();
  const normalized = Math.log10(chiPower + 1);
  state.healthPercent = clamp(0.28 + normalized * 0.05, 0.25, 0.85);
  state.speedBonus = clamp(0.12 + normalized * 0.035, 0.12, 1.8);
  state.maxThralls = Math.max(1, Math.round(2 + normalized));
  state.displayDamage = chiPower;

  const displayRate = Number.isFinite(tower?.definition?.rate)
    ? tower.definition.rate
    : 0.4;
  const baseRange = Number.isFinite(tower?.range)
    ? tower.range
    : Number.isFinite(tower?.baseRange)
      ? tower.baseRange
      : 0;

  tower.baseDamage = state.displayDamage;
  tower.damage = state.displayDamage;
  tower.baseRate = displayRate;
  tower.rate = displayRate;
  if (baseRange > 0) {
    tower.baseRange = baseRange;
    tower.range = baseRange;
  }
}

export function ensureChiState(playfield, tower) {
  if (!playfield || !tower || tower.type !== 'chi') {
    return null;
  }
  ensureChiSystem(playfield);
  if (!tower.chiState) {
    tower.chiState = {
      auraTimer: 0,
      colorSeed: Math.random(),
      healthPercent: 0.4,
      speedBonus: 0.2,
      maxThralls: 3,
      displayDamage: 0,
    };
  }
  refreshChiParameters(playfield, tower, tower.chiState);
  return tower.chiState;
}

export function teardownChiTower(playfield, tower) {
  if (!playfield || !tower?.chiState) {
    return;
  }
  if (Array.isArray(playfield.chiThralls) && tower.id) {
    playfield.chiThralls = playfield.chiThralls.filter((thrall) => thrall.towerId !== tower.id);
  }
  delete tower.chiState;
}

export function updateChiTower(playfield, tower, delta) {
  if (!playfield || !tower || tower.type !== 'chi') {
    return;
  }
  const state = ensureChiState(playfield, tower);
  state.auraTimer = (state.auraTimer || 0) + delta;
  if (tower.cooldown > 0) {
    tower.cooldown = Math.max(0, tower.cooldown - delta);
  }
}

function resolveTowerRange(tower) {
  if (!tower) {
    return 0;
  }
  if (Number.isFinite(tower.range) && tower.range > 0) {
    return tower.range;
  }
  if (Number.isFinite(tower.baseRange) && tower.baseRange > 0) {
    return tower.baseRange;
  }
  if (Number.isFinite(tower.definition?.range)) {
    const fallback = tower.definition.range;
    return fallback > 0 ? fallback : 0;
  }
  return 0;
}

function resolveMindGatePosition(playfield) {
  if (!playfield || typeof playfield.getPointAlongPath !== 'function') {
    return null;
  }
  return playfield.getPointAlongPath(1);
}

function resolveEnemyGatePosition(playfield) {
  if (!playfield || typeof playfield.getPointAlongPath !== 'function') {
    return null;
  }
  return playfield.getPointAlongPath(0);
}

function pruneThrallsForTower(playfield, towerId, limit) {
  if (!playfield?.chiThralls || !towerId) {
    return;
  }
  const thralls = playfield.chiThralls.filter((thrall) => thrall.towerId === towerId);
  if (thralls.length < limit) {
    return;
  }
  const removalCount = thralls.length - limit + 1;
  const sorted = thralls
    .slice()
    .sort((a, b) => (a.spawnedAt || 0) - (b.spawnedAt || 0))
    .slice(0, removalCount)
    .map((thrall) => thrall.id);
  playfield.chiThralls = playfield.chiThralls.filter((thrall) => !sorted.includes(thrall.id));
}

function resolveThrallRadius(playfield) {
  const base = Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) || 0;
  const radius = base * 0.03;
  return clamp(radius, 12, 26);
}

function createTrailEntry(waypoints, color, duration) {
  const points = Array.isArray(waypoints) ? waypoints.filter(Boolean) : [];
  if (points.length < 2) {
    return null;
  }
  const segments = [];
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    segments.push(length);
    totalLength += length;
  }
  if (totalLength <= 0) {
    return null;
  }
  return {
    id: `chi-trail-${Date.now()}-${Math.random()}`,
    waypoints: points,
    segments,
    totalLength,
    elapsed: 0,
    duration: duration || CHI_CONVERSION_TRAIL_DURATION,
    color: color || CHI_FALLBACK_COLOR,
    progress: 0,
  };
}

function spawnChiTrail(playfield, waypoints, color, duration) {
  if (!playfield) {
    return;
  }
  ensureChiSystem(playfield);
  const entry = createTrailEntry(waypoints, color, duration);
  if (!entry) {
    return;
  }
  playfield.chiLightTrails.push(entry);
  if (playfield.chiLightTrails.length > MAX_CHI_TRAILS) {
    playfield.chiLightTrails.splice(0, playfield.chiLightTrails.length - MAX_CHI_TRAILS);
  }
}

function resolveThrallColor(seed) {
  const offset = (seed + Math.random() * 0.15) % 1;
  const accent = samplePaletteGradient(offset);
  const halo = samplePaletteGradient((offset + 0.2) % 1);
  return {
    core: accent || { ...CHI_FALLBACK_COLOR },
    halo: halo || { ...CHI_FALLBACK_COLOR },
  };
}

function createChiThrall(playfield, tower, state, enemy, position) {
  const hp = Math.max(1, (Number.isFinite(enemy?.maxHp) ? enemy.maxHp : enemy?.hp || 1) * state.healthPercent);
  const baseSpeed = Number.isFinite(enemy?.baseSpeed)
    ? Math.max(0.01, enemy.baseSpeed)
    : Number.isFinite(enemy?.speed)
      ? Math.max(0.01, enemy.speed)
      : 0.05;
  const thrallSpeed = Math.max(0.02, baseSpeed * (1 + state.speedBonus));
  const color = resolveThrallColor(state.colorSeed || Math.random());
  const thrall = {
    id: `chi-thrall-${(playfield.chiThrallIdCounter = (playfield.chiThrallIdCounter || 0) + 1)}`,
    towerId: tower.id,
    towerType: tower.type,
    hp,
    maxHp: hp,
    speed: thrallSpeed,
    progress: 1,
    color,
    auraPhase: Math.random(),
    spawnedAt: (typeof performance !== 'undefined' && typeof performance.now === 'function')
      ? performance.now()
      : Date.now(),
    label: enemy?.label || 'Chi Thrall',
  };
  pruneThrallsForTower(playfield, tower.id, state.maxThralls);
  playfield.chiThralls.push(thrall);

  const mindGate = resolveMindGatePosition(playfield);
  const waypoints = [];
  if (position) {
    waypoints.push({ ...position });
  }
  waypoints.push({ x: tower.x, y: tower.y });
  if (mindGate) {
    waypoints.push(mindGate);
  }
  spawnChiTrail(playfield, waypoints, color.halo, CHI_CONVERSION_TRAIL_DURATION);
}

export function tryConvertEnemyToChiThrall(playfield, enemy, { position = null } = {}) {
  if (!playfield || !enemy) {
    return false;
  }
  const towers = Array.isArray(playfield.towers)
    ? playfield.towers.filter((tower) => tower?.type === 'chi')
    : [];
  if (!towers.length) {
    return false;
  }
  const impactPosition = position || playfield.getEnemyPosition?.(enemy);
  if (!impactPosition) {
    return false;
  }
  let selected = null;
  let nearest = Infinity;
  towers.forEach((tower) => {
    const range = resolveTowerRange(tower);
    if (range <= 0) {
      return;
    }
    const distance = Math.hypot(impactPosition.x - tower.x, impactPosition.y - tower.y);
    if (distance > range) {
      return;
    }
    if (distance < nearest) {
      nearest = distance;
      selected = tower;
    }
  });
  if (!selected) {
    return false;
  }
  const state = ensureChiState(playfield, selected);
  createChiThrall(playfield, selected, state, enemy, impactPosition);
  return true;
}

function resolveThrallPosition(playfield, thrall) {
  if (!thrall) {
    return null;
  }
  if (thrall.position) {
    return thrall.position;
  }
  if (typeof playfield.getPointAlongPath !== 'function') {
    return null;
  }
  const position = playfield.getPointAlongPath(Math.max(0, Math.min(1, thrall.progress || 0)));
  thrall.position = position;
  return position;
}

function resolveTrailPosition(trail, progress) {
  if (!trail || !Array.isArray(trail.waypoints) || trail.waypoints.length < 2) {
    return null;
  }
  const clamped = Math.max(0, Math.min(1, progress));
  const targetDistance = trail.totalLength * clamped;
  let traversed = 0;
  for (let index = 0; index < trail.waypoints.length - 1; index += 1) {
    const segmentLength = trail.segments[index];
    if (traversed + segmentLength >= targetDistance) {
      const ratio = segmentLength > 0 ? (targetDistance - traversed) / segmentLength : 0;
      const start = trail.waypoints[index];
      const end = trail.waypoints[index + 1];
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    }
    traversed += segmentLength;
  }
  return trail.waypoints[trail.waypoints.length - 1];
}

function resolveSourceTower(playfield, towerId) {
  if (!playfield || !towerId || typeof playfield.getTowerById !== 'function') {
    return null;
  }
  return playfield.getTowerById(towerId);
}

function resolveEnemyEntry(playfield, enemy) {
  if (!enemy || typeof playfield.getEnemyPosition !== 'function') {
    return null;
  }
  const position = playfield.getEnemyPosition(enemy);
  if (!position) {
    return null;
  }
  const metrics = playfield.getEnemyVisualMetrics?.(enemy) || {};
  const radius = playfield.getEnemyHitRadius?.(enemy, metrics) || 18;
  return { enemy, position, radius };
}

function tradeThrallWithEnemy(playfield, thrall, enemy) {
  if (!thrall || !enemy) {
    return;
  }
  const thrallHp = Math.max(0, thrall.hp || 0);
  const enemyHp = Math.max(0, Number.isFinite(enemy.hp) ? enemy.hp : enemy.maxHp || 0);
  if (thrallHp <= 0 || enemyHp <= 0) {
    return;
  }
  const damageToEnemy = thrallHp;
  enemy.hp = enemyHp - damageToEnemy;
  const appliedDamage = Math.min(enemyHp, damageToEnemy);
  const tower = resolveSourceTower(playfield, thrall.towerId);
  if (tower && appliedDamage > 0) {
    playfield.recordDamageEvent?.({ tower, enemy, damage: appliedDamage });
  }
  if (enemy.hp <= 0) {
    playfield.processEnemyDefeat?.(enemy);
  }
  if (enemyHp >= thrallHp) {
    thrall.hp = 0;
  } else {
    thrall.hp = thrallHp - enemyHp;
  }
}

export function updateChiThralls(playfield, delta) {
  if (!playfield || !playfield.chiThralls?.length) {
    return;
  }
  if (!playfield.combatActive) {
    return;
  }
  const enemies = Array.isArray(playfield.enemies) ? playfield.enemies : [];
  const thrallRadius = resolveThrallRadius(playfield);
  const gateStart = resolveEnemyGatePosition(playfield);
  const gateEnd = resolveMindGatePosition(playfield);
  const enemyEntries = enemies
    .map((enemy) => resolveEnemyEntry(playfield, enemy))
    .filter(Boolean);

  for (let index = playfield.chiThralls.length - 1; index >= 0; index -= 1) {
    const thrall = playfield.chiThralls[index];
    thrall.position = null;
    thrall.progress = Math.max(0, Math.min(1.1, (thrall.progress ?? 1) - thrall.speed * delta));
    if (thrall.progress <= 0) {
      thrall.progress = 1;
      if (gateStart && gateEnd) {
        spawnChiTrail(playfield, [gateStart, gateEnd], thrall.color?.halo, CHI_GATE_TRAIL_DURATION);
      }
    }
    const position = resolveThrallPosition(playfield, thrall);
    if (!position) {
      continue;
    }
    for (let enemyIndex = enemyEntries.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
      const entry = enemyEntries[enemyIndex];
      if (!entry || !enemies.includes(entry.enemy)) {
        enemyEntries.splice(enemyIndex, 1);
        continue;
      }
      const dx = position.x - entry.position.x;
      const dy = position.y - entry.position.y;
      const combined = entry.radius + thrallRadius;
      if (dx * dx + dy * dy > combined * combined) {
        continue;
      }
      tradeThrallWithEnemy(playfield, thrall, entry.enemy);
      if (thrall.hp <= 0) {
        playfield.chiThralls.splice(index, 1);
        break;
      }
      if (!enemies.includes(entry.enemy)) {
        enemyEntries.splice(enemyIndex, 1);
      }
    }
  }
}

export function updateChiLightTrails(playfield, delta) {
  if (!playfield || !playfield.chiLightTrails?.length) {
    return;
  }
  for (let index = playfield.chiLightTrails.length - 1; index >= 0; index -= 1) {
    const trail = playfield.chiLightTrails[index];
    trail.elapsed = (trail.elapsed || 0) + delta;
    const duration = Math.max(0.05, trail.duration || CHI_CONVERSION_TRAIL_DURATION);
    trail.progress = Math.min(1, trail.elapsed / duration);
    if (trail.progress >= 1) {
      playfield.chiLightTrails.splice(index, 1);
    }
  }
}

export function drawChiLightTrails(playfield) {
  if (!playfield?.ctx || !playfield.chiLightTrails?.length) {
    return;
  }
  const ctx = playfield.ctx;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  playfield.chiLightTrails.forEach((trail) => {
    const position = resolveTrailPosition(trail, trail.progress || 0);
    if (!position) {
      return;
    }
    const alpha = Math.max(0, 1 - (trail.progress || 0));
    const color = trail.color || CHI_FALLBACK_COLOR;
    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${0.55 * alpha})`;
    ctx.beginPath();
    ctx.arc(position.x, position.y, 7, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

export function drawChiThralls(playfield) {
  if (!playfield?.ctx || !playfield.chiThralls?.length) {
    return;
  }
  const ctx = playfield.ctx;
  const radius = resolveThrallRadius(playfield);
  ctx.save();
  playfield.chiThralls.forEach((thrall) => {
    const position = resolveThrallPosition(playfield, thrall);
    if (!position) {
      return;
    }
    ctx.save();
    ctx.translate(position.x, position.y);
    const haloColor = thrall.color?.halo || CHI_FALLBACK_COLOR;
    ctx.fillStyle = `rgba(${haloColor.r}, ${haloColor.g}, ${haloColor.b}, 0.35)`;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.4, 0, Math.PI * 2);
    ctx.fill();

    const coreColor = thrall.color?.core || CHI_FALLBACK_COLOR;
    ctx.fillStyle = `rgba(${coreColor.r}, ${coreColor.g}, ${coreColor.b}, 0.9)`;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(12, 16, 24, 0.85)';
    ctx.font = `${Math.max(18, radius * 0.9)}px "Cormorant Garamond", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('χ', 0, 0);

    const hpRatio = thrall.maxHp > 0 ? Math.max(0, Math.min(1, thrall.hp / thrall.maxHp)) : 0;
    ctx.strokeStyle = `rgba(${coreColor.r}, ${coreColor.g}, ${coreColor.b}, 0.9)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpRatio);
    ctx.stroke();
    ctx.restore();
  });
  ctx.restore();
}
