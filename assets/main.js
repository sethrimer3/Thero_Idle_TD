const levelBlueprints = [
  {
    id: 'Conjecture - 1',
    title: 'Lemniscate Hypothesis',
    path: '∞ loop traced from r² = cos(2θ); mirrored spawn lanes cross twice.',
    focus: 'Early E glyphs surge with divisor scouts—tempo control is vital.',
    example:
      "Goldbach’s Conjecture: Every even integer greater than 2 is the sum of two primes.",
  },
  {
    id: 'Conjecture - 2',
    title: 'Collatz Cascade',
    path: 'Stepwise descent generated from the 3n + 1 map with teleport risers.',
    focus: 'Hit-count enemies appear on odd nodes; summon glyph soldiers to stall.',
    example:
      'Collatz Conjecture: Iterate n → n/2 or 3n + 1 and every positive integer reaches 1.',
  },
  {
    id: 'Conjecture - 3',
    title: 'Riemann Helix',
    path: 'Logarithmic spiral with harmonic bulges keyed to ζ(s) zero estimates.',
    focus: 'Divisor elites flank wave bosses—Ω previews excel at splash slows.',
    example:
      'Riemann Hypothesis: Every nontrivial zero of ζ(s) lies on the line Re(s) = 1/2.',
  },
  {
    id: 'Conjecture - 4',
    title: 'Twin Prime Fork',
    path: 'Dual lattice rails linked by prime gaps; enemies swap lanes unpredictably.',
    focus: 'Prime counters demand rapid-fire towers—γ chaining resets their count.',
    example:
      'Twin Prime Conjecture: Infinitely many primes p exist such that p + 2 is prime.',
  },
  {
    id: 'Conjecture - 5',
    title: 'Birch Flow',
    path: 'Cardioid river influenced by elliptic curve rank gradients.',
    focus: 'Reversal sentinels join late waves—δ soldiers can flip them to your side.',
    example:
      'Birch and Swinnerton-Dyer Conjecture: Rational points of elliptic curves link to L-series behavior.',
  },
];

const levelLookup = new Map(levelBlueprints.map((level) => [level.id, level]));
const levelState = new Map();

let tabs = [];
let panels = [];
let levelGrid = null;
let activeLevelEl = null;
let leaveLevelBtn = null;
let overlay = null;
let overlayLabel = null;
let overlayTitle = null;
let overlayExample = null;
let activeLevelId = null;
let pendingLevel = null;
let activeTabIndex = 0;

function setActiveTab(target) {
  if (!tabs.length || !panels.length) return;

  let matchedTab = false;

  tabs.forEach((tab, index) => {
    const isActive = tab.dataset.tab === target;
    if (isActive) {
      tab.classList.add('active');
      tab.setAttribute('aria-pressed', 'true');
      tab.setAttribute('aria-selected', 'true');
      tab.setAttribute('tabindex', '0');
      activeTabIndex = index;
      matchedTab = true;
    } else {
      tab.classList.remove('active');
      tab.setAttribute('aria-pressed', 'false');
      tab.setAttribute('aria-selected', 'false');
      tab.setAttribute('tabindex', '-1');
    }
  });

  panels.forEach((panel) => {
    const isActive = panel.dataset.panel === target;
    if (isActive) {
      panel.classList.add('active');
      panel.setAttribute('aria-hidden', 'false');
      panel.removeAttribute('hidden');
    } else {
      panel.classList.remove('active');
      panel.setAttribute('aria-hidden', 'true');
      panel.setAttribute('hidden', '');
    }
  });

  if (matchedTab && target === 'tower') {
    updateActiveLevelBanner();
  }
}

function focusAndActivateTab(index) {
  if (!tabs.length) return;
  const normalizedIndex = ((index % tabs.length) + tabs.length) % tabs.length;
  const targetTab = tabs[normalizedIndex];
  if (!targetTab) return;
  setActiveTab(targetTab.dataset.tab);
  targetTab.focus();
}

function buildLevelCards() {
  if (!levelGrid) return;
  const fragment = document.createDocumentFragment();

  levelBlueprints.forEach((level) => {
    const card = document.createElement('article');
    card.className = 'level-card';
    card.dataset.level = level.id;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-pressed', 'false');
    card.setAttribute('aria-label', `${level.id}: ${level.title}`);
    card.innerHTML = `
      <header>
        <span class="level-id">${level.id}</span>
        <h3>${level.title}</h3>
      </header>
      <p class="level-path"><strong>Path:</strong> ${level.path}</p>
      <p class="level-hazard"><strong>Focus:</strong> ${level.focus}</p>
      <p class="level-status-pill">New</p>
    `;
    card.addEventListener('click', () => handleLevelSelection(level));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleLevelSelection(level);
      }
    });
    fragment.append(card);
  });

  levelGrid.append(fragment);
}

function handleLevelSelection(level) {
  const state = levelState.get(level.id) || { entered: false, running: false };

  if (!state.entered) {
    pendingLevel = level;
    showLevelOverlay(level);
    return;
  }

  startLevel(level);
}

function showLevelOverlay(level) {
  if (!overlay || !overlayLabel || !overlayTitle || !overlayExample) return;
  overlayLabel.textContent = level.id;
  overlayTitle.textContent = level.title;
  overlayExample.textContent = level.example;
  overlay.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });
}

function hideLevelOverlay() {
  if (!overlay) return;
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
}

function startLevel(level) {
  const currentState = levelState.get(level.id) || { entered: false, running: false };
  currentState.entered = true;
  currentState.running = true;
  levelState.set(level.id, currentState);

  levelState.forEach((state, id) => {
    if (id !== level.id) {
      state.running = false;
      levelState.set(id, state);
    }
  });

  activeLevelId = level.id;
  updateActiveLevelBanner();
  updateLevelCards();
}

function leaveActiveLevel() {
  if (!activeLevelId) return;
  const state = levelState.get(activeLevelId);
  if (state) {
    state.running = false;
    levelState.set(activeLevelId, state);
  }
  activeLevelId = null;
  updateActiveLevelBanner();
  updateLevelCards();
}

function updateLevelCards() {
  if (!levelGrid) return;
  levelBlueprints.forEach((level) => {
    const card = levelGrid.querySelector(`[data-level="${level.id}"]`);
    if (!card) return;
    const pill = card.querySelector('.level-status-pill');
    const state = levelState.get(level.id);

    const entered = Boolean(state && state.entered);
    const running = Boolean(state && state.running);

    card.classList.toggle('entered', entered);
    card.setAttribute('aria-pressed', running ? 'true' : 'false');

    if (!entered) {
      pill.textContent = 'New';
    } else if (running) {
      pill.textContent = 'Running';
    } else {
      pill.textContent = 'Ready';
    }
  });
}

function updateActiveLevelBanner() {
  if (!activeLevelEl) return;
  if (!activeLevelId) {
    activeLevelEl.textContent = 'None selected';
    return;
  }

  const level = levelLookup.get(activeLevelId);
  const state = levelState.get(activeLevelId);
  if (!level || !state) {
    activeLevelEl.textContent = 'None selected';
    return;
  }

  const descriptor = state.running ? 'Running' : 'Paused';
  activeLevelEl.textContent = `${level.id} · ${level.title} (${descriptor})`;
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  if (!tabs.length) return;
  const activeElement = document.activeElement;
  if (!activeElement || !activeElement.closest('.tab-bar')) return;
  if (overlay && overlay.classList.contains('active')) return;

  const direction = event.key === 'ArrowRight' ? 1 : -1;
  event.preventDefault();
  focusAndActivateTab(activeTabIndex + direction);
});

function initializeTabs() {
  tabs = Array.from(document.querySelectorAll('.tab-button'));
  panels = Array.from(document.querySelectorAll('.panel'));

  if (!tabs.length || !panels.length) {
    return;
  }

  const existingActiveIndex = tabs.findIndex((tab) => tab.classList.contains('active'));
  activeTabIndex = existingActiveIndex >= 0 ? existingActiveIndex : 0;

  tabs.forEach((tab, index) => {
    if (!tab.getAttribute('type')) {
      tab.setAttribute('type', 'button');
    }

    tab.addEventListener('click', () => {
      focusAndActivateTab(index);
    });

    tab.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        focusAndActivateTab(index);
      }
    });
  });

  panels.forEach((panel) => {
    const isActive = panel.classList.contains('active');
    panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    if (!isActive) {
      panel.setAttribute('hidden', '');
    }
  });

  const initialTab = tabs[activeTabIndex];
  if (initialTab) {
    setActiveTab(initialTab.dataset.tab);
  }
}

function bindOverlayEvents() {
  if (!overlay) return;
  overlay.addEventListener('click', () => {
    hideLevelOverlay();
    if (pendingLevel) {
      startLevel(pendingLevel);
      pendingLevel = null;
    }
  });
}

function bindLeaveLevelButton() {
  if (!leaveLevelBtn) return;
  leaveLevelBtn.addEventListener('click', () => {
    leaveActiveLevel();
  });
}

function init() {
  levelGrid = document.getElementById('level-grid');
  activeLevelEl = document.getElementById('active-level');
  leaveLevelBtn = document.getElementById('leave-level');
  overlay = document.getElementById('level-overlay');
  overlayLabel = document.getElementById('overlay-level');
  overlayTitle = document.getElementById('overlay-title');
  overlayExample = document.getElementById('overlay-example');

  initializeTabs();
  buildLevelCards();
  updateLevelCards();
  bindOverlayEvents();
  bindLeaveLevelButton();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
