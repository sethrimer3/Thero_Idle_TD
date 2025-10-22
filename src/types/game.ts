export interface Position {
  x: number;
  y: number;
}

export interface Tower {
  id: string;
  type: TowerType;
  position: Position;
  level: number;
  damage: number;
  range: number;
  attackSpeed: number;
  cost: number;
}

export interface Enemy {
  id: string;
  position: Position;
  health: number;
  maxHealth: number;
  speed: number;
  reward: number;
  pathIndex: number;
}

export interface GameState {
  gold: number;
  wave: number;
  score: number;
  towers: Tower[];
  enemies: Enemy[];
  lives: number;
  isPlaying: boolean;
  lastUpdate: number;
}

export interface TowerUpgrade {
  type: TowerType;
  level: number;
  damage: number;
  range: number;
  attackSpeed: number;
  cost: number;
}

export type TowerType = 'basic' | 'sniper' | 'cannon' | 'lightning';

export interface IdleProgress {
  goldPerSecond: number;
  waveProgress: number;
  autoUpgrade: boolean;
}
