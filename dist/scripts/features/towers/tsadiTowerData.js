/**
 * Tsadi tower particle fusion static data and configuration.
 * This module contains tier definitions, molecule recipes, and constants
 * extracted from tsadiTower.js to improve maintainability.
 */

/**
 * Ordered list of Greek letter metadata for tier naming.
 * Each entry contains the capitalized English name, lowercase glyph, and uppercase glyph.
 */
export const GREEK_TIER_SEQUENCE = [
  { name: 'Alpha', letter: 'α', capital: 'Α' },
  { name: 'Beta', letter: 'β', capital: 'Β' },
  { name: 'Gamma', letter: 'γ', capital: 'Γ' },
  { name: 'Delta', letter: 'δ', capital: 'Δ' },
  { name: 'Epsilon', letter: 'ε', capital: 'Ε' },
  { name: 'Zeta', letter: 'ζ', capital: 'Ζ' },
  { name: 'Eta', letter: 'η', capital: 'Η' },
  { name: 'Theta', letter: 'θ', capital: 'Θ' },
  { name: 'Iota', letter: 'ι', capital: 'Ι' },
  { name: 'Kappa', letter: 'κ', capital: 'Κ' },
  { name: 'Lambda', letter: 'λ', capital: 'Λ' },
  { name: 'Mu', letter: 'μ', capital: 'Μ' },
  { name: 'Nu', letter: 'ν', capital: 'Ν' },
  { name: 'Xi', letter: 'ξ', capital: 'Ξ' },
  { name: 'Omicron', letter: 'ο', capital: 'Ο' },
  { name: 'Pi', letter: 'π', capital: 'Π' },
  { name: 'Rho', letter: 'ρ', capital: 'Ρ' },
  { name: 'Sigma', letter: 'σ', capital: 'Σ' },
  { name: 'Tau', letter: 'τ', capital: 'Τ' },
  { name: 'Upsilon', letter: 'υ', capital: 'Υ' },
  { name: 'Phi', letter: 'φ', capital: 'Φ' },
  { name: 'Chi', letter: 'χ', capital: 'Χ' },
  { name: 'Psi', letter: 'ψ', capital: 'Ψ' },
  { name: 'Omega', letter: 'ω', capital: 'Ω' },
];

// Null particle is tier -1, the base reference particle
export const NULL_TIER = -1;
// Total Greek letters in sequence (used for tier calculations)
export const GREEK_SEQUENCE_LENGTH = GREEK_TIER_SEQUENCE.length;
// Canvas dimensions below this value indicate the spire view is collapsed or hidden.
export const COLLAPSED_DIMENSION_THRESHOLD = 2;

// Interactive wave effect constants
export const WAVE_INITIAL_RADIUS_MULTIPLIER = 3; // Initial wave radius as multiple of null particle radius
export const WAVE_MAX_RADIUS_MULTIPLIER = 15; // Maximum wave radius as multiple of null particle radius
export const WAVE_INITIAL_FORCE = 300; // Initial force strength for pushing particles
export const WAVE_FADE_RATE = 3; // Alpha fade rate per second
export const WAVE_EXPANSION_RATE = 200; // Radius expansion rate in pixels per second
export const WAVE_FORCE_DECAY_RATE = 0.3; // Force decay power per second (exponential)
export const WAVE_FORCE_DECAY_LOG = Math.log(WAVE_FORCE_DECAY_RATE); // Precomputed for efficient exponential decay
export const WAVE_MIN_FORCE_THRESHOLD = 0.1; // Skip waves below this force strength for performance
export const WAVE_MIN_DISTANCE = 0.001; // Minimum distance to prevent division by zero

// Legacy molecule recipes kept for backward compatibility with old saves.
export const LEGACY_MOLECULE_RECIPES = [
  {
    id: 'null-alpha-beta',
    name: 'Catalyst Triangle',
    tiers: [NULL_TIER, 0, 1],
    bonus: { spawnRateBonus: 0.15, repellingShift: -0.05 },
    description: 'Stabilizes null, α, and β bonds to gently hasten particle spawning.',
  },
  {
    id: 'alpha-beta-gamma',
    name: 'Prismatic Triplet',
    tiers: [0, 1, 2],
    bonus: { spawnRateBonus: 0.1, repellingShift: -0.2 },
    description: 'Aligns α/β/γ into an attractive prism that weakens repelling forces.',
  },
  {
    id: 'delta-epsilon-zeta',
    name: 'Stability Weave',
    tiers: [3, 4, 5],
    bonus: { spawnRateBonus: 0.05, repellingShift: -0.15 },
    description: 'Weaves δ/ε/ζ together to keep higher-tier clusters from scattering.',
  },
];

// Tier threshold that unlocks advanced molecule weaving with repeated particle tiers.
export const ADVANCED_MOLECULE_UNLOCK_TIER = 20;

// ---------------------------------------------------------------------------
// Tier utility functions
// These helpers operate on the tier data above and were extracted from
// tsadiTower.js (Phase 3.1.2) to reduce that file's size and collocate
// the logic with the data it depends on.
// ---------------------------------------------------------------------------

/**
 * Normalize and sort a tier list so combinations ignore permutation order.
 * @param {Array<number>} tiers - Raw tier list.
 * @returns {Array<number>} Sorted unique tiers.
 */
export function normalizeTierList(tiers = []) {
  const unique = Array.isArray(tiers)
    ? Array.from(new Set(tiers.filter((tier) => Number.isFinite(tier))))
    : [];
  return unique.sort((a, b) => a - b);
}

/**
 * Sort a tier list while preserving duplicates.
 * This allows molecules to include multiple particles of the same tier.
 * @param {Array<number>} tiers - Raw tier list with possible duplicates.
 * @returns {Array<number>} Sorted tier list with duplicates preserved.
 */
export function sortTierListWithDuplicates(tiers = []) {
  const filtered = Array.isArray(tiers)
    ? tiers.filter((tier) => Number.isFinite(tier))
    : [];
  return filtered.sort((a, b) => a - b);
}

/**
 * Check if a tier list has sufficient variety to be a valid molecule.
 * A valid molecule must have at least 2 particles and at least 2 different tier types.
 * This prevents molecules like [alpha, alpha] while allowing [alpha, beta, alpha].
 * @param {Array<number>} tiers - Tier list to validate.
 * @returns {boolean} True if the molecule has sufficient variety.
 */
export function hasValidMoleculeVariety(tiers = []) {
  if (!Array.isArray(tiers) || tiers.length < 2) {
    return false;
  }
  const uniqueTiers = new Set(tiers);
  return uniqueTiers.size >= 2;
}

/**
 * Determine if a tier list contains duplicate particle types, indicating an advanced molecule.
 * @param {Array<number>} tiers - Tier list to inspect.
 * @returns {boolean} True when any tier appears more than once.
 */
export function hasDuplicateTier(tiers = []) {
  if (!Array.isArray(tiers)) {
    return false;
  }
  const unique = new Set(tiers);
  return unique.size !== tiers.length;
}

/**
 * Convert an internal tier index into the player-facing tier number.
 * Null sits at tier 0, Alpha at tier 1, and so on up the Greek ladder.
 * @param {number} tier - Internal tier index (NULL_TIER = -1, alpha = 0)
 * @returns {number} Display tier number.
 */
export function toDisplayTier(tier) {
  if (tier === NULL_TIER) {
    return 0;
  }
  return tier + 1;
}

/**
 * Build a deterministic identifier for a molecule combination.
 * Now supports duplicate tiers to allow molecules like [alpha, beta, alpha].
 * @param {Array<number>} tiers - Tier list (may contain duplicates).
 * @param {boolean} [allowDuplicates=false] - If true, preserve duplicates in the ID.
 * @returns {string|null} Stable id or null when insufficient data or invalid variety.
 */
export function createCombinationIdFromTiers(tiers = [], allowDuplicates = false) {
  const sorted = allowDuplicates ? sortTierListWithDuplicates(tiers) : normalizeTierList(tiers);
  if (sorted.length < 2) {
    return null;
  }
  if (allowDuplicates && !hasValidMoleculeVariety(sorted)) {
    return null;
  }
  return sorted.map((tier) => toDisplayTier(tier)).join('-');
}

/**
 * Remove the legacy "combo-" prefix from molecule identifiers for cleaner labels.
 * @param {string} label - Raw molecule id or name.
 * @returns {string} Label without the combo prefix.
 */
export function stripCombinationPrefix(label = '') {
  if (typeof label !== 'string') {
    return '';
  }
  return label.replace(/^combo-/i, '');
}

/**
 * Enumerate every unique combination of at least two tiers from a set.
 * @param {Array<number>} tiers - Sorted unique tiers present on a binding agent.
 * @returns {Array<Array<number>>} All combinations with size >= 2.
 */
export function generateTierCombinations(tiers = []) {
  const results = [];
  const total = tiers.length;
  const maxMask = 1 << total;
  for (let mask = 0; mask < maxMask; mask += 1) {
    const combo = [];
    for (let i = 0; i < total; i += 1) {
      if (mask & (1 << i)) {
        combo.push(tiers[i]);
      }
    }
    if (combo.length >= 2) {
      results.push(combo);
    }
  }
  return results;
}

/**
 * Classify a tier into its cycle and position.
 * @param {number} tier - The particle tier.
 * @returns {{cycle:number, isNull:boolean, isAleph:boolean, isRoman:boolean, greekIndex:number, romanIndex:number}}
 */
export function getTierClassification(tier) {
  if (tier === NULL_TIER) {
    return { cycle: -1, isNull: true, isAleph: false, isRoman: false, greekIndex: -1, romanIndex: -1 };
  }
  const alephTier = GREEK_SEQUENCE_LENGTH * 2;
  if (tier === alephTier) {
    return { cycle: 3, isNull: false, isAleph: true, isRoman: false, greekIndex: -1, romanIndex: -1 };
  }
  if (tier > alephTier) {
    const romanIndex = tier - alephTier;
    return { cycle: 2, isNull: false, isAleph: false, isRoman: true, greekIndex: -1, romanIndex };
  }
  const cycle = Math.floor(tier / GREEK_SEQUENCE_LENGTH);
  const greekIndex = tier % GREEK_SEQUENCE_LENGTH;
  return { cycle, isNull: false, isAleph: false, isRoman: false, greekIndex, romanIndex: -1 };
}

/**
 * Convert a number to Roman numerals (1-3999).
 * @param {number} num - The number to convert.
 * @returns {string} Roman numeral representation.
 */
export function toRomanNumeral(num) {
  if (num <= 0 || num > 3999) {
    return `[${num}]`;
  }
  const romanNumerals = [
    { value: 1000, numeral: 'M' },
    { value: 900, numeral: 'CM' },
    { value: 500, numeral: 'D' },
    { value: 400, numeral: 'CD' },
    { value: 100, numeral: 'C' },
    { value: 90, numeral: 'XC' },
    { value: 50, numeral: 'L' },
    { value: 40, numeral: 'XL' },
    { value: 10, numeral: 'X' },
    { value: 9, numeral: 'IX' },
    { value: 5, numeral: 'V' },
    { value: 4, numeral: 'IV' },
    { value: 1, numeral: 'I' },
  ];
  let result = '';
  let remaining = num;
  for (const { value, numeral } of romanNumerals) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  return result;
}

/**
 * Convert tier to a color using the active color palette gradient.
 * Integrates with the game's color scheme system for consistent theming.
 * @param {number} tier - The particle tier (NULL_TIER to aleph)
 * @param {Function} sampleGradientFn - Function to sample from color palette gradient.
 * @returns {string} CSS color string.
 */
export function tierToColor(tier, sampleGradientFn = null) {
  const tierInfo = getTierClassification(tier);
  if (tier === NULL_TIER) {
    if (sampleGradientFn) {
      const rgb = sampleGradientFn(0);
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }
    return 'hsl(240, 70%, 55%)';
  }
  if (tierInfo.isAleph) {
    return 'hsl(45, 100%, 75%)';
  }
  if (tierInfo.isRoman) {
    const romanCycle = (tierInfo.romanIndex - 1) % GREEK_SEQUENCE_LENGTH;
    const position = romanCycle / (GREEK_SEQUENCE_LENGTH - 1);
    if (sampleGradientFn) {
      const rgb = sampleGradientFn(position);
      const darkenFactor = 0.4;
      const r = Math.round(rgb.r * darkenFactor);
      const g = Math.round(rgb.g * darkenFactor);
      const b = Math.round(rgb.b * darkenFactor);
      return `rgb(${r}, ${g}, ${b})`;
    }
    const hue = 240 - (position * 240);
    const lightness = (55 + position * 10) * 0.4;
    return `hsl(${hue}, ${70 + position * 20}%, ${lightness}%)`;
  }
  const greekIndex = tier % GREEK_SEQUENCE_LENGTH;
  const position = greekIndex / (GREEK_SEQUENCE_LENGTH - 1);
  if (sampleGradientFn) {
    const rgb = sampleGradientFn(position);
    let darkenFactor = 1.0;
    if (tierInfo.cycle === 1) {
      darkenFactor = 0.7;
    }
    const r = Math.round(rgb.r * darkenFactor);
    const g = Math.round(rgb.g * darkenFactor);
    const b = Math.round(rgb.b * darkenFactor);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const hue = 240 - (position * 240);
  let lightness = 55 + (position * 10);
  if (tierInfo.cycle === 1) {
    lightness *= 0.7;
  }
  return `hsl(${hue}, ${70 + position * 20}%, ${lightness}%)`;
}

/**
 * Normalize a gem or palette color into a CSS color string.
 * @param {string|Object} color - Raw color input ({r,g,b} or {hue,saturation,lightness}).
 * @returns {string|null} CSS color string when resolvable.
 */
export function colorToCssString(color) {
  if (!color) {
    return null;
  }
  if (typeof color === 'string') {
    return color;
  }
  if (typeof color === 'object') {
    if (Number.isFinite(color.r) && Number.isFinite(color.g) && Number.isFinite(color.b)) {
      return `rgb(${color.r}, ${color.g}, ${color.b})`;
    }
    if (
      Number.isFinite(color.hue) &&
      Number.isFinite(color.saturation) &&
      Number.isFinite(color.lightness)
    ) {
      return `hsl(${color.hue}, ${color.saturation}%, ${color.lightness}%)`;
    }
  }
  return null;
}

/**
 * Apply an alpha multiplier to an rgb() color string.
 * Falls back to the base color when parsing fails.
 * @param {string} colorStr - CSS color string.
 * @param {number} alpha - Alpha channel between 0 and 1.
 * @returns {string} rgba() string with the provided alpha.
 */
export function applyAlphaToColor(colorStr, alpha) {
  if (!colorStr) {
    return `rgba(255, 255, 255, ${alpha})`;
  }
  const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
  }
  return colorStr;
}

/**
 * Retrieve metadata for the provided tier.
 * Supports null, lowercase Greek, capital Greek, Roman numerals, and aleph.
 * @param {number} tier - Tier index (NULL_TIER = -1 for null, 0+ for Greek)
 * @returns {{name:string, letter:string, displayName:string, displayTier:number}}
 */
export function getGreekTierInfo(tier) {
  const safeTier = Math.floor(tier);
  if (safeTier === NULL_TIER) {
    return {
      name: 'Null',
      letter: '',
      displayName: 'Null – Tier 0',
      displayTier: 0,
    };
  }
  const alephTier = GREEK_SEQUENCE_LENGTH * 2;
  if (safeTier === alephTier) {
    return {
      name: 'Aleph',
      letter: 'ℵ',
      displayName: 'Aleph – Tier 49',
      displayTier: safeTier + 1,
    };
  }
  const classification = getTierClassification(safeTier);
  const displayTier = toDisplayTier(safeTier);
  let name, letter, displayName;
  if (classification.isRoman) {
    const romanNum = toRomanNumeral(classification.romanIndex);
    name = `Roman ${romanNum}`;
    letter = romanNum;
    displayName = `${letter} – Tier ${displayTier}`;
  } else if (classification.cycle === 0) {
    const baseInfo = GREEK_TIER_SEQUENCE[classification.greekIndex];
    name = baseInfo.name;
    letter = baseInfo.letter;
    displayName = `${name} (${letter}) – Tier ${displayTier}`;
  } else if (classification.cycle === 1) {
    const baseInfo = GREEK_TIER_SEQUENCE[classification.greekIndex];
    name = `Capital ${baseInfo.name}`;
    letter = baseInfo.capital;
    displayName = `${name} (${letter}) – Tier ${displayTier}`;
  } else {
    name = `Tier ${displayTier}`;
    letter = `T${displayTier}`;
    displayName = `${name}`;
  }
  return { name, letter, displayName, displayTier };
}

// ---------------------------------------------------------------------------
// Quadtree – spatial partitioning for broadphase collision detection
// Used exclusively by ParticleFusionSimulation in tsadiTower.js.
// ---------------------------------------------------------------------------

/**
 * Simple Quadtree for efficient collision detection (broadphase).
 * Extracted from tsadiTower.js (Phase 3.1.2) to reduce that file's size.
 */
export class Quadtree {
  constructor(bounds, maxObjects = 10, maxLevels = 5, level = 0) {
    this.bounds = bounds; // {x, y, width, height}
    this.maxObjects = maxObjects;
    this.maxLevels = maxLevels;
    this.level = level;
    this.objects = [];
    this.nodes = [];
  }

  clear() {
    this.objects = [];
    this.nodes = [];
  }

  split() {
    const subWidth = this.bounds.width / 2;
    const subHeight = this.bounds.height / 2;
    const x = this.bounds.x;
    const y = this.bounds.y;
    this.nodes[0] = new Quadtree(
      { x: x + subWidth, y: y, width: subWidth, height: subHeight },
      this.maxObjects, this.maxLevels, this.level + 1
    );
    this.nodes[1] = new Quadtree(
      { x: x, y: y, width: subWidth, height: subHeight },
      this.maxObjects, this.maxLevels, this.level + 1
    );
    this.nodes[2] = new Quadtree(
      { x: x, y: y + subHeight, width: subWidth, height: subHeight },
      this.maxObjects, this.maxLevels, this.level + 1
    );
    this.nodes[3] = new Quadtree(
      { x: x + subWidth, y: y + subHeight, width: subWidth, height: subHeight },
      this.maxObjects, this.maxLevels, this.level + 1
    );
  }

  getIndex(particle) {
    const verticalMidpoint = this.bounds.x + (this.bounds.width / 2);
    const horizontalMidpoint = this.bounds.y + (this.bounds.height / 2);
    const topQuadrant = (particle.y - particle.radius < horizontalMidpoint) &&
                        (particle.y + particle.radius < horizontalMidpoint);
    const bottomQuadrant = (particle.y - particle.radius > horizontalMidpoint);
    if (particle.x - particle.radius < verticalMidpoint &&
        particle.x + particle.radius < verticalMidpoint) {
      if (topQuadrant) return 1;
      else if (bottomQuadrant) return 2;
    } else if (particle.x - particle.radius > verticalMidpoint) {
      if (topQuadrant) return 0;
      else if (bottomQuadrant) return 3;
    }
    return -1;
  }

  insert(particle) {
    if (this.nodes.length > 0) {
      const index = this.getIndex(particle);
      if (index !== -1) {
        this.nodes[index].insert(particle);
        return;
      }
    }
    this.objects.push(particle);
    if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
      if (this.nodes.length === 0) {
        this.split();
      }
      let i = 0;
      while (i < this.objects.length) {
        const index = this.getIndex(this.objects[i]);
        if (index !== -1) {
          this.nodes[index].insert(this.objects.splice(i, 1)[0]);
        } else {
          i++;
        }
      }
    }
  }

  retrieve(particle) {
    const returnObjects = [];
    if (this.nodes.length > 0) {
      const index = this.getIndex(particle);
      if (index !== -1) {
        returnObjects.push(...this.nodes[index].retrieve(particle));
      } else {
        for (const node of this.nodes) {
          returnObjects.push(...node.retrieve(particle));
        }
      }
    }
    returnObjects.push(...this.objects);
    return returnObjects;
  }
}
