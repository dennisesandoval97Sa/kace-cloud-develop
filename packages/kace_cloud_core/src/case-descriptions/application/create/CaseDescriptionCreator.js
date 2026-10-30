import { CustomError } from '../../../shared/errors/CustomError.js';
import { CaseDescription, DomainCaseDescriptionFinder } from '../../index.js';

export class CaseDescriptionCreator {
    /**
     * @type {KnexCaseDescriptionRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainCaseDescriptionFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * Creates an instance of `CaseDescriptionCreator`.
     *
     * @param {KnexCaseDescriptionRepository} repository - The repository used to save case descriptions.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainCaseDescriptionFinder(repository);
    }

    /**
     * Executes the process of creating a new case description.
     *
     * This method takes a data transfer object (DTO) containing the necessary properties to create
     * a new `CaseDescription` object, and then saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the `CaseDescription` object.
     * @param {import('knex').Knex.Transaction} [trx] - optional transaction; when provided the
     *   description INSERT + history run on the transactional connection so they are atomic with
     *   the caller's case/aux writes. The existence read stays on the repository's own connection.
     * @returns {Promise<void>} A promise that resolves when the `CaseDescription` object is successfully created.
     */
    async execute(dto, trx) {
        const caseDescription = CaseDescription.create(dto);

        const result = await this.#finder.execute(caseDescription.id.value);
        if (result) {
            throw new CustomError(`Case description with id ${caseDescription.id.value} already exists`, 400);
        }

        await this.#repository.save(caseDescription, trx);
        await this.#repository.saveHistory(caseDescription, null, trx);
    }
}
