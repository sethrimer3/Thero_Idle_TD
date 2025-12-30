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
  spawnSpecificGraphemeDrop,
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
  hasAllGraphemesUnlocked,
  isWeaponPurchased,
  getPurchasedWeapons,
  purchaseWeapon,
  getWeaponUnlockCost,
  isSlotUnlocked,
  getUnlockedSlots,
  unlockSlot,
  getSlotUnlockCost,
  getWeaponAttackLevel,
  getWeaponSpeedLevel,
  getAttackUpgradeCost,
  getSpeedUpgradeCost,
  upgradeWeaponAttack,
  upgradeWeaponSpeed,
} from './shinState.js';
import { getShinVisualSettings } from './shinSpirePreferences.js';

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
  waveCarousel: null,
  waveCarouselTrack: null,
  waveStartApplyBtn: null,
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
// Starting wave selection (0-indexed, 0 = wave 1)
let startingWave = 0;
// Grapheme selection and placement state
let selectedGrapheme = null;
let selectedGraphemeElement = null;
let weaponGraphemeAssignments = {};
const graphemeDictionary = new Map(getGraphemeCharacters().map(def => [def.index, def]));
const weaponElements = new Map();
const pointerState = { active: false, startX: 0, startY: 0, moved: false };

// Sprite sheet metadata for rendering Shin graphemes from Script.png and its JSON metadata.
const SHIN_SCRIPT_METADATA_URL = new URL('./sprites/spires/shinSpire/Script.json', import.meta.url).href;
const SHIN_SCRIPT_SPRITE = {
  url: new URL('./sprites/spires/shinSpire/Script.png', import.meta.url).href,
  columns: 7,
  rows: 5,
  cellWidth: 200,
  cellHeight: 190,
  scale: 0.14,
  tint: '#d4af37',
};

// Load sprite sheet layout metadata from the JSON manifest to keep PNG framing consistent.
function loadShinScriptMetadata() {
  fetch(SHIN_SCRIPT_METADATA_URL)
    .then(response => (response.ok ? response.json() : Promise.reject(response.status)))
    .then((metadata) => {
      if (metadata && typeof metadata === 'object') {
        SHIN_SCRIPT_SPRITE.columns = Number(metadata.columns) || SHIN_SCRIPT_SPRITE.columns;
        SHIN_SCRIPT_SPRITE.rows = Number(metadata.rows) || SHIN_SCRIPT_SPRITE.rows;
        SHIN_SCRIPT_SPRITE.cellWidth = Number(metadata.cellWidth) || SHIN_SCRIPT_SPRITE.cellWidth;
        SHIN_SCRIPT_SPRITE.cellHeight = Number(metadata.cellHeight) || SHIN_SCRIPT_SPRITE.cellHeight;
      }
    })
    .catch((error) => {
      console.warn('Failed to load Shin Script sprite metadata JSON.', error);
    });
}

// Compute scaled metrics for grapheme sprites from the current metadata.
function getShinScriptScaledMetrics() {
  const scaledCellWidth = SHIN_SCRIPT_SPRITE.cellWidth * SHIN_SCRIPT_SPRITE.scale;
  const scaledCellHeight = SHIN_SCRIPT_SPRITE.cellHeight * SHIN_SCRIPT_SPRITE.scale;
  return {
    scaledCellWidth,
    scaledCellHeight,
    scaledSheetWidth: scaledCellWidth * SHIN_SCRIPT_SPRITE.columns,
    scaledSheetHeight: scaledCellHeight * SHIN_SCRIPT_SPRITE.rows,
  };
}

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
loadShinScriptMetadata();

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
  const metrics = getShinScriptScaledMetrics();
  element.style.width = `${metrics.scaledCellWidth}px`;
  element.style.height = `${metrics.scaledCellHeight}px`;
  // Use the PNG as a mask so we can paint collected graphemes with the golden tint while
  // still falling back to the direct background image when masking is unavailable.
  element.style.backgroundColor = SHIN_SCRIPT_SPRITE.tint;
  element.style.backgroundSize = `${metrics.scaledSheetWidth}px ${metrics.scaledSheetHeight}px`;
  element.style.backgroundPosition = `-${frame.col * metrics.scaledCellWidth}px -${frame.row * metrics.scaledCellHeight}px`;
  element.style.backgroundImage = `url(${SHIN_SCRIPT_SPRITE.url})`;
  element.style.maskImage = `url(${SHIN_SCRIPT_SPRITE.url})`;
  element.style.webkitMaskImage = `url(${SHIN_SCRIPT_SPRITE.url})`;
  element.style.maskSize = `${metrics.scaledSheetWidth}px ${metrics.scaledSheetHeight}px`;
  element.style.webkitMaskSize = `${metrics.scaledSheetWidth}px ${metrics.scaledSheetHeight}px`;
  element.style.maskPosition = `-${frame.col * metrics.scaledCellWidth}px -${frame.row * metrics.scaledCellHeight}px`;
  element.style.webkitMaskPosition = `-${frame.col * metrics.scaledCellWidth}px -${frame.row * metrics.scaledCellHeight}px`;
  element.style.maskRepeat = 'no-repeat';
  element.style.webkitMaskRepeat = 'no-repeat';
}

/**
 * Build a DOM element that displays a single grapheme tile from Script.png.
 * For collectable graphemes (A-Z, indices 0-25), adds a small capital letter label in the bottom-right corner.
 */
function createGraphemeIconElement(index, rowOverride, colOverride, className = 'shin-grapheme-icon') {
  const wrapper = document.createElement('span');
  wrapper.className = 'shin-grapheme-icon-wrapper';
  
  const icon = document.createElement('span');
  const frame = resolveGraphemeFrame(index, rowOverride, colOverride);
  icon.className = className;
  icon.setAttribute('role', 'img');
  icon.setAttribute('aria-label', formatGraphemeTitle(index));
  applyGraphemeSpriteStyles(icon, frame);
  
  wrapper.appendChild(icon);
  
  // Add letter label for collectable graphemes (A-Z, indices 0-25)
  if (index >= 0 && index <= 25) {
    const letter = String.fromCharCode(65 + index); // A=65 in ASCII
    const label = document.createElement('span');
    label.className = 'shin-grapheme-letter-label';
    label.textContent = letter;
    label.setAttribute('aria-hidden', 'true');
    wrapper.appendChild(label);
  }
  
  return wrapper;
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

  // Use an offscreen canvas to apply the tint without affecting the main canvas
  // Note: Creating a new canvas each time is acceptable here since grapheme drops are infrequent
  // and the canvas is small (28x27 pixels scaled). Caching would add complexity without meaningful benefit.
  const offscreen = document.createElement('canvas');
  offscreen.width = drawWidth;
  offscreen.height = drawHeight;
  const offCtx = offscreen.getContext('2d');
  
  offCtx.imageSmoothingEnabled = true;
  offCtx.drawImage(
    shinScriptSpriteImage,
    sourceX,
    sourceY,
    SHIN_SCRIPT_SPRITE.cellWidth,
    SHIN_SCRIPT_SPRITE.cellHeight,
    0,
    0,
    drawWidth,
    drawHeight
  );
  offCtx.globalCompositeOperation = 'source-in';
  offCtx.fillStyle = SHIN_SCRIPT_SPRITE.tint;
  offCtx.fillRect(0, 0, drawWidth, drawHeight);
  
  // Draw the tinted result onto the main canvas
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(offscreen, drawX, drawY);
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
  cardinalElements.waveCarousel = document.getElementById('shin-wave-carousel');
  cardinalElements.waveCarouselTrack = document.getElementById('shin-wave-carousel-track');
  cardinalElements.waveStartApplyBtn = document.getElementById('shin-wave-start-apply-btn');

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
  
  // Initialize wave start selector
  initializeWaveStartSelector();
  
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

  // Get current visual settings including night mode
  const visualSettings = getShinVisualSettings();

  cardinalSimulation = new CardinalWardenSimulation({
    canvas: cardinalElements.canvas,
    highScore: cardinalHighScore,
    highestWave: cardinalHighestWave,
    baseHealthLevel: baseHealthLevel,
    nightMode: visualSettings.nightMode,
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
    onGuaranteedGraphemeDrop: handleGuaranteedGraphemeDrop,
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
  updateWaveStartOptions();
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
  updateWaveStartOptions();
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
 * Handle guaranteed grapheme drops every 10 waves.
 * @param {number} waveNumber - The 1-indexed wave number (10, 20, 30, etc.)
 */
function handleGuaranteedGraphemeDrop(waveNumber) {
  // Calculate which grapheme should drop based on wave number
  // Wave 10 = A (index 0), Wave 20 = B (index 1), ..., Wave 260 = Z (index 25)
  const graphemeIndex = (waveNumber / 10) - 1;
  
  // Only drop if it's a valid grapheme (A-Z, indices 0-25)
  if (graphemeIndex >= 0 && graphemeIndex <= 25) {
    const unlockedGraphemes = getUnlockedGraphemes();
    
    // Check if player already has this grapheme
    if (!unlockedGraphemes.includes(graphemeIndex)) {
      // Spawn the specific guaranteed grapheme at center of canvas
      if (cardinalSimulation && cardinalSimulation.canvas) {
        const x = cardinalSimulation.canvas.width / 2;
        const y = cardinalSimulation.canvas.height / 2;
        spawnSpecificGraphemeDrop(x, y, graphemeIndex);
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

// Wave start confirmation state (moved to module scope for clarity)
let waveStartConfirmationState = {
  showing: false,
  originalText: ''
};

// Carousel state
let carouselState = {
  isDragging: false,
  startY: 0,
  startTranslate: 0,
  currentTranslate: 0,
  selectedIndex: 0,
  availableWaves: [],
  itemHeight: 40,
};

/**
 * Initialize the wave start carousel.
 */
function initializeWaveStartSelector() {
  if (!cardinalElements.waveCarouselTrack || !cardinalElements.waveStartApplyBtn) return;
  
  // Update the carousel items based on highest wave reached
  updateWaveStartOptions();
  
  // Set up carousel drag interaction
  setupCarouselInteraction();
  
  // Handle apply button click with confirmation
  cardinalElements.waveStartApplyBtn.addEventListener('click', () => {
    if (!waveStartConfirmationState.showing) {
      // First click: Show warning
      waveStartConfirmationState.showing = true;
      waveStartConfirmationState.originalText = cardinalElements.waveStartApplyBtn.textContent;
      cardinalElements.waveStartApplyBtn.textContent = 'Progress will be lost, confirm?';
      cardinalElements.waveStartApplyBtn.style.color = '#ff4444';
      
      // Reset after 3 seconds if not clicked again
      setTimeout(() => {
        if (waveStartConfirmationState.showing) {
          waveStartConfirmationState.showing = false;
          cardinalElements.waveStartApplyBtn.textContent = waveStartConfirmationState.originalText;
          cardinalElements.waveStartApplyBtn.style.color = '';
        }
      }, 3000);
      
      return;
    }
    
    // Second click: Confirm and restart
    waveStartConfirmationState.showing = false;
    cardinalElements.waveStartApplyBtn.textContent = waveStartConfirmationState.originalText;
    cardinalElements.waveStartApplyBtn.style.color = '';
    
    const selectedWave = carouselState.availableWaves[carouselState.selectedIndex];
    if (!isNaN(selectedWave) && selectedWave >= 0) {
      startingWave = selectedWave;
      // Restart the simulation at the selected wave
      if (cardinalSimulation) {
        cardinalSimulation.stop();
        cardinalSimulation = null;
      }
      createCardinalSimulation();
      if (cardinalSimulation) {
        // Set the starting wave before starting
        cardinalSimulation.wave = startingWave;
        cardinalSimulation.difficultyLevel = Math.floor(startingWave / 3);
        cardinalSimulation.start();
      }
    }
  });
}

/**
 * Set up carousel drag/touch interaction.
 */
function setupCarouselInteraction() {
  const track = cardinalElements.waveCarouselTrack;
  if (!track) return;

  const handleStart = (clientY) => {
    carouselState.isDragging = true;
    carouselState.startY = clientY;
    carouselState.startTranslate = carouselState.currentTranslate;
    track.classList.add('dragging');
  };

  const handleMove = (clientY) => {
    if (!carouselState.isDragging) return;
    
    const deltaY = clientY - carouselState.startY;
    carouselState.currentTranslate = carouselState.startTranslate + deltaY;
    updateCarouselPosition();
  };

  const handleEnd = () => {
    if (!carouselState.isDragging) return;
    
    carouselState.isDragging = false;
    track.classList.remove('dragging');
    
    // Snap to nearest item
    snapToNearestItem();
  };

  // Mouse events
  track.addEventListener('mousedown', (e) => {
    e.preventDefault();
    handleStart(e.clientY);
  });

  document.addEventListener('mousemove', (e) => {
    handleMove(e.clientY);
  });

  document.addEventListener('mouseup', () => {
    handleEnd();
  });

  // Touch events
  track.addEventListener('touchstart', (e) => {
    handleStart(e.touches[0].clientY);
  });

  track.addEventListener('touchmove', (e) => {
    e.preventDefault();
    handleMove(e.touches[0].clientY);
  });

  track.addEventListener('touchend', () => {
    handleEnd();
  });
}

/**
 * Update carousel position without snapping.
 */
function updateCarouselPosition() {
  const track = cardinalElements.waveCarouselTrack;
  if (!track) return;
  
  track.style.transform = `translateY(${carouselState.currentTranslate}px)`;
  updateCarouselSelection();
}

/**
 * Snap to the nearest item and update selection.
 */
function snapToNearestItem() {
  const itemCount = carouselState.availableWaves.length;
  if (itemCount === 0) return;
  
  // Calculate which item should be selected based on position
  // Center of carousel is at 60px (half of 120px height)
  const centerOffset = 60 - (carouselState.itemHeight / 2);
  const rawIndex = Math.round(-carouselState.currentTranslate / carouselState.itemHeight + centerOffset / carouselState.itemHeight);
  
  // Clamp to valid range
  carouselState.selectedIndex = Math.max(0, Math.min(itemCount - 1, rawIndex));
  
  // Calculate target position to center the selected item
  carouselState.currentTranslate = centerOffset - (carouselState.selectedIndex * carouselState.itemHeight);
  
  updateCarouselPosition();
}

/**
 * Update which item appears selected based on current position.
 */
function updateCarouselSelection() {
  const track = cardinalElements.waveCarouselTrack;
  if (!track) return;
  
  const items = track.querySelectorAll('.shin-wave-carousel-item');
  const centerOffset = 60;
  
  items.forEach((item, index) => {
    const itemCenter = carouselState.currentTranslate + (index * carouselState.itemHeight) + (carouselState.itemHeight / 2);
    const distance = Math.abs(itemCenter - centerOffset);
    
    if (distance < carouselState.itemHeight / 2) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

/**
 * Update the wave start carousel items based on highest wave reached.
 */
function updateWaveStartOptions() {
  if (!cardinalElements.waveCarouselTrack) return;
  
  // Clear existing items
  cardinalElements.waveCarouselTrack.innerHTML = '';
  
  // Build list of available waves
  carouselState.availableWaves = [0]; // Wave 1 (0-indexed)
  
  const highestWaveReached = cardinalHighestWave + 1; // Convert to 1-indexed
  for (let wave = 10; wave <= highestWaveReached; wave += 10) {
    carouselState.availableWaves.push(wave - 1); // Store as 0-indexed
  }
  
  // Create carousel items
  carouselState.availableWaves.forEach((waveIndex, index) => {
    const item = document.createElement('div');
    item.className = 'shin-wave-carousel-item';
    const displayWave = waveIndex + 1; // Display as 1-indexed
    item.textContent = displayWave === 1 ? 'Wave 1' : `Wave ${displayWave}`;
    item.dataset.waveIndex = waveIndex;
    cardinalElements.waveCarouselTrack.appendChild(item);
  });
  
  // Initialize position to center first item
  carouselState.selectedIndex = 0;
  carouselState.currentTranslate = 60 - (carouselState.itemHeight / 2);
  updateCarouselPosition();
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
    // Only 26 graphemes are collectable (letters A-Z, numbers 1-8 are not collectable)
    const allUnlocked = unlockedGraphemes.length >= 26;
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
  container.style.position = 'relative';

  const header = document.createElement('div');
  header.className = 'shin-weapon-slot-header';

  // Use ThoughtSpeak grapheme sprite for weapon symbol if available
  const symbol = document.createElement('span');
  symbol.className = 'shin-weapon-slot-symbol';
  if (weapon.symbolGraphemeIndex !== undefined) {
    const graphemeIcon = createGraphemeIconElement(weapon.symbolGraphemeIndex, undefined, undefined, 'shin-grapheme-icon shin-weapon-symbol-icon');
    symbol.appendChild(graphemeIcon);
  } else {
    // Fallback to text symbol
    symbol.textContent = weapon.symbol;
    symbol.style.color = weapon.color;
  }

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

    // Add slot number indicator using ThoughtSpeak numbers
    // ThoughtSpeak numbers start at index 26 (number 1)
    const THOUGHTSPEAK_NUMBER_START_INDEX = 26;
    const slotNumberIndex = THOUGHTSPEAK_NUMBER_START_INDEX + index; // Maps slots 0-7 to indices 26-33 (numbers 1-8)
    const slotNumber = createGraphemeIconElement(slotNumberIndex, undefined, undefined, 'shin-grapheme-icon shin-slot-number-indicator');
    slotNumber.setAttribute('aria-hidden', 'true');
    
    // Add slot lock overlay
    const slotLock = document.createElement('div');
    slotLock.className = 'shin-slot-lock-overlay';
    slotLock.style.display = 'none';
    const lockIcon = document.createElement('span');
    lockIcon.className = 'shin-slot-lock-icon';
    lockIcon.textContent = '🔒';
    slotLock.appendChild(lockIcon);
    
    slotLock.addEventListener('click', event => {
      event.stopPropagation();
      handleSlotUnlock(weapon.id, index);
    });
    
    slot.appendChild(content);
    slot.appendChild(emptyIndicator);
    slot.appendChild(slotNumber);
    slot.appendChild(slotLock);

    slot.addEventListener('click', event => {
      event.stopPropagation();
      placeSelectedGrapheme(weapon.id, index);
    });

    slotsWrapper.appendChild(slot);

    return { slot, content, emptyIndicator, slotNumber, slotLock };
  });

  // Add weapon upgrades section
  const upgradesWrapper = document.createElement('div');
  upgradesWrapper.className = 'shin-weapon-upgrades';
  
  const attackUpgradeBtn = document.createElement('button');
  attackUpgradeBtn.className = 'shin-weapon-upgrade-btn';
  attackUpgradeBtn.innerHTML = `
    <span class="shin-weapon-upgrade-label">⚔️ Attack</span>
    <span class="shin-weapon-upgrade-level">Level: <span class="attack-level">0</span></span>
    <span class="shin-weapon-upgrade-cost"><span class="attack-cost">100</span> ℸ</span>
  `;
  attackUpgradeBtn.addEventListener('click', () => handleAttackUpgrade(weapon.id));
  
  const speedUpgradeBtn = document.createElement('button');
  speedUpgradeBtn.className = 'shin-weapon-upgrade-btn';
  speedUpgradeBtn.innerHTML = `
    <span class="shin-weapon-upgrade-label">⚡ Speed</span>
    <span class="shin-weapon-upgrade-level">Level: <span class="speed-level">0</span></span>
    <span class="shin-weapon-upgrade-cost"><span class="speed-cost">100</span> ℸ</span>
  `;
  speedUpgradeBtn.addEventListener('click', () => handleSpeedUpgrade(weapon.id));
  
  upgradesWrapper.appendChild(attackUpgradeBtn);
  upgradesWrapper.appendChild(speedUpgradeBtn);

  // Add weapon lock overlay (will be shown/hidden dynamically)
  const weaponLock = document.createElement('div');
  weaponLock.className = 'shin-weapon-lock-overlay';
  weaponLock.style.display = 'none';
  const weaponLockIcon = document.createElement('div');
  weaponLockIcon.className = 'shin-weapon-lock-icon';
  weaponLockIcon.textContent = '🔒';
  const weaponLockCost = document.createElement('div');
  weaponLockCost.className = 'shin-weapon-lock-cost';
  weaponLockCost.innerHTML = `Unlock: <span class="weapon-unlock-cost">100</span> ℸ`;
  weaponLock.appendChild(weaponLockIcon);
  weaponLock.appendChild(weaponLockCost);
  
  weaponLock.addEventListener('click', () => handleWeaponUnlock(weapon.id));

  container.appendChild(header);
  container.appendChild(cooldownContainer);
  container.appendChild(slotsWrapper);
  container.appendChild(upgradesWrapper);
  container.appendChild(weaponLock);

  return { 
    container, 
    cooldownFill, 
    cooldownText, 
    graphemeSlots, 
    symbol, 
    name,
    attackUpgradeBtn,
    speedUpgradeBtn,
    weaponLock,
    upgradesWrapper
  };
}

function updateWeaponElement(elements, weapon, assignments) {
  const weaponId = weapon.id;
  const isPurchased = isWeaponPurchased(weaponId);
  const equivalence = getEquivalenceBank();
  
  // Show/hide weapon lock overlay
  if (isPurchased) {
    elements.weaponLock.style.display = 'none';
  } else {
    elements.weaponLock.style.display = 'flex';
    const cost = getWeaponUnlockCost();
    elements.weaponLock.querySelector('.weapon-unlock-cost').textContent = formatGameNumber(cost);
  }
  
  // Update weapon upgrades (only if purchased)
  if (isPurchased) {
    // Update attack upgrade button
    const attackLevel = getWeaponAttackLevel(weaponId);
    const attackCost = getAttackUpgradeCost(weaponId);
    elements.attackUpgradeBtn.querySelector('.attack-level').textContent = attackLevel;
    elements.attackUpgradeBtn.querySelector('.attack-cost').textContent = formatGameNumber(attackCost);
    elements.attackUpgradeBtn.disabled = equivalence < attackCost;
    
    // Update speed upgrade button
    const speedLevel = getWeaponSpeedLevel(weaponId);
    const speedCost = getSpeedUpgradeCost(weaponId);
    elements.speedUpgradeBtn.querySelector('.speed-level').textContent = speedLevel;
    elements.speedUpgradeBtn.querySelector('.speed-cost').textContent = formatGameNumber(speedCost);
    elements.speedUpgradeBtn.disabled = equivalence < speedCost;
    
    elements.upgradesWrapper.style.display = 'flex';
  } else {
    elements.upgradesWrapper.style.display = 'none';
  }

  const cooldownPercent = (weapon.cooldownProgress / weapon.cooldownTotal) * 100;
  const glowOpacity = 0.3 + (weapon.glowIntensity * 0.7);

  elements.container.style.setProperty('--weapon-glow-intensity', weapon.glowIntensity);
  elements.container.style.setProperty('--weapon-glow-opacity', glowOpacity);
  elements.container.style.setProperty('--weapon-color', weapon.color);
  elements.container.classList.toggle('shin-weapon-slot--firing', weapon.glowIntensity > 0);

  // Update symbol - use grapheme sprite if available, otherwise use text
  if (weapon.symbolGraphemeIndex !== undefined) {
    elements.symbol.replaceChildren();
    const graphemeIcon = createGraphemeIconElement(weapon.symbolGraphemeIndex, undefined, undefined, 'shin-grapheme-icon shin-weapon-symbol-icon');
    elements.symbol.appendChild(graphemeIcon);
  } else {
    elements.symbol.textContent = weapon.symbol;
    elements.symbol.style.color = weapon.color;
  }
  elements.name.textContent = weapon.name;

  elements.cooldownFill.style.width = `${Math.max(0, Math.min(100, cooldownPercent))}%`;
  elements.cooldownText.textContent = `${(weapon.cooldownProgress / 1000).toFixed(1)}s / ${(weapon.cooldownTotal / 1000).toFixed(1)}s`;

  elements.graphemeSlots.forEach((slotElements, index) => {
    const assignment = assignments[index];
    const isSlotUnlockedState = isSlotUnlocked(weaponId, index);
    
    // Show/hide slot lock
    if (isPurchased && !isSlotUnlockedState) {
      slotElements.slotLock.style.display = 'flex';
    } else {
      slotElements.slotLock.style.display = 'none';
    }
    
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
 * Handle weapon unlock purchase.
 */
function handleWeaponUnlock(weaponId) {
  const cost = getWeaponUnlockCost();
  const equivalence = getEquivalenceBank();
  
  if (equivalence < cost) {
    console.log(`Not enough Equivalence to unlock ${weaponId}. Need ${cost}, have ${equivalence}`);
    return;
  }
  
  const result = purchaseWeapon(weaponId);
  if (result.success) {
    console.log(`Unlocked weapon ${weaponId} for ${cost} Equivalence`);
    updateWeaponsDisplay();
    updateTotalIterons();
  }
}

/**
 * Handle slot unlock purchase.
 */
function handleSlotUnlock(weaponId, slotIndex) {
  const cost = getSlotUnlockCost();
  const equivalence = getEquivalenceBank();
  
  if (equivalence < cost) {
    console.log(`Not enough Equivalence to unlock slot ${slotIndex} for ${weaponId}. Need ${cost}, have ${equivalence}`);
    return;
  }
  
  const result = unlockSlot(weaponId, slotIndex);
  if (result.success) {
    console.log(`Unlocked slot ${slotIndex} for weapon ${weaponId} for ${cost} Equivalence`);
    updateWeaponsDisplay();
    updateTotalIterons();
  }
}

/**
 * Handle attack upgrade purchase.
 */
function handleAttackUpgrade(weaponId) {
  const cost = getAttackUpgradeCost(weaponId);
  const equivalence = getEquivalenceBank();
  
  if (equivalence < cost) {
    console.log(`Not enough Equivalence to upgrade attack for ${weaponId}. Need ${cost}, have ${equivalence}`);
    return;
  }
  
  const result = upgradeWeaponAttack(weaponId);
  if (result.success) {
    console.log(`Upgraded attack for weapon ${weaponId} to level ${result.newLevel} for ${cost} Equivalence`);
    // Apply the upgrade to the simulation
    if (cardinalSimulation) {
      cardinalSimulation.applyWeaponUpgrades(weaponId, result.newLevel, getWeaponSpeedLevel(weaponId));
    }
    updateWeaponsDisplay();
    updateTotalIterons();
  }
}

/**
 * Handle speed upgrade purchase.
 */
function handleSpeedUpgrade(weaponId) {
  const cost = getSpeedUpgradeCost(weaponId);
  const equivalence = getEquivalenceBank();
  
  if (equivalence < cost) {
    console.log(`Not enough Equivalence to upgrade speed for ${weaponId}. Need ${cost}, have ${equivalence}`);
    return;
  }
  
  const result = upgradeWeaponSpeed(weaponId);
  if (result.success) {
    console.log(`Upgraded speed for weapon ${weaponId} to level ${result.newLevel} for ${cost} Equivalence`);
    // Apply the upgrade to the simulation
    if (cardinalSimulation) {
      cardinalSimulation.applyWeaponUpgrades(weaponId, getWeaponAttackLevel(weaponId), result.newLevel);
    }
    updateWeaponsDisplay();
    updateTotalIterons();
  }
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
  const allGraphemesUnlocked = hasAllGraphemesUnlocked();
  
  // Auto-collect graphemes if all 26 are unlocked
  if (allGraphemesUnlocked) {
    // Process drops in reverse to safely remove them during iteration.
    // collectPhonemeDrop() modifies the drops array (which is a reference to activeGraphemeDrops),
    // so collected drops are removed before the rendering loop below.
    for (let i = drops.length - 1; i >= 0; i--) {
      const drop = drops[i];
      const age = (time - drop.spawnTime) / 1000;
      
      // Auto-collect after 0.5 seconds of existence
      if (age >= 0.5) {
        const collected = collectPhonemeDrop(drop.id);
        if (collected) {
          updatePhonemeInventoryDisplay();
        }
      }
    }
  }
  
  for (const drop of drops) {
    // Calculate pulse animation (gentle glow effect)
    const age = (time - drop.spawnTime) / 1000;
    const pulse = 0.85 + Math.sin(age * 4) * 0.15;
    
    // Calculate gentle floating animation
    let floatY = Math.sin(age * 2) * 3;
    let dropX = drop.x;
    let dropY = drop.y;
    
    // If auto-collect is enabled and drop is older than 0.2 seconds, animate toward warden
    if (allGraphemesUnlocked && age >= 0.2) {
      const wardenX = canvas.width / 2;
      const wardenY = canvas.height / 2;
      
      // Calculate progress of "sucking in" animation (0.2s to 0.5s)
      const animProgress = Math.min(1, (age - 0.2) / 0.3);
      const easeProgress = 1 - Math.pow(1 - animProgress, 3); // Cubic ease-in
      
      // Interpolate position toward warden
      dropX = drop.x + (wardenX - drop.x) * easeProgress;
      dropY = drop.y + (wardenY - drop.y) * easeProgress;
      floatY *= (1 - easeProgress); // Reduce float animation during collection
    }
    
    ctx.save();
    
    // Outer glow
    const glowRadius = 20 * pulse;
    const gradient = ctx.createRadialGradient(
      dropX, dropY + floatY, 0,
      dropX, dropY + floatY, glowRadius
    );
    gradient.addColorStop(0, 'rgba(212, 175, 55, 0.6)');
    gradient.addColorStop(0.5, 'rgba(212, 175, 55, 0.2)');
    gradient.addColorStop(1, 'rgba(212, 175, 55, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(dropX, dropY + floatY, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner circle background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(dropX, dropY + floatY, 12, 0, Math.PI * 2);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Script character rendered from Script.png with a gold tint.
    const frame = resolveGraphemeFrame(drop.index, drop.row, drop.col);
    const spriteDrawn = renderGraphemeSprite(ctx, frame, dropX, dropY + floatY + 1);

    // Fallback to labeled text if the sprite is not yet available.
    if (!spriteDrawn) {
      ctx.fillStyle = SHIN_SCRIPT_SPRITE.tint;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const displayChar = drop.index !== undefined ? `#${drop.index + 1}` : (drop.char || '?');
      ctx.fillText(displayChar, dropX, dropY + floatY + 1);
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
 * Handle clicks on the canvas to collect phonemes and interact with speed button.
 * @param {MouseEvent} event - The click event
 */
function handlePhonemeClick(event) {
  if (!cardinalElements.canvas || !cardinalSimulation) return;
  
  // Get canvas-relative coordinates
  const rect = cardinalElements.canvas.getBoundingClientRect();
  const scaleX = cardinalElements.canvas.width / rect.width;
  const scaleY = cardinalElements.canvas.height / rect.height;
  
  const clickX = (event.clientX - rect.left) * scaleX;
  const clickY = (event.clientY - rect.top) * scaleY;
  
  // Check if click is on speed button (top right)
  const padding = 10;
  const speedButtonSize = 50;
  const speedButtonX = cardinalElements.canvas.width - padding - speedButtonSize;
  const speedButtonY = padding;
  
  if (clickX >= speedButtonX && clickX <= speedButtonX + speedButtonSize &&
      clickY >= speedButtonY && clickY <= speedButtonY + speedButtonSize) {
    // Cycle through speeds: 1x -> 2x -> 3x -> 1x
    if (cardinalSimulation.gameSpeed === 1) {
      cardinalSimulation.gameSpeed = 2;
    } else if (cardinalSimulation.gameSpeed === 2) {
      cardinalSimulation.gameSpeed = 3;
    } else {
      cardinalSimulation.gameSpeed = 1;
    }
    return;
  }
  
  // Don't collect during death/respawn
  if (cardinalSimulation.gamePhase !== 'playing') return;
  
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

  // Sync inventory counts to simulation for excess grapheme bonus
  if (cardinalSimulation) {
    cardinalSimulation.setGraphemeInventoryCounts(counts);
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
  // Check if weapon is purchased
  if (!isWeaponPurchased(weaponId)) {
    console.log(`Weapon ${weaponId} is not purchased`);
    return;
  }
  
  // Check if slot is unlocked
  if (!isSlotUnlocked(weaponId, slotIndex)) {
    console.log(`Slot ${slotIndex} for weapon ${weaponId} is locked`);
    return;
  }
  
  const assignments = ensureWeaponAssignments(weaponId);
  
  // Handle click on filled slot without a selection - remove grapheme and return to inventory
  if (assignments[slotIndex] && !selectedGrapheme) {
    const currentAssignment = assignments[slotIndex];
    returnGrapheme(currentAssignment.index);
    assignments[slotIndex] = null;
    syncGraphemeAssignmentsToSimulation();
    updateWeaponsDisplay();
    updatePhonemeInventoryDisplay();
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
  updatePhonemeInventoryDisplay();
}

/**
 * Sync weapon grapheme assignments from UI to simulation.
 * This propagates the player's grapheme placements to the Cardinal Warden simulation
 * so they can be rendered as script below the warden.
 * 
 * Also syncs the grapheme inventory counts for calculating excess grapheme bonus damage.
 * 
 * This function should be called whenever:
 * - A grapheme is placed in a weapon slot
 * - A weapon slot is removed or cleared
 * - The simulation is first initialized
 * - The grapheme inventory changes (collection or consumption)
 * 
 * @private
 */
function syncGraphemeAssignmentsToSimulation() {
  if (!cardinalSimulation) return;
  
  cardinalSimulation.setWeaponGraphemeAssignments(weaponGraphemeAssignments);
  
  // Sync grapheme inventory counts for excess bonus calculation
  const counts = getPhonemeCountsByChar();
  cardinalSimulation.setGraphemeInventoryCounts(counts);
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
