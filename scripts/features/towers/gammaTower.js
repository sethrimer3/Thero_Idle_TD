// γ tower particle orchestration isolates piercing laser math logic for clarity.
import {
  ensureTowerBurstState,
  teardownTowerBurst,
  spawnTowerAttackBurst,
  updateTowerBursts,
  drawTowerBursts,
} from './alphaTower.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

// Γ tower particles glow with verdant energy to telegraph piercing precision.
const GAMMA_PARTICLE_COLORS = [
  { r: 176, g: 255, b: 193 },
  { r: 120, g: 219, b: 255 },
];

// Γ offsets favor cooler values so piercing lasers inherit the outer gradient tail.
const GAMMA_COLOR_OFFSETS = [0.08, 0.66];

// Resolve gradient colors for γ beams to keep piercing shots aligned with the active palette.
function resolveGammaParticleColors() {
  const colors = GAMMA_COLOR_OFFSETS.map((offset) => samplePaletteGradient(offset)).filter((color) => color);
  if (colors.length >= 2) {
    return colors;
  }
  return GAMMA_PARTICLE_COLORS.map((entry) => ({ ...entry }));
}

// Configuration retains legacy γ laser parameters so gameplay cadence is preserved.
const GAMMA_PARTICLE_CONFIG = {
  towerType: 'gamma',
  stateKey: 'gammaState',
  burstListKey: 'gammaBursts',
  idPrefix: 'gamma',
  colors: GAMMA_PARTICLE_COLORS,
  colorResolver: resolveGammaParticleColors,
  behavior: 'pentagram',
  particleCountRange: { min: 5, max: 10 },
  dashDelayRange: 0.02,
  timings: {
    swirl: { base: 0.26, variance: 0.12 },
    charge: { base: 0.08, variance: 0.06 },
    // Slow the pentagram sweep so γ's tracing is legible during multi-hit passes.
    dash: { base: 0.4, variance: 0.2 },
  },
  laser: {
    minExtension: 160,
    maxExtension: 320,
    speed: 760,
    fadeDuration: 0.22,
  },
};

export function ensureGammaState(playfield, tower) {
  return ensureTowerBurstState(playfield, tower, GAMMA_PARTICLE_CONFIG);
}

export function teardownGammaTower(playfield, tower) {
  teardownTowerBurst(playfield, tower, GAMMA_PARTICLE_CONFIG);
}

export function spawnGammaAttackBurst(playfield, tower, targetInfo = {}, options = {}) {
  return spawnTowerAttackBurst(playfield, tower, targetInfo, options, GAMMA_PARTICLE_CONFIG);
}

export function updateGammaBursts(playfield, delta) {
  updateTowerBursts(playfield, delta, GAMMA_PARTICLE_CONFIG);
}

export function drawGammaBursts(playfield) {
  drawTowerBursts(playfield, GAMMA_PARTICLE_CONFIG);
}

export { GAMMA_PARTICLE_CONFIG };
