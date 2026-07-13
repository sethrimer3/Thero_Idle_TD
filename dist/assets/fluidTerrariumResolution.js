// Shared helper to cap terrarium canvas resolution across Bet and achievements views.
export function resolveTerrariumDevicePixelRatio() {
  // Keep the backing store reasonable on dense displays while preserving crisp outlines.
  const rawRatio = Number.isFinite(window?.devicePixelRatio) && window.devicePixelRatio > 0
    ? window.devicePixelRatio
    : 1;
  return Math.max(1, Math.min(rawRatio, 2));
}
