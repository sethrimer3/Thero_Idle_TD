# Agent Start Here – Universal Navigation

**Welcome to Thero Idle.** This is your entry point for efficient context loading.

## First-Time Setup

1. **Read this file** to understand navigation structure
2. **Read `/AGENTS.md`** for project vision and conventions
3. **Navigate to task-specific agent.md** based on your work area

## Task-Based Routing

### "I'm working on..."

| Your Task | Read These (in order) |
|-----------|----------------------|
| **Game loop, main integration** | `assets/agent.md` → `assets/main.js` |
| **Tower mechanics or balance** | `scripts/features/towers/agent.md` → `scripts/features/towers/TOWER_INDEX.md` |
| **Number formatting or math rendering** | `scripts/core/agent.md` |
| **UI systems (tower selection, HUD)** | `assets/agent.md` (see UI Systems section) |
| **Enemy or level design** | `assets/agent.md` → `/docs/PROGRESSION.md` |
| **Playfield systems** | `assets/playfield/agent.md` |
| **Documentation updates** | `docs/agent.md` |
| **Module organization** | `scripts/agent.md` → `/docs/JAVASCRIPT_MODULE_SYSTEM.md` |

### "I need to understand..."

| Topic | Best Resource |
|-------|---------------|
| Project vision & aesthetics | `/AGENTS.md` |
| Mobile-first approach | `/docs/PLATFORM_SUPPORT.md` |
| Game progression & formulas | `/docs/PROGRESSION.md` |
| Module dependencies | `/docs/JAVASCRIPT_MODULE_SYSTEM.md` |
| All implemented towers | `scripts/features/towers/TOWER_INDEX.md` |

## Quick Reference Cards

### Essential Principles
- **Mobile-first:** Test portrait orientation on mobile viewport first
- **Minimal changes:** Smallest possible edits to achieve goals
- **No build step:** Open `index.html` directly to test
- **ES6 modules:** Explicit imports only
- **Mathematical theme:** Greek letters, scholarly fonts
- **Build tracking:** Increment `assets/buildInfo.js#BUILD_NUMBER` by 1 for every change and start reports with the updated build number.

### Directory Structure
```
Thero_Idle_TD/
├── assets/               # Main game loop, UI, resources
│   ├── main.js          # Integration hub (wiring only)
│   └── playfield/       # Playfield subsystems
├── scripts/
│   ├── core/            # Formatting, mathText utilities
│   └── features/towers/ # Tower implementations (α,β,γ...)
├── docs/                # Design documents
└── AGENTS.md            # Main guide (read this!)
```

### Testing Workflow
1. Open `index.html` in browser
2. Check console for errors
3. Test on mobile viewport (portrait)
4. Verify mathematical formulas
5. Ensure theme consistency

## Navigation Hierarchy

**Top-level guides:**
- `/AGENTS.md` - Master guide with vision and conventions
- `/AGENT_START_HERE.md` - This file (universal navigation)
- `.github/copilot-instructions.md` - Quick reference redirect

**Context-specific agent.md files:**
- `assets/agent.md` - Game loop and integration
- `scripts/agent.md` - Module organization
- `scripts/core/agent.md` - Core utilities
- `scripts/features/towers/agent.md` - Tower patterns
- `docs/agent.md` - Documentation standards

**Quick reference files:**
- `scripts/features/towers/TOWER_INDEX.md` - Tower lookup table

## Common Workflows

### Adding a New Tower
1. Read: `scripts/features/towers/agent.md`
2. Reference: `scripts/features/towers/TOWER_INDEX.md`
3. Template: `scripts/features/towers/betaTower.js`
4. Update: `docs/PROGRESSION.md` with formulas

### Modifying Game Balance
1. Read: `assets/agent.md` (Configuration section)
2. Edit: `assets/data/gameplayConfig.json`
3. Or: Tower module for formula changes
4. Document: Update `docs/PROGRESSION.md`

### Working with UI
1. Read: `assets/agent.md` (UI Systems section)
2. Files: `towersTab.js`, `achievementsTab.js`, etc.
3. Style: Maintain monochrome palette, scholarly fonts
4. Test: Mobile viewport first

### Core Utilities
1. Read: `scripts/core/agent.md`
2. Number formatting: `scripts/core/formatting.js`
3. Math rendering: `scripts/core/mathText.js`
4. Pattern: Import specific functions, not entire modules

## Anti-Patterns (Don't Do This)

❌ Add game logic to `assets/main.js` (delegate to feature modules)  
❌ Skip reading context-specific agent.md before editing  
❌ Create circular dependencies between features  
❌ Hardcode values (use `configuration.js`)  
❌ Test on desktop only (mobile-first)  
❌ Skip documenting mathematical formulas  

## Token Efficiency Tips

- This file prevents circular reading of all docs
- Jump directly to your work area's agent.md
- Use tables for quick lookups
- Reference code examples in actual files
- Avoid re-reading general context repeatedly

---

**Ready to start?** Pick your task from the routing table above and navigate to the appropriate agent.md file.
