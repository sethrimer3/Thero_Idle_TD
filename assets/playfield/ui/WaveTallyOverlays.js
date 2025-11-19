// Manages the animated wave tally overlays that summarize kills and damage per tower.
import { formatWholeNumber } from '../../../scripts/core/formatting.js';
import { formatCombatNumber } from '../utils/formatting.js';
import { easeInCubic, easeOutCubic } from '../utils/math.js';
import { areWaveKillTalliesEnabled, areWaveDamageTalliesEnabled } from '../../preferences.js';

const WAVE_TALLY_FONT_FAMILY = '"Petrona", "Cormorant Garamond", serif';
const WAVE_TALLY_KILL_COLOR = { r: 255, g: 228, b: 150 };
const WAVE_TALLY_DAMAGE_COLOR = { r: 139, g: 247, b: 255 };
const WAVE_TALLY_SHADOW_COLOR = { r: 6, g: 8, b: 14 };
const WAVE_TALLY_SCRIBBLE_DURATION = 0.28;
const WAVE_TALLY_HOLD_DURATION = 2;
const WAVE_TALLY_ERASE_DURATION = 0.4;
const WAVE_TALLY_KILL_PADDING = 18;
const WAVE_TALLY_DAMAGE_PADDING = 24;
const WAVE_TALLY_DAMAGE_FONT_SIZE = 9.6;
const WAVE_TALLY_KILL_FONT_SIZE = WAVE_TALLY_DAMAGE_FONT_SIZE;

export class WaveTallyOverlayManager {
  constructor({
    isPreviewMode = () => false,
    getContext = () => null,
    getTowerById = () => null,
    resolveTowerBodyRadius = () => 0,
  } = {}) {
    this.isPreviewMode = isPreviewMode;
    this.getContext = getContext;
    this.getTowerById = getTowerById;
    this.resolveTowerBodyRadius = resolveTowerBodyRadius;

    this.waveTallyLabels = [];
    this.waveTallyIdCounter = 0;
  }

  getEntries() {
    return this.waveTallyLabels;
  }

  reset() {
    this.waveTallyLabels.length = 0;
    this.waveTallyIdCounter = 0;
  }

  clear({ type = null } = {}) {
    if (!type) {
      this.waveTallyLabels.length = 0;
      return;
    }
    if (!this.waveTallyLabels.length) {
      return;
    }
    const survivors = this.waveTallyLabels.filter((entry) => entry && entry.type !== type);
    this.replaceEntries(survivors);
  }

  areKillTalliesActive() {
    if (this.isPreviewMode()) {
      return false;
    }
    return areWaveKillTalliesEnabled();
  }

  areDamageTalliesActive() {
    if (this.isPreviewMode()) {
      return false;
    }
    return areWaveDamageTalliesEnabled();
  }

  measureLabelWidth(label, font, fontSize = 16) {
    if (!label) {
      return 0;
    }
    const context = this.getContext();
    if (!context || typeof context.measureText !== 'function') {
      const fallbackSize = Number.isFinite(fontSize) ? fontSize : 16;
      return label.length * fallbackSize * 0.55;
    }
    context.save();
    context.font = font;
    const metrics = context.measureText(label);
    context.restore();
    return metrics.width;
  }

  createWaveTallyEntry(tower, { type, label }) {
    if (!tower || !tower.id || !label) {
      return null;
    }
    const fontSize = type === 'kills' ? WAVE_TALLY_KILL_FONT_SIZE : WAVE_TALLY_DAMAGE_FONT_SIZE;
    const fontWeight = type === 'damage' ? 700 : 600;
    const font = `${fontWeight} ${fontSize}px ${WAVE_TALLY_FONT_FAMILY}`;
    const color = type === 'kills' ? WAVE_TALLY_KILL_COLOR : WAVE_TALLY_DAMAGE_COLOR;
    const padding = type === 'kills' ? WAVE_TALLY_KILL_PADDING : WAVE_TALLY_DAMAGE_PADDING;
    const entry = {
      id: `wave-tally-${(this.waveTallyIdCounter += 1)}`,
      towerId: tower.id,
      type,
      label,
      font,
      fontSize,
      color,
      strokeColor: WAVE_TALLY_SHADOW_COLOR,
      shadowColor: WAVE_TALLY_SHADOW_COLOR,
      shadowBlur: 10,
      padding,
      direction: type === 'kills' ? 'above' : 'below',
      scribbleDuration: WAVE_TALLY_SCRIBBLE_DURATION,
      holdDuration: WAVE_TALLY_HOLD_DURATION,
      eraseDuration: WAVE_TALLY_ERASE_DURATION,
      totalDuration: WAVE_TALLY_SCRIBBLE_DURATION + WAVE_TALLY_HOLD_DURATION + WAVE_TALLY_ERASE_DURATION,
      elapsed: 0,
      revealProgress: 0,
      eraseProgress: 0,
      alpha: 0,
      opacity: type === 'damage' ? 0.7 : 1,
      position: { x: tower.x, y: tower.y },
    };
    entry.textWidth = this.measureLabelWidth(label, font, fontSize);
    return entry;
  }

  spawnWaveCompletionTallies({ combatStats, towers } = {}) {
    if (
      this.isPreviewMode() ||
      !combatStats ||
      !combatStats.active ||
      !(combatStats.towerInstances instanceof Map)
    ) {
      return;
    }
    const showKills = this.areKillTalliesActive();
    const showDamage = this.areDamageTalliesActive();
    if (!showKills && !showDamage) {
      return;
    }
    if (!Array.isArray(towers) || !towers.length) {
      return;
    }
    towers.forEach((tower) => {
      if (!tower?.id) {
        return;
      }
      const statsEntry = combatStats.towerInstances.get(tower.id);
      if (!statsEntry) {
        return;
      }
      if (showKills) {
        const kills = Number.isFinite(statsEntry.killCount) ? statsEntry.killCount : 0;
        if (kills > 0) {
          const killLabel = `Kills · ${formatWholeNumber(kills)}`;
          const entry = this.createWaveTallyEntry(tower, { type: 'kills', label: killLabel });
          if (entry) {
            this.waveTallyLabels.push(entry);
          }
        }
      }
      if (showDamage) {
        const totalDamage = Number.isFinite(statsEntry.totalDamage) ? statsEntry.totalDamage : 0;
        if (totalDamage > 0) {
          const damageLabel = `Dmg · ${formatCombatNumber(totalDamage)}`;
          const entry = this.createWaveTallyEntry(tower, { type: 'damage', label: damageLabel });
          if (entry) {
            this.waveTallyLabels.push(entry);
          }
        }
      }
    });
  }

  update(delta) {
    if (!Array.isArray(this.waveTallyLabels) || !this.waveTallyLabels.length) {
      return;
    }
    const step = Math.max(0, delta);
    const survivors = [];
    this.waveTallyLabels.forEach((entry) => {
      if (!entry) {
        return;
      }
      entry.elapsed = (entry.elapsed || 0) + step;
      const totalDuration = entry.totalDuration
        || entry.scribbleDuration + entry.holdDuration + entry.eraseDuration;
      if (entry.elapsed >= totalDuration) {
        return;
      }
      let alpha = 1;
      let revealProgress = 1;
      let eraseProgress = 0;
      entry.isErasing = false;
      if (entry.elapsed <= entry.scribbleDuration) {
        const progress = entry.scribbleDuration > 0
          ? Math.min(1, entry.elapsed / entry.scribbleDuration)
          : 1;
        revealProgress = easeOutCubic(progress);
        alpha = Math.min(1, revealProgress + 0.15);
      } else if (entry.elapsed <= entry.scribbleDuration + entry.holdDuration) {
        revealProgress = 1;
        alpha = 1;
      } else {
        const eraseElapsed = entry.elapsed - (entry.scribbleDuration + entry.holdDuration);
        const ratio = entry.eraseDuration > 0 ? Math.min(1, eraseElapsed / entry.eraseDuration) : 1;
        eraseProgress = easeInCubic(ratio);
        alpha = Math.max(0, 1 - eraseProgress);
        entry.isErasing = true;
      }
      entry.revealProgress = revealProgress;
      entry.eraseProgress = eraseProgress;
      entry.alpha = alpha;
      const tower = this.getTowerById(entry.towerId);
      if (!tower || !Number.isFinite(tower.x) || !Number.isFinite(tower.y)) {
        return;
      }
      const padding = Number.isFinite(entry.padding) ? entry.padding : WAVE_TALLY_DAMAGE_PADDING;
      const bodyRadius = this.resolveTowerBodyRadius(tower);
      const offset = bodyRadius + padding;
      const direction = entry.direction === 'above' ? -1 : 1;
      entry.position = {
        x: tower.x,
        y: tower.y + direction * offset,
      };
      if (alpha <= 0.02) {
        return;
      }
      survivors.push(entry);
    });
    this.replaceEntries(survivors);
  }

  replaceEntries(entries) {
    this.waveTallyLabels.length = 0;
    this.waveTallyLabels.push(...entries);
  }
}
