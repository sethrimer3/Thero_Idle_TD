/**
 * Gosper Curve Simulation
 *
 * Generates the flowsnake (Gosper curve) using the standard L-system with
 * 60-degree turns. The simulation grows smoothly as iterons accumulate by
 * revealing additional segments and deepening the recursion depth.
 */

import { samplePalette, rgbToString } from './fractalRenderUtils.js';

export class GosperCurveSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.iterations = this.clamp(options.iterations || 6, 1, 8);
    this.segmentLength = options.segmentLength || 6;

    this.progress = 0;
    this.targetProgress = 0;
    this.drawSpeed = options.drawSpeed || 0.02;

    this.pathPoints = [];
    this.bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    this.buildPath();
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Construct the L-system command sequence for the requested iteration depth.
   */
  generateSequence() {
    let sequence = 'A';
    const rules = {
      A: 'A-B--B+A++AA+B-',
      B: '+A-BB--B-A++A+B'
    };

    for (let i = 0; i < this.iterations; i++) {
      let next = '';
      for (const ch of sequence) {
        next += rules[ch] || ch;
      }
      sequence = next;
    }
    return sequence;
  }

  /**
   * Generate the 2D path from the L-system sequence.
   */
  buildPath() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    const commands = this.generateSequence();
    const angleStep = (Math.PI / 3); // 60° turns
    let angle = 0;
    let x = 0;
    let y = 0;

    this.pathPoints = [{ x, y }];
    for (const command of commands) {
      if (command === 'F' || command === 'A' || command === 'B') {
        x += Math.cos(angle) * this.segmentLength;
        y += Math.sin(angle) * this.segmentLength;
        this.pathPoints.push({ x, y });
      } else if (command === '+') {
        angle += angleStep;
      } else if (command === '-') {
        angle -= angleStep;
      }
    }

    // Compute bounds for fitting inside canvas
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of this.pathPoints) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }
    this.bounds = { minX, maxX, minY, maxY };
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
    ctx.fillStyle = '#06070b';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const totalSegments = Math.max(0, this.pathPoints.length - 1);
    if (totalSegments === 0) {
      return;
    }

    const visibleSegments = totalSegments * this.progress;
    const fullSegments = Math.floor(visibleSegments);
    const partial = visibleSegments - fullSegments;

    const spanX = this.bounds.maxX - this.bounds.minX || 1;
    const spanY = this.bounds.maxY - this.bounds.minY || 1;
    const scale = 0.85 * Math.min(this.canvas.width / spanX, this.canvas.height / spanY);
    const offsetX = this.canvas.width / 2 - ((this.bounds.minX + this.bounds.maxX) / 2) * scale;
    const offsetY = this.canvas.height / 2 - ((this.bounds.minY + this.bounds.maxY) / 2) * scale;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1, scale * 0.04);

    const drawSegment = (startIndex, endIndex, alpha = 1) => {
      const start = this.pathPoints[startIndex];
      const end = this.pathPoints[endIndex];
      const progress = endIndex / totalSegments;
      const color = samplePalette('blue-aurora', progress);
      ctx.strokeStyle = rgbToString(color, alpha);
      ctx.beginPath();
      ctx.moveTo(offsetX + (start.x - this.bounds.minX) * scale, offsetY + (start.y - this.bounds.minY) * scale);
      ctx.lineTo(offsetX + (end.x - this.bounds.minX) * scale, offsetY + (end.y - this.bounds.minY) * scale);
      ctx.stroke();
    };

    for (let i = 0; i < fullSegments; i++) {
      drawSegment(i, i + 1, 0.95);
    }

    if (partial > 0 && fullSegments < totalSegments) {
      const start = this.pathPoints[fullSegments];
      const end = this.pathPoints[fullSegments + 1];
      const mid = {
        x: start.x + (end.x - start.x) * partial,
        y: start.y + (end.y - start.y) * partial
      };
      const color = samplePalette('blue-aurora', fullSegments / totalSegments);
      ctx.strokeStyle = rgbToString(color, 0.7);
      ctx.beginPath();
      ctx.moveTo(offsetX + (start.x - this.bounds.minX) * scale, offsetY + (start.y - this.bounds.minY) * scale);
      ctx.lineTo(offsetX + (mid.x - this.bounds.minX) * scale, offsetY + (mid.y - this.bounds.minY) * scale);
      ctx.stroke();
    }
  }

  updateConfig(config = {}) {
    let rebuildNeeded = false;

    if (typeof config.iterations === 'number') {
      const newIterations = this.clamp(config.iterations, 1, 8);
      if (newIterations !== this.iterations) {
        this.iterations = newIterations;
        rebuildNeeded = true;
      }
    }

    if (typeof config.segmentLength === 'number') {
      const newLength = Math.max(2, config.segmentLength);
      if (newLength !== this.segmentLength) {
        this.segmentLength = newLength;
        rebuildNeeded = true;
      }
    }

    if (typeof config.allocated === 'number') {
      const required = Math.max(1, 6 + this.iterations * 5);
      this.targetProgress = Math.min(1, config.allocated / required);
    }

    if (rebuildNeeded) {
      this.buildPath();
      this.progress = 0;
      this.targetProgress = 0;
    }
  }
}
