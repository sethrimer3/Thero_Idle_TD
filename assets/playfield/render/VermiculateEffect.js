/**
 * VermiculateEffect
 *
 * Ambient background effect for Chapter 1.
 * This revision shifts the effect from loosely wandering glow trails to a
 * slower line-interaction simulation. Two motion families coexist:
 *   1. Orthogonal tracers travel in straight segments and turn in 90° steps.
 *   2. Circular tracers constantly curve and rebound when touching trails.
 *
 * The requested art direction is intentionally contact-driven:
 *   • Base line bodies render at 0% opacity.
 *   • Leading dots render at 10% opacity.
 *   • Only contact zones fade in, topping out at 15% opacity where segments touch.
 *   • Trails are shorter so interactions stay legible.
 *
 * The simulation stores each tracer as a compact segment history. Every time a
 * tracer advances, its newest segment is tested against other tracers and its
 * own older geometry. When an intersection is found we:
 *   • reflect the tracer direction,
 *   • register a temporary highlight at the collision point,
 *   • allow curved tracers to bounce off their own earlier trail as requested.
 */

import { clamp } from '../../../scripts/core/mathUtils.js';

/** Number of simultaneous background tracers. */
const TRACER_COUNT = 14;

/** Slightly longer trail history for more visible line paths. */
const MAX_SEGMENTS = 30;

/** Slow movement makes rebounds easier to perceive. */
const SPEED = 28;

/** Maximum step distance per micro-step to avoid tunneling through segments. */
const STEP_DISTANCE = 3.5;

/** Orthogonal tracers only face the four cardinal directions. */
const RIGHT_ANGLE = Math.PI / 2;

/** Circular tracers continuously curve at this rate. */
const CIRCULAR_TURN_RATE = 1.05;

/** Orthogonal tracers occasionally choose a fresh 90° turn. */
const ORTHO_TURN_INTERVAL_MIN = 0.9;
const ORTHO_TURN_INTERVAL_MAX = 1.8;

/** Bounce cooldown prevents repeated reflections on the same contact. */
const BOUNCE_COOLDOWN = 0.09;

/** Base line body is fully invisible per request. */
const LINE_OPACITY = 0;

/** Head dots are only faintly visible. */
const HEAD_DOT_OPACITY = 0.10;

/** Contact highlights are the only visible trail reveal and peak at 15%. */
const CONTACT_MAX_OPACITY = 0.15;

/** Contact flash lifetime in seconds. */
const CONTACT_LIFETIME = 1.1;

/** Thin invisible line width; retained for hit context and future tuning. */
const LINE_WIDTH = 1.2;

/** Contact reveal stroke width is slightly wider than the hidden line body. */
const CONTACT_WIDTH = 2.2;

/** Dot size kept small to match the shorter line lengths. */
const HEAD_DOT_SIZE = 10;

/** Minimum squared length accepted as a real segment. */
const MIN_SEGMENT_LENGTH_SQ = 0.04;

/** Small epsilon to ignore touching the currently forming segment origin. */
const SELF_SKIP_SEGMENTS = 2;

const TWO_PI = Math.PI * 2;

/** Monochrome leaning palette keeps Chapter 1 subdued. */
const PALETTE = [
  { r: 255, g: 255, b: 255 },
  { r: 214, g: 224, b: 255 },
  { r: 255, g: 239, b: 214 },
];

/** Return a random item from the configured palette. */
function pickColor() {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

/** Return a random orthogonal heading. */
function randomOrthogonalAngle() {
  return Math.floor(Math.random() * 4) * RIGHT_ANGLE;
}

/** Return a random interval before the next 90° turn. */
function randomOrthogonalTurnInterval() {
  return ORTHO_TURN_INTERVAL_MIN + Math.random() * (ORTHO_TURN_INTERVAL_MAX - ORTHO_TURN_INTERVAL_MIN);
}

/** Normalize a heading into the [-π, π] range for stable reflections. */
function normalizeAngle(angle) {
  let normalized = angle;
  while (normalized <= -Math.PI) normalized += TWO_PI;
  while (normalized > Math.PI) normalized -= TWO_PI;
  return normalized;
}

/** Reflect a motion vector around a surface normal. */
function reflectAngle(angle, normalX, normalY) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const dot = dx * normalX + dy * normalY;
  const rx = dx - 2 * dot * normalX;
  const ry = dy - 2 * dot * normalY;
  return Math.atan2(ry, rx);
}

/**
 * Create a tiny pre-rendered glow dot so draw() avoids rebuilding gradients.
 */
function createDotSprite(r, g, b, size) {
  const offscreen = document.createElement('canvas');
  offscreen.width = size;
  offscreen.height = size;
  const ctx = offscreen.getContext('2d');
  const radius = size / 2;
  const center = radius;

  const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.35, `rgba(${r},${g},${b},0.45)`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, TWO_PI);
  ctx.fill();
  return offscreen;
}

/** Package precomputed stroke strings for contact highlights. */
function buildStyles(color) {
  return {
    line: `rgba(${color.r},${color.g},${color.b},${LINE_OPACITY.toFixed(3)})`,
    contact: `rgba(${color.r},${color.g},${color.b},${CONTACT_MAX_OPACITY.toFixed(3)})`,
  };
}

/** Create one tracer with either orthogonal or circular steering. */
function createTracer(width, height, index) {
  const color = pickColor();
  const mode = index % 2 === 0 ? 'orthogonal' : 'circular';
  const angle = mode === 'orthogonal' ? randomOrthogonalAngle() : Math.random() * TWO_PI;

  return {
    id: index,
    mode,
    color,
    styles: buildStyles(color),
    x: Math.random() * width,
    y: Math.random() * height,
    angle,
    segments: [],
    turnTimer: randomOrthogonalTurnInterval(),
    curveDirection: Math.random() < 0.5 ? -1 : 1,
    bounceCooldown: 0,
  };
}

/**
 * Build a mathematical line segment record with cached delta and length values.
 */
function createSegment(x1, y1, x2, y2, tracerId) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return {
    x1,
    y1,
    x2,
    y2,
    dx,
    dy,
    tracerId,
    lengthSq: dx * dx + dy * dy,
  };
}

/**
 * Determine whether two segments intersect and return the hit point + normal.
 */
function getSegmentIntersection(a, b) {
  const denominator = a.dx * b.dy - a.dy * b.dx;
  if (Math.abs(denominator) < 0.000001) {
    return null;
  }

  const qpx = b.x1 - a.x1;
  const qpy = b.y1 - a.y1;
  const t = (qpx * b.dy - qpy * b.dx) / denominator;
  const u = (qpx * a.dy - qpy * a.dx) / denominator;
  if (t < 0 || t > 1 || u < 0 || u > 1) {
    return null;
  }

  const ix = a.x1 + a.dx * t;
  const iy = a.y1 + a.dy * t;
  const segLength = Math.hypot(b.dx, b.dy) || 1;
  const normalX = -b.dy / segLength;
  const normalY = b.dx / segLength;
  return { x: ix, y: iy, normalX, normalY, t, u };
}

/**
 * Reposition a tracer inside the viewport after wall rebounds.
 */
function clampToViewport(tracer, width, height) {
  tracer.x = clamp(tracer.x, 0, width);
  tracer.y = clamp(tracer.y, 0, height);
}

/**
 * Create and return the Chapter 1 background effect controller.
 */
export function createVermiculateEffect() {
  let tracers = [];
  let contactHighlights = [];
  let lastTimestamp = null;
  let viewWidth = 0;
  let viewHeight = 0;
  let dotSprites = null;

  /** Lazily create the dot cache once per palette color. */
  function ensureDotSprites() {
    if (dotSprites) {
      return;
    }
    dotSprites = new Map();
    for (const color of PALETTE) {
      dotSprites.set(`${color.r},${color.g},${color.b}`, createDotSprite(color.r, color.g, color.b, HEAD_DOT_SIZE));
    }
  }

  /** Rebuild the simulation when the viewport changes materially. */
  function initialize(width, height) {
    tracers = [];
    contactHighlights = [];
    for (let index = 0; index < TRACER_COUNT; index++) {
      tracers.push(createTracer(width, height, index));
    }
    lastTimestamp = null;

    // Prewarm a little so the chapter starts with existing geometry to bounce off.
    for (let step = 0; step < 90; step++) {
      simulate(0.025, width, height);
    }
  }

  /** Age and remove expired contact highlight flashes. */
  function ageHighlights(dt) {
    for (let index = contactHighlights.length - 1; index >= 0; index--) {
      const highlight = contactHighlights[index];
      highlight.life -= dt;
      if (highlight.life <= 0) {
        contactHighlights.splice(index, 1);
      }
    }
  }

  /** Record a new visible contact event. */
  function registerContact(x, y, colorA, colorB) {
    // Blend toward white to make overlaps feel like additive mathematical sparks.
    const blend = {
      r: Math.round((colorA.r + colorB.r + 255) / 3),
      g: Math.round((colorA.g + colorB.g + 255) / 3),
      b: Math.round((colorA.b + colorB.b + 255) / 3),
    };

    contactHighlights.push({
      x,
      y,
      life: CONTACT_LIFETIME,
      color: blend,
    });
  }

  /**
   * Check the tracer's newest segment against all persisted geometry.
   */
  function detectSegmentHit(tracer, segment) {
    for (const other of tracers) {
      const isSelf = other.id === tracer.id;
      const limit = other.segments.length - (isSelf ? SELF_SKIP_SEGMENTS : 0);
      for (let index = 0; index < limit; index++) {
        const candidate = other.segments[index];
        if (!candidate || candidate.lengthSq < MIN_SEGMENT_LENGTH_SQ) {
          continue;
        }

        const hit = getSegmentIntersection(segment, candidate);
        if (!hit) {
          continue;
        }

        // Ignore immediate self-contact at the new segment origin.
        if (isSelf && hit.t < 0.08) {
          continue;
        }

        return {
          ...hit,
          otherTracer: other,
          otherSegment: candidate,
        };
      }
    }
    return null;
  }

  /**
   * Advance one tracer in small substeps so segment interaction stays reliable.
   */
  function advanceTracer(tracer, dt, width, height) {
    tracer.bounceCooldown = Math.max(0, tracer.bounceCooldown - dt);

    if (tracer.mode === 'orthogonal') {
      tracer.turnTimer -= dt;
      if (tracer.turnTimer <= 0) {
        // Orthogonal paths pivot in clean 90° turns to satisfy the chapter spec.
        tracer.angle += (Math.random() < 0.5 ? -1 : 1) * RIGHT_ANGLE;
        tracer.turnTimer = randomOrthogonalTurnInterval();
      }
    } else {
      // Circular tracers continuously arc while still being rebound by collisions.
      tracer.angle += tracer.curveDirection * CIRCULAR_TURN_RATE * dt;
    }

    const totalDistance = SPEED * dt;
    const steps = Math.max(1, Math.ceil(totalDistance / STEP_DISTANCE));
    const microDt = dt / steps;

    for (let step = 0; step < steps; step++) {
      if (tracer.mode === 'circular') {
        tracer.angle += tracer.curveDirection * CIRCULAR_TURN_RATE * microDt;
      }

      const startX = tracer.x;
      const startY = tracer.y;
      const distance = SPEED * microDt;
      const nextX = startX + Math.cos(tracer.angle) * distance;
      const nextY = startY + Math.sin(tracer.angle) * distance;
      const segment = createSegment(startX, startY, nextX, nextY, tracer.id);
      if (segment.lengthSq < MIN_SEGMENT_LENGTH_SQ) {
        tracer.x = nextX;
        tracer.y = nextY;
        continue;
      }

      let bounced = false;
      if (tracer.bounceCooldown <= 0) {
        const hit = detectSegmentHit(tracer, segment);
        if (hit) {
          registerContact(hit.x, hit.y, tracer.color, hit.otherTracer.color);
          tracer.angle = reflectAngle(tracer.angle, hit.normalX, hit.normalY);
          tracer.angle = normalizeAngle(tracer.angle);
          tracer.bounceCooldown = BOUNCE_COOLDOWN;
          tracer.x = hit.x + Math.cos(tracer.angle) * 1.4;
          tracer.y = hit.y + Math.sin(tracer.angle) * 1.4;
          bounced = true;
        }
      }

      if (bounced) {
        continue;
      }

      tracer.x = nextX;
      tracer.y = nextY;

      // Screen bounds also rebound the paths so the whole field stays interactive.
      if (tracer.x <= 0 || tracer.x >= width) {
        tracer.angle = reflectAngle(tracer.angle, tracer.x <= 0 ? 1 : -1, 0);
        tracer.x = clamp(tracer.x, 0, width);
      }
      if (tracer.y <= 0 || tracer.y >= height) {
        tracer.angle = reflectAngle(tracer.angle, 0, tracer.y <= 0 ? 1 : -1);
        tracer.y = clamp(tracer.y, 0, height);
      }
      clampToViewport(tracer, width, height);

      const committed = createSegment(startX, startY, tracer.x, tracer.y, tracer.id);
      if (committed.lengthSq >= MIN_SEGMENT_LENGTH_SQ) {
        tracer.segments.push(committed);
        if (tracer.segments.length > MAX_SEGMENTS) {
          tracer.segments.shift();
        }
      }
    }
  }

  /** Advance the full simulation by one frame. */
  function simulate(dt, width, height) {
    ageHighlights(dt);
    for (const tracer of tracers) {
      advanceTracer(tracer, dt, width, height);
    }
  }

  /** Public update entry point used by BackgroundRenderer. */
  function update(now, width, height) {
    const resized = !tracers.length || Math.abs(width - viewWidth) > 100 || Math.abs(height - viewHeight) > 100;
    viewWidth = width;
    viewHeight = height;
    if (resized) {
      initialize(width, height);
    }
    ensureDotSprites();

    const dt = lastTimestamp === null ? 0.016 : Math.min((now - lastTimestamp) / 1000, 0.05);
    lastTimestamp = now;
    simulate(dt, width, height);
  }

  /** Draw the invisible baseline geometry, visible contact flashes, and head dots. */
  function draw(ctx) {
    if (!tracers.length) {
      return;
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // The requested baseline: lines exist geometrically, but their body is invisible.
    for (const tracer of tracers) {
      if (!tracer.segments.length) {
        continue;
      }
      ctx.beginPath();
      ctx.lineWidth = LINE_WIDTH;
      ctx.strokeStyle = tracer.styles.line;
      ctx.moveTo(tracer.segments[0].x1, tracer.segments[0].y1);
      for (const segment of tracer.segments) {
        ctx.lineTo(segment.x2, segment.y2);
      }
      ctx.stroke();
    }

    // Contact highlights are the only revealed portions of the line network.
    for (const highlight of contactHighlights) {
      const alpha = CONTACT_MAX_OPACITY * clamp(highlight.life / CONTACT_LIFETIME, 0, 1);
      const gradient = ctx.createRadialGradient(highlight.x, highlight.y, 0, highlight.x, highlight.y, 18);
      gradient.addColorStop(0, `rgba(${highlight.color.r},${highlight.color.g},${highlight.color.b},${alpha.toFixed(3)})`);
      gradient.addColorStop(0.55, `rgba(${highlight.color.r},${highlight.color.g},${highlight.color.b},${(alpha * 0.45).toFixed(3)})`);
      gradient.addColorStop(1, `rgba(${highlight.color.r},${highlight.color.g},${highlight.color.b},0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(highlight.x, highlight.y, 18, 0, TWO_PI);
      ctx.fill();
    }

    // Short visible line fragments around contact points reinforce that the line fades in there.
    for (const tracer of tracers) {
      ctx.strokeStyle = tracer.styles.contact;
      ctx.lineWidth = CONTACT_WIDTH;
      for (const segment of tracer.segments) {
        for (const highlight of contactHighlights) {
          const minX = Math.min(segment.x1, segment.x2) - 8;
          const maxX = Math.max(segment.x1, segment.x2) + 8;
          const minY = Math.min(segment.y1, segment.y2) - 8;
          const maxY = Math.max(segment.y1, segment.y2) + 8;
          if (highlight.x < minX || highlight.x > maxX || highlight.y < minY || highlight.y > maxY) {
            continue;
          }
          ctx.globalAlpha = clamp(highlight.life / CONTACT_LIFETIME, 0, 1);
          ctx.beginPath();
          ctx.moveTo(segment.x1, segment.y1);
          ctx.lineTo(segment.x2, segment.y2);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;

    // The front dot remains faintly visible at all times.
    for (const tracer of tracers) {
      const key = `${tracer.color.r},${tracer.color.g},${tracer.color.b}`;
      const sprite = dotSprites?.get(key);
      if (!sprite) {
        continue;
      }
      const half = HEAD_DOT_SIZE / 2;
      ctx.save();
      ctx.globalAlpha = HEAD_DOT_OPACITY;
      ctx.drawImage(sprite, tracer.x - half, tracer.y - half);
      ctx.restore();
    }

    ctx.restore();
  }

  /** Reset the effect when the player leaves Chapter 1. */
  function reset() {
    tracers = [];
    contactHighlights = [];
    lastTimestamp = null;
  }

  /** Release internal caches if the renderer ever needs a hard teardown. */
  function destroy() {
    reset();
    dotSprites = null;
  }

  return { update, draw, reset, destroy };
}
