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

Future sets escalate enemy modifiers and map complexity but follow the same five-level cadence with new example statements.

## Tower Evolution
- **α → β → γ → δ → etc** is the primary merge ladder. α towers provide single-target bursts; two α towers merge into a β beam tower, and so on.
- The Greek alphabet in order is: Alpha (Α α), Beta (Β β), Gamma (Γ γ), Delta (Δ δ), Epsilon (Ε ε), Zeta (Ζ ζ), Eta (Η η), Theta (Θ θ), Iota (Ι ι), Kappa (Κ κ), Lambda (Λ λ), Mu (Μ μ), Nu (Ν ν), Xi (Ξ ξ), Omicron (Ο ο), Pi (Π π), Rho (Ρ ρ), Sigma (Σ σ/ς), Tau (Τ τ), Upsilon (Υ υ), Phi (Φ φ), Chi (Χ χ), Psi (Ψ ψ), and Omega (Ω ω). Each uppercase letter has a corresponding lowercase letter.  
- β towers merge into **γ conductors** (`γ = α^½ · β`) that blend α burst spikes into β beam tempo and apply homing bolts.
- γ towers merge into **δ casern** (`δ = γ · ln(β + 1) · x · y`) that summon glyph soldiers that have a set amount of "health" which is the amount of damage they inflict before despawning. They attack by following enemies and shooting beams of light which hit an enemy. Their hit points are reduced by the damage they do to an enemy. This means that if an enemy has more life than they inflict damage, they inflict that damage and die--but if they deal more damage than an enemy has life, they keep the remainder as their life. The amount of damage they can do is the total "DPS" of this tower, the solution to the δ formula. Additional upgrades include soidler amount (x), which is the total amount of soldiers that can be spawned at one time, and soldier training speed (y).
- The **ε tower** (`ε = β^(1/δ) · x · y · z`) which draws stats from every β tower on the field (which appears as a quick laser effect from every β tower as it "charges up" an attack) then releases a single-shot laser which does burning splash damage. Additional upgrades include attack speed (x), splash damage size (y), and burning time in seconds.
- Support variants now include aura boosters, splash glyphs, homing missiles, slow fields, and enemy reversal chants.
- Each tower has a base cost. To build a second of that tower (meaning two exist at the same time), it's the base cost squared, then to have a third of that tower the base cost is (base cost)^3, and so on. Whenever towers are merged, the total amount of towers decreases and so the cost does as well.
- WORK IN PROGRESS IDEAS:
- **θ cantonment** upgraded version of δ casern. θ soidlers attack, and once they run out of hit points they deal splash damage of their initial hitpoint amount split into an amount of δ soilders.
- **ο garrison** upgraded version of θ cantonment. ο soidlers attack, and once they run out of hit points split into an amount of θ soilders.

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
