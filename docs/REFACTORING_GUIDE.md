# main.js Refactoring Guide

## Overview

This document outlines the strategy for refactoring `assets/main.js` (originally 10,002 lines) into smaller, more maintainable modules without changing any game functionality.

## Upcoming High-Impact Refactoring Targets

### `assets/styles.css` – Layered stylesheet plan

**Why it matters:** The primary stylesheet now exceeds 8,000 lines and intermixes global tokens, palette swaps (e.g., `body.color-scheme-fractal-bloom`), utility selectors, and component-specific rules (panels, overlays, level paths). The cascade is difficult to reason about, and the `body.mouse-cursor-gem` overrides illustrate how hard it is to scope single-surface experiments.

**Refactor goals:**

1. Preserve all visual output while making it possible to evolve individual surfaces (HUD, overlays, playfield, Codex) without scrolling through the entire file.
2. Move palette and typography tokens into a base layer that other files can import so theme work is isolated from component tweaks.
3. Introduce consistent naming (BEM-style blocks or `data-*` hooks) for selectors that currently piggyback on nested DOM structure.

**Plan:**

1. **Inventory + annotate sections.** Use `rg`/`caniuse-lite` audit to tag the current major blocks (global reset, palette overrides, overlays, playfield HUD, towers tab, Codex) and add temporary `@layer` comments at the top of each block so we know where to split.
2. **Create layered partials.** Split the file into `styles/base.css` (custom properties, global reset, cursor tokens), `styles/themes.css` (all `body.color-scheme-*` variants and cursor overrides), `styles/components/` (HUD, overlays, panels, powder basins), and `styles/utilities.css` (helpers such as `.screen-reader-only` and `[data-drag-scroll]`). Each partial wraps rules in CSS `@layer base|theme|components|utilities` so import order stays predictable even though the browser loads multiple `<link>` tags.
3. **Map imports in `index.html`.** Replace the single `<link rel="stylesheet" href="./assets/styles.css">` with chained imports (base → themes → utilities → components). Because there is no build step, we rely on native CSS `@import url('./themes.css') layer(theme);` inside `styles/base.css` to keep HTTP requests minimal.
4. **Modularize components incrementally.** As we touch each UI surface (e.g., `.overlay-panel`, `.powder-ledger`, `.level-path-node`), move it into its own file under `styles/components/` and gate it behind matching data attributes. This enables future UI refactors to delete or replace an entire file without disturbing unrelated selectors.
5. **Regression verification.** Use a manual visual diff checklist (main menu, playfield, towers tab, powder tab, overlays) plus existing cursor toggles (`body.mouse-cursor-gem`) to ensure layered imports did not change specificity. The cascade remains stable because `@layer` sorts by declaration order, so record the canonical order in `docs/PLATFORM_SUPPORT.md` once confirmed.

### `assets/playfield.js` – Split SimplePlayfield responsibilities

**Why it matters:** `SimplePlayfield` owns rendering, combat state, gesture handling, developer tooling (`DeveloperCrystalManager` mixin), tower-orchestration glue, and unlock notifications in a single 7,000+ line file even though many subsystems already live in `assets/playfield/`. The constructor alone wires DOM nodes, dependency injection, and runtime bookkeeping, making changes brittle.

**Refactor goals:**

1. Turn `SimplePlayfield` into a thin orchestrator that composes explicit controllers instead of hoarding methods (e.g., `drawGammaBursts`, `drawTowerMenu`) and dependency state.
2. Make developer tooling optional by migrating the current `Object.assign(SimplePlayfield.prototype, DeveloperCrystalManager)` mixin into a dedicated service so production builds can skip it entirely.
3. Decouple gem drop + codex notifications from the render loop so those systems can be unit tested without a canvas.

**Plan:**

1. **Define controller boundaries.** Group existing methods into domains: (a) lifecycle + wave flow (`startLevel`, `handleVictory`, `handleDefeat`), (b) placement & targeting (`handleSlotSelect`, `spawnTower`, tower upgrade helpers), (c) rendering + effects (`drawAlphaBursts`, `drawTowerMenu`, gem particle draws), and (d) developer/diagnostic helpers. Document these clusters in `docs/main_refactor_contexts.md` so later contributors know where each method moved.
2. **Introduce composition layer.** Create `assets/playfield/controllers/PlayfieldLifecycle.js`, `PlayfieldPlacementController.js`, and `PlayfieldEffectsController.js`. Each module exports a factory that receives the dependencies already passed into `configurePlayfieldSystem` (tower defs, codex callbacks, palette helpers) and returns a set of functions. `SimplePlayfield` stores references to these controllers instead of re-declaring every helper.
3. **Migrate mixins into services.** Convert `DeveloperCrystalManager` into `createDeveloperTools(playfield)` so developer hooks register themselves only when the flag is on. Similarly, move orientation helpers (`determinePreferredOrientation`, `applyContainerOrientationClass`, etc.) into `playfield/orientationController.js` (already imported) by exposing an object so we can delete the trailing `Object.assign(SimplePlayfield.prototype, ...)` block.
4. **Isolate DOM/event binding.** Build a `PlayfieldDomBindings` helper that hydrates canvas + HUD references and provides strongly typed accessors. The constructor then consumes this helper, which simplifies testing and allows future Reactivity (observers) to reuse the bindings.
5. **Rewrite update loop glue.** Wrap the animation loop (`shouldAnimate`, `update` etc.) in a dedicated scheduler module so the class simply calls `this.scheduler.start()`/`stop()`. This also opens the door to deterministic replays or off-thread simulations.
6. **Regression suite.** After each extraction, run the existing manual loop: load a level, place towers, trigger developer tools, and ensure enemy codex and gem drops still flow through `registerEnemyEncounter` and `collectMoteGemDrop`. Because the controllers only change structure, no balance data should move.

### `assets/main.js` – Next extraction wave

**Why it matters:** Even after the documented extractions (`powderDisplay`, `powderPersistence`, `developerModeManager`, etc.), `main.js` still initializes resource state (`resourceState`, `powderState`, `spireResourceState`), tab routing (`tabForSpire`, `setActiveTab`, `getActiveTabId`), and overlay orchestration for systems like the upgrade matrix. The combination of state containers, tab/hud wiring, and autosave hookups keeps the file near 8k lines, slowing future UI work.

**Refactor goals:**

1. Move persistent state containers (resource, powder, spire banks) into dedicated modules that can be imported by both the HUD and autosave subsystems.
2. Extract tab navigation + overlay routing into a router/controller pair so overlay toggles stop manipulating DOM nodes defined hundreds of lines away.
3. Push autosave + progression hooks (`registerResourceHudRefreshCallback`, `schedulePowderSave`, level start confirmation overlays) into orchestration helpers that publish events rather than mutating closures.

**Plan:**

1. **State modules.** Create `assets/state/resourceState.js` (responsible for `baseResources` + `resourceState`, currently declared near line 700) and `assets/state/spireResourceState.js` (wrapping the `lamed/tsadi/shin/kuf` banks). Export factory functions so `configuration.js` can continue calling `registerResourceContainers` with the live objects. This unlocks re-use in tests and other modules without importing the entire main orchestrator.
   _Progress:_ Both factories now exist and `main.js` imports them. The remaining work in this bullet is extracting the powder config/state pair and wiring it through the same module boundary.
2. **Powder session bootstrap.** Move the powder configuration + state literal (currently `powderConfig`/`powderState`) plus helper getters (`getPowderElements`, `powderGlyphColumns`, `fluidGlyphColumns`) into `assets/powder/powderState.js`. That module can instantiate `createPowderDisplaySystem`/`createPowderUiDomHelpers` internally and expose the public APIs that `main.js` needs, shrinking the global variable list and clarifying ownership of functions like `reconcileGlyphCurrencyFromState`.
3. **Tab + overlay router.** Extract functions dealing with active tab bookkeeping (`tabForSpire`, `getActiveTabId`, `setActiveTab`, `updateSpireTabVisibility`, overlay toggles used around lines 1400-1500 and 3500+) into `assets/navigation/tabRouter.js`. Pair it with an `overlayRegistry` that exposes `openOverlay(id)`, `closeOverlay(id)`, and `withFocusTrap(id, callback)` so upgrade, glossary, powder, and playfield overlays stop duplicating focus and aria logic.
4. **Autosave/event dispatcher.** Introduce a lightweight event emitter (or leverage the browser's `EventTarget`) inside `assets/orchestration/gameEvents.js`. When powder or spire modules need to schedule saves, they dispatch `powder:state-changed`, and `autoSave.js` listens without requiring `main.js` to thread callbacks manually. This also simplifies offline progression code which currently imports `notifyIdleTime`, `grantSpireMinuteIncome`, etc.
5. **Migration cadence.** Apply the `uiHelpers` pattern used for earlier refactors: extract a module, wrap dependencies in a factory, import into `main.js`, and replace the inline block with the returned functions. Update `docs/main_refactor_contexts.md` after each extraction to record the new module boundaries.
6. **Verification.** After each phase, smoke-test tower placement, powder tab toggles, spire unlock transitions, developer mode toggles, and the upgrade overlay. Console logging on tab changes should prove the router is the only component manipulating ARIA attributes.

### `assets/data/gameplayConfig.json` – Structured config slices

**Why it matters:** The single JSON blob now mixes defaults, tower arrays, dozens of enemy codex entries (each with lore + formulas), level metadata, and future map slots. The file is 3,400+ lines long, which makes diffs noisy and invites merge conflicts whenever two people edit different sections.

**Refactor goals:**

1. Allow designers to edit enemies, towers, and level configs independently without scrolling through unrelated sections.
2. Keep the runtime loading API (`ensureGameplayConfigLoaded`, `loadGameplayConfigViaFetch`, `importJsonModule`) unchanged so downstream modules do not need to care where the data originated.
3. Preserve JSON sources for GitHub Pages hosting, but also add ES module fallbacks so the game can import structured data when running without fetch (e.g., local file URLs).

**Plan:**

1. **Split the data directory.** Create `assets/data/gameplay/` with subfolders for `defaults.json`, `enemies/*.json`, `towers/*.json`, and `levels/*.json`. Move the existing arrays into their respective files and keep a minimal `gameplayConfig.json` that only lists `{"defaults": "./defaults.json", "enemies": ["./enemies/etype.json", ...]}` references for backwards compatibility.
2. **Add an assembler module.** Implement `assets/data/gameplay/index.js` that imports each fragment (native JSON import supported by modern browsers) and exports a single `buildGameplayConfig()` function. `assets/gameplayConfigLoaders.js` can detect when module imports are available and call this builder instead of fetching the monolith, while the fetch path still downloads the combined JSON for legacy browsers.
3. **Update `configuration.js`.** Teach `applyGameplayConfigInternal()` to accept either the legacy combined object or the output of `buildGameplayConfig()`. When it receives the reference-style object from step 1, it resolves the relative files via `fetchJsonWithFallback` (similar to how fluid simulation profiles already handle multiple URLs).
4. **Document schema contracts.** Create a short schema description in `docs/main_refactor_contexts.md` or `docs/REFACTORING_GUIDE.md` describing the shape of each fragment (`EnemyCodexEntry`, `LevelBlueprint`, etc.) so contributors editing small JSON files know which fields remain required.
5. **Validation + tooling.** Add a lightweight validation script under `scripts/tools/validateGameplayConfig.js` that loads every fragment and asserts required keys (id, symbol, formulaLabel, etc.). Hook it into CI or the manual QA checklist. Designers can then edit `assets/data/enemies/planckShade.json` without worrying about typos breaking the entire config.

Following this plan will shrink the single-source files, align them with the distributed module approach already underway in `assets/main.js`, and make the codebase friendlier to concurrent changes.

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

### state/resourceState.js (resource container factory)

**Status:** ✅ Complete

**What was extracted:**
- Creation of `baseResources` defaults (score, score rate, energy rate, flux rate)
- Runtime `resourceState` mirror that tracks the mutable HUD values
- `registerResourceContainers()` wiring so downstream systems receive references without importing `main.js`

**Integration approach:**
- Introduced `createResourceStateContainers()` in `assets/state/resourceState.js`
- `main.js` calls the factory with `calculateStartingThero()` and fallback rates pulled from `configuration.js`
- Factory returns `{ baseResources, resourceState }`, preserving object identity for existing consumers while hiding the construction logic

**Result:**
- Roughly 40 lines of initialization logic left `assets/main.js`
- Future modules (autosave, HUD widgets, developer tools) can import the factory directly when they need fresh containers for tests
- Dependency injection keeps calculation helpers (`calculateStartingThero`, fallback rates, registration hook) explicit, simplifying future refactors of the state bootstrap sequence

### state/spireResourceState.js (advanced spire banks)

**Status:** ✅ Complete

**What was extracted:**
- Default Lamed spark bank payload (spark totals, drag level, upgrades, stats)
- Default Tsadi particle bank payload (particle totals plus glyph counts)
- Generic placeholders for Shin and Kuf unlock progression
- Merge helper so saved state can hydrate the container without mutating module-level templates

**Integration approach:**
- Added `createSpireResourceState()` under `assets/state/spireResourceState.js`
- The helper deep-merges overrides into the default branch templates and returns a fresh object tree
- `main.js` now calls the builder once during initialization instead of declaring the nested literals inline

**Result:**
- Advanced spire bookkeeping now lives beside the shared state factories, clarifying ownership of spark/particle banks
- Tests and future controllers can generate isolated state objects without importing the 4k-line orchestrator
- Prep work finished for the remaining "state modules" milestone—powder and spire persistence can follow the same pattern without re-opening `main.js`

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

### variableLibraryController.js (tower variable glossary overlay)

**Status:** ✅ Complete

**What was extracted:**
- Button label refresh and badge counting logic for the Towers tab "Variable Library" trigger
- DOM rendering for the glossary list, including empty-state messaging and accessible titles
- Overlay presentation helpers that animate show/hide sequences and restore focus to the invoking button
- Event binding for the glossary trigger, close button, background click dismissal, and discovered-variable listener wiring
- Equipment button handler that routes directly to `openCraftingOverlay()`

**Integration approach:**
- Added `createVariableLibraryController()` which accepts overlay helpers plus the discovery APIs via dependency injection
- Main.js instantiates the controller immediately after the overlay helper factory and calls `bindVariableLibrary()` during init
- Global keydown handler now defers to `variableLibraryController.handleKeydown(event)` so Escape/Enter close the overlay without referencing DOM nodes stored in main.js

**Result:**
- All variable glossary state now resides in `assets/variableLibraryController.js`, shaving another ~140 lines from `main.js`
- Overlay focus management and label bookkeeping are encapsulated, making it easier to evolve the glossary UI without touching the main orchestrator
- Key handling no longer inspects DOM flags directly, reducing tight coupling between overlays and the global listener
- main.js drops another concentrated set of UI helpers while retaining identical behavior

### upgradeMatrixOverlay.js (tower tier matrix overlay)

**Status:** ✅ Complete

**What was extracted:**
- DOM queries for the upgrade-matrix overlay, trigger buttons, close button, and content grid
- Rendering loop that lists unlocked towers, formats their base costs, and shows the next-tier preview text
- Overlay show/hide transitions plus focus restoration so keyboard users return to the activating trigger
- Background click + keydown handlers that previously lived in `main.js`

**Integration approach:**
- Added `createUpgradeMatrixOverlay()` which receives overlay helpers, formatting utilities, tower lookups, and the live Thero glyph via dependency injection
- main.js instantiates the controller alongside the other overlay factories, destructures the bind/render/hide/key handlers, and forwards `hide`/`render` to `towersTab` via the existing callback setters
- The global `keydown` listener now delegates to `handleUpgradeMatrixKeydown(event, { isLevelOverlayActive })`, mirroring the previous behavior that short-circuited level overlay shortcuts when the upgrade matrix was open

**Result:**
- Upgrade matrix UI logic moves out of `main.js`, removing another dense block of DOM code and focus bookkeeping
- Towers tab no longer reaches into `main.js` state; it simply calls the provided callbacks
- Overlay accessibility logic is centralized, making future adjustments to the tier list (sorting, filtering, new copy) possible without revisiting the orchestrator

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

### idleLevelRunManager.js (idle level automation controller)

**Status:** ✅ Complete

**What was extracted:**
- The shared `idleLevelRuns` map along with begin/stop helpers so background simulations are coordinated in one place
- `ensureIdleRunLoop()` / `stopIdleRunLoop()` animation frame wiring to tick runners only when active
- Idle-run completion plumbing that forwards rewards to `handlePlayfieldVictory()`
- `updateIdleLevelDisplay()` so the playfield HUD messaging lives beside the automation state machine

**Integration approach:**
- Added a `createIdleLevelRunManager()` factory that accepts level config/state maps, lookup helpers, and the DOM getters used for the playfield panel
- `main.js` destructures the returned helpers (`beginIdleLevelRun`, `stopIdleLevelRun`, `stopAllIdleRuns`, `updateIdleLevelDisplay`, and the shared map) so existing call sites keep the same names
- Developer tooling still receives the `idleLevelRuns` map reference, preserving the ability to clear or inspect runs during data resets

**Result:**
- Roughly 200 lines of idle-run orchestration logic move out of `main.js`, reducing the size of the orchestrator without changing behavior
- Background automation, HUD messaging, and animation-frame bookkeeping now live together, clarifying the dependencies required for future refactors
- Dependency injection keeps the new module decoupled from globals, so future changes to the playfield DOM or level state APIs only touch one file

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

### lamedSpireUi.js (Lamed gravity spire stats + upgrades)

**Status:** ✅ Complete

**What was extracted:**
- DOM lookups and text updates for every Lamed stat readout (tier labels, spark banks, upgrade costs)
- Drag/Star Mass upgrade button state management, including disabled styles and hide-at-max logic
- Click handlers for both upgrade buttons so the simulation state sync happens in one place

**Integration approach:**
- Added `createLamedSpireUi()` factory that caches DOM references and exposes `updateStatistics()` and `bindUpgradeButtons()`
- `main.js` now calls `lamedSpireUi.updateStatistics(lamedSimulationInstance)` instead of querying dozens of nodes directly
- Upgrade callbacks are injected when the Gravity simulation boots, keeping persistence + unlock bookkeeping inside `main.js`

**Result:**
- Lamed-specific UI plumbing moved to `assets/lamedSpireUi.js`, reducing churn inside the already massive tab-change handler
- Button bindings can be reused or unit-tested without spinning up the entire orchestrator
- Clearing this block sets the stage for additional spire refactors (Tsadi already extracted, Shin/Kuf next)

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

### powderViewportController.js (camera transforms + wall metrics)

**Status:** ✅ Complete

**What was extracted:**
- `applyPowderViewportTransform()` - Mirrors the simulation camera onto the DOM overlays
- `handlePowderViewTransformChange()` - Stores transforms and schedules basin saves
- `handlePowderWallMetricsChange()` / `updatePowderWallGapFromGlyphs()` - Normalize wall spacing and glyph-driven widening
- `initializePowderViewInteraction()` - Pointer + wheel bindings for panning/zooming both sand and fluid modes
- Hitbox visibility toggles previously tied to developer mode

**Integration approach:**
- Added `createPowderViewportController()` factory (`assets/powderViewportController.js`) that receives simulation getters, DOM element accessors, powder state/config, and autosave hooks
- `assets/main.js` destructures the returned helpers (plus a tiny `refreshPowderWallDecorations()` convenience wrapper) so existing call sites simply call the injected APIs
- The factory caches wall metrics for both sand and fluid overlays, only re-rendering the active DOM when necessary so developer toggles and inactive simulations stay lightweight

**Result:**
- All viewport math, wall spacing, and gesture logic left `assets/main.js`, trimming another ~400 lines from the orchestrator
- Developer mode toggles now refresh walls through a single helper instead of duplicating DOM math across the file
- Autosave integration became more explicit because wall metrics/transform persistence now lives in one module with clear scheduling points

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

### developerModeManager.js (developer toggle + reset workflow)

**Status:** ✅ Complete

**What was extracted:**
- Developer mode enable/disable orchestration (tower unlocks, spire bank flooding, Shin/Kuf unlock toggles)
- Player data wipe helpers (`resetPlayerProgressState`, `executePlayerDataReset`) plus persistent-storage clearing
- DOM bindings for the Codex developer toggle, explanatory note, and the destructive reset button

**Integration approach:**
- Added `createDeveloperModeManager()` in `assets/developerModeManager.js` to encapsulate the lattice controls behind a dependency-injected factory
- `assets/main.js` now instantiates the factory after powder helpers initialize and destructures only `bindDeveloperModeToggle()`, allowing the module to mutate shared state through injected getters/setters
- Autosave coordination, tower state, and developer control hooks are passed explicitly so the module no longer relies on `main.js` closure scope

**Result:**
- Several hundred lines of developer-only logic left `main.js`, improving readability and reducing the blast radius of future changes
- The Codex developer controls now live in a cohesive module that owns DOM wiring, storage persistence, and reset flows
- Future developer tooling additions can extend `createDeveloperModeManager()` without reopening the 10k-line orchestrator

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

### towerVariableDiscovery.js (tower equation variable tracking)

**Status:** ✅ Complete

**What was extracted:**
- Normalization helpers for blueprint variable metadata (library keys, symbols, and tooltip text)
- Discovered variable snapshot/listener bookkeeping so other systems (e.g., Codex, crafting) can react to unlocks
- `discoverTowerVariables()`, `getDiscoveredVariables()`, `addDiscoveredVariablesListener()`, and `initializeDiscoveredVariablesFromUnlocks()`

**Integration approach:**
- Added `createTowerVariableDiscoveryManager()` factory in `assets/towerVariableDiscovery.js`
- Factory receives the Towers tab state buckets (discovered-variable map + listeners) plus dependency getters for blueprint definitions and unlock collections
- `assets/towersTab.js` instantiates the manager once and re-exports the public APIs so existing imports continue to work unchanged

**Result:**
- Roughly 200 lines of metadata helpers left `assets/towersTab.js`, shrinking the tab controller before larger UI refactors land
- Shared listeners and snapshots now live in an isolated module that can be unit-tested without the entire Towers tab closure
- Tooltip + overlay modules consume the same `getUniversalVariableMetadata()` helper via dependency injection, avoiding repeated code

### towerLoadoutController.js (loadout grid rendering + drag handling)

**Status:** ✅ Complete

**What was extracted:**
- DOM wiring for the tower loadout grid, including button creation and cost label scaffolding
- Affordability refresh logic so anchor/upgrade cost badges stay synced with the live playfield state
- Pointer drag orchestration (start, move, cancel, finalize) that previously lived inline inside `towersTab.js`
- Helper text updates for the loadout note so onboarding copy remains consistent

**Integration approach:**
- Added `createTowerLoadoutController()` factory (`assets/towerLoadoutController.js`) that receives state getters plus formatting helpers via dependency injection
- `assets/towersTab.js` instantiates the controller once, re-exporting `setLoadoutElements`, `refreshTowerLoadoutDisplay`, `startTowerDrag`, etc., so existing call sites keep the same API
- The controller reads DOM caches through injected getters, meaning other systems that touch `towerTabState.loadoutElements` continue to function without modification

**Result:**
- Roughly 500 lines of loadout-specific DOM/drag code moved out of the 1,900-line `towersTab.js`, keeping the file focused on unlocks, equipment, and blueprint math
- Drag behavior, preview plumbing, and affordability labels now live in a cohesive module that can be unit tested without booting the entire Towers tab controller
- Future loadout enhancements (e.g., multi-slot presets) can evolve inside the dedicated controller without reopening the monolithic Towers tab orchestrator

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
