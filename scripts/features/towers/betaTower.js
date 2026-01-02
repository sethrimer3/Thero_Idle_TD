// β tower particle orchestration keeps amber math energy isolated from α logic.
import {
  ensureTowerBurstState,
  teardownTowerBurst,
  spawnTowerAttackBurst,
  updateTowerBursts,
  drawTowerBursts,
} from './alphaTower.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

// β shot sprite path points at the white particle art that will be tinted by the active palette.
// Note: Beta projectile sprite is oriented with "forward" pointing upward (see docs/TOWER_SPRITE_ORIENTATION.md)
const BETA_SHOT_SPRITE_PATH = '../../../assets/sprites/towers/bet/projectiles/betProjectile.png';

// Cache 12 tinted variants so palette swaps only pay the recolor cost once.
const BETA_SHOT_SPRITE_SAMPLE_COUNT = 12;

// Cache storage for palette-tinted β shot sprites.
const betaShotSpriteCache = [];

// Hold the base sprite image so it can be recolored when palettes change.
let betaShotSpriteImage = null;

// Track when the base sprite has finished loading.
let betaShotSpriteReady = false;

// Remember that a palette refresh is pending while the sprite is still loading.
let betaShotSpriteNeedsRefresh = false;

// Β tower tones lean into amber math light so shared particles still read uniquely.
const BETA_PARTICLE_COLORS = [
  { r: 255, g: 214, b: 112 },
  { r: 118, g: 189, b: 255 },
];

// Β offsets bias toward the warmer half of the gradient to keep cascades distinct from α.
const BETA_COLOR_OFFSETS = [0.32, 0.88];

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

// Lazily load the base β sprite so cache generation can reuse the decoded image.
function ensureBetaShotSpriteImageLoaded() {
  if (typeof Image === 'undefined') {
    return null;
  }
  if (betaShotSpriteImage) {
    return betaShotSpriteImage;
  }
  const image = new Image();
  image.onload = () => {
    // Mark the sprite ready and rebuild caches if a palette swap happened mid-load.
    betaShotSpriteReady = true;
    if (betaShotSpriteNeedsRefresh) {
      betaShotSpriteNeedsRefresh = false;
      refreshBetaShotSpritePaletteCache();
    }
  };
  // Begin loading the white sprite so tinting can happen when palettes change.
  image.src = BETA_SHOT_SPRITE_PATH;
  betaShotSpriteImage = image;
  return image;
}

// Build a set of palette-tinted canvases that can be reused for fast sprite drawing.
function buildBetaShotSpriteCache() {
  const image = ensureBetaShotSpriteImageLoaded();
  if (!image || !betaShotSpriteReady || !image.naturalWidth || !image.naturalHeight) {
    betaShotSpriteNeedsRefresh = true;
    return;
  }
  if (typeof document === 'undefined') {
    return;
  }
  betaShotSpriteCache.length = 0;
  for (let index = 0; index < BETA_SHOT_SPRITE_SAMPLE_COUNT; index += 1) {
    const ratio = BETA_SHOT_SPRITE_SAMPLE_COUNT > 1
      ? index / (BETA_SHOT_SPRITE_SAMPLE_COUNT - 1)
      : 0;
    const color = normalizeParticleColor(samplePaletteGradient(ratio));
    if (!color) {
      continue;
    }
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      continue;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    betaShotSpriteCache.push(canvas);
  }
}

// Refresh the cached sprite variants when the active palette changes.
export function refreshBetaShotSpritePaletteCache() {
  buildBetaShotSpriteCache();
}

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
    // Slow the triangle traversal so β's geometry is easier to read on impact return.
    dash: { base: 0.44, variance: 0.24 },
  },
  // Link the sprite cache retrieval so alphaTower's shared drawing logic can render β sprites.
  spriteCacheResolver: () => betaShotSpriteCache,
  spriteSampleCount: BETA_SHOT_SPRITE_SAMPLE_COUNT,
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
