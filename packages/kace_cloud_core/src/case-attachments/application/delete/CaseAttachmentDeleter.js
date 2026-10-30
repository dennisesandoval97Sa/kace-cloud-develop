import { DomainCaseFinder } from '../../../cases/index.js';
import { CanUpdateCase, CustomError } from '../../../shared/index.js';
import { DomainCaseAttachmentFinder } from '../../index.js';

export class CaseAttachmentDeleter {
    /**
     * @type {DomainCaseAttachmentFinder}
     * is initialized in the constructor
     */
    #finder;

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
     * Creates an instance of the `CaseAttachmentDeleter` class.
     *
     * @param {KnexCaseAttachmentRepository} repository - An instance of the repository that manages CaseAttachment records.
     * @param {KnexCaseRepository} caseRepository - An instance of the repository that manages case records.
     */
    constructor(repository, caseRepository, user) {
        this.#repository = repository;
        this.#finder = new DomainCaseAttachmentFinder(repository);
        this.#caseFinder = new DomainCaseFinder(caseRepository);
        this.#user = user;
    }

    /**
     * Deletes a `CaseAttachment` object from the repository.
     *
     * This method finds the CaseAttachment entity by its ID, applies deletion operations, updates the repository with the modified entity, and then flushes any changes.
     *
     * @param {string} id - The unique identifier of the CaseAttachment entity to delete.
     * @param {Object} dto - The data transfer object containing the properties for the `CaseAttachment` object (e.g., deleted_by, deleted_at).
     * @returns {Promise<void>} A promise that resolves when the `CaseAttachment` entity is deleted.
     * @throws {Error} Throws an error if the CaseAttachment entity does not exist.
     */
    async execute(id, dto) {
        const caseAttachment = await this.#finder.execute(id);

        if (!caseAttachment) {
            throw new Error(`CaseAttachment with ID ${id} does not exist.`);
        }

        const kase = await this.#caseFinder.execute(caseAttachment.case_id.value);
        if (kase && !CanUpdateCase.check(this.#user, kase)) {
            throw new CustomError('You do not have permission to update this case', 403);
        }

        const originalValues = caseAttachment.toJson();
        caseAttachment.delete(dto);

        await this.#repository.update(caseAttachment);
        await this.#repository.saveHistory(caseAttachment, originalValues);

        caseAttachment.flushChanges();
    }
}
