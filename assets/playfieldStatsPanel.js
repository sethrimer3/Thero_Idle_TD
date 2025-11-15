/**
 * Playfield combat stats panel orchestrates the optional analytics surface that lives beneath the battlefield.
 * It exposes helpers to toggle visibility, render per-tower damage output with icons, maintain
 * a grouped attack log, and chronicle defeated enemies with their top-damaging towers.
 * SimplePlayfield records battle data and feeds it through this module whenever stats mode is enabled.
 */
import { formatCombatNumber } from './playfield/utils/formatting.js';
import { getTowerDefinition } from './towersTab.js';
import { scrollPanelToElement } from './uiHelpers.js';

const elements = {
  container: null,
  towerList: null,
  attackList: null,
  enemyList: null,
  currentWaveList: null,
  nextWaveList: null,
  activeEnemyList: null,
  emptyTowerNote: null,
  emptyAttackNote: null,
  emptyEnemyNote: null,
  emptyCurrentWaveNote: null,
  emptyNextWaveNote: null,
  emptyActiveEnemyNote: null,
  dialog: null,
  dialogTitle: null,
  dialogList: null,
  dialogClose: null,
};

let panelVisible = false;

// Allow the playfield to inject focus callbacks without creating a circular import.
const interactionHandlers = {
  focusEnemy: null,
  clearEnemyFocus: null,
};

// Cache entry collections so the dialog can refresh when new data arrives.
let currentWaveEntries = [];
let nextWaveEntries = [];
let activeEnemyEntries = [];

// Remember which entry is displayed so repeated renders keep the dialog in sync.
const dialogState = {
  type: null,
  targetId: null,
};

function clearChildren(node) {
  if (!node) {
    return;
  }
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function resolveTowerDisplay(type) {
  if (!type) {
    return {
      type: '',
      name: 'Unknown Tower',
      symbol: '◈',
      icon: null,
    };
  }
  const definition = getTowerDefinition(type) || {};
  const name = definition.name || `${type} Tower`;
  const symbol = definition.symbol || '◈';
  const icon = typeof definition.icon === 'string' ? definition.icon : null;
  return { type, name, symbol, icon };
}

/**
 * Convert elapsed combat time into a compact label (e.g., "45s", "3m 12s").
 */
function formatDuration(seconds) {
  const value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  if (value < 1) {
    return '0s';
  }
  if (value < 60) {
    return value < 10 ? `${value.toFixed(1)}s` : `${Math.round(value)}s`;
  }
  const minutes = Math.floor(value / 60);
  const remainder = value % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const minutesRemain = minutes % 60;
    if (minutesRemain === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutesRemain}m`;
  }
  if (remainder < 5) {
    return `${minutes}m`;
  }
  return `${minutes}m ${Math.round(remainder)}s`;
}

/**
 * Build a rich button element for queue or active enemy entries using preformatted data.
 */
function createEnemyButton(entry, type) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'playfield-combat-stats__enemy-button';
  button.setAttribute('role', 'listitem');
  button.dataset.entryId = String(entry.id);
  button.dataset.entryType = type;

  const title = document.createElement('strong');
  title.textContent = entry.title || 'Enemy';
  button.appendChild(title);

  if (entry.subtitle) {
    const subtitle = document.createElement('div');
    subtitle.className = 'playfield-combat-stats__enemy-footnote';
    subtitle.textContent = entry.subtitle;
    button.appendChild(subtitle);
  }

  if (Array.isArray(entry.meta) && entry.meta.length) {
    const metaRow = document.createElement('div');
    metaRow.className = 'playfield-combat-stats__enemy-meta';
    entry.meta.forEach((metaItem) => {
      const content = typeof metaItem === 'string' ? { text: metaItem } : metaItem;
      if (!content || typeof content.text !== 'string') {
        return;
      }
      if (content.emphasize) {
        const strong = document.createElement('strong');
        strong.textContent = content.text;
        metaRow.appendChild(strong);
      } else {
        const span = document.createElement('span');
        span.textContent = content.text;
        metaRow.appendChild(span);
      }
    });
    if (metaRow.childElementCount) {
      button.appendChild(metaRow);
    }
  }

  if (entry.footnote) {
    const footnote = document.createElement('div');
    footnote.className = 'playfield-combat-stats__enemy-footnote';
    footnote.textContent = entry.footnote;
    button.appendChild(footnote);
  }

  return button;
}

/**
 * Clone entry definitions to avoid mutating cached data across renders.
 */
function clonePanelEntry(entry) {
  if (!entry) {
    return null;
  }
  const meta = Array.isArray(entry.meta)
    ? entry.meta.map((item) => (typeof item === 'string' ? item : { ...item }))
    : [];
  const dialogRows = Array.isArray(entry.dialog?.rows)
    ? entry.dialog.rows.map((row) => ({ ...row }))
    : [];
  const dialog = entry.dialog ? { title: entry.dialog.title, rows: dialogRows } : null;
  return { ...entry, meta, dialog };
}

/**
 * Toggle the focused modifier class so the active dialog entry is visually marked.
 */
function updateFocusedButtons() {
  const focusType = dialogState.type;
  const focusId = dialogState.targetId;
  const candidates = [
    elements.currentWaveList,
    elements.nextWaveList,
    elements.activeEnemyList,
  ];
  candidates.forEach((container) => {
    if (!container) {
      return;
    }
    const buttons = container.querySelectorAll('.playfield-combat-stats__enemy-button');
    buttons.forEach((button) => {
      const matches =
        button.dataset.entryType === focusType && button.dataset.entryId === focusId;
      button.classList.toggle('playfield-combat-stats__enemy-button--focused', matches);
    });
  });
}

/**
 * Resolve the cached entry array that matches the requested section type.
 */
function getEntryCollection(type) {
  if (type === 'currentWave') {
    return currentWaveEntries;
  }
  if (type === 'nextWave') {
    return nextWaveEntries;
  }
  if (type === 'activeEnemy') {
    return activeEnemyEntries;
  }
  return null;
}

/**
 * Look up the entry record for the dialog using its identifier and section type.
 */
function findEntryById(type, id) {
  const collection = getEntryCollection(type);
  if (!collection) {
    return null;
  }
  return collection.find((entry) => String(entry.id) === String(id)) || null;
}

/**
 * Populate the floating dialog with the supplied entry information.
 */
function populateDialog(entry) {
  const { dialog, dialogTitle, dialogList } = elements;
  if (!dialog || !dialogTitle || !dialogList || !entry) {
    return false;
  }
  const details = entry.dialog || {};
  dialogTitle.textContent = details.title || entry.title || 'Enemy Details';
  clearChildren(dialogList);
  if (Array.isArray(details.rows) && details.rows.length) {
    details.rows.forEach((row) => {
      if (!row || typeof row.label !== 'string' || typeof row.value !== 'string') {
        return;
      }
      const term = document.createElement('dt');
      term.textContent = row.label;
      const definition = document.createElement('dd');
      definition.textContent = row.value;
      dialogList.append(term, definition);
    });
  } else {
    const placeholder = document.createElement('dt');
    placeholder.textContent = 'Details';
    const value = document.createElement('dd');
    value.textContent = 'No additional information available.';
    dialogList.append(placeholder, value);
  }
  dialog.removeAttribute('hidden');
  dialog.setAttribute('aria-hidden', 'false');
  return true;
}

/**
 * Reveal the dialog for the requested entry and notify focus handlers when needed.
 */
function showEnemyDialog(type, id) {
  const entry = findEntryById(type, id);
  if (!entry) {
    hideEnemyDialog();
    return;
  }
  dialogState.type = type;
  dialogState.targetId = String(id);
  populateDialog(entry);
  updateFocusedButtons();
  if (type === 'activeEnemy' && typeof interactionHandlers.focusEnemy === 'function') {
    const targetId = entry.focusEnemyId ?? Number(entry.id);
    interactionHandlers.focusEnemy(targetId);
  }
}

/**
 * Conceal the dialog and clear any enemy focus that was requested by the panel.
 */
function hideEnemyDialog() {
  const previousType = dialogState.type;
  const { dialog } = elements;
  if (dialog) {
    dialog.setAttribute('hidden', '');
    dialog.setAttribute('aria-hidden', 'true');
  }
  dialogState.type = null;
  dialogState.targetId = null;
  updateFocusedButtons();
  if (previousType === 'activeEnemy' && typeof interactionHandlers.clearEnemyFocus === 'function') {
    interactionHandlers.clearEnemyFocus();
  }
}

/**
 * Delegate click handling for queue buttons so entries open or close on demand.
 */
function handleEnemyButtonClick(event) {
  const button = event.target.closest('.playfield-combat-stats__enemy-button');
  if (!button) {
    return;
  }
  const entryType = button.dataset.entryType;
  const entryId = button.dataset.entryId;
  if (!entryType || !entryId) {
    return;
  }
  const dialogOpen = elements.dialog && !elements.dialog.hasAttribute('hidden');
  if (dialogOpen && dialogState.type === entryType && dialogState.targetId === entryId) {
    hideEnemyDialog();
  } else {
    showEnemyDialog(entryType, entryId);
  }
}

/**
 * Refresh the dialog contents if the currently selected entry still exists.
 */
function refreshDialogIfVisible() {
  if (!elements.dialog || elements.dialog.hasAttribute('hidden')) {
    return;
  }
  if (!dialogState.type || !dialogState.targetId) {
    return;
  }
  const entry = findEntryById(dialogState.type, dialogState.targetId);
  if (!entry) {
    hideEnemyDialog();
    return;
  }
  populateDialog(entry);
  updateFocusedButtons();
  if (dialogState.type === 'activeEnemy' && typeof interactionHandlers.focusEnemy === 'function') {
    const targetId = entry.focusEnemyId ?? Number(entry.id);
    interactionHandlers.focusEnemy(targetId);
  }
}

function renderTowerSummaryItem(summary) {
  const wrapper = document.createElement('div');
  wrapper.className = 'playfield-combat-stats__tower-item';
  wrapper.setAttribute('role', 'listitem');

  const iconWrapper = document.createElement('div');
  iconWrapper.className = 'playfield-combat-stats__icon';
  const display = resolveTowerDisplay(summary.type);
  if (display.icon) {
    const img = document.createElement('img');
    img.src = display.icon;
    img.alt = `${display.name} icon`;
    img.loading = 'lazy';
    iconWrapper.appendChild(img);
  } else {
    const fallback = document.createElement('span');
    fallback.className = 'playfield-combat-stats__icon-fallback';
    fallback.textContent = display.symbol;
    iconWrapper.appendChild(fallback);
  }

  const textWrapper = document.createElement('div');
  textWrapper.className = 'playfield-combat-stats__tower-text';

  const title = document.createElement('div');
  title.className = 'playfield-combat-stats__tower-title';
  const placementLabel = Number.isFinite(summary.placementIndex)
    ? ` · Placement #${summary.placementIndex}`
    : '';
  title.textContent = `${display.name}${placementLabel}`;

  const damageLine = document.createElement('div');
  damageLine.className = 'playfield-combat-stats__tower-damage';
  const totalLabel = formatCombatNumber(Math.max(0, summary.totalDamage || 0));
  damageLine.textContent = `Total Damage ${totalLabel}`;

  const rateLine = document.createElement('div');
  rateLine.className = 'playfield-combat-stats__tower-rate';
  const dps = Number.isFinite(summary.averageDps) ? summary.averageDps : 0;
  const statusLabel = summary.isActive ? 'Active' : 'Retired';
  rateLine.textContent = `Average DPS ${formatCombatNumber(Math.max(0, dps))} · ${statusLabel}`;

  const timeLine = document.createElement('div');
  timeLine.className = 'playfield-combat-stats__tower-rate';
  // Indicate how long the lattice has contributed to combat phases.
  timeLine.textContent = `Active ${formatDuration(summary.activeTime)}`;

  textWrapper.append(title, damageLine, rateLine, timeLine);
  wrapper.append(iconWrapper, textWrapper);
  return wrapper;
}

function renderAttackLogItem(entry) {
  const wrapper = document.createElement('div');
  wrapper.className = 'playfield-combat-stats__log-item';
  wrapper.setAttribute('role', 'listitem');

  const iconWrapper = document.createElement('div');
  iconWrapper.className = 'playfield-combat-stats__icon';
  const display = resolveTowerDisplay(entry.type);
  if (display.icon) {
    const img = document.createElement('img');
    img.src = display.icon;
    img.alt = `${display.name} icon`;
    img.loading = 'lazy';
    iconWrapper.appendChild(img);
  } else {
    const fallback = document.createElement('span');
    fallback.className = 'playfield-combat-stats__icon-fallback';
    fallback.textContent = display.symbol;
    iconWrapper.appendChild(fallback);
  }

  const textWrapper = document.createElement('div');
  textWrapper.className = 'playfield-combat-stats__log-text';
  const title = document.createElement('div');
  title.className = 'playfield-combat-stats__log-title';
  title.textContent = display.name;

  const detail = document.createElement('div');
  detail.className = 'playfield-combat-stats__log-detail';
  const damageLabel = formatCombatNumber(Math.max(0, entry.damage || 0));
  const hitLabel = entry.events === 1 ? '1 attack' : `${entry.events} attacks`;
  detail.textContent = `${hitLabel} · ${damageLabel} damage`;

  textWrapper.append(title, detail);
  wrapper.append(iconWrapper, textWrapper);
  return wrapper;
}

function renderEnemyHistoryItem(entry) {
  const wrapper = document.createElement('div');
  wrapper.className = 'playfield-combat-stats__enemy-item';
  wrapper.setAttribute('role', 'listitem');

  const header = document.createElement('div');
  header.className = 'playfield-combat-stats__enemy-header';
  header.textContent = `${entry.label} · ${formatCombatNumber(Math.max(0, entry.hp || 0))} HP`;

  const body = document.createElement('div');
  body.className = 'playfield-combat-stats__enemy-body';

  if (Array.isArray(entry.topContributors) && entry.topContributors.length) {
    entry.topContributors.forEach((contributor, index) => {
      const row = document.createElement('div');
      row.className = 'playfield-combat-stats__enemy-contributor';

      const rank = document.createElement('span');
      rank.className = 'playfield-combat-stats__enemy-rank';
      rank.textContent = `#${index + 1}`;

      const iconWrapper = document.createElement('span');
      iconWrapper.className = 'playfield-combat-stats__icon playfield-combat-stats__icon--inline';
      const display = resolveTowerDisplay(contributor.type);
      if (display.icon) {
        const img = document.createElement('img');
        img.src = display.icon;
        img.alt = `${display.name} icon`;
        img.loading = 'lazy';
        iconWrapper.appendChild(img);
      } else {
        const fallback = document.createElement('span');
        fallback.className = 'playfield-combat-stats__icon-fallback';
        fallback.textContent = display.symbol;
        iconWrapper.appendChild(fallback);
      }

      const label = document.createElement('span');
      label.className = 'playfield-combat-stats__enemy-label';
      label.textContent = display.name;

      const amount = document.createElement('span');
      amount.className = 'playfield-combat-stats__enemy-damage';
      amount.textContent = formatCombatNumber(Math.max(0, contributor.damage || 0));

      row.append(rank, iconWrapper, label, amount);
      body.appendChild(row);
    });
  } else {
    const none = document.createElement('div');
    none.className = 'playfield-combat-stats__enemy-empty';
    none.textContent = 'No tower contributions recorded.';
    body.appendChild(none);
  }

  wrapper.append(header, body);
  return wrapper;
}

export function registerStatsElements({
  container = null,
  towerList = null,
  attackList = null,
  enemyList = null,
  currentWaveList = null,
  nextWaveList = null,
  activeEnemyList = null,
  emptyTowerNote = null,
  emptyAttackNote = null,
  emptyEnemyNote = null,
  emptyCurrentWaveNote = null,
  emptyNextWaveNote = null,
  emptyActiveEnemyNote = null,
  dialog = null,
  dialogTitle = null,
  dialogList = null,
  dialogClose = null,
} = {}) {
  elements.container = container;
  elements.towerList = towerList;
  elements.attackList = attackList;
  elements.enemyList = enemyList;
  elements.currentWaveList = currentWaveList;
  elements.nextWaveList = nextWaveList;
  elements.activeEnemyList = activeEnemyList;
  elements.emptyTowerNote = emptyTowerNote;
  elements.emptyAttackNote = emptyAttackNote;
  elements.emptyEnemyNote = emptyEnemyNote;
  elements.emptyCurrentWaveNote = emptyCurrentWaveNote;
  elements.emptyNextWaveNote = emptyNextWaveNote;
  elements.emptyActiveEnemyNote = emptyActiveEnemyNote;
  elements.dialog = dialog;
  elements.dialogTitle = dialogTitle;
  elements.dialogList = dialogList;
  elements.dialogClose = dialogClose;

  if (elements.currentWaveList) {
    elements.currentWaveList.addEventListener('click', handleEnemyButtonClick);
  }
  if (elements.nextWaveList) {
    elements.nextWaveList.addEventListener('click', handleEnemyButtonClick);
  }
  if (elements.activeEnemyList) {
    elements.activeEnemyList.addEventListener('click', handleEnemyButtonClick);
  }
  if (elements.dialogClose) {
    elements.dialogClose.addEventListener('click', () => hideEnemyDialog());
  }
}

export function setVisible(visible) {
  const shouldShow = Boolean(visible);
  panelVisible = shouldShow;
  const { container } = elements;
  if (!container) {
    return;
  }
  if (shouldShow) {
    container.removeAttribute('hidden');
    container.setAttribute('aria-hidden', 'false');
  } else {
    container.setAttribute('hidden', '');
    container.setAttribute('aria-hidden', 'true');
    hideEnemyDialog();
  }
}

export function isVisible() {
  return panelVisible;
}

export function resetPanel() {
  const {
    towerList,
    attackList,
    enemyList,
    currentWaveList,
    nextWaveList,
    activeEnemyList,
    emptyTowerNote,
    emptyAttackNote,
    emptyEnemyNote,
    emptyCurrentWaveNote,
    emptyNextWaveNote,
    emptyActiveEnemyNote,
  } = elements;
  clearChildren(towerList);
  clearChildren(attackList);
  clearChildren(enemyList);
  clearChildren(currentWaveList);
  clearChildren(nextWaveList);
  clearChildren(activeEnemyList);
  if (emptyTowerNote) {
    emptyTowerNote.hidden = false;
  }
  if (emptyAttackNote) {
    emptyAttackNote.hidden = false;
  }
  if (emptyEnemyNote) {
    emptyEnemyNote.hidden = false;
  }
  if (emptyCurrentWaveNote) {
    emptyCurrentWaveNote.hidden = false;
  }
  if (emptyNextWaveNote) {
    emptyNextWaveNote.hidden = false;
  }
  if (emptyActiveEnemyNote) {
    emptyActiveEnemyNote.hidden = false;
  }
  currentWaveEntries = [];
  nextWaveEntries = [];
  activeEnemyEntries = [];
  hideEnemyDialog();
}

/**
 * Bring the combat stats panel into view so players immediately see the analytics surface.
 */
export function focusPanel() {
  const { container } = elements;
  if (!container) {
    return;
  }

  // Prefer the shared panel scrolling helper so the stats card aligns with the active tab.
  if (typeof scrollPanelToElement === 'function') {
    try {
      scrollPanelToElement(container, { offset: 24 });
    } catch (error) {
      // Fall back to native scrolling if the helper throws.
    }
  }

  try {
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    container.scrollIntoView(true);
  }
}

export function renderTowerSummaries(summaries = []) {
  const { towerList, emptyTowerNote } = elements;
  if (!towerList) {
    return;
  }
  clearChildren(towerList);
  const entries = Array.isArray(summaries) ? summaries : [];
  if (!entries.length) {
    if (emptyTowerNote) {
      emptyTowerNote.hidden = false;
    }
    return;
  }
  if (emptyTowerNote) {
    emptyTowerNote.hidden = true;
  }
  entries.forEach((summary) => {
    towerList.appendChild(renderTowerSummaryItem(summary));
  });
}

export function renderAttackLog(entries = []) {
  const { attackList, emptyAttackNote } = elements;
  if (!attackList) {
    return;
  }
  clearChildren(attackList);
  const logs = Array.isArray(entries) ? entries : [];
  if (!logs.length) {
    if (emptyAttackNote) {
      emptyAttackNote.hidden = false;
    }
    return;
  }
  if (emptyAttackNote) {
    emptyAttackNote.hidden = true;
  }
  logs.forEach((entry) => {
    attackList.appendChild(renderAttackLogItem(entry));
  });
}

export function renderEnemyHistory(entries = []) {
  const { enemyList, emptyEnemyNote } = elements;
  if (!enemyList) {
    return;
  }
  clearChildren(enemyList);
  const history = Array.isArray(entries) ? entries : [];
  if (!history.length) {
    if (emptyEnemyNote) {
      emptyEnemyNote.hidden = false;
    }
    return;
  }
  if (emptyEnemyNote) {
    emptyEnemyNote.hidden = true;
  }
  history.forEach((entry) => {
    enemyList.appendChild(renderEnemyHistoryItem(entry));
  });
}

/**
 * Render the remaining enemies for the active wave so players can preview spawns.
 */
export function renderCurrentWaveQueue(queue = null) {
  const { currentWaveList, emptyCurrentWaveNote } = elements;
  if (!currentWaveList) {
    return;
  }
  clearChildren(currentWaveList);
  currentWaveEntries = Array.isArray(queue?.entries)
    ? queue.entries.map(clonePanelEntry).filter(Boolean)
    : [];
  if (!currentWaveEntries.length) {
    if (emptyCurrentWaveNote) {
      emptyCurrentWaveNote.hidden = false;
    }
    refreshDialogIfVisible();
    return;
  }
  if (emptyCurrentWaveNote) {
    emptyCurrentWaveNote.hidden = true;
  }
  currentWaveEntries.forEach((entry) => {
    currentWaveList.appendChild(createEnemyButton(entry, 'currentWave'));
  });
  updateFocusedButtons();
  refreshDialogIfVisible();
}

/**
 * Present the upcoming wave preview so strategists can prepare before the spawn.
 */
export function renderNextWaveQueue(queue = null) {
  const { nextWaveList, emptyNextWaveNote } = elements;
  if (!nextWaveList) {
    return;
  }
  clearChildren(nextWaveList);
  nextWaveEntries = Array.isArray(queue?.entries)
    ? queue.entries.map(clonePanelEntry).filter(Boolean)
    : [];
  if (!nextWaveEntries.length) {
    if (emptyNextWaveNote) {
      emptyNextWaveNote.hidden = false;
    }
    refreshDialogIfVisible();
    return;
  }
  if (emptyNextWaveNote) {
    emptyNextWaveNote.hidden = true;
  }
  nextWaveEntries.forEach((entry) => {
    nextWaveList.appendChild(createEnemyButton(entry, 'nextWave'));
  });
  updateFocusedButtons();
  refreshDialogIfVisible();
}

/**
 * Surface live battlefield enemies so their exponents and rewards update in real time.
 */
export function renderActiveEnemyList(entries = []) {
  const { activeEnemyList, emptyActiveEnemyNote } = elements;
  if (!activeEnemyList) {
    return;
  }
  clearChildren(activeEnemyList);
  activeEnemyEntries = Array.isArray(entries)
    ? entries.map(clonePanelEntry).filter(Boolean)
    : [];
  if (!activeEnemyEntries.length) {
    if (emptyActiveEnemyNote) {
      emptyActiveEnemyNote.hidden = false;
    }
    refreshDialogIfVisible();
    return;
  }
  if (emptyActiveEnemyNote) {
    emptyActiveEnemyNote.hidden = true;
  }
  activeEnemyEntries.forEach((entry) => {
    activeEnemyList.appendChild(createEnemyButton(entry, 'activeEnemy'));
  });
  updateFocusedButtons();
  refreshDialogIfVisible();
}

/**
 * Allow the playfield to provide highlight callbacks for selected active enemies.
 */
export function setInteractionHandlers({ focusEnemy = null, clearEnemyFocus = null } = {}) {
  interactionHandlers.focusEnemy = typeof focusEnemy === 'function' ? focusEnemy : null;
  interactionHandlers.clearEnemyFocus =
    typeof clearEnemyFocus === 'function' ? clearEnemyFocus : null;
}

export function resolveTowerIcon(type) {
  const display = resolveTowerDisplay(type);
  return display.icon || null;
}

export function resolveTowerName(type) {
  const display = resolveTowerDisplay(type);
  return display.name;
}
