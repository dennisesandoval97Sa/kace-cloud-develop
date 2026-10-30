import { CsvExportView } from '../index.js';
import { KnexRepository, QueryDBError } from '../../shared/index';
import { Helper } from '../../shared/infrastructure/utils/Helper.js';
import { DbRequestContext } from '../../shared/infrastructure/context/DbRequestContext.js';
import createDayjsInstance from '../../shared/factories/DayjsFactory';

const dayjs = createDayjsInstance({});

export class KnexCsvExportViewRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'csv_export_views', readerConfig);
    }

    /**
     * Saves a new CsvExportView record in the database.
     * @param {CsvExportView} updateModel
     * @returns {Promise<void>}
     */
    async save(updateModel) {
        DbRequestContext.markWrite();
        try {
            await this.table().insert({
                id: updateModel.id.value,
                description: updateModel.description.value,
                is_active: updateModel.is_active.value,
                views: JSON.stringify(updateModel.views.value),
                frequency: updateModel.frequency.value,
                interval: updateModel.interval.value,
                time_filter: JSON.stringify(updateModel.time_filter.value),
                storage_path: updateModel.storage_path.value,
                last_execution_at: updateModel.last_execution_at.value,
                next_execution_at: updateModel.next_execution_at.value,
                details: JSON.stringify(updateModel.details.value),
                created_at: updateModel.created_at.value,
                created_by: updateModel.created_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving CsvExportView:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds a CsvExportView record by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<CsvExportView | null>}
     */
    async find(id) {
        try {
            const result = await this.read.table('csv_export_views').where({ id: id.value }).first();

            return result ? new CsvExportView(result) : null;
        } catch (error) {
            Helper.logError('Error finding CsvExportView:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for CsvExportView instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<CsvExportView[]>} A promise that resolves to an array of CsvExportView instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('csv_export_views').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows.map((row) => new CsvExportView(row));
        } catch (error) {
            Helper.logError('Error searching CsvExportViews:', error);
            throw new QueryDBError('search');
        }
    }

    async findByNextExecutionAt(date = dayjs()) {
        try {
            const day = dayjs(date);
            const startOfHour = day.startOf('hour').toISOString();
            const endOfHour = day.endOf('hour').toISOString();

            const records = await this.table().where(function () {
                this.where('next_execution_at', '>=', startOfHour)
                    .andWhere('next_execution_at', '<=', endOfHour)
                    .orWhereNull('last_execution_at');
            });
            return records.map((record) => new CsvExportView(record));
        } catch (error) {
            Helper.logError('Error finding pending execution CsvExportViews:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     *
     * @param {string} vista
     * @param {import ('../index.js').ValueObjectTimeFilter } timeFilter
     * @returns
     */
    async fetchViewData(vista, timeFilter, filterDate = null) {
        try {
            // Heavy read: build the CSV rows from the reader replica.
            const query = this.read.table(vista).select('*');

            if (filterDate && typeof filterDate === 'string') {
                const startOfDay = `${filterDate} 00:00:00`;
                const endOfDay = `${filterDate} 23:59:59`;
                query
                    .where(timeFilter.value.field, '>=', `${startOfDay}`)
                    .andWhere(timeFilter.value.field, '<=', endOfDay);
                return await query;
            }

            // Build the interval fragment on the reader connection so it stays bound to the
            // same pool that executes the SELECT (avoids cross-instance binding/dialect issues).
            query.where(timeFilter.value.field, '>', this.read.raw(timeFilter.toSQL()));
            return await query;
        } catch (error) {
            Helper.logError(`Error al consultar la vista ${vista}:`, error);
            throw new QueryDBError('custom', `Failed to fetch data from vista ${vista}`);
        }
    }
}
