import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDelete } from "@/services/deleteService";
import useGeneralDelete from "./useGeneralDelete";

const mocks = vi.hoisted(() => ({
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
}));

vi.mock("@/services/deleteService", () => ({
    fetchDelete: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("sonner", () => ({
    toast: {
        error: mocks.toastError,
        success: mocks.toastSuccess,
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

const renderUseGeneralDelete = (options) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });
    const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

    return {
        queryClient,
        ...renderHook(() => useGeneralDelete(options), { wrapper }),
    };
};

describe("useGeneralDelete", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("optimistically removes an item from paginated DataTableV2 query caches", async () => {
        const request = createDeferred();
        fetchDelete.mockReturnValue(request.promise);
        const queryKey = ["globalConfigurations", 0, 10, [], { direction: "asc", field: "description" }];
        const detailQueryKey = ["globalConfigurations", "configuration-detail"];
        const { queryClient, result } = renderUseGeneralDelete({
            keyQuery: "globalConfigurations",
            successMessage: "Se eliminó correctamente el registro de Configuración General",
        });
        queryClient.setQueryData(queryKey, {
            data: [{ id: "keep" }, { id: "remove" }],
            count: 2,
        });
        queryClient.setQueryData(detailQueryKey, { data: { id: "configuration-detail" } });

        act(() => {
            result.current.mutate({ id: "remove", url: "/global-configuration" });
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(queryKey).data).toEqual([{ id: "keep" }]);
            expect(queryClient.getQueryData(detailQueryKey)).toEqual({ data: { id: "configuration-detail" } });
        });

        await act(async () => {
            request.resolve({ status: 204 });
            await request.promise;
        });

        await waitFor(() => {
            expect(mocks.toastSuccess).toHaveBeenCalledWith(
                "Se eliminó correctamente el registro de Configuración General",
            );
        });
    });

    it("rolls back every matching cache and uses consumer-provided error copy", async () => {
        const request = createDeferred();
        fetchDelete.mockReturnValue(request.promise);
        const firstPageKey = ["globalConfigurations", 0, 10, [], {}];
        const secondPageKey = ["globalConfigurations", 1, 10, [], {}];
        const firstPage = { data: [{ id: "remove" }], count: 2 };
        const secondPage = { data: [{ id: "keep" }], count: 2 };
        const { queryClient, result } = renderUseGeneralDelete({
            keyQuery: "globalConfigurations",
            errorMessage: "No es posible eliminar Configuración General",
        });
        queryClient.setQueryData(firstPageKey, firstPage);
        queryClient.setQueryData(secondPageKey, secondPage);

        act(() => {
            result.current.mutate({ id: "remove", url: "/global-configuration" });
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(firstPageKey).data).toEqual([]);
        });

        await act(async () => {
            request.reject(new Error("delete failed"));
            await expect(request.promise).rejects.toThrow("delete failed");
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(firstPageKey)).toEqual(firstPage);
            expect(queryClient.getQueryData(secondPageKey)).toEqual(secondPage);
            expect(mocks.toastError).toHaveBeenCalledWith("No es posible eliminar Configuración General");
        });
    });
});
