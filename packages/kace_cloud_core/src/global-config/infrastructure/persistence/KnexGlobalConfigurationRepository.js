import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { GlobalConfigurations } from '../../index.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexGlobalConfigurationRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'global_configurations', readerConfig);
    }

    async save(globalConfig) {
        try {
            DbRequestContext.markWrite();
            return await this.table().insert({
                id: globalConfig.id.value,
                description: globalConfig.description.value,
                settings: globalConfig.settings.value,
                is_active: globalConfig.is_active.value,
                created_at: globalConfig.created_at.value,
                created_by: globalConfig.created_by.value,
            });
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('save');
        }
    }

    /**
     *
     * @param {ValueObjectUuid} id Id for search
     * @returns {null|GlobalConfigurations}
     */
    async find(id) {
        try {
            const result = await this.read
                .table('global_configurations')
                .where({ id: id.value })
                .whereNull('deleted_at')
                .first('*');

            // Hydration is non-strict: a legacy out-of-range numeric value is normalized
            // instead of throwing and making the whole global configuration unreadable.
            return !result ? null : new GlobalConfigurations(result, { strict: false });
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Updates the given `Ans` instance in the database.
     *
     * @param {GlobalConfigurations} globalConfig - The `Ans` instance to update.
     * @returns {Promise<void>} A promise that resolves when the `Ans` instance is updated.
     */
    async update(globalConfig) {
        if (!globalConfig.hasMeaningfulChanges()) {
            return;
        }

        try {
            // This override does not call super.update(), so mark the write manually.
            DbRequestContext.markWrite();
            await this.table().update(globalConfig.changedAttributes).where({ id: globalConfig.id.value });
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('update');
        }
    }

    async search(criteria) {
        try {
            // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
            const queryBuilder = this.read.table('global_configurations').select('*'); //TODO: Agregar en el select los campos a traer: tener en cuenta relaciones

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows.map((row) => new GlobalConfigurations(row, { strict: false }));
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Bulk fetch global configurations by ids, excluding soft-deleted.
     * @param {string[]} ids
     * @returns {Promise<GlobalConfigurations[]>}
     */
    async findByIds(ids) {
        if (!Array.isArray(ids) || ids.length === 0) return [];
        try {
            const rows = await this.read
                .table('global_configurations')
                .whereNull('deleted_at')
                .whereIn('id', ids)
                .select('*');
            return rows.map((row) => new GlobalConfigurations(row, { strict: false }));
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('findByIds');
        }
    }
}
