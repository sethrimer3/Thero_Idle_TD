/**
 * Swarm System for Cardinal Warden
 *
 * Extracted from cardinalWardenSimulation.js (Build 475).
 * Handles swarm ships spawned by grapheme N (index 13).
 *
 * Features:
 * - SwarmShip class: tiny triangle ships that orbit an aim target
 * - SwarmLaser class: short green laser projectiles fired by swarm ships
 * - checkSwarmLaserCollisions: collision detection with damage and kill callbacks
 * - renderSwarmShips / renderSwarmLasers: standalone render helpers
 */

import { SWARM_CONFIG, VISUAL_CONFIG } from '../cardinalWardenConfig.js';

/**
 * Represents a swarm ship spawned by grapheme N (index 13).
 * These tiny triangle ships swarm around the player's aim target and fire green lasers.
 */
export class SwarmShip {
  constructor(x, y, targetX, targetY, damage, fireRate, rng) {
    this.x = x;
    this.y = y;
    this.targetX = targetX;
    this.targetY = targetY;
    this.damage = damage;
    this.fireRate = fireRate; // Time between shots in milliseconds
    this.rng = rng;

    // Visual properties
    this.size = SWARM_CONFIG.SHIP_SIZE;
    this.color = VISUAL_CONFIG.DEFAULT_SWARM_SHIP_COLOR;
    this.headingAngle = 0;

    // Movement behavior - swarm randomly around target
    this.swarmOffsetAngle = rng.range(0, Math.PI * 2);
    this.swarmOffsetDistance = rng.range(0, SWARM_CONFIG.SWARM_RADIUS);
    this.swarmRotationSpeed = rng.range(0.5, 1.5); // Radians per second
    this.swarmRotationDirection = rng.next() > 0.5 ? 1 : -1;

    // Trail for visual effect
    this.trail = [];
    this.maxTrailLength = SWARM_CONFIG.TRAIL_LENGTH;

    // Firing timer
    this.fireTimer = 0;
  }

  update(deltaTime, targetX, targetY) {
    const dt = deltaTime / 1000; // Convert to seconds

    // Update target position
    this.targetX = targetX;
    this.targetY = targetY;

    // Update swarm rotation
    this.swarmOffsetAngle += this.swarmRotationSpeed * this.swarmRotationDirection * dt;

    // Calculate desired position around target
    const desiredX = this.targetX + Math.cos(this.swarmOffsetAngle) * this.swarmOffsetDistance;
    const desiredY = this.targetY + Math.sin(this.swarmOffsetAngle) * this.swarmOffsetDistance;

    // Move toward desired position
    const dx = desiredX - this.x;
    const dy = desiredY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      const dirX = dx / dist;
      const dirY = dy / dist;
      this.x += dirX * SWARM_CONFIG.MOVEMENT_SPEED * dt;
      this.y += dirY * SWARM_CONFIG.MOVEMENT_SPEED * dt;

      // Update heading based on movement
      this.headingAngle = Math.atan2(dy, dx);
    }

    // Update trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.shift();
    }

    // Update fire timer
    this.fireTimer += deltaTime;
  }

  /**
   * Check if the ship is ready to fire.
   */
  canFire() {
    return this.fireTimer >= this.fireRate;
  }

  /**
   * Reset the fire timer after firing.
   */
  resetFireTimer() {
    this.fireTimer = 0;
  }

  /**
   * Render the swarm ship as a triangle with a thin trail.
   */
  render(ctx) {
    // Draw trail
    if (this.trail.length > 1) {
      ctx.save();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Draw triangle ship
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.headingAngle);

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(this.size / 2, 0); // Tip of triangle (pointing right when angle is 0)
    ctx.lineTo(-this.size / 2, -this.size / 3);
    ctx.lineTo(-this.size / 2, this.size / 3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

/**
 * Represents a laser projectile fired by swarm ships.
 */
export class SwarmLaser {
  constructor(x, y, targetX, targetY, damage, color) {
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.color = color || SWARM_CONFIG.LASER_COLOR;

    // Calculate direction toward target
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      this.vx = (dx / dist) * SWARM_CONFIG.LASER_SPEED;
      this.vy = (dy / dist) * SWARM_CONFIG.LASER_SPEED;
    } else {
      this.vx = 0;
      this.vy = -SWARM_CONFIG.LASER_SPEED; // Default upward
    }

    this.angle = Math.atan2(this.vy, this.vx);
    this.length = SWARM_CONFIG.LASER_LENGTH;
    this.width = SWARM_CONFIG.LASER_WIDTH;
  }

  update(deltaTime) {
    const dt = deltaTime / 1000; // Convert to seconds
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  isOffscreen(width, height) {
    return this.x < -this.length || this.x > width + this.length ||
           this.y < -this.length || this.y > height + this.length;
  }

  render(ctx) {
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.9;

    // Draw laser as a line
    const endX = this.x + Math.cos(this.angle) * this.length;
    const endY = this.y + Math.sin(this.angle) * this.length;

    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    ctx.restore();
  }
}

/**
 * Check collisions between swarm lasers and enemies/bosses.
 * Lasers are consumed on first hit.
 * @param {SwarmLaser[]} lasers - Active laser projectiles
 * @param {object[]} enemies - Enemy objects with x, y, size, takeDamage, scoreValue
 * @param {object[]} bosses - Boss objects with x, y, size, takeDamage, scoreValue
 * @param {function} onDamage - Callback when damage is applied: (target, damage, x, y)
 * @param {function} onKill - Callback when target is killed: (target, x, y, scoreValue, isBoss)
 * @returns {{ killedEnemyIndices: number[], killedBossIndices: number[], hitLaserIndices: number[] }} Sorted descending
 */
export function checkSwarmLaserCollisions(lasers, enemies, bosses, onDamage, onKill) {
  if (!lasers || lasers.length === 0) {
    return { killedEnemyIndices: [], killedBossIndices: [], hitLaserIndices: [] };
  }

  const lasersToRemove = new Set();
  const enemiesToRemove = new Set();
  const bossesToRemove = new Set();

  for (let li = 0; li < lasers.length; li++) {
    const laser = lasers[li];
    if (lasersToRemove.has(li)) continue;

    // Check collision with regular enemies
    for (let ei = 0; ei < enemies.length; ei++) {
      const enemy = enemies[ei];
      if (enemiesToRemove.has(ei)) continue;

      const dx = laser.x - enemy.x;
      const dy = laser.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < enemy.size + laser.width) {
        // Hit - apply damage
        if (onDamage) onDamage(enemy, laser.damage, enemy.x, enemy.y);
        const killed = enemy.takeDamage(laser.damage);

        if (killed) {
          enemiesToRemove.add(ei);
          if (onKill) onKill(enemy, enemy.x, enemy.y, enemy.scoreValue, false);
        }

        // Laser is consumed
        lasersToRemove.add(li);
        break;
      }
    }

    // Check collision with bosses (only if laser hasn't already hit something)
    if (!lasersToRemove.has(li)) {
      for (let bi = 0; bi < bosses.length; bi++) {
        const boss = bosses[bi];
        if (bossesToRemove.has(bi)) continue;

        const dx = laser.x - boss.x;
        const dy = laser.y - boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < boss.size + laser.width) {
          // Hit - apply damage
          if (onDamage) onDamage(boss, laser.damage, boss.x, boss.y);
          const killed = boss.takeDamage(laser.damage);

          if (killed) {
            bossesToRemove.add(bi);
            if (onKill) onKill(boss, boss.x, boss.y, boss.scoreValue, true);
          }

          // Laser is consumed
          lasersToRemove.add(li);
          break;
        }
      }
    }
  }

  return {
    killedEnemyIndices: Array.from(enemiesToRemove).sort((a, b) => b - a),
    killedBossIndices: Array.from(bossesToRemove).sort((a, b) => b - a),
    hitLaserIndices: Array.from(lasersToRemove).sort((a, b) => b - a),
  };
}

/**
 * Render all active swarm ships.
 * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
 * @param {SwarmShip[]} ships - Active swarm ships to render
 */
export function renderSwarmShips(ctx, ships) {
  if (!ctx || !ships || ships.length === 0) return;

  for (const ship of ships) {
    ship.render(ctx);
  }
}

/**
 * Render all active swarm lasers.
 * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
 * @param {SwarmLaser[]} lasers - Active swarm lasers to render
 */
export function renderSwarmLasers(ctx, lasers) {
  if (!ctx || !lasers || lasers.length === 0) return;

  for (const laser of lasers) {
    laser.render(ctx);
  }
}
