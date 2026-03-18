/**
 * GravityGridEffect
 *
 * Ambient background effect for Prologue and Chapter 2.
 * A faint grid overlays the playing field, warped by gravity wells (inward)
 * and white holes (outward).  Three floating balls—two small gravity-wells and
 * one large white-hole—drift and interact with game entities (towers, enemies,
 * gates), which also warp the grid inward.
 *
 * Visual style
 * ------------
 * • Grid: thin white lines at 10 % opacity at rest; shift toward gold at 20 %
 *   opacity as gravitational displacement increases.
 * • Balls: cached radial-gradient glowing circles at 20 % opacity.
 * • Explosion particles: small glowing dots that burst outward on collision.
 *
 * Physics
 * -------
 * • Gravity wells attract grid points and balls toward them.
 * • White holes push grid points and balls away from them.
 * • Balls enforce a minimum velocity so they never stop.
 * • Collisions (ball–ball or ball–entity) trigger a particle burst and
 *   delayed respawn from a random viewport edge.
 *
 * Performance
 * -----------
 * • Ball glow sprites are cached as offscreen canvases (no per-frame gradients).
 * • Grid line segments are batched by warp-intensity palette index, yielding
 *   at most WARP_PALETTE_SIZE draw calls for the entire grid.
 * • Grid displacement uses a squared-distance cutoff to skip distant sources.
 */

// ─── Grid tuning ──────────────────────────────────────────────────────────────

/** Spacing between grid intersections (CSS px). */
const GRID_SPACING = 40;

/** Grid line width (CSS px). */
const GRID_LINE_WIDTH = 0.7;

/** Grid alpha at rest (no warp). */
const GRID_BASE_ALPHA = 0.10;

/** Grid alpha at maximum warp. */
const GRID_WARP_MAX_ALPHA = 0.20;

/** Displacement magnitude (px) at which warp colour / alpha reaches maximum. */
const GRID_WARP_CEILING = 18;

// Base colour (white) and fully-warped colour (gold).
const BASE_R = 255, BASE_G = 255, BASE_B = 255;
const WARP_R = 255, WARP_G = 215, WARP_B = 100;

/** Number of pre-computed palette entries for batched grid drawing. */
const WARP_PALETTE_SIZE = 16;

// ─── Ball tuning ──────────────────────────────────────────────────────────────

/** Radius of the two small gravity-well balls (CSS px). */
const SMALL_BALL_RADIUS = 12;

/** Radius of the large white-hole ball (CSS px). */
const LARGE_BALL_RADIUS = 25;

/** Global alpha when stamping ball glow sprites. */
const BALL_GLOW_ALPHA = 0.20;

/** Sprite extends this factor beyond the ball radius for soft glow falloff. */
const BALL_SPRITE_SCALE = 1.6;

// ─── Physics tuning ──────────────────────────────────────────────────────────

/** Minimum ball speed (px / s).  Prevents stalling. */
const MIN_SPEED = 20;

/** Maximum ball speed (px / s).  Caps runaway acceleration. */
const MAX_SPEED = 150;

/** Speed range for newly spawned balls (px / s). */
const SPAWN_SPEED_MIN = 30;
const SPAWN_SPEED_MAX = 60;

/** Gravitational constant for ball-to-ball and entity-to-ball forces. */
const GRAVITY_CONST = 8000;

/** Grid warp strength multiplier. */
const GRID_WARP_CONST = 12;

/** Softening term added to r² to prevent singularities (≈ 30²). */
const WARP_SOFTENING = 900;

/** Skip grid warp calculations beyond this distance (px). */
const WARP_CUTOFF = 200;
const WARP_CUTOFF_SQ = WARP_CUTOFF * WARP_CUTOFF;

// ─── Collision & respawn ──────────────────────────────────────────────────────

/** Extra px beyond the sum of radii that still counts as a collision. */
const COLLISION_TOLERANCE = 4;

/** Seconds before a destroyed ball respawns (uniform random in this range). */
const RESPAWN_MIN_SEC = 5;
const RESPAWN_MAX_SEC = 10;

// ─── Explosion particles ──────────────────────────────────────────────────────

/** Number of particles per explosion. */
const PARTICLE_COUNT = 12;
const PARTICLE_SPEED_MIN = 40;
const PARTICLE_SPEED_MAX = 100;

/** Particle lifetime in seconds. */
const PARTICLE_LIFE_SEC = 1.5;

/** Base alpha for explosion particles (fades out over lifetime). */
const PARTICLE_ALPHA = 0.60;

// ─── Entity masses (for force and grid-warp calculations) ─────────────────────

const SMALL_BALL_MASS = 1.5;
const LARGE_BALL_MASS = 3.0;

// ─── Shared constants ─────────────────────────────────────────────────────────

const TWO_PI = Math.PI * 2;

// ─── Pre-computed warp colour palette ─────────────────────────────────────────
// Built once at module load.  Index 0 → rest colour, last index → full warp.

const _warpPalette = [];
for (let i = 0; i < WARP_PALETTE_SIZE; i++) {
  const t = i / (WARP_PALETTE_SIZE - 1);
  const a = GRID_BASE_ALPHA + (GRID_WARP_MAX_ALPHA - GRID_BASE_ALPHA) * t;
  const r = Math.round(BASE_R + (WARP_R - BASE_R) * t);
  const g = Math.round(BASE_G + (WARP_G - BASE_G) * t);
  const b = Math.round(BASE_B + (WARP_B - BASE_B) * t);
  _warpPalette.push(`rgba(${r},${g},${b},${a.toFixed(3)})`);
}

// ─── Cached sprite helpers ────────────────────────────────────────────────────

/**
 * Pre-render a radial-gradient glowing circle as an offscreen canvas sprite.
 * Stamped via drawImage() each frame instead of recreating radialGradient objects.
 *
 * @param {number} radius  Visual radius of the ball.
 * @param {number} r       Red   (0–255).
 * @param {number} g       Green (0–255).
 * @param {number} b       Blue  (0–255).
 * @returns {HTMLCanvasElement}
 */
function _createGlowSprite(radius, r, g, b) {
  const extent = Math.ceil(radius * BALL_SPRITE_SCALE);
  const size   = extent * 2;
  const oc     = document.createElement('canvas');
  oc.width     = size;
  oc.height    = size;
  const c      = oc.getContext('2d');
  const cx     = extent;
  const cy     = extent;

  const grad = c.createRadialGradient(cx, cy, 0, cx, cy, extent);
  grad.addColorStop(0,    'rgba(255,255,255,1)');
  grad.addColorStop(0.15, `rgba(${r},${g},${b},0.9)`);
  grad.addColorStop(0.40, `rgba(${r},${g},${b},0.4)`);
  grad.addColorStop(0.70, `rgba(${r},${g},${b},0.15)`);
  grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);

  c.fillStyle = grad;
  c.beginPath();
  c.arc(cx, cy, extent, 0, TWO_PI);
  c.fill();
  return oc;
}

// ─── Ball factory ─────────────────────────────────────────────────────────────

/**
 * Create a ball that enters from a random viewport edge.
 *
 * @param {'gravity'|'whitehole'} type
 * @param {number} W  Viewport width (CSS px).
 * @param {number} H  Viewport height (CSS px).
 * @returns {Object}
 */
function _spawnBallFromEdge(type, W, H) {
  const radius = type === 'gravity' ? SMALL_BALL_RADIUS : LARGE_BALL_RADIUS;
  const speed  = SPAWN_SPEED_MIN + Math.random() * (SPAWN_SPEED_MAX - SPAWN_SPEED_MIN);
  // ±30° from the inward-facing normal of the chosen edge.
  const spread = Math.random() * Math.PI * 0.6 - Math.PI * 0.3;
  const edge   = Math.floor(Math.random() * 4);

  let x, y, vx, vy;
  switch (edge) {
    case 0: // top edge
      x  =  Math.random() * W;
      y  = -radius;
      vx =  Math.sin(spread) * speed;
      vy =  Math.abs(Math.cos(spread)) * speed;
      break;
    case 1: // right edge
      x  =  W + radius;
      y  =  Math.random() * H;
      vx = -Math.abs(Math.cos(spread)) * speed;
      vy =  Math.sin(spread) * speed;
      break;
    case 2: // bottom edge
      x  =  Math.random() * W;
      y  =  H + radius;
      vx =  Math.sin(spread) * speed;
      vy = -Math.abs(Math.cos(spread)) * speed;
      break;
    default: // left edge
      x  = -radius;
      y  =  Math.random() * H;
      vx =  Math.abs(Math.cos(spread)) * speed;
      vy =  Math.sin(spread) * speed;
      break;
  }

  return {
    x, y, vx, vy,
    radius,
    mass:  type === 'gravity' ? SMALL_BALL_MASS : LARGE_BALL_MASS,
    type,
    alive: true,
    respawnTimer: 0,
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create and return a Gravity Grid effect controller.
 *
 * @returns {{ update: Function, draw: Function, reset: Function }}
 */
export function createGravityGridEffect() {
  /** Three balls: [gravity, gravity, whitehole]. */
  let balls      = [];
  /** Explosion particle pool. */
  let particles  = [];
  let lastTs     = null;
  let _viewW     = 0;
  let _viewH     = 0;
  let _gridCols  = 0;
  let _gridRows  = 0;

  // Cached glow sprites (lazy-created).
  let _smallSprite    = null;
  let _largeSprite    = null;
  let _particleSprite = null;

  // All gravity / repulsion sources for the current frame (set in update, read in draw).
  let _frameSources = [];

  // Re-usable Float64Array for grid point calculations (avoids per-frame allocation).
  let _gridBuf     = null;
  let _gridBufSize = 0;

  // ── Sprite cache ──────────────────────────────────────────────────────────

  function _ensureSprites() {
    if (_smallSprite) return;
    _smallSprite    = _createGlowSprite(SMALL_BALL_RADIUS, 200, 220, 255); // pale blue
    _largeSprite    = _createGlowSprite(LARGE_BALL_RADIUS, 255, 235, 200); // warm white
    _particleSprite = _createGlowSprite(5, 255, 245, 220);                 // warm dot
  }

  // ── Initialisation ────────────────────────────────────────────────────────

  function _init(W, H) {
    balls = [
      _spawnBallFromEdge('gravity',   W, H),
      _spawnBallFromEdge('gravity',   W, H),
      _spawnBallFromEdge('whitehole', W, H),
    ];
    // Place balls inside the viewport for immediate visibility on first load.
    for (const b of balls) {
      b.x = W * 0.15 + Math.random() * W * 0.7;
      b.y = H * 0.15 + Math.random() * H * 0.7;
    }
    particles = [];
    lastTs    = null;
    _gridCols = Math.floor(W / GRID_SPACING) + 2;
    _gridRows = Math.floor(H / GRID_SPACING) + 2;
  }

  // ── Ball explosion ────────────────────────────────────────────────────────

  function _explode(ball) {
    ball.alive = false;
    ball.respawnTimer =
      RESPAWN_MIN_SEC + Math.random() * (RESPAWN_MAX_SEC - RESPAWN_MIN_SEC);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = TWO_PI * i / PARTICLE_COUNT + (Math.random() - 0.5) * 0.4;
      const speed =
        PARTICLE_SPEED_MIN + Math.random() * (PARTICLE_SPEED_MAX - PARTICLE_SPEED_MIN);
      particles.push({
        x: ball.x,
        y: ball.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life:    PARTICLE_LIFE_SEC,
        maxLife: PARTICLE_LIFE_SEC,
      });
    }
  }

  // ── Velocity clamping ─────────────────────────────────────────────────────

  function _clampSpeed(ball) {
    const spd = Math.hypot(ball.vx, ball.vy);
    if (spd < MIN_SPEED) {
      if (spd < 0.001) {
        const a = Math.random() * TWO_PI;
        ball.vx = Math.cos(a) * MIN_SPEED;
        ball.vy = Math.sin(a) * MIN_SPEED;
      } else {
        const s = MIN_SPEED / spd;
        ball.vx *= s;
        ball.vy *= s;
      }
    } else if (spd > MAX_SPEED) {
      const s = MAX_SPEED / spd;
      ball.vx *= s;
      ball.vy *= s;
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────

  /**
   * Advance the simulation by one frame.
   *
   * @param {number} nowMs            High-resolution timestamp (ms).
   * @param {number} W                Viewport width in CSS px.
   * @param {number} H                Viewport height in CSS px.
   * @param {Array}  externalSources  Gravity-well entities from the game state:
   *   `[{ x, y, mass, radius }]` – towers, enemies, gates (all inward wells).
   */
  function update(nowMs, W, H, externalSources) {
    const sizeChanged =
      !balls.length ||
      Math.abs(W - _viewW) > 100 ||
      Math.abs(H - _viewH) > 100;
    _viewW = W;
    _viewH = H;
    if (sizeChanged) _init(W, H);
    _ensureSprites();

    _gridCols = Math.floor(W / GRID_SPACING) + 2;
    _gridRows = Math.floor(H / GRID_SPACING) + 2;

    const dt = lastTs === null ? 0.016 : Math.min((nowMs - lastTs) / 1000, 0.1);
    lastTs = nowMs;

    // ── Build unified source list (balls + external entities) ───────────
    const allSources = [];
    for (const b of balls) {
      if (b.alive) {
        allSources.push({
          x: b.x, y: b.y, mass: b.mass,
          radius: b.radius, type: b.type, _ball: b,
        });
      }
    }
    if (externalSources) {
      for (let i = 0; i < externalSources.length; i++) {
        const s = externalSources[i];
        allSources.push({
          x: s.x, y: s.y,
          mass: s.mass || 1,
          radius: s.radius || 10,
          type: 'gravity',
          _ball: null,
        });
      }
    }
    _frameSources = allSources;

    // ── Apply gravitational forces to each alive ball ───────────────────
    for (const ball of balls) {
      if (!ball.alive) continue;
      let ax = 0, ay = 0;

      for (let si = 0; si < allSources.length; si++) {
        const src = allSources[si];
        if (src._ball === ball) continue; // skip self
        const dx   = src.x - ball.x;
        const dy   = src.y - ball.y;
        const dSq  = dx * dx + dy * dy;
        if (dSq < 1) continue;
        const dist = Math.sqrt(dSq);
        const f    = GRAVITY_CONST * src.mass / (dSq + WARP_SOFTENING);
        // Gravity wells attract (+1), white holes repel (-1).
        const sign = src.type === 'gravity' ? 1 : -1;
        ax += sign * (dx / dist) * f;
        ay += sign * (dy / dist) * f;
      }

      ball.vx += ax * dt;
      ball.vy += ay * dt;
      _clampSpeed(ball);
      ball.x  += ball.vx * dt;
      ball.y  += ball.vy * dt;

      // Soft edge bounce – keep balls near the viewport.
      const margin = ball.radius * 3;
      if (ball.x < -margin)    { ball.x = -margin;    ball.vx =  Math.abs(ball.vx); }
      if (ball.x > W + margin) { ball.x = W + margin; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < -margin)    { ball.y = -margin;    ball.vy =  Math.abs(ball.vy); }
      if (ball.y > H + margin) { ball.y = H + margin; ball.vy = -Math.abs(ball.vy); }
    }

    // ── Ball–ball collisions ────────────────────────────────────────────
    for (let i = 0; i < balls.length; i++) {
      if (!balls[i].alive) continue;
      for (let j = i + 1; j < balls.length; j++) {
        if (!balls[j].alive) continue;
        const d = Math.hypot(balls[i].x - balls[j].x, balls[i].y - balls[j].y);
        if (d < balls[i].radius + balls[j].radius + COLLISION_TOLERANCE) {
          _explode(balls[i]);
          _explode(balls[j]);
        }
      }
    }

    // ── Ball–entity collisions ──────────────────────────────────────────
    if (externalSources) {
      for (const ball of balls) {
        if (!ball.alive) continue;
        for (let ei = 0; ei < externalSources.length; ei++) {
          const src = externalSources[ei];
          const d   = Math.hypot(ball.x - src.x, ball.y - src.y);
          if (d < ball.radius + (src.radius || 10) + COLLISION_TOLERANCE) {
            _explode(ball);
            break;
          }
        }
      }
    }

    // ── Respawn timers ──────────────────────────────────────────────────
    for (const ball of balls) {
      if (ball.alive) continue;
      ball.respawnTimer -= dt;
      if (ball.respawnTimer <= 0) {
        const fresh     = _spawnBallFromEdge(ball.type, W, H);
        ball.x          = fresh.x;
        ball.y          = fresh.y;
        ball.vx         = fresh.vx;
        ball.vy         = fresh.vy;
        ball.alive       = true;
        ball.respawnTimer = 0;
      }
    }

    // ── Update explosion particles ──────────────────────────────────────
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      // Gentle drag so particles decelerate naturally.
      p.vx *= 0.97;
      p.vy *= 0.97;
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────

  /**
   * Render the grid, balls, and explosion particles.
   * @param {CanvasRenderingContext2D} ctx  Already in CSS-pixel screen space.
   */
  function draw(ctx) {
    if (!_viewW || !_viewH) return;
    ctx.save();
    _drawGrid(ctx);
    _drawBalls(ctx);
    _drawParticles(ctx);
    ctx.restore();
  }

  // ── Grid rendering ────────────────────────────────────────────────────────

  function _drawGrid(ctx) {
    const cols    = _gridCols;
    const rows    = _gridRows;
    const sources = _frameSources;

    // Ensure the re-usable buffer is large enough.
    const needed = cols * rows * 3; // x, y, warpIntensity per point
    if (!_gridBuf || _gridBufSize < needed) {
      _gridBuf     = new Float64Array(needed);
      _gridBufSize = needed;
    }
    const pts = _gridBuf;

    // Calculate displaced positions and warp intensity per grid intersection.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rx = c * GRID_SPACING;
        const ry = r * GRID_SPACING;
        let dx = 0, dy = 0;

        for (let si = 0; si < sources.length; si++) {
          const src = sources[si];
          const sx  = src.x - rx;
          const sy  = src.y - ry;
          const dSq = sx * sx + sy * sy;
          if (dSq > WARP_CUTOFF_SQ) continue;
          const d = Math.sqrt(dSq);
          if (d < 0.01) continue;
          const mag  = GRID_WARP_CONST * src.mass / (dSq + WARP_SOFTENING);
          const sign = src.type === 'gravity' ? 1 : -1;
          dx += sign * (sx / d) * mag;
          dy += sign * (sy / d) * mag;
        }

        const idx     = (r * cols + c) * 3;
        pts[idx]      = rx + dx;
        pts[idx + 1]  = ry + dy;
        pts[idx + 2]  = Math.min(1, Math.hypot(dx, dy) / GRID_WARP_CEILING);
      }
    }

    // Batch line segments by their palette index for efficient drawing.
    const batches = new Array(WARP_PALETTE_SIZE);
    for (let i = 0; i < WARP_PALETTE_SIZE; i++) batches[i] = [];

    // Horizontal segments.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const i1 = (r * cols + c) * 3;
        const i2 = (r * cols + c + 1) * 3;
        const w  = (pts[i1 + 2] + pts[i2 + 2]) * 0.5;
        const pi = Math.min(WARP_PALETTE_SIZE - 1, Math.floor(w * WARP_PALETTE_SIZE));
        batches[pi].push(pts[i1], pts[i1 + 1], pts[i2], pts[i2 + 1]);
      }
    }

    // Vertical segments.
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows - 1; r++) {
        const i1 = (r * cols + c) * 3;
        const i2 = ((r + 1) * cols + c) * 3;
        const w  = (pts[i1 + 2] + pts[i2 + 2]) * 0.5;
        const pi = Math.min(WARP_PALETTE_SIZE - 1, Math.floor(w * WARP_PALETTE_SIZE));
        batches[pi].push(pts[i1], pts[i1 + 1], pts[i2], pts[i2 + 1]);
      }
    }

    // Stroke each palette batch.
    ctx.lineWidth = GRID_LINE_WIDTH;
    ctx.lineCap   = 'round';
    for (let i = 0; i < WARP_PALETTE_SIZE; i++) {
      const segs = batches[i];
      if (!segs.length) continue;
      ctx.strokeStyle = _warpPalette[i];
      ctx.beginPath();
      for (let j = 0; j < segs.length; j += 4) {
        ctx.moveTo(segs[j], segs[j + 1]);
        ctx.lineTo(segs[j + 2], segs[j + 3]);
      }
      ctx.stroke();
    }
  }

  // ── Ball rendering ────────────────────────────────────────────────────────

  function _drawBalls(ctx) {
    for (const ball of balls) {
      if (!ball.alive) continue;
      const sprite = ball.type === 'gravity' ? _smallSprite : _largeSprite;
      if (!sprite) continue;
      ctx.save();
      ctx.globalAlpha = BALL_GLOW_ALPHA;
      ctx.drawImage(sprite, ball.x - sprite.width * 0.5, ball.y - sprite.height * 0.5);
      ctx.restore();
    }
  }

  // ── Particle rendering ────────────────────────────────────────────────────

  function _drawParticles(ctx) {
    if (!particles.length || !_particleSprite) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const hw = _particleSprite.width  * 0.5;
    const hh = _particleSprite.height * 0.5;
    for (const p of particles) {
      const fade = p.life / p.maxLife;
      ctx.globalAlpha = PARTICLE_ALPHA * fade;
      ctx.drawImage(_particleSprite, p.x - hw, p.y - hh);
    }
    ctx.restore();
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  /** Clear all state so the effect re-initialises on next update(). */
  function reset() {
    balls         = [];
    particles     = [];
    lastTs        = null;
    _viewW        = 0;
    _viewH        = 0;
    _frameSources = [];
  }

  return { update, draw, reset };
}
