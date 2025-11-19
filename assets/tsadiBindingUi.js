import { getGreekTierInfo, tierToColor } from '../scripts/features/towers/tsadiTower.js';
import { samplePaletteGradient } from './colorSchemeUtils.js';

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

function rgbToRgba(color, alpha = 1) {
  const safeColor = color && typeof color === 'object' ? color : { r: 22, g: 28, b: 42 };
  return `rgba(${safeColor.r ?? 22}, ${safeColor.g ?? 28}, ${safeColor.b ?? 42}, ${alpha})`;
}

/**
 * Render a generated thumbnail depicting the discovered molecule composition.
 * @param {HTMLCanvasElement} canvas - Destination canvas.
 * @param {{tiers?:Array<number>,name?:string}} recipe - Molecule metadata for layout and labeling.
 */
function renderMoleculeSketch(canvas, recipe = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const tiers = Array.isArray(recipe.tiers) ? recipe.tiers : [];
  const name = typeof recipe.name === 'string' ? recipe.name : '';
  const formulaKey = tiers.join('|') || 'empty';
  const random = createSeededRandom(formulaKey);
  const width = canvas.width;
  const height = canvas.height;
  const backgroundStart = samplePaletteGradient(0.05);
  const backgroundEnd = samplePaletteGradient(0.85);

  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, rgbToRgba(backgroundStart, 0.92));
  gradient.addColorStop(1, rgbToRgba(backgroundEnd, 0.92));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  if (name) {
    ctx.font = '600 18px "EB Garamond", "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.strokeText(name, width / 2, 10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillText(name, width / 2, 10);
  }

  const strandColor = rgbToRgba(samplePaletteGradient(0.4), 0.22);
  const labelOffsetY = name ? 12 : 0;
  const nodes = tiers.map((tier, index) => {
    const theta = (index / Math.max(1, tiers.length)) * Math.PI * 2 + random() * 0.6;
    const radius = Math.min(width, height) * (0.25 + random() * 0.2);
    const centerX = width / 2 + Math.cos(theta) * radius;
    const centerY = height / 2 + Math.sin(theta) * radius + labelOffsetY;
    const glyph = getGreekTierInfo(tier);
    const nodeColor = tierToColor(tier, samplePaletteGradient);
    return { x: centerX, y: centerY, glyph: glyph.letter || '∅', color: nodeColor };
  });

  ctx.strokeStyle = strandColor;
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

const WAALS_UNLOCK_TIER = 5;

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
        particleCount: 0,
      };
    }
    if (typeof recipe === 'object') {
      const id = recipe.id || recipe.name || 'molecule';
      const name = typeof recipe.name === 'string' ? recipe.name : id;
      const tiers = Array.isArray(recipe.tiers) ? recipe.tiers : [];
      const description = typeof recipe.description === 'string' ? recipe.description : 'Recorded in the Alchemy Codex.';
      const particleCount = Number.isFinite(recipe.particleCount)
        ? Math.max(0, recipe.particleCount)
        : new Set(tiers).size;
      return { ...recipe, id, name, tiers, description, particleCount };
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

  function getHighestTierReached() {
    return Math.max(0, Math.floor(Number(spireResourceState?.tsadi?.stats?.highestTier) || 0));
  }

  function isWaalsUnlocked() {
    return getHighestTierReached() >= WAALS_UNLOCK_TIER;
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
    const waalsUnlocked = isWaalsUnlocked();

    if (handleElement) {
      if (!waalsUnlocked) {
        handleElement.setAttribute('hidden', '');
        handleElement.setAttribute('aria-hidden', 'true');
        handleElement.disabled = true;
        handleElement.classList.remove('tsadi-binding-handle--depleted');
      } else {
        handleElement.removeAttribute('hidden');
        handleElement.setAttribute('aria-hidden', 'false');
        const canPlace = (available >= 1) || !Number.isFinite(available);
        handleElement.disabled = !canPlace;
        handleElement.classList.toggle('tsadi-binding-handle--depleted', !canPlace);
      }
    }

    if (bindingStat) {
      if (!waalsUnlocked) {
        bindingStat.textContent = `Reach Tier ${WAALS_UNLOCK_TIER} to unlock Waals bonds.`;
      } else {
        const suffix = available === 1 ? 'Waal' : 'Waals';
        bindingStat.textContent = `${displayValue} ${suffix}`;
      }
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
    const hourlyBonus = recipes.reduce((total, recipe) => total + Math.max(0, recipe.particleCount || 0), 0);
    if (codexSummary) {
      codexSummary.textContent = `(${entryCount} Entries: +${hourlyBonus} particles/hour)`;
    }

    if (!recipes?.length) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'tsadi-codex-empty';
      emptyItem.textContent = 'No molecules discovered yet.';
      codexList.appendChild(emptyItem);
      return;
    }

    let expandedEntry = null;
    recipes.forEach((recipe) => {
      const item = document.createElement('li');
      item.className = 'tsadi-codex-entry';

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'tsadi-codex-entry__toggle';
      toggle.setAttribute('aria-expanded', 'false');

      const title = document.createElement('span');
      title.className = 'tsadi-codex-entry__name';
      title.textContent = recipe.name;

      toggle.appendChild(title);

      const detail = document.createElement('div');
      detail.className = 'tsadi-codex-entry__detail';
      detail.hidden = true;

      const canvas = document.createElement('canvas');
      canvas.width = 260;
      canvas.height = 140;
      canvas.className = 'tsadi-codex-canvas';

      detail.appendChild(canvas);

      toggle.addEventListener('click', () => {
        const expanded = detail.hidden;
        if (expandedEntry && expandedEntry.detail !== detail) {
          expandedEntry.detail.hidden = true;
          expandedEntry.toggle.setAttribute('aria-expanded', 'false');
        }
        if (expanded) {
          detail.hidden = false;
          toggle.setAttribute('aria-expanded', 'true');
          renderMoleculeSketch(canvas, recipe);
          expandedEntry = { detail, toggle };
        } else {
          detail.hidden = true;
          toggle.setAttribute('aria-expanded', 'false');
          expandedEntry = null;
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

  function attemptCodexCollection(event) {
    const simulation = typeof getTsadiSimulation === 'function' ? getTsadiSimulation() : null;
    if (!simulation || typeof simulation.collectPendingMoleculesAt !== 'function') {
      return false;
    }
    const collected = simulation.collectPendingMoleculesAt(toCanvasCoords(event));
    if (!collected) {
      return false;
    }
    if (typeof event?.stopPropagation === 'function') {
      event.stopPropagation();
    }
    if (typeof event?.preventDefault === 'function') {
      event.preventDefault();
    }
    updateBindingAgentDisplay();
    return true;
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
        if (attemptCodexCollection(event)) {
          return;
        }
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
