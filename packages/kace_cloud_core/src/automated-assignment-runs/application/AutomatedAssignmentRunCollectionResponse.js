export class AutomatedAssignmentRunCollectionResponse {
    /** @type {import('../domain/AutomatedAssignmentRun.js').AutomatedAssignmentRun[]} */
    #runs;
    /** @type {number} */
    #count;

    constructor(runs, count) {
        this.#runs = runs;
        this.#count = count;
    }

    /**
     * Listado liviano: solo columnas planas (los jsonb de detalle se obtienen por find).
     */
    toJson() {
        return {
            data: {
                items: this.#runs.map((run) => ({
                    id: run.id.value,
                    started_at: run.started_at.value,
                    finished_at: run.finished_at.value,
                    duration_ms: run.duration_ms.value,
                    status: run.status.value,
                    actions_evaluated: run.actions_evaluated.value,
                    candidates_total: run.candidates_total.value,
                    candidates_backlog_total: run.candidates_backlog_total.value,
                    assigned: run.assigned.value,
                    skipped: run.skipped.value,
                    errors: run.errors.value,
                    groups_without_capacity: run.groups_without_capacity.value,
                    created_at: run.created_at.value,
                })),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
