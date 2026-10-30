import { CsvExportView, CsvExportViewValidationService, DomainCsvExportViewFinder } from '../../index.js';
import { CustomError } from '../../../shared/errors/CustomError.js';

export class CsvExportViewCreator {
    /**
     * @type {KnexCsvExportViewRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainCsvExportViewFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * @type {CsvExportViewValidationService}
     * is initialized in the constructor
     */
    #validationService;

    /**
     * @param {KnexCsvExportViewRepository} repository - The repository for managing CsvExportView records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainCsvExportViewFinder(repository);
        this.#validationService = new CsvExportViewValidationService(repository);
    }

    /**
     * Executes the process of creating a new CsvExportView.
     * @param {Object} dto - The data transfer object containing the properties for the CsvExportView object.
     * @returns {Promise<void>}
     */
    async execute(dto) {
        if (!dto) throw new Error('DTO cannot be null or undefined');

        const csvExportView = new CsvExportView(dto);

        const existingCsvExportView = await this.#finder.execute(csvExportView.id.value);
        if (existingCsvExportView) {
            throw new CustomError(`CsvExportView with id ${csvExportView.id.value} already exists`, 400);
        }

        await this.#validationService.execute(csvExportView.views);

        await this.#repository.save(csvExportView);
    }
}
