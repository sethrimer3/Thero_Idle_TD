import { getGreekTierInfo, tierToColor } from '../scripts/features/towers/tsadiTower.js';
import { createTsadiMoleculeNameGenerator, TSADI_MOLECULE_LEXICON } from './tsadiMoleculeNameGenerator.js';
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

// Dedicated generator used to supply flavorful molecule aliases in the codex UI.
const tsadiCodexNameGenerator = createTsadiMoleculeNameGenerator('tsadi-codex-ui', TSADI_MOLECULE_LEXICON);

function rgbToRgba(color, alpha = 1) {
  const safeColor = color && typeof color === 'object' ? color : { r: 22, g: 28, b: 42 };
  return `rgba(${safeColor.r ?? 22}, ${safeColor.g ?? 28}, ${safeColor.b ?? 42}, ${alpha})`;
}

/**
 * Present a unique tier list using player-facing numbering (Null = 0, Alpha = 1).
 * @param {Array<number>} tiers - Raw tier collection.
 * @returns {string} Sequence label suitable for display.
 */
function formatDisplayTierSequence(tiers = []) {
  if (!Array.isArray(tiers)) {
    return '';
  }
  const normalized = Array.from(
    new Set(tiers.filter((tier) => Number.isFinite(tier)).map((tier) => Math.floor(tier))),
  ).sort((a, b) => a - b);
  return normalized.map((tier) => Math.max(0, tier + 1)).join('-');
}

/**
 * Present a human-readable tier list using actual Greek letters to match the codex flavor text.
 * @param {Array<number>} tiers - Raw tier collection.
 * @returns {string} Sequence label using Greek letters (e.g., α-β instead of Alpha-Beta).
 */
function formatGreekTierSequence(tiers = []) {
  if (!Array.isArray(tiers)) {
    return '';
  }
  const normalized = Array.from(
    new Set(tiers.filter((tier) => Number.isFinite(tier)).map((tier) => Math.floor(tier))),
  ).sort((a, b) => a - b);
  return normalized
    .map((tier) => {
      const tierInfo = getGreekTierInfo(tier);
      // Use actual Greek letters (α, β, γ) instead of English names (Alpha, Beta, Gamma)
      return tierInfo?.letter || tierInfo?.name || `Tier ${Math.max(0, tier + 1)}`;
    })
    .join('-');
}

/**
 * Strip the legacy combo prefix so molecule sketches show clean tier sequences.
 * @param {string} label - Raw molecule identifier or name.
 * @returns {string} Label without the combo prefix.
 */
function stripCombinationPrefix(label = '') {
  if (typeof label !== 'string') {
    return '';
  }
  return label.replace(/^combo-/i, '');
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
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000000';
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
const WAALS_TIER_2_UNLOCK = 11; // Tier 12 in player-facing terms
const WAALS_TIER_3_UNLOCK = 15; // Tier 16 in player-facing terms
const WAALS_AUTO_UNLOCK = 23; // Tier 24 in player-facing terms

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
  let automaticMode = false;
  let handleLongPressTimeout = null;

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
        name: stripCombinationPrefix(recipe),
        tiers: [],
        description: 'Recorded in the Alchemy Codex.',
        particleCount: 0,
      };
    }
    if (typeof recipe === 'object') {
      const id = recipe.id || recipe.name || 'molecule';
      const tiers = Array.isArray(recipe.tiers) ? recipe.tiers : [];
      const defaultSequence = formatDisplayTierSequence(tiers) || id;
      const name = typeof recipe.name === 'string' ? stripCombinationPrefix(recipe.name) : defaultSequence;
      const description = typeof recipe.description === 'string' ? recipe.description : 'Recorded in the Alchemy Codex.';
      const particleCount = Number.isFinite(recipe.particleCount)
        ? Math.max(0, recipe.particleCount)
        : new Set(tiers).size;
      const displayName = name || defaultSequence;
      return { ...recipe, id, name: displayName, tiers, description, particleCount };
    }
    return null;
  }

  /**
   * Attach flavorful aliases to codex entries while preserving player-facing tier information.
   * @param {Array<Object>} recipes - Molecule descriptors sourced from simulation or persistence.
   * @returns {Array<Object>} Recipes enriched with generator-backed names.
   */
  function prepareCodexRecipes(recipes = []) {
    const prepared = recipes.map((recipe) => {
      if (!recipe || typeof recipe !== 'object') {
        return recipe;
      }
      const hasReadableName = typeof recipe.name === 'string' && /[a-z]/i.test(recipe.name);
      // Drop purely numeric names so the generator can supply a more thematic alias.
      if (hasReadableName) {
        return recipe;
      }
      const { name: _ignoredName, ...rest } = recipe;
      return rest;
    });
    return tsadiCodexNameGenerator.normalizeRecipes(prepared);
  }

  /**
   * Format the codex title string using Greek tier names, numeric tiers, and the generator alias.
   * @param {Object} recipe - Molecule descriptor ready for display.
   * @returns {string} Human-readable title for the codex entry.
   */
  function formatCodexEntryTitle(recipe = {}) {
    const tiers = Array.isArray(recipe.tiers) ? recipe.tiers : [];
    const greekSequence = formatGreekTierSequence(tiers);
    const numericSequence = formatDisplayTierSequence(tiers);
    const alias = typeof recipe.name === 'string' && recipe.name ? recipe.name : 'Unnamed Molecule';

    if (greekSequence && numericSequence) {
      return `${greekSequence} (${numericSequence}) ${alias}`;
    }
    if (greekSequence) {
      return `${greekSequence} ${alias}`;
    }
    if (numericSequence) {
      return `${numericSequence} ${alias}`;
    }
    return alias;
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
   * Calculate the maximum number of simultaneous Waals particles based on highest tier reached.
   * @returns {number} Maximum simultaneous Waals particles (1, 2, or 3)
   */
  function getMaxSimultaneousWaals() {
    const tier = getHighestTierReached();
    if (tier >= WAALS_TIER_3_UNLOCK) {
      return 3;
    }
    if (tier >= WAALS_TIER_2_UNLOCK) {
      return 2;
    }
    if (tier >= WAALS_UNLOCK_TIER) {
      return 1;
    }
    return 0;
  }

  /**
   * Check if automatic Waals placement mode is unlocked.
   * @returns {boolean} True if player has reached Tier 24+
   */
  function isAutomaticModeUnlocked() {
    return getHighestTierReached() >= WAALS_AUTO_UNLOCK;
  }

  /**
   * Count the number of currently placed Waals particles.
   * @returns {number} Number of binding agents currently on the field
   */
  function getPlacedWaalsCount() {
    const simulation = typeof getTsadiSimulation === 'function' ? getTsadiSimulation() : null;
    if (!simulation || !simulation.bindingAgents) {
      return 0;
    }
    return simulation.bindingAgents.length;
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
    const maxSimultaneous = getMaxSimultaneousWaals();
    const placedCount = getPlacedWaalsCount();
    const automaticUnlocked = isAutomaticModeUnlocked();

    if (handleElement) {
      if (!waalsUnlocked) {
        handleElement.setAttribute('hidden', '');
        handleElement.setAttribute('aria-hidden', 'true');
        handleElement.disabled = true;
        handleElement.classList.remove('tsadi-binding-handle--depleted');
        handleElement.classList.remove('tsadi-binding-handle--automatic');
      } else {
        // Show handle if we can place (either have stock or automatic mode ensures placement)
        const canPlaceManually = placedCount < maxSimultaneous && ((available >= 1) || !Number.isFinite(available));
        const showHandle = canPlaceManually || automaticUnlocked;
        
        handleElement.toggleAttribute('hidden', !showHandle);
        handleElement.setAttribute('aria-hidden', showHandle ? 'false' : 'true');
        handleElement.disabled = !showHandle;
        handleElement.classList.toggle('tsadi-binding-handle--depleted', !showHandle);
        
        // Add glow effect when automatic mode is active
        handleElement.classList.toggle('tsadi-binding-handle--automatic', automaticMode);
      }
    }

    if (bindingStat) {
      if (!waalsUnlocked) {
        bindingStat.textContent = `Reach Tier ${WAALS_UNLOCK_TIER + 1} to unlock Waals bonds.`;
      } else {
        const suffix = available === 1 ? 'Waal' : 'Waals';
        let statusText = `${displayValue} ${suffix}`;
        
        // Show placement limit
        if (automaticUnlocked) {
          if (automaticMode) {
            statusText += ` (Auto: ${placedCount}/${maxSimultaneous})`;
          } else {
            statusText += ` (${placedCount}/${maxSimultaneous}, Auto available)`;
          }
        } else {
          statusText += ` (${placedCount}/${maxSimultaneous})`;
        }
        
        bindingStat.textContent = statusText;
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
    const namedRecipes = prepareCodexRecipes(recipes);

    codexList.innerHTML = '';

    const entryCount = namedRecipes?.length || 0;
    const hourlyBonus = namedRecipes.reduce(
      (total, recipe) => total + Math.max(0, recipe.particleCount || 0),
      0,
    );
    if (codexSummary) {
      codexSummary.textContent = `(${entryCount} Entries: +${hourlyBonus} particles/hour)`;
    }

    if (!namedRecipes?.length) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'tsadi-codex-empty';
      emptyItem.textContent = 'No molecules discovered yet.';
      codexList.appendChild(emptyItem);
      return;
    }

    let expandedEntry = null;
    namedRecipes.forEach((recipe) => {
      const item = document.createElement('li');
      item.className = 'tsadi-codex-entry';

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'tsadi-codex-entry__toggle';
      toggle.setAttribute('aria-expanded', 'false');

      const title = document.createElement('span');
      title.className = 'tsadi-codex-entry__name';
      title.textContent = formatCodexEntryTitle(recipe);

      toggle.appendChild(title);

      const detail = document.createElement('div');
      detail.className = 'tsadi-codex-entry__detail';
      detail.hidden = true;
      detail.setAttribute('aria-hidden', 'true');

      const canvas = document.createElement('canvas');
      canvas.width = 260;
      canvas.height = 140;
      canvas.className = 'tsadi-codex-canvas';

      detail.appendChild(canvas);

      toggle.addEventListener('click', () => {
        const expanded = detail.hidden;
        if (expandedEntry && expandedEntry.detail !== detail) {
          expandedEntry.detail.hidden = true;
          expandedEntry.detail.setAttribute('aria-hidden', 'true');
          expandedEntry.toggle.setAttribute('aria-expanded', 'false');
        }
        if (expanded) {
          detail.hidden = false;
          detail.setAttribute('aria-hidden', 'false');
          toggle.setAttribute('aria-expanded', 'true');
          renderMoleculeSketch(canvas, recipe);
          expandedEntry = { detail, toggle };
        } else {
          detail.hidden = true;
          detail.setAttribute('aria-hidden', 'true');
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
   * Toggle automatic Waals placement mode (Tier 24+ only).
   */
  function toggleAutomaticMode() {
    if (!isAutomaticModeUnlocked()) {
      return;
    }
    
    automaticMode = !automaticMode;
    updateBindingAgentDisplay();
    
    // When enabling automatic mode, immediately try to fill to max
    if (automaticMode) {
      ensureMaxWaalsPlaced();
    }
  }

  /**
   * Ensure that the maximum number of Waals particles are placed when in automatic mode.
   * This function is called periodically to maintain the desired count.
   */
  function ensureMaxWaalsPlaced() {
    if (!automaticMode || !isAutomaticModeUnlocked()) {
      return;
    }
    
    const simulation = typeof getTsadiSimulation === 'function' ? getTsadiSimulation() : null;
    if (!simulation || !simulation.placeBindingAgent) {
      return;
    }
    
    const maxSimultaneous = getMaxSimultaneousWaals();
    const placedCount = getPlacedWaalsCount();
    const available = simulation.getAvailableBindingAgents?.() || 0;
    
    // Try to place additional Waals particles up to the max
    const neededCount = maxSimultaneous - placedCount;
    for (let i = 0; i < neededCount && available > 0; i++) {
      // Find a random valid position to place
      if (!canvasElement) continue;
      
      const rect = canvasElement.getBoundingClientRect();
      const margin = 30;
      const x = margin + Math.random() * (rect.width - margin * 2);
      const y = margin + Math.random() * (rect.height - margin * 2);
      
      const placed = simulation.placeBindingAgent({ x, y });
      if (placed && typeof setBindingAgentBank === 'function') {
        setBindingAgentBank(simulation.getAvailableBindingAgents());
      }
    }
    
    updateBindingAgentDisplay();
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
   * Clear the long-press timer for the handle button.
   */
  function clearHandleLongPress() {
    if (handleLongPressTimeout) {
      clearTimeout(handleLongPressTimeout);
      handleLongPressTimeout = null;
    }
  }

  /**
   * Attempt to disband an anchored binding agent after a sustained hold gesture.
   * @param {PointerEvent} event - Pointer event located on the canvas.
   */
  function scheduleDisband(event) {
    const simulation = typeof getTsadiSimulation === 'function' ? getTsadiSimulation() : null;
    if (!simulation || typeof simulation.disbandBindingAgentAt !== 'function') {
      return false;
    }

    const coords = toCanvasCoords(event);
    const nearbyAgent = simulation.findBindingAgentNear?.(coords, 4);
    if (!nearbyAgent) {
      return false;
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
    
    return true;
  }

  /**
   * Create an interactive wave force at the pointer location.
   * @param {PointerEvent} event - Pointer event on the canvas.
   */
  function createInteractiveWave(event) {
    const simulation = typeof getTsadiSimulation === 'function' ? getTsadiSimulation() : null;
    if (!simulation || typeof simulation.createInteractiveWave !== 'function') {
      return;
    }

    const coords = toCanvasCoords(event);
    simulation.createInteractiveWave(coords.x, coords.y);
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
      const placedCount = getPlacedWaalsCount();
      const maxSimultaneous = getMaxSimultaneousWaals();
      
      // Check if we can place another Waals particle
      if (placedCount < maxSimultaneous) {
        const placed = simulation.placeBindingAgent(coords);
        simulation.clearBindingAgentPreview?.();
        if (placed && typeof setBindingAgentBank === 'function') {
          setBindingAgentBank(simulation.getAvailableBindingAgents());
        }
      } else {
        // At limit, just clear the preview
        simulation.clearBindingAgentPreview?.();
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
    
    const placedCount = getPlacedWaalsCount();
    const maxSimultaneous = getMaxSimultaneousWaals();
    
    // Can't start placement if we're at the limit
    if (placedCount >= maxSimultaneous) {
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
        // If automatic mode is unlocked, start a long-press timer to toggle it
        if (isAutomaticModeUnlocked()) {
          clearHandleLongPress();
          handleLongPressTimeout = setTimeout(() => {
            toggleAutomaticMode();
            // Prevent placement drag from starting after long press
            isPlacing = false;
            const simulation = typeof getTsadiSimulation === 'function' ? getTsadiSimulation() : null;
            simulation?.clearBindingAgentPreview?.();
          }, 500); // 500ms long press
        }
        
        // Start normal placement
        startPlacement(event);
      });
      
      handleElement.addEventListener('pointermove', () => {
        // Clear long-press if user moves while holding
        clearHandleLongPress();
      });
      
      handleElement.addEventListener('pointerup', () => {
        clearHandleLongPress();
      });
      
      handleElement.addEventListener('pointercancel', () => {
        clearHandleLongPress();
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
        const scheduledDisband = scheduleDisband(event);
        
        // Create interactive wave if click didn't hit a binding agent
        if (!scheduledDisband) {
          createInteractiveWave(event);
        }
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

    // Periodically check if we need to auto-place Waals particles when in automatic mode
    setInterval(() => {
      if (automaticMode) {
        ensureMaxWaalsPlaced();
      }
    }, 2000); // Check every 2 seconds

    updateBindingAgentDisplay();
    refreshCodexList();
  }

  return {
    initializeTsadiBindingUi,
    updateBindingAgentDisplay,
    refreshCodexList,
  };
}
