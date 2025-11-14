/**
 * Orientation helpers for the playfield.
 *
 * These functions are designed to be mixed into `SimplePlayfield` via
 * `Object.assign(SimplePlayfield.prototype, helpers)` so they rely on the
 * playfield instance through `this`.
 */

/**
 * Determine the preferred orientation for the active viewport.
 *
 * @returns {('portrait'|'landscape')} Preferred orientation value.
 */
export function determinePreferredOrientation() {
  if (this.preferredOrientationOverride === 'landscape') {
    return 'landscape';
  }
  if (this.preferredOrientationOverride === 'portrait') {
    return 'portrait';
  }
  if (typeof window === 'undefined') {
    return 'portrait';
  }
  const width = Number.isFinite(window.innerWidth) ? window.innerWidth : 0;
  const height = Number.isFinite(window.innerHeight) ? window.innerHeight : 0;
  if (width > 0 && height > 0 && width > height) {
    return 'landscape';
  }
  return 'portrait';
}

/**
 * Apply an explicit orientation override and refresh dependent layout state.
 *
 * @param {string} orientation - Requested orientation ("landscape"|"portrait").
 */
export function setPreferredOrientation(orientation) {
  const normalized =
    orientation === 'landscape' || orientation === 'portrait' ? orientation : null;
  if (this.preferredOrientationOverride === normalized) {
    return;
  }
  this.preferredOrientationOverride = normalized;
  if (!this.levelActive) {
    return;
  }
  this.layoutOrientation = this.determinePreferredOrientation();
  this.applyLevelOrientation();
  this.applyContainerOrientationClass();
  this.syncCanvasSize();
}

/**
 * Toggle container modifier classes so CSS can adjust layout per orientation.
 */
export function applyContainerOrientationClass() {
  if (!this.container || !this.container.classList) {
    return;
  }
  if (!this.container.classList.contains('playfield')) {
    return;
  }
  if (this.layoutOrientation === 'landscape') {
    this.container.classList.add('playfield--landscape');
    this.container.classList.remove('playfield--portrait');
  } else {
    this.container.classList.add('playfield--portrait');
    this.container.classList.remove('playfield--landscape');
  }
}

/**
 * Clone a normalized point while constraining values to the 0–1 range.
 *
 * @param {{x:number, y:number}} point - Candidate normalized coordinate.
 * @returns {{x:number, y:number}} Clamped normalized coordinate.
 */
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

/**
 * Rotate a normalized point 90° clockwise around the playfield centre.
 *
 * @param {{x:number, y:number}} point - Normalized coordinate to rotate.
 * @returns {{x:number, y:number}} Rotated and clamped coordinate.
 */
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

/**
 * Transform the level path and anchor geometry to match the active orientation.
 */
export function applyLevelOrientation() {
  if (!this.levelConfig) {
    return;
  }
  const basePath = Array.isArray(this.basePathPoints) && this.basePathPoints.length
    ? this.basePathPoints
    : Array.isArray(this.levelConfig.path)
    ? this.levelConfig.path
    : [];
  const baseAnchors = Array.isArray(this.baseAutoAnchors) ? this.baseAutoAnchors : [];
  const transform =
    this.layoutOrientation === 'landscape'
      ? (point) => rotateNormalizedPointClockwise(point)
      : (point) => cloneNormalizedPoint(point);

  this.levelConfig.path = basePath.map((point) => transform(point));
  this.levelConfig.autoAnchors = baseAnchors.length
    ? baseAnchors.map((anchor) => transform(anchor))
    : [];
}

export const orientationHelpers = {
  determinePreferredOrientation,
  setPreferredOrientation,
  applyContainerOrientationClass,
  cloneNormalizedPoint,
  rotateNormalizedPointClockwise,
  applyLevelOrientation,
};
