// Combat State Manager - Extracted from playfield.js (Build 444)
// Manages wave progression, enemy lifecycle, and victory/defeat conditions

import {
  registerEnemyEncounter,
  getEnemyCodexEntry,
} from '../../codex.js';
import {
  spawnMoteGemDrop,
  resolveEnemyGemDropMultiplier,
  assignRandomShell,
} from '../../enemies.js';

/**
 * Creates a combat state manager that handles wave progression and enemy lifecycle.
 * This manager is a stateful factory that encapsulates combat logic previously
 * embedded in the monolithic SimplePlayfield class.
 * 
 * @param {Object} config - Configuration object
 * @param {Object} config.levelConfig - Level configuration with waves array
 * @param {Object} config.audio - Audio manager for sound effects
 * @param {Function} config.onVictory - Callback for victory condition
 * @param {Function} config.onDefeat - Callback for defeat condition
 * @param {Function} config.onCombatStart - Callback when combat starts
 * @param {Function} config.recordKillEvent - Callback to record tower kill attribution
 * @param {Function} config.tryConvertEnemyToChiThrall - Callback for chi tower conversion
 * @param {Function} config.triggerPsiClusterAoE - Callback for psi tower cluster effect
 * @param {Function} config.notifyEnemyDeath - Callback when enemy dies
 * @returns {Object} Combat state manager API
 */
export function createCombatStateManager(config) {
  // Validate required configuration
  if (!config || !config.levelConfig) {
    throw new Error('CombatStateManager requires levelConfig in config');
  }

  // Wave progression state
  let waveIndex = 0;
  let waveTimer = 0;
  let activeWave = null;
  let currentWaveNumber = 1;
  let maxWaveReached = 0;
  let baseWaveCount = 0;
  let isEndlessMode = false;
  let endlessCycle = 0;
  let initialSpawnDelay = 0;

  // Enemy lifecycle state
  let enemies = [];
  let enemyIdCounter = 0;
  let enemyDeathParticles = [];
  let enemySwirlImpacts = [];
  let gammaStarBursts = [];

  // Victory/defeat state
  let lives = 0;
  let resolvedOutcome = null;
  let combatActive = false;

  // Resource tracking
  let energy = 0;

  // References to external systems
  const levelConfig = config.levelConfig;
  const audio = config.audio;
  const onVictory = config.onVictory;
  const onDefeat = config.onDefeat;
  const onCombatStart = config.onCombatStart;
  const recordKillEvent = config.recordKillEvent;
  const tryConvertEnemyToChiThrall = config.tryConvertEnemyToChiThrall;
  const triggerPsiClusterAoE = config.triggerPsiClusterAoE;
  const notifyEnemyDeath = config.notifyEnemyDeath;

  /**
   * Compute the display wave number accounting for endless cycles.
   * Formula: cycle * baseWaveCount + waveIndex + 1
   * @param {number} index - Wave index to compute (defaults to current waveIndex)
   * @returns {number} Display wave number
   */
  function computeWaveNumber(index = waveIndex) {
    const effectiveIndex = index >= 0 ? index : waveIndex;
    const base = baseWaveCount > 0 ? baseWaveCount : levelConfig.waves?.length || 0;
    return endlessCycle * base + effectiveIndex + 1;
  }

  /**
   * Get the endless cycle multiplier for HP/reward scaling.
   * Formula: 10^cycle
   * @param {number} cycle - Cycle number (defaults to current endlessCycle)
   * @returns {number} Multiplier (1, 10, 100, 1000, ...)
   */
  function getCycleMultiplier(cycle = endlessCycle) {
    return Math.pow(10, Math.max(0, cycle));
  }

  /**
   * Get the endless cycle speed scalar for enemy speed increases.
   * Formula: 1 + cycle * 0.1
   * @param {number} cycle - Cycle number (defaults to current endlessCycle)
   * @returns {number} Speed scalar (1.0, 1.1, 1.2, ...)
   */
  function getCycleSpeedScalar(cycle = endlessCycle) {
    return 1 + Math.max(0, cycle) * 0.1;
  }

  /**
   * Creates a wave state object with initial spawn timing.
   * @param {Object} waveConfig - Wave configuration from level.waves[index]
   * @param {Object} options - Additional options
   * @param {number} options.initialDelay - Delay before first spawn (seconds)
   * @returns {Object} Wave state object
   */
  function createWaveState(waveConfig, options = {}) {
    const delay = options.initialDelay || 0;
    return {
      config: waveConfig,
      spawned: 0,
      nextSpawn: delay,
      multiplier: getCycleMultiplier(),
    };
  }

  /**
   * Marks the start of a wave and updates wave number tracking.
   * @param {number} waveNum - Wave number to set
   */
  function markWaveStart(waveNum = null) {
    currentWaveNumber = waveNum !== null ? waveNum : computeWaveNumber(waveIndex);
    maxWaveReached = Math.max(maxWaveReached, currentWaveNumber);
  }

  /**
   * Starts combat by initializing wave state and resetting counters.
   * @param {Object} options - Start options
   * @param {number} options.startingWaveIndex - Wave index to begin at
   * @param {number} options.startingLives - Initial lives/health
   * @param {number} options.startingEnergy - Initial energy/currency
   * @param {boolean} options.endless - Enable endless mode
   * @param {number} options.endlessCycleStart - Starting endless cycle
   */
  function startCombat(options = {}) {
    // Reset state
    waveIndex = options.startingWaveIndex || 0;
    lives = options.startingLives || levelConfig.lives || 20;
    energy = options.startingEnergy || 0;
    isEndlessMode = Boolean(options.endless);
    endlessCycle = options.endlessCycleStart || 0;
    
    enemies = [];
    enemyIdCounter = 0;
    enemyDeathParticles = [];
    enemySwirlImpacts = [];
    gammaStarBursts = [];
    
    resolvedOutcome = null;
    combatActive = true;
    waveTimer = 0;
    
    baseWaveCount = levelConfig.waves?.length || 0;
    initialSpawnDelay = options.initialSpawnDelay || 0;

    // Create initial wave state
    const waveConfig = levelConfig.waves?.[waveIndex];
    if (waveConfig) {
      activeWave = createWaveState(waveConfig, { initialDelay: initialSpawnDelay });
      markWaveStart();
    }

    // Notify combat started
    if (onCombatStart) {
      onCombatStart(levelConfig.id || 'unknown');
    }
  }

  /**
   * Advances to the next wave or completes the level.
   * Checks for victory condition if at the last wave.
   */
  function advanceWave() {
    waveIndex++;
    waveTimer = 0;

    // Check if all waves are complete
    const totalWaves = levelConfig.waves?.length || 0;
    if (waveIndex >= totalWaves) {
      // Check for victory or endless mode continuation
      if (isEndlessMode) {
        // Loop back to first wave with increased cycle
        endlessCycle++;
        waveIndex = 0;
        activeWave = createWaveState(levelConfig.waves[0], { initialDelay: 0 });
        markWaveStart();
      } else if (enemies.length === 0) {
        // Victory condition: all waves complete and no enemies remain
        resolvedOutcome = 'victory';
        combatActive = false;
        if (audio) {
          audio.playSfx('victory');
        }
        if (onVictory) {
          onVictory(levelConfig.id, {
            waveNumber: currentWaveNumber,
            maxWaveReached,
            finalEnergy: energy,
          });
        }
      }
    } else {
      // Advance to next wave
      const waveConfig = levelConfig.waves[waveIndex];
      activeWave = createWaveState(waveConfig, { initialDelay: 0 });
      markWaveStart();
    }
  }

  /**
   * Spawns enemies based on the active wave configuration and timer.
   * Updates activeWave.spawned and activeWave.nextSpawn as enemies are created.
   * @param {number} delta - Time elapsed since last update (seconds)
   * @param {Object} spawnContext - Additional context for spawning
   * @param {Array} spawnContext.pathPoints - Path points for enemy movement
   * @param {boolean} spawnContext.radialSpawn - Whether enemies spawn radially
   * @param {Function} spawnContext.registerEnemy - Callback to register spawned enemy
   */
  function spawnEnemies(delta, spawnContext) {
    if (!activeWave || !combatActive) return;

    waveTimer += delta;

    const waveConfig = activeWave.config;
    const groups = waveConfig.groups || [];
    const boss = waveConfig.boss;
    
    // Calculate total enemy count for this wave
    let totalSpawnCount = 0;
    groups.forEach((group) => {
      totalSpawnCount += group.count || 0;
    });
    if (boss) {
      totalSpawnCount += 1;
    }

    // Check if it's time to spawn the next enemy
    while (activeWave.spawned < totalSpawnCount && waveTimer >= activeWave.nextSpawn) {
      const spawnIndex = activeWave.spawned;
      let enemyConfig = null;
      let isBoss = false;

      // Determine which enemy group this spawn belongs to
      let cumulativeCount = 0;
      for (const group of groups) {
        const groupCount = group.count || 0;
        if (spawnIndex < cumulativeCount + groupCount) {
          enemyConfig = group;
          break;
        }
        cumulativeCount += groupCount;
      }

      // Check if this is the boss spawn
      if (!enemyConfig && boss && spawnIndex === totalSpawnCount - 1) {
        enemyConfig = boss;
        isBoss = true;
      }

      if (enemyConfig) {
        // Create enemy object
        const cycleMultiplier = getCycleMultiplier();
        const cycleSpeedScalar = getCycleSpeedScalar();
        
        const baseHp = enemyConfig.hp || 100;
        const baseSpeed = enemyConfig.speed || 1;
        const baseReward = enemyConfig.reward || 10;
        
        const enemy = {
          id: ++enemyIdCounter,
          hp: baseHp * cycleMultiplier,
          maxHp: baseHp * cycleMultiplier,
          speed: baseSpeed * cycleSpeedScalar,
          reward: baseReward * cycleMultiplier,
          symbol: enemyConfig.symbol || '○',
          pathMode: enemyConfig.pathMode || 'follow',
          progress: 0,
          damageContributors: new Map(),
          slowStacks: [],
          sparkleStacks: [],
          shieldStacks: [],
          isBoss,
          waveIndex,
          cycleMultiplier,
          // Additional metadata
          codexId: enemyConfig.codexId || null,
          shell: null,
        };

        // Assign visual shell variant
        if (assignRandomShell) {
          assignRandomShell(enemy);
        }

        // Register codex encounter for new enemy types
        if (enemy.codexId && registerEnemyEncounter) {
          registerEnemyEncounter(enemy.codexId);
        }

        // Position the enemy based on spawn mode
        if (spawnContext.radialSpawn) {
          // Radial spawn: position off-screen in a circle around the field
          const angle = Math.random() * Math.PI * 2;
          const offscreenRadius = 1.5; // Off-screen distance in normalized coords
          enemy.x = 0.5 + Math.cos(angle) * offscreenRadius;
          enemy.y = 0.5 + Math.sin(angle) * offscreenRadius;
        } else {
          // Path-based spawn: position at start of path
          if (spawnContext.pathPoints && spawnContext.pathPoints.length > 0) {
            const startPoint = spawnContext.pathPoints[0];
            enemy.x = startPoint.x;
            enemy.y = startPoint.y;
          }
        }

        enemies.push(enemy);

        // Notify spawn context to register the enemy
        if (spawnContext.registerEnemy) {
          spawnContext.registerEnemy(enemy);
        }

        // Update spawn tracking
        activeWave.spawned++;
        
        // Calculate next spawn time
        const interval = waveConfig.interval || 1.0;
        activeWave.nextSpawn = waveTimer + interval;
      }
    }

    // Check if wave is complete (all spawned and all defeated)
    if (activeWave.spawned >= totalSpawnCount && enemies.length === 0) {
      // Wave complete - advance to next
      advanceWave();
    }
  }

  /**
   * Updates all active enemies and checks for breaches/defeats.
   * @param {number} delta - Time elapsed since last update (seconds)
   * @param {Object} updateContext - Context for enemy updates
   * @param {Array} updateContext.pathPoints - Path points for movement
   * @param {Function} updateContext.applyDebuffs - Callback to apply tower debuffs
   * @param {Function} updateContext.updateMovement - Callback to update enemy position
   */
  function updateEnemies(delta, updateContext) {
    if (!combatActive) return;

    // Update each enemy
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];

      // Apply debuffs (slow, sparkle, etc.)
      if (updateContext.applyDebuffs) {
        updateContext.applyDebuffs(enemy, delta);
      }

      // Update movement along path
      if (updateContext.updateMovement) {
        updateContext.updateMovement(enemy, delta);
      }

      // Check if enemy reached the end (breach)
      if (enemy.progress >= 1.0) {
        // Apply breach damage
        const breachDamage = Math.max(0, enemy.hp);
        lives -= breachDamage;
        
        // Remove enemy
        enemies.splice(i, 1);

        // Check for defeat
        if (lives <= 0) {
          resolvedOutcome = 'defeat';
          combatActive = false;
          if (audio) {
            audio.playSfx('defeat');
          }
          if (onDefeat) {
            onDefeat(levelConfig.id, {
              waveNumber: currentWaveNumber,
              maxWaveReached,
              finalEnergy: energy,
            });
          }
        }
      }
    }
  }

  /**
   * Handles the death of an enemy, distributing rewards and checking for wave completion.
   * @param {Object} enemy - The enemy that died
   * @param {Object} deathContext - Context for death handling
   * @param {Function} deathContext.spawnDeathParticles - Callback to spawn visual effects
   * @param {Function} deathContext.dropGems - Callback to spawn gem drops
   */
  function handleEnemyDeath(enemy, deathContext) {
    // Award energy reward
    energy += enemy.reward || 0;

    // Notify death to external systems
    if (notifyEnemyDeath) {
      notifyEnemyDeath(enemy);
    }

    // Record kill event for tower attribution
    if (recordKillEvent && enemy.damageContributors) {
      // Find the tower that dealt the most damage
      let maxDamage = 0;
      let killingTower = null;
      enemy.damageContributors.forEach((damage, towerId) => {
        if (damage > maxDamage) {
          maxDamage = damage;
          killingTower = towerId;
        }
      });
      if (killingTower) {
        recordKillEvent(killingTower);
      }
    }

    // Try chi tower conversion
    if (tryConvertEnemyToChiThrall && Math.random() < 0.1) {
      tryConvertEnemyToChiThrall(enemy, {});
    }

    // Trigger psi cluster AoE
    if (triggerPsiClusterAoE) {
      triggerPsiClusterAoE(enemy);
    }

    // Spawn visual death effects
    if (deathContext.spawnDeathParticles) {
      deathContext.spawnDeathParticles(enemy);
    }

    // Drop mote gems
    if (deathContext.dropGems) {
      deathContext.dropGems(enemy);
    }

    // Remove enemy from array
    const index = enemies.indexOf(enemy);
    if (index >= 0) {
      enemies.splice(index, 1);
    }

    // Check if wave is complete
    if (activeWave) {
      const totalSpawnCount = calculateTotalSpawnCount(activeWave.config);
      if (activeWave.spawned >= totalSpawnCount && enemies.length === 0) {
        advanceWave();
      }
    }
  }

  /**
   * Calculate the total number of enemies in a wave configuration.
   * @param {Object} waveConfig - Wave configuration object
   * @returns {number} Total enemy count
   */
  function calculateTotalSpawnCount(waveConfig) {
    let total = 0;
    if (waveConfig.groups) {
      waveConfig.groups.forEach((group) => {
        total += group.count || 0;
      });
    }
    if (waveConfig.boss) {
      total += 1;
    }
    return total;
  }

  /**
   * Checks if victory condition is met.
   * @returns {boolean} True if victory achieved
   */
  function checkVictoryCondition() {
    if (resolvedOutcome === 'victory') return true;
    
    const totalWaves = levelConfig.waves?.length || 0;
    if (waveIndex >= totalWaves && enemies.length === 0 && !isEndlessMode) {
      resolvedOutcome = 'victory';
      combatActive = false;
      return true;
    }
    
    return false;
  }

  /**
   * Checks if defeat condition is met.
   * @returns {boolean} True if defeated
   */
  function checkDefeatCondition() {
    if (resolvedOutcome === 'defeat') return true;
    
    if (lives <= 0) {
      resolvedOutcome = 'defeat';
      combatActive = false;
      return true;
    }
    
    return false;
  }

  /**
   * Resets all combat state to initial values.
   */
  function reset() {
    waveIndex = 0;
    waveTimer = 0;
    activeWave = null;
    currentWaveNumber = 1;
    maxWaveReached = 0;
    baseWaveCount = 0;
    isEndlessMode = false;
    endlessCycle = 0;
    initialSpawnDelay = 0;
    
    enemies = [];
    enemyIdCounter = 0;
    enemyDeathParticles = [];
    enemySwirlImpacts = [];
    gammaStarBursts = [];
    
    lives = 0;
    resolvedOutcome = null;
    combatActive = false;
    energy = 0;
  }

  // Return public API
  return {
    // Wave management
    startCombat,
    advanceWave,
    getCurrentWave: () => activeWave,
    getWaveIndex: () => waveIndex,
    getWaveNumber: () => currentWaveNumber,
    getMaxWaveReached: () => maxWaveReached,
    getWaveTimer: () => waveTimer,
    getCycleMultiplier,
    getCycleSpeedScalar,
    computeWaveNumber,
    
    // Enemy lifecycle
    spawnEnemies,
    updateEnemies,
    handleEnemyDeath,
    getEnemies: () => enemies,
    getEnemyCount: () => enemies.length,
    
    // Victory/defeat
    checkVictoryCondition,
    checkDefeatCondition,
    getOutcome: () => resolvedOutcome,
    getLives: () => lives,
    setLives: (value) => { lives = value; },
    applyBreachDamage: (damage) => { lives = Math.max(0, lives - damage); },
    
    // Resource tracking
    getEnergy: () => energy,
    setEnergy: (value) => { energy = value; },
    addEnergy: (amount) => { energy += amount; },
    
    // Combat state
    isCombatActive: () => combatActive,
    setCombatActive: (active) => { combatActive = active; },
    
    // Endless mode
    isEndless: () => isEndlessMode,
    getEndlessCycle: () => endlessCycle,
    
    // Reset
    reset,
  };
}
