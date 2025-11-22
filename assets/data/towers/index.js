/**
 * Tower definition registry composed of individually sourced tower modules.
 */
import MIND_GATE_TOWER from './mind-gate.js';
import ALPHA_TOWER from './alpha.js';
import BETA_TOWER from './beta.js';
import GAMMA_TOWER from './gamma.js';
import DELTA_TOWER from './delta.js';
import EPSILON_TOWER from './epsilon.js';
import ZETA_TOWER from './zeta.js';
import ETA_TOWER from './eta.js';
import THETA_TOWER from './theta.js';
import IOTA_TOWER from './iota.js';
import KAPPA_TOWER from './kappa.js';
import LAMBDA_TOWER from './lambda.js';
import MU_TOWER from './mu.js';
import NU_TOWER from './nu.js';
import XI_TOWER from './xi.js';
import OMICRON_TOWER from './omicron.js';
import PI_TOWER from './pi.js';
import RHO_TOWER from './rho.js';
import SIGMA_TOWER from './sigma.js';
import TAU_TOWER from './tau.js';
import UPSILON_TOWER from './upsilon.js';
import PHI_TOWER from './phi.js';
import CHI_TOWER from './chi.js';
import PSI_TOWER from './psi.js';
import OMEGA_TOWER from './omega.js';
import INFINITY_TOWER from './infinity.js';

export {
  MIND_GATE_TOWER as mind_gateTower,
  ALPHA_TOWER as alphaTower,
  BETA_TOWER as betaTower,
  GAMMA_TOWER as gammaTower,
  DELTA_TOWER as deltaTower,
  EPSILON_TOWER as epsilonTower,
  ZETA_TOWER as zetaTower,
  ETA_TOWER as etaTower,
  THETA_TOWER as thetaTower,
  IOTA_TOWER as iotaTower,
  KAPPA_TOWER as kappaTower,
  LAMBDA_TOWER as lambdaTower,
  MU_TOWER as muTower,
  NU_TOWER as nuTower,
  XI_TOWER as xiTower,
  OMICRON_TOWER as omicronTower,
  PI_TOWER as piTower,
  RHO_TOWER as rhoTower,
  SIGMA_TOWER as sigmaTower,
  TAU_TOWER as tauTower,
  UPSILON_TOWER as upsilonTower,
  PHI_TOWER as phiTower,
  CHI_TOWER as chiTower,
  PSI_TOWER as psiTower,
  OMEGA_TOWER as omegaTower,
  INFINITY_TOWER as infinityTower,
};

export const towers = [
  // Surface the Mind Gate first so upgrade systems can treat it as the foundation lattice.
  MIND_GATE_TOWER,
  ALPHA_TOWER,
  BETA_TOWER,
  GAMMA_TOWER,
  DELTA_TOWER,
  EPSILON_TOWER,
  ZETA_TOWER,
  ETA_TOWER,
  THETA_TOWER,
  IOTA_TOWER,
  KAPPA_TOWER,
  LAMBDA_TOWER,
  MU_TOWER,
  NU_TOWER,
  XI_TOWER,
  OMICRON_TOWER,
  PI_TOWER,
  RHO_TOWER,
  SIGMA_TOWER,
  TAU_TOWER,
  UPSILON_TOWER,
  PHI_TOWER,
  CHI_TOWER,
  PSI_TOWER,
  OMEGA_TOWER,
  INFINITY_TOWER,
];

export default towers;
