import { useState, useEffect } from 'react';
import { GameState, TowerType, Tower } from './types/game';
import { GameBoard } from './components/GameBoard';
import { TowerShop } from './components/TowerShop';
import { GameStats } from './components/GameStats';
import { useGameLoop, spawnWave } from './hooks/useGameLoop';
import { useIdleProgress } from './hooks/useIdleProgress';
import { STARTING_GOLD, STARTING_LIVES, TOWER_CONFIGS } from './utils/gameConfig';
import { supabase } from './utils/supabase';

const INITIAL_GAME_STATE: GameState = {
  gold: STARTING_GOLD,
  wave: 1,
  score: 0,
  towers: [],
  enemies: [],
  lives: STARTING_LIVES,
  isPlaying: true,
  lastUpdate: Date.now(),
};

function App() {
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [selectedTower, setSelectedTower] = useState<TowerType | null>(null);
  const [saveMessage, setSaveMessage] = useState<string>('');

  useGameLoop(gameState, setGameState);
  useIdleProgress(gameState, setGameState);

  useEffect(() => {
    loadGame();
  }, []);

  const loadGame = async () => {
    try {
      const { data, error } = await supabase
        .from('game_saves')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading game:', error);
        return;
      }

      if (data) {
        setGameState({
          ...data.game_state,
          enemies: [],
          isPlaying: true,
        });
        setSaveMessage('Game loaded!');
        setTimeout(() => setSaveMessage(''), 2000);
      }
    } catch (error) {
      console.error('Error loading game:', error);
    }
  };

  const saveGame = async () => {
    try {
      const saveData = {
        game_state: {
          gold: gameState.gold,
          wave: gameState.wave,
          score: gameState.score,
          towers: gameState.towers,
          lives: gameState.lives,
          lastUpdate: Date.now(),
        },
      };

      const { error } = await supabase
        .from('game_saves')
        .insert([saveData]);

      if (error) {
        console.error('Error saving game:', error);
        setSaveMessage('Save failed!');
      } else {
        setSaveMessage('Game saved!');
      }

      setTimeout(() => setSaveMessage(''), 2000);
    } catch (error) {
      console.error('Error saving game:', error);
      setSaveMessage('Save failed!');
      setTimeout(() => setSaveMessage(''), 2000);
    }
  };

  const handleCellClick = (x: number, y: number) => {
    if (!selectedTower) return;

    const existingTower = gameState.towers.find(t => t.position.x === x && t.position.y === y);
    if (existingTower) {
      upgradeTower(existingTower.id);
      return;
    }

    const towerConfig = TOWER_CONFIGS[selectedTower][0];
    if (gameState.gold < towerConfig.cost) return;

    const newTower: Tower = {
      id: `tower-${Date.now()}`,
      type: selectedTower,
      position: { x, y },
      level: 1,
      damage: towerConfig.damage,
      range: towerConfig.range,
      attackSpeed: towerConfig.attackSpeed,
      cost: towerConfig.cost,
    };

    setGameState(prev => ({
      ...prev,
      towers: [...prev.towers, newTower],
      gold: prev.gold - towerConfig.cost,
    }));

    setSelectedTower(null);
  };

  const upgradeTower = (towerId: string) => {
    setGameState(prev => {
      const tower = prev.towers.find(t => t.id === towerId);
      if (!tower) return prev;

      const nextLevel = tower.level + 1;
      const upgradeConfig = TOWER_CONFIGS[tower.type][nextLevel - 1];

      if (!upgradeConfig || prev.gold < upgradeConfig.cost) return prev;

      const updatedTowers = prev.towers.map(t => {
        if (t.id === towerId) {
          return {
            ...t,
            level: nextLevel,
            damage: upgradeConfig.damage,
            range: upgradeConfig.range,
            attackSpeed: upgradeConfig.attackSpeed,
          };
        }
        return t;
      });

      return {
        ...prev,
        towers: updatedTowers,
        gold: prev.gold - upgradeConfig.cost,
      };
    });
  };

  const handleStartWave = () => {
    if (gameState.enemies.length === 0) {
      const newEnemies = spawnWave(gameState.wave);
      setGameState(prev => ({
        ...prev,
        enemies: newEnemies,
      }));
    }
  };

  const handleResetGame = () => {
    setGameState(INITIAL_GAME_STATE);
    setSelectedTower(null);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#121212', color: '#fff', fontFamily: 'Arial, sans-serif', padding: '20px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '36px', margin: '0 0 10px 0', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 'bold' }}>
            Idle Tower Defense
          </h1>
          <p style={{ color: '#aaa', fontSize: '14px', margin: 0 }}>Build towers, defend your base, and earn gold even when idle!</p>
        </header>

        {saveMessage && (
          <div style={{ position: 'fixed', top: '20px', right: '20px', padding: '15px 25px', backgroundColor: '#4CAF50', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', zIndex: 1000, boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
            {saveMessage}
          </div>
        )}

        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <div>
            <TowerShop
              gold={gameState.gold}
              selectedTower={selectedTower}
              onSelectTower={setSelectedTower}
            />
          </div>

          <div>
            <GameBoard
              gameState={gameState}
              selectedTower={selectedTower}
              onCellClick={handleCellClick}
            />
          </div>

          <div>
            <GameStats
              gameState={gameState}
              onStartWave={handleStartWave}
              onSaveGame={saveGame}
              onResetGame={handleResetGame}
            />
          </div>
        </div>

        <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#2a2a2a', borderRadius: '8px', maxWidth: '800px', margin: '30px auto 0' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', fontWeight: 'bold' }}>How to Play</h3>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#aaa', fontSize: '14px', lineHeight: '1.8' }}>
            <li>Select a tower from the shop and click on the board to place it</li>
            <li>Click "Start Next Wave" to begin each wave of enemies</li>
            <li>Towers automatically attack enemies within range</li>
            <li>Earn gold by defeating enemies</li>
            <li>Click on existing towers to upgrade them</li>
            <li>Your towers generate passive income over time</li>
            <li>Save your progress and come back later to continue</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
