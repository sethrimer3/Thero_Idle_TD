// Shared conversion helpers for working with standardized game units.
export const ALPHA_BASE_RADIUS_FACTOR = 0.025; // Ratio of playfield size that matches the alpha radius.
export const ALPHA_BASE_DIAMETER_FACTOR = ALPHA_BASE_RADIUS_FACTOR * 2; // Diameter ratio derived from the alpha baseline.
export const DEFAULT_TOWER_DIAMETER_METERS = 1; // Fallback diameter so towers without explicit data still measure 1 meter.

// Translate meters into a normalized fraction of the playfield's minimum dimension.
export function metersToCanvasFraction(meters) {
  if (!Number.isFinite(meters) || meters <= 0) {
    return 0;
  }
  return meters * ALPHA_BASE_DIAMETER_FACTOR;
}

// Translate a normalized fraction of the playfield into meters.
export function canvasFractionToMeters(fraction) {
  if (!Number.isFinite(fraction) || fraction <= 0) {
    return 0;
  }
  return fraction / ALPHA_BASE_DIAMETER_FACTOR;
}

// Convert meters into absolute pixels using the playfield's minimum dimension.
export function metersToPixels(meters, minDimension) {
  if (!Number.isFinite(minDimension) || minDimension <= 0) {
    return 0;
  }
  return metersToCanvasFraction(meters) * minDimension;
}
