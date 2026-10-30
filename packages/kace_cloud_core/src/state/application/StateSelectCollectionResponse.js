export class StateSelectCollectionResponse {
    /** @type {State[]} */
    #stateCollection;
    /** @type {number} */
    #count;

    constructor(stateCollection, count) {
        this.#stateCollection = stateCollection;
        this.#count = count;
    }

    toJson() {
        return {
            data: {
                items: this.#stateCollection.map((lit) => ({
                    value: lit.id.value,
                    label: lit.nombre.value,
                })),
            },
            metadata: { count: this.#count },
        };
    }
}
