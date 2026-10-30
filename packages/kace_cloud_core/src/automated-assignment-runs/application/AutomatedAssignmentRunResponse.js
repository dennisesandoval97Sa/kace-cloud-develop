export class AutomatedAssignmentRunResponse {
    /** @type {import('../domain/AutomatedAssignmentRun.js').AutomatedAssignmentRun} */
    #run;

    constructor(run) {
        this.#run = run;
    }

    toJson() {
        if (!this.#run) return {};
        return {
            data: {
                id: this.#run.id.value,
                started_at: this.#run.started_at.value,
                finished_at: this.#run.finished_at.value,
                duration_ms: this.#run.duration_ms.value,
                status: this.#run.status.value,
                actions_evaluated: this.#run.actions_evaluated.value,
                candidates_total: this.#run.candidates_total.value,
                assigned: this.#run.assigned.value,
                skipped: this.#run.skipped.value,
                errors: this.#run.errors.value,
                groups_without_capacity: this.#run.groups_without_capacity.value,
                actions_detail: this.#run.actions_detail.value,
                capacity_snapshot: this.#run.capacity_snapshot.value,
                error_detail: this.#run.error_detail.value,
            },
        };
    }
}
