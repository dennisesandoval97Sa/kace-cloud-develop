import { OneScriptResponse } from './OneScriptResponse';

export class OneScriptCollectionResponse {
    /** @type {OneScript[]} is initialized in the constructor */
    #oneScriptRecords;

    /** @type {number} is initialized in the constructor */
    #count;

    constructor(oneScriptRecords, count) {
        this.#oneScriptRecords = oneScriptRecords;
        this.#count = count;
    }

    toJson() {
        return {
            data: {
                items: this.#oneScriptRecords.map((oneScript) => new OneScriptResponse(oneScript).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
