import { fetchJsonWithFallback } from './gameplayConfigLoaders.js';

const STORY_DATA_URL = new URL('./data/levelStories.json', import.meta.url);
const STORY_DATA_RELATIVE_PATH = './assets/data/levelStories.json';
const WORD_DELAY_MS = 100;
const SECTION_PAUSE_MS = 5000;
const PROMPT_DELAY_AFTER_COMPLETE_MS = 5000;

function sanitizeSections(value) {
  if (!value || typeof value !== 'object') {
    return [];
  }
  const sections = Array.isArray(value.sections) ? value.sections : [];
  return sections
    .map((section) => (typeof section === 'string' ? section.trim() : ''))
    .filter((section) => section.length > 0);
}

export function createLevelStoryScreen({
  document: documentRef = typeof document !== 'undefined' ? document : null,
  levelState,
  onStoryComplete,
  shouldShowStory: customShouldShowStory,
} = {}) {
  let overlayEl = null;
  let titleEl = null;
  let sectionsEl = null;
  let promptEl = null;
  let isVisible = false;
  let storyData = null;
  let storyLoadPromise = null;
  let activeLevel = null;
  let sectionsQueue = [];
  let sectionEntries = [];
  let activeSectionIndex = -1;
  let allSectionsRevealed = false;
  let completionResolver = null;
  let listenersBound = false;
  let completionNotified = false;
  let promptTimer = null;
  let activeCompletionHandler = null;

  function getTimerApi() {
    if (typeof window !== 'undefined') {
      return window;
    }
    if (typeof globalThis !== 'undefined') {
      return globalThis;
    }
    return {
      setTimeout: () => {},
      clearTimeout: () => {},
    };
  }

  const timerApi = getTimerApi();

  function clearEntryTimers(entry) {
    if (!entry) {
      return;
    }
    entry.timers.forEach((timer) => timerApi.clearTimeout(timer));
    entry.timers.length = 0;
    if (entry.advanceTimer) {
      timerApi.clearTimeout(entry.advanceTimer);
      entry.advanceTimer = null;
    }
  }

  function resetStoryState() {
    sectionEntries.forEach((entry) => clearEntryTimers(entry));
    sectionEntries = [];
    sectionsQueue = [];
    activeSectionIndex = -1;
    allSectionsRevealed = false;
    activeLevel = null;
    completionNotified = false;
    activeCompletionHandler = null;
    if (promptTimer) {
      timerApi.clearTimeout(promptTimer);
      promptTimer = null;
    }
    if (sectionsEl) {
      sectionsEl.innerHTML = '';
    }
    if (overlayEl) {
      overlayEl.removeAttribute('data-story-complete');
    }
    if (promptEl) {
      promptEl.textContent = '';
      promptEl.classList.remove('level-story-overlay__prompt--visible');
    }
  }

  function handleAdvanceRequest(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!isVisible) {
      return;
    }
    if (!allSectionsRevealed) {
      if (!fastForwardCurrentSection()) {
        revealNextSection({ immediate: true });
      }
      return;
    }
    closeOverlay();
  }

  function handleKeydown(event) {
    if (!isVisible) {
      return;
    }
    // Allow accessibility tools to intercept Escape if necessary.
    if (event.key === 'Tab') {
      return;
    }
    handleAdvanceRequest(event);
  }

  function bindElements({ overlay, label, sections, prompt } = {}) {
    overlayEl = overlay || overlayEl;
    titleEl = label || titleEl;
    sectionsEl = sections || sectionsEl;
    promptEl = prompt || promptEl;

    if (overlayEl && !overlayEl.hasAttribute('tabindex')) {
      overlayEl.setAttribute('tabindex', '-1');
    }
    if (overlayEl) {
      overlayEl.addEventListener('click', handleAdvanceRequest);
    }
    if (documentRef && !listenersBound) {
      documentRef.addEventListener('keydown', handleKeydown, true);
      listenersBound = true;
    }
  }

  async function loadStoryData() {
    if (storyData) {
      return storyData;
    }
    if (!storyLoadPromise) {
      storyLoadPromise = fetchJsonWithFallback(STORY_DATA_URL.href, STORY_DATA_RELATIVE_PATH)
        .catch((error) => {
          console.warn('Failed to load level story definitions', error);
          return {};
        })
        .finally(() => {
          storyLoadPromise = null;
        });
    }
    storyData = await storyLoadPromise;
    if (!storyData || typeof storyData !== 'object') {
      storyData = {};
    }
    return storyData;
  }

  async function preloadStories() {
    try {
      await loadStoryData();
    } catch (error) {
      console.warn('Story preload failed', error);
    }
  }

  /**
   * Retrieve the authored story entry for a given level id with normalized text sections.
   * @param {string} levelId - Level or spire story identifier.
   * @returns {Promise<{id:string,title:string,sections:string[]} | null>} Story entry if defined.
   */
  async function getStoryEntry(levelId) {
    if (!levelId) {
      return null;
    }
    await loadStoryData();
    const entry = findStoryEntry(levelId);
    const sections = sanitizeSections(entry);
    if (!sections.length) {
      return null;
    }
    const title = typeof entry?.title === 'string' && entry.title.trim() ? entry.title.trim() : levelId;
    return { id: levelId, title, sections };
  }

  // Match modern level ids to legacy story definitions so the first-entry narrative still appears.
  function findStoryEntry(levelId) {
    if (!levelId || !storyData || typeof storyData !== 'object') {
      return null;
    }
    if (storyData[levelId]) {
      return storyData[levelId];
    }
    const numberMatch = /([0-9]+)/.exec(levelId);
    if (!numberMatch) {
      return null;
    }
    const paddedIndex = numberMatch[1].padStart(2, '0');
    const legacyPrefix = `level-${paddedIndex}`;
    const legacyKey = Object.keys(storyData).find((key) => key.startsWith(legacyPrefix));
    return legacyKey ? storyData[legacyKey] : null;
  }

  function getSectionsForLevel(levelId) {
    const entry = findStoryEntry(levelId);
    return sanitizeSections(entry);
  }

  function shouldShowStory(levelId) {
    if (!levelId) {
      return false;
    }
    const sections = getSectionsForLevel(levelId);
    if (!sections.length) {
      return false;
    }
    if (typeof customShouldShowStory === 'function') {
      return customShouldShowStory(levelId);
    }
    const state = levelState && typeof levelState.get === 'function'
      ? levelState.get(levelId) || {}
      : {};
    return !state.storySeen;
  }

  function createSectionEntry(text, index) {
    if (!sectionsEl || !documentRef) {
      return null;
    }
    const section = documentRef.createElement('p');
    section.className = 'level-story-section';
    section.setAttribute('data-index', String(index));
    const entry = {
      element: section,
      words: [],
      timers: [],
      advanceTimer: null,
      finalized: false,
      index,
    };
    const tokens = text.split(/\s+/).filter(Boolean);
    tokens.forEach((token, tokenIndex) => {
      const span = documentRef.createElement('span');
      span.className = 'level-story-word';
      span.textContent = token;
      entry.words.push(span);
      section.append(span);
      if (tokenIndex < tokens.length - 1) {
        section.append(documentRef.createTextNode(' '));
      }
    });
    sectionsEl.append(section);
    const scheduleSectionReveal = typeof timerApi.requestAnimationFrame === 'function'
      ? timerApi.requestAnimationFrame.bind(timerApi)
      : (cb) => timerApi.setTimeout(cb, 16);
    scheduleSectionReveal(() => {
      section.classList.add('level-story-section--visible');
    });
    return entry;
  }

  function showAllWords(entry) {
    if (!entry) {
      return;
    }
    entry.words.forEach((word) => {
      word.classList.add('level-story-word--visible');
    });
  }

  function finalizeSection(entry, { advanceImmediately = false } = {}) {
    if (!entry || entry.finalized) {
      return;
    }
    entry.finalized = true;
    showAllWords(entry);
    clearEntryTimers(entry);
    if (entry.index >= sectionsQueue.length - 1) {
      handleAllSectionsRevealed();
      return;
    }
    if (advanceImmediately) {
      revealNextSection({ immediate: true });
      return;
    }
    entry.advanceTimer = timerApi.setTimeout(() => {
      entry.advanceTimer = null;
      revealNextSection();
    }, 0);
  }

  function startWordReveal(entry, { immediate = false } = {}) {
    if (!entry) {
      return;
    }
    if (!entry.words.length || immediate) {
      finalizeSection(entry, { advanceImmediately: immediate });
      return;
    }
    entry.words.forEach((word, index) => {
      const timer = timerApi.setTimeout(() => {
        word.classList.add('level-story-word--visible');
      }, index * WORD_DELAY_MS);
      entry.timers.push(timer);
    });
    const totalDuration = entry.words.length * WORD_DELAY_MS + SECTION_PAUSE_MS;
    entry.advanceTimer = timerApi.setTimeout(() => {
      finalizeSection(entry);
    }, totalDuration);
  }

  function revealNextSection({ immediate = false } = {}) {
    if (!sectionsQueue.length) {
      return;
    }
    const nextIndex = activeSectionIndex + 1;
    if (nextIndex >= sectionsQueue.length) {
      handleAllSectionsRevealed();
      return;
    }
    activeSectionIndex = nextIndex;
    const entry = createSectionEntry(sectionsQueue[nextIndex], nextIndex);
    if (!entry) {
      handleAllSectionsRevealed();
      return;
    }
    sectionEntries[nextIndex] = entry;
    startWordReveal(entry, { immediate });
  }

  function fastForwardCurrentSection() {
    if (activeSectionIndex === -1) {
      return false;
    }
    const entry = sectionEntries[activeSectionIndex];
    if (!entry) {
      return false;
    }
    if (entry.finalized) {
      if (activeSectionIndex < sectionsQueue.length - 1) {
        revealNextSection({ immediate: true });
        return true;
      }
      return false;
    }
    finalizeSection(entry, { advanceImmediately: true });
    return true;
  }

  function handleAllSectionsRevealed() {
    allSectionsRevealed = true;
    if (overlayEl) {
      overlayEl.setAttribute('data-story-complete', 'true');
    }
    if (promptEl) {
      if (promptTimer) {
        timerApi.clearTimeout(promptTimer);
      }
      promptTimer = timerApi.setTimeout(() => {
        promptEl.textContent = 'Press any key to continue...';
        promptEl.classList.add('level-story-overlay__prompt--visible');
        promptTimer = null;
      }, PROMPT_DELAY_AFTER_COMPLETE_MS);
    }
  }

  function closeOverlay() {
    if (!overlayEl || !isVisible) {
      return;
    }
    isVisible = false;
    overlayEl.classList.remove('level-story-overlay--visible');
    overlayEl.setAttribute('aria-hidden', 'true');
    const levelId = activeLevel?.id;
    const completionHandler = activeCompletionHandler || onStoryComplete;
    const resolver = completionResolver;
    completionResolver = null;
    timerApi.setTimeout(() => {
      resetStoryState();
      if (!completionNotified && typeof completionHandler === 'function' && levelId) {
        completionNotified = true;
        completionHandler(levelId);
      }
      if (resolver) {
        resolver();
      }
    }, 250);
  }

  function openOverlay(level, sections, { onComplete } = {}) {
    if (!overlayEl || !sectionsEl) {
      return false;
    }
    resetStoryState();
    activeLevel = level;
    sectionsQueue = sections.slice();
    activeCompletionHandler = typeof onComplete === 'function' ? onComplete : onStoryComplete;
    if (titleEl) {
      const labelParts = [level?.id, level?.title || level?.name].filter(Boolean);
      titleEl.textContent = labelParts.join(' · ');
    }
    if (promptEl) {
      promptEl.textContent = '';
      promptEl.classList.remove('level-story-overlay__prompt--visible');
    }
    overlayEl.setAttribute('aria-hidden', 'false');
    overlayEl.classList.add('level-story-overlay--visible');
    overlayEl.removeAttribute('data-story-complete');
    overlayEl.focus();
    isVisible = true;
    allSectionsRevealed = false;
    completionResolver = null;
    const promise = new Promise((resolve) => {
      completionResolver = resolve;
    });
    revealNextSection();
    return promise;
  }

  async function maybeShowStory(level, { shouldShow, onComplete } = {}) {
    if (!level || !level.id) {
      return false;
    }
    await loadStoryData();
    const sections = getSectionsForLevel(level.id);
    if (!sections.length) {
      return false;
    }
    const showStory = typeof shouldShow === 'function' ? shouldShow(level.id) : shouldShowStory(level.id);
    if (!showStory) {
      return false;
    }
    return openOverlay(level, sections, { onComplete });
  }

  return {
    bindElements,
    preloadStories,
    maybeShowStory,
    getStoryEntry,
    isVisible: () => isVisible,
  };
}
