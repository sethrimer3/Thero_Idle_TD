/**
 * Nu (ν) Tower - Kill-Scaling Piercing Laser
 * 
 * Mechanics:
 * - Tracks kill count (enemies defeated with final blow)
 * - Tracks overkill damage (excess damage beyond enemy HP)
 * - Projectiles are piercing lasers that cycle through gradient colors
 * - Killed enemies emit light particles that fly to tower
 * - Tower flashes and ripples when absorbing kill particles
 * 
 * Formulas:
 * - atk = gamma + OKdmgTot (gamma power + total overkill damage)
 * - spd = 1 + 0.1 × kills (attack speed scales with kills)
 * - rng = 3 + 0.05 × kills (range in meters scales with kills)
 * 
 * Visual:
 * - Piercing laser color cycles through gradient every 100 kills
 * - Light particles accelerate toward tower on kill
 * - Flash and ripple effect when particles are absorbed
 */

import {
  ensureTowerBurstState,
  teardownTowerBurst,
  spawnTowerAttackBurst,
  updateTowerBursts,
  drawTowerBursts,
} from './alphaTower.js';
import {
  calculateTowerEquationResult,
  getTowerEquationBlueprint,
} from '../../../assets/towersTab.js';
import { metersToPixels } from '../../../assets/gameUnits.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

// Constants
const BASE_RANGE_METERS = 3;
const BASE_ATTACK_SPEED = 1.0; // attacks per second
const KILL_SPEED_BONUS = 0.1; // +0.1 attack speed per kill
const KILL_RANGE_BONUS = 0.05; // +0.05 meters per kill
const GRADIENT_CYCLE_KILLS = 100; // Color cycles every 100 kills

// Nu tower particles use cooler tones to telegraph piercing precision
const NU_PARTICLE_COLORS = [
  { r: 150, g: 220, b: 255 },
  { r: 200, g: 150, b: 255 },
];

// Gradient offsets for nu beams
const NU_COLOR_OFFSETS = [0.15, 0.75];

/**
 * Resolve gradient colors for nu lasers, cycling based on kill count.
 */
function resolveNuParticleColors(killCount = 0) {
  // Cycle through gradient every 100 kills
  const cycle = (killCount % GRADIENT_CYCLE_KILLS) / GRADIENT_CYCLE_KILLS;
  const offset1 = (NU_COLOR_OFFSETS[0] + cycle) % 1.0;
  const offset2 = (NU_COLOR_OFFSETS[1] + cycle) % 1.0;
  
  const colors = [offset1, offset2].map((offset) => samplePaletteGradient(offset)).filter((color) => color);
  if (colors.length >= 2) {
    return colors;
  }
  return NU_PARTICLE_COLORS.map((entry) => ({ ...entry }));
}

// Configuration for nu piercing laser particles
const NU_PARTICLE_CONFIG = {
  towerType: 'nu',
  stateKey: 'nuState',
  burstListKey: 'nuBursts',
  idPrefix: 'nu',
  colors: NU_PARTICLE_COLORS,
  colorResolver: null, // Set dynamically based on kill count
  behavior: 'pierceLaser',
  particleCountRange: { min: 5, max: 10 },
  dashDelayRange: 0.02,
  timings: {
    swirl: { base: 0.26, variance: 0.12 },
    charge: { base: 0.08, variance: 0.06 },
    dash: { base: 0.2, variance: 0.1 },
  },
  laser: {
    minExtension: 160,
    maxExtension: 320,
    speed: 0,
    staticDuration: 0.24,
    fadeDuration: 0.28,
  },
};

/**
 * Ensure nu tower state is initialized.
 */
function ensureNuStateInternal(playfield, tower) {
  if (!tower.nuState) {
    tower.nuState = {
      kills: 0,
      overkillDamageTotal: 0,
      killParticles: [], // Particles flying toward tower after kills
      flashIntensity: 0,
      rippleRadius: 0,
      rippleAlpha: 0,
      cachedAttack: 0,
      cachedSpeed: BASE_ATTACK_SPEED,
      cachedRangeMeters: BASE_RANGE_METERS,
      needsRefresh: true,
    };
  }
  return tower.nuState;
}

/**
 * Refresh nu tower parameters from formulas.
 */
function resolveGammaPowerSafe() {
  // Guard against equation resolution failures so ν can't freeze the playfield when γ math is unavailable.
  try {
    const gammaRaw = calculateTowerEquationResult('gamma');
    return Number.isFinite(gammaRaw) ? Math.max(0, gammaRaw) : 0;
  } catch (error) {
    console.warn('ν tower failed to resolve γ power; defaulting to 0.', error);
    return 0;
  }
}

function refreshNuParameters(playfield, tower, state) {
  // Get gamma power for base damage with a safe fallback.
  const gammaPower = resolveGammaPowerSafe();
  
  // atk = gamma + OKdmgTot
  const attack = gammaPower + state.overkillDamageTotal;
  
  // spd = 1 + 0.1 × kills
  const attackSpeed = BASE_ATTACK_SPEED + KILL_SPEED_BONUS * state.kills;
  
  // rng = 3 + 0.05 × kills (in meters)
  const rangeMeters = BASE_RANGE_METERS + KILL_RANGE_BONUS * state.kills;

  const minDimension = resolvePlayfieldMinDimension(playfield);
  const rangePixels = Math.max(24, metersToPixels(rangeMeters, minDimension));

  // Update tower stats for display
  tower.baseDamage = attack;
  tower.damage = attack;
  tower.baseRate = attackSpeed;
  tower.rate = attackSpeed;
  tower.baseRange = rangePixels;
  tower.range = rangePixels;
  tower.rangeMeters = rangeMeters;

  state.cachedAttack = attack;
  state.cachedSpeed = attackSpeed;
  state.cachedRangeMeters = rangeMeters;
  state.needsRefresh = false;

  // Update color resolver with current kill count
  NU_PARTICLE_CONFIG.colorResolver = () => resolveNuParticleColors(state.kills);
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
 * Track a kill for this nu tower.
 */
export function trackNuKill(tower, overkillDamage = 0) {
  if (!tower || tower.type !== 'nu') {
    return;
  }
  
  const state = ensureNuStateInternal(null, tower);
  state.kills += 1;
  state.overkillDamageTotal += Math.max(0, overkillDamage);
  state.needsRefresh = true;
}

/**
 * Spawn a kill particle that flies toward the nu tower.
 */
export function spawnNuKillParticle(playfield, tower, position) {
  if (!playfield || !tower || tower.type !== 'nu') {
    return;
  }
  
  const state = ensureNuStateInternal(playfield, tower);
  
  const particle = {
    id: `nu-kill-${Date.now()}-${Math.random()}`,
    x: position.x,
    y: position.y,
    targetX: tower.x,
    targetY: tower.y,
    lifetime: 0,
    maxLifetime: 0.5, // Takes 0.5 seconds to reach tower
    absorbed: false,
  };
  
  state.killParticles.push(particle);
}

/**
 * Update kill particles and tower flash effects.
 */
function updateKillParticles(playfield, tower, state, delta) {
  const particlesToRemove = [];
  
  state.killParticles.forEach((particle, index) => {
    if (particle.absorbed) {
      particlesToRemove.push(index);
      return;
    }
    
    particle.lifetime += delta;
    
    // Check if particle reached tower
    if (particle.lifetime >= particle.maxLifetime) {
      // Trigger flash and ripple effect
      state.flashIntensity = 1.0;
      state.rippleRadius = 0;
      state.rippleAlpha = 1.0;
      particle.absorbed = true;
      particlesToRemove.push(index);
    }
  });
  
  // Remove absorbed particles (in reverse order)
  for (let i = particlesToRemove.length - 1; i >= 0; i--) {
    state.killParticles.splice(particlesToRemove[i], 1);
  }
  
  // Decay flash and ripple effects
  if (state.flashIntensity > 0) {
    state.flashIntensity = Math.max(0, state.flashIntensity - delta * 3);
  }
  
  if (state.rippleAlpha > 0) {
    state.rippleRadius += delta * 200; // Expand at 200 pixels/second
    state.rippleAlpha = Math.max(0, state.rippleAlpha - delta * 2);
  }
}

/**
 * Initialize or refresh nu tower state.
 */
export function ensureNuState(playfield, tower) {
  if (!playfield || !tower || tower.type !== 'nu') {
    return null;
  }
  const state = ensureNuStateInternal(playfield, tower);
  refreshNuParameters(playfield, tower, state);
  return state;
}

/**
 * Update nu tower logic.
 */
export function updateNuTower(playfield, tower, delta) {
  if (!playfield || !tower || tower.type !== 'nu') {
    return;
  }
  
  const state = ensureNuStateInternal(playfield, tower);

  // Refresh parameters periodically
  state.recalcTimer = (state.recalcTimer || 0) - delta;
  if (state.needsRefresh || state.recalcTimer <= 0) {
    refreshNuParameters(playfield, tower, state);
    state.recalcTimer = 0.35; // Recalc every 350ms
  }
  
  // Update kill particles and effects
  updateKillParticles(playfield, tower, state, delta);
}

/**
 * Draw kill particles flying toward tower.
 */
export function drawNuKillParticles(playfield, tower) {
  if (!playfield?.ctx || !tower?.nuState) {
    return;
  }
  
  const ctx = playfield.ctx;
  const state = tower.nuState;
  const particles = Array.isArray(state.killParticles) ? state.killParticles : [];
  
  if (!particles.length && state.flashIntensity <= 0 && state.rippleAlpha <= 0) {
    return;
  }
  
  ctx.save();
  
  // Draw kill particles
  particles.forEach((particle) => {
    if (particle.absorbed) return;
    
    // Calculate current position (accelerating toward tower)
    const progress = particle.lifetime / particle.maxLifetime;
    const easedProgress = 1 - Math.pow(1 - progress, 2); // Ease-in quadratic
    
    const x = particle.x + (particle.targetX - particle.x) * easedProgress;
    const y = particle.y + (particle.targetY - particle.y) * easedProgress;
    
    const alpha = 1 - progress * 0.3; // Slight fade as it approaches
    const size = 4 + progress * 2; // Grows slightly as it approaches
    
    // Get current color based on kill count
    const colors = resolveNuParticleColors(state.kills);
    const color = colors[0];
    
    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    
    // Add glow
    ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.8})`;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
  
  // Draw flash effect on tower
  if (state.flashIntensity > 0) {
    const colors = resolveNuParticleColors(state.kills);
    const color = colors[0];
    const alpha = state.flashIntensity * 0.6;
    
    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 25, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw ripple effect
  if (state.rippleAlpha > 0) {
    const colors = resolveNuParticleColors(state.kills);
    const color = colors[1];
    const alpha = state.rippleAlpha * 0.4;
    
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, state.rippleRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  ctx.restore();
}

/**
 * Ensure nu burst state (for piercing lasers).
 */
export function ensureNuState_Burst(playfield, tower) {
  return ensureTowerBurstState(playfield, tower, NU_PARTICLE_CONFIG);
}

/**
 * Spawn nu attack burst (piercing laser).
 */
export function spawnNuAttackBurst(playfield, tower, targetInfo = {}, options = {}) {
  return spawnTowerAttackBurst(playfield, tower, targetInfo, options, NU_PARTICLE_CONFIG);
}

/**
 * Update nu particle bursts.
 */
export function updateNuBursts(playfield, delta) {
  updateTowerBursts(playfield, delta, NU_PARTICLE_CONFIG);
}

/**
 * Draw nu particle bursts.
 */
export function drawNuBursts(playfield) {
  drawTowerBursts(playfield, NU_PARTICLE_CONFIG);
}

/**
 * Clean up nu tower state.
 */
export function teardownNuTower(playfield, tower) {
  teardownTowerBurst(playfield, tower, NU_PARTICLE_CONFIG);
  if (tower?.nuState) {
    tower.nuState.killParticles = [];
    tower.nuState = null;
  }
}

export { NU_PARTICLE_CONFIG };
