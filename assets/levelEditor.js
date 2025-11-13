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
  };

  const levelEditorState = {
    levelId: null,
    points: [],
    originalPoints: [],
    editing: false,
    draggingIndex: -1,
    pointerId: null,
    canvasListenersAttached: false,
    listenerOptions: false,
    statusTimeout: null,
  };

  const developerMapElements = {
    container: null,
    addCrystalButton: null,
    clearButton: null,
    note: null,
  };

  const developerMapPlacementState = {
    mode: null,
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
    const points = levelEditorState.points.map((point) => ({
      x: Number(point.x.toFixed(4)),
      y: Number(point.y.toFixed(4)),
    }));
    levelEditorElements.output.value = JSON.stringify(points, null, 2);
    if (levelEditorElements.count) {
      levelEditorElements.count.textContent = `${points.length}`;
    }
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
      return {
        x: oriented.x * width,
        y: oriented.y * height,
        label: index + 1,
        active: levelEditorState.draggingIndex === index,
      };
    });
    targetPlayfield.setDeveloperPathMarkers(markers);
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
    applyLevelEditorPoints();
    setLevelEditorStatus('Cleared all anchors. Click to plot a new path.', { tone: 'warning' });
  }

  function resetLevelEditorPoints() {
    if (!levelEditorState.originalPoints.length) {
      return;
    }
    levelEditorState.points = levelEditorState.originalPoints.map((point) => ({ ...point }));
    levelEditorState.draggingIndex = -1;
    applyLevelEditorPoints();
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
    levelEditorState.pointerId = null;

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
          'Click the battlefield to place anchors. Drag markers to adjust, or Shift-click to remove the nearest anchor.';
      } else {
        levelEditorElements.note.textContent =
          'Click the preview to place anchors. Drag markers to adjust, or Shift-click to remove the nearest anchor.';
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
      levelEditorState.draggingIndex = nearest.index;
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
    const nextMode = mode && developerMapPlacementState.mode === mode ? null : mode;
    developerMapPlacementState.mode = nextMode;
    if (developerMapElements.addCrystalButton) {
      developerMapElements.addCrystalButton.classList.toggle(
        'developer-map-elements__button--active',
        developerMapPlacementState.mode === 'crystal',
      );
    }
    if (developerMapElements.note) {
      if (developerMapPlacementState.mode === 'crystal') {
        developerMapElements.note.hidden = false;
        developerMapElements.note.textContent =
          'Click the battlefield to anchor a solid crystal obstruction.';
      } else {
        developerMapElements.note.hidden = true;
        developerMapElements.note.textContent = '';
      }
    }
  }

  function placeDeveloperCrystal(normalized) {
    const playfield = getPlayfield();
    if (!playfield || typeof playfield.addDeveloperCrystal !== 'function') {
      setLevelEditorStatus('Active battlefield required before placing crystals.', { tone: 'warning' });
      return false;
    }
    const placed = playfield.addDeveloperCrystal(normalized);
    if (!placed) {
      setLevelEditorStatus('Crystal placement failed—ensure the click stays within the battlefield.', { tone: 'error' });
      return false;
    }
    setLevelEditorStatus('Solid crystal anchored—focus towers on it to stress-test fractures.', {
      tone: 'info',
      duration: 2800,
    });
    if (developerMapElements.note && developerMapPlacementState.mode === 'crystal') {
      developerMapElements.note.hidden = false;
      developerMapElements.note.textContent =
        'Crystal anchored. Click again to place another or toggle the tool to finish.';
    }
    return true;
  }

  function handleDeveloperMapPlacementRequest(context = {}) {
    if (developerMapPlacementState.mode !== 'crystal' || !isDeveloperModeActive()) {
      return false;
    }
    if (!context || !context.normalized) {
      return false;
    }
    if (!developerMapToolsActive) {
      return false;
    }
    return placeDeveloperCrystal(context.normalized);
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
    setDeveloperMapPlacementMode(null);
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
      setDeveloperMapPlacementMode(null);
      if (developerMapElements.note) {
        developerMapElements.note.hidden = true;
        developerMapElements.note.textContent = '';
      }
    } else if (developerMapElements.note && developerMapPlacementState.mode === 'crystal') {
      developerMapElements.note.hidden = false;
      developerMapElements.note.textContent =
        'Click the battlefield to anchor a solid crystal obstruction.';
    }
  }

  function initializeDeveloperMapElements() {
    developerMapElements.container = document.getElementById('developer-map-elements');
    developerMapElements.addCrystalButton = document.getElementById('developer-add-crystal');
    developerMapElements.clearButton = document.getElementById('developer-clear-crystals');
    developerMapElements.note = document.getElementById('developer-map-elements-note');

    if (developerMapElements.addCrystalButton) {
      developerMapElements.addCrystalButton.addEventListener('click', (event) => {
        event.preventDefault();
        if (!isDeveloperModeActive()) {
          setLevelEditorStatus('Enable developer mode to place map elements.', { tone: 'warning' });
          return;
        }
        setDeveloperMapPlacementMode('crystal');
      });
    }

    if (developerMapElements.clearButton) {
      developerMapElements.clearButton.addEventListener('click', (event) => {
        event.preventDefault();
        clearDeveloperCrystalsFromUI();
      });
    }

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
