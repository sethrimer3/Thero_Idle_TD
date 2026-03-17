/**
 * PrologueShapeEffect
 *
 * Ambient background effect for the Prologue chapter.
 * Six invisible shapes (3 circles + 3 squares) drift slowly across the viewport.
 * Only where at least two shapes overlap does a faint silver-white glow become visible.
 *
 * Circles translate only. Squares translate AND rotate slowly.
 *
 * Rendering technique: for each pair of the six shapes, clip the canvas to one
 * shape and fill the other.  Only the intersection area receives paint, making
 * individual shapes completely transparent while overlaps emit a soft glow.
 * The cost is C(6,2) = 15 clip-and-fill operations per frame – very lightweight.
 *
 * All positions are in logical CSS pixel screen-space so the effect stays fixed
 * to the viewport regardless of camera pan / zoom.
 */

// ─── Shape dimensions (logical CSS pixels) ───────────────────────────────────

// Three circles: small, medium, large.
const SMALL_CIRCLE_RADIUS  = 38;   // diameter 76
const MEDIUM_CIRCLE_RADIUS = 54;   // diameter 108
const LARGE_CIRCLE_RADIUS  = 76;   // diameter 152

// Three squares: the first two sides match the diameters of the small and medium
// circles; the third is an independently chosen size.
const SQUARE_SIDES = [76, 108, 124];

// ─── Motion constants ─────────────────────────────────────────────────────────

// Drift speed range for all shapes (logical pixels per second).
const MIN_SPEED = 6;
const MAX_SPEED = 16;

// How often velocities receive a small random nudge (milliseconds).
const NUDGE_INTERVAL_MS = 3500;

// Maximum velocity change per nudge (px/s, applied independently to vx and vy).
const NUDGE_AMOUNT = 3;

// Rotation speed range for squares (radians per second).
const MIN_ROT_SPEED = 0.04;
const MAX_ROT_SPEED = 0.14;

// ─── Glow appearance ─────────────────────────────────────────────────────────

// Each pairwise intersection is filled with this color.
// The alpha is intentionally very low so the effect accumulates subtly.
const GLOW_R     = 215;
const GLOW_G     = 228;
const GLOW_B     = 255;
const GLOW_ALPHA = 0.07;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Add the outline subpath of a shape to the current canvas path without
 * using ctx.save/restore or ctx.rotate so it is safe to call between
 * ctx.beginPath() and ctx.clip() / ctx.fill().
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} shape
 */
function addShapePath(ctx, shape) {
  if (shape.type === 'circle') {
    ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2);
  } else {
    // Build the four rotated corners in world space without transforming the
    // canvas context, so the operation is safe inside an active path.
    const hs  = shape.s * 0.5;
    const cos = Math.cos(shape.rotation);
    const sin = Math.sin(shape.rotation);
    // Local corners: TL, TR, BR, BL
    const localCorners = [[-hs, -hs], [hs, -hs], [hs, hs], [-hs, hs]];
    const wx0 = shape.x + localCorners[0][0] * cos - localCorners[0][1] * sin;
    const wy0 = shape.y + localCorners[0][0] * sin + localCorners[0][1] * cos;
    ctx.moveTo(wx0, wy0);
    for (let k = 1; k < 4; k++) {
      const [lx, ly] = localCorners[k];
      ctx.lineTo(shape.x + lx * cos - ly * sin, shape.y + lx * sin + ly * cos);
    }
    ctx.closePath();
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create and return a prologue shape-overlap effect controller.
 *
 * @returns {{ update: Function, draw: Function, reset: Function }}
 */
export function createPrologueShapeEffect() {
  // Initialized on first update() call.
  let shapes         = null;
  let lastTimestamp  = null;
  let lastNudgeTime  = 0;

  // ─── Initialization ──────────────────────────────────────────────────────

  function init(width, height) {
    shapes = [];

    // Helper: random initial velocity within [MIN_SPEED, MAX_SPEED].
    const randVelocity = () => {
      const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
      const angle = Math.random() * Math.PI * 2;
      return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
    };

    // Three circles.
    for (const r of [SMALL_CIRCLE_RADIUS, MEDIUM_CIRCLE_RADIUS, LARGE_CIRCLE_RADIUS]) {
      const { vx, vy } = randVelocity();
      shapes.push({ type: 'circle', r, x: Math.random() * width, y: Math.random() * height, vx, vy });
    }

    // Three squares (squares carry an extra rotation state).
    for (const s of SQUARE_SIDES) {
      const { vx, vy } = randVelocity();
      const rotSign = Math.random() < 0.5 ? 1 : -1;
      shapes.push({
        type:     'square',
        s,
        x:        Math.random() * width,
        y:        Math.random() * height,
        vx,
        vy,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: rotSign * (MIN_ROT_SPEED + Math.random() * (MAX_ROT_SPEED - MIN_ROT_SPEED)),
      });
    }
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  /**
   * Advance the simulation by one frame.
   *
   * @param {number} nowMs   Current high-resolution timestamp (ms).
   * @param {number} width   Viewport width in logical CSS pixels.
   * @param {number} height  Viewport height in logical CSS pixels.
   */
  function update(nowMs, width, height) {
    if (!shapes) {
      init(width, height);
      lastTimestamp = nowMs;
      lastNudgeTime = nowMs;
      return;
    }

    // Delta time in seconds, capped to avoid large jumps after tab-switches.
    const dtMs = nowMs - (lastTimestamp || nowMs);
    lastTimestamp = nowMs;
    const dt = Math.min(dtMs / 1000, 0.1);

    // Gently nudge velocities to keep motion organic.
    if (nowMs - lastNudgeTime > NUDGE_INTERVAL_MS) {
      lastNudgeTime = nowMs;
      for (const shape of shapes) {
        shape.vx += (Math.random() - 0.5) * NUDGE_AMOUNT * 2;
        shape.vy += (Math.random() - 0.5) * NUDGE_AMOUNT * 2;
        // Re-clamp to the allowed speed range.
        const speed = Math.hypot(shape.vx, shape.vy);
        if (speed > MAX_SPEED) {
          const inv = MAX_SPEED / speed;
          shape.vx *= inv;
          shape.vy *= inv;
        } else if (speed > 0 && speed < MIN_SPEED) {
          const inv = MIN_SPEED / speed;
          shape.vx *= inv;
          shape.vy *= inv;
        }
      }
    }

    for (const shape of shapes) {
      // Move shape.
      shape.x += shape.vx * dt;
      shape.y += shape.vy * dt;

      // Wrap around the viewport with a margin so shapes re-enter smoothly.
      const margin = shape.type === 'circle' ? shape.r : shape.s * 0.85;
      if      (shape.x < -margin)          { shape.x += width  + margin * 2; }
      else if (shape.x >  width  + margin) { shape.x -= width  + margin * 2; }
      if      (shape.y < -margin)          { shape.y += height + margin * 2; }
      else if (shape.y >  height + margin) { shape.y -= height + margin * 2; }

      // Rotate squares.
      if (shape.type === 'square') {
        shape.rotation += shape.rotSpeed * dt;
      }
    }
  }

  // ─── Draw ────────────────────────────────────────────────────────────────

  /**
   * Render the overlap-glow effect onto the supplied context.
   * The context should already be transformed to logical CSS pixel space.
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  function draw(ctx) {
    if (!shapes) {
      return;
    }

    ctx.save();
    ctx.fillStyle = `rgba(${GLOW_R}, ${GLOW_G}, ${GLOW_B}, ${GLOW_ALPHA})`;

    // For each pair (i, j), clip to shape i and fill shape j.
    // Only the intersection region receives paint, so single-shape areas remain transparent.
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) {
        ctx.save();
        // Clipping region: shape i.
        ctx.beginPath();
        addShapePath(ctx, shapes[i]);
        ctx.clip();
        // Fill: shape j (only the intersection with the clip is rendered).
        ctx.beginPath();
        addShapePath(ctx, shapes[j]);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  // ─── Reset ───────────────────────────────────────────────────────────────

  /** Reset effect state so it reinitialises cleanly on next update(). */
  function reset() {
    shapes        = null;
    lastTimestamp = null;
    lastNudgeTime = 0;
  }

  return { update, draw, reset };
}
