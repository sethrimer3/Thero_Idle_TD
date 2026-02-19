/**
 * Wave System for Cardinal Warden
 * 
 * Extracted from cardinalWardenSimulation.js (Build 472).
 * Handles expanding damage waves spawned by grapheme G (index 6).
 * 
 * Features:
 * - ExpandingWave class for wave physics and rendering
 * - Wave-enemy collision detection with ring thickness calculations
 * - Damage application to enemies and bosses
 * - Wave lifecycle management (spawn, update, remove)
 */

import { WAVE_CONFIG } from '../cardinalWardenConfig.js';

/**
 * Represents an expanding damage wave that spreads outward from a point.
 * Waves deal damage to enemies they touch as they expand.
 */
export class ExpandingWave {
  /**
   * @param {number} x - Center x coordinate
   * @param {number} y - Center y coordinate
   * @param {number} damage - Damage dealt to enemies touched by wave
   * @param {number} maxRadius - Maximum radius the wave expands to
   * @param {string} color - Stroke color for wave rendering
   */
  constructor(x, y, damage, maxRadius, color) {
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.maxRadius = maxRadius;
    this.currentRadius = 0;
    this.expansionSpeed = maxRadius / WAVE_CONFIG.EXPANSION_DURATION_SECONDS;
    this.color = color || '#d4af37'; // Default golden color
    this.hitEnemies = new Set(); // Track which enemies have been hit (by index)
    this.hitBosses = new Set(); // Track which bosses have been hit (by index)
    this.alpha = 1.0; // Start fully opaque
    this.finished = false;
  }

  /**
   * Update wave expansion and fade-out.
   * @param {number} deltaTime - Time elapsed since last update (milliseconds)
   */
  update(deltaTime) {
    const dt = deltaTime / 1000; // Convert to seconds
    this.currentRadius += this.expansionSpeed * dt;
    
    // Fade out as the wave approaches max radius
    const progress = this.currentRadius / this.maxRadius;
    this.alpha = Math.max(0, 1 - progress);
    
    // Mark as finished when fully expanded
    if (this.currentRadius >= this.maxRadius) {
      this.finished = true;
    }
  }

  /**
   * Render wave as a circular stroke with alpha fade.
   * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
   */
  render(ctx) {
    if (this.alpha <= 0) return;
    
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.currentRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Factory function to create an expanding wave from a bullet impact.
 * @param {number} x - Impact x coordinate
 * @param {number} y - Impact y coordinate
 * @param {object} bullet - Bullet that triggered the wave
 * @returns {ExpandingWave|null} - New wave instance or null if bullet has no wave effect
 */
export function createWaveFromBulletImpact(x, y, bullet) {
  if (!bullet.hasWaveEffect || !bullet.waveRadius || bullet.waveRadius <= 0) {
    return null;
  }
  
  const waveDamage = bullet.damage * WAVE_CONFIG.DAMAGE_MULTIPLIER;
  const waveColor = bullet.color || '#d4af37';
  return new ExpandingWave(x, y, waveDamage, bullet.waveRadius, waveColor);
}

/**
 * Update all expanding waves and handle collisions with enemies/bosses.
 * @param {ExpandingWave[]} waves - Array of active waves
 * @param {number} deltaTime - Time elapsed since last update (milliseconds)
 * @param {object[]} enemies - Array of enemy objects
 * @param {object[]} bosses - Array of boss objects
 * @param {function} onDamage - Callback when damage is dealt: (target, damage, x, y, isKilled)
 * @param {function} onKill - Callback when target is killed: (target, x, y, scoreValue)
 */
export function updateExpandingWaves(waves, deltaTime, enemies, bosses, onDamage, onKill) {
  const enemiesToRemove = new Set();
  const bossesToRemove = new Set();
  
  // Update each wave
  for (let i = waves.length - 1; i >= 0; i--) {
    const wave = waves[i];
    wave.update(deltaTime);
    
    // Check collisions with enemies
    for (let ei = 0; ei < enemies.length; ei++) {
      if (wave.hitEnemies.has(ei)) continue; // Already hit this enemy
      if (enemiesToRemove.has(ei)) continue; // Already killed
      
      const enemy = enemies[ei];
      const dx = wave.x - enemy.x;
      const dy = wave.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Check if enemy is touching the wave ring
      // Ring thickness includes enemy size for better collision detection
      const enemySize = enemy.size || WAVE_CONFIG.DEFAULT_ENEMY_SIZE;
      const ringThickness = WAVE_CONFIG.RING_BASE_THICKNESS + enemySize;
      const distFromRing = Math.abs(dist - wave.currentRadius);
      
      if (distFromRing < ringThickness && dist < wave.maxRadius) {
        // Enemy is touching the wave - apply damage
        wave.hitEnemies.add(ei);
        const killed = enemy.takeDamage(wave.damage);
        
        if (onDamage) {
          onDamage(enemy, wave.damage, enemy.x, enemy.y, killed);
        }
        
        if (killed) {
          enemiesToRemove.add(ei);
          if (onKill) {
            onKill(enemy, enemy.x, enemy.y, enemy.scoreValue);
          }
        }
      }
    }
    
    // Check collisions with bosses
    for (let bi = 0; bi < bosses.length; bi++) {
      if (wave.hitBosses.has(bi)) continue; // Already hit this boss
      if (bossesToRemove.has(bi)) continue; // Already killed
      
      const boss = bosses[bi];
      const dx = wave.x - boss.x;
      const dy = wave.y - boss.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Check if boss is touching the wave ring
      // Ring thickness includes boss size for better collision detection
      const bossSize = boss.size || WAVE_CONFIG.DEFAULT_BOSS_SIZE;
      const ringThickness = WAVE_CONFIG.RING_BASE_THICKNESS + bossSize;
      const distFromRing = Math.abs(dist - wave.currentRadius);
      
      if (distFromRing < ringThickness && dist < wave.maxRadius) {
        // Boss is touching the wave - apply damage
        wave.hitBosses.add(bi);
        const killed = boss.takeDamage(wave.damage);
        
        if (onDamage) {
          onDamage(boss, wave.damage, boss.x, boss.y, killed);
        }
        
        if (killed) {
          bossesToRemove.add(bi);
          if (onKill) {
            onKill(boss, boss.x, boss.y, boss.scoreValue);
          }
        }
      }
    }
    
    // Remove finished waves
    if (wave.finished) {
      waves.splice(i, 1);
    }
  }
  
  // Return indices of killed targets so caller can remove them
  return {
    killedEnemyIndices: Array.from(enemiesToRemove).sort((a, b) => b - a),
    killedBossIndices: Array.from(bossesToRemove).sort((a, b) => b - a),
  };
}

/**
 * Render all active expanding waves.
 * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
 * @param {ExpandingWave[]} waves - Array of active waves to render
 */
export function renderExpandingWaves(ctx, waves) {
  if (!ctx || !waves) return;
  
  for (const wave of waves) {
    wave.render(ctx);
  }
}
