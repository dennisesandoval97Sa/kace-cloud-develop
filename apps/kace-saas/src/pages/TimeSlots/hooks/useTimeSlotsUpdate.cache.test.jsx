import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendInformation } from "../../../services/generic-send-information";
import { TIME_SLOTS_QUERY_KEY } from "../data/constants";
import { useTimeSlotUpdate } from "./useTimeSlotsUpdate";

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
}));

vi.mock("../../../services/generic-send-information", () => ({
    sendInformation: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
    useNavigate: () => mocks.navigate,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
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

const renderUseTimeSlotUpdate = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });
    const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

    return {
        queryClient,
        ...renderHook(() => useTimeSlotUpdate(), { wrapper }),
    };
};

describe("useTimeSlotUpdate paginated cache", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("optimistically updates the matching Appointment Time Slot in DataTableV2 caches", async () => {
        const request = createDeferred();
        sendInformation.mockReturnValue(request.promise);
        const queryKey = [TIME_SLOTS_QUERY_KEY, 0, 10, [], { direction: "asc", field: "description" }];
        const { queryClient, result } = renderUseTimeSlotUpdate();
        queryClient.setQueryData(queryKey, {
            data: [{ id: "time-slot-id", description: "Before", is_active: true }],
            count: 1,
        });

        act(() => {
            result.current.handleTimeSlotsUpdate({
                id: "time-slot-id",
                description: "After",
                is_active: true,
            });
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(queryKey).data).toEqual([
                { id: "time-slot-id", description: "After", is_active: true },
            ]);
        });

        await act(async () => {
            request.resolve({ data: {}, status: 200 });
            await request.promise;
        });

        await waitFor(() => {
            expect(mocks.navigate).toHaveBeenCalledWith("/appointment-time-slots");
        });
    });

    it("does not insert a created Time Slot before the server returns its canonical id", async () => {
        const request = createDeferred();
        sendInformation.mockReturnValue(request.promise);
        const queryKey = [TIME_SLOTS_QUERY_KEY, 0, 10, [], {}];
        const cachedPage = {
            data: [{ id: "keep", description: "Keep" }],
            count: 1,
        };
        const { queryClient, result } = renderUseTimeSlotUpdate();
        queryClient.setQueryData(queryKey, cachedPage);

        act(() => {
            result.current.handleTimeSlotsUpdate({
                id: null,
                description: "Created time slot",
            });
        });

        await waitFor(() => expect(sendInformation).toHaveBeenCalledTimes(1));
        expect(queryClient.getQueryData(queryKey)).toEqual(cachedPage);

        await act(async () => {
            request.resolve({ data: { data: { id: "server-time-slot-id" } } });
            await request.promise;
        });
    });

    it("rolls back every matching DataTableV2 cache when the update fails", async () => {
        const request = createDeferred();
        sendInformation.mockReturnValue(request.promise);
        const firstPageKey = [TIME_SLOTS_QUERY_KEY, 0, 10, [], {}];
        const secondPageKey = [TIME_SLOTS_QUERY_KEY, 1, 10, [], {}];
        const firstPage = {
            data: [{ id: "time-slot-id", description: "Before" }],
            count: 2,
        };
        const secondPage = {
            data: [{ id: "second-time-slot", description: "Second page" }],
            count: 2,
        };
        const { queryClient, result } = renderUseTimeSlotUpdate();
        queryClient.setQueryData(firstPageKey, firstPage);
        queryClient.setQueryData(secondPageKey, secondPage);

        act(() => {
            result.current.handleTimeSlotsUpdate({
                id: "time-slot-id",
                description: "After",
            });
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
        });
    });
});
