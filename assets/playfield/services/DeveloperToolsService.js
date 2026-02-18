/**
 * Developer Tools Service
 * Provides developer-only functionality for testing and sandbox features.
 * Consolidates crystal management and developer tower placement.
 * Created as part of Phase 1.1.4 refactoring.
 */

import { samplePaletteGradient } from '../../colorSchemeUtils.js';

// Pre-calculated constants for performance optimization
const TWO_PI = Math.PI * 2;

/**
 * Factory function to create a developer tools service instance.
 * @param {object} playfield - Reference to the SimplePlayfield instance
 * @returns {object} Developer tools service instance
 */
export function createDeveloperToolsService(playfield) {
  // Internal state for developer crystals
  const state = {
    crystals: [],
    shards: [],
    crystalIdCounter: 0,
    focusedCrystalId: null,
  };

  /**
   * Initialize developer tools state.
   */
  function initialize() {
    state.crystals = [];
    state.shards = [];
    state.crystalIdCounter = 0;
    state.focusedCrystalId = null;
  }

  // ========== Crystal Management ==========

  /**
   * Compute a developer crystal's render radius relative to the active canvas bounds.
   * @param {object} crystal
   * @returns {number}
   */
  function getCrystalRadius(crystal) {
    if (!crystal) {
      return 0;
    }
    const minDimension = Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) || 0;
    const baseRadius = minDimension ? minDimension * 0.08 : 0;
    return Math.max(32, baseRadius);
  }

  /**
   * Translate a normalized developer crystal position into canvas coordinates.
   * @param {object} crystal
   * @returns {{x:number,y:number}|null}
   */
  function getCrystalPosition(crystal) {
    if (!crystal || !crystal.normalized) {
      return null;
    }
    return playfield.getCanvasPosition(crystal.normalized);
  }

  /**
   * Spawn a developer crystal for sandbox testing at the supplied normalized coordinates.
   * @param {{x:number,y:number}} normalized
   * @param {{integrity?:number,thero?:number,theroMultiplier?:number}} options
   * @returns {boolean}
   */
  function addDeveloperCrystal(normalized, options = {}) {
    const clamped = playfield.clampNormalized(normalized);
    if (!clamped) {
      return false;
    }
    const position = playfield.getCanvasPosition(clamped);
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      return false;
    }
    state.crystalIdCounter += 1;
    const id = `developer-crystal-${state.crystalIdCounter}`;
    const paletteRatio = Math.random();
    const outline = Array.from({ length: 7 }, () => 0.72 + Math.random() * 0.28);
    const integrity = Number.isFinite(options.integrity) && options.integrity > 0 ? options.integrity : 900;
    const thero = Number.isFinite(options.thero) && options.thero >= 0 ? options.thero : 0;
    const theroMultiplier = Number.isFinite(options.theroMultiplier) ? options.theroMultiplier : 0;
    const crystal = {
      id,
      normalized: clamped,
      paletteRatio,
      outline,
      fractures: [],
      integrity,
      maxIntegrity: integrity,
      orientation: Math.random() * TWO_PI,
      theroReward: thero,
      theroMultiplier,
    };
    state.crystals.push(crystal);
    if (playfield.messageEl) {
      playfield.messageEl.textContent = 'Developer crystal anchored—towers can now chip through it.';
    }
    playfield.draw();
    return true;
  }

  /**
   * Remove all developer crystals (and shards) from the battlefield.
   * @param {{silent?:boolean}} options
   * @returns {number}
   */
  function clearDeveloperCrystals(options = {}) {
    const { silent = true } = options;
    const removed = state.crystals.length;
    if (!removed && !state.shards.length) {
      return 0;
    }
    state.crystals = [];
    state.shards = [];
    state.focusedCrystalId = null;
    if (!silent && playfield.messageEl) {
      playfield.messageEl.textContent = removed > 0
        ? 'Developer crystals cleared from the battlefield.'
        : 'No developer crystals to clear.';
    }
    playfield.draw();
    return removed;
  }

  /**
   * Retrieve the currently focused developer crystal, pruning stale selections.
   * @returns {object|null}
   */
  function getFocusedCrystal() {
    if (!state.focusedCrystalId) {
      return null;
    }
    const crystal = state.crystals.find((entry) => entry?.id === state.focusedCrystalId) || null;
    if (!crystal) {
      state.focusedCrystalId = null;
    }
    return crystal;
  }

  /**
   * Focus a specific developer crystal so towers prioritize it.
   * @param {object|null} crystal
   * @param {{silent?:boolean}} options
   */
  function setFocusedCrystal(crystal, options = {}) {
    if (!crystal) {
      clearFocusedCrystal(options);
      return;
    }
    const { silent = false } = options;
    state.focusedCrystalId = crystal.id;
    if (!silent && playfield.messageEl) {
      playfield.messageEl.textContent = 'All towers focusing on the developer crystal.';
    }
  }

  /**
   * Clear the active developer crystal focus target.
   * @param {{silent?:boolean}} options
   * @returns {boolean}
   */
  function clearFocusedCrystal(options = {}) {
    const { silent = false } = options;
    if (!state.focusedCrystalId) {
      return false;
    }
    state.focusedCrystalId = null;
    if (!silent && playfield.messageEl) {
      playfield.messageEl.textContent = 'Crystal focus cleared—towers resume optimal targeting.';
    }
    return true;
  }

  /**
   * Toggle whether a developer crystal is focused.
   * @param {object|null} crystal
   */
  function toggleCrystalFocus(crystal) {
    if (!crystal) {
      clearFocusedCrystal();
      return;
    }
    if (state.focusedCrystalId === crystal.id) {
      clearFocusedCrystal();
    } else {
      setFocusedCrystal(crystal);
    }
  }

  /**
   * Locate a developer crystal under the supplied canvas-space position.
   * @param {{x:number,y:number}} position
   * @returns {object|null}
   */
  function findCrystalAt(position) {
    if (!position) {
      return null;
    }
    for (let index = state.crystals.length - 1; index >= 0; index -= 1) {
      const crystal = state.crystals[index];
      const center = getCrystalPosition(crystal);
      const radius = getCrystalRadius(crystal);
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
   * @param {object} crystal
   * @param {{angle?:number}} options
   */
  function createCrystalFracture(crystal, options = {}) {
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
    const angle = Number.isFinite(options.angle) ? options.angle : Math.random() * TWO_PI;
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
   * @param {{x:number,y:number}} origin
   * @param {number} baseRadius
   * @param {{intensity?:number,paletteRatio?:number}} options
   */
  function spawnCrystalShards(origin, baseRadius, options = {}) {
    if (!origin) {
      return;
    }
    const intensity = Number.isFinite(options.intensity) ? Math.max(0.2, options.intensity) : 0.4;
    const count = Math.max(4, Math.round(intensity * 6));
    const palette = samplePaletteGradient(options.paletteRatio ?? 0.5) || { r: 188, g: 236, b: 255 };
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * TWO_PI;
      const speed = 120 + Math.random() * 90;
      const shard = {
        id: `crystal-shard-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        x: origin.x + Math.cos(angle) * baseRadius * 0.6,
        y: origin.y + Math.sin(angle) * baseRadius * 0.6,
        vx: Math.cos(angle) * speed * 0.6,
        vy: Math.sin(angle) * speed * 0.4 - 40,
        rotation: Math.random() * TWO_PI,
        spin: (Math.random() - 0.5) * 6,
        size: 5 + Math.random() * 6,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.4,
        color: palette,
      };
      state.shards.push(shard);
    }
  }

  /**
   * Apply damage to a developer crystal and fire fracture/shard visuals.
   * @param {object} crystal
   * @param {number} damage
   * @param {{position?:{x:number,y:number}}} options
   */
  function applyCrystalHit(crystal, damage, options = {}) {
    if (!crystal || !Number.isFinite(damage) || damage <= 0) {
      return;
    }
    
    // Check if addThero is available once at the start
    const canAwardThero = typeof playfield.addThero === 'function';
    
    const position = options.position || getCrystalPosition(crystal);
    const radius = getCrystalRadius(crystal);
    const intensity = Math.min(1, damage / Math.max(1, crystal.maxIntegrity || 1));
    const fractureCount = Math.max(1, Math.round(intensity * 3));
    for (let index = 0; index < fractureCount; index += 1) {
      createCrystalFracture(crystal, { angle: Math.random() * TWO_PI });
    }
    if (position && radius) {
      spawnCrystalShards(position, radius, {
        intensity: Math.max(0.25, intensity),
        paletteRatio: crystal.paletteRatio,
      });
    }
    
    // Award Thero per hit if crystal has a multiplier
    if (canAwardThero && Number.isFinite(crystal.theroMultiplier) && crystal.theroMultiplier !== 0) {
      const theroGained = damage * crystal.theroMultiplier;
      playfield.addThero(theroGained);
    }
    
    const currentIntegrity = Number.isFinite(crystal.integrity) ? crystal.integrity : 0;
    crystal.integrity = Math.max(0, currentIntegrity - damage);
    if (crystal.integrity <= 0) {
      state.crystals = state.crystals.filter((entry) => entry?.id !== crystal.id);
      if (state.focusedCrystalId === crystal.id) {
        state.focusedCrystalId = null;
      }
      // Award thero if the crystal has a reward
      if (Number.isFinite(crystal.theroReward) && crystal.theroReward > 0) {
        if (canAwardThero) {
          playfield.addThero(crystal.theroReward);
        }
        if (playfield.messageEl) {
          playfield.messageEl.textContent = `Crystal shattered—earned ${crystal.theroReward}θ!`;
        }
      } else if (playfield.messageEl) {
        playfield.messageEl.textContent = 'Developer crystal shattered—shards scatter across the lane.';
      }
    }
  }

  /**
   * Advance fracture animation progress and shard particle life-cycles.
   * @param {number} delta
   */
  function updateCrystals(delta) {
    if (!Number.isFinite(delta) || delta <= 0) {
      return;
    }
    state.crystals.forEach((crystal) => {
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
    state.shards.forEach((shard) => {
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
    state.shards = survivors;
  }

  /**
   * Remove a specific developer crystal by ID.
   * @param {string} crystalId
   * @returns {boolean}
   */
  function removeDeveloperCrystal(crystalId) {
    if (!crystalId) {
      return false;
    }
    const initialCount = state.crystals.length;
    state.crystals = state.crystals.filter((crystal) => crystal?.id !== crystalId);
    const removed = state.crystals.length < initialCount;
    if (removed && state.focusedCrystalId === crystalId) {
      state.focusedCrystalId = null;
    }
    if (removed) {
      playfield.draw();
    }
    return removed;
  }

  // ========== Tower Management ==========

  /**
   * Spawn a developer tower for testing at the supplied normalized coordinates.
   * @param {{x:number,y:number}} normalized
   * @param {{towerType?:string}} options
   * @returns {boolean}
   */
  function addDeveloperTower(normalized, options = {}) {
    const clamped = playfield.clampNormalized(normalized);
    if (!clamped) {
      return false;
    }
    const position = playfield.getCanvasPosition(clamped);
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      return false;
    }

    const towerType = options.towerType || 'alpha';
    
    // Check if there's already a tower at this location
    const existingTower = playfield.findTowerAt(position);
    if (existingTower) {
      return false;
    }

    // Use the standard tower placement system with developer flag
    if (typeof playfield.placeTower === 'function') {
      const placed = playfield.placeTower(clamped, towerType, { isDeveloperTower: true });
      if (placed && playfield.messageEl) {
        playfield.messageEl.textContent = `Developer ${towerType} tower placed on battlefield.`;
      }
      return placed;
    }

    return false;
  }

  /**
   * Remove all developer towers from the battlefield.
   * @param {{silent?:boolean}} options
   * @returns {number}
   */
  function clearDeveloperTowers(options = {}) {
    const { silent = true } = options;
    
    if (!Array.isArray(playfield.towers)) {
      return 0;
    }

    const developerTowers = playfield.towers.filter((tower) => tower?.isDeveloperTower === true);
    const count = developerTowers.length;

    if (count === 0) {
      return 0;
    }

    // Remove each developer tower
    developerTowers.forEach((tower) => {
      if (tower?.id && typeof playfield.removeTower === 'function') {
        playfield.removeTower(tower.id);
      }
    });

    if (!silent && playfield.messageEl) {
      playfield.messageEl.textContent = count > 0
        ? `Cleared ${count} developer tower${count === 1 ? '' : 's'} from the battlefield.`
        : 'No developer towers to clear.';
    }

    playfield.draw();
    return count;
  }

  /**
   * Find a developer tower at the supplied canvas position.
   * @param {{x:number,y:number}} position
   * @returns {object|null}
   */
  function findDeveloperTowerAt(position) {
    if (!position || !Array.isArray(playfield.towers)) {
      return null;
    }

    const tower = playfield.findTowerAt(position);
    if (tower && tower.isDeveloperTower === true) {
      return tower;
    }

    return null;
  }

  /**
   * Remove a specific developer tower by ID.
   * @param {string} towerId
   * @returns {boolean}
   */
  function removeDeveloperTower(towerId) {
    if (!towerId || !Array.isArray(playfield.towers)) {
      return false;
    }

    const tower = playfield.towers.find((t) => t?.id === towerId && t?.isDeveloperTower === true);
    if (!tower) {
      return false;
    }

    if (typeof playfield.removeTower === 'function') {
      const removed = playfield.removeTower(towerId);
      if (removed) {
        playfield.draw();
      }
      return removed;
    }

    return false;
  }

  // Return the public API
  return {
    // Initialization
    initialize,
    
    // Crystal state accessors (for backward compatibility)
    get crystals() {
      return state.crystals;
    },
    get shards() {
      return state.shards;
    },
    get crystalIdCounter() {
      return state.crystalIdCounter;
    },
    get focusedCrystalId() {
      return state.focusedCrystalId;
    },
    
    // Crystal methods
    getCrystalRadius,
    getCrystalPosition,
    addDeveloperCrystal,
    clearDeveloperCrystals,
    getFocusedCrystal,
    setFocusedCrystal,
    clearFocusedCrystal,
    toggleCrystalFocus,
    findCrystalAt,
    createCrystalFracture,
    spawnCrystalShards,
    applyCrystalHit,
    updateCrystals,
    removeDeveloperCrystal,
    
    // Tower methods
    addDeveloperTower,
    clearDeveloperTowers,
    findDeveloperTowerAt,
    removeDeveloperTower,
  };
}
