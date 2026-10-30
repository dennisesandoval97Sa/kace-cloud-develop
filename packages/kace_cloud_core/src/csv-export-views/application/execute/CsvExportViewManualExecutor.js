import { CustomError } from '../../../shared/index.js';
import { DomainCsvExportViewFinder } from '../../index.js';

export class CsvExportViewManualExecutor {
    /** @type {DomainCsvExportViewFinder} is initialized in the constructor */
    #finder;

    constructor({ executionService, csvExportViewRepository }) {
        this.executionService = executionService;
        this.#finder = new DomainCsvExportViewFinder(csvExportViewRepository);
    }

    /**
     *
     * @param {string} id - The unique identifier of the CsvExportView object to find.
     * @returns
     */
    async execute(id, filterDate = null) {
        const csvExportView = await this.#finder.execute(id);

        if (!csvExportView || csvExportView.isDeleted()) {
            throw new CustomError('CsvExportView not found', 404);
        }

        if (!csvExportView.isActive()) {
            throw new CustomError('CsvExportView is not active', 400);
        }

        const result = await this.executionService.execute(csvExportView, true, filterDate);
        return { id: id, ...result };
    }
}
