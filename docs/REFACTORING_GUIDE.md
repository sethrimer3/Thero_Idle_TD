# main.js Refactoring Guide

## Overview

This document outlines the strategy for refactoring `assets/main.js` (originally 10,002 lines) into smaller, more maintainable modules without changing any game functionality.

## Completed Work

### uiHelpers.js (173 lines extracted)

**Status:** ✅ Complete

**What was extracted:**
- `createOverlayHelpers()` - Factory function for overlay show/hide/cancel with transition handling
- `setElementVisibility()` - Toggle element visibility with accessibility hints
- `triggerButtonRipple()` - Create ripple animation effect on buttons  
- `scrollPanelToElement()` - Scroll panel to specific element with smooth behavior
- `enablePanelWheelScroll()` - Enable mouse wheel scrolling for panels

**Integration approach:**
- Functions exported as ES6 module exports
- Factory pattern used for `createOverlayHelpers()` to encapsulate WeakMap state
- Direct function exports for stateless utilities
- Main.js imports and uses directly

**Result:**
- main.js reduced from 10,002 to 9,829 lines
- All UI helper functions now in dedicated module
- No functionality changes

## Refactoring Strategy

### Key Challenges

1. **Tight Coupling**: Many functions in main.js share state through closures in an IIFE
2. **Interdependencies**: Functions frequently call other functions in the same scope
3. **Shared State**: Multiple systems access the same state objects (powderState, gameStats, etc.)
4. **Event Handlers**: Many functions are used as event handlers with specific signatures

### Successful Patterns

#### 1. Factory Functions (for stateful code)

```javascript
// In module file
export function createOverlayHelpers() {
  const overlayHideStates = new WeakMap();
  
  function cancelOverlayHide(overlay) {
    // Implementation using overlayHideStates
  }
  
  function scheduleOverlayHide(overlay) {
    // Implementation using overlayHideStates
  }
  
  return {
    cancelOverlayHide,
    scheduleOverlayHide,
    revealOverlay,
  };
}

// In main.js
const overlayHelpers = createOverlayHelpers();
const { cancelOverlayHide, scheduleOverlayHide, revealOverlay } = overlayHelpers;
```

#### 2. Direct Exports (for stateless utilities)

```javascript
// In module file
export function setElementVisibility(element, visible) {
  // Pure function - no shared state
}

export function triggerButtonRipple(button, event) {
  // Stateless DOM manipulation
}

// In main.js
import { setElementVisibility, triggerButtonRipple } from './uiHelpers.js';
```

#### 3. Dependency Injection (for functions needing context)

```javascript
// In module file
export function enablePanelWheelScroll(panel, isFieldNotesOverlayVisible) {
  // Function needs external dependency passed as parameter
  panel.addEventListener('wheel', (event) => {
    if (isFieldNotesOverlayVisible && isFieldNotesOverlayVisible()) {
      event.preventDefault();
      return;
    }
    // ...
  });
}

// In main.js
enablePanelWheelScroll(towerPanel, isFieldNotesOverlayVisible);
```

## Remaining Refactoring Opportunities

### Priority 1: Independent Utilities

These can be extracted with minimal changes:

#### Format Utilities
**Location:** Lines ~1613-1621, ~7417-7558  
**Functions:**
- `toSubscriptNumber(value)`
- `formatAlephLabel(index)`
- `formatBetLabel(index)`
- `formatDuration(seconds)`
- `formatRewards(rewardScore, rewardFlux, rewardEnergy)`
- `formatRelativeTime(timestamp)`

**Strategy:** Direct export as pure functions

#### Math/Geometry Utilities
**Location:** Lines ~5426-5540
**Functions:**
- `clampNormalizedCoordinate(value)`
- `sanitizeNormalizedPoint(point)`
- `transformPointForOrientation(point, orientation)`
- `transformPointFromOrientation(point, orientation)`
- `distanceSquaredToSegment(point, start, end)`

**Strategy:** Direct export as pure mathematical functions

### Priority 2: Semi-Independent Subsystems

These require careful dependency injection:

#### Achievement Notifications
**Location:** Lines ~8073-8137
**Functions:**
- `notifyAutoAnchorUsed(currentPlaced, totalAnchors)`
- `notifyEnemyDefeated()`
- `notifyLevelVictory(levelId)`
- `notifyPowderAction()`
- `notifyPowderSigils(count)`
- `notifyPowderMultiplier(value)`

**Dependencies:**
- `gameStats` (state object)
- `evaluateAchievements()` function
- `isInteractiveLevel()` function
- Various powder/tower state and functions

**Strategy:** Create factory function that accepts dependencies object

```javascript
export function createAchievementNotifications(deps) {
  const {
    gameStats,
    evaluateAchievements,
    isInteractiveLevel,
    // ... other dependencies
  } = deps;
  
  function notifyAutoAnchorUsed(currentPlaced, totalAnchors) {
    // Implementation
  }
  
  return {
    notifyAutoAnchorUsed,
    notifyEnemyDefeated,
    // ... other functions
  };
}
```

#### Audio Management
**Location:** Lines ~1673-1768  
**Functions:**
- `suppressAudioPlayback(reason)`
- `releaseAudioSuppression(reason)`
- `isAudioSuppressed()`
- `syncAudioControlsFromManager()`
- `saveAudioSettings()`
- `bindAudioControls()`
- `determineMusicKey()`
- `refreshTabMusic(options)`

**Dependencies:**
- `audioManager` instance
- `audioSuppressionReasons` Set
- `audioControlsBinding` reference

**Strategy:** Factory function with audioManager dependency

### Priority 3: Complex Subsystems (requires major refactoring)

#### Level System
**Location:** Lines ~5189-6802  
**Size:** ~1600 lines
**Complexity:** Very high - many interdependencies

**Major components:**
- Level card building and rendering
- Level selection handling
- Level editor (path editing)
- Level preview generation
- Level overlay management
- Developer map elements

**Strategy:** 
1. Start by extracting pure utility functions (path generation, preview)
2. Create sub-modules for editor, preview, cards
3. Use dependency injection heavily
4. May need intermediate state management layer

#### Powder Simulation System
**Location:** Lines ~2033-4385, ~8064-9146  
**Size:** ~2500+ lines
**Complexity:** Extreme - deeply integrated with game state

**Major components:**
- Powder/fluid simulation mode switching
- Height change handlers
- Basin state management
- Mote/drop queueing
- Idle resource generation
- Wall metrics and visuals

**Strategy:**
1. Extract state persistence functions first
2. Create event coordination layer
3. Use dependency injection for all game state
4. Consider creating facade pattern to simplify external interface

#### Playfield System  
**Location:** Lines ~1473-1637, ~4756-4922
**Size:** ~450 lines
**Complexity:** Moderate - coupled with level system

**Major components:**
- Playfield outcome overlay (victory/defeat)
- Playfield menu
- Combat state handlers

**Strategy:**
1. Extract outcome overlay as separate module
2. Use factory pattern for event handlers
3. Pass playfield instance as dependency

#### Developer Mode
**Location:** Lines ~465-1414, ~7595-8038  
**Size:** ~1400 lines
**Complexity:** Moderate - lots of state manipulation

**Major components:**
- Developer mode toggle
- Developer controls (fields, handlers)
- Developer reset functionality  
- Developer map placement

**Strategy:**
1. Create configuration object for all dev settings
2. Extract reset logic first (most independent)
3. Use factory for controls with state binding
4. May need event emitter pattern for state changes

## Testing Approach

### Before Each Extraction

1. **Document current behavior:**
   - What functions are being moved
   - What other functions call them
   - What state they access/modify

2. **Identify dependencies:**
   - List all external functions called
   - List all state objects accessed
   - List all DOM elements referenced

3. **Plan integration:**
   - How will dependencies be passed?
   - Factory function vs direct export?
   - What will the import statement look like?

### After Each Extraction

1. **Syntax validation:**
   ```bash
   node -c assets/module-name.js
   node -c assets/main.js
   ```

2. **Module loading test:**
   ```bash
   node --input-type=module -e "import('./assets/module-name.js').then(() => console.log('OK'))"
   ```

3. **Browser test:**
   - Open index.html in browser
   - Check console for errors
   - Test specific functionality that uses extracted code
   - Verify save/load works
   - Check all UI interactions

4. **Integration test:**
   - Play through a level
   - Test upgrade system
   - Test spire simulations
   - Verify no regression in existing features

## Best Practices

### DO:
- ✅ Extract truly independent utility functions first
- ✅ Use factory functions for code that needs private state
- ✅ Pass dependencies explicitly rather than accessing globals
- ✅ Keep related functions together in the same module
- ✅ Test after each extraction
- ✅ Document what was extracted and why
- ✅ Preserve all existing comments
- ✅ Maintain existing code style

### DON'T:
- ❌ Extract large interdependent sections in one go
- ❌ Change function signatures during extraction
- ❌ Remove any functionality, even if it seems unused
- ❌ Introduce new patterns that differ from existing code
- ❌ Mix refactoring with bug fixes or new features
- ❌ Skip testing intermediate steps
- ❌ Force extraction of heavily coupled code

## Incremental Approach

The safest way to complete this refactoring:

1. **Week 1-2:** Extract all independent utility functions
   - Format utilities
   - Math/geometry helpers
   - Simple DOM utilities

2. **Week 3-4:** Extract semi-independent subsystems  
   - Achievement notifications (with DI)
   - Audio management (with DI)
   - Resource display functions

3. **Week 5-6:** Tackle one complex subsystem
   - Start with Playfield (smallest complex system)
   - Extract incrementally
   - Test thoroughly at each step

4. **Week 7-8:** Continue with next complex subsystem
   - Developer Mode (moderate complexity)
   - Break into smaller pieces first

5. **Week 9-12:** Tackle largest systems
   - Level System (break into 3-4 sub-modules)
   - Powder Simulation (may need complete redesign)

## Success Metrics

- **Lines of code in main.js:** Target < 5,000 lines
- **Number of modules:** Target 10-15 focused modules
- **Test coverage:** All existing functionality works identically
- **Code maintainability:** Easy to find and modify specific features
- **No regressions:** Zero functionality changes or bugs introduced

## Notes

- The code uses an IIFE wrapping everything, which creates tight coupling via closures
- Many functions need access to the same state objects
- Event handlers are defined inline and passed to various systems
- Consider eventual transition to ES6 classes or object-oriented patterns
- May benefit from state management library (Redux, MobX) for complex state
- TypeScript could help with refactoring by making dependencies explicit

## Conclusion

This refactoring is a large undertaking due to the tight coupling in the original code. The key to success is:
1. Move slowly and incrementally
2. Test thoroughly after each change
3. Use appropriate patterns (factory, DI) for different situations
4. Don't try to extract everything at once
5. Accept that some code may need to stay in main.js until a broader architecture change

The completed `uiHelpers.js` extraction demonstrates the process and can serve as a template for future extractions.
