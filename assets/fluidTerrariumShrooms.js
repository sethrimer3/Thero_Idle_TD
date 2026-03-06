/**
 * Phi and Psi Shrooms for the Bet Spire terrarium.
 * 
 * Support classes (TerrainCollider, Spore, BaseShroom, PhiShroom, PsiShroom)
 * and their constants live in the companion module fluidTerrariumShroomSimulation.js.
 */

// Shroom particle and entity classes extracted to companion module.
import {
  TerrainCollider,
  Spore,
  PhiShroom,
  PsiShroom,
  SHROOM_CONFIG,
} from './fluidTerrariumShroomSimulation.js';

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
      if (shroom.badgeElement) {
        this.layer.appendChild(shroom.badgeElement);
      }
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
      if (shroom.badgeElement) {
        this.layer.appendChild(shroom.badgeElement);
      }
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
   * Get all active shrooms for external systems.
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
