// T₁ tower — plots a polar rose curve around itself.
// A glowing tracer head sweeps along r = maxRadius·|sin(3θ)| (a 3-petal rose),
// leaving a fading trail that deals ongoing damage to any enemy it touches.

import { metersToPixels } from '../../../assets/gameUnits.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

// ─── Constants ────────────────────────────────────────────────────────────────
// Maximum polar radius in meters — keeps the graph within the 10-meter bound.
const MAX_RADIUS_METERS = 8;
// Sweep speed in radians per second; the full 3-petal rose completes in ~π/speed seconds.
const SWEEP_SPEED_RADS = 0.9;
// Trail points expire after this many seconds so the canvas stays clean.
const TRAIL_DURATION = 3.0;
// Hard cap on stored trail points — performance safeguard against deep history.
const MAX_TRAIL_POINTS = 80;
// Maximum trail segments checked per enemy per frame — bounds O(n·m) collision work.
const MAX_TRAIL_CHECK_SEGMENTS = 50;
// Only append a new trail point when the head has moved this far (pixels²) since the last sample.
const MIN_SAMPLE_DIST_SQ = 4;
// Visual and collision half-width of the trail in pixels.
const TRAIL_WIDTH = 10;
// Glowing head radius in pixels.
const HEAD_RADIUS = 9;
// Base damage applied when an enemy freshly touches the trail or head.
const BASE_DAMAGE = 10;

// ─── Color helpers ────────────────────────────────────────────────────────────

/** Resolve the tracer color from the active palette, falling back to cyan. */
function resolveTracerColor() {
  const sampled = samplePaletteGradient(0.35);
  if (sampled && Number.isFinite(sampled.r)) {
    return sampled;
  }
  return { r: 138, g: 240, b: 255 };
}

/** Format an {r,g,b} object into a CSS rgb triplet string. */
function rgbString(color) {
  const r = Math.max(0, Math.min(255, Math.round(color.r)));
  const g = Math.max(0, Math.min(255, Math.round(color.g)));
  const b = Math.max(0, Math.min(255, Math.round(color.b)));
  return `${r}, ${g}, ${b}`;
}

/** Compute the squared Euclidean distance between two {x,y} points. */
function distSquared(ax, ay, bx, by) {
  return (ax - bx) ** 2 + (ay - by) ** 2;
}

// ─── Polar math ───────────────────────────────────────────────────────────────

/**
 * Evaluate the 3-petal polar rose and return a Cartesian offset from the tower.
 * r(θ) = maxRadius × |sin(3θ)|
 *
 * @param {number} theta - Current angle parameter (radians).
 * @param {number} maxRadius - Peak radius in pixels.
 * @returns {{x: number, y: number}} Offset from the tower centre.
 */
function polarToCartesian(theta, maxRadius) {
  const r = maxRadius * Math.abs(Math.sin(3 * theta));
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}

// ─── State management ─────────────────────────────────────────────────────────

/**
 * Initialise or refresh T₁ tower state from the playfield dimensions.
 *
 * @param {object} playfield - The active playfield instance.
 * @param {object} tower - The T₁ tower object.
 * @returns {object|null} The current t1State, or null on invalid input.
 */
export function ensureT1State(playfield, tower) {
  if (!playfield || !tower || tower.type !== 't1') {
    return null;
  }

  const minDimension = Math.min(
    Number.isFinite(playfield.renderWidth) ? playfield.renderWidth : 0,
    Number.isFinite(playfield.renderHeight) ? playfield.renderHeight : 0,
  ) || 1;
  const maxRadiusPixels = Math.max(20, metersToPixels(MAX_RADIUS_METERS, minDimension));

  let state = tower.t1State;
  if (!state) {
    state = {
      theta: 0,
      trail: [],
      hitMap: new Map(),
      color: resolveTracerColor(),
    };
    tower.t1State = state;
  }

  // Refresh dimension-dependent values every time (handles resize).
  state.maxRadiusPixels = maxRadiusPixels;
  state.sweepSpeed = SWEEP_SPEED_RADS;
  state.trailDuration = TRAIL_DURATION;
  state.damage = BASE_DAMAGE;

  // Head position: evaluate polar curve at current theta.
  const offset = polarToCartesian(state.theta, maxRadiusPixels);
  state.headX = tower.x + offset.x;
  state.headY = tower.y + offset.y;

  return state;
}

/**
 * Clean up T₁ tower state when the tower is removed or retyped.
 *
 * @param {object} playfield - Unused; present for API symmetry.
 * @param {object} tower - The T₁ tower object.
 */
export function teardownT1Tower(_playfield, tower) {
  if (!tower || !tower.t1State) {
    return;
  }
  tower.t1State.trail.length = 0;
  tower.t1State.hitMap.clear();
  tower.t1State = null;
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Advance the T₁ polar tracer, update the trail, and apply contact damage.
 *
 * @param {object} playfield - The active playfield instance.
 * @param {object} tower - The T₁ tower object.
 * @param {number} delta - Seconds elapsed since the last frame.
 */
export function updateT1Tower(playfield, tower, delta) {
  if (!playfield || !tower) {
    return;
  }
  const state = ensureT1State(playfield, tower);
  if (!state) {
    return;
  }

  const step = Math.max(0, Number.isFinite(delta) ? delta : 0);

  // ── Advance the tracer angle ──
  state.theta = (state.theta + state.sweepSpeed * step) % (Math.PI * 2);

  // ── Compute new head position ──
  const offset = polarToCartesian(state.theta, state.maxRadiusPixels);
  const newHeadX = tower.x + offset.x;
  const newHeadY = tower.y + offset.y;

  // ── Append trail point if the head has moved enough (performance guard) ──
  const trail = state.trail;
  const lastPoint = trail[trail.length - 1];
  const distSq = lastPoint ? distSquared(newHeadX, newHeadY, lastPoint.x, lastPoint.y) : Infinity;
  if (distSq >= MIN_SAMPLE_DIST_SQ) {
    trail.push({ x: newHeadX, y: newHeadY, age: 0 });
  }

  state.headX = newHeadX;
  state.headY = newHeadY;

  // ── Age and prune trail points ──
  for (let index = trail.length - 1; index >= 0; index -= 1) {
    const point = trail[index];
    if (!point) {
      trail.splice(index, 1);
      continue;
    }
    point.age = (Number.isFinite(point.age) ? point.age : 0) + step;
    const expired = point.age > state.trailDuration;
    const overflow = trail.length - index > MAX_TRAIL_POINTS;
    if (expired || overflow) {
      trail.splice(index, 1);
    }
  }

  // ── Skip damage pass when combat is inactive or no enemies present ──
  if (!playfield.combatActive || !Array.isArray(playfield.enemies) || playfield.enemies.length === 0) {
    return;
  }
  if (state.damage <= 0) {
    return;
  }

  // ── Build the set of currently active enemy IDs for stale-entry cleanup ──
  const activeIds = new Set();
  playfield.enemies.forEach((enemy) => {
    if (enemy) {
      activeIds.add(enemy.id);
    }
  });
  state.hitMap.forEach((_, id) => {
    if (!activeIds.has(id)) {
      state.hitMap.delete(id);
    }
  });

  const headR2 = HEAD_RADIUS * HEAD_RADIUS;
  const trailHalf = TRAIL_WIDTH * 0.5;

  playfield.enemies.forEach((enemy) => {
    if (!enemy || enemy.hp <= 0) {
      return;
    }
    const pos = playfield.getEnemyPosition(enemy);
    if (!pos) {
      return;
    }

    const entry = state.hitMap.get(enemy.id) || { headContact: false, trailContact: false };

    // ── Head contact ──
    const distHeadSq = distSquared(pos.x, pos.y, state.headX, state.headY);
    const headContact = distHeadSq <= headR2;
    if (headContact && !entry.headContact) {
      playfield.applyDamageToEnemy(enemy, state.damage, { sourceTower: tower });
      entry.headContact = true;
    } else if (!headContact) {
      entry.headContact = false;
    }

    // ── Trail contact (check last MAX_TRAIL_CHECK_SEGMENTS segments) ──
    let nearTrail = false;
    const startIndex = Math.max(1, trail.length - MAX_TRAIL_CHECK_SEGMENTS);
    for (let i = trail.length - 1; i >= startIndex; i -= 1) {
      const p = trail[i];
      const prev = trail[i - 1];
      if (!p || !prev) {
        continue;
      }
      // Use the playfield's point-to-segment helper for accurate collision.
      const dist = playfield.distancePointToSegment(pos, prev, p);
      if (dist <= trailHalf) {
        nearTrail = true;
        break;
      }
    }

    if (nearTrail && !entry.trailContact) {
      playfield.applyDamageToEnemy(enemy, state.damage, { sourceTower: tower });
      entry.trailContact = true;
    } else if (!nearTrail) {
      entry.trailContact = false;
    }

    state.hitMap.set(enemy.id, entry);
  });
}

// ─── Rendering ────────────────────────────────────────────────────────────────

/**
 * Render the T₁ polar rose trail and glowing tracer head.
 *
 * @param {object} playfield - The active playfield instance (must have .ctx).
 * @param {object} tower - The T₁ tower object.
 */
export function drawT1Graph(playfield, tower) {
  if (!playfield?.ctx || !tower?.t1State) {
    return;
  }
  const ctx = playfield.ctx;
  const state = tower.t1State;
  const trail = Array.isArray(state.trail) ? state.trail : [];
  if (trail.length < 2) {
    return;
  }

  const color = state.color || resolveTracerColor();
  const rgb = rgbString(color);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ── Draw fading trail segments ──
  const renderStart = Math.max(1, trail.length - MAX_TRAIL_POINTS);
  for (let i = renderStart; i < trail.length; i += 1) {
    const point = trail[i];
    const prev = trail[i - 1];
    if (!point || !prev) {
      continue;
    }
    const age = Number.isFinite(point.age) ? point.age : 0;
    const alpha = state.trailDuration > 0
      ? Math.max(0, 1 - age / state.trailDuration)
      : 0.5;
    if (alpha <= 0.01) {
      continue;
    }
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${rgb}, ${alpha * 0.6})`;
    ctx.lineWidth = TRAIL_WIDTH;
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  // ── Draw glowing tracer head ──
  const hx = state.headX;
  const hy = state.headY;
  if (Number.isFinite(hx) && Number.isFinite(hy)) {
    const grad = ctx.createRadialGradient(hx, hy, HEAD_RADIUS * 0.05, hx, hy, HEAD_RADIUS);
    grad.addColorStop(0, `rgba(${rgb}, 0.95)`);
    grad.addColorStop(0.55, `rgba(${rgb}, 0.45)`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);

    if (typeof playfield.applyCanvasShadow === 'function') {
      playfield.applyCanvasShadow(ctx, `rgba(${rgb}, 0.7)`, HEAD_RADIUS * 2.5);
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(hx, hy, HEAD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    if (typeof playfield.clearCanvasShadow === 'function') {
      playfield.clearCanvasShadow(ctx);
    }
  }

  ctx.restore();
}
