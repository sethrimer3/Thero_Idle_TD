# Kuf Spire Agent Guide

## Overview

The Kuf Spire is a tactical combat simulation system where players allocate shards to units and upgrades, then run simulations to earn Kuf glyphs. This guide provides context for working with Kuf Spire systems.

## Architecture

**Core Files:**
- `assets/kufState.js` - State management and shard allocation logic
- `assets/kufUI.js` - UI rendering and event handling
- `assets/kufSimulation.js` - Battlefield simulation engine
- `index.html` (Kuf section) - HTML structure for the Kuf spire tab

## UI Structure (Post-Reorganization)

### Layout Order (Top to Bottom)

1. **Simulation Canvas** (at top)
   - Shows live battlefield when running
   - Shows deployment menu when idle
   - Deployment menu includes:
     - "Start Simulation" button (top middle)
     - List of available units below
     - Each unit shows: name, current count, shard cost, upgrade button
     - +/- buttons for unit count
     - Upgrades button opens dropdown for that unit only
   
2. **Shard Ledger**
   - Total shards, remaining shards
   - High score, Kuf glyphs earned
   - Last run results

3. **Shard Codex**
   - Player unit statistics (count, stats)
   - Enemy unit statistics (highest killed, base stats)

## Unit Deployment System

### Unit Allocation
- Players use +/- buttons to buy/sell units
- Each unit has a shard cost defined in `kufState.js`
- Unit counts update immediately
- Shard balance updates in real-time

### Upgrade System
- Each unit can have multiple upgrades
- Clicking "Upgrades" button shows dropdown under that unit
- Dropdown contains all available upgrades with +/- buttons
- Only one dropdown can be open at a time
- Opening a new dropdown closes the previous one

### Click-and-Hold Behavior
- Clicking +/- once: single allocation
- Holding button: waits 1 second, then spams allocations
- Prevents accidental rapid allocation
- Works for both unit counts and upgrades

## State Management

**Key State Properties:**
- `totalShards` - Total shards available for allocation
- `allocations` - Shard allocations to marine stats (health, attack, speed)
- `units` - Object tracking unit counts (marines, snipers, splayers)
- `glyphs` - Total Kuf glyphs earned
- `highScore` - Best gold haul achieved

**Key Functions:**
- `purchaseKufUnit(unitType)` - Buy one unit
- `sellKufUnit(unitType)` - Sell one unit and refund shards
- `updateKufAllocation(stat, value)` - Update stat allocation
- `recordKufBattleOutcome(gold, glyphs)` - Save battle results

## Simulation Lifecycle

1. **Pre-Simulation** (deployment menu visible)
   - Player allocates shards to units and upgrades
   - "Start Simulation" button enabled when valid configuration
   
2. **Running Simulation** (canvas shows battlefield)
   - Deployment menu hidden
   - Canvas renders battlefield with units and enemies
   - Battle plays out automatically
   
3. **Post-Simulation** (results panel overlays canvas)
   - Shows gold earned, glyphs awarded
   - Option to reconfigure or start new run
   - Results saved to state

## Integration Points

**Spire Navigation:**
- Kuf spire tab button: `#tab-kuf`
- Kuf spire panel: `#panel-kuf`
- Unlocked when player has 10 glyphs in Shin spire

**Glyph System:**
- Kuf glyphs earned by beating high score
- Used for tower upgrades in main game
- Tracked in global state

## Common Patterns

### Adding a New Unit Type

1. Define unit stats in `kufState.js` (base stats object)
2. Add cost to `KUF_UNIT_COSTS` object
3. Add unit entry to deployment menu in `kufUI.js`
4. Create +/- button handlers
5. Update simulation to spawn new unit type
6. Add to Shard Codex statistics display

### Adding a New Upgrade

1. Define upgrade in state (upgrades object per unit)
2. Add upgrade cost calculation
3. Create dropdown entry in deployment menu
4. Add +/- buttons for upgrade level
5. Apply upgrade effects in simulation
6. Update UI to show current upgrade level

### Click-and-Hold Implementation

```javascript
let holdTimer = null;
let spamInterval = null;

button.addEventListener('mousedown', () => {
  performAction(); // Single click
  holdTimer = setTimeout(() => {
    spamInterval = setInterval(performAction, 100); // Spam every 100ms
  }, 1000); // Wait 1 second before spamming
});

button.addEventListener('mouseup', () => {
  clearTimeout(holdTimer);
  clearInterval(spamInterval);
});
```

## Mobile Considerations

- Touch events should work identically to mouse events
- Deployment menu must be readable on small screens
- Buttons should be large enough for touch targets (min 44px)
- Dropdowns should not overflow viewport

## Performance Notes

- Simulation runs at 60 FPS target
- Canvas redraws every frame during simulation
- State updates batched to minimize reflows
- Unit sprites cached for performance

## Testing Checklist

- [ ] Can allocate shards to units
- [ ] Can open/close upgrade dropdowns
- [ ] Only one dropdown open at time
- [ ] Click-and-hold works correctly
- [ ] Simulation runs with allocated units
- [ ] Results saved and displayed correctly
- [ ] Shard Codex shows accurate statistics
- [ ] High score triggers glyph awards
- [ ] Mobile touch interactions work
- [ ] Layout responsive to different screen sizes

## Common Issues

**Dropdown doesn't close:**
- Ensure click handlers on other dropdowns close siblings
- Check z-index stacking for overlay clicks

**Shards don't update:**
- Verify state change listeners are attached
- Check that allocation functions return new state

**Simulation doesn't start:**
- Ensure at least one unit purchased
- Check that simulation button event handler is bound
- Verify canvas context is available

## Style Guidelines

**Button States:**
- Use gradient backgrounds matching selected color palette
- Disabled buttons should have reduced opacity
- Hover states should elevate buttons slightly
- Active/pressed state should depress button

**Typography:**
- Unit names: Cormorant Garamond, serif
- Stats/numbers: Space Mono, monospace
- Descriptions: inherit body font

**Spacing:**
- Consistent 12-16px gaps between elements
- Cards use 20px padding
- Mobile: reduce padding to 12px

## Related Documentation

- `/AGENTS.md` - Project vision and conventions
- `/assets/agent.md` - Main game integration patterns
- `/docs/PROGRESSION.md` - Game progression and formulas
