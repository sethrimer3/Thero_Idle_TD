import { formatGameNumber, formatWholeNumber } from '../scripts/core/formatting.js';
import { moteGemState, resolveGemDefinition } from './enemies.js';
import {
  getTowerDefinitions,
  getTowerDefinition,
  getTowerUnlockState,
  getDiscoveredVariables,
} from './towersTab.js';
import {
  getCraftedEquipment,
  getEquipmentAssignment,
  assignEquipmentToTower,
  addEquipmentListener,
} from './equipment.js';

// Establish the ordered rarity tiers so the tier builder can follow the droptable cadence.
const GEM_TIER_SEQUENCE = [
  'sunstone',
  'citrine',
  'emerald',
  'sapphire',
  'iolite',
  'amethyst',
  'diamond',
  'nullstone',
];

// Encode the base tier pricing before subsequent tiers multiply the ledger.
const BASE_TIER_REQUIREMENTS = [
  { gemId: 'sunstone', amount: 1 },
  { gemId: 'ruby', amount: 10 },
  { gemId: 'quartz', amount: 100 },
];

// Track how large the nullstone requirement should become before halting the tier generator.
const MAX_NULLSTONE_REQUIREMENT = 100;

// Cache the computed tier array so rendering can reuse the deterministic blueprint.
const VARIABLE_TIER_BLUEPRINTS = buildVariableTierBlueprints();

// Store crafting overlay references so the motes tab can summon and dismiss the menu gracefully.
const craftingElements = {
  overlay: null,
  closeButton: null,
  list: null,
  equipmentList: null,
  equipmentEmpty: null,
  lastFocus: null,
};

let revealOverlayCallback = null;
let scheduleOverlayHideCallback = null;
let requestInventoryRefresh = null;
let removeEquipmentListener = null;

// Format a tower label using its symbol and name for assignment summaries.
function getTowerLabel(towerId) {
  const definition = getTowerDefinition(towerId);
  if (!definition) {
    return towerId;
  }
  const symbol = typeof definition.symbol === 'string' ? definition.symbol.trim() : '';
  const name = typeof definition.name === 'string' ? definition.name.trim() : towerId;
  return symbol ? `${symbol} ${name}` : name;
}

// Render the crafted equipment roster with assignment controls.
function renderCraftedEquipmentList() {
  const { equipmentList, equipmentEmpty } = craftingElements;
  if (!equipmentList || !equipmentEmpty) {
    return;
  }

  equipmentList.innerHTML = '';
  const crafted = getCraftedEquipment();
  if (!crafted.length) {
    equipmentList.hidden = true;
    equipmentList.setAttribute('aria-hidden', 'true');
    equipmentEmpty.hidden = false;
    equipmentEmpty.setAttribute('aria-hidden', 'false');
    return;
  }

  equipmentList.hidden = false;
  equipmentList.setAttribute('aria-hidden', 'false');
  equipmentEmpty.hidden = true;
  equipmentEmpty.setAttribute('aria-hidden', 'true');

  const unlockState = getTowerUnlockState();
  const unlockedSet = unlockState?.unlocked instanceof Set ? unlockState.unlocked : new Set();
  const allDefinitions = getTowerDefinitions();
  const unlockedTowers = allDefinitions.filter((definition) => unlockedSet.has(definition.id));

  const fragment = document.createDocumentFragment();
  crafted.forEach((equipment) => {
    const item = document.createElement('li');
    item.className = 'crafted-equipment-item';
    item.setAttribute('data-equipment-id', equipment.id);

    const header = document.createElement('div');
    header.className = 'crafted-equipment-item__header';

    const title = document.createElement('h3');
    title.className = 'crafted-equipment-item__title';
    title.textContent = equipment.name;

    header.append(title);

    if (equipment.type) {
      const type = document.createElement('span');
      type.className = 'crafted-equipment-item__type';
      type.textContent = equipment.type;
      header.append(type);
    }

    item.append(header);

    if (equipment.description) {
      const description = document.createElement('p');
      description.className = 'crafted-equipment-item__description';
      description.textContent = equipment.description;
      item.append(description);
    }

    const assignmentId = getEquipmentAssignment(equipment.id);
    const assignedLabel = assignmentId ? getTowerLabel(assignmentId) : null;

    const summary = document.createElement('p');
    summary.className = 'crafted-equipment-item__summary';
    summary.textContent = assignmentId
      ? `Equipped to ${assignedLabel}`
      : 'Not equipped';
    item.append(summary);

    const select = document.createElement('select');
    select.className = 'crafted-equipment-item__select';
    select.setAttribute('aria-label', `Assign ${equipment.name} to a tower`);

    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '— Empty Slot —';
    select.append(emptyOption);

    const optionDefinitions = [...unlockedTowers];
    if (assignmentId && !optionDefinitions.some((definition) => definition.id === assignmentId)) {
      const definition = getTowerDefinition(assignmentId);
      if (definition) {
        optionDefinitions.push(definition);
      } else {
        optionDefinitions.push({ id: assignmentId, name: assignmentId, symbol: '' });
      }
    }

    optionDefinitions
      .sort((a, b) => {
        const labelA = getTowerLabel(a.id);
        const labelB = getTowerLabel(b.id);
        return labelA.localeCompare(labelB);
      })
      .forEach((definition) => {
        const option = document.createElement('option');
        option.value = definition.id;
        option.textContent = getTowerLabel(definition.id);
        select.append(option);
      });

    if (assignmentId) {
      select.value = assignmentId;
    } else {
      select.value = '';
    }

    select.addEventListener('change', () => {
      const targetTower = select.value;
      if (targetTower) {
        assignEquipmentToTower(equipment.id, targetTower);
      } else {
        // Clearing the slot removes the equipment from its current tower.
        assignEquipmentToTower(equipment.id, null);
      }
    });

    select.disabled = optionDefinitions.length === 0;

    item.append(select);

    fragment.append(item);
  });

  equipmentList.append(fragment);
}

// Resolve a mote gem total by id so crafting recipes can show owned amounts.
function getMoteGemCountById(gemId) {
  if (!gemId) {
    return 0;
  }

  const record = moteGemState.inventory.get(gemId);
  if (record && Number.isFinite(record.total)) {
    return Math.max(0, record.total);
  }
  return 0;
}

// Build the deterministic tier ledger that escalates costs and bonuses per specification.
function buildVariableTierBlueprints() {
  const tiers = [];
  const ledger = BASE_TIER_REQUIREMENTS.map((entry) => ({ ...entry }));
  let bonus = 5;

  while (true) {
    tiers.push({
      tier: tiers.length + 1,
      bonusPercent: bonus,
      requirements: ledger.map((entry) => ({ ...entry })),
    });

    const nullstoneRequirement = ledger.find((entry) => entry.gemId === 'nullstone');
    if (nullstoneRequirement && nullstoneRequirement.amount >= MAX_NULLSTONE_REQUIREMENT) {
      break;
    }

    ledger.forEach((entry) => {
      entry.amount *= 10;
    });

    const nextGemId = GEM_TIER_SEQUENCE[tiers.length];
    if (nextGemId && !ledger.some((entry) => entry.gemId === nextGemId)) {
      ledger.unshift({ gemId: nextGemId, amount: 1 });
    }

    bonus *= 10;
  }

  return tiers;
}

// Translate the discovered variable registry into crafting recipe metadata.
function buildVariableCraftingRecipes(variableList) {
  if (!Array.isArray(variableList) || !variableList.length) {
    return [];
  }

  return variableList.map((variable) => {
    // Derive the display label for the crafting item so variable glyphs stay recognizable.
    const symbol = variable.symbol || variable.name || variable.id;
    const variableName = variable.name || symbol || 'Variable';
    const maxBonus = VARIABLE_TIER_BLUEPRINTS[VARIABLE_TIER_BLUEPRINTS.length - 1]?.bonusPercent || 0;
    return {
      id: `variable-${variable.id}`,
      name: `${symbol} Resonance`,
      type: variableName,
      description: variable.description || '',
      tiers: VARIABLE_TIER_BLUEPRINTS.map((tier) => ({
        tier: tier.tier,
        bonusPercent: tier.bonusPercent,
        requirements: tier.requirements.map((requirement) => ({
          ...requirement,
          label: resolveGemDefinition(requirement.gemId)?.name || requirement.gemId,
        })),
      })),
      maxBonus,
    };
  });
}

// Render the variable crafting recipes so the overlay mirrors the latest gem reserves.
function renderCraftingRecipes() {
  if (!craftingElements.list) {
    return;
  }

  craftingElements.list.innerHTML = '';
  const variables = getDiscoveredVariables();
  const recipes = buildVariableCraftingRecipes(variables);
  if (!recipes.length) {
    const empty = document.createElement('li');
    empty.className = 'crafting-item crafting-item--empty';
    empty.textContent = 'Discover tower variables to unlock their gemcraft blueprints.';
    craftingElements.list.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  recipes.forEach((recipe) => {
    const item = document.createElement('li');
    item.className = 'crafting-item';
    item.setAttribute('data-crafting-id', recipe.id);

    const header = document.createElement('div');
    header.className = 'crafting-item__header';

    const title = document.createElement('h3');
    title.className = 'crafting-item__title';
    title.textContent = recipe.name;

    const effect = document.createElement('p');
    effect.className = 'crafting-item__effect';
    const bonusSummary = formatWholeNumber(recipe.maxBonus);
    effect.textContent = `Unique ${recipe.type} focus — Tiered gemcraft amplifies this variable up to +${bonusSummary}%`;
    if (recipe.description) {
      // Append the lore snippet so players recall how the variable behaves in its home equation.
      const description = document.createElement('span');
      description.className = 'crafting-item__detail';
      description.textContent = ` ${recipe.description}`;
      effect.append(description);
    }

    header.append(title, effect);
    item.append(header);

    // Enumerate each tier so the overlay can showcase future upgrade thresholds.
    const tierList = document.createElement('ol');
    tierList.className = 'crafting-tier-list';

    recipe.tiers.forEach((tier) => {
      const tierItem = document.createElement('li');
      tierItem.className = 'crafting-tier';

      // Communicate the tier rank alongside the resulting bonus percentage.
      const tierHeader = document.createElement('div');
      tierHeader.className = 'crafting-tier__header';
      const tierLabel = document.createElement('span');
      tierLabel.className = 'crafting-tier__label';
      tierLabel.textContent = `Tier ${tier.tier}`;

      const tierBonus = document.createElement('span');
      tierBonus.className = 'crafting-tier__bonus';
      tierBonus.textContent = `+${formatWholeNumber(tier.bonusPercent)}% ${recipe.type}`;
      tierHeader.append(tierLabel, tierBonus);

      // Summarize the gem ledger for this tier using the shared cost styling.
      const costList = document.createElement('ul');
      costList.className = 'crafting-cost';

      tier.requirements.forEach((requirement) => {
        const costItem = document.createElement('li');
        costItem.className = 'crafting-cost__item';
        const amountLabel = `${formatGameNumber(Math.max(0, requirement.amount || 0))} ${
          requirement.label || 'Motes'
        }`;
        costItem.textContent = amountLabel;

        const owned = document.createElement('span');
        owned.className = 'crafting-cost__owned';
        owned.textContent = `(Owned: ${formatGameNumber(getMoteGemCountById(requirement.gemId))})`;
        costItem.append(owned);

        costList.append(costItem);
      });

      tierItem.append(tierHeader, costList);
      tierList.append(tierItem);
    });

    item.append(tierList);

    fragment.append(item);
  });

  craftingElements.list.append(fragment);
}

// Prepare the crafting overlay markup and interactions.
function bindCraftingOverlayElements() {
  craftingElements.overlay = document.getElementById('crafting-overlay');
  craftingElements.closeButton = document.getElementById('crafting-close');
  craftingElements.list = document.getElementById('crafting-list');
  craftingElements.equipmentList = document.getElementById('crafted-equipment-list');
  craftingElements.equipmentEmpty = document.getElementById('crafted-equipment-empty');

  renderCraftingRecipes();
  renderCraftedEquipmentList();

  if (!removeEquipmentListener) {
    removeEquipmentListener = addEquipmentListener(() => {
      renderCraftedEquipmentList();
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('tower-unlocked', renderCraftedEquipmentList);
  }

  // Listen for variable discovery broadcasts so the crafting ledger refreshes immediately.
  if (typeof document !== 'undefined') {
    document.addEventListener('tower-variables-changed', renderCraftingRecipes);
  }

  const { overlay, closeButton } = craftingElements;

  if (overlay) {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeCraftingOverlay();
      }
    });

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        closeCraftingOverlay();
      }
    });
  }

  if (closeButton) {
    closeButton.addEventListener('click', () => {
      closeCraftingOverlay();
    });
  }
}

// Reveal the crafting overlay and focus its dismiss control for accessibility.
export function openCraftingOverlay() {
  const { overlay, closeButton } = craftingElements;
  if (!overlay || overlay.classList.contains('active')) {
    return;
  }

  craftingElements.lastFocus = document.activeElement;
  if (typeof requestInventoryRefresh === 'function') {
    requestInventoryRefresh();
  }
  renderCraftingRecipes();
  renderCraftedEquipmentList();

  if (typeof revealOverlayCallback === 'function') {
    revealOverlayCallback(overlay);
  } else {
    overlay.removeAttribute('hidden');
  }
  overlay.setAttribute('aria-hidden', 'false');

  requestAnimationFrame(() => {
    overlay.classList.add('active');
    if (closeButton && typeof closeButton.focus === 'function') {
      closeButton.focus({ preventScroll: true });
    } else if (typeof overlay.focus === 'function') {
      overlay.focus({ preventScroll: true });
    }
  });
}

// Hide the crafting overlay and restore focus to the launcher button.
export function closeCraftingOverlay() {
  const { overlay } = craftingElements;
  if (!overlay || !overlay.classList.contains('active')) {
    return;
  }

  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  if (typeof scheduleOverlayHideCallback === 'function') {
    scheduleOverlayHideCallback(overlay);
  } else {
    overlay.setAttribute('hidden', '');
  }

  const focusTarget = craftingElements.lastFocus;
  craftingElements.lastFocus = null;
  if (focusTarget && typeof focusTarget.focus === 'function') {
    focusTarget.focus({ preventScroll: true });
  }
}

// Allow external systems to refresh the recipe list after gem inventory changes.
export function refreshCraftingRecipesDisplay() {
  renderCraftingRecipes();
}

// Configure the crafting overlay helpers so shared utilities such as overlay animations remain centralized.
export function initializeCraftingOverlay({
  revealOverlay,
  scheduleOverlayHide,
  onRequestInventoryRefresh,
} = {}) {
  revealOverlayCallback = typeof revealOverlay === 'function' ? revealOverlay : null;
  scheduleOverlayHideCallback = typeof scheduleOverlayHide === 'function' ? scheduleOverlayHide : null;
  requestInventoryRefresh = typeof onRequestInventoryRefresh === 'function' ? onRequestInventoryRefresh : null;

  bindCraftingOverlayElements();
}

