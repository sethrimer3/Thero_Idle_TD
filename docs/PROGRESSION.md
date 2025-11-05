# Thero Idle – Progression Notes

## Level Structure
- The game now features **30 total levels** grouped into six five-level sets.
- Sets unlock in reverse proof order: Hypothesis (0, tutorial level), Conjecture (1–5), Corollary (6–10), Lemma (11–15), Proof (16–20), Theorem (21–25), and Axiom (26–30).
- Each level is built around an "immortal defense" style lane defined by a math-graph expression (figure-eights, logarithmic spirals, cardioids, etc.).
- When a level is entered **for the first time** the screen fades to black and displays a hallmark statement for that set (e.g., Goldbach's Conjecture). Subsequent visits skip the fade.
- Entered levels continue running when the player navigates to other tabs; use "Leave Current Level" on the Stage tab to reset wave flow.

### Path Landmarks & Visual Rhythm
- Every level renders a **distinct origin sigil** at the path entrance and a **termination glyph** at the core. These visuals borrow from the set theme (e.g., Conjecture sigils resemble parchment hypotheses; Proof endings resemble sealed Q.E.D. stamps) so players can instantly read both direction and flavor.
- The lane itself breathes with a **travelling arc-light**—a subtle pulse that sweeps from start to finish every few seconds. The effect highlights curvature, communicates traversal order, and doubles as a timing cue for towers whose attacks key off path position.
- Special interaction nodes (teleports, reversals, powder vents) echo the arc-light palette so that the sweeping glow stitches all navigation beats together without overpowering the monochrome base.

### Dynamic Formula Spotlight Levels
Each five-level set designates at least one **spotlight stage** whose path is governed by a live mathematical formula that evolves during play. These maps teach the player to read formula-driven layouts by letting the geometry respond to their actions:

- **Hypothesis – S1 · Chalk Line Primer** uses a straight-line path whose length `ℓ(n)` shortens by `Δℓ = 0.05 · n` for every tower placed (`n =` active towers). The shrinking route teaches players to set up kill-boxes before the entrance collapses onto the core.
- **Conjecture – 2 · Collatz Cascade** already shortens its descent when players place new towers, mirroring the halving steps of the `3n + 1` routine.
- **Corollary – S1 · Pascal Circlet** begins as a unit circle (`r = 1`) around the core and decreases its radius by `Δr = 0.02` whenever an enemy is eliminated, gradually exposing shortcut diagonals that reward precise focus fire.
- **Lemma – 14 · Möbius Rind** tightens its corkscrew by shrinking the radius of its inner loop with every slowed enemy, forcing towers to adapt as the lane collapses inward.
- **Proof – S1 · Hilbert Flux** rearranges its space-filling turns by applying a discrete Hilbert iteration whenever enemies breach checkpoints, creating new corners that slide toward the exit until the wave is stabilized.
- **Theorem – 22 · Fourier Aurora** retunes its wavelength after enemies fall, causing the polar path to contract and expand like a living waveform.
- **Axiom – S1 · Variable Axiom** (new spotlight level) showcases a **shrinking conic spiral** whose radius `r(t)` decreases as enemies are defeated while the endpoint drifts to stay tangent to the moving curve. Tower placement also clips a secondary chord that shortens in proportion to total deployed cost, visually narrating endgame economic pressure.

Future spotlight stages will explore other live formulas (area-minimizing surfaces, Lissajous knots, stochastic walks) so that advanced sets continue to remix traversal shapes in direct response to the player's decisions.

### Conjecture Set (Levels 1–5)
1. **Conjecture – 1 · Lemniscate Hypothesis** – Figure-eight path generated from `r² = cos(2θ)`; introduces divisor scouts.
2. **Conjecture – 2 · Collatz Cascade** – Tiered descent inspired by the `3n + 1` map with teleport risers and hit-count enemies.
3. **Conjecture – 3 · Riemann Helix** – Logarithmic spiral tuned to ζ zero estimates; favors splash slows.
4. **Conjecture – 4 · Twin Prime Fork** – Dual rails connected by prime gaps; rewards rapid chaining damage.
5. **Conjecture – 5 · Birch Flow** – Cardioid river influenced by elliptic curve ranks; showcases enemy reversal mechanics.

### Corollary Set (Levels 6–10)
6. **Corollary – 6 · Eulerian Strand** – Braided Möbius belt that alternates lane parity; introduces parity locks that reward alternating tower types.
7. **Corollary – 7 · Pascal Bloom** – Expanding binomial petals whose lanes duplicate every seventh wave; binomial buff enemies copy the strongest nearby aura.
8. **Corollary – 8 · Catalan Grove** – Interlocking lattice walk with branching forks; features Catalan guardians that split into two mirror copies when slowed.
9. **Corollary – 9 · Fermat Prism** – Three spiraling planes rotating in prime exponents; hypotenuse runners gain shields proportional to remaining path length.
10. **Corollary – 10 · Sylow Circuit** – Nested group loops that rewire based on tower merges; enemies swap resistances when the player fuses towers mid-wave.

### Lemma Set (Levels 11–15)
11. **Lemma – 11 · Abel Cascade** – Waterfall descent using commutator switches; river nodes invert projectile order, testing burst versus beam timing.
12. **Lemma – 12 · Noether Weave** – Symmetry-rich ringroads whose portals preserve DPS sums; enemies trade positions when struck by support glyphs.
13. **Lemma – 13 · Erdős Drift** – Random-graph tramlines that shuffle lane adjacency; probabilistic smugglers reroute toward the longest surviving enemy.
14. **Lemma – 14 · Möbius Rind** – Inside-out corkscrew track; sign-flip sentries grant negative armor that amplifies epsilon burn damage.
15. **Lemma – 15 · Ramanujan Bloom** – Lotus of nested circles keyed to modular forms; resonance echoes cause defeated foes to spawn low-HP harmonic clones.

### Proof Set (Levels 16–20)
16. **Proof – 16 · Hilbert Fold** – Space-filling fractal corridor; dimensional walkers slip through walls unless slowed by delta caserns.
17. **Proof – 17 · Gödel Labyrinth** – Self-referencing maze with locked axioms; paradox custodians revive unless struck by three distinct tower classes.
18. **Proof – 18 · Turing Spire** – Vertical tape ascent with binary toggles; automaton foes flip between vulnerable and immune states based on attack parity.
19. **Proof – 19 · Cantor Verge** – Fragmented coastline path removing middle thirds; lacuna spirits leap gaps, forcing chained knockback to corral them.
20. **Proof – 20 · Jordan Curve Bastion** – Contour fortress wrapped around the core; enclosure judges stun towers that let enemies slip past twice.

### Theorem Set (Levels 21–25)
21. **Theorem – 21 · Gauss Orchard** – Hexagonal orchard aligned to quadratic residues; orchard keepers gain bonus armor on squares, incentivizing splash setups.
22. **Theorem – 22 · Fourier Aurora** – Polar halo with wavelength lanes; harmonics build up if projectiles lack variety, demanding mixed damage types.
23. **Theorem – 23 · Nash Spiral** – Competitive spiral with alternating payoff nodes; adversary agents gain buffs if lanes are left unattended for long.
24. **Theorem – 24 · Riesz Parallax** – Dual parabolic arches with shared intercepts; projection ghosts mirror the lead enemy unless frozen simultaneously.
25. **Theorem – 25 · Poincaré Bloom** – Hypersphere cross-section with teleport seams; flarebitters detonate when touching seams, punishing clustered defenses.

### Axiom Set (Levels 26–30)
26. **Axiom – 26 · Zorn Horizon** – Infinite-descending plateau where gravity reverses; maximal chains of foes gain shields until toppled by omega strikes.
27. **Axiom – 27 · Löwenheim Gate** – Towering quantifier gates that rescale enemy size; shrinking glyphs slip through gaps unless slowed by sigma snares.
28. **Axiom – 28 · Grothendieck Loom** – Category lattice weaving incoming paths; functor heralds copy the highest-tier tower stats once per wave.
29. **Axiom – 29 · Tarski Reflection** – Mirror arena with delayed reflections; each enemy spawns a spectral double that retraces steps with inverted resistances.
30. **Axiom – 30 · Peano Genesis** – Final spiral constructed from recursive integers; successor titans rebuild lost segments unless powderfall seals are lit.

Future sets escalate enemy modifiers and map complexity but follow the same five-level cadence with new example statements.

## Tower Evolution
The tower roster now explicitly runs through the entire Greek alphabet from **α** to **ω**, with each lowercase glyph defining a unique tactical role and an evocative mathematical formula. Core rules for collecting, merging, and prestiging towers now follow these tenets:

- **Connection notation:** Dynamic connection counts use the source tower's lowercase letter with a subscript denoting the lattice that consumes it (e.g., `α_γ` tallies α lattices linked to γ).
- **Equation evaluation layout:** Numeric evaluations beneath formulas place the computed result on the left (e.g., `2.50 = 5.00 × 0.50`).
- **Aleph counter embedding:** Whenever a variable references an Aleph glyph (ℵₙ), keep its `+ / −` glyph allocator inside the same variable card that uses it. List the Aleph sub-equation directly under the parent formula and display the allocator with the matching ℵ subscript (e.g., ℵ₁). Standalone Aleph boxes are deprecated; if a rank is capped, add a `MAX: n` line beneath the cost callout.

- **Five-of-a-kind prestige:** Once the player can simultaneously afford and field **five matching lowercase towers**, they may perform a *tower prestige* to fuse them into the corresponding uppercase glyph. The prestige keeps the lowercase formula but adds one powerful, easy-to-track mutation described below.
- **Uppercase uniqueness:** Only **one uppercase tower of each letter** may exist on the field at a time. While an uppercase tower is deployed, the player may not place additional lowercase towers of that letter.
- **Population accounting:** For all mechanics that scale with tower counts (including formulas that reference `n`, adjacency checks, or synergies), a single uppercase tower counts as **five lowercase towers of its letter**.
- **Merge ladder:** Players may still merge adjacent lowercase towers alphabetically (α into β, β into γ, and so on), but the prestige path offers a sideways option that preserves the flavor of the lowercase while unlocking late-game power spikes.
- **Cost cadence:** Tower costs escalate exponentially with simultaneous copies. Building the `k`‑th instance of a given lowercase letter costs `(base cost)^k`. Fusing or prestiging refunds the cost pressure because active tower counts drop by four when five become one.

### Universal Variable Glossary
To keep formulas readable across the roster, every tower draws from a shared set of variable glyphs. The table below catalogs the evergreen symbols now surfaced in the in-game glossary. As new lattices unlock, additional situational variables (such as tempo `Tmp`) may join, but the core abbreviations will not change meaning from tower to tower.

| Symbol | Name | Description | First Appears |
| --- | --- | --- | --- |
| **Atk** | Attack | Base damage delivered per strike. | α tower primary stat |
| **m** | Range | Effective attack radius measured in meters. | Global tower stats |
| **Spd** | Attack Speed | Primary attack cadence (attacks per second). | α tower primary stat |
| **Dod** | Damage over Distance | Bonus damage accumulated as projectiles travel. | Soldier-focused upgrades |
| **Def** | Defense | Flat protection applied to delta-style cohorts. | δ tower schematics |
| **Def%** | Defense Percent | Percentage-based defense modifier for cohorts. | Soldier research trees |
| **Atk%** | Attack Percent | Percentage multiplier applied to base attack. | Offensive upgrade suites |
| **Prc** | Pierce | Number of enemies a strike can pierce before dissipating. | Beam-oriented towers |
| **Chn** | Chaining | Additional enemies a projectile can arc toward. | Chain lightning variants |
| **Slw%** | Slow Percent | Percentage slow applied to enemies within an effect. | Control-focused towers |
| **Tot** | Total | Maximum allied units a command lattice fields simultaneously. | δ delta tower |

### Lowercase and Uppercase Glyph Index
Each entry combines three beats: a flavorful formula, a combat mechanic, and a hidden nod to the mathematical symbol from which the glyph draws power. The uppercase prestige upgrade reiterates the same formula and layers on one decisive bonus.

| Letter Pair | Lowercase Formula & Core Behavior | Symbolic Parallel & Combat Quirk | Uppercase Prestige Mutation |
| --- | --- | --- | --- |
| Α / α | `α = Atk` channels a glyph-forged baseline where `Atk = 5·Ψ₁`. | Alpha launches the first strike with calibratable pulses. | **Α** channels the same glyph surge and layers a bonus burst whenever Ψ₁ levels up. |
| Β / β | `β : Atk = α, Rng = Ψ₁` braids α's force with the opening glyph tier. | Beta mirrors α's attack while extending its reach by the first Ψ lattice. | **Β** keeps the mirrored strike and folds the Ψ₁ reach into a reflected beam on return. |
| Γ / γ | `γ : Atk = β, Spd = Ψ₁, Rng = Ψ₂, Prc = Ψ₃` orchestrates layered glyph pacing. | Gamma inherits β's bite, attacks at Ψ₁ tempo, ranges by Ψ₂, and pierces through Ψ₃ strata. | **Γ** maintains the full glyph cadence and adds an aftershock equal to 25% of the carried Ψ throughput. |
| Δ / δ | `δ = γ · ln(γ + 1)` summons cohorts scaled by γ alone. | Delta embodies change, commanding glyph soldiers from pure γ strength while `Tot` governs how many specters rally at once. | **Δ** keeps the logarithmic command and leaves a slowing field keyed to the same γ value. |
| Ε / ε | `ε = δ^{2}` squares delta into needle storms. | Epsilon erupts when δ squads collide, doubling their force. | **Ε** sustains the squared storm and freezes enemy armor at the lowest sampled value for three seconds. |
| Ζ / ζ | `ζ = √ε` roots the needle storm into harmonic splash. | Zeta reshapes ε's frenzy into controlled cascades. | **Ζ** reflects the rooted splash as a harmonic echo every fourth shot. |
| Η / η | `η = ln(ζ + 1)` condenses zeta into alternating veils. | Eta flips between burn and chill as ζ rises. | **Η** doubles the duration of whichever status just triggered. |
| Θ / θ | `θ = η^{2}` squares eta into lane-bending waves. | Theta bends the lane by amplifying η's resonance. | **Θ** retains the squared field and spawns a freeze bubble whenever the wave intensity doubles. |
| Ι / ι | `ι = √θ` loops theta into circulating beams. | Iota turns θ's bends into inclusive perimeter lasers. | **Ι** shares ι's loop with the furthest linked ally, extending combined range. |
| Κ / κ | `κ = ι + sin(ι)` adds oscillation to iota's loop. | Kappa reads curvature straight from the oscillating loop. | **Κ** embeds a curved barrier that deflects enemies inward for two seconds. |
| Λ / λ | `λ = κ^{3/2}` elevates curvature into an aura surge. | Lambda amplifies κ into eigenvalue-like boosts. | **Λ** locks whichever aura mode is strongest and triples its effect while locked. |
| Μ / μ | `μ = λ + ln(λ + 1)` blends lambda with a stabilizing log. | Mu smooths λ surges into predictive volleys. | **Μ** continues the blend and redistributes matching shields to the two weakest allies. |
| Ν / ν | `ν = μ^{2}` squares the predictive volley into tempo beams. | Nu punishes rhythmic waves with squared μ barrages. | **Ν** adds a metronome that doubles projectile speed whenever wave tempo spikes. |
| Ξ / ξ | `ξ = √ν` roots the squared tempo into balanced blasts. | Xi fires parity-stable bursts drawn from ν. | **Ξ** mirrors the rooted blast backward through the lane at half strength. |
| Ο / ο | `ο = ln(ξ + 1)` logs xi into steady phasors. | Omicron rewards scarcity by stabilizing ξ's output. | **Ο** keeps the scarcity bonus and discounts other towers by 5% for each surviving ο shot. |
| Π / π | `π = ο^{2}` squares the phasor into circular shockwaves. | Pi radiates perfect-ratio rings sourced from ο. | **Π** primes the next placed tower with the squared ratio as a starting buff. |
| Ρ / ρ | `ρ = √π` roots the ring into dense jet streams. | Rho slows clustered foes with density drawn from π. | **Ρ** converts 10% of slowed enemies into laminar allies for three seconds. |
| Σ / σ | `σ = ρ + ln(ρ + 1)` sums rho into resonance beams. | Sigma sums density to unleash crushing strikes. | **Σ** adds a trailing echo equal to the median allied damage each second. |
| Τ / τ | `τ = σ^{2}` squares sigma into rotating sawtooth bursts. | Tau spins σ's energy into relentless arcs. | **Τ** maintains the cycle and stuns enemies for `τ/2` seconds after each discharge. |
| Υ / υ | `υ = √τ` roots the rotation into gradient control. | Upsilon converts τ into push-pull resource flows. | **Υ** keeps the gradient flip and doubles ally crits against inverted armor. |
| Φ / φ | `φ = ln(υ + 1)` logs upsilon into golden spirals. | Phi threads logged υ into Fibonacci-style buffs. | **Φ** doubles the spiral hop count so the pattern re-hits its origin. |
| Χ / χ | `χ = φ^{2}` squares phi into synchronized matrices. | Chi aligns every spiral into harmonic windows. | **Χ** widens the matrix so every synced ally shares the buff. |
| Ψ / ψ | `ψ = √χ` roots chi into quantum crit waves. | Psi collapses χ's matrix into lethal probability spikes. | **Ψ** keeps the rooted wave and collapses every third shot into a pure damage burst. |
| Ω / ω | `ω = ψ + ln(ψ + 1)` blends psi with a final logarithmic anchor. | Omega harmonizes the entire ladder with ψ as fuel. | **Ω** unleashes an omega shock equal to the total blended damage when foes reach 1% HP. |

Support variants (slow fields, reversal chants, homing missiles, etc.) remain available for each letter and inherit any prestige bonuses that modify shared mechanics (for example, **Σ** increases the damage budget of homing missiles by summing all allied support damage).

## Enemy Archetypes
All enemies manifest using **non-Greek mathematical symbols** so that their silhouettes feel distinct from the tower roster yet still read as scholarly constructs. The connection between symbol and behavior is intentionally indirect, but each foe carries a subtle mathematical echo that observant players can parse.

Every enemy defeat also injects energy into the Powder tab: the fallen symbol fractures into a grain of sand whose **size and hue match its archetype**. Basic fodder releases 2×2 pixel grains, while exotic threats may drop shimmering 6×6 crystals that paint the dune in luminous strata. These drops stack with existing Powderfall rules and make it easy to visualize which waves were conquered recently.

All enemies adopt a shared **power-of-ten health notation** that appends a bright, glowing red exponent `k` to their symbol. `k = 1` denotes `1` hit point, `k = 2` denotes `10` HP, `k = 3` denotes `100` HP, and so on—each step increases total health by a factor of ten. The radiant exponent floats just above the glyph so players can instantly read both durability and theme; every codex entry references its format as `Symbol^{k}` to reinforce the shared language.

- **E-Type Glyphs (`E^{k}`)** – Base enemies with logarithmic health scaling whose neutral 2×2 slate grains resemble textbook ash. Their exponent pulses steadily to mark the current `10^{k}` tier.
- **Divisors (`÷^{k}`)** – Invert incoming damage to `ΔH = 1 / DPS`; precision debuffs and tempo play are mandatory. Pale-gold powder trails hint at factor charts while the exponent flashes to announce each divisor plateau.
- **Prime Counters (`ℙ^{k}`)** – Track hit counts instead of raw damage, reciting primes until the correct cadence collapses them. Deep-crimson powder flecks and a steady exponent identify which prime-threshold tier you face.
- **Reversal Sentinels (`↺^{k}`)** – Collapse into allied constructs that sprint back to the entrance with inverted statistics, retaining half of their former `10^{k}` reserve. Their charcoal powder drifts upstream, matching the glowing exponent that intensifies after conversion.
- **Quantum Tunnelers (`⇥^{k}`)** – Phase-striding foes that ignore etched lanes and bore straight toward the core. Their crimson exponent flashes in sync with each quantum hop, advertising how much `10^{k}` vitality remains.

### Symbolic Enemy Gallery
| Symbol & Name | Encounter Notes | Mathematical Motif | Powderfall Residue |
| --- | --- | --- | --- |
| \(\aleph_0^{k}\) – **Aleph Swarm** | Floods the lane with countless low-HP clones; the longer they remain unculled, the more spawn simultaneously via a countable-infinity clock. The red exponent flashes with every duplication to signal the growing `10^{k}` pool. | Cardinality of infinite sets; more time alive means more members drawn from the "smallest" infinity. | Splits into many 2×2 pearl grains that rapidly pile up, visually selling the unending count. |
| \(\partial^{k}\) – **Partial Wraith** | Steals a portion of nearby tower stats, then returns them when the wraith is slowed or stunned. Its exponent flares while power is siphoned, warning that the current `10^{k}` reserve is fortified. | Partial derivatives react to localized change; halting motion resets the derivative to zero. | Drops 4×4 gradient-teal grains whose edges fade, mirroring differential shading. |
| \(\nabla^{k}\) – **Gradient Sapper** | Accelerates downhill along the path and siphons buffs in the direction of travel, forcing defenses to reposition. The exponent leans toward the steepest descent, making the chosen vector obvious. | Nabla tracks gradients; this enemy literally follows the steepest descent. | Leaves 4×4 lime grains with arrow etchings that roll toward the lowest powder point. |
| \(\wp^{k}\) – **Weierstrass Prism** | Oscillates between fragile and invulnerable states at fractal intervals, rewarding towers that sync to the rhythm. Erratic exponent flickers telegraph the nowhere-differentiable timing. | The Weierstrass function is continuous yet nowhere differentiable; the enemy jitters unpredictably. | Fragments into 5×5 iridescent grains whose speckled surface resembles fractal noise. |
| \(\hbar^{k}\) – **Planck Shade** | Phase-shifts in and out of the lane every `ħ` seconds, bypassing slow fields unless a tower hits it in perfect rhythm. The exponent ignites only during tangible frames, revealing when `10^{k}` health can be chipped away. | Reduced Planck constant anchors quantum cycles; timing is everything. | Emits 6×6 light-blue grains with a soft glow, indicating quantized energy packets. |
| \(\emptyset^{k}\) – **Null Husk** | Appears as a phantom that ignores the path until a tower targets it; once struck, it collapses into nothing and refunds a portion of its health to adjacent foes. Its exponent blazes moments before mass redistribution. | Empty set symbolizes absence; the Husk transfers its "missing" mass to neighbors. | Evaporates into hollow 5×5 translucent grains that leave a faint void outline in the powder. |
| \(\Im^{k}\) – **Imaginary Strider** | Gains evasion stacks whenever damage arrives out of phase; alternating damage types strip stacks and reveal the true form. Each collapsed stack dims the exponent, making progress legible. | Imaginary components pair with real ones; alternating inputs cancel the complex parts. | Shatters into 4×4 indigo grains streaked with silver to suggest complex planes. |
| \(^{n}C_{k}^{\;m}\) – **Combination Cohort** | Spawns in squads whose health redistributes combinatorially when one member falls, making focus fire risky. A highlighted superscript `m` communicates the shared `10^{m}` pool sustaining the group. | Binomial coefficients enumerate combinations; the enemy constantly recomputes group defenses. | The squad collectively sheds 3×3 bronze grains stamped with Pascal triangle dots. |

Future symbol variants will continue to draw from global mathematical alphabets (Cyrillic, Hebrew, kana, operator glyphs, etc.), ensuring each enemy feels fresh while still harmonizing with Thero Idle's mystic numeracy.

## Achievements & Powderfall
- Each achievement seal grants **+1 grain of powder per minute**.
- Offline/idle time multiplies minutes idle by the number of unlocked achievements. All stored grains are deposited immediately on return.
- Powder is dropped in the middle top of the screen. The sides of the screen are walls that act like a "container" that the powder will fill higher and higher. The screen will scroll up as the highest fallen powder (the height of the powder) reaches 2/3 or 3/4 to the top of the screen.
- Powder height (the top *already fallen* sand particle is the powder's height) lights up mystic symbols on the wall etches mystic symbols along the wall. Each reached symbol lit up acts as an upgrade currency for tower research.

### Current Achievement Seals
| Seal | Trigger | Reward |
| --- | --- | --- |
| **First Orbit** | Clear the Lemniscate Hypothesis manual defense at least once. | +1 powder/min and logbook entry. |
| **Circle Seer** | Maintain three α towers simultaneously (manual or auto-latticed). | +1 powder/min. |
| **Series Summoner** | Push active powder rituals to a ×1.25 or higher total multiplier. | +1 powder/min. |
| **Zero Hunter** | Defeat 30 invading glyphs across any battles. | +1 powder/min. |
| **Golden Mentor** | Use auto-lattice to place all suggested anchors for a stage. | +1 powder/min. |
| **Powder Archivist** | Illuminate at least three sand sigils along the powder wall. | +1 powder/min. |
| **Keystone Keeper** | Complete any idle auto-run simulation. | +1 powder/min. |
| **Temporal Sifter** | Accumulate 10 minutes of active idle simulations (multiple runs stack). | +1 powder/min. |

## Fluid Study & Dual Glyph Currency

The **Fluid Study** is an advanced progression system that unlocks after reaching milestones in the Mote Spire. Instead of falling sand grains, it features a continuous water simulation with shallow-water physics, creating a rippling, reflective surface.

### Fluid Study Mechanics
- **Dual Wall System:** The Fluid Study features walls on both the left and right sides of the channel, creating a contained basin for the water to accumulate.
- **Camera Panning:** As the water depth reaches **50% of the viewport height**, the camera smoothly pans upward, similar to the Mote Spire's 75% threshold, allowing the player to see higher glyphs as they progress.
- **Water Dynamics:** Drops merge into a continuous surface that ripples and equalizes over time, creating more organic wave patterns than the discrete sand grains.
- **Idle Drop Reservoir:** Like the Mote Spire's idle bank, accumulated idle drops continuously drain into the basin at a configurable rate.

### Dual Glyph System: Aleph (ℵ) & Bet (ב)

The Fluid Study introduces a second type of upgrade currency through **Bet glyphs**, complementing the existing **Aleph glyph** system from the Mote Spire.

#### Aleph Glyphs (ℵ) – Left Wall
- Appear on the **left wall** of the Fluid Study
- Use the Hebrew letter **Aleph (ℵ)** with subscript numbering: ℵ₀, ℵ₁, ℵ₂, etc.
- Also collected from the Mote Spire (sand simulation)
- Serve as the primary tower upgrade currency
- Thresholds occur every **50% of viewport height** (0.5 normalized height intervals)

#### Bet Glyphs (ב) – Right Wall
- Appear on the **right wall** of the Fluid Study
- Use the Hebrew letter **Bet (ב)** with subscript numbering: ב₁, ב₂, ב₃, etc.
- **Exclusive to the Fluid Study** – cannot be collected from the Mote Spire
- Serve as a **second type of upgrade currency** for specialized tower research
- Share the same height threshold intervals as Aleph glyphs (50% normalized height)
- Numbering starts at **ב₁** (index 1), distinguishing them from Aleph's ℵ₀ start

### Glyph Collection Rules
- Both Aleph and Bet glyphs are earned automatically as the water depth crosses their threshold heights
- Glyphs remain lit permanently once achieved, even if water level drops
- The camera pans to keep upcoming glyphs visible as the basin fills
- Progress is saved and persists across sessions and simulation mode switches
- Each glyph type maintains independent currency tracking for specialized upgrade paths

This dual-currency system allows for deeper strategic choices in tower development, with Bet glyphs unlocking research branches unique to the Fluid Study's advanced progression tier.
