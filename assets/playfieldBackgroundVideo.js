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
  video.autoplay = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('muted', '');
  video.setAttribute('autoplay', '');
  video.setAttribute('loop', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');

  let playbackRetryCount = 0;
  let interactionUnlockBound = false;

  /**
   * Re-issue play() requests across browser lifecycle events because some mobile engines ignore the first autoplay attempt.
   */
  const ensurePlayback = () => {
    if (document.hidden) {
      return;
    }

    if (video.ended) {
      // Rewind the decorative clip before replaying so manual loop recovery restarts from frame zero.
      video.currentTime = 0;
    }

    const playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => {
        if (interactionUnlockBound) {
          return;
        }

        interactionUnlockBound = true;

        /**
         * Retry the muted playback after the first user gesture so browsers with strict autoplay gating can unlock the loop.
         */
        const unlockPlayback = () => {
          document.removeEventListener('pointerdown', unlockPlayback, true);
          document.removeEventListener('touchstart', unlockPlayback, true);
          document.removeEventListener('keydown', unlockPlayback, true);
          interactionUnlockBound = false;
          ensurePlayback();
        };

        document.addEventListener('pointerdown', unlockPlayback, true);
        document.addEventListener('touchstart', unlockPlayback, true);
        document.addEventListener('keydown', unlockPlayback, true);
      });
    }
  };

  /**
   * Retry a few times while metadata arrives because Safari occasionally resolves layout before honoring autoplay.
   */
  const schedulePlaybackRetry = () => {
    if (playbackRetryCount >= 4) {
      return;
    }
    playbackRetryCount += 1;
    window.setTimeout(() => {
      ensurePlayback();
    }, 120 * playbackRetryCount);
  };

  video.addEventListener('loadedmetadata', () => {
    markVideoReady();
    schedulePlaybackRetry();
  });
  video.addEventListener('loadeddata', () => {
    markVideoReady();
    schedulePlaybackRetry();
  });
  video.addEventListener('canplay', () => {
    markVideoReady();
    ensurePlayback();
  });
  video.addEventListener('canplaythrough', ensurePlayback);
  video.addEventListener('ended', () => {
    // Force a manual restart as a safety net for engines that occasionally ignore the loop attribute on inline video.
    video.currentTime = 0;
    ensurePlayback();
  });
  document.addEventListener('visibilitychange', ensurePlayback);
  window.addEventListener('pageshow', ensurePlayback);

  // Reset the media element once the playback flags are configured so the browser re-evaluates autoplay with the final attributes.
  video.load();

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    markVideoReady();
  }
  ensurePlayback();
  schedulePlaybackRetry();

  return {
    destroy() {
      document.removeEventListener('visibilitychange', ensurePlayback);
      window.removeEventListener('pageshow', ensurePlayback);
    },
  };
}
