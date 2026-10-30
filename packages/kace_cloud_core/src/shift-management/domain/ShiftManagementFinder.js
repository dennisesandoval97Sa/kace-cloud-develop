import { ValueObjectUuid } from '../../shared/index.js';

export class ShiftManagementFinder {
    /** @type {KnexShiftManagementRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `ShiftManagementFinder` class.
     *
     * @param {KnexShiftManagementRepository} repository - An instance of the repository that manages ShiftManagement records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a ShiftManagement record by its ID.
     *
     * @param {string} id - The UUID of the ShiftManagement record to find.
     * @return {Promise<ShiftManagement>} A promise that resolves to the `ShiftManagement` instance if found, or `null` if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
