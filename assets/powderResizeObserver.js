const RESIZE_FALLBACK_DELAY_MS = 16;

function scheduleResize(callback) {
  const hasWindow = typeof window !== 'undefined';
  const canUseAnimationFrame = hasWindow && typeof window.requestAnimationFrame === 'function';
  if (canUseAnimationFrame) {
    return {
      frame: window.requestAnimationFrame(callback),
      usedTimeout: false,
    };
  }
  const scheduleTimeout = hasWindow && typeof window.setTimeout === 'function'
    ? window.setTimeout.bind(window)
    : (cb, delay) => setTimeout(cb, delay);
  return {
    frame: scheduleTimeout(callback, RESIZE_FALLBACK_DELAY_MS),
    usedTimeout: true,
  };
}

function resolveElements(getter) {
  if (typeof getter !== 'function') {
    return null;
  }
  try {
    return getter();
  } catch (error) {
    console.warn('Failed to resolve powder resize elements.', error);
    return null;
  }
}

export function createPowderResizeObserver({
  getPowderSimulation,
  handlePowderViewTransformChange,
  getPowderElements,
  getFluidElements,
} = {}) {
  let powderBasinObserver = null;
  let pendingPowderResizeFrame = null;
  let pendingPowderResizeIsTimeout = false;
  let observedPowderResizeElements = new WeakSet();

  function ensureObservedSet() {
    if (!(observedPowderResizeElements instanceof WeakSet)) {
      observedPowderResizeElements = new WeakSet();
    }
  }

  function ensureObserver() {
    if (typeof ResizeObserver !== 'function') {
      return null;
    }
    if (!powderBasinObserver) {
      powderBasinObserver = new ResizeObserver(() => {
        if (pendingPowderResizeFrame !== null) {
          return;
        }
        const { frame, usedTimeout } = scheduleResize(() => {
          pendingPowderResizeFrame = null;
          pendingPowderResizeIsTimeout = false;
          const simulation = typeof getPowderSimulation === 'function' ? getPowderSimulation() : null;
          if (simulation && typeof simulation.handleResize === 'function') {
            simulation.handleResize();
            if (typeof handlePowderViewTransformChange === 'function') {
              handlePowderViewTransformChange(simulation.getViewTransform());
            }
          }
        });
        pendingPowderResizeFrame = frame;
        pendingPowderResizeIsTimeout = usedTimeout;
      });
    }
    return powderBasinObserver;
  }

  function ensurePowderBasinResizeObserver() {
    if (typeof ResizeObserver !== 'function') {
      return;
    }
    ensureObservedSet();
    const observer = ensureObserver();
    if (!observer) {
      return;
    }

    const powderElements = resolveElements(getPowderElements);
    const fluidElements = resolveElements(getFluidElements);

    const resizeTargets = [
      powderElements?.stage,
      powderElements?.simulationCard,
      powderElements?.basin,
      fluidElements?.simulationCard,
      fluidElements?.basin,
    ].filter((element) => {
      if (!element || typeof element.getBoundingClientRect !== 'function') {
        return false;
      }
      if (observedPowderResizeElements.has(element)) {
        return false;
      }
      return true;
    });

    resizeTargets.forEach((element) => {
      try {
        observer.observe(element);
        observedPowderResizeElements.add(element);
      } catch (error) {
        console.warn('Failed to observe powder basin resize target.', error);
      }
    });
  }

  return {
    ensurePowderBasinResizeObserver,
    getPowderBasinObserver: () => powderBasinObserver,
    setPowderBasinObserver: (value) => {
      powderBasinObserver = value;
    },
    getPendingPowderResizeFrame: () => pendingPowderResizeFrame,
    setPendingPowderResizeFrame: (value) => {
      pendingPowderResizeFrame = value;
    },
    getPendingPowderResizeIsTimeout: () => pendingPowderResizeIsTimeout,
    setPendingPowderResizeIsTimeout: (value) => {
      pendingPowderResizeIsTimeout = Boolean(value);
    },
    getObservedPowderResizeElements: () => observedPowderResizeElements,
    setObservedPowderResizeElements: (value) => {
      observedPowderResizeElements = value instanceof WeakSet ? value : new WeakSet();
    },
  };
}
