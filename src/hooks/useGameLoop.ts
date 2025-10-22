import { useEffect, useRef, useCallback } from 'react';
import { GameState, Enemy, Position } from '../types/game';
import { PATH_POINTS, GRID_SIZE, WAVE_CONFIG } from '../utils/gameConfig';

export const useGameLoop = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
) => {
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef<number>(Date.now());

  const calculateDistance = (pos1: Position, pos2: Position): number => {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const moveEnemies = useCallback((enemies: Enemy[], deltaTime: number): Enemy[] => {
    return enemies.map(enemy => {
      const targetPoint = PATH_POINTS[enemy.pathIndex + 1];
      if (!targetPoint) return enemy;

      const targetX = targetPoint.x * GRID_SIZE;
      const targetY = targetPoint.y * GRID_SIZE;
      const dx = targetX - enemy.position.x;
      const dy = targetY - enemy.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 5) {
        const newPathIndex = enemy.pathIndex + 1;
        if (newPathIndex >= PATH_POINTS.length - 1) {
          return { ...enemy, health: 0 };
        }
        return { ...enemy, pathIndex: newPathIndex };
      }

      const moveDistance = enemy.speed * deltaTime;
      const ratio = moveDistance / distance;

      return {
        ...enemy,
        position: {
          x: enemy.position.x + dx * ratio,
          y: enemy.position.y + dy * ratio,
        },
      };
    });
  }, []);

  const towerAttack = useCallback((enemies: Enemy[], _deltaTime: number): Enemy[] => {
    let updatedEnemies = [...enemies];

    gameState.towers.forEach(tower => {
      const towerPos = {
        x: tower.position.x * GRID_SIZE + GRID_SIZE / 2,
        y: tower.position.y * GRID_SIZE + GRID_SIZE / 2,
      };

      const enemiesInRange = updatedEnemies
        .map((enemy, index) => ({ enemy, index }))
        .filter(({ enemy }) => {
          const distance = calculateDistance(towerPos, enemy.position);
          return distance <= tower.range && enemy.health > 0;
        });

      if (enemiesInRange.length > 0) {
        const target = enemiesInRange[0];
        const timeSinceLastUpdate = Date.now() - lastUpdateRef.current;

        if (timeSinceLastUpdate >= tower.attackSpeed) {
          updatedEnemies[target.index] = {
            ...target.enemy,
            health: target.enemy.health - tower.damage,
          };
        }
      }
    });

    return updatedEnemies;
  }, [gameState.towers]);

  const gameLoop = useCallback(() => {
    const now = Date.now();
    const deltaTime = (now - lastUpdateRef.current) / 1000;
    lastUpdateRef.current = now;

    setGameState(prevState => {
      if (!prevState.isPlaying) return prevState;

      let updatedEnemies = moveEnemies(prevState.enemies, deltaTime);
      updatedEnemies = towerAttack(updatedEnemies, deltaTime);

      let goldGained = 0;
      let livesLost = 0;

      const aliveEnemies = updatedEnemies.filter(enemy => {
        if (enemy.health <= 0) {
          if (enemy.pathIndex >= PATH_POINTS.length - 1) {
            livesLost++;
          } else {
            goldGained += enemy.reward;
          }
          return false;
        }
        return true;
      });

      const newLives = prevState.lives - livesLost;
      const newGold = prevState.gold + goldGained;
      const newScore = prevState.score + goldGained;

      if (aliveEnemies.length === 0 && prevState.enemies.length > 0) {
        return {
          ...prevState,
          gold: newGold,
          score: newScore,
          lives: newLives,
          enemies: [],
          wave: prevState.wave + 1,
        };
      }

      if (newLives <= 0) {
        return {
          ...prevState,
          lives: 0,
          isPlaying: false,
          enemies: [],
        };
      }

      return {
        ...prevState,
        enemies: aliveEnemies,
        gold: newGold,
        score: newScore,
        lives: newLives,
      };
    });

    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [moveEnemies, towerAttack, setGameState]);

  useEffect(() => {
    if (gameState.isPlaying) {
      lastUpdateRef.current = Date.now();
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState.isPlaying, gameLoop]);

  return null;
};

export const spawnWave = (wave: number): Enemy[] => {
  const enemyCount = WAVE_CONFIG.baseEnemies + wave * WAVE_CONFIG.enemiesPerWave;
  const enemies: Enemy[] = [];

  for (let i = 0; i < enemyCount; i++) {
    const health = Math.floor(
      WAVE_CONFIG.baseHealth * Math.pow(WAVE_CONFIG.healthMultiplier, wave - 1)
    );
    const reward = Math.floor(
      WAVE_CONFIG.baseReward * Math.pow(WAVE_CONFIG.rewardMultiplier, wave - 1)
    );
    const speed = WAVE_CONFIG.baseSpeed * Math.pow(WAVE_CONFIG.speedMultiplier, wave - 1);

    enemies.push({
      id: `enemy-${wave}-${i}`,
      position: { x: PATH_POINTS[0].x * GRID_SIZE, y: PATH_POINTS[0].y * GRID_SIZE },
      health,
      maxHealth: health,
      speed,
      reward,
      pathIndex: 0,
    });
  }

  return enemies;
};
