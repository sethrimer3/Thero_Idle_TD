/**
 * Palette stops that blend from deep navy to glimmering greens to match the Bet terrarium brief.
 */
const DEFAULT_COLOR_STOPS = [
  '#05142a',
  '#123c72',
  '#1f6fa8',
  '#31a6c7',
  '#7ed8b1',
  '#1d6f35',
];

/**
 * Build a CSS gradient string from the configured color ramp.
 * @returns {string}
 */
function createGradientString() {
  const stops = DEFAULT_COLOR_STOPS;
  const positions = [0, 0.28, 0.48, 0.68, 0.86, 1];
  const parts = stops.map((color, index) => `${color} ${Math.round(positions[index] * 100)}%`);
  return `linear-gradient(180deg, ${parts.join(', ')})`;
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
 * Lightweight physics simulation that animates Delta slimes inside the fluid viewport.
 */
export class FluidTerrariumCreatures {
  constructor(options = {}) {
    this.container = options.container || null;
    this.creatureCount = Number.isFinite(options.creatureCount) ? Math.max(1, Math.round(options.creatureCount)) : 4;
    this.gravity = Number.isFinite(options.gravity) ? options.gravity : 1800; // px/s^2
    this.terrainElement = options.terrainElement || null;
    this.terrainCollisionElement = options.terrainCollisionElement || null;
    this.spawnZones = Array.isArray(options.spawnZones) ? options.spawnZones : [];
    this.creatures = [];
    this.layer = null;
    this.badgeLayer = null;
    this.bounds = { width: 0, height: 0 };
    this.terrainBounds = { left: 0, right: 0, width: 0, top: 0, bottom: 0, height: 0 };
    this.resolvedSpawnZones = [];
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
      this.spawnCreatures();
      this.observeContainer();
    }

    this.observeTerrainElement(this.getTerrainProfileSource());
  }

  /**
   * Resolve the image element that should be sampled for collision silhouettes.
   * @returns {HTMLImageElement|null}
   */
  getTerrainProfileSource() {
    return this.terrainCollisionElement || this.terrainElement;
  }

  /**
   * Insert the overlay layer that hosts the slime elements.
   */
  initializeLayer() {
    if (!this.container) {
      return;
    }
    const layer = document.createElement('div');
    layer.className = 'fluid-terrarium-creature-layer';
    this.layer = layer;
    this.container.appendChild(layer);

    // Create badge layer for showing count above slimes
    const badgeLayer = document.createElement('div');
    badgeLayer.className = 'fluid-terrarium-creature-badges';
    badgeLayer.style.position = 'absolute';
    badgeLayer.style.inset = '0';
    badgeLayer.style.pointerEvents = 'none';
    badgeLayer.style.zIndex = '1';
    this.badgeLayer = badgeLayer;
    this.container.appendChild(badgeLayer);
    
    // Create and show the count badge
    this.updateCountBadge();
  }

  /**
   * Listen for viewport resizes so ground collisions remain accurate.
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

    this.resolveSpawnZones();
    this.syncCreatureZones();
  }

  /**
   * Populate the terrarium with a small cluster of animated Deltas.
   */
  spawnCreatures() {
    if (!this.layer) {
      return;
    }
    for (let index = 0; index < this.creatureCount; index += 1) {
      const size = randomBetween(3.2, 4.8);
      const element = document.createElement('div');
      element.className = 'fluid-terrarium-creature';
      element.textContent = 'Δ';
      element.style.fontSize = `${size}px`;
      element.style.backgroundImage = createGradientString();
      const creature = {
        element,
        size,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        state: 'idle',
        nextJumpAt: performance.now() + randomBetween(800, 2600),
        squishTimer: 0,
        squishDuration: randomBetween(120, 220),
        scaleX: 1,
        scaleY: 1,
        targetScaleX: 1,
        targetScaleY: 1,
        shadowPhase: Math.random() * Math.PI * 2,
        zoneIndex: this.pickSpawnZoneIndex(),
        zone: null,
      };
      creature.zone = this.getResolvedZone(creature.zoneIndex);
      const leftLimit = this.getLeftLimit(creature);
      const rightLimit = this.getRightLimit(creature);
      const minX = Math.min(leftLimit, rightLimit);
      const maxX = Math.max(leftLimit, rightLimit);
      creature.x = maxX > minX ? randomBetween(minX, maxX) : minX;
      creature.y = this.getGroundLevel(creature);
      this.creatures.push(creature);
      this.layer.appendChild(element);
      this.updateCreatureTransform(creature);
    }
  }

  /**
   * Resolve the minimum horizontal travel limit for a slime.
   */
  getLeftLimit(creature) {
    const halfWidth = (creature.size || 24) * 0.35;
    const zone = this.getCreatureZone(creature);
    if (zone) {
      return zone.left + halfWidth;
    }
    if (this.terrainBounds.width > 0) {
      return this.terrainBounds.left + halfWidth;
    }
    return halfWidth + 2;
  }

  /**
   * Resolve the maximum horizontal travel limit for a slime.
   */
  getRightLimit(creature) {
    if (!this.bounds.width) {
      return (creature.size || 24) * 0.35 + 2;
    }
    const halfWidth = (creature.size || 24) * 0.35;
    const zone = this.getCreatureZone(creature);
    if (zone) {
      return zone.right - halfWidth;
    }
    if (this.terrainBounds.width > 0) {
      return this.terrainBounds.right - halfWidth;
    }
    return this.bounds.width - halfWidth - 2;
  }

  /**
   * Return the y-coordinate that represents solid ground inside the viewport.
   */
  getGroundLevel(creature) {
    if (!this.bounds.height) {
      return (creature?.size || 24) * 2;
    }
    const padding = 6;
    const zone = this.getCreatureZone(creature);
    if (zone) {
      const limitedGround = this.getTerrainGroundAt(creature?.x ?? zone.left + zone.width / 2);
      if (Number.isFinite(limitedGround)) {
        return clamp(limitedGround, zone.top + padding, zone.bottom);
      }
      return zone.bottom - padding;
    }
    const ground = this.getTerrainGroundAt(creature?.x ?? this.bounds.width / 2);
    if (Number.isFinite(ground)) {
      return ground;
    }
    return this.bounds.height - padding;
  }

  /**
   * Report the interpolated terrain height for a given x coordinate.
   * @param {number} x
   * @returns {number|null}
   */
  getTerrainGroundAt(x) {
    if (!Number.isFinite(x) || !this.terrainProfile || this.terrainBounds.width <= 0) {
      return null;
    }
    const normalizedX = clamp((x - this.terrainBounds.left) / this.terrainBounds.width, 0, 1);
    const samples = this.terrainProfile.samples;
    if (!samples || !samples.length) {
      return null;
    }
    const rawIndex = normalizedX * (samples.length - 1);
    const lowerIndex = Math.floor(rawIndex);
    const upperIndex = Math.min(samples.length - 1, lowerIndex + 1);
    const t = rawIndex - lowerIndex;
    const lower = samples[lowerIndex];
    const upper = samples[upperIndex];
    const sampleValue = lower + (upper - lower) * t;
    if (!Number.isFinite(sampleValue) || !Number.isFinite(this.terrainProfile.height)) {
      return null;
    }
    const normalizedY = sampleValue / this.terrainProfile.height;
    return this.terrainBounds.top + normalizedY * this.terrainBounds.height;
  }

  /**
   * Trigger the pre-jump squish animation before applying velocity.
   */
  beginSquish(creature, now) {
    creature.state = 'squish';
    creature.squishTimer = 0;
    creature.squishDuration = randomBetween(140, 240);
    creature.targetScaleX = 1.18;
    creature.targetScaleY = 0.68;
    creature.nextJumpAt = now + creature.squishDuration;
  }

  /**
   * Apply an impulse that sends the slime arcing upward in a parabola.
   */
  launchCreature(creature) {
    creature.state = 'airborne';
    creature.targetScaleX = 0.92;
    creature.targetScaleY = 1.1;
    // Constrain hops to roughly ten times the slime's own height for a grounded, smaller scale arc.
    const jumpHeight = Math.max(1, creature.size * 10);
    const jumpSpeed = Math.sqrt(2 * this.gravity * jumpHeight);
    const horizontalSpeed = randomBetween(120, 240);
    const direction = Math.random() < 0.5 ? -1 : 1;
    creature.vy = -jumpSpeed;
    creature.vx = horizontalSpeed * direction;
  }

  /**
   * Reset velocities so the slime can prepare for its next jump.
   */
  settleCreature(creature, now) {
    creature.state = 'idle';
    creature.vx = 0;
    creature.vy = 0;
    creature.y = this.getGroundLevel(creature);
    creature.targetScaleX = 1;
    creature.targetScaleY = 1;
    creature.nextJumpAt = now + randomBetween(1200, 3200);
  }

  /**
   * Step the physics simulation and easing values for a single slime.
   */
  updateCreature(creature, deltaSeconds, now) {
    if (!this.bounds.width || !this.bounds.height) {
      return;
    }
    if (creature.state === 'idle') {
      if (now >= creature.nextJumpAt) {
        this.beginSquish(creature, now);
      }
    } else if (creature.state === 'squish') {
      creature.squishTimer += deltaSeconds * 1000;
      if (creature.squishTimer >= creature.squishDuration) {
        this.launchCreature(creature);
      }
    } else if (creature.state === 'airborne') {
      creature.vy += this.gravity * deltaSeconds;
      creature.x += creature.vx * deltaSeconds;
      creature.y += creature.vy * deltaSeconds;

      const leftLimit = this.getLeftLimit(creature);
      const rightLimit = this.getRightLimit(creature);
      const minX = Math.min(leftLimit, rightLimit);
      const maxX = Math.max(leftLimit, rightLimit);
      const ground = this.getGroundLevel(creature);

      if (creature.x <= minX) {
        creature.x = minX;
        creature.vx = Math.abs(creature.vx) * 0.65;
      } else if (creature.x >= maxX) {
        creature.x = maxX;
        creature.vx = -Math.abs(creature.vx) * 0.65;
      }

      const creatureTop = creature.y - creature.size;
      if (creatureTop <= 0 && creature.vy < 0) {
        creature.y = creature.size;
        creature.vy = Math.abs(creature.vy) * 0.45;
      }

      if (creature.y >= ground) {
        creature.y = ground;
        if (Math.abs(creature.vy) > 80) {
          creature.vy = -creature.vy * 0.25;
          creature.vx *= 0.65;
        } else {
          this.settleCreature(creature, now);
        }
      }
    }

    const scaleLerp = clamp(deltaSeconds * 10, 0, 1);
    creature.scaleX += (creature.targetScaleX - creature.scaleX) * scaleLerp;
    creature.scaleY += (creature.targetScaleY - creature.scaleY) * scaleLerp;
    creature.scaleX = clamp(creature.scaleX, 0.7, 1.25);
    creature.scaleY = clamp(creature.scaleY, 0.6, 1.3);

    const shimmer = 0.85 + Math.sin(now / 800 + creature.shadowPhase) * 0.1;
    creature.element.style.setProperty('--delta-slime-glow', shimmer.toFixed(3));

    this.updateCreatureTransform(creature);
  }

  /**
   * Convert the physics state into DOM transforms.
   */
  updateCreatureTransform(creature) {
    const transform = `translate(${creature.x.toFixed(2)}px, ${creature.y.toFixed(2)}px) translate(-50%, -100%) scale(${creature.scaleX.toFixed(3)}, ${creature.scaleY.toFixed(3)})`;
    creature.element.style.transform = transform;
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
    this.creatures.forEach((creature) => this.updateCreature(creature, deltaSeconds, timestamp));
    this.lastTimestamp = timestamp;
    this.animationFrame = requestAnimationFrame(this.handleFrame);
  }

  /**
   * Begin animating the terrarium if it is not already running.
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
   * Halt the animation loop but keep DOM nodes intact.
   */
  stop() {
    this.running = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Create or update the count badge showing number of slimes.
   * Displays "×N" above the creature group.
   */
  updateCountBadge() {
    if (!this.badgeLayer) {
      return;
    }
    
    // Clear existing badge
    this.badgeLayer.innerHTML = '';
    
    // Don't show badge if count is 0
    if (this.creatureCount <= 0) {
      return;
    }
    
    // Create badge element
    const badge = document.createElement('div');
    badge.className = 'fluid-creature-count-badge';
    badge.textContent = `×${this.creatureCount}`;
    badge.style.cssText = `
      position: absolute;
      left: 50%;
      top: 20%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.7);
      color: #fff;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: bold;
      text-align: center;
      white-space: nowrap;
      pointer-events: none;
    `;
    
    this.badgeLayer.appendChild(badge);
  }

  /**
   * Tear down DOM nodes and observers so the layer can be re-created cleanly.
   */
  destroy() {
    this.stop();
    if (this.resizeObserver) {
      try {
        this.resizeObserver.disconnect();
      } catch (error) {
        console.warn('Failed to disconnect fluid terrarium resize observer.', error);
      }
      this.resizeObserver = null;
    }
    if (this.terrainProfileSource) {
      this.terrainProfileSource.removeEventListener('load', this.handleTerrainImageLoad);
    }
    if (this.layer && this.layer.parentNode) {
      this.layer.parentNode.removeChild(this.layer);
    }
    if (this.badgeLayer && this.badgeLayer.parentNode) {
      this.badgeLayer.parentNode.removeChild(this.badgeLayer);
    }
    this.layer = null;
    this.badgeLayer = null;
    this.creatures.length = 0;
  }

  /**
   * Listen for the terrain sprite load event so collisions can match its silhouette.
   * @param {HTMLImageElement|null} element
   */
  observeTerrainElement(element) {
    if (this.terrainProfileSource && this.terrainProfileSource !== element) {
      this.terrainProfileSource.removeEventListener('load', this.handleTerrainImageLoad);
    }

    this.terrainProfileSource = element || null;

    if (!element) {
      return;
    }
    if (element.complete && element.naturalWidth > 0 && element.naturalHeight > 0) {
      this.sampleTerrainProfile();
      this.refreshBounds();
      return;
    }
    element.addEventListener('load', this.handleTerrainImageLoad, { once: true });
  }

  /**
   * Handle the terrain sprite load event.
   */
  handleTerrainImageLoad() {
    this.sampleTerrainProfile();
    this.refreshBounds();
  }

  /**
   * Trace the top contour of the collision silhouette to generate a collision profile.
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
    // Scan from bottom to top to find the ground level, not floating islands
    for (let x = 0; x < canvas.width; x += 1) {
      let sampleY = canvas.height;
      for (let y = canvas.height - 1; y >= 0; y -= 1) {
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
   * Map normalized spawn rectangles onto the rendered terrain bounds.
   */
  resolveSpawnZones() {
    const hasTerrainBounds = this.terrainBounds.width > 0 && this.terrainBounds.height > 0;
    const reference = hasTerrainBounds
      ? this.terrainBounds
      : { left: 0, top: 0, width: this.bounds.width, height: this.bounds.height };

    if (!reference.width || !reference.height) {
      this.resolvedSpawnZones = [];
      return;
    }

    this.resolvedSpawnZones = (this.spawnZones || [])
      .map((zone, index) => {
        if (!zone || !Number.isFinite(zone.x) || !Number.isFinite(zone.y)) {
          return null;
        }
        const normalizedX = clamp(zone.x, 0, 1);
        const normalizedY = clamp(zone.y, 0, 1);
        const normalizedWidth = clamp(zone.width ?? 0, 0, 1 - normalizedX);
        const normalizedHeight = clamp(zone.height ?? 0, 0, 1 - normalizedY);
        if (normalizedWidth <= 0 || normalizedHeight <= 0) {
          return null;
        }
        const left = reference.left + reference.width * normalizedX;
        const top = reference.top + reference.height * normalizedY;
        const width = reference.width * normalizedWidth;
        const height = reference.height * normalizedHeight;
        return {
          index,
          left,
          right: left + width,
          width,
          top,
          bottom: top + height,
          height,
        };
      })
      .filter(Boolean);
  }

  /**
   * Re-anchor creatures to their zones after a resize.
   */
  syncCreatureZones() {
    const padding = 6;
    this.creatures.forEach((creature) => {
      if (typeof creature.zoneIndex === 'number') {
        creature.zone = this.getResolvedZone(creature.zoneIndex);
      }
      const zone = this.getCreatureZone(creature);
      if (zone) {
        const halfWidth = (creature.size || 24) * 0.35;
        const minX = zone.left + halfWidth;
        const maxX = zone.right - halfWidth;
        creature.x = clamp(creature.x, minX, maxX);
        creature.y = clamp(creature.y, zone.top + padding, zone.bottom);
      } else {
        const leftLimit = this.getLeftLimit(creature);
        const rightLimit = this.getRightLimit(creature);
        const minX = Math.min(leftLimit, rightLimit);
        const maxX = Math.max(leftLimit, rightLimit);
        creature.x = clamp(creature.x, minX, maxX);
        creature.y = Math.min(creature.y, this.getGroundLevel(creature));
      }
      this.updateCreatureTransform(creature);
    });
  }

  /**
   * Retrieve the resolved spawn zone for the provided index.
   * @param {number|null|undefined} zoneIndex
   * @returns {Object|null}
   */
  getResolvedZone(zoneIndex) {
    if (!Array.isArray(this.resolvedSpawnZones)) {
      return null;
    }
    if (typeof zoneIndex !== 'number' || zoneIndex < 0 || zoneIndex >= this.resolvedSpawnZones.length) {
      return null;
    }
    return this.resolvedSpawnZones[zoneIndex];
  }

  /**
   * Resolve the active zone for a creature, if one exists.
   * @param {Object} creature
   * @returns {Object|null}
   */
  getCreatureZone(creature) {
    if (creature?.zone) {
      return creature.zone;
    }
    if (typeof creature?.zoneIndex === 'number') {
      return this.getResolvedZone(creature.zoneIndex);
    }
    return null;
  }

  /**
   * Choose a spawn zone index for a new creature.
   * @returns {number|null}
   */
  pickSpawnZoneIndex() {
    if (!Array.isArray(this.resolvedSpawnZones) || this.resolvedSpawnZones.length === 0) {
      return null;
    }
    const zoneIndex = Math.floor(Math.random() * this.resolvedSpawnZones.length);
    return Math.max(0, Math.min(zoneIndex, this.resolvedSpawnZones.length - 1));
  }
}
