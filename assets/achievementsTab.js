import { formatGameNumber, formatWholeNumber } from '../scripts/core/formatting.js';
import { fetchJsonWithFallback } from './gameplayConfigLoaders.js';
import { GEM_DEFINITIONS } from './enemies.js';

// Achievements tab logic extracted from the main script to keep state and rendering scoped here.

const ACHIEVEMENT_REWARD_FLUX = 1;
const ACHIEVEMENT_REVEAL_TIMEOUT_MS = 420; // Fallback delay before forcing the overlay text to appear.
const ACHIEVEMENT_DISMISS_TIMEOUT_MS = 520; // Ensures the overlay always resets even if transitions are interrupted.
const SECRET_PLACEHOLDER_TEXT = '???'; // Placeholder for locked secret achievements

const ACHIEVEMENT_DATA_RELATIVE_PATH = './data/achievements.json';
const ACHIEVEMENT_DATA_URL = new URL(ACHIEVEMENT_DATA_RELATIVE_PATH, import.meta.url);

// Achievement categories with their configuration
const ACHIEVEMENT_CATEGORIES = [
  { id: 'campaign-story', name: 'Campaign: Story', icon: 'assets/images/campaign-story.svg', iconType: 'svg', type: 'campaign', campaign: 'Story' },
  { id: 'campaign-challenges', name: 'Campaign: Challenges', icon: '⚔️', type: 'campaign', campaign: 'Challenges' },
  { id: 'campaign-ladder', name: 'Campaign: Ladder', icon: 'assets/images/campaign-ladder.svg', iconType: 'svg', type: 'campaign', campaign: 'Ladder' },
  { id: 'spire-powder', name: 'Aleph Spire Glyphs', icon: 'ℵ', type: 'spire', spireId: 'powder' },
  { id: 'spire-fluid', name: 'Bet Spire Glyphs', icon: 'בּ', type: 'spire', spireId: 'fluid' },
  { id: 'spire-lamed', name: 'Lamed Spire Glyphs', icon: 'ל', type: 'spire', spireId: 'lamed' },
  { id: 'spire-tsadi', name: 'Tsadi Spire Glyphs', icon: 'צ', type: 'spire', spireId: 'tsadi' },
  { id: 'spire-shin', name: 'Shin Spire Glyphs', icon: 'ש', type: 'spire', spireId: 'shin' },
  { id: 'spire-kuf', name: 'Kuf Spire Glyphs', icon: 'ק', type: 'spire', spireId: 'kuf' },
  { id: 'secret', name: 'Secret Achievements', icon: '❓', type: 'secret' },
];

const achievementState = new Map();
const achievementElements = new Map();
let achievementDefinitions = [];
let achievementsByCategory = new Map();
let achievementGridEl = null;
let achievementPowderRate = 0;
let context = null;
let overlayElements = null; // Stores the lazily created overlay nodes for cinematic reveals.
let overlayState = null; // Tracks the currently animating achievement so it can return home.
let achievementMetadata = [];
let achievementMetadataLoadPromise = null;
let openDropdowns = new Set(); // Track which dropdowns are currently open

// Clear any pending timeout that would reveal the overlay text.
function clearOverlayRevealTimer() {
  if (overlayState?.revealTimer) {
    window.clearTimeout(overlayState.revealTimer);
    overlayState.revealTimer = null;
  }
}

// Cancel a pending timeout that would forcibly reset the overlay during dismissal.
function clearOverlayDismissTimer() {
  if (overlayState?.dismissTimer) {
    window.clearTimeout(overlayState.dismissTimer);
    overlayState.dismissTimer = null;
  }
}

// Ensure the overlay icon and descriptive text become visible even if the animation does not emit transition events.
function revealAchievementOverlayContent() {
  if (!overlayElements || overlayElements.overlay.classList.contains('closing')) {
    return;
  }
  overlayElements.floatingIcon.hidden = true;
  overlayElements.iconTarget.classList.add('visible');
  overlayElements.content.classList.add('text-visible');
}

// Schedule a fallback reveal so keyboard-only users still see the description when transitions are interrupted.
function scheduleAchievementOverlayRevealFallback() {
  if (!overlayState) {
    return;
  }
  clearOverlayRevealTimer();
  overlayState.revealTimer = window.setTimeout(() => {
    if (!overlayState || !overlayElements || overlayElements.overlay.classList.contains('closing')) {
      return;
    }
    overlayState.revealTimer = null;
    revealAchievementOverlayContent();
  }, ACHIEVEMENT_REVEAL_TIMEOUT_MS);
}

function scheduleAchievementOverlayDismissFallback() {
  if (!overlayState) {
    return;
  }
  clearOverlayDismissTimer();
  overlayState.dismissTimer = window.setTimeout(() => {
    finalizeAchievementOverlayDismissal();
  }, ACHIEVEMENT_DISMISS_TIMEOUT_MS);
}

function finalizeAchievementOverlayDismissal() {
  if (!overlayState || !overlayElements) {
    overlayState = null;
    return;
  }
  clearOverlayDismissTimer();
  clearOverlayRevealTimer();
  const focusTarget = overlayState.trigger || null;
  if (overlayState.originIcon) {
    overlayState.originIcon.classList.remove('achievement-icon-hidden');
  }
  overlayElements.overlay.hidden = true;
  overlayElements.overlay.setAttribute('aria-hidden', 'true');
  overlayElements.overlay.classList.remove('closing');
  overlayElements.overlay.classList.remove('visible');
  overlayElements.iconTarget.classList.remove('visible');
  overlayElements.content.classList.remove('text-visible');
  overlayElements.floatingIcon.hidden = true;
  const restoreFocus = typeof focusTarget?.focus === 'function' ? focusTarget : null;
  overlayState = null;
  if (restoreFocus) {
    restoreFocus.focus();
  }
}

function normalizeAchievementMetadata(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const levelId = typeof entry.levelId === 'string' && entry.levelId.trim() ? entry.levelId.trim() : null;
  if (!levelId) {
    return null;
  }
  const idCandidate = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : null;
  const title = typeof entry.title === 'string' && entry.title.trim() ? entry.title.trim() : levelId;
  const subtitle = typeof entry.subtitle === 'string' && entry.subtitle.trim() ? entry.subtitle.trim() : null;
  const description = typeof entry.description === 'string' && entry.description.trim()
    ? entry.description.trim()
    : null;
  const icon = typeof entry.icon === 'string' && entry.icon.trim() ? entry.icon.trim() : null;
  const rewardFlux = Number.isFinite(entry.rewardFlux) ? entry.rewardFlux : null;
  return {
    id: idCandidate || `achievement-${levelId.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    levelId,
    title,
    subtitle,
    description,
    icon,
    rewardFlux,
  };
}

async function loadAchievementMetadata() {
  if (achievementMetadata.length) {
    return achievementMetadata;
  }
  if (!achievementMetadataLoadPromise) {
    achievementMetadataLoadPromise = (async () => {
      try {
        const payload = await fetchJsonWithFallback(
          ACHIEVEMENT_DATA_URL.href,
          ACHIEVEMENT_DATA_RELATIVE_PATH,
        );
        const list = Array.isArray(payload?.achievements)
          ? payload.achievements
          : Array.isArray(payload)
            ? payload
            : [];
        achievementMetadata = list.map(normalizeAchievementMetadata).filter(Boolean);
      } catch (error) {
        console.warn('Failed to load achievement metadata.', error);
        achievementMetadata = [];
      } finally {
        achievementMetadataLoadPromise = null;
      }
      return achievementMetadata;
    })();
  }
  return achievementMetadataLoadPromise;
}

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
function createLevelAchievementDefinition(levelId, ordinal, metadataMap) {
  const { levelConfigs, isLevelCompleted, THERO_SYMBOL: theroSymbol } = getContext();
  const levelConfig = levelConfigs.get(levelId);
  if (!levelConfig || levelConfig.developerOnly) {
    return null;
  }

  const metadata = metadataMap?.get(levelId) || null;

  const id = metadata?.id || `level-${ordinal}`;
  const displayName = metadata?.title || levelConfig.displayName || levelConfig.title || levelConfig.id || `Level ${ordinal}`;
  const shortLabel = metadata?.subtitle || levelConfig.id || displayName;
  const icon = metadata?.icon || String(ordinal);

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
  const rewardFlux = Number.isFinite(metadata?.rewardFlux) ? metadata.rewardFlux : ACHIEVEMENT_REWARD_FLUX;
  const baseDescription = metadata?.description
    ? `${metadata.description}`
    : `${displayName} — seal ${shortLabel} to claim the idle mote seal. ${rewardSummary}`.trim();

  // Determine campaign category based on level config
  const campaign = levelConfig.campaign || 'Story';
  let categoryId = 'campaign-story';
  if (campaign === 'Challenges') {
    categoryId = 'campaign-challenges';
  } else if (campaign === 'Ladder') {
    categoryId = 'campaign-ladder';
  }

  return {
    id,
    levelId,
    categoryId,
    title: displayName,
    subtitle: shortLabel,
    icon,
    rewardFlux,
    description: `${baseDescription} Unlocking adds +${rewardFlux} Motes/min to idle reserves.`.trim(),
    condition: () => isLevelCompleted(levelId),
    progress: () => describeLevelAchievementProgress(levelId, shortLabel, displayName),
  };
}

// Helper to get glyph count for a spire (handles powder/fluid differently)
function getSpireGlyphCount(spireId) {
  const { spireResourceState, powderState } = getContext();
  
  // Powder and fluid use powderState tracking
  if (spireId === 'powder' && powderState) {
    return powderState.glyphsAwarded || 0;
  }
  if (spireId === 'fluid' && powderState) {
    return powderState.fluidGlyphsAwarded || 0;
  }
  
  // Advanced spires use their own stats tracking
  if (spireResourceState && spireResourceState[spireId]) {
    const stats = spireResourceState[spireId].stats || {};
    return stats.totalGlyphs || 0;
  }
  
  return 0;
}

// Generate spire glyph achievements for a single spire
function generateSpireAchievements(spireId, spireName, spireIcon) {
  const achievements = [];
  const categoryId = `spire-${spireId}`;
  
  // Achievement for earning 1 glyph
  achievements.push({
    id: `${spireId}-glyph-1`,
    categoryId,
    title: `First ${spireName} Glyph`,
    subtitle: 'Novice',
    icon: spireIcon,
    rewardFlux: ACHIEVEMENT_REWARD_FLUX,
    description: `Earn your first ${spireName} glyph. Unlocking adds +${ACHIEVEMENT_REWARD_FLUX} Motes/min to idle reserves.`,
    condition: () => getSpireGlyphCount(spireId) >= 1,
    progress: () => {
      const glyphs = getSpireGlyphCount(spireId);
      return glyphs >= 1 ? 'Unlocked' : `Locked — ${glyphs}/1 glyphs earned.`;
    },
  });

  // Achievement for earning 10 glyphs
  achievements.push({
    id: `${spireId}-glyph-10`,
    categoryId,
    title: `${spireName} Adept`,
    subtitle: 'Intermediate',
    icon: spireIcon,
    rewardFlux: ACHIEVEMENT_REWARD_FLUX * 2,
    description: `Earn 10 ${spireName} glyphs. Unlocking adds +${ACHIEVEMENT_REWARD_FLUX * 2} Motes/min to idle reserves.`,
    condition: () => getSpireGlyphCount(spireId) >= 10,
    progress: () => {
      const glyphs = getSpireGlyphCount(spireId);
      return glyphs >= 10 ? 'Unlocked' : `Locked — ${glyphs}/10 glyphs earned.`;
    },
  });

  // Achievement for earning 100 glyphs
  achievements.push({
    id: `${spireId}-glyph-100`,
    categoryId,
    title: `${spireName} Master`,
    subtitle: 'Advanced',
    icon: spireIcon,
    rewardFlux: ACHIEVEMENT_REWARD_FLUX * 5,
    description: `Earn 100 ${spireName} glyphs. Unlocking adds +${ACHIEVEMENT_REWARD_FLUX * 5} Motes/min to idle reserves.`,
    condition: () => getSpireGlyphCount(spireId) >= 100,
    progress: () => {
      const glyphs = getSpireGlyphCount(spireId);
      return glyphs >= 100 ? 'Unlocked' : `Locked — ${glyphs}/100 glyphs earned.`;
    },
  });

  return achievements;
}

// Map gem hints by ID for better maintainability
const GEM_HINTS = new Map([
  ['quartz', 'Quartz whispers in the shadows...'],
  ['ruby', 'Ruby gleams in darkness...'],
  ['sunstone', 'Sunstone radiates mystery...'],
  ['citrine', 'Citrine hides its golden secret...'],
  ['emerald', 'Emerald\'s verdant enigma awaits...'],
  ['sapphire', 'Sapphire\'s azure mystery beckons...'],
  ['iolite', 'Iolite\'s violet puzzle unfolds...'],
  ['amethyst', 'Amethyst conceals its purple truth...'],
  ['diamond', 'Diamond\'s crystalline riddle persists...'],
  ['nullstone', 'Nullstone\'s void mystery endures...'],
]);

// Generate secret achievements for gem collection
function generateSecretAchievements() {
  const achievements = [];
  const categoryId = 'secret';

  GEM_DEFINITIONS.forEach((gem, index) => {
    const hint = GEM_HINTS.get(gem.id) || 'A secret awaits...';

    achievements.push({
      id: `secret-gem-${gem.id}`,
      categoryId,
      title: `${SECRET_PLACEHOLDER_TEXT} ${gem.name}`,
      subtitle: gem.name,
      icon: '❓',
      rewardFlux: ACHIEVEMENT_REWARD_FLUX * (index + 1),
      description: `Obtain a ${gem.name} gem. ${hint} Unlocking adds +${ACHIEVEMENT_REWARD_FLUX * (index + 1)} Motes/min to idle reserves.`,
      condition: () => {
        const { moteGemInventory } = getContext();
        if (!moteGemInventory) {
          return false;
        }
        return (moteGemInventory.get(gem.id) || 0) > 0;
      },
      progress: () => {
        const { moteGemInventory } = getContext();
        if (!moteGemInventory) {
          return `Locked — ${hint}`;
        }
        const count = moteGemInventory.get(gem.id) || 0;
        return count > 0 ? 'Unlocked — Secret revealed!' : `Locked — ${hint}`;
      },
      secret: true,
    });
  });

  return achievements;
}

// Recomputes the full achievements list including levels, spires, and secrets.
export async function generateLevelAchievements() {
  try {
    const metadata = await loadAchievementMetadata();
    const metadataMap = new Map((metadata || []).map((entry) => [entry.levelId, entry]));
    const { getInteractiveLevelOrder, updateResourceRates, updatePowderLedger } = getContext();
    const levelOrder = typeof getInteractiveLevelOrder === 'function' ? getInteractiveLevelOrder() : [];

    const definitions = [];

    // Generate level-based achievements
    if (levelOrder.length > 0) {
      levelOrder.forEach((levelId, index) => {
        const definition = createLevelAchievementDefinition(levelId, index + 1, metadataMap);
        if (definition) {
          definitions.push(definition);
        }
      });
    }

    // Generate spire glyph achievements
    const spires = [
      { id: 'powder', name: 'Aleph', icon: 'ℵ' },
      { id: 'fluid', name: 'Bet', icon: 'בּ' },
      { id: 'lamed', name: 'Lamed', icon: 'ל' },
      { id: 'tsadi', name: 'Tsadi', icon: 'צ' },
      { id: 'shin', name: 'Shin', icon: 'ש' },
      { id: 'kuf', name: 'Kuf', icon: 'ק' },
    ];

    spires.forEach(spire => {
      const spireAchievements = generateSpireAchievements(spire.id, spire.name, spire.icon);
      definitions.push(...spireAchievements);
    });

    // Generate secret achievements
    const secretAchievements = generateSecretAchievements();
    definitions.push(...secretAchievements);

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

    return achievementDefinitions;
  } catch (error) {
    console.error('Failed to generate level achievements.', error);
    return achievementDefinitions;
  }
}

// Toggle a dropdown section
function toggleDropdown(categoryId) {
  const isOpen = openDropdowns.has(categoryId);
  const dropdownContent = document.querySelector(`[data-dropdown-content="${categoryId}"]`);
  const toggleButton = document.querySelector(`[data-dropdown-toggle="${categoryId}"]`);
  
  if (!dropdownContent || !toggleButton) {
    return;
  }
  
  if (isOpen) {
    openDropdowns.delete(categoryId);
    dropdownContent.hidden = true;
    dropdownContent.style.display = 'none';
    toggleButton.setAttribute('aria-expanded', 'false');
    toggleButton.classList.remove('achievement-category-toggle--expanded');
  } else {
    openDropdowns.add(categoryId);
    dropdownContent.hidden = false;
    dropdownContent.style.display = 'block';
    toggleButton.setAttribute('aria-expanded', 'true');
    toggleButton.classList.add('achievement-category-toggle--expanded');
  }
}

// Calculate total bonuses for a category
function calculateCategoryBonuses(categoryAchievements) {
  const unlocked = categoryAchievements.filter(def => achievementState.get(def.id)?.unlocked);
  const totalFlux = unlocked.reduce((sum, def) => sum + (def.rewardFlux || ACHIEVEMENT_REWARD_FLUX), 0);
  return { count: unlocked.length, totalFlux };
}

// Render bonuses summary for a category
function renderBonusSummary(categoryAchievements) {
  const { count, totalFlux } = calculateCategoryBonuses(categoryAchievements);
  if (count === 0) {
    return null;
  }
  
  const summary = document.createElement('div');
  summary.className = 'achievement-category-bonuses';
  summary.innerHTML = `
    <p class="achievement-category-bonuses__title">Bonuses Earned:</p>
    <ul class="achievement-category-bonuses__list">
      <li>+${formatGameNumber(totalFlux)} Motes/min idle</li>
    </ul>
  `;
  return summary;
}

// Helper to create an icon element (supports both emoji and SVG)
function createIconElement(category) {
  const iconContainer = document.createElement('span');
  iconContainer.className = 'achievement-category-icon';
  iconContainer.setAttribute('aria-hidden', 'true');
  
  if (category.iconType === 'svg') {
    // For SVG icons, create an img element
    const img = document.createElement('img');
    img.src = category.icon;
    img.alt = '';
    img.className = 'achievement-category-icon__svg';
    iconContainer.appendChild(img);
  } else {
    // For emoji icons, use text content
    iconContainer.textContent = category.icon;
  }
  
  return iconContainer;
}

// Renders the tile grid for the achievements tab with dropdown categories.
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
    achievementGridEl.setAttribute('role', 'region');
    return;
  }

  const fragment = document.createDocumentFragment();

  // Group achievements by category
  achievementsByCategory.clear();
  achievementDefinitions.forEach(definition => {
    const categoryId = definition.categoryId || 'campaign-story';
    if (!achievementsByCategory.has(categoryId)) {
      achievementsByCategory.set(categoryId, []);
    }
    achievementsByCategory.get(categoryId).push(definition);
  });

  // Render each category as a dropdown
  ACHIEVEMENT_CATEGORIES.forEach(category => {
    const categoryAchievements = achievementsByCategory.get(category.id) || [];
    if (categoryAchievements.length === 0) {
      return;
    }

    const categoryContainer = document.createElement('div');
    categoryContainer.className = 'achievement-category';
    categoryContainer.dataset.category = category.id;

    // Toggle button
    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'achievement-category-toggle action-button';
    toggleButton.dataset.dropdownToggle = category.id;
    toggleButton.setAttribute('aria-expanded', 'false');
    
    const unlocked = categoryAchievements.filter(def => achievementState.get(def.id)?.unlocked).length;
    const total = categoryAchievements.length;
    
    const iconSpan = createIconElement(category);
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'achievement-category-label';
    labelSpan.textContent = category.name;
    
    const countSpan = document.createElement('span');
    countSpan.className = 'achievement-category-count';
    countSpan.textContent = `${unlocked}/${total}`;
    
    toggleButton.append(iconSpan, labelSpan, countSpan);
    toggleButton.addEventListener('click', () => toggleDropdown(category.id));
    
    categoryContainer.append(toggleButton);

    // Dropdown content
    const dropdownContent = document.createElement('div');
    dropdownContent.className = 'achievement-category-content';
    dropdownContent.dataset.dropdownContent = category.id;
    dropdownContent.hidden = true;
    dropdownContent.style.display = 'none';

    // Add bonus summary
    const bonusSummary = renderBonusSummary(categoryAchievements);
    if (bonusSummary) {
      dropdownContent.append(bonusSummary);
    }

    // Add achievements grid
    const achievementsGrid = document.createElement('div');
    achievementsGrid.className = 'achievement-tiles-grid';
    achievementsGrid.setAttribute('role', 'list');

    categoryAchievements.forEach((definition, index) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'achievement-tile';
      tile.dataset.achievementId = definition.id;
      tile.setAttribute('role', 'listitem');
      tile.setAttribute('aria-haspopup', 'dialog');
      tile.setAttribute('aria-label', `${definition.title} achievement. Activate to view reward details.`);
      tile.addEventListener('click', () => {
        presentAchievementCinematic(definition.id);
      });

      const icon = document.createElement('span');
      icon.className = 'achievement-icon';
      const state = achievementState.get(definition.id);
      const isUnlocked = state?.unlocked;
      
      // For secret achievements, show question mark when locked
      if (definition.secret && !isUnlocked) {
        icon.textContent = '❓';
        tile.classList.add('achievement-tile--secret-locked');
      } else {
        icon.textContent = definition.icon || String(index + 1);
      }
      icon.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.className = 'achievement-label';
      // For secret achievements, hide title when locked
      if (definition.secret && !isUnlocked) {
        label.textContent = SECRET_PLACEHOLDER_TEXT;
      } else {
        label.textContent = definition.title;
      }

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
      achievementsGrid.append(tile);

      achievementElements.set(definition.id, {
        container: tile,
        status,
        detail,
        icon,
      });
    });

    dropdownContent.append(achievementsGrid);
    categoryContainer.append(dropdownContent);
    fragment.append(categoryContainer);
  });

  achievementGridEl.setAttribute('role', 'region');
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
    clearOverlayRevealTimer();
    if (overlayEl.classList.contains('closing')) {
      finalizeAchievementOverlayDismissal();
      return;
    }

    revealAchievementOverlayContent();
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

  const state = achievementState.get(id);
  const isUnlocked = state?.unlocked;
  const statusText = elements.status?.textContent || '';
  overlayEls.status.textContent = statusText;
  // Hide the status line when achievement is unlocked, keep only the reward line
  overlayEls.status.hidden = !statusText || isUnlocked;

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
  // Ensure the traveling icon starts fully opaque before the forward flight fades out.
  overlayEls.floatingIcon.style.opacity = '1';

  iconSource.classList.add('achievement-icon-hidden');

  overlayState = {
    id,
    originIcon: iconSource,
    trigger: elements.container,
    revealTimer: null,
    dismissTimer: null,
  };
  scheduleAchievementOverlayRevealFallback();

  requestAnimationFrame(() => {
    const targetRect = overlayEls.iconTarget.getBoundingClientRect();
    const deltaX = targetRect.left - originRect.left;
    const deltaY = targetRect.top - originRect.top;
    const scale = originRect.width ? targetRect.width / originRect.width : 1;
    overlayEls.floatingIcon.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scale})`;
    // Fade the icon towards transparent as it reaches the overlay center.
    overlayEls.floatingIcon.style.opacity = '0';
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

  clearOverlayRevealTimer();
  overlayEls.overlay.classList.remove('visible');
  overlayEls.overlay.classList.add('closing');
  overlayEls.content.classList.remove('text-visible');
  overlayEls.iconTarget.classList.remove('visible');

  const originIcon = overlayState.originIcon;
  if (!originIcon) {
    finalizeAchievementOverlayDismissal();
    return;
  }
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
  // Start the return flight transparent so the tile fade-in masks alignment.
  overlayEls.floatingIcon.style.opacity = '0';

  requestAnimationFrame(() => {
    overlayEls.floatingIcon.style.transform = 'translate(0px, 0px) scale(1)';
    // Restore opacity as the icon settles back into the achievements grid.
    overlayEls.floatingIcon.style.opacity = '1';
  });

  scheduleAchievementOverlayDismissFallback();
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
  const { container, status, icon } = element;
  const isUnlocked = state?.unlocked;
  
  if (isUnlocked) {
    if (container) {
      container.classList.add('achievement-unlocked');
      container.classList.remove('achievement-tile--secret-locked');
    }
    
    // Update icon and label for secret achievements when unlocked
    if (definition.secret && icon) {
      icon.textContent = definition.icon || '✓';
      const label = container?.querySelector('.achievement-label');
      if (label) {
        label.textContent = definition.title;
      }
    }
    
    if (status) {
      const rewardFlux = definition.rewardFlux || ACHIEVEMENT_REWARD_FLUX;
      status.textContent = `Unlocked · +${rewardFlux} Motes/min secured.`;
    }
    if (container && status) {
      container.setAttribute('aria-label', `${definition.title} achievement. ${status.textContent} Activate to view reward details.`);
    }
  } else {
    if (container) {
      container.classList.remove('achievement-unlocked');
    }
    
    // Keep secret locked styling for secret achievements
    if (definition.secret && container) {
      container.classList.add('achievement-tile--secret-locked');
    }
    
    if (status) {
      const progress = typeof definition.progress === 'function' ? definition.progress() : 'Locked';
      status.textContent = progress.startsWith('Locked') ? progress : `Locked — ${progress}`;
    }
    if (container && status) {
      const titleText = definition.secret ? SECRET_PLACEHOLDER_TEXT : definition.title;
      container.setAttribute('aria-label', `${titleText} achievement. ${status.textContent} Activate to view reward details.`);
    }
  }
}

// Update category button counts
function updateCategoryButtonCounts() {
  ACHIEVEMENT_CATEGORIES.forEach(category => {
    const categoryAchievements = achievementsByCategory.get(category.id) || [];
    if (categoryAchievements.length === 0) {
      return;
    }
    
    const unlocked = categoryAchievements.filter(def => achievementState.get(def.id)?.unlocked).length;
    const total = categoryAchievements.length;
    
    const toggleButton = document.querySelector(`[data-dropdown-toggle="${category.id}"]`);
    if (toggleButton) {
      const countSpan = toggleButton.querySelector('.achievement-category-count');
      if (countSpan) {
        countSpan.textContent = `${unlocked}/${total}`;
      }
    }
    
    // Update bonus summary if dropdown is open
    if (openDropdowns.has(category.id)) {
      const dropdownContent = document.querySelector(`[data-dropdown-content="${category.id}"]`);
      if (dropdownContent) {
        const existingSummary = dropdownContent.querySelector('.achievement-category-bonuses');
        const newSummary = renderBonusSummary(categoryAchievements);
        
        if (newSummary && existingSummary) {
          existingSummary.replaceWith(newSummary);
        } else if (newSummary && !existingSummary) {
          const achievementsGrid = dropdownContent.querySelector('.achievement-tiles-grid');
          if (achievementsGrid) {
            dropdownContent.insertBefore(newSummary, achievementsGrid);
          }
        } else if (!newSummary && existingSummary) {
          existingSummary.remove();
        }
      }
    }
  });
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
  
  // Update category button counts after evaluating all achievements
  updateCategoryButtonCounts();
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
