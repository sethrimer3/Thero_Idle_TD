/**
 * Omicron (ο) Tower - Triangle Soldier Unit System
 * 
 * Mechanics:
 * - Trains soldier units that form equilateral triangles
 * - Each unit has a circular shield of swirling particles (similar to alpha tower)
 * - Shield particles use colors from the active palette (via codex)
 * - Training speed is based on delta tower's training speed
 * - When unit touches enemy with shield active:
 *   - Shield disappears and deals percentage-based damage (e.g., 2% of enemy's initial HP)
 * - When triangle hits enemy:
 *   - Deals damage = delta * xi
 * - If unit survives hitting an enemy without its shield:
 *   - Meaning enemy has less HP remaining than the unit's attack (delta * xi)
 *   - Unit regains its shield
 * - If enemy has more HP than unit's attack (delta * xi):
 *   - Unit dies, breaking into small triangles that fade away over 3-10 seconds
 * 
 * Formulas:
 * - atk = delta × xi (triangle attack damage)
 * - shdAtk = (1 + Aleph1)% (shield damage as percentage of enemy's initial HP)
 * - spd = deltaSpd/5 (training speed is 5 times slower than delta)
 * - untSpd = 1 + (0.1 × Aleph2) (unit's top speed in meters per second)
 * - Tot = 1 + Aleph3 (total number of units that can be spawned)
 */

import {
  calculateTowerEquationResult,
  getTowerEquationBlueprint,
  computeTowerVariableValue,
} from '../../../assets/towersTab.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';
import { metersToPixels } from '../../../assets/gameUnits.js';

// Default orbital parameters for shield particles
const SHIELD_PARTICLE_COUNT = 12;
const SHIELD_ORBIT_RADIUS_MULTIPLIER = 1.8; // Relative to unit size
const SHIELD_ORBIT_SPEED = Math.PI * 1.5; // Radians per second
const SHIELD_PARTICLE_SIZE = 4; // Base particle size in pixels

// Unit visual parameters
const UNIT_BASE_SIZE = 16; // Base size for triangle in pixels
const UNIT_ACCELERATION = 400; // Pixels per second squared

// Death animation parameters
const DEATH_FRAGMENT_COUNT_MIN = 5;
const DEATH_FRAGMENT_COUNT_MAX = 8;
const DEATH_FRAGMENT_FADE_MIN = 3; // Seconds
const DEATH_FRAGMENT_FADE_MAX = 10; // Seconds
const DEATH_FRAGMENT_SPEED = 80; // Pixels per second

// Trail configuration
const TRAIL_CONFIG = {
  lifespan: 0.6,
  spawnInterval: 0.05,
  minDistance: 4,
  maxPoints: 30,
};

// Clamp helper
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Ensure omicron tower state is initialized.
 */
function ensureOmicronStateInternal(playfield, tower) {
  if (!tower.omicronState) {
    tower.omicronState = {
      units: [],
      fragments: [],
      unitCounter: 0,
      recalcTimer: 0,
    };
  }
  return tower.omicronState;
}

/**
 * Refresh omicron tower parameters from formulas.
 */
function refreshOmicronParameters(playfield, tower, state) {
  // Get delta power for base damage
  const deltaPower = Math.max(0, calculateTowerEquationResult('delta') || 0);
  
  // Get xi power for damage multiplier
  const xiPower = Math.max(0, calculateTowerEquationResult('xi') || 0);
  
  // atk = delta × xi
  const triangleAttack = deltaPower * xiPower;
  
  // Get Aleph values
  const aleph1 = Math.max(0, computeTowerVariableValue('omicron', 'aleph1') || 0);
  const aleph2 = Math.max(0, computeTowerVariableValue('omicron', 'aleph2') || 0);
  const aleph3 = Math.max(0, computeTowerVariableValue('omicron', 'aleph3') || 0);
  
  // shdAtk = (1 + Aleph1)%
  const shieldDamagePercent = (1 + aleph1) / 100;
  
  // Get delta tower's spawn rate
  const deltaBlueprint = getTowerEquationBlueprint('delta');
  const deltaAleph1 = Math.max(1, computeTowerVariableValue('delta', 'aleph1', deltaBlueprint) || 1);
  
  // Delta training time: 5^aleph1 seconds per unit
  const rawDeltaTrainingSeconds = Math.pow(5, deltaAleph1);
  const deltaTrainingSeconds = Number.isFinite(rawDeltaTrainingSeconds) 
    ? Math.max(1, rawDeltaTrainingSeconds) 
    : Number.MAX_SAFE_INTEGER;
  const deltaSpawnRate = deltaTrainingSeconds > 0 && Number.isFinite(deltaTrainingSeconds) 
    ? 1 / deltaTrainingSeconds 
    : 0;
  
  // spd = deltaSpd/5 - Omicron training is 5 times slower than delta
  const omicronSpawnRate = deltaSpawnRate / 5;
  const trainingSeconds = omicronSpawnRate > 0 && Number.isFinite(omicronSpawnRate)
    ? 1 / omicronSpawnRate
    : Number.MAX_SAFE_INTEGER;
  
  // Tot = 1 + Aleph3 - Total number of units
  const maxUnits = Math.max(1, Math.floor(1 + aleph3));
  
  // untSpd = 1 + (0.1 × Aleph2) - Unit speed in meters per second
  const unitSpeedMetersPerSecond = 1 + (0.1 * aleph2);
  
  // Store computed values in state
  state.triangleAttack = triangleAttack;
  state.shieldDamagePercent = shieldDamagePercent;
  state.trainingSeconds = trainingSeconds;
  state.spawnRate = omicronSpawnRate;
  state.maxUnits = maxUnits;
  state.unitSpeedMetersPerSecond = unitSpeedMetersPerSecond;
  state.deltaPower = deltaPower;
  state.xiPower = xiPower;
  state.aleph1 = aleph1;
  state.aleph2 = aleph2;
  state.aleph3 = aleph3;
  
  // Update tower stats for display
  tower.baseDamage = triangleAttack;
  tower.damage = triangleAttack;
  tower.baseRate = omicronSpawnRate;
  tower.rate = omicronSpawnRate;
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
 * Create shield particles for a unit.
 */
function createShieldParticles(unit, gradientProgress) {
  const particles = [];
  const angleStep = (Math.PI * 2) / SHIELD_PARTICLE_COUNT;
  
  for (let i = 0; i < SHIELD_PARTICLE_COUNT; i++) {
    const angle = i * angleStep;
    const color = samplePaletteGradient((gradientProgress + i / SHIELD_PARTICLE_COUNT) % 1);
    
    particles.push({
      angle,
      baseAngle: angle,
      size: SHIELD_PARTICLE_SIZE,
      color: color || { r: 180, g: 200, b: 255 },
    });
  }
  
  return particles;
}

/**
 * Deploy a new omicron soldier unit.
 */
function deployOmicronUnit(playfield, tower, state) {
  const limit = Math.max(1, state.maxUnits || 1);
  if (state.units.length >= limit) {
    return;
  }
  
  const minDimension = resolvePlayfieldMinDimension(playfield);
  const unitSize = Math.max(12, UNIT_BASE_SIZE * (minDimension / 600));
  const spawnRadius = Math.max(20, minDimension * 0.04);
  
  const spawnIndex = state.unitCounter % limit;
  state.unitCounter += 1;
  
  const angle = -Math.PI / 2 + (Math.PI * 2 * spawnIndex) / limit;
  const spawnX = tower.x + Math.cos(angle) * spawnRadius;
  const spawnY = tower.y + Math.sin(angle) * spawnRadius;
  
  const gradientProgress = limit > 1 ? spawnIndex / (limit - 1) : 0;
  const baseColor = samplePaletteGradient(gradientProgress) || { r: 138, g: 247, b: 255 };
  
  const unit = {
    id: `omicron-unit-${(playfield.omicronUnitIdCounter = (playfield.omicronUnitIdCounter || 0) + 1)}`,
    towerId: tower.id,
    slotIndex: spawnIndex,
    x: spawnX,
    y: spawnY,
    prevX: spawnX,
    prevY: spawnY,
    vx: 0,
    vy: 0,
    heading: angle,
    idleAngleOffset: angle,
    size: unitSize,
    attack: state.triangleAttack,
    shieldDamagePercent: state.shieldDamagePercent,
    hasShield: true,
    shieldParticles: createShieldParticles({ x: spawnX, y: spawnY, size: unitSize }, gradientProgress),
    shieldOrbitPhase: 0,
    targetId: null,
    mode: 'idle',
    trailPoints: [],
    trailAccumulator: 0,
    lastTrailSample: { x: spawnX, y: spawnY },
    color: baseColor,
    gradientProgress,
  };
  
  state.units.push(unit);
}

/**
 * Resolve idle position for unit.
 */
function resolveIdlePosition(tower, unit, state) {
  const minDimension = resolvePlayfieldMinDimension({ renderWidth: 800, renderHeight: 600 });
  const idleRadius = Math.max(22, minDimension * 0.045);
  
  const index = Number.isFinite(unit.slotIndex) ? unit.slotIndex : 0;
  const count = Math.max(1, state.maxUnits || 1);
  const baseAngle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
  
  if (!Number.isFinite(unit.idleAngleOffset)) {
    unit.idleAngleOffset = baseAngle;
  }
  
  return {
    x: tower.x + Math.cos(unit.idleAngleOffset) * idleRadius,
    y: tower.y + Math.sin(unit.idleAngleOffset) * idleRadius,
  };
}

/**
 * Create death fragments when unit dies.
 */
function createDeathFragments(unit, state) {
  const count = DEATH_FRAGMENT_COUNT_MIN + 
    Math.floor(Math.random() * (DEATH_FRAGMENT_COUNT_MAX - DEATH_FRAGMENT_COUNT_MIN + 1));
  
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const speed = DEATH_FRAGMENT_SPEED * (0.5 + Math.random() * 0.5);
    const fadeTime = DEATH_FRAGMENT_FADE_MIN + Math.random() * (DEATH_FRAGMENT_FADE_MAX - DEATH_FRAGMENT_FADE_MIN);
    
    state.fragments.push({
      x: unit.x,
      y: unit.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: unit.size * 0.3,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 3,
      color: unit.color,
      alpha: 1,
      lifetime: 0,
      fadeTime,
    });
  }
}

/**
 * Record a trail point for the unit.
 */
function appendTrailPoint(unit, x, y) {
  if (!unit.trailPoints) {
    unit.trailPoints = [];
  }
  unit.trailPoints.push({ x, y, age: 0 });
  if (unit.trailPoints.length > TRAIL_CONFIG.maxPoints) {
    unit.trailPoints.splice(0, unit.trailPoints.length - TRAIL_CONFIG.maxPoints);
  }
  unit.lastTrailSample = { x, y };
  unit.trailAccumulator = 0;
}

/**
 * Update trail ages.
 */
function updateTrailAges(unit, delta) {
  if (!Array.isArray(unit.trailPoints) || !unit.trailPoints.length) {
    return;
  }
  for (let index = unit.trailPoints.length - 1; index >= 0; index -= 1) {
    const point = unit.trailPoints[index];
    point.age += delta;
    if (point.age >= TRAIL_CONFIG.lifespan) {
      unit.trailPoints.splice(index, 1);
    }
  }
}

/**
 * Update a single omicron unit.
 */
function updateOmicronUnit(playfield, tower, unit, state, delta) {
  if (!unit) {
    return false;
  }
  
  // Update shield particle orbit
  if (unit.hasShield) {
    unit.shieldOrbitPhase = (unit.shieldOrbitPhase || 0) + delta * SHIELD_ORBIT_SPEED;
    if (unit.shieldOrbitPhase > Math.PI * 2) {
      unit.shieldOrbitPhase %= (Math.PI * 2);
    }
  }
  
  // Find target
  let target = null;
  if (unit.targetId) {
    target = playfield.enemies.find((candidate) => candidate?.id === unit.targetId) || null;
    if (!target || target.hp <= 0) {
      unit.targetId = null;
      target = null;
    }
  }
  
  if (!target && playfield.combatActive && playfield.enemies.length) {
    const candidate = playfield.findTarget(tower);
    if (candidate?.enemy) {
      unit.targetId = candidate.enemy.id;
      target = candidate.enemy;
    }
  }
  
  // Determine destination
  let destination = null;
  if (target) {
    destination = playfield.getEnemyPosition(target);
    unit.mode = 'attacking';
  }
  if (!destination) {
    destination = resolveIdlePosition(tower, unit, state);
    unit.mode = 'idle';
  }
  if (!destination) {
    destination = { x: tower.x, y: tower.y };
  }
  
  // Movement physics
  const dx = destination.x - unit.x;
  const dy = destination.y - unit.y;
  const distance = Math.hypot(dx, dy);
  
  let nx = 0;
  let ny = 0;
  if (distance > 0.0001) {
    nx = dx / distance;
    ny = dy / distance;
  }
  
  // Convert unit speed from meters per second to pixels per second
  const minDimension = resolvePlayfieldMinDimension(playfield);
  const unitSpeedMetersPerSec = state.unitSpeedMetersPerSecond || 1;
  const unitSpeedPixelsPerSec = metersToPixels(unitSpeedMetersPerSec, minDimension);
  
  const desiredSpeed = distance > 1 ? unitSpeedPixelsPerSec : 0;
  const desiredVx = nx * desiredSpeed;
  const desiredVy = ny * desiredSpeed;
  const deltaVx = desiredVx - unit.vx;
  const deltaVy = desiredVy - unit.vy;
  const deltaMagnitude = Math.hypot(deltaVx, deltaVy);
  const maxVelocityChange = UNIT_ACCELERATION * delta;
  
  if (deltaMagnitude > maxVelocityChange && deltaMagnitude > 0) {
    const blend = maxVelocityChange / deltaMagnitude;
    unit.vx += deltaVx * blend;
    unit.vy += deltaVy * blend;
  } else {
    unit.vx = desiredVx;
    unit.vy = desiredVy;
  }
  
  unit.prevX = unit.x;
  unit.prevY = unit.y;
  
  if (distance <= 0.0001) {
    unit.x = destination.x;
    unit.y = destination.y;
    if (Math.abs(unit.vx) < 0.01) unit.vx = 0;
    if (Math.abs(unit.vy) < 0.01) unit.vy = 0;
  } else {
    const stepX = unit.vx * delta;
    const stepY = unit.vy * delta;
    const forwardTravel = stepX * nx + stepY * ny;
    if (forwardTravel > distance) {
      unit.x = destination.x;
      unit.y = destination.y;
      unit.vx = 0;
      unit.vy = 0;
    } else {
      unit.x += stepX;
      unit.y += stepY;
    }
  }
  
  // Update heading
  if (Number.isFinite(unit.vx) && Number.isFinite(unit.vy)) {
    const velocityMagnitude = Math.hypot(unit.vx, unit.vy);
    if (velocityMagnitude > 0.01) {
      unit.heading = Math.atan2(unit.vy, unit.vx);
    }
  }
  
  // Update trail
  const lastSample = unit.lastTrailSample || { x: unit.prevX, y: unit.prevY };
  const moved = Math.hypot(unit.x - lastSample.x, unit.y - lastSample.y);
  unit.trailAccumulator = (unit.trailAccumulator || 0) + delta;
  
  let appended = false;
  if (moved >= TRAIL_CONFIG.minDistance && unit.trailAccumulator >= TRAIL_CONFIG.spawnInterval) {
    appendTrailPoint(unit, unit.x, unit.y);
    appended = true;
  }
  if (!Array.isArray(unit.trailPoints) || !unit.trailPoints.length) {
    appendTrailPoint(unit, unit.x, unit.y);
    appended = true;
  }
  if (!appended) {
    const cap = TRAIL_CONFIG.spawnInterval;
    unit.trailAccumulator = Math.min(unit.trailAccumulator, cap);
  }
  updateTrailAges(unit, delta);
  
  // Check collision with target
  if (target) {
    const targetPosition = playfield.getEnemyPosition(target);
    if (targetPosition) {
      const metrics = playfield.getEnemyVisualMetrics(target);
      const enemyRadius = playfield.getEnemyHitRadius(target, metrics);
      const contactRadius = enemyRadius + (unit.size || 16);
      const separation = Math.hypot(unit.x - targetPosition.x, unit.y - targetPosition.y);
      
      if (separation <= contactRadius) {
        // Contact made!
        let unitDied = false;
        
        // If unit has shield, apply shield damage and remove shield
        if (unit.hasShield) {
          const enemyInitialHp = target.initialHp || target.hp;
          const shieldDamage = enemyInitialHp * unit.shieldDamagePercent;
          target.hp = Math.max(0, target.hp - shieldDamage);
          
          // Remove shield
          unit.hasShield = false;
          unit.shieldParticles = [];
          
          if (target.hp <= 0) {
            playfield.processEnemyDefeat(target);
            unit.targetId = null;
          }
        }
        
        // Apply triangle attack damage
        if (target.hp > 0) {
          const enemyHpBefore = target.hp;
          target.hp = Math.max(0, target.hp - unit.attack);
          
          if (target.hp <= 0) {
            playfield.processEnemyDefeat(target);
            unit.targetId = null;
            
            // If unit killed the enemy without shield, regain shield
            if (!unit.hasShield) {
              unit.hasShield = true;
              unit.shieldParticles = createShieldParticles(unit, unit.gradientProgress);
              unit.shieldOrbitPhase = 0;
            }
          } else {
            // Enemy survived
            if (!unit.hasShield) {
              // Check if enemy HP remaining is less than unit's attack
              if (target.hp < unit.attack) {
                // Unit survives and regains shield
                unit.hasShield = true;
                unit.shieldParticles = createShieldParticles(unit, unit.gradientProgress);
                unit.shieldOrbitPhase = 0;
              } else {
                // Unit dies
                unitDied = true;
              }
            }
          }
        }
        
        if (unitDied) {
          createDeathFragments(unit, state);
          return false;
        }
      }
    }
  }
  
  return true;
}

/**
 * Update death fragments.
 */
function updateFragments(state, delta) {
  if (!Array.isArray(state.fragments)) {
    return;
  }
  
  for (let i = state.fragments.length - 1; i >= 0; i--) {
    const fragment = state.fragments[i];
    fragment.lifetime += delta;
    fragment.x += fragment.vx * delta;
    fragment.y += fragment.vy * delta;
    fragment.rotation += fragment.rotationSpeed * delta;
    
    const progress = fragment.lifetime / fragment.fadeTime;
    fragment.alpha = Math.max(0, 1 - progress);
    
    if (fragment.alpha <= 0 || fragment.lifetime >= fragment.fadeTime) {
      state.fragments.splice(i, 1);
    }
  }
}

/**
 * Initialize or refresh omicron tower state.
 */
export function ensureOmicronState(playfield, tower) {
  if (!playfield || !tower || tower.type !== 'omicron') {
    return null;
  }
  const state = ensureOmicronStateInternal(playfield, tower);
  refreshOmicronParameters(playfield, tower, state);
  return state;
}

/**
 * Update omicron tower logic.
 */
export function updateOmicronTower(playfield, tower, delta) {
  if (!playfield || !tower || tower.type !== 'omicron') {
    return;
  }
  
  const state = ensureOmicronStateInternal(playfield, tower);
  
  // Refresh parameters periodically
  state.recalcTimer = (state.recalcTimer || 0) - delta;
  if (state.recalcTimer <= 0) {
    refreshOmicronParameters(playfield, tower, state);
    state.recalcTimer = 0.35; // Recalc every 350ms
  }
  
  // Update all units
  const survivors = [];
  for (let index = 0; index < state.units.length; index += 1) {
    const unit = state.units[index];
    if (updateOmicronUnit(playfield, tower, unit, state, delta)) {
      survivors.push(unit);
    }
  }
  state.units = survivors;
  
  // Update fragments
  updateFragments(state, delta);
  
  // Spawn new units if below cap
  const spawnCap = Math.max(1, state.maxUnits || 1);
  if (state.units.length < spawnCap) {
    if (tower.cooldown <= 0) {
      deployOmicronUnit(playfield, tower, state);
      const rate = Number.isFinite(state.spawnRate) ? Math.max(0, state.spawnRate) : 0;
      if (rate > 0) {
        tower.cooldown = 1 / rate;
      } else if (Number.isFinite(state.trainingSeconds) && state.trainingSeconds > 0) {
        tower.cooldown = state.trainingSeconds;
      } else {
        tower.cooldown = 1;
      }
    }
  }
}

/**
 * Draw omicron units, shields, trails, and fragments.
 */
export function drawOmicronUnits(playfield) {
  if (!playfield?.ctx) {
    return;
  }
  
  const ctx = playfield.ctx;
  
  ctx.save();
  playfield.towers.forEach((tower) => {
    if (tower.type !== 'omicron' || !tower.omicronState) {
      return;
    }
    
    const state = tower.omicronState;
    
    // Draw death fragments first (behind units)
    if (Array.isArray(state.fragments)) {
      state.fragments.forEach((fragment) => {
        ctx.save();
        ctx.globalAlpha = fragment.alpha;
        ctx.translate(fragment.x, fragment.y);
        ctx.rotate(fragment.rotation);
        
        // Draw small triangle
        ctx.beginPath();
        ctx.moveTo(0, -fragment.size);
        ctx.lineTo(-fragment.size * 0.6, fragment.size * 0.9);
        ctx.lineTo(fragment.size * 0.6, fragment.size * 0.9);
        ctx.closePath();
        
        ctx.fillStyle = `rgba(${fragment.color.r}, ${fragment.color.g}, ${fragment.color.b}, ${fragment.alpha})`;
        ctx.fill();
        
        ctx.restore();
      });
    }
    
    // Draw units
    if (Array.isArray(state.units)) {
      state.units.forEach((unit) => {
        if (!Number.isFinite(unit.x) || !Number.isFinite(unit.y)) {
          return;
        }
        
        // Draw trail
        if (Array.isArray(unit.trailPoints) && unit.trailPoints.length) {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = `rgba(${unit.color.r}, ${unit.color.g}, ${unit.color.b}, 0.25)`;
          ctx.lineWidth = Math.max(1.2, unit.size * 0.1);
          ctx.beginPath();
          unit.trailPoints.forEach((point, index) => {
            const alpha = clamp(1 - point.age / TRAIL_CONFIG.lifespan, 0, 1);
            const radius = Math.max(2, unit.size * 0.15 * alpha);
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(${unit.color.r}, ${unit.color.g}, ${unit.color.b}, ${alpha * 0.3})`;
            ctx.beginPath();
            ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            if (index === 0) {
              ctx.moveTo(point.x, point.y);
            } else {
              ctx.lineTo(point.x, point.y);
            }
          });
          ctx.stroke();
          ctx.restore();
        }
        
        // Draw shield particles if unit has shield
        if (unit.hasShield && Array.isArray(unit.shieldParticles)) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          
          const shieldRadius = unit.size * SHIELD_ORBIT_RADIUS_MULTIPLIER;
          unit.shieldParticles.forEach((particle) => {
            const angle = particle.baseAngle + unit.shieldOrbitPhase;
            const px = unit.x + Math.cos(angle) * shieldRadius;
            const py = unit.y + Math.sin(angle) * shieldRadius;
            
            const gradient = ctx.createRadialGradient(px, py, 0, px, py, particle.size);
            gradient.addColorStop(0, `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, 0.9)`);
            gradient.addColorStop(0.6, `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, 0.4)`);
            gradient.addColorStop(1, `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, 0)`);
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(px, py, particle.size, 0, Math.PI * 2);
            ctx.fill();
          });
          
          ctx.restore();
        }
        
        // Draw triangle unit
        ctx.save();
        ctx.translate(unit.x, unit.y);
        ctx.rotate(unit.heading + Math.PI / 2);
        
        // Inverted equilateral triangle (pointing down in local space, up in world space)
        ctx.beginPath();
        ctx.moveTo(0, -unit.size);
        ctx.lineTo(-unit.size * 0.866, unit.size * 0.5); // 0.866 = cos(30°)
        ctx.lineTo(unit.size * 0.866, unit.size * 0.5);
        ctx.closePath();
        
        const alpha = unit.hasShield ? 0.8 : 0.5;
        ctx.fillStyle = `rgba(${unit.color.r}, ${unit.color.g}, ${unit.color.b}, ${alpha})`;
        ctx.strokeStyle = `rgba(12, 16, 26, 0.9)`;
        ctx.lineWidth = Math.max(1.5, unit.size * 0.1);
        ctx.fill();
        ctx.stroke();
        
        // Add center dot
        ctx.beginPath();
        ctx.fillStyle = `rgba(6, 8, 14, ${unit.hasShield ? 0.7 : 0.5})`;
        ctx.arc(0, 0, unit.size * 0.25, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      });
    }
  });
  ctx.restore();
}

/**
 * Clean up omicron tower state.
 */
export function teardownOmicronTower(playfield, tower) {
  if (tower?.omicronState) {
    tower.omicronState.units = [];
    tower.omicronState.fragments = [];
    tower.omicronState = null;
  }
}
