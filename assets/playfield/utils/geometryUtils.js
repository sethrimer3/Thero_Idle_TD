// Geometry utility functions for playfield layout and positioning

// Clone a normalized point while constraining it to the valid 0?1 range.
export function cloneNormalizedPoint(point) {
  if (!point || typeof point !== 'object') {
    return { x: 0, y: 0 };
  }
  const x = Number.isFinite(point.x) ? point.x : 0;
  const y = Number.isFinite(point.y) ? point.y : 0;
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  };
}

// Rotate a normalized point 90? clockwise around the playfield center.
export function rotateNormalizedPointClockwise(point) {
  const base = cloneNormalizedPoint(point);
  const rotated = {
    x: base.y,
    y: 1 - base.x,
  };
  return {
    x: Math.max(0, Math.min(1, rotated.x)),
    y: Math.max(0, Math.min(1, rotated.y)),
  };
}

// Compute suitable floater count based on canvas dimensions
export function computeFloaterCount(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return 0;
  }
  const area = Math.max(0, width * height);
  const base = Math.round(area / 24000);
  return Math.max(18, Math.min(64, base));
}

// Generate a random floater radius factor for visual variety
export function randomFloaterRadiusFactor() {
  return 0.0075 + Math.random() * 0.0045;
}

// Create a floater object with randomized position and properties
export function createFloater(width, height) {
  const margin = Math.min(width, height) * 0.08;
  const usableWidth = Math.max(1, width - margin * 2);
  const usableHeight = Math.max(1, height - margin * 2);
  return {
    x: margin + Math.random() * usableWidth,
    y: margin + Math.random() * usableHeight,
    vx: (Math.random() - 0.5) * 12,
    vy: (Math.random() - 0.5) * 12,
    ax: 0,
    ay: 0,
    radiusFactor: randomFloaterRadiusFactor(),
    opacity: 0,
    opacityTarget: 0,
  };
}
