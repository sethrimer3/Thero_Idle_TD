// Offline overlay and persistence plumbing extracted from the main bootstrap module.
// The helpers defined here orchestrate idle reward presentation, persisted storage
// snapshots, and the powder ledger log that chronicles player actions.

export const OFFLINE_STORAGE_KEY = 'glyph-defense-idle:offline';

const POWDER_LOG_LIMIT = 6; // Cap the running powder history so the overlay stays concise.

const powderLog = []; // Maintain the in-memory powder ledger for quick display refreshes.

// Track the live DOM elements for the overlay so focus handling and animations stay coordinated.
const offlineOverlayElements = {
  container: null,
  title: null,
  alephRow: null,
  alephMultiplier: null,
  alephTotal: null,
  betRow: null,
  betMultiplier: null,
  betTotal: null,
  happinessRow: null,
  happinessMultiplier: null,
  happinessTotal: null,
  lamedRow: null,
  lamedMultiplier: null,
  lamedTotal: null,
  tsadiRow: null,
  tsadiMultiplier: null,
  tsadiTotal: null,
  waalsRow: null,
  waalsMultiplier: null,
  waalsTotal: null,
  shinRow: null,
  shinMultiplier: null,
  shinTotal: null,
  kufRow: null,
  kufMultiplier: null,
  kufTotal: null,
  prompt: null,
};

let offlineOverlayAnimating = false;
let offlineOverlayFadeHandle = null;
let offlineOverlayPromptHandle = null;
let offlineOverlayLastFocus = null;

const OFFLINE_OVERLAY_FADE_MS = 220; // Align with the CSS transition duration for smooth fades.
const OFFLINE_PROMPT_DELAY_MS = 10000; // Surface the prompt after players have absorbed the reward numbers.

const dependencies = {
  formatWholeNumber: (value) => String(Math.max(0, Math.floor(Number(value) || 0))),
  formatGameNumber: (value) => String(Number(value) || 0),
  formatDecimal: (value) => String(Number(value) || 0),
  formatSignedPercentage: (value) => String(Number(value) || 0),
  readStorageJson: () => null,
  writeStorageJson: () => {},
  applyPowderGain: () => 0,
  notifyIdleTime: () => {},
  getCurrentFluxRate: () => 0,
  onBeforePersist: () => {},
  getCurrentPowderBonuses: () => ({ sandBonus: 0, duneBonus: 0, crystalBonus: 0, totalMultiplier: 1 }),
  powderState: null,
  powderConfig: null,
  powderElements: null,
  updateMoteGemInventoryDisplay: () => {},
  setActiveTab: () => {},
};

/**
 * Injects runtime dependencies so the offline helpers can coordinate with the
 * broader game state without introducing circular imports.
 */
export function configureOfflinePersistence(config = {}) {
  Object.assign(dependencies, config);
}

function getPowderElements() {
  return dependencies.powderElements || {};
}

function clearOfflineOverlayPrompt() {
  if (offlineOverlayPromptHandle) {
    clearTimeout(offlineOverlayPromptHandle);
    offlineOverlayPromptHandle = null;
  }
  const { prompt } = offlineOverlayElements;
  if (prompt) {
    prompt.classList.remove('offline-overlay__prompt--visible');
  }
}

function scheduleOfflineOverlayPrompt() {
  const { prompt, container } = offlineOverlayElements;
  if (!prompt || !container) {
    return;
  }
  if (offlineOverlayPromptHandle) {
    clearTimeout(offlineOverlayPromptHandle);
    offlineOverlayPromptHandle = null;
  }
  offlineOverlayPromptHandle = setTimeout(() => {
    offlineOverlayPromptHandle = null;
    if (container.classList.contains('active')) {
      prompt.classList.add('offline-overlay__prompt--visible');
    }
  }, OFFLINE_PROMPT_DELAY_MS);
}

function animateOfflineNumber(element, target, options = {}) {
  if (!element) {
    return Promise.resolve();
  }

  const settings = {
    duration: 800,
    prefix: '',
    suffix: '',
    format: dependencies.formatGameNumber,
    ...options,
  };

  const finalValue = Math.max(0, target);

  return new Promise((resolve) => {
    const start = performance.now();

    const step = (timestamp) => {
      const elapsed = timestamp - start;
      const progress = Math.min(1, elapsed / settings.duration);
      const eased = 1 - (1 - progress) ** 3;
      const value = progress >= 1 ? finalValue : finalValue * eased;
      element.textContent = `${settings.prefix}${settings.format(value)}${settings.suffix}`;
      if (progress < 1) {
        requestAnimationFrame(step);
        return;
      }
      resolve();
    };

    requestAnimationFrame(step);
  });
}

async function showOfflineOverlay(summary = {}) {
  const container = offlineOverlayElements.container;
  if (!container) {
    return;
  }

  if (offlineOverlayFadeHandle) {
    clearTimeout(offlineOverlayFadeHandle);
    offlineOverlayFadeHandle = null;
  }

  offlineOverlayAnimating = true;
  const activeElement = document.activeElement;
  offlineOverlayLastFocus = activeElement instanceof HTMLElement ? activeElement : null;
  container.removeAttribute('hidden');
  container.classList.add('active');
  container.setAttribute('aria-hidden', 'false');

  clearOfflineOverlayPrompt();

  if (typeof container.focus === 'function') {
    container.focus({ preventScroll: true });
  }

  const {
    title,
    alephRow,
    alephMultiplier,
    alephTotal,
    betRow,
    betMultiplier,
    betTotal,
    happinessRow,
    happinessMultiplier,
    happinessTotal,
    lamedRow,
    lamedMultiplier,
    lamedTotal,
    tsadiRow,
    tsadiMultiplier,
    tsadiTotal,
    waalsRow,
    waalsMultiplier,
    waalsTotal,
    shinRow,
    shinMultiplier,
    shinTotal,
    kufRow,
    kufMultiplier,
    kufTotal,
  } = offlineOverlayElements;

  const minutesValue = Math.max(0, Number(summary.minutes) || 0);
  
  // Update the title with the minutes count
  if (title) {
    const minutesText = minutesValue === 1 ? 'minute' : 'minutes';
    title.textContent = `Asleep ${dependencies.formatWholeNumber(minutesValue)} ${minutesText}…`;
  }
  const alephSummary = summary.aleph || {};
  const betSummary = summary.bet || {};
  const happinessSummary = summary.happiness || {};
  const lamedSummary = summary.lamed || {};
  const tsadiSummary = summary.tsadi || {};
  const waalsSummary = summary.bindingAgents || {};
  const shinSummary = summary.shin || {};
  const kufSummary = summary.kuf || {};

  const alephMultiplierValue = Math.max(0, Number(alephSummary.multiplier) || 0);
  const alephTotalValue = Math.max(0, Number(alephSummary.total) || 0);
  const betUnlocked = Boolean(betSummary.unlocked);
  const betMultiplierValue = Math.max(0, Number(betSummary.multiplier) || 0);
  const betTotalValue = Math.max(0, Number(betSummary.total) || 0);
  const happinessUnlocked = Boolean(happinessSummary.unlocked);
  const happinessMultiplierValue = Math.max(0, Number(happinessSummary.multiplier) || 0);
  const happinessTotalValue = Math.max(0, Number(happinessSummary.total) || 0);
  const lamedUnlocked = Boolean(lamedSummary.unlocked);
  const lamedMultiplierValue = Math.max(0, Number(lamedSummary.multiplier) || 0);
  const lamedTotalValue = Math.max(0, Number(lamedSummary.total) || 0);
  const tsadiUnlocked = Boolean(tsadiSummary.unlocked);
  const tsadiMultiplierValue = Math.max(0, Number(tsadiSummary.multiplier) || 0);
  const tsadiTotalValue = Math.max(0, Number(tsadiSummary.total) || 0);
  const waalsUnlocked = Boolean(waalsSummary.unlocked);
  const waalsMultiplierValue = Math.max(0, Number(waalsSummary.multiplier) || 0);
  const waalsTotalValue = Math.max(0, Number(waalsSummary.total) || 0);
  const shinUnlocked = Boolean(shinSummary.unlocked);
  const shinMultiplierValue = Math.max(0, Number(shinSummary.multiplier) || 0);
  const shinTotalValue = Math.max(0, Number(shinSummary.total) || 0);
  const kufUnlocked = Boolean(kufSummary.unlocked);
  const kufMultiplierValue = Math.max(0, Number(kufSummary.multiplier) || 0);
  const kufTotalValue = Math.max(0, Number(kufSummary.total) || 0);

  // Hide locked rows entirely so players only see idle equations for unlocked spires.
  const syncOfflineRowVisibility = (rowElement, unlocked) => {
    if (!rowElement) {
      return;
    }
    rowElement.classList.toggle('offline-overlay__equation-row--inactive', !unlocked);
    rowElement.setAttribute('aria-hidden', unlocked ? 'false' : 'true');
    if (unlocked) {
      rowElement.removeAttribute('hidden');
    } else {
      rowElement.setAttribute('hidden', '');
    }
  };

  syncOfflineRowVisibility(betRow, betUnlocked);
  syncOfflineRowVisibility(happinessRow, happinessUnlocked);
  syncOfflineRowVisibility(lamedRow, lamedUnlocked);
  syncOfflineRowVisibility(tsadiRow, tsadiUnlocked);
  syncOfflineRowVisibility(waalsRow, waalsUnlocked);
  syncOfflineRowVisibility(shinRow, shinUnlocked);
  syncOfflineRowVisibility(kufRow, kufUnlocked);

  [
    alephMultiplier,
    alephTotal,
    betMultiplier,
    betTotal,
    happinessMultiplier,
    happinessTotal,
    lamedMultiplier,
    lamedTotal,
    tsadiMultiplier,
    tsadiTotal,
    waalsMultiplier,
    waalsTotal,
    shinMultiplier,
    shinTotal,
    kufMultiplier,
    kufTotal,
  ].forEach((element) => {
    if (element) {
      element.textContent = '0';
    }
  });

  await Promise.all([
    animateOfflineNumber(alephMultiplier, alephMultiplierValue, { format: dependencies.formatWholeNumber }),
    animateOfflineNumber(betMultiplier, betUnlocked ? betMultiplierValue : 0, {
      format: dependencies.formatWholeNumber,
    }),
    animateOfflineNumber(happinessMultiplier, happinessUnlocked ? happinessMultiplierValue : 0, {
      format: dependencies.formatDecimal,
    }),
    animateOfflineNumber(lamedMultiplier, lamedUnlocked ? lamedMultiplierValue : 0, {
      format: dependencies.formatWholeNumber,
    }),
    animateOfflineNumber(tsadiMultiplier, tsadiUnlocked ? tsadiMultiplierValue : 0, {
      format: dependencies.formatWholeNumber,
    }),
    animateOfflineNumber(waalsMultiplier, waalsUnlocked ? waalsMultiplierValue : 0, {
      format: dependencies.formatDecimal,
    }),
    animateOfflineNumber(shinMultiplier, shinUnlocked ? shinMultiplierValue : 0, {
      format: dependencies.formatWholeNumber,
    }),
    animateOfflineNumber(kufMultiplier, kufUnlocked ? kufMultiplierValue : 0, {
      format: dependencies.formatWholeNumber,
    }),
  ]);

  await Promise.all([
    animateOfflineNumber(alephTotal, alephTotalValue, {
      format: dependencies.formatGameNumber,
    }),
    animateOfflineNumber(betTotal, betUnlocked ? betTotalValue : 0, {
      format: dependencies.formatGameNumber,
    }),
    animateOfflineNumber(happinessTotal, happinessUnlocked ? happinessTotalValue : 0, {
      format: dependencies.formatDecimal,
    }),
    animateOfflineNumber(lamedTotal, lamedUnlocked ? lamedTotalValue : 0, {
      format: dependencies.formatGameNumber,
    }),
    animateOfflineNumber(tsadiTotal, tsadiUnlocked ? tsadiTotalValue : 0, {
      format: dependencies.formatGameNumber,
    }),
    animateOfflineNumber(waalsTotal, waalsUnlocked ? waalsTotalValue : 0, {
      format: dependencies.formatDecimal,
    }),
    animateOfflineNumber(shinTotal, shinUnlocked ? shinTotalValue : 0, {
      format: dependencies.formatGameNumber,
    }),
    animateOfflineNumber(kufTotal, kufUnlocked ? kufTotalValue : 0, {
      format: dependencies.formatGameNumber,
    }),
  ]);

  offlineOverlayAnimating = false;
  scheduleOfflineOverlayPrompt();
}

function hideOfflineOverlay() {
  const container = offlineOverlayElements.container;
  if (!container) {
    return;
  }
  clearOfflineOverlayPrompt();
  if (offlineOverlayFadeHandle) {
    clearTimeout(offlineOverlayFadeHandle);
    offlineOverlayFadeHandle = null;
  }
  offlineOverlayAnimating = true;
  container.classList.remove('active');
  container.setAttribute('aria-hidden', 'true');
  offlineOverlayFadeHandle = setTimeout(() => {
    container.setAttribute('hidden', '');
    offlineOverlayFadeHandle = null;
    offlineOverlayAnimating = false;
    if (
      offlineOverlayLastFocus &&
      typeof offlineOverlayLastFocus.focus === 'function' &&
      document.contains(offlineOverlayLastFocus)
    ) {
      offlineOverlayLastFocus.focus({ preventScroll: true });
    }
    offlineOverlayLastFocus = null;
    if (typeof dependencies.setActiveTab === 'function') {
      dependencies.setActiveTab('powder');
    }
  }, OFFLINE_OVERLAY_FADE_MS);
}

/**
 * Cache the DOM hooks for the offline overlay so the module can animate the
 * reward presentation and restore focus after dismissal.
 */
export function bindOfflineOverlayElements() {
  offlineOverlayElements.container = document.getElementById('offline-overlay');
  if (!offlineOverlayElements.container) {
    return;
  }
  offlineOverlayElements.title = document.getElementById('offline-overlay-title');
  offlineOverlayElements.alephRow = document.getElementById('offline-aleph-row');
  offlineOverlayElements.alephMultiplier = document.getElementById('offline-aleph-multiplier');
  offlineOverlayElements.alephTotal = document.getElementById('offline-aleph-total');
  offlineOverlayElements.betRow = document.getElementById('offline-bet-row');
  offlineOverlayElements.betMultiplier = document.getElementById('offline-bet-multiplier');
  offlineOverlayElements.betTotal = document.getElementById('offline-bet-total');
  offlineOverlayElements.happinessRow = document.getElementById('offline-happiness-row');
  offlineOverlayElements.happinessMultiplier = document.getElementById('offline-happiness-multiplier');
  offlineOverlayElements.happinessTotal = document.getElementById('offline-happiness-total');
  offlineOverlayElements.lamedRow = document.getElementById('offline-lamed-row');
  offlineOverlayElements.lamedMultiplier = document.getElementById('offline-lamed-multiplier');
  offlineOverlayElements.lamedTotal = document.getElementById('offline-lamed-total');
  offlineOverlayElements.tsadiRow = document.getElementById('offline-tsadi-row');
  offlineOverlayElements.tsadiMultiplier = document.getElementById('offline-tsadi-multiplier');
  offlineOverlayElements.tsadiTotal = document.getElementById('offline-tsadi-total');
  offlineOverlayElements.waalsRow = document.getElementById('offline-waals-row');
  offlineOverlayElements.waalsMultiplier = document.getElementById('offline-waals-multiplier');
  offlineOverlayElements.waalsTotal = document.getElementById('offline-waals-total');
  offlineOverlayElements.shinRow = document.getElementById('offline-shin-row');
  offlineOverlayElements.shinMultiplier = document.getElementById('offline-shin-multiplier');
  offlineOverlayElements.shinTotal = document.getElementById('offline-shin-total');
  offlineOverlayElements.kufRow = document.getElementById('offline-kuf-row');
  offlineOverlayElements.kufMultiplier = document.getElementById('offline-kuf-multiplier');
  offlineOverlayElements.kufTotal = document.getElementById('offline-kuf-total');
  offlineOverlayElements.prompt = document.getElementById('offline-prompt');

  // Allow players to bypass the offline tally as soon as they interact with the overlay.
  offlineOverlayElements.container.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    hideOfflineOverlay();
  });

  offlineOverlayElements.container.addEventListener('keydown', (event) => {
    // Any key press should dismiss the overlay immediately, even mid-animation.
    event.preventDefault();
    hideOfflineOverlay();
  });
}

/**
 * Walk the cached powder elements and rebuild the powder log list so the HUD
 * mirrors the latest ledger entries.
 */
export function updatePowderLogDisplay() {
  const { logList, logEmpty } = getPowderElements();
  if (!logList || !logEmpty) {
    return;
  }

  logList.innerHTML = '';

  if (!powderLog.length) {
    logList.setAttribute('hidden', '');
    logEmpty.hidden = false;
    return;
  }

  logList.removeAttribute('hidden');
  logEmpty.hidden = true;

  const fragment = document.createDocumentFragment();
  powderLog.forEach((entry) => {
    const item = document.createElement('li');
    item.textContent = entry;
    fragment.append(item);
  });
  logList.append(fragment);
}

/**
 * Append a formatted ledger entry describing powder-related events so players
 * can retrace recent actions.
 */
export function recordPowderEvent(type, context = {}) {
  const powderState = dependencies.powderState || {};
  const powderConfig = dependencies.powderConfig || {};
  const powderBonuses = dependencies.getCurrentPowderBonuses();

  let entry = '';

  switch (type) {
    case 'sand-stabilized': {
      entry = `Sandfall stabilized ? Mote bonus ${dependencies.formatSignedPercentage(powderBonuses.sandBonus)}.`;
      break;
    }
    case 'sand-released': {
      entry = 'Sandfall released ? Flow returns to natural mote drift.';
      break;
    }
    case 'dune-raise': {
      const { height = powderState.duneHeight } = context;
      const safeHeight = Number.isFinite(height) ? height : 0;
      const logValue = Math.log2(Math.max(0, safeHeight) + 1);
      entry = `Dune surveyed ? h = ${safeHeight}, ?m = ${dependencies.formatDecimal(logValue, 2)}.`;
      break;
    }
    case 'dune-max': {
      entry = 'Dune survey halted ? Ridge already at maximum elevation.';
      break;
    }
    case 'crystal-charge': {
      const { charges = powderState.charges } = context;
      entry = `Crystal lattice charged (${charges}/3) ? Resonance rising.`;
      break;
    }
    case 'crystal-release': {
      const { pulseBonus = 0 } = context;
      entry = `Crystal pulse released ? ? surged ${dependencies.formatSignedPercentage(pulseBonus)}.`;
      break;
    }
    case 'achievement-unlocked': {
      const { title = 'Achievement' } = context;
      entry = `${title} seal unlocked ? +1 Motes/min secured.`;
      break;
    }
    case 'offline-reward': {
      const { minutes = 0, powder = 0, idleSummary = null } = context;
      const minutesLabel = dependencies.formatWholeNumber(minutes);
      const alephMultiplier = idleSummary?.aleph?.multiplier;
      const alephTotal = idleSummary?.aleph?.total;
      const betUnlocked = Boolean(idleSummary?.bet?.unlocked);
      const betMultiplier = idleSummary?.bet?.multiplier;
      const betTotal = idleSummary?.bet?.total;
      const happinessUnlocked = Boolean(idleSummary?.happiness?.unlocked);
      const happinessMultiplier = idleSummary?.happiness?.multiplier;
      const happinessTotal = idleSummary?.happiness?.total;

      const safeAlephMultiplier = Number.isFinite(alephMultiplier) ? Math.max(0, alephMultiplier) : 0;
      const safeAlephTotal = Number.isFinite(alephTotal) ? Math.max(0, alephTotal) : 0;
      const alephRateLabel = dependencies.formatGameNumber(safeAlephMultiplier);
      const alephGainLabel = dependencies.formatGameNumber(safeAlephTotal);

      const betPieces = [];
      if (betUnlocked) {
        const safeBetMultiplier = Number.isFinite(betMultiplier) ? Math.max(0, betMultiplier) : 0;
        const safeBetTotal = Number.isFinite(betTotal) ? Math.max(0, betTotal) : 0;
        const betRateLabel = dependencies.formatGameNumber(safeBetMultiplier);
        const betGainLabel = dependencies.formatGameNumber(safeBetTotal);
        betPieces.push(`בּ × ${betRateLabel} = +${betGainLabel} Serendipity`);
      }

      const happinessPieces = [];
      if (happinessUnlocked) {
        const safeHappinessMultiplier = Number.isFinite(happinessMultiplier)
          ? Math.max(0, happinessMultiplier)
          : 0;
        const safeHappinessTotal = Number.isFinite(happinessTotal) ? Math.max(0, happinessTotal) : 0;
        const happinessRateLabel = dependencies.formatDecimal(safeHappinessMultiplier * 60, 2);
        const happinessGainLabel = dependencies.formatDecimal(safeHappinessTotal, 2);
        happinessPieces.push(`☺ × ${happinessRateLabel}/hr = +${happinessGainLabel} happiness`);
      }

      const powderLabel = dependencies.formatGameNumber(Math.max(0, powder));
      const fragments = [
        `ℵ × ${alephRateLabel} = +${alephGainLabel} Motes`,
      ];
      if (betPieces.length) {
        fragments.push(...betPieces);
      }
      if (happinessPieces.length) {
        fragments.push(...happinessPieces);
      }
      fragments.push(`${powderLabel} Powder recaptured`);

      entry = `While away ? ${minutesLabel}m · ${fragments.join(' ? ')}.`;
      break;
    }
    case 'developer-adjust': {
      const { field = 'value', value = 0 } = context;
      const fieldLabels = {
        'idle-mote-bank': 'Idle mote bank',
        'idle-mote-rate': 'Idle mote fall rate',
        'base-start-thero': 'Base start ?',
        glyphs: 'Glyph reserves',
      };
      const label = fieldLabels[field] || field;
      entry = `Developer adjusted ${label} ? ${dependencies.formatGameNumber(Number(value) || 0)}.`;
      break;
    }
    case 'mote-gem-collected': {
      const { type = 'Mote Gem', value = 0 } = context;
      dependencies.updateMoteGemInventoryDisplay();
      entry = `${type} cluster secured ? +${dependencies.formatGameNumber(Math.max(0, value || 0))}.`;
      break;
    }
    case 'mode-switch': {
      const { mode = powderState.simulationMode, label } = context;
      const normalizedMode = mode === 'fluid' ? 'fluid' : 'sand';
      const modeLabel =
        normalizedMode === 'fluid'
          ? label || powderState.fluidProfileLabel || 'Bet Spire'
          : 'Powderfall Study';
      entry = `Simulation mode changed ? ${modeLabel} engaged.`;
      break;
    }
    case 'fluid-unlocked': {
      const reason = context && context.reason === 'sigil' ? 'sigil' : 'purchase';
      const glyphCostSource =
        context && Number.isFinite(context.glyphCost)
          ? context.glyphCost
          : dependencies.powderConfig?.fluidUnlockGlyphCost || 0;
      const glyphCost = Math.max(0, Math.floor(Number(glyphCostSource) || 0));
      if (reason === 'sigil') {
        const thresholdSource =
          context && Number.isFinite(context.threshold)
            ? context.threshold
            : dependencies.powderConfig?.fluidUnlockSigils || 0;
        const threshold = Math.max(0, Math.floor(Number(thresholdSource) || 0));
        const unitLabel = threshold === 1 ? 'Sigil' : 'Sigils';
        entry = `Fluid resonance unlocked ? ${dependencies.formatWholeNumber(threshold)} ${unitLabel} ascended.`;
      } else if (glyphCost > 0) {
        entry = `Fluid resonance unlocked ? ℵ ${dependencies.formatWholeNumber(glyphCost)} tithed.`;
      } else {
        entry = 'Fluid resonance unlocked ? Aleph tithe waived.';
      }
      break;
    }
    default:
      break;
  }

  if (!entry) {
    return;
  }

  powderLog.unshift(entry);
  if (powderLog.length > POWDER_LOG_LIMIT) {
    powderLog.length = POWDER_LOG_LIMIT;
  }
  updatePowderLogDisplay();
}

/**
 * Inspect persisted timestamps to determine whether the player earned offline
 * powder and, if so, surface the animated overlay while crediting the reward.
 */
export function checkOfflineRewards() {
  const savedState = dependencies.readStorageJson(OFFLINE_STORAGE_KEY);
  if (!savedState?.timestamp) {
    return;
  }

  const lastActive = Number(savedState.timestamp);
  if (!Number.isFinite(lastActive)) {
    return;
  }

  const now = Date.now();
  const elapsedMs = Math.max(0, now - lastActive);
  const minutesAway = Math.floor(elapsedMs / 60000);
  if (minutesAway <= 0) {
    return;
  }

  const storedRate = Number(savedState.powderRate);
  const fallbackRate = dependencies.getCurrentFluxRate();
  const effectiveRate = Number.isFinite(storedRate) ? Math.max(0, storedRate) : Math.max(0, fallbackRate);

  const powderEarned = minutesAway * effectiveRate;
  const idleSummary =
    dependencies.notifyIdleTime(minutesAway * 60000) || {
      minutes: minutesAway,
      aleph: { multiplier: 0, total: 0, unlocked: true },
      bet: { multiplier: 0, total: 0, unlocked: false },
      happiness: { multiplier: 0, total: 0, unlocked: false },
      lamed: { multiplier: 0, total: 0, unlocked: false },
      tsadi: { multiplier: 0, total: 0, unlocked: false },
      bindingAgents: { multiplier: 0, total: 0, unlocked: false },
      shin: { multiplier: 0, total: 0, unlocked: false },
      kuf: { multiplier: 0, total: 0, unlocked: false },
    };
  dependencies.applyPowderGain(powderEarned, {
    source: 'offline',
    minutes: minutesAway,
    rate: effectiveRate,
    powder: powderEarned,
    idleSummary,
  });
  showOfflineOverlay({
    minutes: minutesAway,
    aleph: idleSummary.aleph,
    bet: idleSummary.bet,
    happiness: idleSummary.happiness,
    lamed: idleSummary.lamed,
    tsadi: idleSummary.tsadi,
    bindingAgents: idleSummary.bindingAgents,
    shin: idleSummary.shin,
    kuf: idleSummary.kuf,
  });
}

/**
 * Persist the most recent activity timestamp alongside the current powder gain
 * rate so the next session can award an appropriate idle bonus.
 */
export function markLastActive() {
  dependencies.onBeforePersist();
  dependencies.writeStorageJson(OFFLINE_STORAGE_KEY, {
    timestamp: Date.now(),
    powderRate: dependencies.getCurrentFluxRate(),
  });
}
