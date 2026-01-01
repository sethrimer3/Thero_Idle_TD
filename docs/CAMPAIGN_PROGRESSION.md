# Campaign Progression System

## Overview

Thero Idle features multiple interconnected campaigns with a progression system that unlocks content based on completing story milestones.

## Campaign Types

### Story Campaign
The primary narrative campaign featuring six chapters plus a Prologue. Each chapter consists of:
- **Five combat levels** (numbered X-1 through X-5)
- **One story level** (numbered X-Story) at the end of each chapter

### Ladder Campaign
Endless versions of Story campaign levels that become available as chapters are completed. Each chapter in the Story campaign has a corresponding "chapter" in the Ladder campaign with endless versions of the same five combat levels.

### Trials/Challenges Campaign
Advanced challenge levels that test mastery of game mechanics. Unlocked after completing all six chapters of the Story campaign.

## Chapter Structure

The Story campaign is organized into six main chapters, each preceded by the Prologue:

### Prologue
- **Prologue - 1**: Mind Gate Project
- **Prologue - 2**: Stress Test
- **Prologue - 3**: Wavelength
- **Prologue - Story**: Consciousness (Story Level)

### Chapter 1: Conjecture Set
- **1 - 1**: Lemniscate Hypothesis
- **1 - 2**: Collatz Cascade
- **1 - 3**: Riemann Helix
- **1 - 4**: Twin Prime Fork
- **1 - 5**: Birch Flow
- **1 - Story**: Scholars and Friends (Story Level)

### Chapter 2: Corollary Set
- **2 - 1**: Trefoil
- **2 - 2**: Rose Curve
- **2 - 3**: Astroid
- **2 - 4**: Deltoid
- **2 - 5**: Nephroid
- **2 - Story**: [Title TBD] (Story Level)

### Chapter 3: Lemma Set
- **3 - 1**: Lissajous
- **3 - 2**: Epicycloid
- **3 - 3**: Hypocycloid
- **3 - 4**: Rhodonea
- **3 - 5**: Butterfly
- **3 - Story**: [Title TBD] (Story Level)

### Chapter 4: Proof Set
- **4 - 1**: Double Spiral
- **4 - 2**: Conchoid
- **4 - 3**: Cissoid
- **4 - 4**: Trisectrix
- **4 - 5**: Witch of Agnesi
- **4 - Story**: [Title TBD] (Story Level)

### Chapter 5: Theorem Set
- **5 - 1**: Serpentine
- **5 - 2**: Kampyle
- **5 - 3**: Folium
- **5 - 4**: Strophoid
- **5 - 5**: Cochleoid
- **5 - Story**: [Title TBD] (Story Level)

### Chapter 6: Axiom Set
- **6 - 1**: Tractrix
- **6 - 2**: Catenary
- **6 - 3**: Cycloid
- **6 - 4**: Involute
- **6 - 5**: Evolute
- **6 - Story**: [Title TBD] (Story Level)

## Story Level Mechanics

Story levels are narrative-focused levels that appear at the end of each chapter (and after the Prologue). They differ from combat levels:

- **No Combat**: Story levels have no enemies or waves
- **Narrative Focus**: Players read story content that advances the game's lore
- **Progression Gates**: Reading a story level marks it as complete and unlocks new content

### Story Level Properties

In gameplayConfig.json, story levels have these characteristics:
```json
{
  "isStoryLevel": true,
  "startThero": 0,
  "theroCap": 0,
  "theroPerKill": 0,
  "passiveTheroPerSecond": 0,
  "lives": 1,
  "waves": [],
  "rewardScore": 0,
  "rewardFlux": 0,
  "rewardThero": 0,
  "rewardEnergy": 0,
  "arcSpeed": 0.05,
  "path": [/* simple path */],
  "autoAnchors": []
}
```

## Unlocking Progression

### Initial State
- **Prologue - 1** is unlocked by default when starting a new game

### Prologue Completion
- Completing **Prologue - 3** unlocks **Prologue - Story**
- Reading **Prologue - Story** unlocks:
  - **Chapter 1** levels (1-1 through 1-5)
  - **Codex** tab
  - **Achievements** tab

### Chapter Story Level Unlocking
Each chapter's story level unlocks when the player completes the fifth level of that chapter:
- Completing **1 - 5** unlocks **1 - Story**
- Completing **2 - 5** unlocks **2 - Story**
- Completing **3 - 5** unlocks **3 - Story**
- Completing **4 - 5** unlocks **4 - Story**
- Completing **5 - 5** unlocks **5 - Story**
- Completing **6 - 5** unlocks **6 - Story**

### Reading Chapter Story Levels
When a player reads (completes) a chapter story level, two things happen:

1. **Next Chapter Unlocks**: The first level of the next chapter becomes available
   - Reading **1 - Story** unlocks **2 - 1** (and enables progression through Chapter 2)
   - Reading **2 - Story** unlocks **3 - 1** (and enables progression through Chapter 3)
   - Reading **3 - Story** unlocks **4 - 1** (and enables progression through Chapter 4)
   - Reading **4 - Story** unlocks **5 - 1** (and enables progression through Chapter 5)
   - Reading **5 - Story** unlocks **6 - 1** (and enables progression through Chapter 6)

2. **Ladder Campaign Chapter Unlocks**: The corresponding chapter in the Ladder campaign becomes available
   - Reading **1 - Story** unlocks **Chapter 1** in Ladder campaign (Ladder - 1-1 through Ladder - 1-5)
   - Reading **2 - Story** unlocks **Chapter 2** in Ladder campaign (Ladder - 2-1 through Ladder - 2-5)
   - Reading **3 - Story** unlocks **Chapter 3** in Ladder campaign (Ladder - 3-1 through Ladder - 3-5)
   - Reading **4 - Story** unlocks **Chapter 4** in Ladder campaign (Ladder - 4-1 through Ladder - 4-5)
   - Reading **5 - Story** unlocks **Chapter 5** in Ladder campaign (Ladder - 5-1 through Ladder - 5-5)

### Trials Campaign Unlock
- Reading **6 - Story** (the final story level) unlocks the entire **Trials/Challenges** campaign

## Implementation Details

### Story Content Location
Story text for each story level is stored in `assets/data/levelStories.json` with the following structure:
```json
{
  "1 - Story": {
    "title": "Scholars and Friends",
    "sections": [
      "Paragraph 1...",
      "Paragraph 2...",
      "Paragraph 3..."
    ]
  }
}
```

### Level Order
Story levels are integrated into the main level progression order in `interactiveLevelOrder`. They appear after the fifth level of each chapter in sequence.

### Unlock Logic
The unlock logic is handled in `assets/main.js` in the story completion handler. When a story level is marked as completed, it triggers:
1. `unlockNextInteractiveLevel()` to unlock the next level in sequence
2. Special unlock logic for Ladder campaign chapters (based on which story level was completed)
3. Special unlock logic for Trials campaign (when 6-Story is completed)

## Future Considerations

- Additional chapters may be added following the same pattern
- Story content can be expanded with more narrative depth
- Ladder and Trials campaigns may receive additional content as chapters are added
