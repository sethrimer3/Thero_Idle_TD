// Bet Spire Particle Inventory Display
// Updates the particle inventory table below the Bet Spire canvas

import { getBetSpireRenderInstance, PARTICLE_TIERS } from './betSpireRender.js';

let updateInterval = null;

/**
 * Initialize the particle inventory display
 */
export function initParticleInventoryDisplay() {
  const tableBody = document.getElementById('bet-particle-inventory-body');
  if (!tableBody) {
    console.warn('Particle inventory table body not found');
    return;
  }

  // Create initial rows for all tiers
  PARTICLE_TIERS.forEach(tier => {
    const row = document.createElement('tr');
    row.dataset.tierId = tier.id;
    
    const nameCell = document.createElement('td');
    nameCell.textContent = tier.name;
    nameCell.className = 'particle-tier-name';
    
    const countCell = document.createElement('td');
    countCell.textContent = '0';
    countCell.className = 'particle-count';
    countCell.id = `particle-count-${tier.id}`;
    
    row.appendChild(nameCell);
    row.appendChild(countCell);
    tableBody.appendChild(row);
  });

  // Start periodic updates
  startInventoryUpdates();
}

/**
 * Update the particle inventory display
 */
export function updateParticleInventoryDisplay() {
  const renderInstance = getBetSpireRenderInstance();
  if (!renderInstance) {
    return;
  }

  const inventory = renderInstance.getInventoryDisplay();
  
  inventory.forEach(tierInfo => {
    const countCell = document.getElementById(`particle-count-${tierInfo.id}`);
    if (countCell) {
      countCell.textContent = tierInfo.count.toString();
      
      // Highlight non-zero counts
      const row = countCell.parentElement;
      if (tierInfo.count > 0) {
        row.classList.add('has-particles');
      } else {
        row.classList.remove('has-particles');
      }
    }
  });
}

/**
 * Start periodic updates of the inventory display
 */
function startInventoryUpdates() {
  // Update every 100ms to keep the display responsive
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  updateInterval = setInterval(updateParticleInventoryDisplay, 100);
}

/**
 * Stop periodic updates of the inventory display
 */
export function stopInventoryUpdates() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}
