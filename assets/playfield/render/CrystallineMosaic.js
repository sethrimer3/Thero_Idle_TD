/**
 * Crystalline Triangle Mosaic Background
 * Renders a mosaic of differently-sized triangles in the empty space of the playing field,
 * using shades from the selected color palette gradient. Triangles slowly fade in brightness
 * and along the color palette gradient for a dynamic crystalline effect.
 */

import { metersToPixels } from '../../gameUnits.js';
import { samplePaletteGradient } from '../../colorSchemeUtils.js';

// Configuration constants
const MINIMUM_DISTANCE_FROM_TRACK_METERS = 5; // Only render triangles 5+ meters from track
const TRIANGLE_SIZE_MIN = 15; // Minimum triangle size in pixels
const TRIANGLE_SIZE_MAX = 80; // Maximum triangle size in pixels
const TRIANGLE_DENSITY = 0.0008; // Triangles per square pixel (controls spacing)
const FADE_SPEED = 0.000025; // Speed of brightness/color fade animation (5% of original speed)
const BRIGHTNESS_MIN = 0.3; // Minimum brightness multiplier
const BRIGHTNESS_MAX = 0.9; // Maximum brightness multiplier
const ALPHA_BASE = 0.15; // Base transparency for triangles
const ALPHA_VARIATION = 0.1; // Additional alpha variation

/**
 * Triangle class representing a single crystalline triangle
 */
class CrystallineTriangle {
  constructor(x, y, size, colorStop, phase) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.colorStop = colorStop; // Position along gradient (0-1)
    this.rotation = Math.random() * Math.PI * 2;
    // Make triangles interlocking by varying orientation (some point up, some down)
    this.pointsUp = Math.random() < 0.5;
    this.phase = phase; // Animation phase offset
    this.brightness = BRIGHTNESS_MIN + Math.random() * (BRIGHTNESS_MAX - BRIGHTNESS_MIN);
  }

  /**
   * Update triangle animation state
   */
  update(deltaTime) {
    // Slowly oscillate brightness
    this.phase += FADE_SPEED * deltaTime;
    this.brightness = BRIGHTNESS_MIN + (BRIGHTNESS_MAX - BRIGHTNESS_MIN) * 
                      (0.5 + 0.5 * Math.sin(this.phase));
  }

  /**
   * Render the triangle to the canvas
   */
  draw(ctx, paletteColor) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Apply brightness multiplier to the palette color
    const r = Math.floor(paletteColor.r * this.brightness);
    const g = Math.floor(paletteColor.g * this.brightness);
    const b = Math.floor(paletteColor.b * this.brightness);
    const alpha = ALPHA_BASE + Math.random() * ALPHA_VARIATION;

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    
    // Draw interlocking triangle (pointing up or down based on orientation)
    ctx.beginPath();
    const h = this.size * Math.sqrt(3) / 2;
    if (this.pointsUp) {
      // Triangle pointing up
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(-this.size / 2, h / 2);
      ctx.lineTo(this.size / 2, h / 2);
    } else {
      // Triangle pointing down (interlocking)
      ctx.moveTo(0, h / 2);
      ctx.lineTo(-this.size / 2, -h / 2);
      ctx.lineTo(this.size / 2, -h / 2);
    }
    ctx.closePath();
    ctx.fill();

    // Optional subtle stroke for definition
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
 * Main Crystalline Mosaic Manager
 */
export class CrystallineMosaicManager {
  constructor() {
    this.triangles = [];
    this.enabled = true;
    this.needsRegeneration = true;
    this.lastViewBounds = null;
    this.lastPathVersion = null;
  }

  /**
   * Generate triangles for the visible viewport
   */
  generateTriangles(viewBounds, pathPoints) {
    if (!this.enabled || !viewBounds) {
      return;
    }

    const minDistancePixels = metersToPixels(MINIMUM_DISTANCE_FROM_TRACK_METERS);
    
    // Calculate area to cover
    const width = viewBounds.maxX - viewBounds.minX;
    const height = viewBounds.maxY - viewBounds.minY;
    const area = width * height;
    
    // Calculate number of triangles based on density
    const targetCount = Math.floor(area * TRIANGLE_DENSITY);
    
    this.triangles = [];
    let attempts = 0;
    const maxAttempts = targetCount * 3; // Limit attempts to avoid infinite loops
    
    while (this.triangles.length < targetCount && attempts < maxAttempts) {
      attempts++;
      
      // Random position within view bounds
      const x = viewBounds.minX + Math.random() * width;
      const y = viewBounds.minY + Math.random() * height;
      
      // Check if far enough from track
      if (!isPointFarFromTrack(x, y, pathPoints, minDistancePixels)) {
        continue;
      }
      
      // Random size and gradient position
      const size = TRIANGLE_SIZE_MIN + Math.random() * (TRIANGLE_SIZE_MAX - TRIANGLE_SIZE_MIN);
      const colorStop = Math.random(); // Position along gradient
      const phase = Math.random() * Math.PI * 2; // Random animation phase
      
      this.triangles.push(new CrystallineTriangle(x, y, size, colorStop, phase));
    }
    
    this.needsRegeneration = false;
  }

  /**
   * Check if triangles need regeneration (viewport changed significantly)
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
   * Update triangle animations
   */
  update(deltaTime) {
    if (!this.enabled) {
      return;
    }
    
    for (const triangle of this.triangles) {
      triangle.update(deltaTime);
    }
  }

  /**
   * Render all triangles
   */
  render(ctx, viewBounds, pathPoints, pathVersion) {
    if (!this.enabled) {
      return;
    }
    
    // Check if we need to regenerate triangles
    if (this.shouldRegenerate(viewBounds, pathVersion)) {
      this.generateTriangles(viewBounds, pathPoints);
      this.lastViewBounds = viewBounds ? { ...viewBounds } : null;
      this.lastPathVersion = pathVersion;
    }
    
    if (this.triangles.length === 0) {
      return;
    }
    
    ctx.save();
    
    // Render each triangle with its gradient color
    for (const triangle of this.triangles) {
      const paletteColor = samplePaletteGradient(triangle.colorStop);
      triangle.draw(ctx, paletteColor);
    }
    
    ctx.restore();
  }

  /**
   * Enable or disable the mosaic
   */
  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) {
      this.triangles = [];
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
    this.triangles = [];
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
