/**
 * EulerFluidEffect
 *
 * Chapter 3 ambient background effect.
 * Tracer particles advect through an analytically-defined velocity field
 * inspired by the "Euler 2D" XScreenSaver (Stephen Montgomery-Smith, 2002),
 * which simulates two-dimensional incompressible inviscid fluid flow.
 *
 * The velocity field is composed of four analytical contributions, plus a
 * fifth particle-interaction pass:
 *  1. Path-channel current  – a Gaussian-weighted flow aligned with each
 *     level-path segment, creating a river-like current along the route.
 *  2. Mind Gate CW vortex   – a clockwise point vortex centred on the path
 *     endpoint (the Mind Gate), drawing tracers in a tightening spiral as
 *     they "enter the mind".
 *  3. Shadow Gate CCW vortex – a counter-clockwise vortex at the path start
 *     (the Shadow Gate), spinning tracers outward as they emerge.
 *  4. Tower obstacles        – soft radial repulsion around each tower so the
 *     flow appears to part around solid objects.
 *  5. Inter-particle repulsion – a gentle linear-falloff nudge between
 *     nearby particles, preventing them from bunching at edges or vortex
 *     centres.
 *
 * Visualised as short colour trails at ≈ 20 % peak opacity, using a
 * blue-to-violet palette that harmonises with the Chapter 3 deep-purple
 * background.
 */

// ─── Simulation tuning ───────────────────────────────────────────────────────

/** Number of tracer particles. */
const PARTICLE_COUNT = 210;

/** Maximum trail length (number of recorded positions per particle). */
const TRAIL_LENGTH = 28;

/** Peak opacity at the newest trail-tip. */
const TRAIL_HEAD_ALPHA = 0.22;

/** Trail line width (world px). */
const TRAIL_LINE_WIDTH = 1.3;

/** Gaussian σ for path-channel lateral falloff (world px). */
const PATH_SIGMA = 68;

/** Path-channel speed (world px / s). */
const PATH_SPEED = 85;

/** Mind Gate vortex circulation strength Γ (world px² / s).  Clockwise. */
const MIND_GAMMA = 7200;

/** Shadow Gate vortex circulation strength Γ (world px² / s).  CCW. */
const SHADOW_GAMMA = 6000;

/** Vortex core-radius (px) – prevents infinite velocity at the vortex centre. */
const VORTEX_CORE = 34;

/** Tower obstacle influence radius (world px). */
const TOWER_OBSTACLE_R = 54;

/** Tower obstacle repulsion coefficient. */
const TOWER_OBSTACLE_K = 2200;

/** Inter-particle repulsion radius (world px).  Particles closer than this
 *  nudge each other apart, preventing clumping at edges and vortex centres. */
const PARTICLE_REPEL_R = 24;

/** Inter-particle repulsion coefficient (world px / s).  The force uses a
 *  linear falloff: strongest at zero separation, zero at PARTICLE_REPEL_R. */
const PARTICLE_REPEL_K = 600;

// Precomputed squared repulsion radius.
const PARTICLE_REPEL_R_SQ = PARTICLE_REPEL_R * PARTICLE_REPEL_R;

/** Maximum particle speed cap (world px / s). */
const MAX_SPEED = 160;

/** Particles slower than this (px / s) are respawned. */
const RESPAWN_SLOW_THRESHOLD = 7;

/**
 * Out-of-bounds margin (world px) beyond the viewport edges at which a
 * particle is respawned.  A positive margin lets trails drift slightly off
 * screen before being recycled, avoiding abrupt pop-in near the edges.
 */
const RESPAWN_OOB_MARGIN = 180;

/**
 * Minimum fractional change in viewport size (0–1) that triggers a full
 * particle re-initialisation.  Using a relative threshold avoids spurious
 * resets on large viewports from tiny sub-pixel jitter.
 */
const RESIZE_THRESHOLD_FRACTION = 0.08;

// Precomputed 2σ² for path-channel Gaussian falloff.
const PATH_TWO_SIGMA_SQ = 2 * PATH_SIGMA * PATH_SIGMA;

// ─── Colour palette ───────────────────────────────────────────────────────────

// Seven hues spanning the blue-to-violet range that matches Chapter 3.
const HUES = [190, 210, 232, 252, 272, 292, 314];

/** Number of alpha buckets used when batching draw calls. */
const ALPHA_BUCKETS = 5;

// Pre-allocated per-(hue × bucket) segment arrays for efficient batched drawing.
// Each inner array stores flat [x1, y1, x2, y2, …] pairs.
const _drawBatches = HUES.map(() =>
  new Array(ALPHA_BUCKETS).fill(null).map(() => [])
);

// ─── Math helper ─────────────────────────────────────────────────────────────

/** Clamp n to the closed interval [lo, hi]. */
function _clamp(n, lo, hi) {
  return n < lo ? lo : n > hi ? hi : n;
}

// ─── Path segment pre-computation ────────────────────────────────────────────

/**
 * Convert an array of path waypoints into pre-computed segment records so
 * the path-channel current can be evaluated quickly at arbitrary points.
 *
 * @param {Array<{x:number,y:number}>} pts  Level waypoints.
 * @returns {Array<{x0:number,y0:number,dx:number,dy:number,nx:number,ny:number,lenSq:number}>}
 */
function _buildSegments(pts) {
  const segs = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const x0   = pts[i].x;
    const y0   = pts[i].y;
    const dx   = pts[i + 1].x - x0;
    const dy   = pts[i + 1].y - y0;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1) continue;
    const len = Math.sqrt(lenSq);
    segs.push({ x0, y0, dx, dy, nx: dx / len, ny: dy / len, lenSq });
  }
  return segs;
}

// ─── Velocity field ───────────────────────────────────────────────────────────

/**
 * Sample the combined analytical velocity field at world-space point (x, y).
 *
 * All four field contributions are summed and the result is clamped to
 * {@link MAX_SPEED}.
 *
 * @param {number} x
 * @param {number} y
 * @param {Array}  segs        Pre-computed path segments.
 * @param {{x:number,y:number}|null} mindGate    Path end   (CW sink).
 * @param {{x:number,y:number}|null} shadowGate  Path start (CCW source).
 * @param {Array<{x:number,y:number}>} towers    Tower world positions.
 * @returns {{vx:number,vy:number}}
 */
function _sampleVelocity(x, y, segs, mindGate, shadowGate, towers) {
  let vx = 0;
  let vy = 0;
  const coreSq = VORTEX_CORE * VORTEX_CORE;

  // 1. Path-channel current (Gaussian-weighted along each path segment) ──────
  for (let i = 0; i < segs.length; i++) {
    const s   = segs[i];
    const rx  = x - s.x0;
    const ry  = y - s.y0;
    // Parametric t of the closest point on the segment.
    const t   = _clamp((rx * s.dx + ry * s.dy) / s.lenSq, 0, 1);
    const cpx = s.x0 + t * s.dx;
    const cpy = s.y0 + t * s.dy;
    const dSq = (x - cpx) * (x - cpx) + (y - cpy) * (y - cpy);
    const w   = Math.exp(-dSq / PATH_TWO_SIGMA_SQ);
    vx += s.nx * PATH_SPEED * w;
    vy += s.ny * PATH_SPEED * w;
  }

  // 2. Mind Gate – clockwise vortex + mild inward sink ──────────────────────
  if (mindGate) {
    const dx = x - mindGate.x;
    const dy = y - mindGate.y;
    const r2 = dx * dx + dy * dy + coreSq;
    // Clockwise tangential: (dy, -dx) / r² direction.
    vx +=  MIND_GAMMA * dy / r2;
    vy += -MIND_GAMMA * dx / r2;
    // Mild inward radial pull toward the gate.
    vx -= MIND_GAMMA * 0.12 * dx / r2;
    vy -= MIND_GAMMA * 0.12 * dy / r2;
  }

  // 3. Shadow Gate – CCW vortex + mild outward push ──────────────────────────
  if (shadowGate) {
    const dx = x - shadowGate.x;
    const dy = y - shadowGate.y;
    const r2 = dx * dx + dy * dy + coreSq;
    // Counter-clockwise tangential: (-dy, dx) / r² direction.
    vx += -SHADOW_GAMMA * dy / r2;
    vy +=  SHADOW_GAMMA * dx / r2;
    // Mild outward radial push away from the gate.
    vx += SHADOW_GAMMA * 0.12 * dx / r2;
    vy += SHADOW_GAMMA * 0.12 * dy / r2;
  }

  // 4. Tower obstacles (soft radial repulsion) ──────────────────────────────
  const obstRSq = TOWER_OBSTACLE_R * TOWER_OBSTACLE_R;
  for (let i = 0; i < towers.length; i++) {
    const tw = towers[i];
    const dx = x - tw.x;
    const dy = y - tw.y;
    const r2 = dx * dx + dy * dy;
    if (r2 < obstRSq) {
      const r = Math.sqrt(r2) + 0.1;
      const f = TOWER_OBSTACLE_K / (r * r);
      vx += (dx / r) * f;
      vy += (dy / r) * f;
    }
  }

  // Clamp to maximum speed.
  const spd = Math.sqrt(vx * vx + vy * vy);
  if (spd > MAX_SPEED) {
    const inv = MAX_SPEED / spd;
    vx *= inv;
    vy *= inv;
  }

  return { vx, vy };
}

// ─── Particle spawning ────────────────────────────────────────────────────────

/**
 * Create a new particle.  Spawning is biased toward the shadow-gate region
 * (55 % chance) so the flow appears to emerge from the CCW source; the
 * remainder spawn at random viewport positions.
 *
 * @param {number} W  Viewport width (world px).
 * @param {number} H  Viewport height (world px).
 * @param {{x:number,y:number}|null} shadowGate
 * @param {number} index  Particle index (determines palette hue slot).
 * @returns {{x:number,y:number,trail:Array<{x:number,y:number}>,hueIdx:number}}
 */
function _spawnParticle(W, H, shadowGate, index) {
  const hueIdx = index % HUES.length;
  let x, y;
  if (shadowGate && Math.random() < 0.55) {
    // Place particle in a ring around the shadow gate.
    const angle = Math.random() * Math.PI * 2;
    const dist  = 25 + Math.random() * 160;
    x = shadowGate.x + Math.cos(angle) * dist;
    y = shadowGate.y + Math.sin(angle) * dist;
  } else {
    x = Math.random() * W;
    y = Math.random() * H;
  }
  return { x, y, trail: [], hueIdx };
}

// ─── Effect factory ───────────────────────────────────────────────────────────

/**
 * Create and return the Chapter 3 Euler Fluid effect controller.
 *
 * Exposes three methods:
 *  - `update(nowMs, W, H, pathPoints, towers)` – advance the simulation.
 *  - `draw(ctx)`   – render particle trails onto the canvas.
 *  - `reset()`     – clear all state (called when leaving Chapter 3).
 *
 * @returns {{ update: Function, draw: Function, reset: Function }}
 */
export function createEulerFluidEffect() {
  /** @type {Array<{x:number,y:number,trail:Array<{x:number,y:number}>,hueIdx:number}>} */
  let particles = [];
  let lastTs    = null;

  // Cached path data – rebuilt only when the path layout changes.
  let _segs       = [];
  let _mindGate   = null;
  let _shadowGate = null;
  let _pathKey    = '';

  // Tower positions refreshed every frame.
  let _towers = [];

  // Last viewport dimensions – used to detect resize events.
  let _W = 0;
  let _H = 0;

  // ── Internal helpers ────────────────────────────────────────────────────────

  /** Fill the particle pool to PARTICLE_COUNT for the given viewport size. */
  function _initParticles(W, H) {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = _spawnParticle(W, H, _shadowGate, i);
      // Seed an initial trail point so trails are non-empty on the first render.
      p.trail.push({ x: p.x, y: p.y });
      particles.push(p);
    }
  }

  /**
   * Rebuild path-segment cache when the path layout has changed.
   * The key includes all waypoint positions, so any intermediate-point change
   * will also trigger a cache invalidation.
   *
   * @param {Array<{x:number,y:number}>|null} pathPoints
   */
  function _refreshPath(pathPoints) {
    if (!pathPoints || pathPoints.length < 2) {
      _segs       = [];
      _mindGate   = null;
      _shadowGate = null;
      _pathKey    = '';
      return;
    }
    // Build a compact key from all waypoint coordinates.
    let key = '';
    for (let i = 0; i < pathPoints.length; i++) {
      key += `${pathPoints[i].x.toFixed(1)},${pathPoints[i].y.toFixed(1)};`;
    }
    if (key === _pathKey) return;
    _pathKey    = key;
    _segs       = _buildSegments(pathPoints);
    // Shadow gate = path start (enemies emerge from here → CCW source).
    _shadowGate = { x: pathPoints[0].x, y: pathPoints[0].y };
    // Mind gate   = path end   (enemies enter here    → CW sink).
    const last = pathPoints[pathPoints.length - 1];
    _mindGate   = { x: last.x, y: last.y };
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Advance the fluid simulation by one frame.
   *
   * @param {number} nowMs
   * @param {number} W               Viewport width (world px).
   * @param {number} H               Viewport height (world px).
   * @param {Array<{x:number,y:number}>|null} pathPoints  Level waypoints.
   * @param {Array<{x:number,y:number}>}      towers      Tower world positions.
   */
  function update(nowMs, W, H, pathPoints, towers) {
    const sizeChanged = (Math.abs(W - _W) > _W * RESIZE_THRESHOLD_FRACTION + 1) ||
                        (Math.abs(H - _H) > _H * RESIZE_THRESHOLD_FRACTION + 1);
    _W = W;
    _H = H;

    _refreshPath(pathPoints);
    _towers = towers || [];

    const dt = lastTs === null ? 0.016 : Math.min((nowMs - lastTs) / 1000, 0.1);
    lastTs = nowMs;

    // (Re-)initialise on first frame or after a significant viewport resize.
    if (!particles.length || sizeChanged) {
      _initParticles(W, H);
    }

    // Phase 1: advect every particle through the analytical velocity field.
    // Store per-particle speed for the respawn check in Phase 3.
    const speeds = new Float32Array(particles.length);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Sample the analytical velocity field at the particle's current position.
      const { vx, vy } = _sampleVelocity(
        p.x, p.y, _segs, _mindGate, _shadowGate, _towers
      );

      // Euler-integrate position.
      p.x += vx * dt;
      p.y += vy * dt;

      speeds[i] = Math.sqrt(vx * vx + vy * vy);
    }

    // Phase 2: inter-particle repulsion – prevents clumping at boundaries and
    // vortex centres.  A linear falloff (strongest at zero separation, zero at
    // PARTICLE_REPEL_R) keeps the effect gentle and singularity-free.
    for (let i = 0; i < particles.length; i++) {
      const pi = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const pj = particles[j];
        const dx = pi.x - pj.x;
        const dy = pi.y - pj.y;
        const r2 = dx * dx + dy * dy;
        if (r2 < PARTICLE_REPEL_R_SQ && r2 > 0.01) {
          const r  = Math.sqrt(r2);
          // Linear falloff: full strength at r=0, zero at r=PARTICLE_REPEL_R.
          const f  = PARTICLE_REPEL_K * (1 - r / PARTICLE_REPEL_R) * dt;
          const nx = dx / r;
          const ny = dy / r;
          pi.x += nx * f;
          pi.y += ny * f;
          pj.x -= nx * f;
          pj.y -= ny * f;
        }
      }
    }

    // Phase 3: record trails and respawn out-of-bounds / stalled particles.
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Append current (post-repulsion) position to the trail.
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > TRAIL_LENGTH) {
        p.trail.shift();
      }

      // Respawn the particle if it has left the extended viewport or stalled.
      const oob = p.x < -RESPAWN_OOB_MARGIN || p.x > W + RESPAWN_OOB_MARGIN ||
                  p.y < -RESPAWN_OOB_MARGIN || p.y > H + RESPAWN_OOB_MARGIN;
      if (oob || speeds[i] < RESPAWN_SLOW_THRESHOLD) {
        particles[i] = _spawnParticle(W, H, _shadowGate, i);
      }
    }
  }

  /**
   * Render all particle trails onto the canvas context.
   *
   * Trail segments are batched by (hue, alpha-bucket) to keep the number of
   * canvas draw calls low (at most HUES.length × ALPHA_BUCKETS = 35 strokes
   * per frame, regardless of particle count).
   *
   * The context transform is expected to already be in world-space.
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  function draw(ctx) {
    if (!_W || !_H || !particles.length) return;

    // Clear the pre-allocated batch arrays.
    for (let h = 0; h < HUES.length; h++) {
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        _drawBatches[h][b].length = 0;
      }
    }

    // Bin every trail segment into its (hue index, alpha bucket) slot.
    for (let i = 0; i < particles.length; i++) {
      const p     = particles[i];
      const trail = p.trail;
      const n     = trail.length;
      if (n < 2) continue;

      for (let j = 1; j < n; j++) {
        // Newer segments (larger j) get higher alpha.
        const bkt = Math.min(Math.floor((j / n) * ALPHA_BUCKETS), ALPHA_BUCKETS - 1);
        const arr = _drawBatches[p.hueIdx][bkt];
        arr.push(trail[j - 1].x, trail[j - 1].y, trail[j].x, trail[j].y);
      }
    }

    // Issue one compound stroke per non-empty (hue, bucket) combination.
    ctx.save();
    ctx.lineCap   = 'round';
    ctx.lineJoin  = 'round';
    ctx.lineWidth = TRAIL_LINE_WIDTH;

    for (let h = 0; h < HUES.length; h++) {
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        const arr = _drawBatches[h][b];
        if (arr.length === 0) continue;

        // Alpha increases from tail (bucket 0) to head (bucket ALPHA_BUCKETS-1).
        const alpha = ((b + 1) / ALPHA_BUCKETS) * TRAIL_HEAD_ALPHA;
        ctx.strokeStyle = `hsla(${HUES[h]},82%,66%,${alpha.toFixed(3)})`;
        ctx.beginPath();
        for (let k = 0; k < arr.length; k += 4) {
          ctx.moveTo(arr[k],     arr[k + 1]);
          ctx.lineTo(arr[k + 2], arr[k + 3]);
        }
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Clear all simulation state.  Called when the player leaves Chapter 3.
   */
  function reset() {
    particles   = [];
    lastTs      = null;
    _segs       = [];
    _mindGate   = null;
    _shadowGate = null;
    _pathKey    = '';
    _towers     = [];
    _W = 0;
    _H = 0;
  }

  return { update, draw, reset };
}
