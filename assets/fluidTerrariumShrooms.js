/**
 * Phi and Psi Shrooms for the Bet Spire terrarium.
 * 
 * Phi Shrooms (φ):
 * - Three variants: bright yellow, bright green, bright blue
 * - Emit a soft, flickering glow
 * - Can only be placed inside caves
 * - Generate 10 happiness/second per level (max level 10)
 * 
 * Psi Shrooms (ψ):
 * - Dark blue with thin white outline
 * - Can only be placed inside caves
 * - Quick shrink/stretch vertical animation
 * - Pulse bright pink randomly every 20-60 seconds
 * - When pulsing, emit spores that fly erratically and seek other shrooms
 * - Generate 35 happiness/second per level (max level 5)
 * - Level determines spore count: L1=0, L2=0-1, L3=0-2, L4=0-3, L5=0-4
 */

/**
 * Clamp a value between min and max bounds.
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

// Phi shroom color variants - bright glowing colors
const PHI_SHROOM_COLORS = {
  yellow: {
    id: 'phi-yellow',
    primary: '#ffe066',
    glow: 'rgba(255, 224, 102, 0.8)',
    glowIntense: 'rgba(255, 240, 150, 1)',
  },
  green: {
    id: 'phi-green',
    primary: '#66ff99',
    glow: 'rgba(102, 255, 153, 0.8)',
    glowIntense: 'rgba(150, 255, 180, 1)',
  },
  blue: {
    id: 'phi-blue',
    primary: '#66b3ff',
    glow: 'rgba(102, 179, 255, 0.8)',
    glowIntense: 'rgba(150, 200, 255, 1)',
  },
};

// Psi shroom styling
const PSI_SHROOM_STYLE = {
  primary: '#1a2a5c',
  outline: '#ffffff',
  pulsePink: '#ff66cc',
  pulseGlow: 'rgba(255, 102, 204, 0.9)',
};

// Shroom configuration for happiness generation and leveling
const SHROOM_CONFIG = {
  phi: {
    happinessPerSecond: 10,
    maxLevel: 10,
    baseCost: 50,
    costMultiplier: 10,
  },
  psi: {
    happinessPerSecond: 35,
    maxLevel: 5,
    baseCost: 200,
    costMultiplier: 10,
    pulseIntervalMin: 20000, // 20 seconds
    pulseIntervalMax: 60000, // 60 seconds
    sporeLifeMin: 10000, // 10 seconds
    sporeLifeMax: 20000, // 20 seconds
    // Spore counts by level (0-indexed): level 1 = 0, level 2 = 0-1, etc.
    sporeCountByLevel: [0, 1, 2, 3, 4],
  },
};

/**
 * Terrain collision helper to check if a point is inside solid terrain.
 */
class TerrainCollider {
  constructor(collisionElement, containerBounds, terrainBounds) {
    this.collisionElement = collisionElement;
    this.containerBounds = containerBounds;
    this.terrainBounds = terrainBounds;
    this.samples = null;
    this.sampleWidth = 0;
    this.sampleHeight = 0;
  }

  /**
   * Sample the terrain collision map to build a collision grid.
   */
  buildCollisionMap() {
    const source = this.collisionElement;
    if (!source?.naturalWidth || !source?.naturalHeight || typeof document === 'undefined') {
      return;
    }

    const width = Math.min(256, Math.max(48, Math.round(source.naturalWidth / 4)));
    const aspectRatio = source.naturalHeight / source.naturalWidth;
    const height = Math.max(1, Math.round(width * aspectRatio));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    
    // Build a boolean array where true = solid (alpha > threshold)
    const samples = new Uint8Array(width * height);
    const alphaThreshold = 8;
    for (let i = 0; i < samples.length; i++) {
      samples[i] = imageData.data[i * 4 + 3] > alphaThreshold ? 1 : 0;
    }

    this.samples = samples;
    this.sampleWidth = width;
    this.sampleHeight = height;
  }

  /**
   * Check if a world-space point collides with terrain.
   * @param {number} x - X position in container space
   * @param {number} y - Y position in container space
   * @returns {boolean}
   */
  isPointSolid(x, y) {
    if (!this.samples || !this.terrainBounds.width || !this.terrainBounds.height) {
      return false;
    }

    // Convert container coords to normalized terrain coords
    const normalizedX = (x - this.terrainBounds.left) / this.terrainBounds.width;
    const normalizedY = (y - this.terrainBounds.top) / this.terrainBounds.height;

    if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) {
      return false;
    }

    const sampleX = Math.floor(normalizedX * (this.sampleWidth - 1));
    const sampleY = Math.floor(normalizedY * (this.sampleHeight - 1));
    const index = sampleY * this.sampleWidth + sampleX;

    return this.samples[index] === 1;
  }

  /**
   * Update bounds when container resizes.
   */
  updateBounds(containerBounds, terrainBounds) {
    this.containerBounds = containerBounds;
    this.terrainBounds = terrainBounds;
  }
}

/**
 * Spore particle that flies erratically and seeks shrooms.
 */
class Spore {
  constructor(x, y, targetShrooms, terrainCollider, terrainBounds) {
    this.x = x;
    this.y = y;
    this.vx = randomBetween(-30, 30);
    this.vy = randomBetween(-80, -40); // Start moving upward
    this.targetShrooms = targetShrooms;
    this.terrainCollider = terrainCollider;
    this.terrainBounds = terrainBounds;
    this.life = randomBetween(SHROOM_CONFIG.psi.sporeLifeMin, SHROOM_CONFIG.psi.sporeLifeMax);
    this.age = 0;
    this.dead = false;
    this.element = null;
    this.size = randomBetween(2, 4);
    this.wanderPhase = Math.random() * Math.PI * 2;
    this.createSporeElement();
  }

  createSporeElement() {
    if (typeof document === 'undefined') {
      return;
    }
    const el = document.createElement('div');
    el.className = 'fluid-terrarium-spore';
    el.style.width = `${this.size}px`;
    el.style.height = `${this.size}px`;
    this.element = el;
    this.updateTransform();
  }

  updateTransform() {
    if (!this.element) {
      return;
    }
    const opacity = clamp(1 - this.age / this.life, 0, 1);
    this.element.style.transform = `translate(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px)`;
    this.element.style.opacity = opacity.toFixed(2);
  }

  /**
   * Update spore physics and check for collisions.
   * @param {number} deltaMs
   * @returns {{hitShroom: Object|null}} - The shroom that was hit, if any
   */
  update(deltaMs) {
    if (this.dead) {
      return { hitShroom: null };
    }

    const dt = deltaMs / 1000;
    this.age += deltaMs;

    if (this.age >= this.life) {
      this.dead = true;
      return { hitShroom: null };
    }

    // Erratic wandering motion
    this.wanderPhase += dt * randomBetween(2, 5);
    const wanderX = Math.sin(this.wanderPhase) * 20;
    const wanderY = Math.cos(this.wanderPhase * 1.3) * 15;

    // Find nearest shroom to seek
    let nearestShroom = null;
    let nearestDist = Infinity;
    for (const shroom of this.targetShrooms) {
      if (!shroom || shroom.dead) continue;
      const dx = shroom.x - this.x;
      const dy = shroom.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestShroom = shroom;
      }
    }

    // Apply seeking force toward nearest shroom
    let seekX = 0;
    let seekY = 0;
    if (nearestShroom && nearestDist > 0) {
      const dx = nearestShroom.x - this.x;
      const dy = nearestShroom.y - this.y;
      const seekStrength = 40;
      seekX = (dx / nearestDist) * seekStrength;
      seekY = (dy / nearestDist) * seekStrength;
    }

    // Apply velocity with wandering and seeking
    this.vx += (wanderX + seekX) * dt;
    this.vy += (wanderY + seekY) * dt;

    // Add some gravity
    this.vy += 10 * dt;

    // Damping
    this.vx *= 0.98;
    this.vy *= 0.98;

    // Clamp velocity
    const maxSpeed = 100;
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }

    // Predict next position
    const nextX = this.x + this.vx * dt;
    const nextY = this.y + this.vy * dt;

    // Check terrain collision
    if (this.terrainCollider && this.terrainCollider.isPointSolid(nextX, nextY)) {
      // Bounce off terrain
      this.vx *= -0.5;
      this.vy *= -0.5;
      // Add some randomness to bounce
      this.vx += randomBetween(-20, 20);
      this.vy += randomBetween(-20, 20);
    } else {
      this.x = nextX;
      this.y = nextY;
    }

    // Check bounds
    if (this.terrainBounds) {
      const padding = 10;
      if (this.x < this.terrainBounds.left + padding) {
        this.x = this.terrainBounds.left + padding;
        this.vx = Math.abs(this.vx) * 0.5;
      }
      if (this.x > this.terrainBounds.right - padding) {
        this.x = this.terrainBounds.right - padding;
        this.vx = -Math.abs(this.vx) * 0.5;
      }
      if (this.y < this.terrainBounds.top + padding) {
        this.y = this.terrainBounds.top + padding;
        this.vy = Math.abs(this.vy) * 0.5;
      }
      if (this.y > this.terrainBounds.bottom - padding) {
        this.y = this.terrainBounds.bottom - padding;
        this.vy = -Math.abs(this.vy) * 0.5;
      }
    }

    // Check collision with shrooms
    let hitShroom = null;
    for (const shroom of this.targetShrooms) {
      if (!shroom || shroom.dead) continue;
      const dx = shroom.x - this.x;
      const dy = shroom.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const hitRadius = shroom.size * 0.6;
      if (dist < hitRadius) {
        hitShroom = shroom;
        this.dead = true;
        break;
      }
    }

    this.updateTransform();
    return { hitShroom };
  }

  destroy() {
    if (this.element?.parentNode) {
      this.element.remove();
    }
    this.element = null;
    this.dead = true;
  }
}

/**
 * Base shroom class with shared functionality.
 */
class BaseShroom {
  constructor(options = {}) {
    this.id = options.id || `shroom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.type = options.type || 'unknown';
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.size = options.size || 16;
    this.level = Math.max(1, Math.min(options.level || 1, options.maxLevel || 10));
    this.maxLevel = options.maxLevel || 10;
    this.element = null;
    this.glowElement = null;
    this.dead = false;
    
    // Glow boost from spore hits
    this.glowBoost = 0;
    this.glowBoostDecay = 0.0005; // Decay rate per ms
    
    // Surface orientation (angle in radians, 0 = upright)
    this.surfaceAngle = options.surfaceAngle || 0;
    
    this.flickerPhase = Math.random() * Math.PI * 2;
    this.flickerSpeed = randomBetween(1.5, 3);
  }

  /**
   * Apply a glow boost from a spore hit.
   */
  applySporeHit() {
    this.glowBoost = 1;
  }

  /**
   * Update the shroom state.
   * @param {number} deltaMs
   */
  update(deltaMs) {
    // Decay glow boost over time
    if (this.glowBoost > 0) {
      this.glowBoost = Math.max(0, this.glowBoost - this.glowBoostDecay * deltaMs);
    }
    this.flickerPhase += (deltaMs / 1000) * this.flickerSpeed;
  }

  /**
   * Update the DOM element transform.
   */
  updateTransform() {
    if (!this.element) {
      return;
    }
    const rotation = (this.surfaceAngle * 180) / Math.PI;
    this.element.style.transform = `translate(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px) translate(-50%, -100%) rotate(${rotation.toFixed(1)}deg)`;
  }

  destroy() {
    if (this.element?.parentNode) {
      this.element.remove();
    }
    this.element = null;
    this.glowElement = null;
    this.dead = true;
  }
}

/**
 * Phi Shroom - Glowing mushroom that flickers gently.
 */
class PhiShroom extends BaseShroom {
  constructor(options = {}) {
    super({
      ...options,
      type: 'phi',
      maxLevel: SHROOM_CONFIG.phi.maxLevel,
    });
    this.colorVariant = options.colorVariant || 'yellow';
    this.colors = PHI_SHROOM_COLORS[this.colorVariant] || PHI_SHROOM_COLORS.yellow;
    this.createElement();
  }

  createElement() {
    if (typeof document === 'undefined') {
      return;
    }

    const el = document.createElement('div');
    el.className = 'fluid-terrarium-shroom fluid-terrarium-shroom--phi';
    el.dataset.color = this.colorVariant;
    el.dataset.level = this.level;
    el.textContent = 'φ';
    el.style.fontSize = `${this.size}px`;
    el.style.color = this.colors.primary;
    
    this.element = el;
    this.updateTransform();
    this.updateGlow();
  }

  update(deltaMs) {
    super.update(deltaMs);
    this.updateGlow();
    this.updateTransform();
  }

  updateGlow() {
    if (!this.element) {
      return;
    }
    
    // Base flicker intensity varies with level
    const baseIntensity = 0.5 + (this.level / this.maxLevel) * 0.3;
    const flickerAmount = Math.sin(this.flickerPhase) * 0.15;
    const boostAmount = this.glowBoost * 0.5;
    const intensity = clamp(baseIntensity + flickerAmount + boostAmount, 0.3, 1);
    
    const glowSize = 8 + this.level * 2 + this.glowBoost * 10;
    const glowColor = this.glowBoost > 0.5 ? this.colors.glowIntense : this.colors.glow;
    
    this.element.style.filter = `drop-shadow(0 0 ${glowSize}px ${glowColor})`;
    this.element.style.opacity = intensity.toFixed(2);
  }
}

/**
 * Psi Shroom - Dark shroom that pulses pink and spawns spores.
 */
class PsiShroom extends BaseShroom {
  constructor(options = {}) {
    super({
      ...options,
      type: 'psi',
      maxLevel: SHROOM_CONFIG.psi.maxLevel,
    });
    this.colors = PSI_SHROOM_STYLE;
    
    // Animation state
    this.stretchPhase = Math.random() * Math.PI * 2;
    this.stretchSpeed = randomBetween(3, 5);
    this.scaleY = 1;
    
    // Pulse timing
    this.timeSinceLastPulse = randomBetween(0, SHROOM_CONFIG.psi.pulseIntervalMin);
    this.nextPulseInterval = randomBetween(SHROOM_CONFIG.psi.pulseIntervalMin, SHROOM_CONFIG.psi.pulseIntervalMax);
    this.isPulsing = false;
    this.pulseProgress = 0;
    this.pulseDuration = 800; // ms
    
    // Callback for spawning spores
    this.onPulse = options.onPulse || null;
    
    this.createElement();
  }

  createElement() {
    if (typeof document === 'undefined') {
      return;
    }

    const el = document.createElement('div');
    el.className = 'fluid-terrarium-shroom fluid-terrarium-shroom--psi';
    el.dataset.level = this.level;
    el.textContent = 'ψ';
    el.style.fontSize = `${this.size}px`;
    el.style.color = this.colors.primary;
    
    this.element = el;
    this.updateTransform();
    this.updateVisuals();
  }

  update(deltaMs) {
    super.update(deltaMs);
    
    // Update stretch animation
    this.stretchPhase += (deltaMs / 1000) * this.stretchSpeed;
    this.scaleY = 1 + Math.sin(this.stretchPhase) * 0.15;
    
    // Check for pulse trigger
    this.timeSinceLastPulse += deltaMs;
    if (!this.isPulsing && this.timeSinceLastPulse >= this.nextPulseInterval) {
      this.startPulse();
    }
    
    // Update pulse animation
    if (this.isPulsing) {
      this.pulseProgress += deltaMs / this.pulseDuration;
      if (this.pulseProgress >= 1) {
        this.endPulse();
      }
    }
    
    this.updateVisuals();
    this.updateTransform();
  }

  startPulse() {
    this.isPulsing = true;
    this.pulseProgress = 0;
    
    // Spawn spores based on level
    if (this.onPulse && this.level > 0) {
      const maxSpores = SHROOM_CONFIG.psi.sporeCountByLevel[this.level - 1] || 0;
      const sporeCount = Math.floor(Math.random() * (maxSpores + 1));
      if (sporeCount > 0) {
        this.onPulse(this, sporeCount);
      }
    }
  }

  endPulse() {
    this.isPulsing = false;
    this.pulseProgress = 0;
    this.timeSinceLastPulse = 0;
    this.nextPulseInterval = randomBetween(SHROOM_CONFIG.psi.pulseIntervalMin, SHROOM_CONFIG.psi.pulseIntervalMax);
  }

  updateVisuals() {
    if (!this.element) {
      return;
    }
    
    // Calculate pulse intensity
    let pulseIntensity = 0;
    if (this.isPulsing) {
      // Quick rise, slow fall
      if (this.pulseProgress < 0.2) {
        pulseIntensity = this.pulseProgress / 0.2;
      } else {
        pulseIntensity = 1 - ((this.pulseProgress - 0.2) / 0.8);
      }
      pulseIntensity = clamp(pulseIntensity, 0, 1);
    }
    
    // Apply level-based pulse brightness
    const levelBrightness = 0.5 + (this.level / this.maxLevel) * 0.5;
    pulseIntensity *= levelBrightness;
    
    // Calculate color blend
    const color = this.isPulsing || this.glowBoost > 0
      ? `rgb(${Math.round(26 + (255 - 26) * Math.max(pulseIntensity, this.glowBoost))}, ${Math.round(42 + (102 - 42) * Math.max(pulseIntensity, this.glowBoost))}, ${Math.round(92 + (204 - 92) * Math.max(pulseIntensity, this.glowBoost))})`
      : this.colors.primary;
    
    this.element.style.color = color;
    
    // Apply glow
    const glowIntensity = Math.max(pulseIntensity, this.glowBoost);
    if (glowIntensity > 0.1) {
      const glowSize = 5 + glowIntensity * 15;
      this.element.style.filter = `drop-shadow(0 0 ${glowSize}px ${this.colors.pulseGlow})`;
    } else {
      this.element.style.filter = 'none';
    }
  }

  updateTransform() {
    if (!this.element) {
      return;
    }
    const rotation = (this.surfaceAngle * 180) / Math.PI;
    this.element.style.transform = `translate(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px) translate(-50%, -100%) rotate(${rotation.toFixed(1)}deg) scaleY(${this.scaleY.toFixed(3)})`;
  }
}

/**
 * Main controller for the terrarium shroom system.
 */
export class FluidTerrariumShrooms {
  constructor(options = {}) {
    this.container = options.container || null;
    this.terrainElement = options.terrainElement || null;
    this.terrainCollisionElement = options.terrainCollisionElement || null;
    this.spawnZones = Array.isArray(options.spawnZones) ? options.spawnZones : [];
    
    this.shrooms = [];
    this.spores = [];
    this.layer = null;
    this.sporeLayer = null;
    
    this.bounds = { width: 0, height: 0 };
    this.terrainBounds = { left: 0, right: 0, width: 0, top: 0, bottom: 0, height: 0 };
    this.resolvedSpawnZones = [];
    this.terrainCollider = null;
    
    this.running = false;
    this.animationFrame = null;
    this.lastTimestamp = null;
    this.resizeObserver = null;
    
    // State callbacks
    this.onStateChange = typeof options.onStateChange === 'function' ? options.onStateChange : null;
    
    // Shroom state from persistence
    this.shroomState = options.state?.shrooms || {};
    
    this.handleFrame = this.handleFrame.bind(this);
    this.handlePsiPulse = this.handlePsiPulse.bind(this);
    
    if (this.container) {
      this.initializeLayer();
      this.refreshBounds();
      this.initializeTerrainCollider();
      this.observeContainer();
    }
  }

  /**
   * Initialize the overlay layers for shrooms and spores.
   */
  initializeLayer() {
    if (!this.container || typeof document === 'undefined') {
      return;
    }

    const layer = document.createElement('div');
    layer.className = 'fluid-terrarium-shroom-layer';
    this.layer = layer;
    this.container.appendChild(layer);

    const sporeLayer = document.createElement('div');
    sporeLayer.className = 'fluid-terrarium-spore-layer';
    this.sporeLayer = sporeLayer;
    this.container.appendChild(sporeLayer);
  }

  /**
   * Set up the terrain collision detection system.
   */
  initializeTerrainCollider() {
    const collisionSource = this.terrainCollisionElement || this.terrainElement;
    if (!collisionSource) {
      return;
    }

    this.terrainCollider = new TerrainCollider(collisionSource, this.bounds, this.terrainBounds);
    
    const tryBuildMap = () => {
      if (collisionSource.complete && collisionSource.naturalWidth > 0) {
        this.terrainCollider.buildCollisionMap();
      }
    };

    if (collisionSource.complete) {
      tryBuildMap();
    } else {
      collisionSource.addEventListener('load', tryBuildMap, { once: true });
    }
  }

  /**
   * Listen for container resizes.
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
   * Update cached bounds when the container resizes.
   */
  refreshBounds() {
    if (!this.container) {
      return;
    }
    const rect = this.container.getBoundingClientRect();
    this.bounds.width = this.container.clientWidth || rect.width;
    this.bounds.height = this.container.clientHeight || rect.height;

    const terrainElement = this.terrainElement || this.terrainCollisionElement;
    if (terrainElement) {
      const terrainRect = terrainElement.getBoundingClientRect();
      this.terrainBounds = {
        left: terrainRect.left - rect.left,
        right: terrainRect.right - rect.left,
        width: terrainRect.width,
        top: terrainRect.top - rect.top,
        bottom: terrainRect.bottom - rect.top,
        height: terrainRect.height,
      };
    }

    if (this.terrainCollider) {
      this.terrainCollider.updateBounds(this.bounds, this.terrainBounds);
    }

    this.resolveSpawnZones();
    this.syncShroomPositions();
  }

  /**
   * Map normalized spawn zones to pixel coordinates.
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
   * Reposition existing shrooms after a resize.
   */
  syncShroomPositions() {
    // For now, shrooms keep their relative positions
    // This can be enhanced to recalculate positions based on normalized coordinates
    this.shrooms.forEach((shroom) => {
      shroom.updateTransform();
    });
  }

  /**
   * Add a Phi shroom to the terrarium.
   * @param {Object} options
   * @returns {PhiShroom}
   */
  addPhiShroom(options = {}) {
    const zone = this.pickSpawnZone();
    if (!zone) {
      console.warn('No valid spawn zone for Phi shroom');
      return null;
    }

    const x = zone.left + Math.random() * zone.width;
    const y = zone.top + Math.random() * zone.height;

    const shroom = new PhiShroom({
      ...options,
      x,
      y,
      size: randomBetween(12, 18),
      surfaceAngle: randomBetween(-0.2, 0.2),
    });

    this.shrooms.push(shroom);
    if (this.layer && shroom.element) {
      this.layer.appendChild(shroom.element);
    }

    this.emitStateChange();
    return shroom;
  }

  /**
   * Add a Psi shroom to the terrarium.
   * @param {Object} options
   * @returns {PsiShroom}
   */
  addPsiShroom(options = {}) {
    const zone = this.pickSpawnZone();
    if (!zone) {
      console.warn('No valid spawn zone for Psi shroom');
      return null;
    }

    const x = zone.left + Math.random() * zone.width;
    const y = zone.top + Math.random() * zone.height;

    const shroom = new PsiShroom({
      ...options,
      x,
      y,
      size: randomBetween(14, 20),
      surfaceAngle: randomBetween(-0.2, 0.2),
      onPulse: this.handlePsiPulse,
    });

    this.shrooms.push(shroom);
    if (this.layer && shroom.element) {
      this.layer.appendChild(shroom.element);
    }

    this.emitStateChange();
    return shroom;
  }

  /**
   * Select a random spawn zone.
   */
  pickSpawnZone() {
    if (!this.resolvedSpawnZones.length) {
      return null;
    }
    return this.resolvedSpawnZones[Math.floor(Math.random() * this.resolvedSpawnZones.length)];
  }

  /**
   * Handle a Psi shroom pulse by spawning spores.
   * @param {PsiShroom} psiShroom
   * @param {number} count
   */
  handlePsiPulse(psiShroom, count) {
    for (let i = 0; i < count; i++) {
      const spore = new Spore(
        psiShroom.x + randomBetween(-5, 5),
        psiShroom.y - psiShroom.size * 0.5,
        this.shrooms,
        this.terrainCollider,
        this.terrainBounds
      );
      this.spores.push(spore);
      if (this.sporeLayer && spore.element) {
        this.sporeLayer.appendChild(spore.element);
      }
    }
  }

  /**
   * Get all shrooms for happiness calculation.
   */
  getShrooms() {
    return this.shrooms.filter((s) => !s.dead);
  }

  /**
   * Get phi shrooms count by color.
   */
  getPhiShroomsByColor() {
    const byColor = { yellow: [], green: [], blue: [] };
    for (const shroom of this.shrooms) {
      if (shroom.type === 'phi' && !shroom.dead) {
        byColor[shroom.colorVariant]?.push(shroom);
      }
    }
    return byColor;
  }

  /**
   * Get total happiness generation rate per second.
   */
  getTotalHappinessPerSecond() {
    let total = 0;
    for (const shroom of this.shrooms) {
      if (shroom.dead) continue;
      if (shroom.type === 'phi') {
        total += SHROOM_CONFIG.phi.happinessPerSecond * shroom.level;
      } else if (shroom.type === 'psi') {
        total += SHROOM_CONFIG.psi.happinessPerSecond * shroom.level;
      }
    }
    return total;
  }

  /**
   * Emit state change for persistence.
   */
  emitStateChange() {
    if (typeof this.onStateChange !== 'function') {
      return;
    }
    const state = {
      shrooms: this.shrooms.map((s) => ({
        id: s.id,
        type: s.type,
        level: s.level,
        colorVariant: s.colorVariant,
        x: s.x,
        y: s.y,
      })),
    };
    this.onStateChange(state);
  }

  /**
   * Main animation loop.
   * @param {number} timestamp
   */
  handleFrame(timestamp) {
    if (!this.running) {
      return;
    }
    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp;
    }
    const deltaMs = Math.min(100, timestamp - this.lastTimestamp);
    this.lastTimestamp = timestamp;

    // Update all shrooms
    for (const shroom of this.shrooms) {
      if (!shroom.dead) {
        shroom.update(deltaMs);
      }
    }

    // Update all spores
    for (let i = this.spores.length - 1; i >= 0; i--) {
      const spore = this.spores[i];
      const result = spore.update(deltaMs);
      
      // If spore hit a shroom, trigger glow boost
      if (result.hitShroom) {
        result.hitShroom.applySporeHit();
      }
      
      // Remove dead spores
      if (spore.dead) {
        spore.destroy();
        this.spores.splice(i, 1);
      }
    }

    this.animationFrame = requestAnimationFrame(this.handleFrame);
  }

  /**
   * Start the animation loop.
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
   * Clean up all resources.
   */
  destroy() {
    this.stop();
    
    if (this.resizeObserver) {
      try {
        this.resizeObserver.disconnect();
      } catch (error) {
        console.warn('Failed to disconnect shroom resize observer.', error);
      }
      this.resizeObserver = null;
    }

    // Clean up spores
    for (const spore of this.spores) {
      spore.destroy();
    }
    this.spores = [];

    // Clean up shrooms
    for (const shroom of this.shrooms) {
      shroom.destroy();
    }
    this.shrooms = [];

    if (this.layer?.parentNode) {
      this.layer.remove();
    }
    if (this.sporeLayer?.parentNode) {
      this.sporeLayer.remove();
    }
    this.layer = null;
    this.sporeLayer = null;
  }
}

// Export configuration for store integration
export const SHROOM_STORE_ITEMS = [
  {
    id: 'bet-store-phi-yellow',
    label: 'Yellow Φ Shroom',
    description: 'A softly glowing golden mushroom. Generates 10 happiness/sec per level.',
    icon: 'φ',
    type: 'phi',
    colorVariant: 'yellow',
    cost: SHROOM_CONFIG.phi.baseCost,
    costMultiplier: SHROOM_CONFIG.phi.costMultiplier,
    maxLevel: SHROOM_CONFIG.phi.maxLevel,
    happinessPerLevel: SHROOM_CONFIG.phi.happinessPerSecond,
    caveOnly: true,
  },
  {
    id: 'bet-store-phi-green',
    label: 'Green Φ Shroom',
    description: 'A verdant glowing mushroom. Generates 10 happiness/sec per level.',
    icon: 'φ',
    type: 'phi',
    colorVariant: 'green',
    cost: SHROOM_CONFIG.phi.baseCost,
    costMultiplier: SHROOM_CONFIG.phi.costMultiplier,
    maxLevel: SHROOM_CONFIG.phi.maxLevel,
    happinessPerLevel: SHROOM_CONFIG.phi.happinessPerSecond,
    caveOnly: true,
  },
  {
    id: 'bet-store-phi-blue',
    label: 'Blue Φ Shroom',
    description: 'A sapphire glowing mushroom. Generates 10 happiness/sec per level.',
    icon: 'φ',
    type: 'phi',
    colorVariant: 'blue',
    cost: SHROOM_CONFIG.phi.baseCost,
    costMultiplier: SHROOM_CONFIG.phi.costMultiplier,
    maxLevel: SHROOM_CONFIG.phi.maxLevel,
    happinessPerLevel: SHROOM_CONFIG.phi.happinessPerSecond,
    caveOnly: true,
  },
  {
    id: 'bet-store-psi-1',
    label: 'Ψ Shroom',
    description: 'A mysterious dark mushroom that pulses pink and releases spores. Generates 35 happiness/sec per level.',
    icon: 'ψ',
    type: 'psi',
    cost: SHROOM_CONFIG.psi.baseCost,
    costMultiplier: SHROOM_CONFIG.psi.costMultiplier,
    maxLevel: SHROOM_CONFIG.psi.maxLevel,
    happinessPerLevel: SHROOM_CONFIG.psi.happinessPerSecond,
    caveOnly: true,
  },
  {
    id: 'bet-store-psi-2',
    label: 'Ψ Shroom',
    description: 'A mysterious dark mushroom that pulses pink and releases spores. Generates 35 happiness/sec per level.',
    icon: 'ψ',
    type: 'psi',
    cost: SHROOM_CONFIG.psi.baseCost,
    costMultiplier: SHROOM_CONFIG.psi.costMultiplier,
    maxLevel: SHROOM_CONFIG.psi.maxLevel,
    happinessPerLevel: SHROOM_CONFIG.psi.happinessPerSecond,
    caveOnly: true,
  },
];

// Export configuration constants
export { SHROOM_CONFIG, PHI_SHROOM_COLORS, PSI_SHROOM_STYLE };
