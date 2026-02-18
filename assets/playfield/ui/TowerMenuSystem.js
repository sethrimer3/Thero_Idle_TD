/**
 * Tower Menu System - Radial command menu for tower management
 * 
 * Responsibilities:
 * - Build menu options (upgrade, sell, info, targeting priority, behavior modes)
 * - Calculate menu geometry and layout in world space
 * - Handle menu clicks and option selection
 * - Execute menu commands (upgrade, sell, configure, info display)
 * - Manage menu state (open/close, animations, active tower tracking)
 * 
 * Extracted from playfield.js as part of Phase 1 refactoring (Build 469).
 */

import { getNextTowerId, getTowerDefinition, openTowerUpgradeOverlay } from '../../towersTab.js';
import { formatCombatNumber } from '../utils/formatting.js';
import { HALF_PI, TWO_PI } from '../constants.js';

/**
 * Factory function for creating a tower menu system instance.
 * 
 * @param {Object} playfield - Playfield instance for accessing state and methods
 * @returns {Object} Tower menu system interface
 */
export function createTowerMenuSystem(playfield) {
  /**
   * Locate the currently selected tower so option clicks can mutate its settings.
   */
  function getActiveMenuTower() {
    if (!playfield.activeTowerMenu?.towerId) {
      return null;
    }
    const tower = playfield.towers.find((candidate) => candidate?.id === playfield.activeTowerMenu.towerId);
    if (!tower) {
      playfield.activeTowerMenu = null;
      playfield.towerMenuExitAnimation = null;
    }
    return tower || null;
  }

  /**
   * Present the radial command menu for the supplied tower.
   */
  function openTowerMenu(tower, options = {}) {
    if (!tower) {
      return;
    }
    const timestamp =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    playfield.activeTowerMenu = {
      towerId: tower.id,
      openedAt: timestamp,
      anchor: { x: tower.x, y: tower.y },
      geometrySnapshot: null,
    };
    // Opening a fresh lattice menu cancels any lingering dismissal animation.
    playfield.towerMenuExitAnimation = null;
    if (playfield.messageEl && !options.silent) {
      const label = tower.definition?.name || `${tower.symbol || 'Tower'}`;
      playfield.messageEl.textContent = `${label} command lattice ready.`;
    }
  }

  /**
   * Hide any open radial tower menu.
   */
  function closeTowerMenu() {
    const currentMenu = playfield.activeTowerMenu;
    if (!currentMenu) {
      playfield.towerMenuExitAnimation = null;
      playfield.activeTowerMenu = null;
      return;
    }
    const timestamp = playfield.getCurrentTimestamp();
    const tower = getActiveMenuTower();
    const geometry = tower ? getTowerMenuGeometry(tower) : currentMenu.geometrySnapshot || null;
    const anchor = tower
      ? { x: tower.x, y: tower.y }
      : currentMenu.anchor
      ? { x: currentMenu.anchor.x, y: currentMenu.anchor.y }
      : null;
    if (
      geometry &&
      anchor &&
      Number.isFinite(geometry.optionRadius) &&
      Number.isFinite(geometry.ringRadius) &&
      Array.isArray(geometry.options) &&
      geometry.options.length
    ) {
      // Snapshot the current lattice layout so the renderer can animate the dismissal even after the tower reference clears.
      playfield.towerMenuExitAnimation = {
        anchor,
        startedAt: timestamp,
        optionRadius: geometry.optionRadius,
        ringRadius: geometry.ringRadius,
        options: geometry.options.map((option) => ({
          angle: option.angle,
          icon: option.icon,
          costLabel: option.costLabel,
          selected: option.selected,
          disabled: option.disabled,
        })),
      };
    } else {
      playfield.towerMenuExitAnimation = null;
    }
    playfield.activeTowerMenu = null;
  }

  /**
   * Generate option metadata for the active tower menu.
   */
  function buildTowerMenuOptions(tower) {
    if (!tower) {
      return [];
    }
    const options = [];
    const nextId = getNextTowerId(tower.type);
    const nextDefinition = nextId ? getTowerDefinition(nextId) : null;
    const upgradeCost = nextDefinition ? playfield.getCurrentTowerCost(nextDefinition.id) : 0;
    const upgradeAffordable = nextDefinition ? playfield.energy >= upgradeCost : false;
    const upgradeCostLabel = nextDefinition
      ? `${formatCombatNumber(Math.max(0, upgradeCost))} ${playfield.theroSymbol}`
      : '—';
    // Surface an upgrade command that mirrors the merge flow and displays the next tier cost inside the radial lattice.
    options.push({
      id: 'upgrade',
      type: 'upgrade',
      icon: nextDefinition?.symbol || '·',
      label: nextDefinition ? `Upgrade to ${nextDefinition.symbol}` : 'Upgrade unavailable',
      costLabel: upgradeCostLabel,
      disabled: !nextDefinition || !upgradeAffordable,
      upgradeCost,
      nextTowerId: nextDefinition?.id || null,
    });
    options.push({
      id: 'sell',
      type: 'action',
      icon: '$þ',
      label: 'Sell lattice',
    });
    // Surface the tower dossier overlay entry point directly inside the radial menu.
    options.push({
      id: 'info',
      type: 'info',
      icon: 'ℹ',
      label: 'Tower information',
    });
    const priority = tower.targetPriority || 'first';
    options.push({
      id: 'priority-first',
      type: 'priority',
      value: 'first',
      icon: '1st',
      label: 'First priority',
      selected: priority === 'first',
    });
    options.push({
      id: 'priority-strongest',
      type: 'priority',
      value: 'strongest',
      icon: 'Str',
      label: 'Strongest priority',
      selected: priority === 'strongest',
    });
    options.push({
      id: 'priority-weakest',
      type: 'priority',
      value: 'weakest',
      icon: 'Wk',
      label: 'Weakest priority',
      selected: priority === 'weakest',
    });
    if (tower.type === 'delta') {
      const mode = tower.behaviorMode || 'pursuit';
      options.push({
        id: 'delta-pursuit',
        type: 'mode',
        value: 'pursuit',
        icon: 'Δ→',
        label: 'Pursue target',
        selected: mode === 'pursuit',
      });
      options.push({
        id: 'delta-track',
        type: 'mode',
        value: 'trackHold',
        icon: 'Δ∥',
        label: 'Hold track',
        selected: mode === 'trackHold',
      });
      options.push({
        id: 'delta-guard',
        type: 'mode',
        value: 'sentinel',
        icon: 'Δ◎',
        label: 'Guard tower',
        selected: mode === 'sentinel',
      });
    }
    return options;
  }

  /**
   * Compute the world-space layout for the radial menu options.
   */
  function getTowerMenuGeometry(tower) {
    const options = buildTowerMenuOptions(tower);
    if (!tower || !options.length) {
      return null;
    }
    const minDimension = Math.min(playfield.renderWidth || 0, playfield.renderHeight || 0) || 1;
    const optionRadius = Math.max(22, minDimension * 0.04);
    const ringRadius = Math.max(optionRadius * 2.4, minDimension * 0.12);
    const startAngle = -HALF_PI;
    const angleStep = TWO_PI / options.length;
    const layout = options.map((option, index) => {
      const angle = startAngle + index * angleStep;
      return {
        ...option,
        angle,
        center: {
          x: tower.x + Math.cos(angle) * ringRadius,
          y: tower.y + Math.sin(angle) * ringRadius,
        },
      };
    });
    return { options: layout, optionRadius, ringRadius };
  }

  /**
   * Handle clicks on the radial tower command menu.
   */
  function handleTowerMenuClick(position) {
    const tower = getActiveMenuTower();
    if (!tower) {
      return false;
    }
    const geometry = getTowerMenuGeometry(tower);
    if (!geometry) {
      return false;
    }
    const { options, optionRadius } = geometry;
    const hitRadius = optionRadius * 1.1;
    for (let index = 0; index < options.length; index += 1) {
      const option = options[index];
      const dx = position.x - option.center.x;
      const dy = position.y - option.center.y;
      const distance = Math.hypot(dx, dy);
      if (distance > hitRadius) {
        continue;
      }
      executeTowerMenuOption(tower, option);
      return true;
    }
    return false;
  }

  /**
   * Apply the effect of a selected tower option.
   */
  function executeTowerMenuOption(tower, option) {
    if (!tower || !option) {
      return;
    }
    if (option.type === 'upgrade') {
      // Route upgrade taps through the merge routine so single-tower ascensions mirror drag-and-drop merges.
      playfield.upgradeTowerTier(tower, {
        silent: Boolean(option.silent),
        expectedNextId: option.nextTowerId || null,
        quotedCost: Number.isFinite(option.upgradeCost) ? option.upgradeCost : null,
      });
      return;
    }
    if (option.type === 'action' && option.id === 'sell') {
      playfield.sellTower(tower);
      return;
    }
    if (option.type === 'info') {
      // Route the command to the tower overlay so players can review formulas mid-combat.
      if (tower?.type) {
        const contextTowers = playfield.towers
          .map((candidate) => ({
            id: candidate?.id,
            type: candidate?.type,
            x: candidate?.x,
            y: candidate?.y,
            range: candidate?.range,
            connections: candidate?.linkTargetId ? [candidate.linkTargetId] : [],
            sources: candidate?.linkSources instanceof Set ? Array.from(candidate.linkSources) : [],
            prestige: candidate?.prestige === true || candidate?.isPrestigeSigma === true,
            nuKills: candidate?.nuState?.kills,
            nuOverkillTotal: candidate?.nuState?.overkillDamageTotal,
          }))
          .filter((entry) => entry.id && Number.isFinite(entry.x) && Number.isFinite(entry.y));
        openTowerUpgradeOverlay(tower.type, {
          contextTowerId: tower.id,
          contextTower: {
            id: tower.id,
            type: tower.type,
            x: tower.x,
            y: tower.y,
            range: tower.range,
            connections: tower.linkTargetId ? [tower.linkTargetId] : [],
            sources: tower.linkSources instanceof Set ? Array.from(tower.linkSources) : [],
            prestige: tower?.prestige === true || tower?.isPrestigeSigma === true,
            nuKills: tower?.nuState?.kills,
            nuOverkillTotal: tower?.nuState?.overkillDamageTotal,
          },
          contextTowers,
          unspentThero: playfield.energy,
        });
      }
      if (playfield.messageEl) {
        const label = tower.definition?.name || `${tower.symbol || 'Tower'}`;
        playfield.messageEl.textContent = `${label} dossier projected over the field.`;
      }
      closeTowerMenu();
      return;
    }
    if (option.type === 'priority' && option.value) {
      if (tower.targetPriority !== option.value) {
        tower.targetPriority = option.value;
        if (playfield.messageEl) {
          const descriptor =
            option.value === 'strongest'
              ? 'strongest'
              : option.value === 'weakest'
                ? 'weakest'
                : 'first';
          playfield.messageEl.textContent = `Target priority set to ${descriptor}.`;
        }
      }
      openTowerMenu(tower, { silent: true });
      return;
    }
    if (option.type === 'mode' && tower.type === 'delta' && option.value) {
      if (tower.behaviorMode !== option.value) {
        playfield.configureDeltaBehavior(tower, option.value);
        if (playfield.messageEl) {
          const descriptor =
            option.value === 'trackHold'
              ? 'Holding the glyph lane.'
              : option.value === 'sentinel'
              ? 'Guarding the lattice.'
              : 'Pursuing threats.';
          playfield.messageEl.textContent = `Δ cohort stance updated—${descriptor}`;
        }
      }
      openTowerMenu(tower, { silent: true });
    }
  }

  /**
   * Allow the player to mark a manual target for sentry mode Delta soldiers.
   */
  function handleTowerMenuEnemySelection(tower, enemy) {
    if (!tower || tower.type !== 'delta' || tower.behaviorMode !== 'sentinel' || !enemy) {
      return false;
    }
    const state = playfield.ensureDeltaState(tower);
    if (!state) {
      return false;
    }
    state.manualTargetId = enemy.id;
    if (playfield.messageEl) {
      const label = enemy.label || playfield.resolveEnemySymbol(enemy) || 'glyph';
      playfield.messageEl.textContent = `Δ cohort assigned to ${label}.`;
    }
    openTowerMenu(tower, { silent: true });
    return true;
  }

  return {
    getActiveMenuTower,
    openTowerMenu,
    closeTowerMenu,
    buildTowerMenuOptions,
    getTowerMenuGeometry,
    handleTowerMenuClick,
    executeTowerMenuOption,
    handleTowerMenuEnemySelection,
  };
}
