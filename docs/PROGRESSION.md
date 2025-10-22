# Glyph Defense Idle – Progression Notes

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

- **Five-of-a-kind prestige:** Once the player can simultaneously afford and field **five matching lowercase towers**, they may perform a *tower prestige* to fuse them into the corresponding uppercase glyph. The prestige keeps the lowercase formula but adds one powerful, easy-to-track mutation described below.
- **Uppercase uniqueness:** Only **one uppercase tower of each letter** may exist on the field at a time. While an uppercase tower is deployed, the player may not place additional lowercase towers of that letter.
- **Population accounting:** For all mechanics that scale with tower counts (including formulas that reference `n`, adjacency checks, or synergies), a single uppercase tower counts as **five lowercase towers of its letter**.
- **Merge ladder:** Players may still merge adjacent lowercase towers alphabetically (α into β, β into γ, and so on), but the prestige path offers a sideways option that preserves the flavor of the lowercase while unlocking late-game power spikes.
- **Cost cadence:** Tower costs escalate exponentially with simultaneous copies. Building the `k`‑th instance of a given lowercase letter costs `(base cost)^k`. Fusing or prestiging refunds the cost pressure because active tower counts drop by four when five become one.

### Lowercase and Uppercase Glyph Index
Each entry combines three beats: a flavorful formula, a combat mechanic, and a hidden nod to the mathematical symbol from which the glyph draws power. The uppercase prestige upgrade reiterates the same formula and layers on one decisive bonus.

| Letter Pair | Lowercase Formula & Core Behavior | Symbolic Parallel & Combat Quirk | Uppercase Prestige Mutation |
| --- | --- | --- | --- |
| Α / α | `α(d, t) = φ₀ · ln(1 + t) + d` where `d` is base damage and `t` is time attacking the same target. | Alpha launches the *first* strike—logarithmic ramping echoes "alpha" particles boring in. | **Α** keeps the logarithmic ramp and additionally chains a `+d` burst to the next enemy every time the log term increments by 1. |
| Β / β | `β = ∫₀¹ u^{α_count-1}(1-u)^{2-1} du · v` (a Beta-function pulse scaled by projectile velocity `v`). | Beta taps the Euler Beta integral, rewarding more nearby α allies with wider beam pulses. | **Β** still evaluates the Beta integral but triples the resulting beam width, then mirrors it backwards like symmetric Beta distributions. |
| Γ / γ | `γ = Γ(1 + β_stacks) · ρ` using the Gamma function and soldier density `ρ`. | Gamma function factorials convert β stacks into factorial projectile bursts. | **Γ** feeds the same Gamma factor into a delayed aftershock that replays `25%` of the burst DPS two seconds later. |
| Δ / δ | `δ = Δx · Δv · ζ`, the product of finite differences in range (`Δx`), velocity (`Δv`), and a soldier formation scalar `ζ`. | Delta embodies change—δ troopers reshape lanes by leaping through teleport nodes. | **Δ** still computes the finite-difference strike but now leaves behind a triangular field that slows enemies by the larger of `Δx` or `Δv`. |
| Ε / ε | `ε = lim_{h→0} (σ(t + h) - σ(t)) / h` sampling tower aura `σ`. | Epsilon embraces limits; ε performs micro-bursts whenever nearby buffs fluctuate. | **Ε** preserves the derivative burst and additionally freezes enemy armor at its lowest sampled value for three seconds. |
| Ζ / ζ | `ζ = ∑_{n=1}^{∞} n^{-s}` truncated at `s = 1 + ω_progress/10`. | Zeta references the Riemann zeta; ζ tower splashes more when extra towers push `s` toward critical strips. | **Ζ** keeps the truncated sum but reflects it as a harmonic resonance that adds the highest partial sum directly to damage every fourth shot. |
| Η / η | `η = ∑_{n=1}^{N} (-1)^{n-1} / n · χ` with `χ` from nearby Chi auras. | Eta is the alternating zeta; η alternates between burn and chill each projectile. | **Η** retains the alternating sum while doubling the length of whichever status just triggered. |
| Θ / θ | `θ = Θ(n log n) · p` tying fire-rate `p` to nearby enemy count `n`. | Theta notation measures order; θ stabilizes DPS when hordes swell by matching the asymptotic growth. | **Θ** uses the same asymptotic band and also spawns a time-freeze bubble whenever `n log n` doubles compared to the start of the wave. |
| Ι / ι | `ι = ι₀ · indicator(enemy ∈ range)` projecting inclusion beams. | Iota signifies inclusion; ι tags enemies and lets other towers treat them as adjacent. | **Ι** keeps the tagging formula and adds a thin segment that shares range with the furthest linked ally (inclusion transitivity). |
| Κ / κ | `κ = κ₀ · curvature(path)` evaluating local lane curvature. | Kappa reads curvature; κ gains damage on bends and grants bonus knockback proportional to the turning angle. | **Κ** keeps curvature scaling while imprinting a curved barrier that deflects enemies inward for two seconds. |
| Λ / λ | `λ = λ_max · e^{-t/τ}` emulating eigenvalue decay with time constant `τ`. | Lambda is eigenvalue notation; λ tower rotates between eigenmodes (single-target vs. piercing). | **Λ** preserves decay but locks whichever eigenmode has the largest eigenvalue, tripling its effectiveness during the lock. |
| Μ / μ | `μ = (1/N) ∑ damage_i` averaging allied hits. | Mu denotes mean; μ averages recent damage to equalize support. | **Μ** continues averaging but also redistributes `+μ` shields to the two weakest nearby towers. |
| Ν / ν | `ν = ν₀ · frequency(wave)` tying damage to spawn tempo. | Nu signals frequency; ν pulses faster as wave frequency rises and emits resonance rings. | **Ν** keeps tempo scaling and adds a metronome that doubles projectile speed whenever spawn rate spikes by 50%. |
| Ξ / ξ | `ξ = ξ₀ · ∑_{k} e^{-λ_k t}` referencing spectral Xi sums. | Xi towers channel damped spectral bolts that cascade along enemies marked by Iota. | **Ξ** still uses spectral decay and appends a mirror bolt that travels backwards through the lane at half strength. |
| Ο / ο | `ο = o(n)` tracking little-o synergy with total tower count `n`. | Omicron (little-o) rewards having *fewer* copies; ο grows if its letter is rare. | **Ο** retains the scarcity bonus but applies a silent global discount of `5%` per surviving ο shot to towers of other letters until wave end. |
| Π / π | `π = ∏_{i=1}^{m} (1 + r_i)` multiplying over rune bonuses `r_i`. | Pi is product notation; π projectiles multiply on-hit effects from support glyphs. | **Π** keeps the multiplicative stacking and also primes the next placed tower with the final product as a starting buff. |
| Ρ / ρ | `ρ = density(enemies_in_field) · v_flow` modeling fluid density. | Rho denotes density; ρ fires pressurized streams that slow clustered foes. | **Ρ** keeps the density jet but now converts 10% of slowed enemies into temporary "laminar" allies that hold position for three seconds. |
| Σ / σ | `σ = ∑ damage_allies · α_weight` summing allied DPS with alpha weights. | Sigma means sum; σ's beam deals the total damage of all towers currently active (capped by weights). | **Σ** preserves the sum and adds a trailing echo equal to the median ally damage each second. |
| Τ / τ | `τ = τ₀ · e^{-t/RC}` using time constant analogies. | Tau stands for time constant; τ emits pulses that store energy then discharge in sawtooth bursts. | **Τ** continues the discharge cycle and unloads a finishing overcharge that stuns enemies for `τ/2` seconds after each burst. |
| Υ / υ | `υ = hyperbolic_sine(x)` with `x` tied to enemy armor. | Upsilon traces hyperbolas; υ reverses armor signs temporarily, making high-armor foes vulnerable. | **Υ** keeps the hyperbolic flip and adds a bonus where allies crit for double damage against inverted armor. |
| Φ / φ | `φ = φ₀ · (1 + ϕ)^{golden_chain}` referencing the golden ratio `ϕ`. | Phi glows with Fibonacci-style chaining; φ projectiles hop along a golden spiral path. | **Φ** sustains the spiral and doubles the hop count, ensuring the spiral closes back on its origin to hit the initial target twice. |
| Χ / χ | `χ = indicator(condition) · ψ` with condition set by lane parity. | Chi marks characteristic functions; χ toggles buffs on even/odd enemy IDs. | **Χ** keeps the parity gating but widens the buff zone to every enemy whose ID shares a factor with the parity seed. |
| Ψ / ψ | `ψ = ψ₀ · e^{iθ}` wavefunction-inspired phase bolts. | Psi evokes quantum states; ψ rotates phases to slip through shields. | **Ψ** maintains the rotating phase and adds collapse bursts—every third shot collapses to pure damage equal to the combined phase magnitude. |
| Ω / ω | `ω = lim_{n→∞} f^{(n)}(t)` referencing transfinite iterates of the attack function `f`. | Omega is the last letter; ω towers iterate their attack pattern infinitely, creating recursion beams that grow with each loop. | **Ω** keeps the iterative recursion but seeds an "omega shock" that deals the total accumulated loop damage when enemies reach 1% HP, usually erasing them. |

Support variants (slow fields, reversal chants, homing missiles, etc.) remain available for each letter and inherit any prestige bonuses that modify shared mechanics (for example, **Σ** increases the damage budget of homing missiles by summing all allied support damage).

## Enemy Archetypes
All enemies manifest using **non-Greek mathematical symbols** so that their silhouettes feel distinct from the tower roster yet still read as scholarly constructs. The connection between symbol and behavior is intentionally indirect, but each foe carries a subtle mathematical echo that observant players can parse.

Every enemy defeat also injects energy into the Powder tab: the fallen symbol fractures into a grain of sand whose **size and hue match its archetype**. Basic fodder releases 2×2 pixel grains, while exotic threats may drop shimmering 6×6 crystals that paint the dune in luminous strata. These drops stack with existing Powderfall rules and make it easy to visualize which waves were conquered recently.

- **E-Type Glyphs** – Base enemies labeled by trailing zeros (E1 = 1 HP, E3 = 100 HP, etc.) with logarithmic health scaling. They disintegrate into neutral 2×2 slate grains that represent textbook ash.
- **Divisors** – Take damage equal to `1 / DPS`; encourage precision debuffs and tempo play. Their defeat sprinkles 3×3 pale-gold grains, hinting at divisibility charts.
- **Prime Counters** – Require a fixed number of hits regardless of damage; ideal for soldier swarms and rapid-fire towers. They burst into 3×3 deep-crimson grains that speckle the powder like prime marks.
- **Reversal Sentinels** – Upon defeat they run backward along the path; captured units fight for the player with inverted health totals. These are not an actual enemy but a tower's attack, and they flip into 2×2 charcoal grains that tumble upstream when reclaimed.

### Symbolic Enemy Gallery
| Symbol & Name | Encounter Notes | Mathematical Motif | Powderfall Residue |
| --- | --- | --- | --- |
| \(\aleph_0\) – **Aleph Swarm** | Floods the lane with countless low-HP clones; the longer they remain unculled, the more spawn simultaneously via a countable-infinity clock. | Cardinality of infinite sets; more time alive means more members drawn from the "smallest" infinity. | Splits into many 2×2 pearl grains that rapidly pile up, visually selling the unending count. |
| \(\partial\) – **Partial Wraith** | Steals a portion of nearby tower stats, then returns them when the wraith is slowed or stunned. | Partial derivatives react to localized change; halting motion resets the derivative to zero. | Drops 4×4 gradient-teal grains whose edges fade, mirroring differential shading. |
| \(\nabla\) – **Gradient Sapper** | Accelerates downhill along the path and siphons buffs in the direction of travel, forcing defenses to reposition. | Nabla tracks gradients; this enemy literally follows the steepest descent. | Leaves 4×4 lime grains with arrow etchings that roll toward the lowest powder point. |
| \(\wp\) – **Weierstrass Prism** | Oscillates between fragile and invulnerable states at fractal intervals, rewarding towers that sync to the rhythm. | The Weierstrass function is continuous yet nowhere differentiable; the enemy jitters unpredictably. | Fragments into 5×5 iridescent grains whose speckled surface resembles fractal noise. |
| \(\hbar\) – **Planck Shade** | Phase-shifts in and out of the lane every `ħ` seconds, bypassing slow fields unless a tower hits it in perfect rhythm. | Reduced Planck constant anchors quantum cycles; timing is everything. | Emits 6×6 light-blue grains with a soft glow, indicating quantized energy packets. |
| \(\emptyset\) – **Null Husk** | Appears as a phantom that ignores the path until a tower targets it; once struck, it collapses into nothing and refunds a portion of its health to adjacent foes. | Empty set symbolizes absence; the Husk transfers its "missing" mass to neighbors. | Evaporates into hollow 5×5 translucent grains that leave a faint void outline in the powder. |
| \(\Im\) – **Imaginary Strider** | Gains evasion stacks whenever damage arrives out of phase; alternating damage types strip stacks and reveal the true form. | Imaginary components pair with real ones; alternating inputs cancel the complex parts. | Shatters into 4×4 indigo grains streaked with silver to suggest complex planes. |
| \(^{n}C_{k}\) – **Combination Cohort** | Spawns in squads whose health redistributes combinatorially when one member falls, making focus fire risky. | Binomial coefficients enumerate combinations; the enemy constantly recomputes group defenses. | The squad collectively sheds 3×3 bronze grains stamped with Pascal triangle dots. |

Future symbol variants will continue to draw from global mathematical alphabets (Cyrillic, Hebrew, kana, operator glyphs, etc.), ensuring each enemy feels fresh while still harmonizing with Glyph Defense Idle's mystic numeracy.

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
