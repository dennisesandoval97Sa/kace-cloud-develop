import pg from 'pg';

const JSON_OID = 114;
const JSONB_OID = 3802;

/**
 * Makes node-postgres return json/jsonb columns as raw strings instead of parsed JS values.
 *
 * Without this, a column whose top-level value is an ARRAY comes back as a JS array, and writing
 * it back makes pg serialise it as a PostgreSQL array literal (`{all}`) rather than JSON
 * (`["all"]`), failing with `invalid input syntax for type json`. Objects are unaffected, which is
 * why this hides until a table stores a top-level array.
 *
 * Treating JSON as opaque text is also more faithful for a pass-through sync: no key reordering,
 * no numeric-precision loss from parse-then-reserialise.
 *
 * @returns {void}
 */
export const enableJsonPassthrough = () => {
    pg.types.setTypeParser(JSON_OID, (value) => value);
    pg.types.setTypeParser(JSONB_OID, (value) => value);
};
