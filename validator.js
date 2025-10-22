/**
 * A simple utility to sanitize strings and prevent XSS.
 * @param {string} str The input string to sanitize.
 * @returns {string} The sanitized string.
 */
function sanitize(str) {
  if (typeof str !== 'string') return '';

  // 1. Strip any HTML tags to prevent basic XSS.
  let sanitized = str.replace(/<[^>]*>?/gm, "");

  // 2. Remove characters that could be used for code injection or are otherwise problematic.
  // This removes $, {, }, (, ), [, ], ;, ', ", <, >
  sanitized = sanitized.replace(/[$(){}[\];'"<>]/g, '');

  // 3. Enforce a strict 3-character limit for all symbols.
  return sanitized.substring(0, 3);
}

// Note: This file doesn't export anything as it will be loaded via a <script> tag.