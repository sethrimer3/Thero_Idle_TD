// Kuf Spire input and camera control methods extracted from KufBattlefieldSimulation.
import { MARINE_CONFIG, TURRET_CONFIG, CAMERA_CONFIG } from './kufSimulationConfig.js';

const MARINE_RADIUS = MARINE_CONFIG.RADIUS;
const TURRET_RADIUS = TURRET_CONFIG.RADIUS;
const MIN_ZOOM = CAMERA_CONFIG.MIN_ZOOM;
const MAX_ZOOM = CAMERA_CONFIG.MAX_ZOOM;

/**
 * Resize the canvas to fit its container while respecting device pixel ratio.
 */
export function resize() {
  if (!this.canvas) {
    return;
  }
  const parent = this.canvas.parentElement;
  if (!parent) {
    return;
  }
  // Derive canvas size from viewport bounds while preserving the battlefield aspect ratio.
  // Fixed 3:4 aspect ratio (width:height) for consistency with Aleph and Bet Spires.
  const aspectRatio = 3 / 4;
  const parentWidth = parent.clientWidth || 640;
  const viewportWidth = typeof window.innerWidth === 'number' ? Math.max(1, window.innerWidth - 48) : parentWidth;
  const viewportHeight = typeof window.innerHeight === 'number' ? Math.max(240, window.innerHeight - 260) : parentWidth / aspectRatio;
  // Limit horizontal growth when the viewport height becomes the constraining dimension.
  const maxWidthByHeight = Math.max(240, viewportHeight * aspectRatio);
  const width = Math.min(parentWidth, viewportWidth, maxWidthByHeight);
  const height = width / aspectRatio;
  const dpr = this.getEffectiveDevicePixelRatio();
  this.pixelRatio = dpr;
  this.canvas.width = Math.round(width * dpr);
  this.canvas.height = Math.round(height * dpr);
  this.canvas.style.width = `${width}px`;
  this.canvas.style.height = `${height}px`;
  if (this.ctx) {
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.bounds = { width, height };
    this.drawBackground(true);
  }
}

/**
 * Clamp the canvas resolution to keep the Kuf encounter playable on high-DPI hardware.
 * @returns {number} Effective device pixel ratio for rendering
 */
export function getEffectiveDevicePixelRatio() {
  const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const cap = Number.isFinite(this.maxDevicePixelRatio) ? this.maxDevicePixelRatio : rawDpr;
  return Math.max(1, Math.min(rawDpr, cap));
}

/**
 * Attach camera control event listeners.
 */
export function attachCameraControls() {
  if (!this.canvas) {
    return;
  }
  this.canvas.addEventListener('mousedown', this.handleMouseDown);
  this.canvas.addEventListener('mousemove', this.handleMouseMove);
  this.canvas.addEventListener('mouseup', this.handleMouseUp);
  this.canvas.addEventListener('mouseleave', this.handleMouseUp);
  this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
  this.canvas.addEventListener('click', this.handleClick);
  this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
  this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
  this.canvas.addEventListener('touchend', this.handleTouchEnd);
  this.canvas.addEventListener('touchcancel', this.handleTouchEnd);
}

/**
 * Remove camera control event listeners.
 */
export function detachCameraControls() {
  if (!this.canvas) {
    return;
  }
  this.canvas.removeEventListener('mousedown', this.handleMouseDown);
  this.canvas.removeEventListener('mousemove', this.handleMouseMove);
  this.canvas.removeEventListener('mouseup', this.handleMouseUp);
  this.canvas.removeEventListener('mouseleave', this.handleMouseUp);
  this.canvas.removeEventListener('wheel', this.handleWheel);
  this.canvas.removeEventListener('click', this.handleClick);
  this.canvas.removeEventListener('touchstart', this.handleTouchStart);
  this.canvas.removeEventListener('touchmove', this.handleTouchMove);
  this.canvas.removeEventListener('touchend', this.handleTouchEnd);
  this.canvas.removeEventListener('touchcancel', this.handleTouchEnd);
}

export function handleMouseDown(e) {
  this.dragStartTime = performance.now();
  const rect = this.canvas.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;

  this.selectionBox.startX = canvasX;
  this.selectionBox.startY = canvasY;
  this.selectionBox.endX = canvasX;
  this.selectionBox.endY = canvasY;
  this.selectionBox.active = false; // Will activate if drag continues

  // Also prepare camera drag in case it becomes a pan
  this.cameraDrag.startX = e.clientX;
  this.cameraDrag.startY = e.clientY;
  this.cameraDrag.camStartX = this.camera.x;
  this.cameraDrag.camStartY = this.camera.y;
}

export function handleMouseMove(e) {
  const elapsed = performance.now() - this.dragStartTime;
  const rect = this.canvas.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;

  // If we've been dragging for more than threshold, it's a selection drag
  if (elapsed > this.dragThreshold) {
    this.selectionBox.active = true;
    this.selectionBox.endX = canvasX;
    this.selectionBox.endY = canvasY;
    this.canvas.style.cursor = 'crosshair';
  }
}

export function handleMouseUp(e) {
  const elapsed = performance.now() - this.dragStartTime;
  const rect = this.canvas.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;

  if (this.selectionBox.active) {
    // Complete selection - select units in the box
    this.completeSelection();
    this.selectionBox.active = false;
    this.canvas.style.cursor = 'grab';
  } else if (elapsed < this.dragThreshold) {
    // Consume taps that land on the training toolbar before issuing commands.
    if (this.handleToolbarTap(canvasX, canvasY)) {
      this.cameraDrag.active = false;
      this.canvas.style.cursor = 'grab';
      return;
    }
    // It was a tap/click - issue attack-move command or handle double-tap
    const now = performance.now();
    const isDoubleTap = (now - this.lastTapTime) < this.doubleTapThreshold;
    this.lastTapTime = now;

    if (isDoubleTap) {
      // Double-tap: deselect all units and return to "all units" mode
      this.selectedUnits = [];
      this.selectionMode = 'all';
      this.attackMoveWaypoint = null;
      // Clear targeted enemies when resetting the selection state.
      this.selectedEnemy = null;
    } else {
      // Single tap: issue a contextual command (target or move).
      this.handleCommandTap(canvasX, canvasY);
    }
  }

  this.cameraDrag.active = false;
  this.canvas.style.cursor = 'grab';
}

export function handleWheel(e) {
  e.preventDefault();
  const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
  this.camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.camera.zoom * zoomDelta));
}

export function handleClick(e) {
  // This is now mostly handled by handleMouseUp to detect taps vs drags
  // Keep this for compatibility but the main logic is in handleMouseUp
}

export function handleTouchStart(e) {
  e.preventDefault();
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    this.dragStartTime = performance.now();
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = touch.clientX - rect.left;
    const canvasY = touch.clientY - rect.top;

    this.selectionBox.startX = canvasX;
    this.selectionBox.startY = canvasY;
    this.selectionBox.endX = canvasX;
    this.selectionBox.endY = canvasY;
    this.selectionBox.active = false;

    this.cameraDrag.startX = touch.clientX;
    this.cameraDrag.startY = touch.clientY;
    this.cameraDrag.camStartX = this.camera.x;
    this.cameraDrag.camStartY = this.camera.y;
  }
}

export function handleTouchMove(e) {
  e.preventDefault();
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    const elapsed = performance.now() - this.dragStartTime;
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = touch.clientX - rect.left;
    const canvasY = touch.clientY - rect.top;

    if (elapsed > this.dragThreshold) {
      this.selectionBox.active = true;
      this.selectionBox.endX = canvasX;
      this.selectionBox.endY = canvasY;
    }
  }
}

export function handleTouchEnd(e) {
  e.preventDefault();
  const elapsed = performance.now() - this.dragStartTime;

  if (this.selectionBox.active) {
    this.completeSelection();
    this.selectionBox.active = false;
  } else if (elapsed < this.dragThreshold && e.changedTouches.length === 1) {
    const touch = e.changedTouches[0];
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = touch.clientX - rect.left;
    const canvasY = touch.clientY - rect.top;
    // Consume taps that land on the training toolbar before issuing commands.
    if (this.handleToolbarTap(canvasX, canvasY)) {
      return;
    }

    const now = performance.now();
    const isDoubleTap = (now - this.lastTapTime) < this.doubleTapThreshold;
    this.lastTapTime = now;

    if (isDoubleTap) {
      this.selectedUnits = [];
      this.selectionMode = 'all';
      this.attackMoveWaypoint = null;
      // Clear targeted enemies when resetting the selection state.
      this.selectedEnemy = null;
    } else {
      // Single tap: issue a contextual command (target or move).
      this.handleCommandTap(canvasX, canvasY);
    }
  }
}

/**
 * Convert a canvas-space coordinate to world-space coordinates.
 * @param {number} canvasX - X coordinate within the canvas.
 * @param {number} canvasY - Y coordinate within the canvas.
 * @returns {{ x: number, y: number }} World coordinates.
 */
export function canvasToWorld(canvasX, canvasY) {
  return {
    x: (canvasX - this.bounds.width / 2) / this.camera.zoom + this.bounds.width / 2 + this.camera.x,
    y: (canvasY - this.bounds.height / 2) / this.camera.zoom + this.bounds.height / 2 + this.camera.y,
  };
}

/**
 * Resolve a turret/enemy under the tap point in world space.
 * @param {number} worldX - X coordinate in world space.
 * @param {number} worldY - Y coordinate in world space.
 * @returns {object|null} Targeted enemy or null.
 */
export function findEnemyAtPoint(worldX, worldY) {
  const hit = this.turrets.find((turret) => {
    const dx = turret.x - worldX;
    const dy = turret.y - worldY;
    const radius = (turret.radius || TURRET_RADIUS) + 6;
    return dx * dx + dy * dy <= radius * radius;
  });
  return hit || null;
}

/**
 * Handle tap-based commands to target enemies or set move destinations.
 * @param {number} canvasX - X coordinate within the canvas.
 * @param {number} canvasY - Y coordinate within the canvas.
 */
export function handleCommandTap(canvasX, canvasY) {
  // Clear toolbar glow when clicking elsewhere in the battlefield.
  this.clearToolbarGlow();

  const { x: worldX, y: worldY } = this.canvasToWorld(canvasX, canvasY);
  const enemy = this.findEnemyAtPoint(worldX, worldY);
  if (enemy) {
    this.issueTargetCommand(enemy);
    return;
  }
  // Clear any enemy focus before issuing a movement command.
  this.selectedEnemy = null;
  this.setAttackMoveWaypoint(worldX, worldY);
}

/**
 * Send a focused attack command on a tapped enemy.
 * @param {object} enemy - Enemy unit or structure to focus.
 */
export function issueTargetCommand(enemy) {
  this.selectedEnemy = enemy;
  // Clear any stored waypoints so units commit to the new focus target.
  this.attackMoveWaypoint = null;
  this.marines.forEach((marine) => {
    marine.waypoint = null;
  });
}

/**
 * Complete selection by finding all units within the selection rectangle.
 */
export function completeSelection() {
  // Convert selection box canvas coordinates to world coordinates
  const minX = Math.min(this.selectionBox.startX, this.selectionBox.endX);
  const maxX = Math.max(this.selectionBox.startX, this.selectionBox.endX);
  const minY = Math.min(this.selectionBox.startY, this.selectionBox.endY);
  const maxY = Math.max(this.selectionBox.startY, this.selectionBox.endY);

  // Select all marines within the box
  this.selectedUnits = this.marines.filter((marine) => {
    // Convert marine world position to canvas coordinates
    const screenX = (marine.x - this.camera.x - this.bounds.width / 2) * this.camera.zoom + this.bounds.width / 2;
    const screenY = (marine.y - this.camera.y - this.bounds.height / 2) * this.camera.zoom + this.bounds.height / 2;

    return screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY;
  });

  if (this.selectedUnits.length > 0) {
    this.selectionMode = 'specific';
  } else {
    this.selectionMode = 'all';
  }
}

/**
 * Set attack-move waypoint for units.
 */
export function setAttackMoveWaypoint(worldX, worldY) {
  this.attackMoveWaypoint = { x: worldX, y: worldY };

  // Assign waypoint to selected units or all units
  const unitsToCommand = this.selectionMode === 'specific' ? this.selectedUnits : this.marines;
  // Build a compact formation so each unit gets a unique waypoint with diameter spacing.
  const formationAssignments = this.getFormationWaypoints(unitsToCommand, worldX, worldY);
  unitsToCommand.forEach((marine, index) => {
    // Apply the formation slot to the unit waypoint for group movement.
    marine.waypoint = formationAssignments[index] || { x: worldX, y: worldY };
  });
}

/**
 * Generate formation waypoints centered on the target with diameter gaps between units.
 *
 * Units are arranged in a lattice grid where each unit is spaced 1 diameter apart (edge-to-edge).
 * For example, if units are 1 meter in diameter, the center-to-center spacing will be 2 meters,
 * resulting in 1 meter of clearance between unit edges so they never overlap.
 *
 * @param {Array<object>} units - Units that should be arranged into the formation.
 * @param {number} targetX - Formation center X coordinate.
 * @param {number} targetY - Formation center Y coordinate.
 * @returns {Array<{x: number, y: number}>} Array of world-space waypoints per unit.
 */
export function getFormationWaypoints(units, targetX, targetY) {
  // Return a single waypoint when there are no units to arrange.
  if (!units.length) {
    return [{ x: targetX, y: targetY }];
  }
  // Use the largest unit radius to guarantee enough spacing for mixed unit sizes.
  const maxRadius = Math.max(...units.map((unit) => unit.radius || MARINE_RADIUS));
  // Spacing calculation: To keep units 1 diameter apart (edge-to-edge), the center-to-center
  // distance must be 2 diameters = 4 radii. This ensures no unit will overlap during movement.
  const diameter = maxRadius * 2;
  const spacing = diameter * 2;  // Center-to-center distance = 2 diameters
  // Calculate a near-square grid for even distribution around the center.
  const columns = Math.ceil(Math.sqrt(units.length));
  const rows = Math.ceil(units.length / columns);
  // Precompute centered offsets to keep the formation anchored to the command point.
  const offsetXStart = -((columns - 1) * spacing) / 2;
  const offsetYStart = -((rows - 1) * spacing) / 2;

  return units.map((_, index) => {
    // Map the unit index to a row/column slot in the formation grid.
    const row = Math.floor(index / columns);
    const column = index % columns;
    const offsetX = offsetXStart + column * spacing;
    const offsetY = offsetYStart + row * spacing;
    // Center each waypoint on the commanded location.
    return { x: targetX + offsetX, y: targetY + offsetY };
  });
}

/**
 * Resolve the currently focused enemy and clear invalid references.
 * @returns {object|null} Focused enemy or null when none is active.
 */
export function getFocusedEnemy() {
  if (!this.selectedEnemy) {
    return null;
  }
  if (this.selectedEnemy.health <= 0 || !this.turrets.includes(this.selectedEnemy)) {
    this.selectedEnemy = null;
    return null;
  }
  return this.selectedEnemy;
}
