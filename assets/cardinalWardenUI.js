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
  getGraphemeCharacters,
  consumeGrapheme,
  returnGrapheme,
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
// Grapheme selection and placement state
let selectedGrapheme = null;
let selectedGraphemeElement = null;
let weaponGraphemeAssignments = {};
const graphemeDictionary = new Map(getGraphemeCharacters().map(def => [def.index, def]));
const weaponElements = new Map();
const pointerState = { active: false, startX: 0, startY: 0, moved: false };

// Sprite sheet metadata for rendering Shin graphemes from Script.png.
const SHIN_SCRIPT_SPRITE = Object.freeze({
  url: new URL('./sprites/spires/shinSpire/Script.png', import.meta.url).href,
  columns: 7,
  rows: 5,
  cellWidth: 200,
  cellHeight: 190,
  scale: 0.14,
  tint: '#d4af37',
});

// Derived dimensions for scaled grapheme frames.
const SHIN_SCALED_CELL_WIDTH = SHIN_SCRIPT_SPRITE.cellWidth * SHIN_SCRIPT_SPRITE.scale;
const SHIN_SCALED_CELL_HEIGHT = SHIN_SCRIPT_SPRITE.cellHeight * SHIN_SCRIPT_SPRITE.scale;
const SHIN_SCALED_SHEET_WIDTH = SHIN_SCALED_CELL_WIDTH * SHIN_SCRIPT_SPRITE.columns;
const SHIN_SCALED_SHEET_HEIGHT = SHIN_SCALED_CELL_HEIGHT * SHIN_SCRIPT_SPRITE.rows;

// Preload the script sprite sheet so canvas drops and UI icons can share it.
const shinScriptSpriteImage = new Image();
let shinScriptSpriteLoaded = false;
shinScriptSpriteImage.addEventListener('load', () => {
  shinScriptSpriteLoaded = true;
});
shinScriptSpriteImage.addEventListener('error', (error) => {
  console.warn('Failed to load Shin Script sprite sheet; falling back to text glyphs.', error);
});
shinScriptSpriteImage.src = SHIN_SCRIPT_SPRITE.url;

/**
 * Resolve the sprite frame for a grapheme using either explicit row/col data or the dictionary definition.
 */
function resolveGraphemeFrame(index, rowOverride, colOverride) {
  const definition = graphemeDictionary.get(index);
  return {
    row: rowOverride ?? definition?.row ?? 0,
    col: colOverride ?? definition?.col ?? 0,
  };
}

/**
 * Apply Script.png sprite background positioning to the provided element.
 */
function applyGraphemeSpriteStyles(element, frame) {
  element.style.width = `${SHIN_SCALED_CELL_WIDTH}px`;
  element.style.height = `${SHIN_SCALED_CELL_HEIGHT}px`;
  element.style.backgroundSize = `${SHIN_SCALED_SHEET_WIDTH}px ${SHIN_SCALED_SHEET_HEIGHT}px`;
  element.style.backgroundPosition = `-${frame.col * SHIN_SCALED_CELL_WIDTH}px -${frame.row * SHIN_SCALED_CELL_HEIGHT}px`;
  element.style.backgroundImage = `url(${SHIN_SCRIPT_SPRITE.url})`;
}

/**
 * Build a DOM element that displays a single grapheme tile from Script.png.
 */
function createGraphemeIconElement(index, rowOverride, colOverride, className = 'shin-grapheme-icon') {
  const icon = document.createElement('span');
  const frame = resolveGraphemeFrame(index, rowOverride, colOverride);
  icon.className = className;
  icon.setAttribute('role', 'img');
  icon.setAttribute('aria-label', formatGraphemeTitle(index));
  applyGraphemeSpriteStyles(icon, frame);
  return icon;
}

/**
 * Draw a gold-tinted grapheme sprite onto the Cardinal canvas.
 */
function renderGraphemeSprite(ctx, frame, centerX, centerY) {
  if (!shinScriptSpriteLoaded) {
    return false;
  }

  const drawWidth = SHIN_SCRIPT_SPRITE.cellWidth * SHIN_SCRIPT_SPRITE.scale;
  const drawHeight = SHIN_SCRIPT_SPRITE.cellHeight * SHIN_SCRIPT_SPRITE.scale;
  const drawX = centerX - (drawWidth / 2);
  const drawY = centerY - (drawHeight / 2);
  const sourceX = frame.col * SHIN_SCRIPT_SPRITE.cellWidth;
  const sourceY = frame.row * SHIN_SCRIPT_SPRITE.cellHeight;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    shinScriptSpriteImage,
    sourceX,
    sourceY,
    SHIN_SCRIPT_SPRITE.cellWidth,
    SHIN_SCRIPT_SPRITE.cellHeight,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
  ctx.restore();
  return true;
}

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

  // Enable grapheme selection interactions
  setupGraphemeInventoryInteraction();
  setupGlobalPointerHandlers();

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
  
  // Sync any existing grapheme assignments to the simulation
  syncGraphemeAssignmentsToSimulation();
  
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

  weaponGraphemeAssignments = {};
  weaponElements.clear();
  cardinalElements.weaponsGrid.innerHTML = '';
}

/**
 * Update the weapon slots display with glow animation.
 */
function updateWeaponsDisplay() {
  if (!cardinalElements.weaponsGrid || !cardinalSimulation) return;

  const weapons = cardinalSimulation.getAvailableWeapons();
  const activeWeaponIds = new Set(weapons.map(weapon => weapon.id));

  // Remove stale weapon cards if definitions change
  let assignmentsChanged = false;
  for (const [weaponId, elements] of weaponElements.entries()) {
    if (!activeWeaponIds.has(weaponId)) {
      elements.container.remove();
      weaponElements.delete(weaponId);
      delete weaponGraphemeAssignments[weaponId];
      assignmentsChanged = true;
    }
  }

  // Sync changes to simulation if any assignments were removed
  if (assignmentsChanged) {
    syncGraphemeAssignmentsToSimulation();
  }

  for (const weapon of weapons) {
    const assignments = ensureWeaponAssignments(weapon.id);
    let elements = weaponElements.get(weapon.id);

    if (!elements) {
      elements = createWeaponElement(weapon);
      weaponElements.set(weapon.id, elements);
      cardinalElements.weaponsGrid.appendChild(elements.container);
    }

    updateWeaponElement(elements, weapon, assignments);
  }
}

function ensureWeaponAssignments(weaponId) {
  if (!weaponGraphemeAssignments[weaponId]) {
    weaponGraphemeAssignments[weaponId] = Array(8).fill(null);
  }
  return weaponGraphemeAssignments[weaponId];
}

function createWeaponElement(weapon) {
  const container = document.createElement('div');
  container.className = 'shin-weapon-slot';
  container.setAttribute('role', 'listitem');

  const header = document.createElement('div');
  header.className = 'shin-weapon-slot-header';

  const symbol = document.createElement('span');
  symbol.className = 'shin-weapon-slot-symbol';
  symbol.textContent = weapon.symbol;
  symbol.style.color = weapon.color;

  const name = document.createElement('span');
  name.className = 'shin-weapon-slot-name';
  name.textContent = weapon.name;

  header.appendChild(symbol);
  header.appendChild(name);

  const cooldownContainer = document.createElement('div');
  cooldownContainer.className = 'shin-weapon-slot-cooldown-container';

  const cooldownBar = document.createElement('div');
  cooldownBar.className = 'shin-weapon-slot-cooldown-bar';

  const cooldownFill = document.createElement('div');
  cooldownFill.className = 'shin-weapon-slot-cooldown-fill';
  cooldownBar.appendChild(cooldownFill);

  const cooldownText = document.createElement('span');
  cooldownText.className = 'shin-weapon-slot-cooldown-text';

  cooldownContainer.appendChild(cooldownBar);
  cooldownContainer.appendChild(cooldownText);

  const slotsWrapper = document.createElement('div');
  slotsWrapper.className = 'shin-weapon-grapheme-slots';
  slotsWrapper.setAttribute('aria-label', `Grapheme slots for ${weapon.name}`);

  const graphemeSlots = Array.from({ length: 8 }, (_, index) => {
    const slot = document.createElement('div');
    slot.className = 'shin-weapon-grapheme-slot';
    slot.dataset.weaponId = weapon.id;
    slot.dataset.slotIndex = index.toString();
    slot.setAttribute('role', 'button');
    slot.setAttribute('tabindex', '0');
    slot.setAttribute('aria-label', `Grapheme slot ${index + 1} for ${weapon.name}`);

    const content = document.createElement('span');
    content.className = 'shin-weapon-grapheme-slot-content';

    const emptyIndicator = document.createElement('span');
    emptyIndicator.className = 'shin-weapon-grapheme-slot-empty-indicator';
    emptyIndicator.textContent = '+';

    slot.appendChild(content);
    slot.appendChild(emptyIndicator);

    slot.addEventListener('click', event => {
      event.stopPropagation();
      placeSelectedGrapheme(weapon.id, index);
    });

    slotsWrapper.appendChild(slot);

    return { slot, content, emptyIndicator };
  });

  container.appendChild(header);
  container.appendChild(cooldownContainer);
  container.appendChild(slotsWrapper);

  return { container, cooldownFill, cooldownText, graphemeSlots, symbol, name };
}

function updateWeaponElement(elements, weapon, assignments) {
  const cooldownPercent = (weapon.cooldownProgress / weapon.cooldownTotal) * 100;
  const glowOpacity = 0.3 + (weapon.glowIntensity * 0.7);

  elements.container.style.setProperty('--weapon-glow-intensity', weapon.glowIntensity);
  elements.container.style.setProperty('--weapon-glow-opacity', glowOpacity);
  elements.container.style.setProperty('--weapon-color', weapon.color);
  elements.container.classList.toggle('shin-weapon-slot--firing', weapon.glowIntensity > 0);

  elements.symbol.textContent = weapon.symbol;
  elements.symbol.style.color = weapon.color;
  elements.name.textContent = weapon.name;

  elements.cooldownFill.style.width = `${Math.max(0, Math.min(100, cooldownPercent))}%`;
  elements.cooldownText.textContent = `${(weapon.cooldownProgress / 1000).toFixed(1)}s / ${(weapon.cooldownTotal / 1000).toFixed(1)}s`;

  elements.graphemeSlots.forEach((slotElements, index) => {
    const assignment = assignments[index];
    updateWeaponSlot(slotElements, assignment, weapon, index);
  });
}

function updateWeaponSlot(slotElements, assignment, weapon, index) {
  // Clear previous glyph nodes so the slot always reflects the latest assignment.
  slotElements.content.replaceChildren();
  if (assignment) {
    slotElements.slot.classList.add('shin-weapon-grapheme-slot--filled');
    const icon = createGraphemeIconElement(assignment.index, assignment.row, assignment.col, 'shin-grapheme-icon shin-grapheme-icon--slot');
    slotElements.content.appendChild(icon);
    slotElements.content.title = assignment.title;
    slotElements.content.setAttribute('aria-label', assignment.title);
    slotElements.emptyIndicator.style.display = 'none';
    slotElements.content.style.display = 'flex';
  } else {
    slotElements.slot.classList.remove('shin-weapon-grapheme-slot--filled');
    slotElements.content.removeAttribute('title');
    slotElements.content.removeAttribute('aria-label');
    slotElements.emptyIndicator.style.display = 'block';
    slotElements.content.style.display = 'none';
  }

  slotElements.slot.setAttribute('aria-label', `Grapheme slot ${index + 1} for ${weapon.name}`);
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

    // Script character rendered from Script.png with a gold tint.
    const frame = resolveGraphemeFrame(drop.index, drop.row, drop.col);
    const spriteDrawn = renderGraphemeSprite(ctx, frame, drop.x, drop.y + floatY + 1);

    // Fallback to labeled text if the sprite is not yet available.
    if (!spriteDrawn) {
      ctx.fillStyle = SHIN_SCRIPT_SPRITE.tint;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const displayChar = drop.index !== undefined ? `#${drop.index + 1}` : (drop.char || '?');
      ctx.fillText(displayChar, drop.x, drop.y + floatY + 1);
    }

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

  if (selectedGrapheme && !counts[selectedGrapheme.index]) {
    clearSelectedGrapheme();
  }

  // Update total count display
  if (cardinalElements.phonemeCount) {
    cardinalElements.phonemeCount.textContent = formatGameNumber(totalCount);
  }

  // Build inventory grid
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    cardinalElements.phonemeInventory.innerHTML = '<span class="shin-phoneme-empty">No graphemes collected</span>';
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const [indexKey, count] of entries) {
    const index = Number(indexKey);
    const slot = document.createElement('div');
    slot.className = 'shin-phoneme-slot';
    slot.dataset.graphemeIndex = index.toString();
    slot.title = formatGraphemeTitle(index);

    const charSpan = document.createElement('span');
    charSpan.className = 'shin-phoneme-char';
    charSpan.appendChild(createGraphemeIconElement(index));

    const countSpan = document.createElement('span');
    countSpan.className = 'shin-phoneme-count';
    countSpan.textContent = `×${formatGameNumber(count)}`;

    slot.appendChild(charSpan);
    slot.appendChild(countSpan);

    if (selectedGrapheme?.index === index) {
      slot.classList.add('shin-phoneme-slot--selected');
      selectedGraphemeElement = slot;
    }

    fragment.appendChild(slot);
  }

  cardinalElements.phonemeInventory.innerHTML = '';
  cardinalElements.phonemeInventory.appendChild(fragment);
}

function setupGraphemeInventoryInteraction() {
  if (!cardinalElements.phonemeInventory || cardinalElements.phonemeInventory.dataset.selectionBound === 'true') {
    return;
  }

  cardinalElements.phonemeInventory.addEventListener('click', handleGraphemeInventoryClick);
  cardinalElements.phonemeInventory.dataset.selectionBound = 'true';
}

function handleGraphemeInventoryClick(event) {
  const slot = event.target.closest('.shin-phoneme-slot');
  if (!slot) return;

  const graphemeIndex = Number(slot.dataset.graphemeIndex);
  if (Number.isNaN(graphemeIndex)) return;

  event.stopPropagation();
  selectGrapheme(graphemeIndex, slot);
}

function selectGrapheme(index, element) {
  const frame = resolveGraphemeFrame(index);
  selectedGrapheme = {
    index,
    symbol: formatGraphemeSymbol(index),
    title: formatGraphemeTitle(index),
    row: frame.row,
    col: frame.col,
  };

  if (selectedGraphemeElement && selectedGraphemeElement !== element) {
    selectedGraphemeElement.classList.remove('shin-phoneme-slot--selected');
  }

  selectedGraphemeElement = element;
  if (selectedGraphemeElement) {
    selectedGraphemeElement.classList.add('shin-phoneme-slot--selected');
  }
}

function clearSelectedGrapheme() {
  if (selectedGraphemeElement) {
    selectedGraphemeElement.classList.remove('shin-phoneme-slot--selected');
  }
  selectedGraphemeElement = null;
  selectedGrapheme = null;
}

function placeSelectedGrapheme(weaponId, slotIndex) {
  const assignments = ensureWeaponAssignments(weaponId);
  
  // Handle click on filled slot without a selection - remove grapheme and return to inventory
  if (assignments[slotIndex] && !selectedGrapheme) {
    const currentAssignment = assignments[slotIndex];
    returnGrapheme(currentAssignment.index);
    assignments[slotIndex] = null;
    syncGraphemeAssignmentsToSimulation();
    updateWeaponsDisplay();
    updateGraphemeInventoryDisplay();
    return;
  }
  
  // Handle placing a new grapheme
  if (!selectedGrapheme) return;

  // Try to consume the new grapheme from inventory first
  if (!consumeGrapheme(selectedGrapheme.index)) {
    // Not enough graphemes in inventory
    return;
  }

  // Only after successfully consuming, return the old grapheme if slot was filled
  if (assignments[slotIndex]) {
    const currentAssignment = assignments[slotIndex];
    returnGrapheme(currentAssignment.index);
  }

  // Assign the new grapheme to the slot
  assignments[slotIndex] = { ...selectedGrapheme };
  
  // Update UI
  clearSelectedGrapheme();
  syncGraphemeAssignmentsToSimulation();
  updateWeaponsDisplay();
  updateGraphemeInventoryDisplay();
}

/**
 * Sync weapon grapheme assignments from UI to simulation.
 * This propagates the player's grapheme placements to the Cardinal Warden simulation
 * so they can be rendered as script below the warden.
 * 
 * This function should be called whenever:
 * - A grapheme is placed in a weapon slot
 * - A weapon slot is removed or cleared
 * - The simulation is first initialized
 * 
 * @private
 */
function syncGraphemeAssignmentsToSimulation() {
  if (!cardinalSimulation) return;
  
  cardinalSimulation.setWeaponGraphemeAssignments(weaponGraphemeAssignments);
}

function formatGraphemeSymbol(index) {
  if (Number.isNaN(index) || index === -1) {
    return '?';
  }
  return `#${index + 1}`;
}

function formatGraphemeTitle(index) {
  const definition = graphemeDictionary.get(index);
  if (definition) {
    return `${definition.name} · ${definition.property}`;
  }
  return `Grapheme #${index + 1}`;
}

function setupGlobalPointerHandlers() {
  if (pointerState.handlersAttached) return;

  pointerState.handlersAttached = true;
  document.addEventListener('pointerdown', handleGlobalPointerDown);
  document.addEventListener('pointermove', handleGlobalPointerMove);
  document.addEventListener('pointerup', handleGlobalPointerUp);
}

function removeGlobalPointerHandlers() {
  if (!pointerState.handlersAttached) return;

  document.removeEventListener('pointerdown', handleGlobalPointerDown);
  document.removeEventListener('pointermove', handleGlobalPointerMove);
  document.removeEventListener('pointerup', handleGlobalPointerUp);
  pointerState.handlersAttached = false;
}

function handleGlobalPointerDown(event) {
  if (!selectedGrapheme) return;

  pointerState.active = true;
  pointerState.startX = event.clientX;
  pointerState.startY = event.clientY;
  pointerState.moved = false;
}

function handleGlobalPointerMove(event) {
  if (!pointerState.active) return;

  const deltaX = Math.abs(event.clientX - pointerState.startX);
  const deltaY = Math.abs(event.clientY - pointerState.startY);

  if (deltaX > 6 || deltaY > 6) {
    pointerState.moved = true;
  }
}

function handleGlobalPointerUp(event) {
  if (!pointerState.active) return;

  const wasTap = !pointerState.moved;
  pointerState.active = false;
  pointerState.moved = false;

  if (!selectedGrapheme || !wasTap) return;

  const interactedWithSelection = event.target.closest('.shin-phoneme-slot') || event.target.closest('.shin-weapon-grapheme-slot');
  if (!interactedWithSelection) {
    clearSelectedGrapheme();
  }
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

  if (cardinalElements.phonemeInventory) {
    cardinalElements.phonemeInventory.removeEventListener('click', handleGraphemeInventoryClick);
    delete cardinalElements.phonemeInventory.dataset.selectionBound;
  }

  removeGlobalPointerHandlers();
  weaponElements.clear();
  weaponGraphemeAssignments = {};
  clearSelectedGrapheme();
}
