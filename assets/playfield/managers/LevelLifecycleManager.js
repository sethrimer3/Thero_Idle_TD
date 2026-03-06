// Level Lifecycle Manager - Extracted from playfield.js (Build 462)
// Manages level entry and exit, including state initialization and cleanup

import { levelConfigs } from '../../levels.js';
import {
  getTowerLoadoutState,
  cancelTowerDrag,
} from '../../towersTab.js';
import {
  resetActiveMoteGems,
} from '../../enemies.js';
import {
  clearNuCachedDimensions as clearNuCachedDimensionsHelper,
} from '../../../scripts/features/towers/nuTower.js';
import { createCombatStateManager } from './CombatStateManager.js';
import { createTowerOrchestrationController } from '../controllers/TowerOrchestrationController.js';
import { createDeveloperToolsService } from '../services/DeveloperToolsService.js';
import { createWaveUIFormatter } from '../ui/WaveUIFormatter.js';
import * as TowerManager from './TowerManager.js';

/**
 * Creates a level lifecycle manager that handles level entry and exit.
 * This manager is a stateful factory that encapsulates level lifecycle logic
 * previously embedded in the monolithic SimplePlayfield class.
 * 
 * @param {Object} config - Configuration object
 * @param {Object} config.playfield - Reference to the playfield instance
 * @returns {Object} Level lifecycle manager API
 */
export function createLevelLifecycleManager(config) {
  // Validate required configuration
  if (!config || !config.playfield) {
    throw new Error('LevelLifecycleManager requires playfield in config');
  }

  const playfield = config.playfield;

  /**
   * Enter a level, initializing all necessary state and managers.
   * 
   * @param {Object} level - Level object with id property
   * @param {Object} options - Entry options
   * @param {boolean} options.endlessMode - Whether to start in endless mode
   */
  function enterLevel(level, options = {}) {
    if (!playfield.container) {
      return;
    }

    const levelId = level?.id;
    const config = levelId ? levelConfigs.get(levelId) : null;
    const isInteractive = Boolean(config);
    const startInEndless = Boolean(options.endlessMode || config?.forceEndlessMode);

    // Handle preview-only mode with no level config
    if (playfield.previewOnly && !isInteractive) {
      playfield.levelActive = false;
      playfield.levelConfig = null;
      playfield.combatActive = false;
      playfield.shouldAnimate = false;
      playfield.stopLoop();
      if (playfield.ctx) {
        playfield.ctx.clearRect(0, 0, playfield.canvas.width, playfield.canvas.height);
      }
      return;
    }

    playfield.cancelAutoStart();
    playfield.clearDeveloperCrystals({ silent: true });

    // Handle non-interactive mode (no config)
    if (!isInteractive) {
      playfield.levelActive = false;
      playfield.levelConfig = null;
      
      // Reset combat state manager
      if (playfield.combatStateManager) {
        playfield.combatStateManager.reset();
      }
      
      playfield.combatActive = false;
      playfield.shouldAnimate = false;
      playfield.stopLoop();
      playfield.resetCombatStats();
      playfield.setStatsPanelEnabled(false);
      playfield.disableSlots(true);
      playfield.enemies = [];
      playfield.resetChiSystems();
      playfield.projectiles = [];
      playfield.resetDamageNumbers();
      playfield.resetEnemyDeathParticles();
      playfield.resetWaveTallies();
      playfield.alphaBursts = [];
      playfield.betaBursts = [];
      playfield.gammaBursts = [];
      playfield.gammaStarBursts = [];
      playfield.nuBursts = [];
      playfield.swarmClouds = [];
      playfield.towers = [];
      // Clear cached Nu tower dimensions when entering non-interactive mode.
      clearNuCachedDimensionsHelper();
      playfield.energy = 0;
      playfield.lives = 0;
      // Reset gate defense while previewing non-interactive layouts.
      playfield.gateDefense = 0;
      if (playfield.autoWaveCheckbox) {
        playfield.autoWaveCheckbox.checked = playfield.autoWaveEnabled;
        playfield.autoWaveCheckbox.disabled = true;
      }
      if (playfield.ctx) {
        playfield.ctx.clearRect(0, 0, playfield.canvas.width, playfield.canvas.height);
      }
      playfield.basePathPoints = [];
      playfield.baseAutoAnchors = [];
      if (playfield.messageEl) {
        playfield.messageEl.textContent = 'This level preview is not interactive yet.';
      }
      if (playfield.waveEl) playfield.waveEl.textContent = '—';
      if (playfield.healthEl) playfield.healthEl.textContent = '—';
      if (playfield.energyEl) playfield.energyEl.textContent = '—';
      if (playfield.progressEl) {
        playfield.progressEl.textContent = 'Select an unlocked level to battle.';
      }
      if (playfield.startButton) {
        playfield.startButton.textContent = 'Preview Only';
        playfield.startButton.disabled = true;
      }
      playfield.updateSpeedButton();
      playfield.updateAutoAnchorButton();
      cancelTowerDrag();
      return;
    }

    // Clone level configuration
    const clonedConfig = {
      ...config,
      waves: config.waves.map((wave) => ({ ...wave })),
      path: config.path.map((node) => ({ ...node })),
      autoAnchors: Array.isArray(config.autoAnchors)
        ? config.autoAnchors.map((anchor) => ({ ...anchor }))
        : [],
    };

    // Configure infinite thero mode
    const developerInfiniteThero = Boolean(
      playfield.dependencies.isDeveloperInfiniteTheroEnabled?.(),
    );
    const forceInfiniteThero = Boolean(config?.infiniteThero || developerInfiniteThero);
    if (forceInfiniteThero) {
      clonedConfig.infiniteThero = true;
      clonedConfig.startThero = Number.POSITIVE_INFINITY;
      clonedConfig.theroCap = Number.POSITIVE_INFINITY;
    } else {
      const calculateStartingThero = playfield.dependencies.calculateStartingThero;
      const getBaseStartThero = playfield.dependencies.getBaseStartThero;
      const baseStart =
        typeof getBaseStartThero === 'function' ? getBaseStartThero() : 0;
      const dynamicStartThero =
        typeof calculateStartingThero === 'function' ? calculateStartingThero() : 0;
      clonedConfig.startThero = Number.isFinite(dynamicStartThero)
        ? dynamicStartThero
        : baseStart;
    }
    clonedConfig.forceEndlessMode = Boolean(config?.forceEndlessMode);
    const getBaseCoreIntegrity = playfield.dependencies.getBaseCoreIntegrity;
    clonedConfig.lives =
      typeof getBaseCoreIntegrity === 'function' ? getBaseCoreIntegrity() : 0;

    // Clone and store path configuration
    const basePathPoints = Array.isArray(clonedConfig.path)
      ? clonedConfig.path.map((node) => playfield.cloneNormalizedPoint(node))
      : [];
    const baseAutoAnchors = Array.isArray(clonedConfig.autoAnchors)
      ? clonedConfig.autoAnchors.map((anchor) => playfield.cloneNormalizedPoint(anchor))
      : [];
    playfield.basePathPoints = basePathPoints;
    playfield.baseAutoAnchors = baseAutoAnchors;
    playfield.layoutOrientation = playfield.determinePreferredOrientation();

    playfield.levelActive = true;
    playfield.levelConfig = clonedConfig;
    
    // Initialize combat state manager with level configuration
    playfield.combatStateManager = createCombatStateManager({
      levelConfig: clonedConfig,
      audio: playfield.audio,
      onVictory: () => playfield.handleVictory(),
      onDefeat: playfield.onDefeat,
      onCombatStart: playfield.onCombatStart,
      recordKillEvent: (towerId) => playfield.recordKillEvent(towerId),
      tryConvertEnemyToChiThrall: (enemy, context) => playfield.tryConvertEnemyToChiThrall(enemy, context),
      triggerPsiClusterAoE: (enemy) => playfield.triggerPsiClusterAoE(enemy),
      notifyEnemyDeath: (enemy) => playfield.notifyEnemyDeath(enemy),
    });

    // Initialize tower orchestration controller
    playfield.towerOrchestrationController = createTowerOrchestrationController({
      playfield: playfield,
      combatState: playfield.combatStateManager,
      towerManager: TowerManager,
      audio: playfield.audio,
      messageEl: playfield.messageEl,
      dependencies: playfield.dependencies,
      theroSymbol: playfield.theroSymbol,
    });

    // Initialize developer tools service
    playfield.developerTools = createDeveloperToolsService(playfield);
    playfield.developerTools.initialize();

    // Initialize wave UI formatter
    playfield.waveFormatter = createWaveUIFormatter({
      currentWaveNumber: () => playfield.currentWaveNumber,
      waveIndex: () => playfield.waveIndex,
      theroSymbol: () => playfield.theroSymbol,
    });
    
    // Store endless mode flag for when combat starts
    playfield.startInEndlessMode = startInEndless;
    
    // Clear any stored checkpoint when a fresh state is requested.
    playfield.endlessCheckpoint = null;
    playfield.endlessCheckpointUsed = false;
    playfield.viewScale = 1;
    playfield.viewCenterNormalized = { x: 0.5, y: 0.5 };
    playfield.applyViewConstraints();
    playfield.activePointers.clear();
    playfield.pinchState = null;
    playfield.isPinchZooming = false;
    playfield.applyLevelOrientation();
    playfield.applyContainerOrientationClass();

    // Handle preview-only mode with config
    if (playfield.previewOnly) {
      playfield.combatActive = false;
      playfield.shouldAnimate = false;
      playfield.stopLoop();
      playfield.arcOffset = 0;
      playfield.enemies = [];
      playfield.resetChiSystems();
      playfield.projectiles = [];
      playfield.resetDamageNumbers();
      playfield.resetEnemyDeathParticles();
      playfield.resetWaveTallies();
      playfield.alphaBursts = [];
      playfield.betaBursts = [];
      playfield.gammaBursts = [];
      playfield.gammaStarBursts = [];
      playfield.nuBursts = [];
      playfield.swarmClouds = [];
      playfield.towers = [];
      playfield.hoverPlacement = null;
      playfield.pointerPosition = null;
      playfield.syncCanvasSize();
      if (typeof window !== 'undefined') {
        const activeLevelId = playfield.levelConfig?.id;
        const attemptSync = () => {
          if (!playfield.previewOnly) {
            return;
          }
          if (!playfield.levelConfig || playfield.levelConfig.id !== activeLevelId) {
            return;
          }
          const rect = playfield.canvas ? playfield.canvas.getBoundingClientRect() : null;
          if (!rect || rect.width < 2 || rect.height < 2) {
            window.requestAnimationFrame(attemptSync);
            return;
          }
          playfield.syncCanvasSize();
        };
        window.requestAnimationFrame(attemptSync);
      }
      return;
    }

    // Initialize interactive level
    playfield.setAvailableTowers(getTowerLoadoutState().selected);
    playfield.shouldAnimate = true;
    playfield.resetState();
    playfield.loadLevelCrystals();
    playfield.enableSlots();
    playfield.syncCanvasSize();
    playfield.ensureLoop();

    if (playfield.startButton) {
      playfield.startButton.textContent = 'Commence Wave';
      playfield.startButton.disabled = false;
    }
    if (playfield.autoWaveCheckbox) {
      playfield.autoWaveCheckbox.disabled = false;
      playfield.autoWaveCheckbox.checked = playfield.autoWaveEnabled;
    }
    if (playfield.messageEl) {
      playfield.messageEl.textContent = startInEndless
        ? 'Endless defense unlocked—survive as the waves loop.'
        : 'Drag glyph chips from your loadout anywhere on the plane—no fixed anchors required.';
    }
    if (playfield.progressEl) {
      playfield.progressEl.textContent = startInEndless
        ? 'Waves loop infinitely. Each completed cycle multiplies enemy strength ×10.'
        : 'Wave prep underway.';
    }
    if (playfield.autoWaveEnabled) {
      playfield.scheduleAutoStart({ delay: playfield.autoStartLeadTime });
    }
    playfield.updateHud();
    playfield.updateProgress();
    playfield.updateSpeedButton();
    playfield.updateAutoAnchorButton();
  }

  /**
   * Leave the current level, cleaning up all state.
   */
  function leaveLevel() {
    // Handle preview-only mode
    if (playfield.previewOnly) {
      playfield.levelActive = false;
      playfield.levelConfig = null;
      
      // Reset combat state manager
      if (playfield.combatStateManager) {
        playfield.combatStateManager.reset();
      }
      
      playfield.combatActive = false;
      playfield.shouldAnimate = false;
      playfield.stopLoop();
      playfield.enemies = [];
      playfield.resetChiSystems();
      playfield.projectiles = [];
      playfield.resetDamageNumbers();
      playfield.resetEnemyDeathParticles();
      playfield.resetWaveTallies();
      playfield.towers = [];
      // Clear cached Nu tower dimensions when leaving preview mode.
      clearNuCachedDimensionsHelper();
      playfield.pathSegments = [];
      playfield.pathPoints = [];
      playfield.pathLength = 0;
      playfield.floaters = [];
      playfield.floaterConnections = [];
      // Drop ambient swimmers when the preview grid is torn down.
      playfield.backgroundSwimmers = [];
      playfield.swimmerBounds = { width: playfield.renderWidth || 0, height: playfield.renderHeight || 0 };
      playfield.arcOffset = 0;
      playfield.hoverPlacement = null;
      playfield.pointerPosition = null;
      playfield.developerPathMarkers = [];
      playfield.viewScale = 1;
      playfield.viewCenterNormalized = { x: 0.5, y: 0.5 };
      playfield.applyViewConstraints();
      playfield.activePointers.clear();
      playfield.pinchState = null;
      playfield.isPinchZooming = false;
      // Reset stored geometry when leaving the preview renderer.
      playfield.basePathPoints = [];
      playfield.baseAutoAnchors = [];
      if (playfield.ctx) {
        playfield.ctx.clearRect(0, 0, playfield.canvas.width, playfield.canvas.height);
      }
      return;
    }

    // Clean up interactive level
    playfield.levelActive = false;
    playfield.levelConfig = null;
    
    // Reset combat state manager
    if (playfield.combatStateManager) {
      playfield.combatStateManager.reset();
    }
    
    playfield.combatActive = false;
    playfield.shouldAnimate = false;
    playfield.cancelAutoStart();
    // Leaving the level invalidates any stored endless checkpoint data.
    playfield.endlessCheckpoint = null;
    playfield.endlessCheckpointUsed = false;
    playfield.stopLoop();
    playfield.disableSlots(true);
    playfield.enemies = [];
    playfield.resetChiSystems();
    playfield.projectiles = [];
    playfield.resetDamageNumbers();
    playfield.resetEnemyDeathParticles();
    playfield.resetWaveTallies();
    playfield.activeTowerMenu = null;
    playfield.towerMenuExitAnimation = null;
    playfield.deltaSoldierIdCounter = 0;
    playfield.floaters = [];
    playfield.floaterConnections = [];
    // Clear ambient swimmers when leaving a level so the next run re-seeds them cleanly.
    playfield.backgroundSwimmers = [];
    playfield.swimmerBounds = { width: playfield.renderWidth || 0, height: playfield.renderHeight || 0 };
    playfield.floaterBounds = { width: playfield.renderWidth || 0, height: playfield.renderHeight || 0 };
    // Clear mote gem drops whenever the battlefield resets.
    resetActiveMoteGems();
    playfield.towers = [];
    playfield.infinityTowers = [];
    // Clear cached Nu tower dimensions so ranges recalculate correctly on next level entry.
    clearNuCachedDimensionsHelper();
    playfield.hoverPlacement = null;
    playfield.clearFocusedEnemy({ silent: true });
    playfield.energy = 0;
    playfield.lives = 0;
    // Drop any cached gate defense when the battlefield fully resets.
    playfield.gateDefense = 0;
    // Clear cached portrait geometry so the next level can determine orientation anew.
    playfield.basePathPoints = [];
    playfield.baseAutoAnchors = [];
    playfield.setAvailableTowers([]);
    cancelTowerDrag();
    playfield.viewScale = 1;
    playfield.viewCenterNormalized = { x: 0.5, y: 0.5 };
    playfield.applyViewConstraints();
    playfield.activePointers.clear();
    playfield.pinchState = null;
    playfield.isPinchZooming = false;
    if (playfield.ctx) {
      playfield.ctx.clearRect(0, 0, playfield.canvas.width, playfield.canvas.height);
    }
    if (playfield.messageEl) {
      playfield.messageEl.textContent = 'Select a level to command the defense.';
    }
    if (playfield.waveEl) playfield.waveEl.textContent = '—';
    if (playfield.healthEl) playfield.healthEl.textContent = '—';
    if (playfield.energyEl) playfield.energyEl.textContent = '—';
    if (playfield.progressEl) playfield.progressEl.textContent = 'No active level.';
    if (playfield.startButton) {
      playfield.startButton.textContent = 'Commence Wave';
      playfield.startButton.disabled = true;
    }
    if (playfield.autoWaveCheckbox) {
      playfield.autoWaveCheckbox.checked = playfield.autoWaveEnabled;
      playfield.autoWaveCheckbox.disabled = true;
    }
    playfield.updateSpeedButton();
    playfield.updateAutoAnchorButton();
  }

  /**
   * Get the energy cap for the current level.
   * Developer mode removes level caps so test thero grants are never clamped mid-run.
   * 
   * @returns {number} Energy cap (possibly infinite)
   */
  function getEnergyCap() {
    // Developer mode removes level caps so test thero grants are never clamped mid-run.
    if (typeof playfield.dependencies.isDeveloperModeActive === 'function' && playfield.dependencies.isDeveloperModeActive()) {
      return Number.POSITIVE_INFINITY;
    }
    return playfield.levelConfig?.theroCap ?? playfield.levelConfig?.energyCap ?? Infinity;
  }

  // Return manager API
  return {
    enterLevel,
    leaveLevel,
    getEnergyCap,
  };
}
