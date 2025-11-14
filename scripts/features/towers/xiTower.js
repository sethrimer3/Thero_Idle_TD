/**
 * Xi (ξ) Tower - Chaining Ball Attack
 * 
 * Mechanics:
 * - Fires a small glowing ball with a trail that zips between enemies
 * - Ball sticks to enemy edge on contact and damages them once
 * - After a delay, chains to nearest enemy within chain range
 * - Chains until max chain count reached or no enemies in range
 * - If attached enemy dies, immediately chains to nearest enemy
 * - Can chain back and forth between same enemies if they're closest
 * - Ball changes color through gradient on each chain
 * - If no enemy in chain range, ball despawns with flash and deals damage again
 * 
 * Formulas:
 * - atk = nu × (numChain^numChnExp) - damage scales multiplicatively per chain
 * - spd = 1 + 0.5 × ℵ₁ - attack speed
 * - rng = 5 + 0.5 × ℵ₂ - initial targeting range in meters
 * - chnRng = 1 + 0.1 × ℵ₃ - chain range in meters
 * - maxChn = 3 + ℵ₄ - maximum chain count
 * - numChnExp = 1 + 0.1 × ℵ₅ - chain damage exponent
 */

import {
  calculateTowerEquationResult,
  getTowerEquationBlueprint,
  computeTowerVariableValue,
} from '../../../assets/towersTab.js';
import { metersToPixels } from '../../../assets/gameUnits.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

// Constants
const BASE_ATTACK_SPEED = 1.0; // base attacks per second
const BASE_RANGE_METERS = 5; // base initial targeting range
const BASE_CHAIN_RANGE_METERS = 1; // base chain range
const BASE_MAX_CHAINS = 3; // base maximum chains
const BASE_CHAIN_EXPONENT = 1.0; // base chain damage exponent
const CHAIN_DELAY = 0.15; // seconds between chains
const BALL_RADIUS = 8; // pixels
const TRAIL_LENGTH = 15; // trail points
const CHAIN_SPEED = 600; // pixels per second
const FLASH_DURATION = 0.2; // flash duration on despawn

// Xi tower particles use gradient cycling colors
const XI_PARTICLE_COLORS = [
  { r: 180, g: 200, b: 255 },
  { r: 255, g: 180, b: 200 },
];

/**
 * Resolve gradient color for xi ball based on chain count.
 */
function resolveXiColor(chainIndex = 0) {
  const offset = (chainIndex * 0.15) % 1.0;
  const color = samplePaletteGradient(offset);
  if (color) {
    return color;
  }
  // Fallback color cycling
  return XI_PARTICLE_COLORS[chainIndex % XI_PARTICLE_COLORS.length];
}

/**
 * Ensure xi tower state is initialized.
 */
function ensureXiStateInternal(playfield, tower) {
  if (!tower.xiState) {
    tower.xiState = {
      activeBalls: [], // Active chaining balls
      recalcTimer: 0,
    };
  }
  return tower.xiState;
}

/**
 * Refresh xi tower parameters from formulas.
 */
function refreshXiParameters(playfield, tower, state) {
  // Get nu power for base damage
  const nuPower = Math.max(0, calculateTowerEquationResult('nu') || 0);
  
  // Get Aleph values
  const aleph1 = Math.max(0, computeTowerVariableValue('xi', 'aleph1') || 0);
  const aleph2 = Math.max(0, computeTowerVariableValue('xi', 'aleph2') || 0);
  const aleph3 = Math.max(0, computeTowerVariableValue('xi', 'aleph3') || 0);
  const aleph4 = Math.max(0, computeTowerVariableValue('xi', 'aleph4') || 0);
  const aleph5 = Math.max(0, computeTowerVariableValue('xi', 'aleph5') || 0);
  
  // spd = 1 + 0.5 × ℵ₁
  const attackSpeed = BASE_ATTACK_SPEED + 0.5 * aleph1;
  
  // rng = 5 + 0.5 × ℵ₂ (in meters)
  const rangeMeters = BASE_RANGE_METERS + 0.5 * aleph2;
  
  // chnRng = 1 + 0.1 × ℵ₃ (in meters)
  const chainRangeMeters = BASE_CHAIN_RANGE_METERS + 0.1 * aleph3;
  
  // maxChn = 3 + ℵ₄
  const maxChains = BASE_MAX_CHAINS + aleph4;
  
  // numChnExp = 1 + 0.1 × ℵ₅
  const chainExponent = BASE_CHAIN_EXPONENT + 0.1 * aleph5;
  
  const minDimension = resolvePlayfieldMinDimension(playfield);
  const rangePixels = Math.max(24, metersToPixels(rangeMeters, minDimension));
  const chainRangePixels = Math.max(24, metersToPixels(chainRangeMeters, minDimension));
  
  // Store computed values in state
  state.nuPower = nuPower;
  state.attackSpeed = attackSpeed;
  state.rangePixels = rangePixels;
  state.chainRangePixels = chainRangePixels;
  state.maxChains = Math.max(1, Math.floor(maxChains));
  state.chainExponent = chainExponent;
  
  // Update tower stats for display
  tower.baseRate = attackSpeed;
  tower.rate = attackSpeed;
  tower.baseRange = rangePixels;
  tower.range = rangePixels;
  
  // Base damage shown is for 1 chain (nu × 1^exp = nu)
  tower.baseDamage = nuPower;
  tower.damage = nuPower;
}

/**
 * Resolve minimum playfield dimension for pixel calculations.
 */
function resolvePlayfieldMinDimension(playfield) {
  const dimensionCandidates = [];
  if (Number.isFinite(playfield?.renderWidth) && playfield.renderWidth > 0) {
    dimensionCandidates.push(playfield.renderWidth);
  }
  if (Number.isFinite(playfield?.renderHeight) && playfield.renderHeight > 0) {
    dimensionCandidates.push(playfield.renderHeight);
  }
  if (!dimensionCandidates.length) {
    return 1;
  }
  return Math.min(...dimensionCandidates);
}

/**
 * Calculate damage for a specific chain number.
 * atk = nu × (numChain^numChnExp)
 */
function calculateChainDamage(state, chainNumber) {
  if (!state || chainNumber < 1) {
    return 0;
  }
  const nuPower = state.nuPower || 0;
  const exponent = state.chainExponent || 1;
  return nuPower * Math.pow(chainNumber, exponent);
}

/**
 * Find the nearest enemy to a position within chain range.
 */
function findNearestEnemyInRange(playfield, position, range, excludeIds = new Set()) {
  let nearest = null;
  let nearestDistance = Infinity;
  
  playfield.enemies.forEach((enemy) => {
    if (!enemy || enemy.hp <= 0 || excludeIds.has(enemy.id)) {
      return;
    }
    
    const enemyPos = playfield.getEnemyPosition(enemy);
    if (!enemyPos) {
      return;
    }
    
    const distance = Math.hypot(enemyPos.x - position.x, enemyPos.y - position.y);
    if (distance <= range && distance < nearestDistance) {
      nearest = enemy;
      nearestDistance = distance;
    }
  });
  
  return nearest;
}

/**
 * Find point on enemy edge closest to ball position.
 */
function findEnemyEdgePoint(enemyPos, ballPos, enemyRadius = 16) {
  const dx = ballPos.x - enemyPos.x;
  const dy = ballPos.y - enemyPos.y;
  const distance = Math.hypot(dx, dy);

  if (distance === 0) {
    return { x: enemyPos.x + enemyRadius, y: enemyPos.y };
  }

  // Point on edge in direction of ball
  const edgeX = enemyPos.x + (dx / distance) * enemyRadius;
  const edgeY = enemyPos.y + (dy / distance) * enemyRadius;

  return { x: edgeX, y: edgeY };
}

/**
 * Resolve the perimeter contact point for an enemy using the current visual metrics.
 */
function resolveEnemyEdgeTarget(playfield, enemy, originPoint) {
  if (!playfield || !enemy || enemy.hp <= 0) {
    return null;
  }

  const enemyPos = playfield.getEnemyPosition(enemy);
  if (!enemyPos) {
    return null;
  }

  const metrics =
    typeof playfield.getEnemyVisualMetrics === 'function'
      ? playfield.getEnemyVisualMetrics(enemy)
      : null;
  const enemyRadius =
    typeof playfield.getEnemyHitRadius === 'function'
      ? playfield.getEnemyHitRadius(enemy, metrics)
      : 16;

  const edgePoint = findEnemyEdgePoint(enemyPos, originPoint, enemyRadius);

  return { enemyPos, enemyRadius, edgePoint };
}

/**
 * Create a new chaining ball.
 */
function createChainingBall(playfield, tower, firstEnemy, firstEnemyPos) {
  const originPoint = { x: tower.x, y: tower.y };
  const contactInfo = resolveEnemyEdgeTarget(playfield, firstEnemy, originPoint);
  const edgePoint = contactInfo?.edgePoint || findEnemyEdgePoint(firstEnemyPos, originPoint);

  return {
    id: `xi-ball-${Date.now()}-${Math.random()}`,
    x: tower.x,
    y: tower.y,
    targetX: edgePoint.x,
    targetY: edgePoint.y,
    targetEnemyId: firstEnemy.id,
    attachedEnemyId: null,
    lastAttachedEnemyId: null,
    chainCount: 0, // Number of chains completed
    maxChains: 0, // Will be set from state
    chainDelay: 0,
    state: 'traveling', // 'traveling', 'attached', 'despawning'
    lifetime: 0,
    trail: [],
    color: resolveXiColor(0),
    damagedEnemies: new Set(), // Track which enemies we've damaged
  };
}

/**
 * Update a single chaining ball.
 */
function updateChainingBall(playfield, tower, ball, state, delta) {
  ball.lifetime += delta;
  
  // Update trail
  ball.trail.push({ x: ball.x, y: ball.y, age: 0 });
  if (ball.trail.length > TRAIL_LENGTH) {
    ball.trail.shift();
  }
  ball.trail.forEach((point) => {
    point.age += delta;
  });

  // Keep the maximum chain count synchronized with active upgrades.
  ball.maxChains = Math.max(1, state.maxChains || ball.maxChains || 1);

  if (ball.state === 'traveling') {
    let targetEnemy = null;
    if (ball.targetEnemyId) {
      targetEnemy = playfield.enemies.find(
        (enemy) => enemy?.id === ball.targetEnemyId && enemy.hp > 0,
      );
    }

    if (!targetEnemy) {
      ball.targetEnemyId = null;
      const excludeIds = new Set();
      if (ball.lastAttachedEnemyId) {
        excludeIds.add(ball.lastAttachedEnemyId);
      }
      const searchRadius = ball.chainCount === 0 ? state.rangePixels : state.chainRangePixels;
      const fallbackEnemy = findNearestEnemyInRange(
        playfield,
        { x: ball.x, y: ball.y },
        searchRadius,
        excludeIds,
      );
      if (fallbackEnemy) {
        ball.targetEnemyId = fallbackEnemy.id;
        targetEnemy = fallbackEnemy;
      }
    }

    if (targetEnemy) {
      const contactInfo = resolveEnemyEdgeTarget(playfield, targetEnemy, { x: ball.x, y: ball.y });
      if (contactInfo) {
        ball.targetX = contactInfo.edgePoint.x;
        ball.targetY = contactInfo.edgePoint.y;
      }

      const dx = ball.targetX - ball.x;
      const dy = ball.targetY - ball.y;
      const distance = Math.hypot(dx, dy);
      const travelDistance = CHAIN_SPEED * delta;

      if (distance <= Math.max(1, travelDistance)) {
        // Snap to enemy and attach
        ball.state = 'attached';
        ball.x = ball.targetX;
        ball.y = ball.targetY;
        ball.chainDelay = CHAIN_DELAY;
        ball.chainCount += 1;
        ball.attachedEnemyId = targetEnemy.id;
        ball.lastAttachedEnemyId = targetEnemy.id;
        ball.targetEnemyId = null;

        if (targetEnemy && targetEnemy.hp > 0) {
          const damage = calculateChainDamage(state, ball.chainCount);
          playfield.applyDamageToEnemy(targetEnemy, damage, { sourceTower: tower });
          ball.damagedEnemies.add(targetEnemy.id);
        }

        ball.color = resolveXiColor(ball.chainCount);
      } else if (distance > 0) {
        const step = Math.min(distance, travelDistance);
        ball.x += (dx / distance) * step;
        ball.y += (dy / distance) * step;
      }
    } else {
      // No target available - fade out gracefully.
      ball.state = 'despawning';
      ball.lifetime = 0;
      ball.targetEnemyId = null;
      ball.attachedEnemyId = null;
    }
  } else if (ball.state === 'attached') {
    const attachedEnemy = ball.attachedEnemyId
      ? playfield.enemies.find((enemy) => enemy?.id === ball.attachedEnemyId)
      : null;

    if (!attachedEnemy || attachedEnemy.hp <= 0) {
      ball.chainDelay = 0;
    } else {
      const contactInfo = resolveEnemyEdgeTarget(playfield, attachedEnemy, ball);
      if (contactInfo) {
        ball.x = contactInfo.edgePoint.x;
        ball.y = contactInfo.edgePoint.y;
      }
    }

    ball.chainDelay -= delta;

    if (ball.chainDelay <= 0) {
      if (ball.chainCount >= ball.maxChains) {
        ball.state = 'despawning';
        ball.lifetime = 0;
        ball.targetEnemyId = null;
        ball.attachedEnemyId = null;

        if (attachedEnemy && attachedEnemy.hp > 0) {
          const damage = calculateChainDamage(state, ball.chainCount);
          playfield.applyDamageToEnemy(attachedEnemy, damage, { sourceTower: tower });
        }
      } else {
        const excludeIds = new Set();
        if (ball.attachedEnemyId) {
          excludeIds.add(ball.attachedEnemyId);
        }
        const nextEnemy = findNearestEnemyInRange(
          playfield,
          { x: ball.x, y: ball.y },
          state.chainRangePixels,
          excludeIds,
        );

        if (nextEnemy) {
          const contactInfo = resolveEnemyEdgeTarget(playfield, nextEnemy, ball);
          if (contactInfo) {
            ball.targetX = contactInfo.edgePoint.x;
            ball.targetY = contactInfo.edgePoint.y;
            ball.lastAttachedEnemyId = ball.attachedEnemyId || ball.lastAttachedEnemyId;
            ball.attachedEnemyId = null;
            ball.targetEnemyId = nextEnemy.id;
            ball.chainDelay = 0;
            ball.state = 'traveling';
          } else {
            ball.state = 'despawning';
            ball.lifetime = 0;
            ball.targetEnemyId = null;
            ball.attachedEnemyId = null;
          }
        } else {
          ball.state = 'despawning';
          ball.lifetime = 0;
          ball.targetEnemyId = null;
          ball.attachedEnemyId = null;

          if (attachedEnemy && attachedEnemy.hp > 0) {
            const damage = calculateChainDamage(state, ball.chainCount);
            playfield.applyDamageToEnemy(attachedEnemy, damage, { sourceTower: tower });
          }
        }
      }
    }
  } else if (ball.state === 'despawning') {
    // Despawning with flash effect
    if (ball.lifetime >= FLASH_DURATION) {
      return false; // Remove ball
    }
  }
  
  return true; // Keep ball
}

/**
 * Initialize or refresh xi tower state.
 */
export function ensureXiState(playfield, tower) {
  if (!playfield || !tower || tower.type !== 'xi') {
    return null;
  }
  const state = ensureXiStateInternal(playfield, tower);
  refreshXiParameters(playfield, tower, state);
  return state;
}

/**
 * Fire a new xi chain attack.
 */
export function fireXiChain(playfield, tower, targetInfo) {
  if (!playfield || !tower || tower.type !== 'xi' || !targetInfo?.enemy) {
    return;
  }
  
  const state = ensureXiStateInternal(playfield, tower);
  const enemy = targetInfo.enemy;
  const enemyPos = targetInfo.position || playfield.getEnemyPosition(enemy);
  
  if (!enemyPos) {
    return;
  }
  
  // Create new chaining ball
  const ball = createChainingBall(playfield, tower, enemy, enemyPos);
  ball.maxChains = Math.max(1, state.maxChains);
  
  state.activeBalls.push(ball);
}

/**
 * Update xi tower logic.
 */
export function updateXiTower(playfield, tower, delta) {
  if (!playfield || !tower || tower.type !== 'xi') {
    return;
  }
  
  const state = ensureXiStateInternal(playfield, tower);
  
  // Refresh parameters periodically
  state.recalcTimer = (state.recalcTimer || 0) - delta;
  if (state.recalcTimer <= 0) {
    refreshXiParameters(playfield, tower, state);
    state.recalcTimer = 0.35; // Recalc every 350ms
  }
  
  // Update all active balls
  state.activeBalls = state.activeBalls.filter((ball) =>
    updateChainingBall(playfield, tower, ball, state, delta)
  );
}

/**
 * Draw xi chaining balls and trails.
 */
export function drawXiBalls(playfield, tower) {
  if (!playfield?.ctx || !tower?.xiState) {
    return;
  }
  
  const ctx = playfield.ctx;
  const state = tower.xiState;
  const balls = Array.isArray(state.activeBalls) ? state.activeBalls : [];
  
  if (!balls.length) {
    return;
  }
  
  ctx.save();
  
  balls.forEach((ball) => {
    const color = ball.color;
    
    // Draw trail
    if (ball.trail.length > 1) {
      for (let i = 1; i < ball.trail.length; i++) {
        const point = ball.trail[i];
        const prevPoint = ball.trail[i - 1];
        
        const alpha = Math.max(0, 1 - point.age / 0.5);
        const width = Math.max(1, BALL_RADIUS * 0.3 * alpha);
        
        ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.6})`;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(prevPoint.x, prevPoint.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
    }
    
    // Draw ball
    if (ball.state === 'despawning') {
      // Flash effect
      const flashAlpha = 1 - (ball.lifetime / FLASH_DURATION);
      const flashRadius = BALL_RADIUS * (1 + (ball.lifetime / FLASH_DURATION) * 2);
      
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${flashAlpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, flashRadius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Normal ball with glow
      const gradient = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, BALL_RADIUS);
      gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 1)`);
      gradient.addColorStop(0.7, `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)`);
      gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0.2)`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      
      // Add glow effect
      ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, 0.6)`;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_RADIUS * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  });
  
  ctx.restore();
}

/**
 * Clean up xi tower state.
 */
export function teardownXiTower(playfield, tower) {
  if (tower?.xiState) {
    tower.xiState.activeBalls = [];
    tower.xiState = null;
  }
}
