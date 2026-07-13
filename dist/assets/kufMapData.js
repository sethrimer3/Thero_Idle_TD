/**
 * Kuf map data loader. Provides a shared cache so UI and simulation modules can
 * react to the latest battlefield definitions without embedding JSON imports.
 */

import {
  fetchJsonWithFallback,
  importJsonModule,
} from './gameplayConfigLoaders.js';

const KUF_MAPS_RELATIVE_PATH = './data/kufMaps.json';
const KUF_MAPS_URL = new URL(KUF_MAPS_RELATIVE_PATH, import.meta.url);

let cachedKufMaps = [];
let kufMapLoadPromise = null;
const kufMapListeners = new Set();

// Lightweight cloning helper so consumers cannot mutate the cached dataset directly.
function cloneMaps(maps) {
  return Array.isArray(maps) ? maps.map((map) => ({ ...map })) : [];
}

function notifyKufMapListeners() {
  const snapshot = cloneMaps(cachedKufMaps);
  kufMapListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.error('Kuf map listener failed', error);
    }
  });
}

// Replace the cached dataset and propagate updates to subscribed components.
function updateCachedKufMaps(maps) {
  cachedKufMaps = cloneMaps(maps);
  notifyKufMapListeners();
}

/**
 * Retrieve a safe snapshot of the cached map list.
 * @returns {Array<object>}
 */
export function getCachedKufMaps() {
  return cloneMaps(cachedKufMaps);
}

/**
 * Ensure the Kuf map dataset is loaded, using fetch when available and
 * gracefully falling back to module imports.
 * @returns {Promise<Array<object>>}
 */
export async function loadKufMaps() {
  if (cachedKufMaps.length) {
    return getCachedKufMaps();
  }

  if (!kufMapLoadPromise) {
    kufMapLoadPromise = (async () => {
      let dataset = null;

      try {
        if (typeof fetch === 'function') {
          dataset = await fetchJsonWithFallback(KUF_MAPS_URL.href, KUF_MAPS_RELATIVE_PATH);
        }
      } catch (error) {
        console.warn('Kuf map fetch failed; attempting JSON module import.', error);
      }

      if (!dataset) {
        dataset = await importJsonModule(KUF_MAPS_URL.href);
      }

      const maps = Array.isArray(dataset?.maps) ? dataset.maps : [];
      updateCachedKufMaps(maps);
      return getCachedKufMaps();
    })()
      .catch((error) => {
        kufMapLoadPromise = null;
        throw error;
      })
      .finally(() => {
        kufMapLoadPromise = null;
      });
  }

  return kufMapLoadPromise;
}

/**
 * Subscribe to map updates so callers can refresh UI when new data arrives.
 * @param {(maps: Array<object>) => void} listener
 * @returns {() => void} Unsubscribe handle.
 */
export function onKufMapsReady(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  kufMapListeners.add(listener);
  if (cachedKufMaps.length) {
    listener(getCachedKufMaps());
  }
  return () => {
    kufMapListeners.delete(listener);
  };
}
