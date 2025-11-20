// Ω tower particle orchestration: golden particles orbit enemies, then execute HP% slices.
import {
  computeTowerVariableValue,
  calculateTowerEquationResult,
} from '../../../assets/towersTab.js';
import { metersToPixels } from '../../../assets/gameUnits.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

// Golden particle colors for Omega tower
const OMEGA_PARTICLE_COLORS = [
  { r: 255, g: 215, b: 0 },   // Gold
  { r: 255, g: 223, b: 128 }, // Light gold
];

// Offsets for palette sampling
const OMEGA_COLOR_OFFSETS = [0.45, 0.65];

// Base configuration constants
const BASE_RANGE_METERS = 7.0;
const BASE_PARTICLES = 8;
const BASE_COOLDOWN_SECONDS = 4.0;
const BASE_SLICE_FRACTION = 0.10; // 10% of max HP
const MAX_SLICE_FRACTION = 0.40;  // Cap at 40% of max HP
const ORBIT_RADIUS_PIXELS = 25;
const ORBIT_ANGULAR_SPEED = Math.PI * 0.8; // radians per second
const CHARGE_PHASE_FRACTION = 0.7; // 70% of cooldown is charging

// Tower states
const STATE_IDLE = 'IDLE';
const STATE_ORBITING = 'ORBITING';
const STATE_SLICING = 'SLICING';
const STATE_COOLDOWN = 'COOLDOWN';

/**
 * Normalize palette-derived colors to particle-friendly RGB objects.
 */
function normalizeParticleColor(color) {
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
 * Resolve colors for omega particles from the palette or use fallback.
 */
function resolveOmegaParticleColors() {
  const colors = OMEGA_COLOR_OFFSETS.map((offset) => 
    normalizeParticleColor(samplePaletteGradient(offset))
  ).filter(Boolean);
  
  if (colors.length >= 2) {
    return colors;
  }
  return OMEGA_PARTICLE_COLORS.map((entry) => ({ ...entry }));
}

/**
 * Clamp a value between min and max.
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Ensure Ω tower state is initialized and up-to-date with current sub-equation values.
 */
export function ensureOmegaState(playfield, tower, options = {}) {
  if (!playfield || !tower || tower.type !== 'omega') {
    return null;
  }

  const minDimension = Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) || 1;

  // Read sub-equation parameters
  const omega_range = Math.max(0, computeTowerVariableValue('omega', 'omega_range') || 1.0);
  const omega_particleCount = Math.max(1, Math.floor(computeTowerVariableValue('omega', 'omega_particleCount') || 0));
  const omega_cooldown = Math.max(0.1, computeTowerVariableValue('omega', 'omega_cooldown') || 1.0);
  const omega_sliceFrac = Math.max(0, computeTowerVariableValue('omega', 'omega_sliceFrac') || 0);
  const omega_priorityMode = computeTowerVariableValue('omega', 'omega_priorityMode') || 'first';
  const omega_multiMode = computeTowerVariableValue('omega', 'omega_multiMode') || 'single';

  // Calculate effective values
  const rangeMeters = BASE_RANGE_METERS * (1 + omega_range);
  const rangePixels = metersToPixels(rangeMeters, minDimension);
  const particleCount = BASE_PARTICLES + omega_particleCount;
  const sliceCooldown = BASE_COOLDOWN_SECONDS / (1 + omega_cooldown);
  const sliceFrac = clamp(
    BASE_SLICE_FRACTION + omega_sliceFrac,
    BASE_SLICE_FRACTION,
    MAX_SLICE_FRACTION
  );
  const sliceChargeTime = sliceCooldown * CHARGE_PHASE_FRACTION;

  // Update tower properties
  tower.range = rangePixels;
  tower.baseRange = rangePixels;
  tower.damage = 0; // Omega doesn't use standard damage
  tower.baseDamage = 0;
  tower.rate = 1 / sliceCooldown;
  tower.baseRate = 1 / sliceCooldown;

  let state = tower.omegaState;
  if (!state) {
    state = {
      state: STATE_IDLE,
      sliceTimer: 0,
      cooldownTimer: 0,
      particles: [],
      currentTargets: [],
      particleCount,
      sliceCooldown,
      sliceFrac,
      sliceChargeTime,
      priorityMode: omega_priorityMode,
      multiMode: omega_multiMode,
    };
    tower.omegaState = state;
  } else {
    // Update state with current sub-equation values
    state.particleCount = particleCount;
    state.sliceCooldown = sliceCooldown;
    state.sliceFrac = sliceFrac;
    state.sliceChargeTime = sliceChargeTime;
    state.priorityMode = omega_priorityMode;
    state.multiMode = omega_multiMode;
  }

  return state;
}

/**
 * Clear cached Ω tower state when the tower is removed.
 */
export function teardownOmegaTower(playfield, tower) {
  if (!playfield || !tower || !tower.omegaState) {
    return;
  }
  tower.omegaState = null;
}

/**
 * Sort enemies by path progress (closest to exit first) for "first" priority mode.
 */
function sortByFirst(playfield, enemies) {
  return enemies.sort((a, b) => {
    const progressA = a.enemy.pathProgress || 0;
    const progressB = b.enemy.pathProgress || 0;
    return progressB - progressA; // Higher progress = closer to exit
  });
}

/**
 * Sort enemies by max HP (highest first) for "strongest" priority mode.
 */
function sortByStrongest(enemies) {
  return enemies.sort((a, b) => {
    const hpA = a.enemy.maxHP || a.enemy.hp || 0;
    const hpB = b.enemy.maxHP || b.enemy.hp || 0;
    return hpB - hpA; // Higher HP first
  });
}

/**
 * Gather all enemies within range and sort by priority mode.
 */
function gatherTargets(playfield, tower, state) {
  const enemiesInRange = [];
  
  playfield.enemies.forEach((enemy) => {
    if (!enemy || enemy.hp <= 0) {
      return;
    }
    
    const position = playfield.getEnemyPosition(enemy);
    if (!position) {
      return;
    }
    
    const distance = Math.hypot(position.x - tower.x, position.y - tower.y);
    if (distance <= tower.range) {
      enemiesInRange.push({ enemy, position });
    }
  });

  if (enemiesInRange.length === 0) {
    return [];
  }

  // Sort by priority mode
  if (state.priorityMode === 'strongest') {
    return sortByStrongest(enemiesInRange);
  } else {
    // Default to "first" mode
    return sortByFirst(playfield, enemiesInRange);
  }
}

/**
 * Create particle objects orbiting the assigned targets.
 */
function createParticles(state, targets, towerPosition) {
  const particles = [];
  const colors = resolveOmegaParticleColors();
  const particleCount = state.particleCount;

  for (let i = 0; i < particleCount; i++) {
    // Determine which target this particle orbits
    let target = null;
    if (state.multiMode === 'single') {
      // All particles orbit the first target
      target = targets.length > 0 ? targets[0] : null;
    } else {
      // Distribute particles round-robin across targets
      target = targets.length > 0 ? targets[i % targets.length] : null;
    }

    if (!target) {
      continue;
    }

    const baseAngle = (2 * Math.PI * i) / particleCount;
    const color = colors[i % colors.length];

    particles.push({
      target: target.enemy,
      targetId: target.enemy.id,
      baseAngle,
      angle: baseAngle,
      orbitRadius: ORBIT_RADIUS_PIXELS,
      x: towerPosition.x,
      y: towerPosition.y,
      size: 4,
      opacity: 0.9,
      color,
    });
  }

  return particles;
}

/**
 * Update particle positions during orbit phase.
 */
function updateOrbitingParticles(playfield, state, delta) {
  const validParticles = [];
  
  state.particles.forEach((particle) => {
    if (!particle.target || particle.target.hp <= 0) {
      // Target died, remove this particle
      return;
    }
    
    const position = playfield.getEnemyPosition(particle.target);
    if (!position) {
      // Target not found
      return;
    }
    
    // Update angle
    particle.angle += ORBIT_ANGULAR_SPEED * delta;
    
    // Update position around target
    particle.x = position.x + Math.cos(particle.angle) * particle.orbitRadius;
    particle.y = position.y + Math.sin(particle.angle) * particle.orbitRadius;
    
    validParticles.push(particle);
  });
  
  state.particles = validParticles;
  
  // Check if any targets remain
  const uniqueTargets = new Set();
  state.particles.forEach((p) => {
    if (p.target && p.target.hp > 0) {
      uniqueTargets.add(p.target.id);
    }
  });
  
  return uniqueTargets.size > 0;
}

/**
 * Execute the slice phase: deal percentage damage to all current targets.
 */
function executeSlice(playfield, tower, state) {
  const uniqueTargets = new Set();
  
  // Collect unique targets from particles
  state.particles.forEach((particle) => {
    if (particle.target && particle.target.hp > 0) {
      const position = playfield.getEnemyPosition(particle.target);
      if (position) {
        const distance = Math.hypot(position.x - tower.x, position.y - tower.y);
        if (distance <= tower.range) {
          uniqueTargets.add(particle.target);
        }
      }
    }
  });
  
  // Apply damage to each unique target
  uniqueTargets.forEach((enemy) => {
    const maxHP = enemy.maxHP || enemy.hp || 0;
    const damage = state.sliceFrac * maxHP;
    
    if (damage > 0) {
      enemy.hp = Math.max(0, enemy.hp - damage);
      
      // Track damage for statistics
      if (typeof playfield.recordDamage === 'function') {
        playfield.recordDamage(tower, enemy, damage);
      }
    }
  });
  
  // Visual/audio feedback
  if (uniqueTargets.size > 0) {
    // Play sound effect (if audio system available)
    // VFX.spawnOmegaSliceEffect(state.particles, Array.from(uniqueTargets));
  }
}

/**
 * Update Ω tower state machine.
 */
export function updateOmegaTower(playfield, tower, delta) {
  if (!playfield || !tower || tower.type !== 'omega') {
    return;
  }

  if (!playfield.combatActive) {
    return;
  }

  // Ensure tower state is initialized
  const state = ensureOmegaState(playfield, tower);
  if (!state) {
    return;
  }

  switch (state.state) {
    case STATE_IDLE:
      // Check if cooldown is ready
      if (state.cooldownTimer > 0) {
        state.cooldownTimer = Math.max(0, state.cooldownTimer - delta);
        break;
      }
      
      // Gather targets and start a new cycle
      const sortedTargets = gatherTargets(playfield, tower, state);
      
      if (sortedTargets.length === 0) {
        // No enemies in range, stay idle
        break;
      }
      
      // Determine how many targets to use
      let targetsToUse = [];
      if (state.multiMode === 'single') {
        // Use only the first target
        targetsToUse = [sortedTargets[0]];
      } else {
        // Use up to particleCount targets
        const maxTargets = Math.min(state.particleCount, sortedTargets.length);
        targetsToUse = sortedTargets.slice(0, maxTargets);
      }
      
      state.currentTargets = targetsToUse;
      state.particles = createParticles(state, targetsToUse, { x: tower.x, y: tower.y });
      
      if (state.particles.length === 0) {
        // No valid particles created, stay idle
        break;
      }
      
      state.sliceTimer = 0;
      state.state = STATE_ORBITING;
      break;

    case STATE_ORBITING:
      // Update timer
      state.sliceTimer += delta;
      
      // Update particle positions
      const hasTargets = updateOrbitingParticles(playfield, state, delta);
      
      if (!hasTargets) {
        // All targets died, end cycle early
        state.particles = [];
        state.currentTargets = [];
        state.state = STATE_COOLDOWN;
        state.cooldownTimer = state.sliceCooldown;
        break;
      }
      
      // Check if charge time is complete
      if (state.sliceTimer >= state.sliceChargeTime) {
        state.state = STATE_SLICING;
      }
      break;

    case STATE_SLICING:
      // Execute the slice
      executeSlice(playfield, tower, state);
      
      // Clear particles and targets
      state.particles = [];
      state.currentTargets = [];
      
      // Enter cooldown
      state.state = STATE_COOLDOWN;
      state.cooldownTimer = state.sliceCooldown;
      break;

    case STATE_COOLDOWN:
      // Wait for cooldown to finish
      state.cooldownTimer = Math.max(0, state.cooldownTimer - delta);
      
      if (state.cooldownTimer <= 0) {
        state.state = STATE_IDLE;
      }
      break;
  }
}

/**
 * Draw Ω tower particles (golden orbs orbiting enemies).
 */
export function drawOmegaParticles(playfield) {
  const ctx = playfield?.ctx;
  if (!ctx) {
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  playfield.towers.forEach((tower) => {
    if (tower.type !== 'omega' || !tower.omegaState) {
      return;
    }

    const state = tower.omegaState;
    
    state.particles.forEach((particle) => {
      if (particle.opacity <= 0 || !particle.color) {
        return;
      }

      const size = particle.size || 4;
      const { x, y } = particle;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
      const { r, g, b } = particle.color;
      const alpha = clamp(particle.opacity, 0, 1);

      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
      gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${alpha * 0.4})`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  ctx.restore();
}
