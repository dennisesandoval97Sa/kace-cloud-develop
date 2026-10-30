import { isAllowedExtension } from '@kace/file-extensions';
import { DomainCaseFinder } from '../../../cases/index.js';
import { CustomError } from '../../../shared/errors/CustomError.js';
import { CanUpdateCase } from '../../../shared/index.js';
import { CaseAttachment, DomainCaseAttachmentFinder } from '../../index.js';

export class CaseAttachmentCreator {
    /**
     * @type {KnexCaseAttachmentRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainCaseAttachmentFinder}
     * is initialized in the constructor
     */
    #finder;

    /** @type {DomainCaseFinder} is initialized in the constructor */
    #caseFinder;

    /** @type {import('../../../users').User} is initialized in the constructor */
    #user;

    /**
     * Creates an instance of `CaseAttachmentCreator`.
     *
     * @param {KnexCaseAttachmentRepository} repository - The repository used to save CaseAttachment records.
     * @param {KnexCaseRepository} caseRepository - The repository used to save Case records.
     */
    constructor(repository, caseRepository, user) {
        this.#repository = repository;
        this.#finder = new DomainCaseAttachmentFinder(repository);
        this.#caseFinder = new DomainCaseFinder(caseRepository);
        this.#user = user;
    }

    /**
     * Executes the process of creating a new CaseAttachment entity.
     *
     * This method takes a data transfer object (DTO) containing the necessary properties to create
     * a new `CaseAttachment` object and then saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the `CaseAttachment` object.
     * @returns {Promise<void>} A promise that resolves when the `CaseAttachment` object is successfully created.
     */
    async execute(dto) {
        const { allowed_file_extensions, ...cleanDto } = dto;
        const caseAttachment = CaseAttachment.create(cleanDto);

        const isValidExtension = isAllowedExtension(caseAttachment.path.value, allowed_file_extensions);
        if (!isValidExtension) {
            throw new CustomError(`This file extension is not allowed`, 400);
        }

        const result = await this.#finder.execute(caseAttachment.id.value);
        if (result) {
            throw new CustomError(`CaseAttachment with id ${caseAttachment.id.value} already exists`, 400);
        }

        const kase = await this.#caseFinder.execute(caseAttachment.case_id.value);
        if (kase && !CanUpdateCase.check(this.#user, kase)) {
            throw new CustomError('You do not have permission to update this case', 403);
        }

        await this.#repository.save(caseAttachment);
        await this.#repository.saveHistory(caseAttachment);
    }
}
