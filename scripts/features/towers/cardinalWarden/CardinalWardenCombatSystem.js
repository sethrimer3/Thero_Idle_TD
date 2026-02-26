/**
 * CardinalWardenCombatSystem
 *
 * Bullet update, collision detection, score/damage popups, and wave/mine update
 * logic extracted from CardinalWardenSimulation. Every function uses `.call(this, ...)`
 * so that `this` always refers to the simulation instance.
 */

import {
  CHAIN_CONFIG,
  SPLIT_CONFIG,
  EXPLOSIVE_CONFIG,
  PULSE_CONFIG,
  RICOCHET_CONFIG,
} from '../cardinalWardenConfig.js';
import {
  MathBullet,
} from './CardinalWardenEntities.js';
import {
  createWaveFromBulletImpact,
  updateExpandingWaves as updateWaveSystem,
} from './WaveSystem.js';
import {
  checkBeamCollisions as checkBeamCollisionsSystem,
} from './BeamSystem.js';
import {
  updateMines as updateMinesSystem,
} from './MineSystem.js';

// ---------------------------------------------------------------------------
// Bullet utilities
// ---------------------------------------------------------------------------

/**
 * Bounce a bullet off nearby ship trails when it grazes their wake.
 */
export function tryBounceBulletOffTrails(bullet) {
  if (!this.canvas) return false;
  if (bullet.bounceOnTrails === false) return false;
  if (typeof bullet.applyTrailBounce !== 'function') return false;
  if (bullet.age - bullet.lastTrailBounceTime < 45) return false;

  const proximityRadius = bullet.size + 2;
  const proximityRadiusSq = proximityRadius * proximityRadius;
  const segmentsToInspect = 8;

  const checkTrail = (trail) => {
    if (!trail || trail.length < 2) return false;
    const startIdx = Math.max(1, trail.length - segmentsToInspect);
    for (let i = trail.length - 1; i >= startIdx; i--) {
      const p1 = trail[i - 1];
      const p2 = trail[i];
      const segDx = p2.x - p1.x;
      const segDy = p2.y - p1.y;
      const segLenSq = segDx * segDx + segDy * segDy;
      if (segLenSq === 0) continue;

      const t = Math.max(0, Math.min(1, ((bullet.x - p1.x) * segDx + (bullet.y - p1.y) * segDy) / segLenSq));
      const closestX = p1.x + segDx * t;
      const closestY = p1.y + segDy * t;
      const distX = bullet.x - closestX;
      const distY = bullet.y - closestY;

      if (distX * distX + distY * distY <= proximityRadiusSq) {
        // Trail tangent -> normal; approximate reflection cheaply.
        const normalX = -segDy;
        const normalY = segDx;
        bullet.applyTrailBounce(normalX, normalY);
        bullet.lastTrailBounceTime = bullet.age;
        return true;
      }
    }
    return false;
  };

  for (const enemy of this.enemies) {
    if (checkTrail(enemy.trail)) {
      return true;
    }
  }

  for (const boss of this.bosses) {
    if (checkTrail(boss.trail)) {
      return true;
    }
  }

  return false;
}

/**
 * Update all bullets.
 */
export function updateBullets(deltaTime) {
  if (!this.canvas) return;

  const toRemove = [];

  for (let i = 0; i < this.bullets.length; i++) {
    const bullet = this.bullets[i];
    bullet.update(deltaTime, this.canvas.width, this.canvas.height, this.enemies);

    // Grapheme U (index 20) - Pulse waves
    if (bullet.pulseRate > 0 && bullet.pulseRadius > 0) {
      bullet.pulseTimer += deltaTime / 1000;
      const pulseInterval = 1 / bullet.pulseRate;
      
      if (bullet.pulseTimer >= pulseInterval) {
        bullet.pulseTimer = 0;
        // Allow dagesh pulse graphemes to override pulse damage scaling.
        const pulseDamageMultiplier = bullet.pulseDamageMultiplier || PULSE_CONFIG.PULSE_DAMAGE_MULTIPLIER;
        const pulseDamage = bullet.damage * pulseDamageMultiplier;
        
        // Damage all enemies in pulse radius
        for (const enemy of this.enemies) {
          const dist = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
          if (dist <= bullet.pulseRadius) {
            this.spawnDamageNumber(enemy.x, enemy.y, pulseDamage);
            enemy.takeDamage(pulseDamage);
          }
        }
        
        // Also damage bosses
        for (const boss of this.bosses) {
          const dist = Math.hypot(boss.x - bullet.x, boss.y - bullet.y);
          if (dist <= bullet.pulseRadius) {
            this.spawnDamageNumber(boss.x, boss.y, pulseDamage);
            boss.takeDamage(pulseDamage);
          }
        }
      }
    }
    
    // Grapheme Y (index 24) - Vortex pull
    if (bullet.vortexRadius > 0 && bullet.vortexStrength > 0) {
      const dt = deltaTime / 1000;
      
      // Pull enemies toward bullet
      for (const enemy of this.enemies) {
        const dx = bullet.x - enemy.x;
        const dy = bullet.y - enemy.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist <= bullet.vortexRadius && dist > 0) {
          const pullForce = bullet.vortexStrength * dt;
          enemy.x += (dx / dist) * pullForce;
          enemy.y += (dy / dist) * pullForce;
        }
      }
      
      // Also pull bosses
      for (const boss of this.bosses) {
        const dx = bullet.x - boss.x;
        const dy = bullet.y - boss.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist <= bullet.vortexRadius && dist > 0) {
          const pullForce = bullet.vortexStrength * dt;
          boss.x += (dx / dist) * pullForce;
          boss.y += (dy / dist) * pullForce;
        }
      }
    }

    tryBounceBulletOffTrails.call(this, bullet);

    // Grapheme X (index 23) - Lifetime modifier affects when bullets are removed
    const lifetimeCheck = bullet.lifetimeMultiplier || 1;
    const baseLifetime = 5000; // Base lifetime in milliseconds
    const adjustedLifetime = baseLifetime * lifetimeCheck;
    const isOffscreen = bullet.isOffscreen(this.canvas.width, this.canvas.height);
    
    // Check age-based removal first, then offscreen
    if (bullet.age > adjustedLifetime) {
      toRemove.push(i);
    } else if (isOffscreen) {
      // Only for normal/extended lifetime, allow some offscreen time
      if (lifetimeCheck <= 1 || bullet.age > adjustedLifetime * 0.8) {
        toRemove.push(i);
      }
    }
  }

  // Remove offscreen bullets
  for (let i = toRemove.length - 1; i >= 0; i--) {
    this.bullets.splice(toRemove[i], 1);
  }
}

// ---------------------------------------------------------------------------
// Collision detection
// ---------------------------------------------------------------------------

/**
 * Check collisions between bullets and enemies.
 */
export function checkCollisions() {
  const bulletsToRemove = new Set();
  const enemiesToRemove = new Set();
  const killedEnemyPositions = []; // Track positions of killed enemies for phoneme drops

  for (let bi = 0; bi < this.bullets.length; bi++) {
    const bullet = this.bullets[bi];
    if (bulletsToRemove.has(bi)) continue;

    // Initialize collision memory for bullet variants that don't define it.
    const hitEnemies = bullet.hitEnemies || (bullet.hitEnemies = new Set());

    for (let ei = 0; ei < this.enemies.length; ei++) {
      const enemy = this.enemies[ei];
      if (enemiesToRemove.has(ei)) continue;
      if (hitEnemies.has(ei)) continue;

      const dx = bullet.x - enemy.x;
      const dy = bullet.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const collisionDist = bullet.size + enemy.size;

      if (dist < collisionDist) {
        // Spawn damage number to show how much damage was dealt
        this.spawnDamageNumber(enemy.x, enemy.y, bullet.damage);
        
        const killed = enemy.takeDamage(bullet.damage);
        
        // Spawn expanding wave if seventh grapheme is present
        if (bullet.hasWaveEffect && bullet.waveRadius > 0) {
          const wave = createWaveFromBulletImpact(enemy.x, enemy.y, bullet);
          if (wave) {
            this.expandingWaves.push(wave);
          }
        }
        
        // Apply elemental effect from tenth grapheme (J)
        if (bullet.elementalEffect === 'burning') {
          enemy.applyBurning();
        } else if (bullet.elementalEffect === 'freezing') {
          enemy.applyFreeze();
        }
        
        // Handle new grapheme effects on hit (O-Z)
        
        // Grapheme Q (index 16) - Split bullets
        // Only split if we have 2 or more bullets to create
        if (bullet.splitCount >= 2 && !bulletsToRemove.has(bi)) {
          const splitAngle = SPLIT_CONFIG.SPLIT_SPREAD_ANGLE;
          const angleStep = splitAngle / (bullet.splitCount - 1);
          const startAngle = bullet.baseAngle - (splitAngle / 2);
          
          for (let s = 0; s < bullet.splitCount; s++) {
            const angle = startAngle + (s * angleStep);
            const splitBullet = new MathBullet(enemy.x, enemy.y, angle, {
              speed: bullet.speed,
              damage: bullet.damage * SPLIT_CONFIG.SPLIT_DAMAGE_MULTIPLIER,
              size: bullet.size * 0.7,
              color: bullet.color,
              level: bullet.level,
              maxTrailLength: bullet.maxTrailLength,
            });
            this.bullets.push(splitBullet);
          }
        }
        
        // Grapheme R (index 17) - Chain lightning
        // Note: Initial enemy already received full damage above in normal collision
        // This chains ADDITIONAL damage to nearby enemies
        if (bullet.chainCount > 0) {
          // Allow dagesh chain graphemes to override damage retention.
          const chainDamageMultiplier = bullet.chainDamageMultiplier || CHAIN_CONFIG.CHAIN_DAMAGE_MULTIPLIER;
          let currentChainDamage = bullet.damage * chainDamageMultiplier; // First chain gets reduced damage
          let currentTarget = enemy;
          const chainedTargets = new Set([ei]); // Track to avoid chaining to same target (includes initial hit)
          
          for (let c = 0; c < bullet.chainCount; c++) {
            // Apply additional damage decay for subsequent chains (after first chain target)
            if (c > 0) {
              currentChainDamage *= chainDamageMultiplier;
            }
            
            // Find nearest unchained enemy (excludes initial hit and previously chained)
            let nearestEnemy = null;
            let nearestDist = Infinity;
            
            for (let cei = 0; cei < this.enemies.length; cei++) {
              if (chainedTargets.has(cei) || enemiesToRemove.has(cei)) continue;
              const ce = this.enemies[cei];
              const dist = Math.hypot(ce.x - currentTarget.x, ce.y - currentTarget.y);
              if (dist < bullet.chainRange && dist < nearestDist) {
                nearestDist = dist;
                nearestEnemy = { enemy: ce, index: cei };
              }
            }
            
            if (nearestEnemy) {
              // Chain to this enemy
              this.spawnDamageNumber(nearestEnemy.enemy.x, nearestEnemy.enemy.y, currentChainDamage);
              const chainKilled = nearestEnemy.enemy.takeDamage(currentChainDamage);
              
              if (chainKilled) {
                enemiesToRemove.add(nearestEnemy.index);
                this.addScore(nearestEnemy.enemy.scoreValue);
                this.spawnScorePopup(nearestEnemy.enemy.x, nearestEnemy.enemy.y, nearestEnemy.enemy.scoreValue);
                killedEnemyPositions.push({ x: nearestEnemy.enemy.x, y: nearestEnemy.enemy.y, isBoss: false });
              }
              
              chainedTargets.add(nearestEnemy.index);
              currentTarget = nearestEnemy.enemy;
            } else {
              break; // No more targets in range
            }
          }
        }
        
        // Grapheme W (index 22) - Explosive bullets
        if (bullet.explosionRadius > 0) {
          const explosionDamage = bullet.damage * EXPLOSIVE_CONFIG.EXPLOSION_DAMAGE_MULTIPLIER;
          
          // Damage all enemies in explosion radius
          for (let exi = 0; exi < this.enemies.length; exi++) {
            if (enemiesToRemove.has(exi)) continue;
            const exEnemy = this.enemies[exi];
            const dist = Math.hypot(exEnemy.x - enemy.x, exEnemy.y - enemy.y);
            
            if (dist <= bullet.explosionRadius) {
              this.spawnDamageNumber(exEnemy.x, exEnemy.y, explosionDamage);
              const exKilled = exEnemy.takeDamage(explosionDamage);
              
              if (exKilled) {
                enemiesToRemove.add(exi);
                this.addScore(exEnemy.scoreValue);
                this.spawnScorePopup(exEnemy.x, exEnemy.y, exEnemy.scoreValue);
                killedEnemyPositions.push({ x: exEnemy.x, y: exEnemy.y, isBoss: false });
              }
            }
          }
        }
        
        // Grapheme O (index 14) - Ricochet
        if (bullet.ricochetBounces > 0 && bullet.ricochetCount < bullet.ricochetBounces) {
          // Find nearest unchained enemy for ricochet
          let nearestEnemy = null;
          let nearestDist = Infinity;
          
          for (let rei = 0; rei < this.enemies.length; rei++) {
            if (rei === ei || enemiesToRemove.has(rei) || hitEnemies.has(rei)) continue;
            const re = this.enemies[rei];
            const dist = Math.hypot(re.x - enemy.x, re.y - enemy.y);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestEnemy = re;
            }
          }
          
          if (nearestEnemy) {
            // Redirect bullet to nearest enemy
            bullet.ricochetCount++;
            bullet.damage *= RICOCHET_CONFIG.BOUNCE_DAMAGE_MULTIPLIER;
            const dx = nearestEnemy.x - bullet.x;
            const dy = nearestEnemy.y - bullet.y;
            bullet.baseAngle = Math.atan2(dy, dx);
            // Mark current enemy as hit to prevent bouncing back
            hitEnemies.add(ei);
            // Don't mark for removal yet - let it ricochet
          } else {
            // No more targets to ricochet to, remove the bullet
            if (!bulletsToRemove.has(bi)) {
              bulletsToRemove.add(bi);
            }
          }
        } else if (bullet.ricochetBounces === 0 || bullet.ricochetCount >= bullet.ricochetBounces) {
          // Normal behavior: no ricochet or max bounces reached
          // Piercing logic will handle bullet removal if needed
        }

        if (killed) {
          enemiesToRemove.add(ei);
          this.addScore(enemy.scoreValue);
          // Spawn floating score popup at enemy position
          this.spawnScorePopup(enemy.x, enemy.y, enemy.scoreValue);
          // Track position for phoneme drop
          killedEnemyPositions.push({ x: enemy.x, y: enemy.y, isBoss: false });
        }

        if (bullet.piercing) {
          hitEnemies.add(ei);
          // Check if piercing limit has been reached (0 = unlimited)
          // Count total hits including both enemies and bosses
          const totalHits = bullet.hitEnemies.size + bullet.hitBosses.size;
          if (bullet.piercingLimit > 0 && totalHits >= bullet.piercingLimit) {
            bulletsToRemove.add(bi);
            break;
          }
        } else {
          bulletsToRemove.add(bi);
          break;
        }
      }
    }
  }

  // Remove destroyed enemies first (before boss collision check)
  const enemyIndices = Array.from(enemiesToRemove).sort((a, b) => b - a);
  for (const i of enemyIndices) {
    this.enemies.splice(i, 1);
  }

  // Check collisions with bosses (using remaining bullets)
  const bossesToRemove = new Set();
  for (let bi = 0; bi < this.bullets.length; bi++) {
    const bullet = this.bullets[bi];
    if (bulletsToRemove.has(bi)) continue;

    const hitBosses = bullet.hitBosses || (bullet.hitBosses = new Set());

    for (let boi = 0; boi < this.bosses.length; boi++) {
      const boss = this.bosses[boi];
      if (bossesToRemove.has(boi)) continue;
      if (hitBosses.has(boi)) continue;

      const dx = bullet.x - boss.x;
      const dy = bullet.y - boss.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const collisionDist = bullet.size + boss.size;

      if (dist < collisionDist) {
        // Spawn damage number to show how much damage was dealt
        this.spawnDamageNumber(boss.x, boss.y, bullet.damage);
        
        const killed = boss.takeDamage(bullet.damage);
        
        // Spawn expanding wave if seventh grapheme is present
        if (bullet.hasWaveEffect && bullet.waveRadius > 0) {
          const wave = createWaveFromBulletImpact(boss.x, boss.y, bullet);
          if (wave) {
            this.expandingWaves.push(wave);
          }
        }
        
        // Apply elemental effect from tenth grapheme (J)
        if (bullet.elementalEffect === 'burning') {
          boss.applyBurning();
        } else if (bullet.elementalEffect === 'freezing') {
          boss.applyFreeze();
        }

        if (killed) {
          bossesToRemove.add(boi);
          this.addScore(boss.scoreValue);
          // Spawn floating score popup at boss position
          this.spawnScorePopup(boss.x, boss.y, boss.scoreValue);
          // Track position for phoneme drop (bosses drop multiple)
          killedEnemyPositions.push({ x: boss.x, y: boss.y, isBoss: true });
        }

        if (bullet.piercing) {
          hitBosses.add(boi);
          // Check if piercing limit has been reached (0 = unlimited)
          // Count total hits across both enemies and bosses
          const totalHits = bullet.hitEnemies.size + bullet.hitBosses.size;
          if (bullet.piercingLimit > 0 && totalHits >= bullet.piercingLimit) {
            bulletsToRemove.add(bi);
            break;
          }
        } else {
          bulletsToRemove.add(bi);
          break;
        }
      }
    }
  }

  // Remove destroyed bosses
  const bossIndices = Array.from(bossesToRemove).sort((a, b) => b - a);
  for (const i of bossIndices) {
    this.bosses.splice(i, 1);
  }

  // Remove all bullets that hit enemies or bosses (single pass)
  const bulletIndices = Array.from(bulletsToRemove).sort((a, b) => b - a);
  for (const i of bulletIndices) {
    this.bullets.splice(i, 1);
  }
  
  // Notify about enemy kills for phoneme drops
  if (this.onEnemyKill && killedEnemyPositions.length > 0) {
    for (const killPos of killedEnemyPositions) {
      this.onEnemyKill(killPos.x, killPos.y, killPos.isBoss);
    }
  }
}

/**
 * Check collisions between beams and enemies.
 * Beams deal damage multiple times per second to all enemies they touch.
 * Delegates to extracted BeamSystem (Build 474).
 */
export function checkBeamCollisions() {
  const { killedEnemyIndices, killedBossIndices } = checkBeamCollisionsSystem(
    this.beams,
    this.enemies,
    this.bosses,
    (target, damage, x, y) => {
      // onDamage callback
      this.spawnDamageNumber(x, y, damage);
    },
    (target, x, y, scoreValue, isBoss) => {
      // onKill callback
      this.addScore(scoreValue);
      this.spawnScorePopup(x, y, scoreValue);
      if (this.onEnemyKill) {
        this.onEnemyKill(x, y, isBoss);
      }
    }
  );

  // Remove killed enemies
  for (const i of killedEnemyIndices) {
    this.enemies.splice(i, 1);
  }

  // Remove killed bosses
  for (const i of killedBossIndices) {
    this.bosses.splice(i, 1);
  }
}

// ---------------------------------------------------------------------------
// Score / damage popups
// ---------------------------------------------------------------------------

/**
 * Add score and notify listeners.
 */
export function addScore(amount) {
  this.score += amount;
  if (this.onScoreChange) {
    this.onScoreChange(this.score);
  }
}

/**
 * Spawn a floating score popup at the given position.
 */
export function spawnScorePopup(x, y, value) {
  this.scorePopups.push({
    x,
    y,
    value,
    age: 0,
    alpha: 1,
    offsetY: 0,
  });
}

/**
 * Spawn a floating damage number at the given position.
 */
export function spawnDamageNumber(x, y, damage) {
  const DAMAGE_NUMBER_X_SPREAD = 10; // Horizontal spread to prevent overlapping numbers
  this.damageNumbers.push({
    x,
    y,
    damage,
    age: 0,
    alpha: 1,
    offsetY: 0,
    // Add slight randomness to x position so overlapping numbers are visible
    xOffset: (Math.random() - 0.5) * DAMAGE_NUMBER_X_SPREAD,
  });
}

/**
 * Update all floating score popups.
 */
export function updateScorePopups(deltaTime) {
  const dt = deltaTime / 1000;
  for (let i = this.scorePopups.length - 1; i >= 0; i--) {
    const popup = this.scorePopups[i];
    popup.age += dt;
    popup.offsetY -= 40 * dt; // Float upward
    popup.alpha = Math.max(0, 1 - popup.age / 1.0); // Fade out over 1 second
    
    // Remove popups that have fully faded
    if (popup.alpha <= 0 || popup.age > 1.0) {
      this.scorePopups.splice(i, 1);
    }
  }
}

/**
 * Update all floating damage numbers.
 */
export function updateDamageNumbers(deltaTime) {
  const dt = deltaTime / 1000;
  for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
    const dmg = this.damageNumbers[i];
    dmg.age += dt;
    dmg.offsetY -= 50 * dt; // Float upward slightly faster than score popups
    dmg.alpha = Math.max(0, 1 - dmg.age / 0.8); // Fade out over 0.8 seconds
    
    // Remove damage numbers that have fully faded
    if (dmg.alpha <= 0 || dmg.age > 0.8) {
      this.damageNumbers.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Wave / mine update
// ---------------------------------------------------------------------------

/**
 * Update expanding waves from seventh grapheme (index 6).
 * Waves expand outward and damage enemies they touch.
 */
export function updateExpandingWaves(deltaTime) {
  // Delegate to extracted Wave System
  const { killedEnemyIndices, killedBossIndices } = updateWaveSystem(
    this.expandingWaves,
    deltaTime,
    this.enemies,
    this.bosses,
    (target, damage, x, y, isKilled) => {
      // onDamage callback
      this.spawnDamageNumber(x, y, damage);
    },
    (target, x, y, scoreValue) => {
      // onKill callback
      this.addScore(scoreValue);
      this.spawnScorePopup(x, y, scoreValue);
    }
  );
  
  // Remove killed enemies
  for (const i of killedEnemyIndices) {
    this.enemies.splice(i, 1);
  }
  
  // Remove killed bosses
  for (const i of killedBossIndices) {
    this.bosses.splice(i, 1);
  }
}

/**
 * Update all mines and check for collisions with enemies.
 * Mines explode on contact with enemies, creating expanding damage waves.
 * Delegates to extracted MineSystem (Build 474).
 */
export function updateMines(deltaTime) {
  if (!this.canvas) return;

  // Delegate to extracted Mine System - returns new explosion waves
  const newWaves = updateMinesSystem(
    this.mines,
    this.enemies,
    this.bosses,
    this.canvas.width,
    this.canvas.height,
    deltaTime
  );

  // Add explosion waves to expanding waves array
  for (const wave of newWaves) {
    this.expandingWaves.push(wave);
  }
}
