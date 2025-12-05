/**
 * Shin Spire State Management
 * 
 * Manages the Equivalence resource system and fractal progression for the Shin Spire.
 * Equivalence is allocated to fractals to increase their complexity, and when a
 * fractal completes a layer, the player earns a Shin glyph.
 */

/**
 * Number of Equivalence required in a fractal before the next fractal unlocks
 */
const FRACTAL_UNLOCK_THRESHOLD = 100;

/**
 * State for the Shin Spire system
 */
const shinState = {
  equivalenceBank: 0,               // Total unallocated Equivalence available
  iterationRate: 0,                 // Allocations per second (starts at 0)
  shinGlyphs: 0,                    // Total Shin glyphs earned
  activeFractalId: 'tree',          // Currently selected fractal
  fractals: {},                     // State for each fractal: { id: { allocated: number, layersCompleted: number, unlocked: boolean } }
  lastUpdateTime: Date.now(),       // For calculating automatic allocation
  accumulatedEquivalence: 0,        // Accumulator for fractional Equivalence
  graphemes: [],                    // Collected graphemes (script characters) - each entry: { id: string, char: string, index: number, collectedAt: timestamp }
  activeGraphemeDrops: [],          // Currently visible grapheme drops on the battlefield - each entry: { id: string, char: string, index: number, x: number, y: number, spawnTime: number }
  graphemeIdCounter: 0,             // Counter for generating unique grapheme IDs
  unlockedGraphemes: [0, 1, 2],     // Indices of unlocked graphemes (starts with first 3)
  graphemeDropChance: 0.01,         // 1% base drop chance
  graphemeUnlockCost: 250,          // Cost to unlock next grapheme
  dropChanceUpgradeCost: 100,       // Cost to upgrade drop chance
  dropChanceUpgradeLevel: 0,        // Number of drop chance upgrades purchased
};

/**
 * Fractal definitions loaded from JSON
 */
let fractalDefinitions = [];

/**
 * Initialize the Shin Spire system with saved state
 */
export function initializeShinState(savedState = {}) {
  // Migrate old iteronBank to equivalenceBank
  if (savedState.equivalenceBank !== undefined) {
    shinState.equivalenceBank = savedState.equivalenceBank;
  } else if (savedState.iteronBank !== undefined) {
    // Migration: convert old iteronBank to equivalenceBank
    shinState.equivalenceBank = savedState.iteronBank;
  } else {
    // Start with 0 Equivalence in the bank for new games
    shinState.equivalenceBank = 0;
  }
  
  if (savedState.iterationRate !== undefined) {
    shinState.iterationRate = savedState.iterationRate;
  } else {
    // Start with 0 iteration rate for new games
    shinState.iterationRate = 0;
  }
  if (savedState.shinGlyphs !== undefined) {
    shinState.shinGlyphs = savedState.shinGlyphs;
  }
  if (savedState.activeFractalId !== undefined) {
    shinState.activeFractalId = savedState.activeFractalId;
  }
  if (savedState.fractals !== undefined) {
    shinState.fractals = savedState.fractals;
  }
  if (savedState.lastUpdateTime !== undefined) {
    shinState.lastUpdateTime = savedState.lastUpdateTime;
  }
  
  // Initialize graphemes from saved state (with migration from old phonemes)
  if (Array.isArray(savedState.graphemes)) {
    shinState.graphemes = savedState.graphemes;
  } else if (Array.isArray(savedState.phonemes)) {
    // Migration: convert old phonemes to graphemes
    shinState.graphemes = savedState.phonemes;
  } else {
    shinState.graphemes = [];
  }
  
  // Active drops are never persisted - they disappear when the warden dies
  shinState.activeGraphemeDrops = [];
  
  if (savedState.graphemeIdCounter !== undefined) {
    shinState.graphemeIdCounter = savedState.graphemeIdCounter;
  } else if (savedState.phonemeIdCounter !== undefined) {
    // Migration: convert old phonemeIdCounter
    shinState.graphemeIdCounter = savedState.phonemeIdCounter;
  }
  
  // Initialize unlocked graphemes
  if (Array.isArray(savedState.unlockedGraphemes)) {
    shinState.unlockedGraphemes = savedState.unlockedGraphemes;
  } else {
    shinState.unlockedGraphemes = [0, 1, 2]; // Start with first 3 graphemes
  }
  
  // Initialize drop chance and upgrade systems
  if (savedState.graphemeDropChance !== undefined) {
    shinState.graphemeDropChance = savedState.graphemeDropChance;
  } else {
    shinState.graphemeDropChance = 0.01; // 1% base drop chance
  }
  
  if (savedState.graphemeUnlockCost !== undefined) {
    shinState.graphemeUnlockCost = savedState.graphemeUnlockCost;
  } else {
    shinState.graphemeUnlockCost = 250;
  }
  
  if (savedState.dropChanceUpgradeCost !== undefined) {
    shinState.dropChanceUpgradeCost = savedState.dropChanceUpgradeCost;
  } else {
    shinState.dropChanceUpgradeCost = 100;
  }
  
  if (savedState.dropChanceUpgradeLevel !== undefined) {
    shinState.dropChanceUpgradeLevel = savedState.dropChanceUpgradeLevel;
  } else {
    shinState.dropChanceUpgradeLevel = 0;
  }
  
  // Initialize tree fractal as unlocked by default
  if (!shinState.fractals['tree']) {
    shinState.fractals['tree'] = {
      allocated: 0,
      layersCompleted: 0,
      unlocked: true
    };
  }
}

/**
 * Fully reset the Shin Spire runtime state so save wipes clear all progress.
 */
export function resetShinState() {
  // Reset headline resources and selection.
  shinState.equivalenceBank = 0;
  shinState.iterationRate = 0;
  shinState.shinGlyphs = 0;
  shinState.activeFractalId = 'tree';
  shinState.accumulatedEquivalence = 0;
  shinState.lastUpdateTime = Date.now();
  
  // Reset grapheme state
  shinState.graphemes = [];
  shinState.activeGraphemeDrops = [];
  shinState.graphemeIdCounter = 0;
  shinState.unlockedGraphemes = [0, 1, 2]; // Start with first 3 graphemes
  shinState.graphemeDropChance = 0.01; // 1% base drop chance
  shinState.graphemeUnlockCost = 250;
  shinState.dropChanceUpgradeCost = 100;
  shinState.dropChanceUpgradeLevel = 0;

  // Rebuild fractal state map with only base progress unlocked by default.
  const resetFractals = {
    tree: { allocated: 0, layersCompleted: 0, unlocked: true },
  };

  fractalDefinitions.forEach((fractal) => {
    if (!fractal?.id || fractal.id === 'tree') {
      return;
    }
    resetFractals[fractal.id] = {
      allocated: 0,
      layersCompleted: 0,
      unlocked: false,
    };
  });

  shinState.fractals = resetFractals;
}

/**
 * Load fractal definitions from JSON file
 */
export async function loadFractalDefinitions() {
  try {
    const response = await fetch('./assets/data/shinFractals.json');
    if (!response.ok) {
      throw new Error(`Failed to load fractal definitions: ${response.status}`);
    }
    const data = await response.json();
    fractalDefinitions = data.fractals || [];
    
    // Initialize fractal states for any missing fractals
    fractalDefinitions.forEach(fractal => {
      if (!shinState.fractals[fractal.id]) {
        shinState.fractals[fractal.id] = {
          allocated: 0,
          layersCompleted: 0,
          unlocked: fractal.id === 'tree' // Tree is unlocked by default
        };
      }
    });
    
    return fractalDefinitions;
  } catch (error) {
    console.error('Error loading fractal definitions:', error);
    return [];
  }
}

/**
 * Get the current Shin state for saving
 */
export function getShinStateSnapshot() {
  return {
    equivalenceBank: shinState.equivalenceBank,
    iterationRate: shinState.iterationRate,
    shinGlyphs: shinState.shinGlyphs,
    activeFractalId: shinState.activeFractalId,
    fractals: { ...shinState.fractals },
    lastUpdateTime: shinState.lastUpdateTime,
    graphemes: [...shinState.graphemes],
    graphemeIdCounter: shinState.graphemeIdCounter,
    unlockedGraphemes: [...shinState.unlockedGraphemes],
    graphemeDropChance: shinState.graphemeDropChance,
    graphemeUnlockCost: shinState.graphemeUnlockCost,
    dropChanceUpgradeCost: shinState.dropChanceUpgradeCost,
    dropChanceUpgradeLevel: shinState.dropChanceUpgradeLevel,
  };
}

/**
 * Update the Shin Spire system (called on each frame or tick)
 * Equivalence from the bank is allocated to the active fractal at the iteration rate.
 */
export function updateShinState(deltaTime) {
  if (!shinState.activeFractalId) {
    return;
  }
  
  const activeFractal = shinState.fractals[shinState.activeFractalId];
  if (!activeFractal || !activeFractal.unlocked) {
    return;
  }
  
  // Calculate how many units of Equivalence to allocate from the bank based on iteration rate
  // and time elapsed. Accumulate fractional Equivalence across frames.
  if (shinState.equivalenceBank > 0) {
    shinState.accumulatedEquivalence += shinState.iterationRate * (deltaTime / 1000);
    const wholeEquivalence = Math.floor(shinState.accumulatedEquivalence);
    
    if (wholeEquivalence > 0) {
      const actualEquivalence = Math.min(wholeEquivalence, shinState.equivalenceBank);
      if (actualEquivalence > 0) {
        const result = allocateEquivalence(shinState.activeFractalId, actualEquivalence);
        if (result.success) {
          shinState.equivalenceBank -= actualEquivalence;
          shinState.accumulatedEquivalence -= actualEquivalence;
        }
      }
    }
  }
  
  shinState.lastUpdateTime = Date.now();
}

/**
 * Allocate Equivalence to a specific fractal
 * @param {string} fractalId - The ID of the fractal to allocate to
 * @param {number} amount - The amount of Equivalence to allocate
 * @returns {Object} Result object with success status and any earned glyphs
 */
export function allocateEquivalence(fractalId, amount) {
  const fractalState = shinState.fractals[fractalId];
  if (!fractalState || !fractalState.unlocked) {
    return { success: false, message: 'Fractal not unlocked' };
  }
  
  const definition = fractalDefinitions.find(f => f.id === fractalId);
  if (!definition) {
    return { success: false, message: 'Fractal definition not found' };
  }
  
  const previousAllocated = fractalState.allocated;
  fractalState.allocated += amount;
  
  // Check if any layers were completed
  const previousLayer = fractalState.layersCompleted;
  let newLayersCompleted = 0;
  
  for (let i = previousLayer; i < definition.layerThresholds.length; i++) {
    if (fractalState.allocated >= definition.layerThresholds[i]) {
      newLayersCompleted++;
      fractalState.layersCompleted = i + 1;
    } else {
      break;
    }
  }
  
  // Award Shin glyphs for completed layers
  if (newLayersCompleted > 0) {
    shinState.shinGlyphs += newLayersCompleted;
  }
  
  // Check if the next fractal should be unlocked
  if (fractalState.allocated >= FRACTAL_UNLOCK_THRESHOLD) {
    const currentIndex = fractalDefinitions.findIndex(f => f.id === fractalId);
    if (currentIndex >= 0 && currentIndex < fractalDefinitions.length - 1) {
      const nextFractal = fractalDefinitions[currentIndex + 1];
      if (nextFractal && shinState.fractals[nextFractal.id]) {
        shinState.fractals[nextFractal.id].unlocked = true;
      }
    }
  }
  
  return {
    success: true,
    glyphsEarned: newLayersCompleted,
    allocated: fractalState.allocated,
    layersCompleted: fractalState.layersCompleted
  };
}

/**
 * Set the active fractal for iteration allocation
 */
export function setActiveFractal(fractalId) {
  const fractalState = shinState.fractals[fractalId];
  if (!fractalState || !fractalState.unlocked) {
    return false;
  }
  
  shinState.activeFractalId = fractalId;
  return true;
}

/**
 * Get the current active fractal ID
 */
export function getActiveFractalId() {
  return shinState.activeFractalId;
}

/**
 * Get the state of a specific fractal
 */
export function getFractalState(fractalId) {
  return shinState.fractals[fractalId] || null;
}

/**
 * Get all fractal definitions
 */
export function getFractalDefinitions() {
  return fractalDefinitions;
}

/**
 * Get the current Equivalence bank
 */
export function getEquivalenceBank() {
  return shinState.equivalenceBank;
}

/**
 * Add Equivalence to the bank
 */
export function addEquivalence(amount) {
  shinState.equivalenceBank += amount;
  return shinState.equivalenceBank;
}

/**
 * Spend Equivalence from the bank
 * @param {number} amount - The amount of Equivalence to spend
 * @returns {boolean} True if the spend was successful (had enough Equivalence)
 */
export function spendEquivalence(amount) {
  if (amount <= 0) return false;
  if (shinState.equivalenceBank < amount) return false;
  shinState.equivalenceBank -= amount;
  return true;
}

// Legacy exports for backward compatibility (to be removed after migration)
export const getIteronBank = getEquivalenceBank;
export const addIterons = addEquivalence;
export const spendIterons = spendEquivalence;
export const allocateIterons = allocateEquivalence;

/**
 * Get the current iteration rate
 */
export function getIterationRate() {
  return shinState.iterationRate;
}

/**
 * Set the iteration rate
 */
export function setIterationRate(rate) {
  shinState.iterationRate = Math.max(0, rate);
  return shinState.iterationRate;
}

/**
 * Get the current Shin glyph count
 */
export function getShinGlyphs() {
  return shinState.shinGlyphs;
}

/**
 * Add shin glyphs to the total.
 * @param {number} amount - Number of glyphs to add
 * @returns {number} The new total
 */
export function addShinGlyphs(amount) {
  const normalized = Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));
  shinState.shinGlyphs += normalized;
  return shinState.shinGlyphs;
}

/**
 * Override the stored Shin glyph total for developer workflows.
 */
export function setShinGlyphs(value) {
  const normalized = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  shinState.shinGlyphs = normalized;
  return shinState.shinGlyphs;
}

/**
 * Get progress to the next layer for a fractal
 * @param {string} fractalId - The ID of the fractal
 * @returns {Object} Progress info with current, next threshold, and percentage
 */
export function getLayerProgress(fractalId) {
  const fractalState = shinState.fractals[fractalId];
  const definition = fractalDefinitions.find(f => f.id === fractalId);
  
  if (!fractalState || !definition) {
    return null;
  }
  
  const currentLayer = fractalState.layersCompleted;
  const allocated = fractalState.allocated;
  
  if (currentLayer >= definition.layerThresholds.length) {
    return {
      complete: true,
      current: allocated,
      next: null,
      percentage: 100
    };
  }
  
  const nextThreshold = definition.layerThresholds[currentLayer];
  const previousThreshold = currentLayer > 0 ? definition.layerThresholds[currentLayer - 1] : 0;
  const progress = allocated - previousThreshold;
  const needed = nextThreshold - previousThreshold;
  // Guard against division by zero if thresholds are misconfigured
  const percentage = needed > 0 ? (progress / needed) * 100 : 0;
  
  return {
    complete: false,
    current: allocated,
    next: nextThreshold,
    previous: previousThreshold,
    progress,
    needed,
    percentage: Math.min(100, Math.max(0, percentage)),
    layer: currentLayer
  };
}

/**
 * Unlock all fractals (for developer mode)
 */
export function unlockAllFractals() {
  // Unlock all fractals that have been initialized
  Object.keys(shinState.fractals).forEach(fractalId => {
    shinState.fractals[fractalId].unlocked = true;
  });
  
  // Also ensure fractal definitions are unlocked if they exist
  fractalDefinitions.forEach(fractal => {
    if (!shinState.fractals[fractal.id]) {
      shinState.fractals[fractal.id] = {
        allocated: 0,
        layersCompleted: 0,
        unlocked: true
      };
    } else {
      shinState.fractals[fractal.id].unlocked = true;
    }
  });
}

// ============================================================
// Grapheme System
// ============================================================

/**
 * Available grapheme characters from the custom script (Script.png).
 * The script contains 35 unique characters arranged in a 7x5 grid.
 * ThoughtSpeak Language Structure:
 * - Indices 0-25: Letters A-Z (26 total) - can be collected by player and equipped to weapons
 * - Indices 26-33: Numbers 1-8 (8 total) - CANNOT be collected (used for UI only)
 * 
 * Characters are represented by their index (0-33) and rendered from the sprite sheet.
 */
const GRAPHEME_CHARACTERS = [
  // Letters (indices 0-25): 26 letters A-Z that can be collected and equipped
  // Row 1 (indices 0-6)
  { index: 0, name: 'A', property: 'fire', row: 0, col: 0, collectable: true },
  { index: 1, name: 'B', property: 'pierce', row: 0, col: 1, collectable: true },
  { index: 2, name: 'C', property: 'speed', row: 0, col: 2, collectable: true },
  { index: 3, name: 'D', property: 'ice', row: 0, col: 3, collectable: true },
  { index: 4, name: 'E', property: 'homing', row: 0, col: 4, collectable: true },
  { index: 5, name: 'F', property: 'spread', row: 0, col: 5, collectable: true },
  { index: 6, name: 'G', property: 'chain', row: 0, col: 6, collectable: true },
  // Row 2 (indices 7-13)
  { index: 7, name: 'H', property: 'damage', row: 1, col: 0, collectable: true },
  { index: 8, name: 'I', property: 'range', row: 1, col: 1, collectable: true },
  { index: 9, name: 'J', property: 'splash', row: 1, col: 2, collectable: true },
  { index: 10, name: 'K', property: 'penetration', row: 1, col: 3, collectable: true },
  { index: 11, name: 'L', property: 'lifesteal', row: 1, col: 4, collectable: true },
  { index: 12, name: 'M', property: 'crit', row: 1, col: 5, collectable: true },
  { index: 13, name: 'N', property: 'slow', row: 1, col: 6, collectable: true },
  // Row 3 (indices 14-20)
  { index: 14, name: 'O', property: 'burn', row: 2, col: 0, collectable: true },
  { index: 15, name: 'P', property: 'freeze', row: 2, col: 1, collectable: true },
  { index: 16, name: 'Q', property: 'shock', row: 2, col: 2, collectable: true },
  { index: 17, name: 'R', property: 'poison', row: 2, col: 3, collectable: true },
  { index: 18, name: 'S', property: 'stun', row: 2, col: 4, collectable: true },
  { index: 19, name: 'T', property: 'knockback', row: 2, col: 5, collectable: true },
  { index: 20, name: 'U', property: 'reflect', row: 2, col: 6, collectable: true },
  // Row 4 (indices 21-25)
  { index: 21, name: 'V', property: 'leech', row: 3, col: 0, collectable: true },
  { index: 22, name: 'W', property: 'execute', row: 3, col: 1, collectable: true },
  { index: 23, name: 'X', property: 'resurrect', row: 3, col: 2, collectable: true },
  { index: 24, name: 'Y', property: 'duplicate', row: 3, col: 3, collectable: true },
  { index: 25, name: 'Z', property: 'expand', row: 3, col: 4, collectable: true },
  
  // Numbers (indices 26-33): ThoughtSpeak numbers 1-8, NOT collectable by player
  { index: 26, name: 'number-1', property: 'numeral', row: 3, col: 5, collectable: false },
  { index: 27, name: 'number-2', property: 'numeral', row: 3, col: 6, collectable: false },
  { index: 28, name: 'number-3', property: 'numeral', row: 4, col: 0, collectable: false },
  { index: 29, name: 'number-4', property: 'numeral', row: 4, col: 1, collectable: false },
  { index: 30, name: 'number-5', property: 'numeral', row: 4, col: 2, collectable: false },
  { index: 31, name: 'number-6', property: 'numeral', row: 4, col: 3, collectable: false },
  { index: 32, name: 'number-7', property: 'numeral', row: 4, col: 4, collectable: false },
  { index: 33, name: 'number-8', property: 'numeral', row: 4, col: 5, collectable: false },
];

/**
 * Get a random grapheme character from the unlocked set for drops.
 * Only returns collectable graphemes (letters and punctuation, not numbers).
 * @returns {Object} A grapheme definition with index and property
 */
export function getRandomGrapheme() {
  const unlockedIndices = shinState.unlockedGraphemes;
  if (unlockedIndices.length === 0) {
    // Fallback to first grapheme if no graphemes are unlocked
    return { ...GRAPHEME_CHARACTERS[0] };
  }
  const randomUnlockedIndex = unlockedIndices[Math.floor(Math.random() * unlockedIndices.length)];
  const grapheme = GRAPHEME_CHARACTERS[randomUnlockedIndex];
  // Safety check: ensure only collectable graphemes can be dropped
  if (!grapheme.collectable) {
    return { ...GRAPHEME_CHARACTERS[0] };
  }
  return { ...grapheme };
}

/**
 * Spawn a grapheme drop at the given position.
 * @param {number} x - X coordinate on the canvas
 * @param {number} y - Y coordinate on the canvas
 * @returns {Object} The created grapheme drop
 */
export function spawnGraphemeDrop(x, y) {
  const grapheme = getRandomGrapheme();
  shinState.graphemeIdCounter += 1;
  const drop = {
    id: `grapheme-${shinState.graphemeIdCounter}`,
    index: grapheme.index,
    name: grapheme.name,
    property: grapheme.property,
    row: grapheme.row,
    col: grapheme.col,
    x,
    y,
    spawnTime: Date.now(),
    opacity: 1,
    pulse: 0,
  };
  shinState.activeGraphemeDrops.push(drop);
  return drop;
}

/**
 * Get all active grapheme drops on the battlefield.
 * @returns {Array} Array of grapheme drop objects
 */
export function getActiveGraphemeDrops() {
  return shinState.activeGraphemeDrops;
}

/**
 * Collect a grapheme drop by its ID.
 * Moves the drop from activeGraphemeDrops to the collected graphemes array.
 * @param {string} dropId - The ID of the drop to collect
 * @returns {Object|null} The collected grapheme or null if not found
 */
export function collectGraphemeDrop(dropId) {
  const index = shinState.activeGraphemeDrops.findIndex(drop => drop.id === dropId);
  if (index === -1) {
    return null;
  }
  
  const drop = shinState.activeGraphemeDrops[index];
  shinState.activeGraphemeDrops.splice(index, 1);
  
  // Add to collected graphemes
  const collected = {
    id: drop.id,
    index: drop.index,
    name: drop.name,
    property: drop.property,
    collectedAt: Date.now(),
  };
  shinState.graphemes.push(collected);
  
  return collected;
}

/**
 * Clear all active grapheme drops from the battlefield.
 * Called when the Cardinal Warden dies.
 */
export function clearActiveGraphemeDrops() {
  shinState.activeGraphemeDrops = [];
}

/**
 * Get all collected graphemes.
 * @returns {Array} Array of collected grapheme objects
 */
export function getCollectedGraphemes() {
  return shinState.graphemes;
}

/**
 * Get the count of collected graphemes.
 * @returns {number} The number of collected graphemes
 */
export function getGraphemeCount() {
  return shinState.graphemes.length;
}

/**
 * Get grapheme count grouped by index.
 * @returns {Object} Map of index to count
 */
export function getGraphemeCountsByIndex() {
  const counts = {};
  for (const grapheme of shinState.graphemes) {
    const idx = grapheme.index !== undefined ? grapheme.index : -1;
    counts[idx] = (counts[idx] || 0) + 1;
  }
  return counts;
}

/**
 * Get the list of all available grapheme characters.
 * @returns {Array} Array of grapheme character definitions
 */
export function getGraphemeCharacters() {
  return [...GRAPHEME_CHARACTERS];
}

/**
 * Get the list of unlocked grapheme indices.
 * @returns {Array} Array of unlocked indices
 */
export function getUnlockedGraphemes() {
  return [...shinState.unlockedGraphemes];
}

/**
 * Unlock the next grapheme in sequence.
 * Only unlocks collectable graphemes (letters and punctuation, not numbers).
 * @returns {Object} Result with success status and the unlocked grapheme index
 */
export function unlockNextGrapheme() {
  const cost = shinState.graphemeUnlockCost;
  
  if (shinState.equivalenceBank < cost) {
    return { success: false, message: 'Not enough Equivalence' };
  }
  
  // Find the next collectable grapheme to unlock
  const collectableGraphemes = GRAPHEME_CHARACTERS.filter(g => g.collectable);
  const nextIndex = shinState.unlockedGraphemes.length;
  if (nextIndex >= collectableGraphemes.length) {
    return { success: false, message: 'All graphemes already unlocked' };
  }
  
  // Get the actual index of the next collectable grapheme
  const graphemeToUnlock = collectableGraphemes[nextIndex];
  
  // Spend the Equivalence
  shinState.equivalenceBank -= cost;
  
  // Unlock the grapheme
  shinState.unlockedGraphemes.push(graphemeToUnlock.index);
  
  // Multiply cost by 5 for next unlock
  shinState.graphemeUnlockCost = Math.floor(cost * 5);
  
  return {
    success: true,
    unlockedIndex: graphemeToUnlock.index,
    grapheme: graphemeToUnlock,
    newCost: shinState.graphemeUnlockCost
  };
}

/**
 * Get the current cost to unlock the next grapheme.
 * @returns {number} Cost in Equivalence
 */
export function getGraphemeUnlockCost() {
  return shinState.graphemeUnlockCost;
}

/**
 * Upgrade the grapheme drop chance.
 * @returns {Object} Result with success status and new drop chance
 */
export function upgradeDropChance() {
  const cost = shinState.dropChanceUpgradeCost;
  
  if (shinState.equivalenceBank < cost) {
    return { success: false, message: 'Not enough Equivalence' };
  }
  
  // Spend the Equivalence
  shinState.equivalenceBank -= cost;
  
  // Increase drop chance by 1%
  shinState.graphemeDropChance += 0.01;
  shinState.dropChanceUpgradeLevel += 1;
  
  // Multiply cost by 10 for next upgrade
  shinState.dropChanceUpgradeCost = Math.floor(cost * 10);
  
  return {
    success: true,
    newDropChance: shinState.graphemeDropChance,
    level: shinState.dropChanceUpgradeLevel,
    newCost: shinState.dropChanceUpgradeCost
  };
}

/**
 * Get the current grapheme drop chance.
 * @returns {number} Drop chance as a decimal (0.01 = 1%)
 */
export function getGraphemeDropChance() {
  return shinState.graphemeDropChance;
}

/**
 * Get the current cost to upgrade drop chance.
 * @returns {number} Cost in Equivalence
 */
export function getDropChanceUpgradeCost() {
  return shinState.dropChanceUpgradeCost;
}

/**
 * Get the current drop chance upgrade level.
 * @returns {number} Number of upgrades purchased
 */
export function getDropChanceUpgradeLevel() {
  return shinState.dropChanceUpgradeLevel;
}

/**
 * Consume a grapheme from inventory when placing it in a weapon slot.
 * @param {number} index - The index of the grapheme to consume
 * @returns {boolean} True if the grapheme was successfully consumed
 */
export function consumeGrapheme(index) {
  // Validate index is within valid range
  if (!Number.isInteger(index) || index < 0 || index >= GRAPHEME_CHARACTERS.length) {
    return false;
  }
  
  // Find the first grapheme with matching index
  const graphemeIdx = shinState.graphemes.findIndex(g => g.index === index);
  if (graphemeIdx === -1) {
    return false;
  }
  
  // Remove it from the inventory
  shinState.graphemes.splice(graphemeIdx, 1);
  return true;
}

/**
 * Return a grapheme to inventory when removing it from a weapon slot.
 * @param {number} index - The index of the grapheme to return
 */
export function returnGrapheme(index) {
  // Validate index is within valid range
  if (!Number.isInteger(index) || index < 0 || index >= GRAPHEME_CHARACTERS.length) {
    return;
  }
  
  const graphemeChar = GRAPHEME_CHARACTERS[index];
  
  // Add grapheme back to inventory
  shinState.graphemeIdCounter += 1;
  const returned = {
    id: `grapheme-${shinState.graphemeIdCounter}`,
    index: index,
    name: graphemeChar.name,
    property: graphemeChar.property,
    collectedAt: Date.now(),
  };
  shinState.graphemes.push(returned);
}

// Legacy exports for backward compatibility (to be removed after migration)
export const spawnPhonemeDrop = spawnGraphemeDrop;
export const getActivePhonemeDrops = getActiveGraphemeDrops;
export const collectPhonemeDrop = collectGraphemeDrop;
export const clearActivePhonemeDrops = clearActiveGraphemeDrops;
export const getCollectedPhonemes = getCollectedGraphemes;
export const getPhonemeCount = getGraphemeCount;
export const getPhonemeCountsByChar = getGraphemeCountsByIndex;
export const getPhonemeCharacters = getGraphemeCharacters;
