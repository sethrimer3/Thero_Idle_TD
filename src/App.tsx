import { useState, useEffect } from 'react';
import { GameState, TowerType, Tower } from './types/game';
import { GameBoard } from './components/GameBoard';
import { TowerShop } from './components/TowerShop';
import { GameStats } from './components/GameStats';
import { useGameLoop, spawnWave } from './hooks/useGameLoop';
import { useIdleProgress } from './hooks/useIdleProgress';
import { STARTING_GOLD, STARTING_LIVES, TOWER_CONFIGS } from './utils/gameConfig';
import { supabase } from './utils/supabase';
import './App.css';

type AppTab = 'level' | 'towers' | 'powder' | 'options';

type LevelBlueprint = {
  id: number;
  sigil: string;
  name: string;
  formula: string;
  description: string;
};

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

const LEVEL_BLUEPRINTS: LevelBlueprint[] = [
  {
    id: 1,
    sigil: 'Σ',
    name: 'Spiral of Sums',
    formula: 'hpₙ = 12Σₖ₌₁ⁿ k',
    description: 'Prime-backed runners trace a logarithmic spiral. Each loop advances the wave multiplier by Σ n.',
  },
  {
    id: 2,
    sigil: 'Φ',
    name: 'Golden Cascade',
    formula: 'hpₙ = 34 · φⁿ',
    description: 'Fibonacci drifters descend twin lanes. Enemies split, recombine, and grow with the golden ratio.',
  },
  {
    id: 3,
    sigil: 'Π',
    name: 'Integral Causeway',
    formula: 'reward(t) = ∫₀ᵗ (1 + ln x) dx',
    description: 'A looping promenade where powder gusts thicken the reward integral over idle time.',
  },
];

function App() {
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [selectedTower, setSelectedTower] = useState<TowerType | null>(null);
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<AppTab>('level');
  const [selectedLevel, setSelectedLevel] = useState<number>(LEVEL_BLUEPRINTS[0].id);
  const [optionsState, setOptionsState] = useState({
    sound: true,
    notation: true,
    notifications: false,
  });

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
        setSaveMessage('Σ Game vector restored.');
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
        setSaveMessage('⚠ Save diverged.');
      } else {
        setSaveMessage('✓ Progress integrated.');
      }

      setTimeout(() => setSaveMessage(''), 2000);
    } catch (error) {
      console.error('Error saving game:', error);
      setSaveMessage('⚠ Save diverged.');
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

  const toggleOption = (key: keyof typeof optionsState) => {
    setOptionsState(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedBlueprint = LEVEL_BLUEPRINTS.find(level => level.id === selectedLevel) ?? LEVEL_BLUEPRINTS[0];

  const renderLevelTab = () => (
    <div className="tab-section">
      <div className="panel">
        <h2 className="panel-title">Level Selection</h2>
        <div className="level-grid">
          {LEVEL_BLUEPRINTS.map(level => (
            <button
              key={level.id}
              onClick={() => setSelectedLevel(level.id)}
              className={`level-card${selectedLevel === level.id ? ' is-active' : ''}`}
            >
              <div className="level-name">{`${level.sigil} ${level.name}`}</div>
              <div className="level-formula">{level.formula}</div>
              <div className="level-description">{level.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Field Work</h2>
        <div className="board-wrapper">
          <div className="board-note">
            {`${selectedBlueprint.sigil} ${selectedBlueprint.name}`} • Wave scaling: {selectedBlueprint.formula}
          </div>
          <div className="board-slate">
            <GameBoard
              gameState={gameState}
              selectedTower={selectedTower}
              onCellClick={handleCellClick}
            />
          </div>
          <div className="board-note">
            Place towers on empty glyph nodes. Tap a placed tower to elevate its exponent.
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Operations Ledger</h2>
        <GameStats
          gameState={gameState}
          onStartWave={handleStartWave}
          onSaveGame={saveGame}
          onResetGame={handleResetGame}
        />
      </div>
    </div>
  );

  const renderTowerTab = () => (
    <div className="tab-section">
      <div className="panel">
        <h2 className="panel-title">Tower Lexicon</h2>
        <p className="guide-text">
          Each structure channels a unique equation. Select a glyph to ready its construction, then return to the field to place it.
        </p>
        <TowerShop
          gold={gameState.gold}
          selectedTower={selectedTower}
          onSelectTower={setSelectedTower}
        />
      </div>
    </div>
  );

  const renderPowderTab = () => (
    <div className="tab-section">
      <div className="panel">
        <h2 className="panel-title">Powder Simulation</h2>
        <p className="guide-text">
          The powder crucible operates while idle. Shape dunes, redirect falling sand, and harvest drift integrals to amplify tower coefficients.
        </p>
        <div className="powder-grid">
          <div className="powder-cell">
            <h3 className="powder-title">Δ Sandfall</h3>
            <p className="powder-detail">
              Tilt the device to bias the sand emitter. Capture grains in sigil basins to earn <span className="helper-emphasis">ψ-powder</span>, a multiplier applied to projectile speed.
            </p>
          </div>
          <div className="powder-cell">
            <h3 className="powder-title">∂ Heat Bloom</h3>
            <p className="powder-detail">
              Trace fractal boundaries to heat sand. The temperature integral powers <span className="helper-emphasis">Ω-overflow</span>, spilling bonus gold into the ledger every minute.
            </p>
          </div>
          <div className="powder-cell">
            <h3 className="powder-title">∇ Resonance</h3>
            <p className="powder-detail">
              Align powder streams with active towers. Matching glyphs double the tower&apos;s current exponent for the next wave.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderOptionsTab = () => (
    <div className="tab-section">
      <div className="panel">
        <h2 className="panel-title">Options &amp; Guidance</h2>
        <div className="option-list">
          <div className="option-row">
            <span className="option-label">Sound Sigils</span>
            <button
              type="button"
              className={`toggle${optionsState.sound ? ' is-on' : ''}`}
              onClick={() => toggleOption('sound')}
            />
          </div>
          <div className="option-row">
            <span className="option-label">Scientific Notation</span>
            <button
              type="button"
              className={`toggle${optionsState.notation ? ' is-on' : ''}`}
              onClick={() => toggleOption('notation')}
            />
          </div>
          <div className="option-row">
            <span className="option-label">Idle Notifications</span>
            <button
              type="button"
              className={`toggle${optionsState.notifications ? ' is-on' : ''}`}
              onClick={() => toggleOption('notifications')}
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Field Notes</h2>
        <p className="guide-text">
          Waves scale according to the selected blueprint. Powder earnings cascade into the tower ledger at the start of each wave. Keep the glyph wheel balanced: <span className="helper-emphasis">damage</span>, <span className="helper-emphasis">range</span>, and <span className="helper-emphasis">tempo</span> all draw from the same arcane constant.
        </p>
      </div>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'level':
        return renderLevelTab();
      case 'towers':
        return renderTowerTab();
      case 'powder':
        return renderPowderTab();
      case 'options':
      default:
        return renderOptionsTab();
    }
  };

  const tabs: { id: AppTab; label: string; glyph: string }[] = [
    { id: 'level', label: 'Arena', glyph: 'Λ' },
    { id: 'towers', label: 'Towers', glyph: 'Σ' },
    { id: 'powder', label: 'Powder', glyph: 'Ψ' },
    { id: 'options', label: 'Codex', glyph: 'Ω' },
  ];

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Glyph Defense Idle</h1>
        <p className="app-subtitle">A mystic study in tower calculus</p>
      </header>

      {saveMessage && (
        <div className="save-toast">{saveMessage}</div>
      )}

      <main className="main-content">{renderActiveTab()}</main>

      <nav className="tab-bar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button${activeTab === tab.id ? ' is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            <strong>{tab.glyph}</strong>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
