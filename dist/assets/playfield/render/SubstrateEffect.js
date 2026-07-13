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
const MAX_AGE = 120;

/** Number of interior deposition striation dots per growth pixel. */
const GRAIN_DENSITY = 6;

/** Half-width (px) of the interior deposition scatter band. */
const DEPOSITION_WIDTH = 40;

/** Alpha of edge (crack line) pixels on the off-screen canvas. */
const EDGE_OPACITY = 0.70;

/** Maximum alpha of a single interior deposition grain. */
const INTERIOR_OPACITY = 0.025;

/** Width (px) of edge line pixels. Chalk-like – slightly thicker for texture. */
const LINE_WIDTH = 1.2;

/** Overall compositing alpha applied when blitting to the main canvas. */
const COMPOSITE_ALPHA = 0.20;

/** Duration (ms) of one full growth cycle before the canvas resets. */
const _CYCLE_DURATION_MS = 40000;

/** Duration (ms) of the gentle fade-in at each cycle's start. */
const FADE_IN_MS = 3000;

/** Arc curvature half-range (rad / pixel). Actual rate is random within ±. */
const ARC_RATE_RANGE = 0.012;

/** Grid sentinel: no growth front has claimed this cell yet. */
const GRID_EMPTY = -10001;

// ─── Undraw (tail-erase) parameters ──────────────────────────────────────────

/** Maximum simultaneously visible trail pixels before the tail starts erasing. */
const TRAIL_MAX_VISIBLE = 80000;

/** Radius (px) of the destination-out eraser brush at each trail point. */
const ERASE_RADIUS = 2.5;

/** Speed multiplier for undraw relative to the front's growth speed. */
const UNDRAW_SPEED_FACTOR = 1.2;

/**
 * Minimum trail pixels a stopped front must have drawn before it is allowed
 * to spawn perpendicular branches.  Fronts that stop with fewer pixels than
 * this are "boxed in" and are prevented from spawning branches, avoiding
 * cascading micro-branches that subdivide a dense region indefinitely.
 */
const MINIMUM_TRAIL_FOR_BRANCH = 5;

/**
 * Maximum number of completed (stopped) lines that may persist visibly on the
 * canvas at one time.  Once this ceiling is exceeded, the oldest stopped lines
 * begin their tail-to-tip "undraw" erase animation.  Mirrors the old per-cycle
 * maximum that previously caused all lines to vanish simultaneously.
 */
const MAX_LINES_BEFORE_UNDRAW = 120;

// ─── Collision glow parameters ────────────────────────────────────────────────

/** Total duration (ms) of the golden collision-glow effect. */
const COLLISION_GLOW_DURATION_MS = 3000;

/** Duration (ms) for the glow to ramp from zero to peak intensity (attack phase). */
const COLLISION_GLOW_PEAK_MS = 400;

/** Number of trail points back from the collision that the glow gradient covers. */
const COLLISION_GLOW_TRAIL_LENGTH = 180;

/** Peak alpha of the golden glow stroke at the exact collision point. */
const COLLISION_GLOW_MAX_ALPHA = 0.30;

/** Stroke width (px) of the golden glow drawn over the trail. */
const COLLISION_GLOW_LINE_WIDTH = 4.5;

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
    // Pre-built fill-style strings so they are not reconstructed every
    // pixel step.  edgeFillStyle is used for the crack-line pixel;
    // baseColorStyle is the opaque RGB string used with globalAlpha
    // for the interior deposition grains.
    edgeFillStyle:   `rgba(${col.r},${col.g},${col.b},${EDGE_OPACITY})`,
    baseColorStyle:  `rgb(${col.r},${col.g},${col.b})`,
    // 'straight': fixed heading with occasional perpendicular snaps.
    // 'arc': continuously curving heading for circular-segment boundaries.
    mode: mode || 'straight',
    // Arc curvature (rad / pixel step), random sign for CW/CCW arcs.
    arcRate: (Math.random() - 0.5) * 2 * ARC_RATE_RANGE,
    alive: true,
    // Whether the front is still actively growing (drawing new pixels).
    growing: true,
    // Trail of drawn pixel positions for tail-erase ("undraw") animation.
    trail: [],
    // Index into trail[] of the next point to erase from the back.
    undrawIndex: 0,
    // Insertion-order rank assigned when this front first stops growing.
    // Used to determine "oldest" when MAX_LINES_BEFORE_UNDRAW is exceeded.
    stoppedOrder: -1,
    // Set to true once this stopped front has been selected to begin erasing.
    undrawStarted: false,
    // Active golden glow state set when the front stops due to a collision.
    // null if no collision glow is active.
    collisionGlow: null,
    // Last integer grid cell – avoids self-collision when sub-pixel
    // movement keeps the front inside the same cell.
    lastGx: Math.round(x),
    lastGy: Math.round(y),
  };
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create and return a Substrate effect controller.
 *
 * @param {Object}  [opts]               Optional configuration.
 * @param {string}  [opts.quality='high'] Graphics quality tier: 'low' | 'medium' | 'high'.
 *                                        Lower tiers reduce active front count and interior
 *                                        grain deposition to improve performance on modest hardware.
 * @returns {{ update: Function, draw: Function, reset: Function }}
 */
export function createSubstrateEffect({ quality = 'high' } = {}) {
  // ── Quality-scaled workload parameters ──────────────────────────────────
  // These override the module-level constants when lower quality tiers are
  // requested, reducing canvas draw calls and JS work per frame.
  const isLow    = quality === 'low';
  const isMedium = quality === 'medium';

  /** Seed count: fewer starting fronts on lower tiers. */
  const effectSeedCount    = isLow ? 3  : isMedium ? 4  : SEED_COUNT;
  /** Hard cap on simultaneously active fronts. */
  const effectMaxFronts    = isLow ? 20 : isMedium ? 35 : MAX_FRONTS;
  /**
   * Interior deposition grains per pixel step.
   * Set to 0 on LOW to skip deposition entirely (biggest per-frame saving).
   */
  const effectGrainDensity = isLow ? 0  : isMedium ? 3  : GRAIN_DENSITY;

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

  // Initial fade-in alpha multiplier (0 → 1).
  let compositeAlpha = 0;
  let initStartMs    = null;

  // Monotonically increasing counter assigned to each front when it first
  // stops growing.  Lower values = older stopped fronts, which are chosen
  // first when MAX_LINES_BEFORE_UNDRAW is exceeded.
  let _nextStoppedOrder = 0;

  // Cached count of actively growing fronts.  Maintained incrementally so
  // spawn-cap checks are O(1) rather than iterating the entire fronts array.
  let _growingCount = 0;

  // ── Initialisation ────────────────────────────────────────────────────────

  function _init(w, h) {
    W = Math.ceil(w);
    H = Math.ceil(h);

    // Reset the stopped-order counter and growing-count cache on a fresh canvas.
    _nextStoppedOrder = 0;
    _growingCount     = 0;

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

    for (let i = 0; i < effectSeedCount; i++) {
      _spawnRandom();
    }
  }

  // ── Front spawning ────────────────────────────────────────────────────────

  /**
   * Return the current count of actively growing fronts.
   * Backed by an incrementally maintained cache so each call is O(1).
   */
  function _growingFrontCount() {
    return _growingCount;
  }

  /** Seed a new front at a random viewport position with quantised angle. */
  function _spawnRandom() {
    if (_growingCount >= effectMaxFronts) return;
    const x     = 10 + Math.random() * (W - 20);
    const y     = 10 + Math.random() * (H - 20);
    const angle = _quantisedAngle();
    const mode  = Math.random() < ARC_PROBABILITY ? 'arc' : 'straight';
    fronts.push(_createFront(x, y, angle, mode));
    _growingCount++;
  }

  /**
   * Spawn a perpendicular child from a collision point.
   * The child direction is ±90° relative to the hit structure's angle.
   */
  function _spawnPerp(xi, yi, hitAngle) {
    if (_growingCount >= effectMaxFronts) return;
    const perp = hitAngle + (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    // Offset 2 px along the new direction to avoid immediate re-collision.
    const ox = xi + Math.cos(perp) * 2;
    const oy = yi + Math.sin(perp) * 2;
    if (ox < 0 || ox >= W || oy < 0 || oy >= H) return;
    const mode = Math.random() < ARC_PROBABILITY ? 'arc' : 'straight';
    fronts.push(_createFront(ox, oy, perp, mode));
    _growingCount++;
  }

  // ── Growth front simulation ───────────────────────────────────────────────

  /**
   * Advance a single growth front by `steps` pixels.
   * Handles arc curvature, perpendicular turns, collision detection,
   * edge rendering, and interior deposition.
   */
  function _stepFront(front, steps, dt) {
    if (!front.growing) return;

    // Age the front; stop growing if it exceeds its lifespan.
    front.age += dt;
    if (front.age >= front.maxAge) {
      front.stoppedOrder = _nextStoppedOrder++;
      front.growing = false;
      _growingCount = Math.max(0, _growingCount - 1);
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

      // Out of viewport → stop growing.
      if (xi < 0 || xi >= W || yi < 0 || yi >= H) {
        front.stoppedOrder = _nextStoppedOrder++;
        front.growing = false;
        _growingCount = Math.max(0, _growingCount - 1);
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
        front.stoppedOrder = _nextStoppedOrder++;
        front.growing = false;
        _growingCount = Math.max(0, _growingCount - 1);
        // Golden glow effect at the collision point: fades along the trail
        // away from the impact, then decays over time.
        front.collisionGlow = {
          active:        true,
          age:           0,
          trailEndIdx:   front.trail.length, // trail length at moment of collision
        };
        // Only spawn branches when this front made meaningful progress.
        // Fronts that stop immediately are boxed in; branching from them
        // would create an infinite cascade of zero-progress micro-fronts.
        if (front.trail.length >= MINIMUM_TRAIL_FOR_BRANCH) {
          // Primary perpendicular branch.
          if (Math.random() < BRANCH_PROBABILITY) {
            _spawnPerp(xi, yi, cgrid[idx]);
          }
          // Occasional second branch for denser intersection nodes.
          if (Math.random() < BRANCH_PROBABILITY * 0.3) {
            _spawnPerp(xi, yi, cgrid[idx]);
          }
        }
        return;
      }

      // Claim this cell in the occupancy grid.
      cgrid[idx] = front.angle;

      // Draw the thin edge pixel on the off-screen canvas.
      _drawEdgePixel(front.x, front.y, front.edgeFillStyle);

      // Scatter faint interior deposition perpendicular to the front.
      // Skipped when effectGrainDensity is 0 (LOW quality).
      if (effectGrainDensity > 0) {
        _drawDeposition(front.x, front.y, front.angle, front.baseColorStyle);
      }

      // Record position for the tail-erase undraw animation.
      front.trail.push({ x: front.x, y: front.y });
    }
  }

  // ── Off-screen canvas drawing ─────────────────────────────────────────────

  /**
   * Draw a single thin edge pixel for a growth front line.
   * Accepts the pre-built fillStyle string stored on the front to avoid
   * repeated rgba() string construction.
   * Per-pixel alpha variation and an occasional off-centre grain dot give
   * the strokes a chalky, hand-drawn quality.
   */
  function _drawEdgePixel(x, y, fillStyle) {
    offCtx.fillStyle = fillStyle;
    // Vary opacity slightly each pixel for a chalky, irregular stroke.
    offCtx.globalAlpha = 0.70 + Math.random() * 0.30;
    offCtx.fillRect(x - LINE_WIDTH / 2, y - LINE_WIDTH / 2,
      LINE_WIDTH, LINE_WIDTH);
    // Chalk grain: an occasional faint dot near the edge for rough texture.
    if (Math.random() < 0.35) {
      const gx = x + (Math.random() - 0.5) * LINE_WIDTH * 2.5;
      const gy = y + (Math.random() - 0.5) * LINE_WIDTH * 2.5;
      offCtx.globalAlpha = 0.15 + Math.random() * 0.15;
      offCtx.fillRect(gx, gy, 1, 1);
    }
    // Restore globalAlpha so subsequent draw calls are not affected.
    offCtx.globalAlpha = 1;
  }

  /**
   * Scatter faint interior deposition grains perpendicular to a front.
   * Creates the directional striation or "brushed grain" texture inside
   * the geometric regions bounded by crack lines.
   *
   * Each grain is a 1×1 px dot placed at a random offset along the
   * perpendicular axis.  Alpha falls off quadratically from the crack
   * line toward the band edges, with additional per-grain random
   * variation (0.3× – 1.0×) for organic texture.  The result remains
   * whisper-faint and restrained.
   *
   * Performance note: fillStyle is set once per invocation to the
   * pre-built RGB string; per-grain alpha variation is applied via
   * globalAlpha so only a number property is mutated (faster than
   * constructing a new rgba() string for every grain).
   */
  function _drawDeposition(cx, cy, angle, baseColorStyle) {
    // Perpendicular direction to the front's heading.
    const px = -Math.sin(angle);
    const py =  Math.cos(angle);

    // Set color once for all grains in this invocation.
    offCtx.fillStyle = baseColorStyle;

    for (let i = 0; i < effectGrainDensity; i++) {
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

      // Use globalAlpha for per-grain variation – mutating a numeric
      // property is faster than building a new rgba() string each grain.
      offCtx.globalAlpha = alpha;
      offCtx.fillRect(gx, gy, 1, 1);
    }

    // Restore globalAlpha to avoid bleeding into subsequent draw calls.
    offCtx.globalAlpha = 1;
  }

  // ── Tail-erase ("undraw") ────────────────────────────────────────────────

  /**
   * Erase trail pixels from the back of a growth front, clearing both the
   * off-screen canvas and the occupancy grid.  This produces the gradual
   * "undrawn from behind" disappearance instead of a sudden full-canvas wipe.
   *
   * Performance note: all erase circles for this batch are accumulated into
   * a single compound path and flushed with one fill() call, which is
   * significantly cheaper than one beginPath/arc/fill per trail point.
   */
  function _undrawFront(front, steps) {
    if (!offCtx || front.undrawIndex >= front.trail.length) return;

    offCtx.save();
    offCtx.globalCompositeOperation = 'destination-out';
    offCtx.fillStyle = 'rgba(0,0,0,1)';

    const limit = Math.min(front.undrawIndex + steps, front.trail.length);

    // Batch all erase arcs into a single compound path to minimise GPU
    // state flushes (one fill() instead of N fill() calls).
    offCtx.beginPath();
    for (let i = front.undrawIndex; i < limit; i++) {
      const pt = front.trail[i];
      // Erase a small circular region covering the edge pixel and nearby grains.
      offCtx.moveTo(pt.x + ERASE_RADIUS, pt.y);
      offCtx.arc(pt.x, pt.y, ERASE_RADIUS, 0, Math.PI * 2);

      // Free the occupancy grid cell so new fronts can reclaim this area.
      const xi = Math.round(pt.x);
      const yi = Math.round(pt.y);
      if (xi >= 0 && xi < W && yi >= 0 && yi < H) {
        cgrid[yi * W + xi] = GRID_EMPTY;
      }
    }
    offCtx.fill();

    offCtx.restore();
    front.undrawIndex = limit;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  /**
   * Advance the simulation by one frame.
   * Growth fronts extend while their tails gradually undraw from behind.
   * No sudden full-canvas reset; individual fronts clean up after themselves.
   *
   * @param {number} now  High-resolution timestamp (ms), e.g. performance.now().
   * @param {number} w    Viewport width in CSS pixels.
   * @param {number} h    Viewport height in CSS pixels.
   */
  function update(now, w, h) {
    // Re-initialise if the viewport size changed or this is the first frame.
    const needsInit = !offCanvas || W !== Math.ceil(w) || H !== Math.ceil(h);
    if (needsInit) {
      _init(w, h);
      compositeAlpha = 0;
      initStartMs    = now;
      lastTs         = null;
    }

    if (initStartMs === null) initStartMs = now;

    const dt = lastTs === null ? 0.016 : Math.min((now - lastTs) / 1000, 0.1);
    lastTs   = now;

    // Gentle fade-in after initialisation.
    compositeAlpha = Math.min(1, (now - initStartMs) / FADE_IN_MS);

    // Advance each growing front by the appropriate number of pixel steps.
    for (const front of fronts) {
      if (!front.alive) continue;
      if (front.growing) {
        const steps = Math.max(1, Math.round(front.speed * dt));
        _stepFront(front, steps, dt);
      }
    }

    // Process tail-erase for every front.
    // ─ While still growing: cap visible trail at TRAIL_MAX_VISIBLE.
    // ─ Once stopped: persist until MAX_LINES_BEFORE_UNDRAW is exceeded,
    //   then erase oldest stopped lines first.

    // Step 1 – enforce per-front pixel cap on growing fronts.
    for (const front of fronts) {
      if (!front.alive || !front.growing) continue;
      const visibleCount = front.trail.length - front.undrawIndex;
      if (visibleCount > TRAIL_MAX_VISIBLE) {
        _undrawFront(front, visibleCount - TRAIL_MAX_VISIBLE);
      }
    }

    // Step 2 – advance collision-glow age and expire finished glows.
    for (const front of fronts) {
      const glow = front.collisionGlow;
      if (!glow?.active) continue;
      glow.age += dt;
      if (glow.age >= COLLISION_GLOW_DURATION_MS / 1000) {
        glow.active = false;
      }
    }

    // Step 3 – count stopped fronts that have not yet begun erasing.
    //           If the count exceeds MAX_LINES_BEFORE_UNDRAW, schedule the
    //           oldest ones (lowest stoppedOrder) for erasure.
    let persistentCount = 0;
    for (const front of fronts) {
      if (front.alive && !front.growing && !front.undrawStarted) persistentCount++;
    }

    if (persistentCount > MAX_LINES_BEFORE_UNDRAW) {
      // Collect stopped, non-erasing fronts sorted oldest first.
      const toStart = persistentCount - MAX_LINES_BEFORE_UNDRAW;
      const stopped = [];
      for (const front of fronts) {
        if (front.alive && !front.growing && !front.undrawStarted && front.stoppedOrder >= 0) {
          stopped.push(front);
        }
      }
      stopped.sort((a, b) => a.stoppedOrder - b.stoppedOrder);
      for (let i = 0; i < Math.min(toStart, stopped.length); i++) {
        stopped[i].undrawStarted = true;
      }
    }

    // Step 4 – advance erase animation for fronts whose undraw has started.
    for (const front of fronts) {
      if (!front.alive || front.growing || !front.undrawStarted) continue;
      const visibleCount = front.trail.length - front.undrawIndex;
      if (visibleCount > 0) {
        const undrawSteps = Math.max(1,
          Math.round(front.speed * UNDRAW_SPEED_FACTOR * dt));
        _undrawFront(front, undrawSteps);
      }

      // Mark fully erased fronts as dead.
      if (front.undrawIndex >= front.trail.length) {
        front.alive = false;
      }
    }

    // Also mark stopped fronts with an empty trail as immediately dead.
    for (const front of fronts) {
      if (!front.alive || front.growing) continue;
      if (front.trail.length === 0) front.alive = false;
    }

    // Remove dead fronts.
    for (let i = fronts.length - 1; i >= 0; i--) {
      if (!fronts[i].alive) fronts.splice(i, 1);
    }

    // Re-seed if the count of actively growing fronts drops below the threshold.
    // _growingCount is the cached value; _spawnRandom() increments it.
    const needed = Math.max(0, effectSeedCount - _growingCount);
    for (let i = 0; i < needed; i++) {
      _spawnRandom();
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  /**
   * Composite the accumulated crystalline pattern onto the main canvas,
   * then overlay any active collision glows.
   *
   * @param {CanvasRenderingContext2D} ctx  Already in CSS-pixel space.
   */
  function draw(ctx) {
    if (!offCanvas || compositeAlpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = compositeAlpha * COMPOSITE_ALPHA;
    ctx.drawImage(offCanvas, 0, 0);
    ctx.restore();

    // ── Collision glow overlays ───────────────────────────────────────────
    // Draw a golden gradient stroke along each front's trail from a point
    // COLLISION_GLOW_TRAIL_LENGTH px back to the collision point.
    // Alpha peaks at the collision point and is zero at the far end.
    // Intensity also ramps up over COLLISION_GLOW_PEAK_MS then decays.
    for (const front of fronts) {
      const glow = front.collisionGlow;
      if (!glow?.active) continue;

      const trail     = front.trail;
      // glowEndIdx is the last trail point drawn at collision time.
      const glowEndIdx   = Math.min(glow.trailEndIdx, trail.length) - 1;
      if (glowEndIdx < 0) continue;

      // glowStartIdx accounts for any tail-erasure that has already advanced.
      const glowStartIdx = Math.max(
        front.undrawIndex,
        glowEndIdx - COLLISION_GLOW_TRAIL_LENGTH + 1,
      );
      if (glowStartIdx > glowEndIdx) continue;

      const startPt = trail[glowStartIdx];
      const endPt   = trail[glowEndIdx];
      if (!startPt || !endPt) continue;

      // Time-based fade: ramp up (attack) then ramp down (decay).
      const duration = COLLISION_GLOW_DURATION_MS / 1000;
      const peakTime = COLLISION_GLOW_PEAK_MS / 1000;
      let   timeFade;
      if (glow.age < peakTime) {
        timeFade = glow.age / peakTime;
      } else {
        timeFade = 1 - (glow.age - peakTime) / (duration - peakTime);
      }
      timeFade = Math.max(0, Math.min(1, timeFade));

      const alpha = COLLISION_GLOW_MAX_ALPHA * timeFade * compositeAlpha;
      if (alpha <= 0.001) continue;

      // Linear gradient: transparent at the far end, pale gold at the collision point.
      const grad = ctx.createLinearGradient(startPt.x, startPt.y, endPt.x, endPt.y);
      grad.addColorStop(0, 'rgba(255,240,200,0)');
      grad.addColorStop(1, `rgba(255,240,200,${alpha.toFixed(3)})`);

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth   = COLLISION_GLOW_LINE_WIDTH;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.globalAlpha = 1; // Alpha is already encoded in the gradient stops.
      ctx.beginPath();
      ctx.moveTo(startPt.x, startPt.y);
      for (let i = glowStartIdx + 1; i <= glowEndIdx; i++) {
        ctx.lineTo(trail[i].x, trail[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  /** Clear all state so the effect feels fresh on re-entry. */
  function reset() {
    offCanvas         = null;
    offCtx            = null;
    cgrid             = null;
    fronts            = [];
    W                 = 0;
    H                 = 0;
    lastTs            = null;
    initStartMs       = null;
    compositeAlpha    = 0;
    _nextStoppedOrder = 0;
    _growingCount     = 0;
  }

  return { update, draw, reset };
}
