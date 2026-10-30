import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import PropTypes from "prop-types";
import { PUBLIC_ERROR_CODES } from "@kace/error-codes";
import WorkspacePriorityList from "./WorkspacePriorityList";
import en from "@/locale/en.json";
import es from "@/locale/es.json";
import { ChannelHubTestI18nProvider } from "../test/channelHubTestI18n";

const initialItems = [
    { workspaceId: "support", description: "Customer Support", tag: "support", priority: 1 },
    { workspaceId: "sales", description: "Sales", tag: "sales", priority: 2 },
    { workspaceId: "collections", description: "Collections", tag: "collections", priority: 3 },
];

const renderWithTranslations = (component, language = "en") =>
    render(<ChannelHubTestI18nProvider language={language}>{component}</ChannelHubTestI18nProvider>);

const ControlledList = ({ onOrderChange = () => undefined, ...props }) => {
    const [items, setItems] = useState(initialItems);
    const handleOrderChange = (nextItems) => {
        setItems(nextItems);
        onOrderChange(nextItems);
    };

    return (
        <WorkspacePriorityList
            items={items}
            canReorder
            isConfigured
            isRegistered
            onOrderChange={handleOrderChange}
            {...props}
        />
    );
};

ControlledList.propTypes = {
    onOrderChange: PropTypes.func,
};

describe("WorkspacePriorityList", () => {
    it("moves a workspace locally and keeps boundary controls disabled", async () => {
        let changedOrder = null;
        const user = userEvent.setup();

        renderWithTranslations(<ControlledList onOrderChange={(items) => (changedOrder = items)} />);

        expect(screen.getByRole("button", { name: "Move Customer Support up" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Move Collections down" })).toBeDisabled();

        await user.click(screen.getByRole("button", { name: "Move Sales up" }));

        expect(screen.getAllByTestId("workspace-priority-name").map((node) => node.textContent)).toEqual([
            "Sales",
            "Customer Support",
            "Collections",
        ]);
        expect(screen.getAllByTestId("workspace-priority-number").map((node) => node.textContent)).toEqual([
            "1",
            "2",
            "3",
        ]);
        expect(changedOrder).toEqual([initialItems[1], initialItems[0], initialItems[2]]);
    });

    it("shows a known conflict in English without rendering the backend message", () => {
        const hostileBackendMessage = '<img src=x onerror="stealCredentials()"> private-rule-id';
        renderWithTranslations(
            <WorkspacePriorityList
                items={initialItems}
                conflicts={[
                    {
                        code: "TAG_MISMATCH",
                        message: hostileBackendMessage,
                        workspaceId: "sales",
                    },
                ]}
                canReorder={false}
                isConfigured
                isRegistered
                onOrderChange={() => undefined}
            />,
        );

        expect(screen.getByTestId("workspace-priorities-conflicts")).toHaveTextContent(
            en.channelHub.workspacePriorities.conflicts.tagMismatch,
        );
        expect(screen.getByTestId("workspace-priorities-conflicts")).not.toHaveTextContent(hostileBackendMessage);
        expect(screen.getByTestId("workspace-priorities-conflicts")).not.toHaveTextContent("private-rule-id");
        expect(screen.queryByTestId("workspace-priority-list")).not.toBeInTheDocument();
    });

    it("shows a known conflict in Spanish", () => {
        renderWithTranslations(
            <WorkspacePriorityList
                conflicts={[{ code: "MISSING_RULE_ID", message: "private provider detail" }]}
                isConfigured
                isRegistered
                onOrderChange={() => undefined}
            />,
            "es",
        );

        expect(screen.getByTestId("workspace-priorities-conflicts")).toHaveTextContent(
            es.channelHub.workspacePriorities.conflicts.missingRuleId,
        );
        expect(screen.getByTestId("workspace-priorities-conflicts")).not.toHaveTextContent("private provider detail");
    });

    it("uses the localized fallback for unknown and missing conflict codes", () => {
        renderWithTranslations(
            <WorkspacePriorityList
                conflicts={[
                    { code: "toString", message: "unknown private detail" },
                    { message: "missing-code private detail" },
                ]}
                isConfigured
                isRegistered
                onOrderChange={() => undefined}
            />,
        );

        const conflictStatus = screen.getByTestId("workspace-priorities-conflicts");
        expect(conflictStatus).toHaveTextContent(en.channelHub.workspacePriorities.conflicts.unknown);
        expect(conflictStatus.querySelectorAll("li")).toHaveLength(2);
        expect(conflictStatus).not.toHaveTextContent("unknown private detail");
        expect(conflictStatus).not.toHaveTextContent("missing-code private detail");
    });

    it("shows an actionable retry state when Channel Hub cannot be reached", async () => {
        let retryCount = 0;
        const user = userEvent.setup();
        renderWithTranslations(
            <WorkspacePriorityList
                error={new Error("upstream unavailable")}
                isConfigured
                isRegistered
                onOrderChange={() => undefined}
                onRetry={() => (retryCount += 1)}
            />,
        );

        expect(screen.getByTestId("workspace-priorities-error")).toHaveTextContent(
            "Workspace priorities could not be loaded.",
        );
        await user.click(screen.getByRole("button", { name: "Retry" }));
        expect(retryCount).toBe(1);
    });

    it("explains how to recover when the stored Channel Hub connection cannot be accessed", () => {
        renderWithTranslations(
            <WorkspacePriorityList
                error={{ response: { data: { data: { code: "0x060001" } } } }}
                isConfigured
                isRegistered
                onOrderChange={() => undefined}
                onRetry={() => undefined}
            />,
        );

        expect(screen.getByTestId("workspace-priorities-error")).toHaveTextContent(
            en.channelHub.workspacePriorities.connectionUnavailable,
        );
    });

    it("translates asynchronous reorder failures by their public error code", () => {
        renderWithTranslations(
            <WorkspacePriorityList
                error={{ code: PUBLIC_ERROR_CODES.CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_FAILED }}
                isConfigured
                isRegistered
                onOrderChange={() => undefined}
                onRetry={() => undefined}
            />,
        );

        expect(screen.getByTestId("workspace-priorities-error")).toHaveTextContent(
            en.app.errors.public.CHANNEL_HUB_WORKSPACE_PRIORITY_REORDER_FAILED,
        );
    });

    it("keeps Channel Hub connection guidance aligned in English and Spanish", () => {
        expect(en.channelHub.workspacePriorities.connectionUnavailable).toBe(
            "Workspace priorities could not be loaded because this Channel Hub connection could not be found or accessed. Verify or re-register the account, then try again.",
        );
        expect(es.channelHub.workspacePriorities.connectionUnavailable).toBe(
            "No se pudieron cargar las prioridades de workspaces porque no fue posible encontrar o acceder a esta conexión de Channel Hub. Verifica o vuelve a registrar la cuenta e inténtalo de nuevo.",
        );
    });

    it("keeps the live order visible but disables every reorder action in read-only mode", () => {
        renderWithTranslations(<ControlledList isReadOnly />);

        expect(screen.getByTestId("workspace-priority-list")).toBeInTheDocument();
        expect(screen.getAllByRole("button")).toHaveLength(initialItems.length * 2);
        screen.getAllByRole("button").forEach((button) => expect(button).toBeDisabled());
    });

    it("shows an applying state and disables reorder actions while an operation is pending", () => {
        renderWithTranslations(<ControlledList isApplying />);

        expect(screen.getByTestId("workspace-priorities-applying")).toHaveTextContent(
            "Applying the new workspace order...",
        );
        screen.getAllByRole("button").forEach((button) => expect(button).toBeDisabled());
        expect(en.channelHub.workspacePriorities.applying).toBe("Applying the new workspace order...");
        expect(es.channelHub.workspacePriorities.applying).toBe("Aplicando el nuevo orden de workspaces...");
    });
});
