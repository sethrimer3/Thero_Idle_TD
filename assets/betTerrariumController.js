'use strict';

/**
 * Factory that owns all Bet Spire Terrarium visual layers: slimes, birds,
 * grass, water, crystal, trees, sky cycle, celestial bodies, shrooms, and the
 * items dropdown.  Extracted from main.js to reduce its line count and isolate
 * terrarium DOM construction from core game orchestration.
 */

// Lightweight animation overlay that keeps the Bet terrarium lively.
import { FluidTerrariumCreatures } from './fluidTerrariumCreatures.js';
// Flying gamma birds that soar through the Bet terrarium.
import { FluidTerrariumBirds } from './fluidTerrariumBirds.js';
// Brownian forest crystal growth pinned to the Bet cavern walls.
import { FluidTerrariumCrystal } from './fluidTerrariumCrystal.js';
// Fractal trees anchored by the Bet terrarium placement masks.
import { FluidTerrariumTrees } from './fluidTerrariumTrees.js';
// Procedural grass that sprouts from the terrarium silhouettes.
import { FluidTerrariumGrass } from './fluidTerrariumGrass.js';
// Water layer tinted with Bet cyan and a gentle ripple.
import { FluidTerrariumWater } from './fluidTerrariumWater.js';
// Day/night cycle that animates the Bet terrarium sky and celestial bodies.
import { FluidTerrariumSkyCycle } from './fluidTerrariumSkyCycle.js';
// Voronoi fractal sun and moon for the Bet terrarium sky.
import { FluidTerrariumCelestialBodies } from './fluidTerrariumCelestialBodies.js';
// Phi and Psi shrooms for the Bet terrarium cave zones.
import { FluidTerrariumShrooms } from './fluidTerrariumShrooms.js';
// Terrarium items dropdown for managing and upgrading items in the Bet Spire.
import { FluidTerrariumItemsDropdown } from './fluidTerrariumItemsDropdown.js';

/**
 * @param {object} deps
 * @param {boolean}  deps.FLUID_STUDY_ENABLED
 * @param {object}   deps.powderState
 * @param {object}   deps.fluidElements
 * @param {object}   deps.achievementsTerrariumElements
 * @param {Array}    deps.BET_CAVE_SPAWN_ZONES
 * @param {Function} deps.schedulePowderBasinSave
 * @param {Function} deps.getSetFluidCameraMode  - Getter; resolved at call time so hoisting order does not matter.
 * @param {Function} deps.getActiveTabId
 * @param {Function} deps.setActiveTab
 * @param {Function} deps.updateFluidTabAvailability
 * @param {Function} deps.updateSpireTabVisibility
 * @param {Function} deps.getUpdatePowderDisplay  - Getter; resolved at call time so hoisting order does not matter.
 * @param {Function} deps.getSpendFluidSerendipity - Getter; resolved at call time so hoisting order does not matter.
 * @param {Function} deps.getGetCurrentFluidDropBank - Getter; resolved at call time so hoisting order does not matter.
 * @param {Function} deps.setFluidTerrariumGetters
 */
export function createBetTerrariumController(deps) {
  const {
    FLUID_STUDY_ENABLED,
    powderState,
    fluidElements,
    achievementsTerrariumElements,
    BET_CAVE_SPAWN_ZONES,
    schedulePowderBasinSave,
    getSetFluidCameraMode,
    getActiveTabId,
    setActiveTab,
    updateFluidTabAvailability,
    updateSpireTabVisibility,
    getUpdatePowderDisplay,
    getSpendFluidSerendipity,
    getGetCurrentFluidDropBank,
    setFluidTerrariumGetters,
  } = deps;

  // Late-bound helpers resolved at call time so creation order does not matter.
  const setFluidCameraMode = (...args) => getSetFluidCameraMode()(...args);
  const spendFluidSerendipity = (...args) => getSpendFluidSerendipity()(...args);
  const getCurrentFluidDropBank = (...args) => getGetCurrentFluidDropBank()(...args);
  const updatePowderDisplay = (...args) => getUpdatePowderDisplay()(...args);

  // ── Mutable terrarium layer instances ────────────────────────────────
  let fluidTerrariumCreatures = null;
  let fluidTerrariumBirds = null;
  let fluidTerrariumCrystal = null;
  let fluidTerrariumTrees = null;
  let fluidTerrariumGrass = null;
  let fluidTerrariumWater = null;
  let fluidTerrariumSkyCycle = null;
  let fluidTerrariumCelestialBodies = null;
  let fluidTerrariumShrooms = null;
  let fluidTerrariumItemsDropdown = null;

  // Achievements terrarium mirrors Bet terrarium but in achievements tab.
  let _achievementsTerrariumCreatures = null;
  let _achievementsTerrariumBirds = null;
  let _achievementsTerrariumCrystal = null;
  let _achievementsTerrariumTrees = null;
  let _achievementsTerrariumGrass = null;
  let _achievementsTerrariumWater = null;
  let _achievementsTerrariumSkyCycle = null;
  let _achievementsTerrariumCelestialBodies = null;
  let _achievementsTerrariumShrooms = null;

  // Expose Bet terrarium overlays to the visual settings module.
  setFluidTerrariumGetters({
    getCreatures: () => fluidTerrariumCreatures,
    getGrass: () => fluidTerrariumGrass,
    getSkyCycle: () => fluidTerrariumSkyCycle,
    getCrystal: () => fluidTerrariumCrystal,
    getShrooms: () => fluidTerrariumShrooms,
  });

  // ── Persisted creature count helpers ─────────────────────────────────

  // Read the persisted Bet terrarium creature counts so visuals survive reloads.
  function getBetTerrariumCreatureCount(key) {
    const value = powderState.betTerrarium?.[key];
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }

  // Persist Bet terrarium creature counts whenever the store spawns new residents.
  function setBetTerrariumCreatureCount(key, value) {
    if (!powderState.betTerrarium) {
      powderState.betTerrarium = {};
    }
    powderState.betTerrarium[key] = Math.max(0, Math.floor(value));
  }

  // ── Feature gate ─────────────────────────────────────────────────────

  /**
   * Force the Bet Spire Terrarium to remain locked and inactive while the feature is disabled.
   * This ensures saved unlocks or tabs cannot resurrect the retired simulation.
   */
  function enforceFluidStudyDisabledState() {
    if (FLUID_STUDY_ENABLED) {
      return;
    }

    powderState.fluidUnlocked = false;
    powderState.simulationMode = 'sand';
    powderState.pendingFluidDrops = [];
    powderState.loadedFluidState = null;
    powderState.fluidIdleDrainRate = 0;
    powderState.fluidBankHydrated = false;
    powderState.fluidInitialLoadRestored = true;
    if (getActiveTabId() === 'fluid') {
      setActiveTab('powder');
    }
    updateFluidTabAvailability();
    updateSpireTabVisibility();
  }

  // ── Sprite loading ───────────────────────────────────────────────────

  /**
   * Wait for a terrarium sprite to load so dependent overlays align with its silhouette.
   * @param {HTMLImageElement|null} image
   * @returns {Promise<boolean>} Resolves true when the image is ready.
   */
  function waitForTerrariumSprite(image) {
    if (!image) {
      return Promise.resolve(false);
    }

    // Force lazy-loaded sprites to decode immediately so startup flow doesn't stall
    // while the browser waits for the terrarium art to enter the viewport.
    if (image.loading === 'lazy') {
      image.loading = 'eager';
      if (typeof image.decode === 'function') {
        image.decode().catch(() => {});
      }
    }

    if (
      image.complete &&
      Number.isFinite(image.naturalWidth) &&
      Number.isFinite(image.naturalHeight) &&
      image.naturalWidth > 0 &&
      image.naturalHeight > 0
    ) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const handleComplete = (didLoad) => {
        image.removeEventListener('load', handleLoad);
        image.removeEventListener('error', handleError);
        resolve(didLoad);
      };

      const handleLoad = () => {
        handleComplete(true);
      };
      const handleError = () => {
        handleComplete(false);
      };

      // Prevent the startup sequence from hanging indefinitely if the sprite never
      // fires a load/error event (e.g., due to an unsupported format or network block).
      const timeoutHandle = window.setTimeout(() => handleComplete(false), 3000);

      image.addEventListener('load', handleLoad, { once: true });
      image.addEventListener('error', handleError, { once: true });

      // Clear the timeout once we reach a terminal state.
      const cleanup = () => window.clearTimeout(timeoutHandle);
      image.addEventListener('load', cleanup, { once: true });
      image.addEventListener('error', cleanup, { once: true });
    });
  }

  /**
   * Ensure the Bet terrarium surfaces spawn in order so creatures and foliage don't fall through.
   * First wait for the lightweight collision silhouette, then the ground terrain, and finally the floating island.
   */
  async function ensureTerrariumSurfacesReady() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    const collisionSprite = fluidElements.terrainCollisionSprite;
    if (collisionSprite && collisionSprite !== fluidElements.terrainSprite) {
      await waitForTerrariumSprite(collisionSprite);
    }
    await waitForTerrariumSprite(fluidElements.terrainSprite);
    const islandCollisionSprite = fluidElements.floatingIslandCollisionSprite;
    if (islandCollisionSprite && islandCollisionSprite !== fluidElements.floatingIslandSprite) {
      await waitForTerrariumSprite(islandCollisionSprite);
    }
    await waitForTerrariumSprite(fluidElements.floatingIslandSprite);
  }

  // ── Layer creation ───────────────────────────────────────────────────

  function ensureFluidTerrariumCreatures() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    // Lazily create the overlay so it never blocks powder initialization.
    if (fluidTerrariumCreatures || !fluidElements?.viewport) {
      return;
    }
    // Start with 0 slimes by default - players purchase them through the store.
    const slimeCount = getBetTerrariumCreatureCount('slimeCount');
    // Skip creating the creatures layer if no slimes are owned yet.
    if (slimeCount <= 0) {
      return;
    }
    fluidTerrariumCreatures = new FluidTerrariumCreatures({
      container: fluidElements.viewport,
      terrainElement: fluidElements.terrainSprite,
      terrainCollisionElement: fluidElements.terrainCollisionSprite,
      floatingIslandCollisionElement: fluidElements.floatingIslandCollisionSprite,
      creatureCount: slimeCount,
      spawnZones: BET_CAVE_SPAWN_ZONES,
    });
    fluidTerrariumCreatures.start();
  }

  function ensureFluidTerrariumBirds() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    // Lazily create the bird overlay
    if (fluidTerrariumBirds || !fluidElements?.viewport) {
      return;
    }
    // Start with 0 birds by default - players purchase them through the store.
    const birdCount = getBetTerrariumCreatureCount('birdCount');
    // Skip creating the bird layer if no birds are owned yet.
    if (birdCount <= 0) {
      return;
    }
    fluidTerrariumBirds = new FluidTerrariumBirds({
      container: fluidElements.viewport,
      terrainElement: fluidElements.terrainSprite,
      terrainCollisionElement: fluidElements.terrainCollisionSprite,
      floatingIslandCollisionElement: fluidElements.floatingIslandCollisionSprite,
      birdCount: birdCount,
    });
    fluidTerrariumBirds.start();
  }

  // Lazily generate the terrarium grass overlay once the stage media is available.
  function ensureFluidTerrariumGrass() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    if (fluidTerrariumGrass || !fluidElements?.terrariumMedia || !fluidElements?.terrainSprite) {
      return;
    }
    fluidTerrariumGrass = new FluidTerrariumGrass({
      container: fluidElements.terrariumMedia,
      terrainElement: fluidElements.terrainSprite,
      terrainCollisionElement: fluidElements.terrainCollisionSprite,
      floatingIslandElement: fluidElements.floatingIslandSprite,
      floatingIslandCollisionElement: fluidElements.floatingIslandCollisionSprite,
      // Use both ground and floating island placement masks so grass sprouts in each marked zone.
      maskUrls: [
        './assets/sprites/spires/betSpire/terrarium/Grass.png',
        './assets/sprites/spires/betSpire/terrarium/Island-Grass.png',
      ],
    });
    fluidTerrariumGrass.start();
  }

  // Paint the Bet terrarium water mask with a cyan tint and animated ripples.
  function ensureFluidTerrariumWater() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    if (fluidTerrariumWater || !fluidElements?.terrariumMedia) {
      return;
    }
    fluidTerrariumWater = new FluidTerrariumWater({
      container: fluidElements.terrariumMedia,
      maskUrl: './assets/sprites/spires/betSpire/terrarium/Water.png',
    });
    fluidTerrariumWater.start();
  }

  // Grow a Brownian forest inside the growing crystal alcove, constrained by the collision silhouette.
  function ensureFluidTerrariumCrystal() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    if (fluidTerrariumCrystal || !fluidElements?.terrariumMedia) {
      return;
    }
    fluidTerrariumCrystal = new FluidTerrariumCrystal({
      container: fluidElements.terrariumMedia,
      collisionElement: fluidElements.terrainCollisionSprite,
      maskUrl: './assets/sprites/spires/betSpire/terrarium/Growing-Crystal.png',
    });
  }

  // Plant animated fractal trees on the Bet terrarium using the placement masks.
  function ensureFluidTerrariumTrees() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    if (fluidTerrariumTrees || !fluidElements?.terrariumMedia) {
      return;
    }
    fluidTerrariumTrees = new FluidTerrariumTrees({
      container: fluidElements.terrariumMedia,
      state: powderState.betTerrarium,
      powderState: powderState,
      spendScintillae: spendFluidSerendipity,
      getSerendipityBalance: getCurrentFluidDropBank,
      onShroomPlace: handleShroomPlacement,
      onSlimePlace: handleSlimePlacement,
      onBirdPlace: handleBirdPlacement,
      onCelestialPlace: handleCelestialPlacement,
      // Cave spawn zones enable cave-only fractal placement validation.
      caveSpawnZones: BET_CAVE_SPAWN_ZONES,
      // Terrain collision sprite enables walkable mask for Brownian growth.
      terrainCollisionElement: fluidElements.terrainCollisionSprite,
      floatingIslandCollisionElement: fluidElements.floatingIslandCollisionSprite,
      onStateChange: (state) => {
        powderState.betTerrarium = {
          levelingMode: Boolean(state?.levelingMode),
          trees: state?.trees ? { ...state.trees } : {},
          buttonMenuOpen: Boolean(state?.buttonMenuOpen),
          cameraMode: Boolean(state?.cameraMode),
          celestialBodiesEnabled: Boolean(powderState.betTerrarium?.celestialBodiesEnabled),
          slimeCount: getBetTerrariumCreatureCount('slimeCount'),
          birdCount: getBetTerrariumCreatureCount('birdCount'),
        };
        schedulePowderBasinSave();
        setFluidCameraMode(powderState.betTerrarium.cameraMode, {
          skipTransformReset: true,
          skipSave: true,
        });
      },
    });
    setFluidCameraMode(Boolean(powderState.betTerrarium?.cameraMode), {
      skipTransformReset: true,
      skipSave: true,
    });
  }

  /**
   * Handle celestial bodies placement from the terrarium store.
   * Enables the sun and moon Voronoi fractals and starts the day/night cycle.
   * @returns {boolean} True if placement succeeded
   */
  function handleCelestialPlacement(options = {}) {
    if (!FLUID_STUDY_ENABLED) {
      return false;
    }

    const storeItem = options.storeItem;
    const celestialBody = storeItem?.celestialBody; // 'sun' or 'moon'

    if (!celestialBody || (celestialBody !== 'sun' && celestialBody !== 'moon')) {
      return false;
    }

    // Enable celestial bodies state
    if (!powderState.betTerrarium) {
      powderState.betTerrarium = {};
    }

    // Track sun and moon separately
    if (celestialBody === 'sun') {
      powderState.betTerrarium.sunEnabled = true;
    } else if (celestialBody === 'moon') {
      powderState.betTerrarium.moonEnabled = true;
    }

    // Enable celestial cycle when either sun or moon is unlocked
    const anyEnabled = powderState.betTerrarium.sunEnabled || powderState.betTerrarium.moonEnabled;
    powderState.betTerrarium.celestialBodiesEnabled = anyEnabled;

    // Enable the sky cycle if it exists
    if (fluidTerrariumSkyCycle) {
      fluidTerrariumSkyCycle.enableCelestialBodies();
    }

    // Initialize celestial bodies renderer
    ensureFluidTerrariumCelestialBodies();

    schedulePowderBasinSave();
    return true;
  }

  /**
   * Unlock a celestial body (sun or moon) in the achievements terrarium.
   * Called when achievements are unlocked.
   * @param {string} celestialBody - 'sun' or 'moon'
   */
  function unlockTerrariumCelestialBody(celestialBody) {
    if (!celestialBody || (celestialBody !== 'sun' && celestialBody !== 'moon')) {
      return;
    }
    handleCelestialPlacement({ storeItem: { celestialBody } });
    
    // Also show in achievements terrarium
    if (achievementsTerrariumElements.terrariumSun && celestialBody === 'sun') {
      achievementsTerrariumElements.terrariumSun.hidden = false;
      achievementsTerrariumElements.terrariumSun.style.display = '';
      achievementsTerrariumElements.terrariumSun.style.opacity = '1';
    }
    if (achievementsTerrariumElements.terrariumMoon && celestialBody === 'moon') {
      achievementsTerrariumElements.terrariumMoon.hidden = false;
      achievementsTerrariumElements.terrariumMoon.style.display = '';
      achievementsTerrariumElements.terrariumMoon.style.opacity = '1';
    }
  }

  /**
   * Add creatures to the Bet terrarium state and recreate the visual layer.
   * Typically called from achievement unlocks to reward the player with new residents.
   * @param {string} creatureType - Type of creature ('slime', 'bird')
   * @param {number} count - Number to add
   */
  function addTerrariumCreature(creatureType, count = 1) {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    
    if (creatureType === 'slime') {
      const currentCount = getBetTerrariumCreatureCount('slimeCount');
      const newCount = currentCount + count;
      setBetTerrariumCreatureCount('slimeCount', newCount);
      
      // Recreate creatures with new count
      if (fluidTerrariumCreatures) {
        fluidTerrariumCreatures.destroy();
        fluidTerrariumCreatures = null;
      }
      ensureFluidTerrariumCreatures();
      
      schedulePowderBasinSave();
    } else if (creatureType === 'bird') {
      const currentCount = getBetTerrariumCreatureCount('birdCount');
      const newCount = currentCount + count;
      setBetTerrariumCreatureCount('birdCount', newCount);
      
      // Recreate birds with new count
      if (fluidTerrariumBirds) {
        fluidTerrariumBirds.destroy();
        fluidTerrariumBirds = null;
      }
      ensureFluidTerrariumBirds();
      
      schedulePowderBasinSave();
    }
  }

  /**
   * Add items (trees, shrooms) to the Bet terrarium.
   * Called when achievements are unlocked.
   * @param {string} itemType - Type of item ('betTreeLarge', 'betTreeSmall', 'phiShroomYellow', etc.)
   * @param {number} count - Number/level to add
   */
  function addTerrariumItem(itemType, count = 1) {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    
    // Refresh terrarium visuals based on item type
    if (itemType.includes('Tree')) {
      // Trees need special handling via the tree system
      if (!powderState.betTerrarium) {
        powderState.betTerrarium = {};
      }
      if (!powderState.betTerrarium.trees) {
        powderState.betTerrarium.trees = {};
      }
      
      // Add allocation to the appropriate tree
      const treeKey = itemType === 'betTreeLarge' ? 'largeTree1' : 'smallTree1';
      const currentAllocation = powderState.betTerrarium.trees[treeKey]?.allocated || 0;
      const newAllocation = currentAllocation + count;
      
      if (!powderState.betTerrarium.trees[treeKey]) {
        powderState.betTerrarium.trees[treeKey] = { allocated: 0 };
      }
      powderState.betTerrarium.trees[treeKey].allocated = newAllocation;
      
      // Recreate trees
      if (fluidTerrariumTrees) {
        fluidTerrariumTrees.destroy();
        fluidTerrariumTrees = null;
      }
      ensureFluidTerrariumTrees();
    } else if (itemType.includes('Shroom')) {
      // Shrooms are rendered via the shrooms system
      if (!fluidTerrariumShrooms) {
        ensureFluidTerrariumShrooms();
      }
      if (fluidTerrariumShrooms) {
        const targetCount = Math.max(1, count);
        // Place shrooms to mirror achievement rewards in the terrarium.
        for (let i = 0; i < targetCount; i += 1) {
          if (itemType === 'psiShroom') {
            handleShroomPlacement({ type: 'psi' });
          } else {
            handleShroomPlacement({
              type: 'phi',
              colorVariant: itemType.replace('phiShroom', '').toLowerCase() || 'yellow',
            });
          }
        }
      }
    }
    
    schedulePowderBasinSave();
  }

  // Paint the Bet terrarium sky with a looping day/night gradient and celestial path.
  function ensureFluidTerrariumSkyCycle() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    if (fluidTerrariumSkyCycle || !fluidElements?.terrariumSky) {
      return;
    }
    // Check if celestial bodies have been purchased
    const celestialEnabled = Boolean(powderState.betTerrarium?.celestialBodiesEnabled);
    const sunEnabled = Boolean(powderState.betTerrarium?.sunEnabled);
    const moonEnabled = Boolean(powderState.betTerrarium?.moonEnabled);
    fluidTerrariumSkyCycle = new FluidTerrariumSkyCycle({
      skyElement: fluidElements.terrariumSky,
      sunElement: fluidElements.terrariumSun,
      moonElement: fluidElements.terrariumMoon,
      celestialBodiesEnabled: celestialEnabled,
      sunEnabled,
      moonEnabled,
    });
  }

  // Initialize Voronoi fractal sun and moon for the Bet terrarium.
  function ensureFluidTerrariumCelestialBodies() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    const sunEnabled = Boolean(powderState.betTerrarium?.sunEnabled);
    const moonEnabled = Boolean(powderState.betTerrarium?.moonEnabled);
    
    if (!sunEnabled && !moonEnabled) {
      return;
    }
    if (fluidTerrariumCelestialBodies || !fluidElements?.terrariumSun || !fluidElements?.terrariumMoon) {
      return;
    }
    fluidTerrariumCelestialBodies = new FluidTerrariumCelestialBodies({
      sunElement: fluidElements.terrariumSun,
      moonElement: fluidElements.terrariumMoon,
      sunEnabled,
      moonEnabled,
      enabled: sunEnabled || moonEnabled,
      onStateChange: (state) => {
        if (state.celestialBodiesEnabled !== undefined) {
          if (!powderState.betTerrarium) {
            powderState.betTerrarium = {};
          }
          powderState.betTerrarium.celestialBodiesEnabled = state.celestialBodiesEnabled;
          schedulePowderBasinSave();
        }
      },
    });
  }

  // Initialize Phi and Psi shrooms inside the cave spawn zones.
  function ensureFluidTerrariumShrooms() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    if (fluidTerrariumShrooms || !fluidElements?.viewport) {
      return;
    }
    // Initialize betShrooms state if not present
    if (!powderState.betShrooms) {
      powderState.betShrooms = { shrooms: [] };
    }
    fluidTerrariumShrooms = new FluidTerrariumShrooms({
      container: fluidElements.viewport,
      terrainElement: fluidElements.terrainSprite,
      terrainCollisionElement: fluidElements.terrainCollisionSprite,
      spawnZones: BET_CAVE_SPAWN_ZONES,
      onStateChange: (state) => {
        powderState.betShrooms = state;
      },
    });
    fluidTerrariumShrooms.start();
  }

  // Handle shroom placement from the terrarium store.
  function handleShroomPlacement(options) {
    if (!fluidTerrariumShrooms) {
      return false;
    }
    const { type, colorVariant } = options;
    if (type === 'phi') {
      const shroom = fluidTerrariumShrooms.addPhiShroom({
        colorVariant: colorVariant || 'yellow',
        level: 1,
      });
      if (shroom) {
        return true;
      }
    } else if (type === 'psi') {
      const shroom = fluidTerrariumShrooms.addPsiShroom({
        level: 1,
      });
      if (shroom) {
        return true;
      }
    }
    return false;
  }

  // Handle slime placement from the terrarium store by increasing slime count and re-initializing creatures.
  function handleSlimePlacement() {
    const currentCount = getBetTerrariumCreatureCount('slimeCount');
    const newCount = currentCount + 1;
    setBetTerrariumCreatureCount('slimeCount', newCount);
    
    // Re-initialize the creatures system with the new count
    if (fluidTerrariumCreatures) {
      fluidTerrariumCreatures.destroy();
      fluidTerrariumCreatures = null;
    }
    
    // Create new creatures instance with updated count
    if (fluidElements?.viewport) {
      fluidTerrariumCreatures = new FluidTerrariumCreatures({
        container: fluidElements.viewport,
        terrainElement: fluidElements.terrainSprite,
        terrainCollisionElement: fluidElements.terrainCollisionSprite,
        floatingIslandCollisionElement: fluidElements.floatingIslandCollisionSprite,
        creatureCount: newCount,
        spawnZones: BET_CAVE_SPAWN_ZONES,
      });
      fluidTerrariumCreatures.start();
    }
    
    // Schedule save to persist the slime count
    schedulePowderBasinSave();
    
    return true;
  }

  // Handle bird placement from the terrarium store by increasing bird count and re-initializing bird system.
  function handleBirdPlacement() {
    const currentCount = getBetTerrariumCreatureCount('birdCount');
    const newCount = currentCount + 1;
    setBetTerrariumCreatureCount('birdCount', newCount);
    
    // Re-initialize the bird system with the new count
    if (fluidTerrariumBirds) {
      fluidTerrariumBirds.destroy();
      fluidTerrariumBirds = null;
    }
    
    // Create new bird instance with updated count
    if (fluidElements?.viewport) {
      fluidTerrariumBirds = new FluidTerrariumBirds({
        container: fluidElements.viewport,
        terrainElement: fluidElements.terrainSprite,
        terrainCollisionElement: fluidElements.terrainCollisionSprite,
        floatingIslandCollisionElement: fluidElements.floatingIslandCollisionSprite,
        birdCount: newCount,
      });
      fluidTerrariumBirds.start();
    }
    
    // Schedule save to persist the bird count
    schedulePowderBasinSave();
    
    return true;
  }

  /**
   * Initialize the terrarium items dropdown for managing and upgrading items.
   */
  function ensureFluidTerrariumItemsDropdown() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    if (fluidTerrariumItemsDropdown || !fluidElements?.terrariumItemsToggle) {
      return;
    }
    fluidTerrariumItemsDropdown = new FluidTerrariumItemsDropdown({
      toggleButton: fluidElements.terrariumItemsToggle,
      dropdownContainer: fluidElements.terrariumItemsDropdown,
      emptyMessage: fluidElements.terrariumItemsEmpty,
      itemsList: fluidElements.terrariumItemsList,
      getSerendipityBalance: () => 0,
      spendScintillae: (_amount) => {
        return 0;
      },
      getProducerCount: (id) => {
        if (id === 'slime') {
          return getBetTerrariumCreatureCount('slimeCount');
        }
        if (id === 'bird') {
          return getBetTerrariumCreatureCount('birdCount');
        }
        return 0;
      },
      setProducerCount: (id, count) => {
        if (id === 'slime') {
          // Rebuild slime overlays when the store upgrades the count.
          setBetTerrariumCreatureCount('slimeCount', count);
          if (fluidTerrariumCreatures) {
            fluidTerrariumCreatures.destroy();
            fluidTerrariumCreatures = null;
          }
          ensureFluidTerrariumCreatures();
        } else if (id === 'bird') {
          // Rebuild bird overlays when the store upgrades the count.
          setBetTerrariumCreatureCount('birdCount', count);
          if (fluidTerrariumBirds) {
            fluidTerrariumBirds.destroy();
            fluidTerrariumBirds = null;
          }
          ensureFluidTerrariumBirds();
        }
        schedulePowderBasinSave();
      },
      getTreesState: () => {
        if (!fluidTerrariumTrees) {
          return {};
        }
        return fluidTerrariumTrees.treeState || {};
      },
      setTreeAllocation: (treeKey, newAllocation) => {
        if (!fluidTerrariumTrees) {
          return;
        }
        // Find the tree and update its allocation
        const tree = fluidTerrariumTrees.trees?.find((t) => t.id === treeKey);
        if (tree) {
          tree.state.allocated = newAllocation;
          fluidTerrariumTrees.treeState[treeKey] = { allocated: newAllocation };
          fluidTerrariumTrees.updateSimulationTarget(tree);
          fluidTerrariumTrees.updateTreeBadge(tree);
          fluidTerrariumTrees.emitState();
        }
        schedulePowderBasinSave();
      },
      onUpgrade: () => {
        updatePowderDisplay();
      },
    });
  }

  // ── Public API ───────────────────────────────────────────────────────

  return {
    enforceFluidStudyDisabledState,
    ensureTerrariumSurfacesReady,
    ensureFluidTerrariumCreatures,
    ensureFluidTerrariumBirds,
    ensureFluidTerrariumGrass,
    ensureFluidTerrariumWater,
    ensureFluidTerrariumCrystal,
    ensureFluidTerrariumTrees,
    ensureFluidTerrariumSkyCycle,
    ensureFluidTerrariumCelestialBodies,
    ensureFluidTerrariumShrooms,
    ensureFluidTerrariumItemsDropdown,
    unlockTerrariumCelestialBody,
    addTerrariumCreature,
    addTerrariumItem,
    getBetTerrariumCreatureCount,
    setBetTerrariumCreatureCount,
  };
}
