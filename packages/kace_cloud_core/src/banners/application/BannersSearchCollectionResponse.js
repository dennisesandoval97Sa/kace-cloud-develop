import { BannersCollectionResponse } from './BannersCollectionResponse';

export class BannersSearchCollectionResponse {
    /**
     * @type {BannersCollectionResponse}
     * is initialized in the constructor
     */
    #banners;

    /**
     * @type {number}
     * is initialized in the constructor
     */
    #count;

    constructor(banners, count) {
        this.#banners = banners;
        this.#count = count;
    }

    /**
     *
     * @returns {BannersCollectionResponse[]} An array plain Object contains the global config data
     */
    toJson() {
        return {
            data: {
                items: new BannersCollectionResponse(this.#banners).toJson(),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
