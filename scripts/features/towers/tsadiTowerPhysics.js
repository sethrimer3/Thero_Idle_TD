// Tsadi tower physics and collision methods extracted from ParticleFusionSimulation.
// Each function is called via .call(this) where `this` is the simulation instance.

import {
  NULL_TIER,
  GREEK_SEQUENCE_LENGTH,
  WAVE_MIN_FORCE_THRESHOLD,
  WAVE_MIN_DISTANCE,
  WAVE_FADE_RATE,
  WAVE_EXPANSION_RATE,
  WAVE_FORCE_DECAY_LOG,
  getTierClassification,
  getGreekTierInfo,
  tierToColor,
  toDisplayTier,
  Quadtree,
} from './tsadiTowerData.js';

/**
 * Update physics for all particles.
 * Called via updateTsadiParticles.call(this, deltaTime).
 */
export function updateTsadiParticles(deltaTime) {
  const dt = deltaTime / 1000; // Convert to seconds
  const canvasWidth = this.width;
  const canvasHeight = this.height;
  const bindingRadius = this.getBindingAgentRadius();
  const bindingRepellingForce = this.baseRepellingForce * 0.5; // Keep anchors gentle but interactive.

  // Treat binding agents as first-class physics bodies so they collide and share forces with particles.
  const physicsBodies = [...this.particles];
  for (const agent of this.bindingAgents) {
    // Fade pop highlight timers so recent discoveries still glow briefly.
    agent.popTimer = Math.max(0, (agent.popTimer || 0) - dt);
    agent.radius = bindingRadius;
    agent.repellingForce = bindingRepellingForce;
    agent.isBindingAgent = true;
    physicsBodies.push(agent);
  }

  // Stagger the reentry placement queue before resuming normal spawning or physics.
  if (this.placingStoredParticles) {
    this.spawnAccumulator = 0;
    this.placeQueuedParticle();
    // Skip movement for the placement frame so particles appear stationary when restored.
    return;
  }

  // Spawn new particles (always spawn at null tier, upgrade will adjust)
  const effectiveSpawnRate = this.spawnRate * (1 + this.moleculeBonuses.spawnRateBonus);
  this.spawnAccumulator += dt * effectiveSpawnRate;
  while (this.spawnAccumulator >= 1 && this.particles.length < this.maxParticles) {
    const spawned = this.spawnParticle(NULL_TIER);
    if (!spawned) {
      break;
    }
    this.spawnAccumulator -= 1;
  }
  
  // Build quadtree for efficient neighbor finding
  this.quadtree = new Quadtree({
    x: 0,
    y: 0,
    width: canvasWidth,
    height: canvasHeight,
  });

  for (const body of physicsBodies) {
    this.quadtree.insert(body);
  }

  // Apply repelling forces between nearby particles
  this.applyRepellingForces(dt, physicsBodies);

  // Update positions
  for (const body of physicsBodies) {
    body.x += body.vx * dt;
    body.y += body.vy * dt;

    // Wall collisions (elastic)
    if (body.x - body.radius < 0) {
      body.x = body.radius;
      body.vx = Math.abs(body.vx);
    } else if (body.x + body.radius > canvasWidth) {
      body.x = canvasWidth - body.radius;
      body.vx = -Math.abs(body.vx);
    }

    if (body.y - body.radius < 0) {
      body.y = body.radius;
      body.vy = Math.abs(body.vy);
    } else if (body.y + body.radius > canvasHeight) {
      body.y = canvasHeight - body.radius;
      body.vy = -Math.abs(body.vy);
    }

    if (body.isBindingAgent) {
      // Light damping avoids runaway velocity without stealing the feeling of momentum.
      body.vx *= 0.995;
      body.vy *= 0.995;
    }
  }

  // Apply forces from interactive waves
  for (const wave of this.interactiveWaves) {
    // Skip waves with negligible force for performance
    if (wave.force < WAVE_MIN_FORCE_THRESHOLD) {
      continue;
    }
    
    for (const body of physicsBodies) {
      const dx = body.x - wave.x;
      const dy = body.y - wave.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Only affect particles within the wave's current radius
      if (dist < wave.radius && dist > WAVE_MIN_DISTANCE) {
        // Check if particle is within the directional cone (if wave has direction)
        let inCone = true;
        if (wave.direction !== null && wave.direction !== undefined) {
          // Calculate angle to particle
          const angleToParticle = Math.atan2(dy, dx);
          // Calculate difference from wave direction
          let angleDiff = angleToParticle - wave.direction;
          // Normalize to [-PI, PI]
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          // Check if within cone angle (e.g., 90 degrees = PI/2 means +/- PI/4 from center)
          const halfConeAngle = (wave.coneAngle || Math.PI * 2) / 2;
          inCone = Math.abs(angleDiff) <= halfConeAngle;
        }
        
        if (inCone) {
          const nx = dx / dist;
          const ny = dy / dist;
          
          // Force falls off with distance from wave center
          const forceFalloff = 1 - (dist / wave.radius);
          const forceMagnitude = wave.force * forceFalloff * dt;
          
          // Push particles away from wave center
          body.vx += nx * forceMagnitude;
          body.vy += ny * forceMagnitude;
        }
      }
    }
  }

  // Particle-particle collisions and fusion
  this.handleCollisions(physicsBodies);
  
  // Update fusion effects
  if (this.visualSettings.renderFusionEffects) {
    for (let i = this.fusionEffects.length - 1; i >= 0; i--) {
      const effect = this.fusionEffects[i];
      effect.alpha -= dt * 3; // Fade out over ~0.33 seconds

      if (effect.type === 'ring') {
        effect.radius += dt * 100; // Expand ring
      }

      if (effect.alpha <= 0) {
        this.fusionEffects.splice(i, 1);
      }
    }
  } else {
    this.fusionEffects.length = 0;
  }

  // Update spawn effects
  if (this.visualSettings.renderSpawnEffects) {
    for (let i = this.spawnEffects.length - 1; i >= 0; i--) {
      const effect = this.spawnEffects[i];
      effect.alpha -= dt * 4; // Fade out over ~0.25 seconds

      if (effect.type === 'wave') {
        effect.radius += dt * 150; // Expand wave
      }

      if (effect.alpha <= 0) {
        this.spawnEffects.splice(i, 1);
      }
    }
  } else {
    this.spawnEffects.length = 0;
  }
  
  // Update interactive wave effects
  for (let i = this.interactiveWaves.length - 1; i >= 0; i--) {
    const wave = this.interactiveWaves[i];
    wave.alpha -= dt * WAVE_FADE_RATE;
    wave.radius += dt * WAVE_EXPANSION_RATE;
    
    // Efficient exponential decay with numerical stability check
    const decayFactor = Math.exp(WAVE_FORCE_DECAY_LOG * dt);
    // Clamp to prevent numerical instability (force should only decay, never grow)
    wave.force *= Math.min(decayFactor, 1.0);
    
    // Remove when faded or reached max radius
    if (wave.alpha <= 0 || wave.radius >= wave.maxRadius) {
      this.interactiveWaves.splice(i, 1);
    }
  }

  this.updateBindingAgents(dt);
}

/**
 * Apply repelling or attracting forces between particles based on their tier.
 * Called via applyTsadiRepellingForces.call(this, dt, bodies).
 */
export function applyTsadiRepellingForces(dt, bodies) {
  const processedPairs = new Set();
  // Clear any previously recorded force links before evaluating the current frame.
  const collectForceLinks = this.visualSettings.renderForceLinks;
  this.forceLinks.length = 0;

  for (const p1 of bodies) {
    const candidates = this.quadtree.retrieve(p1);
    
    for (const p2 of candidates) {
      if (p1.id === p2.id) continue;
      
      const pairKey = p1.id < p2.id ? `${p1.id}-${p2.id}` : `${p2.id}-${p1.id}`;
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);
      
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Force acts within 5× each particle's radius. Use the larger influence zone so
      // big particles exert a wider field while still covering small ones.
      const p1InfluenceRadius = p1.radius * 5;
      const p2InfluenceRadius = p2.radius * 5;
      const interactionRadius = Math.max(p1InfluenceRadius, p2InfluenceRadius);
      
      // Double the visual connection distance (10×) while keeping force interaction at 5×
      const visualRadius = interactionRadius * 2;

      if (dist < interactionRadius && dist > 0.001) {
        // Average repelling force between the two particles
        const avgRepelling = (p1.repellingForce + p2.repellingForce) / 2;
        const proximityStrength = 1 - dist / interactionRadius;

        // If force is negative, particles attract; if positive, they repel
        const forceMagnitude =
          (avgRepelling + this.moleculeBonuses.repellingShift) * proximityStrength * dt * 50;
        
        const nx = dx / dist;
        const ny = dy / dist;
        
        // Apply force (negative force attracts, positive repels)
        p1.vx -= nx * forceMagnitude;
        p1.vy -= ny * forceMagnitude;
        p2.vx += nx * forceMagnitude;
        p2.vy += ny * forceMagnitude;

        // Record the interaction so the renderer can draw a connective filament.
        if (collectForceLinks) {
          this.forceLinks.push({
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            intensity: proximityStrength,
            isRepelling: forceMagnitude >= 0,
            distance: dist,
            maxDistance: visualRadius,
          });
        }
      } else if (dist < visualRadius && dist > 0.001) {
        // Show visual connection without applying force
        if (collectForceLinks) {
          // Calculate intensity based on visual radius for smooth opacity gradient
          const visualStrength = 1 - dist / visualRadius;
          this.forceLinks.push({
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            intensity: visualStrength,
            isRepelling: true, // Default to repelling color
            distance: dist,
            maxDistance: visualRadius,
          });
        }
      }
    }
  }
}

/**
 * Handle particle-particle collisions and fusion with tier progression.
 * Called via handleTsadiCollisions.call(this, bodies).
 */
export function handleTsadiCollisions(bodies) {
  const processedPairs = new Set();
  const particlesToRemove = new Set();
  const particlesToAdd = [];

  for (let i = 0; i < bodies.length; i++) {
    const p1 = bodies[i];
    if (particlesToRemove.has(p1.id)) continue;
    
    // Check for aleph particle absorbing other particles
    const p1Classification = getTierClassification(p1.tier);
    if (p1Classification.isAleph && this.alephParticleId === p1.id) {
      this.handleAlephAbsorption(p1, particlesToRemove);
      continue;
    }
    
    const candidates = this.quadtree.retrieve(p1);

    for (const p2 of candidates) {
      if (p1.id === p2.id) continue;
      if (particlesToRemove.has(p2.id)) continue;

      const pairKey = p1.id < p2.id ? `${p1.id}-${p2.id}` : `${p2.id}-${p1.id}`;
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      // Check for collision
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const distSq = dx * dx + dy * dy;
      const minDist = p1.radius + p2.radius;

      if (distSq < minDist * minDist) {
        // Collision detected
        if (p1.isBindingAgent || p2.isBindingAgent) {
          this.resolveElasticCollision(p1, p2);
        } else if (p1.tier === p2.tier) {
          // Fusion: same tier particles merge
          this.handleFusion(p1, p2, particlesToRemove, particlesToAdd);
        } else {
          // Elastic collision: different tiers
          this.resolveElasticCollision(p1, p2);
        }
      }
    }
  }
  
  // Remove fused particles
  this.particles = this.particles.filter(p => !particlesToRemove.has(p.id));
  
  // Add new particles
  this.particles.push(...particlesToAdd);
  
  if (this.onParticleCountChange) {
    this.onParticleCountChange(this.particles.length);
  }
}

/**
 * Handle fusion between two particles of the same tier.
 * Called via handleTsadiFusion.call(this, p1, p2, particlesToRemove, particlesToAdd).
 */
export function handleTsadiFusion(p1, p2, particlesToRemove, particlesToAdd) {
  const newTier = p1.tier + 1;
  const classification = getTierClassification(newTier);
  
  // Check if this is an omega tier that should explode
  const isOmegaTier = (newTier > NULL_TIER && (newTier % GREEK_SEQUENCE_LENGTH === 0));
  const omegaClassification = getTierClassification(p1.tier);
  
  if (isOmegaTier && omegaClassification.greekIndex === GREEK_SEQUENCE_LENGTH - 1) {
    // This is an omega merging into the next cycle - create explosion
    this.createTierExplosion(p1, p2, particlesToRemove, particlesToAdd);
    return;
  }
  
  // Position at midpoint of contact
  const newX = (p1.x + p2.x) / 2;
  const newY = (p1.y + p2.y) / 2;
  
  // Conserve momentum: average velocities
  const newVx = (p1.vx + p2.vx) / 2;
  const newVy = (p1.vy + p2.vy) / 2;
  
  // Create new fused particle
  const newRadius = this.getRadiusForTier(newTier);
  const newTierInfo = getGreekTierInfo(newTier);
  
  // Calculate speed with tier reduction
  const tierAboveNull = newTier - NULL_TIER;
  const speedMultiplier = Math.max(0.1, 1 - (0.1 * tierAboveNull));
  
  // Calculate repelling force
  const baseRepelling = this.baseRepellingForce;
  const repellingReduction = this.upgrades.repellingForceReduction * 0.5;
  const repellingMultiplier = tierAboveNull - repellingReduction;
  const repellingForce = baseRepelling * repellingMultiplier;
  
  const newParticle = {
    x: newX,
    y: newY,
    vx: newVx,
    vy: newVy,
    radius: newRadius,
    tier: newTier,
    color: tierToColor(newTier, this.samplePaletteGradient),
    label: newTierInfo.letter,
    id: Math.random(),
    repellingForce,
    speedMultiplier,
  };
  
  // Check if this is the first aleph particle
  if (classification.isAleph && !this.alephParticleId) {
    this.alephParticleId = newParticle.id;
    this.alephAbsorptionCount = 0;
  }
  
  particlesToAdd.push(newParticle);
  
  // Mark old particles for removal
  particlesToRemove.add(p1.id);
  particlesToRemove.add(p2.id);
  
  // Add fusion effects
  if (this.visualSettings.renderFusionEffects) {
    this.fusionEffects.push(
      { x: newX, y: newY, radius: newRadius * 1.2, alpha: 1, type: 'flash' },
      { x: newX, y: newY, radius: newRadius, alpha: 0.8, type: 'ring' },
    );
  }
  
  // Update highest tier
  if (newTier > this.highestTierReached) {
    this.highestTierReached = newTier;
    // Tsadi glyphs equal the highest tier reached (display tier)
    this.glyphCount = toDisplayTier(this.highestTierReached);
    if (this.onGlyphChange) {
      this.onGlyphChange(this.glyphCount);
    }
    if (this.onTierChange) {
      this.onTierChange({
        tier: newTier,
        name: newTierInfo.name,
        letter: newTierInfo.letter,
      });
    }
    this.areAdvancedMoleculesUnlocked();
  }
}

/**
 * Create an explosion when omega tiers merge, spawning next tier particles.
 * Called via createTsadiTierExplosion.call(this, p1, p2, particlesToRemove, particlesToAdd).
 */
export function createTsadiTierExplosion(p1, p2, particlesToRemove, particlesToAdd) {
  const explosionX = (p1.x + p2.x) / 2;
  const explosionY = (p1.y + p2.y) / 2;
  
  // Determine which tier to spawn
  const nextCycleTier = p1.tier + 1;
  const newRadius = this.getRadiusForTier(nextCycleTier);
  
  // Mark old particles for removal
  particlesToRemove.add(p1.id);
  particlesToRemove.add(p2.id);
  
  // Add large explosion effect
  if (this.visualSettings.renderFusionEffects) {
    this.fusionEffects.push(
      { x: explosionX, y: explosionY, radius: newRadius * 3, alpha: 1, type: 'flash' },
      { x: explosionX, y: explosionY, radius: newRadius * 2, alpha: 1, type: 'ring' },
    );
  }
  
  // Spawn 10 particles of the next tier in a circle
  const numSpawned = 10;
  const spawnRadius = newRadius * 3;
  
  for (let i = 0; i < numSpawned; i++) {
    const angle = (i / numSpawned) * Math.PI * 2;
    const x = explosionX + Math.cos(angle) * spawnRadius;
    const y = explosionY + Math.sin(angle) * spawnRadius;
    
    // Ensure particles stay within bounds
    const clampedX = Math.max(newRadius, Math.min(this.width - newRadius, x));
    const clampedY = Math.max(newRadius, Math.min(this.height - newRadius, y));
    
    // Velocity pointing outward from explosion
    const speed = this.baseSpeed * 0.5;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    
    const tierInfo = getGreekTierInfo(nextCycleTier);
    
    // Calculate tier-based properties
    const tierAboveNull = nextCycleTier - NULL_TIER;
    const speedMultiplier = Math.max(0.1, 1 - (0.1 * tierAboveNull));
    const baseRepelling = this.baseRepellingForce;
    const repellingReduction = this.upgrades.repellingForceReduction * 0.5;
    const repellingMultiplier = tierAboveNull - repellingReduction;
    const repellingForce = baseRepelling * repellingMultiplier;
    
    particlesToAdd.push({
      x: clampedX,
      y: clampedY,
      vx,
      vy,
      radius: newRadius,
      tier: nextCycleTier,
      color: tierToColor(nextCycleTier, this.samplePaletteGradient),
      label: tierInfo.letter,
      id: Math.random(),
      repellingForce,
      speedMultiplier,
    });
  }
  
  // Update highest tier
  if (nextCycleTier > this.highestTierReached) {
    this.highestTierReached = nextCycleTier;
    // Tsadi glyphs equal the highest tier reached (display tier)
    this.glyphCount = toDisplayTier(this.highestTierReached);
    if (this.onGlyphChange) {
      this.onGlyphChange(this.glyphCount);
    }
    const tierInfo = getGreekTierInfo(nextCycleTier);
    if (this.onTierChange) {
      this.onTierChange({
        tier: nextCycleTier,
        name: tierInfo.name,
        letter: tierInfo.letter,
      });
    }
    this.areAdvancedMoleculesUnlocked();
  }
}

/**
 * Handle aleph particle absorbing other particles.
 * Called via handleTsadiAlephAbsorption.call(this, alephParticle, particlesToRemove).
 */
export function handleTsadiAlephAbsorption(alephParticle, particlesToRemove) {
  const candidates = this.quadtree.retrieve(alephParticle);
  
  for (const other of candidates) {
    if (other.id === alephParticle.id) continue;
    if (particlesToRemove.has(other.id)) continue;
    
    const dx = other.x - alephParticle.x;
    const dy = other.y - alephParticle.y;
    const distSq = dx * dx + dy * dy;
    const minDist = alephParticle.radius + other.radius;
    
    if (distSq < minDist * minDist) {
      // Absorb this particle
      particlesToRemove.add(other.id);
      this.alephAbsorptionCount++;
      
      // Add small absorption effect
      if (this.visualSettings.renderFusionEffects) {
        this.fusionEffects.push({
          x: other.x,
          y: other.y,
          radius: other.radius * 1.5,
          alpha: 0.8,
          type: 'flash',
        });
      }
      
      // Check if aleph has absorbed 1000 particles
      if (this.alephAbsorptionCount >= 1000) {
        this.triggerAlephExplosion(alephParticle, particlesToRemove);
      }
    }
  }
}

/**
 * Trigger the final aleph explosion, awarding glyphs and resetting.
 * Called via triggerTsadiAlephExplosion.call(this, alephParticle, particlesToRemove).
 */
export function triggerTsadiAlephExplosion(alephParticle, particlesToRemove) {
  // Remove the aleph particle
  particlesToRemove.add(alephParticle.id);
  this.alephParticleId = null;
  this.alephAbsorptionCount = 0;
  
  // Add massive explosion effect
  if (this.visualSettings.renderFusionEffects) {
    this.fusionEffects.push(
      { x: alephParticle.x, y: alephParticle.y, radius: this.width / 2, alpha: 1, type: 'flash' },
      { x: alephParticle.x, y: alephParticle.y, radius: this.width / 3, alpha: 1, type: 'ring' },
    );
  }
  
  // Tsadi glyphs are based on highest tier reached (no bonus for Aleph explosion)
  // The glyphCount was already updated when reaching this tier
  
  // Add permanent glyph to background
  this.permanentGlyphs.push({
    x: Math.random() * this.width,
    y: Math.random() * this.height,
    alpha: 0.2 + Math.random() * 0.3,
    size: 20 + Math.random() * 30,
  });
  
  // Reset simulation after a brief delay
  setTimeout(() => {
    this.resetSimulation();
  }, 1000);
}

/**
 * Reset the simulation while maintaining glyph count.
 * Called via resetTsadiSimulation.call(this).
 */
export function resetTsadiSimulation() {
  this.particles = [];
  this.highestTierReached = NULL_TIER;
  this.advancedMoleculesUnlocked = false;
  this.fusionEffects = [];
  this.alephParticleId = null;
  this.alephAbsorptionCount = 0;

  for (const agent of this.bindingAgents) {
    agent.connections = [];
    agent.activeMolecules = [];
    agent.pendingDiscoveries = [];
    agent.awaitingCodexTap = false;
  }
  this.pendingMoleculeIds.clear();
  this.recalculateMoleculeBonuses();

  // Respawn initial particles
  this.spawnInitialParticles();
  
  if (this.onReset) {
    this.onReset();
  }
  
  if (this.onParticleCountChange) {
    this.onParticleCountChange(this.particles.length);
  }
}

/**
 * Resolve elastic collision between two particles.
 * Called via resolveTsadiElasticCollision.call(this, p1, p2).
 */
export function resolveTsadiElasticCollision(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist < 0.001) return; // Avoid division by zero
  
  // Normalize collision vector
  const nx = dx / dist;
  const ny = dy / dist;
  
  // Relative velocity
  const dvx = p1.vx - p2.vx;
  const dvy = p1.vy - p2.vy;
  
  // Relative velocity in collision normal direction
  const dvn = dvx * nx + dvy * ny;
  
  // Don't resolve if velocities are separating
  if (dvn > 0) return;
  
  // Use radius as proxy for mass (larger particles have more inertia)
  const m1 = p1.radius * p1.radius;
  const m2 = p2.radius * p2.radius;
  
  // Collision impulse scalar
  const impulse = 2 * dvn / (m1 + m2);
  
  // Apply impulse
  p1.vx -= impulse * m2 * nx;
  p1.vy -= impulse * m2 * ny;
  p2.vx += impulse * m1 * nx;
  p2.vy += impulse * m1 * ny;
  
  // Separate particles to prevent overlap
  const overlap = (p1.radius + p2.radius) - dist;
  if (overlap > 0) {
    const separationX = (overlap / 2) * nx;
    const separationY = (overlap / 2) * ny;
    p1.x -= separationX;
    p1.y -= separationY;
    p2.x += separationX;
    p2.y += separationY;
  }
}
