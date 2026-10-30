import { BoardResourcesResponse } from './BoardResourcesResponse';

/**
 * Representa la respuesta de una colección de recursos de board.
 */
export class BoardResourcesCollectionResponse {
    #boardResources;
    /**
     * @type {number}
     * is initialized in the constructor
     */
    #count;
    #currentPag;
    #totalPag;

    /**
     * @type {Array<{status: string, count: number, color: string|null}>}
     * is initialized in the constructor
     */
    #countByStatus;

    /**
     * @type {Array<{id: number, count: number}>|null}
     * Null when quick_ans_filter is disabled or the configured column cannot be resolved.
     */
    #countByAns;

    /**
     * @param {BoardResources} boardResources - Entidad de dominio BoardResources
     * @param count
     * @param currentPage
     * @param totalPages
     * @param {Array<{status: string, count: number, color: string|null}>} countByStatus - Count per status.
     * @param {Array<{id: number, count: number}>|null} countByAns - Count per ANS position (id 1/2/3).
     */
    constructor(boardResources, count, currentPage, totalPages, countByStatus = [], countByAns = null) {
        this.#boardResources = boardResources;
        this.#count = count;
        this.#currentPag = currentPage;
        this.#totalPag = totalPages;
        this.#countByStatus = countByStatus;
        this.#countByAns = countByAns;
    }

    /**
     * Convierte la colección de BoardResources a una representación JSON.
     * @returns {Object}
     */
    toJson() {
        const metadata = {
            current_page: this.#currentPag,
            total_pages: this.#totalPag,
            count: this.#count,
            countByStatus: this.#countByStatus,
        };
        if (this.#countByAns !== null) {
            metadata.countByAns = this.#countByAns;
        }
        return {
            data: {
                items: this.#boardResources.rows.map((row) => new BoardResourcesResponse(row).toJson().data),
            },
            metadata,
        };
    }
}
