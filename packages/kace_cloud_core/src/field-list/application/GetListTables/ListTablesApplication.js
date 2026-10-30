import { ListTablesDomain } from '../..';

export class ListTablesApplication {
    /** @type {ListTablesDomain} is initialized in the constructor */
    #finder;
    constructor(repository) {
        this.#finder = new ListTablesDomain(repository);
    }

    async execute(encryptionKey) {
        const finder = await this.#finder.execute(encryptionKey);
        return finder;
    }
}
