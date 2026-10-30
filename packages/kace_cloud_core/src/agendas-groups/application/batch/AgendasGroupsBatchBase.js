import { AgendasGroupsFinder as DomainAgendasGroupsFinder } from '../../domain/AgendasGroupsFinder';
import { CustomError, Helper, ValidationFailError } from '../../../shared';

/**
 * Base class for batch operations on the AgendasGroups entity.
 */
export class AgendasGroupsBatchBase {
    /**
     * @type {KnexAgendasGroupsRepository} is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainAgendasGroupsFinder} is initialized in the constructor
     */
    #finder;

    /**
     * @param {KnexAgendasGroupsRepository} repository - Repository for the AgendasGroups entity.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainAgendasGroupsFinder(repository);
    }

    /**
     * Executes the batch operation. It will start a transaction and process each relationship in the dto.
     *
     * @param {Array} dto - Array of relationships to process.
     * @throws {ValidationFailError} - If the dto is invalid or if an error occurs during the process.
     * @returns {Promise<void>} - Promise that resolves when the operation is completed.
     */
    async execute(dto) {
        if (!this.#isValidDto(dto)) {
            throw new ValidationFailError('Data must be an array w ith at least one element', 'data');
        }

        const transaction = await this.#repository.startTransaction();

        try {
            await Promise.all(
                dto.map(async (relationship) => {
                    await this.processRelationship(relationship, transaction);
                })
            );

            await transaction.commit();
        } catch (error) {
            Helper.logError(`Error in ${this.constructor.name}.execute: ${error.message}`, {
                stack: error.stack,
                data: dto,
            });

            try {
                await transaction.rollback();
            } catch (rollbackError) {
                Helper.logError(`Rollback failed: ${rollbackError.message}`, { stack: rollbackError.stack });
            }

            if (error instanceof ValidationFailError || error instanceof CustomError) {
                throw error;
            }

            throw new CustomError('An unexpected error occurred', error?.statusCode ?? 500);
        }
    }

    /**
     * Verify if the relationship exists.
     *
     * @param {string} agendaId - The agenda id.
     * @param {string} groupId - The group id.
     * @param {Knex.Transaction} trx - The transaction.
     * @returns {Promise<boolean>} - Promise that resolves to true if the relationship exists, false otherwise.
     */
    async relationExists(agendaId, groupId, trx) {
        const agendasGroups = await this.#finder.execute(agendaId, groupId, trx);
        return agendasGroups !== null;
    }

    /**
     * Process the relationship. This method must be implemented in the subclass.
     *
     * @param {*} _relationship - The relationship to process.
     * @param {*} _trx - The transaction.
     */
    async processRelationship(_relationship, _trx) {
        Helper.logDebug(_relationship);
        Helper.logDebug(_trx);
        throw new Error('Method #processRelationship must be implemented in subclass');
    }

    /**
     * Save the relationship.
     *
     * @param {AgendasGroups} agendasGroups - The relationship to save.
     * @param {Knex.Transaction} trx - The transaction.
     *
     * @returns {Promise<cvoid>} - Empty Promise that resolves when the relationship is saved.
     */
    async save(agendasGroups, trx) {
        return this.#repository.save(agendasGroups, trx);
    }

    /**
     * Delete the relationship.
     *
     * @param {AgendasGroups} agendasGroups - The relationship to delete.
     * @param {Knex.Transaction} trx - The transaction.
     *
     * @returns {Promise<void>} - Promise that resolves when the relationship is deleted.
     */
    async delete(agendasGroups, trx) {
        return this.#repository.delete(agendasGroups, trx);
    }

    /**
     * Verify if the dto is valid for the batch operation.
     *
     * @param {Array} dto - The dto to validate.
     *
     * @returns {boolean} - True if the dto is valid, false otherwise.
     */
    #isValidDto(dto) {
        return Array.isArray(dto) && dto.length > 0;
    }
}
