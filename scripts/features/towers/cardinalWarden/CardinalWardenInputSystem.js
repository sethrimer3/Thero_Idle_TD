/**
 * CardinalWardenInputSystem
 *
 * Handles initialization, pointer-based aim input, and visibility change
 * handling for the Cardinal Warden simulation.
 *
 * All functions operate via `.call(this)` delegation from
 * CardinalWardenSimulation, so `this` refers to the simulation instance.
 */

/**
 * Propagate ring colors to existing warden rings so mode toggles are immediate.
 */
export function applyRingColors() {
  if (!this.warden) return;
  for (const ring of this.warden.ringSquares) {
    ring.strokeColor = this.ringStrokeColor;
  }
}

/**
 * Initialize the simulation: create the warden, apply ring colors, and attach handlers.
 */
export function initialize() {
  if (!this.canvas) return;
  this.initWarden();
  this.applyRingColors();
  this.attachInputHandlers();
  this.attachVisibilityHandler();
}

/**
 * Attach input event handlers for aiming.
 */
export function attachInputHandlers() {
  if (!this.canvas) return;
  this.canvas.addEventListener('pointerdown', this.handlePointerDown);
  this.canvas.addEventListener('pointermove', this.handlePointerMove);
  this.canvas.addEventListener('pointerup', this.handlePointerUp);
  this.canvas.addEventListener('pointercancel', this.handlePointerUp);
  this.canvas.addEventListener('pointerleave', this.handlePointerUp);
}

/**
 * Detach input event handlers.
 */
export function detachInputHandlers() {
  if (!this.canvas) return;
  this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
  this.canvas.removeEventListener('pointermove', this.handlePointerMove);
  this.canvas.removeEventListener('pointerup', this.handlePointerUp);
  this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
  this.canvas.removeEventListener('pointerleave', this.handlePointerUp);
}

/**
 * Attach visibility change handler to re-enable input when tab becomes visible.
 */
export function attachVisibilityHandler() {
  if (typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', this.handleVisibilityChange);
}

/**
 * Detach visibility change handler.
 */
export function detachVisibilityHandler() {
  if (typeof document === 'undefined') return;
  document.removeEventListener('visibilitychange', this.handleVisibilityChange);
}

/**
 * Handle visibility change events - re-attach input handlers when tab becomes visible.
 */
export function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    // Re-attach input handlers when tab becomes visible
    this.detachInputHandlers();
    this.attachInputHandlers();
  }
}

/**
 * Handle pointer down events for setting aim target.
 * @param {PointerEvent} event - The pointer event
 */
export function handlePointerDown(event) {
  if (!this.canvas || this.gamePhase !== 'playing') return;

  // Track this pointer for drag-based aiming
  this.aimPointerId = event.pointerId;

  // Get canvas-relative coordinates
  const rect = this.canvas.getBoundingClientRect();
  const scaleX = this.canvas.width / rect.width;
  const scaleY = this.canvas.height / rect.height;

  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  // Set the aim target
  this.aimTarget = { x, y };
}

/**
 * Handle pointer move events for dynamic aim target updating during drag.
 * @param {PointerEvent} event - The pointer event
 */
export function handlePointerMove(event) {
  // Only update if we're tracking this pointer (started with pointerdown on canvas)
  if (!this.canvas || this.aimPointerId !== event.pointerId || this.gamePhase !== 'playing') return;

  // Get canvas-relative coordinates
  const rect = this.canvas.getBoundingClientRect();
  const scaleX = this.canvas.width / rect.width;
  const scaleY = this.canvas.height / rect.height;

  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  // Update the aim target dynamically
  this.aimTarget = { x, y };
}

/**
 * Handle pointer up/cancel/leave events to stop tracking aim pointer.
 * @param {PointerEvent} event - The pointer event
 */
export function handlePointerUp(event) {
  if (this.aimPointerId === event.pointerId) {
    this.aimPointerId = null;
  }
}

/**
 * Clear the aim target (weapons will fire straight up).
 */
export function clearAimTarget() {
  this.aimTarget = null;
}

/**
 * Get the current aim target.
 * @returns {Object|null} The aim target {x, y} or null
 */
export function getAimTarget() {
  return this.aimTarget;
}
