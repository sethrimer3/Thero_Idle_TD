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
  if (waveEditorElements.list) {
    waveEditorElements.list.innerHTML = '';
  }

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

  const resolvedEnemyType = resolveEnemyTypeFromWaveData(waveData);

  // Default wave data
  const wave = {
    count: waveData?.count || 10,
    enemyType: resolvedEnemyType,
    hp: waveData?.hp || 100,
    interval: waveData?.interval || 1.5,
    delay: waveData?.delay || 0,
    hasBoss: !!(waveData?.boss),
    bossHp: waveData?.boss?.hp || 1000
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

  // Enemy count input
  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.className = 'wave-editor-item__input';
  countInput.value = wave.count;
  countInput.min = 1;
  countInput.max = 999;
  countInput.title = 'Enemy count';
  countInput.addEventListener('input', () => updateWaveData(row.dataset.waveIndex, 'count', parseInt(countInput.value, 10)));
  row.appendChild(countInput);

  // Enemy type select
  const typeSelect = document.createElement('select');
  typeSelect.className = 'wave-editor-item__select';
  typeSelect.title = 'Enemy type';
  Object.entries(ENEMY_TYPES).forEach(([letter, data]) => {
    const option = document.createElement('option');
    option.value = letter;
    option.textContent = letter;
    option.title = data.label;
    if (letter === wave.enemyType) {
      option.selected = true;
    }
    typeSelect.appendChild(option);
  });
  typeSelect.addEventListener('change', () => updateWaveData(row.dataset.waveIndex, 'enemyType', typeSelect.value));
  row.appendChild(typeSelect);

  // HP input (displayed as scientific notation)
  const hpInput = document.createElement('input');
  hpInput.type = 'text';
  hpInput.className = 'wave-editor-item__input';
  hpInput.value = formatHpForInput(wave.hp);
  hpInput.title = 'HP (e.g., 1e5 or 100000)';
  hpInput.addEventListener('input', () => updateWaveData(row.dataset.waveIndex, 'hp', parseHpFromInput(hpInput.value)));
  hpInput.addEventListener('blur', () => hpInput.value = formatHpForInput(wave.hp));
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
 * Rebuild the wave editor list and normalize state indexes after mutations.
 */
function rebuildWaveEditorList() {
  if (!waveEditorElements.list) {
    return;
  }

  const existingWaves = waveEditorState.waves.map((wave) => ({ ...wave }));
  waveEditorState.waves = [];
  waveEditorElements.list.innerHTML = '';

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

  wave[field] = value;
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
  if (waveEditorElements.list) {
    waveEditorElements.list.innerHTML = '';
  }

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
    const enemyData = ENEMY_TYPES[wave.enemyType];
    if (!enemyData) {
      return null;
    }

    const normalizedSpeed = enemyData.speed / SPEED_NORMALIZATION_FACTOR;
    const reward = wave.hp * 0.1;

    const verboseWave = {
      count: wave.count,
      interval: wave.interval,
      hp: wave.hp,
      speed: normalizedSpeed,
      reward: reward,
      color: enemyData.color,
      codexId: enemyData.id,
      label: enemyData.label
    };

    if (wave.delay && wave.delay > 0) {
      verboseWave.delay = wave.delay;
    }

    if (wave.hasBoss && wave.bossHp) {
      verboseWave.boss = {
        label: `Boss ${enemyData.label}`,
        hp: wave.bossHp,
        speed: normalizedSpeed * 0.5,
        reward: wave.bossHp * 0.15,
        color: enemyData.color,
        symbol: wave.enemyType
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
 * Resolve the preferred enemy type letter for an existing wave entry.
 * Prefers stored editor data, then codex ids, and finally defaults to type A.
 * @param {Object|null} waveData - Existing wave data
 * @returns {string} Enemy type letter
 */
function resolveEnemyTypeFromWaveData(waveData) {
  if (waveData?.enemyType) {
    const candidate = String(waveData.enemyType).toUpperCase();
    if (ENEMY_TYPES[candidate]) {
      return candidate;
    }
  }

  const fromCodex = getEnemyTypeFromCodexId(waveData?.codexId);
  if (fromCodex && ENEMY_TYPES[fromCodex]) {
    return fromCodex;
  }

  return 'A';
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
