# Enemy Mechanic Rework Summary (Build 665)

## Changes Overview

### 1. Gradient Sapper — Deprecated & Replaced

**Status:** Deprecated. The `gradient-sapper` codex ID is now reused for **Directional Saturation**.

- Marked `deprecated: true` in `ENEMY_TYPES` (waveEncoder.js, letter H)
- Added `fallbackType: 'A'` so legacy wave strings referencing H still work
- Codex entry updated to reflect the new Directional Saturation identity
- Existing saves referencing gradient-sapper will still spawn enemies (same codex slot)
- No logic was removed since the original gradient-sapper had no unique simulation code

### 2. Partial Wraith — Speed Ramp Mechanic

**Status:** Implemented.

**Core Mechanic:** The wraith accelerates as its HP drops.

**Formula:** `v = vBase × (1 + (maxMultiplier − 1) × √(1 − HP/maxHP))`

| Constant | Value | Location |
|----------|-------|----------|
| `PARTIAL_WRAITH_SPEED_MULTIPLIER_MAX` | 2.8 | EnemyUpdateSystem.js |

**Behaviour:**
- Full HP → normal speed (1×)
- 50% HP → ~1.27× speed
- 75% missing → ~1.56× speed
- Near death → up to 2.8× speed

**Debug:** `enemy._partialWraithSpeedRamp` stores the current multiplier for debug/render access.

**Files changed:**
- `assets/playfield/systems/EnemyUpdateSystem.js` — speed ramp logic in `updateEnemies()`
- `assets/data/gameplayConfig.json` — updated codex entry with new formula

### 3. Directional Saturation (replaces Gradient Sapper slot)

**Status:** Implemented.

**Core Mechanic:** Enemy tracks incoming attack directions in 6 angular sectors. Repeated hits from one direction build resistance in that sector until it blocks 100% of damage.

| Constant | Value | Location |
|----------|-------|----------|
| `DIR_SAT_SECTOR_COUNT` | 6 | DirectionalSaturationSystem.js |
| `DIR_SAT_BUILDUP_PER_HIT` | 0.12 (12%) | DirectionalSaturationSystem.js |
| `DIR_SAT_MAX_RESISTANCE` | 1.0 (100%) | DirectionalSaturationSystem.js |
| `DIR_SAT_DECAY_RATE` | 0.02/s | DirectionalSaturationSystem.js |
| `DIR_SAT_BOSS_BUILDUP_SCALE` | 0.6 | DirectionalSaturationSystem.js |

**Behaviour:**
- Each hit from a direction adds 12% resistance to that sector (7.2% for bosses)
- Resistance decays at 2% per second
- Damage from a sector is multiplied by `(1 − sectorResistance)`
- Encourages multi-angle tower placement

**Files created:**
- `assets/playfield/systems/DirectionalSaturationSystem.js`

**Files changed:**
- `assets/playfield/systems/EnemyUpdateSystem.js` — init + decay in `updateEnemies()`
- `assets/playfield.js` — sector resolution + damage reduction in `applyDamageToEnemy()`

### 4. Quantum Tunneler — Multi-Projection Collapse

**Status:** Implemented.

**Core Mechanic:** The tunneler exists in multiple projected positions. Only one projection is vulnerable at a time. After N collapses, it enters a final collapsed state.

| Constant | Value | Location |
|----------|-------|----------|
| `QUANTUM_PROJECTION_COUNT` | 3 | QuantumProjectionSystem.js |
| `QUANTUM_COLLAPSE_THRESHOLD` | 3 | QuantumProjectionSystem.js |
| `QUANTUM_LAYER_HP_FRACTION` | 0.2 (20%) | QuantumProjectionSystem.js |
| `QUANTUM_SWITCH_INTERVAL` | 2.5s | QuantumProjectionSystem.js |
| `QUANTUM_PROJECTION_OFFSET` | 0.06 | QuantumProjectionSystem.js |
| `QUANTUM_COLLAPSED_HP_SCALE` | 0.4 (40%) | QuantumProjectionSystem.js |

**Behaviour:**
- 3 projections appear offset from the true position
- Active projection cycles every 2.5 seconds
- HP thresholds at 80%, 60%, 40% trigger projection collapses
- After 3 collapses → collapsed phase with 40% of remaining HP
- Collapsed phase: single enemy, normal targeting

**Debug:** `enemy._quantum` stores full projection state.

**Files created:**
- `assets/playfield/systems/QuantumProjectionSystem.js`

**Files changed:**
- `assets/playfield/systems/EnemyUpdateSystem.js` — init + update
- `assets/playfield.js` — collapse check after damage

### 5. Weierstrass Prism — Fractal Boss Encounter

**Status:** Implemented (simulation layer; rendering hooks exposed for visual implementation).

**Core Mechanics:**

#### 5A. Fractal Vulnerability
Uses truncated Weierstrass function: `f(t) = Σ aⁿ cos(bⁿ π t)`

When `f(t) > 0.3` → vulnerable (full damage). Otherwise → 85% damage reduction.

| Constant | Value | Location |
|----------|-------|----------|
| `WEIERSTRASS_A` | 0.7 | WeierstrasBossSystem.js |
| `WEIERSTRASS_B` | 3 | WeierstrasBossSystem.js |
| `WEIERSTRASS_HARMONICS` | 5 | WeierstrasBossSystem.js |
| `WEIERSTRASS_VULN_THRESHOLD` | 0.3 | WeierstrasBossSystem.js |

#### 5B. Intrusion Telegraphs
Circular telegraph → spike attack cycle.

| Constant | Value |
|----------|-------|
| `INTRUSION_TELEGRAPH_DURATION` | 1.8s |
| `INTRUSION_SPIKE_DURATION` | 0.6s |
| `INTRUSION_COOLDOWN` | 4.0s |
| `INTRUSION_RADIUS` | 0.08 (normalised) |

#### 5C. Anchors
4 anchors around the battlefield, each with 15% of boss max HP.

| Constant | Value |
|----------|-------|
| `ANCHOR_COUNT` | 4 |
| `ANCHOR_HP_FRACTION` | 0.15 |

Destroying anchors:
- Reduces distortion intensity
- Stabilises linked grid tiles
- Reveals boss vulnerability more clearly

#### 5D. Visual Instability
3-layer deterministic oscillation with configurable frequencies and amplitudes.
Scaled by distortion intensity (fewer anchors alive = less distortion).

#### 5E. Battlefield Distortion Grid
4×4 tile grid with random offsets. Tiles stabilise (lerp to zero offset) when linked anchor is destroyed.

**Files created:**
- `assets/playfield/systems/WeierstrasBossSystem.js`

**Files changed:**
- `assets/playfield/systems/EnemyUpdateSystem.js` — init + update for boss state
- `assets/playfield.js` — vulnerability damage reduction

**Rendering note:** The distortion grid, intrusion telegraphs, anchor visuals, and instability offsets are computed in the system and stored on `enemy._weierstrass`. Rendering code should read these values to draw the visual effects. The simulation layer is complete; visual rendering hooks are ready for integration.

### 6. Integral Accumulator — Path-Progress Resistance

**Status:** Implemented (scaffold with full damage pipeline integration).

**Core Mechanic:** Damage resistance decreases as the enemy progresses along the path.

**Formula:** `multiplier = max(0.05, progress^0.8)`

| Constant | Value | Location |
|----------|-------|----------|
| `INTEGRAL_MIN_MULTIPLIER` | 0.05 | IntegralEnemySystem.js |
| `INTEGRAL_CURVE_POWER` | 0.8 | IntegralEnemySystem.js |

**Behaviour:**
- At start of path (progress=0): 95% damage reduction (5% gets through)
- At 25% progress: ~30% damage taken
- At 50% progress: ~57% damage taken
- At 75% progress: ~81% damage taken
- At end of path (progress=1): full damage

**Files created:**
- `assets/playfield/systems/IntegralEnemySystem.js`

**Files changed:**
- `assets/playfield.js` — damage reduction in `applyDamageToEnemy()`
- `assets/waveEncoder.js` — added letter Q mapping
- `assets/enemies.js` — added gem multiplier entry

### 7. Registry & Documentation Updates

**Wave encoder:** Updated enemy type map (H deprecated, Q added)
**Codex entries:** Updated for all reworked enemies
**Gem multipliers:** All enemies have entries in ENEMY_GEM_MULTIPLIERS
**Agent docs:** Updated enemy type mapping tables
**Wave editor docs:** Updated enemy reference table

## Known Tuning Variables Needing Playtest

| Variable | Current | Notes |
|----------|---------|-------|
| Partial Wraith max speed multiplier | 2.8× | May need adjustment if wraiths leak too easily |
| Dir-Sat buildup per hit | 0.12 | May need tuning based on typical tower firing rates |
| Dir-Sat decay rate | 0.02/s | Lower = more permanent; higher = more forgiving |
| Quantum switch interval | 2.5s | Shorter = harder; longer = easier to time |
| Quantum collapse HP fraction | 0.2 | Controls how many HP thresholds before collapse |
| Weierstrass vuln threshold | 0.3 | Lower = more vulnerable time; higher = less |
| Weierstrass damage reduction | 0.15 (85% reduction) | Adjusts difficulty of non-window hits |
| Intrusion cooldown | 4.0s | Lower = more aggressive boss attacks |
| Integral curve power | 0.8 | Lower = faster ramp to vulnerable; higher = slower |
| Integral min multiplier | 0.05 | How much damage gets through at path start |

## Limitations & Approximations

1. **Quantum Tunneler projections** are implemented as logical offsets on a single enemy entity. True multi-hitbox targeting would require deeper changes to the targeting pipeline.

2. **Weierstrass distortion** is implemented as a data model (grid offsets, anchor tracking). The actual visual distortion rendering (render-to-texture, tile shuffling) requires integration with CanvasRenderer.js and is scaffolded but not visually active yet.

3. **Directional saturation sectors** are resolved inline in `applyDamageToEnemy()` for performance. The system file exports helper functions for potential use by custom damage sources.

4. **Integral accumulator** uses inlined constants in `applyDamageToEnemy()` matching the values in IntegralEnemySystem.js. This avoids import overhead in the hot damage path.
