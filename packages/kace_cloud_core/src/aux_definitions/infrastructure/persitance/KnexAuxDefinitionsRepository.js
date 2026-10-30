import { KnexRepository, SchemaMetadataCache } from '../../../shared/index.js';
import { AuxDefinition } from '../../domain/AuxDefinition.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexAuxDefinitionsRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'aux_definitions', readerConfig);
    }

    /**
     * Saves an `AuxDefinition` instance to the database.
     * @param {AuxDefinition} auxDefinition - The `AuxDefinition` instance to save.
     * @returns {Promise<void>} A promise that resolves when the `AuxDefinition` is saved.
     * @throws {QueryDBError} If there is an error saving the `AuxDefinition`.
     */
    async save(auxDefinition) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: auxDefinition.id.value,
                name: auxDefinition.name.value,
                tablename: auxDefinition.tablename.value,
                logs_tablename: auxDefinition.logs_tablename.value,
                schema_id: auxDefinition.schema_id.value,
                restflow_id: auxDefinition.restflow_id.value,
                is_active: auxDefinition.is_active.value,
                created_at: auxDefinition.created_at.value,
                created_by: auxDefinition.created_by.value,
                updated_at: auxDefinition.updated_at.value,
                updated_by: auxDefinition.updated_by.value,
                deleted_at: auxDefinition.deleted_at.value,
                deleted_by: auxDefinition.deleted_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving aux_definitions', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds an `AuxDefinition` instance by its ID.
     * @param {ValueObjectUuid} id - The ID of the `AuxDefinition` to find.
     * @returns {Promise<AuxDefinition|null>} A promise that resolves to the `AuxDefinition` instance if found, or null if not found.
     * @throws {QueryDBError} If there is an error finding the `AuxDefinition`.
     */
    async find(id) {
        try {
            const result = await this.read.table('aux_definitions').select('*').where({ id: id.value }).first();
            return result ? new AuxDefinition(result) : null;
        } catch (error) {
            Helper.logError('Error finding aux_definitions', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for `AuxDefinition` instances based on the given criteria.
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<AuxDefinition[]>} A promise that resolves to an array of `AuxDefinition` instances matching the criteria.
     * @throws {QueryDBError} If there is an error searching for `AuxDefinition` instances.
     */
    async search(criteria) {
        try {
            Helper.logDebug('criteria search', criteria);
            const query = criteria.convertToKnex(this.read.table('aux_definitions').select('*'));
            query.whereNull('deleted_at');
            Helper.logDebug('query', query.toString());
            const rows = await query;
            const result = rows.map((row) => new AuxDefinition(row));
            Helper.logDebug('result search', result);
            return result;
        } catch (error) {
            Helper.logError('Error searching aux_definitions', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Creates both the main and history tables if they do not exist.
     * @param {AuxDefinition} auxDefinition
     * @returns {Promise<void>}
     */
    async createTables(auxDefinition) {
        await this.createMainTable(auxDefinition.tablename);
        await this.createHistoryTable(auxDefinition.logs_tablename);
    }

    /**
     * Returns a schema builder qualified with the tenant schema.
     * Without this, DDL runs against the connection's search_path (resolving to
     * `public`), where the high-privileges auxiliar user lacks CREATE permission.
     * Falls back to the unqualified builder for SQLite (schema === null) in tests.
     * @returns {import('knex').Knex.SchemaBuilder}
     */
    schemaBuilder() {
        return this.schema ? this.connection.schema.withSchema(this.schema) : this.connection.schema;
    }

    /**
     * Creates the main table with standard entity fields if it does not exist.
     * @param {VOTableName} tableName - Name of the main table to create.
     * @returns {Promise<void>}
     */
    async createMainTable(tableName) {
        try {
            const exists = await this.schemaBuilder().hasTable(tableName.value);
            if (exists) {
                Helper.logInfo(`Table ${tableName.value} already exists`);
                return;
            }

            await this.schemaBuilder().createTable(tableName.value, (table) => {
                table.string('id', 36).primary();
                table.jsonb('data').notNullable();
                table.timestamp('created_at');
                table.timestamp('updated_at');
                table.timestamp('deleted_at').nullable();
                table.string('created_by', 36);
                table.string('updated_by', 36);
                table.string('deleted_by', 36);
            });

            SchemaMetadataCache.invalidateSchema(this.connection);

            Helper.logInfo(`Table ${tableName.value} created successfully`);
        } catch (error) {
            Helper.logError(`Error creating table ${tableName.value}:`, error);
            throw new QueryDBError('createTable');
        }
    }

    /**
     * Creates the history table to track changes to entities if it does not exist.
     * @param {VOLogsTableName} logs_tablename - Name of the history table to create.
     * @returns {Promise<void>}
     */
    async createHistoryTable(logs_tablename) {
        try {
            const exists = await this.schemaBuilder().hasTable(logs_tablename.value);
            if (exists) {
                Helper.logInfo(`Table ${logs_tablename.value} already exists`);
                return;
            }

            await this.schemaBuilder().createTable(logs_tablename.value, (table) => {
                table.string('id', 36).primary();
                table.string('entity_id', 36).notNullable().index(`idx_${logs_tablename.value}`);
                table.jsonb('changed_attributes');
                table.jsonb('new_attributes');
                table.jsonb('original_attributes');
                table.timestamp('created_at');
                table.string('created_by', 36);
            });

            SchemaMetadataCache.invalidateSchema(this.connection);

            Helper.logInfo(`Table ${logs_tablename.value} created successfully`);
        } catch (error) {
            Helper.logError(`Error creating table ${logs_tablename.value}:`, error);
            throw new QueryDBError('createTable');
        }
    }

    /**
     * Finds an `AuxDefinition` instance by its name.
     * @param {ValueObjectString} name - The name of the `AuxDefinition` to find.
     * @returns {Promise<AuxDefinition|null>} A promise that resolves to the `AuxDefinition` instance if found, or null if not found.
     * @throws {QueryDBError} If there is an error finding the `AuxDefinition`.
     */
    async findByName(name) {
        try {
            const result = await this.read
                .table('aux_definitions')
                .select('*')
                .where({ name: name?.value })
                .whereNull('deleted_at')
                .first();

            return result ? new AuxDefinition(result) : null;
        } catch (error) {
            Helper.logError('Error finding aux_definition by name', error);
            throw new QueryDBError('find', 'findByName failed');
        }
    }

    /**
     * Finds an `AuxDefinition` instance by its name.
     * @param {VOTableName} tableName - The name of the `AuxDefinition` to find.
     * @returns {Promise<AuxDefinition|null>} A promise that resolves to the `AuxDefinition` instance if found, or null if not found.
     * @throws {QueryDBError} If there is an error finding the `AuxDefinition`.
     */
    async findByTableName(tableName) {
        try {
            const result = await this.read
                .table('aux_definitions')
                .select('*')
                .where({ tablename: tableName.value })
                .whereNull('deleted_at')
                .first();

            return result ? new AuxDefinition(result) : null;
        } catch (error) {
            Helper.logError('Error finding aux_definition by name', error);
            throw new QueryDBError('find', 'findByTableName failed');
        }
    }
}
