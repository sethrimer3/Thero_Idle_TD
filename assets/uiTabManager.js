// Provides shared helpers for managing the primary UI tab collection.
const tabHotkeys = new Map([
  ['1', 'tower'],
  ['2', 'towers'],
  ['3', 'powder'],
  ['4', 'fluid'],
  ['5', 'achievements'],
  ['6', 'options'],
]);

let tabs = [];
let panels = [];
let activeTabId = 'tower';
let activeTabIndex = 0;
let isOverlayActive = () => false;
let isFieldNotesOverlayVisible = () => false;
let onTabChange = null;
let onTowerTabActivated = null;
let playTabSelectSfx = null;
let shortcutsBound = false;

// Stores provided callbacks used to keep external systems in sync with tab state.
export function configureTabManager({
  getOverlayActiveState,
  isFieldNotesOverlayVisible: fieldNotesOverlayFn,
  onTabChange: tabChangeFn,
  onTowerTabActivated: towerTabFn,
  playTabSelectSfx: playSfxFn,
} = {}) {
  isOverlayActive =
    typeof getOverlayActiveState === 'function'
      ? getOverlayActiveState
      : () => Boolean(getOverlayActiveState);
  isFieldNotesOverlayVisible =
    typeof fieldNotesOverlayFn === 'function'
      ? fieldNotesOverlayFn
      : () => Boolean(fieldNotesOverlayFn);
  onTabChange = typeof tabChangeFn === 'function' ? tabChangeFn : null;
  onTowerTabActivated = typeof towerTabFn === 'function' ? towerTabFn : null;
  playTabSelectSfx = typeof playSfxFn === 'function' ? playSfxFn : null;
}

// Returns the current active tab identifier so other systems can query it lazily.
export function getActiveTabId() {
  return activeTabId;
}

// Lazily queries the DOM for tab buttons and panel containers when needed.
function ensureTabCollections() {
  if (!tabs.length) {
    tabs = Array.from(document.querySelectorAll('.tab-button'));
  }
  if (!panels.length) {
    panels = Array.from(document.querySelectorAll('.panel'));
  }
}

// Determine whether a tab button is visible and interactive for the player.
function isTabAccessible(tab) {
  if (!tab) {
    return false;
  }
  if (tab.disabled) {
    return false;
  }
  if (tab.hasAttribute('hidden')) {
    return false;
  }
  const ariaHidden = tab.getAttribute('aria-hidden');
  if (ariaHidden && ariaHidden !== 'false') {
    return false;
  }
  return true;
}

// Guards against reacting to keyboard shortcuts while a text input is focused.
function isTextInput(element) {
  if (!element) return false;
  const tagName = element.tagName ? element.tagName.toLowerCase() : '';
  return (
    element.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select'
  );
}

// Notifies registered callbacks whenever the active tab changes.
function notifyTabChange(tabId, { matched } = { matched: false }) {
  if (matched && tabId === 'tower' && typeof onTowerTabActivated === 'function') {
    onTowerTabActivated();
  }
  if (typeof onTabChange === 'function') {
    onTabChange(tabId);
  }
}

// Applies focus management and aria states whenever a tab becomes active.
export function setActiveTab(target) {
  if (typeof document === 'undefined') {
    return;
  }

  const targetTabElement = document.querySelector(`.tab-button[data-tab='${target}']`);
  if (!isTabAccessible(targetTabElement)) {
    return;
  }

  ensureTabCollections();

  if (!tabs.length || !panels.length) {
    const allTabs = Array.from(document.querySelectorAll('.tab-button'));
    const allPanels = Array.from(document.querySelectorAll('.panel'));

    allTabs.forEach((tab, index) => {
      const isActive = tab.dataset.tab === target;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
      if (isActive) {
        activeTabIndex = index;
      }
    });

    allPanels.forEach((panel) => {
      const isActive = panel.dataset.panel === target;
      panel.classList.toggle('active', isActive);
      panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      if (isActive) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });

    if (!tabs.length) {
      tabs = allTabs;
    }
    if (!panels.length) {
      panels = allPanels;
    }

    const activeTab = allTabs.find((tab) => tab.classList.contains('active'));
    if (activeTab) {
      activeTabId = activeTab.dataset.tab || activeTabId;
      const matched = activeTabId === target;
      notifyTabChange(activeTabId, { matched });
    }

    return;
  }

  let matchedTab = false;

  tabs.forEach((tab, index) => {
    const isActive = tab.dataset.tab === target;
    if (isActive) {
      tab.classList.add('active');
      tab.setAttribute('aria-pressed', 'true');
      tab.setAttribute('aria-selected', 'true');
      tab.setAttribute('tabindex', '0');
      activeTabIndex = index;
      matchedTab = true;
    } else {
      tab.classList.remove('active');
      tab.setAttribute('aria-pressed', 'false');
      tab.setAttribute('aria-selected', 'false');
      tab.setAttribute('tabindex', '-1');
    }
  });

  panels.forEach((panel) => {
    const isActive = panel.dataset.panel === target;
    if (isActive) {
      panel.classList.add('active');
      panel.setAttribute('aria-hidden', 'false');
      panel.removeAttribute('hidden');
    } else {
      panel.classList.remove('active');
      panel.setAttribute('aria-hidden', 'true');
      panel.setAttribute('hidden', '');
    }
  });

  if (matchedTab) {
    activeTabId = target;
    notifyTabChange(activeTabId, { matched: true });
  }
}

// Focuses the requested tab button and propagates selection state updates.
function focusAndActivateTab(index, direction = 0) {
  if (!tabs.length) return;
  const totalTabs = tabs.length;
  if (totalTabs === 0) {
    return;
  }

  let normalizedIndex = ((index % totalTabs) + totalTabs) % totalTabs;
  let targetTab = tabs[normalizedIndex];
  if (isTabAccessible(targetTab)) {
    setActiveTab(targetTab.dataset.tab);
    targetTab.focus();
    return;
  }

  const step = direction > 0 ? 1 : direction < 0 ? -1 : 0;
  if (step === 0) {
    return;
  }

  for (let attempt = 0; attempt < totalTabs - 1; attempt++) {
    normalizedIndex = ((normalizedIndex + step) % totalTabs + totalTabs) % totalTabs;
    targetTab = tabs[normalizedIndex];
    if (isTabAccessible(targetTab)) {
      setActiveTab(targetTab.dataset.tab);
      targetTab.focus();
      return;
    }
  }
}

// Binds left/right arrow navigation and direct hotkeys once per session.
function bindKeyboardNavigation() {
  if (shortcutsBound) {
    return;
  }

  const handleArrowNavigation = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    if (!tabs.length) return;
    if (isOverlayActive()) return;
    if (isFieldNotesOverlayVisible()) return;
    if (isTextInput(event.target)) return;

    const direction = event.key === 'ArrowRight' ? 1 : -1;
    event.preventDefault();
    focusAndActivateTab(activeTabIndex + direction, direction);
  };

  const handleTabHotkey = (event) => {
    if (!tabs.length) return;
    if (isOverlayActive()) return;
    if (isFieldNotesOverlayVisible()) return;
    if (isTextInput(event.target)) return;

    const targetTabId = tabHotkeys.get(event.key);
    if (!targetTabId) return;

    event.preventDefault();
    setActiveTab(targetTabId);
    if (playTabSelectSfx) {
      playTabSelectSfx();
    }
    const tabToFocus = tabs.find((tab) => tab.dataset.tab === targetTabId);
    if (tabToFocus) {
      tabToFocus.focus();
    }
  };

  document.addEventListener('keydown', handleArrowNavigation);
  document.addEventListener('keydown', handleTabHotkey);
  shortcutsBound = true;
}

// Initializes tab button event bindings and synchronizes panel visibility.
export function initializeTabs() {
  tabs = Array.from(document.querySelectorAll('.tab-button'));
  panels = Array.from(document.querySelectorAll('.panel'));

  if (!tabs.length || !panels.length) {
    return;
  }

  const existingActiveIndex = tabs.findIndex((tab) => tab.classList.contains('active'));
  activeTabIndex = existingActiveIndex >= 0 ? existingActiveIndex : 0;

  tabs.forEach((tab, index) => {
    if (!tab.getAttribute('type')) {
      tab.setAttribute('type', 'button');
    }

    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      if (!target) {
        return;
      }
      setActiveTab(target);
      if (playTabSelectSfx) {
        playTabSelectSfx();
      }
      tab.focus();
    });

    tab.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (playTabSelectSfx) {
          playTabSelectSfx();
        }
        focusAndActivateTab(index, 0);
      }
    });
  });

  panels.forEach((panel) => {
    const isActive = panel.classList.contains('active');
    panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    if (!isActive) {
      panel.setAttribute('hidden', '');
    }
  });

  const initialTab = tabs[activeTabIndex];
  if (initialTab) {
    setActiveTab(initialTab.dataset.tab);
  }

  bindKeyboardNavigation();
}
