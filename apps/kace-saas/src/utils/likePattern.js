/**
 * Escapes the SQL LIKE/ILIKE metacharacters (`\`, `%`, `_`) in a free-text value so the
 * backend matches it literally instead of interpreting it as a wildcard pattern.
 *
 * Use this for user-typed search terms sent with the `like` / `ilike` operators. Do NOT
 * use it for filters that deliberately build a wildcard pattern (e.g. prefix matching
 * with a trailing `%`).
 *
 * Postgres uses `\` as the default LIKE escape character, so no `ESCAPE` clause is needed.
 *
 * @param {unknown} value
 * @returns {string}
 */
export const escapeLikePattern = (value) =>
    String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");
