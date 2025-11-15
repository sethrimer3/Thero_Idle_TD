import { samplePaletteGradient } from '../../colorSchemeUtils.js';

/**
 * Compute a developer crystal's render radius relative to the active canvas bounds.
 * @this {SimplePlayfield}
 * @param {object} crystal
 * @returns {number}
 */
export function getCrystalRadius(crystal) {
  if (!crystal) {
    return 0;
  }
  const minDimension = Math.min(this.renderWidth || 0, this.renderHeight || 0) || 0;
  const baseRadius = minDimension ? minDimension * 0.08 : 0;
  return Math.max(32, baseRadius);
}

/**
 * Translate a normalized developer crystal position into canvas coordinates.
 * @this {SimplePlayfield}
 * @param {object} crystal
 * @returns {{x:number,y:number}|null}
 */
export function getCrystalPosition(crystal) {
  if (!crystal || !crystal.normalized) {
    return null;
  }
  return this.getCanvasPosition(crystal.normalized);
}

/**
 * Spawn a developer crystal for sandbox testing at the supplied normalized coordinates.
 * @this {SimplePlayfield}
 * @param {{x:number,y:number}} normalized
 * @returns {boolean}
 */
export function addDeveloperCrystal(normalized) {
  const clamped = this.clampNormalized(normalized);
  if (!clamped) {
    return false;
  }
  const position = this.getCanvasPosition(clamped);
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return false;
  }
  this.crystalIdCounter += 1;
  const id = `developer-crystal-${this.crystalIdCounter}`;
  const paletteRatio = Math.random();
  const outline = Array.from({ length: 7 }, () => 0.72 + Math.random() * 0.28);
  const integrity = 900;
  const crystal = {
    id,
    normalized: clamped,
    paletteRatio,
    outline,
    fractures: [],
    integrity,
    maxIntegrity: integrity,
    orientation: Math.random() * Math.PI * 2,
  };
  this.developerCrystals.push(crystal);
  if (this.messageEl) {
    this.messageEl.textContent = 'Developer crystal anchored—towers can now chip through it.';
  }
  this.draw();
  return true;
}

/**
 * Remove all developer crystals (and shards) from the battlefield.
 * @this {SimplePlayfield}
 * @param {{silent?:boolean}} options
 * @returns {number}
 */
export function clearDeveloperCrystals(options = {}) {
  const { silent = true } = options;
  const removed = this.developerCrystals.length;
  if (!removed && !this.crystalShards.length) {
    return 0;
  }
  this.developerCrystals = [];
  this.crystalShards = [];
  this.focusedCrystalId = null;
  if (!silent && this.messageEl) {
    this.messageEl.textContent = removed > 0
      ? 'Developer crystals cleared from the battlefield.'
      : 'No developer crystals to clear.';
  }
  this.draw();
  return removed;
}

/**
 * Retrieve the currently focused developer crystal, pruning stale selections.
 * @this {SimplePlayfield}
 * @returns {object|null}
 */
export function getFocusedCrystal() {
  if (!this.focusedCrystalId) {
    return null;
  }
  const crystal = this.developerCrystals.find((entry) => entry?.id === this.focusedCrystalId) || null;
  if (!crystal) {
    this.focusedCrystalId = null;
  }
  return crystal;
}

/**
 * Focus a specific developer crystal so towers prioritize it.
 * @this {SimplePlayfield}
 * @param {object|null} crystal
 * @param {{silent?:boolean}} options
 */
export function setFocusedCrystal(crystal, options = {}) {
  if (!crystal) {
    this.clearFocusedCrystal(options);
    return;
  }
  const { silent = false } = options;
  this.focusedCrystalId = crystal.id;
  if (!silent && this.messageEl) {
    this.messageEl.textContent = 'All towers focusing on the developer crystal.';
  }
}

/**
 * Clear the active developer crystal focus target.
 * @this {SimplePlayfield}
 * @param {{silent?:boolean}} options
 * @returns {boolean}
 */
export function clearFocusedCrystal(options = {}) {
  const { silent = false } = options;
  if (!this.focusedCrystalId) {
    return false;
  }
  this.focusedCrystalId = null;
  if (!silent && this.messageEl) {
    this.messageEl.textContent = 'Crystal focus cleared—towers resume optimal targeting.';
  }
  return true;
}

/**
 * Toggle whether a developer crystal is focused.
 * @this {SimplePlayfield}
 * @param {object|null} crystal
 */
export function toggleCrystalFocus(crystal) {
  if (!crystal) {
    this.clearFocusedCrystal();
    return;
  }
  if (this.focusedCrystalId === crystal.id) {
    this.clearFocusedCrystal();
  } else {
    this.setFocusedCrystal(crystal);
  }
}

/**
 * Locate a developer crystal under the supplied canvas-space position.
 * @this {SimplePlayfield}
 * @param {{x:number,y:number}} position
 * @returns {object|null}
 */
export function findCrystalAt(position) {
  if (!position) {
    return null;
  }
  for (let index = this.developerCrystals.length - 1; index >= 0; index -= 1) {
    const crystal = this.developerCrystals[index];
    const center = this.getCrystalPosition(crystal);
    const radius = this.getCrystalRadius(crystal);
    if (!center || radius <= 0) {
      continue;
    }
    const distance = Math.hypot(position.x - center.x, position.y - center.y);
    if (distance <= radius * 0.95) {
      return crystal;
    }
  }
  return null;
}

/**
 * Create a jagged fracture along the crystal outline to visualize chip damage.
 * @this {SimplePlayfield}
 * @param {object} crystal
 * @param {{angle?:number}} options
 */
export function createCrystalFracture(crystal, options = {}) {
  if (!crystal) {
    return;
  }
  if (!Array.isArray(crystal.fractures)) {
    crystal.fractures = [];
  }
  const maxFractures = 18;
  if (crystal.fractures.length >= maxFractures) {
    return;
  }
  const angle = Number.isFinite(options.angle) ? options.angle : Math.random() * Math.PI * 2;
  const width = 0.35 + Math.random() * 0.55;
  const depth = 0.25 + Math.random() * 0.45;
  const segments = 5;
  const jagged = Array.from({ length: segments + 1 }, () => 0.4 + Math.random() * 0.6);
  const fracture = {
    id: `${crystal.id}-fracture-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    angle,
    width,
    depth,
    progress: 0,
    jagged,
  };
  crystal.fractures.push(fracture);
}

/**
 * Emit shard particles when a developer crystal takes damage.
 * @this {SimplePlayfield}
 * @param {{x:number,y:number}} origin
 * @param {number} baseRadius
 * @param {{intensity?:number,paletteRatio?:number}} options
 */
export function spawnCrystalShards(origin, baseRadius, options = {}) {
  if (!origin) {
    return;
  }
  const intensity = Number.isFinite(options.intensity) ? Math.max(0.2, options.intensity) : 0.4;
  const count = Math.max(4, Math.round(intensity * 6));
  const palette = samplePaletteGradient(options.paletteRatio ?? 0.5) || { r: 188, g: 236, b: 255 };
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 120 + Math.random() * 90;
    const shard = {
      id: `crystal-shard-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      x: origin.x + Math.cos(angle) * baseRadius * 0.6,
      y: origin.y + Math.sin(angle) * baseRadius * 0.6,
      vx: Math.cos(angle) * speed * 0.6,
      vy: Math.sin(angle) * speed * 0.4 - 40,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 6,
      size: 5 + Math.random() * 6,
      life: 0,
      maxLife: 0.6 + Math.random() * 0.4,
      color: palette,
    };
    this.crystalShards.push(shard);
  }
}

/**
 * Apply damage to a developer crystal and fire fracture/shard visuals.
 * @this {SimplePlayfield}
 * @param {object} crystal
 * @param {number} damage
 * @param {{position?:{x:number,y:number}}} options
 */
export function applyCrystalHit(crystal, damage, options = {}) {
  if (!crystal || !Number.isFinite(damage) || damage <= 0) {
    return;
  }
  const position = options.position || this.getCrystalPosition(crystal);
  const radius = this.getCrystalRadius(crystal);
  const intensity = Math.min(1, damage / Math.max(1, crystal.maxIntegrity || 1));
  const fractureCount = Math.max(1, Math.round(intensity * 3));
  for (let index = 0; index < fractureCount; index += 1) {
    this.createCrystalFracture(crystal, { angle: Math.random() * Math.PI * 2 });
  }
  if (position && radius) {
    this.spawnCrystalShards(position, radius, {
      intensity: Math.max(0.25, intensity),
      paletteRatio: crystal.paletteRatio,
    });
  }
  const currentIntegrity = Number.isFinite(crystal.integrity) ? crystal.integrity : 0;
  crystal.integrity = Math.max(0, currentIntegrity - damage);
  if (crystal.integrity <= 0) {
    this.developerCrystals = this.developerCrystals.filter((entry) => entry?.id !== crystal.id);
    if (this.focusedCrystalId === crystal.id) {
      this.focusedCrystalId = null;
    }
    if (this.messageEl) {
      this.messageEl.textContent = 'Developer crystal shattered—shards scatter across the lane.';
    }
  }
}

/**
 * Advance fracture animation progress and shard particle life-cycles.
 * @this {SimplePlayfield}
 * @param {number} delta
 */
export function updateCrystals(delta) {
  if (!Number.isFinite(delta) || delta <= 0) {
    return;
  }
  this.developerCrystals.forEach((crystal) => {
    if (!Array.isArray(crystal.fractures)) {
      crystal.fractures = [];
    }
    crystal.fractures.forEach((fracture) => {
      if (!fracture) {
        return;
      }
      const current = Number.isFinite(fracture.progress) ? fracture.progress : 0;
      fracture.progress = Math.min(1, current + delta * 2.6);
    });
  });
  const gravity = 420;
  const damping = 0.9;
  const survivors = [];
  this.crystalShards.forEach((shard) => {
    if (!shard) {
      return;
    }
    shard.life = (shard.life || 0) + delta;
    shard.rotation = (shard.rotation || 0) + (shard.spin || 0) * delta;
    shard.vy = (shard.vy || 0) + gravity * delta * 0.3;
    shard.vx = (shard.vx || 0) * damping;
    shard.vy *= damping;
    shard.x = (shard.x || 0) + shard.vx * delta;
    shard.y = (shard.y || 0) + shard.vy * delta;
    if (shard.life < (shard.maxLife || 0.8)) {
      survivors.push(shard);
    }
  });
  this.crystalShards = survivors;
}
