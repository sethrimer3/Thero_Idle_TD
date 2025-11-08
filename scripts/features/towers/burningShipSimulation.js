/**
 * Burning Ship Fractal Simulation
 *
 * Implements the Burning Ship iteration:
 *   z_{n+1} = (|Re(z_n)| + i|Im(z_n)|)^2 + c
 * with escape radius 4. The absolute value folded before squaring generates
 * the ship-like hull structure.
 */
export class BurningShipSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.width = options.width || (this.canvas ? this.canvas.width : 240);
    this.height = options.height || (this.canvas ? this.canvas.height : 320);
    this.maxIterations = options.maxIterations || 50;
    this.zoom = options.zoom || 1.0;
    this.centerX = options.centerX || -0.5;
    this.centerY = options.centerY || -0.3;

    this.rowsPerFrame = options.rowsPerFrame || 4;

    this.imageData = this.ctx ? this.ctx.createImageData(this.width, this.height) : null;
    this.currentRow = 0;
  }

  mapToPlane(px, py) {
    const scale = 1.6 / this.zoom;
    const x = (px - this.width / 2) * scale / (this.width / 2) + this.centerX;
    const y = (py - this.height / 2) * scale / (this.height / 2) + this.centerY;
    return { x, y };
  }

  iteratePixel(px, py) {
    const { x: cx, y: cy } = this.mapToPlane(px, py);

    let zx = 0;
    let zy = 0;

    let iteration = 0;
    while (iteration < this.maxIterations) {
      const ax = Math.abs(zx);
      const ay = Math.abs(zy);

      const nextX = ax * ax - ay * ay + cx;
      const nextY = 2 * ax * ay + cy;

      zx = nextX;
      zy = nextY;

      if (zx * zx + zy * zy > 16) {
        break;
      }

      iteration++;
    }

    return iteration;
  }

  update() {
    if (!this.canvas || !this.ctx || !this.imageData) {
      return;
    }

    let processed = 0;
    while (this.currentRow < this.height && processed < this.rowsPerFrame) {
      for (let x = 0; x < this.width; x++) {
        const iteration = this.iteratePixel(x, this.currentRow);
        const color = this.colorize(iteration);
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

  colorize(iteration) {
    if (iteration >= this.maxIterations) {
      return { r: 5, g: 8, b: 12 };
    }

    const t = iteration / this.maxIterations;
    const r = Math.round(255 * Math.pow(t, 0.3));
    const g = Math.round(160 * Math.pow(t, 0.6));
    const b = Math.round(100 * Math.pow(t, 0.8));
    return { r, g, b };
  }

  render() {
    if (!this.canvas || !this.ctx || !this.imageData) {
      return;
    }

    this.ctx.putImageData(this.imageData, 0, 0);
  }

  /**
   * Updates iteration count and viewport for deeper ship detail.
   */
  updateConfig(config = {}) {
    let rebuild = false;
    if (typeof config.maxIterations === 'number') {
      this.maxIterations = Math.max(10, config.maxIterations);
      rebuild = true;
    }
    if (typeof config.zoom === 'number') {
      this.zoom = Math.max(0.3, config.zoom);
      rebuild = true;
    }
    if (typeof config.centerX === 'number') {
      this.centerX = config.centerX;
      rebuild = true;
    }
    if (typeof config.centerY === 'number') {
      this.centerY = config.centerY;
      rebuild = true;
    }

    if (rebuild && this.imageData) {
      this.currentRow = 0;
      this.imageData.data.fill(0);
    }
  }
}
