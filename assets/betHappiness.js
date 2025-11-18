const BET_HAPPINESS_PRODUCERS = {
  grasshopper: {
    id: 'grasshopper',
    label: 'Grasshopper',
    ratePerHour: 0.5,
  },
};

function normalizeCount(value, fallback = 0) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value));
}

function normalizeBank(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value);
}

/**
 * Manages Bet Spire happiness production so UI, idle summaries, and persistence
 * share the same data source.
 */
export function createBetHappinessSystem({
  state = {},
  formatGameNumber = (value) => String(value ?? 0),
  formatDecimal = (value, places = 2) => value?.toFixed ? value.toFixed(places) : String(value ?? 0),
} = {}) {
  const happinessState = state && typeof state === 'object' ? state : {};
  if (!happinessState.producers || typeof happinessState.producers !== 'object') {
    happinessState.producers = {};
  }
  if (!Number.isFinite(happinessState.producers.grasshopper)) {
    happinessState.producers.grasshopper = 4;
  }
  if (!Number.isFinite(happinessState.bank)) {
    happinessState.bank = 0;
  }

  let displayElements = {
    total: null,
    rate: null,
    list: null,
    empty: null,
    progressBar: null,
    progressFill: null,
    progressLabel: null,
    progressPrevious: null,
    progressNext: null,
    progressCurrent: null,
  };

  /**
   * Derive the current happiness segment using a doubling threshold that begins at 5 hp.
   * @param {number} total - Total stored happiness points.
   * @returns {{ previous: number, next: number, level: number, progress: number, clampedTotal: number }}
   */
  function resolveHappinessProgress(total) {
    const clampedTotal = normalizeBank(total);
    const baseThreshold = 5;
    let previous = 0;
    let next = baseThreshold;
    let level = 1;

    // March through the doubling ladder until the next target sits above the current bank.
    while (clampedTotal >= next) {
      previous = next;
      next *= 2;
      level += 1;
    }

    const span = Math.max(1, next - previous);
    const progress = Math.min(1, Math.max(0, (clampedTotal - previous) / span));

    return { previous, next, level, progress, clampedTotal };
  }

  function getProducerDefinition(id) {
    return BET_HAPPINESS_PRODUCERS[id] || null;
  }

  function getProducerCount(id) {
    const producerState = happinessState.producers || {};
    const stored = producerState[id];
    return normalizeCount(stored, 0);
  }

  function setProducerCount(id, count) {
    const definition = getProducerDefinition(id);
    if (!definition) {
      return getProducerCount(id);
    }
    const normalized = normalizeCount(count, 0);
    happinessState.producers[id] = normalized;
    return normalized;
  }

  function getProducerBreakdown() {
    return Object.values(BET_HAPPINESS_PRODUCERS).map((producer) => {
      const count = getProducerCount(producer.id);
      const totalRate = producer.ratePerHour * count;
      return {
        ...producer,
        count,
        totalRate,
      };
    });
  }

  function getTotalRatePerHour() {
    return getProducerBreakdown().reduce((sum, producer) => sum + producer.totalRate, 0);
  }

  function addHappiness(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return normalizeBank(happinessState.bank);
    }
    const next = normalizeBank(happinessState.bank) + amount;
    happinessState.bank = next;
    return happinessState.bank;
  }

  function calculateIdleHappiness(elapsedMs, { unlocked = true } = {}) {
    const hoursElapsed = Math.max(0, elapsedMs) / 3600000;
    const totalRate = unlocked ? getTotalRatePerHour() : 0;
    const earned = hoursElapsed * totalRate;
    if (earned > 0 && unlocked) {
      addHappiness(earned);
    }
    return {
      unlocked: Boolean(unlocked),
      perHour: totalRate,
      perMinute: totalRate / 60,
      earned,
      total: normalizeBank(happinessState.bank),
    };
  }

  function bindDisplayElements(elements = {}) {
    displayElements = {
      total: elements.happinessTotal || elements.total || displayElements.total,
      rate: elements.happinessRate || elements.rate || displayElements.rate,
      list: elements.happinessList || elements.list || displayElements.list,
      empty: elements.happinessEmpty || elements.empty || displayElements.empty,
      progressBar: elements.happinessProgressBar || elements.progressBar || displayElements.progressBar,
      progressFill: elements.happinessProgressFill || elements.progressFill || displayElements.progressFill,
      progressLabel: elements.happinessProgressLabel || elements.progressLabel || displayElements.progressLabel,
      progressPrevious:
        elements.happinessProgressPrevious || elements.progressPrevious || displayElements.progressPrevious,
      progressNext: elements.happinessProgressNext || elements.progressNext || displayElements.progressNext,
      progressCurrent:
        elements.happinessProgressCurrent || elements.progressCurrent || displayElements.progressCurrent,
    };
  }

  function updateDisplay(elements) {
    if (elements) {
      bindDisplayElements(elements);
    }

    const { total, rate, list, empty } = displayElements;
    const totalHappiness = normalizeBank(happinessState.bank);
    const totalRate = getTotalRatePerHour();

    if (total) {
      total.textContent = `${formatGameNumber(totalHappiness)} hp`;
    }
    if (rate) {
      rate.textContent = `${formatDecimal(totalRate, 2)} hp/hr`;
    }

    if (!list || !empty) {
      return;
    }

    const { progressLabel, progressBar, progressFill, progressPrevious, progressNext, progressCurrent } =
      displayElements;
    if (progressBar || progressFill || progressLabel || progressPrevious || progressNext || progressCurrent) {
      const { previous, next, level, progress, clampedTotal } = resolveHappinessProgress(totalHappiness);
      if (progressLabel) {
        progressLabel.textContent = `Happiness Level ${level}`;
      }
      if (progressPrevious) {
        progressPrevious.textContent = `${formatDecimal(previous, 0)} hp`;
      }
      if (progressNext) {
        progressNext.textContent = `${formatDecimal(next, 0)} hp`;
      }
      if (progressFill) {
        progressFill.style.width = `${Math.round(progress * 100)}%`;
      }
      if (progressCurrent) {
        progressCurrent.textContent = `${formatDecimal(clampedTotal, 1)} hp`;
        const anchoredPercent = Math.max(10, Math.min(90, progress * 100));
        progressCurrent.style.left = `${anchoredPercent}%`;
      }
      if (progressBar) {
        progressBar.classList.toggle('fluid-happiness-progress--empty', clampedTotal <= 0);
      }
    }

    list.textContent = '';
    const activeProducers = getProducerBreakdown().filter((producer) => producer.count > 0);

    if (!activeProducers.length) {
      list.hidden = true;
      list.setAttribute('aria-hidden', 'true');
      empty.hidden = false;
      empty.setAttribute('aria-hidden', 'false');
      return;
    }

    list.hidden = false;
    list.removeAttribute('aria-hidden');
    empty.hidden = true;
    empty.setAttribute('aria-hidden', 'true');

    const fragment = document.createDocumentFragment();
    activeProducers.forEach((producer) => {
      const item = document.createElement('li');
      item.className = 'fluid-happiness-list__item';
      const formattedRate = formatDecimal(producer.totalRate, 2);
      item.textContent = `${producer.label} (${producer.count}) = ${formattedRate} hp/hr`;
      fragment.appendChild(item);
    });
    list.appendChild(fragment);
  }

  return {
    getProducerBreakdown,
    getProducerCount,
    setProducerCount,
    getTotalRatePerHour,
    getTotalHappiness: () => normalizeBank(happinessState.bank),
    addHappiness,
    calculateIdleHappiness,
    bindDisplayElements,
    updateDisplay,
    state: happinessState,
  };
}
