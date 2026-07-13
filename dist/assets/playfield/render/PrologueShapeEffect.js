/**
 * PrologueShapeEffect
 *
 * Ambient background effect for the Prologue chapter.
 * Six invisible shapes (3 circles + 3 squares) drift slowly across the viewport.
 * Only where an EVEN number of shapes overlap (2, 4, 6…) does a faint silver-white
 * glow become visible.  Where an ODD number overlap (1, 3, 5…) the region stays
 * fully transparent, producing an XOR-style "cut-out" pattern.
 *
 * Circles translate only. Squares translate AND rotate slowly.
 *
 * Rendering technique (XOR compositing):
 *  1. Draw every shape onto an off-screen XOR canvas using the 'xor' composite
 *     operation.  This toggles each pixel's opacity with each additional shape
 *     that covers it: after all six shapes, pixels covered by an ODD number of
 *     shapes are opaque; pixels covered by an EVEN number are transparent.
 *  2. Draw every shape onto a union canvas using 'source-over' and the glow
 *     colour.  This marks every covered pixel with the glow colour (accumulating
 *     slightly in higher-overlap areas for a natural brightness gradient).
 *  3. Apply 'destination-out' on the union canvas using the XOR canvas as source.
 *     This erases the odd-overlap regions, leaving only even-overlap (≥ 2) areas.
 *  4. Blit the union canvas to the main canvas.
 *
 * The two off-screen canvases are cached and only recreated on viewport resize.
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
 * @param {Object} [options]             Optional overrides for the glow colour.
 * @param {number} [options.glowR]       Red component   (0–255).  Default 215.
 * @param {number} [options.glowG]       Green component (0–255).  Default 228.
 * @param {number} [options.glowB]       Blue component  (0–255).  Default 255.
 * @param {number} [options.glowAlpha]   Base opacity of each shape fill.  Default 0.07.
 * @returns {{ update: Function, draw: Function, reset: Function }}
 */
export function createPrologueShapeEffect(options = {}) {
  // Resolve glow colour from caller options with fallback to module-level defaults.
  const _glowR     = options.glowR     ?? GLOW_R;
  const _glowG     = options.glowG     ?? GLOW_G;
  const _glowB     = options.glowB     ?? GLOW_B;
  const _glowAlpha = options.glowAlpha ?? GLOW_ALPHA;
  const _fillStyle = `rgba(${_glowR}, ${_glowG}, ${_glowB}, ${_glowAlpha})`;
  // Initialized on first update() call.
  let shapes         = null;
  let lastTimestamp  = null;
  let lastNudgeTime  = 0;

  // Last known viewport dimensions (CSS px).  Used to detect when the canvas
  // has been resized so we can reinitialize shapes to the new dimensions.
  let _vpW = 0;
  let _vpH = 0;

  // Cached off-screen canvases for the XOR rendering technique.
  // Recreated whenever the viewport dimensions change.
  let _ocXor    = null;   // Accumulates odd-overlap mask via 'xor' composite.
  let _ctxXor   = null;
  let _ocUnion  = null;   // Accumulates all covered areas via 'source-over'.
  let _ctxUnion = null;

  // ─── Off-screen canvas helpers ───────────────────────────────────────────

  /**
   * Ensure the two off-screen canvases exist and match the given dimensions.
   * Called every draw() with the current viewport size.
   */
  function _ensureOffscreenCanvases(W, H) {
    if (_ocXor && _ocXor.width === W && _ocXor.height === H) {
      return;
    }
    _ocXor          = document.createElement('canvas');
    _ocXor.width    = W;
    _ocXor.height   = H;
    _ctxXor         = _ocXor.getContext('2d');

    _ocUnion        = document.createElement('canvas');
    _ocUnion.width  = W;
    _ocUnion.height = H;
    _ctxUnion       = _ocUnion.getContext('2d');
  }

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
    // Re-initialize when shapes don't exist yet OR when the viewport dimensions
    // have changed significantly (e.g. orientation flip or the canvas being
    // measured at a small intermediate size during initial layout).
    const dimensionChanged = !shapes ||
      Math.abs(width  - _vpW) > 100 ||
      Math.abs(height - _vpH) > 100;

    if (dimensionChanged) {
      _vpW = width;
      _vpH = height;
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
   * Render the overlap-glow effect onto the supplied context using XOR compositing.
   *
   * Pixels covered by an even number of shapes (2, 4, 6…) emit the glow colour.
   * Pixels covered by an odd number (1, 3, 5…) remain fully transparent.
   *
   * The context should already be transformed to logical CSS pixel space.
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  function draw(ctx) {
    if (!shapes || !_vpW || !_vpH) {
      return;
    }

    _ensureOffscreenCanvases(_vpW, _vpH);

    // ── Pass 1: XOR canvas ──────────────────────────────────────────────────
    // Each shape drawn with 'xor' toggles its pixels: transparent → opaque on
    // the first cover, opaque → transparent on the second (even), and so on.
    // Result: odd-overlap pixels are opaque; even-overlap pixels are transparent.
    _ctxXor.globalCompositeOperation = 'source-over';
    _ctxXor.clearRect(0, 0, _vpW, _vpH);
    _ctxXor.globalCompositeOperation = 'xor';
    _ctxXor.fillStyle = 'rgba(255,255,255,1)';
    for (const shape of shapes) {
      _ctxXor.beginPath();
      addShapePath(_ctxXor, shape);
      _ctxXor.fill();
    }

    // ── Pass 2: Union canvas ────────────────────────────────────────────────
    // Draw every shape with 'source-over' and the glow colour.  Pixels covered
    // by more shapes accumulate slightly higher brightness, preserving the
    // natural overlap gradient from the previous pairwise technique.
    _ctxUnion.globalCompositeOperation = 'source-over';
    _ctxUnion.clearRect(0, 0, _vpW, _vpH);
    _ctxUnion.fillStyle = _fillStyle;
    for (const shape of shapes) {
      _ctxUnion.beginPath();
      addShapePath(_ctxUnion, shape);
      _ctxUnion.fill();
    }

    // ── Pass 3: Remove odd-overlap regions ──────────────────────────────────
    // 'destination-out' erases destination pixels wherever the source is opaque.
    // The XOR canvas is opaque exactly where odd overlaps exist, so this step
    // cuts out those regions, leaving only even-count (≥ 2) areas visible.
    _ctxUnion.globalCompositeOperation = 'destination-out';
    _ctxUnion.drawImage(_ocXor, 0, 0);

    // ── Blit result onto main canvas ────────────────────────────────────────
    ctx.save();
    ctx.drawImage(_ocUnion, 0, 0);
    ctx.restore();
  }

  // ─── Reset ───────────────────────────────────────────────────────────────

  /** Reset effect state so it reinitializes cleanly on next update(). */
  function reset() {
    shapes        = null;
    lastTimestamp = null;
    lastNudgeTime = 0;
    _vpW          = 0;
    _vpH          = 0;
    _ocXor        = null;
    _ctxXor       = null;
    _ocUnion      = null;
    _ctxUnion     = null;
  }

  return { update, draw, reset };
}
