import { CustomError } from '../../../shared/index.js';
import { DomainShiftManagementFinder, ShiftManagementResponse } from '../../index.js';

export class ShiftManagementFinder {
    /** @type {DomainShiftManagementFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of the `ShiftManagementFinder` class.
     *
     * @param {KnexShiftManagementRepository} repository - An instance of the repository that manages ShiftManagement records.
     */
    constructor(repository) {
        this.#finder = new DomainShiftManagementFinder(repository);
    }

    /**
     * Executes the finding of a ShiftManagement object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the ShiftManagement object to find.
     * @returns {Promise<ShiftManagementResponse>} A promise that resolves to a ShiftManagementResponse object containing the found ShiftManagement data.
     */
    async execute(id) {
        const shiftManagement = await this.#finder.execute(id);

        if (!shiftManagement || shiftManagement.isDeleted()) {
            throw new CustomError('Shift Management not found', 404);
        }
        return new ShiftManagementResponse(shiftManagement);
    }
}
