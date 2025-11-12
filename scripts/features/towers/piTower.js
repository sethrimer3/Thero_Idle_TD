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
  const aleph1 = Math.max(0, calculateTowerEquationResult('aleph-one') || 0);
  const aleph2 = Math.max(0, calculateTowerEquationResult('aleph-two') || 0);
  const aleph3 = Math.max(0, calculateTowerEquationResult('aleph-three') || 0);
  const aleph4 = Math.max(0, calculateTowerEquationResult('aleph-four') || 0);
  
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
 */
function resolvePlayfieldMinDimension(playfield) {
  const candidates = [];
  if (Number.isFinite(playfield?.renderWidth) && playfield.renderWidth > 0) {
    candidates.push(playfield.renderWidth);
  }
  if (Number.isFinite(playfield?.renderHeight) && playfield.renderHeight > 0) {
    candidates.push(playfield.renderHeight);
  }
  return candidates.length ? Math.min(...candidates) : 1;
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
      
      state.lockedEnemies.set(enemy.id, {
        x: pos.x,
        y: pos.y,
        angle: angle,
        enemyId: enemy.id,
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
  state.laserLength = metersToPixels(state.parameters.rangeMeters, resolvePlayfieldMinDimension(playfield));
  state.laserMergeCount = 0;
  state.laserRotationProgress = 0;
  state.laserShrinking = false;
  state.laserTrail = [];
  
  return true;
}

/**
 * Check if laser passes over a lock-on line and merge.
 */
function checkLaserMerges(playfield, tower, state, delta) {
  if (!state.laserActive || state.laserShrinking) {
    return;
  }
  
  const laserAngle = state.laserAngle;
  const angularVelocity = (Math.PI * 2) / state.parameters.laserRotationSpeed;
  const deltaAngle = angularVelocity * delta;
  
  // Check each lock-on line
  state.lockOnLines = state.lockOnLines.filter((line) => {
    if (line.merged) {
      return false; // Remove already merged lines
    }
    
    // Check if laser swept over this line's angle
    let prevAngle = laserAngle - deltaAngle;
    let currAngle = laserAngle;
    
    // Normalize angles to [0, 2π]
    prevAngle = ((prevAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    currAngle = ((currAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let lineAngle = ((line.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    
    // Check if line angle is between prev and curr
    let crossed = false;
    if (prevAngle < currAngle) {
      crossed = lineAngle >= prevAngle && lineAngle <= currAngle;
    } else {
      // Handle wrap-around at 2π
      crossed = lineAngle >= prevAngle || lineAngle <= currAngle;
    }
    
    if (crossed) {
      // Merge!
      state.laserMergeCount += 1;
      
      // Increase laser length
      const minDim = resolvePlayfieldMinDimension(playfield);
      const increment = metersToPixels(state.parameters.rangeIncrementMeters, minDim);
      state.laserLength += increment;
      
      line.merged = true;
      return false; // Remove from active lines
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
    state.laserAngle += angularVelocity * delta;
    state.laserRotationProgress += delta / totalRotationTime;
    
    // Check for merges
    checkLaserMerges(playfield, tower, state, delta);
    
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
      state.laserRotationProgress = 1.0;
    }
  } else {
    // Shrink phase (120 degrees)
    const shrinkAngularVelocity = (Math.PI * 2 / 3) / shrinkTime; // 120 degrees
    state.laserAngle += shrinkAngularVelocity * delta;
    
    // Shrink laser length
    const initialLength = state.laserLength;
    const shrinkProgress = Math.min(1.0, (state.laserRotationProgress - 1.0) / (shrinkTime / totalRotationTime));
    state.laserLength = initialLength * (1 - shrinkProgress);
    
    state.laserRotationProgress += delta / totalRotationTime;
    
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
      
      // Clear hit markers
      if (playfield.enemies) {
        playfield.enemies.forEach((enemy) => {
          if (enemy) {
            delete enemy.piHitThisRotation;
          }
        });
      }
      
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
    const towerRadius = 15; // Approximate tower visual radius
    const enemyRadius = 12; // Approximate enemy radius
    
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
    
    const towerRadius = 15;
    const enemyRadius = 12;
    
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
  const towerRadius = 15;
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
