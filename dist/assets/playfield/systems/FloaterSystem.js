// Floater particle system extracted from SimplePlayfield for modular particle animation handling.
// Manages background ambient particles with physics-based repulsion from edges, towers, and enemies.

/**
 * Update floater particles with physics-based repulsion and connection rendering.
 * Floaters are ambient background particles that drift and connect when near each other,
 * while avoiding towers, enemies, and canvas edges.
 */
function updateFloaters(delta) {
  if (!this.floaters.length || !this.levelConfig) {
    return;
  }

  const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  const ambientBounds = this.floaterBounds || { minX: 0, minY: 0, maxX: width, maxY: height, width, height };
  const ambientWidth = Math.max(0, Number.isFinite(ambientBounds.width) ? ambientBounds.width : (ambientBounds.maxX - ambientBounds.minX));
  const ambientHeight = Math.max(0, Number.isFinite(ambientBounds.height) ? ambientBounds.height : (ambientBounds.maxY - ambientBounds.minY));
  if (!width || !height || !ambientWidth || !ambientHeight) {
    return;
  }

  const dt = Math.max(0, Math.min(delta, 0.05));
  const minDimension = Math.min(ambientWidth, ambientHeight);
  if (!minDimension) {
    return;
  }

  const influenceScale = Math.max(0.6, Math.min(1.4, minDimension / 600));
  const pairDistance = minDimension * 0.28;
  const towerInfluence = minDimension * 0.3;
  const nodeInfluence = minDimension * 0.32;
  const enemyInfluence = minDimension * 0.26;
  const edgeMargin = minDimension * 0.12;

  const pairRepelStrength = 18 * influenceScale;
  const towerRepelStrength = 42 * influenceScale;
  const enemyRepelStrength = 46 * influenceScale;
  const edgeRepelStrength = 24 * influenceScale;

  const damping = dt > 0 ? Math.exp(-dt * 1.6) : 1;
  const smoothing = dt > 0 ? 1 - Math.exp(-dt * 6) : 1;
  const maxSpeed = minDimension * 0.6;

  const floaters = this.floaters;
  const connections = [];

  const startPoint = this.pathPoints.length ? this.pathPoints[0] : null;
  const endPoint =
    this.pathPoints.length > 1 ? this.pathPoints[this.pathPoints.length - 1] : startPoint;

  const towerPositions = this.towers.map((tower) => ({ x: tower.x, y: tower.y }));
  const enemyPositions = this.enemies.map((enemy) => this.getEnemyPosition(enemy));

  for (let index = 0; index < floaters.length; index += 1) {
    const floater = floaters[index];
    floater.ax = 0;
    floater.ay = 0;
    floater.opacityTarget = 0;
  }

  for (let i = 0; i < floaters.length - 1; i += 1) {
    const a = floaters[i];
    for (let j = i + 1; j < floaters.length; j += 1) {
      const b = floaters[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      if (!distance || distance >= pairDistance) {
        continue;
      }
      const proximity = 1 - distance / pairDistance;
      const force = pairRepelStrength * proximity;
      const dirX = dx / distance;
      const dirY = dy / distance;
      a.ax -= dirX * force;
      a.ay -= dirY * force;
      b.ax += dirX * force;
      b.ay += dirY * force;
      const connectionStrength = Math.min(1, proximity);
      connections.push({ from: i, to: j, strength: connectionStrength });
      a.opacityTarget = Math.max(a.opacityTarget, proximity);
      b.opacityTarget = Math.max(b.opacityTarget, proximity);
    }
  }

  floaters.forEach((floater) => {
    if (floater.x < ambientBounds.minX + edgeMargin) {
      const proximity = 1 - (floater.x - ambientBounds.minX) / edgeMargin;
      floater.ax += edgeRepelStrength * proximity;
    }
    if (ambientBounds.maxX - floater.x < edgeMargin) {
      const proximity = 1 - (ambientBounds.maxX - floater.x) / edgeMargin;
      floater.ax -= edgeRepelStrength * proximity;
    }
    if (floater.y < ambientBounds.minY + edgeMargin) {
      const proximity = 1 - (floater.y - ambientBounds.minY) / edgeMargin;
      floater.ay += edgeRepelStrength * proximity;
    }
    if (ambientBounds.maxY - floater.y < edgeMargin) {
      const proximity = 1 - (ambientBounds.maxY - floater.y) / edgeMargin;
      floater.ay -= edgeRepelStrength * proximity;
    }

    towerPositions.forEach((towerPosition) => {
      const dx = floater.x - towerPosition.x;
      const dy = floater.y - towerPosition.y;
      const distance = Math.hypot(dx, dy);
      if (!distance || distance >= towerInfluence) {
        return;
      }
      const proximity = 1 - distance / towerInfluence;
      const force = towerRepelStrength * proximity;
      const dirX = dx / distance;
      const dirY = dy / distance;
      floater.ax += dirX * force;
      floater.ay += dirY * force;
    });

    enemyPositions.forEach((enemyPosition) => {
      const dx = floater.x - enemyPosition.x;
      const dy = floater.y - enemyPosition.y;
      const distance = Math.hypot(dx, dy);
      if (!distance || distance >= enemyInfluence) {
        return;
      }
      const proximity = 1 - distance / enemyInfluence;
      const force = enemyRepelStrength * proximity;
      const dirX = dx / distance;
      const dirY = dy / distance;
      floater.ax += dirX * force;
      floater.ay += dirY * force;
    });

    if (startPoint && endPoint) {
      [startPoint, endPoint].forEach((point) => {
        const dx = floater.x - point.x;
        const dy = floater.y - point.y;
        const distance = Math.hypot(dx, dy);
        if (!distance || distance >= nodeInfluence) {
          return;
        }
        const proximity = 1 - distance / nodeInfluence;
        const force = towerRepelStrength * proximity;
        const dirX = dx / distance;
        const dirY = dy / distance;
        floater.ax += dirX * force;
        floater.ay += dirY * force;
      });
    }

    floater.vx = floater.vx * damping + floater.ax * dt;
    floater.vy = floater.vy * damping + floater.ay * dt;

    const speed = Math.hypot(floater.vx, floater.vy);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      floater.vx *= scale;
      floater.vy *= scale;
    }

    floater.x += floater.vx * dt;
    floater.y += floater.vy * dt;

    floater.opacityTarget = Math.min(1, Math.max(0, floater.opacityTarget));
    if (!Number.isFinite(floater.opacity)) {
      floater.opacity = 0;
    }
    const blend = smoothing;
    floater.opacity += (floater.opacityTarget - floater.opacity) * blend;
    floater.opacity = Math.min(1, Math.max(0, floater.opacity));
  });

  this.floaterConnections = connections;
}

/**
 * Calculate the target floater count for the given canvas dimensions.
 * Clamps between 18 and 64 particles to keep density consistent across screen sizes.
 */
function computeFloaterCount(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return 0;
  }
  const area = Math.max(0, width * height);
  const base = Math.round(area / 24000);
  return Math.max(18, Math.min(64, base));
}

/**
 * Return a random radius factor for a new floater particle.
 */
function randomFloaterRadiusFactor() {
  return 0.0075 + Math.random() * 0.0045;
}

/**
 * Create a single floater particle seeded within the given ambient bounds.
 * Accepts either a bounds object or legacy (width, height) arguments.
 */
function createFloater(width, height) {
  // Support both legacy width/height calls and explicit ambient-bounds objects.
  const bounds = (typeof width === 'object' && width)
    ? width
    : { minX: 0, minY: 0, maxX: width, maxY: height, width, height };
  const boundsWidth = Math.max(1, Number.isFinite(bounds.width) ? bounds.width : (bounds.maxX - bounds.minX));
  const boundsHeight = Math.max(1, Number.isFinite(bounds.height) ? bounds.height : (bounds.maxY - bounds.minY));
  const margin = Math.min(boundsWidth, boundsHeight) * 0.08;
  const usableWidth = Math.max(1, boundsWidth - margin * 2);
  const usableHeight = Math.max(1, boundsHeight - margin * 2);
  return {
    // Seed floater positions across the full ambient effect bounds so zoomed-out edges stay populated.
    x: (Number.isFinite(bounds.minX) ? bounds.minX : 0) + margin + Math.random() * usableWidth,
    y: (Number.isFinite(bounds.minY) ? bounds.minY : 0) + margin + Math.random() * usableHeight,
    vx: (Math.random() - 0.5) * 12,
    vy: (Math.random() - 0.5) * 12,
    ax: 0,
    ay: 0,
    radiusFactor: randomFloaterRadiusFactor(),
    opacity: 0,
    opacityTarget: 0,
  };
}

/**
 * Compute the ambient effect bounds, expanded to cover the full zoomed-out viewport.
 * Used by floaters, background swimmers, and background renderers.
 */
function getAmbientEffectBounds() {
  const width = this.renderWidth || 0;
  const height = this.renderHeight || 0;
  if (!width || !height) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  // Expand ambient/background effect bounds to match what the camera can reveal at the minimum zoom scale.
  const minScale = Math.max(this.minViewScale || 1, 0.0001);
  const overflowX = Math.max(0, ((1 / minScale) - 1) * width * 0.5);
  const overflowY = Math.max(0, ((1 / minScale) - 1) * height * 0.5);
  return {
    minX: -overflowX,
    minY: -overflowY,
    maxX: width + overflowX,
    maxY: height + overflowY,
    width: width + overflowX * 2,
    height: height + overflowY * 2,
  };
}

/**
 * Synchronise floater and background-swimmer arrays with the current canvas size.
 * Repositions existing particles proportionally when the ambient bounds change, and
 * adds or removes entries to reach the target counts.
 */
function ensureFloatersLayout() {
  const width = this.renderWidth || 0;
  const height = this.renderHeight || 0;
  const ambientBounds = this.getAmbientEffectBounds();

  if (!this.levelConfig || !width || !height) {
    this.floaters = [];
    this.floaterConnections = [];
    this.floaterBounds = { ...ambientBounds };
    this.backgroundSwimmers = [];
    this.swimmerBounds = { ...ambientBounds };
    return;
  }

  const previousFloaterBounds = this.floaterBounds || ambientBounds;
  const previousSwimmerBounds = this.swimmerBounds || ambientBounds;
  const previousWidth = Math.max(1, previousFloaterBounds.width || width);
  const previousHeight = Math.max(1, previousFloaterBounds.height || height);
  const previousSwimmerWidth = Math.max(1, previousSwimmerBounds.width || width);
  const previousSwimmerHeight = Math.max(1, previousSwimmerBounds.height || height);

  if (this.floaters.length && (
    previousFloaterBounds.minX !== ambientBounds.minX ||
    previousFloaterBounds.minY !== ambientBounds.minY ||
    previousWidth !== ambientBounds.width ||
    previousHeight !== ambientBounds.height
  )) {
    this.floaters.forEach((floater) => {
      // Preserve normalized floater placement when ambient bounds change (resize/zoom setting changes).
      const normalizedX = (floater.x - (previousFloaterBounds.minX || 0)) / previousWidth;
      const normalizedY = (floater.y - (previousFloaterBounds.minY || 0)) / previousHeight;
      floater.x = ambientBounds.minX + normalizedX * ambientBounds.width;
      floater.y = ambientBounds.minY + normalizedY * ambientBounds.height;
    });
  }

  if (this.backgroundSwimmers.length && (
    previousSwimmerBounds.minX !== ambientBounds.minX ||
    previousSwimmerBounds.minY !== ambientBounds.minY ||
    previousSwimmerWidth !== ambientBounds.width ||
    previousSwimmerHeight !== ambientBounds.height
  )) {
    this.backgroundSwimmers.forEach((swimmer) => {
      // Keep swimmer distribution stable while remapping to the updated ambient bounds.
      const normalizedX = (swimmer.x - (previousSwimmerBounds.minX || 0)) / previousSwimmerWidth;
      const normalizedY = (swimmer.y - (previousSwimmerBounds.minY || 0)) / previousSwimmerHeight;
      swimmer.x = ambientBounds.minX + normalizedX * ambientBounds.width;
      swimmer.y = ambientBounds.minY + normalizedY * ambientBounds.height;
    });
  }

  const desired = this.computeFloaterCount(ambientBounds.width, ambientBounds.height);

  if (!this.floaters.length) {
    this.floaters = [];
  }

  if (this.floaters.length < desired) {
    const needed = desired - this.floaters.length;
    for (let index = 0; index < needed; index += 1) {
      this.floaters.push(this.createFloater(ambientBounds));
    }
  } else if (this.floaters.length > desired) {
    this.floaters.length = desired;
  }

  const desiredSwimmers = this.computeSwimmerCount(ambientBounds.width, ambientBounds.height);
  if (!this.backgroundSwimmers.length) {
    this.backgroundSwimmers = [];
  }

  if (this.backgroundSwimmers.length < desiredSwimmers) {
    const needed = desiredSwimmers - this.backgroundSwimmers.length;
    for (let index = 0; index < needed; index += 1) {
      this.backgroundSwimmers.push(this.createBackgroundSwimmer(ambientBounds));
    }
  } else if (this.backgroundSwimmers.length > desiredSwimmers) {
    this.backgroundSwimmers.length = desiredSwimmers;
  }

  const safeMargin = Math.min(ambientBounds.width, ambientBounds.height) * 0.04;
  this.floaters.forEach((floater) => {
    // Clamp floaters inside ambient bounds so they can populate zoomed-out edges without escaping forever.
    floater.x = Math.min(ambientBounds.maxX - safeMargin, Math.max(ambientBounds.minX + safeMargin, floater.x));
    floater.y = Math.min(ambientBounds.maxY - safeMargin, Math.max(ambientBounds.minY + safeMargin, floater.y));
    if (!Number.isFinite(floater.vx)) {
      floater.vx = 0;
    }
    if (!Number.isFinite(floater.vy)) {
      floater.vy = 0;
    }
    if (!Number.isFinite(floater.radiusFactor)) {
      floater.radiusFactor = this.randomFloaterRadiusFactor();
    }
    floater.opacity = Number.isFinite(floater.opacity) ? floater.opacity : 0;
    floater.opacityTarget = Number.isFinite(floater.opacityTarget)
      ? floater.opacityTarget
      : 0;
    floater.ax = Number.isFinite(floater.ax) ? floater.ax : 0;
    floater.ay = Number.isFinite(floater.ay) ? floater.ay : 0;
  });

  this.backgroundSwimmers.forEach((swimmer) => {
    // Clamp swimmers to the same ambient region so all decorative layers share matching extents.
    swimmer.x = Math.min(ambientBounds.maxX - safeMargin, Math.max(ambientBounds.minX + safeMargin, swimmer.x));
    swimmer.y = Math.min(ambientBounds.maxY - safeMargin, Math.max(ambientBounds.minY + safeMargin, swimmer.y));
    swimmer.vx = Number.isFinite(swimmer.vx) ? swimmer.vx : 0;
    swimmer.vy = Number.isFinite(swimmer.vy) ? swimmer.vy : 0;
    swimmer.ax = Number.isFinite(swimmer.ax) ? swimmer.ax : 0;
    swimmer.ay = Number.isFinite(swimmer.ay) ? swimmer.ay : 0;
    swimmer.flicker = Number.isFinite(swimmer.flicker) ? swimmer.flicker : 0;
    swimmer.sizeScale = Number.isFinite(swimmer.sizeScale) ? swimmer.sizeScale : 1;
  });

  this.floaterBounds = { ...ambientBounds };
  this.swimmerBounds = { ...ambientBounds };
}

export {
  updateFloaters,
  computeFloaterCount,
  randomFloaterRadiusFactor,
  createFloater,
  getAmbientEffectBounds,
  ensureFloatersLayout,
};
