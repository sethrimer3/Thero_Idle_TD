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
 * - Absorption shock rings
 * - Statistics tracking (mass inflow, absorptions)
 */

/**
 * Mass tier definitions for celestial body evolution.
 * Each tier has distinct visual properties.
 */
const MASS_TIERS = [
  { name: 'Proto-star', threshold: 10, color: '#FF6B6B', glow: 0.3 },
  { name: 'Main Sequence', threshold: 100, color: '#FFD93D', glow: 0.5 },
  { name: 'Blue Giant', threshold: 5000, color: '#6BCF7F', glow: 0.7 },
  { name: 'Red Giant', threshold: 10000, color: '#FF8B94', glow: 0.85 },
  { name: 'Supergiant', threshold: 50000, color: '#FFA07A', glow: 1.0 },
  { name: 'Neutron Star', threshold: 1000000, color: '#B19CD9', glow: 1.2 },
  { name: 'Black Hole', threshold: 10000000, color: '#2D2D2D', glow: 1.5 },
];

/**
 * Deterministic pseudo-random number generator using seed.
 */
class SeededRandom {
  constructor(seed = 12345) {
    this.seed = seed;
  }
  
  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  
  range(min, max) {
    return min + this.next() * (max - min);
  }
}

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
    this.onSparkBankChange = typeof options.onSparkBankChange === 'function' ? options.onSparkBankChange : null;
    this.onStarMassChange = typeof options.onStarMassChange === 'function' ? options.onStarMassChange : null;
    this.samplePaletteGradient = typeof options.samplePaletteGradient === 'function' ? options.samplePaletteGradient : null;
    
    // Dimensions
    this.width = 0;
    this.height = 0;
    this.centerX = 0;
    this.centerY = 0;
    
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
    this.sparkBank = 0; // Idle currency reserve that spawns stars into the simulation
    this.maxStars = 1000; // Maximum number of active orbiting stars increased for denser orbits
    this.sparkSpawnRate = 0; // Stars spawned per second (starts at 0)
    this.spawnAccumulator = 0;
    
    // Spawn parameters for ring spawner
    this.spawnRadiusMin = 60; // Minimum spawn radius (pixels)
    this.spawnRadiusMax = 120; // Maximum spawn radius (pixels)
    this.velocityNoiseFactor = 0.15; // Noise added to circular velocity
    
    // Trail rendering
    this.trailLength = 40; // Number of trail points to keep
    this.trailFadeRate = 0.025; // How quickly trails fade
    
    // Visual effects
    this.backgroundColor = '#000000'; // Black space
    this.shockRings = []; // Absorption shock rings
    this.dustParticles = []; // Accretion disk dust
    this.highGraphics = typeof options.highGraphics === 'boolean' ? options.highGraphics : false;
    this.desiredDustParticles = 200; // Maintain a fixed decorative ring of dust around the sun.
    this.maxDustParticles = this.desiredDustParticles; // Cap population so the simulation keeps exactly 200 grains.
    this.dustSpawnRate = this.desiredDustParticles; // Refill quickly when particles expire or are removed.
    this.dustAccumulator = 0;
    this.flashEffects = []; // Spawn flash effects

    // Track the spring-based bounce so the sun can wobble outward when it absorbs a star.
    this.sunBounce = { offset: 0, velocity: 0 };

    // Visual tuning controls for the sun surface so designers can fine-tune turbulence behaviour.
    this.sunSurfaceSettings = {
      sunspotThreshold: typeof options.sunspotThreshold === 'number' ? options.sunspotThreshold : 0.45,
      noiseScalePrimary: typeof options.noiseScalePrimary === 'number' ? options.noiseScalePrimary : 2.5,
      noiseScaleSecondary: typeof options.noiseScaleSecondary === 'number' ? options.noiseScaleSecondary : 6,
      spotDarkness: typeof options.spotDarkness === 'number' ? options.spotDarkness : 0.55,
      surfaceWarpStrength: typeof options.surfaceWarpStrength === 'number' ? options.surfaceWarpStrength : 0.04,
      coronaIntensity: typeof options.coronaIntensity === 'number' ? options.coronaIntensity : 0.65,
      coronaWobbleSpeed: typeof options.coronaWobbleSpeed === 'number' ? options.coronaWobbleSpeed : 0.08,
      animationSpeedMain: typeof options.animationSpeedMain === 'number' ? options.animationSpeedMain : 0.015,
      animationSpeedSecondary: typeof options.animationSpeedSecondary === 'number' ? options.animationSpeedSecondary : 0.01,
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
    this.surfaceTextureSize = 192;
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
      corona: this.generateValueNoiseTexture(this.surfaceTextureSize, 48),
      distortion: this.generateValueNoiseTexture(this.surfaceTextureSize, 40),
    };

    // Track UV offsets for animated noise layers so we only adjust sampling coordinates over time.
    this.surfaceAnimationState = {
      primaryOffsetX: 0,
      primaryOffsetY: 0,
      secondaryOffsetX: 0,
      secondaryOffsetY: 0,
      coronaOffset: 0,
      distortionOffset: 0,
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
    
    // Seed the spark bank with any provided initial reserve so UI callbacks hydrate immediately.
    const initialSparkBank = Number.isFinite(options.initialSparkBank) ? options.initialSparkBank : 0;
    this.setSparkBank(initialSparkBank);

    // Initialize if canvas is provided
    if (this.canvas) {
      this.resize();
    }
  }
  
  /**
   * Resize the simulation to match canvas dimensions
   */
  resize() {
    if (!this.canvas) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this.width = Math.floor(rect.width * dpr);
    this.height = Math.floor(rect.height * dpr);
    
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
    
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }
  
  /**
   * Get current mass tier information based on central star mass.
   */
  getCurrentTier() {
    let tier = MASS_TIERS[0];
    let nextTier = MASS_TIERS[1] || null;

    for (let i = 0; i < MASS_TIERS.length; i++) {
      if (this.starMass >= MASS_TIERS[i].threshold) {
        tier = MASS_TIERS[i];
        nextTier = MASS_TIERS[i + 1] || null;
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

    return { tier, nextTier, progress };
  }

  /**
   * Calculate the current visual radius of the sun so rendering and reactions stay in sync.
   * @returns {number} Radius of the core body in pixels
   */
  calculateCoreRadius() {
    const neutronTier = MASS_TIERS[5];
    const slowGrowthThreshold = neutronTier ? neutronTier.threshold : 0;
    const dampenedMass = slowGrowthThreshold > 0
      ? Math.min(this.starMass, slowGrowthThreshold) * 0.25
      : this.starMass * 0.25;
    const excessMass = slowGrowthThreshold > 0 ? Math.max(0, this.starMass - slowGrowthThreshold) : 0;
    const effectiveMass = dampenedMass + excessMass;
    // Apply the reduced mass curve so early tiers expand 75% slower while keeping continuity at high tiers.
    return Math.max(10, 5 + Math.sqrt(effectiveMass / 10) * 3);
  }

  /**
   * Convert a world position into a palette blend factor for dust coloring.
   * @param {number} x - X coordinate in canvas space
   * @param {number} y - Y coordinate in canvas space
   * @returns {number} Blend between 0 (core) and 1 (edge) for palette sampling
   */
  calculateDustRadialBlend(x, y) {
    const dpr = window.devicePixelRatio || 1;
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
   * Generate seamless value noise so surface sampling can animate without flicker.
   * @param {number} size - Resolution of the texture square
   * @param {number} cellSize - Size of the interpolation cell controlling frequency
   * @returns {{size:number,data:Float32Array}} Value noise texture data
   */
  generateValueNoiseTexture(size, cellSize) {
    const gridSize = Math.max(1, Math.floor(size / cellSize));
    const grid = new Array((gridSize + 1) * (gridSize + 1));

    // Populate grid points with deterministic random values for smooth interpolation.
    for (let y = 0; y <= gridSize; y++) {
      for (let x = 0; x <= gridSize; x++) {
        grid[y * (gridSize + 1) + x] = this.rng.next();
      }
    }

    const data = new Float32Array(size * size);

    // Bilinearly interpolate between grid values to create soft value noise.
    for (let y = 0; y < size; y++) {
      const gy = (y / size) * gridSize;
      const gy0 = Math.floor(gy);
      const gy1 = (gy0 + 1) % gridSize;
      const ty = gy - gy0;

      for (let x = 0; x < size; x++) {
        const gx = (x / size) * gridSize;
        const gx0 = Math.floor(gx);
        const gx1 = (gx0 + 1) % gridSize;
        const tx = gx - gx0;

        const topLeft = grid[gy0 * (gridSize + 1) + gx0];
        const topRight = grid[gy0 * (gridSize + 1) + gx1];
        const bottomLeft = grid[gy1 * (gridSize + 1) + gx0];
        const bottomRight = grid[gy1 * (gridSize + 1) + gx1];

        const top = topLeft * (1 - tx) + topRight * tx;
        const bottom = bottomLeft * (1 - tx) + bottomRight * tx;
        const value = top * (1 - ty) + bottom * ty;

        data[y * size + x] = value;
      }
    }

    return { size, data };
  }

  /**
   * Sample tiled value noise with wrap-around so UV offsets can scroll smoothly forever.
   * @param {{size:number,data:Float32Array}} texture - Noise texture data to sample
   * @param {number} u - Horizontal coordinate (0-1 range, unbounded)
   * @param {number} v - Vertical coordinate (0-1 range, unbounded)
   * @param {number} scale - Frequency multiplier to control detail density
   * @returns {number} Noise value between 0 and 1
   */
  sampleNoise(texture, u, v, scale) {
    const wrappedU = ((u * scale) % 1 + 1) % 1;
    const wrappedV = ((v * scale) % 1 + 1) % 1;
    const x = wrappedU * texture.size;
    const y = wrappedV * texture.size;

    const x0 = Math.floor(x) % texture.size;
    const y0 = Math.floor(y) % texture.size;
    const x1 = (x0 + 1) % texture.size;
    const y1 = (y0 + 1) % texture.size;
    const tx = x - Math.floor(x);
    const ty = y - Math.floor(y);

    const topLeft = texture.data[y0 * texture.size + x0];
    const topRight = texture.data[y0 * texture.size + x1];
    const bottomLeft = texture.data[y1 * texture.size + x0];
    const bottomRight = texture.data[y1 * texture.size + x1];

    const top = topLeft * (1 - tx) + topRight * tx;
    const bottom = bottomLeft * (1 - tx) + bottomRight * tx;
    return top * (1 - ty) + bottom * ty;
  }

  /**
   * Advance UV offsets so the precomputed noise scrolls slowly across the star surface.
   * @param {number} dt - Delta time in seconds
   */
  updateSurfaceAnimation(dt) {
    const settings = this.sunSurfaceSettings;
    this.surfaceAnimationState.primaryOffsetX += settings.animationSpeedMain * dt;
    this.surfaceAnimationState.primaryOffsetY += settings.animationSpeedMain * 0.6 * dt;
    this.surfaceAnimationState.secondaryOffsetX += settings.animationSpeedSecondary * 0.75 * dt;
    this.surfaceAnimationState.secondaryOffsetY += settings.animationSpeedSecondary * dt;
    this.surfaceAnimationState.coronaOffset += settings.coronaWobbleSpeed * dt;
    this.surfaceAnimationState.distortionOffset += settings.animationSpeedSecondary * 0.45 * dt;
    this.surfaceAnimationState.time += dt;
    this.surfaceTextureDirty = true;
  }

  /**
   * Rebuild the cached sun surface texture so the main render only performs a single drawImage call.
   * @param {{r:number,g:number,b:number}} tierColor - Tier tint to blend into the plasma surface
   * @param {number} luminosity - Scalar controlling overall brightness
   * @param {number} absorptionGlowBoost - Recent absorption boost for highlights
   */
  rebuildSunSurfaceTexture(tierColor, luminosity, absorptionGlowBoost) {
    if (!this.surfaceTextureDirty) {
      return;
    }

    if (!this.surfaceCanvas || !this.surfaceCtx || !this.surfaceImageData) {
      this.surfaceTextureDirty = false;
      return;
    }

    const size = this.surfaceTextureSize;
    const data = this.surfaceImageData.data;
    const half = size / 2;
    const settings = this.sunSurfaceSettings;
    const inner = GravitySimulation.parseHexColor(settings.coreInnerColor);
    const outer = GravitySimulation.parseHexColor(settings.coreOuterColor);
    const tierBlend = 0.35;
    const highlightBoost = 1 + absorptionGlowBoost * 0.6;

    // Iterate through the texture grid and shade each texel according to the layered noise fields.
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const index = (y * size + x) * 4;
        const dx = (x + 0.5 - half) / half;
        const dy = (y + 0.5 - half) / half;
        const radius = Math.sqrt(dx * dx + dy * dy);

        if (radius > 1) {
          data[index] = 0;
          data[index + 1] = 0;
          data[index + 2] = 0;
          data[index + 3] = 0;
          continue;
        }

        const u = dx * 0.5 + 0.5;
        const v = dy * 0.5 + 0.5;

        // Sample two animated noise layers to create sunspot masks and boiling motion.
        const warpedU = u + (this.sampleNoise(
          this.surfaceNoise.secondary,
          u + this.surfaceAnimationState.secondaryOffsetX,
          v + this.surfaceAnimationState.secondaryOffsetY,
          settings.noiseScaleSecondary
        ) - 0.5) * settings.surfaceWarpStrength;
        const warpedV = v + (this.sampleNoise(
          this.surfaceNoise.secondary,
          v + this.surfaceAnimationState.secondaryOffsetY,
          u + this.surfaceAnimationState.secondaryOffsetX,
          settings.noiseScaleSecondary
        ) - 0.5) * settings.surfaceWarpStrength;

        const primaryNoise = this.sampleNoise(
          this.surfaceNoise.primary,
          warpedU + this.surfaceAnimationState.primaryOffsetX,
          warpedV + this.surfaceAnimationState.primaryOffsetY,
          settings.noiseScalePrimary
        );
        const secondaryNoise = this.sampleNoise(
          this.surfaceNoise.secondary,
          warpedU + this.surfaceAnimationState.secondaryOffsetX * 0.5,
          warpedV + this.surfaceAnimationState.secondaryOffsetY * 0.5,
          settings.noiseScaleSecondary * 0.8
        );

        const combinedNoise = primaryNoise * 0.65 + secondaryNoise * 0.35;

        // Convert combined noise into a smooth sunspot mask using a soft threshold.
        const threshold = settings.sunspotThreshold;
        const softness = 0.12;
        const spotFactor = Math.max(0, (threshold - combinedNoise) / Math.max(softness, 0.0001));
        const sunspotMask = Math.min(1, Math.pow(spotFactor, 1.4));

        // Base color gradient from inner (white-hot) to outer (orange-red) with adjustable falloff.
        const radialT = Math.pow(Math.min(1, radius), settings.coreFalloff);
        // Introduce a limb-darkening gradient so the stellar disc darkens toward the rim for a 3D illusion.
        const limbFactorRaw = 1 - settings.limbDarkeningStrength * Math.pow(Math.min(1, radius), settings.limbDarkeningExponent);
        const limbFactor = Math.max(0.2, limbFactorRaw);
        let r = inner.r * (1 - radialT) + outer.r * radialT;
        let g = inner.g * (1 - radialT) + outer.g * radialT;
        let b = inner.b * (1 - radialT) + outer.b * radialT;

        // Blend tier tint so tier progression continues to affect colour identity.
        r = r * (1 - tierBlend) + tierColor.r * tierBlend;
        g = g * (1 - tierBlend) + tierColor.g * tierBlend;
        b = b * (1 - tierBlend) + tierColor.b * tierBlend;

        // Apply boiling convection brightness from secondary noise.
        const convection = (secondaryNoise - 0.5) * 0.22;
        const rimHighlight = Math.pow(Math.max(0, 1 - radius), 2.2) * 0.3;
        const brightness = Math.max(0.2, luminosity * (0.85 + convection + rimHighlight) * highlightBoost * limbFactor);

        // Darken sunspot areas while keeping a soft glowing edge for realism.
        const spotDarkness = settings.spotDarkness * sunspotMask;
        const edgeGlow = sunspotMask > 0 ? Math.pow(sunspotMask, 0.6) * 0.2 : 0;

        r = Math.max(0, r * (1 - spotDarkness)) + r * edgeGlow;
        g = Math.max(0, g * (1 - spotDarkness)) + g * edgeGlow * 0.9;
        b = Math.max(0, b * (1 - spotDarkness * 0.9)) + b * edgeGlow * 0.7;

        // Clamp and apply brightness scaling.
        data[index] = Math.min(255, Math.max(0, Math.round(r * brightness)));
        data[index + 1] = Math.min(255, Math.max(0, Math.round(g * brightness)));
        data[index + 2] = Math.min(255, Math.max(0, Math.round(b * brightness)));
        data[index + 3] = 255;
      }
    }

    this.surfaceCtx.putImageData(this.surfaceImageData, 0, 0);
    this.surfaceTextureDirty = false;
  }

  /**
   * Render the shimmering corona with a noise-driven wobble to keep the rim lively.
   * @param {CanvasRenderingContext2D} ctx - Rendering context
   * @param {number} centerX - Horizontal centre of the star
   * @param {number} centerY - Vertical centre of the star
   * @param {number} starVisualRadius - Base radius of the star core
   * @param {{r:number,g:number,b:number}} tierColor - Tier tint for halo colouring
   * @param {number} luminosity - Glow multiplier derived from tier progress
   */
  renderCorona(ctx, centerX, centerY, starVisualRadius, tierColor, luminosity) {
    const settings = this.sunSurfaceSettings;
    const baseRadius = starVisualRadius * (1.3 + settings.coronaIntensity * 0.4);
    const gradient = ctx.createRadialGradient(centerX, centerY, starVisualRadius * 0.95, centerX, centerY, baseRadius);

    // Build a gentle outer halo before adding the shimmering band.
    gradient.addColorStop(0, `rgba(${tierColor.r}, ${tierColor.g}, ${tierColor.b}, ${0.25 * luminosity})`);
    gradient.addColorStop(0.6, `rgba(${tierColor.r}, ${tierColor.g}, ${tierColor.b}, ${0.18 * luminosity})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // Blur the inner halo so the glow appears diffused instead of forming a solid ring.
    const haloBlur = Math.max(4, starVisualRadius * 0.12);
    ctx.filter = `blur(${haloBlur}px)`;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Overlay a noise-driven shimmer ring for the corona so the edge appears to dance.
    const segments = 42;
    const wobbleRadius = starVisualRadius * 0.14;
    const wobbleOffset = this.surfaceAnimationState.coronaOffset;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // Add a light blur to the shimmer ring to create a hazy corona band.
    ctx.filter = `blur(${Math.max(1.5, starVisualRadius * 0.05)}px)`;
    ctx.lineWidth = Math.max(1.5, starVisualRadius * 0.08);
    ctx.shadowBlur = starVisualRadius * 0.18;
    ctx.shadowColor = `rgba(${tierColor.r}, ${tierColor.g}, ${tierColor.b}, ${0.22 * luminosity})`;

    for (let i = 0; i < segments; i++) {
      const startAngle = (i / segments) * Math.PI * 2;
      const endAngle = ((i + 1) / segments) * Math.PI * 2;
      const sampleU = i / segments + wobbleOffset;
      const noise = this.sampleNoise(this.surfaceNoise.corona, sampleU, 0.5, 1.2);
      const intensity = settings.coronaIntensity * (0.35 + noise * 0.65) * luminosity;
      const radius = baseRadius + (noise - 0.5) * wobbleRadius;

      ctx.strokeStyle = `rgba(${tierColor.r}, ${tierColor.g}, ${tierColor.b}, ${Math.max(0, Math.min(0.45, intensity))})`;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draw a subtle heat distortion ring to hint at refractive shimmer without heavy processing.
   * @param {CanvasRenderingContext2D} ctx - Rendering context
   * @param {number} centerX - Horizontal centre of the star
   * @param {number} centerY - Vertical centre of the star
   * @param {number} starVisualRadius - Base radius of the star core
   * @param {{r:number,g:number,b:number}} tierColor - Tier tint for halo colouring
   */
  renderHeatDistortion(ctx, centerX, centerY, starVisualRadius, tierColor) {
    const strength = this.sunSurfaceSettings.heatDistortionStrength;
    if (strength <= 0) {
      return;
    }

    const segments = 28;
    const wobbleOffset = this.surfaceAnimationState.distortionOffset;
    const distortionRadius = starVisualRadius * 1.05;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'blur(0.6px)';
    ctx.lineWidth = Math.max(1, starVisualRadius * 0.04);

    for (let i = 0; i < segments; i++) {
      const startAngle = (i / segments) * Math.PI * 2;
      const endAngle = ((i + 1) / segments) * Math.PI * 2;
      const sample = this.sampleNoise(this.surfaceNoise.distortion, i / segments + wobbleOffset, 0.25, 1.1);
      const wobble = (sample - 0.5) * strength * starVisualRadius * 2;
      const alpha = 0.05 + Math.max(0, sample - 0.4) * 0.12;
      ctx.strokeStyle = `rgba(${tierColor.r}, ${tierColor.g}, ${tierColor.b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(centerX, centerY, distortionRadius + wobble, startAngle, endAngle);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Update the spring simulation that drives the bounce animation.
   * @param {number} dt - Delta time in seconds
   */
  updateSunBounce(dt) {
    const stiffness = 32; // Gentle stiffness keeps the wobble readable without going rigid.
    const damping = 8; // Damping trims oscillations so the motion settles quickly.
    const displacement = this.sunBounce.offset;
    const acceleration = -stiffness * displacement - damping * this.sunBounce.velocity;

    this.sunBounce.velocity += acceleration * dt;
    this.sunBounce.offset += this.sunBounce.velocity * dt;

    // Snap to rest when the remaining motion is imperceptible.
    if (Math.abs(this.sunBounce.offset) < 0.0001 && Math.abs(this.sunBounce.velocity) < 0.0001) {
      this.sunBounce.offset = 0;
      this.sunBounce.velocity = 0;
    }
  }

  /**
   * Schedule the next time a shooting star should appear.
   */
  scheduleNextShootingStar() {
    const intervalSeconds = this.rng.range(10, 60);
    this.nextShootingStarTime = this.elapsedTime + intervalSeconds;
  }

  /**
   * Spawn a shooting star just outside the simulation bounds.
   */
  spawnShootingStar() {
    const dpr = window.devicePixelRatio || 1;

    // Use the shared radius helper so spawn logic mirrors rendering scale.
    const starVisualRadius = this.calculateCoreRadius();
    const maxR = Math.min(this.width, this.height) / (2 * dpr);
    const spawnRadius = maxR + this.rng.range(20, 80);
    const angle = this.rng.next() * Math.PI * 2;

    const x = this.centerX + Math.cos(angle) * spawnRadius;
    const y = this.centerY + Math.sin(angle) * spawnRadius;

    const approachSpeed = this.rng.range(80, 140);
    let vx = -Math.cos(angle) * approachSpeed;
    let vy = -Math.sin(angle) * approachSpeed;

    // Add a slight tangential wobble so every shooting star path feels unique.
    const tangentialBoost = this.rng.range(-0.3, 0.3) * approachSpeed;
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);
    vx += perpX * tangentialBoost;
    vy += perpY * tangentialBoost;

    let color = { r: 255, g: 240, b: 200 };
    if (this.samplePaletteGradient) {
      color = this.samplePaletteGradient(0.85);
    }

    this.shootingStars.push({
      x,
      y,
      vx,
      vy,
      mass: 1,
      color,
      trail: [],
    });
  }

  /**
   * Spawn a new star randomly between the central body edge and simulation edge.
   * Uses near-circular orbital velocity.
   */
  spawnStar() {
    if (this.stars.length >= this.maxStars) return false;
    if (this.sparkBank <= 0) return false;

    const dpr = window.devicePixelRatio || 1;
    
    // Calculate central body radius
    // Use the shared radius helper so trail generation respects the current star size.
    const starVisualRadius = this.calculateCoreRadius();
    
    // Calculate maximum spawn radius using the horizontal distance to the edge of the view
    const maxR = this.width / (2 * dpr);

    // Enforce a minimum orbit of twice the sun's radius so new stars never crowd the surface
    const minR = Math.min(maxR, starVisualRadius * 2);

    // Spawn at random distance between the enforced minimum and the simulation edge
    const r = this.rng.range(minR, maxR);
    const angle = this.rng.next() * Math.PI * 2;
    
    // Position relative to center (in DPR-scaled coordinates)
    const x = this.centerX + Math.cos(angle) * r;
    const y = this.centerY + Math.sin(angle) * r;
    
    // Calculate circular orbital velocity: v = sqrt(G*M/r)
    const circularSpeed = Math.sqrt((this.G * this.starMass) / r);
    
    // Add velocity noise for spiral effects
    const velocityMultiplier = 1 + this.rng.range(-this.velocityNoiseFactor, this.velocityNoiseFactor);
    const v = circularSpeed * velocityMultiplier;
    
    // Tangential velocity (perpendicular to radius vector)
    const vx = -Math.sin(angle) * v;
    const vy = Math.cos(angle) * v;
    
    // Star mass scales deterministically with the upgrade so placement size is consistent.
    const starMass = 1 + this.upgrades.starMass;
    
    this.stars.push({
      x,
      y,
      vx,
      vy,
      mass: starMass,
      trail: [], // Array of {x, y, alpha, speed} points
      life: 1.0,
    });
    
    // Add spawn flash effect
    this.flashEffects.push({
      x: x / dpr,
      y: y / dpr,
      radius: 5,
      maxRadius: 20,
      alpha: 1.0,
      duration: 0.3, // seconds
      elapsed: 0,
    });

    // Deduct from the idle bank when a new star is introduced to the simulation.
    this.setSparkBank(this.sparkBank - 1);

    return true;
  }

  /**
   * Spawn dust particles for accretion disk visualization.
   * Particles spawn randomly between the central body edge and simulation edge.
   */
  spawnDustParticles(deltaTime) {
    if (this.dustParticles.length >= this.maxDustParticles) return;

    const dt = deltaTime / 1000;
    const dpr = window.devicePixelRatio || 1;
    
    // Calculate central body radius
    // Use the shared radius helper so dust drag remains centered on the rendered core.
    const starVisualRadius = this.calculateCoreRadius();
    
    // Calculate maximum spawn radius
    const maxR = Math.min(this.width, this.height) / (2 * dpr);
    
    this.dustAccumulator += dt * this.dustSpawnRate;
    while (this.dustAccumulator >= 1 && this.dustParticles.length < this.maxDustParticles) {
      // Spawn randomly between central body edge and simulation edge
      const r = this.rng.range(starVisualRadius, maxR);
      const angle = this.rng.next() * Math.PI * 2;
      
      const x = this.centerX + Math.cos(angle) * r;
      const y = this.centerY + Math.sin(angle) * r;
      
      // Azimuthal velocity with radial inflow
      const azimuthalSpeed = Math.sqrt((this.G * this.starMass) / r) * 0.3;
      const radialSpeed = -2; // Slow inward drift
      
      const vx = -Math.sin(angle) * azimuthalSpeed + Math.cos(angle) * radialSpeed;
      const vy = Math.cos(angle) * azimuthalSpeed + Math.sin(angle) * radialSpeed;
      
      // Sample color from palette gradient based on radial distance from the sun.
      const radialBlend = this.calculateDustRadialBlend(x, y); // Keep palette mapping consistent with rendering.
      let color;
      if (this.samplePaletteGradient) {
        color = this.samplePaletteGradient(radialBlend);
      } else {
        color = { r: 200, g: 200, b: 220 }; // Fallback color
      }
      
      this.dustParticles.push({
        x,
        y,
        vx,
        vy,
        color,
        life: 1.0,
        maxLife: this.rng.range(2, 5), // seconds
        elapsed: 0,
      });
      
      this.dustAccumulator -= 1;
    }
  }
  
  /**
   * Update dust particles.
   */
  updateDustParticles(deltaTime) {
    const dt = deltaTime / 1000;
    const dpr = window.devicePixelRatio || 1;

    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const dust = this.dustParticles[i];
      
      // Update lifetime
      dust.elapsed += dt;
      dust.life = Math.max(0, 1 - dust.elapsed / dust.maxLife);

      if (dust.life <= 0) {
        this.dustParticles.splice(i, 1);
        continue;
      }

      // Refresh the color so palette switches immediately affect existing dust grains.
      if (this.samplePaletteGradient) {
        const radialBlend = this.calculateDustRadialBlend(dust.x, dust.y);
        dust.color = this.samplePaletteGradient(radialBlend);
      }

      // Push dust away from passing stars
      for (const star of this.stars) {
        const dx = dust.x - star.x;
        const dy = dust.y - star.y;
        const distSq = dx * dx + dy * dy;
        const pushRadius = 25;
        
        if (distSq < pushRadius * pushRadius && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const pushStrength = 20;
          dust.vx += (dx / dist) * pushStrength * dt;
          dust.vy += (dy / dist) * pushStrength * dt;
        }
      }
      
      // Apply velocity damping
      dust.vx *= 0.98;
      dust.vy *= 0.98;
      
      // Update position
      dust.x += dust.vx * dt;
      dust.y += dust.vy * dt;
    }
  }

  /**
   * Update shooting stars and resolve their interactions.
   */
  updateShootingStars(deltaTime) {
    const dt = deltaTime / 1000;
    const dpr = window.devicePixelRatio || 1;

    if (this.elapsedTime >= this.nextShootingStarTime) {
      this.spawnShootingStar();
      this.scheduleNextShootingStar();
    }

    // Use the shared radius helper so launch positions orbit around the same core size used in rendering.
    const starVisualRadius = this.calculateCoreRadius();
    // Mirror the bounce scale so collision detection matches the rendered radius.
    const absorptionRadius = starVisualRadius * Math.max(0.85, 1 + this.sunBounce.offset);
    const maxR = Math.min(this.width, this.height) / (2 * dpr);

    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const shard = this.shootingStars[i];

      const dx = this.centerX - shard.x;
      const dy = this.centerY - shard.y;
      const distSq = Math.max(dx * dx + dy * dy, this.epsilon * this.epsilon);
      const dist = Math.sqrt(distSq);

      const accelMagnitude = (this.G * this.starMass) / distSq;
      const ax = (dx / dist) * accelMagnitude;
      const ay = (dy / dist) * accelMagnitude;

      shard.vx += ax * dt;
      shard.vy += ay * dt;

      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;

      shard.trail.push({ x: shard.x, y: shard.y, alpha: 1 });
      if (shard.trail.length > this.shootingStarTrailLength) {
        shard.trail.shift();
      }
      for (const point of shard.trail) {
        point.alpha = Math.max(0, point.alpha - 0.08); // Slow the alpha decay so the elongated trails remain bright.
      }

      let merged = false;
      for (const star of this.stars) {
        const sdx = star.x - shard.x;
        const sdy = star.y - shard.y;
        const sDistSq = sdx * sdx + sdy * sdy;
        const starRadius = Math.max(4, (star.mass / this.starMass) * starVisualRadius * 2);
        if (sDistSq < starRadius * starRadius) {
          // Shooting star merges into an orbiting spark and empowers it.
          star.mass += 1;
          this.flashEffects.push({
            x: star.x / dpr,
            y: star.y / dpr,
            radius: 6,
            maxRadius: 18,
            alpha: 1.0,
            duration: 0.4,
            elapsed: 0,
          });
          this.shootingStars.splice(i, 1);
          merged = true;
          break;
        }
      }
      if (merged) {
        continue;
      }

      if (dist < absorptionRadius) {
        // Shooting star slams into the sun and contributes a single unit of mass.
        this.starMass += 1;
        this.pendingAbsorptions += 1;
        this.pendingMassGain += 1;
        this.stats.lastAbsorptionTime = this.elapsedTime;
        if (this.onStarMassChange) {
          this.onStarMassChange(this.starMass);
        }

        // Trigger the same spring bounce for meteor impacts so the sun reacts uniformly.
        this.applySunBounceImpulse(0.01);
        this.shockRings.push({
          x: this.centerX / dpr,
          y: this.centerY / dpr,
          radius: 0,
          maxRadius: absorptionRadius * 1.5,
          alpha: 1.0,
          duration: 0.8,
          elapsed: 0,
        });
        this.shootingStars.splice(i, 1);
        continue;
      }

      if (dist > maxR + 200) {
        // Retire shooting stars that fully escape the play area.
        this.shootingStars.splice(i, 1);
      }
    }
  }

  /**
   * Update physics for all orbiting stars.
   */
  updateStars(deltaTime) {
    const dt = deltaTime / 1000; // Convert to seconds
    const dpr = window.devicePixelRatio || 1;

    // Spawn new stars
    this.spawnAccumulator += dt * this.sparkSpawnRate;
    while (this.spawnAccumulator >= 1 && this.sparkBank > 0) {
      const spawned = this.spawnStar();
      if (!spawned) {
        break;
      }
      this.spawnAccumulator -= 1;
    }
    
    // Track absorptions for statistics
    let absorbedThisFrame = 0;
    let massGainedThisFrame = 0;
    
    // Update each star
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const star = this.stars[i];
      
      // Calculate distance to center with softening
      const dx = this.centerX - star.x;
      const dy = this.centerY - star.y;
      const distSq = Math.max(dx * dx + dy * dy, this.epsilon * this.epsilon);
      const dist = Math.sqrt(distSq);
      
      // Use the shared radius helper so absorption checks align with the rendered radius.
      const starVisualRadius = this.calculateCoreRadius();
      const absorptionRadius = starVisualRadius * Math.max(0.85, 1 + this.sunBounce.offset);
      
      // Check if star should be absorbed (collision detection)
      if (dist < absorptionRadius) {
        // Increase central body mass
        const massGain = star.mass;
        this.starMass += massGain;
        massGainedThisFrame += massGain;
        absorbedThisFrame++;

        if (this.onStarMassChange) {
          this.onStarMassChange(this.starMass);
        }

        // Trigger a 1% radius bounce so the sun visibly reacts to the incoming mass.
        this.applySunBounceImpulse(0.01);

        // Create absorption shock ring
        this.shockRings.push({
          x: this.centerX / dpr,
          y: this.centerY / dpr,
          radius: 0,
          maxRadius: absorptionRadius * 1.5,
          alpha: 1.0,
          duration: 0.8, // seconds
          elapsed: 0,
        });

        // Remove star
        this.stars.splice(i, 1);
        continue;
      }
      
      // Calculate gravitational acceleration: a = -G * M / r^2 * r̂
      const forceMagnitude = (this.G * this.starMass) / distSq;
      const ax = (dx / dist) * forceMagnitude;
      const ay = (dy / dist) * forceMagnitude;
      
      // Apply drag: a_drag = -k * v
      const dragAx = -this.dragCoefficient * star.vx;
      const dragAy = -this.dragCoefficient * star.vy;
      
      // Update velocity
      star.vx += (ax + dragAx) * dt;
      star.vy += (ay + dragAy) * dt;
      
      // Update position
      star.x += star.vx * dt;
      star.y += star.vy * dt;
      
      // Calculate speed for trail coloring
      const speed = Math.sqrt(star.vx * star.vx + star.vy * star.vy);
      
      // Add current position to trail
      star.trail.push({
        x: star.x,
        y: star.y,
        alpha: 1.0,
        speed: speed,
      });
      
      // Limit trail length
      if (star.trail.length > this.trailLength) {
        star.trail.shift();
      }
      
      // Fade trail points
      for (const point of star.trail) {
        point.alpha = Math.max(0, point.alpha - this.trailFadeRate);
      }
    }

    if (this.pendingAbsorptions > 0) {
      absorbedThisFrame += this.pendingAbsorptions;
      massGainedThisFrame += this.pendingMassGain;
      this.pendingAbsorptions = 0;
      this.pendingMassGain = 0;
    }

    // Update statistics
    if (absorbedThisFrame > 0) {
      this.stats.totalAbsorptions += absorbedThisFrame;
      this.stats.totalMassGained += massGainedThisFrame;
      this.stats.lastAbsorptionTime = this.elapsedTime;
    }
    
    // Update absorption and mass history for sparklines (sample every second)
    if (Math.floor(this.elapsedTime) !== Math.floor(this.elapsedTime - dt)) {
      this.stats.absorptionHistory.push(absorbedThisFrame);
      this.stats.massHistory.push(this.starMass);
      
      if (this.stats.absorptionHistory.length > this.stats.historyMaxLength) {
        this.stats.absorptionHistory.shift();
      }
      if (this.stats.massHistory.length > this.stats.historyMaxLength) {
        this.stats.massHistory.shift();
      }
      
      // Calculate rates (per minute)
      const historyDuration = this.stats.absorptionHistory.length; // seconds
      if (historyDuration > 0) {
        const totalAbsorptionsInHistory = this.stats.absorptionHistory.reduce((a, b) => a + b, 0);
        this.stats.absorptionsPerMinute = (totalAbsorptionsInHistory / historyDuration) * 60;
        
        if (this.stats.massHistory.length >= 2) {
          const massGainedInHistory = this.stats.massHistory[this.stats.massHistory.length - 1] - 
                                       this.stats.massHistory[0];
          this.stats.massInflowPerMinute = (massGainedInHistory / historyDuration) * 60;
        }
      }
    }
  }
  
  /**
   * Update visual effects (shock rings, flash effects).
   */
  updateEffects(deltaTime) {
    const dt = deltaTime / 1000;
    
    // Update shock rings
    for (let i = this.shockRings.length - 1; i >= 0; i--) {
      const ring = this.shockRings[i];
      ring.elapsed += dt;
      
      const progress = ring.elapsed / ring.duration;
      ring.radius = progress * ring.maxRadius;
      ring.alpha = Math.max(0, 1 - progress);
      
      if (progress >= 1) {
        this.shockRings.splice(i, 1);
      }
    }
    
    // Update flash effects
    for (let i = this.flashEffects.length - 1; i >= 0; i--) {
      const flash = this.flashEffects[i];
      flash.elapsed += dt;

      const progress = flash.elapsed / flash.duration;
      flash.radius = flash.maxRadius * Math.sin(progress * Math.PI); // Expand then contract
      flash.alpha = Math.max(0, 1 - progress);

      if (progress >= 1) {
        this.flashEffects.splice(i, 1);
      }
    }

    // Advance the spring that powers the sun bounce so render() can apply the new scale.
    this.updateSunBounce(dt);

    // Scroll the procedural textures so surface turbulence and corona wobble stay animated.
    this.updateSurfaceAnimation(dt);
  }
  
  /**
   * Render the simulation with all visual effects.
   */
  render() {
    if (!this.ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.ctx;
    
    // Clear with black background
    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, this.width / dpr, this.height / dpr);
    
    const centerXScaled = this.centerX / dpr;
    const centerYScaled = this.centerY / dpr;
    
    // Get current tier information
    const { tier, nextTier, progress } = this.getCurrentTier();
    
    // Calculate star visual radius based on mass
    // diameter = star_mass / sqrt(center_mass) (scaled for display)
    // Use the shared radius helper so the drawn body matches physics-driven interactions.
    const starVisualRadius = this.calculateCoreRadius();
    
    // Luminosity increases with progress to next tier (100% to 200%)
    const baseGlowIntensity = Math.max(0.6, tier.glow);
    const glowProgressScale = 1 + progress; // 100% glow at start, 200% at next milestone threshold

    // Sample the bounce spring so the core radius swells roughly 1% on every absorption.
    const bounceScale = 1 + this.sunBounce.offset;
    const pulseScale = Math.max(0.85, bounceScale);

    // Track recent absorptions to brighten the glow without altering the bounce physics.
    const timeSinceAbsorption = this.elapsedTime - this.stats.lastAbsorptionTime;
    let absorptionGlowBoost = 0;
    if (timeSinceAbsorption < 0.3) {
      const absorptionProgress = timeSinceAbsorption / 0.3;
      absorptionGlowBoost = Math.sin(absorptionProgress * Math.PI) * 0.2;
    }
    const luminosity = baseGlowIntensity * glowProgressScale * (1 + absorptionGlowBoost);
    
    // Parse tier color
    const parseColor = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };
    
    const tierColor = parseColor(tier.color);

    // Rebuild the cached procedural texture before any blitting occurs.
    this.rebuildSunSurfaceTexture(tierColor, luminosity, absorptionGlowBoost);

    // Draw gravitational lensing effect (fake refraction)
    if (tier.name === 'Black Hole') {
      // Draw event horizon
      const horizonRadius = starVisualRadius * 1.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(centerXScaled, centerYScaled, horizonRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Draw glow effect with tier-based luminosity
    const glowRadius = starVisualRadius * (1.8 + baseGlowIntensity) * glowProgressScale * pulseScale;
    const gradient = ctx.createRadialGradient(
      centerXScaled, centerYScaled, 0,
      centerXScaled, centerYScaled, glowRadius
    );
    gradient.addColorStop(0, `rgba(${tierColor.r}, ${tierColor.g}, ${tierColor.b}, ${0.8 * luminosity})`);
    gradient.addColorStop(0.3, `rgba(${tierColor.r}, ${tierColor.g}, ${tierColor.b}, ${0.5 * luminosity})`);
    gradient.addColorStop(0.6, `rgba(${tierColor.r}, ${tierColor.g}, ${tierColor.b}, ${0.2 * luminosity})`);
    gradient.addColorStop(1, `rgba(${tierColor.r}, ${tierColor.g}, ${tierColor.b}, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerXScaled, centerYScaled, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Render shock rings beneath the core so the expanding wave emerges from behind the sun.
    ctx.save();
    // Feather the shock rings so the expansion looks gaseous instead of razor sharp.
    ctx.filter = `blur(${Math.max(1.2, coreRadius * 0.04)}px)`;
    for (const ring of this.shockRings) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${ring.alpha * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Draw the procedural surface texture with animated sunspots and convection.
    const coreRadius = starVisualRadius * pulseScale;
    if (this.surfaceCanvas) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerXScaled, centerYScaled, coreRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        this.surfaceCanvas,
        centerXScaled - coreRadius,
        centerYScaled - coreRadius,
        coreRadius * 2,
        coreRadius * 2
      );
      ctx.restore();
    } else {
      ctx.fillStyle = tier.color;
      ctx.beginPath();
      ctx.arc(centerXScaled, centerYScaled, coreRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Overlay the shimmering corona and rim glow for atmospheric depth.
    this.renderCorona(ctx, centerXScaled, centerYScaled, coreRadius, tierColor, luminosity);

    // Apply a lightweight heat shimmer so the star subtly distorts nearby space.
    this.renderHeatDistortion(ctx, centerXScaled, centerYScaled, coreRadius, tierColor);

    // Draw accretion jets for high-mass stars
    const spinThreshold = 1000; // Mass threshold for jets
    if (this.starMass > spinThreshold && this.stars.length > 5) {
      const jetLength = 100;
      const jetWidth = 3;
      const jetAlpha = Math.min(0.6, (this.starMass / spinThreshold - 1) * 0.1);
      
      // Draw twin beams along vertical axis
      ctx.strokeStyle = `rgba(${tierColor.r}, ${tierColor.g}, ${tierColor.b}, ${jetAlpha})`;
      ctx.lineWidth = jetWidth;
      
      // Top jet
      ctx.beginPath();
      // Start the jet outside the stellar surface so no line slices through the sun's core.
      ctx.moveTo(centerXScaled, centerYScaled - coreRadius);
      ctx.lineTo(centerXScaled, centerYScaled - coreRadius - jetLength);
      ctx.stroke();

      // Bottom jet
      ctx.beginPath();
      ctx.moveTo(centerXScaled, centerYScaled + coreRadius);
      ctx.lineTo(centerXScaled, centerYScaled + coreRadius + jetLength);
      ctx.stroke();
    }
    
    // Draw dust particles (accretion disk) with color palette gradient
    for (const dust of this.dustParticles) {
      const dustX = dust.x / dpr;
      const dustY = dust.y / dpr;
      const dustAlpha = dust.life * 0.3;

      if (dust.color) {
        ctx.fillStyle = `rgba(${dust.color.r}, ${dust.color.g}, ${dust.color.b}, ${dustAlpha})`;
      } else {
        ctx.fillStyle = `rgba(200, 200, 220, ${dustAlpha})`;
      }
      ctx.beginPath();
      ctx.arc(dustX, dustY, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw shooting stars with luminous trails.
    for (const shard of this.shootingStars) {
      if (shard.trail.length > 1) {
        ctx.save();
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.globalCompositeOperation = 'lighter'; // Blend streaks additively so overlapping segments intensify the glow.
        ctx.shadowBlur = 12; // Apply a soft halo that makes the trail appear diffused.
        ctx.shadowColor = `rgba(${shard.color.r}, ${shard.color.g}, ${shard.color.b}, 0.9)`; // Reuse shard color for the luminous blur.
        for (let i = 1; i < shard.trail.length; i++) {
          const prev = shard.trail[i - 1];
          const curr = shard.trail[i];
          const progress = i / shard.trail.length || 0; // Normalize segment position so the head stays brightest.
          const fadeAlpha = Math.max(0, curr.alpha * (1 - progress * 0.5)); // Keep more opacity near the leading edge of the streak.
          const brightness = 0.7 + (1 - progress) * 0.3; // Boost color intensity at the head for a radiant taper.
          const boostedR = Math.min(255, Math.round(shard.color.r * brightness));
          const boostedG = Math.min(255, Math.round(shard.color.g * brightness));
          const boostedB = Math.min(255, Math.round(shard.color.b * brightness));
          ctx.strokeStyle = `rgba(${boostedR}, ${boostedG}, ${boostedB}, ${fadeAlpha})`;
          ctx.beginPath();
          ctx.moveTo(prev.x / dpr, prev.y / dpr);
          ctx.lineTo(curr.x / dpr, curr.y / dpr);
          ctx.stroke();
        }
        ctx.restore();
      }

      const shardX = shard.x / dpr;
      const shardY = shard.y / dpr;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter'; // Let the meteor head bloom brightly on top of the trail.
      ctx.shadowBlur = 20; // Stronger blur around the core star for a glowing nucleus.
      ctx.shadowColor = `rgba(${shard.color.r}, ${shard.color.g}, ${shard.color.b}, 1)`; // Mirror the meteor hue in the glow to keep palette cohesion.
      ctx.fillStyle = `rgba(${shard.color.r}, ${shard.color.g}, ${shard.color.b}, 1)`;
      ctx.beginPath();
      ctx.arc(shardX, shardY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw orbiting stars with trails
    for (const star of this.stars) {
      // Draw trail with color gradient from palette
      if (star.trail.length > 1) {
        ctx.lineWidth = 1.5;
        
        for (let i = 1; i < star.trail.length; i++) {
          const prev = star.trail[i - 1];
          const curr = star.trail[i];
          
          // Color based on speed (slow = lower palette color, fast = upper palette color)
          const normalizedSpeed = Math.min(1, curr.speed / 200);
          
          let slowColor, fastColor;
          if (this.samplePaletteGradient) {
            // Use the color palette gradient
            slowColor = this.samplePaletteGradient(0);
            fastColor = this.samplePaletteGradient(1);
          } else {
            // Fallback to default colors
            slowColor = { r: 100, g: 150, b: 255 }; // Blueish
            fastColor = { r: 255, g: 200, b: 100 }; // Yellowish
          }
          
          const r = Math.floor(slowColor.r + (fastColor.r - slowColor.r) * normalizedSpeed);
          const g = Math.floor(slowColor.g + (fastColor.g - slowColor.g) * normalizedSpeed);
          const b = Math.floor(slowColor.b + (fastColor.b - slowColor.b) * normalizedSpeed);
          
          const alpha = curr.alpha * 0.5;
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          
          ctx.beginPath();
          ctx.moveTo(prev.x / dpr, prev.y / dpr);
          ctx.lineTo(curr.x / dpr, curr.y / dpr);
          ctx.stroke();
        }
      }
      
      // Draw star with size based on mass ratio to central body
      const starX = star.x / dpr;
      const starY = star.y / dpr;
      const massRatio = star.mass / this.starMass;
      const starSize = starVisualRadius * massRatio;
      
      // Glow effect
      const starGradient = ctx.createRadialGradient(
        starX, starY, 0,
        starX, starY, starSize * 2
      );
      starGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      starGradient.addColorStop(0.5, 'rgba(200, 220, 255, 0.6)');
      starGradient.addColorStop(1, 'rgba(200, 220, 255, 0)');
      
      ctx.fillStyle = starGradient;
      ctx.beginPath();
      ctx.arc(starX, starY, starSize * 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Core star
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(starX, starY, starSize, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw spawn flash effects
    for (const flash of this.flashEffects) {
      const flashGradient = ctx.createRadialGradient(
        flash.x, flash.y, 0,
        flash.x, flash.y, flash.radius
      );
      flashGradient.addColorStop(0, `rgba(255, 255, 255, ${flash.alpha})`);
      flashGradient.addColorStop(0.5, `rgba(139, 247, 255, ${flash.alpha * 0.5})`);
      flashGradient.addColorStop(1, 'rgba(139, 247, 255, 0)');
      
      ctx.fillStyle = flashGradient;
      ctx.beginPath();
      ctx.arc(flash.x, flash.y, flash.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
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
    
    // Update elapsed time for statistics
    this.elapsedTime += deltaTime / 1000;
    
    // Update all simulation components
    this.updateShootingStars(deltaTime);
    this.updateStars(deltaTime);
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
   * Add sparks to the bank
   */
  addToSparkBank(amount) {
    if (!Number.isFinite(amount)) {
      return;
    }
    this.setSparkBank(this.sparkBank + amount);
  }

  /**
   * Overwrite the spark bank and notify listeners when the value changes.
   * @param {number} amount - New spark reserve value
   */
  setSparkBank(amount) {
    const normalized = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    if (normalized === this.sparkBank) {
      return;
    }
    this.sparkBank = normalized;
    if (this.onSparkBankChange) {
      this.onSparkBankChange(this.sparkBank);
    }
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
    return this.dragLevel < this.maxDragLevel && this.sparkBank >= this.getDragUpgradeCost();
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
    
    const cost = this.getDragUpgradeCost();
    this.setSparkBank(this.sparkBank - cost);
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
    return this.sparkBank >= this.getStarMassUpgradeCost();
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
    
    const cost = this.getStarMassUpgradeCost();
    this.setSparkBank(this.sparkBank - cost);
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
    return {
      starMass: this.starMass,
      sparkBank: this.sparkBank,
      dragLevel: this.dragLevel,
      dragCoefficient: this.dragCoefficient,
      upgrades: {
        starMass: this.upgrades.starMass,
      },
      stats: {
        totalAbsorptions: this.stats.totalAbsorptions,
        totalMassGained: this.stats.totalMassGained,
      },
    };
  }
  
  /**
   * Restore state from serialized data
   */
  setState(state) {
    if (state && typeof state === 'object') {
      if (Number.isFinite(state.starMass)) {
        this.starMass = Math.max(0, state.starMass);
      }
      if (Number.isFinite(state.sparkBank)) {
        this.setSparkBank(state.sparkBank);
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
  }
}
