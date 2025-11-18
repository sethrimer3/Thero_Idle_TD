'use strict';

/**
 * Render animated blades of grass that sway above the Bet terrarium terrain silhouettes.
 */
export class FluidTerrariumGrass {
  constructor(options = {}) {
    /** @type {HTMLElement|null} */
    this.container = options.container || null;
    /** @type {HTMLImageElement|null} */
    this.terrainElement = options.terrainElement || null;
    /** @type {HTMLImageElement|null} */
    this.floatingIslandElement = options.floatingIslandElement || null;
    /** @type {string[]} */
    this.maskUrls = Array.isArray(options.maskUrls)
      ? options.maskUrls.filter((url) => typeof url === 'string')
      : typeof options.maskUrl === 'string'
        ? [options.maskUrl]
        : [];

    this.canvas = null;
    this.ctx = null;
    this.bounds = { width: 0, height: 0 };
    this.renderBounds = { left: 0, top: 0, width: 0, height: 0 };
    this.maskImages = [];
    this.terrainProfile = null;
    this.islandProfile = null;
    this.grassBlades = [];
    this.animationFrame = null;
    this.resizeObserver = null;

    this.handleFrame = this.handleFrame.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleMaskLoad = this.handleMaskLoad.bind(this);
    this.handleTerrainLoad = this.handleTerrainLoad.bind(this);
    this.handleIslandLoad = this.handleIslandLoad.bind(this);

    this.initializeCanvas();
    this.observeContainer();
    this.observeSurfaceElement(this.terrainElement, this.handleTerrainLoad);
    this.observeSurfaceElement(this.floatingIslandElement, this.handleIslandLoad);
    this.loadMasks();
  }

  /**
   * Clamp a numeric value to the provided range.
   */
  clamp(value, min, max) {
    if (!Number.isFinite(value)) {
      return min;
    }
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  }

  /**
   * Create the overlay canvas and bind drawing context properties.
   */
  initializeCanvas() {
    if (!this.container || typeof document === 'undefined') {
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.className = 'fluid-terrarium__grass';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (this.ctx) {
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
    }
    this.container.appendChild(canvas);
    this.refreshBounds();
  }

  /**
   * Listen for container resizes so grass positions stay aligned with the terrain sprites.
   */
  observeContainer() {
    if (!this.container || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.container);
  }

  /**
   * Resize the canvas and update grass layout when the viewport changes.
   */
  handleResize() {
    this.refreshBounds();
    this.refreshGrass();
  }

  /**
   * Store the latest viewport bounds and scale the canvas for device pixel ratios.
   */
  refreshBounds() {
    if (!this.container || !this.canvas) {
      return;
    }
    const rect = this.container.getBoundingClientRect();
    this.bounds.width = this.container.clientWidth || rect.width;
    this.bounds.height = this.container.clientHeight || rect.height;
    const dpr = typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
      ? window.devicePixelRatio
      : 1;
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
   * Calculate the object-fit bounds so grass positions match the scaled sprite images.
   */
  updateRenderBounds() {
    const referenceMask = this.getReferenceMask();
    if (!referenceMask || !referenceMask.naturalWidth || !referenceMask.naturalHeight) {
      this.renderBounds = { left: 0, top: 0, width: this.bounds.width, height: this.bounds.height };
      return;
    }
    const containerRatio = this.bounds.width / Math.max(1, this.bounds.height || 1);
    const spriteRatio = referenceMask.naturalWidth / referenceMask.naturalHeight;
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
   * Kick off mask loading so grass spawn coordinates can be traced.
   */
  loadMasks() {
    if (this.maskImages.length || !this.maskUrls.length || typeof Image === 'undefined') {
      return;
    }
    this.maskUrls.forEach((maskUrl) => {
      const maskImage = new Image();
      maskImage.decoding = 'async';
      maskImage.loading = 'eager';
      maskImage.src = maskUrl;
      maskImage.addEventListener('load', () => this.handleMaskLoad(maskImage), { once: true });
    });
  }

  /**
   * Handle completion of a mask load and regenerate blades.
   * @param {HTMLImageElement} maskImage
   */
  handleMaskLoad(maskImage) {
    if (!maskImage?.naturalWidth || !maskImage?.naturalHeight) {
      return;
    }
    this.maskImages.push(maskImage);
    this.updateRenderBounds();
    this.refreshGrass(true);
  }

  /**
   * Resolve the primary mask used for sizing calculations.
   * @returns {HTMLImageElement|null}
   */
  getReferenceMask() {
    if (this.maskImages.length) {
      return this.maskImages[0];
    }
    return null;
  }

  /**
   * Observe a terrain sprite so silhouette sampling happens once the image is ready.
   */
  observeSurfaceElement(element, handler) {
    if (!element) {
      return;
    }
    if (element.complete && element.naturalWidth > 0 && element.naturalHeight > 0) {
      handler();
      return;
    }
    element.addEventListener('load', handler, { once: true });
  }

  /**
   * Sample the main terrain silhouette once the sprite is loaded.
   */
  handleTerrainLoad() {
    this.terrainProfile = this.sampleSurfaceProfile(this.terrainElement);
    this.refreshGrass(true);
  }

  /**
   * Sample the floating island silhouette once the sprite is loaded.
   */
  handleIslandLoad() {
    this.islandProfile = this.sampleSurfaceProfile(this.floatingIslandElement);
    this.refreshGrass(true);
  }

  /**
   * Convert a sprite alpha silhouette into a column-wise top contour profile.
   */
  sampleSurfaceProfile(element) {
    if (
      !element ||
      !Number.isFinite(element.naturalWidth) ||
      !Number.isFinite(element.naturalHeight) ||
      element.naturalWidth <= 0 ||
      element.naturalHeight <= 0
    ) {
      return null;
    }
    const sampleWidth = Math.min(256, Math.max(64, Math.round(element.naturalWidth / 4)));
    const aspectRatio = element.naturalHeight / element.naturalWidth;
    const sampleHeight = Math.max(1, Math.round(sampleWidth * aspectRatio));
    const canvas = document.createElement('canvas');
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(element, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const samples = new Float32Array(canvas.width);
    const alphaThreshold = 8;
    for (let x = 0; x < canvas.width; x += 1) {
      let sampleY = Number.POSITIVE_INFINITY;
      for (let y = 0; y < canvas.height; y += 1) {
        const index = (y * canvas.width + x) * 4 + 3;
        if (imageData.data[index] > alphaThreshold) {
          sampleY = y;
          break;
        }
      }
      samples[x] = Number.isFinite(sampleY) ? sampleY : Number.POSITIVE_INFINITY;
    }
    return { width: canvas.width, height: canvas.height, samples };
  }

  /**
   * Map an x coordinate to a normalized y value on the provided silhouette profile.
   */
  sampleProfileAt(profile, normalizedX) {
    if (!profile || !profile.samples || profile.samples.length === 0) {
      return null;
    }
    const clampedX = this.clamp(normalizedX, 0, 1);
    const rawIndex = clampedX * (profile.samples.length - 1);
    const lowerIndex = Math.floor(rawIndex);
    const upperIndex = Math.min(profile.samples.length - 1, lowerIndex + 1);
    const t = rawIndex - lowerIndex;
    const lower = Number.isFinite(profile.samples[lowerIndex]) ? profile.samples[lowerIndex] : null;
    const upper = Number.isFinite(profile.samples[upperIndex]) ? profile.samples[upperIndex] : null;
    if (lower === null && upper === null) {
      return null;
    }
    const start = lower !== null ? lower : upper;
    const end = upper !== null ? upper : lower;
    const sampleValue = start + (end - start) * t;
    if (!Number.isFinite(sampleValue) || !Number.isFinite(profile.height)) {
      return null;
    }
    if (sampleValue >= profile.height) {
      return null;
    }
    return sampleValue / profile.height;
  }

  /**
   * Select whether a grass blade should anchor to the terrain or floating island silhouette.
   */
  pickSurface(normalizedX, normalizedMaskY) {
    const candidates = [];
    const terrainY = this.sampleProfileAt(this.terrainProfile, normalizedX);
    if (Number.isFinite(terrainY)) {
      candidates.push({ key: 'terrain', y: terrainY });
    }
    const islandY = this.sampleProfileAt(this.islandProfile, normalizedX);
    if (Number.isFinite(islandY)) {
      candidates.push({ key: 'island', y: islandY });
    }
    if (!candidates.length) {
      return null;
    }
    candidates.forEach((candidate) => {
      candidate.distance = Math.abs(normalizedMaskY - candidate.y);
    });
    candidates.sort((a, b) => a.distance - b.distance);
    const best = candidates[0];
    if (!best || !Number.isFinite(best.distance)) {
      return null;
    }
    if (best.distance > 0.18) {
      return null;
    }
    return best;
  }

  /**
   * Create a grass blade descriptor with sway parameters derived from normalized coordinates.
   */
  createGrassBlade(normalizedX, baseYNormalized) {
    const lengthFactor = 0.015 + Math.random() * 0.028;
    const swayFactor = 0.08 + Math.random() * 0.12;
    const swaySpeed = 0.9 + Math.random() * 0.9;
    const baseThickness = 0.65 + Math.random() * 0.55;
    const lean = (Math.random() - 0.5) * 4.4;
    const shade = Math.random() * 0.28;
    return {
      normalizedX,
      baseYNormalized,
      lengthFactor,
      swayFactor,
      swaySpeed,
      swayOffset: Math.random() * Math.PI * 2,
      baseThickness,
      lean,
      shade,
      baseX: 0,
      baseY: 0,
      length: 0,
      swayAmplitude: 0,
      thickness: baseThickness,
    };
  }

  /**
   * Update cached pixel coordinates for every grass blade after a resize.
   */
  updateBladeLayout() {
    if (!this.renderBounds.width || !this.renderBounds.height || !this.grassBlades.length) {
      return;
    }
    this.grassBlades.forEach((blade) => {
      blade.baseX = this.renderBounds.left + blade.normalizedX * this.renderBounds.width;
      blade.baseY = this.renderBounds.top + blade.baseYNormalized * this.renderBounds.height;
      blade.length = blade.lengthFactor * this.renderBounds.height;
      blade.swayAmplitude = blade.length * blade.swayFactor;
      blade.thickness = blade.baseThickness;
    });
  }

  /**
   * Parse the grass mask into a set of blades anchored to the nearest terrain surface.
   */
  seedGrassFromMask() {
    const referenceMask = this.getReferenceMask();
    if (!referenceMask || !referenceMask.naturalWidth || !referenceMask.naturalHeight) {
      return;
    }
    const offscreen = document.createElement('canvas');
    offscreen.width = referenceMask.naturalWidth;
    offscreen.height = referenceMask.naturalHeight;
    const ctx = offscreen.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, offscreen.width, offscreen.height);
    let blades = [];
    let seen = 0;
    const alphaThreshold = 6;
    const maxBlades = 820;

    this.maskImages.forEach((mask) => {
      ctx.clearRect(0, 0, offscreen.width, offscreen.height);
      ctx.drawImage(mask, 0, 0, offscreen.width, offscreen.height);
      const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height).data;
      for (let y = 0; y < offscreen.height; y += 1) {
        for (let x = 0; x < offscreen.width; x += 1) {
          const index = (y * offscreen.width + x) * 4 + 3;
          const alpha = imageData[index];
          if (alpha <= alphaThreshold) {
            continue;
          }
          const normalizedX = x / (offscreen.width - 1);
          const normalizedY = y / (offscreen.height - 1);
          const surface = this.pickSurface(normalizedX, normalizedY);
          if (!surface) {
            continue;
          }
          const blade = this.createGrassBlade(normalizedX, surface.y);
          seen += 1;
          if (blades.length < maxBlades) {
            blades.push(blade);
          } else {
            const replaceIndex = Math.floor(Math.random() * seen);
            if (replaceIndex < blades.length) {
              blades[replaceIndex] = blade;
            }
          }
        }
      }
    });
    this.grassBlades = blades;
    this.updateBladeLayout();
  }

  /**
   * Recompute grass blades when new assets load or the viewport changes.
   * @param {boolean} forceReseed
   */
  refreshGrass(forceReseed = false) {
    if (!this.canvas || !this.ctx || !this.bounds.width || !this.bounds.height) {
      return;
    }
    if (!this.maskImages.length || (!this.terrainProfile && !this.islandProfile)) {
      return;
    }
    this.updateRenderBounds();
    if (forceReseed || !this.grassBlades.length) {
      this.seedGrassFromMask();
    }
    this.updateBladeLayout();
    this.start();
  }

  /**
   * Begin the animation loop if it is not already running.
   */
  start() {
    if (this.animationFrame || !this.grassBlades.length) {
      return;
    }
    this.animationFrame = requestAnimationFrame(this.handleFrame);
  }

  /**
   * Cancel the animation loop.
   */
  stop() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Draw a single animation frame of swaying grass.
   */
  handleFrame(timestamp) {
    if (!this.ctx || !this.canvas) {
      this.stop();
      return;
    }
    this.ctx.clearRect(0, 0, this.bounds.width, this.bounds.height);
    const windPhase = Math.sin((timestamp % 9000) / 9000 * Math.PI * 2);
    this.grassBlades.forEach((blade) => {
      const sway = Math.sin(timestamp * 0.001 * blade.swaySpeed + blade.swayOffset);
      const windPush = windPhase * blade.length * 0.08;
      const offset = sway * blade.swayAmplitude + windPush + blade.lean;
      const controlX = blade.baseX + offset * 0.32;
      const tipX = blade.baseX + offset;
      const tipY = blade.baseY - blade.length;
      const greenChannel = Math.round(170 + blade.shade * 60);
      const stroke = `rgba(44, ${greenChannel}, 108, 0.9)`;
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = blade.thickness;
      this.ctx.beginPath();
      this.ctx.moveTo(blade.baseX, blade.baseY);
      this.ctx.quadraticCurveTo(controlX, blade.baseY - blade.length * 0.48, tipX, tipY);
      this.ctx.stroke();
    });
    this.animationFrame = requestAnimationFrame(this.handleFrame);
  }

  /**
   * Tear down observers and DOM nodes for cleanup.
   */
  destroy() {
    this.stop();
    if (this.resizeObserver) {
      try {
        this.resizeObserver.disconnect();
      } catch (error) {
        console.warn('Failed to disconnect terrarium grass resize observer.', error);
      }
      this.resizeObserver = null;
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.grassBlades.length = 0;
  }
}
