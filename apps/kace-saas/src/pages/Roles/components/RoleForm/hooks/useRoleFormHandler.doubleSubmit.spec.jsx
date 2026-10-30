import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendInformation } from "@/services/generic-send-information";
import useRoleFormHandler from "./useRoleFormHandler";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const mockNavigate = vi.fn();

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
        useNavigate: () => mockNavigate,
    };
});

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

vi.mock("../utils/processRoleData", () => ({
    validatePesmisions: vi.fn(() => true),
}));

describe("useRoleFormHandler - double submit prevention with real QueryClient", () => {
    let queryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        });
    });

    it("does not call sendInformation a second time during the window after mutation resolves while refetch is pending", async () => {
        let resolveUserData;
        const userDataPromise = new Promise((resolve) => {
            resolveUserData = resolve;
        });

        queryClient.setQueryDefaults(["userInformation"], {
            queryFn: () => userDataPromise,
        });
        queryClient.setQueryData(["userInformation"], {
            user: { rol_id: "role-123" },
            permisions: { administrador: [] },
        });

        sendInformation.mockResolvedValue({
            data: { data: { id: "role-123" } },
        });

        const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

        const { result } = renderHook(() => useRoleFormHandler(), { wrapper });

        const setFormikErrors = vi.fn();
        const setFormikStatus = vi.fn();
        const roleValues = {
            id: "role-123",
            descripcion: "Rol Modificado",
            permisos: {
                administrador: [{ name: "RolesUpdate", granted: true }],
            },
        };

        let firstCallPromise;
        await act(async () => {
            firstCallPromise = result.current.handleRole(roleValues, setFormikErrors, setFormikStatus);
        });

        // Mutación confirmada: sendInformation llamado una vez y navigate ejecutado inmediatamente
        await waitFor(() => {
            expect(sendInformation).toHaveBeenCalledTimes(1);
            expect(mockNavigate).toHaveBeenCalledWith(URL_AND_KEYS.roles.url, { replace: true });
        });

        // Segundo envío durante la ventana en la que la mutación ya resolvió pero userInformation sigue recargando
        await act(async () => {
            await result.current.handleRole(roleValues, setFormikErrors, setFormikStatus);
        });

        // Garantizar que no se produce un segundo POST
        expect(sendInformation).toHaveBeenCalledTimes(1);

        // Desbloquear y finalizar refetch
        await act(async () => {
            resolveUserData({ user: { rol_id: "role-123" } });
            await firstCallPromise;
        });
    });

    it("prevents duplicate creation POST without id when submitted twice rapidly", async () => {
        let resolveUserData;
        const userDataPromise = new Promise((resolve) => {
            resolveUserData = resolve;
        });

        queryClient.setQueryDefaults(["userInformation"], {
            queryFn: () => userDataPromise,
        });
        queryClient.setQueryData(["userInformation"], {
            user: { rol_id: "current-user-role" },
            permisions: {},
        });

        sendInformation.mockResolvedValue({
            data: { data: { id: "new-role-id" } },
        });

        const wrapper = ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

        const { result } = renderHook(() => useRoleFormHandler(), { wrapper });

        const createValues = {
            descripcion: "Rol Creado",
            permisos: {
                administrador: [{ name: "RolesCreate", granted: true }],
            },
        };

        let firstCallPromise;
        await act(async () => {
            firstCallPromise = result.current.handleRole(createValues, vi.fn(), vi.fn());
        });

        await waitFor(() => {
            expect(sendInformation).toHaveBeenCalledTimes(1);
            expect(mockNavigate).toHaveBeenCalledWith(URL_AND_KEYS.roles.url, { replace: true });
        });

        // Segundo envío sin id en la misma ventana
        await act(async () => {
            await result.current.handleRole(createValues, vi.fn(), vi.fn());
        });

        expect(sendInformation).toHaveBeenCalledTimes(1);

        await act(async () => {
            resolveUserData({ user: { rol_id: "other" } });
            await firstCallPromise;
        });
    });
});
