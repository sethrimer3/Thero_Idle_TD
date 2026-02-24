// Kuf Spire Combat System
// All unit movement, combat, and projectile methods extracted from KufBattlefieldSimulation (Phase 4.1.2, Build 508).
// Functions are called with .call(sim) so 'this' refers to the simulation instance.

import {
  TWO_PI,
  MARINE_CONFIG,
  SNIPER_CONFIG,
  SPLAYER_CONFIG,
  LASER_CONFIG,
  TURRET_CONFIG,
  STRUCTURE_CONFIG,
  GAMEPLAY_CONFIG,
  KUF_CORE_SHIP_COMBAT,
  SPLAYER_SPIN_BOOST_MULTIPLIER,
  SPLAYER_SPIN_BOOST_DURATION,
} from './kufSimulationConfig.js';

// Destructure config constants used by combat methods.
const MARINE_ACCELERATION = MARINE_CONFIG.ACCELERATION;
const MARINE_RADIUS = MARINE_CONFIG.RADIUS;
const MARINE_BULLET_SPEED = MARINE_CONFIG.BULLET_SPEED;

const SNIPER_BULLET_SPEED = SNIPER_CONFIG.BULLET_SPEED;

const SPLAYER_ROCKET_SPEED = SPLAYER_CONFIG.ROCKET_SPEED;

// Define the piercing laser unit's silhouette and engagement range.
const LASER_BULLET_SPEED = LASER_CONFIG.BULLET_SPEED;
// Define how many total hits a piercing laser beam can register before dissipating.
const LASER_PIERCE_COUNT = 3;

const TURRET_BULLET_SPEED = TURRET_CONFIG.BULLET_SPEED;

const MINE_EXPLOSION_RADIUS = STRUCTURE_CONFIG.MINE_EXPLOSION_RADIUS;

const BULLET_CULLING_MARGIN = GAMEPLAY_CONFIG.BULLET_CULLING_MARGIN;

/**
 * Accelerate a unit toward a target point, returning true when close enough to stop.
 * @param {object} marine - Unit to move.
 * @param {number} targetX - Desired x coordinate in world space.
 * @param {number} targetY - Desired y coordinate in world space.
 * @param {number} delta - Delta time in seconds.
 * @returns {boolean} True when the unit is within the stopping threshold.
 */
export function steerUnitToward(marine, targetX, targetY, delta) {
  const dx = targetX - marine.x;
  const dy = targetY - marine.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= 5) {
    marine.vx = 0;
    marine.vy = 0;
    return true;
  }
  const targetVx = (dx / dist) * marine.moveSpeed;
  const targetVy = (dy / dist) * marine.moveSpeed;
  const acceleration = MARINE_ACCELERATION * delta;

  if (marine.vx < targetVx) {
    marine.vx = Math.min(targetVx, marine.vx + acceleration);
  } else if (marine.vx > targetVx) {
    marine.vx = Math.max(targetVx, marine.vx - acceleration);
  }

  if (marine.vy < targetVy) {
    marine.vy = Math.min(targetVy, marine.vy + acceleration);
  } else if (marine.vy > targetVy) {
    marine.vy = Math.max(targetVy, marine.vy - acceleration);
  }
  return false;
}

/**
 * Ease a unit's velocity back to zero.
 * @param {object} marine - Unit to decelerate.
 * @param {number} delta - Delta time in seconds.
 */
export function decelerateUnit(marine, delta) {
  const deceleration = MARINE_ACCELERATION * delta;
  if (Math.abs(marine.vy) > deceleration) {
    marine.vy += marine.vy > 0 ? -deceleration : deceleration;
  } else {
    marine.vy = 0;
  }
  if (Math.abs(marine.vx) > deceleration) {
    marine.vx += marine.vx > 0 ? -deceleration : deceleration;
  } else {
    marine.vx = 0;
  }
}

export function updateMarines(delta) {
  const focusedEnemy = this.getFocusedEnemy();
  this.marines.forEach((marine) => {
    this.updateMarineStatus(marine, delta);
    if (marine.health <= 0) {
      return;
    }
    // Animate splayer rotation continuously, with optional boost after firing.
    if (marine.type === 'splayer') {
      const boostedSpin = marine.rotationBoostTimer > 0 ? SPLAYER_SPIN_BOOST_MULTIPLIER : 1;
      marine.rotationBoostTimer = Math.max(0, marine.rotationBoostTimer - delta);
      marine.rotation = (marine.rotation + marine.rotationSpeed * boostedSpin * delta) % TWO_PI;
    }
    marine.cooldown = Math.max(0, marine.cooldown - delta);
    // Prioritize the focused enemy when one is set, only firing when it is in range.
    let target = null;
    if (focusedEnemy) {
      const dx = focusedEnemy.x - marine.x;
      const dy = focusedEnemy.y - marine.y;
      if (dx * dx + dy * dy <= marine.range * marine.range) {
        target = focusedEnemy;
      }
    } else {
      // Otherwise scan for the nearest target in range.
      target = this.findClosestTurret(marine.x, marine.y, marine.range);
    }
    
    // Check if unit has a waypoint and hasn't reached it yet
    const hasWaypoint = marine.waypoint && 
      (Math.abs(marine.x - marine.waypoint.x) > 5 || Math.abs(marine.y - marine.waypoint.y) > 5);
    
    // Fire at target if in range
    if (target && marine.cooldown <= 0) {
      if (marine.type === 'splayer') {
        // Launch a randomized ring of homing rockets toward the focused or nearest enemy.
        const rocketCount = 8;
        const rocketDamage = marine.attack * 0.25;
        for (let i = 0; i < rocketCount; i++) {
          const launchAngle = Math.random() * TWO_PI;
          this.spawnBullet({
            owner: 'marine',
            type: 'splayer',
            x: marine.x,
            y: marine.y - marine.radius,
            target,
            speed: SPLAYER_ROCKET_SPEED,
            damage: rocketDamage,
            homing: true,
            angle: launchAngle,
          });
        }
        // Boost splayer spin rate briefly after firing.
        marine.rotationBoostTimer = SPLAYER_SPIN_BOOST_DURATION;
      } else if (marine.type === 'laser') {
        // Fire a piercing laser bolt that can slice through multiple turrets.
        this.spawnBullet({
          owner: 'marine',
          type: 'laser',
          x: marine.x,
          y: marine.y - marine.radius,
          target,
          speed: LASER_BULLET_SPEED,
          damage: marine.attack,
          homing: false,
          pierce: LASER_PIERCE_COUNT,
        });
      } else {
        // Fire a single projectile for non-splayer units.
        this.spawnBullet({
          owner: 'marine',
          type: marine.type,
          x: marine.x,
          y: marine.y - marine.radius,
          target,
          speed: marine.type === 'sniper' ? SNIPER_BULLET_SPEED : MARINE_BULLET_SPEED,
          damage: marine.attack,
          homing: false,
        });
      }

      marine.cooldown = 1 / marine.attackSpeed;
    }
    
    // Handle movement independently of firing
    if (focusedEnemy && !hasWaypoint) {
      // Move toward the focused enemy while holding at max firing distance.
      const dx = focusedEnemy.x - marine.x;
      const dy = focusedEnemy.y - marine.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const desiredDistance = Math.max(0, marine.range - this.targetHoldBuffer);
      const deltaDistance = dist - desiredDistance;
      const holdTolerance = this.targetHoldBuffer;
      if (Math.abs(deltaDistance) > holdTolerance) {
        // Navigate to the stand-off point that keeps the unit at optimal range.
        const standOffX = focusedEnemy.x - (dx / dist) * desiredDistance;
        const standOffY = focusedEnemy.y - (dy / dist) * desiredDistance;
        this.steerUnitToward(marine, standOffX, standOffY, delta);
      } else {
        // Hold position at max range until the target moves.
        this.decelerateUnit(marine, delta);
      }
    } else if (hasWaypoint) {
      // Move toward waypoint (attack-move behavior) - continue even if firing.
      const reached = this.steerUnitToward(marine, marine.waypoint.x, marine.waypoint.y, delta);
      if (reached) {
        // Reached waypoint - clear it and stop.
        marine.waypoint = null;
      }
    } else {
      // No waypoint, default behavior: accelerate forward (negative y is up)
      const targetVy = -marine.moveSpeed;
      const acceleration = MARINE_ACCELERATION * delta;
      if (marine.vy > targetVy) {
        marine.vy = Math.max(targetVy, marine.vy - acceleration);
      } else if (marine.vy < targetVy) {
        marine.vy = Math.min(targetVy, marine.vy + acceleration);
      }
      
      // Decelerate x velocity to 0 when moving in default mode
      const deceleration = MARINE_ACCELERATION * delta;
      if (Math.abs(marine.vx) > deceleration) {
        marine.vx += marine.vx > 0 ? -deceleration : deceleration;
      } else {
        marine.vx = 0;
      }
    }
    
    // Apply velocity
    marine.x += marine.vx * delta;
    marine.y += marine.vy * delta;
  });
  this.marines = this.marines.filter((marine) => marine.health > 0 && marine.y + marine.radius > -40);
}

/**
 * Update core ship position, hull integrity, and cannon firing cadence.
 * @param {number} delta - Delta time in seconds.
 */
export function updateCoreShip(delta) {
  if (!this.coreShip) {
    return;
  }
  // Keep the core ship anchored to the HUD base even as the camera pans.
  const basePosition = this.getBaseWorldPosition();
  this.coreShip.x = basePosition.x;
  this.coreShip.y = basePosition.y;
  
  // Hull repair regeneration (level 2+)
  if (this.coreShip.hullRepair > 0 && this.coreShip.health < this.coreShip.maxHealth) {
    this.coreShip.hullRepairCooldown = Math.max(0, this.coreShip.hullRepairCooldown - delta);
    if (this.coreShip.hullRepairCooldown <= 0) {
      const repairAmount = this.coreShip.hullRepair * delta; // HP per second
      this.coreShip.health = Math.min(this.coreShip.maxHealth, this.coreShip.health + repairAmount);
      this.coreShip.hullRepairCooldown = 0.1; // Check every 0.1 seconds
    }
  }
  
  // Healing aura (level 3+)
  if (this.coreShip.healingAura > 0) {
    this.coreShip.healingAuraCooldown = Math.max(0, this.coreShip.healingAuraCooldown - delta);
    if (this.coreShip.healingAuraCooldown <= 0) {
      const healAmount = this.coreShip.healingAura * 0.1; // HP per tick
      this.marines.forEach((marine) => {
        const dx = marine.x - this.coreShip.x;
        const dy = marine.y - this.coreShip.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= this.coreShip.healingAuraRadius && marine.health < marine.maxHealth) {
          marine.health = Math.min(marine.maxHealth, marine.health + healAmount);
        }
      });
      this.coreShip.healingAuraCooldown = 0.1; // Heal every 0.1 seconds
    }
  }
  
  // Shield regeneration (level 4+)
  if (this.coreShip.maxShield > 0) {
    if (this.coreShip.shieldBroken) {
      // Shield needs to fully regenerate before coming back online
      this.coreShip.shieldRegenTimer += delta;
      if (this.coreShip.shieldRegenTimer >= this.coreShip.shieldRegenDelay) {
        this.coreShip.shield = Math.min(this.coreShip.maxShield, this.coreShip.shield + this.coreShip.shieldRegenRate * delta);
        if (this.coreShip.shield >= this.coreShip.maxShield) {
          this.coreShip.shield = this.coreShip.maxShield;
          this.coreShip.shieldBroken = false;
        }
      }
    } else if (this.coreShip.shield < this.coreShip.maxShield) {
      // Shield regenerates when not broken
      this.coreShip.shieldRegenTimer += delta;
      if (this.coreShip.shieldRegenTimer >= this.coreShip.shieldRegenDelay) {
        this.coreShip.shield = Math.min(this.coreShip.maxShield, this.coreShip.shield + this.coreShip.shieldRegenRate * delta);
      }
    }
  }
  
  // Drone spawning (level 5+)
  if (this.coreShip.droneSpawnRate > 0) {
    this.coreShip.droneSpawnTimer += delta;
    if (this.coreShip.droneSpawnTimer >= this.coreShip.droneSpawnRate) {
      this.coreShip.droneSpawnTimer = 0;
      // Spawn a drone near the core ship
      const angle = Math.random() * TWO_PI;
      const spawnDist = this.coreShip.radius + 15;
      const droneX = this.coreShip.x + Math.cos(angle) * spawnDist;
      const droneY = this.coreShip.y + Math.sin(angle) * spawnDist;
      this.drones.push({
        x: droneX,
        y: droneY,
        vx: 0,
        vy: 0,
        radius: 4,
        health: this.coreShip.droneHealth,
        maxHealth: this.coreShip.droneHealth,
        attack: this.coreShip.droneDamage,
        attackSpeed: 1.5,
        cooldown: 0,
        moveSpeed: 80,
        range: 120,
      });
    }
  }
  
  // Update drones
  this.updateDrones(delta);
  
  if (this.coreShip.health <= 0) {
    return;
  }
  if (this.coreShip.cannons <= 0) {
    return;
  }
  this.coreShip.cannonCooldown = Math.max(0, this.coreShip.cannonCooldown - delta);
  if (this.coreShip.cannonCooldown > 0) {
    return;
  }
  const target = this.findClosestTurret(
    this.coreShip.x,
    this.coreShip.y,
    KUF_CORE_SHIP_COMBAT.CANNON_RANGE
  );
  if (!target) {
    return;
  }
  const totalCannons = this.coreShip.cannons;
  const spread = KUF_CORE_SHIP_COMBAT.CANNON_SPREAD_RADIANS;
  for (let i = 0; i < totalCannons; i++) {
    const lerp = totalCannons > 1 ? (i / (totalCannons - 1)) - 0.5 : 0;
    const angleOffset = spread * lerp;
    const heading = Math.atan2(target.y - this.coreShip.y, target.x - this.coreShip.x) + angleOffset;
    // Core ship cannon fire behaves like turret shots, but scales with cannon count.
    this.spawnBullet({
      owner: 'coreShip',
      type: 'coreShip',
      x: this.coreShip.x,
      y: this.coreShip.y,
      target,
      speed: KUF_CORE_SHIP_COMBAT.CANNON_PROJECTILE_SPEED,
      damage: KUF_CORE_SHIP_COMBAT.CANNON_DAMAGE,
      angle: heading,
    });
  }
  this.coreShip.cannonCooldown = 1 / KUF_CORE_SHIP_COMBAT.CANNON_ATTACK_SPEED;
}

/**
 * Update drone AI and combat behavior.
 * @param {number} delta - Delta time in seconds.
 */
export function updateDrones(delta) {
  this.drones.forEach((drone) => {
    drone.cooldown = Math.max(0, drone.cooldown - delta);
    
    // Find closest enemy
    const target = this.findClosestTurret(drone.x, drone.y, Infinity);
    if (!target) {
      return;
    }
    
    const dx = target.x - drone.x;
    const dy = target.y - drone.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > drone.range) {
      // Move toward enemy
      const moveX = (dx / dist) * drone.moveSpeed * delta;
      const moveY = (dy / dist) * drone.moveSpeed * delta;
      drone.x += moveX;
      drone.y += moveY;
    } else {
      // In range - attack
      if (drone.cooldown <= 0) {
        this.spawnBullet({
          owner: 'marine',
          type: 'drone',
          x: drone.x,
          y: drone.y,
          target,
          speed: MARINE_BULLET_SPEED,
          damage: drone.attack,
        });
        drone.cooldown = 1 / drone.attackSpeed;
      }
    }
  });
  
  // Remove dead drones
  this.drones = this.drones.filter((drone) => drone.health > 0);
}

export function updateTurrets(delta) {
  this.turrets.forEach((turret) => {
    turret.cooldown = Math.max(0, turret.cooldown - delta);
    if (turret.fieldPulse !== undefined) {
      turret.fieldPulse = (turret.fieldPulse + delta) % 1.5;
    }
    if (turret.healVisualTimer !== undefined) {
      turret.healVisualTimer = Math.max(0, turret.healVisualTimer - delta);
    }

    // Handle barracks spawning
    if (turret.isBarracks) {
      turret.spawnTimer -= delta;
      if (turret.spawnTimer <= 0 && turret.currentSpawns < turret.maxSpawns) {
        // Check if barracks is under attack or if any player targets are nearby.
        const isUnderAttack = turret.health < turret.maxHealth;
        const nearbyPlayerTarget = this.findClosestPlayerTarget(
          turret.x,
          turret.y,
          isUnderAttack ? Infinity : turret.spawnRange
        );
        if (nearbyPlayerTarget) {
          // Spawn a unit near the barracks
          const angle = Math.random() * TWO_PI;
          const dist = turret.radius + 10;
          const spawnX = turret.x + Math.cos(angle) * dist;
          const spawnY = turret.y + Math.sin(angle) * dist;
          this.createEnemy(turret.spawnType, spawnX, spawnY, turret.level);
          turret.currentSpawns++;
          turret.spawnTimer = turret.spawnCooldown;
        }
      }
      return;
    }

    if (turret.isSupport) {
      this.handleSupportDrone(turret, delta);
      return;
    }

    // Handle mobile units - always pursue the closest player-controlled target.
    if (turret.isMobile) {
      const nearbyPlayerTarget = this.findClosestPlayerTarget(turret.x, turret.y, Infinity);
      if (nearbyPlayerTarget) {
        // Move toward the marine if out of attack range
        const dx = nearbyPlayerTarget.x - turret.x;
        const dy = nearbyPlayerTarget.y - turret.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > turret.range) {
          // Move toward marine
          const moveX = (dx / dist) * turret.moveSpeed * delta;
          const moveY = (dy / dist) * turret.moveSpeed * delta;
          turret.x += moveX;
          turret.y += moveY;
        } else {
          // In range - attack
          if (turret.cooldown <= 0 && turret.attack > 0) {
            this.fireTurret(turret, nearbyPlayerTarget);
          }
        }
      }
      return;
    }

    // Handle stationary turrets
    if (turret.attack > 0 && !turret.isWall && !turret.isMine) {
      const target = this.findClosestPlayerTarget(turret.x, turret.y, turret.range);
      if (target && turret.cooldown <= 0) {
        this.fireTurret(turret, target);
      }
    }
  });

  // Remove dead enemies, but check for mine explosions first
  this.turrets = this.turrets.filter((turret) => {
    if (turret.health <= 0) {
      // Trigger mine explosion
      if (turret.isMine) {
        this.triggerMineExplosion(turret);
      }
      return false;
    }
    return true;
  });
}

export function triggerMineExplosion(mine) {
  // Damage all units (both player and enemy) within explosion radius
  const explosionRadius = mine.explosionRadius || MINE_EXPLOSION_RADIUS;
  
  // Damage marines
  this.marines.forEach((marine) => {
    const dx = marine.x - mine.x;
    const dy = marine.y - mine.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= explosionRadius) {
      marine.health -= mine.attack * mine.level;
    }
  });

  // Damage enemies
  this.turrets.forEach((turret) => {
    const dx = turret.x - mine.x;
    const dy = turret.y - mine.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= explosionRadius) {
      turret.health -= mine.attack * mine.level;
    }
  });

  // Add visual explosion effect
  this.explosions.push({
    x: mine.x,
    y: mine.y,
    radius: 0,
    maxRadius: explosionRadius,
    life: 0.5,
    maxLife: 0.5,
  });
}

export function updateExplosions(delta) {
  this.explosions.forEach((explosion) => {
    explosion.life -= delta;
    const progress = 1 - (explosion.life / explosion.maxLife);
    explosion.radius = explosion.maxRadius * progress;
  });
  this.explosions = this.explosions.filter((explosion) => explosion.life > 0);
}

export function updateBullets(delta) {
  this.bullets.forEach((bullet) => {
    // Heat-seeking logic for splayer rockets
    if (bullet.homing && bullet.target && bullet.target.health > 0) {
      const dx = bullet.target.x - bullet.x;
      const dy = bullet.target.y - bullet.y;
      const angle = Math.atan2(dy, dx);
      const turnRate = 3.0; // Radians per second
      const currentAngle = Math.atan2(bullet.vy, bullet.vx);
      let angleDiff = angle - currentAngle;
      
      // Normalize angle difference
      while (angleDiff > Math.PI) angleDiff -= TWO_PI;
      while (angleDiff < -Math.PI) angleDiff += TWO_PI;
      
      const turnAmount = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate * delta);
      const newAngle = currentAngle + turnAmount;
      
      bullet.vx = Math.cos(newAngle) * bullet.speed;
      bullet.vy = Math.sin(newAngle) * bullet.speed;
    }
    
    bullet.x += bullet.vx * delta;
    bullet.y += bullet.vy * delta;
    bullet.life -= delta;
    
    if (bullet.owner === 'marine' || bullet.owner === 'coreShip') {
      const hit = this.findHit(this.turrets, bullet);
      if (hit && hit.health > 0) {
        hit.health -= bullet.damage;
        // Track the hit so piercing rounds do not repeatedly strike the same target.
        if (bullet.hitTargets) {
          bullet.hitTargets.add(hit);
        }
        // Remove non-piercing bullets immediately, otherwise decrement remaining pierces.
        if (bullet.pierce > 0) {
          bullet.pierce -= 1;
          if (bullet.pierce <= 0) {
            bullet.life = 0;
          }
        } else {
          bullet.life = 0;
        }
        if (hit.health <= 0) {
          // Base reward from enemy's configured value, plus income per kill bonus (1 + workers).
          const enemyGoldValue = typeof hit.goldValue === 'number' ? hit.goldValue : 5;
          const reward = enemyGoldValue + this.baseIncomePerKill;
          this.goldEarned += reward;
          this.destroyedTurrets += 1;
        }
      }
    } else {
      const hit = this.findHit(this.marines, bullet);
      if (hit && hit.health > 0) {
        hit.health -= bullet.damage;
        if (bullet.effects) {
          this.applyBulletEffects(hit, bullet.effects);
        }
        bullet.life = 0;
      } else {
        // Check for drone hits
        const droneHit = this.findHit(this.drones, bullet);
        if (droneHit && droneHit.health > 0) {
          droneHit.health -= bullet.damage;
          bullet.life = 0;
        } else if (this.coreShip && this.coreShip.health > 0) {
          // Allow enemy projectiles to damage the core ship hull when marines are absent.
          const dx = this.coreShip.x - bullet.x;
          const dy = this.coreShip.y - bullet.y;
          const radius = this.coreShip.radius || MARINE_RADIUS;
          if (dx * dx + dy * dy <= radius * radius) {
            // Check for shield first
            if (this.coreShip.shield > 0 && !this.coreShip.shieldBroken) {
              this.coreShip.shield -= bullet.damage;
              if (this.coreShip.shield <= 0) {
                this.coreShip.shield = 0;
                this.coreShip.shieldBroken = true;
                this.coreShip.shieldRegenTimer = 0;
              }
            } else {
              this.coreShip.health -= bullet.damage;
            }
            // Reset shield regen timer on hit
            this.coreShip.shieldRegenTimer = 0;
            bullet.life = 0;
          }
        }
      }
    }
  });
  this.bullets = this.bullets.filter((bullet) => bullet.life > 0 && this.isOnscreen(bullet));
  this.turrets = this.turrets.filter((turret) => turret.health > 0);
}

export function spawnBullet({ owner, type, x, y, target, speed, damage, homing = false, angle = null, effects = null, pierce = 0 }) {
  const heading = angle !== null ? angle : Math.atan2(target.y - y, target.x - x);
  const vx = Math.cos(heading) * speed;
  const vy = Math.sin(heading) * speed;
  // Initialize hit tracking when bullets are allowed to pierce through multiple targets.
  const hitTargets = pierce > 0 ? new Set() : null;
  this.bullets.push({
    owner,
    type: type || 'marine',
    x,
    y,
    vx,
    vy,
    damage,
    life: 2.5,
    homing,
    target: homing ? target : null,
    speed,
    effects,
    // Store remaining pierce count so lasers can keep traveling after impacts.
    pierce,
    hitTargets,
  });
}

export function fireTurret(turret, target) {
  const modifiers = this.getTurretAttackModifier(turret);
  const projectileSpeed = turret.projectileSpeed || TURRET_BULLET_SPEED;
  const damagePerShot = turret.attack * modifiers.damageMultiplier;
  const attackSpeed = Math.max(0.1, turret.attackSpeed * modifiers.attackSpeedMultiplier);
  const shots = turret.multiShot || 1;
  const spread = turret.spreadAngle || 0;
  const baseAngle = Math.atan2(target.y - turret.y, target.x - turret.x);

  for (let i = 0; i < shots; i++) {
    const lerp = shots > 1 ? (i / (shots - 1)) - 0.5 : 0;
    const angleOffset = spread * lerp;
    this.spawnBullet({
      owner: 'turret',
      type: turret.type,
      x: turret.x,
      y: turret.y + (turret.radius || 0),
      target,
      speed: projectileSpeed,
      damage: damagePerShot,
      angle: baseAngle + angleOffset,
      effects: turret.projectileEffects || null,
    });
  }

  turret.cooldown = 1 / attackSpeed;
}

export function getTurretAttackModifier(turret) {
  let attackSpeedMultiplier = 1;
  let damageMultiplier = 1;
  this.turrets.forEach((node) => {
    if (node === turret || !node.isBuffNode) {
      return;
    }
    const dx = node.x - turret.x;
    const dy = node.y - turret.y;
    const distanceSq = dx * dx + dy * dy;
    const radius = node.buffRadius || 0;
    if (radius > 0 && distanceSq <= radius * radius) {
      if (node.attackSpeedMultiplier) {
        attackSpeedMultiplier *= node.attackSpeedMultiplier;
      }
      if (node.damageMultiplier) {
        damageMultiplier *= node.damageMultiplier;
      }
    }
  });
  return { attackSpeedMultiplier, damageMultiplier };
}

export function handleSupportDrone(drone, delta) {
  const target = this.findDamagedTurret(drone.x, drone.y, drone.sightRange, drone);
  if (!target) {
    return;
  }

  const dx = target.x - drone.x;
  const dy = target.y - drone.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;

  if (distance > (drone.healRange || 80)) {
    const moveX = (dx / distance) * drone.moveSpeed * delta;
    const moveY = (dy / distance) * drone.moveSpeed * delta;
    drone.x += moveX;
    drone.y += moveY;
    drone.activeHealTarget = null;
  } else {
    const healAmount = (drone.healPerSecond || 4) * delta;
    target.health = Math.min(target.maxHealth, target.health + healAmount);
    drone.healVisualTimer = 0.25;
    drone.activeHealTarget = { x: target.x, y: target.y };
  }
}

export function findDamagedTurret(x, y, range, exclude) {
  let closest = null;
  let bestDist = range * range;
  this.turrets.forEach((turret) => {
    if (turret === exclude || turret.health >= turret.maxHealth) {
      return;
    }
    const dx = turret.x - x;
    const dy = turret.y - y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= bestDist) {
      closest = turret;
      bestDist = distSq;
    }
  });
  return closest;
}

export function applyBulletEffects(target, effects) {
  if (!effects) {
    return;
  }
  if (!target.statusEffects) {
    target.statusEffects = [];
  }
  if (effects.type === 'burn') {
    target.statusEffects.push({
      type: 'burn',
      damagePerSecond: effects.damagePerSecond || 1,
      remaining: effects.duration || 2,
    });
  }
  if (effects.type === 'slow') {
    target.statusEffects.push({
      type: 'slow',
      multiplier: Math.max(0.1, effects.multiplier || 0.5),
      remaining: effects.duration || 2,
    });
  }
}

export function updateMarineStatus(marine, delta) {
  if (!marine.statusEffects) {
    marine.statusEffects = [];
  }
  const remainingEffects = [];
  let slowMultiplier = 1;

  marine.statusEffects.forEach((effect) => {
    effect.remaining -= delta;
    if (effect.type === 'burn') {
      marine.health -= (effect.damagePerSecond || 0) * delta;
    }
    if (effect.type === 'slow') {
      slowMultiplier *= Math.max(0.1, effect.multiplier || 1);
    }
    if (effect.remaining > 0) {
      remainingEffects.push(effect);
    }
  });

  marine.statusEffects = remainingEffects;

  const fieldMultiplier = this.getFieldSlowMultiplier(marine);
  const combinedMultiplier = Math.max(0.2, slowMultiplier * fieldMultiplier);
  marine.moveSpeed = marine.baseMoveSpeed * combinedMultiplier;
}

export function getFieldSlowMultiplier(marine) {
  let multiplier = 1;
  this.turrets.forEach((turret) => {
    if (!turret.isStasisField) {
      return;
    }
    const dx = turret.x - marine.x;
    const dy = turret.y - marine.y;
    const radius = turret.slowRadius || 0;
    if (radius <= 0) {
      return;
    }
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq <= radius * radius) {
      multiplier *= 1 - Math.min(0.9, turret.slowAmount || 0.3);
    }
  });
  return Math.max(0.2, multiplier);
}

export function findClosestTurret(x, y, range) {
  // If there's a selected enemy and it's in range, prioritize it
  if (this.selectedEnemy && this.selectedEnemy.health > 0) {
    const dx = this.selectedEnemy.x - x;
    const dy = this.selectedEnemy.y - y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= range * range) {
      return this.selectedEnemy;
    }
  }

  let closest = null;
  let bestDist = range * range;
  this.turrets.forEach((turret) => {
    const dx = turret.x - x;
    const dy = turret.y - y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= bestDist) {
      closest = turret;
      bestDist = distSq;
    }
  });
  return closest;
}

export function findClosestMarine(x, y, range) {
  let closest = null;
  let bestDist = range * range;
  this.marines.forEach((marine) => {
    const dx = marine.x - x;
    const dy = marine.y - y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= bestDist) {
      closest = marine;
      bestDist = distSq;
    }
  });
  return closest;
}

/**
 * Find the closest player-controlled target, including marines, drones, and the core ship hull.
 * @param {number} x - X coordinate in world space.
 * @param {number} y - Y coordinate in world space.
 * @param {number} range - Targeting range in pixels.
 * @returns {object|null} Closest target in range.
 */
export function findClosestPlayerTarget(x, y, range) {
  let closest = this.findClosestMarine(x, y, range);
  let bestDist = closest ? ((closest.x - x) ** 2 + (closest.y - y) ** 2) : range * range;
  
  // Check drones
  this.drones.forEach((drone) => {
    const dx = drone.x - x;
    const dy = drone.y - y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= bestDist) {
      closest = drone;
      bestDist = distSq;
    }
  });
  
  // Check core ship
  if (this.coreShip && this.coreShip.health > 0) {
    const dx = this.coreShip.x - x;
    const dy = this.coreShip.y - y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= bestDist) {
      closest = this.coreShip;
      bestDist = distSq;
    }
  }
  return closest;
}

export function findHit(targets, bullet) {
  return targets.find((target) => {
    if (bullet.hitTargets && bullet.hitTargets.has(target)) {
      return false;
    }
    const dx = target.x - bullet.x;
    const dy = target.y - bullet.y;
    const radius = target.radius || MARINE_RADIUS;
    return dx * dx + dy * dy <= radius * radius;
  }) || null;
}

export function isOnscreen(bullet) {
  // Use a larger margin in world space to prevent bullets from disappearing prematurely.
  // Account for camera movement by using the visible area in world coordinates.
  const viewLeft = this.camera.x - BULLET_CULLING_MARGIN;
  const viewRight = this.camera.x + this.bounds.width / this.camera.zoom + BULLET_CULLING_MARGIN;
  const viewTop = this.camera.y - BULLET_CULLING_MARGIN;
  const viewBottom = this.camera.y + this.bounds.height / this.camera.zoom + BULLET_CULLING_MARGIN;
  return (
    bullet.x > viewLeft &&
    bullet.x < viewRight &&
    bullet.y > viewTop &&
    bullet.y < viewBottom
  );
}
