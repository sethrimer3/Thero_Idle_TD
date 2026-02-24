// Tsadi tower render methods extracted from ParticleFusionSimulation for file size management.

import { TWO_PI, HALF_PI } from './shared/TowerUtils.js';
import { getTierClassification, applyAlphaToColor } from './tsadiTowerData.js';

/**
 * Render the ParticleFusionSimulation to its canvas context.
 * Called via renderTsadiSimulation.call(this) where `this` is the simulation instance.
 */
export function renderTsadiSimulation() {
  if (!this.ctx) return;

  const ctx = this.ctx;

  // Clear with dark background
  ctx.fillStyle = this.backgroundColor;
  ctx.fillRect(0, 0, this.width, this.height);
  
  // Draw permanent glowing Tsadi glyphs in background
  for (const glyph of this.permanentGlyphs) {
    ctx.fillStyle = `rgba(255, 220, 100, ${glyph.alpha})`;
    ctx.font = `${glyph.size}px 'Times New Roman', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('צ', glyph.x, glyph.y);
  }
  
  // Draw spawn effects
  if (this.visualSettings.renderSpawnEffects) {
    for (const effect of this.spawnEffects) {
      if (effect.type === 'flash') {
        // Radial flash
        const gradient = ctx.createRadialGradient(
          effect.x, effect.y, 0,
          effect.x, effect.y, effect.radius,
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${effect.alpha})`);
        gradient.addColorStop(0.6, `rgba(255, 255, 255, ${effect.alpha * 0.5})`);
        gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, TWO_PI);
        ctx.fill();
      } else if (effect.type === 'wave') {
        // Expanding wave ring
        ctx.strokeStyle = `rgba(255, 255, 255, ${effect.alpha * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, TWO_PI);
        ctx.stroke();
      }
    }
  }
  
  // Draw interactive wave effects from user clicks/taps
  for (const wave of this.interactiveWaves) {
    // Check if this is a directional wave (cone) or omnidirectional (circle)
    const isDirectional = wave.direction !== null && wave.direction !== undefined;
    
    if (isDirectional) {
      // Draw directional cone wave
      const halfConeAngle = (wave.coneAngle || Math.PI / 2) / 2;
      const startAngle = wave.direction - halfConeAngle;
      const endAngle = wave.direction + halfConeAngle;
      
      // Draw cone outline
      ctx.strokeStyle = `rgba(100, 200, 255, ${wave.alpha * 0.7})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.radius, startAngle, endAngle);
      ctx.lineTo(wave.x, wave.y);
      ctx.closePath();
      ctx.stroke();
      
      // Fill cone with gradient
      ctx.save();
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.radius, startAngle, endAngle);
      ctx.lineTo(wave.x, wave.y);
      ctx.closePath();
      ctx.clip();
      
      const gradient = ctx.createRadialGradient(
        wave.x, wave.y, wave.radius * 0.3,
        wave.x, wave.y, wave.radius
      );
      gradient.addColorStop(0, `rgba(100, 200, 255, ${wave.alpha * 0.4})`);
      gradient.addColorStop(0.7, `rgba(100, 200, 255, ${wave.alpha * 0.2})`);
      gradient.addColorStop(1, `rgba(100, 200, 255, 0)`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // Draw omnidirectional (circular) wave
      ctx.strokeStyle = `rgba(100, 200, 255, ${wave.alpha * 0.7})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.radius, 0, TWO_PI);
      ctx.stroke();
      
      // Add inner glow effect
      const gradient = ctx.createRadialGradient(
        wave.x, wave.y, wave.radius * 0.7,
        wave.x, wave.y, wave.radius
      );
      gradient.addColorStop(0, `rgba(100, 200, 255, 0)`);
      gradient.addColorStop(0.5, `rgba(100, 200, 255, ${wave.alpha * 0.3})`);
      gradient.addColorStop(1, `rgba(100, 200, 255, 0)`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.radius, 0, TWO_PI);
      ctx.fill();
    }
  }
  
  // Draw fusion effects
  if (this.visualSettings.renderFusionEffects) {
    for (const effect of this.fusionEffects) {
      if (effect.type === 'flash') {
        // Radial flash
        const gradient = ctx.createRadialGradient(
          effect.x, effect.y, 0,
          effect.x, effect.y, effect.radius,
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${effect.alpha * 0.8})`);
        gradient.addColorStop(0.5, `rgba(255, 255, 200, ${effect.alpha * 0.4})`);
        gradient.addColorStop(1, `rgba(255, 255, 200, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, TWO_PI);
        ctx.fill();
      } else if (effect.type === 'ring') {
        // Expanding ring
        ctx.strokeStyle = `rgba(255, 255, 255, ${effect.alpha * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, TWO_PI);
        ctx.stroke();
      }
    }
  }
  
  // Draw blurred filaments between particles experiencing interaction forces.
  // Batch by link type to reduce context state changes
  if (this.visualSettings.renderForceLinks) {
    // Group links by type (repelling vs attracting) to batch rendering
    const repellingLinks = [];
    const attractingLinks = [];
    
    for (const link of this.forceLinks) {
      if (link.isRepelling) {
        repellingLinks.push(link);
      } else {
        attractingLinks.push(link);
      }
    }
    
    // Render all repelling links with shared shadow settings
    if (repellingLinks.length > 0) {
      ctx.save();
      ctx.lineWidth = 3.0;
      ctx.shadowBlur = 8;
      
      for (const link of repellingLinks) {
        const alpha = link.intensity;
        const baseRgb = '255, 140, 190';
        ctx.strokeStyle = `rgba(${baseRgb}, ${alpha})`;
        ctx.shadowColor = `rgba(${baseRgb}, ${Math.min(0.8, alpha * 2.0)})`;
        ctx.beginPath();
        ctx.moveTo(link.x1, link.y1);
        ctx.lineTo(link.x2, link.y2);
        ctx.stroke();
      }
      ctx.restore();
    }
    
    // Render all attracting links with shared shadow settings
    if (attractingLinks.length > 0) {
      ctx.save();
      ctx.lineWidth = 3.0;
      ctx.shadowBlur = 8;
      
      for (const link of attractingLinks) {
        const alpha = link.intensity;
        const baseRgb = '130, 190, 255';
        ctx.strokeStyle = `rgba(${baseRgb}, ${alpha})`;
        ctx.shadowColor = `rgba(${baseRgb}, ${Math.min(0.8, alpha * 2.0)})`;
        ctx.beginPath();
        ctx.moveTo(link.x1, link.y1);
        ctx.lineTo(link.x2, link.y2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  this.renderBindingAgents(ctx);

  // Draw particles with sub-pixel precision and glow
  // Batch operations to reduce context state changes
  const particleSpriteEnabled = this.particleSpriteReady && this.particleSprite;
  
  for (const particle of this.particles) {
    const classification = getTierClassification(particle.tier);
    
    // Enhanced glow for capital letters and Roman numerals
    let glowRadius = particle.radius * 1.5;
    let glowIntensity = 1.0;
    
    if (classification.cycle === 1) {
      // Capital letters: slightly brighter glow
      glowRadius = particle.radius * 2.0;
      glowIntensity = 1.3;
    } else if (classification.isRoman) {
      // Roman numerals: distinct darker glow
      glowRadius = particle.radius * 2.2;
      glowIntensity = 1.4;
    }
    
    // Outer bright glow for higher tiers
    if (classification.cycle >= 1 || classification.isRoman) {
      const brightGlowGradient = ctx.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, glowRadius
      );
      
      const color = particle.color;
      // Extract RGB from the color and brighten it
      const brightColor = brightenColor.call(this, color, glowIntensity * this.glowIntensity);
      
      brightGlowGradient.addColorStop(0, brightColor);
      brightGlowGradient.addColorStop(0.4, color);
      brightGlowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = brightGlowGradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, glowRadius, 0, TWO_PI);
      ctx.fill();
    }
    
    // Standard outer glow
    const glowGradient = ctx.createRadialGradient(
      particle.x, particle.y, 0,
      particle.x, particle.y, particle.radius * 1.5
    );
    
    const color = particle.color;
    glowGradient.addColorStop(0, color);
    glowGradient.addColorStop(0.7, color);
    glowGradient.addColorStop(1, this.backgroundColor);

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius * 1.5, 0, TWO_PI);
    ctx.fill();

    if (particle.shimmer) {
      const shimmerAlpha = 0.35 + 0.25 * Math.sin((Date.now() / 240) + (particle.shimmerPhase || 0));
      const shimmerColor = particle.shimmerColor || particle.color;
      ctx.save();
      ctx.strokeStyle = applyAlphaToColor(shimmerColor, shimmerAlpha);
      ctx.lineWidth = Math.max(1.5, particle.radius * 0.35);
      ctx.setLineDash([
        Math.max(2, particle.radius * 0.8),
        Math.max(2, particle.radius * 0.6),
      ]);
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius * 1.25, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Main particle body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, TWO_PI);
    ctx.fill();

    // Inner highlight for 3D effect
    const highlightGradient = ctx.createRadialGradient(
      particle.x - particle.radius * 0.3,
      particle.y - particle.radius * 0.3,
      0,
      particle.x,
      particle.y,
      particle.radius
    );
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = highlightGradient;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, TWO_PI);
    ctx.fill();

    // Overlay the Tsadi particle sprite to introduce the new sprite artwork.
    if (particleSpriteEnabled) {
      // Blend the sprite softly so tier colors remain dominant.
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.globalCompositeOperation = 'screen';
      const spriteSize = particle.radius * 2.8;
      ctx.drawImage(
        this.particleSprite,
        particle.x - spriteSize * 0.5,
        particle.y - spriteSize * 0.5,
        spriteSize,
        spriteSize
      );
      ctx.restore();
    }

    // Render the tier glyph in the particle center to reinforce tier identity.
    if (particle.label) {
      const fontSize = Math.max(particle.radius * 1.1, 10);
      ctx.font = `${fontSize}px 'Times New Roman', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Draw black outline for visibility
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.lineWidth = Math.max(2, fontSize * 0.125);
      ctx.strokeText(particle.label, particle.x, particle.y);
      
      // Draw white text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(particle.label, particle.x, particle.y);
    }
  }
}

/**
 * Render binding agent anchors, their connections, and any placement preview.
 * Called via renderTsadiBindingAgents.call(this, ctx) where `this` is the simulation instance.
 * @param {CanvasRenderingContext2D} ctx - Active 2D context.
 */
export function renderTsadiBindingAgents(ctx) {
  const particleMap = new Map(this.particles.map((particle) => [particle.id, particle]));
  const radius = this.getBindingAgentRadius();

  const drawAgent = (agent, { isPreview = false, hasActiveMolecule = false, hasValidCombo = false } = {}) => {
    const baseColor = isPreview ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.9)';
    // Yellow color for valid combinations, otherwise the existing color scheme
    const bondColor = hasValidCombo
      ? 'rgba(255, 220, 80, 0.9)'
      : hasActiveMolecule
        ? 'rgba(255, 215, 130, 0.9)'
        : 'rgba(180, 200, 255, 0.7)';
    const triangleRadius = radius * 1.5;
    const cornerRadius = radius * 0.55;
    const angleOffset = -HALF_PI;
    const corners = [0, 1, 2].map((index) => {
      const theta = angleOffset + (index * TWO_PI) / 3;
      return {
        x: agent.x + Math.cos(theta) * triangleRadius,
        y: agent.y + Math.sin(theta) * triangleRadius,
      };
    });

    // Outline the triangular bond to hint at three connected spheres rather than a flask glyph.
    ctx.save();
    ctx.strokeStyle = bondColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach((corner) => {
      ctx.lineTo(corner.x, corner.y);
    });
    ctx.closePath();
    ctx.stroke();

    // Batch corner rendering - create gradients and draw all corners
    corners.forEach((corner) => {
      const glow = ctx.createRadialGradient(corner.x, corner.y, cornerRadius * 0.2, corner.x, corner.y, cornerRadius);
      glow.addColorStop(0, bondColor);
      glow.addColorStop(1, baseColor);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, cornerRadius, 0, TWO_PI);
      ctx.fill();
      ctx.strokeStyle = bondColor;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });
    ctx.restore();

    // Overlay the Waals sprite to incorporate the new binding agent artwork.
    if (this.bindingAgentSpriteReady && this.bindingAgentSprite) {
      // Fade the sprite slightly for preview placement states.
      ctx.save();
      ctx.globalAlpha = isPreview ? 0.35 : 0.75;
      const spriteSize = radius * 2.6;
      ctx.drawImage(
        this.bindingAgentSprite,
        agent.x - spriteSize / 2,
        agent.y - spriteSize / 2,
        spriteSize,
        spriteSize
      );
      ctx.restore();
    }
  };

  // Preview indicator when the player drags a fresh binding agent.
  if (this.bindingAgentPreview) {
    drawAgent({ ...this.bindingAgentPreview, activeMolecules: [] }, { isPreview: true });
  }

  for (const agent of this.bindingAgents) {
    const hasActiveMolecule =
      agent.awaitingCodexTap || (agent.activeMolecules?.length || 0) > 0 || (agent.popTimer || 0) > 0;
    const hasValidCombo = this.hasValidCombination(agent);
    
    for (const connection of agent.connections) {
      const target = particleMap.get(connection.particleId);
      if (!target) continue;

      const dx = target.x - agent.x;
      const dy = target.y - agent.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / distance;
      const ny = dy / distance;
      const reach = Math.max(target.radius, Math.min(distance, connection.bondLength || distance));
      const endX = agent.x + nx * reach;
      const endY = agent.y + ny * reach;

      // Yellow color for valid combinations, otherwise the existing color scheme
      const connectionColor = hasValidCombo
        ? 'rgba(255, 220, 80, 0.8)'
        : hasActiveMolecule
          ? 'rgba(255, 215, 130, 0.8)'
          : 'rgba(180, 220, 255, 0.7)';

      ctx.save();
      ctx.strokeStyle = connectionColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(agent.x, agent.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.restore();
    }

    drawAgent(agent, { hasActiveMolecule, hasValidCombo });
  }
}

/**
 * Brighten a color for enhanced glow effects.
 * Called via brightenColor.call(this, colorStr, intensity) where `this` is the simulation instance.
 */
export function brightenColor(colorStr, intensity) {
  // Parse RGB from color string
  const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    let r = parseInt(match[1]);
    let g = parseInt(match[2]);
    let b = parseInt(match[3]);
    
    // Brighten by intensity factor
    r = Math.min(255, Math.round(r * intensity));
    g = Math.min(255, Math.round(g * intensity));
    b = Math.min(255, Math.round(b * intensity));
    
    return `rgba(${r}, ${g}, ${b}, 0.6)`;
  }
  
  return colorStr;
}
