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
