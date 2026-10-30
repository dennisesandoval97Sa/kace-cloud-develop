import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendInformation } from "@/services/generic-send-information";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import useMailAccountsMutation from "./useMailAccountsMutation";

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
}));

vi.mock("@/services/generic-send-information", () => ({
    sendInformation: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
    useNavigate: () => mocks.navigate,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("sonner", () => ({
    toast: {
        error: mocks.toastError,
        success: mocks.toastSuccess,
    },
}));

const renderMutation = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });
    const wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children);

    return { queryClient, ...renderHook(() => useMailAccountsMutation(), { wrapper }) };
};

describe("useMailAccountsMutation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("updates and invalidates paginated Mail Account caches", async () => {
        let resolveRequest;
        sendInformation.mockReturnValue(
            new Promise((resolve) => {
                resolveRequest = resolve;
            }),
        );
        const firstPageKey = [URL_AND_KEYS.mail_accounts.key, 0, 10, [], { field: null, direction: "asc" }];
        const secondPageKey = [URL_AND_KEYS.mail_accounts.key, 1, 10, [], { field: null, direction: "asc" }];
        const { queryClient, result } = renderMutation();
        queryClient.setQueryData(firstPageKey, {
            data: [{ id: "mail-account-id", description: "Before" }],
            count: 2,
        });
        queryClient.setQueryData(secondPageKey, {
            data: [{ id: "other-id", description: "Other" }],
            count: 2,
        });

        act(() => {
            result.current.mutate({
                id: "mail-account-id",
                url: "/mail-accounts/mail-account-id",
                dataPost: { description: "After" },
            });
        });

        await waitFor(() => {
            expect(queryClient.getQueryData(firstPageKey).data).toEqual([
                { id: "mail-account-id", description: "After" },
            ]);
            expect(queryClient.getQueryData(secondPageKey).data).toEqual([{ id: "other-id", description: "Other" }]);
        });

        await act(async () => {
            resolveRequest({ status: 200 });
        });

        await waitFor(() => {
            expect(mocks.navigate).toHaveBeenCalledWith("/mail-account");
            expect(mocks.toastSuccess).toHaveBeenCalledWith("app.alerts.done");
        });
    });

    it("translates the disallowed host error", async () => {
        sendInformation.mockRejectedValue({
            response: {
                data: {
                    message: "Host smtp.example.com is not allowed",
                },
            },
        });
        const { result } = renderMutation();

        act(() => {
            result.current.mutate({
                url: "/mail-accounts",
                dataPost: { host: "smtp.example.com" },
            });
        });

        await waitFor(() => {
            expect(mocks.toastError).toHaveBeenCalledWith("mailAccounts.errors.hostNotAllowed");
        });
    });
});
