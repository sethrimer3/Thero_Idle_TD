import { GEM_DEFINITIONS, getGemSpriteAssetPath } from './enemies.js';

/**
 * Shared gem selector menu for spire simulations.
 * Renders a top-right slot that opens a dropdown of available gems with counts.
 * Mechanics are stubbed for now; selection state is tracked for future boosts.
 *
 * @param {Object} options
 * @param {Document} [options.documentRef] - Optional document reference for testing.
 * @param {Map} options.moteGemInventory - Inventory map keyed by gem id.
 */
export function createSpireGemMenuController({
  documentRef = typeof document !== 'undefined' ? document : null,
  moteGemInventory,
  gemDefinitions = GEM_DEFINITIONS,
} = {}) {
  if (!documentRef) {
    return null;
  }

  const gemLookup = new Map((gemDefinitions || []).map((gem) => [gem.id, gem]));
  const menuRegistry = new Map();
  const selectionState = new Map();
  let outsideClickBound = false;

  /**
   * Resolve the owned count for a given gem id.
   *
   * @param {string} gemId - Unique gem identifier.
   * @returns {number} Normalized count of owned gems.
   */
  function getGemCount(gemId) {
    if (!gemId || !moteGemInventory || typeof moteGemInventory.get !== 'function') {
      return 0;
    }
    const record = moteGemInventory.get(gemId);
    const total = Number.isFinite(record?.count) ? Math.max(0, Math.floor(record.count)) : 0;
    return total;
  }

  /**
   * Close every open dropdown so taps on the canvas dismiss the list.
   */
  function closeAllMenus() {
    menuRegistry.forEach((menu) => {
      if (!menu) return;
      menu.wrapper.classList.remove('spire-gem-selector--open');
      menu.dropdown.hidden = true;
      menu.dropdown.classList.remove('spire-gem-menu--open');
      menu.slotButton.setAttribute('aria-expanded', 'false');
    });
  }

  /**
   * Close a single menu entry by spire id.
   *
   * @param {string} spireId - Spire identifier.
   */
  function closeMenu(spireId) {
    const menu = menuRegistry.get(spireId);
    if (!menu) {
      return;
    }
    menu.wrapper.classList.remove('spire-gem-selector--open');
    menu.dropdown.hidden = true;
    menu.dropdown.classList.remove('spire-gem-menu--open');
    menu.slotButton.setAttribute('aria-expanded', 'false');
  }

  /**
   * Animate a menu open state.
   *
   * @param {string} spireId - Spire identifier.
   */
  function openMenu(spireId) {
    const menu = menuRegistry.get(spireId);
    if (!menu) {
      return;
    }
    closeAllMenus();
    menu.wrapper.classList.add('spire-gem-selector--open');
    menu.dropdown.hidden = false;
    // Trigger transition after next frame so max-height animation runs.
    requestAnimationFrame(() => {
      // Position the dropdown relative to the viewport so basin overflow does not clip the menu.
      const viewportPadding = 10;
      const slotRect = menu.slotButton.getBoundingClientRect();
      const dropdownWidth = menu.dropdown.offsetWidth || menu.dropdown.getBoundingClientRect().width || 240;
      const maxWidth = Math.max(viewportPadding * 2, Math.min(dropdownWidth, window.innerWidth - viewportPadding * 2));
      const left = Math.min(
        window.innerWidth - viewportPadding - maxWidth,
        Math.max(viewportPadding, slotRect.right - maxWidth),
      );
      const maxHeight = Math.max(220, window.innerHeight - slotRect.bottom - viewportPadding * 2);
      const top = Math.min(slotRect.bottom + viewportPadding, window.innerHeight - viewportPadding - 120);

      menu.dropdown.style.width = `${maxWidth}px`;
      menu.dropdown.style.left = `${left}px`;
      menu.dropdown.style.top = `${top}px`;
      menu.dropdown.style.maxHeight = `${maxHeight}px`;
      menu.dropdown.classList.add('spire-gem-menu--open');
    });
    menu.slotButton.setAttribute('aria-expanded', 'true');
  }

  /**
   * Update slot art and labels to reflect the current selection.
   *
   * @param {string} spireId - Spire identifier.
   */
  function refreshSlot(spireId) {
    const menu = menuRegistry.get(spireId);
    if (!menu) {
      return;
    }
    const selectedGem = selectionState.get(spireId) || null;
    const definition = selectedGem ? gemLookup.get(selectedGem) : null;
    const slotLabel = definition?.name || 'No Gem';

    if (definition?.id) {
      const spritePath = getGemSpriteAssetPath(definition.id);
      if (spritePath) {
        menu.slotImage.src = spritePath;
        menu.slotImage.hidden = false;
        menu.slotPlaceholder.hidden = true;
      } else {
        // Clear the src so empty slots do not show a broken image glyph.
        menu.slotImage.hidden = true;
        menu.slotImage.removeAttribute('src');
        menu.slotPlaceholder.hidden = false;
      }
    } else {
      // Clear the src so empty slots do not show a broken image glyph.
      menu.slotImage.hidden = true;
      menu.slotImage.removeAttribute('src');
      menu.slotPlaceholder.hidden = false;
    }

    menu.slotLabel.textContent = slotLabel;
  }

  /**
   * Select a gem for the provided spire.
   *
   * @param {string} spireId - Spire identifier.
   * @param {string|null} gemId - Selected gem id or null for none.
   */
  function selectGem(spireId, gemId) {
    if (!spireId) {
      return;
    }
    const normalizedGem = gemId || null;
    selectionState.set(spireId, normalizedGem);
    refreshSlot(spireId);
    closeMenu(spireId);
  }

  /**
   * Wire a document-level listener so tapping anywhere closes an open dropdown.
   */
  function ensureOutsideClickHandler() {
    if (outsideClickBound) {
      return;
    }
    documentRef.addEventListener('pointerdown', (event) => {
      const target = event.target;
      const clickedInside = Array.from(menuRegistry.values()).some(
        (menu) => menu && menu.wrapper.contains(target),
      );
      if (!clickedInside) {
        closeAllMenus();
      }
    });
    outsideClickBound = true;
  }

  /**
   * Create a reusable gem option button.
   *
   * @param {Object} option
   * @param {string|null} option.gemId - Gem id for the option.
   * @param {string} option.label - Display label for the option.
   * @returns {HTMLButtonElement} Configured button element.
   */
  function createOptionButton({ gemId, label }) {
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.className = 'spire-gem-option';
    button.dataset.gemId = gemId || '';

    const icon = documentRef.createElement('span');
    icon.className = 'spire-gem-option__icon';
    if (gemId) {
      const spritePath = getGemSpriteAssetPath(gemId);
      if (spritePath) {
        const img = documentRef.createElement('img');
        img.src = spritePath;
        img.alt = '';
        icon.append(img);
      }
    }
    if (!icon.firstChild) {
      icon.textContent = gemId ? '◆' : '◇';
    }

    const name = documentRef.createElement('span');
    name.className = 'spire-gem-option__name';
    name.textContent = label;

    const count = documentRef.createElement('span');
    count.className = 'spire-gem-option__count';
    if (gemId) {
      count.textContent = `×${getGemCount(gemId)}`;
    } else {
      count.textContent = '';
      count.classList.add('spire-gem-option__count--empty');
    }

    button.append(icon, name, count);
    return button;
  }

  /**
   * Build the dropdown options for a given spire menu.
   *
   * @param {string} spireId - Spire identifier.
   */
  function populateMenu(spireId) {
    const menu = menuRegistry.get(spireId);
    if (!menu) {
      return;
    }
    menu.optionsList.textContent = '';
    menu.optionButtons.clear();

    const noneOption = createOptionButton({ gemId: null, label: 'No Gem' });
    noneOption.addEventListener('click', (event) => {
      event.stopPropagation();
      selectGem(spireId, null);
    });
    menu.optionButtons.set('none', noneOption);
    menu.optionsList.appendChild(noneOption);

    gemDefinitions.forEach((gem) => {
      const option = createOptionButton({ gemId: gem.id, label: gem.name || gem.id });
      option.addEventListener('click', (event) => {
        event.stopPropagation();
        selectGem(spireId, gem.id);
      });
      menu.optionButtons.set(gem.id, option);
      menu.optionsList.appendChild(option);
    });

    const closeOption = documentRef.createElement('button');
    closeOption.type = 'button';
    closeOption.className = 'spire-gem-option spire-gem-option--close';
    closeOption.innerHTML = '<span class="spire-gem-option__icon" aria-hidden="true">↑</span><span class="spire-gem-option__name">Close</span><span class="spire-gem-option__count" aria-hidden="true">Tap anywhere</span>';
    closeOption.addEventListener('click', (event) => {
      event.stopPropagation();
      closeMenu(spireId);
    });
    menu.optionsList.appendChild(closeOption);
  }

  /**
   * Attach the gem selector UI to a spire basin.
   *
   * @param {Object} params
   * @param {string} params.spireId - Spire identifier.
   * @param {HTMLElement} params.hostElement - Container that will host the selector.
   */
  function registerMenu({ spireId, hostElement }) {
    if (!spireId || !hostElement || menuRegistry.has(spireId)) {
      return;
    }
    const wrapper = documentRef.createElement('div');
    wrapper.className = 'spire-gem-selector';
    wrapper.dataset.spireId = spireId;

    const slotButton = documentRef.createElement('button');
    slotButton.type = 'button';
    slotButton.className = 'spire-gem-selector__slot';
    slotButton.setAttribute('aria-expanded', 'false');
    slotButton.setAttribute('aria-label', 'Select gem for spire');

    const slotArt = documentRef.createElement('span');
    slotArt.className = 'spire-gem-selector__slot-art';
    const slotImage = documentRef.createElement('img');
    slotImage.className = 'spire-gem-selector__slot-image';
    slotImage.alt = '';
    slotImage.hidden = true;
    const slotPlaceholder = documentRef.createElement('span');
    slotPlaceholder.className = 'spire-gem-selector__slot-placeholder';
    slotPlaceholder.textContent = '◇';
    slotArt.append(slotImage, slotPlaceholder);

    const slotLabel = documentRef.createElement('span');
    slotLabel.className = 'spire-gem-selector__slot-label';
    slotLabel.textContent = 'No Gem';

    slotButton.append(slotArt, slotLabel);
    slotButton.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = wrapper.classList.contains('spire-gem-selector--open');
      if (isOpen) {
        closeMenu(spireId);
      } else {
        openMenu(spireId);
      }
    });

    const dropdown = documentRef.createElement('div');
    dropdown.className = 'spire-gem-menu';
    dropdown.hidden = true;

    const optionsList = documentRef.createElement('div');
    optionsList.className = 'spire-gem-menu__list';
    dropdown.appendChild(optionsList);

    wrapper.append(slotButton, dropdown);
    hostElement.appendChild(wrapper);

    menuRegistry.set(spireId, {
      wrapper,
      slotButton,
      slotImage,
      slotPlaceholder,
      slotLabel,
      dropdown,
      optionsList,
      optionButtons: new Map(),
    });

    populateMenu(spireId);
    refreshSlot(spireId);
    ensureOutsideClickHandler();
  }

  /**
   * Refresh displayed counts for every registered menu.
   */
  function updateCounts() {
    menuRegistry.forEach((menu) => {
      menu.optionButtons.forEach((button, key) => {
        if (!button) return;
        if (key === 'none') {
          const countElement = button.querySelector('.spire-gem-option__count');
          if (countElement) {
            countElement.textContent = '';
            countElement.classList.add('spire-gem-option__count--empty');
          }
          return;
        }
        const count = getGemCount(key);
        const countElement = button.querySelector('.spire-gem-option__count');
        if (countElement) {
          countElement.textContent = `×${count}`;
        }
        button.classList.toggle('spire-gem-option--depleted', count === 0);
      });
    });
  }

  /**
   * Read the selected gem id for a spire.
   *
   * @param {string} spireId - Spire identifier.
   * @returns {string|null} Selected gem id or null when empty.
   */
  function getSelection(spireId) {
    return selectionState.get(spireId) || null;
  }

  return {
    registerMenu,
    closeAllMenus,
    closeMenu,
    updateCounts,
    getSelection,
  };
}
