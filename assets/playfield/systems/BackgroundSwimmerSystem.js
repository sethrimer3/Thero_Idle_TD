// Background swimmer particle system extracted from SimplePlayfield for modular ambient animation.
// Manages small swimming particles that drift with path current and avoid towers/projectiles.

import { areBackgroundParticlesEnabled } from '../../preferences.js';

// Pre-calculated constants for performance
const TWO_PI = Math.PI * 2;
const HALF = 0.5;

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
 * Swimmers have drift velocity and flicker animation for visual variety.
 * 
 * @param {number} width - Viewport width in pixels
 * @param {number} height - Viewport height in pixels
 * @returns {Object} Swimmer object with position, velocity, and visual properties
 */
function createBackgroundSwimmer(width, height) {
  const margin = Math.min(width, height) * 0.05;
  const usableWidth = Math.max(1, width - margin * 2);
  const usableHeight = Math.max(1, height - margin * 2);
  const angle = Math.random() * TWO_PI;
  const drift = 8 + Math.random() * 6;
  return {
    x: margin + Math.random() * usableWidth,
    y: margin + Math.random() * usableHeight,
    vx: Math.cos(angle) * drift,
    vy: Math.sin(angle) * drift,
    ax: 0,
    ay: 0,
    // Seed a subtle pulsation so tiny swimmers feel alive even at low speed.
    flicker: Math.random() * TWO_PI,
    sizeScale: 0.5 + Math.random() * 0.8,
  };
}

/**
 * Update all background swimmer particles with physics-based animation.
 * Swimmers exhibit several behaviors:
 * - Random wandering for organic motion
 * - Path current influence (follows track lanes)
 * - Tower avoidance (repelled by towers)
 * - Projectile avoidance (repelled by active projectiles)
 * - Boundary constraints (soft bounce at edges)
 * - Speed limits (minimum and maximum speeds)
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
  if (!width || !height) {
    return;
  }

  // Tune swimmer motion so they meander slowly but never stall out.
  const dt = Math.max(0, Math.min(delta, 0.05));
  const minDimension = Math.min(width, height);
  const speedFloor = Math.max(6, minDimension * 0.012);
  const speedCap = minDimension * 0.38;
  const wanderStrength = minDimension * 0.22;
  const towerInfluence = minDimension * 0.24;
  const projectileInfluence = minDimension * 0.16;
  const currentWidth = minDimension * 0.18;
  const activityMargin = Math.max(24, currentWidth);
  const damping = dt > 0 ? Math.exp(-dt * 0.8) : 1;
  const blend = dt > 0 ? 1 - Math.exp(-dt * 4.5) : 1;
  const activeBounds = resolveSwimmerActiveBounds.call(this, width, height, activityMargin);
  const activeSwimmers = [];

  this.backgroundSwimmers.forEach((swimmer) => {
    if (!swimmer) {
      return;
    }
    swimmer.isViewportActive = isSwimmerInBounds(swimmer, activeBounds);
    // Off-screen decorative swimmers can pause their heavier behavior work until they matter visually again.
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

  const towerPositions = this.towers.map((tower) => ({ x: tower.x, y: tower.y }));
  const projectilePositions = this.projectiles
    .map((projectile) => {
      if (projectile?.currentPosition?.x !== undefined && projectile?.currentPosition?.y !== undefined) {
        return projectile.currentPosition;
      }
      if (projectile?.position?.x !== undefined && projectile?.position?.y !== undefined) {
        return projectile.position;
      }
      if (projectile?.x !== undefined && projectile?.y !== undefined) {
        return { x: projectile.x, y: projectile.y };
      }
      if (projectile?.source && projectile?.target && Number.isFinite(projectile?.progress)) {
        const ratio = Math.max(0, Math.min(1, projectile.progress));
        const x = projectile.source.x + (projectile.target.x - projectile.source.x) * ratio;
        const y = projectile.source.y + (projectile.target.y - projectile.source.y) * ratio;
        return { x, y };
      }
      return null;
    })
    .filter(Boolean);

  activeSwimmers.forEach((swimmer) => {
    // Keep the motion lively by applying a small random wander every frame.
    swimmer.ax = (Math.random() - 0.5) * wanderStrength;
    swimmer.ay = (Math.random() - 0.5) * wanderStrength;

    let closestDistance = Infinity;
    let flowDirection = null;
    // Let nearby track lanes act like a current that nudges motes forward.
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

    if (flowDirection && closestDistance < currentWidth) {
      const influence = 1 - closestDistance / currentWidth;
      const push = speedFloor * 2.2 * influence;
      swimmer.ax += flowDirection.x * push;
      swimmer.ay += flowDirection.y * push;
    }

    towerPositions.forEach((towerPosition) => {
      const dx = swimmer.x - towerPosition.x;
      const dy = swimmer.y - towerPosition.y;
      const distance = Math.hypot(dx, dy);
      if (!distance || distance >= towerInfluence) {
        return;
      }
      const proximity = 1 - distance / towerInfluence;
      const force = speedFloor * 3.8 * proximity;
      swimmer.ax += (dx / distance) * force;
      swimmer.ay += (dy / distance) * force;
    });

    projectilePositions.forEach((projectilePosition) => {
      const dx = swimmer.x - projectilePosition.x;
      const dy = swimmer.y - projectilePosition.y;
      const distance = Math.hypot(dx, dy);
      if (!distance || distance >= projectileInfluence) {
        return;
      }
      const proximity = 1 - distance / projectileInfluence;
      const force = speedFloor * 2.4 * proximity;
      swimmer.ax += (dx / distance) * force;
      swimmer.ay += (dy / distance) * force;
    });

    swimmer.vx = ((Number.isFinite(swimmer.vx) ? swimmer.vx : 0) + swimmer.ax * dt) * damping;
    swimmer.vy = ((Number.isFinite(swimmer.vy) ? swimmer.vy : 0) + swimmer.ay * dt) * damping;

    const speed = Math.hypot(swimmer.vx, swimmer.vy);
    if (speed > speedCap) {
      const scale = speedCap / speed;
      swimmer.vx *= scale;
      swimmer.vy *= scale;
    } else if (speed < speedFloor) {
      const nudgeAngle = Math.random() * TWO_PI;
      swimmer.vx = Math.cos(nudgeAngle) * speedFloor * 0.65 + swimmer.vx * blend;
      swimmer.vy = Math.sin(nudgeAngle) * speedFloor * 0.65 + swimmer.vy * blend;
    }

    swimmer.x += swimmer.vx * dt;
    swimmer.y += swimmer.vy * dt;

    const softMargin = Math.min(width, height) * 0.02;
    if (swimmer.x < softMargin || swimmer.x > width - softMargin) {
      swimmer.vx *= -0.6;
      swimmer.x = Math.min(width - softMargin, Math.max(softMargin, swimmer.x));
    }
    if (swimmer.y < softMargin || swimmer.y > height - softMargin) {
      swimmer.vy *= -0.6;
      swimmer.y = Math.min(height - softMargin, Math.max(softMargin, swimmer.y));
    }

    // Advance the flicker timer so the renderer can breathe subtle brightness pulses.
    swimmer.flicker = Number.isFinite(swimmer.flicker) ? swimmer.flicker : 0;
    swimmer.flicker += dt * 1.2;
  });
}

export { updateBackgroundSwimmers, createBackgroundSwimmer, computeSwimmerCount };
