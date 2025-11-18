import { getGreekTierInfo, tierToColor } from '../scripts/features/towers/tsadiTower.js';

/**
 * Generate a deterministic pseudo-random number generator seeded from a string.
 * Keeps molecule thumbnails consistent between refreshes while still feeling organic.
 * @param {string} seed - Unique identifier for the molecule formula.
 * @returns {Function} Pseudo-random generator returning [0,1).
 */
function createSeededRandom(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return () => {
    hash = Math.imul(hash ^ 0x9e3779b1, 0x85ebca6b);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 0xffffffff;
  };
}

/**
 * Translate a tier list into a Greek letter formula ordered from highest to lowest.
 * @param {Array<number>} tiers - Molecule tier recipe.
 * @returns {string} Formula text (e.g., "γ – β – α").
 */
function buildTierFormula(tiers = []) {
  if (!Array.isArray(tiers) || !tiers.length) {
    return 'Uncatalogued';
  }
  const ordered = [...tiers].sort((a, b) => b - a);
  return ordered
    .map((tier) => {
      if (tier === -1) {
        return '∅';
      }
      const greek = getGreekTierInfo(tier);
      return greek.letter || greek.name || '?';
    })
    .join(' – ');
}

/**
 * Render a generated thumbnail depicting the discovered molecule composition.
 * @param {HTMLCanvasElement} canvas - Destination canvas.
 * @param {Array<number>} tiers - Tier recipe used for layout and coloring.
 */
function renderMoleculeSketch(canvas, tiers = []) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const formulaKey = tiers.join('|') || 'empty';
  const random = createSeededRandom(formulaKey);
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, 'rgba(22, 28, 42, 0.95)');
  gradient.addColorStop(1, 'rgba(12, 16, 26, 0.95)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const nodes = tiers.map((tier, index) => {
    const theta = (index / Math.max(1, tiers.length)) * Math.PI * 2 + random() * 0.6;
    const radius = Math.min(width, height) * (0.25 + random() * 0.2);
    const centerX = width / 2 + Math.cos(theta) * radius;
    const centerY = height / 2 + Math.sin(theta) * radius;
    const glyph = getGreekTierInfo(tier);
    const nodeColor = tierToColor(tier);
    return { x: centerX, y: centerY, glyph: glyph.letter || '∅', color: nodeColor };
  });

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1;
  nodes.forEach((node, index) => {
    nodes.slice(index + 1).forEach((target) => {
      ctx.beginPath();
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    });
  });

  nodes.forEach((node) => {
    const radius = 12;
    ctx.fillStyle = node.color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(12, 16, 26, 0.9)';
    ctx.font = 'bold 16px "EB Garamond", "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.glyph, node.x, node.y);
  });
}

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
  let codexPanel = null;
  let codexList = null;
  let codexSummary = null;
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
    const availableRaw = simulation?.getAvailableBindingAgents?.()
      ?? (typeof getBindingAgentBank === 'function' ? getBindingAgentBank() : 0);
    const available = Number.isFinite(availableRaw) ? Math.max(0, availableRaw) : Infinity;
    const displayValue = Number.isFinite(available)
      ? available.toFixed(1)
      : '∞';

    if (handleElement) {
      if (available >= 1 || !Number.isFinite(available)) {
        handleElement.removeAttribute('hidden');
        handleElement.disabled = false;
      } else {
        handleElement.setAttribute('hidden', '');
      }
    }

    if (bindingStat) {
      const suffix = available === 1 ? 'Binding Agent' : 'Binding Agents';
      bindingStat.textContent = `${displayValue} ${suffix}`;
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

    const entryCount = recipes?.length || 0;
    if (codexSummary) {
      codexSummary.textContent = `(${entryCount} Entries: +${entryCount} particles/hour)`;
    }

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

      const formulaText = buildTierFormula(recipe.tiers);

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'tsadi-codex-entry__toggle';
      toggle.setAttribute('aria-expanded', 'false');

      const formula = document.createElement('span');
      formula.className = 'tsadi-codex-entry__formula';
      formula.textContent = formulaText;

      const title = document.createElement('span');
      title.className = 'tsadi-codex-entry__name';
      title.textContent = recipe.name;

      toggle.appendChild(formula);
      toggle.appendChild(title);

      const detail = document.createElement('div');
      detail.className = 'tsadi-codex-entry__detail';
      detail.hidden = true;

      const canvas = document.createElement('canvas');
      canvas.width = 260;
      canvas.height = 140;
      canvas.className = 'tsadi-codex-canvas';

      const description = document.createElement('p');
      description.className = 'tsadi-codex-entry__bonus';
      description.textContent = recipe.description || 'Recorded in the Alchemy Codex.';

      const tierLine = document.createElement('p');
      tierLine.className = 'tsadi-codex-entry__tiers';
      tierLine.textContent = `Formula: ${formulaText}`;

      detail.appendChild(canvas);
      detail.appendChild(tierLine);
      detail.appendChild(description);

      toggle.addEventListener('click', () => {
        const expanded = detail.hidden;
        detail.hidden = !expanded;
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        if (expanded) {
          renderMoleculeSketch(canvas, recipe.tiers);
        }
      });

      item.appendChild(toggle);
      item.appendChild(detail);
      codexList.appendChild(item);
    });
  }

  /**
   * Toggle the codex visibility while keeping the toggle label updated for accessibility.
   */
  function toggleCodex() {
    codexOpen = !codexOpen;
    if (codexPanel) {
      codexPanel.hidden = !codexOpen;
      codexPanel.setAttribute('aria-hidden', codexOpen ? 'false' : 'true');
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
    codexPanel = document.getElementById('tsadi-codex-panel');
    codexList = document.getElementById('tsadi-codex-list');
    codexSummary = document.getElementById('tsadi-codex-summary');
    bindingStat = document.getElementById('tsadi-binding-agent-count');

    bindPointerListeners();

    if (codexButton && codexPanel) {
      codexPanel.hidden = true;
      codexPanel.setAttribute('aria-hidden', 'true');
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
