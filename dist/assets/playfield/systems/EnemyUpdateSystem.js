// Enemy update system extracted from SimplePlayfield.
// These functions use 'this' (the SimplePlayfield instance) via prototype assignment.

import {
  initDirectionalSaturation,
  decayDirectionalSaturation,
} from './DirectionalSaturationSystem.js';

import {
  initQuantumProjection,
  updateQuantumProjection,
} from './QuantumProjectionSystem.js';

import {
  initWeierstrass,
  initAnchors,
  updateWeierstrass,
} from './WeierstrassBossSystem.js';

import {
  initHypernode,
  updateHypernode,
  updateTowerDisableStates,
} from './HypernodeBossSystem.js';

// Scale factor applied to a derivative-shield enemy's visual radius to determine coverage area.
const DERIVATIVE_SHIELD_RADIUS_SCALE = 4.2;
// Minimum pixel radius for the derivative shield coverage zone regardless of enemy size.
const DERIVATIVE_SHIELD_MIN_RADIUS = 96;
// Milliseconds the shield effect lingers on a target after the shielder moves out of range.
const DERIVATIVE_SHIELD_LINGER_MS = 160;

// ─── Partial Wraith speed-ramp constants ──────────────────────────────────────
// The wraith accelerates as its HP drops: v = vBase + (vMax - vBase) * sqrt(missing)
// where missing = 1 - HP/maxHP. At full HP it moves at normal speed; near death it
// reaches up to PARTIAL_WRAITH_SPEED_MULTIPLIER_MAX times its base speed.
const PARTIAL_WRAITH_SPEED_MULTIPLIER_MAX = 2.8;

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
    let effectiveSpeed = Math.max(0, baseSpeed * speedMultiplier * pathSpeedMultiplier * mapSpeedMultiplier * stunMultiplier);

    // Partial Wraith speed ramp: v = vBase + (vMax - vBase) * sqrt(missingFraction)
    // The wraith accelerates as its HP drops, encouraging players to finish it quickly.
    if ((enemy.codexId || enemy.typeId) === 'partial-wraith') {
      const maxHp = Number.isFinite(enemy.maxHp) && enemy.maxHp > 0 ? enemy.maxHp : 1;
      const currentHp = Number.isFinite(enemy.hp) ? Math.max(0, enemy.hp) : 0;
      const missingFraction = Math.max(0, Math.min(1, 1 - currentHp / maxHp));
      const speedRamp = 1 + (PARTIAL_WRAITH_SPEED_MULTIPLIER_MAX - 1) * Math.sqrt(missingFraction);
      effectiveSpeed *= speedRamp;
      // Store for debug/render access
      enemy._partialWraithSpeedRamp = speedRamp;
    }

    // Directional Saturation: initialise sector tracking and decay resistance each frame.
    if ((enemy.codexId || enemy.typeId) === 'gradient-sapper') {
      initDirectionalSaturation(enemy);
      decayDirectionalSaturation(enemy, delta);
    }

    // Quantum Tunneler: initialise and update multi-projection state.
    if ((enemy.codexId || enemy.typeId) === 'tunneler') {
      initQuantumProjection(enemy);
      updateQuantumProjection(enemy, delta);
    }

    // Weierstrass Prism: initialise fractal boss state and update oscillation/intrusions.
    if ((enemy.codexId || enemy.typeId) === 'weierstrass-prism') {
      initWeierstrass(enemy);
      if (enemy.isBoss && !enemy._weierstrass.anchorsInitialised) {
        initAnchors(enemy, enemy.maxHp || 1);
      }
      updateWeierstrass(enemy, delta);
    }

    // Hypernode: initialise network-anchor boss state and update connections/polygon.
    if ((enemy.codexId || enemy.typeId) === 'hypernode') {
      initHypernode(enemy);
      updateHypernode(
        enemy,
        delta,
        this.enemies,
        (e) => this.getEnemyPosition(e),
        (id) => this.getEnemyById(id),
      );
      updateTowerDisableStates(enemy, this.towers);
    }

    // Imaginary Strider: temporary placeholder invulnerability after each hit (3-second window).
    if ((enemy.codexId || enemy.typeId) === 'imaginary-strider') {
      if (enemy.isInvulnerable && Number.isFinite(enemy.invulnerabilityTimer)) {
        enemy.invulnerabilityTimer = Math.max(0, enemy.invulnerabilityTimer - delta);
        if (enemy.invulnerabilityTimer <= 0) {
          enemy.isInvulnerable = false;
          delete enemy.invulnerabilityTimer;
        }
      }
    }

    // Superposition: toggles between state 0 (high resistance, slow) and state 1 (low resistance, fast)
    // every 1.5 seconds.
    if ((enemy.codexId || enemy.typeId) === 'superposition') {
      if (!Number.isFinite(enemy.superpositionTimer)) {
        // Initialise state machine on first update
        enemy.currentState = 0;
        enemy.superpositionTimer = 0;
      }
      enemy.superpositionTimer += delta;
      if (enemy.superpositionTimer >= 1.5) {
        enemy.superpositionTimer -= 1.5;
        enemy.currentState = enemy.currentState === 0 ? 1 : 0;
        // State 0: high resistance, slow; State 1: low resistance, faster
        enemy._superpositionFlashTimer = 0.4; // Trigger flash transition visual
        // Debug logging — can be removed without affecting gameplay
        console.log(`[Superposition State Switched] enemy id=${enemy.id} → state=${enemy.currentState}`);
      }
      // Update flash transition timer
      if (Number.isFinite(enemy._superpositionFlashTimer) && enemy._superpositionFlashTimer > 0) {
        enemy._superpositionFlashTimer = Math.max(0, enemy._superpositionFlashTimer - delta);
      }
      // Apply speed modifier: state 0 = 60% speed, state 1 = 130% speed
      if (enemy.currentState === 0) {
        effectiveSpeed *= 0.6;
      } else {
        effectiveSpeed *= 1.3;
      }
    }

    // Quantum-Tunneler: tunnel zone lifecycle is managed separately via updateTunnelZones.
    // No per-enemy update logic is needed here.

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
export function updateDerivativeShieldStates(_delta) {
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

// ─── Quantum-Tunneler tunnel zone update ────────────────────────────────────
// Advances the lifetime of each active TunnelZone and applies forward-teleport
// to any enemy that enters the zone radius.  Each zone persists for exactly
// 4 seconds.  Enemies are teleported forward along the path by teleportDistance
// (5–10% of total path) while clamping progress to [0, 0.99] to prevent
// instant breach.  Zones are created in applyDamageToEnemy / processEnemyDefeat.

// Radius within which an enemy is affected by a TunnelZone (normalised coords).
const TUNNEL_ZONE_AFFECT_RADIUS = 0.06;

export function updateTunnelZones(delta) {
  if (!Array.isArray(this.tunnelZones) || this.tunnelZones.length === 0) {
    return;
  }

  const remainingZones = [];
  for (const zone of this.tunnelZones) {
    if (!zone) {
      continue;
    }
    zone.elapsed = (zone.elapsed || 0) + delta;
    // Expire zones after 4 seconds
    if (zone.elapsed >= 4.0) {
      continue;
    }
    remainingZones.push(zone);

    // Affect any enemy that enters the zone radius
    if (Array.isArray(this.enemies)) {
      for (const enemy of this.enemies) {
        if (!enemy) {
          continue;
        }
        const pos = this.getEnemyPosition(enemy);
        if (!pos) {
          continue;
        }
        const dx = pos.x - zone.position.x;
        const dy = pos.y - zone.position.y;
        const dist = Math.hypot(dx, dy);
        if (dist > TUNNEL_ZONE_AFFECT_RADIUS) {
          continue;
        }
        // Only teleport each enemy through a given zone once per visit
        if (!zone._teleportedIds) {
          zone._teleportedIds = new Set();
        }
        if (zone._teleportedIds.has(enemy.id)) {
          continue;
        }
        zone._teleportedIds.add(enemy.id);
        // Clamp teleport so enemies cannot breach instantly and cannot go below 0
        const newProgress = Math.max(0, Math.min(0.99, (enemy.progress || 0) + zone.teleportDistance));
        enemy.progress = newProgress;
      }
    }
  }
  this.tunnelZones = remainingZones;
}
