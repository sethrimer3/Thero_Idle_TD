/**
 * Cardinal Warden UI Management
 *
 * Handles the UI integration for the Cardinal Warden reverse danmaku game
 * within the Shin Spire panel. The game auto-starts without a menu and
 * smoothly restarts after death with animations.
 */

import { CardinalWardenSimulation, getWeaponIds, getWeaponDefinition } from '../scripts/features/towers/cardinalWardenSimulation.js';
import { formatGameNumber } from '../scripts/core/formatting.js';
import { getShinGlyphs, addShinGlyphs, getIteronBank, spendIterons, addIterons } from './shinState.js';

// Cardinal Warden simulation instance
let cardinalSimulation = null;
let cardinalResizeObserver = null;

// DOM element references
const cardinalElements = {
  canvas: null,
  overlay: null,
  startButton: null,
  resultPanel: null,
  resultScore: null,
  resultHigh: null,
  resultWave: null,
  restartButton: null,
  glyphCount: null,
  waveDisplay: null,
  highestWaveDisplay: null,
  weaponsGrid: null,
  totalIterons: null,
  baseHealthDisplay: null,
  healthUpgradeBtn: null,
  healthUpgradeCost: null,
};

// State persistence key
const CARDINAL_STATE_STORAGE_KEY = 'theroIdle_cardinalWarden';

// High score and wave tracking
let cardinalHighScore = 0;
let cardinalHighestWave = 0;
// Track glyphs earned from waves to avoid double-counting
let glyphsAwardedFromWaves = 0;
// Weapon state
let weaponState = null;
// Base health upgrade level
let baseHealthLevel = 0;

/**
 * Initialize the Cardinal Warden UI and simulation.
 */
export function initializeCardinalWardenUI() {
  // Cache DOM elements
  cardinalElements.canvas = document.getElementById('shin-cardinal-canvas');
  cardinalElements.overlay = document.getElementById('shin-cardinal-overlay');
  cardinalElements.startButton = document.getElementById('shin-cardinal-start');
  cardinalElements.resultPanel = document.getElementById('shin-cardinal-result');
  cardinalElements.resultScore = document.getElementById('shin-cardinal-result-score');
  cardinalElements.resultHigh = document.getElementById('shin-cardinal-result-high');
  cardinalElements.resultWave = document.getElementById('shin-cardinal-result-wave');
  cardinalElements.restartButton = document.getElementById('shin-cardinal-restart');
  cardinalElements.glyphCount = document.getElementById('shin-glyph-count');
  cardinalElements.waveDisplay = document.getElementById('shin-wave-display');
  cardinalElements.highestWaveDisplay = document.getElementById('shin-highest-wave');
  cardinalElements.weaponsGrid = document.getElementById('shin-weapons-grid');
  cardinalElements.totalIterons = document.getElementById('shin-total-iterons');
  cardinalElements.baseHealthDisplay = document.getElementById('shin-base-health');
  cardinalElements.healthUpgradeBtn = document.getElementById('shin-health-upgrade-btn');
  cardinalElements.healthUpgradeCost = document.getElementById('shin-health-upgrade-cost');

  if (!cardinalElements.canvas) {
    console.warn('Cardinal Warden canvas not found');
    return;
  }

  // Load saved state
  loadCardinalState();

  // Set up resize observer for responsive canvas
  setupCardinalResizeObserver();

  // Initialize the canvas size
  resizeCardinalCanvas();

  // Create the simulation with auto-start
  createCardinalSimulation();

  // Hide the menu overlays and auto-start
  hideOverlays();
  
  // Start the game immediately
  if (cardinalSimulation) {
    cardinalSimulation.start();
  }
  
  // Initialize weapons menu
  initializeWeaponsMenu();
  
  // Initialize health upgrade button
  initializeHealthUpgradeButton();
  
  // Update displays
  updateWaveDisplay(0);
  updateHighestWaveDisplay();
  updateGlyphDisplay();
  updateTotalIteronsDisplay();
  updateWeaponsDisplay();
  updateBaseHealthDisplay();
}

/**
 * Load persisted Cardinal Warden state.
 */
function loadCardinalState() {
  try {
    const saved = localStorage.getItem(CARDINAL_STATE_STORAGE_KEY);
    if (saved) {
      const state = JSON.parse(saved);
      cardinalHighScore = state.highScore || 0;
      cardinalHighestWave = state.highestWave || 0;
      glyphsAwardedFromWaves = state.glyphsAwardedFromWaves || 0;
      weaponState = state.weapons || null;
      baseHealthLevel = state.baseHealthLevel || 0;
    }
  } catch (error) {
    console.warn('Failed to load Cardinal Warden state:', error);
  }
}

/**
 * Save Cardinal Warden state.
 */
function saveCardinalState() {
  try {
    const state = {
      highScore: cardinalHighScore,
      highestWave: cardinalHighestWave,
      glyphsAwardedFromWaves: glyphsAwardedFromWaves,
      weapons: cardinalSimulation ? cardinalSimulation.getWeaponState() : weaponState,
      baseHealthLevel: cardinalSimulation ? cardinalSimulation.getBaseHealthLevel() : baseHealthLevel,
    };
    localStorage.setItem(CARDINAL_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save Cardinal Warden state:', error);
  }
}

/**
 * Set up resize observer for the Cardinal viewport.
 */
function setupCardinalResizeObserver() {
  if (cardinalResizeObserver) {
    cardinalResizeObserver.disconnect();
  }

  const viewport = cardinalElements.canvas?.parentElement;
  if (!viewport || typeof ResizeObserver !== 'function') {
    return;
  }

  cardinalResizeObserver = new ResizeObserver(() => {
    resizeCardinalCanvas();
  });

  cardinalResizeObserver.observe(viewport);
}

/**
 * Resize the Cardinal Warden canvas to fill its viewport.
 */
export function resizeCardinalCanvas() {
  const canvas = cardinalElements.canvas;
  if (!canvas) return;

  const viewport = canvas.parentElement;
  if (!viewport) return;

  const rect = viewport.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  const cssWidth = Math.max(1, rect.width);
  const cssHeight = Math.max(1, rect.height);
  const targetWidth = Math.max(1, Math.round(cssWidth * dpr));
  const targetHeight = Math.max(1, Math.round(cssHeight * dpr));

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Notify the simulation of the resize
    if (cardinalSimulation) {
      cardinalSimulation.resize(targetWidth, targetHeight);
    }
  }
}

/**
 * Create the Cardinal Warden simulation instance.
 */
function createCardinalSimulation() {
  if (!cardinalElements.canvas) return;

  cardinalSimulation = new CardinalWardenSimulation({
    canvas: cardinalElements.canvas,
    highScore: cardinalHighScore,
    highestWave: cardinalHighestWave,
    baseHealthLevel: baseHealthLevel,
    autoStart: true,
    onScoreChange: handleScoreChange,
    onHighScoreChange: handleHighScoreChange,
    onWaveChange: handleWaveChange,
    onGameOver: handleGameOver,
    onHealthChange: handleHealthChange,
    onHighestWaveChange: handleHighestWaveChange,
    onWeaponChange: handleWeaponChange,
  });
  
  // Restore weapon state if available
  if (weaponState) {
    cardinalSimulation.setWeaponState(weaponState);
  }
}

/**
 * Hide all overlays and show the game.
 */
function hideOverlays() {
  if (cardinalElements.overlay) {
    cardinalElements.overlay.hidden = true;
  }
  if (cardinalElements.resultPanel) {
    cardinalElements.resultPanel.hidden = true;
  }
}

/**
 * Stop the Cardinal Warden simulation.
 */
export function stopCardinalSimulation() {
  if (cardinalSimulation) {
    cardinalSimulation.stop();
  }
}

/**
 * Handle score changes.
 */
function handleScoreChange(score) {
  // Score is displayed in the canvas UI, no external element needed
  // Update weapons display to reflect purchasable/upgradeable states
  updateWeaponsDisplay();
}

/**
 * Handle high score changes.
 */
function handleHighScoreChange(highScore) {
  cardinalHighScore = highScore;
  saveCardinalState();
}

/**
 * Handle wave changes.
 */
function handleWaveChange(wave) {
  updateWaveDisplay(wave);
}

/**
 * Handle highest wave changes - this awards Shin Glyphs incrementally.
 * Only awards the difference between new and previously awarded glyphs.
 */
function handleHighestWaveChange(highestWave) {
  cardinalHighestWave = highestWave;
  
  // Calculate how many new glyphs to award (highest wave - already awarded)
  const newGlyphsToAward = highestWave - glyphsAwardedFromWaves;
  if (newGlyphsToAward > 0) {
    addShinGlyphs(newGlyphsToAward);
    glyphsAwardedFromWaves = highestWave;
  }
  
  saveCardinalState();
  updateHighestWaveDisplay();
  updateGlyphDisplay();
}

/**
 * Handle game over.
 * Note: The simulation now handles death/respawn animations internally,
 * so we don't show a result panel overlay.
 */
function handleGameOver(data) {
  // Update tracking
  if (data.isNewHighScore) {
    cardinalHighScore = data.highScore;
  }
  if (data.highestWave !== undefined && data.highestWave > cardinalHighestWave) {
    cardinalHighestWave = data.highestWave;
    // Award incremental glyphs based on highest wave
    const newGlyphsToAward = data.highestWave - glyphsAwardedFromWaves;
    if (newGlyphsToAward > 0) {
      addShinGlyphs(newGlyphsToAward);
      glyphsAwardedFromWaves = data.highestWave;
    }
    updateGlyphDisplay();
  }
  saveCardinalState();
  updateHighestWaveDisplay();
}

/**
 * Handle health changes.
 */
function handleHealthChange(health, maxHealth) {
  // Health bar is rendered in the canvas UI
}

/**
 * Update the current wave display.
 */
function updateWaveDisplay(wave) {
  if (cardinalElements.waveDisplay) {
    cardinalElements.waveDisplay.textContent = `Wave ${wave + 1}`;
  }
}

/**
 * Update the highest wave display.
 */
function updateHighestWaveDisplay() {
  if (cardinalElements.highestWaveDisplay) {
    cardinalElements.highestWaveDisplay.textContent = formatGameNumber(cardinalHighestWave);
  }
}

/**
 * Update the glyph count display.
 */
function updateGlyphDisplay() {
  if (cardinalElements.glyphCount) {
    const glyphs = getShinGlyphs();
    cardinalElements.glyphCount.textContent = `${formatGameNumber(glyphs)} ש`;
  }
}

/**
 * Update the total iterons display.
 */
function updateTotalIteronsDisplay() {
  if (cardinalElements.totalIterons) {
    const iterons = getIteronBank();
    cardinalElements.totalIterons.textContent = `${formatGameNumber(iterons)} ℸ`;
  }
  // Also update health upgrade button state
  updateBaseHealthDisplay();
}

/**
 * Initialize the health upgrade button.
 */
function initializeHealthUpgradeButton() {
  if (!cardinalElements.healthUpgradeBtn) return;
  
  cardinalElements.healthUpgradeBtn.addEventListener('click', () => {
    if (upgradeCardinalBaseHealth()) {
      updateBaseHealthDisplay();
    }
  });
}

/**
 * Update the base health display and upgrade button.
 */
function updateBaseHealthDisplay() {
  const maxHealth = getCardinalMaxHealth();
  const upgradeCost = getCardinalBaseHealthUpgradeCost();
  const currentIterons = getIteronBank();
  const canAfford = currentIterons >= upgradeCost;
  
  if (cardinalElements.baseHealthDisplay) {
    cardinalElements.baseHealthDisplay.textContent = formatGameNumber(maxHealth);
  }
  
  if (cardinalElements.healthUpgradeCost) {
    cardinalElements.healthUpgradeCost.textContent = formatGameNumber(upgradeCost);
  }
  
  if (cardinalElements.healthUpgradeBtn) {
    cardinalElements.healthUpgradeBtn.disabled = !canAfford;
  }
}

/**
 * Get the current Cardinal Warden state for persistence.
 */
export function getCardinalWardenState() {
  return {
    highScore: cardinalHighScore,
    highestWave: cardinalHighestWave,
    glyphsAwardedFromWaves: glyphsAwardedFromWaves,
  };
}

/**
 * Restore Cardinal Warden state.
 */
export function setCardinalWardenState(state) {
  if (state?.highScore !== undefined) {
    cardinalHighScore = state.highScore;
    if (cardinalSimulation) {
      cardinalSimulation.setHighScore(cardinalHighScore);
    }
  }
  if (state?.highestWave !== undefined) {
    cardinalHighestWave = state.highestWave;
    if (cardinalSimulation) {
      cardinalSimulation.setHighestWave(cardinalHighestWave);
    }
  }
  if (state?.glyphsAwardedFromWaves !== undefined) {
    glyphsAwardedFromWaves = state.glyphsAwardedFromWaves;
  }
  // Ensure glyphs awarded matches highest wave if not set
  if (glyphsAwardedFromWaves < cardinalHighestWave) {
    const newGlyphs = cardinalHighestWave - glyphsAwardedFromWaves;
    addShinGlyphs(newGlyphs);
    glyphsAwardedFromWaves = cardinalHighestWave;
  }
  updateHighestWaveDisplay();
  updateGlyphDisplay();
}

/**
 * Handle weapon state changes.
 */
function handleWeaponChange(weapons) {
  weaponState = weapons;
  saveCardinalState();
  updateWeaponsDisplay();
}

/**
 * Initialize the weapons menu.
 */
function initializeWeaponsMenu() {
  if (!cardinalElements.weaponsGrid) return;
  
  // Set up event delegation for weapon buttons
  cardinalElements.weaponsGrid.addEventListener('click', (event) => {
    const button = event.target.closest('.shin-weapon-action');
    if (!button || !cardinalSimulation) return;
    
    const weaponId = button.dataset.weaponId;
    const action = button.dataset.action;
    
    // Get weapons list once for all actions
    const weapons = cardinalSimulation.getAvailableWeapons();
    const weapon = weapons.find(w => w.id === weaponId);
    if (!weapon) return;
    
    if (action === 'purchase') {
      // Use iterons instead of score for weapon purchases
      if (!weapon.isPurchased && spendIterons(weapon.cost)) {
        // Mark weapon as purchased in the simulation (without spending score)
        cardinalSimulation.purchaseWeaponWithoutCost(weaponId);
        updateWeaponsDisplay();
        updateTotalIteronsDisplay();
      }
    } else if (action === 'upgrade') {
      // Use iterons instead of score for weapon upgrades
      if (weapon.isPurchased && weapon.upgradeCost !== null && spendIterons(weapon.upgradeCost)) {
        // Upgrade weapon in the simulation (without spending score)
        cardinalSimulation.upgradeWeaponWithoutCost(weaponId);
        updateWeaponsDisplay();
        updateTotalIteronsDisplay();
      }
    } else if (action === 'equip') {
      // Equip the weapon if not already equipped and space available
      if (weapon.canEquip) {
        cardinalSimulation.equipWeapon(weaponId);
        updateWeaponsDisplay();
      }
    } else if (action === 'unequip') {
      // Unequip the weapon (must keep at least 1 equipped)
      if (weapon.canUnequip) {
        cardinalSimulation.unequipWeapon(weaponId);
        updateWeaponsDisplay();
      }
    }
  });
}

/**
 * Update the weapons display.
 */
function updateWeaponsDisplay() {
  if (!cardinalElements.weaponsGrid || !cardinalSimulation) return;
  
  const weapons = cardinalSimulation.getAvailableWeapons();
  const currentIterons = getIteronBank();
  
  const html = weapons.map(weapon => {
    const isLocked = !weapon.isPurchased;
    const isMaxed = weapon.isPurchased && weapon.level >= weapon.maxLevel;
    const canAffordPurchase = currentIterons >= weapon.cost;
    const canAffordUpgrade = weapon.upgradeCost !== null && currentIterons >= weapon.upgradeCost;
    
    let actionButton = '';
    let equipButton = '';
    
    if (isLocked) {
      actionButton = `
        <button 
          class="shin-weapon-action"
          data-weapon-id="${weapon.id}"
          data-action="purchase"
          ${!canAffordPurchase ? 'disabled' : ''}
        >
          Buy: ${formatGameNumber(weapon.cost)} ℸ
        </button>
      `;
    } else {
      // Show equip/unequip toggle for purchased weapons
      if (weapon.isEquipped) {
        equipButton = `
          <button 
            class="shin-weapon-action shin-weapon-action--equipped"
            data-weapon-id="${weapon.id}"
            data-action="unequip"
            ${!weapon.canUnequip ? 'disabled' : ''}
            title="${!weapon.canUnequip ? 'Must keep at least 1 weapon equipped' : 'Click to unequip'}"
          >
            ✓ Equipped
          </button>
        `;
      } else {
        equipButton = `
          <button 
            class="shin-weapon-action shin-weapon-action--unequipped"
            data-weapon-id="${weapon.id}"
            data-action="equip"
            ${!weapon.canEquip ? 'disabled' : ''}
            title="${!weapon.canEquip ? 'Max 3 weapons can be equipped' : 'Click to equip'}"
          >
            Equip
          </button>
        `;
      }
      
      if (isMaxed) {
        actionButton = `
          <button 
            class="shin-weapon-action shin-weapon-action--maxed"
            disabled
          >
            MAX
          </button>
        `;
      } else {
        actionButton = `
          <button 
            class="shin-weapon-action shin-weapon-action--owned"
            data-weapon-id="${weapon.id}"
            data-action="upgrade"
            ${!canAffordUpgrade ? 'disabled' : ''}
          >
            Upgrade: ${formatGameNumber(weapon.upgradeCost)} ℸ
          </button>
        `;
      }
    }
    
    return `
      <div class="shin-weapon-item ${isLocked ? 'shin-weapon-item--locked' : ''} ${weapon.isEquipped ? 'shin-weapon-item--equipped' : ''}" role="listitem">
        <div class="shin-weapon-header">
          <span class="shin-weapon-symbol" style="color: ${weapon.color}">${weapon.symbol}</span>
          <span class="shin-weapon-name">${weapon.name}</span>
          ${weapon.isPurchased ? `<span class="shin-weapon-level">Lv.${weapon.level}</span>` : ''}
        </div>
        <p class="shin-weapon-description">${weapon.description}</p>
        <div class="shin-weapon-buttons">
          ${equipButton}
          ${actionButton}
        </div>
      </div>
    `;
  }).join('');
  
  cardinalElements.weaponsGrid.innerHTML = html;
}

/**
 * Check if the Cardinal Warden simulation is running.
 */
export function isCardinalSimulationRunning() {
  return cardinalSimulation?.running || false;
}

/**
 * Get the highest wave reached in Cardinal Warden.
 * This is used for iteron generation rate (iterons per hour = highest wave).
 */
export function getCardinalHighestWave() {
  return cardinalHighestWave;
}

/**
 * Get the high score reached in Cardinal Warden.
 * Used for calculating idle iteron rate (high score / 10 = iterons per hour).
 */
export function getCardinalHighScore() {
  return cardinalHighScore;
}

/**
 * Get the current base health upgrade level.
 */
export function getCardinalBaseHealthLevel() {
  if (cardinalSimulation) {
    return cardinalSimulation.getBaseHealthLevel();
  }
  return baseHealthLevel;
}

/**
 * Get the cost to upgrade base health to the next level (in iterons).
 */
export function getCardinalBaseHealthUpgradeCost() {
  if (cardinalSimulation) {
    return cardinalSimulation.getBaseHealthUpgradeCost();
  }
  // Default calculation if simulation not initialized
  return Math.floor(50 * Math.pow(1.5, baseHealthLevel));
}

/**
 * Get the current max health (base + upgrades).
 */
export function getCardinalMaxHealth() {
  if (cardinalSimulation) {
    return cardinalSimulation.getMaxHealth();
  }
  // Default calculation if simulation not initialized
  return 100 + baseHealthLevel * 10;
}

/**
 * Upgrade base health using iterons.
 * @returns {boolean} True if upgrade was successful
 */
export function upgradeCardinalBaseHealth() {
  if (!cardinalSimulation) return false;
  
  const cost = cardinalSimulation.getBaseHealthUpgradeCost();
  if (!spendIterons(cost)) return false;
  
  cardinalSimulation.upgradeBaseHealth();
  baseHealthLevel = cardinalSimulation.getBaseHealthLevel();
  saveCardinalState();
  updateTotalIteronsDisplay();
  
  return true;
}

/**
 * Get the Cardinal Warden simulation instance.
 * Used for connecting visual preferences to the simulation.
 */
export function getCardinalSimulation() {
  return cardinalSimulation;
}

/**
 * Clean up resources.
 */
export function cleanupCardinalWarden() {
  if (cardinalSimulation) {
    cardinalSimulation.stop();
    cardinalSimulation = null;
  }

  if (cardinalResizeObserver) {
    cardinalResizeObserver.disconnect();
    cardinalResizeObserver = null;
  }
}
