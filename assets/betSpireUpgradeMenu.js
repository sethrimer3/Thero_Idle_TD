// BET Spire Upgrade Menu
// Manages particle generator purchases and upgrades below the BET spire render

import { getBetSpireRenderInstance, PARTICLE_TIERS } from './betSpireRender.js';

// Generator definitions for each particle tier
const PARTICLE_GENERATORS = [
  {
    id: 'sand-generator',
    tierId: 'sand',
    tierName: 'Sand',
    baseCost: 10,
    costMultiplier: 1.15,
    particlesPerSecond: 1,
    description: 'Generate sand particles',
  },
  {
    id: 'quartz-generator',
    tierId: 'quartz',
    tierName: 'Quartz',
    baseCost: 100,
    costMultiplier: 1.15,
    particlesPerSecond: 0.1,
    description: 'Generate quartz particles',
  },
  {
    id: 'ruby-generator',
    tierId: 'ruby',
    tierName: 'Ruby',
    baseCost: 1000,
    costMultiplier: 1.15,
    particlesPerSecond: 0.01,
    description: 'Generate ruby particles',
  },
  {
    id: 'sunstone-generator',
    tierId: 'sunstone',
    tierName: 'Sunstone',
    baseCost: 10000,
    costMultiplier: 1.15,
    particlesPerSecond: 0.001,
    description: 'Generate sunstone particles',
  },
  {
    id: 'citrine-generator',
    tierId: 'citrine',
    tierName: 'Citrine',
    baseCost: 100000,
    costMultiplier: 1.15,
    particlesPerSecond: 0.0001,
    description: 'Generate citrine particles',
  },
];

/**
 * Create the BET spire upgrade menu system
 */
export function createBetSpireUpgradeMenu({
  formatWholeNumber = (value) => String(Math.floor(value)),
  formatGameNumber = (value) => String(value),
  formatDecimal = (value, places = 2) => value?.toFixed ? value.toFixed(places) : String(value),
} = {}) {
  // Generator state: tracks owned count for each generator
  const generatorState = {};
  PARTICLE_GENERATORS.forEach(gen => {
    generatorState[gen.id] = 0;
  });

  // Accumulated time for particle generation
  let lastGenerationTime = Date.now();

  /**
   * Calculate the cost of the next generator purchase
   */
  function getGeneratorCost(generatorId) {
    const generator = PARTICLE_GENERATORS.find(g => g.id === generatorId);
    if (!generator) return 0;
    
    const owned = generatorState[generatorId] || 0;
    return Math.ceil(generator.baseCost * Math.pow(generator.costMultiplier, owned));
  }

  /**
   * Purchase a generator if the player has enough sand
   */
  function purchaseGenerator(generatorId, sandBank) {
    const cost = getGeneratorCost(generatorId);
    
    if (sandBank < cost) {
      return { success: false, cost, sandRemaining: sandBank };
    }
    
    generatorState[generatorId] = (generatorState[generatorId] || 0) + 1;
    const sandRemaining = sandBank - cost;
    
    return { success: true, cost, sandRemaining, owned: generatorState[generatorId] };
  }

  /**
   * Get the total production rate of all generators
   */
  function getTotalProductionRate() {
    return PARTICLE_GENERATORS.reduce((total, generator) => {
      const owned = generatorState[generator.id] || 0;
      return total + (owned * generator.particlesPerSecond);
    }, 0);
  }

  /**
   * Generate particles based on elapsed time
   */
  function generateParticles() {
    const renderInstance = getBetSpireRenderInstance();
    if (!renderInstance) return;

    const now = Date.now();
    const elapsedSeconds = (now - lastGenerationTime) / 1000;
    lastGenerationTime = now;

    PARTICLE_GENERATORS.forEach(generator => {
      const owned = generatorState[generator.id] || 0;
      if (owned > 0) {
        const particlesToGenerate = owned * generator.particlesPerSecond * elapsedSeconds;
        
        // Add whole particles
        const wholeParticles = Math.floor(particlesToGenerate);
        for (let i = 0; i < wholeParticles; i++) {
          renderInstance.addParticle(generator.tierId, 0); // Add small particles
        }
      }
    });
  }

  /**
   * Update the upgrade menu display
   */
  function updateDisplay(sandBank) {
    const menuContainer = document.getElementById('bet-upgrade-menu');
    if (!menuContainer) return;

    const generatorList = menuContainer.querySelector('.bet-generator-list');
    if (!generatorList) return;

    generatorList.innerHTML = '';

    PARTICLE_GENERATORS.forEach(generator => {
      const owned = generatorState[generator.id] || 0;
      const cost = getGeneratorCost(generator.id);
      const canAfford = sandBank >= cost;

      const generatorItem = document.createElement('div');
      generatorItem.className = 'bet-generator-item';
      if (!canAfford) {
        generatorItem.classList.add('bet-generator-item--disabled');
      }

      const generatorInfo = document.createElement('div');
      generatorInfo.className = 'bet-generator-info';
      
      const generatorName = document.createElement('div');
      generatorName.className = 'bet-generator-name';
      generatorName.textContent = `${generator.tierName} Generator`;
      
      const generatorStats = document.createElement('div');
      generatorStats.className = 'bet-generator-stats';
      generatorStats.textContent = `Owned: ${owned} | +${formatDecimal(generator.particlesPerSecond, 3)}/s`;

      generatorInfo.appendChild(generatorName);
      generatorInfo.appendChild(generatorStats);

      const purchaseButton = document.createElement('button');
      purchaseButton.className = 'bet-generator-purchase';
      purchaseButton.textContent = `${formatGameNumber(cost)} Sand`;
      purchaseButton.disabled = !canAfford;
      purchaseButton.dataset.generatorId = generator.id;

      generatorItem.appendChild(generatorInfo);
      generatorItem.appendChild(purchaseButton);
      generatorList.appendChild(generatorItem);
    });

    // Update the total production rate display
    const productionRateElement = document.getElementById('bet-total-production');
    if (productionRateElement) {
      const totalRate = getTotalProductionRate();
      productionRateElement.textContent = `Total: ${formatDecimal(totalRate, 3)} particles/s`;
    }

    // Update the particle factor display
    const renderInstance = getBetSpireRenderInstance();
    if (renderInstance) {
      const status = renderInstance.getParticleFactorStatus();
      
      const factorElement = document.getElementById('bet-particle-factor');
      if (factorElement) {
        factorElement.textContent = `Particle Factor: ${formatGameNumber(status.particleFactor)}`;
      }

      const milestoneElement = document.getElementById('bet-milestone-progress');
      if (milestoneElement) {
        const progressPercent = Math.min(100, status.progressToNext * 100);
        milestoneElement.textContent = `Next BET glyph at ${formatGameNumber(status.currentMilestone)} (${formatDecimal(progressPercent, 1)}%)`;
      }

      const glyphsElement = document.getElementById('bet-glyphs-earned');
      if (glyphsElement) {
        glyphsElement.textContent = `BET Glyphs Earned: ${status.betGlyphsAwarded}`;
      }
    }
  }

  /**
   * Bind click handlers to purchase buttons
   */
  function bindPurchaseButtons(getSandBank, setSandBank) {
    const menuContainer = document.getElementById('bet-upgrade-menu');
    if (!menuContainer) return;

    menuContainer.addEventListener('click', (event) => {
      const button = event.target.closest('.bet-generator-purchase');
      if (!button || button.disabled) return;

      const generatorId = button.dataset.generatorId;
      const currentSand = getSandBank();
      const result = purchaseGenerator(generatorId, currentSand);

      if (result.success) {
        setSandBank(result.sandRemaining);
        updateDisplay(result.sandRemaining);
      }
    });
  }

  /**
   * Start the particle generation loop
   */
  function startGenerationLoop() {
    setInterval(() => {
      generateParticles();
    }, 1000); // Generate particles every second
  }

  return {
    generatorState,
    getGeneratorCost,
    purchaseGenerator,
    getTotalProductionRate,
    generateParticles,
    updateDisplay,
    bindPurchaseButtons,
    startGenerationLoop,
  };
}
