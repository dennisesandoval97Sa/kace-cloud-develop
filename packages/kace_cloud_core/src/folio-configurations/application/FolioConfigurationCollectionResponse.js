import { FolioConfigurationResponse } from './FolioConfigurationResponse.js';

export class FolioConfigurationCollectionResponse {
    /**
     * @type {FolioConfiguration[]}
     */
    #configurations;

    /**
     * @type {number}
     */
    #count;

    /**
     * @param {FolioConfiguration[]} configurations
     * @param {number} count
     */
    constructor(configurations, count) {
        this.#configurations = configurations;
        this.#count = count;
    }

    toJson() {
        return {
            data: {
                items: this.#configurations.map((c) => new FolioConfigurationResponse(c).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
