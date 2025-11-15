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

import { addPanZoomToFractal } from './fractalPanZoom.js';

export class VoronoiSubdivisionSimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    // Enable shared drag-to-pan and zoom interactions on the Voronoi canvas.
    if (typeof this.initPanZoom === 'function') {
      this.initPanZoom(this.canvas);
    }

    this.maxCells = options.maxCells || 140;
    this.palette = options.palette || 'blue-aurora';

    this.circleRadius = 0;
    this.targetCells = 0;
    this.currentLayer = 0; // Track which layer we're on (0-8)
    
    // Nine layers with progressive complexity
    // Layer 0: white/grey/black (up to 9 cells)
    // Layers 1-7: rainbow colors (red through violet) - each 3x complexity
    // Layer 8: prismatic
    this.layers = [];
    /**
     * Track the spin state for each Voronoi layer so we can animate the glass
     * rotation without recomputing polygons every frame.
     * @type {Array<{angle:number, angularVelocity:number}>}
     */
    this.layerRotationState = [];
    // Base angular velocity for the innermost layer: one revolution per minute.
    const baseAngularVelocity = (Math.PI * 2) / 60;
    for (let i = 0; i < 9; i++) {
      this.layers.push({
        seeds: [],
        polygons: [],
        maxCells: i === 0 ? 9 : Math.pow(3, i) * 3 // 9, 27, 81, 243, etc.
      });
      this.layerRotationState.push({
        angle: 0,
        // Each successive layer spins 10% faster than the previous one.
        angularVelocity: baseAngularVelocity * Math.pow(1.1, i)
      });
    }

    /**
     * Timestamp from the previous update call so we can derive delta time for
     * smooth rotation. Initialized lazily to avoid large jumps on creation.
     * @type {number|null}
     */
    this.lastUpdateTimestamp = null;

    if (this.canvas) {
      this.circleRadius = Math.min(this.canvas.width, this.canvas.height) * 0.45;
    }
  }

  randomSeed(layerIndex) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * this.circleRadius * 0.95;
    const colorT = 0.2 + Math.random() * 0.8;
    return {
      x: this.canvas.width / 2 + Math.cos(angle) * radius,
      y: this.canvas.height / 2 + Math.sin(angle) * radius,
      colorT,
      layer: layerIndex
    };
  }

  ensureSeedCount() {
    if (!this.canvas) {
      return;
    }

    // Determine which layers should be active based on targetCells
    let cellsAllocated = 0;

    for (let layerIdx = 0; layerIdx < this.layers.length; layerIdx++) {
      const layer = this.layers[layerIdx];
      const layerMax = layer.maxCells;
      const layerTarget = Math.min(layerMax, Math.max(0, this.targetCells - cellsAllocated));
      let layerChanged = false;

      // Update seeds for this layer
      while (layer.seeds.length < layerTarget) {
        layer.seeds.push(this.randomSeed(layerIdx));
        layerChanged = true;
      }
      if (layer.seeds.length > layerTarget) {
        layer.seeds.length = layerTarget;
        layerChanged = true;
      }

      // Rebuild polygons for this layer if needed
      if (layerChanged || layer.polygons.length !== layer.seeds.length) {
        this.rebuildPolygonsForLayer(layerIdx);
      }

      cellsAllocated += layerTarget;
      
      // Update current layer tracker
      if (layerTarget > 0) {
        this.currentLayer = layerIdx;
      }
    }
  }

  rebuildPolygonsForLayer(layerIdx) {
    if (!this.canvas) {
      return;
    }

    const layer = this.layers[layerIdx];
    const seeds = layer.seeds;
    const polygons = [];
    const step = Math.PI / 90;
    
    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i];
      const points = [];
      for (let angle = 0; angle < Math.PI * 2; angle += step) {
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        let radius = this.circleRadius;

        for (let j = 0; j < seeds.length; j++) {
          if (i === j) {
            continue;
          }
          const other = seeds[j];
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
    layer.polygons = polygons;
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
    for (let i = 0; i < this.layers.length; i++) {
      this.rebuildPolygonsForLayer(i);
    }
  }

  update() {
    this.ensureSeedCount();

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.lastUpdateTimestamp === null) {
      this.lastUpdateTimestamp = now;
      return;
    }

    // Convert elapsed time to seconds and clamp to avoid large jumps when the tab resumes.
    const deltaSeconds = Math.min(0.25, Math.max(0, (now - this.lastUpdateTimestamp) / 1000));
    this.lastUpdateTimestamp = now;
    this.advanceLayerRotations(deltaSeconds);
  }

  /**
   * Advance each layer's rotation based on the elapsed time since the previous frame.
   * @param {number} deltaSeconds - Time in seconds since the previous update.
   */
  advanceLayerRotations(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return;
    }

    for (let i = 0; i < this.layerRotationState.length; i++) {
      const rotationState = this.layerRotationState[i];
      if (!rotationState) {
        continue;
      }
      rotationState.angle = (rotationState.angle + rotationState.angularVelocity * deltaSeconds) % (Math.PI * 2);
    }
  }

  /**
   * Get layer-specific color palette
   * @param {number} layerIdx - Layer index (0-8)
   * @returns {Array} Array of color stops for this layer
   */
  getLayerPalette(layerIdx) {
    // Layer 0: white/grey/black
    if (layerIdx === 0) {
      return [
        { t: 0, color: [30, 30, 30] },
        { t: 0.5, color: [128, 128, 128] },
        { t: 1, color: [220, 220, 220] }
      ];
    }
    
    // Layers 1-7: rainbow colors (red, orange, yellow, green, cyan, blue, indigo, violet)
    const rainbowColors = [
      [255, 60, 60],   // Red
      [255, 165, 60],  // Orange
      [255, 255, 60],  // Yellow
      [60, 255, 60],   // Green
      [60, 200, 255],  // Cyan
      [60, 60, 255],   // Blue
      [120, 60, 200],  // Indigo
      [200, 60, 255]   // Violet
    ];
    
    if (layerIdx >= 1 && layerIdx <= 7) {
      const baseColor = rainbowColors[layerIdx - 1];
      return [
        { t: 0, color: baseColor.map(c => Math.floor(c * 0.3)) },
        { t: 0.5, color: baseColor.map(c => Math.floor(c * 0.7)) },
        { t: 1, color: baseColor }
      ];
    }
    
    // Layer 8: prismatic with all sorts of shades and colors
    if (layerIdx === 8) {
      return [
        { t: 0, color: [255, 60, 150] },
        { t: 0.15, color: [255, 120, 60] },
        { t: 0.3, color: [255, 240, 60] },
        { t: 0.45, color: [60, 255, 120] },
        { t: 0.6, color: [60, 180, 255] },
        { t: 0.75, color: [150, 60, 255] },
        { t: 0.9, color: [255, 60, 200] },
        { t: 1, color: [255, 255, 255] }
      ];
    }
    
    return [{ t: 0, color: [100, 100, 100] }, { t: 1, color: [200, 200, 200] }];
  }

  /**
   * Sample a custom palette by interpolating across its stops
   * @param {Array} palette - Array of color stops
   * @param {number} t - Position in [0, 1]
   * @returns {{r:number, g:number, b:number}} The RGB color
   */
  sampleCustomPalette(palette, t) {
    const clampedT = Math.max(0, Math.min(1, t));
    
    for (let i = 0; i < palette.length - 1; i++) {
      const left = palette[i];
      const right = palette[i + 1];
      if (clampedT >= left.t && clampedT <= right.t) {
        const span = right.t - left.t || 1;
        const localT = (clampedT - left.t) / span;
        return {
          r: Math.round(left.color[0] + (right.color[0] - left.color[0]) * localT),
          g: Math.round(left.color[1] + (right.color[1] - left.color[1]) * localT),
          b: Math.round(left.color[2] + (right.color[2] - left.color[2]) * localT)
        };
      }
    }
    
    const last = palette[palette.length - 1];
    return { r: last.color[0], g: last.color[1], b: last.color[2] };
  }

  render() {
    if (!this.canvas || !this.ctx) {
      return;
    }

    const ctx = this.ctx;
    ctx.fillStyle = '#02040c';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.applyPanZoomTransform();

    ctx.save();
    ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    ctx.beginPath();
    ctx.arc(0, 0, this.circleRadius, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);

    // Render all layers with 10% opacity each
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    for (let layerIdx = 0; layerIdx < this.layers.length; layerIdx++) {
      const layer = this.layers[layerIdx];
      if (layer.polygons.length === 0) continue;

      const layerPalette = this.getLayerPalette(layerIdx);
      const rotationState = this.layerRotationState[layerIdx];
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotationState ? rotationState.angle : 0);
      ctx.translate(-centerX, -centerY);

      for (const poly of layer.polygons) {
        const color = this.sampleCustomPalette(layerPalette, poly.seed.colorT);
        ctx.fillStyle = rgbToString(color, 0.1);
        ctx.strokeStyle = rgbToString(color, 0.15);
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
    }

    ctx.restore();

    // Halo ring for the stained-glass window
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(120, 190, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(this.canvas.width / 2, this.canvas.height / 2, this.circleRadius + 1.5, 0, Math.PI * 2);
    ctx.stroke();
    this.restorePanZoomTransform();
  }

  updateConfig(config = {}) {
    if (typeof config.allocated === 'number') {
      // Total maximum cells across all 9 layers
      const totalMaxCells = this.layers.reduce((sum, layer) => sum + layer.maxCells, 0);
      const desired = Math.min(totalMaxCells, Math.floor(3 + config.allocated));
      if (desired !== this.targetCells) {
        this.targetCells = desired;
      }
    }
  }
}

// Add pan and zoom functionality
addPanZoomToFractal(VoronoiSubdivisionSimulation.prototype);
