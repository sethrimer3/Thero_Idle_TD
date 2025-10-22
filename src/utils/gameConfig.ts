import { TowerType, TowerUpgrade } from '../types/game';

export const GRID_SIZE = 40;
export const GRID_WIDTH = 15;
export const GRID_HEIGHT = 10;
export const STARTING_GOLD = 200;
export const STARTING_LIVES = 20;

export const TOWER_CONFIGS: Record<TowerType, TowerUpgrade[]> = {
  basic: [
    { type: 'basic', level: 1, damage: 10, range: 100, attackSpeed: 1000, cost: 50 },
    { type: 'basic', level: 2, damage: 20, range: 120, attackSpeed: 900, cost: 100 },
    { type: 'basic', level: 3, damage: 35, range: 140, attackSpeed: 800, cost: 200 },
  ],
  sniper: [
    { type: 'sniper', level: 1, damage: 50, range: 200, attackSpeed: 2000, cost: 150 },
    { type: 'sniper', level: 2, damage: 100, range: 250, attackSpeed: 1800, cost: 300 },
    { type: 'sniper', level: 3, damage: 180, range: 300, attackSpeed: 1600, cost: 600 },
  ],
  cannon: [
    { type: 'cannon', level: 1, damage: 30, range: 80, attackSpeed: 1500, cost: 100 },
    { type: 'cannon', level: 2, damage: 60, range: 100, attackSpeed: 1300, cost: 200 },
    { type: 'cannon', level: 3, damage: 120, range: 120, attackSpeed: 1100, cost: 400 },
  ],
  lightning: [
    { type: 'lightning', level: 1, damage: 15, range: 120, attackSpeed: 800, cost: 120 },
    { type: 'lightning', level: 2, damage: 30, range: 150, attackSpeed: 700, cost: 240 },
    { type: 'lightning', level: 3, damage: 60, range: 180, attackSpeed: 600, cost: 480 },
  ],
};

export const PATH_POINTS = [
  { x: 0, y: 5 },
  { x: 3, y: 5 },
  { x: 3, y: 2 },
  { x: 7, y: 2 },
  { x: 7, y: 7 },
  { x: 11, y: 7 },
  { x: 11, y: 4 },
  { x: 15, y: 4 },
];

export const WAVE_CONFIG = {
  baseEnemies: 5,
  enemiesPerWave: 3,
  baseHealth: 50,
  healthMultiplier: 1.5,
  baseReward: 10,
  rewardMultiplier: 1.2,
  baseSpeed: 1,
  speedMultiplier: 1.05,
};
