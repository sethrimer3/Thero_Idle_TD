// Gameplay configuration loading helpers extracted from the main orchestration module.
// The utilities in this file coordinate fetch fallbacks, embedded JSON lookups, and
// module-based imports so the bootstrap sequence can remain leaner.

// The global key used when the gameplay configuration is inlined by the hosting page.
const EMBEDDED_CONFIG_GLOBAL_KEY = '__THERO_EMBEDDED_GAMEPLAY_CONFIG__';

/**
 * Resolves a fallback URL for static hosting scenarios where the primary fetch might fail.
 * Ensures we attempt to load from the same origin as the site when served from a CDN mirror.
 */
export function resolveFallbackUrl(relativePath) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const base = new URL(window.location.href);
    base.hash = '';
    base.search = '';
    return new URL(relativePath.replace(/^\.\//, ''), base).href;
  } catch (error) {
    console.warn('Failed to resolve fallback URL for', relativePath, error);
    return null;
  }
}

/**
 * Attempts to load JSON data from a primary URL with optional fallback to a relative asset path.
 * Keeps track of errors so the caller receives useful diagnostics if both attempts fail.
 */
export async function fetchJsonWithFallback(urlPrimary, relativePath) {
  const attempts = [];

  if (urlPrimary) {
    attempts.push(urlPrimary);
  }

  const fallbackHref = resolveFallbackUrl(relativePath);
  if (fallbackHref && !attempts.includes(fallbackHref)) {
    attempts.push(fallbackHref);
  }

  let lastError = null;

  for (const url of attempts) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        lastError = new Error(`Failed to load JSON from ${url}: ${response.status}`);
        continue;
      }
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('JSON fetch failed');
}

/**
 * Loads JSON data using XMLHttpRequest so file:// deployments can still resolve local assets.
 * This is a fallback when fetch-based loaders fail or are unavailable.
 */
export function loadJsonViaXhr(url) {
  // Guard against environments without XMLHttpRequest (e.g., non-browser contexts).
  if (typeof XMLHttpRequest === 'undefined') {
    return Promise.reject(new Error('XMLHttpRequest is unavailable in this environment.'));
  }

  return new Promise((resolve, reject) => {
    // Construct a one-off request to retrieve the JSON payload.
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'json';
    request.onload = () => {
      if (request.status && request.status >= 400) {
        reject(new Error(`Failed to load JSON via XHR from ${url}: ${request.status}`));
        return;
      }
      // If responseType JSON is unsupported, fall back to manual parsing.
      if (request.response && typeof request.response === 'object') {
        resolve(request.response);
        return;
      }
      try {
        resolve(JSON.parse(request.responseText));
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => {
      reject(new Error(`Network error while loading JSON via XHR from ${url}.`));
    };
    request.send();
  });
}

/**
 * Retrieves the embedded gameplay configuration if one has been attached to the global scope.
 * Useful for offline or statically bundled builds that inline the configuration at build time.
 */
export function getEmbeddedGameplayConfig(globalKey = EMBEDDED_CONFIG_GLOBAL_KEY) {
  const root =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof window !== 'undefined'
        ? window
        : typeof self !== 'undefined'
          ? self
          : null;

  if (!root) {
    return null;
  }

  const embedded = root[globalKey];
  return embedded && typeof embedded === 'object' ? embedded : null;
}

/**
 * Loads the gameplay configuration via the Fetch API, falling back to static asset resolution.
 * Throws if the environment does not provide fetch so the caller can attempt alternate strategies.
 */
export async function loadGameplayConfigViaFetch(primaryUrl, relativePath) {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is unavailable in this environment.');
  }

  return fetchJsonWithFallback(primaryUrl, relativePath);
}

/**
 * Loads the gameplay configuration via XMLHttpRequest to support environments without fetch
 * or when file:// fetches fail because of browser security policies.
 */
export async function loadGameplayConfigViaXhr(primaryUrl) {
  return loadJsonViaXhr(primaryUrl);
}

/**
 * Attempts to import a JSON module using dynamic import.
 * Returns null in environments that do not support JSON imports so
 * callers can fall back to fetch-based loaders.
 * 
 * Note: Import assertions/attributes are intentionally not used here
 * because they cause syntax errors in browsers that don't support them,
 * even when wrapped in try-catch or Function constructors.
 */
export async function importJsonModule(moduleUrl) {
  if (!moduleUrl) {
    return null;
  }

  // Skip JSON module imports entirely - they're not well supported
  // and cause syntax errors in many browsers. Instead, rely on fetch.
  return null;
}

export async function loadGameplayConfigViaModule(moduleUrl) {
  return importJsonModule(moduleUrl);
}
