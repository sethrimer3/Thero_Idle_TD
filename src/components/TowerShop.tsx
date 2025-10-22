import React from 'react';
import { TowerType } from '../types/game';
import { TOWER_CONFIGS } from '../utils/gameConfig';

interface TowerShopProps {
  gold: number;
  selectedTower: TowerType | null;
  onSelectTower: (type: TowerType) => void;
}

export const TowerShop: React.FC<TowerShopProps> = ({ gold, selectedTower, onSelectTower }) => {
  const towerTypes: TowerType[] = ['basic', 'sniper', 'cannon', 'lightning'];

  const getTowerIcon = (type: TowerType): string => {
    switch (type) {
      case 'basic': return '🏹';
      case 'sniper': return '🎯';
      case 'cannon': return '💣';
      case 'lightning': return '⚡';
      default: return '❓';
    }
  };

  const getTowerDescription = (type: TowerType): string => {
    switch (type) {
      case 'basic': return 'Balanced tower';
      case 'sniper': return 'Long range, slow';
      case 'cannon': return 'Area damage';
      case 'lightning': return 'Fast attacks';
      default: return '';
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#2a2a2a', borderRadius: '8px', minWidth: '250px' }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>Tower Shop</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {towerTypes.map(type => {
          const config = TOWER_CONFIGS[type][0];
          const canAfford = gold >= config.cost;
          const isSelected = selectedTower === type;

          return (
            <button
              key={type}
              onClick={() => onSelectTower(type)}
              disabled={!canAfford}
              style={{
                padding: '12px',
                backgroundColor: isSelected ? '#4CAF50' : canAfford ? '#3a3a3a' : '#1a1a1a',
                color: canAfford ? '#fff' : '#666',
                border: isSelected ? '2px solid #66BB6A' : '2px solid #444',
                borderRadius: '6px',
                cursor: canAfford ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                textAlign: 'left',
                transition: 'all 0.2s',
                opacity: canAfford ? 1 : 0.5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>{getTowerIcon(type)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', textTransform: 'capitalize', marginBottom: '4px' }}>
                    {type}
                  </div>
                  <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>
                    {getTowerDescription(type)}
                  </div>
                  <div style={{ fontSize: '12px' }}>
                    <span style={{ color: '#FFD700' }}>💰 {config.cost}</span>
                    {' | '}
                    <span>⚔️ {config.damage}</span>
                    {' | '}
                    <span>📏 {config.range}</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {selectedTower && (
        <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '6px', fontSize: '13px', color: '#aaa' }}>
          Click on the board to place your tower
        </div>
      )}
    </div>
  );
};
