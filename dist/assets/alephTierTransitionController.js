'use strict';

/**
 * Factory that manages the Aleph Spire tier-transition animation sequence:
 * wall-exit → golden glyph collection → wall-enter, plus tier palette
 * updates, drain-rate scaling, and visual glyph-count freezing.
 * Extracted from main.js to reduce its line count and isolate the tier
 * progression visuals from core game orchestration.
 */

import { mergeMotePalette, parseCssColor } from '../scripts/features/towers/powderTower.js';

// Stub palette progression for Aleph wall tiers so each tier's motes are visually distinct.
const ALEPH_TIER_STUB_COLORS = [
  '#f4d06f',
  '#ff8a80',
  '#80d8ff',
  '#ccff90',
  '#b388ff',
  '#ffab91',
  '#84ffff',
  '#ffd180',
  '#a7ffeb',
  '#ea80fc',
  '#ffff8d',
  '#80cbc4',
  '#ef9a9a',
  '#9fa8da',
  '#c5e1a5',
];

const ALEPH_TIER_WALL_EXIT_MS = 850;
const ALEPH_TIER_COLLECT_MS = 550;
const ALEPH_TIER_WALL_ENTER_MS = 720;

/**
 * @param {object} deps
 * @param {object}   deps.powderState
 * @param {object}   deps.powderConfig
 * @param {Function} deps.getPowderElements    - Getter; resolved at call time.
 * @param {Function} deps.getSandSimulation    - Getter; resolved at call time.
 * @param {Function} deps.getPowderSimulation  - Getter; resolved at call time.
 * @param {Function} deps.getApplyMindGatePaletteToDom - Getter; resolved at call time.
 * @param {Function} deps.getResolveAlephTierProgress  - Getter; resolved at call time.
 */
export function createAlephTierTransitionController(deps) {
  const {
    powderState,
    powderConfig,
    getPowderElements,
    getSandSimulation,
    getPowderSimulation,
    getApplyMindGatePaletteToDom,
    getResolveAlephTierProgress,
  } = deps;

  // ── Palette & rate helpers ───────────────────────────────────────────

  function resolveAlephTierStubPalette(tier) {
    const normalizedTier = Number.isFinite(tier) ? Math.max(1, Math.floor(tier)) : 1;
    const stubColor = ALEPH_TIER_STUB_COLORS[(normalizedTier - 1) % ALEPH_TIER_STUB_COLORS.length];
    const rgb = parseCssColor(stubColor) || { r: 247, g: 213, b: 101 };
    return {
      stops: [
        { ...rgb },
        { ...rgb },
        { ...rgb },
      ],
      restAlpha: 0.92,
      freefallAlpha: 0.68,
      backgroundTop: '#000000',
      backgroundBottom: '#000000',
    };
  }

  function resolveAlephTierRate(baseRate, tier) {
    const normalizedBaseRate = Number.isFinite(baseRate) ? Math.max(0, baseRate) : 0;
    const normalizedTier = Number.isFinite(tier) ? Math.max(1, Math.floor(tier)) : 1;
    // 1 next-tier mote represents 100 current-tier motes, so higher tiers run at baseRate / 100^(tier - 1).
    return normalizedBaseRate / 100 ** Math.max(0, normalizedTier - 1);
  }

  // ── Transition mechanics ─────────────────────────────────────────────

  function getTierAdvanceCount() {
    if (Number.isFinite(powderConfig.alephTierAdvanceCount) && powderConfig.alephTierAdvanceCount > 0) {
      return Math.max(1, Math.floor(powderConfig.alephTierAdvanceCount));
    }
    return 30;
  }

  function clearAlephTierTransitionTimers() {
    const transition = powderState.alephTierTransition;
    if (!transition || !Array.isArray(transition.timers)) {
      return;
    }
    transition.timers.forEach((timerId) => {
      clearTimeout(timerId);
    });
    transition.timers.length = 0;
  }

  function setAlephTierTransitionVisualState(state = 'idle') {
    const powderElements = getPowderElements();
    if (!powderElements?.basin) {
      return;
    }
    powderElements.basin.classList.toggle('powder-basin--tier-transition-out', state === 'walls-exiting');
    powderElements.basin.classList.toggle('powder-basin--tier-transition-in', state === 'walls-entering');
    powderElements.basin.classList.toggle('powder-basin--tier-aleph-visible', state === 'awaiting-collect');
    if (powderElements.tierGoldenAleph) {
      powderElements.tierGoldenAleph.hidden = state !== 'awaiting-collect';
      if (state !== 'collecting') {
        powderElements.tierGoldenAleph.classList.remove('powder-tier-golden-aleph--collecting');
      }
    }
  }

  function setAlephTierTransitionSpawnState({ spawnEnabled, floorDrainEnabled, clearPendingDrops = false }) {
    const simulation = getSandSimulation();
    if (!simulation) {
      return;
    }
    if (typeof simulation.setSpawnEnabled === 'function') {
      simulation.setSpawnEnabled(spawnEnabled, { clearPendingDrops });
    }
    if (typeof simulation.setFloorDrainEnabled === 'function') {
      simulation.setFloorDrainEnabled(floorDrainEnabled);
    }
  }

  function getTierVisualGlyphCount(glyphsLit) {
    const transition = powderState.alephTierTransition;
    if (
      transition?.active &&
      transition.stage !== 'idle' &&
      Number.isFinite(transition.lockedGlyphsLit) &&
      transition.lockedGlyphsLit >= 0
    ) {
      return Math.max(0, Math.floor(transition.lockedGlyphsLit));
    }
    return Math.max(0, Math.floor(Number.isFinite(glyphsLit) ? glyphsLit : 0));
  }

  function completeAlephTierTransition() {
    const transition = powderState.alephTierTransition;
    if (!transition) {
      return;
    }
    clearAlephTierTransitionTimers();
    transition.active = false;
    transition.stage = 'idle';
    transition.lockedGlyphsLit = null;
    transition.triggerGlyphCount = 0;
    setAlephTierTransitionVisualState('idle');
    setAlephTierTransitionSpawnState({
      spawnEnabled: true,
      floorDrainEnabled: false,
      clearPendingDrops: false,
    });
  }

  function beginAlephTierTransition(glyphsLit) {
    const normalizedGlyphs = Number.isFinite(glyphsLit) ? Math.max(0, Math.floor(glyphsLit)) : 0;
    const tierAdvanceCount = getTierAdvanceCount();
    const sourceTier = Number.isFinite(powderState.alephWallTier)
      ? Math.max(1, Math.floor(powderState.alephWallTier))
      : 1;
    const targetTier = Math.min(
      sourceTier + 1,
      Number.isFinite(powderConfig.alephWallTierMax) ? Math.max(1, Math.floor(powderConfig.alephWallTierMax)) : sourceTier + 1,
    );
    const transition = powderState.alephTierTransition;
    transition.active = true;
    transition.stage = 'walls-exiting';
    transition.triggerGlyphCount = normalizedGlyphs;
    transition.lockedGlyphsLit = Math.max(0, normalizedGlyphs - 1);
    transition.sourceTier = sourceTier;
    transition.targetTier = targetTier;
    clearAlephTierTransitionTimers();

    setAlephTierTransitionSpawnState({
      spawnEnabled: false,
      floorDrainEnabled: true,
      clearPendingDrops: true,
    });
    setAlephTierTransitionVisualState('walls-exiting');

    const revealTimer = setTimeout(() => {
      if (!powderState.alephTierTransition?.active) {
        return;
      }
      powderState.alephTierTransition.stage = 'awaiting-collect';
      setAlephTierTransitionVisualState('awaiting-collect');
    }, ALEPH_TIER_WALL_EXIT_MS);
    transition.timers.push(revealTimer);
    powderState.alephTierTransitionCheckpoint = Math.max(
      powderState.alephTierTransitionCheckpoint || 0,
      normalizedGlyphs,
      tierAdvanceCount,
    );
  }

  function collectGoldenAlephTierGlyph() {
    const transition = powderState.alephTierTransition;
    if (!transition?.active || transition.stage !== 'awaiting-collect') {
      return;
    }
    transition.stage = 'collecting';
    const powderElements = getPowderElements();
    if (powderElements?.tierGoldenAleph) {
      powderElements.tierGoldenAleph.classList.add('powder-tier-golden-aleph--collecting');
    }

    const collectTimer = setTimeout(() => {
      if (!powderState.alephTierTransition?.active) {
        return;
      }
      const nextGlyphs = Math.max(
        transition.triggerGlyphCount,
        Number.isFinite(powderState.wallGlyphsLit) ? powderState.wallGlyphsLit : transition.triggerGlyphCount,
      );
      transition.stage = 'walls-entering';
      transition.lockedGlyphsLit = nextGlyphs;
      setAlephTierTransitionVisualState('walls-entering');
      const resolveAlephTierProgress = getResolveAlephTierProgress();
      syncAlephTierVisualProfile(resolveAlephTierProgress(nextGlyphs));

      const enterTimer = setTimeout(() => {
        completeAlephTierTransition();
      }, ALEPH_TIER_WALL_ENTER_MS);
      transition.timers.push(enterTimer);
    }, ALEPH_TIER_COLLECT_MS);
    transition.timers.push(collectTimer);
  }

  function maybeStartAlephTierTransition(glyphsLit, tierProgress) {
    if (powderState.simulationMode !== 'sand') {
      return;
    }
    const sandSimulation = getSandSimulation();
    const powderSimulation = getPowderSimulation();
    if (!sandSimulation || powderSimulation !== sandSimulation) {
      return;
    }
    const transition = powderState.alephTierTransition;
    if (!transition || transition.active) {
      return;
    }
    const tierAdvanceCount = getTierAdvanceCount();
    const normalizedGlyphs = Number.isFinite(glyphsLit) ? Math.max(0, Math.floor(glyphsLit)) : 0;
    const previousGlyphsLit = Number.isFinite(powderState.wallGlyphsLit)
      ? Math.max(0, Math.floor(powderState.wallGlyphsLit))
      : 0;
    if (normalizedGlyphs <= previousGlyphsLit) {
      return;
    }
    if (normalizedGlyphs <= 0 || normalizedGlyphs % tierAdvanceCount !== 0) {
      return;
    }
    // Skip milestones that were already processed so each tier-finale sequence runs only once per threshold.
    if (normalizedGlyphs <= (powderState.alephTierTransitionCheckpoint || 0)) {
      return;
    }
    const maxTier = Number.isFinite(powderConfig.alephWallTierMax)
      ? Math.max(1, Math.floor(powderConfig.alephWallTierMax))
      : 15;
    const resolvedTier = Number.isFinite(tierProgress?.tier) ? Math.max(1, Math.floor(tierProgress.tier)) : 1;
    if (resolvedTier > maxTier) {
      return;
    }
    beginAlephTierTransition(normalizedGlyphs);
  }

  function bindAlephTierTransitionControls() {
    const powderElements = getPowderElements();
    if (!powderElements?.tierGoldenAleph || powderElements.tierGoldenAleph.dataset.boundTierTransition === 'true') {
      return;
    }
    powderElements.tierGoldenAleph.dataset.boundTierTransition = 'true';
    powderElements.tierGoldenAleph.addEventListener('click', (event) => {
      if (event.defaultPrevented) {
        return;
      }
      collectGoldenAlephTierGlyph();
    });
  }

  function syncAlephTierVisualProfile(tierProgress) {
    if (!tierProgress || typeof tierProgress !== 'object') {
      return;
    }
    const tier = Number.isFinite(tierProgress.tier) ? Math.max(1, Math.floor(tierProgress.tier)) : 1;
    powderState.alephWallTier = tier;
    powderState.alephTierAlephValue = Number.isFinite(tierProgress.alephInTier)
      ? Math.max(0, Math.floor(tierProgress.alephInTier))
      : 0;

    const currentRate = Number.isFinite(powderState.idleDrainRate) ? Math.max(0, powderState.idleDrainRate) : 0;
    if (!Number.isFinite(powderState.alephBaseIdleDrainRate) || powderState.alephBaseIdleDrainRate <= 0) {
      powderState.alephBaseIdleDrainRate = currentRate;
    }
    const effectiveRate = resolveAlephTierRate(powderState.alephBaseIdleDrainRate, tier);
    powderState.idleDrainRate = effectiveRate;
    const tierPalette = resolveAlephTierStubPalette(tier);
    powderState.motePalette = mergeMotePalette(tierPalette);
    const sandSimulation = getSandSimulation();
    const powderSimulation = getPowderSimulation();
    const sandIsActive = powderSimulation === sandSimulation || powderState.simulationMode === 'sand';
    if (sandIsActive) {
      const applyMindGatePaletteToDom = getApplyMindGatePaletteToDom();
      applyMindGatePaletteToDom(powderState.motePalette);
    }

    if (sandSimulation && Number.isFinite(effectiveRate)) {
      sandSimulation.idleDrainRate = effectiveRate;
      if (typeof sandSimulation.setMotePalette === 'function') {
        sandSimulation.setMotePalette(tierPalette);
      }
    }
  }

  // ── Public API ───────────────────────────────────────────────────────

  return {
    resolveAlephTierStubPalette,
    resolveAlephTierRate,
    getTierVisualGlyphCount,
    setAlephTierTransitionVisualState,
    setAlephTierTransitionSpawnState,
    maybeStartAlephTierTransition,
    bindAlephTierTransitionControls,
    syncAlephTierVisualProfile,
  };
}
