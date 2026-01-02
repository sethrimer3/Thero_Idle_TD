/**
 * Shin Grapheme Codex Data
 * 
 * Contains detailed descriptions of all graphemes (A-N) for the Cardinal Warden
 * weapon system. This data is used to populate the grapheme codex UI.
 */

/**
 * Grapheme codex entries with detailed descriptions.
 * Each entry contains:
 * - index: The grapheme index (0-13)
 * - name: The English letter name (A-N)
 * - title: Display title for the grapheme
 * - summary: Brief one-line description
 * - effects: Detailed slot-by-slot effect descriptions
 * - specialMechanics: Any unique behaviors or interactions
 */
export const GRAPHEME_CODEX_ENTRIES = [
  {
    index: 0,
    name: 'A',
    title: 'Grapheme A — Polygonal Shapes',
    summary: 'Modifies bullet shape and damage multiplier based on slot position.',
    effects: [
      { slot: 0, description: 'Triangle (3 sides), 3× damage' },
      { slot: 1, description: 'Pentagon (5 sides), 5× damage' },
      { slot: 2, description: 'Hexagon (6 sides), 6× damage' },
      { slot: 3, description: 'Heptagon (7 sides), 7× damage' },
      { slot: 4, description: 'Octagon (8 sides), 8× damage' },
      { slot: 5, description: 'Nonagon (9 sides), 9× damage' },
      { slot: 6, description: 'Decagon (10 sides), 10× damage' },
      { slot: 7, description: 'Hendecagon (11 sides), 11× damage' },
    ],
    specialMechanics: 'Each slot increases both the number of polygon sides and the damage multiplier. Higher slots yield more powerful but slower-firing weapons.',
  },
  {
    index: 1,
    name: 'B',
    title: 'Grapheme B — Fire Rate',
    summary: 'Increases weapon fire rate based on slot position.',
    effects: [
      { slot: 0, description: '1× fire rate (no change)' },
      { slot: 1, description: '2× fire rate' },
      { slot: 2, description: '3× fire rate' },
      { slot: 3, description: '4× fire rate' },
      { slot: 4, description: '5× fire rate' },
      { slot: 5, description: '6× fire rate' },
      { slot: 6, description: '7× fire rate' },
      { slot: 7, description: '8× fire rate' },
    ],
    specialMechanics: 'Fire rate multiplier increases linearly with slot position. Combine with high-damage graphemes for maximum DPS.',
  },
  {
    index: 2,
    name: 'C',
    title: 'Grapheme C — Friendly Ships',
    summary: 'Spawns friendly ships that orbit and attack enemies. Deactivates all graphemes to the RIGHT.',
    effects: [
      { slot: 0, description: 'Spawns friendly orbital ships (count based on fire rate)' },
      { slot: 1, description: 'Spawns friendly orbital ships' },
      { slot: 2, description: 'Spawns friendly orbital ships' },
      { slot: 3, description: 'Spawns friendly orbital ships' },
      { slot: 4, description: 'Spawns friendly orbital ships' },
      { slot: 5, description: 'Spawns friendly orbital ships' },
      { slot: 6, description: 'Spawns friendly orbital ships' },
      { slot: 7, description: 'Spawns friendly orbital ships' },
    ],
    specialMechanics: 'Ship count is inversely proportional to weapon fire rate (5 / bullets per second). CRITICAL: Deactivates all graphemes positioned to the RIGHT of this grapheme. Use this to limit unwanted cascading effects.',
  },
  {
    index: 3,
    name: 'D',
    title: 'Grapheme D — Shield Regeneration',
    summary: 'Regenerates player shields/life over time based on slot position and attack speed.',
    effects: [
      { slot: 0, description: 'Fast regeneration (1 shield per 1× attack speed seconds)' },
      { slot: 1, description: 'Moderate regeneration (1 shield per 2× attack speed seconds)' },
      { slot: 2, description: 'Slower regeneration (1 shield per 3× attack speed seconds)' },
      { slot: 3, description: 'Slow regeneration (1 shield per 4× attack speed seconds)' },
      { slot: 4, description: 'Very slow regeneration (1 shield per 5× attack speed seconds)' },
      { slot: 5, description: 'Minimal regeneration (1 shield per 6× attack speed seconds)' },
      { slot: 6, description: 'Minimal regeneration (1 shield per 7× attack speed seconds)' },
      { slot: 7, description: 'Minimal regeneration (1 shield per 8× attack speed seconds)' },
    ],
    specialMechanics: 'Formula: 1 shield recovered over (slot_number × attack_speed) seconds. Place in early slots for faster healing. Visually reverses life line progression (gone → dashed → solid).',
  },
  {
    index: 4,
    name: 'E',
    title: 'Grapheme E — Lightning Trajectories',
    summary: 'Modifies bullet trajectory patterns based on slot position.',
    effects: [
      { slot: 0, description: 'Straight trajectory toward aim target' },
      { slot: 1, description: 'Straight trajectory toward aim target' },
      { slot: 2, description: 'Straight trajectory toward aim target' },
      { slot: 3, description: 'Zigzag pattern toward random waypoints' },
      { slot: 4, description: 'Zigzag pattern toward random waypoints' },
      { slot: 5, description: 'Expanding spiral pattern, bullets persist until top edge' },
      { slot: 6, description: 'Expanding spiral pattern, bullets persist until top edge' },
      { slot: 7, description: 'Expanding spiral pattern, bullets persist until top edge' },
    ],
    specialMechanics: 'Slots 0-2: Simple straight shots. Slots 3-4: Zigzag with 0.5s waypoint holds, then target nearest enemy after 10 holds. Slots 5-7: Defensive spiral that expands outward for maximum area coverage.',
  },
  {
    index: 5,
    name: 'F',
    title: 'Grapheme F — Piercing & Trail Pass',
    summary: 'Grants piercing ability and allows bullets to pass through enemy trails.',
    effects: [
      { slot: 0, description: '+1 pierce (hits 1 enemy)' },
      { slot: 1, description: '+2 pierce (hits 2 enemies)' },
      { slot: 2, description: '+3 pierce (hits 3 enemies)' },
      { slot: 3, description: '+4 pierce (hits 4 enemies)' },
      { slot: 4, description: '+5 pierce (hits 5 enemies)' },
      { slot: 5, description: '+6 pierce (hits 6 enemies)' },
      { slot: 6, description: '+7 pierce (hits 7 enemies)' },
      { slot: 7, description: '+8 pierce (hits 8 enemies)' },
    ],
    specialMechanics: 'Pierce count increases with slot position. TRAIL PASSTHROUGH: Bullets ignore enemy trails completely instead of bouncing off them. Excellent for guaranteed hits through dense formations.',
  },
  {
    index: 6,
    name: 'G',
    title: 'Grapheme G — Expanding Waves',
    summary: 'Fires expanding wave rings instead of bullets. Deactivates all graphemes to the LEFT.',
    effects: [
      { slot: 0, description: 'Expanding wave ring (3s expansion, 10px thickness)' },
      { slot: 1, description: 'Expanding wave ring' },
      { slot: 2, description: 'Expanding wave ring' },
      { slot: 3, description: 'Expanding wave ring' },
      { slot: 4, description: 'Expanding wave ring' },
      { slot: 5, description: 'Expanding wave ring' },
      { slot: 6, description: 'Expanding wave ring' },
      { slot: 7, description: 'Expanding wave ring' },
    ],
    specialMechanics: 'Wave damage is 10% of base shot damage. Ring expands over 3 seconds with 10px base thickness. CRITICAL: Deactivates all graphemes positioned to the LEFT of this grapheme.',
  },
  {
    index: 7,
    name: 'H',
    title: 'Grapheme H — Weapon Targeting',
    summary: 'Modifies weapon targeting behavior.',
    effects: [
      { slot: 0, description: 'Modified targeting behavior' },
      { slot: 1, description: 'Modified targeting behavior' },
      { slot: 2, description: 'Modified targeting behavior' },
      { slot: 3, description: 'Modified targeting behavior' },
      { slot: 4, description: 'Modified targeting behavior' },
      { slot: 5, description: 'Modified targeting behavior' },
      { slot: 6, description: 'Modified targeting behavior' },
      { slot: 7, description: 'Modified targeting behavior' },
    ],
    specialMechanics: 'Changes how the weapon selects and tracks targets. Exact mechanics vary by slot position.',
  },
  {
    index: 8,
    name: 'I',
    title: 'Grapheme I — Spread Bullets',
    summary: 'Fires multiple bullets in a spread pattern.',
    effects: [
      { slot: 0, description: '+2 extra bullets (3 total)' },
      { slot: 1, description: '+4 extra bullets (5 total)' },
      { slot: 2, description: '+6 extra bullets (7 total)' },
      { slot: 3, description: '+8 extra bullets (9 total)' },
      { slot: 4, description: '+8 extra bullets (9 total)' },
      { slot: 5, description: '+6 extra bullets (7 total)' },
      { slot: 6, description: '+4 extra bullets (5 total)' },
      { slot: 7, description: '+2 extra bullets (3 total)' },
    ],
    specialMechanics: 'Spread angle is π/6 radians (30 degrees). Bullet count mirrors around center slots (3-4 have maximum bullets). Pattern creates wide area coverage.',
  },
  {
    index: 9,
    name: 'J',
    title: 'Grapheme J — Elemental Effects',
    summary: 'Adds burning (slots 0-3) or freezing (slots 4-7) effects to bullets.',
    effects: [
      { slot: 0, description: 'Burning effect (5% max HP/sec)' },
      { slot: 1, description: 'Burning effect (5% max HP/sec)' },
      { slot: 2, description: 'Burning effect (5% max HP/sec)' },
      { slot: 3, description: 'Burning effect (5% max HP/sec)' },
      { slot: 4, description: 'Freezing effect (0.5s freeze)' },
      { slot: 5, description: 'Freezing effect (0.5s freeze)' },
      { slot: 6, description: 'Freezing effect (0.5s freeze)' },
      { slot: 7, description: 'Freezing effect (0.5s freeze)' },
    ],
    specialMechanics: 'BURNING (slots 0-3): Deals 5% of enemy max health per second as damage over time with red particle effects. FREEZING (slots 4-7): Immobilizes enemies for 0.5 seconds with ice blue visual.',
  },
  {
    index: 10,
    name: 'K',
    title: 'Grapheme K — Massive Bullet / Speed Boost',
    summary: 'Slots 0-6: Fires a massive slow bullet. Slot 7: Attack speed boost.',
    effects: [
      { slot: 0, description: 'Massive bullet: 20× size, 20× damage, 1/20 attack speed, 1/10 speed' },
      { slot: 1, description: 'Massive bullet: 20× size, 20× damage, 1/20 attack speed, 1/10 speed' },
      { slot: 2, description: 'Massive bullet: 20× size, 20× damage, 1/20 attack speed, 1/10 speed' },
      { slot: 3, description: 'Massive bullet: 20× size, 20× damage, 1/20 attack speed, 1/10 speed' },
      { slot: 4, description: 'Massive bullet: 20× size, 20× damage, 1/20 attack speed, 1/10 speed' },
      { slot: 5, description: 'Massive bullet: 20× size, 20× damage, 1/20 attack speed, 1/10 speed' },
      { slot: 6, description: 'Massive bullet: 20× size, 20× damage, 1/20 attack speed, 1/10 speed' },
      { slot: 7, description: 'Attack speed boost: 10× faster firing' },
    ],
    specialMechanics: 'Slots 0-6: Massive bullet mode with unlimited pierce and all effects automatically inflicted. Devastating against bosses but very slow. Slot 7: Pure speed boost without size/damage changes.',
  },
  {
    index: 11,
    name: 'L',
    title: 'Grapheme L — Continuous Beam',
    summary: 'Converts bullets into continuous beams. Deactivates LEFT and RIGHT neighbors.',
    effects: [
      { slot: 0, description: 'Continuous beam (3px width, 4 ticks/sec)' },
      { slot: 1, description: 'Continuous beam (3px width, 4 ticks/sec)' },
      { slot: 2, description: 'Continuous beam (3px width, 4 ticks/sec)' },
      { slot: 3, description: 'Continuous beam (3px width, 4 ticks/sec)' },
      { slot: 4, description: 'Continuous beam (3px width, 4 ticks/sec)' },
      { slot: 5, description: 'Continuous beam (3px width, 4 ticks/sec)' },
      { slot: 6, description: 'Continuous beam (3px width, 4 ticks/sec)' },
      { slot: 7, description: 'Continuous beam (3px width, 4 ticks/sec)' },
    ],
    specialMechanics: 'Beam width: 3px, applies damage 4 times per second, extends to edge of canvas (max 10000px). CRITICAL: Deactivates the graphemes immediately to the LEFT and RIGHT of this position.',
  },
  {
    index: 12,
    name: 'M',
    title: 'Grapheme M — Drifting Mines',
    summary: 'Spawns drifting mines that explode on contact with enemies.',
    effects: [
      { slot: 0, description: 'Drifting mines (30px/s drift, 100× explosion damage)' },
      { slot: 1, description: 'Drifting mines (30px/s drift, 100× explosion damage)' },
      { slot: 2, description: 'Drifting mines (30px/s drift, 100× explosion damage)' },
      { slot: 3, description: 'Drifting mines (30px/s drift, 100× explosion damage)' },
      { slot: 4, description: 'Drifting mines (30px/s drift, 100× explosion damage)' },
      { slot: 5, description: 'Drifting mines (30px/s drift, 100× explosion damage)' },
      { slot: 6, description: 'Drifting mines (30px/s drift, 100× explosion damage)' },
      { slot: 7, description: 'Drifting mines (30px/s drift, 100× explosion damage)' },
    ],
    specialMechanics: 'Mine spawn rate: (shots per second) / 20. Mines drift at 30 px/sec, explode for 100× base weapon damage in expanding wave (1.5s duration). Mines auto-despawn after 10 seconds. Mine size: 5px radius.',
  },
  {
    index: 13,
    name: 'N',
    title: 'Grapheme N — Swarm Ships',
    summary: 'Spawns tiny friendly triangles that fire green lasers at enemies.',
    effects: [
      { slot: 0, description: 'Swarm ships (8px size, 100px/s movement)' },
      { slot: 1, description: 'Swarm ships (8px size, 100px/s movement)' },
      { slot: 2, description: 'Swarm ships (8px size, 100px/s movement)' },
      { slot: 3, description: 'Swarm ships (8px size, 100px/s movement)' },
      { slot: 4, description: 'Swarm ships (8px size, 100px/s movement)' },
      { slot: 5, description: 'Swarm ships (8px size, 100px/s movement)' },
      { slot: 6, description: 'Swarm ships (8px size, 100px/s movement)' },
      { slot: 7, description: 'Swarm ships (8px size, 100px/s movement)' },
    ],
    specialMechanics: 'Ship count: (total graphemes) / 10, max 100 ships. Ships move at 100px/s within 80px swarm radius. Each ship fires green lasers (300px/s) at weapon attack speed / 10, dealing weapon damage / 10.',
  },
];

/**
 * Get a grapheme codex entry by index.
 */
export function getGraphemeCodexEntry(index) {
  return GRAPHEME_CODEX_ENTRIES.find(entry => entry.index === index) || null;
}

/**
 * Get a grapheme codex entry by name (letter A-N).
 */
export function getGraphemeCodexEntryByName(name) {
  return GRAPHEME_CODEX_ENTRIES.find(entry => entry.name === name.toUpperCase()) || null;
}

/**
 * Get all grapheme codex entries.
 */
export function getAllGraphemeCodexEntries() {
  return GRAPHEME_CODEX_ENTRIES;
}
