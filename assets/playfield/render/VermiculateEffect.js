/**
 * VermiculateEffect
 *
 * Ambient background effect for Chapter 1.
 * Renders thin squiggly worm-like paths that move and evolve over time,
 * inspired by the classic XScreenSaver "Vermiculate" effect but adapted
 * for a polished in-game ambient background.
 *
 * Visual style
 * ------------
 * • Dim glowing light trails in white, pale gold, and pale blue.
 * • Each active path head is traced by a small glowing dot.
 * • Overall opacity ~20%, subtle and atmospheric.
 * • Transparent canvas – no background fill.
 *
 * Simulation logic
 * ----------------
 * • Multiple independent tracers wander the viewport.
 * • Each tracer's heading is steered by layered sine-wave angular modulation
 *   at three incommensurate frequencies.  Random phase offsets per tracer make
 *   every path unique.  The result is smooth, semi-organic, semi-geometric
 *   wandering with no sharp angle snaps or chaotic jitter.
 * • Trail points are stored in a fixed-size Float64Array ring buffer
 *   (x0,y0, x1,y1, …) for zero per-frame allocation.
 * • Tracers wrap around screen edges so paths continue seamlessly.
 *
 * Glow strategy
 * -------------
 * • Trails are rendered in two passes per alpha-band:
 *     1. A wider, dimmer "halo" stroke provides a soft glow envelope.
 *     2. A thinner, brighter primary stroke provides crisp line identity.
 * • Additive compositing ('lighter') causes brightness to accumulate where
 *   trails overlap, producing natural glow buildup without shadowBlur cost.
 * • Alpha increases from tail to head across TRAIL_ALPHA_BANDS bands.
 *
 * Head-dot cache strategy
 * -----------------------
 * • One small offscreen canvas per palette color is created lazily.
 * • Each sprite contains a pre-rendered radial-gradient glowing dot.
 * • During draw(), dots are stamped with drawImage() – zero per-frame
 *   gradient creation.
 *
 * Colors: white, pale gold, pale blue at low opacity.
 * All positions are in logical CSS pixel screen-space.
 */

// ─── Configurable parameters ──────────────────────────────────────────────────
// All important values are grouped here for easy tuning.

/** Number of simultaneous tracers. */
const TRACER_COUNT = 14;

/** Max trail points per tracer (ring buffer capacity). */
const TRAIL_LENGTH = 200;

/** Distance (px) a tracer must travel before a new trail point is stored. */
const POINT_INTERVAL = 4;

/** Thin primary stroke width (px). */
const LINE_WIDTH = 1.2;

/** Base alpha for the newest primary stroke band (tail fades toward 0). */
const LINE_OPACITY = 0.20;

/** Wider halo stroke width (px) drawn under the primary line for soft glow. */
const GLOW_WIDTH = 3.5;

/** Base alpha for the newest halo stroke band. */
const GLOW_OPACITY = 0.06;

/** Diameter (px) of the cached head-dot sprite. */
const HEAD_DOT_SIZE = 14;

/** Global alpha applied when stamping a head-dot sprite. */
const HEAD_DOT_OPACITY = 0.50;

/** Tracer movement speed (CSS px / s). */
const SPEED = 55;

/**
 * Angular change magnitude (rad / s).  Multiplied by the layered sine-wave
 * output to steer each tracer smoothly.
 */
const TURN_RATE = 0.8;

/** Number of opacity bands in the tail-to-head fade gradient. */
const TRAIL_ALPHA_BANDS = 5;

/** Whether tracers wrap around screen edges (true) or bounce (false). */
const WRAP_EDGES = true;

/** Canvas globalCompositeOperation used during trail/head rendering. */
const COMPOSITE_OP = 'lighter';

// ─── Color palette ────────────────────────────────────────────────────────────
// Suggested starting palette (white, pale gold, pale blue).

const PALETTE = [
  { r: 255, g: 255, b: 255 },   // white
  { r: 255, g: 235, b: 190 },   // pale gold
  { r: 200, g: 225, b: 255 },   // pale blue
];

// ─── Angular modulation layers ────────────────────────────────────────────────
// Three incommensurate sine-wave frequencies produce complex, non-repeating
// wandering without any noise library.

const ANGLE_FREQ_1 = 0.37;  // Hz
const ANGLE_FREQ_2 = 0.83;
const ANGLE_FREQ_3 = 1.51;
const ANGLE_AMP_1  = 1.00;  // relative weight
const ANGLE_AMP_2  = 0.60;
const ANGLE_AMP_3  = 0.35;
const TWO_PI = Math.PI * 2;

// If two consecutive trail points are farther apart than this (px), treat the
// segment as a wrap-around discontinuity and start a new sub-path.
const WRAP_GAP_THRESHOLD = 50;
const WRAP_GAP_THRESHOLD_SQ = WRAP_GAP_THRESHOLD * WRAP_GAP_THRESHOLD;

// ─── Head-dot sprite cache ────────────────────────────────────────────────────

/**
 * Create a small offscreen canvas containing a pre-blurred radial-gradient dot.
 * Stamped via drawImage() each frame instead of recreating a radialGradient,
 * which is far cheaper per frame.
 *
 * @param {number} r  Red   (0–255)
 * @param {number} g  Green (0–255)
 * @param {number} b  Blue  (0–255)
 * @param {number} size  Sprite width/height in px.
 * @returns {HTMLCanvasElement}
 */
function _createDotSprite(r, g, b, size) {
  const off = document.createElement('canvas');
  off.width  = size;
  off.height = size;
  const c   = off.getContext('2d');
  const cx  = size / 2;
  const cy  = size / 2;
  const rad = size / 2;

  const grad = c.createRadialGradient(cx, cy, 0, cx, cy, rad);
  grad.addColorStop(0,    'rgba(255,255,255,1)');
  grad.addColorStop(0.20, `rgba(${r},${g},${b},0.9)`);
  grad.addColorStop(0.50, `rgba(${r},${g},${b},0.3)`);
  grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);

  c.fillStyle = grad;
  c.beginPath();
  c.arc(cx, cy, rad, 0, TWO_PI);
  c.fill();
  return off;
}

// ─── Tracer factory ───────────────────────────────────────────────────────────

/**
 * Pre-compute TRAIL_ALPHA_BANDS stroke style strings for a given color.
 * Called once per tracer creation so draw() never allocates strings.
 *
 * @returns {{ line: string[], halo: string[] }}
 */
function _buildBandStyles(r, g, b) {
  const line = [];
  const halo = [];
  for (let i = 0; i < TRAIL_ALPHA_BANDS; i++) {
    const frac = (i + 1) / TRAIL_ALPHA_BANDS;
    line.push(`rgba(${r},${g},${b},${(frac * LINE_OPACITY).toFixed(4)})`);
    halo.push(`rgba(${r},${g},${b},${(frac * GLOW_OPACITY).toFixed(4)})`);
  }
  return { line, halo };
}

/**
 * Create a new tracer at a random viewport position.
 */
function _createTracer(W, H) {
  const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
  const x     = Math.random() * W;
  const y     = Math.random() * H;
  const angle = Math.random() * TWO_PI;
  const styles = _buildBandStyles(color.r, color.g, color.b);

  // Unique phase offsets for the three sine-wave layers so every tracer
  // follows a distinct path.
  const p0 = Math.random() * TWO_PI;
  const p1 = Math.random() * TWO_PI;
  const p2 = Math.random() * TWO_PI;

  // Ring buffer: pairs of (x, y) stored in a flat Float64Array.
  const trail = new Float64Array(TRAIL_LENGTH * 2);
  // Seed the buffer with the initial position so the first _step() call has
  // a valid reference point for distance accumulation.  trailHead=1 means the
  // next point write goes to index 1; trailLen=1 accounts for this seed entry.
  trail[0] = x;
  trail[1] = y;

  return {
    x, y, angle,
    color,
    lineStyles:  styles.line,     // Pre-computed primary stroke styles per band.
    haloStyles:  styles.halo,     // Pre-computed halo stroke styles per band.
    shadowColor: `rgba(${color.r},${color.g},${color.b},0.4)`,
    p0, p1, p2,                   // Sine-wave phase offsets.
    trail,
    trailHead: 1,                 // Next write index (point units, 0…TRAIL_LENGTH-1).
    trailLen:  1,                 // Current stored point count.
    distAcc:   0,                 // Distance accumulator for point recording.
    age:       0,                 // Elapsed time (s) for sine-wave advancement.
  };
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create and return a Vermiculate effect controller.
 * @returns {{ update: Function, draw: Function, reset: Function, destroy: Function }}
 */
export function createVermiculateEffect() {
  let tracers = [];
  let lastTs  = null;

  // Viewport dimensions cached during update() for use in draw().
  let _viewW = 0;
  let _viewH = 0;

  // Cached head-dot sprites keyed by "r,g,b".
  let _dotSprites = null;

  // ── Dot-sprite cache (lazy init) ──────────────────────────────────────────

  function _ensureDotSprites() {
    if (_dotSprites) return;
    _dotSprites = new Map();
    for (const c of PALETTE) {
      _dotSprites.set(`${c.r},${c.g},${c.b}`,
        _createDotSprite(c.r, c.g, c.b, HEAD_DOT_SIZE));
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  function _init(W, H) {
    tracers = [];
    for (let i = 0; i < TRACER_COUNT; i++) {
      tracers.push(_createTracer(W, H));
    }
    lastTs = null;
  }

  // ── Step a single tracer ──────────────────────────────────────────────────

  function _step(t, dt, W, H) {
    t.age += dt;

    // Smooth angular modulation: three layered sine waves at incommensurate
    // frequencies.  The combined signal drives the heading change per frame,
    // producing semi-organic, non-repeating wandering.
    const drive =
      ANGLE_AMP_1 * Math.sin(t.age * ANGLE_FREQ_1 * TWO_PI + t.p0) +
      ANGLE_AMP_2 * Math.sin(t.age * ANGLE_FREQ_2 * TWO_PI + t.p1) +
      ANGLE_AMP_3 * Math.sin(t.age * ANGLE_FREQ_3 * TWO_PI + t.p2);

    t.angle += drive * TURN_RATE * dt;

    // Advance position.
    const dist = SPEED * dt;
    t.x += Math.cos(t.angle) * dist;
    t.y += Math.sin(t.angle) * dist;

    // Edge wrapping: tracer re-enters from the opposite side.
    if (WRAP_EDGES) {
      if (t.x < 0)  t.x += W;
      if (t.x >= W) t.x -= W;
      if (t.y < 0)  t.y += H;
      if (t.y >= H) t.y -= H;
    }

    // Record trail point at distance intervals into the ring buffer.
    const prevIdx = ((t.trailHead - 1 + TRAIL_LENGTH) % TRAIL_LENGTH) * 2;
    const prevX   = t.trailLen > 0 ? t.trail[prevIdx]     : t.x;
    const prevY   = t.trailLen > 0 ? t.trail[prevIdx + 1] : t.y;
    t.distAcc += Math.hypot(t.x - prevX, t.y - prevY);

    if (t.distAcc >= POINT_INTERVAL) {
      t.distAcc = 0;
      const wi = t.trailHead * 2;
      t.trail[wi]     = t.x;
      t.trail[wi + 1] = t.y;
      t.trailHead = (t.trailHead + 1) % TRAIL_LENGTH;
      if (t.trailLen < TRAIL_LENGTH) t.trailLen++;
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────

  function update(now, W, H) {
    _viewW = W;
    _viewH = H;

    if (!tracers.length) _init(W, H);
    _ensureDotSprites();

    const dt = lastTs === null ? 0.016 : Math.min((now - lastTs) / 1000, 0.1);
    lastTs = now;

    for (const t of tracers) {
      _step(t, dt, W, H);
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  /**
   * Render all tracers and their trails.
   * @param {CanvasRenderingContext2D} ctx  Already in CSS-pixel space.
   */
  function draw(ctx) {
    if (!tracers.length) return;

    ctx.save();
    ctx.globalCompositeOperation = COMPOSITE_OP;
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    for (const t of tracers) {
      if (t.trailLen >= 2) _drawTrail(ctx, t);
      if (t.trailLen >= 1) _drawHead(ctx, t);
    }

    ctx.restore();
  }

  /**
   * Render a tracer's trail with a tail-to-head opacity fade.
   * Two-pass per band: wider dim halo underneath, thinner brighter line on top.
   * Wrap-around discontinuities are detected and split into separate sub-paths.
   */
  function _drawTrail(ctx, t) {
    const len    = t.trailLen;
    const cap    = TRAIL_LENGTH;  // Ring buffer capacity alias for readability.
    const buf    = t.trail;
    const oldest = (t.trailHead - len + cap) % cap;

    const bandSize = Math.ceil(len / TRAIL_ALPHA_BANDS);

    for (let band = 0; band < TRAIL_ALPHA_BANDS; band++) {
      const startPt = band * bandSize;
      const endPt   = Math.min(startPt + bandSize, len - 1);
      if (startPt >= endPt) continue;

      // ── Build the sub-path, breaking at wrap-around gaps ──────────────
      // We pre-scan the points and record moveTo / lineTo commands so both
      // the halo and primary passes share the same path geometry.
      ctx.beginPath();
      let idx0 = ((oldest + startPt) % cap) * 2;
      ctx.moveTo(buf[idx0], buf[idx0 + 1]);

      let px = buf[idx0];
      let py = buf[idx0 + 1];

      for (let i = startPt + 1; i <= endPt; i++) {
        const idx = ((oldest + i) % cap) * 2;
        const cx  = buf[idx];
        const cy  = buf[idx + 1];

        // Detect wrap-around discontinuity.
        const dx = cx - px;
        const dy = cy - py;
        if (dx * dx + dy * dy > WRAP_GAP_THRESHOLD_SQ) {
          ctx.moveTo(cx, cy);  // Start a new sub-path segment.
        } else {
          ctx.lineTo(cx, cy);
        }
        px = cx;
        py = cy;
      }

      // Pass 1: wider dim halo stroke for soft glow.
      ctx.lineWidth   = GLOW_WIDTH;
      ctx.strokeStyle = t.haloStyles[band];
      ctx.stroke();

      // Pass 2: thinner brighter primary stroke for crisp identity.
      ctx.lineWidth   = LINE_WIDTH;
      ctx.strokeStyle = t.lineStyles[band];
      ctx.stroke();
    }
  }

  /**
   * Stamp the cached head-dot sprite at the tracer's leading position.
   */
  function _drawHead(ctx, t) {
    const key = `${t.color.r},${t.color.g},${t.color.b}`;
    const dot = _dotSprites?.get(key);
    if (!dot) return;

    // The newest trail point is the head position.
    const lastIdx = ((t.trailHead - 1 + TRAIL_LENGTH) % TRAIL_LENGTH) * 2;
    const hx = t.trail[lastIdx];
    const hy = t.trail[lastIdx + 1];
    const half = HEAD_DOT_SIZE / 2;

    ctx.save();
    ctx.globalAlpha = HEAD_DOT_OPACITY;
    ctx.drawImage(dot, hx - half, hy - half);
    ctx.restore();
  }

  // ── Reset / Destroy ───────────────────────────────────────────────────────

  function reset() {
    tracers = [];
    lastTs  = null;
  }

  function destroy() {
    reset();
    _dotSprites = null;
  }

  return { update, draw, reset, destroy };
}
