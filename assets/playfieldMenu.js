// Playfield quick menu controller extracted from assets/main.js.
// Manages the battlefield actions sheet (commence, retry, level select, dev tools, stats).

const DEFAULT_LEVEL_SELECT_LABEL = 'Level Selection';

/**
 * Factory that owns the quick menu bindings and accessibility state.
 * @param {Object} options - Callback hooks for retrieving runtime state.
 * @param {() => string|null} options.getActiveLevelId - Returns the active level identifier.
 * @param {() => boolean} options.isActiveLevelInteractive - Reports whether the active level is interactive.
 * @param {() => import('./playfield.js').SimplePlayfield|null} options.getPlayfield - Fetches the live playfield instance.
 * @param {() => HTMLElement|null} options.getStartButton - Returns the primary commence button.
 * @param {() => boolean} options.isDeveloperModeActive - Flags whether developer mode is toggled on.
 * @param {(levelId: string) => any} options.getLevelById - Looks up the level configuration by id.
 * @param {() => boolean} options.isDeveloperMapToolsActive - Indicates whether the map editor is open.
 * @param {(level: any) => boolean} options.activateDeveloperMapToolsForLevel - Opens the map editor for a level.
 * @param {(config: { force?: boolean, silent?: boolean }) => void} options.deactivateDeveloperMapTools - Closes the map editor.
 * @param {() => void} options.clearPendingLevel - Clears any pending level selection.
 * @param {() => void} options.requestLayoutRefresh - Triggers a layout recalculation in main.js.
 * @param {() => void} options.leaveActiveLevel - Leaves the currently running level.
 * @param {(visible: boolean) => void} options.onStatsPanelVisibilityChange - Notifies when the stats panel should toggle.
 * @param {() => void} options.focusStatsPanel - Scrolls the combat stats panel into view when shown.
 * @param {() => void} options.resetStatsPanel - Resets the combat stats summary contents.
 * @param {() => import('./audioSystem.js').AudioManager|null} [options.getAudioManager] - Retrieves the shared audio manager.
 * @param {(message: string) => void} [options.setPlayfieldMessage] - Writes quick status messages to the playfield banner.
 * @returns {Object} controller API for the quick menu.
 */
export function createPlayfieldMenuController(options) {
  const {
    getActiveLevelId,
    isActiveLevelInteractive,
    getPlayfield,
    getStartButton,
    isDeveloperModeActive,
    getLevelById,
    isDeveloperMapToolsActive,
    activateDeveloperMapToolsForLevel,
    deactivateDeveloperMapTools,
    clearPendingLevel,
    requestLayoutRefresh,
    leaveActiveLevel,
    onStatsPanelVisibilityChange,
    focusStatsPanel,
    resetStatsPanel,
    getAudioManager,
    setPlayfieldMessage,
  } = options;

  const menuElements = {
    button: null,
    panel: null,
    commence: null,
    levelSelect: null,
    retry: null,
    devTools: null,
    stats: null,
  };

  const documentListeners = {
    pointerdown: null,
    keydown: null,
  };

  let menuOpen = false;
  let levelSelectConfirming = false;
  let statsPanelVisible = false;

  /**
   * Safe getter for the optional audio manager reference.
   * @returns {import('./audioSystem.js').AudioManager|null}
   */
  function resolveAudioManager() {
    if (typeof getAudioManager === 'function') {
      try {
        return getAudioManager() || null;
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  /**
   * Writes a status message to the playfield banner when available.
   * @param {string} message - Text content describing the menu outcome.
   */
  function writePlayfieldMessage(message) {
    if (typeof setPlayfieldMessage === 'function') {
      setPlayfieldMessage(message);
    }
  }

  /**
   * Restores the level select menu item to its default label/state.
   */
  function resetLevelSelectPrompt() {
    if (menuElements.levelSelect) {
      menuElements.levelSelect.textContent = DEFAULT_LEVEL_SELECT_LABEL;
      menuElements.levelSelect.classList.remove('playfield-menu-item--warning');
      menuElements.levelSelect.removeAttribute('data-confirming');
    }
    levelSelectConfirming = false;
  }

  /**
   * Updates button availability and aria state to match current gameplay context.
   */
  function updateMenuState() {
    const activeLevelId = typeof getActiveLevelId === 'function' ? getActiveLevelId() : null;
    const interactive = Boolean(
      typeof isActiveLevelInteractive === 'function' && isActiveLevelInteractive(),
    );
    const playfield = typeof getPlayfield === 'function' ? getPlayfield() : null;
    const startButton = typeof getStartButton === 'function' ? getStartButton() : null;

    if (menuElements.commence) {
      const disabled = !startButton || startButton.disabled;
      menuElements.commence.disabled = disabled;
      menuElements.commence.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      const label = startButton?.textContent?.trim();
      if (label) {
        menuElements.commence.textContent = label;
      }
    }

    if (menuElements.levelSelect) {
      const disabled = !(interactive && activeLevelId) && !activeLevelId;
      menuElements.levelSelect.disabled = disabled;
      menuElements.levelSelect.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }

    if (menuElements.retry) {
      const canRetry = Boolean(
        playfield && typeof playfield.canRetryCurrentWave === 'function'
          ? playfield.canRetryCurrentWave()
          : interactive,
      );
      menuElements.retry.disabled = !canRetry;
      menuElements.retry.setAttribute('aria-disabled', canRetry ? 'false' : 'true');
    }

    if (menuElements.devTools) {
      const developerActive = Boolean(
        typeof isDeveloperModeActive === 'function' && isDeveloperModeActive(),
      );
      const devAvailable = Boolean(developerActive && activeLevelId && interactive);
      const toolsActive = Boolean(
        typeof isDeveloperMapToolsActive === 'function' && isDeveloperMapToolsActive(),
      );
      menuElements.devTools.disabled = !devAvailable;
      menuElements.devTools.setAttribute('aria-disabled', devAvailable ? 'false' : 'true');
      menuElements.devTools.textContent = toolsActive ? 'Close Dev Map Tools' : 'Dev Map Tools';
      menuElements.devTools.setAttribute('aria-pressed', toolsActive ? 'true' : 'false');
      if (!devAvailable) {
        const hint = developerActive
          ? 'Enter an interactive defense to access Dev Map Tools.'
          : 'Enable developer mode in the Codex tab to access Dev Map Tools.';
        menuElements.devTools.setAttribute('title', hint);
        menuElements.devTools.setAttribute('aria-description', hint);
      } else {
        menuElements.devTools.removeAttribute('title');
        menuElements.devTools.removeAttribute('aria-description');
      }
    }

    if (menuElements.stats) {
      const statsAvailable = Boolean(playfield && interactive);
      menuElements.stats.disabled = !statsAvailable;
      menuElements.stats.setAttribute('aria-disabled', statsAvailable ? 'false' : 'true');
      const label = statsPanelVisible ? 'Hide Combat Stats' : 'Show Combat Stats';
      menuElements.stats.textContent = label;
      menuElements.stats.setAttribute('aria-pressed', statsPanelVisible ? 'true' : 'false');
    }
  }

  /**
   * Handles pointer presses outside of the quick menu panel to dismiss it.
   * @param {PointerEvent} event - Pointer interaction from the document scope.
   */
  function handlePointerDown(event) {
    if (!menuOpen || !menuElements.panel) {
      return;
    }
    const target = event?.target || null;
    if (menuElements.panel.contains(target)) {
      return;
    }
    if (menuElements.button && target === menuElements.button) {
      return;
    }
    closeMenu();
  }

  /**
   * Handles Escape key presses to collapse the menu.
   * @param {KeyboardEvent} event - Keyboard interaction from the document scope.
   */
  function handleKeydown(event) {
    if (!menuOpen) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu({ restoreFocus: true });
    }
  }

  /**
   * Attaches document-level listeners for pointer and keyboard dismissal.
   */
  function attachDocumentListeners() {
    if (documentListeners.pointerdown || documentListeners.keydown) {
      return;
    }
    documentListeners.pointerdown = handlePointerDown;
    documentListeners.keydown = handleKeydown;
    document.addEventListener('pointerdown', documentListeners.pointerdown);
    document.addEventListener('keydown', documentListeners.keydown);
  }

  /**
   * Removes document-level listeners when the menu is hidden.
   */
  function detachDocumentListeners() {
    if (documentListeners.pointerdown) {
      document.removeEventListener('pointerdown', documentListeners.pointerdown);
      documentListeners.pointerdown = null;
    }
    if (documentListeners.keydown) {
      document.removeEventListener('keydown', documentListeners.keydown);
      documentListeners.keydown = null;
    }
  }

  /**
   * Opens the quick menu if an interactive level is running.
   */
  function openMenu() {
    // Collapse any open tower selection wheel so focus doesn't compete with the quick menu.
    const playfield = typeof getPlayfield === 'function' ? getPlayfield() : null;
    if (playfield && typeof playfield.closeTowerSelectionWheel === 'function') {
      playfield.closeTowerSelectionWheel();
    }
    const interactive = Boolean(
      typeof isActiveLevelInteractive === 'function' && isActiveLevelInteractive(),
    );
    const activeLevelId = typeof getActiveLevelId === 'function' ? getActiveLevelId() : null;
    if (!menuElements.button || !menuElements.panel) {
      return;
    }
    if (!activeLevelId || !interactive) {
      return;
    }
    if (menuOpen) {
      return;
    }

    menuOpen = true;
    menuElements.button.setAttribute('aria-expanded', 'true');
    menuElements.panel.removeAttribute('hidden');
    updateMenuState();
    attachDocumentListeners();

    const focusTarget = menuElements.panel.querySelector('[role="menuitem"], button');
    if (focusTarget && typeof focusTarget.focus === 'function') {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch (error) {
        focusTarget.focus();
      }
    }
  }

  /**
   * Collapses the quick menu and optionally restores focus to the toggle button.
   * @param {Object} [options] - Configuration for the dismissal behavior.
   * @param {boolean} [options.restoreFocus=false] - Whether focus should return to the toggle button.
   */
  function closeMenu(options = {}) {
    const { restoreFocus = false } = options;
    if (menuElements.button) {
      menuElements.button.setAttribute('aria-expanded', 'false');
    }
    if (menuElements.panel) {
      menuElements.panel.setAttribute('hidden', '');
    }
    resetLevelSelectPrompt();
    if (!menuOpen) {
      return;
    }
    menuOpen = false;
    detachDocumentListeners();
    if (restoreFocus && menuElements.button && typeof menuElements.button.focus === 'function') {
      try {
        menuElements.button.focus({ preventScroll: true });
      } catch (error) {
        menuElements.button.focus();
      }
    }
  }

  /**
   * Switches the open/closed state in response to toggle button clicks.
   */
  function toggleMenu() {
    if (menuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  /**
   * Flips the stats panel visibility flag and syncs UI affordances.
   */
  function toggleStatsVisibility() {
    const playfield = typeof getPlayfield === 'function' ? getPlayfield() : null;
    const activeLevelId = typeof getActiveLevelId === 'function' ? getActiveLevelId() : null;
    const interactive = Boolean(
      typeof isActiveLevelInteractive === 'function' && isActiveLevelInteractive(),
    );
    if (!playfield || typeof playfield.setStatsPanelEnabled !== 'function') {
      return;
    }
    if (!activeLevelId || !interactive) {
      return;
    }
    statsPanelVisible = !statsPanelVisible;
    if (typeof onStatsPanelVisibilityChange === 'function') {
      onStatsPanelVisibilityChange(statsPanelVisible);
    }
    if (statsPanelVisible && typeof focusStatsPanel === 'function') {
      const attemptFocus = () => {
        try {
          focusStatsPanel();
        } catch (error) {
          focusStatsPanel();
        }
      };
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(attemptFocus);
      } else {
        attemptFocus();
      }
    }
    updateMenuState();
  }

  /**
   * Handles the "Level Selection" action with confirmation support.
   */
  function handleReturnToLevelSelection() {
    const activeLevelId = typeof getActiveLevelId === 'function' ? getActiveLevelId() : null;
    const interactive = Boolean(
      typeof isActiveLevelInteractive === 'function' && isActiveLevelInteractive(),
    );
    const hasActiveLevel = Boolean(activeLevelId);
    const requiresConfirm = Boolean(activeLevelId && interactive);

    if (!hasActiveLevel) {
      resetLevelSelectPrompt();
      closeMenu();
      if (typeof requestLayoutRefresh === 'function') {
        requestLayoutRefresh();
      }
      return;
    }

    if (requiresConfirm && !levelSelectConfirming) {
      levelSelectConfirming = true;
      if (menuElements.levelSelect) {
        menuElements.levelSelect.textContent = 'Are you sure?';
        menuElements.levelSelect.classList.add('playfield-menu-item--warning');
        menuElements.levelSelect.setAttribute('data-confirming', 'true');
      }
      return;
    }

    resetLevelSelectPrompt();
    const finalizeExit = () => {
      if (typeof leaveActiveLevel === 'function') {
        leaveActiveLevel();
      }
      closeMenu({ restoreFocus: true });
    };
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(finalizeExit);
    } else {
      finalizeExit();
    }
  }

  /**
   * Mirrors the main commence button when activated from the quick menu.
   */
  function handleCommenceWaveFromMenu() {
    const startButton = typeof getStartButton === 'function' ? getStartButton() : null;
    if (!startButton || startButton.disabled) {
      return;
    }
    if (startButton === menuElements.commence) {
      const finalizeClose = () => {
        closeMenu();
        updateMenuState();
      };
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(finalizeClose);
      } else {
        finalizeClose();
      }
      return;
    }
    startButton.click();
    closeMenu();
    updateMenuState();
  }

  /**
   * Replays the current wave when the playfield exposes retry support.
   */
  function handleRetryCurrentWave() {
    resetLevelSelectPrompt();
    const playfield = typeof getPlayfield === 'function' ? getPlayfield() : null;
    if (!playfield || typeof playfield.retryCurrentWave !== 'function') {
      return;
    }
    const retried = playfield.retryCurrentWave();
    updateMenuState();
    if (retried) {
      closeMenu();
    }
  }

  /**
   * Toggles developer map tools if the current profile permits it.
   */
  function handleOpenDevMapTools() {
    resetLevelSelectPrompt();
    const audioManager = resolveAudioManager();
    const developerActive = Boolean(
      typeof isDeveloperModeActive === 'function' && isDeveloperModeActive(),
    );
    const activeLevelId = typeof getActiveLevelId === 'function' ? getActiveLevelId() : null;
    const interactive = Boolean(
      typeof isActiveLevelInteractive === 'function' && isActiveLevelInteractive(),
    );
    const playfield = typeof getPlayfield === 'function' ? getPlayfield() : null;

    if (!developerActive) {
      writePlayfieldMessage('Enable developer mode in the Codex tab to open Dev Map Tools.');
      audioManager?.playSfx?.('error');
      closeMenu();
      return;
    }

    if (!activeLevelId || !interactive) {
      writePlayfieldMessage('Enter an interactive defense before opening Dev Map Tools.');
      audioManager?.playSfx?.('error');
      closeMenu();
      return;
    }

    const level = typeof getLevelById === 'function' ? getLevelById(activeLevelId) : null;
    if (!level) {
      writePlayfieldMessage('Active level data unavailable—restart the defense to refresh developer tools.');
      closeMenu();
      return;
    }

    const toolsActive = Boolean(
      typeof isDeveloperMapToolsActive === 'function' && isDeveloperMapToolsActive(),
    );
    if (toolsActive) {
      deactivateDeveloperMapTools?.({ force: true, silent: false });
      updateMenuState();
      audioManager?.playSfx?.('menuSelect');
      closeMenu();
      return;
    }

    clearPendingLevel?.();
    const activated = activateDeveloperMapToolsForLevel?.(level);
    if (!activated) {
      writePlayfieldMessage('Unable to activate developer map tools—verify the level path is loaded.');
      audioManager?.playSfx?.('error');
      closeMenu();
      return;
    }

    writePlayfieldMessage(
      'Developer map tools active—drag anchors or Shift-click to remove points directly on the battlefield.',
    );
    audioManager?.playSfx?.('menuSelect');
    updateMenuState();
    closeMenu();
  }

  /**
   * Detaches any existing listeners before rebinding to the latest DOM references.
   */
  function unbindMenuElements() {
    if (menuElements.button) {
      menuElements.button.removeEventListener('click', toggleMenuHandler);
    }
    if (menuElements.levelSelect) {
      menuElements.levelSelect.removeEventListener('click', returnHandler);
    }
    if (menuElements.commence) {
      menuElements.commence.removeEventListener('click', commenceHandler);
    }
    if (menuElements.retry) {
      menuElements.retry.removeEventListener('click', retryHandler);
    }
    if (menuElements.devTools) {
      menuElements.devTools.removeEventListener('click', devToolsHandler);
    }
    if (menuElements.stats) {
      menuElements.stats.removeEventListener('click', statsHandler);
    }
  }

  /**
   * Handler wrappers are defined ahead of time so they can be removed safely.
   */
  function toggleMenuHandler(event) {
    event.preventDefault();
    toggleMenu();
  }

  function returnHandler(event) {
    event.preventDefault();
    handleReturnToLevelSelection();
  }

  function commenceHandler(event) {
    event.preventDefault();
    handleCommenceWaveFromMenu();
  }

  function retryHandler(event) {
    event.preventDefault();
    handleRetryCurrentWave();
  }

  function devToolsHandler(event) {
    event.preventDefault();
    handleOpenDevMapTools();
  }

  function statsHandler(event) {
    event.preventDefault();
    toggleStatsVisibility();
  }

  /**
   * Stores the DOM nodes that back the quick menu and hooks up listeners.
   * @param {Object} elements - Element references from main.js initialization.
   */
  function bindMenuElements(elements) {
    unbindMenuElements();
    menuElements.button = elements.button || null;
    menuElements.panel = elements.panel || null;
    menuElements.commence = elements.commence || null;
    menuElements.levelSelect = elements.levelSelect || null;
    menuElements.retry = elements.retry || null;
    menuElements.devTools = elements.devTools || null;
    menuElements.stats = elements.stats || null;

    if (menuElements.levelSelect) {
      menuElements.levelSelect.textContent = DEFAULT_LEVEL_SELECT_LABEL;
    }

    if (menuElements.button) {
      menuElements.button.addEventListener('click', toggleMenuHandler);
    }
    if (menuElements.levelSelect) {
      menuElements.levelSelect.addEventListener('click', returnHandler);
    }
    if (menuElements.commence) {
      menuElements.commence.addEventListener('click', commenceHandler);
    }
    if (menuElements.retry) {
      menuElements.retry.addEventListener('click', retryHandler);
    }
    if (menuElements.devTools) {
      menuElements.devTools.addEventListener('click', devToolsHandler);
    }
    if (menuElements.stats) {
      menuElements.stats.addEventListener('click', statsHandler);
    }

    closeMenu();
    updateMenuState();
  }

  /**
   * Exposes the stats visibility flag so main.js can query the current state.
   * @returns {boolean} whether the stats panel is visible.
   */
  function isStatsPanelVisible() {
    return statsPanelVisible;
  }

  /**
   * Resets the stats visibility toggle and mirrors the change to the playfield.
   */
  function resetStatsPanelState() {
    statsPanelVisible = false;
    if (typeof onStatsPanelVisibilityChange === 'function') {
      onStatsPanelVisibilityChange(false);
    }
    if (typeof resetStatsPanel === 'function') {
      resetStatsPanel();
    }
    updateMenuState();
  }

  /**
   * Applies the cached stats visibility state to the playfield after it is (re)created.
   */
  function syncStatsPanelVisibility() {
    if (typeof onStatsPanelVisibilityChange === 'function') {
      onStatsPanelVisibilityChange(statsPanelVisible);
    }
    updateMenuState();
  }

  return {
    bindMenuElements,
    updateMenuState,
    closeMenu,
    resetStatsPanelState,
    syncStatsPanelVisibility,
    isStatsPanelVisible,
  };
}
