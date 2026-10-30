import { KnexRepository } from '../../../shared/index.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { Auxiliary } from '../../domain/Auxiliary.js';
import { AUX_SPECIALIZED_FK } from '../../domain/AuxFkMapping.js';
import { v4 as uuidV4 } from 'uuid';

export class KnexAuxiliariesRepository extends KnexRepository {
    constructor(config, tableName) {
        super(config, tableName);
    }

    /**
     * Guarda una instancia de Auxiliary en la base de datos.
     * @param {Auxiliary} auxiliary - La instancia de Auxiliary a guardar.
     * @returns {Promise<AuxCases>} Una promesa que se resuelve cuando el Auxiliary se guarda.
     * @throws {QueryDBError} Si hay un error al guardar el Auxiliary.
     */
    async save(auxiliary, tableName) {
        try {
            const [insertedRecord] = await this.table(tableName)
                .insert({
                    id: auxiliary.id.value,
                    data: auxiliary.data.value,
                    created_at: auxiliary.created_at.value,
                    created_by: auxiliary.created_by.value,
                })
                .returning('*');

            return new Auxiliary(insertedRecord);
        } catch (error) {
            Helper.logError('Error guardando Auxiliary', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Encuentra una instancia de Auxiliaries por su ID.
     * @param {ValueObjectUuid} id - El ID del Auxiliaries a encontrar.
     * @returns {Promise<Auxiliary|null>} Una promesa que se resuelve a la instancia de Auxiliaries si se encuentra, o null si no se encuentra.
     * @throws {QueryDBError} Si hay un error al encontrar el Auxiliaries.
     */
    async find(id, tableName) {
        try {
            const result = await this.table(tableName)
                .select('*')
                .where({ id: id.value })
                .whereNull('deleted_at')
                .first();

            return result ? new Auxiliary(result) : null;
        } catch (error) {
            Helper.logError('Error encontrando auxiliaries', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Busca instancias de Auxiliaries basadas en los criterios dados.
     * @param {Object} criteria - Los criterios para la operación de búsqueda.
     * @returns {Promise<Auxiliaries[]>} Una promesa que se resuelve a un array de instancias de Auxiliaries que coinciden con los criterios.
     * @throws {QueryDBError} Si hay un error al buscar instancias de Auxiliaries.
     */
    async search(criteria, tableName) {
        try {
            const query = criteria.convertToKnex(this.table(tableName).select(`${tableName}.*`));
            query.whereNull(`${tableName}.deleted_at`);
            const a = query.toQuery();
            const rows = await query;
            return rows.map((row) => new Auxiliary(row));
        } catch (error) {
            Helper.logError('Error buscando auxiliaries', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Obtiene el registro completo de un schema específico.
     * @param {ValueObjectUuid} schemaId - El ID del schema del cual obtener la información.
     * @returns {Promise<Object|null>} Una promesa que se resuelve al registro completo del schema o null si no existe.
     * @throws {QueryDBError} Si hay un error al obtener la información del schema.
     */
    async getSchema(schemaId) {
        try {
            const result = await this.table('schemas')
                .select('*')
                .where({
                    id: schemaId.value,
                })
                .first();

            return result || null;
        } catch (error) {
            Helper.logError('Error obteniendo información del schema', error);
            throw new QueryDBError('custom', 'getSchema fail');
        }
    }

    /**
     *
     * @param {Object} aggregate aggregate class
     * @returns {Promise<void>}
     */
    async update(aggregate, tableName) {
        try {
            await this.table(tableName)
                .update(aggregate.changedAttributes)
                .where({ id: aggregate.id.value })
                .whereNull('deleted_at');
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('update');
        }
    }

    /**
     *
     * @param {AggregateRoot} aggregate current attributes of aggregate
     * @param originalAttributes
     * @description This method is used to save history of any aggregate
     * @example
     * await this.saveHistory(aggregate, originalAttributes);
     * @returns {Promise<void>}
     */
    async saveHistory(aggregate, originalAttributes = null, tableName) {
        const data = {
            id: uuidV4(),
            entity_id: aggregate.id.value,
            changed_attributes: JSON.stringify(aggregate.changedAttributes),
            new_attributes: JSON.stringify(aggregate.toJson()),
            original_attributes: JSON.stringify(originalAttributes ?? aggregate.toJson()),
            created_at: aggregate.updated_at?.value ?? aggregate.created_at.value,
            created_by: aggregate.updated_by?.value ?? aggregate.created_by.value,
        };

        await this.table(`history_${tableName}`).insert(data);
    }

    async count(criteria, tableName) {
        try {
            const query = criteria.convertToKnex(this.table(tableName).count());
            query.whereNull(`${tableName}.deleted_at`);
            query.clearOrder();
            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError(error);
            throw new QueryDBError(`count`);
        }
    }

    async bulkDelete(ids, dto, tableName) {
        try {
            await this.table(tableName)
                .update({
                    deleted_at: dto.deleted_at,
                    deleted_by: dto.deleted_by,
                })
                .whereIn('id', ids)
                .whereNull('deleted_at');
        } catch (error) {
            Helper.logError('Error en bulkDelete', error);
            throw new QueryDBError('bulkDelete');
        }
    }

    /**
     * Mapping of known main entities to their FK field names in data JSONB and main table.
     * Only these specific FK fields indicate a dependency on a main entity.
     */
    // Cada clave es un campo que puede aparecer dentro de `data` y la tabla de la entidad
    // dueña a la que apunta. Si anades una entrada, comprueba el nombre contra las
    // migraciones: una tabla renombrada aqui se traduce en una guarda de integridad que
    // no bloquea nada (ver #tableExists).
    #KNOWN_DATA_FK_FIELDS = {
        caso_id: 'cases',
        cliente_id: 'clients',
        usuario_id: 'usuarios',
        grupo_id: 'grupos',
        rol_id: 'roles',
        clasificacion_id: 'clasificaciones',
        estado_id: 'estados',
        transicion_id: 'transiciones',
        agenda_id: 'agendas',
        notificacion_id: 'user_notifications',
        comentario_id: 'comentarios',
        plantilla_id: 'plantillas',
    };

    /**
     * Checks if an auxiliary record has an active dependency on a main entity.
     * Verifies that the FK points to an existing (not deleted) main entity record.
     *
     * @param {string} id - The record ID to check
     * @param {string} tableName - The auxiliary table name
     * @returns {Promise<boolean>} True if the record has an active dependency on a main entity
     */
    async hasMainEntityDependency(id, tableName) {
        const row = await this.table(tableName).select('*').where({ id }).first();
        if (!row) return false;

        const fkConfig = AUX_SPECIALIZED_FK[tableName];
        if (fkConfig) {
            const fkValue = row[fkConfig.fkColumn];
            if (fkValue) {
                if (await this.#tableExists(fkConfig.mainTable)) {
                    const mainRow = await this.table(fkConfig.mainTable)
                        .select('id')
                        .where({ id: fkValue })
                        .whereNull('deleted_at')
                        .first();
                    if (mainRow) {
                        return true;
                    }
                }
            }
        }

        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        if (data && typeof data === 'object') {
            for (const [fkField, mainTable] of Object.entries(this.#KNOWN_DATA_FK_FIELDS)) {
                const fkValue = data[fkField];
                if (fkValue) {
                    if (await this.#tableExists(mainTable)) {
                        const mainRow = await this.table(mainTable)
                            .select('id')
                            .where({ id: fkValue })
                            .whereNull('deleted_at')
                            .first();
                        if (mainRow) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    #tableExistsCache = new Map();

    async #tableExists(tableName) {
        if (!this.#tableExistsCache.has(tableName)) {
            // Qualify with the tenant schema so the existence check targets the same
            // schema as the data access in this.table() (which uses qualifiedName()).
            // Without this, hasTable() resolves against the connection search_path
            // (defaults to "$user", public) and misses tenant-schema tables.
            const schemaBuilder = this.schema ? this.connection.schema.withSchema(this.schema) : this.connection.schema;
            const exists = await schemaBuilder.hasTable(tableName);
            if (!exists) {
                // Una tabla del mapeo que no existe convierte la guarda de integridad en un
                // "no hay dependencia" permanente. Se registra porque el sintoma -un borrado
                // que deberia bloquearse y no se bloquea- no deja ningun otro rastro.
                Helper.logError(
                    `AuxFkMapping apunta a la tabla "${tableName}", que no existe en el esquema ${this.schema ?? 'por defecto'}: la comprobacion de dependencia queda desactivada para ese campo`
                );
            }
            this.#tableExistsCache.set(tableName, exists);
        }
        return this.#tableExistsCache.get(tableName);
    }
}
