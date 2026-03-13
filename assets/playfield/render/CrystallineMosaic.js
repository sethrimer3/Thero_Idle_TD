/**
 * Crystalline Voronoi Mosaic Background
 * Renders a mosaic of Voronoi-like polygon cells near the edge of the playing field,
 * using shades from the selected color palette gradient. Cells slowly fade in brightness
 * and drift along the color palette gradient for a dynamic crystalline effect.
 * 
 * Uses SVG sprites from assets/sprites/shards/ that are colored using the player's
 * selected palette and cached for performance.
 */

import { metersToPixels } from '../../gameUnits.js';
import { samplePaletteGradient } from '../../colorSchemeUtils.js';

// Pre-calculated constants for performance optimization in tight render loops
const TWO_PI = Math.PI * 2;
const HALF = 0.5;

// Configuration constants
const MINIMUM_DISTANCE_FROM_TRACK_METERS = 7; // Only render cells 7+ meters from the track.
const EDGE_BAND_FRACTION = 0.22; // Keep the mosaic concentrated around the playfield edges.
const EDGE_BAND_MIN_PIXELS = 80; // Ensure a minimum edge band thickness in pixels.
const CELL_SIZE_MIN = 28; // Minimum cell radius in pixels for polygon cells.
const CELL_SIZE_MAX = 110; // Maximum cell radius in pixels for polygon cells.
const CELL_DENSITY = 0.00035; // Polygon cells per square pixel (controls spacing).
const CELL_SPACING_RATIO = 0.9; // Minimum spacing between seeds relative to cell size.
const FADE_SPEED = 0.000018; // Slow the brightness/color fade animation.
const BRIGHTNESS_MIN = 0.35; // Minimum brightness multiplier.
const BRIGHTNESS_MAX = 0.85; // Maximum brightness multiplier.
const ALPHA_BASE = 0.16; // Base transparency for polygon cells.
const ALPHA_VARIATION = 0.08; // Additional alpha variation for subtle depth.
const COLOR_DRIFT = 0.08; // Gradient travel distance for slow color drift.
const VIEW_BOUNDS_PADDING = 48; // Extra padding to keep edge crystals from popping when panning.
// Cap expensive inter-cell edge linking when too many crystals are on screen.
const MAX_VISIBLE_CELL_CONNECTIONS = 160;
// Rebuild the cached mosaic layers at a modest cadence because the shimmer animation is intentionally subtle.
// 500 ms (~2 rebuilds/sec) is imperceptible given the extremely slow FADE_SPEED shimmer.
const MOSAIC_LAYER_CACHE_INTERVAL_MS = 500;
// Bucket viewport and parallax inputs so tiny camera nudges can still reuse the cached layer.
const MOSAIC_LAYER_CACHE_BUCKET_PIXELS = 4;

// Shard sprite configuration
const SHARD_SPRITE_COUNT = 37; // Number of shard SVG sprites available (1-37)
const SHARD_SPRITE_PATH = 'assets/sprites/shards/shard (INDEX).svg';
// With brightness pre-baked into the color at call sites, the cache universe is ~5× smaller.
const CACHE_MAX_SIZE = 200; // Maximum number of cached colored sprites

// Sprite and cache management
const shardSprites = []; // Array of loaded Image objects
const shardSpriteCache = new Map(); // Cache for colored sprite canvases
// Cache for pre-blurred foreground sprite canvases (keyed by sprite/color/brightness/blur)
const blurredSpriteCache = new Map();
let spritesLoaded = false;
let spritesLoadingPromise = null;

/**
 * Load all shard SVG sprites
 */
function loadShardSprites() {
  if (spritesLoadingPromise) {
    return spritesLoadingPromise;
  }

  spritesLoadingPromise = new Promise((resolve) => {
    let loadedCount = 0;
    const totalCount = SHARD_SPRITE_COUNT;

    for (let i = 1; i <= SHARD_SPRITE_COUNT; i++) {
      const img = new Image();
      const path = SHARD_SPRITE_PATH.replace('INDEX', i.toString());
      
      img.onload = () => {
        loadedCount++;
        if (loadedCount === totalCount) {
          spritesLoaded = true;
          resolve();
        }
      };
      
      img.onerror = () => {
        console.warn(`Failed to load shard sprite: ${path}`);
        loadedCount++;
        if (loadedCount === totalCount) {
          spritesLoaded = true;
          resolve();
        }
      };
      
      img.src = path;
      img.decoding = 'async';
      img.loading = 'eager';
      shardSprites.push(img);
    }
  });

  return spritesLoadingPromise;
}

/**
 * Create a colored version of a shard sprite and cache it.
 * Brightness is NOT part of the cache key – callers must pre-multiply it into the
 * color components before calling so the cache stays small and stable.
 * @param {number} spriteIndex - Index of the sprite to color
 * @param {Object} color - RGB color object {r, g, b} (brightness already baked in)
 * @returns {HTMLCanvasElement|null} Cached colored sprite canvas
 */
function getColoredShardSprite(spriteIndex, color) {
  if (!spritesLoaded || spriteIndex < 0 || spriteIndex >= shardSprites.length) {
    return null;
  }

  const sprite = shardSprites[spriteIndex];
  if (!sprite || !sprite.complete || !sprite.naturalWidth) {
    return null;
  }

  // Cache key uses only sprite index and the already-brightness-adjusted color.
  const cacheKey = `${spriteIndex}_${color.r}_${color.g}_${color.b}`;

  // Return cached version if available
  if (shardSpriteCache.has(cacheKey)) {
    return shardSpriteCache.get(cacheKey);
  }

  // Create off-screen canvas for coloring the sprite
  const canvas = document.createElement('canvas');
  canvas.width = sprite.naturalWidth;
  canvas.height = sprite.naturalHeight;
  const ctx = canvas.getContext('2d');

  // Draw the original sprite
  ctx.drawImage(sprite, 0, 0);

  // Apply color tinting using composite operations
  // The SVG sprites are black and white, so we can colorize them
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Color values already include the brightness factor from the caller.
  const r = color.r;
  const g = color.g;
  const b = color.b;

  for (let i = 0; i < data.length; i += 4) {
    // Get the grayscale value (use red channel as they're B&W)
    const gray = data[i] / 255;
    
    // Apply color based on grayscale value
    data[i] = r * gray;     // Red
    data[i + 1] = g * gray; // Green
    data[i + 2] = b * gray; // Blue
    // Alpha (data[i + 3]) remains unchanged
  }

  ctx.putImageData(imageData, 0, 0);

  // Cache the colored sprite (limit cache size)
  if (shardSpriteCache.size > CACHE_MAX_SIZE) {
    // Remove oldest entry when cache gets too large
    const firstKey = shardSpriteCache.keys().next().value;
    shardSpriteCache.delete(firstKey);
  }
  shardSpriteCache.set(cacheKey, canvas);

  return canvas;
}

/**
 * Clear the sprite cache (useful when color scheme changes)
 */
export function clearShardSpriteCache() {
  shardSpriteCache.clear();
  blurredSpriteCache.clear();
}

// Start loading sprites immediately
loadShardSprites();

// Pixel padding around blurred sprites to avoid clipping the blur effect
const BLUR_PADDING = 16;
const BLUR_CACHE_MAX_SIZE = 100;

/**
 * Get (or create and cache) a blurred version of a colored shard sprite.
 * The blur is rendered once into an offscreen canvas so per-frame cost is just a drawImage.
 * Brightness is not part of the cache key – it must already be baked into the color components.
 * @param {number} spriteIndex
 * @param {Object} color - {r,g,b} with brightness pre-multiplied
 * @param {number} blurRadius - CSS blur amount in pixels
 * @returns {HTMLCanvasElement|null}
 */
function getBlurredShardSprite(spriteIndex, color, blurRadius) {
  const source = getColoredShardSprite(spriteIndex, color);
  if (!source) {
    return null;
  }
  const blurKey = `blur_${spriteIndex}_${color.r}_${color.g}_${color.b}_${Math.round(blurRadius)}`;
  if (blurredSpriteCache.has(blurKey)) {
    return blurredSpriteCache.get(blurKey);
  }
  const pad = BLUR_PADDING;
  const canvas = document.createElement('canvas');
  canvas.width = source.width + pad * 2;
  canvas.height = source.height + pad * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return source;
  }
  ctx.filter = `blur(${blurRadius}px)`;
  ctx.drawImage(source, pad, pad);
  ctx.filter = 'none';
  // Enforce cache size limit
  if (blurredSpriteCache.size > BLUR_CACHE_MAX_SIZE) {
    const firstKey = blurredSpriteCache.keys().next().value;
    blurredSpriteCache.delete(firstKey);
  }
  blurredSpriteCache.set(blurKey, canvas);
  return canvas;
}

// Parallax factors: background shards lag behind the camera; foreground shards lead.
const BG_PARALLAX_FACTOR = 0.88; // Background moves at 88% of camera speed (slower = farther away)
const FG_PARALLAX_FACTOR = 1.08; // Foreground moves at 108% of camera speed (faster = closer)
// Fraction of cells assigned to the foreground layer
const FOREGROUND_LAYER_FRACTION = 0.35;
// Blur radius (in pixels) applied to cached foreground sprites
const FG_BLUR_RADIUS = 4;

// Counter for unique cell IDs
let cellIdCounter = 0;

/**
 * Create a simple LCG seeded random number generator based on the level ID string.
 * Returns a 0..1 float, matching the Math.random() interface.
 * Same seed always produces the same sequence, ensuring identical crystal layouts
 * for a given level regardless of viewport changes or zoom level.
 *
 * @param {string|number} seed - Seed value (level ID)
 * @returns {() => number} Seeded random function
 */
function createSeededRandom(seed) {
  // Derive a numeric seed from the string level identifier.
  // The prime multiplier 31 is a standard choice for string hashing (similar to Java's
  // String.hashCode) because it distributes character codes well with low collision rates.
  let state = Array.from(String(seed ?? 'default')).reduce(
    (acc, char) => ((acc * 31 + char.charCodeAt(0)) | 0) >>> 0,
    1,
  ) || 1;
  return () => {
    state = ((state * 1103515245 + 12345) & 0x7fffffff) >>> 0;
    return state / 0x7fffffff;
  };
}

/**
 * Polygon cell representing a single crystalline Voronoi-like region.
 * Uses SVG sprites coloured with the active palette.
 * Purely decorative – not targetable or destructible.
 * Cells are assigned to 'background' or 'foreground' layers for parallax rendering.
 */
class CrystallineCell {
  constructor(x, y, size, colorStop, phase, layer, rand = Math.random) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.colorStop = colorStop; // Base position along gradient (0-1).
    this.phase = phase; // Animation phase offset.
    this.brightness = BRIGHTNESS_MIN + rand() * (BRIGHTNESS_MAX - BRIGHTNESS_MIN);
    this.colorShift = colorStop; // Track the animated gradient position.
    this.alphaBase = ALPHA_BASE + rand() * ALPHA_VARIATION; // Cache alpha for steady translucency.
    
    // Deterministic sprite selection and rotation using the seeded RNG.
    this.spriteIndex = Math.floor(rand() * SHARD_SPRITE_COUNT);
    
    // Deterministic rotation for variety
    this.rotation = rand() * TWO_PI;
    // Pre-compute trig for rotation so draw() can use setTransform without save/restore.
    this.cosR = Math.cos(this.rotation);
    this.sinR = Math.sin(this.rotation);

    // Parallax layer: 'background' cells are crisp and slow; 'foreground' are blurred and fast.
    this.layer = layer || 'background';

    // Unique identifier (used for cache keys, not targeting)
    this.id = `cell_${cellIdCounter++}`;
  }

  /**
   * Update polygon animation state.
   */
  update(deltaTime) {
    // Slowly oscillate brightness for the crystalline shimmer.
    this.phase += FADE_SPEED * deltaTime;
    this.brightness =
      BRIGHTNESS_MIN +
      (BRIGHTNESS_MAX - BRIGHTNESS_MIN) * (0.5 + 0.5 * Math.sin(this.phase));
    // Drift along the palette gradient to mimic slow chromatic refraction.
    this.colorShift = (this.colorStop + COLOR_DRIFT * (0.5 + 0.5 * Math.sin(this.phase * 0.6))) % 1;
  }

  /**
   * Render the cell using SVG sprite to the canvas.
   * Foreground cells use a pre-blurred cached sprite; background cells use the normal sprite.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} paletteColor - {r,g,b} sampled from the palette gradient
   * @param {number} baseA - pixelRatio component of the base transform (ctx.a)
   * @param {number} baseD - pixelRatio component of the base transform (ctx.d)
   * @param {number} baseE - x-translation component of the base transform (ctx.e)
   * @param {number} baseF - y-translation component of the base transform (ctx.f)
   */
  draw(ctx, paletteColor, baseA, baseD, baseE, baseF) {
    // Compose the base offscreen transform with this cell's translate + rotate in one call,
    // avoiding the overhead of save/translate/rotate/restore for every cell.
    ctx.setTransform(
      baseA * this.cosR,
      baseA * this.sinR,
      baseD * -this.sinR,
      baseD * this.cosR,
      baseE + this.x * baseA,
      baseF + this.y * baseD,
    );

    // Apply brightness multiplier to the palette color.
    const r = Math.floor(paletteColor.r * this.brightness);
    const g = Math.floor(paletteColor.g * this.brightness);
    const b = Math.floor(paletteColor.b * this.brightness);
    const alpha = this.alphaBase + 0.05 * Math.sin(this.phase * 0.4);
    ctx.globalAlpha = alpha;

    let coloredSprite;
    if (this.layer === 'foreground') {
      // Foreground shards use a cached blurred sprite for a depth-of-field effect.
      // Brightness is already baked into r,g,b so no separate brightness arg needed.
      coloredSprite = getBlurredShardSprite(this.spriteIndex, { r, g, b }, FG_BLUR_RADIUS);
    } else {
      coloredSprite = getColoredShardSprite(this.spriteIndex, { r, g, b });
    }

    if (coloredSprite) {
      // Calculate scale to fit the desired size (account for blur padding on fg sprites).
      let spriteNaturalSize;
      if (this.layer === 'foreground') {
        // Subtract the blur padding from each dimension before taking the max,
        // clamping at 1 to prevent division by zero or negative values.
        const naturalW = Math.max(1, coloredSprite.width - BLUR_PADDING * 2);
        const naturalH = Math.max(1, coloredSprite.height - BLUR_PADDING * 2);
        spriteNaturalSize = Math.max(naturalW, naturalH);
      } else {
        spriteNaturalSize = Math.max(coloredSprite.width, coloredSprite.height);
      }
      const scale = (this.size * 2) / Math.max(1, spriteNaturalSize);

      ctx.drawImage(
        coloredSprite,
        -coloredSprite.width * scale * HALF,
        -coloredSprite.height * scale * HALF,
        coloredSprite.width * scale,
        coloredSprite.height * scale
      );
    } else {
      // Fallback: draw a simple circle if sprites aren't loaded yet
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, TWO_PI);
      ctx.fill();
    }
    // globalAlpha is reset to 1 by _drawCells after the full cell loop.
  }
}

/**
 * Check if a point is far enough from the track path
 */
function isPointFarFromTrack(x, y, pathPoints, minDistance) {
  if (!pathPoints || pathPoints.length === 0) {
    return true; // No track, render everywhere
  }

  const minDistSquared = minDistance * minDistance;

  // Check distance to each path segment
  for (let i = 0; i < pathPoints.length - 1; i++) {
    const p1 = pathPoints[i];
    const p2 = pathPoints[i + 1];
    
    // Distance from point to line segment
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSquared = dx * dx + dy * dy;
    
    if (lengthSquared === 0) {
      // Degenerate segment, check distance to p1
      const distSquared = (x - p1.x) ** 2 + (y - p1.y) ** 2;
      if (distSquared < minDistSquared) {
        return false;
      }
      continue;
    }
    
    // Project point onto line segment
    const t = Math.max(0, Math.min(1, ((x - p1.x) * dx + (y - p1.y) * dy) / lengthSquared));
    const projX = p1.x + t * dx;
    const projY = p1.y + t * dy;
    
    const distSquared = (x - projX) ** 2 + (y - projY) ** 2;
    if (distSquared < minDistSquared) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a point sits inside the desired edge band around the playfield.
 */
function isPointNearEdge(x, y, viewBounds, edgeBandPixels) {
  // Measure the nearest distance to any edge of the viewport.
  const edgeDistance = Math.min(
    x - viewBounds.minX,
    viewBounds.maxX - x,
    y - viewBounds.minY,
    viewBounds.maxY - y,
  );
  return edgeDistance <= edgeBandPixels;
}

/**
 * Check if a point is far enough from existing cell seeds.
 */
function isPointFarFromSeeds(x, y, seeds, minSpacing) {
  // Enforce spacing so cells feel interlocked instead of overlapping heavily.
  for (const seed of seeds) {
    const dx = x - seed.x;
    const dy = y - seed.y;
    if (dx * dx + dy * dy < minSpacing * minSpacing) {
      return false;
    }
  }
  return true;
}

/**
 * Round cache inputs into small buckets so the rasterized mosaic can be reused
 * across near-identical camera positions.
 *
 * @param {number} value
 * @returns {number}
 */
function bucketCacheCoordinate(value) {
  const numericValue = Number.isFinite(value) ? value : 0;
  return Math.round(numericValue / MOSAIC_LAYER_CACHE_BUCKET_PIXELS) * MOSAIC_LAYER_CACHE_BUCKET_PIXELS;
}

/**
 * Main Crystalline Mosaic Manager
 */
export class CrystallineMosaicManager {
  constructor() {
    this.cells = [];
    this.enabled = true;
    this.needsRegeneration = true;
    // Track stable level/world bounds (not viewport) to avoid zoom-triggered regeneration.
    this.lastLevelBounds = null;
    this.lastPathVersion = null;
    // Track cell mutations so cached visible lists stay valid.
    this.cellStateVersion = 0;
    // Cache the last visible-cell list to avoid rebuilding every frame.
    this.visibleCellsCache = null;
    // Pre-computed connection coordinate lists per layer ([x1,y1,x2,y2,...] flat arrays).
    this.backgroundConnections = [];
    this.foregroundConnections = [];
    // Cache per-layer rasterized canvases so the live render loop can blit a bitmap instead of every cell.
    this.layerCanvasCache = {
      background: null,
      foreground: null,
    };
  }

  /**
   * Generate polygon cells within the level's world bounds.
   * Crystals are placed in stable world coordinates so zoom changes do not
   * cause repositioning – the canvas transform handles zooming naturally.
   * @param {object} levelBounds - Full level world bounds {minX, minY, maxX, maxY}
   * @param {Array} pathPoints - Track path points for distance checking
   * @param {string|number} [seed] - Level ID used as RNG seed for deterministic placement
   */
  generateCells(levelBounds, pathPoints, seed) {
    if (!this.enabled || !levelBounds) {
      return;
    }

    // Build a seeded RNG so the same level always produces the same crystal layout,
    // regardless of viewport size or zoom level.
    const rand = createSeededRandom(seed);

    const minDistancePixels = metersToPixels(MINIMUM_DISTANCE_FROM_TRACK_METERS);
    // Use a pixel-based edge band so the mosaic hugs the playfield borders.
    const edgeBandPixels = Math.max(
      EDGE_BAND_MIN_PIXELS,
      Math.min(levelBounds.maxX - levelBounds.minX, levelBounds.maxY - levelBounds.minY) * EDGE_BAND_FRACTION,
    );
    
    // Calculate area to cover
    const width = levelBounds.maxX - levelBounds.minX;
    const height = levelBounds.maxY - levelBounds.minY;
    const area = width * height;
    
    // Calculate number of cells based on density.
    const targetCount = Math.floor(area * CELL_DENSITY);
    
    this.cells = [];
    let attempts = 0;
    const maxAttempts = targetCount * 5; // Limit attempts to avoid infinite loops.
    
    while (this.cells.length < targetCount && attempts < maxAttempts) {
      attempts++;
      
      // Deterministic position within level bounds.
      const x = levelBounds.minX + rand() * width;
      const y = levelBounds.minY + rand() * height;
      
      // Keep the mosaic close to the level edges.
      if (!isPointNearEdge(x, y, levelBounds, edgeBandPixels)) {
        continue;
      }

      // Check if far enough from track.
      if (!isPointFarFromTrack(x, y, pathPoints, minDistancePixels)) {
        continue;
      }
      
      // Deterministic size and gradient position.
      const size = CELL_SIZE_MIN + rand() * (CELL_SIZE_MAX - CELL_SIZE_MIN);
      // Set seed spacing based on the cell size to prevent heavy overlap.
      const minSpacing = size * CELL_SPACING_RATIO;
      if (!isPointFarFromSeeds(x, y, this.cells, minSpacing)) {
        continue;
      }
      const colorStop = rand(); // Position along gradient.
      const phase = rand() * TWO_PI; // Animation phase.
      // Assign layer: a fraction of cells become foreground (blurred, parallax-forward).
      const layer = rand() < FOREGROUND_LAYER_FRACTION ? 'foreground' : 'background';
      
      this.cells.push(new CrystallineCell(x, y, size, colorStop, phase, layer, rand));
    }
    // Bump the state version so render caches refresh after regeneration.
    this.cellStateVersion += 1;
    // Pre-compute connection lines for each layer once so _drawCells never runs O(n²) checks.
    // Connections are stored as flat coordinate quads [x1,y1,x2,y2,...].
    const bgCells = this.cells.filter((c) => c.layer === 'background');
    const fgCells = this.cells.filter((c) => c.layer === 'foreground');
    this.backgroundConnections = this._computeConnections(bgCells);
    this.foregroundConnections = this._computeConnections(fgCells);
    // Clear cached visibility lists after generating a new layout.
    this.visibleCellsCache = null;
    // Drop any rasterized layer caches because they reference the previous layout.
    this.clearLayerCanvasCache();
    this.needsRegeneration = false;
  }

  /**
   * Check if cells need regeneration (level or path changed).
   * Uses stable level world bounds so zoom changes never trigger regeneration.
   */
  shouldRegenerate(levelBounds, pathVersion) {
    if (this.needsRegeneration) {
      return true;
    }
    
    if (!this.lastLevelBounds || !levelBounds) {
      return true;
    }
    
    // Check if path changed
    if (this.lastPathVersion !== pathVersion) {
      return true;
    }
    
    // Regenerate when the level size changes (e.g., actual screen resize or fullscreen toggle).
    // Zoom changes do not affect levelBounds, so this check is immune to zoom.
    const sizeThreshold = 0.08;
    const lastWidth = this.lastLevelBounds.maxX - this.lastLevelBounds.minX;
    const lastHeight = this.lastLevelBounds.maxY - this.lastLevelBounds.minY;
    const nextWidth = levelBounds.maxX - levelBounds.minX;
    const nextHeight = levelBounds.maxY - levelBounds.minY;
    if (
      (lastWidth > 0 && Math.abs(nextWidth - lastWidth) > lastWidth * sizeThreshold) ||
      (lastHeight > 0 && Math.abs(nextHeight - lastHeight) > lastHeight * sizeThreshold)
    ) {
      return true;
    }
    
    return false;
  }

  /**
   * Update polygon animations.
   */
  update(deltaTime) {
    if (!this.enabled) {
      return;
    }
    for (const cell of this.cells) {
      cell.update(deltaTime);
    }
  }

  /**
   * Clear cached rasterized layer canvases so the next draw rebuilds them.
   *
   * @param {'background'|'foreground'} [layer]
   */
  clearLayerCanvasCache(layer) {
    if (layer === 'background' || layer === 'foreground') {
      this.layerCanvasCache[layer] = null;
      return;
    }
    this.layerCanvasCache.background = null;
    this.layerCanvasCache.foreground = null;
  }

  /**
   * Build the filtered list of visible cells for the given viewport, using a cache.
   * @private
   */
  _getVisibleCells(viewBounds, layer) {
    const viewKey = viewBounds
      ? `${Math.round(viewBounds.minX)}:${Math.round(viewBounds.minY)}:${Math.round(viewBounds.maxX)}:${Math.round(viewBounds.maxY)}`
      : 'no-bounds';
    const cacheKey = `${layer}|${viewKey}|v${this.cellStateVersion}`;
    if (this.visibleCellsCache?.key === cacheKey) {
      return this.visibleCellsCache.cells;
    }
    const visible = this.cells.filter((cell) => {
      if (cell.layer !== layer) {
        return false;
      }
      if (!viewBounds) {
        return true;
      }
      const padding = VIEW_BOUNDS_PADDING + cell.size;
      return (
        cell.x + padding >= viewBounds.minX &&
        cell.x - padding <= viewBounds.maxX &&
        cell.y + padding >= viewBounds.minY &&
        cell.y - padding <= viewBounds.maxY
      );
    });
    this.visibleCellsCache = { key: cacheKey, cells: visible };
    return visible;
  }

  /**
   * Pre-compute connection coordinate quads for a layer's cells.
   * Returns a flat Float64Array [x1,y1,x2,y2, ...] of pairs that are close enough
   * to warrant a connecting line. Uses squared-distance comparison to avoid sqrt.
   * @private
   * @param {CrystallineCell[]} cells
   * @returns {number[]}
   */
  _computeConnections(cells) {
    const connections = [];
    for (let i = 0; i < cells.length; i++) {
      const cell1 = cells[i];
      for (let j = i + 1; j < cells.length; j++) {
        const cell2 = cells[j];
        const dx = cell2.x - cell1.x;
        const dy = cell2.y - cell1.y;
        const threshold = (cell1.size + cell2.size) * 1.5;
        if (dx * dx + dy * dy < threshold * threshold) {
          connections.push(cell1.x, cell1.y, cell2.x, cell2.y);
        }
      }
    }
    return connections;
  }

  /**
   * Draw a set of cells plus their pre-computed connection lines.
   * Uses setTransform per cell (no save/restore) and batches all connection lines
   * into a single beginPath/stroke call.
   * @private
   * @param {CanvasRenderingContext2D} ctx
   * @param {CrystallineCell[]} cells - Visible cells to draw
   * @param {number[]} connections - Flat coordinate array [x1,y1,x2,y2,...] for this layer
   */
  _drawCells(ctx, cells, connections) {
    // Capture the base transform (pixelRatio + offset set by _getLayerCanvasCache) so each
    // cell can compose its own translate+rotate via a single setTransform call.
    const baseT = ctx.getTransform();
    const baseA = baseT.a;
    const baseD = baseT.d;
    const baseE = baseT.e;
    const baseF = baseT.f;

    for (const cell of cells) {
      const paletteColor = samplePaletteGradient(cell.colorShift);
      // globalAlpha is always 1.0 here: this canvas is freshly cleared by _getLayerCanvasCache
      // and we restore it to 1 after each cell-draw pass, so cell.draw() can set it directly.
      cell.draw(ctx, paletteColor, baseA, baseD, baseE, baseF);
    }

    // Restore the base transform and alpha after per-cell transforms.
    ctx.setTransform(baseA, 0, 0, baseD, baseE, baseF);
    ctx.globalAlpha = 1;

    // Draw faint connecting lines between nearby same-layer cells using the
    // pre-computed coordinate list — single path, single stroke call.
    if (cells.length <= MAX_VISIBLE_CELL_CONNECTIONS) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.1;
      ctx.beginPath();
      for (let k = 0; k < connections.length; k += 4) {
        ctx.moveTo(connections[k], connections[k + 1]);
        ctx.lineTo(connections[k + 2], connections[k + 3]);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Build or reuse a rasterized mosaic layer for the current viewport slice.
   * The resulting bitmap is redrawn only when the camera moves meaningfully or
   * when the slow crystal shimmer crosses the cache interval.
   *
   * @private
   */
  _getLayerCanvasCache(layer, viewBounds, viewCenter, renderState = {}) {
    if (!viewBounds) {
      return null;
    }
    const pixelRatio = Math.max(1, renderState.pixelRatio || 1);
    const timestamp = Number.isFinite(renderState.timestamp) ? renderState.timestamp : 0;
    const animationBucket = Math.floor(timestamp / MOSAIC_LAYER_CACHE_INTERVAL_MS);
    const width = Math.max(1, Math.ceil(viewBounds.maxX - viewBounds.minX));
    const height = Math.max(1, Math.ceil(viewBounds.maxY - viewBounds.minY));
    const parallaxFactor = layer === 'foreground' ? FG_PARALLAX_FACTOR : BG_PARALLAX_FACTOR;
    const offsetX = viewCenter ? viewCenter.x * (1 - parallaxFactor) : 0;
    const offsetY = viewCenter ? viewCenter.y * (1 - parallaxFactor) : 0;

    // Fix 6: Store and compare numeric cache inputs directly – no string building on cache hits.
    const bMinX = bucketCacheCoordinate(viewBounds.minX);
    const bMinY = bucketCacheCoordinate(viewBounds.minY);
    const bMaxX = bucketCacheCoordinate(viewBounds.maxX);
    const bMaxY = bucketCacheCoordinate(viewBounds.maxY);
    const bOffX = bucketCacheCoordinate(offsetX);
    const bOffY = bucketCacheCoordinate(offsetY);

    const existing = this.layerCanvasCache[layer];
    if (existing && existing.canvas &&
        existing.stateVersion === this.cellStateVersion &&
        existing.animBucket === animationBucket &&
        existing.pr === pixelRatio &&
        existing.bMinX === bMinX && existing.bMinY === bMinY &&
        existing.bMaxX === bMaxX && existing.bMaxY === bMaxY &&
        existing.bOffX === bOffX && existing.bOffY === bOffY) {
      return existing;
    }

    const cells = this._getVisibleCells(viewBounds, layer);
    if (!cells.length) {
      this.layerCanvasCache[layer] = null;
      return null;
    }

    // Fix 4: Reuse the existing GPU-backed canvas when dimensions are unchanged to avoid GC churn.
    const targetW = Math.max(1, Math.ceil(width * pixelRatio));
    const targetH = Math.max(1, Math.ceil(height * pixelRatio));
    let canvas = existing?.canvas;
    if (!canvas || canvas.width !== targetW || canvas.height !== targetH) {
      canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
    }
    const cacheCtx = canvas.getContext('2d');
    if (!cacheCtx) {
      return null;
    }
    cacheCtx.clearRect(0, 0, targetW, targetH);

    // Mirror the world-space layer translation on the offscreen canvas so the bitmap blits back in place.
    cacheCtx.setTransform(
      pixelRatio,
      0,
      0,
      pixelRatio,
      (offsetX - viewBounds.minX) * pixelRatio,
      (offsetY - viewBounds.minY) * pixelRatio,
    );

    // Use the pre-computed connection list for this layer.
    const connections = layer === 'background' ? this.backgroundConnections : this.foregroundConnections;
    this._drawCells(cacheCtx, cells, connections);

    // Fix 6: Store numeric fields so the next cache check is pure numeric comparison.
    this.layerCanvasCache[layer] = {
      canvas,
      width,
      height,
      stateVersion: this.cellStateVersion,
      animBucket: animationBucket,
      pr: pixelRatio,
      bMinX, bMinY, bMaxX, bMaxY,
      bOffX, bOffY,
    };
    return this.layerCanvasCache[layer];
  }

  /**
   * Ensure cells are generated (shared between renderBackground and renderForeground).
   * @private
   */
  _ensureCells(viewBounds, levelBounds, pathPoints, pathVersion) {
    const generationBounds = levelBounds || viewBounds;
    if (this.shouldRegenerate(generationBounds, pathVersion)) {
      this.generateCells(generationBounds, pathPoints, pathVersion);
      this.lastLevelBounds = generationBounds ? { ...generationBounds } : null;
      this.lastPathVersion = pathVersion;
    }
  }

  /**
   * Render background-layer shards with a slow parallax offset.
   * Background shards are crisp and appear to be further away than game elements.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} viewBounds - Viewport culling bounds {minX, minY, maxX, maxY}
   * @param {object} levelBounds - Stable level bounds for crystal generation
   * @param {Array} pathPoints
   * @param {string|number} pathVersion
   * @param {{x:number,y:number}} viewCenter - Current camera centre for parallax
   */
  renderBackground(ctx, viewBounds, levelBounds, pathPoints, pathVersion, viewCenter, renderState = null) {
    if (!this.enabled) {
      return;
    }
    this._ensureCells(viewBounds, levelBounds, pathPoints, pathVersion);
    if (this.cells.length === 0) {
      return;
    }
    const cache = this._getLayerCanvasCache('background', viewBounds, viewCenter, renderState || {});
    if (!cache?.canvas) {
      return;
    }
    ctx.drawImage(cache.canvas, viewBounds.minX, viewBounds.minY, cache.width, cache.height);
  }

  /**
   * Render foreground-layer shards with a fast parallax offset.
   * Foreground shards are blurred and appear in front of all game elements.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} viewBounds - Viewport culling bounds
   * @param {object} levelBounds - Stable level bounds for crystal generation
   * @param {Array} pathPoints
   * @param {string|number} pathVersion
   * @param {{x:number,y:number}} viewCenter - Current camera centre for parallax
   */
  renderForeground(ctx, viewBounds, levelBounds, pathPoints, pathVersion, viewCenter, renderState = null) {
    if (!this.enabled) {
      return;
    }
    this._ensureCells(viewBounds, levelBounds, pathPoints, pathVersion);
    if (this.cells.length === 0) {
      return;
    }
    const cache = this._getLayerCanvasCache('foreground', viewBounds, viewCenter, renderState || {});
    if (!cache?.canvas) {
      return;
    }
    ctx.drawImage(cache.canvas, viewBounds.minX, viewBounds.minY, cache.width, cache.height);
  }

  /**
   * Enable or disable the mosaic
   */
  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) {
      this.cells = [];
      this.clearLayerCanvasCache();
    } else {
      this.needsRegeneration = true;
    }
  }

  /**
   * Force regeneration of cells (e.g., when color scheme changes)
   */
  forceRegeneration() {
    this.needsRegeneration = true;
    this.clearLayerCanvasCache();
    clearShardSpriteCache(); // Clear cache when color scheme changes
  }

  /**
   * Clear all cells
   */
  clear() {
    this.cells = [];
    this.backgroundConnections = [];
    this.foregroundConnections = [];
    this.needsRegeneration = true;
    this.clearLayerCanvasCache();
  }
}

// Singleton instance for the playfield
let mosaicInstance = null;

/**
 * Get the crystalline mosaic manager instance
 */
export function getCrystallineMosaicManager() {
  if (!mosaicInstance) {
    mosaicInstance = new CrystallineMosaicManager();
  }
  return mosaicInstance;
}

/**
 * Reset the mosaic manager (for testing/initialization)
 */
export function resetCrystallineMosaicManager() {
  mosaicInstance = null;
}
