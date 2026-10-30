import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InteractionsHandler from "./InteractionsHandler";

const mocks = vi.hoisted(() => ({
    selectedWorkspace: undefined,
    actions: [],
}));

vi.mock("./components/InteractionsWorkspaceTabs", () => ({
    default: vi.fn(({ onSelectWorkspace }) => (
        <button type="button" data-testid="workspace-tabs" onClick={() => onSelectWorkspace("workspace-id")}>
            Workspace tabs
        </button>
    )),
}));

vi.mock("./components/InteractionsDataTable", () => ({
    default: vi.fn(({ selectedWorkspace, actions }) => {
        mocks.selectedWorkspace = selectedWorkspace;
        mocks.actions = actions;
        return <div data-testid="interactions-data-table" />;
    }),
}));

describe("InteractionsHandler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.selectedWorkspace = undefined;
        mocks.actions = [];
    });

    it("renders the workspace filters and full-width interactions DataTable", () => {
        const actions = [{ name: "Ver", action: vi.fn(), customizable: false }];

        render(<InteractionsHandler actions={actions} />);

        expect(screen.getByTestId("workspace-tabs")).toBeInTheDocument();
        expect(screen.getByTestId("interactions-data-table")).toBeInTheDocument();
        expect(mocks.selectedWorkspace).toBeNull();
        expect(mocks.actions).toBe(actions);
    });

    it("passes the selected workspace to the DataTable", async () => {
        const user = userEvent.setup();

        render(<InteractionsHandler actions={[]} />);
        await user.click(screen.getByTestId("workspace-tabs"));

        expect(mocks.selectedWorkspace).toBe("workspace-id");
    });
});
