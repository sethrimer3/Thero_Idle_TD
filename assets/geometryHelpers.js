// Geometry Helper Functions
// Extracted from main.js to centralize normalized coordinate math for level editing and previews.

/**
 * Clamp a normalized coordinate to the allowed editor bounds.
 * @param {number} value - The normalized coordinate value to clamp (0-1 expected).
 * @returns {number} A normalized coordinate restricted to the editor safe area.
 */
export function clampNormalizedCoordinate(value) {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.min(0.98, Math.max(0.02, value));
}

/**
 * Ensure a point object contains valid normalized coordinates.
 * @param {{x:number, y:number}|null|undefined} point - A potential normalized point.
 * @returns {{x:number, y:number}} A sanitized point with safe normalized coordinates.
 */
export function sanitizeNormalizedPoint(point) {
  if (!point || typeof point !== 'object') {
    return { x: 0.5, y: 0.5 };
  }
  const rawX = Number.isFinite(point.x) ? point.x : 0.5;
  const rawY = Number.isFinite(point.y) ? point.y : 0.5;
  return {
    x: clampNormalizedCoordinate(rawX),
    y: clampNormalizedCoordinate(rawY),
  };
}

/**
 * Transform a normalized point based on screen orientation.
 * @param {{x:number, y:number}} point - The source point in default orientation.
 * @param {'portrait'|'landscape'} orientation - Current device orientation.
 * @returns {{x:number, y:number}} The transformed point respecting orientation.
 */
export function transformPointForOrientation(point, orientation) {
  const normalized = sanitizeNormalizedPoint(point);
  if (orientation === 'landscape') {
    return {
      x: clampNormalizedCoordinate(normalized.y),
      y: clampNormalizedCoordinate(1 - normalized.x),
    };
  }
  return normalized;
}

/**
 * Transform a normalized point back to portrait orientation.
 * @param {{x:number, y:number}} point - The point in the current orientation.
 * @param {'portrait'|'landscape'} orientation - Current device orientation.
 * @returns {{x:number, y:number}} The point normalized for portrait orientation.
 */
export function transformPointFromOrientation(point, orientation) {
  const normalized = sanitizeNormalizedPoint(point);
  if (orientation === 'landscape') {
    return {
      x: clampNormalizedCoordinate(1 - normalized.y),
      y: clampNormalizedCoordinate(normalized.x),
    };
  }
  return normalized;
}

/**
 * Compute the squared distance from a point to a line segment.
 * @param {{x:number, y:number}} point - The point being measured.
 * @param {{x:number, y:number}} start - Start point of the segment.
 * @param {{x:number, y:number}} end - End point of the segment.
 * @returns {number} The squared shortest distance between the point and segment.
 */
export function distanceSquaredToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    const diffX = point.x - start.x;
    const diffY = point.y - start.y;
    return diffX * diffX + diffY * diffY;
  }
  let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  const projX = start.x + t * dx;
  const projY = start.y + t * dy;
  const diffX = point.x - projX;
  const diffY = point.y - projY;
  return diffX * diffX + diffY * diffY;
}
