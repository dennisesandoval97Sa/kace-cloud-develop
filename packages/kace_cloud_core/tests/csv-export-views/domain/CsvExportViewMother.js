import { v4 as uuidV4 } from 'uuid';
import { CsvExportView } from '../../../src/csv-export-views';

export default class CsvExportViewMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `CsvExportView` entity.
     *
     * @param {Object} params - Optional parameters to override default values.
     * @returns {Object} The DTO containing properties for the `CsvExportView` entity.
     */
    static dto({
        id,
        description,
        is_active,
        views,
        time_filter,
        frequency,
        interval,
        last_execution_at,
        details,
        next_execution_at,
        storage_path,
        created_by,
        created_at,
    } = {}) {
        return {
            id: id ?? uuidV4(),
            description: description ?? 'Default description',
            is_active: is_active ?? true,
            views: views ?? [],
            frequency: frequency ?? 'hours',
            interval: interval ?? 12,
            time_filter: time_filter ?? {
                field: 'created_at',
                interval: 12,
                unit: 'hours',
                reference: 'now',
            },
            storage_path: storage_path ?? 'default/storage/path',
            last_execution_at: last_execution_at ?? null,
            details: details ?? null,
            next_execution_at: next_execution_at ?? new Date().toISOString(),
            created_by: created_by ?? uuidV4(),
            created_at: created_at ?? new Date().toISOString(),
        };
    }

    /**
     * Creates an instance of `CsvExportView` and saves it to the repository.
     *
     * @param {Object} repository - The repository to save the `CsvExportView` instance.
     * @param {Object} data - Optional data to override default values.
     * @returns {Promise<CsvExportView>} The created `CsvExportView` instance.
     */
    static async create(repository, data = {}) {
        const dto = CsvExportViewMother.dto(data);
        const csvExportView = CsvExportView.create(dto);
        await repository.save(csvExportView);
        return csvExportView;
    }
}
