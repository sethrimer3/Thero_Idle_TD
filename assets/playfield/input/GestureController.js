// Gesture detection and tower interaction logic extracted from SimplePlayfield for modular input handling.
// Handles tower hold gestures for upgrade/demotion and double-tap detection for menu toggling.

// Gesture timing and distance thresholds
const TOWER_HOLD_ACTIVATION_MS = 500;
const TOWER_HOLD_CANCEL_DISTANCE_PX = 18;
const TOWER_MENU_DOUBLE_TAP_INTERVAL_MS = 800;
const TOWER_MENU_DOUBLE_TAP_DISTANCE_PX = 28;

/**
 * Returns a monotonic timestamp for frame-rate independent timing.
 */
function getCurrentTimestamp() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/**
 * Clear any pending tower tap tracking so the next tap starts a fresh sequence.
 */
function resetTowerTapState() {
  if (!this.towerTapState) {
    this.towerTapState = {
      lastTowerId: null,
      lastTapTime: 0,
      lastTapPosition: null,
    };
    return;
  }
  this.towerTapState.lastTowerId = null;
  this.towerTapState.lastTapTime = 0;
  this.towerTapState.lastTapPosition = null;
}

/**
 * Register a tap on a tower and return true when it qualifies as a double tap.
 */
function registerTowerTap(tower, position, event = null) {
  if (!tower?.id || !position) {
    this.resetTowerTapState();
    return false;
  }
  const x = Number.isFinite(position.x) ? position.x : null;
  const y = Number.isFinite(position.y) ? position.y : null;
  if (x === null || y === null) {
    this.resetTowerTapState();
    return false;
  }
  if (!this.towerTapState) {
    this.resetTowerTapState();
  }
  const state = this.towerTapState;
  const now =
    Number.isFinite(event?.timeStamp)
      ? event.timeStamp
      : getCurrentTimestamp.call(this);
  const previousTime = Number.isFinite(state.lastTapTime) ? state.lastTapTime : 0;
  const elapsed = now - previousTime;
  const isSameTower = state.lastTowerId === tower.id;
  const withinTime = isSameTower && elapsed >= 0 && elapsed <= TOWER_MENU_DOUBLE_TAP_INTERVAL_MS;
  let withinDistance = false;
  if (isSameTower && state.lastTapPosition) {
    const dx = x - state.lastTapPosition.x;
    const dy = y - state.lastTapPosition.y;
    const distance = Math.hypot(dx, dy);
    withinDistance = Number.isFinite(distance) && distance <= TOWER_MENU_DOUBLE_TAP_DISTANCE_PX;
  }
  if (withinTime && withinDistance) {
    this.resetTowerTapState();
    return true;
  }
  state.lastTowerId = tower.id;
  state.lastTapTime = now;
  state.lastTapPosition = { x, y };
  return false;
}

/**
 * Run the double-tap gesture logic and toggle the active tower menu when appropriate.
 */
function toggleTowerMenuFromTap(tower, position, event = null, options = {}) {
  if (!tower || !position) {
    return false;
  }
  const shouldToggle =
    typeof this.registerTowerTap === 'function' && this.registerTowerTap(tower, position, event);
  if (!shouldToggle) {
    return false;
  }
  if (options?.suppressNextClick) {
    this.suppressNextCanvasClick = true;
  }
  if (this.activeTowerMenu?.towerId === tower.id) {
    this.closeTowerMenu();
  } else {
    this.openTowerMenu(tower);
  }
  return true;
}

/**
 * Update tower hold gesture state to detect swipe upgrades/demotions.
 */
function updateTowerHoldGesture(event) {
  const state = this.towerHoldState;
  if (!state?.pointerId || state.pointerId !== event.pointerId) {
    return;
  }
  if (!Number.isFinite(state.startClientX) || !Number.isFinite(state.startClientY)) {
    return;
  }
  const dx = event.clientX - state.startClientX;
  const dy = event.clientY - state.startClientY;
  state.lastClientY = event.clientY;
  const distance = Math.hypot(dx, dy);
  if (!state.holdActivated) {
    if (distance >= TOWER_HOLD_CANCEL_DISTANCE_PX) {
      this.cancelTowerHoldGesture({ pointerId: event.pointerId });
    }
    return;
  }
  if (typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
  const rawStepPixels = Number.isFinite(state.swipeStepPixels) ? state.swipeStepPixels : this.getPixelsForMeters(2);
  const stepPixels = Math.max(1, Number.isFinite(rawStepPixels) ? rawStepPixels : 1);
  const anchorY = Number.isFinite(state.activationClientY) ? state.activationClientY : state.startClientY;
  const deltaY = event.clientY - anchorY;
  const currentSteps = Math.trunc(deltaY / stepPixels);
  const appliedSteps = Number.isFinite(state.appliedSteps) ? state.appliedSteps : 0;
  const pendingSteps = currentSteps - appliedSteps;
  if (pendingSteps !== 0 && state.towerId) {
    const tower = this.getTowerById(state.towerId);
    const direction = pendingSteps > 0 ? 1 : -1;
    const swipeVector = { x: state.activationClientX - state.startClientX, y: deltaY };
    let remaining = Math.abs(pendingSteps);
    while (remaining > 0 && tower) {
      const applied =
        direction > 0
          ? this.commitTowerHoldDemotion({ swipeVector })
          : this.commitTowerHoldUpgrade({ swipeVector });
      if (!applied) {
        state.appliedSteps = currentSteps;
        break;
      }
      state.appliedSteps += direction;
      remaining -= 1;
    }
  }
}

/**
 * Cancel tower hold gesture and cleanup state.
 */
function cancelTowerHoldGesture({ pointerId = null, preserveWheel = false } = {}) {
  if (!this.towerHoldState) {
    return;
  }
  const state = this.towerHoldState;
  if (pointerId && state.pointerId && pointerId !== state.pointerId) {
    return;
  }
  if (state.holdTimeoutId) {
    clearTimeout(state.holdTimeoutId);
  }
  if (typeof state.scribbleCleanup === 'function') {
    state.scribbleCleanup();
  }
  if (typeof state.indicatorsCleanup === 'function') {
    state.indicatorsCleanup();
  }
  if (!preserveWheel) {
    this.closeTowerSelectionWheel();
  }
  state.pointerId = null;
  state.towerId = null;
  state.startClientX = 0;
  state.startClientY = 0;
  state.lastClientY = 0;
  state.activationClientX = 0;
  state.activationClientY = 0;
  state.holdTimeoutId = null;
  state.holdActivated = false;
  state.scribbleCleanup = null;
  state.indicatorsCleanup = null;
  state.actionTriggered = null;
  state.pointerType = null;
  state.swipeStepPixels = 0;
  state.appliedSteps = 0;
  if (!pointerId || this.viewPanLockPointerId === pointerId) {
    this.viewPanLockPointerId = null;
  }
}

/**
 * Track pointer presses on a tower so the renderer can animate a palette-matched glow.
 */
function handleTowerPointerPress(tower, event) {
  if (!tower?.id || !event || !this.towerPressHighlights || !this.towerPressPointerMap) {
    return;
  }
  const pointerId = typeof event.pointerId === 'number' ? event.pointerId : null;
  const now = getCurrentTimestamp.call(this);
  let entry = this.towerPressHighlights.get(tower.id);
  if (!entry) {
    entry = {
      intensity: 0,
      target: 0,
      lastTimestamp: now,
      pointerIds: new Set(),
    };
    this.towerPressHighlights.set(tower.id, entry);
  }
  entry.target = 1;
  entry.lastTimestamp = now;
  if (!entry.pointerIds) {
    entry.pointerIds = new Set();
  }
  if (pointerId !== null) {
    entry.pointerIds.add(pointerId);
    this.towerPressPointerMap.set(pointerId, tower.id);
  }
  if (!this.shouldAnimate) {
    this.draw();
  }
}

/**
 * Release a tower press glow either for a specific pointer or every active pointer.
 */
function handleTowerPointerRelease(pointerId = null) {
  if (!this.towerPressHighlights || !this.towerPressPointerMap) {
    return;
  }
  const now = getCurrentTimestamp.call(this);
  const finalizeEntry = (towerId, activePointerId = null) => {
    const entry = this.towerPressHighlights.get(towerId);
    if (!entry) {
      return;
    }
    if (entry.pointerIds && activePointerId !== null) {
      entry.pointerIds.delete(activePointerId);
    } else if (entry.pointerIds && activePointerId === null) {
      entry.pointerIds.clear();
    }
    entry.lastTimestamp = now;
    if (!entry.pointerIds || entry.pointerIds.size === 0) {
      entry.target = 0;
    }
  };

  if (typeof pointerId !== 'number') {
    this.towerPressPointerMap.forEach((towerId, activePointerId) => {
      finalizeEntry(towerId, activePointerId);
    });
    this.towerPressPointerMap.clear();
    if (!this.shouldAnimate) {
      this.draw();
    }
    return;
  }

  const towerId = this.towerPressPointerMap.get(pointerId);
  if (!towerId) {
    return;
  }
  finalizeEntry(towerId, pointerId);
  this.towerPressPointerMap.delete(pointerId);
  if (!this.shouldAnimate) {
    this.draw();
  }
}

export {
  TOWER_HOLD_ACTIVATION_MS,
  TOWER_HOLD_CANCEL_DISTANCE_PX,
  TOWER_MENU_DOUBLE_TAP_INTERVAL_MS,
  TOWER_MENU_DOUBLE_TAP_DISTANCE_PX,
  getCurrentTimestamp,
  resetTowerTapState,
  registerTowerTap,
  toggleTowerMenuFromTap,
  updateTowerHoldGesture,
  cancelTowerHoldGesture,
  handleTowerPointerPress,
  handleTowerPointerRelease,
};
