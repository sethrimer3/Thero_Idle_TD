const PLAYFIELD_BACKGROUND_VIDEO_SELECTOR = '[data-playfield-background-video]';

/**
 * Create a percentage-based parallax controller for the battlefield background video.
 * The active panel scroll progress (0-100%) maps directly to the video's object-position.
 */
export function initializePlayfieldBackgroundVideo() {
  const playfield = document.getElementById('playfield');
  const video = document.querySelector(PLAYFIELD_BACKGROUND_VIDEO_SELECTOR);
  if (!playfield || !video) {
    return null;
  }

  let activeScrollContainer = null;

  /**
   * Find the tower panel scroll container so parallax follows the same percentage on every viewport.
   * Falls back to the document scroller if panel overflow is not active.
   * @returns {HTMLElement|DocumentElement}
   */
  const resolveScrollContainer = () => {
    const panel = playfield.closest('.panel');
    if (panel instanceof HTMLElement) {
      return panel;
    }
    return document.scrollingElement || document.documentElement;
  };

  /**
   * Update the video crop position so 0% scroll shows the top of the render and 100% shows the bottom.
   */
  const updateParallax = () => {
    const container = resolveScrollContainer();
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    const progress = maxScroll > 0 ? Math.min(1, Math.max(0, container.scrollTop / maxScroll)) : 0;
    playfield.style.setProperty('--playfield-background-progress', progress.toFixed(4));
    playfield.style.setProperty('--playfield-background-position', `${(progress * 100).toFixed(2)}%`);
  };

  /**
   * Rebind scroll listeners whenever the panel or layout changes.
   */
  const bindScrollContainer = () => {
    const nextContainer = resolveScrollContainer();
    if (activeScrollContainer === nextContainer) {
      return;
    }
    if (activeScrollContainer) {
      activeScrollContainer.removeEventListener('scroll', updateParallax);
    }
    activeScrollContainer = nextContainer;
    activeScrollContainer.addEventListener('scroll', updateParallax, { passive: true });
    updateParallax();
  };

  /**
   * Reveal the video layer only after media data is available to avoid a black flash on startup.
   */
  const markVideoReady = () => {
    playfield.dataset.backgroundVideoReady = 'true';
    updateParallax();
  };

  // Keep the video playing inline on mobile so it can behave like a decorative texture.
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');

  video.addEventListener('loadeddata', markVideoReady);
  video.addEventListener('canplay', markVideoReady);
  window.addEventListener('resize', bindScrollContainer, { passive: true });
  window.addEventListener('orientationchange', bindScrollContainer, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      return;
    }
    bindScrollContainer();
    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => {});
    }
  });

  // Observe class changes so tab switches or fullscreen layout changes keep the correct scroll source.
  const observer = new MutationObserver(() => {
    bindScrollContainer();
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const towerPanel = playfield.closest('.panel');
  if (towerPanel) {
    observer.observe(towerPanel, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  bindScrollContainer();
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    markVideoReady();
  }
  const playAttempt = video.play();
  if (playAttempt && typeof playAttempt.catch === 'function') {
    playAttempt.catch(() => {});
  }

  return {
    updateParallax,
    destroy() {
      if (activeScrollContainer) {
        activeScrollContainer.removeEventListener('scroll', updateParallax);
      }
      window.removeEventListener('resize', bindScrollContainer);
      window.removeEventListener('orientationchange', bindScrollContainer);
      observer.disconnect();
    },
  };
}
