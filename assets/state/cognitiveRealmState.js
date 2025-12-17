// Cognitive Realm Territories - State management for the abstract territory map.
// This module tracks which territories are controlled by the player versus enemies.

// Territory grid dimensions (abstract map layout)
const TERRITORY_GRID_WIDTH = 12;
const TERRITORY_GRID_HEIGHT = 8;

// Territory ownership states
export const TERRITORY_NEUTRAL = 0;
export const TERRITORY_PLAYER = 1;
export const TERRITORY_ENEMY = 2;

// Territory conquest probabilities (for spreading influence on victory)
const CONQUEST_CHANCE_FROM_ENEMY = 0.5; // 50% chance to convert adjacent enemy territories
const CONQUEST_CHANCE_FROM_NEUTRAL = 0.3; // 30% chance to convert adjacent neutral territories

// Initialize the cognitive realm state with a grid of territories.
// Each territory has an id, position, and ownership state.
function createInitialTerritories() {
  const territories = [];
  for (let y = 0; y < TERRITORY_GRID_HEIGHT; y++) {
    for (let x = 0; x < TERRITORY_GRID_WIDTH; x++) {
      territories.push({
        id: `territory-${x}-${y}`,
        x,
        y,
        owner: TERRITORY_NEUTRAL,
        // Add some visual variety - territories can be different abstract shapes
        shapeType: Math.floor(Math.random() * 4), // 0=circle, 1=triangle, 2=square, 3=polygon
      });
    }
  }
  return territories;
}

// Cognitive realm state container
export const cognitiveRealmState = {
  unlocked: false,
  territories: createInitialTerritories(),
  lastLevelCompleted: null,
};

// Check if the cognitive realm map should be visible
export function isCognitiveRealmUnlocked() {
  return cognitiveRealmState.unlocked;
}

// Unlock the cognitive realm (called when player reaches level set 3)
export function unlockCognitiveRealm() {
  cognitiveRealmState.unlocked = true;
}

// Get all territories
export function getTerritories() {
  return cognitiveRealmState.territories;
}

// Get a specific territory by coordinates
export function getTerritory(x, y) {
  return cognitiveRealmState.territories.find((t) => t.x === x && t.y === y);
}

// Update territory ownership based on level completion
// Victory conquers territories, defeat loses them
export function updateTerritoriesForLevel(levelId, victory) {
  // Extract level number from levelId (e.g., "level-01-epsilon-loop" -> 1)
  const levelMatch = levelId.match(/level-(\d+)/);
  if (!levelMatch) {
    return;
  }
  
  const levelNum = parseInt(levelMatch[1], 10);
  cognitiveRealmState.lastLevelCompleted = levelId;
  
  // Simple algorithm: each level affects nearby territories
  // Level number determines which territories are affected
  const territoryIndex = levelNum % cognitiveRealmState.territories.length;
  const territory = cognitiveRealmState.territories[territoryIndex];
  
  if (territory) {
    territory.owner = victory ? TERRITORY_PLAYER : TERRITORY_ENEMY;
    
    // Expand influence to adjacent territories for victories
    if (victory) {
      const adjacentOffsets = [
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      ];
      
      adjacentOffsets.forEach((offset) => {
        const adjX = territory.x + offset.dx;
        const adjY = territory.y + offset.dy;
        const adjacent = getTerritory(adjX, adjY);
        
        // Convert enemy territories to player control with configured probability
        if (adjacent && adjacent.owner === TERRITORY_ENEMY && Math.random() < CONQUEST_CHANCE_FROM_ENEMY) {
          adjacent.owner = TERRITORY_PLAYER;
        } else if (adjacent && adjacent.owner === TERRITORY_NEUTRAL && Math.random() < CONQUEST_CHANCE_FROM_NEUTRAL) {
          adjacent.owner = TERRITORY_PLAYER;
        }
      });
    }
  }
}

// Reset all territories to neutral (for testing or new game)
export function resetTerritories() {
  cognitiveRealmState.territories.forEach((territory) => {
    territory.owner = TERRITORY_NEUTRAL;
  });
}

// Get territory statistics for display
export function getTerritoryStats() {
  const stats = {
    total: cognitiveRealmState.territories.length,
    player: 0,
    enemy: 0,
    neutral: 0,
  };
  
  cognitiveRealmState.territories.forEach((territory) => {
    if (territory.owner === TERRITORY_PLAYER) {
      stats.player++;
    } else if (territory.owner === TERRITORY_ENEMY) {
      stats.enemy++;
    } else {
      stats.neutral++;
    }
  });
  
  return stats;
}

// Serialize state for persistence
export function serializeCognitiveRealmState() {
  return {
    unlocked: cognitiveRealmState.unlocked,
    territories: cognitiveRealmState.territories.map((t) => ({
      id: t.id,
      x: t.x,
      y: t.y,
      owner: t.owner,
      shapeType: t.shapeType,
    })),
    lastLevelCompleted: cognitiveRealmState.lastLevelCompleted,
  };
}

// Deserialize state from persistence
export function deserializeCognitiveRealmState(data) {
  if (!data || typeof data !== 'object') {
    return;
  }
  
  if (typeof data.unlocked === 'boolean') {
    cognitiveRealmState.unlocked = data.unlocked;
  }
  
  if (Array.isArray(data.territories)) {
    cognitiveRealmState.territories = data.territories.map((t) => ({
      id: t.id,
      x: Number.isFinite(t.x) ? t.x : 0,
      y: Number.isFinite(t.y) ? t.y : 0,
      owner: Number.isFinite(t.owner) ? t.owner : TERRITORY_NEUTRAL,
      shapeType: Number.isFinite(t.shapeType) ? t.shapeType : 0,
    }));
  }
  
  if (typeof data.lastLevelCompleted === 'string') {
    cognitiveRealmState.lastLevelCompleted = data.lastLevelCompleted;
  }
}

// Grid dimensions getters for rendering
export function getGridDimensions() {
  return {
    width: TERRITORY_GRID_WIDTH,
    height: TERRITORY_GRID_HEIGHT,
  };
}
