'use strict';

// Fluid Terrarium Placement System
// Overlay init, placement preview/confirmation, container events, bounds, mask loading
// All constants that were local to fluidTerrariumTrees.js but exclusive to these methods.
// Each function is called via .call(this) where `this` is the FluidTerrariumTrees instance.

import { STORE_STATUS_DEFAULT } from './fluidTerrariumStoreSystem.js';

// Estimated dimensions for the placement confirmation dialog to prevent off-screen positioning
export const CONFIRMATION_DIALOG_ESTIMATED_HALF_WIDTH = 100; // Dialog is centered with translate(-50%, ...)
export const CONFIRMATION_DIALOG_ESTIMATED_HEIGHT = 80; // Includes transform offset
export const CONFIRMATION_DIALOG_PADDING = 10; // Minimum distance from viewport edges

// Terrain validation constants for placement checking
export const TERRAIN_SEARCH_MIN_RADIUS = 5; // Minimum pixels to search below placement point
export const TERRAIN_SEARCH_PERCENTAGE = 0.05; // Search up to 5% of terrain height below point

export const PLACEMENT_DIMENSIONS = {
  large: { widthRatio: 0.08, heightRatio: 0.26 },
  small: { widthRatio: 0.05, heightRatio: 0.18 },
};

/**
 * Create the overlay element that will hold all fractal canvases.
 */
export function fttpsInitializeOverlay() {
  if (!this.container || typeof document === 'undefined') {
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = 'fluid-terrarium__trees';

  const treeLayer = document.createElement('div');
  treeLayer.className = 'fluid-terrarium__tree-layer';
  overlay.appendChild(treeLayer);

  const badgeLayer = document.createElement('div');
  badgeLayer.className = 'fluid-terrarium__tree-badges';
  overlay.appendChild(badgeLayer);

  // Cluster the terrarium controls so they can sit along the magma shelf in the Bet cave.
  const controlCluster = document.createElement('div');
  controlCluster.className = 'fluid-tree-control-cluster';

  const levelButton = document.createElement('button');
  levelButton.type = 'button';
  levelButton.className = 'fluid-tree-level-toggle';
  levelButton.textContent = 'Lv.';
  // Small overlay toggle that reveals tree levels and leveling progress bars on demand.
  levelButton.setAttribute('aria-label', 'Tree levels are always visible');
  levelButton.title = 'Tree levels are always visible';
  levelButton.addEventListener('click', (event) => {
    // Prevent the click from bubbling into the basin so manual drop handlers don't swallow the toggle.
    event.stopPropagation();
    event.preventDefault();
    this.levelingMode = !this.levelingMode;
    this.syncLevelingMode();
    this.emitState();
  });
  levelButton.setAttribute('aria-pressed', this.levelingMode ? 'true' : 'false');

  const storeButton = document.createElement('button');
  storeButton.type = 'button';
  storeButton.className = 'fluid-tree-store-toggle';
  storeButton.textContent = 'Store';
  storeButton.setAttribute('aria-label', 'Open terrarium store');
  storeButton.setAttribute('aria-expanded', 'false');
  storeButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    this.toggleStorePanel();
  });

  const storePanel = this.buildStorePanel();

  this.overlay = overlay;
  this.treeLayer = treeLayer;
  this.badgeLayer = badgeLayer;
  this.levelButton = levelButton;
  this.storeButton = storeButton;
  this.storePanel = storePanel;
  this.controlCluster = controlCluster;

  controlCluster.appendChild(levelButton);
  controlCluster.appendChild(storeButton);
  this.container.appendChild(controlCluster);
  if (storePanel) {
    this.container.appendChild(storePanel);
  }
  this.container.appendChild(overlay);

  if (this.container) {
    this.container.addEventListener('pointermove', this.handleContainerPointerMove);
    this.container.addEventListener('pointerleave', this.handleContainerPointerLeave);
    this.container.addEventListener('click', this.handleContainerClick, { capture: true });
  }

  if (this.overlay) {
    const preview = document.createElement('div');
    preview.className = 'fluid-tree-placement-preview';
    preview.setAttribute('aria-hidden', 'true');
    preview.hidden = true;
    this.overlay.appendChild(preview);
    this.placementPreview = preview;

    const confirmationPrompt = document.createElement('div');
    confirmationPrompt.className = 'fluid-tree-placement-confirm';
    confirmationPrompt.setAttribute('aria-hidden', 'true');
    confirmationPrompt.hidden = true;

    const confirmationText = document.createElement('p');
    confirmationText.className = 'fluid-tree-placement-confirm__text';
    confirmationText.textContent = 'Confirm placement?';
    confirmationPrompt.appendChild(confirmationText);

    const confirmationActions = document.createElement('div');
    confirmationActions.className = 'fluid-tree-placement-confirm__actions';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'fluid-tree-placement-confirm__button fluid-tree-placement-confirm__button--cancel';
    cancelButton.textContent = '✕';
    cancelButton.setAttribute('aria-label', 'Cancel placement');
    cancelButton.addEventListener('click', this.handleCancelPlacement);
    confirmationActions.appendChild(cancelButton);

    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = 'fluid-tree-placement-confirm__button fluid-tree-placement-confirm__button--confirm';
    confirmButton.textContent = '✔';
    confirmButton.setAttribute('aria-label', 'Confirm placement');
    confirmButton.addEventListener('click', this.handleConfirmPlacement);
    confirmationActions.appendChild(confirmButton);

    confirmationPrompt.appendChild(confirmationActions);
    this.overlay.appendChild(confirmationPrompt);

    this.confirmationPrompt = confirmationPrompt;
    this.confirmationText = confirmationText;
    this.confirmButton = confirmButton;
    this.cancelButton = cancelButton;
  }

  this.syncLevelingMode();
  this.toggleStorePanel(this.isStoreOpen, { preserveSelection: true, suppressEmit: true });
  this.setCameraMode(this.cameraMode, { notifyHost: false });
  this.refreshBounds();
}

export function fttpsHidePlacementPreview() {
  if (this.placementPreview) {
    this.placementPreview.hidden = true;
    this.placementPreview.removeAttribute('data-visible');
    this.placementPreview.removeAttribute('data-valid');
    this.placementPreview.removeAttribute('data-reason');
    this.placementPreview.removeAttribute('title');
    this.placementPreview.removeAttribute('aria-label');
    this.placementPreview.textContent = '';
  }
  this.pendingPlacementPoint = null;
}

/**
 * Update the placement preview marker so the player knows where a store object will land.
 * Shows the item's icon instead of a simple circle.
 * @param {{xRatio:number,yRatio:number,isInside:boolean}} point
 * @param {boolean} isValid
 * @param {object|null} [storeItem] - The store item being placed, used to display its icon
 * @param {string} [reason] - Optional placement guidance shown in the aria label
 */
export function fttpsUpdatePlacementPreview(point, isValid, storeItem = null, reason = '') {
  if (!this.placementPreview || !point?.isInside) {
    this.hidePlacementPreview();
    return;
  }
  const left = this.renderBounds.left + point.xRatio * this.renderBounds.width;
  const top = this.renderBounds.top + point.yRatio * this.renderBounds.height;
  this.placementPreview.style.left = `${left}px`;
  this.placementPreview.style.top = `${top}px`;
  this.placementPreview.hidden = false;
  this.placementPreview.dataset.visible = 'true';
  this.placementPreview.dataset.valid = isValid ? 'true' : 'false';
  this.placementPreview.dataset.reason = reason || '';
  // Display the item's icon if available; otherwise show a fallback emoji
  this.placementPreview.textContent = storeItem?.icon || '🌿';
  if (reason) {
    this.placementPreview.setAttribute('title', reason);
    this.placementPreview.setAttribute('aria-label', reason);
  } else {
    const label = storeItem?.label ? `Preview ${storeItem.label}` : 'Placement preview';
    this.placementPreview.setAttribute('aria-label', label);
    this.placementPreview.removeAttribute('title');
  }
}

/**
 * Surface confirmation controls so the player can approve or cancel the drop.
 * @param {{xRatio:number,yRatio:number,isInside:boolean}} point
 * @param {object} storeItem
 */
export function fttpsShowPlacementConfirmation(point, storeItem) {
  if (!this.confirmationPrompt || !point?.isInside) {
    return;
  }
  // Calculate base position
  let left = this.renderBounds.left + point.xRatio * this.renderBounds.width;
  let top = this.renderBounds.top + point.yRatio * this.renderBounds.height - 32;
  
  // Get viewport bounds (use window dimensions as the limiting container)
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Clamp horizontal position to keep dialog on screen
  // Account for the -50% transform by ensuring left position allows for half-width on each side
  left = Math.max(
    CONFIRMATION_DIALOG_ESTIMATED_HALF_WIDTH + CONFIRMATION_DIALOG_PADDING,
    Math.min(viewportWidth - CONFIRMATION_DIALOG_ESTIMATED_HALF_WIDTH - CONFIRMATION_DIALOG_PADDING, left)
  );
  
  // Clamp vertical position to keep dialog on screen
  // The dialog appears above the point, so ensure there's room above
  top = Math.max(
    CONFIRMATION_DIALOG_ESTIMATED_HEIGHT + CONFIRMATION_DIALOG_PADDING,
    Math.min(viewportHeight - CONFIRMATION_DIALOG_PADDING, top)
  );
  
  this.confirmationPrompt.style.left = `${left}px`;
  this.confirmationPrompt.style.top = `${top}px`;
  this.confirmationPrompt.hidden = false;
  this.confirmationPrompt.dataset.visible = 'true';
  this.confirmationPrompt.setAttribute('aria-hidden', 'false');
  if (this.confirmationText) {
    const label = storeItem?.label || 'this object';
    this.confirmationText.textContent = `Place ${label} here?`;
  }
}

/**
 * Hide the confirmation controls when no placement is pending.
 */
export function fttpsHidePlacementConfirmation() {
  if (!this.confirmationPrompt) {
    return;
  }
  this.confirmationPrompt.hidden = true;
  this.confirmationPrompt.removeAttribute('data-visible');
  this.confirmationPrompt.setAttribute('aria-hidden', 'true');
}

/**
 * Queue a placement for confirmation instead of placing immediately.
 * @param {{xRatio:number,yRatio:number,isInside:boolean}} point
 * @param {object} storeItem
 * @param {object} [options]
 */
export function fttpsQueuePlacementForConfirmation(point, storeItem, options = {}) {
  if (!point?.isInside || !storeItem) {
    return;
  }
  const validity = this.getPlacementValidity(point, storeItem);
  this.updatePlacementPreview(point, validity.valid, storeItem, validity.reason);
  if (!validity.valid) {
    this.pendingPlacement = null;
    this.setStoreStatus(validity.reason || 'Pick an open patch of terrain. Placements are not saved to your profile.');
    this.hidePlacementConfirmation();
    return;
  }

  this.activeStoreItemId = storeItem.id;
  this.pendingPlacementPoint = point;
  this.pendingPlacement = { point, storeItemId: storeItem.id };
  if (options.fadeStore) {
    this.fadeStorePanelForDrag();
  }
  this.showPlacementConfirmation(point, storeItem);
  this.setStoreStatus('Confirm or cancel to finish placing this item.');
}

/**
 * Cancel the pending placement and restore UI affordances.
 */
export function fttpsHandleCancelPlacement() {
  this.clearPendingPlacement(true);
  this.setStoreStatus(STORE_STATUS_DEFAULT);
}

/**
 * Finalize a placement after explicit confirmation.
 */
export function fttpsHandleConfirmPlacement() {
  this.commitPendingPlacement();
}

/**
 * Resolve the pending placement by spending serendipity and planting the item.
 */
export function fttpsCommitPendingPlacement() {
  if (!this.pendingPlacement) {
    return;
  }
  const storeItem = this.getStoreItemById(this.pendingPlacement.storeItemId) || this.getActiveStoreItem();
  const point = this.pendingPlacement.point;
  const validity = this.getPlacementValidity(point, storeItem);
  if (!storeItem || !validity.valid) {
    this.setStoreStatus(validity.reason || 'Pick an open patch of terrain. Placements are not saved to your profile.');
    this.clearPendingPlacement(true);
    return;
  }
  const placed = this.placeActiveStoreItem(point, storeItem);
  this.clearPendingPlacement(true);
  if (!placed) {
    this.updateStoreSelectionVisuals(storeItem.id);
  }
}

/**
 * Clear pending placement state, visuals, and restore the store panel.
 * @param {boolean} [restoreOpacity=false]
 */
export function fttpsClearPendingPlacement(restoreOpacity = false) {
  this.pendingPlacement = null;
  this.pendingPlacementPoint = null;
  this.hidePlacementConfirmation();
  this.hidePlacementPreview();
  if (restoreOpacity) {
    this.restoreStorePanelOpacity();
  }
}

export function fttpsHandleContainerPointerMove(event) {
  const isDragging = Boolean(this.draggedStoreItemId);
  if (this.pendingPlacement) {
    return;
  }
  if ((!this.isStoreOpen || !this.activeStoreItemId) && !isDragging) {
    return;
  }
  if (isDragging) {
    return;
  }
  if (this.storePanel && this.storePanel.contains(event.target)) {
    return;
  }
  const storeItem = this.getActiveStoreItem();
  const point = this.getNormalizedPointFromClient(event.clientX, event.clientY);
  if (!point) {
    this.hidePlacementPreview();
    return;
  }
  this.pendingPlacementPoint = point;
  const validity = this.getPlacementValidity(point, storeItem);
  this.updatePlacementPreview(point, validity.valid, storeItem, validity.reason);
  if (!validity.valid && validity.reason) {
    this.setStoreStatus(validity.reason);
  }
}

export function fttpsHandleContainerPointerLeave() {
  if (this.pendingPlacement) {
    return;
  }
  this.hidePlacementPreview();
}

export function fttpsHandleContainerClick(event) {
  // Check if click originated from store panel FIRST, before any other logic
  if (this.storePanel && (this.storePanel === event.target || this.storePanel.contains(event.target))) {
    return; // Let the store panel handle its own clicks
  }
  
  if (this.pendingPlacement) {
    return;
  }

  if (!this.isStoreOpen || !this.activeStoreItemId) {
    return;
  }

  const storeItem = this.getActiveStoreItem();
  const point = this.getNormalizedPointFromClient(event.clientX, event.clientY);
  const validity = point ? this.getPlacementValidity(point, storeItem) : { valid: false, reason: '' };
  if (!validity.valid) {
    this.setStoreStatus(validity.reason || 'Pick an open patch of terrain. Placements are not saved to your profile.');
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  this.queuePlacementForConfirmation(point, storeItem);
}

/**
 * Convert a screen coordinate into a normalized point relative to the terrarium sprite.
 * Refreshes renderBounds first to ensure coordinates are accurate after resizes or pans.
 * @param {number} clientX
 * @param {number} clientY
 */
export function fttpsGetNormalizedPointFromClient(clientX, clientY) {
  if (!this.container) {
    return null;
  }
  // Refresh bounds to ensure renderBounds is synchronized with the current container state.
  this.refreshBounds();
  if (!this.renderBounds.width || !this.renderBounds.height) {
    return null;
  }
  const rect = this.container.getBoundingClientRect();
  const offsetX = clientX - rect.left - this.renderBounds.left;
  const offsetY = clientY - rect.top - this.renderBounds.top;
  const xRatio = offsetX / Math.max(1, this.renderBounds.width);
  const yRatio = offsetY / Math.max(1, this.renderBounds.height);
  return {
    xRatio,
    yRatio,
    isInside: xRatio >= 0 && xRatio <= 1 && yRatio >= 0 && yRatio <= 1,
  };
}

/**
 * Evaluate placement validity and surface a human-readable reason when invalid.
 * @param {{xRatio:number,yRatio:number,isInside:boolean}} point
 * @param {object|null} [storeItem]
 * @returns {{ valid: boolean, reason: string }}
 */
export function fttpsGetPlacementValidity(point, storeItem = this.getActiveStoreItem()) {
  if (!storeItem) {
    return { valid: false, reason: 'Select an item from the store first.' };
  }
  // Celestial bodies don't require a specific placement location - any click is valid
  if (storeItem.itemType === 'celestial') {
    return { valid: true, reason: '' };
  }
  if (!point?.isInside) {
    return { valid: false, reason: 'Tap inside the basin to place this item.' };
  }
  if (point.yRatio < storeItem.minY) {
    return { valid: false, reason: 'Too high. Aim closer to the terrarium floor.' };
  }
  if (point.yRatio > storeItem.maxY) {
    return { valid: false, reason: 'Too low. Aim closer to the ridgeline or canopy.' };
  }
  // Cave-only items (like Brownian Forest) must be placed inside cave spawn zones.
  if (storeItem.caveOnly && !this.isPointInCaveZone(point)) {
    return { valid: false, reason: 'This bloom prefers the cave shadow.' };
  }
  
  // Items that need to be placed ON terrain surfaces (not inside ground or floating in water)
  // This includes: slimes, trees, and fractals (but NOT shrooms which go in caves, or birds which fly)
  if (this.requiresTerrainSurface(storeItem.itemType) && !this.isPointOnWalkableTerrain(point)) {
    if (storeItem.itemType === 'slime') {
      return { valid: false, reason: 'Delta slimes need a terrain surface to hop on. Try clicking on the ground or ledges.' };
    }
    if (storeItem.itemType === 'tree' || storeItem.itemType === 'fractal') {
      return { valid: false, reason: 'Trees must be rooted on solid terrain, not buried underground or floating in water.' };
    }
    return { valid: false, reason: 'This item needs to be placed on a terrain surface.' };
  }
  
  const spacing = Math.max(0.02, storeItem.minSpacing || 0.08);
  const anchors = this.getCombinedAnchors();
  const colliding = anchors.some((anchor) => {
    const anchorX = Number.isFinite(anchor?.centerX) ? anchor.centerX : 0;
    const anchorY = Number.isFinite(anchor?.baseY) ? anchor.baseY : 0;
    const distance = Math.hypot(anchorX - point.xRatio, anchorY - point.yRatio);
    return distance < spacing;
  });
  if (colliding) {
    const clearance = Math.round(spacing * 100);
    return { valid: false, reason: `Keep about ${clearance}% clearance from other objects.` };
  }
  return { valid: true, reason: '' };
}

/**
 * Validate whether a normalized point is acceptable for the selected store item.
 * @param {{xRatio:number,yRatio:number,isInside:boolean}} point
 * @param {object|null} [storeItem]
 */
export function fttpsIsPlacementLocationValid(point, storeItem = this.getActiveStoreItem()) {
  return this.getPlacementValidity(point, storeItem).valid;
}

/**
 * Merge the baked-in anchors with player-placed entries.
 */
export function fttpsGetCombinedAnchors() {
  return [...this.anchors, ...this.playerPlacements];
}

/**
 * Generate a normalized anchor from a placement gesture.
 * @param {{xRatio:number,yRatio:number}} point
 * @param {object} storeItem
 */
export function fttpsCreatePlacementAnchor(point, storeItem) {
  const dimensions = PLACEMENT_DIMENSIONS[storeItem.size] || PLACEMENT_DIMENSIONS.large;
  const clampedX = Math.min(1, Math.max(0, point.xRatio));
  const clampedY = Math.min(1, Math.max(0, point.yRatio));
  const anchor = {
    centerX: clampedX,
    baseY: clampedY,
    rawBaseY: clampedY,
    widthRatio: dimensions.widthRatio,
    heightRatio: dimensions.heightRatio,
    size: storeItem.size,
    origin: storeItem.origin,
    ephemeral: true,
    initialAllocation: storeItem.initialAllocation,
    itemType: storeItem.itemType || 'tree',
    fractalType: storeItem.fractalType || null,
    caveOnly: Boolean(storeItem.caveOnly),
  };
  this.getPlacementId(anchor);
  return anchor;
}

/**
 * Ensure every player placement receives a stable identifier for animation tracking.
 * @param {object} anchor
 */
export function fttpsGetPlacementId(anchor) {
  if (!anchor) {
    return '';
  }
  if (!anchor.placementId) {
    this.ephemeralIdCounter += 1;
    anchor.placementId = `placement-${this.ephemeralIdCounter}`;
  }
  return anchor.placementId;
}

/**
 * Provide a static state object for ephemeral trees so they can grow without persistence.
 * @param {object} anchor
 */
export function fttpsCreateEphemeralTreeState(anchor) {
  const allocation = Number.isFinite(anchor?.initialAllocation)
    ? Math.max(0, anchor.initialAllocation)
    : anchor?.size === 'small'
      ? 4
      : 6;
  return { allocated: allocation };
}

/**
 * Convert a placement selection into a live tree without persisting to the player profile.
 * @param {{xRatio:number,yRatio:number}} point
 */
export function fttpsPlaceActiveStoreItem(point, storeItem = this.getActiveStoreItem()) {
  if (!storeItem) {
    return false;
  }
  if (!this.purchaseStoreItem(storeItem)) {
    this.setStoreStatus(`Requires ${storeItem.cost} Scintillae to place ${storeItem.label}.`);
    return false;
  }

  // Check if this is a shroom item - delegate to the shroom placement callback
  if (storeItem.itemType === 'shroom' && this.onShroomPlace) {
    const shroomPlaced = this.onShroomPlace({
      type: storeItem.shroomType,
      colorVariant: storeItem.colorVariant,
      point,
      storeItem,
    });
    if (shroomPlaced) {
      this.setStoreStatus(`${storeItem.label} planted inside the cave.`);
      this.updatePlacementPreview(point, true, storeItem);
      this.consumeStoreItem(storeItem.id);
      this.clearStoreSelection();
      return true;
    }
    this.setStoreStatus('Could not place shroom. Try a location inside a cave.');
    return false;
  }

  // Check if this is a slime item - delegate to the slime placement callback
  if (storeItem.itemType === 'slime' && this.onSlimePlace) {
    const slimePlaced = this.onSlimePlace({
      point,
      storeItem,
    });
    if (slimePlaced) {
      this.setStoreStatus(`${storeItem.label} released into the basin.`);
      this.updatePlacementPreview(point, true, storeItem);
      this.consumeStoreItem(storeItem.id);
      this.clearStoreSelection();
      return true;
    }
    this.setStoreStatus('Could not release slime. Try again.');
    return false;
  }

  // Check if this is a bird item - delegate to the bird placement callback
  if (storeItem.itemType === 'bird' && this.onBirdPlace) {
    const birdPlaced = this.onBirdPlace({
      point,
      storeItem,
    });
    if (birdPlaced) {
      this.setStoreStatus(`${storeItem.label} released into the sky.`);
      this.updatePlacementPreview(point, true, storeItem);
      this.consumeStoreItem(storeItem.id);
      this.clearStoreSelection();
      return true;
    }
    this.setStoreStatus('Could not release bird. Try again.');
    return false;
  }

  // Check if this is the celestial bodies item - delegate to the celestial placement callback
  if (storeItem.itemType === 'celestial' && this.onCelestialPlace) {
    const celestialPlaced = this.onCelestialPlace({
      storeItem,
    });
    if (celestialPlaced) {
      const bodyName = storeItem.celestialBody === 'sun' ? 'sun' : 'moon';
      const message = storeItem.celestialBody === 'sun' 
        ? 'The sun rises. Day comes to the terrarium.'
        : 'The moon rises. Night illuminates the sky.';
      this.setStoreStatus(message);
      this.hidePlacementPreview();
      this.consumeStoreItem(storeItem.id);
      this.clearStoreSelection();
      return true;
    }
    this.setStoreStatus(`Could not unlock ${storeItem.label}. Try again.`);
    return false;
  }

  const anchor = this.createPlacementAnchor(point, storeItem);
  this.playerPlacements.push(anchor);
  
  // Register tree/fractal in tree state so it appears in the dropdown for upgrading
  if (storeItem.itemType === 'tree' || storeItem.itemType === 'fractal') {
    const placementId = this.getPlacementId(anchor);
    const initialAllocation = Number.isFinite(storeItem.initialAllocation) 
      ? storeItem.initialAllocation 
      : (storeItem.size === 'small' ? 5 : 8);
    
    // Add to tree state with the placement ID as key
    this.treeState[placementId] = {
      allocated: initialAllocation,
      size: storeItem.size,
      fractalType: storeItem.fractalType,
      itemType: storeItem.itemType,
    };
    
    // Emit state change to persist the tree
    this.emitState();
  }
  
  this.refreshLayout();
  this.setStoreStatus(`${storeItem.label} planted. Placements reset when you leave this session.`);
  this.updatePlacementPreview(point, true, storeItem);
  this.consumeStoreItem(storeItem.id);
  this.clearStoreSelection();
  return true;
}

/**
 * Listen for resizes so tree canvases stay aligned with the scaled sprites.
 */
export function fttpsObserveContainer() {
  if (!this.container || typeof ResizeObserver === 'undefined') {
    return;
  }
  this.resizeObserver = new ResizeObserver(this.handleResize);
  this.resizeObserver.observe(this.container);
}

/**
 * Cache latest dimensions on resize.
 */
export function fttpsHandleResize() {
  this.refreshBounds();
  this.refreshLayout();
}

/**
 * Measure container dimensions and update the object-fit bounds for the masks.
 */
export function fttpsRefreshBounds() {
  if (!this.container) {
    return;
  }
  const rect = this.container.getBoundingClientRect();
  this.bounds.width = this.container.clientWidth || rect.width;
  this.bounds.height = this.container.clientHeight || rect.height;
  this.updateRenderBounds();
}

/**
 * Calculate the scaled sprite bounds so anchor coordinates map correctly to the viewport.
 */
export function fttpsUpdateRenderBounds() {
  if (!this.referenceSize.width || !this.referenceSize.height) {
    this.renderBounds = { left: 0, top: 0, width: this.bounds.width, height: this.bounds.height };
    return;
  }

  const containerRatio = this.bounds.width / Math.max(1, this.bounds.height || 1);
  const spriteRatio = this.referenceSize.width / this.referenceSize.height;
  let width = this.bounds.width;
  let height = this.bounds.height;
  let left = 0;
  let top = 0;

  if (containerRatio > spriteRatio) {
    height = this.bounds.height;
    width = height * spriteRatio;
    left = (this.bounds.width - width) / 2;
  } else {
    width = this.bounds.width;
    height = width / spriteRatio;
    top = (this.bounds.height - height) / 2;
  }

  this.renderBounds = { left, top, width, height };
  this.resolveCaveZones();
}

/**
 * Resolve normalized cave spawn zones to pixel coordinates within renderBounds.
 */
export function fttpsResolveCaveZones() {
  if (!this.caveSpawnZones.length || !this.renderBounds.width || !this.renderBounds.height) {
    this.resolvedCaveZones = [];
    return;
  }

  this.resolvedCaveZones = this.caveSpawnZones.map((zone) => {
    if (!zone || !Number.isFinite(zone.x) || !Number.isFinite(zone.y)) {
      return null;
    }
    const normalizedX = Math.max(0, Math.min(1, zone.x));
    const normalizedY = Math.max(0, Math.min(1, zone.y));
    const normalizedWidth = Math.max(0, Math.min(1 - normalizedX, zone.width ?? 0));
    const normalizedHeight = Math.max(0, Math.min(1 - normalizedY, zone.height ?? 0));
    if (normalizedWidth <= 0 || normalizedHeight <= 0) {
      return null;
    }
    return {
      xMin: normalizedX,
      xMax: normalizedX + normalizedWidth,
      yMin: normalizedY,
      yMax: normalizedY + normalizedHeight,
    };
  }).filter(Boolean);
}

/**
 * Check if a normalized point falls inside any cave spawn zone.
 * @param {{xRatio:number, yRatio:number}} point
 * @returns {boolean}
 */
export function fttpsIsPointInCaveZone(point) {
  if (!point || !this.resolvedCaveZones.length) {
    return false;
  }
  return this.resolvedCaveZones.some((zone) => (
    point.xRatio >= zone.xMin &&
    point.xRatio <= zone.xMax &&
    point.yRatio >= zone.yMin &&
    point.yRatio <= zone.yMax
  ));
}

/**
 * Check if an item type requires terrain surface validation.
 * @param {string} itemType
 * @returns {boolean}
 */
export function fttpsRequiresTerrainSurface(itemType) {
  return itemType === 'slime' || itemType === 'tree' || itemType === 'fractal';
}

/**
 * Check if a normalized point is on walkable terrain (not inside solid ground).
 * For slimes and trees, we want them in walkable space (not inside terrain) 
 * but near a terrain surface (not floating in deep water/air).
 * @param {{xRatio:number,yRatio:number}} point
 * @returns {boolean} True if the point is suitable for placement
 */
export function fttpsIsPointOnWalkableTerrain(point) {
  if (!point || !this.walkableMask) {
    // If no walkable mask, allow placement (fallback to legacy behavior)
    return true;
  }

  const { width, height, data } = this.walkableMask;
  if (!width || !height || !data) {
    return true;
  }

  // Convert normalized coordinates to pixel coordinates in the mask
  const x = Math.floor(point.xRatio * width);
  const y = Math.floor(point.yRatio * height);

  // Clamp to mask bounds
  const clampedX = Math.max(0, Math.min(width - 1, x));
  const clampedY = Math.max(0, Math.min(height - 1, y));

  const pixelIndex = clampedY * width + clampedX;

  // walkable[pixel] = 1 means empty space (air/water), 0 means solid terrain
  // The point itself should be in walkable space (not inside solid terrain)
  if (data[pixelIndex] === 0) {
    // Point is inside solid terrain - not allowed
    return false;
  }

  // Point is in walkable space. Now check if there's terrain nearby below
  // to ensure we're placing on a surface, not floating in deep water/air
  const searchRadius = Math.max(TERRAIN_SEARCH_MIN_RADIUS, Math.floor(height * TERRAIN_SEARCH_PERCENTAGE));
  for (let dy = 0; dy <= searchRadius; dy++) {
    const checkY = clampedY + dy;
    if (checkY >= height) break;
    
    const checkIndex = checkY * width + clampedX;
    if (data[checkIndex] === 0) {
      // Found terrain below - this is a valid surface placement
      return true;
    }
  }

  // No terrain found nearby below - point is floating in deep water/air
  return false;
}

/**
 * Build a walkable mask from the terrain collision sprite so Brownian growth avoids solid terrain.
 */
export function fttpsBuildWalkableMask() {
  if (typeof document === 'undefined') {
    return;
  }

  const sources = [this.terrainCollisionElement, this.floatingIslandCollisionElement].filter(
    (element) => element,
  );

  if (!sources.length) {
    return;
  }

  const sample = () => {
    const primary = sources.find((element) => element?.naturalWidth && element?.naturalHeight);
    if (!primary) {
      return;
    }
    const width = primary.naturalWidth;
    const height = primary.naturalHeight;
    if (!width || !height) {
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, width, height);
    sources.forEach((element) => {
      if (element) {
        ctx.drawImage(element, 0, 0, width, height);
      }
    });

    const { data } = ctx.getImageData(0, 0, width, height);
    const pixelCount = width * height;
    const walkable = new Uint8Array(pixelCount);
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      // Alpha indicates solid terrain; transparent pixels are safe for the cluster.
      const alpha = data[pixel * 4 + 3];
      walkable[pixel] = alpha === 0 ? 1 : 0;
    }
    this.walkableMask = { width, height, data: walkable };
  };

  const readySources = sources.filter(
    (element) => element && element.complete && element.naturalWidth > 0 && element.naturalHeight > 0,
  );
  if (readySources.length === sources.length) {
    sample();
  } else {
    sources.forEach((element) => {
      if (element) {
        element.addEventListener('load', sample, { once: true });
      }
    });
  }
}

/**
 * Toggle pointer affordances and visuals when leveling mode changes.
 */
export function fttpsSyncLevelingMode() {
  if (this.overlay) {
    this.overlay.classList.toggle('is-leveling', this.levelingMode);
  }
  if (this.treeLayer) {
    this.treeLayer.style.pointerEvents = this.levelingMode ? 'auto' : 'none';
  }
  if (this.levelButton) {
    this.levelButton.classList.toggle('is-active', this.levelingMode);
    // Mirror the toggle state for assistive tech so the leveling mode is explicit.
    this.levelButton.setAttribute('aria-pressed', this.levelingMode ? 'true' : 'false');
  }
  if (!this.levelingMode) {
    this.stopHold();
  }
}

/**
 * Toggle camera mode visuals so the on-render buttons disappear when panning is active.
 * @param {boolean} enabled
 * @param {{notifyHost?: boolean}} [options]
 */
export function fttpsSetCameraMode(enabled, options = {}) {
  const nextState = Boolean(enabled);
  const notifyHost = options.notifyHost !== false;
  if (this.cameraMode === nextState && !notifyHost) {
    return;
  }
  this.cameraMode = nextState;

  if (this.controlCluster) {
    this.controlCluster.classList.toggle('fluid-tree-control-cluster--hidden', this.cameraMode);
  }
  if (this.container) {
    this.container.classList.toggle('fluid-terrarium--camera-mode', this.cameraMode);
  }
  if (this.overlay) {
    this.overlay.classList.toggle('fluid-terrarium__trees--camera-mode', this.cameraMode);
  }

  if (this.cameraMode && this.isStoreOpen) {
    this.toggleStorePanel(false, { preserveSelection: true, suppressEmit: !notifyHost });
  }

  if (notifyHost) {
    this.emitState();
  }
}

/**
 * Persist the current terrarium leveling state to the host container.
 */
export function fttpsEmitState() {
  this.onStateChange({
    levelingMode: this.levelingMode,
    trees: { ...this.treeState },
    buttonMenuOpen: Boolean(this.isStoreOpen),
    cameraMode: this.cameraMode,
  });
}

/**
 * Kick off loading for the large and small tree mask sprites.
 */
export function fttpsLoadMasks() {
  const maskSources = [
    { url: this.largeMaskUrl, size: 'large', origin: 'ground' },
    { url: this.smallMaskUrl, size: 'small', origin: 'ground' },
    // A dedicated floating island mask spawns the elevated bonsai anchor.
    { url: this.islandSmallMaskUrl, size: 'small', origin: 'island' },
  ].filter((entry) => typeof entry.url === 'string');

  maskSources.forEach((entry) => {
    const image = new Image();
    image.decoding = 'async';
    image.loading = 'eager';
    image.src = entry.url;
    image.addEventListener('load', () => {
      this.handleMaskLoad(entry, image);
    }, { once: true });
  });
}

/**
 * Extract anchors from a loaded mask and rebuild the fractal layout.
 * @param {{size:'large'|'small', origin?:'ground'|'island'}} mask
 * @param {HTMLImageElement} image
 */
export function fttpsHandleMaskLoad(mask, image) {
  if (!image?.naturalWidth || !image?.naturalHeight) {
    return;
  }

  if (!this.referenceSize.width || !this.referenceSize.height) {
    this.referenceSize = { width: image.naturalWidth, height: image.naturalHeight };
    this.updateRenderBounds();
  }

  const anchors = this.extractAnchorsFromMask(image)
    .map((anchor) => ({
      ...anchor,
      size: mask.size,
      origin: mask.origin || 'ground',
      rawBaseY: anchor.baseY,
      fractalType: 'tree',
    }))
    .map((anchor) => ({ ...anchor, baseY: this.getAdjustedBase(anchor) }));
  this.anchors.push(...anchors);
  this.refreshLayout();
}

/**
 * Scan the mask pixels to find colored blocks and convert them into normalized anchors.
 * @param {HTMLImageElement} image
 * @returns {Array<{centerX:number, baseY:number, widthRatio:number, heightRatio:number}>}
 */
export function fttpsExtractAnchorsFromMask(image) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height || typeof document === 'undefined') {
    return [];
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return [];
  }
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const visited = new Uint8Array(width * height);
  const anchors = [];
  const alphaThreshold = 8;

  for (let index = 0; index < visited.length; index += 1) {
    if (visited[index]) {
      continue;
    }
    const alpha = data[index * 4 + 3];
    if (alpha <= alphaThreshold) {
      visited[index] = 1;
      continue;
    }

    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    const stack = [index];
    visited[index] = 1;

    while (stack.length) {
      const current = stack.pop();
      const cx = current % width;
      const cy = Math.floor(current / width);
      const currentAlpha = data[current * 4 + 3];
      if (currentAlpha <= alphaThreshold) {
        continue;
      }

      minX = Math.min(minX, cx);
      minY = Math.min(minY, cy);
      maxX = Math.max(maxX, cx);
      maxY = Math.max(maxY, cy);

      const neighbors = [
        current - 1,
        current + 1,
        current - width,
        current + width,
      ];

      neighbors.forEach((neighbor) => {
        if (neighbor < 0 || neighbor >= visited.length || visited[neighbor]) {
          return;
        }
        visited[neighbor] = 1;
        if (data[neighbor * 4 + 3] > alphaThreshold) {
          stack.push(neighbor);
        }
      });
    }

    anchors.push({
      centerX: (minX + maxX) / 2 / width,
      baseY: (maxY + 1) / height,
      widthRatio: (maxX - minX + 1) / width,
      heightRatio: (maxY - minY + 1) / height,
    });
  }

  return anchors;
}
