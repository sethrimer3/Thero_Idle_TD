/**
 * Decimal Swarm System
 *
 * Manages the galaxy-like particle cloud surrounding "decimal-swarm" enemies.
 *
 * Physics overview:
 *  - 100 white dot particles orbit the enemy core with differential galaxy rotation.
 *    Inner particles spin faster following Keplerian scaling: ω ∝ r^{−0.5}
 *  - Particle density is higher near the centre (power-law distribution).
 *  - Each particle absorbs one single-target projectile on contact.
 *  - Area-type attacks (iota pulse, psi AoE) remove all particles within their radius.
 *  - θ (theta) fields halve the rotational speed of orbital particles within range,
 *    and halve the movement speed of free (flung) particles within range.
 *  - On host defeat, particles are flung outward along their tangential velocity
 *    plus a small radial boost, and despawn when they leave the playing field.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

// Number of orbiting particles spawned with each decimal-swarm enemy.
const PARTICLE_COUNT = 100;

// Innermost and outermost orbital radii in canvas pixels.
const INNER_RADIUS_PX = 10;
const OUTER_RADIUS_PX = 56;

// Angular speed at INNER_RADIUS_PX orbit in radians per second.
// Outer particles scale via ω(r) = INNER_ORBIT_OMEGA * sqrt(INNER_RADIUS_PX / r).
const INNER_ORBIT_OMEGA = 3.0; // ≈ 0.48 rev/s at the innermost orbit

// Collision detection radius for a single particle (canvas pixels).
// Generous so brief intersections are not missed.
export const PARTICLE_HIT_RADIUS = 4;

// Fallback hit radius used when a projectile does not carry its own hitRadius.
// Matches the generic fallback used throughout the projectile update system.
export const DEFAULT_PROJECTILE_HIT_RADIUS = 3;

// Visual dot radius for rendering each particle (canvas pixels).
const PARTICLE_RENDER_RADIUS = 2;

// Minimum outward boost (px/s) applied when flinging particles on host death.
const FLING_MIN_RADIAL_BOOST = 40;

// Fraction of tangential speed added as an extra radial boost on fling.
const FLING_RADIAL_FRACTION = 0.2;

const TWO_PI = Math.PI * 2;

// ─── Initialisation ───────────────────────────────────────────────────────────

/**
 * Initialise the galaxy particle cloud for a decimal-swarm enemy.
 *
 * Distributes PARTICLE_COUNT particles with higher density near the centre
 * using a power-law transform: u ~ Uniform → r = INNER + (OUTER − INNER) * u²
 * This concentrates more particles near the core, matching a galaxy profile.
 *
 * @param {object} enemy - The decimal-swarm enemy being initialised.
 */
export function initDecimalSwarmParticles(enemy) {
  if (!enemy) {
    return;
  }
  const particles = [];
  const rRange = OUTER_RADIUS_PX - INNER_RADIUS_PX;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Squaring the uniform variate concentrates particles near the centre.
    const u = Math.random();
    const r = INNER_RADIUS_PX + rRange * u * u;
    const angle = Math.random() * TWO_PI;
    // Keplerian angular speed: ω(r) = INNER_ORBIT_OMEGA * sqrt(INNER_RADIUS / r)
    const baseOmega = INNER_ORBIT_OMEGA * Math.sqrt(INNER_RADIUS_PX / r);
    particles.push({ r, angle, baseOmega, omega: baseOmega });
  }
  enemy.decimalSwarmState = { particles };
}

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Advance all orbital decimal-swarm particles for one simulation step.
 *
 * For each particle the function:
 *  1. Computes the particle's world-space canvas position.
 *  2. Checks whether that position falls inside any active theta tower field.
 *  3. Sets the effective angular speed to baseOmega * 0.5 when slowed, otherwise baseOmega.
 *  4. Advances the particle's angle by ω × delta.
 *
 * Call this once per frame while combat is active.
 *
 * @param {number} delta - Frame delta in seconds.
 */
export function updateDecimalSwarmOrbitalParticles(delta) {
  if (!Array.isArray(this.enemies)) {
    return;
  }
  // Gather active theta towers once to avoid repeated filtering inside the inner loop.
  const thetaTowers = Array.isArray(this.towers)
    ? this.towers.filter((t) => t && t.type === 'theta' && t.thetaState && t.thetaState.rangePixels > 0)
    : [];

  this.enemies.forEach((enemy) => {
    if (!enemy || !enemy.decimalSwarmState) {
      return;
    }
    const { particles } = enemy.decimalSwarmState;
    if (!Array.isArray(particles) || !particles.length) {
      return;
    }
    const pos = this.getEnemyPosition(enemy);
    if (!pos) {
      return;
    }

    particles.forEach((p) => {
      // Compute world-space position of this particle.
      const cosA = Math.cos(p.angle);
      const sinA = Math.sin(p.angle);
      const wx = pos.x + p.r * cosA;
      const wy = pos.y + p.r * sinA;

      // Theta field check: any tower whose range covers this particle's position.
      let slowed = false;
      for (const tower of thetaTowers) {
        const range = tower.thetaState.rangePixels;
        const dx = wx - tower.x;
        const dy = wy - tower.y;
        if (dx * dx + dy * dy <= range * range) {
          slowed = true;
          break;
        }
      }

      // Apply half-speed when inside a theta field.
      p.omega = slowed ? p.baseOmega * 0.5 : p.baseOmega;

      // Advance the orbital angle.
      p.angle = (p.angle + p.omega * delta) % TWO_PI;
    });
  });
}

/**
 * Move all free (flung) decimal-swarm particles for one simulation step.
 *
 * Free particles maintain their own canvas-pixel position and velocity.
 * They are removed once they exit the canvas bounds (with a small margin).
 * θ fields halve their movement speed while they remain within range.
 *
 * Call this once per frame while combat is active.
 *
 * @param {number} delta - Frame delta in seconds.
 */
export function updateDecimalSwarmFreeParticles(delta) {
  if (!Array.isArray(this.decimalSwarmFreeParticles) || !this.decimalSwarmFreeParticles.length) {
    return;
  }
  const w = this.renderWidth || 0;
  const h = this.renderHeight || 0;
  const margin = OUTER_RADIUS_PX * 2;

  // Gather active theta towers once.
  const thetaTowers = Array.isArray(this.towers)
    ? this.towers.filter((t) => t && t.type === 'theta' && t.thetaState && t.thetaState.rangePixels > 0)
    : [];

  for (let i = this.decimalSwarmFreeParticles.length - 1; i >= 0; i--) {
    const p = this.decimalSwarmFreeParticles[i];
    if (!p) {
      this.decimalSwarmFreeParticles.splice(i, 1);
      continue;
    }

    // Check theta field influence on this free particle.
    let slowed = false;
    for (const tower of thetaTowers) {
      const range = tower.thetaState.rangePixels;
      const dx = p.x - tower.x;
      const dy = p.y - tower.y;
      if (dx * dx + dy * dy <= range * range) {
        slowed = true;
        break;
      }
    }

    // Move at half speed inside a theta field (does not modify stored velocity).
    const speedMult = slowed ? 0.5 : 1.0;
    p.x += p.vx * speedMult * delta;
    p.y += p.vy * speedMult * delta;

    // Remove once the particle has left the playing field.
    if (p.x < -margin || p.x > w + margin || p.y < -margin || p.y > h + margin) {
      this.decimalSwarmFreeParticles.splice(i, 1);
    }
  }
}

// ─── Host-defeat handling ─────────────────────────────────────────────────────

/**
 * Convert all remaining orbital particles into free-flying particles when the
 * host decimal-swarm enemy is defeated.
 *
 * Each particle's tangential speed at the moment of death becomes its initial
 * velocity, directed perpendicularly to its orbital radius.  A small outward
 * radial component is also added so the cloud visibly expands.
 *
 * @param {object} enemy - The defeated decimal-swarm enemy.
 */
export function flingDecimalSwarmParticles(enemy) {
  if (!enemy || !enemy.decimalSwarmState) {
    return;
  }
  if (!Array.isArray(this.decimalSwarmFreeParticles)) {
    this.decimalSwarmFreeParticles = [];
  }
  const { particles } = enemy.decimalSwarmState;
  if (!Array.isArray(particles) || !particles.length) {
    return;
  }
  const pos = this.getEnemyPosition(enemy);
  if (!pos) {
    return;
  }

  particles.forEach((p) => {
    // Compute world-space position of the particle at the moment of death.
    const cosA = Math.cos(p.angle);
    const sinA = Math.sin(p.angle);
    const wx = pos.x + p.r * cosA;
    const wy = pos.y + p.r * sinA;

    // Tangential velocity direction (perpendicular to radius in the direction of rotation).
    const tangX = -sinA;
    const tangY = cosA;
    const tangSpeed = p.r * p.omega;

    // Radial outward direction with a minimum boost for clearly visible outward motion.
    const radX = cosA;
    const radY = sinA;
    const radialBoost = tangSpeed * FLING_RADIAL_FRACTION + FLING_MIN_RADIAL_BOOST;

    this.decimalSwarmFreeParticles.push({
      x: wx,
      y: wy,
      vx: tangX * tangSpeed + radX * radialBoost,
      vy: tangY * tangSpeed + radY * radialBoost,
    });
  });

  // Clear the enemy's particle state so the cloud is not drawn again.
  enemy.decimalSwarmState = null;
}

// ─── Area-attack particle removal ─────────────────────────────────────────────

/**
 * Remove all decimal-swarm particles (orbital and free) within a given canvas-pixel radius.
 *
 * Used by area-type attacks such as the iota pulse and psi AoE explosion so
 * that a well-placed blast strips the particle shield without targeting it directly.
 *
 * @param {number} cx - Centre x in canvas pixels.
 * @param {number} cy - Centre y in canvas pixels.
 * @param {number} radius - Removal radius in canvas pixels.
 */
export function removeDecimalSwarmParticlesInRadius(cx, cy, radius) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !(radius > 0)) {
    return;
  }
  const r2 = radius * radius;

  // Orbital particles attached to living enemies.
  if (Array.isArray(this.enemies)) {
    this.enemies.forEach((enemy) => {
      if (!enemy || !enemy.decimalSwarmState) {
        return;
      }
      const { particles } = enemy.decimalSwarmState;
      if (!Array.isArray(particles)) {
        return;
      }
      const pos = this.getEnemyPosition(enemy);
      if (!pos) {
        return;
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (!p) {
          continue;
        }
        const wx = pos.x + p.r * Math.cos(p.angle);
        const wy = pos.y + p.r * Math.sin(p.angle);
        const dx = wx - cx;
        const dy = wy - cy;
        if (dx * dx + dy * dy <= r2) {
          particles.splice(i, 1);
        }
      }
    });
  }

  // Free particles no longer attached to a host.
  if (Array.isArray(this.decimalSwarmFreeParticles)) {
    for (let i = this.decimalSwarmFreeParticles.length - 1; i >= 0; i--) {
      const p = this.decimalSwarmFreeParticles[i];
      if (!p) {
        continue;
      }
      const dx = p.x - cx;
      const dy = p.y - cy;
      if (dx * dx + dy * dy <= r2) {
        this.decimalSwarmFreeParticles.splice(i, 1);
      }
    }
  }
}

// ─── Projectile interception ───────────────────────────────────────────────────

/**
 * Check whether a projectile's current canvas-pixel position overlaps any
 * decimal-swarm particle.  If it does, the particle is consumed and the
 * function returns `true`, signalling the caller to also remove the projectile.
 *
 * Both orbital particles (around living enemies) and free (flung) particles
 * are checked, so the cloud remains dangerous even after the host is defeated.
 *
 * @param {object} projectile - The projectile to check.
 * @param {object} pos - Current canvas-pixel position { x, y } of the projectile.
 * @returns {boolean} `true` if a particle absorbed the projectile.
 */
export function tryInterceptDecimalSwarmParticle(projectile, pos) {
  if (!projectile || !pos) {
    return false;
  }
  const projX = pos.x;
  const projY = pos.y;
  // Combine particle hit radius with the projectile's own hit radius.
  const intercept = PARTICLE_HIT_RADIUS + Math.max(0, Number.isFinite(projectile.hitRadius) ? projectile.hitRadius : DEFAULT_PROJECTILE_HIT_RADIUS);
  const r2 = intercept * intercept;

  // Check orbital particles first (host still alive).
  if (Array.isArray(this.enemies)) {
    for (const enemy of this.enemies) {
      if (!enemy || !enemy.decimalSwarmState) {
        continue;
      }
      const { particles } = enemy.decimalSwarmState;
      if (!Array.isArray(particles) || !particles.length) {
        continue;
      }
      const epos = this.getEnemyPosition(enemy);
      if (!epos) {
        continue;
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (!p) {
          continue;
        }
        const wx = epos.x + p.r * Math.cos(p.angle);
        const wy = epos.y + p.r * Math.sin(p.angle);
        const dx = wx - projX;
        const dy = wy - projY;
        if (dx * dx + dy * dy <= r2) {
          particles.splice(i, 1);
          return true;
        }
      }
    }
  }

  // Check free (flung) particles.
  if (Array.isArray(this.decimalSwarmFreeParticles)) {
    for (let i = this.decimalSwarmFreeParticles.length - 1; i >= 0; i--) {
      const p = this.decimalSwarmFreeParticles[i];
      if (!p) {
        continue;
      }
      const dx = p.x - projX;
      const dy = p.y - projY;
      if (dx * dx + dy * dy <= r2) {
        this.decimalSwarmFreeParticles.splice(i, 1);
        return true;
      }
    }
  }

  return false;
}

// ─── Rendering ────────────────────────────────────────────────────────────────

/**
 * Draw all decimal-swarm particles (orbital and free-flying) as small white dots.
 *
 * Designed to be called via `.call(renderer)` where `renderer` is a
 * CanvasRenderer / SimplePlayfield instance, following the established pattern
 * for extracted render functions.
 */
export function drawDecimalSwarmParticles() {
  if (!this.ctx) {
    return;
  }
  const hasOrbital = Array.isArray(this.enemies)
    && this.enemies.some((e) => e?.decimalSwarmState?.particles?.length);
  const hasFree = Array.isArray(this.decimalSwarmFreeParticles)
    && this.decimalSwarmFreeParticles.length > 0;

  if (!hasOrbital && !hasFree) {
    return;
  }

  const ctx = this.ctx;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';

  // Draw particles orbiting living enemies.
  if (hasOrbital) {
    this.enemies.forEach((enemy) => {
      if (!enemy || !enemy.decimalSwarmState) {
        return;
      }
      const { particles } = enemy.decimalSwarmState;
      if (!Array.isArray(particles) || !particles.length) {
        return;
      }
      const pos = this.getEnemyPosition(enemy);
      if (!pos) {
        return;
      }
      particles.forEach((p) => {
        const wx = pos.x + p.r * Math.cos(p.angle);
        const wy = pos.y + p.r * Math.sin(p.angle);
        ctx.beginPath();
        ctx.arc(wx, wy, PARTICLE_RENDER_RADIUS, 0, TWO_PI);
        ctx.fill();
      });
    });
  }

  // Draw free-flying particles whose host has been defeated.
  if (hasFree) {
    this.decimalSwarmFreeParticles.forEach((p) => {
      if (!p) {
        return;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, PARTICLE_RENDER_RADIUS, 0, TWO_PI);
      ctx.fill();
    });
  }

  ctx.restore();
}
