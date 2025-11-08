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
    this.targetRows = 0; // Target rows based on allocated resources
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

    // Render rows up to target based on allocated resources
    let processed = 0;
    while (this.currentRow < this.targetRows && processed < this.rowsPerFrame) {
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
   * 
   * @param {Object} config - Configuration object
   * @param {number} config.maxIterations - Max iterations (complexity from layers)
   * @param {number} config.allocated - Allocated iterons (controls rendering progress)
   * @param {number} config.zoom - Zoom level
   * @param {number} config.centerX - Center X coordinate
   * @param {number} config.centerY - Center Y coordinate
   */
  updateConfig(config = {}) {
    let rebuild = false;
    if (typeof config.maxIterations === 'number') {
      const newIterations = Math.max(10, config.maxIterations);
      if (newIterations !== this.maxIterations) {
        this.maxIterations = newIterations;
        rebuild = true;
      }
    }
    if (typeof config.zoom === 'number') {
      const newZoom = Math.max(0.3, config.zoom);
      if (newZoom !== this.zoom) {
        this.zoom = newZoom;
        rebuild = true;
      }
    }
    if (typeof config.centerX === 'number' && config.centerX !== this.centerX) {
      this.centerX = config.centerX;
      rebuild = true;
    }
    if (typeof config.centerY === 'number' && config.centerY !== this.centerY) {
      this.centerY = config.centerY;
      rebuild = true;
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
