/**
 * VermiculateEffect
 *
 * Ambient background effect for Chapter 1.
 * Renders "worm-like" paths – straight and curved – that crawl across the
 * viewport leaving glowing, fading trails.  The effect is inspired by the
 * classic XScreenSaver "Vermiculate".
 *
 * Behaviour summary
 * -----------------
 * • Two worm types are spawned randomly:
 *     – STRAIGHT worms advance in a direction, occasionally snapping to 90°
 *       or 60° turns (producing square/triangle outlines).
 *     – CURVED worms follow circular arcs (constant radius, either CW or CCW).
 * • When a worm's head comes close to an existing trail it "bounces":
 *     – STRAIGHT: heading reflected 180° and snapped to nearest 45°.
 *     – CURVED: arc direction flipped (CW ↔ CCW); heading reversed 180°.
 * • Trail points are stored per distance-traveled (not per frame) so the
 *   trail always represents real on-screen length.
 * • Each worm has a finite trail length; older segments fade toward transparent.
 * • The head is rendered as a bright radial-gradient glowing ball.
 * • Worms despawn before getting completely boxed-in (stuck-detection).
 *
 * Colors: random shades of white, gold, and light-blue with canvas glow.
 * All positions are in logical CSS pixel screen-space.
 */

// ─── Tuning constants ─────────────────────────────────────────────────────────

// How many worms run simultaneously.
const MAX_WORMS = 20;
// Minimum active worms before a new one is spawned.
const MIN_WORMS = 8;

// Worm movement speed (CSS pixels per second).
const WORM_SPEED = 120;

// Distance (px) a worm must travel before a new trail point is recorded.
// Smaller = smoother curves, more memory. 4-6 is a good balance.
const POINT_INTERVAL = 5;

// Maximum number of stored trail points per worm.
// At POINT_INTERVAL = 5 and MAX_TRAIL_POINTS = 180, max trail = 900px.
const MAX_TRAIL_POINTS = 180;

// Minimum trail points before a bounce can trigger (avoids self-collision at spawn).
const MIN_TRAIL_FOR_BOUNCE = 14;

// Proximity threshold (px) for bounce detection against existing trails.
const BOUNCE_RADIUS = 12;

// Radius range for curved worms' circular arcs (CSS pixels).
const MIN_CURVE_RADIUS = 45;
const MAX_CURVE_RADIUS = 100;

// Base angular velocity for curved worms (radians per second).
const CURVE_ANG_VEL = 1.1;

// Probability [0,1] that a newly spawned worm is curved.
const CURVED_PROB = 0.45;

// How often a straight worm may attempt a random angular turn (ms).
const TURN_INTERVAL_MS = 500;

// Probability that a scheduled turn actually fires.
const TURN_PROB = 0.40;

// Candidate turn angles for straight worms (90° square + 60° triangle turns).
const TURN_ANGLES = [
  Math.PI / 2,   // 90° CW
  -Math.PI / 2,  // 90° CCW
  Math.PI / 3,   // 60° CW
  -Math.PI / 3,  // 60° CCW
];

// Stuck detection: despawn if within a tiny box for this many consecutive steps.
const STUCK_STEPS  = 80;
const STUCK_BOX_PX = 28;

// Spawn margin so worms start inside the viewport.
const SPAWN_MARGIN = 60;

// Head appearance.
const HEAD_GLOW_BLUR = 16;
const HEAD_RADIUS    = 5;

// Trail stroke width (px).
const TRAIL_WIDTH = 1.8;

// Maximum alpha for the newest trail segment.
const TRAIL_MAX_ALPHA = 0.80;

// Number of alpha bands to divide the trail into for the fade gradient.
// More bands = smoother fade but more draw calls.
const TRAIL_ALPHA_BANDS = 6;

// ─── Spatial grid ─────────────────────────────────────────────────────────────

// Grid cell size for proximity checks (px).
const GRID_CELL = 14;

// ─── Color palette (white / gold / light-blue) ────────────────────────────────

/**
 * Pick a random color from the white / gold / light-blue range.
 * Returns { r, g, b } in 0–255.
 */
function randomWormColor() {
  const roll = Math.random();
  if (roll < 0.33) {
    // White / near-white
    const v = 215 + Math.floor(Math.random() * 40);
    return { r: v, g: v, b: v };
  } else if (roll < 0.66) {
    // Gold / warm yellow
    const g = 185 + Math.floor(Math.random() * 55);
    return { r: 255, g, b: 20 + Math.floor(Math.random() * 50) };
  } else {
    // Light blue / cyan
    const b = 205 + Math.floor(Math.random() * 50);
    const g = 185 + Math.floor(Math.random() * 50);
    return { r: 70 + Math.floor(Math.random() * 70), g, b };
  }
}

// ─── Worm factory ─────────────────────────────────────────────────────────────

/**
 * Pre-compute the TRAIL_ALPHA_BANDS stroke style strings for a given color so
 * _drawWorm never allocates strings inside the render loop.
 */
function buildBandStyles(r, g, b) {
  const styles = [];
  for (let band = 0; band < TRAIL_ALPHA_BANDS; band++) {
    const frac  = (band + 1) / TRAIL_ALPHA_BANDS;
    const alpha = (frac * TRAIL_MAX_ALPHA).toFixed(3);
    styles.push(`rgba(${r},${g},${b},${alpha})`);
  }
  return styles;
}

function createWorm(width, height) {
  const isCurved = Math.random() < CURVED_PROB;
  const angle    = Math.random() * Math.PI * 2;
  const color    = randomWormColor();

  const x = SPAWN_MARGIN + Math.random() * (width  - SPAWN_MARGIN * 2);
  const y = SPAWN_MARGIN + Math.random() * (height - SPAWN_MARGIN * 2);

  return {
    x, y,
    angle,
    type:        isCurved ? 'curved' : 'straight',
    color,
    // Pre-computed stroke styles for each alpha band (avoids per-frame string allocs).
    bandStyles:  buildBandStyles(color.r, color.g, color.b),
    shadowColor: `rgba(${color.r},${color.g},${color.b},0.55)`,
    headGlow:    `rgba(${color.r},${color.g},${color.b},0.95)`,
    trail:       [{ x, y }],
    alive:       true,
    // Distance accumulator – new point added every POINT_INTERVAL px.
    distAcc:     0,

    // Curved worm fields.
    curveDir:    Math.random() < 0.5 ? 1 : -1,  // +1 CCW, -1 CW
    curveRadius: MIN_CURVE_RADIUS + Math.random() * (MAX_CURVE_RADIUS - MIN_CURVE_RADIUS),

    // Straight worm fields.
    nextTurnMs:  0,

    // Stuck detection.
    stuckSteps:  0,
    bbMinX: x, bbMaxX: x,
    bbMinY: y, bbMaxY: y,
  };
}

// ─── Spatial occupancy grid ────────────────────────────────────────────────────

/**
 * Build a Set of grid-cell keys from all worm trails (excluding their own tips).
 */
function buildGrid(worms) {
  const grid = new Set();
  for (const w of worms) {
    if (!w.alive) continue;
    const safeEnd = w.trail.length - MIN_TRAIL_FOR_BOUNCE;
    for (let i = 0; i < safeEnd; i++) {
      const col = Math.floor(w.trail[i].x / GRID_CELL);
      const row = Math.floor(w.trail[i].y / GRID_CELL);
      grid.add(`${col},${row}`);
    }
  }
  return grid;
}

/**
 * Return true if position (px, py) is within BOUNCE_RADIUS of any occupied cell.
 */
function nearOccupied(grid, px, py) {
  const r   = Math.ceil(BOUNCE_RADIUS / GRID_CELL);
  const col = Math.floor(px / GRID_CELL);
  const row = Math.floor(py / GRID_CELL);
  for (let dc = -r; dc <= r; dc++) {
    for (let dr = -r; dr <= r; dr++) {
      if (grid.has(`${col + dc},${row + dr}`)) return true;
    }
  }
  return false;
}

// ─── Angle helpers ─────────────────────────────────────────────────────────────

function snap45(a) {
  const s = Math.PI / 4;
  return Math.round(a / s) * s;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create and return a Vermiculate effect controller.
 * @returns {{ update: Function, draw: Function, reset: Function }}
 */
export function createVermiculateEffect() {
  let worms     = [];
  let lastTs    = null;
  let nowMs     = 0;

  // ── Init ──────────────────────────────────────────────────────────────────

  function init(w, h) {
    worms  = [];
    for (let i = 0; i < MIN_WORMS; i++) worms.push(createWorm(w, h));
    lastTs = null;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  function update(now, w, h) {
    if (!worms.length) init(w, h);
    nowMs = now;
    const dt = lastTs === null ? 0.016 : Math.min((now - lastTs) / 1000, 0.1);
    lastTs = now;

    const grid = buildGrid(worms);

    for (const worm of worms) {
      if (worm.alive) _step(worm, dt, grid, w, h);
    }

    // Remove dead worms.
    for (let i = worms.length - 1; i >= 0; i--) {
      if (!worms[i].alive) worms.splice(i, 1);
    }

    // Maintain population.
    while (worms.length < MIN_WORMS ||
           (worms.length < MAX_WORMS && Math.random() < 0.025)) {
      worms.push(createWorm(w, h));
    }
  }

  function _step(worm, dt, grid, W, H) {
    // ── Rotate heading ──────────────────────────────────────────────────────
    if (worm.type === 'curved') {
      worm.angle += CURVE_ANG_VEL * worm.curveDir * dt;
    } else {
      if (nowMs >= worm.nextTurnMs) {
        worm.nextTurnMs = nowMs + TURN_INTERVAL_MS + Math.random() * 400;
        if (Math.random() < TURN_PROB) {
          worm.angle += TURN_ANGLES[Math.floor(Math.random() * TURN_ANGLES.length)];
        }
      }
    }

    // ── Candidate position ──────────────────────────────────────────────────
    const dist = WORM_SPEED * dt;
    const nx   = worm.x + Math.cos(worm.angle) * dist;
    const ny   = worm.y + Math.sin(worm.angle) * dist;

    // ── Bounce off existing trails ──────────────────────────────────────────
    if (nearOccupied(grid, nx, ny)) {
      if (worm.type === 'curved') {
        worm.curveDir = -worm.curveDir;
        worm.angle   += Math.PI;
      } else {
        worm.angle = snap45(worm.angle + Math.PI);
      }
      // Don't advance; next frame will move in reflected direction.
    } else {
      worm.x = nx;
      worm.y = ny;
    }

    // ── Bounce off viewport edges ───────────────────────────────────────────
    const m = 4;
    if (worm.x < m)     { worm.x = m;     worm.angle = Math.PI - worm.angle; }
    else if (worm.x > W - m) { worm.x = W - m; worm.angle = Math.PI - worm.angle; }
    if (worm.y < m)     { worm.y = m;     worm.angle = -worm.angle; }
    else if (worm.y > H - m) { worm.y = H - m; worm.angle = -worm.angle; }

    // ── Record trail point every POINT_INTERVAL px ─────────────────────────
    const dx = worm.x - (worm.trail[worm.trail.length - 1]?.x ?? worm.x);
    const dy = worm.y - (worm.trail[worm.trail.length - 1]?.y ?? worm.y);
    worm.distAcc += Math.hypot(dx, dy);

    if (worm.distAcc >= POINT_INTERVAL) {
      worm.distAcc = 0;
      worm.trail.push({ x: worm.x, y: worm.y });
      if (worm.trail.length > MAX_TRAIL_POINTS) worm.trail.shift();
    }

    // ── Stuck detection ─────────────────────────────────────────────────────
    worm.stuckSteps++;
    if (worm.x < worm.bbMinX) worm.bbMinX = worm.x;
    if (worm.x > worm.bbMaxX) worm.bbMaxX = worm.x;
    if (worm.y < worm.bbMinY) worm.bbMinY = worm.y;
    if (worm.y > worm.bbMaxY) worm.bbMaxY = worm.y;

    if (worm.stuckSteps >= STUCK_STEPS) {
      const bw = worm.bbMaxX - worm.bbMinX;
      const bh = worm.bbMaxY - worm.bbMinY;
      if (bw < STUCK_BOX_PX && bh < STUCK_BOX_PX) {
        worm.alive = false;
        return;
      }
      // Reset bounding-box window.
      worm.stuckSteps = 0;
      worm.bbMinX = worm.x; worm.bbMaxX = worm.x;
      worm.bbMinY = worm.y; worm.bbMaxY = worm.y;
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  /**
   * Render all worms.
   * @param {CanvasRenderingContext2D} ctx  Already in CSS-pixel space.
   */
  function draw(ctx) {
    if (!worms.length) return;

    ctx.save();
    ctx.lineWidth = TRAIL_WIDTH;
    ctx.lineCap   = 'round';
    ctx.lineJoin  = 'round';

    for (const worm of worms) {
      if (worm.alive && worm.trail.length >= 2) _drawWorm(ctx, worm);
    }

    ctx.restore();
  }

  function _drawWorm(ctx, worm) {
    const trail      = worm.trail;
    const len        = trail.length;
    if (len < 2) return;

    // ── Trail rendered in TRAIL_ALPHA_BANDS segments ──────────────────────
    // Divide trail into bands; each band gets a uniform alpha that increases
    // from tail (low) to head (high).  Pre-computed band styles avoid per-frame
    // string allocations.
    ctx.save();
    ctx.shadowBlur  = 5;
    ctx.shadowColor = worm.shadowColor;

    const bandSize = Math.ceil(len / TRAIL_ALPHA_BANDS);

    for (let band = 0; band < TRAIL_ALPHA_BANDS; band++) {
      const startIdx = band * bandSize;
      const endIdx   = Math.min(startIdx + bandSize, len - 1);
      if (startIdx >= endIdx) continue;

      ctx.strokeStyle = worm.bandStyles[band];
      ctx.beginPath();
      ctx.moveTo(trail[startIdx].x, trail[startIdx].y);
      for (let i = startIdx + 1; i <= endIdx; i++) {
        ctx.lineTo(trail[i].x, trail[i].y);
      }
      ctx.stroke();
    }

    ctx.restore();

    // ── Glowing head ball ────────────────────────────────────────────────
    const hx = trail[len - 1].x;
    const hy = trail[len - 1].y;

    ctx.save();

    // Outer glow halo: radial gradient centered on head position.
    ctx.shadowBlur  = HEAD_GLOW_BLUR;
    ctx.shadowColor = worm.headGlow;

    const { r, g, b } = worm.color;
    const grad = ctx.createRadialGradient(hx, hy, 0, hx, hy, HEAD_RADIUS * 3);
    grad.addColorStop(0,    'rgba(255,255,255,0.98)');
    grad.addColorStop(0.25, `rgba(${r},${g},${b},0.90)`);
    grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(hx, hy, HEAD_RADIUS * 3, 0, Math.PI * 2);
    ctx.fill();

    // Bright core pinpoint.
    ctx.shadowBlur  = HEAD_GLOW_BLUR * 1.2;
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.fillStyle   = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(hx, hy, HEAD_RADIUS * 0.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function reset() {
    worms  = [];
    lastTs = null;
    nowMs  = 0;
  }

  return { update, draw, reset };
}
