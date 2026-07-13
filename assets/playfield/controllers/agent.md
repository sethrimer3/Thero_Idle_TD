# Playfield Controllers - Agent Guide

**Context:** Orchestration controllers extracted from monolithic `playfield.js` as part of Phase 1 refactoring (MONOLITHIC_REFACTORING_PLAN.md).

## Purpose

Controllers handle coordination and orchestration logic that spans multiple subsystems. Unlike managers (which encapsulate state and behavior for a single domain), controllers coordinate between managers, UI, and external systems.

## Current Controllers

### TowerOrchestrationController (Build 448)
- **Purpose:** Manages tower placement, upgrades, removal, and tower-to-tower connections
- **Responsibilities:**
  - Tower lifecycle (add, upgrade, downgrade, sell)
  - Tower connection management (linking, unlinking, compatibility checks)
  - Cost calculation and energy management integration
  - Infinity tower tracking and bonus application
- **State Managed:**
  - `towers` - Array of all tower objects
  - `infinityTowers` - Subset of infinity-type towers
  - `towerIdCounter` - Unique ID generator
  - `towerConnectionMap` - Map<sourceId, targetId>
  - `towerConnectionSources` - Map<targetId, Set<sourceIds>>
  - `towerGlyphTransitions` - Visual upgrade animation tracking

## Architecture Patterns

### Factory Function with Dependency Injection
Controllers use the factory function pattern:

```javascript
export function createControllerName(config) {
  // Validate configuration
  if (!config || !config.requiredDependency) {
    throw new Error('ControllerName requires requiredDependency in config');
  }

  // Private state
  let stateVariable = initialValue;

  // References to external systems
  const dependency = config.dependency;

  // Private helper functions
  function privateHelper() {
    // implementation
  }

  // Public API functions
  function publicMethod() {
    // implementation
  }

  // Return public API
  return {
    publicMethod,
    // Getters/setters for state (for backward compatibility)
    get stateVariable() { return stateVariable; },
    set stateVariable(value) { stateVariable = value; },
  };
}
```

### Integration with Playfield

Controllers are instantiated in `playfield.js` when level configuration is set:

```javascript
// In loadLevel or resetState
this.controllerName = createControllerName({
  playfield: this,
  combatState: this.combatStateManager,
  manager: ManagerModule,
  audio: this.audio,
  messageEl: this.messageEl,
  dependencies: this.dependencies,
});
```

### Property Delegation

Playfield maintains backward compatibility through property delegation:

```javascript
// In SimplePlayfield class
get stateVariable() {
  return this.controllerName ? this.controllerName.stateVariable : defaultValue;
}

set stateVariable(value) {
  if (this.controllerName) {
    this.controllerName.stateVariable = value;
  }
}
```

### Method Delegation

Original methods in playfield.js are replaced with delegation calls:

```javascript
methodName(args) {
  // Delegate to controller
  if (this.controllerName) {
    return this.controllerName.methodName(args);
  }
  return fallbackValue; // For preview mode or when controller doesn't exist
}
```

## Dependencies

Controllers depend on:
1. **Playfield reference** - For canvas operations, rendering, UI updates
2. **Manager modules** - For specific behavior (e.g., TowerManager for tower-specific state)
3. **Combat state** - For energy, enemies, combat flow
4. **Audio system** - For sound effects
5. **UI elements** - For message display and HUD updates
6. **Dependencies object** - For cross-system updates (e.g., `updateStatusDisplays()`)

## Testing Patterns

When testing controller integration:
1. Verify controller initialization in `loadLevel()` and `resetState()`
2. Check property delegation getters/setters
3. Confirm method delegation calls work correctly
4. Test backward compatibility (direct property access still works)
5. Validate state synchronization between controller and playfield

## Common Pitfalls

❌ **Don't:**
- Create circular dependencies (controller → playfield → controller)
- Mix orchestration logic with low-level behavior (that's for managers)
- Directly manipulate DOM outside of playfield coordination
- Bypass energy checks or validation

✅ **Do:**
- Validate all inputs and configuration
- Use factory functions for testability
- Maintain clear separation: controller orchestrates, manager implements
- Document all public API methods
- Include error handling for missing dependencies

## When to Create a New Controller

Create a new controller when:
- Logic coordinates multiple managers or subsystems
- Extracting ~500+ lines from playfield.js
- State management involves multiple interconnected concerns
- The logic has clear boundaries and a single responsibility

Don't create a controller when:
- Logic is render-only (create in `playfield/render/` instead)
- Logic is UI-specific (create in `playfield/ui/` instead)
- Logic is self-contained behavior (create a manager instead)

## File Organization

```
assets/playfield/controllers/
├── agent.md (this file)
├── TowerOrchestrationController.js
└── (future controllers as Phase 1 progresses)
```

## Next Steps

According to MONOLITHIC_REFACTORING_PLAN.md, the next controllers to extract are:
1. **RenderCoordinator** (Step 1.1.3) - Frame scheduling and render orchestration
2. **InputController enhancements** (Step 1.1.5) - Input handling improvements

Refer to the main refactoring plan for detailed extraction strategies.
