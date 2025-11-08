/**
 * Brownian Tree Simulation
 *
 * Builds a diffusion-limited aggregation cluster that glows like a crystal
 * forest. Each iteron adds a handful of walkers, so the structure blossoms even
 * when resources trickle in one at a time.
 */

import { toneMapBuffer } from './fractalRenderUtils.js';

export class BrownianTreeSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.glowRadius = options.glowRadius || 5;
    this.particleLimit = options.particleLimit || 1800;

    this.cluster = [];
    this.targetParticles = 0;

    this.cellSize = 6;
    this.spawnRadius = 0;
    this.killRadius = 0;
    this.grid = new Map();

    if (this.canvas) {
      this.width = this.canvas.width;
      this.height = this.canvas.height;
      this.centerX = this.width / 2;
      this.centerY = this.height * 0.75;
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
    this.cluster.push({ x, y });
    const ix = Math.round(x / this.cellSize);
    const iy = Math.round(y / this.cellSize);
    this.grid.set(this.gridKey(ix, iy), true);

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
        if (this.grid.has(this.gridKey(ix + dx, iy + dy))) {
          return true;
        }
      }
    }
    return false;
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
    toneMapBuffer(this.accumulator, this.width, this.height, ctx, 'blue-aurora');
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
