import { ValueObjectUuid } from '../../shared';

export class GroupListFinder {
    /** @type {KnexGroupListsRepository} is initialized in the constructor*/
    #repository;

    /**
     * Creates an instance of the `GroupListFinder` class.
     *
     * @param {KnexGroupListsRepository} repository - An instance of the repository that manages groupList records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a groupList by their ID.
     *
     * @param {string} id - The UUID of the groupList to find.
     * @return {Promise<GroupList | null>} A promise that resolves to the `GroupList` instance if found, or `null` if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
