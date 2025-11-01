import { playTowerPlacementNotes } from '../../audioSystem.js';
import { refreshTowerLoadoutDisplay } from '../../towersTab.js';
import { formatCombatNumber } from '../utils/formatting.js';

// HUD and UI binding routines extracted from SimplePlayfield.

function registerSlots() {
  this.slotButtons.forEach((button) => {
    const slotId = button.dataset.slotId;
    const x = Number.parseFloat(button.dataset.slotX);
    const y = Number.parseFloat(button.dataset.slotY);
    if (!slotId || Number.isNaN(x) || Number.isNaN(y)) {
      return;
    }
    const slot = {
      id: slotId,
      button,
      normalized: { x, y },
      tower: null,
    };
    this.slots.set(slotId, slot);
    button.addEventListener('click', () => this.handleSlotInteraction(slot));
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.handleSlotInteraction(slot);
      }
    });
  });
}

function bindStartButton() {
  if (!this.startButton) {
    return;
  }
  this.startButton.addEventListener('click', () => this.handleStartButton());
}

function bindSpeedButton() {
  if (!this.speedButton) {
    return;
  }
  this.speedButton.addEventListener('click', () => {
    if (this.audio) {
      this.audio.unlock();
    }
    if (!this.isInteractiveLevelActive()) {
      if (this.messageEl) {
        this.messageEl.textContent =
          'Enter an interactive level to adjust the simulation speed.';
      }
      return;
    }
    this.cycleSpeedMultiplier();
    if (this.audio) {
      this.audio.playSfx('uiToggle');
    }
  });
}

function bindAutoAnchorButton() {
  if (!this.autoAnchorButton) {
    return;
  }
  this.autoAnchorButton.addEventListener('click', () => {
    if (this.audio) {
      this.audio.unlock();
    }
    if (!this.isInteractiveLevelActive()) {
      if (this.messageEl) {
        this.messageEl.textContent =
          'Enter an interactive level to auto-lattice recommended anchors.';
      }
      return;
    }
    this.autoAnchorTowers();
  });
}

function bindAutoWaveCheckbox() {
  if (!this.autoWaveCheckbox) {
    return;
  }
  this.autoWaveCheckbox.checked = this.autoWaveEnabled;
  this.autoWaveCheckbox.disabled = true;
  this.autoWaveCheckbox.addEventListener('change', () => {
    if (!this.autoWaveCheckbox) {
      return;
    }
    this.autoWaveEnabled = this.autoWaveCheckbox.checked;
    if (!this.levelActive || !this.levelConfig || this.combatActive) {
      if (!this.autoWaveEnabled) {
        this.cancelAutoStart();
      }
      return;
    }
    if (this.autoWaveEnabled) {
      this.scheduleAutoStart({ delay: this.autoStartLeadTime });
    } else {
      this.cancelAutoStart();
      if (this.messageEl) {
        this.messageEl.textContent =
          'Auto-start disabled—commence waves when your lattice is ready.';
      }
    }
  });
}

function scheduleAutoStart(options = {}) {
  if (
    !this.autoWaveEnabled ||
    !this.levelActive ||
    !this.levelConfig ||
    this.combatActive
  ) {
    return;
  }
  const delay = Number.isFinite(options.delay)
    ? Math.max(0, options.delay)
    : this.autoStartLeadTime;
  this.cancelAutoStart();
  if (typeof window === 'undefined') {
    return;
  }
  this.autoStartDeadline = Date.now() + delay * 1000;
  this.autoStartTimer = window.setTimeout(() => {
    this.autoStartTimer = null;
    this.tryAutoStart();
  }, delay * 1000);
}

function cancelAutoStart() {
  if (this.autoStartTimer) {
    clearTimeout(this.autoStartTimer);
    this.autoStartTimer = null;
  }
  this.autoStartDeadline = 0;
}

function tryAutoStart() {
  if (
    !this.autoWaveEnabled ||
    !this.levelActive ||
    !this.levelConfig ||
    this.combatActive
  ) {
    return;
  }
  if (!this.towers.length) {
    if (this.messageEl) {
      this.messageEl.textContent =
        'Awaiting lattice placements—auto-start resumes once towers are in place.';
    }
    this.scheduleAutoStart({ delay: 1.5 });
    return;
  }
  this.autoStartDeadline = 0;
  this.handleStartButton();
}

function createEnemyTooltip() {
  if (!this.container || this.enemyTooltip) {
    return;
  }

  const tooltip = document.createElement('div');
  tooltip.className = 'enemy-tooltip';

  const nameEl = document.createElement('div');
  nameEl.className = 'enemy-tooltip-name';

  const hpEl = document.createElement('div');
  hpEl.className = 'enemy-tooltip-hp';

  tooltip.append(nameEl, hpEl);
  tooltip.setAttribute('aria-hidden', 'true');

  this.container.appendChild(tooltip);
  this.enemyTooltip = tooltip;
  this.enemyTooltipNameEl = nameEl;
  this.enemyTooltipHpEl = hpEl;
}

function enableSlots() {
  this.slots.forEach((slot) => {
    if (slot.button) {
      slot.button.disabled = false;
    }
  });
}

function disableSlots(clear = false) {
  this.slots.forEach((slot) => {
    if (!slot.button) {
      return;
    }
    slot.button.disabled = true;
    if (clear) {
      slot.tower = null;
      slot.button.classList.remove('tower-built');
      slot.button.setAttribute('aria-pressed', 'false');
    }
  });
}

function autoAnchorTowers() {
  if (!this.isInteractiveLevelActive()) {
    if (this.audio) {
      this.audio.playSfx('error');
    }
    return;
  }
  const anchors = Array.isArray(this.levelConfig?.autoAnchors)
    ? this.levelConfig.autoAnchors
    : [];
  if (!anchors.length) {
    if (this.messageEl) {
      this.messageEl.textContent = 'No auto-lattice anchors configured for this level yet.';
    }
    return;
  }

  const tolerance = this.anchorTolerance;
  let placed = 0;
  let insufficientEnergy = false;

  for (const anchor of anchors) {
    const occupied = this.towers.some((tower) => {
      const dx = tower.normalized.x - anchor.x;
      const dy = tower.normalized.y - anchor.y;
      return Math.hypot(dx, dy) <= tolerance;
    });
    if (occupied) {
      continue;
    }
    if (this.energy < this.levelConfig.towerCost) {
      insufficientEnergy = true;
      break;
    }
    const success = this.addTowerAt(anchor, { silent: true });
    if (success) {
      placed += 1;
    }
  }

  const { total, placed: nowPlaced } = this.getAutoAnchorStatus();
  const remaining = Math.max(0, total - nowPlaced);

  if (typeof this.dependencies.notifyAutoAnchorUsed === 'function') {
    this.dependencies.notifyAutoAnchorUsed(nowPlaced, total);
  }

  if (this.audio && placed > 0) {
    this.audio.playSfx('towerPlace');
    playTowerPlacementNotes(this.audio, placed);
  }

  if (this.messageEl) {
    this.messageEl.textContent = 'Auto-lattice is disabled—drag towers from the loadout instead.';
  }
}

function updateSpeedButton() {
  if (!this.speedButton) {
    return;
  }
  const label = this.formatSpeedMultiplier(this.speedMultiplier);
  this.speedButton.textContent = `Speed ×${label}`;
  const interactive = this.isInteractiveLevelActive();
  this.speedButton.disabled = !interactive;
  this.speedButton.setAttribute('aria-disabled', interactive ? 'false' : 'true');
  this.speedButton.title = interactive
    ? 'Cycle the manual defense speed multiplier.'
    : 'Simulation speed adjusts during the interactive defense.';
}

function updateAutoAnchorButton() {
  if (!this.autoAnchorButton) {
    return;
  }

  this.autoAnchorButton.textContent = 'Loadout Placement';
  this.autoAnchorButton.disabled = true;
  this.autoAnchorButton.setAttribute('aria-disabled', 'true');
  this.autoAnchorButton.title = 'Drag towers from the loadout to lattice them on the field.';
}

function updateHud() {
  if (this.waveEl) {
    if (!this.levelConfig) {
      this.waveEl.textContent = '—';
    } else {
      if (this.isEndlessMode) {
        const displayWave = this.combatActive
          ? this.currentWaveNumber
          : Math.max(1, this.currentWaveNumber || 1);
        this.waveEl.textContent = `Wave ${displayWave}`;
      } else {
        const total = this.levelConfig.waves.length;
        const displayWave = this.combatActive
          ? this.waveIndex + 1
          : Math.min(this.waveIndex + 1, total);
        this.waveEl.textContent = `${displayWave}/${total}`;
      }
    }
  }

  if (this.healthEl) {
    if (!this.levelConfig) {
      this.healthEl.textContent = '—';
    } else {
      const currentLives = formatCombatNumber(this.lives);
      const totalLives = formatCombatNumber(this.levelConfig.lives);
      this.healthEl.textContent = `${currentLives}/${totalLives}`;
    }
  }

  if (this.energyEl) {
    if (!this.levelConfig) {
      this.energyEl.textContent = '—';
    } else if (!Number.isFinite(this.energy)) {
      this.energyEl.textContent = `∞ ${this.theroSymbol}`;
    } else {
      const energyLabel = formatCombatNumber(this.energy);
      this.energyEl.textContent = `${energyLabel} ${this.theroSymbol}`;
    }
  }

  this.updateSpeedButton();
  this.updateAutoAnchorButton();
  refreshTowerLoadoutDisplay();
  this.dependencies.updateStatusDisplays();
}

function updateProgress() {
  if (!this.progressEl) {
    return;
  }

  if (!this.levelConfig) {
    this.progressEl.textContent = 'No active level.';
    return;
  }

  if (!this.combatActive) {
    if (this.resolvedOutcome === 'victory') {
      const title = this.levelConfig.displayName || 'Defense';
      this.progressEl.textContent = `${title} stabilized—victory sealed.`;
    } else if (this.resolvedOutcome === 'defeat') {
      const waveNote = this.maxWaveReached > 0 ? ` Reached wave ${this.maxWaveReached}.` : '';
      this.progressEl.textContent = `Defense collapsed—rebuild the proof lattice.${waveNote}`;
    } else {
      const remainingMs =
        this.autoWaveEnabled && this.autoStartDeadline
          ? this.autoStartDeadline - Date.now()
          : 0;
      if (remainingMs > 0) {
        const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
        const intro = this.isEndlessMode ? 'Endless mode primed' : 'Wave prep underway';
        this.progressEl.textContent = `${intro}—auto-start in ${seconds}s.`;
      } else {
        this.progressEl.textContent = this.isEndlessMode
          ? 'Endless mode primed—auto-start will trigger after preparations.'
          : 'Wave prep underway.';
      }
    }
    return;
  }

  const total = this.levelConfig.waves.length;
  const remainingInWave = this.activeWave
    ? Math.max(0, this.activeWave.config.count - this.activeWave.spawned)
    : 0;
  const remaining = remainingInWave + this.enemies.length;
  const label = this.levelConfig.waves[this.waveIndex]?.label || 'glyphs';
  if (this.isEndlessMode) {
    this.progressEl.textContent = `Wave ${this.currentWaveNumber} — ${remaining} ${label} remaining.`;
  } else {
    const current = Math.min(this.waveIndex + 1, total);
    this.progressEl.textContent = `Wave ${current}/${total} — ${remaining} ${label} remaining.`;
  }
}

export {
  registerSlots,
  bindStartButton,
  bindSpeedButton,
  bindAutoAnchorButton,
  bindAutoWaveCheckbox,
  scheduleAutoStart,
  cancelAutoStart,
  tryAutoStart,
  createEnemyTooltip,
  enableSlots,
  disableSlots,
  autoAnchorTowers,
  updateSpeedButton,
  updateAutoAnchorButton,
  updateHud,
  updateProgress,
};
