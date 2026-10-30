import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDelete } from "@/services/deleteService";
import useNotificationsAgentAction from "./useNotificationsAgentAction";

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
}));

vi.mock("@/services/deleteService", () => ({
    fetchDelete: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "app.title.notificationsAgent": "Notificaciones Agentes",
                "notificationsAgent.deleteSuccess": "Notificación de agente eliminada",
            })[key] ?? key,
    }),
}));

vi.mock("react-router-dom", () => ({
    useNavigate: () => mocks.navigate,
}));

vi.mock("sonner", () => ({
    toast: {
        error: mocks.toastError,
        success: mocks.toastSuccess,
    },
}));

describe("useNotificationsAgentAction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows a grammatically correct localized toast after deleting a notification", async () => {
        fetchDelete.mockResolvedValue(true);
        const queryClient = new QueryClient({
            defaultOptions: {
                mutations: { retry: false },
                queries: { retry: false },
            },
        });
        const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
        const { result } = renderHook(() => useNotificationsAgentAction(), { wrapper });

        await act(async () => {
            result.current.handleDeleteNotificationsAgent("notification-id");
        });

        await waitFor(() => {
            expect(mocks.toastSuccess).toHaveBeenCalledWith("Notificación de agente eliminada");
        });
    });
});
