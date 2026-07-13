/**
 * Brownian Tree Simulation
 *
 * Builds a diffusion-limited aggregation cluster that glows like a crystal
 * forest. Each iteron adds a handful of walkers, so the structure blossoms even
 * when resources trickle in one at a time.
 */

import { toneMapBuffer } from './fractalRenderUtils.js';
import { addPanZoomToFractal } from './fractalPanZoom.js';
import {
  ORIGIN_DEFAULTS,
  GROWTH_DEFAULTS,
  CONNECTION_DEFAULTS,
  WALKABLE_MASK_DEFAULTS,
} from './brownianTreeSimulationConfig.js';

export class BrownianTreeSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.originX = typeof options.originX === 'number' ? options.originX : ORIGIN_DEFAULTS.originX;
    this.originY = typeof options.originY === 'number' ? options.originY : ORIGIN_DEFAULTS.originY;
    // Enable shared drag-to-pan and zoom interactions on the Brownian canvas.
    if (typeof this.initPanZoom === 'function') {
      this.initPanZoom(this.canvas);
    }

    this.glowRadius = options.glowRadius || GROWTH_DEFAULTS.glowRadius;
    this.particleLimit = options.particleLimit || GROWTH_DEFAULTS.particleLimit;

    this.cluster = [];
    this.targetParticles = 0;

    this.cellSize = GROWTH_DEFAULTS.cellSize;
    this.spawnRadius = 0;
    this.killRadius = 0;
    // Track particles by grid cell so spatial lookups stay efficient even as the
    // forest fills the canvas with thousands of glowing nodes.
    this.grid = new Map();

    // Animated connection data so new filaments draw outward smoothly from the trunk.
    this.connections = [];
    this.connectionSet = new Set();
    this.connectionGrowthSpeed = options.connectionGrowthSpeed || CONNECTION_DEFAULTS.connectionGrowthSpeed;
    this.connectionSearchRadius = options.connectionSearchRadius || CONNECTION_DEFAULTS.connectionSearchRadius;
    this.maxConnectionNeighbors = options.maxConnectionNeighbors || CONNECTION_DEFAULTS.maxConnectionNeighbors;
    this.pointFlashDuration = options.pointFlashDuration || CONNECTION_DEFAULTS.pointFlashDuration;

    // Optional walkable mask prevents growth from tunneling through solid terrain.
    this.walkableMask = null;
    this.walkableScaleX = WALKABLE_MASK_DEFAULTS.walkableScaleX;
    this.walkableScaleY = WALKABLE_MASK_DEFAULTS.walkableScaleY;
    if (options.walkableMask) {
      this.setWalkableMask(options.walkableMask, { reset: false });
    }

    // Maintain an offscreen canvas so tone-mapped light can follow pan and zoom interactions.
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    // Track whether the tone-mapped buffer needs to be re-rendered. This lets us
    // skip a full Float32Array walk every frame when no new particles were
    // attached, which was the primary cause of sluggishness even for tiny clusters.
    this.needsToneMap = true;

    this.configureDimensions(this.canvas ? this.canvas.width : 0, this.canvas ? this.canvas.height : 0);
  }

  gridKey(ix, iy) {
    return `${ix},${iy}`;
  }

  addParticle(x, y) {
    if (this.isBlocked(x, y)) {
      return;
    }
    // Remember the index before pushing so spatial buckets can reference it directly.
    const pointIndex = this.cluster.length;
    const point = { x, y, flashAge: 0 };
    this.cluster.push(point);
    const ix = Math.round(x / this.cellSize);
    const iy = Math.round(y / this.cellSize);
    const cellKey = this.gridKey(ix, iy);
    let bucket = this.grid.get(cellKey);
    if (!bucket) {
      bucket = [];
      this.grid.set(cellKey, bucket);
    }
    bucket.push(pointIndex);

    const px = Math.round(this.centerX + x);
    const py = Math.round(this.centerY - y);
    if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
      this.accumulator[py * this.width + px] += 1;
    }

    this.registerConnectionsForPoint(pointIndex);
    this.needsToneMap = true;
  }

  nearCluster(x, y) {
    const ix = Math.round(x / this.cellSize);
    const iy = Math.round(y / this.cellSize);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = this.grid.get(this.gridKey(ix + dx, iy + dy));
        if (bucket && bucket.length > 0) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Collect the closest neighbor indices around the provided particle so we can
   * weave glowing branches without checking every single pair in the cluster.
   *
   * @param {number} pointIndex - Index of the particle within the cluster list.
   * @param {number} searchRadius - Maximum distance to consider for a connection.
   * @param {number} maxNeighbors - Hard limit on how many neighbors to connect.
   * @returns {Array<{ index: number, distance: number }>} Sorted neighbor data.
   */
  gatherNeighbors(pointIndex, searchRadius, maxNeighbors, includeLowerIndices = false) {
    const point = this.cluster[pointIndex];
    if (!point) {
      return [];
    }

    const ix = Math.round(point.x / this.cellSize);
    const iy = Math.round(point.y / this.cellSize);
    const cellRadius = Math.ceil(searchRadius / this.cellSize);
    const candidates = [];

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dy = -cellRadius; dy <= cellRadius; dy++) {
        const bucket = this.grid.get(this.gridKey(ix + dx, iy + dy));
        if (!bucket) {
          continue;
        }
        for (const neighborIndex of bucket) {
          if (!includeLowerIndices && neighborIndex <= pointIndex) {
            // Skip duplicates and the point itself; we'll draw each edge once.
            continue;
          }
          if (includeLowerIndices && neighborIndex === pointIndex) {
            continue;
          }
          const neighbor = this.cluster[neighborIndex];
          if (!neighbor) {
            continue;
          }
          const dxPoint = point.x - neighbor.x;
          const dyPoint = point.y - neighbor.y;
          const distance = Math.hypot(dxPoint, dyPoint);
          if (distance <= searchRadius) {
            candidates.push({ index: neighborIndex, distance });
          }
        }
      }
    }

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates.slice(0, maxNeighbors);
  }

  spawnWalker() {
    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = this.spawnRadius;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (!this.isBlocked(x, y)) {
        return {
          x,
          y,
          stepsRemaining: 650
        };
      }
    }
    return { x: 0, y: 0, stepsRemaining: 0 };
  }

  simulateWalker() {
    let walker = this.spawnWalker();
    const stepSize = 4;
    while (walker.stepsRemaining > 0) {
      walker.stepsRemaining--;
      const theta = Math.random() * Math.PI * 2;
      const nextX = walker.x + Math.cos(theta) * stepSize;
      const nextY = walker.y + Math.sin(theta) * stepSize;
      if (this.isBlocked(nextX, nextY)) {
        continue;
      }
      walker.x = nextX;
      walker.y = nextY;

      const distance = Math.hypot(walker.x, walker.y);
      if (distance > this.killRadius) {
        walker = this.spawnWalker();
        continue;
      }

      if (this.nearCluster(walker.x, walker.y)) {
        if (this.isBlocked(walker.x, walker.y)) {
          walker = this.spawnWalker();
          continue;
        }
        this.addParticle(walker.x, walker.y);
        this.spawnRadius = Math.min(this.spawnRadius + 0.15, Math.min(this.width, this.height) * 0.38);
        this.killRadius = this.spawnRadius * 1.8;
        return true;
      }
    }
    return false;
  }

  update() {
    if (!this.canvas) {
      return;
    }

    const iterations = Math.min(25, this.targetParticles - this.cluster.length);
    for (let i = 0; i < iterations; i++) {
      if (this.cluster.length >= this.particleLimit) {
        break;
      }
      const attached = this.simulateWalker();
      if (!attached) {
        break;
      }
    }

    // Animate newly added connections so filaments extend over several frames.
    for (const connection of this.connections) {
      if (connection.progress < 1) {
        connection.progress = Math.min(1, connection.progress + this.connectionGrowthSpeed);
      }
      connection.age = (connection.age || 0) + 1;
    }

    // Age the sparkle halo around freshly attached particles.
    for (const point of this.cluster) {
      if (point && point.flashAge < this.pointFlashDuration) {
        point.flashAge++;
      }
    }
  }

  render() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    const shadingCtx = this.offscreenCtx || this.ctx;
    const usingOffscreen = shadingCtx !== this.ctx;
    const shouldToneMap = this.needsToneMap || !usingOffscreen;

    if (shouldToneMap) {
      // Refresh the density field only when new particles were attached or when
      // we lack an offscreen buffer (fallback mode). This avoids the heavy
      // per-frame tone mapping pass that previously made even a two-point
      // cluster feel sluggish.
      shadingCtx.fillStyle = '#050208';
      shadingCtx.fillRect(0, 0, this.width, this.height);
      toneMapBuffer(this.accumulator, this.width, this.height, shadingCtx, 'blue-aurora');
      this.needsToneMap = false;
    }

    if (usingOffscreen) {
      this.ctx.fillStyle = '#050208';
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // Draw glowing lines connecting points
    this.applyPanZoomTransform();
    if (usingOffscreen) {
      this.ctx.drawImage(this.offscreenCanvas, 0, 0);
    }

    this.ctx.lineWidth = 3.6;
    this.ctx.shadowBlur = 14;
    this.ctx.shadowColor = 'rgba(120, 220, 255, 0.6)';

    for (const connection of this.connections) {
      const source = this.cluster[connection.source];
      const target = this.cluster[connection.target];
      if (!source || !target) {
        continue;
      }

      const startX = this.centerX + source.x;
      const startY = this.centerY - source.y;
      const endX = this.centerX + target.x;
      const endY = this.centerY - target.y;
      const progress = Math.max(0, Math.min(1, connection.progress));
      if (progress <= 0) {
        continue;
      }

      const tipX = startX + (endX - startX) * progress;
      const tipY = startY + (endY - startY) * progress;
      const intensity = connection.intensity;

      const gradient = this.ctx.createLinearGradient(startX, startY, tipX, tipY);
      const brightColor = `rgba(180, 255, 255, ${0.55 * intensity})`;
      const dimColor = `rgba(90, 190, 255, ${0.25 * intensity})`;
      gradient.addColorStop(0, brightColor);
      gradient.addColorStop(0.5, dimColor);
      gradient.addColorStop(1, brightColor);

      this.ctx.strokeStyle = gradient;
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(tipX, tipY);
      this.ctx.stroke();

      if (progress < 1) {
        const glowAlpha = 0.45 + 0.35 * (1 - progress);
        const glowRadius = 3 + intensity * 3;
        this.ctx.globalAlpha = glowAlpha;
        this.ctx.fillStyle = 'rgba(220, 255, 255, 1)';
        this.ctx.beginPath();
        this.ctx.arc(tipX, tipY, glowRadius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
      }
    }

    this.ctx.shadowBlur = 0;

    for (const point of this.cluster) {
      if (!point || point.flashAge >= this.pointFlashDuration) {
        continue;
      }
      const ageFactor = 1 - point.flashAge / this.pointFlashDuration;
      const px = this.centerX + point.x;
      const py = this.centerY - point.y;
      const radius = 2.5 + ageFactor * 3.5;
      const alpha = 0.5 * ageFactor;
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = 'rgba(225, 255, 255, 1)';
      this.ctx.beginPath();
      this.ctx.arc(px, py, radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    }

    this.restorePanZoomTransform();
  }

  updateConfig(config = {}) {
    if (typeof config.allocated === 'number') {
      const desired = Math.min(this.particleLimit, Math.floor(15 + config.allocated * 12));
      if (desired !== this.targetParticles) {
        this.targetParticles = desired;
      }
    }

    if (typeof config.originX === 'number' || typeof config.originY === 'number') {
      const nextOriginX = typeof config.originX === 'number' ? config.originX : this.originX;
      const nextOriginY = typeof config.originY === 'number' ? config.originY : this.originY;
      this.setOrigin(nextOriginX, nextOriginY);
    }

    if (config.walkableMask) {
      this.setWalkableMask(config.walkableMask);
    }
  }

  /**
   * Resize the Brownian canvas and rebuild spatial caches when the UI layout changes.
   *
   * @param {number} width - Canvas width in device pixels.
   * @param {number} height - Canvas height in device pixels.
   */
  resize(width, height) {
    this.configureDimensions(width, height);
  }

  /**
   * Clear accumulators and re-seed the cluster from the origin.
   */
  reset() {
    if (this.accumulator) {
      this.accumulator.fill(0);
    }
    this.cluster = [];
    this.connections = [];
    this.connectionSet = new Set();
    this.grid = new Map();
    this.rebuildWalkableScaling();
    if (this.width > 0 && this.height > 0) {
      const { x, y } = this.findSeedPosition();
      this.addParticle(x, y);
    }
    this.needsToneMap = true;
  }

  /**
   * Configure dimensions, spatial grids, and offscreen rendering buffers.
   *
   * @param {number} width - Canvas width in device pixels.
   * @param {number} height - Canvas height in device pixels.
   */
  configureDimensions(width, height) {
    this.width = Math.max(0, width);
    this.height = Math.max(0, height);
    this.centerX = this.width * this.originX;
    this.centerY = this.height * this.originY;
    const shortestSide = Math.min(this.width, this.height);
    this.spawnRadius = shortestSide > 0 ? shortestSide * 0.22 : 0;
    this.killRadius = this.spawnRadius * 1.6;
    const size = Math.max(0, this.width * this.height);
    this.accumulator = new Float32Array(size);
    this.grid = new Map();
    this.cluster = [];
    this.connections = [];
    this.connectionSet = new Set();
    this.rebuildWalkableScaling();
    if (this.width > 0 && this.height > 0) {
      const { x, y } = this.findSeedPosition();
      this.addParticle(x, y);
    }
    this.createOffscreenSurface(this.width, this.height);
    this.needsToneMap = true;
  }

  /**
   * Register smooth connection animations for a freshly attached particle.
   *
   * @param {number} pointIndex - Index of the particle that was just added.
   */
  registerConnectionsForPoint(pointIndex) {
    const neighbors = this.gatherNeighbors(
      pointIndex,
      this.connectionSearchRadius,
      this.maxConnectionNeighbors,
      true
    );

    for (const { index: neighborIndex, distance } of neighbors) {
      const keyA = Math.min(pointIndex, neighborIndex);
      const keyB = Math.max(pointIndex, neighborIndex);
      const key = `${keyA}-${keyB}`;
      if (this.connectionSet.has(key)) {
        continue;
      }
      this.connectionSet.add(key);

      const intensity = 1 - Math.min(distance / this.connectionSearchRadius, 1);
      this.connections.push({
        source: neighborIndex,
        target: pointIndex,
        progress: 0,
        intensity,
        age: 0
      });
    }
  }

  /**
   * Ensure we have an offscreen surface so tone mapping honours pan and zoom.
   *
   * @param {number} width - Surface width in device pixels.
   * @param {number} height - Surface height in device pixels.
   */
  createOffscreenSurface(width, height) {
    if (width <= 0 || height <= 0) {
      this.offscreenCanvas = null;
      this.offscreenCtx = null;
      this.needsToneMap = true;
      return;
    }

    if (typeof OffscreenCanvas === 'function') {
      if (!this.offscreenCanvas || !(this.offscreenCanvas instanceof OffscreenCanvas)) {
        this.offscreenCanvas = new OffscreenCanvas(width, height);
      } else {
        this.offscreenCanvas.width = width;
        this.offscreenCanvas.height = height;
      }
      this.offscreenCtx = this.offscreenCanvas.getContext('2d');
      return;
    }

    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      if (!this.offscreenCanvas || typeof this.offscreenCanvas.getContext !== 'function') {
        this.offscreenCanvas = document.createElement('canvas');
      }
      this.offscreenCanvas.width = width;
      this.offscreenCanvas.height = height;
      this.offscreenCtx = this.offscreenCanvas.getContext('2d');
      return;
    }

    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    this.needsToneMap = true;
  }

  /**
   * Update the walkable mask that constrains particle movement to empty space.
   * @param {{width:number, height:number, data: Uint8Array}} mask
   * @param {{ reset?: boolean }} options
   */
  setWalkableMask(mask, options = {}) {
    const shouldReset = options.reset !== false;
    if (mask && Number.isFinite(mask.width) && Number.isFinite(mask.height) && mask.data instanceof Uint8Array) {
      this.walkableMask = {
        width: Math.max(1, Math.round(mask.width)),
        height: Math.max(1, Math.round(mask.height)),
        data: mask.data,
      };
    } else {
      this.walkableMask = null;
    }
    this.rebuildWalkableScaling();
    if (shouldReset && this.width > 0 && this.height > 0) {
      this.reset();
    }
  }

  /**
   * Recenter the Brownian origin so the cluster can anchor to arbitrary coordinates.
   * @param {number} originX - Horizontal ratio (0-1) from left edge.
   * @param {number} originY - Vertical ratio (0-1) from top edge.
   */
  setOrigin(originX, originY) {
    this.originX = this.clamp(originX, 0, 1);
    this.originY = this.clamp(originY, 0, 1);
    if (this.width > 0 && this.height > 0) {
      this.centerX = this.width * this.originX;
      this.centerY = this.height * this.originY;
    }
  }

  /**
   * Determine whether a world coordinate sits inside a blocked cell.
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isBlocked(x, y) {
    if (!this.walkableMask) {
      return false;
    }
    const px = Math.round(this.centerX + x);
    const py = Math.round(this.centerY - y);
    if (px < 0 || px >= this.width || py < 0 || py >= this.height) {
      return true;
    }
    const mx = Math.round(px * this.walkableScaleX);
    const my = Math.round(py * this.walkableScaleY);
    if (mx < 0 || mx >= this.walkableMask.width || my < 0 || my >= this.walkableMask.height) {
      return true;
    }
    const index = my * this.walkableMask.width + mx;
    return this.walkableMask.data[index] !== 1;
  }

  /**
   * Recompute the scaling ratio between the canvas and the walkable mask silhouette.
   */
  rebuildWalkableScaling() {
    if (
      this.walkableMask &&
      this.walkableMask.width > 0 &&
      this.walkableMask.height > 0 &&
      this.width > 0 &&
      this.height > 0
    ) {
      this.walkableScaleX = this.walkableMask.width / this.width;
      this.walkableScaleY = this.walkableMask.height / this.height;
    } else {
      this.walkableScaleX = 1;
      this.walkableScaleY = 1;
    }
  }

  /**
   * Locate a valid seed position that is not buried inside blocked terrain.
   * @returns {{x:number, y:number}}
   */
  findSeedPosition() {
    const maxRadius = Math.min(this.width, this.height) * 0.48;
    if (!this.isBlocked(0, 0)) {
      return { x: 0, y: 0 };
    }

    for (let step = 1; step <= 120; step++) {
      const ratio = step / 120;
      const radius = maxRadius * ratio;
      const angle = ratio * Math.PI * 6;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (!this.isBlocked(x, y)) {
        return { x, y };
      }
    }

    return { x: 0, y: 0 };
  }
}

// Add pan and zoom functionality
addPanZoomToFractal(BrownianTreeSimulation.prototype);
