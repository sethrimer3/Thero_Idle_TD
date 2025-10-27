import { formatGameNumber } from '../scripts/core/formatting.js';
import { moteGemState } from './enemies.js';

// Stub crafting recipes bridging gem counts to amplifier and pylon prototypes for future systems.
const CRAFTING_RECIPES = [
  {
    id: 'lens-amplifier',
    name: 'Lens Amplifier',
    type: 'Amplifier',
    effect: 'Increase tower range by 10% when slotted.',
    requirements: [
      { label: 'Amethyst', amount: 100 },
      { label: 'Topaz', amount: 5000 },
    ],
  },
  {
    id: 'resonant-pylon',
    name: 'Resonant Pylon',
    type: 'Pylon',
    effect: 'Channel 12% bonus damage to linked towers.',
    requirements: [
      { label: 'Ruby', amount: 250 },
      { label: 'Sapphire', amount: 2500 },
      { label: 'Emerald', amount: 1250 },
    ],
  },
  {
    id: 'prism-harmonic',
    name: 'Prism Harmonic',
    type: 'Amplifier',
    effect: 'Adds 8% attack speed and 5% mote drop rate to an equipped tower.',
    requirements: [
      { label: 'Opal', amount: 180 },
      { label: 'Citrine', amount: 900 },
      { label: 'Pearl', amount: 60 },
    ],
  },
];

// Store crafting overlay references so the motes tab can summon and dismiss the menu gracefully.
const craftingElements = {
  overlay: null,
  closeButton: null,
  list: null,
  lastFocus: null,
};

let revealOverlayCallback = null;
let scheduleOverlayHideCallback = null;
let requestInventoryRefresh = null;

// Resolve a mote gem total by label so crafting recipes can show owned amounts.
function getMoteGemCountByLabel(label) {
  if (!label) {
    return 0;
  }

  let total = 0;
  moteGemState.inventory.forEach((record) => {
    if (record && record.label === label && Number.isFinite(record.total)) {
      total += Math.max(0, record.total);
    }
  });
  return Math.max(0, total);
}

// Render the stub crafting recipes so the overlay mirrors the latest gem reserves.
function renderCraftingRecipes() {
  if (!craftingElements.list) {
    return;
  }

  craftingElements.list.innerHTML = '';
  if (!CRAFTING_RECIPES.length) {
    return;
  }

  const fragment = document.createDocumentFragment();
  CRAFTING_RECIPES.forEach((recipe) => {
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
    effect.textContent = `${recipe.type} — ${recipe.effect}`;

    header.append(title, effect);
    item.append(header);

    if (Array.isArray(recipe.requirements) && recipe.requirements.length) {
      const costList = document.createElement('ul');
      costList.className = 'crafting-cost';

      recipe.requirements.forEach((requirement) => {
        const costItem = document.createElement('li');
        costItem.className = 'crafting-cost__item';
        const amountLabel = `${formatGameNumber(Math.max(0, requirement.amount || 0))} ${
          requirement.label || 'Motes'
        } Motes`;
        costItem.textContent = amountLabel;

        const owned = document.createElement('span');
        owned.className = 'crafting-cost__owned';
        owned.textContent = `(Owned: ${formatGameNumber(getMoteGemCountByLabel(requirement.label))})`;
        costItem.append(owned);

        costList.append(costItem);
      });

      item.append(costList);
    }

    fragment.append(item);
  });

  craftingElements.list.append(fragment);
}

// Prepare the crafting overlay markup and interactions.
function bindCraftingOverlayElements() {
  craftingElements.overlay = document.getElementById('crafting-overlay');
  craftingElements.closeButton = document.getElementById('crafting-close');
  craftingElements.list = document.getElementById('crafting-list');

  renderCraftingRecipes();

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

