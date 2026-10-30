export class StatesDistinctionFinder {
    /** @type {KnexClassificationsLevelDistinctionRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    async execute() {
        return this.#repository.find();
    }
}
