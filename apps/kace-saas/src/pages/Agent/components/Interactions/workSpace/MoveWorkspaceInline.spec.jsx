import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import { SYSTEM_INBOX_WORKSPACE_ID } from "@/utils/systemInboxWorkspace";
import MoveWorkspaceInline from "./MoveWorkspaceInline";
import useAgentMoveWorkspaceDestinations from "../hooks/useAgentMoveWorkspaceDestinations";

const mocks = vi.hoisted(() => ({
    moveInteractionToWorkspace: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("@/components/core/Cards/InputCard", () => ({
    default: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/componentsV2/core/MultiSelect", () => ({
    default: vi.fn(() => null),
}));

vi.mock("../hooks/useAgentMoveWorkspaceDestinations", () => ({
    default: vi.fn(),
}));

vi.mock("./hooks/useWorkSpaceMove", () => ({
    useWorkSpaceMove: () => ({
        moveInteractionToWorkspace: mocks.moveInteractionToWorkspace,
        isUpdatingInteractions: false,
    }),
}));

describe("MoveWorkspaceInline", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAgentMoveWorkspaceDestinations.mockReturnValue({
            workspaces: [
                { id: SYSTEM_INBOX_WORKSPACE_ID, description: "INBOX" },
                { id: "workspace-1", description: "Current" },
                { id: "workspace-2", description: "Other group" },
                { id: "workspace-3", description: "Zero group" },
            ],
            isLoading: false,
            hasActiveScope: true,
        });
    });

    it("excludes the canonical Inbox workspace from move destinations", () => {
        render(
            <MoveWorkspaceInline currentWorkspaceId="workspace-1" interactionId="interaction-1" onConfirm={vi.fn()} />,
        );

        expect(MultiSelect.mock.calls.at(-1)?.[0]).toEqual(
            expect.objectContaining({
                options: [
                    { id: "workspace-2", label: "Other group", value: "workspace-2" },
                    { id: "workspace-3", label: "Zero group", value: "workspace-3" },
                ],
            }),
        );
    });

    it("notifies the parent only after the move succeeds", async () => {
        const onConfirm = vi.fn();
        mocks.moveInteractionToWorkspace.mockImplementationOnce(async (_values, options) => {
            await options.onSuccess();
        });
        render(
            <MoveWorkspaceInline
                currentWorkspaceId="workspace-1"
                interactionId="interaction-1"
                activeGroupId="group-1"
                onConfirm={onConfirm}
            />,
        );

        act(() => {
            MultiSelect.mock.calls.at(-1)[0].onSelectOption("workspace-2");
        });
        fireEvent.click(screen.getByRole("button"));

        await waitFor(() => {
            expect(onConfirm).toHaveBeenCalledWith("interaction-1", "workspace-2");
        });
    });

    it("keeps the success transition untouched when the move fails", async () => {
        const onConfirm = vi.fn();
        mocks.moveInteractionToWorkspace.mockRejectedValueOnce(new Error("move failed"));
        render(
            <MoveWorkspaceInline
                currentWorkspaceId="workspace-1"
                interactionId="interaction-1"
                activeGroupId="group-1"
                onConfirm={onConfirm}
            />,
        );

        act(() => {
            MultiSelect.mock.calls.at(-1)[0].onSelectOption("workspace-2");
        });
        fireEvent.click(screen.getByRole("button"));

        await waitFor(() => {
            expect(mocks.moveInteractionToWorkspace).toHaveBeenCalled();
        });
        expect(onConfirm).not.toHaveBeenCalled();
        expect(screen.getByRole("button")).toBeEnabled();
    });

    it("disables a stale destination when the active-group scope disappears", () => {
        const view = render(
            <MoveWorkspaceInline
                currentWorkspaceId="workspace-1"
                interactionId="interaction-1"
                activeGroupId="group-1"
            />,
        );

        act(() => {
            MultiSelect.mock.calls.at(-1)[0].onSelectOption("workspace-2");
        });
        expect(screen.getByRole("button")).toBeEnabled();

        useAgentMoveWorkspaceDestinations.mockReturnValue({
            workspaces: [],
            isLoading: false,
            hasActiveScope: false,
        });
        view.rerender(
            <MoveWorkspaceInline currentWorkspaceId="workspace-1" interactionId="interaction-1" activeGroupId={null} />,
        );

        expect(screen.getByRole("button")).toBeDisabled();
    });
});
