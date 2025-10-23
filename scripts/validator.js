/**
 * Sanitizes a string by removing characters that are not alphanumeric,
 * part of common symbol sets, or emoji. Limits length to 3.
 * @param {string} str The input string.
 * @returns {string} The sanitized string.
 */
function sanitize(str) {
  if (typeof str !== 'string') return '';
  // This regex allows: letters, numbers, common symbols, and emoji.
  const allowedCharsRegex = /[a-zA-Z0-9\s.,!?"'$%^&*()-_=+`~[\]{}|;:'"<>/\\@#©®™✨👍😊🎉🔥✅❌❤️_]/gu;
  const sanitized = (str.match(allowedCharsRegex) || []).join('');
  return sanitized.slice(0, 3);
}

/**
 * Validates an alphabet map to ensure no symbols are used for multiple letters.
 * @param {object} map The alphabetMap to validate.
 * @returns {{isValid: boolean, message: string}} An object indicating validity and an error message.
 */
function validateMapForDuplicates(map) {
  const seenSymbols = new Map();
  for (const [letter, entry] of Object.entries(map)) {
    const symbol = entry.value;
    // Only check non-default, non-empty symbols for duplication
    if (symbol && symbol !== letter) {
      if (seenSymbols.has(symbol)) {
        seenSymbols.get(symbol).push(letter);
      } else {
        seenSymbols.set(symbol, [letter]);
      }
    }
  }

  const duplicateMessages = Array.from(seenSymbols.entries())
    .filter(([, letters]) => letters.length > 1)
    .map(([symbol, letters]) => `'${symbol}' is used by ${letters.join(', ')}`);

  if (duplicateMessages.length > 0) {
    return { isValid: false, message: `Duplicate symbols found: ${duplicateMessages.join('; ')}` };
  }

  return { isValid: true, message: '' };
}