/**
 * Koch Snowflake Simulation
 *
 * Renders the Koch snowflake by recursively expanding each line segment
 * according to the classic replacement rule. Every segment of length L is
 * replaced with four segments of length L/3 arranged with a ±60° peak.
 * The total segment count after n iterations follows 3 × 4^n, matching the
 * closed-form formula for the snowflake's perimeter growth:
 *   P_n = P_0 * (4/3)^n
 */
export class KochSnowflakeSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.iterations = this.clamp(options.iterations || 5, 0, 6);
    this.initialSize = options.initialSize || 120;
    this.angleStep = ((options.angleStep || 60) * Math.PI) / 180;
    this.drawSpeed = options.drawSpeed || 0.0125; // Portion of path revealed per frame

    this.bgColor = options.bgColor || '#0c0f14';
    this.lineColor = options.lineColor || '#f2f5ff';
    this.lineWidth = options.lineWidth || 1.2;

    this.points = [];
    this.segments = [];
    this.progress = 0; // 0 → 1 controls how many segments are visible
    this.targetProgress = 0; // Target progress based on allocated resources

    this.rebuildGeometry();
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  rebuildGeometry() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    this.points = [];
    this.segments = [];
    this.progress = 0;
    this.targetProgress = 0;

    const size = Math.min(this.initialSize, this.canvas.width * 0.8);
    const height = size * Math.sqrt(3) / 2;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2 + height * 0.2;

    const p1 = { x: cx, y: cy - height / 2 };
    const p2 = { x: cx - size / 2, y: cy + height / 2 };
    const p3 = { x: cx + size / 2, y: cy + height / 2 };

    this.generateSegments(p1, p2, this.iterations);
    this.generateSegments(p2, p3, this.iterations);
    this.generateSegments(p3, p1, this.iterations);
  }

  /**
   * Recursively creates Koch segments. Each segment splits into four segments
   * following the vector arithmetic of the Koch curve:
   * 1. Divide the segment into thirds → points a, b, c.
   * 2. Construct point d forming an equilateral bump using ±60° rotation.
   */
  generateSegments(start, end, iteration) {
    if (iteration === 0) {
      this.segments.push({ start, end });
      return;
    }

    const dx = (end.x - start.x) / 3;
    const dy = (end.y - start.y) / 3;

    const a = { x: start.x + dx, y: start.y + dy };
    const b = { x: start.x + 2 * dx, y: start.y + 2 * dy };

    const angle = Math.atan2(dy, dx) - this.angleStep;
    const length = Math.sqrt(dx * dx + dy * dy);
    const peak = {
      x: a.x + Math.cos(angle) * length,
      y: a.y + Math.sin(angle) * length
    };

    this.generateSegments(start, a, iteration - 1);
    this.generateSegments(a, peak, iteration - 1);
    this.generateSegments(peak, b, iteration - 1);
    this.generateSegments(b, end, iteration - 1);
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
    ctx.strokeStyle = this.lineColor;
    ctx.lineWidth = this.lineWidth;
    ctx.beginPath();

    const visibleSegments = this.segments.length * this.progress;
    const fullSegments = Math.floor(visibleSegments);
    const partial = visibleSegments - fullSegments;

    for (let i = 0; i < fullSegments; i++) {
      const segment = this.segments[i];
      ctx.moveTo(segment.start.x, segment.start.y);
      ctx.lineTo(segment.end.x, segment.end.y);
    }

    if (partial > 0 && fullSegments < this.segments.length) {
      const segment = this.segments[fullSegments];
      const px = segment.start.x + (segment.end.x - segment.start.x) * partial;
      const py = segment.start.y + (segment.end.y - segment.start.y) * partial;
      ctx.moveTo(segment.start.x, segment.start.y);
      ctx.lineTo(px, py);
    }

    ctx.stroke();
  }

  /**
   * Updates simulation parameters and rebuilds geometry so layer progress can
   * deepen the recursion depth in sync with gameplay state.
   * 
   * @param {Object} config - Configuration object
   * @param {number} config.iterations - Number of iterations (complexity from layers)
   * @param {number} config.allocated - Allocated iterons (controls drawing progress)
   * @param {number} config.initialSize - Size of the snowflake
   * @param {number} config.drawSpeed - Speed of drawing animation
   * @param {number} config.angleStep - Angle step in degrees
   */
  updateConfig(config = {}) {
    let rebuildNeeded = false;
    
    if (typeof config.iterations === 'number') {
      const newIterations = this.clamp(config.iterations, 0, 6);
      if (newIterations !== this.iterations) {
        this.iterations = newIterations;
        rebuildNeeded = true;
      }
    }
    if (typeof config.initialSize === 'number' && config.initialSize !== this.initialSize) {
      this.initialSize = config.initialSize;
      rebuildNeeded = true;
    }
    if (typeof config.drawSpeed === 'number') {
      this.drawSpeed = config.drawSpeed;
    }
    if (typeof config.angleStep === 'number') {
      const newAngleStep = (config.angleStep * Math.PI) / 180;
      if (newAngleStep !== this.angleStep) {
        this.angleStep = newAngleStep;
        rebuildNeeded = true;
      }
    }

    // Update target progress based on allocated resources
    // Start with 0 progress (no line) and grow to full snowflake
    if (typeof config.allocated === 'number') {
      // Estimate complexity: 3 * 4^iterations segments
      const maxSegments = 3 * Math.pow(4, this.iterations);
      const progress = Math.min(1, config.allocated / (maxSegments * 0.3));
      this.targetProgress = progress;
    }

    if (rebuildNeeded) {
      this.rebuildGeometry();
    }
  }
}
