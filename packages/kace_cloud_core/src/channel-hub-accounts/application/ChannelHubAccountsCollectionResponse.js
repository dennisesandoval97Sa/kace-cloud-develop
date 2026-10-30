import { ChannelHubAccountResponse } from './ChannelHubAccountResponse.js';

export class ChannelHubAccountsCollectionResponse {
    #collection;
    #count;

    constructor(collection, count) {
        this.#collection = collection;
        this.#count = count;
    }

    toJson() {
        return {
            data: {
                items: this.#collection.map((account) => new ChannelHubAccountResponse(account).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
