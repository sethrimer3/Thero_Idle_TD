// α tower particle system isolates visual math so playfield orchestration stays lean.
import { metersToPixels } from '../../../assets/gameUnits.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

// Soft energy palette alternates between magenta and cyan to keep α resonant.
const ALPHA_PARTICLE_COLORS = [
  { r: 255, g: 138, b: 216 },
  { r: 138, g: 247, b: 255 },
];

// Offsets define where α samples the active palette gradient so bursts pick up both endpoints.
const ALPHA_COLOR_OFFSETS = [0.18, 0.82];

// Normalize palette-derived colors to particle-friendly RGB objects.
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

// Pull two hues from the shared gradient so α motes echo the global palette while retaining a fallback.
function resolveAlphaParticleColors() {
  const colors = ALPHA_COLOR_OFFSETS.map((offset) => normalizeParticleColor(samplePaletteGradient(offset))).filter(Boolean);
  if (colors.length >= 2) {
    return colors;
  }
  return ALPHA_PARTICLE_COLORS.map((entry) => ({ ...entry }));
}

// Configuration block keeps α burst behavior, particle palette, and timing tuned.
const ALPHA_PARTICLE_CONFIG = {
  towerType: 'alpha',
  stateKey: 'alphaState',
  burstListKey: 'alphaBursts',
  idPrefix: 'alpha',
  colors: ALPHA_PARTICLE_COLORS,
  colorResolver: resolveAlphaParticleColors,
  behavior: 'swirlBounce',
  homing: true,
  particleCountRange: { min: 5, max: 10 },
  dashDelayRange: 0.08,
  timings: {
    swirl: { base: 0.32, variance: 0.18 },
    charge: { base: 0.1, variance: 0.08 },
    dash: { base: 0.26, variance: 0.14 },
  },
};

// Ease helpers keep the spiral motion feeling fluid and controlled.
const easeInCubic = (value) => value * value * value;
const easeOutCubic = (value) => {
  const inverted = 1 - value;
  return 1 - inverted * inverted * inverted;
};

let burstIdCounter = 0;

// Clamp helper keeps eased transitions within the unit interval.
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Random integer helper keeps particle count ranges declarative per tower.
function randomInt(min, max) {
  const safeMin = Number.isFinite(min) ? Math.floor(min) : 0;
  const safeMax = Number.isFinite(max) ? Math.floor(max) : safeMin;
  if (safeMax <= safeMin) {
    return safeMin;
  }
  return safeMin + Math.floor(Math.random() * (safeMax - safeMin + 1));
}

// Timing helper samples burst phase durations from the configured ranges.
function resolveTiming(range = {}) {
  const base = Number.isFinite(range.base) ? range.base : 0;
  const variance = Number.isFinite(range.variance) ? Math.max(0, range.variance) : 0;
  return base + Math.random() * variance;
}

// Convert α tower radius from meters to pixels so particle envelopes track canvas scale.
function resolveTowerRadiusPixels(playfield, tower) {
  const width = playfield?.renderWidth || 0;
  const height = playfield?.renderHeight || 0;
  const minDimension = Math.min(width, height) || 1;
  const radiusMeters = Number.isFinite(tower?.definition?.radiusMeters)
    ? tower.definition.radiusMeters
    : Number.isFinite(tower?.radiusMeters)
    ? tower.radiusMeters
    : 0.5;
  const resolved = metersToPixels(Math.max(0.25, radiusMeters), minDimension);
  return Math.max(12, resolved);
}

// Resolve the palette to use for the next burst, falling back to the legacy cyan-magenta pairing when needed.
function resolveBurstPalette(playfield, tower, burst, config, particleCount) {
  let palette = null;
  if (config && typeof config.colorResolver === 'function') {
    try {
      palette = config.colorResolver({ playfield, tower, burst, particleCount });
    } catch (error) {
      console.warn('Failed to resolve particle colors for tower burst', error);
    }
  }
  if (!Array.isArray(palette) || !palette.length) {
    palette = Array.isArray(config?.colors) && config.colors.length ? config.colors : ALPHA_PARTICLE_COLORS;
  }
  const normalized = palette
    .map((entry) => normalizeParticleColor(entry))
    .filter(Boolean);
  if (normalized.length) {
    return normalized;
  }
  return ALPHA_PARTICLE_COLORS.map((entry) => ({ ...entry }));
}

// Spawn soft energy motes along the tower circumference to seed the swirl animation.
function createParticleCloud(playfield, tower, burst) {
  const baseRadius = resolveTowerRadiusPixels(playfield, tower);
  const config = burst?.config || ALPHA_PARTICLE_CONFIG;
  const range = config.particleCountRange || {};
  const minCount = Number.isFinite(range.min) ? range.min : 5;
  const maxCount = Number.isFinite(range.max) ? range.max : Math.max(minCount, 10);
  const particleCount = Math.max(1, randomInt(minCount, maxCount));
  const palette = resolveBurstPalette(playfield, tower, burst, config, particleCount);
  const particles = [];
  for (let index = 0; index < particleCount; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const color = palette[index % palette.length];
    const dashDelayCap = Number.isFinite(config.dashDelayRange)
      ? Math.max(0, config.dashDelayRange)
      : 0.08;
    particles.push({
      angle,
      initialAngle: angle,
      angularVelocity: (Math.random() * 1.4 + 0.8) * (Math.random() < 0.5 ? -1 : 1),
      swirlOffset: Math.random() * 0.35,
      swirlSeed: Math.random() * Math.PI * 2,
      direction: Math.random() < 0.5 ? -1 : 1,
      baseRadius,
      size: baseRadius * (0.18 + Math.random() * 0.08),
      opacity: 0,
      state: 'swirl',
      dashDelay: Math.random() * dashDelayCap,
      bounceDuration: 0.32 + Math.random() * 0.18,
      fadeDuration: 0.18 + Math.random() * 0.12,
      color,
      lineIndex: index,
      totalParticles: particleCount,
      position: {
        x: burst.origin.x + Math.cos(angle) * baseRadius,
        y: burst.origin.y + Math.sin(angle) * baseRadius,
      },
    });
  }
  return particles;
}

// Resolve an enemy's latest position so particles know where to converge or ricochet.
function resolveTarget(playfield, burst) {
  if (!playfield || !burst) {
    return { position: burst?.fallbackTarget || burst?.origin, alive: false, retargeted: false };
  }
  if (burst.targetId) {
    const enemy = playfield.enemies.find((candidate) => candidate.id === burst.targetId);
    if (enemy) {
      const position = playfield.getEnemyPosition(enemy);
      const alive = Number.isFinite(enemy.hp) ? enemy.hp > 0 : true;
      return { position, alive, enemy, retargeted: false };
    }
  }
  const config = burst.config || {};
  const allowHoming = Boolean(config.homing);
  if (allowHoming && typeof playfield.getTowerById === 'function' && typeof playfield.findTarget === 'function') {
    const tower = playfield.getTowerById(burst.towerId);
    if (tower) {
      const nextTarget = playfield.findTarget(tower);
      const enemy = nextTarget?.enemy;
      const position = nextTarget?.position || (enemy ? playfield.getEnemyPosition(enemy) : null);
      const alive = enemy ? (Number.isFinite(enemy.hp) ? enemy.hp > 0 : true) : false;
      if (enemy && position && alive) {
        burst.targetId = enemy.id;
        burst.fallbackTarget = { ...position };
        return { position, alive: true, enemy, retargeted: true };
      }
    }
  }
  return { position: burst.fallbackTarget || burst.origin, alive: false, retargeted: false };
}

// Drive the initial circular swirl that collapses particles toward α's core.
function updateSwirlPhase(burst, delta) {
  const duration = burst.swirlDuration;
  const progress = duration > 0 ? clamp(burst.phaseTime / duration, 0, 1) : 1;
  const eased = easeOutCubic(progress);
  burst.particles.forEach((particle) => {
    const localProgress = clamp(eased + particle.swirlOffset * 0.6, 0, 1);
    const localEase = easeOutCubic(localProgress);
    const radius = Math.max(4, particle.baseRadius * (1 - localEase));
    const swirl = Math.sin((burst.phaseTime + particle.swirlSeed) * 4) * particle.baseRadius * 0.08;
    const angle =
      particle.initialAngle +
      particle.angularVelocity * burst.phaseTime * Math.PI +
      particle.direction * localEase * Math.PI * 1.2;
    particle.position = {
      x: burst.origin.x + Math.cos(angle) * (radius + swirl),
      y: burst.origin.y + Math.sin(angle) * (radius + swirl),
    };
    const focusRatio = 1 - radius / (particle.baseRadius || 1);
    particle.opacity = clamp(0.25 + focusRatio * 0.75, 0, 1);
    particle.renderSize = particle.size * clamp(0.6 + focusRatio * 0.8, 0.4, 1.25);
  });
  if (progress >= 1) {
    burst.phase = 'charge';
    burst.phaseTime = 0;
    burst.particles.forEach((particle) => {
      particle.state = 'charge';
      particle.chargeRadius = particle.size * (0.4 + Math.random() * 0.4);
      particle.chargeAngle = Math.random() * Math.PI * 2;
    });
  }
}

// Hold particles briefly near the center to build tension before the firing vector forms.
function updateChargePhase(burst, delta) {
  const duration = burst.chargeDuration;
  const progress = duration > 0 ? clamp(burst.phaseTime / duration, 0, 1) : 1;
  burst.particles.forEach((particle) => {
    const wobble = Math.sin((burst.phaseTime + particle.swirlSeed) * 8) * particle.size * 0.3;
    const radius = particle.chargeRadius + wobble;
    const angle = particle.chargeAngle + particle.direction * progress * Math.PI * 1.5;
    particle.position = {
      x: burst.origin.x + Math.cos(angle) * radius,
      y: burst.origin.y + Math.sin(angle) * radius,
    };
    particle.opacity = 0.85;
    particle.renderSize = particle.size * 0.85;
  });
  if (progress >= 1) {
    burst.phase = 'dash';
    burst.phaseTime = 0;
    burst.particles.forEach((particle) => {
      particle.state = 'dash';
      particle.dashProgress = 0;
      particle.start = { ...particle.position };
      particle.dashRetargetTime = particle.dashDelay;
      particle.renderSize = particle.size;
    });
  }
}

// Fade state pulls particles inward when the enemy collapses before a ricochet.
function enterFadeState(particle, targetPosition) {
  particle.state = 'fade';
  particle.fadeTime = 0;
  particle.opacity = 0.9;
  particle.position = { ...targetPosition };
}

// Bounce state spins particles away from the enemy when it survives the impact.
function enterBounceState(particle, targetPosition, pathAngle) {
  particle.state = 'bounce';
  particle.bounceTime = 0;
  particle.position = { ...targetPosition };
  const deflect = pathAngle + (Math.random() - 0.5) * Math.PI * 0.9;
  const speed = 150 + Math.random() * 90;
  particle.bounceVelocity = {
    x: Math.cos(deflect) * speed,
    y: Math.sin(deflect) * speed,
  };
}

// Laser pierce state keeps Γ motes marching straight through their targets.
function enterPierceState(particle, targetPosition, pathAngle, burst) {
  const config = burst?.config || {};
  const laser = config.laser || {};
  const minExtension = Number.isFinite(laser.minExtension) ? laser.minExtension : 160;
  const maxExtension = Number.isFinite(laser.maxExtension) ? laser.maxExtension : minExtension;
  const extraDistance = Math.max(minExtension, randomInt(minExtension, maxExtension));
  const staticDuration = Number.isFinite(laser.staticDuration) ? Math.max(0, laser.staticDuration) : null;
  const speed = Number.isFinite(laser.speed) ? Math.max(0, laser.speed) : 720;
  const usePierceState = speed > 0 || staticDuration !== null;
  particle.state = usePierceState ? 'pierce' : 'fade';
  particle.position = { ...(targetPosition || particle.position || { x: 0, y: 0 }) };
  particle.opacity = 1;
  particle.renderSize = particle.size * 1.2;
  particle.pierceTime = 0;
  particle.pierceDistance = extraDistance;
  particle.pierceSpeed = speed;
  particle.pierceDirection = {
    x: Math.cos(pathAngle),
    y: Math.sin(pathAngle),
  };
  const fadeDuration = Number.isFinite(laser.fadeDuration) ? laser.fadeDuration : particle.fadeDuration;
  particle.fadeDuration = Number.isFinite(fadeDuration) ? fadeDuration : 0.22;
  if (speed > 0) {
    particle.pierceDuration = extraDistance / speed;
  } else if (staticDuration !== null) {
    particle.pierceDuration = staticDuration;
  }
  if (!usePierceState) {
    particle.state = 'fade';
    particle.fadeTime = 0;
  }
}

// Advance ricocheting motes while damping their velocity for a soft dissipation.
function updateBounceParticle(particle, delta) {
  particle.bounceTime += delta;
  const duration = particle.bounceDuration || 0.3;
  particle.position.x += particle.bounceVelocity.x * delta;
  particle.position.y += particle.bounceVelocity.y * delta;
  const decay = Math.exp(-delta * 2.4);
  particle.bounceVelocity.x *= decay;
  particle.bounceVelocity.y *= decay;
  const progress = duration > 0 ? clamp(particle.bounceTime / duration, 0, 1) : 1;
  particle.opacity = clamp(0.95 * (1 - progress), 0, 1);
  particle.renderSize = particle.size * (1.1 + progress * 0.6);
  if (progress >= 1) {
    particle.state = 'done';
    particle.opacity = 0;
  }
}

// Expand dissolving particles and fade them out when no enemy remains.
function updateFadeParticle(particle, delta) {
  particle.fadeTime += delta;
  const duration = particle.fadeDuration || 0.2;
  const progress = duration > 0 ? clamp(particle.fadeTime / duration, 0, 1) : 1;
  particle.opacity = clamp(0.85 * (1 - progress), 0, 1);
  particle.renderSize = particle.size * (1.2 + progress * 0.4);
  if (progress >= 1) {
    particle.state = 'done';
    particle.opacity = 0;
  }
}

// Maintain Γ laser motes so their line continues beyond the enemy hitbox.
function updatePierceParticle(particle, delta) {
  particle.pierceTime = (particle.pierceTime || 0) + delta;
  const duration = particle.pierceDuration || 0;
  const speed = Number.isFinite(particle.pierceSpeed) ? particle.pierceSpeed : 0;
  const direction = particle.pierceDirection || { x: 1, y: 0 };
  if (speed > 0) {
    particle.position.x += direction.x * speed * delta;
    particle.position.y += direction.y * speed * delta;
  }
  const progress = duration > 0 ? clamp(particle.pierceTime / duration, 0, 1) : 1;
  particle.opacity = clamp(0.9 - progress * 0.5, 0, 1);
  particle.renderSize = particle.size * (1.25 - progress * 0.25);
  if (progress >= 1 || particle.opacity <= 0) {
    particle.state = 'fade';
    particle.fadeTime = 0;
  }
}

// Guide particles from the tower core toward the target and hand off to bounce/fade states.
function updateDashPhase(playfield, burst, delta) {
  const { position: resolvedTarget, alive, retargeted } = resolveTarget(playfield, burst);
  const targetPosition = resolvedTarget || burst.fallbackTarget || burst.origin || { x: 0, y: 0 };
  const behavior = burst?.config?.behavior || 'swirlBounce';
  if (retargeted) {
    retargetBurstParticles(burst, targetPosition);
  }
  let unfinished = false;
  burst.particles.forEach((particle) => {
    if (particle.state === 'dash') {
      const dashAnchor = Number.isFinite(particle.dashRetargetTime)
        ? particle.dashRetargetTime
        : particle.dashDelay;
      const elapsed = Math.max(0, burst.phaseTime - dashAnchor);
      const progress = burst.dashDuration > 0 ? clamp(elapsed / burst.dashDuration, 0, 1) : 1;
      particle.dashProgress = progress;
      if (progress <= 0) {
        unfinished = true;
        return;
      }
      const start = particle.start || burst.origin || targetPosition;
      const dx = targetPosition.x - start.x;
      const dy = targetPosition.y - start.y;
      const pathAngle = Math.atan2(dy, dx);
      if (behavior === 'pierceLaser') {
        const distance = Math.hypot(dx, dy);
        const eased = easeInCubic(progress);
        const directionX = distance > 0 ? dx / distance : Math.cos(pathAngle);
        const directionY = distance > 0 ? dy / distance : Math.sin(pathAngle);
        const travel = distance * eased;
        particle.position = {
          x: start.x + directionX * travel,
          y: start.y + directionY * travel,
        };
        particle.opacity = 1;
        particle.renderSize = particle.size * (1 + eased * 0.6);
        if (progress >= 1) {
          enterPierceState(particle, targetPosition, pathAngle, burst);
        }
        unfinished = true;
        return;
      }
      const eased = easeInCubic(progress);
      const baseX = start.x + dx * eased;
      const baseY = start.y + dy * eased;
      const spin = Math.sin((progress + particle.swirlSeed) * Math.PI * 2) * particle.size * 0.9;
      const offsetAngle = pathAngle + Math.PI / 2;
      const offsetMagnitude = (1 - eased) * particle.size * 2.2 + spin;
      particle.position = {
        x: baseX + Math.cos(offsetAngle) * offsetMagnitude,
        y: baseY + Math.sin(offsetAngle) * offsetMagnitude,
      };
      particle.opacity = 0.95;
      particle.renderSize = particle.size * (0.9 + eased * 0.3);
      if (progress >= 1) {
        if (alive) {
          enterBounceState(particle, targetPosition, pathAngle);
        } else {
          enterFadeState(particle, targetPosition);
        }
      } else {
        unfinished = true;
      }
      return;
    }
    if (particle.state === 'pierce') {
      updatePierceParticle(particle, delta);
      if (particle.state !== 'done') {
        unfinished = true;
      }
      return;
    }
    if (particle.state === 'bounce') {
      updateBounceParticle(particle, delta);
      if (particle.state !== 'done') {
        unfinished = true;
      }
      return;
    }
    if (particle.state === 'fade') {
      updateFadeParticle(particle, delta);
      if (particle.state !== 'done') {
        unfinished = true;
      }
      return;
    }
    if (particle.state !== 'done') {
      unfinished = true;
    }
  });
  if (!unfinished) {
    burst.phase = 'resolve';
    burst.phaseTime = 0;
  }
}

// Reset dash anchors so retargeted motes arc smoothly toward their new objective.
function retargetBurstParticles(burst, targetPosition) {
  if (!burst || !Array.isArray(burst.particles)) {
    return;
  }
  burst.particles.forEach((particle) => {
    if (particle.state !== 'dash') {
      return;
    }
    const current = particle.position || targetPosition || burst.origin || { x: 0, y: 0 };
    particle.start = { ...current };
    particle.dashRetargetTime = burst.phaseTime;
    particle.dashProgress = 0;
  });
}

// Sweep remaining particles through their terminal animations and retire finished bursts.
function updateResolvePhase(burst, delta) {
  let active = false;
  burst.particles.forEach((particle) => {
    if (particle.state === 'bounce') {
      updateBounceParticle(particle, delta);
    } else if (particle.state === 'fade') {
      updateFadeParticle(particle, delta);
    }
    if (particle.state !== 'done') {
      active = true;
    }
  });
  if (!active) {
    burst.done = true;
  }
}

// Update a single burst and report whether it should continue animating.
function updateBurst(playfield, burst, delta) {
  burst.lifetime += delta;
  burst.phaseTime += delta;
  switch (burst.phase) {
    case 'swirl':
      updateSwirlPhase(burst, delta);
      break;
    case 'charge':
      updateChargePhase(burst, delta);
      break;
    case 'dash':
      updateDashPhase(playfield, burst, delta);
      break;
    case 'resolve':
    default:
      updateResolvePhase(burst, delta);
      break;
  }
  return !burst.done;
}

// Paint an individual particle as a soft radial gradient with additive blending.
function drawParticle(ctx, particle) {
  if (!particle.position || particle.opacity <= 0 || !particle.color) {
    return;
  }
  const size = Math.max(2, particle.renderSize || particle.size || 6);
  const { x, y } = particle.position;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
  const { r, g, b } = particle.color;
  const alpha = clamp(particle.opacity, 0, 1);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
  gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${alpha * 0.35})`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
}

// Ensure the correct burst container is ready for the requesting tower type.
export function ensureTowerBurstState(playfield, tower, config) {
  if (!playfield || !tower || !config || tower.type !== config.towerType) {
    return null;
  }
  const state = tower[config.stateKey] || {};
  state.radiusPixels = resolveTowerRadiusPixels(playfield, tower);
  tower[config.stateKey] = state;
  if (!Array.isArray(playfield[config.burstListKey])) {
    playfield[config.burstListKey] = [];
  }
  return state;
}

// Shared teardown clears cached state and removes lingering bursts for any tower.
export function teardownTowerBurst(playfield, tower, config) {
  if (tower && config?.stateKey) {
    tower[config.stateKey] = null;
  }
  if (!playfield || !config?.burstListKey) {
    return;
  }
  if (Array.isArray(playfield[config.burstListKey])) {
    playfield[config.burstListKey] = playfield[config.burstListKey].filter(
      (burst) => burst && burst.towerId !== tower?.id,
    );
  }
}

// Spawn helper wires tower-specific configs into the shared particle system.
export function spawnTowerAttackBurst(playfield, tower, targetInfo = {}, options = {}, config) {
  if (!playfield || !tower || !config || tower.type !== config.towerType) {
    return null;
  }
  ensureTowerBurstState(playfield, tower, config);
  const enemy = targetInfo.enemy || null;
  const enemyId = enemy ? enemy.id : options.enemyId || null;
  const targetPosition = targetInfo.position
    ? { ...targetInfo.position }
    : enemy
    ? playfield.getEnemyPosition(enemy)
    : { x: tower.x, y: tower.y };
  const burst = {
    id: `${config.idPrefix || config.towerType || 'burst'}-${(burstIdCounter += 1)}`,
    towerId: tower.id,
    targetId: enemyId,
    fallbackTarget: targetPosition,
    origin: { x: tower.x, y: tower.y },
    swirlDuration: resolveTiming(config.timings?.swirl),
    chargeDuration: resolveTiming(config.timings?.charge),
    dashDuration: resolveTiming(config.timings?.dash),
    lifetime: 0,
    phase: 'swirl',
    phaseTime: 0,
    config,
  };
  burst.particles = createParticleCloud(playfield, tower, burst);
  if (!Array.isArray(playfield[config.burstListKey])) {
    playfield[config.burstListKey] = [];
  }
  playfield[config.burstListKey].push(burst);
  return burst;
}

// Update helper advances burst lifecycles while pruning finished motes.
export function updateTowerBursts(playfield, delta, config) {
  if (
    !playfield ||
    !config?.burstListKey ||
    !Array.isArray(playfield[config.burstListKey]) ||
    !Number.isFinite(delta) ||
    delta <= 0
  ) {
    return;
  }
  const survivors = [];
  playfield[config.burstListKey].forEach((burst) => {
    if (!burst) {
      return;
    }
    const alive = updateBurst(playfield, burst, delta);
    if (alive) {
      survivors.push(burst);
    }
  });
  playfield[config.burstListKey] = survivors;
}

// Drawing helper keeps additive blending consistent between the tower families.
export function drawTowerBursts(playfield, config) {
  const ctx = playfield?.ctx;
  if (!ctx || !config?.burstListKey || !Array.isArray(playfield[config.burstListKey]) || !playfield[config.burstListKey].length) {
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  playfield[config.burstListKey].forEach((burst) => {
    if (!burst || !Array.isArray(burst.particles)) {
      return;
    }
    burst.particles.forEach((particle) => drawParticle(ctx, particle));
  });
  ctx.restore();
}

export function ensureAlphaState(playfield, tower) {
  return ensureTowerBurstState(playfield, tower, ALPHA_PARTICLE_CONFIG);
}

export function teardownAlphaTower(playfield, tower) {
  teardownTowerBurst(playfield, tower, ALPHA_PARTICLE_CONFIG);
}

export function spawnAlphaAttackBurst(playfield, tower, targetInfo = {}, options = {}) {
  return spawnTowerAttackBurst(playfield, tower, targetInfo, options, ALPHA_PARTICLE_CONFIG);
}

export function updateAlphaBursts(playfield, delta) {
  updateTowerBursts(playfield, delta, ALPHA_PARTICLE_CONFIG);
}

export function drawAlphaBursts(playfield) {
  drawTowerBursts(playfield, ALPHA_PARTICLE_CONFIG);
}
