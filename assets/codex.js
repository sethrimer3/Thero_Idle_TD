import { annotateMathText, renderMathElement } from '../scripts/core/mathText.js';

// Maintains codex progression state for encountered enemies.
export const codexState = {
  encounteredEnemies: new Set(),
};

// Stores DOM elements associated with the enemy codex list.
export const enemyCodexElements = {
  list: null,
  empty: null,
  note: null,
};

let enemyCodexEntries = [];
let enemyCodexMap = new Map();

// Updates stored codex entries and rebuilds the lookup map.
export function setEnemyCodexEntries(entries) {
  enemyCodexEntries = Array.isArray(entries)
    ? entries.map((entry) => ({
        ...entry,
        traits: Array.isArray(entry.traits) ? [...entry.traits] : [],
      }))
    : [];
  enemyCodexMap = new Map(enemyCodexEntries.map((entry) => [entry.id, entry]));
  pruneEncounteredCodexEntries();
  return enemyCodexEntries;
}

// Removes encountered enemy ids that no longer exist in the codex map.
export function pruneEncounteredCodexEntries() {
  Array.from(codexState.encounteredEnemies).forEach((enemyId) => {
    if (!enemyCodexMap.has(enemyId)) {
      codexState.encounteredEnemies.delete(enemyId);
    }
  });
}

// Retrieves all normalized codex entries.
export function getEnemyCodexEntries() {
  return enemyCodexEntries;
}

// Resolves a codex entry by id, returning null when it is missing.
export function getEnemyCodexEntry(enemyId) {
  if (!enemyId) {
    return null;
  }
  return enemyCodexMap.get(enemyId) || null;
}

// Determines whether a codex entry exists for the supplied id.
export function hasEnemyCodexEntry(enemyId) {
  if (!enemyId) {
    return false;
  }
  return enemyCodexMap.has(enemyId);
}

// Renders the enemy codex list using the current state and lookup map.
export function renderEnemyCodex() {
  if (!enemyCodexElements.list) {
    return;
  }

  const encountered = Array.from(codexState.encounteredEnemies)
    .map((id) => enemyCodexMap.get(id))
    .filter(Boolean);

  enemyCodexElements.list.innerHTML = '';

  if (enemyCodexElements.note) {
    enemyCodexElements.note.hidden = encountered.length > 0 ? false : true;
  }

  if (!encountered.length) {
    if (enemyCodexElements.empty) {
      enemyCodexElements.empty.hidden = false;
    }
    enemyCodexElements.list.setAttribute('hidden', '');
    return;
  }

  enemyCodexElements.list.removeAttribute('hidden');
  if (enemyCodexElements.empty) {
    enemyCodexElements.empty.hidden = true;
  }

  const fragment = document.createDocumentFragment();
  encountered.forEach((entry) => {
    const card = document.createElement('article');
    card.className = 'card enemy-card';
    card.setAttribute('role', 'listitem');

    const title = document.createElement('h3');
    title.textContent = entry.name;
    card.append(title);

    if (entry.symbol) {
      const glyphRow = document.createElement('p');
      glyphRow.className = 'enemy-card-glyph';

      const glyphSymbol = document.createElement('span');
      glyphSymbol.className = 'enemy-card-symbol';
      glyphSymbol.textContent = entry.symbol;

      const glyphExponent = document.createElement('sup');
      glyphExponent.className = 'enemy-card-symbol-exponent';
      glyphExponent.textContent = 'k';
      glyphSymbol.append(glyphExponent);

      const glyphNote = document.createElement('span');
      glyphNote.className = 'enemy-card-glyph-note';
      glyphNote.textContent = annotateMathText('HP tiers use (10^{k}).');

      glyphRow.append(glyphSymbol, glyphNote);
      card.append(glyphRow);
      renderMathElement(glyphNote);
    }

    const summaryText = entry.summary || entry.description || '';
    if (summaryText) {
      const summary = document.createElement('p');
      summary.className = 'enemy-card-summary';
      summary.textContent = annotateMathText(summaryText);
      card.append(summary);
      renderMathElement(summary);
    }

    if (entry.formula) {
      const formulaRow = document.createElement('p');
      formulaRow.className = 'enemy-card-formula';

      const formulaLabel = document.createElement('span');
      formulaLabel.className = 'enemy-card-formula-label';
      formulaLabel.textContent = entry.formulaLabel || 'Key Expression';

      const equation = document.createElement('span');
      equation.className = 'enemy-card-equation';
      equation.textContent = annotateMathText(entry.formula);

      formulaRow.append(formulaLabel, document.createTextNode(': '), equation);
      card.append(formulaRow);
      renderMathElement(equation);
    }

    if (Array.isArray(entry.traits) && entry.traits.length) {
      const traitList = document.createElement('ul');
      traitList.className = 'enemy-card-traits';
      entry.traits.forEach((trait) => {
        const item = document.createElement('li');
        item.textContent = annotateMathText(trait);
        traitList.append(item);
        renderMathElement(item);
      });
      card.append(traitList);
    }

    if (entry.counter) {
      const counter = document.createElement('p');
      counter.className = 'enemy-card-counter';
      counter.textContent = annotateMathText(entry.counter);
      card.append(counter);
      renderMathElement(counter);
    }

    if (entry.lore) {
      const lore = document.createElement('p');
      lore.className = 'enemy-card-lore';
      lore.textContent = annotateMathText(entry.lore);
      card.append(lore);
      renderMathElement(lore);
    }

    fragment.append(card);
  });

  enemyCodexElements.list.append(fragment);
}

// Records an encountered enemy and refreshes the codex display.
export function registerEnemyEncounter(enemyId) {
  if (!enemyId || codexState.encounteredEnemies.has(enemyId)) {
    return;
  }
  if (!enemyCodexMap.has(enemyId)) {
    return;
  }
  codexState.encounteredEnemies.add(enemyId);
  renderEnemyCodex();
}

// Wires up codex UI buttons with helpers supplied by the main module.
export function bindCodexControls({
  setActiveTab,
  openFieldNotesOverlay,
  scrollPanelToElement,
  onOpenButtonReady,
}) {
  const openButton = document.getElementById('open-codex-button');
  if (openButton) {
    if (typeof onOpenButtonReady === 'function') {
      onOpenButtonReady(openButton);
    }
    openButton.addEventListener('click', () => {
      if (typeof setActiveTab === 'function') {
        setActiveTab('options');
      }
      if (typeof openFieldNotesOverlay === 'function') {
        openFieldNotesOverlay();
      }
    });
  }

  const optionsButton = document.getElementById('codex-options-button');
  if (optionsButton) {
    optionsButton.addEventListener('click', () => {
      if (typeof setActiveTab === 'function') {
        setActiveTab('options');
      }

      window.requestAnimationFrame(() => {
        const soundCard = document.getElementById('sound-card');
        if (soundCard && typeof scrollPanelToElement === 'function') {
          scrollPanelToElement(soundCard);
        }

        const musicSlider = document.getElementById('music-volume');
        if (musicSlider && typeof musicSlider.focus === 'function') {
          try {
            musicSlider.focus({ preventScroll: true });
          } catch (error) {
            musicSlider.focus();
          }
        }
      });
    });
  }
}
