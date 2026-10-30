import { ReportExecutionResponse } from './ReportExecutionResponse.js';

export class ReportExecutionCollectionResponse {
    /** @type {ReportExecution[]} */
    #collection;
    /** @type {number} */
    #count;

    /**
     * @param {ReportExecution[]} collection
     * @param {number} count
     */
    constructor(collection, count) {
        this.#collection = collection;
        this.#count = count;
    }

    /**
     * Convert the collection to JSON format.
     *
     * @returns {{data: {items: Object[]}, metadata: {count: number}}}
     */
    toJson() {
        return {
            data: {
                items: this.#collection?.map((item) => new ReportExecutionResponse(item).toJson()) ?? [],
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}

export default ReportExecutionCollectionResponse;
