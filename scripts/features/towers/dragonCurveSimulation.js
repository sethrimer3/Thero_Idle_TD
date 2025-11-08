/**
 * Dragon Curve Simulation
 *
 * Generates the Heighway dragon via the folding sequence. The sequence of
 * turns is built recursively using the relation:
 *   S_{n+1} = S_n ⊕ [1] ⊕ invert(reverse(S_n))
 * where 1 denotes a left turn (+90°) and -1 denotes a right turn (-90°).
 */
export class DragonCurveSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.iterations = this.clamp(options.iterations || 12, 5, 16);
    this.segmentLength = options.segmentLength || 5;

    this.bgColor = options.bgColor || '#090b11';
    this.lineStartColor = options.lineStartColor || '#7f9cff';
    this.lineEndColor = options.lineEndColor || '#ffd29d';
    this.lineWidth = options.lineWidth || 1.1;

    this.turnSequence = [];
    this.pathPoints = [];
    this.progress = 0;
    this.targetProgress = 0; // Target progress based on allocated resources
    this.drawSpeed = options.drawSpeed || 0.015;

    this.buildSequence();
    this.buildPath();
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  buildSequence() {
    this.turnSequence = [1];
    for (let i = 1; i < this.iterations; i++) {
      const previous = [...this.turnSequence];
      const mirrored = previous.slice().reverse().map(turn => -turn);
      this.turnSequence = [...previous, 1, ...mirrored];
    }
  }

  buildPath() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    const directions = [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 0, y: -1 }
    ];

    let dirIndex = 0;
    let x = this.canvas.width / 2;
    let y = this.canvas.height / 2;

    this.pathPoints = [{ x, y }];

    for (const turn of this.turnSequence) {
      dirIndex = (dirIndex + turn + 4) % 4;
      x += directions[dirIndex].x * this.segmentLength;
      y += directions[dirIndex].y * this.segmentLength;
      this.pathPoints.push({ x, y });
    }
  }

  interpolateColor(factor) {
    const clampFactor = Math.max(0, Math.min(1, factor));
    const start = this.parseColor(this.lineStartColor);
    const end = this.parseColor(this.lineEndColor);
    const r = Math.round(start.r + (end.r - start.r) * clampFactor);
    const g = Math.round(start.g + (end.g - start.g) * clampFactor);
    const b = Math.round(start.b + (end.b - start.b) * clampFactor);
    return `rgb(${r}, ${g}, ${b})`;
  }

  parseColor(hex) {
    const clean = hex.replace('#', '');
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16)
    };
  }

  update() {
    if (!this.canvas || !this.ctx) {
      return;
    }
    // Grow toward target progress based on allocated resources
    if (this.progress < this.targetProgress) {
      this.progress = Math.min(this.targetProgress, this.progress + this.drawSpeed);
    }
  }

  render() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    const ctx = this.ctx;
    ctx.fillStyle = this.bgColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = this.lineWidth;

    const totalSegments = this.pathPoints.length - 1;
    const visibleSegments = totalSegments * this.progress;
    const fullSegments = Math.floor(visibleSegments);
    const partial = visibleSegments - fullSegments;

    for (let i = 0; i < fullSegments; i++) {
      const start = this.pathPoints[i];
      const end = this.pathPoints[i + 1];
      const t = i / totalSegments;
      ctx.strokeStyle = this.interpolateColor(t);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    if (partial > 0 && fullSegments < totalSegments) {
      const start = this.pathPoints[fullSegments];
      const end = this.pathPoints[fullSegments + 1];
      const px = start.x + (end.x - start.x) * partial;
      const py = start.y + (end.y - start.y) * partial;
      const t = fullSegments / totalSegments;
      ctx.strokeStyle = this.interpolateColor(t);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
  }

  /**
   * Allows layer progress to extend iteration depth and redraw the curve.
   * 
   * @param {Object} config - Configuration object
   * @param {number} config.iterations - Number of iterations (complexity from layers)
   * @param {number} config.allocated - Allocated iterons (controls drawing progress)
   * @param {number} config.segmentLength - Length of each segment
   */
  updateConfig(config = {}) {
    let rebuildNeeded = false;
    if (typeof config.iterations === 'number') {
      const newIterations = this.clamp(config.iterations, 5, 16);
      if (newIterations !== this.iterations) {
        this.iterations = newIterations;
        rebuildNeeded = true;
      }
    }
    if (typeof config.segmentLength === 'number') {
      const newLength = Math.max(1, config.segmentLength);
      if (newLength !== this.segmentLength) {
        this.segmentLength = newLength;
        rebuildNeeded = true;
      }
    }

    // Update target progress based on allocated resources
    // Start with 0 progress (no line) and grow to full curve
    if (typeof config.allocated === 'number') {
      // Estimate complexity: 2^iterations segments
      const maxSegments = Math.pow(2, this.iterations);
      const progress = Math.min(1, config.allocated / (maxSegments * 0.5));
      this.targetProgress = progress;
    }

    if (rebuildNeeded) {
      this.buildSequence();
      this.buildPath();
      this.progress = 0;
      this.targetProgress = 0;
    }
  }
}
