// Shared enemy utilities and mote gem state management for Thero Idle.
// Enemy defeats now have a chance to mint crystalline mote gems, each with its own
// rarity tier, palette, and mote payload. This module centralizes the rarity rolls
// so the playfield can focus on orchestration while keeping the powder bridge
// informed about how many motes to dispense when the crystals are collected.

// Track mote gem drops, inventory totals, and the upgrade-driven auto collector.
export const moteGemState = {
  active: [],
  nextId: 1,
  inventory: new Map(),
  autoCollectUnlocked: false,
};

// Gem definitions ordered from most common to rarest. Each entry includes the
// base drop probability, mote size multiplier, and display palette so that the
// powder view and inventory can stay perfectly synchronized.
export const GEM_DEFINITIONS = [
  {
    id: 'quartz',
    name: 'Quartz',
    dropChance: 0.1,
    moteSize: 2,
    color: { hue: 18, saturation: 16, lightness: 86 },
    // Reference the quartz sprite so UI surfaces can render the correct crystal art.
    sprite: './assets/sprites/quartz.png',
  },
  {
    id: 'ruby',
    name: 'Ruby',
    dropChance: 0.01,
    moteSize: 3,
    color: { hue: 350, saturation: 74, lightness: 48 },
    // Reference the ruby sprite so UI surfaces can render the correct crystal art.
    sprite: './assets/sprites/ruby.png',
  },
  {
    id: 'sunstone',
    name: 'Sunstone',
    dropChance: 0.001,
    moteSize: 4,
    color: { hue: 28, saturation: 78, lightness: 56 },
    // Reference the sunstone sprite so UI surfaces can render the correct crystal art.
    sprite: './assets/sprites/sunstone.png',
  },
  {
    id: 'citrine',
    name: 'Citrine',
    dropChance: 0.0001,
    moteSize: 5,
    color: { hue: 48, saturation: 78, lightness: 60 },
    // Reference the citrine sprite so UI surfaces can render the correct crystal art.
    sprite: './assets/sprites/citrine.png',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    dropChance: 0.00001,
    moteSize: 6,
    color: { hue: 140, saturation: 64, lightness: 44 },
    // Reference the emerald sprite so UI surfaces can render the correct crystal art.
    sprite: './assets/sprites/emerald.png',
  },
  {
    id: 'sapphire',
    name: 'Sapphire',
    dropChance: 0.000001,
    moteSize: 7,
    color: { hue: 210, saturation: 72, lightness: 52 },
    // Reference the sapphire sprite so UI surfaces can render the correct crystal art.
    sprite: './assets/sprites/sapphire.png',
  },
  {
    id: 'iolite',
    name: 'Iolite',
    dropChance: 0.0000001,
    moteSize: 8,
    color: { hue: 255, saturation: 52, lightness: 50 },
    // Reference the iolite sprite so UI surfaces can render the correct crystal art.
    sprite: './assets/sprites/iolite.png',
  },
  {
    id: 'amethyst',
    name: 'Amethyst',
    dropChance: 0.00000001,
    moteSize: 9,
    color: { hue: 280, saturation: 60, lightness: 55 },
    // Reference the amethyst sprite so UI surfaces can render the correct crystal art.
    sprite: './assets/sprites/amethyst.png',
  },
  {
    id: 'diamond',
    name: 'Diamond',
    dropChance: 0.000000001,
    moteSize: 10,
    color: { hue: 200, saturation: 12, lightness: 92 },
    // Reference the diamond sprite so UI surfaces can render the correct crystal art.
    sprite: './assets/sprites/diamond.png',
  },
  {
    id: 'nullstone',
    name: 'Nullstone',
    dropChance: 0.0000000001,
    moteSize: 11,
    color: { hue: 210, saturation: 10, lightness: 14 },
    // Reference the nullstone sprite so UI surfaces can render the correct crystal art.
    sprite: './assets/sprites/nullstone.png',
  },
];

const GEM_LOOKUP = new Map(GEM_DEFINITIONS.map((gem) => [gem.id, gem]));

// Enemy shell sprite definitions. Each shell has a front sprite (rendered in front of enemy)
// and a back sprite (rendered behind enemy). Shells are randomly assigned to enemies.
export const ENEMY_SHELL_DEFINITIONS = [
  {
    id: 'shell1',
    name: 'Oval Shell',
    frontSprite: './assets/sprites/spires/enemyShells/shell1-front.svg',
    backSprite: './assets/sprites/spires/enemyShells/shell1-back.svg',
  },
  {
    id: 'shell2',
    name: 'Spiky Shell',
    frontSprite: './assets/sprites/spires/enemyShells/shell2-front.svg',
    backSprite: './assets/sprites/spires/enemyShells/shell2-back.svg',
  },
  {
    id: 'shell3',
    name: 'Hexagonal Shell',
    frontSprite: './assets/sprites/spires/enemyShells/shell3-front.svg',
    backSprite: './assets/sprites/spires/enemyShells/shell3-back.svg',
  },
];

// Cache shell sprite images for efficient rendering
const SHELL_SPRITE_CACHE = new Map();

// Load and cache a shell sprite image
function loadShellSprite(spritePath) {
  if (!spritePath || typeof Image === 'undefined') {
    return null;
  }
  
  const cached = SHELL_SPRITE_CACHE.get(spritePath);
  if (cached && cached.loaded && !cached.error) {
    return cached.image;
  }
  if (cached && cached.error) {
    return null;
  }
  
  const image = new Image();
  const record = { image, loaded: false, error: false };
  image.addEventListener('load', () => {
    record.loaded = true;
  });
  image.addEventListener('error', () => {
    record.error = true;
  });
  image.src = spritePath;
  SHELL_SPRITE_CACHE.set(spritePath, record);
  return null;
}

// Assign a random shell to an enemy. The shell persists on the enemy object.
export function assignRandomShell(enemy) {
  if (!enemy || enemy.shellId) {
    return; // Enemy already has a shell assigned
  }
  
  if (ENEMY_SHELL_DEFINITIONS.length === 0) {
    return; // No shells available
  }
  
  // Select a random shell
  const randomIndex = Math.floor(Math.random() * ENEMY_SHELL_DEFINITIONS.length);
  const shell = ENEMY_SHELL_DEFINITIONS[randomIndex];
  
  // Store shell info on enemy
  enemy.shellId = shell.id;
  enemy.shellFrontSprite = shell.frontSprite;
  enemy.shellBackSprite = shell.backSprite;
  
  // Pre-load the sprite images
  loadShellSprite(shell.frontSprite);
  loadShellSprite(shell.backSprite);
}

// Get the loaded shell sprite images for an enemy
export function getEnemyShellSprites(enemy) {
  if (!enemy || !enemy.shellFrontSprite || !enemy.shellBackSprite) {
    return null;
  }
  
  const frontImage = SHELL_SPRITE_CACHE.get(enemy.shellFrontSprite);
  const backImage = SHELL_SPRITE_CACHE.get(enemy.shellBackSprite);
  
  // Only return if both are loaded successfully
  if (frontImage?.loaded && !frontImage?.error && backImage?.loaded && !backImage?.error) {
    return {
      front: frontImage.image,
      back: backImage.image,
    };
  }
  
  return null;
}

// Maintain a direct lookup so modules can access gem sprite paths without duplicating strings.
const GEM_SPRITE_LOOKUP = new Map(
  GEM_DEFINITIONS.filter((gem) => gem.sprite).map((gem) => [gem.id, gem.sprite])
);

// Cache gem image elements so animation systems can reuse decoded sprites efficiently.
const GEM_SPRITE_CACHE = new Map();

// Static rarity multipliers arranged by archetype difficulty. Higher values
// make crystal drops more common for late-game threats while still allowing the
// most coveted stones to remain appropriately rare.
const ENEMY_GEM_MULTIPLIERS = new Map([
  ['etype', 1],
  ['divisor', 2],
  ['prime', 2.5],
  ['reversal', 3],
  ['tunneler', 3.4],
  ['aleph-swarm', 3.8],
  ['partial-wraith', 4.1],
  ['gradient-sapper', 4.4],
  ['weierstrass-prism', 4.7],
  ['planck-shade', 5],
  ['null-husk', 5.2],
  ['imaginary-strider', 5.4],
  ['combination-cohort', 5.6],
  ['polygon-splitter', 5.8],
  ['derivative-shield', 6],
]);

// Radius used when sweeping the battlefield for mote gem pickups.
export const MOTE_GEM_COLLECTION_RADIUS = 48;

// Gem suction animation configuration
const GEM_SUCTION_SPEED = 8; // Speed multiplier for gem attraction
const GEM_SUCTION_THRESHOLD = 3; // Distance threshold to consider gem collected (pixels)

let queueMoteDropHandler = null;
let recordPowderEventHandler = null;

// Allow the host application to inject powder logging and queue handlers without creating circular dependencies.
export function configureEnemyHandlers({ queueMoteDrop, recordPowderEvent } = {}) {
  queueMoteDropHandler = typeof queueMoteDrop === 'function' ? queueMoteDrop : null;
  recordPowderEventHandler = typeof recordPowderEvent === 'function' ? recordPowderEvent : null;
}

// Clear any mote gem drops lingering from previous battles.
export function resetActiveMoteGems() {
  moteGemState.active.length = 0;
}

// Resolve the rarity multiplier for an enemy based on explicit overrides or codex id.
export function resolveEnemyGemDropMultiplier(source = {}) {
  if (Number.isFinite(source.gemDropMultiplier)) {
    return Math.max(0, source.gemDropMultiplier);
  }
  if (Number.isFinite(source.rarityMultiplier)) {
    return Math.max(0, source.rarityMultiplier);
  }
  const key = String(source.typeId || source.codexId || source.id || '').toLowerCase();
  if (ENEMY_GEM_MULTIPLIERS.has(key)) {
    return ENEMY_GEM_MULTIPLIERS.get(key);
  }
  const hp = Number.isFinite(source.hp) ? Math.max(1, source.hp) : null;
  if (hp) {
    const inferred = 1 + Math.log10(hp) * 0.12;
    return Math.max(1, inferred);
  }
  return 1;
}

// Roll against the gem hierarchy to determine which crystal, if any, drops.
export function rollGemDropDefinition(enemy = {}, rng = Math.random) {
  const multiplier = resolveEnemyGemDropMultiplier(enemy);
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return null;
  }
  const random = typeof rng === 'function' ? rng : Math.random;
  for (let index = GEM_DEFINITIONS.length - 1; index >= 0; index -= 1) {
    const gem = GEM_DEFINITIONS[index];
    const chance = Math.min(0.999, gem.dropChance * multiplier);
    if (chance > 0 && random() < chance) {
      return gem;
    }
  }
  return null;
}

// Resolve the gem definition from the collection for UI lookups.
export function resolveGemDefinition(typeKey) {
  const key = String(typeKey || '').toLowerCase();
  return GEM_LOOKUP.get(key) || null;
}

// Surface the sprite path for a gem id so DOM renderers can attach the correct artwork.
export function getGemSpriteAssetPath(typeKey) {
  const key = String(typeKey || '').toLowerCase();
  return GEM_SPRITE_LOOKUP.get(key) || null;
}

// Provide a memoized Image instance so canvas renderers can draw gem sprites once loaded.
export function getGemSpriteImage(typeKey) {
  const key = String(typeKey || '').toLowerCase();
  if (!GEM_SPRITE_LOOKUP.has(key)) {
    return null;
  }
  const cached = GEM_SPRITE_CACHE.get(key);
  if (cached && cached.loaded && !cached.error) {
    return cached.image;
  }
  if (cached && cached.error) {
    return null;
  }
  if (typeof Image !== 'undefined') {
    const image = new Image();
    const record = { image, loaded: false, error: false };
    image.addEventListener('load', () => {
      record.loaded = true;
    });
    image.addEventListener('error', () => {
      record.error = true;
    });
    image.src = GEM_SPRITE_LOOKUP.get(key);
    GEM_SPRITE_CACHE.set(key, record);
  }
  return null;
}

// Derive a deterministic accent color for a mote gem category.
export function getMoteGemColor(typeKey) {
  const gem = resolveGemDefinition(typeKey);
  if (!gem) {
    return { hue: 48, saturation: 68, lightness: 56 };
  }
  return { ...gem.color };
}

// Spawn a mote gem drop at the supplied battlefield position.
export function spawnMoteGemDrop(enemy, position) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    return null;
  }
  const gemDefinition = rollGemDropDefinition(enemy);
  if (!gemDefinition) {
    return null;
  }
  const moteSize = Math.max(1, Math.round(gemDefinition.moteSize || 1));
  const launchDistanceMeters = 1 + Math.random() * 2; // Propel the gem between one and three meters away from the defeat point.
  const launchAngle = Math.random() * Math.PI * 2; // Scatter the gem in a uniformly random direction so flights cover the entire arena.
  const launchDuration = 520 + Math.random() * 240; // Allow the fling animation to complete within roughly half a second for a crisp exit.
  const gem = {
    id: moteGemState.nextId,
    x: position.x,
    y: position.y,
    value: moteSize,
    typeKey: gemDefinition.id,
    typeLabel: gemDefinition.name,
    pulse: Math.random() * Math.PI * 2,
    color: { ...gemDefinition.color },
    // Persist the sprite path on the gem so the playfield can render the matching artwork.
    spritePath: gemDefinition.sprite || null,
    vx: 0,
    vy: 0,
    gravity: 0,
    lifetime: 0,
    opacity: 1,
    moteSize,
    launch: {
      startX: position.x,
      startY: position.y,
      angle: launchAngle,
      distanceMeters: launchDistanceMeters,
      duration: launchDuration,
      elapsed: 0,
    }, // Track the fling vector so the playfield can translate meters into screen motion.
  };
  moteGemState.nextId += 1;
  moteGemState.active.push(gem);
  return gem;
}

// Helper function to add a gem to the player's inventory and invoke handlers.
function addGemToInventory(gem, reason = 'manual') {
  const record =
    moteGemState.inventory.get(gem.typeKey) ||
    { label: gem.typeLabel, total: 0, count: 0 };
  record.total += gem.value;
  record.count = (record.count || 0) + 1;
  record.label = gem.typeLabel || record.label;
  moteGemState.inventory.set(gem.typeKey, record);

  if (queueMoteDropHandler) {
    queueMoteDropHandler({
      size: gem.value,
      color: gem.color ? { ...gem.color } : null,
    });
  }
  if (recordPowderEventHandler) {
    recordPowderEventHandler('mote-gem-collected', {
      type: gem.typeLabel,
      value: gem.value,
      reason,
    });
  }
}

// Transfer a mote gem into the player's reserves and remove it from the field.
export function collectMoteGemDrop(gem, context = {}) {
  if (!gem) {
    return false;
  }
  const index = moteGemState.active.findIndex((candidate) => candidate && candidate.id === gem.id);
  if (index === -1) {
    return false;
  }
  moteGemState.active.splice(index, 1);
  addGemToInventory(gem, context.reason || 'manual');
  return true;
}

// Collect any mote gems within a radius of the provided battlefield point.
// Returns an object with the count and details of collected gems.
export function collectMoteGemsWithinRadius(center, radius, context = {}) {
  if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) {
    return { count: 0, gems: [] };
  }
  const effectiveRadius = Number.isFinite(radius) ? Math.max(1, radius) : MOTE_GEM_COLLECTION_RADIUS;
  const radiusSquared = effectiveRadius * effectiveRadius;
  const gemsInRange = moteGemState.active.filter((gem) => {
    const dx = gem.x - center.x;
    const dy = gem.y - center.y;
    return dx * dx + dy * dy <= radiusSquared;
  });

  // Start suction animation for all gems in range
  gemsInRange.forEach((gem) => {
    if (!gem.suction) {
      gem.suction = {
        targetX: center.x,
        targetY: center.y,
        startTime: Date.now(),
        active: true,
      };
    }
  });

  return { count: gemsInRange.length, gems: gemsInRange };
}

// Update gem suction animations and collect gems that reach their target.
// Returns an array of collected gems grouped by type.
export function updateGemSuctionAnimations(deltaTime = 16) {
  const collectedByType = new Map();

  moteGemState.active = moteGemState.active.filter((gem) => {
    if (!gem.suction || !gem.suction.active) {
      return true; // Keep gems without active suction
    }

    const dx = gem.suction.targetX - gem.x;
    const dy = gem.suction.targetY - gem.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if gem has reached its target
    if (distance <= GEM_SUCTION_THRESHOLD) {
      // Add to inventory using shared helper
      addGemToInventory(gem, 'suction');

      // Track collected gems by type for feedback display
      if (!collectedByType.has(gem.typeKey)) {
        collectedByType.set(gem.typeKey, {
          count: 0,
          typeKey: gem.typeKey,
          typeName: gem.typeLabel,
          color: gem.color,
          targetX: gem.suction.targetX,
          targetY: gem.suction.targetY,
        });
      }
      const typeGroup = collectedByType.get(gem.typeKey);
      typeGroup.count += gem.value;

      return false; // Remove collected gem
    }

    // Move gem toward target
    const speed = (GEM_SUCTION_SPEED * deltaTime) / 16; // Normalize for 60fps
    const moveDistance = Math.min(distance, speed);
    const angle = Math.atan2(dy, dx);
    gem.x += Math.cos(angle) * moveDistance;
    gem.y += Math.sin(angle) * moveDistance;

    return true; // Keep gem
  });

  // Convert collected gems map to array
  return Array.from(collectedByType.values());
}

// Automatically collect every mote gem currently active on the field.
export function autoCollectActiveMoteGems(reason = 'auto') {
  const pending = [...moteGemState.active];
  pending.forEach((gem) => {
    collectMoteGemDrop(gem, { reason });
  });
  return pending.length;
}

// Update the auto-collect upgrade flag so glyph completions can sweep gems.
export function setMoteGemAutoCollectUnlocked(unlocked) {
  moteGemState.autoCollectUnlocked = Boolean(unlocked);
}
