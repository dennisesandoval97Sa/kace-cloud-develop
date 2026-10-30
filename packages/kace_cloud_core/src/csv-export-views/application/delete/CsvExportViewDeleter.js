import { CustomError } from '../../../shared/errors/CustomError.js';
import { DomainCsvExportViewFinder } from '../../index.js';

export class CsvExportViewDeleter {
    /**
     * @type {DomainCsvExportViewFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * @type {KnexCsvExportViewRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * Creates an instance of the `CsvExportViewDeleter` class.
     *
     * @param {KnexCsvExportViewRepository} repository - An instance of the repository that manages CsvExportView records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainCsvExportViewFinder(repository);
    }

    /**
     * Deletes a `CsvExportView` object from the repository.
     *
     * This method finds the CsvExportView entity by its ID, applies deletion operations (like setting deleted flags),
     * updates the repository with the modified entity, and then flushes any changes.
     *
     * @param {string} id - The unique identifier of the CsvExportView entity to delete.
     * @param {Object} dto - The data transfer object containing the properties for the `CsvExportView` object (e.g., deleted_by, deleted_at).
     * @returns {Promise<void>} A promise that resolves when the `CsvExportView` entity is deleted.
     * @throws {CustomError} Throws an error if the CsvExportView entity does not exist or is already deleted.
     */
    async execute(id, dto) {
        const csvExportView = await this.#finder.execute(id);

        if (!csvExportView) {
            throw new CustomError(`CsvExportView with ID ${id} does not exist.`, 404);
        }

        csvExportView.delete(dto);

        await this.#repository.update(csvExportView);

        csvExportView.flushChanges();
    }
}
