/**
 * Factory that encapsulates the Towers tab equipment slot DOM bindings.
 *
 * The bindings were originally embedded in `assets/towersTab.js`, which made
 * the already-large file responsible for rendering menus, reacting to crafted
 * equipment updates, and tracking pointer/key listeners. Extracting the logic
 * keeps the equipment wiring isolated so future UI changes can iterate without
 * reopening the rest of the Towers tab orchestrator.
 */
export function createTowerEquipmentBindings({
  equipmentUiState,
  towerCardSelector = '.card[data-tower-id]',
  getTowerSourceLabel,
  getTowerEquipment,
  getTowerEquipmentId,
  getCraftedEquipment,
  getEquipmentAssignment,
  assignEquipmentToTower,
  clearTowerEquipment,
  addEquipmentStateListener,
} = {}) {
  const EMPTY_EQUIPMENT_SYMBOL = '∅'; // Symbol displayed when no equipment is attached.
  const state = equipmentUiState || {
    slots: new Map(),
    activeTowerId: null,
    unsubscribe: null,
    closeHandlersBound: false,
    documentListenerBound: false,
  };

  const safeGetTowerSourceLabel = (towerId) => {
    if (typeof getTowerSourceLabel === 'function') {
      return getTowerSourceLabel(towerId);
    }
    if (typeof towerId === 'string' && towerId.trim()) {
      return towerId.trim();
    }
    return 'tower';
  };

  const safeGetTowerEquipment = (towerId) =>
    (typeof getTowerEquipment === 'function' ? getTowerEquipment(towerId) : null);
  const safeGetTowerEquipmentId = (towerId) =>
    (typeof getTowerEquipmentId === 'function' ? getTowerEquipmentId(towerId) : null);
  const safeGetCraftedEquipment = () =>
    (typeof getCraftedEquipment === 'function' ? getCraftedEquipment() : []);
  const safeGetEquipmentAssignment = (equipmentId) =>
    (typeof getEquipmentAssignment === 'function' ? getEquipmentAssignment(equipmentId) : null);
  const safeAssignEquipmentToTower = (equipmentId, towerId) => {
    if (typeof assignEquipmentToTower === 'function') {
      assignEquipmentToTower(equipmentId, towerId);
    }
  };
  const safeClearTowerEquipment = (towerId) => {
    if (typeof clearTowerEquipment === 'function') {
      clearTowerEquipment(towerId);
    }
  };
  const safeAddEquipmentStateListener = (listener) => {
    if (typeof addEquipmentStateListener === 'function') {
      return addEquipmentStateListener(listener);
    }
    return null;
  };

  /**
   * Return the cached slot record for a tower so updates are centralized.
   */
  function getEquipmentSlotRecord(towerId) {
    return state.slots.get(towerId) || null;
  }

  /**
   * Build the DOM structure for a tower's equipment slot and bind click/keydown
   * handlers for the button that toggles the selection menu.
   */
  function createTowerEquipmentSlot(towerId, card) {
    if (state.slots.has(towerId) || typeof document === 'undefined') {
      return;
    }

    const container = document.createElement('div');
    container.className = 'tower-equipment-slot';
    container.dataset.towerId = towerId;
    container.dataset.menuOpen = 'false';

    const baseLabel = safeGetTowerSourceLabel(towerId);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tower-equipment-button';
    button.dataset.towerEquipmentButton = towerId;
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', `Select equipment for ${baseLabel}`);
    button.title = `Empty slot for ${baseLabel}`;

    const icon = document.createElement('span');
    icon.className = 'tower-equipment-button__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = EMPTY_EQUIPMENT_SYMBOL;
    button.append(icon);

    const caption = document.createElement('span');
    caption.className = 'tower-equipment-slot__caption';
    caption.textContent = 'Empty';

    const menu = document.createElement('div');
    menu.className = 'tower-equipment-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-hidden', 'true');
    menu.hidden = true;
    menu.dataset.towerEquipmentMenu = towerId;

    const list = document.createElement('ul');
    list.className = 'tower-equipment-menu__list';
    menu.append(list);

    container.append(button, caption, menu);

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleTowerEquipmentMenu(towerId);
    });

    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleTowerEquipmentMenu(towerId);
      }
    });

    menu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        closeTowerEquipmentMenu({ restoreFocus: true });
      }
    });

    const slotRecord = {
      container,
      button,
      icon,
      name: caption,
      menu,
      list,
      baseLabel,
    };

    state.slots.set(towerId, slotRecord);

    const equipButton = card.querySelector('.tower-equip-button');
    if (equipButton?.parentNode) {
      equipButton.parentNode.insertBefore(container, equipButton);
    } else {
      const footer = card.querySelector('.card-footer');
      if (footer?.parentNode) {
        footer.parentNode.insertBefore(container, footer);
      } else {
        card.append(container);
      }
    }

    updateTowerEquipmentSlot(towerId);
  }

  /**
   * Ensure every rendered tower card owns a matching equipment slot.
   */
  function ensureTowerEquipmentSlots() {
    if (typeof document === 'undefined') {
      return;
    }
    const cards = document.querySelectorAll(towerCardSelector);
    cards.forEach((card) => {
      if (!(card instanceof HTMLElement)) {
        return;
      }
      const towerId = card.dataset.towerId;
      if (!towerId) {
        return;
      }
      createTowerEquipmentSlot(towerId, card);
    });
  }

  /**
   * Refresh the visual state for a single slot (symbol, caption, ARIA labels).
   */
  function updateTowerEquipmentSlot(towerId) {
    const slot = getEquipmentSlotRecord(towerId);
    if (!slot) {
      return;
    }
    const equipment = safeGetTowerEquipment(towerId);
    if (equipment) {
      const displaySymbol = equipment.symbol || equipment.name?.charAt(0) || '?';
      slot.container.dataset.filled = 'true';
      slot.icon.textContent = displaySymbol;
      slot.name.textContent = equipment.name;
      slot.button.setAttribute('aria-label', `Change equipment for ${slot.baseLabel} (${equipment.name})`);
      slot.button.title = `${equipment.name} equipped to ${slot.baseLabel}`;
    } else {
      slot.container.dataset.filled = 'false';
      slot.icon.textContent = EMPTY_EQUIPMENT_SYMBOL;
      slot.name.textContent = 'Empty';
      slot.button.setAttribute('aria-label', `Select equipment for ${slot.baseLabel}`);
      slot.button.title = `Empty slot for ${slot.baseLabel}`;
    }
  }

  /**
   * Build the button used inside the dropdown menu for each equipment entry.
   */
  function createEquipmentMenuButton(towerId, equipment) {
    if (typeof document === 'undefined') {
      return null;
    }
    const item = document.createElement('li');
    item.className = 'tower-equipment-menu__item-wrapper';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tower-equipment-menu__item';
    button.dataset.equipmentOption = equipment ? equipment.id : 'empty';
    button.setAttribute('role', 'option');

    if (!equipment) {
      button.textContent = 'Empty Slot';
      const assignedId = safeGetTowerEquipmentId(towerId);
      button.setAttribute('aria-selected', assignedId ? 'false' : 'true');
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        safeClearTowerEquipment(towerId);
        closeTowerEquipmentMenu({ restoreFocus: true });
      });
      item.append(button);
      return item;
    }

    const symbol = document.createElement('span');
    symbol.className = 'tower-equipment-menu__symbol';
    symbol.textContent = equipment.symbol || equipment.name?.charAt(0) || '?';
    symbol.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'tower-equipment-menu__label';
    label.textContent = equipment.name;

    button.append(symbol, label);

    const assignmentId = safeGetEquipmentAssignment(equipment.id);
    const assignedHere = assignmentId === towerId;
    button.setAttribute('aria-selected', assignedHere ? 'true' : 'false');

    if (assignmentId && assignmentId !== towerId) {
      const note = document.createElement('span');
      note.className = 'tower-equipment-menu__note';
      note.textContent = `Equipped to ${safeGetTowerSourceLabel(assignmentId)}`;
      button.append(note);
    }

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      safeAssignEquipmentToTower(equipment.id, towerId);
      closeTowerEquipmentMenu({ restoreFocus: true });
    });

    item.append(button);
    return item;
  }

  /**
   * Populate the open dropdown with the latest crafted equipment list.
   */
  function populateTowerEquipmentMenu(towerId) {
    const slot = getEquipmentSlotRecord(towerId);
    if (!slot || typeof document === 'undefined') {
      return;
    }
    slot.list.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const emptyItem = createEquipmentMenuButton(towerId, null);
    if (emptyItem) {
      fragment.append(emptyItem);
    }

    const craftedEquipment = safeGetCraftedEquipment();
    if (!craftedEquipment.length) {
      const emptyNote = document.createElement('li');
      emptyNote.className = 'tower-equipment-menu__empty';
      emptyNote.textContent = 'No crafted equipment available.';
      fragment.append(emptyNote);
    } else {
      craftedEquipment.forEach((equipment) => {
        const entry = createEquipmentMenuButton(towerId, equipment);
        if (entry) {
          fragment.append(entry);
        }
      });
    }

    slot.list.append(fragment);
  }

  /**
   * Close the menu when a pointer presses outside of the active slot.
   */
  function handleEquipmentPointerDown(event) {
    const activeTowerId = state.activeTowerId;
    if (!activeTowerId) {
      return;
    }
    const slot = getEquipmentSlotRecord(activeTowerId);
    if (!slot) {
      closeTowerEquipmentMenu();
      return;
    }
    if (slot.container.contains(event.target)) {
      return;
    }
    closeTowerEquipmentMenu();
  }

  /**
   * Close the menu when the user presses Escape anywhere in the document.
   */
  function handleEquipmentKeyDown(event) {
    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault();
      closeTowerEquipmentMenu({ restoreFocus: true });
    }
  }

  /**
   * Attach global listeners so menus close when the player interacts elsewhere.
   */
  function bindEquipmentCloseHandlers() {
    if (state.closeHandlersBound || typeof document === 'undefined') {
      return;
    }
    document.addEventListener('pointerdown', handleEquipmentPointerDown, true);
    document.addEventListener('keydown', handleEquipmentKeyDown, true);
    state.closeHandlersBound = true;
  }

  /**
   * Remove the document-level listeners to avoid leaks when no menu is open.
   */
  function unbindEquipmentCloseHandlers() {
    if (!state.closeHandlersBound || typeof document === 'undefined') {
      return;
    }
    document.removeEventListener('pointerdown', handleEquipmentPointerDown, true);
    document.removeEventListener('keydown', handleEquipmentKeyDown, true);
    state.closeHandlersBound = false;
  }

  /**
   * Open the dropdown menu for a specific tower and focus the first option.
   */
  function openTowerEquipmentMenu(towerId) {
    const slot = getEquipmentSlotRecord(towerId);
    if (!slot) {
      return;
    }
    populateTowerEquipmentMenu(towerId);
    slot.menu.hidden = false;
    slot.menu.setAttribute('aria-hidden', 'false');
    slot.container.dataset.menuOpen = 'true';
    slot.button.setAttribute('aria-expanded', 'true');
    state.activeTowerId = towerId;
    bindEquipmentCloseHandlers();

    const firstOption = slot.menu.querySelector('[data-equipment-option]');
    if (firstOption && typeof firstOption.focus === 'function') {
      firstOption.focus({ preventScroll: true });
    }
  }

  /**
   * Hide the currently open dropdown and optionally restore focus to the button.
   */
  function closeTowerEquipmentMenu({ restoreFocus = false } = {}) {
    const activeTowerId = state.activeTowerId;
    if (!activeTowerId) {
      return;
    }
    const slot = getEquipmentSlotRecord(activeTowerId);
    state.activeTowerId = null;
    if (slot) {
      slot.menu.hidden = true;
      slot.menu.setAttribute('aria-hidden', 'true');
      slot.container.dataset.menuOpen = 'false';
      slot.button.setAttribute('aria-expanded', 'false');
      if (restoreFocus && typeof slot.button.focus === 'function') {
        slot.button.focus({ preventScroll: true });
      }
    }
    unbindEquipmentCloseHandlers();
  }

  /**
   * Toggle the dropdown for a tower. Clicking the same slot twice closes it.
   */
  function toggleTowerEquipmentMenu(towerId) {
    if (state.activeTowerId === towerId) {
      closeTowerEquipmentMenu({ restoreFocus: true });
      return;
    }
    closeTowerEquipmentMenu();
    openTowerEquipmentMenu(towerId);
  }

  /**
   * Refresh the slot display plus menu contents whenever equipment changes.
   */
  function handleEquipmentStateUpdate() {
    state.slots.forEach((_, towerId) => {
      updateTowerEquipmentSlot(towerId);
    });
    const activeTowerId = state.activeTowerId;
    if (activeTowerId) {
      populateTowerEquipmentMenu(activeTowerId);
    }
  }

  /**
   * Sync slots with unlock events so newly visible cards gain equipment controls.
   */
  function handleTowerUnlocked() {
    ensureTowerEquipmentSlots();
    handleEquipmentStateUpdate();
  }

  /**
   * Public initializer invoked by `towersTab.js` after the DOM is ready.
   */
  function initializeTowerEquipmentInterface() {
    ensureTowerEquipmentSlots();
    handleEquipmentStateUpdate();
    if (!state.unsubscribe) {
      state.unsubscribe = safeAddEquipmentStateListener(() => {
        handleEquipmentStateUpdate();
      });
    }
    if (!state.documentListenerBound && typeof document !== 'undefined') {
      document.addEventListener('tower-unlocked', handleTowerUnlocked);
      state.documentListenerBound = true;
    }
  }

  return {
    initializeTowerEquipmentInterface,
  };
}
