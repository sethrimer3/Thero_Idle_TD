# Towers as Mathematical Concepts

Every tower in Thero Idle TD is rooted in a mathematical concept that directly shapes its offensive mechanics. This document catalogs each tower, the math behind it, and how that math becomes a weapon.

---

## Greek Alphabet Towers

### α — Alpha
**Math concept:** Harmonic oscillation / Wave functions  
**Offensive translation:** Fires homing particles that travel in oscillating, wave-like arcs. The sinusoidal path makes projectiles hard to predict and lets them curve around obstacles to reach targets. Damage and particle colors reflect resonant energy (magenta–cyan gradient).

---

### β — Beta
**Math concept:** Exponential scaling / Beta distribution  
**Offensive translation:** Launches burst projectiles in a triangle formation whose damage output grows exponentially with upgrades. The geometric burst pattern mirrors the multi-modal shape of a Beta distribution curve; slower dash timing (0.44 s) keeps the pattern legible.

---

### γ — Gamma
**Math concept:** Gamma radiation / Linear penetration  
**Offensive translation:** Fires a piercing laser that passes straight through multiple enemies in a line, just as gamma rays penetrate matter. Impact leaves a tight star-burst particle splash; the laser extends 160–320 px at 760 px/s, rewarding placement along dense enemy corridors.

---

### δ — Delta
**Math concept:** Differential change / Orbital dynamics  
**Offensive translation:** Two ship variants orbit a fixed track and ram enemies on contact, embodying Δ as a small change applied repeatedly. Orbital speed is π × 0.35 rad/s; a ramming flourish multiplies speed by 1.75× for 0.65 s, representing a sudden δ-impulse.

---

### ε — Epsilon
**Math concept:** Infinitesimally small precision / Logarithmic scaling  
**Offensive translation:** Fires a continuous volley of homing needles with tight spread, stacking consecutive hits per enemy. Upgrade formulas use logarithms:  
- Speed = 10 · log(ℵ₁ + 1) shots/sec  
- Range = 5 · log(ℵ₂ + 2) m  
- Spread = 2(10 − ℵ₃ · log(ℵ₃))°  
Small ε precision translates into many fast, tightly grouped shots that accumulate large total damage.

---

### ζ — Zeta
**Math concept:** Riemann zeta function / Infinite series  
**Offensive translation:** A pendulum swings and triggers chain reactions; each link in the chain adds damage like successive terms in a zeta series. Damage multiplies through the pendulum chain, and upstream supplier towers feed resources into it, mirroring how partial sums converge.

---

### η — Eta
**Math concept:** Efficiency / Orbital resonance  
**Offensive translation:** Launches rotating orbs on concentric rings. Ring angular speeds double with each prestige tier [0.1, 0.2, 0.4, 0.8, 1.6 rot/s], creating resonance when rings align (±5° alignment threshold). When aligned, a synchronized burst fires, rewarding the mathematical patience of waiting for resonance.

---

### θ — Theta
**Math concept:** Angle / Sinusoidal decay  
**Offensive translation:** Projects a slow field governed by exponential decay with a sinusoidal envelope:  
- Slow% = 95(1 − e^(−0.1·ℵ₁) · (1 + 0.1·sin(ℵ₁))) + 5  
- Efficacy = e^(1/ℵ₂ − t) · (1 + (1/(1.1+ℵ₃)) · sin(4t))  
The field pulses in sinusoidal waves as efficacy decays over time, turning angle (θ) and its associated trig functions into a crowd-control weapon.

---

### ι — Iota
**Math concept:** Integration / Summation of linked sources  
**Offensive translation:** Collects and integrates damage contributions from every linked tower. Connection bonuses accumulate additively:  
- α-links: +0.18 each; β-links: +0.24 each; γ-links: +0.45·√(count)  
- Final attack = 240 × connectionMult × gammaMult × alephMult  
Iota is a living integral sign — it sums what other towers provide and unleashes it as amplified debuffs.

---

### κ — Kappa
**Math concept:** Coupling constant / Harmonic synchronization  
**Offensive translation:** Stretches tripwire bindings between enemies. The attack multiplier is α × β × γ (fully multiplicative coupling), so binding multiple enemies together multiplies total damage rather than adding it. Audio cues use tuned note samples to signal resonant coupling.

---

### λ — Lambda
**Math concept:** Lambda calculus / Wavelength  
**Offensive translation:** Projects parametric wavelength beams with rainbow gradients. Beam colors are computed by converting wavelength-indexed HSL to RGB, visually encoding the electromagnetic spectrum. Wave samples range from 32–160 points; beam thickness 3.5–9.5 px varies with the function parameters.

---

### μ — Mu
**Math concept:** Fractal geometry / Tiered polygon escalation  
**Offensive translation:** Plants mines that charge through polygon tiers (triangle → square → pentagon …). Each tier multiplies damage by 10×. Mine geometry — number of polygon edges — grows with tier, giving a fractal-like complexity escalation. Roman numeral labels mark each mine's current tier.

---

### ν — Nu
**Math concept:** Kill-count scaling / Overkill accumulation  
**Offensive translation:** Fires piercing lasers whose attack, speed, and range all scale with kill count:  
- atk = μ + dmgtot (base attack + total overkill damage absorbed)  
- spd = 1 + 0.1 · kills  
- rng = baseRange + 0.05 · kills  
Every overkill hit feeds back into future damage, creating a snowball that grows without bound.

---

### ξ — Xi
**Math concept:** Exponential chain dynamics  
**Offensive translation:** A ball zips to an enemy, sticks briefly, then chains to the nearest new target with exponentially growing damage:  
- atk = ν × (numChain ^ numChnExp)  
- numChnExp = 1 + 0.1 · ℵ₅  
Each chain link raises attack to an increasing power, so long chains deal devastatingly more than short ones.

---

### ο — Omicron
**Math concept:** Equilateral triangle geometry / Percentage HP damage  
**Offensive translation:** Trains equilateral triangle soldier units that march down the lane. Each unit carries an orbiting shield (12 swirling particles) dealing (1 + ℵ₁)% of the struck enemy's initial HP — a geometric shape that literally attacks with a percentage of maximum health, scaling naturally against high-HP bosses.

---

### π — Pi
**Math concept:** Rotational geometry / Exponential rotation scaling  
**Offensive translation:** Locks individual laser beams onto enemies; damage grows exponentially with how many degrees the beam has rotated since locking on:  
- atk = ο ^ (|degrees| / (100 − ℵ₁))  
- numLasers = 2 + ℵ₁  
The longer a beam stays on target, the more rotational energy accumulates — turning π's identity as "all about circles" into a spin-up damage mechanic.

---

### ρ — Rho
**Math concept:** Density / Concentrated burst  
**Offensive translation:** A high-density damage dealer (2 300 base attack, 0.54 rate, 0.58 range). ρ (rho) as a symbol for density translates into a concentrated, close-range blaster that trades reach for raw damage mass.

---

### σ — Sigma
**Math concept:** Summation (Σ) / Damage pooling  
**Offensive translation:** Allied towers treat σ as an enemy; all damage they deal is absorbed and stored rather than lost. σ then fires using the entire stored pool at once. The lowercase form resets the pool after firing; the prestige uppercase Σ copies the pool without resetting, continuing to accumulate — a literal running sum that becomes a single devastating attack.

---

### τ — Tau
**Math concept:** Polar spiral curves (τ = 2π)  
**Offensive translation:** Fires slow-moving bullets that trace a complete polar spiral:  
- r(u) = R_max · sin(π · u), θ(u) = 2π · turns · u  
Bullets expand outward, then spiral back home, dealing damage on each enemy contact (0.18 s cooldown per enemy). Internal circle particles visualize remaining hit charges, making τ's full-circle identity visible in play.

---

### υ — Upsilon
**Math concept:** Infinite vectors / Fleet dynamics  
**Offensive translation:** Deploys a fleet of triangle ships with effectively infinite range. Ships dogfight with dash mechanics (1.55× speed burst), focus-fire on player-marked targets, and recall when the lane clears. υ embodies vector pursuit: each ship continuously recomputes its heading toward the nearest valid target with no range cutoff.

---

### φ — Phi
**Math concept:** Golden ratio (φ ≈ 1.618) / Fibonacci spiral  
**Offensive translation:** Grows seeds at golden-angle intervals (≈ 137.5°), mirroring the sunflower's Fibonacci packing. Ring radii follow φ^k. Seeds spiral outward, spin at the edge, then return — each can pierce 2 enemies. Upgrade capacity follows Fibonacci numbers [1, 2, 3, 5, 8, 13], encoding the ratio directly in tower growth.

---

### χ — Chi
**Math concept:** Complex numbers / Logarithmic conversion  
**Offensive translation:** Converts enemy deaths into marching thralls. Conversion formulas use logarithms of tower power:  
- healthPercent = 0.28 + log₁₀(chiPower) × 0.05  
- speedBonus = 0.12 + log₁₀(chiPower) × 0.035  
- maxThralls = round(2 + log₁₀(chiPower))  
χ turns negative energy (enemy deaths) into positive force — a mathematical negation becoming an offensive multiplier.

---

### ψ — Psi
**Math concept:** Merge / Cluster aggregation  
**Offensive translation:** Pulls nearby enemies together into PsiClusters. Merged cluster speed = √(mean speed) (exponent 0.5), so merging many slow enemies into one fast cluster creates a tougher, faster composite target that explodes into AoE on death. The square-root smoothing keeps clusters from becoming trivially slow.

---

### Ω — Omega
**Math concept:** Limit / Percentage-based HP reduction  
**Offensive translation:** Golden orbital particles circle an enemy during a charge phase, then execute a percentage slice of the enemy's maximum HP (up to 40% per particle). As the "end" letter, Ω deals damage relative to what an enemy has remaining — any enemy, no matter how large — bringing them inevitably closer to zero.

---

### ∞ — Infinity
**Math concept:** Exponential growth / Natural logarithm  
**Offensive translation:** Boosts all towers in range using the player's unspent Thero currency as an exponent:  
- Exponent = ln(þ) where þ = unspent Thero  
- DamageBoost = damage × e^(ln(þ)) = damage × þ  
Spending nothing compounds into a nearly limitless multiplier, rewarding an "idle" accumulation philosophy with an exponentially growing damage aura.

---

## Spires (Idle Games)

Spires are self-contained idle games — not towers. Each spire runs its own physics-based simulation and rewards the player with one of the six glyph types used to alter tower equations.

### Powder Spire
**Math concept:** Cellular automata / Particle physics  
**Idle mechanic:** Runs a real-time falling-sand simulation in a basin. Grains obey gravity, slumping, and wall rules on a cell grid. The kinetic energy of colliding and sliding grains accumulates into glyph production — a probabilistic, emergent system rather than a fixed formula. Players earn **Aleph glyphs (ℵ)** from powder interactions.

---

### Fluid Spire (Bet)
**Math concept:** Shallow-water equations / Fluid dynamics  
**Idle mechanic:** Simulates a water column model with velocity tracking, ripple equalization, and geyser bursts on high-flow events. Glyph production is proportional to flow intensity; a sudden geyser spike acts as a bonus burst. Players earn **Bet glyphs (ב)** from fluid dynamics.

---

### Lamed Spire (ל)
**Math concept:** Orbital mechanics / Gravitational physics  
**Idle mechanic:** Stars orbit a central celestial body governed by Newtonian gravity and drag. As the central mass grows (Proto-star → Red Giant → Black Hole), its gravitational pull strengthens. Stars that are absorbed add to the mass; absorbed mass converts into glyph production. Trajectory trails are color-coded by velocity. Players earn **Lamed glyphs (ל)** from orbital mechanics.

---

### Tsadi Spire (צ)
**Math concept:** Particle fusion / Elastic collision mechanics  
**Idle mechanic:** Particles bounce in a 2D arena; when two same-tier particles collide elastically, they fuse into a higher tier, conserving momentum. The highest tier reached determines the glyph reward. A Van der Waals binding-agent system lets advanced molecules form, unlocking combination bonuses. Players earn **Tsadi glyphs (צ)** from particle fusion.

---

## Test Towers

### T₁ — Test Tower 1
**Math concept:** Polar rose curves  
**Formula:** r(θ) = maxRadius × |sin(3θ)| (3-petal rose)  
**Offensive translation:** A glowing tracer head sweeps the 3-petal polar rose continuously. Any enemy caught inside the fading trail takes ongoing damage. The trail persists 3 seconds with up to 80 recorded points, so the damage zone literally is the curve — a mathematical shape that attacks by existing.

---

### T₂ — Test Tower 2
**Math concept:** Parametric trigonometric curves (Lissajous / custom)  
**Formulas:**  
- x = R × (sinX·sin(t) + cosX·cos(t) + tanX·clamp(tan(t)))  
- y = R × (sinY·sin(t) + cosY·cos(t) + tanY·clamp(tan(t)))  
**Offensive translation:** The player toggles sin / cos / tan independently for each axis (default: cos t, sin t = circle). Combining functions produces Lissajous figures, hypocycloid-like shapes, or chaotic paths. The tracer head damages enemies on contact; curve complexity determines coverage. Tangent values are clamped to ±1.5 to prevent the path from flying off-screen.

---

## Terrarium Achievement Objects

Fractal visualizations that are earned as rewards and placed in the player's achievements terrarium — a collectible display filled with mathematical curiosities.

### Shin (ש) — Fractal Tree
**Math concept:** Fractal tree / L-system recursive geometry  
**Terrarium role:** A decorative ink-style fractal tree with configurable branch factor, length decay, max depth, gravity bend, and angle jitter. The branching structure represents recursive self-similar geometry — each branch a scaled copy of the whole. This is not a combat tower; it is a terrarium reward object that grows and evolves as the player progresses through the Shin Spire idle game.

---

## Gate Structures

### Mind Gate (𝔊)
**Role:** Defense anchor at the lane terminus.  
When the Mind Gate is destroyed the run ends — it anchors all inspiration and glyph conduits. It has no attack stats of its own; it is the boundary condition of the entire defense equation.

---

### Shadow Gate (℘)
**Role:** Enemy spawn nexus at the lane origin.  
The Shadow Gate is the source term of the enemy wave function — all enemies emanate from it. Its Weierstrass ℘ symbol (an elliptic function with poles) evokes an infinite singularity that continuously outputs threat.
