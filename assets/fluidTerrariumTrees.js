'use strict';

// Tree lifecycle, canvas, and fractal simulation methods live in the companion module.
import {
  getAdjustedBase as fttGetAdjustedBase,
  getAnchorKey as fttGetAnchorKey,
  normalizeTreeState as fttNormalizeTreeState,
  computeLevelInfo as fttComputeLevelInfo,
  updateSimulationTarget as fttUpdateSimulationTarget,
  createLevelBadge as fttCreateLevelBadge,
  updateTreeBadge as fttUpdateTreeBadge,
  handleUpgradeButton as fttHandleUpgradeButton,
  spawnRipple as fttSpawnRipple,
  allocateToTree as fttAllocateToTree,
  stopHold as fttStopHold,
  continueHold as fttContinueHold,
  attachTreeInput as fttAttachTreeInput,
  attachUpgradeButton as fttAttachUpgradeButton,
  refreshLayout as fttRefreshLayout,
  computeLayout as fttComputeLayout,
  createCanvas as fttCreateCanvas,
  buildSimulation as fttBuildSimulation,
  isSimulationComplete as fttIsSimulationComplete,
  freezeTree as fttFreezeTree,
  start as fttStart,
  stop as fttStop,
  handleFrame as fttHandleFrame,
  destroy as fttDestroy,
} from './fluidTerrariumTreeSimulation.js';

import {
  fttpsInitializeOverlay,
  fttpsHidePlacementPreview,
  fttpsUpdatePlacementPreview,
  fttpsShowPlacementConfirmation,
  fttpsHidePlacementConfirmation,
  fttpsQueuePlacementForConfirmation,
  fttpsHandleCancelPlacement,
  fttpsHandleConfirmPlacement,
  fttpsCommitPendingPlacement,
  fttpsClearPendingPlacement,
  fttpsHandleContainerPointerMove,
  fttpsHandleContainerPointerLeave,
  fttpsHandleContainerClick,
  fttpsGetNormalizedPointFromClient,
  fttpsGetPlacementValidity,
  fttpsIsPlacementLocationValid,
  fttpsGetCombinedAnchors,
  fttpsCreatePlacementAnchor,
  fttpsGetPlacementId,
  fttpsCreateEphemeralTreeState,
  fttpsPlaceActiveStoreItem,
  fttpsObserveContainer,
  fttpsHandleResize,
  fttpsRefreshBounds,
  fttpsUpdateRenderBounds,
  fttpsResolveCaveZones,
  fttpsIsPointInCaveZone,
  fttpsRequiresTerrainSurface,
  fttpsIsPointOnWalkableTerrain,
  fttpsBuildWalkableMask,
  fttpsSyncLevelingMode,
  fttpsSetCameraMode,
  fttpsEmitState,
  fttpsLoadMasks,
  fttpsHandleMaskLoad,
  fttpsExtractAnchorsFromMask,
} from './fluidTerrariumPlacementSystem.js';

import {
  fttssListenForMenuClose,
  fttssHandleMenuCloseEvent,
  fttssNormalizeStoreItems,
  fttssDescribeStoreItemType,
  fttssDescribeStoreItemHabitat,
  fttssCreateStoreTag,
  fttssBuildStorePanel,
  fttssPopulateStoreItems,
  fttssUpdateStoreBalanceDisplay,
  fttssRefreshStoreAffordances,
  fttssHandleStoreListPointerDown,
  fttssHandleStoreListPointerMove,
  fttssHandleStoreListPointerUp,
  fttssToggleStorePanel,
  fttssFadeStorePanelForDrag,
  fttssRestoreStorePanelOpacity,
  fttssSetStoreStatus,
  fttssUpdateStoreSelectionVisuals,
  fttssClearStoreSelection,
  fttssGetActiveStoreItem,
  fttssGetStoreItemById,
  fttssCanAffordStoreItem,
  fttssPurchaseStoreItem,
  fttssSelectStoreItem,
  fttssCreateDragGhost,
  fttssRemoveDragGhost,
  fttssUpdateDragGhostPosition,
  fttssUpdateDragGhostValidity,
  fttssHandleStoreItemDragStart,
  fttssHandleDragPointerMove,
  fttssHandleDragPointerUp,
  fttssEndStoreDrag,
  fttssConsumeStoreItem,
  STORE_STATUS_DEFAULT,
} from './fluidTerrariumStoreSystem.js';

// Re-export resolveTerrariumTreeLevel for backward compatibility
// (fluidTerrariumItemsDropdown.js imports this from here).
export { resolveTerrariumTreeLevel } from './fluidTerrariumTreeSimulation.js';

/**
 * Render animated fractal trees on the Bet terrarium using color-block masks to anchor
 * their positions. Each tree reuses the Shin Spire fractal animation so branches
 * continue to unfurl on top of the terrain silhouettes.
 */
export class FluidTerrariumTrees {
  constructor(options = {}) {
    /** @type {HTMLElement|null} */
    this.container = options.container || null;
    /** @type {string|null} */
    this.largeMaskUrl = typeof options.largeMaskUrl === 'string' ? options.largeMaskUrl : null;
    /** @type {string|null} */
    this.smallMaskUrl = typeof options.smallMaskUrl === 'string' ? options.smallMaskUrl : null;
    /** @type {string|null} */
    this.islandSmallMaskUrl = typeof options.islandSmallMaskUrl === 'string'
      ? options.islandSmallMaskUrl
      : null;

    // Cave spawn zones for caveOnly fractal placement validation.
    this.caveSpawnZones = Array.isArray(options.caveSpawnZones) ? options.caveSpawnZones : [];
    this.resolvedCaveZones = [];

    // Terrain collision element for building walkable masks.
    this.terrainCollisionElement = options.terrainCollisionElement || null;
    this.floatingIslandCollisionElement = options.floatingIslandCollisionElement || null;
    this.walkableMask = null;

    this.overlay = null;
    this.bounds = { width: 0, height: 0 };
    this.renderBounds = { left: 0, top: 0, width: 0, height: 0 };
    this.referenceSize = { width: 0, height: 0 };
    this.anchors = [];
    this.trees = [];

    this.treeLayer = null;
    this.badgeLayer = null;
    this.controlCluster = null;
    this.levelButton = null;
    this.storeButton = null;
    this.storePanel = null;
    this.storeList = null;
    this.storeStatus = null;
    // Badge that mirrors current Scintillae balance inside the store panel.
    this.storeBalanceLabel = null;
    this.storeItemButtons = new Map();
    this.availableStoreItems = this.normalizeStoreItems(options.storeItems);
    this.playerPlacements = [];
    this.activeStoreItemId = null;
    this.isStoreOpen = false;
    this.draggedStoreItemId = null;
    this.dragPointerId = null;
    this.dragGhost = null;
    this.placementPreview = null;
    this.confirmationPrompt = null;
    this.confirmationText = null;
    this.confirmButton = null;
    this.cancelButton = null;
    this.pendingPlacementPoint = null;
    this.pendingPlacement = null;
    this.ephemeralIdCounter = 0;
    this.storePanelTransparent = false;
    this.storeListDragState = { pointerId: null, startY: 0, startScroll: 0, isDragging: false };

    const storedState = options.state && typeof options.state === 'object' ? options.state : {};
    this.treeState = storedState.trees && typeof storedState.trees === 'object' ? { ...storedState.trees } : {};
    this.levelingMode =
      typeof storedState.levelingMode === 'boolean' ? storedState.levelingMode : true;
    this.cameraMode = Boolean(storedState.cameraMode);
    this.isStoreOpen = typeof storedState.buttonMenuOpen === 'boolean' ? storedState.buttonMenuOpen : this.isStoreOpen;

    this.getScintillaeBalance =
      typeof options.getScintillaeBalance === 'function' ? options.getScintillaeBalance : () => 0;
    this.spendScintillae = typeof options.spendScintillae === 'function' ? options.spendScintillae : () => 0;
    this.onStateChange = typeof options.onStateChange === 'function' ? options.onStateChange : () => {};
    this.onShroomPlace = typeof options.onShroomPlace === 'function' ? options.onShroomPlace : null;
    this.onSlimePlace = typeof options.onSlimePlace === 'function' ? options.onSlimePlace : null;
    this.onBirdPlace = typeof options.onBirdPlace === 'function' ? options.onBirdPlace : null;
    this.onCelestialPlace = typeof options.onCelestialPlace === 'function' ? options.onCelestialPlace : null;
    this.powderState = options.powderState || null;

    this.activeHold = null;
    this.holdTimer = null;

    this.resizeObserver = null;
    this.animationFrame = null;
    this.running = false;

    this.handleResize = this.handleResize.bind(this);
    this.handleFrame = this.handleFrame.bind(this);
    this.handleContainerPointerMove = this.handleContainerPointerMove.bind(this);
    this.handleContainerPointerLeave = this.handleContainerPointerLeave.bind(this);
    this.handleContainerClick = this.handleContainerClick.bind(this);
    this.handleMenuCloseEvent = this.handleMenuCloseEvent.bind(this);
    this.handleDragPointerMove = this.handleDragPointerMove.bind(this);
    this.handleDragPointerUp = this.handleDragPointerUp.bind(this);
    this.handleStoreListPointerDown = this.handleStoreListPointerDown.bind(this);
    this.handleStoreListPointerMove = this.handleStoreListPointerMove.bind(this);
    this.handleStoreListPointerUp = this.handleStoreListPointerUp.bind(this);
    this.handleConfirmPlacement = this.handleConfirmPlacement.bind(this);
    this.handleCancelPlacement = this.handleCancelPlacement.bind(this);

    this.initializeOverlay();
    this.observeContainer();
    this.loadMasks();
    this.listenForMenuClose();
    this.buildWalkableMask();
  }

  /**
   * Listen for menu close events from the viewport controller.
   */
  listenForMenuClose() { return fttssListenForMenuClose.call(this); }

  /**
   * Handle menu close event triggered by camera gestures.
   */
  handleMenuCloseEvent() { return fttssHandleMenuCloseEvent.call(this); }

  /**
   * Normalize optional storefront configuration so every entry carries placement rules.
   * @param {Array} rawItems
   */
  normalizeStoreItems(rawItems) { return fttssNormalizeStoreItems.call(this, rawItems); }

  /**
   * Translate item types into short, legible tags so the store reads like a curated shelf.
   * @param {object} storeItem
   * @returns {string}
   */
  describeStoreItemType(storeItem) { return fttssDescribeStoreItemType.call(this, storeItem); }

  /**
   * Summarize the habitat or placement restriction as a concise badge.
   * @param {object} storeItem
   * @returns {string}
   */
  describeStoreItemHabitat(storeItem) { return fttssDescribeStoreItemHabitat.call(this, storeItem); }

  /**
   * Factory for the small pill-shaped tags shown on each store entry.
   * @param {string} label
   * @param {string} variant
   * @returns {HTMLSpanElement}
   */
  createStoreTag(label, variant) { return fttssCreateStoreTag.call(this, label, variant); }

  /**
   * Build the interactive store menu that lets players pick decorative items.
   */
  buildStorePanel() { return fttssBuildStorePanel.call(this); }

  /**
   * Populate the store menu with the available decorative items.
   */
  populateStoreItems() { return fttssPopulateStoreItems.call(this); }

  /**
   * Mirror the latest Scintillae balance into the store badge for quick budgeting.
   */
  updateStoreBalanceDisplay() { return fttssUpdateStoreBalanceDisplay.call(this); }

  /**
   * Lock or unlock store entries based on Scintillae balance while surfacing shortfalls.
   */
  refreshStoreAffordances() { return fttssRefreshStoreAffordances.call(this); }

  /**
   * Allow the store list to scroll when dragged so touch and mouse users can browse comfortably.
   * @param {PointerEvent} event
   */
  handleStoreListPointerDown(event) { return fttssHandleStoreListPointerDown.call(this, event); }

  /**
   * Translate pointer movement into list scroll deltas.
   * @param {PointerEvent} event
   */
  handleStoreListPointerMove(event) { return fttssHandleStoreListPointerMove.call(this, event); }

  /**
   * Stop drag-to-scroll tracking for the store list.
   * @param {PointerEvent} event
   */
  handleStoreListPointerUp(event) { return fttssHandleStoreListPointerUp.call(this, event); }

  /**
   * Toggle the visibility of the store panel.
   * @param {boolean} [forceState]
   */
  toggleStorePanel(forceState, options = {}) { return fttssToggleStorePanel.call(this, forceState, options); }

  /**
   * Fade the store panel while dragging so the viewport stays unobstructed.
   */
  fadeStorePanelForDrag() { return fttssFadeStorePanelForDrag.call(this); }

  /**
   * Restore the store panel opacity after a placement is confirmed or cancelled.
   */
  restoreStorePanelOpacity() { return fttssRestoreStorePanelOpacity.call(this); }

  /**
   * Update the live region messaging for the storefront.
   * @param {string} message
   */
  setStoreStatus(message) { return fttssSetStoreStatus.call(this, message); }

  /**
   * Highlight the active store entry.
   * @param {string|null} itemId
   */
  updateStoreSelectionVisuals(itemId) { return fttssUpdateStoreSelectionVisuals.call(this, itemId); }

  /**
   * Clear the currently selected store item.
   */
  clearStoreSelection() { return fttssClearStoreSelection.call(this); }

  /**
   * Resolve the active store item metadata.
   */
  getActiveStoreItem() { return fttssGetActiveStoreItem.call(this); }

  /**
   * Resolve a store item by id even if it is no longer the active selection.
   * @param {string} itemId
   */
  getStoreItemById(itemId) { return fttssGetStoreItemById.call(this, itemId); }

  /**
   * Confirm the player holds enough Scintillae to purchase a store item.
   * @param {object|null} storeItem
   */
  canAffordStoreItem(storeItem) { return fttssCanAffordStoreItem.call(this, storeItem); }

  /**
   * Spend Scintillae for a store purchase and return success status.
   * @param {object|null} storeItem
   */
  purchaseStoreItem(storeItem) { return fttssPurchaseStoreItem.call(this, storeItem); }

  /**
   * Handle item selection and guide the player toward the placement gesture.
   * @param {string} itemId
   */
  selectStoreItem(itemId) { return fttssSelectStoreItem.call(this, itemId); }

  /**
   * Create the floating stub that mirrors the dragged store icon.
   * @param {object} storeItem
   */
  createDragGhost(storeItem) { return fttssCreateDragGhost.call(this, storeItem); }

  /**
   * Remove any existing drag ghost from the DOM.
   */
  removeDragGhost() { return fttssRemoveDragGhost.call(this); }

  /**
   * Position the drag ghost at the active pointer location.
   * @param {number} clientX
   * @param {number} clientY
   */
  updateDragGhostPosition(clientX, clientY) { return fttssUpdateDragGhostPosition.call(this, clientX, clientY); }

  /**
   * Toggle validity styling on the drag ghost while hovering different terrain.
   * @param {boolean} isValid
   */
  updateDragGhostValidity(isValid) { return fttssUpdateDragGhostValidity.call(this, isValid); }

  /**
   * Begin dragging a store icon so the item can be placed on the terrarium.
   * @param {object} storeItem
   * @param {PointerEvent} event
   */
  handleStoreItemDragStart(storeItem, event) { return fttssHandleStoreItemDragStart.call(this, storeItem, event); }

  /**
   * Track pointer movement while a store item is being dragged.
   * @param {PointerEvent} event
   */
  handleDragPointerMove(event) { return fttssHandleDragPointerMove.call(this, event); }

  /**
   * Resolve placement when the player releases the dragged store icon.
   * @param {PointerEvent} event
   */
  handleDragPointerUp(event) { return fttssHandleDragPointerUp.call(this, event); }

  /**
   * Clean up drag-specific state and visuals.
   */
  endStoreDrag(options = {}) { return fttssEndStoreDrag.call(this, options); }

  /**
   * Create the overlay element that will hold all fractal canvases.
   */
  initializeOverlay() { return fttpsInitializeOverlay.call(this); }

  hidePlacementPreview() { return fttpsHidePlacementPreview.call(this); }

  /**
   * Update the placement preview marker so the player knows where a store object will land.
   * Shows the item's icon instead of a simple circle.
   * @param {{xRatio:number,yRatio:number,isInside:boolean}} point
   * @param {boolean} isValid
   * @param {object|null} [storeItem] - The store item being placed, used to display its icon
   * @param {string} [reason] - Optional placement guidance shown in the aria label
   */
  updatePlacementPreview(point, isValid, storeItem = null, reason = '') { return fttpsUpdatePlacementPreview.call(this, point, isValid, storeItem, reason); }

  /**
   * Surface confirmation controls so the player can approve or cancel the drop.
   * @param {{xRatio:number,yRatio:number,isInside:boolean}} point
   * @param {object} storeItem
   */
  showPlacementConfirmation(point, storeItem) { return fttpsShowPlacementConfirmation.call(this, point, storeItem); }

  /**
   * Hide the confirmation controls when no placement is pending.
   */
  hidePlacementConfirmation() { return fttpsHidePlacementConfirmation.call(this); }

  /**
   * Queue a placement for confirmation instead of placing immediately.
   * @param {{xRatio:number,yRatio:number,isInside:boolean}} point
   * @param {object} storeItem
   * @param {object} [options]
   */
  queuePlacementForConfirmation(point, storeItem, options = {}) { return fttpsQueuePlacementForConfirmation.call(this, point, storeItem, options); }

  /**
   * Cancel the pending placement and restore UI affordances.
   */
  handleCancelPlacement() { return fttpsHandleCancelPlacement.call(this); }

  /**
   * Finalize a placement after explicit confirmation.
   */
  handleConfirmPlacement() { return fttpsHandleConfirmPlacement.call(this); }

  /**
   * Resolve the pending placement by spending serendipity and planting the item.
   */
  commitPendingPlacement() { return fttpsCommitPendingPlacement.call(this); }

  /**
   * Clear pending placement state, visuals, and restore the store panel.
   * @param {boolean} [restoreOpacity=false]
   */
  clearPendingPlacement(restoreOpacity = false) { return fttpsClearPendingPlacement.call(this, restoreOpacity); }

  handleContainerPointerMove(event) { return fttpsHandleContainerPointerMove.call(this, event); }

  handleContainerPointerLeave() { return fttpsHandleContainerPointerLeave.call(this); }

  handleContainerClick(event) { return fttpsHandleContainerClick.call(this, event); }

  /**
   * Convert a screen coordinate into a normalized point relative to the terrarium sprite.
   * Refreshes renderBounds first to ensure coordinates are accurate after resizes or pans.
   * @param {number} clientX
   * @param {number} clientY
   */
  getNormalizedPointFromClient(clientX, clientY) { return fttpsGetNormalizedPointFromClient.call(this, clientX, clientY); }

  /**
   * Evaluate placement validity and surface a human-readable reason when invalid.
   * @param {{xRatio:number,yRatio:number,isInside:boolean}} point
   * @param {object|null} [storeItem]
   * @returns {{ valid: boolean, reason: string }}
   */
  getPlacementValidity(point, storeItem = this.getActiveStoreItem()) { return fttpsGetPlacementValidity.call(this, point, storeItem); }

  /**
   * Validate whether a normalized point is acceptable for the selected store item.
   * @param {{xRatio:number,yRatio:number,isInside:boolean}} point
   * @param {object|null} [storeItem]
   */
  isPlacementLocationValid(point, storeItem = this.getActiveStoreItem()) { return fttpsIsPlacementLocationValid.call(this, point, storeItem); }

  /**
   * Merge the baked-in anchors with player-placed entries.
   */
  getCombinedAnchors() { return fttpsGetCombinedAnchors.call(this); }

  /**
   * Generate a normalized anchor from a placement gesture.
   * @param {{xRatio:number,yRatio:number}} point
   * @param {object} storeItem
   */
  createPlacementAnchor(point, storeItem) { return fttpsCreatePlacementAnchor.call(this, point, storeItem); }

  /**
   * Ensure every player placement receives a stable identifier for animation tracking.
   * @param {object} anchor
   */
  getPlacementId(anchor) { return fttpsGetPlacementId.call(this, anchor); }

  /**
   * Provide a static state object for ephemeral trees so they can grow without persistence.
   * @param {object} anchor
   */
  createEphemeralTreeState(anchor) { return fttpsCreateEphemeralTreeState.call(this, anchor); }

  /**
   * Convert a placement selection into a live tree without persisting to the player profile.
   * @param {{xRatio:number,yRatio:number}} point
   */
  placeActiveStoreItem(point, storeItem = this.getActiveStoreItem()) { return fttpsPlaceActiveStoreItem.call(this, point, storeItem); }

  /**
   * Remove a purchased item from the storefront roster.
   * @param {string} itemId
   */
  consumeStoreItem(itemId) { return fttssConsumeStoreItem.call(this, itemId); }

  /**
   * Listen for resizes so tree canvases stay aligned with the scaled sprites.
   */
  observeContainer() { return fttpsObserveContainer.call(this); }

  /**
   * Cache latest dimensions on resize.
   */
  handleResize() { return fttpsHandleResize.call(this); }

  /**
   * Measure container dimensions and update the object-fit bounds for the masks.
   */
  refreshBounds() { return fttpsRefreshBounds.call(this); }

  /**
   * Calculate the scaled sprite bounds so anchor coordinates map correctly to the viewport.
   */
  updateRenderBounds() { return fttpsUpdateRenderBounds.call(this); }

  /**
   * Resolve normalized cave spawn zones to pixel coordinates within renderBounds.
   */
  resolveCaveZones() { return fttpsResolveCaveZones.call(this); }

  /**
   * Check if a normalized point falls inside any cave spawn zone.
   * @param {{xRatio:number, yRatio:number}} point
   * @returns {boolean}
   */
  isPointInCaveZone(point) { return fttpsIsPointInCaveZone.call(this, point); }

  /**
   * Check if an item type requires terrain surface validation.
   * @param {string} itemType
   * @returns {boolean}
   */
  requiresTerrainSurface(itemType) { return fttpsRequiresTerrainSurface.call(this, itemType); }

  /**
   * Check if a normalized point is on walkable terrain (not inside solid ground).
   * For slimes and trees, we want them in walkable space (not inside terrain) 
   * but near a terrain surface (not floating in deep water/air).
   * @param {{xRatio:number,yRatio:number}} point
   * @returns {boolean} True if the point is suitable for placement
   */
  isPointOnWalkableTerrain(point) { return fttpsIsPointOnWalkableTerrain.call(this, point); }

  /**
   * Build a walkable mask from the terrain collision sprite so Brownian growth avoids solid terrain.
   */
  buildWalkableMask() { return fttpsBuildWalkableMask.call(this); }

  /**
   * Toggle pointer affordances and visuals when leveling mode changes.
   */
  syncLevelingMode() { return fttpsSyncLevelingMode.call(this); }

  /**
   * Toggle camera mode visuals so the on-render buttons disappear when panning is active.
   * @param {boolean} enabled
   * @param {{notifyHost?: boolean}} [options]
   */
  setCameraMode(enabled, options = {}) { return fttpsSetCameraMode.call(this, enabled, options); }

  /**
   * Persist the current terrarium leveling state to the host container.
   */
  emitState() { return fttpsEmitState.call(this); }

  /**
   * Kick off loading for the large and small tree mask sprites.
   */
  loadMasks() { return fttpsLoadMasks.call(this); }

  /**
   * Extract anchors from a loaded mask and rebuild the fractal layout.
   * @param {{size:'large'|'small', origin?:'ground'|'island'}} mask
   * @param {HTMLImageElement} image
   */
  handleMaskLoad(mask, image) { return fttpsHandleMaskLoad.call(this, mask, image); }

  /**
   * Scan the mask pixels to find colored blocks and convert them into normalized anchors.
   * @param {HTMLImageElement} image
   * @returns {Array<{centerX:number, baseY:number, widthRatio:number, heightRatio:number}>}
   */
  extractAnchorsFromMask(image) { return fttpsExtractAnchorsFromMask.call(this, image); }

  // All tree lifecycle, layout, canvas, and simulation methods live in the companion module.
  getAdjustedBase(anchor) { return fttGetAdjustedBase.call(this, anchor); }
  getAnchorKey(anchor) { return fttGetAnchorKey.call(this, anchor); }
  normalizeTreeState(treeId) { return fttNormalizeTreeState.call(this, treeId); }
  computeLevelInfo(allocated) { return fttComputeLevelInfo.call(this, allocated); }
  updateSimulationTarget(tree) { return fttUpdateSimulationTarget.call(this, tree); }
  createLevelBadge(layout) { return fttCreateLevelBadge.call(this, layout); }
  updateTreeBadge(tree) { return fttUpdateTreeBadge.call(this, tree); }
  handleUpgradeButton(tree, event) { return fttHandleUpgradeButton.call(this, tree, event); }
  spawnRipple(globalPoint, jitter = false) { return fttSpawnRipple.call(this, globalPoint, jitter); }
  allocateToTree(tree, amount, globalPoint, jitter = false) { return fttAllocateToTree.call(this, tree, amount, globalPoint, jitter); }
  stopHold() { return fttStopHold.call(this); }
  continueHold() { return fttContinueHold.call(this); }
  attachTreeInput(tree) { return fttAttachTreeInput.call(this, tree); }
  attachUpgradeButton(tree) { return fttAttachUpgradeButton.call(this, tree); }
  refreshLayout() { return fttRefreshLayout.call(this); }
  computeLayout(anchor) { return fttComputeLayout.call(this, anchor); }
  createCanvas(layout) { return fttCreateCanvas.call(this, layout); }
  buildSimulation(anchor, canvas, height) { return fttBuildSimulation.call(this, anchor, canvas, height); }
  isSimulationComplete(simulation) { return fttIsSimulationComplete.call(this, simulation); }
  freezeTree(tree) { return fttFreezeTree.call(this, tree); }
  start() { return fttStart.call(this); }
  stop() { return fttStop.call(this); }
  handleFrame() { return fttHandleFrame.call(this); }
  destroy() { return fttDestroy.call(this); }
}
