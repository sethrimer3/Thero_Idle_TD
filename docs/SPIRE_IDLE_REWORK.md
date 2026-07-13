# Spire Idle Rework Project

## Overview

The spire idle system has been redesigned to replace the old "idle bank" concept with a more intuitive **generation-per-minute** system combined with **catch-up simulation** mechanics.

## What Changed

### Old System (Removed)
- **Idle Banks**: Each spire had an "idle bank" (sparkBank, particleBank, fluidIdleBank) that accumulated resources
- **Gradual Spawning**: Banks spawned entities into simulations gradually over time via spawn accumulators
- **Bank-based Upgrades**: Upgrades cost resources from the idle banks

### New System (Current)
- **Generation Rates**: Each spire generates resources per minute based on formulas
- **Catch-up Simulation**: When player returns from idle, simulations "fast forward" to catch up
- **No Idle Banks**: Resources are generated and applied directly to simulations
- **Free Upgrades**: Spire upgrades are now free (can be adjusted to use other currencies if needed)

## Generation Rate Formulas

### Lamed Spire (Aleph)
- **Resource**: Motes
- **Base Rate**: 100 motes per minute
- **Formula**: `baseRate * upgradeMultiplier`

### Tsadi Spire
- **Resource**: Particles
- **Dependency**: Based on Lamed generation rate
- **Formula**: `lamedRate / 100` (1 particle per 100 Lamed motes)

### Bet Spire
- **Resource**: Scintilla particles
- **Dependency**: Based on Lamed generation rate
- **Formula**: `lamedRate / 100` (1 scintilla per 100 Lamed motes)

## Catch-up Mechanics

When a player returns after being idle:

1. **Calculate Elapsed Time**: Compare current time to last active timestamp for each spire
2. **Calculate Generated Resources**: Multiply generation rate by elapsed minutes
3. **Fast-forward Simulation**: Spawn the calculated number of entities into the simulation
4. **Update State**: Set last active timestamp to current time

### Example

If a player idles for 5 minutes:
- **Lamed Spire**: Generates 500 motes → 500 stars spawn into the simulation
- **Bet Spire**: Generates 5 scintilla → 5 scintilla particles spawn into the simulation

The visual effect is that the spires instantly "catch up" to where they should be, rather than slowly draining from a bank.

## Implementation Details

### Key Files

- **`assets/spireIdleGeneration.js`**: Core generation rate and catch-up logic
- **`scripts/features/towers/lamedTower.js`**: Lamed spire with `spawnMultipleStars()` method
- **`scripts/features/towers/tsadiTower.js`**: Tsadi spire with `spawnMultipleParticles()` method
- **`assets/spireResourceBanks.js`**: Simplified to only handle unlocks and glyph reconciliation
- **`assets/main.js`**: Updated to remove all idle bank references

### Methods Added

#### GravitySimulation (Lamed Tower)
```javascript
spawnMultipleStars(count) {
  // Spawns multiple stars for catch-up after idle time
  // Returns number of stars actually spawned
}
```

#### ParticleFusionSimulation (Tsadi Tower)
```javascript
spawnMultipleParticles(count) {
  // Spawns multiple particles for catch-up after idle time
  // Returns number of particles actually spawned
}
```

### Methods Removed

- `addToSparkBank(amount)` - Lamed tower
- `setSparkBank(amount)` - Lamed tower
- `addToParticleBank(amount)` - Tsadi tower
- `setParticleBank(amount)` - Tsadi tower
- `getBetSandBank()` - spireResourceBanks
- `setBetSandBank(amount)` - spireResourceBanks
- `getLamedSparkBank()` - spireResourceBanks
- `setLamedSparkBank(amount)` - spireResourceBanks
- `getTsadiParticleBank()` - spireResourceBanks
- `setTsadiParticleBank(amount)` - spireResourceBanks

## Integration Guide

To integrate the new system into main.js:

1. **Import the generation system**:
   ```javascript
   import { createSpireIdleGeneration } from './spireIdleGeneration.js';
   ```

2. **Create the generation manager**:
   ```javascript
   const spireGeneration = createSpireIdleGeneration({
     spireResourceState,
   });
   ```

3. **Process catch-up on spire load**:
   ```javascript
   // When loading a spire
   const catchUp = spireGeneration.processCatchUp();
   
   // For Lamed
   if (catchUp.lamed.generated > 0) {
     lamedSimulation.spawnMultipleStars(catchUp.lamed.generated);
   }
   
   // For Tsadi
   if (catchUp.tsadi.generated > 0) {
     tsadiSimulation.spawnMultipleParticles(catchUp.tsadi.generated);
   }
   
   // For Bet
   if (catchUp.bet.generated > 0) {
     // Apply to bet spire simulation
   }
   ```

4. **Update last active time periodically**:
   ```javascript
   // When saving or on regular intervals
   spireGeneration.updateLastActiveTime('lamed');
   spireGeneration.updateLastActiveTime('tsadi');
   spireGeneration.updateLastActiveTime('bet');
   ```

## Future Enhancements

### Potential Improvements

1. **Upgrade System**: Could add costs back to upgrades using other currencies (glyphs, energy, etc.)
2. **Scaling Formulas**: Generation rates could scale with player progression or achievements
3. **UI Display**: Show current generation rates in spire UI menus
4. **Catch-up Limits**: Add caps to prevent excessive catch-up from very long idle times
5. **Visual Effects**: Enhanced visual feedback when catch-up spawning occurs

### Extensibility

The generation system is designed to be extensible:

- Add new spires by extending the generation rate calculations
- Modify formulas without changing the core catch-up logic
- Add multipliers from upgrades, achievements, or other game systems

## Testing Checklist

- [ ] Lamed spire spawns stars normally during active play
- [ ] Tsadi spire spawns particles normally during active play
- [ ] Catch-up spawning works correctly after idle time
- [ ] Generation rates are calculated correctly
- [ ] Last active timestamps persist across sessions
- [ ] No console errors related to missing bank methods
- [ ] UI displays work without bank values
- [ ] Developer mode tools work without banks
- [ ] Persistence system saves/loads without banks

## Migration Notes

### For Existing Save Files

Old save files with idle bank values will:
- Have those values ignored on load
- Not cause errors (removed references handle undefined gracefully)
- Continue to work with the new system

### Breaking Changes

- All idle bank values are discarded
- Upgrades that cost sparkBank/particleBank are now free
- UI that displayed bank counts should be updated or removed

## Build History

- **Build 428**: Changed Lamed spire to use .png sprites instead of .svg
- **Build 429**: Removed sparkBank and particleBank from towers, added spire idle generation system
- **Build 430**: (Next) Complete integration of catch-up mechanics with main.js

## See Also

- `/docs/PROGRESSION.md` - Game progression and formulas
- `/AGENTS.md` - Project vision and spire concepts
- `/assets/spireIdleGeneration.js` - Implementation details
