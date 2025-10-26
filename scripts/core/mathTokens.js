/**
 * Tokenisation helpers used to split upgrade equations into highlightable spans.
 */

/**
 * Escapes special characters so dynamically built regular expressions stay valid.
 * @param {string} value Symbol text supplied by blueprint metadata.
 * @returns {string} Regex safe symbol string.
 */
export function escapeRegExp(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

/**
 * Breaks equation text into tokens so the UI can bind spans to upgrade cards.
 * @param {string} equationText Base equation pulled from the blueprint.
 * @param {Array<{key: string, symbol: string}>} variableTokens Upgradable variable metadata.
 * @returns {Array<{text: string, variableKey: string|null}>} Token list for DOM generation.
 */
export function tokenizeEquationParts(equationText, variableTokens = []) {
  if (!equationText || !variableTokens.length) {
    return [{ text: equationText, variableKey: null }];
  }

  const tokenLookup = new Map();
  const patterns = variableTokens
    .filter((token) => token && token.symbol)
    .map((token) => {
      tokenLookup.set(token.symbol, token.key);
      return escapeRegExp(token.symbol);
    });

  if (!patterns.length) {
    return [{ text: equationText, variableKey: null }];
  }

  const regex = new RegExp(`(${patterns.join('|')})`, 'g');
  const tokens = [];
  let lastIndex = 0;

  equationText.replace(regex, (match, _token, offset) => {
    if (offset > lastIndex) {
      tokens.push({ text: equationText.slice(lastIndex, offset), variableKey: null });
    }
    tokens.push({ text: match, variableKey: tokenLookup.get(match) || null });
    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < equationText.length) {
    tokens.push({ text: equationText.slice(lastIndex), variableKey: null });
  }

  return tokens;
}
