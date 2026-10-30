export class ActionJobResponse {
    /** @type {ActionJob} is initialized in the constructor */
    #actionJob;

    /**
     * Creates an instance of ActionJobResponse.
     *
     * @param {ActionJob} actionJob - The instance of ActionJob.
     */
    constructor(actionJob) {
        this.#actionJob = actionJob;
    }

    /**
     * Converts the ActionJob instance to a JSON representation.
     *
     * @returns {Object} A plain object containing the ActionJob data.
     */
    toJson() {
        if (!this.#actionJob) return {};

        return {
            data: {
                id: this.#actionJob.id.value,
                type: this.#actionJob.type.value,
                is_pending: this.#actionJob.is_pending.value,
                is_in_progress: this.#actionJob.is_in_progress.value,
                is_completed: this.#actionJob.is_completed.value,
                action_id: this.#actionJob.action_id.value,
                search_filter: this.#actionJob.search_filter.value,
                s3_file_key: this.#actionJob.s3_file_key.value,
                start_at: this.#actionJob.start_at.value,
                end_at: this.#actionJob.end_at.value,
                total_records: this.#actionJob.total_records.value,
                processed_records: this.#actionJob.processed_records.value,
                failed_records: this.#actionJob.failed_records.value,
                details: this.#actionJob.details.value,
                notifications_sent: this.#actionJob.notifications_sent.value,
                created_at: this.#actionJob.created_at.value,
                created_by: this.#actionJob.created_by.value,
                updated_by: this.#actionJob.updated_by.value,
                updated_at: this.#actionJob.updated_at.value,
            },
        };
    }
}
