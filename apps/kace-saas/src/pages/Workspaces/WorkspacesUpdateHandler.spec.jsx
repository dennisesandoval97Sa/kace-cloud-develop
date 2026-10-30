import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { genericView } from "@/services/genericView";
import { SYSTEM_INBOX_WORKSPACE_ID } from "@/utils/systemInboxWorkspace";
import WorkspacesUpdateHandler from "./WorkspacesUpdateHandler";

const mocks = vi.hoisted(() => ({
    id: "00000000-0000-0000-0000-000000000000",
    mutate: vi.fn(),
    workspaceForm: vi.fn(() => <div data-testid="workspace-form" />),
}));

vi.mock("react-router-dom", () => ({
    useParams: () => ({ id: mocks.id }),
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));
vi.mock("@/services/genericView", () => ({ genericView: vi.fn() }));
vi.mock("@/hooks/useGeneralMutation", () => ({
    default: () => ({ mutate: mocks.mutate, isPending: false }),
}));
vi.mock("@/pages/NotFound/NotFound", () => ({
    default: () => <div data-testid="not-found" />,
}));
vi.mock("./components/WorkspaceForm", () => ({
    default: mocks.workspaceForm,
}));

describe("WorkspacesUpdateHandler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.id = SYSTEM_INBOX_WORKSPACE_ID;
    });

    it("renders not found without fetching the canonical Inbox workspace", () => {
        useQuery.mockImplementation(({ enabled }) => {
            expect(enabled).toBe(false);
            return { data: undefined, isLoading: false };
        });

        render(<WorkspacesUpdateHandler />);

        expect(screen.getByTestId("not-found")).toBeInTheDocument();
        expect(screen.queryByTestId("workspace-form")).not.toBeInTheDocument();
        expect(genericView).not.toHaveBeenCalled();
    });

    it("restores groups as an explicit empty array after generic update formatting", async () => {
        mocks.id = "4cecb6b5-69cf-4f93-8c54-c12d206f0efd";
        useQuery.mockReturnValue({ data: undefined, isLoading: false });

        render(<WorkspacesUpdateHandler />);

        const { dataHandler } = mocks.workspaceForm.mock.calls.at(-1)[0];
        await act(async () => {
            await dataHandler({
                id: mocks.id,
                description: "Support workspace",
                tag: "support",
                groups: [],
                channel_hub_accounts: [{ id: "bb4e9857-11c1-43f4-9119-947d6a6f7587" }],
            });
        });

        expect(mocks.mutate).toHaveBeenCalledWith(
            expect.objectContaining({
                id: mocks.id,
                url: `/workspaces/${mocks.id}`,
                dataPost: expect.objectContaining({ groups: [] }),
            }),
        );
    });

    it.each([
        [false, "/deactivate"],
        [true, ""],
    ])("routes is_active=%s edits to the corresponding endpoint", async (is_active, suffix) => {
        mocks.id = "4cecb6b5-69cf-4f93-8c54-c12d206f0efd";
        useQuery.mockReturnValue({ data: undefined, isLoading: false });
        render(<WorkspacesUpdateHandler />);

        const { dataHandler } = mocks.workspaceForm.mock.calls.at(-1)[0];
        await act(async () => {
            await dataHandler({ id: mocks.id, is_active, description: "Updated workspace" });
        });

        expect(mocks.mutate).toHaveBeenCalledWith(
            expect.objectContaining({
                url: `/workspaces/${mocks.id}${suffix}`,
                dataPost: expect.objectContaining({ is_active, description: "Updated workspace" }),
            }),
        );
    });
});
