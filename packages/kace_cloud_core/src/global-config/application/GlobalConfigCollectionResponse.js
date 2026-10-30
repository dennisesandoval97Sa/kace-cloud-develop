import { GlobalConfigResponse } from './GlobalConfigResponse';

export class GlobalConfigCollectionResponse {
    /**
     * @type {GlobalConfigCollectionResponseGlobalConfig[]} is initialized in the constructor
     * is initialized in the constructor
     */
    #globalConfig;

    /**
     * @type {number}
     */
    #count;
    constructor(globalConfig, count) {
        this.#globalConfig = globalConfig;
        this.#count = count;
    }

    /**
     *
     * @returns {GlobalConfigResponse[]} An array plain Object contains the global config data
     */
    toJson() {
        return {
            data: {
                items: this.#globalConfig.map((globalConfig) => new GlobalConfigResponse(globalConfig).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
