import SchemaBuilder from '@kace/schemabuilder/src/SchemaBuilder.js';

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

const isContainer = (value) => isPlainObject(value) || Array.isArray(value);

/**
 * Alcance por defecto: `trim` y `uppercase`/`lowercase` de los campos string del editor de
 * Esquemas, que es el fix de MSKT-1400. Los demás tipos conservan lo que la petición envió.
 */
export const STRING_ADOPTABLE_TYPES = Object.freeze(['string']);

/**
 * Alcance ampliado para los caminos cuyo origen es texto sin tipar (CSV de importación,
 * formularios de auxiliares generales) y que ya dependían de la coerción de Joi antes de este
 * fix: un `"41"` debe guardarse como `41` y una fecha, en su forma normalizada. Que un `date`
 * concreto se adopte o no no lo decide esta lista, sino {@link SchemaBuilder.leafAccepts}.
 */
export const TEXT_SOURCE_ADOPTABLE_TYPES = Object.freeze(['string', 'number', 'boolean', 'date']);

/**
 * Un `data_structure` es un mapa `clave -> config`; una config suelta es un objeto con `type`.
 * Es la misma heurística que usa `SchemaBuilder.#buildTree` para decidir cómo interpretar el nodo.
 */
const isFieldMap = (node) =>
    isPlainObject(node) && Object.values(node).every((child) => isPlainObject(child) && child.type);

const asFieldDefinition = (node) => {
    if (isFieldMap(node)) return { type: 'object', data_structure: node };
    if (isPlainObject(node) && node.type) return node;
    return undefined;
};

/**
 * Config DECLARADA en el `data_structure` para una ruta de hoja. No se mira el tipo que el valor
 * tiene en runtime: es el esquema quien define qué conversión se está adoptando.
 *
 * @param {object} dataStructure
 * @param {Array<string|number>} path
 * @returns {object|undefined}
 */
function declaredNodeAt(dataStructure, path) {
    let node = asFieldDefinition(dataStructure);

    for (const key of path) {
        if (!node) return undefined;

        if (typeof key === 'number') {
            // Índice de array: todos los ítems comparten la definición de `data_structure`.
            if (node.type !== 'array') return undefined;
            node = asFieldDefinition(node.data_structure);
            continue;
        }

        if (!isPlainObject(node.data_structure)) return undefined;
        node = node.data_structure[key];
    }

    return isPlainObject(node) ? node : undefined;
}

/**
 * Serializa `value` como se persistirá (JSONB): un `Date` se vuelve string ISO, `undefined`
 * desaparece. Es lo que realmente revalida {@link SchemaBuilder.leafAccepts}, no el valor en
 * memoria que Joi pudo devolver como instancia de `Date`.
 */
function asPersisted(value) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return undefined;
    }
}

/**
 * Every leaf path of `value`, as arrays of keys. Objects and arrays are traversed
 * (arrays by index), so a patch that sends two of five array items only claims those two.
 *
 * @param {*} value
 * @param {Array<string|number>} [prefix]
 * @returns {Array<Array<string|number>>}
 */
function collectLeafPaths(value, prefix = []) {
    if (!isContainer(value)) {
        return prefix.length > 0 ? [prefix] : [];
    }

    const entries = Array.isArray(value) ? value.map((item, index) => [index, item]) : Object.entries(value);

    return entries.flatMap(([key, child]) => collectLeafPaths(child, [...prefix, key]));
}

const getByPath = (source, path) => path.reduce((accumulator, key) => accumulator?.[key], source);

/**
 * Copy-on-write set: only the containers along `path` are recreated, so every branch the
 * patch did not touch keeps its original reference (and its original values).
 */
function setByPath(target, path, value) {
    const [key, ...rest] = path;

    if (rest.length === 0) {
        if (Array.isArray(target)) {
            const next = [...target];
            next[key] = value;
            return next;
        }
        return { ...target, [key]: value };
    }

    const child = target?.[key];
    const emptyContainer = typeof rest[0] === 'number' ? [] : {};
    const nextChild = setByPath(isContainer(child) ? child : emptyContainer, rest, value);

    if (Array.isArray(target)) {
        const next = [...target];
        next[key] = nextChild;
        return next;
    }
    return { ...target, [key]: nextChild };
}

const pathKey = (path) => JSON.stringify(path);

/**
 * Adopts the values Joi converted (`trim`, `uppercase`/`lowercase`…) without letting the rest of
 * the validated document leak into the write.
 *
 * `SchemaBuilder.build(...).validate(...)` returns a *converted* document, not just a verdict:
 * date fields are re-serialized and `default()`s are materialized for every key in the schema,
 * whether or not the caller sent them. Writing that document back would silently rewrite fields
 * the request never mentioned — and for `timezoneFormat: 'withoutTimezone'` (o con `timestamp`)
 * el valor reescrito ya no valida contra su propio esquema, dejando el registro ineditable.
 *
 * Por eso la escritura conserva `target` y hereda el valor convertido sólo cuando se cumplen las
 * cuatro condiciones: la hoja está en `patch`, Joi no reportó error en esa ruta, su tipo
 * DECLARADO en `dataStructure` está en `adoptableTypes`, y el valor convertido vuelve a validar
 * contra el esquema de su propia hoja, aislada del resto del documento vía
 * {@link SchemaBuilder.leafAccepts} — que también resuelve un `dependsOn` de la propia hoja
 * dentro de un objeto sintético con su hermano, porque `Joi.when(Joi.ref(...))` no resuelve fuera
 * de su objeto padre. Recortar sólo por ruta no basta: el defecto depende del valor, no de si la
 * petición lo envió.
 *
 * Materializar los `default()` del esquema es un efecto distinto de adoptar conversiones. Hoy lo
 * activan exactamente dos caminos, los de origen texto sin tipar: la importación CSV y el create
 * del formulario genérico de auxiliares. Ahí el default es lo que el administrador configuró para
 * un campo no diligenciado en un origen que no sabe expresar "ausente" de otra forma.
 *
 * `group` y `users` create también validan contra la estructura completa y NO pasan el flag, así
 * que el criterio no es "valida la estructura completa". Esa asimetría no está justificada en
 * código; antes de replicar el flag a un call-site nuevo, confírmala con producto en vez de
 * deducirla de aquí. En los `update` el flag se queda apagado siempre, porque rellenaría claves
 * que el registro nunca tuvo.
 *
 * @param {object} params
 * @param {object} params.target Document to write (the pre-merge document, or the payload itself)
 * @param {*} params.converted `value` returned by Joi
 * @param {object} params.dataStructure Estructura del esquema; sin ella no hay nada que adoptar
 * @param {object} [params.patch] Keys the request actually sent; defaults to `target`
 * @param {import('joi').ValidationErrorItem[]} [params.errorDetails] `error.details` returned by Joi
 * @param {readonly string[]} [params.adoptableTypes] Allowlist de tipos declarados adoptables
 * @param {boolean} [params.materializeDefaults=false] Escribir también las hojas que sólo existen
 *   en `converted` porque Joi aplicó su `default()`
 * @returns {object} `target` when there is nothing to adopt, otherwise a new document
 */
export class SchemaConversionsApplier {
    static execute({
        target,
        converted,
        dataStructure,
        patch = target,
        errorDetails = [],
        adoptableTypes = STRING_ADOPTABLE_TYPES,
        materializeDefaults = false,
    } = {}) {
        if (!isPlainObject(target) || !isPlainObject(converted) || !isPlainObject(patch)) {
            return target;
        }
        if (!isPlainObject(dataStructure)) {
            return target;
        }

        const failedPaths = new Set((errorDetails ?? []).map((detail) => pathKey(detail?.path ?? [])));
        const hasFailedAncestor = (path) =>
            path.some((_key, index) => failedPaths.has(pathKey(path.slice(0, index + 1))));

        let result = target;

        const adopt = (path, { onlyWhenAbsent = false } = {}) => {
            if (hasFailedAncestor(path)) return;

            const node = declaredNodeAt(dataStructure, path);
            if (!node || !adoptableTypes.includes(node.type)) return;

            const current = getByPath(result, path);
            if (onlyWhenAbsent && current !== undefined) return;

            const value = getByPath(converted, path);
            if (value === undefined) return;
            if (Object.is(value, current)) return;

            const persisted = asPersisted(value);
            if (persisted === undefined) return;

            // Hermanos para resolver un `node.dependsOn` (ver SchemaBuilder.leafAccepts): se leen del
            // documento que se está construyendo (`result`), que ya trae heredado todo lo que `target`
            // no tocó más lo que esta misma pasada ya adoptó, así que refleja lo que realmente se va a
            // persistir. Si esa rama todavía no existe ahí (p. ej. `materializeDefaults` sobre una
            // rama que `target` nunca tuvo), se cae a `converted`.
            const parentPath = path.slice(0, -1);
            const leafKey = path[path.length - 1];
            const siblingsFromResult = getByPath(result, parentPath);
            const siblings = isPlainObject(siblingsFromResult) ? siblingsFromResult : getByPath(converted, parentPath);

            if (!SchemaBuilder.leafAccepts(node, persisted, { key: leafKey, siblings })) return;

            result = setByPath(result, path, value);
        };

        for (const path of collectLeafPaths(patch)) {
            adopt(path);
        }

        if (materializeDefaults) {
            for (const path of collectLeafPaths(converted)) {
                adopt(path, { onlyWhenAbsent: true });
            }
        }

        return result;
    }
}
