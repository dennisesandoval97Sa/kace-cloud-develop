import { BannerResponse } from './BannerResponse.js';

export class BannersCollectionResponse {
    /** @type {Banner[]} is initialized in the constructor */
    #bannersCollection;

    constructor(bannersCollection) {
        this.#bannersCollection = bannersCollection;
    }

    /**
     * Converts the Banners object to a JSON representation.
     *
     * @returns {Object[]} A plain array containing the Banners data.
     */
    toJson() {
        return this.#bannersCollection.map((banner) => new BannerResponse(banner).toJson().data);
    }
}
