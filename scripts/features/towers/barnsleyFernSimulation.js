/**
 * Barnsley Fern Simulation
 *
 * Uses the classic IFS (Iterated Function System) with four affine
 * transformations. The transforms and their probabilities implement the
 * well-known Barnsley fern formulas:
 *   f1(x, y) = (0, 0.16y)
 *   f2(x, y) = (0.85x + 0.04y, -0.04x + 0.85y + 1.6)
 *   f3(x, y) = (0.2x - 0.26y, 0.23x + 0.22y + 1.6)
 *   f4(x, y) = (-0.15x + 0.28y, 0.26x + 0.24y + 0.44)
 * 
 * Points are generated incrementally based on allocated resources.
 * The fern starts as a simple stem and grows more complex as points are added.
 */
export class BarnsleyFernSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.pointDensity = options.pointDensity || 50000;
    this.scale = options.scale || 40;
    this.pointsPerFrame = options.pointsPerFrame || 50; // Reduced for smoother incremental growth
    this.targetPoints = 0; // Target number of points based on allocated resources

    this.bgColor = options.bgColor || '#0b0d12';
    this.pointColor = options.pointColor || 'rgba(180, 240, 200, 0.8)';

    this.points = [];
    this.currentPoint = { x: 0, y: 0 };
  }

  reset() {
    this.points = [];
    this.currentPoint = { x: 0, y: 0 };
  }

  iteratePoint() {
    const r = Math.random();
    let x = this.currentPoint.x;
    let y = this.currentPoint.y;

    if (r < 0.01) {
      x = 0;
      y = 0.16 * y;
    } else if (r < 0.86) {
      const nx = 0.85 * x + 0.04 * y;
      const ny = -0.04 * x + 0.85 * y + 1.6;
      x = nx;
      y = ny;
    } else if (r < 0.93) {
      const nx = 0.2 * x - 0.26 * y;
      const ny = 0.23 * x + 0.22 * y + 1.6;
      x = nx;
      y = ny;
    } else {
      const nx = -0.15 * x + 0.28 * y;
      const ny = 0.26 * x + 0.24 * y + 0.44;
      x = nx;
      y = ny;
    }

    this.currentPoint = { x, y };
    this.points.push({ x, y });
  }

  update() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    // Grow toward target point count based on allocated resources
    const remaining = this.targetPoints - this.points.length;
    if (remaining <= 0) {
      return;
    }

    // Add points incrementally each frame up to the target
    const iterations = Math.min(this.pointsPerFrame, remaining);
    for (let i = 0; i < iterations; i++) {
      this.iteratePoint();
    }
  }

  render() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    const ctx = this.ctx;
    ctx.fillStyle = this.bgColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = this.pointColor;
    const offsetX = this.canvas.width / 2;
    const offsetY = this.canvas.height;

    for (const point of this.points) {
      const x = offsetX + point.x * this.scale;
      const y = offsetY - point.y * this.scale;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  /**
   * Updates fern density parameters and optionally clears cached points so the
   * visualization can regrow with higher precision.
   * 
   * @param {Object} config - Configuration object
   * @param {number} config.pointDensity - Maximum density (complexity from layers)
   * @param {number} config.allocated - Allocated iterons (controls growth progress)
   * @param {number} config.scale - Rendering scale
   * @param {boolean} config.reset - Whether to reset the fern
   */
  updateConfig(config = {}) {
    let needsReset = false;

    if (typeof config.pointDensity === 'number') {
      const newDensity = Math.max(1000, config.pointDensity);
      if (newDensity !== this.pointDensity) {
        this.pointDensity = newDensity;
        needsReset = true;
      }
    }
    if (typeof config.scale === 'number') {
      this.scale = Math.max(10, config.scale);
    }
    
    // Update target points based on allocated resources
    // Start with just 10 points (simple stem) and grow to pointDensity
    if (typeof config.allocated === 'number') {
      const minPoints = 10; // Simple stem
      const progress = Math.min(1, config.allocated / (this.pointDensity * 0.5));
      this.targetPoints = Math.floor(minPoints + (this.pointDensity - minPoints) * progress);
    }
    
    if (config.reset === true || needsReset) {
      this.reset();
    }
  }
}
