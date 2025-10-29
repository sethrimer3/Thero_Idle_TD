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
 * Attempts to import the gameplay configuration using the module loader with JSON assertions.
 * Returns null when the module lacks a default export so the caller can continue fallback attempts.
 */
export async function loadGameplayConfigViaModule(moduleUrl) {
  try {
    const module = await import(moduleUrl, { assert: { type: 'json' } });
    if (module && module.default) {
      return module.default;
    }
  } catch (error) {
    throw error;
  }
  return null;
}
