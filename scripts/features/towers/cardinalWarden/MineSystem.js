/**
 * Mine System for Cardinal Warden
 *
 * Extracted from cardinalWardenSimulation.js (Build 474).
 * Handles drifting mines spawned by grapheme M (index 12).
 *
 * Features:
 * - Mine class with drift physics and pulsing rendering
 * - Mine-enemy/boss collision detection with explosion wave creation
 * - Mine lifecycle management (expiry, offscreen removal)
 * - Mine rendering with pulsing size effect
 */

import { MINE_CONFIG, VISUAL_CONFIG } from '../cardinalWardenConfig.js';
import { ExpandingWave } from './WaveSystem.js';

/**
 * Represents a drifting mine created by grapheme M.
 * Mines drift slowly and explode on contact with enemies.
 */
export class Mine {
  constructor(x, y, config = {}) {
    this.x = x;
    this.y = y;
    this.size = config.size || MINE_CONFIG.MINE_SIZE;
    this.color = config.color || VISUAL_CONFIG.DEFAULT_GOLDEN;
    this.baseDamage = config.baseDamage || 1; // Base weapon damage for explosion calculation
    this.explosionRadius = config.explosionRadius || 50; // Radius of explosion wave
    this.weaponId = config.weaponId || 0;

    // Random drift direction
    this.driftAngle = Math.random() * Math.PI * 2;
    this.driftSpeed = MINE_CONFIG.DRIFT_SPEED;

    // Lifetime tracking
    this.age = 0;
    this.maxAge = MINE_CONFIG.MINE_LIFETIME * 1000; // Convert to milliseconds

    // Pulsing visual effect
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.pulseSpeed = 3; // Radians per second

    // Explosion state
    this.exploded = false;
  }

  update(deltaTime) {
    const dt = deltaTime / 1000; // Convert to seconds

    // Drift slowly
    this.x += Math.cos(this.driftAngle) * this.driftSpeed * dt;
    this.y += Math.sin(this.driftAngle) * this.driftSpeed * dt;

    // Update age
    this.age += deltaTime;

    // Update pulse phase for visual effect
    this.pulsePhase += this.pulseSpeed * dt;
  }

  /**
   * Check if mine has expired.
   */
  isExpired() {
    return this.age >= this.maxAge;
  }

  /**
   * Check if mine is off screen.
   */
  isOffscreen(width, height) {
    const margin = this.size * 2;
    return this.x < -margin || this.x > width + margin ||
           this.y < -margin || this.y > height + margin;
  }

  /**
   * Get the current visual size based on pulse effect.
   */
  getVisualSize() {
    const pulseFactor = 0.2; // 20% size variation
    return this.size * (1 + pulseFactor * Math.sin(this.pulsePhase));
  }

  /**
   * Render the mine on the canvas.
   */
  render(ctx) {
    const visualSize = this.getVisualSize();

    ctx.save();
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.8;

    // Draw mine as a circle
    ctx.beginPath();
    ctx.arc(this.x, this.y, visualSize, 0, Math.PI * 2);
    ctx.fill();

    // Draw inner glow
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, visualSize * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

/**
 * Update all mines, handle collisions with enemies/bosses, and create explosion waves.
 * Mines that explode, expire, or go offscreen are removed from the array.
 * @param {Mine[]} mines - Array of active mines (mutated in place)
 * @param {object[]} enemies - Enemy objects with x, y, size
 * @param {object[]} bosses - Boss objects with x, y, size
 * @param {number} canvasWidth - Canvas width for offscreen boundary check
 * @param {number} canvasHeight - Canvas height for offscreen boundary check
 * @param {number} deltaTime - Time elapsed since last update (milliseconds)
 * @returns {ExpandingWave[]} New explosion waves spawned by mine detonations
 */
export function updateMines(mines, enemies, bosses, canvasWidth, canvasHeight, deltaTime) {
  const newWaves = [];
  const minesToRemove = [];

  for (let i = 0; i < mines.length; i++) {
    const mine = mines[i];
    mine.update(deltaTime);

    // Remove expired or offscreen mines
    if (mine.isExpired() || mine.isOffscreen(canvasWidth, canvasHeight)) {
      minesToRemove.push(i);
      continue;
    }

    // Check collision with enemies
    for (let ei = 0; ei < enemies.length; ei++) {
      const enemy = enemies[ei];
      const dx = mine.x - enemy.x;
      const dy = mine.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const collisionDist = mine.size + enemy.size;

      if (dist < collisionDist) {
        // Mine hit enemy - explode!
        mine.exploded = true;
        newWaves.push(new ExpandingWave(mine.x, mine.y, mine.baseDamage, mine.explosionRadius, mine.color));
        minesToRemove.push(i);
        break;
      }
    }

    // If mine already marked for removal, skip boss check
    if (minesToRemove.includes(i)) continue;

    // Check collision with bosses
    for (let bi = 0; bi < bosses.length; bi++) {
      const boss = bosses[bi];
      const dx = mine.x - boss.x;
      const dy = mine.y - boss.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const collisionDist = mine.size + boss.size;

      if (dist < collisionDist) {
        // Mine hit boss - explode!
        mine.exploded = true;
        newWaves.push(new ExpandingWave(mine.x, mine.y, mine.baseDamage, mine.explosionRadius, mine.color));
        minesToRemove.push(i);
        break;
      }
    }
  }

  // Remove mines that exploded, expired, or went offscreen (highest index first)
  const sortedMineIndices = minesToRemove.sort((a, b) => b - a);
  for (const i of sortedMineIndices) {
    mines.splice(i, 1);
  }

  return newWaves;
}

/**
 * Render all active mines.
 * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
 * @param {Mine[]} mines - Active mines to render
 */
export function renderMines(ctx, mines) {
  if (!ctx || !mines || mines.length === 0) return;

  for (const mine of mines) {
    mine.render(ctx);
  }
}
