// Offline overlay and persistence plumbing extracted from the main bootstrap module.
// The helpers defined here orchestrate idle reward presentation, persisted storage
// snapshots, and the powder ledger log that chronicles player actions.

export const OFFLINE_STORAGE_KEY = 'glyph-defense-idle:offline';

const POWDER_LOG_LIMIT = 6; // Cap the running powder history so the overlay stays concise.

const powderLog = []; // Maintain the in-memory powder ledger for quick display refreshes.

// Track the live DOM elements for the overlay so focus handling and animations stay coordinated.
const offlineOverlayElements = {
  container: null,
  minutes: null,
  rate: null,
  total: null,
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

async function showOfflineOverlay(minutes, rate, powder) {
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

  const { minutes: minutesEl, rate: rateEl, total: totalEl } = offlineOverlayElements;
  if (minutesEl) {
    minutesEl.textContent = '0';
  }
  if (rateEl) {
    rateEl.textContent = '0';
  }
  if (totalEl) {
    totalEl.textContent = '0';
  }

  await animateOfflineNumber(minutesEl, minutes, { format: dependencies.formatWholeNumber });
  await animateOfflineNumber(rateEl, rate, { format: dependencies.formatGameNumber });
  await animateOfflineNumber(totalEl, powder, { format: dependencies.formatGameNumber });

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
  offlineOverlayElements.minutes = document.getElementById('offline-minutes');
  offlineOverlayElements.rate = document.getElementById('offline-rate');
  offlineOverlayElements.total = document.getElementById('offline-total');
  offlineOverlayElements.prompt = document.getElementById('offline-prompt');

  offlineOverlayElements.container.addEventListener('pointerdown', (event) => {
    if (offlineOverlayAnimating) {
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    hideOfflineOverlay();
  });

  offlineOverlayElements.container.addEventListener('keydown', (event) => {
    if (offlineOverlayAnimating) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar' || event.key === 'Escape') {
      event.preventDefault();
      hideOfflineOverlay();
    }
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
      entry = `Sandfall stabilized · Mote bonus ${dependencies.formatSignedPercentage(powderBonuses.sandBonus)}.`;
      break;
    }
    case 'sand-released': {
      entry = 'Sandfall released · Flow returns to natural mote drift.';
      break;
    }
    case 'dune-raise': {
      const { height = powderState.duneHeight } = context;
      const safeHeight = Number.isFinite(height) ? height : 0;
      const logValue = Math.log2(Math.max(0, safeHeight) + 1);
      entry = `Dune surveyed · h = ${safeHeight}, Δm = ${dependencies.formatDecimal(logValue, 2)}.`;
      break;
    }
    case 'dune-max': {
      entry = 'Dune survey halted · Ridge already at maximum elevation.';
      break;
    }
    case 'crystal-charge': {
      const { charges = powderState.charges } = context;
      entry = `Crystal lattice charged (${charges}/3) · Resonance rising.`;
      break;
    }
    case 'crystal-release': {
      const { pulseBonus = 0 } = context;
      entry = `Crystal pulse released · Σ surged ${dependencies.formatSignedPercentage(pulseBonus)}.`;
      break;
    }
    case 'achievement-unlocked': {
      const { title = 'Achievement' } = context;
      entry = `${title} seal unlocked · +1 Motes/min secured.`;
      break;
    }
    case 'offline-reward': {
      const { minutes = 0, rate = 0, powder = 0 } = context;
      const minutesLabel = dependencies.formatWholeNumber(minutes);
      entry = `Idle harvest · ${minutesLabel}m × ${dependencies.formatGameNumber(rate)} = +${dependencies.formatGameNumber(powder)} Motes.`;
      break;
    }
    case 'developer-adjust': {
      const { field = 'value', value = 0 } = context;
      const fieldLabels = {
        'idle-mote-bank': 'Idle mote bank',
        'idle-mote-rate': 'Idle mote fall rate',
        'base-start-thero': 'Base start þ',
        glyphs: 'Glyph reserves',
      };
      const label = fieldLabels[field] || field;
      entry = `Developer adjusted ${label} → ${dependencies.formatGameNumber(Number(value) || 0)}.`;
      break;
    }
    case 'mote-gem-collected': {
      const { type = 'Mote Gem', value = 0 } = context;
      dependencies.updateMoteGemInventoryDisplay();
      entry = `${type} cluster secured · +${dependencies.formatGameNumber(Math.max(0, value || 0))}.`;
      break;
    }
    case 'mode-switch': {
      const { mode = powderState.simulationMode, label } = context;
      const normalizedMode = mode === 'fluid' ? 'fluid' : 'sand';
      const modeLabel =
        normalizedMode === 'fluid'
          ? label || powderState.fluidProfileLabel || 'Fluid Study'
          : 'Powderfall Study';
      entry = `Simulation mode changed · ${modeLabel} engaged.`;
      break;
    }
    case 'fluid-unlocked': {
      const { threshold = powderConfig.fluidUnlockSigils || 0 } = context;
      const unitLabel = threshold === 1 ? 'Glyph' : 'Glyphs';
      entry = `Fluid resonance unlocked · Requires ${threshold} ${unitLabel}.`;
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
  if (effectiveRate <= 0) {
    return;
  }

  const powderEarned = minutesAway * effectiveRate;
  dependencies.applyPowderGain(powderEarned, { source: 'offline', minutes: minutesAway, rate: effectiveRate });
  dependencies.notifyIdleTime(minutesAway * 60000);
  showOfflineOverlay(minutesAway, effectiveRate, powderEarned);
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
