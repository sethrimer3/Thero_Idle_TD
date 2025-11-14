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

    // Capture the starting iteron allocation so the spiral can react immediately.
    const initialAllocated = typeof options.allocated === 'number' ? options.allocated : 0;

    // Dynamic spiral parameters that respond to iteron allocation and elapsed time.
    this.armCount = 3;
    this.iteronInfluence = 0;
    this.spiralTightness = 0.4;
    this.rotationAngle = 0;
    this.rotationSpeed = 0.01;
    this.rotationAccumulator = 0;
    this.rotationUpdateThreshold = 0.08;
    this.decayFactor = 0.985;
    this.transforms = [];
    this.transformDirty = true;
    this.lastAllocated = initialAllocated;

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

    // Seed the transform list using the initial iteron allocation.
    this.updateDynamicParameters(initialAllocated);
    this.generateTransforms();
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
      case 'spiral': {
        // Stretch points outward while adding a gentle angular twist.
        const r = Math.sqrt(nx * nx + ny * ny) + 1e-6;
        const theta = Math.atan2(ny, nx);
        const twist = this.spiralTightness * 0.15;
        const scaledRadius = Math.pow(r, 0.85 + this.iteronInfluence * 0.25);
        nx = scaledRadius * Math.cos(theta + twist);
        ny = scaledRadius * Math.sin(theta + twist);
        break;
      }
      case 'sinusoidal': {
        // Map coordinates through a sine wave to create ember-like wisps.
        nx = Math.sin(nx);
        ny = Math.sin(ny);
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

    // Advance the rotation accumulator so the transform set slowly turns.
    this.rotationAccumulator += this.rotationSpeed;
    if (Math.abs(this.rotationAccumulator) >= this.rotationUpdateThreshold) {
      this.rotationAngle += this.rotationAccumulator;
      this.rotationAccumulator = 0;

      if (this.rotationAngle > Math.PI * 2) {
        this.rotationAngle -= Math.PI * 2;
      } else if (this.rotationAngle < 0) {
        this.rotationAngle += Math.PI * 2;
      }

      this.transformDirty = true;
    }

    this.refreshTransformsIfNeeded();

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
      if (config.allocated !== this.lastAllocated) {
        // Rebuild spiral dynamics when the iteron allocation changes.
        this.lastAllocated = config.allocated;
        this.updateDynamicParameters(config.allocated);
      }
    }
  }

  /**
   * Adjust the spiral parameters so the fractal evolves with iteron investment.
   */
  updateDynamicParameters(allocated = 0) {
    const iterons = Math.max(0, allocated);
    const normalized = Math.min(iterons / 12, 1);
    const extended = Math.min(iterons / 36, 1);

    this.iteronInfluence = normalized;
    this.armCount = 3 + Math.min(3, Math.floor(iterons / 5));
    this.spiralTightness = 0.35 + normalized * 0.8;
    this.rotationSpeed = 0.007 + normalized * 0.035 + extended * 0.02;
    this.decayFactor = 0.992 - normalized * 0.03;
    this.transformDirty = true;
  }

  /**
   * Recompute affine transforms for the flame spiral using the latest parameters.
   */
  generateTransforms() {
    const transforms = [];
    const arms = Math.max(2, Math.min(6, Math.round(this.armCount)));
    const influence = Math.max(0, Math.min(1, this.iteronInfluence));
    const radialOffset = 0.9 + influence * 0.85;
    const scale = 0.68 + influence * 0.22;
    const totalArmProbability = 0.6;
    const armProbability = totalArmProbability / arms;

    for (let i = 0; i < arms; i++) {
      const angle = this.rotationAngle + (i / arms) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      transforms.push({
        a: scale * cos,
        b: -scale * sin,
        c: scale * sin,
        d: scale * cos,
        e: radialOffset * Math.cos(angle),
        f: radialOffset * Math.sin(angle),
        p: armProbability,
        v: 'spiral'
      });
    }

    transforms.push({
      a: 0.32,
      b: -0.28,
      c: 0.28,
      d: 0.32,
      e: 0,
      f: 0.3 + influence * 0.4,
      p: 0.25,
      v: 'swirl'
    });

    transforms.push({
      a: 0.82,
      b: 0.18,
      c: -0.18,
      d: 0.82,
      e: 0.0,
      f: 1.1 + influence * 0.6,
      p: 0.075,
      v: 'spherical'
    });

    transforms.push({
      a: 0.58,
      b: 0.26,
      c: -0.26,
      d: 0.58,
      e: -1.0,
      f: -0.6 - influence * 0.5,
      p: 0.075,
      v: 'sinusoidal'
    });

    this.transforms = transforms;
    this.buildCDF();
    this.transformDirty = false;
  }

  /**
   * Refresh transforms when marked dirty and fade old samples for smoother motion.
   */
  refreshTransformsIfNeeded() {
    if (!this.transformDirty) {
      return;
    }

    this.generateTransforms();
    this.applyDecay();
  }

  /**
   * Soften the accumulator to prevent ghosting when the spiral reorients itself.
   */
  applyDecay() {
    if (!this.accumulator || this.accumulator.length === 0) {
      return;
    }

    const decay = Math.max(0, Math.min(0.999, this.decayFactor));
    for (let i = 0; i < this.accumulator.length; i++) {
      this.accumulator[i] *= decay;
    }

    this.totalSamples *= decay;
  }
}

// Add pan and zoom functionality
addPanZoomToFractal(FlameFractalSimulation.prototype);
