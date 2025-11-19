export function createPowderDisplaySystem({
  powderState,
  powderConfig,
  powderGlyphColumns,
  formatWholeNumber,
  formatGameNumber,
  formatDecimal,
  formatPercentage,
  formatSignedPercentage,
  renderMathElement,
  getBaseStartThero,
  resourceState,
  baseResources,
  schedulePowderSave,
  recordPowderEvent,
  notifyPowderAction,
  notifyPowderMultiplier,
  notifyPowderSigils,
  updateStatusDisplays,
  getUnlockedAchievementCount,
  getAchievementPowderRate,
  getCurrentIdleMoteBank,
  getCurrentMoteDispenseRate,
  THERO_SYMBOL,
  bindFluidControls,
  updateFluidDisplay,
  updatePowderLogDisplay,
  updateMoteGemInventoryDisplay,
  FLUX_OVERVIEW_IS_STUB,
  SIGIL_LADDER_IS_STUB,
  getPowderSimulation,
  spireResourceState,
  addIdleMoteBank,
  getLamedSparkBank,
  setLamedSparkBank,
  getTsadiParticleBank,
  setTsadiParticleBank,
  getTsadiBindingAgents,
  setTsadiBindingAgents,
  addIterons,
  updateShinDisplay,
  evaluateAchievements,
  spireMenuController,
  gameStats,
  getCompletedInteractiveLevelCount,
  getIteronBank,
  getIterationRate,
  betHappinessSystem,
  onTsadiBindingAgentsChange,
}) {
  let powderCurrency = 0;
  let powderBasinPulseTimer = null;
  let currentPowderBonuses = {
    sandBonus: 0,
    duneBonus: 0,
    crystalBonus: 0,
    totalMultiplier: 1,
  };

  const powderElements = {
    sandfallFormula: null,
    sandfallNote: null,
    sandfallButton: null,
    duneFormula: null,
    duneNote: null,
    duneButton: null,
    crystalFormula: null,
    crystalNote: null,
    crystalButton: null,
    totalMultiplier: null,
    sandBonusValue: null,
    duneBonusValue: null,
    crystalBonusValue: null,
    stockpile: null,
    idleMultiplier: null,
    moteBank: null,
    moteRate: null,
    gemInventoryList: null,
    gemInventoryEmpty: null,
    craftingButton: null,
    ledgerBaseScore: null,
    ledgerCurrentScore: null,
    ledgerFlux: null,
    ledgerEnergy: null,
    sigilEntries: [],
    logList: null,
    logEmpty: null,
    simulationCanvas: null,
    simulationCard: null,
    basin: null,
    viewport: null,
    wallMarker: null,
    crestMarker: null,
    wallGlyphColumns: [],
    leftWall: null,
    rightWall: null,
    leftHitbox: null,
    rightHitbox: null,
    modeToggle: null,
    stage: null,
    altRenderToggle: null,
    altRender: null,
  };

  function setAltRenderVisibility(isVisible) {
    if (powderElements.altRender) {
      powderElements.altRender.hidden = !isVisible;
      powderElements.altRender.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
    }
    if (powderElements.altRenderToggle) {
      powderElements.altRenderToggle.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
      powderElements.altRenderToggle.textContent = isVisible ? 'Hide Bet Wall Render' : 'Show Bet Wall Render';
    }
  }

  function setPowderCurrency(value) {
    const normalized = Number.isFinite(value) ? Math.max(0, value) : 0;
    powderCurrency = normalized;
    updatePowderStockpileDisplay();
  }

  function getPowderCurrency() {
    return powderCurrency;
  }

  function getCurrentPowderBonuses() {
    return currentPowderBonuses;
  }

  function resetPowderUiState() {
    currentPowderBonuses = {
      sandBonus: 0,
      duneBonus: 0,
      crystalBonus: 0,
      totalMultiplier: 1,
    };
    if (powderBasinPulseTimer) {
      clearTimeout(powderBasinPulseTimer);
      powderBasinPulseTimer = null;
    }
    setAltRenderVisibility(false);
  }

  function calculatePowderBonuses() {
    const sandBonus = powderState.sandOffset > 0 ? 0.15 + powderState.sandOffset * 0.03 : 0;
    const effectiveDuneHeight = Math.max(1, powderState.duneHeight + powderState.simulatedDuneGain);
    const duneBonus = Math.log2(effectiveDuneHeight + 1) * 0.04;

    const baseCrystalProduct = powderConfig.thetaBase * powderConfig.zetaBase;
    const chargedTheta = powderConfig.thetaBase + powderState.charges * 0.6;
    const chargedZeta = powderConfig.zetaBase + powderState.charges * 0.5;
    const crystalGain = Math.max(0, Math.sqrt(chargedTheta * chargedZeta) - Math.sqrt(baseCrystalProduct));
    const crystalBonus = crystalGain * 0.05;

    const totalMultiplier = 1 + sandBonus + duneBonus + crystalBonus;

    return { sandBonus, duneBonus, crystalBonus, totalMultiplier };
  }

  function updateResourceRates() {
    currentPowderBonuses = calculatePowderBonuses();
    const totalMultiplier = Math.max(0, currentPowderBonuses.totalMultiplier || 1);
    resourceState.scoreRate = baseResources.scoreRate * totalMultiplier;
    resourceState.energyRate = baseResources.energyRate * totalMultiplier;
    resourceState.fluxRate = baseResources.fluxRate * totalMultiplier;
    updateStatusDisplays();
  }

  function updateMoteStatsDisplays() {
    if (powderElements.idleMultiplier) {
      const achievements = getUnlockedAchievementCount();
      const rate = getAchievementPowderRate();
      const achievementLabel = achievements === 1 ? 'achievement' : 'achievements';
      const rateLabel = rate === 1 ? 'Mote/min' : 'Motes/min';
      powderElements.idleMultiplier.textContent = `${formatWholeNumber(achievements)} ${achievementLabel} · +${formatGameNumber(
        rate,
      )} ${rateLabel}`;
    }

    if (powderElements.moteBank) {
      const bankedMotes = getCurrentIdleMoteBank();
      const moteLabel = bankedMotes === 1 ? 'Mote' : 'Motes';
      powderElements.moteBank.textContent = `${formatGameNumber(bankedMotes)} ${moteLabel}`;
    }

    if (powderElements.moteRate) {
      const dispenseRate = getCurrentMoteDispenseRate();
      const moteLabel = dispenseRate === 1 ? 'Mote/sec' : 'Motes/sec';
      powderElements.moteRate.textContent = `${formatDecimal(dispenseRate, 2)} ${moteLabel}`;
    }
  }

  function updatePowderStockpileDisplay() {
    if (powderElements.stockpile) {
      powderElements.stockpile.textContent = `${formatGameNumber(powderCurrency)} Mote Gems`;
    }
  }

  function updatePowderLedger() {
    if (powderElements.ledgerBaseScore) {
      powderElements.ledgerBaseScore.textContent = `${formatGameNumber(getBaseStartThero())} ${THERO_SYMBOL}`;
    }
    if (powderElements.ledgerCurrentScore) {
      powderElements.ledgerCurrentScore.textContent = `${formatGameNumber(resourceState.score)} ${THERO_SYMBOL}`;
    }
    if (powderElements.ledgerFlux) {
      powderElements.ledgerFlux.textContent = `${formatGameNumber(resourceState.fluxRate)} Flux/sec`;
    }
    if (powderElements.ledgerEnergy) {
      powderElements.ledgerEnergy.textContent = `${formatGameNumber(resourceState.energyRate)} Energy/sec`;
    }
  }

  function bindPowderControls() {
    powderElements.totalMultiplier = document.getElementById('powder-total-multiplier');
    powderElements.sandBonusValue = document.getElementById('powder-sand-bonus');
    powderElements.duneBonusValue = document.getElementById('powder-dune-bonus');
    powderElements.crystalBonusValue = document.getElementById('powder-crystal-bonus');
    powderElements.stockpile = document.getElementById('powder-stockpile');
    powderElements.moteBank = document.getElementById('powder-mote-bank');
    powderElements.moteRate = document.getElementById('powder-mote-rate');
    powderElements.idleMultiplier = document.getElementById('powder-idle-multiplier');
    powderElements.gemInventoryList = document.getElementById('powder-gem-inventory');
    powderElements.gemInventoryEmpty = document.getElementById('powder-gem-empty');
    powderElements.craftingButton = document.getElementById('powder-crafting-button');
    powderElements.ledgerBaseScore =
      document.getElementById('powder-ledger-base-score') || document.getElementById('powder-ledger-base');
    powderElements.ledgerCurrentScore =
      document.getElementById('powder-ledger-current-score') || document.getElementById('powder-ledger-score');
    powderElements.ledgerFlux = document.getElementById('powder-ledger-flux');
    powderElements.ledgerEnergy = document.getElementById('powder-ledger-energy');
    powderElements.logList = document.getElementById('powder-log');
    powderElements.logEmpty = document.getElementById('powder-log-empty');
    powderElements.simulationCanvas = document.getElementById('powder-canvas');
    powderElements.simulationCard = document.getElementById('powder-simulation-card');
    powderElements.stage = document.getElementById('powder-stage');
    powderElements.basin = document.getElementById('powder-basin');
    powderElements.viewport = document.getElementById('powder-viewport');
    powderElements.wallMarker = document.getElementById('powder-wall-marker');
    powderElements.crestMarker = document.getElementById('powder-crest-marker');
    powderElements.leftWall = document.getElementById('powder-wall-left');
    powderElements.rightWall = document.getElementById('powder-wall-right');
    powderElements.leftHitbox = document.getElementById('powder-wall-hitbox-left');
    powderElements.rightHitbox = document.getElementById('powder-wall-hitbox-right');
    powderElements.sandfallFormula = document.getElementById('powder-sandfall-formula');
    powderElements.sandfallNote = document.getElementById('powder-sandfall-note');
    powderElements.sandfallButton = document.getElementById('powder-sandfall-button');
    powderElements.duneFormula = document.getElementById('powder-dune-formula');
    powderElements.duneNote = document.getElementById('powder-dune-note');
    powderElements.duneButton = document.getElementById('powder-dune-button');
    powderElements.crystalFormula = document.getElementById('powder-crystal-formula');
    powderElements.crystalNote = document.getElementById('powder-crystal-note');
    powderElements.crystalButton = document.getElementById('powder-crystal-button');
    powderElements.altRenderToggle = document.getElementById('powder-alt-render-toggle');
    powderElements.altRender = document.getElementById('powder-alt-render');

    const glyphColumnNodes = document.querySelectorAll('[data-powder-glyph-column]');
    powderElements.wallGlyphColumns = Array.from(glyphColumnNodes);
    powderGlyphColumns.length = 0;
    powderElements.wallGlyphColumns.forEach((element) => {
      powderGlyphColumns.push({ element, glyphs: new Map() });
    });

    const sigilList = document.getElementById('powder-sigil-list');
    powderElements.sigilEntries = sigilList ? Array.from(sigilList.querySelectorAll('li')) : [];

    if (powderElements.sandfallButton) {
      powderElements.sandfallButton.addEventListener('click', (event) => {
        event.preventDefault();
        toggleSandfallStability();
      });
    }

    if (powderElements.duneButton) {
      powderElements.duneButton.addEventListener('click', (event) => {
        event.preventDefault();
        surveyRidgeHeight();
      });
    }

    if (powderElements.crystalButton) {
      powderElements.crystalButton.addEventListener('click', (event) => {
        event.preventDefault();
        chargeCrystalMatrix();
      });
    }

    if (powderElements.altRender && powderElements.altRenderToggle) {
      powderElements.altRender.setAttribute('aria-hidden', 'true');
      setAltRenderVisibility(false);
      powderElements.altRenderToggle.addEventListener('click', (event) => {
        event.preventDefault();
        const shouldShow = Boolean(powderElements.altRender.hidden);
        setAltRenderVisibility(shouldShow);
      });
    }

    bindFluidControls();
    updateFluidDisplay();

    updateMoteGemInventoryDisplay();
    updatePowderLogDisplay();
    updatePowderLedger();
    updatePowderDisplay();
    updateMoteStatsDisplays();
  }

  function triggerPowderBasinPulse() {
    if (!powderElements.basin) {
      return;
    }
    powderElements.basin.classList.remove('powder-basin--pulse');
    if (powderBasinPulseTimer) {
      clearTimeout(powderBasinPulseTimer);
    }
    requestAnimationFrame(() => {
      if (!powderElements.basin) {
        return;
      }
      powderElements.basin.classList.add('powder-basin--pulse');
      powderBasinPulseTimer = setTimeout(() => {
        if (powderElements.basin) {
          powderElements.basin.classList.remove('powder-basin--pulse');
        }
        powderBasinPulseTimer = null;
      }, 900);
    });
  }

  function applyPowderGain(amount, context = {}) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0;
    }

    const { source = 'tick', minutes = 0, rate = 0, idleSummary = null, powder = amount } = context;
    powderCurrency = Math.max(0, powderCurrency + amount);
    updatePowderStockpileDisplay();
    schedulePowderSave();

    if (source === 'offline') {
      recordPowderEvent('offline-reward', { minutes, rate, powder, idleSummary });
      triggerPowderBasinPulse();
    }

    return amount;
  }

  function toggleSandfallStability() {
    powderState.sandOffset =
      powderState.sandOffset > 0 ? powderConfig.sandOffsetInactive : powderConfig.sandOffsetActive;

    const powderSimulation = getPowderSimulation();
    if (powderSimulation) {
      powderSimulation.setFlowOffset(powderState.sandOffset);
    }

    refreshPowderSystems();
    recordPowderEvent(powderState.sandOffset > 0 ? 'sand-stabilized' : 'sand-released');
    notifyPowderAction();
  }

  function surveyRidgeHeight() {
    if (powderState.duneHeight >= powderConfig.duneHeightMax) {
      recordPowderEvent('dune-max');
      return;
    }

    powderState.duneHeight += 1;
    refreshPowderSystems();
    recordPowderEvent('dune-raise', { height: powderState.duneHeight });
    notifyPowderAction();
  }

  function releaseCrystalPulse(charges) {
    const chargedTheta = powderConfig.thetaBase + charges * 0.6;
    const chargedZeta = powderConfig.zetaBase + charges * 0.5;
    const resonance = Math.sqrt(chargedTheta * chargedZeta);
    const pulseBonus = resonance * 0.008;

    resourceState.score += resourceState.score * pulseBonus;
    updateStatusDisplays();

    return pulseBonus;
  }

  function chargeCrystalMatrix() {
    if (powderState.charges < 3) {
      powderState.charges += 1;
      refreshPowderSystems();
      recordPowderEvent('crystal-charge', { charges: powderState.charges });
      notifyPowderAction();
      return;
    }

    const pulseBonus = releaseCrystalPulse(powderState.charges);
    powderState.charges = 0;
    refreshPowderSystems(pulseBonus);
    recordPowderEvent('crystal-release', { pulseBonus });
    notifyPowderAction();
  }

  function refreshPowderSystems(pulseBonus) {
    updateResourceRates();
    updatePowderDisplay(pulseBonus);
    updateMoteStatsDisplays();
  }

  function updatePowderDisplay(pulseBonus) {
    const totalMultiplier = currentPowderBonuses.totalMultiplier;
    notifyPowderMultiplier(totalMultiplier);

    if (FLUX_OVERVIEW_IS_STUB) {
      if (powderElements.totalMultiplier) {
        powderElements.totalMultiplier.textContent = '×—.—';
      }
      if (powderElements.sandBonusValue) {
        powderElements.sandBonusValue.textContent = '—%';
      }
      if (powderElements.duneBonusValue) {
        powderElements.duneBonusValue.textContent = '—%';
      }
      if (powderElements.crystalBonusValue) {
        powderElements.crystalBonusValue.textContent = '—%';
      }
    } else {
      if (powderElements.totalMultiplier) {
        powderElements.totalMultiplier.textContent = `×${formatDecimal(totalMultiplier, 2)}`;
      }

      if (powderElements.sandBonusValue) {
        powderElements.sandBonusValue.textContent = formatSignedPercentage(currentPowderBonuses.sandBonus);
      }

      if (powderElements.duneBonusValue) {
        powderElements.duneBonusValue.textContent = formatSignedPercentage(currentPowderBonuses.duneBonus);
      }

      if (powderElements.crystalBonusValue) {
        powderElements.crystalBonusValue.textContent = formatSignedPercentage(currentPowderBonuses.crystalBonus);
      }
    }

    if (SIGIL_LADDER_IS_STUB) {
      if (powderElements.sigilEntries && powderElements.sigilEntries.length) {
        powderElements.sigilEntries.forEach((sigil) => {
          sigil.classList.remove('sigil-reached');
        });
      }
      notifyPowderSigils(0);
    } else if (powderElements.sigilEntries && powderElements.sigilEntries.length) {
      let reached = 0;
      powderElements.sigilEntries.forEach((sigil) => {
        const threshold = Number.parseFloat(sigil.dataset.sigilThreshold);
        if (!Number.isFinite(threshold)) {
          return;
        }
        if (totalMultiplier >= threshold) {
          sigil.classList.add('sigil-reached');
          reached += 1;
        } else {
          sigil.classList.remove('sigil-reached');
        }
      });
      notifyPowderSigils(reached);
    } else {
      notifyPowderSigils(0);
    }

    updatePowderLedger();

    if (powderElements.sandfallFormula) {
      const offset = powderState.sandOffset;
      powderElements.sandfallFormula.textContent =
        offset > 0 ? `\\( \\Psi(g) = 2.7\\, \\sin(t) + ${formatDecimal(offset, 1)} \\)` : '\\( \\Psi(g) = 2.7\\, \\sin(t) \\)';
      renderMathElement(powderElements.sandfallFormula);
    }

    if (powderElements.sandfallNote) {
      const bonusText = formatPercentage(currentPowderBonuses.sandBonus);
      powderElements.sandfallNote.textContent =
        powderState.sandOffset > 0
          ? `Flow stabilized—captured grains grant +${bonusText} Mote Gems.`
          : 'Crest is unstable—Mote Gems drift off the board.';
    }

    if (powderElements.sandfallButton) {
      powderElements.sandfallButton.textContent = powderState.sandOffset > 0 ? 'Release Flow' : 'Stabilize Flow';
    }

    if (powderElements.duneFormula) {
      const height = Math.max(1, powderState.duneHeight + powderState.simulatedDuneGain);
      const logValue = Math.log2(height + 1);
      powderElements.duneFormula.textContent = `\\( \\Delta m = \\log_{2}(${formatDecimal(height, 2)} + 1) = ${formatDecimal(
        logValue,
        2,
      )} \\)`;
      renderMathElement(powderElements.duneFormula);
    }

    if (powderElements.duneNote) {
      const crestHeight = Math.max(1, powderState.duneHeight + powderState.simulatedDuneGain);
      powderElements.duneNote.textContent = `Channel bonus: +${formatPercentage(
        currentPowderBonuses.duneBonus,
      )} to energy gain · crest h = ${formatDecimal(crestHeight, 2)}.`;
    }

    if (powderElements.duneButton) {
      const reachedMax = powderState.duneHeight >= powderConfig.duneHeightMax;
      powderElements.duneButton.disabled = reachedMax;
      powderElements.duneButton.textContent = reachedMax ? 'Ridge Surveyed' : 'Survey Ridge';
    }

    if (powderElements.crystalFormula) {
      const charges = powderState.charges;
      const theta = powderConfig.thetaBase + charges * 0.6;
      const zeta = powderConfig.zetaBase + charges * 0.5;
      const root = Math.sqrt(theta * zeta);
      powderElements.crystalFormula.textContent = `\\( Q = \\sqrt{${formatDecimal(theta, 2)} \\cdot ${formatDecimal(
        zeta,
        2,
      )}} = ${formatDecimal(root, 2)} \\)`;
      renderMathElement(powderElements.crystalFormula);
    }

    if (powderElements.crystalButton) {
      powderElements.crystalButton.textContent = powderState.charges < 3 ? `Crystallize (${powderState.charges}/3)` : 'Release Pulse';
    }

    if (powderElements.crystalNote) {
      if (typeof pulseBonus === 'number') {
        powderElements.crystalNote.textContent = `Pulse released! Σ score surged by +${formatPercentage(pulseBonus)}.`;
      } else if (powderState.charges >= 3) {
        powderElements.crystalNote.textContent = 'Pulse ready—channel the matrix to unleash stored Σ energy.';
      } else if (currentPowderBonuses.crystalBonus <= 0) {
        powderElements.crystalNote.textContent = 'Crystal resonance is idle—no pulse prepared.';
      } else {
        powderElements.crystalNote.textContent = `Stored resonance grants +${formatPercentage(
          currentPowderBonuses.crystalBonus,
        )} to all rates.`;
      }
    }

    updatePowderStockpileDisplay();
  }

  function createIdleSummaryDefaults() {
    return {
      minutes: 0,
      aleph: { multiplier: 0, total: 0, unlocked: true },
      bet: { multiplier: 0, total: 0, unlocked: Boolean(powderState.fluidUnlocked) },
      happiness: { multiplier: 0, total: 0, unlocked: Boolean(powderState.fluidUnlocked) },
      lamed: { multiplier: 0, total: 0, unlocked: Boolean(spireResourceState.lamed?.unlocked) },
      tsadi: { multiplier: 0, total: 0, unlocked: Boolean(spireResourceState.tsadi?.unlocked) },
      bindingAgents: { multiplier: 0, total: 0, unlocked: Boolean(spireResourceState.tsadi?.unlocked) },
      shin: { multiplier: 0, total: 0, unlocked: false },
      kuf: { multiplier: 0, total: 0, unlocked: false },
    };
  }

  function calculateIdleSpireSummary(elapsedMs) {
    const summary = createIdleSummaryDefaults();
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
      return summary;
    }

    const minutes = Math.max(0, elapsedMs / 60000);
    const seconds = Math.max(0, elapsedMs / 1000);
    const achievementsUnlocked = Math.max(0, Math.floor(getUnlockedAchievementCount()));
    const levelsBeat = Math.max(0, Math.floor(getCompletedInteractiveLevelCount()));

    const alephTotal = minutes * achievementsUnlocked;
    const betUnlocked = Boolean(powderState.fluidUnlocked);
    const betTotal = betUnlocked ? minutes * levelsBeat : 0;

    const happinessUnlocked = betUnlocked;
    const happinessRatePerHour = betHappinessSystem ? betHappinessSystem.getTotalRatePerHour() : 0;
    const happinessRatePerMinute = happinessRatePerHour / 60;
    const happinessTotal = happinessUnlocked ? minutes * happinessRatePerMinute : 0;

    const lamedUnlocked = Boolean(spireResourceState.lamed?.unlocked);
    const lamedRate = 1.0;
    const lamedTotal = lamedUnlocked ? seconds * lamedRate : 0;

    const tsadiUnlocked = Boolean(spireResourceState.tsadi?.unlocked);
    const discoveredMoleculeCount = Array.isArray(spireResourceState.tsadi?.discoveredMolecules)
      ? spireResourceState.tsadi.discoveredMolecules.length
      : 0;
    const tsadiIdleBonusPerSecond = discoveredMoleculeCount / 3600; // +1 particle/hour per molecule
    const tsadiRate = 2.0 + tsadiIdleBonusPerSecond;
    const tsadiTotal = tsadiUnlocked ? seconds * tsadiRate : 0;

    // Binding agents accrue slowly over idle time to emphasize their value as a crafting reagent.
    const bindingAgentUnlocked = tsadiUnlocked;
    const bindingAgentRatePerMinute = 1 / 60; // 1 per hour
    const bindingAgentTotal = bindingAgentUnlocked ? minutes * bindingAgentRatePerMinute : 0;

    // Respect the Shin unlock flag so idle summaries hide the branch until players reach it.
    const shinUnlocked = Boolean(spireResourceState.shin?.unlocked);
    const shinRate = shinUnlocked && typeof getIterationRate === 'function' ? getIterationRate() : 0;
    const shinTotal = shinUnlocked ? seconds * shinRate : 0;

    // Mirror the live Kuf unlock flag so the idle summary hides the panel until the spire is available.
    const kufUnlocked = Boolean(spireResourceState.kuf?.unlocked);
    const kufTotal = 0;

    summary.minutes = minutes;
    summary.aleph = {
      multiplier: achievementsUnlocked,
      total: alephTotal,
      unlocked: true,
    };
    summary.bet = {
      multiplier: betUnlocked ? levelsBeat : 0,
      total: betTotal,
      unlocked: betUnlocked,
    };
    summary.happiness = {
      multiplier: happinessUnlocked ? happinessRatePerMinute : 0,
      total: happinessTotal,
      unlocked: happinessUnlocked,
    };
    summary.lamed = {
      multiplier: lamedUnlocked ? lamedRate * 60 : 0,
      total: lamedTotal,
      unlocked: lamedUnlocked,
    };
    summary.tsadi = {
      multiplier: tsadiUnlocked ? tsadiRate * 60 : 0,
      total: tsadiTotal,
      unlocked: tsadiUnlocked,
    };
    summary.bindingAgents = {
      multiplier: bindingAgentUnlocked ? bindingAgentRatePerMinute : 0,
      total: bindingAgentTotal,
      unlocked: bindingAgentUnlocked,
    };
    summary.shin = {
      multiplier: shinUnlocked ? shinRate * 60 : 0,
      total: shinTotal,
      unlocked: shinUnlocked,
    };
    summary.kuf = {
      multiplier: 0,
      total: kufTotal,
      unlocked: kufUnlocked,
    };

    return summary;
  }

  function notifyIdleTime(elapsedMs) {
    const normalizedElapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
    const summary = calculateIdleSpireSummary(normalizedElapsed);
    if (normalizedElapsed <= 0 || summary.minutes <= 0) {
      return summary;
    }

    gameStats.idleMillisecondsAccumulated += normalizedElapsed;

    if (summary.aleph.total > 0) {
      addIdleMoteBank(summary.aleph.total, { target: 'aleph' });
    }
    if (summary.bet.unlocked && summary.bet.total > 0) {
      addIdleMoteBank(summary.bet.total, { target: 'bet' });
    }
    if (summary.lamed.unlocked && summary.lamed.total > 0) {
      setLamedSparkBank(getLamedSparkBank() + summary.lamed.total);
    }
    if (summary.tsadi.unlocked && summary.tsadi.total > 0) {
      setTsadiParticleBank(getTsadiParticleBank() + summary.tsadi.total);
    }
    if (summary.bindingAgents.unlocked && summary.bindingAgents.total > 0) {
      const updatedBindingAgents = setTsadiBindingAgents(
        getTsadiBindingAgents() + summary.bindingAgents.total,
      );
      if (typeof onTsadiBindingAgentsChange === 'function') {
        onTsadiBindingAgentsChange(updatedBindingAgents);
      }
    }
    if (summary.shin.unlocked && summary.shin.total > 0 && typeof addIterons === 'function') {
      addIterons(summary.shin.total);
    }
    if (summary.happiness?.unlocked && summary.happiness.total > 0 && betHappinessSystem) {
      betHappinessSystem.addHappiness(summary.happiness.total);
      betHappinessSystem.updateDisplay();
      schedulePowderSave();
    }

    evaluateAchievements();

    return summary;
  }

  function grantSpireMinuteIncome(spireId) {
    const summary = calculateIdleSpireSummary(60000);
    if (summary.minutes <= 0) {
      return;
    }

    let resourcesGranted = false;

    switch (spireId) {
      case 'aleph': {
        if (summary.aleph.total > 0) {
          addIdleMoteBank(summary.aleph.total, { target: 'aleph' });
          resourcesGranted = true;
        }
        break;
      }
      case 'bet': {
        if (summary.bet.unlocked && summary.bet.total > 0) {
          addIdleMoteBank(summary.bet.total, { target: 'bet' });
          resourcesGranted = true;
        }
        break;
      }
      case 'lamed': {
        if (summary.lamed.unlocked && summary.lamed.total > 0) {
          setLamedSparkBank(getLamedSparkBank() + summary.lamed.total);
          resourcesGranted = true;
        }
        break;
      }
      case 'tsadi': {
        if (summary.tsadi.unlocked && summary.tsadi.total > 0) {
          setTsadiParticleBank(getTsadiParticleBank() + summary.tsadi.total);
          resourcesGranted = true;
        }
        if (summary.bindingAgents.unlocked && summary.bindingAgents.total > 0) {
          const updatedBindingAgents = setTsadiBindingAgents(
            getTsadiBindingAgents() + summary.bindingAgents.total,
          );
          if (typeof onTsadiBindingAgentsChange === 'function') {
            onTsadiBindingAgentsChange(updatedBindingAgents);
          }
          resourcesGranted = true;
        }
        break;
      }
      case 'shin': {
        if (summary.shin.unlocked && summary.shin.total > 0) {
          addIterons(summary.shin.total);
          updateShinDisplay();
          resourcesGranted = true;
        }
        break;
      }
      case 'kuf':
      default:
        break;
    }

    if (resourcesGranted) {
      evaluateAchievements();
      spireMenuController.updateCounts();
    }
  }

  function bindSpireClickIncome() {
    const clickTargets = [
      { elementId: 'powder-simulation-card', spireId: 'aleph' },
      { elementId: 'fluid-simulation-card', spireId: 'bet' },
      { elementId: 'lamed-simulation-card', spireId: 'lamed' },
      { elementId: 'tsadi-simulation-card', spireId: 'tsadi' },
      { elementId: 'shin-fractal-content', spireId: 'shin' },
      { elementId: 'kuf-simulation-card', spireId: 'kuf' },
    ];

    clickTargets.forEach(({ elementId, spireId }) => {
      const element = document.getElementById(elementId);
      if (!element) {
        return;
      }
      element.addEventListener('click', (event) => {
        if (event.defaultPrevented) {
          return;
        }
        if (typeof event.button === 'number' && event.button !== 0) {
          return;
        }
        const interactiveTarget =
          event.target instanceof HTMLElement
            ? event.target.closest('button, a, input, select, textarea')
            : null;
        if (interactiveTarget) {
          return;
        }
        grantSpireMinuteIncome(spireId);
      });
    });
  }

  return {
    powderElements,
    bindPowderControls,
    updateResourceRates,
    updateMoteStatsDisplays,
    updatePowderStockpileDisplay,
    updatePowderLedger,
    triggerPowderBasinPulse,
    applyPowderGain,
    toggleSandfallStability,
    surveyRidgeHeight,
    chargeCrystalMatrix,
    refreshPowderSystems,
    updatePowderDisplay,
    notifyIdleTime,
    grantSpireMinuteIncome,
    bindSpireClickIncome,
    calculateIdleSpireSummary,
    getPowderCurrency,
    setPowderCurrency,
    getCurrentPowderBonuses,
    resetPowderUiState,
  };
}
