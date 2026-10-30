/**
 * Allowlist for SQL identifiers that cannot travel as bindings (schema, table and column names).
 *
 * Exported so the Joi config schema validates against this very pattern instead of its own copy:
 * the two are the halves of one defence, and a divergence would silently open a gap.
 *
 * A hyphen is allowed in non-leading position: real KACE tables use it (e.g. `one-script`,
 * `history_one-script`), and a bare hyphen cannot break out of the double-quoting that
 * `quoteIdentifier` applies before interpolation — only an embedded `"` can do that, and this
 * pattern still rejects it. The leading character stays restricted to `[a-zA-Z_]` because no real
 * relation starts with a hyphen and it keeps the allowlist as tight as the threat requires.
 */
export const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

/**
 * Checks whether a value is safe to embed in SQL as an identifier.
 *
 * @param {*} value - The candidate identifier.
 * @returns {boolean} True when the value matches the allowlist pattern.
 */
export const isValidIdentifier = (value) => typeof value === 'string' && IDENTIFIER_PATTERN.test(value);

/**
 * Asserts that a value is a valid SQL identifier.
 *
 * @param {*} value - The candidate identifier.
 * @param {string} label - Label used in the error message (e.g. "schema").
 * @returns {string} The validated identifier.
 * @throws {Error} When the value does not match the allowlist pattern.
 */
export const assertValidIdentifier = (value, label = 'identifier') => {
    if (!isValidIdentifier(value)) {
        throw new Error(`Invalid ${label} name: "${value}"`);
    }

    return value;
};

/**
 * Quotes a validated identifier for direct interpolation into SQL.
 *
 * @param {string} value - The identifier to quote.
 * @returns {string} The double-quoted identifier.
 * @throws {Error} When the value does not match the allowlist pattern.
 */
export const quoteIdentifier = (value) => `"${assertValidIdentifier(value)}"`;
