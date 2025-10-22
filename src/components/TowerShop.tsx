import React from 'react';
import { TowerType } from '../types/game';
import { TOWER_CONFIGS } from '../utils/gameConfig';

interface TowerShopProps {
  gold: number;
  selectedTower: TowerType | null;
  onSelectTower: (type: TowerType) => void;
}

const TOWER_SYMBOLS: Record<TowerType, string> = {
  basic: 'α',
  sniper: 'λ',
  cannon: 'θ',
  lightning: 'ζ',
};

const TOWER_FORMULAS: Record<TowerType, string> = {
  basic: 'd(t) = 10 + 5⌊t/3⌋',
  sniper: 'crit = 0.25 · log₂(range)',
  cannon: 'AoE = πr² with r = level · 0.6',
  lightning: 'Δt = 800 · 0.85ˡᵉᵛᵉˡ',
};

export const TowerShop: React.FC<TowerShopProps> = ({ gold, selectedTower, onSelectTower }) => {
  const towerTypes: TowerType[] = ['basic', 'sniper', 'cannon', 'lightning'];

  return (
    <div className="tower-lexicon">
      {towerTypes.map(type => {
        const config = TOWER_CONFIGS[type][0];
        const canAfford = gold >= config.cost;
        const isSelected = selectedTower === type;

        return (
          <button
            key={type}
            type="button"
            onClick={() => onSelectTower(type)}
            className={`tower-card${isSelected ? ' is-selected' : ''}`}
            disabled={!canAfford && !isSelected}
            title="Select this glyph to prepare placement"
          >
            <div className="tower-heading">
              <span className="tower-symbol">{TOWER_SYMBOLS[type]}</span>
              <div>
                <div className="level-name" style={{ fontSize: '0.9rem' }}>{type.toUpperCase()}</div>
                <div className="tower-formula">{TOWER_FORMULAS[type]}</div>
              </div>
            </div>
            <div className="tower-meta">
              <span>Cost₀ = {config.cost}</span>
              <span>Damage₀ = {config.damage}</span>
              <span>Range₀ = {config.range}</span>
              <span>Tempo₀ = {config.attackSpeed}ms</span>
            </div>
            {!canAfford && !isSelected && (
              <span className="guide-text">Earn more gold to awaken this glyph.</span>
            )}
          </button>
        );
      })}
      {selectedTower && (
        <p className="guide-text">
          {`Selected glyph ${TOWER_SYMBOLS[selectedTower]} • Tap a vacant node in the arena to cast it.`}
        </p>
      )}
    </div>
  );
};
