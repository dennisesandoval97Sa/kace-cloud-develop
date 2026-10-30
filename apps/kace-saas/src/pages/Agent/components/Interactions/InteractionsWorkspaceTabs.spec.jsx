import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import InteractionsWorkspaceSelect from "./InteractionsWorkspaceTabs";
import useAvailableAgentWorkspaces from "./hooks/useAvailableAgentWorkspaces";
import { SYSTEM_INBOX_WORKSPACE_ID } from "@/utils/systemInboxWorkspace";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("./hooks/useAvailableAgentWorkspaces", () => ({
    default: vi.fn(() => ({
        workspaces: [{ id: "workspace-2", description: "Workspace 2" }],
        isLoading: false,
        isFetched: true,
        activeGroupId: "group-1",
        hasActiveScope: true,
    })),
}));

vi.mock("@/componentsV2/core/MultiSelect", () => ({
    default: vi.fn(() => null),
}));

describe("InteractionsWorkspaceSelect", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAvailableAgentWorkspaces.mockReturnValue({
            workspaces: [{ id: "workspace-2", description: "Workspace 2" }],
            isLoading: false,
            isFetched: true,
            activeGroupId: "group-1",
            hasActiveScope: true,
        });
    });

    it("delegates workspace selection without firing the all workspaces toggle", () => {
        const onSelectWorkspace = vi.fn();
        const onAllWorkspacesChange = vi.fn();

        render(
            <InteractionsWorkspaceSelect
                selectedWorkspace={null}
                onSelectWorkspace={onSelectWorkspace}
                allWorkspaces
                onAllWorkspacesChange={onAllWorkspacesChange}
            />,
        );

        act(() => {
            MultiSelect.mock.calls.at(-1)?.[0].onSelectOption("workspace-2");
        });

        expect(onSelectWorkspace).toHaveBeenCalledWith("workspace-2");
        expect(onAllWorkspacesChange).not.toHaveBeenCalled();
    });

    it("maps the authoritative available list without hiding unrelated workspaces named Inbox", () => {
        useAvailableAgentWorkspaces.mockReturnValue({
            workspaces: [{ id: "named-inbox", description: "Inbox" }],
            isLoading: false,
            isFetched: true,
            activeGroupId: "group-1",
            hasActiveScope: true,
        });

        render(
            <InteractionsWorkspaceSelect
                selectedWorkspace={null}
                onSelectWorkspace={vi.fn()}
                allWorkspaces={false}
                onAllWorkspacesChange={vi.fn()}
            />,
        );

        expect(MultiSelect.mock.calls.at(-1)?.[0].options).toEqual([
            { id: "named-inbox", label: "Inbox", value: "named-inbox" },
        ]);
    });

    it("does not issue an unrestricted rehydration request for a selected workspace", () => {
        render(
            <InteractionsWorkspaceSelect
                selectedWorkspace={SYSTEM_INBOX_WORKSPACE_ID}
                onSelectWorkspace={vi.fn()}
                allWorkspaces={false}
                onAllWorkspacesChange={vi.fn()}
            />,
        );

        expect(useAvailableAgentWorkspaces).toHaveBeenCalledTimes(1);
        expect(MultiSelect.mock.calls.at(-1)?.[0].selectedData).toEqual([]);
    });
});
