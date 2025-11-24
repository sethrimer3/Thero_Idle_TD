/**
 * Pi (π) Tower - Rotational Beam Lock-On System
 * 
 * Mechanics:
 * - Locks onto enemies within range with individual beam lasers
 * - Each beam tracks its own rotation angle from initial lock-on point
 * - Damage increases based on how much each beam has rotated around the tower
 * - Visual intensity and color scale with rotation degrees
 * - Maximum number of simultaneous beams is limited by lamed1 upgrade
 * 
 * Formulas:
 * - atk = omicron^(|degrees|/(100-Bet₁)) per laser
 * - numLaser = 2 + Lamed₁ (max beams that can lock onto enemies)
 * - rng = 4m (fixed base range)
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
const BASE_NUM_LASERS = 2;
const LASER_BASE_WIDTH = 3;
const LASER_WIDTH_MAX = 12;
const LOCK_ON_LINE_WIDTH = 1.5;
const PI_TOWER_RADIUS_PIXELS = 15;
const DEFAULT_ENEMY_RADIUS_PIXELS = 12;
const DAMAGE_TICK_INTERVAL = 0.5; // Apply damage every 0.5 seconds

/**
 * Pi tower colors use the bottom of the gradient.
 */
const PI_BASE_COLOR_OFFSET = 0.05;

/**
 * Resolve color for Pi tower lasers from palette gradient.
 * Color intensity scales with rotation degrees (0-360+)
 * @param {number} rotationDegrees - Total rotation in degrees for this laser
 */
function resolvePiLaserColor(rotationDegrees = 0) {
  // Normalize rotation to 0-1 range (360 degrees = full gradient)
  const normalizedRotation = Math.min(1, Math.abs(rotationDegrees) / 720);
  const offset = PI_BASE_COLOR_OFFSET + normalizedRotation * 0.85;
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
  // Get omicron power for damage calculation
  const omicronPower = Math.max(1, calculateTowerEquationResult('omicron') || 1);

  // Get upgrade values
  const blueprint = getTowerEquationBlueprint('pi');
  
  // Bet₁ - reduces divisor in damage formula (100 - bet1)
  const bet1 = Math.min(99, Math.max(0, computeTowerVariableValue('pi', 'bet1', blueprint) || 0));
  
  // Lamed₁ - increases max number of lasers
  const lamed1 = Math.max(0, computeTowerVariableValue('pi', 'lamed1', blueprint) || 0);
  
  // Calculate parameters
  const rangeMeters = BASE_RANGE_METERS; // Fixed range of 4m
  const maxLasers = BASE_NUM_LASERS + lamed1;
  const divisor = Math.max(1, 100 - bet1); // Minimum divisor of 1 to prevent division issues
  
  return {
    omicronPower,
    rangeMeters,
    maxLasers,
    divisor,
    bet1,
    lamed1,
  };
}

/**
 * Calculate damage for a specific laser based on its rotation.
 * Formula: omicron^(|degrees|/(100-Bet₁))
 * @param {number} omicronPower - Base power from omicron tower
 * @param {number} rotationDegrees - Absolute rotation in degrees from initial lock angle
 * @param {number} divisor - The divisor (100 - bet1)
 */
function calculatePiDamage(omicronPower, rotationDegrees, divisor) {
  const absRotation = Math.abs(rotationDegrees);
  const exponent = Math.min(50, absRotation / divisor); // Clamp exponent to prevent overflow
  const damage = Math.pow(omicronPower, exponent);
  return Number.isFinite(damage) ? damage : 1;
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
      // Active beam tracking - Map of enemy.id -> beam state
      activeBeams: new Map(),
      
      // Damage tick timer
      damageTickTimer: 0,
      
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
    
    // Calculate average damage across all active beams for display
    let totalDamage = 0;
    let beamCount = 0;
    state.activeBeams.forEach((beam) => {
      const damage = calculatePiDamage(
        state.parameters.omicronPower,
        beam.totalRotationDegrees,
        state.parameters.divisor
      );
      totalDamage += damage;
      beamCount++;
    });
    tower.baseDamage = beamCount > 0 ? totalDamage / beamCount : 1;
    tower.damage = tower.baseDamage;
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
    tower.piState.activeBeams.clear();
    tower.piState = null;
  }
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
 * Calculate the angular difference between two angles in radians.
 * Returns the signed difference (positive = clockwise, negative = counter-clockwise).
 */
function calculateAngularDifference(currentAngle, previousAngle) {
  let diff = currentAngle - previousAngle;
  
  // Normalize to [-π, π]
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  
  return diff;
}

/**
 * Update beam tracking for enemies in range.
 * Creates new beams for new enemies, updates angles for existing enemies,
 * and removes beams for enemies that leave range.
 */
function updateBeamTracking(playfield, tower, state, delta) {
  const enemiesInRange = getEnemiesInRange(playfield, tower);
  const maxLasers = state.parameters.maxLasers;
  
  // Get set of current enemy IDs in range
  const inRangeIds = new Set(enemiesInRange.map(e => e.id));
  
  // Remove beams for enemies no longer in range
  const beamsToRemove = [];
  state.activeBeams.forEach((beam, enemyId) => {
    if (!inRangeIds.has(enemyId)) {
      beamsToRemove.push(enemyId);
    }
  });
  beamsToRemove.forEach(id => state.activeBeams.delete(id));
  
  // Sort enemies by path progress (forward-most first) for priority targeting
  const sortedEnemies = [...enemiesInRange].sort((a, b) => {
    const progressA = a.pathProgress || 0;
    const progressB = b.pathProgress || 0;
    return progressB - progressA;
  });
  
  // Update existing beams and create new ones up to max limit
  sortedEnemies.forEach((enemy) => {
    const pos = playfield.getEnemyPosition(enemy);
    if (!pos) return;
    
    const dx = pos.x - tower.x;
    const dy = pos.y - tower.y;
    const currentAngle = Math.atan2(dy, dx);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const metrics = enemy?.metrics || null;
    const enemyRadius =
      typeof playfield.getEnemyHitRadius === 'function'
        ? playfield.getEnemyHitRadius(enemy, metrics)
        : DEFAULT_ENEMY_RADIUS_PIXELS;
    
    if (state.activeBeams.has(enemy.id)) {
      // Update existing beam
      const beam = state.activeBeams.get(enemy.id);
      const previousAngle = beam.currentAngle;
      
      // Calculate angular difference and add to total rotation
      const angularDiff = calculateAngularDifference(currentAngle, previousAngle);
      const degreeDiff = (angularDiff * 180) / Math.PI;
      
      beam.currentAngle = currentAngle;
      beam.totalRotationDegrees += Math.abs(degreeDiff);
      beam.x = pos.x;
      beam.y = pos.y;
      beam.distance = distance;
      beam.enemyRadius = enemyRadius;
    } else if (state.activeBeams.size < maxLasers) {
      // Create new beam if under limit
      state.activeBeams.set(enemy.id, {
        enemyId: enemy.id,
        initialAngle: currentAngle,
        currentAngle: currentAngle,
        totalRotationDegrees: 0,
        x: pos.x,
        y: pos.y,
        distance: distance,
        enemyRadius: enemyRadius,
      });
    }
  });
}

/**
 * Apply damage to enemies based on their beam rotation.
 */
function applyBeamDamage(playfield, tower, state) {
  if (!playfield.combatActive) return;
  
  state.activeBeams.forEach((beam, enemyId) => {
    // Find the enemy
    const enemy = playfield.enemies?.find(e => e.id === enemyId);
    if (!enemy) return;
    
    // Calculate damage based on rotation
    const damage = calculatePiDamage(
      state.parameters.omicronPower,
      beam.totalRotationDegrees,
      state.parameters.divisor
    );
    
    // Apply damage
    playfield.applyDamageToEnemy(enemy, damage, { sourceTower: tower });
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
  
  // Update beam tracking
  updateBeamTracking(playfield, tower, state, delta);
  
  // Apply damage periodically
  state.damageTickTimer += delta;
  if (state.damageTickTimer >= DAMAGE_TICK_INTERVAL) {
    applyBeamDamage(playfield, tower, state);
    state.damageTickTimer = 0;
  }
}

/**
 * Draw active beam lines to enemies with color/intensity based on rotation.
 */
export function drawPiLockOnLines(playfield, tower) {
  if (!playfield?.ctx || !tower?.piState) {
    return;
  }
  
  const ctx = playfield.ctx;
  const state = tower.piState;
  
  if (!state.activeBeams.size) {
    return;
  }
  
  ctx.save();
  
  // Draw each active beam with color based on rotation
  state.activeBeams.forEach((beam) => {
    const dx = beam.x - tower.x;
    const dy = beam.y - tower.y;
    const distance = beam.distance;

    if (distance < 1) return;

    // Calculate start and end points (not drawn over tower or enemy)
    const towerRadius = PI_TOWER_RADIUS_PIXELS;
    const enemyRadius = beam.enemyRadius || DEFAULT_ENEMY_RADIUS_PIXELS;

    const startDistance = towerRadius;
    const endDistance = distance - enemyRadius;

    if (endDistance <= startDistance) return;

    const startX = tower.x + (dx / distance) * startDistance;
    const startY = tower.y + (dy / distance) * startDistance;
    const endX = tower.x + (dx / distance) * endDistance;
    const endY = tower.y + (dy / distance) * endDistance;
    
    // Color and width based on rotation degrees
    const color = resolvePiLaserColor(beam.totalRotationDegrees);
    const intensityFactor = Math.min(1, beam.totalRotationDegrees / 360);
    const alpha = 0.4 + intensityFactor * 0.5;
    const width = LOCK_ON_LINE_WIDTH + intensityFactor * (LASER_BASE_WIDTH - LOCK_ON_LINE_WIDTH);
    
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    
    // Add glow effect for high-rotation beams
    if (beam.totalRotationDegrees > 180) {
      ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${intensityFactor * 0.5})`;
      ctx.shadowBlur = 5 + intensityFactor * 10;
    } else {
      ctx.shadowBlur = 0;
    }
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  });
  
  ctx.restore();
}

/**
 * Draw frozen lock-on lines during attack (deprecated - kept for compatibility).
 */
export function drawPiFrozenLines(playfield, tower) {
  // No longer used in new beam system - beams are always active
  return;
}

/**
 * Draw rotating radial laser with trail (deprecated - kept for compatibility).
 */
export function drawPiRadialLaser(playfield, tower) {
  // No longer used in new beam system - individual beams replace rotating laser
  return;
}

export { calculatePiDamage, calculatePiParameters };
