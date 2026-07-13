# Spire Idle Time Logic Implementation

## Overview

This document explains how idle time logic works for the bet spire, lamed spire, and tsadi spire in Thero Idle.

## System Architecture

### Idle Banks

Each spire has an idle bank that accumulates resources while the player is away:

- **Lamed Spire**: `lamedSparkBank` - stores idle stars
- **Tsadi Spire**: `tsadiParticleBank` - stores idle particles
- **Bet Spire**: Uses existing fluid idle bank system

The banks are stored in `powderState` and persist across sessions via `powderPersistence.js`.

### Conversion Ratios

Resources cascade up the spire chain with a 100:1 conversion ratio:
- 100 Aleph motes → 1 Bet particle
- 100 Bet particles → 1 Lamed star
- 100 Lamed stars → 1 Tsadi particle
- etc.

This is calculated in `powderDisplay.js` via the `calculateIdleSpireConversions` function.

### Distribution Functions

Located in `/assets/spireIdleApplication.js`:

#### Bet Spire Distribution
```javascript
distributeBetIdleParticles(totalParticles)
```
Splits particles among scintilla tiers using a 100:1 ratio between tiers:
- Example: 1,234,567 particles → 67 sand + 45 quartz + 23 ruby + 1 sunstone

#### Lamed Spire Mass Calculation
```javascript
calculateLamedIdleMassGain(idleStars, starMass)
```
Calculates total mass to add to the sun:
- Total mass = idle stars × star mass
- Example: 100 stars × 5 mass = 500 total mass

#### Tsadi Spire Binary Decomposition
```javascript
distributeTsadiIdleParticles(totalParticles)
```
Converts particles into pre-merged tiers using binary representation:
- Example: 259 particles → 1 tier 7 (2^8=256) + 1 tier 0 (2^1=2) + 1 tier -1 (2^0=1)
- Note: Tier numbers are adjusted by -1 because null tier is -1 in the code

### Application Flow

1. **Idle Time Accumulation**
   - When player is away, `notifyIdleTime()` in `powderDisplay.js` is called
   - Resources are calculated and added to respective banks
   - Banks are saved via autosave system

2. **Idle Time Application**
   - When spire simulation is loaded for the first time, idle resources are applied:
     - **Bet Spire**: `applyBetIdleParticles()` spawns small particles at generators
     - **Lamed Spire**: `applyLamedIdleStars()` increases sun mass directly
     - **Tsadi Spire**: `applyTsadiIdleParticles()` spawns pre-merged particles
   - Bank is cleared after application

3. **Visual "Time Skip" Effect**
   - Particles appear at generators (bet)
   - Sun mass increases visibly (lamed)
   - Pre-merged particles spawn at high tiers (tsadi)
   - Makes it feel like time actually passed

## Code Locations

### Core Files
- `/assets/spireIdleApplication.js` - Distribution and application functions
- `/assets/powder/powderState.js` - Bank storage in powderState
- `/assets/powderPersistence.js` - Save/load logic for banks
- `/assets/powderDisplay.js` - Idle time calculation and bank updates
- `/assets/main.js` - Integration and bank getter/setter functions

### Integration Points
- Line ~3947 in main.js: `getLamedSparkBank()` and `setLamedSparkBank()`
- Line ~3962 in main.js: `getTsadiParticleBank()` and `setTsadiParticleBank()`
- Line ~6496 in main.js: Lamed idle application
- Line ~6698 in main.js: Tsadi idle application
- Line ~7245 in main.js: Bet idle application

## Testing

### Unit Tests
Run `/tmp/test-idle.mjs` to verify distribution functions:
```bash
node /tmp/test-idle.mjs
```

Expected output:
- Bet: 1,234,567 → 67 sand, 45 quartz, 23 ruby, 1 sunstone
- Tsadi: 259 → 1 tier 7, 1 tier 0, 1 tier -1 (tier numbers adjusted for null tier at -1)
- Lamed: 100 stars × 5 mass = 500 mass

### Manual Testing Checklist
1. Leave game for extended period
2. Return and check each spire:
   - Bet: Should see particles at generators
   - Lamed: Sun should be larger/more massive
   - Tsadi: Should see high-tier particles
3. Verify banks clear after application
4. Verify banks persist across saves

## Future Enhancements

- Aleph spire: Sand motes climbing higher up the wall
- Shin spire: More equivalence for upgrades
- Kuf spire: More shards to buy/upgrade things
- Visual effects for idle "catch-up" animations
- Configurable conversion ratios
