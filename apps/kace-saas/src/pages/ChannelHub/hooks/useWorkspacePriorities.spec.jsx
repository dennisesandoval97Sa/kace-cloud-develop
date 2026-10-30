import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PropTypes from "prop-types";
import { PUBLIC_ERROR_CODES } from "@kace/error-codes";
import { WorkspacePrioritiesConflictError } from "../errors/workspacePrioritiesConflictError";
import {
    WORKSPACE_PRIORITY_POLLING_REASONS,
    WorkspacePriorityPollingError,
} from "../errors/workspacePriorityPollingError";
import { parseWorkspacePrioritiesConflict } from "../services/workspacePrioritiesClient";
import useWorkspacePriorities, {
    createWorkspacePriorityQueryOptions,
    pollWorkspacePriorityOperation,
} from "./useWorkspacePriorities";

const canonicalPayload = {
    revision: "revision-1",
    canReorder: true,
    conflicts: [],
    items: [{ workspaceId: "support", description: "Customer Support", tag: "support", priority: 1 }],
};

class WorkspacePrioritiesMemoryClient {
    constructor(initialPriorities = canonicalPayload) {
        this.priorities = initialPriorities;
        this.updateOutcomes = [];
        this.operationOutcomes = new Map();
        this.events = [];
    }

    queueUpdate(outcome) {
        this.updateOutcomes.push(outcome);
    }

    queueOperation(operationId, ...outcomes) {
        this.operationOutcomes.set(operationId, outcomes);
    }

    async read(accountId) {
        this.events.push({ kind: "read", accountId });
        return this.priorities;
    }

    async update(accountId, payload) {
        this.events.push({ kind: "update", accountId, payload });
        const outcome = this.updateOutcomes.shift();
        if (outcome?.error) throw outcome.error;
        if (outcome?.data && outcome.status !== 202) this.priorities = outcome.data;
        return outcome;
    }

    async readOperation(accountId, operationId, signal) {
        this.events.push({ kind: "operation", accountId, operationId, signal });
        const outcomes = this.operationOutcomes.get(operationId) ?? [];
        const outcome = outcomes.shift();
        if (outcome?.error) throw outcome.error;
        const operation = await outcome;
        if (operation?.status === "completed") this.priorities = operation.result;
        return operation;
    }

    activeOperationFromConflict(error) {
        return parseWorkspacePrioritiesConflict(error);
    }
}

class ImmediatePollClock {
    intervals = [];

    wait = async (_signal, intervalMs) => {
        this.intervals.push(intervalMs);
    };
}

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });
    const QueryWrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    QueryWrapper.propTypes = {
        children: PropTypes.node.isRequired,
    };
    return QueryWrapper;
};

describe("useWorkspacePriorities", () => {
    it("loads canonical priorities through the injected client", async () => {
        const client = new WorkspacePrioritiesMemoryClient();
        const { result } = renderHook(() => useWorkspacePriorities({ accountId: "account-1", enabled: true, client }), {
            wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.data).toEqual(canonicalPayload));
        expect(client.events).toEqual([{ kind: "read", accountId: "account-1" }]);
    });

    it("backs off operation polling, caps the delay, and returns the completed result", async () => {
        const client = new WorkspacePrioritiesMemoryClient();
        const clock = new ImmediatePollClock();
        client.queueOperation(
            "operation-1",
            { status: "pending" },
            { status: "in_progress" },
            { status: "in_progress" },
            { status: "in_progress" },
            { status: "in_progress" },
            { status: "completed", result: canonicalPayload },
        );

        await expect(
            pollWorkspacePriorityOperation({
                client,
                accountId: "account-1",
                operationId: "operation-1",
                wait: clock.wait,
            }),
        ).resolves.toEqual(canonicalPayload);

        expect(client.events.filter((event) => event.kind === "operation")).toHaveLength(6);
        expect(clock.intervals).toEqual([1000, 2000, 4000, 5000, 5000]);
    });

    it("retries a transient operation-status failure without reading live priorities", async () => {
        const client = new WorkspacePrioritiesMemoryClient();
        const clock = new ImmediatePollClock();
        const transientError = Object.assign(new Error("Temporary status endpoint failure"), {
            response: { status: 503 },
        });
        client.queueOperation(
            "operation-1",
            { error: transientError },
            { status: "completed", result: canonicalPayload },
        );

        await expect(
            pollWorkspacePriorityOperation({
                client,
                accountId: "account-1",
                operationId: "operation-1",
                wait: clock.wait,
            }),
        ).resolves.toEqual(canonicalPayload);

        expect(client.events.filter((event) => event.kind === "read")).toHaveLength(0);
        expect(clock.intervals).toEqual([1000]);
    });

    it("sends only the revision and ordered workspace IDs and caches the updated order", async () => {
        const updatedPayload = {
            ...canonicalPayload,
            revision: "revision-2",
            items: [
                { workspaceId: "sales", description: "Sales", tag: "sales", priority: 1 },
                canonicalPayload.items[0],
            ],
        };
        const client = new WorkspacePrioritiesMemoryClient();
        client.queueUpdate({ status: 200, data: updatedPayload });
        const { result } = renderHook(() => useWorkspacePriorities({ accountId: "account-1", enabled: true, client }), {
            wrapper: createWrapper(),
        });
        await waitFor(() => expect(result.current.data).toEqual(canonicalPayload));

        await result.current.updateWorkspacePriorities({
            revision: "revision-1",
            orderedWorkspaceIds: ["sales", "support"],
        });

        expect(client.events.find((event) => event.kind === "update")).toEqual({
            kind: "update",
            accountId: "account-1",
            payload: { revision: "revision-1", orderedWorkspaceIds: ["sales", "support"] },
        });
        await waitFor(() => expect(result.current.data).toEqual(updatedPayload));
    });

    it("keeps the old order visible until a 202 operation reaches terminal success", async () => {
        const updatedPayload = { ...canonicalPayload, revision: "revision-2" };
        let completeOperation;
        const operationResult = new Promise((resolve) => {
            completeOperation = resolve;
        });
        const client = new WorkspacePrioritiesMemoryClient();
        client.queueUpdate({ status: 202, data: { operationId: "operation-1", status: "pending" } });
        client.queueOperation("operation-1", operationResult);
        const { result } = renderHook(() => useWorkspacePriorities({ accountId: "account-1", enabled: true, client }), {
            wrapper: createWrapper(),
        });
        await waitFor(() => expect(result.current.data).toEqual(canonicalPayload));

        let updatePromise;
        act(() => {
            updatePromise = result.current.updateWorkspacePriorities({
                revision: "revision-1",
                orderedWorkspaceIds: ["support"],
            });
        });

        await waitFor(() => expect(result.current.isUpdating).toBe(true));
        expect(result.current.data).toEqual(canonicalPayload);
        completeOperation({ status: "completed", result: updatedPayload });
        await act(async () => expect(updatePromise).resolves.toEqual(updatedPayload));
        await waitFor(() => expect(result.current.data).toEqual(updatedPayload));
    });

    it("parses a conflict receipt, follows its operation, and never refetches live priorities", async () => {
        const updatedPayload = {
            ...canonicalPayload,
            revision: "revision-2",
            items: [{ workspaceId: "sales", description: "Sales", tag: "sales", priority: 1 }],
        };
        const conflict = Object.assign(new Error("Workspace priorities are already being updated"), {
            response: {
                status: 409,
                data: {
                    data: {
                        code: PUBLIC_ERROR_CODES.CONFLICT_ERROR,
                        activeOperation: { operationId: "operation-2", status: "in_progress" },
                    },
                },
            },
        });
        const client = new WorkspacePrioritiesMemoryClient();
        client.queueUpdate({ error: conflict });
        client.queueOperation("operation-2", { status: "completed", result: updatedPayload });
        const { result } = renderHook(() => useWorkspacePriorities({ accountId: "account-1", enabled: true, client }), {
            wrapper: createWrapper(),
        });
        await waitFor(() => expect(result.current.data).toEqual(canonicalPayload));

        let recoveredConflict;
        try {
            await result.current.updateWorkspacePriorities({
                revision: "revision-1",
                orderedWorkspaceIds: ["sales"],
            });
        } catch (error) {
            recoveredConflict = error;
        }

        await waitFor(() => expect(result.current.data).toEqual(updatedPayload));
        expect(recoveredConflict).toBeInstanceOf(WorkspacePrioritiesConflictError);
        expect(recoveredConflict.cause).toBe(conflict);
        expect(recoveredConflict.recovery).toEqual({ data: updatedPayload });
        expect(client.events.filter((event) => event.kind === "read")).toHaveLength(1);
        expect(client.events.filter((event) => event.kind === "operation")).toHaveLength(1);
    });

    it("rejects failed operations with a sanitized error and preserves the cached order", async () => {
        const client = new WorkspacePrioritiesMemoryClient();
        client.queueUpdate({ status: 202, data: { operationId: "operation-2", status: "pending" } });
        client.queueOperation("operation-2", {
            status: "failed",
            errorCode: PUBLIC_ERROR_CODES.CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_FAILED,
            errorMessage: "private upstream response",
        });
        const { result } = renderHook(() => useWorkspacePriorities({ accountId: "account-1", enabled: true, client }), {
            wrapper: createWrapper(),
        });
        await waitFor(() => expect(result.current.data).toEqual(canonicalPayload));

        const update = result.current.updateWorkspacePriorities({
            revision: "revision-1",
            orderedWorkspaceIds: ["support"],
        });
        await expect(update).rejects.toBeInstanceOf(WorkspacePriorityPollingError);
        await expect(update).rejects.toMatchObject({
            reason: WORKSPACE_PRIORITY_POLLING_REASONS.OPERATION_FAILED,
            message: "Workspace priority update failed.",
            code: PUBLIC_ERROR_CODES.CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_FAILED,
        });
        expect(result.current.data).toEqual(canonicalPayload);
    });

    it("uses the canonical public code and a typed local reason for client-only polling failures", async () => {
        const client = new WorkspacePrioritiesMemoryClient();
        client.queueOperation("operation-1", { status: "unexpected" });

        await expect(
            pollWorkspacePriorityOperation({
                client,
                accountId: "account-1",
                operationId: "operation-1",
            }),
        ).rejects.toMatchObject({
            name: "WorkspacePriorityPollingError",
            reason: WORKSPACE_PRIORITY_POLLING_REASONS.INVALID_STATUS,
            code: PUBLIC_ERROR_CODES.CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_FAILED,
        });
    });

    it("cleans the poll-delay abort listener after the delay settles", async () => {
        const client = new WorkspacePrioritiesMemoryClient();
        client.queueOperation("operation-1", { status: "pending" }, { status: "completed", result: canonicalPayload });
        const listeners = new Set();
        const signal = {
            aborted: false,
            addEventListener: (_name, listener) => listeners.add(listener),
            removeEventListener: (_name, listener) => listeners.delete(listener),
        };

        await expect(
            pollWorkspacePriorityOperation({
                client,
                accountId: "account-1",
                operationId: "operation-1",
                signal,
            }),
        ).resolves.toEqual(canonicalPayload);
        expect(listeners).toHaveLength(0);
    });

    it("disables browser-triggered refetches so an unsaved local order stays visible", () => {
        const options = createWorkspacePriorityQueryOptions({
            queryKey: ["channel-hub-workspace-priorities", "account-1"],
            client: new WorkspacePrioritiesMemoryClient(),
            accountId: "account-1",
            enabled: true,
        });

        expect(options.refetchOnWindowFocus).toBe(false);
        expect(options.refetchOnReconnect).toBe(false);
    });
});
