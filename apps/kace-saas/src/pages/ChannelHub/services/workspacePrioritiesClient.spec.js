import { describe, expect, it } from "vitest";
import { PUBLIC_ERROR_CODES } from "@kace/error-codes";
import { createWorkspacePrioritiesClient, parseWorkspacePrioritiesConflict } from "./workspacePrioritiesClient";

class ChannelHubHttpMemory {
    constructor() {
        this.requests = [];
        this.readResponses = new Map();
        this.writeResponse = null;
    }

    get = async (url, options) => {
        this.requests.push({ method: "GET", url, options });
        return this.readResponses.get(url);
    };

    post = async (url, payload) => {
        this.requests.push({ method: "POST", url, payload });
        return this.writeResponse;
    };
}

describe("workspacePrioritiesClient", () => {
    it("owns the account, update, and operation-status HTTP boundaries", async () => {
        const http = new ChannelHubHttpMemory();
        const prioritiesUrl = "/channel-hub/account-1/workspace-priorities";
        const operationUrl = `${prioritiesUrl}/reorders/operation-1`;
        const priorities = { revision: "revision-1", items: [] };
        const operation = { status: "completed", result: priorities };
        const signal = new AbortController().signal;
        http.readResponses.set(prioritiesUrl, { data: { data: priorities } });
        http.readResponses.set(operationUrl, { data: operation });
        http.writeResponse = { status: 202, data: { operationId: "operation-1", status: "pending" } };
        const client = createWorkspacePrioritiesClient(http);

        await expect(client.read("account-1")).resolves.toEqual(priorities);
        await expect(client.update("account-1", { revision: "revision-1", orderedWorkspaceIds: [] })).resolves.toEqual({
            status: 202,
            data: { operationId: "operation-1", status: "pending" },
        });
        await expect(client.readOperation("account-1", "operation-1", signal)).resolves.toEqual(operation);
        expect(http.requests).toEqual([
            { method: "GET", url: prioritiesUrl, options: undefined },
            {
                method: "POST",
                url: `${prioritiesUrl}/reorder`,
                payload: { revision: "revision-1", orderedWorkspaceIds: [] },
            },
            { method: "GET", url: operationUrl, options: { signal } },
        ]);
    });

    it("accepts only a valid active operation from a 409 conflict receipt", () => {
        const validConflict = {
            response: {
                status: 409,
                data: {
                    data: {
                        code: PUBLIC_ERROR_CODES.CONFLICT_ERROR,
                        activeOperation: { operationId: "operation-2", status: "in_progress" },
                    },
                },
            },
        };

        expect(parseWorkspacePrioritiesConflict(validConflict)).toEqual({
            operationId: "operation-2",
            status: "in_progress",
        });
        expect(
            parseWorkspacePrioritiesConflict({
                response: {
                    status: 409,
                    data: {
                        code: PUBLIC_ERROR_CODES.CONFLICT_ERROR,
                        activeOperation: { operationId: 2, status: "completed" },
                    },
                },
            }),
        ).toBeNull();
        expect(parseWorkspacePrioritiesConflict({ response: { status: 500, data: validConflict } })).toBeNull();
    });
});
