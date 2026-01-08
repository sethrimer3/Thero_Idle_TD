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
  createTowerIconElement,
  syncLoadoutToPlayfield,
} = {}) {
  const LOADOUT_WHEEL_HOLD_MS = 500; // Require an intentional hold before opening the wheel overlay.
  const LOADOUT_SCROLL_STEP_PX = 28; // Drag distance required to advance the wheel to the next item.
  const LOADOUT_DRAG_CANCEL_DISTANCE = 6; // Mouse/pen threshold that cancels the hold timer so drags can begin immediately.
  const LOADOUT_DRAG_CANCEL_DISTANCE_TOUCH = 14; // Slightly looser touch threshold to tolerate finger jitter during holds.
  const MAX_VISIBLE_LOADOUT_ITEMS = 3; // Maximum number of tower options visible in the loadout wheel at once.
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
    wheelHandler: null,
    anchorElement: null,
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

  // Build a palette-aware icon element using the injected factory with a safe image fallback.
  const safeCreateTowerIconElement = (definition, options = {}) => {
    if (typeof createTowerIconElement === 'function') {
      const icon = createTowerIconElement(definition, options);
      if (icon) {
        return icon;
      }
    }
    if (definition?.icon) {
      const fallbackIcon = document.createElement('img');
      fallbackIcon.src = definition.icon;
      fallbackIcon.alt = options.alt || `${definition.name || definition.id || 'Tower'} icon`;
      fallbackIcon.decoding = 'async';
      fallbackIcon.loading = 'lazy';
      fallbackIcon.className = ['tower-icon', options.className || ''].filter(Boolean).join(' ');
      return fallbackIcon;
    }
    return null;
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
        const artwork = safeCreateTowerIconElement(definition, {
          className: 'tower-loadout-art',
          alt: `${definition.name} sigil`,
        });

        const costEl = document.createElement('span');
        costEl.className = 'tower-loadout-cost';
        costEl.textContent = '—';
        costEl.dataset.affordable = 'false';

        if (artwork) {
          item.append(artwork, costEl);
        } else {
          item.append(costEl);
        }
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
    if (wheelState.wheelHandler && wheelState.list) {
      wheelState.list.removeEventListener('wheel', wheelState.wheelHandler);
    }
    if (wheelState.outsideHandler) {
      document.removeEventListener('pointerdown', wheelState.outsideHandler, { passive: true });
    }
    if (wheelState.anchorElement) {
      wheelState.anchorElement.classList.remove('tower-loadout-item--active-wheel');
    }
    wheelState.outsideHandler = null;
    wheelState.wheelHandler = null;
    if (wheelState.container?.parentNode) {
      wheelState.container.remove();
    }
    wheelState.container = null;
    wheelState.list = null;
    wheelState.towers = [];
    wheelState.slotIndex = -1;
    wheelState.anchorElement = null;
  }

  /**
   * Handle scroll wheel events to shift towers step-wise.
   */
  function shiftLoadoutWheel(delta) {
    if (!wheelState.towers || !wheelState.towers.length) {
      return;
    }
    const nextIndex = Math.min(
      Math.max(wheelState.activeIndex + delta, 0),
      wheelState.towers.length - 1,
    );
    if (nextIndex !== wheelState.activeIndex) {
      wheelState.activeIndex = nextIndex;
      renderLoadoutWheel();
    }
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
    // Prefer the active playfield bounds so the wheel stays inside the battlefield when a level is running.
    const playfield = safeGetPlayfield();
    const playfieldBounds =
      playfield?.isInteractiveLevelActive?.() && playfield?.container?.getBoundingClientRect?.()
        ? playfield.container.getBoundingClientRect()
        : null;
    const boundaryRect = loadoutContainer?.getBoundingClientRect?.() || playfieldBounds;
    const anchorCenterY = anchorRect.top + anchorRect.height / 2;
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const minLeft = (boundaryRect?.left ?? 0) + 8;
    const minTop = (boundaryRect?.top ?? 0) + 8;
    const maxLeft = (boundaryRect?.right ?? viewportWidth) - containerRect.width - 8;
    const maxTop = (boundaryRect?.bottom ?? viewportHeight) - containerRect.height - 8;
    const boundedMaxLeft = Math.max(minLeft, maxLeft);
    const boundedMaxTop = Math.max(minTop, maxTop);
    // Anchor the wheel to the slot's left edge so the glyph column sits directly atop the held slot.
    const desiredLeft = anchorRect.left;
    const desiredTop = anchorCenterY - containerRect.height / 2;
    const left = Math.min(boundedMaxLeft, Math.max(minLeft, desiredLeft));
    const top = Math.min(boundedMaxTop, Math.max(minTop, desiredTop));
    wheelState.container.style.left = `${left + scrollX}px`;
    wheelState.container.style.top = `${top + scrollY}px`;
  }

  /**
   * Render exactly 3 tower icons stacked vertically: previous, current (center), and next.
   * Simplified inline display with step-wise navigation.
   */
  function renderLoadoutWheel({ immediate = false } = {}) {
    const { list, towers } = wheelState;
    if (!list || !Array.isArray(towers) || !towers.length) {
      return;
    }
    const clampedIndex = Math.min(Math.max(wheelState.activeIndex, 0), towers.length - 1);
    wheelState.activeIndex = clampedIndex;
    list.innerHTML = '';

    // Calculate which 3 towers to show: previous, current, next
    const indicesToShow = [];
    const centerIndex = clampedIndex;
    
    // Previous tower (above current)
    if (centerIndex > 0) {
      indicesToShow.push({ index: centerIndex - 1, position: 'above' });
    } else {
      indicesToShow.push({ index: null, position: 'above' });
    }
    
    // Current tower (center/middle)
    indicesToShow.push({ index: centerIndex, position: 'center' });
    
    // Next tower (below current)
    if (centerIndex < towers.length - 1) {
      indicesToShow.push({ index: centerIndex + 1, position: 'below' });
    } else {
      indicesToShow.push({ index: null, position: 'below' });
    }
    
    // Render each visible tower icon
    indicesToShow.forEach(({ index, position }) => {
      const item = document.createElement('div');
      item.className = `tower-loadout-wheel__icon-simple tower-loadout-wheel__icon-simple--${position}`;
      
      if (index !== null) {
        const definition = towers[index];
        const art = safeCreateTowerIconElement(definition, {
          className: 'tower-loadout-wheel__icon-img',
          alt: `${definition.name} icon`,
        });
        if (art) {
          item.appendChild(art);
        }
        
        // Make the center tower tappable for selection
        if (position === 'center') {
          item.classList.add('tower-loadout-wheel__icon-simple--active');
          
          // Track if selection was already triggered to prevent double-firing on touch devices
          let selectionTriggered = false;
          const handleSelection = (event) => {
            if (selectionTriggered) {
              return;
            }
            event.stopPropagation();
            if (event.type === 'touchend') {
              event.preventDefault();
            }
            selectionTriggered = true;
            selectLoadoutTower(definition);
          };
          
          item.addEventListener('click', handleSelection);
          item.addEventListener('touchend', handleSelection);
        }
      } else {
        // Empty slot for when at start/end of list
        item.classList.add('tower-loadout-wheel__icon-simple--empty');
      }
      
      list.appendChild(item);
    });
  }

  /**
   * Apply the selected tower to the loadout slot.
   */
  function selectLoadoutTower(definition) {
    if (!definition) {
      return;
    }
    const slots = safeGetLoadoutSlots();
    if (Array.isArray(slots) && wheelState.slotIndex >= 0 && wheelState.slotIndex < slots.length) {
      const duplicateIndex = slots.findIndex((id, slotIdx) => id === definition.id && slotIdx !== wheelState.slotIndex);
      if (duplicateIndex !== -1) {
        slots[duplicateIndex] = null;
      }
      slots[wheelState.slotIndex] = definition.id;
      
      // Play the menu selection sound
      const audioManager = safeGetAudioManager();
      if (audioManager) {
        audioManager.playSfx('menuSelect');
      }
      
      renderTowerLoadout();
      safeSyncLoadoutToPlayfield();
    }
    closeLoadoutWheel();
  }

  /**
   * Open the wheel overlay anchored to a specific slot with simplified 3-icon display.
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
    container.className = 'tower-loadout-wheel tower-loadout-wheel--simplified';
    const list = document.createElement('div');
    list.className = 'tower-loadout-wheel__list tower-loadout-wheel__list--simplified';
    container.append(list);

    wheelState.container = container;
    wheelState.list = list;
    wheelState.slotIndex = slotIndex;
    wheelState.towers = towers;
    wheelState.activeIndex = activeIndex >= 0 ? activeIndex : 0;
    wheelState.anchorElement = anchorElement || null;

    if (wheelState.anchorElement) {
      wheelState.anchorElement.classList.add('tower-loadout-item--active-wheel');
    }

    // Mount the wheel on the body so it can escape the tray bounds while still aligning to the held slot.
    const host = document.body;
    host.append(container);

    renderLoadoutWheel({ immediate: true });

    // Handle scroll wheel events for step-wise navigation
    const handleScroll = (event) => {
      event.preventDefault();
      const delta = event.deltaY || 0;
      const direction = delta > 0 ? 1 : -1;
      shiftLoadoutWheel(direction);
    };
    
    wheelState.wheelHandler = handleScroll;
    list.addEventListener('wheel', wheelState.wheelHandler, { passive: false });

    // Anchor the wheel within the playfield during active levels to prevent bleed outside the battlefield.
    const playfield = safeGetPlayfield();
    const loadoutContainer =
      playfield?.isInteractiveLevelActive?.() && playfield?.container
        ? playfield.container
        : safeGetLoadoutElements()?.container || null;
    positionLoadoutWheel(anchorElement, loadoutContainer);

    wheelState.outsideHandler = (event) => {
      if (!container.contains(event.target) && !anchorElement?.contains(event.target)) {
        closeLoadoutWheel();
      }
    };
    document.addEventListener('pointerdown', wheelState.outsideHandler, { passive: true });
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
    closeLoadoutWheel,
  };
}
