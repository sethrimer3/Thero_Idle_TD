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
    nameCell.className = 'particle-tier-name';
    
    // Create particle name text node
    const tierNameSpan = document.createElement('span');
    tierNameSpan.textContent = tier.name;
    tierNameSpan.className = 'particle-tier-text';
    
    // Create count badge that appears next to the name
    const countBadge = document.createElement('span');
    countBadge.textContent = '0';
    countBadge.className = 'particle-count-badge';
    countBadge.id = `particle-count-badge-${tier.id}`;
    countBadge.style.color = `rgb(${tier.color.r}, ${tier.color.g}, ${tier.color.b})`;
    countBadge.style.fontWeight = 'bold';
    // Add a purple glow for Nullstone counts so the darkest tier stays readable.
    if (tier.id === 'nullstone') {
      countBadge.classList.add('particle-count-badge--nullstone');
    }
    
    nameCell.appendChild(tierNameSpan);
    nameCell.appendChild(countBadge);
    
    row.appendChild(nameCell);
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

  const inventoryBySize = renderInstance.getInventoryBySize();
  
  PARTICLE_TIERS.forEach(tier => {
    const countBadge = document.getElementById(`particle-count-badge-${tier.id}`);
    if (countBadge) {
      const counts = inventoryBySize.get(tier.id);
      if (counts) {
        // Format as "extra-large.large.medium.small" with leading zeros (e.g., "00.00.00.00")
        const formattedExtraLarge = String(counts['extra-large']).padStart(2, '0');
        const formattedLarge = String(counts.large).padStart(2, '0');
        const formattedMedium = String(counts.medium).padStart(2, '0');
        const formattedSmall = String(counts.small).padStart(2, '0');
        // Include extra-large digits so the largest tier is visible in the inventory display.
        const formattedCount = `${formattedExtraLarge}.${formattedLarge}.${formattedMedium}.${formattedSmall}`;
        countBadge.textContent = formattedCount;
        
        // Highlight non-zero counts (check if any size has particles)
        const row = countBadge.closest('tr');
        const hasParticles = counts.small > 0 || counts.medium > 0 || counts.large > 0 || counts['extra-large'] > 0;
        if (hasParticles) {
          row.classList.add('has-particles');
        } else {
          row.classList.remove('has-particles');
        }
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
