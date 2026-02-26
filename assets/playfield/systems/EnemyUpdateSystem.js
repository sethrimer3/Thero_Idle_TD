// Enemy update system extracted from SimplePlayfield.
// These functions use 'this' (the SimplePlayfield instance) via prototype assignment.

// Scale factor applied to a derivative-shield enemy's visual radius to determine coverage area.
const DERIVATIVE_SHIELD_RADIUS_SCALE = 4.2;
// Minimum pixel radius for the derivative shield coverage zone regardless of enemy size.
const DERIVATIVE_SHIELD_MIN_RADIUS = 96;
// Milliseconds the shield effect lingers on a target after the shielder moves out of range.
const DERIVATIVE_SHIELD_LINGER_MS = 160;

// Compute the combined slow multiplier for an enemy from all active slow effects.
export function resolveEnemySlowMultiplier(enemy) {
  if (!enemy) {
    return 1;
  }
  const nowSeconds =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now() / 1000
      : Date.now() / 1000;
  const slowEffects = enemy.slowEffects;
  if (slowEffects instanceof Map) {
    let multiplier = 1;
    const stale = [];
    slowEffects.forEach((effect, key) => {
      if (!effect || !Number.isFinite(effect.multiplier)) {
        stale.push(key);
        return;
      }
      const expired = Number.isFinite(effect.expiresAt) && effect.expiresAt <= nowSeconds;
      if (expired) {
        stale.push(key);
        return;
      }
      const clamped = Math.max(0, Math.min(1, effect.multiplier));
      multiplier = Math.min(multiplier, clamped);
    });
    stale.forEach((key) => slowEffects.delete(key));
    if (slowEffects.size === 0) {
      delete enemy.slowEffects;
    }
    return multiplier;
  }
  if (!slowEffects || typeof slowEffects !== 'object') {
    return 1;
  }
  let multiplier = 1;
  Object.keys(slowEffects).forEach((key) => {
    const effect = slowEffects[key];
    if (!effect || !Number.isFinite(effect.multiplier)) {
      delete slowEffects[key];
      return;
    }
    const expired = Number.isFinite(effect.expiresAt) && effect.expiresAt <= nowSeconds;
    if (expired) {
      delete slowEffects[key];
      return;
    }
    const clamped = Math.max(0, Math.min(1, effect.multiplier));
    multiplier = Math.min(multiplier, clamped);
  });
  if (!Object.keys(slowEffects).length) {
    delete enemy.slowEffects;
  }
  return multiplier;
}

// Remove all slow effects from the enemy and notify tower timers.
export function clearEnemySlowEffects(enemy) {
  if (!enemy) {
    return;
  }
  const slowEffects = enemy.slowEffects;
  if (slowEffects instanceof Map) {
    slowEffects.forEach((_, towerId) => {
      const tower = this.getTowerById(towerId);
      if (tower?.thetaState?.enemyTimers instanceof Map) {
        tower.thetaState.enemyTimers.delete(enemy.id);
      }
    });
    slowEffects.clear();
  } else if (slowEffects && typeof slowEffects === 'object') {
    Object.keys(slowEffects).forEach((towerId) => {
      const tower = this.getTowerById(towerId);
      if (tower?.thetaState?.enemyTimers instanceof Map) {
        tower.thetaState.enemyTimers.delete(enemy.id);
      }
    });
  }
  delete enemy.slowEffects;
  this.syncEnemyDebuffIndicators(enemy, this.resolveActiveDebuffTypes(enemy));
}

// Remove all damage amplifiers from the enemy.
export function clearEnemyDamageAmplifiers(enemy) {
  if (!enemy) {
    return;
  }
  if (enemy.damageAmplifiers instanceof Map) {
    enemy.damageAmplifiers.clear();
  } else if (enemy.damageAmplifiers && typeof enemy.damageAmplifiers === 'object') {
    Object.keys(enemy.damageAmplifiers).forEach((key) => {
      delete enemy.damageAmplifiers[key];
    });
  }
  delete enemy.damageAmplifiers;
  delete enemy.iotaInversionTimer;
  this.syncEnemyDebuffIndicators(enemy, this.resolveActiveDebuffTypes(enemy));
}

// Apply stun effect to an enemy from stored shots
export function applyStunEffect(enemy, duration, sourceId = 'stored_shots') {
  if (!enemy || !Number.isFinite(duration) || duration <= 0) {
    return;
  }
  const nowSeconds = (typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()) / 1000;
  const expiresAt = nowSeconds + duration;
  if (!(enemy.stunEffects instanceof Map)) {
    enemy.stunEffects = new Map();
  }
  const existing = enemy.stunEffects.get(sourceId);
  // Extend the stun duration if we're already stunned
  if (existing && Number.isFinite(existing.expiresAt)) {
    enemy.stunEffects.set(sourceId, {
      expiresAt: Math.max(existing.expiresAt, expiresAt),
    });
  } else {
    enemy.stunEffects.set(sourceId, { expiresAt });
  }
}

// Check if enemy is stunned and return the stun status
export function isEnemyStunned(enemy) {
  if (!enemy || !(enemy.stunEffects instanceof Map)) {
    return false;
  }
  const nowSeconds = (typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()) / 1000;
  const stale = [];
  let isStunned = false;
  enemy.stunEffects.forEach((effect, key) => {
    if (!effect || !Number.isFinite(effect.expiresAt)) {
      stale.push(key);
      return;
    }
    if (effect.expiresAt <= nowSeconds) {
      stale.push(key);
      return;
    }
    isStunned = true;
  });
  stale.forEach((key) => enemy.stunEffects.delete(key));
  if (enemy.stunEffects.size === 0) {
    delete enemy.stunEffects;
  }
  return isStunned;
}

// Clear all stun effects from an enemy
export function clearEnemyStunEffects(enemy) {
  if (!enemy) {
    return;
  }
  if (enemy.stunEffects instanceof Map) {
    enemy.stunEffects.clear();
  }
  delete enemy.stunEffects;
}

// Main enemy update loop: debuff timers, speed, progress, breach detection.
export function updateEnemies(delta) {
  this.updateDerivativeShieldStates(delta);
  for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = this.enemies[index];
    // Guard against stray null slots so a missing enemy can't halt the animation loop mid-wave.
    if (!enemy) {
      this.enemies.splice(index, 1);
      continue;
    }
    if (!Number.isFinite(enemy.baseSpeed)) {
      enemy.baseSpeed = Number.isFinite(enemy.speed) ? enemy.speed : 0;
    }
    if (enemy.damageAmplifiers instanceof Map) {
      const expired = [];
      enemy.damageAmplifiers.forEach((effect, key) => {
        if (!effect) {
          expired.push(key);
          return;
        }
        if (Number.isFinite(effect.remaining)) {
          effect.remaining -= delta;
          if (effect.remaining <= 0) {
            expired.push(key);
          }
        }
      });
      expired.forEach((key) => enemy.damageAmplifiers.delete(key));
      if (enemy.damageAmplifiers.size === 0) {
        delete enemy.damageAmplifiers;
      }
    }
    if (Number.isFinite(enemy.iotaInversionTimer)) {
      enemy.iotaInversionTimer = Math.max(0, enemy.iotaInversionTimer - delta);
      if (enemy.iotaInversionTimer <= 0) {
        delete enemy.iotaInversionTimer;
      }
    }
    if (Number.isFinite(enemy.rhoSparkleTimer)) {
      enemy.rhoSparkleTimer = Math.max(0, enemy.rhoSparkleTimer - delta);
      if (enemy.rhoSparkleTimer <= 0) {
        delete enemy.rhoSparkleTimer;
      }
    }
    const activeDebuffs = this.resolveActiveDebuffTypes(enemy);
    this.syncEnemyDebuffIndicators(enemy, activeDebuffs);
    const baseSpeed = Number.isFinite(enemy.baseSpeed) ? enemy.baseSpeed : 0;
    const speedMultiplier = this.resolveEnemySlowMultiplier(enemy);
    const pathSpeedMultiplier = this.getPathSpeedMultiplierAtProgress(enemy.progress);
    const mapSpeedMultiplier = Number.isFinite(this.levelConfig?.mapSpeedMultiplier) 
      ? this.levelConfig.mapSpeedMultiplier 
      : 1;
    // Apply stun - stunned enemies cannot move
    const stunMultiplier = this.isEnemyStunned(enemy) ? 0 : 1;
    const effectiveSpeed = Math.max(0, baseSpeed * speedMultiplier * pathSpeedMultiplier * mapSpeedMultiplier * stunMultiplier);
    enemy.speed = effectiveSpeed;
    enemy.progress += enemy.speed * delta;
    if (enemy.progress >= 1) {
      this.clearEnemySlowEffects(enemy);
      this.combatStateManager?.deregisterEnemy?.(enemy.id);
      this.enemies.splice(index, 1);
      this.handleEnemyBreach(enemy);
    }
  }
}

// Maintain derivative shield coverage so the mitigation state follows the projector as it marches down the path.
export function updateDerivativeShieldStates(delta) {
  if (!Array.isArray(this.enemies) || !this.enemies.length) {
    return;
  }
  const shielders = this.enemies.filter((enemy) => enemy && enemy.typeId === 'derivative-shield');
  if (!shielders.length) {
    this.enemies.forEach((enemy) => {
      if (enemy && enemy.derivativeShield) {
        delete enemy.derivativeShield;
      }
    });
    return;
  }

  const activeTargets = new Set();
  const now =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();

  shielders.forEach((shielder) => {
    const sourcePosition = this.getEnemyPosition(shielder);
    if (!sourcePosition) {
      return;
    }
    const metrics = this.getEnemyVisualMetrics(shielder);
    const baseRadius = Math.max(12, metrics?.focusRadius || metrics?.ringRadius || 0);
    const radius = Math.max(DERIVATIVE_SHIELD_MIN_RADIUS, baseRadius * DERIVATIVE_SHIELD_RADIUS_SCALE);

    this.enemies.forEach((target) => {
      if (!target) {
        return;
      }
      const position = this.getEnemyPosition(target);
      if (!position) {
        return;
      }
      const distance = Math.hypot(position.x - sourcePosition.x, position.y - sourcePosition.y);
      if (distance > radius) {
        return;
      }
      const effect = target.derivativeShield || { stack: 0 };
      if (!Number.isFinite(effect.stack) || effect.stack < 0) {
        effect.stack = 0;
      }
      effect.mode = shielder?.isBoss ? 'sqrt' : 'halve';
      effect.lastSeen = now;
      effect.active = true;
      effect.sourceId = shielder?.id || null;
      target.derivativeShield = effect;
      if (Number.isFinite(target.id)) {
        activeTargets.add(target.id);
      }
    });
  });

  this.enemies.forEach((enemy) => {
    if (!enemy || !enemy.derivativeShield) {
      return;
    }
    const recentlyShielded =
      (Number.isFinite(enemy.id) && activeTargets.has(enemy.id)) ||
      (enemy.derivativeShield.lastSeen && now - enemy.derivativeShield.lastSeen <= DERIVATIVE_SHIELD_LINGER_MS);
    if (!recentlyShielded) {
      delete enemy.derivativeShield;
    }
  });
}
