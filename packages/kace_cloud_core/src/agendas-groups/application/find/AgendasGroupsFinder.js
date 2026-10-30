import { AgendasGroupsFinder as DomainAgendasGroupsFinder } from '../../domain/AgendasGroupsFinder.js';
import { AgendasGroupsResponse } from '../AgendasGroupsResponse.js';

export class AgendasGroupsFinder {
    /**
     * @type {DomainAgendasGroupsFinder} is initialized in the constructor
     */
    #finder;

    /**
     * @param {KnexAgendasGroupsRepository} repository
     */
    constructor(repository) {
        this.#finder = new DomainAgendasGroupsFinder(repository);
    }

    /**
     * Find a relationship between an agenda and a group.
     *
     * @param {Object} dto - The data transfer object.
     * @param {string} dto.agenda_id - The agenda id.
     * @param {string} dto.group_id - The group id.
     *
     * @returns {Promise<?AgendasGroupsResponse>} - Promise that resolves with the relationship if found, null otherwise
     */
    async execute(dto) {
        const agendasGroups = await this.#finder.execute(dto.agenda_id, dto.group_id);
        return agendasGroups ? new AgendasGroupsResponse(agendasGroups) : null;
    }
}
