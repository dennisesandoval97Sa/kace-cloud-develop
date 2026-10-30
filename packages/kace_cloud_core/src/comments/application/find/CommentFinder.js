import { CommentResponse, DomainCommentFinder } from '../../index.js';

export class CommentFinder {
    /** @type {DomainCommentFinder} is initialized in the constructor */
    #finder;
    constructor(repository) {
        this.#finder = new DomainCommentFinder(repository);
    }
    /**
     * Executes the finding of an Comment object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the Comment object to find.
     * @returns {Promise<CommentResponse>} A promise that resolves to an CommentResponse object containing the found Comment data.
     */
    async execute(id) {
        const comment = await this.#finder.execute(id);
        return new CommentResponse(comment);
    }
}
