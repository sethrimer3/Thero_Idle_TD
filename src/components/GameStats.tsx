import React from 'react';
import { GameState } from '../types/game';

interface GameStatsProps {
  gameState: GameState;
  onStartWave: () => void;
  onSaveGame: () => void;
  onResetGame: () => void;
}

export const GameStats: React.FC<GameStatsProps> = ({ gameState, onStartWave, onSaveGame, onResetGame }) => {
  const canStartWave = gameState.enemies.length === 0 && gameState.isPlaying;

  return (
    <div style={{ padding: '20px', backgroundColor: '#2a2a2a', borderRadius: '8px', minWidth: '250px' }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>Game Stats</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '6px' }}>
          <span style={{ color: '#aaa', fontSize: '14px' }}>💰 Gold</span>
          <span style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '16px' }}>{gameState.gold}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '6px' }}>
          <span style={{ color: '#aaa', fontSize: '14px' }}>🌊 Wave</span>
          <span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '16px' }}>{gameState.wave}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '6px' }}>
          <span style={{ color: '#aaa', fontSize: '14px' }}>❤️ Lives</span>
          <span style={{ color: gameState.lives > 5 ? '#4CAF50' : '#F44336', fontWeight: 'bold', fontSize: '16px' }}>{gameState.lives}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '6px' }}>
          <span style={{ color: '#aaa', fontSize: '14px' }}>⭐ Score</span>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '16px' }}>{gameState.score}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={onStartWave}
          disabled={!canStartWave}
          style={{
            padding: '12px',
            backgroundColor: canStartWave ? '#4CAF50' : '#1a1a1a',
            color: canStartWave ? '#fff' : '#666',
            border: 'none',
            borderRadius: '6px',
            cursor: canStartWave ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 'bold',
            transition: 'all 0.2s',
          }}
        >
          {gameState.enemies.length > 0 ? 'Wave in Progress...' : 'Start Next Wave'}
        </button>

        <button
          onClick={onSaveGame}
          style={{
            padding: '10px',
            backgroundColor: '#2196F3',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold',
            transition: 'all 0.2s',
          }}
        >
          💾 Save Game
        </button>

        <button
          onClick={onResetGame}
          style={{
            padding: '10px',
            backgroundColor: '#F44336',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold',
            transition: 'all 0.2s',
          }}
        >
          🔄 New Game
        </button>
      </div>

      {!gameState.isPlaying && gameState.lives === 0 && (
        <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#F44336', borderRadius: '6px', textAlign: 'center' }}>
          <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '16px', marginBottom: '5px' }}>Game Over!</div>
          <div style={{ color: '#fff', fontSize: '14px' }}>Final Score: {gameState.score}</div>
        </div>
      )}
    </div>
  );
};
