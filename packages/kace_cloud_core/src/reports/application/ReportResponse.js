export class ReportResponse {
    /**
     * @type {Object} report
     * is initialized in the constructor
     */
    #report;

    /**
     * @param {Object} report
     */
    constructor(report) {
        this.#report = report;
    }

    /**
     * @returns {{data: {id: string, name: string|null, description: string|null, storage_path: string|null, link: string|null, created_at: string|null, created_by: string|null, updated_at: string|null, updated_by: string|null, deleted_at: string|null, deleted_by: string|null}}}
     */
    toJson() {
        return {
            data: {
                id: this.#report.id?.value ?? null,
                name: this.#report.name?.value ?? this.#report.report?.value ?? null,
                description: this.#report.description?.value ?? null,
                storage_path: this.#report.storage_path?.value ?? null,
            },
        };
    }
}

export default ReportResponse;
