import {
  getTowerDefinitions,
  isTowerPlaceable,
  isTowerUnlocked,
} from '../../towersTab.js';

// Grace period to prevent hold release from being treated as an outside click.
const POINTER_RELEASE_GRACE_PERIOD_MS = 100;

// Show exactly 3 towers: previous, current (center), next
const VISIBLE_TOWER_COUNT = 3;

// Slot height for layout calculations - the center slot is at 1.25x this height
const BASE_SLOT_SIZE = 56;
// Minimum pointer travel before a drag scroll engages for the tower wheel.
const DRAG_ACTIVATION_DISTANCE = 8;
// Pixel distance per step when dragging through the wheel.
const DRAG_STEP_PIXELS = BASE_SLOT_SIZE;

/**
 * Remove the tower selection overlay and detach related listeners.
 */
export function closeTowerSelectionWheel() {
  const wheel = this.towerSelectionWheel;
  if (!wheel) {
    return;
  }
  if (wheel.wheelHandler) {
    document.removeEventListener('wheel', wheel.wheelHandler);
  }
  if (wheel.outsideClickHandler) {
    document.removeEventListener('click', wheel.outsideClickHandler);
    document.removeEventListener('touchend', wheel.outsideClickHandler);
  }
  wheel.wheelHandler = null;
  wheel.outsideClickHandler = null;
  wheel.justReleasedPointerId = null;
  wheel.releaseTimestamp = 0;
  // Reset drag tracking so a fresh wheel can rebind cleanly.
  wheel.dragState = null;
  if (wheel.container?.parentNode) {
    wheel.container.remove();
  }
  wheel.container = null;
  wheel.towers = [];
  wheel.activeIndex = 0;
  wheel.towerId = null;
}

/**
 * Render 3 tower icons stacked vertically: previous, current (center), and next.
 * Only shows tower icons, no cost labels or other information.
 */
export function renderTowerSelectionWheel() {
  const wheel = this.towerSelectionWheel;
  if (!wheel?.container || !Array.isArray(wheel.towers) || !wheel.towers.length) {
    return;
  }
  
  wheel.container.innerHTML = '';
  const activeIndex = Math.min(Math.max(wheel.activeIndex, 0), wheel.towers.length - 1);
  
  // Calculate which 3 towers to show: previous, current, next
  const indicesToShow = [];
  const centerIndex = activeIndex;
  
  // Previous tower (above current)
  if (centerIndex > 0) {
    indicesToShow.push({ index: centerIndex - 1, position: 'above' });
  } else {
    indicesToShow.push({ index: null, position: 'above' });
  }
  
  // Current tower (center/middle)
  indicesToShow.push({ index: centerIndex, position: 'center' });
  
  // Next tower (below current)
  if (centerIndex < wheel.towers.length - 1) {
    indicesToShow.push({ index: centerIndex + 1, position: 'below' });
  } else {
    indicesToShow.push({ index: null, position: 'below' });
  }
  
  // Render each visible tower icon
  indicesToShow.forEach(({ index, position }) => {
    const item = document.createElement('div');
    item.className = `tower-selection-icon tower-selection-icon--${position}`;
    
    if (index !== null) {
      const definition = wheel.towers[index];
      if (definition?.icon) {
        const icon = document.createElement('img');
        icon.className = 'tower-selection-icon__image';
        icon.src = definition.icon;
        icon.alt = definition.name || definition.id;
        icon.decoding = 'async';
        icon.loading = 'eager';
        item.appendChild(icon);
      }
      
      // Make the center tower tappable for selection
      if (position === 'center') {
        item.classList.add('tower-selection-icon--active');
        item.addEventListener('click', (event) => {
          event.stopPropagation();
          this.applyTowerSelection(definition);
        });
        item.addEventListener('touchend', (event) => {
          event.stopPropagation();
          event.preventDefault();
          this.applyTowerSelection(definition);
        });
      }
    } else {
      // Empty slot for when at start/end of list
      item.classList.add('tower-selection-icon--empty');
    }
    
    wheel.container.appendChild(item);
  });
}

/**
 * Handle scroll wheel events to switch towers step-wise.
 */
export function shiftTowerSelectionWheel(delta) {
  const wheel = this.towerSelectionWheel;
  if (!wheel?.towers?.length) {
    return;
  }
  const nextIndex = Math.min(
    Math.max(wheel.activeIndex + delta, 0),
    Math.max(0, wheel.towers.length - 1),
  );
  if (nextIndex !== wheel.activeIndex) {
    wheel.activeIndex = nextIndex;
    this.renderTowerSelectionWheel();
  }
}

/**
 * Position the tower selection display near the tower being modified.
 */
export function positionTowerSelectionWheel(tower) {
  const wheel = this.towerSelectionWheel;
  if (!wheel?.container || !this.canvas || !tower) {
    return;
  }
  const screen = this.worldToScreen({ x: tower.x, y: tower.y });
  const canvasRect = this.canvas.getBoundingClientRect();
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  if (!screen || !canvasRect) {
    return;
  }
  
  // Position the wheel to the right of the tower, centered vertically on it
  const baseLeft = canvasRect.left + screen.x + 40; // Offset to the right
  const baseTop = canvasRect.top + screen.y - (wheel.container.offsetHeight || 0) / 2;
  
  // Keep within canvas bounds
  const maxLeft = canvasRect.left + canvasRect.width - (wheel.container.offsetWidth || 0) - 8;
  const maxTop = canvasRect.top + canvasRect.height - (wheel.container.offsetHeight || 0) - 8;
  const minLeft = canvasRect.left + 8;
  const minTop = canvasRect.top + 8;
  
  const absoluteLeft = Math.min(maxLeft, Math.max(minLeft, baseLeft)) + scrollX;
  const absoluteTop = Math.min(maxTop, Math.max(minTop, baseTop)) + scrollY;

  wheel.container.style.left = `${absoluteLeft}px`;
  wheel.container.style.top = `${absoluteTop}px`;
}

/**
 * Open the selection display for a tower being held.
 */
export function openTowerSelectionWheel(tower) {
  if (!tower) {
    return;
  }
  this.closeTowerSelectionWheel();
  const definitions = Array.isArray(getTowerDefinitions()) ? getTowerDefinitions() : [];
  const towers = definitions.filter((definition) => isTowerUnlocked(definition.id) && isTowerPlaceable(definition.id));
  if (!towers.length) {
    return;
  }
  
  const wheel = this.towerSelectionWheel;
  wheel.towers = towers;
  wheel.activeIndex = Math.max(0, towers.findIndex((definition) => definition.id === tower.type));
  wheel.towerId = tower.id;

  const container = document.createElement('div');
  container.className = 'tower-selection-wheel';
  wheel.container = container;
  document.body.append(container);

  // Track pointer drags so touch users can scroll the wheel stepwise.
  wheel.dragState = {
    pointerId: null,
    startY: 0,
    isDragging: false,
    suppressClick: false,
  };

  this.renderTowerSelectionWheel();
  this.positionTowerSelectionWheel(tower);

  // Handle scroll events for step-wise navigation
  const handleScroll = (event) => {
    const delta = event.deltaY || event.detail || event.wheelDelta || 0;
    const direction = delta > 0 ? 1 : -1;
    this.shiftTowerSelectionWheel(direction);
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
  };

  // Handle pointer drags so the menu scrolls in stepwise increments.
  const handlePointerDown = (event) => {
    if (!wheel.dragState || event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    wheel.dragState.pointerId = event.pointerId;
    wheel.dragState.startY = event.clientY;
    wheel.dragState.isDragging = false;
    wheel.dragState.suppressClick = false;
  };

  const handlePointerMove = (event) => {
    if (!wheel.dragState || event.pointerId !== wheel.dragState.pointerId) {
      return;
    }
    const deltaY = event.clientY - wheel.dragState.startY;
    if (!wheel.dragState.isDragging && Math.abs(deltaY) < DRAG_ACTIVATION_DISTANCE) {
      return;
    }
    if (!wheel.dragState.isDragging) {
      // Enter drag mode once the pointer moves far enough to feel intentional.
      wheel.dragState.isDragging = true;
      wheel.dragState.suppressClick = true;
      try {
        wheel.container.setPointerCapture(event.pointerId);
      } catch (error) {
        // Ignore pointer-capture errors to keep scrolling responsive.
      }
    }
    const stepDelta = Math.trunc(deltaY / DRAG_STEP_PIXELS);
    if (stepDelta !== 0) {
      this.shiftTowerSelectionWheel(stepDelta);
      // Adjust the baseline so each step is discrete instead of continuous.
      wheel.dragState.startY += stepDelta * DRAG_STEP_PIXELS;
    }
    event.preventDefault();
  };

  const handlePointerUp = (event) => {
    if (!wheel.dragState || event.pointerId !== wheel.dragState.pointerId) {
      return;
    }
    if (wheel.dragState.isDragging) {
      try {
        wheel.container.releasePointerCapture(event.pointerId);
      } catch (error) {
        // Ignore pointer-capture errors when the pointer ends.
      }
    }
    wheel.dragState.pointerId = null;
    wheel.dragState.startY = 0;
    wheel.dragState.isDragging = false;
  };

  const handleWheelClick = (event) => {
    if (!wheel.dragState?.suppressClick) {
      return;
    }
    // Block the click that follows a drag so selection only happens on taps.
    wheel.dragState.suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  // Handle clicks/taps anywhere outside to confirm selection
  const handleOutsideClick = (event) => {
    if (!wheel?.container) {
      return;
    }
    // Ignore events from the pointer that just opened the wheel (within grace period)
    const timeSinceRelease = performance.now() - (wheel.releaseTimestamp || 0);
    if (wheel.justReleasedPointerId === event.pointerId && timeSinceRelease < POINTER_RELEASE_GRACE_PERIOD_MS) {
      return;
    }
    const target = event.target instanceof Node ? event.target : null;
    const clickedInside = target ? wheel.container.contains(target) : false;
    if (!clickedInside) {
      // Confirm selection with the center tower
      const centerDefinition = wheel.towers[wheel.activeIndex];
      if (centerDefinition) {
        this.applyTowerSelection(centerDefinition);
      } else {
        this.closeTowerSelectionWheel();
        this.cancelTowerHoldGesture();
      }
    }
  };

  wheel.wheelHandler = handleScroll;
  wheel.outsideClickHandler = handleOutsideClick;
  document.addEventListener('wheel', wheel.wheelHandler, { passive: false });
  document.addEventListener('click', wheel.outsideClickHandler);
  document.addEventListener('touchend', wheel.outsideClickHandler);
  // Bind drag handlers directly on the wheel container for stepwise scrolling.
  container.addEventListener('pointerdown', handlePointerDown);
  container.addEventListener('pointermove', handlePointerMove);
  container.addEventListener('pointerup', handlePointerUp);
  container.addEventListener('pointercancel', handlePointerUp);
  container.addEventListener('lostpointercapture', handlePointerUp);
  container.addEventListener('click', handleWheelClick, true);
}

/**
 * Apply the selected tower and transition the held tower to the new type.
 */
export function applyTowerSelection(definition) {
  if (!definition) {
    return;
  }
  const wheel = this.towerSelectionWheel;
  const tower = wheel?.towerId ? this.getTowerById(wheel.towerId) : null;
  if (!tower) {
    this.closeTowerSelectionWheel();
    return;
  }
  
  if (definition.id === tower.type) {
    // Same tower, just close the wheel
    this.closeTowerSelectionWheel();
    return;
  }
  
  // Play the menu selection sound
  if (this.audioManager) {
    this.audioManager.playSfx('menuSelect');
  }
  
  const targetTier = Number.isFinite(definition.tier) ? definition.tier : tower.tier;
  const currentTier = Number.isFinite(tower.tier) ? tower.tier : 0;
  const promoted = targetTier >= currentTier
    ? this.promoteTowerToTarget(tower, definition.id)
    : this.demoteTowerToTarget(tower, definition.id);
  
  if (promoted) {
    this.suppressNextCanvasClick = true;
  }
  this.closeTowerSelectionWheel();
  this.cancelTowerHoldGesture();
}

/**
 * Promote the active tower until it reaches the requested target tier.
 */
export function promoteTowerToTarget(tower, targetId) {
  if (!tower || !targetId) {
    return false;
  }
  
  // Simple direct upgrade to target type
  // This assumes the tower system has a way to directly set tower type
  // For now, we'll use the existing upgrade path
  if (typeof this.upgradeTowerToType === 'function') {
    return this.upgradeTowerToType(tower, targetId);
  }
  
  // Fallback: attempt to upgrade step by step
  const guardSteps = 20;
  let steps = 0;
  while (tower.type !== targetId && steps < guardSteps) {
    if (typeof this.upgradeTowerTier === 'function') {
      const upgraded = this.upgradeTowerTier(tower, { silent: tower.type !== targetId });
      if (!upgraded) {
        return false;
      }
    } else {
      return false;
    }
    steps += 1;
  }
  return tower.type === targetId;
}

/**
 * Demote the active tower toward the requested target.
 */
export function demoteTowerToTarget(tower, targetId) {
  if (!tower || !targetId) {
    return false;
  }
  
  // Simple direct downgrade to target type
  if (typeof this.downgradeTowerToType === 'function') {
    return this.downgradeTowerToType(tower, targetId);
  }
  
  // Fallback: attempt to downgrade step by step
  const guardSteps = 20;
  let steps = 0;
  while (tower.type !== targetId && steps < guardSteps) {
    if (typeof this.demoteTowerTier === 'function') {
      const demoted = this.demoteTowerTier(tower, { silent: tower.type !== targetId });
      if (!demoted) {
        return false;
      }
    } else {
      return false;
    }
    steps += 1;
  }
  return tower.type === targetId;
}
