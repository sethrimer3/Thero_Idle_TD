/**
 * ViewportCoordinateSystem – coordinate and viewport transformation helpers.
 *
 * Extracted from SimplePlayfield (Build 713) to reduce playfield.js size and
 * isolate coordinate-space conversions in a single, testable module.
 *
 * All exported functions are designed to be called via `Function.call(this, …)`
 * where `this` is a SimplePlayfield instance, exactly as the existing system
 * modules (PathGeometrySystem, EnemyFocusSystem, etc.) operate.
 */

import { metersToPixels } from '../../gameUnits.js';

// Half-unit constant used to centre the viewport during world↔screen transforms.
const HALF = 0.5;

// Touch / pointer coordinates outside this normalised margin are clamped to keep
// enemies and towers inside the visible game area.
const CLAMP_MARGIN = 0.04;
const CLAMP_MIN = CLAMP_MARGIN;
const CLAMP_MAX = 1 - CLAMP_MARGIN;

/**
 * Converts a normalised position (0–1 range) to an absolute canvas pixel position.
 *
 * @param {{ x: number, y: number }} normalized - Normalised coordinates.
 * @returns {{ x: number, y: number }} Canvas pixel coordinates.
 */
export function getCanvasPosition(normalized) {
  return {
    x: normalized.x * this.renderWidth,
    y: normalized.y * this.renderHeight,
  };
}

/**
 * Converts a distance in standardised game meters to on-screen pixels using
 * the current viewport's minimum dimension as the reference scale.
 *
 * @param {number} meters - Distance in game meters.
 * @returns {number} Equivalent pixel distance.
 */
export function getPixelsForMeters(meters) {
  const minDimension = Math.min(this.renderWidth, this.renderHeight) || 0;
  return metersToPixels(meters, minDimension);
}

/**
 * Converts an absolute canvas pixel position back to normalised coordinates,
 * clamping the result to the valid edge-margined range.
 *
 * @param {{ x: number, y: number }} position - Absolute canvas pixel position.
 * @returns {{ x: number, y: number }|null} Clamped normalised coordinates, or null on invalid input.
 */
export function getNormalizedFromCanvasPosition(position) {
  if (!position || !this.canvas) {
    return null;
  }
  const width = this.renderWidth || this.canvas.width || 1;
  const height = this.renderHeight || this.canvas.height || 1;
  if (!width || !height) {
    return null;
  }
  const normalized = {
    x: position.x / width,
    y: position.y / height,
  };
  return this.clampNormalized(normalized);
}

/**
 * Clamps a normalised coordinate pair to the edge-margined valid range so that
 * game objects remain within the visible playfield area.
 *
 * @param {{ x: number, y: number }|null} normalized - Raw normalised coordinates.
 * @returns {{ x: number, y: number }|null} Clamped coordinates, or null for falsy input.
 */
export function clampNormalized(normalized) {
  if (!normalized) {
    return null;
  }
  const clamp = (value) => {
    if (!Number.isFinite(value)) {
      return 0.5;
    }
    return Math.min(Math.max(value, CLAMP_MIN), CLAMP_MAX);
  };
  return {
    x: clamp(normalized.x),
    y: clamp(normalized.y),
  };
}

/**
 * Converts a client-relative pointer event position (clientX / clientY) into
 * canvas-relative pixel coordinates by subtracting the canvas bounding rect.
 *
 * @param {{ clientX: number, clientY: number }} point - Pointer event coordinates.
 * @returns {{ x: number, y: number }|null} Canvas-relative coordinates, or null on invalid input.
 */
export function getCanvasRelativeFromClient(point) {
  if (!this.canvas || !point) {
    return null;
  }
  const rect = this.canvas.getBoundingClientRect();
  const x = point.clientX - rect.left;
  const y = point.clientY - rect.top;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { x, y };
}

/**
 * Returns the world-space centre of the current viewport in canvas pixels.
 * Derived from the stored normalised view centre and the current render dimensions.
 *
 * @returns {{ x: number, y: number }} World-space viewport centre.
 */
export function getViewCenter() {
  const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  const normalized = this.viewCenterNormalized || { x: 0.5, y: 0.5 };
  return {
    x: width * normalized.x,
    y: height * normalized.y,
  };
}

/**
 * Stores a new viewport centre derived from an absolute world position so that
 * subsequent transforms use the updated camera position.
 *
 * @param {{ x: number, y: number }|null} world - Desired world-space centre.
 */
export function setViewCenterFromWorld(world) {
  if (!world) {
    return;
  }
  const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  if (!width || !height) {
    this.viewCenterNormalized = { x: 0.5, y: 0.5 };
    return;
  }
  const normalized = {
    x: world.x / width,
    y: world.y / height,
  };
  this.viewCenterNormalized = this.clampViewCenterNormalized(normalized);
}

/**
 * Clamps a normalised camera centre so that the visible viewport never extends
 * beyond the playfield boundary at the current zoom level.
 *
 * @param {{ x: number, y: number }|null} normalized - Proposed normalised centre.
 * @returns {{ x: number, y: number }} Clamped normalised centre.
 */
export function clampViewCenterNormalized(normalized) {
  if (!normalized) {
    return { x: 0.5, y: 0.5 };
  }
  const scale = Math.max(this.viewScale || 1, 0.0001);
  const halfWidth = HALF / scale;
  const halfHeight = HALF / scale;

  const clamp = (value, min, max) => {
    if (min > max) {
      return 0.5;
    }
    return Math.min(Math.max(value, min), max);
  };
  return {
    x: clamp(normalized.x, halfWidth, 1 - halfWidth),
    y: clamp(normalized.y, halfHeight, 1 - halfHeight),
  };
}

/**
 * Re-applies the camera centre clamp after zoom or resize changes so the
 * viewport never displays out-of-bounds content.
 */
export function applyViewConstraints() {
  this.viewCenterNormalized = this.clampViewCenterNormalized(
    this.viewCenterNormalized || { x: 0.5, y: 0.5 },
  );
}

/**
 * Converts a canvas-relative screen pixel position to world-space coordinates,
 * accounting for the current zoom scale and viewport centre.
 *
 * @param {{ x: number, y: number }|null} point - Canvas pixel position.
 * @returns {{ x: number, y: number }|null} World-space position, or null on invalid input.
 */
export function screenToWorld(point) {
  if (!point) {
    return null;
  }
  const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  const scale = this.viewScale || 1;
  if (!width || !height || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return null;
  }
  const center = this.getViewCenter();
  return {
    x: center.x + (point.x - width * HALF) / scale,
    y: center.y + (point.y - height * HALF) / scale,
  };
}

/**
 * Converts a world-space position to a canvas-relative screen pixel position,
 * accounting for the current zoom scale and viewport centre.
 *
 * @param {{ x: number, y: number }|null} point - World-space position.
 * @returns {{ x: number, y: number }|null} Canvas pixel position, or null on invalid input.
 */
export function worldToScreen(point) {
  if (!point) {
    return null;
  }
  const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  const scale = this.viewScale || 1;
  if (!width || !height || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return null;
  }
  const center = this.getViewCenter();
  return {
    x: width * HALF + (point.x - center.x) * scale,
    y: height * HALF + (point.y - center.y) * scale,
  };
}
