import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useActionsChannelHub from "./useActionsChannelHub";

const mocks = vi.hoisted(() => ({
    apiPost: vi.fn(),
    deleteMutate: vi.fn(),
    navigate: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
}));

vi.mock("@/hooks/useGeneralDelete", () => ({
    default: vi.fn(() => ({ mutate: mocks.deleteMutate })),
}));

vi.mock("@/utils/main", () => ({
    apiService: {
        post: mocks.apiPost,
    },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");

    return {
        ...actual,
        useNavigate: () => mocks.navigate,
    };
});

vi.mock("sonner", () => ({
    toast: {
        error: mocks.toastError,
        success: mocks.toastSuccess,
    },
}));

const renderUseActionsChannelHub = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false },
        },
    });

    const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

    return renderHook(() => useActionsChannelHub(), { wrapper });
};

describe("useActionsChannelHub", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.apiPost.mockResolvedValue({ status: 200 });
    });

    it("registers a Channel Hub account through the configured KACE API service", async () => {
        const { result } = renderUseActionsChannelHub();

        act(() => {
            result.current.handleRegister("account-id");
        });

        await waitFor(() => {
            expect(mocks.apiPost).toHaveBeenCalledWith("/channel-hub/account-id/register");
        });
        expect(mocks.toastSuccess).toHaveBeenCalledWith("channelHub.register_success");
        expect(mocks.toastError).not.toHaveBeenCalled();
    });
});
