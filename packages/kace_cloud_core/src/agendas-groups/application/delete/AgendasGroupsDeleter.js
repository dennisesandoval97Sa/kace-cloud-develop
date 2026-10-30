import { AgendasGroupsFinder as DomainAgendasGroupsFinder } from '../../domain/AgendasGroupsFinder.js';
import { ValidationFailError } from '../../../shared/index.js';

export class AgendasGroupsDeleter {
    /**
     * @type {KnexAgendasGroupsRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainAgendasGroupsFinder} is initialized in the constructor
     */
    #finder;

    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainAgendasGroupsFinder(repository);
    }

    /**
     * Delete a relationship between an agenda and a group.
     *
     * @param {Object} dto - The data transfer object.
     * @param {string} dto.agenda_id - The agenda id.
     * @param {string} dto.group_id - The group id.
     *
     * @throws {ValidationFailError} - If the relationship doesn't exists.
     *
     * @returns {Promise<void>} - Promise that resolves when the operation is completed.
     */
    async execute(dto) {
        const agendasGroups = await this.#finder.execute(dto.agenda_id, dto.group_id);

        if (!agendasGroups) {
            throw new ValidationFailError(
                `Agenda with id ${dto.agenda_id} and group with id ${dto.group_id} not found`,
                'data'
            );
        }

        await this.#repository.delete(agendasGroups);
    }
}
