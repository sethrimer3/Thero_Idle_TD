// Cognitive Realm Territories - State management for the abstract territory map.
// This module tracks which territories are controlled by the player versus enemies.
// The cognitive realm represents the "collective unconscious" with Jungian archetype nodes.

// Callback to notify when territories change ownership
let onTerritoriesChangedCallback = null;

export function setOnTerritoriesChanged(callback) {
  onTerritoriesChangedCallback = callback;
}

function notifyTerritoriesChanged() {
  if (onTerritoriesChangedCallback) {
    onTerritoriesChangedCallback();
  }
}

// Jungian Archetypes - Each major node represents an archetype with positive and negative expressions
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
  },
  {
    id: 'caregiver',
    positive: {
      name: 'Caregiver (Stewardship)',
      description: 'Protection through support, generosity, sustaining care'
    },
    negative: {
      name: 'Rescuer (Control)',
      description: 'Smothering help, martyrdom, obligation as a chain'
    }
  },
  {
    id: 'creator',
    positive: {
      name: 'Creator (Imagination)',
      description: 'Craft, artistry, deliberate shaping of possibility'
    },
    negative: {
      name: 'Perfectionist Creator',
      description: 'Paralysis, endless revisions, rejecting finished work'
    }
  },
  {
    id: 'ruler',
    positive: {
      name: 'Ruler (Order)',
      description: 'Structure, stewardship, responsible power'
    },
    negative: {
      name: 'Tyrant Ruler',
      description: 'Domination, paranoia, brittle hierarchy'
    }
  },
  {
    id: 'magician',
    positive: {
      name: 'Magician (Transformative Insight)',
      description: 'Pattern alchemy, symbolic fluency, catalytic change'
    },
    negative: {
      name: 'Manipulator Magician',
      description: 'Sleight of hand, coercion, secrecy for control'
    }
  },
  {
    id: 'lover',
    positive: {
      name: 'Lover (Attachment)',
      description: 'Union, intimacy, devoted connection to life'
    },
    negative: {
      name: 'Obsessive Lover',
      description: 'Possession, jealousy, dissolving personal boundaries'
    }
  },
  {
    id: 'explorer',
    positive: {
      name: 'Explorer (Frontier)',
      description: 'Curiosity, risk embraced, movement toward the unknown'
    },
    negative: {
      name: 'Wanderer (Escape)',
      description: 'Aimless drifting, fleeing commitments, rootlessness'
    }
  },
  {
    id: 'sage',
    positive: {
      name: 'Sage (Clarity)',
      description: 'Perception, synthesis, guiding through understanding'
    },
    negative: {
      name: 'Cynical Sage',
      description: 'Detachment, superiority, insight that freezes action'
    }
  },
  {
    id: 'warrior',
    positive: {
      name: 'Warrior (Boundaries)',
      description: 'Protection, discipline, courage in defense of values'
    },
    negative: {
      name: 'Warmonger',
      description: 'Aggression for its own sake, domination by force'
    }
  },
  {
    id: 'rebel',
    positive: {
      name: 'Rebel (Liberation)',
      description: 'Challenging stagnation, reforming unjust systems'
    },
    negative: {
      name: 'Anarchic Rebel',
      description: 'Destruction without vision, perpetual revolt'
    }
  },
  {
    id: 'innocent',
    positive: {
      name: 'Innocent (Trust)',
      description: 'Faith, simplicity, willingness to begin again'
    },
    negative: {
      name: 'Naive Innocent',
      description: 'Denial, gullibility, refusal to see shadow'
    }
  },
  {
    id: 'orphan',
    positive: {
      name: 'Orphan (Belonging)',
      description: 'Solidarity, realism, bonding through shared humanity'
    },
    negative: {
      name: 'Forsaken Orphan',
      description: 'Alienation, distrust, self-erasure to be accepted'
    }
  },
  {
    id: 'jester',
    positive: {
      name: 'Jester (Levity)',
      description: 'Playful truth-telling, disarming humor, perspective'
    },
    negative: {
      name: 'Mocking Jester',
      description: 'Derision, distraction, cruelty masked as comedy'
    }
  },
  {
    id: 'mentor',
    positive: {
      name: 'Mentor (Transfer of Wisdom)',
      description: 'Teaching, sponsorship, guarding the learning path'
    },
    negative: {
      name: 'Gatekeeping Mentor',
      description: 'Hoarding knowledge, favoritism, freezing apprentices'
    }
  },
  {
    id: 'seeker',
    positive: {
      name: 'Seeker (Orientation)',
      description: 'Pilgrimage, attentive searching, recalibration of goals'
    },
    negative: {
      name: 'Restless Seeker',
      description: 'Perpetual dissatisfaction, endless chasing of novelty'
    }
  },
  {
    id: 'alchemist',
    positive: {
      name: 'Alchemist (Integration)',
      description: 'Refinement, turning wounds into medicine, synthesis'
    },
    negative: {
      name: 'Poison Alchemist',
      description: 'Manipulating transformations for control or spectacle'
    }
  },
  {
    id: 'pilgrim',
    positive: {
      name: 'Pilgrim (Meaningful Passage)',
      description: 'Humility on the road, sacred travel, perspective shifts'
    },
    negative: {
      name: 'Lost Pilgrim',
      description: 'Stagnant wandering, clinging to distant horizons'
    }
  },
  {
    id: 'visionary',
    positive: {
      name: 'Visionary (Foresight)',
      description: 'Imaginative planning, future-sensing, guiding light'
    },
    negative: {
      name: 'Delusional Visionary',
      description: 'Untethered schemes, ignoring present realities'
    }
  },
  {
    id: 'guardian',
    positive: {
      name: 'Guardian (Threshold)',
      description: 'Protection of sacred spaces, discernment, holding ground'
    },
    negative: {
      name: 'Warden Guardian',
      description: 'Gatekeeping, exclusion, punishing challenges to borders'
    }
  }
];

// Emotion constellations - 27 pairs expanded into 54 minor emotional nodes
const EMOTION_PAIRS = [
  { pairId: 'hope-despair', positive: { id: 'hope', name: 'Hope', description: 'Upward orientation, reasons to act' }, negative: { id: 'despair', name: 'Despair', description: 'Collapsed expectancy, heaviness' } },
  { pairId: 'joy-sorrow', positive: { id: 'joy', name: 'Joy', description: 'Radiant gladness, bright engagement' }, negative: { id: 'sorrow', name: 'Sorrow', description: 'Grief, honoring what was lost' } },
  { pairId: 'courage-fear', positive: { id: 'courage', name: 'Courage', description: 'Stepping forward despite uncertainty' }, negative: { id: 'fear', name: 'Fear', description: 'Contracting, pausing for safety' } },
  { pairId: 'trust-distrust', positive: { id: 'trust', name: 'Trust', description: 'Leaning into connection and reliance' }, negative: { id: 'distrust', name: 'Distrust', description: 'Guarded vigilance, braced for harm' } },
  { pairId: 'serenity-dread', positive: { id: 'serenity', name: 'Serenity', description: 'Wide-open calm, steady breathing' }, negative: { id: 'dread', name: 'Dread', description: 'Storm of anticipation, looming weight' } },
  { pairId: 'gratitude-resentment', positive: { id: 'gratitude', name: 'Gratitude', description: 'Receiving with appreciation' }, negative: { id: 'resentment', name: 'Resentment', description: 'Heat from perceived unfairness' } },
  { pairId: 'compassion-apathy', positive: { id: 'compassion', name: 'Compassion', description: 'Soft empathy, moving toward healing' }, negative: { id: 'apathy', name: 'Apathy', description: 'Numb withdrawal, unmoved by signals' } },
  { pairId: 'curiosity-boredom', positive: { id: 'curiosity', name: 'Curiosity', description: 'Spark toward discovery, active wondering' }, negative: { id: 'boredom', name: 'Boredom', description: 'Listless disengagement, flatness' } },
  { pairId: 'confidence-shame', positive: { id: 'confidence', name: 'Confidence', description: 'Inner steadiness, felt capability' }, negative: { id: 'shame', name: 'Shame', description: 'Collapse inward, self-attack' } },
  { pairId: 'patience-impulsivity', positive: { id: 'patience', name: 'Patience', description: 'Measured timing, readiness to wait' }, negative: { id: 'impulsivity', name: 'Impulsivity', description: 'Unfiltered action, leaping without rhythm' } },
  { pairId: 'determination-avoidance', positive: { id: 'determination', name: 'Determination', description: 'Grounded commitment, steady push' }, negative: { id: 'avoidance', name: 'Avoidance', description: 'Side-stepping effort, fleeing friction' } },
  { pairId: 'wonder-cynicism', positive: { id: 'wonder', name: 'Wonder', description: 'Awe-struck openness, sense of magic' }, negative: { id: 'cynicism', name: 'Cynicism', description: 'Dismissal, armored disbelief' } },
  { pairId: 'empathy-indifference', positive: { id: 'empathy', name: 'Empathy', description: 'Feeling-with, attuning to nuance' }, negative: { id: 'indifference', name: 'Indifference', description: 'Flat detachment, signals ignored' } },
  { pairId: 'enthusiasm-ennui', positive: { id: 'enthusiasm', name: 'Enthusiasm', description: 'Charged engagement, eager sparks' }, negative: { id: 'ennui', name: 'Ennui', description: 'Heavy listlessness, nothing satisfies' } },
  { pairId: 'tenderness-cruelty', positive: { id: 'tenderness', name: 'Tenderness', description: 'Gentle care, nuanced sensitivity' }, negative: { id: 'cruelty', name: 'Cruelty', description: 'Harm delivered coldly, hard edges' } },
  { pairId: 'reverence-disdain', positive: { id: 'reverence', name: 'Reverence', description: 'Sacred regard, honoring the fragile' }, negative: { id: 'disdain', name: 'Disdain', description: 'Looking down, dismissing value' } },
  { pairId: 'clarity-confusion', positive: { id: 'clarity', name: 'Clarity', description: 'Focused seeing, crisp sense-making' }, negative: { id: 'confusion', name: 'Confusion', description: 'Fogged signals, scattered attention' } },
  { pairId: 'awe-arrogance', positive: { id: 'awe', name: 'Awe', description: 'Humbled expansion, breath-catching vastness' }, negative: { id: 'arrogance', name: 'Arrogance', description: 'Inflated certainty, shutting input out' } },
  { pairId: 'trustworthiness-suspicion', positive: { id: 'trustworthiness', name: 'Trustworthiness', description: 'Steady reliability, earned reliance' }, negative: { id: 'suspicion', name: 'Suspicion', description: 'Scanning for threat, tightening grip' } },
  { pairId: 'equanimity-irritation', positive: { id: 'equanimity', name: 'Equanimity', description: 'Balanced center, steady breath' }, negative: { id: 'irritation', name: 'Irritation', description: 'Prickly agitation, minor storms' } },
  { pairId: 'radiance-resentful-withdrawal', positive: { id: 'radiance', name: 'Radiance', description: 'Warmth that spreads, luminous presence' }, negative: { id: 'withdrawal', name: 'Withdrawal', description: 'Pulling back light, isolating to protect' } },
  { pairId: 'focus-distraction', positive: { id: 'focus', name: 'Focus', description: 'Single-threaded attention, aligned action' }, negative: { id: 'distraction', name: 'Distraction', description: 'Fragmented attention, scattering' } },
  { pairId: 'humility-pride', positive: { id: 'humility', name: 'Humility', description: 'Listening stance, grounded self-view' }, negative: { id: 'pride', name: 'Pride', description: 'Inflated posture, brittle self-importance' } },
  { pairId: 'stability-anxiety', positive: { id: 'stability', name: 'Stability', description: 'Rootedness, dependable footing' }, negative: { id: 'anxiety', name: 'Anxiety', description: 'Fluttering nerves, impending worry' } },
  { pairId: 'playfulness-rigidity', positive: { id: 'playfulness', name: 'Playfulness', description: 'Light experimentation, improvisation' }, negative: { id: 'rigidity', name: 'Rigidity', description: 'Locked patterns, refusal to flex' } },
  { pairId: 'steadfastness-doubt', positive: { id: 'steadfastness', name: 'Steadfastness', description: 'Loyal presence, consistent pulse' }, negative: { id: 'doubt', name: 'Doubt', description: 'Second-guessing, undermined footing' } },
  { pairId: 'mercy-judgment', positive: { id: 'mercy', name: 'Mercy', description: 'Softened verdicts, chance to repair' }, negative: { id: 'judgment', name: 'Judgment', description: 'Harsh appraisal, fixation on faults' } },
  { pairId: 'zest-emptiness', positive: { id: 'zest', name: 'Zest', description: 'Vibrant appetite for life, kinetic charge' }, negative: { id: 'emptiness', name: 'Emptiness', description: 'Hollow quiet, absence of spark' } }
];

// Pre-expanded emotion nodes so each word is its own minor node
const EMOTION_NODES = EMOTION_PAIRS.flatMap((pair) => ([
  {
    id: `${pair.positive.id}-positive`,
    name: pair.positive.name,
    description: pair.positive.description,
    polarity: 'positive',
    counterpart: pair.negative.name,
    pairId: pair.pairId,
  },
  {
    id: `${pair.negative.id}-negative`,
    name: pair.negative.name,
    description: pair.negative.description,
    polarity: 'negative',
    counterpart: pair.positive.name,
    pairId: pair.pairId,
  }
]));

// Territory grid dimensions (abstract map layout) - 9x9 grid for 81 total nodes
const TERRITORY_GRID_WIDTH = 9;
const TERRITORY_GRID_HEIGHT = 9;
const TOTAL_TERRITORIES = TERRITORY_GRID_WIDTH * TERRITORY_GRID_HEIGHT;

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
  let emotionIndex = 0;

  for (let y = 0; y < TERRITORY_GRID_HEIGHT; y++) {
    for (let x = 0; x < TERRITORY_GRID_WIDTH; x++) {
      const isArchetypeNode = (x + y) % 3 === 0; // Every third cell becomes a major archetype anchor
      const archetype = ARCHETYPES[archetypeIndex % ARCHETYPES.length];
      const emotion = EMOTION_NODES[emotionIndex % EMOTION_NODES.length];

      territories.push({
        id: `territory-${x}-${y}`,
        x,
        y,
        owner: TERRITORY_NEUTRAL,
        nodeType: isArchetypeNode ? 'archetype' : 'emotion',
        archetype: isArchetypeNode ? archetype : null,
        emotion: isArchetypeNode ? null : emotion,
      });

      if (isArchetypeNode) {
        archetypeIndex++;
      } else {
        emotionIndex++;
      }
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
    
    // Notify that territories have changed
    notifyTerritoriesChanged();
  }
}

// Reset all territories to neutral (for testing or new game)
export function resetTerritories() {
  cognitiveRealmState.territories.forEach((territory) => {
    territory.owner = TERRITORY_NEUTRAL;
  });
  
  // Notify that territories have changed
  notifyTerritoriesChanged();
}

// Set a specific territory's owner (for developer mode cycling)
export function setTerritoryOwner(territoryId, owner) {
  const territory = cognitiveRealmState.territories.find((t) => t.id === territoryId);
  if (territory) {
    territory.owner = owner;
    // Notify that territories have changed
    notifyTerritoriesChanged();
  }
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
      nodeType: t.nodeType || (t.archetype ? 'archetype' : 'emotion'),
      archetypeId: t.archetype ? t.archetype.id : null,
      emotionId: t.emotion ? t.emotion.id : null,
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

  if (Array.isArray(data.territories) && data.territories.length === TOTAL_TERRITORIES) {
    cognitiveRealmState.territories = data.territories.map((t, index) => {
      const savedNodeType = t.nodeType || (t.archetypeId ? 'archetype' : 'emotion');

      // Find archetype or emotion by ID, or use index as fallback
      const archetype = savedNodeType === 'archetype'
        ? (t.archetypeId
          ? ARCHETYPES.find(a => a.id === t.archetypeId) || ARCHETYPES[index % ARCHETYPES.length]
          : ARCHETYPES[index % ARCHETYPES.length])
        : null;

      const emotion = savedNodeType === 'emotion'
        ? (t.emotionId
          ? EMOTION_NODES.find(e => e.id === t.emotionId) || EMOTION_NODES[index % EMOTION_NODES.length]
          : EMOTION_NODES[index % EMOTION_NODES.length])
        : null;

      return {
        id: t.id,
        x: Number.isFinite(t.x) ? t.x : 0,
        y: Number.isFinite(t.y) ? t.y : 0,
        owner: Number.isFinite(t.owner) ? t.owner : TERRITORY_NEUTRAL,
        nodeType: savedNodeType,
        archetype: archetype,
        emotion: emotion,
      };
    });
  } else {
    // Fallback: initialize a fresh grid when older saves don't match the expanded layout
    cognitiveRealmState.territories = createInitialTerritories();
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
