import { DomainCaseFinder } from '../..';
import { CustomError } from '../../../shared/errors/CustomError';

export class CaseDeleter {
    /** @type {KnexCaseRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainCaseFinder} is initialized in the constructor */
    #finder;
    /**
     *
     * @param {KnexCaseRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainCaseFinder(repository);
    }

    /**
     *
     * @param {string} id identificator for search case
     * @returns {Promise<void>}
     */
    async execute(id, body) {
        const kase = await this.#finder.execute(id);
        if (kase === null || kase.fecha_resolucion.value !== null) {
            throw new CustomError('The Case you are trying to remove does not exist', 404);
        }

        const payload = {
            deleted_at: new Date(),
            ...body,
        };

        const originalValues = kase.toJson();
        kase.update(payload);

        await this.#repository.update(kase);
        await this.#repository.saveHistory(kase, originalValues);

        kase.flushChanges();
    }
}
