/**
 * Flame Fractal Simulation
 *
 * Implements a lightweight flame fractal renderer using affine transforms and
 * non-linear variations. The offscreen density buffer mirrors the demo shader
 * provided by design and is tone-mapped into a luminous nebula.
 */

import { toneMapBuffer } from './fractalRenderUtils.js';

import { addPanZoomToFractal } from './fractalPanZoom.js';

export class FlameFractalSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d', { willReadFrequently: true }) : null;

    this.samplesPerIteron = options.samplesPerIteron || 8000;
    this.targetSamples = 0;
    this.totalSamples = 0;

    this.transforms = [
      { a: 0.82, b: 0.02, c: -0.02, d: 0.82, e: 0.0, f: 1.2, p: 0.70, v: 'spherical' },
      { a: 0.18, b: -0.26, c: 0.22, d: 0.19, e: 1.5, f: 0.6, p: 0.20, v: 'swirl' },
      { a: 0.0, b: 0.24, c: 0.24, d: 0.0, e: -1.1, f: -0.4, p: 0.10, v: 'linear' }
    ];

    if (this.canvas) {
      this.width = this.canvas.width;
      this.height = this.canvas.height;
      this.accumulator = new Float32Array(this.width * this.height);
      this.x = 0;
      this.y = 0;
      this.warmup = 200;
    } else {
      this.width = 0;
      this.height = 0;
      this.accumulator = new Float32Array(0);
      this.x = 0;
      this.y = 0;
      this.warmup = 0;
    }

    this.cdf = [];
    this.buildCDF();
  }

  buildCDF() {
    this.cdf.length = 0;
    let total = 0;
    for (const transform of this.transforms) {
      total += transform.p;
      this.cdf.push(total);
    }
    for (let i = 0; i < this.cdf.length; i++) {
      this.cdf[i] /= total;
    }
  }

  pickTransform() {
    const r = Math.random();
    for (let i = 0; i < this.cdf.length; i++) {
      if (r <= this.cdf[i]) {
        return this.transforms[i];
      }
    }
    return this.transforms[this.transforms.length - 1];
  }

  applyVariation(transform, x, y) {
    let nx = transform.a * x + transform.b * y + transform.e;
    let ny = transform.c * x + transform.d * y + transform.f;

    switch (transform.v) {
      case 'spherical': {
        const r2 = nx * nx + ny * ny + 1e-6;
        nx = nx / r2;
        ny = ny / r2;
        break;
      }
      case 'swirl': {
        const r2 = nx * nx + ny * ny;
        const s = Math.sin(r2);
        const c = Math.cos(r2);
        const tx = nx * c - ny * s;
        const ty = nx * s + ny * c;
        nx = tx;
        ny = ty;
        break;
      }
      default:
        break;
    }

    this.x = nx;
    this.y = ny;
  }

  toPixel(x, y) {
    const scale = 110;
    const px = Math.floor(this.width / 2 + x * scale);
    const py = Math.floor(this.height / 2 - y * scale);
    return { px, py };
  }

  accumulate(samples) {
    if (!this.canvas) {
      return;
    }

    for (let i = 0; i < samples; i++) {
      const transform = this.pickTransform();
      this.applyVariation(transform, this.x, this.y);

      if (this.warmup > 0) {
        this.warmup--;
        continue;
      }

      const { px, py } = this.toPixel(this.x, this.y);
      if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
        this.accumulator[py * this.width + px] += 1;
        this.totalSamples++;
      }
    }
  }

  update() {
    if (!this.canvas) {
      return;
    }

    const remaining = this.targetSamples - this.totalSamples;
    if (remaining <= 0) {
      return;
    }

    const batch = Math.min(remaining, this.samplesPerIteron);
    this.accumulate(batch);
  }

  render() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    this.ctx.fillStyle = '#040108';
    this.ctx.fillRect(0, 0, this.width, this.height);
    toneMapBuffer(this.accumulator, this.width, this.height, this.ctx, 'flame-nebula');
    this.restorePanZoomTransform();
  }

  updateConfig(config = {}) {
    if (typeof config.samplesPerIteron === 'number') {
      this.samplesPerIteron = Math.max(1000, config.samplesPerIteron);
    }

    if (typeof config.allocated === 'number') {
      const desired = Math.floor(config.allocated * this.samplesPerIteron);
      if (desired !== this.targetSamples) {
        this.targetSamples = desired;
      }
    }
  }
}

// Add pan and zoom functionality
addPanZoomToFractal(FlameFractalSimulation.prototype);
