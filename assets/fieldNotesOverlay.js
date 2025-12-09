const fieldNotesElements = {
  overlay: null,
  closeButton: null,
  openButton: null,
  backButton: null,
  title: null,
  listView: null,
  list: null,
  empty: null,
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
  view: 'list',
  entries: [],
};

const fieldNotesDependencies = {
  revealOverlay: () => {},
  scheduleOverlayHide: () => {},
  audioManager: null,
  getStoryEntries: async () => [],
};

// Message shown when the external data file fails to load.
const FIELD_NOTES_FALLBACK_MESSAGE =
  'Field notes are unavailable right now. Please return once the codex stabilizes.';

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

  const blocks = Array.isArray(pageData.content) && pageData.content.length
    ? pageData.content
    : Array.isArray(pageData.sections)
      ? pageData.sections.map((text) => ({ type: 'paragraph', text }))
      : [];
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

// Locate the active story entry so navigation controls can fetch its metadata.
function getCurrentEntry(index = fieldNotesState.currentIndex) {
  if (!Array.isArray(fieldNotesState.entries)) {
    return null;
  }
  const clamped = Math.max(0, Math.min(fieldNotesState.entries.length - 1, index));
  return fieldNotesState.entries[clamped] || null;
}

// Update the overlay heading when swapping between list and detail states.
function setFieldNotesTitle(title) {
  if (!fieldNotesElements.title) {
    return;
  }
  const nextTitle = title || 'Field Notes Archive';
  fieldNotesElements.title.textContent = nextTitle;
}

// Keep the archive list selection synchronized with the active entry index.
function highlightActiveListEntry(index) {
  if (!fieldNotesElements.list) {
    return;
  }
  const buttons = Array.from(fieldNotesElements.list.querySelectorAll('.field-notes-entry'));
  buttons.forEach((button, buttonIndex) => {
    const active = buttonIndex === index;
    button.classList.toggle('field-notes-entry--active', active);
    if (active) {
      button.setAttribute('aria-current', 'true');
    } else {
      button.removeAttribute('aria-current');
    }
  });
}

// Toggle between the archive list and the detailed story page view.
function setFieldNotesView(view) {
  const normalized = view === 'detail' ? 'detail' : 'list';
  const hasPages = getFieldNotesPages().length > 0;
  fieldNotesState.view = normalized === 'detail' && hasPages ? 'detail' : 'list';

  const showList = fieldNotesState.view === 'list';
  if (fieldNotesElements.listView) {
    fieldNotesElements.listView.classList.toggle('field-notes-view--hidden', !showList);
    fieldNotesElements.listView.hidden = !showList;
    fieldNotesElements.listView.setAttribute('aria-hidden', showList ? 'false' : 'true');
  }

  if (fieldNotesElements.copy) {
    fieldNotesElements.copy.classList.toggle('field-notes-view--hidden', showList);
    fieldNotesElements.copy.hidden = showList;
    fieldNotesElements.copy.setAttribute('aria-hidden', showList ? 'true' : 'false');
  }

  if (fieldNotesElements.backButton) {
    fieldNotesElements.backButton.hidden = showList;
    fieldNotesElements.backButton.setAttribute('aria-hidden', showList ? 'true' : 'false');
  }

  const activeEntry = getCurrentEntry();
  setFieldNotesTitle(showList ? 'Field Notes Archive' : activeEntry?.title);
  if (showList) {
    clearFieldNotesPointerTracking();
  }
  highlightActiveListEntry(fieldNotesState.currentIndex);
  updateFieldNotesControls();
}

// Generate a short summary snippet for each list entry.
function createEntryPreview(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  const snippet = text.replace(/\s+/g, ' ').trim();
  if (snippet.length <= 120) {
    return snippet;
  }
  return `${snippet.slice(0, 117)}…`;
}

// Render the button used for each archive entry in the list view.
function createFieldNotesListEntry(entry, index) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'field-notes-entry';
  button.dataset.entryIndex = String(index);
  button.setAttribute('aria-label', `Read story ${entry.title}`);

  const title = document.createElement('span');
  title.className = 'field-notes-entry__title';
  title.textContent = entry.title;

  const previewText = createEntryPreview((entry.sections || []).find((section) => section));

  button.appendChild(title);
  if (previewText) {
    button.appendChild(document.createElement('br'));
    const preview = document.createElement('span');
    preview.className = 'field-notes-entry__preview';
    preview.textContent = previewText;
    button.appendChild(preview);
  }
  return button;
}

// Populate the archive list with every seen story entry.
function renderFieldNotesList(entries) {
  if (!fieldNotesElements.list) {
    return;
  }
  fieldNotesElements.list.innerHTML = '';

  const fragment = document.createDocumentFragment();
  const normalizedEntries = Array.isArray(entries) ? entries : [];
  normalizedEntries.forEach((entry, index) => {
    if (!entry || !entry.title) {
      return;
    }
    const item = document.createElement('li');
    item.className = 'field-notes-entry-row';
    const button = createFieldNotesListEntry(entry, index);
    item.appendChild(button);
    fragment.appendChild(item);
  });

  fieldNotesElements.list.appendChild(fragment);
  if (fieldNotesElements.empty) {
    fieldNotesElements.empty.hidden = normalizedEntries.length > 0;
  }

  highlightActiveListEntry(fieldNotesState.currentIndex);
}

// Make sure the DOM reflects the latest dataset before the overlay is shown.
async function ensureFieldNotesPages() {
  const container = fieldNotesElements.copy;
  if (!container) {
    fieldNotesElements.pages = [];
    return;
  }

  let entries = [];
  try {
    entries = await fieldNotesDependencies.getStoryEntries();
  } catch (error) {
    console.error('Failed to build field notes entries', error);
  }

  const normalizedEntries = Array.isArray(entries)
    ? entries
      .map((entry) => {
        const title = typeof entry?.title === 'string' ? entry.title.trim() : '';
        const sections = Array.isArray(entry?.sections)
          ? entry.sections.map((section) => (typeof section === 'string' ? section : '')).filter(Boolean)
          : [];
        return title && sections.length ? { ...entry, title, sections } : null;
      })
      .filter(Boolean)
    : [];

  fieldNotesState.entries = normalizedEntries;
  renderFieldNotesList(normalizedEntries);

  container.innerHTML = '';
  const fragment = document.createDocumentFragment();

  if (!normalizedEntries.length) {
    fragment.appendChild(createFallbackFieldNotesPage());
  } else {
    normalizedEntries.forEach((entry, index) => {
      fragment.appendChild(
        createFieldNotesArticle(
          {
            title: entry.title,
            sections: entry.sections,
          },
          index,
        ),
      );
    });
  }

  container.appendChild(fragment);
  fieldNotesElements.pages = Array.from(container.querySelectorAll('.field-notes-page'));

  const totalPages = fieldNotesElements.pages.length;
  fieldNotesState.currentIndex = totalPages > 0
    ? Math.max(0, Math.min(totalPages - 1, fieldNotesState.currentIndex))
    : 0;

  if (normalizedEntries.length && fieldNotesState.view === 'detail') {
    setFieldNotesView('detail');
    setFieldNotesPage(fieldNotesState.currentIndex, { immediate: true });
  } else {
    setFieldNotesView('list');
    updateFieldNotesControls();
  }
}

export function configureFieldNotesOverlay({ revealOverlay, scheduleOverlayHide, audioManager, getStoryEntries } = {}) {
  if (typeof revealOverlay === 'function') {
    fieldNotesDependencies.revealOverlay = revealOverlay;
  }
  if (typeof scheduleOverlayHide === 'function') {
    fieldNotesDependencies.scheduleOverlayHide = scheduleOverlayHide;
  }
  if (audioManager !== undefined) {
    fieldNotesDependencies.audioManager = audioManager || null;
  }
  if (typeof getStoryEntries === 'function') {
    fieldNotesDependencies.getStoryEntries = getStoryEntries;
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
  const showingDetail = fieldNotesState.view === 'detail' && total > 0;

  if (fieldNotesElements.pageIndicator) {
    const label = showingDetail && total > 0 ? `${current + 1} / ${total}` : 'Story Archive';
    fieldNotesElements.pageIndicator.textContent = label;
    fieldNotesElements.pageIndicator.hidden = !showingDetail || total <= 1;
  }

  if (fieldNotesElements.prevButton) {
    fieldNotesElements.prevButton.disabled = !showingDetail || current <= 0 || total <= 1;
    fieldNotesElements.prevButton.hidden = !showingDetail || total <= 1;
  }

  if (fieldNotesElements.nextButton) {
    fieldNotesElements.nextButton.disabled = !showingDetail || current >= total - 1 || total <= 1;
    fieldNotesElements.nextButton.hidden = !showingDetail || total <= 1;
  }

  if (fieldNotesElements.pagination) {
    if (!showingDetail || total <= 1) {
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
    setFieldNotesView('list');
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

  const wasDetailView = fieldNotesState.view === 'detail';
  setFieldNotesView('detail');

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
    setFieldNotesTitle(getCurrentEntry(clampedIndex)?.title);
    highlightActiveListEntry(clampedIndex);
    updateFieldNotesControls();
    return;
  }

  if (fieldNotesState.animating || (clampedIndex === currentIndex && wasDetailView)) {
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
    setFieldNotesTitle(getCurrentEntry(clampedIndex)?.title);
    highlightActiveListEntry(clampedIndex);
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
  if (fieldNotesState.view !== 'detail') {
    return;
  }
  const pages = getFieldNotesPages();
  if (!pages.length) {
    return;
  }
  const nextIndex = Math.min(pages.length - 1, fieldNotesState.currentIndex + 1);
  setFieldNotesPage(nextIndex, { direction: 1 });
}

function showPreviousFieldNotesPage() {
  if (fieldNotesState.view !== 'detail') {
    return;
  }
  const pages = getFieldNotesPages();
  if (!pages.length) {
    return;
  }
  const nextIndex = Math.max(0, fieldNotesState.currentIndex - 1);
  setFieldNotesPage(nextIndex, { direction: -1 });
}

// Return focus to a specific archive entry when leaving the reader view.
function focusFieldNotesListEntry(index) {
  if (!fieldNotesElements.list) {
    return;
  }
  const button = fieldNotesElements.list.querySelector(
    `.field-notes-entry[data-entry-index="${index}"]`,
  );
  if (button) {
    focusFieldNotesElement(button);
  }
}

// Switch back to the archive list and highlight the current entry.
function showFieldNotesList() {
  setFieldNotesView('list');
  focusFieldNotesListEntry(fieldNotesState.currentIndex);
}

function handleFieldNotesOverlayKeydown(event) {
  if (!isFieldNotesOverlayVisible()) {
    return;
  }
  if (typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }
  if (event.key === 'ArrowRight') {
    if (fieldNotesState.view !== 'detail') {
      return;
    }
    event.preventDefault();
    showNextFieldNotesPage();
    return;
  }
  if (event.key === 'ArrowLeft') {
    if (fieldNotesState.view !== 'detail') {
      return;
    }
    event.preventDefault();
    showPreviousFieldNotesPage();
  }
}

function handleFieldNotesPointerDown(event) {
  if (
    !event ||
    fieldNotesState.view !== 'detail' ||
    (event.pointerType !== 'touch' && event.pointerType !== 'pen')
  ) {
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

// Open the selected story page when a list row is activated.
function handleFieldNotesListClick(event) {
  if (!event || !fieldNotesElements.list) {
    return;
  }
  const button = event.target?.closest?.('.field-notes-entry');
  if (!button || !fieldNotesElements.list.contains(button)) {
    return;
  }
  event.preventDefault();
  const targetIndex = Number.parseInt(button.dataset.entryIndex || '-1', 10);
  const totalPages = getFieldNotesPages().length;
  if (!Number.isFinite(targetIndex) || targetIndex < 0 || targetIndex >= totalPages) {
    return;
  }
  const previousIndex = fieldNotesState.currentIndex;
  fieldNotesState.currentIndex = targetIndex;
  const direction = targetIndex === previousIndex ? 0 : targetIndex > previousIndex ? 1 : -1;
  setFieldNotesPage(targetIndex, { direction });
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
  setFieldNotesView('list');

  const focusTarget =
    fieldNotesElements.lastFocus && typeof fieldNotesElements.lastFocus.focus === 'function'
      ? fieldNotesElements.lastFocus
      : fieldNotesElements.openButton;

  if (focusTarget) {
    focusFieldNotesElement(focusTarget);
  }

  fieldNotesElements.lastFocus = null;
}

export async function openFieldNotesOverlay() {
  const { overlay, closeButton } = fieldNotesElements;
  if (!overlay || isFieldNotesOverlayVisible()) {
    return;
  }

  await ensureFieldNotesPages();
  fieldNotesElements.lastFocus = typeof document !== 'undefined' ? document.activeElement : null;
  fieldNotesDependencies.revealOverlay(overlay);
  overlay.setAttribute('aria-hidden', 'false');
  fieldNotesState.touchStart = null;
  setFieldNotesView('list');

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
  fieldNotesElements.backButton = document.getElementById('field-notes-back');
  fieldNotesElements.title = document.getElementById('field-notes-title');
  fieldNotesElements.listView = document.getElementById('field-notes-list-view');
  fieldNotesElements.list = document.getElementById('field-notes-list');
  fieldNotesElements.empty = document.getElementById('field-notes-empty');
  fieldNotesElements.copy = document.getElementById('field-notes-copy');
  fieldNotesElements.pagination = document.getElementById('field-notes-pagination');
  fieldNotesElements.pageIndicator = document.getElementById('field-notes-page-indicator');
  fieldNotesElements.prevButton = document.getElementById('field-notes-prev');
  fieldNotesElements.nextButton = document.getElementById('field-notes-next');

  await ensureFieldNotesPages();
  fieldNotesState.currentIndex = Math.max(0, Math.min(getFieldNotesPages().length - 1, 0));
  setFieldNotesView('list');
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

  if (fieldNotesElements.backButton) {
    fieldNotesElements.backButton.addEventListener('click', (event) => {
      event.preventDefault();
      showFieldNotesList();
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

  if (fieldNotesElements.list) {
    fieldNotesElements.list.addEventListener('click', handleFieldNotesListClick);
  }
}
