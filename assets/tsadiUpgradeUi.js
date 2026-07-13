/**
 * Tsadi Spire upgrade UI bindings extracted from main.js.
 * Provides helpers to wire button events and refresh UI states using the active Tsadi simulation.
 *
 * @param {Object} options - Dependency injection options.
 * @param {Function} options.getTsadiSimulation - Returns the current Tsadi simulation instance.
 * @param {Object} options.spireMenuController - Controller with methods for updating spire counts.
 * @returns {{ bindTsadiUpgradeButtons: Function, updateTsadiUpgradeUI: Function }}
 */
export function createTsadiUpgradeUi({ getTsadiSimulation, spireMenuController }) {
  /**
   * Update Tsadi upgrade UI elements with the latest simulation data.
   * Mirrors the original DOM updates from main.js so button state and labels stay in sync.
   *
   * @returns {void}
   */
  function updateTsadiUpgradeUI() {
    const simulation = typeof getTsadiSimulation === 'function' ? getTsadiSimulation() : null;
    if (!simulation || typeof simulation.getUpgradeInfo !== 'function') {
      return;
    }

    const upgradeInfo = simulation.getUpgradeInfo();

    const repellingLevel = document.getElementById('tsadi-upgrade-repelling-level');
    const repellingCost = document.getElementById('tsadi-upgrade-repelling-cost');
    const repellingButton = document.getElementById('tsadi-upgrade-repelling-button');
    const repellingDesc = document.getElementById('tsadi-upgrade-repelling-description');

    const waveLevel = document.getElementById('tsadi-upgrade-wave-level');
    const waveCost = document.getElementById('tsadi-upgrade-wave-cost');
    const waveButton = document.getElementById('tsadi-upgrade-wave-button');
    const waveDesc = document.getElementById('tsadi-upgrade-wave-description');

    if (repellingLevel) {
      repellingLevel.textContent = `Level ${upgradeInfo.repellingForceReduction.level}`;
    }
    if (repellingCost) {
      repellingCost.textContent = `Cost: ${upgradeInfo.repellingForceReduction.cost} Particles`;
    }
    if (repellingButton) {
      repellingButton.disabled = !upgradeInfo.repellingForceReduction.canAfford;
    }
    if (repellingDesc) {
      const effect = upgradeInfo.repellingForceReduction.effect;
      repellingDesc.textContent = `Reduces particle repelling force by 50% per level. Current: ${effect}. When force becomes negative, particles attract instead of repel.`;
    }

    if (waveLevel) {
      waveLevel.textContent = `Level ${upgradeInfo.waveForce.level}`;
    }
    if (waveCost) {
      waveCost.textContent = `Cost: ${upgradeInfo.waveForce.cost} Particles`;
    }
    if (waveButton) {
      waveButton.disabled = !upgradeInfo.waveForce.canAfford;
    }
    if (waveDesc) {
      waveDesc.textContent = `Empower the wave of force released on tap. Current: ${upgradeInfo.waveForce.effect}.`;
    }

    const tierLevel = document.getElementById('tsadi-upgrade-tier-level');
    const tierCost = document.getElementById('tsadi-upgrade-tier-cost');
    const tierButton = document.getElementById('tsadi-upgrade-tier-button');
    const tierDesc = document.getElementById('tsadi-upgrade-tier-description');

    if (tierLevel) {
      tierLevel.textContent = `Level ${upgradeInfo.startingTier.level}`;
    }
    if (tierCost) {
      tierCost.textContent = `Cost: ${upgradeInfo.startingTier.cost} Particles`;
    }
    if (tierButton) {
      tierButton.disabled = !upgradeInfo.startingTier.canAfford;
    }
    if (tierDesc) {
      tierDesc.textContent = `Increases the tier of particles spawned into the simulation. Current: ${upgradeInfo.startingTier.effect}.`;
    }
  }

  /**
   * Bind Tsadi upgrade button click handlers to the active simulation.
   * Keeps particle upgrades responsive and refreshes counts after successful purchases.
   *
   * @returns {void}
   */
  function bindTsadiUpgradeButtons() {
    const repellingButton = document.getElementById('tsadi-upgrade-repelling-button');
    const waveButton = document.getElementById('tsadi-upgrade-wave-button');
    const tierButton = document.getElementById('tsadi-upgrade-tier-button');

    if (repellingButton) {
      repellingButton.addEventListener('click', () => {
        const simulation = typeof getTsadiSimulation === 'function' ? getTsadiSimulation() : null;
        if (simulation && typeof simulation.purchaseRepellingForceReduction === 'function') {
          if (simulation.purchaseRepellingForceReduction()) {
            updateTsadiUpgradeUI();
            if (spireMenuController && typeof spireMenuController.updateCounts === 'function') {
              spireMenuController.updateCounts();
            }
          }
        }
      });
    }

    if (waveButton) {
      waveButton.addEventListener('click', () => {
        const simulation = typeof getTsadiSimulation === 'function' ? getTsadiSimulation() : null;
        if (simulation && typeof simulation.purchaseWaveForceUpgrade === 'function') {
          if (simulation.purchaseWaveForceUpgrade()) {
            updateTsadiUpgradeUI();
            if (spireMenuController && typeof spireMenuController.updateCounts === 'function') {
              spireMenuController.updateCounts();
            }
          }
        }
      });
    }

    if (tierButton) {
      tierButton.addEventListener('click', () => {
        const simulation = typeof getTsadiSimulation === 'function' ? getTsadiSimulation() : null;
        if (simulation && typeof simulation.purchaseStartingTierUpgrade === 'function') {
          if (simulation.purchaseStartingTierUpgrade()) {
            updateTsadiUpgradeUI();
            if (spireMenuController && typeof spireMenuController.updateCounts === 'function') {
              spireMenuController.updateCounts();
            }
          }
        }
      });
    }
  }

  return {
    bindTsadiUpgradeButtons,
    updateTsadiUpgradeUI,
  };
}
