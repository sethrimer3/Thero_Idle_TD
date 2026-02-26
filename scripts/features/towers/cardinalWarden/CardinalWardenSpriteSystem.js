/**
 * CardinalWardenSpriteSystem
 *
 * Color mode, weapon color calculation, hue shifting, and sprite loading
 * logic extracted from CardinalWardenSimulation. Every function uses `.call(this, ...)`
 * so that `this` always refers to the simulation instance.
 */

import {
  GRAPHEME_INDEX,
  VISUAL_CONFIG,
  WEAPON_SLOT_DEFINITIONS,
  ENEMY_SHIP_SPRITES,
  SHIN_BULLET_SPRITE_URLS,
  SHIN_BOSS_SPRITE_URLS,
  SHIN_BOSS_MINION_SPRITE_URLS,
} from '../cardinalWardenConfig.js';

/**
 * Update palette values based on day/night render mode.
 */
export function applyColorMode() {
  const colorMode = this.nightMode ? VISUAL_CONFIG.NIGHT : VISUAL_CONFIG.DAY;
  this.bgColor = colorMode.BG_COLOR;
  this.wardenCoreColor = colorMode.WARDEN_CORE_COLOR;
  this.wardenSquareColor = colorMode.WARDEN_SQUARE_COLOR;
  this.bulletColor = colorMode.BULLET_COLOR;
  this.ringStrokeColor = colorMode.RING_STROKE_COLOR;
  this.uiTextColor = colorMode.UI_TEXT_COLOR;
  this.enemyTrailColor = colorMode.ENEMY_TRAIL_COLOR;
  this.enemySmokeColor = colorMode.ENEMY_SMOKE_COLOR;
  this.activeScriptColor = this.nightMode ? this.scriptColorNight : this.scriptColorDay;

  // Rebuild the tinted grapheme cache so glyphs match the active palette immediately.
  this.rebuildTintedGraphemeCache();

  // Update weapon colors based on gradient
  this.updateWeaponColors();
}

/**
 * Calculate weapon colors based on a gradient from the universal color palette.
 * Weapon 1: top of gradient (wardenCoreColor)
 * Weapon 2: middle of gradient (interpolated)
 * Weapon 3: bottom of gradient (complementary color)
 */
export function updateWeaponColors() {
  // Start with the warden core color
  const baseColor = this.wardenCoreColor;

  // Parse base color to RGB
  const r = parseInt(baseColor.slice(1, 3), 16);
  const g = parseInt(baseColor.slice(3, 5), 16);
  const b = parseInt(baseColor.slice(5, 7), 16);

  // Create a gradient with three colors
  // Weapon 1: Base color (top of gradient)
  const weapon1Color = baseColor;

  // Weapon 2: Shift hue by 120 degrees for middle color
  const weapon2Color = this.shiftHue(r, g, b, 120);

  // Weapon 3: Shift hue by 240 degrees for bottom color
  const weapon3Color = this.shiftHue(r, g, b, 240);

  // Update weapon definitions with new colors
  if (WEAPON_SLOT_DEFINITIONS.slot1) {
    WEAPON_SLOT_DEFINITIONS.slot1.color = weapon1Color;
  }
  if (WEAPON_SLOT_DEFINITIONS.slot2) {
    WEAPON_SLOT_DEFINITIONS.slot2.color = weapon2Color;
  }
  if (WEAPON_SLOT_DEFINITIONS.slot3) {
    WEAPON_SLOT_DEFINITIONS.slot3.color = weapon3Color;
  }
}

/**
 * Shift the hue of an RGB color by a specified amount in degrees.
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @param {number} degrees - Degrees to shift hue (0-360)
 * @returns {string} Hex color string
 */
export function shiftHue(r, g, b, degrees) {
  // Convert RGB to HSL
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) / 6;
    } else if (max === gNorm) {
      h = ((bNorm - rNorm) / delta + 2) / 6;
    } else {
      h = ((rNorm - gNorm) / delta + 4) / 6;
    }
  }

  // Shift hue
  h = (h + degrees / 360) % 1;

  // Convert HSL back to RGB
  let rOut, gOut, bOut;

  if (s === 0) {
    rOut = gOut = bOut = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    rOut = hue2rgb(p, q, h + 1/3);
    gOut = hue2rgb(p, q, h);
    bOut = hue2rgb(p, q, h - 1/3);
  }

  // Convert to hex
  const rHex = Math.round(rOut * 255).toString(16).padStart(2, '0');
  const gHex = Math.round(gOut * 255).toString(16).padStart(2, '0');
  const bHex = Math.round(bOut * 255).toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}

/**
 * Create tinted copies of all loaded grapheme sprites so glyphs follow the active palette.
 */
export function rebuildTintedGraphemeCache() {
  // Clear existing cache
  this.tintedGraphemeCache.clear();

  // Rebuild colored versions for each loaded grapheme
  for (const [index, img] of this.graphemeSprites.entries()) {
    if (!this.graphemeSpriteLoaded.get(index)) continue;

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = this.activeScriptColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.tintedGraphemeCache.set(index, canvas);
  }
}

/**
 * Load individual SVG grapheme sprites for the Cardinal Warden name display.
 * Each grapheme (A-Z plus dagesh variants) has its own white SVG file that gets colored.
 */
export function loadGraphemeSprites() {
  // Skip sprite loading on non-browser contexts
  if (typeof Image === 'undefined') {
    return;
  }

  // Letter mapping: index 0 = A, index 1 = B, ..., index 25 = Z.
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  // Dagesh sprite mapping for enhanced graphemes.
  const dageshSprites = [
    { index: GRAPHEME_INDEX.A_DAGESH, filename: 'grapheme-A-dagesh.svg' },
    { index: GRAPHEME_INDEX.I_DAGESH, filename: 'grapheme-I-dagesh.svg' },
    { index: GRAPHEME_INDEX.M_DAGESH, filename: 'grapheme-M-dagesh.svg' },
    { index: GRAPHEME_INDEX.P_DAGESH, filename: 'grapheme-P-dagesh.svg' },
    { index: GRAPHEME_INDEX.R_DAGESH, filename: 'grapheme-R-dagesh.svg' },
    { index: GRAPHEME_INDEX.S_DAGESH, filename: 'grapheme-S-dagesh.svg' },
    { index: GRAPHEME_INDEX.U_DAGESH, filename: 'grapheme-U-dagesh.svg' },
  ];

  const spriteSources = [
    ...letters.map((letter, index) => ({ index, filename: `grapheme-${letter}.svg` })),
    ...dageshSprites,
  ];

  spriteSources.forEach(({ index, filename }) => {
    const img = new Image();

    img.onload = () => {
      this.graphemeSpriteLoaded.set(index, true);
      // Rebuild the tinted cache entry for this grapheme.
      this.rebuildSingleTintedGrapheme(index, img);
    };

    img.onerror = () => {
      console.warn(`Failed to load grapheme sprite: ${filename}`);
    };

    // Load the SVG file for this grapheme.
    img.src = `./assets/sprites/spires/shinSpire/graphemes/${filename}`;
    this.graphemeSprites.set(index, img);
  });
}

/**
 * Create a tinted copy of a single grapheme sprite.
 * @param {number} index - The grapheme index (A-Z plus dagesh variants)
 * @param {Image} img - The loaded image
 */
export function rebuildSingleTintedGrapheme(index, img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = this.activeScriptColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  this.tintedGraphemeCache.set(index, canvas);
}

/**
 * Load bullet sprites so Shin spire projectiles can render with the uploaded artwork.
 */
export function loadBulletSprites() {
  // Skip sprite loading on non-browser contexts.
  if (typeof Image === 'undefined') {
    return;
  }
  SHIN_BULLET_SPRITE_URLS.forEach((url, index) => {
    // Initialize each sprite entry for fast lookup during render.
    const sprite = new Image();
    sprite.onload = () => {
      // Record sprite readiness by 1-based bullet level index.
      this.bulletSpriteLoaded[index + 1] = true;
    };
    sprite.onerror = () => {
      console.warn(`Failed to load Shin bullet sprite: ${url}`);
    };
    sprite.src = url;
    this.bulletSprites[index + 1] = sprite;
  });
}

/**
 * Load warden sprite artwork (core and rotating shards).
 */
export function loadWardenSprites() {
  // Skip sprite loading on non-browser contexts.
  if (typeof Image === 'undefined') {
    return;
  }

  // Load the warden core sprite (golden version)
  this.wardenCoreSprite = new Image();
  this.wardenCoreSprite.onload = () => {
    this.wardenCoreLoaded = true;
  };
  this.wardenCoreSprite.onerror = () => {
    console.warn('Failed to load warden core sprite');
  };
  this.wardenCoreSprite.src = './assets/sprites/spires/shinSpire/warden/wardenCoreGold.png';

  // Load all 37 warden shard sprites
  for (let i = 1; i <= 37; i++) {
    const sprite = new Image();
    sprite.onload = () => {
      this.wardenShardsLoaded[i - 1] = true;
    };
    sprite.onerror = () => {
      console.warn(`Failed to load warden shard sprite ${i}`);
    };
    sprite.src = `./assets/sprites/spires/shinSpire/warden/wardenShard (${i}).png`;
    this.wardenShardSprites[i - 1] = sprite;
  }
}

/**
 * Load enemy ship sprites for the 6 difficulty levels.
 */
export function loadEnemyShipSprites() {
  // Skip sprite loading on non-browser contexts.
  if (typeof Image === 'undefined') {
    return;
  }

  this.enemyShipSprites = [];
  this.enemyShipSpritesLoaded = [];

  ENEMY_SHIP_SPRITES.forEach((url, index) => {
    const sprite = new Image();
    sprite.onload = () => {
      this.enemyShipSpritesLoaded[index + 1] = true;
    };
    sprite.onerror = () => {
      console.warn(`Failed to load enemy ship sprite: ${url}`);
    };
    sprite.src = url;
    this.enemyShipSprites[index + 1] = sprite;
  });

  // Append two dedicated boss-minion sprites after the six standard enemy ships.
  SHIN_BOSS_MINION_SPRITE_URLS.forEach((url, index) => {
    const spriteLevel = ENEMY_SHIP_SPRITES.length + index + 1;
    const sprite = new Image();
    sprite.onload = () => {
      this.enemyShipSpritesLoaded[spriteLevel] = true;
    };
    sprite.onerror = () => {
      console.warn(`Failed to load boss minion sprite: ${url}`);
    };
    sprite.src = url;
    this.enemyShipSprites[spriteLevel] = sprite;
  });
}

/**
 * Load milestone boss sprites and prebuild inverted-color variants.
 */
export function loadBossSprites() {
  // Skip sprite loading on non-browser contexts.
  if (typeof Image === 'undefined') {
    return;
  }

  this.bossSprites = [];
  this.bossSpritesLoaded = [];
  this.invertedBossSpriteCache = [];

  SHIN_BOSS_SPRITE_URLS.forEach((url, index) => {
    const sprite = new Image();
    sprite.onload = () => {
      this.bossSpritesLoaded[index] = true;
      // Precompute an inverted-color canvas for waves 140-260.
      if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = sprite.naturalWidth || sprite.width;
        canvas.height = sprite.naturalHeight || sprite.height;
        const ctx = canvas.getContext('2d');
        if (ctx && canvas.width > 0 && canvas.height > 0) {
          ctx.drawImage(sprite, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
          }
          ctx.putImageData(imageData, 0, 0);
          this.invertedBossSpriteCache[index] = canvas;
        }
      }
    };
    sprite.onerror = () => {
      console.warn(`Failed to load boss sprite: ${url}`);
    };
    sprite.src = url;
    this.bossSprites[index] = sprite;
  });
}
