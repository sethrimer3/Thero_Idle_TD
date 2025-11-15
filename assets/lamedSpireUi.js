/**
 * Handle DOM updates and upgrade button bindings for the Lamed spire tab.
 * Moving this logic out of `main.js` keeps the orchestrator focused on
 * simulation lifecycle work while this module encapsulates UI plumbing.
 */
const ELEMENT_IDS = {
  tier: 'lamed-tier',
  starMass: 'lamed-star-mass',
  nextTier: 'lamed-next-tier',
  orbitingCount: 'lamed-orbiting-count',
  absorptionsRate: 'lamed-absorptions-rate',
  massInflow: 'lamed-mass-inflow',
  dragLevel: 'lamed-drag-level',
  dragCoefficient: 'lamed-drag-coefficient',
  starMassLevel: 'lamed-star-mass-level',
  starMassValue: 'lamed-star-mass-value',
  dragButton: 'lamed-upgrade-drag-btn',
  dragCost: 'lamed-drag-cost',
  starMassButton: 'lamed-upgrade-star-mass-btn',
  starMassCost: 'lamed-star-mass-cost',
};

function createElementResolver(documentRef) {
  const cache = new Map();
  return function resolveElement(key) {
    if (!ELEMENT_IDS[key]) {
      return null;
    }
    if (!cache.has(key) || cache.get(key) === null) {
      cache.set(key, documentRef ? documentRef.getElementById(ELEMENT_IDS[key]) : null);
    }
    const element = cache.get(key);
    if (!element || !documentRef || documentRef.contains(element)) {
      return element;
    }
    cache.delete(key);
    return resolveElement(key);
  };
}

function setTextContent(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function toggleDisabledState(button, isDisabled) {
  if (!button) {
    return;
  }
  button.disabled = Boolean(isDisabled);
  button.classList.toggle('disabled', Boolean(isDisabled));
}

/**
 * Create a UI helper dedicated to the Lamed gravity spire.
 *
 * @param {Object} options
 * @param {Function} options.formatWholeNumber - Formatting helper provided by main.js.
 * @param {Document} [options.documentRef] - Optional document reference for testing.
 */
export function createLamedSpireUi({
  formatWholeNumber,
  documentRef = typeof document !== 'undefined' ? document : null,
}) {
  const resolveElement = createElementResolver(documentRef);
  let upgradeButtonsBound = false;

  function updateStatistics(simulationInstance) {
    if (!simulationInstance || typeof simulationInstance.getStatistics !== 'function') {
      return;
    }
    const stats = simulationInstance.getStatistics();
    setTextContent(resolveElement('tier'), stats.currentTier ?? '–');
    const starMass = Number.isFinite(stats.starMass) ? stats.starMass.toFixed(2) : '0.00';
    setTextContent(resolveElement('starMass'), starMass);

    const nextTierEl = resolveElement('nextTier');
    if (nextTierEl) {
      if (stats.nextTier === 'MAX') {
        nextTierEl.textContent = 'Maximum Tier Reached';
      } else {
        const nextTierLabel = stats.nextTier ?? '—';
        const milestoneLabel = stats.nextMilestone ?? '—';
        const progress = Number.isFinite(stats.progressToNext)
          ? (stats.progressToNext * 100).toFixed(1)
          : '0.0';
        nextTierEl.textContent = `${nextTierLabel} (${milestoneLabel}) - ${progress}%`;
      }
    }

    setTextContent(resolveElement('orbitingCount'), stats.orbitingStars ?? '0');
    const absorptionRate = Number.isFinite(stats.absorptionsPerMinute)
      ? stats.absorptionsPerMinute.toFixed(1)
      : '0.0';
    setTextContent(resolveElement('absorptionsRate'), absorptionRate);
    const inflowRate = Number.isFinite(stats.massInflowPerMinute)
      ? stats.massInflowPerMinute.toFixed(2)
      : '0.00';
    setTextContent(resolveElement('massInflow'), inflowRate);
    setTextContent(resolveElement('dragLevel'), stats.dragLevel ?? '0');
    const dragCoefficient = Number.isFinite(stats.dragCoefficient)
      ? stats.dragCoefficient.toFixed(3)
      : '0.000';
    setTextContent(resolveElement('dragCoefficient'), dragCoefficient);
    setTextContent(
      resolveElement('starMassLevel'),
      formatWholeNumber(stats.starMassUpgradeLevel ?? 0),
    );
    setTextContent(
      resolveElement('starMassValue'),
      formatWholeNumber(stats.orbitingSparkMass ?? 0),
    );

    const dragCostEl = resolveElement('dragCost');
    if (dragCostEl && typeof simulationInstance.getDragUpgradeCost === 'function') {
      dragCostEl.textContent = formatWholeNumber(simulationInstance.getDragUpgradeCost());
    }
    const dragButton = resolveElement('dragButton');
    if (dragButton && typeof simulationInstance.canUpgradeDrag === 'function') {
      toggleDisabledState(dragButton, !simulationInstance.canUpgradeDrag());
      if (typeof simulationInstance.maxDragLevel === 'number') {
        dragButton.style.display =
          stats.dragLevel >= simulationInstance.maxDragLevel ? 'none' : '';
      }
    }

    const starMassCostEl = resolveElement('starMassCost');
    if (starMassCostEl && typeof simulationInstance.getStarMassUpgradeCost === 'function') {
      starMassCostEl.textContent = formatWholeNumber(
        simulationInstance.getStarMassUpgradeCost(),
      );
    }
    const starMassButton = resolveElement('starMassButton');
    if (starMassButton && typeof simulationInstance.canUpgradeStarMass === 'function') {
      toggleDisabledState(starMassButton, !simulationInstance.canUpgradeStarMass());
    }
  }

  function bindUpgradeButtons({ onDragUpgrade, onStarMassUpgrade } = {}) {
    if (upgradeButtonsBound) {
      return;
    }
    const dragButton = resolveElement('dragButton');
    if (dragButton && typeof onDragUpgrade === 'function') {
      dragButton.addEventListener('click', () => onDragUpgrade());
    }
    const starMassButton = resolveElement('starMassButton');
    if (starMassButton && typeof onStarMassUpgrade === 'function') {
      starMassButton.addEventListener('click', () => onStarMassUpgrade());
    }
    upgradeButtonsBound = true;
  }

  return {
    updateStatistics,
    bindUpgradeButtons,
  };
}
