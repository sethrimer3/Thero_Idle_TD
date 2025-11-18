/**
 * UI controller for Tsadi binding agents and the Alchemy Codex.
 * Handles drag-to-place interactions, long-press disbanding, and discovered molecule listings.
 *
 * @param {Object} options - Dependency injection container.
 * @param {Function} options.getTsadiSimulation - Returns the active Tsadi simulation instance.
 * @param {Function} options.getBindingAgentBank - Reads the persisted binding agent stock.
 * @param {Function} options.setBindingAgentBank - Persists the latest binding agent stock.
 * @param {Object} options.spireResourceState - Shared spire resource state for fallback discovery data.
 * @returns {{ initializeTsadiBindingUi: Function, updateBindingAgentDisplay: Function, refreshCodexList: Function }}
 */
export function createTsadiBindingUi({
  getTsadiSimulation,
  getBindingAgentBank,
  setBindingAgentBank,
  spireResourceState,
}) {
  let basinElement = null;
  let canvasElement = null;
  let handleElement = null;
  let codexButton = null;
  let codexList = null;
  let bindingStat = null;

  let isPlacing = false;
  let holdTimeout = null;
  let holdTriggered = false;
  let codexOpen = false;

  /**
   * Normalize stored molecule entries so legacy string saves still render.
   * @param {Object|string} recipe - Persisted molecule entry.
   * @returns {Object|null} Molecule descriptor or null when invalid.
   */
  function normalizeRecipe(recipe) {
    if (!recipe) {
      return null;
    }
    if (typeof recipe === 'string') {
      return {
        id: recipe,
        name: recipe,
        tiers: [],
        description: 'Recorded in the Alchemy Codex.',
      };
    }
    if (typeof recipe === 'object') {
      const id = recipe.id || recipe.name || 'molecule';
      const name = typeof recipe.name === 'string' ? recipe.name : id;
      const tiers = Array.isArray(recipe.tiers) ? recipe.tiers : [];
      const description = typeof recipe.description === 'string' ? recipe.description : 'Recorded in the Alchemy Codex.';
      return { ...recipe, id, name, tiers, description };
    }
    return null;
  }

  /**
   * Convert a pointer event into canvas-relative coordinates.
   * @param {PointerEvent} event - Pointer event emitted within the Tsadi basin.
   * @returns {{x:number, y:number}} Canvas-space coordinates.
   */
  function toCanvasCoords(event) {
    const rect = canvasElement ? canvasElement.getBoundingClientRect() : { left: 0, top: 0 };
    return {
      x: (event.clientX || 0) - rect.left,
      y: (event.clientY || 0) - rect.top,
    };
  }

  /**
   * Sync the binding agent stock display and button visibility with live data.
   */
  function updateBindingAgentDisplay() {
    const simulation = typeof getTsadiSimulation === 'function' ? getTsadiSimulation() : null;
    const available = simulation?.getAvailableBindingAgents?.()
      ?? (typeof getBindingAgentBank === 'function' ? getBindingAgentBank() : 0);

    if (handleElement) {
      if (available >= 1) {
        handleElement.removeAttribute('hidden');
        handleElement.disabled = false;
      } else {
        handleElement.setAttribute('hidden', '');
      }
    }

    if (bindingStat) {
      const suffix = available === 1 ? 'Binding Agent' : 'Binding Agents';
      bindingStat.textContent = `${available.toFixed(1)} ${suffix}`;
    }
  }

  /**
   * Populate the Alchemy Codex with discovered molecules only.
   */
  function refreshCodexList() {
    if (!codexList) return;

    const simulation = typeof getTsadiSimulation === 'function' ? getTsadiSimulation() : null;
    const discoveredRecipes = simulation?.getDiscoveredMolecules?.();
    const fallbackRecipes = Array.isArray(spireResourceState?.tsadi?.discoveredMolecules)
      ? spireResourceState.tsadi.discoveredMolecules
      : [];
    const recipes = (Array.isArray(discoveredRecipes) ? discoveredRecipes : fallbackRecipes)
      .map(normalizeRecipe)
      .filter((recipe) => recipe && recipe.name);

    codexList.innerHTML = '';

    if (!recipes?.length) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'tsadi-codex-empty';
      emptyItem.textContent = 'No molecules discovered yet.';
      codexList.appendChild(emptyItem);
      return;
    }

    recipes.forEach((recipe) => {
      const item = document.createElement('li');
      item.className = 'tsadi-codex-entry';
      const heading = document.createElement('div');
      heading.className = 'tsadi-codex-entry__title';
      heading.textContent = recipe.name;
      const tiers = document.createElement('div');
      tiers.className = 'tsadi-codex-entry__tiers';
      tiers.textContent = `Requires: ${recipe.tiers.map((tier) => tier === -1 ? 'Null' : `Tier ${tier}`).join(', ')}`;
      const bonus = document.createElement('p');
      bonus.className = 'tsadi-codex-entry__bonus';
      bonus.textContent = recipe.description;
      item.appendChild(heading);
      item.appendChild(tiers);
      item.appendChild(bonus);
      codexList.appendChild(item);
    });
  }

  /**
   * Toggle the codex visibility while keeping the toggle label updated for accessibility.
   */
  function toggleCodex() {
    codexOpen = !codexOpen;
    if (codexList) {
      codexList.hidden = !codexOpen;
      codexList.setAttribute('aria-hidden', codexOpen ? 'false' : 'true');
    }
    if (codexButton) {
      codexButton.setAttribute('aria-expanded', codexOpen ? 'true' : 'false');
      codexButton.textContent = codexOpen ? 'Hide Alchemy Codex' : 'Show Alchemy Codex';
    }
  }

  /**
   * Clear any in-progress long-press timers to avoid accidental disbands.
   */
  function clearHoldTimer() {
    if (holdTimeout) {
      clearTimeout(holdTimeout);
      holdTimeout = null;
    }
    holdTriggered = false;
  }

  /**
   * Attempt to disband an anchored binding agent after a sustained hold gesture.
   * @param {PointerEvent} event - Pointer event located on the canvas.
   */
  function scheduleDisband(event) {
    const simulation = typeof getTsadiSimulation === 'function' ? getTsadiSimulation() : null;
    if (!simulation || typeof simulation.disbandBindingAgentAt !== 'function') {
      return;
    }

    const coords = toCanvasCoords(event);
    const nearbyAgent = simulation.findBindingAgentNear?.(coords, 4);
    if (!nearbyAgent) {
      return;
    }

    event.stopPropagation();
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    holdTimeout = setTimeout(() => {
      holdTriggered = simulation.disbandBindingAgentAt(coords);
      if (holdTriggered) {
        const latest = simulation.getAvailableBindingAgents?.();
        if (Number.isFinite(latest) && typeof setBindingAgentBank === 'function') {
          setBindingAgentBank(latest);
        }
        updateBindingAgentDisplay();
        refreshCodexList();
      }
    }, 400);
  }

  function handlePointerMove(event) {
    if (!isPlacing) {
      return;
    }
    const simulation = typeof getTsadiSimulation === 'function' ? getTsadiSimulation() : null;
    if (!simulation || typeof simulation.setBindingAgentPreview !== 'function') {
      return;
    }
    simulation.setBindingAgentPreview(toCanvasCoords(event));
  }

  function handlePointerUp(event) {
    clearHoldTimer();
    const simulation = typeof getTsadiSimulation === 'function' ? getTsadiSimulation() : null;

    if (isPlacing && simulation?.placeBindingAgent) {
      const coords = toCanvasCoords(event);
      const placed = simulation.placeBindingAgent(coords);
      simulation.clearBindingAgentPreview?.();
      if (placed && typeof setBindingAgentBank === 'function') {
        setBindingAgentBank(simulation.getAvailableBindingAgents());
      }
      updateBindingAgentDisplay();
    }

    isPlacing = false;
  }

  function handlePointerCancel() {
    clearHoldTimer();
    const simulation = typeof getTsadiSimulation === 'function' ? getTsadiSimulation() : null;
    simulation?.clearBindingAgentPreview?.();
    isPlacing = false;
  }

  /**
   * Begin dragging a binding agent from the overlay button.
   * @param {PointerEvent} event - Pointer down event on the spawn handle.
   */
  function startPlacement(event) {
    const simulation = typeof getTsadiSimulation === 'function' ? getTsadiSimulation() : null;
    if (!simulation || typeof simulation.setBindingAgentPreview !== 'function') {
      return;
    }
    if ((simulation.getAvailableBindingAgents?.() || 0) < 1) {
      return;
    }

    isPlacing = true;
    simulation.setBindingAgentPreview(toCanvasCoords(event));
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
  }

  /**
   * Bind pointer listeners used for placement and disbanding interactions.
   */
  function bindPointerListeners() {
    if (handleElement) {
      handleElement.addEventListener('pointerdown', (event) => {
        startPlacement(event);
      });
    }

    if (basinElement) {
      basinElement.addEventListener('pointermove', handlePointerMove);
      basinElement.addEventListener('pointerup', handlePointerUp);
      basinElement.addEventListener('pointercancel', handlePointerCancel);
    }

    if (canvasElement) {
      canvasElement.addEventListener('pointerdown', (event) => {
        scheduleDisband(event);
      });
      canvasElement.addEventListener('pointermove', () => {
        if (!holdTriggered) {
          clearHoldTimer();
        }
      });
      canvasElement.addEventListener('pointerup', (event) => {
        if (holdTriggered && typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        clearHoldTimer();
      });
      canvasElement.addEventListener('pointercancel', clearHoldTimer);
    }
  }

  /**
   * Wire DOM references and event listeners for the Tsadi binding agent UI.
   */
  function initializeTsadiBindingUi() {
    basinElement = document.getElementById('tsadi-basin');
    canvasElement = document.getElementById('tsadi-canvas');
    handleElement = document.getElementById('tsadi-binding-handle');
    codexButton = document.getElementById('tsadi-codex-button');
    codexList = document.getElementById('tsadi-codex-list');
    bindingStat = document.getElementById('tsadi-binding-agent-count');

    bindPointerListeners();

    if (codexButton && codexList) {
      codexList.hidden = true;
      codexList.setAttribute('aria-hidden', 'true');
      codexButton.setAttribute('aria-expanded', 'false');
      codexButton.addEventListener('click', () => {
        toggleCodex();
      });
    }

    updateBindingAgentDisplay();
    refreshCodexList();
  }

  return {
    initializeTsadiBindingUi,
    updateBindingAgentDisplay,
    refreshCodexList,
  };
}
