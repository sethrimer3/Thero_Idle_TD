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

### geometryHelpers.js (extracting normalized coordinate utilities)

**Status:** ✅ Complete

**What was extracted:**
- `clampNormalizedCoordinate(value)`
- `sanitizeNormalizedPoint(point)`
- `transformPointForOrientation(point, orientation)`
- `transformPointFromOrientation(point, orientation)`
- `distanceSquaredToSegment(point, start, end)`

**Integration approach:**
- Functions exported individually as pure utilities
- `main.js` imports helpers and delegates normalized coordinate math

**Result:**
- Shared geometry calculations now live in `assets/geometryHelpers.js`
- main.js sheds tightly scoped math helpers without behavior changes
- Reusable helpers simplify future playfield and editor refactors

### formatHelpers.js (formatting and labeling utilities)

**Status:** ✅ Complete

**What was extracted:**
- `toSubscriptNumber(value)`
- `formatAlephLabel(index)`
- `formatBetLabel(index)`
- `formatDuration(seconds)`
- `formatRewards(rewardScore, rewardFlux, rewardEnergy, formatGameNumber)`
- `formatRelativeTime(timestamp)`

**Integration approach:**
- Utilities exported directly for reuse across overlays and panels
- `formatRewards` now accepts `formatGameNumber` as an argument so main.js passes in its preferred numeric formatter instead of the helper importing it implicitly
- `main.js` imports the functions alongside existing geometry and UI helpers

**Result:**
- All formatting helpers now reside in `assets/formatHelpers.js`
- Number formatting preferences flow through explicit parameters, reducing hidden dependencies
- main.js loses another 120+ lines while keeping glyph and reward labels consistent

### audioOrchestration.js (audio suppression and music routing)

**Status:** ✅ Complete

**What was extracted:**
- `suppressAudioPlayback(reason)`
- `releaseAudioSuppression(reason)`
- `isAudioSuppressed()`
- `syncAudioControlsFromManager()`
- `bindAudioControls()`
- `determineMusicKey()`
- `refreshTabMusic(options)`

**Integration approach:**
- Functions wrapped in `createAudioOrchestration()` factory so dependencies (audio manager, storage helpers, active tab lookups) are injected explicitly
- Factory returns orchestration helpers that main.js destructures, keeping state encapsulated inside the module

**Result:**
- Audio suppression bookkeeping lives in `assets/audioOrchestration.js`, clarifying how tab visibility and overlays pause music
- Music routing logic now co-located with slider bindings, reducing shared state in `main.js`
- Tab changes and overlay events still call into the same helpers, but the file sheds another tight cluster of stateful functions
- **Guideline:** Any future ambient loops or bed tracks (e.g., tower hums, spire ambience) must route through `audioManager.playSfx()` with `loop: true` **and** rely on the shared suppression hooks. Call `suppressAudioPlayback()` when visibility or overlay changes should silence audio—the helper now pauses both music and looping SFX via `audioManager.suspendLoopingSfx()` so everything halts when the tab is hidden. When wiring a new loop to a tab, also remember to stop it explicitly via `audioManager.stopSfx(key)` when the tab is exited so the suppression/resume cycle can safely restart it later.

### playfieldOutcome.js (victory/defeat overlay wiring)

**Status:** ✅ Complete

**What was extracted:**
- `configurePlayfieldOutcome()` - Dependency injection setup for overlay callbacks and focus handling
- `setPlayfieldOutcomeElements()` - Registers DOM nodes for the outcome overlay once per boot
- `showPlayfieldOutcome()` / `hidePlayfieldOutcome()` - Presentation helpers with focus restoration logic
- `bindPlayfieldOutcomeEvents()` - Attaches overlay event listeners exactly once
- `exitToLevelSelectionFromOutcome()` - Leaves the active level when the primary action fires
- `handleOutcomeRetryRequest()` - Retries endless checkpoints and disables the retry button when unavailable

**Integration approach:**
- Outcome helpers live in a dedicated module with injected getters for the playfield instance and layout visibility toggle
- Main.js passes dependencies via `configurePlayfieldOutcome()` so hoisted functions remain callable without circular imports
- DOM queries funnel through `setPlayfieldOutcomeElements()` inside the existing initialization block

**Result:**
- Victory/defeat overlay logic is isolated from the main orchestrator, reducing shared mutable state
- Focus restoration and retry flows are encapsulated, making future overlay adjustments safer
- main.js drops another concentrated set of UI helpers while retaining identical behavior

### levelSummary.js (level preview + history formatting)

**Status:** ✅ Complete

**What was extracted:**
- `getLevelSummary(level)` - Generates the mode/duration/reward summary for the hovered level card
- `describeLevelLastResult(level, state, runner)` - Narrates the most recent outcome or idle run progress
- `formatInteractiveLevelRewards()` - Computes the dynamic interactive reward string with multiplier callouts
- `describeLevelStartingThero()` - Formats the starting Thero math using the configured multiplier and glyph symbol

**Integration approach:**
- Added `createLevelSummaryHelpers()` factory in `assets/levelSummary.js`
- Factory receives dependencies (`levelConfigs`, `idleLevelConfigs`, `getStartingTheroMultiplier`, etc.) plus the live Thero glyph so math text stays centralized
- `main.js` instantiates the helpers once after declaring `THERO_SYMBOL` and destructures `getLevelSummary` and `describeLevelLastResult`

**Result:**
- Level overlay/tooltip math formatting moved out of `main.js`, reducing repeated formatting logic
- All summary helpers live together, making it easier to audit copy and math changes without hunting through the orchestrator
- Future level-preview tweaks can adjust the helper factory without threading new state through thousands of lines of unrelated code

### spireTabVisibility.js (spire tab toggling helpers)

**Status:** ✅ Complete

**What was extracted:**
- `updateSpireTabVisibility()` - Orchestrates unlock-driven visibility for the Lamed, Tsadi, Shin, and Kuf spire tabs and their floating menu toggles
- `updateFluidTabAvailability()` - Manages the split powder/fluid tab state and corresponding badge visibility when the fluid study unlocks

**Integration approach:**
- Added `createSpireTabVisibilityManager()` factory that accepts `fluidElements`, `powderState`, `spireResourceState`, and a getter for the current resource HUD elements
- `main.js` destructures the returned helpers so existing code paths continue calling `updateSpireTabVisibility()` and `updateFluidTabAvailability()` without signature changes
- Resource HUD references now flow through a getter, ensuring the factory always sees the latest DOM bindings after the HUD initializes

**Result:**
- Unlock gating logic for spire tabs now lives alongside the DOM-specific wiring instead of expanding `main.js`
- Dependency injection keeps the helpers pure, improving future testability and reducing implicit coupling to the global scope
- main.js sheds another focused cluster of UI toggling code while retaining identical runtime behavior

### levelEditor.js (developer map tools + overlay editor controller)

**Status:** ✅ Complete

**What was extracted:**
- `createLevelEditorController()` factory with developer map toggles, overlay editor wiring, and DOM bindings
- Level editor surface state management (`setLevelEditorSurface`, `resetLevelEditorSurface`, `hideLevelEditorPanel`)
- Developer map placement helpers and wave editor initialization hooks
- Level editor pointer handling, status messaging, and sync utilities for developer mode overlays

**Integration approach:**
- Main orchestrator instantiates the controller with dependency getters (playfield reference, level config map, developer-mode flag)
- Controller returns the handful of methods `main.js` still needs (menu button wiring, preview rendering, and playfield handoff)
- Wave editor bindings now live inside the controller, removing the direct `waveEditorUI` import from `main.js`

**Result:**
- Developer tooling logic (map editor, overlay anchors, placement UI) is encapsulated in `assets/levelEditor.js`
- `main.js` delegates to the controller for surface management and state checks, shrinking by ~900 lines of tightly coupled code
- Reusable factory pattern keeps future developer tooling enhancements isolated from the core game loop

### tsadiUpgradeUi.js (Tsadi spire upgrade bindings)

**Status:** ✅ Complete

**What was extracted:**
- `bindTsadiUpgradeButtons()` - Click handlers for Tsadi repelling-force and tier upgrades
- `updateTsadiUpgradeUI()` - DOM refresh helper that syncs button state, labels, and descriptions with simulation data

**Integration approach:**
- Added `createTsadiUpgradeUi()` factory that receives the active Tsadi simulation getter and `spireMenuController`
- `main.js` destructures the returned helpers after simulation variables are declared, keeping dependency flow explicit
- Button listeners now check `spireMenuController.updateCounts` defensively so DI consumers remain optional

**Result:**
- Tsadi-specific UI wiring lives in `assets/tsadiUpgradeUi.js`, trimming duplicated DOM queries from `main.js`
- Upgrade panel updates remain functionally identical while relying on the shared factory pattern established for other extracts
- Refined dependencies make future Tsadi feature work easier without combing through thousands of lines in the orchestrator

### towerBlueprintPresenter.js (blueprint math + glyph state cache)

**Status:** ✅ Complete

**What was extracted:**
- `getTowerEquationBlueprint()` fallback handling plus authored blueprint lookups moved out of `towersTab.js`
- Glyph state bookkeeping (`ensureTowerUpgradeState`, snapshot/apply helpers, glyph cost tallies) consolidated into a single presenter
- `computeTowerVariableValue()` and `calculateTowerEquationResult()` now live beside the memoized equation cache instead of reaching into Towers tab globals
- `calculateTowerVariableUpgradeCost()` centralized so UI components share the same glyph pricing logic without duplicating guards

**Integration approach:**
- Added `createTowerBlueprintPresenter()` factory (`assets/towerBlueprintPresenter.js`) that receives `getTowerDefinition`, dynamic-context getter, and formatter helpers via dependency injection
- `assets/towersTab.js` instantiates the presenter once, re-exporting the returned APIs so existing imports in playfield/tower modules continue to work unchanged
- The tower upgrade overlay controller now consumes the presenter functions through its dependency map, keeping DI consistent with other refactors

**Result:**
- Blueprint math and glyph persistence are isolated from the 2,300-line Towers tab UI, trimming another ~500 lines from the monolith
- Shared helpers (`calculateTowerEquationResult`, `computeTowerVariableValue`, etc.) now sit in a dedicated module that can be unit tested without DOM scaffolding
- Explicit dependencies make future blueprint presenters (equipment bindings, blueprint narration) easier to author without re-threading global state

### powderUiDomHelpers.js (powder and fluid overlay DOM helpers)

**Status:** ✅ Complete

**What was extracted:**
- `bindFluidControls()` - Collects Bet Spire DOM references for simulation hydration
- `applyMindGatePaletteToDom()` - Updates the Mind Gate emblem gradient for the active powder palette
- `updateMoteGemInventoryDisplay()` - Renders the mote gem inventory list with sprites and counters
- `updatePowderGlyphColumns()` - Manages Aleph wall glyph DOM recycling and progress indicators
- `updateFluidGlyphColumns()` - Mirrors Bet glyph columns on the fluid study wall with right-side exclusivity

**Integration approach:**
- Helpers exposed via `createPowderUiDomHelpers()` with dependency injection for DOM caches and formatting utilities
- Main orchestrator provides lazy `getPowderElements()` accessor so initialization order remains unchanged
- Arrays tracking glyph columns are passed by reference, preserving shared state with powder display systems

**Result:**
- Powder and fluid overlay DOM logic now lives in `assets/powderUiDomHelpers.js`, shrinking `main.js` by another focused cluster
- UI helpers reuse the established factory pattern, keeping palette updates and glyph maintenance encapsulated
- Lazy element resolution guards prevent early calls from throwing while modules initialize, improving robustness

### powderDisplay.js (powder tab orchestration + idle rewards)

**Status:** ✅ Complete

**What was extracted:**
- `bindPowderControls()` and the shared `powderElements` cache for Powder tab UI wiring.
- `updatePowderDisplay()` / `updatePowderLedger()` for multiplier math, ledger text, and math-text rendering.
- `applyPowderGain()` and `triggerPowderBasinPulse()` to mutate mote currency and animate basin pulses.
- `notifyIdleTime()` / `grantSpireMinuteIncome()` plus idle summary helpers for all spire reward calculations.
- `updateResourceRates()` and `updateMoteStatsDisplays()` so powder bonuses keep global resource rates in sync.

**Integration approach:**
- New `createPowderDisplaySystem()` factory receives powder state, formatting helpers, and persistence hooks via DI.
- `main.js` destructures the returned helpers and forwards them to autosave, offline persistence, and developer controls.
- Powder currency getters/setters now live in the module, removing direct storage mutations from the orchestrator.

**Result:**
- Powder UI logic and idle math are isolated from `main.js`, trimming hundreds of lines from the orchestrator.
- Autosave/offline systems read powder state through explicit APIs instead of shared closures.
- Future powder refactors can iterate inside `powderDisplay.js` without spelunking the 10k-line main loop.

### spireFloatingMenu.js (floating menu navigation + counters)

**Status:** ✅ Complete

**What was extracted:**
- `createSpireFloatingMenuController()` factory for wiring floating spire navigation and slide-out menus
- Counter refresh helpers for mote, fluid, spark, particle, shin, and kuf displays
- Unlock-state toggles for showing and hiding spire-specific menu entries

**Integration approach:**
- Controller receives formatting helpers, resource getters, unlock predicates, and tab setter via dependency injection
- Main orchestrator instantiates the controller once and calls `initialize()`/`updateCounts()` where previous inline functions were invoked
- Menu selection sound routing is injected through a tiny callback to avoid direct audio dependencies in the module

**Result:**
- `assets/main.js` sheds another 230+ lines of DOM wiring related to the floating spire UI
- Floating menu behavior now lives in a cohesive module that can be unit tested without touching the full game orchestrator
- Unlock visibility checks and counter updates now reuse the same API wherever resource banks change

### powderPersistence.js (powder basin snapshot + sanitizers)

**Status:** ✅ Complete

**What was extracted:**
- `getPowderBasinSnapshot()` - Builds the autosave payload with palette, drop queues, and camera transform sanitization
- `applyPowderBasinSnapshot()` - Restores saved basin state, normalizing metrics and rehydrating pending drops
- Internal numeric guards (`clampFiniteNumber`, `clampFiniteInteger`, `cloneStoredMoteDrop`) that previously lived in `main.js`

**Integration approach:**
- Module exports a `createPowderPersistence()` factory so `main.js` can inject mutable powder state, config defaults, and callbacks (palette refresh, fluid tab toggles, autosave scheduling)
- Snapshot helpers call injected getters for the live powder/fluid simulations instead of closing over `main.js` globals directly
- `main.js` destructures the returned helpers and forwards them to `autoSave.js` just like the inlined versions

**Result:**
- Powder basin persistence logic now resides in `assets/powderPersistence.js`, clarifying which code owns save/load normalization
- Shared numeric sanitizers exit `main.js`, reducing the chance of subtle NaN/Infinity writes during autosave
- The new factory pattern keeps the persistence helpers testable without importing the entire game orchestrator

### powderPaletteUtils.js (shared palette + normalization helpers)

**Status:** ✅ Complete

**What was extracted:**
- `DEFAULT_MOTE_PALETTE`, `mergeMotePalette()`, and `computeMotePaletteFromTheme()` so palette assembly no longer bloats `powderTower.js`
- Color conversion helpers (`parseCssColor()`, `mixRgbColors()`, `colorToRgbaString()`) plus the clone utility reused by fluid and powder simulations
- Numeric guards (`clampUnitInterval()`, `normalizeFiniteNumber()`, `normalizeFiniteInteger()`) that sanitize powder persistence data

**Integration approach:**
- Introduced `scripts/features/towers/powderPaletteUtils.js` and imported it from `powderTower.js`, re-exporting the same API so existing consumers keep their import paths
- Updated the powder simulation to call the extracted helpers instead of maintaining inline copies of every parser and guard
- Documented the shared helpers so future palette work can stay decoupled from the 2,600-line powder simulation file

**Result:**
- `powderTower.js` sheds roughly 300 lines of palette and normalization boilerplate, focusing the file on simulation logic
- Fluid and powder systems now share a single palette source of truth, reducing divergence when the theme palette changes
- The dedicated module creates a clean staging ground for future palette or serialization refactors without reopening the monolith

### towerEquationTooltip.js (equation variable tooltip manager)

**Status:** ✅ Complete

**What was extracted:**
- Tooltip element creation, hover/focus handlers, and positioning math for tower equation variables
- Text derivation helpers that merge blueprint metadata with universal variable descriptors
- Timeout management and ARIA attribute cleanup to keep the tooltip accessible and flicker-free

**Integration approach:**
- Replaced inline functions in `assets/towersTab.js` with a `createTowerEquationTooltipSystem()` factory fed via dependency injection
- Towers tab now destructures the returned helpers, keeping the existing state bucket while hiding DOM bookkeeping inside the module
- Universal variable metadata lookup is injected so the new module stays decoupled from tower discovery logic

**Result:**
- Roughly 200 lines of tooltip-specific code moved out of the 3,400-line `towersTab.js`, shrinking its UI wiring surface
- Tooltip behavior is reusable and easier to unit test because it no longer closes over the entire Towers tab scope
- Future tooltip features (animations, math annotations) can iterate inside `assets/towerEquationTooltip.js` without touching the monolithic tab controller

### towerUpgradeOverlayController.js (upgrade overlay renderer + glyph spending)

**Status:** ✅ Complete

**What was extracted:**
- `renderTowerUpgradeOverlay()` orchestration for equation text, variable cards, and glyph inventory messaging.
- Glyph spending handlers (`handleTowerVariableUpgrade()` / `handleTowerVariableDowngrade()`) with audio feedback and autosave cache invalidation.
- Overlay show/hide scheduling, tooltip wiring, and focus restoration helpers formerly embedded in `assets/towersTab.js`.

**Integration approach:**
- Introduced a `createTowerUpgradeOverlayController()` factory that receives all stateful dependencies (tower tab state, formatter utilities, tooltip handlers, blueprint math evaluators) via dependency injection.
- `towersTab.js` now instantiates the controller once and re-exports the returned functions so existing call sites (`unlockTower`, loadout refresh, card bindings) continue to work without modification.
- Tooltip management continues to flow through the shared `createTowerEquationTooltipSystem()` helpers, keeping hover behavior consistent across the new module.

**Result:**
- `assets/towersTab.js` drops nearly 1,000 lines of tightly coupled overlay logic, leaving the module focused on loadout management and equipment UI.
- Glyph math, equation formatting, and overlay transitions live in a cohesive file that can be unit tested or iterated without spelunking the entire Towers tab controller.
- Future refactors (e.g., blueprint presenters or equipment bindings) can follow the same factory pattern to keep dependencies explicit and avoid circular imports.

### orientationController.js (playfield orientation + normalized geometry)

**Status:** ✅ Complete

**What was extracted:**
- `determinePreferredOrientation()` to infer portrait vs. landscape layouts based on viewport metrics and overrides
- `setPreferredOrientation()` to apply overrides and trigger downstream layout refresh hooks
- `applyContainerOrientationClass()` so CSS modifiers switch alongside the active orientation
- Normalized geometry helpers (`cloneNormalizedPoint`, `rotateNormalizedPointClockwise`) and the path transformer `applyLevelOrientation()`

**Integration approach:**
- New module `assets/playfield/orientationController.js` exports functions designed to bind directly onto `SimplePlayfield.prototype`
- `assets/playfield.js` now imports the helpers and mixes them in via `Object.assign`, keeping existing call sites intact without re-implementing each method inline
- Pure geometry helpers are reused within the module so future consumers can import them without loading the 6,000+ line playfield orchestrator

**Result:**
- Playfield orientation logic moves out of the monolith, shaving ~120 lines from `assets/playfield.js`
- Orientation/geometry responsibilities gain dedicated documentation and are easier to spot for upcoming playfield refactors
- Prototype mixin approach provides a template for extracting additional stateful clusters without rewriting every call site

### playfield/managers/DeveloperCrystalManager.js (developer crystal sandbox tools)

**Status:** ✅ Complete

**What was extracted:**
- Radius math, coordinate transforms, and placement helpers for the sandbox-only developer crystals
- Focus state management plus fracture/shard particle emission logic that previously lived inline inside `SimplePlayfield`
- Damage + update loops for the temporary obstacles so projectile logic can remain focused on enemies

**Integration approach:**
- New module exports named functions that expect to run with the playfield instance as their `this` value, matching other renderer helpers
- `assets/playfield.js` mixes the module directly onto `SimplePlayfield.prototype` via `Object.assign`, avoiding wrapper methods and keeping existing call sites intact
- Palette sampling moved alongside shard spawning, so the top-level playfield orchestrator no longer needs to import `samplePaletteGradient`

**Result:**
- Removes ~300 lines of crystal-only logic from the 7,500-line playfield monolith without changing gameplay behavior
- Developer-only systems now live under `assets/playfield/managers/`, making future sandbox tooling easier to locate and iterate
- The refactor demonstrates the repeatable mixin pattern for isolating additional state clusters (projectiles, enemy spawns, etc.) in future slices

## Upcoming High-Impact Refactor Targets

### assets/playfield.js (222 KB, core battle orchestration)

**Why it matters:** This module owns enemy lifecycle management, tower placement, projectile math, and palette-driven rendering bridges, making it the second-largest script after `main.js`. The breadth of responsibilities makes defects hard to isolate and stalls testing because visuals, state machines, and UI callbacks are intertwined in one file.

**Suggested plan:**
- Extract a `playfieldState.js` module that encapsulates grid occupancy, tower registries, and selection state so renderers and UI controllers can observe without mutating shared objects directly.
- Move projectile creation, travel resolution, and damage application into a dedicated `projectileSimulation.js` (factory-based to inject time-step helpers and math utilities). Pair this with pure math helpers to simplify verification.
- Carve out enemy spawns and codex notifications into `enemyWaveController.js`, passing in palette + audio hooks so future balance changes remain localized.
- Leave DOM wiring and event listeners in the existing module until the underlying subsystems stabilize, then migrate them into smaller view/controller modules.

### assets/towersTab.js (112 KB, upgrade + blueprint UI)

**Why it matters:** Towers tab logic currently handles UI binding, blueprint math evaluation, equipment integration, and formatting concerns. These responsibilities span formatting, data flow, and state orchestration, increasing the chance of circular dependencies and slowing blueprint refactors.

**Suggested plan:**
- Extract blueprint preparation into `towerBlueprintPresenter.js`, consuming math tokenizers and returning immutable presentation models for the tab to render.
- Move equipment binding into `towerEquipmentBindings.js` so loadout state changes can be unit-tested without rendering the full tab.
- Convert the UI event wiring (scroll, hover, selection) into a `createTowersTabController()` factory that receives DOM nodes and collaborators, mirroring the successful level editor refactor pattern.
- Continue using existing formatting utilities by injecting them into the controller to avoid re-importing `formatCombatNumber` deep inside view helpers.

### scripts/features/towers/powderTower.js (98 KB, shared rendering helpers)

**Why it matters:** Powder tower logic doubles as a palette utility module—`colorToRgbaString` and gradient helpers are imported across playfield rendering and UI previews. Mixing rendering math, palette utilities, and tower state machines creates implicit dependencies scattered throughout the project.

**Suggested plan:**
- Split palette/gradient helpers into `powderPaletteUtils.js`, limiting the tower module to combat behaviors and upgrade math.
- Create a `createPowderTowerController()` factory that accepts shared playfield services (projectile registry, resource hooks) rather than importing them directly.
- Relocate general-purpose rendering helpers to `playfield/render/powderEffects.js`, providing a clean import surface for both `playfield.js` and any future shader-based renderer.

### assets/towerEquations/greekTowers.js (64 KB, blueprint data monolith)

**Why it matters:** The module packs every Greek tower blueprint, formatting helpers, and effect annotations into one file. As new towers ship, merge conflicts and readability issues will grow.

**Suggested plan:**
- Break the file into per-letter modules inside `assets/towerEquations/greek/`, exporting a consistent interface (`getBlueprint()`, `describeUpgrades()`), then re-export from the existing index to preserve imports.
- Move shared formatting helpers into a small `towerEquationNarration.js` utility that can serve both Greek and advanced tower sets.
- Document the new directory layout in `JAVASCRIPT_MODULE_SYSTEM.md` once the split lands so future additions follow the pattern automatically.

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

#### 4. Parameterized Utilities (for helpers that need optional callbacks)

```javascript
// In module file
export function formatRewards(rewardScore, rewardFlux, rewardEnergy, formatGameNumber) {
  // Receives numeric formatter rather than importing it directly
}

// In main.js
import { formatRewards } from './formatHelpers.js';

const rewardSummary = formatRewards(score, flux, energy, formatGameNumber);
```

This pattern keeps small helpers stateless while allowing main.js to supply context-specific callbacks or formatters. It is especially useful when the helper previously reached into closure state.

## Remaining Refactoring Opportunities

### Priority 1: Independent Utilities

These can be extracted with minimal changes:

#### Math/Geometry Utilities (Completed)
**Status:** ✅ Extracted to `assets/geometryHelpers.js`

**Notes:**
- Utilities now imported by `main.js` instead of inline definitions
- Continue using this module for normalized coordinate helpers

#### Remaining Small Helpers
**Targets:** DOM mutation helpers that do not touch shared state (e.g., simple class toggles, attribute setters)

**Strategy:** Group by theme (scrolling, focus management, etc.) and export them as stateless functions from focused utility modules similar to `uiHelpers.js` and `formatHelpers.js`

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
