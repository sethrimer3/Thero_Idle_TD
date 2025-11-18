/**
 * Name generator for Tsadi Spire molecules using a themed lexicon.
 * Provides deterministic-but-randomized names while preventing duplicates.
 */

/**
 * Structured lexicon used to assemble molecule names.
 */
export const TSADI_MOLECULE_LEXICON = {
  prefixes: {
    math: [
      'Algo',
      'Topos',
      'Lambda',
      'Sigma',
      'Delta',
      'Epsilon',
      'Zeta',
      'Gamma',
      'Theta',
      'Omega',
      'Phi',
      'Kappa',
      'Rho',
      'Mu',
      'Fractal',
      'Itera',
      'Cardi',
      'Prime',
      'Vector',
      'Tensor',
      'Scalar',
      'Hyper',
      'Mono',
      'Iso',
      'Meta',
    ],
    physics: [
      'Quanta',
      'Photon',
      'Muon',
      'Gluon',
      'Neutrino',
      'Boson',
      'Tachy',
      'Phase',
      'Plasma',
      'Entropy',
      'Gravi',
      'Relati',
      'Curvi',
      'Spinor',
      'Magno',
      'Fluxo',
      'Therma',
      'Planck',
      'Feyn',
      'Higgs',
      'Maxwell',
      'Farad',
      'Tesla',
      'Dirac',
      'Riemann',
      'Ein',
      'Lorentz',
      'Metric',
    ],
    philosophy: [
      'Onto',
      'Episto',
      'Sophi',
      'Logi',
      'Diale',
      'Kanti',
      'Platoni',
      'Aristo',
      'Zeno',
      'Heracli',
      'Absurd',
      'Cogito',
      'Ethico',
      'Teleo',
      'Cosmo',
      'Rational',
      'Axiom',
      'Paradox',
      'Noumeno',
      'Phenomeno',
      'Doxa',
      'Nous',
    ],
    occult: [
      'Aether',
      'Astral',
      'Umbra',
      'Sol',
      'Luna',
      'Chthonic',
      'Seraph',
      'Draco',
      'Chrono',
      'Psycho',
      'Aura',
      'Rune',
      'Glypho',
      'Mytho',
      'Sigil',
      'Vita',
      'Void',
      'Nox',
    ],
  },
  cores: {
    scientist: [
      'Schrod',
      'Heisen',
      'Turing',
      'Godel',
      'Cantor',
      'Euler',
      'Gauss',
      'Leibniz',
      'Newton',
      'Kepler',
      'Pascal',
      'Fermat',
      'Lagrang',
      'Laplace',
      'Hilbert',
      'Banach',
      'Riemann',
      'Kolmogor',
      'Noether',
      'Ramanu',
      'Hawking',
      'Penrose',
      'Susskind',
      'Witten',
      'Bohr',
      'Planck',
      'Tesla',
      'Faraday',
      'Maxwell',
      'Ampere',
      'Lorentz',
      'Dirac',
      'Feyn',
    ],
    concept: [
      'Vector',
      'Tensor',
      'Metric',
      'Scalar',
      'Matrix',
      'Eigen',
      'Prime',
      'Fractal',
      'Limit',
      'Integral',
      'Derivative',
      'Gradient',
      'Manifold',
      'Topology',
      'Morphism',
      'Functor',
      'Kernel',
      'Spectrum',
      'Quantum',
      'Lattice',
      'Field',
      'Ring',
      'Module',
      'Flux',
      'Wave',
      'Phase',
      'Entropy',
      'Vacuum',
      'Singularity',
      'Horizon',
      'Invariant',
      'Symmetry',
      'Operator',
      'Orbit',
      'Node',
      'Graph',
      'Axiom',
      'Lemma',
      'Proof',
      'Recursion',
      'Fixedpoint',
      'Causal',
      'Potential',
      'Momentum',
    ],
    mystic: [
      'Aether',
      'Auric',
      'Glyph',
      'Rune',
      'Sigil',
      'Spiriton',
      'Phlogiston',
      'Elixir',
      'Paradox',
      'Void',
      'Echo',
      'Wisp',
      'Shade',
      'Catalyst',
      'Essence',
      'Cryst',
      'Shard',
      'Phonon',
      'Magnon',
      'Chronon',
      'Praxon',
    ],
  },
  suffixes: {
    latin: ['ium', 'ite', 'ate', 'ide', 'ine', 'one', 'ene', 'ose'],
    scientific: [
      'ion',
      'on',
      'ron',
      'tron',
      'phage',
      'kine',
      'morph',
      'zyme',
      'holon',
      'hedron',
      'scope',
      'graph',
      'stat',
      'vector',
      'scalar',
      'lith',
      'sphere',
      'nome',
      'type',
      'form',
      'phase',
      'state',
    ],
    mystic: [
      'flux',
      'wisp',
      'echo',
      'geist',
      'vitrion',
      'vitrae',
      'shard',
      'core',
      'sigil',
      'rune',
      'veil',
      'spiral',
      'chant',
    ],
  },
};

/**
 * Seeded RNG (Mulberry32) to keep names consistent within a seed.
 * @param {number} seed - Base seed for random stream.
 * @returns {Function} RNG that yields numbers in [0, 1).
 */
function mulberry32(seed) {
  return function generate() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Utility to pick a random element from an array using the provided RNG.
 * @param {Function} rng - RNG that returns numbers in [0, 1).
 * @param {Array} arr - Collection to pick from.
 * @returns {*} Randomly selected entry.
 */
function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Pick a random value from a grouped lexicon (e.g., prefixes.math).
 * @param {Function} rng - RNG that returns numbers in [0, 1).
 * @param {Object} groupObj - Object containing category arrays.
 * @returns {{ category: string, value: string }} Selected category and value.
 */
function pickFromCategoryGroup(rng, groupObj) {
  const categories = Object.keys(groupObj);
  const cat = pick(rng, categories);
  const value = pick(rng, groupObj[cat]);
  return { category: cat, value };
}

/**
 * Create a deterministic generator that assembles molecule names from the lexicon.
 * @param {number|string} seed - Seed to stabilize randomization per world or save.
 * @param {Object} lexicon - Lexicon containing prefix/core/suffix groups.
 * @returns {Function} Generator that produces name descriptors.
 */
function createNameGenerator(seed, lexicon) {
  const baseSeed = typeof seed === 'number'
    ? seed
    : seed.toString().split('').reduce((a, c) => a + c.charCodeAt(0), 0);

  return function generateMolecule() {
    const rng = mulberry32(baseSeed + Math.floor(Math.random() * 1e9));

    const patternRoll = rng();
    let pattern;
    if (patternRoll < 0.3) pattern = 'PREFIX_CORE_SUFFIX';
    else if (patternRoll < 0.55) pattern = 'CORE_SUFFIX';
    else if (patternRoll < 0.75) pattern = 'OCCULT_CORE_MYSTIC';
    else pattern = 'MATH_PHYS_CORE';

    let name = '';
    const parts = [];
    const tags = {
      math: 0,
      physics: 0,
      philosophy: 0,
      occult: 0,
      scientist: 0,
      concept: 0,
      mystic: 0,
    };

    const { prefixes, cores, suffixes } = lexicon;

    if (pattern === 'PREFIX_CORE_SUFFIX') {
      const prefixSource = pick(rng, ['math', 'physics', 'philosophy']);
      const prefix = pick(rng, prefixes[prefixSource]);
      const coreSource = pick(rng, ['scientist', 'concept']);
      const core = pick(rng, cores[coreSource]);
      const suffixSource = pick(rng, ['latin', 'scientific']);
      const suffix = pick(rng, suffixes[suffixSource]);

      name = prefix + core + suffix;

      tags[prefixSource] += 1;
      tags[coreSource] += 1;

      parts.push({ type: 'prefix', category: prefixSource, value: prefix });
      parts.push({ type: 'core', category: coreSource, value: core });
      parts.push({ type: 'suffix', category: suffixSource, value: suffix });
    } else if (pattern === 'CORE_SUFFIX') {
      const coreSource = pick(rng, ['scientist', 'concept']);
      const core = pick(rng, cores[coreSource]);
      const suffixSource = pick(rng, ['latin', 'scientific']);
      const suffix = pick(rng, suffixes[suffixSource]);

      name = core + suffix;

      tags[coreSource] += 1;

      parts.push({ type: 'core', category: coreSource, value: core });
      parts.push({ type: 'suffix', category: suffixSource, value: suffix });
    } else if (pattern === 'OCCULT_CORE_MYSTIC') {
      const prefix = pick(rng, prefixes.occult);
      const coreSource = pick(rng, ['concept', 'mystic']);
      const core = pick(rng, cores[coreSource]);
      const suffix = pick(rng, suffixes.mystic);

      name = prefix + core + suffix;

      tags.occult += 1;
      tags[coreSource] += 1;

      parts.push({ type: 'prefix', category: 'occult', value: prefix });
      parts.push({ type: 'core', category: coreSource, value: core });
      parts.push({ type: 'suffix', category: 'mystic', value: suffix });
    } else if (pattern === 'MATH_PHYS_CORE') {
      const prefixSource = pick(rng, ['math', 'physics']);
      const prefix = pick(rng, prefixes[prefixSource]);
      const core = pick(rng, cores.mystic);
      const suffixSource = pick(rng, ['latin', 'scientific']);
      const suffix = pick(rng, suffixes[suffixSource]);

      name = prefix + core + suffix;

      tags[prefixSource] += 1;
      tags.mystic += 1;

      parts.push({ type: 'prefix', category: prefixSource, value: prefix });
      parts.push({ type: 'core', category: 'mystic', value: core });
      parts.push({ type: 'suffix', category: suffixSource, value: suffix });
    }

    const scienceWeight = tags.math + tags.physics + tags.scientist + tags.concept;
    const occultWeight = tags.occult + tags.mystic;

    let school = 'neutral';
    if (scienceWeight > occultWeight * 1.5) school = 'rational';
    else if (occultWeight > scienceWeight * 1.5) school = 'esoteric';
    else if (scienceWeight > 0 && occultWeight > 0) school = 'paradoxical';

    const rarity =
      scienceWeight + occultWeight >= 3 ? 'rare' :
      scienceWeight + occultWeight === 2 ? 'uncommon' : 'common';

    return {
      name,
      pattern,
      parts,
      tags,
      school,
      rarity,
    };
  };
}

/**
 * Factory that keeps molecule names unique by tracking claims before generating new ones.
 * @param {number|string} seed - Seed used to prime the generator.
 * @param {Object} lexicon - Lexicon used for name construction.
 * @returns {{ assignName: Function, normalizeRecipes: Function }} Helpers for naming molecules.
 */
export function createTsadiMoleculeNameGenerator(seed = 'tsadi-codex', lexicon = TSADI_MOLECULE_LEXICON) {
  const generateName = createNameGenerator(seed, lexicon);
  const usedNames = new Set();
  // Preserve the claimed name for each molecule id so repeated normalizations stay stable.
  const claimedById = new Map();

  /**
   * Claim a name, generating a new one if missing or duplicated.
   * @param {Object} recipe - Molecule descriptor needing a name.
   * @returns {Object|null} Descriptor with a guaranteed-unique name.
   */
  function assignName(recipe) {
    if (!recipe || typeof recipe !== 'object') {
      return null;
    }
    const entry = { ...recipe };
    const id = entry.id || entry.name || 'molecule';
    const candidate = typeof entry.name === 'string' ? entry.name : claimedById.get(id);

    if (claimedById.has(id)) {
      const claimedName = claimedById.get(id);
      usedNames.add(claimedName);
      return { ...entry, id, name: claimedName };
    }

    if (candidate && !usedNames.has(candidate)) {
      usedNames.add(candidate);
      claimedById.set(id, candidate);
      return { ...entry, id, name: candidate };
    }

    let nextName = candidate || '';
    let attempts = 0;
    while (!nextName || usedNames.has(nextName)) {
      const generated = generateName();
      nextName = generated?.name || `Molecule-${Date.now()}`;
      attempts += 1;
      if (attempts > 50) {
        nextName = `${nextName}-${attempts}`;
        break;
      }
    }

    usedNames.add(nextName);
    claimedById.set(id, nextName);
    return { ...entry, id, name: nextName };
  }

  /**
   * Normalize a list of molecule descriptors to ensure every entry has a unique name.
   * @param {Array} recipes - Persisted or newly created molecule descriptors.
   * @returns {Array} Updated descriptors with unique names recorded.
   */
  function normalizeRecipes(recipes = []) {
    usedNames.clear();
    claimedById.clear();
    const normalized = [];
    recipes.forEach((recipe) => {
      const resolved = assignName(recipe);
      if (resolved) {
        normalized.push(resolved);
      }
    });
    return normalized;
  }

  return { assignName, normalizeRecipes };
}
