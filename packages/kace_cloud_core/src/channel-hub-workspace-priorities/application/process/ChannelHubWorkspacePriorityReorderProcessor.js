import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';
import { CustomError } from '../../../shared/errors/CustomError.js';

const statusOf = (error) => Number(error?.statusCode ?? error?.upstreamStatus ?? 0);
const isTerminal = (error) => {
    const status = statusOf(error);
    return status >= 400 && status < 500;
};

export class ChannelHubWorkspacePriorityReorderProcessor {
    #priorityManager;
    #operationRepository;
    #maxAttempts;
    #maxDurationMs;
    #leaseDurationMs;
    #now;
    #ownerIdFactory;
    #hasTimeForRemoteCall;

    constructor({
        priorityManager,
        operationRepository,
        maxAttempts = 3,
        maxDurationMs = 600_000,
        leaseDurationMs = 420_000,
        now = () => Date.now(),
        ownerIdFactory = () => ValueObjectUuid.random(),
        hasTimeForRemoteCall = () => true,
    }) {
        this.#priorityManager = priorityManager;
        this.#operationRepository = operationRepository;
        this.#maxAttempts = maxAttempts;
        this.#maxDurationMs = maxDurationMs;
        this.#leaseDurationMs = leaseDurationMs;
        this.#now = now;
        this.#ownerIdFactory = ownerIdFactory;
        this.#hasTimeForRemoteCall = hasTimeForRemoteCall;
    }

    async #handleFailure(operation, error, ownerId) {
        if (!isTerminal(error) && operation.attemptCount < this.#maxAttempts) throw error;
        const failed = await this.#operationRepository.markFailed(operation.operationId, error, { ownerId });
        if (failed) return failed;
        throw new CustomError('Workspace priority reorder lease ownership was lost', 502);
    }

    async execute(operationId) {
        const existing = await this.#operationRepository.findById(operationId);
        if (!existing) throw new CustomError('Workspace priority reorder operation not found', 404);
        if (existing.status === 'completed' || existing.status === 'failed') return existing;

        const ownerId = this.#ownerIdFactory();
        let operation = await this.#operationRepository.claim(operationId, {
            ownerId,
            leaseDurationMs: this.#leaseDurationMs,
        });
        if (!operation) {
            const current = await this.#operationRepository.findById(operationId);
            if (current?.status === 'completed' || current?.status === 'failed') return current;
            throw new CustomError('Workspace priority reorder is owned by another worker', 502);
        }

        let snapshot = null;
        if (!operation.validatedAt) {
            try {
                snapshot = await this.#priorityManager.validateReorderRequestWithSnapshot(operation.accountId, {
                    revision: operation.revision,
                    orderedWorkspaceIds: operation.orderedWorkspaceIds,
                });
                operation = await this.#operationRepository.markValidated(operationId, { ownerId });
                if (!operation) throw new CustomError('Workspace priority reorder lease ownership was lost', 502);
            } catch (error) {
                return this.#handleFailure(operation, error, ownerId);
            }
        }

        const startedAt = this.#now();
        try {
            while (this.#now() - startedAt < this.#maxDurationMs && this.#hasTimeForRemoteCall()) {
                const heartbeat = await this.#operationRepository.heartbeat(operationId, {
                    ownerId,
                    leaseDurationMs: this.#leaseDurationMs,
                });
                if (!heartbeat) throw new CustomError('Workspace priority reorder lease ownership was lost', 502);

                const reconciliation = await this.#priorityManager.reconcileNext(
                    operation.accountId,
                    operation.orderedWorkspaceIds,
                    { snapshot }
                );
                snapshot = reconciliation.snapshot;
                if (reconciliation.completed) {
                    const completed = await this.#operationRepository.markCompleted(
                        operationId,
                        reconciliation.result,
                        { ownerId }
                    );
                    if (completed) return completed;
                    throw new CustomError('Workspace priority reorder lease ownership was lost', 502);
                }
            }

            throw new CustomError('Workspace priority reorder exceeded its worker time budget', 502);
        } catch (error) {
            return this.#handleFailure(operation, error, ownerId);
        }
    }
}
