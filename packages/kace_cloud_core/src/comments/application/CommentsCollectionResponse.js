import { CommentResponse } from './CommentResponse.js';

export class CommentsCollectionResponse {
    /** @type {Comments[]} is initialized in the constructor*/
    #commentsCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    constructor(commentsCollection, count) {
        this.#commentsCollection = commentsCollection;
        this.#count = count;
    }

    /**
     * Converts the Comments object to a JSON representation.
     *
     * @returns {Object} A plain object containing the Comments data.
     */
    toJson() {
        return {
            data: {
                items: this.#commentsCollection.map((comments) => new CommentResponse(comments).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
