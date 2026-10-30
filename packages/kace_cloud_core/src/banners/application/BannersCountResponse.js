export class BannersCountResponse {
    /** @type {number} is initialized in the constructor */
    #count;

    constructor(count) {
        this.#count = count;
    }

    /**
     * Converts the Banners count to a JSON representation.
     *
     * @returns {Object} A plain object containing the count data.
     */
    toJson() {
        return { count: this.#count };
    }
}
