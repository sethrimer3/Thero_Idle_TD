import {
  collectMoteGemsWithinRadius,
  MOTE_GEM_COLLECTION_RADIUS,
} from '../../enemies.js';
import { metersToPixels } from '../../gameUnits.js';
import { PLAYFIELD_VIEW_DRAG_THRESHOLD } from '../constants.js';

// Input controller routines extracted from SimplePlayfield for modularized input handling.

function attachCanvasInteractions() {
  if (!this.canvas) {
    return;
  }
  this.canvas.addEventListener('pointerdown', this.pointerDownHandler);
  this.canvas.addEventListener('pointermove', this.pointerMoveHandler);
  this.canvas.addEventListener('pointerleave', this.pointerLeaveHandler);
  this.canvas.addEventListener('click', this.pointerClickHandler);
  this.canvas.addEventListener('pointerup', this.pointerUpHandler);
  this.canvas.addEventListener('pointercancel', this.pointerUpHandler);
  this.canvas.addEventListener('lostpointercapture', this.pointerUpHandler);
  this.canvas.addEventListener('wheel', this.wheelHandler, { passive: false });
}

function handleCanvasPointerMove(event) {
  if (!this.levelActive || !this.levelConfig) {
    this.clearPlacementPreview();
    this.pointerPosition = null;
    this.clearEnemyHover();
    if (typeof this.cancelTowerHoldGesture === 'function') {
      this.cancelTowerHoldGesture();
    }
    return;
  }

  const isTouchPointer = event.pointerType === 'touch';
  // Track touch samples so the same movement logic supports both pinch and one-finger pans.
  if (isTouchPointer) {
    this.activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    if (this.activePointers.size >= 2) {
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      this.performPinchZoom();
      this.pointerPosition = null;
      this.clearPlacementPreview();
      this.clearEnemyHover();
      return;
    }
  } else {
    this.activePointers.clear();
    this.pinchState = null;
    this.isPinchZooming = false;
  }

  if (typeof this.updateTowerHoldGesture === 'function') {
    this.updateTowerHoldGesture(event);
  }

  // Lock camera panning while a tower hold gesture is active on this pointer.
  const isViewPanLocked = this.viewPanLockPointerId && event.pointerId === this.viewPanLockPointerId;

  if (this.connectionDragState.pointerId === event.pointerId) {
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    const normalized = this.getNormalizedFromEvent(event);
    if (!normalized) {
      this.connectionDragState.currentPosition = null;
      this.connectionDragState.hoverEntry = null;
      if (!this.shouldAnimate) {
        this.draw();
      }
      return;
    }
    const position = this.getCanvasPosition(normalized);
    this.connectionDragState.currentPosition = position ? { ...position } : null;
    if (this.connectionDragState.startPosition && !this.connectionDragState.active && position) {
      const dx = position.x - this.connectionDragState.startPosition.x;
      const dy = position.y - this.connectionDragState.startPosition.y;
      const distance = Math.hypot(dx, dy);
      if (Number.isFinite(distance) && distance >= PLAYFIELD_VIEW_DRAG_THRESHOLD) {
        this.connectionDragState.active = true;
        this.connectionDragState.hasMoved = true;
        this.suppressNextCanvasClick = true;
      }
    }
    if (this.connectionDragState.active && position) {
      this.updateConnectionDragHighlights(position);
    }
    if (!this.shouldAnimate) {
      this.draw();
    }
    return;
  }

  if (this.deltaCommandDragState.pointerId === event.pointerId) {
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    const normalized = this.getNormalizedFromEvent(event);
    const dragState = this.deltaCommandDragState;
    if (!normalized) {
      dragState.currentPosition = null;
      dragState.currentNormalized = null;
      dragState.trackAnchor = null;
      dragState.anchorAvailable = false;
      if (!this.shouldAnimate) {
        this.draw();
      }
      return;
    }
    const position = this.getCanvasPosition(normalized);
    dragState.currentNormalized = { ...normalized };
    dragState.currentPosition = position ? { ...position } : null;
    if (dragState.startPosition && !dragState.active && position) {
      const dx = position.x - dragState.startPosition.x;
      const dy = position.y - dragState.startPosition.y;
      const distance = Math.hypot(dx, dy);
      if (Number.isFinite(distance) && distance >= PLAYFIELD_VIEW_DRAG_THRESHOLD) {
        dragState.active = true;
        dragState.hasMoved = true;
        this.suppressNextCanvasClick = true;
      }
    }
    if (dragState.active && position) {
      this.updateDeltaCommandDrag(position);
    } else if (!dragState.active) {
      dragState.trackAnchor = null;
      dragState.anchorAvailable = false;
    }
    if (dragState.active) {
      dragState.hasMoved = true;
    }
    if (!this.shouldAnimate) {
      this.draw();
    }
    return;
  }

  const isPanPointer =
    this.viewDragState.pointerId !== null &&
    event.pointerId === this.viewDragState.pointerId &&
    (!isTouchPointer || this.activePointers.size < 2) &&
    !isViewPanLocked;
  if (isPanPointer) {
    // Allow more finger jitter before treating a touch as a camera drag so quick double taps stay responsive on mobile.
    const dragThreshold = isTouchPointer ? PLAYFIELD_VIEW_DRAG_THRESHOLD * 2.5 : PLAYFIELD_VIEW_DRAG_THRESHOLD;
    // Translate pointer movement into a clamped camera offset while dragging.
    const dx = event.clientX - this.viewDragState.startX;
    const dy = event.clientY - this.viewDragState.startY;
    const dragDistance = Math.hypot(dx, dy);
    if (!this.viewDragState.isDragging && dragDistance >= dragThreshold) {
      this.viewDragState.isDragging = true;
      this.suppressNextCanvasClick = true;
    }
    if (this.viewDragState.isDragging) {
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      this.pointerPosition = null;
      this.clearPlacementPreview();
      this.clearEnemyHover();
      const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 1;
      const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 1;
      const scale = this.viewScale || 1;
      const startCenter = this.viewDragState.startCenter || { x: 0.5, y: 0.5 };
      const nextCenter = {
        x: startCenter.x - dx / (scale * width),
        y: startCenter.y - dy / (scale * height),
      };
      this.viewCenterNormalized = this.clampViewCenterNormalized(nextCenter);
      this.applyViewConstraints();
      this.draw();
      return;
    }
  }

  const normalized = this.getNormalizedFromEvent(event);
  if (!normalized) {
    this.clearPlacementPreview();
    this.pointerPosition = null;
    this.clearEnemyHover();
    return;
  }

  this.pointerPosition = normalized;
  const position = this.getCanvasPosition(normalized);
  const hoveredEnemy = this.findEnemyAt(position);
  if (hoveredEnemy) {
    this.setEnemyHover(hoveredEnemy.enemy);
  } else {
    this.clearEnemyHover();
  }
  const hoveredTower = this.findTowerAt(position);
  if (!this.draggingTowerType && hoveredTower) {
    this.hoverPlacement = {
      normalized: { ...hoveredTower.normalized },
      position: { x: hoveredTower.x, y: hoveredTower.y },
      range: hoveredTower.range,
      valid: false,
      target: hoveredTower,
      towerType: hoveredTower.type,
      reason: 'Open lattice menu.',
    };
    if (!this.shouldAnimate) {
      this.draw();
    }
    return;
  }

  const activeType = this.draggingTowerType;
  if (activeType) {
    this.updatePlacementPreview(normalized, {
      towerType: activeType,
      dragging: Boolean(this.draggingTowerType),
    });
  } else {
    this.clearPlacementPreview();
  }

  if (!this.shouldAnimate) {
    this.draw();
  }
}

function performPinchZoom() {
  const pointers = Array.from(this.activePointers.values());
  if (pointers.length < 2) {
    this.pinchState = null;
    this.isPinchZooming = false;
    return;
  }
  const [first, second] = pointers;
  const dx = first.clientX - second.clientX;
  const dy = first.clientY - second.clientY;
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance <= 0) {
    return;
  }
  const midpoint = {
    clientX: (first.clientX + second.clientX) / 2,
    clientY: (first.clientY + second.clientY) / 2,
  };
  const anchor = this.getCanvasRelativeFromClient(midpoint);
  if (!anchor) {
    return;
  }
  this.isPinchZooming = true;
  if (!this.pinchState || !Number.isFinite(this.pinchState.startDistance) || this.pinchState.startDistance <= 0) {
    this.pinchState = {
      startDistance: distance,
      startScale: this.viewScale,
    };
    return;
  }
  const baseDistance = this.pinchState.startDistance;
  const baseScale = this.pinchState.startScale || this.viewScale;
  if (!Number.isFinite(baseDistance) || baseDistance <= 0) {
    return;
  }
  const targetScale = (distance / baseDistance) * baseScale;
  this.setZoom(targetScale, anchor);
  this.pinchState.startScale = this.viewScale;
  this.pinchState.startDistance = distance;
}

function handleCanvasPointerDown(event) {
  const isTouchPointer = event.pointerType === 'touch';
  if (isTouchPointer) {
    this.activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    if (this.activePointers.size < 2) {
      this.pinchState = null;
      this.isPinchZooming = false;
    } else {
      // Cancel any in-progress pan when a second touch begins a pinch gesture.
      this.viewDragState.pointerId = null;
      this.viewDragState.isDragging = false;
      this.suppressNextCanvasClick = true;
      if (typeof this.cancelTowerHoldGesture === 'function') {
        this.cancelTowerHoldGesture();
      }
    }
  } else {
    this.activePointers.clear();
    this.pinchState = null;
    this.isPinchZooming = false;
  }

  if (!this.levelConfig) {
    return;
  }

  const isPrimaryMouseDrag = !isTouchPointer && event.button === 0;
  const isSingleTouchDrag = isTouchPointer && this.activePointers.size < 2;
  const canInitiateDrag = !this.draggingTowerType && (isPrimaryMouseDrag || isSingleTouchDrag);

  let normalized = null;
  let position = null;
  let tower = null;
  if (canInitiateDrag) {
    normalized = this.getNormalizedFromEvent(event);
    position = normalized ? this.getCanvasPosition(normalized) : null;
    tower = position ? this.findTowerAt(position) : null;
    if (tower && typeof this.handleTowerPointerPress === 'function') {
      // Notify the playfield so pointer down events can animate tower press glows.
      this.handleTowerPointerPress(tower, event);
    }
    if (tower && typeof this.beginTowerHoldGesture === 'function') {
      this.beginTowerHoldGesture(tower, event);
    } else if (typeof this.cancelTowerHoldGesture === 'function') {
      this.cancelTowerHoldGesture();
    }
  } else if (typeof this.cancelTowerHoldGesture === 'function') {
    this.cancelTowerHoldGesture();
  }

  // Detect when the pointer interaction should start a glyph-connection drag between α/β/γ towers.
  const canDragConnections =
    canInitiateDrag &&
    tower &&
    (tower.type === 'alpha' || tower.type === 'beta' || tower.type === 'gamma');
  if (canDragConnections) {
    this.clearConnectionDragState();
    this.connectionDragState.pointerId = event.pointerId;
    this.connectionDragState.originTowerId = tower.id;
    this.connectionDragState.startPosition = position ? { ...position } : null;
    this.connectionDragState.currentPosition = position ? { ...position } : null;
    this.connectionDragState.highlightEntries = [];
    this.connectionDragState.hoverEntry = null;
    this.suppressNextCanvasClick = false;
    if (!isTouchPointer && typeof this.canvas?.setPointerCapture === 'function') {
      try {
        this.canvas.setPointerCapture(event.pointerId);
      } catch (error) {
        // Ignore pointer capture errors so connection drags still function without capture.
      }
    }
    return;
  }

  // Detect when the active tower is δ so the drag gesture routes command tracks.
  const canDragDeltaCommands =
    canInitiateDrag && tower && (tower.type === 'delta' || tower.type === 'omicron' || tower.type === 'upsilon');
  if (canDragDeltaCommands) {
    this.clearDeltaCommandDragState();
    const dragState = this.deltaCommandDragState;
    dragState.pointerId = event.pointerId;
    dragState.towerId = tower.id;
    dragState.towerType = tower.type;
    dragState.startPosition = position ? { ...position } : null;
    dragState.currentPosition = position ? { ...position } : null;
    dragState.startNormalized = normalized ? { ...normalized } : null;
    dragState.currentNormalized = normalized ? { ...normalized } : null;
    dragState.active = false;
    dragState.hasMoved = false;
    dragState.trackAnchor = null;
    dragState.trackDistance = Infinity;
    dragState.anchorAvailable = false;
    this.suppressNextCanvasClick = false;
    if (!isTouchPointer && typeof this.canvas?.setPointerCapture === 'function') {
      try {
        this.canvas.setPointerCapture(event.pointerId);
      } catch (error) {
        // Ignore pointer capture errors so delta drags still function without capture.
      }
    }
    return;
  }

  if (canInitiateDrag) {
    // Allow both mouse input and single-finger touches to initiate camera panning.
    this.viewDragState.pointerId = event.pointerId;
    this.viewDragState.startX = event.clientX;
    this.viewDragState.startY = event.clientY;
    this.viewDragState.startCenter = { ...(this.viewCenterNormalized || { x: 0.5, y: 0.5 }) };
    this.viewDragState.isDragging = false;
    this.suppressNextCanvasClick = false;
    if (!isTouchPointer && typeof this.canvas?.setPointerCapture === 'function') {
      try {
        this.canvas.setPointerCapture(event.pointerId);
      } catch (error) {
        // Ignore pointer capture failures so mouse dragging still functions.
      }
    }
  }
}

function handleCanvasPointerUp(event) {
  const isTouchPointer = event.pointerType === 'touch';
  if (isTouchPointer) {
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size < 2) {
      this.pinchState = null;
      this.isPinchZooming = false;
    }
  } else {
    this.activePointers.clear();
    this.pinchState = null;
    this.isPinchZooming = false;
  }

  if (typeof this.handleTowerPointerRelease === 'function') {
    // Clear any active press glows tied to the completed pointer interaction.
    this.handleTowerPointerRelease(event.pointerId);
  }

  if (typeof this.cancelTowerHoldGesture === 'function') {
    const preserveWheel = Boolean(this?.towerSelectionWheel?.container);
    this.cancelTowerHoldGesture({ pointerId: event.pointerId, preserveWheel });
  }

  if (this.connectionDragState.pointerId === event.pointerId) {
    const dragState = this.connectionDragState;
    const entry = dragState.hoverEntry;
    if (dragState.active && entry) {
      if (entry.action === 'connect') {
        const connected = this.addTowerConnection(entry.sourceId, entry.targetId);
        if (connected) {
          this.suppressNextCanvasClick = true;
        }
      } else if (entry.action === 'disconnect') {
        const removed = this.removeTowerConnection(entry.sourceId, entry.targetId);
        if (removed) {
          this.suppressNextCanvasClick = true;
        }
      }
      if (!this.shouldAnimate) {
        this.draw();
      }
    } else if (dragState.hasMoved) {
      this.suppressNextCanvasClick = true;
      if (!this.shouldAnimate) {
        this.draw();
      }
    }
    this.clearConnectionDragState();
    if (!isTouchPointer && typeof this.canvas?.releasePointerCapture === 'function') {
      try {
        this.canvas.releasePointerCapture(event.pointerId);
      } catch (error) {
        // Ignore browsers that throw if the pointer was not previously captured.
      }
    }
    return;
  }

  if (this.deltaCommandDragState.pointerId === event.pointerId) {
    const dragState = this.deltaCommandDragState;
    const isTapLikeRelease =
      isTouchPointer &&
      !dragState.active &&
      !dragState.hasMoved &&
      dragState.towerId;
    if (isTapLikeRelease && typeof this.toggleTowerMenuFromTap === 'function') {
      const normalized = dragState.currentNormalized || this.getNormalizedFromEvent(event);
      const position = dragState.currentPosition || (normalized ? this.getCanvasPosition(normalized) : null);
      const tower = position ? this.findTowerAt(position) : null;
      if (tower && tower.id === dragState.towerId) {
        // Run the double-tap check before clearing the drag state so δ towers can still open their menu with quick taps.
        const toggled = this.toggleTowerMenuFromTap(tower, position, event, { suppressNextClick: true });
        if (toggled) {
          this.suppressNextCanvasClick = true;
          this.clearDeltaCommandDragState();
          if (!isTouchPointer && typeof this.canvas?.releasePointerCapture === 'function') {
            try {
              this.canvas.releasePointerCapture(event.pointerId);
            } catch (error) {
              // Ignore browsers that throw if the pointer was not previously captured.
            }
          }
          if (!this.shouldAnimate) {
            this.draw();
          }
          return;
        }
      }
    }
    let committed = false;
    if (dragState.active && dragState.trackAnchor) {
      committed = this.commitDeltaCommandDrag();
      if (committed) {
        this.suppressNextCanvasClick = true;
      }
    } else if (dragState.hasMoved) {
      this.suppressNextCanvasClick = true;
    }
    this.clearDeltaCommandDragState();
    if (!isTouchPointer && typeof this.canvas?.releasePointerCapture === 'function') {
      try {
        this.canvas.releasePointerCapture(event.pointerId);
      } catch (error) {
        // Ignore browsers that throw if the pointer was not previously captured.
      }
    }
    if (!this.shouldAnimate) {
      this.draw();
    }
    return;
  }

  const wasViewDragPointer = this.viewDragState.pointerId === event.pointerId;
  const wasViewDragging = wasViewDragPointer && this.viewDragState.isDragging;
  if (wasViewDragPointer) {
    if (wasViewDragging) {
      this.suppressNextCanvasClick = true;
    }
    this.viewDragState.pointerId = null;
    this.viewDragState.isDragging = false;
  }

  if (!isTouchPointer && typeof this.canvas?.releasePointerCapture === 'function') {
    try {
      // Release mouse pointer capture so future drags start from a clean state.
      this.canvas.releasePointerCapture(event.pointerId);
    } catch (error) {
      // Ignore browsers that throw if the pointer was not previously captured.
    }
  }

  const canTriggerTowerTap =
    isTouchPointer &&
    !wasViewDragging &&
    !this.isPinchZooming &&
    !this.connectionDragState.pointerId &&
    !this.deltaCommandDragState.pointerId;
  if (canTriggerTowerTap && typeof this.toggleTowerMenuFromTap === 'function') {
    const normalized = this.getNormalizedFromEvent(event);
    if (normalized) {
      const position = this.getCanvasPosition(normalized);
      const tower = this.findTowerAt(position);
      if (tower) {
        // Run the double-tap test on touch pointer releases so tower menus feel responsive on mobile.
        const toggled = this.toggleTowerMenuFromTap(tower, position, event, {
          suppressNextClick: true,
        });
        if (toggled) {
          this.suppressNextCanvasClick = true;
          if (!this.shouldAnimate) {
            this.draw();
          }
          return;
        }
      }
    }
  }
}

function handleCanvasPointerLeave() {
  this.pointerPosition = null;
  this.clearPlacementPreview();
  this.clearEnemyHover();
  this.activePointers.clear();
  this.pinchState = null;
  this.isPinchZooming = false;
  this.viewDragState.pointerId = null;
  this.viewDragState.isDragging = false;
  this.clearConnectionDragState();
  this.clearDeltaCommandDragState();
  if (typeof this.handleTowerPointerRelease === 'function') {
    // Release all press glows so leaving the canvas cancels any lingering highlights.
    this.handleTowerPointerRelease();
  }
  if (typeof this.cancelTowerHoldGesture === 'function') {
    const preserveWheel = Boolean(this?.towerSelectionWheel?.container);
    this.cancelTowerHoldGesture({ preserveWheel });
  }
  if (typeof this.resetTowerTapState === 'function') {
    this.resetTowerTapState();
  }
}

function collectMoteGemsNear(position) {
  if (!position) {
    return 0;
  }
  // Calculate 4 meters in pixels based on the current playfield dimensions
  const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  const minDimension = width > 0 && height > 0 ? Math.min(width, height) : 320;
  const collectionRadiusPixels = metersToPixels(4, minDimension);
  
  const result = collectMoteGemsWithinRadius(position, collectionRadiusPixels, {
    reason: 'manual',
  });
  if (result.count > 0 && this.audio) {
    this.audio.playSfx('uiConfirm');
  }
  return result.count;
}

function handleCanvasClick(event) {
  if (this.audio) {
    this.audio.unlock();
  }
  if (!this.levelActive || !this.levelConfig) {
    return;
  }

  if (this.suppressNextCanvasClick) {
    this.suppressNextCanvasClick = false;
    return;
  }

  if (this.isPinchZooming) {
    return;
  }

  if (typeof event.preventDefault === 'function') {
    event.preventDefault();
  }

  const normalized = this.getNormalizedFromEvent(event);
  if (!normalized) {
    return;
  }

  const position = this.getCanvasPosition(normalized);
  // Cache the tap location so mobile focus interactions can surface the same tooltip details as desktop hover.
  this.pointerPosition = normalized;

  if (
    typeof this.dependencies.handleDeveloperMapPlacement === 'function' &&
    this.dependencies.handleDeveloperMapPlacement({
      normalized,
      position,
      playfield: this,
      event,
    })
  ) {
    return;
  }

  const enemyTarget = this.findEnemyAt(position);
  const menuTower = this.getActiveMenuTower();
  if (enemyTarget) {
    if (typeof this.resetTowerTapState === 'function') {
      this.resetTowerTapState();
    }
    this.setEnemyHover(enemyTarget.enemy);
    if (menuTower && this.handleTowerMenuEnemySelection(menuTower, enemyTarget.enemy)) {
      return;
    }
    this.toggleEnemyFocus(enemyTarget.enemy);
    return;
  }

  const crystalTarget = this.findCrystalAt(position);
  if (crystalTarget) {
    if (typeof this.resetTowerTapState === 'function') {
      this.resetTowerTapState();
    }
    this.toggleCrystalFocus(crystalTarget);
    return;
  }

  if (this.activeTowerMenu && this.handleTowerMenuClick(position)) {
    if (typeof this.resetTowerTapState === 'function') {
      this.resetTowerTapState();
    }
    return;
  }

  if (this.collectMoteGemsNear(position)) {
    if (typeof this.resetTowerTapState === 'function') {
      this.resetTowerTapState();
    }
    return;
  }

  const tower = this.findTowerAt(position);
  if (tower && typeof this.toggleTowerMenuFromTap === 'function') {
    if (this.toggleTowerMenuFromTap(tower, position, event)) {
      return;
    }
    return;
  }

  if (typeof this.resetTowerTapState === 'function') {
    this.resetTowerTapState();
  }

  if (this.activeTowerMenu) {
    this.closeTowerMenu();
  }
}

function handleCanvasWheel(event) {
  if (!this.levelActive || !this.levelConfig) {
    return;
  }
  if (typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
  if (typeof this.dependencies.isFieldNotesOverlayVisible === 'function' && this.dependencies.isFieldNotesOverlayVisible()) {
    return;
  }
  const anchor = this.getCanvasRelativeFromClient({ clientX: event.clientX, clientY: event.clientY });
  if (!anchor) {
    return;
  }
  const delta = Number.isFinite(event.deltaY) ? event.deltaY : 0;
  const factor = Math.exp(-delta * 0.0015);
  this.applyZoomFactor(factor, anchor);
}

function applyZoomFactor(factor, anchor) {
  if (!Number.isFinite(factor) || factor <= 0) {
    return;
  }
  const targetScale = this.viewScale * factor;
  this.setZoom(targetScale, anchor);
}

function setZoom(targetScale, anchor) {
  if (!Number.isFinite(targetScale)) {
    return false;
  }
  const width = this.renderWidth || (this.canvas ? this.canvas.clientWidth : 0) || 0;
  const height = this.renderHeight || (this.canvas ? this.canvas.clientHeight : 0) || 0;
  const screenPoint = anchor || { x: width / 2, y: height / 2 };
  const anchorWorld = this.screenToWorld(screenPoint);
  const clampedScale = Math.min(this.maxViewScale, Math.max(this.minViewScale, targetScale));
  const previousScale = this.viewScale;
  this.viewScale = clampedScale;
  this.applyViewConstraints();
  if (anchorWorld) {
    const offsetX = (screenPoint.x - width / 2) / this.viewScale;
    const offsetY = (screenPoint.y - height / 2) / this.viewScale;
    this.setViewCenterFromWorld({
      x: anchorWorld.x - offsetX,
      y: anchorWorld.y - offsetY,
    });
  } else {
    this.applyViewConstraints();
  }
  this.applyViewConstraints();
  const scaleChanged = Math.abs(previousScale - this.viewScale) > 0.0001;
  this.draw();
  return scaleChanged;
}

function clearPlacementPreview() {
  if (!this.hoverPlacement) {
    return;
  }
  this.hoverPlacement = null;
  if (!this.shouldAnimate) {
    this.draw();
  }
}

function clearEnemyHover() {
  this.hoverEnemy = null;
  if (this.enemyTooltip) {
    this.enemyTooltip.dataset.visible = 'false';
    this.enemyTooltip.setAttribute('aria-hidden', 'true');
  }
}

function getNormalizedFromEvent(event) {
  if (!this.canvas) {
    return null;
  }
  const rect = this.canvas.getBoundingClientRect();
  const width = rect.width || this.renderWidth || 0;
  const height = rect.height || this.renderHeight || 0;
  if (!width || !height) {
    return null;
  }
  const relative = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
  if (!Number.isFinite(relative.x) || !Number.isFinite(relative.y)) {
    return null;
  }
  const world = this.screenToWorld(relative);
  if (!world) {
    return null;
  }
  const normalized = {
    x: world.x / (this.renderWidth || width),
    y: world.y / (this.renderHeight || height),
  };
  return this.clampNormalized(normalized);
}

export {
  attachCanvasInteractions,
  handleCanvasPointerMove,
  performPinchZoom,
  handleCanvasPointerDown,
  handleCanvasPointerUp,
  handleCanvasPointerLeave,
  collectMoteGemsNear,
  handleCanvasClick,
  handleCanvasWheel,
  applyZoomFactor,
  setZoom,
  clearPlacementPreview,
  clearEnemyHover,
  getNormalizedFromEvent,
};
