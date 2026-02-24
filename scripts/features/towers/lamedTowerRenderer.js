// Lamed tower render methods extracted from GravitySimulation for file size management.

import { TIER_DIAMETER_PERCENTAGES } from './lamedTowerData.js';
import { clamp } from './shared/TowerUtils.js';

/**
 * Render geyser particles with additive blending for luminous bursts.
 * Called with GravitySimulation instance as `this`.
 * @param {CanvasRenderingContext2D} ctx - Drawing context
 * @param {number} centerX - Scaled center X coordinate
 * @param {number} centerY - Scaled center Y coordinate
 * @param {number} occlusionRadius - Radius within which particles are hidden
 */
export function renderGeyserParticles(ctx, centerX, centerY, occlusionRadius) {
    if (this.geyserParticles.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const particle of this.geyserParticles) {
      const size = Math.max(0, particle.size);
      if (size <= 0) {
        continue;
      }

      const particleOcclusion = Number.isFinite(particle.occlusionRadius)
        ? particle.occlusionRadius
        : occlusionRadius;
      const occlusionLimit = Math.max(0, Math.min(occlusionRadius || 0, particleOcclusion || 0));
      if (occlusionLimit > 0) {
        const dx = particle.x - centerX;
        const dy = particle.y - centerY;
        const distSq = dx * dx + dy * dy;
        if (distSq < occlusionLimit * occlusionLimit) {
          continue;
        }
      }

      const progress = clamp(particle.flashProgress || 0, 0, 1);
      const flashActive = progress < (particle.flashPhase || 0);
      const flashAlpha = flashActive ? clamp(1 - progress / Math.max(1e-4, particle.flashPhase), 0, 1) : 0;
      const baseAlpha = particle.alpha;

      const innerAlpha = clamp(baseAlpha + flashAlpha * 0.6, 0, 1);

      // Note: Gradient caching removed because alpha values vary per particle
      // Creating gradients with changing alpha values would require cache invalidation
      const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, size);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${innerAlpha})`);
      gradient.addColorStop(0.2, `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${Math.max(0, baseAlpha)})`);
      gradient.addColorStop(1, `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
}

/**
 * Render the simulation with all visual effects.
 * Called with GravitySimulation instance as `this`.
 */
export function renderLamedSimulation() {
    if (!this.ctx) return;

    const dpr = this.getEffectiveDevicePixelRatio();
    const ctx = this.ctx;
    const activeTrailSettings = this.activeTrailSettings || this.resolveTrailRenderSettings(this.stars.length);
    const trailMode = activeTrailSettings.mode || 'full';
    
    // Clear with black background
    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(0, 0, this.width / dpr, this.height / dpr);

    // Draw the parallax starfield behind all simulation elements.
    if (this.showBackgroundStars && this.starfieldRenderer) {
      const graphicsQuality = this.isLowGraphicsModeEnabled() ? 'low' : 'high';
      // Stars start huge (matching proto-star scale) and shrink to specks as the sun grows to a black hole.
      // coreSizeState.percent tracks the sun's diameter as a fraction of canvas width:
      //   proto-star = 0.01 (1%), black hole max = 0.5 (50%).
      const protoStarPercent = TIER_DIAMETER_PERCENTAGES[0];
      const currentSunPercent = Math.max(
        this.coreSizeState?.percent ?? protoStarPercent,
        protoStarPercent,
      );
      const starSizeScale = 10 * protoStarPercent / currentSunPercent;
      this.starfieldRenderer.draw(ctx, this.width / dpr, this.height / dpr, graphicsQuality, starSizeScale);
    }
    
    // Pre-calculate scaled values used throughout rendering
    const centerXScaled = this.centerX / dpr;
    const centerYScaled = this.centerY / dpr;
    const invDpr = 1 / dpr; // Cache reciprocal for multiplication instead of division
    
    // Get current tier information
    const { tier, nextTier, progress, tierIndex } = this.getCurrentTier();
    
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

    // Derive the rendered core radius up front so blur passes and texture placement reference the same scale.
    const coreRadius = starVisualRadius * pulseScale;

    // Rebuild the cached procedural texture before any blitting occurs (only if sprites not loaded).
    if (!this.spritesLoaded) {
      this.rebuildSunSurfaceTexture(tierColor, luminosity, absorptionGlowBoost);
    }

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

    // Render shock rings beneath the core so the expanding wave emerges from behind the sun.
    ctx.save();
    for (const ring of this.shockRings) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${ring.alpha * 0.8})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Draw the sun using sprite or procedural texture
    // Map tier index to sun phase sprite (with pre-Main sequence at index 0)
    // sunPhase1.png = pre-Main sequence (Proto-star)
    // sunPhase2.png = Main Sequence
    // sunPhase3-8.png = subsequent phases
    let sunSpriteDrawn = false;
    if (this.spritesLoaded && this.sprites.sunPhases.length > 0) {
      // Use the resolved tier index so the sun sprite lookup stays aligned with mass thresholds.
      const sunPhaseIndex = Math.min(
        typeof tierIndex === 'number' ? tierIndex : 0,
        this.sprites.sunPhases.length - 1,
      );
      const sunSprite = this.sprites.sunPhases[sunPhaseIndex];
      
      if (sunSprite && sunSprite.complete) {
        ctx.save();
        // Apply luminosity to sprite opacity (use full luminosity range for visibility)
        ctx.globalAlpha = Math.min(1, luminosity);
        ctx.drawImage(
          sunSprite,
          centerXScaled - coreRadius,
          centerYScaled - coreRadius,
          coreRadius * 2,
          coreRadius * 2
        );
        ctx.restore();
        sunSpriteDrawn = true;
      }
    }
    
    if (!sunSpriteDrawn && this.surfaceCanvas) {
      // Fallback to procedural texture
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
      sunSpriteDrawn = true;
    }
    
    if (!sunSpriteDrawn) {
      // Final fallback to solid color when previous rendering attempts failed
      ctx.fillStyle = tier.color;
      ctx.beginPath();
      ctx.arc(centerXScaled, centerYScaled, coreRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw dust particles (accretion disk) using sprite or fallback
    if (this.spritesLoaded && this.sprites.spaceDust && this.sprites.spaceDust.complete) {
      const dustSprite = this.sprites.spaceDust;
      const spriteSize = 4; // Size to draw each dust particle
      const spriteSizeHalf = spriteSize * 0.5;
      
      for (const dust of this.dustParticles) {
        const dustX = dust.x * invDpr;
        const dustY = dust.y * invDpr;
        const dustAlpha = dust.life * 0.5;
        
        ctx.save();
        ctx.globalAlpha = dustAlpha;
        ctx.drawImage(
          dustSprite,
          dustX - spriteSizeHalf,
          dustY - spriteSizeHalf,
          spriteSize,
          spriteSize
        );
        ctx.restore();
      }
    } else {
      // Fallback to procedural dust
      for (const dust of this.dustParticles) {
        const dustX = dust.x * invDpr;
        const dustY = dust.y * invDpr;
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
    }

    // Render geyser particles before orbiting stars so the burst overlays the accretion disk but sits behind sparks.
    renderGeyserParticles.call(this, ctx, centerXScaled, centerYScaled, coreRadius);
    
    // Draw asteroids (always facing the sun)
    // Opacity: 100% near sun, 10% at edge based on distance
    if (this.spritesLoaded && this.sprites.asteroids.length > 0) {
      const maxRenderDistanceDefault = this.calculateMaxSpawnRadiusCss();
      for (const asteroid of this.asteroids) {
        const asteroidX = asteroid.x * invDpr;
        const asteroidY = asteroid.y * invDpr;
        const asteroidSprite = this.sprites.asteroids[asteroid.spriteIndex];
        
        if (asteroidSprite && asteroidSprite.complete && asteroidSprite.naturalWidth > 0) {
          ctx.save();
          ctx.translate(asteroidX, asteroidY);
          
          // Calculate angle to face the sun
          const dx = centerXScaled - asteroidX;
          const dy = centerYScaled - asteroidY;
          const angle = Math.atan2(dy, dx);
          
          // Calculate distance from sun for opacity
          const distFromSun = Math.sqrt(dx * dx + dy * dy);
          const sunRadius = coreRadius;
          const maxRenderDistance = asteroid.maxRenderDistance ? asteroid.maxRenderDistance * invDpr : maxRenderDistanceDefault;
          
          // Calculate opacity: 100% at sun surface, 10% at edge
          // distFromSun ranges from sunRadius to maxRenderDistance
          const normalizedDist = Math.max(0, Math.min(1, (distFromSun - sunRadius) / (maxRenderDistance - sunRadius)));
          const opacity = 1.0 - (normalizedDist * 0.9); // 1.0 at sun, 0.1 at edge
          
          // Apply opacity
          ctx.globalAlpha = opacity;
          
          // Rotate to face sun (sprite faces upward, so add 90 degrees)
          ctx.rotate(angle + Math.PI / 2);
          
          const size = asteroid.size;
          const sizeHalf = size * 0.5; // Each asteroid has unique size, so calculate per asteroid
          ctx.drawImage(
            asteroidSprite,
            -sizeHalf,
            -sizeHalf,
            size,
            size
          );
          ctx.restore();
        }
      }
    }

    // Draw shooting stars with luminous trails.
    const shootingStarSize = 8; // Size for shooting stars (constant for all)
    const shootingStarSizeHalf = shootingStarSize * 0.5;
    
    for (const shard of this.shootingStars) {
      // Guard ensures trail has at least 2 points to draw segments between
      if (shard.trail.length > 1) {
        ctx.save();
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.globalCompositeOperation = 'source-over'; // Keep shooting star trails cheap while preserving readability.
        const trailLengthInv = 1 / shard.trail.length; // Cache reciprocal (safe: length >= 2)
        for (let i = 1; i < shard.trail.length; i++) {
          const prev = shard.trail[i - 1];
          const curr = shard.trail[i];
          const progress = i * trailLengthInv; // Normalize segment position so the head stays brightest.
          const fadeAlpha = Math.max(0, curr.alpha * (1 - progress * 0.5)); // Keep more opacity near the leading edge of the streak.
          const brightness = 0.7 + (1 - progress) * 0.3; // Boost color intensity at the head for a radiant taper.
          const boostedR = Math.min(255, Math.round(shard.color.r * brightness));
          const boostedG = Math.min(255, Math.round(shard.color.g * brightness));
          const boostedB = Math.min(255, Math.round(shard.color.b * brightness));
          ctx.strokeStyle = `rgba(${boostedR}, ${boostedG}, ${boostedB}, ${fadeAlpha})`;
          ctx.beginPath();
          ctx.moveTo(prev.x * invDpr, prev.y * invDpr);
          ctx.lineTo(curr.x * invDpr, curr.y * invDpr);
          ctx.stroke();
        }
        ctx.restore();
      }

      const shardX = shard.x * invDpr;
      const shardY = shard.y * invDpr;
      
      // Use star sprite for shooting stars
      if (this.spritesLoaded && this.sprites.star && this.sprites.star.complete) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.drawImage(
          this.sprites.star,
          shardX - shootingStarSizeHalf,
          shardY - shootingStarSizeHalf,
          shootingStarSize,
          shootingStarSize
        );
        ctx.restore();
      } else {
        // Fallback to procedural circle
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(${shard.color.r}, ${shard.color.g}, ${shard.color.b}, 0.9)`;
        ctx.beginPath();
        ctx.arc(shardX, shardY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Draw orbiting stars with trails
    // Optimization: Pre-fetch palette colors outside the loop if available
    let slowColor, fastColor;
    if (this.samplePaletteGradient) {
      slowColor = this.samplePaletteGradient(0);
      fastColor = this.samplePaletteGradient(1);
    } else {
      slowColor = { r: 100, g: 150, b: 255 }; // Blueish
      fastColor = { r: 255, g: 200, b: 100 }; // Yellowish
    }
    const colorDiffR = fastColor.r - slowColor.r;
    const colorDiffG = fastColor.g - slowColor.g;
    const colorDiffB = fastColor.b - slowColor.b;

    for (const star of this.stars) {
      // Draw trail with color gradient from palette
      if (trailMode !== 'none' && star.hasTrail && star.trail.length > 1) {
        if (trailMode === 'simple') {
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          const firstPoint = star.trail[0];
          ctx.beginPath();
          ctx.moveTo(firstPoint.x * invDpr, firstPoint.y * invDpr);
          for (let i = 1; i < star.trail.length; i++) {
            const point = star.trail[i];
            ctx.lineTo(point.x * invDpr, point.y * invDpr);
          }
          ctx.stroke();
        } else {
          ctx.lineWidth = 1.5;

          // Optimization: Use pre-calculated color differences
          for (let i = 1; i < star.trail.length; i++) {
            const prev = star.trail[i - 1];
            const curr = star.trail[i];

            // Color based on speed (slow = lower palette color, fast = upper palette color)
            const normalizedSpeed = Math.min(1, curr.speed / 200);

            const r = Math.floor(slowColor.r + colorDiffR * normalizedSpeed);
            const g = Math.floor(slowColor.g + colorDiffG * normalizedSpeed);
            const b = Math.floor(slowColor.b + colorDiffB * normalizedSpeed);

            const alpha = curr.alpha * 0.5;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;

            ctx.beginPath();
            ctx.moveTo(prev.x * invDpr, prev.y * invDpr);
            ctx.lineTo(curr.x * invDpr, curr.y * invDpr);
            ctx.stroke();
          }
        }
      }
      
      // Draw star using sprite or procedural fallback
      const starX = star.x * invDpr;
      const starY = star.y * invDpr;
      const starSize = this.calculateStarRadiusCss(star.mass, starVisualRadius);
      
      if (this.spritesLoaded && this.sprites.star && this.sprites.star.complete) {
        // Use star sprite
        const spriteSize = starSize * 2.5; // Make sprite slightly larger for visibility
        ctx.save();
        ctx.globalAlpha = star.life || 1.0;
        ctx.drawImage(
          this.sprites.star,
          starX - spriteSize / 2,
          starY - spriteSize / 2,
          spriteSize,
          spriteSize
        );
        ctx.restore();
      } else {
        // Fallback to procedural star rendering
        const baseStarColor = star.color || { r: 255, g: 255, b: 255 };
        const glowColor = star.color || { r: 200, g: 220, b: 255 };
        const starGradient = ctx.createRadialGradient(
          starX, starY, 0,
          starX, starY, starSize * 2
        );
        starGradient.addColorStop(0, `rgba(${baseStarColor.r}, ${baseStarColor.g}, ${baseStarColor.b}, 1)`);
        starGradient.addColorStop(
          0.5,
          `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, 0.6)`,
        );
        starGradient.addColorStop(1, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, 0)`);

        ctx.fillStyle = starGradient;
        ctx.beginPath();
        ctx.arc(starX, starY, starSize * 2, 0, Math.PI * 2);
        ctx.fill();

        // Core star
        ctx.fillStyle = `rgb(${baseStarColor.r}, ${baseStarColor.g}, ${baseStarColor.b})`;
        ctx.beginPath();
        ctx.arc(starX, starY, starSize, 0, Math.PI * 2);
        ctx.fill();
      }
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
