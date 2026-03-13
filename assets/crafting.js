import { formatGameNumber, formatWholeNumber } from '../scripts/core/formatting.js';
import {
  moteGemState,
  resolveGemDefinition,
  getGemSpriteAssetPath,
  setMoteGemAutoCollectDelayMs,
} from './enemies.js';
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
  registerCraftedEquipment,
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

// Establish the visible tier naming order so recipe labels match the gem rarity cadence.
const CRAFTING_TIER_NAME_SEQUENCE = [
  'quartz',
  'ruby',
  'sunstone',
  'citrine',
  'emerald',
  'sapphire',
  'iolite',
  'amethyst',
  'diamond',
  'nullstone',
];

const EQUIPMENT_LENS_SPRITE_LOOKUP = new Map([
  ['quartz', './assets/sprites/equipment/quartzLens.png'],
  ['ruby', './assets/sprites/equipment/rubyLens.png'],
  ['sunstone', './assets/sprites/equipment/sunstoneLens.png'],
  ['citrine', './assets/sprites/equipment/citrineLens.png'],
  ['emerald', './assets/sprites/equipment/emeraldLens.png'],
  ['sapphire', './assets/sprites/equipment/sapphireLens.png'],
  ['iolite', './assets/sprites/equipment/ioliteLens.png'],
  ['amethyst', './assets/sprites/equipment/amethystLens.png'],
  ['diamond', './assets/sprites/equipment/diamondLens.png'],
  ['nullstone', './assets/sprites/equipment/nullstoneLens.png'],
]);

const HABITUATION_SIGIL_ID = 'habituation-sigil';
const HABITUATION_SIGIL_AUTO_COLLECT_MS = 1000;
const EPIPHANY_SIGIL_RECIPES = [
  {
    id: HABITUATION_SIGIL_ID,
    name: 'Habituation Sigil',
    type: 'Epiphany Sigil',
    effectLabel: 'Auto-collect enemy gem drops after 1 second.',
    buttonLabel: 'Inscribe Sigil',
    costs: [
      { gemId: 'emerald', amount: 1, label: 'Emerald' },
      { gemId: 'sunstone', amount: 100, label: 'Sunstone' },
    ],
  },
];

function getEquipmentLensSpritePath(materialId) {
  const key = typeof materialId === 'string' ? materialId.trim().toLowerCase() : '';
  if (key && EQUIPMENT_LENS_SPRITE_LOOKUP.has(key)) {
    return EQUIPMENT_LENS_SPRITE_LOOKUP.get(key);
  }
  return EQUIPMENT_LENS_SPRITE_LOOKUP.get('quartz') || null;
}

// Persist crafted tier milestones per recipe so the overlay can reveal the correct stage.
export const CRAFTING_TIER_STORAGE_KEY = 'glyph-defense-idle:crafting-tier-progress';

// Cache crafting tier completions and listeners to avoid repeated storage hits.
const craftingTierProgressState = {
  initialized: false,
  levelByRecipe: new Map(),
  listeners: new Set(),
};

// Compose a readable tier title from a gem id, falling back to the numbered tier when needed.
function formatCraftingTierNameFromGem(gemId, fallbackTierNumber) {
  const gem = resolveGemDefinition(gemId);
  const rawName = typeof gem?.name === 'string' && gem.name.trim().length
    ? gem.name.trim()
    : typeof gemId === 'string'
      ? gemId
      : '';
  if (!rawName) {
    return `Tier ${fallbackTierNumber}`;
  }
  const normalized = rawName.slice(0, 1).toUpperCase() + rawName.slice(1);
  return `${normalized} Tier`;
}

// Resolve which tier title to show by matching the configured sequence with the current ledger.
function determineTierNameForLedger(tierIndex, ledger) {
  const preferredGemId = CRAFTING_TIER_NAME_SEQUENCE[tierIndex];
  if (preferredGemId) {
    return formatCraftingTierNameFromGem(preferredGemId, tierIndex + 1);
  }
  const fallbackGemId = ledger?.find((entry) => entry && typeof entry.gemId === 'string')?.gemId;
  return formatCraftingTierNameFromGem(fallbackGemId, tierIndex + 1);
}

// Attempt to hydrate crafting tier completions from persistent storage.
function readStoredCraftingTierProgress() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(CRAFTING_TIER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.levels)) {
      return null;
    }
    return parsed.levels
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const recipeId = typeof entry.recipeId === 'string' ? entry.recipeId.trim() : '';
        const tier = Number.isFinite(entry.tier) ? Math.max(0, Math.floor(entry.tier)) : 0;
        if (!recipeId) {
          return null;
        }
        return [recipeId, tier];
      })
      .filter(Boolean);
  } catch (error) {
    console.warn('Failed to parse stored crafting tier progress.', error);
    return null;
  }
}

// Persist the crafting tier ledger so future sessions keep the reveal cadence intact.
function writeStoredCraftingTierProgress() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const payload = {
      levels: Array.from(craftingTierProgressState.levelByRecipe.entries()).map(
        ([recipeId, tier]) => ({ recipeId, tier }),
      ),
    };
    window.localStorage.setItem(CRAFTING_TIER_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to persist crafting tier progress.', error);
  }
}

// Ensure the crafting tier cache is populated from storage before it is queried.
function ensureCraftingTierProgressInitialized() {
  if (craftingTierProgressState.initialized) {
    return;
  }
  craftingTierProgressState.initialized = true;
  const stored = readStoredCraftingTierProgress();
  if (Array.isArray(stored)) {
    stored.forEach(([recipeId, tier]) => {
      craftingTierProgressState.levelByRecipe.set(recipeId, tier);
    });
  }
}

// Create a snapshot payload describing current crafting tier completions.
function getCraftingTierProgressSnapshot() {
  ensureCraftingTierProgressInitialized();
  return {
    levels: Array.from(craftingTierProgressState.levelByRecipe.entries()).map(
      ([recipeId, tier]) => ({ recipeId, tier }),
    ),
  };
}

// Notify subscribed listeners and the DOM event bus when tier progress changes.
function notifyCraftingTierProgressListeners() {
  const snapshot = getCraftingTierProgressSnapshot();
  craftingTierProgressState.listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.warn('Failed to notify crafting tier progress listener.', error);
    }
  });
  if (typeof document !== 'undefined' && typeof CustomEvent === 'function') {
    document.dispatchEvent(
      new CustomEvent('crafting-tier-progress-changed', {
        detail: snapshot,
      }),
    );
  }
}

// Retrieve the number of completed tiers for the supplied recipe identifier.
export function getCraftedTierLevel(recipeId) {
  ensureCraftingTierProgressInitialized();
  const id = typeof recipeId === 'string' ? recipeId.trim() : '';
  if (!id) {
    return 0;
  }
  const tier = craftingTierProgressState.levelByRecipe.get(id);
  return Number.isFinite(tier) ? Math.max(0, tier) : 0;
}

// Record a freshly forged tier and optionally persist the update.
export function setCraftedTierLevel(recipeId, tier, { persist = true } = {}) {
  ensureCraftingTierProgressInitialized();
  const id = typeof recipeId === 'string' ? recipeId.trim() : '';
  if (!id) {
    return false;
  }
  const sanitizedTier = Number.isFinite(tier) ? Math.max(0, Math.floor(tier)) : 0;
  const current = craftingTierProgressState.levelByRecipe.get(id) || 0;
  if (current === sanitizedTier) {
    return false;
  }
  craftingTierProgressState.levelByRecipe.set(id, sanitizedTier);
  if (persist) {
    writeStoredCraftingTierProgress();
  }
  notifyCraftingTierProgressListeners();
  return true;
}

// Allow external systems to subscribe to crafting tier progress changes.
export function addCraftingTierProgressListener(listener) {
  ensureCraftingTierProgressInitialized();
  if (typeof listener !== 'function') {
    return () => {};
  }
  craftingTierProgressState.listeners.add(listener);
  try {
    listener(getCraftingTierProgressSnapshot());
  } catch (error) {
    console.warn('Failed to invoke crafting tier progress listener immediately.', error);
  }
  return () => {
    craftingTierProgressState.listeners.delete(listener);
  };
}

// Cache the computed tier array so rendering can reuse the deterministic blueprint.
const VARIABLE_TIER_BLUEPRINTS = buildVariableTierBlueprints();

// Store crafting overlay references so the motes tab can summon and dismiss the menu gracefully.
const craftingElements = {
  overlay: null,
  closeButton: null,
  list: null,
  equipmentList: null,
  equipmentEmpty: null,
  lensesTab: null,
  sigilsTab: null,
  lensesPanel: null,
  sigilsPanel: null,
  sigilList: null,
  lastFocus: null,
};

let revealOverlayCallback = null;
let scheduleOverlayHideCallback = null;
let requestInventoryRefresh = null;
let commitCraftingState = null;
let removeEquipmentListener = null;
let removeCraftingProgressListener = null;
let activeCraftingCategory = 'lenses';

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

// Split the crafted equipment ledger so the lenses tab excludes passive sigils.
function getCraftedLenses() {
  return getCraftedEquipment().filter((equipment) => equipment?.id !== HABITUATION_SIGIL_ID);
}

// Determine whether the Habituation Sigil has already been inscribed.
function hasHabituationSigil() {
  return getCraftedEquipment().some((equipment) => equipment?.id === HABITUATION_SIGIL_ID);
}

// Apply passive sigil effects immediately after load and after each craft.
function syncEpiphanySigilEffects() {
  setMoteGemAutoCollectDelayMs(hasHabituationSigil() ? HABITUATION_SIGIL_AUTO_COLLECT_MS : 0);
}

// Render the crafted equipment roster with assignment controls.
function renderCraftedEquipmentList() {
  const { equipmentList, equipmentEmpty } = craftingElements;
  if (!equipmentList || !equipmentEmpty) {
    return;
  }

  equipmentList.innerHTML = '';
  const crafted = getCraftedLenses();
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
    emptyOption.textContent = '? Empty Slot ?';
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

// Return whether the player can currently afford the supplied gem ledger.
function canAffordGemCosts(costs) {
  if (!Array.isArray(costs) || !costs.length) {
    return false;
  }
  return costs.every((cost) => getMoteGemCountById(cost?.gemId) >= Math.max(0, cost?.amount || 0));
}

// Spend gem motes from the shared inventory while keeping cluster counts in sync.
function spendGemCosts(costs) {
  if (!canAffordGemCosts(costs)) {
    return false;
  }

  costs.forEach((cost) => {
    const gemId = typeof cost?.gemId === 'string' ? cost.gemId : '';
    const amount = Math.max(0, cost?.amount || 0);
    if (!gemId || amount <= 0) {
      return;
    }
    const record = moteGemState.inventory.get(gemId);
    if (!record) {
      return;
    }
    const gemDefinition = resolveGemDefinition(gemId);
    const clusterValue = Number.isFinite(gemDefinition?.moteSize) ? Math.max(1, gemDefinition.moteSize) : 1;
    const nextTotal = Math.max(0, (Number(record.total) || 0) - amount);
    const nextCount = nextTotal > 0 ? Math.ceil(nextTotal / clusterValue) : 0;
    moteGemState.inventory.set(gemId, {
      ...record,
      total: nextTotal,
      count: nextCount,
    });
  });

  return true;
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

// Determine which tier index should be shown next for the provided recipe id.
function resolveNextCraftingTierIndex(recipeId, totalTiers) {
  const completed = getCraftedTierLevel(recipeId);
  const tierCount = Number.isFinite(totalTiers) ? Math.max(0, Math.floor(totalTiers)) : 0;
  if (tierCount <= 0) {
    return null;
  }
  const sanitizedCompleted = Number.isFinite(completed) ? Math.max(0, Math.floor(completed)) : 0;
  if (sanitizedCompleted >= tierCount) {
    return null;
  }
  return sanitizedCompleted;
}

// Create a decorative swatch or sprite representing the required gem.
function createGemColorSwatch(gemId) {
  const swatch = document.createElement('span');
  swatch.className = 'crafting-cost__swatch';
  swatch.setAttribute('aria-hidden', 'true');
  const spritePath = getGemSpriteAssetPath(gemId);
  if (spritePath) {
    // Embed the gem sprite so crafting requirements match the collectible art style.
    swatch.classList.add('crafting-cost__swatch--sprite');
    const spriteImg = document.createElement('img');
    spriteImg.className = 'crafting-cost__sprite';
    spriteImg.decoding = 'async';
    spriteImg.loading = 'lazy';
    spriteImg.alt = '';
    spriteImg.src = spritePath;
    swatch.appendChild(spriteImg);
    return swatch;
  }
  const gem = resolveGemDefinition(gemId);
  if (gem?.color) {
    const { hue, saturation, lightness } = gem.color;
    swatch.style.setProperty(
      '--crafting-cost-swatch-color',
      `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    );
  }
  return swatch;
}

// Render the shared gem-cost ledger used by both lenses and sigils.
function appendCostList(parent, requirements) {
  if (!parent || !Array.isArray(requirements) || !requirements.length) {
    return;
  }

  const costList = document.createElement('ul');
  costList.className = 'crafting-cost';

  requirements.forEach((requirement) => {
    const costItem = document.createElement('li');
    costItem.className = 'crafting-cost__item';
    const amountLabel = `${formatGameNumber(Math.max(0, requirement.amount || 0))} ${
      requirement.label || 'Motes'
    }`;

    const swatch = createGemColorSwatch(requirement.gemId);
    costItem.append(swatch);

    const amount = document.createElement('span');
    amount.className = 'crafting-cost__amount';
    amount.textContent = amountLabel;
    costItem.append(amount);

    const owned = document.createElement('span');
    owned.className = 'crafting-cost__owned';
    owned.textContent = `(Owned: ${formatGameNumber(getMoteGemCountById(requirement.gemId))})`;
    costItem.append(owned);

    costList.append(costItem);
  });

  parent.append(costList);
}

// Build the deterministic tier ledger that escalates costs and bonuses per specification.
function buildVariableTierBlueprints() {
  const tiers = [];
  const ledger = BASE_TIER_REQUIREMENTS.map((entry) => ({ ...entry }));
  let bonus = 5;

  while (true) {
    const tierIndex = tiers.length;
    const materialId =
      CRAFTING_TIER_NAME_SEQUENCE[tierIndex] ||
      ledger.find((entry) => entry && typeof entry.gemId === 'string')?.gemId ||
      'quartz';
    tiers.push({
      tier: tierIndex + 1,
      name: determineTierNameForLedger(tierIndex, ledger),
      bonusPercent: bonus,
      materialId,
      lensSprite: getEquipmentLensSpritePath(materialId),
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

  // Filter to only include life, recovery (regeneration), atk, spd, and m (range)
  const allowedVariableKeys = ['life', 'recovery', 'atk', 'spd', 'm'];
  const filteredVariables = variableList.filter((variable) => {
    const key = variable.key || variable.libraryKey;
    return allowedVariableKeys.includes(key);
  });

  return filteredVariables.map((variable) => {
    // Derive the display label for the crafting item so variable glyphs stay recognizable.
    const symbol = variable.symbol || variable.name || variable.id;
    const variableName = variable.name || symbol || 'Variable';
    const maxBonus = VARIABLE_TIER_BLUEPRINTS[VARIABLE_TIER_BLUEPRINTS.length - 1]?.bonusPercent || 0;
    return {
      id: `variable-${variable.id}`,
      name: `${symbol} Lens`,
      type: variableName,
      description: '',
      tiers: VARIABLE_TIER_BLUEPRINTS.map((tier) => ({
        tier: tier.tier,
        name: tier.name,
        bonusPercent: tier.bonusPercent,
        materialId: tier.materialId,
        lensSprite: tier.lensSprite,
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

    header.append(title);
    item.append(header);

    // Reveal only the next eligible tier so crafted stages stay hidden until forged.
    const nextTierIndex = resolveNextCraftingTierIndex(recipe.id, recipe.tiers.length);
    const tierList = document.createElement('ol');
    tierList.className = 'crafting-tier-list';

    if (nextTierIndex !== null) {
      const tier = recipe.tiers[nextTierIndex];
      const tierItem = document.createElement('li');
      tierItem.className = 'crafting-tier';

      // Communicate the tier label alongside the resulting bonus percentage.
      const tierHeader = document.createElement('div');
      tierHeader.className = 'crafting-tier__header';
      const labelWrap = document.createElement('span');
      labelWrap.className = 'crafting-tier__label-wrap';

      const lensSpritePath = tier.lensSprite || getEquipmentLensSpritePath(tier.materialId);
      if (lensSpritePath) {
        const icon = document.createElement('img');
        icon.className = 'crafting-tier__icon';
        icon.src = lensSpritePath;
        icon.alt = '';
        icon.decoding = 'async';
        icon.loading = 'lazy';
        labelWrap.append(icon);
      }

      const tierLabel = document.createElement('span');
      tierLabel.className = 'crafting-tier__label';
      tierLabel.textContent = tier.name || `Tier ${tier.tier}`;
      labelWrap.append(tierLabel);

      const tierBonus = document.createElement('span');
      tierBonus.className = 'crafting-tier__bonus';
      tierBonus.textContent = `+${formatWholeNumber(tier.bonusPercent)}% ${recipe.type}`;
      tierHeader.append(labelWrap, tierBonus);

      tierItem.append(tierHeader);
      appendCostList(tierItem, tier.requirements);
      tierList.append(tierItem);
    } else {
      // Signal completion when all tiers are forged so the ledger stays concise.
      const complete = document.createElement('p');
      complete.className = 'crafting-tier-complete';
      complete.textContent = 'All tiers forged.';
      item.append(complete);
    }

    if (tierList.childElementCount > 0) {
      item.append(tierList);
    }

    fragment.append(item);
  });

  craftingElements.list.append(fragment);
}

// Toggle the visible crafting sub-tab so lenses and sigils stay separated.
function setActiveCraftingCategory(categoryId) {
  activeCraftingCategory = categoryId === 'sigils' ? 'sigils' : 'lenses';
  const isSigils = activeCraftingCategory === 'sigils';
  const isLenses = !isSigils;
  const { lensesTab, sigilsTab, lensesPanel, sigilsPanel } = craftingElements;

  if (lensesTab) {
    lensesTab.classList.toggle('active', isLenses);
    lensesTab.setAttribute('aria-selected', isLenses ? 'true' : 'false');
    lensesTab.tabIndex = isLenses ? 0 : -1;
  }
  if (sigilsTab) {
    sigilsTab.classList.toggle('active', isSigils);
    sigilsTab.setAttribute('aria-selected', isSigils ? 'true' : 'false');
    sigilsTab.tabIndex = isSigils ? 0 : -1;
  }
  if (lensesPanel) {
    lensesPanel.hidden = !isLenses;
  }
  if (sigilsPanel) {
    sigilsPanel.hidden = !isSigils;
  }
}

// Craft the Habituation Sigil and activate its one-second gem collection cadence.
function craftEpiphanySigil(recipe) {
  if (!recipe || hasHabituationSigil() || !spendGemCosts(recipe.costs)) {
    return false;
  }

  registerCraftedEquipment({
    id: recipe.id,
    name: recipe.name,
    type: recipe.type,
    symbol: '⌘',
  });
  syncEpiphanySigilEffects();
  if (typeof requestInventoryRefresh === 'function') {
    requestInventoryRefresh();
  }
  renderCraftingRecipes();
  renderCraftedEquipmentList();
  renderEpiphanySigils();
  if (typeof commitCraftingState === 'function') {
    commitCraftingState();
  }
  return true;
}

// Render the sigil tab with its available inscription recipe and unlock state.
function renderEpiphanySigils() {
  const { sigilList } = craftingElements;
  if (!sigilList) {
    return;
  }

  sigilList.innerHTML = '';
  const sigilUnlocked = hasHabituationSigil();
  const fragment = document.createDocumentFragment();

  EPIPHANY_SIGIL_RECIPES.forEach((recipe) => {
    const item = document.createElement('li');
    item.className = 'crafting-item';
    item.setAttribute('data-sigil-id', recipe.id);

    const header = document.createElement('div');
    header.className = 'crafting-item__header';

    const title = document.createElement('h3');
    title.className = 'crafting-item__title';
    title.textContent = recipe.name;

    const effect = document.createElement('p');
    effect.className = 'crafting-item__effect';
    effect.textContent = recipe.effectLabel;

    header.append(title, effect);
    item.append(header);

    appendCostList(item, recipe.costs);

    const actionRow = document.createElement('div');
    actionRow.className = 'sigil-crafting-actions';

    const status = document.createElement('p');
    status.className = 'sigil-crafting-status';
    status.textContent = sigilUnlocked
      ? 'Forged — enemy gem drops now gather themselves after 1 second.'
      : 'Available for inscription once the required gem motes are assembled.';

    const button = document.createElement('button');
    button.className = 'sigil-crafting-button';
    button.type = 'button';
    button.textContent = sigilUnlocked ? 'Forged' : recipe.buttonLabel;
    button.disabled = sigilUnlocked || !canAffordGemCosts(recipe.costs);
    button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
    button.addEventListener('click', () => {
      craftEpiphanySigil(recipe);
    });

    actionRow.append(status, button);
    item.append(actionRow);
    fragment.append(item);
  });

  sigilList.append(fragment);
}

// Prepare the crafting overlay markup and interactions.
function bindCraftingOverlayElements() {
  craftingElements.overlay = document.getElementById('crafting-overlay');
  craftingElements.closeButton = document.getElementById('crafting-close');
  craftingElements.list = document.getElementById('crafting-list');
  craftingElements.equipmentList = document.getElementById('crafted-equipment-list');
  craftingElements.equipmentEmpty = document.getElementById('crafted-equipment-empty');
  craftingElements.lensesTab = document.getElementById('crafting-category-lenses');
  craftingElements.sigilsTab = document.getElementById('crafting-category-sigils');
  craftingElements.lensesPanel = document.getElementById('crafting-panel-lenses');
  craftingElements.sigilsPanel = document.getElementById('crafting-panel-sigils');
  craftingElements.sigilList = document.getElementById('crafting-sigil-list');

  renderCraftingRecipes();
  renderCraftedEquipmentList();
  renderEpiphanySigils();
  syncEpiphanySigilEffects();
  setActiveCraftingCategory(activeCraftingCategory);

  if (!removeEquipmentListener) {
    removeEquipmentListener = addEquipmentListener(() => {
      syncEpiphanySigilEffects();
      renderCraftedEquipmentList();
      renderEpiphanySigils();
    });
  }

  if (!removeCraftingProgressListener) {
    removeCraftingProgressListener = addCraftingTierProgressListener(() => {
      // Refresh the recipe list whenever a tier milestone is recorded.
      renderCraftingRecipes();
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('tower-unlocked', renderCraftedEquipmentList);
  }

  // Listen for variable discovery broadcasts so the crafting ledger refreshes immediately.
  if (typeof document !== 'undefined') {
    document.addEventListener('tower-variables-changed', renderCraftingRecipes);
  }

  const { overlay, closeButton, lensesTab, sigilsTab } = craftingElements;

  if (lensesTab) {
    lensesTab.addEventListener('click', () => {
      setActiveCraftingCategory('lenses');
    });
  }

  if (sigilsTab) {
    sigilsTab.addEventListener('click', () => {
      setActiveCraftingCategory('sigils');
    });
  }

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
  renderEpiphanySigils();

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
  onCommitState,
} = {}) {
  revealOverlayCallback = typeof revealOverlay === 'function' ? revealOverlay : null;
  scheduleOverlayHideCallback = typeof scheduleOverlayHide === 'function' ? scheduleOverlayHide : null;
  requestInventoryRefresh = typeof onRequestInventoryRefresh === 'function' ? onRequestInventoryRefresh : null;
  commitCraftingState = typeof onCommitState === 'function' ? onCommitState : null;

  bindCraftingOverlayElements();
}
