// β tower particle orchestration keeps amber math energy isolated from α logic.
import {
  ensureTowerBurstState,
  teardownTowerBurst,
  spawnTowerAttackBurst,
  updateTowerBursts,
  drawTowerBursts,
} from './alphaTower.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

// Β tower tones lean into amber math light so shared particles still read uniquely.
const BETA_PARTICLE_COLORS = [
  { r: 255, g: 214, b: 112 },
  { r: 118, g: 189, b: 255 },
];

// Β offsets bias toward the warmer half of the gradient to keep cascades distinct from α.
const BETA_COLOR_OFFSETS = [0.32, 0.88];

// Sample the global gradient for β motes so palette swaps recolor mirrored bursts instantly.
function resolveBetaParticleColors() {
  const colors = BETA_COLOR_OFFSETS.map((offset) => samplePaletteGradient(offset)).filter((color) => color);
  if (colors.length >= 2) {
    return colors;
  }
  return BETA_PARTICLE_COLORS.map((entry) => ({ ...entry }));
}

// Configuration mirrors historical β behavior so projectile pacing remains unchanged.
const BETA_PARTICLE_CONFIG = {
  towerType: 'beta',
  stateKey: 'betaState',
  burstListKey: 'betaBursts',
  idPrefix: 'beta',
  colors: BETA_PARTICLE_COLORS,
  colorResolver: resolveBetaParticleColors,
  behavior: 'triangle',
  homing: true,
  particleCountRange: { min: 5, max: 10 },
  dashDelayRange: 0.06,
  timings: {
    swirl: { base: 0.28, variance: 0.16 },
    charge: { base: 0.1, variance: 0.06 },
    dash: { base: 0.22, variance: 0.12 },
  },
};

export function ensureBetaState(playfield, tower) {
  return ensureTowerBurstState(playfield, tower, BETA_PARTICLE_CONFIG);
}

export function teardownBetaTower(playfield, tower) {
  teardownTowerBurst(playfield, tower, BETA_PARTICLE_CONFIG);
}

export function spawnBetaAttackBurst(playfield, tower, targetInfo = {}, options = {}) {
  return spawnTowerAttackBurst(playfield, tower, targetInfo, options, BETA_PARTICLE_CONFIG);
}

export function updateBetaBursts(playfield, delta) {
  updateTowerBursts(playfield, delta, BETA_PARTICLE_CONFIG);
}

export function drawBetaBursts(playfield) {
  drawTowerBursts(playfield, BETA_PARTICLE_CONFIG);
}

export { BETA_PARTICLE_CONFIG };
