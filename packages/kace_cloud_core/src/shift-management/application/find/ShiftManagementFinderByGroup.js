import { ShiftManagementResponse } from '../ShiftManagementResponse.js';

export default class ShiftManagementFinderByGroup {
    /**
     * @type {KnexShiftManagementRepository} is initialized in the constructor
     */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} groupId
     * @returns {Promise<ShiftManagementResponse|null>}
     */
    async execute(groupId) {
        const shiftManagement = await this.#repository.findByGroup(groupId);

        if (!shiftManagement || shiftManagement.deleted_by.value) {
            return null;
        }

        return new ShiftManagementResponse(shiftManagement);
    }
}
