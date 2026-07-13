import { resolveTerrariumDevicePixelRatio } from './fluidTerrariumResolution.js';

'use strict';

/**
 * Render the Bet terrarium water mask with a light cyan tint and a gentle surface ripple.
 */
export class FluidTerrariumWater {
  constructor(options = {}) {
    /** @type {HTMLElement|null} */
    this.container = options.container || null;
    /** @type {string} */
    this.maskUrl = typeof options.maskUrl === 'string' ? options.maskUrl : '';
    /** @type {HTMLImageElement|null} */
    this.maskImage = null;

    this.canvas = null;
    this.ctx = null;
    this.bounds = { width: 0, height: 0 };
    this.renderBounds = { left: 0, top: 0, width: 0, height: 0 };
    this.waveStart = performance.now();
    this.maskTopProfile = [];

    this.animationFrame = null;
    this.resizeObserver = null;

    this.handleFrame = this.handleFrame.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleMaskLoad = this.handleMaskLoad.bind(this);

    this.initializeCanvas();
    this.observeContainer();
    this.loadMask();
  }

  /**
   * Create the water canvas and attach the rendering context.
   */
  initializeCanvas() {
    if (!this.container || typeof document === 'undefined') {
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.className = 'fluid-terrarium__water';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.container.appendChild(canvas);
    this.refreshBounds();
  }

  /**
   * Observe resizes on the host container so the water mask scales with the viewport.
   */
  observeContainer() {
    if (!this.container || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.container);
  }

  /**
   * Handle viewport size changes.
   */
  handleResize() {
    this.refreshBounds();
    this.drawFrame();
  }

  /**
   * Update cached bounds and canvas scaling for device pixel ratios.
   */
  refreshBounds() {
    if (!this.container || !this.canvas) {
      return;
    }
    const rect = this.container.getBoundingClientRect();
    this.bounds.width = this.container.clientWidth || rect.width;
    this.bounds.height = this.container.clientHeight || rect.height;
    const dpr = resolveTerrariumDevicePixelRatio();
    this.canvas.width = Math.max(1, Math.round(this.bounds.width * dpr));
    this.canvas.height = Math.max(1, Math.round(this.bounds.height * dpr));
    this.canvas.style.width = `${this.bounds.width}px`;
    this.canvas.style.height = `${this.bounds.height}px`;
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.updateRenderBounds();
  }

  /**
   * Fit the mask to the container using the same contain rules as the base sprites.
   */
  updateRenderBounds() {
    if (!this.maskImage?.naturalWidth || !this.maskImage?.naturalHeight) {
      this.renderBounds = { left: 0, top: 0, width: this.bounds.width, height: this.bounds.height };
      return;
    }
    const containerRatio = this.bounds.width / Math.max(1, this.bounds.height || 1);
    const spriteRatio = this.maskImage.naturalWidth / this.maskImage.naturalHeight;
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
   * Begin loading the solid-color water mask.
   */
  loadMask() {
    if (!this.maskUrl || typeof Image === 'undefined') {
      return;
    }
    const maskImage = new Image();
    maskImage.decoding = 'async';
    maskImage.loading = 'eager';
    maskImage.src = this.maskUrl;
    maskImage.addEventListener('load', () => this.handleMaskLoad(maskImage), { once: true });
  }

  /**
   * Cache the loaded mask and sample its top contour for ripple placement.
   * @param {HTMLImageElement} maskImage
   */
  handleMaskLoad(maskImage) {
    if (!maskImage?.naturalWidth || !maskImage?.naturalHeight) {
      return;
    }
    this.maskImage = maskImage;
    this.sampleMaskTopEdge();
    this.updateRenderBounds();
    this.drawFrame();
  }

  /**
   * Extract the top-most opaque pixel per column to anchor the ripple line.
   */
  sampleMaskTopEdge() {
    if (!this.maskImage?.naturalWidth || !this.maskImage?.naturalHeight || typeof document === 'undefined') {
      this.maskTopProfile = [];
      return;
    }
    const sampleWidth = Math.min(256, Math.max(64, Math.round(this.maskImage.naturalWidth / 4)));
    const aspectRatio = this.maskImage.naturalHeight / this.maskImage.naturalWidth;
    const sampleHeight = Math.max(1, Math.round(sampleWidth * aspectRatio));
    const canvas = document.createElement('canvas');
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.maskImage, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const alphaThreshold = 8;
    this.maskTopProfile = new Float32Array(canvas.width);
    for (let x = 0; x < canvas.width; x += 1) {
      let sampleY = canvas.height;
      for (let y = 0; y < canvas.height; y += 1) {
        const index = (y * canvas.width + x) * 4 + 3;
        if (imageData.data[index] > alphaThreshold) {
          sampleY = y;
          break;
        }
      }
      this.maskTopProfile[x] = sampleY / canvas.height;
    }
  }

  /**
   * Start the animation loop.
   */
  start() {
    if (this.animationFrame) {
      return;
    }
    this.animationFrame = window.requestAnimationFrame(this.handleFrame);
  }

  /**
   * Stop the animation loop and cleanup observers.
   */
  stop() {
    if (this.animationFrame) {
      window.cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.resizeObserver) {
      try {
        this.resizeObserver.disconnect();
      } catch (error) {
        console.warn('Failed to disconnect fluid water resize observer.', error);
      }
      this.resizeObserver = null;
    }
  }

  /**
   * Render a single frame, tinting the mask and animating the surface ripple.
   */
  drawFrame() {
    if (!this.ctx || !this.canvas || !this.maskImage) {
      return;
    }
    const { left, top, width, height } = this.renderBounds;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Base fill
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(112, 193, 255, 0.5)';
    this.ctx.fillRect(left, top, width, height);
    this.ctx.globalCompositeOperation = 'destination-in';
    this.ctx.drawImage(this.maskImage, left, top, width, height);
    this.ctx.restore();

    // Ripple line
    if (this.maskTopProfile.length > 0) {
      const elapsed = (performance.now() - this.waveStart) / 1000;
      const amplitude = Math.min(6, height * 0.02);
      const detail = this.maskTopProfile.length;

      this.ctx.save();
      this.ctx.globalCompositeOperation = 'source-atop';
      this.ctx.lineWidth = Math.max(1.2, width * 0.0035);
      this.ctx.strokeStyle = 'rgba(224, 244, 255, 0.65)';
      this.ctx.beginPath();
      for (let index = 0; index < detail; index += 1) {
        const xRatio = detail <= 1 ? 0 : index / (detail - 1);
        const baseY = top + this.maskTopProfile[index] * height;
        const wave = Math.sin(elapsed * 1.6 + xRatio * Math.PI * 3) * amplitude;
        const bob = Math.sin(elapsed * 0.8) * amplitude * 0.3;
        const x = left + xRatio * width;
        const y = baseY + wave + bob;
        if (index === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  /**
   * Animation handler that advances the ripple and queues the next frame.
   */
  handleFrame() {
    this.drawFrame();
    this.animationFrame = window.requestAnimationFrame(this.handleFrame);
  }
}
