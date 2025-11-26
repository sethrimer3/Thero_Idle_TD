import {
  alephChainUpgradeState,
  getAlephChainUpgrades,
  updateAlephChainUpgrades,
  applyAlephChainUpgradeSnapshot,
  resetAlephChainUpgrades,
} from './alephUpgradeState.js';
import {
  MATH_SYMBOL_REGEX,
  renderMathElement,
  isLikelyMathExpression,
  annotateMathText,
  convertMathExpressionToPlainText,
} from '../scripts/core/mathText.js';
import { tokenizeEquationParts } from '../scripts/core/mathTokens.js';
import {
  BETA_BASE_ATTACK,
  BETA_BASE_ATTACK_SPEED,
  BETA_BASE_RANGE,
  clampBetaExponent,
  calculateBetaAttack,
  calculateBetaAttackSpeed,
  calculateBetaRange,
} from '../scripts/features/towers/betaMath.js';
import {
  formatGameNumber,
  formatWholeNumber,
  formatDecimal,
  formatPercentage,
  formatSignedPercentage,
  GAME_NUMBER_NOTATIONS,
  getGameNumberNotation,
  setGameNumberNotation,
  addGameNumberNotationChangeListener,
} from '../scripts/core/formatting.js';
import {
  DEFAULT_AUDIO_MANIFEST,
  AudioManager,
  AUDIO_SETTINGS_STORAGE_KEY,
  applyStoredAudioSettings,
  bindAudioControls as bindAudioControlElements,
} from './audioSystem.js';
import { createAudioOrchestration } from './audioOrchestration.js';
import { initializeStartupOverlay, dismissStartupOverlay } from './startupOverlay.js';
import {
  FALLBACK_BASE_SCORE_RATE,
  FALLBACK_BASE_ENERGY_RATE,
  FALLBACK_BASE_FLUX_RATE,
  ensureGameplayConfigLoaded,
  loadFluidSimulationProfile,
  calculateStartingThero,
  getTowerLoadoutLimit,
  overrideTowerLoadoutLimit,
  getBaseStartThero,
  registerResourceContainers,
  setBaseStartThero,
  getBaseCoreIntegrity,
} from './configuration.js';
import { createResourceStateContainers } from './state/resourceState.js';
import {
  setNotationRefreshHandler,
  bindNotationToggle,
  applyNotationPreference,
  bindGlyphEquationToggle,
  applyGlyphEquationPreference,
  applyDamageNumberPreference,
  bindDamageNumberToggle,
  applyWaveKillTallyPreference,
  applyWaveDamageTallyPreference,
  bindWaveKillTallyToggle,
  bindWaveDamageTallyToggle,
  applyTrackTracerPreference,
  bindTrackTracerToggle,
  bindLoadoutSlotButton,
  initializeDesktopCursorPreference,
  applyGraphicsMode,
  initializeGraphicsMode,
  bindGraphicsModeToggle,
  isLowGraphicsModeActive,
  setGraphicsModeContext,
  areGlyphEquationsVisible,
  areDamageNumbersEnabled,
  areWaveKillTalliesEnabled,
  areWaveDamageTalliesEnabled,
  areTrackTracersEnabled,
  getActiveGraphicsMode,
  bindTrackRenderModeButton,
  initializeTrackRenderMode,
  initializeLoadoutSlotPreference,
  setLoadoutSlotChangeHandler,
} from './preferences.js';
import { SimplePlayfield, configurePlayfieldSystem } from './playfield.js';
import { configurePerformanceMonitor } from './performanceMonitor.js';
import * as PlayfieldStatsPanel from './playfieldStatsPanel.js';
import {
  configureAutoSave,
  loadPersistentState,
  schedulePowderSave,
  schedulePowderBasinSave,
  savePowderCurrency,
  startAutoSaveLoop,
  stopAutoSaveLoop,
  commitAutoSave,
  readStorage,
  writeStorage,
  readStorageJson,
  writeStorageJson,
  GRAPHICS_MODE_STORAGE_KEY,
  NOTATION_STORAGE_KEY,
  GLYPH_EQUATIONS_STORAGE_KEY,
  POWDER_STORAGE_KEY,
  GAME_STATS_STORAGE_KEY,
  POWDER_BASIN_STORAGE_KEY,
  TOWER_UPGRADE_STORAGE_KEY,
  SHIN_STATE_STORAGE_KEY,
  KUF_STATE_STORAGE_KEY,
} from './autoSave.js';
import {
  configureOfflinePersistence,
  bindOfflineOverlayElements,
  updatePowderLogDisplay,
  recordPowderEvent,
  checkOfflineRewards,
  markLastActive,
  OFFLINE_STORAGE_KEY,
} from './offlinePersistence.js';
import { createPowderPersistence } from './powderPersistence.js';
import { createPowderDisplaySystem } from './powderDisplay.js';
import { createPowderViewportController } from './powderViewportController.js';
import { createPowderResizeObserver } from './powderResizeObserver.js';
// DOM helpers extracted from main.js to hydrate powder and fluid overlays.
import { createPowderUiDomHelpers } from './powderUiDomHelpers.js';
// Lightweight animation overlay that keeps the Bet terrarium lively.
import { FluidTerrariumCreatures } from './fluidTerrariumCreatures.js';
// Brownian forest crystal growth pinned to the Bet cavern walls.
import { FluidTerrariumCrystal } from './fluidTerrariumCrystal.js';
// Fractal trees anchored by the Bet terrarium placement masks.
import { FluidTerrariumTrees, resolveTerrariumTreeLevel } from './fluidTerrariumTrees.js';
// Procedural grass that sprouts from the terrarium silhouettes.
import { FluidTerrariumGrass } from './fluidTerrariumGrass.js';
// Day/night cycle that animates the Bet terrarium sky and celestial bodies.
import { FluidTerrariumSkyCycle } from './fluidTerrariumSkyCycle.js';
// Phi and Psi shrooms for the Bet terrarium cave zones.
import { FluidTerrariumShrooms } from './fluidTerrariumShrooms.js';
// Bet Spire happiness production tracker fed by Serendipity purchases.
import { createBetHappinessSystem } from './betHappiness.js';
import { createResourceHud } from './resourceHud.js';
import { createTsadiUpgradeUi } from './tsadiUpgradeUi.js';
import { createTsadiBindingUi } from './tsadiBindingUi.js';
import { createSpireTabVisibilityManager } from './spireTabVisibility.js';
import { createIdleLevelRunManager } from './idleLevelRunManager.js';
import { createSpireResourceState } from './state/spireResourceState.js';
import { createPowderStateContext } from './powder/powderState.js';
import { createTsadiMoleculeNameGenerator, TSADI_MOLECULE_LEXICON } from './tsadiMoleculeNameGenerator.js';
import { createSpireResourceBanks } from './spireResourceBanks.js';
// Powder tower palette and simulation helpers.
import {
  DEFAULT_MOTE_PALETTE,
  POWDER_CELL_SIZE_PX,
  PowderSimulation,
  mergeMotePalette,
} from '../scripts/features/towers/powderTower.js';
// Fluid tower shallow-water simulation extracted into a dedicated module.
import { FluidSimulation } from '../scripts/features/towers/fluidTower.js';
// Lamed tower gravity simulation for orbital mechanics with sparks.
import { GravitySimulation } from '../scripts/features/towers/lamedTower.js';
// Tsadi tower particle fusion simulation with tier-based merging.
import {
  ParticleFusionSimulation,
  getGreekTierInfo,
  ADVANCED_MOLECULE_UNLOCK_TIER,
} from '../scripts/features/towers/tsadiTower.js';
// Shin tower fractal tree simulation with incremental growth.
import { FractalTreeSimulation } from '../scripts/features/towers/fractalTreeSimulation.js';
// Shin state management for Iteron allocation and fractal progression.
import {
  initializeShinState,
  loadFractalDefinitions,
  getShinStateSnapshot,
  updateShinState,
  addIterons,
  getIteronBank,
  getIterationRate,
  getShinGlyphs,
  resetShinState,
  setIterationRate,
  setShinGlyphs,
  unlockAllFractals,
} from './shinState.js';
// Shin UI components for fractal tab management and display.
import {
  initializeShinUI,
  updateShinDisplay,
  refreshFractalTabs,
  setShinUIUpdateCallback,
  updateFractalSimulation,
  resizeShinFractalCanvases,
} from './shinUI.js';
import {
  initializeKufState,
  getKufStateSnapshot,
  getKufGlyphs,
  onKufStateChange,
  setKufTotalShards,
  resetKufState,
  setKufGlyphs,
} from './kufState.js';
import { initializeKufUI, updateKufDisplay } from './kufUI.js';
// Shared color palette orchestration utilities.
import {
  configureColorSchemeSystem,
  getTowerVisualConfig,
  getOmegaWaveVisualConfig,
  bindColorSchemeButton,
  initializeColorScheme,
  COLOR_SCHEME_STORAGE_KEY,
  samplePaletteGradient,
} from './colorSchemeUtils.js';
import {
  configureAchievementsTab,
  generateLevelAchievements,
  bindAchievements,
  evaluateAchievements,
  refreshAchievementPowderRate,
  getUnlockedAchievementCount,
  notifyTowerPlaced,
  getAchievementPowderRate,
} from './achievementsTab.js';
import {
  configureFieldNotesOverlay,
  initializeFieldNotesOverlay,
  openFieldNotesOverlay,
  isFieldNotesOverlayVisible,
  setFieldNotesOpenButton,
} from './fieldNotesOverlay.js';
import {
  configurePlayfieldOutcome,
  setPlayfieldOutcomeElements,
  bindPlayfieldOutcomeEvents,
  hidePlayfieldOutcome,
  showPlayfieldOutcome,
  exitToLevelSelectionFromOutcome,
  handleOutcomeRetryRequest,
} from './playfieldOutcome.js';
import {
  codexState,
  enemyCodexElements,
  setEnemyCodexEntries,
  getEnemyCodexEntries,
  getEnemyCodexEntry,
  renderEnemyCodex,
  registerEnemyEncounter,
  bindCodexControls,
  initializePerformanceCodex,
  initializeEnemyCodexOverlay,
} from './codex.js';
import {
  setTowerDefinitions,
  getTowerDefinitions,
  getTowerDefinition,
  getNextTowerId,
  getTowerLoadoutState,
  getTowerUnlockState,
  getMergeProgressState,
  setMergingLogicCard,
  setLoadoutElements,
  setAudioManager as setTowersAudioManager,
  setPlayfield as setTowersPlayfield,
  setGlyphCurrency,
  addGlyphCurrency,
  getGlyphCurrency,
  setBetGlyphCurrency,
  addBetGlyphCurrency,
  getBetGlyphCurrency,
  setTheroSymbol,
  setTowerLoadoutLimit,
  setHideUpgradeMatrixCallback,
  setRenderUpgradeMatrixCallback,
  setMergingLogicUnlocked,
  refreshTowerLoadoutDisplay,
  cancelTowerDrag,
  updateTowerSelectionButtons,
  getTowerEquationBlueprint,
  renderTowerUpgradeOverlay,
  closeTowerUpgradeOverlay,
  getTowerUpgradeOverlayElement,
  isTowerUpgradeOverlayActive,
  getActiveTowerUpgradeId,
  bindTowerUpgradeOverlay,
  bindTowerCardUpgradeInteractions,
  updateTowerCardVisibility,
  injectTowerCardPreviews,
  simplifyTowerCards,
  annotateTowerCardsWithCost,
  initializeTowerSelection,
  initializeTowerEquipmentInterface,
  synchronizeTowerCardMasterEquations,
  syncLoadoutToPlayfield,
  pruneLockedTowersFromLoadout,
  unlockTower,
  isTowerUnlocked,
  initializeDiscoveredVariablesFromUnlocks,
  addDiscoveredVariablesListener,
  getDiscoveredVariables,
  getTowerUpgradeStateSnapshot,
  applyTowerUpgradeStateSnapshot,
  calculateInvestedGlyphs,
  clearTowerUpgradeState,
  configureTowersTabCallbacks,
} from './towersTab.js';
import towers from './data/towers/index.js'; // Modular tower definitions sourced from dedicated files.
import { initializeEquipmentState, EQUIPMENT_STORAGE_KEY } from './equipment.js';
import { initializeTowerTreeMap, refreshTowerTreeMap } from './towerTreeMap.js';
// Bring in drag-scroll support so hidden scrollbars remain usable.
import { enableDragScroll } from './dragScroll.js';
import { createLevelEditorController } from './levelEditor.js';
import { createLevelPreviewRenderer, getPreviewPointsForLevel } from './levelPreviewRenderer.js';
import { createLevelOverlayController } from './levelOverlayController.js';
import { createLevelStoryScreen } from './levelStoryScreen.js';
import { createSpireFloatingMenuController } from './spireFloatingMenu.js';
import { createPlayfieldMenuController } from './playfieldMenu.js';
import { createManualDropController } from './manualDropController.js';
import { bindPageLifecycleEvents } from './pageLifecycle.js';
import { createVariableLibraryController } from './variableLibraryController.js';
import { createUpgradeMatrixOverlay } from './upgradeMatrixOverlay.js';
import { createLevelSummaryHelpers } from './levelSummary.js';
import { createLamedSpireUi } from './lamedSpireUi.js';
import { createDeveloperModeManager } from './developerModeManager.js';
import {
  moteGemState,
  MOTE_GEM_COLLECTION_RADIUS,
  configureEnemyHandlers,
  resetActiveMoteGems,
  spawnMoteGemDrop,
  collectMoteGemsWithinRadius,
  autoCollectActiveMoteGems,
  setMoteGemAutoCollectUnlocked,
  getMoteGemColor,
  getGemSpriteAssetPath,
} from './enemies.js';
import {
  initializeCraftingOverlay,
  openCraftingOverlay,
  refreshCraftingRecipesDisplay,
  CRAFTING_TIER_STORAGE_KEY,
} from './crafting.js';
import {
  configureDeveloperControls,
  bindDeveloperControls,
  syncDeveloperControlValues,
  updateDeveloperControlsVisibility,
  setDeveloperIteronBank,
  setDeveloperIterationRate,
} from './developerControls.js';
import {
  configureTabManager,
  getActiveTabId,
  initializeTabs,
  setActiveTab,
} from './uiTabManager.js';
import {
  fetchJsonWithFallback,
  getEmbeddedGameplayConfig,
  loadGameplayConfigViaFetch,
  loadGameplayConfigViaModule,
} from './gameplayConfigLoaders.js';
import {
  cloneVectorArray,
  cloneWaveArray,
  setLevelBlueprints,
  setLevelConfigs,
  initializeInteractiveLevelProgression,
  populateIdleLevelConfigs,
  pruneLevelState,
  getCompletedInteractiveLevelCount,
  getBaseStartingTheroMultiplier,
  getStartingTheroMultiplier,
  setDeveloperTheroMultiplierOverride,
  getDeveloperTheroMultiplierOverride,
  clearDeveloperTheroMultiplierOverride,
  isInteractiveLevel,
  isSecretLevelId,
  isLevelUnlocked,
  isLevelCompleted,
  unlockLevel,
  unlockNextInteractiveLevel,
  getPreviousInteractiveLevelId,
  levelBlueprints,
  levelLookup,
  levelConfigs,
  idleLevelConfigs,
  levelState,
  interactiveLevelOrder,
  unlockedLevels,
  levelSetEntries,
  isStoryOnlyLevel,
  getLevelProgressSnapshot,
  applyLevelProgressSnapshot,
  setDeveloperModeUnlockOverride,
} from './levels.js';
import {
  isTutorialCompleted,
  loadTutorialState,
  checkTutorialCompletion,
  completeTutorial,
  isTowersTabUnlocked,
  unlockTowersTab as unlockTowersTabState,
  isCodexUnlocked,
  unlockCodex,
  isAchievementsUnlocked,
  unlockAchievements,
} from './tutorialState.js';
import {
  updateTabLockStates,
  initializeTabLockStates,
  unlockCodexTab,
  unlockAchievementsTab,
  unlockTowersTab,
} from './tabLockManager.js';
import {
  createOverlayHelpers,
  setElementVisibility,
  triggerButtonRipple,
  scrollPanelToElement,
  enablePanelWheelScroll,
} from './uiHelpers.js';
import {
  toSubscriptNumber,
  formatAlephLabel,
  formatDuration,
  formatRewards,
  formatRelativeTime,
} from './formatHelpers.js';
import { clampNormalizedCoordinate } from './geometryHelpers.js';

(() => {
  'use strict';

  initializeStartupOverlay();

  // Wire performance instrumentation into the graphics preference system for auto fallbacks.
  configurePerformanceMonitor({
    applyGraphicsMode,
    getActiveGraphicsMode,
    isLowGraphicsModeActive,
  });

  let updateStatusDisplays = () => {};
  let bindStatusElements = () => {};
  let registerResourceHudRefreshCallback = () => {};
  let resourceElements = {
    theroMultiplier: null,
    glyphsAlephTotal: null,
    glyphsAlephUnused: null,
    glyphsBetTotal: null,
    glyphsBetUnused: null,
    glyphsLamedTotal: null,
    glyphsLamedUnused: null,
    glyphsTsadiTotal: null,
    glyphsTsadiUnused: null,
    glyphsShinTotal: null,
    glyphsShinUnused: null,
    glyphsKufTotal: null,
    glyphsKufUnused: null,
    tabGlyphBadge: null,
    tabMoteBadge: null,
    tabFluidBadge: null,
  };
  let getTrackedLamedGlyphs = () => 0;
  let setTrackedLamedGlyphs = () => {};
  let getTrackedTsadiGlyphs = () => 0;
  let setTrackedTsadiGlyphs = () => {};
  let getTrackedShinGlyphs = () => 0;
  let setTrackedShinGlyphs = () => {};
  let getTrackedKufGlyphs = () => 0;
  let setTrackedKufGlyphs = () => {};

  const THERO_SYMBOL = 'þ';
  const COMMUNITY_DISCORD_INVITE = 'https://discord.gg/UzqhfsZQ8n'; // Reserved for future placement.

  const SVG_NS = 'http://www.w3.org/2000/svg';

  setTheroSymbol(THERO_SYMBOL);

  const { getLevelSummary, describeLevelLastResult } = createLevelSummaryHelpers({
    getCompletedInteractiveLevelCount,
    getStartingTheroMultiplier,
    isInteractiveLevel,
    levelConfigs,
    idleLevelConfigs,
    getBaseStartThero,
    theroSymbol: THERO_SYMBOL,
    isDeveloperInfiniteTheroEnabled,
  });

  // Gameplay configuration, resource baselines, and fluid profile loading now reside in configuration.js.

  // Re-renders UI panels that depend on the number formatting preference.
  function refreshNotationDisplays() {
    updateStatusDisplays();
    updatePowderStockpileDisplay();
    updatePowderLedger();
    refreshTowerLoadoutDisplay();
    updateTowerSelectionButtons();
    if (isTowerUpgradeOverlayActive()) {
      const activeUpgradeId = getActiveTowerUpgradeId();
      if (activeUpgradeId) {
        renderTowerUpgradeOverlay(activeUpgradeId);
      }
    }
    generateLevelAchievements();
  }

  setNotationRefreshHandler(refreshNotationDisplays);

  function getOmegaPatternForTier(tier) {
    const normalized = Number.isFinite(tier) ? Math.max(24, Math.floor(tier)) : 24;
    const stage = Math.max(0, normalized - 24);
    const radius = 60 + stage * 18;
    const loops = 1.6 + stage * 0.45;
    const ratio = 1.8 + stage * 0.28;
    const swirl = 0.8 + stage * 0.18;
    const swirlFrequency = 2.4 + stage * 0.55;
    const envelopePower = 1.1 + stage * 0.12;
    const returnCurve = 0.55 + stage * 0.1;
    const duration = 2 + stage * 0.4;
    const projectileCount = Math.min(22, 10 + stage * 3);
    const baseSize = 4 + stage * 0.45;
    const phaseShift = 0.35 + stage * 0.05;
    return {
      radius,
      loops,
      ratio,
      swirl,
      swirlFrequency,
      envelopePower,
      returnCurve,
      duration,
      projectileCount,
      baseSize,
      phaseShift,
    };
  }

  // applyGameplayConfig, ensureGameplayConfigLoaded, and calculateStartingThero are provided by configuration.js.

  let levelGrid = null;
  let activeLevelEl = null;
  let leaveLevelBtn = null;
  let levelPreviewRenderer = null;
  let levelOverlayController = null;
  let activeLevelId = null;
  let pendingLevel = null;
  let lastLevelTrigger = null;
  let expandedLevelSet = null;
  let expandedCampaign = null;
  let campaignRowElement = null;
  let campaignButtons = [];

  const PERSISTENT_STORAGE_KEYS = [
    GRAPHICS_MODE_STORAGE_KEY,
    NOTATION_STORAGE_KEY,
    GLYPH_EQUATIONS_STORAGE_KEY,
    POWDER_STORAGE_KEY,
    GAME_STATS_STORAGE_KEY,
    POWDER_BASIN_STORAGE_KEY,
    TOWER_UPGRADE_STORAGE_KEY,
    AUDIO_SETTINGS_STORAGE_KEY,
    CRAFTING_TIER_STORAGE_KEY,
    EQUIPMENT_STORAGE_KEY,
    OFFLINE_STORAGE_KEY,
    COLOR_SCHEME_STORAGE_KEY,
    // Clear Kuf tactical progress so glyph wipes remove saved spire runs.
    KUF_STATE_STORAGE_KEY,
    SHIN_STATE_STORAGE_KEY,
  ].filter(Boolean);

  // Initialize overlay helpers from uiHelpers module
  const overlayHelpers = createOverlayHelpers();
  const { cancelOverlayHide, scheduleOverlayHide, revealOverlay } = overlayHelpers;

  const upgradeMatrixOverlayController = createUpgradeMatrixOverlay({
    revealOverlay,
    scheduleOverlayHide,
    getTowerDefinitions,
    getTowerDefinition,
    isTowerUnlocked,
    formatGameNumber,
    theroSymbol: THERO_SYMBOL,
  });
  const {
    bindUpgradeMatrix,
    hideUpgradeMatrix,
    renderUpgradeMatrix,
    handleKeydown: handleUpgradeMatrixKeydown,
  } = upgradeMatrixOverlayController;

  const variableLibraryController = createVariableLibraryController({
    revealOverlay,
    scheduleOverlayHide,
    getDiscoveredVariables,
    addDiscoveredVariablesListener,
    openCraftingOverlay,
  });

  // Developer map element references allow quick toggles for spawning and clearing obstacles.
  let developerModeActive = false;
  // Developer sandbox toggle that forces all levels to start with infinite Thero for rapid testing.
  let developerInfiniteTheroEnabled = false;

  let playfield = null;
  // Track layout elements so the UI can swap between the battlefield and level grid.
  let playfieldWrapper = null;
  let stageControls = null;
  let levelSelectionSection = null;
  let activeLevelIsInteractive = false;
  let playfieldMenuController = null;
  let audioManager = null;

  function updateLayoutVisibility() {
    // Hide the battlefield until an interactive level is in progress.
    const shouldShowPlayfield = Boolean(activeLevelId && activeLevelIsInteractive);
    setElementVisibility(playfieldWrapper, shouldShowPlayfield);
    setElementVisibility(stageControls, shouldShowPlayfield);
    setElementVisibility(levelSelectionSection, !shouldShowPlayfield);

    if (!shouldShowPlayfield) {
      if (playfieldMenuController) {
        playfieldMenuController.closeMenu();
        playfieldMenuController.resetStatsPanelState();
      }
      return;
    }

    if (playfield && typeof playfield.syncCanvasSize === 'function') {
      // Refresh the canvas geometry once the battlefield becomes visible again.
      playfield.syncCanvasSize();
    }

    if (playfieldMenuController) {
      playfieldMenuController.syncStatsPanelVisibility();
    }
  }


  const playfieldElements = {
    container: null,
    canvas: null,
    message: null,
    wave: null,
    health: null,
    energy: null,
    progress: null,
    startButton: null,
    speedButton: null,
    autoAnchorButton: null,
    slots: [],
  };

  const levelEditor = createLevelEditorController({
    playfieldElements,
    getPlayfield: () => playfield,
    getLevelConfigs: () => levelConfigs,
    isDeveloperModeActive: () => developerModeActive,
  });

  // Allow developer controls to flip the infinite Thero sandbox flag and refresh level UI accordingly.
  function setDeveloperInfiniteTheroEnabled(active) {
    developerInfiniteTheroEnabled = Boolean(active);
    updateLevelCards();
    updateActiveLevelBanner();
  }

  // Keep dependent systems aware of whether infinite Thero is active while developer mode is enabled.
  function isDeveloperInfiniteTheroEnabled() {
    return Boolean(developerModeActive && developerInfiniteTheroEnabled);
  }

  const {
    setLevelEditorSurface,
    resetLevelEditorSurface,
    configureLevelEditorForLevel,
    syncLevelEditorVisibility,
    updateDeveloperMapElementsVisibility,
    setDeveloperMapPlacementMode,
    handleDeveloperMapPlacementRequest,
    initializeDeveloperMapElements,
    initializeLevelEditorElements,
    activateDeveloperMapToolsForLevel,
    deactivateDeveloperMapTools,
    isDeveloperMapToolsActive,
    hideLevelEditorPanel,
    setOverlayPreviewLevel,
  } = levelEditor;

  // Centralize quick menu controls (commence/retry/dev tools/stats) outside of main.js.
  playfieldMenuController = createPlayfieldMenuController({
    getActiveLevelId: () => activeLevelId,
    isActiveLevelInteractive: () => activeLevelIsInteractive,
    getPlayfield: () => playfield,
    getStartButton: () => playfieldElements.startButton,
    isDeveloperModeActive: () => developerModeActive,
    getLevelById: (levelId) => levelLookup.get(levelId),
    isDeveloperMapToolsActive,
    activateDeveloperMapToolsForLevel,
    deactivateDeveloperMapTools,
    clearPendingLevel: () => {
      pendingLevel = null;
    },
    requestLayoutRefresh: () => {
      updateLayoutVisibility();
    },
    leaveActiveLevel,
    onStatsPanelVisibilityChange: (visible) => {
      if (playfield && typeof playfield.setStatsPanelEnabled === 'function') {
        playfield.setStatsPanelEnabled(visible);
      }
    },
    focusStatsPanel: () => {
      if (typeof PlayfieldStatsPanel.focusPanel === 'function') {
        PlayfieldStatsPanel.focusPanel();
      }
    },
    resetStatsPanel: () => {
      if (typeof PlayfieldStatsPanel.resetPanel === 'function') {
        PlayfieldStatsPanel.resetPanel();
      }
    },
    getAudioManager: () => audioManager,
    setPlayfieldMessage: (message) => {
      if (playfield?.messageEl) {
        playfield.messageEl.textContent = message;
      }
    },
  });

  configurePlayfieldOutcome({
    getPlayfield: () => playfield,
    leaveActiveLevel,
    updateLayoutVisibility,
    getStartButton: () => playfieldElements.startButton,
  });


  /**
   * Award Bet glyph currency when Bet Spire water reaches height milestones.
   * Bet glyphs (בּ) are the second type of upgrade currency, exclusive to the Bet Spire
   * and unlocked at the same height thresholds as Aleph glyphs but tracked independently.
   * @param {number} count - Number of Bet glyphs to award
   */
  function awardBetGlyphs(count) {
    if (!Number.isFinite(count) || count <= 0) {
      return;
    }
    // Award Bet glyph currency to the player
    addBetGlyphCurrency(count);
    console.log(`Awarded ${count} Bet glyph${count !== 1 ? 's' : ''} (בּ)`);
    recordPowderEvent('bet-glyph-award', { count });
  }

  const gameStats = {
    manualVictories: 0,
    idleVictories: 0,
    towersPlaced: 0,
    maxTowersSimultaneous: 0,
    autoAnchorPlacements: 0,
    powderActions: 0,
    enemiesDefeated: 0,
    idleMillisecondsAccumulated: 0,
    powderSigilsReached: 0,
    highestPowderMultiplier: 1,
  };

  audioManager = new AudioManager(DEFAULT_AUDIO_MANIFEST);
  setTowersAudioManager(audioManager);

  configureFieldNotesOverlay({
    revealOverlay,
    scheduleOverlayHide,
    audioManager,
  });

  const {
    suppressAudioPlayback,
    releaseAudioSuppression,
    isAudioSuppressed,
    syncAudioControlsFromManager,
    bindAudioControls,
    determineMusicKey,
    refreshTabMusic,
  } = createAudioOrchestration({
    audioManager,
    bindAudioControlElements,
    writeStorageJson,
    audioSettingsStorageKey: AUDIO_SETTINGS_STORAGE_KEY,
    getActiveTabId,
    isPlayfieldInteractiveLevelActive: () =>
      Boolean(
        playfield &&
          typeof playfield.isInteractiveLevelActive === 'function' &&
          playfield.isInteractiveLevelActive(),
      ),
  });

  // Cached reference to the notation toggle control inside the Codex panel.
  let notationToggleButton = null;

  const { baseResources, resourceState } = createResourceStateContainers({
    calculateStartingThero,
    baseScoreRate: FALLBACK_BASE_SCORE_RATE,
    baseEnergyRate: FALLBACK_BASE_ENERGY_RATE,
    baseFluxRate: FALLBACK_BASE_FLUX_RATE,
    registerResourceContainers,
  });

  // Re-enable the Bet Spire Terrarium so its ambient terrarium renders (slimes, grass, trees, sky cycle).
  const FLUID_STUDY_ENABLED = true;

  const FLUID_UNLOCK_BASE_RESERVOIR_DROPS = 100; // Seed the Bet Spire Terrarium with a base reservoir of Serendipity upon unlock.

  const {
    powderConfig,
    powderState,
    fluidElements,
    powderGlyphColumns,
    fluidGlyphColumns,
    getPowderElements,
    setPowderElements,
  } = createPowderStateContext();

  // Track idle reserves for advanced spires so their banks persist outside of active simulations.
  const spireResourceState = createSpireResourceState();
  // Randomized, non-repeating Tsadi molecule name generator seeded per session.
  const tsadiMoleculeNameGenerator = createTsadiMoleculeNameGenerator('tsadi-codex', TSADI_MOLECULE_LEXICON);

  // Spawn zones derived from the solid color block markers inside Cave-4.png and Cave-5.png so Deltas appear inside those caverns.
  const BET_CAVE_SPAWN_ZONES = [
    { x: 225 / 1024, y: 1076 / 1536, width: 240 / 1024, height: 198 / 1536 },
    { x: 540 / 1024, y: 1064 / 1536, width: 310 / 1024, height: 205 / 1536 },
  ];

  const { updateFluidTabAvailability, updateSpireTabVisibility } = createSpireTabVisibilityManager({
    fluidElements,
    getResourceElements: () => resourceElements,
    spireResourceState,
    powderState,
  });

  let betHappinessSystem = null;
  // Animate Delta slimes once the fluid viewport is bound.
  let fluidTerrariumCreatures = null;
  // Grow a Shin-inspired Brownian forest along the Bet cavern walls.
  let fluidTerrariumCrystal = null;
  // Grow Shin-inspired fractal trees on top of the Bet terrain silhouettes.
  let fluidTerrariumTrees = null;
  // Render swaying grass blades that cling to the Bet spire silhouettes.
  let fluidTerrariumGrass = null;
  // Drive the Bet terrarium day/night palette and celestial bodies.
  let fluidTerrariumSkyCycle = null;
  // Phi and Psi shrooms that grow inside cave spawn zones.
  let fluidTerrariumShrooms = null;

  /**
   * Force the Bet Spire Terrarium to remain locked and inactive while the feature is disabled.
   * This ensures saved unlocks or tabs cannot resurrect the retired simulation.
   */
  function enforceFluidStudyDisabledState() {
    if (FLUID_STUDY_ENABLED) {
      return;
    }

    powderState.fluidUnlocked = false;
    powderState.simulationMode = 'sand';
    powderState.pendingFluidDrops = [];
    powderState.loadedFluidState = null;
    powderState.fluidIdleBank = 0;
    powderState.fluidIdleDrainRate = 0;
    powderState.fluidBankHydrated = false;
    powderState.fluidInitialLoadRestored = true;
    if (getActiveTabId() === 'fluid') {
      setActiveTab('powder');
    }
    updateFluidTabAvailability();
    updateSpireTabVisibility();
  }

  /**
   * Wait for a terrarium sprite to load so dependent overlays align with its silhouette.
   * @param {HTMLImageElement|null} image
   * @returns {Promise<boolean>} Resolves true when the image is ready.
   */
  function waitForTerrariumSprite(image) {
    if (!image) {
      return Promise.resolve(false);
    }

    // Force lazy-loaded sprites to decode immediately so startup flow doesn't stall
    // while the browser waits for the terrarium art to enter the viewport.
    if (image.loading === 'lazy') {
      image.loading = 'eager';
      if (typeof image.decode === 'function') {
        image.decode().catch(() => {});
      }
    }

    if (
      image.complete &&
      Number.isFinite(image.naturalWidth) &&
      Number.isFinite(image.naturalHeight) &&
      image.naturalWidth > 0 &&
      image.naturalHeight > 0
    ) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const handleComplete = (didLoad) => {
        image.removeEventListener('load', handleLoad);
        image.removeEventListener('error', handleError);
        resolve(didLoad);
      };

      const handleLoad = () => {
        handleComplete(true);
      };
      const handleError = () => {
        handleComplete(false);
      };

      // Prevent the startup sequence from hanging indefinitely if the sprite never
      // fires a load/error event (e.g., due to an unsupported format or network block).
      const timeoutHandle = window.setTimeout(() => handleComplete(false), 3000);

      image.addEventListener('load', handleLoad, { once: true });
      image.addEventListener('error', handleError, { once: true });

      // Clear the timeout once we reach a terminal state.
      const cleanup = () => window.clearTimeout(timeoutHandle);
      image.addEventListener('load', cleanup, { once: true });
      image.addEventListener('error', cleanup, { once: true });
    });
  }

  /**
   * Ensure the Bet terrarium surfaces spawn in order so creatures and foliage don't fall through.
   * First wait for the lightweight collision silhouette, then the ground terrain, and finally the floating island.
   */
  async function ensureTerrariumSurfacesReady() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    const collisionSprite = fluidElements.terrainCollisionSprite;
    if (collisionSprite && collisionSprite !== fluidElements.terrainSprite) {
      await waitForTerrariumSprite(collisionSprite);
    }
    await waitForTerrariumSprite(fluidElements.terrainSprite);
    await waitForTerrariumSprite(fluidElements.floatingIslandSprite);
  }

  function ensureFluidTerrariumCreatures() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    // Lazily create the overlay so it never blocks powder initialization.
    if (fluidTerrariumCreatures || !fluidElements?.viewport) {
      return;
    }
    const slimeCount = Math.max(1, betHappinessSystem ? betHappinessSystem.getProducerCount('slime') : 4);
    fluidTerrariumCreatures = new FluidTerrariumCreatures({
      container: fluidElements.viewport,
      terrainElement: fluidElements.terrainSprite,
      terrainCollisionElement: fluidElements.terrainCollisionSprite,
      creatureCount: slimeCount,
      spawnZones: BET_CAVE_SPAWN_ZONES,
    });
    if (betHappinessSystem) {
      betHappinessSystem.setProducerCount('slime', slimeCount);
    }
    fluidTerrariumCreatures.start();
  }

  // Lazily generate the terrarium grass overlay once the stage media is available.
  function ensureFluidTerrariumGrass() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    if (fluidTerrariumGrass || !fluidElements?.terrariumMedia || !fluidElements?.terrainSprite) {
      return;
    }
    fluidTerrariumGrass = new FluidTerrariumGrass({
      container: fluidElements.terrariumMedia,
      terrainElement: fluidElements.terrainSprite,
      floatingIslandElement: fluidElements.floatingIslandSprite,
      // Use both ground and floating island placement masks so grass sprouts in each marked zone.
      maskUrls: [
        './assets/sprites/spires/betSpire/Grass.png',
        './assets/sprites/spires/betSpire/Island-Grass.png',
      ],
    });
    fluidTerrariumGrass.start();
  }

  // Grow a Brownian forest inside the growing crystal alcove, constrained by the collision silhouette.
  function ensureFluidTerrariumCrystal() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    if (fluidTerrariumCrystal || !fluidElements?.terrariumMedia) {
      return;
    }
    fluidTerrariumCrystal = new FluidTerrariumCrystal({
      container: fluidElements.terrariumMedia,
      collisionElement: fluidElements.terrainCollisionSprite,
      maskUrl: './assets/sprites/spires/betSpire/Growing-Crystal.png',
    });
  }

  function updateTerrariumTreeHappiness(trees = {}) {
    if (!betHappinessSystem) {
      return;
    }
    let largeLevels = 0;
    let smallLevels = 0;
    Object.entries(trees || {}).forEach(([treeId, treeState]) => {
      const allocated = Number.isFinite(treeState?.allocated) ? treeState.allocated : 0;
      const { level } = resolveTerrariumTreeLevel(allocated);
      if (!level) {
        return;
      }
      const treeKey = typeof treeId === 'string' ? treeId : '';
      if (treeKey.startsWith('large-')) {
        largeLevels += level;
      } else if (treeKey.startsWith('small-')) {
        smallLevels += level;
      }
    });
    betHappinessSystem.setProducerCount('betTreeLarge', largeLevels);
    betHappinessSystem.setProducerCount('betTreeSmall', smallLevels);
    betHappinessSystem.updateDisplay();
  }

  // Plant animated fractal trees on the Bet terrarium using the placement masks.
  function ensureFluidTerrariumTrees() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    if (fluidTerrariumTrees || !fluidElements?.terrariumMedia) {
      return;
    }
    fluidTerrariumTrees = new FluidTerrariumTrees({
      container: fluidElements.terrariumMedia,
      largeMaskUrl: './assets/sprites/spires/betSpire/Tree.png',
      smallMaskUrl: './assets/sprites/spires/betSpire/Small-Tree.png',
      islandSmallMaskUrl: './assets/sprites/spires/betSpire/Island-Small-Tree.png',
      state: powderState.betTerrarium,
      powderState: powderState,
      spendSerendipity: spendFluidSerendipity,
      getSerendipityBalance: getCurrentFluidDropBank,
      onShroomPlace: handleShroomPlacement,
      onStateChange: (state) => {
        powderState.betTerrarium = {
          levelingMode: Boolean(state?.levelingMode),
          trees: state?.trees ? { ...state.trees } : {},
          buttonMenuOpen: Boolean(state?.buttonMenuOpen),
          cameraMode: Boolean(state?.cameraMode),
        };
        updateTerrariumTreeHappiness(powderState.betTerrarium.trees);
        schedulePowderBasinSave();
        setFluidCameraMode(powderState.betTerrarium.cameraMode, {
          skipTransformReset: true,
          skipSave: true,
        });
      },
    });
    setFluidCameraMode(Boolean(powderState.betTerrarium?.cameraMode), {
      skipTransformReset: true,
      skipSave: true,
    });
  }

  // Paint the Bet terrarium sky with a looping day/night gradient and celestial path.
  function ensureFluidTerrariumSkyCycle() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    if (fluidTerrariumSkyCycle || !fluidElements?.terrariumSky) {
      return;
    }
    fluidTerrariumSkyCycle = new FluidTerrariumSkyCycle({
      skyElement: fluidElements.terrariumSky,
      sunElement: fluidElements.terrariumSun,
      moonElement: fluidElements.terrariumMoon,
    });
  }

  // Initialize Phi and Psi shrooms inside the cave spawn zones.
  function ensureFluidTerrariumShrooms() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    if (fluidTerrariumShrooms || !fluidElements?.viewport) {
      return;
    }
    // Initialize betShrooms state if not present
    if (!powderState.betShrooms) {
      powderState.betShrooms = { shrooms: [] };
    }
    fluidTerrariumShrooms = new FluidTerrariumShrooms({
      container: fluidElements.viewport,
      terrainElement: fluidElements.terrainSprite,
      terrainCollisionElement: fluidElements.terrainCollisionSprite,
      spawnZones: BET_CAVE_SPAWN_ZONES,
      onStateChange: (state) => {
        powderState.betShrooms = state;
        updateShroomHappiness();
      },
    });
    fluidTerrariumShrooms.start();
  }

  // Update happiness system with shroom levels.
  function updateShroomHappiness() {
    if (!betHappinessSystem || !fluidTerrariumShrooms) {
      return;
    }
    const shrooms = fluidTerrariumShrooms.getShrooms();
    let phiYellowLevels = 0;
    let phiGreenLevels = 0;
    let phiBlueLevels = 0;
    let psiLevels = 0;
    for (const shroom of shrooms) {
      if (shroom.type === 'phi') {
        switch (shroom.colorVariant) {
          case 'yellow':
            phiYellowLevels += shroom.level;
            break;
          case 'green':
            phiGreenLevels += shroom.level;
            break;
          case 'blue':
            phiBlueLevels += shroom.level;
            break;
          default:
            break;
        }
      } else if (shroom.type === 'psi') {
        psiLevels += shroom.level;
      }
    }
    betHappinessSystem.setProducerCount('phiShroomYellow', phiYellowLevels);
    betHappinessSystem.setProducerCount('phiShroomGreen', phiGreenLevels);
    betHappinessSystem.setProducerCount('phiShroomBlue', phiBlueLevels);
    betHappinessSystem.setProducerCount('psiShroom', psiLevels);
    betHappinessSystem.updateDisplay();
  }

  // Handle shroom placement from the terrarium store.
  function handleShroomPlacement(options) {
    if (!fluidTerrariumShrooms) {
      return false;
    }
    const { type, colorVariant } = options;
    if (type === 'phi') {
      const shroom = fluidTerrariumShrooms.addPhiShroom({
        colorVariant: colorVariant || 'yellow',
        level: 1,
      });
      if (shroom) {
        updateShroomHappiness();
        return true;
      }
    } else if (type === 'psi') {
      const shroom = fluidTerrariumShrooms.addPsiShroom({
        level: 1,
      });
      if (shroom) {
        updateShroomHappiness();
        return true;
      }
    }
    return false;
  }

  // Ensure compact autosave remains the active basin persistence strategy.
  document.addEventListener('DOMContentLoaded', () => {
    try {
      if (window.powderSimulation) {
        window.powderSimulation.useCompactAutosave = true;
      }
      if (window.fluidSimulationInstance) {
        window.fluidSimulationInstance.useCompactAutosave = true;
      }
    } catch (error) {
      // Ignore assignment failures caused by missing window globals during SSR/tests.
    }
  });

  let spireMenuController = null;

  const {
    getLamedSparkBank,
    setLamedSparkBank,
    ensureLamedBankSeeded,
    getTsadiParticleBank,
    setTsadiParticleBank,
    getTsadiBindingAgents,
    setTsadiBindingAgents,
    ensureTsadiBankSeeded,
    reconcileGlyphCurrencyFromState,
  } = createSpireResourceBanks({
    spireResourceState,
    getSpireMenuController: () => spireMenuController,
    powderState,
    calculateInvestedGlyphs,
    setGlyphCurrency,
  });

  // Controller that wires the floating spire navigation UI and count displays.
  spireMenuController = createSpireFloatingMenuController({
    formatGameNumber,
    formatWholeNumber,
    getCurrentIdleMoteBank,
    getCurrentFluidDropBank,
    getLamedSparkBank,
    getTsadiParticleBank,
    getShinGlyphs,
    getKufGlyphs,
    isFluidUnlocked: () => Boolean(spireResourceState.fluid?.unlocked || powderState.fluidUnlocked),
    isLamedUnlocked: () => Boolean(spireResourceState.lamed?.unlocked),
    isTsadiUnlocked: () => Boolean(spireResourceState.tsadi?.unlocked),
    isShinUnlocked: () => Boolean(spireResourceState.shin?.unlocked),
    isKufUnlocked: () => Boolean(spireResourceState.kuf?.unlocked),
    setActiveTab,
    playMenuSelectSfx: () => {
      if (audioManager) {
        audioManager.playSfx('menuSelect');
      }
    },
  });

  const lamedSpireUi = createLamedSpireUi({
    formatWholeNumber,
  });

  const resourceHud = createResourceHud({
    formatGameNumber,
    formatWholeNumber,
    getStartingTheroMultiplier,
    getGlyphCurrency,
    getBetGlyphCurrency,
    getShinGlyphs,
    getKufGlyphs,
    getCurrentIdleMoteBank,
    getCurrentFluidDropBank,
    powderState,
    spireResourceState,
    spireMenuController,
  });

  resourceElements = resourceHud.resourceElements;
  bindStatusElements = resourceHud.bindStatusElements;
  updateStatusDisplays = resourceHud.updateStatusDisplays;
  registerResourceHudRefreshCallback = resourceHud.registerStatusRefreshCallback;
  getTrackedLamedGlyphs = resourceHud.getTrackedLamedGlyphs;
  setTrackedLamedGlyphs = resourceHud.setTrackedLamedGlyphs;
  getTrackedTsadiGlyphs = resourceHud.getTrackedTsadiGlyphs;
  setTrackedTsadiGlyphs = resourceHud.setTrackedTsadiGlyphs;
  getTrackedShinGlyphs = resourceHud.getTrackedShinGlyphs;
  setTrackedShinGlyphs = resourceHud.setTrackedShinGlyphs;
  getTrackedKufGlyphs = resourceHud.getTrackedKufGlyphs;
  setTrackedKufGlyphs = resourceHud.setTrackedKufGlyphs;

  setTrackedLamedGlyphs(spireResourceState.lamed?.stats?.totalAbsorptions || 0);
  setTrackedTsadiGlyphs(
    Number.isFinite(spireResourceState.tsadi?.stats?.totalGlyphs)
      ? spireResourceState.tsadi.stats.totalGlyphs
      : spireResourceState.tsadi?.stats?.totalParticles || 0,
  );
  setTrackedShinGlyphs(getShinGlyphs());
  setTrackedKufGlyphs(getKufGlyphs());

  betHappinessSystem = createBetHappinessSystem({
    state: powderState.betHappiness,
    formatGameNumber,
    formatDecimal,
  });
  updateTerrariumTreeHappiness(powderState.betTerrarium?.trees);

  const {
    bindFluidControls,
    applyMindGatePaletteToDom,
    updateMoteGemInventoryDisplay,
    updatePowderGlyphColumns,
    updateFluidGlyphColumns,
  } = createPowderUiDomHelpers({
    getPowderElements,
    fluidElements,
    powderGlyphColumns,
    fluidGlyphColumns,
    moteGemState,
    formatWholeNumber,
    formatGameNumber,
    getMoteGemColor,
    getGemSpriteAssetPath,
  });

  const powderPersistence = createPowderPersistence({
    powderState,
    powderConfig,
    mergeMotePalette,
    applyMindGatePaletteToDom,
    updateFluidTabAvailability,
    schedulePowderBasinSave,
    getPowderSimulation: () => powderSimulation,
    getFluidSimulation: () => fluidSimulationInstance,
  });
  const getPowderBasinSnapshot = powderPersistence.getPowderBasinSnapshot;
  const applyPowderBasinSnapshot = (snapshot) => {
    powderPersistence.applyPowderBasinSnapshot(snapshot);
    updateTerrariumTreeHappiness(powderState.betTerrarium?.trees);
  };

  const SIGIL_LADDER_IS_STUB = true;

  // Declare simulation instances early to avoid Temporal Dead Zone errors when referenced in initialization functions.
  let sandSimulation = null;
  let powderSimulation = null;
  let fluidSimulationInstance = null;
  let lamedSimulationInstance = null;
  let lamedDeveloperSpamHandle = null;
  let lamedDeveloperSpamActive = false;
  let lamedDeveloperSpamAttached = false;
  let tsadiDeveloperSpamHandle = null;
  let tsadiDeveloperSpamActive = false;
  let tsadiDeveloperSpamAttached = false;
  let tsadiSimulationInstance = null;
  let shinSimulationInstance = null;
  let tsadiBindingUiInitialized = false;
  let kufUiInitialized = false;
  let pendingSpireResizeFrame = null;
  let previousTabId = getActiveTabId();

  // Track Tsadi status messaging so advanced molecule unlocks surface clearly in the UI.
  const tsadiStatusNoteElement = document.getElementById('tsadi-status-note');
  const TSADI_STATUS_BASE_MESSAGE = (tsadiStatusNoteElement?.textContent || '').trim()
    || 'Particles bounce and collide. When two particles of the same tier collide, they fuse into a higher tier. Each new tier reached earns a Tsadi glyph. Calm particles (with zero or negative repelling force) can be tied together with binding agents to form molecules for bonus effects.';

  /**
   * Render the Tsadi status note, appending the advanced particle unlock detail when applicable.
   * @param {number} highestTier - Current highest particle tier reached.
   */
  function updateTsadiStatusNote(highestTier = 0) {
    if (!tsadiStatusNoteElement) {
      return;
    }
    const advancedUnlocked = (tsadiSimulationInstance?.areAdvancedMoleculesUnlocked?.() ?? false)
      || highestTier >= ADVANCED_MOLECULE_UNLOCK_TIER;
    const advancedSentence = advancedUnlocked
      ? ' Advanced Particles Unlocked — duplicate-tier molecules can combine through chained Waals anchors.'
      : '';
    tsadiStatusNoteElement.textContent = `${TSADI_STATUS_BASE_MESSAGE}${advancedSentence ? ` ${advancedSentence}` : ''}`;
  }

  // Seed the Tsadi status note with the latest saved tier progress before the simulation spins up.
  updateTsadiStatusNote(Math.max(0, Math.floor(Number(spireResourceState.tsadi?.stats?.highestTier) || 0)));

  // Initialize the Towers tab emblem to the default mote palette before any theme swaps occur.
  applyMindGatePaletteToDom(powderState.motePalette);

  const { initializeTsadiBindingUi, updateBindingAgentDisplay, refreshCodexList } = createTsadiBindingUi({
    getTsadiSimulation: () => tsadiSimulationInstance,
    getBindingAgentBank: () => getTsadiBindingAgents(),
    setBindingAgentBank: (value) => setTsadiBindingAgents(value),
    spireResourceState,
  });

  function syncTsadiBindingAgents(nextValue) {
    const normalized = setTsadiBindingAgents(nextValue);
    if (tsadiSimulationInstance?.setAvailableBindingAgents) {
      tsadiSimulationInstance.setAvailableBindingAgents(normalized);
    }
    if (spireResourceState.tsadi) {
      spireResourceState.tsadi.bindingAgents = normalized;
    }
    updateBindingAgentDisplay();
  }

  function handleMoleculeDiscovery(recipe) {
    if (!recipe) {
      return;
    }
    if (!spireResourceState.tsadi) {
      spireResourceState.tsadi = {};
    }
    const existing = Array.isArray(spireResourceState.tsadi.discoveredMolecules)
      ? spireResourceState.tsadi.discoveredMolecules
      : [];
    const preserved = existing.filter((entry) => entry && entry.id !== recipe.id);
    spireResourceState.tsadi.discoveredMolecules = normalizeDiscoveredMolecules([...preserved, recipe]);
    refreshCodexList();
  }

  const {
    powderElements,
    bindPowderControls,
    updateResourceRates,
    updateMoteStatsDisplays,
    updatePowderStockpileDisplay,
    updatePowderLedger,
    triggerPowderBasinPulse,
    applyPowderGain,
    toggleSandfallStability,
    surveyRidgeHeight,
    chargeCrystalMatrix,
    refreshPowderSystems,
    updatePowderDisplay,
    notifyIdleTime,
    grantSpireMinuteIncome,
    bindSpireClickIncome,
    calculateIdleSpireSummary,
    getPowderCurrency,
    setPowderCurrency,
    getCurrentPowderBonuses,
    resetPowderUiState,
  } = createPowderDisplaySystem({
    powderState,
    powderConfig,
    powderGlyphColumns,
    formatWholeNumber,
    formatGameNumber,
    formatDecimal,
    formatPercentage,
    renderMathElement,
    getBaseStartThero,
    resourceState,
    baseResources,
    schedulePowderSave,
    recordPowderEvent,
    notifyPowderAction,
    notifyPowderMultiplier,
    notifyPowderSigils,
    updateStatusDisplays,
    getUnlockedAchievementCount,
    getAchievementPowderRate,
    getCurrentIdleMoteBank,
    getCurrentMoteDispenseRate,
    THERO_SYMBOL,
    bindFluidControls,
    updateFluidDisplay,
    updatePowderLogDisplay,
    updateMoteGemInventoryDisplay,
    SIGIL_LADDER_IS_STUB,
    getPowderSimulation: () => powderSimulation,
    spireResourceState,
    addIdleMoteBank,
    getLamedSparkBank,
    setLamedSparkBank,
    getTsadiParticleBank,
    setTsadiParticleBank,
    getTsadiBindingAgents,
    setTsadiBindingAgents,
    addIterons,
    updateShinDisplay,
    evaluateAchievements,
    spireMenuController,
    gameStats,
    getCompletedInteractiveLevelCount,
    getIteronBank,
    getIterationRate,
    betHappinessSystem,
    onTsadiBindingAgentsChange: syncTsadiBindingAgents,
  });

  setPowderElements(powderElements);

  registerResourceHudRefreshCallback(updateMoteStatsDisplays);
  registerResourceHudRefreshCallback(updatePowderModeButton);
  registerResourceHudRefreshCallback(updateFluidDisplay);

  // Provide the developer controls module with runtime state references once all powder helpers are wired.
  configureDeveloperControls({
    isDeveloperModeActive: () => developerModeActive,
    isDeveloperInfiniteTheroEnabled,
    setDeveloperInfiniteTheroEnabled,
    recordPowderEvent,
    getPowderSimulation: () => powderSimulation,
    getFluidSimulation: () => fluidSimulationInstance,
    getLamedSimulation: () => lamedSimulationInstance,
    getTsadiSimulation: () => tsadiSimulationInstance,
    powderState,
    handlePowderIdleBankChange,
    schedulePowderBasinSave,
    updatePowderDisplay,
    setBaseStartThero,
    updateLevelCards,
    updatePowderLedger,
    updateStatusDisplays,
    setDeveloperTheroMultiplierOverride,
    clearDeveloperTheroMultiplierOverride,
    getDeveloperTheroMultiplierOverride,
    getBaseStartingTheroMultiplier,
    getBaseStartThero,
    getGlyphCurrency,
    setGlyphCurrency,
    setBetGlyphCurrency,
    getBetGlyphCurrency,
    spireResourceState,
    setTrackedLamedGlyphs,
    setTrackedTsadiGlyphs,
    setTrackedShinGlyphs,
    setTrackedKufGlyphs,
    updateSpireTabVisibility,
    checkAndUnlockSpires,
    getShinGlyphs,
    setShinGlyphs,
    getKufGlyphs,
    setKufGlyphs,
    gameStats,
    addIterons,
    getIteronBank,
    setIterationRate,
    updateShinDisplay,
    updateDeveloperMapElementsVisibility,
    getCurrentIdleMoteBank,
    getCurrentMoteDispenseRate,
  });

  configureEnemyHandlers({ queueMoteDrop, recordPowderEvent });

  // Wire the standalone offline persistence helpers to the shared gameplay state and utilities.
  configureOfflinePersistence({
    formatWholeNumber,
    formatGameNumber,
    formatDecimal,
    formatSignedPercentage,
    readStorageJson,
    writeStorageJson,
    applyPowderGain,
    notifyIdleTime,
    getCurrentFluxRate: () => resourceState.fluxRate,
    onBeforePersist: savePowderCurrency,
    getCurrentPowderBonuses,
    powderState,
    powderConfig,
    powderElements,
    updateMoteGemInventoryDisplay,
    setActiveTab,
  });

  const {
    applyPowderViewportTransform,
    handlePowderViewTransformChange,
    handlePowderWallMetricsChange,
    updatePowderWallGapFromGlyphs,
    initializePowderViewInteraction,
  } = createPowderViewportController({
    getActiveSimulation: () => powderSimulation,
    getFluidSimulation: () => fluidSimulationInstance,
    getPowderElements: () => powderElements,
    getFluidElements: () => fluidElements,
    powderState,
    powderConfig,
    schedulePowderBasinSave,
    isDeveloperModeActive: () => developerModeActive,
  });

  function resetFluidCameraTransform() {
    if (!fluidSimulationInstance || typeof fluidSimulationInstance.getViewTransform !== 'function') {
      return;
    }
    if (typeof fluidSimulationInstance.setViewScale === 'function') {
      fluidSimulationInstance.setViewScale(1);
    } else if (typeof fluidSimulationInstance.applyZoomFactor === 'function') {
      const currentScale = fluidSimulationInstance.getViewTransform()?.scale || 1;
      if (Math.abs(currentScale - 1) > 0.0001) {
        fluidSimulationInstance.applyZoomFactor(1 / currentScale);
      }
    }
    if (typeof fluidSimulationInstance.setViewCenterNormalized === 'function') {
      fluidSimulationInstance.setViewCenterNormalized({ x: 0.5, y: 0.5 });
    }
    handlePowderViewTransformChange(fluidSimulationInstance.getViewTransform());
  }

  function syncFluidCameraModeUi() {
    const enabled = Boolean(powderState.betTerrarium?.cameraMode);
    if (fluidElements.viewport) {
      fluidElements.viewport.classList.toggle('fluid-viewport--camera-locked', !enabled);
    }
    if (fluidElements.cameraModeToggle) {
      fluidElements.cameraModeToggle.classList.toggle('is-active', enabled);
      fluidElements.cameraModeToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    }
    if (fluidElements.cameraModeStateLabel) {
      fluidElements.cameraModeStateLabel.textContent = enabled ? 'On' : 'Off';
    }
    if (fluidElements.cameraModeHint) {
      fluidElements.cameraModeHint.textContent = enabled
        ? 'Camera mode hides the in-render buttons so you can pan and zoom.'
        : 'Camera mode is off. Buttons stay visible and the viewport stays locked.';
    }
  }

  function setFluidCameraMode(enabled, options = {}) {
    const nextState = Boolean(enabled);
    const skipTransformReset = Boolean(options.skipTransformReset);
    const skipSave = Boolean(options.skipSave);
    if (!powderState.betTerrarium) {
      powderState.betTerrarium = {};
    }
    powderState.betTerrarium.cameraMode = nextState;

    if (fluidTerrariumTrees?.setCameraMode) {
      fluidTerrariumTrees.setCameraMode(nextState, { notifyHost: false });
    }

    syncFluidCameraModeUi();

    if (!nextState && !skipTransformReset) {
      resetFluidCameraTransform();
    }

    if (!skipSave) {
      schedulePowderBasinSave();
    }
  }

  function bindFluidCameraModeToggle() {
    if (!fluidElements.cameraModeToggle) {
      return;
    }
    fluidElements.cameraModeToggle.addEventListener('click', () => {
      setFluidCameraMode(!powderState.betTerrarium?.cameraMode);
    });
  }

  const {
    idleLevelRuns,
    beginIdleLevelRun,
    stopIdleLevelRun,
    stopAllIdleRuns,
    updateIdleLevelDisplay,
  } = createIdleLevelRunManager({
    idleLevelConfigs,
    levelState,
    levelLookup,
    isInteractiveLevel,
    updateLevelCards,
    handlePlayfieldVictory,
    getActiveLevelId: () => activeLevelId,
    getPlayfieldElements: () => playfieldElements,
  });

  // Convenience helper so developer toggles can refresh the powder walls without duplicating logic.
  const refreshPowderWallDecorations = () => {
    handlePowderWallMetricsChange(
      powderSimulation ? powderSimulation.getWallMetrics() : null,
      powderSimulation === fluidSimulationInstance ? 'fluid' : 'sand',
    );
  };

  const { initializeManualDropHandlers } = createManualDropController({
    getActiveTabId,
    getSandSimulation: () => sandSimulation,
    getFluidSimulation: () => fluidSimulationInstance,
    getLamedSimulation: () => lamedSimulationInstance,
    getTsadiSimulation: () => tsadiSimulationInstance,
    addIterons,
  });

  const {
    ensurePowderBasinResizeObserver,
    getPowderBasinObserver,
    setPowderBasinObserver,
    getPendingPowderResizeFrame,
    setPendingPowderResizeFrame,
    getPendingPowderResizeIsTimeout,
    setPendingPowderResizeIsTimeout,
    getObservedPowderResizeElements,
    setObservedPowderResizeElements,
  } = createPowderResizeObserver({
    getPowderSimulation: () => powderSimulation,
    handlePowderViewTransformChange,
    getPowderElements,
    getFluidElements: () => fluidElements,
  });

  const { bindDeveloperModeToggle, refreshDeveloperModeState } = createDeveloperModeManager({
    getDeveloperModeActive: () => developerModeActive,
    setDeveloperModeActive: (value) => {
      developerModeActive = value;
    },
    getTowerDefinitions,
    getTowerLoadoutState,
    getTowerLoadoutLimit,
    unlockTower,
    initializeDiscoveredVariablesFromUnlocks,
    pruneLockedTowersFromLoadout,
    getTowerUnlockState,
    setMergingLogicUnlocked,
    powderState,
    spireResourceState,
    setKufTotalShards,
    resetKufState,
    setTrackedKufGlyphs,
    setDeveloperIteronBank,
    setDeveloperIterationRate,
    setDeveloperInfiniteTheroEnabled,
    getPowderSimulation: () => powderSimulation,
    setPowderSimulation: (value) => {
      powderSimulation = value;
    },
    getSandSimulation: () => sandSimulation,
    setSandSimulation: (value) => {
      sandSimulation = value;
    },
    getFluidSimulation: () => fluidSimulationInstance,
    setFluidSimulation: (value) => {
      fluidSimulationInstance = value;
    },
    getLamedSimulation: () => lamedSimulationInstance,
    getTsadiSimulation: () => tsadiSimulationInstance,
    updateSpireTabVisibility,
    spireMenuController,
    unlockedLevels,
    interactiveLevelOrder,
    levelState,
    levelBlueprints,
    setDeveloperModeUnlockOverride,
    getEnemyCodexEntries,
    codexState,
    renderEnemyCodex,
    updateLevelCards,
    updateActiveLevelBanner,
    updateTowerCardVisibility,
    updateTowerSelectionButtons,
    syncLoadoutToPlayfield,
    updateStatusDisplays,
    evaluateAchievements,
    refreshAchievementPowderRate,
    updateResourceRates,
    updatePowderLedger,
    updateDeveloperControlsVisibility,
    syncDeveloperControlValues,
    syncLevelEditorVisibility,
    updateDeveloperMapElementsVisibility,
    getPlayfield: () => playfield,
    getPlayfieldMenuController: () => playfieldMenuController,
    unlockAllFractals,
    refreshFractalTabs,
    addIterons,
    resetShinState,
    setShinGlyphs,
    setTrackedShinGlyphs,
    updateShinDisplay,
    refreshPowderWallDecorations,
    clearDeveloperTheroMultiplierOverride,
    stopLamedDeveloperSpamLoop,
    deactivateDeveloperMapTools,
    setDeveloperMapPlacementMode,
    persistentStorageKeys: PERSISTENT_STORAGE_KEYS,
    stopAutoSaveLoop,
    pruneLevelState,
    resetPowderUiState,
    resetActiveMoteGems,
    updateMoteGemInventoryDisplay,
    refreshPowderSystems,
    updatePowderModeButton,
    updatePowderLogDisplay,
    setPowderCurrency,
    idleLevelRuns,
    gameStats,
    resourceState,
    baseResources,
    powderConfig,
    applyMindGatePaletteToDom,
    mergeMotePalette,
    defaultMotePalette: DEFAULT_MOTE_PALETTE,
    updateFluidTabAvailability,
    resetAlephChainUpgrades,
    reconcileGlyphCurrencyFromState,
    updatePowderWallGapFromGlyphs,
    moteGemState,
    clearTowerUpgradeState,
    setPowderBasinObserver,
    getPowderBasinObserver,
    setPendingPowderResizeFrame,
    getPendingPowderResizeFrame,
    setPendingPowderResizeIsTimeout,
    getPendingPowderResizeIsTimeout,
    setObservedPowderResizeElements,
    getObservedPowderResizeElements,
    updateTabLockStates,
    isTutorialCompleted,
  });


  function updateLamedStatistics() {
    lamedSpireUi.updateStatistics(lamedSimulationInstance);
  }

  // Normalize the aleph glyph tithe before using it for unlock checks or logs.
  function getFluidUnlockGlyphCost() {
    const rawCost = Number.isFinite(powderConfig.fluidUnlockGlyphCost)
      ? powderConfig.fluidUnlockGlyphCost
      : 0;
    return Math.max(0, Math.floor(rawCost));
  }

  function updatePowderModeButton() {
    // Mode toggle button removed - spires unlock automatically based on glyphs
    // Keeping this function as a no-op to avoid breaking existing call sites
    return;
  }

  function stopLamedDeveloperSpamLoop() {
    lamedDeveloperSpamActive = false;
    if (lamedDeveloperSpamHandle) {
      cancelAnimationFrame(lamedDeveloperSpamHandle);
      lamedDeveloperSpamHandle = null;
    }
  }

  function runLamedDeveloperSpawnLoop() {
    if (!lamedDeveloperSpamActive) {
      stopLamedDeveloperSpamLoop();
      return;
    }
    if (!developerModeActive || !lamedSimulationInstance || typeof lamedSimulationInstance.spawnStar !== 'function') {
      stopLamedDeveloperSpamLoop();
      return;
    }

    for (let i = 0; i < 4; i++) {
      if (!lamedSimulationInstance.spawnStar()) {
        break;
      }
    }

    lamedDeveloperSpamHandle = window.requestAnimationFrame(() => runLamedDeveloperSpawnLoop());
  }

  function handleLamedDeveloperSpamPointerDown(event) {
    if (!developerModeActive || !lamedSimulationInstance || typeof lamedSimulationInstance.spawnStar !== 'function') {
      return;
    }

    lamedDeveloperSpamActive = true;
    if (typeof event?.preventDefault === 'function') {
      event.preventDefault();
    }
    if (typeof event?.target?.setPointerCapture === 'function' && typeof event.pointerId === 'number') {
      try {
        event.target.setPointerCapture(event.pointerId);
      } catch (error) {
        // Ignore pointer capture failures because the gesture can still continue without capture.
      }
    }
    if (!lamedDeveloperSpamHandle) {
      runLamedDeveloperSpawnLoop();
    }
  }

  function handleLamedDeveloperSpamPointerUp(event) {
    if (typeof event?.target?.releasePointerCapture === 'function' && typeof event.pointerId === 'number') {
      try {
        event.target.releasePointerCapture(event.pointerId);
      } catch (error) {
        // Ignore pointer capture failures because cleanup will continue regardless.
      }
    }
    stopLamedDeveloperSpamLoop();
  }

  function attachLamedDeveloperSpamTarget(canvas) {
    if (!canvas || lamedDeveloperSpamAttached) {
      return;
    }
    lamedDeveloperSpamAttached = true;
    canvas.addEventListener('pointerdown', handleLamedDeveloperSpamPointerDown);
    canvas.addEventListener('pointerup', handleLamedDeveloperSpamPointerUp);
    canvas.addEventListener('pointerleave', handleLamedDeveloperSpamPointerUp);
    canvas.addEventListener('pointercancel', handleLamedDeveloperSpamPointerUp);
  }

  function stopTsadiDeveloperSpamLoop() {
    tsadiDeveloperSpamActive = false;
    if (tsadiDeveloperSpamHandle) {
      cancelAnimationFrame(tsadiDeveloperSpamHandle);
      tsadiDeveloperSpamHandle = null;
    }
  }

  function runTsadiDeveloperSpawnLoop() {
    if (!tsadiDeveloperSpamActive) {
      stopTsadiDeveloperSpamLoop();
      return;
    }
    if (!developerModeActive || !tsadiSimulationInstance || typeof tsadiSimulationInstance.spawnParticle !== 'function') {
      stopTsadiDeveloperSpamLoop();
      return;
    }

    for (let i = 0; i < 4; i++) {
      if (!tsadiSimulationInstance.spawnParticle()) {
        break;
      }
    }

    tsadiDeveloperSpamHandle = window.requestAnimationFrame(() => runTsadiDeveloperSpawnLoop());
  }

  function handleTsadiDeveloperSpamPointerDown(event) {
    if (!developerModeActive || !tsadiSimulationInstance || typeof tsadiSimulationInstance.spawnParticle !== 'function') {
      return;
    }

    tsadiDeveloperSpamActive = true;
    if (typeof event?.preventDefault === 'function') {
      event.preventDefault();
    }
    if (typeof event?.target?.setPointerCapture === 'function' && typeof event.pointerId === 'number') {
      try {
        event.target.setPointerCapture(event.pointerId);
      } catch (error) {
        // Ignore pointer capture failures because the gesture can still continue without capture.
      }
    }
    if (!tsadiDeveloperSpamHandle) {
      runTsadiDeveloperSpawnLoop();
    }
  }

  function handleTsadiDeveloperSpamPointerUp(event) {
    if (typeof event?.target?.releasePointerCapture === 'function' && typeof event.pointerId === 'number') {
      try {
        event.target.releasePointerCapture(event.pointerId);
      } catch (error) {
        // Ignore pointer capture failures because cleanup will continue regardless.
      }
    }
    stopTsadiDeveloperSpamLoop();
  }

  function attachTsadiDeveloperSpamTarget(canvas) {
    if (!canvas || tsadiDeveloperSpamAttached) {
      return;
    }
    tsadiDeveloperSpamAttached = true;
    canvas.addEventListener('pointerdown', handleTsadiDeveloperSpamPointerDown);
    canvas.addEventListener('pointerup', handleTsadiDeveloperSpamPointerUp);
    canvas.addEventListener('pointerleave', handleTsadiDeveloperSpamPointerUp);
    canvas.addEventListener('pointercancel', handleTsadiDeveloperSpamPointerUp);
  }

  async function applyPowderSimulationMode(mode) {
    if (mode !== 'sand' && mode !== 'fluid') {
      return;
    }
    if (powderState.modeSwitchPending) {
      return;
    }
    if (!FLUID_STUDY_ENABLED && mode === 'fluid') {
      // Keep the retired fluid simulation dormant even if legacy saves request it.
      powderState.simulationMode = 'sand';
      updatePowderModeButton();
      return;
    }
    if (mode === 'fluid' && !powderState.fluidUnlocked) {
      updatePowderModeButton();
      return;
    }

    powderState.modeSwitchPending = true;
    // Mode toggle button removed
    // if (powderElements.modeToggle) {
    //   powderElements.modeToggle.disabled = true;
    // }

    const previousMode = powderState.simulationMode;
    try {
      if (mode === 'fluid') {
        const profile = await loadFluidSimulationProfile();
        if (!profile) {
          throw new Error('Fluid simulation profile unavailable.');
        }
        powderState.fluidProfileLabel = profile.label || powderState.fluidProfileLabel;

        if (!fluidSimulationInstance && fluidElements.canvas) {
          const { left: leftInset, right: rightInset } = getSimulationWallInsets('fluid');
          fluidSimulationInstance = new FluidSimulation({
            canvas: fluidElements.canvas,
            cellSize: POWDER_CELL_SIZE_PX,
            scrollThreshold: 0.5,
            wallInsetLeft: leftInset,
            wallInsetRight: rightInset,
            wallGapCells: powderConfig.wallBaseGapMotes,
            gapWidthRatio: powderConfig.wallGapViewportRatio,
            idleDrainRate: powderState.fluidIdleDrainRate || powderState.idleDrainRate,
            motePalette: powderState.motePalette,
            dropSizes: profile.dropSizes,
            dropVolumeScale: profile.dropVolumeScale ?? undefined,
            waveStiffness: profile.waveStiffness ?? undefined,
            waveDamping: profile.waveDamping ?? undefined,
            sideFlowRate: profile.sideFlowRate ?? undefined,
            rippleFrequency: profile.rippleFrequency ?? undefined,
            rippleAmplitude: profile.rippleAmplitude ?? undefined,
            maxDuneGain: powderConfig.simulatedDuneGainMax,
            onIdleBankChange: (value) => handlePowderIdleBankChange(value, 'fluid'),
            onHeightChange: (info) => handlePowderHeightChange(info, 'fluid'),
            onWallMetricsChange: (metrics) => handlePowderWallMetricsChange(metrics, 'fluid'),
            onViewTransformChange: handlePowderViewTransformChange,
          });
        }

        if (!fluidSimulationInstance) {
          throw new Error('Fluid simulation could not be created.');
        }

        if (powderSimulation && powderSimulation !== fluidSimulationInstance) {
          captureSimulationState(powderSimulation);
          powderSimulation.stop();
        }

        powderSimulation = fluidSimulationInstance;
        powderSimulation.applyProfile(profile);
        if (Number.isFinite(profile.flowOffset) && typeof powderSimulation.setFlowOffset === 'function') {
          powderSimulation.setFlowOffset(profile.flowOffset);
        } else if (typeof powderSimulation.setFlowOffset === 'function') {
          powderSimulation.setFlowOffset(powderState.sandOffset);
        }
        powderState.motePalette = powderSimulation.getEffectiveMotePalette();
        // Update the Mind Gate UI badge so fluid-mode palettes propagate outside the canvas.
        applyMindGatePaletteToDom(powderState.motePalette);
        powderState.fluidIdleDrainRate = powderSimulation.idleDrainRate;
        powderState.simulationMode = 'fluid';
        powderSimulation.setWallGapTarget(powderState.wallGapTarget || powderConfig.wallBaseGapMotes, {
          skipRebuild: true,
        });
        powderSimulation.handleResize();
        applyLoadedPowderSimulationState(powderSimulation);
        flushPendingMoteDrops();
        powderSimulation.start();
        initializePowderViewInteraction();
        handlePowderViewTransformChange(powderSimulation.getViewTransform());
        syncFluidCameraModeUi();
        if (previousMode !== powderState.simulationMode) {
          recordPowderEvent('mode-switch', { mode: 'fluid', label: profile.label || 'Bet Spire' });
        }
      } else {
        if (!sandSimulation && powderSimulation instanceof PowderSimulation) {
          sandSimulation = powderSimulation;
        }
        if (!sandSimulation && powderElements.simulationCanvas) {
          const { left: leftInset, right: rightInset } = getSimulationWallInsets('sand');
          sandSimulation = new PowderSimulation({
            canvas: powderElements.simulationCanvas,
            cellSize: POWDER_CELL_SIZE_PX,
            grainSizes: [1], // Keep the sandfall motes uniform while preserving external drop sizing.
            scrollThreshold: 0.75,
            wallInsetLeft: leftInset,
            wallInsetRight: rightInset,
            wallGapCells: powderConfig.wallBaseGapMotes,
            gapWidthRatio: powderConfig.wallGapViewportRatio,
            maxDuneGain: powderConfig.simulatedDuneGainMax,
            idleDrainRate: powderState.idleDrainRate,
            motePalette: powderState.motePalette,
            onIdleBankChange: (value) => handlePowderIdleBankChange(value, 'sand'),
            onHeightChange: (info) => handlePowderHeightChange(info, 'sand'),
            onWallMetricsChange: (metrics) => handlePowderWallMetricsChange(metrics, 'sand'),
            onViewTransformChange: handlePowderViewTransformChange,
          });
        }

        if (powderSimulation && powderSimulation !== sandSimulation) {
          captureSimulationState(powderSimulation);
          powderSimulation.stop();
        }

        if (!sandSimulation) {
          throw new Error('Powder simulation unavailable.');
        }

        powderSimulation = sandSimulation;
        const baseProfile = powderSimulation.getDefaultProfile();
        powderSimulation.applyProfile(baseProfile || undefined);
        powderSimulation.setFlowOffset(powderState.sandOffset);
        powderState.motePalette = powderSimulation.getEffectiveMotePalette();
        // Sync the emblem glow when returning to the sand simulation baseline palette.
        applyMindGatePaletteToDom(powderState.motePalette);
        powderState.idleDrainRate = powderSimulation.idleDrainRate;
        powderState.simulationMode = 'sand';
        powderSimulation.setWallGapTarget(powderState.wallGapTarget || powderConfig.wallBaseGapMotes, {
          skipRebuild: true,
        });
        powderSimulation.handleResize();
        applyLoadedPowderSimulationState(powderSimulation);
        flushPendingMoteDrops();
        powderSimulation.start();
        initializePowderViewInteraction();
        handlePowderViewTransformChange(powderSimulation.getViewTransform());
        syncFluidCameraModeUi();
        if (previousMode !== powderState.simulationMode) {
          recordPowderEvent('mode-switch', { mode: 'sand', label: 'Powderfall Study' });
        }
      }

      refreshPowderWallDecorations();
      handlePowderHeightChange(powderSimulation ? powderSimulation.getStatus() : undefined);
      updatePowderWallGapFromGlyphs(powderState.wallGlyphsLit || 0);
      updateMoteStatsDisplays();
      const fluidStatus =
        fluidSimulationInstance && typeof fluidSimulationInstance.getStatus === 'function'
          ? fluidSimulationInstance.getStatus()
          : null;
      updateFluidDisplay(fluidStatus);
    } catch (error) {
      console.error('Unable to switch simulation mode.', error);
    } finally {
      powderState.modeSwitchPending = false;
      // Mode toggle button removed
      // if (powderElements.modeToggle) {
      //   powderElements.modeToggle.disabled = false;
      // }
      updatePowderModeButton();
      ensurePowderBasinResizeObserver();
      refreshPowderWallDecorations();
    }
  }

  function unlockFluidStudy({ reason = 'purchase', threshold = null, glyphCost = null } = {}) {
    if (!FLUID_STUDY_ENABLED) {
      return false;
    }
    if (powderState.fluidUnlocked) {
      return false;
    }
    powderState.fluidUnlocked = true;
    spireResourceState.fluid = {
      ...(spireResourceState.fluid || {}),
      unlocked: true,
    };
    const startingReservoir = FLUID_UNLOCK_BASE_RESERVOIR_DROPS; // Base reservoir grant for the newly unlocked study.
    const currentFluidBank = Number.isFinite(powderState.fluidIdleBank) ? Math.max(0, powderState.fluidIdleBank) : 0;
    if (currentFluidBank < startingReservoir) {
      handlePowderIdleBankChange(startingReservoir, 'fluid'); // Surface the seeded reservoir through the shared idle handler.
      if (fluidSimulationInstance) {
        const simulationBank = Number.isFinite(fluidSimulationInstance.idleBank) ? Math.max(0, fluidSimulationInstance.idleBank) : 0;
        if (simulationBank < startingReservoir) {
          fluidSimulationInstance.idleBank = startingReservoir;
          fluidSimulationInstance.notifyIdleBankChange(); // Sync the live simulation with the seeded reservoir total.
        }
      }
    }
    updateFluidTabAvailability();
    updatePowderModeButton();
    const normalizedCost = Number.isFinite(glyphCost) ? Math.max(0, Math.floor(glyphCost)) : getFluidUnlockGlyphCost();
    const normalizedThreshold = Number.isFinite(threshold) ? Math.max(0, threshold) : undefined;
    const context = {
      reason,
      glyphCost: normalizedCost,
    };
    if (typeof normalizedThreshold !== 'undefined') {
      context.threshold = normalizedThreshold;
    }
    recordPowderEvent('fluid-unlocked', context);
    schedulePowderSave();
    return true;
  }

  function attemptFluidUnlock() {
    if (!FLUID_STUDY_ENABLED) {
      return false;
    }
    const glyphCost = getFluidUnlockGlyphCost();
    const availableGlyphs = Math.max(0, Math.floor(getGlyphCurrency()));
    if (availableGlyphs < glyphCost) {
      updatePowderModeButton();
      return false;
    }
    if (glyphCost > 0) {
      addGlyphCurrency(-glyphCost);
    }
    const unlocked = unlockFluidStudy({ reason: 'purchase', glyphCost });
    updateStatusDisplays();
    return unlocked;
  }

  function enterFluidStudy() {
    if (!FLUID_STUDY_ENABLED) {
      return;
    }
    if (powderState.modeSwitchPending) {
      return;
    }
    if (!powderState.fluidUnlocked) {
      updatePowderModeButton();
      return;
    }
    if (getActiveTabId() === 'fluid') {
      return;
    }
    updateFluidTabAvailability();
    setActiveTab('fluid');
  }

  function exitFluidStudy() {
    if (powderState.modeSwitchPending) {
      return;
    }
    if (getActiveTabId() === 'powder') {
      return;
    }
    setActiveTab('powder');
  }

  function handlePowderModeToggle() {
    if (!FLUID_STUDY_ENABLED) {
      setActiveTab('powder');
      updatePowderModeButton();
      return;
    }
    if (!powderState.fluidUnlocked) {
      const unlocked = attemptFluidUnlock();
      if (unlocked) {
        enterFluidStudy();
      }
      return;
    }
    if (getActiveTabId() === 'fluid') {
      exitFluidStudy();
    } else {
      enterFluidStudy();
    }
  }

  /**
   * Check and automatically unlock spires based on glyph counts from previous spire.
   * Each spire unlocks when the player has 10 glyphs from the previous spire.
   * @returns {boolean} True if any spire was unlocked
   */
  function checkAndUnlockSpires() {
    let anyUnlocked = false;

    // Get glyph counts for each spire
    const alephGlyphs = Math.max(0, Math.floor(powderState.glyphsAwarded || 0));
    const betGlyphs = Math.max(0, Math.floor(powderState.fluidGlyphsAwarded || 0));
    
    // Bet Spire: Unlocks when player has 10 Aleph glyphs
    if (FLUID_STUDY_ENABLED && !powderState.fluidUnlocked && alephGlyphs >= 10) {
      unlockFluidStudy({ reason: 'auto-unlock', threshold: 10, glyphCost: 0 });
      updateSpireTabVisibility();
      spireMenuController.updateCounts();
      anyUnlocked = true;
    }

    // Lamed Spire: Unlocks when player has 10 Bet glyphs
    if (!spireResourceState.lamed.unlocked && betGlyphs >= 10) {
      ensureLamedBankSeeded();
      updateSpireTabVisibility();
      spireMenuController.updateCounts();
      anyUnlocked = true;
    }

    // Tsadi Spire: Unlocks when player has 10 Lamed glyphs (sparks)
    // Use the tracked Lamed glyph counter to gate Tsadi so early spark absorptions do not prematurely unlock it.
    const lamedUnlocked = Boolean(spireResourceState.lamed?.unlocked);
    const lamedGlyphs = lamedUnlocked ? Math.max(0, Math.floor(getTrackedLamedGlyphs?.() || 0)) : 0;
    if (!spireResourceState.tsadi.unlocked && lamedUnlocked && lamedGlyphs >= 10) {
      ensureTsadiBankSeeded();
      updateSpireTabVisibility();
      spireMenuController.updateCounts();
      anyUnlocked = true;
    }

    // Shin Spire: Unlocks when player has 10 Tsadi glyphs
    const tsadiGlyphs = Math.max(
      0,
      Math.floor(
        Number.isFinite(spireResourceState.tsadi?.stats?.totalGlyphs)
          ? spireResourceState.tsadi.stats.totalGlyphs
          : spireResourceState.tsadi?.stats?.totalParticles || 0,
      ),
    );
    if (!spireResourceState.shin?.unlocked && tsadiGlyphs >= 10) {
      if (!spireResourceState.shin) {
        spireResourceState.shin = { unlocked: false };
      }
      spireResourceState.shin.unlocked = true;
      updateSpireTabVisibility();
      spireMenuController.updateCounts();
      anyUnlocked = true;
    }

    // Kuf Spire: Unlocks when player has 10 Shin glyphs
    const shinGlyphs = Math.max(0, Math.floor(getShinGlyphs()));
    if (!spireResourceState.kuf?.unlocked && shinGlyphs >= 10) {
      if (!spireResourceState.kuf) {
        spireResourceState.kuf = { unlocked: false };
      }
      spireResourceState.kuf.unlocked = true;
      updateSpireTabVisibility();
      spireMenuController.updateCounts();
      anyUnlocked = true;
    }

    return anyUnlocked;
  }

  let resourceTicker = null;
  let lastResourceTick = 0;

  const POWDER_WALL_TEXTURE_ASPECT = 800 / 300; // Preserve the native 1.5:4 wall sprite ratio (300px × 800px).
  const POWDER_WALL_TEXTURE_FALLBACK_PX = 192; // Fallback repeat distance when wall sizing has not been measured yet.

  /**
   * Resolve the repeating wall texture height so the masonry tiles retain their native aspect ratio.
   *
   * @param {HTMLElement|null} wallElement - Wall element whose visual width drives the texture repeat distance.
   * @returns {number} Pixel height used to repeat the wall texture.
   */
  function resolveWallTextureRepeatPx(wallElement) {
    // Honor any inline tile height overrides first so CSS calculations stay in sync with JS scroll offsets.
    const inlineTileHeight = wallElement?.style?.getPropertyValue?.('--powder-wall-tile-height');
    const parsedTileHeight = inlineTileHeight ? Number.parseFloat(inlineTileHeight) : NaN;
    if (Number.isFinite(parsedTileHeight) && parsedTileHeight > 0) {
      return parsedTileHeight;
    }

    // Prefer an explicitly measured wall width when available to maintain the sprite's 1.5:4 ratio.
    const inlineWidth = wallElement?.style?.getPropertyValue?.('--powder-wall-visual-width');
    const parsedWidth = inlineWidth ? Number.parseFloat(inlineWidth) : NaN;
    if (Number.isFinite(parsedWidth) && parsedWidth > 0) {
      return parsedWidth * POWDER_WALL_TEXTURE_ASPECT;
    }

    if (wallElement && typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      const computedStyles = window.getComputedStyle(wallElement);
      if (computedStyles) {
        const computedTileHeight = Number.parseFloat(computedStyles.getPropertyValue('--powder-wall-tile-height'));
        if (Number.isFinite(computedTileHeight) && computedTileHeight > 0) {
          return computedTileHeight;
        }

        const computedWidth = Number.parseFloat(computedStyles.getPropertyValue('--powder-wall-visual-width'));
        if (Number.isFinite(computedWidth) && computedWidth > 0) {
          return computedWidth * POWDER_WALL_TEXTURE_ASPECT;
        }
      }
    }

    return POWDER_WALL_TEXTURE_FALLBACK_PX;
  }

  // Wrapper functions to include alephChainUpgrades in tower upgrade persistence.
  function getTowerUpgradeStateSnapshotWithAleph() {
    const towerSnapshot = getTowerUpgradeStateSnapshot();
    return {
      ...towerSnapshot,
      alephChainUpgrades: getAlephChainUpgrades(),
    };
  }

  function applyTowerUpgradeStateSnapshotWithAleph(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }
    // Restore tower variable upgrades
    applyTowerUpgradeStateSnapshot(snapshot);
    // Restore alephChainUpgrades if present
    if (snapshot.alephChainUpgrades && typeof snapshot.alephChainUpgrades === 'object') {
      applyAlephChainUpgradeSnapshot(snapshot.alephChainUpgrades, { playfield });
    }
  }

  /**
   * Clamp a numeric value to a finite non-negative value for persistence payloads.
   * @param {number} value - Raw numeric input from save data.
   * @param {number} fallback - Optional fallback when the input is invalid.
   * @returns {number} Sanitized value.
   */
  function clampPersistedValue(value, fallback = 0) {
    const normalized = Number.isFinite(value) ? value : fallback;
    return Math.max(0, normalized);
  }

  /**
   * Normalize discovered molecule entries so older save payloads that only stored ids still render.
   * @param {Array} molecules - Persisted molecule list.
   * @returns {Array} Sanitized molecule descriptors.
   */
  function normalizePersistedMolecules(molecules) {
    if (!Array.isArray(molecules)) {
      return [];
    }
    return molecules
      .map((entry) => {
        if (!entry) {
          return null;
        }
        if (typeof entry === 'string') {
          return {
            id: entry,
            name: entry,
            tiers: [],
            description: 'Recorded in the Alchemy Codex.',
          };
        }
        if (typeof entry === 'object') {
          const id = entry.id || entry.name || 'molecule';
          const name = typeof entry.name === 'string' ? entry.name : id;
          const tiers = Array.isArray(entry.tiers) ? entry.tiers.filter((tier) => Number.isFinite(tier)) : [];
          const description =
            typeof entry.description === 'string' ? entry.description : 'Recorded in the Alchemy Codex.';
          const particleCount = Number.isFinite(entry.particleCount)
            ? Math.max(0, entry.particleCount)
            : new Set(tiers).size;
          return { ...entry, id, name, tiers, description, particleCount };
        }
        return null;
      })
      .filter(Boolean);
  }

  /**
   * Apply unique randomized names to normalized molecule entries.
   * @param {Array} molecules - Raw persisted molecule descriptors.
   * @returns {Array} Molecule descriptors with guaranteed-unique names.
   */
  function normalizeDiscoveredMolecules(molecules) {
    const normalized = normalizePersistedMolecules(molecules);
    return tsadiMoleculeNameGenerator.normalizeRecipes(normalized);
  }

  /**
   * Compose a persistence-safe snapshot of the advanced spire resource state.
   * @returns {Object} Sanitized spire resource data for autosave.
   */
  function getSpireResourceStateSnapshot() {
    const powderStoryState = spireResourceState.powder || {};
    const fluidStoryState = spireResourceState.fluid || {};
    const lamedState = spireResourceState.lamed || {};
    const tsadiState = spireResourceState.tsadi || {};
    const shinState = spireResourceState.shin || {};
    const kufState = spireResourceState.kuf || {};

    return {
      powder: {
        unlocked: true,
        storySeen: Boolean(powderStoryState.storySeen),
      },
      fluid: {
        unlocked: Boolean(fluidStoryState.unlocked || powderState.fluidUnlocked),
        storySeen: Boolean(fluidStoryState.storySeen),
      },
      lamed: {
        unlocked: Boolean(lamedState.unlocked),
        sparkBank: getLamedSparkBank(),
        dragLevel: clampPersistedValue(lamedState.dragLevel, 0),
        starMass: Number.isFinite(lamedState.starMass) ? lamedState.starMass : 10,
        storySeen: Boolean(lamedState.storySeen),
        upgrades: {
          starMass: clampPersistedValue(lamedState.upgrades?.starMass, 0),
        },
        stats: {
          totalAbsorptions: clampPersistedValue(lamedState.stats?.totalAbsorptions, 0),
          totalMassGained: clampPersistedValue(lamedState.stats?.totalMassGained, 0),
        },
      },
      tsadi: {
        unlocked: Boolean(tsadiState.unlocked),
        storySeen: Boolean(tsadiState.storySeen),
        particleBank: getTsadiParticleBank(),
        bindingAgents: getTsadiBindingAgents(),
        discoveredMolecules: normalizeDiscoveredMolecules(tsadiState.discoveredMolecules),
        stats: {
          totalParticles: clampPersistedValue(tsadiState.stats?.totalParticles, 0),
          totalGlyphs: clampPersistedValue(tsadiState.stats?.totalGlyphs, 0),
          highestTier: clampPersistedValue(tsadiState.stats?.highestTier, 0),
        },
      },
      shin: {
        unlocked: Boolean(shinState.unlocked),
        storySeen: Boolean(shinState.storySeen),
      },
      kuf: {
        unlocked: Boolean(kufState.unlocked),
        storySeen: Boolean(kufState.storySeen),
      },
    };
  }

  /**
   * Hydrate the advanced spire resource state from persisted data while preserving existing references.
   * @param {Object} snapshot - Persisted spire state payload.
   */
  function applySpireResourceStateSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }

    const powderBranch = snapshot.powder || {};
    const fluidBranch = snapshot.fluid || {};
    const lamedBranch = snapshot.lamed || {};
    const tsadiBranch = snapshot.tsadi || {};
    const shinBranch = snapshot.shin || {};
    const kufBranch = snapshot.kuf || {};

    const powderStoryState = spireResourceState.powder || {};
    powderStoryState.storySeen = Boolean(powderBranch.storySeen || powderStoryState.storySeen);
    spireResourceState.powder = powderStoryState;

    const fluidStoryState = spireResourceState.fluid || {};
    fluidStoryState.unlocked = Boolean(fluidBranch.unlocked || fluidStoryState.unlocked);
    fluidStoryState.storySeen = Boolean(fluidBranch.storySeen || fluidStoryState.storySeen);
    spireResourceState.fluid = fluidStoryState;
    powderState.fluidUnlocked = Boolean(fluidStoryState.unlocked || powderState.fluidUnlocked);

    const lamedState = spireResourceState.lamed || {};
    lamedState.unlocked = Boolean(lamedBranch.unlocked || lamedState.unlocked);
    setLamedSparkBank(clampPersistedValue(lamedBranch.sparkBank, getLamedSparkBank()));
    lamedState.dragLevel = clampPersistedValue(lamedBranch.dragLevel, lamedState.dragLevel || 0);
    lamedState.starMass = Number.isFinite(lamedBranch.starMass) ? lamedBranch.starMass : lamedState.starMass || 10;
    lamedState.storySeen = Boolean(lamedBranch.storySeen || lamedState.storySeen);
    lamedState.upgrades = {
      ...(lamedState.upgrades || {}),
      starMass: clampPersistedValue(lamedBranch.upgrades?.starMass, lamedState.upgrades?.starMass || 0),
    };
    lamedState.stats = {
      ...(lamedState.stats || {}),
      totalAbsorptions: clampPersistedValue(
        lamedBranch.stats?.totalAbsorptions,
        lamedState.stats?.totalAbsorptions || 0,
      ),
      totalMassGained: clampPersistedValue(lamedBranch.stats?.totalMassGained, lamedState.stats?.totalMassGained || 0),
    };

    const tsadiState = spireResourceState.tsadi || {};
    tsadiState.unlocked = Boolean(tsadiBranch.unlocked || tsadiState.unlocked);
    tsadiState.storySeen = Boolean(tsadiBranch.storySeen || tsadiState.storySeen);
    setTsadiParticleBank(clampPersistedValue(tsadiBranch.particleBank, getTsadiParticleBank()));
    const bindingStock = clampPersistedValue(tsadiBranch.bindingAgents, getTsadiBindingAgents());
    syncTsadiBindingAgents(bindingStock);
    tsadiState.stats = {
      ...(tsadiState.stats || {}),
      totalParticles: clampPersistedValue(tsadiBranch.stats?.totalParticles, tsadiState.stats?.totalParticles || 0),
      totalGlyphs: clampPersistedValue(tsadiBranch.stats?.totalGlyphs, tsadiState.stats?.totalGlyphs || 0),
      highestTier: clampPersistedValue(tsadiBranch.stats?.highestTier, tsadiState.stats?.highestTier || 0),
    };
    tsadiState.discoveredMolecules = normalizeDiscoveredMolecules(
      tsadiBranch.discoveredMolecules || tsadiState.discoveredMolecules,
    );
    updateBindingAgentDisplay();

    const shinState = spireResourceState.shin || {};
    shinState.unlocked = Boolean(shinBranch.unlocked || shinState.unlocked);
    shinState.storySeen = Boolean(shinBranch.storySeen || shinState.storySeen);

    const kufState = spireResourceState.kuf || {};
    kufState.unlocked = Boolean(kufBranch.unlocked || kufState.unlocked);
    kufState.storySeen = Boolean(kufBranch.storySeen || kufState.storySeen);
  }

  // Configure the autosave helpers so they can persist powder, stats, and preference state.
  configureAutoSave({
    audioStorageKey: AUDIO_SETTINGS_STORAGE_KEY,
    getPowderCurrency,
    onPowderCurrencyLoaded: (value) => {
      setPowderCurrency(value);
    },
    getPowderBasinSnapshot,
    applyPowderBasinSnapshot,
    getTowerUpgradeStateSnapshot: getTowerUpgradeStateSnapshotWithAleph,
    applyTowerUpgradeStateSnapshot: applyTowerUpgradeStateSnapshotWithAleph,
    getShinStateSnapshot,
    getKufStateSnapshot,
    getLevelProgressSnapshot,
    applyLevelProgressSnapshot,
    applyStoredAudioSettings,
    syncAudioControlsFromManager,
    applyNotationPreference,
    handleNotationFallback: refreshNotationDisplays,
    applyGlyphEquationPreference,
    applyDamageNumberPreference,
    applyWaveKillTallyPreference,
    applyWaveDamageTallyPreference,
    applyTrackTracerPreference,
    getGameStatsSnapshot: () => gameStats,
    mergeLoadedGameStats: (stored) => {
      if (!stored) {
        return;
      }
      Object.entries(stored).forEach(([key, value]) => {
        if (Object.prototype.hasOwnProperty.call(gameStats, key) && Number.isFinite(value)) {
          gameStats[key] = value;
        }
      });
      // Recompute achievement thresholds after loading persisted statistics.
      evaluateAchievements();
    },
    statKeys: Object.keys(gameStats),
    getPreferenceSnapshot: () => ({
      notation: getGameNumberNotation(),
      graphics: getActiveGraphicsMode(),
      glyphEquations: areGlyphEquationsVisible() ? '1' : '0',
      damageNumbers: areDamageNumbersEnabled() ? '1' : '0',
      waveKillTallies: areWaveKillTalliesEnabled() ? '1' : '0',
      waveDamageTallies: areWaveDamageTalliesEnabled() ? '1' : '0',
      trackTracer: areTrackTracersEnabled() ? '1' : '0',
    }),
    getSpireResourceStateSnapshot,
    applySpireResourceStateSnapshot,
  });

  levelOverlayController = createLevelOverlayController({
    document,
    describeLevelLastResult,
    getLevelSummary,
    getLevelState: (levelId) => levelState.get(levelId) || null,
    getIdleLevelRunner: (levelId) => idleLevelRuns.get(levelId) || null,
    getLevelById: (levelId) => levelLookup.get(levelId) || null,
    getActiveLevelId: () => activeLevelId,
    revealOverlay,
    scheduleOverlayHide,
  });

  const levelStoryScreen = createLevelStoryScreen({
    levelState,
    onStoryComplete: (levelId) => {
      if (!levelId) {
        return;
      }
      const existingState = levelState.get(levelId) || {
        entered: false,
        running: false,
        completed: false,
      };
      if (existingState.storySeen) {
        return;
      }
      levelState.set(levelId, { ...existingState, storySeen: true });
      commitAutoSave();
    },
  });
  // Narrative targets for each spire tab so the shared story overlay can surface their briefings.
  const spireStoryTargets = {
    powder: { id: 'spire-powder', title: 'Aleph Spire' },
    fluid: { id: 'spire-fluid', title: 'Bet Spire' },
    lamed: { id: 'spire-lamed', title: 'Lamed Spire' },
    tsadi: { id: 'spire-tsadi', title: 'Tsadi Spire' },
    shin: { id: 'spire-shin', title: 'Shin Spire' },
    kuf: { id: 'spire-kuf', title: 'Kuf Spire' },
  };

  /**
   * Retrieve or initialize the persistent story branch for a spire so unlock flow and autosave share state.
   * @param {string} spireId - Identifier for the spire tab (powder, fluid, lamed, tsadi, shin, kuf).
   * @returns {Object|null} Reference to the spire story state branch.
   */
  function getSpireStoryBranch(spireId) {
    if (!spireId) {
      return null;
    }
    if (!Object.prototype.hasOwnProperty.call(spireResourceState, spireId)) {
      spireResourceState[spireId] = { storySeen: false };
    }
    const branch = spireResourceState[spireId] || {};
    if (typeof branch.storySeen !== 'boolean') {
      branch.storySeen = false;
    }
    return branch;
  }

  /**
   * Mark a spire briefing as viewed and persist the change to storage.
   * @param {string} spireId - Identifier for the spire tab.
   */
  function markSpireStorySeen(spireId) {
    const branch = getSpireStoryBranch(spireId);
    if (!branch || branch.storySeen) {
      return;
    }
    branch.storySeen = true;
    commitAutoSave();
  }

  /**
   * Trigger the shared story overlay when a spire tab opens for the first time.
   * @param {string} spireId - Identifier for the spire tab being opened.
   */
  function maybeShowSpireStory(spireId) {
    if (!levelStoryScreen) {
      return;
    }
    const storyTarget = spireStoryTargets[spireId];
    const branch = getSpireStoryBranch(spireId);
    if (!storyTarget || !branch || branch.storySeen) {
      return;
    }
    levelStoryScreen.maybeShowStory(storyTarget, {
      shouldShow: () => !branch.storySeen,
      onComplete: () => markSpireStorySeen(spireId),
    });
  }
  // Track the animation frame id that advances idle simulations so we can pause the loop when idle.

  // Extracted Tsadi UI helpers manage upgrade bindings via dependency injection.
  const { bindTsadiUpgradeButtons, updateTsadiUpgradeUI } = createTsadiUpgradeUi({
    getTsadiSimulation: () => tsadiSimulationInstance,
    spireMenuController,
  });

  /**
   * Resize active spire simulations so their canvases track the responsive layout.
   */
  function scheduleSpireResize() {
    if (pendingSpireResizeFrame !== null) {
      return;
    }

    pendingSpireResizeFrame = requestAnimationFrame(() => {
      pendingSpireResizeFrame = null;
      if (lamedSimulationInstance && typeof lamedSimulationInstance.resize === 'function') {
        lamedSimulationInstance.resize();
      }
      if (tsadiSimulationInstance && typeof tsadiSimulationInstance.resize === 'function') {
        tsadiSimulationInstance.resize();
      }
      resizeShinFractalCanvases();
    });
  }

  setGraphicsModeContext({
    getPowderSimulation: () => powderSimulation,
    getPlayfield: () => playfield,
  });

  // Synchronize the shared palette module with powder simulation and playfield rendering.
  configureColorSchemeSystem({
    onPaletteChange: (palette) => {
      powderState.motePalette = palette;
      // Broadcast palette swaps to the Mind Gate badge so theme toggles remain cohesive.
      applyMindGatePaletteToDom(powderState.motePalette);
      if (powderSimulation && typeof powderSimulation.setMotePalette === 'function') {
        powderSimulation.setMotePalette(palette);
        powderSimulation.render();
      }
    },
    onSchemeApplied: () => {
      if (playfield) {
        playfield.draw();
      }
    },
  });

  configurePlayfieldSystem({
    alephChainUpgrades: alephChainUpgradeState,
    theroSymbol: THERO_SYMBOL,
    calculateStartingThero,
    updateStatusDisplays,
    notifyEnemyDefeated,
    notifyAutoAnchorUsed,
    getOmegaPatternForTier,
    isFieldNotesOverlayVisible,
    getBaseStartThero,
    getBaseCoreIntegrity,
    handleDeveloperMapPlacement: handleDeveloperMapPlacementRequest,
    // Share developer toggle so level thero caps can be bypassed during sandboxing.
    isDeveloperModeActive: () => developerModeActive,
    isDeveloperInfiniteTheroEnabled,
    // Provide the playfield with the active graphics mode to prune visual effects.
    isLowGraphicsMode: () => isLowGraphicsModeActive(),
  });

  function captureSimulationState(simulation) {
    if (!simulation) {
      return;
    }
    const isFluid = simulation === fluidSimulationInstance;
    const stateKey = isFluid ? 'loadedFluidState' : 'loadedSimulationState';
    const pendingKey = isFluid ? 'pendingFluidDrops' : 'pendingMoteDrops';
    const bankKey = isFluid ? 'fluidIdleBank' : 'idleMoteBank';
    const hydratedKey = isFluid ? 'fluidBankHydrated' : 'idleBankHydrated';
    let snapshotCaptured = false;
    if (typeof simulation.exportState === 'function') {
      const snapshot = simulation.exportState();
      if (snapshot && typeof snapshot === 'object') {
        powderState[stateKey] = snapshot;
        snapshotCaptured = true;
        if (Array.isArray(powderState[pendingKey])) {
          powderState[pendingKey].length = 0;
        }
      }
    }
    if (!snapshotCaptured && Array.isArray(simulation.pendingDrops) && simulation.pendingDrops.length) {
      simulation.pendingDrops.forEach((drop) => {
        const sizeValue = Number.isFinite(drop?.size) ? drop.size : drop;
        if (!Number.isFinite(sizeValue)) {
          return;
        }
        const size = Math.max(1, Math.round(sizeValue));
        const pendingDrop = { size };
        if (drop && typeof drop === 'object' && drop.color && typeof drop.color === 'object') {
          pendingDrop.color = { ...drop.color };
        }
        powderState[pendingKey].push(pendingDrop);
      });
      simulation.pendingDrops.length = 0;
    }
    if (Number.isFinite(simulation.idleBank)) {
      powderState[bankKey] = Math.max(0, simulation.idleBank);
      powderState[hydratedKey] = false;
    }
    if (Number.isFinite(simulation.idleDrainRate)) {
      if (isFluid) {
        powderState.fluidIdleDrainRate = Math.max(0, simulation.idleDrainRate);
      } else {
        powderState.idleDrainRate = Math.max(0, simulation.idleDrainRate);
      }
    }
    if (typeof simulation.getEffectiveMotePalette === 'function') {
      powderState.motePalette = simulation.getEffectiveMotePalette();
      // Preserve palette continuity when exporting the active basin state.
      applyMindGatePaletteToDom(powderState.motePalette);
    }
    // Snapshotting occurs before mode swaps, so ensure the captured state persists immediately.
    schedulePowderBasinSave();
  }

  // Restore a serialized sand simulation once the canvas has been configured.
  function applyLoadedPowderSimulationState(simulation) {
    if (!simulation || typeof simulation.importState !== 'function') {
      return;
    }
    const isFluid = simulation === fluidSimulationInstance;
    const stateKey = isFluid ? 'loadedFluidState' : 'loadedSimulationState';
    const pendingKey = isFluid ? 'pendingFluidDrops' : 'pendingMoteDrops';
    const bankKey = isFluid ? 'fluidIdleBank' : 'idleMoteBank';
    const hydratedKey = isFluid ? 'fluidBankHydrated' : 'idleBankHydrated';
    const drainKey = isFluid ? 'fluidIdleDrainRate' : 'idleDrainRate';
    const initialLoadKey = isFluid ? 'fluidInitialLoadRestored' : 'initialLoadRestored';
    const snapshot = powderState[stateKey];
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }
    
    // On initial page load, use rectangle restoration if available
    // On subsequent tab switches, use full grain restoration
    const isInitialLoad = !powderState[initialLoadKey];
    if (isInitialLoad && snapshot.compactHeightLine && Number.isFinite(snapshot.moteCount)) {
      // Mark that initial load restoration has been completed
      powderState[initialLoadKey] = true;
      // Rectangle restoration will be handled by _synthesizeRectangleState in importState
    }
    
    const applied = simulation.importState(snapshot);
    if (!applied) {
      return;
    }
    powderState[stateKey] = null;
    powderState[bankKey] = Math.max(
      0,
      Number.isFinite(snapshot.idleBank) ? snapshot.idleBank : simulation.idleBank || 0,
    );
    powderState[hydratedKey] = true;
    powderState[drainKey] = simulation.idleDrainRate;
    powderState.motePalette = simulation.getEffectiveMotePalette();
    // Apply the restored palette so the Towers tab matches the revived basin state.
    applyMindGatePaletteToDom(powderState.motePalette);
    if (Array.isArray(powderState[pendingKey])) {
      powderState[pendingKey].length = 0;
    }
    // Restore wall gap from saved glyph number to ensure wall width matches saved progress
    if (Number.isFinite(powderState.wallGlyphsLit)) {
      updatePowderWallGapFromGlyphs(powderState.wallGlyphsLit);
    }
    // Writing back the hydrated state keeps restored motes available for the next session.
    schedulePowderBasinSave();
  }

  function getSimulationWallInsets(mode = powderSimulation === fluidSimulationInstance ? 'fluid' : 'sand') {
    const elements = mode === 'fluid' ? fluidElements : powderElements;
    const fallback = 68;
    const left = elements.leftWall ? Math.max(fallback, elements.leftWall.offsetWidth || 0) : fallback;
    const right = elements.rightWall ? Math.max(fallback, elements.rightWall.offsetWidth || 0) : fallback;
    return { left, right };
  }

  function queueMoteDrop(dropLike, color) {
    let drop = null;
    if (dropLike && typeof dropLike === 'object' && !Array.isArray(dropLike)) {
      drop = { ...dropLike };
    } else {
      drop = { size: dropLike, color };
    }
    const { size } = drop;
    if (!Number.isFinite(size) || size <= 0) {
      return;
    }
    const normalized = Math.max(1, Math.round(size));
    const payload = { size: normalized };
    if (drop.color && typeof drop.color === 'object') {
      payload.color = { ...drop.color };
    }
    if (powderSimulation && typeof powderSimulation.queueDrop === 'function') {
      powderSimulation.queueDrop(payload);
      // Request a save so newly queued motes persist if the session ends abruptly.
      schedulePowderBasinSave();
      return;
    }
    const targetIsFluid =
      powderSimulation === fluidSimulationInstance ||
      (!powderSimulation && powderState.simulationMode === 'fluid');
    const pendingList = targetIsFluid ? powderState.pendingFluidDrops : powderState.pendingMoteDrops;
    pendingList.push(payload);
    // Persist pending drops so they spawn correctly after a reload.
    schedulePowderBasinSave();
  }

  function stopResourceTicker() {
    if (resourceTicker) {
      clearInterval(resourceTicker);
      resourceTicker = null;
    }
  }

  // Maintain a lightweight ticker so idle resources trickle in during auto-run defenses.
  function ensureResourceTicker() {
    if (!resourceState.running) {
      stopResourceTicker();
      return;
    }

    if (resourceTicker || typeof window === 'undefined') {
      return;
    }

    lastResourceTick =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();

    resourceTicker = window.setInterval(() => {
      if (!resourceState.running) {
        stopResourceTicker();
        return;
      }

      const now =
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now();
      const deltaSeconds = Math.max(0, (now - lastResourceTick) / 1000);
      lastResourceTick = now;
      if (deltaSeconds <= 0) {
        return;
      }

      const scoreGain = resourceState.scoreRate * deltaSeconds;
      if (Number.isFinite(scoreGain) && scoreGain > 0) {
        resourceState.score += scoreGain;
      }

      // Update Shin Spire state (Iteron allocation)
      try {
        const deltaMs = deltaSeconds * 1000;
        updateShinState(deltaMs);
        updateShinDisplay();
        updateFractalSimulation(); // Update fractal rendering based on new allocations
        // Watch for new Shin glyphs so downstream spires unlock without delay.
        const currentShinGlyphs = Math.max(0, Math.floor(getShinGlyphs()));
        if (currentShinGlyphs !== getTrackedShinGlyphs()) {
          setTrackedShinGlyphs(currentShinGlyphs);
          spireMenuController.updateCounts();
          checkAndUnlockSpires();
        }
      } catch (error) {
        console.error('Error updating Shin state:', error);
      }

      updateStatusDisplays();
    }, 1000 / 30);
  }

  // Surface the live idle mote bank so developer controls and HUD panels can sync immediately.
  function getCurrentIdleMoteBank() {
    if (powderSimulation === sandSimulation && sandSimulation && Number.isFinite(sandSimulation.idleBank)) {
      const bank = Math.max(0, sandSimulation.idleBank);
      powderState.idleMoteBank = bank;
      powderState.idleBankHydrated = true;
      return bank;
    }
    return Math.max(0, powderState.idleMoteBank || 0);
  }

  // Provide the active mote dispense rate exposed by the current simulation profile or powder state.
  function getCurrentMoteDispenseRate() {
    if (powderSimulation === sandSimulation && sandSimulation && Number.isFinite(sandSimulation.idleDrainRate)) {
      const rate = Math.max(0, sandSimulation.idleDrainRate);
      powderState.idleDrainRate = rate;
      return rate;
    }
    return Math.max(0, powderState.idleDrainRate || 0);
  }

  function getCurrentFluidDropBank() {
    if (fluidSimulationInstance && Number.isFinite(fluidSimulationInstance.idleBank)) {
      const bank = Math.max(0, fluidSimulationInstance.idleBank);
      powderState.fluidIdleBank = bank;
      powderState.fluidBankHydrated = true;
      return bank;
    }
    return Math.max(0, powderState.fluidIdleBank || 0);
  }

  /**
   * Deduct Serendipity (fluid idle bank) for interactive Bet Spire upgrades.
   * @param {number} amount
   * @returns {number} - Actual Serendipity spent
   */
  function spendFluidSerendipity(amount) {
    const normalized = Math.max(0, Math.floor(amount));
    if (!normalized) {
      return 0;
    }
    const available = getCurrentFluidDropBank();
    const spend = Math.min(normalized, available);
    if (!spend) {
      return 0;
    }
    if (fluidSimulationInstance && Number.isFinite(fluidSimulationInstance.idleBank)) {
      fluidSimulationInstance.idleBank = Math.max(0, fluidSimulationInstance.idleBank - spend);
    }
    const current = Number.isFinite(powderState.fluidIdleBank) ? powderState.fluidIdleBank : 0;
    powderState.fluidIdleBank = Math.max(0, current - spend);
    powderState.fluidBankHydrated = false;
    schedulePowderBasinSave();
    updateStatusDisplays();
    return spend;
  }

  function getCurrentFluidDispenseRate() {
    if (fluidSimulationInstance && Number.isFinite(fluidSimulationInstance.idleDrainRate)) {
      const rate = Math.max(0, fluidSimulationInstance.idleDrainRate);
      powderState.fluidIdleDrainRate = rate;
      return rate;
    }
    return Math.max(0, powderState.fluidIdleDrainRate || 0);
  }

  function addIdleMoteBank(amount, options = {}) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const target = options && typeof options === 'object' ? options.target : undefined;
    let targetIsFluid;
    if (target === 'bet') {
      targetIsFluid = true;
    } else if (target === 'aleph') {
      targetIsFluid = false;
    } else {
      targetIsFluid =
        powderSimulation === fluidSimulationInstance ||
        (!powderSimulation && powderState.simulationMode === 'fluid');
    }

    const simulationTarget = targetIsFluid ? fluidSimulationInstance : sandSimulation;

    if (simulationTarget && typeof simulationTarget.addIdleMotes === 'function') {
      simulationTarget.addIdleMotes(amount);
      if (targetIsFluid) {
        powderState.fluidIdleBank = Math.max(0, simulationTarget.idleBank);
        powderState.fluidBankHydrated = simulationTarget === powderSimulation;
      } else {
        powderState.idleMoteBank = Math.max(0, simulationTarget.idleBank);
        powderState.idleBankHydrated = simulationTarget === powderSimulation;
      }
    } else if (targetIsFluid) {
      const current = Number.isFinite(powderState.fluidIdleBank) ? powderState.fluidIdleBank : 0;
      powderState.fluidIdleBank = Math.max(0, current + amount);
      powderState.fluidBankHydrated = false;
    } else {
      const current = Number.isFinite(powderState.idleMoteBank) ? powderState.idleMoteBank : 0;
      powderState.idleMoteBank = Math.max(0, current + amount);
      powderState.idleBankHydrated = false;
    }

    // Persist idle bank adjustments so offline rewards survive tab closures.
    schedulePowderBasinSave();
    updateStatusDisplays();
  }

  function flushPendingMoteDrops() {
    if (!powderSimulation || typeof powderSimulation.queueDrop !== 'function') {
      return;
    }
    const isFluid = powderSimulation === fluidSimulationInstance;
    const pendingDrops = isFluid ? powderState.pendingFluidDrops : powderState.pendingMoteDrops;
    if (pendingDrops.length) {
      pendingDrops.forEach((drop) => {
        const sizeValue = Number.isFinite(drop?.size) ? drop.size : drop;
        if (!Number.isFinite(sizeValue)) {
          return;
        }
        const normalized = Math.max(1, Math.round(sizeValue));
        const payload = drop && typeof drop === 'object' && drop.color && typeof drop.color === 'object'
          ? { size: normalized, color: { ...drop.color } }
          : { size: normalized };
        powderSimulation.queueDrop(payload);
      });
      pendingDrops.length = 0;
    }
    const bankKey = isFluid ? 'fluidIdleBank' : 'idleMoteBank';
    const hydratedKey = isFluid ? 'fluidBankHydrated' : 'idleBankHydrated';
    const pendingBank = Math.max(0, Number.isFinite(powderState[bankKey]) ? powderState[bankKey] : 0);
    if (pendingBank > 0) {
      const simulationBank = Number.isFinite(powderSimulation.idleBank)
        ? Math.max(0, powderSimulation.idleBank)
        : 0;
      const shouldInject = !powderState[hydratedKey] || Math.abs(simulationBank - pendingBank) > 0.5;
      if (shouldInject) {
        powderSimulation.addIdleMotes(pendingBank);
        powderState[bankKey] = 0;
      } else {
        powderState[bankKey] = simulationBank;
      }
      powderState[hydratedKey] = true;
    }
    // Flushes change the basin layout, so capture them for the next resume.
    schedulePowderBasinSave();
    updateStatusDisplays();
  }

  function handlePlayfieldCombatStart(levelId) {
    if (!levelId) {
      return;
    }
    hidePlayfieldOutcome();
    const existing = levelState.get(levelId) || {
      entered: false,
      running: false,
      completed: false,
    };
    const updated = { ...existing, entered: true, running: true };
    levelState.set(levelId, updated);
    activeLevelId = levelId;
    resourceState.running = true;
    ensureResourceTicker();
    updateActiveLevelBanner();
    updateLevelCards();
  }

  function handlePlayfieldVictory(levelId, stats = {}) {
    if (!levelId) {
      return;
    }
    const existing = levelState.get(levelId) || {
      entered: true,
      running: false,
      completed: false,
    };
    const alreadyCompleted = Boolean(existing.completed);
    const bestWave = Math.max(existing.bestWave || 0, stats.maxWave || 0);
    const updated = {
      ...existing,
      entered: true,
      running: false,
      completed: true,
      bestWave,
      lastResult: { outcome: 'victory', stats, timestamp: Date.now() },
    };
    levelState.set(levelId, updated);
    resourceState.running = false;

    notifyLevelVictory(levelId);

    if (!alreadyCompleted) {
      if (typeof stats.rewardScore === 'number') {
        resourceState.score += stats.rewardScore;
      }
      if (typeof stats.rewardFlux === 'number') {
        baseResources.fluxRate += stats.rewardFlux;
      }
      if (typeof stats.rewardEnergy === 'number') {
        baseResources.energyRate += stats.rewardEnergy;
      }
      unlockNextInteractiveLevel(levelId);
      // Check if tutorial completion should be triggered
      checkTutorialCompletion(isLevelCompleted);
      // Update tab lock states in case tutorial was just completed
      updateTabLockStates(isTutorialCompleted());
      updateResourceRates();
      updatePowderLedger();
    } else {
      updateStatusDisplays();
      updatePowderLedger();
    }

    updateActiveLevelBanner();
    updateLevelCards();
    commitAutoSave();

    if (activeLevelId === levelId && activeLevelIsInteractive && playfield) {
      // Surface the victory overlay so the player can exit the battlefield gracefully.
      const level = levelLookup.get(levelId);
      const subtitle = level && level.title ? `${level.title} sealed.` : 'All waves contained.';
      showPlayfieldOutcome({
        outcome: 'victory',
        title: 'Victory!',
        subtitle,
        primaryLabel: 'Back to Level Selection',
        onPrimary: exitToLevelSelectionFromOutcome,
      });
    }
  }

  function handlePlayfieldDefeat(levelId, stats = {}) {
    if (!levelId) {
      return;
    }
    const existing = levelState.get(levelId) || {
      entered: true,
      running: false,
      completed: false,
    };
    const bestWave = Math.max(existing.bestWave || 0, stats.maxWave || 0);
    const updated = {
      ...existing,
      entered: true,
      running: false,
      completed: existing.completed,
      bestWave,
      lastResult: { outcome: 'defeat', stats, timestamp: Date.now() },
    };
    levelState.set(levelId, updated);
    resourceState.running = false;
    updateActiveLevelBanner();
    updateLevelCards();
    commitAutoSave();

    if (activeLevelId === levelId && activeLevelIsInteractive && playfield) {
      // Display defeat messaging and optional endless retry controls directly on the playfield.
      const isEndless = Boolean(playfield.isEndlessMode);
      const fallbackWave = Number.isFinite(playfield.maxWaveReached)
        ? playfield.maxWaveReached
        : null;
      const achievedWave = Number.isFinite(stats.maxWave) ? stats.maxWave : fallbackWave;
      const waveLabel = achievedWave ? formatWholeNumber(achievedWave) : null;
      const subtitle = isEndless && waveLabel
        ? `Wave ${waveLabel} achieved.`
        : 'The defense collapsed—recalibrate and retry.';
      let secondaryLabel = null;
      let secondaryAction = null;
      if (isEndless && typeof playfield.getEndlessCheckpointInfo === 'function') {
        const checkpoint = playfield.getEndlessCheckpointInfo();
        if (checkpoint?.available && Number.isFinite(checkpoint.waveNumber)) {
          const retryWave = formatWholeNumber(checkpoint.waveNumber);
          secondaryLabel = `Retry from wave ${retryWave}`;
          secondaryAction = handleOutcomeRetryRequest;
        }
      }
      showPlayfieldOutcome({
        outcome: 'defeat',
        title: 'Defeat…',
        subtitle,
        primaryLabel: 'Back to Level Selection',
        onPrimary: exitToLevelSelectionFromOutcome,
        secondaryLabel,
        onSecondary: secondaryAction,
      });
    }
  }

  

  function collapseLevelSet(element, { focusTrigger = false } = {}) {
    if (!element) {
      return;
    }

    const trigger = element.querySelector('.level-set-trigger');
    const levelsContainer = element.querySelector('.level-set-levels');
    element.classList.remove('expanded');

    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      if (focusTrigger && typeof trigger.focus === 'function') {
        trigger.focus();
      }
    }

    if (levelsContainer) {
      levelsContainer.setAttribute('aria-hidden', 'true');
      levelsContainer.querySelectorAll('[data-level]').forEach((node) => {
        node.tabIndex = -1;
      });
    }

    if (expandedLevelSet === element) {
      expandedLevelSet = null;
    }
  }

  function expandLevelSet(element) {
    if (!element || element.classList.contains('locked') || element.hidden) {
      return;
    }

    if (expandedLevelSet && expandedLevelSet !== element) {
      collapseLevelSet(expandedLevelSet);
    }

    const trigger = element.querySelector('.level-set-trigger');
    const levelsContainer = element.querySelector('.level-set-levels');
    element.classList.add('expanded');

    if (trigger) {
      trigger.setAttribute('aria-expanded', 'true');
    }

    if (levelsContainer) {
      levelsContainer.setAttribute('aria-hidden', 'false');
      levelsContainer.querySelectorAll('[data-level]').forEach((node) => {
        const levelId = node.dataset.level;
        const unlocked = levelId ? isLevelUnlocked(levelId) : false;
        node.tabIndex = unlocked ? 0 : -1;
      });
    }

    expandedLevelSet = element;
  }

  // Reset an expanded campaign button so its sets slide back into the diamond.
  function collapseCampaign(element, { focusTrigger = false } = {}) {
    if (!element) {
      return;
    }

    const trigger = element.querySelector('.campaign-button-trigger');
    const setsContainer = element.querySelector('.campaign-button-sets');

    element.classList.remove('expanded');

    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      if (focusTrigger && typeof trigger.focus === 'function') {
        trigger.focus();
      }
    }

    if (setsContainer) {
      setsContainer.setAttribute('aria-hidden', 'true');
      setsContainer.hidden = true;
    }

    element.querySelectorAll('.level-set.expanded').forEach((levelSet) => {
      collapseLevelSet(levelSet);
    });

    if (expandedCampaign === element) {
      expandedCampaign = null;
      if (campaignRowElement) {
        campaignRowElement.classList.remove('campaign-row--has-selection');
      }
    }
  }

  // Expand the chosen campaign while collapsing any others in the rail.
  function expandCampaign(element) {
    if (!element) {
      return;
    }

    if (expandedCampaign && expandedCampaign !== element) {
      collapseCampaign(expandedCampaign);
    }

    const trigger = element.querySelector('.campaign-button-trigger');
    const setsContainer = element.querySelector('.campaign-button-sets');

    element.classList.add('expanded');

    if (trigger) {
      trigger.setAttribute('aria-expanded', 'true');
    }

    if (setsContainer) {
      setsContainer.hidden = false;
      setsContainer.setAttribute('aria-hidden', 'false');
    }

    if (expandedLevelSet) {
      collapseLevelSet(expandedLevelSet);
    }

    if (campaignRowElement) {
      campaignRowElement.classList.add('campaign-row--has-selection');
    }

    expandedCampaign = element;
  }

  function handleDocumentPointerDown(event) {
    const hasExpandedSet = Boolean(expandedLevelSet);

    // Only handle level set collapse on outside click; campaigns require explicit toggle or swipe.
    if (!hasExpandedSet) {
      return;
    }

    const clickedLevelSet = event?.target?.closest ? event.target.closest('.level-set') : null;
    if (clickedLevelSet && expandedLevelSet && expandedLevelSet.contains(clickedLevelSet)) {
      return;
    }

    // Collapse open level content when the player clicks anywhere else on the page.
    if (!clickedLevelSet && expandedLevelSet) {
      collapseLevelSet(expandedLevelSet);
      if (audioManager) {
        audioManager.playSfx('menuSelect');
      }
    }
  }

  function handleDocumentKeyDown(event) {
    if (event.key !== 'Escape') {
      return;
    }

    if (!expandedLevelSet) {
      return;
    }

    collapseLevelSet(expandedLevelSet, { focusTrigger: true });
    if (audioManager) {
      audioManager.playSfx('menuSelect');
    }
  }

  function handleGlobalButtonPointerDown(event) {
    if (!event) {
      return;
    }
    if (typeof event.button === 'number' && event.button !== 0) {
      return;
    }
    const target = event.target;
    if (!target) {
      return;
    }
    const button = target.closest('button');
    if (!button) {
      return;
    }
    if (button.disabled) {
      return;
    }
    const ariaDisabled = button.getAttribute('aria-disabled');
    if (ariaDisabled && ariaDisabled !== 'false') {
      return;
    }
    triggerButtonRipple(button, event);
  }

  document.addEventListener('pointerdown', handleDocumentPointerDown, { passive: true });
  document.addEventListener('pointerdown', handleGlobalButtonPointerDown, { passive: true });
  document.addEventListener('keydown', handleDocumentKeyDown);

  function areSetNormalLevelsCompleted(levels = []) {
    if (!Array.isArray(levels) || levels.length === 0) {
      return true;
    }
    return levels
      .filter((level) => level && !isSecretLevelId(level.id) && isInteractiveLevel(level.id))
      .every((level) => {
        const state = levelState.get(level.id);
        return Boolean(state && state.completed);
      });
  }

  function isInfinityModeUnlocked() {
    if (developerModeActive) {
      return true;
    }
    if (gameStats.manualVictories > 0) {
      return true;
    }
    for (const state of levelState.values()) {
      if (state?.completed) {
        return true;
      }
    }
    return false;
  }

  function updateLevelSetLocks() {
    if (!levelSetEntries.length) {
      return;
    }

    levelSetEntries.forEach((entry, index) => {
      if (!entry || !entry.element || !entry.trigger) {
        return;
      }

      const previous = levelSetEntries[index - 1];
      // Developer mode should surface every level set immediately, bypassing progression locks.
      const unlocked = developerModeActive
        || index === 0
        || areSetNormalLevelsCompleted(previous?.levels);

      if (!unlocked && entry.element.classList.contains('expanded')) {
        collapseLevelSet(entry.element);
      }

      entry.element.hidden = false;
      entry.element.setAttribute('aria-hidden', 'false');
      entry.element.classList.toggle('locked', !unlocked);

      entry.trigger.disabled = !unlocked;
      entry.trigger.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
      if (unlocked) {
        entry.trigger.removeAttribute('tabindex');
        entry.trigger.setAttribute('aria-label', `${entry.name} level set`);
        entry.trigger.title = `${entry.name} level set`;
      } else {
        entry.trigger.setAttribute('tabindex', '-1');
        entry.trigger.setAttribute('aria-label', 'Locked level set');
        entry.trigger.title = 'Locked level set';
      }

      if (entry.titleEl) {
        entry.titleEl.textContent = unlocked ? entry.name : 'LOCKED';
      }

      if (entry.countEl) {
        if (unlocked) {
          const countLabel = entry.levels.length === 1 ? 'level' : 'levels';
          entry.countEl.textContent = `${entry.levels.length} ${countLabel}`;
        } else {
          entry.countEl.textContent = 'LOCKED';
        }
      }
    });
  }

  // Draw a translucent version of the level's path behind the selection label so the card hints at its route.
  function createLevelNodePreview(level) {
    if (isStoryOnlyLevel(level?.id)) {
      return null;
    }
    const previewPoints = getPreviewPointsForLevel(level, levelConfigs);
    if (!Array.isArray(previewPoints) || previewPoints.length < 2) {
      return null;
    }

    const preview = document.createElementNS(SVG_NS, 'svg');
    preview.setAttribute('viewBox', '0 0 100 100');
    preview.setAttribute('class', 'level-node-preview');
    preview.setAttribute('aria-hidden', 'true');

    const padding = 12;
    const span = 100 - padding * 2;
    const pathData = previewPoints
      .map((point) => ({
        x: padding + clampNormalizedCoordinate(point?.x ?? 0.5) * span,
        y: padding + clampNormalizedCoordinate(point?.y ?? 0.5) * span,
      }))
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');

    const glow = document.createElementNS(SVG_NS, 'path');
    glow.setAttribute('d', pathData);
    glow.setAttribute('class', 'level-node-preview__glow');
    preview.append(glow);

    const stroke = document.createElementNS(SVG_NS, 'path');
    stroke.setAttribute('d', pathData);
    stroke.setAttribute('class', 'level-node-preview__stroke');
    preview.append(stroke);

    return preview;
  }

  function buildLevelCards() {
    if (!levelGrid) return;
    expandedLevelSet = null;
    expandedCampaign = null;
    campaignButtons = [];
    campaignRowElement = null;
    levelGrid.innerHTML = '';

    const fragment = document.createDocumentFragment();
    const groups = new Map();
    const campaigns = new Map();

    levelSetEntries.length = 0;

    // Group levels by campaign and set
    levelBlueprints.forEach((level) => {
      if (level.developerOnly && !developerModeActive) {
        return;
      }
      const groupKey = level.set || level.id.split(' - ')[0] || 'Levels';
      const campaignKey = level.campaign || null;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { levels: [], campaign: campaignKey });
      }
      groups.get(groupKey).levels.push(level);
      
      // Track which campaigns exist
      if (campaignKey) {
        if (!campaigns.has(campaignKey)) {
          campaigns.set(campaignKey, []);
        }
        if (!campaigns.get(campaignKey).includes(groupKey)) {
          campaigns.get(campaignKey).push(groupKey);
        }
      }
    });

    let groupIndex = 0;

    // Horizontal rail to keep campaign diamonds side by side.
    const campaignRow = document.createElement('div');
    campaignRow.className = 'campaign-row';
    campaignRowElement = campaignRow;
    
    // First, render Prologue (no campaign) at the top
    groups.forEach((groupData, setName) => {
      if (groupData.campaign) return; // Skip campaign sets for now
      const levels = groupData.levels;
      if (!levels.length) return;
      
      const setElement = document.createElement('div');
      setElement.className = 'level-set';
      setElement.dataset.set = setName;

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'level-set-trigger';
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-disabled', 'false');

      const glyph = document.createElement('span');
      glyph.className = 'level-set-glyph';
      glyph.setAttribute('aria-hidden', 'true');
      glyph.textContent = '∷';

      const title = document.createElement('span');
      title.className = 'level-set-title';
      title.textContent = setName;

      const count = document.createElement('span');
      count.className = 'level-set-count';
      const countLabel = levels.length === 1 ? 'level' : 'levels';
      count.textContent = `${levels.length} ${countLabel}`;

      trigger.append(glyph, title, count);

      const slug = setName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .trim() || `set-${groupIndex + 1}`;
      const containerId = `level-set-${slug}-${groupIndex}`;

      const levelsContainer = document.createElement('div');
      levelsContainer.className = 'level-set-levels';
      levelsContainer.id = containerId;
      levelsContainer.setAttribute('role', 'group');
      levelsContainer.setAttribute('aria-hidden', 'true');

      trigger.setAttribute('aria-controls', containerId);
      trigger.addEventListener('click', () => {
        if (setElement.classList.contains('locked') || setElement.hidden) {
          return;
        }
        if (setElement.classList.contains('expanded')) {
          collapseLevelSet(setElement);
        } else {
          expandLevelSet(setElement);
        }
        if (audioManager) {
          audioManager.playSfx('menuSelect');
        }
      });

      levels.forEach((level, index) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'level-node';
        card.classList.toggle('level-node--story', Boolean(level.isStoryLevel));
        card.dataset.level = level.id;
        card.setAttribute('aria-pressed', 'false');
        card.setAttribute(
          'aria-label',
          `${level.id}: ${level.title}. Path ${level.path}. Focus ${level.focus}.`,
        );
        card.tabIndex = -1;
        card.style.setProperty('--level-delay', `${index * 40}ms`);
        const pathLabel = typeof level.path === 'string' ? level.path : '—';
        const focusLabel = typeof level.focus === 'string' ? level.focus : '—';
        const ariaBase = level.isStoryLevel
          ? `${level.id}: ${level.title}. Story chapter.`
          : `${level.id}: ${level.title}. Path ${pathLabel}. Focus ${focusLabel}.`;
        card.innerHTML = `
          <span class="level-node-core">
            <span class="level-status-pill">New</span>
            <span class="level-id">${level.id}</span>
            <span class="level-node-title">${level.title}</span>
          </span>
          <span class="level-best-wave" aria-hidden="true" hidden>Wave —</span>
          <span class="screen-reader-only level-path">${level.isStoryLevel ? 'Story chapter—no battlefield route.' : `Path ${pathLabel}`}</span>
          <span class="screen-reader-only level-focus">${level.isStoryLevel ? 'Focus on dialogue and lore.' : `Focus ${focusLabel}`}</span>
          <span class="screen-reader-only level-mode">—</span>
          <span class="screen-reader-only level-duration">—</span>
          <span class="screen-reader-only level-rewards">—</span>
          <span class="screen-reader-only level-start-thero">Starting Thero —.</span>
          <span class="screen-reader-only level-last-result">No attempts recorded.</span>
          <span class="screen-reader-only level-best-wave-sr">Infinity wave record locked.</span>
        `;
        card.dataset.ariaLabelBase = ariaBase;
        const core = card.querySelector('.level-node-core');
        if (core && level.isStoryLevel) {
          const storyMarker = document.createElement('span');
          storyMarker.className = 'level-story-marker';
          storyMarker.innerHTML = '<span class="level-story-marker__icon" aria-hidden="true">📖</span><span class="level-story-marker__label">Story</span>';
          const storySrLabel = document.createElement('span');
          storySrLabel.className = 'screen-reader-only level-story-label';
          storySrLabel.textContent = 'Story chapter—no waves to defend.';
          core.append(storyMarker, storySrLabel);
        }
        const levelPreview = createLevelNodePreview(level);
        if (levelPreview) {
          // Seat the path trace behind the text so each card previews the map silhouette without affecting readability.
          card.append(levelPreview);
        }
        card.addEventListener('click', () => {
          handleLevelSelection(level);
        });
        card.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleLevelSelection(level);
          }
        });
        levelsContainer.append(card);
      });

      levelSetEntries.push({
        name: setName,
        element: setElement,
        trigger,
        titleEl: title,
        countEl: count,
        levels: levels.slice(),
      });

      setElement.append(trigger, levelsContainer);
      fragment.append(setElement);
      groupIndex += 1;
    });
    
    // Now render campaign buttons with their level sets
    campaigns.forEach((setKeys, campaignName) => {
      const campaignElement = document.createElement('div');
      campaignElement.className = 'campaign-button';
      campaignElement.dataset.campaign = campaignName;

      const campaignTrigger = document.createElement('button');
      campaignTrigger.type = 'button';
      campaignTrigger.className = 'campaign-button-trigger';
      campaignTrigger.setAttribute('aria-expanded', 'false');

      const campaignContent = document.createElement('span');
      campaignContent.className = 'campaign-button-content';

      const campaignGlyph = document.createElement('span');
      campaignGlyph.className = 'campaign-button-glyph';
      campaignGlyph.setAttribute('aria-hidden', 'true');
      // Assign unique glyph symbols for each campaign type.
      let glyphSymbol = '⚔';
      if (campaignName === 'Story') {
        glyphSymbol = '◈';
      } else if (campaignName === 'Challenges') {
        glyphSymbol = '⚡';
      }
      campaignGlyph.textContent = glyphSymbol;
      
      const campaignTitle = document.createElement('span');
      campaignTitle.className = 'campaign-button-title';
      campaignTitle.textContent = campaignName;
      
      const campaignCount = document.createElement('span');
      campaignCount.className = 'campaign-button-count';
      const setCount = setKeys.length;
      campaignCount.textContent = `${setCount} ${setCount === 1 ? 'set' : 'sets'}`;

      campaignContent.append(campaignGlyph, campaignTitle, campaignCount);
      campaignTrigger.append(campaignContent);
      
      const campaignContainer = document.createElement('div');
      campaignContainer.className = 'campaign-button-sets';
      campaignContainer.setAttribute('aria-hidden', 'true');
      campaignContainer.hidden = true;
      
      campaignTrigger.addEventListener('click', () => {
        const isExpanded = campaignElement.classList.contains('expanded');
        if (isExpanded) {
          collapseCampaign(campaignElement);
        } else {
          expandCampaign(campaignElement);
        }
        if (audioManager) {
          audioManager.playSfx('menuSelect');
        }
      });

      // Add swipe-up gesture detection to close campaign.
      // Track pointer state for detecting upward drag gestures.
      const swipeState = {
        startY: null,
        pointerId: null,
      };
      const SWIPE_UP_THRESHOLD = 50;

      campaignContainer.addEventListener('pointerdown', (event) => {
        swipeState.startY = event.clientY;
        swipeState.pointerId = event.pointerId;
      });

      campaignContainer.addEventListener('pointermove', (event) => {
        if (swipeState.pointerId !== event.pointerId || swipeState.startY === null) {
          return;
        }
        const deltaY = swipeState.startY - event.clientY;
        // Close campaign if user drags upward beyond threshold.
        if (deltaY > SWIPE_UP_THRESHOLD && campaignElement.classList.contains('expanded')) {
          collapseCampaign(campaignElement);
          if (audioManager) {
            audioManager.playSfx('menuSelect');
          }
          swipeState.startY = null;
          swipeState.pointerId = null;
        }
      });

      campaignContainer.addEventListener('pointerup', () => {
        swipeState.startY = null;
        swipeState.pointerId = null;
      });

      campaignContainer.addEventListener('pointercancel', () => {
        swipeState.startY = null;
        swipeState.pointerId = null;
      });
      
      // Render level sets inside this campaign
      setKeys.forEach((setName) => {
        const groupData = groups.get(setName);
        if (!groupData) return;
        const levels = groupData.levels;
        if (!levels.length) return;
        
        const setElement = document.createElement('div');
        setElement.className = 'level-set';
        setElement.dataset.set = setName;
        
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'level-set-trigger';
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-disabled', 'false');
        
        const glyph = document.createElement('span');
        glyph.className = 'level-set-glyph';
        glyph.setAttribute('aria-hidden', 'true');
        glyph.textContent = groupData.campaign === 'Story' ? '✦' : '⚑';
        
        const title = document.createElement('span');
        title.className = 'level-set-title';
        title.textContent = setName;
        
        const count = document.createElement('span');
        count.className = 'level-set-count';
        const countLabel = levels.length === 1 ? 'level' : 'levels';
        count.textContent = `${levels.length} ${countLabel}`;
        
        trigger.append(glyph, title, count);
        
        const slug = setName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .trim() || `set-${groupIndex + 1}`;
        const containerId = `level-set-${slug}-${groupIndex}`;
        
        const levelsContainer = document.createElement('div');
        levelsContainer.className = 'level-set-levels';
        levelsContainer.id = containerId;
        levelsContainer.setAttribute('role', 'group');
        levelsContainer.setAttribute('aria-hidden', 'true');
        
        trigger.setAttribute('aria-controls', containerId);
        trigger.addEventListener('click', () => {
          if (setElement.classList.contains('locked') || setElement.hidden) {
            return;
          }
          if (setElement.classList.contains('expanded')) {
            collapseLevelSet(setElement);
          } else {
            expandLevelSet(setElement);
          }
          if (audioManager) {
            audioManager.playSfx('menuSelect');
          }
        });
        
        levels.forEach((level, index) => {
          const card = document.createElement('button');
          card.type = 'button';
          card.className = 'level-node';
          card.classList.toggle('level-node--story', Boolean(level.isStoryLevel));
          card.dataset.level = level.id;
          card.setAttribute('aria-pressed', 'false');
          card.setAttribute(
            'aria-label',
            `${level.id}: ${level.title}. Path ${level.path}. Focus ${level.focus}.`,
          );
          card.tabIndex = -1;
          card.style.setProperty('--level-delay', `${index * 40}ms`);
          const pathLabel = typeof level.path === 'string' ? level.path : '—';
          const focusLabel = typeof level.focus === 'string' ? level.focus : '—';
          const ariaBase = level.isStoryLevel
            ? `${level.id}: ${level.title}. Story chapter.`
            : `${level.id}: ${level.title}. Path ${pathLabel}. Focus ${focusLabel}.`;
          card.innerHTML = `
            <span class="level-node-core">
              <span class="level-status-pill">New</span>
              <span class="level-id">${level.id}</span>
              <span class="level-node-title">${level.title}</span>
            </span>
            <span class="level-best-wave" aria-hidden="true" hidden>Wave —</span>
            <span class="screen-reader-only level-path">${level.isStoryLevel ? 'Story chapter—no battlefield route.' : `Path ${pathLabel}`}</span>
            <span class="screen-reader-only level-focus">${level.isStoryLevel ? 'Focus on dialogue and lore.' : `Focus ${focusLabel}`}</span>
            <span class="screen-reader-only level-mode">—</span>
            <span class="screen-reader-only level-duration">—</span>
            <span class="screen-reader-only level-rewards">—</span>
            <span class="screen-reader-only level-start-thero">Starting Thero —.</span>
            <span class="screen-reader-only level-last-result">No attempts recorded.</span>
            <span class="screen-reader-only level-best-wave-sr">Infinity wave record locked.</span>
          `;
          card.dataset.ariaLabelBase = ariaBase;
          const core = card.querySelector('.level-node-core');
          if (core && level.isStoryLevel) {
            const storyMarker = document.createElement('span');
            storyMarker.className = 'level-story-marker';
            storyMarker.innerHTML = '<span class="level-story-marker__icon" aria-hidden="true">📖</span><span class="level-story-marker__label">Story</span>';
            const storySrLabel = document.createElement('span');
            storySrLabel.className = 'screen-reader-only level-story-label';
            storySrLabel.textContent = 'Story chapter—no waves to defend.';
            core.append(storyMarker, storySrLabel);
          }
          const levelPreview = createLevelNodePreview(level);
          if (levelPreview) {
            card.append(levelPreview);
          }
          card.addEventListener('click', () => {
            handleLevelSelection(level);
          });
          card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleLevelSelection(level);
            }
          });
          levelsContainer.append(card);
        });
        
        levelSetEntries.push({
          name: setName,
          element: setElement,
          trigger,
          titleEl: title,
          countEl: count,
          levels: levels.slice(),
        });
        
        setElement.append(trigger, levelsContainer);
        campaignContainer.append(setElement);
        groupIndex += 1;
      });
      
      campaignElement.append(campaignTrigger, campaignContainer);
      campaignRow.append(campaignElement);
      campaignButtons.push(campaignElement);
    });

    if (campaignButtons.length) {
      fragment.append(campaignRow);
    }

    levelGrid.append(fragment);
    updateLevelSetLocks();
  }

  function handleLevelSelection(level) {
    const state = levelState.get(level.id) || { entered: false, running: false };
    const activeElement = document.activeElement;
    if (activeElement && typeof activeElement.focus === 'function') {
      lastLevelTrigger = activeElement;
    } else {
      lastLevelTrigger = null;
    }

    if (!isLevelUnlocked(level.id)) {
      const requirementId = getPreviousInteractiveLevelId(level.id);
      const requirement = requirementId ? levelLookup.get(requirementId) : null;
      const requirementLabel = requirement
        ? `${requirement.id} · ${requirement.title}`
        : 'the preceding defense';
      if (playfield?.messageEl) {
        playfield.messageEl.textContent = `Seal ${requirementLabel} to unlock ${level.id}.`;
      }
      if (audioManager) {
        audioManager.playSfx('error');
      }
      lastLevelTrigger = null;
      return;
    }

    // Handle story levels specially - always show story and mark as completed when finished
    if (isStoryOnlyLevel(level.id)) {
      if (levelStoryScreen) {
        levelStoryScreen.maybeShowStory(level, {
          shouldShow: () => true, // Force story display for story-only levels
          onComplete: () => {
            // Mark the story level as completed
            if (!isLevelCompleted(level.id)) {
              const currentState = levelState.get(level.id) || {};
              levelState.set(level.id, {
                ...currentState,
                completed: true,
                entered: true,
                storySeen: true,
              });
              unlockNextInteractiveLevel(level.id);
              updateLevelCards();
              
              // Special unlock for Prologue - Story: unlock Codex and Achievements tabs
              if (level.id === 'Prologue - Story') {
                unlockCodex();
                unlockAchievements();
                unlockCodexTab();
                unlockAchievementsTab();
              }
              
              // Check if this completes tutorial
              checkTutorialCompletion(isLevelCompleted);
              updateTabLockStates(isTutorialCompleted());
              commitAutoSave();
            }
          },
        });
      }
      lastLevelTrigger = null;
      return;
    }

    const otherActiveId = activeLevelId && activeLevelId !== level.id ? activeLevelId : null;
    const otherActiveState = otherActiveId ? levelState.get(otherActiveId) : null;
    const requiresExitConfirm = Boolean(
      otherActiveId && (otherActiveState?.running || otherActiveState?.entered),
    );

    if (!state.entered || requiresExitConfirm) {
      pendingLevel = level;
      if (levelOverlayController) {
        levelOverlayController.showLevelOverlay(level, {
          requireExitConfirm: requiresExitConfirm,
          exitLevelId: otherActiveId,
        });
      }
      return;
    }

    startLevel(level);
    focusLeaveLevelButton();
    lastLevelTrigger = null;
  }

  function cancelPendingLevel() {
    pendingLevel = null;
    if (levelOverlayController) {
      levelOverlayController.hideLevelOverlay();
    }
    if (lastLevelTrigger && typeof lastLevelTrigger.focus === 'function') {
      lastLevelTrigger.focus();
    }
    lastLevelTrigger = null;
  }

  function confirmPendingLevel() {
    if (!pendingLevel) {
      if (levelOverlayController) {
        levelOverlayController.hideLevelOverlay();
      }
      return;
    }

    const levelToStart = pendingLevel;
    pendingLevel = null;
    if (levelOverlayController) {
      levelOverlayController.hideLevelOverlay();
    }
    startLevel(levelToStart);
    focusLeaveLevelButton();
    lastLevelTrigger = null;
  }

  // Allow the overlay confirmation gesture to begin levels through the shared controller.
  if (levelOverlayController) {
    levelOverlayController.setConfirmHandler(confirmPendingLevel);
  }

  function startLevel(level) {
    deactivateDeveloperMapTools({ force: true, silent: true });
    const currentState = levelState.get(level.id) || {
      entered: false,
      running: false,
      completed: false,
    };
    const isInteractive = isInteractiveLevel(level.id);
    const levelConfig = levelConfigs.get(level.id);
    const forceEndlessMode = Boolean(level?.forceEndlessMode || levelConfig?.forceEndlessMode);
    if (isInteractive && !isLevelUnlocked(level.id)) {
      if (playfield?.messageEl) {
        const requiredId = getPreviousInteractiveLevelId(level.id);
        const requiredLevel = requiredId ? levelLookup.get(requiredId) : null;
        const requirementLabel = requiredLevel
          ? `${requiredLevel.id} · ${requiredLevel.title}`
          : 'the previous defense';
        playfield.messageEl.textContent = `Seal ${requirementLabel} to unlock this path.`;
      }
      return;
    }
    const updatedState = {
      ...currentState,
      entered: true,
      running: !isInteractive,
    };
    levelState.set(level.id, updatedState);
    
    // Unlock Towers tab when entering any interactive level for the first time
    if (isInteractive && !currentState.entered && !isTowersTabUnlocked()) {
      unlockTowersTabState();
      unlockTowersTab();
    }

    stopAllIdleRuns(level.id);

    levelState.forEach((state, id) => {
      if (id !== level.id) {
        levelState.set(id, { ...state, running: false });
      }
    });

    activeLevelId = level.id;
    // Remember whether the active map uses the live battlefield.
    activeLevelIsInteractive = isInteractive;
    resourceState.running = !isInteractive;
    ensureResourceTicker();
    updateActiveLevelBanner();
    updateLevelCards();

    if (playfield) {
      playfield.enterLevel(level, {
        endlessMode: forceEndlessMode || Boolean(updatedState.completed),
      });
    }

    if (isInteractive && levelStoryScreen) {
      levelStoryScreen.maybeShowStory(level);
    }

    if (isInteractive) {
      if (audioManager) {
        audioManager.playSfx('enterLevel');
      }
      refreshTabMusic({ restart: true });
    } else {
      refreshTabMusic();
    }

    if (!isInteractive) {
      beginIdleLevelRun(level);
    } else {
      updateIdleLevelDisplay();
    }

    updateTowerSelectionButtons();
    // Swap the visible UI surfaces to match the new level state.
    updateLayoutVisibility();
  }

  function leaveActiveLevel() {
    if (!activeLevelId) return;
    deactivateDeveloperMapTools({ force: true, silent: true });
    hidePlayfieldOutcome();
    const state = levelState.get(activeLevelId);
    if (state) {
      levelState.set(activeLevelId, { ...state, running: false });
    }
    stopIdleLevelRun(activeLevelId);
    if (playfield) {
      playfield.leaveLevel();
    }
    refreshTabMusic({ restart: true });
    activeLevelId = null;
    // Reset the interaction flag so the level grid is visible again.
    activeLevelIsInteractive = false;
    resourceState.running = false;
    updateActiveLevelBanner();
    updateLevelCards();
    // Ensure the battlefield stays hidden until another level begins.
    updateLayoutVisibility();
    updateTowerSelectionButtons();
    if (playfieldMenuController) {
      playfieldMenuController.updateMenuState();
    }
  }

  function updateLevelCards() {
    if (!levelGrid) return;
    const infinityUnlockedOverall = isInfinityModeUnlocked();
    levelBlueprints.forEach((level) => {
      const card = levelGrid.querySelector(`[data-level="${level.id}"]`);
      if (!card) return;
      const pill = card.querySelector('.level-status-pill');
      const titleEl = card.querySelector('.level-node-title');
      const pathEl = card.querySelector('.level-path');
      const focusEl = card.querySelector('.level-focus');
      const waveEl = card.querySelector('.level-best-wave');
      const waveSrEl = card.querySelector('.level-best-wave-sr');
      const state = levelState.get(level.id);
      const isStoryLevel = isStoryOnlyLevel(level.id);

      const entered = Boolean(state && state.entered);
      const running = Boolean(state && state.running);
      const completed = Boolean(state && state.completed);
      const unlocked = isLevelUnlocked(level.id);
      const infinityUnlocked = infinityUnlockedOverall;
      const pathLabel = typeof level.path === 'string' ? level.path : '—';
      const focusLabel = typeof level.focus === 'string' ? level.focus : '—';

      const summary = isStoryLevel
        ? {
          mode: 'Story',
          duration: 'Dialogue',
          rewards: 'Lore entry',
          start: '—',
          startAria: 'Story chapter—no starting Thero required.',
        }
        : getLevelSummary(level);
      const modeEl = card.querySelector('.level-mode');
      const durationEl = card.querySelector('.level-duration');
      const rewardsEl = card.querySelector('.level-rewards');
      const startEl = card.querySelector('.level-start-thero');
      if (modeEl) {
        modeEl.textContent = unlocked ? summary.mode : 'Locked';
      }
      if (durationEl) {
        durationEl.textContent = unlocked ? summary.duration : '—';
      }
      if (rewardsEl) {
        rewardsEl.textContent = unlocked ? summary.rewards : '—';
      }
      // Announce the effective starting Thero for assistive technologies.
      if (startEl) {
        if (unlocked) {
          if (summary.start && summary.start !== '—') {
            startEl.textContent = summary.startAria || `Starting Thero ${summary.start}.`;
          } else {
            startEl.textContent = summary.startAria || 'Starting Thero —.';
          }
        } else {
          startEl.textContent = 'Starting Thero locked.';
        }
      }

      const runner = idleLevelRuns.get(level.id) || null;
      const lastResultEl = card.querySelector('.level-last-result');
      if (lastResultEl) {
        if (unlocked) {
          if (isStoryLevel) {
            const seen = Boolean(state?.storySeen);
            lastResultEl.textContent = seen ? 'Story viewed.' : 'Story ready to read.';
          } else {
            lastResultEl.textContent = describeLevelLastResult(level, state || null, runner);
          }
        } else {
          lastResultEl.textContent = 'Locked until preceding defenses are sealed.';
        }
      }

      card.classList.toggle('entered', entered);
      card.classList.toggle('completed', completed);
      card.classList.toggle('locked', !unlocked);
      card.classList.toggle('level-node--story', isStoryLevel);
      card.setAttribute('aria-pressed', running ? 'true' : 'false');
      card.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
      const parentSet = card.closest('.level-set');
      const setExpanded = Boolean(parentSet && parentSet.classList.contains('expanded'));
      card.tabIndex = unlocked && setExpanded ? 0 : -1;

      if (titleEl) {
        titleEl.textContent = unlocked ? level.title : 'LOCKED';
      }
      if (pathEl) {
        pathEl.textContent = unlocked
          ? isStoryLevel
            ? 'Story chapter—no battlefield route.'
            : `Path ${pathLabel}`
          : 'Path details locked.';
      }
      if (focusEl) {
        focusEl.textContent = unlocked
          ? isStoryLevel
            ? 'Focus on dialogue and lore.'
            : `Focus ${focusLabel}`
          : 'Focus details locked.';
      }

      if (pill) {
        let pillVisible = false;
        let pillText = '';
        if (isStoryLevel) {
          pillText = 'Story';
          pillVisible = true;
        } else if (unlocked && !entered) {
          pillText = 'New';
          pillVisible = true;
        } else if (unlocked && running) {
          pillText = 'Running';
          pillVisible = true;
        }

        if (pillVisible) {
          pill.textContent = pillText;
          pill.removeAttribute('hidden');
          pill.setAttribute('aria-hidden', 'false');
        } else {
          pill.textContent = pillText;
          pill.setAttribute('aria-hidden', 'true');
          pill.setAttribute('hidden', '');
        }
      }

      const bestWave = isStoryLevel ? 0 : Number.isFinite(state?.bestWave) ? state.bestWave : 0;
      if (waveEl) {
        if (infinityUnlocked && !isStoryLevel) {
          const displayWave = bestWave > 0 ? formatWholeNumber(bestWave) : '—';
          waveEl.textContent = `Wave ${displayWave}`;
          waveEl.removeAttribute('hidden');
          card.classList.add('show-wave');
        } else {
          waveEl.setAttribute('hidden', '');
          card.classList.remove('show-wave');
        }
      }
      if (waveSrEl) {
        if (isStoryLevel) {
          waveSrEl.textContent = unlocked
            ? 'Story chapter—no waves to track.'
            : 'Story chapter locked.';
        } else if (infinityUnlocked) {
          waveSrEl.textContent = bestWave > 0
            ? `Infinity mode best wave ${formatWholeNumber(bestWave)}.`
            : 'Infinity mode ready—no wave record yet.';
        } else {
          waveSrEl.textContent = 'Infinity wave record locked.';
        }
      }

      const baseLabel = card.dataset.ariaLabelBase || '';
      if (unlocked) {
        const startLabel = summary.startAria ? ` ${summary.startAria}` : summary.start && summary.start !== '—'
          ? ` Starting Thero ${summary.start}.`
          : '';
        const waveLabel = !isStoryLevel && infinityUnlocked
          ? bestWave > 0
            ? ` Best wave reached: ${formatWholeNumber(bestWave)}.`
            : ' Infinity mode available—no wave record yet.'
          : '';
        const storyLabel = isStoryLevel ? ' Story chapter—no combat required.' : '';
        card.setAttribute('aria-label', `${baseLabel}${startLabel}${waveLabel}${storyLabel}`.trim());
      } else {
        card.setAttribute(
          'aria-label',
          `${level.id} locked. Seal the preceding defense to reveal details.`,
        );
      }
    });

    updateLevelSetLocks();
  }

  function updateActiveLevelBanner() {
    if (leaveLevelBtn) {
      leaveLevelBtn.disabled = !activeLevelId;
    }
    if (!activeLevelEl) return;
    if (!activeLevelId) {
      activeLevelEl.textContent = 'None selected';
      return;
    }

    const level = levelLookup.get(activeLevelId);
    const state = levelState.get(activeLevelId);
    if (!level || !state) {
      activeLevelEl.textContent = 'None selected';
      return;
    }

    let descriptor = 'Paused';
    if (state.running) {
      descriptor = 'Running';
    } else if (state.completed) {
      descriptor = 'Complete';
    }

    activeLevelEl.textContent = `${level.id} · ${level.title} (${descriptor})`;
  }

  



  function bindVisualSettingsMenu() {
    const trigger = document.getElementById('visual-settings-menu-button');
    const menu = document.getElementById('visual-settings-menu');
    if (!trigger || !menu) {
      return;
    }

    const setMenuState = (open) => {
      menu.dataset.open = open ? 'true' : 'false';
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    };

    const expandMenu = () => {
      menu.hidden = false;
      menu.style.maxHeight = '0px';
      setMenuState(true);
      menu.getBoundingClientRect();
      menu.style.maxHeight = `${menu.scrollHeight}px`;
    };

    const collapseMenu = () => {
      menu.style.maxHeight = `${menu.scrollHeight}px`;
      setMenuState(false);
      menu.getBoundingClientRect();
      menu.style.maxHeight = '0px';
    };

    trigger.addEventListener('click', () => {
      const open = menu.dataset.open === 'true';
      if (open) {
        collapseMenu();
      } else {
        expandMenu();
      }
    });

    menu.addEventListener('transitionend', (event) => {
      if (event.propertyName !== 'max-height') {
        return;
      }
      if (menu.dataset.open === 'true') {
        menu.style.maxHeight = 'none';
      } else {
        menu.hidden = true;
      }
    });

    setMenuState(false);
    menu.hidden = true;
    menu.style.maxHeight = '0px';
  }

  function bindLeaveLevelButton() {
    if (!leaveLevelBtn) return;
    leaveLevelBtn.addEventListener('click', () => {
      leaveActiveLevel();
    });
  }

  function focusLeaveLevelButton() {
    if (leaveLevelBtn && !leaveLevelBtn.disabled && typeof leaveLevelBtn.focus === 'function') {
      leaveLevelBtn.focus();
    }
  }



  // Field notes overlay logic handled by fieldNotesOverlay.js.

  function notifyAutoAnchorUsed(currentPlaced, totalAnchors) {
    if (!Number.isFinite(currentPlaced)) {
      return;
    }
    const normalizedTotal = Number.isFinite(totalAnchors)
      ? Math.max(0, totalAnchors)
      : Math.max(0, currentPlaced);
    const cappedPlaced = Math.max(0, Math.min(currentPlaced, normalizedTotal));
    gameStats.autoAnchorPlacements = Math.max(gameStats.autoAnchorPlacements, cappedPlaced);
    evaluateAchievements();
  }

  function notifyEnemyDefeated() {
    gameStats.enemiesDefeated += 1;
    evaluateAchievements();
  }

  function notifyLevelVictory(levelId) {
    if (isInteractiveLevel(levelId)) {
      gameStats.manualVictories += 1;
    } else {
      gameStats.idleVictories += 1;
    }
    evaluateAchievements();
  }

  function notifyPowderAction() {
    gameStats.powderActions += 1;
    evaluateAchievements();
  }

  function notifyPowderSigils(count) {
    if (!Number.isFinite(count)) {
      return;
    }
    const normalized = Math.max(0, Math.floor(count));
    gameStats.powderSigilsReached = Math.max(gameStats.powderSigilsReached, normalized);
    const sigilThreshold = Number.isFinite(powderConfig.fluidUnlockSigils)
      ? Math.max(0, powderConfig.fluidUnlockSigils)
      : Infinity;
    if (!powderState.fluidUnlocked && sigilThreshold > 0 && normalized >= sigilThreshold) {
      unlockFluidStudy({ reason: 'sigil', threshold: sigilThreshold, glyphCost: 0 });
    }
    if (moteGemState.autoCollectUnlocked) {
      autoCollectActiveMoteGems('glyph');
    }
    if (isTowerUpgradeOverlayActive()) {
      const activeTower = getActiveTowerUpgradeId();
      if (activeTower) {
        renderTowerUpgradeOverlay(activeTower, {});
      }
    }
    updateStatusDisplays();
    evaluateAchievements();
  }

  function notifyPowderMultiplier(value) {
    if (!Number.isFinite(value)) {
      return;
    }
    if (value > gameStats.highestPowderMultiplier) {
      gameStats.highestPowderMultiplier = value;
    }
    evaluateAchievements();
  }

  function updateFluidDisplay(status) {
    // If the Bet Spire is locked or has been deleted, freeze the readouts and halt any
    // lingering fluid simulation so the reservoir numbers stay static instead of drifting.
    if (!powderState.fluidUnlocked) {
      if (fluidSimulationInstance && typeof fluidSimulationInstance.stop === 'function') {
        fluidSimulationInstance.stop();
      }

      if (fluidElements.reservoirValue) {
        fluidElements.reservoirValue.textContent = '0 Serendipity';
      }
      if (fluidElements.dripRateValue) {
        fluidElements.dripRateValue.textContent = '0 Serendipity/sec';
      }
      if (fluidElements.stateLabel) {
        fluidElements.stateLabel.textContent = 'Dormant';
        fluidElements.stateLabel.classList.remove('fluid-state-label--ready');
        fluidElements.stateLabel.classList.remove('fluid-state-label--forming');
      }
      if (fluidElements.statusNote) {
        fluidElements.statusNote.textContent = 'The Bet reservoir is sealed until the spire returns.';
      }
      return;
    }

    const activeSimulation =
      fluidSimulationInstance && typeof fluidSimulationInstance.getStatus === 'function'
        ? fluidSimulationInstance
        : null;
    let info = null;
    if (powderSimulation === fluidSimulationInstance && status) {
      info = status;
    } else if (activeSimulation) {
      info = activeSimulation.getStatus();
    }

    const normalizedHeight = Number.isFinite(info?.normalizedHeight)
      ? Math.max(0, Math.min(1, info.normalizedHeight))
      : 0;
    // Highest crest accounts for hidden overflow so the readout mirrors the tallest wave peak, not a fill gauge.
    const crestNormalized = Number.isFinite(info?.highestNormalized)
      ? Math.max(0, Math.min(2, info.highestNormalized))
      : normalizedHeight;
    const scrollOffset = Number.isFinite(info?.scrollOffset) ? Math.max(0, info.scrollOffset) : 0;
    const totalNormalized = Number.isFinite(info?.totalNormalized)
      ? Math.max(0, info.totalNormalized)
      : normalizedHeight;
    const cellSize = Number.isFinite(info?.cellSize)
      ? Math.max(1, info.cellSize)
      : POWDER_CELL_SIZE_PX;
    const rows = Number.isFinite(info?.rows) ? Math.max(1, info.rows) : 1;
    const highestNormalizedRaw = Number.isFinite(info?.highestNormalized)
      ? Math.max(0, info.highestNormalized)
      : totalNormalized;

    // Update glyph columns and track Bet glyph awards
    const glyphMetrics = updateFluidGlyphColumns({
      scrollOffset,
      rows,
      cellSize,
      highestNormalized: highestNormalizedRaw,
      totalNormalized,
    });

    if (glyphMetrics) {
      const { glyphsLit } = glyphMetrics;
      const previousAwarded = Number.isFinite(powderState.fluidGlyphsAwarded)
        ? Math.max(0, powderState.fluidGlyphsAwarded)
        : 0;

      if (glyphsLit > previousAwarded) {
        const newlyEarned = glyphsLit - previousAwarded;
        awardBetGlyphs(newlyEarned);
        powderState.fluidGlyphsAwarded = glyphsLit;
        // Check if any spires should auto-unlock
        checkAndUnlockSpires();
      } else if (!Number.isFinite(powderState.fluidGlyphsAwarded) || powderState.fluidGlyphsAwarded < glyphsLit) {
        powderState.fluidGlyphsAwarded = Math.max(previousAwarded, glyphsLit);
      }

      const normalizedGlyphs = Number.isFinite(glyphsLit) ? Math.max(0, glyphsLit) : 0;
      const previousWallTarget = Number.isFinite(powderState.wallGapTarget)
        ? powderState.wallGapTarget
        : powderConfig.wallBaseGapMotes;
      const rawNextWallTarget = powderConfig.wallBaseGapMotes + normalizedGlyphs * powderConfig.wallGapPerGlyph;
      const nextWallTarget = Math.min(rawNextWallTarget, powderConfig.wallMaxGapMotes);

      if (nextWallTarget !== previousWallTarget) {
        powderState.wallGapTarget = nextWallTarget;
        const targetSimulation =
          fluidSimulationInstance && typeof fluidSimulationInstance.setWallGapTarget === 'function'
            ? fluidSimulationInstance
            : null;
        if (targetSimulation) {
          const fluidIsActive = powderSimulation === targetSimulation;
          const setOptions = fluidIsActive ? undefined : { skipRebuild: true };
          targetSimulation.setWallGapTarget(nextWallTarget, setOptions);
          const metrics = targetSimulation.getWallMetrics();
          handlePowderWallMetricsChange(metrics, 'fluid');
        } else {
          schedulePowderBasinSave();
        }
      }

      if (glyphsLit !== powderState.fluidGlyphsLit) {
        powderState.fluidGlyphsLit = glyphsLit;
        schedulePowderBasinSave();
      }
    }

    // Apply wall offset for scrolling texture
    const wallShiftPx = scrollOffset * cellSize;
    const textureRepeat = resolveWallTextureRepeatPx(fluidElements.leftWall || fluidElements.rightWall);
    const rawTextureOffset =
      Number.isFinite(textureRepeat) && textureRepeat > 0 ? wallShiftPx % textureRepeat : wallShiftPx;
    const wallTextureOffset = Number.isFinite(rawTextureOffset) ? rawTextureOffset : 0;
    const wallOffsetValue = `${wallTextureOffset.toFixed(1)}px`;

    if (fluidElements.leftWall) {
      fluidElements.leftWall.style.transform = '';
      fluidElements.leftWall.style.setProperty('--powder-wall-shift', wallOffsetValue);
    }
    if (fluidElements.rightWall) {
      fluidElements.rightWall.style.transform = '';
      fluidElements.rightWall.style.setProperty('--powder-wall-shift', wallOffsetValue);
    }

    const idleBank = Number.isFinite(powderState.fluidIdleBank) ? Math.max(0, powderState.fluidIdleBank) : 0;
    if (fluidElements.reservoirValue) {
      fluidElements.reservoirValue.textContent = `${formatGameNumber(idleBank)} Serendipity`;
    }

    const drainRate = Number.isFinite(powderState.fluidIdleDrainRate)
      ? Math.max(0, powderState.fluidIdleDrainRate)
      : 0;
    if (fluidElements.dripRateValue) {
      fluidElements.dripRateValue.textContent = `${formatDecimal(drainRate, 2)} Serendipity/sec`;
    }

    if (fluidElements.statusNote) {
      let message;
      const crestPercent = formatDecimal(crestNormalized * 100, 1);
      if (crestNormalized >= 1.2) {
        message = `Crest is ${crestPercent}% of the viewport—overflow is cycling while idle Serendipity condenses.`;
      } else if (crestNormalized >= 0.75) {
        message = `Surface oscillates near the ridge (${crestPercent}%). This gauge tracks wave height, not stored Serendipity.`;
      } else {
        message = `Terrarium surface is calm (${crestPercent}%). Wave height is separate from the Serendipity reserve total.`;
      }
      fluidElements.statusNote.textContent = message;
    }

    if (betHappinessSystem) {
      betHappinessSystem.updateDisplay(fluidElements);
    }
  }

  function handlePowderIdleBankChange(bankValue, source) {
    const normalized = Number.isFinite(bankValue) ? Math.max(0, bankValue) : 0;
    const origin = source || (powderSimulation === fluidSimulationInstance ? 'fluid' : 'sand');
    if (origin === 'fluid') {
      const previous = Number.isFinite(powderState.fluidIdleBank) ? powderState.fluidIdleBank : 0;
      powderState.fluidIdleBank = normalized;
      powderState.fluidBankHydrated = powderSimulation === fluidSimulationInstance;
      if (resourceElements.tabFluidBadge) {
        const tabStoredLabel = formatGameNumber(normalized);
        resourceElements.tabFluidBadge.textContent = tabStoredLabel;
        resourceElements.tabFluidBadge.setAttribute('aria-label', `${tabStoredLabel} Serendipity in reserve`);
        if (powderState.fluidUnlocked) {
          resourceElements.tabFluidBadge.removeAttribute('hidden');
          resourceElements.tabFluidBadge.setAttribute('aria-hidden', 'false');
        }
      }
      if (Math.abs(previous - normalized) >= 0.0001) {
        schedulePowderBasinSave();
      }
      updateFluidDisplay();
      return;
    }

    const previous = Number.isFinite(powderState.idleMoteBank) ? powderState.idleMoteBank : 0;
    powderState.idleMoteBank = normalized;
    powderState.idleBankHydrated = powderSimulation === sandSimulation && !!sandSimulation;

    if (Math.abs(previous - normalized) < 0.0001) {
      updateFluidDisplay();
      return;
    }

    if (powderElements.moteBank) {
      const moteLabel = normalized === 1 ? 'Mote' : 'Motes';
      powderElements.moteBank.textContent = `${formatGameNumber(normalized)} ${moteLabel}`;
    }

    if (resourceElements.tabMoteBadge) {
      const tabStoredLabel = formatGameNumber(normalized);
      resourceElements.tabMoteBadge.textContent = tabStoredLabel;
      resourceElements.tabMoteBadge.setAttribute('aria-label', `${tabStoredLabel} motes in bank`);
      resourceElements.tabMoteBadge.removeAttribute('hidden');
      resourceElements.tabMoteBadge.setAttribute('aria-hidden', 'false');
    }

    updateFluidDisplay();
  }

  function handlePowderHeightChange(info, source) {
    if (!info) {
      return;
    }

    const origin = source || (powderSimulation === fluidSimulationInstance ? 'fluid' : 'sand');
    if (origin === 'fluid') {
      updateFluidDisplay(info);
      schedulePowderBasinSave();
      return;
    }

    const previousGain = powderState.simulatedDuneGain;
    const normalizedHeight = Number.isFinite(info.normalizedHeight)
      ? Math.max(0, Math.min(1, info.normalizedHeight))
      : 0;
    const clampedGain = Number.isFinite(info.duneGain)
      ? Math.max(0, Math.min(powderConfig.simulatedDuneGainMax, info.duneGain))
      : 0;
    const scrollOffset = Number.isFinite(info.scrollOffset) ? Math.max(0, info.scrollOffset) : 0;
    const totalNormalized = Number.isFinite(info.totalNormalized)
      ? Math.max(0, info.totalNormalized)
      : normalizedHeight;
    const cellSize = Number.isFinite(info.cellSize)
      ? Math.max(1, info.cellSize)
      : POWDER_CELL_SIZE_PX;
    const rows = Number.isFinite(info.rows) ? Math.max(1, info.rows) : 1;
    const highestNormalizedRaw = Number.isFinite(info.highestNormalized)
      ? Math.max(0, info.highestNormalized)
      : totalNormalized;
    const highestNormalized = Math.max(0, Math.min(1, highestNormalizedRaw));
    const highestDisplay = formatDecimal(Math.max(0, highestNormalizedRaw), 2);

    powderState.simulatedDuneGain = clampedGain;
    // Capture the current height profile so dune progress resumes accurately after reloads.
    schedulePowderBasinSave();

    if (powderElements.basin) {
      powderElements.basin.style.setProperty('--powder-crest', normalizedHeight.toFixed(3));
    }

    const wallShiftPx = scrollOffset * cellSize;
    const textureRepeat = resolveWallTextureRepeatPx(powderElements.leftWall || powderElements.rightWall);
    const rawTextureOffset =
      Number.isFinite(textureRepeat) && textureRepeat > 0 ? wallShiftPx % textureRepeat : wallShiftPx;
    const wallTextureOffset = Number.isFinite(rawTextureOffset) ? rawTextureOffset : 0;
    const wallOffsetValue = `${wallTextureOffset.toFixed(1)}px`;

    if (powderElements.leftWall) {
      powderElements.leftWall.style.transform = '';
      // Apply the offset via a CSS variable so the wall texture scrolls without breaking wall markers.
      powderElements.leftWall.style.setProperty('--powder-wall-shift', wallOffsetValue);
    }
    if (powderElements.rightWall) {
      powderElements.rightWall.style.transform = '';
      powderElements.rightWall.style.setProperty('--powder-wall-shift', wallOffsetValue);
    }

    const basinHeight = rows * cellSize;

    const glyphMetrics = updatePowderGlyphColumns({
      scrollOffset,
      rows,
      cellSize,
      highestNormalized: highestNormalizedRaw,
      totalNormalized,
    });

    if (powderElements.nextGlyphProgress) {
      if (glyphMetrics) {
        const clampedProgress = Math.min(1, Math.max(0, glyphMetrics.progressFraction));
        // Show progress climbing toward the next glyph instead of counting down from 100%.
        const progressPercent = formatDecimal(clampedProgress * 100, 1);
        const remainingHeight = formatDecimal(Math.max(0, glyphMetrics.remainingToNext), 2);
        const nextLabel = formatAlephLabel(Math.max(0, glyphMetrics.nextIndex));
        powderElements.nextGlyphProgress.textContent = `${progressPercent}% to ${nextLabel} · Δh ${remainingHeight}`;
      } else {
        powderElements.nextGlyphProgress.textContent = '—';
      }
    }

    if (glyphMetrics) {
      const { glyphsLit, highestRaw, progressFraction } = glyphMetrics;
      // Award glyph currency the moment a new Aleph threshold is illuminated.
      const previousAwarded = Number.isFinite(powderState.glyphsAwarded)
        ? Math.max(0, powderState.glyphsAwarded)
        : 0;
      if (glyphsLit > previousAwarded) {
        const newlyEarned = glyphsLit - previousAwarded;
        addGlyphCurrency(newlyEarned);
        powderState.glyphsAwarded = glyphsLit;
        // Check if any spires should auto-unlock
        checkAndUnlockSpires();
      } else if (!Number.isFinite(powderState.glyphsAwarded) || powderState.glyphsAwarded < glyphsLit) {
        powderState.glyphsAwarded = Math.max(previousAwarded, glyphsLit);
      }
      updatePowderWallGapFromGlyphs(glyphsLit);
      if (powderElements.leftWall) {
        powderElements.leftWall.classList.toggle('wall-awake', highestRaw > 0);
      }
      if (powderElements.rightWall) {
        powderElements.rightWall.classList.toggle(
          'wall-awake',
          glyphsLit > 0 || progressFraction >= 0.6,
        );
      }

      if (glyphsLit !== powderState.wallGlyphsLit) {
        powderState.wallGlyphsLit = glyphsLit;
        notifyPowderSigils(glyphsLit);
      }
    }

    if (Math.abs(previousGain - clampedGain) > 0.01) {
      refreshPowderSystems();
    }

    updateFluidDisplay(info);
  }

  configureAchievementsTab({
    levelConfigs,
    levelState,
    getInteractiveLevelOrder: () => interactiveLevelOrder,
    isLevelCompleted,
    THERO_SYMBOL,
    recordPowderEvent,
    updateResourceRates,
    updatePowderLedger,
    updateStatusDisplays,
    gameStats,
  });

  async function init() {
    // Configure towersTab callbacks to avoid circular dependency
    configureTowersTabCallbacks({
      updateStatusDisplays,
    });

    levelGrid = document.getElementById('level-grid');
    activeLevelEl = document.getElementById('active-level');
    leaveLevelBtn = document.getElementById('leave-level');
    if (levelOverlayController) {
      levelOverlayController.bindOverlayElements();
    }
    if (levelStoryScreen) {
      levelStoryScreen.bindElements({
        overlay: document.getElementById('level-story-overlay'),
        label: document.getElementById('level-story-label'),
        sections: document.getElementById('level-story-sections'),
        prompt: document.getElementById('level-story-prompt'),
      });
    }
    // Cache layout toggles for switching between the level grid and battlefield.
    playfieldWrapper = document.getElementById('playfield-wrapper');
    stageControls = document.getElementById('stage-controls');
    levelSelectionSection = document.getElementById('level-selection');
    if (playfieldMenuController) {
      // Wire the playfield quick menu buttons through the dedicated controller.
      playfieldMenuController.bindMenuElements({
        button: document.getElementById('playfield-menu-button'),
        panel: document.getElementById('playfield-menu-panel'),
        commence: document.getElementById('playfield-menu-commence'),
        levelSelect: document.getElementById('playfield-menu-level-select'),
        retry: document.getElementById('playfield-menu-retry-wave'),
        devTools: document.getElementById('playfield-menu-dev-tools'),
        stats: document.getElementById('playfield-menu-stats'),
      });
    }
    // Default to the level selection view until a combat encounter begins.
    updateLayoutVisibility();
    // Instantiate overlay preview renderer so level cards share the same editor plumbing.
    levelPreviewRenderer = createLevelPreviewRenderer({
      getOverlayElement: () => levelOverlayController?.getOverlayElement() || null,
      getOverlayPreviewElement: () => levelOverlayController?.getOverlayPreviewElement() || null,
      getLevelConfigs: () => levelConfigs,
      getPlayfield: () => playfield,
      playfieldElements,
      isDeveloperModeActive: () => developerModeActive,
      getActiveLevelId: () => activeLevelId,
      isActiveLevelInteractive: () => activeLevelIsInteractive,
      setOverlayPreviewLevel,
      hideLevelEditorPanel,
      resetLevelEditorSurface,
      setLevelEditorSurface,
      configureLevelEditorForLevel,
    });
    if (levelOverlayController) {
      levelOverlayController.setPreviewRenderer(levelPreviewRenderer);
    }

    // Activate the gem cursor when a desktop pointer is detected.
    initializeDesktopCursorPreference();

    // Enable drag gestures on targeted overlays; panels rely on native scroll to keep wheel navigation responsive.
    enableDragScroll({
      selectors: ['.field-notes-page', '.upgrade-matrix-grid'],
    });

    initializeLevelEditorElements();
    initializeDeveloperMapElements();

    // Apply the preferred graphics fidelity before other controls render.
    initializeGraphicsMode();
    initializeTrackRenderMode();
    bindGraphicsModeToggle();
    bindVisualSettingsMenu();
    bindColorSchemeButton();
    bindTrackRenderModeButton();
    // Expose a tactile toggle for the luminous track tracer overlay.
    bindTrackTracerToggle();
    bindLoadoutSlotButton();
    bindNotationToggle();
    bindGlyphEquationToggle();
    bindDamageNumberToggle();
    bindWaveKillTallyToggle();
    bindWaveDamageTallyToggle();
    initializeColorScheme();
    bindAudioControls();

    const towerPanel = document.getElementById('panel-tower');
    const towersPanel = document.getElementById('panel-towers');
    const optionsPanel = document.getElementById('panel-options');
    enablePanelWheelScroll(towerPanel, isFieldNotesOverlayVisible);
    enablePanelWheelScroll(towersPanel, isFieldNotesOverlayVisible);
    enablePanelWheelScroll(optionsPanel, isFieldNotesOverlayVisible);

    playfieldElements.container = document.getElementById('playfield');
    playfieldElements.canvas = document.getElementById('playfield-canvas');
    playfieldElements.message = document.getElementById('playfield-message');
    playfieldElements.wave = document.getElementById('playfield-wave');
    playfieldElements.health = document.getElementById('playfield-health');
    playfieldElements.energy = document.getElementById('playfield-energy');
    playfieldElements.progress = document.getElementById('playfield-progress');
    playfieldElements.startButton =
      document.getElementById('playfield-menu-commence') ||
      document.getElementById('playfield-start');
    playfieldElements.speedButton = document.getElementById('playfield-speed');
    playfieldElements.autoAnchorButton = document.getElementById('playfield-auto');
    playfieldElements.autoWaveCheckbox = document.getElementById('playfield-auto-wave');
    playfieldElements.slots = Array.from(document.querySelectorAll('.tower-slot'));
    PlayfieldStatsPanel.registerStatsElements({
      container: document.getElementById('playfield-combat-stats'),
      towerList: document.getElementById('playfield-combat-stats-towers'),
      attackList: document.getElementById('playfield-combat-stats-log'),
      enemyList: document.getElementById('playfield-combat-stats-enemies'),
      currentWaveList: document.getElementById('playfield-combat-stats-current-wave'),
      nextWaveList: document.getElementById('playfield-combat-stats-next-wave'),
      activeEnemyList: document.getElementById('playfield-combat-stats-active-enemies'),
      emptyTowerNote: document.getElementById('playfield-combat-stats-tower-empty'),
      emptyAttackNote: document.getElementById('playfield-combat-stats-log-empty'),
      emptyEnemyNote: document.getElementById('playfield-combat-stats-enemy-empty'),
      emptyCurrentWaveNote: document.getElementById('playfield-combat-stats-current-empty'),
      emptyNextWaveNote: document.getElementById('playfield-combat-stats-next-empty'),
      emptyActiveEnemyNote: document.getElementById('playfield-combat-stats-active-empty'),
      dialog: document.getElementById('playfield-combat-stats-dialog'),
      dialogTitle: document.getElementById('playfield-combat-stats-dialog-title'),
      dialogList: document.getElementById('playfield-combat-stats-dialog-list'),
      dialogClose: document.getElementById('playfield-combat-stats-dialog-close'),
    });
    setPlayfieldOutcomeElements({
      overlay: document.getElementById('playfield-outcome'),
      title: document.getElementById('playfield-outcome-title'),
      subtitle: document.getElementById('playfield-outcome-subtitle'),
      primary: document.getElementById('playfield-outcome-primary'),
      secondary: document.getElementById('playfield-outcome-secondary'),
    });
    bindPlayfieldOutcomeEvents();
    hidePlayfieldOutcome();

    setLoadoutElements({
      shell: document.getElementById('tower-loadout-shell'),
      container: document.getElementById('tower-loadout'),
      grid: document.getElementById('tower-loadout-grid'),
      note: document.getElementById('tower-loadout-note'),
      toggle: document.getElementById('tower-loadout-toggle'),
    });
    setLoadoutSlotChangeHandler((slotCount) => {
      overrideTowerLoadoutLimit(slotCount);
      syncLoadoutToPlayfield();
    });

    setHideUpgradeMatrixCallback(hideUpgradeMatrix);
    setRenderUpgradeMatrixCallback(renderUpgradeMatrix);

    bindTowerUpgradeOverlay();

    // Synchronize tab interactions with overlay state, audio cues, and banner refreshes.
    configureTabManager({
      getOverlayActiveState: () => Boolean(levelOverlayController?.isOverlayActive()),
      isFieldNotesOverlayVisible,
      onTabChange: (tabId) => {
        // Hide the tower selection wheel whenever players leave the Stage tab.
        if (tabId !== 'tower' && playfield && typeof playfield.closeTowerSelectionWheel === 'function') {
          playfield.closeTowerSelectionWheel();
        }
        if (previousTabId === 'tsadi' && tabId !== 'tsadi') {
          // Stash Tsadi particle counts before the viewport collapses so reentry can rebuild cleanly.
          tsadiSimulationInstance?.stageParticlesForReentry?.();
        }

        // Surface spire briefings the first time each tab opens.
        maybeShowSpireStory(tabId);

        refreshTabMusic();
        if (audioManager) {
          if (tabId === 'lamed') {
            // Ensure the gravity well emits its low rumble whenever the Lamed tab is visible.
            audioManager.playSfx('lamedRumble', { loop: true, restart: false });
          } else {
            audioManager.stopSfx('lamedRumble', { reset: false });
          }
        }
        // Compact spire tabs no longer need stack state synchronization
        if (tabId === 'fluid') {
          updateFluidTabAvailability();
          if (powderState.simulationMode !== 'fluid') {
            applyPowderSimulationMode('fluid');
          } else {
            if (fluidSimulationInstance && typeof fluidSimulationInstance.handleResize === 'function') {
              fluidSimulationInstance.handleResize();
            }
            initializePowderViewInteraction();
            const fluidStatus =
              fluidSimulationInstance && typeof fluidSimulationInstance.getStatus === 'function'
                ? fluidSimulationInstance.getStatus()
                : null;
            updateFluidDisplay(fluidStatus);
          }
        } else if (tabId === 'powder') {
          if (powderState.simulationMode !== 'sand') {
            applyPowderSimulationMode('sand');
          } else {
            if (sandSimulation && typeof sandSimulation.handleResize === 'function') {
              sandSimulation.handleResize();
            }
            initializePowderViewInteraction();
          }
        } else if (tabId === 'lamed') {
          // Initialize and start Lamed gravity simulation
          if (!lamedSimulationInstance) {
            const lamedCanvas = document.getElementById('lamed-canvas');
            if (lamedCanvas) {
              attachLamedDeveloperSpamTarget(lamedCanvas);
              ensureLamedBankSeeded();
              lamedSimulationInstance = new GravitySimulation({
                canvas: lamedCanvas,
                initialSparkBank: getLamedSparkBank(),
                isLowGraphicsMode: () => isLowGraphicsModeActive(),
                onSparkBankChange: (value) => {
                  setLamedSparkBank(value);
                },
                onStarMassChange: (value) => {
                  // Update state persistence
                  spireResourceState.lamed.starMass = value;
                  updateLamedStatistics();
                },
              });
              
              // Restore saved state
              lamedSimulationInstance.setState({
                starMass: spireResourceState.lamed.starMass || 10,
                sparkBank: getLamedSparkBank(),
                dragLevel: spireResourceState.lamed.dragLevel || 0,
                // Restore the stored star mass upgrade tier so UI and simulation stay in sync.
                upgrades: {
                  starMass: spireResourceState.lamed.upgrades?.starMass || 0,
                },
                stats: spireResourceState.lamed.stats || { totalAbsorptions: 0, totalMassGained: 0 },
              });

              lamedSimulationInstance.resize();
              const growthRateEl = document.getElementById('lamed-growth-rate');
              if (growthRateEl) {
                growthRateEl.textContent = `${lamedSimulationInstance.sparkSpawnRate.toFixed(2)} sparks/sec`;
              }
              
              // Hook up drag upgrade button
              lamedSpireUi.bindUpgradeButtons({
                onDragUpgrade: () => {
                  if (!lamedSimulationInstance || !lamedSimulationInstance.upgradeDrag()) {
                    return;
                  }
                  const state = lamedSimulationInstance.getState();
                  spireResourceState.lamed.dragLevel = state.dragLevel;
                  spireResourceState.lamed.starMass = state.starMass;
                  spireResourceState.lamed.upgrades = state.upgrades;
                  spireResourceState.lamed.stats = state.stats;

                  updateLamedStatistics();
                  spireMenuController.updateCounts();
                },
                onStarMassUpgrade: () => {
                  if (!lamedSimulationInstance || !lamedSimulationInstance.upgradeStarMass()) {
                    return;
                  }
                  const state = lamedSimulationInstance.getState();
                  spireResourceState.lamed.dragLevel = state.dragLevel;
                  spireResourceState.lamed.starMass = state.starMass;
                  spireResourceState.lamed.upgrades = state.upgrades;
                  spireResourceState.lamed.stats = state.stats;

                  updateLamedStatistics();
                  spireMenuController.updateCounts();
                },
              });

              spireMenuController.updateCounts();
              updateLamedStatistics();
              lamedSimulationInstance.start();
              // Ensure the gravity viewport adopts the new responsive dimensions.
              scheduleSpireResize();

              // Update statistics periodically and sync state
              setInterval(() => {
                if (lamedSimulationInstance && lamedSimulationInstance.running) {
                  updateLamedStatistics();

                  // Sync state back to persistence every second
                  const state = lamedSimulationInstance.getState();
                  spireResourceState.lamed.starMass = state.starMass;
                  spireResourceState.lamed.dragLevel = state.dragLevel;
                  // Copy upgrade tiers so offline banking tracks new power.
                  spireResourceState.lamed.upgrades = state.upgrades;
                  spireResourceState.lamed.stats = state.stats;
                  // Detect fresh spark absorptions so dependent spires unlock right away.
                  const currentLamedGlyphs = Math.max(
                    0,
                    Math.floor(state.stats?.totalAbsorptions || 0),
                  );
                  if (currentLamedGlyphs !== getTrackedLamedGlyphs()) {
                    setTrackedLamedGlyphs(currentLamedGlyphs);
                    spireMenuController.updateCounts();
                    updateStatusDisplays();
                    checkAndUnlockSpires();
                  }
                }
              }, 1000); // Update every second
            }
          } else {
            lamedSimulationInstance.resize();
            if (!lamedSimulationInstance.running) {
              lamedSimulationInstance.start();
            }
            updateLamedStatistics();
            scheduleSpireResize();
          }
        } else if (tabId === 'tsadi') {
          // Initialize and start Tsadi particle fusion simulation
          if (!tsadiSimulationInstance) {
            const tsadiCanvas = document.getElementById('tsadi-canvas');
            if (tsadiCanvas) {
              attachTsadiDeveloperSpamTarget(tsadiCanvas);
              ensureTsadiBankSeeded();
              tsadiSimulationInstance = new ParticleFusionSimulation({
                canvas: tsadiCanvas,
                initialParticleBank: getTsadiParticleBank(),
                initialBindingAgents: getTsadiBindingAgents(),
                initialDiscoveredMolecules: spireResourceState.tsadi?.discoveredMolecules || [],
                assignMoleculeName: (recipe) => tsadiMoleculeNameGenerator.assignName(recipe),
                samplePaletteGradient: samplePaletteGradient,
                onParticleBankChange: (value) => {
                  setTsadiParticleBank(value);
                },
                onBindingAgentStockChange: (value) => {
                  syncTsadiBindingAgents(value);
                },
                onTierChange: (tierInfo) => {
                  const resolvedTier =
                    typeof tierInfo === 'object' && tierInfo !== null
                      ? tierInfo.tier ?? 0
                      : Number.isFinite(Number(tierInfo))
                        ? Number(tierInfo)
                        : 0;
                  const tierEl = document.getElementById('tsadi-highest-tier');
                  if (tierEl) {
                    // Present both the Greek tier name and glyph for clarity in the UI.
                    const tierMetadata =
                      typeof tierInfo === 'object' && tierInfo !== null
                        ? tierInfo
                        : getGreekTierInfo(resolvedTier);
                    const fallbackTier = Number.isFinite(tierMetadata.displayTier)
                      ? tierMetadata.displayTier
                      : resolvedTier + 1;
                    const tierLabel = tierMetadata.displayName
                      || `${tierMetadata.name} (${tierMetadata.letter}) – Tier ${fallbackTier}`;
                    tierEl.textContent = tierLabel;
                  }
                  const previousHighest = Math.max(
                    0,
                    Math.floor(Number(spireResourceState.tsadi?.stats?.highestTier) || 0),
                  );
                  const nextHighest = Math.max(previousHighest, resolvedTier);
                  // Refresh the particle metrics note whenever the best tier advances.
                  updateTsadiStatusNote(nextHighest);
                  if (!spireResourceState.tsadi) {
                    spireResourceState.tsadi = {};
                  }
                  if (!spireResourceState.tsadi.stats) {
                    spireResourceState.tsadi.stats = {};
                  }
                  if (
                    !Number.isFinite(spireResourceState.tsadi.stats.highestTier) ||
                    nextHighest !== previousHighest
                  ) {
                    spireResourceState.tsadi.stats = {
                      ...(spireResourceState.tsadi.stats || {}),
                      highestTier: nextHighest,
                    };
                    updateBindingAgentDisplay();
                  }
                },
                onParticleCountChange: (count) => {
                  const countEl = document.getElementById('tsadi-particle-count');
                  if (countEl) {
                    countEl.textContent = `${count} particles`;
                  }
                },
                onGlyphChange: (glyphCount) => {
                  const normalizedGlyphs = Math.max(0, Math.floor(glyphCount || 0));
                  const glyphEl = document.getElementById('tsadi-reservoir');
                  if (glyphEl) {
                    glyphEl.textContent = `${normalizedGlyphs} Tsadi Glyphs`;
                  }
                  // Persist Tsadi glyph totals so unlock checks can react immediately.
                  const previousGlyphs = getTrackedTsadiGlyphs();
                  setTrackedTsadiGlyphs(normalizedGlyphs);
                  spireResourceState.tsadi.stats = {
                    ...(spireResourceState.tsadi.stats || {}),
                    totalParticles: normalizedGlyphs,
                    totalGlyphs: normalizedGlyphs,
                  };
                  spireMenuController.updateCounts();
                  if (normalizedGlyphs !== previousGlyphs) {
                    updateStatusDisplays();
                    checkAndUnlockSpires();
                  }
                  refreshCodexList();
                },
                onReset: () => {
                  console.log('Tsadi simulation reset after aleph explosion');
                },
                onMoleculeDiscovered: handleMoleculeDiscovery,
              });
              tsadiSimulationInstance.resize();
              tsadiSimulationInstance.setAvailableBindingAgents(getTsadiBindingAgents());
              tsadiSimulationInstance.beginPlacementFromStoredCounts?.();
              const generationRateEl = document.getElementById('tsadi-generation-rate');
              if (generationRateEl) {
                generationRateEl.textContent = `${tsadiSimulationInstance.spawnRate.toFixed(2)} particles/sec`;
              }
              spireMenuController.updateCounts();
              tsadiSimulationInstance.start();
              // Match the particle fusion canvas to the responsive layout constraints.
              scheduleSpireResize();

              if (!tsadiBindingUiInitialized) {
                initializeTsadiBindingUi();
                tsadiBindingUiInitialized = true;
              }
              updateBindingAgentDisplay();
              refreshCodexList();

              // Bind upgrade buttons
              bindTsadiUpgradeButtons();
            }
          } else {
            tsadiSimulationInstance.resize();
            tsadiSimulationInstance.beginPlacementFromStoredCounts?.();
            if (!tsadiSimulationInstance.running) {
              tsadiSimulationInstance.start();
            }
            scheduleSpireResize();
            updateBindingAgentDisplay();
            refreshCodexList();
          }

          // Update upgrade UI every time the tab is shown
          updateTsadiUpgradeUI();
        } else if (tabId === 'shin') {
          // Initialize Shin Spire UI when tab is first opened
          if (!shinSimulationInstance) {
            try {
              initializeShinUI();
            } catch (error) {
              console.error('Failed to initialize Shin UI:', error);
            }
          }
          // Update display with current state
          updateShinDisplay();
          scheduleSpireResize();
        } else if (tabId === 'kuf') {
          if (!kufUiInitialized) {
            try {
              initializeKufUI({
                onRunComplete: () => {
                  spireMenuController.updateCounts();
                },
              });
              kufUiInitialized = true;
              updateKufDisplay();
            } catch (error) {
              console.error('Failed to initialize Kuf Spire UI:', error);
            }
          } else {
            updateKufDisplay();
          }
        }

        if (tabId === 'powder' || tabId === 'fluid') {
          // Realign the basin after the tab becomes visible so layout metrics refresh.
          requestAnimationFrame(() => {
            if (powderSimulation && typeof powderSimulation.handleResize === 'function') {
              powderSimulation.handleResize();
              handlePowderViewTransformChange(powderSimulation.getViewTransform());
            }
          });
        }

        previousTabId = tabId;
      },
      onTowerTabActivated: () => {
        updateActiveLevelBanner();
      },
      playTabSelectSfx: () => {
        if (audioManager) {
          audioManager.playSfx('menuSelect');
        }
      },
    });

    initializeTabs();
    // Keep the responsive spire canvases aligned with viewport changes.
    window.addEventListener('resize', scheduleSpireResize);
    scheduleSpireResize();
    // Initialize the floating spire menu navigation
    spireMenuController.initialize();
    updateSpireTabVisibility();
    await initializeFieldNotesOverlay();
    bindCodexControls({
      setActiveTab,
      openFieldNotesOverlay,
      scrollPanelToElement,
      onOpenButtonReady: setFieldNotesOpenButton,
    });
    // Hydrate the diagnostics card once codex controls exist.
    initializePerformanceCodex();
    try {
      await ensureGameplayConfigLoaded();
    } catch (error) {
      console.error('Thero Idle failed to load gameplay data', error);
      if (playfieldElements.message) {
        playfieldElements.message.textContent =
          'Unable to load gameplay data—refresh the page to retry.';
      }
      await dismissStartupOverlay();
      return;
    }

    refreshDeveloperModeState();

    if (levelStoryScreen) {
      levelStoryScreen.preloadStories();
    }

    setMergingLogicUnlocked(getMergeProgressState().mergingLogicUnlocked);

    initializeLoadoutSlotPreference({ defaultSlots: getTowerLoadoutLimit() });

    const savedKufState = readStorageJson(KUF_STATE_STORAGE_KEY);
    initializeKufState(savedKufState || {});
    setTrackedKufGlyphs(Math.max(0, Math.floor(getKufGlyphs())));
    spireMenuController.updateCounts();
    onKufStateChange((event) => {
      if (event && event.type === 'result') {
        spireMenuController.updateCounts();
        // Keep Kuf unlock progression synchronized with fresh glyph payouts.
        const currentKufGlyphs = Math.max(0, Math.floor(getKufGlyphs()));
        if (currentKufGlyphs !== getTrackedKufGlyphs()) {
          setTrackedKufGlyphs(currentKufGlyphs);
          updateStatusDisplays();
          checkAndUnlockSpires();
        }
        commitAutoSave();
      }
    });

    // Initialize Shin Spire fractal system
    try {
      await loadFractalDefinitions();
      // Load saved state from storage
      const savedShinState = readStorageJson(SHIN_STATE_STORAGE_KEY);
      initializeShinState(savedShinState || {});
      setTrackedShinGlyphs(Math.max(0, Math.floor(getShinGlyphs())));
      setShinUIUpdateCallback(() => {
        updateShinDisplay();
        // React to manual Iteron allocations that push Shin glyph totals forward.
        const currentShinGlyphs = Math.max(0, Math.floor(getShinGlyphs()));
        if (currentShinGlyphs !== getTrackedShinGlyphs()) {
          setTrackedShinGlyphs(currentShinGlyphs);
          spireMenuController.updateCounts();
          updateStatusDisplays();
          checkAndUnlockSpires();
        } else {
          spireMenuController.updateCounts();
        }
        commitAutoSave();
      });
    } catch (error) {
      console.error('Failed to initialize Shin Spire system:', error);
    }

    updateSpireTabVisibility();
    checkAndUnlockSpires();
    spireMenuController.updateCounts();

    enemyCodexElements.list = document.getElementById('enemy-codex-list');
    enemyCodexElements.empty = document.getElementById('enemy-codex-empty');
    enemyCodexElements.note = document.getElementById('enemy-codex-note');
    initializeEnemyCodexOverlay();
    bindDeveloperModeToggle();
    bindDeveloperControls();
    if (audioManager) {
      const activationElements = [
        playfieldElements.startButton,
        playfieldElements.speedButton,
        playfieldElements.autoAnchorButton,
        playfieldElements.autoWaveCheckbox,
        playfieldElements.canvas,
        ...playfieldElements.slots,
      ].filter(Boolean);
      audioManager.registerActivationElements(activationElements);
    }

    if (leaveLevelBtn) {
      leaveLevelBtn.disabled = true;
    }

    if (playfieldElements.canvas && playfieldElements.container) {
      playfield = new SimplePlayfield({
        canvas: playfieldElements.canvas,
        container: playfieldElements.container,
        messageEl: playfieldElements.message,
        waveEl: playfieldElements.wave,
        healthEl: playfieldElements.health,
        energyEl: playfieldElements.energy,
        progressEl: playfieldElements.progress,
        startButton: playfieldElements.startButton,
        speedButton: playfieldElements.speedButton,
        autoAnchorButton: playfieldElements.autoAnchorButton,
        autoWaveCheckbox: playfieldElements.autoWaveCheckbox,
        slotButtons: playfieldElements.slots,
        audioManager,
        onVictory: handlePlayfieldVictory,
        onDefeat: handlePlayfieldDefeat,
        onCombatStart: handlePlayfieldCombatStart,
      });
      setTowersPlayfield(playfield);
      playfield.draw();
      if (playfieldMenuController) {
        playfieldMenuController.syncStatsPanelVisibility();
      }
    }

    refreshTabMusic({ restart: true });

    bindOfflineOverlayElements();
    loadPersistentState();
    // Load tutorial state after persistent state is loaded
    loadTutorialState();
    // Check if tutorial should be completed based on level progress
    checkTutorialCompletion(isLevelCompleted);
    // Initialize tab lock states based on tutorial completion
    initializeTabLockStates(isTutorialCompleted());
    // Unlock tabs based on saved state
    if (isTowersTabUnlocked()) {
      unlockTowersTab();
    }
    if (isCodexUnlocked()) {
      unlockCodexTab();
    }
    if (isAchievementsUnlocked()) {
      unlockAchievementsTab();
    }
    enforceFluidStudyDisabledState();
    // Reapply developer mode boosts after progression restore so level unlocks stay in sync.
    refreshDeveloperModeState();
    reconcileGlyphCurrencyFromState();

    bindStatusElements();
    bindPowderControls();
    bindFluidControls();
    bindFluidCameraModeToggle();
    syncFluidCameraModeUi();
    if (betHappinessSystem) {
      betHappinessSystem.bindDisplayElements(fluidElements);
      betHappinessSystem.updateDisplay(fluidElements);
    }
    await ensureTerrariumSurfacesReady();
    ensureFluidTerrariumCreatures();
    ensureFluidTerrariumGrass();
    ensureFluidTerrariumCrystal();
    ensureFluidTerrariumTrees();
    ensureFluidTerrariumSkyCycle();
    ensureFluidTerrariumShrooms();
    ensurePowderBasinResizeObserver();
    bindSpireClickIncome();
    await applyPowderSimulationMode(powderState.simulationMode);
    initializeEquipmentState();
    initializeCraftingOverlay({
      revealOverlay,
      scheduleOverlayHide,
      onRequestInventoryRefresh: updateMoteGemInventoryDisplay,
    });
    bindAchievements();
    updatePowderLogDisplay();
    updateResourceRates();
    updatePowderDisplay();
    // Start resource ticker for idle resources (iterons, motes, etc.) since no level is active initially
    resourceState.running = true;
    ensureResourceTicker();
    // Begin the recurring autosave cadence once the core systems are initialized.
    startAutoSaveLoop();

    await dismissStartupOverlay();
    checkOfflineRewards();
    markLastActive();

    injectTowerCardPreviews();
    simplifyTowerCards();
    annotateTowerCardsWithCost();
    synchronizeTowerCardMasterEquations();
    initializeTowerEquipmentInterface();
    updateTowerCardVisibility();
    initializeTowerTreeMap({
      toggleButton: document.getElementById('tower-tree-map-toggle'),
      mapContainer: document.getElementById('tower-tree-map'),
      cardGrid: document.getElementById('tower-card-grid'),
    });
    refreshTowerTreeMap();
    initializeTowerSelection();
    bindTowerCardUpgradeInteractions();
    syncLoadoutToPlayfield();
    renderEnemyCodex();

    buildLevelCards();
    updateLevelCards();
    variableLibraryController.bindVariableLibrary();
    bindUpgradeMatrix();
    bindLeaveLevelButton();
    initializeManualDropHandlers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  bindPageLifecycleEvents({
    commitAutoSave,
    markLastActive,
    suppressAudioPlayback,
    releaseAudioSuppression,
    refreshTabMusic,
    checkOfflineRewards,
    audioManager,
  });

  document.addEventListener('keydown', (event) => {
    const overlay = levelOverlayController?.getOverlayElement
      ? levelOverlayController.getOverlayElement()
      : null;
    const towerUpgradeOverlay = getTowerUpgradeOverlayElement();
    if (towerUpgradeOverlay && towerUpgradeOverlay.classList.contains('active')) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeTowerUpgradeOverlay();
        return;
      }
      if ((event.key === 'Enter' || event.key === ' ') && event.target === towerUpgradeOverlay) {
        event.preventDefault();
        closeTowerUpgradeOverlay();
        return;
      }
    }

    if (
      handleUpgradeMatrixKeydown(event, {
        isLevelOverlayActive: Boolean(overlay && overlay.classList.contains('active')),
      })
    ) {
      return;
    }

    if (variableLibraryController.handleKeydown(event)) {
      return;
    }

    if (!overlay) return;
    const hidden = overlay.getAttribute('aria-hidden');
    const isActive = overlay.classList.contains('active');
    if (hidden !== 'false' && !isActive) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      cancelPendingLevel();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      confirmPendingLevel();
    }
  });

  // Expose a helper for upgrade scripts to toggle mote gem auto collection when unlocked.
  window.unlockMoteGemAutoCollector = () => {
    setMoteGemAutoCollectUnlocked(true);
  };

  const upgradeNamespace =
    (window.theroIdleUpgrades = window.theroIdleUpgrades || window.glyphDefenseUpgrades || {});
  upgradeNamespace.alephChain = {
    // Surface the current Aleph chain upgrades so the Codex and dev tools can inspect live values.
    get: () => getAlephChainUpgrades(),
    // Accept upgrade adjustments from external scripts while keeping the playfield synchronized.
    set: (updates) => updateAlephChainUpgrades(updates, { playfield }),
  };

  window.glyphDefenseUpgrades = upgradeNamespace;

})();
