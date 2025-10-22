import React from 'react';
import { GameState, TowerType } from '../types/game';
import { GRID_SIZE, GRID_WIDTH, GRID_HEIGHT, PATH_POINTS } from '../utils/gameConfig';

interface GameBoardProps {
  gameState: GameState;
  selectedTower: TowerType | null;
  onCellClick: (x: number, y: number) => void;
}

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

  const getTowerColor = (type: TowerType): string => {
    switch (type) {
      case 'basic': return '#4CAF50';
      case 'sniper': return '#2196F3';
      case 'cannon': return '#FF5722';
      case 'lightning': return '#9C27B0';
      default: return '#757575';
    }
  };

  return (
    <div style={{ position: 'relative', width: GRID_WIDTH * GRID_SIZE, height: GRID_HEIGHT * GRID_SIZE, border: '2px solid #333', backgroundColor: '#1a1a1a' }}>
      <svg width={GRID_WIDTH * GRID_SIZE} height={GRID_HEIGHT * GRID_SIZE} style={{ position: 'absolute', top: 0, left: 0 }}>
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
              stroke="#8B4513"
              strokeWidth={GRID_SIZE * 0.8}
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
              style={{
                position: 'absolute',
                left: x * GRID_SIZE,
                top: y * GRID_SIZE,
                width: GRID_SIZE,
                height: GRID_SIZE,
                border: '1px solid #333',
                cursor: !isPath && selectedTower ? 'pointer' : 'default',
                backgroundColor: isPath ? 'transparent' : 'rgba(255,255,255,0.05)',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isPath && selectedTower) {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isPath) {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                }
              }}
            >
              {tower && (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: getTowerColor(tower.type),
                    borderRadius: '50%',
                    transform: 'scale(0.8)',
                    fontWeight: 'bold',
                    color: 'white',
                    fontSize: '12px',
                  }}
                >
                  {tower.level}
                </div>
              )}
            </div>
          );
        })
      )}

      {gameState.enemies.map(enemy => (
        <div
          key={enemy.id}
          style={{
            position: 'absolute',
            left: enemy.position.x - 10,
            top: enemy.position.y - 10,
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: '#F44336',
            border: '2px solid #fff',
            transition: 'all 0.1s linear',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -15,
              left: -5,
              width: 30,
              height: 4,
              backgroundColor: '#333',
              borderRadius: 2,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(enemy.health / enemy.maxHealth) * 100}%`,
                backgroundColor: '#4CAF50',
                borderRadius: 2,
                transition: 'width 0.2s',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
