/**
 * Kuf enemy definition catalog used for the in-spire almanac and simulation stats.
 *
 * Centralizes baseline enemy stats, descriptive lore, and special behaviors so the
 * UI and simulation can stay in sync.
 */

import {
  TURRET_CONFIG,
  BIG_TURRET_CONFIG,
  MELEE_UNIT_CONFIG,
  RANGED_UNIT_CONFIG,
  STRUCTURE_CONFIG,
  PROJECTILE_SPEEDS,
} from './kufSimulationConfig.js';

// Shared stat labels for the enemy almanac display.
const KUF_ALMANAC_STAT_LABELS = Object.freeze({
  health: 'Hull',
  attack: 'Attack',
  attackSpeed: 'Fire Rate',
  range: 'Range',
  goldValue: 'Bounty',
});

// Ordered enemy roster for the Kuf enemy almanac UI.
export const KUF_ENEMY_ORDER = Object.freeze([
  'small_turret',
  'big_turret',
  'laser_turret',
  'rocket_turret',
  'artillery_turret',
  'plasma_turret',
  'scatter_turret',
  'wall',
  'mine',
  'melee_unit',
  'ranged_unit',
  'melee_barracks',
  'ranged_barracks',
  'support_drone',
  'stasis_obelisk',
  'relay_pylon',
  'shield_generator',
  'supply_cache',
  'signal_beacon',
]);

// Baseline enemy definitions used by both the simulation and the almanac UI.
export const KUF_ENEMY_DEFINITIONS = Object.freeze({
  small_turret: {
    type: 'small_turret',
    name: 'Light Turret',
    description: 'Compact autogun emplacements that guard the Kuf approach lanes.',
    iconClass: 'turret',
    stats: {
      radius: TURRET_CONFIG.RADIUS,
      health: 5,
      attack: 1,
      attackSpeed: 1,
      range: TURRET_CONFIG.RANGE,
      goldValue: 6,
    },
    extra: {},
  },
  big_turret: {
    type: 'big_turret',
    name: 'Heavy Turret',
    description: 'Bulky cannons that trade speed for punishing shells.',
    iconClass: 'heavy-turret',
    stats: {
      radius: BIG_TURRET_CONFIG.RADIUS,
      health: 20,
      attack: 3,
      attackSpeed: 0.8,
      range: BIG_TURRET_CONFIG.RANGE,
      goldValue: 12,
    },
    extra: {},
  },
  laser_turret: {
    type: 'laser_turret',
    name: 'Laser Turret',
    description: 'Rapid-fire beam pylons that stitch together overlapping lanes.',
    iconClass: 'laser-turret',
    stats: {
      radius: TURRET_CONFIG.RADIUS,
      health: 8,
      attack: 1.8,
      attackSpeed: 1.6,
      range: TURRET_CONFIG.RANGE * 1.1,
      goldValue: 8,
    },
    extra: {},
  },
  rocket_turret: {
    type: 'rocket_turret',
    name: 'Rocket Turret',
    description: 'Guided pods that bombard clustered squads from midrange.',
    iconClass: 'rocket-turret',
    stats: {
      radius: BIG_TURRET_CONFIG.RADIUS * 0.9,
      health: 16,
      attack: 2.5,
      attackSpeed: 1.1,
      range: BIG_TURRET_CONFIG.RANGE * 1.1,
      goldValue: 11,
    },
    extra: {},
  },
  artillery_turret: {
    type: 'artillery_turret',
    name: 'Artillery Turret',
    description: 'Long-range cannons that punish slow advances.',
    iconClass: 'artillery-turret',
    stats: {
      radius: BIG_TURRET_CONFIG.RADIUS,
      health: 24,
      attack: 3.5,
      attackSpeed: 0.7,
      range: BIG_TURRET_CONFIG.RANGE * 1.35,
      goldValue: 14,
    },
    extra: {},
  },
  plasma_turret: {
    type: 'plasma_turret',
    name: 'Plasma Turret',
    description: 'Ignites targets with lingering burn damage.',
    iconClass: 'plasma-turret',
    stats: {
      radius: TURRET_CONFIG.RADIUS,
      health: 10,
      attack: 1.4,
      attackSpeed: 1.4,
      range: TURRET_CONFIG.RANGE * 1.05,
      goldValue: 10,
    },
    extra: {
      projectileSpeed: PROJECTILE_SPEEDS.PLASMA_BULLET_SPEED,
      projectileEffects: {
        type: 'burn',
        damagePerSecond: 2.5,
        duration: 4,
      },
    },
    almanacDetails: [
      { label: 'Burn Damage', value: '2.5 DPS' },
      { label: 'Burn Duration', value: '4s' },
    ],
  },
  scatter_turret: {
    type: 'scatter_turret',
    name: 'Scatter Turret',
    description: 'Fanned volleys punish tightly packed units.',
    iconClass: 'scatter-turret',
    stats: {
      radius: BIG_TURRET_CONFIG.RADIUS * 0.85,
      health: 18,
      attack: 1.8,
      attackSpeed: 1.3,
      range: BIG_TURRET_CONFIG.RANGE,
      goldValue: 13,
    },
    extra: {
      multiShot: 3,
      spreadAngle: 18 * (Math.PI / 180),
    },
    almanacDetails: [
      { label: 'Volley Count', value: '3' },
      { label: 'Spread', value: '18°' },
    ],
  },
  wall: {
    type: 'wall',
    name: 'Bastion Wall',
    description: 'Reinforced barriers that block sight lines and soak damage.',
    iconClass: 'wall',
    stats: {
      radius: STRUCTURE_CONFIG.WALL_RADIUS,
      health: 50,
      attack: 0,
      attackSpeed: 0,
      range: 0,
      goldValue: 4,
    },
    extra: { isWall: true },
  },
  mine: {
    type: 'mine',
    name: 'Mine',
    description: 'Explosive traps that detonate at close range.',
    iconClass: 'mine',
    stats: {
      radius: STRUCTURE_CONFIG.MINE_RADIUS,
      health: 1,
      attack: 5,
      attackSpeed: 0,
      range: 0,
      goldValue: 5,
    },
    extra: { isMine: true, explosionRadius: STRUCTURE_CONFIG.MINE_EXPLOSION_RADIUS },
    almanacDetails: [
      { label: 'Explosion Radius', value: `${STRUCTURE_CONFIG.MINE_EXPLOSION_RADIUS}px` },
    ],
  },
  melee_unit: {
    type: 'melee_unit',
    name: 'Melee Raider',
    description: 'Mobile infantry that rush the front line with blades.',
    iconClass: 'melee',
    stats: {
      radius: MELEE_UNIT_CONFIG.RADIUS,
      health: 8,
      attack: 2,
      attackSpeed: 1.2,
      range: MELEE_UNIT_CONFIG.RANGE,
      goldValue: 7,
    },
    extra: {
      isMobile: true,
      moveSpeed: MELEE_UNIT_CONFIG.SPEED,
      sightRange: MELEE_UNIT_CONFIG.SIGHT_RANGE,
    },
    almanacDetails: [
      { label: 'Move Speed', value: `${MELEE_UNIT_CONFIG.SPEED}px/s` },
      { label: 'Sight Range', value: `${MELEE_UNIT_CONFIG.SIGHT_RANGE}px` },
    ],
  },
  ranged_unit: {
    type: 'ranged_unit',
    name: 'Ranged Skirmisher',
    description: 'Light scouts that kite targets from a distance.',
    iconClass: 'ranged',
    stats: {
      radius: RANGED_UNIT_CONFIG.RADIUS,
      health: 6,
      attack: 1.5,
      attackSpeed: 0.8,
      range: RANGED_UNIT_CONFIG.RANGE,
      goldValue: 8,
    },
    extra: {
      isMobile: true,
      moveSpeed: RANGED_UNIT_CONFIG.SPEED,
      sightRange: RANGED_UNIT_CONFIG.SIGHT_RANGE,
    },
    almanacDetails: [
      { label: 'Move Speed', value: `${RANGED_UNIT_CONFIG.SPEED}px/s` },
      { label: 'Sight Range', value: `${RANGED_UNIT_CONFIG.SIGHT_RANGE}px` },
    ],
  },
  melee_barracks: {
    type: 'melee_barracks',
    name: 'Melee Barracks',
    description: 'Training halls that spawn raiders to reinforce the line.',
    iconClass: 'barracks',
    stats: {
      radius: STRUCTURE_CONFIG.BARRACKS_RADIUS,
      health: 30,
      attack: 0,
      attackSpeed: 0,
      range: 0,
      goldValue: 10,
    },
    extra: {
      isBarracks: true,
      spawnType: 'melee_unit',
      spawnRange: 150,
      spawnCooldown: 5,
      spawnTimer: 0,
      maxSpawns: 3,
      currentSpawns: 0,
    },
    almanacDetails: [
      { label: 'Spawns', value: 'Melee Raiders' },
      { label: 'Spawn Cooldown', value: '5s' },
      { label: 'Max Spawns', value: '3' },
    ],
  },
  ranged_barracks: {
    type: 'ranged_barracks',
    name: 'Ranged Barracks',
    description: 'Outfitting bays that deploy ranged skirmishers.',
    iconClass: 'barracks',
    stats: {
      radius: STRUCTURE_CONFIG.BARRACKS_RADIUS,
      health: 30,
      attack: 0,
      attackSpeed: 0,
      range: 0,
      goldValue: 10,
    },
    extra: {
      isBarracks: true,
      spawnType: 'ranged_unit',
      spawnRange: 150,
      spawnCooldown: 5,
      spawnTimer: 0,
      maxSpawns: 3,
      currentSpawns: 0,
    },
    almanacDetails: [
      { label: 'Spawns', value: 'Ranged Skirmishers' },
      { label: 'Spawn Cooldown', value: '5s' },
      { label: 'Max Spawns', value: '3' },
    ],
  },
  support_drone: {
    type: 'support_drone',
    name: 'Support Drone',
    description: 'Repair drones that mend nearby fortifications.',
    iconClass: 'support',
    stats: {
      radius: RANGED_UNIT_CONFIG.RADIUS,
      health: 6,
      attack: 0,
      attackSpeed: 0,
      range: 0,
      goldValue: 9,
    },
    extra: {
      isMobile: true,
      isSupport: true,
      moveSpeed: 85,
      sightRange: 260,
      healRange: 80,
      healPerSecond: 6,
      healVisualTimer: 0,
    },
    almanacDetails: [
      { label: 'Heal Range', value: '80px' },
      { label: 'Heal Rate', value: '6 HP/s' },
    ],
  },
  stasis_obelisk: {
    type: 'stasis_obelisk',
    name: 'Stasis Obelisk',
    description: 'Projects a slowing field that saps marine speed.',
    iconClass: 'stasis',
    stats: {
      radius: BIG_TURRET_CONFIG.RADIUS,
      health: 28,
      attack: 0,
      attackSpeed: 0,
      range: 0,
      goldValue: 11,
    },
    extra: {
      isStructure: true,
      isStasisField: true,
      slowAmount: 0.35,
      slowRadius: 220,
      fieldPulse: 0,
    },
    almanacDetails: [
      { label: 'Slow Amount', value: '35%' },
      { label: 'Field Radius', value: '220px' },
    ],
  },
  relay_pylon: {
    type: 'relay_pylon',
    name: 'Relay Pylon',
    description: 'Amplifies the fire rate and damage of nearby turrets.',
    iconClass: 'relay',
    stats: {
      radius: BIG_TURRET_CONFIG.RADIUS * 0.75,
      health: 30,
      attack: 0,
      attackSpeed: 0,
      range: 0,
      goldValue: 12,
    },
    extra: {
      isStructure: true,
      isBuffNode: true,
      buffRadius: 240,
      attackSpeedMultiplier: 1.25,
      damageMultiplier: 1.15,
    },
    almanacDetails: [
      { label: 'Buff Radius', value: '240px' },
      { label: 'Fire Rate', value: '+25%' },
      { label: 'Damage', value: '+15%' },
    ],
  },
  shield_generator: {
    type: 'shield_generator',
    name: 'Shield Generator',
    description: 'Fortified emitters that shield nearby assets.',
    iconClass: 'shield',
    stats: {
      radius: BIG_TURRET_CONFIG.RADIUS,
      health: 40,
      attack: 0,
      attackSpeed: 0,
      range: 0,
      goldValue: 9,
    },
    extra: { isStructure: true },
  },
  supply_cache: {
    type: 'supply_cache',
    name: 'Supply Cache',
    description: 'Reinforced stockpiles that bolster enemy durability.',
    iconClass: 'supply',
    stats: {
      radius: BIG_TURRET_CONFIG.RADIUS * 0.8,
      health: 35,
      attack: 0,
      attackSpeed: 0,
      range: 0,
      goldValue: 12,
    },
    extra: { isStructure: true },
  },
  signal_beacon: {
    type: 'signal_beacon',
    name: 'Signal Beacon',
    description: 'Detection towers that sharpen enemy responses.',
    iconClass: 'signal',
    stats: {
      radius: BIG_TURRET_CONFIG.RADIUS * 0.7,
      health: 28,
      attack: 0,
      attackSpeed: 0,
      range: 0,
      goldValue: 10,
    },
    extra: { isStructure: true },
  },
});

/**
 * Fetch a specific enemy definition by its type identifier.
 * @param {string} type - Enemy type key.
 * @returns {object|null}
 */
export function getKufEnemyDefinition(type) {
  return KUF_ENEMY_DEFINITIONS[type] || null;
}

/**
 * Provide base stats for a Kuf enemy type in the format expected by the simulation engine.
 * @param {string} type - Enemy type key.
 * @returns {object|null}
 */
export function getKufEnemyBaseStats(type) {
  const definition = getKufEnemyDefinition(type);
  if (!definition) {
    return null;
  }
  return {
    radius: definition.stats.radius,
    health: definition.stats.health,
    attack: definition.stats.attack,
    attackSpeed: definition.stats.attackSpeed,
    range: definition.stats.range,
    goldValue: definition.stats.goldValue,
    extra: { ...definition.extra },
  };
}

/**
 * Provide labels for the core almanac stats so UI builders can stay consistent.
 * @returns {Record<string, string>}
 */
export function getKufAlmanacStatLabels() {
  return { ...KUF_ALMANAC_STAT_LABELS };
}
