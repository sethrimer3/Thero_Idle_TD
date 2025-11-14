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
    this.drawSpeed = 0.05;

    this.segments = [];
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
  }

  update() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    if (this.progress < this.targetProgress) {
      this.progress = Math.min(this.targetProgress, this.progress + this.drawSpeed);
    }
  }

  render() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    const ctx = this.ctx;
    ctx.fillStyle = '#050705';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.applyPanZoomTransform();

    const totalSegments = this.segments.length;
    if (totalSegments === 0) {
      return;
    }

    const visibleSegments = Math.floor(totalSegments * this.progress);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < visibleSegments; i++) {
      const seg = this.segments[i];
      const t = i / totalSegments;
      const color = samplePalette('emerald-ink', t);
      ctx.strokeStyle = rgbToString(color, 0.9);
      ctx.lineWidth = Math.max(1, 4 - t * 3);
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
    }
    this.restorePanZoomTransform();
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
