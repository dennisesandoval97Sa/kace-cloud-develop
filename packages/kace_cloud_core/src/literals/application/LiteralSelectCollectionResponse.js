export class LiteralSelectCollectionResponse {
    /** @type {Literal[]} */
    #literalCollection;
    /** @type {number} */
    #count;

    constructor(literalCollection, count) {
        this.#literalCollection = literalCollection;
        this.#count = count;
    }

    toJson() {
        return {
            data: {
                items: this.#literalCollection.map((lit) => ({
                    value: lit.id.value,
                    label: lit.nombre.value,
                })),
            },
            metadata: { count: this.#count },
        };
    }
}
