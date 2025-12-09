/**
 * Palette stops for bird gradient effects.
 */
const DEFAULT_BIRD_COLOR_STOPS = [
  '#1f6fa8',
  '#31a6c7',
  '#7ed8b1',
];

/**
 * Build a CSS gradient string for bird rendering.
 * @returns {string}
 */
function createBirdGradientString() {
  const stops = DEFAULT_BIRD_COLOR_STOPS;
  const positions = [0, 0.5, 1];
  const parts = stops.map((color, index) => `${color} ${Math.round(positions[index] * 100)}%`);
  return `linear-gradient(135deg, ${parts.join(', ')})`;
}

/**
 * Clamp a numeric value between two bounds.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Generate a random float within the provided range.
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Lightweight physics simulation for gamma birds flying in the terrarium.
 */
export class FluidTerrariumBirds {
  constructor(options = {}) {
    this.container = options.container || null;
    this.birdCount = Number.isFinite(options.birdCount) ? Math.max(1, Math.round(options.birdCount)) : 1;
    this.terrainElement = options.terrainElement || null;
    this.terrainCollisionElement = options.terrainCollisionElement || null;
    this.birds = [];
    this.layer = null;
    this.bounds = { width: 0, height: 0 };
    this.terrainBounds = { left: 0, right: 0, width: 0, top: 0, bottom: 0, height: 0 };
    this.terrainProfile = null;
    this.running = false;
    this.animationFrame = null;
    this.lastTimestamp = null;
    this.resizeObserver = null;
    this.terrainProfileSource = null;
    this.handleFrame = this.handleFrame.bind(this);
    this.handleTerrainImageLoad = this.handleTerrainImageLoad.bind(this);

    if (this.container) {
      this.initializeLayer();
      this.refreshBounds();
      this.spawnBirds();
      this.observeContainer();
    }

    this.observeTerrainElement(this.getTerrainProfileSource());
  }

  /**
   * Resolve the image element that should be sampled for terrain avoidance.
   * @returns {HTMLImageElement|null}
   */
  getTerrainProfileSource() {
    return this.terrainCollisionElement || this.terrainElement;
  }

  /**
   * Insert the overlay layer that hosts the bird elements.
   */
  initializeLayer() {
    if (!this.container) {
      return;
    }
    const layer = document.createElement('div');
    layer.className = 'fluid-terrarium-bird-layer';
    layer.style.position = 'absolute';
    layer.style.inset = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '2';
    this.layer = layer;
    this.container.appendChild(layer);
  }

  /**
   * Listen for viewport resizes.
   */
  observeContainer() {
    if (!this.container || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => {
      this.refreshBounds();
    });
    this.resizeObserver.observe(this.container);
  }

  /**
   * Update cached bounds when the viewport changes size.
   */
  refreshBounds() {
    if (!this.container) {
      return;
    }
    const rect = this.container.getBoundingClientRect();
    this.bounds.width = this.container.clientWidth || rect.width;
    this.bounds.height = this.container.clientHeight || rect.height;

    const boundsElement = this.terrainElement || this.terrainCollisionElement;
    if (boundsElement) {
      const terrainRect = boundsElement.getBoundingClientRect();
      this.terrainBounds = {
        left: terrainRect.left - rect.left,
        right: terrainRect.right - rect.left,
        width: terrainRect.width,
        top: terrainRect.top - rect.top,
        bottom: terrainRect.bottom - rect.top,
        height: terrainRect.height,
      };
    }
  }

  /**
   * Populate the terrarium with flying gamma birds.
   */
  spawnBirds() {
    if (!this.layer) {
      return;
    }
    for (let index = 0; index < this.birdCount; index += 1) {
      const size = randomBetween(4, 6);
      const element = document.createElement('div');
      element.className = 'fluid-terrarium-bird';
      element.textContent = 'γ';
      element.style.fontSize = `${size}px`;
      element.style.backgroundImage = createBirdGradientString();
      element.style.position = 'absolute';
      element.style.willChange = 'transform';
      element.style.transition = 'transform 0.1s ease-out';
      
      const bird = {
        element,
        size,
        x: randomBetween(0, this.bounds.width || 100),
        y: randomBetween(0, (this.bounds.height || 100) * 0.6), // Start in upper portion
        vx: randomBetween(-80, 80),
        vy: randomBetween(-40, 40),
        targetVx: randomBetween(-80, 80),
        targetVy: randomBetween(-40, 40),
        state: 'flying',
        nextDirectionChange: performance.now() + randomBetween(2000, 5000),
      };
      
      this.birds.push(bird);
      this.layer.appendChild(element);
      this.updateBirdTransform(bird);
    }
  }

  /**
   * Check if a position would collide with terrain.
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  wouldCollideWithTerrain(x, y) {
    if (!this.terrainProfile || this.terrainBounds.width <= 0) {
      return false;
    }
    
    const normalizedX = clamp((x - this.terrainBounds.left) / this.terrainBounds.width, 0, 1);
    const samples = this.terrainProfile.samples;
    if (!samples || !samples.length) {
      return false;
    }
    
    const rawIndex = normalizedX * (samples.length - 1);
    const lowerIndex = Math.floor(rawIndex);
    const upperIndex = Math.min(samples.length - 1, lowerIndex + 1);
    const t = rawIndex - lowerIndex;
    const lower = samples[lowerIndex];
    const upper = samples[upperIndex];
    const sampleValue = lower + (upper - lower) * t;
    
    if (!Number.isFinite(sampleValue) || !Number.isFinite(this.terrainProfile.height)) {
      return false;
    }
    
    const normalizedY = sampleValue / this.terrainProfile.height;
    const terrainY = this.terrainBounds.top + normalizedY * this.terrainBounds.height;
    
    // Bird collides if it's below the terrain surface (with a small margin)
    return y > terrainY - 20;
  }

  /**
   * Update bird physics and behavior.
   */
  updateBird(bird, deltaSeconds, now) {
    if (!this.bounds.width || !this.bounds.height) {
      return;
    }

    // Change direction periodically
    if (now >= bird.nextDirectionChange) {
      bird.targetVx = randomBetween(-80, 80);
      bird.targetVy = randomBetween(-40, 40);
      bird.nextDirectionChange = now + randomBetween(2000, 5000);
    }

    // Smoothly interpolate velocity towards target
    const velocityLerp = clamp(deltaSeconds * 0.8, 0, 1);
    bird.vx += (bird.targetVx - bird.vx) * velocityLerp;
    bird.vy += (bird.targetVy - bird.vy) * velocityLerp;

    // Predict next position
    const nextX = bird.x + bird.vx * deltaSeconds;
    const nextY = bird.y + bird.vy * deltaSeconds;

    // Avoid terrain
    if (this.wouldCollideWithTerrain(nextX, nextY)) {
      // Fly upward to avoid terrain
      bird.targetVy = -Math.abs(bird.targetVy) - 40;
      bird.vy = bird.targetVy;
    }

    // Update position
    bird.x = nextX;
    bird.y = nextY;

    // Wrap around screen edges
    const padding = 20;
    if (bird.x < -padding) {
      bird.x = this.bounds.width + padding;
    } else if (bird.x > this.bounds.width + padding) {
      bird.x = -padding;
    }

    if (bird.y < -padding) {
      bird.y = this.bounds.height + padding;
    } else if (bird.y > this.bounds.height + padding) {
      bird.y = -padding;
    }

    this.updateBirdTransform(bird);
  }

  /**
   * Convert the physics state into DOM transforms.
   */
  updateBirdTransform(bird) {
    const transform = `translate(${bird.x.toFixed(2)}px, ${bird.y.toFixed(2)}px) translate(-50%, -50%)`;
    bird.element.style.transform = transform;
  }

  /**
   * Main animation loop driven by requestAnimationFrame.
   */
  handleFrame(timestamp) {
    if (!this.running) {
      return;
    }
    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp;
    }
    const deltaMs = timestamp - this.lastTimestamp;
    const deltaSeconds = deltaMs / 1000;
    this.birds.forEach((bird) => this.updateBird(bird, deltaSeconds, timestamp));
    this.lastTimestamp = timestamp;
    this.animationFrame = requestAnimationFrame(this.handleFrame);
  }

  /**
   * Begin animating the birds.
   */
  start() {
    if (this.running || !this.layer) {
      return;
    }
    this.running = true;
    this.lastTimestamp = null;
    this.animationFrame = requestAnimationFrame(this.handleFrame);
  }

  /**
   * Halt the animation loop.
   */
  stop() {
    this.running = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Sample the terrain collision sprite.
   */
  sampleTerrainProfile() {
    const sourceElement = this.getTerrainProfileSource();

    if (
      !sourceElement ||
      !Number.isFinite(sourceElement.naturalWidth) ||
      !Number.isFinite(sourceElement.naturalHeight) ||
      sourceElement.naturalWidth <= 0 ||
      sourceElement.naturalHeight <= 0
    ) {
      return;
    }
    const sampleWidth = Math.min(256, Math.max(48, Math.round(sourceElement.naturalWidth / 4)));
    const aspectRatio = sourceElement.naturalHeight / sourceElement.naturalWidth;
    const sampleHeight = Math.max(1, Math.round(sampleWidth * aspectRatio));
    const canvas = document.createElement('canvas');
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sourceElement, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const samples = new Float32Array(canvas.width);
    const alphaThreshold = 8;
    
    // Scan from top to bottom to find the topmost terrain surface (including floating islands)
    // Birds avoid ALL surfaces from above, unlike slimes which walk on the ground
    for (let x = 0; x < canvas.width; x += 1) {
      let sampleY = canvas.height;
      for (let y = 0; y < canvas.height; y += 1) {
        const index = (y * canvas.width + x) * 4 + 3;
        if (imageData.data[index] > alphaThreshold) {
          sampleY = y;
          break;
        }
      }
      samples[x] = sampleY;
    }
    this.terrainProfile = {
      width: canvas.width,
      height: canvas.height,
      samples,
    };
  }

  /**
   * Watch for terrain sprite load events.
   */
  handleTerrainImageLoad() {
    this.sampleTerrainProfile();
  }

  /**
   * Attach terrain sprite observation.
   */
  observeTerrainElement(element) {
    if (this.terrainProfileSource && this.terrainProfileSource !== element) {
      this.terrainProfileSource.removeEventListener('load', this.handleTerrainImageLoad);
    }

    this.terrainProfileSource = element || null;

    if (this.terrainProfileSource) {
      this.terrainProfileSource.addEventListener('load', this.handleTerrainImageLoad);
      if (this.terrainProfileSource.complete && this.terrainProfileSource.naturalWidth > 0) {
        this.sampleTerrainProfile();
      }
    }
  }

  /**
   * Clean up resources.
   */
  destroy() {
    this.stop();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.terrainProfileSource) {
      this.terrainProfileSource.removeEventListener('load', this.handleTerrainImageLoad);
    }
    if (this.layer && this.layer.parentNode) {
      this.layer.parentNode.removeChild(this.layer);
    }
    this.birds = [];
    this.layer = null;
  }
}
