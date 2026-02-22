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
- **Status:** Not extractable as a standalone module - spread pattern (grapheme I) is a modifier applied in the bullet-spawning loop (`spreadBulletCount` controls how many bullets are spawned in a fan; the projectiles themselves are standard `Bullet` objects shared with all other modes). Address in Step 2.1.6 as part of core simulation refactoring.

**Step 2.1.4: Extract Elemental Effects System**
- **Status:** Not extractable as a standalone module - elemental effects (grapheme J) are properties (`burning`, `burnParticles`, `frozenDuration`) stored directly on individual `EnemyShip` instances and updated inside those classes' own `update()` methods. Extracting them would require decoupling the enemy update cycle. Address in Step 2.1.6 or as part of enemy class refactoring.

**Step 2.1.5: Extract Massive Bullet System**
- **Status:** Not extractable as a standalone module - massive bullet (grapheme K) is a modifier applied in the bullet-spawning loop (`massiveBulletMode` flag scales damage/size/speed). Address in Step 2.1.6 as part of core simulation refactoring.

**Step 2.1.5b: Extract Swarm System**
- **Status:** Complete (Build 475-476)
- **New File:** `scripts/features/towers/cardinalWarden/SwarmSystem.js` (304 lines)
- **Extracted:** `SwarmShip` class, `SwarmLaser` class, `checkSwarmLaserCollisions()`, `renderSwarmShips()`, `renderSwarmLasers()`
- **Reduction:** cardinalWardenSimulation.js reduced from 7,583 to 7,348 lines (−235 lines)

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

### Phase 2.2.1: Canvas Background Renderer (Build 486)

**Status:** ✅ Complete

**Extracted File:** `assets/playfield/render/layers/BackgroundRenderer.js` (381 lines)

**Responsibilities Extracted:**
- `drawCrystallineMosaic()` — renders the crystalline mosaic edge decorations (first background layer)
- `drawFloaters()` — renders the floater lattice (faint circles + connection lines) and background swimmers
- `drawSketches()` — renders level sketch overlays with 20% opacity (randomised per level)
- `drawSketchLayerCache()` — paints the offscreen sketch cache onto the main canvas; returns `true` if cache was used
- `drawSketchesOnContext()` — rasterizes sketch placements onto any canvas context (used by cache builder)
- `generateLevelSketches()` — deterministic seeded placement generator for level sketch sprites
- `getSketchLayerCacheKey()` / `buildSketchLayerCache()` — offscreen caching helpers

**Consolidation:**
- 9 functions extracted (including 5 helpers and 4 public draw functions)
- `sketchSprites` module-level sprite array moved to BackgroundRenderer.js
- `areEdgeCrystalsEnabled`, `areBackgroundParticlesEnabled` imports removed from CanvasRenderer.js
- `getCrystallineMosaicManager` import removed from CanvasRenderer.js
- Total code reduction: ~290 lines in CanvasRenderer.js (3,987 → 3,697 lines)
- `getViewportBounds` fallback in `drawCrystallineMosaic` simplified to `this._frameCache?.viewportBounds`
  (safe since `drawCrystallineMosaic` is only ever called within `draw()` where `_frameCache` is initialised)

**Integration Pattern:**
- ES6 module with named `export function` declarations
- All functions use the established `.call(this)` convention: called with `functionName.call(renderer)` where `renderer` is the CanvasRenderer / SimplePlayfield instance
- Public functions (`drawCrystallineMosaic`, `drawSketches`, `drawFloaters`) imported into CanvasRenderer.js and re-exported to preserve `CanvasRenderer.drawXxx` namespace used by playfield.js
- `drawSketchLayerCache` imported into CanvasRenderer.js for internal use in `draw()` but not re-exported
- Private helpers (`generateLevelSketches`, `getSketchLayerCacheKey`, `buildSketchLayerCache`, `drawSketchesOnContext`) are module-level functions not exported

**Dependencies:**
- `areEdgeCrystalsEnabled`, `areBackgroundParticlesEnabled` from `../../../preferences.js`
- `getCrystallineMosaicManager` from `../CrystallineMosaic.js`
- `this._frameCache` (pre-computed per-frame data set in CanvasRenderer `draw()`)
- `this.ctx`, `this.canvas`, `this.levelConfig`, `this.pathPoints`, `this.floaters`, `this.floaterConnections`, `this.backgroundSwimmers`, `this.pixelRatio`, `this.renderWidth`, `this.renderHeight`, `this.focusedCellId`

**Performance Considerations:**
- Background functions run once per frame as first layers in the render stack
- Sketch layer uses offscreen canvas caching: only re-rasterizes when level/dimensions change
- Crystalline mosaic culls to viewport bounds for performance
- Floater lattice uses `lighter` compositing only for swimmer sub-layer (minimal overdraw)

**Key Learnings:**
- Functions using `this` (renderer context) transfer cleanly to a new file without signature changes
- `getViewportBounds` fallback is safe to drop when function is always called within `draw()` frame scope
- Re-exporting imported names from CanvasRenderer.js preserves all existing `CanvasRenderer.*` call sites in playfield.js at zero cost
- Separating background from the 3,987-line CanvasRenderer is the first step toward per-layer render modules (Steps 2.2.2–2.2.5)
- 290-line reduction demonstrates value of grouping by render layer rather than by feature

---


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

### Phase 2.2.2: Tower Sprite Renderer (Build 487)

**Status:** ✅ Complete

**Extracted File:** `assets/playfield/render/layers/TowerSpriteRenderer.js` (738 lines)

**Responsibilities Extracted:**
- `drawTowerConnectionParticles()` — renders orbit motes and launch/arrive arcs for beta/gamma tower connections
- `drawConnectionEffects()` — renders in-transit connection particles moving between linked towers
- `drawTowerPressGlow()` — draws accent ring + glyph echo when a tower is actively pressed
- `drawPlacementPreview()` — renders the ghost tower body, range ring, κ tripwire link previews, and merge indicator during drag placement
- `drawTowerGlyphTransition()` — orchestrates the promotion/demotion animation sequence (residue → particles → flash → text)
- `drawTowerGlyphResidue()` — fades out the old glyph symbol during a transition
- `drawTowerGlyphParticles()` — animates direction-aware particles that fan out during a glyph change
- `getGlyphParticleColor()` — computes tinted promotion/demotion particle colour
- `drawTowerGlyphFlash()` — radial gradient burst centred on the tower body during a glyph change
- `drawTowerGlyphText()` — fades in the new glyph symbol with smoothstep easing
- `drawTowers()` — main per-frame tower rendering: range rings, per-type extensions, body circles, glyph text, chain ring, selection ring
- `drawZetaPendulums()` / `drawEtaOrbits()` / `drawDeltaSoldiers()` / `drawOmicronUnits()` — thin delegates to their respective tower module helpers

**Consolidation:**
- 15 functions extracted (4 public delegates + 11 tower body / glyph functions)
- 5 glyph-transition constants moved to TowerSpriteRenderer.js: `GLYPH_DEFAULT_PROMOTION_VECTOR`, `GLYPH_DEFAULT_DEMOTION_VECTOR`, `PROMOTION_GLYPH_COLOR`, `DEMOTION_GLYPH_COLOR`, `GLYPH_FLASH_RAMP_MS`
- 12 tower-helper imports removed from CanvasRenderer.js (`kappaTower`, `lambdaTower`, `muTower`, `nuTower` kill-particles, `xiTower`, `zetaTower`, `etaTower`, `deltaTower`, `thetaTower`, `omicronTower`, `piTower` ×3, `tauTower`, `upsilonTower`, `phiTower`)
- `ALPHA_BASE_RADIUS_FACTOR`, `getTowerVisualConfig`, `getTowerDefinition`, `drawConnectionMoteGlow` imports removed from CanvasRenderer.js
- Total code reduction: ~658 lines in CanvasRenderer.js (3,697 → 3,039 lines)

**Integration Pattern:**
- ES6 module with named `export function` declarations; internal helpers are unexported module-level functions
- All functions use the `.call(this)` convention: exported functions are called as `this.drawXxx()` from playfield.js via the `CanvasRenderer.*` namespace
- `drawTowerPressGlow` retains its explicit `playfield` first-parameter signature (unchanged from original)
- Internal calls within `drawTowers` that previously used `this.drawConnectionEffects(ctx)` and `this.drawTowerConnectionParticles(...)` now call the module-level functions directly: `drawConnectionEffects.call(this, ctx)`, `drawTowerConnectionParticles.call(this, ctx, tower, bodyRadius)`
- `this.drawZetaPendulums(tower)` / `this.drawEtaOrbits(tower)` in `drawTowers` replaced with direct helper calls `drawZetaPendulumsHelper(this, tower)` / `drawEtaOrbitsHelper(this, tower)` to avoid prototype indirection
- Public functions imported into CanvasRenderer.js and re-exported to preserve the `CanvasRenderer.drawXxx` namespace used by playfield.js

**Dependencies:**
- `ALPHA_BASE_RADIUS_FACTOR` from `../../../gameUnits.js`
- `getTowerVisualConfig` from `../../../colorSchemeUtils.js`
- `getTowerDefinition` from `../../../towersTab.js`
- `colorToRgbaString` from `../../../../scripts/features/towers/powderTower.js`
- `normalizeProjectileColor`, `drawConnectionMoteGlow` from `../../utils/rendering.js`
- Per-type helpers imported directly: `zetaTower`, `etaTower`, `deltaTower`, `omicronTower`, `kappaTower`, `lambdaTower`, `muTower`, `nuTower`, `xiTower`, `thetaTower`, `piTower`, `tauTower`, `upsilonTower`, `phiTower`
- `this.applyCanvasShadow`, `this.clearCanvasShadow` — shadow helpers remain on renderer instance
- `this.resolveConnectionOrbitAnchor`, `this.resolveConnectionOrbitPosition` — playfield orbit helpers
- `this.towerGlyphTransitions`, `this.connectionDragState`, `this.activeTowerMenu` — renderer state properties

**Performance Considerations:**
- `drawTowers` iterates all towers every frame; no algorithmic change, extraction is zero-cost
- Internal function calls bypass prototype lookup: `drawConnectionEffects.call(this, ctx)` is marginally faster than `this.drawConnectionEffects(ctx)`
- Glyph transition helpers run only when `towerGlyphTransitions` map has entries (typically rare)

**Key Learnings:**
- Grouping all tower body/glyph/placement/connection rendering into one file gives a clean "tower appearance" layer
- `drawTowerPressGlow`'s explicit `playfield` parameter transferred without any change in calling convention
- Moving internal calls from prototype-chained `this.fn()` to direct `fn.call(this)` is safe and slightly more explicit about ownership
- Removing 12 tower-type helper imports from CanvasRenderer.js significantly declutters the import block
- 658-line reduction is the largest single extraction in Phase 2.2

---

### Phase 2.2.3: Canvas Projectile Renderer (Build 488)

**Status:** ✅ Complete

**Extracted File:** `assets/playfield/render/layers/ProjectileRenderer.js` (605 lines)

**Responsibilities Extracted:**
- `drawProjectiles()` — main projectile loop: supply seeds, omega waves, eta lasers, iota pulses, epsilon needles, gamma star beams, standard beam projectiles; delegates burst effects to tower modules via `this.drawBetaBursts()` etc.
- `drawAlphaBursts()` — thin delegate to `alphaTower.drawAlphaBursts(this)`
- `drawBetaBursts()` — thin delegate to `betaTower.drawBetaBursts(this)`
- `drawGammaBursts()` — thin delegate to `gammaTower.drawGammaBursts(this)`
- `drawGammaStarBursts()` — renders animated pentagram star traces on enemies hit by gamma star projectiles
- `drawNuBursts()` — thin delegate to `nuTower.drawNuBursts(this)`
- `drawOmegaParticles()` — thin delegate to `omegaTower.drawOmegaParticles(this)`
- `resolveEpsilonNeedleSprite()` — palette-tints the epsilon needle sprite and caches results per gradient stop
- `getEnemyLookupMap()` — lazily builds a per-frame enemy ID→enemy Map for O(1) target resolution

**Consolidation:**
- 7 exported drawing functions + 2 private helpers moved to ProjectileRenderer.js
- `PROJECTILE_CULL_RADIUS_DEFAULT/IOTA_PULSE/OMEGA_WAVE/ETA_LASER` constants moved from CanvasRenderer.js
- Epsilon needle sprite loading code (`epsilonNeedleSprite`, `epsilonNeedleSpriteCache`, `EPSILON_NEEDLE_GRADIENT_STOPS`) moved from CanvasRenderer.js
- 5 tower burst helper imports removed from CanvasRenderer.js (`alphaTower`, `betaTower`, `gammaTower`, `nuTower`, `omegaTower`)
- `getEnemyLookupMap` private function removed from CanvasRenderer.js (only consumed by `drawProjectiles`)
- Total code reduction: ~477 lines in CanvasRenderer.js (3,039 → 2,562 lines)

**Integration Pattern:**
- ES6 module with named `export function` declarations; private helpers (`clamp`, `getViewportBounds`, `isInViewport`, `resolveEpsilonNeedleSprite`, `getEnemyLookupMap`) are unexported module-level functions
- `getViewportBounds` and `isInViewport` are duplicated locally (they are also retained in CanvasRenderer.js for the enemy/mote/damage-number culling that remains there); this avoids a circular import
- All exported functions use the `.call(renderer)` convention and are re-exported by CanvasRenderer.js to preserve the `CanvasRenderer.drawXxx` namespace used by playfield.js
- `drawProjectiles` ends by calling `this.drawBetaBursts()` etc. through the renderer prototype, consistent with the original call chain

**Dependencies:**
- `samplePaletteGradient` from `../../../colorSchemeUtils.js`
- `colorToRgbaString` from `../../../../scripts/features/towers/powderTower.js`
- `normalizeProjectileColor` from `../../utils/rendering.js`
- Per-tower burst helpers: `alphaTower`, `betaTower`, `gammaTower`, `nuTower`, `omegaTower`

**Performance Considerations:**
- `drawProjectiles` is a hot path; no algorithmic change — extraction is zero-cost
- `getEnemyLookupMap` lazily builds a per-frame Map; frames without target-based projectiles skip the build
- `resolveEpsilonNeedleSprite` is keyed on closest gradient stop + palette colour; typical cache size is ≤4 entries

**Key Learnings:**
- Viewport culling helpers (`getViewportBounds`/`isInViewport`) were retained in both files rather than moved to a shared utility, keeping the import graph acyclic at minimal duplication cost (~40 lines)
- Burst effects (alpha/beta/gamma/nu/omega) remain delegated to their respective tower modules — ProjectileRenderer only holds thin wrappers, keeping tower logic co-located with tower files
- 477-line reduction is a solid step toward the Phase 2.2 goal of a ≤1,000-line coordinator

---

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

**Step 2.2.4: Extract Enemy Renderer** ✅ COMPLETED (Build 489)
- **New File:** `assets/playfield/render/layers/EnemyRenderer.js` (~690 lines)
- **Extracted:** `drawEnemies`, `drawEnemyDeathParticles`, `drawSwarmClouds`, plus all private helpers:
  - Enemy swirl particle system (spawn, advance, backdrop, knockback offset)
  - Rho sparkle ring effect
  - Debuff status bar rendering
  - Enemy fallback body, symbol/exponent overlay, shell sprites
  - Swirl impact queue / particle cleanup

**Step 2.2.5: Extract UI Overlay Renderer** ✅ COMPLETED (Build 489)
- **New File:** `assets/playfield/render/layers/UIOverlayRenderer.js` (~340 lines)
- **Extracted:** `drawDamageNumbers`, `drawFloatingFeedback`, `drawWaveTallies`, `drawTowerMenu`, plus private helper `drawAnimatedTowerMenu`

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

| Metric | Current (Build 489) | Phase 1 Target | Phase 2 Target | Phase 3 Target | Final Target |
|--------|---------|----------------|----------------|----------------|--------------|
| Largest file size | 6,264 lines | 8,000 lines | 5,000 lines | 3,000 lines | < 2,000 lines |
| Files > 3,000 lines | 3 files | 3 files | 1 file | 0 files | 0 files |
| Average file size | ~750 lines | ~600 lines | ~400 lines | ~300 lines | < 250 lines |
| Module count | ~143 modules | ~140 modules | ~160 modules | ~180 modules | ~200 modules |
| Test coverage | TBD | TBD | TBD | TBD | > 70% |

**Progress Notes (Build 489):**
- CanvasRenderer.js reduced from 2,562 to ~1,298 lines (1,264 line reduction from enemy + UI overlay renderer extractions)
- EnemyRenderer.js created: ~690 lines (Build 489 - drawEnemies, drawEnemyDeathParticles, drawSwarmClouds, all enemy swirl/knockback helpers, rho sparkle, debuff bar rendering; extracted from CanvasRenderer.js)
- UIOverlayRenderer.js created: ~340 lines (Build 489 - drawDamageNumbers, drawFloatingFeedback, drawWaveTallies, drawTowerMenu, drawAnimatedTowerMenu; extracted from CanvasRenderer.js)
- ProjectileRenderer.js created: 605 lines (Build 488 - drawProjectiles, drawAlphaBursts, drawBetaBursts, drawGammaBursts, drawGammaStarBursts, drawNuBursts, drawOmegaParticles, resolveEpsilonNeedleSprite, getEnemyLookupMap; extracted from CanvasRenderer.js)
- TowerSpriteRenderer.js created: 738 lines (Build 487 - tower body/glyph/placement/connection rendering)
- BackgroundRenderer.js created: 381 lines (Build 486 - crystalline mosaic, sketch layer, floater lattice)
- CardinalWardenSimulation.js at 6,264 lines (1,084 line reduction from enemy system extraction; 1,654 lines total reduction in Phase 2)
- CombatStateManager.js created: 587 lines (Build 444-446)
- TowerOrchestrationController.js created: 852 lines (Build 448-449)
- RenderCoordinator.js created: 123 lines (Build 450, cleaned up Build 453)
- DeveloperToolsService.js created: 560 lines (Build 457)
- WaveUIFormatter.js created: 375 lines (Build 459)
- GestureController.js created: 288 lines (Build 460)
- FloaterSystem.js created: 174 lines (Build 461)
- LevelLifecycleManager.js created: 462 lines (Build 463)
- BackgroundSwimmerSystem.js created: 197 lines (Build 464)
- ProjectileUpdateSystem.js created: 610 lines (Build 465)
- VisualEffectsSystem.js created: 552 lines (Build 466)
- CombatStatsManager.js created: 393 lines (Build 467)
- PathGeometrySystem.js created: 328 lines (Build 468)
- TowerMenuSystem.js created: 386 lines (Build 469)
- ConnectionSystem.js created: 747 lines (Build 470)
- WaveSystem.js created: 206 lines (Build 472 - Cardinal Warden wave propagation)
- BeamSystem.js created: 239 lines (Build 474 - Cardinal Warden continuous beam, grapheme L)
- MineSystem.js created: 193 lines (Build 474 - Cardinal Warden drifting mines, grapheme M)
- SwarmSystem.js created: 304 lines (Build 475-476 - Cardinal Warden swarm ships/lasers, grapheme N)
- EnemySystem.js created: ~1,096 lines (Build 477 - EnemyShip, RicochetSkimmer, CircleCarrierBoss, PyramidBoss, HexagonFortressBoss, MegaBoss, UltraBoss)
- Total extracted: ~9,568 lines across twenty-three modules
- Extracted combat state, tower orchestration, render loop, developer tools, wave UI formatting, gesture handling, floater particles, level lifecycle, background swimmers, projectile physics, visual effects (damage numbers, enemy death particles, PSI merge/AoE effects, swirl impacts), combat statistics tracking, path geometry (path curves, tunnel segments, river particles, Catmull-Rom spline interpolation), tower menu system (radial menu options, geometry, click handling, option execution), connection system (alpha/beta swirls, supply seeds, swarm clouds, connection effects), wave system (expanding damage waves, collision detection), beam system (continuous beam weapons, line collision, render), mine system (drifting mines, explosion waves, render), swarm system (swarm ships, swarm lasers, collision, render), enemy system (all enemy/boss classes with movement AI, elemental status effects, trail/smoke rendering), background renderer (crystalline mosaic, sketch layer, floater lattice), tower sprite renderer (tower body/glyph/placement), and projectile renderer (all projectile types + burst effects)
- Maintained backward compatibility through delegation pattern and property getters
- Connection system uses factory pattern with Object.assign delegation for 19 methods
- **Note on Phase 2 Spread/Elemental/Massive items:** Spread Pattern (grapheme I), Elemental Effects (grapheme J), and Massive Bullet (grapheme K) are modifier configurations embedded in the bullet-firing loop, not standalone simulation objects with independent update/render cycles. These do not cleanly map to extractable modules and are better addressed as part of Step 2.1.6 (core simulation reduction) rather than standalone extractions.
- **Progress to Phase 1 target:** 127.3% (Phase 1 target exceeded by 2,161 lines!)

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
- [x] Playfield Projectile Update System extracted (Build 465)
- [x] Playfield Visual Effects System extracted (Build 466)
- [x] Playfield Combat Stats Manager extracted (Build 467)
- [x] Playfield Path Geometry System extracted (Build 468)
- [x] Playfield Tower Menu System extracted (Build 469)
- [x] Playfield Connection System extracted (Build 470)
- [ ] Playfield Input Controller enhanced
- [ ] Main.js Navigation Router extracted
- [ ] Main.js Lifecycle Coordinator extracted
- [ ] Main.js Event Bus implemented
- [ ] State module pattern documented

#### Phase 2: High-Complexity Features
- [x] Cardinal Warden Wave System extracted (Build 472)
- [x] Cardinal Warden Beam System extracted (Build 474)
- [x] Cardinal Warden Mine System extracted (Build 474)
- [x] Cardinal Warden Swarm System extracted (Build 475-476)
- [x] Cardinal Warden Enemy System extracted (Build 477) - EnemyShip, RicochetSkimmer, CircleCarrierBoss, PyramidBoss, HexagonFortressBoss, MegaBoss, UltraBoss
- [ ] Cardinal Warden Spread Pattern (grapheme I) - embedded modifier; address in Step 2.1.6
- [ ] Cardinal Warden Elemental Effects (grapheme J) - embedded in enemy classes; address in Step 2.1.6
- [ ] Cardinal Warden Massive Bullet (grapheme K) - embedded modifier; address in Step 2.1.6
- [x] Canvas Background Renderer extracted (Build 486) - crystalline mosaic, sketch layer, floater lattice
- [x] Canvas Tower Sprite Renderer extracted (Build 487) - tower body/glyph/placement/connection rendering
- [x] Canvas Projectile Renderer extracted (Build 488) - all projectile types + burst effects (Alpha, Beta, Gamma, Nu, Omega)
- [x] Canvas Enemy Renderer extracted (Build 489) - enemy body/swirl/shell/debuff/sparkle, death particles, swarm clouds
- [x] Canvas UI Overlay Renderer extracted (Build 489) - damage numbers, wave tallies, floating feedback, tower menu

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

### Phase 1.1.14: Tower Menu System (Build 469)

**Status:** ✅ Complete

**Extracted File:** `assets/playfield/ui/TowerMenuSystem.js` (386 lines)

**Responsibilities Extracted:**
- Tower menu state management (active tower tracking, open/close animations)
- Menu option building (upgrade, sell, info, priority, behavior modes)
- Menu geometry calculation (radial layout in world space)
- Click handling and option selection
- Command execution (upgrade, sell, priority changes, Delta behavior modes)
- Enemy target selection for Delta sentinel mode

**Consolidation:**
- 8 methods extracted from playfield.js (getActiveMenuTower, openTowerMenu, closeTowerMenu, buildTowerMenuOptions, getTowerMenuGeometry, handleTowerMenuClick, executeTowerMenuOption, handleTowerMenuEnemySelection)
- Total code reduction: 284 lines in playfield.js (net after delegation wrappers)

**Integration Pattern:**
- Factory function: `createTowerMenuSystem(playfield)`
- Methods maintain context via playfield instance injection
- Delegation wrappers maintain backward compatibility
- Clean separation: menu logic isolated from combat/tower systems

**Dependencies:**
- External: `getNextTowerId`, `getTowerDefinition`, `openTowerUpgradeOverlay` (towersTab.js), `formatCombatNumber` (formatting utils), constants (HALF_PI, TWO_PI)
- Internal: playfield methods (`getCurrentTowerCost`, `upgradeTowerTier`, `sellTower`, `configureDeltaBehavior`, `ensureDeltaState`, `resolveEnemySymbol`)
- Zero coupling to render or combat systems

**Performance Considerations:**
- Menu operations are event-driven (no game loop impact)
- Factory instantiation once in constructor
- Methods delegate to tower orchestration for state changes
- No memory leaks or performance regressions

**Key Learnings:**
- UI system extraction benefits from factory pattern with instance injection
- Menu geometry calculations cleanly separate from menu logic
- Delegation pattern maintains API compatibility with zero overhead
- 284-line reduction brings playfield.js to 8,472 lines (117.2% to Phase 1 target - exceeded by 1,472 lines)
- Tower menu system provides foundation for future radial menu enhancements

---

**Document Version:** 1.6  
**Created:** Build 443  
**Last Updated:** Build 470  
**Status:** Phase 1 In Progress (15/19 playfield milestones complete, 127.3% to target - Phase 1 goal EXCEEDED)

### Phase 1.1.15: Connection System (Build 470)

**Status:** ✅ Complete

**Extracted File:** `assets/playfield/systems/ConnectionSystem.js` (747 lines)

**Responsibilities Extracted:**
- Connection particle lifecycle management (orbit, arrive, launch, swarm states)
- Tower swirl synchronization (alpha/beta mote counts matching stored shots)
- Supply seed creation and animation (trailing motes on supply projectiles)
- Supply seed transfer to orbit (converting projectile seeds to tower orbits)
- Swarm cloud persistence (lingering damage/stun clouds after stored shot impacts)
- Connection effect rendering coordination (visual links between connected towers)
- Particle position resolution (orbit anchors with pulse animation offsets)
- Launch queue management (queueing and triggering stored shot discharges)
- Swarm particle hit processing (creating damage clouds from particle impacts)

**Consolidation:**
- 19 methods extracted from playfield.js
- Total code reduction: 633 lines in playfield.js (net after delegation wrappers)
- Methods: `updateConnectionParticles`, `syncTowerConnectionParticles`, `createConnectionParticle`, `resolveTowerBodyRadius`, `updateConnectionOrbitParticle`, `updateConnectionArriveParticle`, `updateConnectionLaunchParticle`, `updateConnectionSwarmParticle`, `processSwarmParticleHits`, `resolveConnectionOrbitAnchor`, `resolveConnectionOrbitPosition`, `queueTowerSwirlLaunch`, `triggerQueuedSwirlLaunches`, `launchTowerConnectionParticles`, `createSupplySeeds`, `updateSupplySeeds`, `transferSupplySeedsToOrbit`, `updateSwarmClouds`, `createConnectionEffect`
- Constants extracted: `ALPHA_STORED_SHOT_STUN_DURATION`, `BETA_STORED_SHOT_STUN_DURATION`, `SWARM_CLOUD_BASE_DURATION`, `SWARM_CLOUD_DURATION_PER_SHOT`, `SWARM_CLOUD_RADIUS_METERS`, `SWARM_PARTICLE_FADE_DURATION`, `SWARM_PARTICLE_SPREAD_SPEED`, `SWARM_CLOUD_DAMAGE_MULTIPLIER`

**Integration Pattern:**
- Factory function: `createConnectionSystem(playfield)`
- Object.assign delegation pattern with 19 exported methods
- Methods maintain context via playfield instance reference
- Delegation methods return sensible defaults when system unavailable
- System instantiated in constructor after tower menu system

**Dependencies:**
- External: `TWO_PI`, `easeOutCubic`, `easeInCubic` (mathConstants), `metersToPixels`, `ALPHA_BASE_RADIUS_FACTOR` (gameUnits)
- Internal: playfield methods (`getTowerById`, `getEnemyPosition`, `getEnemyVisualMetrics`, `getEnemyHitRadius`, `applyDamageToEnemy`, `applyStunEffect`)
- Internal: playfield state (`towers`, `enemies`, `towerConnectionMap`, `connectionEffects`, `swarmClouds`, `renderWidth`, `renderHeight`, `canvas`)
- Zero coupling to rendering (delegates to CanvasRenderer for draw calls)

**Performance Considerations:**
- Connection updates run every frame during active gameplay
- Particle state transitions are lightweight (no allocations in hot paths)
- Swarm cloud collision checks use efficient distance calculations
- System initialization is lazy (only created when playfield constructed)
- Delegation overhead minimal (inline safety checks)

**Key Learnings:**
- Connection particle system is self-contained with clear state machine (orbit → arrive → launch → swarm → done)
- Factory pattern with instance injection provides clean access to playfield state
- Object.assign delegation pattern scales well to many methods (19 in this case)
- Constants encapsulation improves maintainability and reduces magic numbers
- 633-line reduction brings playfield.js to 7,839 lines (127.3% to Phase 1 target - exceeded by 2,161 lines!)
- Connection system provides foundation for future lattice enhancements (e.g., gamma chains, zeta links)
- Swarm cloud mechanics isolated from particle animation for easier balancing

---

**Document Version:** 1.6  
**Created:** Build 443  
**Last Updated:** Build 470  
**Status:** Phase 1 Complete (15/15 playfield extractions, 127.3% to target - EXCEEDED by 2,161 lines)

### Phase 2.1.1: Cardinal Warden Wave System (Build 473)

**Status:** ✅ Complete

**Extracted File:** `scripts/features/towers/cardinalWarden/WaveSystem.js` (205 lines)

**Responsibilities Extracted:**
- ExpandingWave class for wave physics and rendering
- Wave expansion animation (radius growth, alpha fade-out)
- Wave-enemy collision detection with ring thickness calculations
- Wave-boss collision detection with ring thickness calculations
- Damage application to enemies and bosses touched by waves
- Wave lifecycle management (spawn, update, remove finished waves)
- Factory function for creating waves from bullet impacts
- Callback-based integration (onDamage, onKill)

**Consolidation:**
- 1 class extracted (ExpandingWave: 40 lines)
- 3 helper functions extracted (createWaveFromBulletImpact, updateExpandingWaves, renderExpandingWaves)
- Total code reduction: 96 lines in cardinalWardenSimulation.js (8,015 → 7,919 lines)
- Wave creation simplified using factory function pattern

**Integration Pattern:**
- ES6 module with class and function exports
- ExpandingWave class maintains original implementation
- updateExpandingWaves encapsulates collision detection and damage application
- renderExpandingWaves provides clean rendering delegation
- Callbacks for damage/kill events maintain loose coupling
- Wave array mutated directly (splice for removal, sorted indices for target removal)

**Dependencies:**
- External: WAVE_CONFIG from cardinalWardenConfig.js (expansion duration, ring thickness, damage multiplier)
- Internal: Enemy/boss takeDamage() methods, size properties
- Zero dependencies on rendering or UI systems beyond canvas context

**Performance Considerations:**
- Wave update runs O(waves × (enemies + bosses)) per frame
- Ring collision uses distance calculations (Math.sqrt per check)
- Finished waves removed immediately to minimize iteration overhead
- Hit tracking uses Set for O(1) lookup (prevents duplicate damage)
- Wave factory function returns null for bullets without wave effects

**Key Learnings:**
- Wave system is highly modular with clear boundaries (9/10 modularity score)
- Class extraction preserves exact behavior (no refactoring of core logic)
- Factory pattern simplifies wave creation at bullet impact points
- Callback pattern allows clean integration without tight coupling
- 96-line reduction demonstrates value of targeted, focused extractions
- Wave System establishes pattern for subsequent Cardinal Warden extractions (Beam, Mine, etc.)
- Original estimate was 100-120 lines; actual extraction was 205 lines (more complete isolation)

---

### Phase 2.1.2: Cardinal Warden Beam System (Build 474)

**Status:** ✅ Complete

**Extracted File:** `scripts/features/towers/cardinalWarden/BeamSystem.js` (239 lines)

**Responsibilities Extracted:**
- `Beam` class for continuous line-of-sight weapons (origin, angle, damage, width, maxLength, weaponId)
- Per-target damage tick-rate limiting (`enemyLastDamageTime` / `bossLastDamageTime` Maps)
- Endpoint calculation (`getEndPoint`)
- Beam rendering with glow effect (`render`)
- `pointToLineDistance` utility — closest-point-on-segment distance for collision detection
- `checkBeamCollisions(beams, enemies, bosses, onDamage, onKill)` — returns `{ killedEnemyIndices, killedBossIndices }` (sorted descending, splice-safe)
- `renderBeams(ctx, beams)` — thin render delegation

**Consolidation:**
- 1 class extracted (Beam), 3 standalone functions extracted
- Total code reduction: ~180 lines in cardinalWardenSimulation.js
- `checkBeamCollisions` delegation wrapper in simulation calls extracted system and splices results

**Integration Pattern:**
- ES6 module, named class and function exports
- Callback-based integration (`onDamage`, `onKill`) mirrors WaveSystem.js pattern
- Descending-sorted kill indices for safe in-place splice in caller
- `Date.now()` used inside `checkBeamCollisions` for damage tick timing

**Dependencies:**
- External: `BEAM_CONFIG`, `VISUAL_CONFIG` from `cardinalWardenConfig.js`
- Internal: Enemy/boss `takeDamage()` methods, `size`, `scoreValue` properties
- No canvas context dependency in collision logic

**Performance Considerations:**
- Collision is O(beams × (enemies + bosses)) per frame
- `Map`-based tick-rate limiting avoids repeated damage on same target each frame
- `Math.hypot` used in `pointToLineDistance` for clarity; acceptable in practice (few active beams)

**Key Learnings:**
- Beam tick-rate limiting via `Date.now()` is self-contained and does not need caller coordination
- `pointToLineDistance` is a reusable geometric utility exported for potential future callers
- Pattern established by WaveSystem (callback + descending indices) transferred cleanly
- Beam System extraction reduces cognitive load of collision section in simulation file

---

### Phase 2.1.3: Cardinal Warden Mine System (Build 474)

**Status:** ✅ Complete

**Extracted File:** `scripts/features/towers/cardinalWarden/MineSystem.js` (193 lines)

**Responsibilities Extracted:**
- `Mine` class with drift physics, pulsing render, expiry and offscreen checks
- Mine update loop: position drift, age tracking, pulse phase animation
- Mine-enemy collision detection triggering explosion wave creation
- Mine-boss collision detection triggering explosion wave creation
- Mine lifecycle management (remove on explode, expire, or exit canvas bounds)
- `updateMines(mines, enemies, bosses, w, h, dt) → ExpandingWave[]` — returns newly spawned explosion waves
- `renderMines(ctx, mines)` — delegates to `Mine.render()`

**Consolidation:**
- 1 class extracted (Mine), 2 standalone functions extracted
- Total code reduction: ~156 lines in cardinalWardenSimulation.js
- Caller pushes returned `ExpandingWave[]` into `this.expandingWaves`; no circular dependency

**Integration Pattern:**
- Imports `ExpandingWave` from `WaveSystem.js` — mine explosion reuses existing wave logic
- Return-value integration (new waves array) avoids callback coupling for wave creation
- Mine indices sorted descending before splice to preserve array stability

**Dependencies:**
- External: `MINE_CONFIG`, `VISUAL_CONFIG` from `cardinalWardenConfig.js`
- External: `ExpandingWave` from `./WaveSystem.js`
- Internal: Enemy/boss `x`, `y`, `size` properties
- No damage callbacks needed (explosion delegated to wave system)

**Performance Considerations:**
- Mine update runs O(mines × (enemies + bosses)) per frame
- `minesToRemove.includes(i)` linear scan acceptable (few mines active at once)
- Offscreen check uses cheap AABB comparison before sqrt
- Pulsing visual uses `Math.sin` once per mine per render frame (lightweight)

**Key Learnings:**
- Reusing `ExpandingWave` from WaveSystem eliminates duplicate explosion logic
- Return-value pattern (new waves array) simpler than callback for object creation
- Mine expiry/offscreen cleanup co-located with collision logic for clarity
- MineSystem is fully self-contained; no playfield state needed beyond canvas dimensions

---

**Document Version:** 2.0  
**Created:** Build 443  
**Last Updated:** Build 487  
**Status:** Phase 2 In Progress (5/5 Cardinal Warden extractions complete; 2/5 Canvas Renderer extractions complete)
