/**
 * Shin Spire State Management
 * 
 * Manages the Iteron resource system and fractal progression for the Shin Spire.
 * Iterons are allocated to fractals to increase their complexity, and when a
 * fractal completes a layer, the player earns a Shin glyph.
 */

/**
 * Number of iterons required in a fractal before the next fractal unlocks
 */
const FRACTAL_UNLOCK_THRESHOLD = 100;

/**
 * State for the Shin Spire system
 */
const shinState = {
  iteronBank: 0,                    // Total unallocated iterons available
  iterationRate: 0,                 // Allocations per second (starts at 0)
  shinGlyphs: 0,                    // Total Shin glyphs earned
  activeFractalId: 'tree',          // Currently selected fractal
  fractals: {},                     // State for each fractal: { id: { allocated: number, layersCompleted: number, unlocked: boolean } }
  lastUpdateTime: Date.now(),       // For calculating automatic allocation
  accumulatedIterons: 0,            // Accumulator for fractional iterons
  phonemes: [],                     // Collected phonemes (script characters) - each entry: { id: string, char: string, collected: timestamp }
  activePhonemeDrops: [],           // Currently visible phoneme drops on the battlefield - each entry: { id: string, char: string, x: number, y: number, spawnTime: number }
  phonemeIdCounter: 0,              // Counter for generating unique phoneme IDs
};

/**
 * Fractal definitions loaded from JSON
 */
let fractalDefinitions = [];

/**
 * Initialize the Shin Spire system with saved state
 */
export function initializeShinState(savedState = {}) {
  if (savedState.iteronBank !== undefined) {
    shinState.iteronBank = savedState.iteronBank;
  } else {
    // Start with 0 Iterons in the bank for new games
    shinState.iteronBank = 0;
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
  
  // Initialize phonemes from saved state
  if (Array.isArray(savedState.phonemes)) {
    shinState.phonemes = savedState.phonemes;
  } else {
    shinState.phonemes = [];
  }
  // Active drops are never persisted - they disappear when the warden dies
  shinState.activePhonemeDrops = [];
  if (savedState.phonemeIdCounter !== undefined) {
    shinState.phonemeIdCounter = savedState.phonemeIdCounter;
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
  shinState.iteronBank = 0;
  shinState.iterationRate = 0;
  shinState.shinGlyphs = 0;
  shinState.activeFractalId = 'tree';
  shinState.accumulatedIterons = 0;
  shinState.lastUpdateTime = Date.now();
  
  // Reset phoneme state
  shinState.phonemes = [];
  shinState.activePhonemeDrops = [];
  shinState.phonemeIdCounter = 0;

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
    iteronBank: shinState.iteronBank,
    iterationRate: shinState.iterationRate,
    shinGlyphs: shinState.shinGlyphs,
    activeFractalId: shinState.activeFractalId,
    fractals: { ...shinState.fractals },
    lastUpdateTime: shinState.lastUpdateTime,
    phonemes: [...shinState.phonemes],
    phonemeIdCounter: shinState.phonemeIdCounter,
  };
}

/**
 * Update the Shin Spire system (called on each frame or tick)
 * Iterons from the bank are allocated to the active fractal at the iteration rate.
 */
export function updateShinState(deltaTime) {
  if (!shinState.activeFractalId) {
    return;
  }
  
  const activeFractal = shinState.fractals[shinState.activeFractalId];
  if (!activeFractal || !activeFractal.unlocked) {
    return;
  }
  
  // Calculate how many iterons to allocate from the bank based on iteration rate
  // and time elapsed. Accumulate fractional iterons across frames.
  if (shinState.iteronBank > 0) {
    shinState.accumulatedIterons += shinState.iterationRate * (deltaTime / 1000);
    const wholIterons = Math.floor(shinState.accumulatedIterons);
    
    if (wholIterons > 0) {
      const actualIterons = Math.min(wholIterons, shinState.iteronBank);
      if (actualIterons > 0) {
        const result = allocateIterons(shinState.activeFractalId, actualIterons);
        if (result.success) {
          shinState.iteronBank -= actualIterons;
          shinState.accumulatedIterons -= actualIterons;
        }
      }
    }
  }
  
  shinState.lastUpdateTime = Date.now();
}

/**
 * Allocate iterons to a specific fractal
 * @param {string} fractalId - The ID of the fractal to allocate to
 * @param {number} amount - The number of iterons to allocate
 * @returns {Object} Result object with success status and any earned glyphs
 */
export function allocateIterons(fractalId, amount) {
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
 * Get the current iteron bank
 */
export function getIteronBank() {
  return shinState.iteronBank;
}

/**
 * Add iterons to the bank
 */
export function addIterons(amount) {
  shinState.iteronBank += amount;
  return shinState.iteronBank;
}

/**
 * Spend iterons from the bank
 * @param {number} amount - The number of iterons to spend
 * @returns {boolean} True if the spend was successful (had enough iterons)
 */
export function spendIterons(amount) {
  if (amount <= 0) return false;
  if (shinState.iteronBank < amount) return false;
  shinState.iteronBank -= amount;
  return true;
}

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
// Phoneme System
// ============================================================

/**
 * Available phoneme characters from the custom script.
 * Each phoneme has a unique glyph and associated weapon property.
 */
const PHONEME_CHARACTERS = [
  { char: 'ש', name: 'shin', property: 'fire' },
  { char: 'ב', name: 'bet', property: 'pierce' },
  { char: 'ל', name: 'lamed', property: 'speed' },
  { char: 'צ', name: 'tsadi', property: 'ice' },
  { char: 'ק', name: 'qoph', property: 'homing' },
  { char: 'ר', name: 'resh', property: 'spread' },
  { char: 'ע', name: 'ayin', property: 'chain' },
  { char: 'ת', name: 'tav', property: 'damage' },
];

/**
 * Get a random phoneme character for drops.
 * @returns {Object} A phoneme definition with char and property
 */
export function getRandomPhoneme() {
  const index = Math.floor(Math.random() * PHONEME_CHARACTERS.length);
  return { ...PHONEME_CHARACTERS[index] };
}

/**
 * Spawn a phoneme drop at the given position.
 * @param {number} x - X coordinate on the canvas
 * @param {number} y - Y coordinate on the canvas
 * @returns {Object} The created phoneme drop
 */
export function spawnPhonemeDrop(x, y) {
  const phoneme = getRandomPhoneme();
  shinState.phonemeIdCounter += 1;
  const drop = {
    id: `phoneme-${shinState.phonemeIdCounter}`,
    char: phoneme.char,
    name: phoneme.name,
    property: phoneme.property,
    x,
    y,
    spawnTime: Date.now(),
    opacity: 1,
    pulse: 0,
  };
  shinState.activePhonemeDrops.push(drop);
  return drop;
}

/**
 * Get all active phoneme drops on the battlefield.
 * @returns {Array} Array of phoneme drop objects
 */
export function getActivePhonemeDrops() {
  return shinState.activePhonemeDrops;
}

/**
 * Collect a phoneme drop by its ID.
 * Moves the drop from activePhonemeDrops to the collected phonemes array.
 * @param {string} dropId - The ID of the drop to collect
 * @returns {Object|null} The collected phoneme or null if not found
 */
export function collectPhonemeDrop(dropId) {
  const index = shinState.activePhonemeDrops.findIndex(drop => drop.id === dropId);
  if (index === -1) {
    return null;
  }
  
  const drop = shinState.activePhonemeDrops[index];
  shinState.activePhonemeDrops.splice(index, 1);
  
  // Add to collected phonemes
  const collected = {
    id: drop.id,
    char: drop.char,
    name: drop.name,
    property: drop.property,
    collectedAt: Date.now(),
  };
  shinState.phonemes.push(collected);
  
  return collected;
}

/**
 * Clear all active phoneme drops from the battlefield.
 * Called when the Cardinal Warden dies.
 */
export function clearActivePhonemeDrops() {
  shinState.activePhonemeDrops = [];
}

/**
 * Get all collected phonemes.
 * @returns {Array} Array of collected phoneme objects
 */
export function getCollectedPhonemes() {
  return shinState.phonemes;
}

/**
 * Get the count of collected phonemes.
 * @returns {number} The number of collected phonemes
 */
export function getPhonemeCount() {
  return shinState.phonemes.length;
}

/**
 * Get phoneme count grouped by character.
 * @returns {Object} Map of character to count
 */
export function getPhonemeCountsByChar() {
  const counts = {};
  for (const phoneme of shinState.phonemes) {
    counts[phoneme.char] = (counts[phoneme.char] || 0) + 1;
  }
  return counts;
}

/**
 * Get the list of all available phoneme characters.
 * @returns {Array} Array of phoneme character definitions
 */
export function getPhonemeCharacters() {
  return [...PHONEME_CHARACTERS];
}
