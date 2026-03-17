/**
 * SubstrateEffect
 *
 * Ambient background effect for Chapter 6.
 * Renders the "Substrate" crystalline crack pattern, inspired by the classic
 * XScreenSaver "Substrate" by J. Tarbell (2004).  Crystalline lines grow
 * across a dark canvas following a simple perpendicular growth rule that
 * creates intricate city-like structures.  The regions between cracks fill
 * with soft pastel sand grains.  The pattern resets and regrows periodically.
 *
 * Behaviour summary
 * -----------------
 * • A flat grid (cgrid) tracks which angle a crack passed through each pixel.
 * • INITIAL_CRACKS seed cracks start at random positions and angles.
 * • Each crack advances pixel-by-pixel in its direction:
 *     – When it reaches another crack it stops and spawns a new crack
 *       perpendicular (±90°) to the one it hit.
 *     – While growing it scatters soft pastel sand grains perpendicular to
 *       its own direction, gradually filling the region between cracks.
 * • The whole pattern is rendered to a persistent off-screen canvas and
 *   composited onto the main canvas each frame at low opacity.
 * • After CYCLE_DURATION_MS the canvas clears and a new pattern grows.
 *
 * Colors: light pastel shades (sky blue, dusty rose, warm sand, lavender,
 * mint, near-white) on the near-black Chapter 6 background.
 * All positions are in logical CSS pixel screen-space.
 */

// ─── Tuning constants ─────────────────────────────────────────────────────────

// Number of seed cracks placed at initialisation.
const INITIAL_CRACKS = 5;

// Maximum simultaneously active crack tips.
const MAX_CRACKS = 50;

// Crack growth speed (CSS pixels per second per crack).
const CRACK_SPEED = 80;

// Probability [0,1] that a stopped crack spawns a new perpendicular crack.
const SPAWN_PROB = 0.55;

// Number of sand grains scattered per travelled pixel.
const SAND_GRAINS = 10;

// Half-width of the sand scatter band (px), perpendicular to crack direction.
const SAND_WIDTH = 50;

// Maximum alpha for a single sand grain (grains are composited many times).
const SAND_MAX_ALPHA = 0.16;

// Crack line rendering: alpha.
const CRACK_ALPHA = 0.88;

// How long one full growth cycle lasts before resetting (ms).
const CYCLE_DURATION_MS = 35000;

// Duration of the fade-in at the start of each cycle (ms).
const FADE_IN_MS = 2500;

// Grid sentinel value – means "no crack has passed through this cell".
const GRID_EMPTY = -10001;

// ─── Color palette ────────────────────────────────────────────────────────────

// Light pastel hues for the sand grains (RGB, 0–255).
// Chosen to be visible against Chapter 6's near-black background.
const SAND_PALETTE = [
  { r: 185, g: 215, b: 235 }, // Soft sky blue
  { r: 235, g: 205, b: 198 }, // Dusty rose
  { r: 230, g: 222, b: 185 }, // Warm sandy yellow
  { r: 210, g: 196, b: 232 }, // Lavender
  { r: 187, g: 225, b: 212 }, // Soft mint
  { r: 228, g: 222, b: 222 }, // Near-white warm grey
];

function _randomSandColor() {
  return SAND_PALETTE[Math.floor(Math.random() * SAND_PALETTE.length)];
}

// ─── Crack factory ────────────────────────────────────────────────────────────

function _createCrack(x, y, angle) {
  const col = _randomSandColor();
  return {
    x,
    y,
    angle,
    alive: true,
    // The sand color assigned to this crack's region.
    sandR: col.r,
    sandG: col.g,
    sandB: col.b,
    // Integer grid cell of the last recorded position (avoids immediate
    // self-collision when sub-pixel movement stays in the same cell).
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
  // Off-screen canvas accumulates the crack pattern over time.
  let offCanvas = null;
  let offCtx    = null;

  // Angle grid: cgrid[y * W + x] = crack angle at that pixel, or GRID_EMPTY.
  let cgrid = null;

  let W = 0;
  let H = 0;

  let cracks      = [];

  let lastTs       = null;
  let cycleStartMs = null;

  // Current draw-time compositing alpha (0 → 1, fades in at cycle start).
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

    // Initialise the angle grid with the sentinel.
    cgrid = new Float32Array(W * H);
    cgrid.fill(GRID_EMPTY);

    cracks       = [];

    for (let i = 0; i < INITIAL_CRACKS; i++) {
      _spawnRandom();
    }
  }

  // ── Crack spawning ────────────────────────────────────────────────────────

  function _spawnRandom() {
    if (cracks.length >= MAX_CRACKS) return;
    const x     = 10 + Math.random() * (W - 20);
    const y     = 10 + Math.random() * (H - 20);
    const angle = Math.random() * Math.PI * 2;
    cracks.push(_createCrack(x, y, angle));
  }

  function _spawnPerp(xi, yi, hitAngle) {
    if (cracks.length >= MAX_CRACKS) return;
    // New crack runs perpendicular to the crack it collided with.
    const perp  = hitAngle + (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    // Offset a couple of pixels along the new direction so the crack doesn't
    // immediately re-collide with the crack that stopped it.
    const ox = xi + Math.cos(perp) * 2;
    const oy = yi + Math.sin(perp) * 2;
    if (ox < 0 || ox >= W || oy < 0 || oy >= H) return;
    cracks.push(_createCrack(ox, oy, perp));
  }

  // ── Crack simulation ──────────────────────────────────────────────────────

  /**
   * Advance a single crack by `steps` pixels.
   */
  function _stepCrack(crack, steps) {
    const dx = Math.cos(crack.angle);
    const dy = Math.sin(crack.angle);

    for (let s = 0; s < steps; s++) {
      crack.x += dx;
      crack.y += dy;

      const xi = Math.round(crack.x);
      const yi = Math.round(crack.y);

      // Out of viewport → kill.
      if (xi < 0 || xi >= W || yi < 0 || yi >= H) {
        crack.alive = false;
        return;
      }

      // Skip if this integer cell hasn't changed since the last step.
      // This prevents the crack from colliding with its own very-recent trail
      // when sub-pixel movement keeps it inside the same grid cell.
      if (xi === crack.lastGx && yi === crack.lastGy) continue;

      crack.lastGx = xi;
      crack.lastGy = yi;

      const idx = yi * W + xi;

      // Hit an existing crack → stop and possibly spawn a perpendicular one.
      if (cgrid[idx] !== GRID_EMPTY) {
        crack.alive = false;
        if (Math.random() < SPAWN_PROB) {
          _spawnPerp(xi, yi, cgrid[idx]);
        }
        return;
      }

      // Record this crack's angle in the grid.
      cgrid[idx] = crack.angle;

      // Draw the crack pixel on the off-screen canvas.
      _drawCrackPixel(crack.x, crack.y);

      // Scatter sand grains perpendicular to the crack direction.
      _drawSandGrains(crack.x, crack.y, crack.angle, crack.sandR, crack.sandG, crack.sandB);
    }
  }

  // ── Off-screen canvas drawing ─────────────────────────────────────────────

  function _drawCrackPixel(x, y) {
    // Thin warm-white crack line.
    offCtx.fillStyle = `rgba(228,220,208,${CRACK_ALPHA})`;
    offCtx.fillRect(x - 0.5, y - 0.5, 1, 1);
  }

  function _drawSandGrains(cx, cy, angle, r, g, b) {
    // Perpendicular direction to the crack.
    const px = -Math.sin(angle);
    const py =  Math.cos(angle);

    for (let i = 0; i < SAND_GRAINS; i++) {
      // Random offset along the perpendicular direction.
      const t     = (Math.random() * 2 - 1) * SAND_WIDTH;
      const gx    = cx + px * t;
      const gy    = cy + py * t;

      // Skip out-of-bounds grains.
      if (gx < 0 || gx >= W || gy < 0 || gy >= H) continue;

      // Alpha falls off smoothly toward the edges of the band.
      const fade  = 1 - Math.abs(t) / SAND_WIDTH;
      const alpha = SAND_MAX_ALPHA * fade * (0.4 + Math.random() * 0.6);

      offCtx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(4)})`;
      offCtx.fillRect(gx, gy, 1, 1);
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────

  function update(now, w, h) {
    const needsInit = !offCanvas || W !== Math.ceil(w) || H !== Math.ceil(h);
    if (needsInit) {
      _init(w, h);
      cycleStartMs   = now;
      compositeAlpha = 0;
      lastTs         = null;
    }

    if (cycleStartMs === null) cycleStartMs = now;

    const dt     = lastTs === null ? 0.016 : Math.min((now - lastTs) / 1000, 0.1);
    lastTs        = now;

    // Fade in at the start of the cycle.
    const cycleAge = now - cycleStartMs;
    compositeAlpha  = Math.min(1, cycleAge / FADE_IN_MS);

    // Reset once the cycle duration has elapsed.
    if (cycleAge >= CYCLE_DURATION_MS) {
      offCtx.clearRect(0, 0, W, H);
      cgrid.fill(GRID_EMPTY);
      cracks       = [];
      cycleStartMs = now;
      compositeAlpha = 0;
      for (let i = 0; i < INITIAL_CRACKS; i++) {
        _spawnRandom();
      }
      return;
    }

    // Pixels each crack advances this frame (at least 1 to stay alive).
    const steps = Math.max(1, Math.round(CRACK_SPEED * dt));

    for (const crack of cracks) {
      if (crack.alive) _stepCrack(crack, steps);
    }

    // Remove dead cracks.
    for (let i = cracks.length - 1; i >= 0; i--) {
      if (!cracks[i].alive) cracks.splice(i, 1);
    }

    // Re-seed if no active cracks remain (the grid may still have room).
    while (cracks.length < INITIAL_CRACKS && cracks.length < MAX_CRACKS) {
      _spawnRandom();
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  /**
   * Composite the accumulated substrate pattern onto the main canvas.
   * @param {CanvasRenderingContext2D} ctx  Already in CSS-pixel space.
   */
  function draw(ctx) {
    if (!offCanvas || compositeAlpha <= 0) return;

    ctx.save();
    // Overall effect opacity: fade in gently; cap at 0.75 to keep it subtle.
    ctx.globalAlpha = compositeAlpha * 0.75;
    ctx.drawImage(offCanvas, 0, 0);
    ctx.restore();
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function reset() {
    offCanvas      = null;
    offCtx         = null;
    cgrid          = null;
    cracks         = [];
    W              = 0;
    H              = 0;
    lastTs         = null;
    cycleStartMs   = null;
    compositeAlpha = 0;
  }

  return { update, draw, reset };
}
