/**
 * Cardinal Warden UI Management
 *
 * Handles the UI integration for the Cardinal Warden reverse danmaku game
 * within the Shin Spire panel. The game auto-starts without a menu and
 * smoothly restarts after death with animations.
 */

import { CardinalWardenSimulation, getWeaponIds, getWeaponDefinition } from '../scripts/features/towers/cardinalWardenSimulation.js';
import { formatGameNumber } from '../scripts/core/formatting.js';
import { 
  getShinGlyphs, 
  addShinGlyphs, 
  getIteronBank, 
  spendIterons, 
  addIterons,
  spawnPhonemeDrop,
  getActivePhonemeDrops,
  collectPhonemeDrop,
  clearActivePhonemeDrops,
  getPhonemeCount,
  getPhonemeCountsByChar,
  getGraphemeDropChance,
  unlockNextGrapheme,
  getGraphemeUnlockCost,
  upgradeDropChance,
  getDropChanceUpgradeCost,
  getDropChanceUpgradeLevel,
  getUnlockedGraphemes,
  getEquivalenceBank,
} from './shinState.js';

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
  phonemeInventory: null,
  phonemeCount: null,
  unlockedCount: null,
  graphemeUnlockBtn: null,
  graphemeUnlockCost: null,
  dropChanceDisplay: null,
  dropChanceUpgradeBtn: null,
  dropChanceCost: null,
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
  cardinalElements.weaponsGrid = document.getElementById('shin-weapon-slots-container');
  cardinalElements.totalIterons = document.getElementById('shin-total-iterons');
  cardinalElements.baseHealthDisplay = document.getElementById('shin-base-health');
  cardinalElements.healthUpgradeBtn = document.getElementById('shin-health-upgrade-btn');
  cardinalElements.healthUpgradeCost = document.getElementById('shin-health-upgrade-cost');
  cardinalElements.phonemeInventory = document.getElementById('shin-phoneme-inventory');
  cardinalElements.phonemeCount = document.getElementById('shin-phoneme-count');
  cardinalElements.unlockedCount = document.getElementById('shin-unlocked-count');
  cardinalElements.graphemeUnlockBtn = document.getElementById('shin-grapheme-unlock-btn');
  cardinalElements.graphemeUnlockCost = document.getElementById('shin-grapheme-unlock-cost');
  cardinalElements.dropChanceDisplay = document.getElementById('shin-drop-chance-display');
  cardinalElements.dropChanceUpgradeBtn = document.getElementById('shin-drop-chance-upgrade-btn');
  cardinalElements.dropChanceCost = document.getElementById('shin-drop-chance-cost');

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
  
  // Initialize grapheme unlock and drop chance upgrade buttons
  initializeGraphemeUnlockButton();
  initializeDropChanceUpgradeButton();
  
  // Update displays
  updateWaveDisplay(0);
  updateHighestWaveDisplay();
  updateGlyphDisplay();
  updateTotalIteronsDisplay();
  updateWeaponsDisplay();
  updateBaseHealthDisplay();
  updatePhonemeInventoryDisplay();
  updateGraphemeUI();
  
  // Start weapon display update loop
  startWeaponDisplayLoop();
}

/**
 * Animation loop to update weapon slot displays with glow and cooldown.
 */
let weaponDisplayAnimationId = null;
function startWeaponDisplayLoop() {
  const updateLoop = () => {
    if (cardinalSimulation && cardinalElements.weaponsGrid) {
      // Update weapon display at ~10 FPS to show glow and cooldown
      updateWeaponsDisplay();
    }
    
    // Continue loop
    weaponDisplayAnimationId = requestAnimationFrame(updateLoop);
  };
  
  // Start the loop
  updateLoop();
}

/**
 * Stop the weapon display update loop.
 */
function stopWeaponDisplayLoop() {
  if (weaponDisplayAnimationId) {
    cancelAnimationFrame(weaponDisplayAnimationId);
    weaponDisplayAnimationId = null;
  }
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
    onEnemyKill: handleEnemyKill,
    onPostRender: renderPhonemeDrops,
  });
  
  // Restore weapon state if available
  if (weaponState) {
    cardinalSimulation.setWeaponState(weaponState);
  }
  
  // Set up click handler for phoneme collection
  setupPhonemeCollection();
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
 * Start/restart the Cardinal Warden simulation.
 * Used when returning to the Shin tab after the simulation was stopped.
 */
export function startCardinalSimulation() {
  if (cardinalSimulation && !cardinalSimulation.running) {
    cardinalSimulation.start();
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
  
  // Clear all uncollected phoneme drops when warden dies
  clearActivePhonemeDrops();
  
  saveCardinalState();
  updateHighestWaveDisplay();
}

/**
 * Handle enemy kills - spawn grapheme drops.
 * @param {number} x - X coordinate of killed enemy
 * @param {number} y - Y coordinate of killed enemy
 * @param {boolean} isBoss - Whether the killed enemy is a boss
 */
function handleEnemyKill(x, y, isBoss) {
  // Get current drop chance from state (starts at 1%, upgradable)
  // Bosses always drop graphemes
  const dropChance = isBoss ? 1.0 : getGraphemeDropChance();
  if (Math.random() < dropChance) {
    spawnPhonemeDrop(x, y); // Using legacy export which maps to spawnGraphemeDrop
    // Bosses drop additional graphemes
    if (isBoss) {
      // Bosses drop 2-4 extra graphemes in a small scatter pattern
      const extraDrops = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < extraDrops; i++) {
        const offsetX = (Math.random() - 0.5) * 40;
        const offsetY = (Math.random() - 0.5) * 40;
        spawnPhonemeDrop(x + offsetX, y + offsetY); // Using legacy export which maps to spawnGraphemeDrop
      }
    }
  }
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
  // Also update health upgrade button state and grapheme UI
  updateBaseHealthDisplay();
  updateGraphemeUI();
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
 * Initialize the grapheme unlock button.
 */
function initializeGraphemeUnlockButton() {
  if (!cardinalElements.graphemeUnlockBtn) return;
  
  cardinalElements.graphemeUnlockBtn.addEventListener('click', () => {
    const result = unlockNextGrapheme();
    if (result.success) {
      updateGraphemeUI();
      updateTotalIteronsDisplay();
      console.log(`Unlocked grapheme ${result.unlockedIndex}: ${result.grapheme.name}`);
    } else {
      console.log('Cannot unlock grapheme:', result.message);
    }
  });
}

/**
 * Initialize the drop chance upgrade button.
 */
function initializeDropChanceUpgradeButton() {
  if (!cardinalElements.dropChanceUpgradeBtn) return;
  
  cardinalElements.dropChanceUpgradeBtn.addEventListener('click', () => {
    const result = upgradeDropChance();
    if (result.success) {
      updateGraphemeUI();
      updateTotalIteronsDisplay();
      console.log(`Drop chance upgraded to ${(result.newDropChance * 100).toFixed(1)}%`);
    } else {
      console.log('Cannot upgrade drop chance:', result.message);
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
 * Update the grapheme UI displays.
 */
function updateGraphemeUI() {
  const unlockedGraphemes = getUnlockedGraphemes();
  const unlockCost = getGraphemeUnlockCost();
  const dropChance = getGraphemeDropChance();
  const dropChanceCost = getDropChanceUpgradeCost();
  const currentEquivalence = getEquivalenceBank();
  
  // Update unlocked count
  if (cardinalElements.unlockedCount) {
    cardinalElements.unlockedCount.textContent = unlockedGraphemes.length;
  }
  
  // Update unlock button
  if (cardinalElements.graphemeUnlockCost) {
    cardinalElements.graphemeUnlockCost.textContent = formatGameNumber(unlockCost);
  }
  
  if (cardinalElements.graphemeUnlockBtn) {
    const canAffordUnlock = currentEquivalence >= unlockCost;
    const allUnlocked = unlockedGraphemes.length >= 35;
    cardinalElements.graphemeUnlockBtn.disabled = !canAffordUnlock || allUnlocked;
    
    if (allUnlocked) {
      cardinalElements.graphemeUnlockBtn.textContent = 'All Graphemes Unlocked';
    } else {
      cardinalElements.graphemeUnlockBtn.innerHTML = `Unlock Next Grapheme: <span id="shin-grapheme-unlock-cost">${formatGameNumber(unlockCost)}</span> ℸ`;
      cardinalElements.graphemeUnlockCost = document.getElementById('shin-grapheme-unlock-cost');
    }
  }
  
  // Update drop chance display
  if (cardinalElements.dropChanceDisplay) {
    cardinalElements.dropChanceDisplay.textContent = `${(dropChance * 100).toFixed(1)}%`;
  }
  
  // Update drop chance upgrade button
  if (cardinalElements.dropChanceCost) {
    cardinalElements.dropChanceCost.textContent = formatGameNumber(dropChanceCost);
  }
  
  if (cardinalElements.dropChanceUpgradeBtn) {
    const canAffordUpgrade = currentEquivalence >= dropChanceCost;
    cardinalElements.dropChanceUpgradeBtn.disabled = !canAffordUpgrade;
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
  
  // Weapon slots are always active - no interactions needed
  // In the future, lexemes can be dragged and dropped here
}

/**
 * Update the weapon slots display with glow animation.
 */
function updateWeaponsDisplay() {
  if (!cardinalElements.weaponsGrid || !cardinalSimulation) return;
  
  const weapons = cardinalSimulation.getAvailableWeapons();
  
  const html = weapons.map(weapon => {
    const cooldownPercent = (weapon.cooldownProgress / weapon.cooldownTotal) * 100;
    const glowIntensity = weapon.glowIntensity; // 0-1 value
    const glowOpacity = 0.3 + (glowIntensity * 0.7); // Scale from 0.3 to 1.0
    
    return `
      <div class="shin-weapon-slot ${glowIntensity > 0 ? 'shin-weapon-slot--firing' : ''}" 
           role="listitem" 
           style="--weapon-glow-intensity: ${glowIntensity}; --weapon-glow-opacity: ${glowOpacity}; --weapon-color: ${weapon.color};">
        <div class="shin-weapon-slot-header">
          <span class="shin-weapon-slot-symbol" style="color: ${weapon.color}">${weapon.symbol}</span>
          <span class="shin-weapon-slot-name">${weapon.name}</span>
        </div>
        <p class="shin-weapon-slot-description">${weapon.description}</p>
        <div class="shin-weapon-slot-cooldown-container">
          <div class="shin-weapon-slot-cooldown-bar">
            <div class="shin-weapon-slot-cooldown-fill" style="width: ${cooldownPercent}%"></div>
          </div>
          <span class="shin-weapon-slot-cooldown-text">${(weapon.cooldownProgress / 1000).toFixed(1)}s / ${(weapon.cooldownTotal / 1000).toFixed(1)}s</span>
        </div>
        <div class="shin-weapon-slot-info">
          <span class="shin-weapon-slot-info-item">Fires every ${weapon.cooldownTotal / 1000}s</span>
          <span class="shin-weapon-slot-info-item">Ready for lexemes</span>
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
 * @returns {number} The highest score achieved
 */
export function getCardinalHighScore() {
  return cardinalHighScore;
}

/**
 * Get the current base health upgrade level.
 * @returns {number} The current upgrade level (0 = no upgrades)
 */
export function getCardinalBaseHealthLevel() {
  if (cardinalSimulation) {
    return cardinalSimulation.getBaseHealthLevel();
  }
  return baseHealthLevel;
}

/**
 * Get the cost to upgrade base health to the next level (in iterons).
 * @returns {number} The iteron cost for the next upgrade
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
 * @returns {number} The maximum warden health
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

// ============================================================
// Phoneme Collection System
// ============================================================

/**
 * Render phoneme drops on top of the simulation.
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {string} gamePhase - Current game phase
 */
function renderPhonemeDrops(ctx, canvas, gamePhase) {
  // Don't render drops during death/respawn animations
  if (gamePhase !== 'playing') return;
  
  const drops = getActivePhonemeDrops();
  if (drops.length === 0) return;
  
  const time = Date.now();
  
  for (const drop of drops) {
    // Calculate pulse animation (gentle glow effect)
    const age = (time - drop.spawnTime) / 1000;
    const pulse = 0.85 + Math.sin(age * 4) * 0.15;
    
    // Calculate gentle floating animation
    const floatY = Math.sin(age * 2) * 3;
    
    ctx.save();
    
    // Outer glow
    const glowRadius = 20 * pulse;
    const gradient = ctx.createRadialGradient(
      drop.x, drop.y + floatY, 0,
      drop.x, drop.y + floatY, glowRadius
    );
    gradient.addColorStop(0, 'rgba(212, 175, 55, 0.6)');
    gradient.addColorStop(0.5, 'rgba(212, 175, 55, 0.2)');
    gradient.addColorStop(1, 'rgba(212, 175, 55, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(drop.x, drop.y + floatY, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner circle background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(drop.x, drop.y + floatY, 12, 0, Math.PI * 2);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Script character (using index-based display for custom script)
    // TODO: Load and render from Script.png sprite sheet for proper custom glyphs
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // For now, display the grapheme index until sprite rendering is implemented
    const displayChar = drop.index !== undefined ? `#${drop.index}` : (drop.char || '?');
    ctx.fillText(displayChar, drop.x, drop.y + floatY + 1);
    
    ctx.restore();
  }
}

/**
 * Set up phoneme collection click handler on the canvas.
 */
function setupPhonemeCollection() {
  if (!cardinalElements.canvas) return;
  
  // Add click handler for collecting phonemes
  cardinalElements.canvas.addEventListener('click', handlePhonemeClick);
}

/**
 * Handle clicks on the canvas to collect phonemes.
 * @param {MouseEvent} event - The click event
 */
function handlePhonemeClick(event) {
  if (!cardinalElements.canvas || !cardinalSimulation) return;
  
  // Don't collect during death/respawn
  if (cardinalSimulation.gamePhase !== 'playing') return;
  
  // Get canvas-relative coordinates
  const rect = cardinalElements.canvas.getBoundingClientRect();
  const scaleX = cardinalElements.canvas.width / rect.width;
  const scaleY = cardinalElements.canvas.height / rect.height;
  
  const clickX = (event.clientX - rect.left) * scaleX;
  const clickY = (event.clientY - rect.top) * scaleY;
  
  // Check if click is near any phoneme drop
  const drops = getActivePhonemeDrops();
  const collectRadius = 25; // Generous tap target
  
  for (const drop of drops) {
    const dx = clickX - drop.x;
    const dy = clickY - drop.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist <= collectRadius) {
      // Collect this phoneme
      const collected = collectPhonemeDrop(drop.id);
      if (collected) {
        updatePhonemeInventoryDisplay();
        // Only collect one phoneme per click
        return;
      }
    }
  }
}

/**
 * Update the phoneme inventory display in the UI.
 */
function updatePhonemeInventoryDisplay() {
  if (!cardinalElements.phonemeInventory) return;
  
  const counts = getPhonemeCountsByChar();
  const totalCount = getPhonemeCount();
  
  // Update total count display
  if (cardinalElements.phonemeCount) {
    cardinalElements.phonemeCount.textContent = formatGameNumber(totalCount);
  }
  
  // Build inventory grid
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    cardinalElements.phonemeInventory.innerHTML = '<span class="shin-phoneme-empty">No phonemes collected</span>';
    return;
  }
  
  const html = entries.map(([char, count]) => `
    <div class="shin-phoneme-slot" title="${char}">
      <span class="shin-phoneme-char">${char}</span>
      <span class="shin-phoneme-count">×${count}</span>
    </div>
  `).join('');
  
  cardinalElements.phonemeInventory.innerHTML = html;
}

/**
 * Clean up resources.
 */
export function cleanupCardinalWarden() {
  // Remove phoneme click handler
  if (cardinalElements.canvas) {
    cardinalElements.canvas.removeEventListener('click', handlePhonemeClick);
  }
  
  if (cardinalSimulation) {
    cardinalSimulation.stop();
    cardinalSimulation = null;
  }

  if (cardinalResizeObserver) {
    cardinalResizeObserver.disconnect();
    cardinalResizeObserver = null;
  }
}
