// Tab lock manager for controlling tab access based on tutorial completion.

import {
  isTowersTabUnlocked,
  isCodexUnlocked,
  isAchievementsUnlocked,
} from './tutorialState.js';

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
 * Tabs can be unlocked either by completing the tutorial or by individual unlock triggers.
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

  // Towers tab: unlocked if tutorial completed OR if individually unlocked via entering first level
  const towersTab = document.getElementById('tab-towers');
  if (towersTab) {
    setTabButtonState(towersTab, {
      unlocked: tutorialCompleted || isTowersTabUnlocked(),
      lockedLabel: 'Locked - Complete Tutorial',
    });
  }

  // Achievements tab: unlocked if tutorial completed OR if individually unlocked
  const achievementsTab = document.getElementById('tab-achievements');
  if (achievementsTab) {
    setTabButtonState(achievementsTab, {
      unlocked: tutorialCompleted || isAchievementsUnlocked(),
      lockedLabel: 'Locked - Complete Tutorial',
    });
  }

  // Codex (options) tab: unlocked if tutorial completed OR if individually unlocked
  const codexTab = document.getElementById('tab-options');
  if (codexTab) {
    setTabButtonState(codexTab, {
      unlocked: tutorialCompleted || isCodexUnlocked(),
      lockedLabel: 'Locked - Complete Tutorial',
    });
  }

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

/**
 * Unlock the Codex tab.
 */
export function unlockCodexTab() {
  const codexTab = document.getElementById('tab-options');
  if (codexTab) {
    setTabButtonState(codexTab, {
      unlocked: true,
    });
  }
}

/**
 * Unlock the Achievements tab.
 */
export function unlockAchievementsTab() {
  const achievementsTab = document.getElementById('tab-achievements');
  if (achievementsTab) {
    setTabButtonState(achievementsTab, {
      unlocked: true,
    });
  }
}

/**
 * Unlock the Towers tab.
 */
export function unlockTowersTab() {
  const towersTab = document.getElementById('tab-towers');
  if (towersTab) {
    setTabButtonState(towersTab, {
      unlocked: true,
    });
  }
}
