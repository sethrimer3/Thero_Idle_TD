# Glyph Defense Idle – Progression Notes

## Level Structure
- The game now features **30 total levels** grouped into six five-level sets.
- Sets unlock in reverse proof order: Hypothesis (0, tutorial level), Conjecture (1–5), Corollary (6–10), Lemma (11–15), Proof (16–20), Theorem (21–25), and Axiom (26–30).
- Each level is built around an "immortal defense" style lane defined by a math-graph expression (figure-eights, logarithmic spirals, cardioids, etc.).
- When a level is entered **for the first time** the screen fades to black and displays a hallmark statement for that set (e.g., Goldbach's Conjecture). Subsequent visits skip the fade.
- Entered levels continue running when the player navigates to other tabs; use "Leave Current Level" on the Stage tab to reset wave flow.

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
- **E-Type Glyphs** – Base enemies labeled by trailing zeros (E1 = 1 HP, E3 = 100 HP, etc.) with logarithmic health scaling.
- **Divisors** – Take damage equal to `1 / DPS`; encourage precision debuffs and tempo play.
- **Prime Counters** – Require a fixed number of hits regardless of damage; ideal for soldier swarms and rapid-fire towers.
- **Reversal Sentinels** – Upon defeat they run backward along the path; captured units fight for the player with inverted health totals. These are not an actual enemy but a tower's attack.
- Enemy symbols will use non-greek math symbols. Some examples are listed below:
- Hebrew: \(\aleph \) (aleph), \(\beth \) (beth), and \(\gimel \) (gimel) are used for cardinal numbers.
- Cyrillic: Ш (sha) is used in some areas of number theory and computer science for the shuffle product.
- Norwegian: The letter Ø is used for the empty set.  Maltese: ħ is used for the reduced Planck constant.
- Japanese: よ (yo) can be seen in category theory.
- Latin-based and other symbols: Partial derivative: \(\partial \) (often written with \partial in LaTeX). Infinity: \(\infty \) (often written with \infty in LaTeX). Reduced Planck's constant: \(\hbar \) (often written with \hbar in LaTeX). Real part: \(\Re \) (often written with \Re in LaTeX). Imaginary part: \(\Im \) (often written with \Im in LaTeX). Empty set: \(\emptyset \) (not to be confused with the Norwegian Ø). Combinatorics: Symbols like \({}^{n}P_{k}\) and \({}^{n}C_{k}\). Vector calculus: \(\nabla \) (del) is often used. Weierstrass power function: \(\wp \) (often written with \wp in LaTeX). 

## Achievements & Powderfall
- Each achievement seal grants **+1 grain of powder per minute**.
- Offline/idle time multiplies minutes idle by the number of unlocked achievements. All stored grains are deposited immediately on return.
- Powder is dropped in the middle top of the screen. The sides of the screen are walls that act like a "container" that the powder will fill higher and higher. The screen will scroll up as the highest fallen powder (the height of the powder) reaches 2/3 or 3/4 to the top of the screen.
- Powder height (the top *already fallen* sand particle is the powder's height) lights up mystic symbols on the wall etches mystic symbols along the wall. Each reached symbol lit up acts as an upgrade currency for tower research.
