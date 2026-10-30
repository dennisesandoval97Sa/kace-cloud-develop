import { SecretsResponse } from './SecretsResponse';

export class SecretsCollectionResponse {
    /** @type {SecretsVault} is initialized in the constructor */
    #secrets;

    /** @type {number} is initialized in the constructor */
    #count;

    /**
     *
     * @param {SecretsVault} secrets
     */
    constructor(secrets, count) {
        this.#secrets = secrets;
        this.#count = count;
    }

    toJson() {
        return {
            data: {
                items: this.#secrets.map((item) => new SecretsResponse(item).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
