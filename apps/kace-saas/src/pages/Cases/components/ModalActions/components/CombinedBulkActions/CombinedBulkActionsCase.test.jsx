import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import CombinedBulkActionsCase from "./CombinedBulkActionsCase";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}));

vi.mock("sonner", () => ({
    toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const mockSetSelectedCases = vi.fn();
const mockClearSelectedCases = vi.fn();
let mockSelectedCases = [{ id: "case-1", transicion_id: "t-1" }];

vi.mock("@/pages/Cases/hooks/useSelectedCases", () => ({
    default: () => ({
        selectedCases: mockSelectedCases,
        setSelectedCases: mockSetSelectedCases,
        clearSelectedCases: mockClearSelectedCases,
    }),
}));

vi.mock("@kace_v2/features/boards/utils/boardCasesBulk.utils", () => ({
    hasSameTransicion: () => true,
}));

const mockHandleReassignUser = vi.fn(async () => ({ processed: 1, total: 1, successIds: ["case-1"], failedIds: [] }));
const mockHandleReassignGroup = vi.fn(async () => ({ processed: 1, total: 1, successIds: ["case-1"], failedIds: [] }));
vi.mock("../ReAssignCase/hooks/useReassignCase", () => ({
    useReassignCase: () => ({
        handleReassignUser: mockHandleReassignUser,
        handleReassignGroup: mockHandleReassignGroup,
    }),
}));

const mockHandleCaseClose = vi.fn(async () => ({ processed: 1, total: 1, successIds: ["case-1"], failedIds: [] }));
vi.mock("../CloseCase/hooks/useCaseClose", () => ({
    default: () => ({ handleCaseClose: mockHandleCaseClose }),
}));

const mockHandleChangeState = vi.fn(async () => ({ processed: 1, total: 1, successIds: ["case-1"], failedIds: [] }));
vi.mock("../ChangeStateCase/hooks/useChangeStateCase", () => ({
    useChangeStateCase: () => ({ handleChangeState: mockHandleChangeState }),
}));

vi.mock("../ChangeStateCase/ChangeStateCaseFields", () => ({
    ChangeStateCaseFields: ({ setFieldValue }) => (
        <button
            type="button"
            data-testid="fill-change-state"
            onClick={() => setFieldValue("transicion_id", "11111111-1111-4111-8111-111111111111")}
        >
            fill change state
        </button>
    ),
}));

vi.mock("../ReAssignCase/ReassignCaseFields", () => ({
    ReassignCaseFields: ({ setFieldValue }) => (
        <button
            type="button"
            data-testid="fill-reassign"
            onClick={() => {
                setFieldValue("tipo", "1");
                setFieldValue("grupo_id", "22222222-2222-4222-8222-222222222222");
            }}
        >
            fill reassign
        </button>
    ),
}));

vi.mock("../CloseCase/CloseCaseFields", () => ({
    CloseCaseFields: () => <div data-testid="close-fields" />,
}));

const renderCombined = (props = {}) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={queryClient}>
            <CombinedBulkActionsCase
                open
                onOpenChange={vi.fn()}
                canReassign
                canClose={false}
                canChangeState
                {...props}
            />
        </QueryClientProvider>,
    );
};

describe("CombinedBulkActionsCase", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSelectedCases = [{ id: "case-1", transicion_id: "t-1" }];
    });

    it("shows a no-op toast and skips every mutation when nothing was filled in", async () => {
        const user = userEvent.setup();
        renderCombined();

        await act(async () => {
            await user.click(screen.getByText("combinedBulkActions.buttons.confirm"));
        });

        expect(mockHandleChangeState).not.toHaveBeenCalled();
        expect(mockHandleReassignUser).not.toHaveBeenCalled();
        expect(mockHandleReassignGroup).not.toHaveBeenCalled();
        expect(toast.info).toHaveBeenCalledWith("combinedBulkActions.noActionsRun");
    });

    it("runs only the sections the user filled in", async () => {
        const user = userEvent.setup();
        renderCombined();

        await user.click(screen.getByTestId("fill-change-state"));
        await user.click(screen.getByTestId("fill-reassign"));

        await waitFor(() => {
            expect(screen.getByTestId("bulk-section-change_state")).toHaveAttribute("data-invalid", "false");
            expect(screen.getByTestId("bulk-section-reassign")).toHaveAttribute("data-invalid", "false");
            expect(screen.getByRole("button", { name: "combinedBulkActions.buttons.confirm" })).toBeEnabled();
        });

        await act(async () => {
            await user.click(screen.getByText("combinedBulkActions.buttons.confirm"));
        });

        expect(mockHandleChangeState).toHaveBeenCalledWith(
            expect.objectContaining({ transicion_id: "11111111-1111-4111-8111-111111111111" }),
            expect.objectContaining({ combined: true }),
        );
        expect(mockHandleReassignGroup).toHaveBeenCalledWith(
            expect.objectContaining({ tipo: "1", grupo_id: "22222222-2222-4222-8222-222222222222" }),
            expect.objectContaining({ combined: true }),
        );
        expect(mockHandleReassignUser).not.toHaveBeenCalled();
        expect(toast.info).not.toHaveBeenCalled();
    });

    it("disables Confirm when close is enabled and the close reason is invalid", async () => {
        const user = userEvent.setup();
        renderCombined({ canClose: true, canReassign: true, canChangeState: false });

        expect(screen.getByRole("button", { name: "combinedBulkActions.buttons.confirm" })).toBeEnabled();

        await user.click(screen.getByLabelText("combinedBulkActions.closeCheckboxLabel"));

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "combinedBulkActions.buttons.confirm" })).toBeDisabled();
        });
    });
});
