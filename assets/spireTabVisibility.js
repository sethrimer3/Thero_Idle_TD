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
   * Update the split powder/fluid tab visibility and associated badges when the fluid study
   * unlocks or locks. Resource badge visibility depends on the current unlock state.
   */
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

    const resourceElements = typeof getResourceElements === 'function' ? getResourceElements() || {} : {};

    if (powderState?.fluidUnlocked) {
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
   * Update visibility for all spire tabs based on unlock status.
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
      if (spireResourceState?.lamed?.unlocked) {
        lamedTab.removeAttribute('hidden');
        lamedTab.setAttribute('aria-hidden', 'false');
        lamedTab.disabled = false;
      } else {
        lamedTab.setAttribute('hidden', '');
        lamedTab.setAttribute('aria-hidden', 'true');
        lamedTab.disabled = true;
      }
    }
    syncSpireToggle('lamed', Boolean(spireResourceState?.lamed?.unlocked));

    // Update Tsadi tab
    const tsadiTab = document.getElementById('tab-tsadi');
    if (tsadiTab) {
      if (spireResourceState?.tsadi?.unlocked) {
        tsadiTab.removeAttribute('hidden');
        tsadiTab.setAttribute('aria-hidden', 'false');
        tsadiTab.disabled = false;
      } else {
        tsadiTab.setAttribute('hidden', '');
        tsadiTab.setAttribute('aria-hidden', 'true');
        tsadiTab.disabled = true;
      }
    }
    syncSpireToggle('tsadi', Boolean(spireResourceState?.tsadi?.unlocked));

    // Update Shin tab
    const shinTab = document.getElementById('tab-shin');
    if (shinTab) {
      if (spireResourceState?.shin?.unlocked) {
        shinTab.removeAttribute('hidden');
        shinTab.setAttribute('aria-hidden', 'false');
        shinTab.disabled = false;
      } else {
        shinTab.setAttribute('hidden', '');
        shinTab.setAttribute('aria-hidden', 'true');
        shinTab.disabled = true;
      }
    }
    syncSpireToggle('shin', Boolean(spireResourceState?.shin?.unlocked));

    // Update Kuf tab
    const kufTab = document.getElementById('tab-kuf');
    if (kufTab) {
      if (spireResourceState?.kuf?.unlocked) {
        kufTab.removeAttribute('hidden');
        kufTab.setAttribute('aria-hidden', 'false');
        kufTab.disabled = false;
      } else {
        kufTab.setAttribute('hidden', '');
        kufTab.setAttribute('aria-hidden', 'true');
        kufTab.disabled = true;
      }
    }
    syncSpireToggle('kuf', Boolean(spireResourceState?.kuf?.unlocked));
  }

  return {
    updateFluidTabAvailability,
    updateSpireTabVisibility,
  };
}
