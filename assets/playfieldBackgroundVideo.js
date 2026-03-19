const MENU_BACKGROUND_VIDEO_SELECTOR = '[data-menu-background-video]';

/**
 * Initialize the shared looping menu video so every tab panel inherits the same animated backdrop.
 */
export function initializePlayfieldBackgroundVideo() {
  const mainStage = document.getElementById('main-stage');
  const video = document.querySelector(MENU_BACKGROUND_VIDEO_SELECTOR);
  if (!mainStage || !video) {
    return null;
  }

  /**
   * Reveal the shared menu video layer only after media data is available to avoid a black flash on startup.
   */
  const markVideoReady = () => {
    mainStage.dataset.menuBackgroundVideoReady = 'true';
  };

  // Keep the video playing inline on mobile so it can behave like a decorative texture behind every menu.
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');

  video.addEventListener('loadeddata', markVideoReady);
  video.addEventListener('canplay', markVideoReady);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      return;
    }
    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => {});
    }
  });

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    markVideoReady();
  }
  const playAttempt = video.play();
  if (playAttempt && typeof playAttempt.catch === 'function') {
    playAttempt.catch(() => {});
  }

  return {
    destroy() {
      video.removeEventListener('loadeddata', markVideoReady);
      video.removeEventListener('canplay', markVideoReady);
    },
  };
}
