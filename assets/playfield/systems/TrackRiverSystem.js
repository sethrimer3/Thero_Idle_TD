// Track River Particle System — extracted from SimplePlayfield (Build 710).
// Manages the decorative particle river that flows along the glyph lane.
// These functions use 'this' (the SimplePlayfield instance) via .call().

import { areBackgroundParticlesEnabled } from '../../preferences.js';

// ── Math constants ──────────────────────────────────────────────────────
const TWO_PI = Math.PI * 2;

/**
 * Advance track river particles along the glyph lane path.
 * Purely decorative — skipped entirely when ambient particles are disabled.
 */
export function updateTrackRiverParticles(delta) {
  if (!Array.isArray(this.trackRiverParticles) || !this.trackRiverParticles.length) {
    return;
  }
  // Track river particles are purely decorative; skip updates when ambient particles are disabled.
  if (!areBackgroundParticlesEnabled()) {
    return;
  }

  const dt = Math.max(0, Math.min(delta, 0.08));
  this.trackRiverPulse = Number.isFinite(this.trackRiverPulse) ? this.trackRiverPulse : 0;
  this.trackRiverPulse += dt * 0.6;
  const fullTurn = TWO_PI;
  if (this.trackRiverPulse >= fullTurn) {
    this.trackRiverPulse -= fullTurn;
  }

  const wrapProgress = (value) => {
    if (value > 1) {
      return value - 1;
    }
    if (value < 0) {
      return value + 1;
    }
    return value;
  };

  this.trackRiverParticles.forEach((particle) => {
    if (!particle) {
      return;
    }
    const speed = Number.isFinite(particle.speed) ? particle.speed : 0.05;
    const progress = Number.isFinite(particle.progress) ? particle.progress : Math.random();
    particle.progress = wrapProgress(progress + speed * dt);

    const phaseSpeed = Number.isFinite(particle.phaseSpeed) ? particle.phaseSpeed : 1;
    const nextPhase = (Number.isFinite(particle.phase) ? particle.phase : 0) + phaseSpeed * dt;
    particle.phase = nextPhase % fullTurn;

    const driftTimer = Number.isFinite(particle.driftTimer) ? particle.driftTimer : 0;
    particle.driftTimer = driftTimer - dt;
    if (particle.driftTimer <= 0) {
      particle.offsetTarget = (Math.random() - 0.5) * 0.8;
      particle.driftTimer = 0.6 + Math.random() * 1.3;
    }

    const driftRate = Number.isFinite(particle.driftRate) ? particle.driftRate : 0.6;
    const easing = Math.min(1, dt * driftRate);
    const offset = Number.isFinite(particle.offset) ? particle.offset : 0;
    const target = Number.isFinite(particle.offsetTarget) ? particle.offsetTarget : 0;
    particle.offset = offset + (target - offset) * easing;
  });

  if (Array.isArray(this.trackRiverTracerParticles) && this.trackRiverTracerParticles.length) {
    this.trackRiverTracerParticles.forEach((particle) => {
      if (!particle) {
        return;
      }
      const speed = Number.isFinite(particle.speed) ? particle.speed : 0.14;
      const progress = Number.isFinite(particle.progress) ? particle.progress : Math.random();
      particle.progress = wrapProgress(progress + speed * dt);

      const phaseSpeed = Number.isFinite(particle.phaseSpeed) ? particle.phaseSpeed : 1.6;
      const nextPhase = (Number.isFinite(particle.phase) ? particle.phase : 0) + phaseSpeed * dt;
      particle.phase = nextPhase % fullTurn;

      const driftTimer = Number.isFinite(particle.driftTimer) ? particle.driftTimer : 0;
      particle.driftTimer = driftTimer - dt;
      if (particle.driftTimer <= 0) {
        particle.offsetTarget = (Math.random() - 0.5) * 0.3;
        particle.driftTimer = 0.25 + Math.random() * 0.5;
      }

      const driftRate = Number.isFinite(particle.driftRate) ? particle.driftRate : 2.4;
      const easing = Math.min(1, dt * driftRate);
      const offset = Number.isFinite(particle.offset) ? particle.offset : 0;
      const target = Number.isFinite(particle.offsetTarget) ? particle.offsetTarget : 0;
      particle.offset = offset + (target - offset) * easing;
    });
  }
}
