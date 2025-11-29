'use strict';

/**
 * Celestial Bodies for the Bet Terrarium
 *
 * Renders Voronoi fractal-based sun and moon that orbit the terrarium sky.
 * Uses the snapshot pattern to capture completed fractals as static images,
 * avoiding continuous rendering overhead.
 *
 * Sun: Yellow Voronoi fractal with thick yellow circle rim and transparent yellow stained glass center.
 * Moon: Blue Voronoi fractal with thick blue circle rim and transparent blue stained glass center.
 */

/**
 * Simplified Voronoi renderer for celestial bodies.
 * Generates a stained glass tessellation with a thick rim and transparent center.
 */
class CelestialVoronoiRenderer {
  /**
   * @param {Object} options
   * @param {HTMLCanvasElement} options.canvas - Target canvas element
   * @param {'sun'|'moon'} options.bodyType - Type of celestial body (sun or moon)
   * @param {number} [options.cellCount=12] - Number of Voronoi cells to generate
   */
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.bodyType = options.bodyType || 'sun';
    this.cellCount = options.cellCount || 12;
    this.isComplete = false;

    // Color palettes for sun (yellow) and moon (blue)
    this.palette = this.bodyType === 'sun'
      ? {
          rimColor: 'rgba(255, 220, 80, 0.95)',
          rimGlow: 'rgba(255, 200, 60, 0.6)',
          cellColors: [
            { fill: 'rgba(255, 248, 180, 0.25)', stroke: 'rgba(255, 220, 100, 0.5)' },
            { fill: 'rgba(255, 240, 140, 0.2)', stroke: 'rgba(255, 210, 80, 0.45)' },
            { fill: 'rgba(255, 235, 120, 0.18)', stroke: 'rgba(255, 200, 60, 0.4)' },
          ],
        }
      : {
          rimColor: 'rgba(140, 180, 255, 0.95)',
          rimGlow: 'rgba(100, 150, 255, 0.6)',
          cellColors: [
            { fill: 'rgba(180, 210, 255, 0.25)', stroke: 'rgba(140, 180, 255, 0.5)' },
            { fill: 'rgba(160, 200, 255, 0.2)', stroke: 'rgba(120, 160, 255, 0.45)' },
            { fill: 'rgba(140, 190, 255, 0.18)', stroke: 'rgba(100, 140, 255, 0.4)' },
          ],
        };

    this.seeds = [];
    this.polygons = [];
    this.circleRadius = 0;

    if (this.canvas) {
      this.circleRadius = Math.min(this.canvas.width, this.canvas.height) * 0.42;
      this.generateSeeds();
      this.computePolygons();
    }
  }

  /**
   * Generate random seed points for Voronoi cells within the circular boundary.
   */
  generateSeeds() {
    if (!this.canvas) return;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    this.seeds = [];

    for (let i = 0; i < this.cellCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * this.circleRadius * 0.85;
      this.seeds.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        colorIndex: Math.floor(Math.random() * this.palette.cellColors.length),
      });
    }
  }

  /**
   * Compute Voronoi polygon boundaries using radial sampling.
   */
  computePolygons() {
    if (!this.canvas || !this.seeds.length) return;

    const radialSteps = 72;
    const angleStep = (Math.PI * 2) / radialSteps;

    this.polygons = [];

    for (let i = 0; i < this.seeds.length; i++) {
      const seed = this.seeds[i];
      const points = [];

      for (let angle = 0; angle < Math.PI * 2; angle += angleStep) {
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        let radius = this.circleRadius;

        // Find intersection with Voronoi cell boundaries
        for (let j = 0; j < this.seeds.length; j++) {
          if (i === j) continue;

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

      this.polygons.push({ seed, points, colorIndex: seed.colorIndex });
    }
  }

  /**
   * Update the simulation state (no-op for static celestial bodies).
   */
  update() {
    // Celestial bodies are rendered once and frozen
  }

  /**
   * Render the Voronoi stained glass pattern with thick rim.
   */
  render() {
    if (!this.canvas || !this.ctx) return;

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear canvas with transparency
    ctx.clearRect(0, 0, width, height);

    // Draw outer glow
    const glowGradient = ctx.createRadialGradient(
      centerX, centerY, this.circleRadius * 0.7,
      centerX, centerY, this.circleRadius * 1.3
    );
    glowGradient.addColorStop(0, this.palette.rimGlow);
    glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, width, height);

    // Clip to circle for Voronoi cells
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, this.circleRadius - 4, 0, Math.PI * 2);
    ctx.clip();

    // Draw Voronoi cells
    for (const poly of this.polygons) {
      if (poly.points.length === 0) continue;

      const colors = this.palette.cellColors[poly.colorIndex % this.palette.cellColors.length];

      ctx.fillStyle = colors.fill;
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(poly.points[0].x, poly.points[0].y);
      for (let i = 1; i < poly.points.length; i++) {
        ctx.lineTo(poly.points[i].x, poly.points[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();

    // Draw thick circular rim
    const rimWidth = this.circleRadius * 0.12;
    ctx.strokeStyle = this.palette.rimColor;
    ctx.lineWidth = rimWidth;
    ctx.beginPath();
    ctx.arc(centerX, centerY, this.circleRadius - rimWidth / 2, 0, Math.PI * 2);
    ctx.stroke();

    // Mark as complete for freezing
    this.isComplete = true;
  }
}

/**
 * Manages the celestial body elements (sun and moon) for the Bet terrarium.
 * Creates Voronoi fractal canvases inside the existing sun/moon DOM elements,
 * then freezes them to static images after rendering.
 */
export class FluidTerrariumCelestialBodies {
  /**
   * @param {Object} options
   * @param {HTMLElement|null} options.sunElement - The sun DOM container
   * @param {HTMLElement|null} options.moonElement - The moon DOM container
   * @param {boolean} [options.enabled=false] - Whether celestial bodies are unlocked
   * @param {Function} [options.onStateChange] - Callback when state changes
   */
  constructor(options = {}) {
    this.sunElement = options.sunElement || null;
    this.moonElement = options.moonElement || null;
    this.enabled = Boolean(options.enabled);
    this.onStateChange = typeof options.onStateChange === 'function' ? options.onStateChange : () => {};

    this.sunCanvas = null;
    this.sunSimulation = null;
    this.sunFrozen = false;

    this.moonCanvas = null;
    this.moonSimulation = null;
    this.moonFrozen = false;

    this.animationFrame = null;
    this.running = false;

    this.handleFrame = this.handleFrame.bind(this);

    if (this.enabled) {
      this.initialize();
    }
  }

  /**
   * Initialize the celestial body canvases and simulations.
   */
  initialize() {
    if (this.sunElement && !this.sunCanvas) {
      this.sunCanvas = this.createCanvas(this.sunElement);
      this.sunSimulation = new CelestialVoronoiRenderer({
        canvas: this.sunCanvas,
        bodyType: 'sun',
        cellCount: 14,
      });
    }

    if (this.moonElement && !this.moonCanvas) {
      this.moonCanvas = this.createCanvas(this.moonElement);
      this.moonSimulation = new CelestialVoronoiRenderer({
        canvas: this.moonCanvas,
        bodyType: 'moon',
        cellCount: 10,
      });
    }

    this.start();
  }

  /**
   * Create a canvas element sized to fit within the celestial body container.
   * @param {HTMLElement} container - The DOM element to hold the canvas
   * @returns {HTMLCanvasElement}
   */
  createCanvas(container) {
    if (!container || typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.className = 'fluid-terrarium__celestial-canvas';

    // Use device pixel ratio for crisp rendering
    const dpr = typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
      ? window.devicePixelRatio
      : 1;
    const scaleFactor = Math.min(dpr * 2, 4);

    // Match the container size (52px default from CSS)
    const size = 52;
    canvas.width = Math.round(size * scaleFactor);
    canvas.height = Math.round(size * scaleFactor);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.borderRadius = '50%';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');

    container.appendChild(canvas);
    return canvas;
  }

  /**
   * Enable the celestial bodies and begin rendering.
   */
  enable() {
    if (this.enabled) return;

    this.enabled = true;
    this.initialize();
    this.onStateChange({ celestialBodiesEnabled: true });
  }

  /**
   * Disable the celestial bodies.
   */
  disable() {
    this.enabled = false;
    this.stop();
    this.onStateChange({ celestialBodiesEnabled: false });
  }

  /**
   * Check if celestial bodies are enabled.
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Start the rendering loop.
   */
  start() {
    if (this.running || !this.enabled) return;

    this.running = true;
    this.animationFrame = requestAnimationFrame(this.handleFrame);
  }

  /**
   * Stop the rendering loop.
   */
  stop() {
    this.running = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Animation frame handler - renders and freezes celestial bodies.
   */
  handleFrame() {
    if (!this.running) return;

    let hasActiveSimulation = false;

    // Render and freeze sun
    if (this.sunSimulation && !this.sunFrozen) {
      this.sunSimulation.update();
      this.sunSimulation.render();

      if (this.sunSimulation.isComplete) {
        this.freezeCanvas(this.sunCanvas, this.sunElement);
        this.sunFrozen = true;
      } else {
        hasActiveSimulation = true;
      }
    }

    // Render and freeze moon
    if (this.moonSimulation && !this.moonFrozen) {
      this.moonSimulation.update();
      this.moonSimulation.render();

      if (this.moonSimulation.isComplete) {
        this.freezeCanvas(this.moonCanvas, this.moonElement);
        this.moonFrozen = true;
      } else {
        hasActiveSimulation = true;
      }
    }

    if (!hasActiveSimulation) {
      this.stop();
      return;
    }

    this.animationFrame = requestAnimationFrame(this.handleFrame);
  }

  /**
   * Convert a canvas to a static image and replace it in the container.
   * @param {HTMLCanvasElement} canvas - The canvas to freeze
   * @param {HTMLElement} container - The container element
   */
  freezeCanvas(canvas, container) {
    if (!canvas || !container) return;

    const image = new Image();
    image.className = 'fluid-terrarium__celestial-image';
    image.style.width = '100%';
    image.style.height = '100%';
    image.style.position = 'absolute';
    image.style.inset = '0';
    image.style.borderRadius = '50%';
    image.setAttribute('aria-hidden', 'true');
    image.setAttribute('role', 'presentation');
    image.src = canvas.toDataURL('image/png');

    canvas.replaceWith(image);
  }

  /**
   * Clean up resources.
   */
  destroy() {
    this.stop();
    this.sunCanvas = null;
    this.moonCanvas = null;
    this.sunSimulation = null;
    this.moonSimulation = null;
  }
}
