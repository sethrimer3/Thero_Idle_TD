/**
 * Spire Idle Generation System
 * 
 * Manages generation-per-minute mechanics and catch-up simulation for spires.
 * This replaces the old idle bank system with a more intuitive generation rate approach.
 * 
 * Key Concepts:
 * - Each spire generates resources per minute based on formulas
 * - Generation rates cascade: Bet depends on Aleph, Gimel depends on Bet, etc.
 * - When player returns from idle time, simulations "fast forward" to catch up
 * - No more idle banks - resources are generated and applied directly
 */

/**
 * Factory that creates the spire idle generation system.
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.spireResourceState - Persistent state for each spire
 * @returns {Object} Helper functions for managing spire generation
 */
export function createSpireIdleGeneration({ spireResourceState }) {
  if (!spireResourceState.lamed) {
    spireResourceState.lamed = {};
  }
  if (!spireResourceState.tsadi) {
    spireResourceState.tsadi = {};
  }
  if (!spireResourceState.bet) {
    spireResourceState.bet = {};
  }

  const lamedState = spireResourceState.lamed;
  const tsadiState = spireResourceState.tsadi;
  const betState = spireResourceState.bet;

  /**
   * Calculate Lamed (Aleph) spire generation rate in motes per minute.
   * This is the base generation rate that other spires depend on.
   * 
   * @returns {number} Motes generated per minute
   */
  function getLamedGenerationRate() {
    // Base rate: 100 motes per minute
    // Can be scaled by upgrades in the future
    const baseRate = 100;
    const upgradeMultiplier = 1.0; // Placeholder for future upgrades
    return baseRate * upgradeMultiplier;
  }

  /**
   * Calculate Tsadi spire generation rate in particles per minute.
   * Based on Lamed generation rate: 1 particle per 100 motes.
   * 
   * @returns {number} Particles generated per minute
   */
  function getTsadiGenerationRate() {
    const lamedRate = getLamedGenerationRate();
    // 1 particle per 100 Lamed motes
    return lamedRate / 100;
  }

  /**
   * Calculate Bet spire generation rate in scintilla per minute.
   * Based on Lamed generation rate: 1 scintilla per 100 motes.
   * 
   * @returns {number} Scintilla generated per minute
   */
  function getBetGenerationRate() {
    const lamedRate = getLamedGenerationRate();
    // 1 scintilla per 100 Lamed motes (as specified in the problem statement)
    return lamedRate / 100;
  }

  /**
   * Initialize or update the last active timestamp for a spire.
   * Called when a spire becomes active or when saving state.
   * 
   * @param {string} spireName - Name of the spire ('lamed', 'tsadi', 'bet')
   * @param {number} timestamp - Current timestamp in milliseconds (defaults to Date.now())
   */
  function updateLastActiveTime(spireName, timestamp = Date.now()) {
    const state = spireName === 'lamed' ? lamedState : spireName === 'tsadi' ? tsadiState : betState;
    if (state) {
      state.lastActiveTime = timestamp;
    }
  }

  /**
   * Get the last active timestamp for a spire.
   * 
   * @param {string} spireName - Name of the spire ('lamed', 'tsadi', 'bet')
   * @returns {number} Last active timestamp in milliseconds, or current time if not set
   */
  function getLastActiveTime(spireName) {
    const state = spireName === 'lamed' ? lamedState : spireName === 'tsadi' ? tsadiState : betState;
    return state?.lastActiveTime || Date.now();
  }

  /**
   * Calculate idle gains for a spire based on elapsed time.
   * This is used for the "catch up" mechanic when returning from idle.
   * 
   * @param {string} spireName - Name of the spire ('lamed', 'tsadi', 'bet')
   * @param {number} elapsedMinutes - Time elapsed in minutes
   * @returns {number} Total resources generated during idle time
   */
  function calculateIdleGains(spireName, elapsedMinutes) {
    let ratePerMinute = 0;
    
    switch (spireName) {
      case 'lamed':
        ratePerMinute = getLamedGenerationRate();
        break;
      case 'tsadi':
        ratePerMinute = getTsadiGenerationRate();
        break;
      case 'bet':
        ratePerMinute = getBetGenerationRate();
        break;
    }
    
    return Math.floor(ratePerMinute * elapsedMinutes);
  }

  /**
   * Process catch-up for all spires when returning from idle time.
   * Calculates elapsed time and returns the resources that should be spawned.
   * 
   * @param {number} currentTime - Current timestamp in milliseconds (defaults to Date.now())
   * @returns {Object} Catch-up data for each spire with generated resources
   */
  function processCatchUp(currentTime = Date.now()) {
    const result = {
      lamed: { generated: 0, elapsedMinutes: 0 },
      tsadi: { generated: 0, elapsedMinutes: 0 },
      bet: { generated: 0, elapsedMinutes: 0 },
    };

    // Process each spire
    ['lamed', 'tsadi', 'bet'].forEach((spireName) => {
      const lastActive = getLastActiveTime(spireName);
      const elapsedMs = Math.max(0, currentTime - lastActive);
      const elapsedMinutes = elapsedMs / (1000 * 60);
      
      // Only process if more than 1 second has elapsed to avoid micro-updates
      if (elapsedMinutes > 1/60) {
        const generated = calculateIdleGains(spireName, elapsedMinutes);
        result[spireName] = { generated, elapsedMinutes };
      }
      
      // Update last active time
      updateLastActiveTime(spireName, currentTime);
    });

    return result;
  }

  return {
    // Generation rate queries
    getLamedGenerationRate,
    getTsadiGenerationRate,
    getBetGenerationRate,
    
    // Time tracking
    updateLastActiveTime,
    getLastActiveTime,
    
    // Idle catch-up
    calculateIdleGains,
    processCatchUp,
  };
}
