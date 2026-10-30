export class CommentsCountResponse {
    /** @type {Count[]} is initialized in the constructor*/
    #count;

    constructor(count) {
        this.#count = count;
    }

    /**
     * Converts the Comments object to a JSON representation.
     *
     * @returns {Object} A plain object containing the Comments data.
     */
    toJson() {
        return { count: this.#count };
    }
}
