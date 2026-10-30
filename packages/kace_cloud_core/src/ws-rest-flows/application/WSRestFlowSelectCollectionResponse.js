export class WSRestFlowSelectCollectionResponse {
    /** @type {WSRestFlow[]} */
    #wsrestflowCollection;
    /** @type {number} */
    #count;

    constructor(wsrestflowCollection, count) {
        this.#wsrestflowCollection = wsrestflowCollection;
        this.#count = count;
    }

    toJson() {
        return {
            data: {
                items: this.#wsrestflowCollection.map((lit) => ({
                    value: lit.id.value,
                    label: lit.description.value,
                })),
            },
            metadata: { count: this.#count },
        };
    }
}
