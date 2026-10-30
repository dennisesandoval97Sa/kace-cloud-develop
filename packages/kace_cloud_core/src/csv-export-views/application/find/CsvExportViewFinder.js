import { CustomError } from '../../../shared/index.js';
import { CsvExportViewResponse, DomainCsvExportViewFinder } from '../../index.js';

export class CsvExportViewFinder {
    /**
     * @type {DomainCsvExportViewFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * Creates an instance of the `CsvExportViewFinder` class.
     *
     * @param {KnexCsvExportViewRepository} repository - An instance of the repository that manages CsvExportView records.
     */
    constructor(repository) {
        this.#finder = new DomainCsvExportViewFinder(repository);
    }

    /**
     * Executes the finding of a CsvExportView object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the CsvExportView object to find.
     * @returns {Promise<CsvExportViewResponse>} A promise that resolves to a CsvExportViewResponse object containing the found CsvExportView data.
     */
    async execute(id) {
        const csvExportView = await this.#finder.execute(id);

        if (!csvExportView || csvExportView.isDeleted()) {
            throw new CustomError('CsvExportView not found', 404);
        }

        return new CsvExportViewResponse(csvExportView);
    }
}
