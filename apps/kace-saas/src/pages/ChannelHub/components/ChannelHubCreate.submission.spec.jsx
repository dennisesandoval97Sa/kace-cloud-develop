import { describe, expect, it } from "vitest";
import { PUBLIC_ERROR_CODES } from "@kace/error-codes";
import { getTranslatedError } from "@/utils/getTranslatedError";
import { parseChannelHubAccount } from "../data/channelHubAccount";
import { WorkspacePrioritiesConflictError } from "../errors/workspacePrioritiesConflictError";
import { isChannelHubEditMode, submitChannelHubAccount } from "../services/channelHubSubmission";
import { createChannelHubTestI18n } from "../test/channelHubTestI18n";

const priorityUpdate = {
    revision: "revision-1",
    orderedWorkspaceIds: ["sales", "support"],
};

class ChannelHubSubmissionMemory {
    constructor() {
        this.events = [];
        this.status = null;
        this.formErrors = null;
        this.recoveryError = null;
        this.accountFailure = null;
        this.priorityOutcome = Promise.resolve({});
        this.reloadOutcome = Promise.resolve({ data: {} });
        this.i18n = createChannelHubTestI18n("en");
    }

    buildPayload = (values) => ({ url: "/channel-hub", dataPost: values });

    saveAccount = async (payload) => {
        this.events.push({ kind: "save-account", payload });
        if (this.accountFailure) throw this.accountFailure;
    };

    updateWorkspacePriorities = async (update) => {
        this.events.push({ kind: "update-priorities", update });
        return this.priorityOutcome;
    };

    reloadWorkspacePriorities = async () => {
        this.events.push({ kind: "reload-priorities" });
        return this.reloadOutcome;
    };

    notifySaved = (message) => this.events.push({ kind: "saved-notification", message });

    navigateToIndex = () => this.events.push({ kind: "navigate-to-index" });

    submit = ({ isReadOnly = false, workspacePriorityUpdate = null } = {}) =>
        submitChannelHubAccount({
            isReadOnly,
            values: { email: "changed@example.com" },
            setErrors: (errors) => {
                this.formErrors = errors;
            },
            setStatus: (status) => {
                this.status = status;
            },
            workspacePriorityUpdate,
            buildPayload: this.buildPayload,
            saveAccount: this.saveAccount,
            updateWorkspacePriorities: this.updateWorkspacePriorities,
            reloadWorkspacePriorities: this.reloadWorkspacePriorities,
            onRecoveryError: (error) => {
                this.recoveryError = error;
            },
            translate: this.i18n.t.bind(this.i18n),
            translateError: getTranslatedError,
            notifySaved: this.notifySaved,
            navigateToIndex: this.navigateToIndex,
        });
}

describe("ChannelHubCreate submission policy", () => {
    it("derives update mode from route inputs", () => {
        expect(isChannelHubEditMode({ id: "account-1", pathname: "/channel-hub/update/account-1" })).toBe(true);
        expect(isChannelHubEditMode({ id: null, pathname: "/channel-hub/update/account-1" })).toBe(true);
        expect(isChannelHubEditMode({ id: null, pathname: "/channel-hub/create" })).toBe(false);
    });

    it("parses wrapped account fields once at the API boundary", () => {
        expect(
            parseChannelHubAccount({
                data: {
                    id: "account-1",
                    email: { value: "support@example.com", label: "Support" },
                    name: "Support",
                    channel_hub_connection_id: null,
                },
            }),
        ).toEqual(
            expect.objectContaining({
                id: "account-1",
                email: "support@example.com",
                name: "Support",
                channel_hub_connection_id: "",
            }),
        );
    });

    it("blocks every write in read-only mode", async () => {
        const memory = new ChannelHubSubmissionMemory();

        await memory.submit({ isReadOnly: true, workspacePriorityUpdate: priorityUpdate });

        expect(memory.events).toEqual([]);
    });

    it("saves the account before priorities and navigates only after both succeed", async () => {
        const memory = new ChannelHubSubmissionMemory();

        await memory.submit({ workspacePriorityUpdate: priorityUpdate });

        expect(memory.events.map((event) => event.kind)).toEqual([
            "save-account",
            "update-priorities",
            "saved-notification",
            "navigate-to-index",
        ]);
        expect(memory.events[1].update).toEqual(priorityUpdate);
    });

    it("waits for an asynchronous priority operation before notifying or navigating", async () => {
        const memory = new ChannelHubSubmissionMemory();
        let completeOperation;
        memory.priorityOutcome = new Promise((resolve) => {
            completeOperation = resolve;
        });

        const submission = memory.submit({ workspacePriorityUpdate: priorityUpdate });
        await Promise.resolve();
        expect(memory.events.map((event) => event.kind)).toEqual(["save-account", "update-priorities"]);

        completeOperation({ revision: "revision-2" });
        await submission;
        expect(memory.events.map((event) => event.kind)).toEqual([
            "save-account",
            "update-priorities",
            "saved-notification",
            "navigate-to-index",
        ]);
    });

    it("translates an account-save failure through the public error registry", async () => {
        const memory = new ChannelHubSubmissionMemory();
        memory.accountFailure = {
            response: {
                data: { data: { code: PUBLIC_ERROR_CODES.CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_FAILED } },
            },
        };

        await expect(memory.submit()).rejects.toBe(memory.accountFailure);
        expect(memory.status).toBe("Workspace priorities could not be updated. Try again.");
        expect(memory.events.map((event) => event.kind)).toEqual(["save-account"]);
    });

    it("reloads the current order after an ordinary partial priority failure", async () => {
        const memory = new ChannelHubSubmissionMemory();
        memory.priorityOutcome = Promise.reject(new Error("Channel Hub unavailable"));

        await memory.submit({ workspacePriorityUpdate: priorityUpdate });

        expect(memory.events.map((event) => event.kind)).toEqual([
            "save-account",
            "update-priorities",
            "reload-priorities",
        ]);
        expect(memory.status).toBe(
            "The account was saved, but Channel Hub could not finish updating priorities. The current Channel Hub order has been reloaded.",
        );
    });

    it("uses a followed conflict operation result without reading live priorities", async () => {
        const memory = new ChannelHubSubmissionMemory();
        const cause = new Error("Workspace priorities are already being updated");
        memory.priorityOutcome = Promise.reject(
            new WorkspacePrioritiesConflictError(cause, {
                data: { revision: "revision-2", items: [] },
            }),
        );

        await memory.submit({ workspacePriorityUpdate: priorityUpdate });

        expect(memory.events.map((event) => event.kind)).toEqual(["save-account", "update-priorities"]);
        expect(memory.recoveryError).toBeNull();
        expect(memory.status).toBe(
            "The account was saved, but Channel Hub could not finish updating priorities. The current Channel Hub order has been reloaded.",
        );
    });

    it("surfaces operation-status recovery failure without falling back to live priorities", async () => {
        const memory = new ChannelHubSubmissionMemory();
        const recoveryError = new Error("Operation status unavailable");
        memory.priorityOutcome = Promise.reject(
            new WorkspacePrioritiesConflictError(new Error("Priority conflict"), { error: recoveryError }),
        );

        await memory.submit({ workspacePriorityUpdate: priorityUpdate });

        expect(memory.events.map((event) => event.kind)).toEqual(["save-account", "update-priorities"]);
        expect(memory.recoveryError).toBe(recoveryError);
        expect(memory.status).toBe(
            "The account was saved, but Channel Hub could not finish updating priorities or reload the current order. Retry loading before reordering again.",
        );
    });
});
