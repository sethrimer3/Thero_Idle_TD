// Tab lock manager for controlling tab access based on tutorial completion.

/**
 * Set tab button locked or unlocked state.
 * @param {HTMLButtonElement} tabButton - Target tab button.
 * @param {Object} options - State toggles for the tab.
 * @param {boolean} options.unlocked - Whether the tab should be accessible.
 * @param {string} [options.lockedLabel='Locked'] - Accessible label while locked.
 */
function setTabButtonState(tabButton, { unlocked, lockedLabel = 'Locked' }) {
  if (!tabButton) {
    return;
  }

  const icon = tabButton.querySelector('.tab-icon');
  if (icon && !tabButton.dataset.unlockedIcon) {
    // Capture the original icon once so we can restore it when unlocked
    tabButton.dataset.unlockedIcon = icon.textContent?.trim() || '';
  }
  if (!tabButton.dataset.unlockedAriaLabel) {
    tabButton.dataset.unlockedAriaLabel = tabButton.getAttribute('aria-label') || '';
  }

  if (icon) {
    icon.textContent = unlocked ? tabButton.dataset.unlockedIcon : '?';
  }

  tabButton.disabled = !unlocked;
  tabButton.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
  tabButton.setAttribute('aria-label', unlocked ? tabButton.dataset.unlockedAriaLabel : lockedLabel);
}

/**
 * Update tab lock states based on tutorial completion.
 * @param {boolean} tutorialCompleted - Whether the tutorial has been completed.
 */
export function updateTabLockStates(tutorialCompleted) {
  // Stage tab is always unlocked
  const stageTab = document.getElementById('tab-tower');
  if (stageTab) {
    setTabButtonState(stageTab, {
      unlocked: true,
    });
  }

  // All other main tabs are locked until tutorial is complete
  const lockedTabs = [
    { id: 'tab-towers', label: 'Locked - Complete Tutorial' },
    { id: 'tab-achievements', label: 'Locked - Complete Tutorial' },
    { id: 'tab-options', label: 'Locked - Complete Tutorial' },
  ];

  lockedTabs.forEach(({ id, label }) => {
    const tabButton = document.getElementById(id);
    if (tabButton) {
      setTabButtonState(tabButton, {
        unlocked: tutorialCompleted,
        lockedLabel: label,
      });
    }
  });

  // Lock Aleph spire (powder tab) until tutorial is complete
  // Other spires will be handled by spireTabVisibility based on their unlock status
  const powderTab = document.getElementById('tab-powder');
  if (powderTab) {
    setTabButtonState(powderTab, {
      unlocked: tutorialCompleted,
      lockedLabel: 'Locked - Complete Tutorial',
    });
  }

  // Only lock other spire tabs at the tutorial level if tutorial not complete
  // Otherwise let the spire system handle their individual locks
  if (!tutorialCompleted) {
    const spireTabs = ['fluid', 'lamed', 'tsadi', 'shin', 'kuf'];
    spireTabs.forEach((spireId) => {
      const tabButton = document.getElementById(`tab-${spireId}`);
      if (tabButton) {
        setTabButtonState(tabButton, {
          unlocked: false,
          lockedLabel: 'Locked - Complete Tutorial',
        });
      }
    });
  }
}

/**
 * Initialize tab lock states on page load.
 * @param {boolean} tutorialCompleted - Whether the tutorial has been completed.
 */
export function initializeTabLockStates(tutorialCompleted) {
  updateTabLockStates(tutorialCompleted);
}
