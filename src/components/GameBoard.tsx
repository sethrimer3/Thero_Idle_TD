import React from 'react';
import { GameState, TowerType } from '../types/game';
import { GRID_SIZE, GRID_WIDTH, GRID_HEIGHT, PATH_POINTS } from '../utils/gameConfig';

interface GameBoardProps {
  gameState: GameState;
  selectedTower: TowerType | null;
  onCellClick: (x: number, y: number) => void;
}

const TOWER_SIGILS: Record<TowerType, string> = {
  basic: 'α',
  sniper: 'λ',
  cannon: 'θ',
  lightning: 'ζ',
};

export const GameBoard: React.FC<GameBoardProps> = ({ gameState, selectedTower, onCellClick }) => {
  const isPathCell = (x: number, y: number): boolean => {
    return PATH_POINTS.some(point => {
      const nextPoint = PATH_POINTS[PATH_POINTS.indexOf(point) + 1];
      if (!nextPoint) return false;

      const minX = Math.min(point.x, nextPoint.x);
      const maxX = Math.max(point.x, nextPoint.x);
      const minY = Math.min(point.y, nextPoint.y);
      const maxY = Math.max(point.y, nextPoint.y);

      return x >= minX && x <= maxX && y >= minY && y <= maxY;
    });
  };

  const boardWidth = GRID_WIDTH * GRID_SIZE;
  const boardHeight = GRID_HEIGHT * GRID_SIZE;

  return (
    <div
      className="board-stage"
      style={{ width: boardWidth, height: boardHeight }}
    >
      <svg width={boardWidth} height={boardHeight} style={{ position: 'absolute', top: 0, left: 0 }}>
        {PATH_POINTS.map((point, index) => {
          const nextPoint = PATH_POINTS[index + 1];
          if (!nextPoint) return null;
          return (
            <line
              key={index}
              x1={point.x * GRID_SIZE + GRID_SIZE / 2}
              y1={point.y * GRID_SIZE + GRID_SIZE / 2}
              x2={nextPoint.x * GRID_SIZE + GRID_SIZE / 2}
              y2={nextPoint.y * GRID_SIZE + GRID_SIZE / 2}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={GRID_SIZE * 0.7}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {Array.from({ length: GRID_HEIGHT }).map((_, y) =>
        Array.from({ length: GRID_WIDTH }).map((_, x) => {
          const isPath = isPathCell(x, y);
          const tower = gameState.towers.find(t => t.position.x === x && t.position.y === y);

          return (
            <div
              key={`${x}-${y}`}
              onClick={() => !isPath && onCellClick(x, y)}
              className={`board-cell${isPath ? ' is-path' : ''}`}
              style={{
                left: x * GRID_SIZE,
                top: y * GRID_SIZE,
                width: GRID_SIZE,
                height: GRID_SIZE,
                cursor: !isPath && selectedTower ? 'pointer' : 'default',
              }}
              onMouseEnter={event => {
                if (!isPath && selectedTower) {
                  event.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
                }
              }}
              onMouseLeave={event => {
                if (!isPath) {
                  event.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                }
              }}
            >
              {tower && (
                <div className="tower-node">
                  <span>{TOWER_SIGILS[tower.type]}</span>
                  <small>{`ℓ${tower.level}`}</small>
                </div>
              )}
            </div>
          );
        })
      )}

      {gameState.enemies.map(enemy => (
        <div
          key={enemy.id}
          className="enemy-glyph"
          style={{
            left: enemy.position.x - GRID_SIZE * 0.4,
            top: enemy.position.y - GRID_SIZE * 0.4,
            width: GRID_SIZE * 0.8,
            height: GRID_SIZE * 0.8,
          }}
        >
          <div className="enemy-health-bar">
            <span style={{ width: `${Math.max(0, (enemy.health / enemy.maxHealth) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};
