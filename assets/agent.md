# Assets Directory - Agent Guide

## Executive Summary

**What:** Integration hub for game loop, UI, state management, and visual/audio resources  
**Key File:** `main.js` - orchestrates all systems (do NOT add logic here, only wiring)  
**Testing:** Open `index.html` in browser, check console, test on mobile viewport  
**Common Tasks:** Configuration in `configuration.js`, preferences in `preferences.js`, save/load in `autoSave.js`

**Quick Lookup:**
- Game loop orchestration → `main.js`
- Playfield/tower systems → `playfield.js` + `playfield/` subdirectory
- Game settings → `configuration.js`, `data/gameplayConfig.json`
- User preferences → `preferences.js`
- Save/load → `autoSave.js`
- Tower selection UI → `towersTab.js`

---

## Purpose
The assets directory contains the main game loop, UI systems, game state management, and all visual/audio resources. This is the primary integration point where core systems come together.

## Directory Organization

```
assets/
├── main.js                  # Main game loop and orchestration
├── playfield.js             # Core playfield system
├── playfield/               # Playfield subsystem modules
│   ├── managers/           # Tower, enemy, projectile managers
│   ├── ui/                 # HUD and UI bindings
│   ├── input/              # Input controller
│   ├── render/             # Rendering systems
│   └── utils/              # Playfield utilities
├── configuration.js         # Game configuration and settings
├── preferences.js           # User preferences (notation, graphics)
├── autoSave.js             # Auto-save and persistence
├── audioSystem.js          # Audio management
├── enemies.js              # Enemy types and behaviors
├── levels.js               # Level definitions
├── towersTab.js            # Tower selection UI
├── achievementsTab.js      # Achievements system
├── codex.js                # In-game encyclopedia
├── data/                   # JSON configuration files
│   ├── gameplayConfig.json # Balance and gameplay values
│   └── towers/             # Tower-specific data
├── images/                 # SVG tower icons and sprites
├── sprites/                # PNG sprites and visual assets
├── fonts/                  # Custom font files
├── audio/                  # Music and sound effects
└── styles.css              # Main stylesheet
```

## Key Files Overview

### `main.js` - Heart of the Game
**Purpose:** Main game loop, imports all systems, orchestrates gameplay

**Critical Sections:**
1. **Imports block** - Pulls in all modules (scripts/core, scripts/features, assets)
2. **Audio system initialization** - Sets up sound manager
3. **Configuration loading** - Loads gameplay settings
4. **Playfield setup** - Initializes game board
5. **UI binding** - Connects DOM elements to game state
6. **Game loop** - RequestAnimationFrame update cycle
7. **Save/load system** - Persistence management

**When modifying:**
- Add imports at top (organized by source: scripts/core, scripts/features, assets)
- Keep import order consistent
- Don't add game logic here - delegate to feature modules
- Use this file only for wiring and orchestration

### `playfield.js` - Core Game Board
**Purpose:** Main playfield orchestration, tower placement, wave spawning

**Key Classes:**
- `SimplePlayfield` - Primary playfield class
- Path rendering and enemy movement
- Tower placement validation
- Projectile systems

**Integration:** Imports from `playfield/` subdirectory for specialized systems

### `configuration.js` - Game Settings
**Purpose:** Centralized configuration loading and management

**Key Functions:**
- `ensureGameplayConfigLoaded()` - Load balance values
- `getTowerLoadoutLimit()` - Max towers per level
- `calculateStartingThero()` - Starting currency
- `getBaseCoreIntegrity()` - Health system

**Usage:** Import configuration functions, don't hardcode values

### `preferences.js` - User Settings
**Purpose:** Player preferences (notation mode, graphics quality, cursor style)

**Settings Managed:**
- Number notation (letters vs scientific)
- Graphics mode (high/low quality)
- Glyph equations visibility
- Desktop cursor style

**Pattern:**
```javascript
import { 
  getActiveGraphicsMode,
  isLowGraphicsModeActive 
} from './preferences.js';

if (isLowGraphicsModeActive()) {
  // Reduce particle effects
}
```

### `autoSave.js` - Persistence System
**Purpose:** Auto-save game state, handle offline progression

**Key Functions:**
- `configureAutoSave()` - Setup auto-save interval
- `loadPersistentState()` - Load saved game
- `commitAutoSave()` - Manual save trigger
- `readStorage()` / `writeStorage()` - LocalStorage wrappers

## Playfield Subsystem

The `playfield/` directory contains specialized modules:

### `managers/TowerManager.js`
Tower placement, targeting, upgrade application

### `ui/HudBindings.js`
Resource display, UI updates, stat rendering

### `input/InputController.js`
Touch and mouse input handling, drag gestures

### `render/` (if exists)
Canvas rendering, particle systems, visual effects

### `utils/` (if exists)
Shared utilities for playfield operations

**See `playfield/agent.md` for detailed subsystem documentation**

## Common Patterns

### Importing from Scripts
```javascript
// Core utilities
import { formatGameNumber } from '../scripts/core/formatting.js';
import { renderMathElement } from '../scripts/core/mathText.js';

// Feature modules
import { 
  calculateBetaAttack,
  BETA_BASE_ATTACK 
} from '../scripts/features/towers/betaMath.js';
```

### Configuration Loading
```javascript
import { 
  ensureGameplayConfigLoaded,
  getTowerLoadoutLimit 
} from './configuration.js';

// Always ensure config loaded before accessing
await ensureGameplayConfigLoaded();
const maxTowers = getTowerLoadoutLimit(currentLevel);
```

### User Preferences
```javascript
import { 
  getActiveGraphicsMode,
  areGlyphEquationsVisible 
} from './preferences.js';

const graphicsMode = getActiveGraphicsMode();
const showEquations = areGlyphEquationsVisible();
```

### Auto-Save Integration
```javascript
import { 
  loadPersistentState,
  commitAutoSave 
} from './autoSave.js';

// On game start
const savedState = await loadPersistentState();

// After significant changes
commitAutoSave();
```

## Audio System

### AudioManager Class
Handles music and sound effects playback

**Key Methods:**
```javascript
const audioManager = new AudioManager(manifest);
audioManager.playSound('tower-place');
audioManager.playMusic('level-theme');
audioManager.setMasterVolume(0.7);
```

### Audio Manifest Structure
```javascript
const manifest = {
  music: {
    'theme-name': { src: 'path/to/music.mp3', volume: 0.8 },
  },
  sfx: {
    'sound-name': { src: 'path/to/sound.mp3', volume: 1.0 },
  },
};
```

## Enemy System

### `enemies.js`
Defines enemy types, movement, and behaviors

**Enemy Properties:**
- Health scaling (wave-based or level-based)
- Movement speed patterns
- Special abilities (shields, splitting, reversal)
- Damage values
- Reward currencies

**Mathematical Patterns:**
- Prime number spawns
- Fibonacci health scaling
- Exponential difficulty curves

## Levels System

### `levels.js`
Level definitions and progression structure

**Level Sets:**
- Hypothesis (tutorial)
- Conjecture (levels 1-5)
- Corollary (levels 6-10)
- Lemma (levels 11-15)
- Proof (levels 16-20)
- Theorem (levels 21-25)
- Axiom (levels 26-30)

**See `docs/PROGRESSION.md` for complete level descriptions**

## UI Systems

### Tower Selection (`towersTab.js`)
Tower unlock tree, purchase UI, upgrade interface

**Key Features:**
- Greek letter tower icons
- Cost display with formatted numbers
- Upgrade path visualization
- Glyph slot management

### Achievements (`achievementsTab.js`)
Achievement tracking and display

### Codex (`codex.js`)
In-game encyclopedia with mathematical lore

### Resource HUD (`resourceHud.js`)
Currency displays, core health, wave counter

## Data Configuration

### `data/gameplayConfig.json`
Balance values, tower stats, upgrade costs

**Structure:**
```json
{
  "towers": {
    "alpha": {
      "baseDamage": 10,
      "baseRange": 5,
      "baseCost": 100
    }
  },
  "difficulty": {
    "enemyHealthScale": 1.15
  }
}
```

### Tower Data Files
Individual JSON files in `data/towers/` for complex tower configurations

## Visual Assets

### `images/` - SVG Icons
- Tower icons: `tower-alpha.svg`, `tower-beta.svg`, etc.
- UI elements: `enemy-gate.svg`
- Scalable vector graphics (good for all screen sizes)

### `sprites/` - PNG Sprites
- Particle effects
- Equipment icons
- Glyph symbols
- Resource icons (gems, glyphs)

### Font Files (`fonts/`)
- Cormorant Garamond (scholarly serif)
- Great Vibes (elegant script)
- Space Mono (monospace for numbers)

## Styling

### `styles.css`
Main stylesheet with mathematical theme

**Design Principles:**
- Monochrome palette (black, white, gray)
- Scholarly typography
- Minimalist UI
- Mobile-first responsive design
- Touch-friendly sizing (44px minimum)

**CSS Custom Properties:**
```css
:root {
  --color-primary: #000000;
  --color-background: #ffffff;
  --font-body: 'Cormorant Garamond', serif;
  --font-math: 'Space Mono', monospace;
}
```

## Integration Workflow

### Adding New Features

1. **Create feature module** in `scripts/features/`
2. **Import in `main.js`** at the top
3. **Wire to game loop** in appropriate section
4. **Update UI** if needed (towersTab, HUD, etc.)
5. **Add configuration** to `gameplayConfig.json`
6. **Test on mobile viewport**

### Adding New Towers

1. **Create tower module** in `scripts/features/towers/`
2. **Add SVG icon** to `assets/images/`
3. **Import in `main.js`**
4. **Register in tower selection UI** (`towersTab.js`)
5. **Add to configuration** (`data/gameplayConfig.json`)
6. **Update progression docs** (`docs/PROGRESSION.md`)

### Modifying Balance

1. **Edit `gameplayConfig.json`** for simple value changes
2. **Edit tower modules** for formula changes
3. **Document formula changes** in code comments
4. **Update `docs/PROGRESSION.md`**
5. **Test progression curve** manually

## Common Mistakes to Avoid

❌ **Don't** put game logic in `main.js` - delegate to feature modules
❌ **Don't** hardcode values - use `configuration.js`
❌ **Don't** import entire modules - use named imports
❌ **Don't** modify playfield directly - use manager classes
❌ **Don't** forget to handle mobile viewports

✅ **Do** use configuration functions for all game values
✅ **Do** test changes on mobile portrait viewport first
✅ **Do** use the formatting utilities for all number displays
✅ **Do** follow the mathematical/scholarly aesthetic
✅ **Do** check browser console for errors after changes

## Mobile-First Development

### Touch Considerations
- Minimum 44×44px tap targets
- Drag gestures for tower placement
- Pinch-to-zoom disabled in CSS
- Touch-friendly UI spacing

### Viewport Testing
1. Open browser DevTools
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select mobile device (iPhone, Pixel)
4. Test in portrait orientation first
5. Verify landscape works second

### Responsive Patterns
```css
/* Mobile first */
.tower-card {
  width: 100%;
}

/* Desktop enhancement */
@media (min-width: 768px) {
  .tower-card {
    width: 48%;
  }
}
```

## Testing Workflow

Since there are **no automated tests**, validate changes by:

1. **Open `index.html`** in browser (or local server)
2. **Check console** for JavaScript errors
3. **Test tower placement** and upgrade UI
4. **Verify number formatting** displays correctly
5. **Test on mobile viewport** (portrait)
6. **Play through a level** to exercise systems
7. **Check save/load** works correctly

## Performance Considerations

### Low Graphics Mode
Respect user preferences:
```javascript
import { isLowGraphicsModeActive } from './preferences.js';

if (isLowGraphicsModeActive()) {
  // Reduce particles, simplify animations
  particleCount = Math.floor(particleCount / 2);
}
```

### RequestAnimationFrame
Game loop uses RAF for smooth 60fps:
```javascript
function gameLoop(timestamp) {
  updateGame(deltaTime);
  renderFrame();
  requestAnimationFrame(gameLoop);
}
```

### Canvas vs DOM
- Heavy visual effects use Canvas
- UI elements use DOM for accessibility
- Particle systems optimized for mobile

## Wave Encoding System

### Overview
The wave encoding system provides a compact format for storing level wave data, reducing JSON file sizes by ~90% compared to verbose format.

### Files
- `waveEncoder.js` - Core encoding/decoding functions
- `waveEditorUI.js` - Developer mode UI for wave editing
- `levels.js` - Updated to support both compact and verbose wave formats
- `data/levels/` - Directory for level JSON stub files

### Compact Wave Format
Format: `[WaveNumber]:[Count][EnemyType][Mantissa]e[Exponent]/[Interval]/[Delay]/[BossHP]`

**Example:**
```
1:10A1e2/1.5|2:15B5e3/1.2/0.5|3:20C1e4/1.0/0.3/1e5
```

**Components:**
- Waves separated by `|`
- Wave number prefix (e.g., `1:`)
- Enemy count (e.g., `10`)
- Enemy type letter A-M (see enemy type mapping below)
- HP in scientific notation (e.g., `1e2` = 100 HP)
- Spawn interval in seconds (e.g., `1.5`)
- Optional: Pre-wave delay in seconds (e.g., `0.5`)
- Optional: Boss HP in scientific notation (e.g., `1e5`)

### Enemy Type Mapping
```
A = Epsilon Type (etype)
B = Divisor (divisor)
C = Prime (prime)
D = Reversal (reversal)
E = Tunneler (tunneler)
F = Aleph Swarm (aleph-swarm)
G = Partial Wraith (partial-wraith)
H = Gradient Sapper (gradient-sapper)
I = Weierstrass Prism (weierstrass-prism)
J = Planck Shade (planck-shade)
K = Null Husk (null-husk)
L = Imaginary Strider (imaginary-strider)
M = Combination Cohort (combination-cohort)
```

### Developer Mode Wave Editor

**Activation:**
1. Enable Developer Mode in Codex tab
2. Enter any level
3. Open Dev Map Tools from playfield menu
4. Wave editor appears below path editor

**Features:**
- Add/remove waves dynamically
- Edit wave properties: count, enemy type, HP, interval, delay
- Toggle boss for final wave
- Export to compact string (auto-copies to clipboard)
- Import from compact string
- Real-time validation

**UI Controls:**
- Add Wave: Create new wave at end
- Clear All Waves: Remove all waves (with confirmation)
- Export: Generate compact string and copy to clipboard
- Import: Parse compact string and populate editor

### API Functions

**waveEncoder.js:**
```javascript
// Parse compact string to verbose wave array
parseCompactWaveString(waveString)

// Encode verbose waves to compact string
encodeWavesToCompact(waves)

// Generate default waves for a level number
createDefaultWaveString(levelNumber)

// Validate wave string format
validateWaveString(waveString)
```

**waveEditorUI.js:**
```javascript
// Initialize wave editor UI
initializeWaveEditor()

// Show/hide wave editor
showWaveEditor()
hideWaveEditor()

// Load waves into editor
loadWavesIntoEditor(waves)

// Sync editor with level
syncWaveEditorWithLevel(level)

// Export waves from editor
exportWavesFromEditor()

// Import wave string to editor
importWaveStringToEditor(waveString)
```

### Usage Examples

**Creating a level JSON file:**
```json
{
  "id": "level-01-epsilon-loop",
  "name": "Epsilon Loop",
  "description": "First conjecture proof",
  "waves": "1:8A1e2/1.5|2:10B5e2/1.4|3:12C2e4/1.3|4:14C2.5e5/1.2/0.8|5:16C3e6/1.1/0.9",
  "path": [],
  "autoAnchors": [],
  "startThero": 120,
  "lives": 10,
  "gateDefense": 0
}
```

**Backward compatibility:**
Levels.js automatically detects and parses compact wave strings. Existing levels with verbose wave arrays continue to work without modification.

### Common Wave Patterns

**Early levels (1-5):**
```
1:8A1e2/1.5|2:10A1.5e3/1.4|3:12B2e4/1.3|4:14C2.5e5/1.2/0.8|5:16C3e6/1.1/0.9/3e9
```

**Mid levels (10-15):**
```
1:8C1e8/1.5|2:10D1.5e9/1.4/0.5|3:12E2e10/1.3/0.6|4:14F2.5e11/1.2/0.7|5:16G3e12/1.1/0.8|6:18H3.5e13/1.0/0.9|7:20H4e14/0.9/1.0/4e17
```

**Boss waves:**
Add boss HP as 4th parameter: `5:16C3e6/1.1/2.0/3e9` (wave 5 with 3e9 HP boss after 2s delay)

### File Size Comparison

**Verbose format (single wave):**
```json
{
  "count": 10,
  "interval": 1.5,
  "hp": 100,
  "speed": 0.05,
  "reward": 10,
  "color": "#4a90e2",
  "codexId": "etype",
  "label": "Epsilon Type"
}
```
~170 bytes

**Compact format (same wave):**
```
1:10A1e2/1.5
```
~13 bytes (~92% reduction)

## Token Efficiency Tips

**For agents reading this:**
- `main.js` is the **integration hub** - start here to understand system connections
- Configuration values live in `configuration.js` or `data/gameplayConfig.json`
- Don't modify `main.js` unless adding new system imports
- Playfield logic lives in `playfield/` subdirectory - check `playfield/agent.md`
- UI files are focused - `towersTab.js` for towers, `achievementsTab.js` for achievements
- All number formatting goes through `scripts/core/formatting.js`
- Mathematical rendering uses `scripts/core/mathText.js`
- Save/load is fully handled by `autoSave.js`
- Mobile-first means test portrait viewport FIRST, always
- Wave encoding system reduces level JSON sizes by ~90% - use compact format for new levels
