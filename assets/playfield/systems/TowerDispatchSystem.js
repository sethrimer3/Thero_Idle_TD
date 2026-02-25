// Tower dispatch system extracted from SimplePlayfield for modular tower targeting and firing logic.
// Handles tower update loop, target selection, damage resolution, and attack visual emission.

import { beginTowerPerformanceSegment } from '../../performanceMonitor.js';
import { calculateTowerEquationResult } from '../../towersTab.js';
import { getTowerTierValue } from '../../colorSchemeUtils.js';
import { playTowerFireSound } from '../../audioSystem.js';
import {
  applyNuPiercingDamage as applyNuPiercingDamageHelper,
} from '../../../scripts/features/towers/nuTower.js';
import {
  collectIotaChargeBonus as collectIotaChargeBonusHelper,
} from '../../../scripts/features/towers/iotaTower.js';
import {
  resolveSigmaShotDamage as resolveSigmaShotDamageHelper,
} from '../../../scripts/features/towers/sigmaTower.js';

/**
 * Main tower update loop — ticks cooldowns and dispatches per-type update handlers
 * before falling through to the generic target-and-fire path.
 */
export function updateTowers(delta) {
  this.towers.forEach((tower) => {
    // Attribute work to the active tower type before branching into its custom logic.
    const finishTowerSample = beginTowerPerformanceSegment(tower?.type || 'unknown');
    try {
      tower.cooldown = Math.max(0, tower.cooldown - delta);
      if (tower.linkTargetId) {
        this.updateConnectionSupplier(tower, delta);
        return;
      }
      if (tower.type === 'zeta') {
        this.updateZetaTower(tower, delta);
        return;
      }
      if (tower.type === 'eta') {
        this.updateEtaTower(tower, delta);
        return;
      }
      if (tower.type === 'delta') {
        this.updateDeltaTower(tower, delta);
        return;
      }
      if (tower.type === 'epsilon') {
        this.updateEpsilonTower(tower, delta);
        return;
      }
      if (tower.type === 'theta') {
        this.updateThetaTower(tower, delta);
        return;
      }
      if (tower.type === 'rho') {
        this.updateRhoTower(tower, delta);
        return;
      }
      if (tower.type === 'kappa') {
        this.updateKappaTower(tower, delta);
        return;
      }
      if (tower.type === 'lambda') {
        this.updateLambdaTower(tower, delta);
        return;
      }
      if (tower.type === 'mu') {
        this.updateMuTower(tower, delta);
        return;
      }
      if (tower.type === 'nu') {
        this.updateNuTower(tower, delta);
        // Intentional fall-through: nu also participates in generic target-and-fire logic.
      }
      if (tower.type === 'xi') {
        this.updateXiTower(tower, delta);
        // Intentional fall-through: xi also participates in generic target-and-fire logic.
      }
      if (tower.type === 'omicron') {
        this.updateOmicronTower(tower, delta);
        return;
      }
      if (tower.type === 'pi') {
        this.updatePiTower(tower, delta);
        return;
      }
      if (tower.type === 'tau') {
        this.updateTauTower(tower, delta);
        // Intentional fall-through: tau also participates in generic target-and-fire logic.
      }
      if (tower.type === 'upsilon') {
        this.updateUpsilonTower(tower, delta);
        return;
      }
      if (tower.type === 'sigma') {
        this.updateSigmaTower(tower, delta);
        return;
      }
      if (tower.type === 'chi') {
        this.updateChiTower(tower, delta);
        return;
      }
      if (tower.type === 'phi') {
        this.updatePhiTower(tower, delta);
        // Intentional fall-through: phi also participates in generic target-and-fire logic.
      }
      if (tower.type === 'psi') {
        this.updatePsiTower(tower, delta);
        return;
      }
      if (tower.type === 'omega') {
        this.updateOmegaTower(tower, delta);
        return;
      }
      if (!this.combatActive) {
        return;
      }
      if (tower.cooldown > 0) {
        return;
      }
      const targetInfo = this.findTarget(tower, { includeSigmaTargets: tower.type !== 'sigma' });
      if (!targetInfo) {
        return;
      }
      tower.cooldown = 1 / tower.rate;
      this.fireAtTarget(tower, targetInfo);
    } finally {
      finishTowerSample();
    }
  });
}

/**
 * Find the best target for a tower based on its priority setting,
 * with support for manual overrides, focused enemies, and σ-friendly targets.
 */
export function findTarget(tower, options = {}) {
  if (!tower) {
    return null;
  }
  const includeSigmaTargets = options.includeSigmaTargets !== false;
  const manual = this.getTowerManualTarget(tower);
  if (manual) {
    const position = this.getEnemyPosition(manual);
    const distance = position
      ? Math.hypot(position.x - tower.x, position.y - tower.y)
      : Infinity;
    if (!position || distance > tower.range) {
      this.clearTowerManualTarget(tower);
    } else {
      return { enemy: manual, position };
    }
  }

  if (tower.type === 'delta' && tower.behaviorMode === 'sentinel') {
    return null;
  }

  const focusedEnemy = this.getFocusedEnemy();
  if (focusedEnemy) {
    const position = this.getEnemyPosition(focusedEnemy);
    const distance = Math.hypot(position.x - tower.x, position.y - tower.y);
    if (distance <= tower.range) {
      return { enemy: focusedEnemy, position };
    }
  }

  const focusedCrystal = this.getFocusedCrystal();
  if (focusedCrystal) {
    const crystalPosition = this.getCrystalPosition(focusedCrystal);
    if (crystalPosition) {
      const crystalDistance = Math.hypot(crystalPosition.x - tower.x, crystalPosition.y - tower.y);
      if (crystalDistance <= tower.range) {
        return { crystal: focusedCrystal, position: crystalPosition };
      }
    }
  }
  let selected = null;
  const priority = tower.targetPriority || 'first';
  let bestProgress = -Infinity;
  let bestStrength = priority === 'weakest' ? Infinity : -Infinity;
  this.enemies.forEach((enemy) => {
    // Skip any cleared enemy slots so null placeholders don't break targeting.
    if (!enemy) {
      return;
    }
    const position = this.getEnemyPosition(enemy);
    if (!position) {
      return;
    }
    const distance = Math.hypot(position.x - tower.x, position.y - tower.y);
    if (distance > tower.range) {
      return;
    }
    if (priority === 'strongest') {
      const strength = Number.isFinite(enemy.hp) ? enemy.hp : enemy.maxHp || 0;
      if (strength > bestStrength || (strength === bestStrength && enemy.progress > bestProgress)) {
        selected = { enemy, position };
        bestStrength = strength;
        bestProgress = enemy.progress;
      }
      return;
    }
    if (priority === 'weakest') {
      const strength = Number.isFinite(enemy.hp) ? enemy.hp : enemy.maxHp || 0;
      if (strength < bestStrength || (strength === bestStrength && enemy.progress > bestProgress)) {
        selected = { enemy, position };
        bestStrength = strength;
        bestProgress = enemy.progress;
      }
      return;
    }
    if (enemy.progress > bestProgress) {
      selected = { enemy, position };
      bestProgress = enemy.progress;
    }
  });
  if (selected) {
    return selected;
  }
  if (includeSigmaTargets) {
    return this.findSigmaFriendlyTarget(tower);
  }
  return null;
}

/**
 * Calculate the effective shot damage for a tower, folding in any stored supply
 * shots from alpha/beta/gamma chains and iota charge bonuses.
 */
export function resolveTowerShotDamage(tower) {
  if (!tower) {
    return 0;
  }
  let damage = Number.isFinite(tower.damage) ? tower.damage : 0;
  if (tower.type === 'sigma') {
    return resolveSigmaShotDamageHelper(this, tower);
  }
  if (tower.type === 'beta') {
    const alphaShots = Math.max(0, tower.storedAlphaShots || 0);
    if (alphaShots > 0) {
      const alphaValue = calculateTowerEquationResult('alpha');
      damage += alphaValue * alphaShots;
      const swirlCount = Math.max(0, Math.floor(tower.storedAlphaSwirl || alphaShots * 3));
      this.queueTowerSwirlLaunch(tower, 'alpha', swirlCount);
      tower.storedAlphaShots = 0;
      tower.storedAlphaSwirl = 0;
    }
  } else if (tower.type === 'gamma') {
    const betaShots = Math.max(0, tower.storedBetaShots || 0);
    const alphaShots = Math.max(0, tower.storedAlphaShots || 0);
    if (betaShots > 0 || alphaShots > 0) {
      const betaValue = calculateTowerEquationResult('beta');
      const alphaValue = calculateTowerEquationResult('alpha');
      damage += betaValue * betaShots + alphaValue * alphaShots;
      const betaSwirlCount = Math.max(0, Math.floor(tower.storedBetaSwirl || betaShots * 3));
      const alphaSwirlCount = Math.max(0, Math.floor(tower.storedAlphaSwirl || alphaShots * 3));
      this.queueTowerSwirlLaunch(tower, 'beta', betaSwirlCount);
      this.queueTowerSwirlLaunch(tower, 'alpha', alphaSwirlCount);
      tower.storedBetaShots = 0;
      tower.storedAlphaShots = 0;
      tower.storedBetaSwirl = 0;
      tower.storedAlphaSwirl = 0;
    }
  } else if (tower.type === 'iota') {
    const betaShots = Math.max(0, tower.storedBetaShots || 0);
    const alphaShots = Math.max(0, tower.storedAlphaShots || 0);
    if (betaShots > 0 || alphaShots > 0) {
      const betaValue = calculateTowerEquationResult('beta');
      const alphaValue = calculateTowerEquationResult('alpha');
      damage += betaValue * betaShots + alphaValue * alphaShots;
      tower.storedBetaShots = 0;
      tower.storedAlphaShots = 0;
      tower.storedBetaSwirl = 0;
      tower.storedAlphaSwirl = 0;
    }
    const gammaBonus = collectIotaChargeBonusHelper(tower);
    if (gammaBonus > 0) {
      damage += gammaBonus;
    }
  }
  return damage;
}

/**
 * Emit the projectile / burst / visual effects appropriate for the tower type
 * and schedule delayed damage application via particle or projectile impact.
 */
export function emitTowerAttackVisuals(tower, targetInfo = {}) {
  if (!tower) {
    return;
  }
  const enemy = targetInfo.enemy || null;
  const crystal = targetInfo.crystal || null;
  const resolvedDamage = Number.isFinite(targetInfo.damage) ? Math.max(0, targetInfo.damage) : 0;
  const effectPosition =
    targetInfo.position ||
    (enemy ? this.getEnemyPosition(enemy) : crystal ? this.getCrystalPosition(crystal) : null);
  if (tower.type === 'alpha') {
    this.spawnAlphaAttackBurst(tower, { enemy, position: effectPosition }, enemy ? { enemyId: enemy.id } : {});
    // Create a projectile for damage application when particles reach target
    this.createParticleDamageProjectile(tower, enemy, effectPosition, resolvedDamage, 300);
  } else if (tower.type === 'beta') {
    // Keep visuals and hitbox traversal aligned while alternating the return side.
    const triangleOrientation = this.resolveNextBetaTriangleOrientation(tower);
    const betaOptions = enemy
      ? { enemyId: enemy.id, triangleOrientation }
      : { triangleOrientation };
    this.spawnBetaAttackBurst(tower, { enemy, position: effectPosition }, betaOptions);
    // Launch a sticky triangle projectile that slows, multi-hits, and returns to the tower.
    this.spawnBetaTriangleProjectile(tower, enemy, effectPosition, resolvedDamage, triangleOrientation);
  } else if (tower.type === 'gamma') {
    this.spawnGammaAttackBurst(tower, { enemy, position: effectPosition }, enemy ? { enemyId: enemy.id } : {});
    // Launch a piercing pentagram projectile that multi-hits on a return arc.
    this.spawnGammaStarProjectile(tower, enemy, effectPosition, resolvedDamage);
  } else if (tower.type === 'nu') {
    this.spawnNuAttackBurst(tower, { enemy, position: effectPosition }, enemy ? { enemyId: enemy.id } : {});
  } else {
    const sourcePosition = { x: tower.x, y: tower.y };
    const targetPosition = effectPosition || sourcePosition;
    const hasPendingHit = enemy && resolvedDamage > 0;
    // Track a simple projectile travel time so damage is applied on impact instead of immediately on firing.
    const baseTravelSpeed = 520;
    const travelDistance = hasPendingHit
      ? Math.hypot(targetPosition.x - sourcePosition.x, targetPosition.y - sourcePosition.y)
      : 0;
    const travelTime = hasPendingHit ? Math.max(0.08, travelDistance / baseTravelSpeed) : 0;
    const maxLifetime = hasPendingHit ? Math.max(0.24, travelTime) : 0.24;

    this.projectiles.push({
      source: sourcePosition,
      targetId: enemy ? enemy.id : null,
      targetCrystalId: crystal ? crystal.id : null,
      target: targetPosition,
      lifetime: 0,
      maxLifetime,
      travelTime,
      damage: hasPendingHit ? resolvedDamage : 0,
      towerId: tower.id,
      hitRadius: this.getStandardShotHitRadius(),
    });
  }
  if ((tower.type === 'beta' || tower.type === 'gamma' || tower.type === 'nu')) {
    this.triggerQueuedSwirlLaunches(tower, effectPosition, enemy);
  }
  if (getTowerTierValue(tower) >= 24) {
    this.spawnOmegaWave(tower);
  }
  if (this.audio) {
    playTowerFireSound(this.audio, tower.type);
  }
}

/**
 * Route a tower's attack to the appropriate fire handler based on tower type,
 * then apply damage to the resolved enemy, crystal, or σ target.
 */
export function fireAtTarget(tower, targetInfo) {
  if (tower.type === 'delta') {
    this.deployDeltaSoldier(tower, targetInfo);
    return;
  }
  if (tower.type === 'infinity') {
    // Infinity tower doesn't attack directly, it provides aura bonuses
    return;
  }
  if (tower.type === 'xi') {
    this.fireXiChain(tower, targetInfo);
    return;
  }
  if (tower.type === 'tau') {
    this.spawnTauProjectile(tower, targetInfo);
    return;
  }
  if (tower.type === 'iota') {
    this.fireIotaPulse(tower, targetInfo);
    return;
  }
  if (tower.type === 'phi') {
    this.triggerPhiBurst(tower);
    return;
  }
  if (!targetInfo) {
    return;
  }
  const enemy = targetInfo.enemy || null;
  const crystal = targetInfo.crystal || null;
  const sigmaTower = targetInfo.sigma || null;
  const attackPosition =
    targetInfo.position ||
    (enemy
      ? this.getEnemyPosition(enemy)
      : crystal
      ? this.getCrystalPosition(crystal)
      : sigmaTower
      ? { x: sigmaTower.x, y: sigmaTower.y }
      : null);
  const damage = this.resolveTowerShotDamage(tower);
  if (crystal) {
    this.emitTowerAttackVisuals(tower, { crystal, position: attackPosition });
    this.applyCrystalHit(crystal, damage, { position: attackPosition });
    return;
  }
  if (sigmaTower) {
    this.absorbSigmaDamage(sigmaTower, damage, { sourceTower: tower });
    this.emitTowerAttackVisuals(tower, { position: attackPosition });
    return;
  }
  if (!enemy) {
    return;
  }
  // Nu tower uses a piercing laser that damages all enemies along the beam path
  if (tower.type === 'nu') {
    const start = { x: tower.x, y: tower.y };
    // Calculate the direction from tower to target
    const dx = attackPosition.x - tower.x;
    const dy = attackPosition.y - tower.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0) {
      // Extend the beam to the tower's range (or beyond target if target is closer)
      const rangePixels = Number.isFinite(tower.range) ? tower.range : 200;
      const beamLength = Math.max(distance, rangePixels);
      const dirX = dx / distance;
      const dirY = dy / distance;
      const end = {
        x: tower.x + dirX * beamLength,
        y: tower.y + dirY * beamLength,
      };
      // Apply piercing damage to all enemies along the beam
      applyNuPiercingDamageHelper(this, tower, start, end, damage);
    } else {
      // Fallback: if target is at tower position, just damage the target
      this.applyDamageToEnemy(enemy, damage, { sourceTower: tower });
    }
    this.emitTowerAttackVisuals(tower, { enemy, position: attackPosition });
    return;
  }
  this.emitTowerAttackVisuals(tower, { enemy, position: attackPosition, damage });
}
