// Wave encoding and decoding system for compact level configuration.
// Converts verbose wave arrays to/from compact string format to reduce JSON file sizes by ~90%.

// Enemy type mapping - each letter represents a specific enemy with predefined stats
export const ENEMY_TYPES = {
  'A': { id: 'etype', speed: 50, color: '#4a90e2', label: 'Epsilon Type' },
  'B': { id: 'divisor', speed: 45, color: '#e24a4a', label: 'Divisor' },
  'C': { id: 'prime', speed: 55, color: '#50c878', label: 'Prime' },
  'D': { id: 'reversal', speed: 40, color: '#9b59b6', label: 'Reversal' },
  'E': { id: 'tunneler', speed: 60, color: '#f39c12', label: 'Tunneler' },
  'F': { id: 'aleph-swarm', speed: 65, color: '#e91e63', label: 'Aleph Swarm' },
  'G': { id: 'partial-wraith', speed: 48, color: '#34495e', label: 'Partial Wraith' },
  'H': { id: 'gradient-sapper', speed: 52, color: '#16a085', label: 'Gradient Sapper' },
  'I': { id: 'weierstrass-prism', speed: 42, color: '#8e44ad', label: 'Weierstrass Prism' },
  'J': { id: 'planck-shade', speed: 70, color: '#2c3e50', label: 'Planck Shade' },
  'K': { id: 'null-husk', speed: 38, color: '#95a5a6', label: 'Null Husk' },
  'L': { id: 'imaginary-strider', speed: 75, color: '#3498db', label: 'Imaginary Strider' },
  'M': { id: 'combination-cohort', speed: 44, color: '#e67e22', label: 'Combination Cohort' }
};

// Reverse mapping for encoding
const ENEMY_ID_TO_TYPE = Object.fromEntries(
  Object.entries(ENEMY_TYPES).map(([letter, data]) => [data.id, letter])
);

/**
 * Parse compact wave string into verbose wave array.
 * Format: [WaveNumber]:[Count][EnemyType][Mantissa]e[Exponent]/[Interval]/[Delay]/[BossHP (optional)]
 * Example: "1:10A1e2/1.5|2:15B5e3/1.2/0.5|3:20C1e4/1.0/0.3/E1e5"
 * @param {string} waveString - Compact wave string
 * @returns {Array} Array of wave objects
 */
export function parseCompactWaveString(waveString) {
  if (!waveString || typeof waveString !== 'string') {
    return [];
  }

  const waves = [];
  const waveSegments = waveString.split('|');

  for (const segment of waveSegments) {
    try {
      const wave = parseWaveSegment(segment.trim());
      if (wave) {
        waves.push(wave);
      }
    } catch (error) {
      console.warn('Failed to parse wave segment:', segment, error);
    }
  }

  return waves;
}

/**
 * Parse a single wave segment.
 * @param {string} segment - Single wave segment string
 * @returns {Object|null} Wave object or null if invalid
 */
function parseWaveSegment(segment) {
  if (!segment) return null;

  // Split by colon to separate wave number from wave data
  const [waveNumPart, ...dataParts] = segment.split(':');
  if (dataParts.length === 0) return null;

  const waveData = dataParts.join(':');
  
  // Split wave data by slash to get components
  const parts = waveData.split('/');
  if (parts.length < 2) return null;

  const [countAndHp, interval, delay, bossHp] = parts;

  // Parse count, enemy type, and HP using scientific notation
  // Format: [Count][EnemyType][Mantissa]e[Exponent]
  const match = countAndHp.match(/^(\d+)([A-M])(\d+(?:\.\d+)?)e(\d+)$/i);
  if (!match) return null;

  const [, count, enemyType, mantissa, exponent] = match;
  const enemyData = ENEMY_TYPES[enemyType.toUpperCase()];
  if (!enemyData) return null;

  const hp = parseFloat(mantissa) * Math.pow(10, parseInt(exponent, 10));
  const reward = hp * 0.1; // 10% of HP as reward

  // Convert normalized speed to game speed (0-1 range)
  const normalizedSpeed = enemyData.speed / 1000;

  const wave = {
    count: parseInt(count, 10),
    interval: parseFloat(interval),
    hp: hp,
    speed: normalizedSpeed,
    reward: reward,
    color: enemyData.color,
    codexId: enemyData.id,
    label: enemyData.label
  };

  // Add delay if specified
  if (delay) {
    wave.delay = parseFloat(delay);
  }

  // Add boss if specified
  if (bossHp) {
    const bossMatch = bossHp.match(/^(\d+(?:\.\d+)?)e(\d+)$/i);
    if (bossMatch) {
      const [, bossMantissa, bossExponent] = bossMatch;
      const bossHpValue = parseFloat(bossMantissa) * Math.pow(10, parseInt(bossExponent, 10));
      wave.boss = {
        label: `Boss ${enemyData.label}`,
        hp: bossHpValue,
        speed: normalizedSpeed * 0.5, // Bosses move slower
        reward: bossHpValue * 0.15, // 15% of HP as reward
        color: enemyData.color,
        symbol: enemyType.toUpperCase()
      };
    }
  }

  return wave;
}

/**
 * Encode verbose wave array to compact string format.
 * @param {Array} waves - Array of wave objects
 * @returns {string} Compact wave string
 */
export function encodeWavesToCompact(waves) {
  if (!Array.isArray(waves) || waves.length === 0) {
    return '';
  }

  const encodedWaves = waves.map((wave, index) => {
    return encodeWave(wave, index + 1);
  }).filter(Boolean);

  return encodedWaves.join('|');
}

/**
 * Encode a single wave to compact format.
 * @param {Object} wave - Wave object
 * @param {number} waveNumber - Wave number (1-indexed)
 * @returns {string} Encoded wave segment
 */
function encodeWave(wave, waveNumber) {
  if (!wave || typeof wave !== 'object') return '';

  // Find enemy type letter from codexId
  const enemyType = ENEMY_ID_TO_TYPE[wave.codexId];
  if (!enemyType) return '';

  // Convert HP to scientific notation
  const { mantissa, exponent } = toScientificNotation(wave.hp);
  
  // Build wave string: [WaveNumber]:[Count][EnemyType][Mantissa]e[Exponent]/[Interval]
  let waveStr = `${waveNumber}:${wave.count}${enemyType}${mantissa}e${exponent}/${wave.interval}`;

  // Add delay if present
  if (wave.delay && wave.delay > 0) {
    waveStr += `/${wave.delay}`;
  } else if (wave.boss) {
    // Need empty delay slot if boss present but no delay
    waveStr += '/0';
  }

  // Add boss HP if present
  if (wave.boss && wave.boss.hp) {
    const bossNotation = toScientificNotation(wave.boss.hp);
    // Add delay slot if not already present
    if (!wave.delay && wave.delay !== 0) {
      waveStr += '/0';
    }
    waveStr += `/${bossNotation.mantissa}e${bossNotation.exponent}`;
  }

  return waveStr;
}

/**
 * Convert a number to scientific notation components.
 * @param {number} value - Number to convert
 * @returns {Object} Object with mantissa and exponent
 */
function toScientificNotation(value) {
  if (value === 0) return { mantissa: 0, exponent: 0 };
  
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / Math.pow(10, exponent);
  
  // Round mantissa to 2 decimal places for cleaner output
  const roundedMantissa = Math.round(mantissa * 100) / 100;
  
  return { mantissa: roundedMantissa, exponent };
}

/**
 * Create default wave string for a level based on level number.
 * @param {number} levelNumber - Level number (1-30)
 * @returns {string} Default compact wave string
 */
export function createDefaultWaveString(levelNumber) {
  if (!Number.isFinite(levelNumber) || levelNumber < 1) {
    return '';
  }

  const waves = [];
  let waveCount;
  let enemyTypes;
  let hpBase;
  let hpIncrement;

  // Determine wave progression based on level ranges
  if (levelNumber <= 5) {
    waveCount = 5;
    enemyTypes = ['A', 'B', 'C'];
    hpBase = 2;
    hpIncrement = 1;
  } else if (levelNumber <= 10) {
    waveCount = 6 + Math.floor((levelNumber - 6) / 2);
    enemyTypes = ['A', 'B', 'C', 'D', 'E'];
    hpBase = 5;
    hpIncrement = 1;
  } else if (levelNumber <= 15) {
    waveCount = 7 + Math.floor((levelNumber - 11) / 2);
    enemyTypes = ['B', 'C', 'D', 'E', 'F', 'G', 'H'];
    hpBase = 8;
    hpIncrement = 1;
  } else if (levelNumber <= 20) {
    waveCount = 8 + Math.floor((levelNumber - 16) / 2);
    enemyTypes = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    hpBase = 12;
    hpIncrement = 2;
  } else if (levelNumber <= 25) {
    waveCount = 9 + Math.floor((levelNumber - 21) / 2);
    enemyTypes = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    hpBase = 20;
    hpIncrement = 6;
  } else {
    waveCount = 10 + Math.floor((levelNumber - 26) / 2);
    enemyTypes = ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
    hpBase = 50;
    hpIncrement = 10;
  }

  for (let i = 0; i < waveCount; i++) {
    const enemyTypeIndex = Math.min(i, enemyTypes.length - 1);
    const enemyType = enemyTypes[enemyTypeIndex];
    const count = 8 + i * 2;
    const hpExponent = hpBase + i * hpIncrement;
    const mantissa = 1 + (i * 0.5);
    const interval = Math.max(0.8, 1.5 - i * 0.1);
    
    let waveStr = `${i + 1}:${count}${enemyType}${mantissa}e${hpExponent}/${interval.toFixed(1)}`;
    
    // Add boss to final wave of milestone levels
    if (i === waveCount - 1 && levelNumber % 5 === 0) {
      const bossHpExponent = hpExponent + 3;
      waveStr += `/0/${mantissa}e${bossHpExponent}`;
    }
    
    waves.push(waveStr);
  }

  return waves.join('|');
}

/**
 * Validate wave string format.
 * @param {string} waveString - Wave string to validate
 * @returns {Object} Object with valid flag and errors array
 */
export function validateWaveString(waveString) {
  const result = {
    valid: true,
    errors: []
  };

  if (!waveString || typeof waveString !== 'string') {
    result.valid = false;
    result.errors.push('Wave string must be a non-empty string');
    return result;
  }

  const waveSegments = waveString.split('|');
  
  if (waveSegments.length === 0) {
    result.valid = false;
    result.errors.push('Wave string must contain at least one wave');
    return result;
  }

  waveSegments.forEach((segment, index) => {
    const waveNum = index + 1;
    const trimmed = segment.trim();
    
    if (!trimmed) {
      result.valid = false;
      result.errors.push(`Wave ${waveNum}: Empty wave segment`);
      return;
    }

    // Check format: [WaveNumber]:[Count][EnemyType][Mantissa]e[Exponent]/[Interval]...
    const parts = trimmed.split(':');
    if (parts.length < 2) {
      result.valid = false;
      result.errors.push(`Wave ${waveNum}: Missing colon separator`);
      return;
    }

    const waveData = parts.slice(1).join(':');
    const dataParts = waveData.split('/');
    
    if (dataParts.length < 2) {
      result.valid = false;
      result.errors.push(`Wave ${waveNum}: Missing interval (need at least count/hp and interval)`);
      return;
    }

    // Validate count/enemy/hp format
    const countHpMatch = dataParts[0].match(/^(\d+)([A-M])(\d+(?:\.\d+)?)e(\d+)$/i);
    if (!countHpMatch) {
      result.valid = false;
      result.errors.push(`Wave ${waveNum}: Invalid format for count/enemy/hp (expected: [Count][EnemyType][Mantissa]e[Exponent])`);
      return;
    }

    const [, count, enemyType, mantissa, exponent] = countHpMatch;
    
    // Validate enemy type
    if (!ENEMY_TYPES[enemyType.toUpperCase()]) {
      result.valid = false;
      result.errors.push(`Wave ${waveNum}: Invalid enemy type '${enemyType}' (must be A-M)`);
    }

    // Validate interval
    const interval = parseFloat(dataParts[1]);
    if (isNaN(interval) || interval <= 0) {
      result.valid = false;
      result.errors.push(`Wave ${waveNum}: Invalid interval '${dataParts[1]}' (must be positive number)`);
    }

    // Validate delay if present
    if (dataParts[2]) {
      const delay = parseFloat(dataParts[2]);
      if (isNaN(delay) || delay < 0) {
        result.valid = false;
        result.errors.push(`Wave ${waveNum}: Invalid delay '${dataParts[2]}' (must be non-negative number)`);
      }
    }

    // Validate boss HP if present
    if (dataParts[3]) {
      const bossHpMatch = dataParts[3].match(/^(\d+(?:\.\d+)?)e(\d+)$/i);
      if (!bossHpMatch) {
        result.valid = false;
        result.errors.push(`Wave ${waveNum}: Invalid boss HP format '${dataParts[3]}' (expected: [Mantissa]e[Exponent])`);
      }
    }
  });

  return result;
}
