import { CustomError } from '../../../shared/index.js';
import { CaseAttachmentResponse, DomainCaseAttachmentFinder } from '../../index.js';

export class CaseAttachmentFinder {
    /**
     * @type {DomainCaseAttachmentFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * Creates an instance of the `CaseAttachmentFinder` class.
     *
     * @param {KnexCaseAttachmentRepository} repository - An instance of the repository that manages CaseAttachment records.
     */
    constructor(repository) {
        this.#finder = new DomainCaseAttachmentFinder(repository);
    }

    /**
     * Executes the finding of a CaseAttachment object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the CaseAttachment object to find.
     * @returns {Promise<CaseAttachmentResponse>} A promise that resolves to a CaseAttachmentResponse object containing the found CaseAttachment data.
     */
    async execute(id) {
        const caseAttachment = await this.#finder.execute(id);
        if (!caseAttachment || caseAttachment.isDeleted()) {
            throw new CustomError('Case attachment not found', 404);
        }

        return new CaseAttachmentResponse(caseAttachment);
    }
}
