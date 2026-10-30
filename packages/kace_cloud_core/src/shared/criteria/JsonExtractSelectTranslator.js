import { InvalidArgumentError } from '../errors/InvalidArgumentError.js';

/**
 * Traduce las expresiones `json_extract(tabla.columna, '$.ruta')` -sintaxis de mysql que
 * `SubCaseRelationExtraSelectValidator` declara valida en el contrato publico del `select` extra-
 * a `jsonb_path_query_first`, que es lo que entiende postgres.
 *
 * Sin esta traduccion postgres responde `function json_extract(jsonb, unknown) does not exist` y
 * el cliente recibe un 500 por haber enviado justo lo que la API acepta.
 *
 * `tabla`/`columna` son identificadores y no pueden ligarse como parametro, asi que se validan
 * contra una lista blanca (`\w+`) antes de interpolarse -es el unico caso permitido por la
 * politica de SQL crudo del repo. La ruta jsonpath, en cambio, es un valor: aunque tambien pasa
 * por una lista blanca (`#segmentRe`) como defensa en profundidad, nunca se interpola en el SQL,
 * se liga como binding (`?`) para que esa lista blanca no sea la unica barrera.
 */
export class JsonExtractSelectTranslator {
    static #callRe = /\bjson_extract\s*\(/i;

    static #exprRe = /^json_extract\s*\(\s*(\w+)\.(\w+)\s*,\s*'(\$[a-zA-Z0-9_.[\]]*)'\s*\)(?:\s+as\s+(\w+))?$/i;

    static #segmentRe = /^([a-zA-Z0-9_]+)((?:\[\d+\])*)$/;

    /**
     * @param {string} expr - expresion de select, con o sin `json_extract`
     * @returns {string|{sql: string, bindings: unknown[]}} la expresion original si no contenia
     * `json_extract`, o `{ sql, bindings }` con el jsonpath ligado como parametro (`?`) si la tradujo
     * @throws {InvalidArgumentError} si contiene `json_extract` pero no encaja con la forma esperada
     */
    static translate(expr) {
        if (typeof expr !== 'string' || !JsonExtractSelectTranslator.#callRe.test(expr)) {
            return expr;
        }

        const match = JsonExtractSelectTranslator.#exprRe.exec(expr.trim());
        if (!match) {
            throw new InvalidArgumentError(`Cannot translate json_extract select expression: ${expr.trim()}`);
        }

        const [, table, column, path, alias] = match;
        const jsonPath = JsonExtractSelectTranslator.#toJsonPath(path);
        const aliasSuffix = alias ? ` as ${alias}` : '';

        return {
            sql: `jsonb_path_query_first(${table}.${column}, ?)${aliasSuffix}`,
            bindings: [jsonPath],
        };
    }

    /**
     * `$.profile.contact.name` -> `$."profile"."contact"."name"`
     * `$.genre[0]`             -> `$."genre"[0]`
     */
    static #toJsonPath(path) {
        const segments = path
            .slice(1)
            .split('.')
            .filter((segment) => segment.length);

        return segments.reduce((jsonPath, segment) => {
            const match = JsonExtractSelectTranslator.#segmentRe.exec(segment);
            if (!match) {
                throw new InvalidArgumentError(`Invalid json_extract path segment: ${segment}`);
            }
            return `${jsonPath}."${match[1]}"${match[2]}`;
        }, '$');
    }
}
