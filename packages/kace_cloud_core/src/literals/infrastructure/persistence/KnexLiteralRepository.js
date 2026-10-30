import { Literal } from '../../index';
import { KnexRepository } from '../../../shared/index';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexLiteralRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'literales', readerConfig);
    }

    /**
     * Saves a new literal to the database.
     *
     * @param {Literal} literal - The literal to be saved.
     * @returns {Promise<void>}
     * @throws {Error} Throws an error if saving the literal fails.
     */
    async save(literal) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: literal.id.value,
                tipo_literal: literal.tipo_literal.value,
                nombre: literal.nombre.value,
                is_active: literal.is_active.value,
                created_at: literal.created_at.value,
                created_by: literal.created_by.value,
                deleted_at: literal.deleted_at.value,
                deleted_by: literal.deleted_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving literal:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds a literal by ID.
     *
     * @param {ValueObjectUuid} id - The ID of the literal to find.
     * @returns {Promise<Literal | null>} A promise that resolves to the found literal, or null if not found.
     * @throws {Error} Throws an error if finding the literal fails.
     */
    async find(id) {
        try {
            const result = await this.read.table('literales').where({ id: id.value }).first();

            return result ? new Literal(result) : null;
        } catch (error) {
            Helper.logError('Error finding literal:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Updates an existing literal.
     *
     * @param {Literal} literal - The literal to be updated.
     * @returns {Promise<void>}
     * @throws {Error} Throws an error if updating the literal fails.
     */
    async update(literal) {
        if (Object.keys(literal.changedAttributes).length === 0) {
            return;
        }

        try {
            DbRequestContext.markWrite();
            await this.table().update(literal.changedAttributes).where({ id: literal.id.value });
        } catch (error) {
            Helper.logError('Error updating literal:', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Searches for `Literal` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<Literal[]>} A promise that resolves to an array of `Literal` instances matching the criteria.
     * @throws {Error} Throws an error if searching literals fails.
     */
    async search(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('literales').select('*').whereNull('deleted_by'));
            const rows = await query;
            return rows.map((row) => new Literal(row));
        } catch (error) {
            Helper.logError('Error searching literals:', error);
            throw new QueryDBError('search');
        }
    }

    async findActiveOptionByPath(modelName, fieldName, optionName) {
        try {
            const qualifiedTableName = this.qualifiedName(this.tableName);

            const row = await this.connection(`${qualifiedTableName} as option`)
                .select('option.*')
                .join(`${qualifiedTableName} as field`, 'option.tipo_literal', 'field.id')
                .join(`${qualifiedTableName} as model`, 'field.tipo_literal', 'model.id')
                .where({
                    'model.nombre': modelName,
                    'field.nombre': fieldName,
                    'option.nombre': optionName,
                    'model.is_active': true,
                    'field.is_active': true,
                    'option.is_active': true,
                })
                .whereNull('model.deleted_at')
                .whereNull('model.deleted_by')
                .whereNull('field.deleted_at')
                .whereNull('field.deleted_by')
                .whereNull('option.deleted_at')
                .whereNull('option.deleted_by')
                .first();

            return row ? new Literal(row) : null;
        } catch (error) {
            Helper.logError('Error finding active literal option by path:', error);
            throw new QueryDBError('findActiveOptionByPath');
        }
    }
}
