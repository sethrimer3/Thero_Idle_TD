/**
 * Voronoi Subdivision Simulation
 *
 * Approximates a luminous Voronoi tessellation inside a circular window. Each
 * iteron introduces a new shard, causing the glowing stained glass to subdivide
 * in real time. The polygons are computed by sampling the distance field along
 * radial spokes, which is sufficient for the relatively small number of cells
 * we render for the Shin showcase.
 */

import { samplePalette, rgbToString } from './fractalRenderUtils.js';

export class VoronoiSubdivisionSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.maxCells = options.maxCells || 140;
    this.palette = options.palette || 'blue-aurora';

    this.circleRadius = 0;
    this.seeds = [];
    this.polygons = [];
    this.targetCells = 0;

    if (this.canvas) {
      this.circleRadius = Math.min(this.canvas.width, this.canvas.height) * 0.45;
    }
  }

  randomSeed() {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * this.circleRadius * 0.95;
    const colorT = 0.2 + Math.random() * 0.8;
    return {
      x: this.canvas.width / 2 + Math.cos(angle) * radius,
      y: this.canvas.height / 2 + Math.sin(angle) * radius,
      colorT
    };
  }

  ensureSeedCount() {
    if (!this.canvas) {
      return;
    }

    let changed = false;
    while (this.seeds.length < this.targetCells && this.seeds.length < this.maxCells) {
      this.seeds.push(this.randomSeed());
      changed = true;
    }
    if (this.seeds.length > this.targetCells) {
      this.seeds.length = this.targetCells;
      changed = true;
    }
    if (changed || this.polygons.length !== this.seeds.length) {
      this.rebuildPolygons();
    }
  }

  rebuildPolygons() {
    if (!this.canvas) {
      return;
    }

    const polygons = [];
    const step = Math.PI / 90;
    for (let i = 0; i < this.seeds.length; i++) {
      const seed = this.seeds[i];
      const points = [];
      for (let angle = 0; angle < Math.PI * 2; angle += step) {
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        let radius = this.circleRadius;

        for (let j = 0; j < this.seeds.length; j++) {
          if (i === j) {
            continue;
          }
          const other = this.seeds[j];
          const dx = seed.x - other.x;
          const dy = seed.y - other.y;
          const denom = 2 * (dirX * dx + dirY * dy);
          if (denom < -1e-5) {
            const candidate = (dx * dx + dy * dy) / -denom;
            if (candidate > 0 && candidate < radius) {
              radius = candidate;
            }
          }
        }

        const px = seed.x + dirX * radius;
        const py = seed.y + dirY * radius;
        points.push({ x: px, y: py });
      }
      polygons.push({ seed, points });
    }
    this.polygons = polygons;
  }

  /**
   * Resize the Voronoi canvas so tessellation scales with viewport changes.
   * @param {number} width - Target canvas width in device pixels.
   * @param {number} height - Target canvas height in device pixels.
   */
  resize(width, height) {
    if (!this.canvas) {
      return;
    }

    if (Number.isFinite(width) && Number.isFinite(height)) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    this.circleRadius = Math.min(this.canvas.width, this.canvas.height) * 0.45;
    this.rebuildPolygons();
  }

  update() {
    this.ensureSeedCount();
  }

  render() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    const ctx = this.ctx;
    ctx.fillStyle = '#02040c';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    ctx.beginPath();
    ctx.arc(0, 0, this.circleRadius, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);

    for (const poly of this.polygons) {
      const color = samplePalette(this.palette, poly.seed.colorT);
      ctx.fillStyle = rgbToString(color, 0.85);
      ctx.strokeStyle = rgbToString(samplePalette(this.palette, Math.min(1, poly.seed.colorT + 0.15)), 0.95);
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      if (poly.points.length > 0) {
        ctx.moveTo(poly.points[0].x, poly.points[0].y);
        for (let i = 1; i < poly.points.length; i++) {
          ctx.lineTo(poly.points[i].x, poly.points[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();

    // Halo ring for the stained-glass window
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(120, 190, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(this.canvas.width / 2, this.canvas.height / 2, this.circleRadius + 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  updateConfig(config = {}) {
    if (typeof config.allocated === 'number') {
      const desired = Math.min(this.maxCells, Math.floor(3 + config.allocated));
      if (desired !== this.targetCells) {
        this.targetCells = desired;
      }
    }
  }
}
