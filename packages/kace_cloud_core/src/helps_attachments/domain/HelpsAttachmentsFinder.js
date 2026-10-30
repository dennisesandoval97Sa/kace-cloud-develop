import { ValueObjectUuid } from '../../shared';

export class HelpsAttachmentsFinder {
    /** @type {KnexHelpsAttachmentsRepository} */
    #repository; // is initialized in the constructor

    /**
     *
     * @param {KnexHelpsAttachmentsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} id id to find group
     * @returns
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
