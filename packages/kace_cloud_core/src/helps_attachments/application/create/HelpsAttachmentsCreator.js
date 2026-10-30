import { isAllowedExtension } from '@kace/file-extensions';
import { HelpsAttachments, HelpsAttachmentsFinderDomain } from '../../index';
import { CustomError } from '../../../shared/index.js';

export class HelpsAttachmentsCreator {
    /** @type {KnexHelpsAttachmentsRepository} is initialized in the constructor */
    #repository;
    /** @type {HelpsAttachmentsFinderDomain} is initialized in the constructor */
    #finder;

    /**
     *
     * @param {KnexHelpsAttachmentsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new HelpsAttachmentsFinderDomain(repository);
    }

    /**
     *
     * @param {object} dto data to insert a new help
     * @returns {Promise<Any>}
     */
    async execute(dto) {
        if (dto === null || dto === undefined) throw new CustomError('dto cannot be null or undefined', 400);

        const { allowed_file_extensions, ...cleanDto } = dto;
        const creator = HelpsAttachments.create(cleanDto);

        const isValidExtension = isAllowedExtension(creator.path.value, allowed_file_extensions);
        if (!isValidExtension) {
            throw new CustomError(`This file extension is not allowed`, 400);
        }

        const result = await this.#finder.execute(creator.id.value);
        if (result) {
            throw new CustomError(`HelpAttachment with id ${creator.id.value} already exists`, 400);
        }

        await this.#repository.save(creator);
        await this.#repository.saveHistory(creator);

        return creator;
    }
}
