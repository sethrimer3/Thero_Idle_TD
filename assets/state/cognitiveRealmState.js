// Cognitive Realm Territories - State management for the abstract territory map.
// This module tracks which territories are controlled by the player versus enemies.
// The cognitive realm represents the "collective unconscious" with Jungian archetype nodes.

// Jungian Archetypes - Each node represents an archetype with positive and negative expressions
export const ARCHETYPES = [
  {
    id: 'self',
    positive: {
      name: 'Self (Integrated Wholeness)',
      description: 'Balance, coherence, harmony between systems'
    },
    negative: {
      name: 'Fragmented Self (Disintegration)',
      description: 'Chaos, dissociation, system collapse'
    }
  },
  {
    id: 'hero',
    positive: {
      name: 'Hero (Purposeful Agency)',
      description: 'Courage, forward motion, meaningful struggle'
    },
    negative: {
      name: 'Tyrant / Martyr Hero',
      description: 'Obsession, self-destruction, domination'
    }
  },
  {
    id: 'shadow',
    positive: {
      name: 'Shadow (Acknowledged Instinct)',
      description: 'Honesty, vitality, grounded power'
    },
    negative: {
      name: 'Shadow (Possession)',
      description: 'Rage, compulsion, unchecked aggression'
    }
  },
  {
    id: 'persona',
    positive: {
      name: 'Persona (Social Adaptability)',
      description: 'Healthy communication, cooperation, role-flexibility'
    },
    negative: {
      name: 'Persona (False Self)',
      description: 'Emptiness, conformity, loss of authenticity'
    }
  },
  {
    id: 'anima-animus',
    positive: {
      name: 'Anima / Animus (Inner Integration)',
      description: 'Emotional intelligence, relational depth, intuition'
    },
    negative: {
      name: 'Anima / Animus (Projection)',
      description: 'Dependency, idealization, emotional volatility'
    }
  },
  {
    id: 'great-mother',
    positive: {
      name: 'Great Mother (Nurturance)',
      description: 'Healing, growth, protection, regeneration'
    },
    negative: {
      name: 'Devouring Mother',
      description: 'Smothering control, stagnation, dependency'
    }
  },
  {
    id: 'wise-elder',
    positive: {
      name: 'Wise Elder (Guidance)',
      description: 'Insight, pattern recognition, long-range understanding'
    },
    negative: {
      name: 'Dogmatic Elder',
      description: 'Rigidity, dead tradition, resistance to change'
    }
  },
  {
    id: 'child',
    positive: {
      name: 'Child (Potential)',
      description: 'Creativity, curiosity, openness to change'
    },
    negative: {
      name: 'Abandoned Child',
      description: 'Fear, helplessness, regression'
    }
  },
  {
    id: 'trickster',
    positive: {
      name: 'Trickster (Transformative Play)',
      description: 'Innovation, humor, breaking stagnation'
    },
    negative: {
      name: 'Trickster (Sabotage)',
      description: 'Nihilism, deception, rule-breaking without meaning'
    }
  }
];

// Territory grid dimensions (abstract map layout) - 3x3 grid for 9 archetypes
const TERRITORY_GRID_WIDTH = 3;
const TERRITORY_GRID_HEIGHT = 3;

// Territory ownership states
export const TERRITORY_NEUTRAL = 0;
export const TERRITORY_PLAYER = 1;
export const TERRITORY_ENEMY = 2;

// Territory conquest probabilities (for spreading influence on victory)
const CONQUEST_CHANCE_FROM_ENEMY = 0.5; // 50% chance to convert adjacent enemy territories
const CONQUEST_CHANCE_FROM_NEUTRAL = 0.3; // 30% chance to convert adjacent neutral territories

// Initialize the cognitive realm state with a grid of territories.
// Each territory represents a Jungian archetype node.
function createInitialTerritories() {
  const territories = [];
  let archetypeIndex = 0;
  
  for (let y = 0; y < TERRITORY_GRID_HEIGHT; y++) {
    for (let x = 0; x < TERRITORY_GRID_WIDTH; x++) {
      const archetype = ARCHETYPES[archetypeIndex];
      territories.push({
        id: `territory-${x}-${y}`,
        x,
        y,
        owner: TERRITORY_NEUTRAL,
        archetype: archetype,
      });
      archetypeIndex++;
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
      archetypeId: t.archetype ? t.archetype.id : null,
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
    cognitiveRealmState.territories = data.territories.map((t, index) => {
      // Find archetype by ID, or use index as fallback
      const archetype = t.archetypeId 
        ? ARCHETYPES.find(a => a.id === t.archetypeId) || ARCHETYPES[index % ARCHETYPES.length]
        : ARCHETYPES[index % ARCHETYPES.length];
      
      return {
        id: t.id,
        x: Number.isFinite(t.x) ? t.x : 0,
        y: Number.isFinite(t.y) ? t.y : 0,
        owner: Number.isFinite(t.owner) ? t.owner : TERRITORY_NEUTRAL,
        archetype: archetype,
      };
    });
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
