/**
 * Newton Fractal Simulation
 *
 * Visualizes convergence of Newton's method applied to f(z) = z^3 − 1.
 * Iterative formula:
 *   z_{n+1} = z_n - f(z_n) / f'(z_n) = z_n - (z_n^3 - 1) / (3z_n^2)
 * Each pixel is colored by the root it converges to and shaded by iteration count.
 */
export class NewtonFractalSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.width = options.width || (this.canvas ? this.canvas.width : 240);
    this.height = options.height || (this.canvas ? this.canvas.height : 320);
    this.maxIterations = options.maxIterations || 30;
    this.epsilon = options.epsilon || 1e-5;

    this.rowsPerFrame = options.rowsPerFrame || 3;

    this.imageData = this.ctx ? this.ctx.createImageData(this.width, this.height) : null;
    this.currentRow = 0;
    this.targetRows = 0; // Target rows based on allocated resources

    this.roots = [
      { x: 1, y: 0 },
      { x: -0.5, y: Math.sqrt(3) / 2 },
      { x: -0.5, y: -Math.sqrt(3) / 2 }
    ];
    this.rootColors = [
      { r: 236, g: 204, b: 104 },
      { r: 138, g: 201, b: 190 },
      { r: 194, g: 144, b: 228 }
    ];
  }

  mapToPlane(px, py) {
    const scale = 3;
    return {
      x: (px / this.width - 0.5) * scale,
      y: (py / this.height - 0.5) * scale
    };
  }

  iteratePixel(px, py) {
    let { x: zx, y: zy } = this.mapToPlane(px, py);

    let iteration = 0;
    let convergedIndex = -1;

    while (iteration < this.maxIterations) {
      const zx2 = zx * zx - zy * zy;
      const zy2 = 2 * zx * zy;

      const fX = zx * zx2 - zy * zy2 - 1;
      const fY = zy * zx2 + zx * zy2;

      const denomX = 3 * (zx * zx - zy * zy);
      const denomY = 6 * zx * zy;

      const denomMagSq = denomX * denomX + denomY * denomY;
      if (denomMagSq === 0) {
        break;
      }

      const ratioX = (fX * denomX + fY * denomY) / denomMagSq;
      const ratioY = (fY * denomX - fX * denomY) / denomMagSq;

      const nextX = zx - ratioX;
      const nextY = zy - ratioY;

      const diffX = nextX - zx;
      const diffY = nextY - zy;
      if (diffX * diffX + diffY * diffY < this.epsilon * this.epsilon) {
        convergedIndex = this.identifyRoot(nextX, nextY);
        break;
      }

      zx = nextX;
      zy = nextY;
      iteration++;
    }

    if (convergedIndex === -1) {
      convergedIndex = this.identifyRoot(zx, zy);
    }

    return { rootIndex: convergedIndex, iteration };
  }

  identifyRoot(x, y) {
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < this.roots.length; i++) {
      const dx = x - this.roots[i].x;
      const dy = y - this.roots[i].y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    return closest;
  }

  update() {
    if (!this.canvas || !this.ctx || !this.imageData) {
      return;
    }

    // Render rows up to target based on allocated resources
    let processed = 0;
    while (this.currentRow < this.targetRows && processed < this.rowsPerFrame) {
      for (let x = 0; x < this.width; x++) {
        const { rootIndex, iteration } = this.iteratePixel(x, this.currentRow);
        const baseColor = this.rootColors[rootIndex];
        const shade = 0.5 + 0.5 * (1 - iteration / this.maxIterations);
        const index = (this.currentRow * this.width + x) * 4;
        this.imageData.data[index] = Math.round(baseColor.r * shade);
        this.imageData.data[index + 1] = Math.round(baseColor.g * shade);
        this.imageData.data[index + 2] = Math.round(baseColor.b * shade);
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
   * Adjusts Newton iteration depth and refreshes the render to react to new
   * Shin Spire layers.
   * 
   * @param {Object} config - Configuration object
   * @param {number} config.maxIterations - Max iterations (complexity from layers)
   * @param {number} config.allocated - Allocated iterons (controls rendering progress)
   * @param {number} config.epsilon - Convergence epsilon
   */
  updateConfig(config = {}) {
    let rebuild = false;
    if (typeof config.maxIterations === 'number') {
      const newIterations = Math.max(5, config.maxIterations);
      if (newIterations !== this.maxIterations) {
        this.maxIterations = newIterations;
        rebuild = true;
      }
    }
    if (typeof config.epsilon === 'number') {
      this.epsilon = Math.max(1e-7, config.epsilon);
    }

    // Update target rows based on allocated resources
    // Start with 1 row (simple line) and grow to full height
    if (typeof config.allocated === 'number') {
      const minRows = 1;
      const maxRows = this.height;
      const progress = Math.min(1, config.allocated / (this.maxIterations * 100));
      this.targetRows = Math.floor(minRows + (maxRows - minRows) * progress);
    }

    if (rebuild && this.imageData) {
      this.currentRow = 0;
      this.imageData.data.fill(0);
    }
  }
}
