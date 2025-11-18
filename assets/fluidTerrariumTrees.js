'use strict';

import { FractalTreeSimulation } from '../scripts/features/towers/fractalTreeSimulation.js';

/**
 * Render animated fractal trees on the Bet terrarium using color-block masks to anchor
 * their positions. Each tree reuses the Shin Spire fractal animation so branches
 * continue to unfurl on top of the terrain silhouettes.
 */
export class FluidTerrariumTrees {
  constructor(options = {}) {
    /** @type {HTMLElement|null} */
    this.container = options.container || null;
    /** @type {string|null} */
    this.largeMaskUrl = typeof options.largeMaskUrl === 'string' ? options.largeMaskUrl : null;
    /** @type {string|null} */
    this.smallMaskUrl = typeof options.smallMaskUrl === 'string' ? options.smallMaskUrl : null;

    this.overlay = null;
    this.bounds = { width: 0, height: 0 };
    this.renderBounds = { left: 0, top: 0, width: 0, height: 0 };
    this.referenceSize = { width: 0, height: 0 };
    this.anchors = [];
    this.trees = [];

    this.resizeObserver = null;
    this.animationFrame = null;
    this.running = false;

    this.handleResize = this.handleResize.bind(this);
    this.handleFrame = this.handleFrame.bind(this);

    this.initializeOverlay();
    this.observeContainer();
    this.loadMasks();
  }

  /**
   * Create the overlay element that will hold all fractal canvases.
   */
  initializeOverlay() {
    if (!this.container || typeof document === 'undefined') {
      return;
    }
    const overlay = document.createElement('div');
    overlay.className = 'fluid-terrarium__trees';
    this.overlay = overlay;
    this.container.appendChild(overlay);
    this.refreshBounds();
  }

  /**
   * Listen for resizes so tree canvases stay aligned with the scaled sprites.
   */
  observeContainer() {
    if (!this.container || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.container);
  }

  /**
   * Cache latest dimensions on resize.
   */
  handleResize() {
    this.refreshBounds();
    this.refreshLayout();
  }

  /**
   * Measure container dimensions and update the object-fit bounds for the masks.
   */
  refreshBounds() {
    if (!this.container) {
      return;
    }
    const rect = this.container.getBoundingClientRect();
    this.bounds.width = this.container.clientWidth || rect.width;
    this.bounds.height = this.container.clientHeight || rect.height;
    this.updateRenderBounds();
  }

  /**
   * Calculate the scaled sprite bounds so anchor coordinates map correctly to the viewport.
   */
  updateRenderBounds() {
    if (!this.referenceSize.width || !this.referenceSize.height) {
      this.renderBounds = { left: 0, top: 0, width: this.bounds.width, height: this.bounds.height };
      return;
    }

    const containerRatio = this.bounds.width / Math.max(1, this.bounds.height || 1);
    const spriteRatio = this.referenceSize.width / this.referenceSize.height;
    let width = this.bounds.width;
    let height = this.bounds.height;
    let left = 0;
    let top = 0;

    if (containerRatio > spriteRatio) {
      height = this.bounds.height;
      width = height * spriteRatio;
      left = (this.bounds.width - width) / 2;
    } else {
      width = this.bounds.width;
      height = width / spriteRatio;
      top = (this.bounds.height - height) / 2;
    }

    this.renderBounds = { left, top, width, height };
  }

  /**
   * Kick off loading for the large and small tree mask sprites.
   */
  loadMasks() {
    const maskSources = [
      { url: this.largeMaskUrl, size: 'large' },
      { url: this.smallMaskUrl, size: 'small' },
    ].filter((entry) => typeof entry.url === 'string');

    maskSources.forEach((entry) => {
      const image = new Image();
      image.decoding = 'async';
      image.loading = 'eager';
      image.src = entry.url;
      image.addEventListener('load', () => {
        this.handleMaskLoad(entry.size, image);
      }, { once: true });
    });
  }

  /**
   * Extract anchors from a loaded mask and rebuild the fractal layout.
   * @param {'large'|'small'} size
   * @param {HTMLImageElement} image
   */
  handleMaskLoad(size, image) {
    if (!image?.naturalWidth || !image?.naturalHeight) {
      return;
    }

    if (!this.referenceSize.width || !this.referenceSize.height) {
      this.referenceSize = { width: image.naturalWidth, height: image.naturalHeight };
      this.updateRenderBounds();
    }

    const anchors = this.extractAnchorsFromMask(image).map((anchor) => ({ ...anchor, size }));
    this.anchors.push(...anchors);
    this.refreshLayout();
  }

  /**
   * Scan the mask pixels to find colored blocks and convert them into normalized anchors.
   * @param {HTMLImageElement} image
   * @returns {Array<{centerX:number, baseY:number, widthRatio:number, heightRatio:number}>}
   */
  extractAnchorsFromMask(image) {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height || typeof document === 'undefined') {
      return [];
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return [];
    }
    ctx.drawImage(image, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    const visited = new Uint8Array(width * height);
    const anchors = [];
    const alphaThreshold = 8;

    for (let index = 0; index < visited.length; index += 1) {
      if (visited[index]) {
        continue;
      }
      const alpha = data[index * 4 + 3];
      if (alpha <= alphaThreshold) {
        visited[index] = 1;
        continue;
      }

      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      const stack = [index];
      visited[index] = 1;

      while (stack.length) {
        const current = stack.pop();
        const cx = current % width;
        const cy = Math.floor(current / width);
        const currentAlpha = data[current * 4 + 3];
        if (currentAlpha <= alphaThreshold) {
          continue;
        }

        minX = Math.min(minX, cx);
        minY = Math.min(minY, cy);
        maxX = Math.max(maxX, cx);
        maxY = Math.max(maxY, cy);

        const neighbors = [
          current - 1,
          current + 1,
          current - width,
          current + width,
        ];

        neighbors.forEach((neighbor) => {
          if (neighbor < 0 || neighbor >= visited.length || visited[neighbor]) {
            return;
          }
          visited[neighbor] = 1;
          if (data[neighbor * 4 + 3] > alphaThreshold) {
            stack.push(neighbor);
          }
        });
      }

      anchors.push({
        centerX: (minX + maxX) / 2 / width,
        baseY: (maxY + 1) / height,
        widthRatio: (maxX - minX + 1) / width,
        heightRatio: (maxY - minY + 1) / height,
      });
    }

    return anchors;
  }

  /**
   * Clear existing canvases and rebuild simulations for all anchors.
   */
  refreshLayout() {
    if (!this.overlay || !this.anchors.length || !this.renderBounds.width || !this.renderBounds.height) {
      return;
    }

    this.stop();
    this.overlay.innerHTML = '';
    this.trees = [];

    this.anchors.forEach((anchor) => {
      const layout = this.computeLayout(anchor);
      if (!layout) {
        return;
      }
      const canvas = this.createCanvas(layout);
      const simulation = this.buildSimulation(anchor.size, canvas, layout.height);
      if (!simulation) {
        return;
      }

      this.overlay.appendChild(canvas);
      // Track each tree along with its simulation so we can freeze completed renders later.
      this.trees.push({ canvas, simulation, frozen: false });
    });

    if (this.trees.length) {
      this.start();
    }
  }

  /**
   * Calculate canvas size and absolute positioning for a given anchor.
   * @param {{centerX:number, baseY:number, widthRatio:number, heightRatio:number, size:'large'|'small'}} anchor
   */
  computeLayout(anchor) {
    const widthRatio = anchor.size === 'large' ? 0.18 : 0.14;
    const desiredWidth = Math.max(
      this.renderBounds.width * widthRatio,
      anchor.widthRatio * this.renderBounds.width * 10,
    );
    const maxWidth = this.renderBounds.width * 0.4;
    const width = Math.min(Math.max(14, desiredWidth), maxWidth);

    const desiredHeight = width * (anchor.size === 'large' ? 1.9 : 1.6);
    const groundY = this.renderBounds.top + anchor.baseY * this.renderBounds.height;
    const maxHeight = Math.max(10, groundY - this.renderBounds.top);
    const height = Math.min(desiredHeight, maxHeight);

    const left = this.renderBounds.left + anchor.centerX * this.renderBounds.width - width / 2;
    const top = groundY - height;

    return { left, top, width, height };
  }

  /**
   * Create and position a canvas that will host a fractal tree.
   * @param {{left:number, top:number, width:number, height:number}} layout
   */
  createCanvas(layout) {
    const canvas = document.createElement('canvas');
    canvas.className = 'fluid-terrarium__tree';
    canvas.width = Math.max(1, Math.round(layout.width));
    canvas.height = Math.max(1, Math.round(layout.height));
    canvas.style.left = `${layout.left}px`;
    canvas.style.top = `${layout.top}px`;
    canvas.style.width = `${layout.width}px`;
    canvas.style.height = `${layout.height}px`;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');
    return canvas;
  }

  /**
   * Configure the Shin fractal tree simulation for the given canvas.
   * @param {'large'|'small'} size
   * @param {HTMLCanvasElement} canvas
   * @param {number} height
   */
  buildSimulation(size, canvas, height) {
    const depth = size === 'large' ? 9 : 8;
    const baseWidth = size === 'large' ? 7 : 5;
    const rootLength = Math.max(16, height * (size === 'large' ? 0.36 : 0.3));

    const simulation = new FractalTreeSimulation({
      canvas,
      bgColor: 'rgba(0, 0, 0, 0)',
      trunkColor: '#e6e6ea',
      twigColor: '#a2e3f5',
      leafColor: '#a2e3f5',
      leafAlpha: 0.26,
      branchFactor: 2,
      baseSpreadDeg: 25,
      lengthDecay: 0.7,
      maxDepth: depth,
      angleJitterDeg: 3,
      gravityBend: 0.08,
      growthRate: size === 'large' ? 3 : 2,
      renderStyle: 'bezier',
      baseWidth,
      minWidth: 0.65,
      rootLength,
      rootX: 0.5,
      rootY: 0.98,
      seed: Math.floor(Math.random() * 100000),
    });

    simulation.updateConfig({
      allocated: 999,
      maxDepth: depth,
    });

    return simulation;
  }

  /**
   * Convert a fully grown fractal tree canvas into a static image to reduce render cost.
   * @param {{canvas: HTMLCanvasElement|HTMLImageElement, simulation: FractalTreeSimulation|null, frozen: boolean}} tree
   */
  freezeTree(tree) {
    if (!tree || tree.frozen || !(tree.canvas instanceof HTMLCanvasElement)) {
      return;
    }

    const { canvas, simulation } = tree;

    // Ensure the final frame is rendered before capturing the bitmap.
    if (simulation) {
      simulation.render();
    }

    const image = new Image();
    image.className = canvas.className;
    image.style.cssText = canvas.style.cssText;
    image.width = canvas.width;
    image.height = canvas.height;
    image.setAttribute('aria-hidden', 'true');
    image.setAttribute('role', 'presentation');
    image.src = canvas.toDataURL('image/png');

    canvas.replaceWith(image);
    tree.canvas = image;
    tree.simulation = null;
    tree.frozen = true;
  }

  /**
   * Begin the animation loop so branches keep sprouting.
   */
  start() {
    if (this.running || !this.trees.length) {
      return;
    }
    this.running = true;
    this.animationFrame = requestAnimationFrame(this.handleFrame);
  }

  /**
   * Stop the animation loop and cancel pending frames.
   */
  stop() {
    this.running = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Advance growth and render all active trees.
   */
  handleFrame() {
    if (!this.running) {
      return;
    }

    // Track whether any simulations still need to advance so we can stop once all are frozen.
    let hasActiveSimulation = false;

    this.trees.forEach((tree) => {
      if (!tree?.simulation) {
        return;
      }
      tree.simulation.update();
      tree.simulation.render();

      if (tree.simulation.isComplete) {
        // Replace fully grown fractals with a static bitmap to avoid ongoing renders.
        this.freezeTree(tree);
        return;
      }

      hasActiveSimulation = true;
    });

    if (!hasActiveSimulation) {
      this.stop();
      return;
    }

    this.animationFrame = requestAnimationFrame(this.handleFrame);
  }

  /**
   * Disconnect observers and halt rendering.
   */
  destroy() {
    this.stop();
    if (this.resizeObserver) {
      try {
        this.resizeObserver.disconnect();
      } catch (error) {
        console.warn('Failed to disconnect terrarium tree resize observer.', error);
      }
    }
  }
}
