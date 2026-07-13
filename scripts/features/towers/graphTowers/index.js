/**
 * Graph Towers — barrel export for the Mathematical Test Tower Arsenal.
 *
 * Exports the shared framework and all four graph-based tower implementations:
 *   1. RegressionTower      — least-squares beam attacks
 *   2. DensityCollapseTower  — heatmap field with collapse explosions
 *   3. OrbitalCollapseTower  — radial energy with two-stage implosion
 *   4. PolynomialEngineTower — polynomial curve weaponisation
 *
 * Shared infrastructure:
 *   - GlyphEquation          — glyph-driven equation framework
 *   - GraphTowerBase          — shared graph + point pool + renderer base
 *   - GraphPointPool          — high-performance object pool
 *   - GraphRenderer           — cached grid + point drawing
 *   - EquationDisplay         — UI equation formatter
 */

// Shared framework.
export { GlyphEquation, GLYPH_TIERS, GLYPH_SYMBOLS, createGlyphCounts } from './GlyphEquation.js';
export { GraphTowerBase } from './GraphTowerBase.js';
export { GraphPointPool } from './GraphPointPool.js';
export { GraphRenderer } from './GraphRenderer.js';
export { EquationDisplay } from './EquationDisplay.js';

// Tower implementations.
export { RegressionTower } from './RegressionTower.js';
export { DensityCollapseTower } from './DensityCollapseTower.js';
export { OrbitalCollapseTower } from './OrbitalCollapseTower.js';
export { PolynomialEngineTower } from './PolynomialEngineTower.js';
