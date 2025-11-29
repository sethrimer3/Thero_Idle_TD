/**
 * Natural Fern L-system Simulation
 *
 * Draws a branching fern using the classic bracketed L-system. Each iteron
 * increases the fraction of drawn segments so new fronds appear immediately,
 * while additional layers increase the recursion depth for richer detail.
 */

import { samplePalette, rgbToString } from './fractalRenderUtils.js';

import { addPanZoomToFractal } from './fractalPanZoom.js';

export class FernLSystemSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    // Enable shared drag-to-pan and zoom interactions on the fern canvas.
    if (typeof this.initPanZoom === 'function') {
      this.initPanZoom(this.canvas);
    }

    // Background color for the canvas - defaults to dark green, can be transparent
    this.bgColor = options.bgColor || '#050705';
    // Palette name for coloring the fern segments - defaults to dark-fern for rich green tones
    this.palette = options.palette || 'dark-fern';

    this.axiom = options.axiom || 'X';
    this.rules = options.rules || {
      X: 'F-[[X]+X]+F[+FX]-X',
      F: 'FF'
    };
    this.turnAngle = (options.turnAngle || 25) * (Math.PI / 180);
    this.baseSegmentLength = options.segmentLength || 6;
    this.segmentLength = this.baseSegmentLength;

    this.depth = 3;
    this.maxDepth = 6;

    this.progress = 0;
    this.targetProgress = 0;
    this.progressEase = 0.02;
    this.segmentGrowthSpeed = options.segmentGrowthSpeed || 0.085;

    this.segments = [];
    this.segmentProgress = new Float32Array(0);
    this.segmentTargets = new Float32Array(0);
    this.segmentComplete = new Uint8Array(0);
    this.activeSegmentCount = 0;
    this.partialSegmentIndex = -1;
    this.buildSegments();
  }

  /**
   * Expand the L-system string up to the configured depth.
   */
  generateSequence() {
    let sequence = this.axiom;
    for (let i = 0; i < this.depth; i++) {
      let next = '';
      for (const ch of sequence) {
        next += this.rules[ch] || ch;
      }
      sequence = next;
    }
    return sequence;
  }

  /**
   * Convert the expanded L-system into drawable line segments.
   */
  buildSegments() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    const commands = this.generateSequence();
    const stack = [];
    const segments = [];

    let x = this.canvas.width / 2;
    let y = this.canvas.height;
    let angle = -Math.PI / 2;
    let length = this.segmentLength;

    for (const command of commands) {
      if (command === 'F') {
        const nx = x + Math.cos(angle) * length;
        const ny = y + Math.sin(angle) * length;
        segments.push({ x1: x, y1: y, x2: nx, y2: ny });
        x = nx;
        y = ny;
      } else if (command === '+') {
        angle += this.turnAngle;
      } else if (command === '-') {
        angle -= this.turnAngle;
      } else if (command === '[') {
        stack.push({ x, y, angle });
      } else if (command === ']') {
        const state = stack.pop();
        if (state) {
          x = state.x;
          y = state.y;
          angle = state.angle;
        }
      }
    }

    this.segments = segments;
    this.resetAnimationState();
  }

  update() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    if (this.progress < this.targetProgress) {
      this.progress = Math.min(this.targetProgress, this.progress + this.progressEase);
    } else if (this.progress > this.targetProgress) {
      this.progress = Math.max(this.targetProgress, this.progress - this.progressEase);
    }

    const totalSegments = this.segments.length;
    if (totalSegments === 0) {
      return;
    }

    // Determine how many segments should currently be animating.
    const segmentProgressTarget = this.progress * totalSegments;
    const targetFullSegments = Math.min(totalSegments, Math.floor(segmentProgressTarget));
    const partialRemainder = Math.min(1, segmentProgressTarget - targetFullSegments);

    // Upgrade previously partial segments if the global target moved beyond them.
    if (this.partialSegmentIndex !== -1 && this.partialSegmentIndex < targetFullSegments) {
      this.segmentTargets[this.partialSegmentIndex] = 1;
      this.partialSegmentIndex = -1;
    }

    // Start any new fully-grown segments that should now be animating.
    while (this.activeSegmentCount < targetFullSegments && this.activeSegmentCount < totalSegments) {
      this.segmentTargets[this.activeSegmentCount] = 1;
      this.activeSegmentCount++;
    }

    // Handle the trailing partial segment that is currently drawing in.
    if (partialRemainder > 0) {
      if (this.partialSegmentIndex !== -1) {
        this.segmentTargets[this.partialSegmentIndex] = Math.max(this.segmentTargets[this.partialSegmentIndex], partialRemainder);
      } else if (this.activeSegmentCount < totalSegments) {
        this.segmentTargets[this.activeSegmentCount] = partialRemainder;
        this.partialSegmentIndex = this.activeSegmentCount;
        this.activeSegmentCount++;
      }
    } else if (this.partialSegmentIndex !== -1) {
      this.segmentTargets[this.partialSegmentIndex] = 1;
      this.partialSegmentIndex = -1;
    }

    const maxAnimatedIndex = this.partialSegmentIndex !== -1 ? this.partialSegmentIndex : this.activeSegmentCount - 1;
    for (let i = 0; i <= maxAnimatedIndex && i < this.segmentTargets.length; i++) {
      const target = this.segmentTargets[i];
      if (target <= 0) {
        continue;
      }
      if (this.segmentProgress[i] < target) {
        this.segmentProgress[i] = Math.min(target, this.segmentProgress[i] + this.segmentGrowthSpeed);
      }
      if (this.segmentProgress[i] >= 1) {
        this.segmentComplete[i] = 1;
      }
    }
  }

  render() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    const ctx = this.ctx;
    // Clear the canvas with the configured background color (supports transparency)
    if (this.bgColor === 'rgba(0, 0, 0, 0)' || this.bgColor === 'transparent') {
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      ctx.fillStyle = this.bgColor;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.applyPanZoomTransform();

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const maxSegmentsToDraw = Math.min(this.activeSegmentCount, this.segmentProgress.length);
    for (let i = 0; i < maxSegmentsToDraw; i++) {
      const progress = this.segmentProgress[i];
      if (progress <= 0) {
        continue;
      }
      const seg = this.segments[i];
      const clamped = Math.min(progress, 1);
      const px = seg.x1 + (seg.x2 - seg.x1) * clamped;
      const py = seg.y1 + (seg.y2 - seg.y1) * clamped;
      const t = this.segments.length > 0 ? i / this.segments.length : 0;
      const color = samplePalette(this.palette, t);
      ctx.strokeStyle = rgbToString(color, 0.9);
      ctx.lineWidth = Math.max(1, 4 - t * 3);
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(px, py);
      ctx.stroke();

      if (progress < 1) {
        const tipAlpha = 0.35 + 0.25 * (1 - progress);
        const radius = Math.max(1.5, 4 - t * 2);
        ctx.globalAlpha = tipAlpha;
        ctx.fillStyle = rgbToString(color, 1);
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    this.restorePanZoomTransform();
  }

  /**
   * Reset all per-segment animation state after rebuilding the fern geometry.
   */
  resetAnimationState() {
    const total = this.segments.length;
    this.segmentProgress = new Float32Array(total);
    this.segmentTargets = new Float32Array(total);
    this.segmentComplete = new Uint8Array(total);
    this.activeSegmentCount = 0;
    this.partialSegmentIndex = -1;
  }

  updateConfig(config = {}) {
    let rebuildNeeded = false;
    let allocatedValue = null;

    if (typeof config.layersCompleted === 'number') {
      const newDepth = Math.min(this.maxDepth, 3 + config.layersCompleted);
      if (newDepth !== this.depth) {
        this.depth = newDepth;
        rebuildNeeded = true;
      }
      const scaledLength = Math.max(2, this.baseSegmentLength * Math.pow(0.82, this.depth - 3));
      if (scaledLength !== this.segmentLength) {
        this.segmentLength = scaledLength;
        rebuildNeeded = true;
      }
    }

    if (typeof config.allocated === 'number') {
      allocatedValue = config.allocated;
      const growthUnits = Math.max(1, 4 + this.depth * 4);
      this.targetProgress = Math.min(1, allocatedValue / growthUnits);
    }

    if (rebuildNeeded) {
      this.buildSegments();
      this.progress = 0;
      this.targetProgress = 0;
      if (allocatedValue !== null) {
        const growthUnits = Math.max(1, 4 + this.depth * 4);
        this.targetProgress = Math.min(1, allocatedValue / growthUnits);
      }
    }
  }
}

// Add pan and zoom functionality
addPanZoomToFractal(FernLSystemSimulation.prototype);
