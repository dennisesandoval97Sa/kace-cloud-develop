import { AuxDefinitionResponse } from './AuxDefinitionResponse.js';

export class AuxDefinitionCollectionResponse {
    #auxDefinitionCollection;
    #count;

    constructor(auxDefinitionCollection, count) {
        this.#auxDefinitionCollection = auxDefinitionCollection;
        this.#count = count;
    }

    /**
     * Convierte la colección de AuxDefinition a una representación JSON.
     * @returns {Object}
     */
    toJson() {
        return {
            data: {
                items: this.#auxDefinitionCollection.map(
                    (auxDefinition) => new AuxDefinitionResponse(auxDefinition).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
