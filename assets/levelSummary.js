import { formatGameNumber } from '../scripts/core/formatting.js';
import { formatDuration, formatRewards, formatRelativeTime } from './formatHelpers.js';

/**
 * Factory for level summary helpers that keep formatting logic outside main.js.
 * @param {Object} options dependency bag sourced from main orchestrator
 * @param {Function} options.getCompletedInteractiveLevelCount counts cleared interactive levels
 * @param {Function} options.getStartingTheroMultiplier resolves multiplier for starting Thero
 * @param {Function} options.isInteractiveLevel predicate for interactive levels
 * @param {Map} options.levelConfigs live interactive level configuration map
 * @param {Map} options.idleLevelConfigs live idle level configuration map
 * @param {Function} options.getBaseStartThero getter for the configured baseline starting Thero
 * @param {string} options.theroSymbol glyph used to describe Thero
 * @param {Function} [options.isDeveloperInfiniteTheroEnabled] flags whether developer infinite Thero is toggled on
 */
export function createLevelSummaryHelpers({
  getCompletedInteractiveLevelCount,
  getStartingTheroMultiplier,
  isInteractiveLevel,
  levelConfigs,
  idleLevelConfigs,
  getBaseStartThero,
  theroSymbol,
  isDeveloperInfiniteTheroEnabled,
}) {
  function formatInteractiveLevelRewards() {
    const levelsBeaten = getCompletedInteractiveLevelCount();
    const multiplier = getStartingTheroMultiplier(levelsBeaten);
    const levelLabel = levelsBeaten === 1 ? 'level' : 'levels';
    const beatenText = `${levelsBeaten} ${levelLabel} sealed`;
    const multiplierLabel = formatGameNumber(multiplier);
    return `+1 Mote Gems/min · Thero Multiplier ×${multiplierLabel} (${beatenText})`;
  }

  function describeLevelStartingThero(level, configOverride = null) {
    const config = configOverride || (level ? levelConfigs.get(level.id) : null);
    if (!config) {
      return { text: '—', aria: 'Starting Thero not applicable.' };
    }
    if (typeof isDeveloperInfiniteTheroEnabled === 'function' && isDeveloperInfiniteTheroEnabled()) {
      return { text: `∞ ${theroSymbol}`, aria: 'Starting Thero is infinite for developer testing.' };
    }
    if (config.infiniteThero) {
      return { text: `∞ ${theroSymbol}`, aria: 'Starting Thero is infinite.' };
    }

    const baseStart = Number.isFinite(config.startThero)
      ? Math.max(0, config.startThero)
      : getBaseStartThero();
    const multiplier = getStartingTheroMultiplier();
    const totalStart = Math.max(0, baseStart * multiplier);
    const baseLabel = formatGameNumber(baseStart);
    const multiplierLabel = formatGameNumber(multiplier);
    const totalLabel = formatGameNumber(totalStart);

    return {
      text: `${baseLabel} ${theroSymbol} × ${multiplierLabel} = ${totalLabel} ${theroSymbol}`,
      aria: `Starting Thero equals ${baseLabel} ${theroSymbol} times ${multiplierLabel}, totaling ${totalLabel} ${theroSymbol}.`,
    };
  }

  function getLevelSummary(level) {
    if (!level) {
      return {
        mode: '—',
        duration: '—',
        rewards: '—',
        start: '—',
        startAria: 'Starting Thero not applicable.',
      };
    }
    const interactiveConfig = levelConfigs.get(level.id);
    if (interactiveConfig) {
      const waves = interactiveConfig.waves?.length || 0;
      const endless = Boolean(interactiveConfig.forceEndlessMode);
      const startSummary = describeLevelStartingThero(level, interactiveConfig);
      return {
        mode: endless ? 'Endless Defense' : 'Active Defense',
        duration: endless ? 'Endless · manual' : waves ? `${waves} waves · manual` : 'Active defense',
        rewards: formatInteractiveLevelRewards(),
        start: startSummary.text,
        startAria: startSummary.aria,
      };
    }

    const config = idleLevelConfigs.get(level.id);
    return {
      mode: 'Idle Simulation',
      duration: config ? `${formatDuration(config.runDuration)} auto-run` : 'Idle simulation',
      rewards: config
        ? formatRewards(config.rewardScore, config.rewardFlux, config.rewardEnergy, formatGameNumber)
        : '—',
      start: '—',
      startAria: 'Starting Thero not applicable.',
    };
  }

  function describeLevelLastResult(level, state, runner) {
    if (runner) {
      const percent = Math.min(100, Math.max(0, Math.round((runner.progress || 0) * 100)));
      const remainingSeconds = Number.isFinite(runner.remainingMs)
        ? Math.ceil(runner.remainingMs / 1000)
        : null;
      const remainingLabel = remainingSeconds === null
        ? 'Finishing'
        : `${formatDuration(remainingSeconds)} remaining`;
      return `Auto-run ${percent}% · ${remainingLabel}.`;
    }

    if (state?.running) {
      return level && isInteractiveLevel(level.id) ? 'Manual defense active.' : 'Auto-run initializing.';
    }

    if (!state || !state.lastResult) {
      return 'No attempts recorded.';
    }

    const { outcome, stats = {}, timestamp } = state.lastResult;
    const bestWave = Math.max(state.bestWave || 0, stats.maxWave || 0);
    const relative = formatRelativeTime(timestamp) || 'recently';

    if (outcome === 'victory') {
      const rewardText = formatRewards(stats.rewardScore, stats.rewardFlux, stats.rewardEnergy, formatGameNumber);
      const segments = [`Victory ${relative}.`];
      if (rewardText && rewardText !== '—') {
        segments.push(`Rewards: ${rewardText}.`);
      }
      if (Number.isFinite(stats.startThero)) {
        segments.push(`Starting Thero now ${formatGameNumber(stats.startThero)} ${theroSymbol}.`);
      }
      return segments.join(' ');
    }

    if (outcome === 'defeat') {
      const waveLabel = bestWave > 0 ? `Wave ${formatGameNumber(bestWave)}` : 'Early collapse';
      return `${waveLabel} fell ${relative}.`;
    }

    return 'No attempts recorded.';
  }

  return {
    getLevelSummary,
    describeLevelLastResult,
  };
}
