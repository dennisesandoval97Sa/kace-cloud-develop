import { CustomError } from '../../../shared/errors/CustomError';
import { HelpsAttachmentsFinderDomain, HelpsAttachmentsResponse } from '../../index';

export class HelpsAttachmentsFinder {
    /** @type {HelpsAttachmentsFinderDomain} is initialized in the constructor */
    #finder;
    /**
     *
     * @param {KnexHelpsAttachmentsRepository} repository
     */
    constructor(repository) {
        this.#finder = new HelpsAttachmentsFinderDomain(repository);
    }

    /**
     *
     * @param {string} id id to search
     * @returns  {Promise<HelpsResponse>}
     */
    async execute(id) {
        const helpsAttachments = await this.#finder.execute(id);
        if (helpsAttachments?.deleted_by.value || !helpsAttachments) {
            throw new CustomError('Help not found', 404);
        }
        return new HelpsAttachmentsResponse(helpsAttachments);
    }
}
