'use strict';

import { BrownianTreeSimulation } from '../scripts/features/towers/brownianTreeSimulation.js';

// Default growth allocation keeps the crystal forest visibly expanding without overfilling the cavern.
const DEFAULT_ALLOCATED = 82;

/**
 * Render a Brownian forest in the Bet Spire's crystal alcove, constrained by the terrain silhouette.
 */
export class FluidTerrariumCrystal {
  constructor(options = {}) {
    /** @type {HTMLElement|null} */
    this.container = options.container || null;
    /** @type {HTMLImageElement|null} */
    this.collisionElement = options.collisionElement || null;
    /** @type {string|null} */
    this.maskUrl = typeof options.maskUrl === 'string' ? options.maskUrl : null;

    this.canvas = null;
    this.simulation = null;
    this.anchor = null;
    this.walkableMask = null;
    this.bounds = { width: 0, height: 0 };

    this.resizeObserver = null;
    this.animationFrame = null;
    this.running = false;

    this.handleFrame = this.handleFrame.bind(this);
    this.handleResize = this.handleResize.bind(this);

    if (this.container) {
      this.createCanvas();
      this.refreshBounds();
      this.observeResize();
    }

    this.loadMask();
    this.sampleCollisionSilhouette();
  }

  /**
   * Insert the overlay canvas that will host the Brownian forest.
   */
  createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.className = 'fluid-terrarium__crystal-growth';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');
    canvas.style.inset = '0';
    canvas.style.position = 'absolute';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    this.canvas = canvas;
    this.container.appendChild(canvas);
  }

  /**
   * Track container resizes so the simulation matches the scaled terrarium art.
   */
  observeResize() {
    if (!this.container || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.container);
  }

  /**
   * Cache viewport dimensions and resize the canvas when layout shifts.
   */
  handleResize() {
    this.refreshBounds();
    this.resizeCanvas();
  }

  /**
   * Measure the overlay container.
   */
  refreshBounds() {
    if (!this.container) {
      return;
    }
    const rect = this.container.getBoundingClientRect();
    this.bounds.width = this.container.clientWidth || rect.width;
    this.bounds.height = this.container.clientHeight || rect.height;
  }

  /**
   * Resize the simulation surface to match the current terrarium dimensions.
   */
  resizeCanvas() {
    if (!this.canvas) {
      return;
    }
    const width = Math.max(1, Math.round(this.bounds.width));
    const height = Math.max(1, Math.round(this.bounds.height));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      if (this.simulation) {
        this.simulation.setOrigin(this.anchor?.centerX ?? 0.5, this.anchor?.baseY ?? 0.5);
        this.simulation.resize(width, height);
        this.simulation.updateConfig({ allocated: DEFAULT_ALLOCATED });
      }
    }
  }

  /**
   * Load the growing crystal placement mask so we can anchor the forest to the intended alcove.
   */
  loadMask() {
    if (!this.maskUrl) {
      return;
    }
    const image = new Image();
    image.decoding = 'async';
    image.loading = 'eager';
    image.src = this.maskUrl;
    image.addEventListener('load', () => {
      this.anchor = this.extractAnchorFromMask(image);
      this.syncSimulation();
    }, { once: true });
  }

  /**
   * Convert the provided mask image into a normalized anchor description.
   * @param {HTMLImageElement} image
   * @returns {{ centerX:number, baseY:number, widthRatio:number, heightRatio:number }|null}
   */
  extractAnchorFromMask(image) {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height || typeof document === 'undefined') {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    ctx.drawImage(image, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    const alphaThreshold = 8;

    for (let index = 0; index < width * height; index += 1) {
      const alpha = data[index * 4 + 3];
      if (alpha <= alphaThreshold) {
        continue;
      }
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    if (maxX < 0 || maxY < 0) {
      return null;
    }

    return {
      centerX: (minX + maxX + 1) / 2 / width,
      baseY: (maxY + 1) / height,
      widthRatio: (maxX - minX + 1) / width,
      heightRatio: (maxY - minY + 1) / height,
    };
  }

  /**
   * Sample the collision silhouette so particle walkers respect the cave walls.
   */
  sampleCollisionSilhouette() {
    const source = this.collisionElement;
    if (!source) {
      return;
    }

    const sample = () => {
      const width = source.naturalWidth;
      const height = source.naturalHeight;
      if (!width || !height || typeof document === 'undefined') {
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }
      ctx.drawImage(source, 0, 0, width, height);
      const { data } = ctx.getImageData(0, 0, width, height);
      const walkable = new Uint8Array(width * height);
      for (let index = 0; index < walkable.length; index += 1) {
        // Alpha indicates solid terrain; transparent pixels are safe for the cluster.
        const alpha = data[index * 4 + 3];
        walkable[index] = alpha === 0 ? 1 : 0;
      }
      this.walkableMask = { width, height, data: walkable };
      this.syncSimulation();
    };

    if (source.complete && source.naturalWidth) {
      sample();
    } else {
      source.addEventListener('load', sample, { once: true });
    }
  }

  /**
   * Build or refresh the simulation once both the mask and collision map are ready.
   */
  syncSimulation() {
    if (!this.canvas || !this.anchor || !this.walkableMask || !this.bounds.width || !this.bounds.height) {
      return;
    }

    const originX = this.anchor.centerX;
    // Anchor the root to the base of the color block so branches creep upward along the cave wall.
    const originY = Math.min(1, this.anchor.baseY + this.anchor.heightRatio * 0.05);

    if (!this.simulation) {
      this.simulation = new BrownianTreeSimulation({
        canvas: this.canvas,
        glowRadius: 5,
        particleLimit: 1800,
        originX,
        originY,
        walkableMask: this.walkableMask,
      });
    } else {
      this.simulation.setOrigin(originX, originY);
      this.simulation.setWalkableMask(this.walkableMask);
    }

    this.simulation.updateConfig({
      allocated: DEFAULT_ALLOCATED,
      originX,
      originY,
    });
    this.resizeCanvas();
    this.start();
  }

  /**
   * Start the animation loop.
   */
  start() {
    if (this.running) {
      return;
    }
    this.running = true;
    this.animationFrame = requestAnimationFrame(this.handleFrame);
  }

  /**
   * Stop the animation loop.
   */
  stop() {
    this.running = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Drive the Brownian simulation.
   */
  handleFrame() {
    if (!this.running || !this.simulation) {
      return;
    }
    this.simulation.update();
    this.simulation.render();
    this.animationFrame = requestAnimationFrame(this.handleFrame);
  }
}
