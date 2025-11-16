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
 * Lightweight physics simulation that animates Delta grasshopper slimes inside the fluid viewport.
 */
export class FluidTerrariumCreatures {
  constructor(options = {}) {
    this.container = options.container || null;
    this.creatureCount = Number.isFinite(options.creatureCount) ? Math.max(1, Math.round(options.creatureCount)) : 4;
    this.gravity = Number.isFinite(options.gravity) ? options.gravity : 1800; // px/s^2
    this.creatures = [];
    this.layer = null;
    this.bounds = { width: 0, height: 0 };
    this.running = false;
    this.animationFrame = null;
    this.lastTimestamp = null;
    this.resizeObserver = null;
    this.handleFrame = this.handleFrame.bind(this);

    if (this.container) {
      this.initializeLayer();
      this.refreshBounds();
      this.spawnCreatures();
      this.observeContainer();
    }
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
    this.bounds.width = rect.width;
    this.bounds.height = rect.height;
    this.creatures.forEach((creature) => {
      creature.y = Math.min(creature.y, this.getGroundLevel(creature));
      creature.x = clamp(creature.x, this.getLeftLimit(creature), this.getRightLimit(creature));
      this.updateCreatureTransform(creature);
    });
  }

  /**
   * Populate the terrarium with a small cluster of animated Deltas.
   */
  spawnCreatures() {
    if (!this.layer) {
      return;
    }
    for (let index = 0; index < this.creatureCount; index += 1) {
      const size = randomBetween(20, 30);
      const element = document.createElement('div');
      element.className = 'fluid-terrarium-creature';
      element.textContent = 'Δ';
      element.style.fontSize = `${size}px`;
      element.style.backgroundImage = createGradientString();
      const creature = {
        element,
        size,
        x: randomBetween(this.getLeftLimit({ size }), this.getRightLimit({ size })),
        y: this.getGroundLevel({ size }),
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
      };
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
    return this.bounds.width - halfWidth - 2;
  }

  /**
   * Return the y-coordinate that represents solid ground inside the viewport.
   */
  getGroundLevel(creature) {
    if (!this.bounds.height) {
      return (creature.size || 24) * 2;
    }
    const padding = 6;
    return this.bounds.height - padding;
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
    const jumpSpeed = randomBetween(520, 880);
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
      const ground = this.getGroundLevel(creature);

      if (creature.x <= leftLimit) {
        creature.x = leftLimit;
        creature.vx = Math.abs(creature.vx) * 0.65;
      } else if (creature.x >= rightLimit) {
        creature.x = rightLimit;
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
    if (this.layer && this.layer.parentNode) {
      this.layer.parentNode.removeChild(this.layer);
    }
    this.layer = null;
    this.creatures.length = 0;
  }
}
