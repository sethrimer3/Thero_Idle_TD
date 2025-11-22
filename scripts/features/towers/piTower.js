/**
 * Pi (π) Tower - Laser Merge Rotational Attack
 * 
 * Mechanics:
 * - Lock-on laser lines track all enemies within range (drawn from tower center to enemy center)
 * - Lines freeze when tower attacks
 * - Tower shoots a radial laser at the forward-most enemy on path
 * - Laser rotates clockwise 360 degrees, merging with frozen lock-on lines
 * - Each merge increases laser length, damage, and color gradient progression
 * - After 360° rotation, laser rotates 120° more while shrinking back into tower
 * - Laser tip leaves a burning trail as it moves
 * 
 * Formulas:
 * - atk = gamma^mrg (gamma power raised to merge count)
 * - rng = 4 + 0.1 × Aleph1 (base range in meters)
 * - rngInc = 0.1 × Aleph2 (range increase per merge in meters)
 * - atkSpd = 0.1 + 0.01 × Aleph3 (attack sequence speed in seconds)
 * - lasSpd = 5 - 0.1 × Aleph4 (laser rotation speed in seconds)
 */

import { metersToPixels } from '../../../assets/gameUnits.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';
import {
  calculateTowerEquationResult,
  computeTowerVariableValue,
  getTowerEquationBlueprint,
} from '../../../assets/towersTab.js';

// Constants
const BASE_RANGE_METERS = 4;
const BASE_ATTACK_SPEED_SECONDS = 0.1;
const BASE_LASER_ROTATION_SPEED_SECONDS = 5;
const MERGE_RANGE_INCREMENT_METERS = 0.1;
const SHRINK_ROTATION_DEGREES = 120;
const LASER_TRAIL_MAX_POINTS = 30;
const LASER_TRAIL_FADE_TIME = 0.3; // seconds
const LASER_BASE_WIDTH = 3;
const LASER_WIDTH_INCREMENT = 1.5;
const LOCK_ON_LINE_WIDTH = 1.5;
const PI_TOWER_RADIUS_PIXELS = 15;
const DEFAULT_ENEMY_RADIUS_PIXELS = 12;

/**
 * Pi tower colors use the bottom of the gradient.
 */
const PI_BASE_COLOR_OFFSET = 0.05;

/**
 * Resolve color for Pi tower lasers from palette gradient.
 */
function resolvePiLaserColor(gradientProgress = 0) {
  // Start at bottom of gradient, move up as we merge
  const offset = PI_BASE_COLOR_OFFSET + gradientProgress * 0.7;
  const color = samplePaletteGradient(offset);
  if (color && typeof color === 'object' && Number.isFinite(color.r)) {
    return color;
  }
  // Fallback color (cyan-like)
  return { r: 100, g: 200, b: 255 };
}

/**
 * Calculate Pi tower parameters from equations.
 */
function calculatePiParameters(playfield, tower) {
  // Get gamma power for damage calculation
  const gammaPower = Math.max(1, calculateTowerEquationResult('gamma') || 1);

  // Get Aleph upgrade values
  const blueprint = getTowerEquationBlueprint('pi');
  const aleph1 = Math.max(0, computeTowerVariableValue('pi', 'aleph1', blueprint) || 0);
  const aleph2 = Math.max(0, computeTowerVariableValue('pi', 'aleph2', blueprint) || 0);
  const aleph3 = Math.max(0, computeTowerVariableValue('pi', 'aleph3', blueprint) || 0);
  const aleph4 = Math.max(0, computeTowerVariableValue('pi', 'aleph4', blueprint) || 0);
  
  // Calculate parameters
  // rng = 4 + 0.1 * Aleph1
  const rangeMeters = BASE_RANGE_METERS + 0.1 * aleph1;
  
  // rngInc = 0.1 * Aleph2 (range increment per merge)
  const rangeIncrementMeters = MERGE_RANGE_INCREMENT_METERS * aleph2;
  
  // atkSpd = 0.1 + 0.01 * Aleph3 (attack sequence time in seconds)
  const attackSpeed = BASE_ATTACK_SPEED_SECONDS + 0.01 * aleph3;
  
  // lasSpd = 5 - 0.1 * Aleph4 (laser rotation time in seconds)
  const laserRotationSpeed = Math.max(0.5, BASE_LASER_ROTATION_SPEED_SECONDS - 0.1 * aleph4);
  
  return {
    gammaPower,
    rangeMeters,
    rangeIncrementMeters,
    attackSpeed,
    laserRotationSpeed,
  };
}

/**
 * Calculate damage for current merge count.
 * Formula: gamma^mrg
 */
function calculatePiDamage(gammaPower, mergeCount) {
  const clampedMerges = Math.max(0, Math.min(50, mergeCount)); // Clamp to prevent overflow
  return Math.pow(gammaPower, clampedMerges);
}

/**
 * Convert playfield minimum dimension for pixel calculations.
 * Caches the last valid dimension to prevent sudden range changes.
 */
let cachedPlayfieldDimension = null;

function resolvePlayfieldMinDimension(playfield) {
  const candidates = [];
  if (Number.isFinite(playfield?.renderWidth) && playfield.renderWidth > 0) {
    candidates.push(playfield.renderWidth);
  }
  if (Number.isFinite(playfield?.renderHeight) && playfield.renderHeight > 0) {
    candidates.push(playfield.renderHeight);
  }
  
  if (candidates.length) {
    const minDimension = Math.min(...candidates);
    cachedPlayfieldDimension = minDimension;
    return minDimension;
  }
  
  // Use cached value if available
  if (cachedPlayfieldDimension !== null && cachedPlayfieldDimension > 0) {
    return cachedPlayfieldDimension;
  }
  
  // Fallback to reasonable default (800px is a common canvas size)
  console.warn('π tower: playfield dimensions not available, using fallback value of 800px');
  return 800;
}

/**
 * Ensure Pi tower state is initialized.
 */
export function ensurePiState(playfield, tower) {
  if (!tower || tower.type !== 'pi') {
    return null;
  }
  
  if (!tower.piState) {
    tower.piState = {
      // Lock-on tracking
      lockedEnemies: new Map(), // enemy.id -> { x, y, angle }
      lockOnLines: [], // Array of frozen lock-on lines
      
      // Attack sequence state
      attackActive: false,
      attackTimer: 0,
      attackDuration: 0,
      
      // Laser state
      laserActive: false,
      laserAngle: 0, // Current angle in radians
      laserLength: 0, // Current length in pixels
      laserMergeCount: 0,
      laserRotationProgress: 0, // 0-1 during main rotation, 1-1.33 during shrink
      laserShrinking: false,
      laserInitialLength: 0,
      laserRotationElapsed: 0,
      laserShrinkElapsed: 0,
      
      // Trail effect
      laserTrail: [], // Array of { x, y, age, alpha }
      
      // Cached parameters
      parameters: null,
      recalcTimer: 0,
    };
  }
  
  // Refresh parameters periodically
  const state = tower.piState;
  state.recalcTimer = (state.recalcTimer || 0) - (playfield.lastDelta || 0);
  if (state.recalcTimer <= 0 || !state.parameters) {
    state.parameters = calculatePiParameters(playfield, tower);
    state.recalcTimer = 0.5; // Recalc every 500ms
    
    // Update tower stats for display
    const minDim = resolvePlayfieldMinDimension(playfield);
    const rangePixels = metersToPixels(state.parameters.rangeMeters, minDim);
    tower.baseRange = rangePixels;
    tower.range = rangePixels;
    tower.baseRate = 1 / state.parameters.attackSpeed; // Convert to attacks per second
    tower.rate = tower.baseRate;
    
    // Update damage calculation based on current merge count
    const damage = calculatePiDamage(state.parameters.gammaPower, state.laserMergeCount || 0);
    tower.baseDamage = damage;
    tower.damage = damage;
  }
  
  return state;
}

/**
 * Teardown Pi tower state.
 */
export function teardownPiTower(playfield, tower) {
  if (!tower || tower.type !== 'pi') {
    return;
  }
  
  if (tower.piState) {
    tower.piState.lockedEnemies.clear();
    tower.piState.lockOnLines = [];
    tower.piState.laserTrail = [];
    tower.piState = null;
  }
}

/**
 * Find the forward-most enemy on the path within range.
 */
function findForwardMostEnemy(playfield, tower, enemies) {
  if (!enemies || !enemies.length) {
    return null;
  }
  
  // Forward-most means closest to the end of their path
  let forwardMost = null;
  let maxProgress = -1;
  
  enemies.forEach((enemy) => {
    if (!enemy) return;
    
    // Calculate progress (higher pathProgress means more forward)
    const progress = enemy.pathProgress || 0;
    if (progress > maxProgress) {
      maxProgress = progress;
      forwardMost = enemy;
    }
  });
  
  return forwardMost;
}

/**
 * Get enemies within range of tower.
 */
function getEnemiesInRange(playfield, tower) {
  if (!playfield.enemies || !playfield.enemies.length) {
    return [];
  }
  
  const state = tower.piState;
  if (!state || !state.parameters) {
    return [];
  }
  
  const minDim = resolvePlayfieldMinDimension(playfield);
  const rangePixels = metersToPixels(state.parameters.rangeMeters, minDim);
  const rangeSquared = rangePixels * rangePixels;
  
  return playfield.enemies.filter((enemy) => {
    if (!enemy) return false;
    const pos = playfield.getEnemyPosition(enemy);
    if (!pos) return false;
    
    const dx = pos.x - tower.x;
    const dy = pos.y - tower.y;
    const distSquared = dx * dx + dy * dy;
    
    return distSquared <= rangeSquared;
  });
}

/**
 * Update lock-on lines tracking enemies.
 */
function updateLockOnTracking(playfield, tower, state, delta) {
  // Don't update tracking during attack sequence
  if (state.attackActive) {
    return;
  }
  
  const enemiesInRange = getEnemiesInRange(playfield, tower);
  
  // Update locked enemies map
  state.lockedEnemies.clear();
  enemiesInRange.forEach((enemy) => {
    const pos = playfield.getEnemyPosition(enemy);
    if (pos) {
      const dx = pos.x - tower.x;
      const dy = pos.y - tower.y;
      const angle = Math.atan2(dy, dx);
      
      const metrics = enemy?.metrics || null;
      const enemyRadius =
        typeof playfield.getEnemyHitRadius === 'function'
          ? playfield.getEnemyHitRadius(enemy, metrics)
          : DEFAULT_ENEMY_RADIUS_PIXELS;
      const distance = Math.sqrt(dx * dx + dy * dy);

      state.lockedEnemies.set(enemy.id, {
        x: pos.x,
        y: pos.y,
        angle,
        enemyId: enemy.id,
        distance,
        enemyRadius,
      });
    }
  });
}

/**
 * Start attack sequence.
 */
function startAttackSequence(playfield, tower, state) {
  const enemiesInRange = getEnemiesInRange(playfield, tower);
  if (!enemiesInRange.length) {
    return false;
  }
  
  // Freeze current lock-on lines
  state.lockOnLines = Array.from(state.lockedEnemies.values()).map((lock) => ({
    x: lock.x,
    y: lock.y,
    angle: lock.angle,
    distance: lock.distance,
    enemyRadius: lock.enemyRadius,
  }));
  
  if (!state.lockOnLines.length) {
    return false;
  }
  
  // Find forward-most enemy and calculate initial laser angle
  const target = findForwardMostEnemy(playfield, tower, enemiesInRange);
  if (!target) {
    return false;
  }
  
  const targetPos = playfield.getEnemyPosition(target);
  if (!targetPos) {
    return false;
  }
  
  const dx = targetPos.x - tower.x;
  const dy = targetPos.y - tower.y;
  const initialAngle = Math.atan2(dy, dx);
  
  // Initialize attack sequence
  state.attackActive = true;
  state.attackTimer = 0;
  const totalRotationTime = state.parameters.laserRotationSpeed;
  const shrinkTime = totalRotationTime * (SHRINK_ROTATION_DEGREES / 360);
  state.attackDuration = totalRotationTime + shrinkTime;
  
  // Initialize laser
  state.laserActive = true;
  state.laserAngle = initialAngle;
  const minDim = resolvePlayfieldMinDimension(playfield);
  const baseRangePixels = metersToPixels(state.parameters.rangeMeters, minDim);
  const targetDistance = Math.sqrt(dx * dx + dy * dy);
  const targetRadius =
    typeof playfield.getEnemyHitRadius === 'function'
      ? playfield.getEnemyHitRadius(target, target.metrics)
      : DEFAULT_ENEMY_RADIUS_PIXELS;
  const desiredLength = Math.max(0, Math.min(baseRangePixels, targetDistance - targetRadius));
  const startingLength = Math.max(PI_TOWER_RADIUS_PIXELS, desiredLength);
  state.laserLength = startingLength;
  state.laserMergeCount = 0;
  state.laserRotationProgress = 0;
  state.laserShrinking = false;
  state.laserInitialLength = startingLength;
  state.laserRotationElapsed = 0;
  state.laserShrinkElapsed = 0;
  state.laserTrail = [];

  const baseDamage = calculatePiDamage(state.parameters.gammaPower, 0);
  tower.baseDamage = baseDamage;
  tower.damage = baseDamage;

  return true;
}

/**
 * Check if laser passes over a lock-on line and merge.
 */
function checkLaserMerges(playfield, tower, state, delta, prevAngle, currAngle) {
  if (!state.laserActive || state.laserShrinking) {
    return;
  }

  // Check each lock-on line
  state.lockOnLines = state.lockOnLines.filter((line) => {
    if (line.merged) {
      return false; // Remove already merged lines
    }

    const dx = line.x - tower.x;
    const dy = line.y - tower.y;
    const storedDistance = Number.isFinite(line.distance) ? line.distance : Math.sqrt(dx * dx + dy * dy);

    // Check if laser swept over this line's angle
    // Normalize angles to [0, 2π]
    const normalizedPrev = ((prevAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const normalizedCurr = ((currAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const lineAngle = ((line.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    // Check if line angle is between prev and curr
    let crossed = false;
    if (normalizedPrev < normalizedCurr) {
      crossed = lineAngle >= normalizedPrev && lineAngle <= normalizedCurr;
    } else {
      // Handle wrap-around at 2π
      crossed = lineAngle >= normalizedPrev || lineAngle <= normalizedCurr;
    }

    if (crossed) {
      // Merge!
      const minDim = resolvePlayfieldMinDimension(playfield);
      const increment = metersToPixels(state.parameters.rangeIncrementMeters, minDim);
      const lineReach = Math.max(0, storedDistance - (line.enemyRadius || 0));
      const mergeThreshold = Math.max(state.laserLength, lineReach);

      // Only merge if the laser tip currently reaches the frozen beam
      const distanceTolerance = 6;
      if (mergeThreshold - state.laserLength <= distanceTolerance) {
        state.laserMergeCount += 1;
        state.laserLength = Math.max(
          PI_TOWER_RADIUS_PIXELS,
          Math.max(state.laserLength, lineReach) + increment
        );
        state.laserInitialLength = state.laserLength;

        const updatedDamage = calculatePiDamage(state.parameters.gammaPower, state.laserMergeCount);
        tower.baseDamage = updatedDamage;
        tower.damage = updatedDamage;

        line.merged = true;
        return false; // Remove from active lines
      }
    }

    return true; // Keep line active
  });
}

/**
 * Update laser rotation and trail.
 */
function updateLaserRotation(playfield, tower, state, delta) {
  if (!state.laserActive) {
    return;
  }

  const totalRotationTime = state.parameters.laserRotationSpeed;
  const shrinkTime = totalRotationTime * (SHRINK_ROTATION_DEGREES / 360);

  if (!state.laserShrinking) {
    // Main rotation phase (360 degrees)
    const angularVelocity = (Math.PI * 2) / totalRotationTime;
    const prevAngle = state.laserAngle;
    state.laserAngle += angularVelocity * delta;
    state.laserRotationElapsed += delta;
    state.laserRotationProgress = Math.min(1, state.laserRotationElapsed / totalRotationTime);

    // Check for merges
    checkLaserMerges(playfield, tower, state, delta, prevAngle, state.laserAngle);

    // Add trail point
    const tipX = tower.x + Math.cos(state.laserAngle) * state.laserLength;
    const tipY = tower.y + Math.sin(state.laserAngle) * state.laserLength;
    
    state.laserTrail.push({
      x: tipX,
      y: tipY,
      age: 0,
      alpha: 1.0,
    });
    
    // Limit trail points
    if (state.laserTrail.length > LASER_TRAIL_MAX_POINTS) {
      state.laserTrail.shift();
    }
    
    // Check if main rotation complete
    if (state.laserRotationProgress >= 1.0) {
      state.laserShrinking = true;
      state.laserShrinkElapsed = 0;
      state.laserInitialLength = state.laserLength;
    }
  } else {
    // Shrink phase (120 degrees)
    const shrinkAngularVelocity = (Math.PI * 2 / 3) / shrinkTime; // 120 degrees
    state.laserAngle += shrinkAngularVelocity * delta;

    // Shrink laser length smoothly back into tower
    state.laserShrinkElapsed += delta;
    const shrinkProgress = shrinkTime > 0 ? Math.min(1, state.laserShrinkElapsed / shrinkTime) : 1;
    const clampedProgress = Number.isFinite(shrinkProgress) ? shrinkProgress : 1;
    state.laserLength = Math.max(0, state.laserInitialLength * (1 - clampedProgress));

    // No trail during shrink phase
  }
  
  // Update trail ages
  state.laserTrail = state.laserTrail.filter((point) => {
    point.age += delta;
    point.alpha = Math.max(0, 1 - point.age / LASER_TRAIL_FADE_TIME);
    return point.age < LASER_TRAIL_FADE_TIME;
  });
}

/**
 * Apply damage to enemies hit by the laser.
 */
function applyLaserDamage(playfield, tower, state) {
  if (!state.laserActive || state.laserShrinking) {
    return;
  }
  
  const damage = calculatePiDamage(state.parameters.gammaPower, state.laserMergeCount);
  
  // Find enemies along the laser path
  const enemiesInRange = getEnemiesInRange(playfield, tower);
  const laserAngle = state.laserAngle;
  const laserLength = state.laserLength;
  
  enemiesInRange.forEach((enemy) => {
    const pos = playfield.getEnemyPosition(enemy);
    if (!pos) return;
    
    const dx = pos.x - tower.x;
    const dy = pos.y - tower.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > laserLength) return;
    
    const angleToEnemy = Math.atan2(dy, dx);
    const angleDiff = Math.abs(((angleToEnemy - laserAngle + Math.PI) % (Math.PI * 2)) - Math.PI);
    
    // Check if enemy is along the laser beam (within a small angular tolerance)
    const tolerance = 0.1; // radians
    if (angleDiff < tolerance) {
      // Mark enemy as hit to prevent multiple hits per rotation
      if (!enemy.piHitThisRotation) {
        playfield.applyDamageToEnemy(enemy, damage, { sourceTower: tower });
        enemy.piHitThisRotation = true;
      }
    }
  });
}

/**
 * Update Pi tower logic.
 */
export function updatePiTower(playfield, tower, delta) {
  if (!playfield || !tower || tower.type !== 'pi') {
    return;
  }
  
  const state = ensurePiState(playfield, tower);
  if (!state || !state.parameters) {
    return;
  }
  
  // Update lock-on tracking (when not attacking)
  updateLockOnTracking(playfield, tower, state, delta);
  
  // Handle attack sequence
  if (state.attackActive) {
    state.attackTimer += delta;
    
    // Update laser rotation
    updateLaserRotation(playfield, tower, state, delta);
    
    // Apply damage during main rotation
    if (!state.laserShrinking) {
      applyLaserDamage(playfield, tower, state);
    }
    
    // Check if attack sequence complete
    if (state.attackTimer >= state.attackDuration) {
      state.attackActive = false;
      state.laserActive = false;
      state.lockOnLines = [];
      state.laserTrail = [];
      state.laserMergeCount = 0;

      // Clear hit markers
      if (playfield.enemies) {
        playfield.enemies.forEach((enemy) => {
          if (enemy) {
            delete enemy.piHitThisRotation;
          }
        });
      }

      const resetDamage = calculatePiDamage(state.parameters.gammaPower, 0);
      tower.baseDamage = resetDamage;
      tower.damage = resetDamage;

      // Reset cooldown to allow next attack
      tower.cooldown = 0;
    }
  } else {
    // Check if ready to attack
    if (!playfield.combatActive || tower.cooldown > 0) {
      return;
    }
    
    const enemiesInRange = getEnemiesInRange(playfield, tower);
    if (!enemiesInRange.length) {
      return;
    }
    
    // Start attack sequence
    if (startAttackSequence(playfield, tower, state)) {
      tower.cooldown = 1 / tower.rate; // Set cooldown after attack sequence completes
    }
  }
}

/**
 * Draw lock-on lines to enemies.
 */
export function drawPiLockOnLines(playfield, tower) {
  if (!playfield?.ctx || !tower?.piState) {
    return;
  }
  
  const ctx = playfield.ctx;
  const state = tower.piState;
  
  // Don't draw during active attack (lines are frozen)
  if (state.attackActive) {
    return;
  }
  
  if (!state.lockedEnemies.size) {
    return;
  }
  
  ctx.save();
  
  const color = resolvePiLaserColor(0);
  ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.4)`;
  ctx.lineWidth = LOCK_ON_LINE_WIDTH;
  
  // Draw lines to each locked enemy
  state.lockedEnemies.forEach((lock) => {
    const dx = lock.x - tower.x;
    const dy = lock.y - tower.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) return;

    // Calculate start and end points (not drawn over tower or enemy)
    const towerRadius = PI_TOWER_RADIUS_PIXELS; // Approximate tower visual radius
    const enemyRadius = lock.enemyRadius || DEFAULT_ENEMY_RADIUS_PIXELS; // Approximate enemy radius

    const startDistance = towerRadius;
    const endDistance = distance - enemyRadius;

    if (endDistance <= startDistance) return;

    const startX = tower.x + (dx / distance) * startDistance;
    const startY = tower.y + (dy / distance) * startDistance;
    const endX = tower.x + (dx / distance) * endDistance;
    const endY = tower.y + (dy / distance) * endDistance;
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  });
  
  ctx.restore();
}

/**
 * Draw frozen lock-on lines during attack.
 */
export function drawPiFrozenLines(playfield, tower) {
  if (!playfield?.ctx || !tower?.piState) {
    return;
  }
  
  const ctx = playfield.ctx;
  const state = tower.piState;
  
  if (!state.attackActive || !state.lockOnLines.length) {
    return;
  }
  
  ctx.save();
  
  const color = resolvePiLaserColor(0);
  ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.6)`;
  ctx.lineWidth = LOCK_ON_LINE_WIDTH;
  
  // Draw frozen lines
  state.lockOnLines.forEach((line) => {
    if (line.merged) return; // Don't draw merged lines

    const dx = line.x - tower.x;
    const dy = line.y - tower.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) return;

    const towerRadius = PI_TOWER_RADIUS_PIXELS;
    const enemyRadius = line.enemyRadius || DEFAULT_ENEMY_RADIUS_PIXELS;

    const startDistance = towerRadius;
    const endDistance = distance - enemyRadius;
    
    if (endDistance <= startDistance) return;
    
    const startX = tower.x + (dx / distance) * startDistance;
    const startY = tower.y + (dy / distance) * startDistance;
    const endX = tower.x + (dx / distance) * endDistance;
    const endY = tower.y + (dy / distance) * endDistance;
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  });
  
  ctx.restore();
}

/**
 * Draw rotating radial laser with trail.
 */
export function drawPiRadialLaser(playfield, tower) {
  if (!playfield?.ctx || !tower?.piState) {
    return;
  }
  
  const ctx = playfield.ctx;
  const state = tower.piState;
  
  if (!state.laserActive) {
    return;
  }
  
  ctx.save();
  
  // Calculate color based on merge count
  const gradientProgress = Math.min(1.0, state.laserMergeCount / 10);
  const color = resolvePiLaserColor(gradientProgress);
  
  // Draw laser trail (burning effect)
  if (!state.laserShrinking && state.laserTrail.length > 1) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    for (let i = 1; i < state.laserTrail.length; i++) {
      const prev = state.laserTrail[i - 1];
      const curr = state.laserTrail[i];
      
      const alpha = curr.alpha * 0.5;
      ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
      ctx.lineWidth = LASER_BASE_WIDTH * (1 + state.laserMergeCount * 0.15);
      
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.stroke();
    }
  }
  
  // Draw main laser beam
  const laserWidth = LASER_BASE_WIDTH + state.laserMergeCount * LASER_WIDTH_INCREMENT;

  // Calculate end point (not drawn over tower)
  const towerRadius = PI_TOWER_RADIUS_PIXELS;
  if (state.laserLength <= towerRadius) {
    ctx.restore();
    return;
  }
  const startX = tower.x + Math.cos(state.laserAngle) * towerRadius;
  const startY = tower.y + Math.sin(state.laserAngle) * towerRadius;
  const endX = tower.x + Math.cos(state.laserAngle) * state.laserLength;
  const endY = tower.y + Math.sin(state.laserAngle) * state.laserLength;
  
  // Draw laser with glow
  ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)`;
  ctx.shadowBlur = 10 + state.laserMergeCount * 2;
  
  ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.9)`;
  ctx.lineWidth = laserWidth;
  ctx.lineCap = 'round';
  
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  
  // Draw laser tip
  ctx.shadowBlur = 15;
  ctx.fillStyle = `rgba(${Math.min(255, color.r + 50)}, ${Math.min(255, color.g + 50)}, ${Math.min(255, color.b + 50)}, 1.0)`;
  ctx.beginPath();
  ctx.arc(endX, endY, laserWidth * 0.8, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

export { calculatePiDamage, calculatePiParameters };
