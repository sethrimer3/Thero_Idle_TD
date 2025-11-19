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
  isTowerUnlocked,
  isTowerPlaceable,
  getTheroSymbol,
  getPlayfield,
  getAudioManager,
  formatCombatNumber,
  syncLoadoutToPlayfield,
} = {}) {
  const LOADOUT_WHEEL_HOLD_MS = 500; // Require an intentional hold before opening the wheel overlay.
  const LOADOUT_SCROLL_STEP_PX = 28; // Drag distance required to advance the wheel to the next item.
  const LOADOUT_DRAG_CANCEL_DISTANCE = 6; // Mouse/pen threshold that cancels the hold timer so drags can begin immediately.
  const LOADOUT_DRAG_CANCEL_DISTANCE_TOUCH = 14; // Slightly looser touch threshold to tolerate finger jitter during holds.
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
    focusIndex: 0,
    targetIndex: 0,
    itemHeight: 0,
    animationFrame: null,
    towers: [],
    outsideHandler: null,
    pointerId: null,
    lastY: 0,
    dragAccumulator: 0,
    anchorElement: null,
    verticalOffset: 0,
    horizontalOffset: 0,
  };
  const loadoutUiState = { collapsed: false, toggleHandler: null };

  const safeGetLoadoutState = () => (typeof getLoadoutState === 'function' ? getLoadoutState() : null);
  const safeGetLoadoutElements = () => (typeof getLoadoutElements === 'function' ? getLoadoutElements() : null);
  const safeGetLoadoutSlots = () => (typeof getLoadoutSlots === 'function' ? getLoadoutSlots() : []);
  const safeGetLoadoutLimit = () => (typeof getLoadoutLimit === 'function' ? getLoadoutLimit() : 0);
  const safeGetTowerDefinitions = () => (typeof getTowerDefinitions === 'function' ? getTowerDefinitions() : []);
  const safeGetTowerDefinition = (towerId) => (typeof getTowerDefinition === 'function' ? getTowerDefinition(towerId) : null);
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
    return {
      playfield,
      isInteractiveLevelActive,
      energy,
      definition,
      anchorCostValue,
      canAffordAnchor: isInteractiveLevelActive && energy >= anchorCostValue,
    };
  }

  /**
   * Toggle the visibility of the loadout tray while keeping the toggle state in sync for accessibility.
   */
  function updateLoadoutCollapsedState(collapsed = false) {
    loadoutUiState.collapsed = Boolean(collapsed);
    const elements = safeGetLoadoutElements();
    const shell = elements?.shell;
    const container = elements?.container;
    const toggle = elements?.toggle;
    if (shell) {
      shell.classList.toggle('tower-loadout-shell--collapsed', loadoutUiState.collapsed);
    }
    if (container) {
      container.dataset.collapsed = loadoutUiState.collapsed ? 'true' : 'false';
      container.setAttribute('aria-hidden', loadoutUiState.collapsed ? 'true' : 'false');
    }
    if (toggle) {
      toggle.setAttribute('aria-expanded', loadoutUiState.collapsed ? 'false' : 'true');
      toggle.setAttribute('aria-label', loadoutUiState.collapsed ? 'Show tower loadout' : 'Hide tower loadout');
    }
  }

  /**
   * Wire the collapse toggle so players can tuck the tray beneath the battlefield on demand.
   */
  function bindLoadoutToggle() {
    const elements = safeGetLoadoutElements();
    const toggle = elements?.toggle;
    if (!toggle) {
      return;
    }
    if (loadoutUiState.toggleHandler) {
      toggle.removeEventListener('click', loadoutUiState.toggleHandler);
    }
    loadoutUiState.toggleHandler = () => updateLoadoutCollapsedState(!loadoutUiState.collapsed);
    toggle.addEventListener('click', loadoutUiState.toggleHandler);
  }

  /**
   * Update cached DOM references for the loadout container, grid, helper note, and toggle.
   */
  function setLoadoutElements({ shell = null, container = null, grid = null, note = null, toggle = null } = {}) {
    const elements = safeGetLoadoutElements();
    if (!elements) {
      return;
    }
    elements.shell = shell;
    elements.container = container;
    elements.grid = grid;
    elements.note = note;
    elements.toggle = toggle;
    updateLoadoutNote();
    bindLoadoutToggle();
    updateLoadoutCollapsedState(loadoutUiState.collapsed);
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
    const introMessage = `Hold a loadout slot for half a second to browse towers. Prepare up to ${slotLimit} glyphs for this defense.`;
    const equippedMessage =
      'Drag glyph chips onto the plane to lattice them; drop a chip atop a matching tower to merge. Hold a slot to swap towers mid-defense.';
    note.textContent = hasEquippedTower ? equippedMessage : introMessage;
  }

  /**
   * Determine whether the pointer is currently hovering the loadout buttons so placement can be cancelled.
   */
  function isEventOverLoadout(event) {
    if (loadoutUiState.collapsed) {
      return false;
    }
    const elements = safeGetLoadoutElements();
    const grid = elements?.grid || elements?.container;
    const toggle = elements?.toggle;
    const rects = [grid?.getBoundingClientRect?.(), toggle?.getBoundingClientRect?.()].filter(Boolean);
    if (!rects.length) {
      return false;
    }
    const { clientX, clientY } = event || {};
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return false;
    }
    return rects.some((rect) => {
      const withinX = clientX >= rect.left && clientX <= rect.right;
      const withinY = clientY >= rect.top && clientY <= rect.bottom;
      return withinX && withinY;
    });
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
        return;
      }
      const costState = resolveTowerCostState(towerId);
      const anchorCostLabel = formatCostLabel(costState.anchorCostValue);
      const costEl = item.querySelector('.tower-loadout-cost');
      if (costEl) {
        costEl.textContent = `${anchorCostLabel} ${safeGetTheroSymbol()}`;
        costEl.dataset.affordable = costState.canAffordAnchor ? 'true' : 'false';
      }
      const definition = costState.definition;
      const labelParts = [
        definition?.name || 'Tower',
        `${anchorCostLabel} ${safeGetTheroSymbol()}`,
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
        costEl.textContent = '—';
        costEl.dataset.affordable = 'false';

        item.append(artwork, costEl);
      } else {
        item.classList.add('tower-loadout-item--empty');
        const emptyArt = document.createElement('span');
        emptyArt.className = 'tower-loadout-art tower-loadout-art--placeholder';
        emptyArt.textContent = '＋';

        item.append(emptyArt);
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
    document.removeEventListener('pointermove', handleWheelDragMove);
    document.removeEventListener('pointerup', endWheelDrag);
    document.removeEventListener('pointercancel', endWheelDrag);
    if (wheelState.outsideHandler) {
      document.removeEventListener('pointerdown', wheelState.outsideHandler);
    }
    if (wheelState.animationFrame) {
      cancelAnimationFrame(wheelState.animationFrame);
    }
    if (wheelState.anchorElement) {
      wheelState.anchorElement.classList.remove('tower-loadout-item--active-wheel');
    }
    wheelState.outsideHandler = null;
    wheelState.pointerId = null;
    wheelState.dragAccumulator = 0;
    wheelState.lastY = 0;
    wheelState.focusIndex = 0;
    wheelState.targetIndex = 0;
    wheelState.itemHeight = 0;
    wheelState.animationFrame = null;
    if (wheelState.container?.parentNode) {
      wheelState.container.remove();
    }
    wheelState.container = null;
    wheelState.list = null;
    wheelState.towers = [];
    wheelState.slotIndex = -1;
    wheelState.anchorElement = null;
    wheelState.verticalOffset = 0;
    wheelState.horizontalOffset = 0;
  }

  /**
   * Position the loadout wheel relative to the anchor slot while keeping it in view.
   */
  function positionLoadoutWheel(anchorElement, loadoutContainer = null) {
    if (!wheelState.container || !anchorElement?.getBoundingClientRect) {
      return;
    }
    // Clamp the wheel to the viewport so it can rise above the loadout tray on mobile viewports.
    const viewportWidth = document.documentElement?.clientWidth || window.innerWidth || 0;
    const viewportHeight = document.documentElement?.clientHeight || window.innerHeight || 0;
    const anchorRect = anchorElement.getBoundingClientRect();
    const containerRect = {
      width: wheelState.container.offsetWidth || 0,
      height: wheelState.container.offsetHeight || 0,
    };
    const anchorCenterY = anchorRect.top + anchorRect.height / 2;
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const maxLeft = Math.max(0, viewportWidth - containerRect.width - 8);
    const maxTop = Math.max(0, viewportHeight - containerRect.height - 8);
    // Anchor the wheel to the slot's left edge so the glyph column sits directly atop the held slot.
    const desiredLeft = anchorRect.left;
    const desiredTop = anchorCenterY - containerRect.height / 2;
    const left = Math.min(maxLeft, Math.max(8, desiredLeft));
    const top = Math.min(maxTop, Math.max(8, desiredTop));
    // Track how far the wheel was clamped vertically so the list can be nudged to stay aligned with the held slot.
    wheelState.verticalOffset = desiredTop - top;
    // Track horizontal clamp offset so the wheel contents can stay centered on the slot even near the viewport edge.
    wheelState.horizontalOffset = desiredLeft - left;
    wheelState.container.style.left = `${left + scrollX}px`;
    wheelState.container.style.top = `${top + scrollY}px`;
    if (wheelState.list) {
      updateLoadoutWheelTransform({ immediate: true, skipReposition: true });
    }
  }

  /**
   * Update the wheel list items to mirror the focused index and affordability state.
   */
  function updateLoadoutWheelDistances() {
    const { list, towers } = wheelState;
    if (!list || !Array.isArray(towers) || !towers.length) {
      return;
    }
    const focusIndex = Number.isFinite(wheelState.focusIndex) ? wheelState.focusIndex : wheelState.activeIndex;
    Array.from(list.children).forEach((child, index) => {
      const distance = Math.min(2, Math.round(Math.abs(index - focusIndex)));
      child.dataset.distance = String(distance);
    });
  }

  /**
   * Smoothly translate the wheel list so the focused option is centered.
   */
  function updateLoadoutWheelTransform({ immediate = false, skipReposition = false } = {}) {
    const { list, towers } = wheelState;
    if (!list || !Array.isArray(towers) || !towers.length || !Number.isFinite(wheelState.focusIndex)) {
      return;
    }
    const itemHeight = Math.max(1, wheelState.itemHeight || LOADOUT_SCROLL_STEP_PX);
    const listHeight = list.getBoundingClientRect()?.height || itemHeight;
    const offset =
      -wheelState.focusIndex * itemHeight + listHeight / 2 - itemHeight / 2 + (wheelState.verticalOffset || 0);
    list.style.willChange = 'transform';
    list.style.transition = immediate ? 'none' : 'transform 140ms ease-out';
    list.style.transform = `translate(${wheelState.horizontalOffset || 0}px, ${offset}px)`;
    const roundedIndex = Math.min(
      Math.max(Math.round(wheelState.focusIndex), 0),
      Math.max(0, towers.length - 1),
    );
    wheelState.activeIndex = roundedIndex;
    updateLoadoutWheelDistances();
    if (wheelState.anchorElement && !skipReposition) {
      positionLoadoutWheel(wheelState.anchorElement);
    }
    if (immediate) {
      requestAnimationFrame(() => {
        if (wheelState.list) {
          wheelState.list.style.transition = 'transform 140ms ease-out';
        }
      });
    }
  }

  /**
   * Ease the focus index toward a target for smoother scrolling.
   */
  function setLoadoutWheelTarget(targetIndex) {
    const { towers } = wheelState;
    if (!Array.isArray(towers) || !towers.length) {
      return;
    }
    const clamped = Math.min(Math.max(targetIndex, 0), Math.max(0, towers.length - 1));
    wheelState.targetIndex = clamped;
    if (!Number.isFinite(wheelState.focusIndex)) {
      wheelState.focusIndex = clamped;
    }
    const stepAnimation = () => {
      const target = Number.isFinite(wheelState.targetIndex) ? wheelState.targetIndex : wheelState.focusIndex;
      const current = Number.isFinite(wheelState.focusIndex) ? wheelState.focusIndex : target;
      const delta = target - current;
      if (Math.abs(delta) < 0.002) {
        wheelState.focusIndex = target;
        updateLoadoutWheelTransform();
        wheelState.animationFrame = null;
        return;
      }
      wheelState.focusIndex = current + delta * 0.2;
      updateLoadoutWheelTransform();
      wheelState.animationFrame = requestAnimationFrame(stepAnimation);
    };
    if (!wheelState.animationFrame) {
      wheelState.animationFrame = requestAnimationFrame(stepAnimation);
    }
  }

  /**
   * Update the wheel list items to mirror the active index and affordability state.
   */
  function renderLoadoutWheel({ immediate = false } = {}) {
    const { list, towers } = wheelState;
    if (!list || !Array.isArray(towers) || !towers.length) {
      return;
    }
    const clampedIndex = Math.min(Math.max(wheelState.activeIndex, 0), towers.length - 1);
    wheelState.activeIndex = clampedIndex;
    wheelState.focusIndex = Number.isFinite(wheelState.focusIndex) ? wheelState.focusIndex : clampedIndex;
    wheelState.targetIndex = Number.isFinite(wheelState.targetIndex) ? wheelState.targetIndex : clampedIndex;
    list.innerHTML = '';

    towers.forEach((definition, index) => {
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
        `${definition.name || definition.id} — Tier ${definition.tier || '—'} — ${safeFormatCombatNumber(
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
    });

    const firstItem = list.querySelector('.tower-loadout-wheel__item');
    wheelState.itemHeight = firstItem?.getBoundingClientRect?.().height || LOADOUT_SCROLL_STEP_PX;
    const itemHeight = Math.max(1, wheelState.itemHeight);
    const listStyles = window.getComputedStyle(list);
    const gapValue = listStyles?.rowGap || listStyles?.gap || '0';
    const listGap = Number.parseFloat(gapValue) || 0;
    const totalHeight = itemHeight * Math.max(1, towers.length) + listGap * Math.max(0, towers.length - 1);
    const viewportHeight = document.documentElement?.clientHeight || window.innerHeight || totalHeight;
    // Clamp the wheel height to the viewport so the active option can sit over the slot without clipping off-screen.
    const clampedHeight = Math.min(totalHeight, Math.max(itemHeight * 3, viewportHeight - 24));
    list.style.setProperty('--tower-loadout-wheel-height', `${clampedHeight}px`);
    updateLoadoutWheelTransform({ immediate });
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
    const itemHeight = Math.max(1, wheelState.itemHeight || LOADOUT_SCROLL_STEP_PX);
    const deltaIndex = wheelState.dragAccumulator / itemHeight;
    if (Math.abs(deltaIndex) >= 0.01) {
      const currentTarget = Number.isFinite(wheelState.targetIndex)
        ? wheelState.targetIndex
        : wheelState.activeIndex;
      setLoadoutWheelTarget(currentTarget - deltaIndex);
      wheelState.dragAccumulator = 0;
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
    if (wheelState.towers.length) {
      setLoadoutWheelTarget(Math.round(wheelState.focusIndex));
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
    wheelState.focusIndex = wheelState.activeIndex;
    wheelState.targetIndex = wheelState.activeIndex;
    wheelState.anchorElement = anchorElement || null;

    if (wheelState.anchorElement) {
      wheelState.anchorElement.classList.add('tower-loadout-item--active-wheel');
    }

    // Mount the wheel on the body so it can escape the tray bounds while still aligning to the held slot.
    const host = document.body;
    host.append(container);

    renderLoadoutWheel({ immediate: true });

    list.addEventListener('pointerdown', beginWheelDrag);
    list.addEventListener('wheel', (event) => {
      event.preventDefault();
      const itemHeight = Math.max(1, wheelState.itemHeight || LOADOUT_SCROLL_STEP_PX);
      const deltaIndex = (event.deltaY || 0) / itemHeight;
      const currentTarget = Number.isFinite(wheelState.targetIndex)
        ? wheelState.targetIndex
        : wheelState.activeIndex;
      setLoadoutWheelTarget(currentTarget + deltaIndex);
    });

    positionLoadoutWheel(anchorElement, loadoutContainer);

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
    const isTouchPointer = event.pointerType === 'touch';
    const cancelDistance = isTouchPointer ? LOADOUT_DRAG_CANCEL_DISTANCE_TOUCH : LOADOUT_DRAG_CANCEL_DISTANCE;

    const cancelHold = () => {
      clearWheelHoldTimer();
      element.removeEventListener('pointermove', handleMove);
    };

    const handleMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.hypot(dx, dy) > cancelDistance) {
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
    if (isEventOverLoadout(event)) {
      playfield.clearPlacementPreview?.();
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
    const placementBlocked = isEventOverLoadout(event);
    if (playfield) {
      const normalized = placementBlocked ? null : playfield.getNormalizedFromEvent?.(event);
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
