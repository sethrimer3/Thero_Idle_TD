/**
 * Shin Spire UI Management
 * 
 * Handles the UI for the Shin Spire, including fractal tabs, iteron display,
 * and layer progress visualization.
 */

import {
  getFractalDefinitions,
  getFractalState,
  getActiveFractalId,
  setActiveFractal,
  getIteronBank,
  getIterationRate,
  getShinGlyphs,
  getLayerProgress,
  allocateIterons
} from './shinState.js';

import { formatGameNumber } from '../scripts/core/formatting.js';
import { FractalTreeSimulation } from '../scripts/features/towers/fractalTreeSimulation.js';
import { KochSnowflakeSimulation } from '../scripts/features/towers/kochSnowflakeSimulation.js';
import { FernLSystemSimulation } from '../scripts/features/towers/fernLSystemSimulation.js';
import { DragonCurveSimulation } from '../scripts/features/towers/dragonCurveSimulation.js';
import { VoronoiSubdivisionSimulation } from '../scripts/features/towers/voronoiSubdivisionSimulation.js';
import { BrownianTreeSimulation } from '../scripts/features/towers/brownianTreeSimulation.js';
import { FlameFractalSimulation } from '../scripts/features/towers/flameFractalSimulation.js';
import { getShinVisualSettings } from './shinSpirePreferences.js';
import {
  getEnemyCodexEntries,
  codexState,
  onEnemyEncounter
} from './codex.js';

let shinElements = {};
let activeFractalTabId = null;
let updateCallback = null;
let fractalSimulations = new Map(); // Store simulation instances keyed by fractal ID
let animationFrameId = null;
let fractalResizeObserver = null;
let enemyEncounterUnsubscribe = null;

function resolveShinMaxDevicePixelRatio() {
  const { graphicsLevel } = getShinVisualSettings();
  if (graphicsLevel === 'low') {
    return 1.1;
  }
  if (graphicsLevel === 'medium') {
    return 1.35;
  }
  return 1.5;
}

const FRACTAL_RENDER_HANDLERS = new Map([
  ['tree', {
    create: (canvas, fractal, state) => new FractalTreeSimulation({
      canvas,
      ...fractal.config,
      maxDepth: Math.min(fractal.config?.maxDepth || 9, 6 + (state?.layersCompleted || 0)),
      allocated: state?.allocated || 0
    }),
    update: (simulation, fractal, state) => {
      simulation.updateConfig({
        maxDepth: Math.min(fractal.config?.maxDepth || 9, 6 + (state?.layersCompleted || 0)),
        allocated: state?.allocated || 0
      });
    }
  }],
  ['koch', {
    create: (canvas, fractal, state) => new KochSnowflakeSimulation({
      canvas,
      ...fractal.config,
      iterations: Math.min(fractal.config?.iterations || 4, 2 + (state?.layersCompleted || 0)),
      allocated: state?.allocated || 0
    }),
    update: (simulation, fractal, state) => {
      simulation.updateConfig({
        iterations: Math.min(fractal.config?.iterations || 4, 2 + (state?.layersCompleted || 0)),
        allocated: state?.allocated || 0
      });
    }
  }],
  ['fern', {
    create: (canvas, fractal, state) => {
      const simulation = new FernLSystemSimulation({
        canvas,
        ...fractal.config
      });
      simulation.updateConfig({
        segmentLength: fractal.config?.segmentLength || 5,
        layersCompleted: state?.layersCompleted || 0,
        allocated: state?.allocated || 0
      });
      return simulation;
    },
    update: (simulation, fractal, state) => {
      simulation.updateConfig({
        segmentLength: fractal.config?.segmentLength || 5,
        layersCompleted: state?.layersCompleted || 0,
        allocated: state?.allocated || 0
      });
    }
  }],
  ['dragon', {
    create: (canvas, fractal, state) => new DragonCurveSimulation({
      canvas,
      ...fractal.config,
      iterations: Math.min(fractal.config?.iterations || 10, 6 + (state?.layersCompleted || 0)),
      allocated: state?.allocated || 0
    }),
    update: (simulation, fractal, state) => {
      simulation.updateConfig({
        iterations: Math.min(fractal.config?.iterations || 10, 6 + (state?.layersCompleted || 0)),
        allocated: state?.allocated || 0
      });
    }
  }],
  ['voronoi', {
    create: (canvas, fractal, state) => {
      const simulation = new VoronoiSubdivisionSimulation({
        canvas,
        ...fractal.config
      });
      simulation.updateConfig({
        allocated: state?.allocated || 0
      });
      return simulation;
    },
    update: (simulation, fractal, state) => {
      simulation.updateConfig({
        allocated: state?.allocated || 0
      });
    }
  }],
  ['brownian', {
    create: (canvas, fractal, state) => {
      const simulation = new BrownianTreeSimulation({
        canvas,
        ...fractal.config
      });
      simulation.updateConfig({
        allocated: state?.allocated || 0
      });
      return simulation;
    },
    update: (simulation, fractal, state) => {
      simulation.updateConfig({
        allocated: state?.allocated || 0
      });
    }
  }],
  ['flame', {
    create: (canvas, fractal, state) => {
      const simulation = new FlameFractalSimulation({
        canvas,
        ...fractal.config
      });
      simulation.updateConfig({
        allocated: state?.allocated || 0,
        samplesPerIteron: fractal.config?.samplesPerIteron || 8000
      });
      return simulation;
    },
    update: (simulation, fractal, state) => {
      simulation.updateConfig({
        allocated: state?.allocated || 0,
        samplesPerIteron: fractal.config?.samplesPerIteron || 8000
      });
    }
  }]
]);

/**
 * Initialize the Shin Spire UI
 */
export function initializeShinUI() {
  // Cache DOM elements
  shinElements = {
    iteronBank: document.getElementById('shin-iteron-bank'),
    iterationRate: document.getElementById('shin-iteration-rate'),
    shinGlyphs: document.getElementById('shin-glyph-count'),
    fractalTabs: document.getElementById('shin-fractal-tabs'),
    fractalContent: document.getElementById('shin-fractal-content'),
    fractalDetails: document.getElementById('shin-fractal-details'),
    layerProgress: document.getElementById('shin-layer-progress'),
    layerProgressBar: document.getElementById('shin-layer-progress-bar'),
    layerProgressText: document.getElementById('shin-layer-progress-text'),
    totalIterons: document.getElementById('shin-total-iterons'),
    enemyAlmanacToggle: document.getElementById('shin-enemy-almanac-toggle'),
    enemyAlmanacContent: document.getElementById('shin-enemy-almanac-content'),
    enemyAlmanacList: document.getElementById('shin-enemy-almanac-list'),
    enemyAlmanacEmpty: document.getElementById('shin-enemy-almanac-empty')
  };

  // Set up enemy almanac toggle
  if (shinElements.enemyAlmanacToggle && shinElements.enemyAlmanacContent) {
    shinElements.enemyAlmanacToggle.addEventListener('click', toggleEnemyAlmanac);
  }
  
  // Subscribe to enemy encounter events to refresh the almanac
  if (enemyEncounterUnsubscribe) {
    enemyEncounterUnsubscribe();
  }
  enemyEncounterUnsubscribe = onEnemyEncounter(() => {
    renderEnemyAlmanac();
  });

  // Observe layout changes so fractal canvases can follow the responsive container size.
  if (!fractalResizeObserver && typeof ResizeObserver === 'function' && shinElements.fractalContent) {
    fractalResizeObserver = new ResizeObserver(() => {
      resizeShinFractalCanvases();
    });
    fractalResizeObserver.observe(shinElements.fractalContent);
  }

  renderFractalTabs();
  selectFractalTab(getActiveFractalId());
  updateShinDisplay();
  renderEnemyAlmanac();
  
  // Start animation loop for fractal rendering
  startAnimationLoop();
}

/**
 * Set a callback to be invoked when the UI needs to trigger an update
 */
export function setShinUIUpdateCallback(callback) {
  updateCallback = callback;
}

/**
 * Render the fractal tabs
 */
function renderFractalTabs() {
  const fractals = getFractalDefinitions();
  const tabsContainer = shinElements.fractalTabs;
  
  if (!tabsContainer) {
    return;
  }
  
  tabsContainer.innerHTML = '';
  
  fractals.forEach(fractal => {
    const state = getFractalState(fractal.id);
    if (!state) {
      return;
    }
    
    const tab = document.createElement('button');
    tab.className = 'shin-fractal-tab';
    tab.dataset.fractalId = fractal.id;
    tab.type = 'button';
    
    if (!state.unlocked) {
      tab.classList.add('shin-fractal-tab--locked');
      tab.disabled = true;
    }
    
    if (fractal.id === activeFractalTabId) {
      tab.classList.add('shin-fractal-tab--active');
      tab.setAttribute('aria-selected', 'true');
    } else {
      tab.setAttribute('aria-selected', 'false');
    }
    
    const tabName = document.createElement('span');
    tabName.className = 'shin-fractal-tab-name';
    tabName.textContent = fractal.name;
    
    const tabLayers = document.createElement('span');
    tabLayers.className = 'shin-fractal-tab-layers';
    tabLayers.textContent = state.unlocked 
      ? `Layer ${state.layersCompleted}`
      : 'Locked';
    
    const tabIterons = document.createElement('span');
    tabIterons.className = 'shin-fractal-tab-iterons';
    tabIterons.textContent = state.unlocked && state.allocated > 0
      ? `${formatGameNumber(state.allocated)} ℸ`
      : '';
    
    tab.appendChild(tabName);
    tab.appendChild(tabLayers);
    tab.appendChild(tabIterons);
    
    if (state.unlocked) {
      tab.addEventListener('click', () => {
        selectFractalTab(fractal.id);
        if (updateCallback) {
          updateCallback();
        }
      });
    }
    
    tabsContainer.appendChild(tab);
  });
}

/**
 * Select a fractal tab and update the UI
 */
function selectFractalTab(fractalId) {
  const fractals = getFractalDefinitions();
  const fractal = fractals.find(f => f.id === fractalId);
  const state = getFractalState(fractalId);
  
  if (!fractal || !state || !state.unlocked) {
    return;
  }
  
  // Update active tab ID
  activeFractalTabId = fractalId;
  setActiveFractal(fractalId);
  
  // Update tab button states
  const tabs = document.querySelectorAll('.shin-fractal-tab');
  tabs.forEach(tab => {
    if (tab.dataset.fractalId === fractalId) {
      tab.classList.add('shin-fractal-tab--active');
      tab.setAttribute('aria-selected', 'true');
    } else {
      tab.classList.remove('shin-fractal-tab--active');
      tab.setAttribute('aria-selected', 'false');
    }
  });
  
  // Update content area
  renderFractalContent(fractal, state);
  updateLayerProgress(fractalId);
}

/**
 * Render the content for the selected fractal
 */
function renderFractalContent(fractal, state) {
  const contentContainer = shinElements.fractalContent;
  const detailsContainer = shinElements.fractalDetails;
  
  if (!contentContainer) {
    return;
  }
  
  // Clear any existing simulation for this fractal since we're recreating the canvas
  if (fractalSimulations.has(fractal.id)) {
    fractalSimulations.delete(fractal.id);
  }
  
  contentContainer.innerHTML = '';
  
  // Add canvas for fractal visualization (in the content area)
  const canvasWrapper = document.createElement('div');
  canvasWrapper.className = 'shin-fractal-canvas-wrapper';
  
  const canvas = document.createElement('canvas');
  canvas.id = `shin-fractal-canvas-${fractal.id}`;
  canvas.className = 'shin-fractal-canvas';
  canvas.width = 240;
  canvas.height = 360;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${fractal.name} visualization`);
  
  canvasWrapper.appendChild(canvas);
  contentContainer.appendChild(canvasWrapper);
  
  // Add pointer interaction handler to allocate 1 Iteron when the fractal is tapped.
  const handleFractalTap = () => {
    allocateIterons(fractal.id, 1);
    if (updateCallback) {
      updateCallback();
    }
  };

  canvas.addEventListener('click', handleFractalTap);
  canvas.addEventListener('fractalcanvas:tap', handleFractalTap);
  
  // Render fractal details below the Layer Progress bar
  if (detailsContainer) {
    detailsContainer.innerHTML = '';
    
    const header = document.createElement('div');
    header.className = 'shin-fractal-header';
    
    const title = document.createElement('h3');
    title.className = 'shin-fractal-title';
    title.textContent = fractal.name;
    
    const description = document.createElement('p');
    description.className = 'shin-fractal-description';
    description.textContent = fractal.description;
    
    const stats = document.createElement('div');
    stats.className = 'shin-fractal-stats';
    
    const allocatedStat = document.createElement('div');
    allocatedStat.className = 'shin-fractal-stat';
    const allocatedLabel = document.createElement('span');
    allocatedLabel.className = 'shin-fractal-stat-label';
    allocatedLabel.textContent = 'Iterons Allocated';
    const allocatedValue = document.createElement('span');
    allocatedValue.className = 'shin-fractal-stat-value';
    allocatedValue.textContent = formatGameNumber(state.allocated);
    allocatedStat.appendChild(allocatedLabel);
    allocatedStat.appendChild(allocatedValue);
    
    const layersStat = document.createElement('div');
    layersStat.className = 'shin-fractal-stat';
    const layersLabel = document.createElement('span');
    layersLabel.className = 'shin-fractal-stat-label';
    layersLabel.textContent = 'Layers Completed';
    const layersValue = document.createElement('span');
    layersValue.className = 'shin-fractal-stat-value';
    layersValue.textContent = `${state.layersCompleted} / ${fractal.layerThresholds.length}`;
    layersStat.appendChild(layersLabel);
    layersStat.appendChild(layersValue);
    
    stats.appendChild(allocatedStat);
    stats.appendChild(layersStat);
    
    header.appendChild(title);
    header.appendChild(description);
    header.appendChild(stats);
    
    detailsContainer.appendChild(header);
  }

  resizeShinFractalCanvases();

  // Add zoom controls
  let userZoom = 1.0;
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 3.0;
  
  // Mouse wheel zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * 0.1;
    userZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, userZoom + delta));
  }, { passive: false });
  
  // Touch zoom (pinch)
  let lastTouchDistance = null;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
    }
  }, { passive: true });
  
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && lastTouchDistance) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const delta = (distance - lastTouchDistance) / 100;
      userZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, userZoom + delta));
      lastTouchDistance = distance;
    }
  }, { passive: false });
  
  canvas.addEventListener('touchend', () => {
    lastTouchDistance = null;
  }, { passive: true });
  
  // Store user zoom on canvas for use in rendering
  canvas.dataset.userZoom = userZoom.toString();
  canvas.addEventListener('wheel', () => {
    canvas.dataset.userZoom = userZoom.toString();
  });
  canvas.addEventListener('touchmove', () => {
    canvas.dataset.userZoom = userZoom.toString();
  });
  
  // Create fractal simulation after canvas is in DOM
  requestAnimationFrame(() => {
    if (FRACTAL_RENDER_HANDLERS.has(fractal.renderType)) {
      getOrCreateFractalSimulation(fractal);
    }
  });
}

/**
 * Resize all active Shin fractal canvases to match their responsive wrappers.
 */
export function resizeShinFractalCanvases() {
  if (!shinElements.fractalContent) {
    return;
  }

  const wrappers = shinElements.fractalContent.querySelectorAll('.shin-fractal-canvas-wrapper');
  // Clamp device pixel ratio so fractal canvases render at a capped resolution per graphics preset.
  const dpr = Math.min(window.devicePixelRatio || 1, resolveShinMaxDevicePixelRatio());

  wrappers.forEach((wrapper) => {
    const canvas = wrapper.querySelector('canvas');
    if (!canvas) {
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    const targetWidth = Math.max(1, Math.round(cssWidth * dpr));
    const targetHeight = Math.max(1, Math.round(cssHeight * dpr));

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const fractalId = canvas.id.replace('shin-fractal-canvas-', '');
      const simulation = fractalSimulations.get(fractalId);
      if (simulation) {
        if (typeof simulation.resize === 'function') {
          simulation.resize(targetWidth, targetHeight);
        } else if (typeof simulation.reset === 'function') {
          simulation.reset();
        }
      }
    }
  });
}

/**
 * Update the layer progress display
 */
function updateLayerProgress(fractalId) {
  const progress = getLayerProgress(fractalId);
  
  if (!progress || !shinElements.layerProgressBar || !shinElements.layerProgressText) {
    return;
  }
  
  if (progress.complete) {
    shinElements.layerProgressBar.style.width = '100%';
    shinElements.layerProgressText.textContent = 'All layers complete!';
  } else {
    const percentage = Number.isFinite(progress.percentage) ? progress.percentage : 0;
    shinElements.layerProgressBar.style.width = `${percentage}%`;
    shinElements.layerProgressText.textContent = `Layer ${progress.layer + 1}: ${formatGameNumber(progress.current)} / ${formatGameNumber(progress.next)} (${percentage.toFixed(1)}%)`;
  }
}

/**
 * Update all Shin display elements
 */
export function updateShinDisplay() {
  // Update resource displays
  if (shinElements.iteronBank) {
    shinElements.iteronBank.textContent = formatGameNumber(getIteronBank());
  }
  
  // Update the visible total iterons display in the stats panel
  if (shinElements.totalIterons) {
    shinElements.totalIterons.textContent = `${formatGameNumber(getIteronBank())} ℸ`;
  }
  
  if (shinElements.iterationRate) {
    shinElements.iterationRate.textContent = `${getIterationRate().toFixed(2)}/sec`;
  }
  
  if (shinElements.shinGlyphs) {
    shinElements.shinGlyphs.textContent = `${formatGameNumber(getShinGlyphs())} ש`;
  }
  
  // Update active fractal progress
  if (activeFractalTabId) {
    updateLayerProgress(activeFractalTabId);
  }
  
  // Update tab displays
  const tabs = document.querySelectorAll('.shin-fractal-tab');
  tabs.forEach(tab => {
    const fractalId = tab.dataset.fractalId;
    const state = getFractalState(fractalId);
    if (state && state.unlocked) {
      const layersElement = tab.querySelector('.shin-fractal-tab-layers');
      if (layersElement) {
        layersElement.textContent = `Layer ${state.layersCompleted}`;
      }
      const iteronsElement = tab.querySelector('.shin-fractal-tab-iterons');
      if (iteronsElement) {
        iteronsElement.textContent = state.allocated > 0
          ? `${formatGameNumber(state.allocated)} ℸ`
          : '';
      }
    }
  });
}

/**
 * Refresh the fractal tabs (used when unlocks occur)
 */
export function refreshFractalTabs() {
  renderFractalTabs();
  if (activeFractalTabId) {
    selectFractalTab(activeFractalTabId);
  }
}

/**
 * Create or get a fractal simulation for a given fractal
 */
function getOrCreateFractalSimulation(fractal) {
  const handler = FRACTAL_RENDER_HANDLERS.get(fractal.renderType);
  if (!handler) {
    return null;
  }

  if (fractalSimulations.has(fractal.id)) {
    const existingSimulation = fractalSimulations.get(fractal.id);
    if (handler.update) {
      handler.update(existingSimulation, fractal, getFractalState(fractal.id));
    }
    return existingSimulation;
  }

  const canvas = document.getElementById(`shin-fractal-canvas-${fractal.id}`);
  if (!canvas) {
    return null;
  }

  if (fractal.config?.width) {
    canvas.width = fractal.config.width;
  }
  if (fractal.config?.height) {
    canvas.height = fractal.config.height;
  }

  const state = getFractalState(fractal.id);
  const simulation = handler.create(canvas, fractal, state);
  fractalSimulations.set(fractal.id, simulation);
  return simulation;
}

/**
 * Start the animation loop for fractal rendering
 */
function startAnimationLoop() {
  if (animationFrameId) {
    return; // Already running
  }
  
  function animate() {
    // Update and render active fractal
    if (activeFractalTabId) {
      const fractal = getFractalDefinitions().find(f => f.id === activeFractalTabId);
      if (fractal && FRACTAL_RENDER_HANDLERS.has(fractal.renderType)) {
        const simulation = getOrCreateFractalSimulation(fractal);
        if (simulation) {
          simulation.update();
          simulation.render();
        }
      }
    }
    
    animationFrameId = requestAnimationFrame(animate);
  }
  
  animate();
}

/**
 * Stop the animation loop
 */
export function stopAnimationLoop() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

/**
 * Update fractal simulation parameters based on layer progress
 */
export function updateFractalSimulation() {
  if (!activeFractalTabId) {
    return;
  }
  
  const fractal = getFractalDefinitions().find(f => f.id === activeFractalTabId);
  const state = getFractalState(activeFractalTabId);
  
  if (!fractal || !state) {
    return;
  }
  
  const simulation = fractalSimulations.get(activeFractalTabId);
  const handler = FRACTAL_RENDER_HANDLERS.get(fractal.renderType);

  if (simulation && handler && handler.update) {
    handler.update(simulation, fractal, state);
  }
}

/**
 * Toggle the Enemy Almanac dropdown
 */
function toggleEnemyAlmanac() {
  if (!shinElements.enemyAlmanacToggle || !shinElements.enemyAlmanacContent) {
    return;
  }
  
  const isExpanded = shinElements.enemyAlmanacToggle.getAttribute('aria-expanded') === 'true';
  
  if (isExpanded) {
    shinElements.enemyAlmanacToggle.setAttribute('aria-expanded', 'false');
    shinElements.enemyAlmanacContent.hidden = true;
  } else {
    shinElements.enemyAlmanacToggle.setAttribute('aria-expanded', 'true');
    shinElements.enemyAlmanacContent.hidden = false;
    renderEnemyAlmanac(); // Refresh the list when opening
  }
}

/**
 * Render the Enemy Almanac with encountered enemies
 */
function renderEnemyAlmanac() {
  if (!shinElements.enemyAlmanacList || !shinElements.enemyAlmanacEmpty) {
    return;
  }
  
  const allEnemies = getEnemyCodexEntries();
  const encounteredIds = codexState.encounteredEnemies;
  
  // Check if developer mode is enabled
  const developerMode = typeof window !== 'undefined' && 
    localStorage.getItem('glyph-defense-idle:developer-mode') === 'true';
  
  // Filter to show encountered enemies or all if developer mode
  const enemiesToShow = developerMode 
    ? allEnemies 
    : allEnemies.filter(enemy => encounteredIds.has(enemy.id));
  
  // Clear the list
  shinElements.enemyAlmanacList.innerHTML = '';
  
  // Show/hide empty message
  if (enemiesToShow.length === 0) {
    shinElements.enemyAlmanacEmpty.hidden = false;
    return;
  }
  
  shinElements.enemyAlmanacEmpty.hidden = true;
  
  // Create enemy entries
  enemiesToShow.forEach(enemy => {
    const isEncountered = encounteredIds.has(enemy.id);
    const entry = createEnemyEntry(enemy, isEncountered);
    shinElements.enemyAlmanacList.appendChild(entry);
  });
}

/**
 * Create a single enemy entry element
 */
function createEnemyEntry(enemy, isEncountered) {
  const entry = document.createElement('div');
  entry.className = 'shin-enemy-entry';
  if (!isEncountered) {
    entry.classList.add('shin-enemy-entry--unknown');
  }
  entry.setAttribute('role', 'listitem');
  
  // Header with icon and basic info
  const header = document.createElement('div');
  header.className = 'shin-enemy-entry-header';
  
  // Icon
  const iconContainer = document.createElement('div');
  iconContainer.className = 'shin-enemy-icon';
  
  if (isEncountered && enemy.icon) {
    const icon = document.createElement('img');
    icon.className = 'shin-enemy-icon-image';
    icon.src = enemy.icon;
    icon.alt = enemy.name;
    iconContainer.appendChild(icon);
  } else {
    const placeholder = document.createElement('span');
    placeholder.className = 'shin-enemy-icon-placeholder';
    placeholder.textContent = '?';
    iconContainer.appendChild(placeholder);
  }
  
  // Info section
  const info = document.createElement('div');
  info.className = 'shin-enemy-entry-info';
  
  const name = document.createElement('div');
  name.className = 'shin-enemy-name';
  name.textContent = isEncountered ? enemy.name : '???';
  
  info.appendChild(name);
  
  header.appendChild(iconContainer);
  header.appendChild(info);
  entry.appendChild(header);
  
  // Description
  if (isEncountered && enemy.description) {
    const description = document.createElement('div');
    description.className = 'shin-enemy-description';
    description.textContent = enemy.description;
    entry.appendChild(description);
  }
  
  // Stats dropdown (only for encountered enemies)
  if (isEncountered) {
    const statsToggle = document.createElement('button');
    statsToggle.className = 'shin-enemy-stats-toggle';
    statsToggle.type = 'button';
    statsToggle.setAttribute('aria-expanded', 'false');
    
    const statsLabel = document.createElement('span');
    statsLabel.textContent = 'Stats';
    
    const statsIcon = document.createElement('span');
    statsIcon.className = 'shin-enemy-stats-icon';
    statsIcon.textContent = '▾';
    
    statsToggle.appendChild(statsLabel);
    statsToggle.appendChild(statsIcon);
    
    const statsContainer = document.createElement('div');
    statsContainer.className = 'shin-enemy-stats';
    statsContainer.hidden = true;
    
    // Add stats if available
    if (enemy.traits && Array.isArray(enemy.traits)) {
      enemy.traits.forEach(trait => {
        const statRow = document.createElement('div');
        statRow.className = 'shin-enemy-stat';
        statRow.textContent = trait;
        statsContainer.appendChild(statRow);
      });
    }
    
    // Add additional stats from enemy properties
    const stats = [];
    if (enemy.formula) {
      stats.push({ label: 'Formula', value: enemy.formula });
    }
    
    stats.forEach(stat => {
      const statRow = document.createElement('div');
      statRow.className = 'shin-enemy-stat';
      
      const label = document.createElement('span');
      label.className = 'shin-enemy-stat-label';
      label.textContent = stat.label;
      
      const value = document.createElement('span');
      value.className = 'shin-enemy-stat-value';
      value.textContent = stat.value;
      
      statRow.appendChild(label);
      statRow.appendChild(value);
      statsContainer.appendChild(statRow);
    });
    
    statsToggle.addEventListener('click', () => {
      const isExpanded = statsToggle.getAttribute('aria-expanded') === 'true';
      statsToggle.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
      statsContainer.hidden = !statsContainer.hidden;
    });
    
    entry.appendChild(statsToggle);
    entry.appendChild(statsContainer);
  }
  
  return entry;
}

/**
 * Refresh the Enemy Almanac display
 * Call this when enemies are encountered or developer mode changes
 */
export function refreshEnemyAlmanac() {
  renderEnemyAlmanac();
}

