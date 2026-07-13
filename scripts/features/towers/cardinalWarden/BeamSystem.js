/**
 * Beam System for Cardinal Warden
 *
 * Extracted from cardinalWardenSimulation.js (Build 474).
 * Handles continuous beam weapons created by grapheme L (index 11).
 *
 * Features:
 * - Beam class for continuous line-of-sight weapons
 * - Beam-enemy/boss collision detection with damage tick rate limiting
 * - Point-to-line-segment distance calculation utility
 * - Beam rendering with glow effect
 */

import { BEAM_CONFIG, VISUAL_CONFIG } from '../cardinalWardenConfig.js';

/**
 * Represents a continuous beam weapon created by grapheme L.
 * The beam deals damage multiple times per second to all enemies it touches.
 */
export class Beam {
  constructor(x, y, angle, config = {}) {
    this.x = x; // Origin x
    this.y = y; // Origin y
    this.angle = angle;
    this.damage = config.damage || 1; // Damage per tick
    this.damagePerSecond = config.damagePerSecond || 1; // Total damage per second
    this.color = config.color || VISUAL_CONFIG.DEFAULT_GOLDEN;
    this.width = config.width || BEAM_CONFIG.BEAM_WIDTH;
    this.maxLength = config.maxLength || BEAM_CONFIG.MAX_BEAM_LENGTH;
    this.weaponId = config.weaponId || 0; // Track which weapon this beam belongs to

    // Track when each enemy was last damaged (to apply damage at correct rate)
    this.enemyLastDamageTime = new Map(); // Maps enemy index to timestamp
    this.bossLastDamageTime = new Map(); // Maps boss index to timestamp

    // Time between damage ticks (in milliseconds)
    this.damageInterval = 1000 / BEAM_CONFIG.DAMAGE_TICKS_PER_SECOND;
  }

  /**
   * Check if enough time has passed to damage an enemy again.
   */
  canDamageEnemy(enemyIndex, currentTime) {
    const lastTime = this.enemyLastDamageTime.get(enemyIndex);
    if (lastTime === undefined) return true;
    return (currentTime - lastTime) >= this.damageInterval;
  }

  /**
   * Check if enough time has passed to damage a boss again.
   */
  canDamageBoss(bossIndex, currentTime) {
    const lastTime = this.bossLastDamageTime.get(bossIndex);
    if (lastTime === undefined) return true;
    return (currentTime - lastTime) >= this.damageInterval;
  }

  /**
   * Record that an enemy was damaged at the current time.
   */
  recordEnemyDamage(enemyIndex, currentTime) {
    this.enemyLastDamageTime.set(enemyIndex, currentTime);
  }

  /**
   * Record that a boss was damaged at the current time.
   */
  recordBossDamage(bossIndex, currentTime) {
    this.bossLastDamageTime.set(bossIndex, currentTime);
  }

  /**
   * Calculate the end point of the beam.
   */
  getEndPoint() {
    return {
      x: this.x + Math.cos(this.angle) * this.maxLength,
      y: this.y + Math.sin(this.angle) * this.maxLength,
    };
  }

  /**
   * Render the beam on the canvas.
   */
  render(ctx) {
    const end = this.getEndPoint();

    ctx.save();
    ctx.globalAlpha = BEAM_CONFIG.BEAM_ALPHA;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width;
    ctx.lineCap = 'round';

    // Draw the beam as a line
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // Add a glow effect
    ctx.globalAlpha = BEAM_CONFIG.BEAM_ALPHA * 0.3;
    ctx.lineWidth = this.width * 3;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.restore();
  }
}

/**
 * Calculate the distance from a point to a line segment.
 * Used for beam collision detection.
 * @param {number} px - Point x
 * @param {number} py - Point y
 * @param {number} x1 - Line start x
 * @param {number} y1 - Line start y
 * @param {number} x2 - Line end x
 * @param {number} y2 - Line end y
 * @returns {number} Distance from point to line segment
 */
export function pointToLineDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  // Use epsilon for floating-point comparison
  if (lengthSquared < 1e-10) {
    // Line segment is effectively a point
    const dpx = px - x1;
    const dpy = py - y1;
    return Math.hypot(dpx, dpy);
  }

  // Calculate projection of point onto line
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t)); // Clamp to line segment

  // Find closest point on line segment
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  // Return distance to closest point
  const distX = px - closestX;
  const distY = py - closestY;
  return Math.hypot(distX, distY);
}

/**
 * Check beam collisions with enemies and bosses, applying damage at the tick rate.
 * @param {Beam[]} beams - Active beam objects
 * @param {object[]} enemies - Enemy objects with x, y, size, takeDamage, scoreValue
 * @param {object[]} bosses - Boss objects with x, y, size, takeDamage, scoreValue
 * @param {function} onDamage - Callback when damage is applied: (target, damage, x, y)
 * @param {function} onKill - Callback when target is killed: (target, x, y, scoreValue, isBoss)
 * @returns {{ killedEnemyIndices: number[], killedBossIndices: number[] }} Sorted descending
 */
export function checkBeamCollisions(beams, enemies, bosses, onDamage, onKill) {
  if (!beams || beams.length === 0) {
    return { killedEnemyIndices: [], killedBossIndices: [] };
  }

  const currentTime = Date.now();
  const enemiesToRemove = new Set();
  const bossesToRemove = new Set();

  for (const beam of beams) {
    const beamEnd = beam.getEndPoint();

    // Check enemies
    for (let ei = 0; ei < enemies.length; ei++) {
      const enemy = enemies[ei];
      if (enemiesToRemove.has(ei)) continue;

      const dist = pointToLineDistance(
        enemy.x, enemy.y,
        beam.x, beam.y,
        beamEnd.x, beamEnd.y
      );

      if (dist < enemy.size + beam.width / 2) {
        if (beam.canDamageEnemy(ei, currentTime)) {
          if (onDamage) onDamage(enemy, beam.damage, enemy.x, enemy.y);
          const killed = enemy.takeDamage(beam.damage);
          beam.recordEnemyDamage(ei, currentTime);

          if (killed) {
            enemiesToRemove.add(ei);
            if (onKill) onKill(enemy, enemy.x, enemy.y, enemy.scoreValue, false);
          }
        }
      }
    }

    // Check bosses
    for (let bi = 0; bi < bosses.length; bi++) {
      const boss = bosses[bi];
      if (bossesToRemove.has(bi)) continue;

      const dist = pointToLineDistance(
        boss.x, boss.y,
        beam.x, beam.y,
        beamEnd.x, beamEnd.y
      );

      if (dist < boss.size + beam.width / 2) {
        if (beam.canDamageBoss(bi, currentTime)) {
          if (onDamage) onDamage(boss, beam.damage, boss.x, boss.y);
          const killed = boss.takeDamage(beam.damage);
          beam.recordBossDamage(bi, currentTime);

          if (killed) {
            bossesToRemove.add(bi);
            if (onKill) onKill(boss, boss.x, boss.y, boss.scoreValue, true);
          }
        }
      }
    }
  }

  return {
    killedEnemyIndices: Array.from(enemiesToRemove).sort((a, b) => b - a),
    killedBossIndices: Array.from(bossesToRemove).sort((a, b) => b - a),
  };
}

/**
 * Render all active beams.
 * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
 * @param {Beam[]} beams - Active beams to render
 */
export function renderBeams(ctx, beams) {
  if (!ctx || !beams || beams.length === 0) return;

  for (const beam of beams) {
    beam.render(ctx);
  }
}
