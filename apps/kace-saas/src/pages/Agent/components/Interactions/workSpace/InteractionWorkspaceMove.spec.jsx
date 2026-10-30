import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import InteractionWorkspaceMove from "./InteractionWorkspaceMove";

const mocks = vi.hoisted(() => ({
    moveWorkspaceInline: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "interactions.detail.workspacedestination": "Move workspace",
                "common.close": "Close",
            })[key] ?? key,
    }),
}));

vi.mock("./MoveWorkspaceInline", () => ({
    default: (props) => {
        mocks.moveWorkspaceInline(props);
        return <div data-testid="move-workspace-inline" />;
    },
}));

describe("InteractionWorkspaceMove", () => {
    it("does not render the move control without update permission", () => {
        render(
            <InteractionWorkspaceMove
                interaction={{ id: "interaction-1", workspace_id: "workspace-1" }}
                showMoveWorkspace={false}
                setShowMoveWorkspace={vi.fn()}
                canMoveWorkspace={false}
            />,
        );

        expect(screen.queryByRole("button", { name: "Move workspace" })).not.toBeInTheDocument();
    });

    it("opens and closes the inline move form when move permission is granted", async () => {
        const user = userEvent.setup();
        const setShowMoveWorkspace = vi.fn();

        const { rerender } = render(
            <InteractionWorkspaceMove
                interaction={{ id: "interaction-1", workspace_id: "workspace-1" }}
                showMoveWorkspace={false}
                setShowMoveWorkspace={setShowMoveWorkspace}
                canMoveWorkspace
            />,
        );

        await user.click(screen.getByRole("button", { name: "Move workspace" }));

        expect(setShowMoveWorkspace).toHaveBeenCalledWith(true);

        rerender(
            <InteractionWorkspaceMove
                interaction={{ id: "interaction-1", workspace_id: "workspace-1" }}
                showMoveWorkspace
                setShowMoveWorkspace={setShowMoveWorkspace}
                canMoveWorkspace
            />,
        );

        expect(screen.getByTestId("move-workspace-inline")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Close" }));

        expect(setShowMoveWorkspace).toHaveBeenCalledWith(false);
    });

    it("normalizes parent state before closing after a successful move", async () => {
        const onInteractionMoved = vi.fn().mockResolvedValue(undefined);
        const setShowMoveWorkspace = vi.fn();
        render(
            <InteractionWorkspaceMove
                interaction={{ id: "interaction-1", workspace_id: "workspace-1" }}
                showMoveWorkspace
                setShowMoveWorkspace={setShowMoveWorkspace}
                canMoveWorkspace
                activeGroupId="group-1"
                onInteractionMoved={onInteractionMoved}
            />,
        );

        await act(async () => {
            await mocks.moveWorkspaceInline.mock.calls.at(-1)[0].onConfirm("interaction-1", "workspace-2");
        });

        expect(onInteractionMoved).toHaveBeenCalledWith("interaction-1", "workspace-2");
        expect(setShowMoveWorkspace).toHaveBeenCalledWith(false);
        expect(onInteractionMoved.mock.invocationCallOrder[0]).toBeLessThan(
            setShowMoveWorkspace.mock.invocationCallOrder[0],
        );
    });
});
