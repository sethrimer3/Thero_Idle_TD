/**
 * Playfield combat stats panel orchestrates the optional analytics surface that lives beneath the battlefield.
 * It exposes helpers to toggle visibility, render per-tower damage output with icons, maintain
 * a grouped attack log, and chronicle defeated enemies with their top-damaging towers.
 * SimplePlayfield records battle data and feeds it through this module whenever stats mode is enabled.
 */
import { formatCombatNumber } from './playfield/utils/formatting.js';
import { getTowerDefinition } from './towersTab.js';

const elements = {
  container: null,
  towerList: null,
  attackList: null,
  enemyList: null,
  emptyTowerNote: null,
  emptyAttackNote: null,
  emptyEnemyNote: null,
};

let panelVisible = false;

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
  emptyTowerNote = null,
  emptyAttackNote = null,
  emptyEnemyNote = null,
} = {}) {
  elements.container = container;
  elements.towerList = towerList;
  elements.attackList = attackList;
  elements.enemyList = enemyList;
  elements.emptyTowerNote = emptyTowerNote;
  elements.emptyAttackNote = emptyAttackNote;
  elements.emptyEnemyNote = emptyEnemyNote;
}

export function setVisible(visible) {
  panelVisible = Boolean(visible);
  const { container } = elements;
  if (!container) {
    return;
  }
  if (panelVisible) {
    container.removeAttribute('hidden');
    container.setAttribute('aria-hidden', 'false');
  } else {
    container.setAttribute('hidden', '');
    container.setAttribute('aria-hidden', 'true');
  }
}

export function isVisible() {
  return panelVisible;
}

export function resetPanel() {
  const { towerList, attackList, enemyList, emptyTowerNote, emptyAttackNote, emptyEnemyNote } = elements;
  clearChildren(towerList);
  clearChildren(attackList);
  clearChildren(enemyList);
  if (emptyTowerNote) {
    emptyTowerNote.hidden = false;
  }
  if (emptyAttackNote) {
    emptyAttackNote.hidden = false;
  }
  if (emptyEnemyNote) {
    emptyEnemyNote.hidden = false;
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

export function resolveTowerIcon(type) {
  const display = resolveTowerDisplay(type);
  return display.icon || null;
}

export function resolveTowerName(type) {
  const display = resolveTowerDisplay(type);
  return display.name;
}
