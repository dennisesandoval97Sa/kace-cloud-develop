import { AuxiliaryResponse } from './AuxiliaryResponse.js';

export class AuxiliaryCollectionResponse {
    #auxiliaryCollection;
    #count;

    constructor(auxiliaryCollection, count) {
        this.#auxiliaryCollection = auxiliaryCollection;
        this.#count = count;
    }

    /**
     * Convierte la colección de Auxiliary a una representación JSON.
     * @returns {Object}
     */
    toJson() {
        return {
            data: {
                items: this.#auxiliaryCollection.map((auxiliary) => new AuxiliaryResponse(auxiliary).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
