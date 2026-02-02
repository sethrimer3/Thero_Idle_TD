# Foundry Production Menu - Implementation Summary

## Overview

This implementation adds a foundry production building to the Bet Spire terrarium with a comprehensive upgrade system. The foundry can be placed in the terrarium and clicked to open a production menu with multiple upgrade paths.

## Features Implemented

### 1. Foundry Placement System
- **Location**: Added to terrarium store items in `fluidTerrariumTrees.js`
- **Cost**: 500 Scintillae
- **Placement**: Must be on walkable terrain (not underground or in water)
- **Visual**: Appears as a ⚒️ emoji with orange glow
- **Interactive**: Clickable to open production menu

### 2. Sun Resource System
- **New Resource**: "Sun" currency separate from Scintillae
- **Initial Grant**: 1000 sun when the sun celestial body is unlocked
- **Storage**: Persisted in `powderState.betTerrarium.sunResource`
- **Functions**: `getSunBalance()`, `spendSun()`, `addSun()`

### 3. Foundry State Management
- **Per-Foundry State**: Each placed foundry has independent state
- **State Properties**:
  - `level`: Foundry level (1, 2, or 3)
  - `structureLevel`: Structure upgrade tier (0-3)
  - `starlingLevel`: Starling upgrade tier (0-3)
- **Storage**: Persisted in `powderState.betTerrarium.foundries[foundryId]`

### 4. Production Menu UI
- **Layout**: 3×3 grid with 5 active buttons
- **Buttons**:
  - **Top**: Upgrade foundry (Level I → II → III)
  - **Left**: Upgrade structures (Tier 0 → 1 → 2 → 3)
  - **Right**: Upgrade starlings (Tier 0 → 1 → 2 → 3)
  - **Bottom**: Create solar mirror (unlimited)
  - **Center**: Foundry icon (decorative)
- **Display**: Shows foundry level, sun balance, upgrade costs
- **Roman Numerals**: All levels displayed with Roman numerals (I, II, III)

### 5. Upgrade Gating Logic
- **Foundry Upgrades**: Can upgrade anytime (don't require other upgrades)
- **Structure/Starling Tier 1**: Available at Foundry Level 1
- **Structure/Starling Tier 2**: Unlocked at Foundry Level 2
- **Structure/Starling Tier 3**: Unlocked at Foundry Level 3
- **Independence**: Can upgrade foundry without buying structure/starling upgrades

### 6. Upgrade Costs

| Upgrade | Cost (Sun) |
|---------|-----------|
| Foundry I → II | 500 |
| Foundry II → III | 1000 |
| Structures Tier 0 → 1 | 200 |
| Structures Tier 1 → 2 | 400 |
| Structures Tier 2 → 3 | 800 |
| Starlings Tier 0 → 1 | 200 |
| Starlings Tier 1 → 2 | 400 |
| Starlings Tier 2 → 3 | 800 |
| Solar Mirror | 300 |

## File Structure

### New Files
- `assets/fluidTerrariumFoundry.js` - Main foundry module (650 lines)
- `FOUNDRY_TESTING.md` - Testing documentation
- `FOUNDRY_VISUAL_DESIGN.md` - Visual design specification

### Modified Files
- `assets/fluidTerrariumTrees.js` - Added foundry store item and placement handler
- `assets/main.js` - Integrated foundry system, added sun resource management
- `assets/styles.css` - Added foundry and production menu styles
- `assets/buildInfo.js` - Updated build number to 413

## Code Architecture

### Module: FluidTerrariumFoundry

**Constructor Options:**
```javascript
{
  container: HTMLElement,           // Parent container for foundry elements
  getSunBalance: Function,          // Returns current sun balance
  spendSun: Function,              // Spends sun resource
  addSun: Function,                // Adds sun resource
  getFoundryState: Function,       // Gets all foundry states
  setFoundryState: Function,       // Updates foundry state
  onUpgrade: Function,             // Callback for upgrades
  onStarlingUpgrade: Function,     // Callback for starling sprite changes
}
```

**Key Methods:**
- `place(placement)` - Place a foundry at coordinates
- `openProductionMenu(foundryId)` - Show production menu
- `handleUpgradeFoundry()` - Process foundry upgrade
- `handleUpgradeStructures()` - Process structure upgrade
- `handleUpgradeStarlings()` - Process starling upgrade
- `handleCreateMirror()` - Create solar mirror
- `refresh()` - Update all displays
- `destroy()` - Clean up

### Integration Points

**In fluidTerrariumTrees.js:**
```javascript
// Store item definition
{
  id: 'bet-store-foundry',
  label: 'Foundry',
  itemType: 'foundry',
  cost: 500,
  size: 'large',
  minY: 0.35,
  maxY: 0.85,
  minSpacing: 0.1,
}

// Callback registration
this.onFoundryPlace = typeof options.onFoundryPlace === 'function' 
  ? options.onFoundryPlace 
  : null;

// Placement handling
if (storeItem.itemType === 'foundry' && this.onFoundryPlace) {
  const foundryPlaced = this.onFoundryPlace({ point, storeItem, placementId });
  // ...
}
```

**In main.js:**
```javascript
// Sun resource management
const getSunBalance = () => powderState.betTerrarium?.sunResource || 0;
const spendSun = (amount) => { /* deduct and save */ };
const addSun = (amount) => { /* add and save */ };

// Foundry state management
const getFoundryState = () => powderState.betTerrarium.foundries || {};
const setFoundryState = (state) => { /* update and save */ };

// Initialization
function ensureFluidTerrariumFoundry() {
  fluidTerrariumFoundry = new FluidTerrariumFoundry({
    container: fluidElements.terrariumMedia,
    getSunBalance, spendSun, addSun,
    getFoundryState, setFoundryState,
    onUpgrade, onStarlingUpgrade,
  });
}

// Placement handler
function handleFoundryPlacement(options) {
  ensureFluidTerrariumFoundry();
  return fluidTerrariumFoundry.place(options);
}

// Wire to terrarium
fluidTerrariumTrees = new FluidTerrariumTrees({
  // ...
  onFoundryPlace: handleFoundryPlacement,
  // ...
});
```

## CSS Structure

### Foundry Button (in terrarium)
```css
.fluid-terrarium-foundry {
  position: absolute;
  width: 48px;
  height: 48px;
  background: rgba(255, 140, 0, 0.2);
  border: 2px solid rgba(255, 140, 0, 0.6);
  /* ... */
}
```

### Production Menu
```css
.fluid-terrarium-foundry-menu {
  position: fixed;
  inset: 0;
  z-index: 1000;
  /* ... */
}

.fluid-terrarium-foundry-menu__buttons {
  display: grid;
  grid-template-columns: repeat(3, 120px);
  grid-template-rows: repeat(3, 120px);
  gap: 12px;
}

.foundry-button--top { grid-column: 2; grid-row: 1; }
.foundry-button--left { grid-column: 1; grid-row: 2; }
.foundry-button--center { grid-column: 2; grid-row: 2; }
.foundry-button--right { grid-column: 3; grid-row: 2; }
.foundry-button--bottom { grid-column: 2; grid-row: 3; }
```

## Developer Testing

### Console Commands
```javascript
// Add sun for testing
window.foundryTest.addSun(1000);

// Check balance
window.foundryTest.getSunBalance();

// View state
window.foundryTest.getFoundryState();
```

## Known Limitations

1. **Starling Sprites**: Infrastructure exists but visual sprite changes not yet connected to bird rendering system
2. **Solar Mirror**: Created but has no gameplay effect (placeholder)
3. **Multiple Foundries**: System supports it, but may want to limit to one per player
4. **Sun Generation**: No passive sun generation yet (future feature)

## Future Enhancements

1. **Starling Visual Upgrades**: Wire sprite level changes to FluidTerrariumBirds rendering
2. **Solar Mirror Mechanics**: Add actual gameplay effect (resource generation?)
3. **Structure Upgrades**: Define what structures do mechanically
4. **Animations**: Add particle effects for upgrades
5. **Sound Effects**: Add audio feedback for upgrades
6. **Sun Generation**: Add passive sun generation from solar mirrors or sun celestial body
7. **Foundry Visuals**: Custom sprite beyond emoji

## Testing Checklist

- [x] Code compiles without syntax errors
- [x] Foundry appears in store
- [ ] Foundry can be placed on terrain
- [ ] Production menu opens on click
- [ ] All upgrade buttons work
- [ ] Upgrade gating works correctly
- [ ] Sun resource persists across reloads
- [ ] Foundry state persists across reloads
- [ ] Multiple foundries have independent state
- [ ] UI is responsive on mobile
- [ ] Accessibility features work (keyboard, screen readers)

## Build Information

- **Build Number**: 413
- **Files Changed**: 5 new/modified
- **Lines Added**: ~1,100
- **Implementation Time**: ~2 hours
