import { formatGameNumber, formatWholeNumber } from '../scripts/core/formatting.js';

// Achievements tab logic extracted from the main script to keep state and rendering scoped here.

const ACHIEVEMENT_REWARD_FLUX = 1;

const achievementState = new Map();
const achievementElements = new Map();
let achievementDefinitions = [];
let achievementGridEl = null;
let activeAchievementId = null;
let achievementPowderRate = 0;
let context = null;

function getContext() {
  if (!context) {
    throw new Error('configureAchievementsTab must be called before using achievements functions');
  }
  return context;
}

// Configures shared dependencies required by the achievement helpers.
export function configureAchievementsTab(options) {
  context = { ...options };
}

// Generates a status label describing how close a level is to being sealed.
function describeLevelAchievementProgress(levelId, shortLabel, longLabel) {
  const { levelState } = getContext();
  const state = levelState.get(levelId) || {};
  if (state.completed) {
    return 'Victory sealed · +1 Motes/min secured.';
  }

  const bestWave = Number.isFinite(state.bestWave) ? state.bestWave : 0;
  const label = shortLabel || longLabel || levelId || 'Level';
  if (bestWave > 0) {
    return `Locked — Best wave ${formatWholeNumber(bestWave)}. Seal ${label} to unlock.`;
  }
  return `Locked — Seal ${label} to unlock.`;
}

// Builds an achievement definition for a single level entry.
function createLevelAchievementDefinition(levelId, ordinal) {
  const { levelConfigs, isLevelCompleted, THERO_SYMBOL: theroSymbol } = getContext();
  const levelConfig = levelConfigs.get(levelId);
  if (!levelConfig || levelConfig.developerOnly) {
    return null;
  }

  const id = `level-${ordinal}`;
  const displayName = levelConfig.displayName || levelConfig.title || levelConfig.id || `Level ${ordinal}`;
  const shortLabel = levelConfig.id || displayName;
  const icon = String(ordinal);

  const rewardSegments = [];
  if (Number.isFinite(levelConfig.startThero)) {
    rewardSegments.push(`Start ${formatWholeNumber(levelConfig.startThero)} ${theroSymbol}.`);
  }
  if (Number.isFinite(levelConfig.rewardFlux)) {
    rewardSegments.push(`Victory awards +${formatGameNumber(levelConfig.rewardFlux)} Motes.`);
  }
  if (Number.isFinite(levelConfig.rewardScore)) {
    rewardSegments.push(`Score bonus ${formatGameNumber(levelConfig.rewardScore)} Σ.`);
  }
  if (Number.isFinite(levelConfig.rewardEnergy)) {
    rewardSegments.push(`Energy bonus +${formatGameNumber(levelConfig.rewardEnergy)} TD.`);
  }

  const rewardSummary = rewardSegments.join(' ');
  const description = `${displayName} — seal ${shortLabel} to claim the idle mote seal. ${rewardSummary}`.trim();

  return {
    id,
    levelId,
    title: displayName,
    subtitle: shortLabel,
    icon,
    rewardFlux: ACHIEVEMENT_REWARD_FLUX,
    description: `${description} Unlocking adds +${ACHIEVEMENT_REWARD_FLUX} Motes/min to idle reserves.`,
    condition: () => isLevelCompleted(levelId),
    progress: () => describeLevelAchievementProgress(levelId, shortLabel, displayName),
  };
}

// Recomputes the full achievements list using the current interactive level order.
export function generateLevelAchievements() {
  const { getInteractiveLevelOrder, updateResourceRates, updatePowderLedger } = getContext();
  let ordinal = 0;
  const definitions = [];

  const order = typeof getInteractiveLevelOrder === 'function' ? getInteractiveLevelOrder() : [];
  order.forEach((levelId) => {
    const candidate = createLevelAchievementDefinition(levelId, ordinal + 1);
    if (!candidate) {
      return;
    }
    ordinal += 1;
    definitions.push(candidate);
  });

  achievementDefinitions = definitions;
  const allowedIds = new Set(definitions.map((definition) => definition.id));
  Array.from(achievementState.keys()).forEach((key) => {
    if (!allowedIds.has(key)) {
      achievementState.delete(key);
    }
  });

  refreshAchievementPowderRate();

  if (achievementGridEl) {
    renderAchievementGrid();
    evaluateAchievements();
    if (typeof updateResourceRates === 'function') {
      updateResourceRates();
    }
    if (typeof updatePowderLedger === 'function') {
      updatePowderLedger();
    }
  }
}

// Marks one achievement tile as expanded for accessibility and detail visibility.
function setActiveAchievement(id) {
  const nextId = id && achievementElements.has(id) && activeAchievementId !== id ? id : null;
  activeAchievementId = nextId;

  achievementElements.forEach((element, elementId) => {
    const expanded = elementId === activeAchievementId;
    if (element.container) {
      element.container.classList.toggle('expanded', expanded);
      element.container.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
    if (element.detail) {
      element.detail.hidden = !expanded;
    }
  });
}

// Renders the tile grid for the achievements tab.
function renderAchievementGrid() {
  if (!achievementGridEl) {
    achievementGridEl = document.getElementById('achievement-grid');
  }
  if (!achievementGridEl) {
    return;
  }

  achievementElements.clear();
  achievementGridEl.innerHTML = '';

  if (!achievementDefinitions.length) {
    achievementGridEl.setAttribute('role', 'list');
    activeAchievementId = null;
    return;
  }

  const fragment = document.createDocumentFragment();

  achievementDefinitions.forEach((definition, index) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'achievement-tile';
    tile.dataset.achievementId = definition.id;
    tile.setAttribute('role', 'listitem');
    tile.setAttribute('aria-expanded', 'false');
    tile.setAttribute('aria-label', `${definition.title} achievement. Activate to view details.`);
    tile.addEventListener('click', () => {
      setActiveAchievement(definition.id);
    });

    const icon = document.createElement('span');
    icon.className = 'achievement-icon';
    icon.textContent = definition.icon || String(index + 1);
    icon.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'achievement-label';
    label.textContent = definition.title;

    const detail = document.createElement('div');
    detail.className = 'achievement-detail';
    detail.hidden = true;

    if (definition.subtitle && definition.subtitle !== definition.title) {
      const subtitle = document.createElement('p');
      subtitle.className = 'achievement-subtitle';
      subtitle.textContent = definition.subtitle;
      detail.append(subtitle);
    }

    if (definition.description) {
      const description = document.createElement('p');
      description.className = 'achievement-description';
      description.textContent = definition.description;
      detail.append(description);
    }

    const status = document.createElement('p');
    status.className = 'achievement-status';
    status.textContent = 'Locked — Seal this level to unlock.';
    detail.append(status);

    tile.append(icon, label, detail);
    fragment.append(tile);

    achievementElements.set(definition.id, {
      container: tile,
      status,
      detail,
    });
  });

  achievementGridEl.setAttribute('role', 'list');
  achievementGridEl.append(fragment);
  setActiveAchievement(null);
}

// Initializes the achievements tab when the interface binds event handlers.
export function bindAchievements() {
  renderAchievementGrid();
  evaluateAchievements();
  refreshAchievementPowderRate();
  const { updateResourceRates, updatePowderLedger } = getContext();
  if (typeof updateResourceRates === 'function') {
    updateResourceRates();
  }
  if (typeof updatePowderLedger === 'function') {
    updatePowderLedger();
  }
}

// Refreshes the visual status of a single achievement tile.
function updateAchievementStatus(definition, element, state) {
  if (!definition || !element) {
    return;
  }
  const { container, status } = element;
  if (state?.unlocked) {
    if (container) {
      container.classList.add('achievement-unlocked');
    }
    if (status) {
      status.textContent = 'Unlocked · +1 Motes/min secured.';
    }
    if (container && status) {
      container.setAttribute('aria-label', `${definition.title} achievement. ${status.textContent} Activate to view details.`);
    }
    return;
  }

  if (container) {
    container.classList.remove('achievement-unlocked');
  }
  if (status) {
    const progress = typeof definition.progress === 'function' ? definition.progress() : 'Locked';
    status.textContent = progress.startsWith('Locked') ? progress : `Locked — ${progress}`;
  }
  if (container && status) {
    container.setAttribute('aria-label', `${definition.title} achievement. ${status.textContent} Activate to view details.`);
  }
}

// Checks all achievements to unlock any that now satisfy their condition.
export function evaluateAchievements() {
  achievementDefinitions.forEach((definition) => {
    const state = achievementState.get(definition.id);
    if (!state?.unlocked && typeof definition.condition === 'function' && definition.condition()) {
      unlockAchievement(definition);
    } else {
      updateAchievementStatus(definition, achievementElements.get(definition.id), state || null);
    }
  });
}

// Unlocks an achievement and propagates reward updates through dependent systems.
function unlockAchievement(definition) {
  if (!definition) {
    return;
  }
  const existing = achievementState.get(definition.id);
  if (existing?.unlocked) {
    updateAchievementStatus(definition, achievementElements.get(definition.id), existing);
    return;
  }

  const state = { unlocked: true, unlockedAt: Date.now() };
  achievementState.set(definition.id, state);

  const element = achievementElements.get(definition.id);
  updateAchievementStatus(definition, element, state);

  const { recordPowderEvent, updateResourceRates, updatePowderLedger, updateStatusDisplays } = getContext();

  refreshAchievementPowderRate();

  if (typeof updateResourceRates === 'function') {
    updateResourceRates();
  }
  if (typeof updatePowderLedger === 'function') {
    updatePowderLedger();
  }
  if (typeof recordPowderEvent === 'function') {
    recordPowderEvent('achievement-unlocked', { title: definition.title });
  }
  if (typeof updateStatusDisplays === 'function') {
    updateStatusDisplays();
  }
}

// Returns the count of achievements that have been sealed.
export function getUnlockedAchievementCount() {
  return Array.from(achievementState.values()).filter((state) => state?.unlocked).length;
}

// Recomputes the idle powder reward provided by unlocked achievements.
export function refreshAchievementPowderRate() {
  achievementPowderRate = getUnlockedAchievementCount() * ACHIEVEMENT_REWARD_FLUX;
  return achievementPowderRate;
}

// Exposes the cached idle powder reward rate for resource calculations.
export function getAchievementPowderRate() {
  return achievementPowderRate;
}

// Notifies the achievement system that a tower was placed within a defense.
export function notifyTowerPlaced(activeCount) {
  const { gameStats } = getContext();
  if (gameStats) {
    gameStats.towersPlaced += 1;
    if (Number.isFinite(activeCount)) {
      gameStats.maxTowersSimultaneous = Math.max(gameStats.maxTowersSimultaneous, activeCount);
    }
  }
  evaluateAchievements();
}
