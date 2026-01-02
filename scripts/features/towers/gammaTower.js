// γ tower particle orchestration isolates piercing laser math logic for clarity.
import {
  ensureTowerBurstState,
  teardownTowerBurst,
  spawnTowerAttackBurst,
  updateTowerBursts,
  drawTowerBursts,
} from './alphaTower.js';
import { samplePaletteGradient } from '../../../assets/colorSchemeUtils.js';

// γ shot sprite path points at the white particle art that will be tinted by the active palette.
// Note: Gamma projectile sprite is oriented with "forward" pointing upward (see docs/TOWER_SPRITE_ORIENTATION.md)
const GAMMA_SHOT_SPRITE_PATH = '../../../assets/sprites/towers/gamma/projectiles/gammaProjectile.png';

// Cache 12 tinted variants so palette swaps only pay the recolor cost once.
const GAMMA_SHOT_SPRITE_SAMPLE_COUNT = 12;

// Cache storage for palette-tinted γ shot sprites.
const gammaShotSpriteCache = [];

// Hold the base sprite image so it can be recolored when palettes change.
let gammaShotSpriteImage = null;

// Track when the base sprite has finished loading.
let gammaShotSpriteReady = false;

// Remember that a palette refresh is pending while the sprite is still loading.
let gammaShotSpriteNeedsRefresh = false;

// Γ tower particles glow with verdant energy to telegraph piercing precision.
const GAMMA_PARTICLE_COLORS = [
  { r: 176, g: 255, b: 193 },
  { r: 120, g: 219, b: 255 },
];

// Γ offsets favor cooler values so piercing lasers inherit the outer gradient tail.
const GAMMA_COLOR_OFFSETS = [0.08, 0.66];

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

// Lazily load the base γ sprite so cache generation can reuse the decoded image.
function ensureGammaShotSpriteImageLoaded() {
  if (typeof Image === 'undefined') {
    return null;
  }
  if (gammaShotSpriteImage) {
    return gammaShotSpriteImage;
  }
  const image = new Image();
  image.onload = () => {
    // Mark the sprite ready and rebuild caches if a palette swap happened mid-load.
    gammaShotSpriteReady = true;
    if (gammaShotSpriteNeedsRefresh) {
      gammaShotSpriteNeedsRefresh = false;
      refreshGammaShotSpritePaletteCache();
    }
  };
  // Begin loading the white sprite so tinting can happen when palettes change.
  image.src = GAMMA_SHOT_SPRITE_PATH;
  gammaShotSpriteImage = image;
  return image;
}

// Build a set of palette-tinted canvases that can be reused for fast sprite drawing.
function buildGammaShotSpriteCache() {
  const image = ensureGammaShotSpriteImageLoaded();
  if (!image || !gammaShotSpriteReady || !image.naturalWidth || !image.naturalHeight) {
    gammaShotSpriteNeedsRefresh = true;
    return;
  }
  if (typeof document === 'undefined') {
    return;
  }
  gammaShotSpriteCache.length = 0;
  for (let index = 0; index < GAMMA_SHOT_SPRITE_SAMPLE_COUNT; index += 1) {
    const ratio = GAMMA_SHOT_SPRITE_SAMPLE_COUNT > 1
      ? index / (GAMMA_SHOT_SPRITE_SAMPLE_COUNT - 1)
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
    gammaShotSpriteCache.push(canvas);
  }
}

// Refresh the cached sprite variants when the active palette changes.
export function refreshGammaShotSpritePaletteCache() {
  buildGammaShotSpriteCache();
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
  spriteCacheResolver: () => gammaShotSpriteCache,
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
