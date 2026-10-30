import { DomainCommentFinder } from '../../index.js';

export class CommentUpdater {
    /** @type {DomainCommentFinder} is initialized in the constructor */
    #commentFinder;
    /** @type {KnexCommentsRepository} is initialized in the constructor */
    #repository;
    constructor(repository) {
        this.#repository = repository;
        this.#commentFinder = new DomainCommentFinder(repository);
    }
    /**
     * Updates an Comment object in the repository.
     *
     * @param {string} id - The unique identifier of the Comment object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the Comment object.
     * @returns {Promise<void>} A promise that resolves when the Comment object is updated.
     */
    async execute(id, dto) {
        const comment = await this.#commentFinder.execute(id);

        const originalValues = comment.toJson();

        comment.update(dto);

        await this.#repository.update(comment);
        await this.#repository.saveHistory(comment, originalValues);

        comment.flushChanges();
    }
}
