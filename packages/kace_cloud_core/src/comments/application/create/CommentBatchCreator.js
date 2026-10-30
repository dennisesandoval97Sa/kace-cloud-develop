import { CustomError } from '../../../shared';
import { Comment } from '../../index';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

export class CommentBatchCreator {
    /** @type {KnexCommentsRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Creates several Comment objects within a single transaction (all-or-nothing).
     *
     * Uniqueness is guaranteed by the `comentarios` primary key: ids are server-generated
     * (ValueObjectUuid.random() via secureObjectCreatePayload) and the schema rejects
     * client-supplied ids, so a pre-flight existence check would only add one replica
     * round-trip per item — and it could not see the rows this very transaction inserts.
     *
     * @param {Object[]} dtos - List of data transfer objects, each with the properties for a Comment.
     * @param {import('knex').Knex.Transaction|null} [trx] - Caller-owned transaction. When given, it is used
     *   as is and this class neither commits nor rolls it back.
     * @returns {Promise<string[]>} A promise that resolves to the list of created comment ids.
     */
    async execute(dtos, trx = null) {
        if (!Array.isArray(dtos) || dtos.length === 0) {
            throw new CustomError('dtos must be a non-empty array', 400);
        }

        const comments = dtos.map((dto) => Comment.create(dto));

        if (trx) {
            for (const comment of comments) {
                await this.#repository.save(comment, trx);
                await this.#repository.saveHistory(comment, null, trx);
            }
            return comments.map((comment) => comment.id.value);
        }

        const transaction = await this.#repository.startTransaction();
        try {
            for (const comment of comments) {
                await this.#repository.save(comment, transaction);
                await this.#repository.saveHistory(comment, null, transaction);
            }
            await transaction.commit();
        } catch (error) {
            // Never let a failing rollback mask the error that actually broke the batch.
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                Helper.logError('Comment batch rollback failed:', rollbackError);
            }
            Helper.logError('Comment batch creation failed:', error);
            throw error;
        }

        return comments.map((comment) => comment.id.value);
    }
}
