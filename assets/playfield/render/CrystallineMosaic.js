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

// Shard sprite configuration
const SHARD_SPRITE_COUNT = 37; // Number of shard SVG sprites available (1-37)
const SHARD_SPRITE_PATH = 'assets/sprites/shards/shard (INDEX).svg';
const CACHE_MAX_SIZE = 500; // Maximum number of cached colored sprites
const BRIGHTNESS_PRECISION = 10; // Rounding precision for brightness in cache keys

// Sprite and cache management
const shardSprites = []; // Array of loaded Image objects
const shardSpriteCache = new Map(); // Cache for colored sprite canvases
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
 * Create a colored version of a shard sprite and cache it
 * @param {number} spriteIndex - Index of the sprite to color
 * @param {Object} color - RGB color object {r, g, b}
 * @param {number} brightness - Brightness multiplier
 * @returns {HTMLCanvasElement|null} Cached colored sprite canvas
 */
function getColoredShardSprite(spriteIndex, color, brightness) {
  if (!spritesLoaded || spriteIndex < 0 || spriteIndex >= shardSprites.length) {
    return null;
  }

  const sprite = shardSprites[spriteIndex];
  if (!sprite || !sprite.complete || !sprite.naturalWidth) {
    return null;
  }

  // Create cache key based on sprite index, color, and brightness (rounded to reduce cache size)
  const brightnessRounded = Math.round(brightness * BRIGHTNESS_PRECISION) / BRIGHTNESS_PRECISION;
  const cacheKey = `${spriteIndex}_${color.r}_${color.g}_${color.b}_${brightnessRounded}`;

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

  // Apply color and brightness to each pixel
  const r = Math.floor(color.r * brightness);
  const g = Math.floor(color.g * brightness);
  const b = Math.floor(color.b * brightness);

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
}

// Start loading sprites immediately
loadShardSprites();

// Cell health and destruction constants
const CELL_MAX_HEALTH = 50; // Health points for each cell
const CELL_HEALTH_BAR_WIDTH = 30; // Width of health bar in pixels
const CELL_HEALTH_BAR_HEIGHT = 3; // Height of health bar in pixels
const CELL_DESTRUCTION_FADE_TIME = 500; // Milliseconds for destruction fade animation

// Counter for unique cell IDs
let cellIdCounter = 0;

/**
 * Polygon cell representing a single crystalline Voronoi-like region.
 * Now uses SVG sprites that are colored with the palette.
 * Targetable and destructible by towers.
 */
class CrystallineCell {
  constructor(x, y, size, colorStop, phase) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.colorStop = colorStop; // Base position along gradient (0-1).
    this.phase = phase; // Animation phase offset.
    this.brightness = BRIGHTNESS_MIN + Math.random() * (BRIGHTNESS_MAX - BRIGHTNESS_MIN);
    this.colorShift = colorStop; // Track the animated gradient position.
    this.alphaBase = ALPHA_BASE + Math.random() * ALPHA_VARIATION; // Cache alpha for steady translucency.
    
    // Random sprite selection (0-based index for the array)
    this.spriteIndex = Math.floor(Math.random() * SHARD_SPRITE_COUNT);
    
    // Random rotation for variety
    this.rotation = Math.random() * Math.PI * 2;
    
    // Targetable properties
    this.id = `cell_${cellIdCounter++}`; // Unique identifier
    this.maxHealth = CELL_MAX_HEALTH;
    this.health = CELL_MAX_HEALTH;
    this.isDestroyed = false;
    this.destroyStartTime = null;
    this.hitRadius = size; // Use size as hit detection radius
  }

  /**
   * Update polygon animation state and destruction.
   */
  update(deltaTime) {
    // Handle destruction fade
    if (this.isDestroyed) {
      return; // Don't update destroyed cells
    }
    
    // Slowly oscillate brightness for the crystalline shimmer.
    this.phase += FADE_SPEED * deltaTime;
    this.brightness =
      BRIGHTNESS_MIN +
      (BRIGHTNESS_MAX - BRIGHTNESS_MIN) * (0.5 + 0.5 * Math.sin(this.phase));
    // Drift along the palette gradient to mimic slow chromatic refraction.
    this.colorShift = (this.colorStop + COLOR_DRIFT * (0.5 + 0.5 * Math.sin(this.phase * 0.6))) % 1;
  }
  
  /**
   * Damage the cell and check if it should be destroyed.
   * @param {number} damage - Amount of damage to apply
   * @returns {boolean} True if cell was destroyed
   */
  takeDamage(damage) {
    if (this.isDestroyed) {
      return false;
    }
    
    this.health = Math.max(0, this.health - damage);
    if (this.health <= 0) {
      this.isDestroyed = true;
      this.destroyStartTime = Date.now();
      return true;
    }
    return false;
  }
  
  /**
   * Check if a point is inside this cell.
   * @param {number} px - Point X coordinate
   * @param {number} py - Point Y coordinate
   * @returns {boolean} True if point is inside cell
   */
  containsPoint(px, py) {
    if (this.isDestroyed) {
      return false;
    }
    
    // Simple circular hit detection using hit radius
    const dx = px - this.x;
    const dy = py - this.y;
    return (dx * dx + dy * dy) <= (this.hitRadius * this.hitRadius);
  }

  /**
   * Render the cell using SVG sprite to the canvas.
   */
  draw(ctx, paletteColor, showHealthBar = false) {
    if (this.isDestroyed) {
      // Fade out destroyed cells
      const elapsed = Date.now() - this.destroyStartTime;
      if (elapsed > CELL_DESTRUCTION_FADE_TIME) {
        return; // Fully faded, don't render
      }
      const fadeAlpha = 1 - (elapsed / CELL_DESTRUCTION_FADE_TIME);
      ctx.globalAlpha = fadeAlpha;
    }
    
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Apply brightness multiplier to the palette color.
    const r = Math.floor(paletteColor.r * this.brightness);
    const g = Math.floor(paletteColor.g * this.brightness);
    const b = Math.floor(paletteColor.b * this.brightness);
    const alpha = this.alphaBase + 0.05 * Math.sin(this.phase * 0.4);

    // Get colored sprite from cache
    const coloredSprite = getColoredShardSprite(this.spriteIndex, { r, g, b }, this.brightness);
    
    if (coloredSprite) {
      // Calculate scale to fit the desired size
      const spriteSize = Math.max(coloredSprite.width, coloredSprite.height);
      const scale = (this.size * 2) / spriteSize;
      
      // Apply alpha
      ctx.globalAlpha *= alpha;
      
      // Draw the colored sprite centered
      ctx.drawImage(
        coloredSprite,
        -coloredSprite.width * scale / 2,
        -coloredSprite.height * scale / 2,
        coloredSprite.width * scale,
        coloredSprite.height * scale
      );
    } else {
      // Fallback: draw a simple polygon if sprites aren't loaded yet
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw health bar if requested and cell is damaged
    if (showHealthBar && this.health < this.maxHealth && !this.isDestroyed) {
      this.drawHealthBar(ctx);
    }

    ctx.restore();
    
    if (this.isDestroyed) {
      ctx.globalAlpha = 1; // Reset alpha
    }
  }
  
  /**
   * Draw health bar above the cell.
   */
  drawHealthBar(ctx) {
    const barX = -CELL_HEALTH_BAR_WIDTH / 2;
    const barY = -this.size - 10; // Position above cell
    const healthPercent = this.health / this.maxHealth;
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX, barY, CELL_HEALTH_BAR_WIDTH, CELL_HEALTH_BAR_HEIGHT);
    
    // Health bar
    ctx.fillStyle = healthPercent > 0.5 ? 'rgba(100, 200, 100, 0.9)' : 
                    healthPercent > 0.25 ? 'rgba(200, 200, 50, 0.9)' : 
                    'rgba(200, 50, 50, 0.9)';
    ctx.fillRect(barX, barY, CELL_HEALTH_BAR_WIDTH * healthPercent, CELL_HEALTH_BAR_HEIGHT);
    
    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, CELL_HEALTH_BAR_WIDTH, CELL_HEALTH_BAR_HEIGHT);
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
 * Main Crystalline Mosaic Manager
 */
export class CrystallineMosaicManager {
  constructor() {
    this.cells = [];
    this.enabled = true;
    this.needsRegeneration = true;
    this.lastViewBounds = null;
    this.lastPathVersion = null;
    // Track cell mutations so cached visible lists stay valid.
    this.cellStateVersion = 0;
    // Cache the last visible-cell list to avoid rebuilding every frame.
    this.visibleCellsCache = null;
  }

  /**
   * Generate polygon cells for the visible viewport.
   */
  generateCells(viewBounds, pathPoints) {
    if (!this.enabled || !viewBounds) {
      return;
    }

    const minDistancePixels = metersToPixels(MINIMUM_DISTANCE_FROM_TRACK_METERS);
    // Use a pixel-based edge band so the mosaic hugs the playfield borders.
    const edgeBandPixels = Math.max(
      EDGE_BAND_MIN_PIXELS,
      Math.min(viewBounds.maxX - viewBounds.minX, viewBounds.maxY - viewBounds.minY) * EDGE_BAND_FRACTION,
    );
    
    // Calculate area to cover
    const width = viewBounds.maxX - viewBounds.minX;
    const height = viewBounds.maxY - viewBounds.minY;
    const area = width * height;
    
    // Calculate number of cells based on density.
    const targetCount = Math.floor(area * CELL_DENSITY);
    
    this.cells = [];
    let attempts = 0;
    const maxAttempts = targetCount * 5; // Limit attempts to avoid infinite loops.
    
    while (this.cells.length < targetCount && attempts < maxAttempts) {
      attempts++;
      
      // Random position within view bounds.
      const x = viewBounds.minX + Math.random() * width;
      const y = viewBounds.minY + Math.random() * height;
      
      // Keep the mosaic close to the viewport edges.
      if (!isPointNearEdge(x, y, viewBounds, edgeBandPixels)) {
        continue;
      }

      // Check if far enough from track.
      if (!isPointFarFromTrack(x, y, pathPoints, minDistancePixels)) {
        continue;
      }
      
      // Random size and gradient position.
      const size = CELL_SIZE_MIN + Math.random() * (CELL_SIZE_MAX - CELL_SIZE_MIN);
      // Set seed spacing based on the cell size to prevent heavy overlap.
      const minSpacing = size * CELL_SPACING_RATIO;
      if (!isPointFarFromSeeds(x, y, this.cells, minSpacing)) {
        continue;
      }
      const colorStop = Math.random(); // Position along gradient.
      const phase = Math.random() * Math.PI * 2; // Random animation phase.
      
      this.cells.push(new CrystallineCell(x, y, size, colorStop, phase));
    }
    // Bump the state version so render caches refresh after regeneration.
    this.cellStateVersion += 1;
    // Clear cached visibility lists after generating a new layout.
    this.visibleCellsCache = null;
    this.needsRegeneration = false;
  }

  /**
   * Check if cells need regeneration (viewport changed significantly).
   */
  shouldRegenerate(viewBounds, pathVersion) {
    if (this.needsRegeneration) {
      return true;
    }
    
    if (!this.lastViewBounds || !viewBounds) {
      return true;
    }
    
    // Check if path changed
    if (this.lastPathVersion !== pathVersion) {
      return true;
    }
    
    // Check if viewport moved significantly (more than 30% of viewport size)
    const threshold = 0.3;
    const lastWidth = this.lastViewBounds.maxX - this.lastViewBounds.minX;
    const lastHeight = this.lastViewBounds.maxY - this.lastViewBounds.minY;
    const nextWidth = viewBounds.maxX - viewBounds.minX;
    const nextHeight = viewBounds.maxY - viewBounds.minY;

    // Regenerate when the viewport size changes so edge crystals stay aligned after resizes/fullscreen changes.
    const sizeThreshold = 0.08;
    if (
      (lastWidth > 0 && Math.abs(nextWidth - lastWidth) > lastWidth * sizeThreshold) ||
      (lastHeight > 0 && Math.abs(nextHeight - lastHeight) > lastHeight * sizeThreshold)
    ) {
      return true;
    }
    
    const deltaX = Math.abs((viewBounds.minX + viewBounds.maxX) / 2 - 
                            (this.lastViewBounds.minX + this.lastViewBounds.maxX) / 2);
    const deltaY = Math.abs((viewBounds.minY + viewBounds.maxY) / 2 - 
                            (this.lastViewBounds.minY + this.lastViewBounds.maxY) / 2);
    
    if (deltaX > lastWidth * threshold || deltaY > lastHeight * threshold) {
      return true;
    }
    
    return false;
  }

  /**
   * Update polygon animations and remove destroyed cells.
   */
  update(deltaTime) {
    if (!this.enabled) {
      return;
    }
    
    // Update all cells
    for (const cell of this.cells) {
      cell.update(deltaTime);
    }
    
    // Remove fully faded destroyed cells
    const now = Date.now();
    const previousCellCount = this.cells.length;
    this.cells = this.cells.filter(cell => {
      if (!cell.isDestroyed) {
        return true;
      }
      const elapsed = now - cell.destroyStartTime;
      return elapsed <= CELL_DESTRUCTION_FADE_TIME;
    });
    // Refresh render caches whenever cells are culled after fading out.
    if (this.cells.length !== previousCellCount) {
      this.cellStateVersion += 1;
      this.visibleCellsCache = null;
    }
  }
  
  /**
   * Find a cell at the given position.
   * @param {Object} position - {x, y} coordinates
   * @returns {CrystallineCell|null} The cell at this position, or null
   */
  findCellAt(position) {
    if (!this.enabled || !position) {
      return null;
    }
    
    // Check cells in reverse order (render order) for better hit detection
    for (let i = this.cells.length - 1; i >= 0; i--) {
      const cell = this.cells[i];
      if (cell.containsPoint(position.x, position.y)) {
        return cell;
      }
    }
    
    return null;
  }
  
  /**
   * Get all alive (non-destroyed) cells.
   * @returns {Array<CrystallineCell>} Array of alive cells
   */
  getAliveCells() {
    return this.cells.filter(cell => !cell.isDestroyed);
  }
  
  /**
   * Damage a cell by ID.
   * @param {string} cellId - The cell ID to damage
   * @param {number} damage - Amount of damage
   * @returns {boolean} True if cell was destroyed
   */
  damageCellById(cellId, damage) {
    const cell = this.cells.find(c => c.id === cellId);
    if (cell) {
      const destroyed = cell.takeDamage(damage);
      // Invalidate visibility cache when a cell is destroyed mid-frame.
      if (destroyed) {
        this.cellStateVersion += 1;
        this.visibleCellsCache = null;
      }
      return destroyed;
    }
    return false;
  }
  
  /**
   * Get cell by ID.
   * @param {string} cellId - The cell ID
   * @returns {CrystallineCell|null} The cell or null
   */
  getCellById(cellId) {
    return this.cells.find(c => c.id === cellId) || null;
  }

  /**
   * Render all cells with SVG sprites using unified appearance.
   */
  render(ctx, viewBounds, pathPoints, pathVersion, focusedCellId = null) {
    if (!this.enabled) {
      return;
    }
    
    // Check if we need to regenerate cells.
    if (this.shouldRegenerate(viewBounds, pathVersion)) {
      this.generateCells(viewBounds, pathPoints);
      this.lastViewBounds = viewBounds ? { ...viewBounds } : null;
      this.lastPathVersion = pathVersion;
    }
    
    if (this.cells.length === 0) {
      return;
    }
    
    ctx.save();
    // Cull to visible cells so the edge mosaic stays lightweight during camera movement.
    const viewKey = viewBounds
      ? `${Math.round(viewBounds.minX)}:${Math.round(viewBounds.minY)}:${Math.round(viewBounds.maxX)}:${Math.round(viewBounds.maxY)}`
      : 'no-bounds';
    const cacheKey = `${viewKey}|v${this.cellStateVersion}`;
    const cachedCells = this.visibleCellsCache?.key === cacheKey ? this.visibleCellsCache.cells : null;
    const visibleCells = cachedCells || this.cells.filter((cell) => {
      if (cell.isDestroyed) {
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
    // Cache the latest visibility list so subsequent frames reuse the culled set.
    if (!cachedCells) {
      this.visibleCellsCache = { key: cacheKey, cells: visibleCells };
    }
    
    // First pass: Render all cell fills to create unified mass
    for (const cell of visibleCells) {
      const paletteColor = samplePaletteGradient(cell.colorShift);
      const showHealthBar = focusedCellId && cell.id === focusedCellId;
      cell.draw(ctx, paletteColor, showHealthBar);
    }
    
    // Second pass: Draw unified outline/edges to make them look connected
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; // Subtle unified edge color
    ctx.lineWidth = 2;
    ctx.globalCompositeOperation = 'source-over';
    
    // Draw connecting lines between nearby cells to enhance unified appearance.
    if (visibleCells.length <= MAX_VISIBLE_CELL_CONNECTIONS) {
      for (let i = 0; i < visibleCells.length; i++) {
        const cell1 = visibleCells[i];
        
        for (let j = i + 1; j < visibleCells.length; j++) {
          const cell2 = visibleCells[j];
          
          const dx = cell2.x - cell1.x;
          const dy = cell2.y - cell1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Connect cells that are close together.
          if (distance < (cell1.size + cell2.size) * 1.5) {
            ctx.beginPath();
            ctx.moveTo(cell1.x, cell1.y);
            ctx.lineTo(cell2.x, cell2.y);
            ctx.globalAlpha = 0.1;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }
    }
    
    ctx.restore();
  }

  /**
   * Enable or disable the mosaic
   */
  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) {
      this.cells = [];
    } else {
      this.needsRegeneration = true;
    }
  }

  /**
   * Force regeneration of cells (e.g., when color scheme changes)
   */
  forceRegeneration() {
    this.needsRegeneration = true;
    clearShardSpriteCache(); // Clear cache when color scheme changes
  }

  /**
   * Clear all cells
   */
  clear() {
    this.cells = [];
    this.needsRegeneration = true;
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
