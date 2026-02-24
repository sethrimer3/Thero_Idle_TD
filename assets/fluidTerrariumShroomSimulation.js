// Fluid Terrarium Shroom Simulation
// Support classes and constants extracted from FluidTerrariumShrooms.
// Provides TerrainCollider, Spore, BaseShroom, PhiShroom, and PsiShroom.

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
export const PHI_SHROOM_COLORS = {
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
export const PSI_SHROOM_STYLE = {
  primary: '#1a2a5c',
  outline: '#ffffff',
  pulsePink: '#ff66cc',
  pulseGlow: 'rgba(255, 102, 204, 0.9)',
};

// Shroom configuration for growth and leveling
export const SHROOM_CONFIG = {
  phi: {
    maxLevel: 10,
    baseCost: 50,
    costMultiplier: 10,
  },
  psi: {
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
export class TerrainCollider {
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
export class Spore {
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
export class BaseShroom {
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
    this.badgeElement = null;
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
   * Create a level badge that shows above the shroom.
   */
  createBadge() {
    if (typeof document === 'undefined' || this.badgeElement) {
      return;
    }
    const badge = document.createElement('div');
    badge.className = 'fluid-terrarium-shroom-badge';
    badge.style.cssText = `
      position: absolute;
      left: ${this.x.toFixed(1)}px;
      top: ${(this.y - this.size - 12).toFixed(1)}px;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.7);
      color: #fff;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: bold;
      text-align: center;
      white-space: nowrap;
      pointer-events: none;
    `;
    this.updateBadgeText(badge);
    this.badgeElement = badge;
    return badge;
  }

  /**
   * Update the badge text based on current level.
   */
  updateBadgeText(badge = this.badgeElement) {
    if (!badge) {
      return;
    }
    const levelText = this.level >= this.maxLevel ? 'MAX' : `Lv. ${this.level}`;
    badge.textContent = levelText;
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
    
    // Update badge position
    if (this.badgeElement) {
      this.badgeElement.style.left = `${this.x.toFixed(1)}px`;
      this.badgeElement.style.top = `${(this.y - this.size - 12).toFixed(1)}px`;
    }
  }

  destroy() {
    if (this.element?.parentNode) {
      this.element.remove();
    }
    if (this.badgeElement?.parentNode) {
      this.badgeElement.remove();
    }
    this.element = null;
    this.glowElement = null;
    this.badgeElement = null;
    this.dead = true;
  }
}

/**
 * Phi Shroom - Glowing mushroom that flickers gently.
 */
export class PhiShroom extends BaseShroom {
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
    this.createBadge(); // Create level badge
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
export class PsiShroom extends BaseShroom {
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
    this.createBadge(); // Create level badge
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
