/**
 * Factory that encapsulates the Towers tab loadout grid rendering and drag handling.
 * Dependencies are injected so the controller can coordinate with the playfield
 * and shared formatting helpers without directly importing the massive towersTab module.
 */
export function createTowerLoadoutController({
  getLoadoutState,
  getLoadoutElements,
  getTowerDefinition,
  getNextTowerId,
  isTowerUnlocked,
  isTowerPlaceable,
  getTheroSymbol,
  getPlayfield,
  getAudioManager,
  formatCombatNumber,
} = {}) {
  // Store the last rendered tower order signature so the DOM only rebuilds when selection changes.
  let renderedLoadoutSignature = null;
  // Track the active drag interaction so pointer events can be cancelled cleanly.
  const dragState = { active: false, pointerId: null, towerId: null, element: null };

  const safeGetLoadoutState = () => (typeof getLoadoutState === 'function' ? getLoadoutState() : null);
  const safeGetLoadoutElements = () => (typeof getLoadoutElements === 'function' ? getLoadoutElements() : null);
  const safeGetTowerDefinition = (towerId) => (typeof getTowerDefinition === 'function' ? getTowerDefinition(towerId) : null);
  const safeGetNextTowerId = (towerId) => (typeof getNextTowerId === 'function' ? getNextTowerId(towerId) : null);
  const safeIsTowerUnlocked = (towerId) => (typeof isTowerUnlocked === 'function' ? isTowerUnlocked(towerId) : false);
  const safeIsTowerPlaceable = (towerId) => (typeof isTowerPlaceable === 'function' ? isTowerPlaceable(towerId) : false);
  const safeGetTheroSymbol = () => (typeof getTheroSymbol === 'function' ? getTheroSymbol() : 'þ');
  const safeGetPlayfield = () => (typeof getPlayfield === 'function' ? getPlayfield() : null);
  const safeGetAudioManager = () => (typeof getAudioManager === 'function' ? getAudioManager() : null);
  const safeFormatCombatNumber = (value) => {
    if (typeof formatCombatNumber === 'function') {
      return formatCombatNumber(value);
    }
    return String(value);
  };

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
    if (!loadoutState?.selected?.length) {
      note.textContent = 'Select towers on the Towers tab to prepare up to four glyphs for this defense.';
    } else {
      note.textContent =
        'Select four towers to bring into the defense. Drag the glyph chips onto the plane to lattice them; drop a chip atop a matching tower to merge.';
    }
  }

  /**
   * Remove any locked or non-placeable towers from the active loadout selection.
   */
  function pruneLockedTowersFromLoadout() {
    const loadoutState = safeGetLoadoutState();
    const selected = loadoutState?.selected;
    if (!Array.isArray(selected)) {
      return false;
    }
    let changed = false;
    for (let index = selected.length - 1; index >= 0; index -= 1) {
      const towerId = selected[index];
      if (!safeIsTowerUnlocked(towerId) || !safeIsTowerPlaceable(towerId)) {
        selected.splice(index, 1);
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
    const playfield = safeGetPlayfield();
    const isInteractiveLevelActive = Boolean(playfield?.isInteractiveLevelActive?.());
    const items = grid.querySelectorAll('.tower-loadout-item');
    const energy = isInteractiveLevelActive && playfield ? playfield.energy : 0;
    const formatCostLabel = (value) => {
      if (!Number.isFinite(value)) {
        return '∞';
      }
      return safeFormatCombatNumber(Math.max(0, value));
    };

    items.forEach((item) => {
      const towerId = item.dataset.towerId;
      const definition = safeGetTowerDefinition(towerId);
      if (!definition) {
        return;
      }
      const baseCost = Number.isFinite(definition.baseCost) ? definition.baseCost : 0;
      const anchorCostValue = typeof playfield?.getCurrentTowerCost === 'function'
        ? playfield.getCurrentTowerCost(towerId)
        : baseCost;
      const anchorCostLabel = formatCostLabel(anchorCostValue);
      const canAffordAnchor = isInteractiveLevelActive && energy >= anchorCostValue;
      const costEl = item.querySelector('.tower-loadout-cost');
      if (costEl) {
        costEl.textContent = `Anchor: ${anchorCostLabel} ${safeGetTheroSymbol()}`;
        costEl.dataset.affordable = canAffordAnchor ? 'true' : 'false';
      }
      const upgradeCostEl = item.querySelector('.tower-loadout-upgrade-cost');
      const nextTowerId = safeGetNextTowerId(towerId);
      const nextDefinition = nextTowerId ? safeGetTowerDefinition(nextTowerId) : null;
      let upgradeAriaLabel = 'Upgrade unavailable';
      if (upgradeCostEl) {
        if (nextDefinition) {
          const nextBaseCost = Number.isFinite(nextDefinition.baseCost) ? nextDefinition.baseCost : 0;
          const mergeCostValue = typeof playfield?.getCurrentTowerCost === 'function'
            ? playfield.getCurrentTowerCost(nextTowerId)
            : nextBaseCost;
          const mergeCostLabel = formatCostLabel(mergeCostValue);
          upgradeCostEl.textContent = `Upgrade: ${mergeCostLabel} ${safeGetTheroSymbol()}`;
          upgradeCostEl.dataset.available = 'true';
          const canAffordUpgrade = isInteractiveLevelActive && energy >= mergeCostValue;
          upgradeCostEl.dataset.affordable = canAffordUpgrade ? 'true' : 'false';
          upgradeAriaLabel = `Upgrade ${mergeCostLabel} ${safeGetTheroSymbol()}`;
        } else {
          upgradeCostEl.textContent = 'Upgrade: —';
          upgradeCostEl.dataset.available = 'false';
          upgradeCostEl.dataset.affordable = 'false';
          upgradeAriaLabel = 'Upgrade unavailable';
        }
      }
      if (definition && item) {
        const labelParts = [
          definition.name,
          `Anchor ${anchorCostLabel} ${safeGetTheroSymbol()}`,
          upgradeAriaLabel,
        ];
        item.setAttribute('aria-label', labelParts.join(' — '));
      }
      item.dataset.valid = canAffordAnchor ? 'true' : 'false';
      item.dataset.disabled = isInteractiveLevelActive ? 'false' : 'true';
      item.disabled = !isInteractiveLevelActive;
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
    const loadoutState = safeGetLoadoutState();
    const selected = Array.isArray(loadoutState?.selected) ? loadoutState.selected : [];
    const signature = selected.join('|');
    const existingCount = grid.childElementCount;
    if (signature === renderedLoadoutSignature && existingCount === selected.length) {
      refreshTowerLoadoutDisplay();
      updateLoadoutNote();
      return;
    }

    grid.innerHTML = '';
    renderedLoadoutSignature = signature;

    if (!selected.length) {
      updateLoadoutNote();
      return;
    }

    const fragment = document.createDocumentFragment();
    selected.forEach((towerId) => {
      const definition = safeGetTowerDefinition(towerId);
      if (!definition || definition.placeable === false) {
        return;
      }
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'tower-loadout-item';
      item.dataset.towerId = towerId;
      item.setAttribute('role', 'listitem');
      item.setAttribute('aria-label', definition.name);

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
      item.addEventListener('pointerdown', (event) => startTowerDrag(event, towerId, item));
      fragment.append(item);
    });

    grid.append(fragment);
    refreshTowerLoadoutDisplay();
    updateLoadoutNote();
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
