import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WorkspacePrioritiesConflictError } from "../errors/workspacePrioritiesConflictError";
import {
    WORKSPACE_PRIORITY_POLLING_REASONS,
    WorkspacePriorityPollingError,
} from "../errors/workspacePriorityPollingError";
import {
    ACTIVE_OPERATION_STATUSES,
    unwrapWorkspacePriorities,
    workspacePrioritiesClient,
} from "../services/workspacePrioritiesClient";

const OPERATION_POLL_INTERVAL_MS = 1000;
const OPERATION_POLL_MAX_INTERVAL_MS = 5000;
const OPERATION_POLL_TIMEOUT_MS = 30 * 60 * 1000;
/*
 * A reorder may span several FIFO worker attempts when Channel Hub is slow.
 * Keep polling long enough for the three-attempt backend retry budget to settle.
 */
const OPERATION_MAX_ATTEMPTS = Math.ceil(OPERATION_POLL_TIMEOUT_MS / OPERATION_POLL_MAX_INTERVAL_MS) + 3;
const activeOperationStatuses = new Set(ACTIVE_OPERATION_STATUSES);

const waitForNextPoll = (signal, intervalMs = OPERATION_POLL_INTERVAL_MS) =>
    new Promise((resolve, reject) => {
        const cleanup = () => signal?.removeEventListener("abort", handleAbort);
        const handleResolve = () => {
            cleanup();
            resolve();
        };
        const handleAbort = () => {
            clearTimeout(timeoutId);
            cleanup();
            reject(new DOMException("The operation was cancelled.", "AbortError"));
        };
        const timeoutId = setTimeout(handleResolve, intervalMs);
        signal?.addEventListener("abort", handleAbort, { once: true });
    });

const operationPollInterval = (attempt) =>
    Math.min(OPERATION_POLL_INTERVAL_MS * 2 ** attempt, OPERATION_POLL_MAX_INTERVAL_MS);

const isTransientOperationStatusError = (error) => {
    if (error?.name === "AbortError") return false;
    const status = error?.response?.status;
    return status == null || status === 408 || status === 429 || status >= 500;
};

const pollWorkspacePriorityOperation = async ({
    client,
    accountId,
    operationId,
    signal,
    wait = waitForNextPoll,
    maxAttempts = OPERATION_MAX_ATTEMPTS,
}) => {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (signal?.aborted) throw new DOMException("The operation was cancelled.", "AbortError");

        let operation;
        try {
            operation = await client.readOperation(accountId, operationId, signal);
        } catch (error) {
            if (!isTransientOperationStatusError(error)) throw error;
            if (attempt >= maxAttempts - 1) {
                throw new WorkspacePriorityPollingError(WORKSPACE_PRIORITY_POLLING_REASONS.STATUS_UNAVAILABLE, {
                    cause: error,
                });
            }
            await wait(signal, operationPollInterval(attempt));
            continue;
        }
        if (operation?.status === "completed") return operation.result;
        if (operation?.status === "failed") {
            throw new WorkspacePriorityPollingError(WORKSPACE_PRIORITY_POLLING_REASONS.OPERATION_FAILED, {
                code: operation.errorCode,
            });
        }
        if (!activeOperationStatuses.has(operation?.status)) {
            throw new WorkspacePriorityPollingError(WORKSPACE_PRIORITY_POLLING_REASONS.INVALID_STATUS);
        }

        if (attempt < maxAttempts - 1) {
            await wait(signal, operationPollInterval(attempt));
        }
    }

    throw new WorkspacePriorityPollingError(WORKSPACE_PRIORITY_POLLING_REASONS.TIMEOUT);
};

export const createWorkspacePriorityQueryOptions = ({ queryKey, client, accountId, enabled }) => ({
    queryKey,
    queryFn: () => client.read(accountId),
    enabled: Boolean(accountId && enabled),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
});

const useWorkspacePriorities = ({ accountId, enabled = false, client = workspacePrioritiesClient }) => {
    const queryClient = useQueryClient();
    const operationControllerRef = useRef(null);
    const queryKey = ["channel-hub-workspace-priorities", accountId];
    useEffect(
        () => () => {
            operationControllerRef.current?.abort();
        },
        [],
    );

    const query = useQuery(
        createWorkspacePriorityQueryOptions({
            queryKey,
            client,
            accountId,
            enabled,
        }),
    );

    const followOperation = async (operationId) => {
        operationControllerRef.current?.abort();
        const controller = new AbortController();
        operationControllerRef.current = controller;
        try {
            return await pollWorkspacePriorityOperation({
                client,
                accountId,
                operationId,
                signal: controller.signal,
            });
        } finally {
            if (operationControllerRef.current === controller) operationControllerRef.current = null;
        }
    };

    const updateMutation = useMutation({
        mutationFn: async (payload) => {
            let response;
            try {
                response = await client.update(accountId, payload);
            } catch (error) {
                const activeOperation = client.activeOperationFromConflict(error);
                if (!activeOperation) throw error;

                let recovery;
                try {
                    recovery = { data: await followOperation(activeOperation.operationId) };
                } catch (recoveryError) {
                    recovery = { error: recoveryError };
                }
                throw new WorkspacePrioritiesConflictError(error, recovery);
            }

            if (response.status !== 202) return response.data;

            if (!response.data?.operationId || !activeOperationStatuses.has(response.data.status)) {
                throw new WorkspacePriorityPollingError(WORKSPACE_PRIORITY_POLLING_REASONS.INVALID_RECEIPT);
            }

            return followOperation(response.data.operationId);
        },
        onSuccess: (data) => {
            queryClient.setQueryData(queryKey, data);
        },
        onError: (error) => {
            const recoveredData = error instanceof WorkspacePrioritiesConflictError ? error.recovery?.data : null;
            if (recoveredData) queryClient.setQueryData(queryKey, recoveredData);
        },
    });

    return {
        data: query.data,
        error: query.error,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        refetch: query.refetch,
        updateWorkspacePriorities: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,
    };
};

export { pollWorkspacePriorityOperation, unwrapWorkspacePriorities };
export default useWorkspacePriorities;
