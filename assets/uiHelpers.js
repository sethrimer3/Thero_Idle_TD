// UI Helper Functions
// Extracted from main.js - utility functions for overlays, element visibility, and ripple effects

/**
 * Create overlay management functions
 * @returns {Object} Overlay management functions
 */
export function createOverlayHelpers() {
  const overlayHideStates = new WeakMap();

  function cancelOverlayHide(overlay) {
    if (!overlay) {
      return;
    }

    const state = overlayHideStates.get(overlay);
    if (!state) {
      return;
    }

    if (state.transitionHandler) {
      overlay.removeEventListener('transitionend', state.transitionHandler);
    }

    if (state.timeoutId !== null && typeof window !== 'undefined') {
      window.clearTimeout(state.timeoutId);
    }

    overlayHideStates.delete(overlay);
  }

  function scheduleOverlayHide(overlay) {
    if (!overlay) {
      return;
    }

    cancelOverlayHide(overlay);

    const finalizeHide = () => {
      cancelOverlayHide(overlay);
      overlay.setAttribute('hidden', '');
    };

    const handleTransitionEnd = (event) => {
      if (event && event.target !== overlay) {
        return;
      }
      finalizeHide();
    };

    overlay.addEventListener('transitionend', handleTransitionEnd);

    const timeoutId =
      typeof window !== 'undefined' ? window.setTimeout(finalizeHide, 320) : null;

    overlayHideStates.set(overlay, {
      transitionHandler: handleTransitionEnd,
      timeoutId,
    });
  }

  function revealOverlay(overlay) {
    if (!overlay) {
      return;
    }

    cancelOverlayHide(overlay);
    overlay.removeAttribute('hidden');
  }

  return {
    cancelOverlayHide,
    scheduleOverlayHide,
    revealOverlay,
  };
}

/**
 * Toggle element visibility with accessibility hints
 * @param {HTMLElement} element - The element to show/hide
 * @param {boolean} visible - Whether the element should be visible
 */
export function setElementVisibility(element, visible) {
  // Toggle layout fragments while preserving any pre-existing accessibility hints.
  if (!element) {
    return;
  }

  if (visible) {
    element.classList.remove('is-hidden');
    element.removeAttribute('hidden');
    element.removeAttribute('aria-hidden');
    return;
  }

  element.classList.add('is-hidden');
  element.setAttribute('hidden', '');
  element.setAttribute('aria-hidden', 'true');
}

/**
 * Trigger a ripple effect on a button
 * @param {HTMLElement} button - The button element
 * @param {Event} event - The pointer event
 */
export function triggerButtonRipple(button, event) {
  if (!button) {
    return;
  }

  const rect = button.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'button-ripple';

  const maxDimension = Math.max(rect.width, rect.height);
  const size = maxDimension * 1.6;
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;

  let offsetX = rect.width / 2;
  let offsetY = rect.height / 2;
  if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
  }

  ripple.style.left = `${offsetX}px`;
  ripple.style.top = `${offsetY}px`;

  button.querySelectorAll('.button-ripple').forEach((existing) => existing.remove());
  button.append(ripple);

  ripple.addEventListener(
    'animationend',
    () => {
      ripple.remove();
    },
    { once: true },
  );
}

/**
 * Scroll a panel to a specific element
 * @param {HTMLElement} target - The target element to scroll to
 * @param {Object} options - Options object
 * @param {number} options.offset - Offset from the top in pixels (default: 16)
 */
export function scrollPanelToElement(target, { offset = 16 } = {}) {
  if (!target) {
    return;
  }

  const panel = target.closest('.panel');
  if (panel) {
    const panelRect = panel.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const desiredTop = targetRect.top - panelRect.top + panel.scrollTop - offset;
    const top = Math.max(0, desiredTop);
    const scrollOptions = { top, behavior: 'smooth' };
    try {
      panel.scrollTo(scrollOptions);
    } catch (error) {
      panel.scrollTop = top;
    }
    return;
  }

  try {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    target.scrollIntoView(true);
  }
}

/**
 * Enable wheel scrolling for a panel element
 * @param {HTMLElement} panel - The panel element
 * @param {Function} isFieldNotesOverlayVisible - Function to check if field notes overlay is visible
 */
export function enablePanelWheelScroll(panel, isFieldNotesOverlayVisible) {
  if (!panel || panel.dataset.scrollAssist === 'true') {
    return;
  }

  panel.dataset.scrollAssist = 'true';
  panel.addEventListener(
    'wheel',
    (event) => {
      if (!event || typeof event.deltaY !== 'number') {
        return;
      }

      if (isFieldNotesOverlayVisible && isFieldNotesOverlayVisible()) {
        if (typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        return;
      }

      const deltaMode = typeof event.deltaMode === 'number' ? event.deltaMode : 0;
      let deltaY = event.deltaY;

      if (deltaMode === 1) {
        const computed = window.getComputedStyle(panel);
        const lineHeight = parseFloat(computed.lineHeight) || 16;
        deltaY *= lineHeight;
      } else if (deltaMode === 2) {
        deltaY *= panel.clientHeight || window.innerHeight || 600;
      }

      if (!deltaY) {
        return;
      }

      const previous = panel.scrollTop;
      panel.scrollTop += deltaY;
      if (panel.scrollTop !== previous) {
        event.preventDefault();
      }
    },
    { passive: false },
  );
}
