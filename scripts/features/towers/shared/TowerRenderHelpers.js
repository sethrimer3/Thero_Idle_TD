/**
 * Shared rendering helpers for tower simulation files (Phase 3.1.3).
 *
 * This module consolidates sprite-loading and cache-building logic that was
 * previously copy-pasted verbatim into every tower file that uses a palette-tinted
 * projectile sprite (alpha, beta, gamma, ...).  Extracting it here guarantees
 * all towers behave identically on palette changes and reduces boilerplate.
 *
 * Exports:
 *   - createShotSpriteCache – factory that encapsulates the full sprite-load /
 *       palette-tint / cache-rebuild lifecycle for one projectile sprite.
 */

import { samplePaletteGradient } from '../../../../assets/colorSchemeUtils.js';
import { normalizeParticleColor } from './TowerUtils.js';

/**
 * Create a self-contained palette-tinted sprite cache for a single projectile sprite.
 *
 * The factory returns an object exposing:
 *   - `cache`   {HTMLCanvasElement[]} – live array of tinted canvas variants; always
 *               the same array reference so existing `spriteCacheResolver: () => cache`
 *               closures remain valid after a palette rebuild.
 *   - `refresh` {Function}            – rebuild the cache from the current palette.
 *
 * Internally, image loading is lazy: the base sprite is fetched the first time
 * `refresh()` is called.  If the image is still loading when `refresh()` is invoked,
 * a flag is set so the cache is rebuilt automatically once the load completes.
 *
 * @param {string} spritePath   - URL / path to the white-silhouette base sprite.
 * @param {number} [sampleCount=12] - Number of evenly-spaced palette samples to cache.
 * @returns {{ cache: HTMLCanvasElement[], refresh: Function }}
 */
export function createShotSpriteCache(spritePath, sampleCount = 12) {
  // Mutable state lives inside the closure so each call site gets an isolated instance.
  /** @type {HTMLCanvasElement[]} */
  const cache = [];
  /** @type {HTMLImageElement|null} */
  let image = null;
  /** @type {boolean} */
  let ready = false;
  /** @type {boolean} */
  let needsRefresh = false;

  // Lazily load the base sprite so cache generation can reuse the decoded image.
  function ensureImageLoaded() {
    if (typeof Image === 'undefined') {
      return null;
    }
    if (image) {
      return image;
    }
    const img = new Image();
    img.onload = () => {
      // Mark the sprite ready and rebuild caches if a palette swap happened mid-load.
      ready = true;
      if (needsRefresh) {
        needsRefresh = false;
        buildCache();
      }
    };
    // Begin loading the white sprite so tinting can happen when palettes change.
    img.src = spritePath;
    image = img;
    return image;
  }

  // Build a set of palette-tinted canvases that can be reused for fast sprite drawing.
  function buildCache() {
    const img = ensureImageLoaded();
    if (!img || !ready || !img.naturalWidth || !img.naturalHeight) {
      needsRefresh = true;
      return;
    }
    if (typeof document === 'undefined') {
      return;
    }
    cache.length = 0;
    for (let index = 0; index < sampleCount; index += 1) {
      const ratio = sampleCount > 1 ? index / (sampleCount - 1) : 0;
      const color = normalizeParticleColor(samplePaletteGradient(ratio));
      if (!color) {
        continue;
      }
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        continue;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      cache.push(canvas);
    }
  }

  return {
    /** Direct reference to the tinted-canvas array used by spriteCacheResolver closures. */
    cache,
    /** Rebuild all palette-tinted variants from the current active theme. */
    refresh() {
      buildCache();
    },
  };
}
