# Playfield Subsystem - Agent Guide

## Purpose
Specialized modules for the core playfield system, managing towers, enemies, projectiles, input, and rendering. This subsystem is imported by `assets/playfield.js` for orchestration.

## Directory Structure

```
playfield/
├── constants.js                      # Playfield constants (grid size, colors, etc.)
├── managers/
│   ├── CombatStateManager.js        # Combat state (waves, enemies, victory/defeat) [Build 444]
│   ├── TowerManager.js              # Tower placement and upgrade logic
│   ├── DeveloperCrystalManager.js   # Developer crystal system
│   └── DeveloperTowerManager.js     # Developer tower tools
├── ui/
│   ├── HudBindings.js               # HUD updates and stat display
│   ├── TowerSelectionWheel.js       # Tower selection UI
│   ├── FloatingFeedback.js          # Floating damage/feedback numbers
│   └── WaveTallyOverlays.js         # Wave completion overlays
├── input/
│   └── InputController.js           # Touch and mouse input handling
├── render/
│   ├── CanvasRenderer.js            # Main canvas rendering system
│   └── CrystallineMosaic.js         # Crystalline visual effects
├── utils/
│   ├── formatting.js                # Number formatting utilities
│   └── math.js                      # Math/easing utilities
├── orientationController.js         # Device orientation handling
├── playfieldPreferences.js          # Playfield-specific preferences
└── agent.md                         # This file
```

## Architecture Overview

### Separation of Concerns
The playfield subsystem follows clean architecture:

**Managers** → Business logic (towers, enemies, projectiles)
**UI** → View layer (HUD, stat displays)
**Input** → Controller layer (user interactions)
**Render** → Presentation layer (canvas drawing)
**Utils** → Shared utilities

### Data Flow
```
User Input → InputController → TowerManager → Game State
                                      ↓
                              HudBindings updates UI
                                      ↓
                              Render draws to canvas
```

## Core Modules

### `constants.js`
**Purpose:** Centralized playfield constants

**Typical Constants:**
```javascript
export const GRID_SIZE = 32; // pixels per grid cell
export const PLAYFIELD_WIDTH = 800; // pixels
export const PLAYFIELD_HEIGHT = 600; // pixels
export const PATH_COLOR = '#333333';
export const TOWER_RANGE_COLOR = '#4444ff';
```

**Usage:**
```javascript
import { GRID_SIZE, PLAYFIELD_WIDTH } from '../constants.js';
```

**Rules:**
- Never hardcode values that appear in multiple places
- Use SCREAMING_SNAKE_CASE for all constants
- Group related constants together
- Document units (pixels, meters, seconds)

### `managers/CombatStateManager.js`
**Purpose:** Manage combat state including wave progression, enemy lifecycle, and victory/defeat conditions

**Added:** Build 444-446 (Refactoring Phase 1.1.1)

**Responsibilities:**
- Wave progression (currentWave, waveTimer, waveIndex, waveNumber)
- Enemy spawning and lifecycle (enemies array, spawn timing, death handling)
- Victory/defeat condition checking
- Resource tracking (energy rewards, lives/health)
- Endless mode support (cycle multipliers, speed scaling)

**Factory Pattern:**
```javascript
import { createCombatStateManager } from './managers/CombatStateManager.js';

// Create manager with dependency injection
const combatManager = createCombatStateManager({
  levelConfig: { waves: [...], lives: 20 },
  audio: audioManager,
  onVictory: (levelId, stats) => { /* handle victory */ },
  onDefeat: (levelId, stats) => { /* handle defeat */ },
  onCombatStart: (levelId) => { /* combat started */ },
  recordKillEvent: (towerId) => { /* track tower kills */ },
  tryConvertEnemyToChiThrall: (enemy) => { /* chi conversion */ },
  triggerPsiClusterAoE: (enemy) => { /* psi cluster */ },
  notifyEnemyDeath: (enemy) => { /* death callback */ }
});

// Use manager API
combatManager.startCombat({
  startingWaveIndex: 0,
  startingLives: 20,
  startingEnergy: 100,
  endless: false
});

// Spawn and update enemies
combatManager.spawnEnemies(deltaTime, {
  pathPoints: [...],
  radialSpawn: false,
  registerEnemy: (enemy) => { /* register */ }
});

combatManager.updateEnemies(deltaTime, {
  applyDebuffs: (enemy, delta) => { /* slow, sparkle */ },
  updateMovement: (enemy, delta) => { /* path progress */ }
});

// Handle enemy death
combatManager.handleEnemyDeath(enemy, {
  spawnDeathParticles: (enemy) => { /* visuals */ },
  dropGems: (enemy) => { /* loot */ }
});

// Query state
const enemies = combatManager.getEnemies();
const waveNum = combatManager.getWaveNumber();
const lives = combatManager.getLives();
const energy = combatManager.getEnergy();
const isVictory = combatManager.checkVictoryCondition();
```

**Integration Pattern:**
- **SimplePlayfield delegates** combat state to manager via property getters/setters
- **Manager owns authoritative state** (waves, enemies, outcome)
- **Playfield owns presentation** (rendering, visuals, UI updates)
- **Clean separation** enables testing manager in isolation

**Property Delegation Example:**
```javascript
// In SimplePlayfield class
get enemies() {
  return this.combatStateManager ? this.combatStateManager.getEnemies() : [];
}

get currentWaveNumber() {
  return this.combatStateManager ? this.combatStateManager.getWaveNumber() : 1;
}

get resolvedOutcome() {
  return this.combatStateManager ? this.combatStateManager.getOutcome() : null;
}

// No-op setters for backward compatibility
set currentWaveNumber(value) {
  // Manager owns state; this is a no-op
}
```

**Benefits:**
- ✅ Combat logic isolated and testable
- ✅ Reduced playfield.js complexity (~600 lines extracted)
- ✅ Clear API boundaries
- ✅ Reusable pattern for other systems
- ✅ No functionality changes

**Important Notes:**
- Always use manager API, never manipulate internal state directly
- Manager handles state, playfield handles visuals/UI
- Getters delegate to manager for authoritative state
- Setters are no-ops for backward compatibility
- Dependencies injected via factory config object

### `managers/TowerManager.js`
**Purpose:** Tower placement, targeting, upgrade application

**Responsibilities:**
- Validate tower placement positions
- Manage tower state (level, upgrades, glyphs)
- Handle tower selling/moving
- Calculate tower stats from upgrades
- Manage targeting priorities

**Key Patterns:**
```javascript
class TowerManager {
  /**
   * Place a new tower at grid position.
   * @param {number} x - Grid X coordinate
   * @param {number} y - Grid Y coordinate
   * @param {string} towerType - Tower type (alpha, beta, etc.)
   * @returns {boolean} Success status
   */
  placeTower(x, y, towerType) {
    if (!this.isValidPosition(x, y)) return false;
    // Create tower, deduct cost, add to grid
    return true;
  }

  /**
   * Upgrade tower to next level.
   * @param {string} towerId - Unique tower identifier
   * @returns {boolean} Success status
   */
  upgradeTower(towerId) {
    const tower = this.getTower(towerId);
    if (!tower || !this.canAffordUpgrade(tower)) return false;
    // Apply upgrade, update stats
    return true;
  }
}
```

**Integration:**
- Imports tower configs from `scripts/features/towers/`
- Uses formatting from `scripts/core/formatting.js`
- Updates UI through `HudBindings`
- Emits events for game state changes

### `ui/HudBindings.js`
**Purpose:** Connect game state to DOM elements

**Responsibilities:**
- Update resource displays (currency, health)
- Show tower stats in selection panel
- Render upgrade costs and benefits
- Display wave information
- Format all numbers for display

**Key Patterns:**
```javascript
import { formatGameNumber } from '../../../scripts/core/formatting.js';

class HudBindings {
  /**
   * Update currency display in HUD.
   * @param {number} amount - Current currency amount
   */
  updateCurrencyDisplay(amount) {
    const formatted = formatGameNumber(amount, 2);
    this.currencyElement.textContent = formatted;
  }

  /**
   * Update tower stat display in panel.
   * @param {Object} tower - Tower object with stats
   */
  updateTowerStatsPanel(tower) {
    this.damageElement.textContent = formatGameNumber(tower.damage, 1);
    this.rangeElement.textContent = formatGameNumber(tower.range, 0);
    // ... more stats
  }
}
```

**Important:**
- Always use formatting functions from `scripts/core/formatting.js`
- Never manipulate DOM directly from managers - go through HudBindings
- Cache DOM element references in constructor
- Update only changed elements (don't re-render everything)

### `input/InputController.js`
**Purpose:** Handle touch and mouse input for playfield interactions

**Responsibilities:**
- Detect tower placement taps/clicks
- Handle drag gestures for tower selection
- Manage tower range visualization on hover
- Process pinch-to-zoom (if enabled)
- Support both mobile touch and desktop mouse

**Key Patterns:**
```javascript
class InputController {
  constructor(playfield, towerManager) {
    this.playfield = playfield;
    this.towerManager = towerManager;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Touch events (mobile)
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

    // Mouse events (desktop)
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }

  /**
   * Convert screen coordinates to grid coordinates.
   * @param {number} screenX - X pixel coordinate
   * @param {number} screenY - Y pixel coordinate
   * @returns {{x: number, y: number}} Grid coordinates
   */
  screenToGrid(screenX, screenY) {
    return {
      x: Math.floor(screenX / GRID_SIZE),
      y: Math.floor(screenY / GRID_SIZE),
    };
  }
}
```

**Mobile Considerations:**
- Handle both single and multi-touch
- Prevent default behavior (pinch-to-zoom, scroll)
- Use touch-friendly hit areas (44×44px minimum)
- Show visual feedback (range circles, placement preview)

## Common Patterns

### Tower Placement Flow
```
1. User taps/clicks playfield
   → InputController.handleTouchEnd()

2. Convert screen coords to grid coords
   → InputController.screenToGrid()

3. Validate placement position
   → TowerManager.isValidPosition()

4. Check currency and placement rules
   → TowerManager.canAffordTower()

5. Place tower if valid
   → TowerManager.placeTower()

6. Update UI
   → HudBindings.updateCurrencyDisplay()
   → HudBindings.updateTowerCount()

7. Render new tower
   → RenderSystem.drawTower()
```

### Tower Upgrade Flow
```
1. User taps tower upgrade button
   → UI event handler

2. Check upgrade cost
   → TowerManager.getUpgradeCost()

3. Validate can upgrade
   → TowerManager.canUpgradeTower()

4. Apply upgrade
   → TowerManager.upgradeTower()
   → Import calculation from scripts/features/towers/

5. Recalculate stats
   → Use exported functions (calculateBetaAttack, etc.)

6. Update UI panel
   → HudBindings.updateTowerStatsPanel()

7. Deduct currency
   → HudBindings.updateCurrencyDisplay()
```

### Stat Calculation Pattern
```javascript
import { 
  calculateBetaAttack,
  calculateBetaRange 
} from '../../../scripts/features/towers/betaMath.js';

class TowerManager {
  updateTowerStats(tower) {
    // Never hardcode formulas here - import from tower modules
    tower.damage = calculateBetaAttack(tower.level);
    tower.range = calculateBetaRange(tower.level);
    // Apply glyph bonuses
    tower.damage *= this.getGlyphDamageMultiplier(tower);
  }
}
```

## Integration with Scripts

### Import Pattern
```javascript
// Core utilities
import { formatGameNumber } from '../../../scripts/core/formatting.js';
import { renderMathElement } from '../../../scripts/core/mathText.js';

// Tower features
import { 
  ALPHA_PARTICLE_CONFIG,
  calculateAlphaDamage 
} from '../../../scripts/features/towers/alphaTower.js';

// Playfield modules
import { GRID_SIZE } from '../constants.js';
```

**Path Rules:**
- From `playfield/` to `scripts/core/`: `../../../scripts/core/`
- From `playfield/` to `scripts/features/`: `../../../scripts/features/`
- From `playfield/managers/` to `playfield/`: `../../`

## Common Tasks

### Adding Tower Placement Validation
```javascript
// In TowerManager.js
isValidPosition(x, y, towerType) {
  // Check grid bounds
  if (x < 0 || y < 0 || x >= this.gridWidth || y >= this.gridHeight) {
    return false;
  }
  
  // Check for path collision
  if (this.isPathAt(x, y)) {
    return false;
  }
  
  // Check for existing tower
  if (this.hasTowerAt(x, y)) {
    return false;
  }
  
  // Check tower-specific placement rules
  if (towerType === 'fluid' && !this.isNearWater(x, y)) {
    return false;
  }
  
  return true;
}
```

### Adding HUD Display
```javascript
// In HudBindings.js
import { formatGameNumber } from '../../../scripts/core/formatting.js';

updateWaveDisplay(waveNumber, totalWaves) {
  const text = `Wave ${waveNumber}/${totalWaves}`;
  this.waveElement.textContent = text;
}

updateCoreHealthDisplay(current, max) {
  const percentage = (current / max) * 100;
  const formatted = formatGameNumber(current, 0);
  this.healthElement.textContent = formatted;
  this.healthBar.style.width = `${percentage}%`;
}
```

### Adding Input Handler
```javascript
// In InputController.js
handleTowerSelect(event) {
  const coords = this.getEventCoords(event);
  const gridPos = this.screenToGrid(coords.x, coords.y);
  
  const tower = this.towerManager.getTowerAt(gridPos.x, gridPos.y);
  if (tower) {
    // Show tower details panel
    this.hudBindings.showTowerDetailsPanel(tower);
    // Highlight tower range
    this.renderSystem.highlightTowerRange(tower);
  }
}
```

## Performance Optimization

### Avoid Frequent DOM Updates
```javascript
// Bad: Updates DOM on every frame
function gameLoop() {
  hudBindings.updateCurrencyDisplay(currency);
  hudBindings.updateHealthDisplay(health);
}

// Good: Updates only when values change
function gameLoop() {
  if (currency !== lastCurrency) {
    hudBindings.updateCurrencyDisplay(currency);
    lastCurrency = currency;
  }
}
```

### Cache DOM Queries
```javascript
// Bad: Queries DOM every time
updateHealth(health) {
  document.getElementById('health').textContent = health;
}

// Good: Caches reference in constructor
constructor() {
  this.healthElement = document.getElementById('health');
}

updateHealth(health) {
  this.healthElement.textContent = health;
}
```

### Throttle Input Events
```javascript
// Throttle mousemove for range preview
let lastMoveTime = 0;
const MOVE_THROTTLE = 16; // ~60fps

handleMouseMove(event) {
  const now = Date.now();
  if (now - lastMoveTime < MOVE_THROTTLE) return;
  lastMoveTime = now;
  
  // Process movement
  this.updateRangePreview(event);
}
```

## Mobile-First Considerations

### Touch Event Handling
```javascript
handleTouchEnd(event) {
  event.preventDefault(); // Prevent double-tap zoom
  
  const touch = event.changedTouches[0];
  const coords = this.getEventCoords(touch);
  
  // Check if tap (not drag)
  if (this.isTap(coords)) {
    this.handlePlacement(coords);
  }
}

isTap(coords) {
  // Tap threshold: 10px movement
  const dx = coords.x - this.touchStartX;
  const dy = coords.y - this.touchStartY;
  return Math.sqrt(dx*dx + dy*dy) < 10;
}
```

### Responsive Canvas Sizing
```javascript
resizeCanvas() {
  const container = this.canvas.parentElement;
  const containerWidth = container.clientWidth;
  
  // Maintain aspect ratio
  this.canvas.width = containerWidth;
  this.canvas.height = containerWidth * (9/16); // 16:9 landscape
  
  // Update grid scaling
  this.updateGridScale();
}
```

## Enemy Overlay Guidelines
- Enemies now render a compact debuff bar beneath their ring. Place debuff glyphs (e.g., ι, ρ, θ) side by side in the order they
  were first applied.
- Use `registerEnemyDebuff`, `resolveActiveDebuffTypes`, and `getEnemyDebuffIndicators` when adding new effects so the renderer
  inherits correct ordering.
- Visual accents like the ρ sparkle ring should be lightweight enough for fallback rendering and aligned to existing enemy
  metrics (use `getEnemyVisualMetrics`).

## Common Mistakes to Avoid

❌ **Don't** hardcode formulas in managers - import from tower modules
❌ **Don't** update DOM from managers - use HudBindings
❌ **Don't** forget to prevent default on touch events
❌ **Don't** query DOM repeatedly - cache references
❌ **Don't** mix business logic with rendering

✅ **Do** use tower calculation functions from `scripts/features/towers/`
✅ **Do** format all numbers through `scripts/core/formatting.js`
✅ **Do** separate concerns (manager/ui/input/render)
✅ **Do** test on mobile touch screens
✅ **Do** handle both touch and mouse events

## Testing Checklist

When modifying playfield systems:
- [ ] Tower placement works on mobile touch
- [ ] Tower placement works on desktop mouse
- [ ] Tower stats display with correct formatting
- [ ] Upgrade UI updates correctly
- [ ] Range visualization shows properly
- [ ] Input doesn't trigger unintended actions (double-tap zoom)
- [ ] Console shows no errors
- [ ] Mobile viewport (portrait) displays correctly

## Token Efficiency Tips

**For agents reading this:**
- Playfield subsystem handles all in-game interactions
- Managers do business logic, UI does rendering, Input does user interactions
- Always import tower calculations from `scripts/features/towers/`
- Never hardcode formulas or stat calculations
- HudBindings is the ONLY place that updates DOM elements
- InputController must handle both touch AND mouse events
- Path structure: up 3 levels (`../../../`) to reach `scripts/`
- Test mobile touch first, desktop mouse second
