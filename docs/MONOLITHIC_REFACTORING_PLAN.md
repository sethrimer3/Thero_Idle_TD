# Monolithic File Refactoring Plan

**Build 443 - Comprehensive Strategy for Breaking Down Large Files**

## Executive Summary

This document provides a detailed, actionable plan for refactoring the largest monolithic files in Thero Idle TD without degrading functionality or performance. The plan prioritizes surgical, incremental changes that maintain API boundaries, preserve existing behavior, and enable parallel development across multiple systems.

**Key Principles:**
- **Preserve functionality:** Every refactor must maintain identical game behavior
- **Maintain performance:** No degradation in frame rates, load times, or memory usage
- **Incremental approach:** Small, testable changes with validation at each step
- **Clear boundaries:** Each extracted module owns a single, well-defined responsibility
- **Documentation-first:** Update architectural docs before and after each extraction

## Current State Analysis

### File Size Metrics (Lines of Code)

| File | Lines | Category | Priority |
|------|-------|----------|----------|
| `assets/playfield.js` | 11,862 | Core Gameplay | **CRITICAL** |
| `scripts/features/towers/cardinalWardenSimulation.js` | 8,015 | Tower Logic | **HIGH** |
| `assets/main.js` | 7,366 | Orchestration | **CRITICAL** |
| `assets/playfield/render/CanvasRenderer.js` | 3,987 | Rendering | **HIGH** |
| `scripts/features/towers/tsadiTower.js` | 3,391 | Tower Logic | **MEDIUM** |
| `assets/kufSimulation.js` | 3,047 | Spire System | **MEDIUM** |
| `assets/fluidTerrariumTrees.js` | 2,945 | Powder System | **MEDIUM** |
| `scripts/features/towers/lamedTower.js` | 2,924 | Tower Logic | **MEDIUM** |
| `assets/betSpireRender.js` | 2,677 | Rendering | **MEDIUM** |
| `assets/towerEquations/advancedTowers.js` | 2,435 | UI/Display | **LOW** |

### Performance Baseline Requirements

Before any refactoring begins, establish these baseline metrics:

1. **Rendering Performance:**
   - Target: 60 FPS on mobile devices during active gameplay
   - Measure: Average frame time in active wave with 10+ towers and 20+ enemies
   - Tool: Browser Performance tab with throttled CPU (4x slowdown)

2. **Load Time:**
   - Target: < 3 seconds from page load to interactive menu on 3G connection
   - Measure: Time to first paint and time to interactive
   - Tool: Chrome DevTools Network tab with Fast 3G throttling

3. **Memory Usage:**
   - Target: < 150MB heap size during typical 30-minute session
   - Measure: Peak memory usage across tab switches and level transitions
   - Tool: Chrome DevTools Memory profiler

4. **Bundle Size (future concern):**
   - Target: Keep total JS < 2MB uncompressed (currently no bundler)
   - Measure: Sum of all loaded script file sizes
   - Tool: Network tab waterfall

## Refactoring Strategy

### Phase 1: Critical Infrastructure (Priority: CRITICAL)

#### 1.1 `assets/playfield.js` - Core Gameplay Orchestrator (11,862 lines)

**Problem:** The `SimplePlayfield` class combines rendering, combat logic, input handling, tower orchestration, developer tools, and UI state management in a single file. Changes to any subsystem risk breaking unrelated features.

**Current Responsibilities:**
- Canvas rendering coordination (tower sprites, projectiles, effects)
- Combat state management (enemies, waves, victory/defeat)
- Input handling (touch/mouse, tower placement, gesture recognition)
- Tower lifecycle (spawn, upgrade, targeting, ability execution)
- Developer tools (crystal manager, debug overlays)
- UI notifications (gem drops, codex encounters, floating feedback)
- Level flow control (start, pause, restart, exit)

**Refactoring Plan:**

**Step 1.1.1: Extract Combat State Manager**
- **Target:** ~800 lines
- **New File:** `assets/playfield/managers/CombatStateManager.js`
- **Responsibilities:**
  - Wave progression (`currentWave`, `waveSchedule`, `nextSpawnTime`)
  - Enemy lifecycle (`enemies` array, spawn/death handling)
  - Victory/defeat conditions
  - Resource income calculations
- **Interface:**
  ```javascript
  export function createCombatStateManager(config) {
    return {
      startWave(waveIndex) { },
      updateEnemies(deltaTime) { },
      spawnEnemy(enemyType, path) { },
      removeEnemy(enemyIndex) { },
      checkVictoryCondition() { },
      checkDefeatCondition() { },
      getEnemyCount() { },
      resetCombat() { }
    };
  }
  ```
- **Migration Strategy:**
  1. Create new file with factory function
  2. Move enemy management methods (`spawnEnemy`, `handleEnemyDeath`, etc.)
  3. Update `SimplePlayfield` to delegate to combat manager
  4. Test: Load level, complete waves, verify enemy spawning/death
  5. Verify: No change in performance or behavior
- **Performance Considerations:**
  - Combat manager should return data structures, not trigger renders
  - Minimize object allocations in `updateEnemies` hot path
  - Reuse enemy spawn configurations where possible

**Step 1.1.2: Extract Tower Orchestration Controller**
- **Target:** ~900 lines
- **New File:** `assets/playfield/controllers/TowerOrchestrationController.js`
- **Responsibilities:**
  - Tower spawn/placement (`spawnTower`, `handleSlotSelect`)
  - Tower upgrade coordination
  - Targeting logic delegation to individual tower modules
  - Ability triggering and cooldown management
- **Interface:**
  ```javascript
  export function createTowerOrchestrationController(playfield, combatState) {
    return {
      placeTower(slotIndex, towerType) { },
      upgradeTower(slotIndex, upgradeId) { },
      updateTowers(deltaTime) { },
      handleTowerClick(slotIndex) { },
      getTowerAt(slotIndex) { },
      canPlaceTower(slotIndex, towerType) { },
      getTowerMenuState() { }
    };
  }
  ```
- **Migration Strategy:**
  1. Create controller factory with explicit dependencies
  2. Move tower placement logic (`handleSlotSelect`, slot validation)
  3. Move tower update orchestration (delegate to tower modules for behavior)
  4. Update `SimplePlayfield` to use controller methods
  5. Test: Place towers, upgrade towers, verify targeting
  6. Verify: Frame time remains < 16.67ms during tower updates
- **Performance Considerations:**
  - Tower targeting should remain in individual tower modules
  - Avoid creating new tower configuration objects on each update
  - Reuse projectile pools where already implemented

**Step 1.1.3: Extract Rendering Coordinator**
- **Target:** ~600 lines
- **New File:** `assets/playfield/render/RenderCoordinator.js`
- **Responsibilities:**
  - Frame scheduling (`requestAnimationFrame` management)
  - Render order orchestration (background → towers → projectiles → effects → UI)
  - Canvas state management (save/restore, transform stack)
  - Performance monitoring (frame time tracking)
- **Interface:**
  ```javascript
  export function createRenderCoordinator(canvas, canvasRenderer) {
    return {
      startRenderLoop() { },
      stopRenderLoop() { },
      renderFrame(state) { },
      updateFrameTiming(deltaTime) { },
      getAverageFPS() { },
      requestSingleFrame() { }
    };
  }
  ```
- **Migration Strategy:**
  1. Create coordinator that wraps `CanvasRenderer` instance
  2. Move `requestAnimationFrame` scheduling out of `SimplePlayfield`
  3. Extract frame timing logic (`lastFrameTime`, `deltaTime` calculation)
  4. Update `SimplePlayfield.update()` to use coordinator
  5. Test: Verify smooth rendering at 60 FPS
  6. Verify: No change in render loop performance
- **Performance Considerations:**
  - Maintain existing `requestAnimationFrame` usage pattern
  - Do not add overhead between frame request and render start
  - Keep frame timing calculations inline (avoid function calls)

**Step 1.1.4: Extract Developer Tools Service**
- **Target:** ~400 lines
- **New File:** `assets/playfield/services/DeveloperToolsService.js`
- **Responsibilities:**
  - Developer crystal management (currently `DeveloperCrystalManager` mixin)
  - Debug overlay rendering
  - Frame time display
  - Developer controls integration
- **Interface:**
  ```javascript
  export function createDeveloperToolsService(playfield) {
    return {
      initialize() { },
      updateCrystalPositions(deltaTime) { },
      renderDebugOverlays(ctx) { },
      toggleDebugMode() { },
      logPerformanceMetrics() { }
    };
  }
  ```
- **Migration Strategy:**
  1. Remove `Object.assign(SimplePlayfield.prototype, DeveloperCrystalManager)`
  2. Create service factory that accepts playfield reference
  3. Move all developer-only methods to service
  4. Gate service creation behind developer mode flag
  5. Test: Enable developer mode, verify crystal manager works
  6. Verify: No impact on production build size (future concern)
- **Performance Considerations:**
  - Service should be lazy-loaded (not created unless needed)
  - Debug rendering should not impact main render loop performance
  - Consider feature flag to exclude from production builds

**Step 1.1.5: Extract Input Controller Enhancements**
- **Target:** ~300 lines (additional logic beyond current `InputController`)
- **New File:** Extend `assets/playfield/input/InputController.js`
- **Responsibilities:**
  - Tower hold activation (currently in `playfield.js`)
  - Double-tap gesture detection for tower menu
  - Drag-scroll coordination with tower selection
  - Cost scribble triggering on invalid placements
- **Migration Strategy:**
  1. Move gesture detection constants to `InputController`
  2. Extract hold/double-tap logic from `SimplePlayfield` event handlers
  3. Update `InputController` to emit higher-level events (e.g., `tower:hold-activated`)
  4. Update `SimplePlayfield` to listen to input controller events
  5. Test: Touch/mouse input for tower placement, verify gestures
  6. Verify: Input latency remains < 100ms (touch to visual feedback)
- **Performance Considerations:**
  - Gesture detection runs on every touch event (keep lightweight)
  - Avoid memory allocations in touch move handlers
  - Reuse event objects where possible

**Step 1.1.6: Integration and Validation**
- **Activities:**
  1. Update `configurePlayfieldSystem()` factory to compose extracted controllers
  2. Verify `SimplePlayfield` class is now < 3,000 lines (75% reduction)
  3. Run full gameplay test: 10 levels, all tower types, all upgrades
  4. Performance validation:
     - Measure frame time during heavy combat (target: < 16.67ms p95)
     - Measure memory usage over 30-minute session (target: < 150MB)
     - Verify load time unchanged (target: < 3s to interactive)
  5. Update `docs/main_refactor_contexts.md` with new controller boundaries
  6. Update `AGENTS.md` to reference new architectural patterns

#### 1.2 `assets/main.js` - Application Orchestrator (7,366 lines)

**Problem:** Main.js acts as the global orchestrator for state initialization, tab routing, overlay management, autosave coordination, and lifecycle hooks. While many subsystems have been extracted (per `main_refactor_contexts.md`), the file still handles too many concerns.

**Current Responsibilities:**
- Resource state initialization (`resourceState`, `powderState`, `spireResourceState`)
- Tab navigation and routing
- Overlay lifecycle management
- Autosave coordination
- Level preview and entry flow
- Developer controls integration
- Audio system coordination
- Configuration loading and normalization

**Refactoring Plan:**

**Step 1.2.1: Extract Navigation Router**
- **Target:** ~500 lines
- **New File:** `assets/navigation/NavigationRouter.js`
- **Responsibilities:**
  - Tab switching logic (`setActiveTab`, `getActiveTabId`, `tabForSpire`)
  - Overlay show/hide coordination
  - Focus management and ARIA attribute updates
  - Navigation state persistence (active tab, open overlays)
- **Interface:**
  ```javascript
  export function createNavigationRouter(tabConfig) {
    return {
      setActiveTab(tabId) { },
      getActiveTab() { },
      openOverlay(overlayId, options) { },
      closeOverlay(overlayId) { },
      closeAllOverlays() { },
      getOverlayState(overlayId) { },
      getTabForSpire(spireName) { }
    };
  }
  ```
- **Migration Strategy:**
  1. Create router with tab configuration
  2. Move tab switching functions from `main.js`
  3. Move overlay management functions
  4. Update tab click handlers to use router
  5. Test: Navigate all tabs, open/close all overlays
  6. Verify: Focus management works correctly, ARIA attributes set
- **Performance Considerations:**
  - Tab switches should feel instant (< 50ms)
  - Overlay animations should not block main thread
  - Minimize DOM queries by caching element references

**Step 1.2.2: Extract Lifecycle Coordinator**
- **Target:** ~400 lines
- **New File:** `assets/orchestration/LifecycleCoordinator.js`
- **Responsibilities:**
  - Application initialization sequence
  - Level start/end coordination
  - Idle time calculation and reward distribution
  - Autosave scheduling
  - Application pause/resume handling
- **Interface:**
  ```javascript
  export function createLifecycleCoordinator(config) {
    return {
      initializeApplication() { },
      startLevel(levelConfig) { },
      endLevel(result) { },
      handleIdleTime(offlineMs) { },
      scheduleAutosave() { },
      pauseApplication() { },
      resumeApplication() { }
    };
  }
  ```
- **Migration Strategy:**
  1. Create coordinator factory with configuration object
  2. Move initialization sequence (resource state, config loading)
  3. Move level lifecycle functions
  4. Move autosave and idle time logic
  5. Update `main.js` to delegate to lifecycle coordinator
  6. Test: Fresh load, level start, idle rewards, autosave
  7. Verify: Initialization time unchanged
- **Performance Considerations:**
  - Initialization should remain lazy (load on demand)
  - Autosave should not block UI (use `requestIdleCallback`)
  - Idle rewards should calculate incrementally (avoid long computations)

**Step 1.2.3: Extract Event Bus and Observer Pattern**
- **Target:** ~200 lines
- **New File:** `assets/orchestration/GameEvents.js`
- **Responsibilities:**
  - Centralized event emitter for cross-module communication
  - Event channels (`game:`, `ui:`, `tower:`, `powder:`)
  - Subscription management with automatic cleanup
  - Event logging for debugging
- **Interface:**
  ```javascript
  export function createEventBus() {
    return {
      emit(eventName, payload) { },
      on(eventName, handler) { }, // Returns unsubscribe function
      once(eventName, handler) { },
      off(eventName, handler) { },
      clear(eventName) { },
      getEventLog() { } // For debugging
    };
  }
  ```
- **Migration Strategy:**
  1. Create event bus implementation
  2. Identify callback-based communication in `main.js`
  3. Replace callbacks with event emissions
  4. Update modules to subscribe to events instead of receiving callbacks
  5. Test: Verify all inter-module communication works
  6. Verify: No performance degradation from event dispatch
- **Performance Considerations:**
  - Event dispatch should be O(n) in number of listeners
  - Avoid memory leaks by providing cleanup functions
  - Consider batching events that fire frequently (e.g., resource updates)

**Step 1.2.4: Consolidate State Module Pattern**
- **Target:** Document and standardize existing state modules
- **Existing Files:** (Already extracted per `main_refactor_contexts.md`)
  - `assets/state/resourceState.js`
  - `assets/state/spireResourceState.js`
  - `assets/powder/powderState.js`
  - `assets/alephUpgradeState.js`
- **Activities:**
  1. Audit all state modules for consistent API patterns
  2. Ensure all state modules export factory functions (not singletons)
  3. Document state module contract in `JAVASCRIPT_MODULE_SYSTEM.md`
  4. Add state serialization/deserialization helpers
  5. Create state snapshot function for save/load
- **Migration Strategy:**
  1. Review existing state modules
  2. Refactor any singleton patterns to factories
  3. Add serialization methods if missing
  4. Create unified state hydration function
  5. Test: Save/load game state, verify all state modules restore correctly
  6. Verify: Load time unchanged, save file size reasonable
- **Performance Considerations:**
  - State access should be fast (avoid getters that compute)
  - Serialization should be incremental (only changed state)
  - State snapshots should reuse objects where possible

**Step 1.2.5: Integration and Validation**
- **Activities:**
  1. Update `main.js` to compose routers and coordinators
  2. Verify `main.js` is now < 4,000 lines (~45% reduction)
  3. Run full application test: fresh load, level playthrough, save/load
  4. Performance validation:
     - Measure initialization time (target: < 3s to interactive)
     - Measure tab switch time (target: < 50ms)
     - Measure autosave time (target: < 100ms, non-blocking)
  5. Update `docs/main_refactor_contexts.md` with new modules
  6. Update `AGENTS.md` with event bus and lifecycle patterns

### Phase 2: High-Complexity Features (Priority: HIGH)

#### 2.1 `scripts/features/towers/cardinalWardenSimulation.js` (8,015 lines)

**Problem:** Cardinal Warden is a complex tower with multiple simulation modes (wave propagation, spread patterns, elemental effects, massive bullets). All logic lives in one massive file, making it hard to maintain, test, or extend.

**Current Responsibilities:**
- Grapheme mode configuration and selection
- Wave propagation physics simulation
- Spread pattern projectile generation
- Elemental effect application
- Massive bullet special ability
- UI rendering (grapheme symbols, animation states)
- State management (active modes, cooldowns, damage tracking)

**Refactoring Plan:**

**Step 2.1.1: Extract Grapheme Configuration**
- **Target:** ~200 lines
- **Status:** Partially done (Build 181 created `cardinalWardenConfig.js`)
- **Extend:** `scripts/features/towers/cardinalWardenConfig.js`
- **Additional Extraction:**
  - Move remaining mode switching logic
  - Extract UI copy and symbol mappings
  - Move cooldown and ability constants
- **Validation:**
  1. Verify grapheme switching works in-game
  2. Check all symbols display correctly
  3. Confirm cooldowns unchanged

**Step 2.1.2: Extract Wave Propagation Simulation**
- **Target:** ~1,500 lines
- **New File:** `scripts/features/towers/cardinalWarden/WavePropagationSimulation.js`
- **Responsibilities:**
  - Wave physics (velocity, acceleration, damping)
  - Wave-enemy collision detection
  - Damage calculation per wave hit
  - Wave lifecycle (spawn, update, despawn)
- **Interface:**
  ```javascript
  export function createWavePropagationSimulation(config) {
    return {
      createWave(origin, direction, params) { },
      updateWaves(deltaTime, enemies) { },
      getActiveWaves() { },
      clearWaves() { },
      calculateDamage(wave, enemy) { }
    };
  }
  ```
- **Migration Strategy:**
  1. Create simulation module with factory pattern
  2. Move wave physics constants and update logic
  3. Move collision detection for wave-enemy interactions
  4. Update `cardinalWardenSimulation.js` to delegate wave logic
  5. Test: Grapheme H (wave mode), verify damage and visuals
  6. Verify: No performance change during wave updates
- **Performance Considerations:**
  - Wave collision detection is O(waves × enemies) - keep efficient
  - Reuse wave objects where possible (object pooling)
  - Minimize Math.sqrt calls in distance calculations

**Step 2.1.3: Extract Spread Pattern System**
- **Target:** ~1,200 lines
- **New File:** `scripts/features/towers/cardinalWarden/SpreadPatternSimulation.js`
- **Responsibilities:**
  - Spread angle calculation
  - Projectile fan generation
  - Spread pattern damage distribution
  - Multi-hit tracking
- **Interface:**
  ```javascript
  export function createSpreadPatternSimulation(config) {
    return {
      createSpreadPattern(origin, targetAngle, spreadCount, params) { },
      updateSpreadProjectiles(deltaTime, enemies) { },
      getActiveProjectiles() { },
      clearProjectiles() { }
    };
  }
  ```
- **Migration Strategy:**
  1. Create spread simulation module
  2. Move spread angle calculation logic
  3. Move projectile generation for fan patterns
  4. Update `cardinalWardenSimulation.js` to use spread system
  5. Test: Grapheme I (spread mode), verify projectile patterns
  6. Verify: Frame time during spread fire remains acceptable
- **Performance Considerations:**
  - Spread patterns can create many projectiles (10-20 per shot)
  - Use efficient projectile pooling
  - Minimize allocations in spread generation

**Step 2.1.4: Extract Elemental Effects System**
- **Target:** ~800 lines
- **New File:** `scripts/features/towers/cardinalWarden/ElementalEffectsSimulation.js`
- **Responsibilities:**
  - Elemental damage type application
  - Status effect application (burn, freeze, shock)
  - Elemental interaction calculations
  - Effect duration tracking
- **Interface:**
  ```javascript
  export function createElementalEffectsSimulation(config) {
    return {
      applyElementalDamage(target, element, damage) { },
      updateEffects(deltaTime, enemies) { },
      getActiveEffects() { },
      clearEffects() { }
    };
  }
  ```
- **Migration Strategy:**
  1. Create elemental effects module
  2. Move element type definitions
  3. Move status effect logic
  4. Update `cardinalWardenSimulation.js` to apply effects via module
  5. Test: Grapheme K (elemental mode), verify status effects
  6. Verify: Status effect updates don't degrade performance
- **Performance Considerations:**
  - Status effects update every frame for all affected enemies
  - Batch effect updates where possible
  - Remove expired effects promptly to avoid iteration overhead

**Step 2.1.5: Extract Massive Bullet System**
- **Target:** ~600 lines
- **New File:** `scripts/features/towers/cardinalWarden/MassiveBulletSimulation.js`
- **Responsibilities:**
  - Massive bullet physics (slower, larger, piercing)
  - Multi-enemy impact detection
  - Splash damage calculation
  - Visual effect coordination (explosion, shockwave)
- **Interface:**
  ```javascript
  export function createMassiveBulletSimulation(config) {
    return {
      createMassiveBullet(origin, target, params) { },
      updateBullets(deltaTime, enemies) { },
      getActiveBullets() { },
      clearBullets() { }
    };
  }
  ```
- **Migration Strategy:**
  1. Create massive bullet module
  2. Move bullet physics and collision logic
  3. Move splash damage calculations
  4. Update `cardinalWardenSimulation.js` to use bullet system
  5. Test: Grapheme L (massive mode), verify piercing and splash
  6. Verify: Bullet update performance acceptable
- **Performance Considerations:**
  - Massive bullets check collision with multiple enemies
  - Use spatial partitioning if collision checks become bottleneck
  - Limit simultaneous massive bullets if needed

**Step 2.1.6: Reduce Core Simulation File**
- **Target:** Reduce to ~1,500 lines (80% reduction)
- **Remaining Responsibilities:**
  - Mode selection and coordination
  - UI state management (symbol selection, cooldowns)
  - Factory function for creating tower instance
  - Integration point for extracted subsystems
- **Activities:**
  1. Review remaining code after extractions
  2. Move any remaining pure functions to utilities
  3. Ensure core file only coordinates subsystems
  4. Update imports and dependencies
  5. Test: All grapheme modes, verify complete functionality
  6. Verify: No performance regressions across all modes
- **Final Validation:**
  1. Test each grapheme mode individually
  2. Test mode switching during gameplay
  3. Measure CPU usage during intense combat
  4. Verify memory usage stable across mode switches
  5. Update `scripts/features/towers/agent.md` with new structure

#### 2.2 `assets/playfield/render/CanvasRenderer.js` (3,987 lines)

**Problem:** CanvasRenderer handles all rendering: backgrounds, towers, projectiles, enemies, effects, UI overlays. Drawing logic for different systems is intermingled, making it hard to optimize individual rendering paths.

**Current Responsibilities:**
- Background rendering (grid, color gradients)
- Tower sprite rendering (all tower types)
- Projectile rendering (all projectile types)
- Enemy rendering (all enemy types)
- Visual effects (particles, explosions, shields)
- UI overlay rendering (damage numbers, cost scribbles)
- Canvas state management (transforms, clipping)

**Refactoring Plan:**

**Step 2.2.1: Extract Background Renderer**
- **Target:** ~300 lines
- **New File:** `assets/playfield/render/layers/BackgroundRenderer.js`
- **Responsibilities:**
  - Grid pattern rendering
  - Color gradient backgrounds
  - Consciousness realm effects
  - Static background elements
- **Interface:**
  ```javascript
  export function createBackgroundRenderer(canvas) {
    return {
      renderBackground(ctx, playfieldState, colorScheme) { },
      renderGrid(ctx, dimensions, style) { },
      renderGradient(ctx, colors) { }
    };
  }
  ```
- **Migration Strategy:**
  1. Create background renderer module
  2. Move grid rendering functions
  3. Move background gradient logic
  4. Update `CanvasRenderer` to delegate background rendering
  5. Test: Verify backgrounds render identically
  6. Verify: Background render time unchanged
- **Performance Considerations:**
  - Background renders once per frame (not expensive)
  - Cache gradient patterns if possible
  - Consider rendering to offscreen canvas if background is static

**Step 2.2.2: Extract Tower Sprite Renderer**
- **Target:** ~800 lines
- **New File:** `assets/playfield/render/layers/TowerSpriteRenderer.js`
- **Responsibilities:**
  - Tower sprite positioning and rotation
  - Tower glyph symbol rendering
  - Tower upgrade visual indicators
  - Tower sprite animation (idle, firing)
- **Interface:**
  ```javascript
  export function createTowerSpriteRenderer() {
    return {
      renderTower(ctx, tower, slot, sprites) { },
      renderTowerGlyph(ctx, position, glyph, state) { },
      renderUpgradeIndicator(ctx, position, upgrade) { }
    };
  }
  ```
- **Migration Strategy:**
  1. Create tower sprite renderer
  2. Move tower drawing functions
  3. Move glyph rendering logic
  4. Update `CanvasRenderer` to use tower renderer
  5. Test: Place all tower types, verify sprites render correctly
  6. Verify: Tower render time unchanged (critical for performance)
- **Performance Considerations:**
  - Tower rendering happens every frame for every tower
  - Minimize canvas state changes (save/restore)
  - Batch towers by sprite type if possible
  - Cache rotated sprites if performance critical

**Step 2.2.3: Extract Projectile Renderer**
- **Target:** ~600 lines
- **New File:** `assets/playfield/render/layers/ProjectileRenderer.js`
- **Responsibilities:**
  - Standard projectile rendering (circles, sprites)
  - Projectile trails and effects
  - Special projectile types (stars, triangles, waves)
  - Projectile animation states
- **Interface:**
  ```javascript
  export function createProjectileRenderer() {
    return {
      renderProjectile(ctx, projectile, sprites) { },
      renderProjectileTrail(ctx, trail) { },
      renderSpecialProjectile(ctx, projectile, type) { }
    };
  }
  ```
- **Migration Strategy:**
  1. Create projectile renderer module
  2. Move projectile drawing functions
  3. Move trail rendering logic
  4. Update `CanvasRenderer` to use projectile renderer
  5. Test: Fire all tower types, verify projectiles render correctly
  6. Verify: Projectile render time acceptable (may have 100+ on screen)
- **Performance Considerations:**
  - Projectile rendering is the most frequent operation
  - This is the hottest code path in the renderer
  - Minimize allocations and function calls
  - Consider instancing for identical projectiles
  - Profile carefully after extraction

**Step 2.2.4: Extract Effect Renderer**
- **Target:** ~500 lines
- **New File:** `assets/playfield/render/layers/EffectRenderer.js`
- **Responsibilities:**
  - Particle effects (explosions, sparkles)
  - Shield and aura rendering
  - Special ability effects (derivative shields, gamma bursts)
  - Temporary visual effects
- **Interface:**
  ```javascript
  export function createEffectRenderer() {
    return {
      renderParticles(ctx, particles) { },
      renderShield(ctx, position, params) { },
      renderExplosion(ctx, position, progress) { },
      renderSpecialEffect(ctx, effect) { }
    };
  }
  ```
- **Migration Strategy:**
  1. Create effect renderer module
  2. Move particle rendering functions
  3. Move shield and aura logic
  4. Update `CanvasRenderer` to use effect renderer
  5. Test: Trigger all special abilities, verify effects render
  6. Verify: Effect render time acceptable
- **Performance Considerations:**
  - Particle effects can have 100+ particles
  - Use alpha blending efficiently (fewer layer switches)
  - Cull off-screen particles before rendering
  - Consider particle pooling if not already implemented

**Step 2.2.5: Extract UI Overlay Renderer**
- **Target:** ~400 lines
- **New File:** `assets/playfield/render/layers/UIOverlayRenderer.js`
- **Responsibilities:**
  - Damage number rendering
  - Cost scribbles (red text for invalid placements)
  - Floating feedback messages
  - Tower selection UI
- **Interface:**
  ```javascript
  export function createUIOverlayRenderer() {
    return {
      renderDamageNumbers(ctx, numbers) { },
      renderCostScribble(ctx, position, text) { },
      renderFloatingFeedback(ctx, messages) { },
      renderSelectionUI(ctx, selection) { }
    };
  }
  ```
- **Migration Strategy:**
  1. Create UI overlay renderer
  2. Move damage number rendering
  3. Move cost scribble logic
  4. Update `CanvasRenderer` to use UI renderer
  5. Test: Trigger damage numbers and cost scribbles
  6. Verify: UI overlay rendering correct
- **Performance Considerations:**
  - UI overlays render on top (last in render order)
  - Text rendering can be expensive (use measureText sparingly)
  - Cache font metrics where possible

**Step 2.2.6: Refactor Core Renderer to Coordinator**
- **Target:** Reduce to ~1,000 lines (75% reduction)
- **Remaining Responsibilities:**
  - Canvas setup and resize handling
  - Render order coordination
  - Canvas state management (save/restore stack)
  - Performance monitoring
  - Layer composition
- **Activities:**
  1. Create layer registry for render order
  2. Implement layer rendering loop
  3. Move all drawing logic to layer renderers
  4. Keep only coordination logic in core renderer
  5. Test: Full gameplay with all visual elements
  6. Verify: Frame rate unchanged (critical!)
- **Final Validation:**
  1. Measure render time per layer
  2. Profile hottest rendering paths
  3. Verify no performance regression
  4. Update rendering optimization memories
  5. Document rendering architecture in `assets/playfield/agent.md`

### Phase 3: Tower Logic Consolidation (Priority: MEDIUM)

#### 3.1 Tower Simulation Files (3,000+ lines each)

**Problem:** Several tower files (`tsadiTower.js`, `lamedTower.js`, `powderTower.js`) contain tower-specific logic, data tables, UI copy, and rendering in single files. Common patterns aren't shared across towers.

**Affected Files:**
- `scripts/features/towers/tsadiTower.js` (3,391 lines)
- `scripts/features/towers/lamedTower.js` (2,924 lines)
- `scripts/features/towers/powderTower.js` (2,342 lines)

**Refactoring Strategy:**

**Step 3.1.1: Extract Data Tables (All Towers)**
- **Pattern:** For each large tower file:
  1. Create `<TowerName>Data.js` companion file
  2. Move static configuration (upgrade trees, tier sequences, damage tables)
  3. Move UI strings (upgrade descriptions, ability names)
  4. Export as frozen objects or functions that return configurations
- **Example (Tsadi Tower):**
  ```javascript
  // tsadiTowerData.js
  export const TSADI_TIER_SEQUENCE = Object.freeze([...]);
  export const TSADI_WAVE_CONSTANTS = Object.freeze({...});
  export const TSADI_MOLECULE_RECIPES = Object.freeze({...});
  export const TSADI_UPGRADE_DESCRIPTIONS = Object.freeze({...});
  ```
- **Progress:** Build 181 created `tsadiTowerData.js` (82 lines extracted)
- **Next Steps:**
  - Create `lamedTowerData.js` (extract ~300 lines)
  - Create `powderTowerData.js` (extract ~250 lines)
  - Verify all towers function identically after extraction

**Step 3.1.2: Extract Tower Behavior Patterns**
- **New File:** `scripts/features/towers/shared/TowerBehaviorPatterns.js`
- **Responsibilities:**
  - Common targeting algorithms (nearest, furthest, strongest)
  - Shared damage calculation patterns
  - Common projectile spawning logic
  - Upgrade formula patterns
- **Migration Strategy:**
  1. Identify common patterns across 3+ towers
  2. Extract into shared utility functions
  3. Update towers to use shared functions
  4. Verify behavior unchanged per tower
  5. Test: Place all tower types, verify targeting

**Step 3.1.3: Extract Tower Rendering Helpers**
- **New File:** `scripts/features/towers/shared/TowerRenderHelpers.js`
- **Responsibilities:**
  - Sprite loading and caching
  - Common glyph rendering utilities
  - Upgrade indicator patterns
  - Animation state helpers
- **Migration Strategy:**
  1. Identify rendering logic duplicated across towers
  2. Extract into helper functions
  3. Update towers to use shared helpers
  4. Verify visual output unchanged
  5. Test: Visual inspection of all towers

**Step 3.1.4: Standardize Tower Module Structure**
- **Pattern:** All tower files should follow consistent structure:
  ```
  // 1. Imports
  // 2. Constants (short, module-specific only)
  // 3. Helper functions (private to this tower)
  // 4. Main tower factory function
  // 5. Targeting logic
  // 6. Ability logic
  // 7. Update function
  // 8. Export
  ```
- **Activities:**
  1. Document standard tower structure in `scripts/features/towers/agent.md`
  2. Refactor one tower to match pattern (template)
  3. Gradually align other towers with template
  4. Create tower creation guide for new towers

### Phase 4: Rendering and UI Systems (Priority: MEDIUM-LOW)

#### 4.1 Spire Rendering Files

**Affected Files:**
- `assets/betSpireRender.js` (2,677 lines)
- `assets/kufSimulation.js` (3,047 lines)

**Refactoring Strategy:**

**Step 4.1.1: Extract Bet Spire Particle Systems**
- **Target:** ~800 lines from `betSpireRender.js`
- **New File:** `assets/spires/bet/BetSpireParticles.js`
- **Responsibilities:** Particle effects specific to Bet spire
- **Validation:** Visual inspection of Bet spire effects

**Step 4.1.2: Extract Kuf Simulation Physics**
- **Target:** ~1,000 lines from `kufSimulation.js`
- **New File:** `assets/spires/kuf/KufPhysicsSimulation.js`
- **Responsibilities:** Physics calculations for Kuf spire
- **Validation:** Verify Kuf spire behavior unchanged

#### 4.2 Powder System Files

**Affected Files:**
- `assets/fluidTerrariumTrees.js` (2,945 lines)
- `assets/fluidTerrariumShrooms.js` (1,092 lines)

**Refactoring Strategy:**

**Step 4.1.1: Extract Tree Growth Simulation**
- **Target:** ~1,200 lines from `fluidTerrariumTrees.js`
- **New File:** `assets/powder/simulations/TreeGrowthSimulation.js`

**Step 4.1.2: Extract Mushroom Simulation**
- **Target:** ~500 lines from `fluidTerrariumShrooms.js`
- **New File:** `assets/powder/simulations/MushroomSimulation.js`

#### 4.3 Tower Equation Display

**Affected Files:**
- `assets/towerEquations/advancedTowers.js` (2,435 lines)
- `assets/towerEquations/greekTowers.js` (1,647 lines)

**Refactoring Strategy:**

**Step 4.3.1: Split by Tower Type**
- **Pattern:** One file per tower equation
- **New Files:**
  - `assets/towerEquations/advanced/AlephEquation.js`
  - `assets/towerEquations/advanced/BetEquation.js`
  - (etc. for each tower)
- **Keep:** Index file that re-exports all equations

### Phase 5: Stylesheet Refactoring (Priority: LOW but HIGH IMPACT)

#### 5.1 `assets/styles.css` (~12,737 lines)

**Problem:** Single monolithic stylesheet makes it difficult to modify individual UI components without risk of cascade side effects. Theme variants are scattered throughout the file.

**Refactoring Plan:**

**Step 5.1.1: Create Layer Structure**
- **New Files:**
  - `assets/styles/base.css` - CSS custom properties, resets, typography
  - `assets/styles/themes.css` - Color scheme variants
  - `assets/styles/utilities.css` - Utility classes
  - `assets/styles/components/` - Component-specific styles
- **Use CSS `@layer` directive:**
  ```css
  /* base.css */
  @layer base {
    /* Reset styles */
  }
  
  /* Import order establishes cascade */
  @import url('./themes.css') layer(theme);
  @import url('./utilities.css') layer(utilities);
  @import url('./components/overlays.css') layer(components);
  ```

**Step 5.1.2: Extract Component Styles**
- **Component Files:**
  - `overlays.css` - Modal and overlay styles
  - `hud.css` - Resource display and HUD elements
  - `playfield.css` - Game canvas and playfield UI
  - `towers-tab.css` - Tower selection and upgrade UI
  - `powder-tab.css` - Powder system UI
  - `codex.css` - Codex overlay styles
  - `level-paths.css` - Level selection UI
  - `developer-tools.css` - Developer mode UI

**Step 5.1.3: Validation Strategy**
- **Before Changes:**
  1. Take screenshots of every UI state
  2. Document computed styles for key elements
  3. Record cascade specificity of critical selectors
- **After Each Extraction:**
  1. Visual diff against screenshots
  2. Verify computed styles unchanged
  3. Test all theme variants
  4. Test all cursor modes
  5. Test all responsive breakpoints
- **Critical Validations:**
  - Main menu appearance
  - Playfield layout (portrait and landscape)
  - All overlays (position, size, backdrop)
  - Tower selection UI
  - Powder basin and tab layout
  - Codex scrolling and layout
  - Developer tools appearance

## Testing Strategy

### Automated Validation (Where Possible)

#### Performance Benchmarks
```javascript
// Example benchmark structure
const benchmarks = {
  'playfield-rendering': {
    setup: () => loadLevelWithMaxEnemies(),
    test: () => measureFrameTime(60), // 60 frames
    target: { p95: 16.67 } // 60 FPS
  },
  'tower-targeting': {
    setup: () => spawnTenTowersWithTwentyEnemies(),
    test: () => measureTargetingUpdateTime(),
    target: { average: 2.0 } // 2ms per frame
  },
  'autosave': {
    setup: () => playFor30Minutes(),
    test: () => measureSaveTime(),
    target: { average: 100 } // 100ms max
  }
};
```

#### Regression Test Suite
```javascript
// Functional regression checks
const regressionTests = [
  'tower-placement-all-types',
  'tower-upgrade-all-paths',
  'enemy-spawning-all-types',
  'level-victory-conditions',
  'level-defeat-conditions',
  'save-load-full-state',
  'offline-rewards-calculation',
  'spire-unlock-progression',
  'powder-system-interactions',
  'developer-mode-tools'
];
```

### Manual Testing Checklist

For each major refactoring phase, complete this checklist:

#### Gameplay Core
- [ ] Load a saved game successfully
- [ ] Start a new game (fresh state)
- [ ] Place all tower types
- [ ] Upgrade towers through all paths
- [ ] Complete a level successfully
- [ ] Fail a level (let enemies through)
- [ ] Collect idle rewards after offline time
- [ ] Verify autosave creates valid save file
- [ ] Switch between all tabs
- [ ] Open and close all overlays

#### Visual Verification
- [ ] All tower sprites render correctly
- [ ] All projectiles render correctly
- [ ] All enemies render correctly
- [ ] Damage numbers appear and fade
- [ ] Cost scribbles show on invalid placement
- [ ] Tower upgrade effects visual correct
- [ ] Particle effects render without artifacts
- [ ] UI overlays positioned correctly
- [ ] All theme variants work (Codex color schemes)
- [ ] Responsive layout works (portrait/landscape)

#### Performance Validation
- [ ] 60 FPS during light combat (5 towers, 10 enemies)
- [ ] 60 FPS during heavy combat (10 towers, 30 enemies)
- [ ] Page load time < 3 seconds (3G network)
- [ ] Tab switches feel instant (< 50ms)
- [ ] Tower placement responsive (< 100ms touch to visual)
- [ ] Memory usage stable over 30 minutes
- [ ] No memory leaks (check with heap profiler)
- [ ] Autosave doesn't cause frame drops

#### Edge Cases
- [ ] Rapid tab switching doesn't break UI
- [ ] Placing towers quickly doesn't cause errors
- [ ] Upgrading tower during projectile flight works
- [ ] Selling tower during ability execution safe
- [ ] Opening overlay during animation smooth
- [ ] Resize window during gameplay stable
- [ ] Rotate device during gameplay (mobile) stable
- [ ] Developer mode toggle doesn't crash

## Risk Mitigation

### High-Risk Operations

#### Risk: Breaking Combat Logic
- **Impact:** Game becomes unplayable
- **Likelihood:** Medium (combat state is complex)
- **Mitigation:**
  - Extract combat logic last within playfield refactor
  - Maintain comprehensive combat state tests
  - Keep targeting logic in individual tower modules
  - Validate every enemy type after changes

#### Risk: Performance Regression
- **Impact:** Game becomes unplayable on mobile
- **Likelihood:** Medium-High (rendering is performance-critical)
- **Mitigation:**
  - Measure performance before and after every change
  - Profile hot paths after extraction
  - Keep render loop optimizations (existing constants like TWO_PI, HALF)
  - Avoid adding abstraction layers in critical paths
  - Use worker thread pattern if complex calculations needed

#### Risk: Save File Corruption
- **Impact:** Players lose progress
- **Likelihood:** Low-Medium (state refactoring affects serialization)
- **Mitigation:**
  - Test save/load after every state module change
  - Maintain backward compatibility with old save format
  - Add save file validation on load
  - Keep versioning in save files
  - Backup saves before migration

#### Risk: Visual Regressions
- **Impact:** UI appears broken or inaccessible
- **Likelihood:** High (many UI elements)
- **Mitigation:**
  - Screenshot comparison before/after changes
  - Test all theme variants
  - Test all responsive breakpoints
  - Validate ARIA attributes and focus management
  - Keep stylesheet specificity identical during CSS refactor

### Rollback Strategy

If a refactoring causes critical issues:

1. **Immediate Actions:**
   - Revert the commit(s) that introduced the issue
   - Notify team of rollback
   - Document issue in rollback commit message

2. **Investigation:**
   - Identify root cause of failure
   - Document why the refactoring approach failed
   - Update refactoring plan with lessons learned

3. **Retry:**
   - Create a more incremental approach
   - Add additional validation steps
   - Consider alternative refactoring strategy
   - Update this document with new approach

## Progress Tracking

### Refactoring Metrics

Track these metrics to measure progress:

| Metric | Current (Build 464) | Phase 1 Target | Phase 2 Target | Phase 3 Target | Final Target |
|--------|---------|----------------|----------------|----------------|--------------|
| Largest file size | 10,248 lines | 8,000 lines | 5,000 lines | 3,000 lines | < 2,000 lines |
| Files > 3,000 lines | 5 files | 3 files | 1 file | 0 files | 0 files |
| Average file size | ~800 lines | ~600 lines | ~400 lines | ~300 lines | < 250 lines |
| Module count | ~130 modules | ~140 modules | ~160 modules | ~180 modules | ~200 modules |
| Test coverage | TBD | TBD | TBD | TBD | > 70% |

**Progress Notes (Build 464):**
- Playfield.js at 10,248 lines (155 line reduction from background swimmer system extraction)
- CombatStateManager.js created: 587 lines (Build 444-446)
- TowerOrchestrationController.js created: 852 lines (Build 448-449)
- RenderCoordinator.js created: 123 lines (Build 450, cleaned up Build 453)
- DeveloperToolsService.js created: 560 lines (Build 457)
- WaveUIFormatter.js created: 375 lines (Build 459)
- GestureController.js created: 288 lines (Build 460)
- FloaterSystem.js created: 174 lines (Build 461)
- LevelLifecycleManager.js created: 462 lines (Build 463)
- BackgroundSwimmerSystem.js created: 197 lines (Build 464)
- Total extracted: 3,618 lines across nine modules
- Extracted combat state, tower orchestration, render loop, developer tools, wave UI formatting, gesture handling, floater particles, level lifecycle, and background swimmers
- Maintained backward compatibility through delegation pattern
- Background swimmer physics now isolated in dedicated system module
- **Progress to Phase 1 target:** 78.1% (2,248 lines remaining)

### Milestone Tracking

Update this section as refactoring progresses:

#### Phase 1: Critical Infrastructure
- [x] Playfield Combat State Manager extracted (Build 444-446)
- [x] Playfield Tower Orchestration Controller extracted (Build 448-449)
- [x] Playfield Rendering Coordinator extracted (Build 450)
- [x] Playfield Developer Tools Service extracted (Build 457)
- [x] Playfield Wave UI Formatter extracted (Build 459)
- [x] Playfield Gesture Controller extracted (Build 460)
- [x] Playfield Floater System extracted (Build 461)
- [x] Playfield Level Lifecycle Manager extracted (Build 463)
- [x] Playfield Background Swimmer System extracted (Build 464)
- [ ] Playfield Input Controller enhanced
- [ ] Main.js Navigation Router extracted
- [ ] Main.js Lifecycle Coordinator extracted
- [ ] Main.js Event Bus implemented
- [ ] State module pattern documented

#### Phase 2: High-Complexity Features
- [ ] Cardinal Warden Wave Propagation extracted
- [ ] Cardinal Warden Spread Pattern extracted
- [ ] Cardinal Warden Elemental Effects extracted
- [ ] Cardinal Warden Massive Bullet extracted
- [ ] Canvas Background Renderer extracted
- [ ] Canvas Tower Sprite Renderer extracted
- [ ] Canvas Projectile Renderer extracted
- [ ] Canvas Effect Renderer extracted
- [ ] Canvas UI Overlay Renderer extracted

#### Phase 3: Tower Logic Consolidation
- [ ] All tower data tables extracted
- [ ] Tower behavior patterns shared library created
- [ ] Tower rendering helpers shared library created
- [ ] Tower module structure standardized

#### Phase 4: Rendering and UI Systems
- [ ] Bet Spire particle systems extracted
- [ ] Kuf simulation physics extracted
- [ ] Tree growth simulation extracted
- [ ] Mushroom simulation extracted
- [ ] Tower equations split by tower type

#### Phase 5: Stylesheet Refactoring
- [ ] CSS layer structure created
- [ ] Base styles extracted
- [ ] Theme styles extracted
- [ ] Utility styles extracted
- [ ] Component styles extracted (all components)
- [ ] Visual regression testing complete

## Documentation Requirements

### Before Starting Each Phase

1. **Update `docs/REFACTORING_GUIDE.md`:**
   - Add current file size metrics
   - Document planned extractions
   - Note any architectural changes

2. **Update Relevant `agent.md` Files:**
   - Document new module boundaries
   - Update import path examples
   - Add integration patterns

3. **Review Architectural Docs:**
   - Check consistency with `JAVASCRIPT_MODULE_SYSTEM.md`
   - Verify alignment with `AGENTS.md` vision
   - Update `PLATFORM_SUPPORT.md` if needed

### After Completing Each Phase

1. **Update Progress Tracking:**
   - Mark completed milestones
   - Update file size metrics
   - Record any deviations from plan

2. **Document Lessons Learned:**
   - What worked well?
   - What was more difficult than expected?
   - What would you do differently?

3. **Update Integration Guides:**
   - Document new APIs and interfaces
   - Update example usage patterns
   - Add common pitfalls section

## Continuous Integration Considerations

### Future CI Pipeline (When Implemented)

When the project adds automated testing:

1. **Pre-Refactor Baseline:**
   - Record performance benchmarks
   - Run full test suite (if exists)
   - Generate code coverage report

2. **During Refactor:**
   - Run tests on every commit
   - Block merge if performance degrades > 10%
   - Require manual approval for visual changes

3. **Post-Refactor Validation:**
   - Compare performance to baseline
   - Verify test coverage unchanged or improved
   - Run extended integration test suite

## Completed Extractions

### Phase 1.1.1: Combat State Manager (Build 444-446)

**Status:** ✅ Complete

**Extracted File:** `assets/playfield/managers/CombatStateManager.js` (~600 lines)

**Responsibilities Extracted:**
- Wave progression state (waveIndex, waveTimer, currentWaveNumber, etc.)
- Enemy lifecycle management (spawning, updating, death handling)
- Victory/defeat condition checking
- Resource tracking (energy, lives)
- Endless mode support (cycle multipliers, speed scaling)

**Integration Pattern:**
- Factory function with dependency injection
- Property delegation via getters/setters for backward compatibility
- Callback-based notifications for cross-system events

**Key Learnings:**
- No-op setters prevent "property has only a getter" errors
- Manager should own state, playfield delegates access
- Performance remains unchanged when delegation is lightweight

### Phase 1.1.4: Developer Tools Service (Build 457)

**Status:** ✅ Complete

**Extracted File:** `assets/playfield/services/DeveloperToolsService.js` (~560 lines)

**Responsibilities Extracted:**
- Developer crystal management (spawning, damage, fractures, shards)
- Developer tower placement and removal
- Crystal focus tracking for tower targeting
- All developer-only testing functionality

**Consolidation:**
- Unified `DeveloperCrystalManager.js` (381 lines) + `DeveloperTowerManager.js` (125 lines)
- Removed Object.assign mixin pattern
- Encapsulated state within service (crystals, shards, counters, focusedCrystalId)

**Integration Pattern:**
- Factory function: `createDeveloperToolsService(playfield)`
- Internal state encapsulation with accessor getters
- Property delegation (110 methods/getters) maintains backward compatibility
- Service initialized in `enterLevel()` after tower orchestration controller

**Performance Considerations:**
- Service creation gated behind level initialization (lazy instantiation)
- Crystal update loop remains identical (no performance impact)
- Delegation methods are inline (minimal overhead)

**Key Learnings:**
- Delegation pattern increases line count but improves maintainability
- Consolidating related managers reduces conceptual overhead
- Service pattern isolates developer-only code for potential tree-shaking
- Property getters provide clean backward compatibility

---

### Phase 1.1.5: Wave UI Formatter (Build 459)

**Status:** ✅ Complete

**Extracted File:** `assets/playfield/ui/WaveUIFormatter.js` (375 lines)

**Responsibilities Extracted:**
- Wave entry formatting for UI display (`buildWaveEntries`)
- Wave group normalization and resolution
- Enemy health exponent calculations for scientific notation
- Enemy speed and HP formatting
- Enemy symbol resolution (polygon shapes, codex symbols)
- Metadata formatting for wave dialogs

**Consolidation:**
- 7 methods extracted from playfield.js
- Total code reduction: 254 lines in playfield.js
- Methods: `buildWaveEntries`, `resolveWaveGroups`, `calculateHealthExponent`, `formatEnemyExponentLabel`, `formatEnemySpeed`, `resolveEnemySymbol`, `resolvePolygonSymbol`

**Integration Pattern:**
- Factory function: `createWaveUIFormatter(config)`
- State accessors passed via config: `currentWaveNumber`, `waveIndex`, `theroSymbol`
- Delegation methods in playfield.js maintain backward compatibility
- Clean separation: UI formatting logic isolated from game logic

**Dependencies:**
- External: `getEnemyCodexEntry` (codex.js), `formatCombatNumber` (formatting utils)
- Internal: State accessors for wave/thero info
- Zero coupling to combat or tower systems

**Performance Considerations:**
- Formatting operations are lightweight (no game loop impact)
- Factory instantiation once per level entry
- Methods pure/stateless where possible
- No memory leaks or performance regressions

**Key Learnings:**
- Low-coupling methods are ideal extraction candidates
- UI formatting logic cleanly separates from game logic
- Factory pattern with state accessors provides clean dependency injection
- Delegation wrappers maintain API compatibility with minimal overhead
- 254-line reduction demonstrates value of targeted extractions

### Phase 1.1.6: Gesture Controller (Build 460)

**Status:** ✅ Complete

**Extracted File:** `assets/playfield/input/GestureController.js` (288 lines)

**Responsibilities Extracted:**
- Tower hold gesture detection and tracking (`updateTowerHoldGesture`, `cancelTowerHoldGesture`)
- Double-tap gesture recognition (`registerTowerTap`, `toggleTowerMenuFromTap`)
- Tower press glow animations (`handleTowerPointerPress`, `handleTowerPointerRelease`)
- Monotonic timestamp utility (`getCurrentTimestamp`)
- Tower tap state management (`resetTowerTapState`)
- Gesture timing constants (hold activation, cancel distance, double-tap thresholds)

**Consolidation:**
- 8 methods extracted from playfield.js
- Total code reduction: 251 lines in playfield.js (net after Object.assign additions)
- Constants extracted: `TOWER_HOLD_ACTIVATION_MS`, `TOWER_HOLD_CANCEL_DISTANCE_PX`, `TOWER_MENU_DOUBLE_TAP_INTERVAL_MS`, `TOWER_MENU_DOUBLE_TAP_DISTANCE_PX`

**Integration Pattern:**
- Object.assign delegation to SimplePlayfield.prototype
- Methods maintain `this` context via call-site binding
- All gesture methods exported as standalone functions
- Constants exported for external reference (e.g., hold activation timeout)

**Dependencies:**
- Internal: playfield methods (`getTowerById`, `commitTowerHoldUpgrade`, `commitTowerHoldDemotion`, `closeTowerSelectionWheel`, `openTowerMenu`, `closeTowerMenu`)
- Internal: playfield state (`towerHoldState`, `towerTapState`, `towerPressHighlights`, `activeTowerMenu`)
- Zero external dependencies beyond playfield context

**Performance Considerations:**
- Methods called in pointer event handlers (high frequency during interaction)
- Zero memory allocations in hot paths
- Timestamp calculations use performance.now() when available
- Gesture state reuses objects rather than creating new ones

**Key Learnings:**
- Gesture detection logic is self-contained and easily extractable
- Object.assign pattern works well for `this`-context dependent methods
- Exporting constants improves discoverability and reduces magic numbers
- 251-line reduction brings playfield.js to 10,949 lines (73.1% to Phase 1 target)
- Gesture module provides foundation for future input enhancements


**Integration Approach:**
- Factory function pattern with dependency injection
- Property getters/setters for transparent delegation
- Backward-compatible no-op setters for legacy assignments
- Clean API: `startCombat()`, `spawnEnemies()`, `updateEnemies()`, `handleEnemyDeath()`, etc.

**Impact:**
- Playfield.js complexity reduced
- Combat state logic testable in isolation
- Clear separation between state management and presentation
- Zero functionality changes or regressions

**Lessons Learned:**
1. Property getters need corresponding setters even if no-ops for backward compatibility
2. Factory pattern with DI cleanly separates concerns without breaking existing code
3. Manager pattern works well for stateful subsystems
4. Thorough property access analysis critical to avoid runtime errors

---

### Phase 1.1.2: Tower Orchestration Controller (Build 448-449)

**Status:** ✅ Complete

**Extracted File:** `assets/playfield/controllers/TowerOrchestrationController.js` (852 lines)

**Responsibilities Extracted:**
- Tower placement and slot selection handling
- Tower upgrade/downgrade/tier change logic
- Tower removal and energy refund calculations
- Connection management between towers (e.g., zeta links, gamma chains)
- Tower menu state coordination

**Integration Approach:**
- Factory function pattern with dependency injection
- Property getters/setters for transparent delegation (towers, slots, etc.)
- Complex cost calculation logic preserved (demotion refund/charge)
- Clean API: `placeTower()`, `upgradeTower()`, `demoteTowerTier()`, `removeTower()`, etc.

**Impact:**
- Tower lifecycle logic isolated from main playfield orchestration
- Complex upgrade economics maintainable in dedicated module
- Clear separation between tower state and combat state
- Zero functionality changes or regressions

**Lessons Learned:**
1. Two-phase cost calculations (refund + charge) need careful validation
2. Property delegation pattern scales well to multiple extractors
3. Connection management between towers requires explicit state sharing
4. Backward compatibility maintained through getter/setter wrappers

---

### Phase 1.1.3: Render Coordinator (Build 450)

**Status:** ✅ Complete

**Extracted File:** `assets/playfield/render/RenderCoordinator.js` (132 lines)

**Responsibilities Extracted:**
- Animation frame scheduling (`requestAnimationFrame` management)
- Frame timing calculations (delta time, safeDelta capping)
- Frame rate limiting based on user preferences
- Performance monitoring integration (frame markers)
- FPS counter updates

**Integration Approach:**
- Factory function with callback configuration
- Configured with `update()`, `draw()`, and `shouldAnimate()` functions
- Simple delegation: `ensureLoop()` → `startRenderLoop()`, `stopLoop()` → `stopRenderLoop()`
- API: `startRenderLoop()`, `stopRenderLoop()`, `isRunning()`

**Impact:**
- Render loop logic testable in isolation
- Frame timing calculations centralized
- Clear separation between game logic and render scheduling
- Zero performance overhead (maintains existing patterns)

**Lessons Learned:**
1. Render loop extraction is straightforward with callback pattern
2. Performance monitoring integration must be preserved exactly
3. Delta capping (0.12s) critical for stability during tab backgrounding
4. Simple wrapper methods maintain backward compatibility with zero cost

---

## Conclusion

This refactoring plan provides a comprehensive, incremental approach to breaking down monolithic files in Thero Idle TD. By following the phased strategy, validating at each step, and maintaining strict performance requirements, we can improve code maintainability without degrading the player experience.

**Key Success Factors:**
1. **Incremental changes** - Small, testable modifications
2. **Comprehensive validation** - Test after every change
3. **Performance vigilance** - Measure and maintain performance
4. **Clear boundaries** - Each module has single responsibility
5. **Documentation-first** - Update docs before and after changes

**Next Steps:**
1. Review and approve this plan
2. Establish performance baseline measurements
3. Begin Phase 1: Critical Infrastructure refactoring
4. Update progress tracking regularly
5. Adjust plan based on lessons learned

---

**Document Version:** 1.5  
**Created:** Build 443  
**Last Updated:** Build 461  
**Status:** Phase 1 In Progress (7/9 playfield milestones complete, 74.7% to target)
