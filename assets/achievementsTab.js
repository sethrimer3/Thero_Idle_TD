import { formatGameNumber, formatWholeNumber } from '../scripts/core/formatting.js';

// Achievements tab logic extracted from the main script to keep state and rendering scoped here.

const ACHIEVEMENT_REWARD_FLUX = 1;

const achievementState = new Map();
const achievementElements = new Map();
let achievementDefinitions = [];
let achievementGridEl = null;
let achievementPowderRate = 0;
let context = null;
let overlayElements = null; // Stores the lazily created overlay nodes for cinematic reveals.
let overlayState = null; // Tracks the currently animating achievement so it can return home.

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
    tile.setAttribute('aria-haspopup', 'dialog');
    tile.setAttribute('aria-label', `${definition.title} achievement. Activate to view reward details.`);
    tile.addEventListener('click', () => {
      // Launch the cinematic overlay describing this achievement.
      presentAchievementCinematic(definition.id);
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
      icon,
    });
  });

  achievementGridEl.setAttribute('role', 'list');
  achievementGridEl.append(fragment);
}

// Lazily creates the overlay elements that provide the cinematic achievement reveal.
function ensureAchievementOverlay() {
  if (overlayElements) {
    return overlayElements;
  }

  const overlay = document.createElement('div');
  overlay.className = 'achievement-overlay';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('tabindex', '-1'); // Allow the overlay to receive focus for keyboard dismissal.

  const backdrop = document.createElement('div');
  backdrop.className = 'achievement-overlay__backdrop';

  const content = document.createElement('div');
  content.className = 'achievement-overlay__content';

  const iconTarget = document.createElement('div');
  iconTarget.className = 'achievement-overlay__icon';

  const title = document.createElement('h3');
  title.className = 'achievement-overlay__title';

  const subtitle = document.createElement('p');
  subtitle.className = 'achievement-overlay__subtitle';

  const description = document.createElement('p');
  description.className = 'achievement-overlay__description';

  const status = document.createElement('p');
  status.className = 'achievement-overlay__status';

  const reward = document.createElement('p');
  reward.className = 'achievement-overlay__reward';

  const hint = document.createElement('p');
  hint.className = 'achievement-overlay__hint';
  hint.textContent = 'Tap anywhere to continue.';

  content.append(iconTarget, title, subtitle, description, status, reward, hint);

  const floatingIcon = document.createElement('div');
  floatingIcon.className = 'achievement-overlay__icon-floating';
  floatingIcon.hidden = true;

  overlay.append(backdrop, content, floatingIcon);

  overlay.addEventListener('click', () => {
    // Allow tapping the dimmed screen to close the cinematic overlay.
    dismissAchievementCinematic();
  });

  overlay.addEventListener('keydown', (event) => {
    // Support pressing Escape to close the cinematic overlay.
    if (event.key === 'Escape') {
      event.preventDefault();
      dismissAchievementCinematic();
    }
  });

  floatingIcon.addEventListener('transitionend', (event) => {
    // Handle the end of the icon flight to reveal or hide the supporting text.
    if (event.propertyName !== 'transform') {
      return;
    }

    if (!overlayElements) {
      return;
    }

    const { overlay: overlayEl, iconTarget: iconEl, content: contentEl } = overlayElements;
    if (overlayEl.classList.contains('closing')) {
      const focusTarget = overlayState?.trigger || null;
      if (overlayState?.originIcon) {
        overlayState.originIcon.classList.remove('achievement-icon-hidden');
      }
      overlayEl.hidden = true;
      overlayEl.setAttribute('aria-hidden', 'true');
      overlayEl.classList.remove('closing');
      iconEl.classList.remove('visible');
      contentEl.classList.remove('text-visible');
      floatingIcon.hidden = true;
      overlayState = null;
      if (focusTarget && typeof focusTarget.focus === 'function') {
        focusTarget.focus();
      }
      return;
    }

    floatingIcon.hidden = true;
    iconEl.classList.add('visible');
    contentEl.classList.add('text-visible');
  });

  document.body.append(overlay);

  overlayElements = {
    overlay,
    backdrop,
    content,
    iconTarget,
    title,
    subtitle,
    description,
    status,
    reward,
    hint,
    floatingIcon,
  };

  return overlayElements;
}

// Animates the tapped achievement icon into the overlay and reveals its supporting text.
function presentAchievementCinematic(id) {
  if (overlayState) {
    return;
  }

  const definition = achievementDefinitions.find((candidate) => candidate.id === id);
  const elements = achievementElements.get(id);
  if (!definition || !elements?.container || !elements.icon) {
    return;
  }

  const { icon: iconSource } = elements;
  const originRect = iconSource.getBoundingClientRect();
  if (!originRect?.width || !originRect?.height) {
    return;
  }

  const overlayEls = ensureAchievementOverlay();

  overlayEls.iconTarget.textContent = iconSource.textContent || definition.icon || '';
  overlayEls.iconTarget.classList.remove('visible');

  overlayEls.title.textContent = definition.title || '';

  const subtitleText = definition.subtitle && definition.subtitle !== definition.title ? definition.subtitle : '';
  overlayEls.subtitle.textContent = subtitleText;
  overlayEls.subtitle.hidden = !subtitleText;

  overlayEls.description.textContent = definition.description || '';
  overlayEls.description.hidden = !definition.description;

  const statusText = elements.status?.textContent || '';
  overlayEls.status.textContent = statusText;
  overlayEls.status.hidden = !statusText;

  const rewardFlux = Number.isFinite(definition.rewardFlux) ? definition.rewardFlux : ACHIEVEMENT_REWARD_FLUX;
  overlayEls.reward.textContent = `Reward · +${formatGameNumber(rewardFlux)} Motes/min idle.`;

  overlayEls.content.classList.remove('text-visible');
  overlayEls.hint.hidden = false;

  overlayEls.overlay.hidden = false;
  overlayEls.overlay.setAttribute('aria-hidden', 'false');
  overlayEls.overlay.classList.remove('closing');
  overlayEls.overlay.classList.add('visible');
  overlayEls.overlay.focus(); // Move focus to the dialog so keyboard users can dismiss it.

  overlayEls.floatingIcon.hidden = false;
  overlayEls.floatingIcon.textContent = iconSource.textContent || definition.icon || '';
  overlayEls.floatingIcon.style.left = `${originRect.left}px`;
  overlayEls.floatingIcon.style.top = `${originRect.top}px`;
  overlayEls.floatingIcon.style.width = `${originRect.width}px`;
  overlayEls.floatingIcon.style.height = `${originRect.height}px`;
  overlayEls.floatingIcon.style.transform = 'translate(0px, 0px) scale(1)';

  iconSource.classList.add('achievement-icon-hidden');

  overlayState = {
    id,
    originIcon: iconSource,
    trigger: elements.container,
  };

  requestAnimationFrame(() => {
    const targetRect = overlayEls.iconTarget.getBoundingClientRect();
    const deltaX = targetRect.left - originRect.left;
    const deltaY = targetRect.top - originRect.top;
    const scale = originRect.width ? targetRect.width / originRect.width : 1;
    overlayEls.floatingIcon.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scale})`;
  });
}

// Returns the overlay icon to its original tile and clears the cinematic overlay state.
function dismissAchievementCinematic() {
  if (!overlayState) {
    return;
  }

  const overlayEls = ensureAchievementOverlay();
  if (overlayEls.overlay.classList.contains('closing')) {
    return;
  }

  overlayEls.overlay.classList.remove('visible');
  overlayEls.overlay.classList.add('closing');
  overlayEls.content.classList.remove('text-visible');
  overlayEls.iconTarget.classList.remove('visible');

  const originIcon = overlayState.originIcon;
  const originRect = originIcon.getBoundingClientRect();
  const targetRect = overlayEls.iconTarget.getBoundingClientRect();

  overlayEls.floatingIcon.hidden = false;
  overlayEls.floatingIcon.textContent = overlayEls.iconTarget.textContent;
  overlayEls.floatingIcon.style.left = `${originRect.left}px`;
  overlayEls.floatingIcon.style.top = `${originRect.top}px`;
  overlayEls.floatingIcon.style.width = `${originRect.width}px`;
  overlayEls.floatingIcon.style.height = `${originRect.height}px`;
  const targetScale = originRect.width ? targetRect.width / originRect.width : 1;
  overlayEls.floatingIcon.style.transform = `translate(${targetRect.left - originRect.left}px, ${targetRect.top - originRect.top}px) scale(${targetScale})`;

  requestAnimationFrame(() => {
    overlayEls.floatingIcon.style.transform = 'translate(0px, 0px) scale(1)';
  });
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
      container.setAttribute('aria-label', `${definition.title} achievement. ${status.textContent} Activate to view reward details.`);
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
    container.setAttribute('aria-label', `${definition.title} achievement. ${status.textContent} Activate to view reward details.`);
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
