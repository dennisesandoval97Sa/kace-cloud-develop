import { CustomError } from '../../../shared/index.js';
import { CsvExportViewValidationService, DomainCsvExportViewFinder } from '../../index.js';

export class CsvExportViewUpdater {
    /**
     * @type {DomainCsvExportViewFinder}
     * is initialized in the constructor
     */
    #csvExportViewFinder;

    /**
     * @type {KnexCsvExportViewRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {CsvExportViewValidationService}
     * is initialized in the constructor
     */
    #validationService;

    /**
     * Creates an instance of the `CsvExportViewUpdater` class.
     *
     * @param {KnexCsvExportViewRepository} repository - An instance of the repository that manages CsvExportView records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#csvExportViewFinder = new DomainCsvExportViewFinder(repository);
        this.#validationService = new CsvExportViewValidationService(repository);
    }

    /**
     * Updates a `CsvExportView` object in the repository.
     *
     * @param {string} id - The unique identifier of the `CsvExportView` object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the `CsvExportView` object.
     * @returns {Promise<void>} A promise that resolves when the `CsvExportView` object is updated.
     */
    async execute(id, dto) {
        const csvExportView = await this.#csvExportViewFinder.execute(id);

        if (!csvExportView) {
            throw new CustomError(`CsvExportView with ID ${id} does not exist.`, 404);
        }

        csvExportView.update(dto);

        await this.#validationService.execute(csvExportView.views);

        await this.#repository.update(csvExportView);

        csvExportView.flushChanges();
    }
}
