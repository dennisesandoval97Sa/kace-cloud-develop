export class CsvExportViewResponse {
    /** @type {CsvExportView} is initialized in the constructor */
    #csvExportView;

    /**
     * Creates an instance of CsvExportViewResponse.
     *
     * @param {CsvExportView} csvExportView - The instance of CsvExportView.
     */
    constructor(csvExportView) {
        this.#csvExportView = csvExportView;
    }

    /**
     * Converts the CsvExportView instance to a JSON representation.
     *
     * @returns {Object} A plain object containing the CsvExportView data.
     */
    toJson() {
        if (!this.#csvExportView) return {};

        return {
            data: {
                id: this.#csvExportView.id.value,
                description: this.#csvExportView.description.value,
                is_active: this.#csvExportView.is_active.value,
                views: this.#csvExportView.views.value,
                frequency: this.#csvExportView.frequency.value,
                interval: this.#csvExportView.interval.value,
                time_filter: this.#csvExportView.time_filter.value,
                last_execution_at: this.#csvExportView.last_execution_at.value,
                next_execution_at: this.#csvExportView.next_execution_at.value,
                details: this.#csvExportView.details.value,
                storage_path: this.#csvExportView.storage_path.value,
                created_at: this.#csvExportView.created_at.value,
                created_by: this.#csvExportView.created_by.value,
                updated_by: this.#csvExportView.updated_by.value,
                updated_at: this.#csvExportView.updated_at.value,
            },
        };
    }
}
