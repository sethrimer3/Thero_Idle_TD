import { formatCombatNumber } from '../utils/formatting.js';
import {
  getTowerDefinitions,
  getNextTowerId,
  getPreviousTowerId,
  isTowerPlaceable,
  isTowerUnlocked,
} from '../../towersTab.js';

// Scroll step keeps the tower selection wheel responsive while swiping or dragging through options.
const TOWER_SELECTION_SCROLL_STEP_PX = 28;

// Grace period to prevent hold release from being treated as an outside click.
const POINTER_RELEASE_GRACE_PERIOD_MS = 100;

/**
 * Remove the tower selection wheel overlay and detach related listeners.
 */
export function closeTowerSelectionWheel() {
  const wheel = this.towerSelectionWheel;
  if (!wheel) {
    return;
  }
  if (wheel.list && wheel.pointerId !== null) {
    try {
      wheel.list.releasePointerCapture(wheel.pointerId);
    } catch (error) {
      // Ignore pointer capture release errors so cleanup always completes.
    }
  }
  if (wheel.moveHandler) {
    document.removeEventListener('pointermove', wheel.moveHandler);
  }
  if (wheel.endHandler) {
    document.removeEventListener('pointerup', wheel.endHandler);
    document.removeEventListener('pointercancel', wheel.endHandler);
  }
  if (wheel.outsideHandler) {
    document.removeEventListener('pointerdown', wheel.outsideHandler);
  }
  if (wheel.outsideClickHandler) {
    document.removeEventListener('click', wheel.outsideClickHandler);
  }
  if (wheel.animationFrame) {
    cancelAnimationFrame(wheel.animationFrame);
  }
  wheel.animationFrame = null;
  wheel.pointerId = null;
  wheel.dragAccumulator = 0;
  wheel.lastY = 0;
  wheel.focusIndex = 0;
  wheel.targetIndex = 0;
  wheel.itemHeight = 0;
  wheel.moveHandler = null;
  wheel.endHandler = null;
  wheel.outsideHandler = null;
  wheel.outsideClickHandler = null;
  wheel.justReleasedPointerId = null;
  wheel.releaseTimestamp = 0;
  if (wheel.container?.parentNode) {
    wheel.container.remove();
  }
  wheel.container = null;
  wheel.list = null;
  wheel.towers = [];
  wheel.activeIndex = 0;
  wheel.towerId = null;
}

/**
 * Render the scrolling tower list so players can pick any lattice for promotion or demotion.
 */
export function renderTowerSelectionWheel() {
  const wheel = this.towerSelectionWheel;
  if (!wheel?.list || !Array.isArray(wheel.towers) || !wheel.towers.length) {
    return;
  }
  const activeTower = wheel?.towerId ? this.getTowerById(wheel.towerId) : null;
  const clampedIndex = Math.min(Math.max(wheel.activeIndex, 0), wheel.towers.length - 1);
  wheel.activeIndex = clampedIndex;
  wheel.targetIndex = Number.isFinite(wheel.targetIndex) ? wheel.targetIndex : clampedIndex;
  wheel.focusIndex = Number.isFinite(wheel.focusIndex) ? wheel.focusIndex : clampedIndex;
  wheel.list.innerHTML = '';

  wheel.towers.forEach((definition, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'tower-loadout-wheel__item';
    item.dataset.towerId = definition.id;
    
    // Calculate initial distance and styling for smooth wheel effect
    const distance = Math.abs(index - clampedIndex);
    const roundedDistance = Math.round(distance);
    item.dataset.distance = String(roundedDistance);
    item.style.setProperty('--item-distance', distance.toFixed(3));
    
    // Set initial opacity and scale based on distance
    let opacity = 1.0;
    let scale = 1.0;
    if (distance > 0) {
      opacity = Math.max(0, Math.min(1.0, 1.0 - (distance * 0.35)));
      scale = Math.max(0.75, 1.0 - (distance * 0.08));
    }
    item.style.opacity = opacity.toFixed(3);
    item.style.transform = `scale(${scale.toFixed(3)})`;
    if (distance > 2.5) {
      item.style.pointerEvents = 'none';
    }

    if (definition.id === 'sell') {
      item.dataset.role = 'sell';
      const label = document.createElement('span');
      label.className = 'tower-loadout-wheel__label tower-loadout-wheel__label--sell';
      label.textContent = 'SELL';
      item.append(label);
    }

    if (definition.icon) {
      const art = document.createElement('img');
      art.className = 'tower-loadout-wheel__icon';
      art.src = definition.icon;
      art.alt = `${definition.name} icon`;
      art.decoding = 'async';
      art.loading = 'lazy';
      item.append(art);
    }

    const costDelta = this.getTowerSelectionCostDelta({
      targetDefinition: definition,
      sourceTower: activeTower,
    });
    const costLabel = document.createElement('span');
    costLabel.className = 'tower-loadout-wheel__cost';
    costLabel.dataset.direction = costDelta >= 0 ? 'increase' : 'refund';
    const absoluteDelta = Math.max(0, Math.abs(costDelta));
    const formattedDelta = formatCombatNumber(absoluteDelta);
    const prefix = costDelta < 0 ? '+' : '';
    // Remove space between number and symbol, display just the cost value and symbol
    costLabel.textContent = `${prefix}${formattedDelta}${this.theroSymbol}`;
    item.append(costLabel);

    const netAffordable = costDelta <= 0 || this.energy >= costDelta;
    item.dataset.affordable = netAffordable ? 'true' : 'false';
    item.setAttribute(
      'aria-label',
      `${definition.id === 'sell' ? 'Sell lattice' : definition.name || definition.id} — ${
        costDelta >= 0 ? 'Cost' : 'Refund'
      } ${formatCombatNumber(absoluteDelta)} ${this.theroSymbol}`,
    );

    item.addEventListener('click', () => this.applyTowerSelection(definition));
    wheel.list.append(item);
  });

  const height = wheel.list.getBoundingClientRect()?.height || 0;
  const items = wheel.list.querySelectorAll('.tower-loadout-wheel__item');
  const itemHeights = Array.from(items).map((item) => item.getBoundingClientRect()?.height || 0);
  const averageHeight = itemHeights.length
    ? itemHeights.reduce((sum, value) => sum + value, 0) / itemHeights.length
    : 0;
  wheel.itemHeight = Math.max(averageHeight, TOWER_SELECTION_SCROLL_STEP_PX);

  const handleScroll = (event) => {
    const delta = event.deltaY || event.detail || event.wheelDelta || 0;
    const direction = delta > 0 ? 1 : -1;
    const newTarget = (Number.isFinite(wheel.targetIndex) ? wheel.targetIndex : wheel.activeIndex) + direction;
    this.setTowerSelectionWheelTarget(newTarget);
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
  };

  const handleOutsideInteraction = (event) => {
    if (!wheel?.container) {
      return;
    }
    const target = event.target instanceof Node ? event.target : null;
    const clickedInside = target ? wheel.container.contains(target) : false;
    if (!clickedInside) {
      this.closeTowerSelectionWheel();
      this.cancelTowerHoldGesture();
    }
  };

  wheel.list.addEventListener('wheel', handleScroll, { passive: false });
  wheel.list.addEventListener('DOMMouseScroll', handleScroll, { passive: false });
  wheel.list.addEventListener('keydown', (event) => this.handleTowerSelectionWheelKeydown(event));

  wheel.outsideHandler = handleOutsideInteraction;
  wheel.outsideClickHandler = handleOutsideInteraction;
  document.addEventListener('pointerdown', wheel.outsideHandler);
  document.addEventListener('click', wheel.outsideClickHandler);
}

/**
 * Translate the wheel focus by a delta so keyboard navigation remains snappy.
 */
export function shiftTowerSelectionWheel(delta) {
  const wheel = this.towerSelectionWheel;
  if (!wheel?.towers?.length) {
    return;
  }
  const nextIndex = Math.min(
    Math.max((Number.isFinite(wheel.targetIndex) ? wheel.targetIndex : wheel.activeIndex) + delta, 0),
    Math.max(0, wheel.towers.length - 1),
  );
  this.setTowerSelectionWheelTarget(nextIndex);
}

/**
 * Support keyboard navigation for the selection wheel so touch and keyboard feel parity.
 */
export function handleTowerSelectionWheelKeydown(event) {
  if (!event) {
    return;
  }
  if (event.key === 'ArrowUp' || event.key === 'Up') {
    this.shiftTowerSelectionWheel(-1);
    event.preventDefault();
  } else if (event.key === 'ArrowDown' || event.key === 'Down') {
    this.shiftTowerSelectionWheel(1);
    event.preventDefault();
  }
}

/**
 * Attach drag listeners so the wheel can scroll immediately after a hold gesture activates it.
 */
export function startTowerSelectionWheelDrag({ pointerId = null, initialClientY = null, target = null } = {}) {
  const wheel = this.towerSelectionWheel;
  if (!wheel?.list || !Number.isFinite(pointerId)) {
    return;
  }
  if (wheel.pointerId && wheel.pointerId !== pointerId) {
    this.endTowerSelectionWheelDrag({ pointerId: wheel.pointerId });
  }
  if (wheel.moveHandler) {
    document.removeEventListener('pointermove', wheel.moveHandler);
  }
  if (wheel.endHandler) {
    document.removeEventListener('pointerup', wheel.endHandler);
    document.removeEventListener('pointercancel', wheel.endHandler);
  }
  wheel.pointerId = pointerId;
  wheel.lastY = Number.isFinite(initialClientY) ? initialClientY : wheel.lastY || 0;
  wheel.dragAccumulator = 0;
  wheel.moveHandler = (moveEvent) => this.handleTowerSelectionWheelDrag(moveEvent);
  wheel.endHandler = (endEvent) => this.endTowerSelectionWheelDrag(endEvent);
  if (target?.setPointerCapture) {
    try {
      target.setPointerCapture(pointerId);
    } catch (error) {
      // Ignore pointer capture errors so drag gestures still function.
    }
  }
  document.addEventListener('pointermove', wheel.moveHandler);
  document.addEventListener('pointerup', wheel.endHandler);
  document.addEventListener('pointercancel', wheel.endHandler);
}

/**
 * Begin tracking drag gestures on the tower selection wheel.
 */
export function beginTowerSelectionWheelDrag(event) {
  const wheel = this.towerSelectionWheel;
  if (!wheel?.list) {
    return;
  }
  this.startTowerSelectionWheelDrag({ pointerId: event.pointerId, initialClientY: event.clientY, target: wheel.list });
}

/**
 * Translate drag distance into smooth scroll offsets for the selection wheel.
 */
export function handleTowerSelectionWheelDrag(event) {
  const wheel = this.towerSelectionWheel;
  if (!wheel || event.pointerId !== wheel.pointerId) {
    return;
  }
  if (typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
  const deltaY = event.clientY - wheel.lastY;
  wheel.lastY = event.clientY;
  wheel.dragAccumulator += deltaY;
  const itemHeight = Math.max(1, wheel.itemHeight || TOWER_SELECTION_SCROLL_STEP_PX);
  const deltaIndex = wheel.dragAccumulator / itemHeight;
  if (Math.abs(deltaIndex) >= 0.01) {
    this.setTowerSelectionWheelTarget(
      (Number.isFinite(wheel.targetIndex) ? wheel.targetIndex : wheel.activeIndex) - deltaIndex,
    );
    wheel.dragAccumulator = 0;
  }
}

/**
 * Stop tracking pointer drag interactions on the tower selection wheel.
 */
export function endTowerSelectionWheelDrag(event) {
  const wheel = this.towerSelectionWheel;
  if (!wheel || event.pointerId !== wheel.pointerId) {
    return;
  }
  if (wheel.moveHandler) {
    document.removeEventListener('pointermove', wheel.moveHandler);
  }
  if (wheel.endHandler) {
    document.removeEventListener('pointerup', wheel.endHandler);
    document.removeEventListener('pointercancel', wheel.endHandler);
  }
  try {
    wheel.list?.releasePointerCapture?.(event.pointerId);
  } catch (error) {
    // Ignore release failures so drag cleanup always completes.
  }
  
  // Store the pointer ID to prevent the release event from immediately closing the wheel via outside click handler
  wheel.justReleasedPointerId = wheel.pointerId;
  wheel.releaseTimestamp = performance.now();
  
  wheel.pointerId = null;
  wheel.dragAccumulator = 0;
  wheel.lastY = 0;
  wheel.moveHandler = null;
  wheel.endHandler = null;
  if (wheel.towers.length) {
    this.setTowerSelectionWheelTarget(Math.round(wheel.focusIndex));
  }
}

/**
 * Position the tower selection wheel above the active lattice.
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
  // Constrain the selector to the playfield (canvas) boundaries only
  const baseLeft = canvasRect.left + screen.x - (wheel.container.offsetWidth || 0) / 2;
  const baseTop = canvasRect.top + screen.y - (wheel.container.offsetHeight || 0) / 2;
  // Use canvas bounds instead of viewport to keep wheel within playfield
  const maxLeft = canvasRect.left + canvasRect.width - (wheel.container.offsetWidth || 0) - 8;
  const maxTop = canvasRect.top + canvasRect.height - (wheel.container.offsetHeight || 0) - 8;
  const minLeft = canvasRect.left + 8;
  const minTop = canvasRect.top + 8;
  let absoluteLeft = Math.min(maxLeft, Math.max(minLeft, baseLeft)) + scrollX;
  let absoluteTop = Math.min(maxTop, Math.max(minTop, baseTop)) + scrollY;

  wheel.container.style.left = `${absoluteLeft}px`;
  wheel.container.style.top = `${absoluteTop}px`;

  const activeItem = wheel.list?.querySelector('[data-distance="0"]');
  const targetX = canvasRect.left + screen.x;
  const targetY = canvasRect.top + screen.y;
  if (activeItem) {
    const itemRect = activeItem.getBoundingClientRect();
    const icon =
      activeItem.querySelector('.tower-loadout-wheel__icon') || activeItem.querySelector('.tower-loadout-wheel__label');
    const cost = activeItem.querySelector('.tower-loadout-wheel__cost');
    const iconRect = icon?.getBoundingClientRect ? icon.getBoundingClientRect() : null;
    const costRect = cost?.getBoundingClientRect ? cost.getBoundingClientRect() : null;

    if (itemRect?.height) {
      const itemCenterY = (itemRect.top + itemRect.bottom) / 2;
      const deltaY = targetY - itemCenterY;
      // Clamp adjustments to keep within canvas bounds
      absoluteTop = Math.min(maxTop, Math.max(minTop, absoluteTop + deltaY));
    }

    if (iconRect?.width) {
      const desiredIconRight = targetX - 8;
      const deltaX = desiredIconRight - iconRect.right;
      // Clamp adjustments to keep within canvas bounds
      absoluteLeft = Math.min(maxLeft, Math.max(minLeft, absoluteLeft + deltaX));
    } else if (costRect?.left) {
      const desiredCostLeft = targetX + 6;
      const deltaX = desiredCostLeft - costRect.left;
      // Clamp adjustments to keep within canvas bounds
      absoluteLeft = Math.min(maxLeft, Math.max(minLeft, absoluteLeft + deltaX));
    }
  }

  wheel.container.style.left = `${absoluteLeft}px`;
  wheel.container.style.top = `${absoluteTop}px`;
}

/**
 * Open the selection wheel so a held tower can morph into any unlocked lattice.
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
  const options = [
    { id: 'sell', name: 'Sell lattice' },
    ...towers,
  ];
  const wheel = this.towerSelectionWheel;
  wheel.towers = options;
  wheel.activeIndex = Math.max(0, options.findIndex((definition) => definition.id === tower.type));
  wheel.focusIndex = wheel.activeIndex;
  wheel.targetIndex = wheel.activeIndex;
  wheel.towerId = tower.id;

  const container = document.createElement('div');
  container.className = 'tower-loadout-wheel';
  const list = document.createElement('div');
  list.className = 'tower-loadout-wheel__list';
  container.append(list);

  wheel.container = container;
  wheel.list = list;
  document.body.append(container);

  this.renderTowerSelectionWheel();
  list.addEventListener('pointerdown', (event) => this.beginTowerSelectionWheelDrag(event));
  list.addEventListener('pointerup', (event) => this.endTowerSelectionWheelDrag(event));
  list.addEventListener('pointercancel', (event) => this.endTowerSelectionWheelDrag(event));
  list.addEventListener('pointermove', (event) => {
    if (wheel.pointerId === event.pointerId) {
      this.handleTowerSelectionWheelDrag(event);
    }
  });
  list.addEventListener('pointerenter', () => {
    const itemHeight = Math.max(1, wheel.itemHeight || TOWER_SELECTION_SCROLL_STEP_PX);
    this.setTowerSelectionWheelTarget(Math.round(wheel.focusIndex || 0 + 0.0001));
    wheel.list.style.setProperty('--tower-loadout-wheel-item-height', `${itemHeight}px`);
  });
  this.positionTowerSelectionWheel(tower);

  const handleKeyNavigation = (event) => {
    if (event.key === 'Escape') {
      this.closeTowerSelectionWheel();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const focusedIndex = Math.round(Number.isFinite(wheel.focusIndex) ? wheel.focusIndex : wheel.activeIndex);
      const targetDefinition = wheel.towers[focusedIndex] || null;
      if (targetDefinition) {
        this.applyTowerSelection(targetDefinition);
      }
      return;
    }
  };
  list.addEventListener('keydown', handleKeyNavigation);

  const handleWheelEvent = (event) => {
    const delta = event.deltaY || event.detail || event.wheelDelta || 0;
    const direction = delta > 0 ? 1 : -1;
    const newTarget = (Number.isFinite(wheel.targetIndex) ? wheel.targetIndex : wheel.activeIndex) + direction;
    this.setTowerSelectionWheelTarget(newTarget);
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
  };
  list.addEventListener('wheel', handleWheelEvent, { passive: false });
  list.addEventListener('DOMMouseScroll', handleWheelEvent, { passive: false });

  const handleOutsideInteraction = (event) => {
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
      this.closeTowerSelectionWheel();
      this.cancelTowerHoldGesture();
    }
  };

  wheel.outsideHandler = handleOutsideInteraction;
  wheel.outsideClickHandler = handleOutsideInteraction;
  document.addEventListener('pointerdown', wheel.outsideHandler);
  document.addEventListener('click', wheel.outsideClickHandler);
}

/**
 * Update the distance metadata for each option so scaling follows the focused entry.
 */
export function updateTowerSelectionWheelDistances() {
  const wheel = this.towerSelectionWheel;
  if (!wheel?.list) {
    return;
  }
  const focusIndex = Number.isFinite(wheel.focusIndex) ? wheel.focusIndex : wheel.activeIndex;
  Array.from(wheel.list.children).forEach((child, index) => {
    // Calculate distance without rounding to allow smooth transitions
    const distance = Math.abs(index - focusIndex);
    const roundedDistance = Math.round(distance);
    
    // Set both the rounded distance (for CSS selectors) and exact distance (for smooth scaling)
    child.dataset.distance = String(roundedDistance);
    child.style.setProperty('--item-distance', distance.toFixed(3));
    
    // Calculate opacity and scale based on exact distance for smooth wheel effect
    let opacity = 1.0;
    let scale = 1.0;
    
    if (distance > 0) {
      // Linear falloff for opacity: 1.0 at distance 0, 0.70 at distance 1, 0.30 at distance 2, 0 beyond
      opacity = Math.max(0, Math.min(1.0, 1.0 - (distance * 0.35)));
      // Scale falloff: 1.0 at distance 0, 0.92 at distance 1, 0.84 at distance 2, continues to shrink
      scale = Math.max(0.75, 1.0 - (distance * 0.08));
    }
    
    // Apply the calculated values directly to the element for smooth transitions
    child.style.opacity = opacity.toFixed(3);
    child.style.transform = `scale(${scale.toFixed(3)})`;
    
    // Hide items beyond distance 2.5 to keep the wheel focused
    if (distance > 2.5) {
      child.style.pointerEvents = 'none';
    } else {
      child.style.pointerEvents = 'auto';
    }
  });
}

/**
 * Smoothly translate the wheel list so the focused option aligns with the tower anchor.
 */
export function updateTowerSelectionWheelTransform({ immediate = false } = {}) {
  const wheel = this.towerSelectionWheel;
  if (!wheel?.list || !Number.isFinite(wheel.focusIndex)) {
    return;
  }
  const itemHeight = Math.max(1, wheel.itemHeight || TOWER_SELECTION_SCROLL_STEP_PX);
  const listHeight = wheel.list.getBoundingClientRect()?.height || itemHeight;
  const offset = -wheel.focusIndex * itemHeight + listHeight / 2 - itemHeight / 2;
  wheel.list.style.willChange = 'transform';
  wheel.list.style.transition = immediate ? 'none' : 'transform 140ms ease-out';
  wheel.list.style.transform = `translateY(${offset}px)`;
  const roundedIndex = Math.min(
    Math.max(Math.round(wheel.focusIndex), 0),
    Math.max(0, wheel.towers.length - 1),
  );
  wheel.activeIndex = roundedIndex;
  this.updateTowerSelectionWheelDistances();
  if (wheel.towerId) {
    const tower = this.getTowerById(wheel.towerId);
    if (tower) {
      this.positionTowerSelectionWheel(tower);
    }
  }
  if (immediate) {
    requestAnimationFrame(() => {
      if (wheel.list) {
        wheel.list.style.transition = 'transform 140ms ease-out';
      }
    });
  }
}

/**
 * Advance the focus index toward a target so scrolling eases instead of stepping.
 */
export function setTowerSelectionWheelTarget(targetIndex) {
  const wheel = this.towerSelectionWheel;
  if (!wheel || !Array.isArray(wheel.towers) || !wheel.towers.length) {
    return;
  }
  const clamped = Math.min(Math.max(targetIndex, 0), Math.max(0, wheel.towers.length - 1));
  wheel.targetIndex = clamped;
  if (!Number.isFinite(wheel.focusIndex)) {
    wheel.focusIndex = clamped;
  }
  const stepAnimation = () => {
    const target = Number.isFinite(wheel.targetIndex) ? wheel.targetIndex : wheel.focusIndex;
    const current = Number.isFinite(wheel.focusIndex) ? wheel.focusIndex : target;
    const delta = target - current;
    if (Math.abs(delta) < 0.002) {
      wheel.focusIndex = target;
      this.updateTowerSelectionWheelTransform();
      wheel.animationFrame = null;
      return;
    }
    wheel.focusIndex = current + delta * 0.2;
    this.updateTowerSelectionWheelTransform();
    wheel.animationFrame = requestAnimationFrame(stepAnimation);
  };
  if (!wheel.animationFrame) {
    wheel.animationFrame = requestAnimationFrame(stepAnimation);
  }
}

/**
 * Apply the selected tower template and mirror promotion or demotion costs accordingly.
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
  if (definition.id === 'sell') {
    // Treat the sell row as a direct lattice dissolution shortcut.
    this.sellTower(tower);
    this.closeTowerSelectionWheel();
    this.cancelTowerHoldGesture();
    return;
  }
  if (definition.id === tower.type) {
    this.closeTowerSelectionWheel();
    return;
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
  const guardSteps = (Array.isArray(getTowerDefinitions()) ? getTowerDefinitions().length : 12) + 2;
  const visited = new Set();
  let steps = 0;
  while (tower.type !== targetId && steps < guardSteps) {
    if (visited.has(tower.type)) {
      break;
    }
    visited.add(tower.type);
    const nextId = getNextTowerId(tower.type) || targetId;
    const isFinalStep = nextId === targetId;
    const upgraded = this.upgradeTowerTier(tower, { expectedNextId: nextId, silent: !isFinalStep });
    if (!upgraded) {
      return false;
    }
    steps += 1;
  }
  return tower.type === targetId;
}

/**
 * Demote the active tower toward the requested target while respecting refund math.
 */
export function demoteTowerToTarget(tower, targetId) {
  if (!tower || !targetId) {
    return false;
  }
  const guardSteps = (Array.isArray(getTowerDefinitions()) ? getTowerDefinitions().length : 12) + 2;
  const visited = new Set();
  let steps = 0;
  while (tower.type !== targetId && steps < guardSteps) {
    if (visited.has(tower.type)) {
      break;
    }
    visited.add(tower.type);
    const previousId = getPreviousTowerId(tower.type);
    const isFinalStep = previousId === targetId;
    const demoted = this.demoteTowerTier(tower, { silent: !isFinalStep });
    if (!demoted) {
      return false;
    }
    steps += 1;
  }
  return tower.type === targetId;
}
