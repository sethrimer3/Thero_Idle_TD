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
  getBaseStartThero,
  registerResourceContainers,
  setBaseStartThero,
  getBaseCoreIntegrity,
} from './configuration.js';
import {
  setNotationRefreshHandler,
  bindNotationToggle,
  applyNotationPreference,
  bindGlyphEquationToggle,
  applyGlyphEquationPreference,
  initializeDesktopCursorPreference,
  initializeGraphicsMode,
  bindGraphicsModeToggle,
  isLowGraphicsModeActive,
  setGraphicsModeContext,
  areGlyphEquationsVisible,
  getActiveGraphicsMode,
} from './preferences.js';
import { SimplePlayfield, configurePlayfieldSystem } from './playfield.js';
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
// Powder tower palette and simulation helpers.
import {
  DEFAULT_MOTE_PALETTE,
  POWDER_CELL_SIZE_PX,
  PowderSimulation,
  clampUnitInterval,
  colorToRgbaString,
  mergeMotePalette,
  resolvePaletteColorStops,
} from '../scripts/features/towers/powderTower.js';
// Fluid tower shallow-water simulation extracted into a dedicated module.
import { FluidSimulation } from '../scripts/features/towers/fluidTower.js';
// Lamed tower gravity simulation for orbital mechanics with sparks.
import { GravitySimulation } from '../scripts/features/towers/lamedTower.js';
// Tsadi tower particle fusion simulation with tier-based merging.
import { ParticleFusionSimulation, getGreekTierInfo } from '../scripts/features/towers/tsadiTower.js';
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
  setIterationRate,
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
import { createLevelPreviewRenderer } from './levelPreviewRenderer.js';
import { createSpireFloatingMenuController } from './spireFloatingMenu.js';
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
} from './levels.js';
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
  formatBetLabel,
  formatDuration,
  formatRewards,
  formatRelativeTime,
} from './formatHelpers.js';

(() => {
  'use strict';

  initializeStartupOverlay();

  const THERO_SYMBOL = 'þ';
  const COMMUNITY_DISCORD_INVITE = 'https://discord.gg/UzqhfsZQ8n'; // Reserved for future placement.

  const SVG_NS = 'http://www.w3.org/2000/svg';

  setTheroSymbol(THERO_SYMBOL);

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
  let overlay = null;
  let overlayLabel = null;
  let overlayTitle = null;
  let overlayExample = null;
  let overlayPreview = null;
  let overlayMode = null;
  let overlayDuration = null;
  let overlayRewards = null;
  let overlayStartThero = null;
  let overlayLast = null;
  let overlayInstruction = null;
  let overlayRequiresLevelExit = false;
  let levelPreviewRenderer = null;
  let upgradeOverlay = null;
  let upgradeOverlayButtons = [];
  let upgradeOverlayTriggerSet = null;
  let upgradeOverlayClose = null;
  let upgradeOverlayGrid = null;
  let lastUpgradeTrigger = null;
  let variableLibraryButton = null;
  let variableLibraryOverlay = null;
  let variableLibraryClose = null;
  let variableLibraryList = null;
  let variableLibraryLabel = null;
  let lastVariableLibraryTrigger = null;
  let removeVariableListener = null;
  const overlayInstructionDefault = 'Tap to enter';
  let activeLevelId = null;
  let pendingLevel = null;
  let lastLevelTrigger = null;
  let expandedLevelSet = null;

  const developerModeElements = {
    toggle: null,
    note: null,
    resetButton: null,
  };

  const DEVELOPER_RESET_DEFAULT_LABEL = 'Delete Player Data';
  const DEVELOPER_RESET_CONFIRM_LABEL = 'Are you sure?';
  const DEVELOPER_RESET_CONFIRM_WINDOW_MS = 5000;
  const DEVELOPER_RESET_RELOAD_DELAY_MS = 900;
  const DEVELOPER_MODE_STORAGE_KEY = 'glyph-defense-idle:developer-mode';

  const developerResetState = {
    confirming: false,
    timeoutId: null,
  };

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
    SHIN_STATE_STORAGE_KEY,
  ].filter(Boolean);

  // Initialize overlay helpers from uiHelpers module
  const overlayHelpers = createOverlayHelpers();
  const { cancelOverlayHide, scheduleOverlayHide, revealOverlay } = overlayHelpers;

  function resetPlayfieldMenuLevelSelect() {
    playfieldMenuLevelSelectConfirming = false;
    if (!playfieldMenuLevelSelect) {
      return;
    }
    playfieldMenuLevelSelect.textContent = playfieldMenuLevelSelectDefaultLabel;
    playfieldMenuLevelSelect.classList.remove('playfield-menu-item--warning');
    playfieldMenuLevelSelect.removeAttribute('data-confirming');
  }

  function updatePlayfieldMenuState() {
    const interactive = Boolean(activeLevelId && activeLevelIsInteractive);
    if (playfieldMenuCommence) {
      // Mirror the primary commence button label/state inside the quick menu.
      const startButton = playfieldElements.startButton;
      const disabled = !startButton || startButton.disabled;
      playfieldMenuCommence.disabled = disabled;
      playfieldMenuCommence.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      const label = startButton?.textContent?.trim();
      if (label) {
        playfieldMenuCommence.textContent = label;
      }
    }
    if (playfieldMenuLevelSelect) {
      playfieldMenuLevelSelect.disabled = !interactive && !activeLevelId;
      playfieldMenuLevelSelect.setAttribute(
        'aria-disabled',
        playfieldMenuLevelSelect.disabled ? 'true' : 'false',
      );
    }
    if (playfieldMenuRetryWave) {
      const canRetry = Boolean(
        playfield && typeof playfield.canRetryCurrentWave === 'function'
          ? playfield.canRetryCurrentWave()
          : interactive,
      );
      playfieldMenuRetryWave.disabled = !canRetry;
      playfieldMenuRetryWave.setAttribute('aria-disabled', canRetry ? 'false' : 'true');
    }
    if (playfieldMenuDevTools) {
      const devAvailable = Boolean(developerModeActive && activeLevelId && interactive);
      const toolsActive = isDeveloperMapToolsActive();
      playfieldMenuDevTools.disabled = !devAvailable;
      playfieldMenuDevTools.setAttribute('aria-disabled', devAvailable ? 'false' : 'true');
      playfieldMenuDevTools.textContent = toolsActive ? 'Close Dev Map Tools' : 'Dev Map Tools';
      playfieldMenuDevTools.setAttribute('aria-pressed', toolsActive ? 'true' : 'false');
      if (!devAvailable) {
        const hint = developerModeActive
          ? 'Enter an interactive defense to access Dev Map Tools.'
          : 'Enable developer mode in the Codex tab to access Dev Map Tools.';
        playfieldMenuDevTools.setAttribute('title', hint);
        playfieldMenuDevTools.setAttribute('aria-description', hint);
      } else {
        playfieldMenuDevTools.removeAttribute('title');
        playfieldMenuDevTools.removeAttribute('aria-description');
      }
    }
    if (playfieldMenuStats) {
      const statsAvailable = Boolean(playfield && interactive);
      playfieldMenuStats.disabled = !statsAvailable;
      playfieldMenuStats.setAttribute('aria-disabled', statsAvailable ? 'false' : 'true');
      const label = playfieldStatsVisible ? 'Hide Combat Stats' : 'Show Combat Stats';
      playfieldMenuStats.textContent = label;
      playfieldMenuStats.setAttribute('aria-pressed', playfieldStatsVisible ? 'true' : 'false');
    }
  }

  function closePlayfieldMenu(options = {}) {
    // Ensure the quick menu hides and returns focus control to the battlefield trigger.
    const { restoreFocus = false } = options;

    if (playfieldMenuButton) {
      playfieldMenuButton.setAttribute('aria-expanded', 'false');
    }
    if (playfieldMenuPanel) {
      playfieldMenuPanel.setAttribute('hidden', '');
    }

    resetPlayfieldMenuLevelSelect();

    if (!playfieldMenuOpen) {
      return;
    }

    playfieldMenuOpen = false;
    document.removeEventListener('pointerdown', handlePlayfieldMenuPointerDown);
    document.removeEventListener('keydown', handlePlayfieldMenuKeydown);

    if (restoreFocus && playfieldMenuButton && typeof playfieldMenuButton.focus === 'function') {
      try {
        playfieldMenuButton.focus({ preventScroll: true });
      } catch (error) {
        playfieldMenuButton.focus();
      }
    }
  }

  function handlePlayfieldMenuPointerDown(event) {
    // Collapse the menu whenever the player interacts outside of the panel bounds.
    if (!playfieldMenuOpen) {
      return;
    }

    const target = event?.target || null;
    if (!playfieldMenuPanel) {
      return;
    }

    if (playfieldMenuPanel.contains(target)) {
      return;
    }

    if (playfieldMenuButton && target === playfieldMenuButton) {
      return;
    }

    closePlayfieldMenu();
  }

  function handlePlayfieldMenuKeydown(event) {
    // Allow players to dismiss the battlefield menu with the Escape key.
    if (!playfieldMenuOpen) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closePlayfieldMenu({ restoreFocus: true });
    }
  }

  function openPlayfieldMenu() {
    // Reveal the battlefield actions panel only while an interactive level is active.
    if (!playfieldMenuButton || !playfieldMenuPanel) {
      return;
    }
    if (!activeLevelId || !activeLevelIsInteractive) {
      return;
    }
    if (playfieldMenuOpen) {
      return;
    }

    playfieldMenuOpen = true;
    playfieldMenuButton.setAttribute('aria-expanded', 'true');
    playfieldMenuPanel.removeAttribute('hidden');

    updatePlayfieldMenuState();

    document.addEventListener('pointerdown', handlePlayfieldMenuPointerDown);
    document.addEventListener('keydown', handlePlayfieldMenuKeydown);

    const focusTarget = playfieldMenuPanel.querySelector('[role="menuitem"], button');
    if (focusTarget && typeof focusTarget.focus === 'function') {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch (error) {
        focusTarget.focus();
      }
    }
  }

  function togglePlayfieldMenu() {
    // Switch the menu state with a single button tap.
    if (playfieldMenuOpen) {
      closePlayfieldMenu();
    } else {
      openPlayfieldMenu();
    }
  }

  function togglePlayfieldStatsVisibility() {
    if (!playfield || typeof playfield.setStatsPanelEnabled !== 'function') {
      return;
    }
    if (!activeLevelId || !activeLevelIsInteractive) {
      return;
    }
    playfieldStatsVisible = !playfieldStatsVisible;
    playfield.setStatsPanelEnabled(playfieldStatsVisible);
    updatePlayfieldMenuState();
  }

  function updateLayoutVisibility() {
    // Hide the battlefield until an interactive level is in progress.
    const shouldShowPlayfield = Boolean(activeLevelId && activeLevelIsInteractive);
    setElementVisibility(playfieldWrapper, shouldShowPlayfield);
    setElementVisibility(stageControls, shouldShowPlayfield);
    setElementVisibility(levelSelectionSection, !shouldShowPlayfield);

    if (!shouldShowPlayfield) {
      closePlayfieldMenu();
      if (playfield && typeof playfield.setStatsPanelEnabled === 'function') {
        playfield.setStatsPanelEnabled(false);
      }
      playfieldStatsVisible = false;
      PlayfieldStatsPanel.resetPanel();
      updatePlayfieldMenuState();
      return;
    }

    if (playfield && typeof playfield.syncCanvasSize === 'function') {
      // Refresh the canvas geometry once the battlefield becomes visible again.
      playfield.syncCanvasSize();
    }

    updatePlayfieldMenuState();
  }

  function handleReturnToLevelSelection() {
    // Confirm whether players truly want to abandon the current battle.
    const hasActiveLevel = Boolean(activeLevelId);
    const requiresConfirm = Boolean(activeLevelId && activeLevelIsInteractive);

    if (!hasActiveLevel) {
      resetPlayfieldMenuLevelSelect();
      closePlayfieldMenu();
      updateLayoutVisibility();
      return;
    }

    if (requiresConfirm && !playfieldMenuLevelSelectConfirming) {
      playfieldMenuLevelSelectConfirming = true;
      if (playfieldMenuLevelSelect) {
        playfieldMenuLevelSelect.textContent = 'Are you sure?';
        playfieldMenuLevelSelect.classList.add('playfield-menu-item--warning');
        playfieldMenuLevelSelect.setAttribute('data-confirming', 'true');
      }
      return;
    }

    resetPlayfieldMenuLevelSelect();
    const finalizeExit = () => {
      leaveActiveLevel();
      closePlayfieldMenu({ restoreFocus: true }); // Ensure the quick menu collapses after returning to level selection.
    };
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(finalizeExit);
    } else {
      finalizeExit();
    }
  }

  function handleCommenceWaveFromMenu() {
    // Trigger the main commence button from the quick menu while respecting its state.
    const startButton = playfieldElements.startButton;
    if (!startButton || startButton.disabled) {
      return;
    }

    if (startButton === playfieldMenuCommence) {
      // When the quick menu button doubles as the start control, close the sheet after it fires.
      const finalizeClose = () => {
        closePlayfieldMenu();
        updatePlayfieldMenuState();
      };
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(finalizeClose);
      } else {
        finalizeClose();
      }
      return;
    }

    startButton.click();
    closePlayfieldMenu();
    updatePlayfieldMenuState();
  }

  function handleRetryCurrentWave() {
    resetPlayfieldMenuLevelSelect();

    if (!playfield || typeof playfield.retryCurrentWave !== 'function') {
      return;
    }

    const retried = playfield.retryCurrentWave();
    updatePlayfieldMenuState();
    if (retried) {
      closePlayfieldMenu();
    }
  }

  function handleOpenDevMapTools() {
    resetPlayfieldMenuLevelSelect();

    if (!developerModeActive) {
      if (playfield?.messageEl) {
        playfield.messageEl.textContent =
          'Enable developer mode in the Codex tab to open Dev Map Tools.';
      }
      if (audioManager) {
        audioManager.playSfx('error');
      }
      closePlayfieldMenu();
      return;
    }

    if (!activeLevelId || !activeLevelIsInteractive) {
      if (playfield?.messageEl) {
        playfield.messageEl.textContent = 'Enter an interactive defense before opening Dev Map Tools.';
      }
      if (audioManager) {
        audioManager.playSfx('error');
      }
      closePlayfieldMenu();
      return;
    }

    const level = levelLookup.get(activeLevelId);
    if (!level) {
      if (playfield?.messageEl) {
        playfield.messageEl.textContent =
          'Active level data unavailable—restart the defense to refresh developer tools.';
      }
      closePlayfieldMenu();
      return;
    }

    if (isDeveloperMapToolsActive()) {
      deactivateDeveloperMapTools({ force: true, silent: false });
      updatePlayfieldMenuState();
      if (audioManager) {
        audioManager.playSfx('menuSelect');
      }
      closePlayfieldMenu();
      return;
    }

    pendingLevel = null;
    const activated = activateDeveloperMapToolsForLevel(level);
    if (!activated) {
      if (playfield?.messageEl) {
        playfield.messageEl.textContent =
          'Unable to activate developer map tools—verify the level path is loaded.';
      }
      if (audioManager) {
        audioManager.playSfx('error');
      }
      closePlayfieldMenu();
      return;
    }

    if (playfield?.messageEl) {
      playfield.messageEl.textContent =
        'Developer map tools active—drag anchors or Shift-click to remove points directly on the battlefield.';
    }
    if (audioManager) {
      audioManager.playSfx('menuSelect');
    }
    updatePlayfieldMenuState();
    closePlayfieldMenu();
  }

  // Developer map element references allow quick toggles for spawning and clearing obstacles.
  let developerModeActive = false;

  let playfield = null;
  // Track layout elements so the UI can swap between the battlefield and level grid.
  let playfieldWrapper = null;
  let stageControls = null;
  let levelSelectionSection = null;
  // Store quick menu controls for leaving an active level.
  let playfieldMenuButton = null;
  let playfieldMenuPanel = null;
  let playfieldMenuCommence = null;
  let playfieldMenuLevelSelect = null;
  let playfieldMenuRetryWave = null;
  let playfieldMenuDevTools = null;
  let playfieldMenuStats = null;
  let playfieldMenuLevelSelectConfirming = false;
  const playfieldMenuLevelSelectDefaultLabel = 'Level Selection';
  let playfieldMenuOpen = false;
  let activeLevelIsInteractive = false;
  let playfieldStatsVisible = false;


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

  const audioManager = new AudioManager(DEFAULT_AUDIO_MANIFEST);
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

  const resourceElements = {
    theroMultiplier: null,
    glyphsAlephTotal: null,
    glyphsAlephUnused: null,
    glyphsBetTotal: null,
    glyphsBetUnused: null,
    tabGlyphBadge: null,
    tabMoteBadge: null,
    tabFluidBadge: null,
  };

  // Track glyph totals so unlock checks only trigger when thresholds change.
  let trackedLamedGlyphs = 0;
  let trackedTsadiGlyphs = 0;
  let trackedShinGlyphs = 0;
  let trackedKufGlyphs = 0;

  // Cache the relocated resource nodes so status updates only swap text content.
  function bindStatusElements() {
    resourceElements.theroMultiplier = document.getElementById('level-thero-multiplier');
    resourceElements.glyphsAlephTotal = document.getElementById('tower-glyphs-aleph-total');
    resourceElements.glyphsAlephUnused = document.getElementById('tower-glyphs-aleph-unused');
    resourceElements.glyphsBetTotal = document.getElementById('tower-glyphs-bet-total');
    resourceElements.glyphsBetUnused = document.getElementById('tower-glyphs-bet-unused');
    resourceElements.glyphsLamedTotal = document.getElementById('tower-glyphs-lamed-total');
    resourceElements.glyphsLamedUnused = document.getElementById('tower-glyphs-lamed-unused');
    resourceElements.glyphsTsadiTotal = document.getElementById('tower-glyphs-tsadi-total');
    resourceElements.glyphsTsadiUnused = document.getElementById('tower-glyphs-tsadi-unused');
    resourceElements.glyphsShinTotal = document.getElementById('tower-glyphs-shin-total');
    resourceElements.glyphsShinUnused = document.getElementById('tower-glyphs-shin-unused');
    resourceElements.glyphsKufTotal = document.getElementById('tower-glyphs-kuf-total');
    resourceElements.glyphsKufUnused = document.getElementById('tower-glyphs-kuf-unused');
    resourceElements.tabGlyphBadge = document.getElementById('tab-glyph-badge');
    resourceElements.tabMoteBadge = document.getElementById('tab-mote-badge');
    resourceElements.tabFluidBadge = document.getElementById('tab-fluid-badge');
    updateStatusDisplays();
  }

  // Render the relocated resource panels using the latest score, glyph, and mote reserves.
  function updateStatusDisplays() {
    const theroMultiplier = getStartingTheroMultiplier();
    if (resourceElements.theroMultiplier) {
      const multiplierLabel = formatGameNumber(theroMultiplier);
      resourceElements.theroMultiplier.textContent = `×${multiplierLabel}`;
      resourceElements.theroMultiplier.setAttribute('aria-label', `Thero multiplier ×${multiplierLabel}`);
    }

    // Aleph glyphs (ℵ) are earned from defeating enemies in the main game
    const totalAlephGlyphs = Math.max(0, Math.floor(powderState.glyphsAwarded || 0));
    const unusedAlephGlyphs = Math.max(0, Math.floor(getGlyphCurrency()));
    if (resourceElements.glyphsAlephTotal) {
      resourceElements.glyphsAlephTotal.textContent = `${formatWholeNumber(totalAlephGlyphs)} ℵ`;
    }
    if (resourceElements.glyphsAlephUnused) {
      if (unusedAlephGlyphs > 0) {
        resourceElements.glyphsAlephUnused.textContent = `${formatWholeNumber(unusedAlephGlyphs)} Unallocated`;
      } else {
        resourceElements.glyphsAlephUnused.textContent = '';
      }
    }
    
    // Bet glyphs (בּ) are earned from the Bet Spire progression
    const totalBetGlyphs = Math.max(0, Math.floor(getBetGlyphCurrency()));
    // TODO: Implement Bet glyph allocation system (similar to Aleph glyph upgrades)
    const unusedBetGlyphs = totalBetGlyphs; // For now, all Bet glyphs are unallocated
    if (resourceElements.glyphsBetTotal) {
      resourceElements.glyphsBetTotal.textContent = `${formatWholeNumber(totalBetGlyphs)} בּ`;
    }
    if (resourceElements.glyphsBetUnused) {
      if (unusedBetGlyphs > 0) {
        resourceElements.glyphsBetUnused.textContent = `${formatWholeNumber(unusedBetGlyphs)} Unallocated`;
      } else {
        resourceElements.glyphsBetUnused.textContent = '';
      }
    }
    
    // Lamed glyphs (ל) are earned from the Lamed Spire (spark absorptions)
    const totalLamedGlyphs = Math.max(0, Math.floor(spireResourceState.lamed?.stats?.totalAbsorptions || 0));
    const unusedLamedGlyphs = totalLamedGlyphs; // For now, all Lamed glyphs are unallocated
    if (resourceElements.glyphsLamedTotal) {
      resourceElements.glyphsLamedTotal.textContent = `${formatWholeNumber(totalLamedGlyphs)} ל`;
    }
    if (resourceElements.glyphsLamedUnused) {
      if (unusedLamedGlyphs > 0) {
        resourceElements.glyphsLamedUnused.textContent = `${formatWholeNumber(unusedLamedGlyphs)} Unallocated`;
      } else {
        resourceElements.glyphsLamedUnused.textContent = '';
      }
    }
    
    // Tsadi glyphs (צ) are earned from the Tsadi Spire
    const tsadiStats = spireResourceState.tsadi?.stats || {};
    const totalTsadiGlyphs = Math.max(
      0,
      Math.floor(
        Number.isFinite(tsadiStats.totalGlyphs)
          ? tsadiStats.totalGlyphs
          : tsadiStats.totalParticles || 0,
      ),
    );
    const unusedTsadiGlyphs = totalTsadiGlyphs; // For now, all Tsadi glyphs are unallocated
    if (resourceElements.glyphsTsadiTotal) {
      resourceElements.glyphsTsadiTotal.textContent = `${formatWholeNumber(totalTsadiGlyphs)} צ`;
    }
    if (resourceElements.glyphsTsadiUnused) {
      if (unusedTsadiGlyphs > 0) {
        resourceElements.glyphsTsadiUnused.textContent = `${formatWholeNumber(unusedTsadiGlyphs)} Unallocated`;
      } else {
        resourceElements.glyphsTsadiUnused.textContent = '';
      }
    }
    
    // Shin glyphs (ש) are earned from the Shin Spire (iterons converted to glyphs)
    const totalShinGlyphs = Math.max(0, Math.floor(getShinGlyphs()));
    const unusedShinGlyphs = totalShinGlyphs; // For now, all Shin glyphs are unallocated
    if (resourceElements.glyphsShinTotal) {
      resourceElements.glyphsShinTotal.textContent = `${formatWholeNumber(totalShinGlyphs)} ש`;
    }
    if (resourceElements.glyphsShinUnused) {
      if (unusedShinGlyphs > 0) {
        resourceElements.glyphsShinUnused.textContent = `${formatWholeNumber(unusedShinGlyphs)} Unallocated`;
      } else {
        resourceElements.glyphsShinUnused.textContent = '';
      }
    }
    
    // Kuf glyphs (ק) are earned from the Kuf Spire
    const totalKufGlyphs = Math.max(0, Math.floor(getKufGlyphs()));
    const unusedKufGlyphs = totalKufGlyphs; // For now, all Kuf glyphs are unallocated
    if (resourceElements.glyphsKufTotal) {
      resourceElements.glyphsKufTotal.textContent = `${formatWholeNumber(totalKufGlyphs)} ק`;
    }
    if (resourceElements.glyphsKufUnused) {
      if (unusedKufGlyphs > 0) {
        resourceElements.glyphsKufUnused.textContent = `${formatWholeNumber(unusedKufGlyphs)} Unallocated`;
      } else {
        resourceElements.glyphsKufUnused.textContent = '';
      }
    }
    
    if (resourceElements.tabGlyphBadge) {
      const tabGlyphLabel = formatWholeNumber(unusedAlephGlyphs);
      resourceElements.tabGlyphBadge.textContent = tabGlyphLabel;
      resourceElements.tabGlyphBadge.setAttribute('aria-label', `${tabGlyphLabel} unused Aleph glyphs`);
      const hasUnusedGlyphs = unusedAlephGlyphs > 0;
      // Mirror the glow badge visibility on the towers tab so idle glyphs stand out immediately.
      if (hasUnusedGlyphs) {
        resourceElements.tabGlyphBadge.removeAttribute('hidden');
        resourceElements.tabGlyphBadge.setAttribute('aria-hidden', 'false');
      } else {
        resourceElements.tabGlyphBadge.setAttribute('hidden', '');
        resourceElements.tabGlyphBadge.setAttribute('aria-hidden', 'true');
      }
    }

    const bankedMotes = getCurrentIdleMoteBank();
    if (resourceElements.tabMoteBadge) {
      const tabStoredLabel = formatGameNumber(bankedMotes);
      resourceElements.tabMoteBadge.textContent = tabStoredLabel;
      resourceElements.tabMoteBadge.setAttribute('aria-label', `${tabStoredLabel} motes in bank`);
      resourceElements.tabMoteBadge.removeAttribute('hidden');
      resourceElements.tabMoteBadge.setAttribute('aria-hidden', 'false');
    }

    const bankedDrops = getCurrentFluidDropBank();
    if (resourceElements.tabFluidBadge) {
      const tabStoredLabel = formatGameNumber(bankedDrops);
      resourceElements.tabFluidBadge.textContent = tabStoredLabel;
      resourceElements.tabFluidBadge.setAttribute('aria-label', `${tabStoredLabel} drops in bank`);
      if (powderState.fluidUnlocked) {
        resourceElements.tabFluidBadge.removeAttribute('hidden');
        resourceElements.tabFluidBadge.setAttribute('aria-hidden', 'false');
      } else {
        resourceElements.tabFluidBadge.setAttribute('hidden', '');
        resourceElements.tabFluidBadge.setAttribute('aria-hidden', 'true');
      }
    }

    // Refresh mote-specific HUD elements whenever core status displays tick.
    updateMoteStatsDisplays();
    updatePowderModeButton();
    updateFluidDisplay();
    spireMenuController.updateCounts();
  }

  const baseResources = {
    score: calculateStartingThero(),
    scoreRate: FALLBACK_BASE_SCORE_RATE,
    energyRate: FALLBACK_BASE_ENERGY_RATE,
    fluxRate: FALLBACK_BASE_FLUX_RATE,
  };

  const resourceState = {
    score: baseResources.score,
    scoreRate: baseResources.scoreRate,
    energyRate: baseResources.energyRate,
    fluxRate: baseResources.fluxRate,
    running: false,
  };

  registerResourceContainers({ baseResources, resourceState });

  const FLUID_UNLOCK_BASE_RESERVOIR_DROPS = 100; // Seed the fluid study with a base reservoir of drops upon unlock.

  const powderConfig = {
    sandOffsetInactive: 0,
    sandOffsetActive: 1.1,
    duneHeightBase: 1,
    duneHeightMax: 6,
    thetaBase: 1.3,
    zetaBase: 1.6,
    simulatedDuneGainMax: 3.4,
    wallBaseGapMotes: 5, // Start with walls 5 motes apart
    wallGapPerGlyph: 1, // Walls expand by 1 mote per glyph
    wallMaxGapMotes: 75, // Maximum wall gap of 75 motes
    wallGapViewportRatio: 0.15, // Narrow the tower walls so the visible mote lane is roughly one-fifth of the previous span.
    fluidUnlockSigils: 0, // Sigil rungs no longer gate the fluid study while glyph costs handle the unlock.
    fluidUnlockGlyphCost: 0, // Aleph glyph tithe required to unlock the fluid study (temporarily waived).
  };

  const powderState = {
    sandOffset: powderConfig.sandOffsetActive,
    duneHeight: powderConfig.duneHeightBase,
    charges: 0,
    simulatedDuneGain: 0,
    wallGlyphsLit: 0,
    glyphsAwarded: 0, // Highest Aleph index already translated into glyph currency.
    fluidGlyphsLit: 0,
    fluidGlyphsAwarded: 0, // Highest Bet index already translated into Bet glyph currency.
    idleMoteBank: 0,
    idleDrainRate: 0,
    pendingMoteDrops: [],
    idleBankHydrated: false, // Tracks whether the active simulation already holds the saved idle motes.
    fluidIdleBank: 0,
    fluidIdleDrainRate: 0,
    pendingFluidDrops: [],
    fluidBankHydrated: false,
    motePalette: mergeMotePalette(DEFAULT_MOTE_PALETTE),
    simulationMode: 'sand',
    wallGapTarget: powderConfig.wallBaseGapMotes,
    modeSwitchPending: false,
    fluidProfileLabel: 'Bet Spire',
    fluidUnlocked: false,
    // Track pointer gestures for the powder basin camera controls.
    viewInteraction: null,
    // Cache the latest camera transform so overlays sync even before the simulation emits.
    viewTransform: null,
    // Preserve serialized simulation payloads until the active basin is ready to restore them.
    loadedSimulationState: null,
    loadedFluidState: null,
    // Track whether initial page load restoration has been completed (once per session)
    initialLoadRestored: false,
    fluidInitialLoadRestored: false,
  };

  const { getPowderBasinSnapshot, applyPowderBasinSnapshot } = createPowderPersistence({
    powderState,
    powderConfig,
    mergeMotePalette,
    applyMindGatePaletteToDom,
    updateFluidTabAvailability,
    schedulePowderBasinSave,
    getPowderSimulation: () => powderSimulation,
    getFluidSimulation: () => fluidSimulationInstance,
  });

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

  // Track idle reserves for advanced spires so their banks persist outside of active simulations.
  const spireResourceState = {
    lamed: {
      sparkBank: 0,
      unlocked: false,
      dragLevel: 0,
      starMass: 10,
      stats: {
        totalAbsorptions: 0,
        totalMassGained: 0,
      },
    },
    tsadi: {
      particleBank: 0,
      unlocked: false,
      stats: {
        totalParticles: 0,
        totalGlyphs: 0,
      },
    },
    shin: {
      unlocked: false,
    },
    kuf: {
      unlocked: false,
    },
  };

  trackedLamedGlyphs = Math.max(0, Math.floor(spireResourceState.lamed.stats.totalAbsorptions || 0));
  trackedTsadiGlyphs = Math.max(0, Math.floor(spireResourceState.tsadi.stats.totalGlyphs || 0));

  // Controller that wires the floating spire navigation UI and count displays.
  const spireMenuController = createSpireFloatingMenuController({
    formatGameNumber,
    formatWholeNumber,
    getCurrentIdleMoteBank,
    getCurrentFluidDropBank,
    getLamedSparkBank,
    getTsadiParticleBank,
    getShinGlyphs,
    getKufGlyphs,
    isFluidUnlocked: () => Boolean(powderState.fluidUnlocked),
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

  /**
   * Retrieve the current spark reserve for the Lamed Spire.
   * @returns {number}
   */
  function getLamedSparkBank() {
    const bank = spireResourceState.lamed?.sparkBank;
    return Number.isFinite(bank) ? Math.max(0, bank) : 0;
  }

  /**
   * Persist a new spark reserve total and refresh connected UI readouts.
   * @param {number} value - Updated spark bank
   * @returns {number} Normalized spark bank value
   */
  function setLamedSparkBank(value) {
    const normalized = Number.isFinite(value) ? Math.max(0, value) : 0;
    const current = getLamedSparkBank();
    if (normalized === current) {
      return current;
    }
    spireResourceState.lamed.sparkBank = normalized;
    spireMenuController.updateCounts();
    return normalized;
  }

  /**
   * Ensure the Lamed bank starts with a seed reserve the first time the spire unlocks.
   */
  function ensureLamedBankSeeded() {
    if (spireResourceState.lamed.unlocked) {
      return;
    }
    spireResourceState.lamed.unlocked = true;
    if (getLamedSparkBank() < 100) {
      setLamedSparkBank(100);
    } else {
      spireMenuController.updateCounts();
    }
  }

  /**
   * Retrieve the current particle reserve for the Tsadi Spire.
   * @returns {number}
   */
  function getTsadiParticleBank() {
    const bank = spireResourceState.tsadi?.particleBank;
    return Number.isFinite(bank) ? Math.max(0, bank) : 0;
  }

  /**
   * Persist a new particle reserve total and refresh connected UI readouts.
   * @param {number} value - Updated particle bank
   * @returns {number} Normalized particle bank value
   */
  function setTsadiParticleBank(value) {
    const normalized = Number.isFinite(value) ? Math.max(0, value) : 0;
    const current = getTsadiParticleBank();
    if (normalized === current) {
      return current;
    }
    spireResourceState.tsadi.particleBank = normalized;
    spireMenuController.updateCounts();
    return normalized;
  }

  /**
   * Seed the Tsadi bank when the spire is first unlocked so particles can spawn immediately.
   */
  function ensureTsadiBankSeeded() {
    if (spireResourceState.tsadi.unlocked) {
      return;
    }
    spireResourceState.tsadi.unlocked = true;
    if (getTsadiParticleBank() < 100) {
      setTsadiParticleBank(100);
    } else {
      spireMenuController.updateCounts();
    }
  }
  
  /**
   * Bind Tsadi upgrade button click handlers
   */
  function bindTsadiUpgradeButtons() {
    const repellingButton = document.getElementById('tsadi-upgrade-repelling-button');
    const tierButton = document.getElementById('tsadi-upgrade-tier-button');
    
    if (repellingButton) {
      repellingButton.addEventListener('click', () => {
        if (tsadiSimulationInstance && tsadiSimulationInstance.purchaseRepellingForceReduction()) {
          updateTsadiUpgradeUI();
          spireMenuController.updateCounts();
        }
      });
    }
    
    if (tierButton) {
      tierButton.addEventListener('click', () => {
        if (tsadiSimulationInstance && tsadiSimulationInstance.purchaseStartingTierUpgrade()) {
          updateTsadiUpgradeUI();
          spireMenuController.updateCounts();
        }
      });
    }
  }
  
  /**
   * Update Tsadi upgrade UI elements
   */
  function updateTsadiUpgradeUI() {
    if (!tsadiSimulationInstance) return;
    
    const upgradeInfo = tsadiSimulationInstance.getUpgradeInfo();
    
    // Update repelling force upgrade
    const repellingLevel = document.getElementById('tsadi-upgrade-repelling-level');
    const repellingCost = document.getElementById('tsadi-upgrade-repelling-cost');
    const repellingButton = document.getElementById('tsadi-upgrade-repelling-button');
    const repellingDesc = document.getElementById('tsadi-upgrade-repelling-description');
    
    if (repellingLevel) {
      repellingLevel.textContent = `Level ${upgradeInfo.repellingForceReduction.level}`;
    }
    if (repellingCost) {
      repellingCost.textContent = `Cost: ${upgradeInfo.repellingForceReduction.cost} Particles`;
    }
    if (repellingButton) {
      repellingButton.disabled = !upgradeInfo.repellingForceReduction.canAfford;
    }
    if (repellingDesc) {
      const effect = upgradeInfo.repellingForceReduction.effect;
      repellingDesc.textContent = `Reduces particle repelling force by 50% per level. Current: ${effect}. When force becomes negative, particles attract instead of repel.`;
    }
    
    // Update starting tier upgrade
    const tierLevel = document.getElementById('tsadi-upgrade-tier-level');
    const tierCost = document.getElementById('tsadi-upgrade-tier-cost');
    const tierButton = document.getElementById('tsadi-upgrade-tier-button');
    const tierDesc = document.getElementById('tsadi-upgrade-tier-description');
    
    if (tierLevel) {
      tierLevel.textContent = `Level ${upgradeInfo.startingTier.level}`;
    }
    if (tierCost) {
      tierCost.textContent = `Cost: ${upgradeInfo.startingTier.cost} Particles`;
    }
    if (tierButton) {
      tierButton.disabled = !upgradeInfo.startingTier.canAfford;
    }
    if (tierDesc) {
      tierDesc.textContent = `Increases the tier of particles spawned into the simulation. Current: ${upgradeInfo.startingTier.effect}.`;
    }
  }

  // Initialize the Towers tab emblem to the default mote palette before any theme swaps occur.
  applyMindGatePaletteToDom(powderState.motePalette);

  function reconcileGlyphCurrencyFromState() {
    const awarded = Number.isFinite(powderState.glyphsAwarded)
      ? Math.max(0, Math.floor(powderState.glyphsAwarded))
      : 0;
    const invested = Math.max(0, calculateInvestedGlyphs());
    const available = Math.max(0, awarded - invested);
    setGlyphCurrency(available);
    return { awarded, invested, available };
  }

  const fluidElements = {
    tabStack: null, // Container that hosts the split spire tab controls.
    powderTabButton: null, // Reference to the mote spire trigger that occupies the top half of the split button.
    tabButton: null,
    panel: null,
    host: null,
    simulationCard: null,
    canvas: null,
    basin: null,
    viewport: null,
    leftWall: null,
    rightWall: null,
    leftHitbox: null,
    rightHitbox: null,
    profileLabel: null,
    stateLabel: null,
    depthValue: null,
    reservoirValue: null,
    dripRateValue: null,
    statusNote: null,
    returnButton: null,
    wallGlyphColumns: [],
  };

  // Collect references to the Bet Spire UI so powderDisplay can hydrate the fluid viewport.
  function bindFluidControls() {
    fluidElements.panel = document.getElementById('panel-fluid');
    fluidElements.host = document.getElementById('fluid-simulation-host');
    fluidElements.simulationCard = document.getElementById('fluid-simulation-card');
    fluidElements.canvas = document.getElementById('fluid-canvas');
    fluidElements.basin = document.getElementById('fluid-basin');
    fluidElements.viewport = document.getElementById('fluid-viewport');
    fluidElements.leftWall = document.getElementById('fluid-wall-left');
    fluidElements.rightWall = document.getElementById('fluid-wall-right');
    fluidElements.leftHitbox = document.getElementById('fluid-wall-hitbox-left');
    fluidElements.rightHitbox = document.getElementById('fluid-wall-hitbox-right');
    fluidElements.profileLabel = document.getElementById('fluid-profile-label');
    fluidElements.stateLabel = document.getElementById('fluid-state-label');
    fluidElements.depthValue = document.getElementById('fluid-depth');
    fluidElements.reservoirValue = document.getElementById('fluid-reservoir');
    fluidElements.dripRateValue = document.getElementById('fluid-drip-rate');
    fluidElements.statusNote = document.getElementById('fluid-status-note');
    fluidElements.wallGlyphColumns = Array.from(
      document.querySelectorAll('[data-fluid-glyph-column]') || [],
    );
  }

  const FLUX_OVERVIEW_IS_STUB = true;
  const SIGIL_LADDER_IS_STUB = true;

  // Align the Towers tab Mind Gate emblem with the active mote palette so the UI mirrors the canvas exponent glow.
  function applyMindGatePaletteToDom(palette) {
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    if (!root || typeof root.style?.setProperty !== 'function') {
      return;
    }
    const stops = resolvePaletteColorStops(palette);
    if (!Array.isArray(stops) || stops.length === 0) {
      return;
    }

    const denominator = Math.max(1, stops.length - 1);
    const maxAlpha = 0.32;
    const minAlpha = 0.18;
    const gradientParts = [];
    stops.forEach((stop, index) => {
      const offset = denominator === 0 ? 0 : index / denominator;
      const alpha = maxAlpha - (maxAlpha - minAlpha) * offset;
      const color = colorToRgbaString(stop, alpha);
      const percent = Math.round(offset * 100);
      gradientParts.push(`${color} ${percent}%`);
    });
    if (gradientParts.length === 1) {
      gradientParts.push(`${colorToRgbaString(stops[0], minAlpha)} 100%`);
    }

    const gradientValue = `linear-gradient(140deg, ${gradientParts.join(', ')})`;
    root.style.setProperty('--mind-gate-gradient', gradientValue);

    const primaryStop = stops[stops.length - 1];
    const secondaryStop = stops[0];
    root.style.setProperty('--mind-gate-highlight', colorToRgbaString(primaryStop, 0.92));
    root.style.setProperty('--mind-gate-glow-primary', colorToRgbaString(primaryStop, 0.55));
    root.style.setProperty('--mind-gate-icon-glow', colorToRgbaString(primaryStop, 0.55));
    root.style.setProperty('--mind-gate-text-glow', colorToRgbaString(primaryStop, 0.65));
    root.style.setProperty('--mind-gate-glow-secondary', colorToRgbaString(secondaryStop, 0.3));
  }

  // Refresh the mote gem inventory card so collected crystals mirror the latest drop ledger.
  function updateMoteGemInventoryDisplay() {
    const { gemInventoryList, gemInventoryEmpty, craftingButton } = powderElements;
    if (!gemInventoryList) {
      return;
    }

    const entries = Array.from(moteGemState.inventory.entries())
      .map(([typeKey, record = {}]) => {
        const label = typeof record.label === 'string' && record.label.trim().length
          ? record.label.trim()
          : typeKey;
        const total = Number.isFinite(record.total) ? Math.max(0, record.total) : 0;
        const count = Number.isFinite(record.count) ? Math.max(0, Math.floor(record.count)) : 0;
        return { typeKey, label, total, count };
      })
      .filter((entry) => entry.total > 0 || entry.count > 0)
      .sort((a, b) => {
        if (b.total !== a.total) {
          return b.total - a.total;
        }
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.label.localeCompare(b.label);
      });

    gemInventoryList.textContent = '';

    if (!entries.length) {
      gemInventoryList.setAttribute('aria-hidden', 'true');
      gemInventoryList.hidden = true;
      if (gemInventoryEmpty) {
        gemInventoryEmpty.hidden = false;
        gemInventoryEmpty.setAttribute('aria-hidden', 'false');
      }
      if (craftingButton) {
        craftingButton.disabled = false;
        craftingButton.removeAttribute('aria-disabled');
      }
      return;
    }

    const fragment = document.createDocumentFragment();
    entries.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'powder-gem-inventory__item';
      item.dataset.gemId = entry.typeKey;

      const labelContainer = document.createElement('span');
      labelContainer.className = 'powder-gem-inventory__label';

      const swatch = document.createElement('span');
      swatch.className = 'powder-gem-inventory__swatch';
      const spritePath = getGemSpriteAssetPath(entry.typeKey);
      if (spritePath) {
        // Embed the gem sprite so the inventory mirrors the drop art one-to-one.
        swatch.classList.add('powder-gem-inventory__swatch--sprite');
        const spriteImg = document.createElement('img');
        spriteImg.className = 'powder-gem-inventory__sprite';
        spriteImg.decoding = 'async';
        spriteImg.loading = 'lazy';
        spriteImg.alt = '';
        spriteImg.src = spritePath;
        swatch.appendChild(spriteImg);
      } else {
        // Fall back to the procedural color when the sprite asset is unavailable.
        const color = getMoteGemColor(entry.typeKey);
        if (color && typeof swatch.style?.setProperty === 'function') {
          if (Number.isFinite(color.hue)) {
            swatch.style.setProperty('--gem-hue', `${Math.round(color.hue)}`);
          }
          if (Number.isFinite(color.saturation)) {
            swatch.style.setProperty('--gem-saturation', `${Math.round(color.saturation)}%`);
          }
          if (Number.isFinite(color.lightness)) {
            swatch.style.setProperty('--gem-lightness', `${Math.round(color.lightness)}%`);
          }
        }
      }

      const nameEl = document.createElement('span');
      nameEl.className = 'powder-gem-inventory__name';
      nameEl.textContent = entry.label || entry.typeKey;

      labelContainer.appendChild(swatch);
      labelContainer.appendChild(nameEl);

      const countEl = document.createElement('span');
      countEl.className = 'powder-gem-inventory__count';
      const clusterLabel = entry.count === 1 ? 'cluster' : 'clusters';
      const moteLabel = entry.total === 1 ? 'Mote' : 'Motes';
      countEl.textContent = `${formatWholeNumber(entry.count)} ${clusterLabel} · ${formatGameNumber(
        entry.total,
      )} ${moteLabel}`;

      item.appendChild(labelContainer);
      item.appendChild(countEl);
      fragment.appendChild(item);
    });

    gemInventoryList.hidden = false;
    gemInventoryList.setAttribute('aria-hidden', 'false');
    gemInventoryList.appendChild(fragment);

    if (gemInventoryEmpty) {
      gemInventoryEmpty.hidden = true;
      gemInventoryEmpty.setAttribute('aria-hidden', 'true');
    }

    if (craftingButton) {
      craftingButton.disabled = false;
      craftingButton.removeAttribute('aria-disabled');
    }
  }

  // Powder simulation metrics are supplied via the powder tower module.
  const powderGlyphColumns = [];
  const fluidGlyphColumns = [];
  let powderWallMetrics = null;
  let fluidWallMetrics = null;

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
    formatSignedPercentage,
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
    FLUX_OVERVIEW_IS_STUB,
    SIGIL_LADDER_IS_STUB,
    getPowderSimulation: () => powderSimulation,
    spireResourceState,
    addIdleMoteBank,
    getLamedSparkBank,
    setLamedSparkBank,
    getTsadiParticleBank,
    setTsadiParticleBank,
    addIterons,
    updateShinDisplay,
    evaluateAchievements,
    spireMenuController,
    gameStats,
    getCompletedInteractiveLevelCount,
    getIteronBank,
    getIterationRate,
  });

  // Provide the developer controls module with runtime state references once all powder helpers are wired.
  configureDeveloperControls({
    isDeveloperModeActive: () => developerModeActive,
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

  function updatePowderGlyphColumns(info = {}) {
    const rows = Number.isFinite(info.rows) && info.rows > 0 ? info.rows : 1;
    const cellSize = Number.isFinite(info.cellSize) && info.cellSize > 0 ? info.cellSize : POWDER_CELL_SIZE_PX;
    const scrollOffset = Number.isFinite(info.scrollOffset) ? Math.max(0, info.scrollOffset) : 0;
    const highestRawInput = Number.isFinite(info.highestNormalized) ? info.highestNormalized : 0;
    const totalRawInput = Number.isFinite(info.totalNormalized) ? info.totalNormalized : highestRawInput;
    const highestNormalized = Math.max(0, highestRawInput, totalRawInput);
    const GLYPH_SPACING_NORMALIZED = 0.5;
    const GLYPH_BASE_NORMALIZED = GLYPH_SPACING_NORMALIZED;
    const safeRows = Math.max(1, rows);
    const basinHeight = safeRows * cellSize;
    const viewTopNormalized = scrollOffset / safeRows;
    const viewBottomNormalized = (scrollOffset + safeRows) / safeRows;
    const bufferGlyphs = 2;

    const normalizeIndex = (value) => {
      if (!Number.isFinite(value)) {
        return 0;
      }
      return Math.floor((value - GLYPH_BASE_NORMALIZED) / GLYPH_SPACING_NORMALIZED);
    };

    const rawMinIndex = normalizeIndex(viewTopNormalized);
    const rawMaxIndex = Math.ceil(
      (viewBottomNormalized - GLYPH_BASE_NORMALIZED) / GLYPH_SPACING_NORMALIZED,
    );
    const minIndex = Math.max(0, (Number.isFinite(rawMinIndex) ? rawMinIndex : 0) - bufferGlyphs);
    const maxIndex = Math.max(
      minIndex,
      (Number.isFinite(rawMaxIndex) ? rawMaxIndex : 0) + bufferGlyphs,
    );

    const glyphHeightForIndex = (index) =>
      GLYPH_BASE_NORMALIZED + Math.max(0, index) * GLYPH_SPACING_NORMALIZED;

    if (powderGlyphColumns.length) {
      powderGlyphColumns.forEach((column) => {
        column.glyphs.forEach((glyph, index) => {
          if (index < minIndex || index > maxIndex) {
            column.element.removeChild(glyph);
            column.glyphs.delete(index);
          }
        });

        for (let index = minIndex; index <= maxIndex; index += 1) {
          let glyph = column.glyphs.get(index);
          if (!glyph) {
            glyph = document.createElement('span');
            glyph.className = 'powder-glyph';
            glyph.dataset.alephIndex = String(index);
            column.element.appendChild(glyph);
            column.glyphs.set(index, glyph);
          }
          glyph.textContent = formatAlephLabel(index);
          const glyphNormalized = glyphHeightForIndex(index);
          const relativeRows = glyphNormalized * safeRows - scrollOffset;
          const topPx = basinHeight - relativeRows * cellSize;
          glyph.style.top = `${topPx.toFixed(1)}px`;
          const achieved = highestNormalized >= glyphNormalized;
          glyph.classList.toggle('powder-glyph--achieved', achieved);
        }
      });
    }

    const glyphsLit =
      highestNormalized >= GLYPH_BASE_NORMALIZED
        ? Math.max(
            0,
            Math.floor((highestNormalized - GLYPH_BASE_NORMALIZED) / GLYPH_SPACING_NORMALIZED) + 1,
          )
        : 0;
    const achievedIndex = glyphsLit > 0 ? glyphsLit - 1 : 0;
    const nextIndex = glyphsLit;
    const previousThreshold =
      glyphsLit > 0
        ? GLYPH_BASE_NORMALIZED + (glyphsLit - 1) * GLYPH_SPACING_NORMALIZED
        : 0;
    const nextThreshold = GLYPH_BASE_NORMALIZED + glyphsLit * GLYPH_SPACING_NORMALIZED;
    const span = Math.max(GLYPH_SPACING_NORMALIZED, nextThreshold - previousThreshold);
    const progressFraction = clampUnitInterval((highestNormalized - previousThreshold) / span);
    const remainingToNext = Math.max(0, nextThreshold - highestNormalized);

    if (powderGlyphColumns.length) {
      powderGlyphColumns.forEach((column) => {
        column.glyphs.forEach((glyph, index) => {
          const isTarget = index === nextIndex;
          const glyphNormalized = glyphHeightForIndex(index);
          glyph.classList.toggle('powder-glyph--target', isTarget);
          glyph.classList.toggle('powder-glyph--achieved', highestNormalized >= glyphNormalized);
        });
      });
    }

    return {
      achievedCount: achievedIndex,
      nextIndex,
      highestRaw: highestNormalized,
      glyphsLit,
      progressFraction,
      remainingToNext,
    };
  }

  function updateFluidGlyphColumns(info = {}) {
    const rows = Number.isFinite(info.rows) && info.rows > 0 ? info.rows : 1;
    const cellSize = Number.isFinite(info.cellSize) && info.cellSize > 0 ? info.cellSize : POWDER_CELL_SIZE_PX;
    const scrollOffset = Number.isFinite(info.scrollOffset) ? Math.max(0, info.scrollOffset) : 0;
    const highestRawInput = Number.isFinite(info.highestNormalized) ? info.highestNormalized : 0;
    const totalRawInput = Number.isFinite(info.totalNormalized) ? info.totalNormalized : highestRawInput;
    const highestNormalized = Math.max(0, highestRawInput, totalRawInput);
    const GLYPH_SPACING_NORMALIZED = 0.5;
    const GLYPH_BASE_NORMALIZED = GLYPH_SPACING_NORMALIZED;
    const safeRows = Math.max(1, rows);
    const basinHeight = safeRows * cellSize;
    const viewTopNormalized = scrollOffset / safeRows;
    const viewBottomNormalized = (scrollOffset + safeRows) / safeRows;
    const bufferGlyphs = 2;

    const normalizeIndex = (value) => {
      if (!Number.isFinite(value)) {
        return 0;
      }
      return Math.floor((value - GLYPH_BASE_NORMALIZED) / GLYPH_SPACING_NORMALIZED);
    };

    const rawMinIndex = normalizeIndex(viewTopNormalized);
    const rawMaxIndex = Math.ceil(
      (viewBottomNormalized - GLYPH_BASE_NORMALIZED) / GLYPH_SPACING_NORMALIZED,
    );
    const minIndex = Math.max(0, (Number.isFinite(rawMinIndex) ? rawMinIndex : 0) - bufferGlyphs);
    const maxIndex = Math.max(
      minIndex,
      (Number.isFinite(rawMaxIndex) ? rawMaxIndex : 0) + bufferGlyphs,
    );

    const glyphHeightForIndex = (index) =>
      GLYPH_BASE_NORMALIZED + Math.max(0, index) * GLYPH_SPACING_NORMALIZED;

    if (fluidGlyphColumns.length) {
      fluidGlyphColumns.forEach((column) => {
        const isLeftWall = column.side === 'left';
        
        // Only show Bet glyphs on the right wall; left wall should be empty
        if (isLeftWall) {
          // Clear all glyphs from left wall
          column.glyphs.forEach((glyph, index) => {
            column.element.removeChild(glyph);
            column.glyphs.delete(index);
          });
          return;
        }
        
        // Collect indices to delete before modifying the Map
        const indicesToDelete = [];
        column.glyphs.forEach((glyph, index) => {
          if (index < minIndex || index > maxIndex) {
            indicesToDelete.push(index);
          }
        });
        
        // Remove out-of-range glyphs
        indicesToDelete.forEach((index) => {
          const glyph = column.glyphs.get(index);
          if (glyph) {
            column.element.removeChild(glyph);
            column.glyphs.delete(index);
          }
        });

        // Create or update glyphs in the visible range (only Bet glyphs on right wall)
        for (let index = minIndex; index <= maxIndex; index += 1) {
          let glyph = column.glyphs.get(index);
          if (!glyph) {
            glyph = document.createElement('span');
            glyph.className = 'powder-glyph';
            glyph.dataset.betIndex = String(index);
            column.element.appendChild(glyph);
            column.glyphs.set(index, glyph);
          }
          glyph.textContent = formatBetLabel(index);
          const glyphNormalized = glyphHeightForIndex(index);
          const relativeRows = glyphNormalized * safeRows - scrollOffset;
          const topPx = basinHeight - relativeRows * cellSize;
          glyph.style.top = `${topPx.toFixed(1)}px`;
          const achieved = highestNormalized >= glyphNormalized;
          glyph.classList.toggle('powder-glyph--achieved', achieved);
        }
      });
    }

    const glyphsLit =
      highestNormalized >= GLYPH_BASE_NORMALIZED
        ? Math.max(
            0,
            Math.floor((highestNormalized - GLYPH_BASE_NORMALIZED) / GLYPH_SPACING_NORMALIZED) + 1,
          )
        : 0;
    const achievedIndex = glyphsLit > 0 ? glyphsLit - 1 : 0;
    const nextIndex = glyphsLit;
    const previousThreshold =
      glyphsLit > 0
        ? GLYPH_BASE_NORMALIZED + (glyphsLit - 1) * GLYPH_SPACING_NORMALIZED
        : 0;
    const nextThreshold = GLYPH_BASE_NORMALIZED + glyphsLit * GLYPH_SPACING_NORMALIZED;
    const span = Math.max(GLYPH_SPACING_NORMALIZED, nextThreshold - previousThreshold);
    const progressFraction = clampUnitInterval((highestNormalized - previousThreshold) / span);
    const remainingToNext = Math.max(0, nextThreshold - highestNormalized);

    if (fluidGlyphColumns.length) {
      fluidGlyphColumns.forEach((column) => {
        column.glyphs.forEach((glyph, index) => {
          const isTarget = index === nextIndex;
          const glyphNormalized = glyphHeightForIndex(index);
          glyph.classList.toggle('powder-glyph--target', isTarget);
          glyph.classList.toggle('powder-glyph--achieved', highestNormalized >= glyphNormalized);
        });
      });
    }

    return {
      achievedCount: achievedIndex,
      nextIndex,
      highestRaw: highestNormalized,
      glyphsLit,
      progressFraction,
      remainingToNext,
    };
  }

  function getElementsForSimulation(simulation) {
    if (simulation && simulation === fluidSimulationInstance) {
      return fluidElements;
    }
    return powderElements;
  }

  // Apply the active camera transform to the overlay container so the decorative walls
  // match the powder simulation's zoom and pan state.
  function applyPowderViewportTransform(transform, simulation = powderSimulation) {
    const elements = getElementsForSimulation(simulation);
    const viewport = elements?.viewport;
    if (!viewport) {
      return;
    }
    if (!transform) {
      viewport.style.transform = '';
      return;
    }
    const width = Number.isFinite(transform.width) ? transform.width : 0;
    const height = Number.isFinite(transform.height) ? transform.height : 0;
    const scale = Number.isFinite(transform.scale) && transform.scale > 0 ? transform.scale : 1;
    if (!width || !height) {
      viewport.style.transform = '';
      return;
    }
    const centerX = Number.isFinite(transform.center?.x) ? transform.center.x : width / 2;
    const centerY = Number.isFinite(transform.center?.y) ? transform.center.y : height / 2;
    const translateToCenter = `translate(${(width / 2).toFixed(3)}px, ${(height / 2).toFixed(3)}px)`;
    const scalePart = `scale(${scale.toFixed(5)})`;
    const translateToOrigin = `translate(${(-centerX).toFixed(3)}px, ${(-centerY).toFixed(3)}px)`;
    viewport.style.transform = `${translateToCenter} ${scalePart} ${translateToOrigin}`;
  }

  // Store and broadcast camera transform updates emitted by the powder simulation.
  function handlePowderViewTransformChange(transform) {
    powderState.viewTransform = transform || null;
    applyPowderViewportTransform(transform || null, powderSimulation);
    // Schedule a basin save so camera adjustments persist across reloads.
    schedulePowderBasinSave();
  }

  function syncPowderWallVisuals(metrics) {
    const isFluidActive = powderSimulation === fluidSimulationInstance;
    const cachedMetrics = isFluidActive ? fluidWallMetrics : powderWallMetrics;
    const activeMetrics =
      metrics || cachedMetrics || (powderSimulation ? powderSimulation.getWallMetrics() : null);
    if (!activeMetrics) {
      return;
    }

    const { leftCells, rightCells, gapCells, cellSize, gapPixels } = activeMetrics;
    const leftWidth = Math.max(0, leftCells * cellSize);
    const rightWidth = Math.max(0, rightCells * cellSize);
    const gapWidth = Number.isFinite(gapPixels)
      ? Math.max(0, gapPixels)
      : Math.max(0, gapCells * cellSize); // Use the simulated span so DOM walls hug the water surface.

    const activeElements = getElementsForSimulation(powderSimulation);
    const inactiveElements = activeElements === powderElements ? fluidElements : powderElements;

    if (activeElements.leftWall) {
      activeElements.leftWall.style.width = `${leftWidth.toFixed(1)}px`;
    }
    if (activeElements.rightWall) {
      activeElements.rightWall.style.width = `${rightWidth.toFixed(1)}px`;
    }
    if (activeElements.leftHitbox) {
      activeElements.leftHitbox.style.width = `${leftWidth.toFixed(1)}px`;
    }
    if (activeElements.rightHitbox) {
      activeElements.rightHitbox.style.width = `${rightWidth.toFixed(1)}px`;
    }
    if (activeElements.basin) {
      activeElements.basin.style.setProperty('--powder-gap-width', `${gapWidth.toFixed(1)}px`);
    }

    if (inactiveElements.leftWall) {
      inactiveElements.leftWall.style.removeProperty('width');
    }
    if (inactiveElements.rightWall) {
      inactiveElements.rightWall.style.removeProperty('width');
    }
    if (inactiveElements.leftHitbox) {
      inactiveElements.leftHitbox.style.removeProperty('width');
    }
    if (inactiveElements.rightHitbox) {
      inactiveElements.rightHitbox.style.removeProperty('width');
    }
  }

  function updatePowderHitboxVisibility() {
    const isFluidActive = powderSimulation === fluidSimulationInstance;
    const cachedMetrics = isFluidActive ? fluidWallMetrics : powderWallMetrics;
    const metrics = cachedMetrics || (powderSimulation ? powderSimulation.getWallMetrics() : null);
    const showHitboxes = developerModeActive && metrics;
    const activeElements = getElementsForSimulation(powderSimulation);
    const inactiveElements = activeElements === powderElements ? fluidElements : powderElements;

    if (activeElements.leftHitbox) {
      activeElements.leftHitbox.classList.toggle(
        'powder-wall-hitbox--visible',
        Boolean(showHitboxes && metrics?.leftCells > 0),
      );
    }
    if (activeElements.rightHitbox) {
      activeElements.rightHitbox.classList.toggle(
        'powder-wall-hitbox--visible',
        Boolean(showHitboxes && metrics?.rightCells > 0),
      );
    }
    if (inactiveElements.leftHitbox) {
      inactiveElements.leftHitbox.classList.remove('powder-wall-hitbox--visible');
    }
    if (inactiveElements.rightHitbox) {
      inactiveElements.rightHitbox.classList.remove('powder-wall-hitbox--visible');
    }
  }

  function handlePowderWallMetricsChange(metrics, source) {
    const origin = source || (powderSimulation === fluidSimulationInstance ? 'fluid' : 'sand');
    if (origin === 'fluid') {
      fluidWallMetrics = metrics || null;
    } else {
      powderWallMetrics = metrics || null;
    }
    syncPowderWallVisuals(metrics || undefined);
    updatePowderHitboxVisibility();
    // Queue a basin snapshot so wall spacing changes survive future sessions.
    schedulePowderBasinSave();
  }

  function updatePowderWallGapFromGlyphs(glyphCount) {
    const normalized = Number.isFinite(glyphCount) ? Math.max(0, glyphCount) : 0;
    const rawTarget = powderConfig.wallBaseGapMotes + normalized * powderConfig.wallGapPerGlyph;
    const target = Math.min(rawTarget, powderConfig.wallMaxGapMotes);
    powderState.wallGapTarget = target;
    if (!powderSimulation) {
      // Persist glyph-driven wall targets even if the simulation is paused.
      schedulePowderBasinSave();
      return;
    }
    powderSimulation.setWallGapTarget(target);
    powderWallMetrics = powderSimulation.getWallMetrics();
    syncPowderWallVisuals(powderWallMetrics);
    updatePowderHitboxVisibility();
    // Record the updated gap so reloads mirror the active glyph bonus.
    schedulePowderBasinSave();
  }

  /**
   * Update visibility for all spire tabs based on unlock status
   */
  function updateSpireTabVisibility() {
    updateFluidTabAvailability();

    /**
     * Toggle visibility for the floating menu toggle button that lives inside a spire panel.
     * @param {string} spireId - Identifier suffix for the spire toggle.
     * @param {boolean} unlocked - Whether the spire should be visible.
     */
    function syncSpireToggle(spireId, unlocked) {
      const toggle = document.getElementById(`spire-menu-toggle-${spireId}`);
      if (!toggle) {
        return;
      }
      if (unlocked) {
        toggle.removeAttribute('hidden');
        toggle.setAttribute('aria-hidden', 'false');
        toggle.disabled = false;
      } else {
        toggle.setAttribute('hidden', '');
        toggle.setAttribute('aria-hidden', 'true');
        toggle.disabled = true;
        toggle.classList.remove('spire-menu-toggle--active');
        toggle.setAttribute('aria-expanded', 'false');
      }
    }

    // Update Lamed tab
    const lamedTab = document.getElementById('tab-lamed');
    if (lamedTab) {
      if (spireResourceState.lamed.unlocked) {
        lamedTab.removeAttribute('hidden');
        lamedTab.setAttribute('aria-hidden', 'false');
        lamedTab.disabled = false;
      } else {
        lamedTab.setAttribute('hidden', '');
        lamedTab.setAttribute('aria-hidden', 'true');
        lamedTab.disabled = true;
      }
    }
    syncSpireToggle('lamed', Boolean(spireResourceState.lamed.unlocked));

    // Update Tsadi tab
    const tsadiTab = document.getElementById('tab-tsadi');
    if (tsadiTab) {
      if (spireResourceState.tsadi.unlocked) {
        tsadiTab.removeAttribute('hidden');
        tsadiTab.setAttribute('aria-hidden', 'false');
        tsadiTab.disabled = false;
      } else {
        tsadiTab.setAttribute('hidden', '');
        tsadiTab.setAttribute('aria-hidden', 'true');
        tsadiTab.disabled = true;
      }
    }
    syncSpireToggle('tsadi', Boolean(spireResourceState.tsadi.unlocked));

    // Update Shin tab
    const shinTab = document.getElementById('tab-shin');
    if (shinTab) {
      if (spireResourceState.shin?.unlocked) {
        shinTab.removeAttribute('hidden');
        shinTab.setAttribute('aria-hidden', 'false');
        shinTab.disabled = false;
      } else {
        shinTab.setAttribute('hidden', '');
        shinTab.setAttribute('aria-hidden', 'true');
        shinTab.disabled = true;
      }
    }
    syncSpireToggle('shin', Boolean(spireResourceState.shin?.unlocked));

    // Update Kuf tab
    const kufTab = document.getElementById('tab-kuf');
    if (kufTab) {
      if (spireResourceState.kuf?.unlocked) {
        kufTab.removeAttribute('hidden');
        kufTab.setAttribute('aria-hidden', 'false');
        kufTab.disabled = false;
      } else {
        kufTab.setAttribute('hidden', '');
        kufTab.setAttribute('aria-hidden', 'true');
        kufTab.disabled = true;
      }
    }
    syncSpireToggle('kuf', Boolean(spireResourceState.kuf?.unlocked));
  }

  function updateFluidTabAvailability() {
    if (!fluidElements.tabStack) {
      // Cache the split tab wrapper so we can toggle stacked layout states when the fluid study unlocks.
      fluidElements.tabStack = document.getElementById('tab-powder-stack');
    }
    if (!fluidElements.powderTabButton) {
      // Store the top-half button reference so focus/disable states can stay synchronized with the stack.
      fluidElements.powderTabButton = document.getElementById('tab-powder');
    }
    if (!fluidElements.tabButton) {
      fluidElements.tabButton = document.getElementById('tab-fluid');
    }
    const tabStack = fluidElements.tabStack;
    const powderTab = fluidElements.powderTabButton;
    const tabButton = fluidElements.tabButton;
    if (!powderTab || !tabButton) {
      return;
    }
    if (powderState.fluidUnlocked) {
      if (tabStack) {
        // Fluid unlock splits the tab so the lower half can be targeted separately.
        tabStack.classList.add('tab-button-stack--split');
        tabStack.setAttribute('aria-hidden', 'false');
      }
      tabButton.removeAttribute('hidden');
      tabButton.setAttribute('aria-hidden', 'false');
      tabButton.disabled = false;
      if (resourceElements.tabFluidBadge) {
        resourceElements.tabFluidBadge.removeAttribute('hidden');
        resourceElements.tabFluidBadge.setAttribute('aria-hidden', 'false');
      }
    } else {
      if (tabStack) {
        // Collapse the stack back into a single button while the fluid study remains locked.
        tabStack.classList.remove('tab-button-stack--split');
        tabStack.classList.remove('tab-button-stack--active');
        tabStack.setAttribute('aria-hidden', 'false');
      }
      tabButton.setAttribute('hidden', '');
      tabButton.setAttribute('aria-hidden', 'true');
      tabButton.disabled = true;
      if (resourceElements.tabFluidBadge) {
        resourceElements.tabFluidBadge.setAttribute('hidden', '');
        resourceElements.tabFluidBadge.setAttribute('aria-hidden', 'true');
      }
    }
  }

  /**
   * Update Lamed simulation statistics display in the UI.
   */
  function updateLamedStatistics() {
    if (!lamedSimulationInstance) return;
    
    const stats = lamedSimulationInstance.getStatistics();
    
    // Update tier information
    const tierEl = document.getElementById('lamed-tier');
    if (tierEl) {
      tierEl.textContent = stats.currentTier;
    }
    
    // Update star mass
    const starMassEl = document.getElementById('lamed-star-mass');
    if (starMassEl) {
      starMassEl.textContent = stats.starMass.toFixed(2);
    }
    
    // Update next milestone
    const nextTierEl = document.getElementById('lamed-next-tier');
    if (nextTierEl) {
      if (stats.nextTier === 'MAX') {
        nextTierEl.textContent = 'Maximum Tier Reached';
      } else {
        const progress = (stats.progressToNext * 100).toFixed(1);
        nextTierEl.textContent = `${stats.nextTier} (${stats.nextMilestone}) - ${progress}%`;
      }
    }
    
    // Update orbiting stars count
    const orbitingEl = document.getElementById('lamed-orbiting-count');
    if (orbitingEl) {
      orbitingEl.textContent = stats.orbitingStars;
    }
    
    // Update absorptions rate
    const absorptionsEl = document.getElementById('lamed-absorptions-rate');
    if (absorptionsEl) {
      absorptionsEl.textContent = stats.absorptionsPerMinute.toFixed(1);
    }
    
    // Update mass inflow rate
    const inflowEl = document.getElementById('lamed-mass-inflow');
    if (inflowEl) {
      inflowEl.textContent = stats.massInflowPerMinute.toFixed(2);
    }
    
    // Update drag level and coefficient
    const dragLevelEl = document.getElementById('lamed-drag-level');
    if (dragLevelEl) {
      dragLevelEl.textContent = stats.dragLevel;
    }
    
    const dragCoeffEl = document.getElementById('lamed-drag-coefficient');
    if (dragCoeffEl) {
      dragCoeffEl.textContent = stats.dragCoefficient.toFixed(2);
    }
    
    // Update drag upgrade button
    const dragBtn = document.getElementById('lamed-upgrade-drag-btn');
    const dragCostEl = document.getElementById('lamed-drag-cost');
    if (dragBtn && dragCostEl) {
      const cost = lamedSimulationInstance.getDragUpgradeCost();
      dragCostEl.textContent = formatWholeNumber(cost);
      
      if (lamedSimulationInstance.canUpgradeDrag()) {
        dragBtn.disabled = false;
        dragBtn.classList.remove('disabled');
      } else {
        dragBtn.disabled = true;
        dragBtn.classList.add('disabled');
      }
      
      // Hide button if at max level
      if (stats.dragLevel >= lamedSimulationInstance.maxDragLevel) {
        dragBtn.style.display = 'none';
      } else {
        dragBtn.style.display = '';
      }
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

  /**
   * Lazily binds pointer and wheel interactions that let players pan and zoom the powder viewport.
   * The handlers reuse the active powder simulation instance so mode switches keep gestures intact.
   */
  function initializePowderViewInteraction() {
    const simulation = powderSimulation;
    if (!simulation) {
      return;
    }

    const viewport = simulation === fluidSimulationInstance ? fluidElements.viewport : powderElements.viewport;
    if (!viewport) {
      return;
    }

    if (powderState.viewInteraction?.viewport === viewport && powderState.viewInteraction.initialized) {
      return;
    }

    if (powderState.viewInteraction?.destroy) {
      powderState.viewInteraction.destroy();
    }

    const interaction = {
      initialized: true,
      pointerId: null,
      lastPoint: null,
      viewport,
      destroy: null,
    };

    const getSimulation = () => powderSimulation;

    const clearPointerState = () => {
      if (interaction.pointerId !== null && typeof viewport.releasePointerCapture === 'function') {
        viewport.releasePointerCapture(interaction.pointerId);
      }
      interaction.pointerId = null;
      interaction.lastPoint = null;
    };

    const handlePointerDown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }
      const activeSimulation = getSimulation();
      if (!activeSimulation) {
        return;
      }
      interaction.pointerId = event.pointerId;
      interaction.lastPoint = { x: event.clientX, y: event.clientY };
      if (typeof viewport.setPointerCapture === 'function') {
        try {
          viewport.setPointerCapture(event.pointerId);
        } catch (error) {
          console.warn('Unable to capture powder viewport pointer', error);
        }
      }
    };

    const handlePointerMove = (event) => {
      if (interaction.pointerId === null || event.pointerId !== interaction.pointerId) {
        return;
      }
      const activeSimulation = getSimulation();
      if (!activeSimulation || !interaction.lastPoint) {
        return;
      }

      const dx = event.clientX - interaction.lastPoint.x;
      const dy = event.clientY - interaction.lastPoint.y;
      interaction.lastPoint = { x: event.clientX, y: event.clientY };

      const transform = activeSimulation.getViewTransform();
      if (!transform || !transform.center) {
        return;
      }

      const scale = Number.isFinite(transform.scale) && transform.scale > 0 ? transform.scale : 1;
      const nextCenter = {
        x: transform.center.x - dx / scale,
        y: transform.center.y - dy / scale,
      };
      activeSimulation.setViewCenterFromWorld(nextCenter);
    };

    const handlePointerUp = (event) => {
      if (event.pointerId !== interaction.pointerId) {
        return;
      }
      clearPointerState();
    };

    const handleWheel = (event) => {
      const activeSimulation = getSimulation();
      if (!activeSimulation) {
        return;
      }
      const delta = Number.isFinite(event.deltaY) ? event.deltaY : 0;
      if (!delta) {
        return;
      }
      const factor = delta > 0 ? 0.9 : 1.1;
      const anchorPoint = { clientX: event.clientX, clientY: event.clientY };
      const changed = activeSimulation.applyZoomFactor(factor, anchorPoint);
      if (changed) {
        event.preventDefault();
      }
    };

    viewport.addEventListener('pointerdown', handlePointerDown);
    viewport.addEventListener('pointermove', handlePointerMove);
    viewport.addEventListener('pointerup', handlePointerUp);
    viewport.addEventListener('pointercancel', handlePointerUp);
    viewport.addEventListener('pointerleave', handlePointerUp);
    viewport.addEventListener('wheel', handleWheel, { passive: false });

    interaction.destroy = () => {
      viewport.removeEventListener('pointerdown', handlePointerDown);
      viewport.removeEventListener('pointermove', handlePointerMove);
      viewport.removeEventListener('pointerup', handlePointerUp);
      viewport.removeEventListener('pointercancel', handlePointerUp);
      viewport.removeEventListener('pointerleave', handlePointerUp);
      viewport.removeEventListener('wheel', handleWheel);
      clearPointerState();
    };

    powderState.viewInteraction = interaction;
  }

  /**
   * Initialize manual drop handlers for spire viewports.
   * Allows player to click/tap or press space to drop 1 resource into the spire.
   * Does not work for Kuf spire.
   */
  function initializeManualDropHandlers() {
    // Track if pointer moved during a gesture (to distinguish clicks from drags)
    let pointerMoved = false;
    let pointerDownTime = 0;
    const MAX_CLICK_DURATION = 300; // ms
    const MAX_CLICK_MOVEMENT = 5; // px
    let startX = 0;
    let startY = 0;

    const tabForSpire = (spireType) => {
      switch (spireType) {
        case 'aleph':
          return 'powder';
        case 'bet':
          return 'fluid';
        default:
          return spireType;
      }
    };

    function handleManualDrop(spireType) {
      if (spireType === 'kuf') {
        return; // Kuf spire doesn't support manual drops
      }

      // Add 1 resource to the appropriate spire WITHOUT consuming from the bank
      switch (spireType) {
        case 'aleph':
          if (sandSimulation && typeof sandSimulation.spawnGrain === 'function') {
            // Spawn a grain directly without consuming from the bank
            // Use maxDropSize to ensure motes are 1/100th of render width
            const moteSize = sandSimulation.maxDropSize || 1;
            sandSimulation.spawnGrain({ size: moteSize, source: 'manual' });
          }
          break;
        case 'bet':
          if (fluidSimulationInstance && typeof fluidSimulationInstance.spawnGrain === 'function') {
            // Spawn a drop directly without consuming from the bank
            // Use maxDropSize to ensure drops are 1/100th of render width
            const dropSize = fluidSimulationInstance.maxDropSize || 1;
            fluidSimulationInstance.spawnGrain({ size: dropSize, source: 'manual' });
          }
          break;
        case 'lamed':
          if (lamedSimulationInstance && typeof lamedSimulationInstance.spawnStar === 'function') {
            // Spawn a star directly without consuming from the bank
            lamedSimulationInstance.spawnStar();
          }
          break;
        case 'tsadi':
          if (tsadiSimulationInstance && typeof tsadiSimulationInstance.spawnParticle === 'function') {
            // Spawn a particle directly without consuming from the bank
            tsadiSimulationInstance.spawnParticle();
          }
          break;
        case 'shin':
          // Add 1 iteron to the bank (this doesn't consume, it adds)
          addIterons(1);
          break;
      }
    }

    // Add click handlers to spire viewports
    const spireTargets = [
      { type: 'aleph', selectors: ['powder-viewport', 'powder-basin', 'powder-canvas'] },
      { type: 'bet', selectors: ['fluid-viewport', 'fluid-basin', 'fluid-canvas'] },
      { type: 'lamed', selectors: ['lamed-basin'] },
      { type: 'tsadi', selectors: ['tsadi-basin'] },
      { type: 'shin', selectors: ['shin-fractal-content'] },
    ];

    spireTargets.forEach(({ type, selectors }) => {
      const uniqueSelectors = Array.from(new Set(selectors));
      uniqueSelectors.forEach((id) => {
        const element = document.getElementById(id);
        if (!element) {
          return;
        }

        const handlePointerDown = (event) => {
          pointerMoved = false;
          pointerDownTime = Date.now();
          startX = event.clientX;
          startY = event.clientY;
        };

        const handlePointerMove = (event) => {
          const dx = Math.abs(event.clientX - startX);
          const dy = Math.abs(event.clientY - startY);
          if (dx > MAX_CLICK_MOVEMENT || dy > MAX_CLICK_MOVEMENT) {
            pointerMoved = true;
          }
        };

        const handleClick = () => {
          const duration = Date.now() - pointerDownTime;
          if (pointerMoved || duration >= MAX_CLICK_DURATION) {
            return;
          }

          const activeTab = getActiveTabId();
          if (activeTab !== tabForSpire(type)) {
            return;
          }

          handleManualDrop(type);
        };

        element.addEventListener('pointerdown', handlePointerDown);
        element.addEventListener('pointermove', handlePointerMove);
        element.addEventListener('click', handleClick);
      });
    });

    // Add spacebar handler for manual drops
    document.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.code === 'Space') {
        // Determine which spire panel is currently active
        const activeTab = getActiveTabId();
        let spireType = null;
        
        switch (activeTab) {
          case 'powder':
            spireType = 'aleph';
            break;
          case 'fluid':
            spireType = 'bet';
            break;
          case 'lamed':
            spireType = 'lamed';
            break;
          case 'tsadi':
            spireType = 'tsadi';
            break;
          case 'shin':
            spireType = 'shin';
            break;
          case 'kuf':
            // Don't allow manual drops on Kuf
            return;
        }

        if (spireType) {
          // Prevent default spacebar behavior (page scroll)
          event.preventDefault();
          handleManualDrop(spireType);
        }
      }
    });
  }

  async function applyPowderSimulationMode(mode) {
    if (mode !== 'sand' && mode !== 'fluid') {
      return;
    }
    if (powderState.modeSwitchPending) {
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
        if (previousMode !== powderState.simulationMode) {
          recordPowderEvent('mode-switch', { mode: 'sand', label: 'Powderfall Study' });
        }
      }

      if (powderSimulation === fluidSimulationInstance) {
        fluidWallMetrics = powderSimulation ? powderSimulation.getWallMetrics() : null;
      } else {
        powderWallMetrics = powderSimulation ? powderSimulation.getWallMetrics() : null;
      }
      syncPowderWallVisuals((powderSimulation === fluidSimulationInstance ? fluidWallMetrics : powderWallMetrics) || undefined);
      updatePowderHitboxVisibility();
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
      syncPowderWallVisuals();
      updatePowderHitboxVisibility();
    }
  }

  function unlockFluidStudy({ reason = 'purchase', threshold = null, glyphCost = null } = {}) {
    if (powderState.fluidUnlocked) {
      return false;
    }
    powderState.fluidUnlocked = true;
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
    if (!powderState.fluidUnlocked && alephGlyphs >= 10) {
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
    const lamedGlyphs = Math.max(0, Math.floor(spireResourceState.lamed?.stats?.totalAbsorptions || 0));
    if (!spireResourceState.tsadi.unlocked && lamedGlyphs >= 10) {
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

  const POWDER_WALL_TEXTURE_REPEAT_PX = 192; // Mirror the tower wall sprite tile height so loops stay seamless.

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
    applyStoredAudioSettings,
    syncAudioControlsFromManager,
    applyNotationPreference,
    handleNotationFallback: refreshNotationDisplays,
    applyGlyphEquationPreference,
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
    }),
  });

  const idleLevelRuns = new Map();
  // Track the animation frame id that advances idle simulations so we can pause the loop when idle.
  let idleRunAnimationHandle = null;

  let powderSimulation = null;
  let sandSimulation = null;
  let fluidSimulationInstance = null;
  let lamedSimulationInstance = null;
  let tsadiSimulationInstance = null;
  let shinSimulationInstance = null;
  let kufUiInitialized = false;
  let powderBasinObserver = null;
  let pendingSpireResizeFrame = null;

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
        if (currentShinGlyphs !== trackedShinGlyphs) {
          trackedShinGlyphs = currentShinGlyphs;
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

  // Cancel the animation frame loop that advances idle level simulations once no runs remain active.
  function stopIdleRunLoop() {
    if (idleRunAnimationHandle === null) {
      return;
    }
    if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(idleRunAnimationHandle);
    }
    idleRunAnimationHandle = null;
  }

  // Ensure an animation frame is queued so idle level simulations continue ticking while runs exist.
  function ensureIdleRunLoop() {
    if (idleRunAnimationHandle !== null) {
      return;
    }
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      return;
    }

    const step = (timestamp) => {
      // Clear the stored handle before processing so subsequent frames can be scheduled as needed.
      idleRunAnimationHandle = null;
      updateIdleRuns(timestamp);
      if (idleLevelRuns.size) {
        ensureIdleRunLoop();
      }
    };

    idleRunAnimationHandle = window.requestAnimationFrame(step);
  }

  // Begin tracking the automated progress for an idle level encounter.
  function beginIdleLevelRun(level) {
    if (!level || !level.id || isInteractiveLevel(level.id)) {
      return;
    }

    const config = idleLevelConfigs.get(level.id) || null;
    const durationSeconds = Number.isFinite(config?.runDuration) ? Math.max(1, config.runDuration) : 90;
    const rewardScore = Number.isFinite(config?.rewardScore) ? Math.max(0, config.rewardScore) : 0;
    const rewardFlux = Number.isFinite(config?.rewardFlux) ? Math.max(0, config.rewardFlux) : 0;
    const rewardEnergy = Number.isFinite(config?.rewardEnergy)
      ? Math.max(0, config.rewardEnergy)
      : Number.isFinite(config?.rewardThero)
        ? Math.max(0, config.rewardThero)
        : 0;
    const durationMs = durationSeconds * 1000;

    // Store the canonical progress state so UI components can report remaining duration and rewards.
    const runner = {
      levelId: level.id,
      startTime: null,
      duration: durationSeconds,
      durationMs,
      progress: 0,
      remainingMs: durationMs,
      rewardScore,
      rewardFlux,
      rewardEnergy,
    };

    idleLevelRuns.set(level.id, runner);

    const existingState = levelState.get(level.id) || null;
    if (existingState && !existingState.running) {
      levelState.set(level.id, { ...existingState, running: true });
    }

    updateLevelCards();
    if (activeLevelId === level.id) {
      updateIdleLevelDisplay(runner);
    }

    ensureIdleRunLoop();
  }

  // Halt an active idle simulation and refresh related UI surfaces.
  function stopIdleLevelRun(levelId) {
    if (!levelId || isInteractiveLevel(levelId)) {
      return;
    }

    const runnerActive = idleLevelRuns.has(levelId);
    if (runnerActive) {
      idleLevelRuns.delete(levelId);
    }

    const state = levelState.get(levelId) || null;
    if (state && state.running) {
      levelState.set(levelId, { ...state, running: false });
    }

    if (runnerActive) {
      updateLevelCards();
    }

    if (activeLevelId === levelId) {
      updateIdleLevelDisplay();
    }

    if (!idleLevelRuns.size) {
      stopIdleRunLoop();
    }
  }

  function stopAllIdleRuns(exceptId) {
    const levelIds = Array.from(idleLevelRuns.keys());
    levelIds.forEach((levelId) => {
      if (levelId === exceptId) {
        return;
      }
      stopIdleLevelRun(levelId);
    });
  }

  function completeIdleLevelRun(levelId, runner) {
    if (!levelId || isInteractiveLevel(levelId)) {
      return;
    }

    const stats = {
      rewardScore: runner.rewardScore,
      rewardFlux: runner.rewardFlux,
      rewardEnergy: runner.rewardEnergy,
      runDuration: runner.duration,
    };

    handlePlayfieldVictory(levelId, stats);

    if (activeLevelId === levelId) {
      updateIdleLevelDisplay();
    }
  }

  function updateIdleRuns(timestamp) {
    if (!idleLevelRuns.size) {
      if (activeLevelId && !isInteractiveLevel(activeLevelId)) {
        updateIdleLevelDisplay();
      }
      return;
    }

    const now = typeof timestamp === 'number' ? timestamp : 0;

    idleLevelRuns.forEach((runner, levelId) => {
      if (runner.startTime === null) {
        runner.startTime = now;
      }

      const elapsed = Math.max(0, now - runner.startTime);
      const total = Math.max(1, runner.durationMs);
      const clampedElapsed = Math.min(elapsed, total);

      runner.progress = clampedElapsed / total;
      runner.remainingMs = Math.max(0, total - clampedElapsed);

      if (elapsed >= total) {
        idleLevelRuns.delete(levelId);
        runner.progress = 1;
        runner.remainingMs = 0;
        completeIdleLevelRun(levelId, runner);
      }
    });

    updateLevelCards();

    if (activeLevelId && !isInteractiveLevel(activeLevelId)) {
      updateIdleLevelDisplay(idleLevelRuns.get(activeLevelId) || null);
    }
  }

  function updateIdleLevelDisplay(activeRunner = null) {
    if (!activeLevelId || isInteractiveLevel(activeLevelId)) {
      return;
    }

    if (!playfieldElements.message || !playfieldElements.progress) {
      return;
    }

    const level = levelLookup.get(activeLevelId);
    const state = levelState.get(activeLevelId) || {};
    const runner = activeRunner || idleLevelRuns.get(activeLevelId) || null;

    if (!level) {
      return;
    }

    if (runner) {
      const remainingSeconds = Math.ceil(runner.remainingMs / 1000);
      const percent = Math.min(100, Math.max(0, Math.round(runner.progress * 100)));
      playfieldElements.message.textContent = `${level.title} auto-sim running—sigils recalibrating.`;
      playfieldElements.progress.textContent = `Simulation progress: ${percent}% · ${remainingSeconds}s remaining.`;
    } else if (state.running) {
      playfieldElements.message.textContent = `${level.title} is initializing—automated glyphs mobilizing.`;
      playfieldElements.progress.textContent = 'Auto-run preparing to deploy.';
    } else if (state.completed) {
      playfieldElements.message.textContent = `${level.title} sealed—auto-run rewards claimed.`;
      playfieldElements.progress.textContent = 'Simulation complete. Re-enter to rerun the proof.';
    } else {
      playfieldElements.message.textContent = 'Tap the highlighted overlay to begin this automated defense.';
      playfieldElements.progress.textContent = 'Awaiting confirmation.';
    }

    if (playfieldElements.wave) {
      playfieldElements.wave.textContent = '—';
    }
    if (playfieldElements.health) {
      playfieldElements.health.textContent = '—';
    }
    if (playfieldElements.energy) {
      playfieldElements.energy.textContent = '—';
    }

    if (playfieldElements.startButton) {
      if (runner || state.running) {
        playfieldElements.startButton.textContent = runner
          ? 'Auto-run Active'
          : 'Auto-run Initializing';
      } else {
        playfieldElements.startButton.textContent = 'Preview Only';
      }
      playfieldElements.startButton.disabled = true;
    }
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
      updateResourceRates();
      updatePowderLedger();
    } else {
      updateStatusDisplays();
      updatePowderLedger();
    }

    updateActiveLevelBanner();
    updateLevelCards();

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

  function handleDocumentPointerDown(event) {
    if (!expandedLevelSet) {
      return;
    }

    if (event && expandedLevelSet.contains(event.target)) {
      return;
    }

    if (event && event.target && event.target.closest('.level-set')) {
      return;
    }

    collapseLevelSet(expandedLevelSet);
    if (audioManager) {
      audioManager.playSfx('menuSelect');
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

  document.addEventListener('pointerdown', handleDocumentPointerDown);
  document.addEventListener('pointerdown', handleGlobalButtonPointerDown);
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
      const unlocked = index === 0 || areSetNormalLevelsCompleted(previous?.levels);

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

  function buildLevelCards() {
    if (!levelGrid) return;
    expandedLevelSet = null;
    levelGrid.innerHTML = '';

    const fragment = document.createDocumentFragment();
    const groups = new Map();

    levelSetEntries.length = 0;

    levelBlueprints.forEach((level) => {
      if (level.developerOnly && !developerModeActive) {
        return;
      }
      const groupKey = level.set || level.id.split(' - ')[0] || 'Levels';
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(level);
    });

    let groupIndex = 0;
    groups.forEach((levels, setName) => {
      if (!levels.length) {
        return;
      }
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
        card.innerHTML = `
          <span class="level-node-core">
            <span class="level-status-pill">New</span>
            <span class="level-id">${level.id}</span>
            <span class="level-node-title">${level.title}</span>
          </span>
          <span class="level-best-wave" aria-hidden="true" hidden>Wave —</span>
          <span class="screen-reader-only level-path">Path ${pathLabel}</span>
          <span class="screen-reader-only level-focus">Focus ${focusLabel}</span>
          <span class="screen-reader-only level-mode">—</span>
          <span class="screen-reader-only level-duration">—</span>
          <span class="screen-reader-only level-rewards">—</span>
          <span class="screen-reader-only level-start-thero">Starting Thero —.</span>
          <span class="screen-reader-only level-last-result">No attempts recorded.</span>
          <span class="screen-reader-only level-best-wave-sr">Infinity wave record locked.</span>
        `;
        card.dataset.ariaLabelBase = `${level.id}: ${level.title}. Path ${pathLabel}. Focus ${focusLabel}.`;
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

    const otherActiveId = activeLevelId && activeLevelId !== level.id ? activeLevelId : null;
    const otherActiveState = otherActiveId ? levelState.get(otherActiveId) : null;
    const requiresExitConfirm = Boolean(
      otherActiveId && (otherActiveState?.running || otherActiveState?.entered),
    );

    if (!state.entered || requiresExitConfirm) {
      pendingLevel = level;
      showLevelOverlay(level, { requireExitConfirm: requiresExitConfirm, exitLevelId: otherActiveId });
      return;
    }

    startLevel(level);
    focusLeaveLevelButton();
    lastLevelTrigger = null;
  }

  function showLevelOverlay(level, options = {}) {
    if (!overlay || !overlayLabel || !overlayTitle || !overlayExample) return;
    const { requireExitConfirm = false, exitLevelId = null } = options;
    overlayRequiresLevelExit = Boolean(requireExitConfirm);
    overlayLabel.textContent = level.id;
    overlayTitle.textContent = level.title;
    overlayExample.textContent = level.example;
    if (levelPreviewRenderer) {
      levelPreviewRenderer.render(level);
    }
    const summary = getLevelSummary(level);
    if (overlayMode) {
      overlayMode.textContent = summary.mode;
    }
    if (overlayDuration) {
      overlayDuration.textContent = summary.duration;
    }
    if (overlayRewards) {
      overlayRewards.textContent = summary.rewards;
    }
    // Surface the stage-specific starting Thero within the preview metrics.
    if (overlayStartThero) {
      const startLabel = summary.start || '—';
      overlayStartThero.textContent = startLabel;
      overlayStartThero.setAttribute(
        'aria-label',
        summary.startAria ||
          (startLabel === '—' ? 'Starting Thero not applicable.' : `Starting Thero ${startLabel}`),
      );
    }
    if (overlayLast) {
      const state = levelState.get(level.id) || null;
      const runner = idleLevelRuns.get(level.id) || null;
      overlayLast.textContent = describeLevelLastResult(level, state, runner);
    }
    if (overlayInstruction) {
      if (overlayRequiresLevelExit) {
        const exitLevel = exitLevelId ? levelLookup.get(exitLevelId) : levelLookup.get(activeLevelId);
        const exitLabel = exitLevel ? `${exitLevel.id} · ${exitLevel.title}` : 'the active level';
        overlayInstruction.textContent = `Entering will abandon ${exitLabel}. Tap to confirm.`;
      } else {
        overlayInstruction.textContent = overlayInstructionDefault;
      }
    }
    if (overlay) {
      if (overlayRequiresLevelExit) {
        overlay.setAttribute('data-overlay-mode', 'warning');
      } else {
        overlay.removeAttribute('data-overlay-mode');
      }
    }
    revealOverlay(overlay);
    overlay.setAttribute('aria-hidden', 'false');
    overlay.focus();
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });
  }

  function hideLevelOverlay() {
    if (!overlay) return;
    if (levelPreviewRenderer) {
      levelPreviewRenderer.clear();
    }
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    scheduleOverlayHide(overlay);
    overlayRequiresLevelExit = false;
    if (overlayInstruction) {
      overlayInstruction.textContent = overlayInstructionDefault;
    }
    if (overlay) {
      overlay.removeAttribute('data-overlay-mode');
    }
  }

  function cancelPendingLevel() {
    pendingLevel = null;
    hideLevelOverlay();
    if (lastLevelTrigger && typeof lastLevelTrigger.focus === 'function') {
      lastLevelTrigger.focus();
    }
    lastLevelTrigger = null;
  }

  function confirmPendingLevel() {
    if (!pendingLevel) {
      hideLevelOverlay();
      return;
    }

    const levelToStart = pendingLevel;
    pendingLevel = null;
    hideLevelOverlay();
    startLevel(levelToStart);
    focusLeaveLevelButton();
    lastLevelTrigger = null;
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
    updatePlayfieldMenuState();
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

      const entered = Boolean(state && state.entered);
      const running = Boolean(state && state.running);
      const completed = Boolean(state && state.completed);
      const unlocked = isLevelUnlocked(level.id);
      const infinityUnlocked = infinityUnlockedOverall;
      const pathLabel = typeof level.path === 'string' ? level.path : '—';
      const focusLabel = typeof level.focus === 'string' ? level.focus : '—';

      const summary = getLevelSummary(level);
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
          lastResultEl.textContent = describeLevelLastResult(level, state || null, runner);
        } else {
          lastResultEl.textContent = 'Locked until preceding defenses are sealed.';
        }
      }

      card.classList.toggle('entered', entered);
      card.classList.toggle('completed', completed);
      card.classList.toggle('locked', !unlocked);
      card.setAttribute('aria-pressed', running ? 'true' : 'false');
      card.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
      const parentSet = card.closest('.level-set');
      const setExpanded = Boolean(parentSet && parentSet.classList.contains('expanded'));
      card.tabIndex = unlocked && setExpanded ? 0 : -1;

      if (titleEl) {
        titleEl.textContent = unlocked ? level.title : 'LOCKED';
      }
      if (pathEl) {
        pathEl.textContent = unlocked ? `Path ${pathLabel}` : 'Path details locked.';
      }
      if (focusEl) {
        focusEl.textContent = unlocked ? `Focus ${focusLabel}` : 'Focus details locked.';
      }

      if (pill) {
        let pillVisible = false;
        let pillText = '';
        if (unlocked && !entered) {
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

      const bestWave = Number.isFinite(state?.bestWave) ? state.bestWave : 0;
      if (waveEl) {
        if (infinityUnlocked) {
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
        if (infinityUnlocked) {
          if (bestWave > 0) {
            waveSrEl.textContent = `Infinity mode best wave ${formatWholeNumber(bestWave)}.`;
          } else {
            waveSrEl.textContent = 'Infinity mode ready—no wave record yet.';
          }
        } else {
          waveSrEl.textContent = 'Infinity wave record locked.';
        }
      }

      const baseLabel = card.dataset.ariaLabelBase || '';
      if (unlocked) {
        const startLabel = summary.startAria ? ` ${summary.startAria}` : summary.start && summary.start !== '—'
          ? ` Starting Thero ${summary.start}.`
          : '';
        const waveLabel = infinityUnlocked
          ? bestWave > 0
            ? ` Best wave reached: ${formatWholeNumber(bestWave)}.`
            : ' Infinity mode available—no wave record yet.'
          : '';
        card.setAttribute('aria-label', `${baseLabel}${startLabel}${waveLabel}`.trim());
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

  

  function bindOverlayEvents() {
    if (!overlay) return;
    overlay.addEventListener('click', () => {
      confirmPendingLevel();
    });
  }

  function renderUpgradeMatrix() {
    if (!upgradeOverlayGrid) {
      return;
    }

    upgradeOverlayGrid.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const towerList = getTowerDefinitions();
    towerList.forEach((definition) => {
      if (!isTowerUnlocked(definition.id)) {
        return;
      }
      const row = document.createElement('div');
      row.className = 'upgrade-matrix-row';
      row.setAttribute('role', 'listitem');

      const tier = document.createElement('span');
      tier.className = 'upgrade-matrix-tier';
      tier.textContent = `Tier ${definition.tier}`;

      const name = document.createElement('span');
      name.className = 'upgrade-matrix-name';
      const symbol = document.createElement('span');
      symbol.className = 'upgrade-matrix-symbol';
      symbol.textContent = definition.symbol;
      const title = document.createElement('span');
      title.className = 'upgrade-matrix-title';
      const sanitizedName = typeof definition.name === 'string'
        ? definition.name.replace(/tower/gi, '').replace(/\s{2,}/g, ' ').trim()
        : '';
      title.textContent = sanitizedName || definition.name;
      name.append(symbol, document.createTextNode(' '), title);

      const cost = document.createElement('span');
      cost.className = 'upgrade-matrix-cost';
      cost.textContent = `${formatGameNumber(definition.baseCost)} ${THERO_SYMBOL}`;

      const nextTier = document.createElement('span');
      nextTier.className = 'upgrade-matrix-next';
      const nextDefinition = definition.nextTierId
        ? getTowerDefinition(definition.nextTierId)
        : null;
      const nextName = nextDefinition?.name
        ? nextDefinition.name.replace(/tower/gi, '').replace(/\s{2,}/g, ' ').trim()
        : '';
      nextTier.textContent = nextDefinition
        ? `→ ${nextDefinition.symbol} ${nextName || nextDefinition.name}`
        : '→ Final lattice awakened';

      row.append(tier, name, cost, nextTier);
      fragment.append(row);
    });

    upgradeOverlayGrid.append(fragment);
  }

  function showUpgradeMatrix() {
    if (!upgradeOverlay) {
      return;
    }

    revealOverlay(upgradeOverlay);
    renderUpgradeMatrix();
    if (!lastUpgradeTrigger || !(upgradeOverlayTriggerSet?.has(lastUpgradeTrigger))) {
      const activeElement = document.activeElement;
      lastUpgradeTrigger =
        activeElement && typeof activeElement.focus === 'function' ? activeElement : null;
    }

    upgradeOverlay.setAttribute('aria-hidden', 'false');
    if (lastUpgradeTrigger && upgradeOverlayTriggerSet?.has(lastUpgradeTrigger)) {
      lastUpgradeTrigger.setAttribute('aria-expanded', 'true');
    }
    if (!upgradeOverlay.classList.contains('active')) {
      requestAnimationFrame(() => {
        upgradeOverlay.classList.add('active');
      });
    }

    const focusTarget = upgradeOverlayClose || upgradeOverlay.querySelector('.overlay-panel');
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus();
    } else if (typeof upgradeOverlay.focus === 'function') {
      upgradeOverlay.focus();
    }
  }

  function hideUpgradeMatrix() {
    if (!upgradeOverlay) {
      return;
    }

    upgradeOverlay.classList.remove('active');
    upgradeOverlay.setAttribute('aria-hidden', 'true');
    scheduleOverlayHide(upgradeOverlay);
    if (upgradeOverlayButtons.length) {
      upgradeOverlayButtons.forEach((button) => {
        if (button) {
          button.setAttribute('aria-expanded', 'false');
        }
      });
    }

    if (lastUpgradeTrigger && typeof lastUpgradeTrigger.focus === 'function') {
      lastUpgradeTrigger.focus();
    }
    lastUpgradeTrigger = null;
  }

  function updateVariableLibraryButton(count = null) {
    if (!variableLibraryButton) {
      return;
    }
    const total = Number.isFinite(count) ? count : getDiscoveredVariables().length;
    const label =
      total > 1 ? `Variables (${total})` : total === 1 ? 'Variable (1)' : 'Variables';
    if (variableLibraryLabel) {
      variableLibraryLabel.textContent = label;
    }
    variableLibraryButton.setAttribute(
      'aria-label',
      `${label} — open variable glossary`,
    );
  }

  function renderVariableLibrary(variableList = null) {
    if (!variableLibraryList) {
      return;
    }
    const variables = Array.isArray(variableList) ? variableList : getDiscoveredVariables();
    updateVariableLibraryButton(variables.length);
    variableLibraryList.innerHTML = '';

    if (!variables.length) {
      const empty = document.createElement('li');
      empty.className = 'variable-library-empty';
      empty.textContent = 'Discover towers to reveal their variables.';
      variableLibraryList.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    variables.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'variable-library-item';
      const summaryPieces = [entry.symbol, entry.name, entry.description]
        .filter((value) => typeof value === 'string' && value.trim().length)
        .join(' — ');
      if (summaryPieces) {
        item.title = summaryPieces;
      }

      const header = document.createElement('div');
      header.className = 'variable-library-header';

      const symbol = document.createElement('span');
      symbol.className = 'variable-library-symbol';
      symbol.textContent = entry.symbol;

      const name = document.createElement('span');
      name.className = 'variable-library-name';
      name.textContent = entry.name;

      header.append(symbol, name);
      item.append(header);

      if (entry.description) {
        const description = document.createElement('p');
        description.className = 'variable-library-description';
        description.textContent = entry.description;
        item.append(description);
      }

      fragment.append(item);
    });

    variableLibraryList.append(fragment);
  }

  function showVariableLibrary() {
    if (!variableLibraryOverlay) {
      return;
    }

    revealOverlay(variableLibraryOverlay);
    renderVariableLibrary();
    variableLibraryOverlay.setAttribute('aria-hidden', 'false');
    if (!variableLibraryOverlay.classList.contains('active')) {
      requestAnimationFrame(() => {
        variableLibraryOverlay.classList.add('active');
      });
    }

    if (variableLibraryButton) {
      variableLibraryButton.setAttribute('aria-expanded', 'true');
    }

    const focusTarget =
      variableLibraryClose || variableLibraryOverlay.querySelector('.overlay-panel');
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus();
    } else if (typeof variableLibraryOverlay.focus === 'function') {
      variableLibraryOverlay.focus();
    }
  }

  function hideVariableLibrary() {
    if (!variableLibraryOverlay) {
      return;
    }

    variableLibraryOverlay.classList.remove('active');
    variableLibraryOverlay.setAttribute('aria-hidden', 'true');
    scheduleOverlayHide(variableLibraryOverlay);
    if (variableLibraryButton) {
      variableLibraryButton.setAttribute('aria-expanded', 'false');
    }
    if (lastVariableLibraryTrigger && typeof lastVariableLibraryTrigger.focus === 'function') {
      lastVariableLibraryTrigger.focus();
    }
    lastVariableLibraryTrigger = null;
  }

  function bindUpgradeMatrix() {
    upgradeOverlayButtons = Array.from(
      document.querySelectorAll('[data-upgrade-matrix-trigger]'),
    );
    upgradeOverlayTriggerSet = new WeakSet(upgradeOverlayButtons);
    upgradeOverlay = document.getElementById('upgrade-matrix-overlay');
    upgradeOverlayGrid = document.getElementById('upgrade-matrix-grid');
    upgradeOverlayClose = upgradeOverlay
      ? upgradeOverlay.querySelector('[data-overlay-close]')
      : null;

    if (upgradeOverlay && !upgradeOverlay.hasAttribute('tabindex')) {
      upgradeOverlay.setAttribute('tabindex', '-1');
    }

    upgradeOverlayButtons.forEach((button) => {
      if (!button) {
        return;
      }
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', () => {
        lastUpgradeTrigger = button;
        showUpgradeMatrix();
      });
    });

    if (upgradeOverlayClose) {
      upgradeOverlayClose.addEventListener('click', () => {
        hideUpgradeMatrix();
      });
    }

    if (upgradeOverlay) {
      upgradeOverlay.addEventListener('click', (event) => {
        if (event.target === upgradeOverlay) {
          hideUpgradeMatrix();
        }
      });
    }
  }

  function bindVariableLibrary() {
    if (typeof removeVariableListener === 'function') {
      removeVariableListener();
      removeVariableListener = null;
    }

    variableLibraryButton = document.getElementById('tower-variable-library');
    variableLibraryOverlay = document.getElementById('variable-library-overlay');
    variableLibraryList = document.getElementById('variable-library-list');
    variableLibraryLabel = variableLibraryButton
      ? variableLibraryButton.querySelector('.tower-panel-button-label')
      : null;
    variableLibraryClose = variableLibraryOverlay
      ? variableLibraryOverlay.querySelector('[data-variable-library-close]')
      : null;

    if (variableLibraryOverlay && !variableLibraryOverlay.hasAttribute('tabindex')) {
      variableLibraryOverlay.setAttribute('tabindex', '-1');
    }

    if (variableLibraryButton) {
      variableLibraryButton.setAttribute('aria-expanded', 'false');
      variableLibraryButton.addEventListener('click', () => {
        lastVariableLibraryTrigger = variableLibraryButton;
        showVariableLibrary();
      });
    }

    if (variableLibraryClose) {
      variableLibraryClose.addEventListener('click', () => {
        hideVariableLibrary();
      });
    }

    if (variableLibraryOverlay) {
      variableLibraryOverlay.addEventListener('click', (event) => {
        if (event.target === variableLibraryOverlay) {
          hideVariableLibrary();
        }
      });
    }

    const handleVariablesChanged = (variables) => {
      if (variableLibraryOverlay?.classList.contains('active')) {
        renderVariableLibrary(variables);
        return;
      }
      updateVariableLibraryButton(Array.isArray(variables) ? variables.length : null);
    };

    removeVariableListener = addDiscoveredVariablesListener(handleVariablesChanged);

    // Initialize the Equipment button to open the crafting overlay from the Towers tab
    const equipmentButton = document.getElementById('tower-equipment-button');
    if (equipmentButton) {
      equipmentButton.addEventListener('click', (event) => {
        event.preventDefault();
        openCraftingOverlay();
      });
    }
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



  function formatInteractiveLevelRewards() {
    const levelsBeaten = getCompletedInteractiveLevelCount();
    const multiplier = getStartingTheroMultiplier(levelsBeaten);
    const levelLabel = levelsBeaten === 1 ? 'level' : 'levels';
    const beatenText = `${levelsBeaten} ${levelLabel} sealed`;
    const multiplierLabel = formatGameNumber(multiplier);
    return `+1 Mote Gems/min · Thero Multiplier ×${multiplierLabel} (${beatenText})`;
  }

  // Summarize the stage-specific starting Thero after applying the current multiplier.
  function describeLevelStartingThero(level, configOverride = null) {
    const config = configOverride || (level ? levelConfigs.get(level.id) : null);
    if (!config) {
      return { text: '—', aria: 'Starting Thero not applicable.' };
    }
    if (config.infiniteThero) {
      return { text: `∞ ${THERO_SYMBOL}`, aria: 'Starting Thero is infinite.' };
    }

    const baseStart = Number.isFinite(config.startThero)
      ? Math.max(0, config.startThero)
      : BASE_START_THERO;
    const multiplier = getStartingTheroMultiplier();
    const totalStart = Math.max(0, baseStart * multiplier);
    const baseLabel = formatGameNumber(baseStart);
    const multiplierLabel = formatGameNumber(multiplier);
    const totalLabel = formatGameNumber(totalStart);

    return {
      text: `${baseLabel} ${THERO_SYMBOL} × ${multiplierLabel} = ${totalLabel} ${THERO_SYMBOL}`,
      aria: `Starting Thero equals ${baseLabel} ${THERO_SYMBOL} times ${multiplierLabel}, totaling ${totalLabel} ${THERO_SYMBOL}.`,
    };
  }



  function getLevelSummary(level) {
    if (!level) {
      return {
        mode: '—',
        duration: '—',
        rewards: '—',
        start: '—',
        startAria: 'Starting Thero not applicable.',
      };
    }
    const interactiveConfig = levelConfigs.get(level.id);
    if (interactiveConfig) {
      const waves = interactiveConfig.waves?.length || 0;
      const endless = Boolean(interactiveConfig.forceEndlessMode);
      const startSummary = describeLevelStartingThero(level, interactiveConfig);
      return {
        mode: endless ? 'Endless Defense' : 'Active Defense',
        duration: endless ? 'Endless · manual' : waves ? `${waves} waves · manual` : 'Active defense',
        rewards: formatInteractiveLevelRewards(),
        start: startSummary.text,
        startAria: startSummary.aria,
      };
    }

    const config = idleLevelConfigs.get(level.id);
    return {
      mode: 'Idle Simulation',
      duration: config
        ? `${formatDuration(config.runDuration)} auto-run`
        : 'Idle simulation',
      rewards: config
        ? formatRewards(config.rewardScore, config.rewardFlux, config.rewardEnergy, formatGameNumber)
        : '—',
      start: '—',
      startAria: 'Starting Thero not applicable.',
    };
  }

  function describeLevelLastResult(level, state, runner) {
    if (runner) {
      const percent = Math.min(100, Math.max(0, Math.round((runner.progress || 0) * 100)));
      const remainingSeconds = Number.isFinite(runner.remainingMs)
        ? Math.ceil(runner.remainingMs / 1000)
        : null;
      const remainingLabel = remainingSeconds === null
        ? 'Finishing'
        : `${formatDuration(remainingSeconds)} remaining`;
      return `Auto-run ${percent}% · ${remainingLabel}.`;
    }

    if (state?.running) {
      return level && isInteractiveLevel(level.id)
        ? 'Manual defense active.'
        : 'Auto-run initializing.';
    }

    if (!state || !state.lastResult) {
      return 'No attempts recorded.';
    }

    const { outcome, stats = {}, timestamp } = state.lastResult;
    const bestWave = Math.max(state.bestWave || 0, stats.maxWave || 0);
    const relative = formatRelativeTime(timestamp) || 'recently';

    if (outcome === 'victory') {
      const rewardText = formatRewards(stats.rewardScore, stats.rewardFlux, stats.rewardEnergy, formatGameNumber);
      const segments = [`Victory ${relative}.`];
      if (rewardText && rewardText !== '—') {
        segments.push(`Rewards: ${rewardText}.`);
      }
      if (Number.isFinite(stats.startThero)) {
        segments.push(`Starting Thero now ${formatGameNumber(stats.startThero)} ${THERO_SYMBOL}.`);
      }
      if (bestWave > 0) {
        segments.push(`Waves cleared: ${bestWave}.`);
      }
      return segments.join(' ');
    }

    if (outcome === 'defeat') {
      return bestWave > 0
        ? `Defense collapsed ${relative}. Reached wave ${bestWave}.`
        : `Defense collapsed ${relative}.`;
    }

    return 'No attempts recorded.';
  }

  function enableDeveloperMode() {
    developerModeActive = true;
    if (developerModeElements.toggle && !developerModeElements.toggle.checked) {
      developerModeElements.toggle.checked = true;
    }

    const loadoutState = getTowerLoadoutState();
    const towers = getTowerDefinitions();

    towers.forEach((definition) => {
      unlockTower(definition.id, { silent: true });
    });

    initializeDiscoveredVariablesFromUnlocks(
      towers.map((definition) => definition.id),
    );

    loadoutState.selected = towers
      .slice(0, getTowerLoadoutLimit())
      .map((definition) => definition.id);

    pruneLockedTowersFromLoadout();

    // Developer mode: Unlock all spires and set developer values
    powderState.fluidUnlocked = true;
    spireResourceState.lamed.unlocked = true;
    spireResourceState.tsadi.unlocked = true;
    
    // Set spire banks to 1,000,000
    powderState.idleMoteBank = 1000000;
    powderState.fluidIdleBank = 1000000;
    spireResourceState.lamed.sparkBank = 1000000;
    spireResourceState.tsadi.particleBank = 1000000;
    
    // Set spire rates to 10 per second
    powderState.idleDrainRate = 10;
    powderState.fluidIdleDrainRate = 10;
    if (typeof setDeveloperIteronBank === 'function') {
      setDeveloperIteronBank(1000000);
    }
    if (typeof setDeveloperIterationRate === 'function') {
      setDeveloperIterationRate(10);
    }
    
    // Apply the banks and rates to active simulations
    if (sandSimulation) {
      sandSimulation.idleBank = 1000000;
      sandSimulation.idleDrainRate = 10;
    }
    if (fluidSimulationInstance) {
      fluidSimulationInstance.idleBank = 1000000;
      fluidSimulationInstance.idleDrainRate = 10;
    }
    if (lamedSimulationInstance) {
      lamedSimulationInstance.sparkBank = 1000000;
      lamedSimulationInstance.sparkSpawnRate = 10;
    }
    if (tsadiSimulationInstance) {
      tsadiSimulationInstance.particleBank = 1000000;
      tsadiSimulationInstance.spawnRate = 10;
    }
    
    updateSpireTabVisibility();
    spireMenuController.updateCounts();

    unlockedLevels.clear();
    interactiveLevelOrder.forEach((levelId) => {
      unlockedLevels.add(levelId);
      const existing = levelState.get(levelId) || {};
      levelState.set(levelId, {
        ...existing,
        entered: true,
        running: false,
        completed: true,
      });
    });

    levelBlueprints.forEach((level) => {
      if (!levelState.has(level.id)) {
        levelState.set(level.id, { entered: true, running: false, completed: true });
      }
    });

    const codexEntries = getEnemyCodexEntries();
    codexState.encounteredEnemies = new Set(codexEntries.map((entry) => entry.id));

    renderEnemyCodex();
    updateLevelCards();
    updateActiveLevelBanner();
    updateTowerCardVisibility();
    updateTowerSelectionButtons();
    syncLoadoutToPlayfield();
    updateStatusDisplays();

    evaluateAchievements();
    refreshAchievementPowderRate();
    updateResourceRates();
    updatePowderLedger();

    if (developerModeElements.note) {
      developerModeElements.note.hidden = false;
    }

    updateDeveloperControlsVisibility();
    syncDeveloperControlValues();

    syncLevelEditorVisibility();

    updatePlayfieldMenuState();
    updateDeveloperMapElementsVisibility();

    if (playfield?.messageEl) {
      playfield.messageEl.textContent =
        'Developer lattice engaged—every tower, level, and codex entry is unlocked.';
    }

    // Unlock all Shin Spire fractals in developer mode
    unlockAllFractals();
    refreshFractalTabs();
    
    // Give 1 million iterons in developer mode
    addIterons(1000000);
    updateShinDisplay();

    updatePowderHitboxVisibility();
    
    // Persist developer mode state
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(DEVELOPER_MODE_STORAGE_KEY, 'true');
      } catch (error) {
        console.warn('Failed to persist developer mode state.', error);
      }
    }
  }

  function disableDeveloperMode() {
    developerModeActive = false;
    if (developerModeElements.toggle && developerModeElements.toggle.checked) {
      developerModeElements.toggle.checked = false;
    }
    
    // Persist developer mode state
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(DEVELOPER_MODE_STORAGE_KEY, 'false');
      } catch (error) {
        console.warn('Failed to persist developer mode state.', error);
      }
    }

    deactivateDeveloperMapTools({ force: true, silent: true });
    setDeveloperMapPlacementMode(null);
    updateDeveloperMapElementsVisibility();

    const unlockState = getTowerUnlockState();
    unlockState.unlocked = new Set(['alpha']);
    setMergingLogicUnlocked(false);
    initializeDiscoveredVariablesFromUnlocks(unlockState.unlocked);
    const loadoutState = getTowerLoadoutState();
    loadoutState.selected = ['alpha'];
    pruneLockedTowersFromLoadout();

    codexState.encounteredEnemies = new Set();

    levelState.clear();
    unlockedLevels.clear();
    if (interactiveLevelOrder.length) {
      unlockedLevels.add(interactiveLevelOrder[0]);
    }

    activeLevelId = null;
    pendingLevel = null;
    resourceState.running = false;

    clearDeveloperTheroMultiplierOverride();

    if (playfield) {
      playfield.leaveLevel();
    }

    renderEnemyCodex();
    updateLevelCards();
    updateActiveLevelBanner();
    updateTowerCardVisibility();
    updateTowerSelectionButtons();
    syncLoadoutToPlayfield();
    updateStatusDisplays();

    evaluateAchievements();
    refreshAchievementPowderRate();
    updateResourceRates();
    updatePowderLedger();

    if (developerModeElements.note) {
      developerModeElements.note.hidden = true;
    }

    updateDeveloperControlsVisibility();
    syncDeveloperControlValues();

    updatePlayfieldMenuState();

    updatePowderHitboxVisibility();
  }

  function resetDeveloperResetButtonConfirmation({ label = DEVELOPER_RESET_DEFAULT_LABEL, warning = false } = {}) {
    developerResetState.confirming = false;
    if (developerResetState.timeoutId) {
      clearTimeout(developerResetState.timeoutId);
      developerResetState.timeoutId = null;
    }
    const button = developerModeElements.resetButton;
    if (!button) {
      return;
    }
    button.disabled = false;
    button.textContent = label;
    if (warning) {
      button.classList.add('developer-reset-button--warning');
    } else {
      button.classList.remove('developer-reset-button--warning');
    }
  }

  function clearPersistentStorageKeys() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return true;
    }

    const storage = window.localStorage;
    let success = true;

    PERSISTENT_STORAGE_KEYS.forEach((key) => {
      if (!key || typeof key !== 'string') {
        return;
      }
      try {
        storage.removeItem(key);
      } catch (error) {
        success = false;
        console.warn(`Failed to remove storage key "${key}" while deleting player data.`, error);
      }
    });

    return success;
  }

  function resetPlayerProgressState() {
    gameStats.manualVictories = 0;
    gameStats.idleVictories = 0;
    gameStats.towersPlaced = 0;
    gameStats.maxTowersSimultaneous = 0;
    gameStats.autoAnchorPlacements = 0;
    gameStats.powderActions = 0;
    gameStats.enemiesDefeated = 0;
    gameStats.idleMillisecondsAccumulated = 0;
    gameStats.powderSigilsReached = 0;
    gameStats.highestPowderMultiplier = 1;

    resourceState.score = baseResources.score;
    resourceState.scoreRate = baseResources.scoreRate;
    resourceState.energyRate = baseResources.energyRate;
    resourceState.fluxRate = baseResources.fluxRate;
    resourceState.running = false;

    setPowderCurrency(0);

    if (idleLevelRuns) {
      idleLevelRuns.clear();
    }

    if (powderState.viewInteraction?.destroy) {
      try {
        powderState.viewInteraction.destroy();
      } catch (error) {
        console.warn('Failed to destroy powder interaction while resetting player data.', error);
      }
    }
    powderState.viewInteraction = null;

    if (powderSimulation?.stop) {
      try {
        powderSimulation.stop();
      } catch (error) {
        console.warn('Failed to stop powder simulation while resetting player data.', error);
      }
    }
    if (fluidSimulationInstance?.stop) {
      try {
        fluidSimulationInstance.stop();
      } catch (error) {
        console.warn('Failed to stop fluid simulation while resetting player data.', error);
      }
    }

    powderSimulation = null;
    sandSimulation = null;
    fluidSimulationInstance = null;

    if (powderBasinObserver?.disconnect) {
      try {
        powderBasinObserver.disconnect();
      } catch (error) {
        console.warn('Failed to disconnect powder observer while resetting player data.', error);
      }
    }
    powderBasinObserver = null;

    powderState.sandOffset = powderConfig.sandOffsetActive;
    powderState.duneHeight = powderConfig.duneHeightBase;
    powderState.charges = 0;
    powderState.simulatedDuneGain = 0;
    powderState.wallGlyphsLit = 0;
    powderState.glyphsAwarded = 0;
    powderState.idleMoteBank = 100;
    powderState.idleDrainRate = 1;
    powderState.pendingMoteDrops = [];
    powderState.idleBankHydrated = false;
    powderState.fluidIdleBank = 0;
    powderState.fluidIdleDrainRate = 0.1;
    powderState.pendingFluidDrops = [];
    powderState.fluidBankHydrated = false;
    powderState.motePalette = mergeMotePalette(DEFAULT_MOTE_PALETTE);
    applyMindGatePaletteToDom(powderState.motePalette);
    powderState.simulationMode = 'sand';
    powderState.wallGapTarget = powderConfig.wallBaseGapMotes;
    powderState.modeSwitchPending = false;
    powderState.fluidProfileLabel = 'Bet Spire';
    powderState.fluidUnlocked = false;
    updateFluidTabAvailability();
    powderState.viewTransform = null;
    powderState.loadedSimulationState = null;
    powderState.loadedFluidState = null;

    resetPowderUiState();
    powderWallMetrics = null;
    fluidWallMetrics = null;

    clearTowerUpgradeState();
    // Revert Aleph chain upgrades so tower snapshots reset alongside other progression state.
    resetAlephChainUpgrades({ playfield });
    reconcileGlyphCurrencyFromState();

    resetActiveMoteGems();
    moteGemState.active.length = 0;
    if (typeof moteGemState.nextId === 'number') {
      moteGemState.nextId = 1;
    }
    if (moteGemState.inventory?.clear) {
      moteGemState.inventory.clear();
    }
    moteGemState.autoCollectUnlocked = false;
    updateMoteGemInventoryDisplay();

    updatePowderWallGapFromGlyphs(0);
    syncPowderWallVisuals();
    updatePowderHitboxVisibility();
    refreshPowderSystems();
    updatePowderModeButton();
    updateStatusDisplays();
    updatePowderLogDisplay();
  }

  function executePlayerDataReset() {
    try {
      stopAutoSaveLoop();
    } catch (error) {
      console.warn('Autosave loop did not stop cleanly before deleting player data.', error);
    }

    // Save the current developer mode state before clearing storage
    const developerModeWasEnabled = developerModeActive || (developerModeElements.toggle && developerModeElements.toggle.checked);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(DEVELOPER_MODE_STORAGE_KEY, developerModeWasEnabled ? 'true' : 'false');
      } catch (error) {
        console.warn('Failed to preserve developer mode state.', error);
      }
    }

    let encounteredError = false;
    const storageCleared = clearPersistentStorageKeys();
    if (!storageCleared) {
      encounteredError = true;
    }

    try {
      resetPlayerProgressState();
    } catch (error) {
      encounteredError = true;
      console.error('Failed to reset runtime state after deleting player data.', error);
    }

    try {
      disableDeveloperMode();
    } catch (error) {
      encounteredError = true;
      console.error('Failed to disable developer mode while deleting player data.', error);
    }

    try {
      pruneLevelState();
    } catch (error) {
      encounteredError = true;
      console.error('Failed to prune level state after deleting player data.', error);
    }

    const button = developerModeElements.resetButton;

    if (encounteredError) {
      if (button) {
        resetDeveloperResetButtonConfirmation({
          label: 'Deletion failed · Retry',
          warning: true,
        });
      }
      return;
    }

    if (button) {
      button.textContent = 'Player data deleted · Reloading…';
    }

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        window.location.reload();
      }, DEVELOPER_RESET_RELOAD_DELAY_MS);
    }
  }

  function handleDeveloperResetClick() {
    const button = developerModeElements.resetButton;
    if (!button) {
      return;
    }

    if (!developerResetState.confirming) {
      developerResetState.confirming = true;
      button.textContent = DEVELOPER_RESET_CONFIRM_LABEL;
      button.classList.add('developer-reset-button--warning');
      if (developerResetState.timeoutId) {
        clearTimeout(developerResetState.timeoutId);
      }
      if (typeof window !== 'undefined') {
        developerResetState.timeoutId = window.setTimeout(() => {
          resetDeveloperResetButtonConfirmation();
        }, DEVELOPER_RESET_CONFIRM_WINDOW_MS);
      }
      return;
    }

    developerResetState.confirming = false;
    if (developerResetState.timeoutId) {
      clearTimeout(developerResetState.timeoutId);
      developerResetState.timeoutId = null;
    }

    button.disabled = true;
    button.classList.remove('developer-reset-button--warning');
    button.textContent = 'Wiping save data…';

    executePlayerDataReset();
  }

  function bindDeveloperModeToggle() {
    developerModeElements.toggle = document.getElementById('codex-developer-mode');
    developerModeElements.note = document.getElementById('codex-developer-note');
    developerModeElements.resetButton = document.getElementById('developer-reset-button');

    if (developerModeElements.resetButton) {
      developerModeElements.resetButton.addEventListener('click', handleDeveloperResetClick);
      resetDeveloperResetButtonConfirmation();
    }

    if (!developerModeElements.toggle) {
      return;
    }

    developerModeElements.toggle.addEventListener('change', (event) => {
      if (event.target.checked) {
        enableDeveloperMode();
      } else {
        disableDeveloperMode();
      }
    });
    
    // Restore developer mode state from localStorage, defaulting to the standard player experience.
    let shouldEnableDeveloperMode = false; // Keep developer tools disabled unless explicitly toggled.
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const savedState = window.localStorage.getItem(DEVELOPER_MODE_STORAGE_KEY);
        if (savedState !== null) {
          shouldEnableDeveloperMode = savedState === 'true';
        }
      } catch (error) {
        console.warn('Failed to restore developer mode state.', error);
      }
    }
    
    developerModeElements.toggle.checked = shouldEnableDeveloperMode;
    if (shouldEnableDeveloperMode) {
      enableDeveloperMode();
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
          if (fluidIsActive) {
            handlePowderWallMetricsChange(metrics, 'fluid');
          } else {
            fluidWallMetrics = metrics;
            schedulePowderBasinSave();
          }
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
    const textureRepeat = POWDER_WALL_TEXTURE_REPEAT_PX > 0 ? POWDER_WALL_TEXTURE_REPEAT_PX : null;
    const rawTextureOffset = textureRepeat ? wallShiftPx % textureRepeat : wallShiftPx;
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

    if (fluidElements.depthValue) {
      fluidElements.depthValue.textContent = `${formatDecimal(normalizedHeight * 100, 1)}% full`;
    }

    const idleBank = Number.isFinite(powderState.fluidIdleBank) ? Math.max(0, powderState.fluidIdleBank) : 0;
    if (fluidElements.reservoirValue) {
      const dropLabel = idleBank === 1 ? 'Drop' : 'Drops';
      fluidElements.reservoirValue.textContent = `${formatGameNumber(idleBank)} ${dropLabel}`;
    }

    const drainRate = Number.isFinite(powderState.fluidIdleDrainRate)
      ? Math.max(0, powderState.fluidIdleDrainRate)
      : 0;
    if (fluidElements.dripRateValue) {
      fluidElements.dripRateValue.textContent = `${formatDecimal(drainRate, 2)} drops/sec`;
    }

    if (fluidElements.profileLabel) {
      fluidElements.profileLabel.textContent = powderState.fluidProfileLabel || 'Bet Spire';
    }

    if (fluidElements.stateLabel) {
      const crestState = normalizedHeight >= 0.9 ? 'ready' : normalizedHeight < 0.5 ? 'forming' : 'steady';
      fluidElements.stateLabel.textContent =
        crestState === 'ready' ? 'Stabilized' : crestState === 'forming' ? 'Forming' : 'Balanced';
      fluidElements.stateLabel.classList.toggle('fluid-state-label--ready', crestState === 'ready');
      fluidElements.stateLabel.classList.toggle('fluid-state-label--forming', crestState === 'forming');
    }

    if (fluidElements.statusNote) {
      let message;
      if (normalizedHeight >= 0.9) {
        message = 'Reservoir plane stabilized—idle drops condense rapidly.';
      } else if (normalizedHeight >= 0.5) {
        message = 'Flow is balanced. Drops weave a mirrored surface across the channel.';
      } else {
        message = 'Channel remains shallow. Allow more drops to condense into the study.';
      }
      fluidElements.statusNote.textContent = message;
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
        resourceElements.tabFluidBadge.setAttribute('aria-label', `${tabStoredLabel} drops in bank`);
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
    const largestGrain = Number.isFinite(info.largestGrain) ? Math.max(0, info.largestGrain) : 0;
    const scrollOffset = Number.isFinite(info.scrollOffset) ? Math.max(0, info.scrollOffset) : 0;
    const totalNormalized = Number.isFinite(info.totalNormalized)
      ? Math.max(0, info.totalNormalized)
      : normalizedHeight;
    const crestPosition = Number.isFinite(info.crestPosition)
      ? Math.max(0, Math.min(1, info.crestPosition))
      : 1;
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
    const textureRepeat = POWDER_WALL_TEXTURE_REPEAT_PX > 0 ? POWDER_WALL_TEXTURE_REPEAT_PX : null;
    const rawTextureOffset = textureRepeat ? wallShiftPx % textureRepeat : wallShiftPx;
    const wallTextureOffset = Number.isFinite(rawTextureOffset) ? rawTextureOffset : 0;
    const wallOffsetValue = `${wallTextureOffset.toFixed(1)}px`;

    if (powderElements.leftWall) {
      powderElements.leftWall.style.transform = '';
      // Apply the offset via a CSS variable so the wall texture scrolls without breaking crest markers.
      powderElements.leftWall.style.setProperty('--powder-wall-shift', wallOffsetValue);
    }
    if (powderElements.rightWall) {
      powderElements.rightWall.style.transform = '';
      powderElements.rightWall.style.setProperty('--powder-wall-shift', wallOffsetValue);
    }

    const basinHeight = rows * cellSize;
    if (powderElements.crestMarker) {
      const crestOffset = Math.min(basinHeight, crestPosition * basinHeight);
      powderElements.crestMarker.style.transform = `translateY(${crestOffset.toFixed(1)}px)`;
      powderElements.crestMarker.dataset.height = `Crest ${formatDecimal(normalizedHeight, 2)}`;
    }

    const glyphMetrics = updatePowderGlyphColumns({
      scrollOffset,
      rows,
      cellSize,
      highestNormalized: highestNormalizedRaw,
      totalNormalized,
    });

    if (powderElements.wallMarker) {
      const peakOffset = Math.min(basinHeight, (1 - highestNormalized) * basinHeight);
      powderElements.wallMarker.style.transform = `translateY(${peakOffset.toFixed(1)}px)`;
      if (glyphMetrics) {
        const {
          achievedCount,
          nextIndex,
          highestRaw,
          progressFraction,
          remainingToNext,
        } = glyphMetrics;
        const progressPercent = formatDecimal(Math.min(1, progressFraction) * 100, 1);
        const remaining = formatDecimal(Math.max(0, remainingToNext), 2);
        const currentLabel = glyphMetrics.glyphsLit > 0
          ? formatAlephLabel(Math.max(0, achievedCount))
          : 'Base';
        const nextLabel = formatAlephLabel(Math.max(0, nextIndex));
        powderElements.wallMarker.dataset.height = `${currentLabel} · ${progressPercent}% to ${nextLabel} (Δh ${remaining})`;
      } else {
        powderElements.wallMarker.dataset.height = `Peak ${highestDisplay}`;
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
    overlay = document.getElementById('level-overlay');
    if (overlay && !overlay.hasAttribute('tabindex')) {
      overlay.setAttribute('tabindex', '-1');
    }
    // Cache layout toggles for switching between the level grid and battlefield.
    playfieldWrapper = document.getElementById('playfield-wrapper');
    stageControls = document.getElementById('stage-controls');
    levelSelectionSection = document.getElementById('level-selection');
    // Store quick menu controls that surface the level selection confirmation.
    playfieldMenuButton = document.getElementById('playfield-menu-button');
    playfieldMenuPanel = document.getElementById('playfield-menu-panel');
    playfieldMenuCommence = document.getElementById('playfield-menu-commence');
    playfieldMenuLevelSelect = document.getElementById('playfield-menu-level-select');
    playfieldMenuRetryWave = document.getElementById('playfield-menu-retry-wave');
    playfieldMenuDevTools = document.getElementById('playfield-menu-dev-tools');
    playfieldMenuStats = document.getElementById('playfield-menu-stats');
    if (playfieldMenuLevelSelect) {
      playfieldMenuLevelSelect.textContent = playfieldMenuLevelSelectDefaultLabel;
    }
    if (playfieldMenuButton) {
      playfieldMenuButton.addEventListener('click', (event) => {
        event.preventDefault();
        togglePlayfieldMenu();
      });
    }
    if (playfieldMenuLevelSelect) {
      playfieldMenuLevelSelect.addEventListener('click', (event) => {
        event.preventDefault();
        handleReturnToLevelSelection();
      });
    }
    if (playfieldMenuCommence) {
      playfieldMenuCommence.addEventListener('click', (event) => {
        event.preventDefault();
        handleCommenceWaveFromMenu();
      });
    }
    if (playfieldMenuRetryWave) {
      playfieldMenuRetryWave.addEventListener('click', (event) => {
        event.preventDefault();
        handleRetryCurrentWave();
      });
    }
    if (playfieldMenuStats) {
      playfieldMenuStats.addEventListener('click', (event) => {
        event.preventDefault();
        togglePlayfieldStatsVisibility();
      });
    }
    if (playfieldMenuDevTools) {
      playfieldMenuDevTools.addEventListener('click', (event) => {
        event.preventDefault();
        handleOpenDevMapTools();
      });
    }
    // Default to the level selection view until a combat encounter begins.
    updateLayoutVisibility();
    overlayLabel = document.getElementById('overlay-level');
    overlayTitle = document.getElementById('overlay-title');
    overlayExample = document.getElementById('overlay-example');
    overlayPreview = document.getElementById('overlay-preview');
    overlayMode = document.getElementById('overlay-mode');
    overlayDuration = document.getElementById('overlay-duration');
    overlayRewards = document.getElementById('overlay-rewards');
    overlayStartThero = document.getElementById('overlay-start-thero');
    overlayLast = document.getElementById('overlay-last');
    overlayInstruction = overlay ? overlay.querySelector('.overlay-instruction') : null;
    if (overlayInstruction) {
      overlayInstruction.textContent = overlayInstructionDefault;
    }

    // Instantiate overlay preview renderer so level cards share the same editor plumbing.
    levelPreviewRenderer = createLevelPreviewRenderer({
      getOverlayElement: () => overlay,
      getOverlayPreviewElement: () => overlayPreview,
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
    bindGraphicsModeToggle();
    bindColorSchemeButton();
    bindNotationToggle();
    bindGlyphEquationToggle();
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
      emptyTowerNote: document.getElementById('playfield-combat-stats-tower-empty'),
      emptyAttackNote: document.getElementById('playfield-combat-stats-log-empty'),
      emptyEnemyNote: document.getElementById('playfield-combat-stats-enemy-empty'),
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
      container: document.getElementById('tower-loadout'),
      grid: document.getElementById('tower-loadout-grid'),
      note: document.getElementById('tower-loadout-note'),
    });

    setHideUpgradeMatrixCallback(hideUpgradeMatrix);
    setRenderUpgradeMatrixCallback(renderUpgradeMatrix);

    bindTowerUpgradeOverlay();

    // Synchronize tab interactions with overlay state, audio cues, and banner refreshes.
    configureTabManager({
      getOverlayActiveState: () => Boolean(overlay && overlay.classList.contains('active')),
      isFieldNotesOverlayVisible,
      onTabChange: (tabId) => {
        refreshTabMusic();
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
              ensureLamedBankSeeded();
              lamedSimulationInstance = new GravitySimulation({
                canvas: lamedCanvas,
                initialSparkBank: getLamedSparkBank(),
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
                stats: spireResourceState.lamed.stats || { totalAbsorptions: 0, totalMassGained: 0 },
              });
              
              lamedSimulationInstance.resize();
              const growthRateEl = document.getElementById('lamed-growth-rate');
              if (growthRateEl) {
                growthRateEl.textContent = `${lamedSimulationInstance.sparkSpawnRate.toFixed(2)} sparks/sec`;
              }
              
              // Hook up drag upgrade button
              const dragBtn = document.getElementById('lamed-upgrade-drag-btn');
              if (dragBtn) {
                dragBtn.addEventListener('click', () => {
                  if (lamedSimulationInstance.upgradeDrag()) {
                    // Sync state back to persistence
                    const state = lamedSimulationInstance.getState();
                    spireResourceState.lamed.dragLevel = state.dragLevel;
                    spireResourceState.lamed.starMass = state.starMass;
                    spireResourceState.lamed.stats = state.stats;
                    
                    updateLamedStatistics();
                    spireMenuController.updateCounts();
                  }
                });
              }
              
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
                  spireResourceState.lamed.stats = state.stats;
                  // Detect fresh spark absorptions so dependent spires unlock right away.
                  const currentLamedGlyphs = Math.max(
                    0,
                    Math.floor(state.stats?.totalAbsorptions || 0),
                  );
                  if (currentLamedGlyphs !== trackedLamedGlyphs) {
                    trackedLamedGlyphs = currentLamedGlyphs;
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
              ensureTsadiBankSeeded();
              tsadiSimulationInstance = new ParticleFusionSimulation({
                canvas: tsadiCanvas,
                initialParticleBank: getTsadiParticleBank(),
                samplePaletteGradient: samplePaletteGradient,
                onParticleBankChange: (value) => {
                  setTsadiParticleBank(value);
                },
                onTierChange: (tierInfo) => {
                  const tierEl = document.getElementById('tsadi-highest-tier');
                  if (tierEl) {
                    // Present both the Greek tier name and glyph for clarity in the UI.
                    const resolvedTier =
                      typeof tierInfo === 'object' && tierInfo !== null
                        ? tierInfo.tier ?? 0
                        : Number.isFinite(Number(tierInfo))
                          ? Number(tierInfo)
                          : 0;
                    const tierMetadata =
                      typeof tierInfo === 'object' && tierInfo !== null
                        ? tierInfo
                        : getGreekTierInfo(resolvedTier);
                    tierEl.textContent = `${tierMetadata.displayName || `${tierMetadata.name} (${tierMetadata.letter}) – Tier ${resolvedTier}`}`;
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
                  const previousGlyphs = trackedTsadiGlyphs;
                  trackedTsadiGlyphs = normalizedGlyphs;
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
                },
                onReset: () => {
                  console.log('Tsadi simulation reset after aleph explosion');
                },
              });
              tsadiSimulationInstance.resize();
              const generationRateEl = document.getElementById('tsadi-generation-rate');
              if (generationRateEl) {
                generationRateEl.textContent = `${tsadiSimulationInstance.spawnRate.toFixed(2)} particles/sec`;
              }
              spireMenuController.updateCounts();
              tsadiSimulationInstance.start();
              // Match the particle fusion canvas to the responsive layout constraints.
              scheduleSpireResize();

              // Bind upgrade buttons
              bindTsadiUpgradeButtons();
            }
          } else {
            tsadiSimulationInstance.resize();
            if (!tsadiSimulationInstance.running) {
              tsadiSimulationInstance.start();
            }
            scheduleSpireResize();
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

    setMergingLogicUnlocked(getMergeProgressState().mergingLogicUnlocked);

    const savedKufState = readStorageJson(KUF_STATE_STORAGE_KEY);
    initializeKufState(savedKufState || {});
    trackedKufGlyphs = Math.max(0, Math.floor(getKufGlyphs()));
    spireMenuController.updateCounts();
    onKufStateChange((event) => {
      if (event && event.type === 'result') {
        spireMenuController.updateCounts();
        // Keep Kuf unlock progression synchronized with fresh glyph payouts.
        const currentKufGlyphs = Math.max(0, Math.floor(getKufGlyphs()));
        if (currentKufGlyphs !== trackedKufGlyphs) {
          trackedKufGlyphs = currentKufGlyphs;
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
      trackedShinGlyphs = Math.max(0, Math.floor(getShinGlyphs()));
      setShinUIUpdateCallback(() => {
        updateShinDisplay();
        // React to manual Iteron allocations that push Shin glyph totals forward.
        const currentShinGlyphs = Math.max(0, Math.floor(getShinGlyphs()));
        if (currentShinGlyphs !== trackedShinGlyphs) {
          trackedShinGlyphs = currentShinGlyphs;
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
      playfield.setStatsPanelEnabled(playfieldStatsVisible);
      updatePlayfieldMenuState();
    }

    refreshTabMusic({ restart: true });

    bindOfflineOverlayElements();
    loadPersistentState();
    reconcileGlyphCurrencyFromState();

    bindStatusElements();
    bindPowderControls();
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
    bindOverlayEvents();
    bindVariableLibrary();
    bindUpgradeMatrix();
    bindLeaveLevelButton();
    initializeManualDropHandlers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Flush an autosave before the tab suspends so recent actions persist.
      commitAutoSave();
      markLastActive();
      suppressAudioPlayback('document-hidden');
      return;
    }
    if (document.visibilityState === 'visible') {
      releaseAudioSuppression('document-hidden');
      refreshTabMusic();
      checkOfflineRewards();
      markLastActive();
    }
  });

  window.addEventListener('blur', () => {
    suppressAudioPlayback('window-blur');
  });

  window.addEventListener('focus', () => {
    releaseAudioSuppression('window-blur');
    refreshTabMusic();
  });

  window.addEventListener('pagehide', () => {
    // Commit the latest autosave snapshot when the page transitions away.
    commitAutoSave();
    markLastActive();
    suppressAudioPlayback('pagehide');
    if (audioManager && typeof audioManager.stopMusic === 'function') {
      // Halt any lingering music so tracks do not continue after the session closes.
      audioManager.stopMusic();
    }
  });
  window.addEventListener('pageshow', () => {
    releaseAudioSuppression('pagehide');
    refreshTabMusic();
  });
  window.addEventListener('beforeunload', () => {
    // Ensure progress persists even if the browser closes abruptly.
    commitAutoSave();
    markLastActive();
    if (audioManager && typeof audioManager.stopMusic === 'function') {
      // Ensure the soundtrack fully stops before the tab exits.
      audioManager.stopMusic();
    }
  });

  document.addEventListener('keydown', (event) => {
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

    if (upgradeOverlay && upgradeOverlay.classList.contains('active')) {
      if (event.key === 'Escape') {
        event.preventDefault();
        hideUpgradeMatrix();
        return;
      }
      if ((event.key === 'Enter' || event.key === ' ') && event.target === upgradeOverlay) {
        event.preventDefault();
        hideUpgradeMatrix();
        return;
      }
      if (!overlay || !overlay.classList.contains('active')) {
        return;
      }
    }

    if (variableLibraryOverlay && variableLibraryOverlay.classList.contains('active')) {
      if (event.key === 'Escape') {
        event.preventDefault();
        hideVariableLibrary();
        return;
      }
      if (
        (event.key === 'Enter' || event.key === ' ') &&
        event.target === variableLibraryOverlay
      ) {
        event.preventDefault();
        hideVariableLibrary();
        return;
      }
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
