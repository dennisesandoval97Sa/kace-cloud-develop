import { AutomationSettings } from '../../domain/AutomationSettings.js';
import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexAutomationSettingsRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'automation_settings', readerConfig);
    }

    /**
     * Saves a new AutomationSettings in the database.
     * @param {AutomationSettings} automationSettings
     * @returns {Promise<void>}
     */
    async save(automationSettings) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: automationSettings.id.value,
                description: automationSettings.description.value,
                frequency: automationSettings.frequency.value,
                start_date: automationSettings.start_date.value,
                end_date: automationSettings.end_date.value,
                created_at: automationSettings.created_at.value,
                created_by: automationSettings.created_by.value,
                deleted_at: automationSettings.deleted_at.value,
                deleted_by: automationSettings.deleted_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving AutomationSettings:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds a AutomationSettings by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<AutomationSettings | null>}
     */
    async find(id) {
        try {
            const result = await this.read.table('automation_settings').where({ id: id.value }).first();

            return result ? new AutomationSettings(result) : null;
        } catch (error) {
            Helper.logError('Error finding AutomationSettings:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for `AutomationSettings` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<AutomationSettings[]>} A promise that resolves to an array of `AutomationSettings` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('automation_settings').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;

            return rows.map((row) => new AutomationSettings(row));
        } catch (error) {
            Helper.logError('Error searching AutomationSettings:', error);
            throw new QueryDBError('search');
        }
    }
}
