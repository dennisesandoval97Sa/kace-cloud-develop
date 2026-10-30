import { CustomError } from '../../shared/errors/CustomError.js';
import { CONFLICT_ERROR } from '@kace/error-codes';

export const ACTIVE_CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_STATUSES = Object.freeze(['pending', 'in_progress']);

export const isActiveChannelHubWorkspacePriorityReorderStatus = (status) =>
    ACTIVE_CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_STATUSES.includes(status);

export class ChannelHubWorkspacePriorityReorderConflict extends CustomError {
    constructor(operation) {
        super('A workspace priority reorder is already active for this account', 409, [], CONFLICT_ERROR);
        this.activeOperation =
            operation?.operationId && isActiveChannelHubWorkspacePriorityReorderStatus(operation?.status)
                ? Object.freeze({
                      operationId: operation.operationId,
                      status: operation.status,
                  })
                : null;
    }
}
