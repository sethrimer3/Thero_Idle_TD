// T₂ tower — plots a parametric curve around itself using composable trig functions.
// The player toggles sin, cos, and tan independently for the x and y axes.
// Position: (x, y) = R × (Σ x-funcs(t), Σ y-funcs(t)), advancing at a fixed sweep speed.
// Default state is (cos t, sin t) — a circle.  The glowing tracer head damages enemies on contact.

import { metersToPixels } from '../../../assets/gameUnits.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

// ─── Constants ────────────────────────────────────────────────────────────────
// Maximum amplitude radius in meters — keeps the curve within the play area.
const MAX_RADIUS_METERS = 8;
// Sweep speed in radians per second.
const SWEEP_SPEED_RADS = 1.0;
// Trail points expire after this many seconds.
const TRAIL_DURATION = 3.0;
// Hard cap on stored trail points — performance safeguard.
const MAX_TRAIL_POINTS = 80;
// Maximum trail segments checked per enemy per frame.
const MAX_TRAIL_CHECK_SEGMENTS = 50;
// Only append a new trail point when the head has moved this far (pixels²).
const MIN_SAMPLE_DIST_SQ = 4;
// Visual and collision half-width of the trail in pixels.
const TRAIL_WIDTH = 10;
// Glowing head radius in pixels.
const HEAD_RADIUS = 9;
// Base damage applied when an enemy freshly touches the trail or head.
const BASE_DAMAGE = 10;
// Clamp magnitude for tan(t) to prevent the tracer from flying off-screen.
const TAN_CLAMP = 1.5;

// ─── Module-level function config ─────────────────────────────────────────────
// Persists the player's toggle choices so newly placed towers start with the same
// configuration.  All T₂ towers on the field share this configuration — toggling
// a function updates every live T₂ instance simultaneously via initializeT2Toggles.
export const T2_FUNC_CONFIG = {
  sinX: false,
  cosX: true,
  tanX: false,
  sinY: true,
  cosY: false,
  tanY: false,
};

// ─── Color helpers ────────────────────────────────────────────────────────────

/** Resolve the tracer color from the active palette, falling back to warm violet. */
function resolveTracerColor() {
  const sampled = samplePaletteGradient(0.65);
  if (sampled && Number.isFinite(sampled.r)) {
    return sampled;
  }
  return { r: 200, g: 160, b: 255 };
}

/** Format an {r,g,b} object into a CSS rgb triplet string. */
function rgbString(color) {
  const r = Math.max(0, Math.min(255, Math.round(color.r)));
  const g = Math.max(0, Math.min(255, Math.round(color.g)));
  const b = Math.max(0, Math.min(255, Math.round(color.b)));
  return `${r}, ${g}, ${b}`;
}

/** Compute the squared Euclidean distance between two points. */
function distSquared(ax, ay, bx, by) {
  return (ax - bx) ** 2 + (ay - by) ** 2;
}

// ─── Parametric math ──────────────────────────────────────────────────────────

/**
 * Evaluate the active parametric functions and return a Cartesian offset.
 * x = R × (sinX·sin(t) + cosX·cos(t) + tanX·clamp(tan(t)))
 * y = R × (sinY·sin(t) + cosY·cos(t) + tanY·clamp(tan(t)))
 * If no functions are active on an axis the component is 0 (tracer stays centred).
 *
 * @param {number} t - Current time parameter (radians).
 * @param {number} radius - Amplitude radius in pixels.
 * @param {object} funcs - Boolean flags: sinX, cosX, tanX, sinY, cosY, tanY.
 * @returns {{x: number, y: number}} Offset from the tower centre.
 */
function evaluateParametric(t, radius, funcs) {
  const tanT = Math.max(-TAN_CLAMP, Math.min(TAN_CLAMP, Math.tan(t)));
  const sinT = Math.sin(t);
  const cosT = Math.cos(t);

  let dx = 0;
  if (funcs.sinX) dx += sinT;
  if (funcs.cosX) dx += cosT;
  if (funcs.tanX) dx += tanT;

  let dy = 0;
  if (funcs.sinY) dy += sinT;
  if (funcs.cosY) dy += cosT;
  if (funcs.tanY) dy += tanT;

  return { x: radius * dx, y: radius * dy };
}

// ─── State management ─────────────────────────────────────────────────────────

/**
 * Initialise or refresh T₂ tower state from the playfield dimensions.
 *
 * @param {object} playfield - The active playfield instance.
 * @param {object} tower - The T₂ tower object.
 * @returns {object|null} The current t2State, or null on invalid input.
 */
export function ensureT2State(playfield, tower) {
  if (!playfield || !tower || tower.type !== 't2') {
    return null;
  }

  const minDimension = Math.min(
    Number.isFinite(playfield.renderWidth) ? playfield.renderWidth : 0,
    Number.isFinite(playfield.renderHeight) ? playfield.renderHeight : 0,
  ) || 1;
  const maxRadiusPixels = Math.max(20, metersToPixels(MAX_RADIUS_METERS, minDimension));

  let state = tower.t2State;
  if (!state) {
    state = {
      t: 0,
      trail: [],
      hitMap: new Map(),
      color: resolveTracerColor(),
      // Copy module-level config so each tower starts with the player's chosen state.
      funcs: { ...T2_FUNC_CONFIG },
    };
    tower.t2State = state;
  }

  // Refresh dimension-dependent values every frame (handles resize).
  state.maxRadiusPixels = maxRadiusPixels;
  state.sweepSpeed = SWEEP_SPEED_RADS;
  state.trailDuration = TRAIL_DURATION;
  state.damage = BASE_DAMAGE;

  // Head position: evaluate parametric curve at current t.
  const offset = evaluateParametric(state.t, maxRadiusPixels, state.funcs);
  state.headX = tower.x + offset.x;
  state.headY = tower.y + offset.y;

  return state;
}

/**
 * Clean up T₂ tower state when the tower is removed or retyped.
 *
 * @param {object} _playfield - Unused; present for API symmetry.
 * @param {object} tower - The T₂ tower object.
 */
export function teardownT2Tower(_playfield, tower) {
  if (!tower || !tower.t2State) {
    return;
  }
  tower.t2State.trail.length = 0;
  tower.t2State.hitMap.clear();
  tower.t2State = null;
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Advance the T₂ parametric tracer, update the trail, and apply contact damage.
 *
 * @param {object} playfield - The active playfield instance.
 * @param {object} tower - The T₂ tower object.
 * @param {number} delta - Seconds elapsed since the last frame.
 */
export function updateT2Tower(playfield, tower, delta) {
  if (!playfield || !tower) {
    return;
  }
  const state = ensureT2State(playfield, tower);
  if (!state) {
    return;
  }

  const step = Math.max(0, Number.isFinite(delta) ? delta : 0);

  // ── Advance the time parameter ──
  state.t = (state.t + state.sweepSpeed * step) % (Math.PI * 2);

  // ── Compute new head position ──
  const offset = evaluateParametric(state.t, state.maxRadiusPixels, state.funcs);
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
 * Render the T₂ parametric trail and glowing tracer head.
 *
 * @param {object} playfield - The active playfield instance (must have .ctx).
 * @param {object} tower - The T₂ tower object.
 */
export function drawT2Graph(playfield, tower) {
  if (!playfield?.ctx || !tower?.t2State) {
    return;
  }
  const ctx = playfield.ctx;
  const state = tower.t2State;
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
