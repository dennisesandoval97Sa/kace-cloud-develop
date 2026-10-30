import Joi from 'joi';
import StringSchemaBuilder from './builders/StringSchemaBuilder.js';
import NumberSchemaBuilder from './builders/NumberSchemaBuilder.js';
import DateSchemaBuilder from './builders/DateSchemaBuilder.js';
import BooleanSchemaBuilder from './builders/BooleanSchemaBuilder.js';
import ArraySchemaBuilder from './builders/ArraySchemaBuilder.js';

const BUILD_CACHE = new Map();
const BUILD_CACHE_MAX_ENTRIES = 500;

/**
 * Esquema Joi de una hoja aislada, memoizado por referencia de su config (no por contenido: el
 * mismo dto siempre resuelve al mismo esquema durante la vida del proceso). Usado por
 * {@link SchemaBuilder.leafAccepts}.
 */
const LEAF_SCHEMA_CACHE = new WeakMap();

class SchemaBuilder {
    /**
     * Construye el schema Joi a partir de un data_structure, memoizando por contenido.
     * El validador Joi es inmutable y está determinado por el data_structure, así que
     * dos estructuras idénticas comparten la misma instancia (evita reconstruir Joi en
     * cada request del camino caliente). La clave es el JSON del dto: contenido distinto
     * => clave distinta, por lo que no requiere invalidación.
     */
    static build(dto) {
        let cacheKey = null;
        if (dto !== null && typeof dto === 'object') {
            try {
                cacheKey = JSON.stringify(dto);
            } catch {
                cacheKey = null;
            }
        }

        if (cacheKey !== null && BUILD_CACHE.has(cacheKey)) {
            return BUILD_CACHE.get(cacheKey);
        }

        const built = this.#buildTree(dto);

        if (cacheKey !== null) {
            if (BUILD_CACHE.size >= BUILD_CACHE_MAX_ENTRIES) {
                BUILD_CACHE.delete(BUILD_CACHE.keys().next().value);
            }
            BUILD_CACHE.set(cacheKey, built);
        }

        return built;
    }

    static #buildTree(dto) {
        if (
            typeof dto === 'object' &&
            !Array.isArray(dto) &&
            Object.values(dto).every((v) => typeof v === 'object' && v.type)
        ) {
            const schemas = {};
            for (const [key, value] of Object.entries(dto)) {
                if (value.type === 'array' && value.data_structure) {
                    const itemsSchema = this.#buildTree(value.data_structure);
                    schemas[key] = this._buildSingle({ ...value, items: itemsSchema });
                } else if (value.type === 'object' && value.data_structure) {
                    schemas[key] = this.#buildTree(value.data_structure);
                } else if (value.type !== 'array' && value.type !== 'object') {
                    schemas[key] = this._buildSingle(value);
                }
            }
            return Joi.object(schemas);
        } else if (dto && dto.type === 'object') {
            const keysSchemas = this.#buildTree(dto.data_structure);
            return keysSchemas;
        } else if (dto && dto.type === 'array') {
            const itemsSchema = this.#buildTree(dto.data_structure);
            return this._buildSingle({ ...dto, items: itemsSchema });
        }
        return this._buildSingle(dto);
    }

    static _buildSingle(dto) {
        switch (dto.type) {
            case 'string':
                return StringSchemaBuilder.build(dto);
            case 'number':
                return NumberSchemaBuilder.build(dto);
            case 'date':
                return DateSchemaBuilder.build(dto);
            case 'boolean':
                return BooleanSchemaBuilder.build(dto);
            case 'array':
                return ArraySchemaBuilder.build(dto);
            case 'calculated':
                return Joi.any();
            default:
                throw new Error(`Tipo no soportado ${dto.type}`);
        }
    }

    /**
     * Partial schema por claves de primer nivel presentes en el payload, más los pares
     * dependency/dependsOn. Lo usan `actionCreateWithAux` (cases, cases_2) y los
     * `actionUpdate` de auxiliaries, users y group.
     * El update de auxiliares de caso (AuxCasesUpdater) NO lo usa: valida el schema
     * completo memoizado y luego filtra con {@link SchemaBuilder.dropUntouchedNestedErrors}.
     */
    static buildPartial(dataStructure, partialKeys) {
        const partial = {};
        for (const key of partialKeys) {
            if (Object.hasOwn(dataStructure, key)) {
                partial[key] = dataStructure[key];
            }
        }
        for (const [key, config] of Object.entries(dataStructure)) {
            if (config.dependency && config.dependsOn && !Object.hasOwn(partial, key)) {
                if (Object.hasOwn(partial, config.dependsOn)) {
                    partial[key] = config;
                }
            }
        }
        for (const [key, config] of Object.entries(partial)) {
            if (config.dependency && config.dependsOn) {
                if (!Object.hasOwn(partial, config.dependsOn) && Object.hasOwn(dataStructure, config.dependsOn)) {
                    partial[config.dependsOn] = dataStructure[config.dependsOn];
                }
            }
        }
        return partial;
    }

    /**
     * Descarta detalles Joi cuyo path cuelga de una rama type:object / type:array
     * que el parche no tocó. Aplica a cualquier tipo de error (`any.required`,
     * `number.base`, `array.min`, …), no solo a required: el update auxiliar de
     * caso no debe bloquearse por datos sucios de un formulario o tabla que el
     * cliente no envió. Los escalares se siguen validando aunque se omitan.
     *
     * Solo lo usa AuxCasesUpdater (`POST /cases/auxiliary/{id}` en cases y
     * cases_2). Ese endpoint mergea el parche disperso de OneScript sobre el
     * JSONB persistido y valida el documento completo memoizado, de modo que
     * hace falta filtrar las ramas anidadas no enviadas. Los `actionUpdate` de
     * auxiliaries, users y group no lo necesitan: validan con {@link SchemaBuilder.buildPartial}
     * sobre el parche crudo (claves de primer nivel), y esos clientes envían el
     * formulario de esa clave completo.
     *
     * Con `shouldOverrideArray === false` (append), un índice de array menor que
     * la longitud persistida es contenido preexistente y también se descarta,
     * aunque la clave del array viaje en el parche.
     *
     * @param {import('joi').ValidationErrorItem[]} details
     * @param {object|null|undefined} dataStructure
     * @param {object|null|undefined} patch
     * @param {object|null|undefined} [persisted] Documento auxiliar antes del merge
     * @param {boolean} [shouldOverrideArray=false]
     * @returns {import('joi').ValidationErrorItem[]}
     */
    static dropUntouchedNestedErrors(details, dataStructure, patch, persisted, shouldOverrideArray = false) {
        if (!Array.isArray(details) || details.length === 0) {
            return [];
        }
        if (!dataStructure || typeof dataStructure !== 'object' || Array.isArray(dataStructure)) {
            return details;
        }
        return details.filter(
            (detail) =>
                !this.#isUnderUntouchedNested(detail.path ?? [], dataStructure, patch, persisted, shouldOverrideArray)
        );
    }

    /**
     * ¿`value` valida contra el esquema de la hoja `dto`, aislada del árbol?
     * Contrato público para consumidores que necesitan revalidar un valor fuera del documento
     * completo (p. ej. `SchemaConversionsApplier`, que decide si adoptar una conversión de Joi
     * comparando el valor convertido contra el esquema de su propia hoja).
     *
     * Cuando la hoja depende de un hermano (`dependsOn`, ver {@link DependencyHelper}), su esquema
     * es un `Joi.when(Joi.ref(dependsOn), ...)` que no resuelve fuera de su objeto padre: Joi lanza
     * `"Invalid reference exceeds the schema root"` si se valida aislada. Por eso, cuando hay
     * `dependsOn`, se valida dentro de un objeto sintético de dos claves que aporta el hermano
     * (`Joi.any()`, para que un error sólo pueda originarse en la hoja).
     *
     * @param {object} dto Config de la hoja tal como está en el `data_structure`
     * @param {*} value Valor a revalidar (ya serializado como se persistirá)
     * @param {object} [options]
     * @param {string} [options.key] Nombre de la clave de la hoja en su objeto padre
     * @param {object} [options.siblings] Valores hermanos, para resolver `dependsOn`
     * @returns {boolean} `false` también cuando el esquema no se puede construir
     */
    static leafAccepts(dto, value, { key = 'value', siblings = {} } = {}) {
        if (!dto || typeof dto !== 'object') return false;

        const leafSchema = this.#leafSchemaFor(dto);
        if (!leafSchema) return false;

        const dependsOn = typeof dto.dependsOn === 'string' ? dto.dependsOn : undefined;

        try {
            if (!dependsOn) {
                return !leafSchema.validate(value).error;
            }

            const wrapperShape = { [key]: leafSchema };
            const payload = { [key]: value };
            if (dependsOn !== key) {
                wrapperShape[dependsOn] = Joi.any();
                payload[dependsOn] = siblings?.[dependsOn];
            }

            return !Joi.object(wrapperShape).validate(payload).error;
        } catch {
            return false;
        }
    }

    static #leafSchemaFor(dto) {
        if (LEAF_SCHEMA_CACHE.has(dto)) return LEAF_SCHEMA_CACHE.get(dto);

        let schema = null;
        try {
            schema = this._buildSingle(dto);
        } catch {
            schema = null;
        }
        LEAF_SCHEMA_CACHE.set(dto, schema);
        return schema;
    }

    static getBuildCacheSize() {
        return BUILD_CACHE.size;
    }

    static clearBuildCache() {
        BUILD_CACHE.clear();
    }

    static #asFieldMap(dataStructure) {
        if (!dataStructure || typeof dataStructure !== 'object' || Array.isArray(dataStructure)) {
            return null;
        }
        if (dataStructure.type === 'object' && dataStructure.data_structure) {
            return dataStructure.data_structure;
        }
        return dataStructure;
    }

    static #isUnderUntouchedNested(path, dataStructure, patch, persisted, shouldOverrideArray) {
        if (!Array.isArray(path) || path.length === 0) {
            return false;
        }
        let ds = this.#asFieldMap(dataStructure);
        if (!ds) {
            return false;
        }
        let node = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
        let persistedNode =
            persisted && typeof persisted === 'object' && !Array.isArray(persisted) ? persisted : undefined;
        for (let i = 0; i < path.length; i += 1) {
            const key = path[i];
            if (typeof key === 'number') {
                continue;
            }
            const config = ds?.[key];
            if (!config || typeof config !== 'object') {
                return false;
            }
            if (config.type === 'object' || config.type === 'array') {
                if (!node || typeof node !== 'object' || Array.isArray(node) || !Object.hasOwn(node, key)) {
                    return true;
                }
                if (config.type === 'array') {
                    const baseLength = Array.isArray(persistedNode?.[key]) ? persistedNode[key].length : 0;
                    const index = path[i + 1];
                    if (shouldOverrideArray || typeof index !== 'number') {
                        return false;
                    }
                    return index < baseLength;
                }
                ds = this.#asFieldMap(config.data_structure) ?? config.data_structure;
                node = node[key];
                persistedNode = persistedNode?.[key];
                continue;
            }
            return false;
        }
        return false;
    }
}

export default SchemaBuilder;
