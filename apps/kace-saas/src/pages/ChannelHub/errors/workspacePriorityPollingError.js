import { PUBLIC_ERROR_CODES } from "@kace/error-codes";

export const WORKSPACE_PRIORITY_POLLING_REASONS = Object.freeze({
    INVALID_RECEIPT: "invalid_receipt",
    INVALID_STATUS: "invalid_status",
    OPERATION_FAILED: "operation_failed",
    STATUS_UNAVAILABLE: "status_unavailable",
    TIMEOUT: "timeout",
});

export class WorkspacePriorityPollingError extends Error {
    constructor(reason, { code = PUBLIC_ERROR_CODES.CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_FAILED, cause } = {}) {
        super("Workspace priority update failed.", { cause });
        this.name = "WorkspacePriorityPollingError";
        this.code = code;
        this.reason = reason;
    }
}
