// Lamed tower physics update, spawn, and surface-generation methods extracted from GravitySimulation.

import {
  MASS_TIERS,
  TIER_DIAMETER_PERCENTAGES,
  BLACK_HOLE_MAX_DIAMETER_PERCENT,
  COLLAPSE_ANIMATION_SECONDS,
} from './lamedTowerData.js';
import { clamp } from './shared/TowerUtils.js';

/**
 * Advance the responsive diameter so stage progress smoothly grows the sun.
 * @param {number} dt - Delta time in seconds
 */
export function updateCoreSizeState(dt) {
  const tierInfo = this.getCurrentTier();
  const basePercent = TIER_DIAMETER_PERCENTAGES[tierInfo.tierIndex] || TIER_DIAMETER_PERCENTAGES[0];

  if (typeof this.lastTierIndex !== 'number') {
    this.lastTierIndex = tierInfo.tierIndex;
  }

  const previousTierIndex = this.lastTierIndex;
  const transitioned = tierInfo.tierIndex !== previousTierIndex;
  if (transitioned) {
    const collapseTransition =
      (previousTierIndex === 4 && tierInfo.tierIndex === 5) ||
      (previousTierIndex === 5 && tierInfo.tierIndex === 6);

    if (collapseTransition) {
      // Trigger a visible crunch animation when the star collapses to a smaller tier.
      this.coreSizeState.transitionStartPercent = this.coreSizeState.percent;
      this.coreSizeState.targetPercent = basePercent;
      this.coreSizeState.transitionElapsed = 0;
      this.coreSizeState.transitionDuration = COLLAPSE_ANIMATION_SECONDS;
    } else {
      // Snap forward to the new baseline while letting progress interpolation handle further growth.
      this.coreSizeState.percent = Math.max(this.coreSizeState.percent, basePercent);
      this.coreSizeState.transitionDuration = 0;
      this.coreSizeState.transitionElapsed = 0;
      this.coreSizeState.targetPercent = basePercent;
      this.coreSizeState.transitionStartPercent = this.coreSizeState.percent;
    }

    this.lastTierIndex = tierInfo.tierIndex;
  }

  if (this.coreSizeState.transitionDuration > 0) {
    const newElapsed = Math.min(
      this.coreSizeState.transitionElapsed + Math.max(0, dt),
      this.coreSizeState.transitionDuration,
    );
    this.coreSizeState.transitionElapsed = newElapsed;
    const progress = this.coreSizeState.transitionDuration > 0
      ? newElapsed / this.coreSizeState.transitionDuration
      : 1;
    const eased = 1 - Math.pow(1 - progress, 3);
    this.coreSizeState.percent = this.constructor.lerp(
      this.coreSizeState.transitionStartPercent,
      this.coreSizeState.targetPercent,
      eased,
    );

    if (newElapsed >= this.coreSizeState.transitionDuration) {
      this.coreSizeState.transitionDuration = 0;
    }
    return;
  }

  let desiredPercent = basePercent;
  if (tierInfo.tierIndex === MASS_TIERS.length - 1) {
    // Let the black hole swell up to 50% of the viewport width as mass grows post-threshold.
    const lastTier = MASS_TIERS[tierInfo.tierIndex];
    const startPercent = desiredPercent;
    const extraMass = Math.max(0, this.starMass - lastTier.threshold);
    const range = Math.max(1, this.blackHoleGrowthRange || lastTier.threshold);
    const normalized = clamp(extraMass / range, 0, 1);
    desiredPercent = this.constructor.lerp(startPercent, BLACK_HOLE_MAX_DIAMETER_PERCENT, normalized);
  } else if (tierInfo.nextTier) {
    const nextPercent = TIER_DIAMETER_PERCENTAGES[tierInfo.tierIndex + 1] || desiredPercent;
    if (nextPercent > desiredPercent) {
      desiredPercent = this.constructor.lerp(
        desiredPercent,
        nextPercent,
        clamp(tierInfo.progress, 0, 1),
      );
    }
  }

  // Ease toward the desired size so growth appears smooth even on variable frame rates.
  const smoothing = dt <= 0 ? 1 : clamp(dt * 4, 0, 1);
  this.coreSizeState.percent = this.constructor.lerp(this.coreSizeState.percent, desiredPercent, smoothing);
}

/**
 * Generate seamless value noise so surface sampling can animate without flicker.
 * @param {number} size - Resolution of the texture square
 * @param {number} cellSize - Size of the interpolation cell controlling frequency
 * @returns {{size:number,data:Float32Array}} Value noise texture data
 */
export function generateValueNoiseTexture(size, cellSize) {
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
export function sampleNoise(texture, u, v, scale) {
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
export function updateSurfaceAnimation(dt) {
  const settings = this.sunSurfaceSettings;
  this.surfaceAnimationState.primaryOffsetX += settings.animationSpeedMain * dt;
  this.surfaceAnimationState.primaryOffsetY += settings.animationSpeedMain * 0.6 * dt;
  this.surfaceAnimationState.secondaryOffsetX += settings.animationSpeedSecondary * 0.75 * dt;
  this.surfaceAnimationState.secondaryOffsetY += settings.animationSpeedSecondary * dt;
  this.surfaceAnimationState.tertiaryOffsetX += settings.animationSpeedMain * 0.4 * dt;
  this.surfaceAnimationState.tertiaryOffsetY += settings.animationSpeedSecondary * 0.6 * dt;
  this.surfaceAnimationState.time += dt;
  this.surfaceTextureDirty = true;
}

/**
 * Rebuild the cached sun surface texture so the main render only performs a single drawImage call.
 * @param {{r:number,g:number,b:number}} tierColor - Tier tint to blend into the plasma surface
 * @param {number} luminosity - Scalar controlling overall brightness
 * @param {number} absorptionGlowBoost - Recent absorption boost for highlights
 */
export function rebuildSunSurfaceTexture(tierColor, luminosity, absorptionGlowBoost) {
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
  const inner = this.constructor.parseHexColor(settings.coreInnerColor);
  const outer = this.constructor.parseHexColor(settings.coreOuterColor);
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
      const angle = Math.atan2(dy, dx);
      const swirlStrength = settings.sunspotSwirlStrength || 0;
      const swirl = swirlStrength !== 0
        ? Math.sin(angle * 6 + this.surfaceAnimationState.time * 0.4) * swirlStrength
        : 0;

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

      const tertiaryNoise = this.sampleNoise(
        this.surfaceNoise.tertiary,
        warpedU + this.surfaceAnimationState.tertiaryOffsetX + swirl * 0.3,
        warpedV + this.surfaceAnimationState.tertiaryOffsetY - swirl * 0.3,
        settings.noiseScaleTertiary || 3.5,
      );

      const detailMix = clamp(typeof settings.sunspotDetailMix === 'number' ? settings.sunspotDetailMix : 0.55, 0, 1);
      const organicNoise = primaryNoise * detailMix + tertiaryNoise * (1 - detailMix);
      const combinedNoise = primaryNoise * 0.45 + secondaryNoise * 0.35 + organicNoise * 0.2 + swirl * 0.1;

      // Convert combined noise into a smooth sunspot mask using a soft threshold.
      const thresholdBase = settings.sunspotThreshold;
      const jitter = (tertiaryNoise - 0.5) * (settings.sunspotJitter || 0);
      const threshold = thresholdBase + jitter;
      const baseSoftness = Math.max(0.02, settings.sunspotSoftness || 0.1);
      const softness = Math.max(0.02, baseSoftness + Math.abs(swirl) * 0.05);
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
 * Update the spring simulation that drives the bounce animation.
 * @param {number} dt - Delta time in seconds
 */
export function updateSunBounce(dt) {
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
export function scheduleNextShootingStar() {
  const intervalSeconds = this.rng.range(10, 60);
  this.nextShootingStarTime = this.elapsedTime + intervalSeconds;
}

/**
 * Spawn a shooting star just outside the simulation bounds.
 */
export function spawnShootingStar() {
  const dpr = this.getEffectiveDevicePixelRatio();

  // Use the shared radius helper so spawn logic mirrors rendering scale.
  const starVisualRadius = this.calculateCoreRadius();
  const maxR = Math.min(this.width, this.height) / (2 * dpr);
  const spawnRadius = (maxR + this.rng.range(20, 80)) * dpr;
  const angle = this.rng.next() * Math.PI * 2;

  const x = this.centerX + Math.cos(angle) * spawnRadius;
  const y = this.centerY + Math.sin(angle) * spawnRadius;

  const approachSpeed = this.rng.range(80, 140) * dpr;
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
 * Apply a star's mass directly to the sun when the render cap is hit so late spawns still matter.
 * @param {number} massGain - Mass to funnel directly into the core
 */
export function absorbStarImmediately(massGain) {
  const normalizedMass = Math.max(0, Number.isFinite(massGain) ? massGain : 0);
  if (normalizedMass <= 0) {
    return;
  }

  this.starMass += normalizedMass;
  this.pendingAbsorptions += 1;
  this.pendingMassGain += normalizedMass;
  this.applySunBounceImpulse(0.01);

  if (this.onStarMassChange) {
    this.onStarMassChange(this.starMass);
  }
}

/**
 * Spawn a new star near the click/tap position with slight variation.
 * If no click position is available, spawn randomly as fallback.
 * Uses near-circular orbital velocity.
 */
export function spawnStar(options = {}) {
  const dpr = this.getEffectiveDevicePixelRatio();
  const massMultiplier = Number.isFinite(options.massMultiplier)
    ? Math.max(1, options.massMultiplier)
    : 1;
  const starMass = (1 + this.upgrades.starMass) * massMultiplier;
  const colorOverride = this.constructor.normalizeGemColor(options.color);

  // Calculate central body radius
  // Use the shared radius helper so trail generation respects the current star size.
  const starVisualRadius = this.calculateCoreRadius();

  let x, y, orbitRadiusDevice;
  
  // If we have a click position, spawn near it with slight variation
  if (this.lastClickPosition) {
    const clickX = this.lastClickPosition.x * dpr;
    const clickY = this.lastClickPosition.y * dpr;
    
    // Add slight random variation (±20 pixels)
    const variation = 20 * dpr;
    x = clickX + this.rng.range(-variation, variation);
    y = clickY + this.rng.range(-variation, variation);
    
    // Calculate distance from center
    const dx = x - this.centerX;
    const dy = y - this.centerY;
    orbitRadiusDevice = Math.sqrt(dx * dx + dy * dy);
    
    // Ensure minimum distance from sun
    const minR = starVisualRadius * 2;
    if (orbitRadiusDevice < minR) {
      const angle = Math.atan2(dy, dx);
      orbitRadiusDevice = minR;
      x = this.centerX + Math.cos(angle) * orbitRadiusDevice;
      y = this.centerY + Math.sin(angle) * orbitRadiusDevice;
    }
  } else {
    // Fallback to random spawning if no click position
    const maxR = this.calculateMaxSpawnRadiusCss();
    const minR = Math.min(maxR, starVisualRadius * 2);
    const orbitRadiusCss = this.rng.range(minR, maxR);
    orbitRadiusDevice = orbitRadiusCss * dpr;
    const angle = this.rng.next() * Math.PI * 2;
    x = this.centerX + Math.cos(angle) * orbitRadiusDevice;
    y = this.centerY + Math.sin(angle) * orbitRadiusDevice;
  }

  // Calculate angle from center for velocity calculation
  const dx = x - this.centerX;
  const dy = y - this.centerY;
  const angle = Math.atan2(dy, dx);

  // Calculate circular orbital velocity: v = sqrt(G*M/r)
  const circularSpeed = Math.sqrt((this.G * this.starMass) / Math.max(orbitRadiusDevice, this.epsilon));

  // Add velocity noise for spiral effects
  const velocityMultiplier = 1 + this.rng.range(-this.velocityNoiseFactor, this.velocityNoiseFactor);
  const v = circularSpeed * velocityMultiplier;

  // Tangential velocity (perpendicular to radius vector)
  const vx = -Math.sin(angle) * v;
  const vy = Math.cos(angle) * v;

  if (this.stars.length >= this.maxStars) {
    // Continue to surface the spawn flash even when the orbit is saturated so the tab stays lively.
    this.absorbStarImmediately(starMass);
    if (this.showSpawnFlashes) {
      this.flashEffects.push({
        x: x / dpr,
        y: y / dpr,
        radius: 5,
        maxRadius: 20,
        alpha: 1.0,
        duration: 0.3, // seconds
        elapsed: 0,
      });
    }
    return true;
  }
  
  // Star mass scales deterministically with the upgrade so placement size is consistent.
  const starHasTrail = this.trailEnabledStarCount < this.maxStarsWithTrails;

  this.stars.push({
    x,
    y,
    vx,
    vy,
    mass: starMass,
    // Persist whether this spark is allowed to render a trail for its entire lifetime.
    hasTrail: starHasTrail,
    color: colorOverride,
    trail: [], // Array of {x, y, alpha, speed} points
    life: 1.0,
  });

  if (starHasTrail) {
    this.trailEnabledStarCount++;
  }
  
  // Add spawn flash effect
  if (this.showSpawnFlashes) {
    this.flashEffects.push({
      x: x / dpr,
      y: y / dpr,
      radius: 5,
      maxRadius: 20,
      alpha: 1.0,
      duration: 0.3, // seconds
      elapsed: 0,
    });
  }

  return true;
}

/**
 * Spawn multiple stars for catch-up after idle time.
 * @param {number} starCount - Number of stars to spawn
 * @returns {number} Number of stars actually spawned
 */
export function spawnMultipleStars(starCount) {
  let spawned = 0;
  for (let i = 0; i < starCount; i++) {
    if (this.spawnStar()) {
      spawned++;
    } else {
      break;
    }
  }
  return spawned;
}

/**
 * Spawn dust particles for accretion disk visualization.
 * Particles spawn randomly between the central body edge and simulation edge.
 */
export function spawnDustParticles(deltaTime) {
  // Dynamically scale dust population to fade out as the starfield reaches maximum density.
  const dustCap = this.resolveDustCap();
  const scaledDust = Math.max(0, dustCap - Math.min(this.stars.length, this.maxStars));
  this.desiredDustParticles = Math.min(dustCap, scaledDust);
  this.maxDustParticles = this.desiredDustParticles;
  this.dustSpawnRate = this.desiredDustParticles;

  if (this.dustParticles.length >= this.maxDustParticles && this.maxDustParticles <= 0) {
    this.dustParticles.length = 0;
    return;
  }

  const dt = deltaTime / 1000;
  const dpr = this.getEffectiveDevicePixelRatio();
  
  // Calculate central body radius
  // Use the shared radius helper so dust drag remains centered on the rendered core.
  const starVisualRadius = this.calculateCoreRadius();
  
  // Calculate maximum spawn radius using the diagonal distance so grains can appear in the corners.
  const maxR = this.calculateMaxSpawnRadiusCss();
  
  this.dustAccumulator += dt * this.dustSpawnRate;
  while (this.dustParticles.length > this.maxDustParticles) {
    this.dustParticles.shift();
  }
  while (this.dustAccumulator >= 1 && this.dustParticles.length < this.maxDustParticles) {
    // Spawn randomly between central body edge and simulation edge
    const rCss = this.rng.range(starVisualRadius, maxR);
    const rDevice = rCss * dpr;
    const angle = this.rng.next() * Math.PI * 2;

    const x = this.centerX + Math.cos(angle) * rDevice;
    const y = this.centerY + Math.sin(angle) * rDevice;

    // Azimuthal velocity with radial inflow
    const azimuthalSpeed = Math.sqrt((this.G * this.starMass) / Math.max(rDevice, this.epsilon)) * 0.3;
    const radialSpeed = -2 * dpr; // Slow inward drift converted to device pixels
    
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
 * Spawn a geyser particle burst at the sun's surface for high-tier absorptions.
 * @param {number} impactAngle - Angle (radians) describing where the incoming star arrived from
 * @param {number} massGain - Mass contributed by the absorbed star (used to scale burst strength)
 * @param {{color:string}} tier - Current tier descriptor for tinting
 */
export function spawnGeyserBurst(impactAngle, massGain, tier, contactPointCss, starRadiusCss, sunRadiusCss) {
  const settings = this.visualEffectSettings.geyser;
  const dpr = this.getEffectiveDevicePixelRatio();
  const resolvedStarRadius = Math.max(2, Number.isFinite(starRadiusCss) ? starRadiusCss : 4);
  const resolvedSunRadius = Math.max(2, Number.isFinite(sunRadiusCss) ? sunRadiusCss : this.calculateCoreRadius());
  const normal = { x: Math.cos(impactAngle), y: Math.sin(impactAngle) };
  const origin = contactPointCss || { x: this.centerX / dpr, y: this.centerY / dpr };
  const offsetDistance = Math.min(resolvedStarRadius * 0.4, resolvedSunRadius * 0.2);
  const spawnX = origin.x - normal.x * offsetDistance;
  const spawnY = origin.y - normal.y * offsetDistance;

  const countRange = settings.particleCountMax - settings.particleCountMin;
  const particleCount = Math.round(settings.particleCountMin + this.rng.next() * countRange);
  const tierColor = tier ? this.constructor.parseHexColor(tier.color) : { r: 255, g: 200, b: 120 };

  const massScale = clamp(massGain / 5, 0.6, 2.4);

  for (let i = 0; i < particleCount; i++) {
    const spread = this.rng.range(-Math.PI / 6, Math.PI / 6);
    let dirX = Math.cos(impactAngle + spread);
    let dirY = Math.sin(impactAngle + spread);

    // Bias the burst upward slightly so the spray arcs skyward.
    dirY -= settings.upwardBias;
    const length = Math.max(1e-5, Math.sqrt(dirX * dirX + dirY * dirY));
    dirX /= length;
    dirY /= length;

    const velocityJitter = 1 + this.rng.range(-0.2, 0.4);
    const speed = settings.baseSpeed * velocityJitter * massScale;
    const lifetime = this.rng.range(settings.lifetimeMin, settings.lifetimeMax);
    const startSize = Math.max(1.5, this.rng.range(resolvedStarRadius * 0.85, resolvedStarRadius * 1.1));

    this.geyserParticles.push({
      x: spawnX,
      y: spawnY,
      vx: dirX * speed,
      vy: dirY * speed,
      lifetime,
      age: 0,
      startSize,
      size: startSize,
      color: tierColor,
      flashPhase: settings.flashFraction,
      alpha: 1,
      flashProgress: 0,
      occlusionRadius: resolvedSunRadius,
    });
  }
}

/**
 * Update dust particles.
 */
export function updateDustParticles(deltaTime) {
  const dt = deltaTime / 1000;
  const dpr = this.getEffectiveDevicePixelRatio();

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
export function updateShootingStars(deltaTime) {
  const dt = deltaTime / 1000;
  const dpr = this.getEffectiveDevicePixelRatio();

  if (this.elapsedTime >= this.nextShootingStarTime) {
    this.spawnShootingStar();
    this.scheduleNextShootingStar();
  }

  // Use the shared radius helper so launch positions orbit around the same core size used in rendering.
  const starVisualRadius = this.calculateCoreRadius();
  // Mirror the bounce scale so collision detection matches the rendered radius.
  const absorptionRadius = starVisualRadius * Math.max(0.85, 1 + this.sunBounce.offset) * dpr;
  const maxR = Math.min(this.width, this.height) / 2;

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
      const starRadius = Math.max(
        4 * dpr,
        this.calculateStarRadiusCss(star.mass, starVisualRadius) * 2 * dpr,
      );
      if (sDistSq < starRadius * starRadius) {
        // Shooting star merges into an orbiting spark and empowers it by doubling its mass.
        star.mass *= 2;
        if (this.showSpawnFlashes) {
          this.flashEffects.push({
            x: star.x / dpr,
            y: star.y / dpr,
            radius: 6,
            maxRadius: 18,
            alpha: 1.0,
            duration: 0.4,
            elapsed: 0,
          });
        }
        this.shootingStars.splice(i, 1);
        merged = true;
        break;
      }
    }
    if (merged) {
      continue;
    }

    if (dist < absorptionRadius) {
      // Shooting star slips beneath the event horizon; it is removed without altering the central mass.
      this.shootingStars.splice(i, 1);
      continue;
    }

    if (dist > maxR + 200 * dpr) {
      // Retire shooting stars that fully escape the play area.
      this.shootingStars.splice(i, 1);
    }
  }
}

/**
 * Update physics for all orbiting stars.
 */
export function updateStars(deltaTime) {
  const dt = deltaTime / 1000; // Convert to seconds
  const dpr = this.getEffectiveDevicePixelRatio();

  // Spawn new stars
  this.spawnAccumulator += dt * this.sparkSpawnRate;
  while (this.spawnAccumulator >= 1) {
    const spawned = this.spawnStar();
    if (!spawned) {
      break;
    }
    this.spawnAccumulator -= 1;
  }
  
  // Track absorptions for statistics
  let absorbedThisFrame = 0;
  let massGainedThisFrame = 0;

  // Ensure legacy trail flags respect the new simultaneous trail cap.
  if (this.trailEnabledStarCount > this.maxStarsWithTrails) {
    let trailsToDisable = this.trailEnabledStarCount - this.maxStarsWithTrails;
    for (const star of this.stars) {
      if (trailsToDisable <= 0) {
        break;
      }
      if (star.hasTrail) {
        star.hasTrail = false;
        trailsToDisable--;
        this.trailEnabledStarCount = Math.max(0, this.trailEnabledStarCount - 1);
      }
    }
  }

  // Resolve trail complexity based on current population and device settings.
  const trailSettings = this.resolveTrailRenderSettings(this.stars.length);
  this.activeTrailSettings = trailSettings;
  const allowTrails = trailSettings.mode !== 'none';
  const maxTrailLength = allowTrails
    ? Math.max(2, trailSettings.maxLength || this.baseTrailLength)
    : 0;
  const trailFadeRate = typeof trailSettings.fadeRate === 'number' ? trailSettings.fadeRate : this.trailFadeRate;

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
    const sunRadiusCss = starVisualRadius * Math.max(0.85, 1 + this.sunBounce.offset);
    const starRadiusCss = this.calculateStarRadiusCss(star.mass, starVisualRadius);
    const collisionRadiusDevice = (sunRadiusCss + starRadiusCss) * dpr;

    // Check if star should be absorbed (collision detection)
    if (dist <= collisionRadiusDevice) {
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

      const impactAngle = Math.atan2(star.y - this.centerY, star.x - this.centerX);
      const { tier, tierIndex } = this.getCurrentTier();
      const highTierStartIndex = 2; // Blue Giant and onward replace pulses with geyser bursts.
      const centerCssX = this.centerX / dpr;
      const centerCssY = this.centerY / dpr;
      const contactPoint = {
        x: centerCssX + Math.cos(impactAngle) * sunRadiusCss,
        y: centerCssY + Math.sin(impactAngle) * sunRadiusCss,
      };

      if (tierIndex >= highTierStartIndex) {
        this.spawnGeyserBurst(impactAngle, massGain, tier, contactPoint, starRadiusCss, sunRadiusCss);
      } else {
        // Create absorption shock ring for early tiers.
        this.shockRings.push({
          x: centerCssX,
          y: centerCssY,
          radius: 0,
          maxRadius: sunRadiusCss * 1.5,
          alpha: 1.0,
          duration: 0.8, // seconds
          elapsed: 0,
        });
      }

      // Remove star
      if (star.hasTrail) {
        this.trailEnabledStarCount = Math.max(0, this.trailEnabledStarCount - 1);
      }
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
    
    if (!allowTrails || !star.hasTrail) {
      star.trail.length = 0;
      continue;
    }

    // Add current position to trail
    star.trail.push({
      x: star.x,
      y: star.y,
      alpha: 1.0,
      speed: speed,
    });

    // Limit trail length based on the active complexity profile.
    if (star.trail.length > maxTrailLength) {
      star.trail.shift();
    }

    // Fade trail points
    for (const point of star.trail) {
      point.alpha = Math.max(0, point.alpha - trailFadeRate);
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
 * Update asteroids - they orbit the sun and collide with stars.
 * Asteroids maintain their fixed orbit distance from the sun.
 */
export function updateAsteroids(deltaTime) {
  const dt = deltaTime / 1000; // Convert to seconds
  const dpr = this.getEffectiveDevicePixelRatio();
  
  for (const asteroid of this.asteroids) {
    // Calculate distance to center
    const dx = this.centerX - asteroid.x;
    const dy = this.centerY - asteroid.y;
    const distSq = Math.max(dx * dx + dy * dy, this.epsilon * this.epsilon);
    const dist = Math.sqrt(distSq);
    
    // Calculate current angle
    const currentAngle = Math.atan2(asteroid.y - this.centerY, asteroid.x - this.centerX);
    
    // Calculate tangential velocity for stable orbit at fixed radius
    const orbitRadius = asteroid.orbitRadius || dist;
    const circularSpeed = Math.sqrt((this.G * this.starMass) / Math.max(orbitRadius, this.epsilon));
    
    // Set velocity to be purely tangential (perpendicular to radius)
    asteroid.vx = -Math.sin(currentAngle) * circularSpeed;
    asteroid.vy = Math.cos(currentAngle) * circularSpeed;
    
    // Update position
    asteroid.x += asteroid.vx * dt;
    asteroid.y += asteroid.vy * dt;
    
    // Correct position to maintain fixed orbit distance
    const newDx = asteroid.x - this.centerX;
    const newDy = asteroid.y - this.centerY;
    const newDist = Math.sqrt(newDx * newDx + newDy * newDy);
    if (newDist > 0.001) {
      const correctionFactor = orbitRadius / newDist;
      asteroid.x = this.centerX + newDx * correctionFactor;
      asteroid.y = this.centerY + newDy * correctionFactor;
    }
    
    // Check collision with stars
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const star = this.stars[i];
      const starDx = star.x - asteroid.x;
      const starDy = star.y - asteroid.y;
      const starDist = Math.sqrt(starDx * starDx + starDy * starDy);
      
      // Collision radius (asteroid size + star size)
      const asteroidRadius = asteroid.size * dpr / 2;
      const starVisualRadius = this.calculateCoreRadius();
      const starRadius = this.calculateStarRadiusCss(star.mass, starVisualRadius) * dpr;
      const collisionDist = asteroidRadius + starRadius;
      
      if (starDist < collisionDist) {
        // Bounce star off asteroid
        // Calculate collision normal
        const nx = starDx / starDist;
        const ny = starDy / starDist;
        
        // Relative velocity
        const relVx = star.vx - asteroid.vx;
        const relVy = star.vy - asteroid.vy;
        
        // Velocity along collision normal
        const velAlongNormal = relVx * nx + relVy * ny;
        
        // Only bounce if moving towards each other
        if (velAlongNormal < 0) {
          // Elastic collision with restitution coefficient
          const restitution = 0.8;
          const impulse = -(1 + restitution) * velAlongNormal;
          
          // Apply impulse to star (asteroid is much more massive, so it doesn't move much)
          star.vx += impulse * nx * 0.9;
          star.vy += impulse * ny * 0.9;
          
          // Separate the objects to prevent overlap
          const overlap = collisionDist - starDist;
          star.x += nx * overlap;
          star.y += ny * overlap;
        }
      }
    }
  }
}

/**
 * Update visual effects (shock rings, flash effects).
 */
export function updateEffects(deltaTime) {
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

  // Update geyser particles for high-tier absorptions.
  this.updateGeyserParticles(dt);

  // Advance the spring that powers the sun bounce so render() can apply the new scale.
  this.updateSunBounce(dt);

  // Scroll the procedural textures so surface turbulence and corona wobble stay animated.
  this.updateSurfaceAnimation(dt);
}

/**
 * Update geyser particle kinematics and fade-out.
 * @param {number} dt - Delta time in seconds
 */
export function updateGeyserParticles(dt) {
  const settings = this.visualEffectSettings.geyser;
  for (let i = this.geyserParticles.length - 1; i >= 0; i--) {
    const particle = this.geyserParticles[i];
    particle.age += dt;

    const progress = particle.age / particle.lifetime;
    if (progress >= 1) {
      this.geyserParticles.splice(i, 1);
      continue;
    }

    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += settings.gravity * dt;

    particle.size = particle.startSize * Math.max(0, 1 - progress);
    particle.alpha = Math.max(0, 1 - progress);
    particle.flashProgress = progress;
  }
}
