import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendInformation } from "../../../services/generic-send-information";
import { AGENDA_QUERY_KEY } from "../data/constants";
import { useAgendaUpdate } from "./useAgendaUpdate";

const mocks = vi.hoisted(() => ({
    handleAgendaToGroup: vi.fn(),
    handleAgendaToGroupUpdate: vi.fn(),
    handleDetach: vi.fn(),
    toastError: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("sonner", () => ({
    toast: {
        error: mocks.toastError,
    },
}));

vi.mock("@kace/urls", () => ({
    AGENDA_SERVICE: "/agendas",
}));

vi.mock("../../../services/generic-send-information", () => ({
    sendInformation: vi.fn(),
}));

vi.mock("../data", () => ({
    formatDataBeforePost: vi.fn((values, id) => ({
        ...values,
        id: id || "11111111-1111-4111-8111-111111111111",
    })),
}));

vi.mock("./useAgendaToGroupUpdate", () => ({
    useAgendaToGroupUpdate: () => ({
        handleAgendaToGroup: mocks.handleAgendaToGroup,
        handleAgendaToGroupUpdate: mocks.handleAgendaToGroupUpdate,
        handleDetach: mocks.handleDetach,
    }),
}));

const createDeferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((_resolve, _reject) => {
        resolve = _resolve;
        reject = _reject;
    });
    return { promise, reject, resolve };
};

const renderUseAgendaUpdate = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });
    const wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children);

    return {
        queryClient,
        ...renderHook(() => useAgendaUpdate(), { wrapper }),
    };
};

describe("useAgendaUpdate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes the server-created Agenda id to the Agenda-Group batch update", async () => {
        const createdAgendaId = "22222222-2222-4222-8222-222222222222";
        sendInformation.mockResolvedValue({
            data: {
                data: {
                    id: createdAgendaId,
                },
            },
        });
        const values = {
            id: null,
            description: "Created agenda",
            daily_limit: 5,
            groups: ["33333333-3333-4333-8333-333333333333"],
        };
        const { result } = renderUseAgendaUpdate();

        act(() => {
            result.current.handleAgendaUpdate(values, null);
        });

        await waitFor(() => {
            expect(mocks.handleAgendaToGroupUpdate).toHaveBeenCalledWith(createdAgendaId);
        });
        expect(mocks.handleDetach).not.toHaveBeenCalled();
    });

    it("optimistically updates whichever DataTableV2 page contains the Agenda", async () => {
        const request = createDeferred();
        sendInformation.mockReturnValue(request.promise);
        const firstPageKey = [AGENDA_QUERY_KEY, 0, 10, [], { direction: "asc", field: "description" }];
        const secondPageKey = [AGENDA_QUERY_KEY, 1, 10, [], { direction: "asc", field: "description" }];
        const detailQueryKey = [AGENDA_QUERY_KEY, "agenda-detail"];
        const { queryClient, result } = renderUseAgendaUpdate();
        queryClient.setQueryData(firstPageKey, {
            data: [{ id: "keep", description: "Keep" }],
            count: 2,
        });
        queryClient.setQueryData(secondPageKey, {
            data: [{ id: "update", description: "Before", daily_limit: 2 }],
            count: 2,
        });
        queryClient.setQueryData(detailQueryKey, {
            data: { id: "update", description: "Detail" },
        });

        act(() => {
            result.current.handleAgendaUpdate(
                {
                    id: "update",
                    description: "After",
                    daily_limit: 5,
                    groups: [],
                },
                [],
            );
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(secondPageKey).data[0]).toEqual(
                expect.objectContaining({
                    id: "update",
                    description: "After",
                    daily_limit: 5,
                }),
            );
        });
        expect(queryClient.getQueryData(firstPageKey).data).toEqual([{ id: "keep", description: "Keep" }]);
        expect(queryClient.getQueryData(detailQueryKey)).toEqual({
            data: { id: "update", description: "Detail" },
        });

        await act(async () => {
            request.resolve({ data: { data: { id: "update" } } });
            await request.promise;
        });

        await waitFor(() => {
            expect(mocks.handleDetach).toHaveBeenCalledTimes(1);
        });
    });

    it("does not insert a created Agenda before the server returns its canonical id", async () => {
        const request = createDeferred();
        sendInformation.mockReturnValue(request.promise);
        const queryKey = [AGENDA_QUERY_KEY, 0, 10, [], {}];
        const cachedPage = {
            data: [{ id: "keep", description: "Keep" }],
            count: 1,
        };
        const { queryClient, result } = renderUseAgendaUpdate();
        queryClient.setQueryData(queryKey, cachedPage);

        act(() => {
            result.current.handleAgendaUpdate(
                {
                    id: null,
                    description: "Created agenda",
                    groups: [],
                },
                null,
            );
        });

        await waitFor(() => expect(sendInformation).toHaveBeenCalledTimes(1));
        expect(queryClient.getQueryData(queryKey)).toEqual(cachedPage);

        await act(async () => {
            request.resolve({ data: { data: { id: "server-agenda-id" } } });
            await request.promise;
        });
    });

    it("rolls back every matching Agenda page when the update fails", async () => {
        const request = createDeferred();
        sendInformation.mockReturnValue(request.promise);
        const firstPageKey = [AGENDA_QUERY_KEY, 0, 10, [], {}];
        const secondPageKey = [AGENDA_QUERY_KEY, 1, 10, [], {}];
        const firstPage = {
            data: [{ id: "update", description: "Before" }],
            count: 2,
        };
        const secondPage = {
            data: [{ id: "keep", description: "Keep" }],
            count: 2,
        };
        const { queryClient, result } = renderUseAgendaUpdate();
        queryClient.setQueryData(firstPageKey, firstPage);
        queryClient.setQueryData(secondPageKey, secondPage);

        act(() => {
            result.current.handleAgendaUpdate(
                {
                    id: "update",
                    description: "After",
                    groups: [],
                },
                [],
            );
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(firstPageKey).data[0].description).toBe("After");
        });

        await act(async () => {
            request.reject(new Error("update failed"));
            await expect(request.promise).rejects.toThrow("update failed");
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(firstPageKey)).toEqual(firstPage);
            expect(queryClient.getQueryData(secondPageKey)).toEqual(secondPage);
            expect(mocks.toastError).toHaveBeenCalledWith("app.alerts.error");
        });
    });
});
