// Cardinal Warden Renderer
// All canvas draw methods extracted from CardinalWardenSimulation (Build 520).
// Functions are called with .call(this) so 'this' refers to the simulation instance.

import { samplePaletteGradient } from '../../../../assets/colorSchemeUtils.js';
import {
  ELEMENTAL_CONFIG,
  VISUAL_CONFIG,
  LIFE_LINES_CONFIG,
  UI_CONFIG,
  WEAPON_SLOT_IDS,
  WEAPON_SLOT_DEFINITIONS,
} from '../cardinalWardenConfig.js';
import {
  renderExpandingWaves as renderWaveSystem,
} from './WaveSystem.js';
import {
  renderBeams as renderBeamsSystem,
} from './BeamSystem.js';
import {
  renderMines as renderMinesSystem,
} from './MineSystem.js';
import {
  renderSwarmShips as renderSwarmShipsSystem,
  renderSwarmLasers as renderSwarmLasersSystem,
} from './SwarmSystem.js';

// Duplicated local utility - also present in the simulation file for resolveBulletColor().
function lightenHexColor(hex, amount = 0.2) {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  if (normalized.length !== 6) {
    return hex;
  }

  const num = parseInt(normalized, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;

  const mix = (channel) => Math.round(channel + (255 - channel) * amount);

  const nr = mix(r);
  const ng = mix(g);
  const nb = mix(b);

  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb
    .toString(16)
    .padStart(2, '0')}`;
}

/**
 * Render a character from the individual grapheme sprites.
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} charIndex - Index of the grapheme (A-Z plus dagesh variants)
 * @param {number} x - X position to render at
 * @param {number} y - Y position to render at
 * @param {number} size - Size to render the character
 */
export function renderScriptChar(ctx, charIndex, x, y, size) {
  // Check if the grapheme sprite is loaded
  if (!this.graphemeSpriteLoaded.get(charIndex)) {
    return;
  }

  // Validate bounds by ensuring we have a sprite registered for the grapheme index.
  if (!this.graphemeSprites.has(charIndex)) {
    console.warn(`Grapheme index ${charIndex} has no registered sprite.`);
    return;
  }

  // Use the tinted (colored) version if available, otherwise use the original
  const sprite = this.tintedGraphemeCache.get(charIndex) || this.graphemeSprites.get(charIndex);
  if (!sprite) {
    return;
  }

  // Draw the grapheme sprite centered at the given position
  ctx.drawImage(
    sprite,
    x - size / 2,
    y - size / 2,
    size,
    size
  );
}

/**
 * Render the Cardinal Warden's script below the warden.
 * Displays 8 lines of script, one per weapon slot, based on assigned graphemes.
 */
export function renderWardenName() {
  // Skip if context, warden, or grapheme sprites are not ready
  if (!this.ctx || !this.warden || this.graphemeSpriteLoaded.size === 0) return;

  const ctx = this.ctx;
  const warden = this.warden;

  // Character size and spacing configuration
  const charSize = 16;
  const charSpacing = charSize * 0.9;
  const lineSpacing = charSize * 1.1;

  // Position just below the warden's outermost ring
  const canvasHeight = this.canvas ? this.canvas.height : 600;
  const spaceBelow = canvasHeight - warden.y;
  const nameStartY = warden.y + Math.min(70, spaceBelow * 0.4);

  // Get weapon slot assignments
  const assignments = this.weaponGraphemeAssignments || {};

  // Render each weapon slot as a line of script
  for (let slotIdx = 0; slotIdx < WEAPON_SLOT_IDS.length; slotIdx++) {
    const slotId = WEAPON_SLOT_IDS[slotIdx];
    const graphemes = (assignments[slotId] || []).filter(g => g != null);
    
    if (graphemes.length === 0) {
      // Skip empty slots (no graphemes assigned)
      continue;
    }

    const lineY = nameStartY + slotIdx * lineSpacing;
    const lineStartX = warden.x - ((graphemes.length - 1) * charSpacing) / 2;

    // Render each grapheme in this weapon slot's line
    for (let i = 0; i < graphemes.length; i++) {
      const grapheme = graphemes[i];
      if (!grapheme || typeof grapheme.index !== 'number') continue;
      
      this.renderScriptChar(ctx, grapheme.index, lineStartX + i * charSpacing, lineY, charSize);
    }
  }
}

/**
 * Render all floating score popups.
 */
export function renderScorePopups() {
  if (!this.ctx) return;
  
  const ctx = this.ctx;
  ctx.save();
  ctx.font = 'bold 14px "Cormorant Garamond", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  for (const popup of this.scorePopups) {
    ctx.globalAlpha = popup.alpha;
    // Use a contrasting color based on night mode
    ctx.fillStyle = this.nightMode ? '#ffcc00' : '#d4af37';
    ctx.fillText(`+${popup.value}`, popup.x, popup.y + popup.offsetY);
  }
  
  ctx.restore();
}

/**
 * Render all floating damage numbers.
 */
export function renderDamageNumbers() {
  if (!this.ctx) return;
  
  const ctx = this.ctx;
  ctx.save();
  ctx.font = 'bold 12px "Cormorant Garamond", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  for (const dmg of this.damageNumbers) {
    ctx.globalAlpha = dmg.alpha;
    // Use red color for damage
    ctx.fillStyle = this.nightMode ? '#ff6666' : '#ff3333';
    // Format damage: show integers without decimals, floats with one decimal place
    const damageText = dmg.damage % 1 === 0 ? dmg.damage.toString() : dmg.damage.toFixed(1);
    ctx.fillText(damageText, dmg.x + dmg.xOffset, dmg.y + dmg.offsetY);
  }
  
  ctx.restore();
}

/**
 * Render the game.
 */
export function render() {
  if (!this.ctx || !this.canvas) return;

  // Clear with current background color
  this.ctx.fillStyle = this.bgColor;
  this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

  // Render based on game phase
  switch (this.gamePhase) {
    case 'death':
      this.renderDeathAnimation();
      break;
    case 'respawn':
      this.renderRespawnAnimation();
      break;
    case 'playing':
    default:
      // Draw Cardinal Warden
      this.renderWarden();
      // Draw aim target symbol if set
      this.renderAimTarget();
      // Draw weapon targets for eighth grapheme (Theta)
      this.renderWeaponTargets();
      // Draw friendly ships
      this.renderFriendlyShips();
      // Draw swarm ships and lasers
      this.renderSwarmShips();
      this.renderSwarmLasers();
      // Draw enemies
      this.renderEnemies();
      // Draw bosses
      this.renderBosses();
      // Draw bullets
      this.renderBullets();
      // Draw beams
      this.renderBeams();
      // Draw expanding waves
      this.renderExpandingWaves();
      // Draw mines
      this.renderMines();
      // Draw floating damage numbers
      this.renderDamageNumbers();
      // Draw floating score popups
      this.renderScorePopups();
      break;
  }

  // Draw UI overlays
  this.renderUI();
  
  // Allow external code to render on top (e.g., phoneme drops)
  if (this.onPostRender) {
    this.onPostRender(this.ctx, this.canvas, this.gamePhase);
  }
}

/**
 * Render the death animation.
 */
export function renderDeathAnimation() {
  const ctx = this.ctx;
  
  // During shake phase, render shaking warden
  if (this.deathAnimTimer < 1000 && this.warden) {
    ctx.save();
    // Apply shake offset
    const shakeX = (Math.random() - 0.5) * 2 * this.deathShakeIntensity;
    const shakeY = (Math.random() - 0.5) * 2 * this.deathShakeIntensity;
    ctx.translate(shakeX, shakeY);
    this.renderWarden();
    ctx.restore();
    
    // Still show enemies during shake
    this.renderEnemies();
    this.renderBosses();
    this.renderBullets();
    this.renderBeams();
    this.renderMines();
  }
  
  // Render explosion particles
  for (const particle of this.deathExplosionParticles) {
    if (particle.alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = particle.alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Render the respawn animation.
 */
export function renderRespawnAnimation() {
  const ctx = this.ctx;
  
  if (!this.warden) return;
  
  ctx.save();
  ctx.globalAlpha = this.respawnOpacity;
  this.renderWarden();
  ctx.restore();
}

/**
 * Render the Cardinal Warden.
 */
export function renderWarden() {
  if (!this.warden || !this.ctx) return;

  const ctx = this.ctx;
  const warden = this.warden;

  // Draw ring squares first (behind everything else) - always drawn regardless of mode
  for (const ring of warden.ringSquares) {
    ring.render(ctx, warden.x, warden.y);
  }

  // Choose rendering mode based on legacyWardenGraphics setting
  if (this.legacyWardenGraphics) {
    // Legacy mode: Use original canvas rendering
    // Draw orbital squares
    ctx.save();
    if (this.nightMode) {
      ctx.shadowColor = this.wardenCoreColor;
      ctx.shadowBlur = 18;
    }

    ctx.fillStyle = this.wardenSquareColor;
    for (const square of warden.orbitalSquares) {
      const pos = square.getPosition(warden.x, warden.y);

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(square.selfRotation);

      const halfSize = square.size / 2;
      ctx.fillRect(-halfSize, -halfSize, square.size, square.size);

      ctx.restore();
    }

    // Draw core orb
    ctx.beginPath();
    ctx.arc(warden.x, warden.y, warden.coreRadius, 0, Math.PI * 2);
    ctx.fillStyle = this.wardenCoreColor;
    ctx.fill();

    // Draw inner highlight
    ctx.beginPath();
    ctx.arc(warden.x - 4, warden.y - 4, warden.coreRadius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();

    ctx.restore();
  } else {
    // New mode: Use sprite-based rendering
    ctx.save();
    
    // Draw orbital shards using sprites (if loaded), otherwise fallback to canvas rendering
    for (let i = 0; i < warden.orbitalSquares.length; i++) {
      const square = warden.orbitalSquares[i];
      const pos = square.getPosition(warden.x, warden.y);
      
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(square.selfRotation);
      
      // Try to use sprites if available
      const shardIndex = this.wardenShardSprites.length > 0 ? i % this.wardenShardSprites.length : -1;
      
      if (shardIndex >= 0 && this.wardenShardsLoaded[shardIndex]) {
        // Apply glow effect in night mode
        if (this.nightMode) {
          ctx.shadowColor = this.wardenCoreColor;
          ctx.shadowBlur = 15;
        }
        
        // Scale sprite to match the square size
        // Scale sprite rendering down to reduce the warden shard footprint.
        const spriteScale = 0.5;
        const spriteSize = square.size * 3.5 * spriteScale; // Make sprites larger for visual impact
        ctx.drawImage(
          this.wardenShardSprites[shardIndex],
          -spriteSize / 2,
          -spriteSize / 2,
          spriteSize,
          spriteSize
        );
      } else {
        // Fallback to canvas rendering if sprites not loaded
        if (this.nightMode) {
          ctx.shadowColor = this.wardenCoreColor;
          ctx.shadowBlur = 15;
        }
        
        ctx.fillStyle = this.wardenSquareColor;
        const halfSize = square.size / 2;
        ctx.fillRect(-halfSize, -halfSize, square.size, square.size);
      }
      
      ctx.restore();
    }
    
    // Draw core sprite (if loaded)
    if (this.wardenCoreLoaded) {
      ctx.save();
      
      // Apply glow effect in night mode
      if (this.nightMode) {
        ctx.shadowColor = this.wardenCoreColor;
        ctx.shadowBlur = 25;
      }
      
      // Scale core sprite to match the core radius
      // Scale sprite rendering down to reduce the warden core footprint.
      const spriteScale = 0.5;
      const coreSize = warden.coreRadius * 5 * spriteScale; // Make core sprite larger
      ctx.drawImage(
        this.wardenCoreSprite,
        warden.x - coreSize / 2,
        warden.y - coreSize / 2,
        coreSize,
        coreSize
      );
      
      ctx.restore();
    } else {
      // Fallback to drawing a circle if sprite not loaded
      ctx.save();
      ctx.beginPath();
      ctx.arc(warden.x, warden.y, warden.coreRadius, 0, Math.PI * 2);
      ctx.fillStyle = this.wardenCoreColor;
      ctx.fill();
      ctx.restore();
    }
    
    ctx.restore();
  }

  // Render the warden's name in script font below
  this.renderWardenName();
}

/**
 * Render the aim target symbol where the player has clicked/tapped.
 * This shows a crosshair-like symbol indicating where aimable weapons will fire.
 */
export function renderAimTarget() {
  if (!this.aimTarget || !this.ctx) return;

  const ctx = this.ctx;
  const { x, y } = this.aimTarget;
  
  // Use golden color to match the warden aesthetic
  const targetColor = this.nightMode ? '#ffe9a3' : '#d4af37';
  const outerRadius = 16;
  const innerRadius = 6;
  const crossSize = 24;
  
  ctx.save();
  
  // Set line style
  ctx.strokeStyle = targetColor;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.85;
  
  // Draw outer circle
  ctx.beginPath();
  ctx.arc(x, y, outerRadius, 0, Math.PI * 2);
  ctx.stroke();
  
  // Draw inner circle
  ctx.beginPath();
  ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
  ctx.stroke();
  
  // Draw crosshair lines (extending beyond outer circle)
  ctx.beginPath();
  // Horizontal line
  ctx.moveTo(x - crossSize, y);
  ctx.lineTo(x - outerRadius - 4, y);
  ctx.moveTo(x + outerRadius + 4, y);
  ctx.lineTo(x + crossSize, y);
  // Vertical line
  ctx.moveTo(x, y - crossSize);
  ctx.lineTo(x, y - outerRadius - 4);
  ctx.moveTo(x, y + outerRadius + 4);
  ctx.lineTo(x, y + crossSize);
  ctx.stroke();
  
  // Draw center dot
  ctx.fillStyle = targetColor;
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

/**
 * Render target indicators for enemies targeted by the eighth grapheme (Theta).
 * Draws a smaller target reticle colored with the weapon's color over targeted enemies.
 */
export function renderWeaponTargets() {
  if (!this.ctx) return;
  
  const ctx = this.ctx;
  
  // Iterate through each weapon and render its target if present
  for (const weaponId of Object.keys(this.weaponTargets)) {
    const target = this.weaponTargets[weaponId];
    if (!target) continue;
    
    // Get weapon color
    const weaponDef = WEAPON_SLOT_DEFINITIONS[weaponId];
    if (!weaponDef) continue;
    
    const targetColor = this.resolveBulletColor(weaponDef.color);
    const { x, y } = target;
    
    // Smaller circles than player aim target
    const outerRadius = 10;
    const innerRadius = 4;
    const crossSize = 14;
    
    ctx.save();
    
    // Set line style with weapon color
    ctx.strokeStyle = targetColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.75;
    
    // Draw outer circle
    ctx.beginPath();
    ctx.arc(x, y, outerRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw inner circle
    ctx.beginPath();
    ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw crosshair lines (extending beyond outer circle)
    ctx.beginPath();
    // Horizontal line
    ctx.moveTo(x - crossSize, y);
    ctx.lineTo(x - outerRadius - 2, y);
    ctx.moveTo(x + outerRadius + 2, y);
    ctx.lineTo(x + crossSize, y);
    // Vertical line
    ctx.moveTo(x, y - crossSize);
    ctx.lineTo(x, y - outerRadius - 2);
    ctx.moveTo(x, y + outerRadius + 2);
    ctx.lineTo(x, y + crossSize);
    ctx.stroke();
    
    // Draw center dot
    ctx.fillStyle = targetColor;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}

/**
 * Render all friendly ships.
 */
export function renderFriendlyShips() {
  if (!this.ctx) return;
  
  const ctx = this.ctx;
  
  for (const ship of this.friendlyShips) {
    // Render thin, colorful trail matching the weapon color
    if (ship.trail.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Parse ship color to RGB for alpha blending
      const hexColor = ship.color;
      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);
      
      // Draw trail as connected line segments with fading alpha
      for (let i = 0; i < ship.trail.length - 1; i++) {
        const start = ship.trail[i];
        const end = ship.trail[i + 1];
        const alpha = ((i + 1) / ship.trail.length) * 0.7;
        const lineWidth = 2.0 * alpha; // Thin trails
        
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
      ctx.restore();
    }
    
    // Render ship body
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.headingAngle - Math.PI / 2);
    
    // Draw ship as a triangle (friendly version)
    ctx.beginPath();
    ctx.moveTo(0, ship.size);
    ctx.lineTo(-ship.size * 0.6, -ship.size * 0.4);
    ctx.lineTo(ship.size * 0.6, -ship.size * 0.4);
    ctx.closePath();
    
    // Use weapon color with golden tint
    ctx.fillStyle = this.nightMode ? lightenHexColor(ship.color, 0.3) : ship.color;
    ctx.fill();
    
    // Add a subtle outline to distinguish from enemies
    ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(212, 175, 55, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Draw a small golden core/gem in the center
    ctx.fillStyle = this.nightMode ? '#ffe9a3' : '#d4af37';
    ctx.beginPath();
    ctx.arc(0, 0, ship.size * 0.25, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}

/**
 * Render all enemies.
 */
export function renderEnemies() {
  if (!this.ctx) return;

  const ctx = this.ctx;
  const maxTrailPoints = this.getEnemyTrailMaxLength();
  const maxSmokePuffs = this.getEnemySmokeMaxCount();
  const quality = this.getEnemyTrailQuality();

  for (const enemy of this.enemies) {
    // Render a small inky trail behind the ship's path (quality-based rendering).
    if (maxTrailPoints > 0 && enemy.trail && enemy.trail.length > 0) {
      ctx.save();
      const radiusScale = enemy.trailRadiusScale || 0.35;
      const alphaScale = enemy.trailAlphaScale || 0.8;
      const startIdx = Math.max(0, enemy.trail.length - maxTrailPoints);
      const visibleTrail = enemy.trail.slice(startIdx);
      
      if (quality === 'low') {
        // Low quality: Simple solid circles
        ctx.fillStyle = this.enemyTrailColor;
        for (let i = 0; i < visibleTrail.length - 1; i++) {
          const point = visibleTrail[i];
          const alpha = (i + 1) / visibleTrail.length;
          ctx.globalAlpha = alpha * alphaScale;
          ctx.beginPath();
          ctx.arc(point.x, point.y, Math.max(1.25, enemy.size * radiusScale * alpha), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (quality === 'medium') {
        // Medium quality: Circles with slight taper
        ctx.fillStyle = this.enemyTrailColor;
        for (let i = 0; i < visibleTrail.length - 1; i++) {
          const point = visibleTrail[i];
          const progress = (i + 1) / visibleTrail.length;
          const alpha = progress * alphaScale;
          // Taper the radius slightly toward the tail
          const taperFactor = 0.4 + 0.6 * progress;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(point.x, point.y, Math.max(0.5, enemy.size * radiusScale * taperFactor), 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // High quality: Diminish to a point with gradient matching color palette
        for (let i = 0; i < visibleTrail.length - 1; i++) {
          const point = visibleTrail[i];
          const progress = (i + 1) / visibleTrail.length;
          
          // Sample gradient from palette based on progress along the trail
          const gradientSample = samplePaletteGradient(progress);
          const gradientColor = `rgb(${gradientSample.r}, ${gradientSample.g}, ${gradientSample.b})`;
          
          // Diminish radius to near-zero at the tail
          const taperFactor = progress * progress; // Quadratic taper for smooth diminish
          const radius = Math.max(0.25, enemy.size * radiusScale * taperFactor);
          const alpha = progress * alphaScale;
          
          ctx.globalAlpha = alpha;
          ctx.fillStyle = gradientColor;
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Render smoke puffs from the stored world-space positions (respects trail length setting).
    if (maxSmokePuffs > 0) {
      ctx.save();
      ctx.fillStyle = this.enemySmokeColor;
      // Only render up to maxSmokePuffs from the end of the smokePuffs array
      const startIdx = Math.max(0, enemy.smokePuffs.length - maxSmokePuffs);
      const visiblePuffs = enemy.smokePuffs.slice(startIdx);
      for (const puff of visiblePuffs) {
        ctx.globalAlpha = puff.alpha * (this.nightMode ? 1.15 : 1);
        ctx.beginPath();
        ctx.arc(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    // Enemy sprite art is authored with the nose at the top (-Y), so rotate accordingly.
    ctx.rotate(enemy.headingAngle + Math.PI / 2);

    // Draw enemy ship sprite if available, otherwise fall back to triangle
    const spriteLevel = enemy.spriteLevel || 1;
    const sprite = this.enemyShipSprites[spriteLevel];
    const spriteLoaded = this.enemyShipSpritesLoaded[spriteLevel];
    
    if (sprite && spriteLoaded) {
      // Render the enemy ship sprite
      const spriteSize = enemy.size * 3; // Scale sprite to be visible
      ctx.drawImage(
        sprite,
        -spriteSize / 2,
        -spriteSize / 2,
        spriteSize,
        spriteSize
      );
    } else {
      // Fallback: Draw enemy ship as a simple triangle pointing toward movement.
      ctx.beginPath();
      ctx.moveTo(0, enemy.size);
      ctx.lineTo(-enemy.size * 0.7, -enemy.size * 0.5);
      ctx.lineTo(enemy.size * 0.7, -enemy.size * 0.5);
      ctx.closePath();

      ctx.fillStyle = this.nightMode ? '#ffffff' : enemy.color;
      ctx.fill();
    }

    ctx.restore();

    // Health bar for multi-hit enemies.
    // Draw in world-space so the bar stays north of the ship and never rotates with heading.
    if (enemy.maxHealth > 1) {
      const healthPercent = enemy.health / enemy.maxHealth;
      const barWidth = enemy.size * 1.5;
      const barHeight = 2;
      const barX = enemy.x - (barWidth / 2);
      const barY = enemy.y - enemy.size - 4;

      ctx.fillStyle = this.nightMode ? 'rgba(255, 255, 255, 0.3)' : '#ddd';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      ctx.fillStyle = this.nightMode ? 'rgba(255, 255, 255, 0.8)' : '#666';
      ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    }
    
    // Render burn particles if burning
    if (enemy.burning && enemy.burnParticles.length > 0) {
      ctx.save();
      for (const particle of enemy.burnParticles) {
        const alpha = particle.life / particle.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ELEMENTAL_CONFIG.BURN_PARTICLE_COLOR;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

/**
 * Render all boss ships with distinctive visuals.
 */
export function renderBosses() {
  if (!this.ctx) return;

  const ctx = this.ctx;
  const maxTrailPoints = this.getEnemyTrailMaxLength();
  const quality = this.getEnemyTrailQuality();

  for (const boss of this.bosses) {
    // Render trail (quality-based rendering)
    if (maxTrailPoints > 0 && boss.trail && boss.trail.length > 0) {
      ctx.save();
      const startIdx = Math.max(0, boss.trail.length - maxTrailPoints);
      const visibleTrail = boss.trail.slice(startIdx);
      
      if (quality === 'low') {
        // Low quality: Simple solid circles
        ctx.fillStyle = this.enemyTrailColor;
        for (let i = 0; i < visibleTrail.length - 1; i++) {
          const point = visibleTrail[i];
          const alpha = (i + 1) / visibleTrail.length;
          ctx.globalAlpha = alpha * 0.6;
          ctx.beginPath();
          ctx.arc(point.x, point.y, Math.max(2, boss.size * 0.15 * alpha), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (quality === 'medium') {
        // Medium quality: Circles with slight taper
        ctx.fillStyle = this.enemyTrailColor;
        for (let i = 0; i < visibleTrail.length - 1; i++) {
          const point = visibleTrail[i];
          const progress = (i + 1) / visibleTrail.length;
          const alpha = progress * 0.6;
          const taperFactor = 0.4 + 0.6 * progress;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(point.x, point.y, Math.max(1, boss.size * 0.15 * taperFactor), 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // High quality: Diminish to a point with gradient matching color palette
        for (let i = 0; i < visibleTrail.length - 1; i++) {
          const point = visibleTrail[i];
          const progress = (i + 1) / visibleTrail.length;
          
          // Sample gradient from palette based on progress along the trail
          const gradientSample = samplePaletteGradient(progress);
          const gradientColor = `rgb(${gradientSample.r}, ${gradientSample.g}, ${gradientSample.b})`;
          
          // Diminish radius to near-zero at the tail
          const taperFactor = progress * progress; // Quadratic taper for smooth diminish
          const radius = Math.max(0.5, boss.size * 0.15 * taperFactor);
          const alpha = progress * 0.6;
          
          ctx.globalAlpha = alpha;
          ctx.fillStyle = gradientColor;
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(boss.x, boss.y);

    // Draw milestone boss sprite when available, otherwise fall back to procedural boss shapes.
    const bossSprite = this.bossSprites[boss.spriteIndex];
    const invertedBossSprite = this.invertedBossSpriteCache[boss.spriteIndex];
    const shouldUseInverted = !!boss.invertSpriteColors && !!invertedBossSprite;
    const spriteReady = Number.isInteger(boss.spriteIndex) && this.bossSpritesLoaded[boss.spriteIndex] && (bossSprite || invertedBossSprite);

    if (spriteReady) {
      const spriteImage = shouldUseInverted ? invertedBossSprite : bossSprite;
      const spriteSize = boss.size * 2.7;
      // Boss sprite art is also nose-up, matching enemy ships and requiring +π/2 rotation.
      ctx.rotate((boss.headingAngle || Math.PI / 2) + Math.PI / 2);
      ctx.drawImage(spriteImage, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
    } else {
      switch (boss.type) {
        case 'circleCarrier':
          this.renderCircleCarrierBoss(ctx, boss);
          break;
        case 'pyramidBoss':
          this.renderPyramidBoss(ctx, boss);
          break;
        case 'hexagonFortress':
          this.renderHexagonFortressBoss(ctx, boss);
          break;
        case 'megaBoss':
          this.renderMegaBoss(ctx, boss);
          break;
        case 'ultraBoss':
          this.renderUltraBoss(ctx, boss);
          break;
        default:
          this.renderCircleCarrierBoss(ctx, boss);
      }
    }

    ctx.restore();

    // Health bar for all bosses.
    // Draw in world-space to keep the bar locked above the ship regardless of boss rotation.
    const healthPercent = boss.health / boss.maxHealth;
    const barWidth = boss.size * 2;
    const barHeight = 4;
    const barX = boss.x - (barWidth / 2);
    const barY = boss.y - boss.size - 10;

    ctx.fillStyle = this.nightMode ? 'rgba(255, 255, 255, 0.3)' : '#ddd';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Health bar color changes based on health
    let healthColor;
    if (healthPercent > 0.6) {
      healthColor = this.nightMode ? '#90EE90' : '#4a4';
    } else if (healthPercent > 0.3) {
      healthColor = this.nightMode ? '#FFD700' : '#aa4';
    } else {
      healthColor = this.nightMode ? '#FF6B6B' : '#a44';
    }
    ctx.fillStyle = healthColor;
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    // Border
    ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.6)' : '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
    
    // Render burn particles if burning
    if (boss.burning && boss.burnParticles.length > 0) {
      ctx.save();
      for (const particle of boss.burnParticles) {
        const alpha = particle.life / particle.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ELEMENTAL_CONFIG.BURN_PARTICLE_COLOR;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

/**
 * Render Circle Carrier boss - large rotating circle with inner rings.
 */
export function renderCircleCarrierBoss(ctx, boss) {
  const fillColor = this.nightMode ? '#ffffff' : boss.color;
  const strokeColor = this.nightMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)';

  // Outer ring
  ctx.beginPath();
  ctx.arc(0, 0, boss.size, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner rotating rings
  ctx.save();
  ctx.rotate(boss.rotation);
  for (const ring of boss.innerRings) {
    ctx.beginPath();
    ctx.arc(0, 0, boss.size * ring.radius, 0, Math.PI * 2);
    ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(100, 100, 100, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();

  // Spawn indicator dots around the circle
  ctx.save();
  ctx.rotate(boss.rotation);
  const dotCount = boss.spawnCount;
  for (let i = 0; i < dotCount; i++) {
    const angle = (i / dotCount) * Math.PI * 2;
    const dotX = Math.cos(angle) * boss.size * 0.7;
    const dotY = Math.sin(angle) * boss.size * 0.7;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
    ctx.fillStyle = this.nightMode ? '#ffcc00' : '#d4af37';
    ctx.fill();
  }
  ctx.restore();

  // Center indicator
  ctx.beginPath();
  ctx.arc(0, 0, boss.size * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = this.nightMode ? 'rgba(255, 255, 255, 0.8)' : 'rgba(50, 50, 50, 0.8)';
  ctx.fill();
}

/**
 * Render Pyramid boss - rotating triangle with burst indicator.
 */
export function renderPyramidBoss(ctx, boss) {
  const fillColor = this.nightMode ? '#ffffff' : boss.color;
  const strokeColor = this.nightMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)';

  // Rotating triangle
  ctx.save();
  ctx.rotate(boss.rotation);

  ctx.beginPath();
  ctx.moveTo(0, -boss.size);
  ctx.lineTo(-boss.size * 0.866, boss.size * 0.5);
  ctx.lineTo(boss.size * 0.866, boss.size * 0.5);
  ctx.closePath();

  // Flash during burst
  if (boss.isBursting) {
    ctx.fillStyle = this.nightMode ? '#ff6666' : '#cc4444';
  } else {
    ctx.fillStyle = fillColor;
  }
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner triangle
  const innerScale = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, -boss.size * innerScale);
  ctx.lineTo(-boss.size * 0.866 * innerScale, boss.size * 0.5 * innerScale);
  ctx.lineTo(boss.size * 0.866 * innerScale, boss.size * 0.5 * innerScale);
  ctx.closePath();
  ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(100, 100, 100, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

/**
 * Render Hexagon Fortress boss - large rotating hexagon with shield indicator.
 */
export function renderHexagonFortressBoss(ctx, boss) {
  const fillColor = this.nightMode ? '#ffffff' : boss.color;
  const strokeColor = this.nightMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)';

  // Rotating hexagon
  ctx.save();
  ctx.rotate(boss.rotation);

  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * boss.size;
    const y = Math.sin(angle) * boss.size;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();

  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Inner hexagon
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * boss.size * 0.6;
    const y = Math.sin(angle) * boss.size * 0.6;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(100, 100, 100, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();

  // Shield regeneration indicator (glowing when regenerating)
  if (boss.regenCooldown <= 0 && boss.health < boss.maxHealth) {
    ctx.beginPath();
    ctx.arc(0, 0, boss.size + 5, 0, Math.PI * 2);
    ctx.strokeStyle = this.nightMode ? 'rgba(100, 255, 100, 0.4)' : 'rgba(0, 200, 0, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/**
 * Render Mega Boss - enhanced hexagon with larger size.
 */
export function renderMegaBoss(ctx, boss) {
  // Render similar to hexagon fortress but with distinctive visual
  const fillColor = this.nightMode ? '#ffffff' : boss.color;
  const strokeColor = this.nightMode ? 'rgba(255, 215, 0, 0.9)' : 'rgba(212, 175, 55, 0.8)'; // Golden outline

  // Rotating hexagon
  ctx.save();
  ctx.rotate(boss.rotation);

  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * boss.size;
    const y = Math.sin(angle) * boss.size;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();

  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 4; // Thicker outline
  ctx.stroke();

  // Additional layer for mega boss
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * boss.size * 0.7;
    const y = Math.sin(angle) * boss.size * 0.7;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();
}

/**
 * Render Ultra Boss - largest and most powerful boss with distinctive visual.
 */
export function renderUltraBoss(ctx, boss) {
  // Render similar to hexagon fortress but with distinctive visual
  const fillColor = this.nightMode ? '#ffffff' : boss.color;
  const strokeColor = this.nightMode ? 'rgba(255, 100, 100, 0.9)' : 'rgba(220, 20, 60, 0.8)'; // Crimson outline

  // Rotating hexagon
  ctx.save();
  ctx.rotate(boss.rotation);

  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * boss.size;
    const y = Math.sin(angle) * boss.size;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();

  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 5; // Very thick outline
  ctx.stroke();

  // Additional layers for ultra boss
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * boss.size * 0.8;
    const y = Math.sin(angle) * boss.size * 0.8;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Inner layer
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * boss.size * 0.5;
    const y = Math.sin(angle) * boss.size * 0.5;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();
}

/**
 * Render all bullets.
 */
export function renderBullets() {
  if (!this.ctx) return;

  const ctx = this.ctx;
  const maxTrailPoints = this.getBulletTrailMaxLength();

  for (const bullet of this.bullets) {
    const trail = bullet.trail || [];
    // Render bullet trail (respects trail length setting)
    if (maxTrailPoints > 0 && trail.length > 1) {
      ctx.save();
      ctx.lineCap = 'round';
      // Only render up to maxTrailPoints from the end of the trail
      const startIdx = Math.max(0, trail.length - maxTrailPoints);
      const visibleTrail = trail.slice(startIdx);
      for (let i = visibleTrail.length - 1; i > 0; i--) {
        const start = visibleTrail[i];
        const end = visibleTrail[i - 1];
        const alpha = i / visibleTrail.length;
        ctx.strokeStyle = this.nightMode
          ? `rgba(255, 255, 255, ${0.12 + alpha * 0.28})`
          : `rgba(0, 0, 0, ${0.12 + alpha * 0.32})`;
        ctx.lineWidth = Math.max(1, bullet.size * 0.55 * alpha);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    const glowRadius = bullet.size * 2.4;
    const gradient = ctx.createRadialGradient(bullet.x, bullet.y, 0, bullet.x, bullet.y, glowRadius);
    gradient.addColorStop(0, this.nightMode ? '#ffffff' : '#fff8df');
    gradient.addColorStop(0.45, bullet.color);
    gradient.addColorStop(1, this.nightMode ? 'rgba(255, 255, 255, 0)' : 'rgba(0, 0, 0, 0)');

    if (this.nightMode) {
      ctx.shadowColor = bullet.color;
      ctx.shadowBlur = 14;
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, glowRadius * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Get bullet level (default to 1 for backwards compatibility)
    const bulletLevel = bullet.level || 1;
    
    // ThoughtSpeak shape override - use if present
    const effectiveShape = bullet.thoughtSpeakShape !== null ? bullet.thoughtSpeakShape : bulletLevel;
    const hasShape = effectiveShape >= 3;
    // Resolve the bullet heading once for sprite alignment and flare direction.
    const heading = bullet.baseAngle !== undefined ? bullet.baseAngle : bullet.angle || -Math.PI / 2;

    // Render the Shin bullet sprite artwork when available.
    if (this.bulletSprites[effectiveShape] && this.bulletSpriteLoaded[effectiveShape]) {
      // Scale the sprite to match the bullet's size and rotate into travel direction.
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(heading + Math.PI / 2);
      ctx.globalAlpha = 0.9;
      const spriteSize = bullet.size * 3.1;
      ctx.drawImage(
        this.bulletSprites[effectiveShape],
        -spriteSize / 2,
        -spriteSize / 2,
        spriteSize,
        spriteSize
      );
      ctx.restore();
    }

    // Directional flare to emphasize travel direction (only shown on level 2+ or when shape is present)
    if (bulletLevel >= 2 || hasShape) {
      const flareLength = bullet.size * 3.5;
      ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.55)';
      ctx.lineWidth = Math.max(1.2, bullet.size * 0.45);
      ctx.beginPath();
      ctx.moveTo(bullet.x - Math.cos(heading) * bullet.size * 0.6, bullet.y - Math.sin(heading) * bullet.size * 0.6);
      ctx.lineTo(bullet.x + Math.cos(heading) * flareLength, bullet.y + Math.sin(heading) * flareLength);
      ctx.stroke();
    }

    // Thin rim for a crisp silhouette (only if no shape)
    if (!hasShape) {
      ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.65)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, Math.max(1, bullet.size * 0.9), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Rotating geometric shapes for level 3+ or ThoughtSpeak shapes (capped at level 12)
    // Level/Shape 3 = triangle (3 sides), 4 = square (4 sides), 5 = pentagon, etc.
    if (hasShape) {
      const sides = Math.min(effectiveShape, 12); // Cap at 12 sides
      const shapeRadius = bullet.size * 2.2;
      const rotation = bullet.shapeRotation || 0;
      
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(rotation);
      
      // Draw thin polygon outline (no fill)
      ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2; // Start at top
        const px = Math.cos(angle) * shapeRadius;
        const py = Math.sin(angle) * shapeRadius;
        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      ctx.stroke();
      
      ctx.restore();
    }

    ctx.restore();
  }
}

/**
 * Render all beams from grapheme L (index 11).
 * Delegates to extracted BeamSystem (Build 474).
 */
export function renderBeams() {
  renderBeamsSystem(this.ctx, this.beams);
}

/**
 * Render all expanding waves from the seventh grapheme (index 6).
 */
export function renderExpandingWaves() {
  // Delegate to extracted Wave System
  renderWaveSystem(this.ctx, this.expandingWaves);
}

/**
 * Render all drifting mines from grapheme M (index 12).
 * Delegates to extracted MineSystem (Build 474).
 */
export function renderMines() {
  renderMinesSystem(this.ctx, this.mines);
}

/**
 * Render all swarm ships from grapheme N (index 13).
 * Delegates to extracted SwarmSystem (Build 475).
 */
export function renderSwarmShips() {
  renderSwarmShipsSystem(this.ctx, this.swarmShips);
}

/**
 * Render all swarm lasers from grapheme N (index 13).
 * Delegates to extracted SwarmSystem (Build 475).
 */
export function renderSwarmLasers() {
  renderSwarmLasersSystem(this.ctx, this.swarmLasers);
}

/**
 * Initialize or reset life lines to their default state.
 * @private
 */
export function initializeLifeLines() {
  this.lifeLines = [];
  for (let i = 0; i < LIFE_LINES_CONFIG.COUNT; i++) {
    this.lifeLines.push({ state: LIFE_LINES_CONFIG.INITIAL_STATE });
  }
}

/**
 * Update life line states when ships pass through.
 * Each line represents 2 lives: solid → dashed → gone.
 * @param {number} count - Number of lives to consume (default: 1)
 */
export function updateLifeLine(count = 1) {
  for (let life = 0; life < count; life++) {
    // Find the first line that isn't gone and update its state
    for (let i = 0; i < this.lifeLines.length; i++) {
      if (this.lifeLines[i].state === 'solid') {
        this.lifeLines[i].state = 'dashed';
        break;
      } else if (this.lifeLines[i].state === 'dashed') {
        this.lifeLines[i].state = 'gone';
        break;
      }
    }
  }
}

/**
 * Render UI elements.
 */
export function renderUI() {
  if (!this.ctx || !this.canvas) return;

  const ctx = this.ctx;
  const padding = UI_CONFIG.PADDING;

  // Set font for UI - using Cormorant Garamond (universal game font)
  ctx.font = `${UI_CONFIG.FONT_SIZE}px ${UI_CONFIG.FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Golden color for text
  const goldColor = VISUAL_CONFIG.DEFAULT_GOLDEN;

  // Wave number display (top left)
  ctx.fillStyle = goldColor;
  ctx.fillText(`Wave: ${this.wave + 1}`, padding, padding);
  
  // Player score display under wave number (top left)
  ctx.fillText(`Score: ${this.score}`, padding, padding + 20);

  // Speed button (top right)
  const speedButtonSize = UI_CONFIG.SPEED_BUTTON_SIZE;
  const speedButtonX = this.canvas.width - padding - speedButtonSize;
  const speedButtonY = padding;
  
  // Draw button background
  ctx.fillStyle = this.speedButtonHover ? 'rgba(212, 175, 55, 0.3)' : 'rgba(212, 175, 55, 0.2)';
  ctx.fillRect(speedButtonX, speedButtonY, speedButtonSize, speedButtonSize);
  
  // Draw button border
  ctx.strokeStyle = goldColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(speedButtonX, speedButtonY, speedButtonSize, speedButtonSize);
  
  // Draw speed text
  ctx.fillStyle = goldColor;
  ctx.font = `${UI_CONFIG.LARGE_FONT_SIZE}px ${UI_CONFIG.FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${this.gameSpeed}x`, speedButtonX + speedButtonSize / 2, speedButtonY + speedButtonSize / 2);

  // Health bar (bottom center)
  if (this.warden) {
    const barWidth = UI_CONFIG.HEALTH_BAR_WIDTH;
    const barHeight = UI_CONFIG.HEALTH_BAR_HEIGHT;
    const barX = (this.canvas.width - barWidth) / 2;
    const barY = this.canvas.height - padding - barHeight;
    const healthPercent = this.warden.health / this.warden.maxHealth;

    // Background
    ctx.fillStyle = this.nightMode ? 'rgba(255, 255, 255, 0.2)' : '#eee';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Health
    ctx.fillStyle = this.wardenCoreColor;
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    // Border
    ctx.strokeStyle = this.nightMode ? 'rgba(255, 255, 255, 0.6)' : '#999';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }

  // Life lines indicator (bottom left)
  // Lines stacked on top of each other, each representing 2 lives
  const horizontalPadding = padding;
  const lineWidth = this.canvas.width - (horizontalPadding * 2);
  const lineHeight = UI_CONFIG.LIFE_LINE_HEIGHT;
  const lineGap = UI_CONFIG.LIFE_LINE_GAP;
  const startX = horizontalPadding;
  const startY = this.canvas.height - padding - (lineHeight + lineGap) * this.lifeLines.length;
  
  for (let i = 0; i < this.lifeLines.length; i++) {
    const line = this.lifeLines[i];
    const y = startY + i * (lineHeight + lineGap);
    
    if (line.state === 'gone') {
      continue; // Don't draw gone lines
    }
    
    ctx.strokeStyle = this.uiTextColor;
    ctx.lineWidth = lineHeight;
    ctx.lineCap = 'butt';
    
    if (line.state === 'solid') {
      // Draw solid line
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + lineWidth, y);
      ctx.stroke();
    } else if (line.state === 'dashed') {
      // Draw dashed line
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(startX + lineWidth, y);
      ctx.stroke();
      ctx.setLineDash([]); // Reset to solid
    }
  }
}
