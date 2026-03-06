/**
 * Lamed tower gravity simulation module.
 * Provides an idle physics simulation with orbital mechanics for stars around a central celestial body.
 *
 * Features:
 * - Orbital mechanics with central gravity and softening
 * - Mass-based visual tiers (Proto-star through Black Hole)
 * - Drag system with upgradable k parameter
 * - Accretion disk visual effects with dust particles
 * - Trajectory trails colored by velocity
 * - Geyser particle bursts on high-mass absorptions
 * - Statistics tracking (mass inflow, absorptions)
 *
 * Static data (tier definitions, constants, SeededRandom) lives in lamedTowerData.js.
 */

import {
  MASS_TIERS,
  TIER_DIAMETER_PERCENTAGES,
  BLACK_HOLE_MAX_DIAMETER_PERCENT,
  COLLAPSE_ANIMATION_SECONDS,
  MIN_RENDERED_STARS,
  MAX_RENDERED_STARS,
  MAX_TRAIL_STARS,
  MAX_DUST_PARTICLES,
  STAR_SIZE_MULTIPLIER,
  resolveReducedStarCap,
  SeededRandom,
} from './lamedTowerData.js';
import { getEffectiveDevicePixelRatio } from './shared/TowerUtils.js';
import { LamedStarfieldRenderer } from './lamedStarfield.js';
import { renderGeyserParticles as lamedRenderGeyserParticles, renderLamedSimulation as lamedRenderSimulation } from './lamedTowerRenderer.js';
import {
  updateCoreSizeState as lamedPhysicsUpdateCoreSizeState,
  generateValueNoiseTexture as lamedPhysicsGenerateValueNoiseTexture,
  sampleNoise as lamedPhysicsSampleNoise,
  updateSurfaceAnimation as lamedPhysicsUpdateSurfaceAnimation,
  rebuildSunSurfaceTexture as lamedPhysicsRebuildSunSurfaceTexture,
  updateSunBounce as lamedPhysicsUpdateSunBounce,
  scheduleNextShootingStar as lamedPhysicsScheduleNextShootingStar,
  spawnShootingStar as lamedPhysicsSpawnShootingStar,
  absorbStarImmediately as lamedPhysicsAbsorbStarImmediately,
  spawnStar as lamedPhysicsSpawnStar,
  spawnMultipleStars as lamedPhysicsSpawnMultipleStars,
  spawnDustParticles as lamedPhysicsSpawnDustParticles,
  spawnGeyserBurst as lamedPhysicsSpawnGeyserBurst,
  updateDustParticles as lamedPhysicsUpdateDustParticles,
  updateShootingStars as lamedPhysicsUpdateShootingStars,
  updateStars as lamedPhysicsUpdateStars,
  updateAsteroids as lamedPhysicsUpdateAsteroids,
  updateEffects as lamedPhysicsUpdateEffects,
  updateGeyserParticles as lamedPhysicsUpdateGeyserParticles,
} from './lamedTowerPhysics.js';

/**
 * GravitySimulation for the Lamed Spire.
 * 
 * Simulates stars spawning at random orbital distances, orbiting around a central celestial body,
 * and eventually being absorbed to increase the central body's mass.
 */
export class GravitySimulation {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    
    // Callbacks
    this.onStarMassChange = typeof options.onStarMassChange === 'function' ? options.onStarMassChange : null;
    this.samplePaletteGradient = typeof options.samplePaletteGradient === 'function' ? options.samplePaletteGradient : null;
    
    // Load sprites
    this.sprites = {
      star: null,
      starNoGlow: null,
      asteroids: [],
      sunPhases: [],
      spaceDust: null,
    };
    this.spritesLoaded = false;
    this.loadSprites();
    
    // Dimensions
    this.width = 0;
    this.height = 0;
    this.centerX = 0;
    this.centerY = 0;
    this.cssWidth = 0; // CSS pixel width of the canvas for spawn calculations.
    this.cssHeight = 0; // CSS pixel height of the canvas for spawn calculations.
    // Cap the render resolution so high-DPI devices do not overdraw the canvas and tank performance.
    this.maxDevicePixelRatio = typeof options.maxDevicePixelRatio === 'number'
      ? Math.max(1, options.maxDevicePixelRatio)
      : 1.5;
    
    // Physics parameters
    this.G = 200; // Gravitational constant
    this.epsilon = 5; // Softening parameter to prevent singularity
    this.starMass = 10; // Initial mass of central star (Proto-star)
    this.dragCoefficient = 0.002; // k parameter for drag (upgradable, starts at 0.002)
    this.dragLevel = 0; // Current drag upgrade level
    this.maxDragLevel = 1000000; // Maximum drag upgrade level
    
    // Upgrades
    this.upgrades = {
      starMass: 0, // Upgrade level for orbiting stars' mass
    };
    
    // Star management (renamed from sparks)
    this.stars = [];
    this.maxStars = MAX_RENDERED_STARS; // Maximum number of active orbiting stars visible at once.
    this.sparkSpawnRate = 0; // Stars spawned per second (starts at 0)
    this.spawnAccumulator = 0;
    // Cap how many orbiting stars are allowed to render trails simultaneously to protect framerate.
    this.maxStarsWithTrails = Math.min(
      typeof options.maxStarsWithTrails === 'number' ? options.maxStarsWithTrails : MAX_TRAIL_STARS,
      MAX_TRAIL_STARS,
    );
    this.trailEnabledStarCount = 0; // Track how many active orbiting stars should render trails.
    
    // Asteroid management - always 5 asteroids that orbit the sun
    this.asteroids = [];
    
    // Click position for spawning stars near click location
    this.lastClickPosition = null;
    
    // Spawn parameters for ring spawner
    this.spawnRadiusMin = 60; // Minimum spawn radius (pixels)
    this.spawnRadiusMax = 120; // Maximum spawn radius (pixels)
    this.velocityNoiseFactor = 0.15; // Noise added to circular velocity
    
    // Trail rendering
    this.trailLength = 28; // Number of trail points to keep so per-particle memory stays modest
    this.baseTrailLength = this.trailLength;
    this.trailFadeRate = 0.035; // How quickly trails fade to reduce blending work per frame
    this.baseTrailFadeRate = this.trailFadeRate;
    this.simpleTrailLength = typeof options.simpleTrailLength === 'number' ? options.simpleTrailLength : 12;
    this.simpleTrailFadeRate = typeof options.simpleTrailFadeRate === 'number' ? options.simpleTrailFadeRate : 0.05;
    this.trailComplexityThresholds = {
      simplify: 100,
      disable: 200,
    };
    this.activeTrailSettings = {
      mode: 'full',
      maxLength: this.baseTrailLength,
      fadeRate: this.baseTrailFadeRate,
    };
    this.lowGraphicsModeResolver = typeof options.isLowGraphicsMode === 'function' ? options.isLowGraphicsMode : null;
    this.lowGraphicsMode = typeof options.lowGraphicsMode === 'boolean' ? options.lowGraphicsMode : false;

    // Performance safeguards to automatically dial back heavy effects when frame times spike.
    this.frameTimeSamples = []; // Initialized empty
    this.frameSampleLimit = 45;
    this.performanceMode = 'balanced';
    this.performanceThresholds = {
      degradeMs: 22, // ~45 FPS target triggers fallbacks
      recoverMs: 17, // ~58 FPS restores full fidelity
    };
    this.initialCaps = {
      devicePixelRatio: this.maxDevicePixelRatio,
      trailCount: this.maxStarsWithTrails,
      starCount: this.maxStars,
    };
    this.performanceCaps = {
      reducedDevicePixelRatio: Math.min(this.maxDevicePixelRatio, 1.25),
      reducedTrailCount: Math.max(6, Math.min(this.maxStarsWithTrails, 24)),
      reducedStarCount: Math.min(this.maxStars, resolveReducedStarCap(this.maxStars)),
      reducedDustCap: 80,
    };
    this.performanceDustCap = MAX_DUST_PARTICLES;
    
    // Visual effects
    this.backgroundColor = '#000000'; // Black space
    this.shockRings = []; // Absorption shock rings
    this.dustParticles = []; // Accretion disk dust
    this.highGraphics = typeof options.highGraphics === 'boolean' ? options.highGraphics : false;
    this.desiredDustParticles = MAX_DUST_PARTICLES; // Maintain a fixed decorative ring of dust around the sun.
    this.maxDustParticles = this.desiredDustParticles; // Cap population so the simulation keeps exactly 200 grains.
    this.dustSpawnRate = this.desiredDustParticles; // Refill quickly when particles expire or are removed.
    this.dustAccumulator = 0;
    this.flashEffects = []; // Spawn flash effects
    this.showSpawnFlashes = true; // Toggle for spawn flash visibility (controlled by preferences).
    // Parallax background starfield — created once; offscreen caches built in constructor.
    this.starfieldRenderer = typeof document !== 'undefined' ? new LamedStarfieldRenderer() : null;
    // Toggle for background starfield visibility (controlled by preferences).
    this.showBackgroundStars = true;
    this.geyserParticles = []; // Geyser bursts triggered by high-tier absorptions
    this.visualEffectSettings = {
      /**
       * Particle system controls for the geyser burst effect.
       */
      geyser: {
        particleCountMin: typeof options.geyserParticleMin === 'number' ? options.geyserParticleMin : 6,
        particleCountMax: typeof options.geyserParticleMax === 'number' ? options.geyserParticleMax : 14,
        baseSpeed: typeof options.geyserBaseSpeed === 'number' ? options.geyserBaseSpeed : 180,
        upwardBias: typeof options.geyserUpwardBias === 'number' ? options.geyserUpwardBias : 0.35,
        lifetimeMin: typeof options.geyserLifetimeMin === 'number' ? options.geyserLifetimeMin : 0.4,
        lifetimeMax: typeof options.geyserLifetimeMax === 'number' ? options.geyserLifetimeMax : 0.8,
        sizeMin: typeof options.geyserSizeMin === 'number' ? options.geyserSizeMin : 8,
        sizeMax: typeof options.geyserSizeMax === 'number' ? options.geyserSizeMax : 16,
        gravity: typeof options.geyserGravity === 'number' ? options.geyserGravity : 240,
        flashFraction: typeof options.geyserFlashFraction === 'number' ? options.geyserFlashFraction : 0.1,
      },
    };
    // Track the spring-based bounce so the sun can wobble outward when it absorbs a star.
    this.sunBounce = { offset: 0, velocity: 0 };

    // Track the responsive diameter so the sun scales with viewport width instead of raw mass.
    const initialTier = this.getCurrentTier();
    const initialPercent = TIER_DIAMETER_PERCENTAGES[initialTier.tierIndex] || TIER_DIAMETER_PERCENTAGES[0];
    this.coreSizeState = {
      percent: initialPercent,
      transitionStartPercent: initialPercent,
      targetPercent: initialPercent,
      transitionElapsed: 0,
      transitionDuration: 0,
    };
    this.lastTierIndex = initialTier.tierIndex;
    const blackHoleTier = MASS_TIERS[MASS_TIERS.length - 1];
    // Span late-game growth across nine thresholds so the diameter hits 50% at 10x the unlock mass.
    this.blackHoleGrowthRange = blackHoleTier ? blackHoleTier.threshold * 9 : 0;
    this.updateCoreSizeState(0);

    // Visual tuning controls for the sun surface so designers can fine-tune turbulence behaviour.
    this.sunSurfaceSettings = {
      sunspotThreshold: typeof options.sunspotThreshold === 'number' ? options.sunspotThreshold : 0.45,
      noiseScalePrimary: typeof options.noiseScalePrimary === 'number' ? options.noiseScalePrimary : 2.5,
      noiseScaleSecondary: typeof options.noiseScaleSecondary === 'number' ? options.noiseScaleSecondary : 6,
      spotDarkness: typeof options.spotDarkness === 'number' ? options.spotDarkness : 0.55,
      surfaceWarpStrength: typeof options.surfaceWarpStrength === 'number' ? options.surfaceWarpStrength : 0.04,
      sunspotSoftness: typeof options.sunspotSoftness === 'number' ? options.sunspotSoftness : 0.1,
      sunspotJitter: typeof options.sunspotJitter === 'number' ? options.sunspotJitter : 0.2,
      sunspotDetailMix: typeof options.sunspotDetailMix === 'number' ? options.sunspotDetailMix : 0.55,
      sunspotSwirlStrength: typeof options.sunspotSwirlStrength === 'number' ? options.sunspotSwirlStrength : 0.35,
      coronaIntensity: typeof options.coronaIntensity === 'number' ? options.coronaIntensity : 0.65,
      coronaWobbleSpeed: typeof options.coronaWobbleSpeed === 'number' ? options.coronaWobbleSpeed : 0.08,
      animationSpeedMain: typeof options.animationSpeedMain === 'number' ? options.animationSpeedMain : 0.015,
      animationSpeedSecondary: typeof options.animationSpeedSecondary === 'number' ? options.animationSpeedSecondary : 0.01,
      noiseScaleTertiary: typeof options.noiseScaleTertiary === 'number' ? options.noiseScaleTertiary : 3.5,
      heatDistortionStrength: typeof options.heatDistortionStrength === 'number'
        ? options.heatDistortionStrength
        : typeof options.surfaceWarpStrength === 'number'
          ? options.surfaceWarpStrength * 0.5
          : 0.02,
      coreInnerColor: options.coreInnerColor || '#fff7d6',
      coreOuterColor: options.coreOuterColor || '#ff7b32',
      coreFalloff: typeof options.coreFalloff === 'number' ? options.coreFalloff : 1.2,
      // Limb darkening settings control how dramatically the surface fades near the edge.
      limbDarkeningStrength: typeof options.limbDarkeningStrength === 'number' ? options.limbDarkeningStrength : 0.35,
      limbDarkeningExponent: typeof options.limbDarkeningExponent === 'number' ? options.limbDarkeningExponent : 1.6,
    };

    // Precompute canvases for the sun surface so the render loop only blits textures.
    // Keep the procedural surface texture crisp without rendering excessive texels on mobile GPUs.
    this.surfaceTextureSize = 160;
    if (typeof document !== 'undefined') {
      this.surfaceCanvas = document.createElement('canvas');
      this.surfaceCanvas.width = this.surfaceTextureSize;
      this.surfaceCanvas.height = this.surfaceTextureSize;
      this.surfaceCtx = this.surfaceCanvas.getContext('2d', { willReadFrequently: true });
      this.surfaceImageData = this.surfaceCtx?.createImageData(this.surfaceTextureSize, this.surfaceTextureSize) || null;
    } else {
      this.surfaceCanvas = null;
      this.surfaceCtx = null;
      this.surfaceImageData = null;
    }

    // Deterministic RNG
    this.rng = new SeededRandom(options.seed || Date.now());
    // Build tiled noise fields so animated sampling can avoid regenerating noise each frame.
    this.surfaceNoise = {
      primary: this.generateValueNoiseTexture(this.surfaceTextureSize, 32),
      secondary: this.generateValueNoiseTexture(this.surfaceTextureSize, 24),
      tertiary: this.generateValueNoiseTexture(this.surfaceTextureSize, 20),
      corona: this.generateValueNoiseTexture(this.surfaceTextureSize, 48),
      distortion: this.generateValueNoiseTexture(this.surfaceTextureSize, 40),
    };

    // Track UV offsets for animated noise layers so we only adjust sampling coordinates over time.
    this.surfaceAnimationState = {
      primaryOffsetX: 0,
      primaryOffsetY: 0,
      secondaryOffsetX: 0,
      secondaryOffsetY: 0,
      tertiaryOffsetX: 0,
      tertiaryOffsetY: 0,
      time: 0,
    };

    // Flag to rebuild the cached surface texture whenever animation advances.
    this.surfaceTextureDirty = true;
    
    // Statistics tracking
    this.stats = {
      totalAbsorptions: 0,
      totalMassGained: 0,
      lastAbsorptionTime: 0,
      absorptionsPerMinute: 0,
      massInflowPerMinute: 0,
      absorptionHistory: [], // For sparkline
      massHistory: [], // For sparkline
      historyMaxLength: 60, // Keep last 60 samples
    };

    // Performance tracking optimization - cache sum to avoid reduce() on every frame
    // Initialized to 0 since frameTimeSamples starts empty
    this.frameTimeSamplesSum = 0;
    
    // Animation state
    this.running = false;
    this.lastFrame = 0;
    this.loopHandle = null;
    this.elapsedTime = 0;

    // Shooting star events bring bonus mass into the simulation at long intervals.
    this.shootingStars = [];
    this.shootingStarTrailLength = 60; // Extend streak memory so shooting stars leave long ribbons across the canvas.
    this.nextShootingStarTime = 0; // Seconds timestamp for next shooting star spawn

    // Track pending mass contributions from off-cycle events (shooting stars).
    this.pendingAbsorptions = 0;
    this.pendingMassGain = 0;

    // Schedule the first shooting star once RNG is available.
    this.scheduleNextShootingStar();
    
    // Initialize if canvas is provided
    if (this.canvas) {
      this.resize();
    }
  }

  /**
   * Determine whether the global graphics preference forces a low-complexity render path.
   */
  isLowGraphicsModeEnabled() {
    if (typeof this.lowGraphicsModeResolver === 'function') {
      try {
        return Boolean(this.lowGraphicsModeResolver());
      } catch (error) {
        console.warn('Lamed simulation failed to query graphics preference; falling back to last known value.', error);
      }
    }
    return Boolean(this.lowGraphicsMode);
  }

  /**
   * Resolve an effective device pixel ratio capped to protect mobile GPUs from excessive overdraw.
   * @returns {number} Clamped device pixel ratio used for canvas sizing and coordinate math
   */
  getEffectiveDevicePixelRatio() {
    return getEffectiveDevicePixelRatio(this.maxDevicePixelRatio);
  }

  /**
   * Resolve how orbiting star trails should be rendered based on population and graphics settings.
   */
  resolveTrailRenderSettings(starCount = this.stars.length) {
    const performanceLimited = this.performanceMode === 'reduced';
    const lowGraphicsActive = this.isLowGraphicsModeEnabled();
    if (performanceLimited || lowGraphicsActive || starCount > this.trailComplexityThresholds.disable) {
      return {
        mode: 'simple',
        maxLength: this.simpleTrailLength,
        fadeRate: this.simpleTrailFadeRate,
      };
    }
    if (starCount > this.trailComplexityThresholds.simplify) {
      return {
        mode: 'simple',
        maxLength: this.simpleTrailLength,
        fadeRate: this.simpleTrailFadeRate,
      };
    }
    return {
      mode: 'full',
      maxLength: this.baseTrailLength,
      fadeRate: this.baseTrailFadeRate,
    };
  }

  /**
   * Track frame pacing and toggle lighter rendering paths when the average delta climbs.
   * @param {number} deltaTimeMs - Elapsed milliseconds since last frame
   */
  trackPerformanceSample(deltaTimeMs) {
    if (!Number.isFinite(deltaTimeMs)) {
      return;
    }

    // Optimization: Maintain running sum instead of using reduce() every frame
    this.frameTimeSamplesSum += deltaTimeMs;
    this.frameTimeSamples.push(deltaTimeMs);
    if (this.frameTimeSamples.length > this.frameSampleLimit) {
      const removed = this.frameTimeSamples.shift();
      this.frameTimeSamplesSum -= removed;
    }

    const average = this.frameTimeSamplesSum / Math.max(1, this.frameTimeSamples.length);

    if (average > this.performanceThresholds.degradeMs && this.performanceMode !== 'reduced') {
      this.applyPerformanceMode('reduced');
    } else if (average < this.performanceThresholds.recoverMs && this.performanceMode !== 'balanced') {
      this.applyPerformanceMode('balanced');
    }
  }

  /**
   * Apply or restore render-friendly caps based on recent performance measurements.
   * @param {'balanced'|'reduced'} mode - Target performance profile
   */
  applyPerformanceMode(mode) {
    if (this.performanceMode === mode) {
      return;
    }

    this.performanceMode = mode;
    if (mode === 'reduced') {
      this.maxDevicePixelRatio = this.performanceCaps.reducedDevicePixelRatio;
      this.maxStarsWithTrails = this.performanceCaps.reducedTrailCount;
      this.maxStars = this.performanceCaps.reducedStarCount;
      this.performanceDustCap = this.performanceCaps.reducedDustCap;
      this.activeTrailSettings = {
        mode: 'simple',
        maxLength: this.simpleTrailLength,
        fadeRate: this.simpleTrailFadeRate,
      };
      const overflow = Math.max(0, this.stars.length - this.maxStars);
      for (let i = 0; i < overflow; i++) {
        const star = this.stars.pop();
        if (star) {
          this.absorbStarImmediately(star.mass);
        }
      }
      this.trailEnabledStarCount = Math.min(this.trailEnabledStarCount, this.maxStarsWithTrails);
    } else {
      this.maxDevicePixelRatio = this.initialCaps.devicePixelRatio;
      this.maxStarsWithTrails = this.initialCaps.trailCount;
      this.maxStars = this.initialCaps.starCount;
      this.performanceDustCap = MAX_DUST_PARTICLES;
      this.activeTrailSettings = null;
    }

    // Rescale the canvas so the new DPR cap applies immediately.
    this.resize();
  }

  /**
   * Update the star render cap while syncing performance thresholds and trimming overflow.
   * @param {number} targetMaxStars - Desired star render cap from UI preferences.
   */
  setStarRenderCap(targetMaxStars) {
    // Clamp the incoming cap so gameplay respects the slider boundaries.
    const clampedMaxStars = Math.max(
      MIN_RENDERED_STARS,
      Math.min(MAX_RENDERED_STARS, Math.floor(Number(targetMaxStars) || MIN_RENDERED_STARS)),
    );
    // Store the base cap so balanced mode restores the desired density.
    this.initialCaps.starCount = clampedMaxStars;
    // Recalculate reduced caps so performance mode stays proportional to the chosen density.
    this.performanceCaps.reducedStarCount = Math.min(clampedMaxStars, resolveReducedStarCap(clampedMaxStars));
    // Apply the active cap based on the current performance profile.
    this.maxStars = this.performanceMode === 'reduced'
      ? this.performanceCaps.reducedStarCount
      : clampedMaxStars;
    // Trim any overflow so the live star list matches the new cap immediately.
    const overflow = Math.max(0, this.stars.length - this.maxStars);
    for (let i = 0; i < overflow; i++) {
      const star = this.stars.pop();
      if (star) {
        this.absorbStarImmediately(star.mass);
      }
    }
    // Keep the trail budget aligned with the updated max population.
    this.trailEnabledStarCount = Math.min(this.trailEnabledStarCount, this.maxStarsWithTrails);
  }

  /**
   * Resolve the current dust cap after factoring in adaptive performance limits.
   * @returns {number} Maximum decorative dust particles allowed
   */
  resolveDustCap() {
    const reducedCap = Math.max(0, this.performanceDustCap);
    return this.performanceMode === 'reduced' ? reducedCap : MAX_DUST_PARTICLES;
  }

  /**
   * Resize the simulation to match canvas dimensions
   */
  resize() {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const dpr = this.getEffectiveDevicePixelRatio();
    
    this.width = Math.floor(rect.width * dpr);
    this.height = Math.floor(rect.height * dpr);
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.centerX = this.width / 2;
    this.centerY = this.height / 2;

    if (this.ctx) {
      // Reset transforms so repeated resize calls do not accumulate DPR scaling.
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
    }
    
    // Reinitialize asteroids whenever canvas dimensions change to ensure correct positioning.
    // Asteroid orbits are calculated based on canvas size, so they must be recreated on resize.
    this.initializeAsteroids();
  }
  
  /**
   * Load all sprite images for the lamed spire.
   */
  loadSprites() {
    const basePath = './assets/sprites/spires/lamedSpire/';
    
    // Load star sprite
    this.sprites.star = new Image();
    this.sprites.star.src = `${basePath}stars/star1.png`;
    
    // Load star sprite without glow (for shooting stars)
    this.sprites.starNoGlow = new Image();
    this.sprites.starNoGlow.src = `${basePath}stars/star1NoGlow.png`;
    
    // Load 5 asteroid sprites
    const asteroidFiles = ['asteroid1.png', 'asteroid2.png', 'asteroid3.png', 'asteroid4.png', 'asteroid5.png'];
    for (const filename of asteroidFiles) {
      const img = new Image();
      img.src = `${basePath}asteroids/${filename}`;
      this.sprites.asteroids.push(img);
    }
    
    // Load 8 sun phase sprites (PNG version only)
    for (let i = 1; i <= 8; i++) {
      const img = new Image();
      img.src = `${basePath}sunPhases/sunPhase${i}.png`;
      this.sprites.sunPhases.push(img);
    }
    
    // Load space dust sprite
    this.sprites.spaceDust = new Image();
    this.sprites.spaceDust.src = `${basePath}dust/spaceDust.png`;
    
    // Mark sprites as loaded once all images are loaded
    const allSprites = [
      this.sprites.star,
      this.sprites.starNoGlow,
      ...this.sprites.asteroids,
      ...this.sprites.sunPhases,
      this.sprites.spaceDust,
    ];
    
    let loadedCount = 0;
    allSprites.forEach(sprite => {
      sprite.onload = () => {
        loadedCount++;
        if (loadedCount === allSprites.length) {
          this.spritesLoaded = true;
        }
      };
      sprite.onerror = () => {
        console.warn(`Failed to load sprite: ${sprite.src}`);
        loadedCount++;
        if (loadedCount === allSprites.length) {
          this.spritesLoaded = true;
        }
      };
    });
  }
  
  /**
   * Initialize 5 asteroids at random orbital distances.
   * Asteroids face upward in their sprites and should rotate to face the sun.
   * Each asteroid maintains its fixed orbit distance.
   * 
   * Note: This method requires this.rng to be initialized and valid canvas dimensions.
   */
  initializeAsteroids() {
    // Ensure RNG is available before initializing asteroids
    if (!this.rng) {
      return;
    }
    
    this.asteroids = [];
    const dpr = this.getEffectiveDevicePixelRatio();
    
    // Calculate safe orbital range for asteroids
    const starVisualRadius = this.calculateCoreRadius();
    const maxR = this.calculateMaxSpawnRadiusCss();
    
    // Asteroids orbit between 2.5x sun radius and 0.8x max radius (not too close, not at edge)
    const minR = Math.min(maxR * 0.3, starVisualRadius * 2.5);
    const maxAsteroidR = maxR * 0.8;
    
    for (let i = 0; i < 5; i++) {
      const orbitRadiusCss = this.rng.range(minR, maxAsteroidR);
      const orbitRadiusDevice = orbitRadiusCss * dpr;
      const angle = this.rng.next() * Math.PI * 2;
      
      const x = this.centerX + Math.cos(angle) * orbitRadiusDevice;
      const y = this.centerY + Math.sin(angle) * orbitRadiusDevice;
      
      // Calculate circular orbital velocity for stable orbit
      const circularSpeed = Math.sqrt((this.G * this.starMass) / Math.max(orbitRadiusDevice, this.epsilon));
      
      // Tangential velocity (perpendicular to radius)
      const vx = -Math.sin(angle) * circularSpeed;
      const vy = Math.cos(angle) * circularSpeed;
      
      this.asteroids.push({
        x,
        y,
        vx,
        vy,
        spriteIndex: i % this.sprites.asteroids.length,
        size: this.rng.range(20, 40), // Random size for variety
        orbitRadius: orbitRadiusDevice, // Store the fixed orbit distance
        maxRenderDistance: maxAsteroidR * dpr, // Store max distance for opacity calculation
      });
    }
  }
  
  /**
   * Get current mass tier information based on central star mass.
   */
  getCurrentTier() {
    let tier = MASS_TIERS[0];
    let nextTier = MASS_TIERS[1] || null;
    let tierIndex = 0;

    for (let i = 0; i < MASS_TIERS.length; i++) {
      if (this.starMass >= MASS_TIERS[i].threshold) {
        tier = MASS_TIERS[i];
        nextTier = MASS_TIERS[i + 1] || null;
        tierIndex = i;
      } else {
        break;
      }
    }
    
    // Calculate progress to next tier (0 to 1)
    let progress = 0;
    if (nextTier) {
      const currentThreshold = tier.threshold;
      const nextThreshold = nextTier.threshold;
      progress = Math.min(1, (this.starMass - currentThreshold) / (nextThreshold - currentThreshold));
    }

    return { tier, nextTier, progress, tierIndex };
  }

  /**
   * Calculate the current visual radius of the sun so rendering and reactions stay in sync.
   * @returns {number} Radius of the core body in pixels
   */
  calculateCoreRadius() {
    const dpr = this.getEffectiveDevicePixelRatio();
    const cssWidth = this.cssWidth || (this.width / dpr) || 0;
    const diameterPx = cssWidth * (this.coreSizeState?.percent || TIER_DIAMETER_PERCENTAGES[0]);
    // Safeguard against extremely small radii so the core remains visible even on narrow screens.
    return Math.max(2, diameterPx / 2);
  }

  /**
   * Measure the farthest visible point so spawns can reach the canvas corners.
   * @returns {number} Maximum spawn radius in CSS pixels extending to the viewport corners
   */
  calculateMaxSpawnRadiusCss() {
    const dpr = this.getEffectiveDevicePixelRatio();
    const cssWidth = this.cssWidth || (this.width / dpr) || 0;
    const cssHeight = this.cssHeight || (this.height / dpr) || 0;
    const halfWidth = cssWidth / 2;
    const halfHeight = cssHeight / 2;

    return Math.sqrt(halfWidth * halfWidth + halfHeight * halfHeight);
  }

  /**
   * Calculate a star's rendered radius and enforce a viewport-aware minimum so sparks stay visible.
   * @param {number} starMass - Mass of the orbiting star
   * @param {number} coreRadiusCss - Current core radius in CSS pixels
   * @returns {number} Radius in CSS pixels respecting the minimum size rule
   */
  calculateStarRadiusCss(starMass, coreRadiusCss = this.calculateCoreRadius()) {
    const dpr = this.getEffectiveDevicePixelRatio();
    const cssWidth = this.cssWidth || (this.width / dpr) || 0;
    const minimumRadius = Math.max(1, cssWidth / 900);
    const normalizedMass = Math.max(0, Number.isFinite(starMass) ? starMass : 0);
    // Apply size multiplier to make stars more visible relative to the sun
    const massRatio = (normalizedMass / Math.max(this.starMass, 1e-6)) * STAR_SIZE_MULTIPLIER;
    return Math.max(minimumRadius, coreRadiusCss * massRatio);
  }

  /**
   * Advance the responsive diameter so stage progress smoothly grows the sun.
   * @param {number} dt - Delta time in seconds
   */
  updateCoreSizeState(dt) { return lamedPhysicsUpdateCoreSizeState.call(this, dt); }

  /**
   * Convert a world position into a palette blend factor for dust coloring.
   * @param {number} x - X coordinate in canvas space
   * @param {number} y - Y coordinate in canvas space
   * @returns {number} Blend between 0 (core) and 1 (edge) for palette sampling
   */
  calculateDustRadialBlend(x, y) {
    const dpr = this.getEffectiveDevicePixelRatio();
    const dx = (x - this.centerX) / dpr;
    const dy = (y - this.centerY) / dpr;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const starVisualRadius = this.calculateCoreRadius();
    const maxRadius = Math.min(this.width, this.height) / (2 * dpr);
    const normalized = (distance - starVisualRadius) / Math.max(1, maxRadius - starVisualRadius);

    return Math.min(1, Math.max(0, normalized));
  }

  /**
   * Apply a bounce impulse so the sun briefly swells when material impacts it.
   * @param {number} fractionalIncrease - Desired temporary radius increase expressed as a scale fraction
   */
  applySunBounceImpulse(fractionalIncrease = 0.01) {
    const clampedIncrease = Math.max(0, fractionalIncrease);

    // Add to the displacement while capping so chained absorptions stay subtle.
    this.sunBounce.offset = Math.min(this.sunBounce.offset + clampedIncrease, 0.12);

    // Kick the velocity forward so the spring actually oscillates instead of easing silently.
    this.sunBounce.velocity += clampedIncrease * 6;
  }

  /**
   * Convert a CSS hex color into RGB components so shader-like math stays numeric.
   * @param {string} hex - Hexadecimal color string (#rrggbb)
   * @returns {{r:number,g:number,b:number}} Parsed color components
   */
  static parseHexColor(hex) {
    const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
    const value = normalized.padEnd(6, 'f');
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }

  /**
   * Convert HSL inputs into an RGB payload so gem-driven stars inherit accurate hues.
   * @param {number} h - Hue in degrees.
   * @param {number} s - Saturation as a fraction (0-1).
   * @param {number} l - Lightness as a fraction (0-1).
   * @returns {{r:number,g:number,b:number}} RGB triplet.
   */
  static hslToRgbColor(h, s, l) {
    const hueToRgb = (p, q, t) => {
      let temp = t;
      if (temp < 0) temp += 1;
      if (temp > 1) temp -= 1;
      if (temp < 1 / 6) return p + (q - p) * 6 * temp;
      if (temp < 1 / 2) return q;
      if (temp < 2 / 3) return p + (q - p) * (2 / 3 - temp) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = Math.round(hueToRgb(p, q, h + 1 / 3) * 255);
    const g = Math.round(hueToRgb(p, q, h) * 255);
    const b = Math.round(hueToRgb(p, q, h - 1 / 3) * 255);
    return { r, g, b };
  }

  /**
   * Normalize gem palette input into an RGB color payload.
   * @param {Object|string} color - Raw gem color definition.
   * @returns {{r:number,g:number,b:number}|null} RGB payload when resolvable.
   */
  static normalizeGemColor(color) {
    if (!color) {
      return null;
    }
    if (typeof color === 'object') {
      if (Number.isFinite(color.r) && Number.isFinite(color.g) && Number.isFinite(color.b)) {
        return {
          r: Math.max(0, Math.min(255, color.r)),
          g: Math.max(0, Math.min(255, color.g)),
          b: Math.max(0, Math.min(255, color.b)),
        };
      }
      if (
        Number.isFinite(color.hue) &&
        Number.isFinite(color.saturation) &&
        Number.isFinite(color.lightness)
      ) {
        return GravitySimulation.hslToRgbColor(
          ((color.hue % 360) + 360) % 360 / 360,
          Math.max(0, Math.min(1, color.saturation / 100)),
          Math.max(0, Math.min(1, color.lightness / 100)),
        );
      }
    }
    return null;
  }

  /**
   * Generate seamless value noise so surface sampling can animate without flicker.
   * @param {number} size - Resolution of the texture square
   * @param {number} cellSize - Size of the interpolation cell controlling frequency
   * @returns {{size:number,data:Float32Array}} Value noise texture data
   */
  generateValueNoiseTexture(size, cellSize) { return lamedPhysicsGenerateValueNoiseTexture.call(this, size, cellSize); }

  /**
   * Sample tiled value noise with wrap-around so UV offsets can scroll smoothly forever.
   * @param {{size:number,data:Float32Array}} texture - Noise texture data to sample
   * @param {number} u - Horizontal coordinate (0-1 range, unbounded)
   * @param {number} v - Vertical coordinate (0-1 range, unbounded)
   * @param {number} scale - Frequency multiplier to control detail density
   * @returns {number} Noise value between 0 and 1
   */
  sampleNoise(texture, u, v, scale) { return lamedPhysicsSampleNoise.call(this, texture, u, v, scale); }

  /**
   * Simple helper to clamp a numeric value.
   * @param {number} value - Input value
   * @param {number} min - Minimum allowed
   * @param {number} max - Maximum allowed
   * @returns {number} Clamped value
   */
  static clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Linearly interpolate between two values.
   * @param {number} a - Start value
   * @param {number} b - End value
   * @param {number} t - Interpolation factor (0-1)
   * @returns {number} Interpolated value
   */
  static lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Advance UV offsets so the precomputed noise scrolls slowly across the star surface.
   * @param {number} dt - Delta time in seconds
   */
  updateSurfaceAnimation(dt) { return lamedPhysicsUpdateSurfaceAnimation.call(this, dt); }

  /**
   * Rebuild the cached sun surface texture so the main render only performs a single drawImage call.
   * @param {{r:number,g:number,b:number}} tierColor - Tier tint to blend into the plasma surface
   * @param {number} luminosity - Scalar controlling overall brightness
   * @param {number} absorptionGlowBoost - Recent absorption boost for highlights
   */
  rebuildSunSurfaceTexture(tierColor, luminosity, absorptionGlowBoost) { return lamedPhysicsRebuildSunSurfaceTexture.call(this, tierColor, luminosity, absorptionGlowBoost); }

  /**
   * Render the shimmering corona with a noise-driven wobble to keep the rim lively.
   * @param {CanvasRenderingContext2D} ctx - Rendering context
   * @param {number} centerX - Horizontal centre of the star
   * @param {number} centerY - Vertical centre of the star
   * @param {number} starVisualRadius - Base radius of the star core
   * @param {{r:number,g:number,b:number}} tierColor - Tier tint for halo colouring
   * @param {number} luminosity - Glow multiplier derived from tier progress
   */
  /**
   * Update the spring simulation that drives the bounce animation.
   * @param {number} dt - Delta time in seconds
   */
  updateSunBounce(dt) { return lamedPhysicsUpdateSunBounce.call(this, dt); }

  /**
   * Schedule the next time a shooting star should appear.
   */
  scheduleNextShootingStar() { return lamedPhysicsScheduleNextShootingStar.call(this); }

  /**
   * Spawn a shooting star just outside the simulation bounds.
   */
  spawnShootingStar() { return lamedPhysicsSpawnShootingStar.call(this); }

  /**
   * Apply a star's mass directly to the sun when the render cap is hit so late spawns still matter.
   * @param {number} massGain - Mass to funnel directly into the core
   */
  absorbStarImmediately(massGain) { return lamedPhysicsAbsorbStarImmediately.call(this, massGain); }

  /**
   * Spawn a new star near the click/tap position with slight variation.
   * If no click position is available, spawn randomly as fallback.
   * Uses near-circular orbital velocity.
   */
  spawnStar(options = {}) { return lamedPhysicsSpawnStar.call(this, options); }

  /**
   * Spawn multiple stars for catch-up after idle time.
   * This is used when the player returns from being idle to "fast forward" the simulation.
   * 
   * @param {number} starCount - Number of stars to spawn
   * @returns {number} Number of stars actually spawned
   */
  spawnMultipleStars(starCount) { return lamedPhysicsSpawnMultipleStars.call(this, starCount); }

  /**
   * Spawn dust particles for accretion disk visualization.
   * Particles spawn randomly between the central body edge and simulation edge.
   */
  spawnDustParticles(deltaTime) { return lamedPhysicsSpawnDustParticles.call(this, deltaTime); }

  /**
   * Spawn a geyser particle burst at the sun's surface for high-tier absorptions.
   * @param {number} impactAngle - Angle (radians) describing where the incoming star arrived from
   * @param {number} massGain - Mass contributed by the absorbed star (used to scale burst strength)
   * @param {{color:string}} tier - Current tier descriptor for tinting
   */
  spawnGeyserBurst(impactAngle, massGain, tier, contactPointCss, starRadiusCss, sunRadiusCss) { return lamedPhysicsSpawnGeyserBurst.call(this, impactAngle, massGain, tier, contactPointCss, starRadiusCss, sunRadiusCss); }
  
  /**
   * Update dust particles.
   */
  updateDustParticles(deltaTime) { return lamedPhysicsUpdateDustParticles.call(this, deltaTime); }

  /**
   * Update shooting stars and resolve their interactions.
   */
  updateShootingStars(deltaTime) { return lamedPhysicsUpdateShootingStars.call(this, deltaTime); }

  /**
   * Update physics for all orbiting stars.
   */
  updateStars(deltaTime) { return lamedPhysicsUpdateStars.call(this, deltaTime); }
  
  /**
   * Update asteroids - they orbit the sun and collide with stars.
   * Asteroids maintain their fixed orbit distance from the sun.
   */
  updateAsteroids(deltaTime) { return lamedPhysicsUpdateAsteroids.call(this, deltaTime); }
  
  /**
   * Update visual effects (shock rings, flash effects).
   */
  updateEffects(deltaTime) { return lamedPhysicsUpdateEffects.call(this, deltaTime); }

  /**
   * Render geyser particles with additive blending for luminous bursts.
   * @param {CanvasRenderingContext2D} ctx - Drawing context
   */
  renderGeyserParticles(ctx, centerX, centerY, occlusionRadius) { return lamedRenderGeyserParticles.call(this, ctx, centerX, centerY, occlusionRadius); }

  /**
   * Update geyser particle kinematics and fade-out.
   * @param {number} dt - Delta time in seconds
   */
  updateGeyserParticles(dt) { return lamedPhysicsUpdateGeyserParticles.call(this, dt); }
  
  /**
   * Render the simulation with all visual effects.
   */
  render() { return lamedRenderSimulation.call(this); }
  
  /**
   * Main animation loop step
   */
  step(timestamp) {
    if (!this.running) return;
    
    if (!this.lastFrame) {
      this.lastFrame = timestamp;
    }
    
    const MAX_FRAME_DELTA_MS = 100; // Prevent physics instability on frame drops
    const deltaTime = Math.min(timestamp - this.lastFrame, MAX_FRAME_DELTA_MS);
    this.lastFrame = timestamp;

    // Measure frame pacing so the renderer can shed work during spikes.
    this.trackPerformanceSample(deltaTime);

    // Update elapsed time for statistics
    const deltaSeconds = deltaTime / 1000;
    this.elapsedTime += deltaSeconds;

    // Refresh the responsive sun diameter before physics rely on the latest radius.
    this.updateCoreSizeState(deltaSeconds);

    // Update all simulation components
    this.updateShootingStars(deltaTime);
    this.updateStars(deltaTime);
    this.updateAsteroids(deltaTime);
    this.spawnDustParticles(deltaTime);
    this.updateDustParticles(deltaTime);
    this.updateEffects(deltaTime);
    this.render();
    
    this.loopHandle = requestAnimationFrame((ts) => this.step(ts));
  }
  
  /**
   * Start the simulation
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = 0;
    this.loopHandle = requestAnimationFrame((ts) => this.step(ts));
  }
  
  /**
   * Stop the simulation
   */
  stop() {
    this.running = false;
    if (this.loopHandle) {
      cancelAnimationFrame(this.loopHandle);
      this.loopHandle = null;
    }
  }
  
  /**
   * Set the star spawn rate
   */
  setSparkSpawnRate(rate) {
    this.sparkSpawnRate = Math.max(0, rate);
  }
  
  /**
   * Set the last click position for star spawning.
   * @param {number} x - X coordinate in CSS pixels
   * @param {number} y - Y coordinate in CSS pixels
   */
  setClickPosition(x, y) {
    this.lastClickPosition = { x, y };
  }
  
  /**
   * Calculate the cost to upgrade drag to the next level.
   * Cost starts at 10 sparks and increases by 10x each level.
   * @returns {number} Cost in sparks
   */
  getDragUpgradeCost() {
    return 10 * Math.pow(10, this.dragLevel);
  }
  
  /**
   * Check if drag can be upgraded.
   * @returns {boolean}
   */
  canUpgradeDrag() {
    return this.dragLevel < this.maxDragLevel;
  }
  
  /**
   * Upgrade the drag coefficient (k parameter).
   * Increases k by 0.002 per upgrade level (starting at 0.002).
   * @returns {boolean} True if upgrade succeeded
   */
  upgradeDrag() {
    if (!this.canUpgradeDrag()) {
      return false;
    }
    
    this.dragLevel++;
    this.dragCoefficient = 0.002 + this.dragLevel * 0.002;
    
    return true;
  }
  
  /**
   * Calculate the cost to upgrade star mass to the next level.
   * @returns {number} Cost in sparks
   */
  getStarMassUpgradeCost() {
    return 5 * Math.pow(2, this.upgrades.starMass);
  }
  
  /**
   * Check if star mass can be upgraded.
   * @returns {boolean}
   */
  canUpgradeStarMass() {
    return true; // Always upgradeable now that sparkBank is removed
  }
  
  /**
   * Upgrade the mass of orbiting stars.
   * Increases the baseline mass of placed sparks by +1 per tier.
   * @returns {boolean} True if upgrade succeeded
   */
  upgradeStarMass() {
    if (!this.canUpgradeStarMass()) {
      return false;
    }
    
    this.upgrades.starMass++;
    
    return true;
  }
  
  /**
   * Get statistics for UI display.
   */
  getStatistics() {
    const { tier, nextTier, progress } = this.getCurrentTier();
    
    return {
      starMass: this.starMass,
      currentTier: tier.name,
      nextTier: nextTier ? nextTier.name : 'MAX',
      progressToNext: progress,
      orbitingStars: this.stars.length,
      absorptionsPerMinute: this.stats.absorptionsPerMinute,
      massInflowPerMinute: this.stats.massInflowPerMinute,
      totalAbsorptions: this.stats.totalAbsorptions,
      dragLevel: this.dragLevel,
      dragCoefficient: this.dragCoefficient,
      // Surface orbiting spark upgrade data so the UI can render it live.
      starMassUpgradeLevel: this.upgrades.starMass,
      orbitingSparkMass: 1 + this.upgrades.starMass,
      nextMilestone: nextTier ? nextTier.threshold : this.starMass,
    };
  }

  /**
   * Get current state for serialization
   */
  getState() {
    const { tierIndex } = this.getCurrentTier();
    return {
      starMass: this.starMass,
      dragLevel: this.dragLevel,
      dragCoefficient: this.dragCoefficient,
      upgrades: {
        starMass: this.upgrades.starMass,
      },
      stats: {
        totalAbsorptions: this.stats.totalAbsorptions,
        totalMassGained: this.stats.totalMassGained,
        // Star milestone (tier) reached - 1 glyph per milestone
        starMilestoneReached: tierIndex + 1,
      },
    };
  }

  /**
   * Capture a full simulation snapshot so the gravity well can resume after tab switches or reloads.
   * @returns {Object} Plain snapshot containing particle positions, timers, and visual queues.
   */
  exportSnapshot() {
    return {
      ...this.getState(),
      sparkSpawnRate: this.sparkSpawnRate,
      spawnAccumulator: this.spawnAccumulator,
      trailEnabledStarCount: this.trailEnabledStarCount,
      pendingAbsorptions: this.pendingAbsorptions,
      pendingMassGain: this.pendingMassGain,
      sunBounce: { ...this.sunBounce },
      coreSizeState: { ...this.coreSizeState },
      stars: this.stars.map((star) => ({
        x: star.x,
        y: star.y,
        vx: star.vx,
        vy: star.vy,
        mass: star.mass,
        hasTrail: Boolean(star.hasTrail),
        life: star.life,
        trail: Array.isArray(star.trail)
          ? star.trail.map((point) => ({ x: point.x, y: point.y, alpha: point.alpha, speed: point.speed }))
          : [],
      })),
      shootingStars: this.shootingStars.map((star) => ({
        x: star.x,
        y: star.y,
        vx: star.vx,
        vy: star.vy,
        mass: star.mass,
        color: star.color,
        trail: Array.isArray(star.trail)
          ? star.trail.map((point) => ({ x: point.x, y: point.y, alpha: point.alpha }))
          : [],
      })),
      dustParticles: this.dustParticles.map((dust) => ({
        x: dust.x,
        y: dust.y,
        vx: dust.vx,
        vy: dust.vy,
        alpha: dust.alpha,
      })),
      shockRings: this.shockRings.map((ring) => ({
        x: ring.x,
        y: ring.y,
        radius: ring.radius,
        thickness: ring.thickness,
        alpha: ring.alpha,
      })),
      flashEffects: this.flashEffects.map((flash) => ({
        x: flash.x,
        y: flash.y,
        radius: flash.radius,
        maxRadius: flash.maxRadius,
        alpha: flash.alpha,
        duration: flash.duration,
        elapsed: flash.elapsed,
      })),
      geyserParticles: this.geyserParticles.map((particle) => ({
        x: particle.x,
        y: particle.y,
        vx: particle.vx,
        vy: particle.vy,
        lifetime: particle.lifetime,
        age: particle.age,
        startSize: particle.startSize,
        size: particle.size,
        color: particle.color,
        flashPhase: particle.flashPhase,
        alpha: particle.alpha,
        flashProgress: particle.flashProgress,
        occlusionRadius: particle.occlusionRadius,
      })),
    };
  }

  /**
   * Restore the simulation from a captured snapshot.
   * @param {Object} snapshot - Serialized state captured by exportSnapshot.
   */
  importSnapshot(snapshot = {}) {
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }

    this.setState(snapshot);
    this.sparkSpawnRate = Number.isFinite(snapshot.sparkSpawnRate)
      ? Math.max(0, snapshot.sparkSpawnRate)
      : this.sparkSpawnRate;
    this.spawnAccumulator = Number.isFinite(snapshot.spawnAccumulator)
      ? Math.max(0, snapshot.spawnAccumulator)
      : this.spawnAccumulator;
    this.pendingAbsorptions = Number.isFinite(snapshot.pendingAbsorptions)
      ? Math.max(0, snapshot.pendingAbsorptions)
      : 0;
    this.pendingMassGain = Number.isFinite(snapshot.pendingMassGain) ? Math.max(0, snapshot.pendingMassGain) : 0;
    if (snapshot.sunBounce && typeof snapshot.sunBounce === 'object') {
      this.sunBounce = {
        offset: Number.isFinite(snapshot.sunBounce.offset) ? snapshot.sunBounce.offset : this.sunBounce.offset,
        velocity: Number.isFinite(snapshot.sunBounce.velocity) ? snapshot.sunBounce.velocity : this.sunBounce.velocity,
      };
    }
    if (snapshot.coreSizeState && typeof snapshot.coreSizeState === 'object') {
      this.coreSizeState = {
        ...this.coreSizeState,
        ...snapshot.coreSizeState,
      };
    }

    this.stars = Array.isArray(snapshot.stars)
      ? snapshot.stars
        .filter((star) => Number.isFinite(star?.x) && Number.isFinite(star?.y))
        .map((star) => ({
          x: star.x,
          y: star.y,
          vx: Number.isFinite(star.vx) ? star.vx : 0,
          vy: Number.isFinite(star.vy) ? star.vy : 0,
          mass: Number.isFinite(star.mass) ? Math.max(0, star.mass) : 1,
          hasTrail: Boolean(star.hasTrail),
          life: Number.isFinite(star.life) ? star.life : 1,
          trail: Array.isArray(star.trail)
            ? star.trail
              .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
              .map((point) => ({
                x: point.x,
                y: point.y,
                alpha: Number.isFinite(point.alpha) ? point.alpha : 1,
                speed: Number.isFinite(point.speed) ? point.speed : undefined,
              }))
            : [],
        }))
      : [];
    this.trailEnabledStarCount = this.stars.filter((star) => star.hasTrail).length;

    this.shootingStars = Array.isArray(snapshot.shootingStars)
      ? snapshot.shootingStars
        .filter((star) => Number.isFinite(star?.x) && Number.isFinite(star?.y))
        .map((star) => ({
          x: star.x,
          y: star.y,
          vx: Number.isFinite(star.vx) ? star.vx : 0,
          vy: Number.isFinite(star.vy) ? star.vy : 0,
          mass: Number.isFinite(star.mass) ? Math.max(0, star.mass) : 1,
          color: star.color,
          trail: Array.isArray(star.trail)
            ? star.trail
              .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
              .map((point) => ({ x: point.x, y: point.y, alpha: Number.isFinite(point.alpha) ? point.alpha : 1 }))
            : [],
        }))
      : [];

    this.dustParticles = Array.isArray(snapshot.dustParticles)
      ? snapshot.dustParticles
        .filter((dust) => Number.isFinite(dust?.x) && Number.isFinite(dust?.y))
        .map((dust) => ({
          x: dust.x,
          y: dust.y,
          vx: Number.isFinite(dust.vx) ? dust.vx : 0,
          vy: Number.isFinite(dust.vy) ? dust.vy : 0,
          alpha: Number.isFinite(dust.alpha) ? dust.alpha : 1,
        }))
      : [];

    this.shockRings = Array.isArray(snapshot.shockRings)
      ? snapshot.shockRings
        .filter((ring) => Number.isFinite(ring?.x) && Number.isFinite(ring?.y))
        .map((ring) => ({
          x: ring.x,
          y: ring.y,
          radius: Number.isFinite(ring.radius) ? ring.radius : 0,
          thickness: Number.isFinite(ring.thickness) ? ring.thickness : 1,
          alpha: Number.isFinite(ring.alpha) ? ring.alpha : 1,
        }))
      : [];

    this.flashEffects = Array.isArray(snapshot.flashEffects)
      ? snapshot.flashEffects
        .filter((flash) => Number.isFinite(flash?.x) && Number.isFinite(flash?.y))
        .map((flash) => ({
          x: flash.x,
          y: flash.y,
          radius: Number.isFinite(flash.radius) ? flash.radius : 0,
          maxRadius: Number.isFinite(flash.maxRadius) ? flash.maxRadius : 0,
          alpha: Number.isFinite(flash.alpha) ? flash.alpha : 1,
          duration: Number.isFinite(flash.duration) ? flash.duration : 0,
          elapsed: Number.isFinite(flash.elapsed) ? flash.elapsed : 0,
        }))
      : [];

    this.geyserParticles = Array.isArray(snapshot.geyserParticles)
      ? snapshot.geyserParticles
        .filter((particle) => Number.isFinite(particle?.x) && Number.isFinite(particle?.y))
        .map((particle) => ({
          x: particle.x,
          y: particle.y,
          vx: Number.isFinite(particle.vx) ? particle.vx : 0,
          vy: Number.isFinite(particle.vy) ? particle.vy : 0,
          lifetime: Number.isFinite(particle.lifetime) ? particle.lifetime : 0,
          age: Number.isFinite(particle.age) ? particle.age : 0,
          startSize: Number.isFinite(particle.startSize) ? particle.startSize : 0,
          size: Number.isFinite(particle.size) ? particle.size : 0,
          color: particle.color,
          flashPhase: Number.isFinite(particle.flashPhase) ? particle.flashPhase : 0,
          alpha: Number.isFinite(particle.alpha) ? particle.alpha : 1,
          flashProgress: Number.isFinite(particle.flashProgress) ? particle.flashProgress : 0,
          occlusionRadius: Number.isFinite(particle.occlusionRadius) ? particle.occlusionRadius : 0,
        }))
      : [];

    // Refresh derived sizing state to keep rendering coherent after hydration.
    this.updateCoreSizeState(0);
  }

  /**
   * Restore state from serialized data
   */
  setState(state) {
    if (state && typeof state === 'object') {
      if (Number.isFinite(state.starMass)) {
        this.starMass = Math.max(0, state.starMass);
      }
      if (Number.isFinite(state.dragLevel)) {
        this.dragLevel = Math.max(0, Math.min(state.dragLevel, this.maxDragLevel));
        this.dragCoefficient = 0.002 + this.dragLevel * 0.002;
      }
      if (state.upgrades) {
        if (Number.isFinite(state.upgrades.starMass)) {
          this.upgrades.starMass = Math.max(0, state.upgrades.starMass);
        }
      }
      if (state.stats) {
        if (Number.isFinite(state.stats.totalAbsorptions)) {
          this.stats.totalAbsorptions = state.stats.totalAbsorptions;
        }
        if (Number.isFinite(state.stats.totalMassGained)) {
          this.stats.totalMassGained = state.stats.totalMassGained;
        }
      }
    }

    const refreshedTier = this.getCurrentTier();
    this.lastTierIndex = refreshedTier.tierIndex;
    const baselinePercent = TIER_DIAMETER_PERCENTAGES[refreshedTier.tierIndex] || TIER_DIAMETER_PERCENTAGES[0];
    this.coreSizeState.percent = baselinePercent;
    this.coreSizeState.transitionStartPercent = baselinePercent;
    this.coreSizeState.targetPercent = baselinePercent;
    this.coreSizeState.transitionElapsed = 0;
    this.coreSizeState.transitionDuration = 0;
    this.updateCoreSizeState(0);
  }
}
