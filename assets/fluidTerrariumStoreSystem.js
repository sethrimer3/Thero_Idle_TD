'use strict';

// FluidTerrariumTrees store panel and drag system methods.
// Each function is called via .call(this) where `this` is the FluidTerrariumTrees instance.

// Storefront configuration so the Bet terrarium can surface player-placed decorations.
export const DEFAULT_TERRARIUM_STORE_ITEMS = [
  // Delta Slimes - purchasable creatures that hop around the terrarium
  {
    id: 'bet-store-delta-slime-1',
    label: 'Delta Slime',
    description: 'A bouncy Δ creature that hops around the basin.',
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
    description: 'A bouncy Δ creature that hops around the basin.',
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
    description: 'A bouncy Δ creature that hops around the basin.',
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
    description: 'A bouncy Δ creature that hops around the basin.',
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

export const STORE_STATUS_DEFAULT = 'Select an item, then tap the basin to preview placement.';

/**
 * Listen for menu close events from the viewport controller.
 */
export function fttssListenForMenuClose() {
  if (typeof window !== 'undefined') {
    window.addEventListener('betTerrariumMenuClose', this.handleMenuCloseEvent);
  }
}

/**
 * Handle menu close event triggered by camera gestures.
 */
export function fttssHandleMenuCloseEvent() {
  if (this.isStoreOpen) {
    this.toggleStorePanel(false);
  }
}

/**
 * Normalize optional storefront configuration so every entry carries placement rules.
 * @param {Array} rawItems
 */
export function fttssNormalizeStoreItems(rawItems) {
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
 * Translate item types into short, legible tags so the store reads like a curated shelf.
 * @param {object} storeItem
 * @returns {string}
 */
export function fttssDescribeStoreItemType(storeItem) {
  if (!storeItem) {
    return '';
  }
  switch (storeItem.itemType) {
    case 'slime':
    case 'bird':
      return 'Creature';
    case 'shroom':
      return 'Cave Bloom';
    case 'celestial':
      return 'Sky Sigil';
    case 'fractal':
      return 'Fractal';
    default:
      return 'Fractal';
  }
}

/**
 * Summarize the habitat or placement restriction as a concise badge.
 * @param {object} storeItem
 * @returns {string}
 */
export function fttssDescribeStoreItemHabitat(storeItem) {
  if (!storeItem) {
    return '';
  }
  if (storeItem.itemType === 'celestial') {
    return 'Atmosphere';
  }
  if (storeItem.caveOnly) {
    return 'Cave Only';
  }
  if (storeItem.origin === 'island') {
    return 'Island';
  }
  return 'Basin';
}

/**
 * Factory for the small pill-shaped tags shown on each store entry.
 * @param {string} label
 * @param {string} variant
 * @returns {HTMLSpanElement}
 */
export function fttssCreateStoreTag(label, variant) {
  const tag = document.createElement('span');
  tag.className = 'fluid-tree-store-tag';
  if (variant) {
    tag.dataset.variant = variant;
  }
  tag.textContent = label;
  return tag;
}

/**
 * Build the interactive store menu that lets players pick decorative items.
 */
export function fttssBuildStorePanel() {
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

  // Surface the current Scintillae reserve alongside the store instructions.
  const metaRow = document.createElement('div');
  metaRow.className = 'fluid-tree-store-meta';

  const balancePill = document.createElement('span');
  balancePill.className = 'fluid-tree-store-balance';
  balancePill.textContent = '0 Scintillae';
  metaRow.appendChild(balancePill);
  this.storeBalanceLabel = balancePill;

  const hint = document.createElement('p');
  hint.className = 'fluid-tree-store-hint';
  hint.textContent = 'Drag an icon or tap to arm placement, then pick a landing spot.';
  metaRow.appendChild(hint);

  panel.appendChild(metaRow);

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

  // Hydrate the balance pill once so it never shows a stale default.
  this.updateStoreBalanceDisplay();

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
export function fttssPopulateStoreItems() {
  if (!this.storeList) {
    return;
  }
  this.storeList.innerHTML = '';
  this.storeItemButtons.clear();

  this.availableStoreItems.forEach((item) => {
    const balance = Math.max(0, Math.floor(this.getScintillaeBalance()));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fluid-tree-store-item';
    button.dataset.itemId = item.id;
    button.dataset.itemType = item.itemType || 'tree';
    button.dataset.habitat = this.describeStoreItemHabitat(item);
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
    const shortfall = Math.max(0, Math.round(item.cost - balance));
    cost.textContent = shortfall > 0
      ? `${item.cost} Scintillae (need ${shortfall})`
      : `${item.cost} Scintillae`;
    labelColumn.appendChild(cost);

    const tagsRow = document.createElement('div');
    tagsRow.className = 'fluid-tree-store-item__tags';
    const typeTag = this.describeStoreItemType(item);
    const habitatTag = this.describeStoreItemHabitat(item);
    const spacingPercent = Math.round(Math.max(0.02, item.minSpacing || 0.08) * 100);

    if (typeTag) {
      tagsRow.appendChild(this.createStoreTag(typeTag, 'type'));
    }
    if (habitatTag) {
      tagsRow.appendChild(this.createStoreTag(habitatTag, 'habitat'));
    }
    tagsRow.appendChild(this.createStoreTag(item.size === 'large' ? 'Tall' : 'Compact', 'size'));
    tagsRow.appendChild(this.createStoreTag(`Clear ${spacingPercent}%`, 'spacing'));
    labelColumn.appendChild(tagsRow);

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
    this.storeItemButtons.set(item.id, { button, item });
  });

  this.refreshStoreAffordances();
  this.updateStoreBalanceDisplay();
}

/**
 * Mirror the latest Scintillae balance into the store badge for quick budgeting.
 */
export function fttssUpdateStoreBalanceDisplay() {
  if (!this.storeBalanceLabel) {
    return;
  }
  const balance = Math.max(0, Math.floor(this.getScintillaeBalance()));
  this.storeBalanceLabel.textContent = `${balance} Scintillae`;
  this.storeBalanceLabel.setAttribute('aria-label', `Scintillae balance ${balance}`);
}

/**
 * Lock or unlock store entries based on Scintillae balance while surfacing shortfalls.
 */
export function fttssRefreshStoreAffordances() {
  const balance = Math.max(0, Math.floor(this.getScintillaeBalance()));
  this.storeItemButtons.forEach((entry) => {
    const button = entry?.button;
    const item = entry?.item;
    if (!button || !item) {
      return;
    }
    const affordable = this.canAffordStoreItem(item);
    button.dataset.affordable = affordable ? 'true' : 'false';
    if (affordable) {
      button.removeAttribute('aria-disabled');
    } else {
      button.setAttribute('aria-disabled', 'true');
    }
    const costLabel = button.querySelector('.fluid-tree-store-item__cost');
    if (costLabel) {
      const shortfall = Math.max(0, Math.round(item.cost - balance));
      costLabel.textContent = shortfall > 0
        ? `${item.cost} Scintillae (need ${shortfall})`
        : `${item.cost} Scintillae`;
    }
  });
  this.updateStoreBalanceDisplay();
}

/**
 * Allow the store list to scroll when dragged so touch and mouse users can browse comfortably.
 * @param {PointerEvent} event
 */
export function fttssHandleStoreListPointerDown(event) {
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
export function fttssHandleStoreListPointerMove(event) {
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
export function fttssHandleStoreListPointerUp(event) {
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
export function fttssToggleStorePanel(forceState, options = {}) {
  const nextState = typeof forceState === 'boolean' ? forceState : !this.isStoreOpen;
  const preserveSelection = Boolean(options?.preserveSelection);
  const suppressEmit = Boolean(options?.suppressEmit);
  this.isStoreOpen = nextState;

  // Update buttonMenuOpen state in powderState
  if (this.powderState?.betTerrarium) {
    this.powderState.betTerrarium.buttonMenuOpen = nextState;
  }

  if (nextState) {
    this.setStoreStatus(STORE_STATUS_DEFAULT);
    this.refreshStoreAffordances();
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
export function fttssFadeStorePanelForDrag() {
  if (this.storePanel && !this.storePanelTransparent) {
    this.storePanelTransparent = true;
    this.storePanel.classList.add('is-transparent');
  }
}

/**
 * Restore the store panel opacity after a placement is confirmed or cancelled.
 */
export function fttssRestoreStorePanelOpacity() {
  if (this.storePanel && this.storePanelTransparent) {
    this.storePanelTransparent = false;
    this.storePanel.classList.remove('is-transparent');
  }
}

/**
 * Update the live region messaging for the storefront.
 * @param {string} message
 */
export function fttssSetStoreStatus(message) {
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
export function fttssUpdateStoreSelectionVisuals(itemId) {
  this.storeItemButtons.forEach((entry, id) => {
    const button = entry?.button;
    if (button) {
      button.classList.toggle('is-selected', id === itemId);
    }
  });
}

/**
 * Clear the currently selected store item.
 */
export function fttssClearStoreSelection() {
  this.activeStoreItemId = null;
  this.updateStoreSelectionVisuals(null);
}

/**
 * Resolve the active store item metadata.
 */
export function fttssGetActiveStoreItem() {
  if (!this.activeStoreItemId) {
    return null;
  }
  return this.availableStoreItems.find((item) => item.id === this.activeStoreItemId) || null;
}

/**
 * Resolve a store item by id even if it is no longer the active selection.
 * @param {string} itemId
 */
export function fttssGetStoreItemById(itemId) {
  if (!itemId) {
    return null;
  }
  return this.availableStoreItems.find((item) => item.id === itemId) || null;
}

/**
 * Confirm the player holds enough Scintillae to purchase a store item.
 * @param {object|null} storeItem
 */
export function fttssCanAffordStoreItem(storeItem) {
  if (!storeItem) {
    return false;
  }
  const balance = Math.max(0, Math.floor(this.getScintillaeBalance()));
  return balance >= Math.max(0, Math.round(storeItem.cost || 0));
}

/**
 * Spend Scintillae for a store purchase and return success status.
 * @param {object|null} storeItem
 */
export function fttssPurchaseStoreItem(storeItem) {
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
  const spent = this.spendScintillae(cost);
  const success = spent >= cost;
  if (success) {
    this.refreshStoreAffordances();
  }
  return success;
}

/**
 * Handle item selection and guide the player toward the placement gesture.
 * @param {string} itemId
 */
export function fttssSelectStoreItem(itemId) {
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
    ? `Drag the stub or tap the basin to spend ${item.cost} Scintillae. Placements are temporary.`
    : `Requires ${item.cost} Scintillae. Earn more to place this object.`;
  this.setStoreStatus(statusMessage);
}

/**
 * Create the floating stub that mirrors the dragged store icon.
 * @param {object} storeItem
 */
export function fttssCreateDragGhost(storeItem) {
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
export function fttssRemoveDragGhost() {
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
export function fttssUpdateDragGhostPosition(clientX, clientY) {
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
export function fttssUpdateDragGhostValidity(isValid) {
  if (this.dragGhost) {
    this.dragGhost.classList.toggle('is-invalid', !isValid);
  }
}

/**
 * Begin dragging a store icon so the item can be placed on the terrarium.
 * @param {object} storeItem
 * @param {PointerEvent} event
 */
export function fttssHandleStoreItemDragStart(storeItem, event) {
  if (!storeItem || !event) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  this.activeStoreItemId = storeItem.id;
  this.updateStoreSelectionVisuals(storeItem.id);
  if (!this.canAffordStoreItem(storeItem)) {
    this.setStoreStatus(`Requires ${storeItem.cost} Scintillae to place ${storeItem.label}.`);
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
export function fttssHandleDragPointerMove(event) {
  if (!this.draggedStoreItemId || (this.dragPointerId && event.pointerId !== this.dragPointerId)) {
    return;
  }
  this.updateDragGhostPosition(event.clientX, event.clientY);
  const storeItem = this.getStoreItemById(this.draggedStoreItemId);
  const point = this.getNormalizedPointFromClient(event.clientX, event.clientY);
  if (point) {
    const validity = this.getPlacementValidity(point, storeItem);
    this.pendingPlacementPoint = point;
    this.updatePlacementPreview(point, validity.valid, storeItem, validity.reason);
    if (!validity.valid && validity.reason) {
      this.setStoreStatus(validity.reason);
    }
    this.updateDragGhostValidity(validity.valid);
  } else {
    this.hidePlacementPreview();
    this.updateDragGhostValidity(false);
  }
}

/**
 * Resolve placement when the player releases the dragged store icon.
 * @param {PointerEvent} event
 */
export function fttssHandleDragPointerUp(event) {
  if (!this.draggedStoreItemId || (this.dragPointerId && event.pointerId !== this.dragPointerId)) {
    return;
  }
  const storeItem = this.getStoreItemById(this.draggedStoreItemId);
  const point = this.getNormalizedPointFromClient(event.clientX, event.clientY);
  const validity = point ? this.getPlacementValidity(point, storeItem) : { valid: false, reason: '' };
  if (storeItem && validity.valid) {
    this.queuePlacementForConfirmation(point, storeItem, { fadeStore: true });
    this.endStoreDrag({ preserveSelection: true, preservePreview: true });
    return;
  }
  if (!validity.valid && validity.reason) {
    this.setStoreStatus(validity.reason);
  }
  this.endStoreDrag();
  this.restoreStorePanelOpacity();
}

/**
 * Clean up drag-specific state and visuals.
 */
export function fttssEndStoreDrag(options = {}) {
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
 * Remove a purchased item from the storefront roster.
 * @param {string} itemId
 */
export function fttssConsumeStoreItem(itemId) {
  if (!itemId) {
    return;
  }
  this.availableStoreItems = this.availableStoreItems.filter((item) => item.id !== itemId);
  this.populateStoreItems();
}
