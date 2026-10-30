import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { SYSTEM_INBOX_WORKSPACE_ID } from "@/utils/systemInboxWorkspace";
import InteractionsWorkspaceTabs from "./InteractionsWorkspaceTabs";

vi.mock("@/hooks/useGenericSearchQuery", () => ({ default: vi.fn() }));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => (key === "interactions.title.allWorkspaces" ? "All workspaces" : key) }),
}));

describe("InteractionsWorkspaceTabs", () => {
    it("requests and defensively removes only the canonical Inbox workspace", () => {
        useGenericSearchQuery.mockImplementation(({ filter, select }) => {
            expect(filter.at(-1)).toEqual({
                field: "id",
                operator: "neq",
                value: SYSTEM_INBOX_WORKSPACE_ID,
                type: "AND",
            });
            return {
                data: select({
                    data: [
                        { id: SYSTEM_INBOX_WORKSPACE_ID, description: "System Inbox" },
                        { id: "workspace-2", description: "Inbox" },
                    ],
                }),
                isLoading: false,
            };
        });

        render(<InteractionsWorkspaceTabs selectedWorkspace={null} onSelectWorkspace={vi.fn()} />);

        expect(screen.queryByText("System Inbox")).not.toBeInTheDocument();
        expect(screen.getByText("Inbox")).toBeInTheDocument();
    });
});
