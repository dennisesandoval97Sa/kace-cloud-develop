import { ValueObjectUuid } from '../../shared/index.js';

export class CsvExportViewFinder {
    /** @type {KnexCsvExportViewRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a CsvExportView by ID.
     *
     * @param {string} id - The ID of the CsvExportView to find.
     * @returns {Promise<CsvExportView>} A promise that resolves to the CsvExportView instance.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
