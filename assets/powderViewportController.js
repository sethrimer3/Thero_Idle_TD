'use strict';

/**
 * Encapsulates viewport transforms, wall spacing, and interaction wiring for the powder/fluid overlays.
 * Dependencies are injected so the helpers remain decoupled from the main orchestrator and simulations.
 *
 * @param {Object} options - Factory options for dependency injection
 * @param {() => import('../scripts/features/towers/powderTower.js').PowderSimulation | null} options.getActiveSimulation
 * @param {() => import('../scripts/features/towers/fluidTower.js').FluidSimulation | null} options.getFluidSimulation
 * @param {() => any} options.getPowderElements - Getter for the powder DOM bindings
 * @param {() => any} options.getFluidElements - Getter for the fluid DOM bindings
 * @param {Object} options.powderState - Shared powder state bag that tracks transforms and wall targets
 * @param {Object} options.powderConfig - Powder configuration with wall gap parameters
 * @param {() => void} [options.schedulePowderBasinSave] - Optional persistence hook for state changes
 * @param {() => boolean} [options.isDeveloperModeActive] - Getter indicating if developer hitboxes should be visible
 */
export function createPowderViewportController({
  getActiveSimulation,
  getFluidSimulation,
  getPowderElements,
  getFluidElements,
  powderState,
  powderConfig,
  schedulePowderBasinSave,
  isDeveloperModeActive,
}) {
  let powderWallMetrics = null;
  let fluidWallMetrics = null;

  const callScheduleSave = () => {
    if (typeof schedulePowderBasinSave === 'function') {
      schedulePowderBasinSave();
    }
  };

  const getDeveloperModeActive = () => {
    if (typeof isDeveloperModeActive === 'function') {
      return Boolean(isDeveloperModeActive());
    }
    return false;
  };

  function getElementsForSimulation(simulation) {
    const fluidSimulation = typeof getFluidSimulation === 'function' ? getFluidSimulation() : null;
    if (simulation && fluidSimulation && simulation === fluidSimulation) {
      return typeof getFluidElements === 'function' ? getFluidElements() : null;
    }
    return typeof getPowderElements === 'function' ? getPowderElements() : null;
  }

  function applyPowderViewportTransform(transform, simulation = (typeof getActiveSimulation === 'function' ? getActiveSimulation() : null)) {
    const elements = getElementsForSimulation(simulation);
    const viewport = elements?.viewport;
    const fluidSimulation = typeof getFluidSimulation === 'function' ? getFluidSimulation() : null;
    const isFluid = Boolean(simulation && fluidSimulation && simulation === fluidSimulation);
    const transformTarget = isFluid ? elements?.terrariumLayer || viewport : viewport;
    if (!transformTarget) {
      if (viewport) {
        viewport.style.transform = '';
      }
      if (isFluid && elements?.terrariumLayer) {
        elements.terrariumLayer.style.transform = '';
      }
      return;
    }
    if (!transform) {
      transformTarget.style.transform = '';
      if (transformTarget !== viewport && viewport) {
        viewport.style.transform = '';
      }
      return;
    }
    const width = Number.isFinite(transform.width) ? transform.width : 0;
    const height = Number.isFinite(transform.height) ? transform.height : 0;
    const scale = Number.isFinite(transform.scale) && transform.scale > 0 ? transform.scale : 1;
    if (!width || !height) {
      transformTarget.style.transform = '';
      if (transformTarget !== viewport && viewport) {
        viewport.style.transform = '';
      }
      return;
    }
    const centerX = Number.isFinite(transform.center?.x) ? transform.center.x : width / 2;
    const centerY = Number.isFinite(transform.center?.y) ? transform.center.y : height / 2;
    const translateToCenter = `translate(${(width / 2).toFixed(3)}px, ${(height / 2).toFixed(3)}px)`;
    const scalePart = `scale(${scale.toFixed(5)})`;
    const translateToOrigin = `translate(${(-centerX).toFixed(3)}px, ${(-centerY).toFixed(3)}px)`;
    const transformValue = `${translateToCenter} ${scalePart} ${translateToOrigin}`;
    transformTarget.style.transform = transformValue;
    if (transformTarget !== viewport && viewport) {
      viewport.style.transform = '';
    }
  }

  function handlePowderViewTransformChange(transform) {
    powderState.viewTransform = transform || null;
    applyPowderViewportTransform(transform || null);
    callScheduleSave();
  }

  function syncPowderWallVisuals(metrics) {
    const activeSimulation = typeof getActiveSimulation === 'function' ? getActiveSimulation() : null;
    const fluidSimulation = typeof getFluidSimulation === 'function' ? getFluidSimulation() : null;
    const isFluidActive = activeSimulation && fluidSimulation && activeSimulation === fluidSimulation;
    const cachedMetrics = isFluidActive ? fluidWallMetrics : powderWallMetrics;
    const activeMetrics = metrics || cachedMetrics || (activeSimulation?.getWallMetrics?.() ?? null);
    if (!activeMetrics) {
      return;
    }

    const { leftCells, rightCells, gapCells, cellSize, gapPixels, leftPixels, rightPixels } = activeMetrics;
    const leftWidth = Number.isFinite(leftPixels) ? Math.max(0, leftPixels) : Math.max(0, leftCells * cellSize);
    const rightWidth = Number.isFinite(rightPixels) ? Math.max(0, rightPixels) : Math.max(0, rightCells * cellSize);
    const gapWidth = Number.isFinite(gapPixels) ? Math.max(0, gapPixels) : Math.max(0, gapCells * cellSize);

    const powderDom = typeof getPowderElements === 'function' ? getPowderElements() : null;
    const fluidDom = typeof getFluidElements === 'function' ? getFluidElements() : null;
    const activeElements = getElementsForSimulation(activeSimulation);
    const inactiveElements = activeElements === powderDom ? fluidDom : powderDom;

    const resolveContentWidth = (element, targetWidth) => {
      if (!element || !Number.isFinite(targetWidth)) {
        return targetWidth;
      }
      if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
        return targetWidth;
      }
      const styles = window.getComputedStyle(element);
      if (!styles) {
        return targetWidth;
      }
      const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
      const borderLeft = Number.parseFloat(styles.borderLeftWidth) || 0;
      const borderRight = Number.parseFloat(styles.borderRightWidth) || 0;
      const horizontalInset = paddingLeft + paddingRight + borderLeft + borderRight;
      return Math.max(0, targetWidth - horizontalInset);
    };

    if (activeElements?.leftWall) {
      const contentWidth = resolveContentWidth(activeElements.leftWall, leftWidth);
      activeElements.leftWall.style.width = `${contentWidth.toFixed(1)}px`;
      activeElements.leftWall.style.setProperty('--powder-wall-visual-width', `${leftWidth.toFixed(1)}px`);
    }
    if (activeElements?.rightWall) {
      const contentWidth = resolveContentWidth(activeElements.rightWall, rightWidth);
      activeElements.rightWall.style.width = `${contentWidth.toFixed(1)}px`;
      activeElements.rightWall.style.setProperty('--powder-wall-visual-width', `${rightWidth.toFixed(1)}px`);
    }
    if (activeElements?.leftHitbox) {
      activeElements.leftHitbox.style.width = `${leftWidth.toFixed(1)}px`;
    }
    if (activeElements?.rightHitbox) {
      activeElements.rightHitbox.style.width = `${rightWidth.toFixed(1)}px`;
    }
    if (activeElements?.basin) {
      activeElements.basin.style.setProperty('--powder-gap-width', `${gapWidth.toFixed(1)}px`);
    }

    if (inactiveElements?.leftWall) {
      inactiveElements.leftWall.style.removeProperty('width');
      inactiveElements.leftWall.style.removeProperty('--powder-wall-visual-width');
    }
    if (inactiveElements?.rightWall) {
      inactiveElements.rightWall.style.removeProperty('width');
      inactiveElements.rightWall.style.removeProperty('--powder-wall-visual-width');
    }
    if (inactiveElements?.leftHitbox) {
      inactiveElements.leftHitbox.style.removeProperty('width');
    }
    if (inactiveElements?.rightHitbox) {
      inactiveElements.rightHitbox.style.removeProperty('width');
    }
  }

  function updatePowderHitboxVisibility() {
    const activeSimulation = typeof getActiveSimulation === 'function' ? getActiveSimulation() : null;
    const fluidSimulation = typeof getFluidSimulation === 'function' ? getFluidSimulation() : null;
    const isFluidActive = activeSimulation && fluidSimulation && activeSimulation === fluidSimulation;
    const cachedMetrics = isFluidActive ? fluidWallMetrics : powderWallMetrics;
    const metrics = cachedMetrics || (activeSimulation?.getWallMetrics?.() ?? null);
    const showHitboxes = getDeveloperModeActive() && metrics;
    const powderDom = typeof getPowderElements === 'function' ? getPowderElements() : null;
    const fluidDom = typeof getFluidElements === 'function' ? getFluidElements() : null;
    const activeElements = getElementsForSimulation(activeSimulation);
    const inactiveElements = activeElements === powderDom ? fluidDom : powderDom;

    if (activeElements?.leftHitbox) {
      activeElements.leftHitbox.classList.toggle(
        'powder-wall-hitbox--visible',
        Boolean(showHitboxes && metrics?.leftCells > 0),
      );
    }
    if (activeElements?.rightHitbox) {
      activeElements.rightHitbox.classList.toggle(
        'powder-wall-hitbox--visible',
        Boolean(showHitboxes && metrics?.rightCells > 0),
      );
    }
    if (inactiveElements?.leftHitbox) {
      inactiveElements.leftHitbox.classList.remove('powder-wall-hitbox--visible');
    }
    if (inactiveElements?.rightHitbox) {
      inactiveElements.rightHitbox.classList.remove('powder-wall-hitbox--visible');
    }
  }

  function handlePowderWallMetricsChange(metrics, source) {
    const activeSimulation = typeof getActiveSimulation === 'function' ? getActiveSimulation() : null;
    const fluidSimulation = typeof getFluidSimulation === 'function' ? getFluidSimulation() : null;
    const isFluidActive = Boolean(activeSimulation && fluidSimulation && activeSimulation === fluidSimulation);
    const origin = source || (isFluidActive ? 'fluid' : 'sand');
    if (origin === 'fluid') {
      fluidWallMetrics = metrics || null;
    } else {
      powderWallMetrics = metrics || null;
    }
    const shouldRefreshDecorations = (origin === 'fluid' && isFluidActive) || (origin !== 'fluid' && !isFluidActive);
    if (shouldRefreshDecorations) {
      syncPowderWallVisuals(metrics || undefined);
      updatePowderHitboxVisibility();
    }
    callScheduleSave();
  }

  function updatePowderWallGapFromGlyphs(glyphCount) {
    const normalized = Number.isFinite(glyphCount) ? Math.max(0, glyphCount) : 0;
    const rawTarget = powderConfig.wallBaseGapMotes + normalized * powderConfig.wallGapPerGlyph;
    const target = Math.min(rawTarget, powderConfig.wallMaxGapMotes);
    powderState.wallGapTarget = target;
    const simulation = typeof getActiveSimulation === 'function' ? getActiveSimulation() : null;
    if (!simulation) {
      callScheduleSave();
      return;
    }
    simulation.setWallGapTarget(target);
    const isFluid = simulation === (getFluidSimulation?.() ?? null);
    handlePowderWallMetricsChange(simulation.getWallMetrics(), isFluid ? 'fluid' : 'sand');
  }

  function initializePowderViewInteraction() {
    const simulation = typeof getActiveSimulation === 'function' ? getActiveSimulation() : null;
    if (!simulation) {
      return;
    }

    const fluidSimulation = typeof getFluidSimulation === 'function' ? getFluidSimulation() : null;
    const powderElements = typeof getPowderElements === 'function' ? getPowderElements() : null;
    const fluidElements = typeof getFluidElements === 'function' ? getFluidElements() : null;
    const viewport = simulation === fluidSimulation ? fluidElements?.viewport : powderElements?.viewport;
    if (!viewport) {
      return;
    }

    if (powderState.viewInteraction?.viewport === viewport && powderState.viewInteraction.initialized) {
      return;
    }

    if (powderState.viewInteraction?.destroy) {
      powderState.viewInteraction.destroy();
    }

    const interaction = {
      initialized: true,
      pointerId: null,
      lastPoint: null,
      viewport,
      // Track simultaneous touches so pinch gestures can drive viewport zoom on mobile.
      activePointers: new Map(),
      // Cache the baseline pinch spacing and scale to compute incremental zoom factors.
      pinchState: null,
      destroy: null,
    };

    const getSimulation = () => (typeof getActiveSimulation === 'function' ? getActiveSimulation() : null);

    // Read the active view scale to normalize pinch deltas against the current zoom level.
    const getActiveScale = () => {
      const activeSimulation = getSimulation();
      const transform = activeSimulation?.getViewTransform?.();
      const scale = Number.isFinite(transform?.scale) && transform.scale > 0 ? transform.scale : 1;
      return scale;
    };

    // Check if the current simulation is the fluid (Bet) simulation.
    const isFluidSimulation = () => {
      const activeSimulation = getSimulation();
      const fluidSim = typeof getFluidSimulation === 'function' ? getFluidSimulation() : null;
      return Boolean(activeSimulation === fluidSim);
    };

    // Check if a button menu is currently open in the Bet terrarium.
    const isButtonMenuOpen = () => {
      return isFluidSimulation() && Boolean(powderState.betTerrarium?.buttonMenuOpen);
    };

    // Close any open button menus when user initiates camera gestures.
    const closeButtonMenus = () => {
      if (isFluidSimulation() && powderState.betTerrarium?.buttonMenuOpen) {
        powderState.betTerrarium.buttonMenuOpen = false;
        // Trigger DOM update by dispatching a custom event
        if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
          const event = new CustomEvent('betTerrariumMenuClose');
          window.dispatchEvent(event);
        }
      }
    };

    // Check if the event target is a button element or within a button menu.
    const isButtonOrMenu = (target) => {
      if (!target || !(target instanceof Element)) {
        return false;
      }
      return Boolean(
        target.closest('.fluid-tree-level-button') ||
        target.closest('.fluid-tree-store-button') ||
        target.closest('.fluid-tree-level-toggle') ||
        target.closest('.fluid-tree-store-toggle') ||
        target.closest('.fluid-tree-store-panel') ||
        target.closest('.fluid-tree-level__upgrade')
      );
    };

    // Clear pinch bookkeeping when touches end or become invalid.
    const resetPinchState = () => {
      interaction.pinchState = null;
    };

    // Remove lifted touch samples from the pinch cache so future gestures start clean.
    const removePointerFromCache = (event) => {
      if (event.pointerType === 'touch') {
        interaction.activePointers.delete(event.pointerId);
      }
    };

    // Calculate pinch distance changes to zoom the basin while anchoring around the gesture midpoint.
    const performPinchZoom = () => {
      const activeSimulation = getSimulation();
      if (!activeSimulation) {
        return;
      }
      const pointers = Array.from(interaction.activePointers.values());
      if (pointers.length < 2) {
        resetPinchState();
        return;
      }

      const [first, second] = pointers;
      const dx = first.clientX - second.clientX;
      const dy = first.clientY - second.clientY;
      const distance = Math.hypot(dx, dy);
      if (!Number.isFinite(distance) || distance <= 0) {
        return;
      }

      const midpoint = {
        clientX: (first.clientX + second.clientX) / 2,
        clientY: (first.clientY + second.clientY) / 2,
      };

      if (!interaction.pinchState || !Number.isFinite(interaction.pinchState.startDistance) || interaction.pinchState.startDistance <= 0) {
        interaction.pinchState = {
          startDistance: distance,
          startScale: getActiveScale(),
        };
        return;
      }

      const baseDistance = interaction.pinchState.startDistance;
      const baseScale = Number.isFinite(interaction.pinchState.startScale)
        ? interaction.pinchState.startScale
        : getActiveScale();
      if (!Number.isFinite(baseDistance) || baseDistance <= 0 || !Number.isFinite(baseScale) || baseScale <= 0) {
        resetPinchState();
        return;
      }

      const currentScale = getActiveScale();
      const targetScale = (distance / baseDistance) * baseScale;
      const factor = Number.isFinite(currentScale) && currentScale > 0 ? targetScale / currentScale : 1;
      if (!Number.isFinite(factor) || Math.abs(factor - 1) < 0.001) {
        return;
      }

      const changed = activeSimulation.applyZoomFactor(factor, midpoint);
      if (changed) {
        interaction.pinchState.startDistance = distance;
        interaction.pinchState.startScale = activeSimulation.getViewTransform?.()?.scale ?? targetScale;
      }
    };

    const clearPointerState = () => {
      if (interaction.pointerId !== null && typeof viewport.releasePointerCapture === 'function') {
        viewport.releasePointerCapture(interaction.pointerId);
      }
      interaction.pointerId = null;
      interaction.lastPoint = null;
    };

    const handlePointerDown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }
      // Skip camera pan initiation if clicking on buttons or a button menu is open
      if (isButtonOrMenu(event.target)) {
        return;
      }
      if (isButtonMenuOpen()) {
        return;
      }
      if (event.pointerType === 'touch') {
        interaction.activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
        if (interaction.activePointers.size >= 2) {
          // A second touch begins a pinch gesture, so cancel any in-flight pan capture.
          clearPointerState();
        }
      }
      const activeSimulation = getSimulation();
      if (!activeSimulation) {
        return;
      }
      interaction.pointerId = event.pointerId;
      interaction.lastPoint = { x: event.clientX, y: event.clientY };
      if (typeof viewport.setPointerCapture === 'function') {
        try {
          viewport.setPointerCapture(event.pointerId);
        } catch (error) {
          console.warn('Unable to capture powder viewport pointer', error);
        }
      }
    };

    const handlePointerMove = (event) => {
      if (event.pointerType === 'touch') {
        interaction.activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
        if (interaction.activePointers.size >= 2) {
          if (typeof event.preventDefault === 'function') {
            event.preventDefault();
          }
          // Close menus when pinch zoom gesture is detected
          closeButtonMenus();
          performPinchZoom();
          return;
        }
      }
      if (interaction.pointerId === null || event.pointerId !== interaction.pointerId) {
        return;
      }
      const activeSimulation = getSimulation();
      if (!activeSimulation || !interaction.lastPoint) {
        return;
      }

      const dx = event.clientX - interaction.lastPoint.x;
      const dy = event.clientY - interaction.lastPoint.y;
      
      // Close menus if user starts dragging (pan gesture detected)
      const movement = Math.hypot(dx, dy);
      const MAX_CLICK_MOVEMENT = 5;
      if (movement > MAX_CLICK_MOVEMENT) {
        closeButtonMenus();
      }
      
      interaction.lastPoint = { x: event.clientX, y: event.clientY };

      const transform = activeSimulation.getViewTransform();
      if (!transform || !transform.center) {
        return;
      }

      const scale = Number.isFinite(transform.scale) && transform.scale > 0 ? transform.scale : 1;
      const nextCenter = {
        x: transform.center.x - dx / scale,
        y: transform.center.y - dy / scale,
      };
      activeSimulation.setViewCenterFromWorld(nextCenter);
    };

    const handlePointerUp = (event) => {
      if (event.pointerId !== interaction.pointerId) {
        removePointerFromCache(event);
        if (interaction.activePointers.size < 2) {
          resetPinchState();
        }
        return;
      }
      clearPointerState();
      removePointerFromCache(event);
      if (interaction.activePointers.size < 2) {
        resetPinchState();
      }
    };

    const handleWheel = (event) => {
      const activeSimulation = getSimulation();
      if (!activeSimulation) {
        return;
      }
      const delta = Number.isFinite(event.deltaY) ? event.deltaY : 0;
      if (!delta) {
        return;
      }
      // Close menus when user zooms
      closeButtonMenus();
      const factor = delta > 0 ? 0.9 : 1.1;
      const anchorPoint = { clientX: event.clientX, clientY: event.clientY };
      const changed = activeSimulation.applyZoomFactor(factor, anchorPoint);
      if (changed) {
        event.preventDefault();
      }
    };

    viewport.addEventListener('pointerdown', handlePointerDown);
    viewport.addEventListener('pointermove', handlePointerMove);
    viewport.addEventListener('pointerup', handlePointerUp);
    viewport.addEventListener('pointercancel', handlePointerUp);
    viewport.addEventListener('pointerleave', handlePointerUp);
    viewport.addEventListener('wheel', handleWheel, { passive: false });

    interaction.destroy = () => {
      viewport.removeEventListener('pointerdown', handlePointerDown);
      viewport.removeEventListener('pointermove', handlePointerMove);
      viewport.removeEventListener('pointerup', handlePointerUp);
      viewport.removeEventListener('pointercancel', handlePointerUp);
      viewport.removeEventListener('pointerleave', handlePointerUp);
      viewport.removeEventListener('wheel', handleWheel);
      clearPointerState();
      resetPinchState();
      interaction.activePointers.clear();
    };

    powderState.viewInteraction = interaction;
  }

  return {
    applyPowderViewportTransform,
    handlePowderViewTransformChange,
    handlePowderWallMetricsChange,
    updatePowderWallGapFromGlyphs,
    initializePowderViewInteraction,
  };
}
