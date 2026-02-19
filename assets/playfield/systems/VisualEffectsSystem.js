// Visual effects system extracted from SimplePlayfield for modular damage numbers, particles, and effects.
// Manages damage number display, enemy death particles, PSI merge/AoE effects, and swirl impact tracking.

import { TWO_PI, PI, PI_OVER_6 } from '../constants.js';
import { formatCombatNumber } from '../utils/formatting.js';
import { areDamageNumbersEnabled, getDamageNumberMode, DAMAGE_NUMBER_MODES } from '../../preferences.js';
import { samplePaletteGradient } from '../../../scripts/features/towers/powderTower.js';

/**
 * Check if damage numbers should be displayed.
 * Returns false in preview mode or if disabled in preferences.
 */
function areDamageNumbersActive() {
  if (this.previewOnly) {
    return false;
  }
  return areDamageNumbersEnabled();
}

/**
 * Compute direction vector for damage number spawn with jitter.
 * @param {Object} enemyPosition - {x, y} position of enemy
 * @param {Object} sourceTower - Tower that dealt damage (optional)
 * @returns {Object} Normalized direction vector {x, y}
 */
function resolveDamageNumberDirection(enemyPosition, sourceTower) {
  const fallbackAngle = Math.random() * TWO_PI;
  if (sourceTower && Number.isFinite(sourceTower.x) && Number.isFinite(sourceTower.y)) {
    const dx = enemyPosition.x - sourceTower.x;
    const dy = enemyPosition.y - sourceTower.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0.001) {
      const jitter = (Math.random() - 0.5) * PI_OVER_6;
      const cos = Math.cos(jitter);
      const sin = Math.sin(jitter);
      const nx = dx / distance;
      const ny = dy / distance;
      const jitteredX = nx * cos - ny * sin;
      const jitteredY = nx * sin + ny * cos;
      const magnitude = Math.hypot(jitteredX, jitteredY) || 1;
      return { x: jitteredX / magnitude, y: jitteredY / magnitude };
    }
  }
  return { x: Math.cos(fallbackAngle), y: Math.sin(fallbackAngle) };
}

/**
 * Spawn a damage number at enemy position.
 * Supports damage display mode (dealt damage or remaining HP).
 * @param {Object} enemy - Enemy that took damage
 * @param {number} damage - Damage amount dealt
 * @param {Object} options - { sourceTower, enemyHpBefore }
 */
function spawnDamageNumber(enemy, damage, { sourceTower, enemyHpBefore } = {}) {
  if (!this.areDamageNumbersActive() || !enemy || !Number.isFinite(damage) || damage < 0) {
    return;
  }
  const enemyPosition = this.getEnemyPosition(enemy);
  if (!enemyPosition) {
    return;
  }
  
  // Determine what value to display based on the mode
  const mode = getDamageNumberMode();
  let displayValue = damage;
  if (mode === DAMAGE_NUMBER_MODES.REMAINING) {
    // In "Remaining Life" mode, show the remaining HP after damage
    displayValue = Math.max(0, Number.isFinite(enemy.hp) ? enemy.hp : 0);
    
    // Clear previous damage numbers for this enemy to avoid confusion
    // This is specific to "Remaining Life" mode
    if (enemy.id) {
      this.damageNumbers = this.damageNumbers.filter(entry => entry.enemyId !== enemy.id);
    }
  }
  
  const label = formatCombatNumber(displayValue);
  if (!label) {
    return;
  }
  const metrics = this.getEnemyVisualMetrics(enemy);
  const direction = this.resolveDamageNumberDirection(enemyPosition, sourceTower);
  const offsetDistance = (metrics?.ringRadius || 12) + 6;
  const spawnPosition = {
    x: enemyPosition.x + direction.x * offsetDistance,
    y: enemyPosition.y + direction.y * offsetDistance,
  };
  const gradientSample = samplePaletteGradient(Math.random());
  const magnitude = Math.max(0, Math.log10(Math.max(1, displayValue)));
  const baseFontSize = Math.min(28, 16 + magnitude * 2.6);
  // Scale the display based on how much of the enemy's total health the hit removed.
  const maxHp = Number.isFinite(enemy.maxHp)
    ? Math.max(1, enemy.maxHp)
    : Math.max(1, Number.isFinite(enemyHpBefore) ? enemyHpBefore : 1);
  
  // In Remaining Life mode, use consistent visual styling without impact scaling
  let fontSize, outlineAlpha;
  if (mode === DAMAGE_NUMBER_MODES.REMAINING) {
    // For remaining life, use base font size scaled by the magnitude of remaining HP
    fontSize = baseFontSize * 0.5;
    // Use a neutral outline alpha for remaining life display
    outlineAlpha = 0.4;
  } else {
    // For damage numbers, scale by impact
    const relativeDamage = Math.min(1, damage / maxHp);
    const impactScale = 1 + relativeDamage;
    fontSize = baseFontSize * impactScale * 0.5;
    outlineAlpha = relativeDamage;
  }
  
  const initialSpeed = 110 + Math.random() * 45;
  const entry = {
    id: (this.damageNumberIdCounter += 1),
    position: spawnPosition,
    velocity: {
      x: direction.x * initialSpeed,
      y: direction.y * (initialSpeed * 0.85),
    },
    text: label,
    color: gradientSample,
    fontSize,
    elapsed: 0,
    lifetime: 1.15,
    alpha: 1,
    // Store how intense the outline highlight should be for this impact.
    outlineAlpha,
    // Store enemy ID for "Remaining Life" mode to allow clearing previous numbers
    enemyId: mode === DAMAGE_NUMBER_MODES.REMAINING && enemy.id ? enemy.id : null,
  };
  
  // Special handling for divisors: show equation "1/[damage] = [actual damage]"
  if (enemy && enemy.typeId === 'divisor' && mode !== DAMAGE_NUMBER_MODES.REMAINING) {
    // Format the reciprocal part (1/damage) using the same notation
    const reciprocalLabel = formatCombatNumber(damage);
    entry.isDivisorEquation = true;
    entry.reciprocalText = `1/${reciprocalLabel}`;
    entry.equalsText = ' = ';
    entry.resultText = label;
  }
  
  this.damageNumbers.push(entry);
  const maxEntries = 90;
  if (this.damageNumbers.length > maxEntries) {
    this.damageNumbers.splice(0, this.damageNumbers.length - maxEntries);
  }
}

/**
 * Spawn "Miss" text at enemy position for failed attacks.
 * @param {Object} enemy - Enemy that dodged the attack
 */
function spawnMissText(enemy) {
  if (!this.areDamageNumbersActive() || !enemy) {
    return;
  }
  const enemyPosition = this.getEnemyPosition(enemy);
  if (!enemyPosition) {
    return;
  }
  const metrics = this.getEnemyVisualMetrics(enemy);
  const offsetDistance = (metrics?.ringRadius || 12) + 6;
  const spawnPosition = {
    x: enemyPosition.x,
    y: enemyPosition.y - offsetDistance,
  };
  const entry = {
    id: (this.damageNumberIdCounter += 1),
    position: spawnPosition,
    velocity: {
      x: 0,
      y: -80,
    },
    text: 'Miss',
    color: { r: 180, g: 180, b: 180 },
    fontSize: 18,
    elapsed: 0,
    lifetime: 1.0,
    alpha: 1,
    outlineAlpha: 0.3,
  };
  this.damageNumbers.push(entry);
  const maxEntries = 90;
  if (this.damageNumbers.length > maxEntries) {
    this.damageNumbers.splice(0, this.damageNumbers.length - maxEntries);
  }
}

/**
 * Update damage number positions, velocities, and fade out.
 * @param {number} delta - Time delta in seconds
 */
function updateDamageNumbers(delta) {
  if (!Number.isFinite(delta) || delta <= 0) {
    return;
  }
  if (!Array.isArray(this.damageNumbers) || !this.damageNumbers.length) {
    return;
  }
  if (!this.areDamageNumbersActive()) {
    this.resetDamageNumbers();
    return;
  }
  const damping = 7.5;
  for (let index = this.damageNumbers.length - 1; index >= 0; index -= 1) {
    const entry = this.damageNumbers[index];
    if (!entry) {
      this.damageNumbers.splice(index, 1);
      continue;
    }
    entry.elapsed += delta;
    if (entry.elapsed >= entry.lifetime) {
      this.damageNumbers.splice(index, 1);
      continue;
    }
    const drag = Math.max(0, 1 - damping * delta);
    entry.velocity.x *= drag;
    entry.velocity.y *= drag;
    if (Math.abs(entry.velocity.x) < 1) {
      entry.velocity.x = 0;
    }
    if (Math.abs(entry.velocity.y) < 1) {
      entry.velocity.y = 0;
    }
    entry.position.x += entry.velocity.x * delta;
    entry.position.y += entry.velocity.y * delta;
    const fadeStart = entry.lifetime * 0.55;
    if (entry.elapsed <= fadeStart) {
      entry.alpha = 1;
    } else {
      const fadeDuration = Math.max(entry.lifetime - fadeStart, 0.001);
      const fadeProgress = (entry.elapsed - fadeStart) / fadeDuration;
      entry.alpha = Math.max(0, 1 - fadeProgress);
    }
    if (entry.alpha <= 0.01) {
      this.damageNumbers.splice(index, 1);
    }
  }
}

/**
 * Reset damage numbers array to empty state.
 */
function resetDamageNumbers() {
  if (Array.isArray(this.damageNumbers)) {
    this.damageNumbers.length = 0;
  } else {
    this.damageNumbers = [];
  }
  this.damageNumberIdCounter = 0;
}

/**
 * Clear damage numbers (alias for resetDamageNumbers).
 */
function clearDamageNumbers() {
  this.resetDamageNumbers();
}

/**
 * Queue a swirl knockback entry so the renderer can fan particles away from the hit.
 * @param {Object} enemy - Enemy that was hit
 * @param {Object} options - { sourcePosition, damageApplied, enemyHpBefore }
 */
function recordEnemySwirlImpact(enemy, { sourcePosition, damageApplied, enemyHpBefore } = {}) {
  if (!enemy) {
    return;
  }
  const enemyPosition = this.getEnemyPosition(enemy);
  if (!enemyPosition) {
    return;
  }
  const queue = Array.isArray(this.enemySwirlImpacts) ? this.enemySwirlImpacts : (this.enemySwirlImpacts = []);
  const now = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
  let direction = null;
  if (sourcePosition && Number.isFinite(sourcePosition.x) && Number.isFinite(sourcePosition.y)) {
    direction = {
      x: enemyPosition.x - sourcePosition.x,
      y: enemyPosition.y - sourcePosition.y,
    };
  }
  if (!direction) {
    const fallbackAngle = Math.random() * TWO_PI;
    direction = { x: Math.cos(fallbackAngle), y: Math.sin(fallbackAngle) };
  }
  const magnitude = Math.hypot(direction.x, direction.y) || 1;
  const normalized = { x: direction.x / magnitude, y: direction.y / magnitude };
  // Double the baseline knockback and scale it up to another 2x as hits approach a full health bar chunk.
  // Clamp the damage ratio locally so hit reactions never rely on a global helper.
  const relativeDamageFraction = Number.isFinite(damageApplied) && Number.isFinite(enemyHpBefore) && enemyHpBefore > 0
    ? Math.max(0, Math.min(1, damageApplied / enemyHpBefore))
    : 1;
  const baseStrength = Math.max(0.45, Math.min(1.35, relativeDamageFraction));
  const doubledKnockback = baseStrength * 2;
  const finishingBlowBonus = 1 + relativeDamageFraction;
  const strength = doubledKnockback * finishingBlowBonus;
  // Preserve the raw damage fraction so the renderer can knock back only a matching share of swirl particles.
  queue.push({ enemy, direction: normalized, strength, timestamp: now, damageFraction: relativeDamageFraction });
  const maxQueueEntries = 120;
  if (queue.length > maxQueueEntries) {
    queue.splice(0, queue.length - maxQueueEntries);
  }
}

/**
 * Scatter sine-wobbling fragments when an enemy collapses so the defeat moment feels energetic.
 * @param {Object} enemy - Enemy that died
 */
function spawnEnemyDeathParticles(enemy) {
  if (!enemy) {
    return;
  }
  const position = this.getEnemyPosition(enemy);
  if (!position) {
    return;
  }
  const metrics = this.getEnemyVisualMetrics(enemy);
  const particles = Array.isArray(this.enemyDeathParticles)
    ? this.enemyDeathParticles
    : (this.enemyDeathParticles = []);
  const ringRadius = Number.isFinite(metrics?.ringRadius) ? metrics.ringRadius : 12;
  const count = this.isLowGraphicsMode() ? 10 : 16;
  const baseSpeed = Math.max(60, ringRadius * 5);
  const maxEntries = 180;
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * TWO_PI;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    const perpendicular = { x: -direction.y, y: direction.x };
    const wobbleAmplitude = ringRadius * (0.25 + Math.random() * 0.45);
    const wobbleFrequency = 6 + Math.random() * 5;
    const speed = baseSpeed * (0.55 + Math.random() * 0.9);
    const lifetime = 0.6 + Math.random() * 0.55;
    const size = Math.max(1.2, ringRadius * 0.08 + Math.random() * 0.6);
    particles.push({
      position: { ...position },
      direction,
      perpendicular,
      speed,
      wobbleAmplitude,
      wobbleFrequency,
      phase: Math.random() * TWO_PI,
      elapsed: 0,
      lifetime,
      alpha: 1,
      size,
      color: samplePaletteGradient(Math.random()),
    });
  }
  if (particles.length > maxEntries) {
    particles.splice(0, particles.length - maxEntries);
  }
}

/**
 * Advance collapse fragments so they drift, wobble, fade out, and clean up automatically.
 * @param {number} delta - Time delta in seconds
 */
function updateEnemyDeathParticles(delta) {
  if (!Number.isFinite(delta) || delta <= 0) {
    return;
  }
  const particles = Array.isArray(this.enemyDeathParticles)
    ? this.enemyDeathParticles
    : (this.enemyDeathParticles = []);
  if (!particles.length) {
    return;
  }
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    if (!particle || !particle.position || !particle.direction) {
      particles.splice(index, 1);
      continue;
    }
    particle.elapsed = (particle.elapsed || 0) + delta;
    const lifetime = Number.isFinite(particle.lifetime) ? particle.lifetime : 0.75;
    if (particle.elapsed >= lifetime) {
      particles.splice(index, 1);
      continue;
    }
    const speed = Number.isFinite(particle.speed) ? particle.speed : 80;
    particle.position.x += (particle.direction.x || 0) * speed * delta;
    particle.position.y += (particle.direction.y || 0) * speed * delta;
    const fadeStart = lifetime * 0.35;
    if (particle.elapsed <= fadeStart) {
      particle.alpha = 1;
    } else {
      const fadeDuration = Math.max(lifetime - fadeStart, 0.001);
      const fadeProgress = (particle.elapsed - fadeStart) / fadeDuration;
      particle.alpha = Math.max(0, 1 - fadeProgress);
    }
  }
}

/**
 * Clear lingering collapse motes so each level starts without leftover defeat debris.
 */
function resetEnemyDeathParticles() {
  if (Array.isArray(this.enemyDeathParticles)) {
    this.enemyDeathParticles.length = 0;
  } else {
    this.enemyDeathParticles = [];
  }
}

/**
 * Spawn visual effects for Psi merge event.
 * Creates particle lines from source positions to the cluster spawn position.
 * @param {Array} sourcePositions - Array of {x, y} positions where merged enemies were
 * @param {Object} clusterPosition - {x, y} position where PsiCluster spawned
 */
function spawnPsiMergeEffect(sourcePositions, clusterPosition) {
  if (!Array.isArray(sourcePositions) || !clusterPosition) {
    return;
  }
  const particles = Array.isArray(this.enemyDeathParticles)
    ? this.enemyDeathParticles
    : (this.enemyDeathParticles = []);
  
  // Create converging particle beams from each source to the cluster
  sourcePositions.forEach((source) => {
    if (!source) {
      return;
    }
    const dx = clusterPosition.x - source.x;
    const dy = clusterPosition.y - source.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) {
      return;
    }
    const direction = { x: dx / distance, y: dy / distance };
    const perpendicular = { x: -direction.y, y: direction.x };
    
    // Spawn 3-5 particles per source to create a beam effect
    const particleCount = this.isLowGraphicsMode() ? 2 : 4;
    for (let i = 0; i < particleCount; i += 1) {
      particles.push({
        position: { ...source },
        direction,
        perpendicular,
        speed: distance * 3.5, // Fast enough to reach center quickly
        wobbleAmplitude: 2,
        wobbleFrequency: 8,
        phase: Math.random() * TWO_PI,
        elapsed: 0,
        lifetime: 0.35, // Short-lived for quick implosion effect
        alpha: 1,
        size: 1.8,
        color: samplePaletteGradient(0.75), // Psi-themed color
      });
    }
  });
  
  // Add central implosion particles at cluster position
  const implosionCount = this.isLowGraphicsMode() ? 8 : 16;
  for (let i = 0; i < implosionCount; i += 1) {
    const angle = (i / implosionCount) * TWO_PI;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    particles.push({
      position: { ...clusterPosition },
      direction,
      perpendicular: { x: -direction.y, y: direction.x },
      speed: 40, // Slower, swirling outward briefly
      wobbleAmplitude: 8,
      wobbleFrequency: 12,
      phase: angle,
      elapsed: 0,
      lifetime: 0.5,
      alpha: 1,
      size: 2.2,
      color: samplePaletteGradient(0.8),
    });
  }
}

/**
 * Spawn visual effects for Psi AoE explosion when a cluster dies.
 * Creates an expanding radial pulse effect.
 * @param {Object} position - {x, y} position of the explosion center
 * @param {number} radius - Radius of the AoE in pixels
 */
function spawnPsiAoeEffect(position, radius) {
  if (!position || !Number.isFinite(radius) || radius <= 0) {
    return;
  }
  const particles = Array.isArray(this.enemyDeathParticles)
    ? this.enemyDeathParticles
    : (this.enemyDeathParticles = []);
  
  // Create expanding ring particles
  const ringCount = this.isLowGraphicsMode() ? 16 : 32;
  const baseSpeed = radius * 1.8; // Speed proportional to radius for consistent visual
  
  for (let i = 0; i < ringCount; i += 1) {
    const angle = (i / ringCount) * TWO_PI;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    const perpendicular = { x: -direction.y, y: direction.x };
    
    particles.push({
      position: { ...position },
      direction,
      perpendicular,
      speed: baseSpeed * (0.8 + Math.random() * 0.4),
      wobbleAmplitude: 4,
      wobbleFrequency: 6,
      phase: Math.random() * TWO_PI,
      elapsed: 0,
      lifetime: 0.7,
      alpha: 1,
      size: 2.5,
      color: samplePaletteGradient(0.85),
    });
  }
  
  // Add secondary wave for emphasis
  const secondaryCount = this.isLowGraphicsMode() ? 8 : 16;
  const halfAngleStep = PI / secondaryCount;
  for (let i = 0; i < secondaryCount; i += 1) {
    const angle = (i / secondaryCount) * TWO_PI + halfAngleStep;
    const direction = { x: Math.cos(angle), y: Math.sin(angle) };
    
    particles.push({
      position: { ...position },
      direction,
      perpendicular: { x: -direction.y, y: direction.x },
      speed: baseSpeed * 0.6,
      wobbleAmplitude: 6,
      wobbleFrequency: 8,
      phase: angle,
      elapsed: 0.1, // Slight delay for wave effect
      lifetime: 0.85,
      alpha: 1,
      size: 2,
      color: samplePaletteGradient(0.75),
    });
  }
}

// Export all functions for Object.assign delegation pattern
export {
  areDamageNumbersActive,
  resolveDamageNumberDirection,
  spawnDamageNumber,
  spawnMissText,
  updateDamageNumbers,
  resetDamageNumbers,
  clearDamageNumbers,
  recordEnemySwirlImpact,
  spawnEnemyDeathParticles,
  updateEnemyDeathParticles,
  resetEnemyDeathParticles,
  spawnPsiMergeEffect,
  spawnPsiAoeEffect,
};
