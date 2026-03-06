// γ tower particle orchestration isolates piercing laser math logic for clarity.
import {
  ensureTowerBurstState,
  teardownTowerBurst,
  spawnTowerAttackBurst,
  updateTowerBursts,
  drawTowerBursts,
} from './alphaTower.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';
import { createShotSpriteCache } from './shared/TowerRenderHelpers.js';

// γ shot sprite path points at the white particle art that will be tinted by the active palette.
// Note: Gamma projectile sprite is oriented with "forward" pointing upward (see docs/TOWER_SPRITE_ORIENTATION.md)
const GAMMA_SHOT_SPRITE_PATH = './assets/sprites/towers/gamma/projectiles/gammaProjectile.png';

// Cache 12 tinted variants so palette swaps only pay the recolor cost once.
const GAMMA_SHOT_SPRITE_SAMPLE_COUNT = 12;

// Sprite cache state managed by the shared factory so boilerplate stays out of this module.
const gammaShotSprite = createShotSpriteCache(GAMMA_SHOT_SPRITE_PATH, GAMMA_SHOT_SPRITE_SAMPLE_COUNT);

// Γ tower particles glow with verdant energy to telegraph piercing precision.
const GAMMA_PARTICLE_COLORS = [
  { r: 176, g: 255, b: 193 },
  { r: 120, g: 219, b: 255 },
];

// Γ offsets favor cooler values so piercing lasers inherit the outer gradient tail.
const GAMMA_COLOR_OFFSETS = [0.08, 0.66];

// Refresh the cached sprite variants when the active palette changes.
export function refreshGammaShotSpritePaletteCache() {
  gammaShotSprite.refresh();
}

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
  // Send γ motes straight to the target before tracing a tight star on impact.
  behavior: 'impactStar',
  particleCountRange: { min: 5, max: 10 },
  dashDelayRange: 0.02,
  timings: {
    swirl: { base: 0.26, variance: 0.12 },
    charge: { base: 0.08, variance: 0.06 },
    // Slow the dash so γ's post-impact tracing is legible during multi-hit passes.
    dash: { base: 0.4, variance: 0.2 },
  },
  impactStarRadius: 22,
  impactStarEdgeDuration: 0.12,
  laser: {
    minExtension: 160,
    maxExtension: 320,
    speed: 760,
    fadeDuration: 0.22,
  },
  // Link the sprite cache retrieval so alphaTower's shared drawing logic can render γ sprites.
  spriteCacheResolver: () => gammaShotSprite.cache,
  spriteSampleCount: GAMMA_SHOT_SPRITE_SAMPLE_COUNT,
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
