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

    if (this.canvas) {
      this.width = this.canvas.width;
      this.height = this.canvas.height;
      this.centerX = this.width / 2;
      this.centerY = this.height / 2; // Center vertically instead of 0.75
      this.spawnRadius = Math.min(this.width, this.height) * 0.22;
      this.killRadius = this.spawnRadius * 1.6;
      this.accumulator = new Float32Array(this.width * this.height);
      this.addParticle(0, 0); // seed crystal
    } else {
      this.width = 0;
      this.height = 0;
      this.centerX = 0;
      this.centerY = 0;
      this.accumulator = new Float32Array(0);
    }
  }

  gridKey(ix, iy) {
    return `${ix},${iy}`;
  }

  addParticle(x, y) {
    // Remember the index before pushing so spatial buckets can reference it directly.
    const pointIndex = this.cluster.length;
    this.cluster.push({ x, y });
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
  gatherNeighbors(pointIndex, searchRadius, maxNeighbors) {
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
          if (neighborIndex <= pointIndex) {
            // Skip duplicates and the point itself; we'll draw each edge once.
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
  }

  render() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    const ctx = this.ctx;
    ctx.fillStyle = '#050208';
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw glowing lines connecting points
    this.applyPanZoomTransform();
    // Use a moderate radius and connection cap to keep the crystalline lattice airy.
    const searchRadius = 32;
    const maxNeighbors = 3;
    ctx.lineWidth = 1.2;
    ctx.shadowBlur = 14;
    ctx.shadowColor = 'rgba(120, 220, 255, 0.6)';

    for (let i = 0; i < this.cluster.length; i++) {
      const point = this.cluster[i];
      const px = this.centerX + point.x;
      const py = this.centerY - point.y;
      const neighbors = this.gatherNeighbors(i, searchRadius, maxNeighbors);

      for (const { index: neighborIndex, distance } of neighbors) {
        const neighbor = this.cluster[neighborIndex];
        if (!neighbor) {
          continue;
        }

        const ox = this.centerX + neighbor.x;
        const oy = this.centerY - neighbor.y;
        const intensity = 1 - Math.min(distance / searchRadius, 1);

        // Blend a cool cyan gradient so the branches pulse outward from the trunk.
        const gradient = ctx.createLinearGradient(px, py, ox, oy);
        const brightColor = `rgba(180, 255, 255, ${0.55 * intensity})`;
        const dimColor = `rgba(90, 190, 255, ${0.25 * intensity})`;
        gradient.addColorStop(0, brightColor);
        gradient.addColorStop(0.5, dimColor);
        gradient.addColorStop(1, brightColor);

        ctx.strokeStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(ox, oy);
        ctx.stroke();
      }
    }

    ctx.shadowBlur = 0;
    this.restorePanZoomTransform();
    
    toneMapBuffer(this.accumulator, this.width, this.height, ctx, 'blue-aurora');
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
}

// Add pan and zoom functionality
addPanZoomToFractal(BrownianTreeSimulation.prototype);
