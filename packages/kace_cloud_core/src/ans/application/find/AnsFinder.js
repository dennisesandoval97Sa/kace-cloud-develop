import { AnsResponse, DomainAnsFinder } from '../../index.js';

export class AnsFinder {
    /** @type {DomainAnsFinder} is initialized in the constructor */
    #finder;

    constructor(repository) {
        this.#finder = new DomainAnsFinder(repository);
    }

    /**
     * Executes the finding of an Ans object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the Ans object to find.
     * @returns {Promise<AnsResponse>} A promise that resolves to an AnsResponse object containing the found Ans data.
     */
    async execute(id) {
        const ans = await this.#finder.execute(id);

        if (!ans || ans.deleted_by.value) {
            return null;
        }

        return new AnsResponse(ans);
    }
}
