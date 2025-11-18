/**
 * Factory that encapsulates the Towers tab loadout grid rendering and drag handling.
 * Dependencies are injected so the controller can coordinate with the playfield
 * and shared formatting helpers without directly importing the massive towersTab module.
 */
export function createTowerLoadoutController({
  getLoadoutState,
  getLoadoutElements,
  getLoadoutSlots,
  getLoadoutLimit,
  getTowerDefinitions,
  getTowerDefinition,
  getNextTowerId,
  isTowerUnlocked,
  isTowerPlaceable,
  getTheroSymbol,
  getPlayfield,
  getAudioManager,
  formatCombatNumber,
  syncLoadoutToPlayfield,
} = {}) {
  const LOADOUT_WHEEL_HOLD_MS = 1000; // Require an intentional hold before opening the wheel overlay.
  const LOADOUT_SCROLL_STEP_PX = 28; // Drag distance required to advance the wheel to the next item.
  const LOADOUT_DRAG_CANCEL_DISTANCE = 6; // Movement threshold that cancels the hold timer so drags can begin immediately.
  // Store the last rendered tower order signature so the DOM only rebuilds when selection changes.
  let renderedLoadoutSignature = null;
  // Track the active drag interaction so pointer events can be cancelled cleanly.
  const dragState = { active: false, pointerId: null, towerId: null, element: null };
  // Track the transient loadout wheel overlay so it can be rebuilt as the player scrolls through towers.
  const wheelState = {
    timerId: null,
    container: null,
    list: null,
    slotIndex: -1,
    activeIndex: 0,
    towers: [],
    outsideHandler: null,
    pointerId: null,
    lastY: 0,
    dragAccumulator: 0,
  };

  const safeGetLoadoutState = () => (typeof getLoadoutState === 'function' ? getLoadoutState() : null);
  const safeGetLoadoutElements = () => (typeof getLoadoutElements === 'function' ? getLoadoutElements() : null);
  const safeGetLoadoutSlots = () => (typeof getLoadoutSlots === 'function' ? getLoadoutSlots() : []);
  const safeGetLoadoutLimit = () => (typeof getLoadoutLimit === 'function' ? getLoadoutLimit() : 0);
  const safeGetTowerDefinitions = () => (typeof getTowerDefinitions === 'function' ? getTowerDefinitions() : []);
  const safeGetTowerDefinition = (towerId) => (typeof getTowerDefinition === 'function' ? getTowerDefinition(towerId) : null);
  const safeGetNextTowerId = (towerId) => (typeof getNextTowerId === 'function' ? getNextTowerId(towerId) : null);
  const safeIsTowerUnlocked = (towerId) => (typeof isTowerUnlocked === 'function' ? isTowerUnlocked(towerId) : false);
  const safeIsTowerPlaceable = (towerId) => (typeof isTowerPlaceable === 'function' ? isTowerPlaceable(towerId) : false);
  const safeGetTheroSymbol = () => (typeof getTheroSymbol === 'function' ? getTheroSymbol() : 'þ');
  const safeGetPlayfield = () => (typeof getPlayfield === 'function' ? getPlayfield() : null);
  const safeGetAudioManager = () => (typeof getAudioManager === 'function' ? getAudioManager() : null);
  const safeSyncLoadoutToPlayfield = () => {
    if (typeof syncLoadoutToPlayfield === 'function') {
      syncLoadoutToPlayfield();
    }
  };
  const safeFormatCombatNumber = (value) => {
    if (typeof formatCombatNumber === 'function') {
      return formatCombatNumber(value);
    }
    return String(value);
  };

  /**
   * Resolve the cost state for a given tower so affordability cues can stay consistent across UI surfaces.
   */
  function resolveTowerCostState(towerId) {
    const playfield = safeGetPlayfield();
    const isInteractiveLevelActive = Boolean(playfield?.isInteractiveLevelActive?.());
    const energy = isInteractiveLevelActive && playfield ? playfield.energy : 0;
    const definition = safeGetTowerDefinition(towerId);
    const baseCost = Number.isFinite(definition?.baseCost) ? definition.baseCost : 0;
    const anchorCostValue = typeof playfield?.getCurrentTowerCost === 'function'
      ? playfield.getCurrentTowerCost(towerId)
      : baseCost;
    const nextTowerId = safeGetNextTowerId(towerId);
    const nextDefinition = nextTowerId ? safeGetTowerDefinition(nextTowerId) : null;
    const nextBaseCost = Number.isFinite(nextDefinition?.baseCost) ? nextDefinition.baseCost : null;
    const mergeCostValue = nextBaseCost === null
      ? null
      : typeof playfield?.getCurrentTowerCost === 'function'
        ? playfield.getCurrentTowerCost(nextTowerId)
        : nextBaseCost;
    return {
      playfield,
      isInteractiveLevelActive,
      energy,
      definition,
      anchorCostValue,
      canAffordAnchor: isInteractiveLevelActive && energy >= anchorCostValue,
      mergeCostValue,
      canAffordUpgrade: Number.isFinite(mergeCostValue) && isInteractiveLevelActive && energy >= mergeCostValue,
    };
  }

  /**
   * Update cached DOM references for the loadout container, grid, and helper note.
   */
  function setLoadoutElements({ container = null, grid = null, note = null } = {}) {
    const elements = safeGetLoadoutElements();
    if (!elements) {
      return;
    }
    elements.container = container;
    elements.grid = grid;
    elements.note = note;
    updateLoadoutNote();
  }

  /**
   * Refresh the helper note text so players know how to interact with the loadout grid.
   */
  function updateLoadoutNote() {
    const elements = safeGetLoadoutElements();
    const note = elements?.note;
    if (!note) {
      return;
    }
    const loadoutState = safeGetLoadoutState();
    const hasEquippedTower = Array.isArray(loadoutState?.selected)
      ? loadoutState.selected.some((towerId) => towerId)
      : false;
    const slotLimit = Math.max(1, safeGetLoadoutLimit());
    const introMessage = `Hold a loadout slot for one second to browse towers. Prepare up to ${slotLimit} glyphs for this defense.`;
    const equippedMessage =
      'Drag glyph chips onto the plane to lattice them; drop a chip atop a matching tower to merge. Hold a slot to swap towers mid-defense.';
    note.textContent = hasEquippedTower ? equippedMessage : introMessage;
  }

  /**
   * Remove any locked or non-placeable towers from the active loadout selection.
   */
  function pruneLockedTowersFromLoadout() {
    const loadoutState = safeGetLoadoutState();
    const selected = Array.isArray(loadoutState?.selected) ? loadoutState.selected : safeGetLoadoutSlots();
    if (!Array.isArray(selected)) {
      return false;
    }
    let changed = false;
    for (let index = 0; index < selected.length; index += 1) {
      const towerId = selected[index];
      if (!towerId) {
        continue;
      }
      if (!safeIsTowerUnlocked(towerId) || !safeIsTowerPlaceable(towerId)) {
        selected[index] = null;
        changed = true;
      }
    }
    return changed;
  }

  /**
   * Refresh the affordability badges and ARIA labels for each rendered loadout slot.
   */
  function refreshTowerLoadoutDisplay() {
    const elements = safeGetLoadoutElements();
    const grid = elements?.grid;
    if (!grid || typeof grid.querySelectorAll !== 'function') {
      return;
    }
    const items = grid.querySelectorAll('.tower-loadout-item');
    const formatCostLabel = (value) => {
      if (!Number.isFinite(value)) {
        return '∞';
      }
      return safeFormatCombatNumber(Math.max(0, value));
    };

    items.forEach((item) => {
      const towerId = item.dataset.towerId;
      if (!towerId) {
        item.dataset.valid = 'true';
        item.dataset.disabled = 'false';
        item.disabled = false;
        item.setAttribute('aria-label', 'Empty loadout slot');
        const emptyLabel = item.querySelector('.tower-loadout-empty-label');
        if (emptyLabel) {
          emptyLabel.textContent = 'Hold to choose';
        }
        return;
      }
      const costState = resolveTowerCostState(towerId);
      const anchorCostLabel = formatCostLabel(costState.anchorCostValue);
      const costEl = item.querySelector('.tower-loadout-cost');
      if (costEl) {
        costEl.textContent = `Anchor: ${anchorCostLabel} ${safeGetTheroSymbol()}`;
        costEl.dataset.affordable = costState.canAffordAnchor ? 'true' : 'false';
      }
      const upgradeCostEl = item.querySelector('.tower-loadout-upgrade-cost');
      let upgradeAriaLabel = 'Upgrade unavailable';
      if (upgradeCostEl) {
        if (Number.isFinite(costState.mergeCostValue)) {
          const mergeCostLabel = formatCostLabel(costState.mergeCostValue);
          upgradeCostEl.textContent = `Upgrade: ${mergeCostLabel} ${safeGetTheroSymbol()}`;
          upgradeCostEl.dataset.available = 'true';
          upgradeCostEl.dataset.affordable = costState.canAffordUpgrade ? 'true' : 'false';
          upgradeAriaLabel = `Upgrade ${mergeCostLabel} ${safeGetTheroSymbol()}`;
        } else {
          upgradeCostEl.textContent = 'Upgrade: —';
          upgradeCostEl.dataset.available = 'false';
          upgradeCostEl.dataset.affordable = 'false';
          upgradeAriaLabel = 'Upgrade unavailable';
        }
      }
      const definition = costState.definition;
      const labelParts = [
        definition?.name || 'Tower',
        `Anchor ${anchorCostLabel} ${safeGetTheroSymbol()}`,
        upgradeAriaLabel,
      ];
      item.setAttribute('aria-label', labelParts.join(' — '));
      item.dataset.valid = costState.canAffordAnchor ? 'true' : 'false';
      item.dataset.disabled = 'false';
      item.disabled = false;
    });
  }

  /**
   * Rebuild the loadout button grid when selection changes.
   */
  function renderTowerLoadout() {
    const elements = safeGetLoadoutElements();
    const grid = elements?.grid;
    if (!grid) {
      renderedLoadoutSignature = null;
      return;
    }
    const slots = safeGetLoadoutSlots();
    const limit = Math.max(1, safeGetLoadoutLimit());
    const normalizedSlots = Array.isArray(slots) ? slots.slice(0, limit) : [];
    while (normalizedSlots.length < limit) {
      normalizedSlots.push(null);
    }
    const signature = normalizedSlots.map((towerId) => towerId || 'empty').join('|');
    const existingCount = grid.childElementCount;
    if (signature === renderedLoadoutSignature && existingCount === normalizedSlots.length) {
      refreshTowerLoadoutDisplay();
      updateLoadoutNote();
      return;
    }

    grid.innerHTML = '';
    renderedLoadoutSignature = signature;

    const fragment = document.createDocumentFragment();
    normalizedSlots.forEach((towerId, slotIndex) => {
      const definition = towerId ? safeGetTowerDefinition(towerId) : null;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'tower-loadout-item';
      item.dataset.towerId = towerId || '';
      item.dataset.slotIndex = String(slotIndex);
      item.setAttribute('role', 'listitem');
      item.setAttribute('aria-label', definition?.name || 'Empty loadout slot');

      if (definition && definition.placeable !== false) {
        const artwork = document.createElement('img');
        artwork.className = 'tower-loadout-art';
        if (definition.icon) {
          artwork.src = definition.icon;
          artwork.alt = `${definition.name} sigil`;
          artwork.decoding = 'async';
          artwork.loading = 'lazy';
        } else {
          artwork.alt = '';
          artwork.setAttribute('aria-hidden', 'true');
        }

        const costEl = document.createElement('span');
        costEl.className = 'tower-loadout-cost';
        costEl.textContent = 'Anchor: —';
        costEl.dataset.affordable = 'false';

        const upgradeCostEl = document.createElement('span');
        upgradeCostEl.className = 'tower-loadout-upgrade-cost';
        upgradeCostEl.dataset.available = 'false';
        upgradeCostEl.dataset.affordable = 'false';
        upgradeCostEl.textContent = 'Upgrade: —';

        item.append(artwork, costEl, upgradeCostEl);
      } else {
        item.classList.add('tower-loadout-item--empty');
        const emptyArt = document.createElement('span');
        emptyArt.className = 'tower-loadout-art tower-loadout-art--placeholder';
        emptyArt.textContent = '＋';

        const emptyLabel = document.createElement('span');
        emptyLabel.className = 'tower-loadout-empty-label';
        emptyLabel.textContent = 'Hold to choose';

        item.append(emptyArt, emptyLabel);
      }

      item.addEventListener('pointerdown', (event) => handleLoadoutPointerDown(event, towerId, slotIndex, item));
      fragment.append(item);
    });

    grid.append(fragment);
    refreshTowerLoadoutDisplay();
    updateLoadoutNote();
  }

  /**
   * Clear the active hold timer so accidental taps do not spawn the wheel overlay.
   */
  function clearWheelHoldTimer() {
    if (wheelState.timerId) {
      clearTimeout(wheelState.timerId);
      wheelState.timerId = null;
    }
  }

  /**
   * Tear down the transient wheel overlay and any pointer listeners tied to it.
   */
  function closeLoadoutWheel() {
    clearWheelHoldTimer();
    if (wheelState.list && wheelState.pointerId !== null) {
      try {
        wheelState.list.releasePointerCapture(wheelState.pointerId);
      } catch (error) {
        // Ignore pointer capture errors so cleanup always completes.
      }
    }
    if (wheelState.outsideHandler) {
      document.removeEventListener('pointerdown', wheelState.outsideHandler);
    }
    wheelState.outsideHandler = null;
    wheelState.pointerId = null;
    wheelState.dragAccumulator = 0;
    wheelState.lastY = 0;
    if (wheelState.container?.parentNode) {
      wheelState.container.remove();
    }
    wheelState.container = null;
    wheelState.list = null;
    wheelState.towers = [];
    wheelState.slotIndex = -1;
  }

  /**
   * Update the wheel list items to mirror the active index and affordability state.
   */
  function renderLoadoutWheel() {
    const { list, towers } = wheelState;
    if (!list || !Array.isArray(towers) || !towers.length) {
      return;
    }
    const clampedIndex = Math.min(Math.max(wheelState.activeIndex, 0), towers.length - 1);
    wheelState.activeIndex = clampedIndex;
    list.innerHTML = '';

    const startIndex = Math.max(0, clampedIndex - 2);
    const endIndex = Math.min(towers.length, clampedIndex + 3);

    for (let index = startIndex; index < endIndex; index += 1) {
      const definition = towers[index];
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'tower-loadout-wheel__item';
      item.dataset.towerId = definition.id;
      item.dataset.distance = String(Math.abs(index - clampedIndex));

      if (definition.icon) {
        const art = document.createElement('img');
        art.className = 'tower-loadout-wheel__icon';
        art.src = definition.icon;
        art.alt = `${definition.name} icon`;
        art.decoding = 'async';
        art.loading = 'lazy';
        item.append(art);
      }

      const label = document.createElement('span');
      label.className = 'tower-loadout-wheel__label';
      label.textContent = definition.symbol || definition.name || definition.id;
      item.append(label);

      const tier = document.createElement('span');
      tier.className = 'tower-loadout-wheel__tier';
      tier.textContent = `Tier ${Number.isFinite(definition.tier) ? definition.tier : '—'}`;
      item.append(tier);

      const costState = resolveTowerCostState(definition.id);
      item.dataset.affordable = costState.canAffordAnchor ? 'true' : 'false';
      item.setAttribute(
        'aria-label',
        `${definition.name || definition.id} — Tier ${definition.tier || '—'} — Anchor ${safeFormatCombatNumber(
          costState.anchorCostValue,
        )} ${safeGetTheroSymbol()}`,
      );

      item.addEventListener('click', () => {
        wheelState.activeIndex = index;
        const slots = safeGetLoadoutSlots();
        if (Array.isArray(slots) && wheelState.slotIndex >= 0 && wheelState.slotIndex < slots.length) {
          const duplicateIndex = slots.findIndex((id, slotIdx) => id === definition.id && slotIdx !== wheelState.slotIndex);
          if (duplicateIndex !== -1) {
            slots[duplicateIndex] = null;
          }
          slots[wheelState.slotIndex] = definition.id;
          renderTowerLoadout();
          safeSyncLoadoutToPlayfield();
        }
        closeLoadoutWheel();
      });

      list.append(item);
    }
  }

  /**
   * Shift the active wheel index in response to scroll or drag input.
   */
  function shiftWheelSelection(delta) {
    const nextIndex = Math.min(
      Math.max(wheelState.activeIndex + delta, 0),
      Math.max(0, wheelState.towers.length - 1),
    );
    if (nextIndex !== wheelState.activeIndex) {
      wheelState.activeIndex = nextIndex;
      renderLoadoutWheel();
    }
  }

  /**
   * Begin listening for drag gestures on the wheel to emulate a scrolling column.
   */
  function beginWheelDrag(event) {
    wheelState.pointerId = event.pointerId;
    wheelState.lastY = event.clientY;
    wheelState.dragAccumulator = 0;
    try {
      wheelState.list?.setPointerCapture?.(event.pointerId);
    } catch (error) {
      // Ignore pointer capture errors so drag gestures remain responsive.
    }
    document.addEventListener('pointermove', handleWheelDragMove);
    document.addEventListener('pointerup', endWheelDrag);
    document.addEventListener('pointercancel', endWheelDrag);
  }

  /**
   * Translate vertical drag movement into wheel index changes.
   */
  function handleWheelDragMove(event) {
    if (event.pointerId !== wheelState.pointerId) {
      return;
    }
    const deltaY = event.clientY - wheelState.lastY;
    wheelState.lastY = event.clientY;
    wheelState.dragAccumulator += deltaY;
    while (Math.abs(wheelState.dragAccumulator) >= LOADOUT_SCROLL_STEP_PX) {
      shiftWheelSelection(wheelState.dragAccumulator > 0 ? -1 : 1);
      wheelState.dragAccumulator += wheelState.dragAccumulator > 0 ? -LOADOUT_SCROLL_STEP_PX : LOADOUT_SCROLL_STEP_PX;
    }
  }

  /**
   * Stop tracking drag gestures when the pointer is released or cancelled.
   */
  function endWheelDrag(event) {
    if (event.pointerId !== wheelState.pointerId) {
      return;
    }
    document.removeEventListener('pointermove', handleWheelDragMove);
    document.removeEventListener('pointerup', endWheelDrag);
    document.removeEventListener('pointercancel', endWheelDrag);
    try {
      wheelState.list?.releasePointerCapture?.(event.pointerId);
    } catch (error) {
      // Ignore release failures while still clearing drag state.
    }
    wheelState.pointerId = null;
    wheelState.dragAccumulator = 0;
    wheelState.lastY = 0;
  }

  /**
   * Open the wheel overlay anchored to a specific slot.
   */
  function openLoadoutWheel(slotIndex, anchorElement) {
    closeLoadoutWheel();
    const towers = safeGetTowerDefinitions().filter(
      (definition) => safeIsTowerUnlocked(definition.id) && safeIsTowerPlaceable(definition.id),
    );
    if (!towers.length) {
      return;
    }
    const slots = safeGetLoadoutSlots();
    const slotTowerId = Array.isArray(slots) && slotIndex < slots.length ? slots[slotIndex] : null;
    const activeIndex = towers.findIndex((definition) => definition.id === slotTowerId);

    const container = document.createElement('div');
    container.className = 'tower-loadout-wheel';
    const list = document.createElement('div');
    list.className = 'tower-loadout-wheel__list';
    container.append(list);

    wheelState.container = container;
    wheelState.list = list;
    wheelState.slotIndex = slotIndex;
    wheelState.towers = towers;
    wheelState.activeIndex = activeIndex >= 0 ? activeIndex : 0;

    renderLoadoutWheel();

    list.addEventListener('pointerdown', beginWheelDrag);
    list.addEventListener('wheel', (event) => {
      event.preventDefault();
      shiftWheelSelection(event.deltaY > 0 ? 1 : -1);
    });

    const loadoutContainer = safeGetLoadoutElements()?.container;
    const host = loadoutContainer || document.body;
    host.append(container);
    if (anchorElement?.getBoundingClientRect && loadoutContainer?.getBoundingClientRect) {
      const anchorRect = anchorElement.getBoundingClientRect();
      const hostRect = loadoutContainer.getBoundingClientRect();
      container.style.left = `${anchorRect.left - hostRect.left}px`;
      container.style.top = `${Math.max(0, anchorRect.top - hostRect.top - container.offsetHeight - 8)}px`;
    }

    wheelState.outsideHandler = (event) => {
      if (!container.contains(event.target) && !anchorElement?.contains(event.target)) {
        closeLoadoutWheel();
      }
    };
    document.addEventListener('pointerdown', wheelState.outsideHandler);
  }

  /**
   * Start drag placement immediately while scheduling a hold to open the wheel.
   */
  function handleLoadoutPointerDown(event, towerId, slotIndex, element) {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    closeLoadoutWheel();
    const startX = event.clientX;
    const startY = event.clientY;

    const cancelHold = () => {
      clearWheelHoldTimer();
      element.removeEventListener('pointermove', handleMove);
    };

    const handleMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.hypot(dx, dy) > LOADOUT_DRAG_CANCEL_DISTANCE) {
        cancelHold();
      }
    };

    wheelState.timerId = setTimeout(() => {
      cancelHold();
      cancelTowerDrag();
      openLoadoutWheel(slotIndex, element);
    }, LOADOUT_WHEEL_HOLD_MS);

    element.addEventListener('pointermove', handleMove);
    element.addEventListener('pointerup', cancelHold, { once: true });
    element.addEventListener('pointercancel', cancelHold, { once: true });

    if (towerId) {
      startTowerDrag(event, towerId, element);
    }
  }

  /**
   * Cancel any active drag interaction and reset pointer capture + previews.
   */
  function cancelTowerDrag() {
    if (!dragState.active) {
      return;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointermove', handleTowerDragMove);
      document.removeEventListener('pointerup', handleTowerDragEnd);
      document.removeEventListener('pointercancel', handleTowerDragEnd);
    }
    if (dragState.element) {
      try {
        dragState.element.releasePointerCapture(dragState.pointerId);
      } catch (error) {
        // Ignore pointer capture errors so drag cleanup always completes.
      }
      dragState.element.removeAttribute('data-state');
    }
    const playfield = safeGetPlayfield();
    playfield?.finishTowerDrag?.();
    playfield?.clearPlacementPreview?.();
    dragState.active = false;
    dragState.pointerId = null;
    dragState.towerId = null;
    dragState.element = null;
    refreshTowerLoadoutDisplay();
  }

  /**
   * Maintain the placement preview while the tower chip follows the pointer.
   */
  function handleTowerDragMove(event) {
    if (!dragState.active || event.pointerId !== dragState.pointerId) {
      return;
    }
    if (dragState.element) {
      dragState.element.dataset.state = 'dragging';
    }
    const playfield = safeGetPlayfield();
    if (!playfield) {
      return;
    }
    const normalized = playfield.getNormalizedFromEvent?.(event);
    if (normalized) {
      playfield.previewTowerPlacement?.(normalized, {
        towerType: dragState.towerId,
        dragging: true,
      });
    }
  }

  /**
   * Complete the drag interaction by either placing the tower or clearing the preview.
   */
  function finalizeTowerDrag(event) {
    if (!dragState.active || event.pointerId !== dragState.pointerId) {
      return;
    }
    if (dragState.element) {
      try {
        dragState.element.releasePointerCapture(dragState.pointerId);
      } catch (error) {
        // Ignore pointer capture errors so cleanup still happens.
      }
      dragState.element.removeAttribute('data-state');
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointermove', handleTowerDragMove);
      document.removeEventListener('pointerup', handleTowerDragEnd);
      document.removeEventListener('pointercancel', handleTowerDragEnd);
    }
    const playfield = safeGetPlayfield();
    if (playfield) {
      const normalized = playfield.getNormalizedFromEvent?.(event);
      if (normalized) {
        playfield.completeTowerPlacement?.(normalized, { towerType: dragState.towerId });
      } else {
        playfield.clearPlacementPreview?.();
      }
      playfield.finishTowerDrag?.();
    }
    dragState.active = false;
    dragState.pointerId = null;
    dragState.towerId = null;
    dragState.element = null;
    refreshTowerLoadoutDisplay();
  }

  /**
   * Shared pointerup / pointercancel handler used by drag cleanup.
   */
  function handleTowerDragEnd(event) {
    finalizeTowerDrag(event);
  }

  /**
   * Begin dragging a tower loadout chip so it can be placed on the battlefield.
   */
  function startTowerDrag(event, towerId, element) {
    const playfield = safeGetPlayfield();
    if (!playfield || !playfield.isInteractiveLevelActive?.()) {
      const audioManager = safeGetAudioManager();
      audioManager?.playSfx?.('error');
      if (playfield?.messageEl) {
        playfield.messageEl.textContent = 'Enter the defense to lattice towers from your loadout.';
      }
      return;
    }

    cancelTowerDrag();

    dragState.active = true;
    dragState.pointerId = event.pointerId;
    dragState.towerId = towerId;
    dragState.element = element;
    element.dataset.state = 'dragging';

    playfield.setDraggingTower?.(towerId);

    try {
      element.setPointerCapture(event.pointerId);
    } catch (error) {
      // Ignore pointer capture errors while still keeping drag state active.
    }

    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('pointermove', handleTowerDragMove);
      document.addEventListener('pointerup', handleTowerDragEnd);
      document.addEventListener('pointercancel', handleTowerDragEnd);
    }

    handleTowerDragMove(event);
  }

  return {
    setLoadoutElements,
    pruneLockedTowersFromLoadout,
    refreshTowerLoadoutDisplay,
    renderTowerLoadout,
    startTowerDrag,
    cancelTowerDrag,
  };
}
