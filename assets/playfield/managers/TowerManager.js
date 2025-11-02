import {
  ensureAlphaState as ensureAlphaStateHelper,
  teardownAlphaTower as teardownAlphaTowerHelper,
  spawnAlphaAttackBurst as spawnAlphaAttackBurstHelper,
} from '../../../scripts/features/towers/alphaTower.js';
import {
  ensureBetaState as ensureBetaStateHelper,
  teardownBetaTower as teardownBetaTowerHelper,
  spawnBetaAttackBurst as spawnBetaAttackBurstHelper,
} from '../../../scripts/features/towers/betaTower.js';
import {
  ensureGammaState as ensureGammaStateHelper,
  teardownGammaTower as teardownGammaTowerHelper,
  spawnGammaAttackBurst as spawnGammaAttackBurstHelper,
} from '../../../scripts/features/towers/gammaTower.js';
import {
  ensureKappaState as ensureKappaStateHelper,
  teardownKappaTower as teardownKappaTowerHelper,
} from '../../../scripts/features/towers/kappaTower.js';
import {
  ensureThetaState as ensureThetaStateHelper,
  teardownThetaTower as teardownThetaTowerHelper,
} from '../../../scripts/features/towers/thetaTower.js';
import {
  evaluateZetaMetrics as evaluateZetaMetricsHelper,
  teardownZetaTower as teardownZetaTowerHelper,
  ensureZetaState as ensureZetaStateHelper,
} from '../../../scripts/features/towers/zetaTower.js';
import {
  teardownEtaTower as teardownEtaTowerHelper,
  ensureEtaState as ensureEtaStateHelper,
  mergeEtaTower as mergeEtaTowerHelper,
} from '../../../scripts/features/towers/etaTower.js';
import {
  ensureDeltaState as ensureDeltaStateHelper,
  configureDeltaBehavior as configureDeltaBehaviorHelper,
  teardownDeltaTower as teardownDeltaTowerHelper,
  updateDeltaAnchors as updateDeltaAnchorsHelper,
  clearTowerManualTarget as clearTowerManualTargetHelper,
  getTowerManualTarget as getTowerManualTargetHelper,
} from '../../../scripts/features/towers/deltaTower.js';
import {
  ensureIotaState as ensureIotaStateHelper,
  teardownIotaTower as teardownIotaTowerHelper,
  fireIotaPulse as fireIotaPulseHelper,
} from '../../../scripts/features/towers/iotaTower.js';

// Tower management routines extracted from SimplePlayfield.

function evaluateZetaMetrics(tower) {
  return evaluateZetaMetricsHelper(this, tower);
}

function teardownAlphaTower(tower) {
  teardownAlphaTowerHelper(this, tower);
}

function ensureAlphaState(tower) {
  return ensureAlphaStateHelper(this, tower);
}

function spawnAlphaAttackBurst(tower, targetInfo, options = {}) {
  return spawnAlphaAttackBurstHelper(this, tower, targetInfo, options);
}

function teardownBetaTower(tower) {
  teardownBetaTowerHelper(this, tower);
}

function ensureBetaState(tower) {
  return ensureBetaStateHelper(this, tower);
}

function spawnBetaAttackBurst(tower, targetInfo, options = {}) {
  return spawnBetaAttackBurstHelper(this, tower, targetInfo, options);
}

function teardownGammaTower(tower) {
  teardownGammaTowerHelper(this, tower);
}

function ensureGammaState(tower) {
  return ensureGammaStateHelper(this, tower);
}

function teardownKappaTower(tower) {
  teardownKappaTowerHelper(this, tower);
}

function ensureKappaState(tower) {
  return ensureKappaStateHelper(this, tower);
}

function spawnGammaAttackBurst(tower, targetInfo, options = {}) {
  return spawnGammaAttackBurstHelper(this, tower, targetInfo, options);
}

function teardownThetaTower(tower) {
  teardownThetaTowerHelper(this, tower);
}

function ensureThetaState(tower) {
  return ensureThetaStateHelper(this, tower);
}

function teardownZetaTower(tower) {
  teardownZetaTowerHelper(this, tower);
}

function ensureZetaState(tower) {
  return ensureZetaStateHelper(this, tower);
}

function teardownEtaTower(tower) {
  teardownEtaTowerHelper(this, tower);
}

function ensureEtaState(tower, options = {}) {
  return ensureEtaStateHelper(this, tower, options);
}

function mergeEtaTower(tower, { silent = false } = {}) {
  return mergeEtaTowerHelper(this, tower, { silent });
}

function applyTowerBehaviorDefaults(tower) {
  if (!tower) {
    return;
  }
  if (!tower.targetPriority) {
    tower.targetPriority = 'first';
  }
  if (!tower.behaviorMode) {
    tower.behaviorMode = 'pursuit';
  }
  if (tower.type === 'alpha') {
    this.ensureAlphaState(tower);
  } else if (tower.alphaState) {
    this.teardownAlphaTower(tower);
  }
  if (tower.type === 'beta') {
    this.ensureBetaState(tower);
  } else if (tower.betaState) {
    this.teardownBetaTower(tower);
  }
  if (tower.type === 'gamma') {
    this.ensureGammaState(tower);
  } else if (tower.gammaState) {
    this.teardownGammaTower(tower);
  }
  if (tower.type === 'kappa') {
    this.ensureKappaState(tower);
  } else if (tower.kappaState) {
    this.teardownKappaTower(tower);
  }
  if (tower.type === 'theta') {
    this.ensureThetaState(tower);
  } else if (tower.thetaState) {
    this.teardownThetaTower(tower);
  }
  if (tower.type === 'delta') {
    this.ensureDeltaState(tower);
    this.configureDeltaBehavior(tower, tower.behaviorMode);
  } else if (tower.deltaState) {
    this.teardownDeltaTower(tower);
  }
  if (tower.type === 'iota') {
    this.ensureIotaState(tower);
  } else if (tower.iotaState) {
    this.teardownIotaTower(tower);
  }
  if (tower.type === 'zeta') {
    // Activate ζ pendulum state so orbit physics stay ready for combat or idle motion.
    this.ensureZetaState(tower);
  } else if (tower.zetaState) {
    // Clean up ζ caches if the lattice retunes into another form.
    this.teardownZetaTower(tower);
  }
  if (tower.type === 'eta') {
    // Maintain η orbital state so rings stay synchronized while idle.
    this.ensureEtaState(tower);
  } else if (tower.etaState) {
    // Clear η caches when the lattice shifts into another configuration.
    this.teardownEtaTower(tower);
  }
}

function ensureDeltaState(tower) {
  return ensureDeltaStateHelper(this, tower);
}

function configureDeltaBehavior(tower, mode) {
  configureDeltaBehaviorHelper(this, tower, mode);
}

function teardownDeltaTower(tower) {
  teardownDeltaTowerHelper(this, tower);
}

function updateDeltaAnchors(tower) {
  updateDeltaAnchorsHelper(this, tower);
}

function clearTowerManualTarget(tower) {
  return clearTowerManualTargetHelper(this, tower);
}

function getTowerManualTarget(tower) {
  return getTowerManualTargetHelper(this, tower);
}

function ensureIotaState(tower) {
  return ensureIotaStateHelper(this, tower);
}

function teardownIotaTower(tower) {
  teardownIotaTowerHelper(this, tower);
}

function fireIotaPulse(tower, targetInfo = {}) {
  fireIotaPulseHelper(this, tower, targetInfo);
}

export {
  evaluateZetaMetrics,
  teardownAlphaTower,
  ensureAlphaState,
  spawnAlphaAttackBurst,
  teardownBetaTower,
  ensureBetaState,
  spawnBetaAttackBurst,
  teardownGammaTower,
  ensureGammaState,
  spawnGammaAttackBurst,
  teardownKappaTower,
  ensureKappaState,
  teardownThetaTower,
  ensureThetaState,
  teardownZetaTower,
  ensureZetaState,
  teardownEtaTower,
  ensureEtaState,
  mergeEtaTower,
  applyTowerBehaviorDefaults,
  ensureDeltaState,
  configureDeltaBehavior,
  teardownDeltaTower,
  updateDeltaAnchors,
  clearTowerManualTarget,
  getTowerManualTarget,
  ensureIotaState,
  teardownIotaTower,
  fireIotaPulse,
};
