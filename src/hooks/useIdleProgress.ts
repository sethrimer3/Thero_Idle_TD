import { useEffect, useRef } from 'react';
import { GameState } from '../types/game';

export const useIdleProgress = (
  gameState: GameState,
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
) => {
  const idleTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    const calculateIdleRewards = () => {
      setGameState(prev => {
        if (!prev.isPlaying) return prev;

        const goldPerSecond = prev.towers.reduce((total, tower) => {
          return total + Math.floor(tower.damage / 10);
        }, 0);

        return {
          ...prev,
          gold: prev.gold + goldPerSecond,
        };
      });
    };

    if (gameState.isPlaying) {
      idleTimerRef.current = setInterval(calculateIdleRewards, 1000);
    }

    return () => {
      if (idleTimerRef.current) {
        clearInterval(idleTimerRef.current);
      }
    };
  }, [gameState.isPlaying, gameState.towers, setGameState]);

  return null;
};
