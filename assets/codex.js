import { annotateMathText, renderMathElement } from '../scripts/core/mathText.js';
import {
  getPerformanceSnapshotLog,
  subscribeToPerformanceSnapshots,
} from './performanceMonitor.js';

// Maintains codex progression state for encountered enemies.
export const codexState = {
  encounteredEnemies: new Set(),
};

// Stores DOM elements associated with the enemy codex list.
export const enemyCodexElements = {
  list: null,
  empty: null,
  note: null,
};

// Track recent performance snapshots rendered in the Codex diagnostics card.
const performanceCodexState = {
  log: [],
};

// Cache DOM nodes tied to the diagnostics card so updates stay efficient.
const performanceCodexElements = {
  card: null,
  list: null,
  empty: null,
  updated: null,
};

let unsubscribePerformanceSnapshots = null;

// Friendly labels for the raw instrumentation keys emitted by the playfield tracker.
const PERFORMANCE_BUCKET_LABELS = {
  update: 'Playfield Update',
  'update:stats': 'Stat Sync',
  'update:ambient': 'Ambient FX',
  'update:towers': 'Towers',
  'update:enemies': 'Enemies',
  'update:projectiles': 'Projectiles',
  'update:motes': 'Drops',
  'update:hud': 'HUD & Progress',
  draw: 'Rendering',
  towers: 'Tower Total',
};

// Canonical display names for tower ids so the card reads like the tower tab.
const TOWER_LABELS = {
  alpha: 'Alpha Spire',
  beta: 'Beta Spire',
  gamma: 'Gamma Spire',
  delta: 'Delta Spire',
  epsilon: 'Epsilon Spire',
  zeta: 'Zeta Spire',
  eta: 'Eta Spire',
  theta: 'Theta Spire',
  iota: 'Iota Spire',
  kappa: 'Kappa Spire',
  lambda: 'Lambda Spire',
  mu: 'Mu Spire',
  nu: 'Nu Spire',
  xi: 'Xi Spire',
  omicron: 'Omicron Spire',
  pi: 'Pi Spire',
  rho: 'Rho Spire',
  sigma: 'Sigma Spire',
  tau: 'Tau Spire',
  upsilon: 'Upsilon Spire',
  phi: 'Phi Spire',
  chi: 'Chi Spire',
  psi: 'Psi Spire',
  omega: 'Omega Spire',
};

function formatPercent(value) {
  const percentage = Number.isFinite(value) ? value * 100 : 0;
  return `${percentage.toFixed(1)}%`;
}

function formatFrameTime(ms) {
  if (!Number.isFinite(ms)) {
    return '— ms';
  }
  return `${ms.toFixed(1)} ms`;
}

function formatFps(fps) {
  if (!Number.isFinite(fps) || fps <= 0) {
    return '— FPS';
  }
  return `${Math.round(fps)} FPS`;
}

function formatRelativeTimestamp(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return '—';
  }
  const deltaMs = Date.now() - timestamp;
  if (deltaMs < 5_000) {
    return 'Just now';
  }
  if (deltaMs < 60_000) {
    return `${Math.max(1, Math.round(deltaMs / 1_000))}s ago`;
  }
  const minutes = Math.round(deltaMs / 60_000);
  return `${minutes}m ago`;
}

function resolveBucketLabel(label) {
  if (!label) {
    return 'Misc';
  }
  if (PERFORMANCE_BUCKET_LABELS[label]) {
    return PERFORMANCE_BUCKET_LABELS[label];
  }
  const suffix = label.includes(':') ? label.split(':').pop() : label;
  return suffix ? suffix.charAt(0).toUpperCase() + suffix.slice(1) : 'Misc';
}

function formatTowerLabel(towerType) {
  if (!towerType) {
    return 'Unknown Spire';
  }
  const normalized = towerType.trim().toLowerCase();
  if (TOWER_LABELS[normalized]) {
    return TOWER_LABELS[normalized];
  }
  return `${normalized.charAt(0).toUpperCase() + normalized.slice(1)} Spire`;
}

// Render the diagnostics card using the latest rolling log entries.
function renderPerformanceCodex() {
  if (!performanceCodexElements.list) {
    return;
  }

  const logEntries = performanceCodexState.log;
  if (!Array.isArray(logEntries) || logEntries.length === 0) {
    performanceCodexElements.list.setAttribute('hidden', '');
    if (performanceCodexElements.empty) {
      performanceCodexElements.empty.hidden = false;
    }
    if (performanceCodexElements.updated) {
      performanceCodexElements.updated.textContent = 'Awaiting diagnostics…';
    }
    return;
  }

  performanceCodexElements.list.removeAttribute('hidden');
  if (performanceCodexElements.empty) {
    performanceCodexElements.empty.hidden = true;
  }
  const latest = logEntries[0];
  if (performanceCodexElements.updated) {
    performanceCodexElements.updated.textContent = `Last update · ${formatRelativeTimestamp(
      latest.timestamp,
    )}`;
  }

  performanceCodexElements.list.innerHTML = '';
  const fragment = document.createDocumentFragment();

  logEntries.forEach((entry) => {
    if (!entry) {
      return;
    }
    const card = document.createElement('article');
    card.className = 'performance-log-entry';

    const header = document.createElement('header');
    header.className = 'performance-log-entry-header';

    const time = document.createElement('span');
    time.className = 'performance-log-entry-time';
    time.textContent = formatRelativeTimestamp(entry.timestamp);

    const frame = document.createElement('span');
    frame.className = 'performance-log-entry-frame';
    frame.textContent = `${formatFrameTime(entry.averageFrameMs)} · ${formatFps(entry.fps)}`;

    header.append(time, frame);

    if (entry.autoGraphics?.active) {
      const badge = document.createElement('span');
      badge.className = 'performance-log-badge';
      badge.textContent = 'Auto Low Mode';
      header.append(badge);
    }

    card.append(header);

    const bucketList = document.createElement('dl');
    bucketList.className = 'performance-breakdown';
    const topBuckets = Array.isArray(entry.buckets) ? entry.buckets.slice(0, 3) : [];
    topBuckets.forEach((bucket) => {
      const row = document.createElement('div');
      row.className = 'performance-breakdown-row';

      const label = document.createElement('dt');
      label.textContent = resolveBucketLabel(bucket.label);

      const value = document.createElement('dd');
      value.textContent = formatPercent(bucket.percent);

      row.append(label, value);
      bucketList.append(row);
    });
    card.append(bucketList);

    const towerList = document.createElement('div');
    towerList.className = 'performance-tower-list';
    const topTowers = Array.isArray(entry.towers) ? entry.towers.slice(0, 3) : [];
    topTowers.forEach((tower) => {
      const towerRow = document.createElement('div');
      towerRow.className = 'performance-tower-row';

      const label = document.createElement('span');
      label.className = 'performance-tower-label';
      label.textContent = formatTowerLabel(tower.label);

      const value = document.createElement('span');
      value.className = 'performance-tower-value';
      value.textContent = formatPercent(tower.percent);

      towerRow.append(label, value);
      towerList.append(towerRow);
    });
    if (topTowers.length) {
      card.append(towerList);
    }

    if (Array.isArray(entry.events) && entry.events.length) {
      entry.events.forEach((eventMessage) => {
        const note = document.createElement('p');
        note.className = 'performance-log-note';
        note.textContent = eventMessage;
        card.append(note);
      });
    }

    fragment.append(card);
  });

  performanceCodexElements.list.append(fragment);
}

// Bind DOM nodes and subscribe to instrumentation updates so the diagnostics stay live.
export function initializePerformanceCodex() {
  performanceCodexElements.card = document.getElementById('performance-codex-card');
  performanceCodexElements.list = document.getElementById('performance-log-list');
  performanceCodexElements.empty = document.getElementById('performance-log-empty');
  performanceCodexElements.updated = document.getElementById('performance-log-updated');
  performanceCodexState.log = getPerformanceSnapshotLog();
  renderPerformanceCodex();
  if (unsubscribePerformanceSnapshots) {
    unsubscribePerformanceSnapshots();
  }
  unsubscribePerformanceSnapshots = subscribeToPerformanceSnapshots(() => {
    performanceCodexState.log = getPerformanceSnapshotLog();
    renderPerformanceCodex();
  });
}

let enemyCodexEntries = [];
let enemyCodexMap = new Map();

// Updates stored codex entries and rebuilds the lookup map.
export function setEnemyCodexEntries(entries) {
  enemyCodexEntries = Array.isArray(entries)
    ? entries.map((entry) => ({
        ...entry,
        traits: Array.isArray(entry.traits) ? [...entry.traits] : [],
      }))
    : [];
  enemyCodexMap = new Map(enemyCodexEntries.map((entry) => [entry.id, entry]));
  pruneEncounteredCodexEntries();
  return enemyCodexEntries;
}

// Removes encountered enemy ids that no longer exist in the codex map.
export function pruneEncounteredCodexEntries() {
  Array.from(codexState.encounteredEnemies).forEach((enemyId) => {
    if (!enemyCodexMap.has(enemyId)) {
      codexState.encounteredEnemies.delete(enemyId);
    }
  });
}

// Retrieves all normalized codex entries.
export function getEnemyCodexEntries() {
  return enemyCodexEntries;
}

// Resolves a codex entry by id, returning null when it is missing.
export function getEnemyCodexEntry(enemyId) {
  if (!enemyId) {
    return null;
  }
  return enemyCodexMap.get(enemyId) || null;
}

// Determines whether a codex entry exists for the supplied id.
export function hasEnemyCodexEntry(enemyId) {
  if (!enemyId) {
    return false;
  }
  return enemyCodexMap.has(enemyId);
}

// Renders the enemy codex list using the current state and lookup map.
export function renderEnemyCodex() {
  if (!enemyCodexElements.list) {
    return;
  }

  const encountered = Array.from(codexState.encounteredEnemies)
    .map((id) => enemyCodexMap.get(id))
    .filter(Boolean);

  enemyCodexElements.list.innerHTML = '';

  if (enemyCodexElements.note) {
    enemyCodexElements.note.hidden = encountered.length > 0 ? false : true;
  }

  if (!encountered.length) {
    if (enemyCodexElements.empty) {
      enemyCodexElements.empty.hidden = false;
    }
    enemyCodexElements.list.setAttribute('hidden', '');
    return;
  }

  enemyCodexElements.list.removeAttribute('hidden');
  if (enemyCodexElements.empty) {
    enemyCodexElements.empty.hidden = true;
  }

  const fragment = document.createDocumentFragment();
  encountered.forEach((entry) => {
    const card = document.createElement('article');
    card.className = 'card enemy-card';
    card.setAttribute('role', 'listitem');

    const title = document.createElement('h3');
    title.textContent = entry.name;
    card.append(title);

    if (entry.symbol) {
      const glyphRow = document.createElement('p');
      glyphRow.className = 'enemy-card-glyph';

      const glyphSymbol = document.createElement('span');
      glyphSymbol.className = 'enemy-card-symbol';
      glyphSymbol.textContent = entry.symbol;

      const glyphExponent = document.createElement('sup');
      glyphExponent.className = 'enemy-card-symbol-exponent';
      glyphExponent.textContent = 'k';
      glyphSymbol.append(glyphExponent);

      const glyphNote = document.createElement('span');
      glyphNote.className = 'enemy-card-glyph-note';
      glyphNote.textContent = annotateMathText('HP tiers use (10^{k}).');

      glyphRow.append(glyphSymbol, glyphNote);
      card.append(glyphRow);
      renderMathElement(glyphNote);
    }

    const summaryText = entry.summary || entry.description || '';
    if (summaryText) {
      const summary = document.createElement('p');
      summary.className = 'enemy-card-summary';
      summary.textContent = annotateMathText(summaryText);
      card.append(summary);
      renderMathElement(summary);
    }

    if (entry.formula) {
      const formulaRow = document.createElement('p');
      formulaRow.className = 'enemy-card-formula';

      const formulaLabel = document.createElement('span');
      formulaLabel.className = 'enemy-card-formula-label';
      formulaLabel.textContent = entry.formulaLabel || 'Key Expression';

      const equation = document.createElement('span');
      equation.className = 'enemy-card-equation';
      equation.textContent = annotateMathText(entry.formula);

      formulaRow.append(formulaLabel, document.createTextNode(': '), equation);
      card.append(formulaRow);
      renderMathElement(equation);
    }

    if (Array.isArray(entry.traits) && entry.traits.length) {
      const traitList = document.createElement('ul');
      traitList.className = 'enemy-card-traits';
      entry.traits.forEach((trait) => {
        const item = document.createElement('li');
        item.textContent = annotateMathText(trait);
        traitList.append(item);
        renderMathElement(item);
      });
      card.append(traitList);
    }

    if (entry.counter) {
      const counter = document.createElement('p');
      counter.className = 'enemy-card-counter';
      counter.textContent = annotateMathText(entry.counter);
      card.append(counter);
      renderMathElement(counter);
    }

    if (entry.lore) {
      const lore = document.createElement('p');
      lore.className = 'enemy-card-lore';
      lore.textContent = annotateMathText(entry.lore);
      card.append(lore);
      renderMathElement(lore);
    }

    fragment.append(card);
  });

  enemyCodexElements.list.append(fragment);
}

// Records an encountered enemy and refreshes the codex display.
export function registerEnemyEncounter(enemyId) {
  if (!enemyId || codexState.encounteredEnemies.has(enemyId)) {
    return;
  }
  if (!enemyCodexMap.has(enemyId)) {
    return;
  }
  codexState.encounteredEnemies.add(enemyId);
  renderEnemyCodex();
}

// Wires up codex UI buttons with helpers supplied by the main module.
export function bindCodexControls({
  setActiveTab,
  openFieldNotesOverlay,
  scrollPanelToElement,
  onOpenButtonReady,
}) {
  const openButton = document.getElementById('open-codex-button');
  if (openButton) {
    if (typeof onOpenButtonReady === 'function') {
      onOpenButtonReady(openButton);
    }
    openButton.addEventListener('click', () => {
      if (typeof setActiveTab === 'function') {
        setActiveTab('options');
      }
      if (typeof openFieldNotesOverlay === 'function') {
        openFieldNotesOverlay();
      }
    });
  }

  const optionsButton = document.getElementById('codex-options-button');
  if (optionsButton) {
    optionsButton.addEventListener('click', () => {
      if (typeof setActiveTab === 'function') {
        setActiveTab('options');
      }

      window.requestAnimationFrame(() => {
        const soundCard = document.getElementById('sound-card');
        if (soundCard && typeof scrollPanelToElement === 'function') {
          scrollPanelToElement(soundCard);
        }

        const musicSlider = document.getElementById('music-volume');
        if (musicSlider && typeof musicSlider.focus === 'function') {
          try {
            musicSlider.focus({ preventScroll: true });
          } catch (error) {
            musicSlider.focus();
          }
        }
      });
    });
  }
}
