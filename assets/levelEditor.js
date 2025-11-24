import {
  clampNormalizedCoordinate,
  sanitizeNormalizedPoint,
  transformPointForOrientation,
  transformPointFromOrientation,
  distanceSquaredToSegment,
} from './geometryHelpers.js';
import {
  initializeWaveEditor,
  showWaveEditor,
  hideWaveEditor,
  loadWavesIntoEditor,
} from './waveEditorUI.js';

/**
 * Factory for the developer level editor and battlefield map tools.
 * Handles overlay surface selection, anchor editing, and developer map UI wiring.
 */
export function createLevelEditorController({
  playfieldElements,
  getPlayfield,
  getLevelConfigs,
  isDeveloperModeActive,
}) {
  const levelEditorSurface = {
    type: 'none',
    canvas: null,
    playfield: null,
    orientation: 'portrait',
    listenerOptions: false,
  };

  function setLevelEditorSurface(options = {}) {
    const nextType = options.type === 'playfield' ? 'playfield' : 'overlay';
    levelEditorSurface.type = nextType;
    levelEditorSurface.canvas = options.canvas || null;
    levelEditorSurface.playfield = options.playfield || null;
    levelEditorSurface.orientation = options.orientation === 'landscape' ? 'landscape' : 'portrait';
    levelEditorSurface.listenerOptions = Boolean(options.listenerOptions);
    if (levelEditorSurface.type === 'playfield' && levelEditorSurface.listenerOptions === false) {
      levelEditorSurface.listenerOptions = true;
    }
  }

  function resetLevelEditorSurface() {
    levelEditorSurface.type = 'none';
    levelEditorSurface.canvas = null;
    levelEditorSurface.playfield = null;
    levelEditorSurface.orientation = 'portrait';
    levelEditorSurface.listenerOptions = false;
  }

  function isOverlayEditorSurface() {
    return levelEditorSurface.type === 'overlay';
  }

  function isPlayfieldEditorSurface() {
    return levelEditorSurface.type === 'playfield';
  }

  const levelEditorElements = {
    container: null,
    toggle: null,
    note: null,
    count: null,
    clear: null,
    reset: null,
    exportButton: null,
    output: null,
    status: null,
    mapSpeedInput: null,
    pointSpeedInput: null,
    applyPointSpeedButton: null,
  };

  const levelEditorState = {
    levelId: null,
    points: [],
    originalPoints: [],
    editing: false,
    draggingIndex: -1,
    selectedPointIndex: -1,
    pointerId: null,
    canvasListenersAttached: false,
    listenerOptions: false,
    statusTimeout: null,
    mapSpeedMultiplier: 1,
  };

  const developerMapElements = {
    container: null,
    clearCrystalsButton: null,
    clearTowersButton: null,
    note: null,
    paletteTools: {},
    toolOptionsContainer: null,
    crystalOptions: {
      group: null,
      integrityInput: null,
      theroInput: null,
    },
    towerOptions: {
      group: null,
      typeSelect: null,
    },
  };

  const developerMapPlacementState = {
    mode: 'path', // Default mode is path editing
    crystalIntegrity: 900,
    crystalThero: 0,
    towerType: 'alpha',
  };

  let overlayPreviewLevel = null;
  let developerMapToolsActive = false;

  function setOverlayPreviewLevel(level) {
    overlayPreviewLevel = level || null;
  }

  function getOverlayPreviewLevel() {
    return overlayPreviewLevel;
  }

  function setLevelEditorStatus(message, options = {}) {
    const tone = options.tone || 'info';
    const duration = Number.isFinite(options.duration) ? options.duration : 0;

    if (!levelEditorElements.status) {
      return;
    }

    levelEditorElements.status.textContent = message || '';
    levelEditorElements.status.setAttribute('data-tone', tone);

    if (levelEditorState.statusTimeout) {
      clearTimeout(levelEditorState.statusTimeout);
      levelEditorState.statusTimeout = null;
    }

    if (message && duration > 0) {
      levelEditorState.statusTimeout = setTimeout(() => {
        levelEditorElements.status.textContent = '';
        levelEditorElements.status.removeAttribute('data-tone');
        levelEditorState.statusTimeout = null;
      }, duration);
    }
  }

  function endLevelEditorDrag() {
    const canvas = levelEditorSurface.canvas;
    if (canvas && typeof canvas.releasePointerCapture === 'function' && levelEditorState.pointerId !== null) {
      try {
        canvas.releasePointerCapture(levelEditorState.pointerId);
      } catch (error) {
        // Ignore release failures.
      }
    }
    if (isOverlayEditorSurface() && canvas && canvas.classList) {
      canvas.classList.remove('overlay-preview__canvas--dragging');
    }
    levelEditorState.draggingIndex = -1;
    levelEditorState.pointerId = null;
  }

  function detachLevelEditorCanvasListeners() {
    const canvas = levelEditorSurface.canvas;
    if (!canvas || !levelEditorState.canvasListenersAttached) {
      return;
    }
    const useCapture = Boolean(levelEditorState.listenerOptions);
    canvas.removeEventListener('pointerdown', handleLevelEditorPointerDown, useCapture);
    canvas.removeEventListener('pointermove', handleLevelEditorPointerMove, useCapture);
    canvas.removeEventListener('pointerup', handleLevelEditorPointerUp, useCapture);
    canvas.removeEventListener('pointercancel', handleLevelEditorPointerUp, useCapture);
    canvas.removeEventListener('lostpointercapture', handleLevelEditorPointerUp, useCapture);
    canvas.removeEventListener('click', handleLevelEditorCanvasClick, useCapture);
    levelEditorState.canvasListenersAttached = false;
    levelEditorState.listenerOptions = false;
  }

  function hideLevelEditorPanel() {
    const surfaceType = levelEditorSurface.type;
    const canvas = levelEditorSurface.canvas;
    const surfacePlayfield = levelEditorSurface.playfield;

    endLevelEditorDrag();
    detachLevelEditorCanvasListeners();
    levelEditorState.levelId = null;
    levelEditorState.points = [];
    levelEditorState.originalPoints = [];
    levelEditorState.editing = false;

    if (surfacePlayfield && typeof surfacePlayfield.setDeveloperPathMarkers === 'function') {
      surfacePlayfield.setDeveloperPathMarkers([]);
      if (typeof surfacePlayfield.draw === 'function') {
        surfacePlayfield.draw();
      }
    }

    if (surfaceType === 'overlay' && canvas && canvas.classList) {
      canvas.classList.remove('overlay-preview__canvas--editing');
      canvas.classList.remove('overlay-preview__canvas--dragging');
    }

    if (surfaceType === 'playfield' && playfieldElements?.container?.classList) {
      playfieldElements.container.classList.remove('playfield--developer-editing');
    }

    if (levelEditorElements.container) {
      levelEditorElements.container.hidden = true;
      levelEditorElements.container.setAttribute('aria-hidden', 'true');
    }

    setDeveloperMapPlacementMode(null);
    updateDeveloperMapElementsVisibility();

    if (levelEditorElements.toggle) {
      levelEditorElements.toggle.disabled = true;
      levelEditorElements.toggle.setAttribute('aria-pressed', 'false');
      levelEditorElements.toggle.textContent = 'Enable Editing';
    }

    updateLevelEditorOutput();
    updateLevelEditorUI();
    setLevelEditorStatus('');
  }

  function attachLevelEditorCanvasListeners() {
    const canvas = levelEditorSurface.canvas;
    if (!canvas || levelEditorState.canvasListenersAttached) {
      return;
    }
    const useCapture = isPlayfieldEditorSurface();
    canvas.addEventListener('pointerdown', handleLevelEditorPointerDown, useCapture);
    canvas.addEventListener('pointermove', handleLevelEditorPointerMove, useCapture);
    canvas.addEventListener('pointerup', handleLevelEditorPointerUp, useCapture);
    canvas.addEventListener('pointercancel', handleLevelEditorPointerUp, useCapture);
    canvas.addEventListener('lostpointercapture', handleLevelEditorPointerUp, useCapture);
    canvas.addEventListener('click', handleLevelEditorCanvasClick, useCapture);
    levelEditorState.canvasListenersAttached = true;
    levelEditorState.listenerOptions = useCapture;
  }

  function handleLevelEditorCanvasClick(event) {
    if (!event || event.defaultPrevented) {
      return;
    }
    if (!levelEditorState.editing && !event.shiftKey) {
      setLevelEditorStatus('Enable editing to adjust anchors.');
      return;
    }
    if (levelEditorState.editing) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function updateLevelEditorOutput() {
    if (!levelEditorElements.output) {
      return;
    }
    if (!levelEditorState.points.length) {
      levelEditorElements.output.value = '';
      if (levelEditorElements.count) {
        levelEditorElements.count.textContent = '0';
      }
      return;
    }
    const points = levelEditorState.points.map((point) => {
      const result = {
        x: Number(point.x.toFixed(4)),
        y: Number(point.y.toFixed(4)),
      };
      // Only include speedMultiplier if it's not the default value of 1
      if (Number.isFinite(point.speedMultiplier) && point.speedMultiplier !== 1) {
        result.speedMultiplier = Number(point.speedMultiplier.toFixed(2));
      }
      return result;
    });
    
    // Create output object with path and optional mapSpeedMultiplier
    const output = { path: points };
    if (Number.isFinite(levelEditorState.mapSpeedMultiplier) && levelEditorState.mapSpeedMultiplier !== 1) {
      output.mapSpeedMultiplier = Number(levelEditorState.mapSpeedMultiplier.toFixed(2));
    }
    
    levelEditorElements.output.value = JSON.stringify(output, null, 2);
    if (levelEditorElements.count) {
      levelEditorElements.count.textContent = `${points.length}`;
    }
  }

  function updatePointSpeedUI() {
    if (!levelEditorElements.pointSpeedInput || !levelEditorElements.applyPointSpeedButton) {
      return;
    }
    
    const hasValidSelection = levelEditorState.selectedPointIndex >= 0 
      && levelEditorState.selectedPointIndex < levelEditorState.points.length;
    
    levelEditorElements.pointSpeedInput.disabled = !hasValidSelection;
    levelEditorElements.applyPointSpeedButton.disabled = !hasValidSelection;
    
    if (hasValidSelection) {
      const point = levelEditorState.points[levelEditorState.selectedPointIndex];
      const speed = Number.isFinite(point.speedMultiplier) ? point.speedMultiplier : 1;
      levelEditorElements.pointSpeedInput.value = speed.toFixed(2);
    } else {
      levelEditorElements.pointSpeedInput.value = '1.00';
    }
  }

  function applyPointSpeedMultiplier() {
    if (levelEditorState.selectedPointIndex < 0 
        || levelEditorState.selectedPointIndex >= levelEditorState.points.length) {
      return;
    }
    
    if (!levelEditorElements.pointSpeedInput) {
      return;
    }
    
    const value = parseFloat(levelEditorElements.pointSpeedInput.value);
    if (!Number.isFinite(value) || value <= 0) {
      setLevelEditorStatus('Speed multiplier must be a positive number.', { tone: 'error' });
      return;
    }
    
    levelEditorState.points[levelEditorState.selectedPointIndex].speedMultiplier = value;
    applyLevelEditorPoints();
    
    const pointNum = levelEditorState.selectedPointIndex + 1;
    const speedText = value.toFixed(2);
    setLevelEditorStatus(`Point ${pointNum} speed set to ${speedText}×`, { tone: 'info', duration: 2000 });
  }

  function updateLevelEditorUI() {
    if (levelEditorElements.toggle) {
      levelEditorElements.toggle.disabled = !isDeveloperModeActive() || !levelEditorSurface.canvas;
      levelEditorElements.toggle.setAttribute('aria-pressed', levelEditorState.editing ? 'true' : 'false');
      levelEditorElements.toggle.textContent = levelEditorState.editing ? 'Disable Editing' : 'Enable Editing';
    }
    if (levelEditorElements.clear) {
      levelEditorElements.clear.disabled = !levelEditorState.editing || levelEditorState.points.length === 0;
    }
    if (levelEditorElements.reset) {
      levelEditorElements.reset.disabled = !levelEditorState.editing || levelEditorState.originalPoints.length === 0;
    }
    if (levelEditorElements.exportButton) {
      levelEditorElements.exportButton.disabled = levelEditorState.points.length < 2;
    }
    updateLevelEditorOutput();
  }

  function refreshLevelEditorMarkers(options = {}) {
    const targetPlayfield = levelEditorSurface.playfield;
    if (!targetPlayfield) {
      return;
    }

    const { redraw = true } = options;
    const canvas = levelEditorSurface.canvas;

    if (!canvas || !levelEditorState.points.length) {
      targetPlayfield.setDeveloperPathMarkers([]);
      if (redraw && typeof targetPlayfield.draw === 'function') {
        targetPlayfield.draw();
      }
      return;
    }

    let width = targetPlayfield.renderWidth || 0;
    let height = targetPlayfield.renderHeight || 0;
    if ((!width || !height) && canvas) {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
    }

    if (!width || !height) {
      targetPlayfield.setDeveloperPathMarkers([]);
      if (redraw && typeof targetPlayfield.draw === 'function') {
        targetPlayfield.draw();
      }
      return;
    }

    const orientation = levelEditorSurface.orientation || targetPlayfield.layoutOrientation || 'portrait';
    const markers = levelEditorState.points.map((point, index) => {
      const oriented = transformPointForOrientation(point, orientation);
      const speedMultiplier = Number.isFinite(point.speedMultiplier) ? point.speedMultiplier : 1;
      return {
        x: oriented.x * width,
        y: oriented.y * height,
        label: index + 1,
        active: levelEditorState.draggingIndex === index,
        speedMultiplier,
      };
    });
    // Also pass the map speed multiplier so the playfield can display it
    targetPlayfield.setDeveloperPathMarkers(markers, {
      mapSpeedMultiplier: levelEditorState.mapSpeedMultiplier,
    });
    if (redraw && typeof targetPlayfield.draw === 'function') {
      targetPlayfield.draw();
    }
  }

  function applyLevelEditorPoints() {
    const targetPlayfield = levelEditorSurface.playfield;
    if (!targetPlayfield || !targetPlayfield.levelConfig) {
      updateLevelEditorOutput();
      updateLevelEditorUI();
      return;
    }

    const orientation = levelEditorSurface.orientation || targetPlayfield.layoutOrientation || 'portrait';
    const sanitized = levelEditorState.points.map((point) => sanitizeNormalizedPoint(point));
    levelEditorState.points = sanitized.map((point) => ({ ...point }));

    if (Array.isArray(targetPlayfield.basePathPoints)) {
      targetPlayfield.basePathPoints = sanitized.map((point) => ({ ...point }));
    }

    const orientedPath = sanitized.map((point) => transformPointForOrientation(point, orientation));
    targetPlayfield.levelConfig.path = orientedPath.map((point) => ({ ...point }));
    targetPlayfield.buildPathGeometry();
    refreshLevelEditorMarkers({ redraw: false });
    if (typeof targetPlayfield.draw === 'function') {
      targetPlayfield.draw();
    }
    updateLevelEditorOutput();
    updateLevelEditorUI();
  }

  function setLevelEditorEditing(active) {
    const canvas = levelEditorSurface.canvas;
    const enable = Boolean(active && isDeveloperModeActive() && canvas);
    if (!enable) {
      endLevelEditorDrag();
    }
    levelEditorState.editing = enable;
    if (levelEditorElements.container) {
      levelEditorElements.container.classList.toggle('overlay-editor--active', enable);
    }
    if (isOverlayEditorSurface() && canvas && canvas.classList) {
      canvas.classList.toggle('overlay-preview__canvas--editing', enable);
      if (!enable) {
        canvas.classList.remove('overlay-preview__canvas--dragging');
      }
    }
    const playfield = getPlayfield();
    if (isPlayfieldEditorSurface() && playfieldElements?.container?.classList) {
      playfieldElements.container.classList.toggle('playfield--developer-editing', enable);
    }
    updateLevelEditorUI();
    refreshLevelEditorMarkers();
    if (!enable && playfield?.setDeveloperPathMarkers) {
      playfield.setDeveloperPathMarkers([]);
    }
  }

  function clearLevelEditorPoints() {
    levelEditorState.points = [];
    levelEditorState.draggingIndex = -1;
    levelEditorState.selectedPointIndex = -1;
    applyLevelEditorPoints();
    updatePointSpeedUI();
    setLevelEditorStatus('Cleared all anchors. Click to plot a new path.', { tone: 'warning' });
  }

  function resetLevelEditorPoints() {
    if (!levelEditorState.originalPoints.length) {
      return;
    }
    levelEditorState.points = levelEditorState.originalPoints.map((point) => ({ ...point }));
    levelEditorState.draggingIndex = -1;
    levelEditorState.selectedPointIndex = -1;
    applyLevelEditorPoints();
    updatePointSpeedUI();
    setLevelEditorStatus('Restored path from level configuration.');
  }

  function configureLevelEditorForLevel(level, config, options = {}) {
    if (!levelEditorElements.container) {
      return;
    }

    const basePathSource = Array.isArray(options.basePath) ? options.basePath : config?.path;
    const hasPath = Array.isArray(basePathSource) && basePathSource.length >= 2;
    if (!isDeveloperModeActive() || !level || !hasPath) {
      hideLevelEditorPanel();
      return;
    }

    const orientation = options.orientation === 'landscape' ? 'landscape' : 'portrait';
    levelEditorSurface.orientation = orientation;

    levelEditorState.levelId = level.id || null;
    levelEditorState.originalPoints = basePathSource.map((point) => sanitizeNormalizedPoint(point));
    levelEditorState.points = levelEditorState.originalPoints.map((point) => ({ ...point }));
    levelEditorState.editing = false;
    levelEditorState.draggingIndex = -1;
    levelEditorState.selectedPointIndex = -1;
    levelEditorState.pointerId = null;
    
    // Load map speed multiplier from config
    levelEditorState.mapSpeedMultiplier = Number.isFinite(config?.mapSpeedMultiplier) 
      ? config.mapSpeedMultiplier 
      : 1;
    if (levelEditorElements.mapSpeedInput) {
      levelEditorElements.mapSpeedInput.value = levelEditorState.mapSpeedMultiplier.toFixed(2);
    }
    
    updatePointSpeedUI();

    const canvas = levelEditorSurface.canvas;
    if (isOverlayEditorSurface() && canvas && canvas.classList) {
      canvas.classList.remove('overlay-preview__canvas--dragging');
      canvas.classList.remove('overlay-preview__canvas--editing');
    }

    if (isPlayfieldEditorSurface() && playfieldElements?.container?.classList) {
      playfieldElements.container.classList.remove('playfield--developer-editing');
    }

    attachLevelEditorCanvasListeners();
    applyLevelEditorPoints();

    levelEditorElements.container.hidden = false;
    levelEditorElements.container.setAttribute('aria-hidden', 'false');
    if (levelEditorElements.note) {
      if (isPlayfieldEditorSurface()) {
        levelEditorElements.note.textContent =
          'Click the battlefield to place anchors. Drag markers to adjust, Shift-click to remove, or Alt-click to select for speed editing.';
      } else {
        levelEditorElements.note.textContent =
          'Click the preview to place anchors. Drag markers to adjust, Shift-click to remove, or Alt-click to select for speed editing.';
      }
    }
    const readyMessage = isPlayfieldEditorSurface()
      ? 'Battlefield editing ready—toggle editing to adjust anchors live.'
      : 'Developer editor ready—toggle editing to adjust anchors.';
    setLevelEditorStatus(readyMessage, { duration: 2000 });
  }

  function syncLevelEditorVisibility() {
    if (!isDeveloperModeActive()) {
      hideLevelEditorPanel();
      return;
    }

    if (!levelEditorElements.container) {
      return;
    }

    if (!developerMapToolsActive || !isPlayfieldEditorSurface()) {
      hideLevelEditorPanel();
      return;
    }

    if (!overlayPreviewLevel || !levelEditorSurface.playfield) {
      return;
    }

    const targetPlayfield = levelEditorSurface.playfield;
    const isActivePlayfieldSurface = isPlayfieldEditorSurface();
    let basePath = null;
    let orientation = levelEditorSurface.orientation || targetPlayfield.layoutOrientation || 'portrait';

    if (isActivePlayfieldSurface) {
      if (!targetPlayfield.levelConfig) {
        hideLevelEditorPanel();
        return;
      }
      if (Array.isArray(targetPlayfield.basePathPoints) && targetPlayfield.basePathPoints.length >= 2) {
        basePath = targetPlayfield.basePathPoints;
      } else if (Array.isArray(targetPlayfield.levelConfig.path) && targetPlayfield.levelConfig.path.length >= 2) {
        basePath = targetPlayfield.levelConfig.path.map((point) => transformPointFromOrientation(point, orientation));
      }
    } else {
      const levelConfigs = getLevelConfigs();
      const config = levelConfigs?.get(overlayPreviewLevel.id);
      if (!config || !Array.isArray(config.path) || config.path.length < 2) {
        hideLevelEditorPanel();
        return;
      }
      basePath = config.path;
    }

    if (!Array.isArray(basePath) || basePath.length < 2) {
      hideLevelEditorPanel();
      return;
    }

    if (levelEditorState.levelId !== overlayPreviewLevel.id) {
      configureLevelEditorForLevel(overlayPreviewLevel, { path: basePath }, { orientation, basePath });
      return;
    }

    levelEditorElements.container.hidden = false;
    levelEditorElements.container.setAttribute('aria-hidden', 'false');
    updateLevelEditorUI();
    refreshLevelEditorMarkers();
    updateDeveloperMapElementsVisibility();
  }

  function handleLevelEditorToggle() {
    if (!isDeveloperModeActive()) {
      setLevelEditorStatus('Enable developer mode to use the level editor.', { tone: 'warning' });
      return;
    }
    const nextState = !levelEditorState.editing;
    setLevelEditorEditing(nextState);
    if (nextState && !levelEditorState.points.length) {
      const prompt = isPlayfieldEditorSurface()
        ? 'Click the battlefield to place your first anchor.'
        : 'Click the preview to place your first anchor.';
      setLevelEditorStatus(prompt);
    } else if (!nextState) {
      setLevelEditorStatus('Editing disabled. Copy the JSON below when ready.');
    }
  }

  function handleLevelEditorClear() {
    clearLevelEditorPoints();
  }

  function handleLevelEditorReset() {
    resetLevelEditorPoints();
  }

  async function handleLevelEditorExport() {
    if (!levelEditorElements.output) {
      return;
    }
    const text = levelEditorElements.output.value.trim();
    if (!text) {
      setLevelEditorStatus('Add at least two anchors before exporting.', { tone: 'warning' });
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setLevelEditorStatus('Copied path JSON to clipboard.');
      } else {
        levelEditorElements.output.focus();
        levelEditorElements.output.select();
        setLevelEditorStatus('Clipboard unavailable—select and copy manually.', { tone: 'warning' });
      }
    } catch (error) {
      console.warn('Level editor failed to copy path', error);
      levelEditorElements.output.focus();
      levelEditorElements.output.select();
      setLevelEditorStatus('Copy failed—select the JSON manually.', { tone: 'error' });
    }
  }

  function getNormalizedPointerPosition(event) {
    const canvas = levelEditorSurface.canvas;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }
    const pointer = {
      x: clampNormalizedCoordinate((event.clientX - rect.left) / rect.width),
      y: clampNormalizedCoordinate((event.clientY - rect.top) / rect.height),
    };
    const orientation = levelEditorSurface.orientation;
    return transformPointFromOrientation(pointer, orientation);
  }

  function findNearestEditorPoint(point) {
    const points = levelEditorState.points;
    if (!points.length) {
      return { index: -1, distance: Infinity };
    }
    let bestIndex = -1;
    let bestDistance = Infinity;
    points.forEach((candidate, index) => {
      const dx = candidate.x - point.x;
      const dy = candidate.y - point.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return { index: bestIndex, distance: bestDistance };
  }

  function findInsertionIndex(point) {
    const points = levelEditorState.points;
    if (!points.length) {
      return 0;
    }
    if (points.length === 1) {
      return 1;
    }
    let bestIndex = points.length;
    let bestDistance = Infinity;
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const distance = distanceSquaredToSegment(point, start, end);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index + 1;
      }
    }
    return bestIndex;
  }

  function handleLevelEditorPointerDown(event) {
    const canvas = levelEditorSurface.canvas;
    if (!levelEditorState.editing || !canvas || event.button !== 0) {
      return;
    }

    // Check if we're in path editing mode - if not, let the click pass through
    const currentMode = developerMapPlacementState.mode;
    if (currentMode !== 'path') {
      // For non-path modes, don't handle the pointerdown - let the click event handle it
      return;
    }

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const point = getNormalizedPointerPosition(event);
    if (!point) {
      return;
    }

    const nearest = findNearestEditorPoint(point);
    const removalThreshold = 0.045;
    if (event.shiftKey && nearest.index >= 0 && nearest.distance <= removalThreshold) {
      levelEditorState.points.splice(nearest.index, 1);
      levelEditorState.draggingIndex = -1;
      levelEditorState.pointerId = null;
      applyLevelEditorPoints();
      const removalMessage = isPlayfieldEditorSurface()
        ? `Removed anchor ${nearest.index + 1} from the battlefield.`
        : `Removed anchor ${nearest.index + 1}.`;
      setLevelEditorStatus(removalMessage, { tone: 'warning' });
      return;
    }

    const selectionThreshold = 0.04;
    if (nearest.index >= 0 && nearest.distance <= selectionThreshold) {
      // Alt+click to select point for speed editing (without dragging)
      if (event.altKey) {
        levelEditorState.selectedPointIndex = nearest.index;
        updatePointSpeedUI();
        setLevelEditorStatus(`Point ${nearest.index + 1} selected for speed editing.`, { tone: 'info' });
        return;
      }
      
      levelEditorState.draggingIndex = nearest.index;
      levelEditorState.selectedPointIndex = nearest.index;
      levelEditorState.pointerId = event.pointerId;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (error) {
        // ignore pointer capture errors
      }
      if (isOverlayEditorSurface() && canvas.classList) {
        canvas.classList.add('overlay-preview__canvas--dragging');
      }
      levelEditorState.points[nearest.index] = point;
      applyLevelEditorPoints();
      updatePointSpeedUI();
      return;
    }

    const insertionIndex = findInsertionIndex(point);
    levelEditorState.points.splice(insertionIndex, 0, point);
    levelEditorState.draggingIndex = insertionIndex;
    levelEditorState.pointerId = event.pointerId;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      // ignore pointer capture errors
    }
    if (isOverlayEditorSurface() && canvas.classList) {
      canvas.classList.add('overlay-preview__canvas--dragging');
    }
    applyLevelEditorPoints();
    if (levelEditorState.points.length === 1) {
      const placementMessage = isPlayfieldEditorSurface()
        ? 'Anchor placed. Add another anchor on the battlefield to draw the path.'
        : 'Anchor placed. Add another anchor to draw the path.';
      setLevelEditorStatus(placementMessage);
    }
  }

  function handleLevelEditorPointerMove(event) {
    if (!levelEditorState.editing || levelEditorState.draggingIndex < 0) {
      return;
    }
    if (levelEditorState.pointerId !== null && event.pointerId !== levelEditorState.pointerId) {
      return;
    }

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const point = getNormalizedPointerPosition(event);
    if (!point) {
      return;
    }
    levelEditorState.points[levelEditorState.draggingIndex] = point;
    applyLevelEditorPoints();
  }

  function handleLevelEditorPointerUp(event) {
    if (event && levelEditorState.pointerId !== null && event.pointerId !== levelEditorState.pointerId) {
      return;
    }

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    endLevelEditorDrag();
    refreshLevelEditorMarkers();
    updateLevelEditorUI();
  }

  function setDeveloperMapPlacementMode(mode) {
    const validModes = ['path', 'crystal', 'tower', 'erase'];
    const nextMode = validModes.includes(mode) ? mode : 'path';
    developerMapPlacementState.mode = nextMode;

    // Update palette button states
    Object.entries(developerMapElements.paletteTools).forEach(([toolMode, button]) => {
      if (button) {
        button.setAttribute('aria-pressed', toolMode === nextMode ? 'true' : 'false');
      }
    });

    // Show/hide tool-specific options
    if (developerMapElements.crystalOptions.group) {
      developerMapElements.crystalOptions.group.hidden = nextMode !== 'crystal';
    }
    if (developerMapElements.towerOptions.group) {
      developerMapElements.towerOptions.group.hidden = nextMode !== 'tower';
    }

    // Update note text based on active tool
    if (developerMapElements.note) {
      const noteMessages = {
        path: 'Click to place path anchors. Drag to adjust, Shift-click to remove.',
        crystal: 'Click the battlefield to place crystal obstacles.',
        tower: 'Click the battlefield to place pre-configured towers.',
        erase: 'Click on crystals or towers to remove them.',
      };
      const message = noteMessages[nextMode] || '';
      developerMapElements.note.hidden = !message;
      developerMapElements.note.textContent = message;
    }
  }

  function placeDeveloperCrystal(normalized) {
    const playfield = getPlayfield();
    if (!playfield || typeof playfield.addDeveloperCrystal !== 'function') {
      setLevelEditorStatus('Active battlefield required before placing crystals.', { tone: 'warning' });
      return false;
    }
    const placed = playfield.addDeveloperCrystal(normalized, {
      integrity: developerMapPlacementState.crystalIntegrity,
      thero: developerMapPlacementState.crystalThero,
    });
    if (!placed) {
      setLevelEditorStatus('Crystal placement failed—ensure the click stays within the battlefield.', { tone: 'error' });
      return false;
    }
    const integrityText = developerMapPlacementState.crystalIntegrity;
    const theroText = developerMapPlacementState.crystalThero > 0
      ? ` (${developerMapPlacementState.crystalThero}θ reward)`
      : '';
    setLevelEditorStatus(`Crystal placed (${integrityText} integrity${theroText}).`, {
      tone: 'info',
      duration: 2800,
    });
    return true;
  }

  function clearDeveloperTowersFromUI() {
    const playfield = getPlayfield();
    if (!playfield || typeof playfield.clearDeveloperTowers !== 'function') {
      setLevelEditorStatus('Enter an interactive defense to clear developer towers.', { tone: 'warning' });
      return;
    }
    const removed = playfield.clearDeveloperTowers({ silent: false });
    if (removed > 0) {
      const suffix = removed === 1 ? '' : 's';
      setLevelEditorStatus(`Cleared ${removed} developer tower${suffix}.`, { tone: 'info' });
    } else {
      setLevelEditorStatus('No developer towers to clear.', { tone: 'warning' });
    }
  }

  function handleDeveloperMapPlacementRequest(context = {}) {
    if (!isDeveloperModeActive() || !developerMapToolsActive) {
      return false;
    }
    if (!context || !context.normalized) {
      return false;
    }

    const mode = developerMapPlacementState.mode;
    const playfield = context.playfield || getPlayfield();

    // Handle crystal placement
    if (mode === 'crystal') {
      return placeDeveloperCrystal(context.normalized);
    }

    // Handle tower placement
    if (mode === 'tower') {
      if (!playfield || typeof playfield.addDeveloperTower !== 'function') {
        setLevelEditorStatus('Active battlefield required before placing towers.', { tone: 'warning' });
        return false;
      }
      const towerType = developerMapPlacementState.towerType;
      const placed = playfield.addDeveloperTower(context.normalized, { towerType });
      if (placed) {
        setLevelEditorStatus(`${towerType.toUpperCase()} tower placed on battlefield.`, {
          tone: 'info',
          duration: 2400,
        });
        return true;
      }
      setLevelEditorStatus('Tower placement failed—check positioning and range.', { tone: 'error' });
      return false;
    }

    // Handle erase mode
    if (mode === 'erase') {
      if (!playfield) {
        return false;
      }
      
      // Try to remove path point at normalized position first
      if (levelEditorState.editing && context.normalized) {
        const nearest = findNearestEditorPoint(context.normalized);
        const removalThreshold = 0.045;
        if (nearest.index >= 0 && nearest.distance <= removalThreshold) {
          levelEditorState.points.splice(nearest.index, 1);
          levelEditorState.draggingIndex = -1;
          levelEditorState.selectedPointIndex = -1;
          levelEditorState.pointerId = null;
          applyLevelEditorPoints();
          setLevelEditorStatus(`Removed anchor ${nearest.index + 1} from the battlefield.`, { tone: 'warning' });
          return true;
        }
      }
      
      // Try to remove crystal at position
      if (context.position && typeof playfield.findCrystalAt === 'function' && typeof playfield.removeDeveloperCrystal === 'function') {
        const crystal = playfield.findCrystalAt(context.position);
        if (crystal) {
          const removed = playfield.removeDeveloperCrystal(crystal.id);
          if (removed) {
            setLevelEditorStatus('Crystal removed from battlefield.', { tone: 'info', duration: 2000 });
            return true;
          }
        }
      }
      // Try to remove tower at position
      if (context.position && typeof playfield.findDeveloperTowerAt === 'function' && typeof playfield.removeDeveloperTower === 'function') {
        const tower = playfield.findDeveloperTowerAt(context.position);
        if (tower) {
          const removed = playfield.removeDeveloperTower(tower.id);
          if (removed) {
            setLevelEditorStatus('Tower removed from battlefield.', { tone: 'info', duration: 2000 });
            return true;
          }
        }
      }
      // Return true to consume the click even if nothing was removed
      // This prevents the click from falling through to normal game handlers
      return true;
    }

    // Path mode doesn't use this handler
    return false;
  }

  function clearDeveloperCrystalsFromUI() {
    const playfield = getPlayfield();
    if (!playfield || typeof playfield.clearDeveloperCrystals !== 'function') {
      setLevelEditorStatus('Enter an interactive defense to clear developer crystals.', { tone: 'warning' });
      return;
    }
    const removed = playfield.clearDeveloperCrystals({ silent: false });
    if (removed > 0) {
      const suffix = removed === 1 ? '' : 's';
      setLevelEditorStatus(`Cleared ${removed} developer crystal${suffix}.`, { tone: 'info' });
    } else {
      setLevelEditorStatus('No developer crystals to clear.', { tone: 'warning' });
    }
  }

  function updateDeveloperMapElementsVisibility() {
    const container = developerMapElements.container;
    if (!container) {
      return;
    }
    const toolsActive = developerMapToolsActive && isPlayfieldEditorSurface();
    container.hidden = !isDeveloperModeActive() || !toolsActive;
    container.setAttribute('aria-hidden', container.hidden ? 'true' : 'false');
    if (!toolsActive) {
      setDeveloperMapPlacementMode('path');
      if (developerMapElements.note) {
        developerMapElements.note.hidden = true;
        developerMapElements.note.textContent = '';
      }
    } else {
      // Update note based on current mode
      setDeveloperMapPlacementMode(developerMapPlacementState.mode || 'path');
    }
  }

  function initializeDeveloperMapElements() {
    developerMapElements.container = document.getElementById('developer-map-elements');
    developerMapElements.clearCrystalsButton = document.getElementById('developer-clear-crystals');
    developerMapElements.clearTowersButton = document.getElementById('developer-clear-towers');
    developerMapElements.note = document.getElementById('developer-map-elements-note');
    developerMapElements.toolOptionsContainer = document.getElementById('tool-options-container');

    // Initialize palette tool buttons
    const toolModes = ['path', 'crystal', 'tower', 'erase'];
    toolModes.forEach((mode) => {
      const button = document.getElementById(`palette-tool-${mode}`);
      if (button) {
        developerMapElements.paletteTools[mode] = button;
        button.addEventListener('click', (event) => {
          event.preventDefault();
          if (!isDeveloperModeActive()) {
            setLevelEditorStatus('Enable developer mode to use map tools.', { tone: 'warning' });
            return;
          }
          setDeveloperMapPlacementMode(mode);
        });
      }
    });

    // Initialize crystal options
    developerMapElements.crystalOptions.group = document.getElementById('tool-options-crystal');
    developerMapElements.crystalOptions.integrityInput = document.getElementById('crystal-integrity-input');
    developerMapElements.crystalOptions.theroInput = document.getElementById('crystal-thero-input');

    if (developerMapElements.crystalOptions.integrityInput) {
      developerMapElements.crystalOptions.integrityInput.addEventListener('change', (event) => {
        const value = parseInt(event.target.value, 10);
        if (Number.isFinite(value) && value >= 10) {
          developerMapPlacementState.crystalIntegrity = value;
        }
      });
    }

    if (developerMapElements.crystalOptions.theroInput) {
      developerMapElements.crystalOptions.theroInput.addEventListener('change', (event) => {
        const value = parseInt(event.target.value, 10);
        if (Number.isFinite(value) && value >= 0) {
          developerMapPlacementState.crystalThero = value;
        }
      });
    }

    // Initialize tower options
    developerMapElements.towerOptions.group = document.getElementById('tool-options-tower');
    developerMapElements.towerOptions.typeSelect = document.getElementById('tower-type-select');

    if (developerMapElements.towerOptions.typeSelect) {
      developerMapElements.towerOptions.typeSelect.addEventListener('change', (event) => {
        developerMapPlacementState.towerType = event.target.value || 'alpha';
      });
    }

    // Initialize clear buttons
    if (developerMapElements.clearCrystalsButton) {
      developerMapElements.clearCrystalsButton.addEventListener('click', (event) => {
        event.preventDefault();
        clearDeveloperCrystalsFromUI();
      });
    }

    if (developerMapElements.clearTowersButton) {
      developerMapElements.clearTowersButton.addEventListener('click', (event) => {
        event.preventDefault();
        clearDeveloperTowersFromUI();
      });
    }

    // Set initial mode and update visibility
    setDeveloperMapPlacementMode('path');
    updateDeveloperMapElementsVisibility();
  }

  function initializeLevelEditorElements() {
    levelEditorElements.container = document.getElementById('overlay-level-editor');
    levelEditorElements.toggle = document.getElementById('level-editor-toggle');
    levelEditorElements.note = document.getElementById('level-editor-note');
    levelEditorElements.count = document.getElementById('level-editor-count');
    levelEditorElements.clear = document.getElementById('level-editor-clear');
    levelEditorElements.reset = document.getElementById('level-editor-reset');
    levelEditorElements.exportButton = document.getElementById('level-editor-export');
    levelEditorElements.output = document.getElementById('level-editor-output');
    levelEditorElements.status = document.getElementById('level-editor-status');
    levelEditorElements.mapSpeedInput = document.getElementById('map-speed-multiplier-input');
    levelEditorElements.pointSpeedInput = document.getElementById('point-speed-multiplier-input');
    levelEditorElements.applyPointSpeedButton = document.getElementById('apply-point-speed-button');

    // Initialize map speed multiplier input
    if (levelEditorElements.mapSpeedInput) {
      levelEditorElements.mapSpeedInput.addEventListener('change', (event) => {
        const value = parseFloat(event.target.value);
        if (Number.isFinite(value) && value > 0) {
          levelEditorState.mapSpeedMultiplier = value;
          updateLevelEditorOutput();
          setLevelEditorStatus(`Map speed multiplier set to ${value.toFixed(2)}×`, { tone: 'info', duration: 2000 });
        }
      });
    }

    // Initialize point speed multiplier button
    if (levelEditorElements.applyPointSpeedButton) {
      levelEditorElements.applyPointSpeedButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        applyPointSpeedMultiplier();
      });
    }

    if (levelEditorElements.toggle) {
      levelEditorElements.toggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleLevelEditorToggle();
      });
    }
    if (levelEditorElements.clear) {
      levelEditorElements.clear.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleLevelEditorClear();
      });
    }
    if (levelEditorElements.reset) {
      levelEditorElements.reset.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleLevelEditorReset();
      });
    }
    if (levelEditorElements.exportButton) {
      levelEditorElements.exportButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleLevelEditorExport();
      });
    }

    hideLevelEditorPanel();

    initializeWaveEditor();
  }

  function activateDeveloperMapToolsForLevel(level) {
    const playfield = getPlayfield();
    if (!isDeveloperModeActive() || !level || !playfield || !playfieldElements?.canvas || !playfield.levelActive || !playfield.levelConfig) {
      return false;
    }

    const battlefieldCanvas = playfieldElements.canvas || playfield.canvas || null;
    if (!battlefieldCanvas) {
      return false;
    }

    const orientation = playfield.layoutOrientation || 'portrait';
    setLevelEditorSurface({
      type: 'playfield',
      canvas: battlefieldCanvas,
      playfield,
      orientation,
      listenerOptions: true,
    });

    const levelConfigs = getLevelConfigs();
    const config = levelConfigs?.get(level.id) || null;
    let basePath = Array.isArray(playfield.basePathPoints) && playfield.basePathPoints.length >= 2
      ? playfield.basePathPoints
      : null;

    if (!basePath && Array.isArray(playfield.levelConfig?.path) && playfield.levelConfig.path.length >= 2) {
      basePath = playfield.levelConfig.path.map((point) => transformPointFromOrientation(point, orientation));
    }

    if (!basePath && Array.isArray(config?.path) && config.path.length >= 2) {
      basePath = config.path;
    }

    if (!Array.isArray(basePath) || basePath.length < 2) {
      return false;
    }

    developerMapToolsActive = true;
    overlayPreviewLevel = level;

    configureLevelEditorForLevel(level, { path: basePath }, { orientation, basePath });
    setLevelEditorEditing(true);
    setLevelEditorStatus('Editing active—drag anchors or Shift-click to remove.', { duration: 2600 });
    updateDeveloperMapElementsVisibility();

    showWaveEditor();
    if (config && config.waves) {
      loadWavesIntoEditor(config.waves);
    }

    return true;
  }

  function deactivateDeveloperMapTools(options = {}) {
    const { force = false, silent = false } = options;
    if (!developerMapToolsActive && !force) {
      return false;
    }

    developerMapToolsActive = false;
    overlayPreviewLevel = null;
    hideLevelEditorPanel();
    resetLevelEditorSurface();
    updateDeveloperMapElementsVisibility();

    hideWaveEditor();

    if (!silent) {
      const playfield = getPlayfield();
      if (playfield?.messageEl) {
        playfield.messageEl.textContent = 'Developer map tools closed.';
      }
    }

    return true;
  }

  function isDeveloperMapToolsActive() {
    return developerMapToolsActive;
  }

  return {
    setLevelEditorSurface,
    resetLevelEditorSurface,
    isOverlayEditorSurface,
    isPlayfieldEditorSurface,
    configureLevelEditorForLevel,
    setLevelEditorEditing,
    setLevelEditorStatus,
    syncLevelEditorVisibility,
    updateDeveloperMapElementsVisibility,
    setDeveloperMapPlacementMode,
    handleDeveloperMapPlacementRequest,
    initializeDeveloperMapElements,
    initializeLevelEditorElements,
    activateDeveloperMapToolsForLevel,
    deactivateDeveloperMapTools,
    isDeveloperMapToolsActive,
    hideLevelEditorPanel,
    setOverlayPreviewLevel,
    getOverlayPreviewLevel,
  };
}
