import { DomainCaseFinder } from '../../../cases/index.js';
import { CanUpdateCase, CustomError } from '../../../shared/index.js';
import { DomainCaseAttachmentFinder } from '../../index.js';

export class CaseAttachmentUpdater {
    /**
     * @type {DomainCaseAttachmentFinder}
     * is initialized in the constructor
     */
    #caseAttachmentFinder;

    /**
     * @type {KnexCaseAttachmentRepository}
     * is initialized in the constructor
     */
    #repository;

    /** @type {DomainCaseFinder} is initialized in the constructor */
    #caseFinder;

    /** @type {import('../../../users').User} is initialized in the constructor */
    #user;

    /**
     * Creates an instance of the `CaseAttachmentUpdater` class.
     *
     * @param {KnexCaseAttachmentRepository} repository - An instance of the repository that manages CaseAttachment records.
     */
    constructor(repository, caseRepository, user) {
        this.#repository = repository;
        this.#caseAttachmentFinder = new DomainCaseAttachmentFinder(repository);
        this.#caseFinder = new DomainCaseFinder(caseRepository);
        this.#user = user;
    }

    /**
     * Updates a `CaseAttachment` object in the repository.
     *
     * @param {string} id - The unique identifier of the `CaseAttachment` object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the `CaseAttachment` object.
     * @returns {Promise<void>} A promise that resolves when the `CaseAttachment` object is updated.
     */
    async execute(id, dto) {
        const caseAttachment = await this.#caseAttachmentFinder.execute(id);

        if (!caseAttachment) {
            throw new Error(`CaseAttachment with ID ${id} does not exist.`);
        }

        const kase = await this.#caseFinder.execute(caseAttachment.case_id.value);
        if (kase && !CanUpdateCase.check(this.#user, kase)) {
            throw new CustomError('You do not have permission to update this case', 403);
        }

        const originalValues = caseAttachment.toJson();
        caseAttachment.update(dto);

        await this.#repository.update(caseAttachment);
        await this.#repository.saveHistory(caseAttachment, originalValues);

        caseAttachment.flushChanges();
    }
}
