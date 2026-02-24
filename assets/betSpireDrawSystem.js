// Bet Spire main animation loop and draw helper methods extracted from BetSpireRender.
// All functions are standalone exports designed for .call(this) delegation from BetSpireRender.

import {
  TWO_PI,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TRAIL_FADE,
  MAX_FRAME_TIME_MS,
  TARGET_FRAME_TIME_MS,
  PERFORMANCE_THRESHOLD,
  PERF_WARN_MIN_PARTICLES,
  PERF_WARN_COOLDOWN_MS,
  SPAWNER_ROTATION_SPEED,
  FORGE_ROTATION_SPEED,
  SHOCKWAVE_DURATION,
  SHOCKWAVE_MAX_RADIUS,
  SHOCKWAVE_EDGE_THICKNESS,
  SHOCKWAVE_PUSH_FORCE,
  INTERACTION_FADE_DURATION,
  PARTICLE_TIERS,
  SPAWNER_POSITIONS,
  PI_OVER_SIX,
  SPAWNER_SIZE,
  SPAWNER_GRAVITY_RADIUS,
  SPAWNER_COLOR_BRIGHTNESS_OFFSET,
  SPAWNER_SPRITE_SIZE,
  createTintedSpriteCanvas,
  HALF,
} from './betSpireConfig.js';

export function animate() {
  if (!this.isRunning) return;

  // Track frame progression so merge attempts can insert a one-frame pause between batches.
  this.frameCounter += 1;
  if (this.mergeCooldownFrames > 0) {
    this.mergeCooldownFrames -= 1; // Count down the inter-merge cooldown
  }

  const frameStartTime = performance.now(); // Track frame start time for performance monitoring
  const deltaTimeMs = Math.min(frameStartTime - this.lastFrameTime, MAX_FRAME_TIME_MS * 4); // Clamp to avoid huge catch-up steps
  const deltaFrameRatio = deltaTimeMs / TARGET_FRAME_TIME_MS || 1; // Scale motion relative to 60fps baseline
  this.lastFrameTime = frameStartTime;
  const now = Date.now(); // Track current time for animations
  
  // Apply smooth rendering setting
  this.ctx.imageSmoothingEnabled = this.smoothRenderingEnabled;
  
  // Create trail effect by drawing semi-transparent black over the canvas
  // If trails are disabled, draw fully opaque black to clear the canvas completely
  const trailFade = this.particleTrailsEnabled ? TRAIL_FADE : 1.0;
  this.ctx.fillStyle = `rgba(0, 0, 0, ${trailFade})`;
  this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  
  // Update spawner rotations so paired triangles spin in opposing directions like the central forge.
  this.spawnerRotations.forEach((rotation, tierId) => {
    this.spawnerRotations.set(tierId, rotation + SPAWNER_ROTATION_SPEED * deltaFrameRatio);
  });

  // Check for forge crunch effect (valid particles for 5 seconds)
  this.checkForgeCreunch(now);
  
  // Update forge crunch animation
  this.updateForgeCrunch(now);

  // Accelerate forge spin during crunches so the animation ramps up and down.
  const forgeRotationMultiplier = this.getForgeRotationSpeedMultiplier(now);
  this.forgeRotation += FORGE_ROTATION_SPEED * forgeRotationMultiplier * deltaFrameRatio;
  
  // Draw the forge (Star of David with counter-rotating triangles)
  this.drawForge();
  
  // Draw forge influence ring
  this.drawForgeInfluenceRing();

  // Draw particle spawners for unlocked tiers
  this.drawSpawners();
  
  // Draw forge crunch effect
  this.drawForgeCrunch();
  
  // Draw gem awards from forge crunches
  this.drawCrunchGemAwards(now);

  // Gather gravity sources for unlocked spawners so nearby particles feel a local pull.
  const activeSpawners = this.getActiveSpawnerGravityFields();
  
  // Process spawn queue for gradual particle restoration
  this.processSpawnQueue();
  
  // Process active merges
  this.processActiveMerges();
  
  // Apply shockwave forces and draw shockwaves
  if (this.mergeShockwavesEnabled) {
    // Apply shockwave forces and draw shockwaves while merge bursts are enabled.
    this.shockwaves = this.shockwaves.filter(shockwave => {
    const elapsed = now - shockwave.timestamp;
    const progress = elapsed / SHOCKWAVE_DURATION;
    
    if (progress >= 1) return false; // Remove completed shockwaves
    
    // Expand shockwave radius
    shockwave.radius = SHOCKWAVE_MAX_RADIUS * progress;
    shockwave.alpha = 0.8 * (1 - progress);
    
    // Performance optimization: Calculate maximum distance a particle can be from shockwave
    // to be affected by its force. Includes SHOCKWAVE_EDGE_THICKNESS because particles
    // within this distance from the expanding edge receive push force.
    // Only check particles within this range to avoid O(shockwaves × all_particles).
    const maxEffectDistance = SHOCKWAVE_MAX_RADIUS + SHOCKWAVE_EDGE_THICKNESS;
    
    // Apply push force to nearby particles
    for (const particle of this.particles) {
      // Skip particles that are merging
      if (particle.merging) continue;
      
      const dx = particle.x - shockwave.x;
      const dy = particle.y - shockwave.y;
      
      // Early bailout: Skip particles that are too far from shockwave center
      // This reduces complexity from O(all_particles) to O(nearby_particles)
      const distSquared = dx * dx + dy * dy;
      if (distSquared > maxEffectDistance * maxEffectDistance) continue;
      
      const dist = Math.sqrt(distSquared);
      
      // Apply force if particle is near the expanding shockwave edge
      if (Math.abs(dist - shockwave.radius) < SHOCKWAVE_EDGE_THICKNESS && dist > 0) {
        const angle = Math.atan2(dy, dx);
        const force = SHOCKWAVE_PUSH_FORCE * (1 - progress); // Force diminishes over time
        particle.vx += Math.cos(angle) * force;
        particle.vy += Math.sin(angle) * force;
      }
    }
    
    // Draw shockwave ring
    const color = shockwave.color;
    this.ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${shockwave.alpha})`;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(shockwave.x, shockwave.y, shockwave.radius, 0, TWO_PI); // Use pre-calculated constant
    this.ctx.stroke();
    
    return true; // Keep shockwave for next frame
    });
  } else if (this.shockwaves.length > 0) {
    // Clear shockwaves immediately when merge bursts are disabled.
    this.shockwaves = [];
  }
  
  // Draw and fade interaction circles
  this.interactionCircles = this.interactionCircles.filter(circle => {
    const elapsed = now - circle.timestamp;
    const progress = elapsed / INTERACTION_FADE_DURATION;
    
    if (progress >= 1) return false; // Remove faded circles
    
    // Draw fading circle
    const alpha = circle.alpha * (1 - progress);
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(circle.x, circle.y, circle.radius, 0, TWO_PI); // Use pre-calculated constant
    this.ctx.stroke();
    
    return true; // Keep circle for next frame
  });
  
  // Performance optimization: When particle count is high, reduce update frequency
  const isHighParticleCount = this.particles.length > PERFORMANCE_THRESHOLD;
  const updateInterval = isHighParticleCount ? 2 : 1; // Update every 2nd frame when high
  
  // Bucket particles by draw style so canvas state only changes a handful of times even with thousands of particles.
  const drawBuckets = new Map();

  // Update particles and collect their draw intents
  for (let i = 0; i < this.particles.length; i++) {
    const particle = this.particles[i];

    // When performance is stressed, only update every nth particle per frame
    if (!isHighParticleCount || i % updateInterval === (now % updateInterval)) {
      // Pass developer toggles so particle updates can apply optional gravity behaviors.
      particle.update(
        this.forge,
        activeSpawners,
        deltaFrameRatio,
        now,
        this.particleVeerEnabled,
        this.smallTierGeneratorGravityEnabled,
        this.mediumTierForgeGravityEnabled
      );
    }

    const styleKey = particle.getDrawStyleKey();
    if (!drawBuckets.has(styleKey)) {
      drawBuckets.set(styleKey, { style: particle.getDrawStyle(), positions: [] });
    }

    const bucket = drawBuckets.get(styleKey);
    bucket.positions.push({ x: particle.x, y: particle.y });
  }

  // Draw each bucket in a single fill pass to minimize expensive shadow/style switches.
  this.drawBatchedParticles(drawBuckets);
  
  // Periodically attempt to merge particles (size merging)
  // Increase merge frequency when particle count is high
  const mergeChance = isHighParticleCount ? 0.1 : 0.03; // Faster size merges to keep up with higher spawn rates
  if (Math.random() < mergeChance) {
    this.attemptMerge();
  }
  
  // Periodically attempt tier conversion at generators
  if (Math.random() < 0.01) { // 1% chance per frame
    this.attemptTierConversion();
  }
  
  // Periodically attempt large particle tier merging for performance (100 large → 10 large of next tier)
  // More frequent when particle count is high
  const largeMergeChance = isHighParticleCount ? 0.05 : 0.01;
  if (Math.random() < largeMergeChance) {
    this.attemptLargeTierMerge();
  }
  
  // Enforce particle limit periodically
  if (isHighParticleCount && Math.random() < 0.1) { // 10% chance when high count
    this.enforceParticleLimit();
  }
  
  // Periodically check for particle factor milestones
  if (Math.random() < 0.01) { // 1% chance per frame
    const glyphsAwarded = this.checkParticleFactorMilestone();
    if (glyphsAwarded > 0) {
      // Trigger an event or notification that glyphs were awarded
      const event = new CustomEvent('betGlyphsAwarded', { detail: { count: glyphsAwarded } });
      this.canvas.dispatchEvent(event);
    }
  }
  
  // Track frame time for performance monitoring
  const frameTime = performance.now() - frameStartTime;
  const shouldWarnForFrameTime = frameTime > MAX_FRAME_TIME_MS * 2
    && this.particles.length >= PERF_WARN_MIN_PARTICLES;
  if (shouldWarnForFrameTime) {
    const nowMs = Date.now();
    // Throttle frame warnings so intermittent spikes do not flood the console.
    if (nowMs - this.lastPerformanceWarningAt >= PERF_WARN_COOLDOWN_MS) {
      this.lastPerformanceWarningAt = nowMs;
      console.warn(`Bet Spire frame took ${frameTime.toFixed(2)}ms with ${this.particles.length} particles`);
    }
  }
  
  this.animationId = requestAnimationFrame(this.animate);
}

// Batch particle draw calls by style so canvas state (fill, shadow) changes happen at most once per tier-size combo.
export function drawBatchedParticles(drawBuckets) {
  const ctx = this.ctx;

  drawBuckets.forEach(({ style, positions }) => {
    const halfSize = style.size * HALF; // Use pre-calculated HALF constant
    const drawSize = Math.ceil(style.size);

    ctx.fillStyle = style.colorString;

    if (style.glowColorString) {
      ctx.shadowBlur = style.size * 3;
      ctx.shadowColor = style.glowColorString;
    } else {
      ctx.shadowBlur = 0;
    }

    positions.forEach(({ x, y }) => {
      ctx.fillRect(
        Math.floor(x - halfSize),
        Math.floor(y - halfSize),
        drawSize,
        drawSize
      );
    });
  });

  ctx.shadowBlur = 0; // Reset so later draws are unaffected by any glow buckets.
}

// Cache a pair of tinted generator sprites (clockwise/counter) for a tier so coloring happens once.
export function cacheGeneratorSpritesForTier(tierId, sourceImage) {
  const tier = PARTICLE_TIERS.find(entry => entry.id === tierId);
  if (!tier) {
    return;
  }

  const baseColor = tier.color;
  const brighterColor = {
    r: Math.min(255, baseColor.r + SPAWNER_COLOR_BRIGHTNESS_OFFSET),
    g: Math.min(255, baseColor.g + SPAWNER_COLOR_BRIGHTNESS_OFFSET),
    b: Math.min(255, baseColor.b + SPAWNER_COLOR_BRIGHTNESS_OFFSET),
  };
  const spriteSize = Math.ceil(SPAWNER_SPRITE_SIZE);

  this.generatorSpriteCache.set(tierId, {
    clockwise: createTintedSpriteCanvas(sourceImage, baseColor, spriteSize),
    counterClockwise: createTintedSpriteCanvas(sourceImage, brighterColor, spriteSize),
    size: spriteSize,
  });
}

export function drawSpawners() {
  const ctx = this.ctx;
  const now = Date.now();
  
  // Draw a mini forge for each unlocked particle tier
  // Each tier is positioned at its corresponding generator position
  this.unlockedTiers.forEach((tierId) => {
    const tier = PARTICLE_TIERS.find(t => t.id === tierId);
    if (!tier) return;
    
    const tierIndex = PARTICLE_TIERS.findIndex(t => t.id === tierId);
    if (tierIndex < 0 || tierIndex >= SPAWNER_POSITIONS.length) return; // Safety check
    
    const position = SPAWNER_POSITIONS[tierIndex];
    const rotation = this.spawnerRotations.get(tierId) || 0;
    
    // Calculate fade-in opacity
    let opacity = 1;
    const fadeIn = this.generatorFadeIns.get(tierId);
    if (fadeIn) {
      const elapsed = now - fadeIn.startTime;
      if (elapsed < fadeIn.duration) {
        // Ease-in fade from 0 to 1
        opacity = elapsed / fadeIn.duration;
        opacity = opacity * opacity; // Square for ease-in effect
      } else {
        // Animation complete, remove from tracking
        this.generatorFadeIns.delete(tierId);
      }
    }
    
    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.globalAlpha = opacity;
    
    // Create color string from tier color
    const color = tier.color;
    const colorString = `rgba(${color.r}, ${color.g}, ${color.b}, 0.7)`;

    // Draw the generator's influence ring to visualize its pull radius.
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.1)`;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, SPAWNER_GRAVITY_RADIUS, 0, TWO_PI); // Use pre-calculated constant
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw cached generator sprites when available so they render as tinted art instead of vectors.
    const spriteSet = this.generatorSpriteCache.get(tierId);
    if (spriteSet) {
      const halfSize = spriteSet.size * HALF; // Use pre-calculated HALF constant
      // Draw first sprite (clockwise spin).
      ctx.rotate(rotation);
      ctx.drawImage(spriteSet.clockwise, -halfSize, -halfSize, spriteSet.size, spriteSet.size);
      // Draw second sprite (counter-clockwise spin).
      ctx.rotate(-rotation * 2);
      ctx.drawImage(spriteSet.counterClockwise, -halfSize, -halfSize, spriteSet.size, spriteSet.size);
    } else {
      // Fallback to vector triangles if the sprite has not loaded yet.
      ctx.rotate(rotation);
      ctx.strokeStyle = colorString;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -SPAWNER_SIZE);
      ctx.lineTo(SPAWNER_SIZE * Math.cos(PI_OVER_SIX), SPAWNER_SIZE * Math.sin(PI_OVER_SIX)); // Use pre-calculated constant
      ctx.lineTo(-SPAWNER_SIZE * Math.cos(PI_OVER_SIX), SPAWNER_SIZE * Math.sin(PI_OVER_SIX)); // Use pre-calculated constant
      ctx.closePath();
      ctx.stroke();
      
      ctx.rotate(-rotation * 2);
      const lightColorString = `rgba(${Math.min(255, color.r + SPAWNER_COLOR_BRIGHTNESS_OFFSET)}, ${Math.min(255, color.g + SPAWNER_COLOR_BRIGHTNESS_OFFSET)}, ${Math.min(255, color.b + SPAWNER_COLOR_BRIGHTNESS_OFFSET)}, 0.6)`;
      ctx.strokeStyle = lightColorString;
      ctx.beginPath();
      ctx.moveTo(0, SPAWNER_SIZE);
      ctx.lineTo(SPAWNER_SIZE * Math.cos(PI_OVER_SIX), -SPAWNER_SIZE * Math.sin(PI_OVER_SIX)); // Use pre-calculated constant
      ctx.lineTo(-SPAWNER_SIZE * Math.cos(PI_OVER_SIX), -SPAWNER_SIZE * Math.sin(PI_OVER_SIX)); // Use pre-calculated constant
      ctx.closePath();
      ctx.stroke();
    }
    
    // Draw center glow with tier color (only if glow is enabled)
    if (this.forgeGlowEnabled) {
      ctx.rotate(rotation); // Rotate back to center
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, SPAWNER_SIZE);
      gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.4)`);
      gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, SPAWNER_SIZE, 0, TWO_PI); // Use pre-calculated constant
      ctx.fill();
    }
    
    ctx.restore();
  });
}
