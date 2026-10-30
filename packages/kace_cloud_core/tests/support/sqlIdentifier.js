/**
 * Identificadores que postgres devuelve por catalogo: letras, digitos, guion
 * bajo, guion medio y dolar. El guion medio esta permitido porque existe una
 * tabla llamada `one-script`; la comilla doble no lo esta, que es lo unico que
 * permitiria escapar del citado.
 *
 * Este archivo y `databaseIdentifier.js` existen los dos porque validan
 * nombres de origen distinto, no por descuido: este valida nombres leidos del
 * catalogo de postgres (tablas existentes, con lo que las migraciones hayan
 * producido de verdad), por eso el charset es mas amplio. `databaseIdentifier.js`
 * valida nombres que la suite genera ella misma (`kace_t_<hash>`,
 * `kace_tpl_<hash>`), asi que puede quedarse con un charset conservador. Si se
 * amplia este regex, revisar si `databaseIdentifier.js` tambien deberia
 * cambiar, y viceversa.
 */
const VALID_IDENTIFIER_PATTERN = /^[A-Za-z0-9_$-]+$/;

/**
 * Cita un identificador SQL para interpolarlo en SQL crudo. CREATE DATABASE,
 * TRUNCATE y DROP TABLE no admiten el nombre como binding parametrizado, asi
 * que la unica defensa es la allowlist mas el citado.
 *
 * El chequeo `typeof name !== 'string'` no es redundante con la regex: los
 * nombres llegan de una consulta al catalogo y no hay garantia de que el
 * resultado sea siempre una cadena, asi que el guard cubre valores como
 * `null`, `undefined` o numeros antes de que `test()` los coaccione de forma
 * silenciosa.
 *
 * @param {string} name
 * @returns {string} el identificador entre comillas dobles
 */
export const quoteIdentifier = (name) => {
    if (typeof name !== 'string' || VALID_IDENTIFIER_PATTERN.test(name) === false) {
        throw new Error(`Identificador SQL invalido: ${JSON.stringify(name)}`);
    }

    return `"${name}"`;
};

/**
 * Cita un identificador cualificado por esquema.
 *
 * @param {string} schema
 * @param {string} name
 * @returns {string}
 */
export const quoteQualified = (schema, name) => `${quoteIdentifier(schema)}.${quoteIdentifier(name)}`;
