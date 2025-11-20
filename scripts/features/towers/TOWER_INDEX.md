# Tower Index – Quick Reference

Quick lookup table for all implemented towers in Thero Idle.

## Implemented Towers

| Symbol | Name | File | Key Features |
|--------|------|------|--------------|
| α | Alpha | `alphaTower.js` | Swirl bounce particles, basic damage |
| β | Beta | `betaTower.js` | Exponential damage scaling, uses `betaMath.js` |
| γ | Gamma | `gammaTower.js` | Gamma ray piercing attacks |
| δ | Delta | `deltaTower.js` | Delta force area effects |
| ε | Epsilon | `epsilonTower.js` | Epsilon precision targeting |
| ζ | Zeta | `zetaTower.js` | Zeta chain reactions |
| η | Eta | `etaTower.js` | Eta efficiency bonuses |
| θ | Theta | `thetaTower.js` | Theta angle-based mechanics |
| ι | Iota | `iotaTower.js` | Iota integration over time |
| κ | Kappa | `kappaTower.js` | Kappa critical strike system |
| λ | Lambda | `lambdaTower.js` | Lambda lambda calculus mechanics |
| μ | Mu | `muTower.js` | Fractal mine layer (Sierpinski/Apollonian) |
| ν | Nu | `nuTower.js` | Kill-scaling piercing laser with overkill tracking |
| χ | Chi | `chiTower.js` | Converts nearby enemy deaths into mind-gate thralls marching backward |
| σ | Sigma | `sigmaTower.js` | Draws allied fire, sums the damage, and releases it as single shots |
| τ | Tau | `tauTower.js` | Spiral bullets with returning arcs and upgradeable hit particles |
| υ | Upsilon | `upsilonTower.js` | Infinite-range triangle fleet that focus-fires priority targets before recalling |
| φ | Phi | `phiTower.js` | Grows seeds in sunflower pattern, bursts them outward to spiral and return |
| ψ | Psi | `psiTower.js` | Merge tower that combines nearby enemies into powerful PsiClusters with AoE death explosions |
| Ω | Omega | `omegaTower.js` | Golden orbital particles slice percentage of enemy max HP after charging period |
| ℵ | Aleph | `alephChain.js` | Cardinality-based system (advanced) |

## Special Towers

| Name | File | Description |
|------|------|-------------|
| Fluid | `fluidTower.js` | Fluid dynamics simulation |
| Powder | `powderTower.js` | Powder game integration |
| Lamed (ל) | `lamedTower.js` | Gravity simulation with orbital sparks |
| Tsadi (צ) | `tsadiTower.js` | Particle fusion simulation with tier merging |

## Math Modules

| Module | Description |
|--------|-------------|
| `betaMath.js` | Dedicated utilities for β tower calculations |

## Common Tower Patterns

**See `scripts/features/towers/agent.md` for:**
- Tower implementation template
- Damage formula patterns
- Particle behavior types
- Upgrade systems documentation
- Mathematical conventions

## Creating New Towers

1. Choose next Greek letter in sequence (or special symbol)
2. Create `<name>Tower.js` following template in `scripts/features/towers/agent.md`
3. Document formulas with JSDoc comments
4. Add entry to this index
5. Update `/docs/PROGRESSION.md` with upgrade paths
