const VALID_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Allowlist para identificadores de base de datos que se interpolan en SQL
 * crudo (CREATE DATABASE / DROP DATABASE no admiten el nombre como binding
 * parametrizado). Debe aplicarse a cualquier nombre de base de datos antes de
 * incluirlo en una cadena de SQL.
 *
 * Este archivo y `sqlIdentifier.js` existen los dos porque validan nombres de
 * origen distinto, no por descuido: este valida nombres que la suite genera
 * ella misma (`kace_t_<hash>`, `kace_tpl_<hash>`), asi que el charset puede
 * quedarse conservador porque lo controlamos nosotros. `sqlIdentifier.js`
 * valida nombres leidos del catalogo de postgres, que deben tolerar lo que
 * las migraciones hayan producido de verdad (por ejemplo la tabla
 * `one-script`). Si se afloja este regex, revisar si `sqlIdentifier.js`
 * tambien deberia cambiar, y viceversa.
 *
 * Modulo autonomo (sin imports de `src/`): lo consumen `globalSetup` y
 * `globalTeardown`, que jest carga con el resolver nativo de Node y no
 * toleran los imports relativos sin extension que usan los modulos de `src/`.
 *
 * @param {string} name
 * @returns {void}
 */
export const assertValidDatabaseName = (name) => {
    if (!VALID_IDENTIFIER_PATTERN.test(name)) {
        throw new Error(`Nombre de base de datos invalido: "${name}"`);
    }
};
