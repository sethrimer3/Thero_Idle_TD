/**
 * Shadow Gate Tower Blueprint
 *
 * The enemy spawn nexus. Its equation (℘ = x) maps the set of all encountered
 * enemy types onto a single glyph symbol — recording the known foe registry.
 */

import { codexState, getEnemyCodexEntry } from '../codex.js';

// Resolve the math symbols for every enemy the player has encountered so far.
function resolveEncounteredEnemySymbols() {
  const ids = Array.from(codexState.encounteredEnemies);
  const symbols = ids.map((id) => getEnemyCodexEntry(id)?.symbol).filter(Boolean);
  return symbols.join(', ');
}

export const shadowGate = {
  mathSymbol: String.raw`\wp`,
  baseEquation: String.raw`\( \wp = x \)`,
  variables: [
    {
      key: 'enemies',
      symbol: 'x',
      // Dynamically surface the math symbols of all encountered enemy types.
      get name() {
        return resolveEncounteredEnemySymbols();
      },
      upgradable: false,
    },
  ],
  computeResult() {
    // The Shadow Gate is a passive nexus — it has no numerical damage or rate output.
    return 0;
  },
  formatGoldenEquation() {
    // The equation is purely symbolic: the gate maps the known enemy set onto x.
    return String.raw`\( \wp = x \)`;
  },
};
