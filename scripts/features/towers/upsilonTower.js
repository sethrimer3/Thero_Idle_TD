/**
 * Upsilon (υ) Tower – Infinite-range fleet of micro-triangles.
 *
 * Mechanics:
 * - Builds a hangar of tiny triangle ships that launch in every direction when enemies appear.
 * - Ships fly across the entire map (effectively infinite range) and fire miniature lasers at the selected priority target.
 * - Players can click any enemy to mark it as the global focus; the fleet will ignore other priorities until that foe dies or is unfocused.
 * - When no enemies remain, the fleet drifts back to the tower and folds into the lattice until the next launch.
 * - Ships turn slowly so their homing paths arc into graceful curves instead of snapping directly to targets.
 *
 * Formulas (documented via tower equations):
 * - Ship attack: `atk = baseAtk + 260 × ℵ₁`.
 * - Production speed: `spd = 0.4 + 0.08 × ℵ₂` ships/second.
 * - Fleet capacity: `tot = 4 + ℵ₃` ships.
 * - Ship speed: `v = 1.6 + 0.18 × ℵ₄` meters/second.
 */

import {
  calculateTowerEquationResult,
  computeTowerVariableValue,
  getTowerEquationBlueprint,
} from '../../../assets/towersTab.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';
import { metersToPixels } from '../../../assets/gameUnits.js';

// Keep the parameter refresh lightweight so UI displays stay in sync with glyph upgrades.
const PARAM_REFRESH_SECONDS = 0.5;
// Slow turning rate so ship paths sketch arcs instead of straight lines.
const MAX_TURN_RATE = Math.PI * 1.3;
// Keep ship collision checks compact for performance.
const SHIP_ATTACK_RADIUS = 34;
// Visual footprint of each triangle ship (pixels) – quarter scale for tighter swarms.
const SHIP_SIZE = 11 * 0.25;
// Laser lifetime so streaks linger briefly.
const LASER_LIFETIME = 0.16;
// Launch ring lifetime for the release flash.
const LAUNCH_RING_LIFETIME = 0.6;
// Despawn ships cleanly once they touch the tower core again.
const RECALL_RADIUS = 14;
// Dash distance and turn rate after firing to create dogfighting loops.
const DOGFIGHT_DASH_METERS = 1;
const DOGFIGHT_SPEED_MULTIPLIER = 1.55;
const DOGFIGHT_TURN_ANGLE = Math.PI * 0.6;
// Loop pacing when ships idle around a track-hold anchor.
const TRACK_HOLD_LOOP_SPEED = Math.PI * 0.55;

/**
 * Resolve minimum canvas dimension to convert meters into pixels safely.
 */
function resolvePlayfieldScale(playfield) {
  const candidates = [];
  if (Number.isFinite(playfield?.renderWidth) && playfield.renderWidth > 0) {
    candidates.push(playfield.renderWidth);
  }
  if (Number.isFinite(playfield?.renderHeight) && playfield.renderHeight > 0) {
    candidates.push(playfield.renderHeight);
  }
  return candidates.length ? Math.min(...candidates) : 720;
}

/**
 * Choose a palette color with a fallback so ships always render legibly.
 */
function resolveFleetColor(offset = 0) {
  const color = samplePaletteGradient((offset % 1 + 1) % 1);
  if (color && Number.isFinite(color.r) && Number.isFinite(color.g) && Number.isFinite(color.b)) {
    return {
      r: Math.max(0, Math.min(255, Math.round(color.r))),
      g: Math.max(0, Math.min(255, Math.round(color.g))),
      b: Math.max(0, Math.min(255, Math.round(color.b))),
    };
  }
  return { r: 180, g: 220, b: 255 };
}

/**
 * Initialize υ tower state container.
 */
function ensureUpsilonStateInternal(tower) {
  if (!tower.upsilonState) {
    tower.upsilonState = {
      ships: [],
      lasers: [],
      launchBursts: [],
      recalcTimer: 0,
      spawnCounter: 0,
      launchIndex: 0,
      colorOffset: 0,
      parameters: null,
      trackHoldPoint: null,
      trackHoldProgress: 0,
      trackHoldTangent: null,
      trackHoldManual: false,
      loopPhase: 0,
    };
  }
  return tower.upsilonState;
}

export function updateUpsilonAnchors(playfield, tower) {
  if (!tower || tower.type !== 'upsilon' || !tower.upsilonState) {
    return;
  }
  const state = tower.upsilonState;
  if (tower.behaviorMode === 'trackHold') {
    if (state.trackHoldManual && Number.isFinite(state.trackHoldProgress)) {
      const clamped = Math.max(0, Math.min(1, state.trackHoldProgress));
      const anchor = playfield.getPositionAlongPath(clamped);
      if (anchor) {
        state.trackHoldPoint = { x: anchor.x, y: anchor.y };
        state.trackHoldTangent = Number.isFinite(anchor.tangent) ? anchor.tangent : null;
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

export function assignUpsilonTrackHoldAnchor(playfield, tower, anchor) {
  if (!playfield || !tower || tower.type !== 'upsilon' || !anchor) {
    return false;
  }
  const state = ensureUpsilonStateInternal(tower);
  if (!state) {
    return false;
  }
  tower.behaviorMode = 'trackHold';
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
  const anchorPosition = playfield.getPositionAlongPath(clampedProgress);
  state.trackHoldPoint = { x: resolved.x, y: resolved.y };
  state.trackHoldTangent = Number.isFinite(anchorPosition?.tangent) ? anchorPosition.tangent : null;
  return true;
}

function resolveUpsilonTrackWaypoint(playfield, state) {
  if (!state.trackHoldPoint) {
    return null;
  }
  const minDimension = resolvePlayfieldScale(playfield);
  const loopRadius = Math.max(20, (minDimension || 720) * 0.05);
  const tangent = Number.isFinite(state.trackHoldTangent) ? state.trackHoldTangent : 0;
  const forwardX = Math.cos(tangent);
  const forwardY = Math.sin(tangent);
  const normalX = -forwardY;
  const normalY = forwardX;
  const phase = Number.isFinite(state.loopPhase) ? state.loopPhase : 0;
  const along = Math.cos(phase) * loopRadius * 1.25;
  const lateral = Math.sin(phase) * loopRadius * 0.65;
  return {
    x: state.trackHoldPoint.x + forwardX * along + normalX * lateral,
    y: state.trackHoldPoint.y + forwardY * along + normalY * lateral,
  };
}

/**
 * Refresh υ parameters from blueprint variables.
 */
function refreshUpsilonParameters(playfield, tower, state) {
  const blueprint = getTowerEquationBlueprint('upsilon');
  const attack = Math.max(0, computeTowerVariableValue('upsilon', 'attack', blueprint) || 0);
  const production = Math.max(0, computeTowerVariableValue('upsilon', 'production', blueprint) || 0);
  const fleet = Math.max(1, Math.floor(computeTowerVariableValue('upsilon', 'fleet', blueprint) || 1));
  const shipSpeedMeters = Math.max(0.2, (computeTowerVariableValue('upsilon', 'velocity', blueprint) || 0.2) * 2);
  const minDimension = resolvePlayfieldScale(playfield);
  const shipSpeedPixels = metersToPixels(shipSpeedMeters, minDimension);

  // Keep tower stats aligned with blueprint output for the HUD.
  const displayedDamage = Math.max(0, calculateTowerEquationResult('upsilon') || attack);
  tower.baseDamage = displayedDamage;
  tower.damage = displayedDamage;
  tower.baseRate = production;
  tower.rate = production;
  tower.baseRange = minDimension * 2.5; // Effectively infinite; renderer will clamp visuals.
  tower.range = minDimension * 2.5;

  state.parameters = {
    attack,
    production,
    fleet,
    shipSpeedPixels,
    fireInterval: Math.max(0.2, 1 / Math.max(0.6, production * 2)),
    turnRate: MAX_TURN_RATE,
  };
}

/**
 * Select the current priority enemy, ignoring range so υ always participates.
 */
function selectPriorityEnemy(playfield, tower) {
  if (!playfield?.enemies?.length) {
    return null;
  }

  const focused = typeof playfield.getFocusedEnemy === 'function' ? playfield.getFocusedEnemy() : null;
  if (focused) {
    const position = playfield.getEnemyPosition(focused);
    if (position) {
      return { enemy: focused, position };
    }
  }

  const priority = tower.targetPriority || 'first';
  let candidate = null;
  let bestStrength = priority === 'weakest' ? Infinity : -Infinity;
  let bestProgress = -Infinity;

  playfield.enemies.forEach((enemy) => {
    if (!enemy || enemy.hp <= 0) {
      return;
    }
    const position = playfield.getEnemyPosition(enemy);
    if (!position) {
      return;
    }
    if (priority === 'strongest') {
      const strength = Number.isFinite(enemy.hp) ? enemy.hp : enemy.maxHp || 0;
      if (strength > bestStrength || (strength === bestStrength && enemy.progress > bestProgress)) {
        candidate = { enemy, position };
        bestStrength = strength;
        bestProgress = enemy.progress;
      }
      return;
    }
    if (priority === 'weakest') {
      const strength = Number.isFinite(enemy.hp) ? enemy.hp : enemy.maxHp || 0;
      if (strength < bestStrength || (strength === bestStrength && enemy.progress > bestProgress)) {
        candidate = { enemy, position };
        bestStrength = strength;
        bestProgress = enemy.progress;
      }
      return;
    }
    if (enemy.progress > bestProgress) {
      candidate = { enemy, position };
      bestProgress = enemy.progress;
    }
  });

  return candidate;
}

/**
 * Spawn a new triangle ship with an outward launch impulse for the release flash.
 */
function spawnUpsilonShip(playfield, tower, state) {
  const params = state.parameters;
  if (!params) {
    return;
  }
  if (state.ships.length >= params.fleet) {
    return;
  }

  state.colorOffset = (state.colorOffset + 0.11) % 1;
  const color = resolveFleetColor(state.colorOffset);
  const launchAngle = (state.launchIndex / Math.max(1, params.fleet)) * Math.PI * 2;
  state.launchIndex += 1;

  const ship = {
    id: `υ-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    position: { x: tower.x, y: tower.y },
    angle: launchAngle,
    color,
    cooldown: 0,
    trail: [],
    returning: false,
    dashDistanceRemaining: 0,
    dashHeading: launchAngle,
    dashTurn: 1,
  };

  state.launchBursts.push({
    age: 0,
    angle: launchAngle,
    color,
    duration: LAUNCH_RING_LIFETIME,
  });

  state.ships.push(ship);
}

/**
 * Record a thin laser so the renderer can draw it with a brief fade.
 */
function recordLaser(state, start, end, color) {
  state.lasers.push({
    start: { ...start },
    end: { ...end },
    color,
    age: 0,
    duration: LASER_LIFETIME,
  });
}

/**
 * Update a single ship toward its target or back to the tower.
 */
function updateShip(playfield, tower, state, ship, targetInfo, delta) {
  const params = state.parameters;
  if (!params) {
    return;
  }

  const dashActive = Number.isFinite(ship.dashDistanceRemaining) && ship.dashDistanceRemaining > 0;
  const targetPosition = targetInfo?.position || { x: tower.x, y: tower.y };
  const dx = targetPosition.x - ship.position.x;
  const dy = targetPosition.y - ship.position.y;
  const desiredAngle = dashActive ? ship.dashHeading : Math.atan2(dy, dx);
  const turnStep = Math.min(1, params.turnRate * delta);
  ship.angle = ship.angle + Math.atan2(Math.sin(desiredAngle - ship.angle), Math.cos(desiredAngle - ship.angle)) * turnStep;

  const speed = dashActive ? params.shipSpeedPixels * DOGFIGHT_SPEED_MULTIPLIER : params.shipSpeedPixels;
  const prevX = ship.position.x;
  const prevY = ship.position.y;
  ship.position.x += Math.cos(ship.angle) * speed * delta;
  ship.position.y += Math.sin(ship.angle) * speed * delta;

  // Maintain a short trail to show curved motion.
  ship.trail.push({ x: ship.position.x, y: ship.position.y });
  if (ship.trail.length > 18) {
    ship.trail.shift();
  }

  ship.cooldown = Math.max(0, ship.cooldown - delta);

  const hasAnchorTarget = targetInfo && targetInfo.position && !targetInfo.enemy;
  if ((!targetInfo?.enemy || targetInfo.enemy.hp <= 0) && !hasAnchorTarget) {
    ship.returning = true;
    return;
  }

  const distance = Math.hypot(dx, dy);
  if (targetInfo?.enemy && distance <= SHIP_ATTACK_RADIUS && ship.cooldown <= 0) {
    const applied = playfield.applyDamageToEnemy(targetInfo.enemy, params.attack, { sourceTower: tower });
    if (applied > 0) {
      recordLaser(state, ship.position, targetPosition, ship.color);
      ship.dashDistanceRemaining = metersToPixels(DOGFIGHT_DASH_METERS, resolvePlayfieldScale(playfield));
      ship.dashHeading = ship.angle;
      ship.dashTurn = Math.random() < 0.5 ? -1 : 1;
    }
    ship.cooldown = params.fireInterval;
  }

  if (dashActive) {
    const traveled = Math.hypot(ship.position.x - prevX, ship.position.y - prevY);
    ship.dashDistanceRemaining = Math.max(0, ship.dashDistanceRemaining - traveled);
    if (ship.dashDistanceRemaining <= 0) {
      ship.angle += ship.dashTurn * DOGFIGHT_TURN_ANGLE;
      ship.dashHeading = ship.angle;
    }
  }
}

/**
 * Recall ships into the tower once combat ends.
 */
function recallShips(tower, state, delta) {
  const params = state.parameters;
  const ships = state.ships || [];
  for (let index = ships.length - 1; index >= 0; index -= 1) {
    const ship = ships[index];
    const dx = tower.x - ship.position.x;
    const dy = tower.y - ship.position.y;
    const distance = Math.hypot(dx, dy);
    ship.angle = ship.angle + Math.atan2(Math.sin(Math.atan2(dy, dx) - ship.angle), Math.cos(Math.atan2(dy, dx) - ship.angle))
      * Math.min(1, (params ? params.turnRate : MAX_TURN_RATE) * delta);
    ship.position.x += Math.cos(ship.angle) * (params ? params.shipSpeedPixels : 160) * delta;
    ship.position.y += Math.sin(ship.angle) * (params ? params.shipSpeedPixels : 160) * delta;
    if (distance <= RECALL_RADIUS) {
      ships.splice(index, 1);
    }
  }
}

/**
 * Clean up expired visuals.
 */
function pruneVisuals(state, delta) {
  state.lasers = state.lasers.filter((laser) => {
    laser.age += delta;
    return laser.age < laser.duration;
  });
  state.launchBursts = state.launchBursts.filter((burst) => {
    burst.age += delta;
    return burst.age < burst.duration;
  });
}

/**
 * Ensure υ tower state exists and parameters stay fresh.
 */
export function ensureUpsilonState(playfield, tower) {
  if (!playfield || !tower || tower.type !== 'upsilon') {
    return null;
  }
  const state = ensureUpsilonStateInternal(tower);
  if (!state.parameters) {
    refreshUpsilonParameters(playfield, tower, state);
  }
  return state;
}

/**
 * Clear υ caches when the tower is removed or retuned.
 */
export function teardownUpsilonTower(tower) {
  if (tower?.upsilonState) {
    tower.upsilonState = null;
  }
}

/**
 * Update υ fleet behavior: spawn ships, acquire targets, and recall when idle.
 */
export function updateUpsilonTower(playfield, tower, delta) {
  if (!playfield || !tower || tower.type !== 'upsilon' || !Number.isFinite(delta) || delta <= 0) {
    return;
  }

  const state = ensureUpsilonStateInternal(tower);
  state.recalcTimer -= delta;
  if (state.recalcTimer <= 0 || !state.parameters) {
    refreshUpsilonParameters(playfield, tower, state);
    state.recalcTimer = PARAM_REFRESH_SECONDS;
  }

  if (tower.behaviorMode === 'trackHold') {
    updateUpsilonAnchors(playfield, tower);
    state.loopPhase = Number.isFinite(state.loopPhase) ? state.loopPhase : 0;
    state.loopPhase += delta * TRACK_HOLD_LOOP_SPEED;
    const tau = Math.PI * 2;
    if (state.loopPhase > tau || state.loopPhase < -tau) {
      state.loopPhase %= tau;
    }
  }

  pruneVisuals(state, delta);

  const targetInfo = selectPriorityEnemy(playfield, tower);
  const hasEnemies = Array.isArray(playfield.enemies) && playfield.enemies.some((enemy) => enemy?.hp > 0);

  if (!hasEnemies) {
    if (state.trackHoldPoint) {
      const waypoint = resolveUpsilonTrackWaypoint(playfield, state);
      const ships = state.ships || [];
      ships.forEach((ship) => {
        updateShip(playfield, tower, state, ship, waypoint ? { position: waypoint } : null, delta);
      });
      state.spawnCounter = 0;
      state.launchIndex = 0;
      return;
    }
    recallShips(tower, state, delta);
    state.spawnCounter = 0;
    state.launchIndex = 0;
    return;
  }

  // Build ships over time while enemies exist.
  const production = Math.max(0, state.parameters?.production || 0);
  state.spawnCounter += production * delta;
  if (state.ships.length >= state.parameters.fleet) {
    state.spawnCounter = 0;
  }
  while (state.spawnCounter >= 1 && state.ships.length < state.parameters.fleet) {
    spawnUpsilonShip(playfield, tower, state);
    state.spawnCounter -= 1;
  }

  // Update each ship toward the target; mark return if target disappeared.
  const ships = state.ships || [];
  ships.forEach((ship) => {
    updateShip(playfield, tower, state, ship, targetInfo, delta);
  });
}

/**
 * Draw υ ships, laser streaks, and launch rings.
 */
export function drawUpsilonFleet(playfield, tower) {
  if (!playfield?.ctx || !tower?.upsilonState) {
    return;
  }
  const ctx = playfield.ctx;
  const state = tower.upsilonState;

  // Draw launch rings that flare in every direction when ships depart.
  state.launchBursts.forEach((burst) => {
    const progress = burst.age / burst.duration;
    const radius = Math.max(20, 48 * progress);
    ctx.save();
    ctx.strokeStyle = `rgba(${burst.color.r}, ${burst.color.g}, ${burst.color.b}, ${Math.max(0, 0.5 - progress)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  // Render lingering lasers.
  state.lasers.forEach((laser) => {
    const alpha = Math.max(0, 1 - laser.age / laser.duration);
    ctx.save();
    ctx.strokeStyle = `rgba(${laser.color.r}, ${laser.color.g}, ${laser.color.b}, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(laser.start.x, laser.start.y);
    ctx.lineTo(laser.end.x, laser.end.y);
    ctx.stroke();
    ctx.restore();
  });

  // Draw ships with subtle trails to emphasize curved paths.
  state.ships.forEach((ship) => {
    if (ship.trail?.length) {
      ctx.save();
      ctx.strokeStyle = `rgba(${ship.color.r}, ${ship.color.g}, ${ship.color.b}, 0.35)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ship.trail.forEach((point, index) => {
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
    ctx.translate(ship.position.x, ship.position.y);
    ctx.rotate(ship.angle);
    ctx.beginPath();
    ctx.moveTo(SHIP_SIZE, 0);
    ctx.lineTo(-SHIP_SIZE * 0.6, SHIP_SIZE * 0.55);
    ctx.lineTo(-SHIP_SIZE * 0.6, -SHIP_SIZE * 0.55);
    ctx.closePath();
    ctx.fillStyle = `rgba(${ship.color.r}, ${ship.color.g}, ${ship.color.b}, 0.9)`;
    ctx.strokeStyle = `rgba(${ship.color.r}, ${ship.color.g}, ${ship.color.b}, 0.65)`;
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
}
