export class FieldListDomain {
    /** @type {KnexFieldListRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    async execute(tableName) {
        const fieldList = await this.#repository.getFieldList(tableName);
        return fieldList;
    }
}
