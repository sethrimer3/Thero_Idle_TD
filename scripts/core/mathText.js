/**
 * Provides helpers for rendering and parsing math flavoured text so the rest of the
 * UI code can stay focused on gameplay concerns.
 */

/**
 * Regular expression that captures characters typically associated with math
 * expressions so we can quickly decide if text needs special formatting.
 */
export const MATH_SYMBOL_REGEX = /[\\^_=+\-*{}]|[0-9]|[×÷±√∞∑∏∆∇∂→←↺⇥]|[α-ωΑ-Ωℵ℘ℏℙℚℝℤℂℑℜητβγΩΣΨΔφϕλψρμνσπθ]/u;

/**
 * Sends a DOM element through MathJax so TeX expressions render elegantly.
 * @param {HTMLElement|null} element Element that potentially contains TeX text.
 */
export function renderMathElement(element) {
  if (!element) {
    return;
  }

  const mathJax = window.MathJax;
  if (!mathJax) {
    return;
  }

  const typeset = () => {
    if (typeof mathJax.typesetPromise === 'function') {
      mathJax.typesetPromise([element]).catch((error) => {
        console.warn('MathJax typeset failed', error);
      });
    }
  };

  if (mathJax.startup && mathJax.startup.promise) {
    mathJax.startup.promise.then(typeset);
  } else {
    typeset();
  }
}

/**
 * Determines if the provided string should be treated as a math expression.
 * @param {string} text Text pulled from tooltips or blueprint metadata.
 * @returns {boolean} True when the text likely contains math markup.
 */
export function isLikelyMathExpression(text) {
  if (!text) {
    return false;
  }
  if (text.startsWith('\\(') || text.startsWith('\\[')) {
    return true;
  }
  if (MATH_SYMBOL_REGEX.test(text)) {
    return true;
  }
  if (/\b(?:sin|cos|tan|log|exp|sqrt)\b/i.test(text)) {
    return true;
  }
  return false;
}

/**
 * Converts inline parenthetical expressions into MathJax friendly delimiters.
 * @param {string} text Source string supplied by designers.
 * @returns {string} Annotated text ready for MathJax.
 */
export function annotateMathText(text) {
  if (typeof text !== 'string' || text.indexOf('(') === -1) {
    return text;
  }

  let output = '';
  let outsideBuffer = '';
  let insideBuffer = '';
  let depth = 0;

  const flushOutside = () => {
    if (outsideBuffer) {
      output += outsideBuffer;
      outsideBuffer = '';
    }
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '(') {
      if (depth === 0) {
        flushOutside();
        insideBuffer = '';
      } else {
        insideBuffer += char;
      }
      depth += 1;
      continue;
    }

    if (char === ')') {
      if (depth === 0) {
        outsideBuffer += char;
        continue;
      }
      depth -= 1;
      if (depth === 0) {
        const content = insideBuffer;
        const trimmed = content.trim();
        if (!trimmed) {
          output += '()';
        } else if (isLikelyMathExpression(trimmed)) {
          output += `\\(${trimmed}\\)`;
        } else {
          output += `(${content})`;
        }
        insideBuffer = '';
      } else {
        insideBuffer += char;
      }
      continue;
    }

    if (depth === 0) {
      outsideBuffer += char;
    } else {
      insideBuffer += char;
    }
  }

  if (insideBuffer && depth > 0) {
    output += `(${insideBuffer}`;
  }

  if (outsideBuffer) {
    output += outsideBuffer;
  }

  return output;
}

/**
 * Converts simple TeX commands into plain text so we can generate fallbacks.
 * @param {string} expression MathJax flavoured expression.
 * @returns {string} Plain text version for DOM inspection.
 */
export function convertMathExpressionToPlainText(expression) {
  if (typeof expression !== 'string') {
    return '';
  }

  let text = expression;
  text = text.replace(/\\\(|\\\)|\\\[|\\\]/g, '');
  text = text.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2');
  text = text.replace(/\\sqrt\{([^}]*)\}/g, '√($1)');
  text = text.replace(/\\cdot/g, '·');
  text = text.replace(/\\times/g, '×');
  text = text.replace(/\\ln/g, 'ln');
  text = text.replace(/\\log/g, 'log');
  text = text.replace(/\\left|\\right/g, '');
  text = text.replace(/\\mathcal\{([^}]*)\}/g, '$1');
  text = text.replace(/\\text\{([^}]*)\}/g, '$1');
  text = text.replace(/\\operatorname\{([^}]*)\}/g, '$1');
  text = text.replace(/\\,|\\!|\\;/g, ' ');
  text = text.replace(/\\([a-zA-Z]+)/g, (match, command) => {
    const lookupKey = `\\${command}`;
    if (GREEK_SYMBOL_LOOKUP.has(lookupKey)) {
      return GREEK_SYMBOL_LOOKUP.get(lookupKey);
    }
    return command;
  });
  text = text.replace(/[{}]/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

/**
 * Normalised map between TeX commands and human friendly Greek symbols.
 */
const GREEK_SYMBOL_LOOKUP = new Map([
  ['\\alpha', 'α'],
  ['\\beta', 'β'],
  ['\\gamma', 'γ'],
  ['\\delta', 'δ'],
  ['\\epsilon', 'ε'],
  ['\\theta', 'θ'],
  ['\\lambda', 'λ'],
  ['\\mu', 'μ'],
  ['\\nu', 'ν'],
  ['\\pi', 'π'],
  ['\\phi', 'φ'],
  ['\\psi', 'ψ'],
  ['\\sigma', 'σ'],
  ['\\tau', 'τ'],
  ['\\omega', 'ω'],
  ['\\Omega', 'Ω'],
  ['\\Gamma', 'Γ'],
  ['\\Delta', 'Δ'],
  ['\\Lambda', 'Λ'],
  ['\\Phi', 'Φ'],
  ['\\Psi', 'Ψ'],
]);
