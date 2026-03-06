// Bet Spire Forge System
// Forge crunch state management and rendering extracted from betSpireRender.js.
// All functions are standalone exports designed for .call(this) delegation from BetSpireRender.

import { moteGemState, resolveGemDefinition } from './enemies.js';
import {
  PI,
  TWO_PI,
  PI_OVER_SIX,
  HALF,
  FORGE_RADIUS,
  MAX_FORGE_ATTRACTION_DISTANCE,
  PARTICLE_FACTOR_EXPONENT_INCREMENT,
  PARTICLE_TIERS,
  SMALL_SIZE_INDEX,
  MEDIUM_SIZE_INDEX,
  LARGE_SIZE_INDEX,
  EXTRA_LARGE_SIZE_INDEX,
  SIZE_SMALL_EQUIVALENTS,
} from './betSpireConfig.js';

// Check for valid particles in the forge and handle crunch effect
export function checkForgeCreunch(now) {
  // Skip if promotion is disabled
  if (!this.particlePromotionEnabled) {
    this.forgeValidParticlesTimer = null;
    return;
  }

  // If crunch is already active, don't check for new valid particles
  if (this.forgeCrunchActive) {
    return;
  }

  // Find extra-large particles within forge radius that can be upgraded.
  const validParticles = [];
  
  PARTICLE_TIERS.forEach((tier, tierIndex) => {
    const isNullstone = tier.id === 'nullstone';
    
    this.particles.forEach(particle => {
      if (particle.tierId !== tier.id || particle.merging) return;
      
      // Only medium, large, and extra-large particles can be upgraded; nullstone can be crunched at any size.
      if (!isNullstone
        && particle.sizeIndex !== MEDIUM_SIZE_INDEX
        && particle.sizeIndex !== LARGE_SIZE_INDEX
        && particle.sizeIndex !== EXTRA_LARGE_SIZE_INDEX) return;
      
      // Check tier conversion limits based on particle size
      if (!isNullstone) {
        if (particle.sizeIndex === EXTRA_LARGE_SIZE_INDEX) {
          // Extra-large particles jump 2 tiers, so can't convert last two tiers
          if (tierIndex >= PARTICLE_TIERS.length - 2) return;
        } else if (particle.sizeIndex === MEDIUM_SIZE_INDEX || particle.sizeIndex === LARGE_SIZE_INDEX) {
          // Medium/large particles jump 1 tier, so can't convert last tier
          if (tierIndex >= PARTICLE_TIERS.length - 1) return;
        }
      }
      
      // Check if particle is within forge radius
      const dx = particle.x - this.forge.x;
      const dy = particle.y - this.forge.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= FORGE_RADIUS) {
        validParticles.push(particle);
      }
    });
  });

  // If there are valid particles, start or continue the timer
  if (validParticles.length > 0) {
    if (!this.forgeValidParticlesTimer) {
      this.forgeValidParticlesTimer = now;
    } else {
      // Check if 5 seconds have passed
      const elapsed = now - this.forgeValidParticlesTimer;
      if (elapsed >= this.FORGE_VALID_WAIT_TIME) {
        // Start the crunch animation
        this.startForgeCrunch(validParticles, now);
      }
    }
  } else {
    // No valid particles, reset timer
    this.forgeValidParticlesTimer = null;
  }
}

// Start the forge crunch animation and mark particles for upgrade
export function startForgeCrunch(validParticles, now) {
  this.forgeCrunchActive = true;
  this.forgeCrunchStartTime = now;
  this.forgeCrunchProgress = 0;
  
  // Mark all valid particles for upgrade and attract them to forge center
  validParticles.forEach(particle => {
    particle.merging = true;
    particle.mergeTarget = { x: this.forge.x, y: this.forge.y };
    particle.forgeCrunchParticle = true; // Mark for crunch upgrade
  });
  
  // Reset the timer
  this.forgeValidParticlesTimer = null;
}

// Update the forge crunch animation
export function updateForgeCrunch(now) {
  if (!this.forgeCrunchActive) return;

  const elapsed = now - this.forgeCrunchStartTime;
  this.forgeCrunchProgress = Math.min(elapsed / this.FORGE_CRUNCH_DURATION, 1);

  // When animation completes, upgrade all marked particles
  if (this.forgeCrunchProgress >= 1) {
    this.completeForgeCrunch();
  }
}

// Scale the forge spin through three phases:
// 1. Spin up for 4 seconds before crunch (when valid particles are present)
// 2. Maximum speed during crunch (1 second)
// 3. Spin down for 3 seconds after crunch
export function getForgeRotationSpeedMultiplier(now) {
  // Phase 3: Spin-down after crunch completes
  if (this.forgeCrunchEndTime) {
    const timeSinceEnd = now - this.forgeCrunchEndTime;
    if (timeSinceEnd < this.FORGE_SPIN_DOWN_DURATION) {
      // Ease out from 3x back to 1x over 3 seconds
      const progress = timeSinceEnd / this.FORGE_SPIN_DOWN_DURATION;
      const easeOut = 1 - Math.pow(1 - progress, 2); // Quadratic ease-out
      return 3 - (2 * easeOut); // Goes from 3 to 1
    } else {
      // Spin-down complete
      this.forgeCrunchEndTime = null;
      return 1;
    }
  }

  // Phase 2: During crunch - maintain maximum speed
  if (this.forgeCrunchActive) {
    return 3;
  }

  // Phase 1: Spin-up when valid particles are waiting
  if (this.forgeValidParticlesTimer) {
    const elapsed = now - this.forgeValidParticlesTimer;
    // Start spinning up in the last 4 seconds before crunch
    const timeUntilCrunch = this.FORGE_VALID_WAIT_TIME - elapsed;
    if (timeUntilCrunch <= this.FORGE_SPIN_UP_DURATION) {
      // Ease in from 1x to 3x over 4 seconds
      const spinUpElapsed = this.FORGE_SPIN_UP_DURATION - timeUntilCrunch;
      const progress = spinUpElapsed / this.FORGE_SPIN_UP_DURATION;
      const easeIn = progress * progress; // Quadratic ease-in
      return 1 + (2 * easeIn); // Goes from 1 to 3
    }
  }

  // No special state - base speed
  return 1;
}

// Translate a particle size into its small-equivalent count for nullstone crunch rewards.
export function getSmallEquivalentForSize(sizeIndex) {
  return SIZE_SMALL_EQUIVALENTS[sizeIndex] || 1;
}

// Complete the forge crunch and upgrade particles
export function completeForgeCrunch() {
  // Find all particles marked for crunch upgrade
  const crunchParticles = this.particles.filter(p => p.forgeCrunchParticle && p.merging);

  // Separate nullstone crunches so they can boost the particle factor exponent.
  const nullstoneParticles = [];
  let nullstoneSmallEquivalent = 0;
  
  // Group by tier for tier conversion
  const particlesByTier = new Map();
  crunchParticles.forEach(particle => {
    if (particle.tierId === 'nullstone') {
      nullstoneParticles.push(particle);
      nullstoneSmallEquivalent += this.getSmallEquivalentForSize(particle.sizeIndex);
      return;
    }
    if (!particlesByTier.has(particle.tierId)) {
      particlesByTier.set(particle.tierId, []);
    }
    particlesByTier.get(particle.tierId).push(particle);
  });

  // Track gems to award for floating feedback
  const gemsToAward = new Map(); // tierId -> count

  // Convert particles based on their size: medium particles jump 1 tier, extra-large jump 2 tiers.
  particlesByTier.forEach((particles, tierId) => {
    const tierIndex = PARTICLE_TIERS.findIndex(t => t.id === tierId);
    if (tierIndex < 0) return;
    
    particles.forEach(particle => {
      // Determine conversion based on particle size
      let targetTierIndex;
      let outputSizeIndex;
      let targetTierId;
      
      if (particle.sizeIndex === MEDIUM_SIZE_INDEX) {
        // Medium particles: jump 1 tier up and output small particles
        targetTierIndex = tierIndex + 1;
        outputSizeIndex = SMALL_SIZE_INDEX;
        
        // Check if we can upgrade (not at the last tier)
        if (targetTierIndex >= PARTICLE_TIERS.length) return;
        targetTierId = PARTICLE_TIERS[targetTierIndex].id;
      } else if (particle.sizeIndex === LARGE_SIZE_INDEX) {
        // Large particles: jump 1 tier up and output medium particles.
        targetTierIndex = tierIndex + 1;
        outputSizeIndex = MEDIUM_SIZE_INDEX;

        // Check if we can upgrade (not at the last tier)
        if (targetTierIndex >= PARTICLE_TIERS.length) return;
        targetTierId = PARTICLE_TIERS[targetTierIndex].id;
      } else if (particle.sizeIndex === EXTRA_LARGE_SIZE_INDEX) {
        // Extra-large particles: jump 2 tiers up and output large particles
        targetTierIndex = tierIndex + 2;
        outputSizeIndex = LARGE_SIZE_INDEX;
        
        // Check if we can upgrade (not at the last two tiers)
        if (targetTierIndex >= PARTICLE_TIERS.length) return;
        targetTierId = PARTICLE_TIERS[targetTierIndex].id;
        
        // Award 1 gem per extra-large particle crushed.
        const gemDefinition = resolveGemDefinition(targetTierId);
        
        if (gemDefinition) {
          // Add to player's gem inventory
          const record = moteGemState.inventory.get(targetTierId) || {
            label: gemDefinition.name,
            total: 0,
            count: 0,
          };
          record.total += 1;
          record.count = (record.count || 0) + 1;
          record.label = gemDefinition.name || record.label;
          moteGemState.inventory.set(targetTierId, record);
          
          // Track for floating feedback display
          gemsToAward.set(targetTierId, (gemsToAward.get(targetTierId) || 0) + 1);
        }
      } else {
        // Other sizes should not reach here, but skip them if they do
        return;
      }
      
      // Create conversion animation entry for the tier jump.
      const conversionCount = 1;
      
      this.activeMerges.push({
        particles: [particle],
        targetX: this.forge.x,
        targetY: this.forge.y,
        tierId: targetTierId,
        sizeIndex: outputSizeIndex,
        startTime: Date.now(),
        isTierConversion: true,
        conversionCount: conversionCount
      });
    });
  });

  // Add gem awards to floating feedback queue
  if (gemsToAward.size > 0) {
    const now = Date.now();
    gemsToAward.forEach((count, tierId) => {
      this.crunchGemAwards.push({
        tierId,
        count,
        startTime: now,
      });
    });
  }

  if (nullstoneParticles.length > 0) {
    // Remove nullstone crunch particles since they do not convert into higher tiers.
    this.particles = this.particles.filter(p => !nullstoneParticles.includes(p));
  }

  if (nullstoneSmallEquivalent > 0) {
    // Apply the nullstone exponent gain and persist it to the spire state.
    this.particleFactorExponentBonus += nullstoneSmallEquivalent * PARTICLE_FACTOR_EXPONENT_INCREMENT;
    if (this.state) {
      this.state.particleFactorExponentBonus = this.particleFactorExponentBonus;
    }
  }

  if (nullstoneParticles.length > 0) {
    // Refresh inventory totals so nullstone crunches immediately reflect in the UI.
    this.updateInventory();
  }

  // Reset crunch state and mark end time for spin-down
  this.forgeCrunchActive = false;
  this.forgeCrunchProgress = 0;
  this.forgeCrunchStartTime = null;
  this.forgeCrunchEndTime = Date.now(); // Track when crunch ended for spin-down
}

// Draw the forge crunch effect (shrinking circle)
export function drawForgeCrunch() {
  if (!this.forgeCrunchActive) return;

  const ctx = this.ctx;
  
  // Calculate current radius (starts at FORGE_RADIUS, shrinks to 0)
  const currentRadius = FORGE_RADIUS * (1 - this.forgeCrunchProgress);
  
  // Calculate alpha (goes from 0 to 0.8 to 0)
  // Peak at middle of animation
  const alphaCurve = Math.sin(this.forgeCrunchProgress * PI);
  const alpha = alphaCurve * 0.8;
  
  // Draw shrinking circle
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(this.forge.x, this.forge.y, currentRadius, 0, TWO_PI); // Use pre-calculated constant
  ctx.stroke();
  
  // Draw inner glow
  ctx.strokeStyle = `rgba(200, 200, 255, ${alpha * 0.5})`;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(this.forge.x, this.forge.y, currentRadius, 0, TWO_PI); // Use pre-calculated constant
  ctx.stroke();
}

// Draw floating gem award notifications in top-left corner
export function drawCrunchGemAwards(now) {
  if (!this.crunchGemAwards || this.crunchGemAwards.length === 0) {
    return;
  }

  const ctx = this.ctx;
  const AWARD_DURATION_MS = 2000; // 2 seconds total
  const AWARD_FADE_IN_MS = 200; // Fade in over 200ms
  const AWARD_FADE_OUT_START_MS = 1500; // Start fading out at 1.5s
  const AWARD_FLOAT_DISTANCE = 40; // Float upward 40px
  const AWARD_STACK_SPACING = 30; // Vertical spacing between awards
  const START_X = 20; // Left margin
  const START_Y = 30; // Top margin

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Update and render each award
  for (let i = this.crunchGemAwards.length - 1; i >= 0; i--) {
    const award = this.crunchGemAwards[i];
    const elapsed = now - award.startTime;

    // Remove expired awards
    if (elapsed >= AWARD_DURATION_MS) {
      this.crunchGemAwards.splice(i, 1);
      continue;
    }

    // Calculate animation progress
    const progress = elapsed / AWARD_DURATION_MS;
    const yOffset = progress * AWARD_FLOAT_DISTANCE;
    const stackOffset = i * AWARD_STACK_SPACING;

    // Calculate opacity with fade in and fade out
    let opacity = 1;
    if (elapsed < AWARD_FADE_IN_MS) {
      opacity = elapsed / AWARD_FADE_IN_MS;
    } else if (elapsed > AWARD_FADE_OUT_START_MS) {
      const fadeOutElapsed = elapsed - AWARD_FADE_OUT_START_MS;
      const fadeOutDuration = AWARD_DURATION_MS - AWARD_FADE_OUT_START_MS;
      opacity = 1 - (fadeOutElapsed / fadeOutDuration);
    }

    // Calculate current position
    const currentY = START_Y + stackOffset - yOffset;

    // Get gem definition
    const gemDefinition = resolveGemDefinition(award.tierId);
    if (!gemDefinition) {
      continue;
    }

    // Get tier color for fallback
    const tier = PARTICLE_TIERS.find(t => t.id === award.tierId);
    const color = tier ? tier.color : { r: 255, g: 215, b: 100 };

    // Draw the award text with icon
    const fontSize = 16;
    const iconSize = 18;
    const spacing = 6;

    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    const text = `+${award.count}`;
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;

    // Draw drop shadow for better visibility
    ctx.globalAlpha = opacity * 0.4;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillText(text, START_X + 2, currentY + 2);

    // Draw text
    ctx.globalAlpha = opacity;
    ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.strokeText(text, START_X, currentY);
    ctx.fillText(text, START_X, currentY);

    // Draw gem icon (simple diamond shape as fallback)
    const halfIconSize = iconSize * HALF; // Pre-calculate for optimization
    const iconX = START_X + textWidth + spacing + halfIconSize;
    const iconY = currentY;

    ctx.globalAlpha = opacity;
    ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(iconX, iconY - halfIconSize);
    ctx.lineTo(iconX + halfIconSize, iconY);
    ctx.lineTo(iconX, iconY + halfIconSize);
    ctx.lineTo(iconX - halfIconSize, iconY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

// Draw the forge (Star of David with counter-rotating triangles)
export function drawForge() {
  const ctx = this.ctx;
  const forgeSize = 36; // Size of triangles (50% larger so the forge sprites read clearly).
  const forgeSpriteSize = forgeSize * 2; // Scale sprites to match the existing triangle footprint.
  const halfForgeSpriteSize = forgeSpriteSize * HALF; // Pre-calculate half size for optimization
  const forgeSpriteReady = this.forgeSpriteClockwise.complete && this.forgeSpriteClockwise.naturalWidth > 0;
  const forgeCounterSpriteReady = this.forgeSpriteCounterClockwise.complete && this.forgeSpriteCounterClockwise.naturalWidth > 0;
  const forgeSpriteOpacity = 0.5; // Keep the center forge sprites at 50% opacity.
  
  ctx.save();
  ctx.translate(this.forge.x, this.forge.y);
  
  // Draw second triangle first (pointing down, rotating counter-clockwise) - forge2.png renders in back
  ctx.rotate(-this.forgeRotation);
  if (forgeCounterSpriteReady) {
    // Draw the counter-clockwise forge sprite once the image has finished loading.
    ctx.globalAlpha = forgeSpriteOpacity;
    ctx.drawImage(this.forgeSpriteCounterClockwise, -halfForgeSpriteSize, -halfForgeSpriteSize, forgeSpriteSize, forgeSpriteSize);
    ctx.globalAlpha = 1;
  } else {
    // Fallback to vector triangles if the sprite has not loaded yet.
    ctx.strokeStyle = 'rgba(200, 200, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, forgeSize);
    ctx.lineTo(forgeSize * Math.cos(PI_OVER_SIX), -forgeSize * Math.sin(PI_OVER_SIX));
    ctx.lineTo(-forgeSize * Math.cos(PI_OVER_SIX), -forgeSize * Math.sin(PI_OVER_SIX));
    ctx.closePath();
    ctx.stroke();
  }
  
  // Draw first triangle second (pointing up, rotating clockwise) - forge.png renders in front
  ctx.rotate(this.forgeRotation * 2); // Reset and rotate to clockwise position
  if (forgeSpriteReady) {
    // Draw the clockwise forge sprite once the image has finished loading.
    ctx.globalAlpha = forgeSpriteOpacity;
    ctx.drawImage(this.forgeSpriteClockwise, -halfForgeSpriteSize, -halfForgeSpriteSize, forgeSpriteSize, forgeSpriteSize);
    ctx.globalAlpha = 1;
  } else {
    // Fallback to vector triangles if the sprite has not loaded yet.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -forgeSize);
    ctx.lineTo(forgeSize * Math.cos(PI_OVER_SIX), forgeSize * Math.sin(PI_OVER_SIX));
    ctx.lineTo(-forgeSize * Math.cos(PI_OVER_SIX), forgeSize * Math.sin(PI_OVER_SIX));
    ctx.closePath();
    ctx.stroke();
  }
  
  // Draw center glow (only if glow is enabled)
  if (this.forgeGlowEnabled) {
    ctx.rotate(-this.forgeRotation); // Rotate back to center
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, forgeSize);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, forgeSize, 0, TWO_PI); // Use pre-calculated constant
    ctx.fill();
  }
  
  ctx.restore();
}

// Draw a faint dashed ring at the edge of the forge's influence radius
export function drawForgeInfluenceRing() {
  const ctx = this.ctx;

  // Draw a faint ring at the edge of the forge's influence radius
  ctx.strokeStyle = 'rgba(150, 150, 200, 0.1)'; // Faint bluish-white
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]); // Dashed line for subtlety
  ctx.beginPath();
  ctx.arc(this.forge.x, this.forge.y, MAX_FORGE_ATTRACTION_DISTANCE, 0, TWO_PI); // Use pre-calculated constant
  ctx.stroke();
  ctx.setLineDash([]); // Reset to solid lines
}
