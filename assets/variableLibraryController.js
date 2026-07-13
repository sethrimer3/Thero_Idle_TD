export function createVariableLibraryController({
  revealOverlay,
  scheduleOverlayHide,
  getDiscoveredVariables,
  addDiscoveredVariablesListener,
  openCraftingOverlay,
}) {
  let variableLibraryButton = null;
  let variableLibraryOverlay = null;
  let variableLibraryList = null;
  let variableLibraryLabel = null;
  let variableLibraryClose = null;
  let lastVariableLibraryTrigger = null;
  let removeVariableListener = null;

  function updateVariableLibraryButton(count = null) {
    if (!variableLibraryButton) {
      return;
    }
    const total = Number.isFinite(count) ? count : getDiscoveredVariables().length;
    const label =
      total > 1 ? `Variables (${total})` : total === 1 ? 'Variable (1)' : 'Variables';
    if (variableLibraryLabel) {
      variableLibraryLabel.textContent = label;
    }
    variableLibraryButton.setAttribute(
      'aria-label',
      `${label} — open variable glossary`,
    );
  }

  function renderVariableLibrary(variableList = null) {
    if (!variableLibraryList) {
      return;
    }
    const variables = Array.isArray(variableList) ? variableList : getDiscoveredVariables();
    updateVariableLibraryButton(variables.length);
    variableLibraryList.innerHTML = '';

    if (!variables.length) {
      const empty = document.createElement('li');
      empty.className = 'variable-library-empty';
      empty.textContent = 'Discover towers to reveal their variables.';
      variableLibraryList.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    variables.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'variable-library-item';
      const summaryPieces = [entry.symbol, entry.name, entry.description]
        .filter((value) => typeof value === 'string' && value.trim().length)
        .join(' — ');
      if (summaryPieces) {
        item.title = summaryPieces;
      }

      const header = document.createElement('div');
      header.className = 'variable-library-header';

      const symbol = document.createElement('span');
      symbol.className = 'variable-library-symbol';
      symbol.textContent = entry.symbol;

      const name = document.createElement('span');
      name.className = 'variable-library-name';
      name.textContent = entry.name;

      header.append(symbol, name);
      item.append(header);

      if (entry.description) {
        const description = document.createElement('p');
        description.className = 'variable-library-description';
        description.textContent = entry.description;
        item.append(description);
      }

      fragment.append(item);
    });

    variableLibraryList.append(fragment);
  }

  function isVariableLibraryActive() {
    return Boolean(variableLibraryOverlay?.classList.contains('active'));
  }

  function showVariableLibrary() {
    if (!variableLibraryOverlay) {
      return;
    }

    revealOverlay(variableLibraryOverlay);
    renderVariableLibrary();
    variableLibraryOverlay.setAttribute('aria-hidden', 'false');
    if (!variableLibraryOverlay.classList.contains('active')) {
      requestAnimationFrame(() => {
        variableLibraryOverlay.classList.add('active');
      });
    }

    if (variableLibraryButton) {
      variableLibraryButton.setAttribute('aria-expanded', 'true');
    }

    const focusTarget =
      variableLibraryClose || variableLibraryOverlay.querySelector('.overlay-panel');
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus();
    } else if (typeof variableLibraryOverlay.focus === 'function') {
      variableLibraryOverlay.focus();
    }
  }

  function hideVariableLibrary() {
    if (!variableLibraryOverlay) {
      return;
    }

    variableLibraryOverlay.classList.remove('active');
    variableLibraryOverlay.setAttribute('aria-hidden', 'true');
    scheduleOverlayHide(variableLibraryOverlay);
    if (variableLibraryButton) {
      variableLibraryButton.setAttribute('aria-expanded', 'false');
    }
    if (lastVariableLibraryTrigger && typeof lastVariableLibraryTrigger.focus === 'function') {
      lastVariableLibraryTrigger.focus();
    }
    lastVariableLibraryTrigger = null;
  }

  function bindVariableLibrary() {
    if (typeof removeVariableListener === 'function') {
      removeVariableListener();
      removeVariableListener = null;
    }

    variableLibraryButton = document.getElementById('tower-variable-library');
    variableLibraryOverlay = document.getElementById('variable-library-overlay');
    variableLibraryList = document.getElementById('variable-library-list');
    variableLibraryLabel = variableLibraryButton
      ? variableLibraryButton.querySelector('.tower-panel-button-label')
      : null;
    variableLibraryClose = variableLibraryOverlay
      ? variableLibraryOverlay.querySelector('[data-variable-library-close]')
      : null;

    if (variableLibraryOverlay && !variableLibraryOverlay.hasAttribute('tabindex')) {
      variableLibraryOverlay.setAttribute('tabindex', '-1');
    }

    if (variableLibraryButton) {
      variableLibraryButton.setAttribute('aria-expanded', 'false');
      variableLibraryButton.addEventListener('click', () => {
        lastVariableLibraryTrigger = variableLibraryButton;
        showVariableLibrary();
      });
    }

    if (variableLibraryClose) {
      variableLibraryClose.addEventListener('click', () => {
        hideVariableLibrary();
      });
    }

    if (variableLibraryOverlay) {
      variableLibraryOverlay.addEventListener('click', (event) => {
        if (event.target === variableLibraryOverlay) {
          hideVariableLibrary();
        }
      });
    }

    const handleVariablesChanged = (variables) => {
      if (variableLibraryOverlay?.classList.contains('active')) {
        renderVariableLibrary(variables);
        return;
      }
      updateVariableLibraryButton(Array.isArray(variables) ? variables.length : null);
    };

    removeVariableListener = addDiscoveredVariablesListener(handleVariablesChanged);

    const equipmentButton = document.getElementById('tower-equipment-button');
    if (equipmentButton) {
      equipmentButton.addEventListener('click', (event) => {
        event.preventDefault();
        openCraftingOverlay();
      });
    }

    updateVariableLibraryButton();
  }

  function handleKeydown(event) {
    if (!isVariableLibraryActive()) {
      return false;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      hideVariableLibrary();
      return true;
    }

    if ((event.key === 'Enter' || event.key === ' ') && event.target === variableLibraryOverlay) {
      event.preventDefault();
      hideVariableLibrary();
      return true;
    }

    return false;
  }

  return {
    bindVariableLibrary,
    hideVariableLibrary,
    isVariableLibraryActive,
    handleKeydown,
  };
}
