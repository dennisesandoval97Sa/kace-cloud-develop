import { FieldListDomain } from '../..';

export class FieldListApplication {
    /** @type {FieldListDomain} is initialized in the constructor */
    #finder;
    constructor(repository) {
        this.#finder = new FieldListDomain(repository);
    }

    async execute(tableName) {
        const finder = await this.#finder.execute(tableName);
        return finder;
    }
}
