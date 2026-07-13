/**
 * Master equation utilities for tower blueprints.
 *
 * These helpers derive the displayed master equation from the blueprint
 * definition so UI surfaces stay synchronized with the configured
 * sub-equations. By generating the text dynamically, new sub-equations can be
 * added to a tower without manually updating every equation label.
 */

const MULTIPLY_SYMBOL = ' × ';

function isAttachmentVariable(variable) {
  if (!variable || typeof variable !== 'object') {
    return false;
  }
  if (typeof variable.attachedToVariable === 'string' && variable.attachedToVariable.trim()) {
    return true;
  }
  return variable.category === 'attachment';
}

function shouldIncludeInMasterEquation(variable) {
  if (!variable || typeof variable !== 'object') {
    return false;
  }
  if (variable.includeInMasterEquation === false) {
    return false;
  }
  if (isAttachmentVariable(variable)) {
    return false;
  }
  return true;
}

function normalizePlainLabel(label) {
  if (typeof label !== 'string') {
    return '';
  }
  const trimmed = label.trim();
  if (!trimmed) {
    return '';
  }
  const latexMatch = trimmed.match(/^\\text\{(.+?)\}$/u);
  if (latexMatch) {
    return latexMatch[1].trim();
  }
  const wrappedMatch = trimmed.match(/^\\\((.+)\\\)$/u);
  if (wrappedMatch) {
    return wrappedMatch[1].trim();
  }
  return trimmed;
}

function derivePlainVariableLabel(variable) {
  if (!variable || typeof variable !== 'object') {
    return '';
  }
  const candidates = [
    variable.masterEquationSymbol,
    variable.masterEquationLabel,
    variable.equationSymbol,
    variable.symbol,
    variable.name,
    variable.key,
  ];
  for (const candidate of candidates) {
    const normalized = normalizePlainLabel(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

function deriveLatexVariableLabel(variable, fallbackPlain) {
  if (!variable || typeof variable !== 'object') {
    return '';
  }
  const candidates = [variable.masterEquationLatex, variable.equationSymbol, variable.symbol];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }
    const trimmed = candidate.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith('\\')) {
      return trimmed;
    }
    if (trimmed.startsWith('\\(') && trimmed.endsWith('\\)')) {
      return trimmed.slice(2, -2).trim();
    }
  }
  const plain = normalizePlainLabel(fallbackPlain);
  if (!plain) {
    return '';
  }
  return `\\text{${plain}}`;
}

function deriveLatexSymbol(blueprint, definition, towerId) {
  if (blueprint && typeof blueprint.masterEquationLatex === 'string') {
    const trimmed = blueprint.masterEquationLatex.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  if (blueprint && typeof blueprint.mathSymbol === 'string') {
    const trimmed = blueprint.mathSymbol.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  const plain = derivePlainSymbol(blueprint, definition, towerId);
  if (!plain) {
    return '';
  }
  if (/^\\/.test(plain)) {
    return plain;
  }
  return `\\text{${plain}}`;
}

function derivePlainSymbol(blueprint, definition, towerId) {
  if (blueprint && typeof blueprint.masterEquationSymbol === 'string') {
    const trimmed = blueprint.masterEquationSymbol.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  if (definition && typeof definition.symbol === 'string' && definition.symbol.trim()) {
    return definition.symbol.trim();
  }
  if (blueprint && typeof blueprint.mathSymbol === 'string') {
    const mathSymbol = blueprint.mathSymbol.trim();
    if (mathSymbol.startsWith('\\')) {
      return mathSymbol.replace(/^\\/, '');
    }
  }
  if (definition && typeof definition.name === 'string' && definition.name.trim()) {
    return definition.name.trim();
  }
  if (typeof towerId === 'string' && towerId.trim()) {
    return towerId.trim();
  }
  return '';
}

/**
 * Derive the structure of a blueprint's master equation.
 *
 * @param {Object} params.blueprint - Tower blueprint definition
 * @param {Object} params.definition - Tower metadata definition
 * @param {string} params.towerId - Tower identifier
 * @returns {{ symbol: { plain: string, latex: string }, terms: Array<{ plain: string, latex: string }> }}
 */
export function deriveMasterEquationStructure({ blueprint, definition, towerId } = {}) {
  const plainSymbol = derivePlainSymbol(blueprint, definition, towerId);
  const latexSymbol = deriveLatexSymbol(blueprint, definition, towerId);

  const terms = [];
  const variables = Array.isArray(blueprint?.variables) ? blueprint.variables : [];
  variables.forEach((variable) => {
    if (!shouldIncludeInMasterEquation(variable)) {
      return;
    }
    const plain = derivePlainVariableLabel(variable);
    if (!plain) {
      return;
    }
    const latex = deriveLatexVariableLabel(variable, plain);
    terms.push({ plain, latex });
  });

  return {
    symbol: {
      plain: plainSymbol,
      latex: latexSymbol,
    },
    terms,
  };
}

/**
 * Generate a master equation string for UI display.
 *
 * @param {Object} params
 * @param {'plain'|'latex'} [params.format='plain'] - Output format
 * @param {string} [params.fallback=''] - Fallback when no equation can be produced
 * @returns {string}
 */
export function generateMasterEquationText({
  blueprint,
  definition,
  towerId,
  format = 'plain',
  fallback = '',
} = {}) {
  const structure = deriveMasterEquationStructure({ blueprint, definition, towerId });
  const { symbol, terms } = structure;
  if (!symbol.plain && !symbol.latex) {
    return fallback;
  }
  if (!terms.length) {
    if (format === 'latex') {
      const left = symbol.latex || (symbol.plain ? `\\text{${symbol.plain}}` : '');
      return left ? String.raw`\( ${left} = 0 \)` : fallback;
    }
    const left = symbol.plain || symbol.latex;
    return left ? `${left} = 0` : fallback;
  }

  if (format === 'latex') {
    const left = symbol.latex || (symbol.plain ? `\\text{${symbol.plain}}` : '');
    if (!left) {
      return fallback;
    }
    const rightTerms = terms
      .map(({ latex, plain }) => {
        if (latex && latex.trim()) {
          return latex.trim();
        }
        if (plain && plain.trim()) {
          return `\\text{${plain.trim()}}`;
        }
        return '';
      })
      .filter(Boolean);
    if (!rightTerms.length) {
      return fallback;
    }
    return String.raw`\( ${left} = ${rightTerms.join(' \\times ')} \)`;
  }

  const left = symbol.plain || symbol.latex;
  if (!left) {
    return fallback;
  }
  const right = terms
    .map(({ plain, latex }) => {
      const candidate = plain || latex;
      return candidate ? normalizePlainLabel(candidate) : '';
    })
    .filter(Boolean);
  if (!right.length) {
    return fallback;
  }
  return `${left} = ${right.join(MULTIPLY_SYMBOL)}`;
}
