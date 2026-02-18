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
  if (!width || !height) {
    return;
  }

  const dt = Math.max(0, Math.min(delta, 0.05));
  const minDimension = Math.min(width, height);
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
    if (floater.x < edgeMargin) {
      const proximity = 1 - floater.x / edgeMargin;
      floater.ax += edgeRepelStrength * proximity;
    }
    if (width - floater.x < edgeMargin) {
      const proximity = 1 - (width - floater.x) / edgeMargin;
      floater.ax -= edgeRepelStrength * proximity;
    }
    if (floater.y < edgeMargin) {
      const proximity = 1 - floater.y / edgeMargin;
      floater.ay += edgeRepelStrength * proximity;
    }
    if (height - floater.y < edgeMargin) {
      const proximity = 1 - (height - floater.y) / edgeMargin;
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

export { updateFloaters };
