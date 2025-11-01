import {
  ALEPH_CHAIN_DEFAULT_UPGRADES,
  createAlephChainRegistry,
} from '../scripts/features/towers/alephChain.js';
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
import { SimplePlayfield, configurePlayfieldSystem } from './playfield.js';
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
// Shared color palette orchestration utilities.
import {
  configureColorSchemeSystem,
  getTowerVisualConfig,
  getOmegaWaveVisualConfig,
  bindColorSchemeButton,
  initializeColorScheme,
  COLOR_SCHEME_STORAGE_KEY,
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
} from './towersTab.js';
import towers from './data/towers/index.js'; // Modular tower definitions sourced from dedicated files.
import { initializeEquipmentState, EQUIPMENT_STORAGE_KEY } from './equipment.js';
import { initializeTowerTreeMap, refreshTowerTreeMap } from './towerTreeMap.js';
// Bring in drag-scroll support so hidden scrollbars remain usable.
import { enableDragScroll } from './dragScroll.js';
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

(() => {
  'use strict';

  const STARTUP_LOGO_DURATION_MS = 5000; // 2s fade-in + 1s hold + 2s fade-out.
  const STARTUP_OVERLAY_FADE_MS = 320;

  const startupOverlay = document.getElementById('startup-overlay');
  const startupLogo = startupOverlay ? startupOverlay.querySelector('[data-startup-logo]') : null;
  const startupLoading = startupOverlay ? startupOverlay.querySelector('[data-startup-loading]') : null;
  const startupHint = startupOverlay ? startupOverlay.querySelector('.startup-overlay__hint') : null;
  const startupHintDefaultText = startupHint ? startupHint.textContent : '';

  let startupLoadingActivated = false;
  let startupOverlayFadeHandle = null;

  function activateStartupLoadingSpinner() {
    if (!startupOverlay || !startupLoading) {
      return;
    }
    if (startupLoadingActivated) {
      return;
    }
    startupLoadingActivated = true;
    if (startupLoading.hasAttribute('hidden')) {
      startupLoading.removeAttribute('hidden');
    }
    requestAnimationFrame(() => {
      startupLoading.classList.add('startup-overlay__loading--active');
    });
    if (startupHint) {
      startupHint.textContent = 'Summoning motes…';
    }
  }

  function initializeStartupOverlay() {
    if (!startupOverlay) {
      return;
    }
    startupOverlay.classList.remove('startup-overlay--hidden');
    startupOverlay.removeAttribute('hidden');
    startupOverlay.setAttribute('aria-hidden', 'false');

    if (!startupLogo) {
      activateStartupLoadingSpinner();
      return;
    }

    let fallbackTimer = null;

    const finalizeLogo = () => {
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      startupLogo.setAttribute('hidden', '');
      activateStartupLoadingSpinner();
    };

    const logoAnimationHandler = () => {
      startupLogo.removeEventListener('animationend', logoAnimationHandler);
      finalizeLogo();
    };

    fallbackTimer = window.setTimeout(() => {
      startupLogo.removeEventListener('animationend', logoAnimationHandler);
      finalizeLogo();
    }, STARTUP_LOGO_DURATION_MS + 120);

    startupLogo.addEventListener('animationend', logoAnimationHandler);
  }

  function dismissStartupOverlay() {
    if (!startupOverlay) {
      return Promise.resolve();
    }

    activateStartupLoadingSpinner();

    if (startupOverlay.classList.contains('startup-overlay--hidden')) {
      if (!startupOverlay.hasAttribute('hidden')) {
        startupOverlay.setAttribute('hidden', '');
      }
      startupOverlay.setAttribute('aria-hidden', 'true');
      if (startupHint && startupHintDefaultText) {
        startupHint.textContent = startupHintDefaultText;
      }
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const complete = () => {
        if (startupOverlayFadeHandle) {
          window.clearTimeout(startupOverlayFadeHandle);
          startupOverlayFadeHandle = null;
        }
        startupOverlay.removeEventListener('transitionend', handleTransitionEnd);
        if (!startupOverlay.classList.contains('startup-overlay--hidden')) {
          startupOverlay.classList.add('startup-overlay--hidden');
        }
        startupOverlay.setAttribute('hidden', '');
        startupOverlay.setAttribute('aria-hidden', 'true');
        if (startupHint && startupHintDefaultText) {
          startupHint.textContent = startupHintDefaultText;
        }
        resolve();
      };

      const handleTransitionEnd = (event) => {
        if (event.target !== startupOverlay || event.propertyName !== 'opacity') {
          return;
        }
        complete();
      };

      if (startupOverlayFadeHandle) {
        window.clearTimeout(startupOverlayFadeHandle);
        startupOverlayFadeHandle = null;
      }

      startupOverlayFadeHandle = window.setTimeout(() => {
        startupOverlayFadeHandle = null;
        complete();
      }, STARTUP_OVERLAY_FADE_MS + 160);

      startupOverlay.addEventListener('transitionend', handleTransitionEnd);

      requestAnimationFrame(() => {
        startupOverlay.classList.add('startup-overlay--hidden');
        startupOverlay.setAttribute('aria-hidden', 'true');
      });
    });
  }

  initializeStartupOverlay();

  const alephChainUpgradeState = { ...ALEPH_CHAIN_DEFAULT_UPGRADES };

  const THERO_SYMBOL = 'þ';
  const COMMUNITY_DISCORD_INVITE = 'https://discord.gg/UzqhfsZQ8n'; // Reserved for future placement.

  const SVG_NS = 'http://www.w3.org/2000/svg';

  setTheroSymbol(THERO_SYMBOL);

  const GAMEPLAY_CONFIG_RELATIVE_PATH = './data/gameplayConfig.json';
  const GAMEPLAY_CONFIG_URL = new URL(GAMEPLAY_CONFIG_RELATIVE_PATH, import.meta.url);
  const FLUID_SIM_CONFIG_RELATIVE_PATH = './data/towerFluidSimulation.json';
  const FLUID_SIM_CONFIG_URL = new URL(FLUID_SIM_CONFIG_RELATIVE_PATH, import.meta.url);

  function normalizeFluidSimulationProfile(data) {
    if (!data || typeof data !== 'object') {
      return null;
    }

    const paletteSource =
      data.palette && typeof data.palette === 'object'
        ? data.palette
        : {
            stops: data.stops,
            restAlpha: data.restAlpha,
            freefallAlpha: data.freefallAlpha,
            backgroundTop: data.backgroundTop,
            backgroundBottom: data.backgroundBottom,
          };

    const dropSizes = Array.isArray(data.dropSizes)
      ? data.dropSizes
          .map((size) => {
            const numeric = Number.parseFloat(size);
            return Number.isFinite(numeric) ? Math.max(1, Math.round(numeric)) : null;
          })
          .filter((size) => Number.isFinite(size) && size > 0)
      : Array.isArray(data.grainSizes)
        ? data.grainSizes
            .map((size) => {
              const numeric = Number.parseFloat(size);
              return Number.isFinite(numeric) ? Math.max(1, Math.round(numeric)) : null;
            })
            .filter((size) => Number.isFinite(size) && size > 0)
        : [];

    if (!dropSizes.length) {
      dropSizes.push(1, 1, 2);
    }

    return {
      id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : 'fluid',
      label: typeof data.label === 'string' && data.label.trim() ? data.label.trim() : 'Fluid Study',
      dropSizes,
      dropVolumeScale: Number.isFinite(data.dropVolumeScale) && data.dropVolumeScale > 0
        ? data.dropVolumeScale
        : null,
      idleDrainRate: Number.isFinite(data.idleDrainRate) ? Math.max(1, data.idleDrainRate) : null,
      baseSpawnInterval: Number.isFinite(data.baseSpawnInterval) ? Math.max(30, data.baseSpawnInterval) : null,
      flowOffset: Number.isFinite(data.flowOffset) ? Math.max(0, data.flowOffset) : null,
      waveStiffness: Number.isFinite(data.waveStiffness) && data.waveStiffness > 0 ? data.waveStiffness : null,
      waveDamping: Number.isFinite(data.waveDamping) && data.waveDamping >= 0 ? data.waveDamping : null,
      sideFlowRate: Number.isFinite(data.sideFlowRate) && data.sideFlowRate >= 0 ? data.sideFlowRate : null,
      rippleFrequency: Number.isFinite(data.rippleFrequency) && data.rippleFrequency >= 0
        ? data.rippleFrequency
        : null,
      rippleAmplitude: Number.isFinite(data.rippleAmplitude) && data.rippleAmplitude >= 0
        ? data.rippleAmplitude
        : null,
      palette: mergeMotePalette(paletteSource || {}),
    };
  }

  async function loadFluidSimulationProfile() {
    if (fluidSimulationProfile) {
      return fluidSimulationProfile;
    }

    if (!fluidSimulationLoadPromise) {
      fluidSimulationLoadPromise = (async () => {
        try {
          if (typeof fetch === 'function') {
            return fetchJsonWithFallback(FLUID_SIM_CONFIG_URL.href, FLUID_SIM_CONFIG_RELATIVE_PATH);
          }
        } catch (error) {
          console.warn('Fluid simulation fetch failed; attempting module import.', error);
        }

        try {
          const module = await import(FLUID_SIM_CONFIG_URL.href, { assert: { type: 'json' } });
          if (module && module.default) {
            return module.default;
          }
        } catch (error) {
          console.error('Fluid simulation profile import failed.', error);
        }

        return null;
      })();
    }

    const rawProfile = await fluidSimulationLoadPromise;
    fluidSimulationLoadPromise = null;
    fluidSimulationProfile = normalizeFluidSimulationProfile(rawProfile);
    return fluidSimulationProfile;
  }

  let gameplayConfigData = null;
  let fluidSimulationProfile = null;
  let fluidSimulationLoadPromise = null;

  const FALLBACK_TOWER_LOADOUT_LIMIT = 4;
  const FALLBACK_BASE_START_THERO = 50;
  const FALLBACK_BASE_CORE_INTEGRITY = 100;
  // Baseline idle resource production rates so the ledger starts at grounded values.
  const FALLBACK_BASE_SCORE_RATE = 1;
  const FALLBACK_BASE_ENERGY_RATE = 0;
  const FALLBACK_BASE_FLUX_RATE = 0;

  let TOWER_LOADOUT_LIMIT = FALLBACK_TOWER_LOADOUT_LIMIT;
  let BASE_START_THERO = FALLBACK_BASE_START_THERO;
  let BASE_CORE_INTEGRITY = FALLBACK_BASE_CORE_INTEGRITY;

  // Enumerated graphics modes allow the UI to cycle between fidelity tiers.
  const GRAPHICS_MODES = Object.freeze({
    LOW: 'low',
    HIGH: 'high',
  });

  // Cached reference to the graphics fidelity toggle control.
  let graphicsModeButton = null;

  // Track the desktop cursor media query so the gem pointer can react to device changes.
  let desktopCursorMediaQuery = null;

  // Remember whether the gem cursor class is currently applied to the document body.
  let desktopCursorActive = false;

  // Active graphics fidelity so dependent systems can query the current mode.
  let activeGraphicsMode = GRAPHICS_MODES.HIGH;

  // Provides a human readable label for the current notation selection.
  function resolveNotationLabel(notation) {
    return notation === GAME_NUMBER_NOTATIONS.SCIENTIFIC ? 'Scientific' : 'Letters';
  }

  // Updates the toggle button text to reflect the active notation.
  function updateNotationToggleLabel() {
    if (!notationToggleButton) {
      return;
    }
    const notation = getGameNumberNotation();
    const label = resolveNotationLabel(notation);
    notationToggleButton.textContent = `Notation · ${label}`;
    notationToggleButton.setAttribute('aria-label', `Switch number notation (current: ${label})`);
  }

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

  // Shared handler fired whenever the notation preference changes.
  function handleNotationChange() {
    updateNotationToggleLabel();
    refreshNotationDisplays();
  }

  addGameNumberNotationChangeListener(handleNotationChange);

  // Applies the requested notation and optionally persists the choice.
  function applyNotationPreference(notation, { persist = true } = {}) {
    const resolved = setGameNumberNotation(notation);
    if (persist) {
      writeStorage(NOTATION_STORAGE_KEY, resolved);
    }
    return resolved;
  }

  // Cycles between letter suffix notation and scientific notation.
  function toggleNotationPreference() {
    const current = getGameNumberNotation();
    const next = current === GAME_NUMBER_NOTATIONS.SCIENTIFIC
      ? GAME_NUMBER_NOTATIONS.LETTERS
      : GAME_NUMBER_NOTATIONS.SCIENTIFIC;
    applyNotationPreference(next);
  }

  // Wires the notation toggle button to the preference handler.
  function bindNotationToggle() {
    notationToggleButton = document.getElementById('notation-toggle-button');
    if (!notationToggleButton) {
      return;
    }
    notationToggleButton.addEventListener('click', () => {
      toggleNotationPreference();
    });
    updateNotationToggleLabel();
  }

  // Tracks whether glyph equations should render inside tower upgrade cards.
  let glyphEquationsVisible = false;
  // Cache DOM nodes associated with the glyph equation toggle control.
  let glyphEquationToggleInput = null;
  let glyphEquationToggleStateLabel = null;

  // Normalizes persisted glyph equation values into a boolean flag.
  function normalizeGlyphEquationPreference(value) {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
        return true;
      }
      if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
        return false;
      }
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 0;
    }
    return Boolean(value);
  }

  // Synchronizes the slider UI and aria attributes with the active preference.
  function updateGlyphEquationToggleUi() {
    if (glyphEquationToggleInput) {
      glyphEquationToggleInput.checked = glyphEquationsVisible;
      glyphEquationToggleInput.setAttribute('aria-checked', glyphEquationsVisible ? 'true' : 'false');
      const controlShell = glyphEquationToggleInput.closest('.settings-toggle-control');
      if (controlShell) {
        controlShell.classList.toggle('is-active', glyphEquationsVisible);
      }
    }
    if (glyphEquationToggleStateLabel) {
      glyphEquationToggleStateLabel.textContent = glyphEquationsVisible ? 'On' : 'Off';
    }
  }

  // Applies the glyph equation visibility state and optionally persists the choice.
  function applyGlyphEquationPreference(preference, { persist = true } = {}) {
    const enabled = normalizeGlyphEquationPreference(preference);
    glyphEquationsVisible = enabled;
    const body = typeof document !== 'undefined' ? document.body : null;
    if (body) {
      body.classList.toggle('show-glyph-equations', glyphEquationsVisible);
    }
    updateGlyphEquationToggleUi();
    if (persist) {
      writeStorage(GLYPH_EQUATIONS_STORAGE_KEY, glyphEquationsVisible ? '1' : '0');
    }
    return glyphEquationsVisible;
  }

  // Binds the glyph equation slider to the preference handler.
  function bindGlyphEquationToggle() {
    glyphEquationToggleInput = document.getElementById('glyph-equation-toggle');
    glyphEquationToggleStateLabel = document.getElementById('glyph-equation-toggle-state');
    if (!glyphEquationToggleInput) {
      return;
    }
    glyphEquationToggleInput.addEventListener('change', (event) => {
      applyGlyphEquationPreference(event?.target?.checked);
    });
    updateGlyphEquationToggleUi();
  }

  // Provides an accessible label for the graphics fidelity control.
  function resolveGraphicsModeLabel(mode = activeGraphicsMode) {
    return mode === GRAPHICS_MODES.LOW ? 'Low' : 'High';
  }

  // Synchronizes the graphics toggle button label with the active fidelity state.
  function updateGraphicsModeButton() {
    if (!graphicsModeButton) {
      return;
    }
    const label = resolveGraphicsModeLabel();
    graphicsModeButton.textContent = `Graphics · ${label}`;
    graphicsModeButton.setAttribute('aria-label', `Switch graphics quality (current: ${label})`);
  }

  // Detects whether the current device should default to low graphics rendering.
  function prefersLowGraphicsByDefault() {
    if (typeof window !== 'undefined') {
      try {
        const matcher = typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : null;
        const coarsePointer = matcher ? matcher('(pointer: coarse)').matches : false;
        const hoverNone = matcher ? matcher('(hover: none)').matches : false;
        const width = Number.isFinite(window.innerWidth) ? window.innerWidth : null;
        const smallViewport = width !== null && width <= 900;
        if ((coarsePointer && hoverNone) || (coarsePointer && smallViewport)) {
          return true;
        }
        if (width !== null && width <= 768) {
          return true;
        }
      } catch (error) {
        console.warn('Graphics mode heuristic failed; falling back to user agent detection.', error);
      }
    }

    if (typeof navigator !== 'undefined') {
      const userAgent = navigator.userAgent || '';
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
        return true;
      }
    }

    return false;
  }

  // Apply or remove the gem cursor class depending on the detected pointer support.
  function updateDesktopCursorClass(enabled) {
    const body = typeof document !== 'undefined' ? document.body : null;
    if (!body) {
      return;
    }
    const nextState = Boolean(enabled);
    if (nextState === desktopCursorActive) {
      return;
    }
    desktopCursorActive = nextState;
    body.classList.toggle('mouse-cursor-gem', desktopCursorActive);
  }

  // Fall back to user agent heuristics when matchMedia support is unavailable.
  function evaluateDesktopCursorPreferenceFallback() {
    if (typeof navigator === 'undefined') {
      updateDesktopCursorClass(false);
      return;
    }
    const userAgent = navigator.userAgent || '';
    const mobilePattern = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;
    updateDesktopCursorClass(!mobilePattern.test(userAgent));
  }

  // Initialize the gem cursor preference and react to pointer capability changes over time.
  function initializeDesktopCursorPreference() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      evaluateDesktopCursorPreferenceFallback();
      return;
    }
    try {
      desktopCursorMediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
      updateDesktopCursorClass(desktopCursorMediaQuery.matches);
      const listener = (event) => {
        // Reflect pointer precision changes (e.g., tablet keyboard attachments) in real time.
        updateDesktopCursorClass(event.matches);
      };
      if (typeof desktopCursorMediaQuery.addEventListener === 'function') {
        desktopCursorMediaQuery.addEventListener('change', listener);
      } else if (typeof desktopCursorMediaQuery.addListener === 'function') {
        desktopCursorMediaQuery.addListener(listener);
      }
    } catch (error) {
      console.warn('Desktop cursor media query failed; falling back to user agent detection.', error);
      evaluateDesktopCursorPreferenceFallback();
    }
  }

  // Applies the requested graphics fidelity, updating DOM classes and persistence.
  function applyGraphicsMode(mode, { persist = true } = {}) {
    const normalized = mode === GRAPHICS_MODES.LOW ? GRAPHICS_MODES.LOW : GRAPHICS_MODES.HIGH;
    activeGraphicsMode = normalized;

    const body = typeof document !== 'undefined' ? document.body : null;
    if (body) {
      body.classList.toggle('graphics-mode-low', normalized === GRAPHICS_MODES.LOW);
      body.classList.toggle('graphics-mode-high', normalized === GRAPHICS_MODES.HIGH);
    }

    updateGraphicsModeButton();

    if (persist) {
      writeStorage(GRAPHICS_MODE_STORAGE_KEY, normalized);
    }

    if (powderSimulation && typeof powderSimulation.render === 'function') {
      powderSimulation.render();
    }

    if (playfield && typeof playfield.draw === 'function') {
      playfield.draw();
    }

    return normalized;
  }

  // Allows dependent systems to query the active graphics fidelity.
  function isLowGraphicsModeActive() {
    return activeGraphicsMode === GRAPHICS_MODES.LOW;
  }

  // Toggles between the available graphics fidelity presets.
  function toggleGraphicsMode() {
    const next = activeGraphicsMode === GRAPHICS_MODES.LOW ? GRAPHICS_MODES.HIGH : GRAPHICS_MODES.LOW;
    applyGraphicsMode(next);
  }

  // Wires the graphics fidelity button to the toggle handler.
  function bindGraphicsModeToggle() {
    graphicsModeButton = document.getElementById('graphics-mode-button');
    if (!graphicsModeButton) {
      return;
    }
    graphicsModeButton.addEventListener('click', () => {
      toggleGraphicsMode();
    });
    updateGraphicsModeButton();
  }

  // Initializes graphics fidelity from storage or device heuristics.
  function initializeGraphicsMode() {
    const stored = readStorage(GRAPHICS_MODE_STORAGE_KEY);
    const normalized = stored === GRAPHICS_MODES.LOW || stored === GRAPHICS_MODES.HIGH ? stored : null;
    const fallback = prefersLowGraphicsByDefault() ? GRAPHICS_MODES.LOW : GRAPHICS_MODES.HIGH;
    applyGraphicsMode(normalized || fallback, { persist: !normalized });
  }

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

  function applyGameplayConfig(config = {}) {
    gameplayConfigData = config || {};

    const defaults = gameplayConfigData.defaults || {};

    TOWER_LOADOUT_LIMIT =
      Number.isFinite(defaults.towerLoadoutLimit) && defaults.towerLoadoutLimit > 0
        ? Math.max(1, Math.floor(defaults.towerLoadoutLimit))
        : FALLBACK_TOWER_LOADOUT_LIMIT;
    setTowerLoadoutLimit(TOWER_LOADOUT_LIMIT);

    BASE_START_THERO =
      Number.isFinite(defaults.baseStartThero) && defaults.baseStartThero > 0
        ? defaults.baseStartThero
        : FALLBACK_BASE_START_THERO;

    BASE_CORE_INTEGRITY =
      Number.isFinite(defaults.baseCoreIntegrity) && defaults.baseCoreIntegrity > 0
        ? defaults.baseCoreIntegrity
        : FALLBACK_BASE_CORE_INTEGRITY;

    const startingThero = calculateStartingThero();
    baseResources.score = startingThero;
    resourceState.score = startingThero;
    baseResources.scoreRate = FALLBACK_BASE_SCORE_RATE;
    baseResources.energyRate = FALLBACK_BASE_ENERGY_RATE;
    baseResources.fluxRate = FALLBACK_BASE_FLUX_RATE;
    resourceState.scoreRate = baseResources.scoreRate;
    resourceState.energyRate = baseResources.energyRate;
    resourceState.fluxRate = baseResources.fluxRate;

    // Assemble tower definitions from modular tower sources to keep stats centralized per file.
    const towerDefinitions = towers.map((tower) => ({ ...tower }));
    gameplayConfigData.towers = towerDefinitions;
    setTowerDefinitions(towerDefinitions);

    const loadoutState = getTowerLoadoutState();
    const unlockState = getTowerUnlockState();

    const loadoutCandidates = Array.isArray(defaults.initialTowerLoadout)
      ? defaults.initialTowerLoadout
      : loadoutState.selected;

    const normalizedLoadout = [];
    loadoutCandidates.forEach((towerId) => {
      if (
        typeof towerId === 'string' &&
        getTowerDefinition(towerId) &&
        !normalizedLoadout.includes(towerId) &&
        normalizedLoadout.length < TOWER_LOADOUT_LIMIT
      ) {
        normalizedLoadout.push(towerId);
      }
    });
    if (!normalizedLoadout.length && towerDefinitions.length) {
      normalizedLoadout.push(towerDefinitions[0].id);
    }
    loadoutState.selected = normalizedLoadout;

    const unlocked = new Set(
      Array.isArray(defaults.initialUnlockedTowers)
        ? defaults.initialUnlockedTowers.filter((towerId) => getTowerDefinition(towerId))
        : [],
    );
    loadoutState.selected.forEach((towerId) => unlocked.add(towerId));
    unlockState.unlocked = unlocked;
    setMergingLogicUnlocked(unlocked.has('beta'));
    initializeDiscoveredVariablesFromUnlocks(unlocked);

    setEnemyCodexEntries(gameplayConfigData.enemies);

    setLevelBlueprints(gameplayConfigData.maps);
    setLevelConfigs(gameplayConfigData.levels);
    initializeInteractiveLevelProgression();
    populateIdleLevelConfigs(baseResources);
    pruneLevelState();

    generateLevelAchievements();

    return gameplayConfigData;
  }

  async function ensureGameplayConfigLoaded() {
    if (gameplayConfigData) {
      return gameplayConfigData;
    }

    let lastError = null;

    try {
      const configFromFetch = await loadGameplayConfigViaFetch(
        GAMEPLAY_CONFIG_URL.href,
        GAMEPLAY_CONFIG_RELATIVE_PATH,
      );
      if (configFromFetch) {
        return applyGameplayConfig(configFromFetch);
      }
    } catch (error) {
      lastError = error;
      console.warn('Primary gameplay-config fetch failed; falling back to alternate loaders.', error);
    }

    const embeddedConfig = getEmbeddedGameplayConfig();
    if (embeddedConfig) {
      return applyGameplayConfig(embeddedConfig);
    }

    try {
      const configFromModule = await loadGameplayConfigViaModule(GAMEPLAY_CONFIG_URL.href);
      if (configFromModule) {
        return applyGameplayConfig(configFromModule);
      }
    } catch (error) {
      lastError = error;
    }

    console.error('Unable to load gameplay configuration', lastError);
    throw lastError || new Error('Unable to load gameplay configuration');
  }

  function calculateStartingThero() {
    return BASE_START_THERO * getStartingTheroMultiplier();
  }

  let levelGrid = null;
  let activeLevelEl = null;
  let leaveLevelBtn = null;
  let overlay = null;
  let overlayLabel = null;
  let overlayTitle = null;
  let overlayExample = null;
  let overlayPreview = null;
  let overlayPreviewCanvas = null;
  let overlayPreviewLevel = null;
  let previewPlayfield = null;
  let overlayMode = null;
  let overlayDuration = null;
  let overlayRewards = null;
  let overlayStartThero = null;
  let overlayLast = null;
  let overlayInstruction = null;
  let overlayRequiresLevelExit = false;
  const levelEditorElements = {
    container: null,
    toggle: null,
    note: null,
    count: null,
    clear: null,
    reset: null,
    exportButton: null,
    output: null,
    status: null,
  };
  const levelEditorState = {
    levelId: null,
    points: [],
    originalPoints: [],
    editing: false,
    draggingIndex: -1,
    pointerId: null,
    canvasListenersAttached: false,
    statusTimeout: null,
  };
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
  ].filter(Boolean);

  const fieldNotesElements = {
    overlay: null,
    closeButton: null,
    openButton: null,
    copy: null,
    pagination: null,
    pages: [],
    pageIndicator: null,
    prevButton: null,
    nextButton: null,
    lastFocus: null,
  };

  const fieldNotesState = {
    currentIndex: 0,
    animating: false,
    touchStart: null,
  };

  const overlayHideStates = new WeakMap();

  function cancelOverlayHide(overlay) {
    if (!overlay) {
      return;
    }

    const state = overlayHideStates.get(overlay);
    if (!state) {
      return;
    }

    if (state.transitionHandler) {
      overlay.removeEventListener('transitionend', state.transitionHandler);
    }

    if (state.timeoutId !== null && typeof window !== 'undefined') {
      window.clearTimeout(state.timeoutId);
    }

    overlayHideStates.delete(overlay);
  }

  function scheduleOverlayHide(overlay) {
    if (!overlay) {
      return;
    }

    cancelOverlayHide(overlay);

    const finalizeHide = () => {
      cancelOverlayHide(overlay);
      overlay.setAttribute('hidden', '');
    };

    const handleTransitionEnd = (event) => {
      if (event && event.target !== overlay) {
        return;
      }
      finalizeHide();
    };

    overlay.addEventListener('transitionend', handleTransitionEnd);

    const timeoutId =
      typeof window !== 'undefined' ? window.setTimeout(finalizeHide, 320) : null;

    overlayHideStates.set(overlay, {
      transitionHandler: handleTransitionEnd,
      timeoutId,
    });
  }

  function revealOverlay(overlay) {
    if (!overlay) {
      return;
    }

    cancelOverlayHide(overlay);
    overlay.removeAttribute('hidden');
  }

  function setElementVisibility(element, visible) {
    // Toggle layout fragments while preserving any pre-existing accessibility hints.
    if (!element) {
      return;
    }

    if (visible) {
      element.classList.remove('is-hidden');
      element.removeAttribute('hidden');
      element.removeAttribute('aria-hidden');
      return;
    }

    element.classList.add('is-hidden');
    element.setAttribute('hidden', '');
    element.setAttribute('aria-hidden', 'true');
  }

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

  function updateLayoutVisibility() {
    // Hide the battlefield until an interactive level is in progress.
    const shouldShowPlayfield = Boolean(activeLevelId && activeLevelIsInteractive);
    setElementVisibility(playfieldWrapper, shouldShowPlayfield);
    setElementVisibility(stageControls, shouldShowPlayfield);
    setElementVisibility(levelSelectionSection, !shouldShowPlayfield);

    if (!shouldShowPlayfield) {
      closePlayfieldMenu();
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

  const developerControlElements = {
    container: null,
    fields: {
      moteBank: null,
      moteRate: null,
      startThero: null,
      theroMultiplier: null,
      glyphs: null,
    },
  };

  const developerFieldHandlers = {
    moteBank: setDeveloperIdleMoteBank,
    moteRate: setDeveloperIdleMoteRate,
    startThero: setDeveloperBaseStartThero,
    theroMultiplier: setDeveloperTheroMultiplier,
    glyphs: setDeveloperGlyphs,
  };

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
  let playfieldMenuLevelSelectConfirming = false;
  const playfieldMenuLevelSelectDefaultLabel = 'Level Selection';
  let playfieldMenuOpen = false;
  let activeLevelIsInteractive = false;

  function formatDeveloperInteger(value) {
    if (!Number.isFinite(value)) {
      return '';
    }
    return String(Math.max(0, Math.round(value)));
  }

  function formatDeveloperFloat(value, precision = 2) {
    if (!Number.isFinite(value)) {
      return '';
    }
    const normalized = Math.max(0, value);
    if (Number.isInteger(normalized)) {
      return String(normalized);
    }
    return normalized.toFixed(precision);
  }

  function recordDeveloperAdjustment(field, value) {
    if (!developerModeActive) {
      return;
    }
    recordPowderEvent('developer-adjust', { field, value });
  }

  function setDeveloperIdleMoteBank(value) {
    if (!Number.isFinite(value)) {
      return;
    }
    const normalized = Math.max(0, Math.floor(value));
    if (powderSimulation) {
      powderSimulation.idleBank = normalized;
    }
    handlePowderIdleBankChange(powderSimulation ? powderSimulation.idleBank : normalized);
    recordDeveloperAdjustment('idle-mote-bank', normalized);
    // Developer tweaks should persist so debugging sessions survive reloads.
    schedulePowderBasinSave();
    updatePowderDisplay();
  }

  function setDeveloperIdleMoteRate(value) {
    if (!Number.isFinite(value)) {
      return;
    }
    const normalized = Math.max(0, value);
    if (powderSimulation) {
      powderSimulation.idleDrainRate = normalized;
    }
    powderState.idleDrainRate = normalized;
    recordDeveloperAdjustment('idle-mote-rate', normalized);
    // Persist idle rate overrides to keep testing scenarios reproducible.
    schedulePowderBasinSave();
    updatePowderDisplay();
  }

  function setDeveloperBaseStartThero(value) {
    if (!Number.isFinite(value)) {
      return;
    }
    const normalized = Math.max(0, value);
    BASE_START_THERO = normalized;
    recordDeveloperAdjustment('base-start-thero', normalized);
    updateLevelCards();
    updatePowderLedger();
    updateStatusDisplays();
  }

  function setDeveloperTheroMultiplier(value) {
    if (value === null || value === undefined) {
      clearDeveloperTheroMultiplierOverride();
      recordDeveloperAdjustment('thero-multiplier', 'default');
      updateLevelCards();
      updatePowderLedger();
      updateStatusDisplays();
      return;
    }

    if (!Number.isFinite(value)) {
      return;
    }

    const normalized = Math.max(0, value);
    setDeveloperTheroMultiplierOverride(normalized);
    recordDeveloperAdjustment('thero-multiplier', normalized);
    updateLevelCards();
    updatePowderLedger();
    updateStatusDisplays();
  }

  function setDeveloperGlyphs(value) {
    if (!Number.isFinite(value)) {
      return;
    }
    const normalized = Math.max(0, Math.floor(value));
    setGlyphCurrency(normalized);
    gameStats.enemiesDefeated = normalized;
    if (gameStats.towersPlaced > normalized) {
      gameStats.towersPlaced = normalized;
    }
    recordDeveloperAdjustment('glyphs', normalized);
    updateStatusDisplays();
  }

  function syncDeveloperControlValues() {
    const { fields } = developerControlElements;
    if (!fields) {
      return;
    }
    if (fields.moteBank) {
      fields.moteBank.value = formatDeveloperInteger(getCurrentIdleMoteBank());
    }
    if (fields.moteRate) {
      fields.moteRate.value = formatDeveloperFloat(getCurrentMoteDispenseRate());
    }
    if (fields.startThero) {
      fields.startThero.value = formatDeveloperInteger(BASE_START_THERO);
    }
    if (fields.theroMultiplier) {
      const override = getDeveloperTheroMultiplierOverride();
      const baseMultiplier = getBaseStartingTheroMultiplier();
      fields.theroMultiplier.placeholder = formatDeveloperFloat(baseMultiplier, 2);
      fields.theroMultiplier.value = Number.isFinite(override) && override >= 0
        ? formatDeveloperFloat(override, 2)
        : '';
    }
    if (fields.glyphs) {
      fields.glyphs.value = formatDeveloperInteger(getGlyphCurrency());
    }
  }

  function updateDeveloperControlsVisibility() {
    const active = developerModeActive;
    const { container, fields } = developerControlElements;
    if (container) {
      container.hidden = !active;
      container.setAttribute('aria-hidden', active ? 'false' : 'true');
    }
    if (fields) {
      Object.values(fields).forEach((input) => {
        if (input) {
          input.disabled = !active;
        }
      });
    }
    if (active) {
      syncDeveloperControlValues();
    }
  }

  function handleDeveloperFieldCommit(event) {
    const input = event?.target;
    if (!input || !(input instanceof HTMLInputElement)) {
      return;
    }
    const field = input.dataset?.developerField;
    if (!field) {
      return;
    }
    if (!developerModeActive) {
      syncDeveloperControlValues();
      return;
    }

    const handler = developerFieldHandlers[field];
    if (!handler) {
      return;
    }

    const rawValue = typeof input.value === 'string' ? input.value.trim() : '';
    if (rawValue === '') {
      handler(null);
      syncDeveloperControlValues();
      return;
    }

    const parsed = Number.parseFloat(rawValue);
    if (!Number.isFinite(parsed)) {
      syncDeveloperControlValues();
      return;
    }

    handler(parsed);
    syncDeveloperControlValues();
  }

  function bindDeveloperControls() {
    developerControlElements.container = document.getElementById('developer-control-panel');
    const inputs = document.querySelectorAll('[data-developer-field]');

    inputs.forEach((input) => {
      const field = input.dataset.developerField;
      if (!field) {
        return;
      }
      developerControlElements.fields[field] = input;
      input.disabled = true;
      input.addEventListener('change', handleDeveloperFieldCommit);
      input.addEventListener('blur', handleDeveloperFieldCommit);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          handleDeveloperFieldCommit(event);
        }
      });
    });

    syncDeveloperControlValues();
    updateDeveloperControlsVisibility();
  }

  function getAlephChainUpgrades() {
    return { ...alephChainUpgradeState };
  }

  function updateAlephChainUpgrades(updates = {}) {
    if (!updates || typeof updates !== 'object') {
      return getAlephChainUpgrades();
    }

    const nextState = { ...alephChainUpgradeState };
    if (Number.isFinite(updates.x) && updates.x > 0) {
      nextState.x = updates.x;
    }
    if (Number.isFinite(updates.y) && updates.y > 0) {
      nextState.y = updates.y;
    }
    if (Number.isFinite(updates.z)) {
      nextState.z = Math.max(1, Math.floor(updates.z));
    }

    const changed =
      nextState.x !== alephChainUpgradeState.x ||
      nextState.y !== alephChainUpgradeState.y ||
      nextState.z !== alephChainUpgradeState.z;

    if (!changed) {
      return getAlephChainUpgrades();
    }

    alephChainUpgradeState.x = nextState.x;
    alephChainUpgradeState.y = nextState.y;
    alephChainUpgradeState.z = nextState.z;

    if (playfield?.alephChain) {
      playfield.alephChain.setUpgrades(alephChainUpgradeState);
      playfield.syncAlephChainStats();
    }

    return getAlephChainUpgrades();
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
  const playfieldOutcomeElements = {
    overlay: null,
    title: null,
    subtitle: null,
    primary: null,
    secondary: null,
  };
  const playfieldOutcomeState = {
    onPrimary: null,
    onSecondary: null,
    bound: false,
  };

  // Invoke the currently registered primary outcome action, if present.
  function triggerPlayfieldOutcomePrimary() {
    if (typeof playfieldOutcomeState.onPrimary === 'function') {
      playfieldOutcomeState.onPrimary();
    }
  }

  // Invoke the stored secondary outcome action when the retry button is pressed.
  function triggerPlayfieldOutcomeSecondary() {
    if (typeof playfieldOutcomeState.onSecondary === 'function') {
      playfieldOutcomeState.onSecondary();
    }
  }

  // Reset the outcome overlay to its hidden state and optionally restore focus.
  function hidePlayfieldOutcome({ restoreFocus = false } = {}) {
    const { overlay } = playfieldOutcomeElements;
    if (!overlay) {
      return;
    }
    overlay.classList.remove('active', 'playfield-outcome--victory', 'playfield-outcome--defeat');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('hidden', '');
    playfieldOutcomeState.onPrimary = null;
    playfieldOutcomeState.onSecondary = null;
    const { primary, secondary } = playfieldOutcomeElements;
    if (primary) {
      primary.disabled = false;
    }
    if (secondary) {
      secondary.disabled = false;
      secondary.setAttribute('hidden', '');
    }
    if (restoreFocus && playfieldElements.startButton && typeof playfieldElements.startButton.focus === 'function') {
      try {
        playfieldElements.startButton.focus({ preventScroll: true });
      } catch (error) {
        playfieldElements.startButton.focus();
      }
    }
  }

  // Surface the desired victory or defeat text and wire up overlay button callbacks.
  function showPlayfieldOutcome({
    outcome = 'defeat',
    title = '',
    subtitle = '',
    primaryLabel = 'Back to Level Selection',
    onPrimary = null,
    secondaryLabel = null,
    onSecondary = null,
  } = {}) {
    const { overlay, title: titleEl, subtitle: subtitleEl, primary, secondary } = playfieldOutcomeElements;
    if (!overlay || !titleEl || !primary) {
      return;
    }

    hidePlayfieldOutcome();

    overlay.classList.remove('playfield-outcome--victory', 'playfield-outcome--defeat');
    if (outcome === 'victory') {
      overlay.classList.add('playfield-outcome--victory');
    } else {
      overlay.classList.add('playfield-outcome--defeat');
    }

    titleEl.textContent = title;
    if (subtitleEl) {
      subtitleEl.textContent = subtitle || '';
      subtitleEl.toggleAttribute('hidden', !subtitle);
    }

    primary.textContent = primaryLabel;
    playfieldOutcomeState.onPrimary = typeof onPrimary === 'function' ? onPrimary : null;

    if (secondary) {
      if (secondaryLabel) {
        secondary.textContent = secondaryLabel;
        secondary.removeAttribute('hidden');
        playfieldOutcomeState.onSecondary = typeof onSecondary === 'function' ? onSecondary : null;
      } else {
        secondary.setAttribute('hidden', '');
        playfieldOutcomeState.onSecondary = null;
      }
    }

    overlay.removeAttribute('hidden');
    overlay.setAttribute('aria-hidden', 'false');

    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });

    if (typeof overlay.focus === 'function') {
      try {
        overlay.focus({ preventScroll: true });
      } catch (error) {
        overlay.focus();
      }
    }
  }

  // Attach listeners to the overlay the first time it is initialized.
  function bindPlayfieldOutcomeEvents() {
    if (playfieldOutcomeState.bound) {
      return;
    }
    const { overlay, primary, secondary } = playfieldOutcomeElements;
    if (!overlay || !primary) {
      return;
    }

    primary.addEventListener('click', () => triggerPlayfieldOutcomePrimary());
    if (secondary) {
      secondary.addEventListener('click', () => triggerPlayfieldOutcomeSecondary());
    }
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        triggerPlayfieldOutcomePrimary();
      }
    });
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        triggerPlayfieldOutcomePrimary();
      }
    });

    playfieldOutcomeState.bound = true;
  }

  // Leave combat and transition back to the level selection grid when the overlay is dismissed.
  function exitToLevelSelectionFromOutcome() {
    hidePlayfieldOutcome();
    leaveActiveLevel();
    updateLayoutVisibility();
  }

  // Attempt to reload the most recent endless checkpoint when the retry button is pressed.
  function handleOutcomeRetryRequest() {
    if (!playfield || typeof playfield.retryFromEndlessCheckpoint !== 'function') {
      return;
    }
    const success = playfield.retryFromEndlessCheckpoint();
    if (success) {
      hidePlayfieldOutcome();
      return;
    }
    const { secondary } = playfieldOutcomeElements;
    if (secondary) {
      secondary.disabled = true;
    }
  }

  const alephSubscriptDigits = {
    0: '₀',
    1: '₁',
    2: '₂',
    3: '₃',
    4: '₄',
    5: '₅',
    6: '₆',
    7: '₇',
    8: '₈',
    9: '₉',
  };

  function toSubscriptNumber(value) {
    const normalized = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    return `${normalized}`
      .split('')
      .map((digit) => alephSubscriptDigits[digit] || digit)
      .join('');
  }

  function formatAlephLabel(index) {
    const normalized = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
    return `ℵ${toSubscriptNumber(normalized)}`;
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

  const audioSuppressionReasons = new Set();

  function suppressAudioPlayback(reason = 'unspecified') {
    if (!audioManager) {
      return;
    }
    const initialSize = audioSuppressionReasons.size;
    audioSuppressionReasons.add(reason);
    if (initialSize === 0) {
      if (typeof audioManager.suspendMusic === 'function') {
        audioManager.suspendMusic();
      } else if (typeof audioManager.stopMusic === 'function') {
        audioManager.stopMusic();
      }
    }
  }

  function releaseAudioSuppression(reason) {
    if (!audioManager) {
      return;
    }
    if (reason) {
      audioSuppressionReasons.delete(reason);
    } else {
      audioSuppressionReasons.clear();
    }
    if (audioSuppressionReasons.size === 0 && typeof audioManager.resumeSuspendedMusic === 'function') {
      audioManager.resumeSuspendedMusic();
    }
  }

  function isAudioSuppressed() {
    if (audioSuppressionReasons.size > 0) {
      return true;
    }
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return true;
    }
    return false;
  }

  let audioControlsBinding = null;
  // Cached reference to the notation toggle control inside the Codex panel.
  let notationToggleButton = null;

  // Keeps the audio slider UI synchronized with the manager state.
  function syncAudioControlsFromManager() {
    if (audioControlsBinding && typeof audioControlsBinding.syncFromManager === 'function') {
      audioControlsBinding.syncFromManager();
    }
  }

  // Persists the current music and sound effect volumes.
  function saveAudioSettings() {
    if (!audioManager) {
      return;
    }
    writeStorageJson(AUDIO_SETTINGS_STORAGE_KEY, {
      musicVolume: audioManager.musicVolume,
      sfxVolume: audioManager.sfxVolume,
    });
  }

  // Connects DOM slider controls to the shared audio manager instance.
  function bindAudioControls() {
    audioControlsBinding = bindAudioControlElements(audioManager, {
      onVolumeCommit: () => {
        saveAudioSettings();
      },
    });
  }

  function determineMusicKey() {
    const tab = getActiveTabId() || 'tower';
    if (tab === 'tower') {
      const interactive = Boolean(
        playfield &&
          typeof playfield.isInteractiveLevelActive === 'function' &&
          playfield.isInteractiveLevelActive(),
      );
      return interactive ? 'levelActive' : 'levelSelect';
    }
    if (tab === 'towers') {
      return 'towers';
    }
    if (tab === 'powder') {
      return 'powder';
    }
    if (tab === 'achievements') {
      return 'achievements';
    }
    if (tab === 'options') {
      return 'codex';
    }
    return 'levelSelect';
  }

  function refreshTabMusic(options = {}) {
    if (!audioManager) {
      return;
    }
    if (isAudioSuppressed()) {
      return;
    }
    const key = determineMusicKey();
    if (!key) {
      return;
    }
    audioManager.playMusic(key, options);
  }

  const resourceElements = {
    theroMultiplier: null,
    glyphsTotal: null,
    glyphsUnused: null,
    tabGlyphBadge: null,
    tabMoteBadge: null,
  };

  // Cache the relocated resource nodes so status updates only swap text content.
  function bindStatusElements() {
    resourceElements.theroMultiplier = document.getElementById('level-thero-multiplier');
    resourceElements.glyphsTotal = document.getElementById('tower-glyphs-total');
    resourceElements.glyphsUnused = document.getElementById('tower-glyphs-unused');
    resourceElements.tabGlyphBadge = document.getElementById('tab-glyph-badge');
    resourceElements.tabMoteBadge = document.getElementById('tab-mote-badge');
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

    const totalGlyphs = Math.max(0, Math.floor(gameStats.enemiesDefeated || 0));
    const unusedGlyphs = Math.max(0, Math.floor(getGlyphCurrency()));
    if (resourceElements.glyphsTotal) {
      resourceElements.glyphsTotal.textContent = `${formatWholeNumber(totalGlyphs)} ℵ`;
    }
    if (resourceElements.glyphsUnused) {
      resourceElements.glyphsUnused.textContent = formatWholeNumber(unusedGlyphs);
    }
    if (resourceElements.tabGlyphBadge) {
      const tabGlyphLabel = formatWholeNumber(unusedGlyphs);
      resourceElements.tabGlyphBadge.textContent = tabGlyphLabel;
      resourceElements.tabGlyphBadge.setAttribute('aria-label', `${tabGlyphLabel} unused glyphs`);
      const hasUnusedGlyphs = unusedGlyphs > 0;
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

    // Refresh mote-specific HUD elements whenever core status displays tick.
    updateMoteStatsDisplays();
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

  const powderConfig = {
    sandOffsetInactive: 0,
    sandOffsetActive: 1.1,
    duneHeightBase: 1,
    duneHeightMax: 6,
    thetaBase: 1.3,
    zetaBase: 1.6,
    simulatedDuneGainMax: 3.4,
    wallBaseGapMotes: 15,
    wallGapPerGlyph: 1,
    wallGapViewportRatio: 0.15, // Narrow the tower walls so the visible mote lane is roughly one-fifth of the previous span.
    fluidUnlockSigils: 1,
  };

  const powderState = {
    sandOffset: powderConfig.sandOffsetActive,
    duneHeight: powderConfig.duneHeightBase,
    charges: 0,
    simulatedDuneGain: 0,
    wallGlyphsLit: 0,
    glyphsAwarded: 0, // Highest Aleph index already translated into glyph currency.
    idleMoteBank: 100,
    idleDrainRate: 1,
    pendingMoteDrops: [],
    idleBankHydrated: false, // Tracks whether the active simulation already holds the saved idle motes.
    motePalette: mergeMotePalette(DEFAULT_MOTE_PALETTE),
    simulationMode: 'sand',
    wallGapTarget: powderConfig.wallBaseGapMotes,
    modeSwitchPending: false,
    fluidProfileLabel: 'Fluid Study',
    fluidUnlocked: false,
    // Track pointer gestures for the powder basin camera controls.
    viewInteraction: null,
    // Cache the latest camera transform so overlays sync even before the simulation emits.
    viewTransform: null,
    // Preserve serialized simulation payloads until the active basin is ready to restore them.
    loadedSimulationState: null,
  };

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

  let currentPowderBonuses = {
    sandBonus: 0,
    duneBonus: 0,
    crystalBonus: 0,
    totalMultiplier: 1,
  };

  const powderElements = {
    sandfallFormula: null,
    sandfallNote: null,
    sandfallButton: null,
    duneFormula: null,
    duneNote: null,
    duneButton: null,
    crystalFormula: null,
    crystalNote: null,
    crystalButton: null,
    totalMultiplier: null,
    sandBonusValue: null,
    duneBonusValue: null,
    crystalBonusValue: null,
    stockpile: null,
    idleMultiplier: null,
    moteBank: null,
    moteRate: null,
    gemInventoryList: null,
    gemInventoryEmpty: null,
    craftingButton: null,
    ledgerBaseScore: null,
    ledgerCurrentScore: null,
    ledgerFlux: null,
    ledgerEnergy: null,
    sigilEntries: [],
    logList: null,
    logEmpty: null,
    simulationCanvas: null,
    basin: null,
    viewport: null,
    wallMarker: null,
    crestMarker: null,
    wallGlyphColumns: [],
    leftWall: null,
    rightWall: null,
    leftHitbox: null,
    rightHitbox: null,
    modeToggle: null,
  };

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

  // Clamp arbitrary numeric input so persistence never records NaN or Infinity.
  function clampFiniteNumber(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
  }

  // Normalize integer values for storage while enforcing deterministic rounding.
  function clampFiniteInteger(value, fallback = 0) {
    return Number.isFinite(value) ? Math.round(value) : fallback;
  }

  // Copy a single mote drop payload into a storage-safe representation.
  function cloneStoredMoteDrop(drop) {
    if (!drop) {
      return null;
    }
    if (typeof drop === 'object') {
      const size = Math.max(1, clampFiniteInteger(drop.size, 1));
      if (!Number.isFinite(size) || size <= 0) {
        return null;
      }
      const payload = { size };
      if (drop.color && typeof drop.color === 'object') {
        const { r, g, b } = drop.color;
        if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
          payload.color = {
            r: Math.max(0, Math.min(255, Math.round(r))),
            g: Math.max(0, Math.min(255, Math.round(g))),
            b: Math.max(0, Math.min(255, Math.round(b))),
          };
        }
      }
      return payload;
    }
    if (Number.isFinite(drop)) {
      return { size: Math.max(1, Math.round(drop)) };
    }
    return null;
  }

  // Compose a basin snapshot so autosave can persist mote placement and climb progress.
  function getPowderBasinSnapshot() {
    const pendingDrops = Array.isArray(powderState.pendingMoteDrops)
      ? powderState.pendingMoteDrops.map(cloneStoredMoteDrop).filter(Boolean)
      : [];
    const palette = mergeMotePalette(powderState.motePalette);

    const liveTransform =
      (powderSimulation && typeof powderSimulation.getViewTransform === 'function'
        ? powderSimulation.getViewTransform()
        : null) || powderState.viewTransform;
    let viewTransform = null;
    if (liveTransform && typeof liveTransform === 'object') {
      const normalizedCenter = liveTransform.normalizedCenter || liveTransform.normalized || {};
      viewTransform = {
        scale: Math.max(0.1, clampFiniteNumber(liveTransform.scale, 1)),
        normalizedCenter: {
          x: clampFiniteNumber(normalizedCenter.x ?? 0.5, 0.5),
          y: clampFiniteNumber(normalizedCenter.y ?? 0.5, 0.5),
        },
      };
    }

    const liveStatus =
      powderSimulation && typeof powderSimulation.getStatus === 'function'
        ? powderSimulation.getStatus()
        : null;
    const fallbackStatus =
      powderState.loadedSimulationState && typeof powderState.loadedSimulationState === 'object'
        ? powderState.loadedSimulationState.heightInfo
        : null;
    const status = liveStatus || fallbackStatus || null;

    const simulationSnapshot =
      powderSimulation && typeof powderSimulation.exportState === 'function'
        ? powderSimulation.exportState()
        : powderState.loadedSimulationState && typeof powderState.loadedSimulationState === 'object'
          ? powderState.loadedSimulationState
          : null;

    // Calculate current aleph glyph number from height for accurate restoration
    const currentGlyphsLit = Number.isFinite(status?.highestNormalized) || Number.isFinite(status?.totalNormalized)
      ? (() => {
          const highestNormalized = Math.max(
            0,
            status.highestNormalized ?? status.totalNormalized ?? 0,
          );
          const GLYPH_SPACING_NORMALIZED = 0.5;
          const GLYPH_BASE_NORMALIZED = GLYPH_SPACING_NORMALIZED;
          return highestNormalized >= GLYPH_BASE_NORMALIZED
            ? Math.max(0, Math.floor((highestNormalized - GLYPH_BASE_NORMALIZED) / GLYPH_SPACING_NORMALIZED) + 1)
            : 0;
        })()
      : powderState.wallGlyphsLit;

    const powderSnapshot = {
      sandOffset: Math.max(0, clampFiniteNumber(powderState.sandOffset, powderConfig.sandOffsetActive)),
      duneHeight: Math.max(powderConfig.duneHeightBase, clampFiniteInteger(powderState.duneHeight, powderConfig.duneHeightBase)),
      charges: Math.max(0, clampFiniteInteger(powderState.charges, 0)),
      simulatedDuneGain: Math.max(0, clampFiniteNumber(powderState.simulatedDuneGain, 0)),
      wallGlyphsLit: Math.max(0, Math.max(clampFiniteInteger(powderState.wallGlyphsLit, 0), currentGlyphsLit)),
      glyphsAwarded: Math.max(0, clampFiniteInteger(powderState.glyphsAwarded, 0)),
      idleMoteBank: Math.max(0, clampFiniteNumber(powderState.idleMoteBank, 0)),
      idleDrainRate: Math.max(0, clampFiniteNumber(powderState.idleDrainRate, 0)),
      pendingMoteDrops: pendingDrops,
      motePalette: palette,
      simulationMode: powderState.simulationMode === 'fluid' ? 'fluid' : 'sand',
      wallGapTarget: Number.isFinite(powderState.wallGapTarget)
        ? Math.max(1, Math.round(powderState.wallGapTarget))
        : null,
      fluidUnlocked: !!powderState.fluidUnlocked,
      viewTransform,
      heightInfo: status
        ? {
            normalizedHeight: clampFiniteNumber(status.normalizedHeight, 0),
            duneGain: clampFiniteNumber(status.duneGain, 0),
            totalHeight: Math.max(0, clampFiniteInteger(status.totalHeight ?? 0, 0)),
            highestNormalized: clampFiniteNumber(status.highestNormalized ?? status.totalNormalized ?? 0, 0),
            scrollOffset: Math.max(0, clampFiniteInteger(status.scrollOffset ?? 0, 0)),
            highestTotalHeightCells: Math.max(0, clampFiniteInteger(status.highestTotalHeightCells ?? status.totalHeight ?? 0, 0)),
          }
        : null,
    };

    return {
      powder: powderSnapshot,
      simulation: simulationSnapshot,
    };
  }

  // Merge a stored basin snapshot back into runtime state during load or resume flows.
  function applyPowderBasinSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }
    const base = snapshot.powder || snapshot.state || null;
    if (base && typeof base === 'object') {
      if (Number.isFinite(base.sandOffset)) {
        powderState.sandOffset = Math.max(0, base.sandOffset);
      }
      if (Number.isFinite(base.duneHeight)) {
        powderState.duneHeight = Math.max(powderConfig.duneHeightBase, Math.round(base.duneHeight));
      }
      if (Number.isFinite(base.charges)) {
        powderState.charges = Math.max(0, Math.round(base.charges));
      }
      if (Number.isFinite(base.simulatedDuneGain)) {
        powderState.simulatedDuneGain = Math.max(0, base.simulatedDuneGain);
      }
      if (Number.isFinite(base.wallGlyphsLit)) {
        powderState.wallGlyphsLit = Math.max(0, Math.round(base.wallGlyphsLit));
      }
      if (Number.isFinite(base.glyphsAwarded)) {
        powderState.glyphsAwarded = Math.max(0, Math.round(base.glyphsAwarded));
      }
      if (Number.isFinite(base.idleMoteBank)) {
        powderState.idleMoteBank = Math.max(0, base.idleMoteBank);
        powderState.idleBankHydrated = false;
      }
      if (Number.isFinite(base.idleDrainRate)) {
        powderState.idleDrainRate = Math.max(0, base.idleDrainRate);
      }
      if (Array.isArray(base.pendingMoteDrops)) {
        powderState.pendingMoteDrops = base.pendingMoteDrops.map(cloneStoredMoteDrop).filter(Boolean);
      } else {
        powderState.pendingMoteDrops = [];
      }
      if (base.motePalette) {
        powderState.motePalette = mergeMotePalette(base.motePalette);
        // Refresh the Mind Gate accent so restored saves inherit the stored palette instantly.
        applyMindGatePaletteToDom(powderState.motePalette);
      }
      if (typeof base.simulationMode === 'string') {
        powderState.simulationMode = base.simulationMode === 'fluid' ? 'fluid' : 'sand';
      }
      if (Number.isFinite(base.wallGapTarget) && base.wallGapTarget > 0) {
        powderState.wallGapTarget = Math.max(1, Math.round(base.wallGapTarget));
      }
      powderState.fluidUnlocked = !!base.fluidUnlocked;
      if (base.viewTransform && typeof base.viewTransform === 'object') {
        const center = base.viewTransform.normalizedCenter || {};
        powderState.viewTransform = {
          scale: Math.max(0.1, clampFiniteNumber(base.viewTransform.scale, 1)),
          normalizedCenter: {
            x: clampFiniteNumber(center.x ?? 0.5, 0.5),
            y: clampFiniteNumber(center.y ?? 0.5, 0.5),
          },
        };
      }
      if (base.heightInfo && typeof base.heightInfo === 'object') {
        if (Number.isFinite(base.heightInfo.duneGain)) {
          powderState.simulatedDuneGain = Math.max(0, base.heightInfo.duneGain);
        }
        // Preserve height info so wall glyph calculations can resume correctly.
        if (!powderState.loadedSimulationState) {
          powderState.loadedSimulationState = {};
        }
        powderState.loadedSimulationState.heightInfo = {
          normalizedHeight: Number.isFinite(base.heightInfo.normalizedHeight) ? Math.max(0, base.heightInfo.normalizedHeight) : 0,
          duneGain: Number.isFinite(base.heightInfo.duneGain) ? Math.max(0, base.heightInfo.duneGain) : 0,
          totalHeight: Number.isFinite(base.heightInfo.totalHeight) ? Math.max(0, base.heightInfo.totalHeight) : 0,
          highestNormalized: Number.isFinite(base.heightInfo.highestNormalized) ? Math.max(0, base.heightInfo.highestNormalized) : 0,
        };
      }
    }
    const simulationState = snapshot.simulation || snapshot.loadedSimulationState || null;
    if (simulationState && typeof simulationState === 'object') {
      // Merge saved heightInfo into simulation state if present in powder snapshot but not in simulation state.
      if (powderState.loadedSimulationState?.heightInfo && (!simulationState.heightInfo || !Number.isFinite(simulationState.heightInfo.highestNormalized))) {
        simulationState.heightInfo = {
          ...simulationState.heightInfo,
          ...powderState.loadedSimulationState.heightInfo,
        };
      }
      powderState.loadedSimulationState = simulationState;
    }
    // After reconciling persisted data, schedule a save so the sanitized snapshot replaces stale copies.
    schedulePowderBasinSave();
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
  let powderWallMetrics = null;

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
    getCurrentPowderBonuses: () => currentPowderBonuses,
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

  // Apply the active camera transform to the overlay container so the decorative walls
  // match the powder simulation's zoom and pan state.
  function applyPowderViewportTransform(transform) {
    if (!powderElements.viewport) {
      return;
    }
    if (!transform) {
      powderElements.viewport.style.transform = '';
      return;
    }
    const width = Number.isFinite(transform.width) ? transform.width : 0;
    const height = Number.isFinite(transform.height) ? transform.height : 0;
    const scale = Number.isFinite(transform.scale) && transform.scale > 0 ? transform.scale : 1;
    if (!width || !height) {
      powderElements.viewport.style.transform = '';
      return;
    }
    const centerX = Number.isFinite(transform.center?.x) ? transform.center.x : width / 2;
    const centerY = Number.isFinite(transform.center?.y) ? transform.center.y : height / 2;
    const translateToCenter = `translate(${(width / 2).toFixed(3)}px, ${(height / 2).toFixed(3)}px)`;
    const scalePart = `scale(${scale.toFixed(5)})`;
    const translateToOrigin = `translate(${(-centerX).toFixed(3)}px, ${(-centerY).toFixed(3)}px)`;
    powderElements.viewport.style.transform = `${translateToCenter} ${scalePart} ${translateToOrigin}`;
  }

  // Store and broadcast camera transform updates emitted by the powder simulation.
  function handlePowderViewTransformChange(transform) {
    powderState.viewTransform = transform || null;
    applyPowderViewportTransform(transform || null);
    // Schedule a basin save so camera adjustments persist across reloads.
    schedulePowderBasinSave();
  }

  function syncPowderWallVisuals(metrics) {
    const activeMetrics =
      metrics || powderWallMetrics || (powderSimulation ? powderSimulation.getWallMetrics() : null);
    if (!activeMetrics) {
      return;
    }

    const { leftCells, rightCells, gapCells, cellSize } = activeMetrics;
    const leftWidth = Math.max(0, leftCells * cellSize);
    const rightWidth = Math.max(0, rightCells * cellSize);
    const gapWidth = Math.max(0, gapCells * cellSize);

    if (powderElements.leftWall) {
      powderElements.leftWall.style.width = `${leftWidth.toFixed(1)}px`;
    }
    if (powderElements.rightWall) {
      powderElements.rightWall.style.width = `${rightWidth.toFixed(1)}px`;
    }
    if (powderElements.leftHitbox) {
      powderElements.leftHitbox.style.width = `${leftWidth.toFixed(1)}px`;
    }
    if (powderElements.rightHitbox) {
      powderElements.rightHitbox.style.width = `${rightWidth.toFixed(1)}px`;
    }
    if (powderElements.basin) {
      powderElements.basin.style.setProperty('--powder-gap-width', `${gapWidth.toFixed(1)}px`);
    }
  }

  function updatePowderHitboxVisibility() {
    const metrics = powderWallMetrics || (powderSimulation ? powderSimulation.getWallMetrics() : null);
    const showHitboxes = developerModeActive && metrics;
    if (powderElements.leftHitbox) {
      powderElements.leftHitbox.classList.toggle(
        'powder-wall-hitbox--visible',
        Boolean(showHitboxes && metrics.leftCells > 0),
      );
    }
    if (powderElements.rightHitbox) {
      powderElements.rightHitbox.classList.toggle(
        'powder-wall-hitbox--visible',
        Boolean(showHitboxes && metrics.rightCells > 0),
      );
    }
  }

  function handlePowderWallMetricsChange(metrics) {
    powderWallMetrics = metrics || null;
    syncPowderWallVisuals(metrics || undefined);
    updatePowderHitboxVisibility();
    // Queue a basin snapshot so wall spacing changes survive future sessions.
    schedulePowderBasinSave();
  }

  function updatePowderWallGapFromGlyphs(glyphCount) {
    const normalized = Number.isFinite(glyphCount) ? Math.max(0, glyphCount) : 0;
    const target = powderConfig.wallBaseGapMotes + normalized * powderConfig.wallGapPerGlyph;
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

  function updatePowderModeButton() {
    if (!powderElements.modeToggle) {
      return;
    }
    const unlockSigils = powderConfig.fluidUnlockSigils || 0;
    if (!powderState.fluidUnlocked) {
      const requirementLabel = unlockSigils > 0 ? `${unlockSigils}` : '???';
      const unitLabel = unlockSigils === 1 ? 'Glyph' : 'Glyphs';
      powderElements.modeToggle.textContent = `Unlock Fluid Study (${unitLabel} ${requirementLabel})`;
      powderElements.modeToggle.setAttribute('aria-pressed', 'false');
      powderElements.modeToggle.setAttribute('aria-disabled', 'true');
      powderElements.modeToggle.disabled = true;
      return;
    }
    powderElements.modeToggle.removeAttribute('aria-disabled');
    powderElements.modeToggle.disabled = false;
    const mode = powderState.simulationMode;
    const fluidLabel = powderState.fluidProfileLabel || 'Fluid Study';
    powderElements.modeToggle.textContent =
      mode === 'fluid' ? 'Return to Powderfall' : `Switch to ${fluidLabel}`;
    powderElements.modeToggle.setAttribute('aria-pressed', mode === 'fluid' ? 'true' : 'false');
  }

  /**
   * Lazily binds pointer and wheel interactions that let players pan and zoom the powder viewport.
   * The handlers reuse the active powder simulation instance so mode switches keep gestures intact.
   */
  function initializePowderViewInteraction() {
    const viewport = powderElements.viewport;
    if (!viewport) {
      return;
    }

    if (powderState.viewInteraction?.initialized) {
      return;
    }

    const interaction = {
      initialized: true,
      pointerId: null,
      lastPoint: null,
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
      const simulation = getSimulation();
      if (!simulation) {
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
      const simulation = getSimulation();
      if (!simulation || !interaction.lastPoint) {
        return;
      }

      const dx = event.clientX - interaction.lastPoint.x;
      const dy = event.clientY - interaction.lastPoint.y;
      interaction.lastPoint = { x: event.clientX, y: event.clientY };

      const transform = simulation.getViewTransform();
      if (!transform || !transform.center) {
        return;
      }

      const scale = Number.isFinite(transform.scale) && transform.scale > 0 ? transform.scale : 1;
      const nextCenter = {
        x: transform.center.x - dx / scale,
        y: transform.center.y - dy / scale,
      };
      simulation.setViewCenterFromWorld(nextCenter);
    };

    const handlePointerUp = (event) => {
      if (event.pointerId !== interaction.pointerId) {
        return;
      }
      clearPointerState();
    };

    const handleWheel = (event) => {
      const simulation = getSimulation();
      if (!simulation) {
        return;
      }
      const delta = Number.isFinite(event.deltaY) ? event.deltaY : 0;
      if (!delta) {
        return;
      }
      const factor = delta > 0 ? 0.9 : 1.1;
      const anchorPoint = { clientX: event.clientX, clientY: event.clientY };
      const changed = simulation.applyZoomFactor(factor, anchorPoint);
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
    if (powderElements.modeToggle) {
      powderElements.modeToggle.disabled = true;
    }

    const previousMode = powderState.simulationMode;
    try {
      if (mode === 'fluid') {
        const profile = await loadFluidSimulationProfile();
        if (!profile) {
          throw new Error('Fluid simulation profile unavailable.');
        }
        powderState.fluidProfileLabel = profile.label || powderState.fluidProfileLabel;

        if (!fluidSimulationInstance && powderElements.simulationCanvas) {
          const { left: leftInset, right: rightInset } = getPowderWallInsets();
          fluidSimulationInstance = new FluidSimulation({
            canvas: powderElements.simulationCanvas,
            cellSize: POWDER_CELL_SIZE_PX,
            wallInsetLeft: leftInset,
            wallInsetRight: rightInset,
            wallGapCells: powderConfig.wallBaseGapMotes,
            gapWidthRatio: powderConfig.wallGapViewportRatio,
            idleDrainRate: powderState.idleDrainRate,
            motePalette: powderState.motePalette,
            dropSizes: profile.dropSizes,
            dropVolumeScale: profile.dropVolumeScale ?? undefined,
            waveStiffness: profile.waveStiffness ?? undefined,
            waveDamping: profile.waveDamping ?? undefined,
            sideFlowRate: profile.sideFlowRate ?? undefined,
            rippleFrequency: profile.rippleFrequency ?? undefined,
            rippleAmplitude: profile.rippleAmplitude ?? undefined,
            maxDuneGain: powderConfig.simulatedDuneGainMax,
            onIdleBankChange: handlePowderIdleBankChange,
            onHeightChange: handlePowderHeightChange,
            onWallMetricsChange: handlePowderWallMetricsChange,
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
        powderState.idleDrainRate = powderSimulation.idleDrainRate;
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
          recordPowderEvent('mode-switch', { mode: 'fluid', label: profile.label || 'Fluid Study' });
        }
      } else {
        if (!sandSimulation && powderSimulation instanceof PowderSimulation) {
          sandSimulation = powderSimulation;
        }
        if (!sandSimulation && powderElements.simulationCanvas) {
          const { left: leftInset, right: rightInset } = getPowderWallInsets();
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
            onIdleBankChange: handlePowderIdleBankChange,
            onHeightChange: handlePowderHeightChange,
            onWallMetricsChange: handlePowderWallMetricsChange,
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

      powderWallMetrics = powderSimulation ? powderSimulation.getWallMetrics() : null;
      syncPowderWallVisuals(powderWallMetrics || undefined);
      updatePowderHitboxVisibility();
      handlePowderHeightChange(powderSimulation ? powderSimulation.getStatus() : undefined);
      updatePowderWallGapFromGlyphs(powderState.wallGlyphsLit || 0);
      updateMoteStatsDisplays();
    } catch (error) {
      console.error('Unable to switch simulation mode.', error);
    } finally {
      powderState.modeSwitchPending = false;
      if (powderElements.modeToggle) {
        powderElements.modeToggle.disabled = false;
      }
      updatePowderModeButton();
      syncPowderWallVisuals();
      updatePowderHitboxVisibility();
    }
  }

  async function handlePowderModeToggle() {
    if (powderState.modeSwitchPending) {
      return;
    }
    const nextMode = powderState.simulationMode === 'fluid' ? 'sand' : 'fluid';
    await applyPowderSimulationMode(nextMode);
  }

  let resourceTicker = null;
  let lastResourceTick = 0;

  let powderCurrency = 0;

  let powderBasinPulseTimer = null;

  const POWDER_WALL_TEXTURE_REPEAT_PX = 192; // Mirror the tower wall sprite tile height so loops stay seamless.

  // Configure the autosave helpers so they can persist powder, stats, and preference state.
  configureAutoSave({
    audioStorageKey: AUDIO_SETTINGS_STORAGE_KEY,
    getPowderCurrency: () => powderCurrency,
    onPowderCurrencyLoaded: (value) => {
      powderCurrency = value;
      updatePowderStockpileDisplay();
    },
    getPowderBasinSnapshot,
    applyPowderBasinSnapshot,
    getTowerUpgradeStateSnapshot,
    applyTowerUpgradeStateSnapshot,
    applyStoredAudioSettings,
    syncAudioControlsFromManager,
    applyNotationPreference,
    handleNotationFallback: handleNotationChange,
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
      graphics: activeGraphicsMode,
      glyphEquations: glyphEquationsVisible ? '1' : '0',
    }),
  });

  const idleLevelRuns = new Map();
  // Track the animation frame id that advances idle simulations so we can pause the loop when idle.
  let idleRunAnimationHandle = null;

  let powderSimulation = null;
  let sandSimulation = null;
  let fluidSimulationInstance = null;
  let powderBasinObserver = null;

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
    getBaseStartThero: () => BASE_START_THERO,
    getBaseCoreIntegrity: () => BASE_CORE_INTEGRITY,
    // Provide the playfield with the active graphics mode to prune visual effects.
    isLowGraphicsMode: () => isLowGraphicsModeActive(),
  });

  function captureSimulationState(simulation) {
    if (!simulation) {
      return;
    }
    let snapshotCaptured = false;
    if (typeof simulation.exportState === 'function') {
      const snapshot = simulation.exportState();
      if (snapshot && typeof snapshot === 'object') {
        powderState.loadedSimulationState = snapshot;
        snapshotCaptured = true;
        if (Array.isArray(powderState.pendingMoteDrops)) {
          powderState.pendingMoteDrops.length = 0;
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
        powderState.pendingMoteDrops.push(pendingDrop);
      });
      simulation.pendingDrops.length = 0;
    }
    if (Number.isFinite(simulation.idleBank)) {
      powderState.idleMoteBank = Math.max(0, simulation.idleBank);
      powderState.idleBankHydrated = false;
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
    const snapshot = powderState.loadedSimulationState;
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }
    const applied = simulation.importState(snapshot);
    if (!applied) {
      return;
    }
    powderState.loadedSimulationState = null;
    powderState.idleMoteBank = Math.max(
      0,
      Number.isFinite(snapshot.idleBank) ? snapshot.idleBank : simulation.idleBank || 0,
    );
    powderState.idleBankHydrated = true;
    powderState.idleDrainRate = simulation.idleDrainRate;
    powderState.motePalette = simulation.getEffectiveMotePalette();
    // Apply the restored palette so the Towers tab matches the revived basin state.
    applyMindGatePaletteToDom(powderState.motePalette);
    if (Array.isArray(powderState.pendingMoteDrops)) {
      powderState.pendingMoteDrops.length = 0;
    }
    // Restore wall gap from saved glyph number to ensure wall width matches saved progress
    if (Number.isFinite(powderState.wallGlyphsLit)) {
      updatePowderWallGapFromGlyphs(powderState.wallGlyphsLit);
    }
    // Writing back the hydrated state keeps restored motes available for the next session.
    schedulePowderBasinSave();
  }

  function getPowderWallInsets() {
    const left = powderElements.leftWall ? Math.max(68, powderElements.leftWall.offsetWidth) : 68;
    const right = powderElements.rightWall ? Math.max(68, powderElements.rightWall.offsetWidth) : 68;
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
    powderState.pendingMoteDrops.push(payload);
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

      updateStatusDisplays();
    }, 1000 / 30);
  }

  // Surface the live idle mote bank so developer controls and HUD panels can sync immediately.
  function getCurrentIdleMoteBank() {
    if (powderSimulation && Number.isFinite(powderSimulation.idleBank)) {
      const bank = Math.max(0, powderSimulation.idleBank);
      powderState.idleMoteBank = bank;
      powderState.idleBankHydrated = true;
      return bank;
    }
    return Math.max(0, powderState.idleMoteBank || 0);
  }

  // Provide the active mote dispense rate exposed by the current simulation profile or powder state.
  function getCurrentMoteDispenseRate() {
    if (powderSimulation && Number.isFinite(powderSimulation.idleDrainRate)) {
      const rate = Math.max(0, powderSimulation.idleDrainRate);
      powderState.idleDrainRate = rate;
      return rate;
    }
    return Math.max(0, powderState.idleDrainRate || 0);
  }

  function addIdleMoteBank(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    if (powderSimulation) {
      powderSimulation.addIdleMotes(amount);
      powderState.idleMoteBank = Math.max(0, powderSimulation.idleBank);
      powderState.idleBankHydrated = true;
    } else {
      powderState.idleMoteBank = Math.max(0, powderState.idleMoteBank + amount);
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
    if (powderState.pendingMoteDrops.length) {
      powderState.pendingMoteDrops.forEach((drop) => {
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
      powderState.pendingMoteDrops.length = 0;
    }
    const pendingBank = Math.max(0, Number.isFinite(powderState.idleMoteBank) ? powderState.idleMoteBank : 0);
    if (pendingBank > 0) {
      const simulationBank = Number.isFinite(powderSimulation.idleBank)
        ? Math.max(0, powderSimulation.idleBank)
        : 0;
      const shouldInject = !powderState.idleBankHydrated || Math.abs(simulationBank - pendingBank) > 0.5;
      if (shouldInject) {
        powderSimulation.addIdleMotes(pendingBank);
        powderState.idleMoteBank = 0;
      } else {
        powderState.idleMoteBank = simulationBank;
      }
      powderState.idleBankHydrated = true;
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

  function triggerButtonRipple(button, event) {
    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'button-ripple';

    const maxDimension = Math.max(rect.width, rect.height);
    const size = maxDimension * 1.6;
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;

    let offsetX = rect.width / 2;
    let offsetY = rect.height / 2;
    if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
    }

    ripple.style.left = `${offsetX}px`;
    ripple.style.top = `${offsetY}px`;

    button.querySelectorAll('.button-ripple').forEach((existing) => existing.remove());
    button.append(ripple);

    ripple.addEventListener(
      'animationend',
      () => {
        ripple.remove();
      },
      { once: true },
    );
  }

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

  const PRESET_PREVIEW_PATHS = {
    lemniscate: [
      { x: 0.14, y: 0.52 },
      { x: 0.28, y: 0.28 },
      { x: 0.46, y: 0.2 },
      { x: 0.62, y: 0.3 },
      { x: 0.78, y: 0.5 },
      { x: 0.62, y: 0.7 },
      { x: 0.46, y: 0.8 },
      { x: 0.28, y: 0.72 },
      { x: 0.14, y: 0.48 },
    ],
    spiral: [
      { x: 0.12, y: 0.82 },
      { x: 0.28, y: 0.66 },
      { x: 0.46, y: 0.74 },
      { x: 0.66, y: 0.58 },
      { x: 0.54, y: 0.42 },
      { x: 0.6, y: 0.3 },
      { x: 0.76, y: 0.36 },
      { x: 0.88, y: 0.18 },
    ],
    cascade: [
      { x: 0.12, y: 0.8 },
      { x: 0.24, y: 0.68 },
      { x: 0.32, y: 0.5 },
      { x: 0.44, y: 0.6 },
      { x: 0.56, y: 0.44 },
      { x: 0.68, y: 0.54 },
      { x: 0.8, y: 0.36 },
      { x: 0.9, y: 0.22 },
    ],
    fork: [
      { x: 0.12, y: 0.82 },
      { x: 0.32, y: 0.58 },
      { x: 0.44, y: 0.38 },
      { x: 0.56, y: 0.52 },
      { x: 0.68, y: 0.32 },
      { x: 0.78, y: 0.46 },
      { x: 0.9, y: 0.26 },
    ],
    river: [
      { x: 0.08, y: 0.88 },
      { x: 0.22, y: 0.74 },
      { x: 0.38, y: 0.78 },
      { x: 0.54, y: 0.62 },
      { x: 0.68, y: 0.66 },
      { x: 0.82, y: 0.48 },
      { x: 0.92, y: 0.32 },
      { x: 0.96, y: 0.16 },
    ],
    petals: [
      { x: 0.14, y: 0.82 },
      { x: 0.32, y: 0.68 },
      { x: 0.42, y: 0.5 },
      { x: 0.36, y: 0.34 },
      { x: 0.5, y: 0.24 },
      { x: 0.64, y: 0.34 },
      { x: 0.6, y: 0.54 },
      { x: 0.74, y: 0.7 },
      { x: 0.88, y: 0.56 },
      { x: 0.92, y: 0.36 },
    ],
    lattice: [
      { x: 0.08, y: 0.84 },
      { x: 0.2, y: 0.66 },
      { x: 0.34, y: 0.7 },
      { x: 0.48, y: 0.5 },
      { x: 0.6, y: 0.58 },
      { x: 0.74, y: 0.38 },
      { x: 0.84, y: 0.46 },
      { x: 0.94, y: 0.22 },
    ],
    bridge: [
      { x: 0.08, y: 0.78 },
      { x: 0.26, y: 0.62 },
      { x: 0.4, y: 0.46 },
      { x: 0.54, y: 0.38 },
      { x: 0.7, y: 0.48 },
      { x: 0.82, y: 0.32 },
      { x: 0.94, y: 0.18 },
    ],
  };

  function clampNormalizedCoordinate(value) {
    if (!Number.isFinite(value)) {
      return 0.5;
    }
    return Math.min(0.98, Math.max(0.02, value));
  }

  function buildSeededPreviewPath(seedValue) {
    const seedString = String(seedValue || 'preview');
    let hash = 0;
    for (let index = 0; index < seedString.length; index += 1) {
      hash = (hash * 33 + seedString.charCodeAt(index)) >>> 0;
    }
    let state = hash || 1;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0xffffffff;
    };
    const points = [];
    const segments = 8;
    let x = 0.08 + random() * 0.1;
    let y = 0.2 + random() * 0.6;
    for (let step = 0; step < segments; step += 1) {
      points.push({ x: clampNormalizedCoordinate(x), y: clampNormalizedCoordinate(y) });
      x += 0.1 + random() * 0.12;
      y += (random() - 0.5) * 0.24;
      x = Math.min(0.92, Math.max(0.08, x));
      y = Math.min(0.88, Math.max(0.12, y));
    }
    return points;
  }

  function createProceduralPreviewPath(level) {
    if (!level) {
      return null;
    }
    const descriptor = `${level.path || ''} ${level.focus || ''}`.toLowerCase();
    const matches = [];
    const addMatch = (key) => {
      if (key && PRESET_PREVIEW_PATHS[key] && !matches.includes(key)) {
        matches.push(key);
      }
    };
    if (descriptor.includes('lemniscate') || descriptor.includes('∞') || descriptor.includes('loop')) {
      addMatch('lemniscate');
    }
    if (
      descriptor.includes('spiral') ||
      descriptor.includes('helix') ||
      descriptor.includes('fibonacci') ||
      descriptor.includes('logarithmic')
    ) {
      addMatch('spiral');
    }
    if (descriptor.includes('cascade') || descriptor.includes('step') || descriptor.includes('integral')) {
      addMatch('cascade');
    }
    if (descriptor.includes('fork') || descriptor.includes('dual') || descriptor.includes('twin')) {
      addMatch('fork');
    }
    if (descriptor.includes('river') || descriptor.includes('flow') || descriptor.includes('cardioid')) {
      addMatch('river');
    }
    if (descriptor.includes('petal') || descriptor.includes('modular') || descriptor.includes('bloom')) {
      addMatch('petals');
    }
    if (descriptor.includes('portal') || descriptor.includes('teleport') || descriptor.includes('hidden')) {
      addMatch('lattice');
    }
    if (descriptor.includes('bridge') || descriptor.includes('arch')) {
      addMatch('bridge');
    }
    if (matches.length) {
      const preset = PRESET_PREVIEW_PATHS[matches[0]];
      if (preset) {
        return preset.map((point) => ({ x: point.x, y: point.y }));
      }
    }
    return buildSeededPreviewPath(level.id);
  }

  function getPreviewPointsForLevel(level) {
    if (!level) {
      return null;
    }
    const config = levelConfigs.get(level.id);
    if (config && Array.isArray(config.path) && config.path.length >= 2) {
      return config.path.map((point) => ({ x: point.x, y: point.y }));
    }
    return createProceduralPreviewPath(level);
  }

  function clearOverlayPreview() {
    if (!overlayPreview) {
      return;
    }

    hideLevelEditorPanel();
    overlayPreviewLevel = null;

    if (previewPlayfield) {
      previewPlayfield.leaveLevel();
      previewPlayfield = null;
    }

    overlayPreview.innerHTML = '';
    overlayPreviewCanvas = null;
    overlayPreview.setAttribute('aria-hidden', 'true');
    overlayPreview.hidden = true;
    overlayPreview.classList.remove('overlay-preview--active');
  }

  function setLevelEditorStatus(message, options = {}) {
    if (!levelEditorElements.status) {
      return;
    }

    if (levelEditorState.statusTimeout) {
      clearTimeout(levelEditorState.statusTimeout);
      levelEditorState.statusTimeout = null;
    }

    if (!message) {
      levelEditorElements.status.textContent = '';
      levelEditorElements.status.hidden = true;
      delete levelEditorElements.status.dataset.tone;
      return;
    }

    const tone = options.tone || 'info';
    const duration = Number.isFinite(options.duration) ? options.duration : 2400;
    levelEditorElements.status.dataset.tone = tone;
    levelEditorElements.status.textContent = message;
    levelEditorElements.status.hidden = false;

    if (duration > 0 && typeof window !== 'undefined') {
      levelEditorState.statusTimeout = window.setTimeout(() => {
        levelEditorState.statusTimeout = null;
        if (levelEditorElements.status) {
          levelEditorElements.status.hidden = true;
        }
      }, duration);
    }
  }

  function endLevelEditorDrag() {
    if (overlayPreviewCanvas && levelEditorState.pointerId !== null) {
      try {
        overlayPreviewCanvas.releasePointerCapture(levelEditorState.pointerId);
      } catch (error) {
        // ignore pointer capture release errors
      }
    }
    levelEditorState.pointerId = null;
    levelEditorState.draggingIndex = -1;
    if (overlayPreviewCanvas) {
      overlayPreviewCanvas.classList.remove('overlay-preview__canvas--dragging');
    }
  }

  function detachLevelEditorCanvasListeners() {
    if (!levelEditorState.canvasListenersAttached || !overlayPreviewCanvas) {
      levelEditorState.canvasListenersAttached = false;
      return;
    }

    overlayPreviewCanvas.removeEventListener('pointerdown', handleLevelEditorPointerDown);
    overlayPreviewCanvas.removeEventListener('pointermove', handleLevelEditorPointerMove);
    overlayPreviewCanvas.removeEventListener('pointerup', handleLevelEditorPointerUp);
    overlayPreviewCanvas.removeEventListener('pointercancel', handleLevelEditorPointerUp);
    overlayPreviewCanvas.removeEventListener('lostpointercapture', handleLevelEditorPointerUp);
    overlayPreviewCanvas.removeEventListener('click', handleLevelEditorCanvasClick);
    levelEditorState.canvasListenersAttached = false;
  }

  function hideLevelEditorPanel() {
    endLevelEditorDrag();
    detachLevelEditorCanvasListeners();
    levelEditorState.levelId = null;
    levelEditorState.points = [];
    levelEditorState.originalPoints = [];
    levelEditorState.editing = false;

    if (previewPlayfield) {
      previewPlayfield.setDeveloperPathMarkers([]);
      previewPlayfield.draw();
    }

    if (overlayPreviewCanvas) {
      overlayPreviewCanvas.classList.remove('overlay-preview__canvas--editing');
      overlayPreviewCanvas.classList.remove('overlay-preview__canvas--dragging');
    }

    if (levelEditorElements.container) {
      levelEditorElements.container.hidden = true;
      levelEditorElements.container.setAttribute('aria-hidden', 'true');
    }

    if (levelEditorElements.toggle) {
      levelEditorElements.toggle.disabled = true;
      levelEditorElements.toggle.setAttribute('aria-pressed', 'false');
      levelEditorElements.toggle.textContent = 'Enable Editing';
    }

    updateLevelEditorOutput();
    updateLevelEditorUI();
    setLevelEditorStatus('');
  }

  function attachLevelEditorCanvasListeners() {
    if (!overlayPreviewCanvas || levelEditorState.canvasListenersAttached) {
      return;
    }

    overlayPreviewCanvas.addEventListener('pointerdown', handleLevelEditorPointerDown);
    overlayPreviewCanvas.addEventListener('pointermove', handleLevelEditorPointerMove);
    overlayPreviewCanvas.addEventListener('pointerup', handleLevelEditorPointerUp);
    overlayPreviewCanvas.addEventListener('pointercancel', handleLevelEditorPointerUp);
    overlayPreviewCanvas.addEventListener('lostpointercapture', handleLevelEditorPointerUp);
    overlayPreviewCanvas.addEventListener('click', handleLevelEditorCanvasClick);
    levelEditorState.canvasListenersAttached = true;
  }

  function handleLevelEditorCanvasClick(event) {
    if (!levelEditorState.editing) {
      return;
    }
    event.stopPropagation();
  }

  function updateLevelEditorOutput() {
    if (!levelEditorElements.output) {
      return;
    }

    if (!levelEditorState.points.length) {
      levelEditorElements.output.value = '';
      return;
    }

    const formattedPoints = levelEditorState.points.map((point) => ({
      x: Number(clampNormalizedCoordinate(point.x).toFixed(4)),
      y: Number(clampNormalizedCoordinate(point.y).toFixed(4)),
    }));
    levelEditorElements.output.value = JSON.stringify(formattedPoints, null, 2);
  }

  function updateLevelEditorUI() {
    const points = levelEditorState.points;
    if (levelEditorElements.count) {
      const label = points.length === 1 ? 'point' : 'points';
      levelEditorElements.count.textContent = `${points.length} ${label}`;
    }
    if (levelEditorElements.clear) {
      levelEditorElements.clear.disabled = points.length === 0;
    }
    if (levelEditorElements.reset) {
      levelEditorElements.reset.disabled = levelEditorState.originalPoints.length === 0;
    }
    if (levelEditorElements.exportButton) {
      levelEditorElements.exportButton.disabled = points.length < 2;
    }
    if (levelEditorElements.toggle) {
      levelEditorElements.toggle.disabled = !developerModeActive || !overlayPreviewCanvas;
      levelEditorElements.toggle.textContent = levelEditorState.editing ? 'Disable Editing' : 'Enable Editing';
      levelEditorElements.toggle.setAttribute('aria-pressed', levelEditorState.editing ? 'true' : 'false');
    }
  }

  function refreshLevelEditorMarkers(options = {}) {
    if (!previewPlayfield) {
      return;
    }

    const { redraw = true } = options;

    if (!overlayPreviewCanvas || !levelEditorState.points.length) {
      previewPlayfield.setDeveloperPathMarkers([]);
      if (redraw) {
        previewPlayfield.draw();
      }
      return;
    }

    let width = previewPlayfield.renderWidth || 0;
    let height = previewPlayfield.renderHeight || 0;
    if ((!width || !height) && overlayPreviewCanvas) {
      const rect = overlayPreviewCanvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
    }

    if (!width || !height) {
      previewPlayfield.setDeveloperPathMarkers([]);
      if (redraw) {
        previewPlayfield.draw();
      }
      return;
    }

    const markers = levelEditorState.points.map((point, index) => ({
      x: clampNormalizedCoordinate(point.x) * width,
      y: clampNormalizedCoordinate(point.y) * height,
      label: index + 1,
      active: levelEditorState.draggingIndex === index,
    }));
    previewPlayfield.setDeveloperPathMarkers(markers);
    if (redraw) {
      previewPlayfield.draw();
    }
  }

  function applyLevelEditorPoints() {
    if (!previewPlayfield || !previewPlayfield.levelConfig) {
      updateLevelEditorOutput();
      updateLevelEditorUI();
      return;
    }

    const sanitized = levelEditorState.points.map((point) => ({
      x: clampNormalizedCoordinate(point.x),
      y: clampNormalizedCoordinate(point.y),
    }));
    levelEditorState.points = sanitized;
    previewPlayfield.levelConfig.path = sanitized.map((point) => ({ ...point }));
    previewPlayfield.buildPathGeometry();
    refreshLevelEditorMarkers({ redraw: false });
    previewPlayfield.draw();
    updateLevelEditorOutput();
    updateLevelEditorUI();
  }

  function setLevelEditorEditing(active) {
    const enable = Boolean(active && developerModeActive && overlayPreviewCanvas);
    if (!enable) {
      endLevelEditorDrag();
    }
    levelEditorState.editing = enable;
    if (levelEditorElements.container) {
      levelEditorElements.container.classList.toggle('overlay-editor--active', enable);
    }
    if (overlayPreviewCanvas) {
      overlayPreviewCanvas.classList.toggle('overlay-preview__canvas--editing', enable);
      if (!enable) {
        overlayPreviewCanvas.classList.remove('overlay-preview__canvas--dragging');
      }
    }
    updateLevelEditorUI();
    refreshLevelEditorMarkers();
  }

  function clearLevelEditorPoints() {
    levelEditorState.points = [];
    levelEditorState.draggingIndex = -1;
    applyLevelEditorPoints();
    setLevelEditorStatus('Cleared all anchors. Click to plot a new path.', { tone: 'warning' });
  }

  function resetLevelEditorPoints() {
    if (!levelEditorState.originalPoints.length) {
      return;
    }
    levelEditorState.points = levelEditorState.originalPoints.map((point) => ({ ...point }));
    levelEditorState.draggingIndex = -1;
    applyLevelEditorPoints();
    setLevelEditorStatus('Restored path from level configuration.');
  }

  function configureLevelEditorForLevel(level, config) {
    if (!levelEditorElements.container) {
      return;
    }

    if (!developerModeActive || !level || !config || !Array.isArray(config.path) || config.path.length < 2) {
      hideLevelEditorPanel();
      return;
    }

    levelEditorState.levelId = level.id || null;
    levelEditorState.originalPoints = cloneVectorArray(config.path).map((point) => ({
      x: clampNormalizedCoordinate(point.x),
      y: clampNormalizedCoordinate(point.y),
    }));
    levelEditorState.points = levelEditorState.originalPoints.map((point) => ({ ...point }));
    levelEditorState.editing = false;
    levelEditorState.draggingIndex = -1;
    levelEditorState.pointerId = null;

    if (overlayPreviewCanvas) {
      overlayPreviewCanvas.classList.remove('overlay-preview__canvas--dragging');
      overlayPreviewCanvas.classList.remove('overlay-preview__canvas--editing');
    }

    attachLevelEditorCanvasListeners();
    applyLevelEditorPoints();

    levelEditorElements.container.hidden = false;
    levelEditorElements.container.setAttribute('aria-hidden', 'false');
    setLevelEditorStatus('Developer editor ready—toggle editing to adjust anchors.', { duration: 2000 });
  }

  function syncLevelEditorVisibility() {
    if (!developerModeActive) {
      hideLevelEditorPanel();
      return;
    }

    if (!levelEditorElements.container) {
      return;
    }

    if (!overlayPreviewLevel || !previewPlayfield) {
      return;
    }

    const config = levelConfigs.get(overlayPreviewLevel.id);
    if (!config || !Array.isArray(config.path) || config.path.length < 2) {
      hideLevelEditorPanel();
      return;
    }

    if (levelEditorState.levelId !== overlayPreviewLevel.id) {
      configureLevelEditorForLevel(overlayPreviewLevel, config);
      return;
    }

    levelEditorElements.container.hidden = false;
    levelEditorElements.container.setAttribute('aria-hidden', 'false');
    updateLevelEditorUI();
    refreshLevelEditorMarkers();
  }

  function handleLevelEditorToggle() {
    if (!developerModeActive) {
      setLevelEditorStatus('Enable developer mode to use the level editor.', { tone: 'warning' });
      return;
    }
    const nextState = !levelEditorState.editing;
    setLevelEditorEditing(nextState);
    if (nextState && !levelEditorState.points.length) {
      setLevelEditorStatus('Click the preview to place your first anchor.');
    } else if (!nextState) {
      setLevelEditorStatus('Editing disabled. Copy the JSON below when ready.');
    }
  }

  function handleLevelEditorClear() {
    clearLevelEditorPoints();
  }

  function handleLevelEditorReset() {
    resetLevelEditorPoints();
  }

  async function handleLevelEditorExport() {
    if (!levelEditorElements.output) {
      return;
    }
    const text = levelEditorElements.output.value.trim();
    if (!text) {
      setLevelEditorStatus('Add at least two anchors before exporting.', { tone: 'warning' });
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setLevelEditorStatus('Copied path JSON to clipboard.');
      } else {
        levelEditorElements.output.focus();
        levelEditorElements.output.select();
        setLevelEditorStatus('Clipboard unavailable—select and copy manually.', { tone: 'warning' });
      }
    } catch (error) {
      console.warn('Level editor failed to copy path', error);
      levelEditorElements.output.focus();
      levelEditorElements.output.select();
      setLevelEditorStatus('Copy failed—select the JSON manually.', { tone: 'error' });
    }
  }

  function getNormalizedPointerPosition(event) {
    if (!overlayPreviewCanvas) {
      return null;
    }
    const rect = overlayPreviewCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }
    const x = clampNormalizedCoordinate((event.clientX - rect.left) / rect.width);
    const y = clampNormalizedCoordinate((event.clientY - rect.top) / rect.height);
    return { x, y };
  }

  function findNearestEditorPoint(point) {
    const points = levelEditorState.points;
    if (!points.length) {
      return { index: -1, distance: Infinity };
    }
    let bestIndex = -1;
    let bestDistance = Infinity;
    points.forEach((candidate, index) => {
      const dx = candidate.x - point.x;
      const dy = candidate.y - point.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return { index: bestIndex, distance: bestDistance };
  }

  function distanceSquaredToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) {
      const diffX = point.x - start.x;
      const diffY = point.y - start.y;
      return diffX * diffX + diffY * diffY;
    }
    let t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    const diffX = point.x - projX;
    const diffY = point.y - projY;
    return diffX * diffX + diffY * diffY;
  }

  function findInsertionIndex(point) {
    const points = levelEditorState.points;
    if (!points.length) {
      return 0;
    }
    if (points.length === 1) {
      return 1;
    }
    let bestIndex = points.length;
    let bestDistance = Infinity;
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const distance = distanceSquaredToSegment(point, start, end);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index + 1;
      }
    }
    return bestIndex;
  }

  function handleLevelEditorPointerDown(event) {
    if (!levelEditorState.editing || !overlayPreviewCanvas || event.button !== 0) {
      return;
    }

    if (event) {
      event.stopPropagation();
    }
    const point = getNormalizedPointerPosition(event);
    if (!point) {
      return;
    }

    const nearest = findNearestEditorPoint(point);
    const removalThreshold = 0.045;
    if (event.shiftKey && nearest.index >= 0 && nearest.distance <= removalThreshold) {
      event.preventDefault();
      event.stopPropagation();
      levelEditorState.points.splice(nearest.index, 1);
      levelEditorState.draggingIndex = -1;
      applyLevelEditorPoints();
      setLevelEditorStatus(`Removed anchor ${nearest.index + 1}.`, { tone: 'warning' });
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const selectionThreshold = 0.04;
    if (nearest.index >= 0 && nearest.distance <= selectionThreshold) {
      levelEditorState.draggingIndex = nearest.index;
      levelEditorState.pointerId = event.pointerId;
      try {
        overlayPreviewCanvas.setPointerCapture(event.pointerId);
      } catch (error) {
        // ignore pointer capture errors
      }
      overlayPreviewCanvas.classList.add('overlay-preview__canvas--dragging');
      levelEditorState.points[nearest.index] = point;
      applyLevelEditorPoints();
      return;
    }

    const insertionIndex = findInsertionIndex(point);
    levelEditorState.points.splice(insertionIndex, 0, point);
    levelEditorState.draggingIndex = insertionIndex;
    levelEditorState.pointerId = event.pointerId;
    try {
      overlayPreviewCanvas.setPointerCapture(event.pointerId);
    } catch (error) {
      // ignore pointer capture errors
    }
    overlayPreviewCanvas.classList.add('overlay-preview__canvas--dragging');
    applyLevelEditorPoints();
    if (levelEditorState.points.length === 1) {
      setLevelEditorStatus('Anchor placed. Add another anchor to draw the path.');
    }
  }

  function handleLevelEditorPointerMove(event) {
    if (!levelEditorState.editing || levelEditorState.draggingIndex < 0) {
      return;
    }
    if (levelEditorState.pointerId !== null && event.pointerId !== levelEditorState.pointerId) {
      return;
    }

    if (event) {
      event.stopPropagation();
    }
    const point = getNormalizedPointerPosition(event);
    if (!point) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    levelEditorState.points[levelEditorState.draggingIndex] = point;
    applyLevelEditorPoints();
  }

  function handleLevelEditorPointerUp(event) {
    if (event && levelEditorState.pointerId !== null && event.pointerId !== levelEditorState.pointerId) {
      return;
    }

    if (event) {
      event.stopPropagation();
    }
    endLevelEditorDrag();
    refreshLevelEditorMarkers();
    updateLevelEditorUI();
  }

  function initializeLevelEditorElements() {
    levelEditorElements.container = document.getElementById('overlay-level-editor');
    levelEditorElements.toggle = document.getElementById('level-editor-toggle');
    levelEditorElements.note = document.getElementById('level-editor-note');
    levelEditorElements.count = document.getElementById('level-editor-count');
    levelEditorElements.clear = document.getElementById('level-editor-clear');
    levelEditorElements.reset = document.getElementById('level-editor-reset');
    levelEditorElements.exportButton = document.getElementById('level-editor-export');
    levelEditorElements.output = document.getElementById('level-editor-output');
    levelEditorElements.status = document.getElementById('level-editor-status');

    if (levelEditorElements.toggle) {
      levelEditorElements.toggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleLevelEditorToggle();
      });
    }
    if (levelEditorElements.clear) {
      levelEditorElements.clear.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleLevelEditorClear();
      });
    }
    if (levelEditorElements.reset) {
      levelEditorElements.reset.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleLevelEditorReset();
      });
    }
    if (levelEditorElements.exportButton) {
      levelEditorElements.exportButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleLevelEditorExport();
      });
    }

    hideLevelEditorPanel();
  }

  function renderLevelPreview(level) {
    if (!overlayPreview) {
      return;
    }
    clearOverlayPreview();

    overlayPreviewLevel = level || null;

    const config = level ? levelConfigs.get(level.id) : null;
    const hasInteractivePath = Boolean(
      config && Array.isArray(config.path) && config.path.length >= 2,
    );

    if (hasInteractivePath) {
      overlayPreviewCanvas = document.createElement('canvas');
      overlayPreviewCanvas.className = 'overlay-preview__canvas';
      overlayPreviewCanvas.setAttribute(
        'aria-label',
        `${level?.title || 'Defense'} path preview`,
      );
      overlayPreviewCanvas.setAttribute('role', 'img');
      overlayPreview.append(overlayPreviewCanvas);

      overlayPreview.hidden = false;
      overlayPreview.setAttribute('aria-hidden', 'false');
      overlayPreview.classList.add('overlay-preview--active');

      let preferredOrientation = null;
      if (playfield && typeof playfield.layoutOrientation === 'string') {
        preferredOrientation = playfield.layoutOrientation;
      } else if (typeof window !== 'undefined') {
        // Fall back to the viewport aspect ratio so desktop previews rotate alongside the battlefield layout.
        const width = Number.isFinite(window.innerWidth) ? window.innerWidth : 0;
        const height = Number.isFinite(window.innerHeight) ? window.innerHeight : 0;
        if (width > 0 && height > 0) {
          preferredOrientation = width > height ? 'landscape' : 'portrait';
        }
      }
      previewPlayfield = new SimplePlayfield({
        canvas: overlayPreviewCanvas,
        container: overlayPreview,
        previewOnly: true,
        // Align the preview orientation with the active battlefield when available.
        preferredOrientation,
      });
      previewPlayfield.enterLevel(level, { endlessMode: false });
      previewPlayfield.draw();
      configureLevelEditorForLevel(level, config);
      return;
    }

    const points = getPreviewPointsForLevel(level);
    if (!Array.isArray(points) || points.length < 2) {
      const placeholder = document.createElement('p');
      placeholder.className = 'overlay-preview__empty';
      placeholder.textContent = 'Map preview will unlock once the defense is charted.';
      overlayPreview.append(placeholder);
      overlayPreview.hidden = false;
      overlayPreview.setAttribute('aria-hidden', 'false');
      overlayPreview.classList.add('overlay-preview--active');
      return;
    }

    const viewBoxWidth = 1200;
    const viewBoxHeight = 720;
    const margin = 90;
    const scalePoint = (point) => ({
      x: margin + clampNormalizedCoordinate(point.x) * (viewBoxWidth - margin * 2),
      y: margin + clampNormalizedCoordinate(point.y) * (viewBoxHeight - margin * 2),
    });

    const scaledPoints = points.map((point) =>
      scalePoint({ x: point?.x ?? 0.5, y: point?.y ?? 0.5 }),
    );
    const pathData = scaledPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');

    const gradientId = createPreviewId('preview-gradient', level?.id || 'level');
    const haloId = createPreviewId('preview-halo', level?.id || 'level');

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
    svg.setAttribute('class', 'overlay-preview__svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${level?.title || 'Defense'} path preview`);

    const defs = document.createElementNS(SVG_NS, 'defs');
    const gradient = document.createElementNS(SVG_NS, 'linearGradient');
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '100%');
    const stopStart = document.createElementNS(SVG_NS, 'stop');
    stopStart.setAttribute('offset', '0%');
    stopStart.setAttribute('stop-color', '#76bfff');
    stopStart.setAttribute('stop-opacity', '0.85');
    const stopMid = document.createElementNS(SVG_NS, 'stop');
    stopMid.setAttribute('offset', '52%');
    stopMid.setAttribute('stop-color', '#ffe4a0');
    stopMid.setAttribute('stop-opacity', '0.92');
    const stopEnd = document.createElementNS(SVG_NS, 'stop');
    stopEnd.setAttribute('offset', '100%');
    stopEnd.setAttribute('stop-color', '#ffb088');
    stopEnd.setAttribute('stop-opacity', '0.88');
    gradient.append(stopStart, stopMid, stopEnd);

    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', haloId);
    filter.setAttribute('x', '-25%');
    filter.setAttribute('y', '-25%');
    filter.setAttribute('width', '150%');
    filter.setAttribute('height', '150%');
    const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
    blur.setAttribute('stdDeviation', '24');
    blur.setAttribute('in', 'SourceGraphic');
    blur.setAttribute('result', 'blurred');
    const merge = document.createElementNS(SVG_NS, 'feMerge');
    const mergeBlur = document.createElementNS(SVG_NS, 'feMergeNode');
    mergeBlur.setAttribute('in', 'blurred');
    const mergeSource = document.createElementNS(SVG_NS, 'feMergeNode');
    mergeSource.setAttribute('in', 'SourceGraphic');
    merge.append(mergeBlur, mergeSource);
    filter.append(blur, merge);

    defs.append(gradient, filter);
    svg.append(defs);

    const backdrop = document.createElementNS(SVG_NS, 'rect');
    backdrop.setAttribute('x', '0');
    backdrop.setAttribute('y', '0');
    backdrop.setAttribute('width', viewBoxWidth);
    backdrop.setAttribute('height', viewBoxHeight);
    backdrop.setAttribute('fill', 'rgba(6, 10, 18, 0.96)');
    svg.append(backdrop);

    const frame = document.createElementNS(SVG_NS, 'rect');
    frame.setAttribute('x', (margin * 2) / 5);
    frame.setAttribute('y', (margin * 2) / 5);
    frame.setAttribute('width', viewBoxWidth - (margin * 4) / 5);
    frame.setAttribute('height', viewBoxHeight - (margin * 4) / 5);
    frame.setAttribute('rx', '60');
    frame.setAttribute('fill', 'rgba(12, 16, 30, 0.92)');
    frame.setAttribute('stroke', 'rgba(255, 255, 255, 0.06)');
    frame.setAttribute('stroke-width', '8');
    svg.append(frame);

    const field = document.createElementNS(SVG_NS, 'rect');
    field.setAttribute('x', margin);
    field.setAttribute('y', margin);
    field.setAttribute('width', viewBoxWidth - margin * 2);
    field.setAttribute('height', viewBoxHeight - margin * 2);
    field.setAttribute('rx', '48');
    field.setAttribute('fill', 'rgba(18, 24, 42, 0.92)');
    field.setAttribute('stroke', 'rgba(255, 255, 255, 0.08)');
    field.setAttribute('stroke-width', '6');
    svg.append(field);

    const gridGroup = document.createElementNS(SVG_NS, 'g');
    gridGroup.setAttribute('stroke', 'rgba(255, 255, 255, 0.04)');
    gridGroup.setAttribute('stroke-width', '2');
    const gridSpacing = 140;
    for (let x = Math.round(margin); x <= viewBoxWidth - margin; x += gridSpacing) {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', margin);
      line.setAttribute('x2', x);
      line.setAttribute('y2', viewBoxHeight - margin);
      gridGroup.append(line);
    }
    for (let y = Math.round(margin); y <= viewBoxHeight - margin; y += gridSpacing) {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', margin);
      line.setAttribute('y1', y);
      line.setAttribute('x2', viewBoxWidth - margin);
      line.setAttribute('y2', y);
      gridGroup.append(line);
    }
    svg.append(gridGroup);

    const basePath = document.createElementNS(SVG_NS, 'path');
    basePath.setAttribute('d', pathData);
    basePath.setAttribute('fill', 'none');
    basePath.setAttribute('stroke', 'rgba(94, 134, 220, 0.28)');
    basePath.setAttribute('stroke-width', '70');
    basePath.setAttribute('stroke-linecap', 'round');
    basePath.setAttribute('stroke-linejoin', 'round');
    svg.append(basePath);

    const lanePath = document.createElementNS(SVG_NS, 'path');
    lanePath.setAttribute('d', pathData);
    lanePath.setAttribute('fill', 'none');
    lanePath.setAttribute('stroke', `url(#${gradientId})`);
    lanePath.setAttribute('stroke-width', '44');
    lanePath.setAttribute('stroke-linecap', 'round');
    lanePath.setAttribute('stroke-linejoin', 'round');
    lanePath.setAttribute('filter', `url(#${haloId})`);
    svg.append(lanePath);

    const anchorsList = Array.isArray(config?.autoAnchors) ? config.autoAnchors : [];
    if (anchorsList.length) {
      const anchorGroup = document.createElementNS(SVG_NS, 'g');
      anchorsList.forEach((anchor) => {
        const scaled = scalePoint({ x: anchor?.x ?? 0.5, y: anchor?.y ?? 0.5 });
        const outer = document.createElementNS(SVG_NS, 'circle');
        outer.setAttribute('cx', scaled.x);
        outer.setAttribute('cy', scaled.y);
        outer.setAttribute('r', '28');
        outer.setAttribute('fill', 'rgba(255, 204, 150, 0.92)');
        outer.setAttribute('stroke', 'rgba(255, 255, 255, 0.9)');
        outer.setAttribute('stroke-width', '6');
        anchorGroup.append(outer);
        const inner = document.createElementNS(SVG_NS, 'circle');
        inner.setAttribute('cx', scaled.x);
        inner.setAttribute('cy', scaled.y);
        inner.setAttribute('r', '12');
        inner.setAttribute('fill', 'rgba(255, 255, 255, 0.92)');
        anchorGroup.append(inner);
      });
      svg.append(anchorGroup);
    }

    const startPoint = scaledPoints[0];
    const endPoint = scaledPoints[scaledPoints.length - 1];
    const startMarker = document.createElementNS(SVG_NS, 'circle');
    startMarker.setAttribute('cx', startPoint.x);
    startMarker.setAttribute('cy', startPoint.y);
    startMarker.setAttribute('r', '20');
    startMarker.setAttribute('fill', 'rgba(120, 210, 255, 0.95)');
    startMarker.setAttribute('stroke', 'rgba(255, 255, 255, 0.9)');
    startMarker.setAttribute('stroke-width', '5');
    svg.append(startMarker);

    const endMarker = document.createElementNS(SVG_NS, 'circle');
    endMarker.setAttribute('cx', endPoint.x);
    endMarker.setAttribute('cy', endPoint.y);
    endMarker.setAttribute('r', '24');
    endMarker.setAttribute('fill', 'rgba(255, 170, 130, 0.95)');
    endMarker.setAttribute('stroke', 'rgba(255, 255, 255, 0.9)');
    endMarker.setAttribute('stroke-width', '6');
    svg.append(endMarker);

    overlayPreview.append(svg);
    overlayPreview.hidden = false;
    overlayPreview.setAttribute('aria-hidden', 'false');
    overlayPreview.classList.add('overlay-preview--active');
  }

  function showLevelOverlay(level, options = {}) {
    if (!overlay || !overlayLabel || !overlayTitle || !overlayExample) return;
    const { requireExitConfirm = false, exitLevelId = null } = options;
    overlayRequiresLevelExit = Boolean(requireExitConfirm);
    overlayLabel.textContent = level.id;
    overlayTitle.textContent = level.title;
    overlayExample.textContent = level.example;
    renderLevelPreview(level);
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
    clearOverlayPreview();
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
  }

  function enablePanelWheelScroll(panel) {
    if (!panel || panel.dataset.scrollAssist === 'true') {
      return;
    }

    panel.dataset.scrollAssist = 'true';
    panel.addEventListener(
      'wheel',
      (event) => {
        if (!event || typeof event.deltaY !== 'number') {
          return;
        }

        if (isFieldNotesOverlayVisible()) {
          if (typeof event.preventDefault === 'function') {
            event.preventDefault();
          }
          return;
        }

        const deltaMode = typeof event.deltaMode === 'number' ? event.deltaMode : 0;
        let deltaY = event.deltaY;

        if (deltaMode === 1) {
          const computed = window.getComputedStyle(panel);
          const lineHeight = parseFloat(computed.lineHeight) || 16;
          deltaY *= lineHeight;
        } else if (deltaMode === 2) {
          deltaY *= panel.clientHeight || window.innerHeight || 600;
        }

        if (!deltaY) {
          return;
        }

        const previous = panel.scrollTop;
        panel.scrollTop += deltaY;
        if (panel.scrollTop !== previous) {
          event.preventDefault();
        }
      },
      { passive: false },
    );
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

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '—';
    }
    const totalSeconds = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (minutes && secs) {
      return `${minutes}m ${secs}s`;
    }
    if (minutes) {
      return `${minutes}m`;
    }
    return `${secs}s`;
  }

  function formatRewards(rewardScore, rewardFlux, rewardEnergy) {
    const parts = [];
    if (Number.isFinite(rewardScore)) {
      parts.push(`${formatGameNumber(rewardScore)} Σ`);
    }
    if (Number.isFinite(rewardFlux)) {
      parts.push(`+${Math.round(rewardFlux)} Mote Gems/min`);
    }
    if (Number.isFinite(rewardEnergy)) {
      parts.push(`+${Math.round(rewardEnergy)} TD/s`);
    }
    return parts.length ? parts.join(' · ') : '—';
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

  function formatRelativeTime(timestamp) {
    if (!Number.isFinite(timestamp)) {
      return null;
    }
    const diff = Date.now() - timestamp;
    if (!Number.isFinite(diff)) {
      return null;
    }
    if (diff < 0) {
      return 'soon';
    }
    const seconds = Math.round(diff / 1000);
    if (seconds < 5) {
      return 'just now';
    }
    if (seconds < 60) {
      return `${seconds}s ago`;
    }
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    const hours = Math.round(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }
    const days = Math.round(hours / 24);
    return `${days}d ago`;
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
        ? formatRewards(config.rewardScore, config.rewardFlux, config.rewardEnergy)
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
      const rewardText = formatRewards(stats.rewardScore, stats.rewardFlux, stats.rewardEnergy);
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
      .slice(0, TOWER_LOADOUT_LIMIT)
      .map((definition) => definition.id);

    pruneLockedTowersFromLoadout();

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

    if (playfield?.messageEl) {
      playfield.messageEl.textContent =
        'Developer lattice engaged—every tower, level, and codex entry is unlocked.';
    }

    updatePowderHitboxVisibility();
  }

  function disableDeveloperMode() {
    developerModeActive = false;
    if (developerModeElements.toggle && developerModeElements.toggle.checked) {
      developerModeElements.toggle.checked = false;
    }

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

    hideLevelEditorPanel();

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

    powderCurrency = 0;
    updatePowderStockpileDisplay();

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
    powderState.motePalette = mergeMotePalette(DEFAULT_MOTE_PALETTE);
    applyMindGatePaletteToDom(powderState.motePalette);
    powderState.simulationMode = 'sand';
    powderState.wallGapTarget = powderConfig.wallBaseGapMotes;
    powderState.modeSwitchPending = false;
    powderState.fluidProfileLabel = 'Fluid Study';
    powderState.fluidUnlocked = false;
    powderState.viewTransform = null;
    powderState.loadedSimulationState = null;

    currentPowderBonuses = {
      sandBonus: 0,
      duneBonus: 0,
      crystalBonus: 0,
      totalMultiplier: 1,
    };
    powderWallMetrics = null;

    clearTowerUpgradeState();
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
  }

  function scrollPanelToElement(target, { offset = 16 } = {}) {
    if (!target) {
      return;
    }

    const panel = target.closest('.panel');
    if (panel) {
      const panelRect = panel.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const desiredTop = targetRect.top - panelRect.top + panel.scrollTop - offset;
      const top = Math.max(0, desiredTop);
      const scrollOptions = { top, behavior: 'smooth' };
      try {
        panel.scrollTo(scrollOptions);
      } catch (error) {
        panel.scrollTop = top;
      }
      return;
    }

    try {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      target.scrollIntoView(true);
    }
  }

  function isFieldNotesOverlayVisible() {
    return Boolean(fieldNotesElements.overlay?.classList.contains('active'));
  }

  function focusFieldNotesElement(element) {
    if (!element || typeof element.focus !== 'function') {
      return;
    }

    try {
      element.focus({ preventScroll: true });
    } catch (error) {
      element.focus();
    }
  }

  function getFieldNotesPages() {
    return Array.isArray(fieldNotesElements.pages) ? fieldNotesElements.pages : [];
  }

  function updateFieldNotesControls() {
    const pages = getFieldNotesPages();
    const total = pages.length;
    const current = Math.max(0, Math.min(total - 1, fieldNotesState.currentIndex));

    if (fieldNotesElements.pageIndicator) {
      const label = total > 0 ? `Page ${current + 1} of ${total}` : 'Page 1 of 1';
      fieldNotesElements.pageIndicator.textContent = label;
      fieldNotesElements.pageIndicator.hidden = total <= 1;
    }

    if (fieldNotesElements.prevButton) {
      fieldNotesElements.prevButton.disabled = current <= 0 || total <= 1;
      fieldNotesElements.prevButton.hidden = total <= 1;
    }

    if (fieldNotesElements.nextButton) {
      fieldNotesElements.nextButton.disabled = current >= total - 1 || total <= 1;
      fieldNotesElements.nextButton.hidden = total <= 1;
    }

    if (fieldNotesElements.pagination) {
      if (total <= 1) {
        fieldNotesElements.pagination.setAttribute('hidden', '');
      } else {
        fieldNotesElements.pagination.removeAttribute('hidden');
      }
    }
  }

  function setFieldNotesPage(targetIndex, options = {}) {
    const pages = getFieldNotesPages();
    if (!pages.length) {
      fieldNotesState.currentIndex = 0;
      updateFieldNotesControls();
      return;
    }

    const clampedIndex = Math.max(0, Math.min(pages.length - 1, targetIndex));
    const immediate = Boolean(options.immediate);
    const currentIndex = Math.max(0, Math.min(pages.length - 1, fieldNotesState.currentIndex));
    const currentPage = pages[currentIndex];
    const nextPage = pages[clampedIndex];

    if (!nextPage) {
      return;
    }

    if (!immediate && clampedIndex !== currentIndex && audioManager) {
      audioManager.playSfx('pageTurn');
    }

    if (immediate) {
      fieldNotesState.animating = false;
      fieldNotesState.currentIndex = clampedIndex;
      pages.forEach((page, index) => {
        const active = index === clampedIndex;
        page.classList.toggle('field-notes-page--active', active);
        page.classList.remove(
          'field-notes-page--enter-forward',
          'field-notes-page--enter-backward',
          'field-notes-page--exit-forward',
          'field-notes-page--exit-backward',
        );
        page.setAttribute('tabindex', active ? '0' : '-1');
        page.setAttribute('aria-hidden', active ? 'false' : 'true');
        if (active) {
          page.scrollTop = 0;
        }
      });
      updateFieldNotesControls();
      return;
    }

    if (fieldNotesState.animating || clampedIndex === currentIndex) {
      return;
    }

    const direction = Number.isFinite(options.direction)
      ? Math.sign(options.direction)
      : clampedIndex > currentIndex
      ? 1
      : -1;

    fieldNotesState.animating = true;

    const enterClass = direction >= 0 ? 'field-notes-page--enter-forward' : 'field-notes-page--enter-backward';
    const exitClass = direction >= 0 ? 'field-notes-page--exit-forward' : 'field-notes-page--exit-backward';

    if (currentPage && currentPage !== nextPage) {
      currentPage.classList.remove(
        'field-notes-page--enter-forward',
        'field-notes-page--enter-backward',
        'field-notes-page--exit-forward',
        'field-notes-page--exit-backward',
      );
      currentPage.classList.add(exitClass);
      currentPage.setAttribute('aria-hidden', 'true');
      currentPage.setAttribute('tabindex', '-1');
    }

    nextPage.classList.remove(
      'field-notes-page--enter-forward',
      'field-notes-page--enter-backward',
      'field-notes-page--exit-forward',
      'field-notes-page--exit-backward',
    );
    nextPage.classList.add('field-notes-page--active', enterClass);
    nextPage.setAttribute('aria-hidden', 'false');
    nextPage.setAttribute('tabindex', '0');
    nextPage.scrollTop = 0;

    let fallbackHandle = null;

    const finishTransition = (event) => {
      if (event && event.target !== nextPage) {
        return;
      }
      if (event && event.propertyName && event.propertyName !== 'transform') {
        return;
      }
      nextPage.removeEventListener('transitionend', finishTransition);
      if (fallbackHandle) {
        clearTimeout(fallbackHandle);
        fallbackHandle = null;
      }
      nextPage.classList.remove('field-notes-page--enter-forward', 'field-notes-page--enter-backward');
      if (currentPage && currentPage !== nextPage) {
        currentPage.classList.remove(
          'field-notes-page--active',
          'field-notes-page--exit-forward',
          'field-notes-page--exit-backward',
        );
      }
      fieldNotesState.currentIndex = clampedIndex;
      fieldNotesState.animating = false;
      updateFieldNotesControls();
    };

    requestAnimationFrame(() => {
      nextPage.addEventListener('transitionend', finishTransition);
      if (typeof window !== 'undefined') {
        fallbackHandle = window.setTimeout(() => {
          finishTransition();
        }, 420);
      }
      nextPage.classList.remove(enterClass);
    });
  }

  function showNextFieldNotesPage() {
    const pages = getFieldNotesPages();
    if (!pages.length) {
      return;
    }
    const nextIndex = Math.min(pages.length - 1, fieldNotesState.currentIndex + 1);
    setFieldNotesPage(nextIndex, { direction: 1 });
  }

  function showPreviousFieldNotesPage() {
    const pages = getFieldNotesPages();
    if (!pages.length) {
      return;
    }
    const nextIndex = Math.max(0, fieldNotesState.currentIndex - 1);
    setFieldNotesPage(nextIndex, { direction: -1 });
  }

  function handleFieldNotesOverlayKeydown(event) {
    if (!isFieldNotesOverlayVisible()) {
      return;
    }
    if (typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      showNextFieldNotesPage();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showPreviousFieldNotesPage();
    }
  }

  function handleFieldNotesPointerDown(event) {
    if (!event || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) {
      fieldNotesState.touchStart = null;
      return;
    }
    fieldNotesState.touchStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(),
    };
  }

  function handleFieldNotesPointerUp(event) {
    const start = fieldNotesState.touchStart;
    fieldNotesState.touchStart = null;
    if (!start || !event || start.pointerId !== event.pointerId || fieldNotesState.animating) {
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const elapsed = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - start.time;
    if (Math.abs(dx) < 40) {
      return;
    }
    if (Math.abs(dx) < Math.abs(dy) * 1.2) {
      return;
    }
    if (elapsed > 600) {
      return;
    }
    if (dx < 0) {
      showNextFieldNotesPage();
    } else {
      showPreviousFieldNotesPage();
    }
  }

  function clearFieldNotesPointerTracking() {
    fieldNotesState.touchStart = null;
  }

  function closeFieldNotesOverlay() {
    const { overlay } = fieldNotesElements;
    if (!overlay || !isFieldNotesOverlayVisible()) {
      return;
    }

    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');

    scheduleOverlayHide(overlay);
    fieldNotesState.animating = false;
    clearFieldNotesPointerTracking();

    const focusTarget =
      fieldNotesElements.lastFocus && typeof fieldNotesElements.lastFocus.focus === 'function'
        ? fieldNotesElements.lastFocus
        : fieldNotesElements.openButton;

    if (focusTarget) {
      focusFieldNotesElement(focusTarget);
    }

    fieldNotesElements.lastFocus = null;
  }

  function openFieldNotesOverlay() {
    const { overlay, closeButton } = fieldNotesElements;
    if (!overlay || isFieldNotesOverlayVisible()) {
      return;
    }

    fieldNotesElements.lastFocus = document.activeElement;
    revealOverlay(overlay);
    overlay.setAttribute('aria-hidden', 'false');
    fieldNotesState.touchStart = null;
    setFieldNotesPage(0, { immediate: true });

    requestAnimationFrame(() => {
      overlay.classList.add('active');
      if (closeButton) {
        focusFieldNotesElement(closeButton);
      } else {
        focusFieldNotesElement(overlay);
      }
    });
  }

  function initializeFieldNotesOverlay() {
    fieldNotesElements.overlay = document.getElementById('field-notes-overlay');
    fieldNotesElements.closeButton = document.getElementById('field-notes-close');
    fieldNotesElements.copy = document.getElementById('field-notes-copy');
    fieldNotesElements.pagination = document.getElementById('field-notes-pagination');
    fieldNotesElements.pageIndicator = document.getElementById('field-notes-page-indicator');
    fieldNotesElements.prevButton = document.getElementById('field-notes-prev');
    fieldNotesElements.nextButton = document.getElementById('field-notes-next');

    fieldNotesElements.pages = fieldNotesElements.copy
      ? Array.from(fieldNotesElements.copy.querySelectorAll('.field-notes-page'))
      : [];
    fieldNotesState.currentIndex = 0;
    setFieldNotesPage(0, { immediate: true });
    updateFieldNotesControls();

    const { overlay, closeButton } = fieldNotesElements;

    if (overlay) {
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          closeFieldNotesOverlay();
        }
      });

      overlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' || event.key === 'Esc') {
          event.preventDefault();
          closeFieldNotesOverlay();
          return;
        }
        handleFieldNotesOverlayKeydown(event);
      });
    }

    if (closeButton) {
      closeButton.addEventListener('click', (event) => {
        event.preventDefault();
        closeFieldNotesOverlay();
      });
    }

    if (fieldNotesElements.prevButton) {
      fieldNotesElements.prevButton.addEventListener('click', () => {
        showPreviousFieldNotesPage();
      });
    }

    if (fieldNotesElements.nextButton) {
      fieldNotesElements.nextButton.addEventListener('click', () => {
        showNextFieldNotesPage();
      });
    }

    if (fieldNotesElements.copy) {
      fieldNotesElements.copy.addEventListener('pointerdown', handleFieldNotesPointerDown, {
        passive: true,
      });
      fieldNotesElements.copy.addEventListener('pointerup', handleFieldNotesPointerUp);
      fieldNotesElements.copy.addEventListener('pointercancel', clearFieldNotesPointerTracking);
      fieldNotesElements.copy.addEventListener('pointerleave', (event) => {
        if (event.pointerType === 'touch' || event.pointerType === 'pen') {
          clearFieldNotesPointerTracking();
        }
      });
    }
  }

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
    if (!powderState.fluidUnlocked && normalized >= (powderConfig.fluidUnlockSigils || Infinity)) {
      powderState.fluidUnlocked = true;
      recordPowderEvent('fluid-unlocked', { threshold: powderConfig.fluidUnlockSigils || 0 });
      updatePowderModeButton();
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

  function handlePowderIdleBankChange(bankValue) {
    const normalized = Number.isFinite(bankValue) ? Math.max(0, bankValue) : 0;
    const previous = Number.isFinite(powderState.idleMoteBank) ? powderState.idleMoteBank : 0;
    powderState.idleMoteBank = normalized;
    powderState.idleBankHydrated = !!powderSimulation;

    if (Math.abs(previous - normalized) < 0.0001) {
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
  }

  function handlePowderHeightChange(info) {
    if (!info) {
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
  }

  function notifyIdleTime(elapsedMs) {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
      return;
    }
    gameStats.idleMillisecondsAccumulated += elapsedMs;
    const minutes = elapsedMs / 60000;
    const achievementsUnlocked = getUnlockedAchievementCount();
    const levelsBeat = getCompletedInteractiveLevelCount();
    const idleMotes = minutes * achievementsUnlocked * levelsBeat;
    if (idleMotes > 0) {
      addIdleMoteBank(idleMotes);
    }
    evaluateAchievements();
  }

  function calculatePowderBonuses() {
    // Stabilizing the sandfall adds an offset term to Ψ(g) = 2.7 · sin(t), yielding steady grain capture.
    const sandBonus = powderState.sandOffset > 0 ? 0.15 + powderState.sandOffset * 0.03 : 0;
    // Surveying dunes raises h inside Δm = log₂(h + 1); dynamic grains extend h beyond the surveyed base.
    const effectiveDuneHeight = Math.max(1, powderState.duneHeight + powderState.simulatedDuneGain);
    const duneBonus = Math.log2(effectiveDuneHeight + 1) * 0.04;

    const baseCrystalProduct = powderConfig.thetaBase * powderConfig.zetaBase;
    const chargedTheta = powderConfig.thetaBase + powderState.charges * 0.6;
    const chargedZeta = powderConfig.zetaBase + powderState.charges * 0.5;
    // Crystal resonance follows Q = √(θ · ζ); stored charges lift both parameters before release.
    const crystalGain = Math.max(
      0,
      Math.sqrt(chargedTheta * chargedZeta) - Math.sqrt(baseCrystalProduct),
    );
    const crystalBonus = crystalGain * 0.05;

    const totalMultiplier = 1 + sandBonus + duneBonus + crystalBonus;

    return { sandBonus, duneBonus, crystalBonus, totalMultiplier };
  }

  // Recompute base resource rates so powder multipliers and flux gains stay in sync with the HUD.
  function updateResourceRates() {
    currentPowderBonuses = calculatePowderBonuses();
    const totalMultiplier = Math.max(0, currentPowderBonuses.totalMultiplier || 1);
    resourceState.scoreRate = baseResources.scoreRate * totalMultiplier;
    resourceState.energyRate = baseResources.energyRate * totalMultiplier;
    resourceState.fluxRate = baseResources.fluxRate * totalMultiplier;
    updateStatusDisplays();
  }

  // Refresh idle mote stats so the Powder summary reflects current achievement and rate data.
  function updateMoteStatsDisplays() {
    if (powderElements.idleMultiplier) {
      const achievements = getUnlockedAchievementCount();
      const rate = getAchievementPowderRate();
      const achievementLabel = achievements === 1 ? 'achievement' : 'achievements';
      const rateLabel = rate === 1 ? 'Mote/min' : 'Motes/min';
      powderElements.idleMultiplier.textContent = `${formatWholeNumber(achievements)} ${achievementLabel} · +${formatGameNumber(
        rate,
      )} ${rateLabel}`;
    }

    // Display the relocated idle mote bank readout inside the Spire tab.
    if (powderElements.moteBank) {
      const bankedMotes = getCurrentIdleMoteBank();
      const moteLabel = bankedMotes === 1 ? 'Mote' : 'Motes';
      powderElements.moteBank.textContent = `${formatGameNumber(bankedMotes)} ${moteLabel}`;
    }

    // Surface the current fall rate so the Spire tab mirrors the basin flow.
    if (powderElements.moteRate) {
      const dispenseRate = getCurrentMoteDispenseRate();
      const moteLabel = dispenseRate === 1 ? 'Mote/sec' : 'Motes/sec';
      powderElements.moteRate.textContent = `${formatDecimal(dispenseRate, 2)} ${moteLabel}`;
    }
  }

  function updatePowderStockpileDisplay() {
    if (powderElements.stockpile) {
      powderElements.stockpile.textContent = `${formatGameNumber(
        powderCurrency,
      )} Mote Gems`;
    }
  }

  // Summarize the core powder ledger so flux readouts and Σ gains stay visible in the Powder tab.
  function updatePowderLedger() {
    if (powderElements.ledgerBaseScore) {
      powderElements.ledgerBaseScore.textContent = `${formatGameNumber(BASE_START_THERO)} ${THERO_SYMBOL}`;
    }
    if (powderElements.ledgerCurrentScore) {
      powderElements.ledgerCurrentScore.textContent = `${formatGameNumber(resourceState.score)} ${THERO_SYMBOL}`;
    }
    if (powderElements.ledgerFlux) {
      powderElements.ledgerFlux.textContent = `${formatGameNumber(resourceState.fluxRate)} Flux/sec`;
    }
    if (powderElements.ledgerEnergy) {
      powderElements.ledgerEnergy.textContent = `${formatGameNumber(resourceState.energyRate)} Energy/sec`;
    }
    updatePowderLogDisplay();
  }

  // Bind Powder tab controls to shared handlers and hydrate element caches for later updates.
  function bindPowderControls() {
    powderElements.totalMultiplier = document.getElementById('powder-total-multiplier');
    powderElements.sandBonusValue = document.getElementById('powder-sand-bonus');
    powderElements.duneBonusValue = document.getElementById('powder-dune-bonus');
    powderElements.crystalBonusValue = document.getElementById('powder-crystal-bonus');
    powderElements.stockpile = document.getElementById('powder-stockpile');
    // Relocated mote bank indicator now anchors to the Spire tab summary.
    powderElements.moteBank = document.getElementById('powder-mote-bank');
    // Fall rate display follows the bank so both mote flows surface together.
    powderElements.moteRate = document.getElementById('powder-mote-rate');
    powderElements.idleMultiplier = document.getElementById('powder-idle-multiplier');
    powderElements.gemInventoryList = document.getElementById('powder-gem-inventory');
    powderElements.gemInventoryEmpty = document.getElementById('powder-gem-empty');
    powderElements.craftingButton = document.getElementById('open-crafting-menu');
    powderElements.ledgerBaseScore =
      document.getElementById('powder-ledger-base-score') || document.getElementById('powder-ledger-base');
    powderElements.ledgerCurrentScore =
      document.getElementById('powder-ledger-current-score') || document.getElementById('powder-ledger-score');
    powderElements.ledgerFlux = document.getElementById('powder-ledger-flux');
    powderElements.ledgerEnergy = document.getElementById('powder-ledger-energy');
    powderElements.logList = document.getElementById('powder-log');
    powderElements.logEmpty = document.getElementById('powder-log-empty');
    powderElements.simulationCanvas = document.getElementById('powder-canvas');
    powderElements.basin = document.getElementById('powder-basin');
    powderElements.viewport = document.getElementById('powder-viewport');
    powderElements.wallMarker = document.getElementById('powder-wall-marker');
    powderElements.crestMarker = document.getElementById('powder-crest-marker');
    powderElements.leftWall = document.getElementById('powder-wall-left');
    powderElements.rightWall = document.getElementById('powder-wall-right');
    powderElements.leftHitbox = document.getElementById('powder-wall-hitbox-left');
    powderElements.rightHitbox = document.getElementById('powder-wall-hitbox-right');
    powderElements.modeToggle = document.getElementById('powder-mode-toggle');
    powderElements.sandfallFormula = document.getElementById('powder-sandfall-formula');
    powderElements.sandfallNote = document.getElementById('powder-sandfall-note');
    powderElements.sandfallButton = document.getElementById('powder-sandfall-button');
    powderElements.duneFormula = document.getElementById('powder-dune-formula');
    powderElements.duneNote = document.getElementById('powder-dune-note');
    powderElements.duneButton = document.getElementById('powder-dune-button');
    powderElements.crystalFormula = document.getElementById('powder-crystal-formula');
    powderElements.crystalNote = document.getElementById('powder-crystal-note');
    powderElements.crystalButton = document.getElementById('powder-crystal-button');

    const glyphColumnNodes = document.querySelectorAll('[data-powder-glyph-column]');
    powderElements.wallGlyphColumns = Array.from(glyphColumnNodes);
    powderGlyphColumns.length = 0;
    powderElements.wallGlyphColumns.forEach((element) => {
      powderGlyphColumns.push({ element, glyphs: new Map() });
    });

    const sigilList = document.getElementById('powder-sigil-list');
    powderElements.sigilEntries = sigilList ? Array.from(sigilList.querySelectorAll('li')) : [];

    if (powderElements.modeToggle) {
      powderElements.modeToggle.addEventListener('click', (event) => {
        event.preventDefault();
        handlePowderModeToggle();
      });
    }

    if (powderElements.sandfallButton) {
      powderElements.sandfallButton.addEventListener('click', (event) => {
        event.preventDefault();
        toggleSandfallStability();
      });
    }

    if (powderElements.duneButton) {
      powderElements.duneButton.addEventListener('click', (event) => {
        event.preventDefault();
        surveyRidgeHeight();
      });
    }

    if (powderElements.crystalButton) {
      powderElements.crystalButton.addEventListener('click', (event) => {
        event.preventDefault();
        chargeCrystalMatrix();
      });
    }

    if (powderElements.craftingButton) {
      powderElements.craftingButton.addEventListener('click', (event) => {
        event.preventDefault();
        openCraftingOverlay();
      });
    }

    updateMoteGemInventoryDisplay();
    updatePowderLogDisplay();
    updatePowderLedger();
    updatePowderDisplay();
    updateMoteStatsDisplays();
  }

  function triggerPowderBasinPulse() {
    if (!powderElements.basin) {
      return;
    }
    powderElements.basin.classList.remove('powder-basin--pulse');
    if (powderBasinPulseTimer) {
      clearTimeout(powderBasinPulseTimer);
    }
    // Restarting the animation requires a frame to flush styles.
    requestAnimationFrame(() => {
      if (!powderElements.basin) {
        return;
      }
      powderElements.basin.classList.add('powder-basin--pulse');
      powderBasinPulseTimer = setTimeout(() => {
        if (powderElements.basin) {
          powderElements.basin.classList.remove('powder-basin--pulse');
        }
        powderBasinPulseTimer = null;
      }, 900);
    });
  }

  function applyPowderGain(amount, context = {}) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0;
    }

    const { source = 'tick', minutes = 0, rate = 0 } = context;
    powderCurrency = Math.max(0, powderCurrency + amount);
    updatePowderStockpileDisplay();
    schedulePowderSave();

    if (source === 'offline') {
      recordPowderEvent('offline-reward', { minutes, rate, powder: amount });
      triggerPowderBasinPulse();
    }

    return amount;
  }

  // Connect mote gem logging to the powder handlers once both helpers are defined.
  configureEnemyHandlers({ queueMoteDrop, recordPowderEvent });

  function toggleSandfallStability() {
    powderState.sandOffset =
      powderState.sandOffset > 0
        ? powderConfig.sandOffsetInactive
        : powderConfig.sandOffsetActive;

    if (powderSimulation) {
      powderSimulation.setFlowOffset(powderState.sandOffset);
    }

    refreshPowderSystems();
    recordPowderEvent(powderState.sandOffset > 0 ? 'sand-stabilized' : 'sand-released');
    notifyPowderAction();
  }

  function surveyRidgeHeight() {
    if (powderState.duneHeight >= powderConfig.duneHeightMax) {
      recordPowderEvent('dune-max');
      return;
    }

    powderState.duneHeight += 1;
    refreshPowderSystems();
    recordPowderEvent('dune-raise', { height: powderState.duneHeight });
    notifyPowderAction();
  }

  function chargeCrystalMatrix() {
    if (powderState.charges < 3) {
      powderState.charges += 1;
      refreshPowderSystems();
      recordPowderEvent('crystal-charge', { charges: powderState.charges });
      notifyPowderAction();
      return;
    }

    const pulseBonus = releaseCrystalPulse(powderState.charges);
    powderState.charges = 0;
    refreshPowderSystems(pulseBonus);
    recordPowderEvent('crystal-release', { pulseBonus });
    notifyPowderAction();
  }

  function releaseCrystalPulse(charges) {
    const chargedTheta = powderConfig.thetaBase + charges * 0.6;
    const chargedZeta = powderConfig.zetaBase + charges * 0.5;
    const resonance = Math.sqrt(chargedTheta * chargedZeta);
    const pulseBonus = resonance * 0.008;

    // Each pulse injects a burst of Σ score proportional to the amplified resonance term.
    resourceState.score += resourceState.score * pulseBonus;
    updateStatusDisplays();

    return pulseBonus;
  }

  function refreshPowderSystems(pulseBonus) {
    updateResourceRates();
    updatePowderDisplay(pulseBonus);
    updateMoteStatsDisplays();
  }

  function updatePowderDisplay(pulseBonus) {
    const totalMultiplier = currentPowderBonuses.totalMultiplier;
    notifyPowderMultiplier(totalMultiplier);

    if (FLUX_OVERVIEW_IS_STUB) {
      if (powderElements.totalMultiplier) {
        powderElements.totalMultiplier.textContent = '×—.—';
      }
      if (powderElements.sandBonusValue) {
        powderElements.sandBonusValue.textContent = '—%';
      }
      if (powderElements.duneBonusValue) {
        powderElements.duneBonusValue.textContent = '—%';
      }
      if (powderElements.crystalBonusValue) {
        powderElements.crystalBonusValue.textContent = '—%';
      }
    } else {
      if (powderElements.totalMultiplier) {
        powderElements.totalMultiplier.textContent = `×${formatDecimal(
          totalMultiplier,
          2,
        )}`;
      }

      if (powderElements.sandBonusValue) {
        powderElements.sandBonusValue.textContent = formatSignedPercentage(
          currentPowderBonuses.sandBonus,
        );
      }

      if (powderElements.duneBonusValue) {
        powderElements.duneBonusValue.textContent = formatSignedPercentage(
          currentPowderBonuses.duneBonus,
        );
      }

      if (powderElements.crystalBonusValue) {
        powderElements.crystalBonusValue.textContent = formatSignedPercentage(
          currentPowderBonuses.crystalBonus,
        );
      }
    }

    if (SIGIL_LADDER_IS_STUB) {
      if (powderElements.sigilEntries && powderElements.sigilEntries.length) {
        powderElements.sigilEntries.forEach((sigil) => {
          sigil.classList.remove('sigil-reached');
        });
      }
      notifyPowderSigils(0);
    } else if (powderElements.sigilEntries && powderElements.sigilEntries.length) {
      let reached = 0;
      powderElements.sigilEntries.forEach((sigil) => {
        const threshold = Number.parseFloat(sigil.dataset.sigilThreshold);
        if (!Number.isFinite(threshold)) {
          return;
        }
        if (totalMultiplier >= threshold) {
          sigil.classList.add('sigil-reached');
          reached += 1;
        } else {
          sigil.classList.remove('sigil-reached');
        }
      });
      notifyPowderSigils(reached);
    } else {
      notifyPowderSigils(0);
    }

    updatePowderLedger();

    if (powderElements.sandfallFormula) {
      const offset = powderState.sandOffset;
      powderElements.sandfallFormula.textContent =
        offset > 0
          ? `\\( \\Psi(g) = 2.7\\, \\sin(t) + ${formatDecimal(offset, 1)} \\)`
          : '\\( \\Psi(g) = 2.7\\, \\sin(t) \\)';
      renderMathElement(powderElements.sandfallFormula);
    }

    if (powderElements.sandfallNote) {
      const bonusText = formatPercentage(currentPowderBonuses.sandBonus);
      powderElements.sandfallNote.textContent =
        powderState.sandOffset > 0
          ? `Flow stabilized—captured grains grant +${bonusText} Mote Gems.`
          : 'Crest is unstable—Mote Gems drift off the board.';
    }

    if (powderElements.sandfallButton) {
      powderElements.sandfallButton.textContent =
        powderState.sandOffset > 0 ? 'Release Flow' : 'Stabilize Flow';
    }

    if (powderElements.duneFormula) {
      const height = Math.max(1, powderState.duneHeight + powderState.simulatedDuneGain);
      const logValue = Math.log2(height + 1);
      powderElements.duneFormula.textContent = `\\( \\Delta m = \\log_{2}(${formatDecimal(height, 2)} + 1) = ${formatDecimal(
        logValue,
        2,
      )} \\)`;
      renderMathElement(powderElements.duneFormula);
    }

    if (powderElements.duneNote) {
      const crestHeight = Math.max(1, powderState.duneHeight + powderState.simulatedDuneGain);
      powderElements.duneNote.textContent = `Channel bonus: +${formatPercentage(
        currentPowderBonuses.duneBonus,
      )} to energy gain · crest h = ${formatDecimal(crestHeight, 2)}.`;
    }

    if (powderElements.duneButton) {
      const reachedMax = powderState.duneHeight >= powderConfig.duneHeightMax;
      powderElements.duneButton.disabled = reachedMax;
      powderElements.duneButton.textContent = reachedMax ? 'Ridge Surveyed' : 'Survey Ridge';
    }

    if (powderElements.crystalFormula) {
      const charges = powderState.charges;
      const theta = powderConfig.thetaBase + charges * 0.6;
      const zeta = powderConfig.zetaBase + charges * 0.5;
      const root = Math.sqrt(theta * zeta);
      powderElements.crystalFormula.textContent = `\\( Q = \\sqrt{${formatDecimal(theta, 2)} \\cdot ${formatDecimal(
        zeta,
        2,
      )}} = ${formatDecimal(root, 2)} \\)`;
      renderMathElement(powderElements.crystalFormula);
    }

    if (powderElements.crystalButton) {
      powderElements.crystalButton.textContent =
        powderState.charges < 3
          ? `Crystallize (${powderState.charges}/3)`
          : 'Release Pulse';
    }

    if (powderElements.crystalNote) {
      if (typeof pulseBonus === 'number') {
        powderElements.crystalNote.textContent = `Pulse released! Σ score surged by +${formatPercentage(
          pulseBonus,
        )}.`;
      } else if (powderState.charges >= 3) {
        powderElements.crystalNote.textContent = 'Pulse ready—channel the matrix to unleash stored Σ energy.';
      } else if (currentPowderBonuses.crystalBonus <= 0) {
        powderElements.crystalNote.textContent = 'Crystal resonance is idle—no pulse prepared.';
      } else {
        powderElements.crystalNote.textContent = `Stored resonance grants +${formatPercentage(
          currentPowderBonuses.crystalBonus,
        )} to all rates.`;
      }
    }

    updatePowderStockpileDisplay();
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

    // Activate the gem cursor when a desktop pointer is detected.
    initializeDesktopCursorPreference();

    // Enable drag gestures on scrollable shells to replace the hidden scrollbars.
    enableDragScroll({
      selectors: ['.panel', '.field-notes-page', '.upgrade-matrix-grid'],
    });

    initializeLevelEditorElements();

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
    enablePanelWheelScroll(towerPanel);
    enablePanelWheelScroll(towersPanel);

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
    playfieldOutcomeElements.overlay = document.getElementById('playfield-outcome');
    playfieldOutcomeElements.title = document.getElementById('playfield-outcome-title');
    playfieldOutcomeElements.subtitle = document.getElementById('playfield-outcome-subtitle');
    playfieldOutcomeElements.primary = document.getElementById('playfield-outcome-primary');
    playfieldOutcomeElements.secondary = document.getElementById('playfield-outcome-secondary');
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
        if (tabId === 'powder') {
          // Realign the powder basin after the tab becomes visible so layout metrics refresh.
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
    initializeFieldNotesOverlay();
    bindCodexControls({
      setActiveTab,
      openFieldNotesOverlay,
      scrollPanelToElement,
      onOpenButtonReady: (button) => {
        fieldNotesElements.openButton = button;
      },
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
      updatePlayfieldMenuState();
    }

    refreshTabMusic({ restart: true });

    bindOfflineOverlayElements();
    loadPersistentState();
    reconcileGlyphCurrencyFromState();

    bindStatusElements();
    bindPowderControls();
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
    get: getAlephChainUpgrades,
    set: updateAlephChainUpgrades,
  };

  window.glyphDefenseUpgrades = upgradeNamespace;

})();
