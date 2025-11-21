/**
 * Tower Equation Blueprints Index
 * 
 * Aggregates all tower blueprints from individual modules and exports them
 * as a single TOWER_EQUATION_BLUEPRINTS object for backwards compatibility.
 */

import { mindGate } from './mindGate.js';
import { alpha, beta, gamma } from './basicTowers.js';
import { delta, epsilon, zeta, eta, theta, iota } from './greekTowers.js';
import { kappa, lambda, mu, nu, xi, omicron, pi, rho, sigma, tau, upsilon, phi, chi, psi, omega } from './advancedTowers.js';

/**
 * Complete tower equation blueprints object.
 * Maps tower IDs to their blueprint definitions.
 */
export const TOWER_EQUATION_BLUEPRINTS = {
  'mind-gate': mindGate,
  alpha,
  beta,
  gamma,
  delta,
  epsilon,
  eta,
  theta,
  iota,
  kappa,
  lambda,
  mu,
  zeta,
  nu,
  xi,
  omicron,
  pi,
  rho,
  sigma,
  tau,
  upsilon,
  phi,
  chi,
  psi,
  omega,
};

/**
 * Helper function to get a tower equation blueprint by ID.
 * 
 * @param {string} towerId - The tower identifier
 * @returns {Object|null} The tower blueprint or null if not found
 */
export function getTowerEquationBlueprint(towerId) {
  if (!towerId) {
    return null;
  }
  return TOWER_EQUATION_BLUEPRINTS[towerId] || null;
}
