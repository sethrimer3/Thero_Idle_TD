// Bet Spire Placeholder - Simple tap interaction that shows +1

let tapCount = 0;

export function initBetSpirePlaceholder() {
  const container = document.getElementById('bet-placeholder-container');
  const tapsContainer = document.getElementById('bet-placeholder-taps');
  
  if (!container || !tapsContainer) {
    return;
  }
  
  container.addEventListener('click', (event) => {
    tapCount++;
    
    // Get click position relative to container
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Create tap indicator
    const indicator = document.createElement('div');
    indicator.className = 'bet-tap-indicator';
    indicator.textContent = '+1';
    indicator.style.left = `${x}px`;
    indicator.style.top = `${y}px`;
    indicator.style.transform = 'translate(-50%, -50%)';
    
    tapsContainer.appendChild(indicator);
    
    // Remove after animation completes
    setTimeout(() => {
      indicator.remove();
    }, 800);
  });
}

export function getBetSpireTapCount() {
  return tapCount;
}
