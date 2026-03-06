// Level reset system extracted from SimplePlayfield for modular level initialization and checkpoint restore logic.
// Handles resetting state for a new level run, loading crystals, repositioning towers, and checkpoint restoration.

import { createCombatStateManager } from '../managers/CombatStateManager.js';
import { createTowerOrchestrationController } from '../controllers/TowerOrchestrationController.js';
import * as TowerManager from '../managers/TowerManager.js';
import {
  getTowerDefinition,
  refreshTowerLoadoutDisplay,
} from '../../towersTab.js';
import {
  getKappaPreviewParameters as getKappaPreviewParametersHelper,
} from '../../../scripts/features/towers/kappaTower.js';
import {
  absorbSigmaDamage as absorbSigmaDamageHelper,
} from '../../../scripts/features/towers/sigmaTower.js';
import { ETA_MAX_PRESTIGE_MERGES } from '../../../scripts/features/towers/etaTower.js';

export function resetState() {
  if (!this.levelConfig) {
    // When no level is loaded, reset to null state
    if (this.combatStateManager) {
      this.combatStateManager.reset();
    }
    this.gateDefense = 0;
  } else {
    // Initialize manager if it doesn't exist
    if (!this.combatStateManager) {
      this.combatStateManager = createCombatStateManager({
        levelConfig: this.levelConfig,
        audio: this.audio,
        onVictory: () => this.handleVictory(),
        onDefeat: this.onDefeat,
        onCombatStart: this.onCombatStart,
        recordKillEvent: (towerId) => this.recordKillEvent(towerId),
        tryConvertEnemyToChiThrall: (enemy, context) => this.tryConvertEnemyToChiThrall(enemy, context),
        triggerPsiClusterAoE: (enemy) => this.triggerPsiClusterAoE(enemy),
        notifyEnemyDeath: (enemy) => this.notifyEnemyDeath(enemy),
      });
    } else {
      this.combatStateManager.reset();
    }
    // Initialize tower orchestration controller if it doesn't exist
    if (!this.towerOrchestrationController) {
      this.towerOrchestrationController = createTowerOrchestrationController({
        playfield: this,
        combatState: this.combatStateManager,
        towerManager: TowerManager,
        audio: this.audio,
        messageEl: this.messageEl,
        dependencies: this.dependencies,
        theroSymbol: this.theroSymbol,
      });
    }
    // Normalize any gate defense value supplied by the level configuration.
    const configuredDefense = Number.isFinite(this.levelConfig.gateDefense)
      ? this.levelConfig.gateDefense
      : Number.isFinite(this.levelConfig.coreDefense)
      ? this.levelConfig.coreDefense
      : 0;
    this.gateDefense = Math.max(0, configuredDefense);
  }
  this.towerIdCounter = 0;
  this.arcOffset = 0;
  this.resetChiSystems();
  this.projectiles = [];
  this.resetDamageNumbers();
  this.resetEnemyDeathParticles();
  this.resetWaveTallies();
  this.alphaBursts = [];
  this.betaBursts = [];
  this.gammaBursts = [];
    this.gammaStarBursts = [];
  this.nuBursts = [];
  this.swarmClouds = [];
  this.floaters = [];
  this.floaterConnections = [];
  // Reset ambient swimmers whenever the battlefield is rebuilt for a new run.
  this.backgroundSwimmers = [];
  this.swimmerBounds = { width: this.renderWidth || 0, height: this.renderHeight || 0 };
  this.floaterBounds = { width: this.renderWidth || 0, height: this.renderHeight || 0 };
  if (this.towerGlyphTransitions) {
    this.towerGlyphTransitions.clear();
  }
  this.towers = [];
  this.infinityTowers = [];
  this.towerConnectionMap.clear();
  this.towerConnectionSources.clear();
  this.connectionEffects = [];
  this.clearConnectionDragState();
  this.hoverPlacement = null;
  this.clearFocusedEnemy({ silent: true });
  this.slots.forEach((slot) => {
    slot.tower = null;
    if (slot.button) {
      slot.button.classList.remove('tower-built');
      slot.button.setAttribute('aria-pressed', 'false');
    }
  });
  this.updateTowerPositions();
  this.updateHud();
  this.updateProgress();
  if (this.startButton) {
    this.startButton.disabled = !this.levelConfig;
  }
  this.updateAutoAnchorButton();
  this.updateSpeedButton();
  this.scheduleStatsPanelRefresh();
  this.refreshStatsPanel({ force: true });
  refreshTowerLoadoutDisplay();
}

export function loadLevelCrystals() {
  // Clear any existing developer crystals
  if (typeof this.clearDeveloperCrystals === 'function') {
    this.clearDeveloperCrystals({ silent: true });
  }

  // Load crystals from level config if present
  if (!this.levelConfig || !Array.isArray(this.levelConfig.crystals)) {
    return;
  }

  this.levelConfig.crystals.forEach((crystalConfig) => {
    if (!crystalConfig || typeof crystalConfig.x !== 'number' || typeof crystalConfig.y !== 'number') {
      return;
    }

    const normalized = { x: crystalConfig.x, y: crystalConfig.y };
    const options = {
      integrity: crystalConfig.integrity,
      thero: crystalConfig.thero || 0,
      theroMultiplier: crystalConfig.theroMultiplier || 0,
    };

    if (typeof this.addDeveloperCrystal === 'function') {
      this.addDeveloperCrystal(normalized, options);
    }
  });
}

export function updateTowerPositions() {
  if (!this.levelConfig) {
    return;
  }
  this.towers.forEach((tower) => {
    const { x, y } = this.getCanvasPosition(tower.normalized);
    tower.x = x;
    tower.y = y;
    const definition = getTowerDefinition(tower.type) || tower.definition;
    if (tower.type === 'alpha') {
      this.ensureAlphaState(tower);
    }
    if (tower.type === 'beta') {
      this.ensureBetaState(tower);
    }
    if (tower.type === 'gamma') {
      this.ensureGammaState(tower);
    }
    if (tower.type === 'kappa') {
      this.ensureKappaState(tower);
    }
    if (tower.type === 'iota') {
      this.ensureIotaState(tower);
    }
    if (tower.type === 'chi') {
      this.ensureChiState(tower);
    }
    if (tower.type === 'omega') {
      this.ensureOmegaState(tower);
    }
    if (tower.type === 'zeta') {
      // Keep ζ pendulum geometry aligned with the tower's new coordinates.
      this.ensureZetaState(tower);
    } else if (tower.type === 'xi') {
      // Initialize ξ chaining mechanics.
      this.ensureXiState(tower);
    } else if (tower.type === 'omicron') {
      // Initialize ο soldier unit mechanics.
      this.ensureOmicronState(tower);
    } else {
      const rangeFactor = definition ? definition.range : 0.24;
      if (tower.type !== 'iota' && tower.type !== 'kappa') {
        tower.range = Math.min(this.renderWidth, this.renderHeight) * rangeFactor;
      }
      if (tower.type === 'delta') {
        this.updateDeltaAnchors(tower);
      }
      if (tower.type === 'theta') {
        this.ensureThetaState(tower);
      }
    }
  });
  if (this.hoverPlacement) {
    this.hoverPlacement.position = this.getCanvasPosition(this.hoverPlacement.normalized);
    const definition = getTowerDefinition(this.hoverPlacement.towerType);
    if (this.hoverPlacement.towerType === 'zeta') {
      // Simulate ζ's metrics so the placement preview reflects pendulum reach.
      const baseRangeFactor = definition ? definition.range : 0.3;
      const baseRange = Math.min(this.renderWidth, this.renderHeight) * baseRangeFactor;
      const previewTower = {
        id: 'zeta-preview',
        type: 'zeta',
        definition: definition || null,
        normalized: { ...this.hoverPlacement.normalized },
        x: this.hoverPlacement.position.x,
        y: this.hoverPlacement.position.y,
        range: baseRange,
        baseRange,
        baseDamage: 0,
        baseRate: 0,
      };
      this.ensureZetaState(previewTower);
      this.hoverPlacement.range = Number.isFinite(previewTower.range)
        ? previewTower.range
        : baseRange;
    } else if (this.hoverPlacement.towerType === 'kappa') {
      const kappaPreview = getKappaPreviewParametersHelper(this);
      const rangeFactor = definition ? definition.range : 0.24;
      const fallbackRange = Math.min(this.renderWidth, this.renderHeight) * rangeFactor;
      this.hoverPlacement.range = kappaPreview?.rangePixels || fallbackRange;
    } else {
      const rangeFactor = definition ? definition.range : 0.24;
      this.hoverPlacement.range = Math.min(this.renderWidth, this.renderHeight) * rangeFactor;
    }
    this.hoverPlacement.connections = this.computePlacementConnections(
      this.hoverPlacement.position,
      {
        towerType: this.hoverPlacement.towerType,
        range: this.hoverPlacement.range,
        mergeTarget: this.hoverPlacement.mergeTarget,
      },
    );
  }
}

// Rebuild tower placements and behavior from a stored checkpoint snapshot.
export function restoreTowersFromCheckpoint(towerSnapshots = []) {
  const snapshots = Array.isArray(towerSnapshots) ? towerSnapshots : [];
  this.towers.forEach((tower) => {
    this.teardownDeltaTower(tower);
    this.handleInfinityTowerRemoved(tower);
  });
  this.towers = [];
  this.infinityTowers = [];
  this.towerConnectionMap.clear();
  this.towerConnectionSources.clear();
  this.connectionEffects = [];
  this.clearConnectionDragState();
  this.slots.forEach((slot) => {
    slot.tower = null;
    if (slot.button) {
      slot.button.classList.remove('tower-built');
      slot.button.setAttribute('aria-pressed', 'false');
    }
  });
  this.towerIdCounter = 0;

  const restoredTowerMap = new Map();

  snapshots.forEach((snapshot) => {
    if (!snapshot || !snapshot.type) {
      return;
    }
    const definition = getTowerDefinition(snapshot.type);
    if (!definition) {
      return;
    }
    const normalized = this.cloneNormalizedPoint(snapshot.normalized || {});
    const position = this.getCanvasPosition(normalized);
    const fallbackDamage = Number.isFinite(definition.damage) ? definition.damage : 0;
    const fallbackRate = Number.isFinite(definition.rate) ? definition.rate : 1;
    const fallbackRange = Math.min(this.renderWidth, this.renderHeight) * (definition.range ?? 0.24);
    let towerId = typeof snapshot.id === 'string' && snapshot.id.trim() ? snapshot.id.trim() : null;
    if (towerId) {
      const match = towerId.match(/tower-(\d+)/);
      if (match) {
        const numeric = Number(match[1]);
        if (Number.isFinite(numeric)) {
          this.towerIdCounter = Math.max(this.towerIdCounter, numeric);
        }
      }
    } else {
      this.towerIdCounter += 1;
      towerId = `tower-${this.towerIdCounter}`;
    }
    const tower = {
      id: towerId,
      type: snapshot.type,
      definition,
      symbol: definition.symbol,
      tier: definition.tier,
      normalized,
      x: position.x,
      y: position.y,
      baseDamage: Number.isFinite(snapshot.baseDamage) ? snapshot.baseDamage : fallbackDamage,
      baseRate: Number.isFinite(snapshot.baseRate) ? snapshot.baseRate : fallbackRate,
      baseRange: Number.isFinite(snapshot.baseRange) ? snapshot.baseRange : fallbackRange,
      damage: Number.isFinite(snapshot.damage) ? snapshot.damage : fallbackDamage,
      rate: Number.isFinite(snapshot.rate) ? snapshot.rate : fallbackRate,
      range: Number.isFinite(snapshot.range) ? snapshot.range : fallbackRange,
      cooldown: Number.isFinite(snapshot.cooldown) ? snapshot.cooldown : 0,
      slot: null,
    };
    tower.linkTargetId = null;
    tower.linkSources = new Set();
    tower.storedAlphaShots = 0;
    tower.storedBetaShots = 0;
    tower.storedAlphaSwirl = 0;
    tower.storedBetaSwirl = 0;
    tower.storedGammaShots = 0;
    tower.connectionParticles = [];
    if (Number.isFinite(snapshot.storedAlphaShots)) {
      tower.storedAlphaShots = Math.max(0, Math.floor(snapshot.storedAlphaShots));
    }
    if (Number.isFinite(snapshot.storedBetaShots)) {
      tower.storedBetaShots = Math.max(0, Math.floor(snapshot.storedBetaShots));
    }
    if (Number.isFinite(snapshot.storedAlphaSwirl)) {
      tower.storedAlphaSwirl = Math.max(0, Math.floor(snapshot.storedAlphaSwirl));
    }
    if (Number.isFinite(snapshot.storedBetaSwirl)) {
      tower.storedBetaSwirl = Math.max(0, Math.floor(snapshot.storedBetaSwirl));
    }
    if (Number.isFinite(snapshot.storedGammaShots)) {
      tower.storedGammaShots = Math.max(0, Math.floor(snapshot.storedGammaShots));
    }
    if (tower.type === 'eta') {
      // Restore η lattice metadata before behavior defaults so orbital rings rebuild with the correct configuration.
      const rawPrime = Number.isFinite(snapshot.etaPrime) ? snapshot.etaPrime : 0;
      tower.etaPrime = Math.max(0, Math.min(rawPrime, ETA_MAX_PRESTIGE_MERGES));
      tower.isPrestigeEta = snapshot.isPrestigeEta ? true : tower.etaPrime >= ETA_MAX_PRESTIGE_MERGES;
    }
    if (tower.type === 'sigma') {
      const sigmaState = this.ensureSigmaState(tower);
      if (sigmaState) {
        sigmaState.storedDamage = 0;
        sigmaState.totalAbsorbed = 0;
        const restoredDamage = Number.isFinite(snapshot.sigmaStoredDamage)
          ? Math.max(0, snapshot.sigmaStoredDamage)
          : 0;
        if (restoredDamage > 0) {
          absorbSigmaDamageHelper(this, tower, restoredDamage);
        }
        if (Number.isFinite(snapshot.sigmaTotalAbsorbed)) {
          sigmaState.totalAbsorbed = Math.max(
            sigmaState.totalAbsorbed,
            Math.max(0, snapshot.sigmaTotalAbsorbed),
          );
        }
        tower.damage = sigmaState.storedDamage;
        tower.baseDamage = sigmaState.storedDamage;
      }
    }
    if (snapshot.slotId && this.slots.has(snapshot.slotId)) {
      const slot = this.slots.get(snapshot.slotId);
      tower.slot = slot;
      slot.tower = tower;
      if (slot.button) {
        slot.button.classList.add('tower-built');
        slot.button.setAttribute('aria-pressed', 'true');
      }
    }
    tower.targetPriority = snapshot.targetPriority || 'first';
    tower.behaviorMode = snapshot.behaviorMode || tower.behaviorMode;
    this.applyTowerBehaviorDefaults(tower);
    if (snapshot.behaviorMode && tower.type === 'delta') {
      this.configureDeltaBehavior(tower, snapshot.behaviorMode);
    }
    if (tower.type === 'delta' && snapshot.deltaState?.manualTargetId) {
      const state = this.ensureDeltaState(tower);
      if (state) {
        state.manualTargetId = snapshot.deltaState.manualTargetId;
      }
    }
    this.towers.push(tower);
    restoredTowerMap.set(tower.id, tower);
    this.handleInfinityTowerAdded(tower);
  });

  snapshots.forEach((snapshot) => {
    if (!snapshot || !snapshot.id || !snapshot.linkTargetId) {
      return;
    }
    const source = restoredTowerMap.get(snapshot.id);
    const target = restoredTowerMap.get(snapshot.linkTargetId);
    if (source && target) {
      this.addTowerConnection(source, target);
    }
  });

  snapshots.forEach((snapshot) => {
    if (!snapshot || !snapshot.id || !Array.isArray(snapshot.linkSources)) {
      return;
    }
    const target = restoredTowerMap.get(snapshot.id);
    if (!target) {
      return;
    }
    snapshot.linkSources.forEach((sourceId) => {
      const source = restoredTowerMap.get(sourceId);
      if (source && source !== target) {
        this.addTowerConnection(source, target);
      }
    });
  });

  refreshTowerLoadoutDisplay();
}

// Restore the battlefield to the last saved checkpoint and resume combat immediately.
export function retryFromEndlessCheckpoint() {
  if (
    !this.isEndlessMode ||
    !this.endlessCheckpoint ||
    this.endlessCheckpointUsed ||
    !this.levelConfig ||
    !Array.isArray(this.levelConfig.waves) ||
    !this.levelConfig.waves.length
  ) {
    return false;
  }

  const snapshot = this.endlessCheckpoint;
  const totalWaves = this.levelConfig.waves.length;
  const targetIndex = Math.max(0, Math.min(totalWaves - 1, Number(snapshot.waveIndex) || 0));

  this.cancelAutoStart();
  this.shouldAnimate = true;
  this.ensureLoop();

  // Reset non-combat-state systems
  this.resetChiSystems();
  this.projectiles = [];
  this.resetDamageNumbers();
  this.resetEnemyDeathParticles();
  this.resetWaveTallies();
  this.alphaBursts = [];
  this.betaBursts = [];
  this.gammaBursts = [];
    this.gammaStarBursts = [];
  this.nuBursts = [];
  this.swarmClouds = [];
  this.floaters = [];
  this.floaterConnections = [];
  // Refresh ambient swimmers so checkpoint restores regenerate the soft background motion.
  this.backgroundSwimmers = [];
  this.swimmerBounds = { width: this.renderWidth || 0, height: this.renderHeight || 0 };

  // Restore combat state through the manager
  if (this.combatStateManager) {
    this.combatStateManager.startCombat({
      startingWaveIndex: targetIndex,
      startingLives: Number.isFinite(snapshot.lives) ? snapshot.lives : this.levelConfig.lives,
      startingEnergy: Number.isFinite(snapshot.energy) ? snapshot.energy : 0,
      endless: true,
      endlessCycleStart: Math.max(0, Number(snapshot.endlessCycle) || 0),
      initialSpawnDelay: 0,
    });
  }

  this.autoWaveEnabled = snapshot.autoWaveEnabled ?? this.autoWaveEnabled;
  if (this.autoWaveCheckbox) {
    this.autoWaveCheckbox.checked = this.autoWaveEnabled;
  }
  if (Array.isArray(snapshot.availableTowers)) {
    this.availableTowers = snapshot.availableTowers.slice();
  }

  this.infinityTowers = [];
  this.restoreTowersFromCheckpoint(snapshot.towers);

  if (this.startButton) {
    this.startButton.disabled = true;
    this.startButton.textContent = 'Wave Running';
  }
  if (this.messageEl && this.activeWave?.config?.label) {
    this.messageEl.textContent = `Wave ${this.currentWaveNumber} — ${this.activeWave.config.label}.`;
  }

  this.updateHud();
  this.updateProgress();
  this.updateSpeedButton();
  this.updateAutoAnchorButton();
  this.dependencies.updateStatusDisplays();
  this.endlessCheckpointUsed = true;

  return true;
}
