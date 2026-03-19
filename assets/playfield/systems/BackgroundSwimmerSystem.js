// Background swimmer particle system extracted from SimplePlayfield for modular ambient animation.
// Swimmers are small, blurred ambient particles with fluid-dynamics interactions.
// They respond to path currents, enemy wakes, projectile displacement, gate forces,
// and inter-particle repulsion for an organic, water-like feel.

import { areBackgroundParticlesEnabled } from '../../preferences.js';
import { metersToPixels } from '../../gameUnits.js';

// Pre-calculated constants for performance
const TWO_PI = Math.PI * 2;
const HALF = 0.5;

// Physics tuning — distances are expressed in meters and converted per-frame.
const REPULSION_RADIUS_METERS = 0.5;
const GATE_INFLUENCE_METERS = 2.0;
const GATE_WARP_RADIUS_METERS = 0.25;
const PATH_CURRENT_WIDTH_METERS = 0.35;
const SWIMMER_MIN_SPEED_FACTOR = 0.018;
const SWIMMER_VISIBLE_SPEED_FACTOR = 0.11;

/**
 * Resolve an expanded viewport bounds object so decorative swimmers only spend CPU
 * when they are close enough to matter on the current camera view.
 *
 * @param {number} width - Current render width
 * @param {number} height - Current render height
 * @param {number} margin - World-space margin added beyond the visible viewport
 * @returns {{minX:number,maxX:number,minY:number,maxY:number}}
 */
function resolveSwimmerActiveBounds(width, height, margin) {
  const center = this.getViewCenter ? this.getViewCenter() : { x: width * HALF, y: height * HALF };
  const scale = Math.max(this.viewScale || 1, 0.0001);
  const halfWidth = (width / scale) * HALF + margin;
  const halfHeight = (height / scale) * HALF + margin;
  return {
    minX: center.x - halfWidth,
    maxX: center.x + halfWidth,
    minY: center.y - halfHeight,
    maxY: center.y + halfHeight,
  };
}

/**
 * Test whether a swimmer is within the expanded active viewport bounds.
 *
 * @param {Object} swimmer - Background swimmer state
 * @param {{minX:number,maxX:number,minY:number,maxY:number}} bounds
 * @returns {boolean}
 */
function isSwimmerInBounds(swimmer, bounds) {
  return Boolean(
    swimmer &&
    bounds &&
    swimmer.x >= bounds.minX &&
    swimmer.x <= bounds.maxX &&
    swimmer.y >= bounds.minY &&
    swimmer.y <= bounds.maxY
  );
}

/**
 * Compute the number of background swimmers based on viewport dimensions.
 * Larger areas spawn more swimmers for consistent visual density.
 *
 * @param {number} width - Viewport width in pixels
 * @param {number} height - Viewport height in pixels
 * @returns {number} Number of swimmers to spawn (28-120)
 */
function computeSwimmerCount(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return 0;
  }
  const area = Math.max(0, width * height);
  const base = Math.round(area / 16000);
  return Math.max(28, Math.min(120, base));
}

/**
 * Create a new background swimmer particle with randomized initial state.
 * Swimmers start nearly stationary so they fade in only when disturbed.
 *
 * @param {number} width - Viewport width in pixels (or bounds object)
 * @param {number} height - Viewport height in pixels
 * @returns {Object} Swimmer object with position, velocity, and visual properties
 */
function createBackgroundSwimmer(width, height) {
  // Accept either legacy width/height numbers or an explicit ambient-bounds object from the playfield.
  const bounds = (typeof width === 'object' && width)
    ? width
    : { minX: 0, minY: 0, maxX: width, maxY: height, width, height };
  const boundsWidth = Math.max(1, Number.isFinite(bounds.width) ? bounds.width : (bounds.maxX - bounds.minX));
  const boundsHeight = Math.max(1, Number.isFinite(bounds.height) ? bounds.height : (bounds.maxY - bounds.minY));
  const margin = Math.min(boundsWidth, boundsHeight) * 0.05;
  const usableWidth = Math.max(1, boundsWidth - margin * 2);
  const usableHeight = Math.max(1, boundsHeight - margin * 2);
  // Start with very low velocity — swimmers are invisible until pushed.
  const angle = Math.random() * TWO_PI;
  // Seed swimmers with a tiny baseline drift so they keep a faint sense of motion without becoming visible.
  const drift = Math.random() * 2;
  return {
    x: (Number.isFinite(bounds.minX) ? bounds.minX : 0) + margin + Math.random() * usableWidth,
    y: (Number.isFinite(bounds.minY) ? bounds.minY : 0) + margin + Math.random() * usableHeight,
    vx: Math.cos(angle) * drift,
    vy: Math.sin(angle) * drift,
    ax: 0,
    ay: 0,
    // Cached speed scalar written each update for the renderer to use as opacity.
    speed: drift,
    flicker: Math.random() * TWO_PI,
    sizeScale: 0.5 + Math.random() * 0.8,
    minSpeed: 0,
    visibleSpeed: 0,
  };
}

/**
 * Keep swimmers gliding at a tiny floor speed so the current can immediately amplify them.
 * This floor stays invisible because the renderer fades in only above the minimum speed.
 *
 * @param {Object} swimmer - Background swimmer state being normalized
 * @param {number} fallbackDirectionX - Direction used when the swimmer is almost still
 * @param {number} fallbackDirectionY - Direction used when the swimmer is almost still
 */
function enforceMinimumSwimmerSpeed(swimmer, fallbackDirectionX, fallbackDirectionY) {
  const minSpeed = Number.isFinite(swimmer?.minSpeed) ? swimmer.minSpeed : 0;
  if (minSpeed <= 0) {
    return;
  }
  const speed = Math.hypot(swimmer.vx, swimmer.vy);
  if (speed >= minSpeed) {
    return;
  }
  const fallbackLength = Math.hypot(fallbackDirectionX, fallbackDirectionY);
  const dirX = speed > 1e-4
    ? swimmer.vx / speed
    : (fallbackLength > 1e-4 ? fallbackDirectionX / fallbackLength : Math.cos(swimmer.flicker || 0));
  const dirY = speed > 1e-4
    ? swimmer.vy / speed
    : (fallbackLength > 1e-4 ? fallbackDirectionY / fallbackLength : Math.sin(swimmer.flicker || 0));
  swimmer.vx = dirX * minSpeed;
  swimmer.vy = dirY * minSpeed;
}

/**
 * Convert swimmer speed into a 0-1 visibility ratio.
 * Minimum-speed drift stays hidden while moderate motion reaches the configured cap.
 *
 * @param {Object} swimmer - Background swimmer state sampled by the renderer
 * @returns {number} Visibility scalar before renderer-side alpha clamping
 */
function computeSwimmerVisibility(swimmer) {
  const speed = Number.isFinite(swimmer?.speed) ? swimmer.speed : 0;
  const minSpeed = Number.isFinite(swimmer?.minSpeed) ? swimmer.minSpeed : 0;
  const visibleSpeed = Math.max(minSpeed + 1e-4, Number.isFinite(swimmer?.visibleSpeed) ? swimmer.visibleSpeed : minSpeed + 1);
  if (speed <= minSpeed) {
    return 0;
  }
  return Math.max(0, Math.min(1, (speed - minSpeed) / (visibleSpeed - minSpeed)));
}

/**
 * Resolve the position of a projectile from the varied shapes used in the engine.
 * @param {Object} projectile
 * @returns {{x:number, y:number, vx:number, vy:number}|null}
 */
function resolveProjectileState(projectile) {
  let x, y;
  if (projectile?.currentPosition?.x !== undefined && projectile?.currentPosition?.y !== undefined) {
    x = projectile.currentPosition.x;
    y = projectile.currentPosition.y;
  } else if (projectile?.position?.x !== undefined && projectile?.position?.y !== undefined) {
    x = projectile.position.x;
    y = projectile.position.y;
  } else if (projectile?.x !== undefined && projectile?.y !== undefined) {
    x = projectile.x;
    y = projectile.y;
  } else if (projectile?.source && projectile?.target && Number.isFinite(projectile?.progress)) {
    const ratio = Math.max(0, Math.min(1, projectile.progress));
    x = projectile.source.x + (projectile.target.x - projectile.source.x) * ratio;
    y = projectile.source.y + (projectile.target.y - projectile.source.y) * ratio;
  } else {
    return null;
  }
  // Derive an approximate velocity from previous-position delta if available.
  const prev = projectile.previousPosition || projectile.source;
  let vx = 0;
  let vy = 0;
  if (prev && Number.isFinite(prev.x) && Number.isFinite(prev.y)) {
    vx = x - prev.x;
    vy = y - prev.y;
  }
  return { x, y, vx, vy };
}

/**
 * Apply a wake-style push to the swimmer from a moving object.
 * Creates a V-shaped outward displacement behind the mover (like a boat wake).
 *
 * @param {Object} swimmer - The swimmer particle
 * @param {number} objX - Object x position
 * @param {number} objY - Object y position
 * @param {number} moveVx - Object velocity x
 * @param {number} moveVy - Object velocity y
 * @param {number} influenceRadius - Radius of influence in pixels
 * @param {number} strength - Base force multiplier
 */
function applyWakeForce(swimmer, objX, objY, moveVx, moveVy, influenceRadius, strength) {
  const dx = swimmer.x - objX;
  const dy = swimmer.y - objY;
  const dist = Math.hypot(dx, dy);
  if (!dist || dist >= influenceRadius) {
    return;
  }
  const moveSpeed = Math.hypot(moveVx, moveVy);
  if (moveSpeed < 0.5) {
    return;
  }
  const proximity = 1 - dist / influenceRadius;
  // Perpendicular outward splay (wake V-shape).
  const nx = dx / dist;
  const ny = dy / dist;
  // Dot product: positive means the swimmer is ahead, negative means behind the mover.
  const moveDirX = moveVx / moveSpeed;
  const moveDirY = moveVy / moveSpeed;
  const dot = nx * moveDirX + ny * moveDirY;
  // Stronger push for particles to the side and behind the mover.
  const splayFactor = Math.max(0, 1 - dot * 0.6);
  // Perpendicular component for the V-splay.
  const perpX = nx - moveDirX * dot;
  const perpY = ny - moveDirY * dot;
  const perpLen = Math.hypot(perpX, perpY) || 1;
  const force = strength * proximity * proximity * splayFactor * moveSpeed;
  // Push outward with perpendicular splay.
  swimmer.ax += (perpX / perpLen) * force * 0.7 + nx * force * 0.3;
  swimmer.ay += (perpY / perpLen) * force * 0.7 + ny * force * 0.3;
}

/**
 * Update all background swimmer particles with fluid-dynamics physics.
 * Swimmers exhibit:
 * - Inter-particle repulsion (half meter radius)
 * - Path current (shadow gate → mind gate direction)
 * - Enemy wake push (fluid V-wake behind movers)
 * - Projectile displacement (wake-like push)
 * - Mind gate suction (2 m radius) with warp-to-shadow-gate teleportation
 * - Shadow gate repulsion (2 m radius)
 * - Speed-based opacity (minimum drift = invisible, moderate motion = 40% visible)
 * - Velocity damping that keeps the flow readable without freezing swimmers
 *
 * @param {number} delta - Time delta in seconds for frame-independent animation
 */
function updateBackgroundSwimmers(delta) {
  if (!Array.isArray(this.backgroundSwimmers) || !this.backgroundSwimmers.length || !this.levelConfig) {
    return;
  }
  // Skip all decorative swimmer work when ambient particles are disabled.
  if (!areBackgroundParticlesEnabled()) {
    this.backgroundSwimmers.forEach((swimmer) => {
      if (swimmer) {
        swimmer.isViewportActive = false;
      }
    });
    return;
  }

  const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  const ambientBounds = this.swimmerBounds || { minX: 0, minY: 0, maxX: width, maxY: height, width, height };
  const ambientWidth = Math.max(0, Number.isFinite(ambientBounds.width) ? ambientBounds.width : (ambientBounds.maxX - ambientBounds.minX));
  const ambientHeight = Math.max(0, Number.isFinite(ambientBounds.height) ? ambientBounds.height : (ambientBounds.maxY - ambientBounds.minY));
  if (!width || !height || !ambientWidth || !ambientHeight) {
    return;
  }

  const dt = Math.max(0, Math.min(delta, 0.05));
  const minDimension = Math.min(ambientWidth, ambientHeight);

  // Convert meter-based radii into pixel distances for this viewport size.
  const repulsionRadius = metersToPixels(REPULSION_RADIUS_METERS, minDimension);
  const gateInfluence = metersToPixels(GATE_INFLUENCE_METERS, minDimension);
  const gateWarpDist = metersToPixels(GATE_WARP_RADIUS_METERS, minDimension);
  const currentWidthPx = metersToPixels(PATH_CURRENT_WIDTH_METERS, minDimension);

  const speedCap = minDimension * 0.42;
  const minSpeed = minDimension * SWIMMER_MIN_SPEED_FACTOR;
  const visibleSpeed = minDimension * SWIMMER_VISIBLE_SPEED_FACTOR;
  const wanderStrength = minDimension * 0.03;
  const projectileInfluence = minDimension * 0.2;
  const activityMargin = Math.max(24, currentWidthPx);
  // Gentler damping so swimmers retain velocity longer and stay visible.
  const damping = dt > 0 ? Math.exp(-dt * 1.6) : 1;
  const activeBounds = resolveSwimmerActiveBounds.call(this, width, height, activityMargin);
  const activeSwimmers = [];

  this.backgroundSwimmers.forEach((swimmer) => {
    if (!swimmer) {
      return;
    }
    swimmer.isViewportActive = isSwimmerInBounds(swimmer, activeBounds);
    if (!swimmer.isViewportActive) {
      swimmer.flicker = Number.isFinite(swimmer.flicker) ? swimmer.flicker : 0;
      swimmer.flicker += dt * 1.2;
      return;
    }
    activeSwimmers.push(swimmer);
  });
  if (!activeSwimmers.length) {
    return;
  }

  // Resolve gate positions: shadow gate = path start, mind gate = path end.
  const pathPoints = Array.isArray(this.pathPoints) ? this.pathPoints : [];
  const shadowGate = pathPoints.length ? pathPoints[0] : null;
  const mindGate = pathPoints.length ? pathPoints[pathPoints.length - 1] : null;

  // Resolve projectile states with velocity for wake calculations.
  const projectileStates = this.projectiles.map(resolveProjectileState).filter(Boolean);

  // Resolve enemy positions with movement direction for wake effects.
  const enemyStates = [];
  if (Array.isArray(this.enemies)) {
    this.enemies.forEach((enemy) => {
      if (!enemy || enemy.hp <= 0) {
        return;
      }
      const pos = typeof this.getEnemyPosition === 'function' ? this.getEnemyPosition(enemy) : null;
      if (!pos) {
        return;
      }
      // Derive movement direction from path segments at the enemy's progress.
      const speed = Number.isFinite(enemy.speed) ? enemy.speed : 0;
      let dirX = 0;
      let dirY = 0;
      if (speed > 0 && this.pathSegments.length) {
        // Find the segment the enemy currently occupies to derive movement direction.
        let accumulated = 0;
        for (let i = 0; i < this.pathSegments.length; i += 1) {
          const seg = this.pathSegments[i];
          const segLen = Math.hypot(seg.end.x - seg.start.x, seg.end.y - seg.start.y);
          const segProgress = this.pathLength ? (accumulated + segLen) / this.pathLength : 0;
          if (segProgress >= (enemy.progress || 0) || i === this.pathSegments.length - 1) {
            const len = segLen || 1;
            dirX = (seg.end.x - seg.start.x) / len;
            dirY = (seg.end.y - seg.start.y) / len;
            break;
          }
          accumulated += segLen;
        }
      }
      // Convert progress-space speed into approximate pixel velocity magnitude.
      const pixelSpeed = speed * (this.pathLength || minDimension);
      enemyStates.push({
        x: pos.x,
        y: pos.y,
        vx: dirX * pixelSpeed,
        vy: dirY * pixelSpeed,
      });
    });
  }

  // Current strength scales with the min dimension so the feel is consistent across resolutions.
  const currentStrength = minDimension * 0.14;

  activeSwimmers.forEach((swimmer) => {
    // Store the invisible baseline speed range used by the renderer.
    swimmer.minSpeed = minSpeed;
    swimmer.visibleSpeed = visibleSpeed;

    // Start with a gentle random wander so the larger currents can dominate the motion language.
    swimmer.ax = (Math.random() - 0.5) * wanderStrength;
    swimmer.ay = (Math.random() - 0.5) * wanderStrength;

    // --- Inter-particle repulsion (half meter) ---
    if (repulsionRadius > 0) {
      for (let j = 0; j < activeSwimmers.length; j += 1) {
        const other = activeSwimmers[j];
        if (other === swimmer) {
          continue;
        }
        const dx = swimmer.x - other.x;
        const dy = swimmer.y - other.y;
        const dist = Math.hypot(dx, dy);
        if (!dist || dist >= repulsionRadius) {
          continue;
        }
        const proximity = 1 - dist / repulsionRadius;
        const repelForce = minDimension * 0.07 * proximity * proximity;
        swimmer.ax += (dx / dist) * repelForce;
        swimmer.ay += (dy / dist) * repelForce;
      }
    }

    // --- Path current (shadow gate → mind gate direction along track) ---
    let closestDistance = Infinity;
    let flowDirection = null;
    this.pathSegments.forEach((segment) => {
      const projection = this.projectPointOntoSegment(swimmer, segment.start, segment.end);
      const dx = projection.point.x - swimmer.x;
      const dy = projection.point.y - swimmer.y;
      const distance = Math.hypot(dx, dy);
      if (distance < closestDistance) {
        closestDistance = distance;
        const length = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y) || 1;
        flowDirection = {
          x: (segment.end.x - segment.start.x) / length,
          y: (segment.end.y - segment.start.y) / length,
        };
      }
    });

    if (flowDirection && closestDistance < currentWidthPx) {
      const influence = 1 - closestDistance / currentWidthPx;
      const push = currentStrength * influence * influence;
      swimmer.ax += flowDirection.x * push;
      swimmer.ay += flowDirection.y * push;
    }

    // --- Enemy wake push (fluid V-wake behind moving enemies) ---
    const enemyWakeRadius = minDimension * 0.18;
    for (let e = 0; e < enemyStates.length; e += 1) {
      const es = enemyStates[e];
      applyWakeForce(swimmer, es.x, es.y, es.vx, es.vy, enemyWakeRadius, 0.8);
    }

    // --- Projectile displacement (wake push) ---
    for (let p = 0; p < projectileStates.length; p += 1) {
      const ps = projectileStates[p];
      applyWakeForce(swimmer, ps.x, ps.y, ps.vx, ps.vy, projectileInfluence, 0.5);
      // Also apply a radial push so nearby particles scatter even from slow projectiles.
      const dx = swimmer.x - ps.x;
      const dy = swimmer.y - ps.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist < projectileInfluence) {
        const proximity = 1 - dist / projectileInfluence;
        const radialForce = minDimension * 0.13 * proximity * proximity;
        swimmer.ax += (dx / dist) * radialForce;
        swimmer.ay += (dy / dist) * radialForce;
      }
    }

    // --- Mind gate suction (2 m radius, pulls particles inward) ---
    if (mindGate && gateInfluence > 0) {
      const dx = mindGate.x - swimmer.x;
      const dy = mindGate.y - swimmer.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist < gateInfluence) {
        const proximity = 1 - dist / gateInfluence;
        // Gentle cubic pull that strengthens close to the gate.
        const pullForce = minDimension * 0.16 * proximity * proximity * proximity;
        swimmer.ax += (dx / dist) * pullForce;
        swimmer.ay += (dy / dist) * pullForce;
      }
      // Warp: if very close to mind gate, teleport to shadow gate preserving velocity.
      if (dist < gateWarpDist && shadowGate) {
        swimmer.x = shadowGate.x;
        swimmer.y = shadowGate.y;
      }
    }

    // --- Shadow gate repulsion (2 m radius, pushes particles outward) ---
    if (shadowGate && gateInfluence > 0) {
      const dx = swimmer.x - shadowGate.x;
      const dy = swimmer.y - shadowGate.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist < gateInfluence) {
        const proximity = 1 - dist / gateInfluence;
        const repelForce = minDimension * 0.14 * proximity * proximity;
        swimmer.ax += (dx / dist) * repelForce;
        swimmer.ay += (dy / dist) * repelForce;
      }
    }

    // --- Integrate velocity with damping ---
    swimmer.vx = ((Number.isFinite(swimmer.vx) ? swimmer.vx : 0) + swimmer.ax * dt) * damping;
    swimmer.vy = ((Number.isFinite(swimmer.vy) ? swimmer.vy : 0) + swimmer.ay * dt) * damping;

    const speed = Math.hypot(swimmer.vx, swimmer.vy);
    if (speed > speedCap) {
      const s = speedCap / speed;
      swimmer.vx *= s;
      swimmer.vy *= s;
    }
    // Keep a hidden baseline drift so currents can immediately bloom into visible motion.
    const flowDirectionX = flowDirection?.x || swimmer.ax || 0;
    const flowDirectionY = flowDirection?.y || swimmer.ay || 0;
    enforceMinimumSwimmerSpeed(swimmer, flowDirectionX, flowDirectionY);

    // Store speed for the renderer to use as opacity.
    swimmer.speed = Math.hypot(swimmer.vx, swimmer.vy);

    swimmer.x += swimmer.vx * dt;
    swimmer.y += swimmer.vy * dt;

    const softMargin = Math.min(ambientWidth, ambientHeight) * 0.02;
    // Bounce swimmers against the ambient bounds.
    if (swimmer.x < ambientBounds.minX + softMargin || swimmer.x > ambientBounds.maxX - softMargin) {
      swimmer.vx *= -0.6;
      swimmer.x = Math.min(ambientBounds.maxX - softMargin, Math.max(ambientBounds.minX + softMargin, swimmer.x));
    }
    if (swimmer.y < ambientBounds.minY + softMargin || swimmer.y > ambientBounds.maxY - softMargin) {
      swimmer.vy *= -0.6;
      swimmer.y = Math.min(ambientBounds.maxY - softMargin, Math.max(ambientBounds.minY + softMargin, swimmer.y));
    }

    // Advance the flicker timer for subtle visual variation.
    swimmer.flicker = Number.isFinite(swimmer.flicker) ? swimmer.flicker : 0;
    swimmer.flicker += dt * 1.2;
  });
}

export { updateBackgroundSwimmers, createBackgroundSwimmer, computeSwimmerCount, computeSwimmerVisibility };
