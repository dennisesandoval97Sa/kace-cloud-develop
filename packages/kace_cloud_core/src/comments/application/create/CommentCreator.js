import { CustomError } from '../../../shared';
import { Comment, DomainCommentFinder } from '../../index';

export class CommentCreator {
    /** @type {KnexCommentsRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainCommentFinder} is initialized in the constructor */
    #finder;

    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainCommentFinder(repository);
    }
    /**
     * Executes the creation of an Comment object and saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the Comment object.
     * @param {import('knex').Knex.Transaction} [trx]
     * @returns {Promise<void>} A promise that resolves when the Comment object is saved.
     */
    async execute(dto, trx = null) {
        if (dto === null || dto === undefined) throw new CustomError('dto cannot be null or undefined', 400);
        const comment = Comment.create(dto);
        const result = trx
            ? await this.#repository.find(comment.id, trx)
            : await this.#finder.execute(comment.id.value);
        if (result) {
            throw new CustomError(`Comment with id ${comment.id.value} already exists`, 400);
        }
        await this.#repository.save(comment, trx);
        await this.#repository.saveHistory(comment, null, trx);
    }
}
