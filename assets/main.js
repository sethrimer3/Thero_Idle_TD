const tabs = document.querySelectorAll('.tab-button');
const panels = document.querySelectorAll('.panel');
let refreshStageStatus = () => {};

function setActiveTab(target) {
  tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === target;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-pressed', isActive);
  });

  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === target);
  });

  if (target === 'tower') {
    refreshStageStatus();
  }
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const { tab: target } = tab.dataset;
    setActiveTab(target);
  });
});

// keyboard navigation for accessibility
let focusedIndex = 0;

tabs.forEach((tab, index) => {
  tab.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      focusedIndex = index;
      if (event.key === 'ArrowRight') {
        focusedIndex = (focusedIndex + 1) % tabs.length;
      } else if (event.key === 'ArrowLeft') {
        focusedIndex = (focusedIndex - 1 + tabs.length) % tabs.length;
      }
      tabs[focusedIndex].focus();
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const target = tabs[focusedIndex].dataset.tab;
      setActiveTab(target);
    }
  });
});

const levelList = document.getElementById('level-list');

if (levelList) {
  const pathPresets = [
    {
      primary: 'M30 320 C140 250, 80 120, 200 110 C320 105, 320 260, 420 220 C520 180, 480 60, 340 40',
      secondary:
        'M60 300 C150 240, 120 150, 210 140 C320 125, 310 260, 420 230 C520 200, 470 80, 330 70',
      towers: [
        { cx: 130, cy: 230, r: 12 },
        { cx: 220, cy: 150, r: 12 },
        { cx: 320, cy: 210, r: 12 },
        { cx: 420, cy: 150, r: 12 },
      ],
      enemies: [
        { cx: 90, cy: 260, r: 6 },
        { cx: 230, cy: 180, r: 6 },
        { cx: 360, cy: 150, r: 6 },
      ],
    },
    {
      primary: 'M40 320 C120 280, 90 200, 180 180 C260 160, 260 80, 350 70 C440 60, 460 160, 520 140',
      secondary: 'M60 300 C140 260, 110 190, 190 170 C280 150, 270 100, 360 90 C440 80, 450 170, 500 160',
      towers: [
        { cx: 110, cy: 250, r: 12 },
        { cx: 210, cy: 200, r: 12 },
        { cx: 300, cy: 130, r: 12 },
        { cx: 420, cy: 120, r: 12 },
      ],
      enemies: [
        { cx: 80, cy: 290, r: 6 },
        { cx: 220, cy: 210, r: 6 },
        { cx: 410, cy: 140, r: 6 },
      ],
    },
    {
      primary:
        'M60 300 C160 260, 160 160, 240 150 C320 140, 320 60, 420 80 C520 100, 460 260, 340 250 C220 240, 180 330, 80 320',
      secondary:
        'M80 280 C150 250, 170 170, 240 160 C320 150, 330 90, 410 100 C490 110, 440 230, 330 220 C220 210, 200 310, 120 300',
      towers: [
        { cx: 150, cy: 260, r: 12 },
        { cx: 250, cy: 150, r: 12 },
        { cx: 360, cy: 200, r: 12 },
        { cx: 420, cy: 110, r: 12 },
      ],
      enemies: [
        { cx: 110, cy: 290, r: 6 },
        { cx: 280, cy: 170, r: 6 },
        { cx: 380, cy: 220, r: 6 },
      ],
    },
    {
      primary: 'M30 290 C120 230, 80 120, 170 110 C260 100, 250 210, 330 200 C410 190, 400 90, 490 80',
      secondary: 'M50 270 C130 220, 110 150, 180 140 C260 130, 260 220, 330 210 C400 200, 400 120, 470 110',
      towers: [
        { cx: 110, cy: 220, r: 12 },
        { cx: 200, cy: 150, r: 12 },
        { cx: 310, cy: 210, r: 12 },
        { cx: 430, cy: 150, r: 12 },
      ],
      enemies: [
        { cx: 90, cy: 250, r: 6 },
        { cx: 240, cy: 170, r: 6 },
        { cx: 370, cy: 180, r: 6 },
      ],
    },
    {
      primary: 'M40 310 C150 270, 130 190, 210 170 C290 150, 280 250, 360 230 C440 210, 420 130, 500 110',
      secondary: 'M70 290 C160 250, 140 200, 220 180 C300 160, 300 230, 380 210 C460 190, 430 140, 490 130',
      towers: [
        { cx: 130, cy: 240, r: 12 },
        { cx: 220, cy: 190, r: 12 },
        { cx: 320, cy: 220, r: 12 },
        { cx: 420, cy: 170, r: 12 },
      ],
      enemies: [
        { cx: 100, cy: 270, r: 6 },
        { cx: 250, cy: 200, r: 6 },
        { cx: 380, cy: 200, r: 6 },
      ],
    },
  ];

  const setData = [
    {
      name: 'Conjecture',
      entries: [
        {
          title: 'Conjecture – 1',
          mapName: 'Immortal Spiral 01',
          description:
            "A logarithmic ribbon corkscrews toward the board's heart, perfect for testing merged α + β beams.",
          example: "Goldbach's Conjecture",
          prestige: { progress: '2.5 → 4.0', reward: '+5% Σ damage' },
          enemyNotes: [
            { name: 'E₁ – E₃ Glyphlings', detail: 'Baseline foes displaying zeros as health digits.' },
            { name: 'Divisor Sprites', detail: 'Take damage at 1 ÷ DPS, rewarding precise α tuning.' },
            { name: 'Glyph Runners', detail: 'Quick arcs slowed when ε towers splash glyph dust.' },
          ],
          pathPreset: 0,
        },
        {
          title: 'Conjecture – 2',
          mapName: 'Immortal Spiral 02',
          description:
            'A zig-zag conjecture graph folds around itself, creating prime choke points for δ soldiers.',
          example: 'Collatz Conjecture',
          prestige: { progress: '4.0 → 6.4', reward: '+12 etched symbols' },
          enemyNotes: [
            { name: 'E₄ Glyph Bricks', detail: 'Stout enemies with 10,000 health equivalents.' },
            { name: 'Hitbound Rooks', detail: 'Require 6 hits regardless of damage—deploy fast α towers.' },
            { name: 'Divisor Wraiths', detail: 'Weaken more when γ support lowers DPS spikes.' },
          ],
          pathPreset: 1,
        },
        {
          title: 'Conjecture – 3',
          mapName: 'Immortal Spiral 03',
          description:
            'A figure-eight braid intersects mid-field, letting Ω prototypes rewind enemies through the crossing.',
          example: 'Riemann Hypothesis',
          prestige: { progress: '6.4 → 9.8', reward: '+1% Ω orbit range' },
          enemyNotes: [
            { name: 'E₅ Glyph Towers', detail: 'Digits stretch to 100,000 health, ideal for β pierce.' },
            { name: 'Countermarch Golems', detail: 'Upon defeat they reverse direction and fight for you.' },
            { name: 'Prime Siphons', detail: 'Drain α speed unless boosted by γ resonance.' },
          ],
          pathPreset: 2,
        },
        {
          title: 'Conjecture – 4',
          mapName: 'Immortal Spiral 04',
          description: 'A sine-wave corridor with alternating basins emphasizes splash zones for ε chains.',
          example: 'Twin Prime Conjecture',
          prestige: { progress: '9.8 → 14.2', reward: '+15% sand yield' },
          enemyNotes: [
            { name: 'E₆ Parades', detail: 'Million-health parades with steady pacing.' },
            { name: 'Divisor Heralds', detail: 'Best answered by towers balanced close to zero DPS variance.' },
            { name: 'Glyph Shepherds', detail: 'Convert defeated foes into temporary allies for δ squads.' },
          ],
          pathPreset: 3,
        },
        {
          title: 'Conjecture – 5',
          mapName: 'Immortal Spiral 05',
          description: 'Dual-channel lattices weave together, forcing precision tower placements for merged forms.',
          example: 'Hodge Conjecture',
          prestige: { progress: '14.2 → 20.0', reward: '+1 prestige shard' },
          enemyNotes: [
            { name: 'E₇ Processions', detail: 'Ten-million health juggernauts needing layered formulas.' },
            { name: 'Proofbound Sentinels', detail: 'Must be hit 12 times before damage applies.' },
            { name: 'Retrograde Oracles', detail: 'Send nearby foes backward on defeat—combo with Ω towers.' },
          ],
          pathPreset: 4,
        },
      ],
    },
    {
      name: 'Corollary',
      entries: [
        {
          title: 'Corollary – 1',
          mapName: 'Auric Corollary 06',
          description: 'Parallel loops underline supportive γ auras across mirrored straights.',
          example: 'All squares have right angles.',
          prestige: { progress: '20.0 → 26.4', reward: '+8% γ aura strength' },
          enemyNotes: [
            { name: 'E₈ Couriers', detail: 'Carry eight zeros of health through the corridor.' },
            { name: 'Angle-Snare Shades', detail: 'Slow towers unless countered with ε homing arcs.' },
            { name: 'Divisor Paladins', detail: '1 ÷ DPS scaling encourages balanced loadouts.' },
          ],
          pathPreset: 0,
        },
        {
          title: 'Corollary – 2',
          mapName: 'Auric Corollary 07',
          description: 'A diagonal proof run encourages delta soldiers to intercept early.',
          example: 'Angles in a triangle sum to 180°.',
          prestige: { progress: '26.4 → 33.0', reward: '+20 etched symbols' },
          enemyNotes: [
            { name: 'E₉ Columns', detail: 'Nine zeros of health—billions by default scaling.' },
            { name: 'Trihedral Flocks', detail: 'Split into three weaker E foes when destroyed.' },
            { name: 'Harmonic Binders', detail: 'Immune to slow but susceptible to δ soldier swarms.' },
          ],
          pathPreset: 1,
        },
        {
          title: 'Corollary – 3',
          mapName: 'Auric Corollary 08',
          description: 'A looping rose curve offers mid-lane intersections for Ω rewinds.',
          example: 'Parallel lines never meet.',
          prestige: { progress: '33.0 → 40.5', reward: '+2% powder drip' },
          enemyNotes: [
            { name: 'E₁₀ Hosts', detail: 'Endurance enemies with ten zeros of health.' },
            { name: 'Divergent Scribes', detail: 'Flip direction if not destroyed within 10 seconds.' },
            { name: 'Divisor Heralds', detail: 'Return to magnify towers nearest to zero DPS outputs.' },
          ],
          pathPreset: 2,
        },
        {
          title: 'Corollary – 4',
          mapName: 'Auric Corollary 09',
          description: 'Alternating crescents create rhythm lanes for ε slows.',
          example: 'Base angles of an isosceles triangle are equal.',
          prestige: { progress: '40.5 → 48.9', reward: '+1 Ω orbit' },
          enemyNotes: [
            { name: 'E₁₁ Lines', detail: 'Massive health carriers that favor long arcs.' },
            { name: 'Mirror Swarms', detail: 'Reflect first projectile—use splash or soldiers.' },
            { name: 'Powder Leeches', detail: 'Steal 5 grains/min unless defeated inside γ aura.' },
          ],
          pathPreset: 3,
        },
        {
          title: 'Corollary – 5',
          mapName: 'Auric Corollary 10',
          description: 'A braided double-helix ensures overlapping damage corridors.',
          example: 'Exterior angle equals sum of remote interior angles.',
          prestige: { progress: '48.9 → 58.2', reward: '+1 prestige shard' },
          enemyNotes: [
            { name: 'E₁₂ Braziers', detail: 'Twelve zeros of health—require full suite of merges.' },
            { name: 'Proofbound Palisades', detail: 'Need 18 hits; δ soldiers excel here.' },
            { name: 'Chrono Reverters', detail: 'Reverse path for nearby foes when stunned by Ω blast.' },
          ],
          pathPreset: 4,
        },
      ],
    },
    {
      name: 'Lemma',
      entries: [
        {
          title: 'Lemma – 1',
          mapName: 'Silver Lemma 11',
          description: 'Tight ellipses loop around defensive pillars, ideal for γ amplifiers.',
          example: "Zorn's Lemma",
          prestige: { progress: '58.2 → 68.4', reward: '+3% soldier rally speed' },
          enemyNotes: [
            { name: 'E₁₃ Trains', detail: 'Thirteen zeros of health with constant pressure.' },
            { name: 'Divisor Orbs', detail: 'Explode for bonus powder when struck by balanced Ω towers.' },
            { name: 'Glyph Swarmers', detail: 'Spawn mini E foes unless slain by splash.' },
          ],
          pathPreset: 0,
        },
        {
          title: 'Lemma – 2',
          mapName: 'Silver Lemma 12',
          description: 'Intersecting crescents highlight mid-path buff placement.',
          example: 'Noetherian Induction Lemma',
          prestige: { progress: '68.4 → 79.5', reward: '+1 γ slot' },
          enemyNotes: [
            { name: 'E₁₄ Columns', detail: 'Fourteen zeros of health; slow but relentless.' },
            { name: 'Hitbound Bishops', detail: 'Require 22 hits—β pierce chains help meet quotas.' },
            { name: 'Powder Huskers', detail: 'Drop etched symbols when defeated by δ squads.' },
          ],
          pathPreset: 1,
        },
        {
          title: 'Lemma – 3',
          mapName: 'Silver Lemma 13',
          description: 'A cardioid path loops near spawn, perfect for early splash combos.',
          example: 'Urysohn Lemma',
          prestige: { progress: '79.5 → 91.5', reward: '+3% powder drip' },
          enemyNotes: [
            { name: 'E₁₅ Cohorts', detail: 'Fifteen zeros of health with regen pulses.' },
            { name: 'Divisor Acolytes', detail: 'Damage scales with inverse DPS; keep numbers tidy.' },
            { name: 'Sandglass Phantoms', detail: 'Phase out unless slowed by ε towers.' },
          ],
          pathPreset: 2,
        },
        {
          title: 'Lemma – 4',
          mapName: 'Silver Lemma 14',
          description: 'Switchback lines allow δ soldiers to flank from both sides.',
          example: "Schur's Lemma",
          prestige: { progress: '91.5 → 104.4', reward: '+2 prestige shards' },
          enemyNotes: [
            { name: 'E₁₆ Walls', detail: 'Sixteen zeros of health with steady armor.' },
            { name: 'Proofbound Knights', detail: 'Need 25 hits and resist splash unless slowed.' },
            { name: 'Countermarch Heralds', detail: 'Rewind and join you when defeated by Ω towers.' },
          ],
          pathPreset: 3,
        },
        {
          title: 'Lemma – 5',
          mapName: 'Silver Lemma 15',
          description: 'A lemniscate culminates with double choke points for arcane combos.',
          example: "Lusin's Lemma",
          prestige: { progress: '104.4 → 118.2', reward: '+5% Ω damage' },
          enemyNotes: [
            { name: 'E₁₇ Processions', detail: 'Seventeen zeros of health with shielding layers.' },
            { name: 'Divisor Monks', detail: 'Scale inversely with DPS—counter with γ/ε synergy.' },
            { name: 'Glyph Turncoats', detail: 'Reverse allegiance when hit by α boosted projectiles.' },
          ],
          pathPreset: 4,
        },
      ],
    },
    {
      name: 'Proposition',
      entries: [
        {
          title: 'Proposition – 1',
          mapName: 'Gilded Proposition 16',
          description: 'An hourglass corridor encourages alternating support and damage towers.',
          example: 'Sum of two even numbers is even.',
          prestige: { progress: '118.2 → 133.8', reward: '+4% soldier pierce' },
          enemyNotes: [
            { name: 'E₁₈ Patrols', detail: 'Eighteen zeros of health with alternating speed bursts.' },
            { name: 'Divisor Judges', detail: 'Punish towers with wildly high DPS spikes.' },
            { name: 'Proofbound Arbiters', detail: 'Need 28 hits; delta squads thrive.' },
          ],
          pathPreset: 0,
        },
        {
          title: 'Proposition – 2',
          mapName: 'Gilded Proposition 17',
          description: 'Two intertwined spirals create harmonic interference zones.',
          example: 'Product of odd numbers is odd.',
          prestige: { progress: '133.8 → 150.3', reward: '+3 prestige shards' },
          enemyNotes: [
            { name: 'E₁₉ Choirs', detail: 'Nineteen zeros of health singing speed buffs.' },
            { name: 'Harmonic Nulls', detail: 'Silence γ auras unless protected by Ω pulses.' },
            { name: 'Divisor Heralds', detail: 'React best to balanced β beams.' },
          ],
          pathPreset: 1,
        },
        {
          title: 'Proposition – 3',
          mapName: 'Gilded Proposition 18',
          description: 'A cardioid into crescent fosters splash loops for ε towers.',
          example: 'If a divides b and b divides c, then a divides c.',
          prestige: { progress: '150.3 → 168.7', reward: '+4% powder drip' },
          enemyNotes: [
            { name: 'E₂₀ Columns', detail: 'Twenty zeros of health—tower synergy is required.' },
            { name: 'Chainbound Sentinels', detail: 'Require consecutive hits from different tower types.' },
            { name: 'Countermarch Sages', detail: 'Flip allegiance when slowed to zero.' },
          ],
          pathPreset: 2,
        },
        {
          title: 'Proposition – 4',
          mapName: 'Gilded Proposition 19',
          description: 'A fractal stairway pushes foes past repeating buff points.',
          example: 'The sum of interior angles of a pentagon is 540°.',
          prestige: { progress: '168.7 → 189.0', reward: '+2 γ slots' },
          enemyNotes: [
            { name: 'E₂₁ Vaults', detail: 'Twenty-one zeros of health with layered armor.' },
            { name: 'Hitbound Wards', detail: 'Need 36 hits; coordinate α barrages.' },
            { name: 'Divisor Golems', detail: 'Explode dealing 1 ÷ DPS to nearby foes when slain by Ω.' },
          ],
          pathPreset: 3,
        },
        {
          title: 'Proposition – 5',
          mapName: 'Gilded Proposition 20',
          description: 'Twin braids cross four times, enabling deep Ω rewinds.',
          example: 'If two lines are perpendicular to the same line they are parallel.',
          prestige: { progress: '189.0 → 211.2', reward: '+6% Ω shockwaves' },
          enemyNotes: [
            { name: 'E₂₂ Phalanx', detail: 'Twenty-two zeros of health with regen barrier.' },
            { name: 'Divisor Viziers', detail: 'Lower tower DPS temporarily, forcing γ support use.' },
            { name: 'Proofbound Wraiths', detail: 'Need 40 hits; δ soldiers auto-track them.' },
          ],
          pathPreset: 4,
        },
      ],
    },
    {
      name: 'Theorem',
      entries: [
        {
          title: 'Theorem – 1',
          mapName: 'Ivory Theorem 21',
          description: 'A spiral stair empties into a broad plane ideal for coordinated merges.',
          example: 'Pythagorean Theorem',
          prestige: { progress: '211.2 → 235.3', reward: '+5 prestige shards' },
          enemyNotes: [
            { name: 'E₂₃ Columns', detail: 'Twenty-three zeros of health with shield rotations.' },
            { name: 'Hypotenuse Wardens', detail: 'Require alternating splash and pierce to break.' },
            { name: 'Divisor Architects', detail: 'Invert damage spikes if α is not balanced with β.' },
          ],
          pathPreset: 0,
        },
        {
          title: 'Theorem – 2',
          mapName: 'Ivory Theorem 22',
          description: 'A smooth logarithmic expansion invites long-range Ω coverage.',
          example: 'Fundamental Theorem of Calculus',
          prestige: { progress: '235.3 → 261.3', reward: '+6% powder surge' },
          enemyNotes: [
            { name: 'E₂₄ Engines', detail: 'Twenty-four zeros of health accelerate over time.' },
            { name: 'Integral Shades', detail: 'Absorb damage-over-time; rely on burst hits.' },
            { name: 'Divisor Chronics', detail: 'Take 1 ÷ DPS per tick but heal if DPS spikes wildly.' },
          ],
          pathPreset: 1,
        },
        {
          title: 'Theorem – 3',
          mapName: 'Ivory Theorem 23',
          description: 'Clover loops create repeating support pockets for γ towers.',
          example: 'Central Limit Theorem',
          prestige: { progress: '261.3 → 289.2', reward: '+3 γ aura radius' },
          enemyNotes: [
            { name: 'E₂₅ Arrays', detail: 'Twenty-five zeros of health; spawn in batches.' },
            { name: 'Variance Witches', detail: 'Randomize tower targeting unless slowed.' },
            { name: 'Proofbound Golems', detail: 'Need 45 hits; δ soldiers can keep pace.' },
          ],
          pathPreset: 2,
        },
        {
          title: 'Theorem – 4',
          mapName: 'Ivory Theorem 24',
          description: 'A Fourier-like wave demands adaptable tower placements.',
          example: "Green's Theorem",
          prestige: { progress: '289.2 → 319.0', reward: '+7% Ω rewind distance' },
          enemyNotes: [
            { name: 'E₂₆ Currents', detail: 'Twenty-six zeros of health with swirling motion.' },
            { name: 'Curl Phantoms', detail: 'Immune to straight shots—use splash/homing.' },
            { name: 'Divisor Flux', detail: 'Damage increases as DPS approaches zero.' },
          ],
          pathPreset: 3,
        },
        {
          title: 'Theorem – 5',
          mapName: 'Ivory Theorem 25',
          description: 'An infinity path loops thrice, maximizing Ω recursion.',
          example: "Noether's Theorem",
          prestige: { progress: '319.0 → 350.7', reward: '+8% idle sand multiplier' },
          enemyNotes: [
            { name: 'E₂₇ Monoliths', detail: 'Twenty-seven zeros of health resisting slows.' },
            { name: 'Symmetry Breakers', detail: 'Ignore damage until affected by γ aura.' },
            { name: 'Divisor Reveries', detail: 'Reward near-zero DPS towers with massive crits.' },
          ],
          pathPreset: 4,
        },
      ],
    },
    {
      name: 'Axiom',
      entries: [
        {
          title: 'Axiom – 1',
          mapName: 'Obsidian Axiom 26',
          description: 'Straight authority lines demand flawless pacing and support.',
          example: 'Through any two points, one line exists.',
          prestige: { progress: '350.7 → 384.3', reward: '+10 prestige shards' },
          enemyNotes: [
            { name: 'E₂₈ Pillars', detail: 'Twenty-eight zeros of health with armor rotations.' },
            { name: 'Line Judges', detail: 'Reflect first projectile—lean on splash or summons.' },
            { name: 'Divisor Bishops', detail: 'Take 1 ÷ DPS and punish high-variance towers.' },
          ],
          pathPreset: 0,
        },
        {
          title: 'Axiom – 2',
          mapName: 'Obsidian Axiom 27',
          description: 'Stacked waveforms mimic layered axiomatic proofs.',
          example: 'A thing is identical with itself.',
          prestige: { progress: '384.3 → 419.8', reward: '+9% powder surge' },
          enemyNotes: [
            { name: 'E₂₉ Vaults', detail: 'Twenty-nine zeros of health and self-healing shields.' },
            { name: 'Identity Wards', detail: 'Mirror tower stats unless stunned by Ω blasts.' },
            { name: 'Proofbound Sages', detail: 'Need 55 hits; δ swarms can shred them.' },
          ],
          pathPreset: 1,
        },
        {
          title: 'Axiom – 3',
          mapName: 'Obsidian Axiom 28',
          description: 'Rotating polygons keep towers pivoting between lanes.',
          example: 'The whole is greater than the part.',
          prestige: { progress: '419.8 → 457.2', reward: '+10% Ω range' },
          enemyNotes: [
            { name: 'E₃₀ Sigils', detail: 'Thirty zeros of health and rotating armor faces.' },
            { name: 'Divisor Arbiters', detail: 'Empowered when towers overkill by wide margins.' },
            { name: 'Countermarch Emperors', detail: 'Rejoin your forces permanently after an Ω rewind.' },
          ],
          pathPreset: 2,
        },
        {
          title: 'Axiom – 4',
          mapName: 'Obsidian Axiom 29',
          description: 'Opposing crescents converge toward the center for final sieges.',
          example: 'If equals are added to equals, the wholes are equal.',
          prestige: { progress: '457.2 → 496.5', reward: '+12% idle sand multiplier' },
          enemyNotes: [
            { name: 'E₃₁ Colossi', detail: 'Thirty-one zeros of health with damage reduction auras.' },
            { name: 'Balance Keepers', detail: 'Split damage evenly between towers—use soldiers to tip scales.' },
            { name: 'Divisor Regents', detail: 'Reduce tower DPS toward zero, amplifying Ω rebounds.' },
          ],
          pathPreset: 3,
        },
        {
          title: 'Axiom – 5',
          mapName: 'Obsidian Axiom 30',
          description: 'A closed axiomatic circle completes the campaign arc.',
          example: 'Things equal to the same thing are equal to each other.',
          prestige: { progress: '496.5 → 538.7', reward: '+15 prestige shards' },
          enemyNotes: [
            { name: 'E₃₂ Thrones', detail: 'Thirty-two zeros of health with adaptive resistance.' },
            { name: 'Divisor Sovereigns', detail: 'Convert high DPS shots into self-heals—balance with γ aura.' },
            { name: 'Chrono Paragons', detail: 'On defeat rewind entire waves to fight for you briefly.' },
          ],
          pathPreset: 4,
        },
      ],
    },
  ];

  const levels = [];
  setData.forEach((set, setIndex) => {
    set.entries.forEach((entry, entryIndex) => {
      const level = {
        id: `${set.name.toLowerCase()}-${entryIndex + 1}`,
        setName: set.name,
        setIndex,
        orderInSet: entryIndex + 1,
        absoluteOrder: setIndex * 5 + entryIndex + 1,
        entered: false,
        ...entry,
      };
      entry.levelId = level.id;
      levels.push(level);
    });
  });

  const levelMap = new Map(levels.map((level) => [level.id, level]));

  const levelTitle = document.getElementById('level-title');
  const levelDescription = document.getElementById('level-description');
  const levelStatus = document.getElementById('level-status');
  const playButton = document.getElementById('level-action');
  const overlay = document.getElementById('level-overlay');
  const overlayLabel = document.getElementById('overlay-label');
  const overlayExample = document.getElementById('overlay-example');
  const trackPrimary = document.getElementById('track-path-primary');
  const trackSecondary = document.getElementById('track-path-secondary');
  const towerGroup = document.getElementById('tower-pips');
  const enemyGroup = document.getElementById('enemy-orbs');
  const prestigeHeading = document.getElementById('prestige-heading');
  const prestigeProgress = document.getElementById('prestige-progress');
  const prestigeReward = document.getElementById('prestige-reward');
  const enemyRoster = document.getElementById('enemy-roster');

  let selectedLevelId = null;
  let activeLevelId = null;
  let pendingOverlayLevelId = null;

  function createCircle(group, { cx, cy, r }) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', r);
    group.appendChild(circle);
  }

  function renderLevelList() {
    levelList.innerHTML = '';
    setData.forEach((set) => {
      const container = document.createElement('div');
      container.className = 'level-list-group';

      const heading = document.createElement('h3');
      heading.className = 'level-set-label';
      heading.textContent = `${set.name} Set`;
      container.appendChild(heading);

      const list = document.createElement('ul');
      list.className = 'level-items';

      set.entries.forEach((entry) => {
        const level = levelMap.get(entry.levelId);
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'level-item';
        button.dataset.level = level.id;

        const name = document.createElement('p');
        name.className = 'level-name';
        name.textContent = level.title;

        const meta = document.createElement('p');
        meta.className = 'level-meta';
        meta.textContent = `Stage ${level.orderInSet} • Set ${level.setIndex + 1}`;

        const example = document.createElement('p');
        example.className = 'level-example';
        example.textContent = `Example: ${level.example}`;

        button.append(name, meta, example);
        button.addEventListener('click', () => selectLevel(level.id));
        item.appendChild(button);
        list.appendChild(item);
      });

      container.appendChild(list);
      levelList.appendChild(container);
    });
  }

  function updateLevelListActive() {
    const buttons = levelList.querySelectorAll('.level-item');
    buttons.forEach((button) => {
      button.classList.toggle('active', button.dataset.level === selectedLevelId);
    });
  }

  function renderPaths(level) {
    const preset = pathPresets[level.pathPreset % pathPresets.length];
    trackPrimary.setAttribute('d', preset.primary);
    trackSecondary.setAttribute('d', preset.secondary);

    towerGroup.innerHTML = '';
    preset.towers.forEach((tower) => createCircle(towerGroup, tower));

    enemyGroup.innerHTML = '';
    preset.enemies.forEach((enemy) => createCircle(enemyGroup, enemy));
  }

  function renderPrestige(level) {
    prestigeHeading.textContent = `${level.setName} Tribute`;
    prestigeProgress.innerHTML = `<strong>Ξ Progress:</strong> ${level.prestige.progress}`;
    prestigeReward.innerHTML = `<strong>Reward:</strong> ${level.prestige.reward}`;
  }

  function renderEnemyRoster(level) {
    enemyRoster.innerHTML = '';
    level.enemyNotes.forEach((note) => {
      const item = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'enemy-name';
      name.textContent = note.name;
      const detail = document.createElement('p');
      detail.className = 'enemy-detail';
      detail.textContent = note.detail;
      item.append(name, detail);
      enemyRoster.appendChild(item);
    });
  }

  function formatStatus(level) {
    const totalSets = setData.length;
    const parts = [
      `${level.title}`,
      `Set ${level.setIndex + 1}/${totalSets}`,
      `Stage ${level.orderInSet}/5`,
    ];
    let state = 'Not Entered';
    if (level.entered && activeLevelId !== level.id) {
      state = 'Awaiting resume';
    }
    if (activeLevelId === level.id) {
      state = 'Running';
    }
    parts.push(`Status: ${state}`);
    if (activeLevelId && activeLevelId !== level.id) {
      const active = levelMap.get(activeLevelId);
      parts.push(`Active: ${active.title}`);
    }
    return parts.join(' • ');
  }

  function updatePlayButton(level) {
    if (!level) {
      playButton.disabled = true;
      playButton.textContent = 'Enter Level';
      return;
    }
    if (activeLevelId && activeLevelId !== level.id) {
      playButton.disabled = true;
      playButton.textContent = 'Level running elsewhere';
      return;
    }
    playButton.disabled = false;
    if (activeLevelId === level.id) {
      playButton.textContent = 'Leave Level';
    } else if (level.entered) {
      playButton.textContent = 'Resume Level';
    } else {
      playButton.textContent = 'Enter Level';
    }
  }

  function updateLevelStatus(level) {
    if (!level) {
      levelStatus.textContent = 'Select a stage to begin.';
      return;
    }
    levelStatus.textContent = formatStatus(level);
    updatePlayButton(level);
  }

  function renderLevel(level) {
    levelTitle.textContent = level.mapName;
    levelDescription.textContent = level.description;
    renderPaths(level);
    renderPrestige(level);
    renderEnemyRoster(level);
    updateLevelStatus(level);
  }

  function selectLevel(levelId) {
    if (!levelMap.has(levelId)) {
      return;
    }
    selectedLevelId = levelId;
    updateLevelListActive();
    renderLevel(levelMap.get(levelId));
  }

  function startLevel(level) {
    activeLevelId = level.id;
    level.entered = true;
    updateLevelStatus(level);
  }

  function leaveLevel(level) {
    if (activeLevelId !== level.id) {
      return;
    }
    activeLevelId = null;
    updateLevelStatus(level);
  }

  function showOverlay(level) {
    pendingOverlayLevelId = level.id;
    overlayLabel.textContent = `${level.title} • ${level.setName} Set`;
    overlayExample.textContent = level.example;
    overlay.classList.add('visible');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.focus();
  }

  function hideOverlay() {
    overlay.classList.remove('visible');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function handleOverlayDismiss() {
    if (!pendingOverlayLevelId) {
      hideOverlay();
      return;
    }
    const level = levelMap.get(pendingOverlayLevelId);
    hideOverlay();
    startLevel(level);
    pendingOverlayLevelId = null;
  }

  playButton.addEventListener('click', () => {
    if (!selectedLevelId) {
      return;
    }
    const level = levelMap.get(selectedLevelId);
    if (activeLevelId && activeLevelId !== level.id) {
      return;
    }
    if (activeLevelId === level.id) {
      leaveLevel(level);
      return;
    }
    if (!level.entered) {
      showOverlay(level);
    } else {
      startLevel(level);
    }
  });

  overlay.addEventListener('click', handleOverlayDismiss);
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOverlayDismiss();
    }
  });

  function refreshStage() {
    if (!selectedLevelId) {
      levelStatus.textContent = 'Select a stage to begin.';
      return;
    }
    updateLevelStatus(levelMap.get(selectedLevelId));
  }

  refreshStageStatus = refreshStage;

  renderLevelList();
  if (levels.length > 0) {
    selectLevel(levels[0].id);
  }
} else {
  refreshStageStatus = () => {};
}

setActiveTab('tower');
