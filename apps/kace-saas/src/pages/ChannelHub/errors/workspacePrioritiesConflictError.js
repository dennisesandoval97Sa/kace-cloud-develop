export class WorkspacePrioritiesConflictError extends Error {
    constructor(cause, recovery) {
        super(cause?.message ?? "Workspace priorities are already being updated.");
        this.name = "WorkspacePrioritiesConflictError";
        this.cause = cause;
        this.response = cause?.response;
        this.errors = cause?.errors;
        this.recovery = Object.freeze(recovery);
    }
}
