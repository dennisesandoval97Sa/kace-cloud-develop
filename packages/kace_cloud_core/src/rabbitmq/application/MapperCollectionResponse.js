import { MapperResponse } from './MapperResponse.js';

export class MapperCollectionResponse {
    #mapperCollection;
    #count;

    constructor(mapperCollection, count) {
        this.#mapperCollection = mapperCollection;
        this.#count = count;
    }

    toJson() {
        return {
            data: {
                items: this.#mapperCollection.map((m) => new MapperResponse(m).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
