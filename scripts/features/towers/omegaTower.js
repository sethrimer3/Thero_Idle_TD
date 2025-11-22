// Ω tower particle orchestration: golden particles orbit enemies, then execute HP% slices.
import { computeTowerVariableValue } from '../../../assets/towersTab.js';
import { metersToPixels } from '../../../assets/gameUnits.js';

// Golden particle colors for Omega tower
const OMEGA_PARTICLE_COLORS = [
  { r: 255, g: 215, b: 0 },   // Gold
  { r: 255, g: 223, b: 128 }, // Light gold
];

// Base configuration constants
const BASE_RANGE_METERS = 7.0;
const BASE_PARTICLES = 8;
const BASE_COOLDOWN_SECONDS = 4.0;
const BASE_SLICE_FRACTION = 0.10; // 10% of max HP
const MAX_SLICE_FRACTION = 0.40;  // Cap at 40% of max HP
const ORBIT_RADIUS_PIXELS = 25;
const ORBIT_ANGULAR_SPEED = Math.PI * 0.8; // radians per second
const CHARGE_PHASE_FRACTION = 0.25; // Shorter charge so slices span the full attack window

// Tower states
const STATE_IDLE = 'IDLE';
const STATE_ORBITING = 'ORBITING';
const STATE_SLICING = 'SLICING';
const STATE_COOLDOWN = 'COOLDOWN';

/**
 * Resolve colors for omega particles from the palette or use fallback.
 */
function resolveOmegaParticleColors() {
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
      sliceInterval: sliceCooldown / particleCount,
      sliceChargeTime,
      priorityMode: omega_priorityMode,
      multiMode: omega_multiMode,
      slicingElapsed: 0,
      slicingIndex: 0,
    };
    tower.omegaState = state;
  } else {
    // Update state with current sub-equation values
    state.particleCount = particleCount;
    state.sliceCooldown = sliceCooldown;
    state.sliceFrac = sliceFrac;
    state.sliceInterval = sliceCooldown / particleCount;
    state.sliceChargeTime = sliceChargeTime;
    state.priorityMode = omega_priorityMode;
    state.multiMode = omega_multiMode;
  }

  // Display the effective slice cadence rather than the full cooldown
  const effectiveSliceSeconds = Math.max(state.sliceInterval, 0.01);
  tower.rate = 1 / effectiveSliceSeconds;
  tower.baseRate = tower.rate;

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
      mode: 'orbit',
      trail: [],
      sliceTimer: 0,
    });
  }

  return particles;
}

/**
 * Update particle positions during orbit phase.
 */
function updateOrbitingParticles(playfield, tower, state, delta) {
  const validParticles = [];

  state.particles.forEach((particle) => {
    if (!particle.target || particle.target.hp <= 0) {
      // Target died, send particle back to tower for idle swirl
      particle.target = null;
      particle.mode = 'return';
    }

    const position = particle.target
      ? playfield.getEnemyPosition(particle.target)
      : { x: tower.x, y: tower.y };
    if (!position) {
      // Target not found
      return;
    }

    // Update angle
    particle.angle += ORBIT_ANGULAR_SPEED * delta;

    // Update position around target
    particle.x = position.x + Math.cos(particle.angle) * particle.orbitRadius;
    particle.y = position.y + Math.sin(particle.angle) * particle.orbitRadius;

    // Comet-like trail while the particle is moving
    particle.trail.push({ x: particle.x, y: particle.y, life: 1 });
    if (particle.trail.length > 16) {
      particle.trail.shift();
    }

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
function executeSlice(playfield, tower, state, particle, targetCounts) {
  if (!particle.target || particle.target.hp <= 0) {
    return;
  }

  const position = playfield.getEnemyPosition(particle.target);
  if (!position) {
    return;
  }

  const distance = Math.hypot(position.x - tower.x, position.y - tower.y);
  if (distance > tower.range) {
    return;
  }

  const maxHP = particle.target.maxHP || particle.target.hp || 0;
  const slicesOnTarget = Math.max(1, targetCounts.get(particle.targetId) || 1);
  const damage = (state.sliceFrac / slicesOnTarget) * maxHP;

  if (damage > 0) {
    particle.target.hp = Math.max(0, particle.target.hp - damage);

    if (typeof playfield.recordDamage === 'function') {
      playfield.recordDamage(tower, particle.target, damage);
    }
  }
}

/**
 * Maintain idle particles swirling around the tower when no enemies are valid.
 */
function updateIdleParticles(playfield, tower, state, delta) {
  if (!playfield || !tower) {
    return;
  }

  if (state.particles.length !== state.particleCount) {
    const colors = resolveOmegaParticleColors();
    state.particles = Array.from({ length: state.particleCount }, (_, idx) => {
      const baseAngle = (2 * Math.PI * idx) / state.particleCount;
      return {
        target: null,
        targetId: null,
        baseAngle,
        angle: baseAngle,
        orbitRadius: ORBIT_RADIUS_PIXELS * 0.6,
        x: tower.x,
        y: tower.y,
        size: 4,
        opacity: 0.9,
        color: colors[idx % colors.length],
        mode: 'idle',
        trail: [],
        sliceTimer: 0,
      };
    });
  }

  state.particles.forEach((particle) => {
    particle.mode = 'idle';
    particle.target = null;
    particle.angle += ORBIT_ANGULAR_SPEED * 0.5 * delta;

    const jitter = 6 * Math.sin(performance.now() * 0.001 + particle.baseAngle);
    particle.x = tower.x + Math.cos(particle.angle) * (particle.orbitRadius + jitter);
    particle.y = tower.y + Math.sin(particle.angle) * (particle.orbitRadius + jitter);

    particle.trail.push({ x: particle.x, y: particle.y, life: 1 });
    if (particle.trail.length > 16) {
      particle.trail.shift();
    }
  });
}

/**
 * Count how many particles are assigned to each target so slices can divide damage.
 */
function countParticlesPerTarget(particles) {
  const counts = new Map();

  particles.forEach((particle) => {
    if (particle.targetId) {
      counts.set(particle.targetId, (counts.get(particle.targetId) || 0) + 1);
    }
  });

  return counts;
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
      updateIdleParticles(playfield, tower, state, delta);

      // Check if cooldown is ready
      if (state.cooldownTimer > 0) {
        state.cooldownTimer = Math.max(0, state.cooldownTimer - delta);
        break;
      }

      // Gather targets and start a new cycle
      const sortedTargets = gatherTargets(playfield, tower, state);

      if (sortedTargets.length === 0) {
        // No enemies in range, keep swirling around the tower
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
      state.slicingElapsed = 0;
      state.slicingIndex = 0;
      state.state = STATE_ORBITING;
      break;

    case STATE_ORBITING:
      // Update timer
      state.sliceTimer += delta;

      // Update particle positions
      const hasTargets = updateOrbitingParticles(playfield, tower, state, delta);

      if (!hasTargets) {
        // All targets died, end cycle early
        state.currentTargets = [];
        state.state = STATE_COOLDOWN;
        state.cooldownTimer = state.sliceCooldown;
        break;
      }

      // Check if charge time is complete
      if (state.sliceTimer >= state.sliceChargeTime) {
        state.slicingElapsed = 0;
        state.slicingIndex = 0;
        state.targetCounts = countParticlesPerTarget(state.particles);
        state.state = STATE_SLICING;
      }
      break;

    case STATE_SLICING:
      // Update slicing schedule
      state.slicingElapsed += delta;

      while (
        state.slicingIndex < state.particles.length &&
        state.slicingElapsed >= state.slicingIndex * state.sliceInterval
      ) {
        const particle = state.particles[state.slicingIndex];

        if (particle) {
          particle.mode = 'slicing';
          particle.sliceTimer = state.sliceInterval * 0.6;
          particle.sliceVector = {
            x: Math.cos(particle.angle + Math.PI / 2) * (ORBIT_RADIUS_PIXELS * 2),
            y: Math.sin(particle.angle + Math.PI / 2) * (ORBIT_RADIUS_PIXELS * 2),
          };
          executeSlice(playfield, tower, state, particle, state.targetCounts);
        }

        state.slicingIndex += 1;
      }

      // Move particles while they slice or orbit
      state.particles.forEach((particle) => {
        if (particle.mode === 'slicing' && particle.sliceTimer > 0) {
          particle.x += (particle.sliceVector?.x || 0) * delta;
          particle.y += (particle.sliceVector?.y || 0) * delta;
          particle.sliceTimer = Math.max(0, particle.sliceTimer - delta);
        } else {
          particle.mode = 'orbit';
          const pos = playfield.getEnemyPosition(particle.target);
          if (pos) {
            particle.angle += ORBIT_ANGULAR_SPEED * delta;
            particle.x = pos.x + Math.cos(particle.angle) * particle.orbitRadius;
            particle.y = pos.y + Math.sin(particle.angle) * particle.orbitRadius;
          }
        }

        particle.trail.push({ x: particle.x, y: particle.y, life: 1 });
        if (particle.trail.length > 16) {
          particle.trail.shift();
        }
      });

      const totalSliceWindow = state.sliceInterval * state.particles.length;
      const finalSliceFinished =
        state.slicingElapsed >= totalSliceWindow &&
        state.particles.every((p) => p.sliceTimer <= 0 || !p.sliceTimer);

      if (finalSliceFinished) {
        state.state = STATE_COOLDOWN;
        state.cooldownTimer = state.sliceCooldown;
      }
      break;

    case STATE_COOLDOWN:
      // Wait for cooldown to finish while swirling around the tower
      updateIdleParticles(playfield, tower, state, delta);

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

      // Comet-like trail
      if (particle.trail && particle.trail.length > 1) {
        ctx.beginPath();
        particle.trail.forEach((point, idx) => {
          const trailAlpha = alpha * (idx / particle.trail.length);
          if (idx === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${trailAlpha * 0.6})`;
          ctx.lineWidth = Math.max(1, size * 0.6 * (idx / particle.trail.length));
        });
        ctx.stroke();
      }

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
