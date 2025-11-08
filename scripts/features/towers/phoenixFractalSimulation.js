/**
 * Phoenix Fractal Simulation
 *
 * The Phoenix fractal iterates the quadratic recurrence with a memory term:
 *   z_{n+1} = z_n^2 + c + p · z_{n-1}
 * where c is derived from the pixel coordinate and p controls the flame-like
 * trails. Pixels with |z| > 4 escape. The resulting escape time maps to a
 * palette that shifts with `colorShift`.
 */
export class PhoenixFractalSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.width = options.width || (this.canvas ? this.canvas.width : 240);
    this.height = options.height || (this.canvas ? this.canvas.height : 320);
    this.maxIterations = options.maxIterations || 50;
    this.colorShift = options.colorShift || 0.5;
    this.zoom = options.zoom || 1.4;
    this.centerX = options.centerX || -0.5;
    this.centerY = options.centerY || 0.0;

    this.rowsPerFrame = options.rowsPerFrame || 4;

    this.imageData = this.ctx ? this.ctx.createImageData(this.width, this.height) : null;
    this.currentRow = 0;
    this.targetRows = 0; // Target rows based on allocated resources
  }

  mapToPlane(px, py) {
    const scale = 1 / this.zoom;
    const x = (px - this.width / 2) * scale / (this.width / 2) + this.centerX;
    const y = (py - this.height / 2) * scale / (this.height / 2) + this.centerY;
    return { x, y };
  }

  iteratePixel(px, py) {
    const { x: cx, y: cy } = this.mapToPlane(px, py);

    let zx = 0;
    let zy = 0;
    let pxPrev = 0;
    let pyPrev = 0;

    let iteration = 0;
    while (iteration < this.maxIterations) {
      const nextX = zx * zx - zy * zy + cx + this.colorShift * pxPrev;
      const nextY = 2 * zx * zy + cy + this.colorShift * pyPrev;

      pxPrev = zx;
      pyPrev = zy;
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
      return { r: 10, g: 10, b: 18 };
    }

    const t = iteration / this.maxIterations;
    const hue = (200 + this.colorShift * 160 * t) % 360;
    return this.hslToRgb(hue, 0.6, 0.55);
  }

  hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = h / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r1 = 0;
    let g1 = 0;
    let b1 = 0;

    if (hp >= 0 && hp < 1) {
      r1 = c;
      g1 = x;
    } else if (hp >= 1 && hp < 2) {
      r1 = x;
      g1 = c;
    } else if (hp >= 2 && hp < 3) {
      g1 = c;
      b1 = x;
    } else if (hp >= 3 && hp < 4) {
      g1 = x;
      b1 = c;
    } else if (hp >= 4 && hp < 5) {
      r1 = x;
      b1 = c;
    } else {
      r1 = c;
      b1 = x;
    }

    const m = l - c / 2;
    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255)
    };
  }

  render() {
    if (!this.canvas || !this.ctx || !this.imageData) {
      return;
    }

    this.ctx.putImageData(this.imageData, 0, 0);
  }

  /**
   * Updates escape parameters and clears the render buffer to allow deeper
   * layers to refine the Phoenix attractor.
   * 
   * @param {Object} config - Configuration object
   * @param {number} config.maxIterations - Max iterations (complexity from layers)
   * @param {number} config.allocated - Allocated iterons (controls rendering progress)
   * @param {number} config.colorShift - Color shift parameter
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
    if (typeof config.colorShift === 'number' && config.colorShift !== this.colorShift) {
      this.colorShift = config.colorShift;
      rebuild = true;
    }
    if (typeof config.zoom === 'number') {
      const newZoom = Math.max(0.2, config.zoom);
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
