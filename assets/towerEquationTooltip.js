/**
 * Tower Equation Tooltip System
 * ------------------------------
 * Encapsulates the floating tooltip that annotates variables in the tower
 * upgrade equations. The manager hides the shared DOM element creation,
 * positioning math, and event handler wiring behind a small factory so the
 * Towers tab can inject its state container without exposing the broader
 * module internals.
 */

/**
 * Creates a tooltip manager that coordinates hover/focus annotations for tower
 * equation variables.
 *
 * @param {object} options Factory configuration.
 * @param {object} options.tooltipState Mutable state bucket shared with the
 * Towers tab (`{ element, currentTarget, hideTimeoutId }`).
 * @param {() => HTMLElement|null} options.getPanelElement Provides the panel
 * element that hosts the tooltip.
 * @param {(variable: object|null) => object|null} options.getUniversalVariableMetadata
 * Callback that resolves shared metadata for a given variable key or symbol.
 * @param {string} [options.tooltipId='tower-upgrade-equation-tooltip'] Stable
 * id applied to the tooltip element for aria-describedby wiring.
 * @param {number} [options.tooltipMarginPx=12] Margin that keeps the tooltip
 * inset from the panel edges.
 * @param {(callback: FrameRequestCallback) => number} [options.requestAnimationFrame]
 * Optional requestAnimationFrame implementation (falls back to window raf or a
 * timeout shim).
 * @returns {object} Tooltip helpers that mirror the prior inline functions.
 */
export function createTowerEquationTooltipSystem(options = {}) {
  const {
    tooltipState,
    getPanelElement = () => null,
    getUniversalVariableMetadata = () => null,
    tooltipId = 'tower-upgrade-equation-tooltip',
    tooltipMarginPx = 12,
    requestAnimationFrame: requestAnimationFrameOption,
  } = options;

  if (!tooltipState) {
    throw new Error('createTowerEquationTooltipSystem requires a tooltipState object.');
  }

  const scheduleTimeout =
    typeof window !== 'undefined' && typeof window.setTimeout === 'function'
      ? window.setTimeout.bind(window)
      : (handler, delay) => setTimeout(handler, delay);
  const clearScheduledTimeout =
    typeof window !== 'undefined' && typeof window.clearTimeout === 'function'
      ? window.clearTimeout.bind(window)
      : (timeoutId) => clearTimeout(timeoutId);
  const requestFrame =
    typeof requestAnimationFrameOption === 'function'
      ? requestAnimationFrameOption
      : typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (callback) => scheduleTimeout(callback, 16);

  function ensureTooltipElement() {
    if (tooltipState.element && tooltipState.element.isConnected) {
      return tooltipState.element;
    }

    if (typeof document === 'undefined') {
      return null;
    }

    const panel = getPanelElement();
    if (!panel) {
      return null;
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'tower-upgrade-formula-tooltip';
    tooltip.id = tooltipId;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.hidden = true;
    panel.append(tooltip);
    tooltipState.element = tooltip;
    return tooltip;
  }

  function buildVariableTooltip(variable, fallbackSymbol = '') {
    if (!variable) {
      return typeof fallbackSymbol === 'string' ? fallbackSymbol.trim() : '';
    }

    const universal = getUniversalVariableMetadata(variable);
    const fallback = typeof fallbackSymbol === 'string' ? fallbackSymbol.trim() : '';
    const symbol =
      (typeof variable.equationSymbol === 'string' && variable.equationSymbol.trim()) ||
      (typeof variable.symbol === 'string' && variable.symbol.trim()) ||
      (universal?.symbol && typeof universal.symbol === 'string' ? universal.symbol : '') ||
      (typeof variable.key === 'string' && variable.key.trim() ? variable.key.trim().toUpperCase() : '') ||
      fallback;
    const name =
      (typeof variable.tooltipName === 'string' && variable.tooltipName.trim()) ||
      (typeof variable.name === 'string' && variable.name.trim()) ||
      (universal?.name && typeof universal.name === 'string' ? universal.name : '');
    const units =
      (typeof variable.units === 'string' && variable.units.trim()) ||
      (universal?.units && typeof universal.units === 'string' ? universal.units : '');
    const description =
      (typeof variable.tooltipDescription === 'string' && variable.tooltipDescription.trim()) ||
      (typeof variable.description === 'string' && variable.description.trim()) ||
      (universal?.description && typeof universal.description === 'string' ? universal.description : '');

    if (!symbol && !name && !units && !description) {
      return '';
    }

    const header = symbol && name ? `${symbol}: ${name}` : symbol || name || '';
    const headerWithUnits = header
      ? `${header}${units ? ` (${units})` : ''}`
      : units
      ? `(${units})`
      : '';
    if (description) {
      return headerWithUnits ? `${headerWithUnits} ${description}` : description;
    }
    return headerWithUnits;
  }

  function positionTooltip(target, tooltip) {
    if (!target || !tooltip) {
      return;
    }

    const panel = getPanelElement();
    if (!panel) {
      return;
    }

    const panelRect = panel.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    tooltip.style.maxWidth = `${Math.max(220, panelRect.width - tooltipMarginPx * 2)}px`;
    tooltip.style.left = `${tooltipMarginPx}px`;
    tooltip.style.top = `${tooltipMarginPx}px`;

    const tooltipRect = tooltip.getBoundingClientRect();
    const centerOffset = targetRect.left + targetRect.width / 2 - panelRect.left;
    const idealLeft = centerOffset - tooltipRect.width / 2;
    const maxLeft = panelRect.width - tooltipRect.width - tooltipMarginPx;
    const clampedLeft = Math.min(
      Math.max(idealLeft, tooltipMarginPx),
      Math.max(maxLeft, tooltipMarginPx),
    );

    const spaceBelow = panelRect.bottom - targetRect.bottom;
    const spaceAbove = targetRect.top - panelRect.top;
    let top;
    if (spaceBelow >= tooltipRect.height + tooltipMarginPx || spaceBelow >= spaceAbove) {
      top = targetRect.bottom - panelRect.top + tooltipMarginPx;
    } else {
      top = targetRect.top - panelRect.top - tooltipRect.height - tooltipMarginPx;
    }
    const maxTop = panelRect.height - tooltipRect.height - tooltipMarginPx;
    const clampedTop = Math.min(
      Math.max(top, tooltipMarginPx),
      Math.max(maxTop, tooltipMarginPx),
    );

    tooltip.style.left = `${clampedLeft}px`;
    tooltip.style.top = `${clampedTop}px`;
  }

  function hideTooltip(options = {}) {
    const { immediate = false } = options;
    const tooltip = tooltipState.element;

    if (tooltipState.hideTimeoutId) {
      clearScheduledTimeout(tooltipState.hideTimeoutId);
      tooltipState.hideTimeoutId = null;
    }

    if (!tooltip) {
      if (tooltipState.currentTarget) {
        tooltipState.currentTarget.removeAttribute('aria-describedby');
        tooltipState.currentTarget = null;
      }
      return;
    }

    const finalize = () => {
      tooltip.dataset.visible = 'false';
      tooltip.setAttribute('aria-hidden', 'true');
      tooltip.hidden = true;
      tooltip.textContent = '';
      tooltipState.hideTimeoutId = null;
      if (tooltipState.currentTarget) {
        tooltipState.currentTarget.removeAttribute('aria-describedby');
        tooltipState.currentTarget = null;
      }
    };

    if (immediate) {
      finalize();
      return;
    }

    tooltip.dataset.visible = 'false';
    tooltip.setAttribute('aria-hidden', 'true');
    tooltipState.hideTimeoutId = scheduleTimeout(finalize, 160);
  }

  function showTooltip(target) {
    if (!target) {
      return;
    }

    const tooltipText = typeof target.dataset.tooltip === 'string' ? target.dataset.tooltip : '';
    if (!tooltipText) {
      return;
    }

    const tooltip = ensureTooltipElement();
    if (!tooltip) {
      return;
    }

    if (tooltipState.hideTimeoutId) {
      clearScheduledTimeout(tooltipState.hideTimeoutId);
      tooltipState.hideTimeoutId = null;
    }

    if (tooltipState.currentTarget && tooltipState.currentTarget !== target) {
      tooltipState.currentTarget.removeAttribute('aria-describedby');
    }

    tooltip.textContent = tooltipText;
    tooltip.hidden = false;
    tooltip.dataset.visible = 'true';
    tooltip.setAttribute('aria-hidden', 'false');
    tooltipState.currentTarget = target;
    target.setAttribute('aria-describedby', tooltipId);

    requestFrame(() => {
      positionTooltip(target, tooltip);
    });
  }

  function handlePointerEnter(event) {
    const target = event?.currentTarget;
    if (target instanceof HTMLElement) {
      showTooltip(target);
    }
  }

  function handlePointerLeave() {
    hideTooltip();
  }

  function handleFocus(event) {
    const target = event?.currentTarget;
    if (target instanceof HTMLElement) {
      showTooltip(target);
    }
  }

  function handleBlur() {
    hideTooltip({ immediate: true });
  }

  return {
    ensureTooltipElement,
    buildVariableTooltip,
    hideTooltip,
    handlePointerEnter,
    handlePointerLeave,
    handleFocus,
    handleBlur,
  };
}

export default createTowerEquationTooltipSystem;
