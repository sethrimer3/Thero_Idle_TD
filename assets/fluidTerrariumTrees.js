'use strict';

import { FractalTreeSimulation } from '../scripts/features/towers/fractalTreeSimulation.js';

/**
 * Convert stored serendipity allocations into a terrarium tree level, remaining progress,
 * and the cost of the next level. Shared by the fractal overlay and happiness hooks so
 * both systems agree on level math.
 * @param {number} allocated
 * @returns {{ level: number, progress: number, nextCost: number }}
 */
export function resolveTerrariumTreeLevel(allocated = 0) {
  let remaining = Math.max(0, Math.round(allocated));
  let level = 0;
  let nextCost = 1;
  while (remaining >= nextCost) {
    remaining -= nextCost;
    level += 1;
    nextCost *= 2;
  }
  return { level, progress: remaining, nextCost };
}

// Layered palette that transitions from dark bark into vibrant canopies.
const BET_TREE_DEPTH_COLORS = [
  '#26160c',
  '#2f1c0e',
  '#3b2612',
  '#4a2f16',
  '#1f4b29',
  '#245c2f',
  '#2b6d36',
  '#33803f',
];

// Storefront configuration so the Bet terrarium can surface player-placed decorations.
const DEFAULT_TERRARIUM_STORE_ITEMS = [
  {
    id: 'bet-store-large-tree',
    label: 'Large Fractal Tree',
    description: 'Full canopy anchor grown from the Shin lattice.',
    size: 'large',
    minY: 0.32,
    maxY: 0.94,
    minSpacing: 0.09,
    initialAllocation: 8,
  },
  {
    id: 'bet-store-small-tree',
    label: 'Island Bonsai',
    description: 'Compact sapling suited for ridge lines.',
    size: 'small',
    minY: 0.28,
    maxY: 0.9,
    minSpacing: 0.07,
    initialAllocation: 5,
  },
];

const PLACEMENT_DIMENSIONS = {
  large: { widthRatio: 0.08, heightRatio: 0.26 },
  small: { widthRatio: 0.05, heightRatio: 0.18 },
};

const STORE_STATUS_DEFAULT = 'Select an object and tap the terrain to place it. Placements reset when you reload.';

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

    this.overlay = null;
    this.bounds = { width: 0, height: 0 };
    this.renderBounds = { left: 0, top: 0, width: 0, height: 0 };
    this.referenceSize = { width: 0, height: 0 };
    this.anchors = [];
    this.trees = [];

    this.treeLayer = null;
    this.badgeLayer = null;
    this.levelButton = null;
    this.storeButton = null;
    this.storePanel = null;
    this.storeList = null;
    this.storeStatus = null;
    this.storeItemButtons = new Map();
    this.availableStoreItems = this.normalizeStoreItems(options.storeItems);
    this.playerPlacements = [];
    this.activeStoreItemId = null;
    this.isStoreOpen = false;
    this.placementPreview = null;
    this.pendingPlacementPoint = null;
    this.ephemeralIdCounter = 0;

    const storedState = options.state && typeof options.state === 'object' ? options.state : {};
    this.treeState = storedState.trees && typeof storedState.trees === 'object' ? { ...storedState.trees } : {};
    this.levelingMode = Boolean(storedState.levelingMode);

    this.getSerendipityBalance =
      typeof options.getSerendipityBalance === 'function' ? options.getSerendipityBalance : () => 0;
    this.spendSerendipity = typeof options.spendSerendipity === 'function' ? options.spendSerendipity : () => 0;
    this.onStateChange = typeof options.onStateChange === 'function' ? options.onStateChange : () => {};

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

    this.initializeOverlay();
    this.observeContainer();
    this.loadMasks();
  }

  /**
   * Normalize optional storefront configuration so every entry carries placement rules.
   * @param {Array} rawItems
   */
  normalizeStoreItems(rawItems) {
    const source = Array.isArray(rawItems) && rawItems.length ? rawItems : DEFAULT_TERRARIUM_STORE_ITEMS;
    return source.map((item, index) => ({
      id: typeof item?.id === 'string' ? item.id : `terrarium-store-${index}`,
      label: typeof item?.label === 'string' ? item.label : 'Terrarium Object',
      description: typeof item?.description === 'string' ? item.description : '',
      size: item?.size === 'small' ? 'small' : 'large',
      origin: item?.origin === 'island' ? 'island' : 'ground',
      minY: Number.isFinite(item?.minY) ? item.minY : 0.3,
      maxY: Number.isFinite(item?.maxY) ? item.maxY : 0.95,
      minSpacing: Number.isFinite(item?.minSpacing) ? Math.max(0.04, item.minSpacing) : 0.08,
      initialAllocation: Number.isFinite(item?.initialAllocation) ? Math.max(0, item.initialAllocation) : 6,
    }));
  }

  /**
   * Build the interactive store menu that lets players pick decorative items.
   */
  buildStorePanel() {
    if (!this.container || typeof document === 'undefined') {
      return null;
    }

    const panel = document.createElement('div');
    panel.className = 'fluid-tree-store-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-hidden', 'true');
    panel.setAttribute('aria-label', 'Terrarium store');

    const title = document.createElement('p');
    title.className = 'fluid-tree-store-title';
    title.textContent = 'Terrarium Store';
    panel.appendChild(title);

    const note = document.createElement('p');
    note.className = 'fluid-tree-store-note';
    note.textContent = 'Pick a fractal object and tap the basin to place it.';
    panel.appendChild(note);

    const list = document.createElement('div');
    list.className = 'fluid-tree-store-list';
    panel.appendChild(list);
    this.storeList = list;
    this.populateStoreItems();

    const status = document.createElement('p');
    status.className = 'fluid-tree-store-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = STORE_STATUS_DEFAULT;
    panel.appendChild(status);
    this.storeStatus = status;

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'fluid-tree-store-close';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggleStorePanel(false);
    });
    panel.appendChild(closeButton);

    return panel;
  }

  /**
   * Populate the store menu with the available decorative items.
   */
  populateStoreItems() {
    if (!this.storeList) {
      return;
    }
    this.storeList.innerHTML = '';
    this.storeItemButtons.clear();

    this.availableStoreItems.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'fluid-tree-store-item';
      button.dataset.itemId = item.id;
      const label = document.createElement('span');
      label.className = 'fluid-tree-store-item__label';
      label.textContent = item.label;
      button.appendChild(label);
      if (item.description) {
        const description = document.createElement('span');
        description.className = 'fluid-tree-store-item__description';
        description.textContent = item.description;
        button.appendChild(description);
      }
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.selectStoreItem(item.id);
      });
      this.storeList.appendChild(button);
      this.storeItemButtons.set(item.id, button);
    });
  }

  /**
   * Toggle the visibility of the store panel.
   * @param {boolean} [forceState]
   */
  toggleStorePanel(forceState) {
    const nextState = typeof forceState === 'boolean' ? forceState : !this.isStoreOpen;
    this.isStoreOpen = nextState;
    if (this.storePanel) {
      this.storePanel.hidden = !nextState;
      this.storePanel.setAttribute('aria-hidden', nextState ? 'false' : 'true');
    }
    if (this.storeButton) {
      this.storeButton.classList.toggle('is-active', nextState);
      this.storeButton.setAttribute('aria-expanded', nextState ? 'true' : 'false');
    }
    if (!nextState) {
      this.clearStoreSelection();
      this.hidePlacementPreview();
      this.setStoreStatus(STORE_STATUS_DEFAULT);
    }
  }

  /**
   * Update the live region messaging for the storefront.
   * @param {string} message
   */
  setStoreStatus(message) {
    if (this.storeStatus) {
      this.storeStatus.textContent = message || STORE_STATUS_DEFAULT;
    }
  }

  /**
   * Highlight the active store entry.
   * @param {string|null} itemId
   */
  updateStoreSelectionVisuals(itemId) {
    this.storeItemButtons.forEach((button, id) => {
      button.classList.toggle('is-selected', id === itemId);
    });
  }

  /**
   * Clear the currently selected store item.
   */
  clearStoreSelection() {
    this.activeStoreItemId = null;
    this.updateStoreSelectionVisuals(null);
  }

  /**
   * Resolve the active store item metadata.
   */
  getActiveStoreItem() {
    if (!this.activeStoreItemId) {
      return null;
    }
    return this.availableStoreItems.find((item) => item.id === this.activeStoreItemId) || null;
  }

  /**
   * Handle item selection and guide the player toward the placement gesture.
   * @param {string} itemId
   */
  selectStoreItem(itemId) {
    const item = this.availableStoreItems.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }
    this.activeStoreItemId = item.id;
    this.updateStoreSelectionVisuals(item.id);
    if (!this.isStoreOpen) {
      this.toggleStorePanel(true);
    }
    this.setStoreStatus('Tap the terrain to place this object. These placements are temporary.');
  }

  /**
   * Create the overlay element that will hold all fractal canvases.
   */
  initializeOverlay() {
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
    // Disable the toggle until the leveling button UX is reworked.
    levelButton.disabled = true;
    levelButton.setAttribute('aria-disabled', 'true');

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

    // Keep leveling mode permanently active so progress bars remain visible until the
    // toggle receives a proper UX treatment.
    this.levelingMode = true;

    this.container.appendChild(levelButton);
    this.container.appendChild(storeButton);
    if (storePanel) {
      this.container.appendChild(storePanel);
    }
    this.container.appendChild(overlay);

    if (this.container) {
      this.container.addEventListener('pointermove', this.handleContainerPointerMove);
      this.container.addEventListener('pointerleave', this.handleContainerPointerLeave);
      this.container.addEventListener('click', this.handleContainerClick);
    }

    if (this.overlay) {
      const preview = document.createElement('div');
      preview.className = 'fluid-tree-placement-preview';
      preview.setAttribute('aria-hidden', 'true');
      preview.hidden = true;
      this.overlay.appendChild(preview);
      this.placementPreview = preview;
    }

    this.syncLevelingMode();
    this.refreshBounds();
  }

  hidePlacementPreview() {
    if (this.placementPreview) {
      this.placementPreview.hidden = true;
      this.placementPreview.removeAttribute('data-visible');
      this.placementPreview.removeAttribute('data-valid');
    }
    this.pendingPlacementPoint = null;
  }

  /**
   * Update the placement preview marker so the player knows where a store object will land.
   * @param {{xRatio:number,yRatio:number,isInside:boolean}} point
   * @param {boolean} isValid
   */
  updatePlacementPreview(point, isValid) {
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
  }

  handleContainerPointerMove(event) {
    if (!this.isStoreOpen || !this.activeStoreItemId) {
      return;
    }
    if (this.storePanel && this.storePanel.contains(event.target)) {
      return;
    }
    const point = this.getNormalizedPointFromClient(event.clientX, event.clientY);
    if (!point) {
      this.hidePlacementPreview();
      return;
    }
    this.pendingPlacementPoint = point;
    const isValid = this.isPlacementLocationValid(point);
    this.updatePlacementPreview(point, isValid);
  }

  handleContainerPointerLeave() {
    this.hidePlacementPreview();
  }

  handleContainerClick(event) {
    if (!this.isStoreOpen || !this.activeStoreItemId) {
      return;
    }
    if (this.storePanel && this.storePanel.contains(event.target)) {
      return;
    }
    const point = this.getNormalizedPointFromClient(event.clientX, event.clientY);
    if (!point || !this.isPlacementLocationValid(point)) {
      this.setStoreStatus('Pick an open patch of terrain. Placements are not saved to your profile.');
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.placeActiveStoreItem(point);
  }

  /**
   * Convert a screen coordinate into a normalized point relative to the terrarium sprite.
   * @param {number} clientX
   * @param {number} clientY
   */
  getNormalizedPointFromClient(clientX, clientY) {
    if (!this.container || !this.renderBounds.width || !this.renderBounds.height) {
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
   * Validate whether a normalized point is acceptable for the selected store item.
   * @param {{xRatio:number,yRatio:number,isInside:boolean}} point
   * @param {object|null} [storeItem]
   */
  isPlacementLocationValid(point, storeItem = this.getActiveStoreItem()) {
    if (!point?.isInside || !storeItem) {
      return false;
    }
    if (point.yRatio < storeItem.minY || point.yRatio > storeItem.maxY) {
      return false;
    }
    const spacing = Math.max(0.02, storeItem.minSpacing || 0.08);
    const anchors = this.getCombinedAnchors();
    return !anchors.some((anchor) => {
      const anchorX = Number.isFinite(anchor?.centerX) ? anchor.centerX : 0;
      const anchorY = Number.isFinite(anchor?.baseY) ? anchor.baseY : 0;
      const distance = Math.hypot(anchorX - point.xRatio, anchorY - point.yRatio);
      return distance < spacing;
    });
  }

  /**
   * Merge the baked-in anchors with player-placed entries.
   */
  getCombinedAnchors() {
    return [...this.anchors, ...this.playerPlacements];
  }

  /**
   * Generate a normalized anchor from a placement gesture.
   * @param {{xRatio:number,yRatio:number}} point
   * @param {object} storeItem
   */
  createPlacementAnchor(point, storeItem) {
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
    };
    this.getPlacementId(anchor);
    return anchor;
  }

  /**
   * Ensure every player placement receives a stable identifier for animation tracking.
   * @param {object} anchor
   */
  getPlacementId(anchor) {
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
  createEphemeralTreeState(anchor) {
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
  placeActiveStoreItem(point) {
    const storeItem = this.getActiveStoreItem();
    if (!storeItem) {
      return;
    }
    const anchor = this.createPlacementAnchor(point, storeItem);
    this.playerPlacements.push(anchor);
    this.refreshLayout();
    this.setStoreStatus(`${storeItem.label} planted. Placements reset when you leave this session.`);
    this.updatePlacementPreview(point, true);
  }

  /**
   * Listen for resizes so tree canvases stay aligned with the scaled sprites.
   */
  observeContainer() {
    if (!this.container || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(this.container);
  }

  /**
   * Cache latest dimensions on resize.
   */
  handleResize() {
    this.refreshBounds();
    this.refreshLayout();
  }

  /**
   * Measure container dimensions and update the object-fit bounds for the masks.
   */
  refreshBounds() {
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
  updateRenderBounds() {
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
  }

  /**
   * Toggle pointer affordances and visuals when leveling mode changes.
   */
  syncLevelingMode() {
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
   * Persist the current terrarium leveling state to the host container.
   */
  emitState() {
    this.onStateChange({
      levelingMode: this.levelingMode,
      trees: { ...this.treeState },
    });
  }

  /**
   * Kick off loading for the large and small tree mask sprites.
   */
  loadMasks() {
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
  handleMaskLoad(mask, image) {
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
  extractAnchorsFromMask(image) {
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

  /**
   * Lift or nudge anchors so tree roots meet the terrain surfaces marked by the masks.
   * @param {{baseY:number, heightRatio:number, size:'large'|'small', origin?:'ground'|'island'}} anchor
   * @returns {number}
   */
  getAdjustedBase(anchor) {
    const base = anchor?.baseY || 0;
    const heightRatio = anchor?.heightRatio || 0;

    if (anchor?.origin === 'island') {
      // Raise island anchors slightly so the bonsai crown grows from the plateau instead of the overhang.
      return Math.min(1, base + heightRatio * 0.15);
    }

    if (anchor?.size === 'small') {
      // Lift saplings so their roots sit on the top edge of the placement mask instead of being buried.
      return Math.max(0, base - heightRatio);
    }

    return base;
  }

  /**
   * Create a stable identifier for a tree anchor so progress persists across reloads.
   */
  getAnchorKey(anchor) {
    const center = Math.round((anchor?.centerX || 0) * 1000);
    const base = Math.round(((anchor?.rawBaseY ?? anchor?.baseY) || 0) * 1000);
    const width = Math.round((anchor?.widthRatio || 0) * 1000);
    const height = Math.round((anchor?.heightRatio || 0) * 1000);
    return `${anchor?.size || 'tree'}-${center}-${base}-${width}-${height}`;
  }

  /**
   * Ensure each tree entry tracks a non-negative serendipity allocation.
   */
  normalizeTreeState(treeId) {
    if (!this.treeState[treeId]) {
      this.treeState[treeId] = { allocated: 0 };
    }
    const allocated = Math.max(0, Math.round(this.treeState[treeId].allocated || 0));
    this.treeState[treeId].allocated = allocated;
    return this.treeState[treeId];
  }

  /**
   * Resolve the level and remainder toward the next level from total serendipity.
   */
  computeLevelInfo(allocated) {
    return resolveTerrariumTreeLevel(allocated);
  }

  /**
   * Sync the fractal growth budget with the allocated serendipity lines.
   */
  updateSimulationTarget(tree) {
    if (!tree?.simulation) {
      return;
    }
    const allocated = Math.max(0, tree.state.allocated || 0);
    const growthBudget = Math.min(tree.simulation.maxSegments - 1, allocated);
    tree.simulation.setTargetSegments(1 + growthBudget);
  }

  /**
   * Build the HUD elements that hover over a tree.
   */
  createLevelBadge(layout) {
    const badge = document.createElement('div');
    badge.className = 'fluid-tree-level';
    badge.style.left = `${layout.left}px`;
    badge.style.top = `${layout.top - 16}px`;
    badge.style.width = `${layout.width}px`;

    const label = document.createElement('div');
    label.className = 'fluid-tree-level__label';
    badge.appendChild(label);

    const bar = document.createElement('div');
    bar.className = 'fluid-tree-level__bar';
    const fill = document.createElement('div');
    fill.className = 'fluid-tree-level__fill';
    bar.appendChild(fill);
    badge.appendChild(bar);

    const progressText = document.createElement('div');
    progressText.className = 'fluid-tree-level__progress';
    badge.appendChild(progressText);

    return { badge, label, fill, progressText };
  }

  /**
   * Refresh the level label and progress bar for a given tree.
   */
  updateTreeBadge(tree) {
    if (!tree?.badge) {
      return;
    }
    const { label, fill, progressText } = tree.badge;
    const levelInfo = this.computeLevelInfo(tree.state.allocated || 0);
    const progressRatio = levelInfo.nextCost ? Math.min(1, (levelInfo.progress || 0) / levelInfo.nextCost) : 0;
    const remaining = Math.max(0, levelInfo.nextCost - levelInfo.progress);

    label.textContent = `Lv ${levelInfo.level}`;
    fill.style.width = `${Math.round(progressRatio * 100)}%`;
    progressText.textContent = `${remaining} Serendipity to next level`;
  }

  /**
   * Animate a gold ripple where serendipity was applied.
   */
  spawnRipple(globalPoint, jitter = false) {
    if (!this.overlay || !globalPoint) {
      return;
    }
    const ripple = document.createElement('div');
    ripple.className = 'fluid-tree-ripple';

    const rect = this.overlay.getBoundingClientRect();
    const originX = jitter ? globalPoint.x + (Math.random() - 0.5) * 24 : globalPoint.x;
    const originY = jitter ? globalPoint.y + (Math.random() - 0.5) * 24 : globalPoint.y;
    ripple.style.left = `${originX - rect.left}px`;
    ripple.style.top = `${originY - rect.top}px`;

    this.overlay.appendChild(ripple);
    requestAnimationFrame(() => {
      ripple.classList.add('fluid-tree-ripple--expand');
    });

    ripple.addEventListener('animationend', () => ripple.remove());
  }

  /**
   * Deduct serendipity and push growth into a specific tree.
   */
  allocateToTree(tree, amount, globalPoint, jitter = false) {
    const normalized = Math.max(1, Math.round(amount));
    const spent = this.spendSerendipity(normalized);
    if (!spent) {
      return 0;
    }
    tree.state.allocated = Math.max(0, (tree.state.allocated || 0) + spent);
    this.updateSimulationTarget(tree);
    this.updateTreeBadge(tree);
    this.spawnRipple(globalPoint, jitter);
    this.emitState();
    return spent;
  }

  stopHold() {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.activeHold = null;
  }

  continueHold() {
    if (!this.activeHold || !this.levelingMode) {
      return;
    }
    const { tree, point } = this.activeHold;
    const spent = this.allocateToTree(tree, 1, point, true);
    if (!spent) {
      this.stopHold();
      return;
    }
    this.activeHold.rate = Math.min(10, this.activeHold.rate + 1);
    const intervalMs = 1000 / this.activeHold.rate;
    this.holdTimer = setTimeout(() => this.continueHold(), intervalMs);
  }

  /**
   * Wire pointer handlers so trees can accept serendipity taps.
   */
  attachTreeInput(tree) {
    if (!tree?.canvas) {
      return;
    }
    const canvas = tree.canvas;

    const handlePointerUp = (event) => {
      if (this.activeHold && this.activeHold.pointerId === event.pointerId) {
        this.stopHold();
      }
    };

    canvas.addEventListener('pointerdown', (event) => {
      if (!this.levelingMode) {
        return;
      }
      if (!this.getSerendipityBalance()) {
        return;
      }
      event.preventDefault();
      this.stopHold();
      const point = { x: event.clientX, y: event.clientY };
      this.allocateToTree(tree, 1, point);
      this.activeHold = { tree, point, rate: 2, pointerId: event.pointerId };
      this.holdTimer = setTimeout(() => this.continueHold(), 240);
      canvas.setPointerCapture(event.pointerId);
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => {
      canvas.addEventListener(eventName, handlePointerUp);
    });
  }

  /**
   * Clear existing canvases and rebuild simulations for all anchors.
   */
  refreshLayout() {
    const anchors = this.getCombinedAnchors();
    if (!this.overlay || !this.treeLayer || !this.badgeLayer || !anchors.length || !this.renderBounds.width || !this.renderBounds.height) {
      return;
    }

    this.stop();
    this.treeLayer.innerHTML = '';
    this.badgeLayer.innerHTML = '';
    this.trees = [];

    anchors.forEach((anchor) => {
      const layout = this.computeLayout(anchor);
      if (!layout) {
        return;
      }
      const canvas = this.createCanvas(layout);
      const simulation = this.buildSimulation(anchor.size, canvas, layout.visibleHeight || layout.height);
      if (!simulation) {
        return;
      }

      const isEphemeral = Boolean(anchor?.ephemeral);
      const treeId = isEphemeral ? this.getPlacementId(anchor) : this.getAnchorKey(anchor);
      const state = isEphemeral ? this.createEphemeralTreeState(anchor) : this.normalizeTreeState(treeId);
      const badge = isEphemeral ? null : this.createLevelBadge(layout);

      this.treeLayer.appendChild(canvas);
      if (badge) {
        this.badgeLayer.appendChild(badge.badge);
      }

      const tree = { id: treeId, canvas, simulation, frozen: false, state, badge, isEphemeral };
      this.updateSimulationTarget(tree);
      if (badge) {
        this.updateTreeBadge(tree);
      }
      if (!isEphemeral) {
        this.attachTreeInput(tree);
      }

      // Track each tree along with its simulation so we can freeze completed renders later.
      this.trees.push(tree);
    });

    this.syncLevelingMode();
    if (this.trees.length) {
      this.start();
    }
  }

  /**
   * Calculate canvas size and absolute positioning for a given anchor.
   * @param {{centerX:number, baseY:number, widthRatio:number, heightRatio:number, size:'large'|'small'}} anchor
   */
  computeLayout(anchor) {
    const widthRatio = anchor.size === 'large' ? 0.18 : 0.14;
    const desiredWidth = Math.max(
      this.renderBounds.width * widthRatio,
      anchor.widthRatio * this.renderBounds.width * 10,
    );
    const maxWidth = this.renderBounds.width * 0.4;
    const width = Math.min(Math.max(14, desiredWidth), maxWidth);

    const desiredHeight = width * (anchor.size === 'large' ? 1.9 : 1.6);
    const groundY = this.renderBounds.top + anchor.baseY * this.renderBounds.height;
    const maxHeight = Math.max(10, groundY - this.renderBounds.top);
    // Reserve a small buffer so crowns don't brush against the basin rim.
    const canopyCushion = this.renderBounds.height * 0.04;
    const height = Math.min(desiredHeight + canopyCushion, maxHeight);

    const horizontalPadding = Math.max(8, width * 0.12);
    const verticalPadding = Math.max(8, height * 0.12);
    const paddedWidth = width + horizontalPadding * 2;
    const paddedHeight = height + verticalPadding;

    const left = this.renderBounds.left + anchor.centerX * this.renderBounds.width - paddedWidth / 2;
    const top = groundY - paddedHeight;

    return { left, top, width: paddedWidth, height: paddedHeight, visibleHeight: height };
  }

  /**
   * Create and position a canvas that will host a fractal tree.
   * @param {{left:number, top:number, width:number, height:number}} layout
   */
  createCanvas(layout) {
    const canvas = document.createElement('canvas');
    canvas.className = 'fluid-terrarium__tree';
    canvas.width = Math.max(1, Math.round(layout.width));
    canvas.height = Math.max(1, Math.round(layout.height));
    canvas.style.left = `${layout.left}px`;
    canvas.style.top = `${layout.top}px`;
    canvas.style.width = `${layout.width}px`;
    canvas.style.height = `${layout.height}px`;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');
    return canvas;
  }

  /**
   * Configure the Shin fractal tree simulation for the given canvas.
   * @param {'large'|'small'} size
   * @param {HTMLCanvasElement} canvas
   * @param {number} height
   */
  buildSimulation(size, canvas, height) {
    // Limit Bet terrarium trees to eight visible layers to match the stepped palette.
    const depth = 7;
    // Keep the trees slender while preserving their full height on both mask sizes.
    const baseWidth = size === 'large' ? 4 : 3;
    const rootLength = Math.max(16, height * (size === 'large' ? 0.3 : 0.26));

    const simulation = new FractalTreeSimulation({
      canvas,
      bgColor: 'rgba(0, 0, 0, 0)',
      trunkColor: BET_TREE_DEPTH_COLORS[1],
      twigColor: BET_TREE_DEPTH_COLORS[BET_TREE_DEPTH_COLORS.length - 1],
      leafColor: BET_TREE_DEPTH_COLORS[BET_TREE_DEPTH_COLORS.length - 1],
      leafAlpha: 0.3,
      branchFactor: 2,
      baseSpreadDeg: 25,
      lengthDecay: 0.7,
      maxDepth: depth,
      angleJitterDeg: 3,
      gravityBend: 0.08,
      growthRate: size === 'large' ? 3 : 2,
      renderStyle: 'bezier',
      baseWidth,
      minWidth: 0.38,
      rootLength,
      rootX: 0.5,
      rootY: 0.99,
      seed: Math.floor(Math.random() * 100000),
      enableHalos: false,
    });

    simulation.updateConfig({
      maxDepth: depth,
      depthColors: BET_TREE_DEPTH_COLORS,
    });

    return simulation;
  }

  /**
   * Convert a fully grown fractal tree canvas into a static image to reduce render cost.
   * @param {{canvas: HTMLCanvasElement|HTMLImageElement, simulation: FractalTreeSimulation|null, frozen: boolean}} tree
   */
  freezeTree(tree) {
    if (!tree || tree.frozen || !(tree.canvas instanceof HTMLCanvasElement)) {
      return;
    }

    const { canvas, simulation } = tree;

    // Ensure the final frame is rendered before capturing the bitmap.
    if (simulation) {
      simulation.render();
    }

    const image = new Image();
    image.className = canvas.className;
    image.style.cssText = canvas.style.cssText;
    image.width = canvas.width;
    image.height = canvas.height;
    image.setAttribute('aria-hidden', 'true');
    image.setAttribute('role', 'presentation');
    image.src = canvas.toDataURL('image/png');

    canvas.replaceWith(image);
    tree.canvas = image;
    tree.simulation = null;
    tree.frozen = true;
  }

  /**
   * Begin the animation loop so branches keep sprouting.
   */
  start() {
    if (this.running || !this.trees.length) {
      return;
    }
    this.running = true;
    this.animationFrame = requestAnimationFrame(this.handleFrame);
  }

  /**
   * Stop the animation loop and cancel pending frames.
   */
  stop() {
    this.running = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Advance growth and render all active trees.
   */
  handleFrame() {
    if (!this.running) {
      return;
    }

    // Track whether any simulations still need to advance so we can stop once all are frozen.
    let hasActiveSimulation = false;

    this.trees.forEach((tree) => {
      if (!tree?.simulation) {
        return;
      }
      tree.simulation.update();
      tree.simulation.render();

      if (tree.simulation.isComplete) {
        // Replace fully grown fractals with a static bitmap to avoid ongoing renders.
        this.freezeTree(tree);
        return;
      }

      hasActiveSimulation = true;
    });

    if (!hasActiveSimulation) {
      this.stop();
      return;
    }

    this.animationFrame = requestAnimationFrame(this.handleFrame);
  }

  /**
   * Disconnect observers and halt rendering.
   */
  destroy() {
    this.stop();
    if (this.resizeObserver) {
      try {
        this.resizeObserver.disconnect();
      } catch (error) {
        console.warn('Failed to disconnect terrarium tree resize observer.', error);
      }
    }
    if (this.container) {
      this.container.removeEventListener('pointermove', this.handleContainerPointerMove);
      this.container.removeEventListener('pointerleave', this.handleContainerPointerLeave);
      this.container.removeEventListener('click', this.handleContainerClick);
    }
  }
}
