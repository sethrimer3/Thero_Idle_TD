/**
 * SubstrateEffect
 *
 * Ambient background effect for Chapter 6.
 * Renders a "Substrate"-inspired crystalline crack pattern: slowly growing
 * angular, city-like geometric regions on a fully transparent canvas.
 * Inspired by the XScreenSaver "Substrate" by J. Tarbell (2004), but
 * optimised for beauty, subtlety, transparency, and real-time game use.
 *
 * Visual style
 * ------------
 * • Pale crystalline linework in whites, greys, and golds at ~20% opacity.
 * • Thin architectural boundaries with faint interior deposition texture.
 * • No background fill – canvas remains fully transparent.
 * • Elegant, sparse, and luminous – suitable behind menus or gameplay.
 *
 * Growth simulation
 * -----------------
 * • An occupancy grid (cgrid) records the angle of the growth front that
 *   claimed each pixel cell.  This allows collision detection and
 *   perpendicular branching.
 * • SEED_COUNT seed fronts start at random positions with quantised angles
 *   (multiples of π/2 ± small jitter) to favour city-block geometry.
 * • Each front advances pixel-by-pixel in its direction:
 *     – Straight mode: moves in a fixed direction, with a small per-step
 *       chance of making a sharp perpendicular turn.
 *     – Arc mode: gradually curves at a random rate, producing large
 *       circular-segment boundaries.
 *     – On collision with an occupied cell: the front stops and spawns
 *       1–2 new fronts perpendicular (±90°) to the structure it hit.
 *     – Fronts also expire after a configurable maximum age.
 * • New fronts are seeded whenever the active count drops below SEED_COUNT,
 *   keeping the pattern evolving continuously.
 * • After CYCLE_DURATION_MS the canvas clears and a fresh cycle begins.
 *
 * Collision and branching
 * -----------------------
 * • cgrid[y * W + x] stores the angle of the front that passed through
 *   pixel (x, y), or GRID_EMPTY if unoccupied.
 * • When a front reaches an occupied cell it stops.  With probability
 *   BRANCH_PROBABILITY a perpendicular child is spawned from the collision
 *   point.  A second branch may spawn at lower probability to create
 *   denser intersection nodes.
 * • The child is offset 2 px along its new direction to avoid immediate
 *   re-collision with the parent structure.
 *
 * Interior deposition texture
 * ---------------------------
 * • For every pixel a front advances, GRAIN_DENSITY faint 1×1 dots are
 *   scattered perpendicular to the front's direction within a band of
 *   ±DEPOSITION_WIDTH pixels.
 * • Alpha falls off quadratically from the crack line toward the band
 *   edges, producing a very subtle directional striation inside regions.
 * • Maximum per-grain alpha is INTERIOR_OPACITY (~0.025), so accumulation
 *   remains whisper-faint.
 *
 * Transparency and palette control
 * --------------------------------
 * • The palette is restricted to six values in the white / grey / gold
 *   family.  No saturated or pastel hues are used.
 * • Edge lines are drawn on the off-screen canvas at EDGE_OPACITY.
 * • Interior deposition grains are drawn at INTERIOR_OPACITY.
 * • The off-screen canvas is composited onto the main canvas each frame at
 *   COMPOSITE_ALPHA (~0.20), yielding ~20% apparent peak opacity.
 * • A per-cycle fade-in over FADE_IN_MS prevents abrupt appearance.
 *
 * All positions are in logical CSS pixel screen-space.
 */

// ─── Configurable parameters ──────────────────────────────────────────────────
// All important tuning values are grouped here for easy adjustment.

/** Number of seed growth fronts placed at each cycle start. */
const SEED_COUNT = 6;

/** Maximum simultaneously active growth front tips. */
const MAX_FRONTS = 60;

/** Base growth speed (CSS pixels per second). Individual fronts vary ±30%. */
const GROWTH_SPEED = 65;

/** Probability [0,1] that a stopped front spawns a perpendicular branch. */
const BRANCH_PROBABILITY = 0.60;

/** Per-pixel probability of a sharp perpendicular turn in straight mode. */
const PERPENDICULAR_TURN_PROBABILITY = 0.008;

/** Probability that a newly created front uses arc (curve) mode. */
const ARC_PROBABILITY = 0.15;

/** Maximum age (seconds) before a front expires. Actual age varies ×0.5–1.5. */
const MAX_AGE = 12;

/** Number of interior deposition striation dots per growth pixel. */
const GRAIN_DENSITY = 6;

/** Half-width (px) of the interior deposition scatter band. */
const DEPOSITION_WIDTH = 40;

/** Alpha of edge (crack line) pixels on the off-screen canvas. */
const EDGE_OPACITY = 0.70;

/** Maximum alpha of a single interior deposition grain. */
const INTERIOR_OPACITY = 0.025;

/** Width (px) of edge line pixels. Thin and delicate. */
const LINE_WIDTH = 0.8;

/** Overall compositing alpha applied when blitting to the main canvas. */
const COMPOSITE_ALPHA = 0.20;

/** Duration (ms) of one full growth cycle before the canvas resets. */
const CYCLE_DURATION_MS = 40000;

/** Duration (ms) of the gentle fade-in at each cycle's start. */
const FADE_IN_MS = 3000;

/** Arc curvature half-range (rad / pixel). Actual rate is random within ±. */
const ARC_RATE_RANGE = 0.012;

/** Grid sentinel: no growth front has claimed this cell yet. */
const GRID_EMPTY = -10001;

// ─── Color palette ────────────────────────────────────────────────────────────
// Restricted to pale, restrained white / grey / gold values.
// No saturated pastels, no bright metallic golds.

const PALETTE = [
  { r: 255, g: 255, b: 255 },  // Pure white
  { r: 248, g: 245, b: 238 },  // Warm white
  { r: 210, g: 210, b: 210 },  // Soft grey
  { r: 190, g: 195, b: 200 },  // Cool grey
  { r: 235, g: 225, b: 190 },  // Pale gold
  { r: 215, g: 205, b: 180 },  // Warm gold-grey
];

function _randomPaletteColor() {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

/**
 * Return an angle quantised to a multiple of π/2 with small jitter (±0.075 rad).
 * This produces the city-block / crystal-lattice perpendicular alignments that
 * give the pattern its architectural character.
 */
function _quantisedAngle() {
  const base = Math.floor(Math.random() * 4) * (Math.PI / 2);
  return base + (Math.random() - 0.5) * 0.15;
}

// ─── Growth front factory ─────────────────────────────────────────────────────

/**
 * Create a new growth front at the given position and angle.
 *
 * @param {number} x      Start x (CSS px).
 * @param {number} y      Start y (CSS px).
 * @param {number} angle  Direction (radians).
 * @param {string} mode   'straight' or 'arc'.
 * @returns {Object}      Growth front state object.
 */
function _createFront(x, y, angle, mode) {
  const col = _randomPaletteColor();
  return {
    x,
    y,
    angle,
    // Individual speed varies ±30% around the base for organic feel.
    speed: GROWTH_SPEED * (0.7 + Math.random() * 0.6),
    age:    0,
    maxAge: MAX_AGE * (0.5 + Math.random()),
    // Palette color for this front's edge and deposition.
    colorR: col.r,
    colorG: col.g,
    colorB: col.b,
    // 'straight': fixed heading with occasional perpendicular snaps.
    // 'arc': continuously curving heading for circular-segment boundaries.
    mode: mode || 'straight',
    // Arc curvature (rad / pixel step), random sign for CW/CCW arcs.
    arcRate: (Math.random() - 0.5) * 2 * ARC_RATE_RANGE,
    alive: true,
    // Last integer grid cell – avoids self-collision when sub-pixel
    // movement keeps the front inside the same cell.
    lastGx: Math.round(x),
    lastGy: Math.round(y),
  };
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create and return a Substrate effect controller.
 * @returns {{ update: Function, draw: Function, reset: Function }}
 */
export function createSubstrateEffect() {
  // Off-screen canvas accumulates the crystalline pattern over time.
  let offCanvas = null;
  let offCtx    = null;

  // Occupancy grid: cgrid[y * W + x] = front angle at that pixel, or GRID_EMPTY.
  let cgrid = null;

  // Logical viewport dimensions (CSS px).
  let W = 0;
  let H = 0;

  let fronts = [];

  let lastTs       = null;
  let cycleStartMs = null;

  // Per-cycle fade-in alpha multiplier (0 → 1).
  let compositeAlpha = 0;

  // ── Initialisation ────────────────────────────────────────────────────────

  function _init(w, h) {
    W = Math.ceil(w);
    H = Math.ceil(h);

    // Create (or recreate) the off-screen accumulation canvas.
    offCanvas        = document.createElement('canvas');
    offCanvas.width  = W;
    offCanvas.height = H;
    offCtx           = offCanvas.getContext('2d');
    offCtx.clearRect(0, 0, W, H);

    // Initialise the occupancy grid with the sentinel.
    cgrid = new Float32Array(W * H);
    cgrid.fill(GRID_EMPTY);

    fronts = [];

    for (let i = 0; i < SEED_COUNT; i++) {
      _spawnRandom();
    }
  }

  // ── Front spawning ────────────────────────────────────────────────────────

  /** Seed a new front at a random viewport position with quantised angle. */
  function _spawnRandom() {
    if (fronts.length >= MAX_FRONTS) return;
    const x     = 10 + Math.random() * (W - 20);
    const y     = 10 + Math.random() * (H - 20);
    const angle = _quantisedAngle();
    const mode  = Math.random() < ARC_PROBABILITY ? 'arc' : 'straight';
    fronts.push(_createFront(x, y, angle, mode));
  }

  /**
   * Spawn a perpendicular child from a collision point.
   * The child direction is ±90° relative to the hit structure's angle.
   */
  function _spawnPerp(xi, yi, hitAngle) {
    if (fronts.length >= MAX_FRONTS) return;
    const perp = hitAngle + (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    // Offset 2 px along the new direction to avoid immediate re-collision.
    const ox = xi + Math.cos(perp) * 2;
    const oy = yi + Math.sin(perp) * 2;
    if (ox < 0 || ox >= W || oy < 0 || oy >= H) return;
    const mode = Math.random() < ARC_PROBABILITY ? 'arc' : 'straight';
    fronts.push(_createFront(ox, oy, perp, mode));
  }

  // ── Growth front simulation ───────────────────────────────────────────────

  /**
   * Advance a single growth front by `steps` pixels.
   * Handles arc curvature, perpendicular turns, collision detection,
   * edge rendering, and interior deposition.
   */
  function _stepFront(front, steps, dt) {
    // Age the front; kill it if it exceeds its lifespan.
    front.age += dt;
    if (front.age >= front.maxAge) {
      front.alive = false;
      return;
    }

    let dx = Math.cos(front.angle);
    let dy = Math.sin(front.angle);

    for (let s = 0; s < steps; s++) {
      // Arc mode: gradually rotate the heading each pixel step, producing
      // large circular-segment boundaries.
      if (front.mode === 'arc') {
        front.angle += front.arcRate;
        dx = Math.cos(front.angle);
        dy = Math.sin(front.angle);
      }

      // Straight mode: rare perpendicular snap for city-block variety.
      if (front.mode === 'straight' &&
          Math.random() < PERPENDICULAR_TURN_PROBABILITY) {
        front.angle += Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        dx = Math.cos(front.angle);
        dy = Math.sin(front.angle);
      }

      front.x += dx;
      front.y += dy;

      const xi = Math.round(front.x);
      const yi = Math.round(front.y);

      // Out of viewport → kill.
      if (xi < 0 || xi >= W || yi < 0 || yi >= H) {
        front.alive = false;
        return;
      }

      // Skip if this integer cell hasn't changed since the last step.
      // Prevents self-collision when sub-pixel movement stays in one cell.
      if (xi === front.lastGx && yi === front.lastGy) continue;

      front.lastGx = xi;
      front.lastGy = yi;

      const idx = yi * W + xi;

      // Collision: hit an existing structure → stop and possibly branch.
      if (cgrid[idx] !== GRID_EMPTY) {
        front.alive = false;
        // Primary perpendicular branch.
        if (Math.random() < BRANCH_PROBABILITY) {
          _spawnPerp(xi, yi, cgrid[idx]);
        }
        // Occasional second branch for denser intersection nodes.
        if (Math.random() < BRANCH_PROBABILITY * 0.3) {
          _spawnPerp(xi, yi, cgrid[idx]);
        }
        return;
      }

      // Claim this cell in the occupancy grid.
      cgrid[idx] = front.angle;

      // Draw the thin edge pixel on the off-screen canvas.
      _drawEdgePixel(front.x, front.y,
        front.colorR, front.colorG, front.colorB);

      // Scatter faint interior deposition perpendicular to the front.
      _drawDeposition(front.x, front.y, front.angle,
        front.colorR, front.colorG, front.colorB);
    }
  }

  // ── Off-screen canvas drawing ─────────────────────────────────────────────

  /**
   * Draw a single thin edge pixel for a growth front line.
   * Uses the front's palette color at EDGE_OPACITY.
   */
  function _drawEdgePixel(x, y, r, g, b) {
    offCtx.fillStyle = `rgba(${r},${g},${b},${EDGE_OPACITY})`;
    offCtx.fillRect(x - LINE_WIDTH / 2, y - LINE_WIDTH / 2,
      LINE_WIDTH, LINE_WIDTH);
  }

  /**
   * Scatter faint interior deposition grains perpendicular to a front.
   * Creates the directional striation or "brushed grain" texture inside
   * the geometric regions bounded by crack lines.
   *
   * Each grain is a 1×1 px dot placed at a random offset along the
   * perpendicular axis.  Alpha falls off quadratically from the crack
   * line toward the band edges, so the interior texture remains
   * whisper-faint and restrained.
   */
  function _drawDeposition(cx, cy, angle, r, g, b) {
    // Perpendicular direction to the front's heading.
    const px = -Math.sin(angle);
    const py =  Math.cos(angle);

    for (let i = 0; i < GRAIN_DENSITY; i++) {
      // Random offset along the perpendicular axis.
      const t  = (Math.random() * 2 - 1) * DEPOSITION_WIDTH;
      const gx = cx + px * t;
      const gy = cy + py * t;

      // Skip out-of-bounds grains.
      if (gx < 0 || gx >= W || gy < 0 || gy >= H) continue;

      // Quadratic falloff: grain alpha decreases toward the band edges.
      const fade  = 1 - Math.abs(t) / DEPOSITION_WIDTH;
      const alpha = INTERIOR_OPACITY * fade * fade *
        (0.3 + Math.random() * 0.7);

      offCtx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(4)})`;
      offCtx.fillRect(gx, gy, 1, 1);
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────

  /**
   * Advance the simulation by one frame.
   * @param {number} now  High-resolution timestamp (ms), e.g. performance.now().
   * @param {number} w    Viewport width in CSS pixels.
   * @param {number} h    Viewport height in CSS pixels.
   */
  function update(now, w, h) {
    // Re-initialise if the viewport size changed or this is the first frame.
    const needsInit = !offCanvas || W !== Math.ceil(w) || H !== Math.ceil(h);
    if (needsInit) {
      _init(w, h);
      cycleStartMs   = now;
      compositeAlpha = 0;
      lastTs         = null;
    }

    if (cycleStartMs === null) cycleStartMs = now;

    const dt = lastTs === null ? 0.016 : Math.min((now - lastTs) / 1000, 0.1);
    lastTs   = now;

    // Gentle fade-in at the start of each cycle.
    const cycleAge  = now - cycleStartMs;
    compositeAlpha  = Math.min(1, cycleAge / FADE_IN_MS);

    // Reset once the cycle duration has elapsed – fresh crystal growth.
    if (cycleAge >= CYCLE_DURATION_MS) {
      offCtx.clearRect(0, 0, W, H);
      cgrid.fill(GRID_EMPTY);
      fronts       = [];
      cycleStartMs = now;
      compositeAlpha = 0;
      for (let i = 0; i < SEED_COUNT; i++) {
        _spawnRandom();
      }
      return;
    }

    // Advance each active front by the appropriate number of pixel steps.
    for (const front of fronts) {
      if (!front.alive) continue;
      const steps = Math.max(1, Math.round(front.speed * dt));
      _stepFront(front, steps, dt);
    }

    // Remove dead fronts.
    for (let i = fronts.length - 1; i >= 0; i--) {
      if (!fronts[i].alive) fronts.splice(i, 1);
    }

    // Re-seed if active count drops below the seed threshold.
    while (fronts.length < SEED_COUNT && fronts.length < MAX_FRONTS) {
      _spawnRandom();
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  /**
   * Composite the accumulated crystalline pattern onto the main canvas.
   * The overall effect opacity is COMPOSITE_ALPHA (~20%), modulated by the
   * per-cycle fade-in multiplier.
   *
   * @param {CanvasRenderingContext2D} ctx  Already in CSS-pixel space.
   */
  function draw(ctx) {
    if (!offCanvas || compositeAlpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = compositeAlpha * COMPOSITE_ALPHA;
    ctx.drawImage(offCanvas, 0, 0);
    ctx.restore();
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  /** Clear all state so the effect feels fresh on re-entry. */
  function reset() {
    offCanvas      = null;
    offCtx         = null;
    cgrid          = null;
    fronts         = [];
    W              = 0;
    H              = 0;
    lastTs         = null;
    cycleStartMs   = null;
    compositeAlpha = 0;
  }

  return { update, draw, reset };
}
