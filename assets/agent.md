# Assets Directory - Agent Guide

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
