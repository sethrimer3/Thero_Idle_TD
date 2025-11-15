/**
 * Brownian Tree Simulation
 *
 * Builds a diffusion-limited aggregation cluster that glows like a crystal
 * forest. Each iteron adds a handful of walkers, so the structure blossoms even
 * when resources trickle in one at a time.
 */

import { toneMapBuffer } from './fractalRenderUtils.js';

import { addPanZoomToFractal } from './fractalPanZoom.js';

export class BrownianTreeSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    // Enable shared drag-to-pan and zoom interactions on the Brownian canvas.
    if (typeof this.initPanZoom === 'function') {
      this.initPanZoom(this.canvas);
    }

    this.glowRadius = options.glowRadius || 5;
    this.particleLimit = options.particleLimit || 1800;

    this.cluster = [];
    this.targetParticles = 0;

    this.cellSize = 6;
    this.spawnRadius = 0;
    this.killRadius = 0;
    // Track particles by grid cell so spatial lookups stay efficient even as the
    // forest fills the canvas with thousands of glowing nodes.
    this.grid = new Map();

    // Animated connection data so new filaments draw outward smoothly from the trunk.
    this.connections = [];
    this.connectionSet = new Set();
    this.connectionGrowthSpeed = options.connectionGrowthSpeed || 0.12;
    this.connectionSearchRadius = options.connectionSearchRadius || 32;
    this.maxConnectionNeighbors = options.maxConnectionNeighbors || 3;
    this.pointFlashDuration = options.pointFlashDuration || 18;

    // Maintain an offscreen canvas so tone-mapped light can follow pan and zoom interactions.
    this.offscreenCanvas = null;
    this.offscreenCtx = null;

    this.configureDimensions(this.canvas ? this.canvas.width : 0, this.canvas ? this.canvas.height : 0);
  }

  gridKey(ix, iy) {
    return `${ix},${iy}`;
  }

  addParticle(x, y) {
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
    const angle = Math.random() * Math.PI * 2;
    const radius = this.spawnRadius;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      stepsRemaining: 650
    };
  }

  simulateWalker() {
    let walker = this.spawnWalker();
    const stepSize = 4;
    while (walker.stepsRemaining > 0) {
      walker.stepsRemaining--;
      const theta = Math.random() * Math.PI * 2;
      walker.x += Math.cos(theta) * stepSize;
      walker.y += Math.sin(theta) * stepSize;

      const distance = Math.hypot(walker.x, walker.y);
      if (distance > this.killRadius) {
        walker = this.spawnWalker();
        continue;
      }

      if (this.nearCluster(walker.x, walker.y)) {
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

    // Refresh the density field so the glow responds when the camera moves.
    shadingCtx.fillStyle = '#050208';
    shadingCtx.fillRect(0, 0, this.width, this.height);
    toneMapBuffer(this.accumulator, this.width, this.height, shadingCtx, 'blue-aurora');

    if (usingOffscreen) {
      this.ctx.fillStyle = '#050208';
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // Draw glowing lines connecting points
    this.applyPanZoomTransform();
    if (usingOffscreen) {
      this.ctx.drawImage(this.offscreenCanvas, 0, 0);
    }

    this.ctx.lineWidth = 1.2;
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
    if (this.width > 0 && this.height > 0) {
      this.addParticle(0, 0);
    }
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
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
    const shortestSide = Math.min(this.width, this.height);
    this.spawnRadius = shortestSide > 0 ? shortestSide * 0.22 : 0;
    this.killRadius = this.spawnRadius * 1.6;
    const size = Math.max(0, this.width * this.height);
    this.accumulator = new Float32Array(size);
    this.grid = new Map();
    this.cluster = [];
    this.connections = [];
    this.connectionSet = new Set();
    if (this.width > 0 && this.height > 0) {
      this.addParticle(0, 0);
    }
    this.createOffscreenSurface(this.width, this.height);
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
  }
}

// Add pan and zoom functionality
addPanZoomToFractal(BrownianTreeSimulation.prototype);
