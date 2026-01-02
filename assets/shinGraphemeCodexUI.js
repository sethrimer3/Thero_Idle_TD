/**
 * Shin Grapheme Codex UI
 * 
 * Manages the grapheme codex overlay that displays detailed information
 * about each grapheme's effects and mechanics.
 */

import { getAllGraphemeCodexEntries } from './shinGraphemeCodex.js';

// DOM element references
const codexElements = {
  overlay: null,
  content: null,
  openButton: null,
  closeButton: null,
};

/**
 * Initialize the grapheme codex UI.
 */
export function initializeShinGraphemeCodex() {
  // Cache DOM elements
  codexElements.overlay = document.getElementById('shin-grapheme-codex-overlay');
  codexElements.content = document.getElementById('shin-grapheme-codex-content');
  codexElements.openButton = document.getElementById('shin-grapheme-codex-btn');
  codexElements.closeButton = document.getElementById('shin-grapheme-codex-close');

  if (!codexElements.overlay || !codexElements.content) {
    console.warn('Shin grapheme codex elements not found');
    return;
  }

  // Bind event listeners
  if (codexElements.openButton) {
    codexElements.openButton.addEventListener('click', openGraphemeCodex);
  }

  if (codexElements.closeButton) {
    codexElements.closeButton.addEventListener('click', closeGraphemeCodex);
  }

  // Close on overlay backdrop click
  codexElements.overlay.addEventListener('click', (event) => {
    if (event.target === codexElements.overlay) {
      closeGraphemeCodex();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !codexElements.overlay.hidden) {
      closeGraphemeCodex();
    }
  });

  // Render the codex content
  renderGraphemeCodex();
}

/**
 * Open the grapheme codex overlay.
 */
function openGraphemeCodex() {
  if (!codexElements.overlay) {
    return;
  }

  codexElements.overlay.hidden = false;
  codexElements.overlay.setAttribute('aria-hidden', 'false');
  
  // Focus the close button for accessibility
  requestAnimationFrame(() => {
    if (codexElements.closeButton) {
      codexElements.closeButton.focus();
    }
  });
}

/**
 * Close the grapheme codex overlay.
 */
function closeGraphemeCodex() {
  if (!codexElements.overlay) {
    return;
  }

  codexElements.overlay.hidden = true;
  codexElements.overlay.setAttribute('aria-hidden', 'true');
}

/**
 * Render the grapheme codex entries.
 */
function renderGraphemeCodex() {
  if (!codexElements.content) {
    return;
  }

  const entries = getAllGraphemeCodexEntries();
  codexElements.content.innerHTML = '';

  const fragment = document.createDocumentFragment();

  entries.forEach((entry) => {
    const entryElement = createCodexEntry(entry);
    fragment.appendChild(entryElement);
  });

  codexElements.content.appendChild(fragment);
}

/**
 * Create a DOM element for a codex entry.
 */
function createCodexEntry(entry) {
  const entryDiv = document.createElement('div');
  entryDiv.className = 'shin-codex-entry';
  entryDiv.setAttribute('data-grapheme-index', entry.index);

  // Header (collapsible button)
  const header = document.createElement('button');
  header.className = 'shin-codex-entry-header';
  header.type = 'button';
  header.setAttribute('aria-expanded', 'false');

  const title = document.createElement('div');
  title.className = 'shin-codex-entry-title';

  const letter = document.createElement('span');
  letter.className = 'shin-codex-entry-letter';
  letter.textContent = entry.name;

  const name = document.createElement('h3');
  name.className = 'shin-codex-entry-name';
  name.textContent = entry.title;

  title.appendChild(letter);
  title.appendChild(name);

  const toggle = document.createElement('span');
  toggle.className = 'shin-codex-entry-toggle';
  toggle.setAttribute('aria-hidden', 'true');
  toggle.textContent = '▸';

  header.appendChild(title);
  header.appendChild(toggle);

  // Content (collapsible)
  const content = document.createElement('div');
  content.className = 'shin-codex-entry-content';

  const body = document.createElement('div');
  body.className = 'shin-codex-entry-body';

  // Summary
  const summary = document.createElement('p');
  summary.className = 'shin-codex-summary';
  summary.textContent = entry.summary;
  body.appendChild(summary);

  // Effects by slot
  if (entry.effects && entry.effects.length > 0) {
    const effectsTitle = document.createElement('div');
    effectsTitle.className = 'shin-codex-effects-title';
    effectsTitle.textContent = 'Effects by Slot Position';
    body.appendChild(effectsTitle);

    const effectsList = document.createElement('ul');
    effectsList.className = 'shin-codex-effects-list';

    entry.effects.forEach((effect) => {
      const effectItem = document.createElement('li');
      effectItem.className = 'shin-codex-effect-item';

      const slotLabel = document.createElement('span');
      slotLabel.className = 'shin-codex-effect-slot';
      slotLabel.textContent = `Slot ${effect.slot}:`;

      const description = document.createElement('span');
      description.className = 'shin-codex-effect-description';
      description.textContent = effect.description;

      effectItem.appendChild(slotLabel);
      effectItem.appendChild(description);
      effectsList.appendChild(effectItem);
    });

    body.appendChild(effectsList);
  }

  // Special mechanics
  if (entry.specialMechanics) {
    const specialBox = document.createElement('div');
    specialBox.className = 'shin-codex-special-mechanics';

    const specialTitle = document.createElement('div');
    specialTitle.className = 'shin-codex-special-title';
    specialTitle.textContent = 'Special Mechanics';

    const specialText = document.createElement('p');
    specialText.className = 'shin-codex-special-text';
    specialText.textContent = entry.specialMechanics;

    specialBox.appendChild(specialTitle);
    specialBox.appendChild(specialText);
    body.appendChild(specialBox);
  }

  content.appendChild(body);

  // Toggle expansion on header click
  header.addEventListener('click', () => {
    const isExpanded = entryDiv.classList.toggle('expanded');
    header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  });

  entryDiv.appendChild(header);
  entryDiv.appendChild(content);

  return entryDiv;
}

/**
 * Update the codex display (if needed for dynamic updates).
 */
export function updateShinGraphemeCodex() {
  // Currently static, but can be extended for dynamic content
  // e.g., showing which graphemes are unlocked
}
