import { AuxClientResponse } from './AuxClientResponse.js';

export class AuxClientsCollectionResponse {
    /** @type {AuxClients[]} is initialized in the constructor */
    #auxClientsCollection;
    /** @type {number} is initialized in the constructor */
    #count;

    constructor(auxClientsCollection, count) {
        this.#auxClientsCollection = auxClientsCollection;
        this.#count = count;
    }

    /**
     * Converts the aux client object to a JSON representation.
     *
     * @returns {Object} A plain object containing the aux client data.
     */
    toJson() {
        return {
            data: {
                items: this.#auxClientsCollection.map((aux_client) => new AuxClientResponse(aux_client).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
