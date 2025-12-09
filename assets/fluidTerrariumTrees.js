'use strict';

import { FractalTreeSimulation } from '../scripts/features/towers/fractalTreeSimulation.js';
import { FernLSystemSimulation } from '../scripts/features/towers/fernLSystemSimulation.js';
import { FlameFractalSimulation } from '../scripts/features/towers/flameFractalSimulation.js';
import { BrownianTreeSimulation } from '../scripts/features/towers/brownianTreeSimulation.js';
import { DragonCurveSimulation } from '../scripts/features/towers/dragonCurveSimulation.js';
import { KochSnowflakeSimulation } from '../scripts/features/towers/kochSnowflakeSimulation.js';
import { VoronoiSubdivisionSimulation } from '../scripts/features/towers/voronoiSubdivisionSimulation.js';

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

// Estimated dimensions for the placement confirmation dialog to prevent off-screen positioning
const CONFIRMATION_DIALOG_ESTIMATED_HALF_WIDTH = 100; // Dialog is centered with translate(-50%, ...)
const CONFIRMATION_DIALOG_ESTIMATED_HEIGHT = 80; // Includes transform offset
const CONFIRMATION_DIALOG_PADDING = 10; // Minimum distance from viewport edges

// Storefront configuration so the Bet terrarium can surface player-placed decorations.
const DEFAULT_TERRARIUM_STORE_ITEMS = [
  // Delta Slimes - purchasable creatures that hop around the terrarium
  {
    id: 'bet-store-delta-slime-1',
    label: 'Delta Slime',
    description: 'A bouncy Δ creature that hops around the basin. Generates 0.5 hp/hr.',
    icon: 'Δ',
    itemType: 'slime',
    cost: 10,
    size: 'small',
    minY: 0.5,
    maxY: 0.95,
    minSpacing: 0.05,
  },
  {
    id: 'bet-store-delta-slime-2',
    label: 'Delta Slime',
    description: 'A bouncy Δ creature that hops around the basin. Generates 0.5 hp/hr.',
    icon: 'Δ',
    itemType: 'slime',
    cost: 10,
    size: 'small',
    minY: 0.5,
    maxY: 0.95,
    minSpacing: 0.05,
  },
  {
    id: 'bet-store-delta-slime-3',
    label: 'Delta Slime',
    description: 'A bouncy Δ creature that hops around the basin. Generates 0.5 hp/hr.',
    icon: 'Δ',
    itemType: 'slime',
    cost: 10,
    size: 'small',
    minY: 0.5,
    maxY: 0.95,
    minSpacing: 0.05,
  },
  {
    id: 'bet-store-delta-slime-4',
    label: 'Delta Slime',
    description: 'A bouncy Δ creature that hops around the basin. Generates 0.5 hp/hr.',
    icon: 'Δ',
    itemType: 'slime',
    cost: 10,
    size: 'small',
    minY: 0.5,
    maxY: 0.95,
    minSpacing: 0.05,
  },
  // Gamma Birds - flying creatures that avoid surfaces
  {
    id: 'bet-store-gamma-bird-1',
    label: 'Gamma Bird',
    description: 'A flying γ bird that soars through the open air and occasionally lands on trees.',
    icon: 'γ',
    itemType: 'bird',
    cost: 15,
    size: 'small',
    minY: 0.1,
    maxY: 0.7,
    minSpacing: 0.05,
  },
  {
    id: 'bet-store-gamma-bird-2',
    label: 'Gamma Bird',
    description: 'A flying γ bird that soars through the open air and occasionally lands on trees.',
    icon: 'γ',
    itemType: 'bird',
    cost: 15,
    size: 'small',
    minY: 0.1,
    maxY: 0.7,
    minSpacing: 0.05,
  },
  {
    id: 'bet-store-gamma-bird-3',
    label: 'Gamma Bird',
    description: 'A flying γ bird that soars through the open air and occasionally lands on trees.',
    icon: 'γ',
    itemType: 'bird',
    cost: 15,
    size: 'small',
    minY: 0.1,
    maxY: 0.7,
    minSpacing: 0.05,
  },
  {
    id: 'bet-store-gamma-bird-4',
    label: 'Gamma Bird',
    description: 'A flying γ bird that soars through the open air and occasionally lands on trees.',
    icon: 'γ',
    itemType: 'bird',
    cost: 15,
    size: 'small',
    minY: 0.1,
    maxY: 0.7,
    minSpacing: 0.05,
  },
  {
    id: 'bet-store-gamma-bird-5',
    label: 'Gamma Bird',
    description: 'A flying γ bird that soars through the open air and occasionally lands on trees.',
    icon: 'γ',
    itemType: 'bird',
    cost: 15,
    size: 'small',
    minY: 0.1,
    maxY: 0.7,
    minSpacing: 0.05,
  },
  {
    id: 'bet-store-large-tree',
    label: 'Large Fractal Tree',
    description: 'Full canopy anchor grown from the Shin lattice.',
    icon: '🌳',
    size: 'large',
    minY: 0.32,
    maxY: 0.94,
    minSpacing: 0.09,
    initialAllocation: 8,
  },
  {
    id: 'bet-store-small-tree',
    label: 'Small Fractal Tree',
    description: 'Compact sapling suited for ridge lines.',
    icon: '🌱',
    size: 'small',
    minY: 0.28,
    maxY: 0.9,
    minSpacing: 0.07,
    initialAllocation: 5,
  },
  {
    id: 'bet-store-island-bonsai',
    label: 'Island Bonsai',
    description: 'An elegant bonsai that grows on floating islands.',
    icon: '🌲',
    size: 'small',
    origin: 'island',
    minY: 0.28,
    maxY: 0.9,
    minSpacing: 0.07,
    initialAllocation: 5,
  },
  {
    id: 'bet-store-phi-yellow',
    label: 'Yellow Φ Shroom',
    description: 'A softly glowing golden mushroom. Cave-only. 10 hp/sec per level, max Lv 10.',
    icon: 'φ',
    itemType: 'shroom',
    shroomType: 'phi',
    colorVariant: 'yellow',
    cost: 50,
    size: 'small',
    minY: 0.65,
    maxY: 0.95,
    minSpacing: 0.05,
    caveOnly: true,
  },
  {
    id: 'bet-store-phi-green',
    label: 'Green Φ Shroom',
    description: 'A verdant glowing mushroom. Cave-only. 10 hp/sec per level, max Lv 10.',
    icon: 'φ',
    itemType: 'shroom',
    shroomType: 'phi',
    colorVariant: 'green',
    cost: 50,
    size: 'small',
    minY: 0.65,
    maxY: 0.95,
    minSpacing: 0.05,
    caveOnly: true,
  },
  {
    id: 'bet-store-phi-blue',
    label: 'Blue Φ Shroom',
    description: 'A sapphire glowing mushroom. Cave-only. 10 hp/sec per level, max Lv 10.',
    icon: 'φ',
    itemType: 'shroom',
    shroomType: 'phi',
    colorVariant: 'blue',
    cost: 50,
    size: 'small',
    minY: 0.65,
    maxY: 0.95,
    minSpacing: 0.05,
    caveOnly: true,
  },
  {
    id: 'bet-store-psi-1',
    label: 'Ψ Shroom',
    description: 'Dark mushroom that pulses pink and releases spores. Cave-only. 35 hp/sec per level, max Lv 5.',
    icon: 'ψ',
    itemType: 'shroom',
    shroomType: 'psi',
    cost: 200,
    size: 'small',
    minY: 0.65,
    maxY: 0.95,
    minSpacing: 0.05,
    caveOnly: true,
  },
  {
    id: 'bet-store-psi-2',
    label: 'Ψ Shroom',
    description: 'Dark mushroom that pulses pink and releases spores. Cave-only. 35 hp/sec per level, max Lv 5.',
    icon: 'ψ',
    itemType: 'shroom',
    shroomType: 'psi',
    cost: 200,
    size: 'small',
    minY: 0.65,
    maxY: 0.95,
    minSpacing: 0.05,
    caveOnly: true,
  },
  // Shin Spire Fractals - migrated to Bet Terrarium store
  {
    id: 'bet-store-fractal-tree',
    label: 'Tree Fractal',
    description: 'A binary branching pattern inspired by natural growth. Shin lattice geometry.',
    icon: '🌲',
    itemType: 'fractal',
    fractalType: 'tree',
    cost: 25,
    size: 'large',
    minY: 0.32,
    maxY: 0.94,
    minSpacing: 0.09,
    initialAllocation: 6,
  },
  {
    id: 'bet-store-fractal-koch',
    label: 'Koch Snowflake',
    description: 'A classic fractal formed by recursive triangular divisions. Shin lattice geometry.',
    icon: '❄',
    itemType: 'fractal',
    fractalType: 'koch',
    cost: 50,
    size: 'small',
    minY: 0.28,
    maxY: 0.9,
    minSpacing: 0.07,
    initialAllocation: 4,
  },
  {
    id: 'bet-store-fractal-fern',
    label: 'Natural Fern',
    description: 'A small, detailed fern with dark green fronds that grows with each level. Shin lattice geometry.',
    icon: '🌿',
    itemType: 'fractal',
    fractalType: 'fern',
    cost: 75,
    size: 'small',
    minY: 0.28,
    maxY: 0.9,
    minSpacing: 0.07,
    initialAllocation: 5,
  },
  {
    id: 'bet-store-fractal-dragon',
    label: 'Dragon Curve',
    description: 'A self-similar ribbon that folds upon itself in radiant ink. Shin lattice geometry.',
    icon: '🐉',
    itemType: 'fractal',
    fractalType: 'dragon',
    cost: 90,
    size: 'small',
    minY: 0.28,
    maxY: 0.9,
    minSpacing: 0.07,
    initialAllocation: 4,
  },
  {
    id: 'bet-store-fractal-voronoi',
    label: 'Voronoi Glass',
    description: 'A stained-glass tessellation of sapphire nebula shards. Shin lattice geometry.',
    icon: '💎',
    itemType: 'fractal',
    fractalType: 'voronoi',
    cost: 110,
    size: 'small',
    minY: 0.28,
    maxY: 0.9,
    minSpacing: 0.07,
    initialAllocation: 4,
  },
  {
    id: 'bet-store-fractal-brownian',
    label: 'Brownian Forest',
    description: 'Crystalline trees crystallize from drifting motes of light. Cave-only. Grows per level in open air.',
    icon: '🌌',
    itemType: 'fractal',
    fractalType: 'brownian',
    cost: 140,
    size: 'large',
    minY: 0.65,
    maxY: 0.95,
    minSpacing: 0.09,
    initialAllocation: 5,
    caveOnly: true,
  },
  {
    id: 'bet-store-fractal-flame',
    label: 'Flame Spiral',
    description: 'A flowing flame fractal that paints cosmic auroras. Shin lattice geometry.',
    icon: '🔥',
    itemType: 'fractal',
    fractalType: 'flame',
    cost: 175,
    size: 'small',
    minY: 0.28,
    maxY: 0.9,
    minSpacing: 0.07,
    initialAllocation: 4,
  },
  // Celestial Bodies - Sun and Moon Voronoi fractals (separate items)
  {
    id: 'bet-store-moon',
    label: 'Moon',
    description: 'Unlock the moon. Blue Voronoi moon begins its eternal orbit across the night sky.',
    icon: '🌙',
    itemType: 'celestial',
    celestialBody: 'moon',
    cost: 100,
    size: 'large',
    minY: 0,
    maxY: 1,
    minSpacing: 0,
  },
  {
    id: 'bet-store-sun',
    label: 'Sun',
    description: 'Unlock the sun. Yellow Voronoi sun begins its eternal orbit, bringing day and night to the terrarium.',
    icon: '☀️',
    itemType: 'celestial',
    celestialBody: 'sun',
    cost: 10000,
    size: 'large',
    minY: 0,
    maxY: 1,
    minSpacing: 0,
  },
];

const PLACEMENT_DIMENSIONS = {
  large: { widthRatio: 0.08, heightRatio: 0.26 },
  small: { widthRatio: 0.05, heightRatio: 0.18 },
};

const STORE_STATUS_DEFAULT = '';

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

    this.getSerendipityBalance =
      typeof options.getSerendipityBalance === 'function' ? options.getSerendipityBalance : () => 0;
    this.spendSerendipity = typeof options.spendSerendipity === 'function' ? options.spendSerendipity : () => 0;
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
  listenForMenuClose() {
    if (typeof window !== 'undefined') {
      window.addEventListener('betTerrariumMenuClose', this.handleMenuCloseEvent);
    }
  }

  /**
   * Handle menu close event triggered by camera gestures.
   */
  handleMenuCloseEvent() {
    if (this.isStoreOpen) {
      this.toggleStorePanel(false);
    }
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
      icon: typeof item?.icon === 'string' ? item.icon : '🌿',
      cost: Number.isFinite(item?.cost)
        ? Math.max(1, Math.round(item.cost))
        : Math.max(1, Math.round(Number.isFinite(item?.initialAllocation) ? item.initialAllocation : 4)),
      size: item?.size === 'small' ? 'small' : 'large',
      origin: item?.origin === 'island' ? 'island' : 'ground',
      minY: Number.isFinite(item?.minY) ? item.minY : 0.3,
      maxY: Number.isFinite(item?.maxY) ? item.maxY : 0.95,
      minSpacing: Number.isFinite(item?.minSpacing) ? Math.max(0.04, item.minSpacing) : 0.08,
      initialAllocation: Number.isFinite(item?.initialAllocation) ? Math.max(0, item.initialAllocation) : 6,
      // Shroom-specific fields
      itemType: item?.itemType || 'tree',
      shroomType: item?.shroomType || null,
      colorVariant: item?.colorVariant || null,
      caveOnly: Boolean(item?.caveOnly),
      // Fractal-specific fields (for Shin Spire fractals)
      fractalType: item?.fractalType || null,
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
    panel.className = 'fluid-tree-store-panel is-closed';
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
    list.addEventListener('pointerdown', this.handleStoreListPointerDown);
    list.addEventListener('pointerup', this.handleStoreListPointerUp);
    list.addEventListener('pointercancel', this.handleStoreListPointerUp);
    panel.appendChild(list);
    this.storeList = list;
    this.populateStoreItems();

    const status = document.createElement('p');
    status.className = 'fluid-tree-store-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.hidden = true;
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
      const header = document.createElement('div');
      header.className = 'fluid-tree-store-item__header';

      const stub = document.createElement('span');
      stub.className = 'fluid-tree-store-item__stub';
      stub.title = 'Drag onto the basin to place';
      if (item.icon) {
        const icon = document.createElement('span');
        icon.className = 'fluid-tree-store-item__icon';
        icon.textContent = item.icon;
        stub.appendChild(icon);
      }
      stub.addEventListener('pointerdown', (event) => {
        this.handleStoreItemDragStart(item, event);
      });
      header.appendChild(stub);

      const labelColumn = document.createElement('div');
      labelColumn.className = 'fluid-tree-store-item__details';

      const label = document.createElement('span');
      label.className = 'fluid-tree-store-item__label';
      label.textContent = item.label;
      labelColumn.appendChild(label);

      const cost = document.createElement('span');
      cost.className = 'fluid-tree-store-item__cost';
      cost.textContent = `${item.cost} Serendipity`;
      labelColumn.appendChild(cost);

      header.appendChild(labelColumn);
      button.appendChild(header);

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
   * Allow the store list to scroll when dragged so touch and mouse users can browse comfortably.
   * @param {PointerEvent} event
   */
  handleStoreListPointerDown(event) {
    if (!this.storeList) {
      return;
    }
    if ((event.pointerType === 'mouse' && event.button !== 0) || event.target.closest('.fluid-tree-store-item__stub')) {
      return;
    }
    this.storeListDragState = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScroll: this.storeList.scrollTop,
      isDragging: true,
    };
    this.storeList.classList.add('is-dragging');
    if (this.storeList.setPointerCapture) {
      this.storeList.setPointerCapture(event.pointerId);
    }
    window.addEventListener('pointermove', this.handleStoreListPointerMove, { passive: false });
    window.addEventListener('pointerup', this.handleStoreListPointerUp, { passive: false });
  }

  /**
   * Translate pointer movement into list scroll deltas.
   * @param {PointerEvent} event
   */
  handleStoreListPointerMove(event) {
    if (!this.storeListDragState.isDragging || event.pointerId !== this.storeListDragState.pointerId) {
      return;
    }
    event.preventDefault();
    const deltaY = event.clientY - this.storeListDragState.startY;
    this.storeList.scrollTop = this.storeListDragState.startScroll - deltaY;
  }

  /**
   * Stop drag-to-scroll tracking for the store list.
   * @param {PointerEvent} event
   */
  handleStoreListPointerUp(event) {
    if (this.storeList?.releasePointerCapture && this.storeListDragState.pointerId !== null) {
      try {
        this.storeList.releasePointerCapture(this.storeListDragState.pointerId);
      } catch (error) {
        // Silently ignore capture release errors so UI continues to respond.
      }
    }
    this.storeListDragState = { pointerId: null, startY: 0, startScroll: 0, isDragging: false };
    if (this.storeList) {
      this.storeList.classList.remove('is-dragging');
    }
    window.removeEventListener('pointermove', this.handleStoreListPointerMove);
    window.removeEventListener('pointerup', this.handleStoreListPointerUp);
  }

  /**
   * Toggle the visibility of the store panel.
   * @param {boolean} [forceState]
   */
  toggleStorePanel(forceState, options = {}) {
    const nextState = typeof forceState === 'boolean' ? forceState : !this.isStoreOpen;
    const preserveSelection = Boolean(options?.preserveSelection);
    const suppressEmit = Boolean(options?.suppressEmit);
    this.isStoreOpen = nextState;
    
    // Update buttonMenuOpen state in powderState
    if (this.powderState?.betTerrarium) {
      this.powderState.betTerrarium.buttonMenuOpen = nextState;
    }
    
    if (this.storePanel) {
      this.storePanel.classList.toggle('is-open', nextState);
      this.storePanel.classList.toggle('is-closed', !nextState);
      this.storePanel.setAttribute('aria-hidden', nextState ? 'false' : 'true');
      if (!nextState) {
        this.storePanel.classList.remove('is-transparent');
        this.storePanelTransparent = false;
      }
    }
    if (this.storeButton) {
      this.storeButton.classList.toggle('is-active', nextState);
      this.storeButton.setAttribute('aria-expanded', nextState ? 'true' : 'false');
    }
    if (!nextState) {
      this.clearPendingPlacement(true);
      if (!preserveSelection) {
        this.clearStoreSelection();
      }
      this.hidePlacementPreview();
      this.setStoreStatus(STORE_STATUS_DEFAULT);
    }

    if (!suppressEmit) {
      this.emitState();
    }
  }

  /**
   * Fade the store panel while dragging so the viewport stays unobstructed.
   */
  fadeStorePanelForDrag() {
    if (this.storePanel && !this.storePanelTransparent) {
      this.storePanelTransparent = true;
      this.storePanel.classList.add('is-transparent');
    }
  }

  /**
   * Restore the store panel opacity after a placement is confirmed or cancelled.
   */
  restoreStorePanelOpacity() {
    if (this.storePanel && this.storePanelTransparent) {
      this.storePanelTransparent = false;
      this.storePanel.classList.remove('is-transparent');
    }
  }

  /**
   * Update the live region messaging for the storefront.
   * @param {string} message
   */
  setStoreStatus(message) {
    if (this.storeStatus) {
      const nextMessage = message || STORE_STATUS_DEFAULT;
      this.storeStatus.textContent = nextMessage;
      this.storeStatus.hidden = !nextMessage;
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
   * Resolve a store item by id even if it is no longer the active selection.
   * @param {string} itemId
   */
  getStoreItemById(itemId) {
    if (!itemId) {
      return null;
    }
    return this.availableStoreItems.find((item) => item.id === itemId) || null;
  }

  /**
   * Confirm the player holds enough Serendipity to purchase a store item.
   * @param {object|null} storeItem
   */
  canAffordStoreItem(storeItem) {
    if (!storeItem) {
      return false;
    }
    const balance = Math.max(0, Math.floor(this.getSerendipityBalance()));
    return balance >= Math.max(0, Math.round(storeItem.cost || 0));
  }

  /**
   * Spend Serendipity for a store purchase and return success status.
   * @param {object|null} storeItem
   */
  purchaseStoreItem(storeItem) {
    if (!storeItem) {
      return false;
    }
    const cost = Math.max(0, Math.round(storeItem.cost || 0));
    if (!cost) {
      return true;
    }
    if (!this.canAffordStoreItem(storeItem)) {
      return false;
    }
    const spent = this.spendSerendipity(cost);
    return spent >= cost;
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
    this.clearPendingPlacement(true);
    this.activeStoreItemId = item.id;
    this.updateStoreSelectionVisuals(item.id);
    if (!this.isStoreOpen) {
      this.toggleStorePanel(true);
    }
    const statusMessage = this.canAffordStoreItem(item)
      ? `Drag the stub or tap the basin to spend ${item.cost} Serendipity. Placements are temporary.`
      : `Requires ${item.cost} Serendipity. Earn more to place this object.`;
    this.setStoreStatus(statusMessage);
  }

  /**
   * Create the floating stub that mirrors the dragged store icon.
   * @param {object} storeItem
   */
  createDragGhost(storeItem) {
    if (typeof document === 'undefined' || !storeItem) {
      return;
    }
    this.removeDragGhost();
    const ghost = document.createElement('div');
    ghost.className = 'fluid-tree-store-ghost';
    const icon = document.createElement('span');
    icon.className = 'fluid-tree-store-ghost__icon';
    icon.textContent = storeItem.icon || '🌿';
    ghost.appendChild(icon);
    const label = document.createElement('span');
    label.className = 'fluid-tree-store-ghost__label';
    label.textContent = storeItem.label || 'Object';
    ghost.appendChild(label);
    document.body.appendChild(ghost);
    this.dragGhost = ghost;
  }

  /**
   * Remove any existing drag ghost from the DOM.
   */
  removeDragGhost() {
    if (this.dragGhost?.parentNode) {
      this.dragGhost.remove();
    }
    this.dragGhost = null;
  }

  /**
   * Position the drag ghost at the active pointer location.
   * @param {number} clientX
   * @param {number} clientY
   */
  updateDragGhostPosition(clientX, clientY) {
    if (!this.dragGhost) {
      return;
    }
    this.dragGhost.style.left = `${clientX}px`;
    this.dragGhost.style.top = `${clientY}px`;
  }

  /**
   * Toggle validity styling on the drag ghost while hovering different terrain.
   * @param {boolean} isValid
   */
  updateDragGhostValidity(isValid) {
    if (this.dragGhost) {
      this.dragGhost.classList.toggle('is-invalid', !isValid);
    }
  }

  /**
   * Begin dragging a store icon so the item can be placed on the terrarium.
   * @param {object} storeItem
   * @param {PointerEvent} event
   */
  handleStoreItemDragStart(storeItem, event) {
    if (!storeItem || !event) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.activeStoreItemId = storeItem.id;
    this.updateStoreSelectionVisuals(storeItem.id);
    if (!this.canAffordStoreItem(storeItem)) {
      this.setStoreStatus(`Requires ${storeItem.cost} Serendipity to place ${storeItem.label}.`);
      return;
    }
    this.draggedStoreItemId = storeItem.id;
    this.dragPointerId = event.pointerId;
    this.createDragGhost(storeItem);
    this.fadeStorePanelForDrag();
    window.addEventListener('pointermove', this.handleDragPointerMove, { passive: false });
    window.addEventListener('pointerup', this.handleDragPointerUp, { passive: false });
    this.handleDragPointerMove(event);
  }

  /**
   * Track pointer movement while a store item is being dragged.
   * @param {PointerEvent} event
   */
  handleDragPointerMove(event) {
    if (!this.draggedStoreItemId || (this.dragPointerId && event.pointerId !== this.dragPointerId)) {
      return;
    }
    this.updateDragGhostPosition(event.clientX, event.clientY);
    const storeItem = this.getStoreItemById(this.draggedStoreItemId);
    const point = this.getNormalizedPointFromClient(event.clientX, event.clientY);
    const isValid = Boolean(point && this.isPlacementLocationValid(point, storeItem));
    if (point) {
      this.pendingPlacementPoint = point;
      this.updatePlacementPreview(point, isValid, storeItem);
    } else {
      this.hidePlacementPreview();
    }
    this.updateDragGhostValidity(isValid);
  }

  /**
   * Resolve placement when the player releases the dragged store icon.
   * @param {PointerEvent} event
   */
  handleDragPointerUp(event) {
    if (!this.draggedStoreItemId || (this.dragPointerId && event.pointerId !== this.dragPointerId)) {
      return;
    }
    const storeItem = this.getStoreItemById(this.draggedStoreItemId);
    const point = this.getNormalizedPointFromClient(event.clientX, event.clientY);
    const isValid = point && this.isPlacementLocationValid(point, storeItem);
    if (storeItem && isValid) {
      this.queuePlacementForConfirmation(point, storeItem, { fadeStore: true });
      this.endStoreDrag({ preserveSelection: true, preservePreview: true });
      return;
    }
    this.endStoreDrag();
    this.restoreStorePanelOpacity();
  }

  /**
   * Clean up drag-specific state and visuals.
   */
  endStoreDrag(options = {}) {
    window.removeEventListener('pointermove', this.handleDragPointerMove);
    window.removeEventListener('pointerup', this.handleDragPointerUp);
    this.removeDragGhost();
    this.draggedStoreItemId = null;
    this.dragPointerId = null;
    if (!options.preservePreview) {
      this.hidePlacementPreview();
    }
    if (!options.preserveSelection) {
      this.clearStoreSelection();
    }
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

  hidePlacementPreview() {
    if (this.placementPreview) {
      this.placementPreview.hidden = true;
      this.placementPreview.removeAttribute('data-visible');
      this.placementPreview.removeAttribute('data-valid');
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
   */
  updatePlacementPreview(point, isValid, storeItem = null) {
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
    // Display the item's icon if available; otherwise show a fallback emoji
    this.placementPreview.textContent = storeItem?.icon || '🌿';
  }

  /**
   * Surface confirmation controls so the player can approve or cancel the drop.
   * @param {{xRatio:number,yRatio:number,isInside:boolean}} point
   * @param {object} storeItem
   */
  showPlacementConfirmation(point, storeItem) {
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
  hidePlacementConfirmation() {
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
  queuePlacementForConfirmation(point, storeItem, options = {}) {
    if (!point?.isInside || !storeItem) {
      return;
    }
    const isValid = this.isPlacementLocationValid(point, storeItem);
    this.updatePlacementPreview(point, isValid, storeItem);
    if (!isValid) {
      this.pendingPlacement = null;
      this.setStoreStatus('Pick an open patch of terrain. Placements are not saved to your profile.');
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
  handleCancelPlacement() {
    this.clearPendingPlacement(true);
    this.setStoreStatus(STORE_STATUS_DEFAULT);
  }

  /**
   * Finalize a placement after explicit confirmation.
   */
  handleConfirmPlacement() {
    this.commitPendingPlacement();
  }

  /**
   * Resolve the pending placement by spending serendipity and planting the item.
   */
  commitPendingPlacement() {
    if (!this.pendingPlacement) {
      return;
    }
    const storeItem = this.getStoreItemById(this.pendingPlacement.storeItemId) || this.getActiveStoreItem();
    const point = this.pendingPlacement.point;
    if (!storeItem || !this.isPlacementLocationValid(point, storeItem)) {
      this.setStoreStatus('Pick an open patch of terrain. Placements are not saved to your profile.');
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
  clearPendingPlacement(restoreOpacity = false) {
    this.pendingPlacement = null;
    this.pendingPlacementPoint = null;
    this.hidePlacementConfirmation();
    this.hidePlacementPreview();
    if (restoreOpacity) {
      this.restoreStorePanelOpacity();
    }
  }

  handleContainerPointerMove(event) {
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
    const isValid = this.isPlacementLocationValid(point, storeItem);
    this.updatePlacementPreview(point, isValid, storeItem);
  }

  handleContainerPointerLeave() {
    if (this.pendingPlacement) {
      return;
    }
    this.hidePlacementPreview();
  }

  handleContainerClick(event) {
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
    if (!point || !this.isPlacementLocationValid(point, storeItem)) {
      this.setStoreStatus('Pick an open patch of terrain. Placements are not saved to your profile.');
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
  getNormalizedPointFromClient(clientX, clientY) {
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
   * Validate whether a normalized point is acceptable for the selected store item.
   * @param {{xRatio:number,yRatio:number,isInside:boolean}} point
   * @param {object|null} [storeItem]
   */
  isPlacementLocationValid(point, storeItem = this.getActiveStoreItem()) {
    if (!storeItem) {
      return false;
    }
    // Celestial bodies don't require a specific placement location - any click is valid
    if (storeItem.itemType === 'celestial') {
      return true;
    }
    if (!point?.isInside) {
      return false;
    }
    if (point.yRatio < storeItem.minY || point.yRatio > storeItem.maxY) {
      return false;
    }
    // Cave-only items (like Brownian Forest) must be placed inside cave spawn zones.
    if (storeItem.caveOnly && !this.isPointInCaveZone(point)) {
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
  placeActiveStoreItem(point, storeItem = this.getActiveStoreItem()) {
    if (!storeItem) {
      return false;
    }
    if (!this.purchaseStoreItem(storeItem)) {
      this.setStoreStatus(`Requires ${storeItem.cost} Serendipity to place ${storeItem.label}.`);
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
        this.setStoreStatus(`${storeItem.label} planted. Generates happiness in the cave.`);
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
        this.setStoreStatus(`${storeItem.label} released into the basin. Generates 0.5 hp/hr.`);
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
    this.refreshLayout();
    this.setStoreStatus(`${storeItem.label} planted. Placements reset when you leave this session.`);
    this.updatePlacementPreview(point, true, storeItem);
    this.consumeStoreItem(storeItem.id);
    this.clearStoreSelection();
    return true;
  }

  /**
   * Remove a purchased item from the storefront roster.
   * @param {string} itemId
   */
  consumeStoreItem(itemId) {
    if (!itemId) {
      return;
    }
    this.availableStoreItems = this.availableStoreItems.filter((item) => item.id !== itemId);
    this.populateStoreItems();
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
    this.resolveCaveZones();
  }

  /**
   * Resolve normalized cave spawn zones to pixel coordinates within renderBounds.
   */
  resolveCaveZones() {
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
  isPointInCaveZone(point) {
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
   * Build a walkable mask from the terrain collision sprite so Brownian growth avoids solid terrain.
   */
  buildWalkableMask() {
    if (typeof document === 'undefined') {
      return;
    }

    const source = this.terrainCollisionElement;
    if (!source) {
      return;
    }

    const sample = () => {
      const width = source.naturalWidth;
      const height = source.naturalHeight;
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
      ctx.drawImage(source, 0, 0, width, height);
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

    if (source.complete && source.naturalWidth) {
      sample();
    } else {
      source.addEventListener('load', sample, { once: true });
    }
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
   * Toggle camera mode visuals so the on-render buttons disappear when panning is active.
   * @param {boolean} enabled
   * @param {{notifyHost?: boolean}} [options]
   */
  setCameraMode(enabled, options = {}) {
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
  emitState() {
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
    const layers = this.computeLevelInfo(allocated).level;
    const fractalType = tree.anchor?.fractalType || 'tree';
    // Route allocations into the appropriate Shin fractal renderer so each store item
    // preserves its unique geometry.

    if (fractalType === 'koch' && typeof tree.simulation.updateConfig === 'function') {
      const snowflakeSize = Math.min(tree.canvas.width, tree.canvas.height) * 0.6;
      tree.simulation.updateConfig({ allocated, iterations: Math.min(6, 3 + layers), initialSize: snowflakeSize });
      return;
    }

    if (fractalType === 'fern' && typeof tree.simulation.updateConfig === 'function') {
      tree.simulation.updateConfig({ allocated, layersCompleted: Math.min(6, layers) });
      return;
    }

    if (fractalType === 'dragon' && typeof tree.simulation.updateConfig === 'function') {
      tree.simulation.updateConfig({ allocated, iterations: Math.min(16, 6 + layers) });
      return;
    }

    if (fractalType === 'voronoi' && typeof tree.simulation.updateConfig === 'function') {
      tree.simulation.updateConfig({ allocated });
      return;
    }

    if (fractalType === 'brownian' && typeof tree.simulation.updateConfig === 'function') {
      tree.simulation.updateConfig({
        allocated,
        originX: (tree.canvas?.width || 0) / 2,
        originY: Math.max(8, (tree.canvas?.height || 0) * 0.05),
      });
      return;
    }

    if (fractalType === 'flame' && typeof tree.simulation.updateConfig === 'function') {
      tree.simulation.updateConfig({ allocated });
      return;
    }

    const growthBudget = Math.min(tree.simulation.maxSegments - 1, allocated);
    tree.simulation.setTargetSegments(1 + growthBudget);
  }

  /**
   * Build the HUD elements that hover over a tree.
   * Now only shows the level number in "Lv. X" format.
   */
  createLevelBadge(layout) {
    const badge = document.createElement('div');
    badge.className = 'fluid-tree-level';
    badge.style.left = `${layout.left}px`;
    badge.style.top = `${layout.top - 16}px`;
    badge.style.width = `${layout.width}px`;

    // Simplified label showing only the level number
    const label = document.createElement('div');
    label.className = 'fluid-tree-level__label';
    badge.appendChild(label);

    return { badge, label, fill: null, progressText: null, upgradeButton: null };
  }

  /**
   * Refresh the level label for a given tree.
   * Shows "Lv. X" format or "MAX" if at maximum practical level.
   */
  updateTreeBadge(tree) {
    if (!tree?.badge) {
      return;
    }
    const { label } = tree.badge;
    const levelInfo = this.computeLevelInfo(tree.state.allocated || 0);

    // Consider level 20 as "MAX" for display purposes (2^20 = ~1M serendipity)
    const MAX_DISPLAY_LEVEL = 20;
    
    // Show level in "Lv. X" format or "MAX" if at max
    if (label) {
      const levelText = levelInfo.level >= MAX_DISPLAY_LEVEL ? 'MAX' : `Lv. ${levelInfo.level}`;
      label.textContent = levelText;
    }
  }

  /**
   * Spend serendipity from the upgrade button to push the selected tree forward.
   */
  handleUpgradeButton(tree, event) {
    if (!tree) {
      return;
    }
    const levelInfo = this.computeLevelInfo(tree.state.allocated || 0);
    const required = Math.max(1, Math.round(levelInfo.nextCost - levelInfo.progress));
    const available = Math.max(0, Math.round(this.getSerendipityBalance()));
    if (!available) {
      return;
    }
    const amount = Math.min(required, available);
    const rect = event?.currentTarget?.getBoundingClientRect?.();
    const point = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : null;
    this.allocateToTree(tree, amount, point, amount > 1);
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
   * Attach the upgrade button so taps spend serendipity on the specific tree.
   */
  attachUpgradeButton(tree) {
    if (!tree?.badge?.upgradeButton) {
      return;
    }
    tree.badge.upgradeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.handleUpgradeButton(tree, event);
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
      const simulation = this.buildSimulation(anchor, canvas, layout.visibleHeight || layout.height);
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

      const tree = { id: treeId, canvas, simulation, frozen: false, state, badge, isEphemeral, anchor };
      this.updateSimulationTarget(tree);
      if (badge) {
        this.updateTreeBadge(tree);
      }
      if (!isEphemeral) {
        this.attachTreeInput(tree);
        this.attachUpgradeButton(tree);
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

    const horizontalPadding = Math.max(16, width * 0.25);
    const verticalPadding = Math.max(12, height * 0.15);
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

    // Use device pixel ratio with 3x multiplier for crisp rendering at mobile zoom levels.
    // Cap at 6x to avoid excessive memory usage on high-DPI devices.
    const dpr = typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
      ? window.devicePixelRatio
      : 1;
    const scaleFactor = Math.min(dpr * 3, 6);

    // Set high-resolution buffer size for crisp rendering.
    canvas.width = Math.round(layout.width * scaleFactor);
    canvas.height = Math.round(layout.height * scaleFactor);

    // Keep CSS display size unchanged.
    canvas.style.left = `${layout.left}px`;
    canvas.style.top = `${layout.top}px`;
    canvas.style.width = `${layout.width}px`;
    canvas.style.height = `${layout.height}px`;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');

    // Scale context so drawing operations use logical coordinates.
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(scaleFactor, scaleFactor);
    }

    return canvas;
  }

  /**
   * Configure the Shin fractal tree simulation for the given canvas.
   * @param {'large'|'small'} size
   * @param {HTMLCanvasElement} canvas
   * @param {number} height
   */
  buildSimulation(anchor, canvas, height) {
    const size = anchor?.size || 'large';
    const type = anchor?.fractalType || 'tree';

    if (type === 'koch') {
      const snowflakeSize = Math.min(canvas.width, canvas.height) * 0.6;
      return new KochSnowflakeSimulation({
        canvas,
        bgColor: 'rgba(0, 0, 0, 0)',
        lineColor: '#9dd8ff',
        lineWidth: 1.6,
        initialSize: snowflakeSize,
        iterations: 5,
        drawSpeed: 0.02,
      });
    }

    if (type === 'fern') {
      return new FernLSystemSimulation({
        canvas,
        bgColor: 'rgba(0, 0, 0, 0)',
        palette: 'dark-fern',
        turnAngle: 25,
        segmentLength: Math.max(3, Math.min(10, height * 0.02)),
        segmentGrowthSpeed: 0.09,
      });
    }

    if (type === 'dragon') {
      return new DragonCurveSimulation({
        canvas,
        bgColor: 'rgba(0, 0, 0, 0)',
        lineStartColor: '#7f9cff',
        lineEndColor: '#ffd29d',
        lineWidth: 1.25,
        segmentLength: Math.max(2, Math.min(6, height * 0.015)),
        iterations: 12,
        drawSpeed: 0.018,
      });
    }

    if (type === 'voronoi') {
      return new VoronoiSubdivisionSimulation({
        canvas,
        bgColor: 'rgba(0, 0, 0, 0)',
        palette: 'blue-aurora',
        maxCells: 140,
        maxDepth: 5,
        splitDelay: 0.05,
      });
    }

    if (type === 'brownian') {
      return new BrownianTreeSimulation({
        canvas,
        bgColor: 'rgba(0, 0, 0, 0)',
        particleLimit: 1600,
        glowRadius: 5,
        walkableMask: this.walkableMask,
      });
    }

    if (type === 'flame') {
      return new FlameFractalSimulation({
        canvas,
        bgColor: 'rgba(0, 0, 0, 0)',
        palette: 'aurora',
        samplesPerIteron: 8000,
        fadeRate: 0.18,
      });
    }

    // Default: Shin fractal tree variant.
    const depth = 7;
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
   * Determine whether the underlying fractal simulation still needs animation frames.
   * @param {object|null} simulation
   */
  isSimulationComplete(simulation) {
    if (!simulation) {
      return true;
    }
    if (typeof simulation.isComplete === 'boolean') {
      return simulation.isComplete;
    }
    if (typeof simulation.getCompletion === 'function') {
      return simulation.getCompletion() >= 1;
    }
    if ('progress' in simulation && 'targetProgress' in simulation) {
      return Number(simulation.progress) >= Number(simulation.targetProgress) - 0.001;
    }
    return false;
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
    // Intrinsic dimensions are encoded in the PNG; CSS styles control display size.
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

      if (!this.isSimulationComplete(tree.simulation)) {
        tree.simulation.update();
        tree.simulation.render();
      }

      if (this.isSimulationComplete(tree.simulation)) {
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
    if (typeof window !== 'undefined') {
      window.removeEventListener('betTerrariumMenuClose', this.handleMenuCloseEvent);
      window.removeEventListener('pointermove', this.handleDragPointerMove);
      window.removeEventListener('pointerup', this.handleDragPointerUp);
    }
    this.removeDragGhost();
  }
}
