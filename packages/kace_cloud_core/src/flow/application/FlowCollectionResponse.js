import { FlowResponse } from '../index';

export class FlowCollectionResponse {
    /**
     * @type {Flow[]}
     */
    #flows; // is initialized in the constructor

    /**
     * @type {number}
     * @description The total number of flows matching the search criteria
     * @example 100
     */
    #count; // is initialized in the constructor

    /**
     * @param {Flow[]} flows Array flow instances for return
     * @param {number} count The total number of flows matching the search criteria
     * @example new FlowCollectionResponse(flows, 100)
     */
    constructor(flows, count) {
        this.#flows = flows;
        this.#count = count;
    }

    toJson() {
        return {
            data: {
                items: this.#flows.map((flow) => new FlowResponse(flow).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
