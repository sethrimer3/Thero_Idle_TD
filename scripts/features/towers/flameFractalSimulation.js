/**
 * Flame Fractal Simulation
 *
 * Implements a lightweight flame fractal renderer using affine transforms and
 * non-linear variations. The offscreen density buffer mirrors the demo shader
 * provided by design and is tone-mapped into a luminous nebula.
 */

import { toneMapBuffer, samplePalette } from './fractalRenderUtils.js';

import { addPanZoomToFractal } from './fractalPanZoom.js';

export class FlameFractalSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d', { willReadFrequently: true }) : null;
    // Enable shared drag-to-pan and zoom interactions on the flame canvas.
    if (typeof this.initPanZoom === 'function') {
      this.initPanZoom(this.canvas);
    }

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

    // Maintain an offscreen surface so tone mapping can be transformed during pan/zoom.
    this.offscreenCanvas = null;
    this.offscreenCtx = null;

    // Store auxiliary ember ribbons that add motion beyond the base flame spiral.
    this.emberNodes = [];
    this.baseEmberCount = 4;
    this.emberPulse = 0;
    this.emberPulseSpeed = 0.015;

    // Initialize drawing buffers based on the provided canvas dimensions.
    this.configureDimensions(this.canvas ? this.canvas.width : 0, this.canvas ? this.canvas.height : 0);

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

    // Advance ember ribbons so they flow even when the fractal pauses to accumulate.
    this.updateEmberAnimation();

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

    const shadingCtx = this.offscreenCtx || this.ctx;

    // Refresh the tone-mapped flame on the offscreen surface so it can be transformed smoothly.
    shadingCtx.fillStyle = '#040108';
    shadingCtx.fillRect(0, 0, this.width, this.height);
    toneMapBuffer(this.accumulator, this.width, this.height, shadingCtx, 'flame-nebula');
    // Overlay luminous ember ribbons that respond to iteron investment.
    this.renderEmberRibbons(shadingCtx);

    if (!this.offscreenCtx) {
      // Fallback: when no offscreen surface exists, the flame already rendered directly to the main canvas.
      return;
    }

    this.ctx.fillStyle = '#040108';
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.applyPanZoomTransform();
    this.ctx.drawImage(this.offscreenCanvas, 0, 0);
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
    this.emberPulseSpeed = 0.012 + normalized * 0.04 + extended * 0.025;
    this.updateEmberBudget(iterons);
    this.refreshEmberSpeeds();
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

  /**
   * Resize internal buffers and the offscreen surface when the hosting canvas changes.
   *
   * @param {number} width - New canvas width in device pixels.
   * @param {number} height - New canvas height in device pixels.
   */
  resize(width, height) {
    this.configureDimensions(width, height);
    this.reset();
  }

  /**
   * Clear accumulated samples so a fresh flame can be rendered after resizing.
   */
  reset() {
    this.totalSamples = 0;
    this.warmup = 200;
    if (this.accumulator) {
      this.accumulator.fill(0);
    }
    this.x = 0;
    this.y = 0;
    this.emberPulse = 0;
  }

  /**
   * Configure drawing buffers and create an offscreen surface for tone mapping.
   *
   * @param {number} width - Canvas width in device pixels.
   * @param {number} height - Canvas height in device pixels.
   */
  configureDimensions(width, height) {
    this.width = Math.max(0, width);
    this.height = Math.max(0, height);
    const size = Math.max(0, this.width * this.height);
    this.accumulator = new Float32Array(size);
    this.warmup = 200;
    this.x = 0;
    this.y = 0;
    this.createOffscreenSurface(this.width, this.height);
  }

  /**
   * Ensure ember ribbons scale with iteron allocation by rebuilding the node list.
   *
   * @param {number} iterons - Current iteron allocation driving the fractal.
   */
  updateEmberBudget(iterons) {
    const desired = this.baseEmberCount + Math.min(6, Math.floor(iterons / 3));
    if (this.emberNodes.length === desired) {
      return;
    }

    const nodes = [];
    for (let i = 0; i < desired; i++) {
      const angle = (i / desired) * Math.PI * 2;
      nodes.push({
        angle,
        radiusScale: 0.85 + Math.random() * 0.75,
        thickness: 0.65 + Math.random() * 0.45,
        baseSpeed: 0.0025 + Math.random() * 0.0035,
        speed: 0,
        phase: Math.random() * Math.PI * 2,
        twist: (Math.random() - 0.5) * 0.6
      });
    }

    this.emberNodes = nodes;
  }

  /**
   * Refresh per-node animation speed so higher iteron levels feel more energetic.
   */
  refreshEmberSpeeds() {
    if (!this.emberNodes.length) {
      return;
    }

    const multiplier = 0.65 + this.iteronInfluence * 2.4;
    for (const node of this.emberNodes) {
      node.speed = node.baseSpeed * multiplier;
    }
  }

  /**
   * Animate ember ribbons so they drift and pulse alongside the flame spiral.
   */
  updateEmberAnimation() {
    if (!this.emberNodes.length) {
      return;
    }

    this.emberPulse += this.emberPulseSpeed;
    if (this.emberPulse > 1) {
      this.emberPulse -= 1;
    }

    const drift = this.rotationSpeed * (0.3 + this.iteronInfluence * 0.8);
    for (const node of this.emberNodes) {
      node.angle += drift + node.speed;
      if (node.angle > Math.PI * 2) {
        node.angle -= Math.PI * 2;
      }
    }
  }

  /**
   * Render soft ember ribbons that orbit the flame and provide visual feedback.
   *
   * @param {CanvasRenderingContext2D} ctx - Rendering context receiving the overlay.
   */
  renderEmberRibbons(ctx) {
    if (!ctx || !this.emberNodes.length) {
      return;
    }

    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    ctx.globalCompositeOperation = 'lighter';

    const baseRadius = Math.min(this.width, this.height) * 0.18;
    const innerColor = samplePalette('flame-nebula', Math.min(1, 0.45 + this.iteronInfluence * 0.4));
    const outerColor = samplePalette('flame-nebula', Math.min(1, 0.82 + this.iteronInfluence * 0.15));

    for (const node of this.emberNodes) {
      const pulse = 0.72 + Math.sin(this.emberPulse * Math.PI * 2 + node.phase) * 0.24;
      const radius = baseRadius * node.radiusScale * (1 + this.iteronInfluence * 0.6);
      const x = Math.cos(node.angle) * radius;
      const y = Math.sin(node.angle) * radius;
      const thickness = Math.max(6, baseRadius * 0.55 * node.thickness * pulse);

      const gradient = ctx.createRadialGradient(x, y, Math.max(1, thickness * 0.25), x, y, Math.max(thickness, 1));
      gradient.addColorStop(0, `rgba(${innerColor.r}, ${innerColor.g}, ${innerColor.b}, 0.9)`);
      gradient.addColorStop(0.58, `rgba(${outerColor.r}, ${outerColor.g}, ${outerColor.b}, 0.36)`);
      gradient.addColorStop(1, 'rgba(10, 0, 18, 0)');
      ctx.fillStyle = gradient;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(node.angle + node.twist);
      ctx.scale(1.25, 0.55 + this.iteronInfluence * 0.35);
      ctx.beginPath();
      ctx.arc(0, 0, thickness, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Build or resize an offscreen canvas so pan and zoom transformations affect the flame.
   *
   * @param {number} width - Surface width.
   * @param {number} height - Surface height.
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
addPanZoomToFractal(FlameFractalSimulation.prototype);
