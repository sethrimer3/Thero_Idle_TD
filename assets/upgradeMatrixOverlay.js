/**
 * Upgrade matrix overlay controller extracted from main.js.
 * Manages DOM bindings, rendering, and accessibility interactions for the
 * upgrade overview panel that lists unlocked towers and their lattice tiers.
 */
export function createUpgradeMatrixOverlay({
  document: documentRef = typeof document !== 'undefined' ? document : null,
  revealOverlay,
  scheduleOverlayHide,
  getTowerDefinitions,
  getTowerDefinition,
  isTowerUnlocked,
  formatGameNumber,
  theroSymbol = 'þ',
} = {}) {
  const state = {
    overlay: null,
    grid: null,
    closeButton: null,
    triggerButtons: [],
    triggerSet: null,
    lastTrigger: null,
  };

  function renderUpgradeMatrix() {
    if (!documentRef || !state.grid) {
      return;
    }

    state.grid.innerHTML = '';
    const fragment = documentRef.createDocumentFragment();

    const definitions = typeof getTowerDefinitions === 'function' ? getTowerDefinitions() : [];
    definitions.forEach((definition) => {
      if (!definition || !definition.id) {
        return;
      }
      if (typeof isTowerUnlocked === 'function' && !isTowerUnlocked(definition.id)) {
        return;
      }

      const row = documentRef.createElement('div');
      row.className = 'upgrade-matrix-row';
      row.setAttribute('role', 'listitem');

      const tier = documentRef.createElement('span');
      tier.className = 'upgrade-matrix-tier';
      tier.textContent = `Tier ${definition.tier}`;

      const name = documentRef.createElement('span');
      name.className = 'upgrade-matrix-name';
      const symbol = documentRef.createElement('span');
      symbol.className = 'upgrade-matrix-symbol';
      symbol.textContent = definition.symbol;
      const title = documentRef.createElement('span');
      title.className = 'upgrade-matrix-title';
      const sanitizedName = typeof definition.name === 'string'
        ? definition.name.replace(/tower/gi, '').replace(/\s{2,}/g, ' ').trim()
        : '';
      title.textContent = sanitizedName || definition.name;
      name.append(symbol, documentRef.createTextNode(' '), title);

      const cost = documentRef.createElement('span');
      cost.className = 'upgrade-matrix-cost';
      const formattedCost = typeof formatGameNumber === 'function'
        ? formatGameNumber(definition.baseCost)
        : definition.baseCost;
      cost.textContent = `${formattedCost} ${theroSymbol}`;

      const nextTier = documentRef.createElement('span');
      nextTier.className = 'upgrade-matrix-next';
      const nextDefinition = definition.nextTierId && typeof getTowerDefinition === 'function'
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

    state.grid.append(fragment);
  }

  function showUpgradeMatrix() {
    if (!state.overlay) {
      return;
    }

    if (typeof revealOverlay === 'function') {
      revealOverlay(state.overlay);
    }
    renderUpgradeMatrix();

    if (!state.lastTrigger || !(state.triggerSet?.has(state.lastTrigger))) {
      const activeElement = documentRef?.activeElement;
      state.lastTrigger = activeElement && typeof activeElement.focus === 'function' ? activeElement : null;
    }

    state.overlay.setAttribute('aria-hidden', 'false');
    if (state.lastTrigger && state.triggerSet?.has(state.lastTrigger)) {
      state.lastTrigger.setAttribute('aria-expanded', 'true');
    }
    if (!state.overlay.classList.contains('active')) {
      requestAnimationFrame(() => {
        state.overlay.classList.add('active');
      });
    }

    const focusTarget = state.closeButton || state.overlay.querySelector('.overlay-panel');
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus();
      return;
    }
    if (typeof state.overlay.focus === 'function') {
      state.overlay.focus();
    }
  }

  function hideUpgradeMatrix() {
    if (!state.overlay) {
      return;
    }

    state.overlay.classList.remove('active');
    state.overlay.setAttribute('aria-hidden', 'true');
    if (typeof scheduleOverlayHide === 'function') {
      scheduleOverlayHide(state.overlay);
    }
    if (state.triggerButtons.length) {
      state.triggerButtons.forEach((button) => {
        if (button) {
          button.setAttribute('aria-expanded', 'false');
        }
      });
    }

    if (state.lastTrigger && typeof state.lastTrigger.focus === 'function') {
      state.lastTrigger.focus();
    }
    state.lastTrigger = null;
  }

  function bindUpgradeMatrix() {
    if (!documentRef) {
      return;
    }

    state.triggerButtons = Array.from(
      documentRef.querySelectorAll('[data-upgrade-matrix-trigger]'),
    );
    state.triggerSet = new WeakSet(state.triggerButtons);
    state.overlay = documentRef.getElementById('upgrade-matrix-overlay');
    state.grid = documentRef.getElementById('upgrade-matrix-grid');
    state.closeButton = state.overlay
      ? state.overlay.querySelector('[data-overlay-close]')
      : null;

    if (state.overlay && !state.overlay.hasAttribute('tabindex')) {
      state.overlay.setAttribute('tabindex', '-1');
    }

    state.triggerButtons.forEach((button) => {
      if (!button) {
        return;
      }
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', () => {
        state.lastTrigger = button;
        showUpgradeMatrix();
      });
    });

    if (state.closeButton) {
      state.closeButton.addEventListener('click', () => {
        hideUpgradeMatrix();
      });
    }

    if (state.overlay) {
      state.overlay.addEventListener('click', (event) => {
        if (event.target === state.overlay) {
          hideUpgradeMatrix();
        }
      });
    }
  }

  function handleKeydown(event, { isLevelOverlayActive = false } = {}) {
    if (!state.overlay || !state.overlay.classList.contains('active')) {
      return false;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      hideUpgradeMatrix();
      return true;
    }

    if ((event.key === 'Enter' || event.key === ' ') && event.target === state.overlay) {
      event.preventDefault();
      hideUpgradeMatrix();
      return true;
    }

    if (!isLevelOverlayActive) {
      return true;
    }

    return false;
  }

  return {
    bindUpgradeMatrix,
    renderUpgradeMatrix,
    hideUpgradeMatrix,
    handleKeydown,
    getOverlayElement: () => state.overlay,
    isOverlayActive: () => Boolean(state.overlay?.classList.contains('active')),
  };
}
