/**
 * Factory that encapsulates DOM toggles for the spire tab stack and their floating menu
 * controls. The implementation previously lived in `assets/main.js`, which made the file
 * responsible for low-level UI state in addition to orchestration. Extracting the helper
 * keeps the tab visibility logic cohesive and easier to test in isolation.
 *
 * @param {Object} options - Dependency bag used to interact with the live game state.
 * @param {Object} options.fluidElements - Mutable references for fluid tab DOM nodes.
 * @param {Function} options.getResourceElements - Getter that returns the latest resource HUD elements.
 * @param {Object} options.spireResourceState - Unlock flags and stats for each spire.
 * @param {Object} options.powderState - Powder progression state including the fluid unlock flag.
 * @returns {{updateFluidTabAvailability: Function, updateSpireTabVisibility: Function}}
 */
export function createSpireTabVisibilityManager({
  fluidElements,
  getResourceElements,
  spireResourceState,
  powderState,
}) {
  /**
   * Swap stacked tab icons to a placeholder instead of removing them from the DOM.
   * Keeping the controls visible preserves the 3x2 layout regardless of unlock state.
   * @param {HTMLButtonElement} tabButton - Target stacked tab button.
   * @param {Object} options - State toggles for the tab.
   * @param {boolean} options.unlocked - Whether the associated feature is available.
   * @param {string} [options.lockedLabel='Unknown Spire'] - Accessible label while locked.
   */
  function setStackedTabButtonState(tabButton, { unlocked, lockedLabel = 'Unknown Spire' }) {
    if (!tabButton) {
      return;
    }

    const icon = tabButton.querySelector('.tab-icon');
    if (icon && !tabButton.dataset.unlockedIcon) {
      // Capture the original glyph once so we can restore it when the spire unlocks later in the run.
      tabButton.dataset.unlockedIcon = icon.textContent?.trim() || '';
    }
    if (!tabButton.dataset.unlockedAriaLabel) {
      tabButton.dataset.unlockedAriaLabel = tabButton.getAttribute('aria-label') || '';
    }

    if (icon) {
      icon.textContent = unlocked ? tabButton.dataset.unlockedIcon : '?';
    }

    tabButton.removeAttribute('hidden');
    tabButton.setAttribute('aria-hidden', 'false');
    tabButton.disabled = !unlocked;
    tabButton.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
    tabButton.setAttribute('aria-label', unlocked ? tabButton.dataset.unlockedAriaLabel : lockedLabel);
  }
  /**
   * Update the split powder/fluid tab visibility and associated badges when the Bet Spire Terrarium
   * unlocks or locks. Resource badge visibility depends on the current unlock state.
   */
  function updateFluidTabAvailability() {
    if (!fluidElements.tabStack) {
      // Cache the split tab wrapper so we can toggle stacked layout states when the Bet Spire Terrarium unlocks.
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

    const resourceElements = typeof getResourceElements === 'function' ? getResourceElements() || {} : {};

    if (tabStack) {
      // Keep the stack split so both halves of the powder/fluid control remain visible in the grid.
      tabStack.classList.add('tab-button-stack--split');
      tabStack.classList.remove('tab-button-stack--active');
      tabStack.setAttribute('aria-hidden', 'false');
    }

    setStackedTabButtonState(tabButton, {
      unlocked: Boolean(powderState?.fluidUnlocked),
      lockedLabel: 'Locked Bet Spire',
    });

    if (resourceElements.tabFluidBadge) {
      if (powderState?.fluidUnlocked) {
        resourceElements.tabFluidBadge.removeAttribute('hidden');
        resourceElements.tabFluidBadge.setAttribute('aria-hidden', 'false');
      } else {
        resourceElements.tabFluidBadge.setAttribute('hidden', '');
        resourceElements.tabFluidBadge.setAttribute('aria-hidden', 'true');
      }
    }
  }

  /**
   * Update visibility for all spire tabs based on unlock status.
   */
  function updateSpireTabVisibility() {
    updateFluidTabAvailability();

    const spireStack = document.getElementById('spire-tab-stack');
    if (spireStack) {
      const layoutClasses = [
        'spire-tab-stack--layout-1',
        'spire-tab-stack--layout-2',
        'spire-tab-stack--layout-3',
        'spire-tab-stack--layout-4',
        'spire-tab-stack--layout-5',
        'spire-tab-stack--layout-6',
      ];
      layoutClasses.forEach((className) => spireStack.classList.remove(className));
      spireStack.classList.add('spire-tab-stack--layout-6');
    }

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

    /**
     * Keep the stacked spire tab buttons in sync with the corresponding unlocks so locked
     * spires no longer leak visible icons into the primary tab bar.
     * @param {string} spireId - Identifier suffix for the stacked spire tab.
     * @param {boolean} unlocked - Whether the spire should be visible.
     */
    function syncSpireTabButton(spireId, unlocked) {
      const tabButton = document.getElementById(`tab-${spireId}`);
      if (!tabButton) {
        return;
      }

      setStackedTabButtonState(tabButton, {
        unlocked,
        lockedLabel: 'Unknown Spire',
      });
    }

    const spireConfigs = [
      { id: 'lamed', unlocked: Boolean(spireResourceState?.lamed?.unlocked) },
      { id: 'tsadi', unlocked: Boolean(spireResourceState?.tsadi?.unlocked) },
      { id: 'shin', unlocked: Boolean(spireResourceState?.shin?.unlocked) },
      { id: 'kuf', unlocked: Boolean(spireResourceState?.kuf?.unlocked) },
    ];

    spireConfigs.forEach(({ id, unlocked }) => {
      syncSpireTabButton(id, unlocked);
      syncSpireToggle(id, unlocked);
    });

    // Layout is fixed to the 3x2 grid above, so no additional adjustments are needed here.
  }

  return {
    updateFluidTabAvailability,
    updateSpireTabVisibility,
  };
}
