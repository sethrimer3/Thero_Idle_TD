# Iota Tower ? Upgrade Equations

## Conceptual Summary
Iota pulses a slow, color-inverting splash whose total damage is divided evenly across every foe inside the radius. Linking ?, ?, and ? towers charges the pulse further, and Aleph upgrades (?? through ??) act as sequential lattice refinements that engrave more complex imaginary-number harmonics into each attack.

## Variable Glossary
- `?_?, ?_?, ?_?` ? count of linked ?, ?, and ? towers feeding charge into the Iota lattice (0 if no connection).
- `?? ? ??` ? rank counters for each Aleph upgrade purchased along the Iota track (non-negative integers).
- `N_hit` ? enemies inside the splash radius at detonation time (minimum 1 for division).

## Stat Formulas

| Stat | Formula | Notes |
| --- | --- | --- |
| **Attack** | `Atk_? = 240 ? (1 + 0.18 ?_? + 0.24 ?_?) ? (1 + 0.45 ??_?) ? (1 + 0.35?? + 0.25?? + 0.20?? + 0.15??)`<br>`Atk_per_target = Atk_? / max(1, N_hit)` | Base pulse deals 240 damage before modifiers. ? links amplify the imaginary charge multiplicatively via `??_?`, while Aleph ranks layer additional harmonic multipliers. Total damage is evenly split across all affected enemies. |
| **Attack Speed** | `Spd_? = 0.22 + 0.05 (1 - e^{-0.6??}) + 0.03 (1 - e^{-0.4??}) + 0.01 (?_? + 0.5 ?_?)` | Attacks per second. Baseline cadence is a slow 0.22 APS (~4.55 s interval); higher Aleph ranks shave time off asymptotically, and ?/? connections lend a slight tempo assist. |
| **Range** | `m_? = 4.2 + 1.1 ln(1 + ?? + 0.5?? + 0.25??) + 0.35 ln(1 + ?_? + ?_? + 0.5 ?_?)` | Splash radius in meters. Range widens with Aleph ranks but follows logarithmic returns; ally charges provide a secondary, smaller logarithmic stretch. |
| **Debuff Strength** | `?D%_? = 0.30 + 0.05 ?_? + 0.06 ?_? + 0.08 ?_? + 0.12?? + 0.08?? + 0.06??` | Fractional damage amplification applied to afflicted enemies (e.g., 0.30 = +30%). Higher Aleph tiers etch stronger imaginary residues, while ally links boost the debuff further. |
| **Debuff Duration** | `?_? = 3.5 + 0.5 ?_? + 0.25 ?_? + 0.35 ??_? + 0.8 ??? + 0.6?? + 0.4??` | Seconds that struck enemies remain weakened. Aleph ranks extend the lingering vulnerability, and ? links pull the duration along a square-root curve to reflect charge diffusion. |

These expressions keep Iota?s pulses deliberate yet rewarding to charge: ? and ? lend breadth and consistency, ? injects raw pulse magnitude, and the Aleph staircase uses pleasant diminishing returns so each tier feels meaningful without runaway growth.
