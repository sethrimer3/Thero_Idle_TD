// Wave editor UI for developer mode level editing.
// Provides an intuitive interface for editing wave configurations with immediate compact string export.

import { ENEMY_TYPES, encodeWavesToCompact, parseCompactWaveString, validateWaveString } from './waveEncoder.js';

// Speed normalization factor for converting from 0-100 scale to 0-1 game scale
const SPEED_NORMALIZATION_FACTOR = 1000;

// Wave editor state
const waveEditorState = {
  waves: [],
  container: null,
  list: null,
  output: null,
  active: false
};

// DOM element references
const waveEditorElements = {};

// Create a short display label for enemy types using the first four letters.
function getEnemyTypeShortLabel(enemyLabel) {
  const normalized = String(enemyLabel || '').replace(/[^a-zA-Z]/g, '');
  return normalized ? normalized.slice(0, 4) : 'Type';
}

// Ensure the wave editor list has a header row describing the columns.
function ensureWaveEditorHeader() {
  if (!waveEditorElements.list) {
    return;
  }

  const existingHeader = waveEditorElements.list.querySelector('.wave-editor-item--header');
  if (existingHeader) {
    return;
  }

  const header = document.createElement('div');
  header.className = 'wave-editor-item wave-editor-item--header';
  header.setAttribute('aria-hidden', 'true');

  const columnLabels = ['Wave', 'Count', 'Type', 'HP', 'Interval', 'Delay', 'Boss', ''];
  columnLabels.forEach((text) => {
    const label = document.createElement('div');
    label.className = 'wave-editor-item__label wave-editor-item__label--header';
    label.textContent = text;
    header.appendChild(label);
  });

  waveEditorElements.list.appendChild(header);
}

// Reset the wave list UI while keeping the column header visible.
function resetWaveEditorList() {
  if (!waveEditorElements.list) {
    return;
  }

  waveEditorElements.list.innerHTML = '';
  ensureWaveEditorHeader();
}

/**
 * Initialize wave editor UI and bind event handlers.
 */
export function initializeWaveEditor() {
  waveEditorElements.section = document.getElementById('wave-editor-section');
  waveEditorElements.addButton = document.getElementById('wave-editor-add-wave');
  waveEditorElements.clearButton = document.getElementById('wave-editor-clear');
  waveEditorElements.exportButton = document.getElementById('wave-editor-export');
  waveEditorElements.importButton = document.getElementById('wave-editor-import');
  waveEditorElements.list = document.getElementById('wave-editor-list');
  waveEditorElements.output = document.getElementById('wave-editor-output');

  if (!waveEditorElements.section) {
    console.warn('Wave editor section not found in DOM');
    return false;
  }

  // Bind event handlers
  if (waveEditorElements.addButton) {
    waveEditorElements.addButton.addEventListener('click', handleAddWave);
  }

  if (waveEditorElements.clearButton) {
    waveEditorElements.clearButton.addEventListener('click', handleClearWaves);
  }

  if (waveEditorElements.exportButton) {
    waveEditorElements.exportButton.addEventListener('click', handleExportWaves);
  }

  if (waveEditorElements.importButton) {
    waveEditorElements.importButton.addEventListener('click', handleImportWaves);
  }

  // Ensure column headers are present even before any waves are added.
  ensureWaveEditorHeader();

  return true;
}

/**
 * Show wave editor section.
 */
export function showWaveEditor() {
  if (waveEditorElements.section) {
    waveEditorElements.section.hidden = false;
    waveEditorElements.section.setAttribute('aria-hidden', 'false');
    waveEditorState.active = true;
  }
}

/**
 * Hide wave editor section.
 */
export function hideWaveEditor() {
  if (waveEditorElements.section) {
    waveEditorElements.section.hidden = true;
    waveEditorElements.section.setAttribute('aria-hidden', 'true');
    waveEditorState.active = false;
  }
}

/**
 * Load waves into editor from level config or compact string.
 * @param {Array|string} waves - Wave array or compact wave string
 */
export function loadWavesIntoEditor(waves) {
  // Clear existing waves
  waveEditorState.waves = [];
  resetWaveEditorList();

  // Parse waves if string
  let waveArray = waves;
  if (typeof waves === 'string') {
    waveArray = parseCompactWaveString(waves);
  }

  if (!Array.isArray(waveArray)) {
    return;
  }

  // Add each wave to editor
  waveArray.forEach((wave) => {
    addWaveEditorRow(wave);
  });
}

/**
 * Add a new wave editing row to the editor.
 * @param {Object} waveData - Optional wave data to populate
 */
export function addWaveEditorRow(waveData = null) {
  const waveIndex = waveEditorState.waves.length;
  const waveNumber = waveIndex + 1;

  const groups = extractWaveGroups(waveData);
  if (!groups.length) {
    groups.push(createDefaultGroup());
  }

  const wave = {
    interval: Number.isFinite(waveData?.interval) ? waveData.interval : 1.5,
    delay: Number.isFinite(waveData?.delay) ? waveData.delay : 0,
    hasBoss: Boolean(waveData?.boss || waveData?.hasBoss),
    bossHp: resolveBossHp(waveData),
    groups,
    label: typeof waveData?.label === 'string' ? waveData.label : ''
  };

  waveEditorState.waves.push(wave);

  // Create row element
  const row = document.createElement('div');
  row.className = 'wave-editor-item';
  row.dataset.waveIndex = waveEditorState.waves.length - 1;

  // Wave number label
  const label = document.createElement('div');
  label.className = 'wave-editor-item__label';
  label.textContent = `W${waveNumber}`;
  row.appendChild(label);

  const primaryGroup = wave.groups[0];

  // Primary enemy count input
  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.className = 'wave-editor-item__input';
  countInput.value = primaryGroup.count;
  countInput.min = 1;
  countInput.max = 999;
  countInput.title = 'Enemy count';
  countInput.addEventListener('input', () => updateGroupData(row.dataset.waveIndex, 0, 'count', parseInt(countInput.value, 10)));
  row.appendChild(countInput);

  // Primary enemy type select
  const typeSelect = document.createElement('select');
  typeSelect.className = 'wave-editor-item__select';
  typeSelect.title = 'Enemy type';
  Object.entries(ENEMY_TYPES).forEach(([letter, data]) => {
    const option = document.createElement('option');
    option.value = letter;
    // Show the first four letters of the enemy type to keep the selector compact.
    option.textContent = getEnemyTypeShortLabel(data.label);
    option.title = data.label;
    if (letter === primaryGroup.enemyType) {
      option.selected = true;
    }
    typeSelect.appendChild(option);
  });
  typeSelect.addEventListener('change', () => updateGroupData(row.dataset.waveIndex, 0, 'enemyType', typeSelect.value));
  row.appendChild(typeSelect);

  // Primary HP input (displayed as scientific notation)
  const hpInput = document.createElement('input');
  hpInput.type = 'text';
  hpInput.className = 'wave-editor-item__input';
  hpInput.value = formatHpForInput(primaryGroup.hp);
  hpInput.title = 'HP (e.g., 1e5 or 100000)';
  hpInput.addEventListener('input', () => updateGroupData(row.dataset.waveIndex, 0, 'hp', parseHpFromInput(hpInput.value)));
  hpInput.addEventListener('blur', () => {
    const currentWave = waveEditorState.waves[row.dataset.waveIndex];
    const group = currentWave?.groups?.[0];
    hpInput.value = formatHpForInput(group?.hp);
  });
  row.appendChild(hpInput);

  // Interval input
  const intervalInput = document.createElement('input');
  intervalInput.type = 'number';
  intervalInput.className = 'wave-editor-item__input';
  intervalInput.value = wave.interval;
  intervalInput.min = 0.1;
  intervalInput.max = 10;
  intervalInput.step = 0.1;
  intervalInput.title = 'Spawn interval (seconds)';
  intervalInput.addEventListener('input', () => updateWaveData(row.dataset.waveIndex, 'interval', parseFloat(intervalInput.value)));
  row.appendChild(intervalInput);

  // Delay input
  const delayInput = document.createElement('input');
  delayInput.type = 'number';
  delayInput.className = 'wave-editor-item__input';
  delayInput.value = wave.delay;
  delayInput.min = 0;
  delayInput.max = 60;
  delayInput.step = 0.1;
  delayInput.title = 'Pre-wave delay (seconds)';
  delayInput.addEventListener('input', () => updateWaveData(row.dataset.waveIndex, 'delay', parseFloat(delayInput.value)));
  row.appendChild(delayInput);

  // Boss toggle
  const bossCheckbox = document.createElement('input');
  bossCheckbox.type = 'checkbox';
  bossCheckbox.className = 'wave-editor-item__checkbox';
  bossCheckbox.checked = wave.hasBoss;
  bossCheckbox.title = 'Enable boss';
  bossCheckbox.addEventListener('change', () => {
    updateWaveData(row.dataset.waveIndex, 'hasBoss', bossCheckbox.checked);
    if (bossCheckbox.checked) {
      ensureBossHp(row.dataset.waveIndex);
    }
    updateBossControls(row, bossCheckbox.checked);
  });
  row.appendChild(bossCheckbox);

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'wave-editor-item__delete';
  deleteBtn.textContent = '×';
  deleteBtn.title = 'Delete wave';
  deleteBtn.addEventListener('click', () => removeWaveEditorRow(row.dataset.waveIndex));
  row.appendChild(deleteBtn);

  // Additional enemy groups
  const groupContainer = document.createElement('div');
  groupContainer.className = 'wave-editor-item__group-container';
  if (wave.groups.length > 1) {
    for (let index = 1; index < wave.groups.length; index += 1) {
      groupContainer.appendChild(createAdditionalGroupRow(row.dataset.waveIndex, index, wave.groups[index]));
    }
  }

  const addEnemyButton = document.createElement('button');
  addEnemyButton.type = 'button';
  addEnemyButton.className = 'wave-editor-item__add-group';
  addEnemyButton.textContent = 'Add Enemy';
  addEnemyButton.title = 'Add another enemy type to this wave';
  addEnemyButton.addEventListener('click', () => handleAddEnemyGroup(row.dataset.waveIndex));
  groupContainer.appendChild(addEnemyButton);
  row.appendChild(groupContainer);

  // Boss HP controls (conditionally visible)
  if (wave.hasBoss) {
    addBossControls(row, wave.bossHp);
  }

  // Add to list
  if (waveEditorElements.list) {
    waveEditorElements.list.appendChild(row);
  }
}

/**
 * Add boss HP controls to a wave row.
 * @param {HTMLElement} row - Wave row element
 * @param {number} bossHp - Boss HP value
 */
function addBossControls(row, bossHp) {
  // Check if boss controls already exist
  let bossControls = row.querySelector('.wave-editor-item__boss-controls');
  if (bossControls) {
    return;
  }

  bossControls = document.createElement('div');
  bossControls.className = 'wave-editor-item__boss-controls';

  const bossLabel = document.createElement('div');
  bossLabel.className = 'wave-editor-item__label';
  bossLabel.textContent = 'Boss HP:';
  bossLabel.style.textAlign = 'left';
  bossControls.appendChild(bossLabel);

  const bossHpInput = document.createElement('input');
  bossHpInput.type = 'text';
  bossHpInput.className = 'wave-editor-item__input';
  bossHpInput.value = formatHpForInput(bossHp);
  bossHpInput.title = 'Boss HP (e.g., 1e8 or 100000000)';
  bossHpInput.addEventListener('input', () => updateWaveData(row.dataset.waveIndex, 'bossHp', parseHpFromInput(bossHpInput.value)));
  bossHpInput.addEventListener('blur', () => {
    const wave = waveEditorState.waves[row.dataset.waveIndex];
    if (wave) {
      bossHpInput.value = formatHpForInput(wave.bossHp);
    }
  });
  bossControls.appendChild(bossHpInput);

  row.appendChild(bossControls);
}

/**
 * Build an additional enemy group row for a wave entry.
 * @param {string|number} waveIndex - Parent wave index
 * @param {string|number} groupIndex - Group index inside the wave
 * @param {Object} groupData - Group configuration snapshot
 * @returns {HTMLElement} Configured row element
 */
function createAdditionalGroupRow(waveIndex, groupIndex, groupData) {
  const row = document.createElement('div');
  row.className = 'wave-editor-item__group-row';
  row.dataset.waveIndex = String(waveIndex);
  row.dataset.groupIndex = String(groupIndex);

  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.className = 'wave-editor-item__input';
  countInput.value = groupData.count;
  countInput.min = 1;
  countInput.max = 999;
  countInput.title = 'Enemy count';
  countInput.addEventListener('input', () => updateGroupData(waveIndex, groupIndex, 'count', parseInt(countInput.value, 10)));
  row.appendChild(countInput);

  const typeSelect = document.createElement('select');
  typeSelect.className = 'wave-editor-item__select';
  typeSelect.title = 'Enemy type';
  Object.entries(ENEMY_TYPES).forEach(([letter, data]) => {
    const option = document.createElement('option');
    option.value = letter;
    // Show the first four letters of the enemy type to keep the selector compact.
    option.textContent = getEnemyTypeShortLabel(data.label);
    option.title = data.label;
    if (letter === groupData.enemyType) {
      option.selected = true;
    }
    typeSelect.appendChild(option);
  });
  typeSelect.addEventListener('change', () => updateGroupData(waveIndex, groupIndex, 'enemyType', typeSelect.value));
  row.appendChild(typeSelect);

  const hpInput = document.createElement('input');
  hpInput.type = 'text';
  hpInput.className = 'wave-editor-item__input';
  hpInput.value = formatHpForInput(groupData.hp);
  hpInput.title = 'HP (e.g., 1e5 or 100000)';
  hpInput.addEventListener('input', () => updateGroupData(waveIndex, groupIndex, 'hp', parseHpFromInput(hpInput.value)));
  hpInput.addEventListener('blur', () => {
    const wave = waveEditorState.waves[parseInt(waveIndex, 10)];
    const group = wave?.groups?.[parseInt(groupIndex, 10)];
    hpInput.value = formatHpForInput(group?.hp);
  });
  row.appendChild(hpInput);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'wave-editor-item__delete wave-editor-item__group-delete';
  removeBtn.textContent = '×';
  removeBtn.title = 'Remove enemy';
  removeBtn.addEventListener('click', () => handleRemoveEnemyGroup(waveIndex, groupIndex));
  row.appendChild(removeBtn);

  return row;
}

/**
 * Update visibility of boss controls based on checkbox.
 * @param {HTMLElement} row - Wave row element
 * @param {boolean} visible - Show or hide boss controls
 */
function updateBossControls(row, visible) {
  const bossControls = row.querySelector('.wave-editor-item__boss-controls');

  if (visible && !bossControls) {
    const wave = waveEditorState.waves[row.dataset.waveIndex];
    addBossControls(row, wave?.bossHp || 1000);
  } else if (!visible && bossControls) {
    bossControls.remove();
  }
}

/**
 * Ensure a wave has a valid boss HP when enabling the boss toggle.
 * @param {string|number} waveIndex - Wave index to normalize
 */
function ensureBossHp(waveIndex) {
  const idx = parseInt(waveIndex, 10);
  if (isNaN(idx) || idx < 0 || idx >= waveEditorState.waves.length) {
    return;
  }
  const wave = waveEditorState.waves[idx];
  if (!wave) {
    return;
  }
  const current = Number.isFinite(wave.bossHp) ? Math.max(1, wave.bossHp) : null;
  if (current) {
    wave.bossHp = current;
    return;
  }
  const fallbackGroup = Array.isArray(wave.groups) && wave.groups.length
    ? wave.groups[wave.groups.length - 1]
    : null;
  const fallbackHp = Number.isFinite(fallbackGroup?.hp) ? fallbackGroup.hp * 5 : 1000;
  wave.bossHp = Math.max(1, fallbackHp);
}

/**
 * Append a new enemy group to the specified wave and rebuild the editor UI.
 * @param {string|number} waveIndex - Wave index to update
 */
function handleAddEnemyGroup(waveIndex) {
  const idx = parseInt(waveIndex, 10);
  if (isNaN(idx) || idx < 0 || idx >= waveEditorState.waves.length) {
    return;
  }
  const wave = waveEditorState.waves[idx];
  if (!wave) {
    return;
  }
  const lastGroup = Array.isArray(wave.groups) && wave.groups.length
    ? wave.groups[wave.groups.length - 1]
    : null;
  const newGroup = createDefaultGroup({
    enemyType: lastGroup?.enemyType || 'A',
    count: lastGroup?.count || 5,
    hp: lastGroup?.hp || 100,
  });
  if (!Array.isArray(wave.groups)) {
    wave.groups = [];
  }
  wave.groups.push(newGroup);
  rebuildWaveEditorList();
}

/**
 * Remove an enemy group from a wave when multiple groups are configured.
 * @param {string|number} waveIndex - Wave index to update
 * @param {string|number} groupIndex - Group index to remove
 */
function handleRemoveEnemyGroup(waveIndex, groupIndex) {
  const waveIdx = parseInt(waveIndex, 10);
  const groupIdx = parseInt(groupIndex, 10);
  if (
    isNaN(waveIdx) || waveIdx < 0 || waveIdx >= waveEditorState.waves.length ||
    isNaN(groupIdx)
  ) {
    return;
  }
  const wave = waveEditorState.waves[waveIdx];
  if (!wave || !Array.isArray(wave.groups) || wave.groups.length <= 1) {
    return;
  }
  if (groupIdx < 0 || groupIdx >= wave.groups.length) {
    return;
  }
  wave.groups.splice(groupIdx, 1);
  rebuildWaveEditorList();
}

/**
 * Rebuild the wave editor list and normalize state indexes after mutations.
 */
function rebuildWaveEditorList() {
  if (!waveEditorElements.list) {
    return;
  }

  const existingWaves = waveEditorState.waves.map((wave) => ({
    ...wave,
    groups: Array.isArray(wave.groups)
      ? wave.groups.map((group) => ({ ...group }))
      : []
  }));
  waveEditorState.waves = [];
  resetWaveEditorList();

  existingWaves.forEach((wave) => {
    addWaveEditorRow(wave);
  });
}

/**
 * Remove a wave row from the editor.
 * @param {number} index - Wave index to remove
 */
export function removeWaveEditorRow(index) {
  const idx = parseInt(index, 10);
  if (isNaN(idx) || idx < 0 || idx >= waveEditorState.waves.length) {
    return;
  }

  // Remove from state
  waveEditorState.waves.splice(idx, 1);

  rebuildWaveEditorList();
}

/**
 * Update wave data in state.
 * @param {string|number} index - Wave index
 * @param {string} field - Field to update
 * @param {*} value - New value
 */
function updateWaveData(index, field, value) {
  const idx = parseInt(index, 10);
  if (isNaN(idx) || idx < 0 || idx >= waveEditorState.waves.length) {
    return;
  }

  const wave = waveEditorState.waves[idx];
  if (!wave) {
    return;
  }

  if (field === 'interval') {
    const parsed = Number.parseFloat(value);
    wave.interval = Number.isFinite(parsed) ? Math.max(0.1, parsed) : wave.interval;
    return;
  }

  if (field === 'delay') {
    const parsed = Number.parseFloat(value);
    wave.delay = Number.isFinite(parsed) ? Math.max(0, parsed) : wave.delay;
    return;
  }

  if (field === 'hasBoss') {
    wave.hasBoss = Boolean(value);
    return;
  }

  if (field === 'bossHp') {
    const parsed = Number.parseFloat(value);
    wave.bossHp = Number.isFinite(parsed) ? Math.max(1, parsed) : wave.bossHp;
  }
}

/**
 * Update a nested enemy group property for the specified wave entry.
 * @param {string|number} waveIndex - Index of the parent wave
 * @param {string|number} groupIndex - Index of the enemy group to update
 * @param {string} field - Group field to mutate (count, enemyType, hp)
 * @param {*} value - New value for the field
 */
function updateGroupData(waveIndex, groupIndex, field, value) {
  const waveIdx = parseInt(waveIndex, 10);
  const groupIdx = parseInt(groupIndex, 10);
  if (
    isNaN(waveIdx) || waveIdx < 0 || waveIdx >= waveEditorState.waves.length ||
    isNaN(groupIdx)
  ) {
    return;
  }

  const wave = waveEditorState.waves[waveIdx];
  if (!wave || !Array.isArray(wave.groups) || groupIdx < 0 || groupIdx >= wave.groups.length) {
    return;
  }

  const group = wave.groups[groupIdx];
  if (!group) {
    return;
  }

  if (field === 'count') {
    const parsed = parseInt(value, 10);
    group.count = Number.isFinite(parsed) ? Math.max(1, parsed) : group.count;
    return;
  }

  if (field === 'hp') {
    const parsed = Number.parseFloat(value);
    group.hp = Number.isFinite(parsed) ? Math.max(0, parsed) : group.hp;
    return;
  }

  if (field === 'enemyType') {
    const resolved = resolveEnemyTypeLetter({ enemyType: value }, group.enemyType);
    group.enemyType = resolved;
  }
}

/**
 * Handle add wave button click.
 */
function handleAddWave() {
  addWaveEditorRow();
}

/**
 * Handle clear waves button click.
 */
function handleClearWaves() {
  if (waveEditorState.waves.length === 0) {
    return;
  }

  if (!confirm('Clear all waves? This cannot be undone.')) {
    return;
  }

  waveEditorState.waves = [];
  resetWaveEditorList();

  if (waveEditorElements.output) {
    waveEditorElements.output.value = '';
  }
}

/**
 * Handle export waves button click.
 */
function handleExportWaves() {
  const compactString = exportWavesFromEditor();
  
  if (waveEditorElements.output) {
    waveEditorElements.output.value = compactString;
  }

  // Copy to clipboard
  if (navigator.clipboard && compactString) {
    navigator.clipboard.writeText(compactString).then(() => {
      console.log('Wave string copied to clipboard');
    }).catch((err) => {
      console.warn('Failed to copy to clipboard:', err);
    });
  }
}

/**
 * Handle import waves button click.
 */
function handleImportWaves() {
  const waveString = prompt('Enter compact wave string:');
  
  if (!waveString) {
    return;
  }

  const validation = validateWaveString(waveString);
  if (!validation.valid) {
    alert('Invalid wave string:\n\n' + validation.errors.join('\n'));
    return;
  }

  importWaveStringToEditor(waveString);
}

/**
 * Export waves from editor to compact format.
 * @returns {string} Compact wave string
 */
export function exportWavesFromEditor() {
  if (waveEditorState.waves.length === 0) {
    return '';
  }

  // Convert internal wave format to verbose format for encoding
  const verboseWaves = waveEditorState.waves.map((wave) => {
    const groups = Array.isArray(wave.groups) ? wave.groups : [];

    const verboseGroups = groups
      .map((group) => {
        const enemyType = resolveEnemyTypeLetter(group, 'A');
        const enemyData = ENEMY_TYPES[enemyType];
        if (!enemyData) {
          return null;
        }
        const count = Number.isFinite(group.count) ? Math.max(1, Math.floor(group.count)) : 1;
        const hp = Number.isFinite(group.hp) ? Math.max(0, group.hp) : 0;
        const speed = enemyData.speed / SPEED_NORMALIZATION_FACTOR;
        return {
          count,
          hp,
          speed,
          reward: hp * 0.1,
          color: enemyData.color,
          codexId: enemyData.id,
          label: enemyData.label,
          enemyType,
          symbol: enemyType,
        };
      })
      .filter(Boolean);

    if (!verboseGroups.length) {
      return null;
    }

    const totalMinions = verboseGroups.reduce((sum, group) => sum + group.count, 0);
    const primaryGroup = verboseGroups[0];

    const verboseWave = {
      count: totalMinions + (wave.hasBoss ? 1 : 0),
      interval: Number.isFinite(wave.interval) ? Math.max(0.1, wave.interval) : 1.5,
      hp: primaryGroup.hp,
      speed: primaryGroup.speed,
      reward: primaryGroup.reward,
      color: primaryGroup.color,
      codexId: primaryGroup.codexId,
      label: primaryGroup.label,
      enemyGroups: verboseGroups.map((group) => ({ ...group })),
      minionCount: totalMinions,
    };

    if (wave.delay && wave.delay > 0) {
      verboseWave.delay = wave.delay;
    }

    if (wave.hasBoss && wave.bossHp) {
      const bossHp = Math.max(1, wave.bossHp);
      verboseWave.boss = {
        label: `Boss ${primaryGroup.label}`,
        hp: bossHp,
        speed: primaryGroup.speed * 0.5,
        reward: bossHp * 0.15,
        color: primaryGroup.color,
        symbol: primaryGroup.enemyType || primaryGroup.symbol || '◈',
      };
    }

    return verboseWave;
  }).filter(Boolean);

  return encodeWavesToCompact(verboseWaves);
}

/**
 * Import wave string into editor.
 * @param {string} waveString - Compact wave string
 */
export function importWaveStringToEditor(waveString) {
  loadWavesIntoEditor(waveString);
  
  // Update output
  if (waveEditorElements.output) {
    waveEditorElements.output.value = waveString;
  }
}

/**
 * Sync wave editor with current level.
 * @param {Object} level - Level object
 */
export function syncWaveEditorWithLevel(level) {
  if (!level || !waveEditorState.active) {
    return;
  }

  const waves = level.waves;
  if (waves) {
    loadWavesIntoEditor(waves);
  }
}

/**
 * Get enemy type letter from codexId.
 * @param {string} codexId - Enemy codex ID
 * @returns {string|null} Enemy type letter
 */
function getEnemyTypeFromCodexId(codexId) {
  if (!codexId) {
    return null;
  }

  for (const [letter, data] of Object.entries(ENEMY_TYPES)) {
    if (data.id === codexId) {
      return letter;
    }
  }

  return null;
}

/**
 * Resolve the preferred enemy type letter from any source object.
 * Prefers explicit editor data, then codex identifiers, and finally a fallback letter.
 * @param {Object|null} source - Wave or group configuration source
 * @param {string} fallback - Fallback enemy type when no explicit match is found
 * @returns {string} Enemy type letter
 */
function resolveEnemyTypeLetter(source, fallback = 'A') {
  if (source?.enemyType) {
    const candidate = String(source.enemyType).toUpperCase();
    if (ENEMY_TYPES[candidate]) {
      return candidate;
    }
  }

  if (source?.symbol) {
    const candidate = String(source.symbol).toUpperCase();
    if (ENEMY_TYPES[candidate]) {
      return candidate;
    }
  }

  const fromCodex = getEnemyTypeFromCodexId(source?.codexId);
  if (fromCodex && ENEMY_TYPES[fromCodex]) {
    return fromCodex;
  }

  const normalizedFallback = String(fallback || 'A').toUpperCase();
  if (ENEMY_TYPES[normalizedFallback]) {
    return normalizedFallback;
  }

  return 'A';
}

/**
 * Create a normalized enemy group object for editor state.
 * @param {Object} overrides - Optional overrides for default values
 * @returns {Object} Enemy group configuration
 */
function createDefaultGroup(overrides = {}) {
  const enemyType = resolveEnemyTypeLetter(overrides, 'A');
  const count = Number.isFinite(overrides.count) ? Math.max(1, Math.floor(overrides.count)) : 10;
  const hp = Number.isFinite(overrides.hp) ? Math.max(0, overrides.hp) : 100;
  return { count, enemyType, hp };
}

/**
 * Derive normalized enemy group definitions from existing wave data.
 * @param {Object|null} waveData - Source wave configuration
 * @returns {Array} Array of normalized enemy group objects
 */
function extractWaveGroups(waveData) {
  const fallbackType = resolveEnemyTypeLetter(waveData, 'A');
  const groups = Array.isArray(waveData?.enemyGroups) && waveData.enemyGroups.length
    ? waveData.enemyGroups
    : Array.isArray(waveData?.groups) && waveData.groups.length
      ? waveData.groups
      : null;
  if (Array.isArray(groups) && groups.length) {
    // Support both decoded wave data and the editor's in-memory `groups` structure.
    return groups
      .map((group) => {
        const count = Number.isFinite(group?.count) ? Math.max(1, Math.floor(group.count)) : 10;
        const hp = Number.isFinite(group?.hp)
          ? Math.max(0, group.hp)
          : Number.isFinite(waveData?.hp)
            ? Math.max(0, waveData.hp)
            : 100;
        const enemyType = resolveEnemyTypeLetter(group, fallbackType);
        return { count, enemyType, hp };
      })
      .filter(Boolean);
  }

  const minionCount = Number.isFinite(waveData?.minionCount)
    ? Math.max(1, Math.floor(waveData.minionCount))
    : Number.isFinite(waveData?.count)
      ? Math.max(1, Math.floor(waveData.count - (waveData?.boss ? 1 : 0)))
      : 10;
  const hp = Number.isFinite(waveData?.hp) ? Math.max(0, waveData.hp) : 100;
  return [createDefaultGroup({ count: minionCount, hp, enemyType: fallbackType })];
}

/**
 * Resolve the best boss HP default from existing wave data.
 * @param {Object|null} waveData - Source wave configuration
 * @returns {number} Boss HP value
 */
function resolveBossHp(waveData) {
  if (Number.isFinite(waveData?.boss?.hp)) {
    return Math.max(1, waveData.boss.hp);
  }
  if (Number.isFinite(waveData?.bossHp)) {
    return Math.max(1, waveData.bossHp);
  }
  if (Number.isFinite(waveData?.hp)) {
    return Math.max(1, waveData.hp * 10);
  }
  return 1000;
}

/**
 * Format HP value for input display (scientific notation).
 * @param {number} hp - HP value
 * @returns {string} Formatted HP string
 */
function formatHpForInput(hp) {
  if (!hp || hp === 0) {
    return '0';
  }

  // Use Math.log with LN10 for broader browser compatibility
  const exponent = Math.floor(Math.log(Math.abs(hp)) / Math.LN10);
  if (exponent < 3) {
    return String(hp);
  }

  const mantissa = hp / Math.pow(10, exponent);
  const roundedMantissa = Math.round(mantissa * 100) / 100;
  return `${roundedMantissa}e${exponent}`;
}

/**
 * Parse HP value from input (supports scientific notation).
 * @param {string} value - Input value
 * @returns {number} Parsed HP value
 */
function parseHpFromInput(value) {
  if (!value) {
    return 0;
  }

  // Try scientific notation first
  const scientificMatch = value.match(/^(\d+(?:\.\d+)?)\s*[eE]\s*(\d+)$/);
  if (scientificMatch) {
    const mantissa = parseFloat(scientificMatch[1]);
    const exponent = parseInt(scientificMatch[2], 10);
    return mantissa * Math.pow(10, exponent);
  }

  // Fall back to regular number parsing
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}
