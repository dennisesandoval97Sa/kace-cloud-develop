import { CsvExportViewResponse } from './CsvExportViewResponse.js';

export class CsvExportViewCollectionResponse {
    /**
     * @type {CsvExportView[]}
     * is initialized in the constructor
     */
    #csvExportViews;

    /**
     * @type {number}
     * is initialized in the constructor
     */
    #count;

    /**
     * Creates an instance of CsvExportViewCollectionResponse.
     *
     * @param {CsvExportView[]} csvExportViews - An array of CsvExportView instances.
     * @param {number} count - The total count of CsvExportView items.
     */
    constructor(csvExportViews, count) {
        this.#csvExportViews = csvExportViews;
        this.#count = count;
    }

    /**
     * Converts the collection to a JSON representation.
     *
     * @returns {Object} An object containing the CsvExportView data and metadata.
     */
    toJson() {
        return {
            data: {
                items: this.#csvExportViews.map(
                    (csvExportView) => new CsvExportViewResponse(csvExportView).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
