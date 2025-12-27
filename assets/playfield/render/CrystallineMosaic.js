/**
 * Crystalline Voronoi Mosaic Background
 * Renders a mosaic of Voronoi-like polygon cells near the edge of the playing field,
 * using shades from the selected color palette gradient. Cells slowly fade in brightness
 * and drift along the color palette gradient for a dynamic crystalline effect.
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
const CELL_VERTEX_MIN = 5; // Minimum number of polygon vertices per cell.
const CELL_VERTEX_MAX = 8; // Maximum number of polygon vertices per cell.
const CELL_SPACING_RATIO = 0.9; // Minimum spacing between seeds relative to cell size.
const FADE_SPEED = 0.000018; // Slow the brightness/color fade animation.
const BRIGHTNESS_MIN = 0.35; // Minimum brightness multiplier.
const BRIGHTNESS_MAX = 0.85; // Maximum brightness multiplier.
const ALPHA_BASE = 0.16; // Base transparency for polygon cells.
const ALPHA_VARIATION = 0.08; // Additional alpha variation for subtle depth.
const COLOR_DRIFT = 0.08; // Gradient travel distance for slow color drift.

/**
 * Polygon cell representing a single crystalline Voronoi-like region.
 */
class CrystallineCell {
  constructor(x, y, size, colorStop, phase, vertexCount) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.colorStop = colorStop; // Base position along gradient (0-1).
    this.phase = phase; // Animation phase offset.
    this.vertexCount = vertexCount;
    this.brightness = BRIGHTNESS_MIN + Math.random() * (BRIGHTNESS_MAX - BRIGHTNESS_MIN);
    this.vertices = this.buildCellVertices(); // Cache vertices for a stable interlocking feel.
    this.colorShift = colorStop; // Track the animated gradient position.
    this.alphaBase = ALPHA_BASE + Math.random() * ALPHA_VARIATION; // Cache alpha for steady translucency.
  }

  /**
   * Build the polygon vertices for a Voronoi-like cell silhouette.
   */
  buildCellVertices() {
    // Randomize vertex angles to mimic irregular Voronoi edges.
    const angles = [];
    for (let i = 0; i < this.vertexCount; i += 1) {
      angles.push(Math.random() * Math.PI * 2);
    }
    angles.sort((a, b) => a - b);

    // Scale each radius slightly to create a faceted cell edge.
    return angles.map((angle) => ({
      angle,
      radius: this.size * (0.7 + Math.random() * 0.35),
    }));
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
   * Render the polygon cell to the canvas.
   */
  draw(ctx, paletteColor) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Apply brightness multiplier to the palette color.
    const r = Math.floor(paletteColor.r * this.brightness);
    const g = Math.floor(paletteColor.g * this.brightness);
    const b = Math.floor(paletteColor.b * this.brightness);
    const alpha = this.alphaBase + 0.05 * Math.sin(this.phase * 0.4);

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    
    // Draw irregular polygon to mimic a Voronoi cell.
    ctx.beginPath();
    this.vertices.forEach((vertex, index) => {
      const vx = Math.cos(vertex.angle) * vertex.radius;
      const vy = Math.sin(vertex.angle) * vertex.radius;
      if (index === 0) {
        ctx.moveTo(vx, vy);
      } else {
        ctx.lineTo(vx, vy);
      }
    });
    ctx.closePath();
    ctx.fill();

    // Subtle stroke for definition.
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.restore();
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
      const vertexCount =
        CELL_VERTEX_MIN + Math.floor(Math.random() * (CELL_VERTEX_MAX - CELL_VERTEX_MIN + 1));
      
      this.cells.push(new CrystallineCell(x, y, size, colorStop, phase, vertexCount));
    }
    
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
   * Render all polygon cells.
   */
  render(ctx, viewBounds, pathPoints, pathVersion) {
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
    
    // Render each polygon cell with its gradient color.
    for (const cell of this.cells) {
      const paletteColor = samplePaletteGradient(cell.colorShift);
      cell.draw(ctx, paletteColor);
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
   * Force regeneration of triangles (e.g., when color scheme changes)
   */
  forceRegeneration() {
    this.needsRegeneration = true;
  }

  /**
   * Clear all triangles
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
