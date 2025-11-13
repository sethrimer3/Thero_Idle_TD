const fieldNotesElements = {
  overlay: null,
  closeButton: null,
  openButton: null,
  copy: null,
  pagination: null,
  pages: [],
  pageIndicator: null,
  prevButton: null,
  nextButton: null,
  lastFocus: null,
};

const fieldNotesState = {
  currentIndex: 0,
  animating: false,
  touchStart: null,
};

const fieldNotesDependencies = {
  revealOverlay: () => {},
  scheduleOverlayHide: () => {},
  audioManager: null,
};

// Cache the in-flight fetch so multiple callers reuse the same request.
let fieldNotesDataPromise = null;

// Message shown when the external data file fails to load.
const FIELD_NOTES_FALLBACK_MESSAGE =
  'Field notes are unavailable right now. Please return once the codex stabilizes.';

function getFieldNotesDataUrl() {
  try {
    return new URL('./data/fieldNotes.json', import.meta.url);
  } catch (error) {
    return null;
  }
}

// Retrieve the authored field notes dataset from disk.
async function loadFieldNotesData() {
  if (fieldNotesDataPromise) {
    return fieldNotesDataPromise;
  }

  fieldNotesDataPromise = (async () => {
    const url = getFieldNotesDataUrl();
    if (!url) {
      return [];
    }

    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Field notes request failed with status ${response.status}`);
      }
      const data = await response.json();
      if (!data || !Array.isArray(data.pages)) {
        return [];
      }
      return data.pages;
    } catch (error) {
      console.error('Failed to load field notes data:', error);
      return [];
    }
  })();

  return fieldNotesDataPromise;
}

// Build the decorative heading shown at the top of each page.
function createFieldNotesHeading(title) {
  if (!title) {
    return null;
  }
  const heading = document.createElement('h3');
  heading.className = 'field-notes-page-title';
  heading.textContent = title;
  return heading;
}

// Render a narrative paragraph, allowing lightweight inline markup for emphasis.
function createFieldNotesParagraph(html) {
  if (!html) {
    return null;
  }
  const paragraph = document.createElement('p');
  paragraph.innerHTML = html;
  return paragraph;
}

// Render bullet lists that highlight tactical directives.
function createFieldNotesList(items) {
  if (!Array.isArray(items) || !items.length) {
    return null;
  }
  const list = document.createElement('ul');
  list.className = 'field-notes-list';
  items.forEach((item) => {
    if (!item) {
      return;
    }
    const listItem = document.createElement('li');
    listItem.innerHTML = item;
    list.appendChild(listItem);
  });
  return list.childElementCount ? list : null;
}

// Populate a single page node with the configured text blocks.
function populateFieldNotesArticle(article, pageData) {
  if (!article || !pageData) {
    return;
  }

  article.textContent = '';

  if (pageData.title) {
    const heading = createFieldNotesHeading(pageData.title);
    if (heading) {
      article.appendChild(heading);
    }
  }

  const blocks = Array.isArray(pageData.content) ? pageData.content : [];
  blocks.forEach((block) => {
    if (!block || typeof block !== 'object') {
      return;
    }

    const type = typeof block.type === 'string' ? block.type.toLowerCase() : 'paragraph';

    if (type === 'list') {
      const list = createFieldNotesList(block.items);
      if (list) {
        article.appendChild(list);
      }
      return;
    }

    if (type === 'caption') {
      const caption = document.createElement('p');
      caption.className = 'field-notes-page-caption';
      caption.innerHTML = block.text || '';
      article.appendChild(caption);
      return;
    }

    const paragraph = createFieldNotesParagraph(block.text || block.html || '');
    if (paragraph) {
      article.appendChild(paragraph);
    }
  });
}

// Create a page shell, configure the parchment background, then fill it with content.
function createFieldNotesArticle(pageData, index) {
  const article = document.createElement('article');
  article.className = 'field-notes-page';
  article.dataset.pageIndex = String(index);
  article.setAttribute('tabindex', '-1');
  article.setAttribute('aria-hidden', 'true');

  const backgroundImage =
    typeof pageData?.backgroundImage === 'string' ? pageData.backgroundImage.trim() : '';
  if (backgroundImage) {
    article.style.setProperty('--field-notes-background-image', `url("${backgroundImage}")`);
  } else {
    article.style.removeProperty('--field-notes-background-image');
  }

  populateFieldNotesArticle(article, pageData);
  return article;
}

// Provide a graceful fallback page if the dataset cannot be fetched.
function createFallbackFieldNotesPage() {
  const article = document.createElement('article');
  article.className = 'field-notes-page';
  article.dataset.pageIndex = '0';
  article.setAttribute('tabindex', '-1');
  article.setAttribute('aria-hidden', 'true');
  const message = document.createElement('p');
  message.innerText = FIELD_NOTES_FALLBACK_MESSAGE;
  article.appendChild(message);
  return article;
}

// Make sure the DOM reflects the latest dataset before the overlay is shown.
async function ensureFieldNotesPages() {
  const container = fieldNotesElements.copy;
  if (!container) {
    fieldNotesElements.pages = [];
    return;
  }

  const pagesData = await loadFieldNotesData();

  container.innerHTML = '';

  const fragment = document.createDocumentFragment();
  const normalizedPages = Array.isArray(pagesData) && pagesData.length ? pagesData : null;

  if (!normalizedPages) {
    fragment.appendChild(createFallbackFieldNotesPage());
  } else {
    normalizedPages.forEach((page, index) => {
      fragment.appendChild(createFieldNotesArticle(page, index));
    });
  }

  container.appendChild(fragment);
  fieldNotesElements.pages = Array.from(container.querySelectorAll('.field-notes-page'));
}

export function configureFieldNotesOverlay({ revealOverlay, scheduleOverlayHide, audioManager } = {}) {
  if (typeof revealOverlay === 'function') {
    fieldNotesDependencies.revealOverlay = revealOverlay;
  }
  if (typeof scheduleOverlayHide === 'function') {
    fieldNotesDependencies.scheduleOverlayHide = scheduleOverlayHide;
  }
  if (audioManager !== undefined) {
    fieldNotesDependencies.audioManager = audioManager || null;
  }
}

export function setFieldNotesOpenButton(button) {
  fieldNotesElements.openButton = button || null;
}

export function isFieldNotesOverlayVisible() {
  return Boolean(fieldNotesElements.overlay?.classList.contains('active'));
}

function getFieldNotesPages() {
  return Array.isArray(fieldNotesElements.pages) ? fieldNotesElements.pages : [];
}

function getAudioManager() {
  return fieldNotesDependencies.audioManager;
}

function focusFieldNotesElement(element) {
  if (!element || typeof element.focus !== 'function') {
    return;
  }
  try {
    element.focus({ preventScroll: true });
  } catch (error) {
    element.focus();
  }
}

function updateFieldNotesControls() {
  const pages = getFieldNotesPages();
  const total = pages.length;
  const current = Math.max(0, Math.min(total - 1, fieldNotesState.currentIndex));

  if (fieldNotesElements.pageIndicator) {
    const label = total > 0 ? `${current + 1} / ${total}` : '?';
    fieldNotesElements.pageIndicator.textContent = label;
    fieldNotesElements.pageIndicator.hidden = total <= 1;
  }

  if (fieldNotesElements.prevButton) {
    fieldNotesElements.prevButton.disabled = current <= 0 || total <= 1;
    fieldNotesElements.prevButton.hidden = total <= 1;
  }

  if (fieldNotesElements.nextButton) {
    fieldNotesElements.nextButton.disabled = current >= total - 1 || total <= 1;
    fieldNotesElements.nextButton.hidden = total <= 1;
  }

  if (fieldNotesElements.pagination) {
    if (total <= 1) {
      fieldNotesElements.pagination.setAttribute('hidden', '');
    } else {
      fieldNotesElements.pagination.removeAttribute('hidden');
    }
  }
}

function setFieldNotesPage(targetIndex, options = {}) {
  const pages = getFieldNotesPages();
  if (!pages.length) {
    fieldNotesState.currentIndex = 0;
    updateFieldNotesControls();
    return;
  }

  const clampedIndex = Math.max(0, Math.min(pages.length - 1, targetIndex));
  const immediate = Boolean(options.immediate);
  const currentIndex = Math.max(0, Math.min(pages.length - 1, fieldNotesState.currentIndex));
  const currentPage = pages[currentIndex];
  const nextPage = pages[clampedIndex];

  if (!nextPage) {
    return;
  }

  if (!immediate && clampedIndex !== currentIndex) {
    const audioManager = getAudioManager();
    if (audioManager && typeof audioManager.playSfx === 'function') {
      audioManager.playSfx('pageTurn');
    }
  }

  if (immediate) {
    fieldNotesState.animating = false;
    fieldNotesState.currentIndex = clampedIndex;
    pages.forEach((page, index) => {
      const active = index === clampedIndex;
      page.classList.toggle('field-notes-page--active', active);
      page.classList.remove(
        'field-notes-page--enter-forward',
        'field-notes-page--enter-backward',
        'field-notes-page--exit-forward',
        'field-notes-page--exit-backward',
      );
      page.setAttribute('tabindex', active ? '0' : '-1');
      page.setAttribute('aria-hidden', active ? 'false' : 'true');
      if (active) {
        page.scrollTop = 0;
      }
    });
    updateFieldNotesControls();
    return;
  }

  if (fieldNotesState.animating || clampedIndex === currentIndex) {
    return;
  }

  const direction = Number.isFinite(options.direction)
    ? Math.sign(options.direction)
    : clampedIndex > currentIndex
    ? 1
    : -1;

  fieldNotesState.animating = true;

  const enterClass =
    direction >= 0 ? 'field-notes-page--enter-forward' : 'field-notes-page--enter-backward';
  const exitClass =
    direction >= 0 ? 'field-notes-page--exit-forward' : 'field-notes-page--exit-backward';

  if (currentPage && currentPage !== nextPage) {
    currentPage.classList.remove(
      'field-notes-page--enter-forward',
      'field-notes-page--enter-backward',
      'field-notes-page--exit-forward',
      'field-notes-page--exit-backward',
    );
    currentPage.classList.add(exitClass);
    currentPage.setAttribute('aria-hidden', 'true');
    currentPage.setAttribute('tabindex', '-1');
  }

  nextPage.classList.remove(
    'field-notes-page--enter-forward',
    'field-notes-page--enter-backward',
    'field-notes-page--exit-forward',
    'field-notes-page--exit-backward',
  );
  nextPage.classList.add('field-notes-page--active', enterClass);
  nextPage.setAttribute('aria-hidden', 'false');
  nextPage.setAttribute('tabindex', '0');
  nextPage.scrollTop = 0;

  let fallbackHandle = null;

  const finishTransition = (event) => {
    if (event && event.target !== nextPage) {
      return;
    }
    if (event && event.propertyName && event.propertyName !== 'transform') {
      return;
    }
    nextPage.removeEventListener('transitionend', finishTransition);
    if (fallbackHandle) {
      clearTimeout(fallbackHandle);
      fallbackHandle = null;
    }
    nextPage.classList.remove('field-notes-page--enter-forward', 'field-notes-page--enter-backward');
    if (currentPage && currentPage !== nextPage) {
      currentPage.classList.remove(
        'field-notes-page--active',
        'field-notes-page--exit-forward',
        'field-notes-page--exit-backward',
      );
    }
    fieldNotesState.currentIndex = clampedIndex;
    fieldNotesState.animating = false;
    updateFieldNotesControls();
  };

  requestAnimationFrame(() => {
    nextPage.addEventListener('transitionend', finishTransition);
    if (typeof window !== 'undefined') {
      fallbackHandle = window.setTimeout(() => {
        finishTransition();
      }, 420);
    }
    nextPage.classList.remove(enterClass);
  });
}

function showNextFieldNotesPage() {
  const pages = getFieldNotesPages();
  if (!pages.length) {
    return;
  }
  const nextIndex = Math.min(pages.length - 1, fieldNotesState.currentIndex + 1);
  setFieldNotesPage(nextIndex, { direction: 1 });
}

function showPreviousFieldNotesPage() {
  const pages = getFieldNotesPages();
  if (!pages.length) {
    return;
  }
  const nextIndex = Math.max(0, fieldNotesState.currentIndex - 1);
  setFieldNotesPage(nextIndex, { direction: -1 });
}

function handleFieldNotesOverlayKeydown(event) {
  if (!isFieldNotesOverlayVisible()) {
    return;
  }
  if (typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    showNextFieldNotesPage();
    return;
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    showPreviousFieldNotesPage();
  }
}

function handleFieldNotesPointerDown(event) {
  if (!event || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) {
    fieldNotesState.touchStart = null;
    return;
  }
  fieldNotesState.touchStart = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    time: typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(),
  };
}

function handleFieldNotesPointerUp(event) {
  const start = fieldNotesState.touchStart;
  fieldNotesState.touchStart = null;
  if (!start || !event || start.pointerId !== event.pointerId || fieldNotesState.animating) {
    return;
  }
  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;
  const elapsed =
    (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - start.time;
  if (Math.abs(dx) < 40) {
    return;
  }
  if (Math.abs(dx) < Math.abs(dy) * 1.2) {
    return;
  }
  if (elapsed > 600) {
    return;
  }
  if (dx < 0) {
    showNextFieldNotesPage();
  } else {
    showPreviousFieldNotesPage();
  }
}

function clearFieldNotesPointerTracking() {
  fieldNotesState.touchStart = null;
}

export function closeFieldNotesOverlay() {
  const { overlay } = fieldNotesElements;
  if (!overlay || !isFieldNotesOverlayVisible()) {
    return;
  }

  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');

  fieldNotesDependencies.scheduleOverlayHide(overlay);
  fieldNotesState.animating = false;
  clearFieldNotesPointerTracking();

  const focusTarget =
    fieldNotesElements.lastFocus && typeof fieldNotesElements.lastFocus.focus === 'function'
      ? fieldNotesElements.lastFocus
      : fieldNotesElements.openButton;

  if (focusTarget) {
    focusFieldNotesElement(focusTarget);
  }

  fieldNotesElements.lastFocus = null;
}

export function openFieldNotesOverlay() {
  const { overlay, closeButton } = fieldNotesElements;
  if (!overlay || isFieldNotesOverlayVisible()) {
    return;
  }

  fieldNotesElements.lastFocus = typeof document !== 'undefined' ? document.activeElement : null;
  fieldNotesDependencies.revealOverlay(overlay);
  overlay.setAttribute('aria-hidden', 'false');
  fieldNotesState.touchStart = null;
  setFieldNotesPage(0, { immediate: true });

  requestAnimationFrame(() => {
    overlay.classList.add('active');
    if (closeButton) {
      focusFieldNotesElement(closeButton);
    } else {
      focusFieldNotesElement(overlay);
    }
  });
}

export async function initializeFieldNotesOverlay() {
  fieldNotesElements.overlay = document.getElementById('field-notes-overlay');
  fieldNotesElements.closeButton = document.getElementById('field-notes-close');
  fieldNotesElements.copy = document.getElementById('field-notes-copy');
  fieldNotesElements.pagination = document.getElementById('field-notes-pagination');
  fieldNotesElements.pageIndicator = document.getElementById('field-notes-page-indicator');
  fieldNotesElements.prevButton = document.getElementById('field-notes-prev');
  fieldNotesElements.nextButton = document.getElementById('field-notes-next');

  await ensureFieldNotesPages();
  fieldNotesState.currentIndex = 0;
  setFieldNotesPage(0, { immediate: true });
  updateFieldNotesControls();

  const { overlay, closeButton } = fieldNotesElements;

  if (overlay) {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeFieldNotesOverlay();
      }
    });

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        closeFieldNotesOverlay();
        return;
      }
      handleFieldNotesOverlayKeydown(event);
    });
  }

  if (closeButton) {
    closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      closeFieldNotesOverlay();
    });
  }

  if (fieldNotesElements.prevButton) {
    fieldNotesElements.prevButton.addEventListener('click', () => {
      showPreviousFieldNotesPage();
    });
  }

  if (fieldNotesElements.nextButton) {
    fieldNotesElements.nextButton.addEventListener('click', () => {
      showNextFieldNotesPage();
    });
  }

  if (fieldNotesElements.copy) {
    fieldNotesElements.copy.addEventListener('pointerdown', handleFieldNotesPointerDown, {
      passive: true,
    });
    fieldNotesElements.copy.addEventListener('pointerup', handleFieldNotesPointerUp);
    fieldNotesElements.copy.addEventListener('pointercancel', clearFieldNotesPointerTracking);
    fieldNotesElements.copy.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        clearFieldNotesPointerTracking();
      }
    });
  }
}
