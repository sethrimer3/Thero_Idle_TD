'use strict';

/**
 * Factory that manages the level-selection grid: building level cards, campaign
 * diamonds, set expansion/collapse, lock states, and the active-level banner.
 * Extracted from main.js to reduce its line count and isolate DOM-heavy UI
 * construction from game orchestration.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createLevelGridController({
  // ── Data sources (mutable collections passed by reference) ──────────
  levelBlueprints,
  levelState,
  levelConfigs,
  levelLookup,
  levelSetEntries,
  idleLevelRuns,

  // ── Level query helpers ─────────────────────────────────────────────
  isLevelUnlocked,
  isStoryOnlyLevel,
  isInteractiveLevel,
  isSecretLevelId,
  getPreviewPointsForLevel,
  clampNormalizedCoordinate,

  // ── Formatting & summaries ──────────────────────────────────────────
  formatWholeNumber,
  getLevelSummary,
  describeLevelLastResult,

  // ── UI helpers ──────────────────────────────────────────────────────
  triggerButtonRipple,

  // ── Dynamic state accessors (closures over main.js variables) ──────
  getDeveloperModeActive = () => false,
  getActiveLevelId = () => null,
  getGameStats = () => ({}),
  // Pull current level blueprints via getter so post-load reassignments are reflected.
  getLevelBlueprints = () => levelBlueprints,
  // Pull current level lookup via getter so the active-level banner sees refreshed map metadata.
  getLevelLookup = () => levelLookup,

  // ── Callbacks ───────────────────────────────────────────────────────
  onLevelSelect = () => {},
  onMenuSelectSfx = () => {},
  onStoryCampaignExpand = () => {},
} = {}) {
  // Resolve blueprints lazily because levels.js replaces the exported array after config load.
  const readLevelBlueprints = () => {
    const currentBlueprints = getLevelBlueprints();
    return Array.isArray(currentBlueprints) ? currentBlueprints : [];
  };

  // Resolve the level lookup lazily because levels.js rebuilds the map when blueprints are normalized.
  const readLevelLookup = () => {
    const lookup = getLevelLookup();
    return lookup instanceof Map ? lookup : new Map();
  };

  // ── Internal state ──────────────────────────────────────────────────
  let levelGrid = null;
  let activeLevelEl = null;
  let leaveLevelBtn = null;

  let expandedLevelSet = null;
  let expandedCampaign = null;
  let campaignRowElement = null;
  let campaignButtons = [];
  let tallestCampaignHeight = 0;

  // ── DOM element binding (called after DOM is ready) ─────────────────

  function bindElements({ levelGrid: grid, activeLevelEl: banner, leaveLevelBtn: btn }) {
    levelGrid = grid;
    activeLevelEl = banner;
    leaveLevelBtn = btn;
  }

  // ── Level set expand / collapse ─────────────────────────────────────

  function collapseLevelSet(element, { focusTrigger = false } = {}) {
    if (!element) {
      return;
    }

    const trigger = element.querySelector('.level-set-trigger');
    const levelsContainer = element.querySelector('.level-set-levels');
    element.classList.remove('expanded');

    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      if (focusTrigger && typeof trigger.focus === 'function') {
        trigger.focus();
      }
    }

    if (levelsContainer) {
      levelsContainer.setAttribute('aria-hidden', 'true');
      levelsContainer.querySelectorAll('[data-level]').forEach((node) => {
        node.tabIndex = -1;
      });
    }

    if (expandedLevelSet === element) {
      expandedLevelSet = null;
    }
  }

  function expandLevelSet(element) {
    if (!element || element.classList.contains('locked') || element.hidden) {
      return;
    }

    if (expandedLevelSet && expandedLevelSet !== element) {
      collapseLevelSet(expandedLevelSet);
    }

    const trigger = element.querySelector('.level-set-trigger');
    const levelsContainer = element.querySelector('.level-set-levels');
    element.classList.add('expanded');

    if (trigger) {
      trigger.setAttribute('aria-expanded', 'true');
    }

    if (levelsContainer) {
      levelsContainer.setAttribute('aria-hidden', 'false');
      levelsContainer.querySelectorAll('[data-level]').forEach((node) => {
        const levelId = node.dataset.level;
        const unlocked = levelId ? isLevelUnlocked(levelId) : false;
        node.tabIndex = unlocked ? 0 : -1;
      });
    }

    expandedLevelSet = element;
  }

  // ── Campaign expand / collapse ──────────────────────────────────────

  function measureExpandedCampaignHeight(element) {
    if (!element || !campaignRowElement) {
      return 0;
    }

    const clone = element.cloneNode(true);
    const referenceWidth = element.getBoundingClientRect().width || element.offsetWidth;

    clone.style.position = 'absolute';
    clone.style.visibility = 'hidden';
    clone.style.pointerEvents = 'none';
    clone.style.opacity = '0';
    clone.style.width = `${referenceWidth}px`;
    clone.classList.add('expanded');

    const setsContainer = clone.querySelector('.campaign-button-sets');
    if (setsContainer) {
      setsContainer.hidden = false;
      setsContainer.setAttribute('aria-hidden', 'false');
      setsContainer.style.maxHeight = 'none';
      setsContainer.style.opacity = '1';
      setsContainer.style.transform = 'translateY(0)';
      setsContainer.style.padding = '24px 12px';
    }

    campaignRowElement.append(clone);
    const height = clone.getBoundingClientRect().height;
    clone.remove();

    return height;
  }

  function updateCampaignExpandedHeight(height) {
    if (!campaignRowElement || !height) {
      return;
    }

    tallestCampaignHeight = Math.max(tallestCampaignHeight, height);
    campaignRowElement.style.setProperty('--campaign-expanded-height', `${tallestCampaignHeight}px`);
  }

  function primeCampaignHeightBaseline() {
    const storyCampaign = campaignButtons.find((campaign) => campaign.name === 'Story');
    if (!storyCampaign || !storyCampaign.element) {
      return;
    }

    const measuredHeight = measureExpandedCampaignHeight(storyCampaign.element);
    if (measuredHeight) {
      updateCampaignExpandedHeight(measuredHeight);
    }
  }

  function collapseCampaign(element, { focusTrigger = false } = {}) {
    if (!element) {
      return;
    }

    const trigger = element.querySelector('.campaign-button-trigger');
    const setsContainer = element.querySelector('.campaign-button-sets');

    element.classList.remove('expanded');

    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      if (focusTrigger && typeof trigger.focus === 'function') {
        trigger.focus();
      }
    }

    if (setsContainer) {
      setsContainer.setAttribute('aria-hidden', 'true');
      setsContainer.hidden = true;
    }

    element.querySelectorAll('.level-set.expanded').forEach((levelSet) => {
      collapseLevelSet(levelSet);
    });

    if (expandedCampaign === element) {
      expandedCampaign = null;
      if (campaignRowElement) {
        campaignRowElement.classList.remove('campaign-row--has-selection');
      }
    }
  }

  function expandCampaign(element) {
    if (!element) {
      return;
    }

    if (expandedCampaign && expandedCampaign !== element) {
      collapseCampaign(expandedCampaign);
    }

    const trigger = element.querySelector('.campaign-button-trigger');
    const setsContainer = element.querySelector('.campaign-button-sets');

    element.classList.add('expanded');

    if (trigger) {
      trigger.setAttribute('aria-expanded', 'true');
    }

    if (setsContainer) {
      setsContainer.hidden = false;
      setsContainer.setAttribute('aria-hidden', 'false');
    }

    if (expandedLevelSet) {
      collapseLevelSet(expandedLevelSet);
    }

    if (campaignRowElement) {
      campaignRowElement.classList.add('campaign-row--has-selection');
    }

    updateCampaignExpandedHeight(element.getBoundingClientRect().height);
    expandedCampaign = element;

    // Notify main.js when the Story campaign is opened so cognitive realm
    // visibility can be updated without introducing a circular dependency.
    const campaignName = element.dataset.campaign;
    if (campaignName === 'Story') {
      onStoryCampaignExpand();
    }
  }

  // ── Document-level event handlers ───────────────────────────────────

  function handleDocumentPointerDown(event) {
    const clickedTrigger = event?.target?.closest ? event.target.closest('.level-set-trigger') : null;
    const interactingWithOpenSet =
      clickedTrigger && expandedLevelSet && expandedLevelSet.contains(clickedTrigger);

    if (!interactingWithOpenSet) {
      return;
    }
  }

  function handleDocumentKeyDown(event) {
    if (event.key !== 'Escape') {
      return;
    }

    if (!expandedLevelSet) {
      return;
    }

    const trigger = expandedLevelSet.querySelector('.level-set-trigger');
    if (trigger && typeof trigger.focus === 'function') {
      trigger.focus();
    }
  }

  function handleGlobalButtonPointerDown(event) {
    if (!event) {
      return;
    }
    if (typeof event.button === 'number' && event.button !== 0) {
      return;
    }
    const target = event.target;
    if (!target) {
      return;
    }
    const button = target.closest('button');
    if (!button) {
      return;
    }
    if (button.disabled) {
      return;
    }
    const ariaDisabled = button.getAttribute('aria-disabled');
    if (ariaDisabled && ariaDisabled !== 'false') {
      return;
    }
    triggerButtonRipple(button, event);
  }

  function attachDocumentListeners() {
    document.addEventListener('pointerdown', handleDocumentPointerDown, { passive: true });
    document.addEventListener('pointerdown', handleGlobalButtonPointerDown, { passive: true });
    document.addEventListener('keydown', handleDocumentKeyDown);
  }

  // ── Lock state helpers ──────────────────────────────────────────────

  function areSetNormalLevelsCompleted(levels = []) {
    if (!Array.isArray(levels) || levels.length === 0) {
      return true;
    }
    return levels
      .filter((level) => level && !isSecretLevelId(level.id) && isInteractiveLevel(level.id))
      .every((level) => {
        const state = levelState.get(level.id);
        return Boolean(state && state.completed);
      });
  }

  function isInfinityModeUnlocked() {
    if (getDeveloperModeActive()) {
      return true;
    }
    const stats = getGameStats();
    if (stats && stats.manualVictories > 0) {
      return true;
    }
    for (const state of levelState.values()) {
      if (state?.completed) {
        return true;
      }
    }
    return false;
  }

  function isSvgCampaign(glyphEl) {
    return glyphEl && glyphEl.querySelector('.campaign-button-glyph__image') !== null;
  }

  function updateLevelSetLocks() {
    if (!levelSetEntries.length) {
      return;
    }

    const developerModeActive = getDeveloperModeActive();
    const campaignLocks = new Map();

    levelSetEntries.forEach((entry, index) => {
      if (!entry || !entry.element || !entry.trigger) {
        return;
      }

      const previous = levelSetEntries[index - 1];
      const unlocked = developerModeActive
        || index === 0
        || areSetNormalLevelsCompleted(previous?.levels);

      if (!unlocked && entry.element.classList.contains('expanded')) {
        collapseLevelSet(entry.element);
      }

      if (entry.campaign) {
        const status = campaignLocks.get(entry.campaign) || { anyUnlocked: false };
        campaignLocks.set(entry.campaign, { anyUnlocked: status.anyUnlocked || unlocked });
      }

      entry.element.hidden = false;
      entry.element.setAttribute('aria-hidden', 'false');
      entry.element.classList.toggle('locked', !unlocked);

      entry.trigger.disabled = !unlocked;
      entry.trigger.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
      if (unlocked) {
        entry.trigger.removeAttribute('tabindex');
        entry.trigger.setAttribute('aria-label', `${entry.name} level set`);
        entry.trigger.title = `${entry.name} level set`;
      } else {
        entry.trigger.setAttribute('tabindex', '-1');
        entry.trigger.setAttribute('aria-label', 'Locked level set');
        entry.trigger.title = 'Locked level set';
      }

      if (entry.titleEl) {
        entry.titleEl.textContent = unlocked ? entry.name : 'LOCKED';
      }

      if (entry.countEl) {
        if (unlocked) {
          const countLabel = entry.levels.length === 1 ? 'level' : 'levels';
          entry.countEl.textContent = `${entry.levels.length} ${countLabel}`;
        } else {
          entry.countEl.textContent = 'LOCKED';
        }
      }
    });

    campaignButtons.forEach((campaignButton) => {
      if (!campaignButton || !campaignButton.element || !campaignButton.trigger) {
        return;
      }
      const status = campaignLocks.get(campaignButton.name);
      const glyphEl = campaignButton.glyphEl;
      const displayName = campaignButton.displayName || campaignButton.name;
      const isLocked = !status || !status.anyUnlocked;

      if (isLocked) {
        collapseCampaign(campaignButton.element);
        campaignButton.element.classList.add('campaign-button--locked');
        campaignButton.trigger.disabled = true;
        campaignButton.trigger.setAttribute('aria-disabled', 'true');
        campaignButton.trigger.setAttribute('tabindex', '-1');
        campaignButton.trigger.title = `${displayName} campaign locked`;
        campaignButton.trigger.setAttribute('aria-label', `${displayName} campaign locked`);
        if (glyphEl) {
          if (isSvgCampaign(glyphEl)) {
            glyphEl.style.opacity = '0.4';
            glyphEl.style.filter = 'grayscale(1)';
          } else {
            glyphEl.textContent = '🔒';
          }
        }
      } else {
        campaignButton.element.classList.remove('campaign-button--locked');
        campaignButton.trigger.disabled = false;
        campaignButton.trigger.setAttribute('aria-disabled', 'false');
        campaignButton.trigger.removeAttribute('tabindex');
        campaignButton.trigger.title = `${displayName} campaign`;
        campaignButton.trigger.setAttribute('aria-label', `${displayName} campaign`);
        if (glyphEl) {
          if (isSvgCampaign(glyphEl)) {
            glyphEl.style.opacity = '';
            glyphEl.style.filter = '';
          } else {
            glyphEl.textContent = campaignButton.defaultGlyph;
          }
        }
      }
    });
  }

  // ── Level node preview (SVG path silhouette) ────────────────────────

  function createLevelNodePreview(level) {
    if (isStoryOnlyLevel(level?.id)) {
      return null;
    }
    const previewPoints = getPreviewPointsForLevel(level, levelConfigs);
    if (!Array.isArray(previewPoints) || previewPoints.length < 2) {
      return null;
    }

    const preview = document.createElementNS(SVG_NS, 'svg');
    preview.setAttribute('viewBox', '0 0 100 100');
    preview.setAttribute('class', 'level-node-preview');
    preview.setAttribute('aria-hidden', 'true');

    const padding = 12;
    const span = 100 - padding * 2;
    const pathData = previewPoints
      .map((point) => ({
        x: padding + clampNormalizedCoordinate(point?.x ?? 0.5) * span,
        y: padding + clampNormalizedCoordinate(point?.y ?? 0.5) * span,
      }))
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');

    const glow = document.createElementNS(SVG_NS, 'path');
    glow.setAttribute('d', pathData);
    glow.setAttribute('class', 'level-node-preview__glow');
    preview.append(glow);

    const stroke = document.createElementNS(SVG_NS, 'path');
    stroke.setAttribute('d', pathData);
    stroke.setAttribute('class', 'level-node-preview__stroke');
    preview.append(stroke);

    return preview;
  }

  // ── Build the full level card grid ──────────────────────────────────

  /**
   * Creates a single level-set DOM container from a group of levels.
   * Shared by both prologue (top-level) and campaign-nested sets to
   * eliminate duplicate card-building logic.
   */
  function createLevelSetElement(groupData, setName, groupIndex) {
    const levels = groupData.levels;
    const displaySetName = groupData.name || setName;

    const setElement = document.createElement('div');
    setElement.className = 'level-set';
    setElement.dataset.set = displaySetName;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'level-set-trigger';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-disabled', 'false');

    const glyph = document.createElement('span');
    glyph.className = 'level-set-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = groupData.campaign === 'Story' ? '✦'
      : groupData.campaign ? '⚑'
      : '∷';

    const title = document.createElement('span');
    title.className = 'level-set-title';
    title.textContent = displaySetName;

    const count = document.createElement('span');
    count.className = 'level-set-count';
    const countLabel = levels.length === 1 ? 'level' : 'levels';
    count.textContent = `${levels.length} ${countLabel}`;

    trigger.append(glyph, title, count);

    const slug = displaySetName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .trim() || `set-${groupIndex + 1}`;
    const containerId = `level-set-${slug}-${groupIndex}`;

    const levelsContainer = document.createElement('div');
    levelsContainer.className = 'level-set-levels';
    levelsContainer.id = containerId;
    levelsContainer.setAttribute('role', 'group');
    levelsContainer.setAttribute('aria-hidden', 'true');

    trigger.setAttribute('aria-controls', containerId);
    trigger.addEventListener('click', () => {
      if (setElement.classList.contains('locked') || setElement.hidden) {
        return;
      }
      if (setElement.classList.contains('expanded')) {
        collapseLevelSet(setElement);
      } else {
        expandLevelSet(setElement);
      }
      onMenuSelectSfx();
    });

    levels.forEach((level, index) => {
      const card = createLevelCardElement(level, index);
      levelsContainer.append(card);
    });

    setElement.append(trigger, levelsContainer);

    return {
      element: setElement,
      entry: {
        name: displaySetName,
        element: setElement,
        trigger,
        titleEl: title,
        countEl: count,
        levels: levels.slice(),
        campaign: groupData.campaign || null,
      },
    };
  }

  /**
   * Creates a single level-card button element for the grid.
   */
  function createLevelCardElement(level, index) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'level-node';
    card.classList.toggle('level-node--story', Boolean(level.isStoryLevel));
    card.dataset.level = level.id;
    card.setAttribute('aria-pressed', 'false');
    card.setAttribute(
      'aria-label',
      `${level.id}: ${level.title}. Path ${level.path}. Focus ${level.focus}.`,
    );
    card.tabIndex = -1;
    card.style.setProperty('--level-delay', `${index * 40}ms`);
    const pathLabel = typeof level.path === 'string' ? level.path : '—';
    const focusLabel = typeof level.focus === 'string' ? level.focus : '—';
    const ariaBase = level.isStoryLevel
      ? `${level.id}: ${level.title}. Story chapter.`
      : `${level.id}: ${level.title}. Path ${pathLabel}. Focus ${focusLabel}.`;
    card.innerHTML = `
      <span class="level-node-core">
        <span class="level-id">${level.id}</span>
        <span class="level-node-title">${level.title}</span>
      </span>
      <span class="level-best-wave" aria-hidden="true" hidden>Wave —</span>
      <span class="screen-reader-only level-path">${level.isStoryLevel ? 'Story chapter—no battlefield route.' : `Path ${pathLabel}`}</span>
      <span class="screen-reader-only level-focus">${level.isStoryLevel ? 'Focus on dialogue and lore.' : `Focus ${focusLabel}`}</span>
      <span class="screen-reader-only level-mode">—</span>
      <span class="screen-reader-only level-duration">—</span>
      <span class="screen-reader-only level-rewards">—</span>
      <span class="screen-reader-only level-start-thero">Starting Thero —.</span>
      <span class="screen-reader-only level-last-result">No attempts recorded.</span>
      <span class="screen-reader-only level-best-wave-sr">Infinity wave record locked.</span>
    `;
    card.dataset.ariaLabelBase = ariaBase;
    const core = card.querySelector('.level-node-core');
    if (core && level.isStoryLevel) {
      const storyMarker = document.createElement('span');
      storyMarker.className = 'level-story-marker';
      storyMarker.innerHTML = '<span class="level-story-marker__icon" aria-hidden="true">📖</span><span class="level-story-marker__label">Story</span>';
      const storySrLabel = document.createElement('span');
      storySrLabel.className = 'screen-reader-only level-story-label';
      storySrLabel.textContent = 'Story chapter—no waves to defend.';
      core.append(storyMarker, storySrLabel);
    }
    const levelPreview = createLevelNodePreview(level);
    if (levelPreview) {
      card.append(levelPreview);
    }
    card.addEventListener('click', () => {
      onLevelSelect(level);
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onLevelSelect(level);
      }
    });
    return card;
  }

  function buildLevelCards() {
    if (!levelGrid) return;
    expandedLevelSet = null;
    expandedCampaign = null;
    campaignButtons = [];
    campaignRowElement = null;
    tallestCampaignHeight = 0;
    levelGrid.innerHTML = '';

    const fragment = document.createDocumentFragment();
    const groups = new Map();
    const campaigns = new Map();
    const developerModeActive = getDeveloperModeActive();

    levelSetEntries.length = 0;

    // Group levels by campaign and set
    readLevelBlueprints().forEach((level) => {
      if (level.developerOnly && !developerModeActive) {
        return;
      }
      const setName = level.set || level.id.split(' - ')[0] || 'Levels';
      const campaignKey = level.campaign || null;
      const groupKey = campaignKey ? `${campaignKey}::${setName}` : setName;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, { levels: [], campaign: campaignKey, name: setName });
      }
      groups.get(groupKey).levels.push(level);

      if (campaignKey) {
        if (!campaigns.has(campaignKey)) {
          campaigns.set(campaignKey, []);
        }
        if (!campaigns.get(campaignKey).includes(groupKey)) {
          campaigns.get(campaignKey).push(groupKey);
        }
      }
    });

    let groupIndex = 0;

    const campaignRow = document.createElement('div');
    campaignRow.className = 'campaign-row';
    campaignRowElement = campaignRow;

    // Render Prologue (non-campaign) level sets at the top.
    groups.forEach((groupData, setName) => {
      if (groupData.campaign) return;
      const levels = groupData.levels;
      if (!levels.length) return;

      const { element: setElement, entry } = createLevelSetElement(groupData, setName, groupIndex);
      levelSetEntries.push(entry);
      fragment.append(setElement);
      groupIndex += 1;
    });

    // Prioritize Story at the front of the rail and defer Challenges to the back.
    const campaignPriority = ['Story', 'Ladder', 'Challenges'];
    const campaignDisplayNames = { Challenges: 'Trials' };
    const orderedCampaigns = Array.from(campaigns.entries()).sort((a, b) => {
      const [campaignA] = a;
      const [campaignB] = b;
      const priorityA = campaignPriority.indexOf(campaignA);
      const priorityB = campaignPriority.indexOf(campaignB);
      const normalizedA = priorityA === -1 ? campaignPriority.length : priorityA;
      const normalizedB = priorityB === -1 ? campaignPriority.length : priorityB;
      if (normalizedA !== normalizedB) {
        return normalizedA - normalizedB;
      }
      return campaignA.localeCompare(campaignB);
    });

    // Render campaign buttons with their nested level sets.
    orderedCampaigns.forEach(([campaignName, setKeys]) => {
      const orderedSetKeys = Array.isArray(setKeys) ? setKeys : [];
      const campaignElement = document.createElement('div');
      campaignElement.className = 'campaign-button';
      campaignElement.dataset.campaign = campaignName;

      const displayName = campaignDisplayNames[campaignName] || campaignName;
      const stackRank = campaignPriority.indexOf(campaignName);
      if (stackRank !== -1) {
        campaignElement.style.zIndex = `${campaignPriority.length - stackRank}`;
      }

      const campaignTrigger = document.createElement('button');
      campaignTrigger.type = 'button';
      campaignTrigger.className = 'campaign-button-trigger';
      campaignTrigger.setAttribute('aria-expanded', 'false');

      const campaignContent = document.createElement('span');
      campaignContent.className = 'campaign-button-content';

      const campaignGlyph = document.createElement('span');
      campaignGlyph.className = 'campaign-button-glyph';
      campaignGlyph.setAttribute('aria-hidden', 'true');
      const campaignIcons = {
        // Use the uploaded illustrated button art so the level rail matches the latest campaign branding.
        Story: 'assets/sprites/menu/campaignButton_story.webp',
        Ladder: 'assets/sprites/menu/campaignButton_ladder.webp',
        Challenges: 'assets/sprites/menu/campaignButton_trials.webp',
      };
      const iconPath = campaignIcons[campaignName] || null;
      let glyphSymbol = '⚔';
      if (iconPath) {
        campaignGlyph.classList.add('campaign-button-glyph--svg');
        const glyphImage = document.createElement('img');
        glyphImage.src = iconPath;
        glyphImage.alt = '';
        glyphImage.className = 'campaign-button-glyph__image';
        campaignGlyph.append(glyphImage);
      } else {
        if (campaignName === 'Challenges') {
          glyphSymbol = 'α²+β²≠γ²';
        }
        campaignGlyph.textContent = glyphSymbol;
      }

      const campaignTitle = document.createElement('span');
      campaignTitle.className = 'campaign-button-title';
      campaignTitle.textContent = displayName;

      const campaignCount = document.createElement('span');
      campaignCount.className = 'campaign-button-count';
      const setCount = setKeys.length;
      campaignCount.textContent = `${setCount} ${setCount === 1 ? 'set' : 'sets'}`;

      campaignContent.append(campaignGlyph, campaignTitle, campaignCount);
      campaignTrigger.append(campaignContent);

      const campaignContainer = document.createElement('div');
      campaignContainer.className = 'campaign-button-sets';
      campaignContainer.setAttribute('aria-hidden', 'true');
      campaignContainer.hidden = true;

      campaignTrigger.addEventListener('click', () => {
        if (campaignElement.classList.contains('campaign-button--locked')) {
          return;
        }
        const isExpanded = campaignElement.classList.contains('expanded');
        if (isExpanded) {
          collapseCampaign(campaignElement);
        } else {
          expandCampaign(campaignElement);
        }
        onMenuSelectSfx();
      });

      // Swipe-up gesture detection to close campaign.
      const swipeState = {
        startY: null,
        pointerId: null,
      };
      const SWIPE_UP_THRESHOLD = 50;

      function resetSwipeState() {
        swipeState.startY = null;
        swipeState.pointerId = null;
      }

      campaignContainer.addEventListener('pointerdown', (event) => {
        swipeState.startY = event.clientY;
        swipeState.pointerId = event.pointerId;
      });

      campaignContainer.addEventListener('pointermove', (event) => {
        if (swipeState.pointerId !== event.pointerId || swipeState.startY === null) {
          return;
        }
        const deltaY = swipeState.startY - event.clientY;
        if (deltaY > SWIPE_UP_THRESHOLD && campaignElement.classList.contains('expanded')) {
          collapseCampaign(campaignElement);
          onMenuSelectSfx();
          resetSwipeState();
        }
      });

      campaignContainer.addEventListener('pointerup', resetSwipeState);
      campaignContainer.addEventListener('pointercancel', resetSwipeState);

      // Render level sets inside this campaign
      orderedSetKeys.forEach((setKey) => {
        const groupData = groups.get(setKey);
        if (!groupData) return;
        const levels = groupData.levels;
        if (!levels.length) return;

        const { element: setElement, entry } = createLevelSetElement(groupData, setKey, groupIndex);
        entry.campaign = campaignName;
        levelSetEntries.push(entry);
        campaignContainer.append(setElement);
        groupIndex += 1;
      });

      campaignElement.append(campaignTrigger, campaignContainer);
      campaignRow.append(campaignElement);
      campaignButtons.push({
        name: campaignName,
        displayName,
        element: campaignElement,
        trigger: campaignTrigger,
        glyphEl: campaignGlyph,
        defaultGlyph: glyphSymbol,
      });
    });

    if (campaignButtons.length) {
      fragment.append(campaignRow);
    }

    levelGrid.append(fragment);
    primeCampaignHeightBaseline();
    updateLevelSetLocks();
  }

  // ── Card state updates ──────────────────────────────────────────────

  function updateLevelCards() {
    if (!levelGrid) return;
    const infinityUnlockedOverall = isInfinityModeUnlocked();
    readLevelBlueprints().forEach((level) => {
      const card = levelGrid.querySelector(`[data-level="${level.id}"]`);
      if (!card) return;
      const titleEl = card.querySelector('.level-node-title');
      const pathEl = card.querySelector('.level-path');
      const focusEl = card.querySelector('.level-focus');
      const waveEl = card.querySelector('.level-best-wave');
      const waveSrEl = card.querySelector('.level-best-wave-sr');
      const state = levelState.get(level.id);
      const isStoryLevel = isStoryOnlyLevel(level.id);

      const entered = Boolean(state && state.entered);
      const running = Boolean(state && state.running);
      const completed = Boolean(state && state.completed);
      const unlocked = isLevelUnlocked(level.id);
      const infinityUnlocked = infinityUnlockedOverall;
      const pathLabel = typeof level.path === 'string' ? level.path : '—';
      const focusLabel = typeof level.focus === 'string' ? level.focus : '—';

      const summary = isStoryLevel
        ? {
          mode: 'Story',
          duration: 'Dialogue',
          rewards: 'Lore entry',
          start: '—',
          startAria: 'Story chapter—no starting Thero required.',
        }
        : getLevelSummary(level);
      const modeEl = card.querySelector('.level-mode');
      const durationEl = card.querySelector('.level-duration');
      const rewardsEl = card.querySelector('.level-rewards');
      const startEl = card.querySelector('.level-start-thero');
      if (modeEl) {
        modeEl.textContent = unlocked ? summary.mode : 'Locked';
      }
      if (durationEl) {
        durationEl.textContent = unlocked ? summary.duration : '—';
      }
      if (rewardsEl) {
        rewardsEl.textContent = unlocked ? summary.rewards : '—';
      }
      if (startEl) {
        if (unlocked) {
          if (summary.start && summary.start !== '—') {
            startEl.textContent = summary.startAria || `Starting Thero ${summary.start}.`;
          } else {
            startEl.textContent = summary.startAria || 'Starting Thero —.';
          }
        } else {
          startEl.textContent = 'Starting Thero locked.';
        }
      }

      const runner = idleLevelRuns.get(level.id) || null;
      const lastResultEl = card.querySelector('.level-last-result');
      if (lastResultEl) {
        if (unlocked) {
          if (isStoryLevel) {
            const seen = Boolean(state?.storySeen);
            lastResultEl.textContent = seen ? 'Story viewed.' : 'Story ready to read.';
          } else {
            lastResultEl.textContent = describeLevelLastResult(level, state || null, runner);
          }
        } else {
          lastResultEl.textContent = 'Locked until preceding defenses are sealed.';
        }
      }

      card.classList.toggle('entered', entered);
      card.classList.toggle('completed', completed);
      card.classList.toggle('locked', !unlocked);
      card.classList.toggle('level-node--story', isStoryLevel);
      card.setAttribute('aria-pressed', running ? 'true' : 'false');
      card.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
      const parentSet = card.closest('.level-set');
      const setExpanded = Boolean(parentSet && parentSet.classList.contains('expanded'));
      card.tabIndex = unlocked && setExpanded ? 0 : -1;

      if (titleEl) {
        titleEl.textContent = unlocked ? level.title : 'LOCKED';
      }
      if (pathEl) {
        pathEl.textContent = unlocked
          ? isStoryLevel
            ? 'Story chapter—no battlefield route.'
            : `Path ${pathLabel}`
          : 'Path details locked.';
      }
      if (focusEl) {
        focusEl.textContent = unlocked
          ? isStoryLevel
            ? 'Focus on dialogue and lore.'
            : `Focus ${focusLabel}`
          : 'Focus details locked.';
      }

      const bestWave = isStoryLevel ? 0 : Number.isFinite(state?.bestWave) ? state.bestWave : 0;
      if (waveEl) {
        if (infinityUnlocked && !isStoryLevel) {
          const displayWave = bestWave > 0 ? formatWholeNumber(bestWave) : '—';
          waveEl.textContent = `Wave ${displayWave}`;
          waveEl.removeAttribute('hidden');
          card.classList.add('show-wave');
        } else {
          waveEl.setAttribute('hidden', '');
          card.classList.remove('show-wave');
        }
      }
      if (waveSrEl) {
        if (isStoryLevel) {
          waveSrEl.textContent = unlocked
            ? 'Story chapter—no waves to track.'
            : 'Story chapter locked.';
        } else if (infinityUnlocked) {
          waveSrEl.textContent = bestWave > 0
            ? `Infinity mode best wave ${formatWholeNumber(bestWave)}.`
            : 'Infinity mode ready—no wave record yet.';
        } else {
          waveSrEl.textContent = 'Infinity wave record locked.';
        }
      }

      const baseLabel = card.dataset.ariaLabelBase || '';
      if (unlocked) {
        const startLabel = summary.startAria ? ` ${summary.startAria}` : summary.start && summary.start !== '—'
          ? ` Starting Thero ${summary.start}.`
          : '';
        const waveLabel = !isStoryLevel && infinityUnlocked
          ? bestWave > 0
            ? ` Best wave reached: ${formatWholeNumber(bestWave)}.`
            : ' Infinity mode available—no wave record yet.'
          : '';
        const storyLabel = isStoryLevel ? ' Story chapter—no combat required.' : '';
        card.setAttribute('aria-label', `${baseLabel}${startLabel}${waveLabel}${storyLabel}`.trim());
      } else {
        card.setAttribute(
          'aria-label',
          `${level.id} locked. Seal the preceding defense to reveal details.`,
        );
      }
    });

    updateLevelSetLocks();
  }

  // ── Active level banner ─────────────────────────────────────────────

  function updateActiveLevelBanner() {
    const activeLevelId = getActiveLevelId();
    if (leaveLevelBtn) {
      leaveLevelBtn.disabled = !activeLevelId;
    }
    if (!activeLevelEl) return;
    if (!activeLevelId) {
      activeLevelEl.textContent = 'None selected';
      return;
    }

    const level = readLevelLookup().get(activeLevelId);
    const state = levelState.get(activeLevelId);
    if (!level || !state) {
      activeLevelEl.textContent = 'None selected';
      return;
    }

    let descriptor = 'Paused';
    if (state.running) {
      descriptor = 'Running';
    } else if (state.completed) {
      descriptor = 'Complete';
    }

    activeLevelEl.textContent = `${level.id} · ${level.title} (${descriptor})`;
  }

  // ── Public API ──────────────────────────────────────────────────────

  return {
    bindElements,
    buildLevelCards,
    updateLevelCards,
    updateActiveLevelBanner,
    updateLevelSetLocks,
    isInfinityModeUnlocked,
    attachDocumentListeners,
  };
}
