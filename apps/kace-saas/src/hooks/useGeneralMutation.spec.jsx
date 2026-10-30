import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendInformation } from "@/services/generic-send-information";
import useGeneralMutation from "./useGeneralMutation";

vi.mock("@/services/generic-send-information", () => ({
    sendInformation: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("react-redux", () => ({
    useDispatch: () => vi.fn(),
}));

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");

    return {
        ...actual,
        useNavigate: () => vi.fn(),
    };
});

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

describe("useGeneralMutation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("optimistically updates the matching item in a paginated DataTableV2 cache", async () => {
        const request = createDeferred();
        sendInformation.mockReturnValue(request.promise);
        const queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });
        const queryKey = ["globalConfigurations", 0, 10, [], { direction: "asc", field: "description" }];
        queryClient.setQueryData(queryKey, {
            data: [{ id: "configuration-id", description: "Before" }],
            count: 1,
        });
        const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
        const { result } = renderHook(
            () => useGeneralMutation({ keyQuery: "globalConfigurations", onSuccessToast: false }),
            { wrapper },
        );

        act(() => {
            result.current.mutate({
                id: "configuration-id",
                url: "/global-configuration/configuration-id",
                dataPost: { description: "After" },
                options: {},
            });
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(queryKey).data).toEqual([{ id: "configuration-id", description: "After" }]);
        });

        await act(async () => {
            request.resolve({ data: {}, status: 200 });
            await request.promise;
        });
    });

    it("rolls back paginated cache updates when the mutation fails", async () => {
        const request = createDeferred();
        sendInformation.mockReturnValue(request.promise);
        const queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });
        const queryKey = ["globalConfigurations", 0, 10, [], {}];
        const previousData = {
            data: [{ id: "configuration-id", description: "Before" }],
            count: 1,
        };
        queryClient.setQueryData(queryKey, previousData);
        const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
        const { result } = renderHook(
            () => useGeneralMutation({ keyQuery: "globalConfigurations", onSuccessToast: false }),
            { wrapper },
        );

        let mutationPromise;
        act(() => {
            mutationPromise = result.current.mutateAsync({
                id: "configuration-id",
                url: "/global-configuration/configuration-id",
                dataPost: { description: "After" },
                options: {},
            });
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(queryKey).data[0].description).toBe("After");
        });

        await act(async () => {
            request.reject(new Error("update failed"));
            await expect(mutationPromise).rejects.toThrow("update failed");
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(queryKey)).toEqual(previousData);
        });
    });

    it("adds an optimistic create only to cached first pages", async () => {
        const request = createDeferred();
        sendInformation.mockReturnValue(request.promise);
        const queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });
        const firstPageKey = ["globalConfigurations", 0, 10, [], {}];
        const secondPageKey = ["globalConfigurations", 1, 10, [], {}];
        queryClient.setQueryData(firstPageKey, { data: [{ id: "first-page-item" }], count: 2 });
        queryClient.setQueryData(secondPageKey, { data: [{ id: "second-page-item" }], count: 2 });
        const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
        const { result } = renderHook(
            () => useGeneralMutation({ keyQuery: "globalConfigurations", onSuccessToast: false }),
            { wrapper },
        );

        act(() => {
            result.current.mutate({
                url: "/global-configuration",
                dataPost: { id: "new-configuration", description: "New" },
                options: {},
            });
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(firstPageKey).data).toEqual([
                { id: "new-configuration", description: "New" },
                { id: "first-page-item" },
            ]);
            expect(queryClient.getQueryData(secondPageKey).data).toEqual([{ id: "second-page-item" }]);
        });

        await act(async () => {
            request.resolve({ data: {}, status: 201 });
            await request.promise;
        });
    });

    it("invalidates related detail caches after a successful update", async () => {
        sendInformation.mockResolvedValue({ data: {}, status: 200 });
        const queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });
        const detailQueryKey = ["notificationsAgentForm", "notification-id"];
        queryClient.setQueryData(detailQueryKey, {
            id: "notification-id",
            fecha_fin: "2026-08-03T23:59:59.999Z",
        });
        const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
        const { result } = renderHook(
            () =>
                useGeneralMutation({
                    keyQuery: "notificationsAgentData",
                    additionalQueryKeys: [detailQueryKey],
                    onSuccessToast: false,
                }),
            { wrapper },
        );

        await act(async () => {
            await result.current.mutateAsync({
                id: "notification-id",
                url: "/notifications-agent/notification-id",
                dataPost: { fecha_fin: "2026-08-04T23:59:59.999Z" },
                options: {},
            });
        });

        expect(queryClient.getQueryState(detailQueryKey).isInvalidated).toBe(true);
    });

    it("preserves related detail caches when an update fails", async () => {
        sendInformation.mockRejectedValue(new Error("update failed"));
        const queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });
        const detailQueryKey = ["notificationsAgentForm", "notification-id"];
        const cachedDetail = {
            id: "notification-id",
            fecha_fin: "2026-08-03T23:59:59.999Z",
        };
        queryClient.setQueryData(detailQueryKey, cachedDetail);
        const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
        const { result } = renderHook(
            () =>
                useGeneralMutation({
                    keyQuery: "notificationsAgentData",
                    additionalQueryKeys: [detailQueryKey],
                    onSuccessToast: false,
                }),
            { wrapper },
        );

        await act(async () => {
            await expect(
                result.current.mutateAsync({
                    id: "notification-id",
                    url: "/notifications-agent/notification-id",
                    dataPost: { fecha_fin: "2026-08-04T23:59:59.999Z" },
                    options: {},
                }),
            ).rejects.toThrow("update failed");
        });

        expect(queryClient.getQueryData(detailQueryKey)).toEqual(cachedDetail);
        expect(queryClient.getQueryState(detailQueryKey).isInvalidated).toBe(false);
    });

    it("never writes submitted secret data to list caches when optimistic updates are disabled", async () => {
        const request = createDeferred();
        sendInformation.mockReturnValue(request.promise);
        const queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });
        const queryKey = ["vaultSecret", 0, 10, [], {}];
        const maskedData = {
            data: [{ id: "secret-id", descripcion: "Database", secreto: "***" }],
            count: 1,
        };
        queryClient.setQueryData(queryKey, maskedData);
        const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
        const { result } = renderHook(
            () =>
                useGeneralMutation({
                    keyQuery: "vaultSecret",
                    onSuccessToast: false,
                    optimisticListUpdate: false,
                }),
            { wrapper },
        );

        act(() => {
            result.current.mutate({
                id: "secret-id",
                url: "/secrets-vault/secret-id",
                dataPost: { descripcion: "Database", secreto: "plain-text-secret" },
                options: {},
            });
        });

        await waitFor(() => expect(sendInformation).toHaveBeenCalled());
        expect(queryClient.getQueryData(queryKey)).toEqual(maskedData);
        expect(JSON.stringify(queryClient.getQueriesData({ queryKey: ["vaultSecret"] }))).not.toContain(
            "plain-text-secret",
        );

        await act(async () => {
            request.resolve({ data: { data: { id: "secret-id", secreto: "***" } }, status: 200 });
            await request.promise;
        });

        expect(queryClient.getQueryState(queryKey).isInvalidated).toBe(true);
        expect(JSON.stringify(queryClient.getQueriesData({ queryKey: ["vaultSecret"] }))).not.toContain(
            "plain-text-secret",
        );
    });
});
