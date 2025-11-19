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
     * Reflow the spire tab grid so only unlocked tabs consume space.
     * The layout adapts from single button up to the full 3x2 grid.
     */
    function applySpireStackLayout() {
      const spireStack = document.getElementById('spire-tab-stack');
      if (!spireStack) {
        return;
      }

      const layoutClasses = [
        'spire-tab-stack--layout-1',
        'spire-tab-stack--layout-2',
        'spire-tab-stack--layout-3',
        'spire-tab-stack--layout-4',
        'spire-tab-stack--layout-5',
        'spire-tab-stack--layout-6',
      ];

      layoutClasses.forEach((className) => spireStack.classList.remove(className));

      const visibleButtons = Array.from(
        spireStack.querySelectorAll('.tab-button--stacked')
      ).filter(
        (button) => !button.hasAttribute('hidden') && button.getAttribute('aria-hidden') !== 'true'
      );

      visibleButtons.forEach((button) => {
        button.style.gridColumn = '';
        button.style.gridRow = '';
        button.classList.remove('spire-tab-button--tall');
      });

      const visibleCount = visibleButtons.length;
      if (visibleCount === 0) {
        return;
      }

      spireStack.classList.add(`spire-tab-stack--layout-${visibleCount}`);

      if (visibleCount === 1) {
        // Center the lone spire tab within the available button footprint.
        visibleButtons[0].style.gridColumn = '1 / -1';
        visibleButtons[0].style.gridRow = '1 / -1';
        return;
      }

      if (visibleCount === 5) {
        // Keep a clean 2x2 square for the first four spires and stretch the fifth vertically on the right.
        const squarePlacements = [
          { col: 1, row: 1 },
          { col: 2, row: 1 },
          { col: 1, row: 2 },
          { col: 2, row: 2 },
        ];

        squarePlacements.forEach((placement, index) => {
          const target = visibleButtons[index];
          if (target) {
            target.style.gridColumn = `${placement.col}`;
            target.style.gridRow = `${placement.row}`;
          }
        });

        const tallButton = visibleButtons[4];
        tallButton.style.gridColumn = '3';
        tallButton.style.gridRow = '1 / span 2';
        tallButton.classList.add('spire-tab-button--tall');
      }
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

      if (unlocked) {
        tabButton.removeAttribute('hidden');
        tabButton.setAttribute('aria-hidden', 'false');
        tabButton.disabled = false;
      } else {
        tabButton.setAttribute('hidden', '');
        tabButton.setAttribute('aria-hidden', 'true');
        tabButton.disabled = true;
      }
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

    // Rebuild the layout so only visible spires consume space in the stack grid.
    applySpireStackLayout();
  }

  return {
    updateFluidTabAvailability,
    updateSpireTabVisibility,
  };
}
