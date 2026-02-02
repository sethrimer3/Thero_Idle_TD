'use strict';

/**
 * Fluid Terrarium Foundry - Production menu system for the Bet Terrarium
 * 
 * The foundry is a clickable structure that opens a production menu with:
 * - Top button: Upgrade foundry (Level I → II → III)
 * - Bottom button: Create solar mirror (costs 300 sun)
 * - Left button: Upgrade structures (3 tiers, gated by foundry level)
 * - Right button: Upgrade starlings (3 tiers, gated by foundry level, changes sprites)
 * 
 * Upgrade gating:
 * - Foundry starts at level 1
 * - Foundry can be upgraded to level 2 and 3 without buying structure/starling upgrades
 * - Structure/starling tier 1 available at foundry level 1
 * - Structure/starling tier 2 available at foundry level 2
 * - Structure/starling tier 3 available at foundry level 3
 */

/** Roman numeral conversion for level display */
function toRomanNumeral(level) {
  const map = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
  return map[level] || level.toString();
}

/**
 * Manages foundry instances in the terrarium.
 * Handles placement, click interactions, and production menu display.
 */
export class FluidTerrariumFoundry {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - Parent container for foundry elements
   * @param {Function} options.getSunBalance - Returns current sun resource count
   * @param {Function} options.spendSun - Spends sun; returns amount spent
   * @param {Function} options.addSun - Adds sun to balance
   * @param {Function} options.getFoundryState - Returns current foundry state
   * @param {Function} options.setFoundryState - Updates foundry state
   * @param {Function} options.onUpgrade - Callback when upgrades occur
   * @param {Function} options.onStarlingUpgrade - Callback when starlings are upgraded (for sprite changes)
   */
  constructor(options = {}) {
    this.container = options.container || null;
    this.getSunBalance = typeof options.getSunBalance === 'function' ? options.getSunBalance : () => 0;
    this.spendSun = typeof options.spendSun === 'function' ? options.spendSun : () => 0;
    this.addSun = typeof options.addSun === 'function' ? options.addSun : () => {};
    this.getFoundryState = typeof options.getFoundryState === 'function' ? options.getFoundryState : () => ({});
    this.setFoundryState = typeof options.setFoundryState === 'function' ? options.setFoundryState : () => {};
    this.onUpgrade = typeof options.onUpgrade === 'function' ? options.onUpgrade : () => {};
    this.onStarlingUpgrade = typeof options.onStarlingUpgrade === 'function' ? options.onStarlingUpgrade : () => {};

    // Track placed foundries
    this.placements = new Map(); // placementId → {element, point, state}
    
    // Production menu element (shared across all foundries)
    this.productionMenu = null;
    this.currentFoundryId = null;

    // Bind methods
    this.handleFoundryClick = this.handleFoundryClick.bind(this);
    this.handleMenuClose = this.handleMenuClose.bind(this);
  }

  /**
   * Place a foundry in the terrarium.
   * @param {Object} placement
   * @param {string} placement.placementId - Unique ID for this foundry
   * @param {Object} placement.point - Normalized placement point {xRatio, yRatio}
   * @param {Object} placement.storeItem - Store item definition
   * @returns {boolean} True if placement succeeded
   */
  place({ placementId, point, storeItem }) {
    if (!this.container || !placementId || !point) {
      return false;
    }

    // Initialize foundry state if not exists
    const state = this.getFoundryState();
    if (!state[placementId]) {
      const newState = {
        ...state,
        [placementId]: {
          level: 1,
          structureLevel: 0,
          starlingLevel: 0,
        },
      };
      this.setFoundryState(newState);
    }

    // Create foundry element
    const element = this.createFoundryElement(placementId, point, storeItem);
    
    // Store placement data
    this.placements.set(placementId, {
      element,
      point,
      state: state[placementId],
    });

    return true;
  }

  /**
   * Create the visual element for a foundry at the specified point.
   * @param {string} placementId
   * @param {Object} point - {xRatio, yRatio}
   * @param {Object} storeItem
   * @returns {HTMLElement}
   */
  createFoundryElement(placementId, point, storeItem) {
    const element = document.createElement('button');
    element.className = 'fluid-terrarium-foundry';
    element.dataset.placementId = placementId;
    element.textContent = '⚒️';
    element.title = 'Foundry - Click to open production menu';
    element.type = 'button';
    
    // Position element (convert normalized ratio to percentage)
    element.style.position = 'absolute';
    element.style.left = `${point.xRatio * 100}%`;
    element.style.top = `${point.yRatio * 100}%`;
    element.style.transform = 'translate(-50%, -50%)';
    
    // Add click handler
    element.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleFoundryClick(placementId);
    });

    // Append to container
    if (this.container) {
      this.container.appendChild(element);
    }

    return element;
  }

  /**
   * Handle foundry click - opens production menu.
   * @param {string} placementId
   */
  handleFoundryClick(placementId) {
    this.currentFoundryId = placementId;
    this.openProductionMenu(placementId);
  }

  /**
   * Open the production menu for a foundry.
   * @param {string} foundryId
   */
  openProductionMenu(foundryId) {
    const state = this.getFoundryState();
    const foundryState = state[foundryId];
    
    if (!foundryState) {
      console.warn('Foundry state not found:', foundryId);
      return;
    }

    // Create or update production menu
    if (!this.productionMenu) {
      this.createProductionMenu();
    }

    // Update menu content based on foundry state
    this.updateProductionMenu(foundryId, foundryState);

    // Show menu
    this.productionMenu.hidden = false;
    this.productionMenu.setAttribute('aria-hidden', 'false');
  }

  /**
   * Create the production menu DOM structure.
   */
  createProductionMenu() {
    const menu = document.createElement('div');
    menu.className = 'fluid-terrarium-foundry-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-modal', 'true');
    menu.setAttribute('aria-label', 'Foundry Production Menu');

    // Menu overlay (darkens background)
    const overlay = document.createElement('div');
    overlay.className = 'fluid-terrarium-foundry-menu__overlay';
    overlay.addEventListener('click', this.handleMenuClose);

    // Menu content container
    const content = document.createElement('div');
    content.className = 'fluid-terrarium-foundry-menu__content';

    // Title with foundry level
    const title = document.createElement('h3');
    title.className = 'fluid-terrarium-foundry-menu__title';
    title.textContent = 'Foundry';
    content.appendChild(title);

    // Sun balance display
    const balanceDisplay = document.createElement('div');
    balanceDisplay.className = 'fluid-terrarium-foundry-menu__balance';
    balanceDisplay.innerHTML = '<span class="foundry-balance-label">Sun:</span> <span class="foundry-balance-value">0</span>';
    content.appendChild(balanceDisplay);

    // Button grid (4 buttons in cross pattern)
    const buttonGrid = document.createElement('div');
    buttonGrid.className = 'fluid-terrarium-foundry-menu__buttons';

    // Top button: Upgrade Foundry
    const topButton = document.createElement('button');
    topButton.type = 'button';
    topButton.className = 'foundry-button foundry-button--top';
    topButton.dataset.action = 'upgrade-foundry';
    buttonGrid.appendChild(topButton);

    // Left button: Upgrade Structures
    const leftButton = document.createElement('button');
    leftButton.type = 'button';
    leftButton.className = 'foundry-button foundry-button--left';
    leftButton.dataset.action = 'upgrade-structures';
    buttonGrid.appendChild(leftButton);

    // Center: Foundry icon (non-interactive)
    const centerIcon = document.createElement('div');
    centerIcon.className = 'foundry-button foundry-button--center';
    centerIcon.textContent = '⚒️';
    centerIcon.setAttribute('aria-hidden', 'true');
    buttonGrid.appendChild(centerIcon);

    // Right button: Upgrade Starlings
    const rightButton = document.createElement('button');
    rightButton.type = 'button';
    rightButton.className = 'foundry-button foundry-button--right';
    rightButton.dataset.action = 'upgrade-starlings';
    buttonGrid.appendChild(rightButton);

    // Bottom button: Create Solar Mirror
    const bottomButton = document.createElement('button');
    bottomButton.type = 'button';
    bottomButton.className = 'foundry-button foundry-button--bottom';
    bottomButton.dataset.action = 'create-mirror';
    buttonGrid.appendChild(bottomButton);

    content.appendChild(buttonGrid);

    // Close button
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'fluid-terrarium-foundry-menu__close';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', this.handleMenuClose);
    content.appendChild(closeButton);

    // Assemble menu
    menu.appendChild(overlay);
    menu.appendChild(content);

    // Attach event listeners to action buttons
    topButton.addEventListener('click', () => this.handleUpgradeFoundry());
    leftButton.addEventListener('click', () => this.handleUpgradeStructures());
    rightButton.addEventListener('click', () => this.handleUpgradeStarlings());
    bottomButton.addEventListener('click', () => this.handleCreateMirror());

    // Add to document
    document.body.appendChild(menu);

    this.productionMenu = menu;
  }

  /**
   * Update production menu content based on foundry state.
   * @param {string} foundryId
   * @param {Object} foundryState
   */
  updateProductionMenu(foundryId, foundryState) {
    if (!this.productionMenu) return;

    const { level, structureLevel, starlingLevel } = foundryState;
    const sunBalance = this.getSunBalance();

    // Update title
    const title = this.productionMenu.querySelector('.fluid-terrarium-foundry-menu__title');
    if (title) {
      title.textContent = `Foundry ${toRomanNumeral(level)}`;
    }

    // Update sun balance
    const balanceValue = this.productionMenu.querySelector('.foundry-balance-value');
    if (balanceValue) {
      balanceValue.textContent = Math.floor(sunBalance).toString();
    }

    // Update top button (Upgrade Foundry)
    const topButton = this.productionMenu.querySelector('[data-action="upgrade-foundry"]');
    if (topButton) {
      if (level >= 3) {
        topButton.textContent = 'Foundry Max Level';
        topButton.disabled = true;
      } else {
        const cost = this.getFoundryUpgradeCost(level);
        topButton.textContent = `Upgrade to ${toRomanNumeral(level + 1)} (${cost} sun)`;
        topButton.disabled = sunBalance < cost;
      }
    }

    // Update left button (Upgrade Structures)
    const leftButton = this.productionMenu.querySelector('[data-action="upgrade-structures"]');
    if (leftButton) {
      const maxTier = this.getMaxAvailableTier(level);
      if (structureLevel >= maxTier) {
        leftButton.textContent = `Structures ${toRomanNumeral(structureLevel)}`;
        leftButton.disabled = true;
        leftButton.title = structureLevel >= 3 
          ? 'Max level reached' 
          : `Requires Foundry ${toRomanNumeral(structureLevel + 1)}`;
      } else {
        const cost = this.getStructureUpgradeCost(structureLevel);
        const nextLevel = structureLevel + 1;
        leftButton.textContent = `Structures ${toRomanNumeral(nextLevel)} (${cost} sun)`;
        leftButton.disabled = sunBalance < cost;
        leftButton.title = '';
      }
    }

    // Update right button (Upgrade Starlings)
    const rightButton = this.productionMenu.querySelector('[data-action="upgrade-starlings"]');
    if (rightButton) {
      const maxTier = this.getMaxAvailableTier(level);
      if (starlingLevel >= maxTier) {
        rightButton.textContent = `Starlings ${toRomanNumeral(starlingLevel)}`;
        rightButton.disabled = true;
        rightButton.title = starlingLevel >= 3 
          ? 'Max level reached' 
          : `Requires Foundry ${toRomanNumeral(starlingLevel + 1)}`;
      } else {
        const cost = this.getStarlingUpgradeCost(starlingLevel);
        const nextLevel = starlingLevel + 1;
        rightButton.textContent = `Starlings ${toRomanNumeral(nextLevel)} (${cost} sun)`;
        rightButton.disabled = sunBalance < cost;
        rightButton.title = '';
      }
    }

    // Update bottom button (Create Solar Mirror)
    const bottomButton = this.productionMenu.querySelector('[data-action="create-mirror"]');
    if (bottomButton) {
      const cost = 300;
      bottomButton.textContent = `Solar Mirror (${cost} sun)`;
      bottomButton.disabled = sunBalance < cost;
    }
  }

  /**
   * Get the maximum upgrade tier available based on foundry level.
   * @param {number} foundryLevel
   * @returns {number} Max tier (1-3)
   */
  getMaxAvailableTier(foundryLevel) {
    return Math.min(3, foundryLevel);
  }

  /**
   * Get the cost to upgrade the foundry to the next level.
   * @param {number} currentLevel
   * @returns {number}
   */
  getFoundryUpgradeCost(currentLevel) {
    const costs = { 1: 500, 2: 1000 };
    return costs[currentLevel] || 0;
  }

  /**
   * Get the cost to upgrade structures to the next tier.
   * @param {number} currentTier
   * @returns {number}
   */
  getStructureUpgradeCost(currentTier) {
    const costs = { 0: 200, 1: 400, 2: 800 };
    return costs[currentTier] || 0;
  }

  /**
   * Get the cost to upgrade starlings to the next tier.
   * @param {number} currentTier
   * @returns {number}
   */
  getStarlingUpgradeCost(currentTier) {
    const costs = { 0: 200, 1: 400, 2: 800 };
    return costs[currentTier] || 0;
  }

  /**
   * Handle foundry upgrade.
   */
  handleUpgradeFoundry() {
    if (!this.currentFoundryId) return;

    const state = this.getFoundryState();
    const foundryState = state[this.currentFoundryId];
    
    if (!foundryState || foundryState.level >= 3) return;

    const cost = this.getFoundryUpgradeCost(foundryState.level);
    const spent = this.spendSun(cost);
    
    if (spent < cost) {
      console.warn('Insufficient sun for foundry upgrade');
      return;
    }

    // Upgrade foundry
    foundryState.level += 1;
    this.setFoundryState(state);

    // Notify callback
    this.onUpgrade({
      type: 'foundry',
      foundryId: this.currentFoundryId,
      newLevel: foundryState.level,
    });

    // Refresh menu
    this.updateProductionMenu(this.currentFoundryId, foundryState);
  }

  /**
   * Handle structure upgrade.
   */
  handleUpgradeStructures() {
    if (!this.currentFoundryId) return;

    const state = this.getFoundryState();
    const foundryState = state[this.currentFoundryId];
    
    if (!foundryState) return;

    const maxTier = this.getMaxAvailableTier(foundryState.level);
    if (foundryState.structureLevel >= maxTier) return;

    const cost = this.getStructureUpgradeCost(foundryState.structureLevel);
    const spent = this.spendSun(cost);
    
    if (spent < cost) {
      console.warn('Insufficient sun for structure upgrade');
      return;
    }

    // Upgrade structures
    foundryState.structureLevel += 1;
    this.setFoundryState(state);

    // Notify callback
    this.onUpgrade({
      type: 'structures',
      foundryId: this.currentFoundryId,
      newLevel: foundryState.structureLevel,
    });

    // Refresh menu
    this.updateProductionMenu(this.currentFoundryId, foundryState);
  }

  /**
   * Handle starling upgrade.
   */
  handleUpgradeStarlings() {
    if (!this.currentFoundryId) return;

    const state = this.getFoundryState();
    const foundryState = state[this.currentFoundryId];
    
    if (!foundryState) return;

    const maxTier = this.getMaxAvailableTier(foundryState.level);
    if (foundryState.starlingLevel >= maxTier) return;

    const cost = this.getStarlingUpgradeCost(foundryState.starlingLevel);
    const spent = this.spendSun(cost);
    
    if (spent < cost) {
      console.warn('Insufficient sun for starling upgrade');
      return;
    }

    // Upgrade starlings
    foundryState.starlingLevel += 1;
    this.setFoundryState(state);

    // Notify starling sprite change
    // Starling level 0 → sprite level 1
    // Starling level 1 → sprite level 2
    // Starling level 2 → sprite level 3
    // Starling level 3 → sprite level 4
    const spriteLevel = foundryState.starlingLevel + 1;
    this.onStarlingUpgrade({
      foundryId: this.currentFoundryId,
      starlingLevel: foundryState.starlingLevel,
      spriteLevel,
    });

    // Notify callback
    this.onUpgrade({
      type: 'starlings',
      foundryId: this.currentFoundryId,
      newLevel: foundryState.starlingLevel,
      spriteLevel,
    });

    // Refresh menu
    this.updateProductionMenu(this.currentFoundryId, foundryState);
  }

  /**
   * Handle solar mirror creation.
   */
  handleCreateMirror() {
    const cost = 300;
    const spent = this.spendSun(cost);
    
    if (spent < cost) {
      console.warn('Insufficient sun for solar mirror');
      return;
    }

    // Notify callback (parent can handle mirror creation logic)
    this.onUpgrade({
      type: 'solar-mirror',
      foundryId: this.currentFoundryId,
    });

    // Refresh menu to update balance
    if (this.currentFoundryId) {
      const state = this.getFoundryState();
      const foundryState = state[this.currentFoundryId];
      if (foundryState) {
        this.updateProductionMenu(this.currentFoundryId, foundryState);
      }
    }
  }

  /**
   * Close the production menu.
   */
  handleMenuClose() {
    if (this.productionMenu) {
      this.productionMenu.hidden = true;
      this.productionMenu.setAttribute('aria-hidden', 'true');
    }
    this.currentFoundryId = null;
  }

  /**
   * Refresh all foundry elements (e.g., after state changes).
   */
  refresh() {
    this.placements.forEach((placement, placementId) => {
      const state = this.getFoundryState();
      const foundryState = state[placementId];
      if (foundryState) {
        placement.state = foundryState;
      }
    });

    // Update menu if open
    if (this.currentFoundryId && this.productionMenu && !this.productionMenu.hidden) {
      const state = this.getFoundryState();
      const foundryState = state[this.currentFoundryId];
      if (foundryState) {
        this.updateProductionMenu(this.currentFoundryId, foundryState);
      }
    }
  }

  /**
   * Clean up all foundry elements and event listeners.
   */
  destroy() {
    // Remove all foundry elements
    this.placements.forEach((placement) => {
      if (placement.element && placement.element.parentNode) {
        placement.element.parentNode.removeChild(placement.element);
      }
    });
    this.placements.clear();

    // Remove production menu
    if (this.productionMenu && this.productionMenu.parentNode) {
      this.productionMenu.parentNode.removeChild(this.productionMenu);
    }
    this.productionMenu = null;
    this.currentFoundryId = null;
  }
}
