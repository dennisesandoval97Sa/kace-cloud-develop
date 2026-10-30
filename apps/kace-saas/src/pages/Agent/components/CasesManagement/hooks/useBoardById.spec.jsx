import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useBoardById from "./useBoardById.hook.js";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";

const mocks = vi.hoisted(() => ({
    activeClientId: "11111111-1111-4111-8111-111111111111",
    fetchBoard: vi.fn(),
    fetchBoardResources: vi.fn(),
    exportBoardResources: vi.fn(),
}));

vi.mock("./useLoadedAgentClientId", () => ({
    useLoadedAgentClientId: () => mocks.activeClientId,
}));

vi.mock("@kace_v2/features/boards/services/boards.service", () => ({
    fetchBoard: (...args) => mocks.fetchBoard(...args),
    fetchBoardResources: (...args) => mocks.fetchBoardResources(...args),
    exportBoardResources: (...args) => mocks.exportBoardResources(...args),
}));

vi.mock("@kace/hooks/useUserInformation", () => ({
    default: () => ({ permissionsAdmin: [], permissionsAgent: [] }),
}));

vi.mock("@kace_v2/features/boards/hooks/useBoardTableState.hook", () => ({
    default: () => ({
        page: 1,
        setPage: vi.fn(),
        criteria: {},
        criteriaWithSort: { filter: [] },
        filterFormValues: {},
        sortConfig: {},
        openFilterModal: false,
        setOpenFilterModal: vi.fn(),
        handleFilter: vi.fn(),
        handleSort: vi.fn(),
        clearFilters: vi.fn(),
    }),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("sonner", () => ({
    toast: {
        promise: (promiseOrFactory) => (typeof promiseOrFactory === "function" ? promiseOrFactory() : promiseOrFactory),
    },
}));

const renderUseBoardById = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    return renderHook(() => useBoardById("board-1"), { wrapper });
};

describe("useBoardById — active client", () => {
    beforeEach(() => {
        mocks.activeClientId = CLIENT_ID;
        mocks.fetchBoard.mockResolvedValue({ id: "board-1" });
        mocks.fetchBoardResources.mockResolvedValue({ data: { items: [] }, metadata: {} });
        mocks.exportBoardResources.mockResolvedValue({ data: {} });
    });

    it("forwards the loaded client id to fetchBoardResources", async () => {
        renderUseBoardById();
        await waitFor(() => expect(mocks.fetchBoardResources).toHaveBeenCalled());
        expect(mocks.fetchBoardResources).toHaveBeenCalledWith("board-1", 1, { filter: [] }, CLIENT_ID);
    });

    it("forwards the loaded client id when exporting board resources", async () => {
        const { result } = renderUseBoardById();

        await act(async () => {
            await result.current.handleDownloadBoard();
        });

        expect(mocks.exportBoardResources).toHaveBeenCalledWith("board-1", { filter: [] }, CLIENT_ID);
    });
});
