/**
 * Phi (φ) Tower - Sunflower Swarm
 *
 * Mechanics:
 * - Grows seeds in a sunflower pattern around itself using the golden ratio (φ ≈ 1.618).
 * - Seeds arranged on rings with Fibonacci capacities [1, 2, 3, 5, 8, 13].
 * - Seeds placed at golden angle intervals (≈137.5°).
 * - On burst command, all seeds launch simultaneously.
 * - Seeds spiral outward to tower range, spin at edge as damaging halo, then return.
 * - Seeds that still have pierce left reseed automatically.
 *
 * Formulas:
 * - Golden ratio: φ = 1.61803398875
 * - Golden angle: 2π(1 - 1/φ) ≈ 2.399963 rad ≈ 137.5°
 * - Ring radius: r_k = R₀ × φ^k (where k is ring index, R₀ is base radius)
 * - Seed motion timeline:
 *   - Outward phase: 0 ≤ t < T_OUT
 *   - Edge spin phase: T_OUT ≤ t < T_OUT + T_SPIN
 *   - Return phase: T_OUT + T_SPIN ≤ t < T_OUT + T_SPIN + T_BACK
 */

import { metersToPixels } from '../../../assets/gameUnits.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

// Golden ratio and related constants
const PHI = 1.61803398875;
const GOLDEN_ANGLE = 2 * Math.PI * (1 - 1 / PHI); // ≈ 2.399963 rad ≈ 137.5°

// Seed generation and ring configuration
const R0 = 40.0; // Base radius for innermost ring (pixels)
const MAX_ROWS = 6; // Maximum number of rings
const TOWER_RANGE = 250.0; // Outer radius where seeds form the halo (pixels)

// Seed production and timing
const SEEDS_PER_SECOND = 0.8; // Production rate
const T_OUT = 0.6; // Time to spiral from ring to edge (seconds)
const T_SPIN = 1.0; // Time spinning at edge (seconds)
const T_BACK = 1.0; // Time returning to ring (seconds)

// Angular speeds during different phases
const OMEGA_OUT = 2.0; // Angular speed during outward spiral (rad/s)
const OMEGA_SPIN = 4.0; // Angular speed while spinning at edge (rad/s)
const OMEGA_BACK = 1.0; // Angular speed while returning (rad/s)

// Seed combat parameters
const SEED_MAX_PIERCE = 2; // How many enemies a seed can hit before consumed
const SEED_DAMAGE = 10.0; // Base damage per hit
const SEED_HIT_RADIUS = 10.0; // Collision radius (pixels)

// Fibonacci capacities for rows
const FIB_CAPS = [1, 2, 3, 5, 8, 13];

// Visual parameters
const SEED_VISUAL_RADIUS = 4.0; // Seed display radius (pixels)
const RING_LINE_WIDTH = 0.8; // Ring outline width
const RING_ALPHA = 0.15; // Ring transparency

/**
 * Normalize palette-derived colors into reliable RGB structures.
 */
function normalizeColor(color) {
  if (!color || typeof color !== 'object') {
    return null;
  }
  const { r, g, b } = color;
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return null;
  }
  return {
    r: Math.max(0, Math.min(255, Math.round(r))),
    g: Math.max(0, Math.min(255, Math.round(g))),
    b: Math.max(0, Math.min(255, Math.round(b))),
  };
}

/**
 * Resolve colors from the active palette with fallback to golden/amber tones.
 */
function resolvePhiColor(progress = 0) {
  const color = normalizeColor(samplePaletteGradient(progress % 1));
  if (color) {
    return color;
  }
  // Fallback to golden/amber color
  return { r: 255, g: 215, b: 100 };
}

/**
 * Create a sunflower seed with initial properties.
 */
function createSeed(rowIndex, theta0, ringRadius) {
  return {
    // Static properties
    rowIndex,
    theta0,
    ringRadius,
    
    // Stateful flight variables
    inFlight: false,
    flightTime: 0.0,
    remainingPierce: SEED_MAX_PIERCE,
    
    // Transient position
    x: 0,
    y: 0,
    
    // Visual properties
    color: resolvePhiColor(Math.random()),
  };
}

/**
 * Initialize a sunflower row.
 */
function createRow(k) {
  return {
    radius: R0 * Math.pow(PHI, k),
    thetaOffset: 0.0,
    capacity: FIB_CAPS[k],
    seeds: [],
  };
}

/**
 * Initialize phi tower state.
 */
function initializePhiState() {
  const rows = [];
  for (let k = 0; k < MAX_ROWS; k += 1) {
    rows.push(createRow(k));
  }
  
  return {
    rows,
    lastSeedSpawnTime: 0,
    burstActive: false,
    colorOffset: 0,
  };
}

/**
 * Spawn a single seed in the first available row.
 * Returns true if a seed was spawned, false if all rows are full.
 */
function spawnOneSeed(tower, state, currentTime) {
  for (let k = 0; k < state.rows.length; k += 1) {
    const row = state.rows[k];
    if (row.seeds.length < row.capacity) {
      // Create new seed in this row
      const i = row.seeds.length; // Index within this row
      const theta0 = row.thetaOffset + i * GOLDEN_ANGLE;
      
      const seed = createSeed(k, theta0, row.radius);
      
      // Set initial position on ring
      seed.x = tower.x + seed.ringRadius * Math.cos(seed.theta0);
      seed.y = tower.y + seed.ringRadius * Math.sin(seed.theta0);
      
      row.seeds.push(seed);
      return true;
    }
  }
  return false; // All rows full
}

/**
 * Update seed production during charge phase.
 */
function updateSeedProduction(playfield, tower, state, currentTime) {
  if (state.burstActive) {
    return; // Do not produce seeds during burst
  }
  
  // Calculate how many seeds should be spawned
  const dt = currentTime - state.lastSeedSpawnTime;
  let expectedSeeds = dt * SEEDS_PER_SECOND;
  
  // Spawn integer number of seeds
  while (expectedSeeds >= 1.0) {
    if (!spawnOneSeed(tower, state, currentTime)) {
      // All rows full, stop spawning
      break;
    }
    expectedSeeds -= 1.0;
    state.lastSeedSpawnTime = currentTime;
  }
}

/**
 * Trigger burst - launch all seeds simultaneously.
 */
export function triggerPhiBurst(playfield, tower) {
  const state = tower.phiState;
  if (!state || state.burstActive) {
    return; // Already bursting or no state
  }
  
  let hasSeeds = false;
  for (const row of state.rows) {
    for (const seed of row.seeds) {
      seed.inFlight = true;
      seed.flightTime = 0.0;
      hasSeeds = true;
    }
  }
  
  if (hasSeeds) {
    state.burstActive = true;
  }
}

/**
 * Update a single seed's position and collision state during flight.
 * Returns true if seed should continue existing, false if it should be removed.
 */
function updateSeedFlight(playfield, tower, seed, delta) {
  seed.flightTime += delta;
  const t = seed.flightTime;
  const totalFlight = T_OUT + T_SPIN + T_BACK;
  
  if (t >= totalFlight) {
    // Flight done, handle reseeding vs destruction
    if (seed.remainingPierce > 0) {
      // Reseed: snap back to ring
      seed.inFlight = false;
      seed.flightTime = 0.0;
      seed.remainingPierce = SEED_MAX_PIERCE;
      seed.x = tower.x + seed.ringRadius * Math.cos(seed.theta0);
      seed.y = tower.y + seed.ringRadius * Math.sin(seed.theta0);
      return true; // Keep seed
    } else {
      // Consumed: remove from row
      return false;
    }
  }
  
  // Compute position based on current phase
  let radius;
  let angle;
  
  if (t < T_OUT) {
    // Outward phase: r_k -> R_edge
    const tau = t / T_OUT;
    radius = (1.0 - tau) * seed.ringRadius + tau * TOWER_RANGE;
    angle = seed.theta0 + OMEGA_OUT * t;
  } else if (t < T_OUT + T_SPIN) {
    // Edge spin phase: fixed radius = TOWER_RANGE
    const tSpin = t - T_OUT;
    radius = TOWER_RANGE;
    angle = seed.theta0 + OMEGA_OUT * T_OUT + OMEGA_SPIN * tSpin;
  } else {
    // Return phase: R_edge -> r_k
    const tBack = t - (T_OUT + T_SPIN);
    const tauBack = tBack / T_BACK;
    radius = (1.0 - tauBack) * TOWER_RANGE + tauBack * seed.ringRadius;
    angle = seed.theta0 + OMEGA_OUT * T_OUT + OMEGA_SPIN * T_SPIN + OMEGA_BACK * tBack;
  }
  
  seed.x = tower.x + radius * Math.cos(angle);
  seed.y = tower.y + radius * Math.sin(angle);
  
  // Collision detection
  if (seed.remainingPierce > 0) {
    handleSeedCollisions(playfield, tower, seed);
  }
  
  return true; // Keep seed
}

/**
 * Handle collision detection and damage for a seed.
 */
function handleSeedCollisions(playfield, tower, seed) {
  if (!playfield.enemies || !Array.isArray(playfield.enemies)) {
    return;
  }
  
  for (const enemy of playfield.enemies) {
    if (!enemy || enemy.hp <= 0 || seed.remainingPierce <= 0) {
      continue;
    }
    
    const enemyPos = playfield.getEnemyPosition(enemy);
    const dx = enemyPos.x - seed.x;
    const dy = enemyPos.y - seed.y;
    const distSq = dx * dx + dy * dy;
    
    if (distSq <= SEED_HIT_RADIUS * SEED_HIT_RADIUS) {
      // Hit enemy
      playfield.applyDamageToEnemy(enemy, SEED_DAMAGE, { sourceTower: tower });
      seed.remainingPierce -= 1;
      
      if (seed.remainingPierce <= 0) {
        // This seed is destroyed and will not reseed
        break;
      }
    }
  }
}

/**
 * Ensure phi tower state exists.
 */
export function ensurePhiState(playfield, tower) {
  if (!playfield || !tower || tower.type !== 'phi') {
    return null;
  }
  
  if (!tower.phiState) {
    tower.phiState = initializePhiState();
  }
  
  return tower.phiState;
}

/**
 * Update phi tower state each frame.
 */
export function updatePhiTower(playfield, tower, delta) {
  if (!playfield || !tower || tower.type !== 'phi') {
    return;
  }
  
  const state = ensurePhiState(playfield, tower);
  if (!state) {
    return;
  }
  
  // Get current game time
  const currentTime = playfield.gameTime || 0;
  
  // Update seed production
  updateSeedProduction(playfield, tower, state, currentTime);
  
  if (state.burstActive) {
    let anySeedStillInFlight = false;
    
    // Update all seeds in flight
    for (const row of state.rows) {
      const survivingSeeds = [];
      
      for (const seed of row.seeds) {
        if (!seed.inFlight) {
          survivingSeeds.push(seed);
          continue;
        }
        
        const shouldKeep = updateSeedFlight(playfield, tower, seed, delta);
        if (shouldKeep) {
          survivingSeeds.push(seed);
          if (seed.inFlight) {
            anySeedStillInFlight = true;
          }
        }
        // If shouldKeep is false, seed is removed (consumed)
      }
      
      row.seeds = survivingSeeds;
    }
    
    if (!anySeedStillInFlight) {
      state.burstActive = false;
    }
  }
  
  // Set tower stats for UI display
  tower.baseRange = TOWER_RANGE;
  tower.range = TOWER_RANGE;
  tower.baseDamage = SEED_DAMAGE;
  tower.damage = SEED_DAMAGE;
}

/**
 * Draw phi tower seeds and rings.
 */
export function drawPhiTower(playfield, tower) {
  if (!playfield?.ctx || !tower?.phiState) {
    return;
  }
  
  const ctx = playfield.ctx;
  const state = tower.phiState;
  
  // Draw rings
  ctx.save();
  ctx.strokeStyle = `rgba(255, 215, 100, ${RING_ALPHA})`;
  ctx.lineWidth = RING_LINE_WIDTH;
  
  for (const row of state.rows) {
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, row.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Draw range circle (more prominent)
  ctx.strokeStyle = `rgba(255, 215, 100, ${RING_ALPHA * 1.5})`;
  ctx.lineWidth = RING_LINE_WIDTH * 1.5;
  ctx.beginPath();
  ctx.arc(tower.x, tower.y, TOWER_RANGE, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  
  // Draw seeds
  for (const row of state.rows) {
    for (const seed of row.seeds) {
      const alpha = seed.inFlight ? 0.9 : 0.7;
      const radius = seed.inFlight ? SEED_VISUAL_RADIUS * 1.2 : SEED_VISUAL_RADIUS;
      
      // Outer glow for in-flight seeds
      if (seed.inFlight && seed.flightTime >= T_OUT && seed.flightTime < T_OUT + T_SPIN) {
        // Seeds at edge get extra glow
        const gradient = ctx.createRadialGradient(
          seed.x, seed.y, 0,
          seed.x, seed.y, radius * 2
        );
        gradient.addColorStop(0, `rgba(${seed.color.r}, ${seed.color.g}, ${seed.color.b}, ${alpha})`);
        gradient.addColorStop(1, `rgba(${seed.color.r}, ${seed.color.g}, ${seed.color.b}, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(seed.x, seed.y, radius * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Main seed body
      ctx.fillStyle = `rgba(${seed.color.r}, ${seed.color.g}, ${seed.color.b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(seed.x, seed.y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Pierce indicator (small dots for remaining hits)
      if (seed.remainingPierce > 0 && seed.remainingPierce < SEED_MAX_PIERCE) {
        ctx.fillStyle = `rgba(255, 255, 255, 0.8)`;
        for (let p = 0; p < seed.remainingPierce; p += 1) {
          const dotAngle = (p / SEED_MAX_PIERCE) * Math.PI * 2;
          const dotRadius = radius * 0.6;
          const dotX = seed.x + Math.cos(dotAngle) * dotRadius;
          const dotY = seed.y + Math.sin(dotAngle) * dotRadius;
          ctx.beginPath();
          ctx.arc(dotX, dotY, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}

/**
 * Clear phi tower state when tower is removed.
 */
export function teardownPhiTower(playfield, tower) {
  if (!tower?.phiState) {
    return;
  }
  tower.phiState = null;
}

// Export configuration for compatibility with other tower systems
export const PHI_TOWER_CONFIG = {
  type: 'phi',
  baseRange: TOWER_RANGE,
  baseDamage: SEED_DAMAGE,
  maxRows: MAX_ROWS,
  phi: PHI,
  goldenAngle: GOLDEN_ANGLE,
};
