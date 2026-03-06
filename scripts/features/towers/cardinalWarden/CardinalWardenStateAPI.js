/**
 * CardinalWardenStateAPI
 *
 * Settings/color methods, game-over detection, and the public state API for
 * the Cardinal Warden simulation (resize, get/setState, weapon management, etc.).
 *
 * All functions operate via `.call(this)` delegation from
 * CardinalWardenSimulation, so `this` refers to the simulation instance.
 */

import {
  WEAPON_SLOT_IDS,
  WEAPON_SLOT_DEFINITIONS,
} from '../cardinalWardenConfig.js';

/**
 * Lighten a hex color by blending it toward white.
 * @param {string} hex - Hex color string (e.g. '#ff0000')
 * @param {number} amount - Blend amount 0-1 toward white (default 0.2)
 * @returns {string} Lightened hex color string
 */
function lightenHexColor(hex, amount = 0.2) {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  if (normalized.length !== 6) {
    return hex;
  }

  const num = parseInt(normalized, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;

  const mix = (channel) => Math.round(channel + (255 - channel) * amount);

  const nr = mix(r);
  const ng = mix(g);
  const nb = mix(b);

  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb
    .toString(16)
    .padStart(2, '0')}`;
}

// ─── Settings / Color methods ────────────────────────────────────────────────

/**
 * Toggle the render palette between day and night variants.
 * @param {boolean} enabled - True for night mode
 */
export function setNightMode(enabled) {
  this.nightMode = Boolean(enabled);
  this.applyColorMode();
  this.applyRingColors();
  this.refreshEnemyColorsForMode();
  this.refreshBulletColorsForMode();
  this.refreshBossColorsForMode();
}

/**
 * Set enemy trail quality setting.
 * @param {string} quality - 'low', 'medium', or 'high'
 */
export function setEnemyTrailQuality(quality) {
  const validQualities = ['low', 'medium', 'high'];
  this.enemyTrailQuality = validQualities.includes(quality) ? quality : 'high';
}

/**
 * Set bullet trail length setting.
 * @param {string} length - 'none', 'short', 'medium', or 'long'
 */
export function setBulletTrailLength(length) {
  const validLengths = ['none', 'short', 'medium', 'long'];
  this.bulletTrailLength = validLengths.includes(length) ? length : 'long';
}

/**
 * Set legacy warden graphics mode.
 * @param {boolean} enabled - True to use old canvas rendering, false for new sprites
 */
export function setLegacyWardenGraphics(enabled) {
  this.legacyWardenGraphics = Boolean(enabled);
}

/**
 * Get the max trail length for enemies (always full length for gameplay).
 * @returns {number} Max trail entries
 */
export function getEnemyTrailMaxLength() {
  // Trail length is always max for gameplay (collision detection)
  return 28;
}

/**
 * Get the max smoke puffs for enemies (always full for gameplay).
 * @returns {number} Max smoke puffs
 */
export function getEnemySmokeMaxCount() {
  // Smoke puffs always at max for gameplay
  return 60;
}

/**
 * Get the enemy trail quality for rendering.
 * @returns {string} Quality level: 'low', 'medium', or 'high'
 */
export function getEnemyTrailQuality() {
  return this.enemyTrailQuality || 'high';
}

/**
 * Get the max trail length for bullets based on current setting.
 * Bullets now have 4x longer trails by default (40 vs original 10).
 * @returns {number} Max trail entries
 */
export function getBulletTrailMaxLength() {
  switch (this.bulletTrailLength) {
    case 'none': return 0;
    case 'short': return 10;
    case 'medium': return 20;
    case 'long': return 40;
    default: return 40;
  }
}

/**
 * Keep current enemies aligned with the active color mode.
 */
export function refreshEnemyColorsForMode() {
  for (const enemy of this.enemies) {
    enemy.color = this.nightMode ? '#ffffff' : enemy.baseColor;
  }
}

/**
 * Keep current bosses aligned with the active color mode.
 */
export function refreshBossColorsForMode() {
  for (const boss of this.bosses) {
    boss.color = this.nightMode ? '#ffffff' : boss.baseColor;
  }
}

/**
 * Lighten existing bullets when night mode is enabled for consistency.
 */
export function refreshBulletColorsForMode() {
  for (const bullet of this.bullets) {
    const sourceColor = bullet.baseColor || bullet.color;
    bullet.color = this.resolveBulletColor(sourceColor);
  }
}

/**
 * Resolve an appropriate bullet tint for the active palette.
 * @param {string} baseColor - Base hex color for the bullet
 * @returns {string} Resolved color string
 */
export function resolveBulletColor(baseColor) {
  if (this.nightMode) {
    return lightenHexColor(baseColor || this.bulletColor, 0.35);
  }
  return baseColor || this.bulletColor;
}

// ─── Game-over helpers ───────────────────────────────────────────────────────

/**
 * Check if game over conditions are met.
 */
export function checkGameOver() {
  const gameOver = this.enemiesPassedThrough >= this.maxEnemiesPassedThrough ||
                   (this.warden && this.warden.health <= 0);

  if (gameOver && this.gamePhase === 'playing') {
    // Check for new high score before updating
    const isNewHighScore = this.score > this.highScore;

    // Update high score before death animation
    if (isNewHighScore) {
      this.highScore = this.score;
      if (this.onHighScoreChange) {
        this.onHighScoreChange(this.highScore);
      }
    }

    if (this.onGameOver) {
      this.onGameOver({
        score: this.score,
        highScore: this.highScore,
        wave: this.wave,
        highestWave: this.highestWave,
        isNewHighScore: isNewHighScore,
      });
    }

    // Start death animation instead of immediate reset
    this.startDeathAnimation();
  }
}

/**
 * Start the death animation sequence.
 */
export function startDeathAnimation() {
  this.gamePhase = 'death';
  this.deathAnimTimer = 0;
  this.deathShakeIntensity = 0;
  this.deathExplosionParticles = [];
}

// ─── Public state API ────────────────────────────────────────────────────────

/**
 * Handle canvas resize.
 * @param {number} width - New canvas width in pixels
 * @param {number} height - New canvas height in pixels
 */
export function resize(width, height) {
  if (!this.canvas) return;

  this.canvas.width = width;
  this.canvas.height = height;

  // Reposition warden
  if (this.warden) {
    this.warden.x = width / 2;
    this.warden.y = height * 0.75;
  }
}

/**
 * Get the current game state for persistence.
 * @returns {Object} Serialisable state snapshot
 */
export function getState() {
  return {
    score: this.score,
    highScore: this.highScore,
    highestWave: this.highestWave,
    wave: this.wave,
    difficultyLevel: this.difficultyLevel,
    upgrades: { ...this.upgrades },
    weapons: {
      purchased: { ...this.weapons.purchased },
      levels: { ...this.weapons.levels },
      activeWeaponId: this.weapons.activeWeaponId,
    },
    baseHealthLevel: this.baseHealthLevel,
  };
}

/**
 * Restore game state.
 * @param {Object} state - State snapshot previously returned by getState()
 */
export function setState(state) {
  if (state.highScore !== undefined) {
    this.highScore = state.highScore;
  }
  if (state.highestWave !== undefined) {
    this.highestWave = state.highestWave;
  }
  if (state.upgrades) {
    this.upgrades = { ...this.upgrades, ...state.upgrades };
  }
  if (state.weapons) {
    this.setWeaponState(state.weapons);
  }
  if (state.baseHealthLevel !== undefined) {
    this.setBaseHealthLevel(state.baseHealthLevel);
  }
}

/**
 * Set the high score externally.
 * @param {number} value - New high score value
 */
export function setHighScore(value) {
  if (Number.isFinite(value) && value >= 0) {
    this.highScore = value;
  }
}

/**
 * Set the highest wave externally.
 * @param {number} value - Highest wave number reached
 */
export function setHighestWave(value) {
  if (Number.isFinite(value) && value >= 0) {
    this.highestWave = Math.floor(value);
  }
}

/**
 * Get the highest wave reached.
 * @returns {number} Highest wave number
 */
export function getHighestWave() {
  return this.highestWave;
}

/**
 * Apply an upgrade to the Cardinal Warden.
 * @param {string} upgradeType - Upgrade type key
 * @param {number} level - Upgrade level (default 1)
 */
export function applyUpgrade(upgradeType, level = 1) {
  switch (upgradeType) {
    case 'bulletDamage':
      this.upgrades.bulletDamage = Math.max(1, level);
      break;
    case 'bulletSpeed':
      this.upgrades.bulletSpeed = Math.max(1, level);
      break;
    case 'bulletCount':
      this.upgrades.bulletCount = Math.max(1, level);
      break;
    case 'fireRate':
      this.upgrades.fireRate = Math.max(1, level);
      break;
    case 'pattern':
      if (level && !this.upgrades.patterns.includes(level)) {
        this.upgrades.patterns.push(level);
      }
      break;
    default:
      break;
  }
}

/**
 * Get all available weapon slots with their state.
 * All 3 slots are always active and cannot be purchased/upgraded individually.
 * @returns {Object[]} Array of weapon state objects sorted by slotIndex
 */
export function getAvailableWeapons() {
  const weapons = [];
  for (const weaponId of Object.keys(WEAPON_SLOT_DEFINITIONS)) {
    const def = WEAPON_SLOT_DEFINITIONS[weaponId];
    const isPurchased = this.weapons.purchased[weaponId] || false;
    const level = this.weapons.levels[weaponId] || 1;
    const isEquipped = true; // All slots are always equipped
    const glowIntensity = this.weaponGlowState?.[weaponId] || 0;
    const cooldownProgress = this.weaponTimers?.[weaponId] || 0;

    // Calculate actual fire interval considering graphemes and speed upgrades
    const assignments = this.weaponGraphemeAssignments[weaponId] || [];
    const effectiveAssignments = this.getEffectiveGraphemeAssignments(assignments);
    const fireRateMultiplier = this.calculateFireRateMultiplier(effectiveAssignments);
    const weaponSpeedMult = this.getWeaponSpeedMultiplier(weaponId);
    const cooldownTotal = def.baseFireRate / (fireRateMultiplier * weaponSpeedMult);

    weapons.push({
      id: weaponId,
      name: def.name,
      symbol: def.symbol,
      description: def.description,
      color: def.color,
      cost: 0, // No cost - always available
      isPurchased,
      level,
      maxLevel: 1, // No upgrades yet (lexemes will handle this later)
      canUpgrade: false,
      upgradeCost: null,
      isEquipped,
      canEquip: false,
      canUnequip: false,
      glowIntensity, // 0-1 value for UI glow effect
      cooldownProgress, // Current cooldown timer value (ms)
      cooldownTotal, // Total cooldown duration (ms)
      slotIndex: def.slotIndex,
    });
  }
  return weapons.sort((a, b) => a.slotIndex - b.slotIndex);
}

/**
 * Purchase a weapon using score points.
 * @deprecated All 3 weapon slots are always active - no purchase needed
 * @returns {boolean} Always returns false
 */
export function purchaseWeapon(weaponId) {
  // All weapon slots are always active - no purchase needed
  return false;
}

/**
 * Purchase a weapon without deducting score.
 * @deprecated All 3 weapon slots are always active - no purchase needed
 * @returns {boolean} Always returns false
 */
export function purchaseWeaponWithoutCost(weaponId) {
  // All weapon slots are always active - no purchase needed
  return false;
}

/**
 * Upgrade a purchased weapon.
 * @deprecated Weapon upgrades will be handled by lexemes in the future
 * @returns {boolean} Always returns false
 */
export function upgradeWeapon(weaponId) {
  // Weapon upgrades will be handled by lexemes in the future
  return false;
}

/**
 * Upgrade a purchased weapon without deducting score.
 * @deprecated Weapon upgrades will be handled by lexemes in the future
 * @returns {boolean} Always returns false
 */
export function upgradeWeaponWithoutCost(weaponId) {
  // Weapon upgrades will be handled by lexemes in the future
  return false;
}

/**
 * Apply weapon-specific upgrades (attack and speed levels).
 * @param {string} weaponId - The weapon ID (slot1, slot2, slot3)
 * @param {number} attackLevel - Attack upgrade level
 * @param {number} speedLevel - Speed upgrade level
 */
export function applyWeaponUpgrades(weaponId, attackLevel, speedLevel) {
  if (!this.weaponUpgrades[weaponId]) {
    this.weaponUpgrades[weaponId] = { attackLevel: 0, speedLevel: 0 };
  }
  this.weaponUpgrades[weaponId].attackLevel = attackLevel;
  this.weaponUpgrades[weaponId].speedLevel = speedLevel;
}

/**
 * Get weapon-specific attack multiplier based on upgrade level.
 * @param {string} weaponId - The weapon ID
 * @returns {number} Attack multiplier (1.0 = no upgrades, increases with level)
 */
export function getWeaponAttackMultiplier(weaponId) {
  const attackLevel = this.weaponUpgrades[weaponId]?.attackLevel || 0;
  // Each level adds 10% damage
  return 1 + (attackLevel * 0.1);
}

/**
 * Get weapon-specific speed multiplier based on upgrade level.
 * @param {string} weaponId - The weapon ID
 * @returns {number} Speed multiplier (1.0 = no upgrades, increases with level)
 */
export function getWeaponSpeedMultiplier(weaponId) {
  const speedLevel = this.weaponUpgrades[weaponId]?.speedLevel || 0;
  // Each level adds 10% fire rate
  return 1 + (speedLevel * 0.1);
}

/**
 * Equip a weapon slot.
 * @deprecated All 3 weapon slots are always equipped
 * @returns {boolean} Always returns false
 */
export function equipWeapon(weaponId) {
  // All 3 weapon slots are always equipped
  return false;
}

/**
 * Unequip a weapon slot.
 * @deprecated All 3 weapon slots are always equipped
 * @returns {boolean} Always returns false
 */
export function unequipWeapon(weaponId) {
  // All 3 weapon slots are always equipped
  return false;
}

/**
 * Check if a weapon is currently equipped.
 * @param {string} weaponId - The ID of the weapon to check
 * @returns {boolean} True if equipped
 */
export function isWeaponEquipped(weaponId) {
  return this.weapons.equipped?.includes(weaponId) || false;
}

/**
 * Get the list of currently equipped weapon IDs.
 * @returns {string[]} Array of equipped weapon IDs
 */
export function getEquippedWeapons() {
  return [...(this.weapons.equipped || [])];
}

/**
 * Get current weapon state for UI.
 * @returns {Object} Weapon state snapshot
 */
export function getWeaponState() {
  return {
    purchased: { ...this.weapons.purchased },
    levels: { ...this.weapons.levels },
    activeWeaponId: this.weapons.activeWeaponId,
    equipped: [...(this.weapons.equipped || [])],
  };
}

/**
 * Set weapon state from persistence.
 * @param {Object} state - Previously serialised weapon state
 */
export function setWeaponState(state) {
  if (state?.purchased) {
    this.weapons.purchased = { ...this.weapons.purchased, ...state.purchased };
  }

  if (state?.levels) {
    this.weapons.levels = { ...this.weapons.levels, ...state.levels };
  }
  if (state?.activeWeaponId) {
    this.weapons.activeWeaponId = state.activeWeaponId;
  }

  // All 3 weapons are in the equipped list, but only fire if purchased
  this.weapons.equipped = [...WEAPON_SLOT_IDS];

  // Initialize timers for all equipped weapons
  for (const weaponId of WEAPON_SLOT_IDS) {
    if (!this.weaponTimers[weaponId]) {
      this.weaponTimers[weaponId] = 0;
    }
    if (this.weaponPhases[weaponId] === undefined) {
      this.weaponPhases[weaponId] = 0; // Ensure phase accumulator exists after loading state.
    }
  }
}

/**
 * Set weapon grapheme assignments for dynamic script rendering.
 * @param {Object} assignments - Object mapping weapon IDs to arrays of grapheme assignments
 */
export function setWeaponGraphemeAssignments(assignments) {
  if (!assignments || typeof assignments !== 'object') return;

  // Update assignments for each weapon slot
  for (const weaponId of WEAPON_SLOT_IDS) {
    if (assignments[weaponId]) {
      this.weaponGraphemeAssignments[weaponId] = assignments[weaponId];
    }
  }
}

/**
 * Get current weapon grapheme assignments.
 * @returns {Object} Object mapping weapon IDs to arrays of grapheme assignments
 */
export function getWeaponGraphemeAssignments() {
  return {
    slot1: [...(this.weaponGraphemeAssignments.slot1 || [])],
    slot2: [...(this.weaponGraphemeAssignments.slot2 || [])],
    slot3: [...(this.weaponGraphemeAssignments.slot3 || [])],
  };
}

/**
 * Set grapheme inventory counts for calculating excess grapheme bonus.
 * @param {Object} counts - Map of grapheme index to count
 */
export function setGraphemeInventoryCounts(counts) {
  if (!counts || typeof counts !== 'object') {
    this.graphemeInventoryCounts = {};
    return;
  }
  this.graphemeInventoryCounts = { ...counts };
}
