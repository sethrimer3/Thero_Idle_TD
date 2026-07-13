'use strict';

/**
 * Factory that manages Aleph and Bet Spire camera controls (zoom, pan,
 * UI toggle sync).  Extracted from main.js to reduce its line count and
 * isolate camera state from core game orchestration.
 *
 * @param {object} deps
 * @param {object}   deps.powderState                  - Shared powder/spire state.
 * @param {Function} deps.getPowderSimulation           - Getter; returns active powder simulation.
 * @param {Function} deps.getFluidSimulation            - Getter; returns Bet fluid simulation.
 * @param {Function} deps.getSandSimulation             - Getter; returns Aleph sand simulation.
 * @param {Function} deps.getFluidElements              - Getter; returns fluid DOM element refs.
 * @param {Function} deps.getFluidTerrariumTrees        - Getter; returns terrarium trees instance.
 * @param {Function} deps.handlePowderViewTransformChange - Callback on camera transform update.
 * @param {Function} deps.handlePowderWallMetricsChange   - Callback on wall metrics update.
 * @param {Function} deps.schedulePowderBasinSave       - Persist powder basin to storage.
 */
export function createSpireCameraController(deps) {
  const {
    powderState,
    getPowderSimulation,
    getFluidSimulation,
    getSandSimulation: _getSandSimulation,
    getFluidElements,
    getFluidTerrariumTrees,
    handlePowderViewTransformChange,
    handlePowderWallMetricsChange,
    schedulePowderBasinSave,
  } = deps;

  // ── Aleph camera ─────────────────────────────────────────────────────

  function resetPowderCameraTransform() {
    const powderSimulation = getPowderSimulation();
    const fluidSimulationInstance = getFluidSimulation();
    if (!powderSimulation || powderSimulation === fluidSimulationInstance) {
      return;
    }
    // Restore the Aleph spire camera to its default framing when controls are disabled.
    if (typeof powderSimulation.setZoom === 'function') {
      powderSimulation.setZoom(1);
    } else if (typeof powderSimulation.applyZoomFactor === 'function') {
      const currentScale = powderSimulation.getViewTransform?.()?.scale || 1;
      if (Math.abs(currentScale - 1) > 0.0001) {
        powderSimulation.applyZoomFactor(1 / currentScale);
      }
    }
    if (typeof powderSimulation.setViewCenterNormalized === 'function') {
      powderSimulation.setViewCenterNormalized({ x: 0.5, y: 0.5 });
    }
    handlePowderViewTransformChange(powderSimulation.getViewTransform());
  }

  // Toggle Aleph spire camera controls and optionally reset the view transform.
  function setPowderCameraMode(enabled, options = {}) {
    const nextState = Boolean(enabled);
    const skipTransformReset = Boolean(options.skipTransformReset);
    powderState.alephCameraMode = nextState;
    if (!nextState && !skipTransformReset) {
      const powderSimulation = getPowderSimulation();
      if (powderSimulation) {
        resetPowderCameraTransform();
      } else {
        // Cache a default transform so future sessions start centered when camera controls are off.
        powderState.viewTransform = { scale: 1, normalizedCenter: { x: 0.5, y: 0.5 } };
      }
    }
  }

  // ── Bet (fluid) camera ────────────────────────────────────────────────

  function resetFluidCameraTransform() {
    const fluidSimulationInstance = getFluidSimulation();
    if (!fluidSimulationInstance || typeof fluidSimulationInstance.getViewTransform !== 'function') {
      return;
    }
    if (typeof fluidSimulationInstance.setViewScale === 'function') {
      fluidSimulationInstance.setViewScale(1);
    } else if (typeof fluidSimulationInstance.applyZoomFactor === 'function') {
      const currentScale = fluidSimulationInstance.getViewTransform()?.scale || 1;
      if (Math.abs(currentScale - 1) > 0.0001) {
        fluidSimulationInstance.applyZoomFactor(1 / currentScale);
      }
    }
    if (typeof fluidSimulationInstance.setViewCenterNormalized === 'function') {
      fluidSimulationInstance.setViewCenterNormalized({ x: 0.5, y: 0.5 });
    }
    handlePowderViewTransformChange(fluidSimulationInstance.getViewTransform());
  }

  function syncFluidCameraModeUi() {
    const fluidElements = getFluidElements();
    const enabled = Boolean(powderState.betTerrarium?.cameraMode);
    if (fluidElements.viewport) {
      fluidElements.viewport.classList.toggle('fluid-viewport--camera-locked', !enabled);
    }
    if (fluidElements.cameraModeToggle) {
      fluidElements.cameraModeToggle.classList.toggle('is-active', enabled);
      fluidElements.cameraModeToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    }
    if (fluidElements.cameraModeStateLabel) {
      fluidElements.cameraModeStateLabel.textContent = enabled ? 'On' : 'Off';
    }
    if (fluidElements.cameraModeHint) {
      fluidElements.cameraModeHint.textContent = '';
      fluidElements.cameraModeHint.hidden = true;
    }
  }

  function setFluidCameraMode(enabled, options = {}) {
    const nextState = Boolean(enabled);
    const skipTransformReset = Boolean(options.skipTransformReset);
    const skipSave = Boolean(options.skipSave);
    if (!powderState.betTerrarium) {
      powderState.betTerrarium = {};
    }
    powderState.betTerrarium.cameraMode = nextState;

    const fluidTerrariumTrees = getFluidTerrariumTrees();
    if (fluidTerrariumTrees?.setCameraMode) {
      fluidTerrariumTrees.setCameraMode(nextState, { notifyHost: false });
    }

    syncFluidCameraModeUi();

    if (!nextState && !skipTransformReset) {
      resetFluidCameraTransform();
    }

    if (!skipSave) {
      schedulePowderBasinSave();
    }
  }

  function bindFluidCameraModeToggle() {
    const fluidElements = getFluidElements();
    if (!fluidElements.cameraModeToggle) {
      return;
    }
    fluidElements.cameraModeToggle.addEventListener('click', () => {
      setFluidCameraMode(!powderState.betTerrarium?.cameraMode);
    });
  }

  // ── Powder wall helper ────────────────────────────────────────────────

  // Convenience helper so developer toggles can refresh the powder walls without duplicating logic.
  function refreshPowderWallDecorations() {
    const powderSimulation = getPowderSimulation();
    const fluidSimulationInstance = getFluidSimulation();
    handlePowderWallMetricsChange(
      powderSimulation ? powderSimulation.getWallMetrics() : null,
      powderSimulation === fluidSimulationInstance ? 'fluid' : 'sand',
    );
  }

  return {
    resetPowderCameraTransform,
    setPowderCameraMode,
    resetFluidCameraTransform,
    syncFluidCameraModeUi,
    setFluidCameraMode,
    bindFluidCameraModeToggle,
    refreshPowderWallDecorations,
  };
}
