import { normalizePublicErrorCode } from '@kace/error-codes';

export const workspacePriorityOperationResponse = (operation) => {
    const storedErrorCode = operation.error?.code ?? operation.errorCode;
    return {
        operationId: operation.operationId,
        status: operation.status,
        result: operation.result ?? null,
        errorCode: normalizePublicErrorCode(storedErrorCode) ?? null,
    };
};

export class WorkspacePriorityConflictError extends Error {
    constructor(error) {
        super(error.message);
        this.statusCode = error.statusCode;
        this.publicErrorCode = error.publicErrorCode;
        this.activeOperation = error.activeOperation;
    }
}

export class WorkspacePriorityApplication {
    #priorityManager;
    #reorderRequester;
    #operationRepository;
    #reorderConflictType;
    #ownedResources;

    constructor({
        priorityManager,
        reorderRequester,
        operationRepository,
        reorderConflictType,
        ownedResources = null,
    }) {
        this.#priorityManager = priorityManager;
        this.#reorderRequester = reorderRequester;
        this.#operationRepository = operationRepository;
        this.#reorderConflictType = reorderConflictType;
        this.#ownedResources = ownedResources ?? [operationRepository];
    }

    async list(accountId) {
        return this.#priorityManager.get(accountId);
    }

    async requestReorder(accountId, command, actor) {
        try {
            return await this.#reorderRequester.execute(accountId, {
                ...command,
                requestedBy: actor.userId,
                metadata: {
                    tenant_id: actor.tenantId,
                    user_id: actor.userId,
                },
            });
        } catch (error) {
            if (this.#reorderConflictType && error instanceof this.#reorderConflictType) {
                throw new WorkspacePriorityConflictError(error);
            }
            throw error;
        }
    }

    async findOperation(accountId, operationId) {
        const operation = await this.#operationRepository.findById(operationId);
        if (!operation || operation.accountId !== accountId) return null;
        return workspacePriorityOperationResponse(operation);
    }

    async destroy() {
        const results = await Promise.allSettled(
            this.#ownedResources.map((resource) => resource.destroy?.() ?? resource.destroyConnection?.())
        );
        const failure = results.find(({ status }) => status === 'rejected');
        if (failure) throw failure.reason;
    }
}
