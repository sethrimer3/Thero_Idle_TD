// Drag-scroll utility: replaces visible scrollbars with pointer-driven panning.

// Track which containers already have drag-scroll listeners bound.
const dragScrollRegistry = new WeakSet();

// Skip drag-scroll handling when the pointer originates from interactive tower controls.
const SKIP_DRAG_SELECTORS = ['.tower-loadout-item', '#playfield', '#playfield-canvas'];

// Minimum distance (in pixels) before a movement counts as an intentional drag gesture.
const MIN_DRAG_DISTANCE = 6;

// Determine whether the element can actually scroll along either axis.
function isScrollable(element) {
  if (!element) {
    return false;
  }
  const canScrollY = element.scrollHeight > element.clientHeight + 1;
  const canScrollX = element.scrollWidth > element.clientWidth + 1;
  return canScrollX || canScrollY;
}

// Attach pointer listeners that convert drag motions into scroll offsets.
function attachDragScroll(element) {
  const state = {
    pointerId: null,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
    isDragging: false,
    suppressClick: false,
  };

  function handlePointerDown(event) {
    if (!element) {
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    if (event.pointerType === 'touch') {
      return;
    }
    if (!isScrollable(element)) {
      return;
    }
    if (SKIP_DRAG_SELECTORS.some((selector) => event.target.closest(selector))) {
      return;
    }

    state.pointerId = event.pointerId;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.startScrollLeft = element.scrollLeft;
    state.startScrollTop = element.scrollTop;
    state.isDragging = false;
    state.suppressClick = false;
  }

  function handlePointerMove(event) {
    if (state.pointerId === null || event.pointerId !== state.pointerId) {
      return;
    }

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;

    if (!state.isDragging) {
      if (Math.abs(deltaX) < MIN_DRAG_DISTANCE && Math.abs(deltaY) < MIN_DRAG_DISTANCE) {
        return;
      }
      state.isDragging = true;
      state.suppressClick = true;
      element.classList.add('drag-scroll-active');
      try {
        element.setPointerCapture(event.pointerId);
      } catch (error) {
        // Ignore pointer-capture errors.
      }
    }

    event.preventDefault();
    // Translate pointer movement into scroll offsets for both axes.
    element.scrollLeft = state.startScrollLeft - deltaX;
    element.scrollTop = state.startScrollTop - deltaY;
  }

  function finishPointer(event) {
    if (state.pointerId === null || event.pointerId !== state.pointerId) {
      return;
    }

    const shouldSuppressClick = state.suppressClick || state.isDragging;

    if (state.isDragging) {
      try {
        element.releasePointerCapture(event.pointerId);
      } catch (error) {
        // Ignore pointer-capture errors.
      }
    }

    state.pointerId = null;
    state.startX = 0;
    state.startY = 0;
    state.startScrollLeft = 0;
    state.startScrollTop = 0;
    // Reset gesture bookkeeping while remembering to block the imminent click.
    state.isDragging = false;
    state.suppressClick = shouldSuppressClick;
    element.classList.remove('drag-scroll-active');
  }

  function handleClick(event) {
    if (!state.suppressClick) {
      return;
    }
    // Swallow the click that follows a drag so buttons do not fire unexpectedly.
    state.suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  }

  // Flag the element in the DOM so CSS can provide drag affordances.
  element.setAttribute('data-drag-scroll', 'true');
  element.addEventListener('pointerdown', handlePointerDown);
  element.addEventListener('pointermove', handlePointerMove);
  element.addEventListener('pointerup', finishPointer);
  element.addEventListener('pointercancel', finishPointer);
  element.addEventListener('lostpointercapture', finishPointer);
  element.addEventListener('click', handleClick, true);
}

// Public helper: enable drag-based scrolling for the provided selector list.
export function enableDragScroll({ selectors = [] } = {}) {
  const elements = new Set();
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (element instanceof HTMLElement) {
        elements.add(element);
      }
    });
  });

  elements.forEach((element) => {
    if (dragScrollRegistry.has(element)) {
      return;
    }
    dragScrollRegistry.add(element);
    attachDragScroll(element);
  });
}
