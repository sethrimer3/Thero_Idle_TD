import { SimplePlayfield } from './playfield.js';
import { clampNormalizedCoordinate, transformPointFromOrientation } from './geometryHelpers.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Predefined level-preview outlines keyed by thematic descriptor tokens.
const PRESET_PREVIEW_PATHS = {
  lemniscate: [
    { x: 0.14, y: 0.52 },
    { x: 0.28, y: 0.28 },
    { x: 0.46, y: 0.2 },
    { x: 0.62, y: 0.3 },
    { x: 0.78, y: 0.5 },
    { x: 0.62, y: 0.7 },
    { x: 0.46, y: 0.8 },
    { x: 0.28, y: 0.72 },
    { x: 0.14, y: 0.48 },
  ],
  spiral: [
    { x: 0.12, y: 0.82 },
    { x: 0.28, y: 0.66 },
    { x: 0.46, y: 0.74 },
    { x: 0.66, y: 0.58 },
    { x: 0.54, y: 0.42 },
    { x: 0.6, y: 0.3 },
    { x: 0.76, y: 0.36 },
    { x: 0.88, y: 0.18 },
  ],
  cascade: [
    { x: 0.12, y: 0.8 },
    { x: 0.24, y: 0.68 },
    { x: 0.32, y: 0.5 },
    { x: 0.44, y: 0.6 },
    { x: 0.56, y: 0.44 },
    { x: 0.68, y: 0.54 },
    { x: 0.8, y: 0.36 },
    { x: 0.9, y: 0.22 },
  ],
  fork: [
    { x: 0.12, y: 0.82 },
    { x: 0.32, y: 0.58 },
    { x: 0.44, y: 0.38 },
    { x: 0.56, y: 0.52 },
    { x: 0.68, y: 0.32 },
    { x: 0.78, y: 0.46 },
    { x: 0.9, y: 0.26 },
  ],
  river: [
    { x: 0.08, y: 0.88 },
    { x: 0.22, y: 0.74 },
    { x: 0.38, y: 0.78 },
    { x: 0.54, y: 0.62 },
    { x: 0.68, y: 0.66 },
    { x: 0.82, y: 0.48 },
    { x: 0.92, y: 0.32 },
    { x: 0.96, y: 0.16 },
  ],
  petals: [
    { x: 0.14, y: 0.82 },
    { x: 0.32, y: 0.68 },
    { x: 0.42, y: 0.5 },
    { x: 0.36, y: 0.34 },
    { x: 0.5, y: 0.24 },
    { x: 0.64, y: 0.34 },
    { x: 0.6, y: 0.54 },
    { x: 0.74, y: 0.7 },
    { x: 0.88, y: 0.56 },
    { x: 0.92, y: 0.36 },
  ],
  lattice: [
    { x: 0.08, y: 0.84 },
    { x: 0.2, y: 0.66 },
    { x: 0.34, y: 0.7 },
    { x: 0.48, y: 0.5 },
    { x: 0.6, y: 0.58 },
    { x: 0.74, y: 0.38 },
    { x: 0.84, y: 0.46 },
    { x: 0.94, y: 0.22 },
  ],
  bridge: [
    { x: 0.08, y: 0.78 },
    { x: 0.26, y: 0.62 },
    { x: 0.4, y: 0.46 },
    { x: 0.54, y: 0.38 },
    { x: 0.7, y: 0.48 },
    { x: 0.82, y: 0.32 },
    { x: 0.94, y: 0.18 },
  ],
};

// Generate a deterministic preview path using the level identifier as the seed.
function buildSeededPreviewPath(seedValue) {
  const seedString = String(seedValue || 'preview');
  let hash = 0;
  for (let index = 0; index < seedString.length; index += 1) {
    hash = (hash * 33 + seedString.charCodeAt(index)) >>> 0;
  }
  let state = hash || 1;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  const points = [];
  const segments = 8;
  let x = 0.08 + random() * 0.1;
  let y = 0.2 + random() * 0.6;
  for (let step = 0; step < segments; step += 1) {
    points.push({ x: clampNormalizedCoordinate(x), y: clampNormalizedCoordinate(y) });
    x += 0.1 + random() * 0.12;
    y += (random() - 0.5) * 0.24;
    x = Math.min(0.92, Math.max(0.08, x));
    y = Math.min(0.88, Math.max(0.12, y));
  }
  return points;
}

// Select a preset preview path based on level descriptors when no explicit path is available.
function createProceduralPreviewPath(level) {
  if (!level) {
    return null;
  }
  const descriptor = `${level.path || ''} ${level.focus || ''}`.toLowerCase();
  const matches = [];
  const addMatch = (key) => {
    if (key && PRESET_PREVIEW_PATHS[key] && !matches.includes(key)) {
      matches.push(key);
    }
  };
  if (descriptor.includes('lemniscate') || descriptor.includes('∞') || descriptor.includes('loop')) {
    addMatch('lemniscate');
  }
  if (
    descriptor.includes('spiral') ||
    descriptor.includes('helix') ||
    descriptor.includes('fibonacci') ||
    descriptor.includes('logarithmic')
  ) {
    addMatch('spiral');
  }
  if (descriptor.includes('cascade') || descriptor.includes('step') || descriptor.includes('integral')) {
    addMatch('cascade');
  }
  if (descriptor.includes('fork') || descriptor.includes('dual') || descriptor.includes('twin')) {
    addMatch('fork');
  }
  if (descriptor.includes('river') || descriptor.includes('stream') || descriptor.includes('flow')) {
    addMatch('river');
  }
  if (descriptor.includes('petal') || descriptor.includes('flower') || descriptor.includes('lotus')) {
    addMatch('petals');
  }
  if (descriptor.includes('lattice') || descriptor.includes('grid') || descriptor.includes('matrix')) {
    addMatch('lattice');
  }
  if (descriptor.includes('bridge') || descriptor.includes('arch') || descriptor.includes('span')) {
    addMatch('bridge');
  }
  if (!matches.length) {
    return buildSeededPreviewPath(level.id);
  }
  const choiceIndex = Math.min(matches.length - 1, Math.max(0, Math.floor(level.id?.length ?? 0) % matches.length));
  return PRESET_PREVIEW_PATHS[matches[choiceIndex]];
}

// Retrieve preview-ready points from the level configuration or generate a fallback.
export function getPreviewPointsForLevel(level, levelConfigs) {
  if (!level) {
    return null;
  }
  const config = levelConfigs?.get(level.id);
  // Suppress track previews for radial-spawn trials that have no defined glyph lane.
  if (config?.radialSpawn && config?.centerSpawn) {
    return null;
  }
  if (config && Array.isArray(config.path) && config.path.length >= 2) {
    return config.path.map((point) => ({ x: point.x, y: point.y }));
  }
  return createProceduralPreviewPath(level);
}

// Create a sanitized DOM id for preview SVG assets.
function createPreviewId(prefix, value) {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${prefix}-${slug || 'preview'}`;
}

// Determine the preferred orientation for rendering overlay previews.
function resolvePreferredOrientation(playfield) {
  if (playfield) {
    if (playfield.levelActive && typeof playfield.layoutOrientation === 'string') {
      // Reuse the active battlefield orientation so previews mirror the current combat view.
      return playfield.layoutOrientation;
    }
    if (typeof playfield.determinePreferredOrientation === 'function') {
      // Fall back to the playfield's orientation heuristic when no level is active yet.
      const resolved = playfield.determinePreferredOrientation();
      if (resolved === 'landscape' || resolved === 'portrait') {
        return resolved;
      }
    }
    if (typeof playfield.layoutOrientation === 'string') {
      return playfield.layoutOrientation;
    }
  }
  if (typeof window !== 'undefined') {
    const width = Number.isFinite(window.innerWidth) ? window.innerWidth : 0;
    const height = Number.isFinite(window.innerHeight) ? window.innerHeight : 0;
    if (width > 0 && height > 0) {
      return width > height ? 'landscape' : 'portrait';
    }
  }
  return null;
}

// Factory that owns the level preview rendering lifecycle for the level overlay.
export function createLevelPreviewRenderer({
  getOverlayElement,
  getOverlayPreviewElement,
  getLevelConfigs,
  getPlayfield,
  playfieldElements,
  isDeveloperModeActive,
  getActiveLevelId,
  isActiveLevelInteractive,
  setOverlayPreviewLevel,
  hideLevelEditorPanel,
  resetLevelEditorSurface,
  setLevelEditorSurface,
  configureLevelEditorForLevel,
}) {
  let overlayPreviewCanvas = null;
  let previewPlayfield = null;

  // Convenience accessor that guarantees the latest overlay preview element.
  const getOverlayPreview = () => {
    const element = typeof getOverlayPreviewElement === 'function' ? getOverlayPreviewElement() : null;
    return element || null;
  };

  // Remove any rendered preview assets and reset developer editor bindings.
  function clearPreview() {
    const overlayPreview = getOverlayPreview();
    if (!overlayPreview) {
      return;
    }

    hideLevelEditorPanel();
    setOverlayPreviewLevel(null);
    resetLevelEditorSurface();

    if (previewPlayfield) {
      previewPlayfield.leaveLevel();
      previewPlayfield = null;
    }

    overlayPreview.innerHTML = '';
    overlayPreviewCanvas = null;
    overlayPreview.setAttribute('aria-hidden', 'true');
    overlayPreview.hidden = true;
    overlayPreview.classList.remove('overlay-preview--active');
  }

  // Render the appropriate overlay preview for the provided level card.
  function renderPreview(level) {
    const overlayPreview = getOverlayPreview();
    if (!overlayPreview) {
      return;
    }

    clearPreview();
    setOverlayPreviewLevel(level || null);

    const levelConfigs = typeof getLevelConfigs === 'function' ? getLevelConfigs() : null;
    const config = level && levelConfigs ? levelConfigs.get(level.id) : null;
    const hasInteractivePath = Boolean(config && Array.isArray(config.path) && config.path.length >= 2);

    const overlayElement = typeof getOverlayElement === 'function' ? getOverlayElement() : null;
    const developerOverlayActive = overlayElement?.dataset?.overlayMode === 'developer';

    const playfield = typeof getPlayfield === 'function' ? getPlayfield() : null;
    const activeLevelId = typeof getActiveLevelId === 'function' ? getActiveLevelId() : null;
    const developerModeActive = typeof isDeveloperModeActive === 'function' ? isDeveloperModeActive() : false;
    const activeLevelInteractive = typeof isActiveLevelInteractive === 'function'
      ? isActiveLevelInteractive()
      : false;

    const canUseActiveBattlefield = Boolean(
      developerOverlayActive &&
        developerModeActive &&
        hasInteractivePath &&
        playfield &&
        playfield.levelActive &&
        playfield.levelConfig &&
        activeLevelInteractive &&
        level &&
        level.id === activeLevelId &&
        playfieldElements?.canvas,
    );

    if (canUseActiveBattlefield) {
      const battlefieldCanvas = playfieldElements?.canvas || playfield?.canvas || null;
      const orientation = playfield.layoutOrientation || 'portrait';
      setLevelEditorSurface({
        type: 'playfield',
        canvas: battlefieldCanvas,
        playfield,
        orientation,
        listenerOptions: true,
      });

      overlayPreview.hidden = false;
      overlayPreview.setAttribute('aria-hidden', 'false');
      overlayPreview.classList.add('overlay-preview--active');

      const message = document.createElement('p');
      message.className = 'overlay-preview__empty';
      message.textContent =
        'Developer map tools active—adjust anchors directly on the battlefield. Shift-click to remove the nearest anchor.';
      overlayPreview.append(message);

      let basePath = Array.isArray(playfield.basePathPoints) && playfield.basePathPoints.length >= 2
        ? playfield.basePathPoints
        : null;
      if (!basePath && Array.isArray(playfield.levelConfig?.path) && playfield.levelConfig.path.length >= 2) {
        basePath = playfield.levelConfig.path.map((point) => transformPointFromOrientation(point, orientation));
      }
      if (!basePath && hasInteractivePath) {
        basePath = config.path;
      }

      if (Array.isArray(basePath) && basePath.length >= 2) {
        configureLevelEditorForLevel(level, { path: basePath }, { orientation, basePath });
      } else {
        hideLevelEditorPanel();
      }
      return;
    }

    const preferredOrientation = resolvePreferredOrientation(playfield);

    if (hasInteractivePath) {
      overlayPreviewCanvas = document.createElement('canvas');
      overlayPreviewCanvas.className = 'overlay-preview__canvas';
      overlayPreviewCanvas.setAttribute('aria-label', `${level?.title || 'Defense'} path preview`);
      overlayPreviewCanvas.setAttribute('role', 'img');
      overlayPreview.append(overlayPreviewCanvas);

      overlayPreview.hidden = false;
      overlayPreview.setAttribute('aria-hidden', 'false');
      overlayPreview.classList.add('overlay-preview--active');

      previewPlayfield = new SimplePlayfield({
        canvas: overlayPreviewCanvas,
        container: overlayPreview,
        previewOnly: true,
        preferredOrientation,
      });
      previewPlayfield.enterLevel(level, { endlessMode: false });
      previewPlayfield.draw();
      return;
    }

    const points = getPreviewPointsForLevel(level, levelConfigs);
    if (!Array.isArray(points) || points.length < 2) {
      const placeholder = document.createElement('p');
      placeholder.className = 'overlay-preview__empty';
      placeholder.textContent = 'Map preview will unlock once the defense is charted.';
      overlayPreview.append(placeholder);
      overlayPreview.hidden = false;
      overlayPreview.setAttribute('aria-hidden', 'false');
      overlayPreview.classList.add('overlay-preview--active');
      return;
    }

    const viewBoxWidth = 1200;
    const viewBoxHeight = 720;
    const margin = 90;

    const shouldRotate = preferredOrientation === 'landscape';
    const transformPoint = (point) => {
      const normalized = {
        x: clampNormalizedCoordinate(point.x),
        y: clampNormalizedCoordinate(point.y),
      };
      if (shouldRotate) {
        return {
          x: normalized.y,
          y: 1 - normalized.x,
        };
      }
      return normalized;
    };

    const scalePoint = (point) => ({
      x: margin + point.x * (viewBoxWidth - margin * 2),
      y: margin + point.y * (viewBoxHeight - margin * 2),
    });

    const scaledPoints = points.map((point) =>
      scalePoint(transformPoint({ x: point?.x ?? 0.5, y: point?.y ?? 0.5 })),
    );
    const pathData = scaledPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');

    const gradientId = createPreviewId('preview-gradient', level?.id || 'level');
    const haloId = createPreviewId('preview-halo', level?.id || 'level');

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
    svg.setAttribute('class', 'overlay-preview__svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${level?.title || 'Defense'} path preview`);

    const defs = document.createElementNS(SVG_NS, 'defs');
    const gradient = document.createElementNS(SVG_NS, 'linearGradient');
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '100%');
    const stopStart = document.createElementNS(SVG_NS, 'stop');
    stopStart.setAttribute('offset', '0%');
    stopStart.setAttribute('stop-color', 'rgba(124, 198, 255, 0.92)');
    const stopEnd = document.createElementNS(SVG_NS, 'stop');
    stopEnd.setAttribute('offset', '100%');
    stopEnd.setAttribute('stop-color', 'rgba(240, 180, 150, 0.92)');
    gradient.append(stopStart, stopEnd);

    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', haloId);
    const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
    blur.setAttribute('stdDeviation', '24');
    blur.setAttribute('in', 'SourceGraphic');
    blur.setAttribute('result', 'blurred');
    const merge = document.createElementNS(SVG_NS, 'feMerge');
    const mergeBlur = document.createElementNS(SVG_NS, 'feMergeNode');
    mergeBlur.setAttribute('in', 'blurred');
    const mergeSource = document.createElementNS(SVG_NS, 'feMergeNode');
    mergeSource.setAttribute('in', 'SourceGraphic');
    merge.append(mergeBlur, mergeSource);
    filter.append(blur, merge);

    defs.append(gradient, filter);
    svg.append(defs);

    const backdrop = document.createElementNS(SVG_NS, 'rect');
    backdrop.setAttribute('x', '0');
    backdrop.setAttribute('y', '0');
    backdrop.setAttribute('width', viewBoxWidth);
    backdrop.setAttribute('height', viewBoxHeight);
    backdrop.setAttribute('fill', 'rgba(6, 10, 18, 0.96)');
    svg.append(backdrop);

    const frame = document.createElementNS(SVG_NS, 'rect');
    frame.setAttribute('x', (margin * 2) / 5);
    frame.setAttribute('y', (margin * 2) / 5);
    frame.setAttribute('width', viewBoxWidth - (margin * 4) / 5);
    frame.setAttribute('height', viewBoxHeight - (margin * 4) / 5);
    frame.setAttribute('rx', '60');
    frame.setAttribute('fill', 'rgba(12, 16, 30, 0.92)');
    frame.setAttribute('stroke', 'rgba(255, 255, 255, 0.06)');
    frame.setAttribute('stroke-width', '8');
    svg.append(frame);

    const field = document.createElementNS(SVG_NS, 'rect');
    field.setAttribute('x', margin);
    field.setAttribute('y', margin);
    field.setAttribute('width', viewBoxWidth - margin * 2);
    field.setAttribute('height', viewBoxHeight - margin * 2);
    field.setAttribute('rx', '48');
    field.setAttribute('fill', 'rgba(18, 24, 42, 0.92)');
    field.setAttribute('stroke', 'rgba(255, 255, 255, 0.08)');
    field.setAttribute('stroke-width', '6');
    svg.append(field);

    const gridGroup = document.createElementNS(SVG_NS, 'g');
    gridGroup.setAttribute('stroke', 'rgba(255, 255, 255, 0.04)');
    gridGroup.setAttribute('stroke-width', '2');
    const gridSpacing = 140;
    for (let x = Math.round(margin); x <= viewBoxWidth - margin; x += gridSpacing) {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', margin);
      line.setAttribute('x2', x);
      line.setAttribute('y2', viewBoxHeight - margin);
      gridGroup.append(line);
    }
    for (let y = Math.round(margin); y <= viewBoxHeight - margin; y += gridSpacing) {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', margin);
      line.setAttribute('y1', y);
      line.setAttribute('x2', viewBoxWidth - margin);
      line.setAttribute('y2', y);
      gridGroup.append(line);
    }
    svg.append(gridGroup);

    const basePath = document.createElementNS(SVG_NS, 'path');
    basePath.setAttribute('d', pathData);
    basePath.setAttribute('fill', 'none');
    basePath.setAttribute('stroke', 'rgba(94, 134, 220, 0.28)');
    basePath.setAttribute('stroke-width', '70');
    basePath.setAttribute('stroke-linecap', 'round');
    basePath.setAttribute('stroke-linejoin', 'round');
    svg.append(basePath);

    const lanePath = document.createElementNS(SVG_NS, 'path');
    lanePath.setAttribute('d', pathData);
    lanePath.setAttribute('fill', 'none');
    lanePath.setAttribute('stroke', `url(#${gradientId})`);
    lanePath.setAttribute('stroke-width', '44');
    lanePath.setAttribute('stroke-linecap', 'round');
    lanePath.setAttribute('stroke-linejoin', 'round');
    lanePath.setAttribute('filter', `url(#${haloId})`);
    svg.append(lanePath);

    const anchorsList = Array.isArray(config?.autoAnchors) ? config.autoAnchors : [];
    if (anchorsList.length) {
      const anchorGroup = document.createElementNS(SVG_NS, 'g');
      anchorsList.forEach((anchor) => {
        const scaled = scalePoint(transformPoint({ x: anchor?.x ?? 0.5, y: anchor?.y ?? 0.5 }));
        const outer = document.createElementNS(SVG_NS, 'circle');
        outer.setAttribute('cx', scaled.x);
        outer.setAttribute('cy', scaled.y);
        outer.setAttribute('r', '28');
        outer.setAttribute('fill', 'rgba(255, 204, 150, 0.92)');
        outer.setAttribute('stroke', 'rgba(255, 255, 255, 0.9)');
        outer.setAttribute('stroke-width', '6');
        anchorGroup.append(outer);
        const inner = document.createElementNS(SVG_NS, 'circle');
        inner.setAttribute('cx', scaled.x);
        inner.setAttribute('cy', scaled.y);
        inner.setAttribute('r', '12');
        inner.setAttribute('fill', 'rgba(255, 255, 255, 0.92)');
        anchorGroup.append(inner);
      });
      svg.append(anchorGroup);
    }

    const startPoint = scaledPoints[0];
    const endPoint = scaledPoints[scaledPoints.length - 1];
    const startMarker = document.createElementNS(SVG_NS, 'circle');
    startMarker.setAttribute('cx', startPoint.x);
    startMarker.setAttribute('cy', startPoint.y);
    startMarker.setAttribute('r', '20');
    startMarker.setAttribute('fill', 'rgba(120, 210, 255, 0.95)');
    startMarker.setAttribute('stroke', 'rgba(255, 255, 255, 0.9)');
    startMarker.setAttribute('stroke-width', '5');
    svg.append(startMarker);

    const endMarker = document.createElementNS(SVG_NS, 'circle');
    endMarker.setAttribute('cx', endPoint.x);
    endMarker.setAttribute('cy', endPoint.y);
    endMarker.setAttribute('r', '24');
    endMarker.setAttribute('fill', 'rgba(255, 170, 130, 0.95)');
    endMarker.setAttribute('stroke', 'rgba(255, 255, 255, 0.9)');
    endMarker.setAttribute('stroke-width', '6');
    svg.append(endMarker);

    overlayPreview.append(svg);
    overlayPreview.hidden = false;
    overlayPreview.setAttribute('aria-hidden', 'false');
    overlayPreview.classList.add('overlay-preview--active');
  }

  return {
    render: renderPreview,
    clear: clearPreview,
  };
}
