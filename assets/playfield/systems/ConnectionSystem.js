/**
 * ConnectionSystem.js
 * 
 * Manages the lattice connection particle system including:
 * - Connection particles (alpha/beta swirls) orbiting towers
 * - Supply seed projectile trails
 * - Swarm clouds from stored shot impacts
 * - Visual connection effects between linked towers
 * 
 * Extracted from playfield.js as part of Phase 1.1.15 refactoring.
 */

import { easeOutCubic, easeInCubic } from '../utils/math.js';
import { metersToPixels, ALPHA_BASE_RADIUS_FACTOR } from '../../gameUnits.js';

// Shared circle constant for orbit and angular animation calculations in connection visuals.
const TWO_PI = Math.PI * 2;

// Swarm cloud and stored shot constants
const ALPHA_STORED_SHOT_STUN_DURATION = 0.02; // 20 milliseconds
const BETA_STORED_SHOT_STUN_DURATION = 0.1;   // 100 milliseconds
const SWARM_CLOUD_BASE_DURATION = 1.0; // 1 second base
const SWARM_CLOUD_DURATION_PER_SHOT = 0.02; // 20 milliseconds per stored shot
const SWARM_CLOUD_RADIUS_METERS = 0.8; // Localized area for swarming
const SWARM_PARTICLE_FADE_DURATION = 0.6; // Fade out over 600ms
const SWARM_PARTICLE_SPREAD_SPEED = 80; // Pixels per second when dissipating
const SWARM_CLOUD_DAMAGE_MULTIPLIER = 0.5; // Damage dealt by cloud as fraction of base tower damage

/**
 * Factory function creating a connection system instance.
 * @param {Object} playfield - Reference to the playfield instance for accessing state and methods
 * @returns {Object} Connection system interface
 */
export function createConnectionSystem(playfield) {
  /**
   * Update all connection particles across all towers.
   * Manages orbit, arrive, launch, and swarm states.
   */
  function updateConnectionParticles(delta) {
    const step = Math.max(0, delta);
    playfield.towers.forEach((tower) => {
      if (!tower) {
        return;
      }
      const desiredAlpha = Math.max(0, Math.floor(tower.storedAlphaSwirl || 0));
      const desiredBeta = Math.max(0, Math.floor(tower.storedBetaSwirl || 0));
      syncTowerConnectionParticles(tower, 'alpha', desiredAlpha);
      syncTowerConnectionParticles(tower, 'beta', desiredBeta);
      if (!Array.isArray(tower.connectionParticles)) {
        return;
      }
      const particles = tower.connectionParticles.filter((particle) => particle && particle.state !== 'done');
      const newSwarmParticles = [];
      particles.forEach((particle) => {
        if (particle.state === 'launch') {
          updateConnectionLaunchParticle(particle, step);
          // Check if particle just hit and needs to create a swarm cloud
          if (particle.justHit && particle.state === 'swarm') {
            particle.justHit = false;
            newSwarmParticles.push(particle);
          }
          return;
        }
        if (particle.state === 'arrive') {
          updateConnectionArriveParticle(tower, particle, step);
          return;
        }
        if (particle.state === 'swarm') {
          updateConnectionSwarmParticle(particle, step);
          return;
        }
        updateConnectionOrbitParticle(particle, step);
      });
      // Process newly swarming particles to create/update swarm clouds
      if (newSwarmParticles.length > 0) {
        processSwarmParticleHits(tower, newSwarmParticles);
      }
      tower.connectionParticles = particles.filter((particle) => particle && particle.state !== 'done');
    });

    const activeKeys = new Set();
    playfield.towerConnectionMap.forEach((targetId, sourceId) => {
      activeKeys.add(`${sourceId}->${targetId}`);
      const existing = playfield.connectionEffects.find((effect) => effect.key === `${sourceId}->${targetId}`);
      if (!existing) {
        const source = playfield.getTowerById(sourceId);
        const target = playfield.getTowerById(targetId);
        if (source && target) {
          playfield.connectionEffects.push(createConnectionEffect(source, target));
        }
      }
    });
    playfield.connectionEffects = playfield.connectionEffects.filter((effect) => {
      if (!effect || !activeKeys.has(effect.key)) {
        return false;
      }
      const source = playfield.getTowerById(effect.sourceId);
      const target = playfield.getTowerById(effect.targetId);
      if (!source || !target) {
        return false;
      }
      effect.source = source;
      effect.target = target;
      effect.particles.forEach((particle) => {
        particle.progress = (particle.progress || 0) + (particle.speed || 0.35) * step;
        if (particle.progress >= 1) {
          particle.progress -= 1;
        }
      });
      return true;
    });
  }

  /**
   * Ensure a tower maintains the desired number of swirling motes per resource type.
   */
  function syncTowerConnectionParticles(tower, type, desiredCount) {
    if (!tower) {
      return;
    }
    if (!Array.isArray(tower.connectionParticles)) {
      tower.connectionParticles = [];
    }
    const particles = tower.connectionParticles.filter(
      (particle) => particle.type === type && particle.state !== 'done',
    );
    const activeParticles = particles.filter((particle) => particle.state === 'orbit' || particle.state === 'arrive');
    if (activeParticles.length > desiredCount) {
      let toCull = activeParticles.length - desiredCount;
      // Drop the newest orbiters first so capped towers keep their existing motes.
      for (let index = tower.connectionParticles.length - 1; index >= 0 && toCull > 0; index -= 1) {
        const particle = tower.connectionParticles[index];
        if (!particle || particle.type !== type) {
          continue;
        }
        if (particle.state === 'launch' || particle.state === 'done') {
          continue;
        }
        if (particle.state === 'orbit' || particle.state === 'arrive') {
          tower.connectionParticles.splice(index, 1);
          toCull -= 1;
        }
      }
      return;
    }
    if (activeParticles.length < desiredCount) {
      const toAdd = Math.min(desiredCount - activeParticles.length, 60);
      for (let index = 0; index < toAdd; index += 1) {
        tower.connectionParticles.push(
          createConnectionParticle(tower, type, { state: 'arrive' }),
        );
      }
    }
  }

  /**
   * Create a fresh swirling mote configuration for a lattice.
   */
  function createConnectionParticle(tower, type, options = {}) {
    const baseRange = Number.isFinite(tower.range) ? Math.max(20, tower.range * 0.06) : 24;
    const bodyRadius = resolveTowerBodyRadius(tower);
    const defaultOrbit = bodyRadius + 6 + baseRange;
    const orbitRadius = Number.isFinite(options.orbitRadius)
      ? options.orbitRadius
      : defaultOrbit + Math.random() * baseRange * 0.35;
    const particle = {
      type,
      angle: Number.isFinite(options.angle) ? options.angle : Math.random() * TWO_PI,
      speed: Number.isFinite(options.speed) ? options.speed : 1.6 + Math.random() * 0.7,
      distance: orbitRadius - (bodyRadius + 6),
      orbitRadius,
      size: Number.isFinite(options.size) ? options.size : type === 'beta' ? 3.4 : 2.6,
      pulse: Math.random() * TWO_PI,
      state: options.state || 'orbit',
    };
    if (particle.state === 'arrive') {
      const startPosition = options.startPosition || { x: tower.x, y: tower.y };
      particle.position = { ...startPosition };
      particle.arriveStart = { ...startPosition };
      particle.arriveDuration = Number.isFinite(options.arriveDuration)
        ? options.arriveDuration
        : 0.32 + Math.random() * 0.12;
      particle.arriveTime = 0;
    }
    return particle;
  }

  /**
   * Resolve the baseline body radius so orbit math can stay consistent across render scales.
   */
  function resolveTowerBodyRadius(tower) {
    const width = playfield.renderWidth || (playfield.canvas ? playfield.canvas.clientWidth : 0) || 0;
    const height = playfield.renderHeight || (playfield.canvas ? playfield.canvas.clientHeight : 0) || 0;
    const minDimension = width > 0 && height > 0 ? Math.min(width, height) : Math.max(width, height);
    const scale = Math.max(1, minDimension);
    return Math.max(12, scale * ALPHA_BASE_RADIUS_FACTOR);
  }

  /**
   * Keep idle orbit particles spinning in sync with tower cadence.
   */
  function updateConnectionOrbitParticle(particle, step) {
    particle.angle = (particle.angle || 0) + (particle.speed || 1) * step;
    particle.pulse = (particle.pulse || 0) + step;
  }

  /**
   * Blend arriving motes from supply shots into the standard orbit radius.
   */
  function updateConnectionArriveParticle(tower, particle, step) {
    particle.arriveTime = (particle.arriveTime || 0) + step;
    const duration = Number.isFinite(particle.arriveDuration) ? particle.arriveDuration : 0.32;
    const progress = duration > 0 ? Math.min(1, particle.arriveTime / duration) : 1;
    const eased = easeOutCubic(progress);
    const start = particle.arriveStart || { x: tower.x, y: tower.y };
    const target = resolveConnectionOrbitAnchor(tower, particle);
    particle.position = {
      x: start.x + (target.x - start.x) * eased,
      y: start.y + (target.y - start.y) * eased,
    };
    particle.pulse = (particle.pulse || 0) + step;
    if (progress >= 1) {
      particle.state = 'orbit';
      particle.position = null;
      particle.arriveStart = null;
      particle.arriveTime = 0;
    }
  }

  /**
   * Propel spent motes toward their target so stored shots visually discharge.
   */
  function updateConnectionLaunchParticle(particle, step) {
    particle.launchTime = (particle.launchTime || 0) + step;
    const duration = Number.isFinite(particle.launchDuration) ? particle.launchDuration : 0.28;
    const progress = duration > 0 ? Math.min(1, particle.launchTime / duration) : 1;
    const eased = easeInCubic(progress);
    const start = particle.launchStart || particle.position || { x: 0, y: 0 };
    
    // Track the enemy if we have a target enemy ID
    let target = particle.targetPosition || start;
    if (particle.targetEnemyId) {
      const targetEnemy = playfield.enemies.find((enemy) => enemy && enemy.id === particle.targetEnemyId);
      if (targetEnemy) {
        // Update target position to enemy's current position
        const enemyPos = playfield.getEnemyPosition(targetEnemy);
        if (enemyPos) {
          target = enemyPos;
          particle.targetPosition = { ...enemyPos };
        }
      }
    }
    
    particle.position = {
      x: start.x + (target.x - start.x) * eased,
      y: start.y + (target.y - start.y) * eased,
    };
    particle.pulse = (particle.pulse || 0) + step * 1.5;
    if (progress >= 1) {
      // When particle completes its launch, transition to swarm state
      particle.state = 'swarm';
      particle.swarmTime = 0;
      particle.swarmCenter = { ...target };
      particle.swarmAngle = Math.random() * TWO_PI;
      particle.swarmSpeed = 2 + Math.random() * 1.5;
      particle.swarmRadius = 8 + Math.random() * 12;
      // Mark for swarm cloud creation (handled by tower update logic)
      particle.justHit = true;
    }
  }

  /**
   * Update connection particle in swarm state, circling around impact point before dissipating.
   */
  function updateConnectionSwarmParticle(particle, step) {
    if (!particle || particle.state !== 'swarm') {
      return;
    }
    particle.swarmTime = (particle.swarmTime || 0) + step;
    const swarmDuration = Number.isFinite(particle.swarmDuration) ? particle.swarmDuration : 1.2;
    const fadeDuration = Number.isFinite(particle.fadeDuration) ? particle.fadeDuration : SWARM_PARTICLE_FADE_DURATION;
    const totalDuration = swarmDuration + fadeDuration;
    
    if (particle.swarmTime >= totalDuration) {
      particle.state = 'done';
      return;
    }
    
    const center = particle.swarmCenter || { x: 0, y: 0 };
    const angle = (particle.swarmAngle || 0) + (particle.swarmSpeed || 2) * particle.swarmTime;
    const radius = particle.swarmRadius || 10;
    
    // During swarm phase, circle around the impact point
    if (particle.swarmTime < swarmDuration) {
      particle.position = {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      };
      particle.opacity = 0.85;
    } else {
      // During fade phase, spread outward and fade
      const fadeProgress = (particle.swarmTime - swarmDuration) / fadeDuration;
      const spreadDistance = SWARM_PARTICLE_SPREAD_SPEED * (particle.swarmTime - swarmDuration);
      particle.position = {
        x: center.x + Math.cos(angle) * (radius + spreadDistance),
        y: center.y + Math.sin(angle) * (radius + spreadDistance),
      };
      particle.opacity = Math.max(0, 0.85 * (1 - fadeProgress));
    }
    
    particle.pulse = (particle.pulse || 0) + step;
  }

  /**
   * Process particles that just hit enemies to create/update swarm clouds.
   */
  function processSwarmParticleHits(tower, particles) {
    if (!tower || !Array.isArray(particles) || particles.length === 0) {
      return;
    }
    
    // Group particles by their swarm center (impact location)
    const impactGroups = new Map();
    particles.forEach((particle) => {
      if (!particle.swarmCenter) {
        return;
      }
      const key = `${Math.round(particle.swarmCenter.x)}_${Math.round(particle.swarmCenter.y)}`;
      if (!impactGroups.has(key)) {
        impactGroups.set(key, { center: particle.swarmCenter, particles: [], types: {} });
      }
      const group = impactGroups.get(key);
      group.particles.push(particle);
      group.types[particle.type] = (group.types[particle.type] || 0) + 1;
    });
    
    // Create or update swarm clouds for each impact location
    impactGroups.forEach((group) => {
      const alphaCount = group.types.alpha || 0;
      const betaCount = group.types.beta || 0;
      const totalShots = alphaCount + betaCount;
      
      if (totalShots === 0) {
        return;
      }
      
      // Calculate swarm duration based on shot count
      const swarmDuration = SWARM_CLOUD_BASE_DURATION + totalShots * SWARM_CLOUD_DURATION_PER_SHOT;
      
      // Update particle durations to match cloud duration
      group.particles.forEach((particle) => {
        particle.swarmDuration = swarmDuration;
      });
      
      // Find or create swarm cloud
      const minDimension = Math.max(1, Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0));
      const cloudRadius = metersToPixels(SWARM_CLOUD_RADIUS_METERS, minDimension);
      
      playfield.swarmClouds.push({
        position: { ...group.center },
        radius: cloudRadius,
        alphaCount,
        betaCount,
        totalShots,
        duration: swarmDuration,
        lifetime: 0,
        towerId: tower.id,
        damage: tower.damage || 0,
        hitEnemies: new Set(),
      });
      
      // Apply immediate stun to any enemy at the impact location
      const stunDuration = alphaCount * ALPHA_STORED_SHOT_STUN_DURATION + betaCount * BETA_STORED_SHOT_STUN_DURATION;
      if (stunDuration > 0) {
        playfield.enemies.forEach((enemy) => {
          if (!enemy) {
            return;
          }
          const enemyPos = playfield.getEnemyPosition(enemy);
          if (!enemyPos) {
            return;
          }
          const distance = Math.hypot(enemyPos.x - group.center.x, enemyPos.y - group.center.y);
          if (distance <= cloudRadius) {
            playfield.applyStunEffect(enemy, stunDuration, `swarm_${tower.id}`);
          }
        });
      }
    });
  }

  /**
   * Compute the stable orbit anchor without the animated pulse offset.
   */
  function resolveConnectionOrbitAnchor(tower, particle) {
    if (!tower || !particle) {
      return null;
    }
    const bodyRadius = resolveTowerBodyRadius(tower);
    const orbitRadius = Number.isFinite(particle.orbitRadius)
      ? particle.orbitRadius
      : bodyRadius + 6 + (particle.distance || 18);
    const angle = particle.angle || 0;
    return {
      x: tower.x + Math.cos(angle) * orbitRadius,
      y: tower.y + Math.sin(angle) * orbitRadius,
    };
  }

  /**
   * Resolve the animated orbit position including the pulsing offset.
   */
  function resolveConnectionOrbitPosition(tower, particle, bodyRadius) {
    if (!tower || !particle) {
      return null;
    }
    const baseRadius = Number.isFinite(bodyRadius) ? bodyRadius : resolveTowerBodyRadius(tower);
    const orbitRadius = Number.isFinite(particle.orbitRadius)
      ? particle.orbitRadius
      : baseRadius + 6 + (particle.distance || 18);
    const angle = particle.angle || 0;
    const pulse = Math.sin((particle.pulse || 0) * 2) * 2.2;
    const offset = orbitRadius + pulse;
    return {
      x: tower.x + Math.cos(angle) * offset,
      y: tower.y + Math.sin(angle) * offset,
    };
  }

  /**
   * Queue a swirl launch so we can animate the motes once the tower fires.
   */
  function queueTowerSwirlLaunch(tower, type, count) {
    if (!tower || !type || !Number.isFinite(count) || count <= 0) {
      return;
    }
    if (!Array.isArray(tower.pendingSwirlLaunches)) {
      tower.pendingSwirlLaunches = [];
    }
    const existing = tower.pendingSwirlLaunches.find((entry) => entry.type === type);
    if (existing) {
      existing.count += count;
    } else {
      tower.pendingSwirlLaunches.push({ type, count });
    }
  }

  /**
   * Trigger any queued swirl launches toward the resolved attack position.
   */
  function triggerQueuedSwirlLaunches(tower, targetPosition, targetEnemy = null) {
    if (!tower || !Array.isArray(tower.pendingSwirlLaunches) || !tower.pendingSwirlLaunches.length) {
      return;
    }
    if (!targetPosition) {
      tower.pendingSwirlLaunches = [];
      return;
    }
    launchTowerConnectionParticles(tower, tower.pendingSwirlLaunches, targetPosition, targetEnemy);
    tower.pendingSwirlLaunches = [];
  }

  /**
   * Convert orbiting motes into travelling bursts aimed at the provided target.
   */
  function launchTowerConnectionParticles(tower, entries, targetPosition, targetEnemy = null) {
    if (!tower || !Array.isArray(tower.connectionParticles) || !Array.isArray(entries) || !targetPosition) {
      return;
    }
    entries.forEach((entry) => {
      let remaining = Math.max(0, Math.floor(entry?.count || 0));
      if (remaining <= 0) {
        return;
      }
      tower.connectionParticles.forEach((particle) => {
        if (remaining <= 0 || !particle || particle.type !== entry.type) {
          return;
        }
        if (particle.state === 'launch') {
          return;
        }
        if (particle.state === 'orbit' || particle.state === 'arrive') {
          const startPosition =
            particle.state === 'arrive' && particle.position
              ? { ...particle.position }
              : resolveConnectionOrbitPosition(tower, particle);
          if (!startPosition) {
            return;
          }
          particle.state = 'launch';
          particle.launchStart = startPosition;
          particle.position = { ...startPosition };
          particle.targetPosition = { ...targetPosition };
          particle.targetEnemyId = targetEnemy ? targetEnemy.id : null;
          particle.launchTime = 0;
          particle.launchDuration = 0.28 + Math.random() * 0.14;
          remaining -= 1;
        }
      });
    });
  }

  /**
   * Seed supply projectiles with motes that can blend into orbit upon arrival.
   */
  function createSupplySeeds(source, target, payload = {}) {
    if (!source || !target) {
      return [];
    }
    const seeds = [];
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy) || 1;
    const nx = dx / distance;
    const ny = dy / distance;
    const appendSeeds = (count, type) => {
      for (let index = 0; index < count; index += 1) {
        seeds.push({
          type,
          progressOffset: Math.random() * 0.18 + (index / Math.max(1, count)) * 0.1,
          perpendicular: (Math.random() - 0.5) * 10,
          phaseOffset: Math.random() * TWO_PI,
          sway: 3 + Math.random() * 2,
          size: type === 'beta' ? 2.8 : 2.2,
        });
      }
    };

    if (payload.type === 'alpha') {
      appendSeeds(3, 'alpha');
    } else if (payload.type === 'beta') {
      appendSeeds(3, 'beta');
      const alphaShots = Math.max(0, Math.floor(payload.alphaShots || 0));
      if (alphaShots > 0) {
        appendSeeds(Math.min(3 * alphaShots, 12), 'alpha');
      }
    } else if (payload.type === 'gamma') {
      appendSeeds(4, 'beta');
      const betaShots = Math.max(0, Math.floor(payload.betaShots || 0));
      if (betaShots > 0) {
        appendSeeds(Math.min(3 * betaShots, 12), 'beta');
      }
      const alphaShots = Math.max(0, Math.floor(payload.alphaShots || 0));
      if (alphaShots > 0) {
        appendSeeds(Math.min(3 * alphaShots, 12), 'alpha');
      }
    }

    seeds.forEach((seed) => {
      seed.position = { ...source };
    });

    return seeds;
  }

  /**
   * Update supply seed positions so they trail the projectile during flight.
   */
  function updateSupplySeeds(projectile) {
    if (!projectile || !Array.isArray(projectile.seeds) || !projectile.seeds.length) {
      return;
    }
    const { source, target } = projectile;
    if (!source || !target) {
      return;
    }
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy) || 1;
    const nx = dx / distance;
    const ny = dy / distance;
    const px = -ny;
    const py = nx;
    const baseProgress = Math.max(0, projectile.progress || 0);
    projectile.seeds.forEach((seed) => {
      if (!seed) {
        return;
      }
      const offsetProgress = Math.max(0, Math.min(1, baseProgress + (seed.progressOffset || 0)));
      const eased = easeOutCubic(offsetProgress);
      const baseX = source.x + dx * eased;
      const baseY = source.y + dy * eased;
      const sway = Math.sin(baseProgress * 8 + (seed.phaseOffset || 0)) * (seed.sway || 3);
      const lateral = (seed.perpendicular || 0) + sway;
      seed.position = {
        x: baseX + px * lateral,
        y: baseY + py * lateral,
      };
    });
  }

  /**
   * Convert supply projectile seeds into arriving orbit motes at the destination tower.
   */
  function transferSupplySeedsToOrbit(tower, projectile) {
    if (!tower || !projectile || !Array.isArray(projectile.seeds) || !projectile.seeds.length) {
      return;
    }
    if (!Array.isArray(tower.connectionParticles)) {
      tower.connectionParticles = [];
    }
    const bodyRadius = resolveTowerBodyRadius(tower);
    const desiredSwirlCounts = {
      alpha: Math.max(0, Math.floor(tower.storedAlphaSwirl || 0)),
      beta: Math.max(0, Math.floor(tower.storedBetaSwirl || 0)),
    };
    const activeSwirlCounts = { alpha: 0, beta: 0 };
    tower.connectionParticles.forEach((particle) => {
      if (!particle || (particle.type !== 'alpha' && particle.type !== 'beta')) {
        return;
      }
      if (particle.state === 'orbit' || particle.state === 'arrive') {
        activeSwirlCounts[particle.type] += 1;
      }
    });
    projectile.seeds.forEach((seed) => {
      if (!seed) {
        return;
      }
      const type = seed.type === 'beta' ? 'beta' : 'alpha';
      if (activeSwirlCounts[type] >= desiredSwirlCounts[type]) {
        // Ignore surplus arrivals once the tower already displays the target swirl count.
        return;
      }
      const startPosition = seed.position || projectile.target || { x: tower.x, y: tower.y };
      const angle = Math.atan2(startPosition.y - tower.y, startPosition.x - tower.x);
      const orbitRadius = bodyRadius + 6 + Math.random() * Math.max(18, Number.isFinite(tower.range) ? tower.range * 0.06 : 24);
      const particle = createConnectionParticle(tower, type, {
        state: 'arrive',
        startPosition,
        angle,
        orbitRadius,
        arriveDuration: 0.28 + Math.random() * 0.12,
        size: seed.size,
      });
      tower.connectionParticles.push(particle);
      activeSwirlCounts[type] += 1;
    });
  }

  /**
   * Update swarm clouds that persist after stored shots hit enemies.
   */
  function updateSwarmClouds(delta) {
    if (!Array.isArray(playfield.swarmClouds) || playfield.swarmClouds.length === 0) {
      return;
    }
    
    const step = Math.max(0, delta);
    const survivors = [];
    
    playfield.swarmClouds.forEach((cloud) => {
      if (!cloud) {
        return;
      }
      
      cloud.lifetime = (cloud.lifetime || 0) + step;
      
      // Remove expired clouds
      if (cloud.lifetime >= cloud.duration) {
        return;
      }
      
      // Check for enemies entering the cloud
      playfield.enemies.forEach((enemy) => {
        if (!enemy) {
          return;
        }
        
        // Skip enemies we've already hit
        if (cloud.hitEnemies.has(enemy.id)) {
          return;
        }
        
        const enemyPos = playfield.getEnemyPosition(enemy);
        if (!enemyPos) {
          return;
        }
        
        const distance = Math.hypot(enemyPos.x - cloud.position.x, enemyPos.y - cloud.position.y);
        const metrics = playfield.getEnemyVisualMetrics(enemy);
        const enemyRadius = playfield.getEnemyHitRadius(enemy, metrics);
        
        // Check if enemy is within cloud radius
        if (distance <= cloud.radius + enemyRadius) {
          // Apply damage (scaled by shot count)
          const damagePerShot = cloud.damage || 0;
          const totalDamage = damagePerShot * SWARM_CLOUD_DAMAGE_MULTIPLIER;
          
          const tower = playfield.towers.find((t) => t && t.id === cloud.towerId);
          playfield.applyDamageToEnemy(enemy, totalDamage, { sourceTower: tower });
          
          // Apply stun based on shot types
          const stunDuration = cloud.alphaCount * ALPHA_STORED_SHOT_STUN_DURATION + 
                               cloud.betaCount * BETA_STORED_SHOT_STUN_DURATION;
          if (stunDuration > 0) {
            playfield.applyStunEffect(enemy, stunDuration, `swarm_${cloud.towerId}`);
          }
          
          // Mark this enemy as hit by this cloud
          cloud.hitEnemies.add(enemy.id);
        }
      });
      
      survivors.push(cloud);
    });
    
    playfield.swarmClouds = survivors;
  }

  /**
   * Initialize a connection link effect between two lattices.
   */
  function createConnectionEffect(source, target) {
    return {
      key: `${source.id}->${target.id}`,
      sourceId: source.id,
      targetId: target.id,
      source,
      target,
      particles: Array.from({ length: 3 }, () => ({
        progress: Math.random(),
        speed: 0.35 + Math.random() * 0.25,
      })),
    };
  }

  // Export the connection system interface
  return {
    updateConnectionParticles,
    syncTowerConnectionParticles,
    createConnectionParticle,
    resolveTowerBodyRadius,
    updateConnectionOrbitParticle,
    updateConnectionArriveParticle,
    updateConnectionLaunchParticle,
    updateConnectionSwarmParticle,
    processSwarmParticleHits,
    resolveConnectionOrbitAnchor,
    resolveConnectionOrbitPosition,
    queueTowerSwirlLaunch,
    triggerQueuedSwirlLaunches,
    launchTowerConnectionParticles,
    createSupplySeeds,
    updateSupplySeeds,
    transferSupplySeedsToOrbit,
    updateSwarmClouds,
    createConnectionEffect,
  };
}
