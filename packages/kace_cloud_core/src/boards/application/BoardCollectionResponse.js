import { BoardResponse } from "@kace/core/src/boards/application/BoardResponse";

export class BoardCollectionResponse {
    #boardCollection;
    #count;

    constructor(boardCollection, count) {
        this.#boardCollection = boardCollection;
        this.#count = count;
    }

    /**
     * Convierte la colección de Board a una representación JSON.
     * @returns {Object}
     */
    toJson() {
        return {
            data: {
                items: this.#boardCollection.map((board) => new BoardResponse(board).toJson().data),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
