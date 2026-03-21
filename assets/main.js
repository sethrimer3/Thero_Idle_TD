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
  applyDamageNumberMode,
  bindDamageNumberToggle,
  bindDamageNumberModeToggle,
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
  getPreferredGraphicsMode,
  bindTrackRenderModeButton,
  initializeTrackRenderMode,
  initializeLoadoutSlotPreference,
  setLoadoutSlotChangeHandler,
  bindFrameRateLimitSlider,
  initializeFrameRateLimitPreference,
  applyFrameRateLimitPreference,
  bindFpsCounterToggle,
  initializeFpsCounterPreference,
  applyFpsCounterPreference,
  bindEnemyParticlesToggle,
  initializeEnemyParticlesPreference,
  areEnemyParticlesEnabled,
  bindEdgeCrystalsToggle,
  initializeEdgeCrystalsPreference,
  bindCrystalBackgroundSpritesToggle,
  initializeCrystalBackgroundSpritesPreference,
  bindBackgroundParticlesToggle,
  initializeBackgroundParticlesPreference,
  bindPlayfieldTrackTypeButton,
  bindTowerLoadoutToggleSideButton,
  initializeTowerLoadoutToggleSidePreference,
  bindSpireOptionsPlacementButton,
  initializeSpireOptionsPlacementPreference,
  bindAutoGraphicsToggle,
  initializeAutoGraphicsPreference,
  bindInvertCarouselDragToggle,
  initializeInvertCarouselDragPreference,
} from './preferences.js';
import { SimplePlayfield, configurePlayfieldSystem } from './playfield.js';
import { setDevLayerVisible, getDevLayerDefault, resetDevLayerFlags } from './playfield/render/CanvasRenderer.js';
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
// Bet Spire Terrarium lifecycle: slimes, birds, trees, shrooms, sky cycle, celestial bodies.
import { createBetTerrariumController } from './betTerrariumController.js';
// Aleph tier-transition animation: wall-exit, golden glyph collection, wall-enter, palette scaling.
import { createAlephTierTransitionController } from './alephTierTransitionController.js';
import { createResourceHud } from './resourceHud.js';
import { initBetSpireRender, stopBetSpireRender, resumeBetSpireRender, getBetSpireRenderInstance } from './betSpireRender.js';
import { initParticleInventoryDisplay } from './betParticleInventory.js';
import { createBetSpireUpgradeMenu } from './betSpireUpgradeMenu.js';
import { createTsadiUpgradeUi } from './tsadiUpgradeUi.js';
import { createTsadiBindingUi } from './tsadiBindingUi.js';
import { createSpireTabVisibilityManager } from './spireTabVisibility.js';
import { createIdleLevelRunManager } from './idleLevelRunManager.js';
import { createSpireResourceState } from './state/spireResourceState.js';
import { createPowderStateContext } from './powder/powderState.js';
import { createTsadiMoleculeNameGenerator, TSADI_MOLECULE_LEXICON } from './tsadiMoleculeNameGenerator.js';
import { createSpireResourceBanks } from './spireResourceBanks.js';
import {
  applyBetIdleParticles,
  applyLamedIdleStars,
  applyTsadiIdleParticles,
} from './spireIdleApplication.js';
// Alpha tower sprite tint cache builder for palette-synced shot particles.
import { refreshAlphaShotSpritePaletteCache } from '../scripts/features/towers/alphaTower.js';
// Beta tower sprite tint cache builder for palette-synced shot particles.
import { refreshBetaShotSpritePaletteCache } from '../scripts/features/towers/betaTower.js';
import { refreshGammaShotSpritePaletteCache } from '../scripts/features/towers/gammaTower.js';
// Delta tower sprite tint cache builder for palette-synced ship sprites.
import { refreshDeltaShipSpritePaletteCache } from '../scripts/features/towers/deltaTower.js';
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
  refreshEnemyAlmanac,
} from './shinUI.js';
// Cardinal Warden reverse danmaku game for Shin Spire.
import {
  initializeCardinalWardenUI,
  resizeCardinalCanvas,
  stopCardinalSimulation,
  startCardinalSimulation,
  isCardinalSimulationRunning,
  getCardinalSimulation,
  getCardinalHighestWave,
  getCardinalHighScore,
} from './cardinalWardenUI.js';
// Shin Grapheme Codex UI for displaying grapheme information.
import { initializeShinGraphemeCodex } from './shinGraphemeCodexUI.js';
// Shin Spire ambient substrate crystalline background effect.
import {
  startShinShapeBackground,
  stopShinShapeBackground,
  resizeShinShapeBackground,
} from './shinShapeBackground.js';
// Tsadi Spire ambient vermiculate worm-line background effect.
import {
  startTsadiVermiculateBackground,
  stopTsadiVermiculateBackground,
  resizeTsadiVermiculateBackground,
} from './tsadiVermiculateBackground.js';
import {
  initializeKufState,
  getKufStateSnapshot,
  getKufGlyphs,
  onKufStateChange,
  setKufTotalShards,
  resetKufState,
  setKufGlyphs,
} from './kufState.js';
import { initializeKufUI, updateKufDisplay, stopKufSimulation, resumeKufSimulation } from './kufUI.js';
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
  stopAllAchievementSparkles,
  notifyAchievementsTabVisibilityChange,
} from './achievementsTab.js';
import {
  configureBoostsSection,
  initializeBoostsSection,
} from './boostsSection.js';
import {
  loadMonetizationState,
} from './state/monetizationState.js';
import {
  cognitiveRealmState,
  isCognitiveRealmUnlocked,
  isCognitiveRealmLocked,
  unlockCognitiveRealm,
  unlockCognitiveRealmRendering,
  updateTerritoriesForLevel,
  serializeCognitiveRealmState,
  deserializeCognitiveRealmState,
} from './state/cognitiveRealmState.js';
import {
  initializeCognitiveRealmMap,
  stopCognitiveRealmMap,
  showCognitiveRealmMap,
  hideCognitiveRealmMap,
  updateCognitiveRealmLockState,
  resetCognitiveRealmView,
} from './cognitiveRealmMap.js';
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
  refreshTowerCardBackgroundAnimations,
  simplifyTowerCards,
  annotateTowerCardsWithCost,
  stageTowerCardEntrance,
  initializeTowerSelection,
  initializeTowerVisibilityToggle,
  initializeTowerElementDebugControls,
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
  refreshTowerIconPalettes,
  closeLoadoutWheel,
} from './towersTab.js';
import towers from './data/towers/index.js'; // Modular tower definitions sourced from dedicated files.
import { initializeEquipmentState, EQUIPMENT_STORAGE_KEY } from './equipment.js';
import { initializeTowerTreeMap, refreshTowerTreeMap } from './towerTreeMap.js';
// Bring in drag-scroll support so hidden scrollbars remain usable.
import { enableDragScroll } from './dragScroll.js';
// Particle-based visual scrollbar for reliable touch scrolling on Android.
import { initParticleScrollbar, notifyParticleScrollbarTabChanged } from './particleScrollbar.js';
import { createLevelEditorController } from './levelEditor.js';
import { createLevelPreviewRenderer, getPreviewPointsForLevel } from './levelPreviewRenderer.js';
import { createLevelOverlayController } from './levelOverlayController.js';
import { createLevelGridController } from './levelGridController.js';
import { createLevelStoryScreen } from './levelStoryScreen.js';
import { createSpireFloatingMenuController } from './spireFloatingMenu.js';
import { createSpireGemMenuController } from './spireGemMenu.js';
import { createPlayfieldMenuController } from './playfieldMenu.js';
import { createManualDropController } from './manualDropController.js';
import { bindPageLifecycleEvents } from './pageLifecycle.js';
import { bindCollapsibleMenu } from './settingsMenuController.js';
import { createVariableLibraryController } from './variableLibraryController.js';
import { createUpgradeMatrixOverlay } from './upgradeMatrixOverlay.js';
import { createLevelSummaryHelpers } from './levelSummary.js';
import { initializePlayfieldBackgroundVideo } from './playfieldBackgroundVideo.js';
import { createLamedSpireUi } from './lamedSpireUi.js';
import {
  bindLamedSpireOptions,
  setLamedSimulationGetter,
  initializeLamedSpirePreferences,
} from './lamedSpirePreferences.js';
import {
  applyFluidVisualSettings,
  bindFluidSpireOptions,
  initializeFluidSpirePreferences,
  setFluidTerrariumGetters,
} from './fluidSpirePreferences.js';
import {
  bindBetSpireParticleOptions,
  initializeBetSpireParticlePreferences,
  setBetSpireRenderGetter,
  updateBetSpireDebugControlsVisibility,
} from './betSpireParticlePreferences.js';
import {
  applyPowderVisualSettings,
  bindPowderSpireOptions,
  initializePowderSpirePreferences,
  setPowderCameraModeHandler,
  setPowderSimulationGetter,
  updatePowderRenderSizeControlsVisibility,
} from './powderSpirePreferences.js';
import {
  bindAchievementsTerrariumOptions,
  initializeAchievementsTerrariumPreferences,
} from './achievementsTerrariumPreferences.js';
import {
  bindTsadiSpireOptions,
  initializeTsadiSpirePreferences,
  setTsadiSimulationGetter,
} from './tsadiSpirePreferences.js';
import { bindSpireOptionsDropdown, closeAllSpireDropdowns } from './spireOptionsDropdowns.js';
import { bindKufSpireOptions, initializeKufSpirePreferences } from './kufSpirePreferences.js';
import { bindShinSpireOptions, initializeShinSpirePreferences, setShinSimulationGetter } from './shinSpirePreferences.js';
import { bindCognitiveRealmOptions, initializeCognitiveRealmPreferences } from './cognitiveRealmPreferences.js';
import { bindPlayfieldOptions, initializePlayfieldPreferences } from './playfield/playfieldPreferences.js';
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
  GEM_DEFINITIONS,
  rollGemDropDefinition,
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
import { createIdleResourceBankController } from './idleResourceBankController.js';
import { createPlayfieldLayoutController } from './playfieldLayoutController.js';
import { createSpireCameraController } from './spireCameraController.js';

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
  let activeLevelIsInteractive = false;
  let playfieldMenuController = null;
  let audioManager = null;

  // ── Playfield layout controller (extracted from main.js) ──────────────
  const layoutCtrl = createPlayfieldLayoutController({
    getPlayfield: () => playfield,
    getActiveLevelId: () => activeLevelId,
    getActiveLevelIsInteractive: () => activeLevelIsInteractive,
    getPlayfieldMenuController: () => playfieldMenuController,
  });

  // Thin delegates so existing call sites continue to work unchanged.
  const syncPlayfieldSettingsVisibility = layoutCtrl.syncPlayfieldSettingsVisibility;
  const togglePlayfieldFullscreen = layoutCtrl.togglePlayfieldFullscreen;
  const syncPlayfieldFullscreenState = layoutCtrl.syncPlayfieldFullscreenState;
  const updatePlayfieldFullscreenButton = layoutCtrl.updatePlayfieldFullscreenButton;
  const updateLayoutVisibility = layoutCtrl.updateLayoutVisibility;


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

  // Developer layer toggles – bind checkboxes to setDevLayerVisible and update state labels.
  const devLayerToggleConfigs = [
    { id: 'dev-layer-background-toggle', stateId: 'dev-layer-background-state', layer: 'background' },
    { id: 'dev-layer-track-toggle', stateId: 'dev-layer-track-state', layer: 'track' },
    // Gate-level debug toggles let developer mode isolate Mind Gate sub-effects independently of the whole track layer.
    { id: 'dev-layer-mind-gate-background-toggle', stateId: 'dev-layer-mind-gate-background-state', layer: 'mindGateBackground' },
    { id: 'dev-layer-mind-gate-wave-toggle', stateId: 'dev-layer-mind-gate-wave-state', layer: 'mindGateWave' },
    { id: 'dev-layer-mind-gate-particles-toggle', stateId: 'dev-layer-mind-gate-particles-state', layer: 'mindGateParticles' },
    { id: 'dev-layer-mind-gate-symbol-toggle', stateId: 'dev-layer-mind-gate-symbol-state', layer: 'mindGateSymbol' },
    // Shadow Gate toggles mirror Mind Gate controls for one-to-one visual profiling.
    { id: 'dev-layer-shadow-gate-background-toggle', stateId: 'dev-layer-shadow-gate-background-state', layer: 'shadowGateBackground' },
    { id: 'dev-layer-shadow-gate-particles-toggle', stateId: 'dev-layer-shadow-gate-particles-state', layer: 'shadowGateParticles' },
    { id: 'dev-layer-shadow-gate-symbol-toggle', stateId: 'dev-layer-shadow-gate-symbol-state', layer: 'shadowGateSymbol' },
    { id: 'dev-layer-sunlight-toggle', stateId: 'dev-layer-sunlight-state', layer: 'sunlight' },
    { id: 'dev-layer-sunlight-v2-toggle', stateId: 'dev-layer-sunlight-v2-state', layer: 'sunlightV2' },
    { id: 'dev-layer-towers-toggle', stateId: 'dev-layer-towers-state', layer: 'towers' },
    { id: 'dev-layer-enemies-toggle', stateId: 'dev-layer-enemies-state', layer: 'enemies' },
    { id: 'dev-layer-projectiles-toggle', stateId: 'dev-layer-projectiles-state', layer: 'projectiles' },
    { id: 'dev-layer-ui-overlay-toggle', stateId: 'dev-layer-ui-overlay-state', layer: 'uiOverlay' },
  ];

  function bindDevLayerToggles() {
    devLayerToggleConfigs.forEach(({ id, stateId, layer }) => {
      const toggle = document.getElementById(id);
      const stateLabel = document.getElementById(stateId);
      if (!toggle) {
        return;
      }
      toggle.addEventListener('change', (event) => {
        const visible = Boolean(event?.target?.checked);
        setDevLayerVisible(layer, visible);
        if (stateLabel) {
          stateLabel.textContent = visible ? 'On' : 'Off';
        }
        // Trigger an immediate redraw so the change is visible at once.
        if (typeof playfield?.draw === 'function') {
          playfield.draw();
        }
      });
    });
  }

  function updatePlayfieldDevLayerTogglesVisibility() {
    const section = document.getElementById('playfield-dev-layers-section');
    if (!section) {
      return;
    }
    const active = Boolean(developerModeActive);
    section.hidden = !active;
    section.setAttribute('aria-hidden', active ? 'false' : 'true');
    // Reset all layer flags to visible when developer mode is turned off so the game renders normally.
    if (!active) {
      resetDevLayerFlags();
      devLayerToggleConfigs.forEach(({ id, stateId, layer }) => {
        const toggle = document.getElementById(id);
        const stateLabel = document.getElementById(stateId);
        // Layers that default to off (e.g. sunlightV2) stay unchecked after reset.
        const defaultOn = getDevLayerDefault(layer);
        if (toggle) {
          toggle.checked = defaultOn;
        }
        if (stateLabel) {
          stateLabel.textContent = defaultOn ? 'On' : 'Off';
        }
      });
    }
  }

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
    getStoryEntries: buildSeenStoryEntries,
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

  // Fluid simulation has been disabled to prevent creation errors
  const FLUID_STUDY_ENABLED = false;

  const FLUID_UNLOCK_BASE_RESERVOIR_DROPS = 100; // Seed the Bet Spire Terrarium with a base reservoir of Scintillae upon unlock.

  const {
    powderConfig,
    powderState,
    fluidElements,
    achievementsTerrariumElements,
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

  // ── Bet Spire Terrarium controller (extracted from main.js) ──────────
  const betTerrariumCtrl = createBetTerrariumController({
    FLUID_STUDY_ENABLED,
    powderState,
    fluidElements,
    achievementsTerrariumElements,
    BET_CAVE_SPAWN_ZONES,
    schedulePowderBasinSave,
    getSetFluidCameraMode: () => setFluidCameraMode,
    getActiveTabId,
    setActiveTab,
    updateFluidTabAvailability,
    updateSpireTabVisibility,
    getUpdatePowderDisplay: () => updatePowderDisplay,
    getSpendFluidSerendipity: () => spendFluidSerendipity,
    getGetCurrentFluidDropBank: () => getCurrentFluidDropBank,
    setFluidTerrariumGetters,
  });

  // Thin delegates so existing call sites in main.js continue to work unchanged.
  const enforceFluidStudyDisabledState = betTerrariumCtrl.enforceFluidStudyDisabledState;
  const ensureTerrariumSurfacesReady = betTerrariumCtrl.ensureTerrariumSurfacesReady;
  const ensureFluidTerrariumCreatures = betTerrariumCtrl.ensureFluidTerrariumCreatures;
  const ensureFluidTerrariumBirds = betTerrariumCtrl.ensureFluidTerrariumBirds;
  const ensureFluidTerrariumGrass = betTerrariumCtrl.ensureFluidTerrariumGrass;
  const ensureFluidTerrariumWater = betTerrariumCtrl.ensureFluidTerrariumWater;
  const ensureFluidTerrariumCrystal = betTerrariumCtrl.ensureFluidTerrariumCrystal;
  const ensureFluidTerrariumTrees = betTerrariumCtrl.ensureFluidTerrariumTrees;
  const ensureFluidTerrariumSkyCycle = betTerrariumCtrl.ensureFluidTerrariumSkyCycle;
  const ensureFluidTerrariumCelestialBodies = betTerrariumCtrl.ensureFluidTerrariumCelestialBodies;
  const ensureFluidTerrariumShrooms = betTerrariumCtrl.ensureFluidTerrariumShrooms;
  const ensureFluidTerrariumItemsDropdown = betTerrariumCtrl.ensureFluidTerrariumItemsDropdown;
  const unlockTerrariumCelestialBody = betTerrariumCtrl.unlockTerrariumCelestialBody;
  const addTerrariumCreature = betTerrariumCtrl.addTerrariumCreature;
  const addTerrariumItem = betTerrariumCtrl.addTerrariumItem;
  const getBetTerrariumCreatureCount = betTerrariumCtrl.getBetTerrariumCreatureCount;

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
  let spireGemMenuController = null;

  const {
    ensureLamedBankSeeded,
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

  // ── Idle resource bank controller (extracted from main.js) ────────────
  const idleBankCtrl = createIdleResourceBankController({
    powderState,
    getSandSimulation: () => sandSimulation,
    getPowderSimulation: () => powderSimulation,
    getFluidSimulation: () => fluidSimulationInstance,
    schedulePowderBasinSave,
    updateStatusDisplays,
  });

  // Thin delegates so existing call sites continue to work unchanged.
  const getCurrentIdleMoteBank = idleBankCtrl.getCurrentIdleMoteBank;
  const getCurrentMoteDispenseRate = idleBankCtrl.getCurrentMoteDispenseRate;
  const getCurrentFluidDropBank = idleBankCtrl.getCurrentFluidDropBank;
  const spendFluidSerendipity = idleBankCtrl.spendFluidSerendipity;
  const getCurrentFluidDispenseRate = idleBankCtrl.getCurrentFluidDispenseRate;
  const addIdleMoteBank = idleBankCtrl.addIdleMoteBank;
  const getLamedSparkBank = idleBankCtrl.getLamedSparkBank;
  const setLamedSparkBank = idleBankCtrl.setLamedSparkBank;
  const getTsadiParticleBank = idleBankCtrl.getTsadiParticleBank;
  const setTsadiParticleBank = idleBankCtrl.setTsadiParticleBank;
  const flushPendingMoteDrops = idleBankCtrl.flushPendingMoteDrops;

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

  // Shared gem selector that plugs into every spire render.
  spireGemMenuController = createSpireGemMenuController({
    documentRef: typeof document !== 'undefined' ? document : null,
    moteGemInventory: moteGemState?.inventory,
    gemDefinitions: GEM_DEFINITIONS,
  });

  // Quick lookup for gem definitions so gem consumption can reference mote size and palette data.
  const gemDefinitionLookup = new Map((GEM_DEFINITIONS || []).map((gem) => [gem.id, gem]));

  const lamedSpireUi = createLamedSpireUi({
    formatWholeNumber,
    formatGameNumber,
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

  setTrackedLamedGlyphs(spireResourceState.lamed?.stats?.starMilestoneReached || 0);
  setTrackedTsadiGlyphs(
    Number.isFinite(spireResourceState.tsadi?.stats?.totalGlyphs)
      ? spireResourceState.tsadi.stats.totalGlyphs
      : spireResourceState.tsadi?.stats?.totalParticles || 0,
  );
  setTrackedShinGlyphs(getShinGlyphs());
  setTrackedKufGlyphs(getKufGlyphs());

  const {
    bindFluidControls,
    bindAchievementsTerrariumControls,
    applyMindGatePaletteToDom,
    updateMoteGemInventoryDisplay: renderMoteGemInventoryDisplay,
    updatePowderGlyphColumns,
    updateFluidGlyphColumns,
  } = createPowderUiDomHelpers({
    getPowderElements,
    fluidElements,
    achievementsTerrariumElements,
    powderGlyphColumns,
    fluidGlyphColumns,
    moteGemState,
    formatWholeNumber,
    formatGameNumber,
    getMoteGemColor,
    getGemSpriteAssetPath,
  });

  const updateMoteGemInventoryDisplay = () => {
    renderMoteGemInventoryDisplay();
    spireGemMenuController?.updateCounts();
  };

  /**
   * Decrement a gem from the shared inventory and return its definition so spire consumers can react.
   * @param {string} gemId - Unique gem identifier.
   * @returns {Object|null} Gem definition when successfully consumed.
   */
  function consumeGemFromInventory(gemId) {
    if (!gemId) {
      return null;
    }
    const record = moteGemState.inventory.get(gemId);
    if (!record || !Number.isFinite(record.count) || record.count <= 0) {
      return null;
    }
    const nextCount = Math.max(0, record.count - 1);
    moteGemState.inventory.set(gemId, { ...record, count: nextCount });
    updateMoteGemInventoryDisplay();
    return gemDefinitionLookup.get(gemId) || null;
  }

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
  let tsadiOptionsBound = false;
  let shinSimulationInstance = null;
  let tsadiBindingUiInitialized = false;
  let kufUiInitialized = false;
  let cardinalWardenInitialized = false;
  let pendingSpireResizeFrame = null;
  let previousTabId = getActiveTabId();

  // Surface the active powder simulation so Aleph visual preferences can reapply on swaps.
  setPowderSimulationGetter(() => powderSimulation);

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
    getIteronBank,
    getKufGlyphs,
    setKufGlyphs,
    onTsadiBindingAgentsChange: syncTsadiBindingAgents,
  });

  setPowderElements(powderElements);

  function initializeSpireGemMenus() {
    // Gem selectors have been removed from all spire renders per user request.
    // This function is kept for backward compatibility but does not register any menus.
    return;
  }

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
    updateBetSpireDebugControlsVisibility,
    updatePowderRenderSizeControlsVisibility,
    getCurrentIdleMoteBank,
    getCurrentMoteDispenseRate,
    updatePlayfieldDevLayerTogglesVisibility,
  });

  configureEnemyHandlers({ queueMoteDrop, recordPowderEvent });

  // Helper function to apply idle time for a specific spire (for ad boosts)
  function applyIdleTimeToSpire(spireId, idleTimeSeconds) {
    const idleTimeMs = idleTimeSeconds * 1000;
    // Call notifyIdleTime which will distribute resources to all unlocked spires
    notifyIdleTime(idleTimeMs);
    // Record the boost event
    recordPowderEvent('boost-applied', {
      spireId,
      idleTimeSeconds,
    });
    // Update displays
    updateResourceRates();
    updatePowderDisplay();
  }

  // Helper function to grant random gems (for ad boosts)
  function grantRandomGems(count) {
    let gemsGranted = 0;
    // Roll for each gem according to drop chances
    for (let i = 0; i < count; i++) {
      const gem = rollGemDropDefinition({ hp: 1000 }); // Use moderate HP for balanced distribution
      if (gem) {
        const record = moteGemState.inventory.get(gem.id) || { label: gem.name, total: 0, count: 0 };
        record.total += gem.moteSize;
        record.count = (record.count || 0) + 1;
        record.label = gem.name || record.label;
        moteGemState.inventory.set(gem.id, record);
        gemsGranted++;
      }
    }
    // Update gem inventory display
    updateMoteGemInventoryDisplay();
    // Record the boost event
    recordPowderEvent('boost-gems-granted', {
      count: gemsGranted,
    });
    return gemsGranted;
  }

  // Configure the boosts section with dependencies
  configureBoostsSection({
    applyIdleTimeToSpire,
    grantRandomGems,
  });

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
    resolveAlephTierProgress,
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

  // ── Spire camera controller (extracted from main.js) ──────────────────
  const cameraCtrl = createSpireCameraController({
    powderState,
    getPowderSimulation: () => powderSimulation,
    getFluidSimulation: () => fluidSimulationInstance,
    getSandSimulation: () => sandSimulation,
    getFluidElements: () => fluidElements,
    getFluidTerrariumTrees: () => null,
    handlePowderViewTransformChange,
    handlePowderWallMetricsChange,
    schedulePowderBasinSave,
  });

  // Thin delegates so existing call sites continue to work unchanged.
  const resetPowderCameraTransform = cameraCtrl.resetPowderCameraTransform;
  const setPowderCameraMode = cameraCtrl.setPowderCameraMode;
  const resetFluidCameraTransform = cameraCtrl.resetFluidCameraTransform;
  const syncFluidCameraModeUi = cameraCtrl.syncFluidCameraModeUi;
  const setFluidCameraMode = cameraCtrl.setFluidCameraMode;
  const bindFluidCameraModeToggle = cameraCtrl.bindFluidCameraModeToggle;
  const refreshPowderWallDecorations = cameraCtrl.refreshPowderWallDecorations;

  // Hook the Aleph spire settings toggle into the camera control handler.
  setPowderCameraModeHandler((enabled) => {
    setPowderCameraMode(enabled);
  });

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

  const { initializeManualDropHandlers } = createManualDropController({
    getActiveTabId,
    getSandSimulation: () => sandSimulation,
    getFluidSimulation: () => fluidSimulationInstance,
    getLamedSimulation: () => lamedSimulationInstance,
    getTsadiSimulation: () => tsadiSimulationInstance,
    getSelectedGem: (spireId) => spireGemMenuController?.getSelection(spireId),
    consumeGem: consumeGemFromInventory,
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
    refreshEnemyAlmanac,
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
    updateBetSpireDebugControlsVisibility,
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

  // ── Level Grid Controller ───────────────────────────────────────────
  // Centralizes the DOM-heavy level card grid: build, update, set/campaign
  // expansion, lock state management, and the active-level banner. Delegates
  // extracted from main.js to reduce cognitive load and line count.
  const levelGridCtrl = createLevelGridController({
    levelBlueprints,
    levelState,
    levelConfigs,
    levelLookup,
    levelSetEntries,
    idleLevelRuns,
    isLevelUnlocked,
    isStoryOnlyLevel,
    isInteractiveLevel,
    isSecretLevelId,
    getPreviewPointsForLevel,
    clampNormalizedCoordinate,
    formatWholeNumber,
    getLevelSummary,
    describeLevelLastResult,
    triggerButtonRipple,
    getDeveloperModeActive: () => developerModeActive,
    getActiveLevelId: () => activeLevelId,
    getGameStats: () => gameStats,
    // Read current progression data through getters because levels.js swaps these exports after config load.
    getLevelBlueprints: () => levelBlueprints,
    getLevelLookup: () => levelLookup,
    onLevelSelect: (level) => handleLevelSelection(level),
    onMenuSelectSfx: () => {
      if (audioManager) {
        audioManager.playSfx('menuSelect');
      }
    },
    onStoryCampaignExpand: () => {
      if (!isCognitiveRealmUnlocked()) {
        unlockCognitiveRealm();
        updateCognitiveRealmVisibility();
      }
    },
  });
  levelGridCtrl.attachDocumentListeners();

  // Thin delegates that forward to the level grid controller so hoisted function names
  // remain available to callback registrations earlier in the IIFE (e.g. configureDeveloperControls,
  // createIdleLevelRunManager). Call these wrappers—not the controller directly—when passing
  // function references so the signatures match what external modules expect.
  function buildLevelCards() { levelGridCtrl.buildLevelCards(); }
  function updateLevelCards() { levelGridCtrl.updateLevelCards(); }
  function updateActiveLevelBanner() { levelGridCtrl.updateActiveLevelBanner(); }
  function updateLevelSetLocks() { levelGridCtrl.updateLevelSetLocks(); }

  function updateLamedStatistics() {
    lamedSpireUi.updateStatistics(lamedSimulationInstance);
  }

  /**
   * Preserve the active Lamed gravity simulation state so tab switches or reloads can resume seamlessly.
   */
  function captureLamedSimulationSnapshot() {
    if (!lamedSimulationInstance || typeof lamedSimulationInstance.exportSnapshot !== 'function') {
      return;
    }
    const snapshot = lamedSimulationInstance.exportSnapshot();
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }
    spireResourceState.lamed.simulationSnapshot = snapshot;
    if (snapshot.stats) {
      spireResourceState.lamed.stats = snapshot.stats;
    }
    if (snapshot.upgrades) {
      spireResourceState.lamed.upgrades = snapshot.upgrades;
    }
    if (Number.isFinite(snapshot.starMass)) {
      spireResourceState.lamed.starMass = snapshot.starMass;
    }
    if (Number.isFinite(snapshot.dragLevel)) {
      spireResourceState.lamed.dragLevel = snapshot.dragLevel;
    }
  }

  /**
   * Capture Tsadi particle sandbox state for autosave hydration and tab resume.
   */
  function captureTsadiSimulationSnapshot() {
    if (!tsadiSimulationInstance || typeof tsadiSimulationInstance.exportSnapshot !== 'function') {
      return;
    }
    const snapshot = tsadiSimulationInstance.exportSnapshot();
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }
    spireResourceState.tsadi.simulationSnapshot = snapshot;
    if (Number.isFinite(snapshot.bindingAgentBank)) {
      syncTsadiBindingAgents(snapshot.bindingAgentBank);
    }
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
    
    // Capture click position for star spawning
    if (event && event.target) {
      const rect = event.target.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (typeof lamedSimulationInstance.setClickPosition === 'function') {
        lamedSimulationInstance.setClickPosition(x, y);
      }
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
        setAlephTierTransitionVisualState('idle');
        powderSimulation.setWallGapTarget(powderState.wallGapTarget || powderConfig.wallBaseGapMotes, {
          skipRebuild: true,
        });
        powderSimulation.handleResize();
        applyLoadedPowderSimulationState(powderSimulation);
        flushPendingMoteDrops();
        powderSimulation.start();
        applyPowderVisualSettings();
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
            idleDrainRate: resolveAlephTierRate(
              powderState.alephBaseIdleDrainRate ?? powderState.idleDrainRate,
              powderState.alephWallTier,
            ),
            motePalette: resolveAlephTierStubPalette(powderState.alephWallTier),
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
        syncAlephTierVisualProfile(resolveAlephTierProgress(powderState.wallGlyphsLit || 0));
        powderSimulation.setFlowOffset(powderState.sandOffset);
        powderState.motePalette = powderSimulation.getEffectiveMotePalette();
        // Sync the emblem glow when returning to the sand simulation baseline palette.
        applyMindGatePaletteToDom(powderState.motePalette);
        powderState.idleDrainRate = powderSimulation.idleDrainRate;
        powderState.simulationMode = 'sand';
        if (powderState.alephTierTransition?.active) {
          setAlephTierTransitionSpawnState({
            spawnEnabled: false,
            floorDrainEnabled: true,
            clearPendingDrops: true,
          });
          setAlephTierTransitionVisualState(powderState.alephTierTransition.stage || 'walls-exiting');
        } else {
          setAlephTierTransitionSpawnState({
            spawnEnabled: true,
            floorDrainEnabled: false,
            clearPendingDrops: false,
          });
          setAlephTierTransitionVisualState('idle');
        }
        powderSimulation.setWallGapTarget(powderState.wallGapTarget || powderConfig.wallBaseGapMotes, {
          skipRebuild: true,
        });
        powderSimulation.handleResize();
        applyLoadedPowderSimulationState(powderSimulation);
        flushPendingMoteDrops();
        powderSimulation.start();
        applyPowderVisualSettings();
        initializePowderViewInteraction();
        handlePowderViewTransformChange(powderSimulation.getViewTransform());
        syncFluidCameraModeUi();
        if (previousMode !== powderState.simulationMode) {
          recordPowderEvent('mode-switch', { mode: 'sand', label: 'Powderfall Study' });
        }
      }

      refreshPowderWallDecorations();
      handlePowderHeightChange(powderSimulation ? powderSimulation.getStatus() : undefined);
      const tierVisualGlyphs = getTierVisualGlyphCount(powderState.wallGlyphsLit || 0);
      updatePowderWallGapFromGlyphs(tierVisualGlyphs);
      syncAlephTierVisualProfile(resolveAlephTierProgress(tierVisualGlyphs));
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
  const ALEPH_RIGHT_WALL_SPRITE_OFFSET_PX = 3; // Shift the right Aleph wall sprite outward so it no longer overlaps the mote pile.
  // ── Aleph tier-transition controller (extracted from main.js) ─────────
  const alephTierCtrl = createAlephTierTransitionController({
    powderState,
    powderConfig,
    getPowderElements: () => powderElements,
    getSandSimulation: () => sandSimulation,
    getPowderSimulation: () => powderSimulation,
    getApplyMindGatePaletteToDom: () => applyMindGatePaletteToDom,
    getResolveAlephTierProgress: () => resolveAlephTierProgress,
  });

  // Thin delegates so existing call sites in main.js continue to work unchanged.
  const resolveAlephTierStubPalette = alephTierCtrl.resolveAlephTierStubPalette;
  const resolveAlephTierRate = alephTierCtrl.resolveAlephTierRate;
  const getTierVisualGlyphCount = alephTierCtrl.getTierVisualGlyphCount;
  const setAlephTierTransitionVisualState = alephTierCtrl.setAlephTierTransitionVisualState;
  const setAlephTierTransitionSpawnState = alephTierCtrl.setAlephTierTransitionSpawnState;
  const maybeStartAlephTierTransition = alephTierCtrl.maybeStartAlephTierTransition;
  const bindAlephTierTransitionControls = alephTierCtrl.bindAlephTierTransitionControls;
  const syncAlephTierVisualProfile = alephTierCtrl.syncAlephTierVisualProfile;

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
    const moteGems = Array.from(moteGemState.inventory.entries()).map(([gemId, record = {}]) => ({
      gemId,
      label: typeof record.label === 'string' ? record.label : gemId,
      total: Number.isFinite(record.total) ? Math.max(0, record.total) : 0,
      count: Number.isFinite(record.count) ? Math.max(0, Math.floor(record.count)) : 0,
    }));

    return {
      powder: {
        unlocked: true,
        storySeen: Boolean(powderStoryState.storySeen),
      },
      fluid: {
        unlocked: Boolean(fluidStoryState.unlocked || powderState.fluidUnlocked),
        storySeen: Boolean(fluidStoryState.storySeen),
        generators: fluidStoryState.generators || {},
        particleFactorMilestone: fluidStoryState.particleFactorMilestone || 100,
        betGlyphsAwarded: fluidStoryState.betGlyphsAwarded || 0,
        particlesByTierAndSize: getBetSpireRenderInstance()?.getParticleStateSnapshot(),
      },
      lamed: {
        unlocked: Boolean(lamedState.unlocked),
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
        simulationSnapshot: lamedState.simulationSnapshot || null,
      },
      tsadi: {
        unlocked: Boolean(tsadiState.unlocked),
        storySeen: Boolean(tsadiState.storySeen),
        bindingAgents: getTsadiBindingAgents(),
        discoveredMolecules: normalizeDiscoveredMolecules(tsadiState.discoveredMolecules),
        stats: {
          totalParticles: clampPersistedValue(tsadiState.stats?.totalParticles, 0),
          totalGlyphs: clampPersistedValue(tsadiState.stats?.totalGlyphs, 0),
          highestTier: clampPersistedValue(tsadiState.stats?.highestTier, 0),
        },
        simulationSnapshot: tsadiState.simulationSnapshot || null,
      },
      shin: {
        unlocked: Boolean(shinState.unlocked),
        storySeen: Boolean(shinState.storySeen),
      },
      kuf: {
        unlocked: Boolean(kufState.unlocked),
        storySeen: Boolean(kufState.storySeen),
      },
      moteGems: {
        inventory: moteGems,
        autoCollectUnlocked: Boolean(moteGemState.autoCollectUnlocked),
        autoCollectDelayMs: Number.isFinite(moteGemState.autoCollectDelayMs)
          ? Math.max(0, Math.floor(moteGemState.autoCollectDelayMs))
          : 0,
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
    const moteGemBranch = snapshot.moteGems || {};

    const powderStoryState = spireResourceState.powder || {};
    powderStoryState.storySeen = Boolean(powderBranch.storySeen || powderStoryState.storySeen);
    spireResourceState.powder = powderStoryState;

    const fluidStoryState = spireResourceState.fluid || {};
    fluidStoryState.unlocked = Boolean(fluidBranch.unlocked || fluidStoryState.unlocked);
    fluidStoryState.storySeen = Boolean(fluidBranch.storySeen || fluidStoryState.storySeen);
    fluidStoryState.generators = fluidBranch.generators || fluidStoryState.generators || {};
    fluidStoryState.particleFactorMilestone = fluidBranch.particleFactorMilestone || fluidStoryState.particleFactorMilestone || 100;
    fluidStoryState.betGlyphsAwarded = fluidBranch.betGlyphsAwarded || fluidStoryState.betGlyphsAwarded || 0;
    fluidStoryState.particlesByTierAndSize = fluidBranch.particlesByTierAndSize || fluidStoryState.particlesByTierAndSize || null;
    spireResourceState.fluid = fluidStoryState;
    powderState.fluidUnlocked = Boolean(fluidStoryState.unlocked || powderState.fluidUnlocked);

    const lamedState = spireResourceState.lamed || {};
    lamedState.unlocked = Boolean(lamedBranch.unlocked || lamedState.unlocked);
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
    lamedState.simulationSnapshot = lamedBranch.simulationSnapshot || lamedState.simulationSnapshot || null;

    const tsadiState = spireResourceState.tsadi || {};
    tsadiState.unlocked = Boolean(tsadiBranch.unlocked || tsadiState.unlocked);
    tsadiState.storySeen = Boolean(tsadiBranch.storySeen || tsadiState.storySeen);
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
    tsadiState.simulationSnapshot = tsadiBranch.simulationSnapshot || tsadiState.simulationSnapshot || null;
    updateBindingAgentDisplay();

    const shinState = spireResourceState.shin || {};
    shinState.unlocked = Boolean(shinBranch.unlocked || shinState.unlocked);
    shinState.storySeen = Boolean(shinBranch.storySeen || shinState.storySeen);

    const kufState = spireResourceState.kuf || {};
    kufState.unlocked = Boolean(kufBranch.unlocked || kufState.unlocked);
    kufState.storySeen = Boolean(kufBranch.storySeen || kufState.storySeen);

    moteGemState.inventory.clear();
    if (Array.isArray(moteGemBranch.inventory)) {
      moteGemBranch.inventory.forEach((entry) => {
        const gemId = typeof entry?.gemId === 'string' ? entry.gemId.trim() : '';
        if (!gemId) {
          return;
        }
        moteGemState.inventory.set(gemId, {
          label: typeof entry.label === 'string' && entry.label.trim().length ? entry.label.trim() : gemId,
          total: Number.isFinite(entry.total) ? Math.max(0, entry.total) : 0,
          count: Number.isFinite(entry.count) ? Math.max(0, Math.floor(entry.count)) : 0,
        });
      });
    }
    moteGemState.autoCollectUnlocked = Boolean(
      moteGemBranch.autoCollectUnlocked || moteGemState.autoCollectUnlocked,
    );
    moteGemState.autoCollectDelayMs = Number.isFinite(moteGemBranch.autoCollectDelayMs)
      ? Math.max(0, Math.floor(moteGemBranch.autoCollectDelayMs))
      : moteGemState.autoCollectDelayMs || 0;
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
    applyDamageNumberMode,
    applyWaveKillTallyPreference,
    applyWaveDamageTallyPreference,
    applyTrackTracerPreference,
    applyFrameRateLimitPreference,
    applyFpsCounterPreference,
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
      // Persist the explicit user preference instead of temporary auto-performance overrides.
      graphics: getPreferredGraphicsMode(),
      glyphEquations: areGlyphEquationsVisible() ? '1' : '0',
      damageNumbers: areDamageNumbersEnabled() ? '1' : '0',
      waveKillTallies: areWaveKillTalliesEnabled() ? '1' : '0',
      waveDamageTallies: areWaveDamageTalliesEnabled() ? '1' : '0',
      trackTracer: areTrackTracersEnabled() ? '1' : '0',
    }),
    getSpireResourceStateSnapshot,
    applySpireResourceStateSnapshot,
    getCognitiveRealmStateSnapshot: serializeCognitiveRealmState,
    applyCognitiveRealmStateSnapshot: (snapshot) => {
      deserializeCognitiveRealmState(snapshot);
      updateCognitiveRealmVisibility();
    },
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
   * Build the ordered list of story screens the player has unlocked for the codex field notes view.
   * Story-only levels are listed in campaign order, followed by any spire briefings that have been read.
   * @returns {Promise<Array<{id:string,title:string,sections:string[]}>>} Authored story entries the player has seen.
   */
  async function buildSeenStoryEntries() {
    if (!levelStoryScreen || typeof levelStoryScreen.getStoryEntry !== 'function') {
      return [];
    }

    const storyIds = [];

    levelBlueprints.forEach((level) => {
      if (!isStoryOnlyLevel(level.id)) {
        return;
      }
      const state = levelState.get(level.id);
      if (state?.storySeen) {
        storyIds.push(level.id);
      }
    });

    Object.entries(spireStoryTargets).forEach(([spireId, storyTarget]) => {
      const branch = getSpireStoryBranch(spireId);
      if (storyTarget?.id && branch?.storySeen) {
        storyIds.push(storyTarget.id);
      }
    });

    const uniqueStoryIds = [...new Set(storyIds)];
    const seenEntries = [];
    for (const storyId of uniqueStoryIds) {
      try {
        const entry = await levelStoryScreen.getStoryEntry(storyId);
        if (entry) {
          seenEntries.push(entry);
        }
      } catch (error) {
        console.warn('Unable to load story entry for field notes', storyId, error);
      }
    }

    return seenEntries;
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
      resizeShinShapeBackground();
      resizeTsadiVermiculateBackground();
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
      refreshTowerIconPalettes();
      if (powderSimulation && typeof powderSimulation.setMotePalette === 'function') {
        powderSimulation.setMotePalette(palette);
        powderSimulation.render();
      }
    },
    onSchemeApplied: () => {
      if (playfield) {
        playfield.draw();
      }
      // Rebuild cached alpha, beta, gamma, and delta sprites so palette swaps tint the new particles.
      refreshAlphaShotSpritePaletteCache();
      refreshBetaShotSpritePaletteCache();
      refreshGammaShotSpritePaletteCache();
      refreshDeltaShipSpritePaletteCache();
      refreshTowerIconPalettes();
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
      if (!isFluid) {
        powderState[bankKey] = Math.max(0, simulation.idleBank);
        powderState[hydratedKey] = false;
      }
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
    if (!isFluid) {
      powderState[bankKey] = Math.max(
        0,
        Number.isFinite(snapshot.idleBank) ? snapshot.idleBank : simulation.idleBank || 0,
      );
      powderState[hydratedKey] = true;
    }
    powderState[drainKey] = simulation.idleDrainRate;
    powderState.motePalette = simulation.getEffectiveMotePalette();
    // Apply the restored palette so the Towers tab matches the revived basin state.
    applyMindGatePaletteToDom(powderState.motePalette);
    if (Array.isArray(powderState[pendingKey])) {
      powderState[pendingKey].length = 0;
    }
    // Restore wall gap from saved glyph number to ensure wall width matches saved progress
    if (Number.isFinite(powderState.wallGlyphsLit)) {
      const tierVisualGlyphs = getTierVisualGlyphCount(powderState.wallGlyphsLit);
      updatePowderWallGapFromGlyphs(tierVisualGlyphs);
      syncAlephTierVisualProfile(resolveAlephTierProgress(tierVisualGlyphs));
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

      // Generate iterons based on highest score reached in Cardinal Warden
      // Iterons per hour = highest score / 10
      try {
        const highScore = getCardinalHighScore();
        if (highScore > 0) {
          // Convert per-hour rate to per-second, then multiply by elapsed time
          const iteronsPerHour = highScore / 10;
          const iteronsPerSecond = iteronsPerHour / 3600;
          const iteronGain = iteronsPerSecond * deltaSeconds;
          if (Number.isFinite(iteronGain) && iteronGain > 0) {
            addIterons(iteronGain);
          }
        }
      } catch {
        // Expected: Cardinal Warden may not be initialized yet during early startup
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
      
      // Unlock cognitive realm rendering when Chapter 3, level 5 is completed
      if (levelId === '3 - 5' && isCognitiveRealmLocked()) {
        unlockCognitiveRealmRendering();
        updateCognitiveRealmLockState();
      }
    } else {
      updateStatusDisplays();
      updatePowderLedger();
    }

    updateActiveLevelBanner();
    updateLevelCards();
    
    // Update cognitive realm territories on level victory
    if (isCognitiveRealmUnlocked()) {
      updateTerritoriesForLevel(levelId, true);
    }
    
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
    
    // Update cognitive realm territories on level defeat
    if (isCognitiveRealmUnlocked()) {
      updateTerritoriesForLevel(levelId, false);
    }
    
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

  // Update cognitive realm map visibility based on unlock status, tab, and level state
  function updateCognitiveRealmVisibility() {
    const cognitiveRealmSection = document.getElementById('cognitive-realm-section');
    if (!cognitiveRealmSection) {
      return;
    }

    if (isCognitiveRealmUnlocked()) {
      cognitiveRealmSection.hidden = false;
      cognitiveRealmSection.setAttribute('aria-hidden', 'false');
      
      // Only show map if on Defense tab AND not inside a level
      const activeTabId = getActiveTabId();
      const isDefenseTab = activeTabId === 'tower';
      const isInsideLevel = Boolean(activeLevelId);
      const shouldShowMap = isDefenseTab && !isInsideLevel;
      
      if (shouldShowMap) {
        showCognitiveRealmMap();
      } else {
        hideCognitiveRealmMap();
      }
    } else {
      cognitiveRealmSection.hidden = true;
      cognitiveRealmSection.setAttribute('aria-hidden', 'true');
      hideCognitiveRealmMap();
    }
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
              
              // Special unlock for Prologue - Story: unlock Achievements and first Trial.
              if (level.id === 'Prologue - Story') {
                unlockAchievements();
                unlockAchievementsTab();
                // Unlock first trial after completing prologue
                if (isInteractiveLevel('Trial - 1')) {
                  unlockLevel('Trial - 1');
                }
              }
              
              // Special unlock for chapter story levels: unlock corresponding Ladder chapter and next Trial
              const chapterStoryMatch = level.id.match(/^([1-6]) - Story$/);
              if (chapterStoryMatch) {
                const chapterNum = Number(chapterStoryMatch[1]);
                // Unlock all Ladder levels for this chapter
                for (let i = 1; i <= 5; i++) {
                  const ladderLevelId = `Ladder - ${chapterNum} - ${i}`;
                  if (isInteractiveLevel(ladderLevelId)) {
                    unlockLevel(ladderLevelId);
                  }
                }
                
                // Unlock next trial after each chapter story (Trial 2-7 unlock after Chapters 1-6)
                const nextTrialNum = chapterNum + 1;
                if (nextTrialNum >= 2 && nextTrialNum <= 7) {
                  const nextTrialId = `Trial - ${nextTrialNum}`;
                  if (isInteractiveLevel(nextTrialId)) {
                    unlockLevel(nextTrialId);
                  }
                }
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
    const endlessCampaign = level?.campaign === 'Ladder';
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

    // Hide cognitive realm map whenever a level begins so rendering pauses inside encounters
    if (isCognitiveRealmUnlocked()) {
      hideCognitiveRealmMap();
    }

    if (playfield) {
      playfield.enterLevel(level, {
        endlessMode: forceEndlessMode || endlessCampaign,
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
      // Close any open tower selection wheels when leaving the level
      if (typeof playfield.closeTowerSelectionWheel === 'function') {
        playfield.closeTowerSelectionWheel();
      }
      playfield.leaveLevel();
    }
    // Close the loadout wheel when leaving the level
    if (typeof closeLoadoutWheel === 'function') {
      closeLoadoutWheel();
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
    
    // Show cognitive realm map when leaving a level if on Defense tab
    if (isCognitiveRealmUnlocked()) {
      const activeTabId = getActiveTabId();
      if (activeTabId === 'tower') {
        showCognitiveRealmMap();
      }
    }
    if (playfieldMenuController) {
      playfieldMenuController.updateMenuState();
    }
  }

  



  // Collapsible settings menus use a shared helper to eliminate duplicate expand/collapse logic.
  function bindVisualSettingsMenu() {
    bindCollapsibleMenu({ triggerId: 'visual-settings-menu-button', menuId: 'visual-settings-menu' });
  }

  function bindControlSettingsMenu() {
    bindCollapsibleMenu({ triggerId: 'control-settings-menu-button', menuId: 'control-settings-menu' });
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

  // Re-entrancy guard to prevent infinite recursion when awarding Bet glyphs
  let isUpdatingFluidDisplay = false;

  function updateFluidDisplay(status) {
    // Prevent re-entrant calls that cause infinite recursion
    if (isUpdatingFluidDisplay) {
      return;
    }
    isUpdatingFluidDisplay = true;

    try {
      // If the Bet Spire is locked or has been deleted, freeze the readouts and halt any
      // lingering fluid simulation so the reservoir numbers stay static instead of drifting.
      if (!powderState.fluidUnlocked) {
      if (fluidSimulationInstance && typeof fluidSimulationInstance.stop === 'function') {
        fluidSimulationInstance.stop();
      }

      if (fluidElements.reservoirValue) {
        fluidElements.reservoirValue.textContent = '0 Scintillae';
      }
      if (fluidElements.dripRateValue) {
        fluidElements.dripRateValue.textContent = '0 Scintillae/sec';
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

      // The wall gap (visual effect showing basin capacity) scales with glyphsLit (water height thresholds).
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
      fluidElements.rightWall.style.setProperty(
        '--powder-right-wall-sprite-offset-x',
        `${ALEPH_RIGHT_WALL_SPRITE_OFFSET_PX}px`,
      );
      fluidElements.rightWall.style.setProperty('--powder-wall-shift', wallOffsetValue);
    }

    const idleBank = 0;
    if (fluidElements.reservoirValue) {
      fluidElements.reservoirValue.textContent = `${formatGameNumber(idleBank)} Scintillae`;
    }

    const drainRate = Number.isFinite(powderState.fluidIdleDrainRate)
      ? Math.max(0, powderState.fluidIdleDrainRate)
      : 0;
    if (fluidElements.dripRateValue) {
      fluidElements.dripRateValue.textContent = `${formatDecimal(drainRate, 2)} Scintillae/sec`;
    }

    if (fluidElements.statusNote) {
      let message;
      const crestPercent = formatDecimal(crestNormalized * 100, 1);
      if (crestNormalized >= 1.2) {
        message = `Crest is ${crestPercent}% of the viewport—overflow is cycling while idle Scintillae condenses.`;
      } else if (crestNormalized >= 0.75) {
        message = `Surface oscillates near the ridge (${crestPercent}%). This gauge tracks wave height, not stored Scintillae.`;
      } else {
        message = `Terrarium surface is calm (${crestPercent}%). Wave height is separate from the Scintillae reserve total.`;
      }
      fluidElements.statusNote.textContent = message;
    }

    } finally {
      isUpdatingFluidDisplay = false;
    }
  }

  function handlePowderIdleBankChange(bankValue, source) {
    const normalized = Number.isFinite(bankValue) ? Math.max(0, bankValue) : 0;
    const origin = source || (powderSimulation === fluidSimulationInstance ? 'fluid' : 'sand');
    if (origin === 'fluid') {
      // Fluid idle bank is no longer tracked
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
      powderElements.rightWall.style.setProperty(
        '--powder-right-wall-sprite-offset-x',
        `${ALEPH_RIGHT_WALL_SPRITE_OFFSET_PX}px`,
      );
      powderElements.rightWall.style.setProperty('--powder-wall-shift', wallOffsetValue);
    }

    const basinHeight = rows * cellSize;

    const glyphMetrics = updatePowderGlyphColumns({
      scrollOffset,
      rows,
      cellSize,
      highestNormalized: highestNormalizedRaw,
      totalNormalized,
      // Tie vertical Aleph spacing to the live wall gap so each lane costs 100 motes of ascent.
      wallGapMotes: Number.isFinite(powderState.wallGapTarget)
        ? Math.max(1, powderState.wallGapTarget)
        : Math.max(1, powderConfig.wallBaseGapMotes),
      tierAdvanceAlephCount: powderConfig.alephTierAdvanceCount,
      minAlephWallTier: powderConfig.alephWallTierMin,
      maxAlephWallTier: powderConfig.alephWallTierMax,
    });

    if (powderElements.nextGlyphProgress) {
      if (glyphMetrics) {
        const clampedProgress = Math.min(1, Math.max(0, glyphMetrics.progressFraction));
        // Show progress climbing toward the next glyph instead of counting down from 100%.
        const progressPercent = formatDecimal(clampedProgress * 100, 1);
        const remainingHeightMotes = Number.isFinite(glyphMetrics.remainingToNextMotes)
          ? Math.max(0, glyphMetrics.remainingToNextMotes)
          : Math.max(0, glyphMetrics.remainingToNext);
        const remainingHeight = formatDecimal(remainingHeightMotes, 2);
        const tier = Number.isFinite(glyphMetrics.tier) ? Math.max(1, Math.floor(glyphMetrics.tier)) : 1;
        const alephInTier = Number.isFinite(glyphMetrics.alephInTier) ? Math.max(0, Math.floor(glyphMetrics.alephInTier)) : 0;
        const tierAdvance = Number.isFinite(glyphMetrics.tierAdvanceAlephCount)
          ? Math.max(1, Math.floor(glyphMetrics.tierAdvanceAlephCount))
          : 30;
        powderElements.nextGlyphProgress.textContent = `Tier ${tier} · ℵ ${alephInTier}/${tierAdvance} · ${progressPercent}% to next glyph · Δh ${remainingHeight}`;
      } else {
        powderElements.nextGlyphProgress.textContent = '—';
      }
    }

    if (glyphMetrics) {
      const { glyphsLit, highestRaw, progressFraction } = glyphMetrics;
      const tierProgress = resolveAlephTierProgress(glyphsLit);
      maybeStartAlephTierTransition(glyphsLit, tierProgress);
      const tierVisualGlyphsLit = getTierVisualGlyphCount(glyphsLit);
      const visualTierProgress = resolveAlephTierProgress(tierVisualGlyphsLit);
      const transitionActive = Boolean(powderState.alephTierTransition?.active);
      syncAlephTierVisualProfile(visualTierProgress);
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
      updatePowderWallGapFromGlyphs(tierVisualGlyphsLit);
      if (powderElements.leftWall) {
        powderElements.leftWall.classList.toggle('wall-awake', highestRaw > 0);
      }
      if (powderElements.rightWall) {
        powderElements.rightWall.classList.toggle(
          'wall-awake',
          tierVisualGlyphsLit > 0 || progressFraction >= 0.6,
        );
      }

      if (glyphsLit !== powderState.wallGlyphsLit) {
        powderState.wallGlyphsLit = glyphsLit;
        notifyPowderSigils(glyphsLit);
      }
      if (!transitionActive) {
        powderState.alephTierTransitionCheckpoint = Math.max(
          powderState.alephTierTransitionCheckpoint || 0,
          glyphsLit,
        );
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
    spireResourceState,
    moteGemInventory: moteGemState.inventory,
    powderState,
    unlockTerrariumCelestialBody,
    addTerrariumCreature,
    addTerrariumItem,
  });

  async function init() {
    // Configure towersTab callbacks to avoid circular dependency
    configureTowersTabCallbacks({
      updateStatusDisplays,
    });

    levelGrid = document.getElementById('level-grid');
    activeLevelEl = document.getElementById('active-level');
    leaveLevelBtn = document.getElementById('leave-level');
    levelGridCtrl.bindElements({ levelGrid, activeLevelEl, leaveLevelBtn });
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
    // Bind layout controller DOM references and fullscreen event listeners.
    layoutCtrl.bindElements();
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

    // Attach the particle scrollbar canvas to the right edge for reliable touch scrolling on Android.
    initParticleScrollbar();

    initializeLevelEditorElements();
    initializeDeveloperMapElements();

    // Initialize cognitive realm map
    const cognitiveRealmContainer = document.getElementById('cognitive-realm-container');
    const cognitiveRealmCanvas = document.getElementById('cognitive-realm-canvas');
    if (cognitiveRealmContainer && cognitiveRealmCanvas) {
      initializeCognitiveRealmPreferences();
      bindCognitiveRealmOptions();
      initializeCognitiveRealmMap(cognitiveRealmContainer, cognitiveRealmCanvas, {
        getDeveloperModeActive: () => developerModeActive,
      });
      // Ensure visibility and render state line up with the current tab and level status.
      updateCognitiveRealmVisibility();
    }

    // Apply the preferred graphics fidelity before other controls render.
    initializeGraphicsMode();
    initializeTrackRenderMode();
    initializeFrameRateLimitPreference();
    initializeFpsCounterPreference();
    initializeAutoGraphicsPreference();
    bindGraphicsModeToggle();
    bindVisualSettingsMenu();
    bindControlSettingsMenu();
    bindInvertCarouselDragToggle();
    initializeInvertCarouselDragPreference();
    bindColorSchemeButton();
    bindTrackRenderModeButton();
    // Expose a tactile toggle for the luminous track tracer overlay.
    bindTrackTracerToggle();
    bindLoadoutSlotButton();
    bindNotationToggle();
    bindGlyphEquationToggle();
    bindDamageNumberToggle();
    bindDamageNumberModeToggle();
    bindWaveKillTallyToggle();
    bindWaveDamageTallyToggle();
    bindFrameRateLimitSlider();
    bindFpsCounterToggle();
    bindAutoGraphicsToggle();

    // Bind playfield visual settings
    bindEnemyParticlesToggle();
    initializeEnemyParticlesPreference();
    bindEdgeCrystalsToggle();
    initializeEdgeCrystalsPreference();
    bindCrystalBackgroundSpritesToggle();
    initializeCrystalBackgroundSpritesPreference();
    bindBackgroundParticlesToggle();
    initializeBackgroundParticlesPreference();
    bindPlayfieldTrackTypeButton();
    initializeTowerLoadoutToggleSidePreference();
    bindTowerLoadoutToggleSideButton();
    // Sync the spire options placement toggle before binding render-specific buttons.
    initializeSpireOptionsPlacementPreference();
    bindSpireOptionsPlacementButton();
    initializePlayfieldPreferences();
    bindPlayfieldOptions();
    // Bind developer layer visibility toggles (only visible when developer mode is active).
    bindDevLayerToggles();

    // Bind playfield settings dropdown using the spire options dropdown behavior
    bindSpireOptionsDropdown({
      toggleId: 'playfield-settings-toggle',
      menuId: 'playfield-settings-menu',
      spireId: 'playfield-settings',
    });
    
    // Activate spire option dropdown toggles so every tab shares the same UX as Lamed.
    bindSpireOptionsDropdown({
      toggleId: 'powder-spire-options-toggle-button',
      menuId: 'powder-options-menu',
      spireId: 'powder',
      // Sync the footer spire button with the corner cog.
      extraToggleIds: ['powder-options-toggle-button'],
      // Close the Aleph spire popover when clicking outside.
      closeOnOutside: true,
    });
    bindSpireOptionsDropdown({
      toggleId: 'fluid-options-toggle-button',
      menuId: 'fluid-options-menu',
      spireId: 'fluid',
    });
    bindSpireOptionsDropdown({
      toggleId: 'bet-spire-options-toggle-button',
      menuId: 'bet-spire-options-menu',
      spireId: 'bet',
      // Sync the bottom spire button with the cog trigger.
      extraToggleIds: ['bet-spire-options-toggle-button-footer'],
      // Close the Bet spire popover when clicking outside the menu.
      closeOnOutside: true,
    });
    bindSpireOptionsDropdown({
      toggleId: 'tsadi-spire-options-toggle-button',
      menuId: 'tsadi-options-menu',
      spireId: 'tsadi',
      // Sync the footer spire button with the corner cog.
      extraToggleIds: ['tsadi-options-toggle-button'],
      // Close the Tsadi spire popover when clicking outside.
      closeOnOutside: true,
    });
    bindSpireOptionsDropdown({
      toggleId: 'shin-spire-options-toggle-button',
      menuId: 'shin-options-menu',
      spireId: 'shin',
      // Sync the footer spire button with the corner cog.
      extraToggleIds: ['shin-options-toggle-button'],
      // Close the Shin spire popover when clicking outside.
      closeOnOutside: true,
    });
    bindSpireOptionsDropdown({
      toggleId: 'kuf-spire-options-toggle-button',
      menuId: 'kuf-options-menu',
      spireId: 'kuf',
      // Sync the footer spire button with the corner cog.
      extraToggleIds: ['kuf-options-toggle-button'],
      // Close the Kuf spire popover when clicking outside.
      closeOnOutside: true,
    });
    bindSpireOptionsDropdown({
      toggleId: 'cognitive-realm-options-toggle',
      menuId: 'cognitive-realm-options-menu',
      spireId: 'cognitive-realm',
    });
    bindSpireOptionsDropdown({
      toggleId: 'achievements-terrarium-options-toggle-button',
      menuId: 'achievements-terrarium-options-menu',
      spireId: 'achievements-terrarium',
    });
    initializePowderSpirePreferences();
    bindPowderSpireOptions();
    initializeFluidSpirePreferences();
    bindFluidSpireOptions();
    initializeBetSpireParticlePreferences();
    bindBetSpireParticleOptions();
    initializeAchievementsTerrariumPreferences();
    bindAchievementsTerrariumOptions();
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

    /**
     * Stop all Fluid/Bet terrarium animations to conserve resources.
     * Called when leaving the Fluid tab.
     */
    function stopTerrariumAnimations() {
      const terrariumSystems = [
        fluidTerrariumCreatures,
        fluidTerrariumGrass,
        fluidTerrariumSkyCycle,
        fluidTerrariumShrooms,
      ];
      terrariumSystems.forEach((system) => {
        if (system && typeof system.stop === 'function') {
          system.stop();
        }
      });
    }

    /**
     * Restart all Fluid/Bet terrarium animations.
     * Called when entering the Fluid tab.
     */
    function startTerrariumAnimations() {
      const terrariumSystems = [
        fluidTerrariumCreatures,
        fluidTerrariumGrass,
        fluidTerrariumSkyCycle,
        fluidTerrariumShrooms,
      ];
      terrariumSystems.forEach((system) => {
        if (system && typeof system.start === 'function') {
          system.start();
        }
      });
    }

    function stopFluidSimulationLoop() {
      if (powderState.simulationMode !== 'fluid') {
        return;
      }
      if (fluidSimulationInstance && typeof fluidSimulationInstance.stop === 'function') {
        fluidSimulationInstance.stop();
      }
    }

    function resumeFluidSimulationLoop() {
      if (powderState.simulationMode !== 'fluid') {
        return;
      }
      if (fluidSimulationInstance && typeof fluidSimulationInstance.start === 'function') {
        fluidSimulationInstance.start();
        if (typeof fluidSimulationInstance.handleResize === 'function') {
          fluidSimulationInstance.handleResize();
        }
      }
    }

    // Synchronize tab interactions with overlay state, audio cues, and banner refreshes.
    configureTabManager({
      getOverlayActiveState: () => Boolean(levelOverlayController?.isOverlayActive()),
      isFieldNotesOverlayVisible,
      onTabChange: (tabId) => {
        closeAllSpireDropdowns();
        // Hide the tower selection wheel whenever players leave the Stage tab.
        if (tabId !== 'tower' && playfield && typeof playfield.closeTowerSelectionWheel === 'function') {
          playfield.closeTowerSelectionWheel();
        }
        // Hide the loadout wheel whenever players leave the Tower tab.
        if (tabId !== 'tower' && typeof closeLoadoutWheel === 'function') {
          closeLoadoutWheel();
        }
        if (previousTabId === 'tsadi' && tabId !== 'tsadi') {
          captureTsadiSimulationSnapshot();
          stopTsadiVermiculateBackground();
        }

        // -------------------------------------------------------------------
        // Freeze spire simulations when leaving their tabs to reduce resource
        // usage. Exceptions: Aleph (powder) spire always runs, and the main
        // playfield continues when an interactive level is active.
        // -------------------------------------------------------------------

        // Stop Lamed simulation when leaving the Lamed tab
        if (previousTabId === 'lamed' && tabId !== 'lamed') {
          captureLamedSimulationSnapshot();
          if (lamedSimulationInstance && typeof lamedSimulationInstance.stop === 'function') {
            lamedSimulationInstance.stop();
          }
        }

        // Stop Tsadi simulation when leaving the Tsadi tab
        if (previousTabId === 'tsadi' && tabId !== 'tsadi') {
          captureTsadiSimulationSnapshot();
          if (tsadiSimulationInstance && typeof tsadiSimulationInstance.stop === 'function') {
            tsadiSimulationInstance.stop();
          }
        }

        // Stop Shin (Cardinal Warden) simulation when leaving the Shin tab
        if (previousTabId === 'shin' && tabId !== 'shin') {
          stopCardinalSimulation();
          stopShinShapeBackground();
        }

        // Stop Kuf battlefield simulation when leaving the Kuf tab
        if (previousTabId === 'kuf' && tabId !== 'kuf') {
          stopKufSimulation();
        }

        // Stop Fluid/Bet terrarium animations when leaving the Fluid tab
        // (Fluid simulation itself is stopped via applyPowderSimulationMode when switching modes)
        if (previousTabId === 'fluid' && tabId !== 'fluid') {
          stopTerrariumAnimations();
          stopFluidSimulationLoop();
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
        if (tabId === 'towers') {
          // Refresh visibility state first (fast, no rendering work).
          updateTowerCardVisibility();
          refreshTowerCardBackgroundAnimations();
          // Stagger the card entrance so the browser renders them incrementally
          // rather than painting all cards synchronously in one frame.
          requestAnimationFrame(() => {
            stageTowerCardEntrance({ delayBetweenMs: 40 });
          });
        } else if (tabId === 'fluid') {
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
          resumeFluidSimulationLoop();
          // Restart terrarium animations when returning to the Fluid/Bet tab
          startTerrariumAnimations();
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
                isLowGraphicsMode: () => isLowGraphicsModeActive(),
                onStarMassChange: (value) => {
                  // Update state persistence
                  spireResourceState.lamed.starMass = value;
                  updateLamedStatistics();
                },
              });

              const lamedSnapshot = spireResourceState.lamed.simulationSnapshot || {
                starMass: spireResourceState.lamed.starMass || 10,
                dragLevel: spireResourceState.lamed.dragLevel || 0,
                upgrades: {
                  starMass: spireResourceState.lamed.upgrades?.starMass || 0,
                },
                stats: spireResourceState.lamed.stats || { totalAbsorptions: 0, totalMassGained: 0 },
              };

              if (typeof lamedSimulationInstance.importSnapshot === 'function') {
                lamedSimulationInstance.importSnapshot(lamedSnapshot);
              } else {
                lamedSimulationInstance.setState(lamedSnapshot);
              }

              lamedSimulationInstance.resize();
              
              // Apply idle stars from bank if any
              const idleStars = getLamedSparkBank();
              if (idleStars > 0) {
                applyLamedIdleStars(lamedSimulationInstance, idleStars);
                setLamedSparkBank(0); // Clear the bank after applying
              }
              
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
              // Connect Lamed visual preferences to the simulation instance.
              setLamedSimulationGetter(() => lamedSimulationInstance);
              initializeLamedSpirePreferences();
              bindLamedSpireOptions();
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
                  // Detect star milestones reached - 1 glyph per milestone
                  const currentLamedGlyphs = Math.max(
                    0,
                    Math.floor(state.stats?.starMilestoneReached || 0),
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
                initialBindingAgents: getTsadiBindingAgents(),
                initialDiscoveredMolecules: spireResourceState.tsadi?.discoveredMolecules || [],
                assignMoleculeName: (recipe) => tsadiMoleculeNameGenerator.assignName(recipe),
                samplePaletteGradient: samplePaletteGradient,
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
                    countEl.textContent = `${count} atoms`;
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
              const tsadiSnapshot = {
                bindingAgentBank: getTsadiBindingAgents(),
                discoveredMolecules: spireResourceState.tsadi?.discoveredMolecules || [],
                highestTierReached: spireResourceState.tsadi?.stats?.highestTier,
                glyphCount: spireResourceState.tsadi?.stats?.totalGlyphs,
                ...(spireResourceState.tsadi?.simulationSnapshot || {}),
              };
              setTsadiSimulationGetter(() => tsadiSimulationInstance);
              initializeTsadiSpirePreferences();
              if (!tsadiOptionsBound) {
                bindTsadiSpireOptions();
                tsadiOptionsBound = true;
              }
              tsadiSimulationInstance.resize();
              if (typeof tsadiSimulationInstance.importSnapshot === 'function') {
                tsadiSimulationInstance.importSnapshot(tsadiSnapshot);
              } else {
                tsadiSimulationInstance.importState(tsadiSnapshot, { preserveLayout: true });
              }
              tsadiSimulationInstance.setAvailableBindingAgents(getTsadiBindingAgents());
              
              // Apply idle particles from bank if any
              const idleParticles = getTsadiParticleBank();
              if (idleParticles > 0) {
                applyTsadiIdleParticles(tsadiSimulationInstance, idleParticles);
                setTsadiParticleBank(0); // Clear the bank after applying
              }
              
              const generationRateEl = document.getElementById('tsadi-generation-rate');
              if (generationRateEl) {
                generationRateEl.textContent = `${tsadiSimulationInstance.spawnRate.toFixed(2)} atoms/sec`;
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
            if (!tsadiSimulationInstance.running) {
              tsadiSimulationInstance.start();
            }
            scheduleSpireResize();
            updateBindingAgentDisplay();
            refreshCodexList();
          }

          // Update upgrade UI every time the tab is shown
          updateTsadiUpgradeUI();
          // Start the ambient vermiculate background effect for the Tsadi Spire.
          startTsadiVermiculateBackground();
        } else if (tabId === 'shin') {
          // Initialize Cardinal Warden reverse danmaku game when tab is first opened
          if (!cardinalWardenInitialized) {
            try {
              initializeCardinalWardenUI();
              // Connect shin visual preferences to the Cardinal simulation instance.
              setShinSimulationGetter(getCardinalSimulation);
              initializeShinSpirePreferences();
              bindShinSpireOptions();
              // Initialize the grapheme codex UI
              initializeShinGraphemeCodex();
              cardinalWardenInitialized = true;
            } catch (error) {
              console.error('Failed to initialize Cardinal Warden UI:', error);
            }
          } else {
            // Restart the simulation if it was stopped when leaving the tab
            startCardinalSimulation();
          }
          // Resize the Cardinal canvas when tab is shown
          resizeCardinalCanvas();
          // Start the ambient shape background effect for the Shin Spire.
          startShinShapeBackground();
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
                // Keep the Kuf almanac in sync with the global developer mode toggle.
                getDeveloperModeActive: () => developerModeActive,
              });
              initializeKufSpirePreferences();
              bindKufSpireOptions();
              kufUiInitialized = true;
              updateKufDisplay();
            } catch (error) {
              console.error('Failed to initialize Kuf Spire UI:', error);
            }
          } else {
            // Resume any paused battle when returning to the Kuf tab
            resumeKufSimulation();
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

        // Update cognitive realm map visibility based on tab and level state
        // Hide the map if not on Defense tab OR if player is inside a level
        if (isCognitiveRealmUnlocked()) {
          const isDefenseTab = tabId === 'tower';
          const isInsideLevel = Boolean(activeLevelId);
          const shouldShowMap = isDefenseTab && !isInsideLevel;

          if (shouldShowMap) {
            showCognitiveRealmMap();
          } else {
            hideCognitiveRealmMap();
          }
        }

        // Handle achievements tab visibility for sparkle management
        // Notify achievements tab when visibility changes
        if (typeof notifyAchievementsTabVisibilityChange === 'function') {
          notifyAchievementsTabVisibilityChange(tabId === 'achievements');
        }

        previousTabId = tabId;
        notifyParticleScrollbarTabChanged();
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

    initializePlayfieldBackgroundVideo();

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
    if (isAchievementsUnlocked()) {
      unlockAchievementsTab();
    }
    enforceFluidStudyDisabledState();
    // Reapply developer mode boosts after progression restore so level unlocks stay in sync.
    refreshDeveloperModeState();
    reconcileGlyphCurrencyFromState();

    bindStatusElements();
    bindPowderControls();
    bindAlephTierTransitionControls();
    bindFluidControls();
    bindAchievementsTerrariumControls(); // Bind achievements terrarium elements
    
    // Initialize basic pan/zoom for achievements terrarium viewport
    if (achievementsTerrariumElements.viewport && achievementsTerrariumElements.terrariumLayer) {
      const viewport = achievementsTerrariumElements.viewport;
      const layer = achievementsTerrariumElements.terrariumLayer;
      let scale = 1;
      let translateX = 0;
      let translateY = 0;
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let startTranslateX = 0;
      let startTranslateY = 0;
      
      // Anchor transforms from the top-left so clamping math stays predictable across zoom levels.
      layer.style.transformOrigin = '0 0';

      // Clamp the terrarium translation so the viewport never exposes empty space beyond the edges.
      const clampTerrariumTranslation = () => {
        const viewportWidth = viewport.clientWidth;
        const viewportHeight = viewport.clientHeight;
        const contentWidth = layer.offsetWidth;
        const contentHeight = layer.offsetHeight;
        if (!viewportWidth || !viewportHeight || !contentWidth || !contentHeight) {
          return;
        }
        const scaledWidth = contentWidth * scale;
        const scaledHeight = contentHeight * scale;
        
        // Prevent zooming out past the terrarium bounds
        // Calculate minimum scale to ensure content fills the viewport
        const minScaleX = viewportWidth / contentWidth;
        const minScaleY = viewportHeight / contentHeight;
        const minScale = Math.max(minScaleX, minScaleY, 0.5); // Use 0.5 as absolute minimum
        
        // Clamp scale to prevent zooming out too far
        if (scale < minScale) {
          scale = minScale;
        }
        
        // Recalculate scaled dimensions with clamped scale
        const clampedScaledWidth = contentWidth * scale;
        const clampedScaledHeight = contentHeight * scale;
        
        const maxTranslateX = 0;
        const maxTranslateY = 0;
        const minTranslateX = viewportWidth - clampedScaledWidth;
        const minTranslateY = viewportHeight - clampedScaledHeight;
        const resolveTranslation = (current, min, max, viewportSize, scaledSize) => {
          if (min > max) {
            return (viewportSize - scaledSize) / 2;
          }
          return Math.min(max, Math.max(min, current));
        };
        translateX = resolveTranslation(translateX, minTranslateX, maxTranslateX, viewportWidth, clampedScaledWidth);
        translateY = resolveTranslation(translateY, minTranslateY, maxTranslateY, viewportHeight, clampedScaledHeight);
      };

      const updateTransform = () => {
        clampTerrariumTranslation();
        layer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      };
      
      // Mouse wheel zoom
      viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSpeed = 0.001;
        const delta = -e.deltaY * zoomSpeed;
        const newScale = Math.max(0.5, Math.min(3, scale * (1 + delta)));
        
        if (newScale !== scale) {
          // Zoom towards mouse position
          const rect = viewport.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          
          // Calculate point in content space before zoom
          const contentX = (mouseX - translateX) / scale;
          const contentY = (mouseY - translateY) / scale;
          
          // Update scale
          scale = newScale;
          
          // Calculate new translation to keep the content point under the mouse
          translateX = mouseX - contentX * scale;
          translateY = mouseY - contentY * scale;
          
          updateTransform();
        }
      }, { passive: false });
      
      // Mouse drag pan
      viewport.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left mouse button
          isDragging = true;
          startX = e.clientX;
          startY = e.clientY;
          startTranslateX = translateX;
          startTranslateY = translateY;
          viewport.style.cursor = 'grabbing';
        }
      });
      
      viewport.addEventListener('mousemove', (e) => {
        if (isDragging) {
          translateX = startTranslateX + (e.clientX - startX);
          translateY = startTranslateY + (e.clientY - startY);
          updateTransform();
        }
      });
      
      const stopDrag = () => {
        if (isDragging) {
          isDragging = false;
          viewport.style.cursor = 'grab';
        }
      };
      
      viewport.addEventListener('mouseup', stopDrag);
      viewport.addEventListener('mouseleave', stopDrag);
      viewport.style.cursor = 'grab';
      
      // Touch support for mobile
      let touchStartDist = 0;
      let touchStartScale = 1;
      let pinchCenterX = 0;
      let pinchCenterY = 0;
      
      viewport.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          // Single touch - pan
          isDragging = true;
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
          startTranslateX = translateX;
          startTranslateY = translateY;
        } else if (e.touches.length === 2) {
          // Two finger pinch - zoom
          isDragging = false; // Cancel panning when pinch starts
          const dx = e.touches[1].clientX - e.touches[0].clientX;
          const dy = e.touches[1].clientY - e.touches[0].clientY;
          touchStartDist = Math.sqrt(dx * dx + dy * dy);
          touchStartScale = scale;
          
          // Calculate pinch center in viewport coordinates
          const rect = viewport.getBoundingClientRect();
          pinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
          pinchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        }
      }, { passive: true });
      
      viewport.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && isDragging) {
          e.preventDefault();
          translateX = startTranslateX + (e.touches[0].clientX - startX);
          translateY = startTranslateY + (e.touches[0].clientY - startY);
          updateTransform();
        } else if (e.touches.length === 2) {
          e.preventDefault();
          const dx = e.touches[1].clientX - e.touches[0].clientX;
          const dy = e.touches[1].clientY - e.touches[0].clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const newScale = Math.max(0.5, Math.min(3, touchStartScale * (dist / touchStartDist)));
          
          if (newScale !== scale) {
            // Calculate point in content space before zoom
            const contentX = (pinchCenterX - translateX) / scale;
            const contentY = (pinchCenterY - translateY) / scale;
            
            // Update scale
            scale = newScale;
            
            // Calculate new translation to keep the content point under the pinch center
            translateX = pinchCenterX - contentX * scale;
            translateY = pinchCenterY - contentY * scale;
            
            updateTransform();
          }
        }
      }, { passive: false });
      
      viewport.addEventListener('touchend', () => {
        isDragging = false;
        touchStartDist = 0;
      }, { passive: true });
    }
    
    initializeSpireGemMenus();
    bindFluidCameraModeToggle();
    syncFluidCameraModeUi();
    await ensureTerrariumSurfacesReady();
    ensureFluidTerrariumWater();
    ensureFluidTerrariumCreatures();
    ensureFluidTerrariumBirds();
    ensureFluidTerrariumGrass();
    ensureFluidTerrariumCrystal();
    ensureFluidTerrariumTrees();
    ensureFluidTerrariumSkyCycle();
    ensureFluidTerrariumCelestialBodies();
    ensureFluidTerrariumShrooms();
    ensureFluidTerrariumItemsDropdown();
    applyFluidVisualSettings();
    ensurePowderBasinResizeObserver();
    bindSpireClickIncome();
    await applyPowderSimulationMode(powderState.simulationMode);
    initializeEquipmentState();
    initializeCraftingOverlay({
      revealOverlay,
      scheduleOverlayHide,
      onRequestInventoryRefresh: updateMoteGemInventoryDisplay,
      onCommitState: commitAutoSave,
    });
    bindAchievements();
    // Initialize boosts section in achievements tab
    loadMonetizationState();
    initializeBoostsSection();
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
    refreshTowerCardBackgroundAnimations();
    simplifyTowerCards();
    annotateTowerCardsWithCost();
    synchronizeTowerCardMasterEquations();
    initializeTowerEquipmentInterface();
    updateTowerCardVisibility();
    // If the player loaded directly into the towers tab, the entrance animation
    // was scheduled before injectTowerCardPreviews/updateTowerCardVisibility ran,
    // so cards were still hidden at that point. Re-run the entrance now that all
    // cards are properly injected and their visibility is up-to-date.
    if (getActiveTabId() === 'towers') {
      requestAnimationFrame(() => {
        stageTowerCardEntrance({ delayBetweenMs: 40 });
      });
    }
    initializeTowerTreeMap({
      toggleButton: document.getElementById('tower-tree-map-toggle'),
      mapContainer: document.getElementById('tower-tree-map'),
      cardGrid: document.getElementById('tower-card-grid'),
    });
    refreshTowerTreeMap();
    initializeTowerSelection();
    initializeTowerVisibilityToggle();
    initializeTowerElementDebugControls();
    bindTowerCardUpgradeInteractions();
    syncLoadoutToPlayfield();
    renderEnemyCodex();

    buildLevelCards();
    updateLevelCards();
    variableLibraryController.bindVariableLibrary();
    bindUpgradeMatrix();
    bindLeaveLevelButton();
    initializeManualDropHandlers();
    
    // Initialize Bet Spire particle physics render and inventory display
    initBetSpireRender(spireResourceState.fluid);
    setBetSpireRenderGetter(getBetSpireRenderInstance);
    
    // Apply idle particles from bank if any (bet spire is always running)
    const betIdleParticles = getCurrentFluidDropBank(); // Using the idle bank for bet
    if (betIdleParticles > 0) {
      const betInstance = getBetSpireRenderInstance();
      if (betInstance) {
        applyBetIdleParticles(betInstance, betIdleParticles);
        // Bank will be cleared by the bet spire's internal logic
      }
    }
    
    initParticleInventoryDisplay();
    
    // Initialize BET spire upgrade menu
    const betUpgradeMenu = createBetSpireUpgradeMenu({
      formatWholeNumber,
      formatGameNumber,
      formatDecimal,
      state: spireResourceState.fluid,
    });
    
    betUpgradeMenu.bindPurchaseButtons();
    betUpgradeMenu.startGenerationLoop();
    
    // Update the upgrade menu display every second
    setInterval(() => {
      betUpgradeMenu.updateDisplay();
    }, 1000);
    
    // Listen for BET glyph awards
    const betCanvas = document.getElementById('bet-spire-canvas');
    if (betCanvas) {
      betCanvas.addEventListener('betGlyphsAwarded', (event) => {
        const count = event.detail?.count || 0;
        if (count > 0) {
          // Award BET glyphs to the player
          setBetGlyphCurrency(getBetGlyphCurrency() + count);
          recordPowderEvent('bet-glyph-award', { count });
          // Trigger autosave to persist the milestone achievement
          schedulePowderSave();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init().catch(console.error));
  } else {
    init().catch(console.error);
  }

  bindPageLifecycleEvents({
    commitAutoSave,
    markLastActive,
    suppressAudioPlayback,
    releaseAudioSuppression,
    refreshTabMusic,
    checkOfflineRewards,
    audioManager,
    stopBetSpireRender,
    resumeBetSpireRender,
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
