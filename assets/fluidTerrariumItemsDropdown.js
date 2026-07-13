'use strict';

import { resolveTerrariumTreeLevel } from './fluidTerrariumTrees.js';

/**
 * Terrarium item definitions for list rendering and upgrades.
 */
const PRODUCER_DEFINITIONS = {
  slime: {
    id: 'slime',
    label: 'Delta Slime',
    icon: 'Δ',
    countLabel: '',
    levelBased: false, // Slimes count as quantity, not levels
  },
  bird: {
    id: 'bird',
    label: 'Gamma Bird',
    icon: 'γ',
    countLabel: '',
    levelBased: false, // Birds count as quantity, not levels
  },
};

/**
 * Dropdown controller that lists all terrarium items with upgrade functionality.
 * Items can be upgraded by spending serendipity currency to increase their level.
 */
export class FluidTerrariumItemsDropdown {
  /**
   * @param {object} options
   * @param {HTMLElement} options.toggleButton - Button that expands/collapses the dropdown.
   * @param {HTMLElement} options.dropdownContainer - Container that holds the dropdown list.
   * @param {HTMLElement} options.emptyMessage - Element shown when no items are present.
   * @param {HTMLElement} options.itemsList - UL element for item entries.
   * @param {Function} options.getScintillaeBalance - Returns current Scintillae balance.
   * @param {Function} options.spendScintillae - Spends Scintillae; returns amount spent.
   * @param {Function} options.getProducerCount - Gets the count/level for a producer ID.
   * @param {Function} options.setProducerCount - Sets the count/level for a producer ID.
   * @param {Function} options.getTreesState - Gets the current trees allocation state.
   * @param {Function} options.setTreeAllocation - Sets allocation for a tree.
   * @param {Function} options.onUpgrade - Callback when an item is upgraded.
   */
  constructor(options = {}) {
    this.toggleButton = options.toggleButton || null;
    this.dropdownContainer = options.dropdownContainer || null;
    this.emptyMessage = options.emptyMessage || null;
    this.itemsList = options.itemsList || null;

    this.getScintillaeBalance = typeof options.getScintillaeBalance === 'function'
      ? options.getScintillaeBalance
      : () => 0;
    this.spendScintillae = typeof options.spendScintillae === 'function'
      ? options.spendScintillae
      : () => 0;
    this.getProducerCount = typeof options.getProducerCount === 'function'
      ? options.getProducerCount
      : () => 0;
    this.setProducerCount = typeof options.setProducerCount === 'function'
      ? options.setProducerCount
      : () => {};
    this.getTreesState = typeof options.getTreesState === 'function'
      ? options.getTreesState
      : () => ({});
    this.setTreeAllocation = typeof options.setTreeAllocation === 'function'
      ? options.setTreeAllocation
      : () => {};
    this.onUpgrade = typeof options.onUpgrade === 'function'
      ? options.onUpgrade
      : () => {};

    this.isOpen = false;
    this.itemElements = new Map();

    this.handleToggle = this.handleToggle.bind(this);
    this.attachEvents();
  }

  /**
   * Attach event listeners for the toggle button.
   */
  attachEvents() {
    if (this.toggleButton) {
      this.toggleButton.addEventListener('click', this.handleToggle);
    }
  }

  /**
   * Toggle the dropdown open/closed state.
   */
  handleToggle(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.isOpen = !this.isOpen;
    this.updateVisibility();
    if (this.isOpen) {
      this.refreshItems();
    }
  }

  /**
   * Update the visibility of the dropdown based on state.
   */
  updateVisibility() {
    if (this.toggleButton) {
      this.toggleButton.setAttribute('aria-expanded', this.isOpen ? 'true' : 'false');
    }
    if (this.dropdownContainer) {
      this.dropdownContainer.hidden = !this.isOpen;
      this.dropdownContainer.setAttribute('data-open', this.isOpen ? 'true' : 'false');
      this.dropdownContainer.setAttribute('aria-hidden', this.isOpen ? 'false' : 'true');
    }
  }

  /**
   * Collect all items from the terrarium and refresh the display.
   */
  refreshItems() {
    if (!this.itemsList) {
      return;
    }

    // Clear existing items
    this.itemsList.innerHTML = '';
    this.itemElements.clear();

    const items = this.collectItems();

    if (items.length === 0) {
      if (this.emptyMessage) {
        this.emptyMessage.hidden = false;
      }
      if (this.itemsList) {
        this.itemsList.hidden = true;
      }
      return;
    }

    if (this.emptyMessage) {
      this.emptyMessage.hidden = true;
    }
    if (this.itemsList) {
      this.itemsList.hidden = false;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const element = this.createItemElement(item);
      fragment.appendChild(element);
      this.itemElements.set(item.id, { element, item });
    });
    this.itemsList.appendChild(fragment);
  }

  /**
   * Collect all terrarium items with their current state.
   * @returns {Array<{id: string, label: string, icon: string, level: number, progress: number, nextCost: number, levelBased: boolean, treeKey?: string}>}
   */
  collectItems() {
    const items = [];

    // Collect producer-based items (slimes, shrooms)
    Object.values(PRODUCER_DEFINITIONS).forEach((producer) => {
      const count = this.getProducerCount(producer.id);
      if (count > 0) {
        items.push({
          id: producer.id,
          label: producer.label,
          icon: producer.icon || '',
          level: count,
          progress: 0,
          nextCost: this.calculateUpgradeCost(producer.id, count),
          levelBased: producer.levelBased,
        });
      }
    });

    // Collect tree items from tree state
    const treesState = this.getTreesState();
    if (treesState && typeof treesState === 'object') {
      Object.entries(treesState).forEach(([treeKey, treeData]) => {
        if (!treeData || typeof treeData.allocated !== 'number' || treeData.allocated <= 0) {
          return;
        }
        const levelInfo = resolveTerrariumTreeLevel(treeData.allocated);
        const isLarge = treeKey.includes('large') || treeKey.startsWith('large');
        const isSmall = treeKey.includes('small') || treeKey.startsWith('small');
        
        // Determine tree type from key
        let label = 'Fractal Tree';
        let icon = '🌳';
        if (isLarge) {
          label = 'Ancient Tree';
        } else if (isSmall) {
          label = 'Bonsai Tree';
          icon = '🌱';
        }

        const progressRatio = levelInfo.nextCost > 0
          ? levelInfo.progress / levelInfo.nextCost
          : 0;

        items.push({
          id: `tree-${treeKey}`,
          treeKey,
          label,
          icon,
          level: levelInfo.level,
          progress: progressRatio,
          progressRemaining: levelInfo.nextCost - levelInfo.progress,
          nextCost: levelInfo.nextCost - levelInfo.progress,
          allocated: treeData.allocated,
          levelBased: true,
        });
      });
    }

    return items;
  }

  /**
   * Calculate the upgrade cost for a producer.
   * @param {string} producerId
   * @param {number} currentLevel
   * @returns {number}
   */
  calculateUpgradeCost(producerId, currentLevel) {
    // Basic doubling cost formula: starts at 1, doubles each level
    // This matches the resolveTerrariumTreeLevel formula
    let cost = 1;
    for (let i = 0; i < currentLevel; i++) {
      cost *= 2;
    }
    return cost;
  }

  /**
   * Create a DOM element for an item in the dropdown list.
   * @param {object} item
   * @returns {HTMLElement}
   */
  createItemElement(item) {
    const li = document.createElement('li');
    li.className = 'fluid-terrarium-items-list__item';
    li.dataset.itemId = item.id;

    // Header with name and level
    const header = document.createElement('div');
    header.className = 'fluid-terrarium-items-list__header';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'fluid-terrarium-items-list__name';
    nameSpan.textContent = `${item.icon} ${item.label}`;
    header.appendChild(nameSpan);

    const levelSpan = document.createElement('span');
    levelSpan.className = 'fluid-terrarium-items-list__level';
    levelSpan.textContent = item.levelBased ? `Lv. ${item.level}` : `×${item.level}`;
    header.appendChild(levelSpan);

    li.appendChild(header);

    // Progress bar (for level-based items)
    if (item.levelBased) {
      const progressContainer = document.createElement('div');
      progressContainer.className = 'fluid-terrarium-items-list__progress';

      const progressBar = document.createElement('div');
      progressBar.className = 'fluid-terrarium-items-list__progress-bar';

      const progressFill = document.createElement('div');
      progressFill.className = 'fluid-terrarium-items-list__progress-fill';
      progressFill.style.width = `${Math.round((item.progress || 0) * 100)}%`;
      progressBar.appendChild(progressFill);
      progressContainer.appendChild(progressBar);

      const progressText = document.createElement('span');
      progressText.className = 'fluid-terrarium-items-list__progress-text';
      progressText.textContent = `${item.nextCost} to next`;
      progressContainer.appendChild(progressText);

      li.appendChild(progressContainer);
    }

    // Upgrade button
    const upgradeBtn = document.createElement('button');
    upgradeBtn.type = 'button';
    upgradeBtn.className = 'fluid-terrarium-items-list__upgrade-btn';
    upgradeBtn.textContent = `Upgrade (${item.nextCost} Scintillae)`;
    upgradeBtn.disabled = this.getScintillaeBalance() < item.nextCost;
    upgradeBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.handleUpgrade(item);
    });
    li.appendChild(upgradeBtn);

    return li;
  }

  /**
   * Handle upgrade button click for an item.
   * @param {object} item
   */
  handleUpgrade(item) {
    const balance = this.getScintillaeBalance();
    const cost = Math.max(1, item.nextCost);

    if (balance < cost) {
      return;
    }

    const spent = this.spendScintillae(cost);
    if (spent < cost) {
      return;
    }

    // Apply the upgrade based on item type
    if (item.treeKey) {
      // Tree upgrade: add to allocation
      const currentAllocated = item.allocated || 0;
      this.setTreeAllocation(item.treeKey, currentAllocated + cost);
    } else {
      // Producer upgrade: increment level/count
      const currentLevel = this.getProducerCount(item.id);
      this.setProducerCount(item.id, currentLevel + 1);
    }

    // Notify parent of upgrade
    this.onUpgrade(item);

    // Refresh the display
    this.refreshItems();
  }

  /**
   * Update all items in the dropdown (call periodically or on state change).
   */
  update() {
    if (this.isOpen) {
      this.refreshItems();
    }
  }

  /**
   * Clean up event listeners.
   */
  destroy() {
    if (this.toggleButton) {
      this.toggleButton.removeEventListener('click', this.handleToggle);
    }
    this.itemElements.clear();
  }
}
