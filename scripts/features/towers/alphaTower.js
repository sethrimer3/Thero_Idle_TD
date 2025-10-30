// α tower particle system isolates visual math so playfield orchestration stays lean.
import { metersToPixels } from '../../../assets/gameUnits.js';

// Soft energy palette alternates between magenta and cyan to keep α resonant.
const ALPHA_PARTICLE_COLORS = [
  { r: 255, g: 138, b: 216 },
  { r: 138, g: 247, b: 255 },
];

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

// Spawn soft energy motes along the tower circumference to seed the swirl animation.
function createParticleCloud(playfield, tower, burst) {
  const baseRadius = resolveTowerRadiusPixels(playfield, tower);
  const particleCount = Math.max(10, Math.floor(10 + Math.random() * 11));
  const particles = [];
  for (let index = 0; index < particleCount; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const color = ALPHA_PARTICLE_COLORS[index % ALPHA_PARTICLE_COLORS.length];
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
      dashDelay: Math.random() * 0.08,
      bounceDuration: 0.32 + Math.random() * 0.18,
      fadeDuration: 0.18 + Math.random() * 0.12,
      color,
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
    return { position: burst?.fallbackTarget || burst?.origin, alive: false };
  }
  if (burst.targetId) {
    const enemy = playfield.enemies.find((candidate) => candidate.id === burst.targetId);
    if (enemy) {
      const position = playfield.getEnemyPosition(enemy);
      const alive = Number.isFinite(enemy.hp) ? enemy.hp > 0 : true;
      return { position, alive };
    }
  }
  return { position: burst.fallbackTarget || burst.origin, alive: false };
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

// Guide particles from the tower core toward the target and hand off to bounce/fade states.
function updateDashPhase(playfield, burst, delta) {
  const { position: targetPosition, alive } = resolveTarget(playfield, burst);
  let unfinished = false;
  burst.particles.forEach((particle) => {
    if (particle.state === 'dash') {
      const elapsed = Math.max(0, burst.phaseTime - particle.dashDelay);
      const progress = burst.dashDuration > 0 ? clamp(elapsed / burst.dashDuration, 0, 1) : 1;
      particle.dashProgress = progress;
      if (progress <= 0) {
        unfinished = true;
        return;
      }
      const eased = easeInCubic(progress);
      const start = particle.start || burst.origin;
      const baseX = start.x + (targetPosition.x - start.x) * eased;
      const baseY = start.y + (targetPosition.y - start.y) * eased;
      const dx = targetPosition.x - start.x;
      const dy = targetPosition.y - start.y;
      const pathAngle = Math.atan2(dy, dx);
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

export function ensureAlphaState(playfield, tower) {
  if (!playfield || !tower || tower.type !== 'alpha') {
    return null;
  }
  const state = tower.alphaState || {};
  state.radiusPixels = resolveTowerRadiusPixels(playfield, tower);
  tower.alphaState = state;
  if (!Array.isArray(playfield.alphaBursts)) {
    playfield.alphaBursts = [];
  }
  return state;
}

export function teardownAlphaTower(playfield, tower) {
  if (tower) {
    tower.alphaState = null;
  }
  if (!playfield) {
    return;
  }
  if (Array.isArray(playfield.alphaBursts)) {
    playfield.alphaBursts = playfield.alphaBursts.filter(
      (burst) => burst && burst.towerId !== tower?.id,
    );
  }
}

export function spawnAlphaAttackBurst(playfield, tower, targetInfo = {}, options = {}) {
  if (!playfield || !tower || tower.type !== 'alpha') {
    return null;
  }
  ensureAlphaState(playfield, tower);
  const enemy = targetInfo.enemy || null;
  const enemyId = enemy ? enemy.id : options.enemyId || null;
  const targetPosition = targetInfo.position
    ? { ...targetInfo.position }
    : enemy
    ? playfield.getEnemyPosition(enemy)
    : { x: tower.x, y: tower.y };
  const burst = {
    id: `alpha-burst-${(burstIdCounter += 1)}`,
    towerId: tower.id,
    targetId: enemyId,
    fallbackTarget: targetPosition,
    origin: { x: tower.x, y: tower.y },
    swirlDuration: 0.32 + Math.random() * 0.18,
    chargeDuration: 0.1 + Math.random() * 0.08,
    dashDuration: 0.26 + Math.random() * 0.14,
    lifetime: 0,
    phase: 'swirl',
    phaseTime: 0,
  };
  burst.particles = createParticleCloud(playfield, tower, burst);
  if (!Array.isArray(playfield.alphaBursts)) {
    playfield.alphaBursts = [];
  }
  playfield.alphaBursts.push(burst);
  return burst;
}

export function updateAlphaBursts(playfield, delta) {
  if (!playfield || !Array.isArray(playfield.alphaBursts) || !Number.isFinite(delta) || delta <= 0) {
    return;
  }
  const survivors = [];
  playfield.alphaBursts.forEach((burst) => {
    if (!burst) {
      return;
    }
    const alive = updateBurst(playfield, burst, delta);
    if (alive) {
      survivors.push(burst);
    }
  });
  playfield.alphaBursts = survivors;
}

export function drawAlphaBursts(playfield) {
  const ctx = playfield?.ctx;
  if (!ctx || !Array.isArray(playfield.alphaBursts) || !playfield.alphaBursts.length) {
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  playfield.alphaBursts.forEach((burst) => {
    if (!burst || !Array.isArray(burst.particles)) {
      return;
    }
    burst.particles.forEach((particle) => drawParticle(ctx, particle));
  });
  ctx.restore();
}
