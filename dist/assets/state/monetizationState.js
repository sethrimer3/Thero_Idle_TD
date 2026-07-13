// Monetization state for in-app purchases and ad-based boosts.
// Tracks premium unlock status and cooldowns for boost actions.

export const MONETIZATION_STORAGE_KEY = 'glyph-defense-idle:monetization';

// Spire identifiers matching the spire system
const SPIRE_IDS = ['powder', 'fluid', 'lamed', 'tsadi', 'shin', 'kuf'];

// Cooldown duration for ad-based boosts (in milliseconds)
const AD_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown

// Default state structure
const DEFAULT_STATE = {
  premiumUnlocked: false,
  boostCooldowns: {
    powder: 0,
    fluid: 0,
    lamed: 0,
    tsadi: 0,
    shin: 0,
    kuf: 0,
    gems: 0,
  },
};

// In-memory state
let currentState = { ...DEFAULT_STATE, boostCooldowns: { ...DEFAULT_STATE.boostCooldowns } };
let stateListeners = new Set();

/**
 * Load persisted monetization state from localStorage.
 */
export function loadMonetizationState() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  
  try {
    const stored = window.localStorage.getItem(MONETIZATION_STORAGE_KEY);
    if (!stored) {
      return;
    }
    
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object') {
      currentState.premiumUnlocked = Boolean(parsed.premiumUnlocked);
      if (parsed.boostCooldowns && typeof parsed.boostCooldowns === 'object') {
        Object.assign(currentState.boostCooldowns, parsed.boostCooldowns);
      }
    }
  } catch (error) {
    console.warn('Failed to load monetization state:', error);
  }
}

/**
 * Persist current monetization state to localStorage.
 */
function saveMonetizationState() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  
  try {
    window.localStorage.setItem(MONETIZATION_STORAGE_KEY, JSON.stringify(currentState));
  } catch (error) {
    console.warn('Failed to save monetization state:', error);
  }
}

/**
 * Notify all listeners of state changes.
 */
function notifyListeners() {
  const snapshot = getMonetizationState();
  stateListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.warn('Monetization listener error:', error);
    }
  });
}

/**
 * Get a snapshot of the current monetization state.
 * @returns {Object} State snapshot
 */
export function getMonetizationState() {
  return {
    premiumUnlocked: currentState.premiumUnlocked,
    boostCooldowns: { ...currentState.boostCooldowns },
  };
}

/**
 * Check if a specific boost is on cooldown.
 * @param {string} boostType - Type of boost (spire id or 'gems')
 * @returns {Object} { onCooldown: boolean, remainingMs: number }
 */
export function getBoostCooldown(boostType) {
  const cooldownEnd = currentState.boostCooldowns[boostType] || 0;
  const now = Date.now();
  const remainingMs = Math.max(0, cooldownEnd - now);
  
  return {
    onCooldown: remainingMs > 0,
    remainingMs,
  };
}

/**
 * Unlock premium features (mock in-app purchase).
 * @returns {boolean} Success status
 */
export function unlockPremium() {
  currentState.premiumUnlocked = true;
  saveMonetizationState();
  notifyListeners();
  return true;
}

/**
 * Start a cooldown for a specific boost type.
 * @param {string} boostType - Type of boost (spire id or 'gems')
 */
function startBoostCooldown(boostType) {
  currentState.boostCooldowns[boostType] = Date.now() + AD_COOLDOWN_MS;
  saveMonetizationState();
  notifyListeners();
}

/**
 * Mock watching an ad (simulates ad completion after a short delay).
 * @returns {Promise<boolean>} Resolves to true when "ad" completes
 */
function watchAdMock() {
  return new Promise((resolve) => {
    // Simulate ad watching with a 1 second delay
    setTimeout(() => {
      resolve(true);
    }, 1000);
  });
}

/**
 * Trigger a spire idle boost (watch ad for 2 hours of idle time).
 * @param {string} spireId - ID of the spire to boost
 * @param {Function} applyIdleTime - Callback to apply idle time to the spire
 * @returns {Promise<Object>} Result object with success status
 */
export async function triggerSpireBoost(spireId, applyIdleTime) {
  if (!SPIRE_IDS.includes(spireId)) {
    return { success: false, error: 'Invalid spire ID' };
  }
  
  const cooldown = getBoostCooldown(spireId);
  if (cooldown.onCooldown) {
    return { success: false, error: 'Boost on cooldown', remainingMs: cooldown.remainingMs };
  }
  
  // Mock ad watching
  const adWatched = await watchAdMock();
  if (!adWatched) {
    return { success: false, error: 'Ad watch failed' };
  }
  
  // Apply 2 hours of idle time (in seconds)
  const idleTimeSeconds = 2 * 60 * 60;
  if (typeof applyIdleTime === 'function') {
    applyIdleTime(spireId, idleTimeSeconds);
  }
  
  // Start cooldown
  startBoostCooldown(spireId);
  
  return { success: true, idleTimeSeconds };
}

/**
 * Trigger gem boost (watch ad for 100 random gems).
 * @param {Function} grantGems - Callback to grant gems
 * @returns {Promise<Object>} Result object with success status
 */
export async function triggerGemBoost(grantGems) {
  const cooldown = getBoostCooldown('gems');
  if (cooldown.onCooldown) {
    return { success: false, error: 'Boost on cooldown', remainingMs: cooldown.remainingMs };
  }
  
  // Mock ad watching
  const adWatched = await watchAdMock();
  if (!adWatched) {
    return { success: false, error: 'Ad watch failed' };
  }
  
  // Grant 100 random gems
  if (typeof grantGems === 'function') {
    const gemsGranted = grantGems(100);
    startBoostCooldown('gems');
    return { success: true, gemsGranted };
  }
  
  return { success: false, error: 'Grant function not provided' };
}

/**
 * Subscribe to monetization state changes.
 * @param {Function} listener - Callback function
 * @returns {Function} Unsubscribe function
 */
export function addMonetizationListener(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  
  stateListeners.add(listener);
  
  // Call immediately with current state
  try {
    listener(getMonetizationState());
  } catch (error) {
    console.warn('Monetization listener error:', error);
  }
  
  return () => {
    stateListeners.delete(listener);
  };
}
