/**
 * Lyapunov Fractal Simulation
 *
 * Computes Lyapunov exponents for the logistic map using a binary sequence.
 * For sequence S of length m, parameters alternate between a and b:
 *   x_{n+1} = r_n x_n (1 - x_n),  r_n = (S_n == 'A' ? a : b)
 * The Lyapunov exponent is approximated by:
 *   λ ≈ (1/N) Σ log |r_n (1 - 2x_n)|
 * Negative λ indicates stability (blue), positive λ marks chaos (amber).
 */
export class LyapunovFractalSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.width = options.width || (this.canvas ? this.canvas.width : 240);
    this.height = options.height || (this.canvas ? this.canvas.height : 320);
    this.sequence = (options.sequence || 'AABAB').toUpperCase();
    this.iterations = options.iterations || 100;
    this.rowsPerFrame = options.rowsPerFrame || 4;

    this.imageData = this.ctx ? this.ctx.createImageData(this.width, this.height) : null;
    this.currentRow = 0;
    this.targetRows = 0; // Target rows based on allocated resources
  }

  mapParameters(px, py) {
    const a = 3 + (px / this.width) * 1;
    const b = 3 + (py / this.height) * 1;
    return { a, b };
  }

  computeLyapunov(px, py) {
    const { a, b } = this.mapParameters(px, py);
    let x = 0.5;
    let sum = 0;

    // Warm-up iterations to settle on attractor
    for (let i = 0; i < 20; i++) {
      const r = this.sequence[i % this.sequence.length] === 'A' ? a : b;
      x = r * x * (1 - x);
      x = Math.min(Math.max(x, 1e-8), 1 - 1e-8);
    }

    for (let i = 0; i < this.iterations; i++) {
      const r = this.sequence[i % this.sequence.length] === 'A' ? a : b;
      x = r * x * (1 - x);
      x = Math.min(Math.max(x, 1e-8), 1 - 1e-8);
      sum += Math.log(Math.abs(r * (1 - 2 * x)));
    }

    return sum / this.iterations;
  }

  colorize(lambda) {
    if (!Number.isFinite(lambda)) {
      return { r: 0, g: 0, b: 0 };
    }

    if (lambda < 0) {
      const t = Math.min(1, Math.abs(lambda));
      return {
        r: Math.round(40 * (1 - t) + 20 * t),
        g: Math.round(80 + 120 * t),
        b: Math.round(160 + 80 * t)
      };
    }

    const t = Math.min(1, lambda);
    return {
      r: Math.round(200 + 55 * t),
      g: Math.round(120 + 80 * t),
      b: Math.round(40 * (1 - t) + 10)
    };
  }

  update() {
    if (!this.canvas || !this.ctx || !this.imageData) {
      return;
    }

    // Render rows up to target based on allocated resources
    let processed = 0;
    while (this.currentRow < this.targetRows && processed < this.rowsPerFrame) {
      for (let x = 0; x < this.width; x++) {
        const lambda = this.computeLyapunov(x, this.currentRow);
        const color = this.colorize(lambda);
        const index = (this.currentRow * this.width + x) * 4;
        this.imageData.data[index] = color.r;
        this.imageData.data[index + 1] = color.g;
        this.imageData.data[index + 2] = color.b;
        this.imageData.data[index + 3] = 255;
      }
      this.currentRow++;
      processed++;
    }
  }

  render() {
    if (!this.canvas || !this.ctx || !this.imageData) {
      return;
    }

    this.ctx.putImageData(this.imageData, 0, 0);
  }

  /**
   * Updates iteration depth or sequence and refreshes the heat map.
   * 
   * @param {Object} config - Configuration object
   * @param {number} config.iterations - Number of iterations (complexity from layers)
   * @param {number} config.allocated - Allocated iterons (controls rendering progress)
   * @param {string} config.sequence - Binary sequence for Lyapunov
   */
  updateConfig(config = {}) {
    let rebuild = false;
    if (typeof config.iterations === 'number') {
      const newIterations = Math.max(20, config.iterations);
      if (newIterations !== this.iterations) {
        this.iterations = newIterations;
        rebuild = true;
      }
    }
    if (typeof config.sequence === 'string' && config.sequence.length > 0) {
      const newSequence = config.sequence.toUpperCase();
      if (newSequence !== this.sequence) {
        this.sequence = newSequence;
        rebuild = true;
      }
    }

    // Update target rows based on allocated resources
    // Start with 1 row (simple line) and grow to full height
    if (typeof config.allocated === 'number') {
      const minRows = 1;
      const maxRows = this.height;
      const progress = Math.min(1, config.allocated / (this.iterations * 50));
      this.targetRows = Math.floor(minRows + (maxRows - minRows) * progress);
    }

    if (rebuild && this.imageData) {
      this.currentRow = 0;
      this.imageData.data.fill(0);
    }
  }
}
