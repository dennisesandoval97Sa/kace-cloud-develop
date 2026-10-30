import { CustomError } from '../../../shared/errors/CustomError';
import { HelpsFinderDomain } from '../../index';
import { HelpsResponse } from '../HelpsResponse';

export class HelpsFinder {
    /** @type {HelpsFinderDomain} is initialized in the constructor */
    #finder;

    /**
     *
     * @param {KnexHelpsRepository} repository
     */
    constructor(repository) {
        this.#finder = new HelpsFinderDomain(repository);
    }

    /**
     *
     * @param {string} id id to search
     * @returns  {Promise<HelpsResponse>}
     */
    async execute(id) {
        const helps = await this.#finder.execute(id);

        if (helps?.deleted_by.value || !helps) {
            throw new CustomError('Help not found', 404);
        }

        return new HelpsResponse(helps);
    }
}
