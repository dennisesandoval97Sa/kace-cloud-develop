import { DomainCaseFinder } from '../../../cases/index.js';
import { CustomError } from '../../../shared/errors/CustomError.js';
import { EventLogger } from '../../../shared/EventLogger.js';
import { CanUpdateCase, Helper } from '../../../shared/index.js';
import { DomainCaseDescriptionFinder } from '../../index.js';

export class CaseDescriptionUpdater {
    /**
     * @type {DomainCaseDescriptionFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * @type {KnexCaseDescriptionRepository}
     * is initialized in the constructor
     */
    #repository;

    /** @type {DomainCaseFinder} is initialized in the constructor */
    #caseFinder;

    /** @type {import('../../../users').User} is initialized in the constructor */
    #user;

    /**
     * Creates an instance of the `CaseDescriptionUpdater` class.
     *
     * @param {KnexCaseDescriptionRepository} repository - An instance of the repository that manages case description records.
     * @param {KnexCaseRepository} caseRepository
     * @param {User} user
     */
    constructor(repository, caseRepository, user) {
        this.#repository = repository;
        this.#finder = new DomainCaseDescriptionFinder(repository);
        this.#caseFinder = new DomainCaseFinder(caseRepository);
        this.#user = user;
        this.eventLogger = new EventLogger(repository);
    }

    /**
     * Updates a `CaseDescription` object in the repository.
     *
     * @param {string} id - The unique identifier of the `CaseDescription` object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the `CaseDescription` object.
     * @returns {Promise<void>} A promise that resolves when the `CaseDescription` object is updated.
     */
    async execute(id, dto) {
        const caseDescription = await this.#finder.execute(id);

        if (!caseDescription) {
            throw new CustomError(`Case description with ID ${id} does not exist.`, 404);
        }

        const kase = await this.#caseFinder.executeByDescriptionId(id);
        if (kase && !CanUpdateCase.check(this.#user, kase)) {
            Helper.logDebug(`CaseDescriptionUpdater: ${this.#user.id} cannot update case ${kase.id}`)
            throw new CustomError('You do not have permission to update this case', 403);
        }

        const originalValues = caseDescription.toJson();
        caseDescription.update(dto);

        await this.#repository.update(caseDescription);
        await this.#repository.saveHistory(caseDescription, originalValues);

        await this.eventLogger.log(
            'case-descriptions.updated',
            id,
            caseDescription.updated_by.value,
            caseDescription.changedAttributes,
            null,
            null,
            originalValues
        );
        caseDescription.flushChanges();
    }
}
