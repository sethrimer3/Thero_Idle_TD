// BET Spire Upgrade Menu
// Manages particle generator purchases and upgrades below the BET spire render

import { getBetSpireRenderInstance, PARTICLE_TIERS } from './betSpireRender.js';

// Generator definitions for each particle tier
// Each generator costs 10 particles of its type
const PARTICLE_GENERATORS = PARTICLE_TIERS.map(tier => ({
  id: `${tier.id}-generator`,
  tierId: tier.id,
  tierName: tier.name,
  baseCost: 10, // Cost in particles of this tier
  costMultiplier: 1.15,
  particlesPerSecond: 1 / Math.pow(10, PARTICLE_TIERS.findIndex(t => t.id === tier.id)),
  description: `Generate ${tier.name.toLowerCase()} particles`,
}));

/**
 * Create the BET spire upgrade menu system
 */
export function createBetSpireUpgradeMenu({
  formatWholeNumber = (value) => String(Math.floor(value)),
  formatGameNumber = (value) => String(value),
  formatDecimal = (value, places = 2) => value?.toFixed ? value.toFixed(places) : String(value),
  state = {},
} = {}) {
  // Generator state: tracks owned count for each generator
  const generatorState = state.generators || {};
  const generatorRemainders = {}; // Carry fractional generation so slow generators still produce over time
  PARTICLE_GENERATORS.forEach(gen => {
    if (!Number.isFinite(generatorState[gen.id])) {
      generatorState[gen.id] = 0;
    }

    generatorRemainders[gen.id] = 0;
  });
  
  // Store reference for external access
  if (!state.generators) {
    state.generators = generatorState;
  }

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
   * Purchase a generator if the player has enough particles of the appropriate type
   */
  function purchaseGenerator(generatorId) {
    const renderInstance = getBetSpireRenderInstance();
    if (!renderInstance) {
      return { success: false, message: 'Render instance not available' };
    }
    
    const generator = PARTICLE_GENERATORS.find(g => g.id === generatorId);
    if (!generator) {
      return { success: false, message: 'Generator not found' };
    }
    
    const cost = getGeneratorCost(generatorId);
    const inventory = renderInstance.getInventory();
    const availableParticles = inventory.get(generator.tierId) || 0;
    
    if (availableParticles < cost) {
      return { success: false, cost, available: availableParticles };
    }
    
    // Deduct the cost by removing particles
    const particlesRemoved = renderInstance.removeParticlesByType(generator.tierId, cost);
    
    if (particlesRemoved < cost) {
      return { success: false, message: 'Failed to remove particles' };
    }
    
    generatorState[generatorId] = (generatorState[generatorId] || 0) + 1;
    
    return { success: true, cost, owned: generatorState[generatorId] };
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
        const particlesToGenerate = generatorRemainders[generator.id]
          + owned * generator.particlesPerSecond * elapsedSeconds;

        // Add whole particles
        const wholeParticles = Math.floor(particlesToGenerate);
        for (let i = 0; i < wholeParticles; i++) {
          renderInstance.addParticle(generator.tierId, 0); // Add small particles
        }

        // Keep fractional remainder so low-output generators eventually create particles
        generatorRemainders[generator.id] = particlesToGenerate - wholeParticles;
      }
    });
  }

  /**
   * Update the upgrade menu display
   */
  function updateDisplay() {
    const menuContainer = document.getElementById('bet-upgrade-menu');
    if (!menuContainer) return;

    const generatorList = menuContainer.querySelector('.bet-generator-list');
    if (!generatorList) return;
    
    const renderInstance = getBetSpireRenderInstance();
    if (!renderInstance) return;
    
    const inventory = renderInstance.getInventory();

    generatorList.innerHTML = '';

    PARTICLE_GENERATORS.forEach(generator => {
      const owned = generatorState[generator.id] || 0;
      const cost = getGeneratorCost(generator.id);
      const availableParticles = inventory.get(generator.tierId) || 0;
      const canAfford = availableParticles >= cost;
      
      // Get the tier color
      const tier = PARTICLE_TIERS.find(t => t.id === generator.tierId);
      const tierColor = tier ? `rgb(${tier.color.r}, ${tier.color.g}, ${tier.color.b})` : 'white';

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
      purchaseButton.textContent = `${formatGameNumber(cost)} ${generator.tierName}`;
      purchaseButton.style.color = tierColor;
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
      
      // Add particle factor equation display
      const equationElement = document.getElementById('bet-particle-equation');
      if (equationElement) {
        const equationParts = [];
        const unlockedTiers = [];
        
        // Get unlocked tiers from render instance
        PARTICLE_TIERS.forEach(tier => {
          const count = inventory.get(tier.id) || 0;
          if (count > 0) {
            unlockedTiers.push(tier);
          }
        });
        
        // Build equation with colored text
        equationElement.innerHTML = '';
        unlockedTiers.forEach((tier, index) => {
          const count = inventory.get(tier.id) || 0;
          
          // Add the particle count with its color
          const countSpan = document.createElement('span');
          countSpan.style.color = `rgb(${tier.color.r}, ${tier.color.g}, ${tier.color.b})`;
          countSpan.textContent = formatGameNumber(count);
          equationElement.appendChild(countSpan);
          
          // Add multiplication symbol if not the last item
          if (index < unlockedTiers.length - 1) {
            const multSpan = document.createElement('span');
            multSpan.style.color = 'white';
            multSpan.textContent = ' × ';
            equationElement.appendChild(multSpan);
          }
        });
        
        // Add equals and result
        if (unlockedTiers.length > 0) {
          const equalsSpan = document.createElement('span');
          equalsSpan.style.color = 'white';
          equalsSpan.textContent = ' = ';
          equationElement.appendChild(equalsSpan);
          
          const resultSpan = document.createElement('span');
          resultSpan.style.color = 'white';
          resultSpan.textContent = formatGameNumber(status.particleFactor);
          equationElement.appendChild(resultSpan);
        } else {
          equationElement.textContent = 'No particles yet';
        }
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
  function bindPurchaseButtons() {
    const menuContainer = document.getElementById('bet-upgrade-menu');
    if (!menuContainer) return;

    menuContainer.addEventListener('click', (event) => {
      const button = event.target.closest('.bet-generator-purchase');
      if (!button || button.disabled) return;

      const generatorId = button.dataset.generatorId;
      const result = purchaseGenerator(generatorId);

      if (result.success) {
        updateDisplay();
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
    getState: () => state,
  };
}
