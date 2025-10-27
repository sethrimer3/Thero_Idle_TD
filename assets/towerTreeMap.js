// Tower Tree Map renderer: builds the alternate constellation view for unlocked towers.
import {
  getTowerDefinitions,
  getTowerUnlockState,
  getTowerEquationBlueprint,
} from './towersTab.js';
import { convertMathExpressionToPlainText } from '../scripts/core/mathText.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const towerTreeState = {
  toggleButton: null,
  mapContainer: null,
  nodeLayer: null,
  linkLayer: null,
  cardGrid: null,
  needsRefresh: false,
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeEquationText(rawEquation) {
  if (!rawEquation) {
    return '';
  }
  const plain = convertMathExpressionToPlainText(rawEquation) || rawEquation;
  return plain
    .replace(/\\/g, '')
    .replace(/[{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTowerEquation(towerId) {
  const card = document.getElementById('tower-card-grid')?.querySelector(
    `.card[data-tower-id="${towerId}"] .formula-block .formula-line`,
  );
  const text = card?.textContent;
  if (text && text.trim()) {
    return normalizeEquationText(text);
  }
  const blueprint = getTowerEquationBlueprint(towerId);
  if (blueprint?.baseEquation) {
    return normalizeEquationText(blueprint.baseEquation);
  }
  return '';
}

function collectTowerDependencies(equation, towers, currentId) {
  if (!equation) {
    return [];
  }
  const dependencies = new Set();
  const normalized = equation.toLowerCase();
  towers.forEach((definition) => {
    if (!definition || definition.id === currentId) {
      return;
    }
    const symbol = (definition.symbol || '').trim();
    const id = (definition.id || '').trim();
    let referenced = false;
    if (symbol && equation.includes(symbol)) {
      referenced = true;
    }
    if (!referenced && symbol) {
      const asciiSymbol = symbol
        .normalize('NFD')
        .replace(/[^\p{L}\p{N}]+/gu, '')
        .toLowerCase();
      if (asciiSymbol && normalized.includes(asciiSymbol)) {
        referenced = true;
      }
    }
    if (!referenced && id) {
      const idPattern = new RegExp(`\\b${escapeRegExp(id)}\\b`, 'i');
      if (idPattern.test(normalized)) {
        referenced = true;
      }
    }
    if (referenced) {
      dependencies.add(definition.id);
    }
  });
  return [...dependencies];
}

function clearTreeLayers() {
  if (towerTreeState.nodeLayer) {
    towerTreeState.nodeLayer.innerHTML = '';
  }
  if (towerTreeState.linkLayer) {
    while (towerTreeState.linkLayer.firstChild) {
      towerTreeState.linkLayer.removeChild(towerTreeState.linkLayer.firstChild);
    }
  }
}

function createTreeNode(definition, position, indexInTier) {
  const node = document.createElement('div');
  node.className = 'tower-tree-node';
  node.style.left = `${position.x}px`;
  node.style.top = `${position.y}px`;

  const orbit = document.createElement('div');
  orbit.className = 'tower-tree-node-orbit';
  orbit.setAttribute('tabindex', '0');
  orbit.style.setProperty('--tower-float-variance', `${(indexInTier % 3) * 0.6}s`);

  const symbolEl = document.createElement('span');
  symbolEl.className = 'tower-tree-node-symbol';
  symbolEl.textContent = definition.symbol || definition.id;

  const nameEl = document.createElement('span');
  nameEl.className = 'tower-tree-node-name';
  nameEl.textContent = definition.name || definition.id;

  const tierEl = document.createElement('span');
  tierEl.className = 'tower-tree-node-tier';
  const tierValue = Number.isFinite(definition.tier) ? definition.tier : '?';
  tierEl.textContent = `Tier ${tierValue}`;

  orbit.append(symbolEl, nameEl, tierEl);
  node.append(orbit);
  return { element: node, orbit, position };
}

function buildTreeLinks(nodes, edges) {
  if (!towerTreeState.linkLayer) {
    return;
  }
  const rect = towerTreeState.mapContainer.getBoundingClientRect();
  towerTreeState.linkLayer.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  towerTreeState.linkLayer.setAttribute('preserveAspectRatio', 'none');

  edges.forEach(([fromId, toId]) => {
    const fromNode = nodes.get(fromId);
    const toNode = nodes.get(toId);
    if (!fromNode || !toNode) {
      return;
    }
    const line = document.createElementNS(SVG_NS, 'line');
    const fromRect = fromNode.element.getBoundingClientRect();
    const toRect = toNode.element.getBoundingClientRect();
    const containerRect = towerTreeState.mapContainer.getBoundingClientRect();
    const x1 = fromRect.left - containerRect.left + fromRect.width / 2;
    const y1 = fromRect.top - containerRect.top + fromRect.height / 2;
    const x2 = toRect.left - containerRect.left + toRect.width / 2;
    const y2 = toRect.top - containerRect.top + toRect.height / 2;
    line.setAttribute('x1', String(x1));
    line.setAttribute('y1', String(y1));
    line.setAttribute('x2', String(x2));
    line.setAttribute('y2', String(y2));
    line.classList.add('tower-tree-link');
    towerTreeState.linkLayer.append(line);
  });
}

function computeNodeLayout(towers) {
  if (!towers.length) {
    return { positions: new Map(), edges: [] };
  }
  const unlockedTiers = new Map();
  towers.forEach((tower) => {
    const tier = Number.isFinite(tower.tier) ? tower.tier : towers.indexOf(tower) + 1;
    if (!unlockedTiers.has(tier)) {
      unlockedTiers.set(tier, []);
    }
    unlockedTiers.get(tier).push(tower);
  });
  const tierOrder = [...unlockedTiers.keys()].sort((a, b) => a - b);
  const mapHeight = Math.max(260, tierOrder.length * 180);
  towerTreeState.mapContainer.style.minHeight = `${mapHeight}px`;
  const paddingBottom = 72;
  const availableHeight = mapHeight - paddingBottom;
  const containerWidth = towerTreeState.nodeLayer?.offsetWidth || towerTreeState.mapContainer.clientWidth || 600;
  const positions = new Map();
  const equations = new Map();

  tierOrder.forEach((tier, tierIndex) => {
    const group = unlockedTiers.get(tier) || [];
    if (!group.length) {
      return;
    }
    const verticalSpacing = availableHeight / (tierOrder.length + 1);
    const y = Math.max(72, (tierIndex + 1) * verticalSpacing);
    const horizontalPadding = 80;
    const usableWidth = Math.max(200, containerWidth - horizontalPadding * 2);
    const step = group.length > 1 ? usableWidth / (group.length - 1) : 0;
    group.forEach((tower, index) => {
      const x = group.length > 1 ? horizontalPadding + index * step : containerWidth / 2;
      positions.set(tower.id, { x, y });
      equations.set(tower.id, extractTowerEquation(tower.id));
    });
  });

  const edges = [];
  const edgeSet = new Set();
  towers.forEach((tower) => {
    const dependencies = collectTowerDependencies(equations.get(tower.id), towers, tower.id);
    dependencies.forEach((dependencyId) => {
      const key = [tower.id, dependencyId].sort().join('::');
      if (!edgeSet.has(key) && positions.has(tower.id) && positions.has(dependencyId)) {
        edgeSet.add(key);
        edges.push([tower.id, dependencyId]);
      }
    });
  });

  return { positions, edges };
}

function refreshTreeInternal() {
  if (!towerTreeState.mapContainer || towerTreeState.mapContainer.hidden) {
    towerTreeState.needsRefresh = true;
    return;
  }
  const unlockState = getTowerUnlockState();
  const unlocked = Array.from(unlockState.unlocked || []);
  const definitions = getTowerDefinitions().filter((definition) => unlocked.includes(definition.id));

  clearTreeLayers();
  if (!definitions.length) {
    return;
  }

  const { positions, edges } = computeNodeLayout(definitions);
  const nodes = new Map();
  let indexCounter = 0;
  positions.forEach((position, towerId) => {
    const definition = definitions.find((entry) => entry.id === towerId);
    if (!definition || !towerTreeState.nodeLayer) {
      return;
    }
    const node = createTreeNode(definition, position, indexCounter++);
    nodes.set(towerId, node);
    towerTreeState.nodeLayer.append(node.element);
  });

  buildTreeLinks(nodes, edges);
  towerTreeState.needsRefresh = false;
}

function toggleTreeVisibility(forceOpen = null) {
  if (!towerTreeState.toggleButton || !towerTreeState.mapContainer || !towerTreeState.cardGrid) {
    return;
  }
  const currentlyOpen = !towerTreeState.mapContainer.hidden;
  const nextOpen = forceOpen === null ? !currentlyOpen : Boolean(forceOpen);
  towerTreeState.mapContainer.hidden = !nextOpen;
  towerTreeState.mapContainer.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
  towerTreeState.cardGrid.hidden = nextOpen;
  towerTreeState.cardGrid.setAttribute('aria-hidden', nextOpen ? 'true' : 'false');
  towerTreeState.toggleButton.setAttribute('aria-pressed', nextOpen ? 'true' : 'false');
  towerTreeState.toggleButton.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
  if (nextOpen) {
    refreshTreeInternal();
  }
}

function scheduleTreeRefresh() {
  if (towerTreeState.needsRefresh) {
    return;
  }
  towerTreeState.needsRefresh = true;
  if (towerTreeState.mapContainer && !towerTreeState.mapContainer.hidden) {
    window.requestAnimationFrame(() => refreshTreeInternal());
  }
}

export function refreshTowerTreeMap() {
  refreshTreeInternal();
}

export function initializeTowerTreeMap({ toggleButton = null, mapContainer = null, cardGrid = null } = {}) {
  towerTreeState.toggleButton = toggleButton;
  towerTreeState.mapContainer = mapContainer;
  towerTreeState.cardGrid = cardGrid;
  towerTreeState.nodeLayer = mapContainer?.querySelector('[data-tree-node-layer]') || null;
  towerTreeState.linkLayer = mapContainer?.querySelector('svg') || null;

  if (towerTreeState.toggleButton) {
    towerTreeState.toggleButton.addEventListener('click', () => toggleTreeVisibility());
  }

  document.addEventListener('tower-unlocked', scheduleTreeRefresh);
  window.addEventListener('resize', scheduleTreeRefresh);
  scheduleTreeRefresh();
}
