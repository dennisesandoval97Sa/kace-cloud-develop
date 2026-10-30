export class AuxiliaryListCollectionResponse {
    #value;
    #count;

    constructor(value, count) {
        this.#value = value;
        this.#count = count;
    }

    toJson() {
        return {
            data: this.#value,
            metadata: { count: this.#count },
        };
    }
}
