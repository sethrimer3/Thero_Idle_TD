import { generateMasterEquationText } from './towerEquations/masterEquationUtils.js';

/**
 * Tower upgrade overlay controller responsible for rendering the equation panel,
 * glyph investment controls, and overlay transitions. The implementation is
 * dependency injected so `assets/towersTab.js` can provide shared state and
 * helper utilities without recreating tightly coupled closures.
 */
export function createTowerUpgradeOverlayController({
  towerTabState,
  hasPointerEvents = false,
  formatters,
  math,
  tooltip,
  dependencies,
} = {}) {
  if (!towerTabState) {
    throw new Error('createTowerUpgradeOverlayController requires a towerTabState object.');
  }

  const {
    formatWholeNumber,
    formatDecimal,
    formatGameNumber,
  } = formatters || {};

  const {
    renderMathElement,
    convertMathExpressionToPlainText,
    tokenizeEquationParts,
  } = math || {};

  const {
    ensureTooltipElement,
    buildVariableTooltip,
    hideTooltip,
    handlePointerEnter,
    handlePointerLeave,
    handleFocus,
    handleBlur,
  } = tooltip || {};

  const {
    ensureTowerUpgradeState,
    getTowerEquationBlueprint,
    getTowerDefinition,
    computeTowerVariableValue,
    calculateTowerVariableUpgradeCost,
    calculateTowerEquationResult,
    invalidateTowerEquationCache,
    buildTowerDynamicContext,
  } = dependencies || {};

  if (
    !formatWholeNumber ||
    !formatDecimal ||
    !formatGameNumber ||
    !renderMathElement ||
    !convertMathExpressionToPlainText ||
    !tokenizeEquationParts ||
    !ensureTooltipElement ||
    !buildVariableTooltip ||
    !hideTooltip ||
    !handlePointerEnter ||
    !handlePointerLeave ||
    !handleFocus ||
    !handleBlur ||
    !ensureTowerUpgradeState ||
    !getTowerEquationBlueprint ||
    !getTowerDefinition ||
    !computeTowerVariableValue ||
    !calculateTowerVariableUpgradeCost ||
    !calculateTowerEquationResult ||
    !invalidateTowerEquationCache ||
    !buildTowerDynamicContext
  ) {
    throw new Error('createTowerUpgradeOverlayController is missing required dependencies.');
  }

  /**
   * Escape special characters so variable keys can be used in RegExp patterns.
   */
  function escapeRegExp(value) {
    if (typeof value !== 'string') {
      return '';
    }
    return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  }

  /**
   * Escape characters that are invalid inside CSS attribute selectors.
   */
  function escapeCssSelector(value) {
    if (typeof value !== 'string') {
      return '';
    }
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
  }

  /**
   * Compose a tower display label that keeps lowercase glyphs intact.
   */
  function composeTowerDisplayLabel(definition, fallback = '') {
    if (!definition || typeof definition !== 'object') {
      return fallback;
    }
    const symbol = typeof definition.symbol === 'string' ? definition.symbol.trim() : '';
    const name = typeof definition.name === 'string' ? definition.name.trim() : '';
    if (symbol && name) {
      const normalizedSymbol = symbol.normalize('NFKC');
      const normalizedName = name.normalize('NFKC');
      if (normalizedName.startsWith(normalizedSymbol)) {
        return name;
      }
      return `${symbol} ${name}`;
    }
    if (name) {
      return name;
    }
    if (symbol) {
      return symbol;
    }
    return fallback;
  }

  /** Reset overlay animation bookkeeping whenever a new tower is rendered. */
  function resetTowerVariableAnimationState() {
    towerTabState.towerVariableAnimation.towerId = null;
    towerTabState.towerVariableAnimation.variableMap = new Map();
    towerTabState.towerVariableAnimation.variableSpans = new Map();
    towerTabState.towerVariableAnimation.entryPlayed = false;
    towerTabState.towerVariableAnimation.shouldPlayEntry = false;
  }

  const DYNAMIC_EQUATION_PATTERN = /([α-ω]_[α-ω])/gu;
  const DYNAMIC_VARIABLE_TOKEN = /^[α-ω]_[α-ω]$/u;

  /**
   * Append equation text to the provided element while preserving dynamic
   * variable markers that animate during overlay transitions.
   */
  function appendEquationText(target, text) {
    if (!target) {
      return;
    }
    const segments = String(text ?? '').split(DYNAMIC_EQUATION_PATTERN);
    segments.forEach((segment) => {
      if (!segment) {
        return;
      }
      if (DYNAMIC_VARIABLE_TOKEN.test(segment)) {
        const dynamic = document.createElement('span');
        dynamic.classList.add('tower-upgrade-formula-part--dynamic', 'dynamic-variable');
        dynamic.textContent = segment;
        target.append(dynamic);
      } else {
        target.append(document.createTextNode(segment));
      }
    });
  }

  /**
   * Render an equation variable, splitting the first character so it can animate
   * separately from the trailing glyph.
   */
  function appendEquationVariable(target, label) {
    if (!target) {
      return;
    }
    const text = typeof label === 'string' && label.trim() ? label.trim() : '';
    if (!text) {
      appendEquationText(target, label);
      return;
    }
    const [firstChar, ...restChars] = Array.from(text);
    appendEquationText(target, firstChar);
    if (restChars.length) {
      const tail = document.createElement('span');
      tail.className = 'tower-upgrade-formula-part-tail';
      appendEquationText(tail, restChars.join(''));
      target.append(tail);
    }
  }

  /**
   * Populate the base equation element with interactive spans for each variable.
   */
  function renderTowerUpgradeEquationParts(baseEquationText, blueprint, options = {}) {
    const baseEquationEl = towerTabState.towerUpgradeElements.baseEquation;
    if (!baseEquationEl) {
      return;
    }
    hideTooltip({ immediate: true });
    const markDeparted = options.markDeparted === true;
    const resolvedEquation = convertMathExpressionToPlainText(baseEquationText) || baseEquationText || '';
    baseEquationEl.innerHTML = '';

    const blueprintVariables = Array.isArray(blueprint?.variables) ? blueprint.variables : [];
    const tokens = tokenizeEquationParts(
      resolvedEquation,
      blueprintVariables.map((variable) => ({
        key: variable.key,
        symbol: variable.equationSymbol || variable.symbol || variable.key.toUpperCase(),
      })),
    );

    const fragment = document.createDocumentFragment();
    const spanMap = new Map();

    tokens.forEach((token) => {
      const span = document.createElement('span');
      span.className = 'tower-upgrade-formula-part';
      span.textContent = '';

      if (token.variableKey) {
        span.dataset.variable = token.variableKey;
        span.classList.add('tower-upgrade-formula-part--variable');
        const variable = getBlueprintVariable(blueprint, token.variableKey);
        const tooltipText = buildVariableTooltip(variable, token.text);
        if (tooltipText) {
          span.dataset.tooltip = tooltipText;
          span.setAttribute('aria-label', tooltipText);
          span.tabIndex = 0;
          if (hasPointerEvents) {
            span.addEventListener('pointerenter', handlePointerEnter);
            span.addEventListener('pointerleave', handlePointerLeave);
            span.addEventListener('pointercancel', handlePointerLeave);
          } else {
            span.addEventListener('mouseenter', handlePointerEnter);
            span.addEventListener('mouseleave', handlePointerLeave);
          }
          span.addEventListener('focus', handleFocus);
          span.addEventListener('blur', handleBlur);
        }
        if (!spanMap.has(token.variableKey)) {
          spanMap.set(token.variableKey, []);
        }
        spanMap.get(token.variableKey).push(span);
        if (markDeparted) {
          span.classList.add('is-departed');
        }
        if (variable && typeof variable.equationSymbol === 'string') {
          appendEquationVariable(span, variable.equationSymbol);
        } else {
          appendEquationText(span, token.text);
        }
      } else {
        appendEquationText(span, token.text);
      }

      fragment.append(span);
    });

    if (!tokens.length) {
      const fallback = document.createElement('span');
      fallback.className = 'tower-upgrade-formula-part';
      appendEquationText(fallback, resolvedEquation);
      fragment.append(fallback);
    }

    baseEquationEl.append(fragment);
    towerTabState.towerVariableAnimation.variableSpans = spanMap;
  }

  /**
   * Map rendered variable spans to their corresponding cards for animation.
   */
  function refreshTowerVariableAnimationState(towerId, blueprint) {
    const spanMap = towerTabState.towerVariableAnimation.variableSpans || new Map();
    const nextMap = new Map();
    const { variables } = towerTabState.towerUpgradeElements;

    if (variables) {
      const upgradableVariables = (blueprint?.variables || []).filter((variable) => variable.upgradable !== false);
      upgradableVariables.forEach((variable) => {
        const key = variable.key;
        const spans = spanMap.get(key) || [];
        const selector = `[data-variable="${escapeCssSelector(key)}"]`;
        const card = variables.querySelector(selector);
        if (spans.length && card) {
          nextMap.set(key, { spans, card, variable });
        }
      });
    }

    towerTabState.towerVariableAnimation.towerId = towerId;
    towerTabState.towerVariableAnimation.variableMap = nextMap;
    towerTabState.towerVariableAnimation.variableSpans = new Map();
  }

  /** Ensure variable cards toggle their visibility state consistently. */
  function syncTowerVariableCardVisibility() {
    const container = towerTabState.towerUpgradeElements.variables;
    if (!container) {
      return;
    }
    const cards = container.querySelectorAll('.tower-upgrade-variable');
    cards.forEach((card, index) => {
      card.style.setProperty('--tower-upgrade-variable-index', index);
      if (towerTabState.towerVariableAnimation.entryPlayed) {
        card.classList.add('is-visible');
      } else {
        card.classList.remove('is-visible');
      }
    });
  }

  /**
   * Animate cloned equation glyphs between the formula and variable cards.
   */
  function playTowerVariableFlight(direction = 'enter') {
    const panel = towerTabState.towerUpgradeElements.panel;
    if (!panel) {
      return Promise.resolve();
    }

    const variableMap = towerTabState.towerVariableAnimation.variableMap;
    if (!variableMap || variableMap.size === 0) {
      towerTabState.towerVariableAnimation.entryPlayed = direction === 'enter';
      syncTowerVariableCardVisibility();
      return Promise.resolve();
    }

    const panelRect = panel.getBoundingClientRect();
    const animations = [];
    const clones = [];
    let index = 0;

    variableMap.forEach(({ spans, card }) => {
      const symbolEl = card.querySelector('.tower-upgrade-variable-symbol');
      if (!symbolEl) {
        return;
      }
      const targetRect = symbolEl.getBoundingClientRect();
      const spansToUse = Array.isArray(spans) ? spans : [];

      if (direction === 'enter') {
        card.classList.remove('is-visible');
        card.classList.add('is-incoming');
      } else {
        card.classList.add('is-outgoing');
      }

      spansToUse.forEach((span) => {
        const spanRect = span.getBoundingClientRect();
        const startRect = direction === 'enter' ? spanRect : targetRect;
        const endRect = direction === 'enter' ? targetRect : spanRect;

        const clone = document.createElement('span');
        clone.className = 'tower-upgrade-formula-flight';
        clone.textContent = span.textContent || symbolEl.textContent || '';
        clone.style.left = `${startRect.left - panelRect.left}px`;
        clone.style.top = `${startRect.top - panelRect.top}px`;
        clone.style.width = `${startRect.width}px`;
        clone.style.height = `${startRect.height}px`;

        const deltaX = endRect.left + endRect.width / 2 - (startRect.left + startRect.width / 2);
        const deltaY = endRect.top + endRect.height / 2 - (startRect.top + startRect.height / 2);

        const keyframes =
          direction === 'enter'
            ? [
                { transform: 'translate3d(0, 0, 0)', opacity: 1 },
                { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)`, opacity: 0 },
              ]
            : [
                { transform: 'translate3d(0, 0, 0)', opacity: 0 },
                { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)`, opacity: 1 },
              ];

        panel.append(clone);
        clones.push(clone);

        const animation = clone.animate(keyframes, {
          duration: 560,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          delay: index * 40,
          fill: 'forwards',
        });
        animations.push(animation.finished.catch(() => {}));
        animation.addEventListener('finish', () => {
          clone.remove();
        });

        index += 1;
      });
    });

    if (direction === 'enter') {
      variableMap.forEach(({ spans }) => {
        (spans || []).forEach((span) => {
          span.classList.add('is-departed');
        });
      });
    }

    const finalize = () => {
      clones.forEach((clone) => {
        if (clone.parentNode) {
          clone.parentNode.removeChild(clone);
        }
      });

      variableMap.forEach(({ card, spans }) => {
        card.classList.remove('is-incoming', 'is-outgoing');
        if (direction === 'exit') {
          (spans || []).forEach((span) => span.classList.remove('is-departed'));
        }
      });

      towerTabState.towerVariableAnimation.entryPlayed = direction === 'enter';
      syncTowerVariableCardVisibility();
    };

    if (!animations.length) {
      finalize();
      return Promise.resolve();
    }

    return Promise.allSettled(animations).then(() => {
      finalize();
    });
  }

  /** Trigger the entry animation after the overlay mounts. */
  function maybePlayTowerVariableEntry() {
    if (!towerTabState.towerVariableAnimation.shouldPlayEntry) {
      syncTowerVariableCardVisibility();
      return;
    }

    towerTabState.towerVariableAnimation.shouldPlayEntry = false;
    requestAnimationFrame(() => {
      playTowerVariableFlight('enter');
    });
  }

  /** Extract the base equation text from a tower card for overlay reuse. */
  function extractTowerCardEquation(card) {
    if (!(card instanceof HTMLElement)) {
      return '';
    }
    const line = card.querySelector('.formula-block .formula-line');
    if (!line) {
      return '';
    }
    const text = line.textContent || '';
    return text.trim();
  }

  /**
   * Update the glyph availability message shown inside the overlay header.
   */
  function updateTowerUpgradeGlyphDisplay() {
    const { glyphs } = towerTabState.towerUpgradeElements;
    if (!glyphs) {
      return;
    }
    const alephAvailable = Math.max(0, Math.floor(towerTabState.glyphCurrency));
    const betAvailable = Math.max(0, Math.floor(towerTabState.betGlyphCurrency));
    const segments = [
      `Available Glyphs: ${formatWholeNumber(alephAvailable)} ℵ`,
      `Bet Glyphs: ${formatWholeNumber(betAvailable)} בּ`,
    ];
    glyphs.textContent = segments.join(' • ');
  }

  /** Present contextual messaging below the variable list. */
  function setTowerUpgradeNote(message, tone = '') {
    const { note } = towerTabState.towerUpgradeElements;
    if (!note) {
      return;
    }
    note.textContent = message || '';
    if (tone) {
      note.dataset.tone = tone;
    } else {
      note.removeAttribute('data-tone');
    }
  }

  function formatTowerVariableValue(variable, value) {
    if (!Number.isFinite(value)) {
      return '0';
    }
    if (variable && typeof variable.format === 'function') {
      try {
        const formatted = variable.format(value);
        if (typeof formatted === 'string') {
          return formatted;
        }
      } catch (error) {
        // Ignore formatting errors and fall back to default formatting.
      }
    }
    return Number.isInteger(value) ? formatWholeNumber(value) : formatDecimal(value, 2);
  }

  const ALEPH_SUBSCRIPT_DIGITS = {
    0: '₀',
    1: '₁',
    2: '₂',
    3: '₃',
    4: '₄',
    5: '₅',
    6: '₆',
    7: '₇',
    8: '₈',
    9: '₉',
  };

  function toAlephSubscript(value) {
    const normalized = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    return `${normalized}`
      .split('')
      .map((digit) => ALEPH_SUBSCRIPT_DIGITS[digit] || digit)
      .join('');
  }

  function formatAlephGlyphLabelFromString(value) {
    if (typeof value !== 'string') {
      return '';
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    if (trimmed.startsWith('ℵ')) {
      return trimmed;
    }
    const match = trimmed.match(/aleph\s*(\d+)/i);
    if (match) {
      const index = Number.parseInt(match[1], 10);
      if (Number.isFinite(index)) {
        return `ℵ${toAlephSubscript(index)}`;
      }
    }
    return '';
  }

  function getVariableGlyphLabel(variable) {
    if (!variable) {
      return 'ℵ';
    }

    if (typeof variable.glyphLabel === 'string' && variable.glyphLabel.trim()) {
      return variable.glyphLabel.trim();
    }

    const candidates = [variable.symbol, variable.equationSymbol, variable.name, variable.key];
    for (const candidate of candidates) {
      const label = formatAlephGlyphLabelFromString(candidate);
      if (label) {
        return label;
      }
    }

    return 'ℵ';
  }

  function getVariableCurrencyKey(variable) {
    return variable?.glyphCurrency === 'bet' ? 'bet' : 'aleph';
  }

  function getCurrencyMeta(currencyKey = 'aleph') {
    if (currencyKey === 'bet') {
      return { singular: 'Bet glyph', plural: 'Bet glyphs', short: 'Bet Glyphs', symbol: 'בּ' };
    }
    return { singular: 'glyph', plural: 'glyphs', short: 'Glyphs', symbol: 'ℵ' };
  }

  function getAvailableCurrency(currencyKey = 'aleph') {
    const balance = currencyKey === 'bet' ? towerTabState.betGlyphCurrency : towerTabState.glyphCurrency;
    return Math.max(0, Math.floor(balance || 0));
  }

  function adjustCurrencyBalance(currencyKey = 'aleph', delta = 0) {
    if (currencyKey === 'bet') {
      towerTabState.betGlyphCurrency = Math.max(0, Math.floor((towerTabState.betGlyphCurrency || 0) + delta));
      return towerTabState.betGlyphCurrency;
    }
    towerTabState.glyphCurrency = Math.max(0, Math.floor((towerTabState.glyphCurrency || 0) + delta));
    return towerTabState.glyphCurrency;
  }

  function buildVariableGlyphControls(variable, towerId, level, options = {}) {
    const { asAttachment = false } = options;
    const controls = document.createElement('div');
    controls.className = 'tower-upgrade-variable-controls';
    if (asAttachment) {
      controls.classList.add('tower-upgrade-variable-controls--attachment');
    }

    const glyphControl = document.createElement('div');
    glyphControl.className = 'tower-upgrade-variable-glyph-control';
    if (asAttachment) {
      glyphControl.classList.add('tower-upgrade-variable-glyph-control--attachment');
    }

    const cost = calculateTowerVariableUpgradeCost(variable, level);
    const maxLevel =
      Number.isFinite(variable.maxLevel) && variable.maxLevel >= 0 ? Math.floor(variable.maxLevel) : null;
    const reachedMax = maxLevel !== null && level >= maxLevel;
    const currencyKey = getVariableCurrencyKey(variable);
    const currencyMeta = getCurrencyMeta(currencyKey);
    const availableGlyphs = getAvailableCurrency(currencyKey);

    const decrement = document.createElement('button');
    decrement.type = 'button';
    decrement.className = 'tower-upgrade-variable-glyph-button tower-upgrade-variable-glyph-button--decrease';
    decrement.textContent = '−';
    decrement.disabled = level <= 0;
    decrement.setAttribute('aria-label', `Withdraw glyphs from ${variable.symbol || variable.key}`);
    decrement.addEventListener('click', () => handleTowerVariableDowngrade(towerId, variable.key));
    glyphControl.append(decrement);

    const glyphCount = document.createElement('span');
    glyphCount.className = 'tower-upgrade-variable-glyph-count';
    glyphCount.textContent = `${level} ${getVariableGlyphLabel(variable)}`;
    glyphControl.append(glyphCount);

    const increment = document.createElement('button');
    increment.type = 'button';
    increment.className = 'tower-upgrade-variable-glyph-button tower-upgrade-variable-glyph-button--increase';
    increment.dataset.upgradeVariable = variable.key;
    increment.textContent = '+';
    increment.disabled = availableGlyphs < cost || reachedMax;
    increment.setAttribute('aria-label', `Invest glyph into ${variable.symbol || variable.key}`);
    increment.addEventListener('click', () => handleTowerVariableUpgrade(towerId, variable.key));
    glyphControl.append(increment);

    controls.append(glyphControl);

    const costNote = document.createElement('span');
    costNote.className = 'tower-upgrade-variable-cost';
    const costLabel = cost === 1 ? currencyMeta.singular : currencyMeta.plural;
    costNote.textContent = `COST: ${cost} ${costLabel.toUpperCase()}`;
    controls.append(costNote);

    if (maxLevel !== null) {
      const maxNote = document.createElement('span');
      maxNote.className = 'tower-upgrade-variable-max';
      maxNote.textContent = `MAX: ${formatWholeNumber(maxLevel)}`;
      controls.append(maxNote);
    }

    return controls;
  }

  function resolveTowerVariableSubEquations(variable, context = {}) {
    if (!variable) {
      return [];
    }

    const lines = [];
    const collect = (entry) => {
      if (!entry) {
        return;
      }
      if (Array.isArray(entry)) {
        entry.forEach((value) => collect(value));
        return;
      }
      if (typeof entry === 'function') {
        try {
          collect(entry(context));
        } catch (error) {
          console.warn('Failed to evaluate tower variable sub-equation', error);
        }
        return;
      }
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (trimmed) {
          lines.push({ text: trimmed, variant: 'expression' });
        }
        return;
      }
      if (entry && typeof entry === 'object') {
        const glyphEquation = entry.glyphEquation === true || entry.category === 'glyph';
        if (typeof entry.text === 'string' && entry.text.trim()) {
          lines.push({
            text: entry.text.trim(),
            variant: entry.variant === 'values' ? 'values' : 'expression',
            glyphEquation,
          });
        }
        if (typeof entry.expression === 'string' && entry.expression.trim()) {
          lines.push({ text: entry.expression.trim(), variant: 'expression', glyphEquation });
        }
        if (typeof entry.values === 'string' && entry.values.trim()) {
          lines.push({ text: entry.values.trim(), variant: 'values', glyphEquation });
        }
      }
    };

    if (typeof variable.getSubEquations === 'function') {
      collect(variable.getSubEquations(context));
    }
    collect(variable.subEquations);
    collect(variable.subEquation);
    if (typeof variable.getSubEquation === 'function') {
      collect(variable.getSubEquation(context));
    }

    return lines;
  }

  function getBlueprintVariable(blueprint, key) {
    if (!blueprint || !key) {
      return null;
    }
    return (blueprint.variables || []).find((variable) => variable.key === key) || null;
  }

  function renderTowerUpgradeVariables(towerId, blueprint, values = {}) {
    const { variables } = towerTabState.towerUpgradeElements;
    if (!variables) {
      return;
    }
    const container = variables;
    if (towerId) {
      container.dataset.towerId = towerId;
    } else {
      container.removeAttribute('data-tower-id');
    }
    container.innerHTML = '';
    const blueprintVariables = blueprint?.variables || [];
    const state = ensureTowerUpgradeState(towerId, blueprint);

    if (!blueprintVariables.length) {
      const empty = document.createElement('p');
      empty.className = 'tower-upgrade-variable-note';
      empty.textContent = 'This lattice has no adjustable variables yet.';
      container.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    const mathElements = [];
    const attachmentMap = new Map();

    blueprintVariables.forEach((variable) => {
      const parentKey =
        typeof variable.attachedToVariable === 'string' && variable.attachedToVariable.trim()
          ? variable.attachedToVariable.trim()
          : '';
      if (parentKey) {
        if (!attachmentMap.has(parentKey)) {
          attachmentMap.set(parentKey, []);
        }
        attachmentMap.get(parentKey).push(variable);
      }
    });

    blueprintVariables.forEach((variable) => {
      const attachmentParent =
        typeof variable.attachedToVariable === 'string' && variable.attachedToVariable.trim()
          ? variable.attachedToVariable.trim()
          : '';
      if (attachmentParent) {
        return;
      }

      const attachments = attachmentMap.get(variable.key) || [];
      const value = Number.isFinite(values[variable.key]) ? values[variable.key] : 0;
      const level = state.variables?.[variable.key]?.level || 0;

      const item = document.createElement('div');
      item.className = 'tower-upgrade-variable';
      item.setAttribute('role', 'listitem');
      item.dataset.variable = variable.key;
      const hasAttachmentUpgrade = attachments.some((attachment) => attachment.upgradable !== false);
      if (variable.upgradable !== false || hasAttachmentUpgrade) {
        item.classList.add('tower-upgrade-variable--upgradable');
      }

      const header = document.createElement('div');
      header.className = 'tower-upgrade-variable-header';

      const symbol = document.createElement('span');
      symbol.className = 'tower-upgrade-variable-symbol';
      symbol.textContent = variable.symbol || variable.key.toUpperCase();
      header.append(symbol);

      const summary = document.createElement('div');
      const name = document.createElement('p');
      name.className = 'tower-upgrade-variable-name';
      name.textContent = variable.name || `Variable ${variable.symbol || variable.key}`;
      summary.append(name);

      if (variable.description) {
        const description = document.createElement('p');
        description.className = 'tower-upgrade-variable-description';
        description.textContent = variable.description;
        summary.append(description);
      }

      header.append(summary);
      item.append(header);

      const subEquationLines = resolveTowerVariableSubEquations(variable, {
        level,
        value,
        variable,
        towerId,
        blueprint,
        values,
        formatValue: () => formatTowerVariableValue(variable, value),
        formatWholeNumber,
        formatDecimal,
        formatGameNumber,
        dynamicContext: towerTabState.dynamicContext,
      });

      const attachmentDetails = attachments.map((attachment) => {
        const attachmentLevel = state.variables?.[attachment.key]?.level || 0;
        const attachmentValue = Number.isFinite(values[attachment.key]) ? values[attachment.key] : 0;
        const attachmentLines = resolveTowerVariableSubEquations(attachment, {
          level: attachmentLevel,
          value: attachmentValue,
          variable: attachment,
          towerId,
          blueprint,
          values,
          parentVariable: variable,
          formatValue: () => formatTowerVariableValue(attachment, attachmentValue),
          formatWholeNumber,
          formatDecimal,
          formatGameNumber,
          dynamicContext: towerTabState.dynamicContext,
        }).map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return {
              text: typeof entry === 'string' ? entry : '',
              variant: 'expression',
              attachmentKey: attachment.key,
              glyphEquation: true,
            };
          }
          return {
            ...entry,
            attachmentKey: attachment.key,
            glyphEquation: true,
          };
        });
        return {
          variable: attachment,
          level: attachmentLevel,
          value: attachmentValue,
          lines: attachmentLines,
        };
      });

      attachmentDetails.forEach((detail) => {
        subEquationLines.push(...detail.lines);
      });

      if (subEquationLines.length) {
        const equations = document.createElement('div');
        equations.className = 'tower-upgrade-variable-equations';
        subEquationLines.forEach((entry) => {
          let text = '';
          let variant = 'expression';
          if (entry && typeof entry === 'object') {
            if (typeof entry.text === 'string') {
              text = entry.text.trim();
              if (entry.variant === 'values') {
                variant = 'values';
              }
            } else if (typeof entry.expression === 'string') {
              text = entry.expression.trim();
            }
            if (!text && typeof entry.values === 'string') {
              text = entry.values.trim();
              variant = 'values';
            }
          } else if (typeof entry === 'string') {
            text = entry.trim();
          }
          if (!text) {
            return;
          }
          const lineEl = document.createElement('p');
          lineEl.className = 'tower-upgrade-variable-equation-line';
          const isGlyphEquation = Boolean(entry && typeof entry === 'object' && entry.glyphEquation);
          if (isGlyphEquation) {
            lineEl.classList.add('tower-upgrade-variable-equation-line--glyph');
          } else {
            lineEl.classList.add('tower-upgrade-variable-equation-line--sub');
          }
          if (variant === 'values') {
            lineEl.classList.add('tower-upgrade-variable-equation-line--values');
          }
          if (entry && typeof entry === 'object' && entry.attachmentKey) {
            lineEl.dataset.attachment = entry.attachmentKey;
            lineEl.classList.add('tower-upgrade-variable-equation-line--attachment');
          }
          lineEl.textContent = text;
          equations.append(lineEl);
          mathElements.push(lineEl);
        });
        item.append(equations);
      }

      if (variable.upgradable !== false) {
        item.append(buildVariableGlyphControls(variable, towerId, level));
      }

      attachments.forEach((attachment) => {
        const attachmentState = state.variables?.[attachment.key] || { level: 0 };
        const attachmentValue = Number.isFinite(values[attachment.key]) ? values[attachment.key] : 0;
        const attachmentItem = document.createElement('div');
        attachmentItem.className = 'tower-upgrade-variable tower-upgrade-variable--attachment';
        attachmentItem.dataset.variable = attachment.key;

        const attachmentHeader = document.createElement('div');
        attachmentHeader.className = 'tower-upgrade-variable-header';

        const attachmentSymbol = document.createElement('span');
        attachmentSymbol.className = 'tower-upgrade-variable-symbol';
        attachmentSymbol.textContent = attachment.symbol || attachment.key.toUpperCase();
        attachmentHeader.append(attachmentSymbol);

        const attachmentSummary = document.createElement('div');
        const attachmentName = document.createElement('p');
        attachmentName.className = 'tower-upgrade-variable-name';
        attachmentName.textContent = attachment.name || `Attachment ${attachment.symbol || attachment.key}`;
        attachmentSummary.append(attachmentName);

        if (attachment.description) {
          const attachmentDescription = document.createElement('p');
          attachmentDescription.className = 'tower-upgrade-variable-description';
          attachmentDescription.textContent = attachment.description;
          attachmentSummary.append(attachmentDescription);
        }

        attachmentHeader.append(attachmentSummary);
        attachmentItem.append(attachmentHeader);

        const attachmentLines = resolveTowerVariableSubEquations(attachment, {
          level: attachmentState.level || 0,
          value: attachmentValue,
          variable: attachment,
          towerId,
          blueprint,
          values,
          parentVariable: variable,
          formatValue: () => formatTowerVariableValue(attachment, attachmentValue),
          formatWholeNumber,
          formatDecimal,
          formatGameNumber,
          dynamicContext: towerTabState.dynamicContext,
        });

        if (attachmentLines.length) {
          const attachmentEquations = document.createElement('div');
          attachmentEquations.className = 'tower-upgrade-variable-equations';
          attachmentLines.forEach((line) => {
            const entry =
              typeof line === 'object'
                ? line
                : { text: typeof line === 'string' ? line : '', variant: 'expression' };
            const equationLine = document.createElement('p');
            equationLine.className = 'tower-upgrade-variable-equation-line tower-upgrade-variable-equation-line--attachment';
            if (entry.variant === 'values') {
              equationLine.classList.add('tower-upgrade-variable-equation-line--values');
            }
            equationLine.textContent = (entry.text || entry.expression || entry.values || '').trim();
            if (!equationLine.textContent) {
              return;
            }
            equationLine.dataset.attachment = attachment.key;
            attachmentEquations.append(equationLine);
            mathElements.push(equationLine);
          });
          attachmentItem.append(attachmentEquations);
        }

        if (attachment.upgradable !== false) {
          attachmentItem.append(
            buildVariableGlyphControls(attachment, towerId, attachmentState.level || 0, { asAttachment: true }),
          );
        }

        item.append(attachmentItem);
      });

      fragment.append(item);
    });

    container.append(fragment);
    mathElements.forEach((element) => renderMathElement(element));

    // Ensure freshly rendered variable cards inherit the correct visibility state
    // so their sub-equation stacks do not remain hidden after re-renders.
    syncTowerVariableCardVisibility();

    towerTabState.towerUpgradeElements.lastRenderedTowerId = towerId;
  }

  function formatTowerEquationResultValue(value) {
    if (!Number.isFinite(value)) {
      return '0';
    }
    if (Math.abs(value) >= 1000) {
      return formatGameNumber(value);
    }
    return formatDecimal(value, 2);
  }

  function renderTowerUpgradeOverlay(towerId, options = {}) {
    const blueprint = options.blueprint || getTowerEquationBlueprint(towerId);
    const definition = getTowerDefinition(towerId);
    if (!blueprint || !definition) {
      resetTowerVariableAnimationState();
      return;
    }

    const { panel, lastRenderedTowerId } = towerTabState.towerUpgradeElements;
    if (panel) {
      // Preserve the scroll position while browsing unless this is a new entry
      // animation or the caller explicitly requests a reset.
      const shouldResetScroll =
        options.resetScroll === true ||
        (options.resetScroll !== false && (options.animateEntry || lastRenderedTowerId !== towerId));
      if (shouldResetScroll) {
        panel.scrollTo({ top: 0, behavior: 'instant' in panel ? 'instant' : 'auto' });
      }
    }

    if (options.animateEntry) {
      towerTabState.towerVariableAnimation.shouldPlayEntry = true;
      towerTabState.towerVariableAnimation.entryPlayed = false;
    } else {
      towerTabState.towerVariableAnimation.shouldPlayEntry = false;
    }

    const autoMasterEquation = generateMasterEquationText({
      blueprint,
      definition,
      towerId,
      format: 'plain',
      fallback: typeof blueprint.baseEquation === 'string' ? blueprint.baseEquation : '',
    });

    const providedEquation =
      typeof options.baseEquationText === 'string' && options.baseEquationText.trim()
        ? options.baseEquationText.trim()
        : '';
    const cachedEquation =
      typeof towerTabState.activeTowerUpgradeBaseEquation === 'string'
        ? towerTabState.activeTowerUpgradeBaseEquation.trim()
        : '';
    const baseEquationText = providedEquation || cachedEquation || autoMasterEquation || '';
    towerTabState.activeTowerUpgradeBaseEquation = baseEquationText;

    if (towerTabState.towerUpgradeElements.title) {
      towerTabState.towerUpgradeElements.title.textContent = composeTowerDisplayLabel(definition);
    }

    if (towerTabState.towerUpgradeElements.tier) {
      const tierLabel = typeof definition.tierLabel === 'string' ? definition.tierLabel : `Tier ${definition.tier || 1}`;
      towerTabState.towerUpgradeElements.tier.textContent = tierLabel;
    }

    if (towerTabState.towerUpgradeElements.icon) {
      const iconContainer = towerTabState.towerUpgradeElements.icon;
      iconContainer.innerHTML = '';
      if (definition.icon) {
        const img = document.createElement('img');
        img.src = definition.icon;
        const iconLabel = composeTowerDisplayLabel(definition, 'tower');
        img.alt = iconLabel ? `${iconLabel} icon` : 'Tower icon';
        img.loading = 'lazy';
        img.decoding = 'async';
        iconContainer.hidden = false;
        iconContainer.append(img);
      } else {
        iconContainer.hidden = true;
      }
    }

    if (towerTabState.towerUpgradeElements.baseEquation) {
      renderTowerUpgradeEquationParts(baseEquationText, blueprint, {
        markDeparted: towerTabState.towerVariableAnimation.entryPlayed,
      });
    }

    const values = {};
    (blueprint.variables || []).forEach((variable) => {
      values[variable.key] = computeTowerVariableValue(towerId, variable.key, blueprint);
    });

    let result = 0;
    if (typeof blueprint.computeResult === 'function') {
      result = blueprint.computeResult(values, { definition });
    }
    if (!Number.isFinite(result)) {
      result = 0;
    }

    if (towerTabState.towerUpgradeElements.baseEquationValues) {
      const baseValuesEl = towerTabState.towerUpgradeElements.baseEquationValues;
      const formatComponent = formatTowerEquationResultValue;

      let equationLine = '';
      if (typeof blueprint.formatBaseEquationValues === 'function') {
        try {
          equationLine = blueprint.formatBaseEquationValues({
            values,
            result,
            formatComponent,
          });
        } catch (error) {
          console.warn('Failed to format base equation values', error);
        }
      }

      if (typeof equationLine !== 'string' || !equationLine.trim()) {
        const keys = Object.keys(values);
        if (keys.length) {
          const parts = keys.map((key) => formatComponent(values[key]));
          equationLine = `= ${parts.join(' × ')}`;
          if (Number.isFinite(result)) {
            equationLine += ` = ${formatComponent(result)}`;
          }
        } else if (Number.isFinite(result)) {
          equationLine = `= ${formatComponent(result)}`;
        } else {
          equationLine = '';
        }
      }

      baseValuesEl.textContent = equationLine || '';
      renderMathElement(baseValuesEl);
    }

    renderTowerUpgradeVariables(towerId, blueprint, values);
    refreshTowerVariableAnimationState(towerId, blueprint);
    updateTowerUpgradeGlyphDisplay();
  }

  function cancelTowerUpgradeOverlayHide() {
    const { overlay, hideTimeoutId, hideTransitionHandler } = towerTabState.towerUpgradeElements;
    if (typeof window !== 'undefined' && typeof hideTimeoutId === 'number') {
      window.clearTimeout(hideTimeoutId);
    }
    towerTabState.towerUpgradeElements.hideTimeoutId = null;
    if (overlay && typeof hideTransitionHandler === 'function') {
      overlay.removeEventListener('transitionend', hideTransitionHandler);
    }
    towerTabState.towerUpgradeElements.hideTransitionHandler = null;
  }

  function showTowerUpgradeOverlayElement(overlay) {
    if (!overlay) {
      return;
    }
    cancelTowerUpgradeOverlayHide();
    overlay.removeAttribute('hidden');
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        overlay.classList.add('active');
      });
    } else {
      overlay.classList.add('active');
    }
  }

  function scheduleTowerUpgradeOverlayHide(overlay) {
    if (!overlay) {
      return;
    }
    cancelTowerUpgradeOverlayHide();
    overlay.setAttribute('aria-hidden', 'true');

    const finalizeHide = () => {
      cancelTowerUpgradeOverlayHide();
      overlay.hidden = true;
      overlay.setAttribute('hidden', '');
    };

    const handleTransitionEnd = (event) => {
      if (event.target !== overlay) {
        return;
      }
      finalizeHide();
    };

    towerTabState.towerUpgradeElements.hideTransitionHandler = handleTransitionEnd;
    overlay.addEventListener('transitionend', handleTransitionEnd);

    if (typeof window !== 'undefined') {
      towerTabState.towerUpgradeElements.hideTimeoutId = window.setTimeout(finalizeHide, 320);
    }

    overlay.classList.remove('active');
  }

  function openTowerUpgradeOverlay(towerId, options = {}) {
    const { overlay } = towerTabState.towerUpgradeElements;
    if (!towerId || !overlay) {
      return;
    }
    const definition = getTowerDefinition(towerId);
    if (!definition) {
      return;
    }

    towerTabState.dynamicContext = buildTowerDynamicContext({
      contextTowerId: options.contextTowerId,
      contextTower: options.contextTower,
      contextTowers: options.contextTowers,
    });
    invalidateTowerEquationCache();

    const blueprint = options.blueprint || getTowerEquationBlueprint(towerId);
    const autoMasterEquation = generateMasterEquationText({
      blueprint,
      definition,
      towerId,
      format: 'plain',
      fallback: typeof blueprint?.baseEquation === 'string' ? blueprint.baseEquation : '',
    });

    const sourceCard = options.sourceCard || null;
    if (sourceCard) {
      const existingEquation = extractTowerCardEquation(sourceCard);
      towerTabState.activeTowerUpgradeBaseEquation = existingEquation?.trim() || autoMasterEquation;
    } else {
      towerTabState.activeTowerUpgradeBaseEquation = autoMasterEquation;
    }

    towerTabState.activeTowerUpgradeId = towerId;
    towerTabState.lastTowerUpgradeTrigger = options.trigger || null;
    showTowerUpgradeOverlayElement(overlay);

    renderTowerUpgradeOverlay(towerId, {
      blueprint,
      baseEquationText: options.baseEquationText,
      animateEntry: true,
    });
    overlay.focus({ preventScroll: true });
    maybePlayTowerVariableEntry();
  }

  function closeTowerUpgradeOverlay() {
    const { overlay } = towerTabState.towerUpgradeElements;
    if (!overlay) {
      return;
    }
    if (!overlay.classList.contains('active')) {
      return;
    }

    hideTooltip({ immediate: true });
    playTowerVariableFlight('exit').finally(() => {
      scheduleTowerUpgradeOverlayHide(overlay);
    });

    if (towerTabState.lastTowerUpgradeTrigger && typeof towerTabState.lastTowerUpgradeTrigger.focus === 'function') {
      try {
        towerTabState.lastTowerUpgradeTrigger.focus({ preventScroll: true });
      } catch (error) {
        towerTabState.lastTowerUpgradeTrigger.focus();
      }
    }
    towerTabState.lastTowerUpgradeTrigger = null;
    towerTabState.activeTowerUpgradeId = null;
    towerTabState.dynamicContext = null;
    towerTabState.towerUpgradeElements.lastRenderedTowerId = null;
    invalidateTowerEquationCache();
  }

  function getTowerUpgradeOverlayElement() {
    return towerTabState.towerUpgradeElements.overlay || null;
  }

  function isTowerUpgradeOverlayActive() {
    const overlay = getTowerUpgradeOverlayElement();
    return Boolean(overlay && overlay.classList.contains('active'));
  }

  function getActiveTowerUpgradeId() {
    return towerTabState.activeTowerUpgradeId;
  }

  function handleTowerVariableUpgrade(towerId, variableKey) {
    const blueprint = getTowerEquationBlueprint(towerId);
    if (!blueprint) {
      return;
    }
    const variable = getBlueprintVariable(blueprint, variableKey);
    if (!variable || variable.upgradable === false) {
      return;
    }

    const state = ensureTowerUpgradeState(towerId, blueprint);
    const currentLevel = state.variables?.[variableKey]?.level || 0;
    const maxLevel = Number.isFinite(variable.maxLevel) ? Math.max(0, variable.maxLevel) : null;
    if (maxLevel !== null && currentLevel >= maxLevel) {
      setTowerUpgradeNote('This variable has already reached its maximum rank.', 'warning');
      updateTowerUpgradeGlyphDisplay();
      renderTowerUpgradeOverlay(towerId, { blueprint });
      towerTabState.audioManager?.playSfx?.('error');
      return;
    }
    const currencyKey = getVariableCurrencyKey(variable);
    const currencyMeta = getCurrencyMeta(currencyKey);
    const cost = calculateTowerVariableUpgradeCost(variable, currentLevel);
    const normalizedCost = Math.max(1, cost);

    const availableGlyphs = getAvailableCurrency(currencyKey);
    if (availableGlyphs < normalizedCost) {
      setTowerUpgradeNote(`Not enough ${currencyMeta.plural} to reinforce this variable.`, 'warning');
      updateTowerUpgradeGlyphDisplay();
      renderTowerUpgradeOverlay(towerId, { blueprint });
      towerTabState.audioManager?.playSfx?.('error');
      return;
    }

    adjustCurrencyBalance(currencyKey, -normalizedCost);
    state.variables[variableKey].level = currentLevel + 1;
    invalidateTowerEquationCache();
    setTowerUpgradeNote(
      `Invested ${normalizedCost} ${normalizedCost === 1 ? currencyMeta.singular : currencyMeta.plural} into ${
        variable.symbol
      }.`,
      'success',
    );
    towerTabState.audioManager?.playSfx?.('upgrade');
    updateTowerUpgradeGlyphDisplay();
    renderTowerUpgradeOverlay(towerId, { blueprint });
  }

  function handleTowerVariableDowngrade(towerId, variableKey) {
    const blueprint = getTowerEquationBlueprint(towerId);
    if (!blueprint) {
      return;
    }
    const variable = getBlueprintVariable(blueprint, variableKey);
    if (!variable || variable.upgradable === false) {
      return;
    }

    const state = ensureTowerUpgradeState(towerId, blueprint);
    const currentLevel = state.variables?.[variableKey]?.level || 0;

    if (currentLevel <= 0) {
      setTowerUpgradeNote(`No glyphs invested in ${variable.symbol || variable.key} yet.`, 'warning');
      towerTabState.audioManager?.playSfx?.('error');
      renderTowerUpgradeOverlay(towerId, { blueprint });
      return;
    }

    const currencyKey = getVariableCurrencyKey(variable);
    const currencyMeta = getCurrencyMeta(currencyKey);
    const nextLevel = currentLevel - 1;
    const refundAmount = Math.max(1, calculateTowerVariableUpgradeCost(variable, nextLevel));

    state.variables[variableKey].level = nextLevel;
    adjustCurrencyBalance(currencyKey, refundAmount);
    invalidateTowerEquationCache();

    setTowerUpgradeNote(
      `Withdrew ${refundAmount} ${refundAmount === 1 ? currencyMeta.singular : currencyMeta.plural} from ${
        variable.symbol || variable.key
      }.`,
      'success',
    );

    towerTabState.audioManager?.playSfx?.('towerSell');
    updateTowerUpgradeGlyphDisplay();

    renderTowerUpgradeOverlay(towerId, { blueprint });
  }

  function bindTowerUpgradeOverlay() {
    const elements = towerTabState.towerUpgradeElements;
    elements.overlay = document.getElementById('tower-upgrade-overlay');
    if (!elements.overlay) {
      return;
    }
    elements.panel = elements.overlay.querySelector('.tower-upgrade-panel');
    if (elements.panel) {
      ensureTooltipElement();
      elements.panel.addEventListener('scroll', () => {
        hideTooltip({ immediate: true });
      });
    }
    elements.close = elements.overlay.querySelector('[data-tower-upgrade-close]');
    elements.title = document.getElementById('tower-upgrade-title');
    elements.tier = document.getElementById('tower-upgrade-tier');
    elements.glyphs = document.getElementById('tower-upgrade-glyphs');
    elements.baseEquation = document.getElementById('tower-upgrade-base');
    elements.baseEquationValues = document.getElementById('tower-upgrade-base-values');
    elements.variables = document.getElementById('tower-upgrade-variables');
    elements.note = document.getElementById('tower-upgrade-note');
    elements.icon = document.getElementById('tower-upgrade-icon');

    if (!elements.overlay.hasAttribute('tabindex')) {
      elements.overlay.setAttribute('tabindex', '-1');
    }

    if (elements.close) {
      elements.close.addEventListener('click', () => {
        closeTowerUpgradeOverlay();
      });
    }

    elements.overlay.addEventListener('click', (event) => {
      if (event.target === elements.overlay) {
        closeTowerUpgradeOverlay();
      }
    });
  }

  return {
    updateTowerUpgradeGlyphDisplay,
    renderTowerUpgradeOverlay,
    openTowerUpgradeOverlay,
    closeTowerUpgradeOverlay,
    getTowerUpgradeOverlayElement,
    isTowerUpgradeOverlayActive,
    getActiveTowerUpgradeId,
    handleTowerVariableUpgrade,
    handleTowerVariableDowngrade,
    bindTowerUpgradeOverlay,
    resetTowerVariableAnimationState,
  };
}
