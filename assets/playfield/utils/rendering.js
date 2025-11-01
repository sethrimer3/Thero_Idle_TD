import { samplePaletteGradient } from '../../colorSchemeUtils.js';

// Normalize projectile color data so beam rendering can rely on palette-aware RGB objects.
export function normalizeProjectileColor(candidate, fallbackPosition = 1) {
  if (
    candidate &&
    typeof candidate === 'object' &&
    Number.isFinite(candidate.r) &&
    Number.isFinite(candidate.g) &&
    Number.isFinite(candidate.b)
  ) {
    return {
      r: Math.max(0, Math.min(255, Math.round(candidate.r))),
      g: Math.max(0, Math.min(255, Math.round(candidate.g))),
      b: Math.max(0, Math.min(255, Math.round(candidate.b))),
    };
  }
  const ratio = Math.max(0, Math.min(1, fallbackPosition));
  const fallback = samplePaletteGradient(ratio) || { r: 139, g: 247, b: 255 };
  return {
    r: Math.max(0, Math.min(255, Math.round(fallback.r))),
    g: Math.max(0, Math.min(255, Math.round(fallback.g))),
    b: Math.max(0, Math.min(255, Math.round(fallback.b))),
  };
}

// Render an additive gradient blob so shared connection motes inherit the alpha burst glow.
export function drawConnectionMoteGlow(ctx, x, y, radius, color, opacity = 1) {
  if (!ctx || !color) {
    return;
  }
  const baseRadius = Math.max(1.6, radius || 2.4);
  const glowRadius = baseRadius * 2.4;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
  const alpha = Math.max(0, Math.min(1, opacity));
  gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`);
  gradient.addColorStop(0.45, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.45})`);
  gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
  ctx.fill();
}
