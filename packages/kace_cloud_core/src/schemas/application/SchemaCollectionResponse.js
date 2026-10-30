import { SchemaResponse } from './SchemaResponse.js';

export class SchemaCollectionResponse {
    #schemaCollection;
    #count;

    constructor(schemaCollection, count) {
        this.#schemaCollection = schemaCollection;
        this.#count = count;
    }

    /**
     * Convierte la colección de Schema a una representación JSON.
     * @returns {Object}
     */
    toJson() {
        return {
            data: {
                items: this.#schemaCollection.map((schema) => new SchemaResponse(schema).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
