// Mathematical utility functions for playfield calculations

// Cubic easing helpers keep supply motes and swirl launches smooth and consistent with tower bursts.
export const easeInCubic = (value) => {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * clamped;
};

export const easeOutCubic = (value) => {
  const clamped = Math.max(0, Math.min(1, value));
  const inverted = 1 - clamped;
  return 1 - inverted * inverted * inverted;
};

// Normalize angle into the [0, 2?) range for consistent orbital math
export function normalizeAngle(angle) {
  if (!Number.isFinite(angle)) {
    return 0;
  }
  let normalized = angle % (Math.PI * 2);
  if (normalized < 0) {
    normalized += Math.PI * 2;
  }
  return normalized;
}

// Measure the smallest angular difference between two radians values
export function angularDifference(a, b) {
  const angleA = normalizeAngle(a);
  const angleB = normalizeAngle(b);
  let diff = Math.abs(angleA - angleB);
  if (diff > Math.PI) {
    diff = Math.abs(diff - Math.PI * 2);
  }
  return diff;
}

// Calculate distance between two points
export function distanceBetween(a, b) {
  if (!a || !b) {
    return 0;
  }
  const dx = (b.x || 0) - (a.x || 0);
  const dy = (b.y || 0) - (a.y || 0);
  return Math.sqrt(dx * dx + dy * dy);
}

// Calculate the shortest distance from a point to a line segment
export function distancePointToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));
  const projX = start.x + clampedT * dx;
  const projY = start.y + clampedT * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

// Project a point onto a line segment, returning the closest point on the segment and ratio
export function projectPointOntoSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return { x: start.x, y: start.y, t: 0 };
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return {
    x: start.x + t * dx,
    y: start.y + t * dy,
    t,
  };
}

// Catmull-Rom spline interpolation for smooth path generation (scalar version)
export function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    ((2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}
