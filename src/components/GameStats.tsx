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
    <div className="tab-section">
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Σ Gold</span>
          <span className="stat-value">{gameState.gold}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">λ Wave</span>
          <span className="stat-value">{gameState.wave}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">♥ Lives</span>
          <span
            className="stat-value"
            style={{ color: gameState.lives > 5 ? '#dcefe3' : '#f1c7c7' }}
          >
            {gameState.lives}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Ξ Score</span>
          <span className="stat-value">{gameState.score}</span>
        </div>
      </div>

      <div className="control-column">
        <button
          type="button"
          onClick={onStartWave}
          className="control-button primary"
          disabled={!canStartWave}
        >
          {gameState.enemies.length > 0 ? 'Wave in progress…' : 'Commence Next Wave'}
        </button>
        <button type="button" onClick={onSaveGame} className="control-button safe">
          Archive Progress Vector
        </button>
        <button type="button" onClick={onResetGame} className="control-button danger">
          Reset Simulation
        </button>
      </div>

      {!gameState.isPlaying && gameState.lives === 0 && (
        <p className="guide-text" style={{ color: '#f1c7c7' }}>
          Simulation collapsed. Reinstate the ledger to attempt a new proof.
        </p>
      )}
    </div>
  );
};
