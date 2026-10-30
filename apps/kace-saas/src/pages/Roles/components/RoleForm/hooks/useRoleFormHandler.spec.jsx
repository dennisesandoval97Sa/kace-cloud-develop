import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import useRoleFormHandler from "./useRoleFormHandler";
import useGeneralMutation from "@/hooks/useGeneralMutation";
import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const mockNavigate = vi.fn();
const mockMutateAsync = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockRefetchQueries = vi.fn();
const mockSetQueryData = vi.fn();
const mockGetQueryData = vi.fn();

vi.mock("react-router-dom", () => ({
    useNavigate: () => mockNavigate,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
        invalidateQueries: mockInvalidateQueries,
        refetchQueries: mockRefetchQueries,
        setQueryData: mockSetQueryData,
        getQueryData: mockGetQueryData,
    }),
}));

vi.mock("@/hooks/useGeneralMutation", () => ({
    default: vi.fn(),
}));

vi.mock("@/services/genericHandleSendInformation", () => ({
    genericHandleSendInformation: vi.fn(),
}));

vi.mock("../utils/processRoleData", () => ({
    validatePesmisions: vi.fn((permisos) => {
        return Boolean(permisos?.administrador?.length || permisos?.agente?.length);
    }),
}));

describe("useRoleFormHandler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useGeneralMutation.mockReturnValue({
            mutateAsync: mockMutateAsync,
            isPending: false,
        });
        mockMutateAsync.mockResolvedValue({ data: { success: true } });
        genericHandleSendInformation.mockReturnValue({ mockPayload: true });
    });

    it("configures useGeneralMutation with null path and additionalQueryKeys", () => {
        renderHook(() => useRoleFormHandler());

        expect(useGeneralMutation).toHaveBeenCalledWith({
            keyQuery: URL_AND_KEYS.roles.key,
            path: null,
            additionalQueryKeys: [["userInformation"], ["userRoles"]],
        });
    });

    it("sets formik errors and does not mutate if no permissions are granted", async () => {
        const { result } = renderHook(() => useRoleFormHandler());
        const setFormikErrors = vi.fn();
        const setFormikStatus = vi.fn();

        await act(async () => {
            await result.current.handleRole(
                { permisos: { administrador: [], agente: [] } },
                setFormikErrors,
                setFormikStatus,
            );
        });

        expect(setFormikStatus).toHaveBeenCalledWith("app.forms.permissionRequired");
        expect(setFormikErrors).toHaveBeenCalledWith("app.forms.permissionRequired");
        expect(mockMutateAsync).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("awaits mutation, updates cache, navigates immediately, and refetches userInformation", async () => {
        mockGetQueryData.mockReturnValue({
            user: { rol_id: "role-123" },
        });

        const { result } = renderHook(() => useRoleFormHandler());
        const setFormikErrors = vi.fn();
        const setFormikStatus = vi.fn();

        const roleValues = {
            id: "role-123",
            descripcion: "Rol Modificado",
            permisos: {
                administrador: [{ name: "RolesUpdate", granted: true }],
            },
        };

        await act(async () => {
            await result.current.handleRole(roleValues, setFormikErrors, setFormikStatus);
        });

        expect(genericHandleSendInformation).toHaveBeenCalledWith({
            values: roleValues,
            urlService: URL_AND_KEYS.roles.url,
            setFormikErrors,
            setFormikStatus,
            pending: false,
        });

        expect(mockMutateAsync).toHaveBeenCalledWith({ mockPayload: true });
        expect(mockSetQueryData).toHaveBeenCalledWith(["userInformation"], expect.any(Function));
        expect(mockNavigate).toHaveBeenCalledWith(URL_AND_KEYS.roles.url, { replace: true });
        expect(mockRefetchQueries).toHaveBeenCalledWith({ queryKey: ["userInformation"] });
    });

    it("does not update cache optimistically if edited role is not the current user role", async () => {
        mockGetQueryData.mockReturnValue({
            user: { rol_id: "different-role-id" },
        });

        const { result } = renderHook(() => useRoleFormHandler());
        const setFormikErrors = vi.fn();
        const setFormikStatus = vi.fn();

        const roleValues = {
            id: "role-456",
            descripcion: "Otro Rol",
            permisos: {
                administrador: [{ name: "RolesRead", granted: true }],
            },
        };

        await act(async () => {
            await result.current.handleRole(roleValues, setFormikErrors, setFormikStatus);
        });

        expect(mockMutateAsync).toHaveBeenCalled();
        expect(mockSetQueryData).not.toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith(URL_AND_KEYS.roles.url, { replace: true });
        expect(mockRefetchQueries).toHaveBeenCalledWith({ queryKey: ["userInformation"] });
    });

    it("does not call mutateAsync on a second handleRole while refetch is still pending", async () => {
        let resolveRefetch;
        const refetchPromise = new Promise((resolve) => {
            resolveRefetch = resolve;
        });
        mockRefetchQueries.mockReturnValue(refetchPromise);

        const { result } = renderHook(() => useRoleFormHandler());
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

        // Mutación ya resuelta y navegación efectuada
        expect(mockMutateAsync).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenCalledTimes(1);

        // Segundo envío durante la ventana de refetch pendiente
        await act(async () => {
            await result.current.handleRole(roleValues, setFormikErrors, setFormikStatus);
        });

        // No debe haberse llamado una segunda vez
        expect(mockMutateAsync).toHaveBeenCalledTimes(1);

        // Completamos el refetch inicial
        await act(async () => {
            resolveRefetch();
            await firstCallPromise;
        });
    });

    it("catches mutation errors gracefully without throwing", async () => {
        mockMutateAsync.mockRejectedValue(new Error("API Error"));

        const { result } = renderHook(() => useRoleFormHandler());
        const setFormikErrors = vi.fn();
        const setFormikStatus = vi.fn();

        const roleValues = {
            id: "role-123",
            descripcion: "Rol Error",
            permisos: {
                administrador: [{ name: "RolesCreate", granted: true }],
            },
        };

        await act(async () => {
            await expect(
                result.current.handleRole(roleValues, setFormikErrors, setFormikStatus),
            ).resolves.not.toThrow();
        });

        expect(mockNavigate).not.toHaveBeenCalled();
    });
});
