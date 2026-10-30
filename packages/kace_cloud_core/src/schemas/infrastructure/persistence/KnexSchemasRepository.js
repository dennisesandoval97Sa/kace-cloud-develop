import { EntityCache, KnexRepository } from '../../../shared/index.js';
import { Schema } from '../../domain/Schema.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

const SCHEMAS_NAMESPACE = 'schemas';
const SCHEMA_RULES_NAMESPACE = 'schema-rules';
const SCHEMAS_TTL_MS = 60_000;

export class KnexSchemasRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'schemas', readerConfig);
    }

    /**
     * Guarda una instancia de Schema en la base de datos.
     * @param {Schema} schema
     * @returns {Promise<void>}
     */
    async save(schema) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: schema.id.value,
                name: schema.name.value,
                is_active: schema.is_active.value,
                data_structure: schema.data_structure.value,
                created_at: schema.created_at.value,
                created_by: schema.created_by.value,
                updated_at: schema.updated_at.value,
                updated_by: schema.updated_by.value,
                deleted_at: schema.deleted_at.value,
                deleted_by: schema.deleted_by.value,
            });
            EntityCache.invalidate(SCHEMAS_NAMESPACE, schema.id.value);
            EntityCache.invalidateNamespace(SCHEMA_RULES_NAMESPACE);
        } catch (error) {
            Helper.logError('Error saving schemas', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Actualiza una instancia de Schema e invalida la caché del id afectado
     * y la caché de reglas resueltas (que puede contener este schema anidado).
     * @param {Schema} schema
     * @returns {Promise<void>}
     */
    async update(schema) {
        await super.update(schema);
        EntityCache.invalidate(SCHEMAS_NAMESPACE, schema.id.value);
        EntityCache.invalidateNamespace(SCHEMA_RULES_NAMESPACE);
    }

    /**
     * Busca una instancia de Schema por su ID.
     * @param {ValueObjectUuid|{value:string}} id
     * @returns {Promise<Schema|null>}
     */
    async find(id) {
        try {
            return await EntityCache.get(
                SCHEMAS_NAMESPACE,
                id.value,
                async () => {
                    const result = await this.read.table('schemas').select('*').where({ id: id.value }).first();
                    return result ? Schema.create(result) : null;
                },
                SCHEMAS_TTL_MS
            );
        } catch (error) {
            Helper.logError('Error finding schemas', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Busca instancias de Schema según los criterios dados.
     * @param {Object} criteria
     * @returns {Promise<Schema[]>}
     */
    async search(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('schemas').select('*'));
            query.whereNull('deleted_at');
            const rows = await query;
            return rows.map((row) => Schema.create(row));
        } catch (error) {
            Helper.logError('Error searching schemas', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Cuenta cuántas definiciones están relacionadas a un schema dado su id.
     * @param {ValueObjectUuid|{value:string}} id
     * @returns {Promise<number>}
     */
    async countRelationsBySchemaId(id) {
        try {
            const [auxResult, oneScriptResult] = await Promise.all([
                this.read.table('aux_definitions').where({ schema_id: id.value }).count('id as count').first(),
                this.read.table('one-script').where({ schema_id: id.value }).count('id as count').first(),
            ]);

            const auxCount = Number(auxResult.count) || 0;
            const oneScriptCount = Number(oneScriptResult.count) || 0;

            return auxCount + oneScriptCount;
        } catch (error) {
            Helper.logError('Error counting schema_id relations in aux_definitions and one-script', error);
            throw new QueryDBError('count', 'countRelationsBySchemaId');
        }
    }

    /**
     * Busca una instancia de Schema activa por su ID.
     * @param {ValueObjectUuid|{value:string}} id
     * @returns {Promise<Schema|null>}
     */
    async findByIdAndActive(id) {
        try {
            const result = await this.read
                .table('schemas')
                .select('*')
                .where({ id: id.value, is_active: true })
                .first();

            return result ? Schema.create(result) : null;
        } catch (error) {
            Helper.logError('Error finding active schema by ID', error);
            throw new QueryDBError('find', 'findByIdAndActive');
        }
    }

    /**
     * Obtiene las relaciones de schemas recursivamente basándose en el data_structure.
     * Valida si hay campos de tipo "array" con schema_id y busca recursivamente hasta encontrar
     * un data_structure que no tenga tipo "array".
     * @param {ValueObjectUuid|{value:string}} id
     * @returns {Promise<Schema[]>}
     */
    async getSchemaRules(id) {
        try {
            return await EntityCache.get(
                SCHEMA_RULES_NAMESPACE,
                id.value,
                async () => {
                    const root = await this.read.table('schemas').select('*').where({ id: id.value }).first();

                    if (!root) return null;

                    const schemasById = await this.#loadReachableSchemas(root);
                    root.data_structure = this.#resolveRulesInMemory(
                        root.data_structure,
                        schemasById,
                        new Set([root.id])
                    );
                    return Schema.create(root);
                },
                SCHEMAS_TTL_MS
            );
        } catch (error) {
            Helper.logError('Error getting schema rules', error);
            throw new QueryDBError('find', 'getSchemaRules');
        }
    }

    /**
     * Carga, por niveles y en lote, todos los schemas alcanzables desde el root
     * a través de campos "array"/"object" con schema_id. Evita el N+1: emite un
     * único SELECT ... WHERE id IN (...) por nivel de anidación, no uno por nodo.
     * @param {object} root fila cruda del schema raíz
     * @returns {Promise<Map<string, object>>} schemas crudos indexados por id
     */
    async #loadReachableSchemas(root) {
        const schemasById = new Map([[root.id, root]]);
        let frontier = this.#collectSchemaIds(root.data_structure);

        while (frontier.length > 0) {
            const missing = [...new Set(frontier.filter((schemaId) => !schemasById.has(schemaId)))];
            if (missing.length === 0) {
                break;
            }

            const rows = await this.read.table('schemas').select('*').whereIn('id', missing);
            const next = [];
            for (const row of rows) {
                schemasById.set(row.id, row);
                next.push(...this.#collectSchemaIds(row.data_structure));
            }
            frontier = next;
        }

        return schemasById;
    }

    /**
     * Devuelve los schema_id referenciados por los campos "array"/"object" de una estructura.
     * @param {object|null|undefined} structure
     * @returns {string[]}
     */
    #collectSchemaIds(structure) {
        if (!structure) {
            return [];
        }
        const ids = [];
        for (const definition of Object.values(structure)) {
            if ((definition.type === 'array' || definition.type === 'object') && definition.schema_id) {
                ids.push(definition.schema_id);
            }
        }
        return ids;
    }

    /**
     * Ensambla en memoria (sin tocar BD) la estructura resuelta usando los schemas
     * pre-cargados. `visited` corta ciclos por rama preservando la resolución de diamantes.
     * @param {object} structure
     * @param {Map<string, object>} schemasById
     * @param {Set<string>} visited
     * @returns {object}
     */
    #resolveRulesInMemory(structure, schemasById, visited) {
        const resolved = {};

        for (const [field, definition] of Object.entries(structure)) {
            resolved[field] = { ...definition };

            if ((definition.type === 'array' || definition.type === 'object') && definition.schema_id) {
                const relatedSchema = schemasById.get(definition.schema_id);

                if (relatedSchema && relatedSchema.data_structure && !visited.has(definition.schema_id)) {
                    resolved[field].data_structure = this.#resolveRulesInMemory(
                        relatedSchema.data_structure,
                        schemasById,
                        new Set(visited).add(definition.schema_id)
                    );
                }
            }
        }

        return resolved;
    }
}
