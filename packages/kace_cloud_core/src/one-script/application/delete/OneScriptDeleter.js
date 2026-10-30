import { DomainOneScriptFinder } from '../..';
import { CustomError } from '../../../shared/errors/CustomError';

export class OneScriptDeleter {
    /** @type {KnexOneScriptRepository} is initialized in the constructor */
    #repository;

    /** @type {DomainOneScriptFinder} is initialized in the constructor */
    #finder;

    /**
     *
     * @param {KnexOneScriptRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainOneScriptFinder(repository);
    }

    /**
     *
     * @param {string} id id for delete
     * @param {object} dtoDelete dto data for delete, exm {deleted_at: new Date(), deleted_by: 'id_user'}
     * @returns {Promise<void>}
     */
    async execute(id, dtoDelete) {
        const oneScript = await this.#finder.execute(id);

        if (oneScript === null) {
            throw new CustomError(`The oneScript you are trying delete does not exist`, 404);
        }

        oneScript.delete(dtoDelete);
        await this.#repository.delete(oneScript);
        oneScript.flushChanges();
    }
}
