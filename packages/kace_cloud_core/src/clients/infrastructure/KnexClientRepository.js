import { Client } from '../index.js';
import { CustomError, Helper, InvalidArgumentError, KnexRepository } from '../../shared/index.js';
import { QueryDBError } from '../../shared/errors/QueryDBError.js';

export class KnexClientRepository extends KnexRepository {
    static #PROJECTABLE_RELATIONS = new Set(['aux_clients']);

    constructor(config, readerConfig = null) {
        super(config, 'clients', readerConfig);
    }

    /**
     * Saves a client instance to the repository.
     *
     * @param {Client} client - The client instance to save.
     * @returns {Promise<Client>}
     */
    async save(client) {
        try {
            const [insertedRecord] = await this.table()
                .insert({
                    id: client.id.value,
                    tipo_cliente: client.tipo_cliente.value,
                    tipo_documento: client.tipo_documento.value,
                    documento: client.documento.value,
                    nombres: client.nombres.value,
                    apellido1: client.apellido1.value,
                    apellido2: client.apellido2.value,
                    nombre_empresa: client.nombre_empresa.value,
                    sexo: client.sexo.value,
                    estado_civil: client.estado_civil.value,
                    fecha_nacimiento: client.fecha_nacimiento.value,
                    email: client.email.value,
                    email_alterno: client.email_alterno.value,
                    telefono: client.telefono.value,
                    telefono_alterno: client.telefono_alterno.value,
                    status: client.status.value,
                    padre_id: client.padre_id.value,
                    habeas_data: client.habeas_data.value,
                    campos_extra1: client.campos_extra1.value,
                    campos_extra2: client.campos_extra2.value,
                    campos_extra3: client.campos_extra3.value,
                    created_at: client.created_at.value,
                    created_by: client.created_by.value,
                })
                .returning('*');

            return new Client(insertedRecord);
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Updates a client instance in the repository.
     *
     * @param {Client} client - The client instance to save.
     * @returns {Promise<void>}
     */
    async update(client) {
        try {
            if (!client || !client.id) {
                throw new InvalidArgumentError('Client must have an ID');
            }
            const result = await this.table().where({ id: client.id.value }).update(client.changedAttributes);

            if (result === 0) {
                throw new InvalidArgumentError('Client not found');
            }
        } catch (error) {
            Helper.logInfo('Error updating client', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Finds a client by ID.
     *
     * @param {ValueObjectUuid} id - The ID of the client to find.
     * @returns {Promise<Client|null>} The found client or null if not found.
     */
    async find(id) {
        try {
            if (!id?.value) {
                throw new InvalidArgumentError('ID must be provided');
            }
            const result = await this.table().where({ id: id.value }).first();

            return result ? new Client(result) : null;
        } catch (error) {
            Helper.logInfo('Error finding client', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for `Client` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<Client[]>} A promise that resolves to an array of `Client` instances matching the criteria.
     */
    async search(criteria) {
        try {
            /*
             * `clients.*` en lugar de `*`: cuando el criterio trae un `relationship` (p. ej. el
             * join a `aux_clients` de la ejecucion masiva) las tablas comparten nombres de columna
             * (`id`, `data`, `created_at`, `deleted_at`...) y un `*` plano los pisaria, devolviendo
             * un cliente con el `id` de la fila auxiliar. Por el mismo motivo `deleted_by` se
             * cualifica: sin prefijo Postgres lo rechaza como referencia ambigua.
             */
            const queryBuilder = this.read.table('clients').select('clients.*');

            const relationTables = this.#selectRelationRows(queryBuilder, criteria);

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('clients.deleted_by');

            const rows = await queryBuilder;
            return rows.map((row) => new Client({ ...row, relations: this.#extractRelations(row, relationTables) }));
        } catch (error) {
            Helper.logInfo('Error searching client', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Añade un `row_to_json(<tabla>.*) as <tabla>` por cada tabla unida, de modo que la fila
     * relacionada viaje completa y sin colisionar con las columnas de `clients`.
     * Nota: Requiere soporte de funciones JSON nativas del dialecto PostgreSQL (`row_to_json`).
     *
     * @param {import('knex').Knex.QueryBuilder} queryBuilder
     * @param {Criteria} criteria
     * @returns {string[]} nombres (o alias) de las tablas unidas
     */
    #selectRelationRows(queryBuilder, criteria) {
        const relations = criteria?.relationship ?? [];
        if (!relations.length) {
            return [];
        }

        const relationTables = [...new Set(relations.map((relation) => relation.toPrimitives().table.value))].filter(
            (table) => KnexClientRepository.#PROJECTABLE_RELATIONS.has(table)
        );
        relationTables.forEach((table) => {
            queryBuilder.select(queryBuilder.client.raw(`row_to_json(??.*) as ??`, [table, table]));
        });

        return relationTables;
    }

    /**
     * @param {object} row
     * @param {string[]} relationTables
     * @returns {object} relaciones indexadas por tabla, `{}` cuando no hubo joins
     */
    #extractRelations(row, relationTables) {
        return relationTables.reduce((relations, table) => {
            relations[table] = row[table];
            return relations;
        }, {});
    }

    /**
     * Counts the number of records in the database that match the given criteria.
     * @param {Object} criteria - The criteria to use for counting records.
     * @returns {Promise<number>} A promise that resolves to the count of records that match the criteria.
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('clients').count());
            const rows = await query.whereNull('clients.deleted_by');

            return rows;
        } catch (error) {
            Helper.logInfo('Error counting client', error);
            throw new QueryDBError('count');
        }
    }

    async getDocTypes() {
        try {
            const parentId = await this.read
                .table('literales')
                .select('id')
                .where({ tipo_literal: null })
                .andWhere({ nombre: 'clientes' })
                .andWhere({ is_active: true })
                .first();
            if (!parentId?.id) {
                throw new CustomError('No literals found for clients', 404);
            }
            const fields = await this.read
                .table('literales')
                .select('id', 'nombre')
                .where({ tipo_literal: parentId.id })
                .andWhere({ is_active: true });
            if (fields.length === 0) throw new CustomError('No literals found for client fields', 404);

            let result = {};
            for (const field of fields) {
                const literals = await this.read
                    .table('literales')
                    .select('nombre')
                    .where({ tipo_literal: field.id })
                    .andWhere({ is_active: true })
                    .whereNull('deleted_at');
                result[field.nombre] = literals.map((literal) => literal.nombre);
            }

            return result;
        } catch (error) {
            Helper.logInfo('Error finding doctypes', error);
            throw new QueryDBError('find');
        }
    }

    /**
     *
     * @param {string} docType
     * @param {string} document
     * @returns {Promise<Client|null>}
     */
    async findByIdentification(docType, document) {
        try {
            const row = await this.table()
                .where({
                    tipo_documento: docType,
                    documento: document,
                    deleted_at: null,
                })
                .first();

            return row ? new Client(row) : null;
        } catch (error) {
            Helper.logInfo('Error finding client by identification', error);
            throw new QueryDBError('find');
        }
    }
}
