// Projectile update system extracted from SimplePlayfield for modular projectile physics handling.
// Manages all projectile pattern types with collision detection, steering logic, and enemy interaction.

// Import helper function for epsilon tower hit stacking
import { applyEpsilonHit as applyEpsilonHitHelper } from '../../../scripts/features/towers/epsilonTower.js';

// Pre-calculated constants for performance
const PI = Math.PI;
const TWO_PI = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const EQUILATERAL_TRIANGLE_HEIGHT_RATIO = Math.sqrt(3) / 2;

// Beta stick projectile constants
const BETA_STICK_HIT_COUNT = 3;
const BETA_STICK_HIT_INTERVAL = 0.18;
const BETA_TRIANGLE_SPEED = 144;

// Gamma star projectile constants
const GAMMA_OUTBOUND_SPEED = 260;
const GAMMA_STAR_SPEED = 200;

/**
 * Update all projectiles with physics-based animation and collision detection.
 * Handles multiple projectile pattern types:
 * - supply: Tower-to-tower resource transfer with seed particles
 * - omegaWave: Spiral wave pattern with sine-based animation
 * - etaLaser: Simple fade-out laser beam
 * - iotaPulse: Fixed-duration pulse effect
 * - gammaStar: Beam projectile with star burst on hit
 * - betaTriangle: Seeking projectile that sticks to enemies and returns via triangular path
 * - epsilonNeedle: Homing needle that embeds in enemies and applies stacking damage
 * - Default: Simple interpolated projectiles with collision detection
 * 
 * @param {number} delta - Time delta in seconds for frame-independent animation
 */
function updateProjectiles(delta) {
  // Compute squared distance from a point to a line segment so we can catch fast projectiles that would otherwise tunnel past an enemy between frames.
  const distanceSquaredToSegment = (point, start, end) => {
    if (!point || !start || !end) {
      return Infinity;
    }
    const abx = end.x - start.x;
    const aby = end.y - start.y;
    const abLengthSquared = abx * abx + aby * aby;
    if (abLengthSquared <= 0) {
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      return dx * dx + dy * dy;
    }
    const apx = point.x - start.x;
    const apy = point.y - start.y;
    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLengthSquared));
    const closestX = start.x + abx * t;
    const closestY = start.y + aby * t;
    const dx = point.x - closestX;
    const dy = point.y - closestY;
    return dx * dx + dy * dy;
  };

  for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = this.projectiles[index];
    projectile.lifetime += delta;

    if (projectile.patternType === 'supply') {
      const distance = Number.isFinite(projectile.distance) ? Math.max(1, projectile.distance) : 1;
      const speed = Number.isFinite(projectile.speed) ? Math.max(10, projectile.speed) : 260;
      const increment = (speed * delta) / distance;
      projectile.progress = (projectile.progress || 0) + increment;
      if (projectile.source && projectile.target) {
        const clamped = Math.min(1, projectile.progress || 0);
        projectile.currentPosition = {
          x: projectile.source.x + (projectile.target.x - projectile.source.x) * clamped,
          y: projectile.source.y + (projectile.target.y - projectile.source.y) * clamped,
        };
        this.updateSupplySeeds(projectile);
      }
      if (projectile.progress >= 1) {
        this.handleSupplyImpact(projectile);
        this.projectiles.splice(index, 1);
      }
      continue;
    }

    if (projectile.patternType === 'omegaWave') {
      const maxLifetime = projectile.maxLifetime || 0;
      if (maxLifetime > 0 && projectile.lifetime >= maxLifetime) {
        this.projectiles.splice(index, 1);
        continue;
      }

      const duration = maxLifetime > 0 ? maxLifetime : 1;
      const progress = Math.max(0, Math.min(1, projectile.lifetime / duration));
      const parameters = projectile.parameters || {};
      const envelopePower = Number.isFinite(parameters.envelopePower)
        ? parameters.envelopePower
        : 1;
      const envelopeBase = Math.sin(PI * progress);
      const envelope = Math.pow(Math.max(0, envelopeBase), envelopePower);
      const loops = Number.isFinite(parameters.loops) ? parameters.loops : 1.5;
      const ratio = Number.isFinite(parameters.ratio) ? parameters.ratio : 1.6;
      const radius = Number.isFinite(parameters.radius) ? parameters.radius : 60;
      const swirlFrequency = Number.isFinite(parameters.swirlFrequency)
        ? parameters.swirlFrequency
        : 2.5;
      const returnCurve = Number.isFinite(parameters.returnCurve)
        ? parameters.returnCurve
        : 0.6;
      const swirlStrength = Number.isFinite(parameters.swirl) ? parameters.swirl : 0.8;
      const phaseShift = Number.isFinite(parameters.phaseShift)
        ? parameters.phaseShift
        : 0.3;
      const baseAngle = projectile.phase || 0;
      const angle = baseAngle + TWO_PI * loops * progress;
      const swirlPhase = progress * PI * swirlFrequency + baseAngle * phaseShift;
      const swirlOffset = Math.sin(swirlPhase) * radius * returnCurve * envelope * swirlStrength;
      const radial = radius * envelope;
      const offsetX = (radial + swirlOffset) * Math.cos(angle);
      const offsetY =
        (radial - swirlOffset) *
        Math.sin(angle * ratio + swirlStrength * Math.sin(angle));

      projectile.previousPosition = projectile.position || { ...projectile.origin };
      projectile.position = {
        x: (projectile.origin?.x || 0) + offsetX,
        y: (projectile.origin?.y || 0) + offsetY,
      };
      continue;
    }

    if (projectile.patternType === 'etaLaser') {
      const maxLifetime = Number.isFinite(projectile.maxLifetime) ? projectile.maxLifetime : 0.18;
      if (maxLifetime > 0 && projectile.lifetime >= maxLifetime) {
        this.projectiles.splice(index, 1);
        continue;
      }
      const progress = maxLifetime > 0 ? projectile.lifetime / maxLifetime : 1;
      projectile.alpha = Math.max(0, 1 - progress);
      continue;
    }

    if (projectile.patternType === 'iotaPulse') {
      const maxLifetime = Number.isFinite(projectile.maxLifetime) ? projectile.maxLifetime : 0.32;
      if (maxLifetime > 0 && projectile.lifetime >= maxLifetime) {
        this.projectiles.splice(index, 1);
      }
      continue;
    }

    if (projectile.patternType === 'gammaStar') {
      const tower = this.getTowerById(projectile.towerId);
      if (!tower) {
        this.projectiles.splice(index, 1);
        continue;
      }
      if (Number.isFinite(projectile.maxLifetime) && projectile.lifetime >= projectile.maxLifetime) {
        this.projectiles.splice(index, 1);
        continue;
      }
      const hitRadius = Math.max(
        2,
        Number.isFinite(projectile.hitRadius) ? projectile.hitRadius : this.getStandardShotHitRadius(),
      );
      const currentPosition = projectile.position || { x: tower.x, y: tower.y };
      
      if (projectile.phase === 'outbound') {
        const targetPosition = projectile.targetPosition || { x: tower.x, y: tower.y };
        const outboundSpeed = Number.isFinite(projectile.outboundSpeed)
          ? projectile.outboundSpeed
          : GAMMA_OUTBOUND_SPEED;
        
        const dx = targetPosition.x - currentPosition.x;
        const dy = targetPosition.y - currentPosition.y;
        const distance = Math.hypot(dx, dy);
        
        if (distance <= 1) {
          // Reached screen edge, projectile is done
          this.projectiles.splice(index, 1);
          continue;
        }
        
        const travel = outboundSpeed * delta;
        const reached = distance <= travel;
        const nextPosition = reached
          ? { ...targetPosition }
          : { x: currentPosition.x + (dx / distance) * travel, y: currentPosition.y + (dy / distance) * travel };
        
        // Check for enemy collisions along the beam path
        const hitEnemies = projectile.hitEnemies || new Set();
        
        this.enemies.forEach((enemy) => {
          if (!enemy) {
            return;
          }
          if (hitEnemies.has(enemy.id)) {
            return;
          }
          const enemyPosition = this.getEnemyPosition(enemy);
          if (!enemyPosition) {
            return;
          }
          const metrics = this.getEnemyVisualMetrics(enemy);
          const enemyRadius = this.getEnemyHitRadius(enemy, metrics);
          const combined = enemyRadius + hitRadius;
          const distanceSq = distanceSquaredToSegment(enemyPosition, currentPosition, nextPosition);
          if (distanceSq <= combined * combined) {
            // Apply damage to this enemy
            this.applyDamageToEnemy(enemy, projectile.damage, { sourceTower: tower });
            hitEnemies.add(enemy.id);
            
            // Create star burst effect on this enemy
            const burstDuration = Number.isFinite(projectile.starBurstDuration) ? projectile.starBurstDuration : 0;
            const starRadius = Math.max(12, projectile.starRadius || 22);
            const starSpeed = Number.isFinite(projectile.starSpeed) ? projectile.starSpeed : GAMMA_STAR_SPEED;
            
            this.gammaStarBursts.push({
              enemyId: enemy.id,
              towerId: tower.id,
              center: { ...enemyPosition },
              starEdgeIndex: 0,
              starEdgeProgress: 0,
              starElapsed: 0,
              starRadius,
              starSpeed,
              burstDuration,
              lifetime: 0,
              maxLifetime: burstDuration > 0 ? burstDuration + 2 : 2,
            });
          }
        });
        
        projectile.previousPosition = { ...currentPosition };
        projectile.position = nextPosition;
        projectile.hitEnemies = hitEnemies;
        
        if (reached) {
          // Reached screen edge, projectile is done
          this.projectiles.splice(index, 1);
        }
        continue;
      }
      
      // If not in outbound phase, remove projectile
      this.projectiles.splice(index, 1);
      continue;
    }

    if (projectile.patternType === 'betaTriangle') {
      const tower = this.getTowerById(projectile.towerId);
      if (!tower) {
        this.projectiles.splice(index, 1);
        continue;
      }
      if (Number.isFinite(projectile.maxLifetime) && projectile.lifetime >= projectile.maxLifetime) {
        this.projectiles.splice(index, 1);
        continue;
      }
      const hitRadius = Math.max(
        2,
        Number.isFinite(projectile.hitRadius) ? projectile.hitRadius : this.getStandardShotHitRadius(),
      );
      const towerPosition = { x: tower.x, y: tower.y };
      const currentPosition = projectile.position || towerPosition;
      const registryFallback = (set) => (set instanceof Set ? set : new Set());
      // Remember enemies already pinned so the sticky bolt cannot latch onto the same target twice.
      const stuckRegistry = registryFallback(projectile.stuckRegistry);
      const hasStuckEnemy = (enemy) => enemy && stuckRegistry.has(enemy.id);
      const registerStuckEnemy = (enemy) => {
        if (enemy && Number.isFinite(enemy.id)) {
          stuckRegistry.add(enemy.id);
          projectile.stuckRegistry = stuckRegistry;
        }
      };
      const resolveCollisionTarget = (start, end) => {
        for (let enemyIndex = 0; enemyIndex < this.enemies.length; enemyIndex += 1) {
          const enemy = this.enemies[enemyIndex];
          if (!enemy) {
            continue;
          }
          if (hasStuckEnemy(enemy)) {
            continue;
          }
          const position = this.getEnemyPosition(enemy);
          if (!position) {
            continue;
          }
          const metrics = this.getEnemyVisualMetrics(enemy);
          const enemyRadius = this.getEnemyHitRadius(enemy, metrics);
          const combined = enemyRadius + hitRadius;
          const distanceSq = distanceSquaredToSegment(position, start, end);
          if (distanceSq <= combined * combined) {
            return { enemy, position };
          }
        }
        return null;
      };
      const beginTriangleReturn = (anchorPosition) => {
        const anchor = anchorPosition || currentPosition;
        const dx = towerPosition.x - anchor.x;
        const dy = towerPosition.y - anchor.y;
        const midX = anchor.x + dx * 0.5;
        const midY = anchor.y + dy * 0.5;
        // Flip the perpendicular vertex each shot so the return path alternates sides.
        const triangleOrientation = Number.isFinite(projectile.triangleOrientation)
          ? Math.sign(projectile.triangleOrientation) || 1
          : 1;
        const baseAngle = Math.atan2(dy, dx) + triangleOrientation * HALF_PI;
        const distance = Math.hypot(dx, dy);
        const height = distance * EQUILATERAL_TRIANGLE_HEIGHT_RATIO;
        const thirdVertex = {
          x: midX + Math.cos(baseAngle) * height,
          y: midY + Math.sin(baseAngle) * height,
        };
        projectile.pathNodes = [thirdVertex, { ...towerPosition }];
        projectile.phase = 'triangle';
        projectile.pathProgress = 0;
      };
      const stickToEnemy = (enemy, impactPosition) => {
        projectile.phase = 'attached';
        projectile.attachedEnemyId = enemy?.id || null;
        projectile.attachPosition = impactPosition || this.getEnemyPosition(enemy) || { ...currentPosition };
        projectile.hitsApplied = 0;
        projectile.hitTimer = 0;
        projectile.previousPosition = { ...currentPosition };
        projectile.position = impactPosition || projectile.position || { ...currentPosition };
        if (enemy) {
          registerStuckEnemy(enemy);
          this.applyBetaStickSlow(enemy, tower, projectile.bet1);
        }
      };

      if (projectile.phase === 'seek') {
        const targetEnemy = this.getEnemyById(projectile.targetId);
        const targetPosition = targetEnemy
          ? this.getEnemyPosition(targetEnemy)
          : projectile.targetPosition || towerPosition;
        if (!targetPosition) {
          this.projectiles.splice(index, 1);
          continue;
        }
        const dx = targetPosition.x - currentPosition.x;
        const dy = targetPosition.y - currentPosition.y;
        const distance = Math.hypot(dx, dy) || 1;
        const travel = (Number.isFinite(projectile.speed) ? projectile.speed : BETA_TRIANGLE_SPEED) * delta;
        const reached = distance <= travel;
        const nextPosition = reached
          ? { ...targetPosition }
          : { x: currentPosition.x + (dx / distance) * travel, y: currentPosition.y + (dy / distance) * travel };
        const collision = resolveCollisionTarget(currentPosition, nextPosition);
        projectile.previousPosition = { ...currentPosition };
        projectile.position = nextPosition;
        if (collision && collision.enemy) {
          stickToEnemy(collision.enemy, collision.position || nextPosition);
        } else if (reached) {
          if (targetEnemy && !hasStuckEnemy(targetEnemy)) {
            stickToEnemy(targetEnemy, nextPosition);
          } else {
            beginTriangleReturn(nextPosition);
          }
        }
        continue;
      }

      if (projectile.phase === 'attached') {
        const enemy = this.getEnemyById(projectile.attachedEnemyId);
        const position = enemy ? this.getEnemyPosition(enemy) : projectile.attachPosition || currentPosition;
        const previousPosition = projectile.position || position || currentPosition;
        projectile.previousPosition = { ...previousPosition };
        projectile.position = position || previousPosition;
        projectile.hitTimer = (projectile.hitTimer || 0) + delta;
        if (enemy) {
          this.applyBetaStickSlow(enemy, tower, projectile.bet1);
        }
        while (projectile.hitsApplied < BETA_STICK_HIT_COUNT && projectile.hitTimer >= BETA_STICK_HIT_INTERVAL) {
          projectile.hitTimer -= BETA_STICK_HIT_INTERVAL;
          if (enemy) {
            this.applyDamageToEnemy(enemy, projectile.damage, { sourceTower: tower });
            this.applyBetaStickSlow(enemy, tower, projectile.bet1);
            const enemyStillAlive = !!this.getEnemyById(enemy.id);
            if (!enemyStillAlive) {
              break;
            }
          }
          projectile.hitsApplied += 1;
        }
        if (projectile.hitsApplied >= BETA_STICK_HIT_COUNT || !enemy) {
          beginTriangleReturn(position || previousPosition);
        }
        continue;
      }

      if (projectile.phase === 'triangle') {
        const pathNodes = Array.isArray(projectile.pathNodes) ? projectile.pathNodes : [];
        const nextNode = pathNodes.length ? pathNodes[0] : towerPosition;
        const dx = nextNode.x - currentPosition.x;
        const dy = nextNode.y - currentPosition.y;
        const distance = Math.hypot(dx, dy) || 1;
        const travel = (Number.isFinite(projectile.speed) ? projectile.speed : BETA_TRIANGLE_SPEED) * delta;
        const reached = distance <= travel;
        const nextPosition = reached
          ? { ...nextNode }
          : { x: currentPosition.x + (dx / distance) * travel, y: currentPosition.y + (dy / distance) * travel };
        // Keep collision checks active on the return legs so the slowing bolt can grab new targets on the way back.
        const collision = resolveCollisionTarget(currentPosition, nextPosition);
        projectile.previousPosition = { ...currentPosition };
        projectile.position = nextPosition;
        if (collision && collision.enemy) {
          stickToEnemy(collision.enemy, collision.position || nextPosition);
          continue;
        }
        if (reached) {
          projectile.pathNodes.shift();
          if (!projectile.pathNodes.length) {
            this.projectiles.splice(index, 1);
          }
        }
        continue;
      }

      this.projectiles.splice(index, 1);
      continue;
    }

    if (projectile.patternType === 'epsilonNeedle') {
      // Extend the lifetime window when a needle embeds itself in a target.
      const recordedLifetime = Number.isFinite(projectile.maxLifetime) ? projectile.maxLifetime : 3.5;
      let allowedLifetime = recordedLifetime;
      if (projectile.attachedToEnemyId) {
        const attachStart = Number.isFinite(projectile.attachStartTime)
          ? projectile.attachStartTime
          : (projectile.attachStartTime = projectile.lifetime);
        const stickDuration = Number.isFinite(projectile.stickDuration) ? projectile.stickDuration : 5;
        const extendedLifetime = attachStart + stickDuration;
        if (!Number.isFinite(projectile.maxLifetime) || projectile.maxLifetime < extendedLifetime) {
          projectile.maxLifetime = extendedLifetime;
        }
        allowedLifetime = projectile.maxLifetime;
      }
      if (allowedLifetime > 0 && projectile.lifetime >= allowedLifetime) {
        this.projectiles.splice(index, 1);
        continue;
      }

      const targetEnemyId = projectile.attachedToEnemyId || projectile.enemyId;
      const enemy = this.getEnemyById(targetEnemyId);
      if (!enemy) {
        this.projectiles.splice(index, 1);
        continue;
      }
      const position = this.getEnemyPosition(enemy);
      if (!position) {
        this.projectiles.splice(index, 1);
        continue;
      }

      if (projectile.attachedToEnemyId) {
        // Stick to the enemy and drift with its movement while fading out.
        const offset = projectile.attachOffset || { x: 0, y: 0 };
        const previous = projectile.position
          ? { ...projectile.position }
          : { x: position.x + offset.x, y: position.y + offset.y };
        projectile.previousPosition = previous;
        projectile.position = { x: position.x + offset.x, y: position.y + offset.y };
        projectile.velocity = { x: 0, y: 0 };
        const attachStart = Number.isFinite(projectile.attachStartTime)
          ? projectile.attachStartTime
          : (projectile.attachStartTime = projectile.lifetime);
        const stickDuration = Number.isFinite(projectile.stickDuration) ? projectile.stickDuration : 5;
        const elapsed = Math.max(0, projectile.lifetime - attachStart);
        const progress = stickDuration > 0 ? Math.min(1, elapsed / stickDuration) : 1;
        projectile.alpha = Math.max(0, 1 - progress);
        if (elapsed >= stickDuration) {
          this.projectiles.splice(index, 1);
        }
        continue;
      }

      const px = projectile.position?.x ?? projectile.origin?.x ?? 0;
      const py = projectile.position?.y ?? projectile.origin?.y ?? 0;
      const dx = position.x - px;
      const dy = position.y - py;
      const distance = Math.hypot(dx, dy) || 1;
      const nx = dx / distance;
      const ny = dy / distance;
      const speed = Math.max(60, Number.isFinite(projectile.speed) ? projectile.speed : 280);
      const vx = projectile.velocity?.x ?? nx * speed;
      const vy = projectile.velocity?.y ?? ny * speed;
      // steer towards target
      const desiredVx = nx * speed;
      const desiredVy = ny * speed;
      const dvx = desiredVx - vx;
      const dvy = desiredVy - vy;
      const dmag = Math.hypot(dvx, dvy);
      const maxTurn =
        Math.max(0, Number.isFinite(projectile.turnRate) ? projectile.turnRate : TWO_PI) * delta * speed /
        Math.max(1, speed);
      let nextVx = vx;
      let nextVy = vy;
      if (dmag > maxTurn && dmag > 0) {
        const blend = maxTurn / dmag;
        nextVx = vx + dvx * blend;
        nextVy = vy + dvy * blend;
      } else {
        nextVx = desiredVx;
        nextVy = desiredVy;
      }
      const stepX = nextVx * delta;
      const stepY = nextVy * delta;
      projectile.previousPosition = { x: px, y: py };
      projectile.position = { x: px + stepX, y: py + stepY };
      projectile.velocity = { x: nextVx, y: nextVy };

      // collision with enemy
      const metrics = this.getEnemyVisualMetrics(enemy);
      const enemyRadius = this.getEnemyHitRadius(enemy, metrics);
      const hitRadius = Math.max(2, Number.isFinite(projectile.hitRadius) ? projectile.hitRadius : 6);
      const combinedRadius = enemyRadius + hitRadius;
      const currentSeparation = Math.hypot(projectile.position.x - position.x, projectile.position.y - position.y);
      let didHit = currentSeparation <= combinedRadius;

      if (!didHit) {
        const previous = projectile.previousPosition || { x: px, y: py };
        const segmentDistanceSquared = distanceSquaredToSegment(position, previous, projectile.position);
        if (segmentDistanceSquared <= combinedRadius * combinedRadius) {
          didHit = true;
        }
      }

      if (didHit) {
        // find source tower for stacking
        const tower = this.getTowerById(projectile.towerId);
        let stacks = 0;
        if (tower) {
          stacks = applyEpsilonHitHelper(this, tower, enemy.id) || 0;
        }
        // Atk = (NumHits)^2, where stacks is NumHits after applying this hit
        const totalDamage = Math.max(0, stacks * stacks);
        this.applyDamageToEnemy(enemy, totalDamage, { sourceTower: tower || null });
        const enemyStillActive = !!this.getEnemyById(enemy.id);
        if (!enemyStillActive) {
          this.projectiles.splice(index, 1);
          continue;
        }
        // Convert the projectile into an embedded thorn instead of despawning immediately.
        projectile.attachedToEnemyId = enemy.id;
        projectile.attachOffset = {
          x: projectile.position.x - position.x,
          y: projectile.position.y - position.y,
        };
        projectile.attachStartTime = projectile.lifetime;
        const stickDuration = Number.isFinite(projectile.stickDuration) ? projectile.stickDuration : 5;
        projectile.maxLifetime = projectile.attachStartTime + stickDuration;
        projectile.alpha = 1;
        projectile.velocity = { x: 0, y: 0 };
        continue;
      }
      continue;
    }

    if (
      !projectile.patternType &&
      projectile.damage > 0 &&
      Number.isFinite(projectile.travelTime) &&
      projectile.travelTime > 0
    ) {
      const enemy = this.getEnemyById(projectile.targetId);
      if (!enemy) {
        this.projectiles.splice(index, 1);
        continue;
      }
      const position = this.getEnemyPosition(enemy);
      if (!position) {
        this.projectiles.splice(index, 1);
        continue;
      }
      if (projectile.target) {
        projectile.target = position;
      }

      // Check for collision using hitbox detection
      const metrics = this.getEnemyVisualMetrics(enemy);
      const enemyRadius = this.getEnemyHitRadius(enemy, metrics);
      const hitRadius = Math.max(2, Number.isFinite(projectile.hitRadius) ? projectile.hitRadius : this.getStandardShotHitRadius());
      const combinedRadius = enemyRadius + hitRadius;

      // Calculate current projectile position based on travel progress, tracking toward enemy's current position
      const progress = Math.min(1, projectile.lifetime / projectile.travelTime);
      const source = projectile.source || { x: 0, y: 0 };
      const currentX = source.x + (position.x - source.x) * progress;
      const currentY = source.y + (position.y - source.y) * progress;
      // Check distance from projectile's interpolated position to enemy's current position
      const separation = Math.hypot(currentX - position.x, currentY - position.y);

      // Apply damage on collision
      if (separation <= combinedRadius) {
        const tower = this.getTowerById(projectile.towerId);
        this.applyDamageToEnemy(enemy, projectile.damage, { sourceTower: tower });
        this.projectiles.splice(index, 1);
        continue;
      }
      // Continue to let the fallback maxLifetime check handle expiration
    }

    if (projectile.lifetime >= projectile.maxLifetime) {
      this.projectiles.splice(index, 1);
    }
  }
}

// Export the update function for integration into SimplePlayfield
export { updateProjectiles };
