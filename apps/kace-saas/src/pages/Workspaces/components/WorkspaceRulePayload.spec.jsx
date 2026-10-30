import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import WorkspaceForm from "./WorkspaceForm";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("@/pages/Workspaces/components/MultiSelectMailAccounts", () => ({
    MultiSelectMailAccounts: () => <div data-testid="mail-accounts" />,
}));

vi.mock("@/pages/Workspaces/components/MultiSelectChannelHubAccounts", () => ({
    MultiSelectChannelHubAccounts: () => <div data-testid="channel-hub-accounts" />,
}));

vi.mock("@/pages/Workspaces/components/MultiSelectGroupsWorkspace", () => ({
    MultiSelectGroupsWorkspace: () => <div data-testid="groups" />,
}));

vi.mock("@/hooks/useGenericSearchInfiniteQuery", () => ({
    default: () => ({
        data: [],
        isLoading: false,
    }),
}));

const renderWorkspaceForm = (props) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <WorkspaceForm {...props} />
            </MemoryRouter>
        </QueryClientProvider>,
    );
};

describe("Workspace rule payload", () => {
    it("submits Para and Cuerpo rules using Channel Hub routing keys", async () => {
        const dataHandler = vi.fn();
        const user = userEvent.setup();

        renderWorkspaceForm({
            dataHandler,
            data: {
                id: "4cecb6b5-69cf-4f93-8c54-c12d206f0efd",
                description: "Support workspace",
                is_active: true,
                tag: "support",
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587", email: "support@example.com" }],
                groups: [{ id: "3824c61a-6368-4c5c-957f-769525109e85", nombre: "Administrators" }],
                rules: {
                    ruleId: "channel-hub-rule-id",
                },
                tableRules: [
                    { field: "to", operator: "contains", value: "recipient@example.com" },
                    { field: "to", operator: "equals", value: "exact@example.com" },
                    { field: "body", operator: "contains", value: "urgent body" },
                ],
            },
        });

        await user.click(screen.getByTestId("btn_form_card_update"));

        await waitFor(() => {
            expect(dataHandler).toHaveBeenCalledWith(
                expect.objectContaining({
                    rules: expect.objectContaining({
                        ruleId: "channel-hub-rule-id",
                        toContains: ["recipient@example.com"],
                        toEquals: ["exact@example.com"],
                        bodyContains: ["urgent body"],
                    }),
                }),
            );
        });
    });
});
